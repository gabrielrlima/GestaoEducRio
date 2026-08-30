import { Elysia, t } from 'elysia';
import { unidadesProximas } from '../unidades/service';
import { getResponsavelById } from '../responsaveis/service';
import { getCriancaById } from '../criancas/service';
import { recomendarComIa } from './anthropic-client';
import { explicacaoFallback, resumoFallback } from './fallback';

const GrupamentoSchema = t.Union([t.Literal('Bercario'), t.Literal('Maternal I'), t.Literal('Maternal II')]);
const TurnoSchema = t.Union([t.Literal('Integral'), t.Literal('Parcial')]);

export const iaRoutes = new Elysia({ prefix: '/ia' }).post(
  '/recomendar-unidades',
  async ({ body }) => {
    const responsavel = getResponsavelById(body.responsavelId);
    getCriancaById(body.criancaId); // valida que a criança existe

    const candidatas = unidadesProximas({
      lat: responsavel.latitude ?? undefined,
      lng: responsavel.longitude ?? undefined,
      bairro: responsavel.bairro,
      grupamento: body.grupamento,
      turno: body.turno,
      anoProcesso: body.anoProcesso ?? new Date().getFullYear(),
      limite: 8,
    });

    if (candidatas.length === 0) {
      return { resumo: resumoFallback([]), recomendacoes: [], fonte: 'fallback' as const };
    }

    const iaResultado = await recomendarComIa(candidatas);
    if (iaResultado) {
      return { ...iaResultado, fonte: 'ia' as const };
    }

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
    }),
  }
);
