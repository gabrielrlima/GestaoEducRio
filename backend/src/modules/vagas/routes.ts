import { Elysia, t } from 'elysia';
import { getVagasDaUnidade } from '../unidades/service';
import { updateCapacidade, upsertVagaConfig } from './service';

const GrupamentoSchema = t.Union([t.Literal('Bercario'), t.Literal('Maternal I'), t.Literal('Maternal II')]);
const TurnoSchema = t.Union([t.Literal('Integral'), t.Literal('Parcial')]);

export const vagasRoutes = new Elysia()
  .post(
    '/unidades/:id/vagas',
    ({ params, body }) => upsertVagaConfig(params.id, body),
    {
      body: t.Object({
        anoProcesso: t.Number(),
        grupamento: GrupamentoSchema,
        turno: TurnoSchema,
        capacidadeTotal: t.Number(),
      }),
    }
  )
  .get(
    '/unidades/:id/vagas',
    ({ params, query }) => getVagasDaUnidade(params.id, query.anoProcesso ? Number(query.anoProcesso) : undefined),
    { query: t.Object({ anoProcesso: t.Optional(t.String()) }) }
  )
  .patch(
    '/vagas/:id',
    ({ params, body }) => updateCapacidade(params.id, body.capacidadeTotal),
    { body: t.Object({ capacidadeTotal: t.Number() }) }
  );
