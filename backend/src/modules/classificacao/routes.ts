import { Elysia, t } from 'elysia';
import { confirmarOpcao, desistirOpcao, filaDoProcesso, inconsistencias, opcoesPendentes, selecionarOpcao } from './service';

export const classificacaoRoutes = new Elysia()
  .post('/opcoes/:id/selecionar', ({ params }) => selecionarOpcao(params.id))
  .post('/opcoes/:id/confirmar', ({ params }) => confirmarOpcao(params.id))
  .post('/opcoes/:id/desistir', ({ params }) => desistirOpcao(params.id))
  .get(
    '/processos/:ano/fila',
    ({ params, query }) =>
      filaDoProcesso({
        anoProcesso: Number(params.ano),
        unidadeId: query.unidadeId,
        grupamento: query.grupamento,
        turno: query.turno,
      }),
    { query: t.Object({ unidadeId: t.Optional(t.String()), grupamento: t.Optional(t.String()), turno: t.Optional(t.String()) }) }
  )
  .get(
    '/painel/opcoes-pendentes',
    ({ query }) => opcoesPendentes(query.diasParado ? Number(query.diasParado) : 3),
    { query: t.Object({ diasParado: t.Optional(t.String()) }) }
  )
  .get('/painel/inconsistencias', () => inconsistencias());
