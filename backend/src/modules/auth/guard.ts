import { Elysia } from 'elysia';
import { validarSessao } from './service';
import { ApiError, badRequest } from '../../lib/errors';

function extractToken(headers: Record<string, string | undefined>): string | undefined {
  const auth = headers.authorization;
  if (!auth) return undefined;
  return auth.startsWith('Bearer ') ? auth.slice(7) : auth;
}

/** Exige uma sessão válida (qualquer tipo) e disponibiliza `sessao` no contexto. */
export const requireAuth = new Elysia().derive({ as: 'scoped' }, ({ headers }) => {
  const sessao = validarSessao(extractToken(headers));
  return { sessao };
});

/** Exige especificamente sessão de admin. */
export const requireAdmin = new Elysia().derive({ as: 'scoped' }, ({ headers }) => {
  const sessao = validarSessao(extractToken(headers));
  if (sessao.tipo !== 'admin') {
    throw new ApiError(403, 'ACESSO_NEGADO', 'Esta ação requer login de administrador');
  }
  return { sessao };
});

/** Exige especificamente sessão de responsável (portal da mãe). */
export const requireResponsavel = new Elysia().derive({ as: 'scoped' }, ({ headers }) => {
  const sessao = validarSessao(extractToken(headers));
  if (sessao.tipo !== 'responsavel' || !sessao.responsavelId) {
    throw new ApiError(403, 'ACESSO_NEGADO', 'Esta ação requer login do portal do responsável');
  }
  return { sessao };
});
