import { randomUUID } from 'node:crypto';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import { db } from '../../db/client';
import { haversineKm } from '../../lib/geo';
import type { Grupamento, Turno } from '../unidades/types';
import type { Responsavel } from '../responsaveis/service';
import type { Crianca } from '../criancas/service';
import {
  buscarCandidatas,
  getCandidata,
  grupamentoPorIdade,
  montarPerfil,
  type CandidataEnriquecida,
  type CriterioOrdenacao,
  type PerfilFamilia,
} from './features';

/**
 * Rótulos curtos que o portal renderiza como Chip no card da unidade. É um enum fechado
 * de propósito: badge é elemento de UI, e deixar o modelo inventar o texto produziria
 * rótulos de tamanho e tom imprevisíveis quebrando o layout. O parágrafo livre (`porque`)
 * é onde a explicação personalizada mora.
 */
export const BADGES = [
  'Mais perto de casa',
  'Mais perto do trabalho',
  'No caminho para o trabalho',
  'Alta chance de vaga',
  'Muitas vagas abertas',
  'Perto do endereço alternativo',
  'Melhor equilíbrio',
] as const;

export const RecomendacaoFinalSchema = z.object({
  resumo: z
    .string()
    .max(400)
    .describe('1-2 frases orientando a família sobre a estratégia geral das escolhas'),
  recomendacoes: z
    .array(
      z.object({
        unidadeId: z.string().describe('id da unidade — copie exatamente de uma tool, nunca invente'),
        porque: z
          .string()
          .max(400)
          .describe(
            'Um parágrafo curto (2-3 frases) em segunda pessoa explicando por que esta unidade foi escolhida PARA ESTA família, citando os números concretos que as tools retornaram (km, vagas, chance histórica)'
          ),
        badge: z
          .enum(BADGES)
          .optional()
          .describe('Rótulo curto opcional pro card; só use quando a unidade se destaca claramente nesse aspecto'),
      })
    )
    .min(1)
    .max(5),
  alertas: z
    .array(z.string().max(200))
    .max(3)
    .optional()
    .describe('Avisos objetivos pra família (ex.: idade não bate com o grupamento pedido, poucas opções perto)'),
});

export type RecomendacaoFinal = z.infer<typeof RecomendacaoFinalSchema>;

export interface FerramentasContext {
  responsavel: Responsavel;
  crianca: Crianca;
  grupamento?: Grupamento;
  turno?: Turno;
  anoProcesso: number;
  inscricaoId?: string;
}

/** Projeção enxuta de candidata: o payload completo em 10 unidades gasta contexto à toa. */
function resumirCandidata(c: CandidataEnriquecida) {
  const { distancias: d, disponibilidade: v, chance } = c;
  return {
    unidadeId: c.unidadeId,
    nome: c.nome,
    bairro: c.bairro,
    tipoGestao: c.tipoGestao,
    distanciaKm: {
      deCasa: d.moradiaKm,
      doTrabalho: d.trabalhoKm,
      doAlternativo: d.alternativoKm,
      maisProxima: d.menorKm,
      enderecoMaisProximo: d.enderecoMaisProximo,
    },
    rotaCasaTrabalho:
      d.desvioRotaCasaTrabalhoKm == null
        ? null
        : { desvioDiarioKm: d.desvioRotaCasaTrabalhoKm, afastamentoDaRotaKm: d.distanciaAteRotaKm },
    vagas: {
      disponiveisAgora: v.vagasDisponiveis,
      capacidade: v.capacidadeTotal,
      ocupacaoPct: v.ocupacaoPct,
    },
    historico: v.historico && {
      chanceHistoricaConvocacaoPct: v.historico.chanceHistoricaConvocacaoPct,
      classeDisponibilidade: v.historico.classeDisponibilidade,
      regiaoReferencia: v.historico.regiaoReferencia,
      candidatosPorVaga: v.historico.candidatosPorVaga,
      vacanciaMediaAnoPct: v.historico.taxaVacanciaPct,
      inscricoesMediaAno: v.historico.inscricoesMediaAno,
      anosCobertos: v.historico.anosCobertos,
    },
    chanceEstimada: { classe: chance.classe, score: chance.score },
  };
}

export interface HooksFerramentas {
  /** Chamado a cada retorno de tool. Usado pelo harness de avaliação pra checar grounding. */
  onToolResult?: (nome: string, resultado: string) => void;
}

/**
 * Monta as tools do agente fechadas sobre o contexto de uma chamada, e devolve um getter
 * pro resultado estruturado — capturado quando o modelo chama `finalizar_recomendacao`,
 * sempre o último passo do loop.
 */
export function criarFerramentasRecomendacao(ctx: FerramentasContext, hooks: HooksFerramentas = {}) {
  let resultadoFinal: RecomendacaoFinal | null = null;
  const perfil: PerfilFamilia = montarPerfil(ctx);

  const consultarPerfilFamilia = betaZodTool({
    name: 'consultar_perfil_familia',
    description:
      'Dados da família: todos os endereços cadastrados (moradia, trabalho, alternativo), a criança, o grupamento/turno pretendidos e os sinais de prioridade na classificação. Chame primeiro — as outras tools assumem que você já sabe quais endereços existem.',
    inputSchema: z.object({}),
    run: async () => {
      const elegivel = grupamentoPorIdade(perfil.crianca.data_nascimento, perfil.anoProcesso);
      return JSON.stringify({
        enderecos: perfil.enderecos.map((e) => ({
          tipo: e.tipo,
          rotulo: e.rotulo,
          bairro: e.bairro,
          logradouro: e.logradouro,
          geocodificado: e.latitude != null && e.longitude != null,
        })),
        distanciaCasaTrabalhoKm:
          perfil.moradia?.latitude != null && perfil.trabalho?.latitude != null
            ? haversineKm(
                perfil.moradia.latitude,
                perfil.moradia.longitude!,
                perfil.trabalho.latitude,
                perfil.trabalho.longitude!
              )
            : null,
        crianca: {
          nome: perfil.crianca.nome_completo,
          dataNascimento: perfil.crianca.data_nascimento,
          grupamentoElegivelPelaIdade: elegivel,
        },
        grupamentoPretendido: perfil.grupamento ?? null,
        turnoPretendido: perfil.turno ?? null,
        anoProcesso: perfil.anoProcesso,
        prioridade: {
          bolsaFamilia: perfil.bolsaFamilia,
          pontuacaoInscricao: perfil.pontuacaoTotal,
        },
      });
    },
  });

  const buscarCandidatasTool = betaZodTool({
    name: 'buscar_candidatas',
    description:
      'Lista unidades de creche com vaga aberta, já enriquecidas com distância a partir de CADA endereço da família, desvio de rota casa→trabalho, vagas atuais e histórico de convocação. Varie o `criterio` entre chamadas para enxergar as opções sob ângulos diferentes (perto de casa vs. perto do trabalho vs. no caminho vs. maior chance).',
    inputSchema: z.object({
      criterio: z
        .enum(['moradia', 'trabalho', 'qualquer_endereco', 'rota', 'disponibilidade', 'chance'])
        .default('qualquer_endereco')
        .describe('Como ordenar. "rota" ordena pelo menor desvio no trajeto casa→trabalho.'),
      raioKm: z.number().min(0.5).max(20).default(6).describe('Raio máximo a partir do endereço mais próximo'),
      limite: z.number().int().min(1).max(15).default(8),
    }),
    run: async ({ criterio, raioKm, limite }) => {
      const candidatas = buscarCandidatas(perfil, {
        criterio: criterio as CriterioOrdenacao,
        raioKm,
        limite,
      });
      return JSON.stringify({
        criterio,
        raioKm,
        total: candidatas.length,
        candidatas: candidatas.map(resumirCandidata),
      });
    },
  });

  const unidadesNoCaminho = betaZodTool({
    name: 'unidades_no_caminho',
    description:
      'Unidades no trajeto entre dois endereços da família (por padrão casa→trabalho), ordenadas pelo desvio diário que a família passaria a fazer. Só funciona se os dois endereços estiverem geocodificados. Use quando a família tem endereço de trabalho: uma creche 3 km distante de casa mas colada na rota custa menos no dia a dia que uma a 1,5 km no sentido contrário.',
    inputSchema: z.object({
      desvioMaximoKm: z.number().min(0.2).max(15).default(3).describe('Desvio diário máximo aceitável'),
      limite: z.number().int().min(1).max(15).default(8),
    }),
    run: async ({ desvioMaximoKm, limite }) => {
      if (!perfil.trabalho?.latitude || !perfil.moradia?.latitude) {
        return JSON.stringify({
          disponivel: false,
          motivo: 'família não tem moradia e trabalho geocodificados — use buscar_candidatas',
        });
      }

      const candidatas = buscarCandidatas(perfil, { criterio: 'rota', raioKm: 20, limite: 60 })
        .filter(
          (c) => c.distancias.desvioRotaCasaTrabalhoKm != null && c.distancias.desvioRotaCasaTrabalhoKm <= desvioMaximoKm
        )
        .slice(0, limite);

      return JSON.stringify({
        disponivel: true,
        distanciaDiretaCasaTrabalhoKm: haversineKm(
          perfil.moradia.latitude,
          perfil.moradia.longitude!,
          perfil.trabalho.latitude,
          perfil.trabalho.longitude!
        ),
        desvioMaximoKm,
        total: candidatas.length,
        candidatas: candidatas.map(resumirCandidata),
      });
    },
  });

  const detalharUnidades = betaZodTool({
    name: 'detalhar_unidades',
    description:
      'Ficha completa lado a lado de até 5 unidades pelos ids: distância de cada endereço, desvio de rota, vagas, histórico dos 5 processos e a chance estimada com os fatores que a compõem. Use antes de finalizar, para comparar os finalistas e pegar os números exatos que vão aparecer na explicação.',
    inputSchema: z.object({
      unidadeIds: z.array(z.string()).min(1).max(5),
    }),
    run: async ({ unidadeIds }) => {
      const fichas = unidadeIds.map((id) => {
        const candidata = getCandidata(perfil, id);
        if (!candidata) return { unidadeId: id, erro: 'unidade não encontrada' };
        return {
          ...resumirCandidata(candidata),
          mesmoBairroQueCasa: candidata.distancias.mesmoBairroMoradia,
          mesmoBairroQueTrabalho: candidata.distancias.mesmoBairroTrabalho,
          fatoresDaChance: candidata.chance.fatores,
        };
      });
      return JSON.stringify({ fichas });
    },
  });

  const classificarDisponibilidadeRegiao = betaZodTool({
    name: 'classificar_disponibilidade_regiao',
    description:
      'Ranking determinístico de disponibilidade das unidades de um bairro, em tercis (baixa/media/alta), calculado sobre os 5 processos históricos. Use para dizer à família se a unidade é boa OU RUIM em relação às vizinhas, não em termos absolutos — 40% de chance pode ser excelente num bairro disputado.',
    inputSchema: z.object({
      bairro: z.string().describe('Nome do bairro exatamente como aparece nas candidatas'),
      grupamento: z.enum(['Bercario', 'Maternal I', 'Maternal II']).optional(),
      turno: z.enum(['Integral', 'Parcial']).optional(),
    }),
    run: async ({ bairro, grupamento, turno }) => {
      const filtros = ['u.bairro = $bairro COLLATE NOCASE', 'u.ativa = 1'];
      const args: Record<string, unknown> = { $bairro: bairro };
      if (grupamento ?? perfil.grupamento) {
        filtros.push('d.grupamento = $grupamento');
        args.$grupamento = grupamento ?? perfil.grupamento;
      }
      if (turno ?? perfil.turno) {
        filtros.push('d.turno = $turno');
        args.$turno = turno ?? perfil.turno;
      }

      const linhas = db
        .query(
          `SELECT u.id, u.nome, d.grupamento, d.turno, d.taxa_oferta, d.classe_regiao,
                  d.percentil_regiao, d.regiao_referencia, d.concorrencia, d.inscricoes_media
           FROM unidade_disponibilidade d
           JOIN unidade u ON u.id = d.unidade_id
           WHERE ${filtros.join(' AND ')}
           ORDER BY d.taxa_oferta DESC`
        )
        .all(args) as Array<Record<string, unknown>>;

      return JSON.stringify({
        bairro,
        total: linhas.length,
        criterio:
          'taxa_oferta = (confirmados + cancelados na confirmação) / inscrições, agregada em 2021-2025; tercil dentro do bairro quando há ao menos 6 unidades, senão dentro da cidade',
        unidades: linhas.map((l) => ({
          unidadeId: l.id,
          nome: l.nome,
          grupamento: l.grupamento,
          turno: l.turno,
          chanceHistoricaConvocacaoPct: Math.round((l.taxa_oferta as number) * 1000) / 10,
          classe: l.classe_regiao,
          percentil: l.percentil_regiao,
          referencia: l.regiao_referencia,
          candidatosPorVaga: l.concorrencia,
          inscricoesMediaAno: l.inscricoes_media,
        })),
      });
    },
  });

  const consultarRegras = betaZodTool({
    name: 'consultar_regras',
    description: 'Regras de negócio e limites que a recomendação precisa respeitar antes de decidir.',
    inputSchema: z.object({}),
    run: async () =>
      JSON.stringify({
        regras: [
          'A família pode escolher no máximo 5 unidades na inscrição (R2) — recomende no máximo 5, ordenadas da melhor pra pior.',
          'Só recomende unidades que apareceram nas tools com vagasDisponiveis > 0 no grupamento/turno pedido.',
          'Diversifique: as 5 opções não devem ter todas o mesmo perfil. Misture pelo menos uma opção de alta chance histórica com as mais próximas — se a família concentrar tudo em unidades disputadas, ela pode ficar sem nenhuma vaga.',
          'Distância importa porque distância vira desistência: mais da metade das inscrições históricas terminam em cancelamento, e a vaga ofertada longe de todos os endereços da família é a que mais vaga na confirmação.',
          'Considere TODOS os endereços cadastrados, não só a moradia — creche perto do trabalho ou no caminho resolve a rotina de quem leva e busca.',
          'Nunca invente unidade, distância, vaga, percentual ou nome: todo número na explicação tem que ter vindo literalmente de uma tool nesta conversa.',
          'Se houver menos de 5 candidatas viáveis, recomende menos e explique o motivo no resumo.',
          'Se a família não tiver NENHUM endereço com bairro ou coordenada, as candidatas vêm ordenadas só por chance de vaga, sem critério territorial nenhum: nesse caso é obrigatório incluir em `alertas` que a lista não considerou distância e que completar o endereço no cadastro melhora muito a recomendação.',
        ],
      }),
  });

  const finalizarRecomendacao = betaZodTool({
    name: 'finalizar_recomendacao',
    description:
      'Chame por último, com a lista final (até 5) já validada contra as regras. Persiste a recomendação no banco e encerra o processo.',
    inputSchema: RecomendacaoFinalSchema,
    run: async (input) => {
      resultadoFinal = input;
      salvarRecomendacaoNoBanco(ctx, input);
      return 'Recomendação registrada com sucesso.';
    },
  });

  const tools = [
    consultarPerfilFamilia,
    buscarCandidatasTool,
    unidadesNoCaminho,
    detalharUnidades,
    classificarDisponibilidadeRegiao,
    consultarRegras,
    finalizarRecomendacao,
  ];

  if (hooks.onToolResult) {
    for (const tool of tools) {
      const original = tool.run.bind(tool) as (...args: unknown[]) => Promise<unknown>;
      tool.run = (async (...args: unknown[]) => {
        const resultado = await original(...args);
        hooks.onToolResult!(tool.name, typeof resultado === 'string' ? resultado : JSON.stringify(resultado));
        return resultado;
      }) as typeof tool.run;
    }
  }

  return {
    tools,
    getResultadoFinal: () => resultadoFinal,
    perfil,
  };
}

function salvarRecomendacaoNoBanco(ctx: FerramentasContext, resultado: RecomendacaoFinal): void {
  const recomendacaoId = randomUUID();
  db.query(
    `INSERT INTO ia_recomendacao (id, responsavel_id, crianca_id, inscricao_id, resumo)
     VALUES ($id, $responsavelId, $criancaId, $inscricaoId, $resumo)`
  ).run({
    $id: recomendacaoId,
    $responsavelId: ctx.responsavel.id,
    $criancaId: ctx.crianca.id,
    $inscricaoId: ctx.inscricaoId ?? null,
    $resumo: resultado.resumo,
  });

  const insertItem = db.query(
    `INSERT INTO ia_recomendacao_item (id, recomendacao_id, unidade_id, ordem, porque, badge)
     VALUES ($id, $recomendacaoId, $unidadeId, $ordem, $porque, $badge)`
  );
  resultado.recomendacoes.forEach((item, index) => {
    insertItem.run({
      $id: randomUUID(),
      $recomendacaoId: recomendacaoId,
      $unidadeId: item.unidadeId,
      $ordem: index + 1,
      $porque: item.porque,
      $badge: item.badge ?? null,
    });
  });
}
