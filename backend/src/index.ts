import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import './db/migrate';
import { ApiError } from './lib/errors';
import { authRoutes } from './modules/auth/routes';
import { unidadesRoutes } from './modules/unidades/routes';
import { vagasRoutes } from './modules/vagas/routes';
import { responsaveisRoutes } from './modules/responsaveis/routes';
import { criancasRoutes } from './modules/criancas/routes';
import { inscricoesRoutes } from './modules/inscricoes/routes';
import { classificacaoRoutes } from './modules/classificacao/routes';
import { iaRoutes } from './modules/ia/routes';

const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:8080'];
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = new Elysia()
  .use(cors({ origin: CORS_ORIGIN, credentials: true }))
  .use(swagger({ path: '/docs' }))
  .onError(({ code, error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.status;
      return error.toJSON();
    }
    // Erro de schema do próprio Elysia (body/params inválidos): é erro do cliente, não do
    // servidor — sem isso ele caía no ramo genérico abaixo e virava um 500 enganoso.
    if (code === 'VALIDATION') {
      set.status = 422;
      return { error: { code: 'CORPO_INVALIDO', message: (error as Error).message } };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: { code: 'ROTA_NAO_ENCONTRADA', message: 'Rota não encontrada' } };
    }
    set.status = 500;
    console.error('[erro-nao-tratado]', error);
    return { error: { code: 'ERRO_INTERNO', message: 'Erro interno do servidor' } };
  })
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .group('/api', (api) =>
    api
      .use(authRoutes)
      .use(unidadesRoutes)
      .use(vagasRoutes)
      .use(responsaveisRoutes)
      .use(criancasRoutes)
      .use(inscricoesRoutes)
      .use(classificacaoRoutes)
      .use(iaRoutes)
  )
  .listen(PORT);

console.log(`🦊 GestaoEducRio backend rodando em http://localhost:${app.server?.port} — docs em /docs`);
