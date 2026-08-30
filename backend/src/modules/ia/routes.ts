import { Elysia, t } from 'elysia';
import { getResponsavelById } from '../responsaveis/service';
import { calcularGrupamentoPorIdade, getCriancaById } from '../criancas/service';
import { recomendarComAgente } from './agent';
import { recomendarSemIA } from './fallback';
import { montarPerfil } from './features';

const GrupamentoSchema = t.Union([t.Literal('Bercario'), t.Literal('Maternal I'), t.Literal('Maternal II')]);
const TurnoSchema = t.Union([t.Literal('Integral'), t.Literal('Parcial')]);

export const iaRoutes = new Elysia({ prefix: '/ia' }).post(
  '/recomendar-unidades',
  async ({ body }) => {
    const responsavel = getResponsavelById(body.responsavelId);
    const crianca = getCriancaById(body.criancaId);
    const anoProcesso = body.anoProcesso ?? new Date().getFullYear();

    // Sem grupamento explícito, deriva da idade da criança pela MESMA regra que
    // `criarInscricao` usa — senão a recomendação filtraria vaga de um grupamento e a
    // inscrição gerada a partir dela cairia em outro.
    const ctx = {
      responsavel,
      crianca,
      grupamento: body.grupamento ?? calcularGrupamentoPorIdade(crianca.data_nascimento),
      turno: body.turno,
      anoProcesso,
      inscricaoId: body.inscricaoId,
    };

    const resultado = await recomendarComAgente(ctx);
    if (resultado) {
      return { ...resultado.recomendacao, fonte: 'ia' as const };
    }

    return { ...recomendarSemIA(montarPerfil(ctx)), fonte: 'fallback' as const };
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
