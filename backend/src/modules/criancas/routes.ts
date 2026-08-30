import { Elysia, t } from 'elysia';
import { createCrianca, listCriancasDoResponsavel } from './service';
import { getStatusConsolidadoCrianca } from '../inscricoes/service';

export const criancasRoutes = new Elysia()
  .post(
    '/responsaveis/:id/criancas',
    ({ params, body }) => createCrianca(params.id, body),
    {
      body: t.Object({
        nomeCompleto: t.String(),
        dataNascimento: t.String(),
        sexo: t.Optional(t.Union([t.Literal('M'), t.Literal('F')])),
        cpfCrianca: t.Optional(t.String()),
      }),
    }
  )
  .get('/responsaveis/:id/criancas', ({ params }) => listCriancasDoResponsavel(params.id))
  .get('/criancas/:id/status', ({ params }) => getStatusConsolidadoCrianca(params.id));
