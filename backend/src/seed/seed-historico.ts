import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { db } from '../db/client';
import { normalizeUnitCode } from '../lib/geo';
import type { Grupamento, Turno } from '../modules/unidades/types';

/**
 * Popula `unidade_historico` e `unidade_disponibilidade` a partir da Query A do dataset
 * oficial (837.179 linhas, processos 2021-2025). É a fonte da "vacância histórica" e da
 * concorrência real por unidade — os únicos números do produto que descrevem o mundo real
 * (a capacidade em `vaga_config` é sintética, ver seed-vagas.ts).
 *
 * Lê o .gz em streaming (o arquivo descompactado passa de 200MB — não cabe confortável
 * em memória junto com o resto do processo).
 *
 * ⚠️ Aviso do próprio dataset: os números passaram por aleatorização/generalização, então
 * servem para comparar unidades entre si (proporções), não como estatística oficial.
 */

const DADOS_DIR = process.env.DADOSCRECHE_DIR ?? '../data/dadoscreche';
const QUERY_A_PATH = `${DADOS_DIR}/Bases IC_ ClassificadoseFila/01_QueryA_InscricoesPorAno.csv.gz`;

/** Mínimo de unidades numa região pra usar os percentis dela; abaixo disso cai pra cidade. */
const MIN_UNIDADES_POR_REGIAO = 6;

const GRUPAMENTO_POR_ROTULO: Record<string, Grupamento> = {
  berçário: 'Bercario',
  bercario: 'Bercario',
  'berçario': 'Bercario',
  'maternal i': 'Maternal I',
  'maternal ii': 'Maternal II',
};

function normalizarGrupamento(bruto: string): Grupamento | null {
  const limpo = bruto.replace(/"/g, '').trim().toLowerCase();
  return GRUPAMENTO_POR_ROTULO[limpo] ?? null;
}

function normalizarTurno(bruto: string): Turno | null {
  const limpo = bruto.replace(/"/g, '').trim();
  return limpo === 'Integral' || limpo === 'Parcial' ? limpo : null;
}

interface Contadores {
  inscricoes: number;
  primeiraOpcao: number;
  confirmados: number;
  listaEspera: number;
  selecionados: number;
  canceladosSistema: number;
  canceladosConfirmacao: number;
  canceladosOutros: number;
}

function contadoresVazios(): Contadores {
  return {
    inscricoes: 0,
    primeiraOpcao: 0,
    confirmados: 0,
    listaEspera: 0,
    selecionados: 0,
    canceladosSistema: 0,
    canceladosConfirmacao: 0,
    canceladosOutros: 0,
  };
}

/** Grafia preservada do dataset — `Cancelado na confirmacao` não tem cedilha nem til. */
function contabilizarSituacao(c: Contadores, situacao: string): void {
  switch (situacao.replace(/"/g, '').trim()) {
    case 'Confirmado':
      c.confirmados += 1;
      break;
    case 'Lista de espera':
      c.listaEspera += 1;
      break;
    case 'Selecionado':
    case 'Selecionado da lista':
    case 'Ativo':
      c.selecionados += 1;
      break;
    case 'Cancelado pelo sistema':
      c.canceladosSistema += 1;
      break;
    case 'Cancelado na confirmacao':
      c.canceladosConfirmacao += 1;
      break;
    default:
      c.canceladosOutros += 1;
  }
}

async function agregarQueryA(): Promise<Map<string, Contadores>> {
  const agregado = new Map<string, Contadores>();
  const stream = createReadStream(QUERY_A_PATH).pipe(createGunzip());
  const linhas = createInterface({ input: stream, crlfDelay: Infinity });

  let primeira = true;
  let lidas = 0;
  let descartadas = 0;

  for await (const linha of linhas) {
    if (primeira) {
      primeira = false; // cabeçalho (com BOM)
      continue;
    }
    if (!linha.trim()) continue;

    const campos = linha.split(';');
    const [ano, , , , opcao, unidade, , grupamentoBruto, horarioBruto] = campos;
    const situacao = campos[16] ?? '';

    const grupamento = normalizarGrupamento(grupamentoBruto ?? '');
    const turno = normalizarTurno(horarioBruto ?? '');
    if (!grupamento || !turno || !unidade) {
      descartadas += 1;
      continue;
    }

    const chave = `${normalizeUnitCode(unidade)}|${ano}|${grupamento}|${turno}`;
    let contadores = agregado.get(chave);
    if (!contadores) {
      contadores = contadoresVazios();
      agregado.set(chave, contadores);
    }

    contadores.inscricoes += 1;
    if (opcao === '1') contadores.primeiraOpcao += 1;
    contabilizarSituacao(contadores, situacao);

    lidas += 1;
    if (lidas % 200_000 === 0) console.log(`[seed-historico] ${lidas} linhas processadas...`);
  }

  console.log(`[seed-historico] Query A: ${lidas} linhas agregadas, ${descartadas} descartadas (grupamento/turno fora do domínio)`);
  return agregado;
}

interface UnidadeRef {
  id: string;
  bairro: string;
}

function carregarUnidadesPorCodigo(): Map<string, UnidadeRef> {
  const rows = db
    .query('SELECT id, esc_codigo, bairro FROM unidade WHERE esc_codigo IS NOT NULL')
    .all() as Array<{ id: string; esc_codigo: string; bairro: string }>;

  const mapa = new Map<string, UnidadeRef>();
  for (const row of rows) {
    // esc_codigo vira UUID aleatório quando a fonte não tinha código (ver seed-unidades.ts) —
    // esses nunca casam com a Query A, o normalize só os deixa passar sem colidir.
    mapa.set(normalizeUnitCode(row.esc_codigo), { id: row.id, bairro: row.bairro });
  }
  return mapa;
}

function gravarHistorico(agregado: Map<string, Contadores>, unidades: Map<string, UnidadeRef>): number {
  db.exec('DELETE FROM unidade_historico');

  const inserir = db.query(
    `INSERT INTO unidade_historico
       (id, unidade_id, ano, grupamento, turno, inscricoes, primeira_opcao, confirmados,
        lista_espera, selecionados, cancelados_sistema, cancelados_confirmacao, cancelados_outros)
     VALUES ($id, $unidadeId, $ano, $grupamento, $turno, $inscricoes, $primeiraOpcao, $confirmados,
             $listaEspera, $selecionados, $canceladosSistema, $canceladosConfirmacao, $canceladosOutros)`
  );

  let gravadas = 0;
  let semUnidade = 0;

  const transacao = db.transaction(() => {
    for (const [chave, c] of agregado) {
      const [codigo, ano, grupamento, turno] = chave.split('|');
      const unidade = unidades.get(codigo!);
      if (!unidade) {
        semUnidade += 1;
        continue;
      }
      inserir.run({
        $id: randomUUID(),
        $unidadeId: unidade.id,
        $ano: Number(ano),
        $grupamento: grupamento,
        $turno: turno,
        $inscricoes: c.inscricoes,
        $primeiraOpcao: c.primeiraOpcao,
        $confirmados: c.confirmados,
        $listaEspera: c.listaEspera,
        $selecionados: c.selecionados,
        $canceladosSistema: c.canceladosSistema,
        $canceladosConfirmacao: c.canceladosConfirmacao,
        $canceladosOutros: c.canceladosOutros,
      });
      gravadas += 1;
    }
  });
  transacao();

  console.log(`[seed-historico] unidade_historico: ${gravadas} linhas (${semUnidade} chaves sem unidade correspondente no cadastro)`);
  return gravadas;
}

interface Consolidado {
  unidadeId: string;
  bairro: string;
  grupamento: string;
  turno: string;
  anosCobertos: number;
  inscricoesMedia: number;
  confirmadosMedia: number;
  vacanciaMedia: number;
  taxaOferta: number;
  taxaAbsorcao: number;
  taxaVacancia: number;
  concorrencia: number | null;
  indice: number;
}

/**
 * Índice de disponibilidade = `taxa_oferta` = (confirmados + cancelados na confirmação)
 * / inscrições, ou seja: **de cada 100 inscrições nessa unidade, quantas chegaram a
 * receber a oferta de uma vaga** (tenha a família aceitado ou não).
 *
 * Escolhemos uma métrica única e literal em vez de um score ponderado porque ela é o que
 * a família de fato quer saber ("qual a chance de eu ser chamada aqui?") e porque cada
 * número que o agente cita precisa ser explicável em uma frase. `taxa_absorcao` e
 * `taxa_vacancia` continuam gravadas como contexto — a segunda é a "vacância histórica"
 * (vaga ofertada que vagou porque a família não confirmou, tipicamente por distância: é
 * o próprio problema R2 aparecendo no dado).
 */
function consolidar(): Consolidado[] {
  const rows = db
    .query(
      `SELECT h.unidade_id, u.bairro, h.grupamento, h.turno,
              COUNT(DISTINCT h.ano)                AS anos,
              SUM(h.inscricoes)                    AS inscricoes,
              SUM(h.confirmados)                   AS confirmados,
              SUM(h.cancelados_confirmacao)        AS vacancia
       FROM unidade_historico h
       JOIN unidade u ON u.id = h.unidade_id
       GROUP BY h.unidade_id, h.grupamento, h.turno`
    )
    .all() as Array<{
    unidade_id: string;
    bairro: string;
    grupamento: string;
    turno: string;
    anos: number;
    inscricoes: number;
    confirmados: number;
    vacancia: number;
  }>;

  return rows.map((r) => {
    const ofertadas = r.confirmados + r.vacancia;
    const taxaOferta = r.inscricoes > 0 ? ofertadas / r.inscricoes : 0;
    const taxaAbsorcao = r.inscricoes > 0 ? r.confirmados / r.inscricoes : 0;
    const taxaVacancia = ofertadas > 0 ? r.vacancia / ofertadas : 0;
    return {
      unidadeId: r.unidade_id,
      bairro: r.bairro,
      grupamento: r.grupamento,
      turno: r.turno,
      anosCobertos: r.anos,
      inscricoesMedia: r.inscricoes / r.anos,
      confirmadosMedia: r.confirmados / r.anos,
      vacanciaMedia: r.vacancia / r.anos,
      taxaOferta,
      taxaAbsorcao,
      taxaVacancia,
      concorrencia: r.confirmados > 0 ? r.inscricoes / r.confirmados : null,
      indice: taxaOferta,
    };
  });
}

/**
 * Percentil dentro de um grupo comparável + tercil (baixa/media/alta). Comparar é sempre
 * dentro do mesmo grupamento×turno — berçário integral concorre com berçário integral,
 * nunca com maternal parcial.
 */
function ranquear(itens: Consolidado[]): Map<Consolidado, { percentil: number; classe: 'baixa' | 'media' | 'alta' }> {
  const ordenados = [...itens].sort((a, b) => a.indice - b.indice);
  const resultado = new Map<Consolidado, { percentil: number; classe: 'baixa' | 'media' | 'alta' }>();

  ordenados.forEach((item, i) => {
    // percentil = fração de unidades do grupo com índice estritamente menor
    const percentil = ordenados.length > 1 ? i / (ordenados.length - 1) : 0.5;
    const classe = percentil < 1 / 3 ? 'baixa' : percentil < 2 / 3 ? 'media' : 'alta';
    resultado.set(item, { percentil, classe });
  });

  return resultado;
}

function gravarDisponibilidade(consolidados: Consolidado[]): void {
  db.exec('DELETE FROM unidade_disponibilidade');

  // Ranking na cidade: por grupamento × turno
  const porCidade = new Map<string, Consolidado[]>();
  // Ranking regional: por bairro × grupamento × turno
  const porRegiao = new Map<string, Consolidado[]>();

  for (const c of consolidados) {
    const chaveCidade = `${c.grupamento}|${c.turno}`;
    const chaveRegiao = `${c.bairro}|${chaveCidade}`;
    (porCidade.get(chaveCidade) ?? porCidade.set(chaveCidade, []).get(chaveCidade)!).push(c);
    (porRegiao.get(chaveRegiao) ?? porRegiao.set(chaveRegiao, []).get(chaveRegiao)!).push(c);
  }

  const rankCidade = new Map<Consolidado, { percentil: number; classe: string }>();
  for (const grupo of porCidade.values()) {
    for (const [item, r] of ranquear(grupo)) rankCidade.set(item, r);
  }

  const rankRegiao = new Map<Consolidado, { percentil: number; classe: string; referencia: string }>();
  for (const [chave, grupo] of porRegiao) {
    const bairro = chave.split('|')[0]!;
    if (grupo.length < MIN_UNIDADES_POR_REGIAO || bairro === 'Não informado') {
      // Amostra pequena demais pra tercil fazer sentido — usa o ranking da cidade.
      for (const item of grupo) {
        const r = rankCidade.get(item)!;
        rankRegiao.set(item, { ...r, referencia: 'cidade' });
      }
      continue;
    }
    for (const [item, r] of ranquear(grupo)) {
      rankRegiao.set(item, { ...r, referencia: `bairro:${bairro}` });
    }
  }

  const inserir = db.query(
    `INSERT INTO unidade_disponibilidade
       (unidade_id, grupamento, turno, anos_cobertos, inscricoes_media, confirmados_media,
        vacancia_media, taxa_oferta, taxa_absorcao, taxa_vacancia, concorrencia, indice_disponibilidade,
        regiao_referencia, percentil_regiao, classe_regiao, percentil_cidade, classe_cidade)
     VALUES ($unidadeId, $grupamento, $turno, $anos, $inscricoesMedia, $confirmadosMedia,
             $vacanciaMedia, $taxaOferta, $taxaAbsorcao, $taxaVacancia, $concorrencia, $indice,
             $regiaoReferencia, $percentilRegiao, $classeRegiao, $percentilCidade, $classeCidade)`
  );

  const arredondar = (n: number, casas = 4) => Math.round(n * 10 ** casas) / 10 ** casas;

  const transacao = db.transaction(() => {
    for (const c of consolidados) {
      const regiao = rankRegiao.get(c)!;
      const cidade = rankCidade.get(c)!;
      inserir.run({
        $unidadeId: c.unidadeId,
        $grupamento: c.grupamento,
        $turno: c.turno,
        $anos: c.anosCobertos,
        $inscricoesMedia: arredondar(c.inscricoesMedia, 1),
        $confirmadosMedia: arredondar(c.confirmadosMedia, 1),
        $vacanciaMedia: arredondar(c.vacanciaMedia, 1),
        $taxaOferta: arredondar(c.taxaOferta),
        $taxaAbsorcao: arredondar(c.taxaAbsorcao),
        $taxaVacancia: arredondar(c.taxaVacancia),
        $concorrencia: c.concorrencia == null ? null : arredondar(c.concorrencia, 2),
        $indice: arredondar(c.indice),
        $regiaoReferencia: regiao.referencia,
        $percentilRegiao: arredondar(regiao.percentil, 3),
        $classeRegiao: regiao.classe,
        $percentilCidade: arredondar(cidade.percentil, 3),
        $classeCidade: cidade.classe,
      });
    }
  });
  transacao();

  console.log(`[seed-historico] unidade_disponibilidade: ${consolidados.length} combinações unidade×grupamento×turno`);
}

async function main() {
  console.log(`[seed-historico] lendo ${QUERY_A_PATH}`);
  const agregado = await agregarQueryA();
  const unidades = carregarUnidadesPorCodigo();
  gravarHistorico(agregado, unidades);
  gravarDisponibilidade(consolidar());
  console.log('[seed-historico] concluído');
}

await main();
