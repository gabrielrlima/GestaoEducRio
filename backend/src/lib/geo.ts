const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distância em km entre duas coordenadas (fórmula de haversine). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Normaliza um código de unidade removendo zeros à esquerda, para comparar
 * o `esc_codigo` do dataset core com o `DESIGNAÇÃO`/`CÓDIGO SGA` das planilhas
 * complementares (ver docs/desafio/planilhas-dicionario.md — mesmo código,
 * formatação de zero à esquerda inconsistente entre fontes).
 */
export function normalizeUnitCode(code: string | number): string {
  const str = String(code).trim();
  const stripped = str.replace(/^0+/, '');
  return stripped.length > 0 ? stripped : '0';
}
