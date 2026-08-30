import { randomUUID } from 'node:crypto';
import { db } from '../db/client';

/**
 * Popula vaga_config com capacidade SINTÉTICA (20-40 por combinação) — não há
 * fonte de capacidade real granular por unidade×grupamento×turno pronta no
 * dataset fornecido (ver docs/desafio/planilhas-dicionario.md). Isso é só
 * pra demo não começar com "0 vagas em tudo"; o operador ajusta depois via
 * POST /unidades/:id/vagas.
 */
const ANO_PROCESSO = Number(process.env.ANO_PROCESSO_SEED ?? new Date().getFullYear());
const GRUPAMENTOS = ['Bercario', 'Maternal I', 'Maternal II'] as const;
const TURNOS = ['Integral', 'Parcial'] as const;

function capacidadeSintetica(): number {
  return 20 + Math.floor(Math.random() * 21); // 20-40
}

async function main() {
  const unidades = db.query('SELECT id FROM unidade WHERE ativa = 1').all() as Array<{ id: string }>;
  console.log(`[seed-vagas] gerando capacidade sintética para ${unidades.length} unidades, ano ${ANO_PROCESSO}`);

  const inserir = db.query(
    `INSERT OR IGNORE INTO vaga_config (id, unidade_id, ano_processo, grupamento, turno, capacidade_total, vagas_ocupadas)
     VALUES ($id, $unidadeId, $ano, $grupamento, $turno, $capacidade, 0)`
  );

  const transacao = db.transaction(() => {
    for (const unidade of unidades) {
      for (const grupamento of GRUPAMENTOS) {
        for (const turno of TURNOS) {
          inserir.run({
            $id: randomUUID(),
            $unidadeId: unidade.id,
            $ano: ANO_PROCESSO,
            $grupamento: grupamento,
            $turno: turno,
            $capacidade: capacidadeSintetica(),
          });
        }
      }
    }
  });
  transacao();

  console.log('[seed-vagas] concluído');
}

await main();
