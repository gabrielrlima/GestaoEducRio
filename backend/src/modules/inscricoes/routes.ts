import { Elysia, t } from 'elysia';
import {
  contagemSolicitacoesPorUnidade,
  criarInscricao,
  getInscricaoById,
  listarPerguntas,
  listarRespostas,
  salvarRespostas,
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
  .get('/perguntas', ({ query }) =>
    listarPerguntas(query.anoProcesso ? Number(query.anoProcesso) : new Date().getFullYear())
  , { query: t.Object({ anoProcesso: t.Optional(t.String()) }) })
  .get('/responsaveis/:id', ({ params }) => listInscricoesDoResponsavel(params.id))
  .get('/:id/respostas', ({ params }) => listarRespostas(params.id))
  .post(
    '/:id/respostas',
    ({ params, body }) => salvarRespostas(params.id, body.respostas),
    {
      body: t.Object({
        respostas: t.Array(
          t.Object({
            perguntaId: t.String(),
            resposta: t.Union([t.Literal('Sim'), t.Literal('Nao')]),
            arquivoNome: t.Optional(t.String()),
            arquivoTipo: t.Optional(t.String()),
            arquivoBase64: t.Optional(t.String()),
          })
        ),
      }),
    }
  )
  .get('/:id', ({ params }) => getInscricaoById(params.id));
