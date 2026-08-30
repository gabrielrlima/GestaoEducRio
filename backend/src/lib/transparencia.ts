const API_BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados';
const apiKey = process.env.TRANSPARENCIA_API_KEY;
const TIMEOUT_MS = 3000;

export interface ConsultaBolsaFamilia {
  recebe: boolean;
  mesReferencia?: string;
}

interface SacadoPorNisResponseItem {
  mesReferencia?: string;
  valor?: string;
}

/**
 * Consulta se um NIS recebe Bolsa Família via API pública do Portal da
 * Transparência (CGU). Retorna null se a chave não estiver configurada, ou
 * se a chamada falhar/expirar — o chamador deve tratar null como "não foi
 * possível verificar agora", nunca como "não recebe".
 *
 * CadÚnico não tem API pública equivalente (só convênio direto com MDS/Caixa),
 * então não há função irmã para isso — ver docs/desafio/regras-negocio.md R4.4.
 */
export async function consultarBolsaFamiliaPorNis(nis: string): Promise<ConsultaBolsaFamilia | null> {
  if (!apiKey || !nis) return null;

  const anoMesReferencia = mesReferenciaMaisRecente();
  const url = `${API_BASE}/novo-bolsa-familia-sacado-por-nis?nis=${encodeURIComponent(nis)}&anoMesReferencia=${anoMesReferencia}&pagina=1`;

  try {
    const response = await Promise.race([
      fetch(url, { headers: { 'chave-api-dados': apiKey } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);

    if (!response.ok) {
      console.warn('[transparencia] resposta não-ok:', response.status);
      return null;
    }

    const data = (await response.json()) as SacadoPorNisResponseItem[];
    const recebe = Array.isArray(data) && data.length > 0;
    return { recebe, mesReferencia: recebe ? data[0]?.mesReferencia : undefined };
  } catch (error) {
    console.warn('[transparencia] consultarBolsaFamiliaPorNis falhou, seguindo sem verificação:', (error as Error).message);
    return null;
  }
}

/** yyyyMM do mês anterior — dados do mês corrente costumam não estar disponíveis ainda. */
function mesReferenciaMaisRecente(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${ano}${mes}`;
}
