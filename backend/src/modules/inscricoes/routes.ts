import { Elysia, t } from 'elysia';
import {
  contagemSolicitacoesPorUnidade,
  criarInscricao,
  getInscricaoById,
  listInscricoesDoResponsavel,
} from './service';

const TurnoSchema = t.Union([t.Literal('Integral'), t.Literal('Parcial')]);
const GrupamentoSchema = t.Union([t.Literal('Bercario'), t.Literal('Maternal I'), t.Literal('Maternal II')]);

export const inscricoesRoutes = new Elysia({ prefix: '/inscricoes' })
  .post(
    '/',
    ({ body }) => criarInscricao(body),
    {
      body: t.Object({
        criancaId: t.String(),
        anoProcesso: t.Number(),
        grupamentoPretendido: t.Optional(GrupamentoSchema),
        turnoPreferido: t.Optional(t.Union([TurnoSchema, t.Literal('Qualquer')])),
        opcoes: t.Array(t.Object({ unidadeId: t.String(), turno: TurnoSchema }), { minItems: 1, maxItems: 5 }),
      }),
    }
  )
  .get('/solicitacoes-por-unidade', ({ query }) =>
    contagemSolicitacoesPorUnidade(query.anoProcesso ? Number(query.anoProcesso) : new Date().getFullYear())
  , { query: t.Object({ anoProcesso: t.Optional(t.String()) }) })
  .get('/responsaveis/:id', ({ params }) => listInscricoesDoResponsavel(params.id))
  .get('/:id', ({ params }) => getInscricaoById(params.id));
