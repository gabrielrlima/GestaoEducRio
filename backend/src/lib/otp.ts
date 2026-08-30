export function gerarCodigoOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const OTP_VALIDADE_MINUTOS = 10;
export const SESSAO_VALIDADE_HORAS = 12;

export function dataFutura(minutos: number): string {
  return new Date(Date.now() + minutos * 60_000).toISOString();
}
