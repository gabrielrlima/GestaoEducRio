import { Elysia, t } from 'elysia';
import { getResponsavelByCpf, getResponsavelById, updateResponsavel, upsertResponsavel } from './service';
import { listCriancasDoResponsavel } from '../criancas/service';

export const responsaveisRoutes = new Elysia({ prefix: '/responsaveis' })
  .post(
    '/',
    ({ body }) => upsertResponsavel(body),
    {
      body: t.Object({
        cpf: t.String(),
        nome: t.String(),
        dataNascimento: t.String(),
        email: t.String(),
        telefone: t.Optional(t.String()),
        cep: t.Optional(t.String()),
        bairro: t.Optional(t.String()),
        logradouro: t.Optional(t.String()),
        numero: t.Optional(t.String()),
        complemento: t.Optional(t.String()),
        nis: t.Optional(t.String()),
      }),
    }
  )
  .get('/:id', ({ params }) => {
    const responsavel = params.id.includes('-') ? getResponsavelById(params.id) : getResponsavelByCpf(params.id);
    return { ...responsavel, criancas: listCriancasDoResponsavel(responsavel.id) };
  })
  .patch(
    '/:id',
    ({ params, body }) => updateResponsavel(params.id, body),
    {
      body: t.Object({
        nome: t.Optional(t.String()),
        dataNascimento: t.Optional(t.String()),
        email: t.Optional(t.String()),
        telefone: t.Optional(t.String()),
        cep: t.Optional(t.String()),
        bairro: t.Optional(t.String()),
        logradouro: t.Optional(t.String()),
        numero: t.Optional(t.String()),
        complemento: t.Optional(t.String()),
        nis: t.Optional(t.String()),
      }),
    }
  );
