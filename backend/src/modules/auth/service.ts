import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { badRequest, notFound } from '../../lib/errors';
import { normalizeCpf } from '../../lib/cpf';
import { enviarCodigoVerificacao } from '../../lib/email';
import { dataFutura, gerarCodigoOtp, OTP_VALIDADE_MINUTOS, SESSAO_VALIDADE_HORAS } from '../../lib/otp';

const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

export function loginAdmin(usuario: string, senha: string): { token: string; expiraEm: string } {
  if (usuario !== ADMIN_USER || senha !== ADMIN_PASSWORD) {
    throw badRequest('CREDENCIAIS_INVALIDAS', 'Usuário ou senha inválidos');
  }

  const token = randomUUID();
  const expiraEm = dataFutura(SESSAO_VALIDADE_HORAS * 60);
  db.query(`INSERT INTO sessao (token, tipo, responsavel_id, expira_em) VALUES ($token, 'admin', NULL, $expiraEm)`).run({
    $token: token,
    $expiraEm: expiraEm,
  });

  return { token, expiraEm };
}

/**
 * Passo 1 do login da mãe: valida CPF + data de nascimento contra o cadastro
 * e envia um código de 6 dígitos para o e-mail cadastrado (2FA).
 */
export async function solicitarCodigoLogin(cpf: string, dataNascimento: string): Promise<{ enviado: boolean; modo: 'email' | 'console' }> {
  const cpfNormalizado = normalizeCpf(cpf);
  const responsavel = db
    .query('SELECT * FROM responsavel WHERE cpf = $cpf AND data_nascimento = $dataNascimento')
    .get({ $cpf: cpfNormalizado, $dataNascimento: dataNascimento }) as { id: string; email: string } | null;

  if (!responsavel) {
    throw notFound('RESPONSAVEL_NAO_ENCONTRADO', 'CPF ou data de nascimento não conferem com nenhum cadastro');
  }

  const codigoGerado = gerarCodigoOtp();
  const expiraEm = dataFutura(OTP_VALIDADE_MINUTOS);

  // O código gravado é o que enviarCodigoVerificacao devolve, não o gerado
  // acima — se o e-mail não sair de verdade, ela devolve o código fixo de
  // teste, e é esse que precisa bater com o que o usuário vai digitar.
  const { modo, codigo } = await enviarCodigoVerificacao(responsavel.email, codigoGerado);

  db.query(`INSERT INTO login_codigo (id, responsavel_id, codigo, expira_em) VALUES ($id, $responsavelId, $codigo, $expiraEm)`).run({
    $id: randomUUID(),
    $responsavelId: responsavel.id,
    $codigo: codigo,
    $expiraEm: expiraEm,
  });

  return { enviado: true, modo };
}

/**
 * Passo 2 do login da mãe: valida o código de 6 dígitos e abre uma sessão.
 */
export function verificarCodigoLogin(cpf: string, codigo: string): { token: string; expiraEm: string; responsavelId: string } {
  const cpfNormalizado = normalizeCpf(cpf);
  const responsavel = db.query('SELECT id FROM responsavel WHERE cpf = $cpf').get({ $cpf: cpfNormalizado }) as { id: string } | null;
  if (!responsavel) throw notFound('RESPONSAVEL_NAO_ENCONTRADO', 'CPF não encontrado');

  const registro = db
    .query(
      `SELECT * FROM login_codigo
       WHERE responsavel_id = $responsavelId AND codigo = $codigo AND usado = 0 AND expira_em > datetime('now')
       ORDER BY criado_em DESC LIMIT 1`
    )
    .get({ $responsavelId: responsavel.id, $codigo: codigo }) as { id: string } | null;

  if (!registro) throw badRequest('CODIGO_INVALIDO', 'Código inválido ou expirado');

  db.query('UPDATE login_codigo SET usado = 1 WHERE id = $id').run({ $id: registro.id });

  const token = randomUUID();
  const expiraEm = dataFutura(SESSAO_VALIDADE_HORAS * 60);
  db.query(
    `INSERT INTO sessao (token, tipo, responsavel_id, expira_em) VALUES ($token, 'responsavel', $responsavelId, $expiraEm)`
  ).run({ $token: token, $responsavelId: responsavel.id, $expiraEm: expiraEm });

  return { token, expiraEm, responsavelId: responsavel.id };
}

export interface SessaoValida {
  tipo: 'responsavel' | 'admin';
  responsavelId: string | null;
}

export function validarSessao(token: string | undefined): SessaoValida {
  if (!token) throw badRequest('SEM_TOKEN', 'Token de sessão ausente');

  const sessao = db
    .query(`SELECT * FROM sessao WHERE token = $token AND expira_em > datetime('now')`)
    .get({ $token: token }) as { tipo: 'responsavel' | 'admin'; responsavel_id: string | null } | null;

  if (!sessao) throw badRequest('SESSAO_INVALIDA', 'Sessão inválida ou expirada — faça login novamente');

  return { tipo: sessao.tipo, responsavelId: sessao.responsavel_id };
}
