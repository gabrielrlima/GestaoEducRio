import * as XLSX from 'xlsx';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client';

/**
 * Substitui a capacidade SINTÉTICA de seed-vagas.ts por dado real derivado
 * das planilhas de OferecimentosEvagas (ver docs/desafio/planilhas-dicionario.md):
 *
 * - Unidades PARCEIRAS: Meta e Aluno são reais, direto de
 *   `Parceiras2025.xlsx` (snapshot maio/2025 — não existe processo 2026
 *   ainda, é o dado real mais recente disponível). A planilha não separa por
 *   turno, então tudo entra em "Integral" (Parcial fica 0/0 pra essa unidade).
 * - Unidades DIRETAS: `totaalunoscreche2025.xlsx` (sic — nome do arquivo
 *   fonte tem esse typo) só tem Aluno (matriculados reais) e Turma (nº de
 *   turmas real) — sem capacidade. Estimamos capacidade_total = Turma × 24.67
 *   (razão Meta/Turma observada em Parceiras2021, o único ano que traz os
 *   dois campos juntos — ver docs/desafio/planilhas-dicionario.md). É uma
 *   ESTIMATIVA rotulada como tal, não capacidade oficial.
 *
 * Código de unidade normalizado (zero à esquerda variável entre fontes) —
 * mesmo achado de planilhas-dicionario.md.
 */
const DADOS_DIR = process.env.DADOSCRECHE_DIR ?? '../data/dadoscreche';
const PARCEIRAS_PATH = `${DADOS_DIR}/OferecimentosEvagas/Parceiras2025.xlsx`;
const DIRETAS_PATH = `${DADOS_DIR}/OferecimentosEvagas/totaalunoscreche2025.xlsx`;
const ANO_PROCESSO = Number(process.env.ANO_PROCESSO_SEED ?? new Date().getFullYear());
const RATIO_CAPACIDADE_POR_TURMA = 24.67;

function normalizarCodigo(v: unknown): string {
  const s = String(v ?? '').trim();
  return s.replace(/^0+/, '') || '0';
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

async function lerPlanilha(path: string, sheetName: string): Promise<unknown[][]> {
  const buffer = await Bun.file(path).arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada em ${path}. Abas disponíveis: ${workbook.SheetNames.join(', ')}`);
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
}

const upsert = db.query(
  `INSERT INTO vaga_config (id, unidade_id, ano_processo, grupamento, turno, capacidade_total, vagas_ocupadas)
   VALUES ($id, $unidadeId, $ano, $grupamento, $turno, $capacidade, $ocupadas)
   ON CONFLICT(unidade_id, ano_processo, grupamento, turno)
   DO UPDATE SET capacidade_total = excluded.capacidade_total, vagas_ocupadas = excluded.vagas_ocupadas`
);

async function main() {
  const unidades = db.query('SELECT id, esc_codigo FROM unidade WHERE ativa = 1 AND esc_codigo IS NOT NULL').all() as Array<{
    id: string;
    esc_codigo: string;
  }>;
  const porCodigo = new Map<string, string>();
  for (const u of unidades) porCodigo.set(normalizarCodigo(u.esc_codigo), u.id);
  console.log(`[seed-vagas-real] ${unidades.length} unidades ativas com esc_codigo`);

  let parceirasAtualizadas = 0;
  let diretasAtualizadas = 0;

  // --- Parceiras (real: Meta, Aluno) ---
  // colunas 0-idx: CRE(0) CÓDIGO SGA(1) Denominação(2) Grupamentos(3) MetaTotal(4)
  // BI: Aluno(5) Incluído(6) Meta(7) Vagas(8) | BII: (9,10,11,12) | MI: (13,14,15,16) | MII: (17,18,19,20)
  // linhas 0-1 (0-idx) são cabeçalho, dados a partir da linha 2 (0-idx)
  const parceirasRows = await lerPlanilha(PARCEIRAS_PATH, 'MAIO -2025');
  db.transaction(() => {
    for (let i = 2; i < parceirasRows.length; i++) {
      const row = parceirasRows[i] as unknown[];
      if (!row || row[1] == null) continue;
      const unidadeId = porCodigo.get(normalizarCodigo(row[1]));
      if (!unidadeId) continue;

      const biAluno = toNum(row[5]);
      const biMeta = toNum(row[7]);
      const biiAluno = toNum(row[9]);
      const biiMeta = toNum(row[11]);
      const miAluno = toNum(row[13]);
      const miMeta = toNum(row[15]);
      const miiAluno = toNum(row[17]);
      const miiMeta = toNum(row[19]);

      const grupos: Array<[string, number, number]> = [
        ['Bercario', biMeta + biiMeta, biAluno + biiAluno],
        ['Maternal I', miMeta, miAluno],
        ['Maternal II', miiMeta, miiAluno],
      ];

      for (const [grupamento, capacidade, ocupadas] of grupos) {
        upsert.run({
          $id: randomUUID(),
          $unidadeId: unidadeId,
          $ano: ANO_PROCESSO,
          $grupamento: grupamento,
          $turno: 'Integral',
          $capacidade: Math.round(capacidade),
          $ocupadas: Math.round(ocupadas),
        });
        upsert.run({
          $id: randomUUID(),
          $unidadeId: unidadeId,
          $ano: ANO_PROCESSO,
          $grupamento: grupamento,
          $turno: 'Parcial',
          $capacidade: 0,
          $ocupadas: 0,
        });
      }
      parceirasAtualizadas++;
    }
  })();

  // --- Diretas (real: Aluno, Turma; capacidade estimada) ---
  // colunas 0-idx: CRE(0) Designacao(1) Denominacao(2)
  // Berç-Integral(3,4) Berç-Parcial(5,6) MatI-Integral(7,8) MatI-Parcial(9,10) MatII-Integral(11,12) MatII-Parcial(13,14)
  // linhas 0-2 (0-idx) são cabeçalho, dados a partir da linha 3 (0-idx)
  const diretasRows = await lerPlanilha(DIRETAS_PATH, 'Consolidado');
  db.transaction(() => {
    const blocos: Array<[string, string, number, number]> = [
      ['Bercario', 'Integral', 3, 4],
      ['Bercario', 'Parcial', 5, 6],
      ['Maternal I', 'Integral', 7, 8],
      ['Maternal I', 'Parcial', 9, 10],
      ['Maternal II', 'Integral', 11, 12],
      ['Maternal II', 'Parcial', 13, 14],
    ];
    for (let i = 3; i < diretasRows.length; i++) {
      const row = diretasRows[i] as unknown[];
      if (!row || row[1] == null) continue;
      const unidadeId = porCodigo.get(normalizarCodigo(row[1]));
      if (!unidadeId) continue;
      // já tratado pela planilha de parceiras (dado real e mais completo) — não sobrescrever com estimativa
      if (parceirasRows.slice(2).some((r) => normalizarCodigo((r as unknown[])[1]) === normalizarCodigo(row[1]))) continue;

      for (const [grupamento, turno, colAluno, colTurma] of blocos) {
        const aluno = toNum(row[colAluno as number]);
        const turma = toNum(row[colTurma as number]);
        const capacidadeEstimada = Math.round(turma * RATIO_CAPACIDADE_POR_TURMA);
        upsert.run({
          $id: randomUUID(),
          $unidadeId: unidadeId,
          $ano: ANO_PROCESSO,
          $grupamento: grupamento,
          $turno: turno,
          $capacidade: Math.max(capacidadeEstimada, aluno), // nunca capacidade < ocupação real
          $ocupadas: aluno,
        });
      }
      diretasAtualizadas++;
    }
  })();

  console.log(`[seed-vagas-real] unidades parceiras atualizadas com dado real: ${parceirasAtualizadas}`);
  console.log(`[seed-vagas-real] unidades diretas atualizadas (capacidade estimada, ocupação real): ${diretasAtualizadas}`);
  console.log('[seed-vagas-real] concluído');
}

await main();
