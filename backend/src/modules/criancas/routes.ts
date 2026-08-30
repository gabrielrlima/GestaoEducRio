import { Elysia, t } from 'elysia';
import { createCrianca, updateCrianca, listCriancasDoResponsavel } from './service';
import { getStatusConsolidadoCrianca } from '../inscricoes/service';

export const criancasRoutes = new Elysia()
  .post(
    '/responsaveis/:id/criancas',
    ({ params, body }) => createCrianca(params.id, body),
    {
      body: t.Object({
        nomeCompleto: t.String(),
        dataNascimento: t.String(),
        cpfCrianca: t.String(),
        sexo: t.Optional(t.Union([t.Literal('M'), t.Literal('F')])),
      }),
    }
  )
  .get('/responsaveis/:id/criancas', ({ params }) => listCriancasDoResponsavel(params.id))
  .patch(
    '/criancas/:id',
    ({ params, body }) => updateCrianca(params.id, body),
    {
      body: t.Object({
        nomeCompleto: t.Optional(t.String()),
        dataNascimento: t.Optional(t.String()),
        cpfCrianca: t.Optional(t.String()),
        sexo: t.Optional(t.Union([t.Literal('M'), t.Literal('F')])),
      }),
    }
  )
  .get('/criancas/:id/status', ({ params }) => getStatusConsolidadoCrianca(params.id));
