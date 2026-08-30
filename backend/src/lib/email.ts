import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Sem isso, uma porta SMTP bloqueada pela rede de saída do host (comum
      // em PaaS) trava a promise indefinidamente — a rota nunca responde.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    })
  : null;

// Usado quando o e-mail não sai de verdade (SMTP não configurado, ou
// bloqueado pela rede de saída — caso do Railway, que fecha as portas 465 e
// 587 de saída pra qualquer destino). Fixo em vez de aleatório porque nesse
// modo ninguém recebe o código por nenhum canal — precisa ser previsível pra
// não travar o fluxo de login de quem está testando/demonstrando.
export const CODIGO_MODO_TESTE = '123456';

/**
 * Envia o código de verificação por e-mail e devolve qual código vale de
 * fato: o gerado (se o e-mail realmente saiu) ou CODIGO_MODO_TESTE (se caiu
 * no fallback) — o chamador deve gravar esse retorno, não o código original.
 */
export async function enviarCodigoVerificacao(
  destinatario: string,
  codigo: string
): Promise<{ modo: 'email' | 'console'; codigo: string }> {
  if (!transporter) {
    return { modo: 'console', codigo: CODIGO_MODO_TESTE };
  }

  try {
    await transporter.sendMail({
      from: `"GestaoEducRio" <${SMTP_USER}>`,
      to: destinatario,
      subject: 'Seu código de acesso — Inscrição Creche',
      text: `Seu código de verificação é: ${codigo}\n\nVálido por 10 minutos.`,
      html: `<p>Seu código de verificação é: <strong style="font-size:1.5em">${codigo}</strong></p><p>Válido por 10 minutos.</p>`,
    });

    return { modo: 'email', codigo };
  } catch (error) {
    // SMTP configurado mas indisponível (porta bloqueada pela rede de saída,
    // credencial expirada etc.) — cai pro mesmo fallback em vez de deixar a
    // rota inteira falhar, mesmo comportamento de "sem crash a demo" da IA.
    console.error(`[email] falha ao enviar pra ${destinatario}, caindo pro código fixo de teste:`, error);
    return { modo: 'console', codigo: CODIGO_MODO_TESTE };
  }
}
