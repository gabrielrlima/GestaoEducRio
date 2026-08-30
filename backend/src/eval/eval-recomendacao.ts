/**
 * Harness de avaliação do agente de recomendação: roda a mesma bateria de personas contra
 * cada variante de system prompt (`src/modules/ia/prompts.ts`) e mede o que dá pra medir
 * de forma determinística — se finalizou, se os ids existem e têm vaga, se cada número
 * citado na explicação apareceu de fato numa resposta de tool (grounding), se explorou os
 * endereços além da moradia, se os badges são válidos e distintos, e quanto tempo levou.
 *
 * Não é um juiz de qualidade de texto: é um filtro contra as falhas que quebram o produto
 * (alucinar unidade, alucinar número, ignorar o trabalho, não terminar). A leitura do texto
 * fica por conta de quem roda — o script imprime as explicações geradas.
 *
 *   bun run src/eval/eval-recomendacao.ts                 # todas as variantes
 *   bun run src/eval/eval-recomendacao.ts procedimental   # só uma
 */

import { randomUUID } from 'node:crypto';
import { db } from '../db/client';
import { recomendarComAgente } from '../modules/ia/agent';
import { PROMPTS, type NomePrompt } from '../modules/ia/prompts';
import { buscarCandidatas, getCandidata, montarPerfil, type PerfilFamilia } from '../modules/ia/features';
import { recomendarSemIA } from '../modules/ia/fallback';
import type { RecomendacaoFinal } from '../modules/ia/tools';
import { BADGES } from '../modules/ia/tools';
import type { Responsavel } from '../modules/responsaveis/service';
import type { Crianca } from '../modules/criancas/service';
import type { Grupamento, Turno } from '../modules/unidades/types';

const ANO = Number(process.env.ANO_PROCESSO_SEED ?? new Date().getFullYear());

// ----------------------------------------------------------------------
// Personas — coordenadas reais de pontos conhecidos do Rio, escritas à mão pra
// não depender do Nominatim (que rate-limita e tornaria o eval não reprodutível).

interface Persona {
  nome: string;
  descricao: string;
  moradia: { bairro: string; logradouro: string; latitude: number | null; longitude: number | null };
  trabalho?: { bairro: string; logradouro: string; latitude: number; longitude: number };
  alternativo?: { rotulo: string; bairro: string; latitude: number; longitude: number };
  grupamento?: Grupamento;
  turno?: Turno;
  bolsaFamilia?: boolean;
}

const PERSONAS: Persona[] = [
  {
    nome: 'tijuca-centro',
    descricao: 'Mora na Tijuca, trabalha no Centro — trajeto curto e denso em creches',
    moradia: { bairro: 'TIJUCA', logradouro: 'Rua Conde de Bonfim', latitude: -22.9322, longitude: -43.2403 },
    trabalho: { bairro: 'CENTRO', logradouro: 'Av. Rio Branco', latitude: -22.9035, longitude: -43.1757 },
    grupamento: 'Bercario',
    turno: 'Integral',
  },
  {
    nome: 'bangu-barra',
    descricao: 'Mora em Bangu, trabalha na Barra — trajeto longo, rota deveria pesar muito',
    moradia: { bairro: 'BANGU', logradouro: 'Rua Silva Cardoso', latitude: -22.8776, longitude: -43.4676 },
    trabalho: { bairro: 'BARRA DA TIJUCA', logradouro: 'Av. das Américas', latitude: -23.0045, longitude: -43.3654 },
    grupamento: 'Maternal I',
    turno: 'Integral',
    bolsaFamilia: true,
  },
  {
    nome: 'campo-grande-sem-trabalho',
    descricao: 'Só endereço de moradia — as tools de rota não se aplicam',
    moradia: { bairro: 'CAMPO GRANDE', logradouro: 'Rua Coronel Agostinho', latitude: -22.9053, longitude: -43.5615 },
    grupamento: 'Maternal II',
    turno: 'Integral',
  },
  {
    nome: 'madureira-avo',
    descricao: 'Moradia + trabalho + casa da avó (endereço alternativo)',
    moradia: { bairro: 'MADUREIRA', logradouro: 'Estrada do Portela', latitude: -22.8721, longitude: -43.3396 },
    trabalho: { bairro: 'CENTRO', logradouro: 'Rua da Assembleia', latitude: -22.9042, longitude: -43.1755 },
    alternativo: { rotulo: 'Casa da avó', bairro: 'CASCADURA', latitude: -22.8869, longitude: -43.3316 },
    grupamento: 'Bercario',
    turno: 'Integral',
  },
  {
    nome: 'sem-geocodificacao',
    descricao: 'Endereço só com bairro, sem coordenada — o agente precisa degradar sem alucinar km',
    moradia: { bairro: 'IRAJÁ', logradouro: 'Rua Bernardo de Vasconcelos', latitude: null, longitude: null },
    grupamento: 'Maternal I',
    turno: 'Integral',
  },
];

/** Cria responsável + criança + endereços direto no banco (sem geocodificar). */
function semear(persona: Persona): { responsavel: Responsavel; crianca: Crianca; limpar: () => void } {
  const responsavelId = randomUUID();
  const criancaId = randomUUID();

  db.query(
    `INSERT INTO responsavel (id, cpf, nome, data_nascimento, email, bairro, logradouro, latitude, longitude, bolsa_familia_status)
     VALUES ($id, $cpf, $nome, '1992-05-10', $email, $bairro, $logradouro, $lat, $lng, $bolsa)`
  ).run({
    $id: responsavelId,
    $cpf: String(Date.now()).slice(-11),
    $nome: `Eval ${persona.nome}`,
    $email: `eval-${persona.nome}@example.com`,
    $bairro: persona.moradia.bairro,
    $logradouro: persona.moradia.logradouro,
    $lat: persona.moradia.latitude,
    $lng: persona.moradia.longitude,
    $bolsa: persona.bolsaFamilia ? 'sim' : 'nao_consultado',
  });

  const inserirEndereco = db.query(
    `INSERT INTO endereco_responsavel (id, responsavel_id, tipo, rotulo, logradouro, bairro, latitude, longitude)
     VALUES ($id, $responsavelId, $tipo, $rotulo, $logradouro, $bairro, $lat, $lng)`
  );

  if (persona.trabalho) {
    inserirEndereco.run({
      $id: randomUUID(),
      $responsavelId: responsavelId,
      $tipo: 'trabalho',
      $rotulo: 'Trabalho',
      $logradouro: persona.trabalho.logradouro,
      $bairro: persona.trabalho.bairro,
      $lat: persona.trabalho.latitude,
      $lng: persona.trabalho.longitude,
    });
  }
  if (persona.alternativo) {
    inserirEndereco.run({
      $id: randomUUID(),
      $responsavelId: responsavelId,
      $tipo: 'alternativo',
      $rotulo: persona.alternativo.rotulo,
      $logradouro: null,
      $bairro: persona.alternativo.bairro,
      $lat: persona.alternativo.latitude,
      $lng: persona.alternativo.longitude,
    });
  }

  // Idade coerente com o grupamento pedido (régua de `calcularGrupamentoPorIdade`:
  // <24 meses Berçário, <36 Maternal I, senão Maternal II), pra não disparar alerta de
  // elegibilidade à toa.
  const idadeMeses = persona.grupamento === 'Bercario' ? 12 : persona.grupamento === 'Maternal I' ? 30 : 40;
  const nascimento = new Date(ANO, 2, 31);
  nascimento.setMonth(nascimento.getMonth() - idadeMeses);

  db.query(
    `INSERT INTO crianca (id, responsavel_id, nome_completo, data_nascimento, sexo)
     VALUES ($id, $responsavelId, $nome, $nascimento, 'F')`
  ).run({
    $id: criancaId,
    $responsavelId: responsavelId,
    $nome: 'Criança de Teste',
    $nascimento: nascimento.toISOString().slice(0, 10),
  });

  return {
    responsavel: db.query('SELECT * FROM responsavel WHERE id = $id').get({ $id: responsavelId }) as Responsavel,
    crianca: db.query('SELECT * FROM crianca WHERE id = $id').get({ $id: criancaId }) as Crianca,
    limpar: () => {
      db.query(
        `DELETE FROM ia_recomendacao_item WHERE recomendacao_id IN
           (SELECT id FROM ia_recomendacao WHERE responsavel_id = $id)`
      ).run({ $id: responsavelId });
      db.query('DELETE FROM ia_recomendacao WHERE responsavel_id = $id').run({ $id: responsavelId });
      db.query('DELETE FROM crianca WHERE responsavel_id = $id').run({ $id: responsavelId });
      db.query('DELETE FROM endereco_responsavel WHERE responsavel_id = $id').run({ $id: responsavelId });
      db.query('DELETE FROM responsavel WHERE id = $id').run({ $id: responsavelId });
    },
  };
}

// ----------------------------------------------------------------------
// Métricas

/**
 * Todo número com uma casa decimal ou mais (e inteiros de até 4 dígitos) que apareça no
 * texto tem que ter aparecido em alguma resposta de tool. Ignoramos 1-5 porque são
 * ordinais e contagens triviais ("as 5 opções", "2 vagas") que aparecem legitimamente sem
 * vir de tool, e a vírgula decimal do português é normalizada pra ponto antes de comparar.
 */
function violacoesDeGrounding(texto: string, saidasDeTool: string[]): string[] {
  const corpus = saidasDeTool.join(' ');
  const numeros = texto.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const violacoes: string[] = [];

  for (const bruto of numeros) {
    const normalizado = bruto.replace(',', '.');
    const valor = Number(normalizado);
    if (!Number.isFinite(valor)) continue;
    if (Number.isInteger(valor) && valor <= 5) continue;

    const variantes = new Set([normalizado, String(valor), valor.toFixed(1), valor.toFixed(2)]);
    // Aceita também o valor arredondado pra 1 casa: a tool devolve 1.23, o texto diz "1,2".
    variantes.add((Math.round(valor * 10) / 10).toString());

    const encontrado = [...variantes].some((v) => corpus.includes(v));
    if (!encontrado) violacoes.push(bruto);
  }

  return violacoes;
}

interface Metricas {
  persona: string;
  prompt: string;
  finalizou: boolean;
  duracaoMs: number;
  chamadasDeTool: number;
  toolsDistintas: number;
  usouRotaQuandoCabia: boolean | null;
  nRecomendacoes: number;
  idsInvalidos: number;
  semVaga: number;
  badgesInvalidos: number;
  badgesDuplicados: number;
  citouTrabalho: boolean | null;
  citouHistorico: boolean;
  violacoesGrounding: string[];
  temAltaChance: boolean;
  temMaisProxima: boolean;
  amplitudeKm: number | null;
  nota: number;
}

/**
 * Mede a estratégia de portfólio que o produto pede: a lista deveria conter ao menos uma
 * unidade de chance alta (senão a família pode não ser convocada em nenhuma) E ao menos
 * uma das mais próximas (senão a vaga, se vier, não é utilizável). É a métrica que separa
 * as variantes de prompt — correção factual as três acertam, arranjo não.
 */
function avaliarPortfolio(perfil: PerfilFamilia, ids: string[]) {
  const escolhidas = ids.map((id) => getCandidata(perfil, id)).filter((c) => c != null);
  const universo = buscarCandidatas(perfil, { criterio: 'qualquer_endereco', raioKm: 8, limite: 30 });
  const idsMaisProximas = new Set(universo.slice(0, 3).map((c) => c.unidadeId));

  const distancias = escolhidas.map((c) => c.distancias.menorKm).filter((k): k is number => k != null);

  // Só cobra "incluiu uma de chance alta" quando existia alguma pra escolher: em bairros
  // onde todo o universo é de chance média/baixa, penalizar o agente mediria o cenário,
  // não a decisão — e a métrica reprovaria as três variantes igualmente, sem informar nada.
  const haviaAlta = universo.some((c) => c.chance.classe === 'alta');

  return {
    temAltaChance: !haviaAlta || escolhidas.some((c) => c.chance.classe === 'alta'),
    temMaisProxima: escolhidas.some((c) => idsMaisProximas.has(c.unidadeId)),
    amplitudeKm:
      distancias.length > 1 ? Math.round((Math.max(...distancias) - Math.min(...distancias)) * 100) / 100 : null,
  };
}

function avaliar(params: {
  persona: Persona;
  prompt: string;
  perfil: PerfilFamilia;
  recomendacao: RecomendacaoFinal | null;
  toolsChamadas: string[];
  saidasDeTool: string[];
  duracaoMs: number;
  anoProcesso: number;
}): Metricas {
  const { persona, recomendacao, toolsChamadas, saidasDeTool } = params;
  const itens = recomendacao?.recomendacoes ?? [];

  let idsInvalidos = 0;
  let semVaga = 0;
  for (const item of itens) {
    const unidade = db
      .query('SELECT id, ativa FROM unidade WHERE id = $id')
      .get({ $id: item.unidadeId }) as { ativa: number } | null;
    if (!unidade || unidade.ativa !== 1) {
      idsInvalidos += 1;
      continue;
    }
    const vagas = db
      .query(
        `SELECT COALESCE(SUM(capacidade_total - vagas_ocupadas), 0) AS livres FROM vaga_config
         WHERE unidade_id = $id AND ano_processo = $ano
           AND ($grupamento IS NULL OR grupamento = $grupamento)
           AND ($turno IS NULL OR turno = $turno)`
      )
      .get({
        $id: item.unidadeId,
        $ano: params.anoProcesso,
        $grupamento: persona.grupamento ?? null,
        $turno: persona.turno ?? null,
      }) as { livres: number };
    if (vagas.livres <= 0) semVaga += 1;
  }

  const badgesUsados = itens.map((i) => i.badge).filter((b) => b != null);
  const badgesInvalidos = badgesUsados.filter((b) => !BADGES.includes(b)).length;
  const badgesDuplicados = badgesUsados.length - new Set(badgesUsados).size;

  const textoCompleto = [recomendacao?.resumo ?? '', ...itens.map((i) => i.porque)].join(' ');
  const violacoes = violacoesDeGrounding(textoCompleto, saidasDeTool);

  const citouTrabalho = persona.trabalho ? /trabalho|caminho|trajeto/i.test(textoCompleto) : null;
  const citouHistorico = /%|hist[óo]ric|convocad|disponibilidade/i.test(textoCompleto);

  const usouRotaQuandoCabia = persona.trabalho ? toolsChamadas.includes('unidades_no_caminho') : null;
  const portfolio = avaliarPortfolio(
    params.perfil,
    itens.map((i) => i.unidadeId)
  );

  // Nota 0-100. Correção factual pesa mais que riqueza — um número inventado numa
  // recomendação de vaga pública é pior que uma explicação sem graça — mas 20 pontos vão
  // pro arranjo do portfólio, que é onde as variantes de prompt de fato se separam.
  let nota = 0;
  if (recomendacao) {
    nota += 20; // finalizou com resultado estruturado
    nota += Math.min(15, itens.length * 3); // até 5 opções
    nota += idsInvalidos === 0 ? 12 : 0;
    nota += semVaga === 0 ? 8 : 0;
    nota += violacoes.length === 0 ? 15 : Math.max(0, 15 - violacoes.length * 5);
    nota += badgesInvalidos === 0 && badgesDuplicados === 0 && badgesUsados.length > 0 ? 5 : 0;
    nota += portfolio.temAltaChance ? 10 : 0;
    nota += portfolio.temMaisProxima ? 10 : 0;
    if (usouRotaQuandoCabia !== false) nota += 3;
    if (citouHistorico) nota += 2;
  }

  return {
    persona: persona.nome,
    prompt: params.prompt,
    finalizou: recomendacao != null,
    duracaoMs: params.duracaoMs,
    chamadasDeTool: toolsChamadas.length,
    toolsDistintas: new Set(toolsChamadas).size,
    usouRotaQuandoCabia,
    nRecomendacoes: itens.length,
    idsInvalidos,
    semVaga,
    badgesInvalidos,
    badgesDuplicados,
    citouTrabalho,
    citouHistorico,
    violacoesGrounding: violacoes,
    ...portfolio,
    nota,
  };
}

// ----------------------------------------------------------------------

async function rodar() {
  const filtro = process.argv[2] as NomePrompt | undefined;
  const variantes = (filtro ? [filtro] : (Object.keys(PROMPTS) as NomePrompt[])).filter((v) => v in PROMPTS);
  const verboso = process.env.EVAL_VERBOSE === '1';

  if (variantes.length === 0) {
    console.error(`Variante desconhecida. Disponíveis: ${Object.keys(PROMPTS).join(', ')}`);
    process.exit(1);
  }

  const resultados: Metricas[] = [];

  for (const persona of PERSONAS) {
    const { responsavel, crianca, limpar } = semear(persona);
    const ctx = {
      responsavel,
      crianca,
      grupamento: persona.grupamento,
      turno: persona.turno,
      anoProcesso: ANO,
    };

    const perfil = montarPerfil(ctx);

    // Baseline determinístico: mostra o piso de qualidade que o produto entrega sem IA.
    const semIA = recomendarSemIA(perfil);
    console.log(`\n━━━ ${persona.nome} — ${persona.descricao}`);
    console.log(`  [fallback] ${semIA.recomendacoes.length} opções | ${semIA.resumo}`);

    for (const variante of variantes) {
      const saidasDeTool: string[] = [];
      const inicio = Date.now();
      const resultado = await recomendarComAgente(ctx, {
        prompt: variante,
        onToolResult: (_nome, saida) => saidasDeTool.push(saida),
      });

      const metricas = avaliar({
        persona,
        prompt: variante,
        perfil,
        recomendacao: resultado?.recomendacao ?? null,
        toolsChamadas: resultado?.toolsChamadas ?? [],
        saidasDeTool,
        duracaoMs: resultado?.duracaoMs ?? Date.now() - inicio,
        anoProcesso: ANO,
      });
      resultados.push(metricas);

      console.log(
        `  [${variante}] nota ${metricas.nota} | ${metricas.nRecomendacoes} opções | ` +
          `${metricas.chamadasDeTool} tool calls (${metricas.toolsDistintas} distintas) | ` +
          `${(metricas.duracaoMs / 1000).toFixed(1)}s | ` +
          `portfólio ${metricas.temAltaChance ? 'alta✓' : 'alta✗'} ${metricas.temMaisProxima ? 'perto✓' : 'perto✗'}` +
          (metricas.idsInvalidos ? ` | ⚠ ${metricas.idsInvalidos} id inválido` : '') +
          (metricas.semVaga ? ` | ⚠ ${metricas.semVaga} sem vaga` : '') +
          (metricas.violacoesGrounding.length ? ` | ⚠ números sem lastro: ${metricas.violacoesGrounding.join(', ')}` : '')
      );

      if (verboso && resultado) {
        console.log(`    resumo: ${resultado.recomendacao.resumo}`);
        for (const item of resultado.recomendacao.recomendacoes) {
          const nome = (db.query('SELECT nome FROM unidade WHERE id = $id').get({ $id: item.unidadeId }) as {
            nome: string;
          } | null)?.nome;
          console.log(`    • ${nome ?? item.unidadeId}${item.badge ? ` [${item.badge}]` : ''}`);
          console.log(`      ${item.porque}`);
        }
        if (resultado.recomendacao.alertas?.length) {
          console.log(`    alertas: ${resultado.recomendacao.alertas.join(' | ')}`);
        }
      }
    }

    limpar();
  }

  console.log('\n═══ Resumo por variante de prompt');
  for (const variante of variantes) {
    const doPrompt = resultados.filter((r) => r.prompt === variante);
    const media = (f: (m: Metricas) => number) => doPrompt.reduce((s, m) => s + f(m), 0) / doPrompt.length;
    const cabiaRota = doPrompt.filter((m) => m.usouRotaQuandoCabia !== null);

    console.log(
      `  ${variante.padEnd(15)} nota média ${media((m) => m.nota).toFixed(1)} | ` +
        `finalizou ${doPrompt.filter((m) => m.finalizou).length}/${doPrompt.length} | ` +
        `opções ${media((m) => m.nRecomendacoes).toFixed(1)} | ` +
        `tool calls ${media((m) => m.chamadasDeTool).toFixed(1)} | ` +
        `usou rota ${cabiaRota.filter((m) => m.usouRotaQuandoCabia).length}/${cabiaRota.length} | ` +
        `portfólio ok ${doPrompt.filter((m) => m.temAltaChance && m.temMaisProxima).length}/${doPrompt.length} | ` +
        `violações ${doPrompt.reduce((s, m) => s + m.violacoesGrounding.length, 0)} | ` +
        `${(media((m) => m.duracaoMs) / 1000).toFixed(1)}s`
    );
  }
}

await rodar();
