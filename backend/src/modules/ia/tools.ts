import { randomUUID } from 'node:crypto';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import { db } from '../../db/client';
import { haversineKm } from '../../lib/geo';
import { getUnidadeById, unidadesProximas } from '../unidades/service';
import type { Grupamento, Turno } from '../unidades/types';
import type { Responsavel } from '../responsaveis/service';
import type { Crianca } from '../criancas/service';

export const RecomendacaoFinalSchema = z.object({
  resumo: z.string().max(500).describe('Resumo curto (1-2 frases) orientando a família'),
  recomendacoes: z
    .array(
      z.object({
        unidadeId: z.string().describe('id da unidade — deve vir de uma das tools, nunca inventado'),
        porque: z.string().max(280).describe('Explicação citando só números retornados pelas tools'),
      })
    )
    .min(1)
    .max(5),
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

/**
 * Monta as tools do agente de recomendação fechadas sobre o contexto de uma chamada
 * (responsável/criança), e devolve um getter pro resultado final estruturado — capturado
 * quando o modelo chama `finalizar_recomendacao`, sempre o último passo do loop.
 */
export function criarFerramentasRecomendacao(ctx: FerramentasContext) {
  let resultadoFinal: RecomendacaoFinal | null = null;

  const buscarCandidatas = betaZodTool({
    name: 'buscar_candidatas',
    description:
      'Lista unidades de creche candidatas para a criança (mesmo grupamento/turno, com vaga), já ordenadas por proximidade real (haversine) ou por bairro quando o responsável não tem geocodificação.',
    inputSchema: z.object({
      limite: z.number().int().min(1).max(20).optional().describe('Máximo de candidatas a retornar (padrão 8)'),
    }),
    run: async ({ limite }) => {
      const candidatas = unidadesProximas({
        lat: ctx.responsavel.latitude ?? undefined,
        lng: ctx.responsavel.longitude ?? undefined,
        bairro: ctx.responsavel.bairro,
        grupamento: ctx.grupamento,
        turno: ctx.turno,
        anoProcesso: ctx.anoProcesso,
        limite: limite ?? 8,
      });
      return JSON.stringify(candidatas);
    },
  });

  const calcularDistancia = betaZodTool({
    name: 'calcular_distancia',
    description: 'Calcula a distância em km (haversine) entre o endereço do responsável e uma unidade específica pelo id.',
    inputSchema: z.object({ unidadeId: z.string() }),
    run: async ({ unidadeId }) => {
      const unidade = getUnidadeById(unidadeId);
      if (ctx.responsavel.latitude == null || ctx.responsavel.longitude == null) {
        return JSON.stringify({ distanciaKm: null, motivo: 'responsável sem geocodificação' });
      }
      if (unidade.latitude == null || unidade.longitude == null) {
        return JSON.stringify({ distanciaKm: null, motivo: 'unidade sem geocodificação' });
      }
      const distanciaKm = haversineKm(
        ctx.responsavel.latitude,
        ctx.responsavel.longitude,
        unidade.latitude,
        unidade.longitude
      );
      return JSON.stringify({ distanciaKm });
    },
  });

  const consultarCadastro = betaZodTool({
    name: 'consultar_cadastro',
    description: 'Retorna os dados relevantes do cadastro da família: bairro/endereço do responsável, criança e grupamento/turno pretendidos.',
    inputSchema: z.object({}),
    run: async () => {
      return JSON.stringify({
        responsavel: {
          bairro: ctx.responsavel.bairro,
          cep: ctx.responsavel.cep,
          temGeocodificacao: ctx.responsavel.latitude != null && ctx.responsavel.longitude != null,
        },
        crianca: {
          nome: ctx.crianca.nome_completo,
          dataNascimento: ctx.crianca.data_nascimento,
        },
        grupamento: ctx.grupamento ?? null,
        turno: ctx.turno ?? null,
        anoProcesso: ctx.anoProcesso,
      });
    },
  });

  const consultarRegras = betaZodTool({
    name: 'consultar_regras',
    description: 'Retorna as regras de negócio que a recomendação precisa respeitar antes de decidir.',
    inputSchema: z.object({}),
    run: async () => {
      return JSON.stringify({
        regras: [
          'Recomende no máximo 5 unidades, ordenadas da melhor pra pior opção.',
          'Priorize proximidade real (distanciaKm) sobre apenas "mesmo bairro".',
          'Só recomende unidades com vagasDisponiveis > 0 no grupamento/turno pedido.',
          'Nunca invente unidade, distância ou vaga fora do que as tools retornaram.',
          'Se não houver candidatas suficientes com vaga, recomende menos de 5 e explique isso no resumo.',
        ],
      });
    },
  });

  const finalizarRecomendacao = betaZodTool({
    name: 'finalizar_recomendacao',
    description:
      'Chame por último, com a lista final (até 5) de unidades recomendadas já validadas contra as regras. Persiste a recomendação no banco e encerra o processo.',
    inputSchema: RecomendacaoFinalSchema,
    run: async (input) => {
      resultadoFinal = input;
      salvarRecomendacaoNoBanco(ctx, input);
      return 'Recomendação registrada com sucesso.';
    },
  });

  return {
    tools: [buscarCandidatas, calcularDistancia, consultarCadastro, consultarRegras, finalizarRecomendacao],
    getResultadoFinal: () => resultadoFinal,
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
    `INSERT INTO ia_recomendacao_item (id, recomendacao_id, unidade_id, ordem, porque)
     VALUES ($id, $recomendacaoId, $unidadeId, $ordem, $porque)`
  );
  resultado.recomendacoes.forEach((item, index) => {
    insertItem.run({
      $id: randomUUID(),
      $recomendacaoId: recomendacaoId,
      $unidadeId: item.unidadeId,
      $ordem: index + 1,
      $porque: item.porque,
    });
  });
}
