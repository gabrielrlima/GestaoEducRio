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

export interface Ponto {
  latitude: number;
  longitude: number;
}

const KM_POR_GRAU_LAT = 111.32;

/**
 * Projeta lat/lng para um plano local em km (equirretangular, ancorado em `ref`).
 * Para as distâncias envolvidas aqui — o município do Rio inteiro cabe em ~70 km —
 * o erro dessa aproximação é da ordem de centímetros, e ela permite fazer geometria
 * de segmento (projeção, ponto mais próximo) que em coordenadas esféricas exigiria
 * trigonometria bem mais cara e sem ganho prático.
 */
function projetar(p: Ponto, ref: Ponto): { x: number; y: number } {
  return {
    x: (p.longitude - ref.longitude) * KM_POR_GRAU_LAT * Math.cos(toRad(ref.latitude)),
    y: (p.latitude - ref.latitude) * KM_POR_GRAU_LAT,
  };
}

/**
 * Quanto a família andaria A MAIS por dia se, indo de `origem` a `destino` (tipicamente
 * casa → trabalho), passasse pela creche: `d(origem,ponto) + d(ponto,destino) − d(origem,destino)`.
 *
 * É o número que responde "essa creche fica no meu caminho?" melhor do que qualquer
 * distância isolada: uma creche a 3 km de casa mas colada na rota do trabalho custa quase
 * nada de desvio, enquanto uma a 1,5 km no sentido oposto custa 3 km todo dia.
 * Sempre >= 0 (desigualdade triangular).
 */
export function desvioDeRotaKm(origem: Ponto, destino: Ponto, ponto: Ponto): number {
  const ida = haversineKm(origem.latitude, origem.longitude, ponto.latitude, ponto.longitude);
  const volta = haversineKm(ponto.latitude, ponto.longitude, destino.latitude, destino.longitude);
  const direto = haversineKm(origem.latitude, origem.longitude, destino.latitude, destino.longitude);
  return Math.max(0, Math.round((ida + volta - direto) * 100) / 100);
}

/**
 * Distância perpendicular (km) do `ponto` ao segmento reto `origem`→`destino`, ou seja,
 * o quão longe da linha do trajeto a creche está. Diferente de `desvioDeRotaKm`, não
 * penaliza estar no meio do caminho — só mede o afastamento lateral. Quando a projeção
 * cai fora do segmento, a distância é medida até a extremidade mais próxima.
 */
export function distanciaAteRotaKm(origem: Ponto, destino: Ponto, ponto: Ponto): number {
  const a = projetar(origem, origem);
  const b = projetar(destino, origem);
  const p = projetar(ponto, origem);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comprimentoQuadrado = dx * dx + dy * dy;

  // Origem e destino coincidem: o "segmento" é um ponto.
  if (comprimentoQuadrado === 0) {
    return haversineKm(origem.latitude, origem.longitude, ponto.latitude, ponto.longitude);
  }

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimentoQuadrado));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const distancia = Math.hypot(p.x - projX, p.y - projY);
  return Math.round(distancia * 100) / 100;
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
