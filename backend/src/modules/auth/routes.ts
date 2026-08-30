import { Elysia, t } from 'elysia';
import { loginAdmin, solicitarCodigoLogin, verificarCodigoLogin } from './service';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .post(
    '/admin/login',
    ({ body }) => loginAdmin(body.usuario, body.senha),
    { body: t.Object({ usuario: t.String(), senha: t.String() }) }
  )
  .post(
    '/responsavel/solicitar-codigo',
    ({ body }) => solicitarCodigoLogin(body.cpf, body.dataNascimento),
    { body: t.Object({ cpf: t.String(), dataNascimento: t.String() }) }
  )
  .post(
    '/responsavel/verificar-codigo',
    ({ body }) => verificarCodigoLogin(body.cpf, body.codigo),
    { body: t.Object({ cpf: t.String(), codigo: t.String() }) }
  );
