/**
 * Geocodificação de endereço via Nominatim (OpenStreetMap) — gratuito, sem API key.
 * Usado no cadastro/atualização do responsável para preencher latitude/longitude
 * a partir de logradouro/numero/bairro/cep. Nunca lança: em qualquer falha
 * (timeout, endereço não encontrado, rate limit) retorna null e o cadastro
 * segue sem coordenada — o app já tem fallback por bairro pra esse caso
 * (ver inscricoes/service.ts e ia/tools.ts).
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_MS = 4000;

export interface EnderecoParaGeocodificar {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
}

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

function montarQuery(endereco: EnderecoParaGeocodificar): string {
  // Sem bairro nem logradouro não há sinal de endereço nenhum — geocodificar
  // só "Rio de Janeiro, RJ, Brazil" devolveria o centro genérico da cidade,
  // o que é pior que não ter coordenada (falso senso de precisão).
  if (!endereco.bairro?.trim() && !endereco.logradouro?.trim()) return '';

  const partes = [
    [endereco.logradouro, endereco.numero].filter(Boolean).join(', '),
    endereco.bairro,
    'Rio de Janeiro',
    'RJ',
    'Brazil',
  ].filter((parte): parte is string => Boolean(parte && parte.trim()));

  return partes.join(', ');
}

export async function geocodeEndereco(endereco: EnderecoParaGeocodificar): Promise<Coordenadas | null> {
  const query = montarQuery(endereco);
  if (!query) return null;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'br');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim exige um User-Agent identificável (política de uso da instância pública)
        'User-Agent': 'GestaoEducRio/1.0 (hackathon Claude Impact Lab Rio)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

    return { latitude, longitude };
  } catch (err) {
    console.warn('[geocode] falhou:', (err as Error).message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
