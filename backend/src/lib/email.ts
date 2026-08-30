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
    })
  : null;

/**
 * Envia o código de verificação por e-mail. Se o SMTP não estiver configurado
 * (sem SMTP_HOST/SMTP_USER/SMTP_PASS no .env), cai em modo "dev": loga o
 * código no console em vez de falhar — permite testar o fluxo de login sem
 * depender de credenciais de e-mail configuradas.
 */
export async function enviarCodigoVerificacao(destinatario: string, codigo: string): Promise<{ modo: 'email' | 'console' }> {
  if (!transporter) {
    console.log(`[email:dev] código de verificação para ${destinatario}: ${codigo}`);
    return { modo: 'console' };
  }

  await transporter.sendMail({
    from: `"GestaoEducRio" <${SMTP_USER}>`,
    to: destinatario,
    subject: 'Seu código de acesso — Inscrição Creche',
    text: `Seu código de verificação é: ${codigo}\n\nVálido por 10 minutos.`,
    html: `<p>Seu código de verificação é: <strong style="font-size:1.5em">${codigo}</strong></p><p>Válido por 10 minutos.</p>`,
  });

  return { modo: 'email' };
}
