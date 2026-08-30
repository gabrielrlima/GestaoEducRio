import { Elysia, t } from 'elysia';
import {
  createUnidade,
  getUnidadeById,
  getVagasDaUnidade,
  listUnidades,
  unidadesProximas,
  updateUnidade,
} from './service';

const TipoGestaoSchema = t.Union([t.Literal('Direta'), t.Literal('Conveniada'), t.Literal('Parceria')]);
const GrupamentoSchema = t.Union([t.Literal('Bercario'), t.Literal('Maternal I'), t.Literal('Maternal II')]);
const TurnoSchema = t.Union([t.Literal('Integral'), t.Literal('Parcial')]);

export const unidadesRoutes = new Elysia({ prefix: '/unidades' })
  .get(
    '/proximas',
    ({ query }) =>
      unidadesProximas({
        lat: query.lat ? Number(query.lat) : undefined,
        lng: query.lng ? Number(query.lng) : undefined,
        bairro: query.bairro,
        grupamento: query.grupamento as any,
        turno: query.turno as any,
        anoProcesso: query.anoProcesso ? Number(query.anoProcesso) : new Date().getFullYear(),
        raioKm: query.raioKm ? Number(query.raioKm) : undefined,
        limite: query.limite ? Number(query.limite) : undefined,
      }),
    {
      query: t.Object({
        lat: t.Optional(t.String()),
        lng: t.Optional(t.String()),
        bairro: t.Optional(t.String()),
        grupamento: t.Optional(GrupamentoSchema),
        turno: t.Optional(TurnoSchema),
        anoProcesso: t.Optional(t.String()),
        raioKm: t.Optional(t.String()),
        limite: t.Optional(t.String()),
      }),
    }
  )
  .get(
    '/',
    ({ query }) =>
      listUnidades({
        bairro: query.bairro,
        cre: query.cre ? Number(query.cre) : undefined,
        tipoGestao: query.tipoGestao,
        ativa: query.ativa != null ? query.ativa === 'true' : undefined,
        anoProcesso: query.anoProcesso ? Number(query.anoProcesso) : undefined,
      }),
    {
      query: t.Object({
        bairro: t.Optional(t.String()),
        cre: t.Optional(t.String()),
        tipoGestao: t.Optional(t.String()),
        ativa: t.Optional(t.String()),
        anoProcesso: t.Optional(t.String()),
      }),
    }
  )
  .get('/:id', ({ params }) => ({
    ...getUnidadeById(params.id),
    vagas: getVagasDaUnidade(params.id),
  }))
  .post(
    '/',
    ({ body }) => createUnidade(body),
    {
      body: t.Object({
        escCodigo: t.Optional(t.String()),
        nome: t.String(),
        tipoGestao: TipoGestaoSchema,
        cre: t.Optional(t.Number()),
        logradouro: t.Optional(t.String()),
        numero: t.Optional(t.String()),
        complemento: t.Optional(t.String()),
        bairro: t.String(),
        cep: t.Optional(t.String()),
        latitude: t.Optional(t.Number()),
        longitude: t.Optional(t.Number()),
      }),
    }
  )
  .patch(
    '/:id',
    ({ params, body }) => updateUnidade(params.id, body),
    {
      body: t.Object({
        escCodigo: t.Optional(t.String()),
        nome: t.Optional(t.String()),
        tipoGestao: t.Optional(TipoGestaoSchema),
        cre: t.Optional(t.Number()),
        logradouro: t.Optional(t.String()),
        numero: t.Optional(t.String()),
        complemento: t.Optional(t.String()),
        bairro: t.Optional(t.String()),
        cep: t.Optional(t.String()),
        latitude: t.Optional(t.Number()),
        longitude: t.Optional(t.Number()),
      }),
    }
  );
