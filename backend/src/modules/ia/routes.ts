import { Elysia, t } from 'elysia';
import { unidadesProximas } from '../unidades/service';
import { getResponsavelById } from '../responsaveis/service';
import { getCriancaById } from '../criancas/service';
import { recomendarComAgente } from './agent';
import { explicacaoFallback, resumoFallback } from './fallback';

const GrupamentoSchema = t.Union([t.Literal('Bercario'), t.Literal('Maternal I'), t.Literal('Maternal II')]);
const TurnoSchema = t.Union([t.Literal('Integral'), t.Literal('Parcial')]);

export const iaRoutes = new Elysia({ prefix: '/ia' }).post(
  '/recomendar-unidades',
  async ({ body }) => {
    const responsavel = getResponsavelById(body.responsavelId);
    const crianca = getCriancaById(body.criancaId);
    const anoProcesso = body.anoProcesso ?? new Date().getFullYear();

    const agenteResultado = await recomendarComAgente({
      responsavel,
      crianca,
      grupamento: body.grupamento,
      turno: body.turno,
      anoProcesso,
      inscricaoId: body.inscricaoId,
    });

    if (agenteResultado) {
      return { ...agenteResultado, fonte: 'ia' as const };
    }

    const candidatas = unidadesProximas({
      lat: responsavel.latitude ?? undefined,
      lng: responsavel.longitude ?? undefined,
      bairro: responsavel.bairro,
      grupamento: body.grupamento,
      turno: body.turno,
      anoProcesso,
      limite: 5,
    });

    return {
      resumo: resumoFallback(candidatas),
      recomendacoes: candidatas.map((c) => ({ unidadeId: c.unidadeId, porque: explicacaoFallback(c) })),
      fonte: 'fallback' as const,
    };
  },
  {
    body: t.Object({
      responsavelId: t.String(),
      criancaId: t.String(),
      grupamento: t.Optional(GrupamentoSchema),
      turno: t.Optional(TurnoSchema),
      anoProcesso: t.Optional(t.Number()),
      inscricaoId: t.Optional(t.String()),
    }),
  }
);
