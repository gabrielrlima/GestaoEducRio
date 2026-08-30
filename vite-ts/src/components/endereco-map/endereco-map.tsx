import type { LatLngTuple } from 'leaflet';

import L from 'leaflet';
import { useMemo, useState, useEffect } from 'react';
import { Popup, Marker, useMap, Polyline, TileLayer, MapContainer } from 'react-leaflet';

import Box from '@mui/material/Box';

import iconSets from 'src/components/iconify/icon-sets';

// ----------------------------------------------------------------------
// Mapa minimalista (Leaflet + tiles OpenStreetMap, sem API key) pra mostrar a unidade de
// creche junto com TODOS os endereços cadastrados do responsável — moradia, trabalho e
// alternativo (colunas `latitude`, `trabalho_latitude` e `alternativo_latitude` da tabela
// `responsavel`, ver backend/src/db/schema.sql). Cada tipo tem cor e ícone próprios.
//
// Quando existem moradia e trabalho, o mapa também traça o trajeto entre os dois e
// enquadra a rota inteira, pra família enxergar ONDE a creche cai nesse desenho — que é
// a pergunta que o produto responde (creche no caminho custa quase nada de desvio).

export type TipoMarcador = 'unidade' | 'moradia' | 'trabalho' | 'alternativo';

export interface EnderecoMapMarcador {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  tipo: TipoMarcador;
}

const CORES: Record<TipoMarcador, string> = {
  unidade: '#00A76F',
  moradia: '#1877F2',
  // warning.dark em vez do .main: o ícone é branco, e branco sobre #FFAB00 fica ilegível.
  trabalho: '#B76E00',
  alternativo: '#8E33FF',
};

/** Cinza neutro pro traçado, pra linha não competir com os pinos. */
const COR_ROTA = '#637381';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_TIMEOUT_MS = 4000;

// SVG dos ícones registrados em src/components/iconify/icon-sets.ts (biblioteca Iconify do
// Minimal UI Kit) — bebê pra creche, casa cheia pra moradia, maleta pro trabalho e uma
// casa de silhueta diferente pros endereços alternativos (casa da avó, do outro
// responsável...). O `solar:home-angle-*` só existe em duotone no icon-set: a variante
// pinta o corpo da casa com opacity 0.4, o que sumiria em cima do círculo colorido — daí
// removermos o atributo pra ele renderizar sólido como os outros.
const ICONES_SVG: Partial<Record<TipoMarcador, string>> = {
  unidade: iconSets['mingcute:baby-fill'].body,
  moradia: iconSets['solar:home-2-bold'].body,
  trabalho: iconSets['solar:case-minimalistic-bold'].body,
  alternativo: iconSets['solar:home-angle-bold-duotone'].body.replace(/opacity="0\.4"/g, ''),
};

function criarIcone(tipo: TipoMarcador) {
  const cor = CORES[tipo];
  const iconeBody = ICONES_SVG[tipo];
  const icone = iconeBody
    ? `<svg viewBox="0 0 24 24" width="15" height="15" style="display:block;color:#fff">${iconeBody}</svg>`
    : '';

  return L.divIcon({
    className: 'endereco-map-marker',
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:26px;height:26px;border-radius:50%;
      background:${cor};border:2px solid #fff;
      box-shadow:0 0 0 1px rgba(0,0,0,0.24), 0 2px 4px rgba(0,0,0,0.24);
    ">${icone}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

interface Rota {
  pontos: LatLngTuple[];
  /** `false` = a rota de ruas não veio e estamos mostrando a reta entre os dois pontos. */
  real: boolean;
}

/**
 * Trajeto casa→trabalho pelo OSRM público (sem API key). Começa sempre pela reta entre os
 * dois pontos e só a substitui se a rota de ruas chegar — assim o mapa nunca fica sem
 * traçado, nem enquanto carrega, nem se o serviço estiver fora do ar ou lento.
 */
function useRotaCasaTrabalho(origem: LatLngTuple | null, destino: LatLngTuple | null): Rota | null {
  const [rota, setRota] = useState<Rota | null>(null);

  // Chave escalar: o array de tupla muda de identidade a cada render e reexecutaria o efeito.
  const chave = origem && destino ? `${origem[0]},${origem[1]}|${destino[0]},${destino[1]}` : null;

  useEffect(() => {
    if (!origem || !destino) {
      setRota(null);
      return undefined;
    }

    setRota({ pontos: [origem, destino], real: false });

    let cancelado = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

    fetch(
      `${OSRM_URL}/${origem[1]},${origem[0]};${destino[1]},${destino[0]}?overview=full&geometries=geojson`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('OSRM indisponível'))))
      .then((json) => {
        const coords: unknown = json?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) throw new Error('rota vazia');
        if (cancelado) return;
        // GeoJSON vem em [lng, lat]; o Leaflet quer [lat, lng].
        setRota({ pontos: coords.map(([lng, lat]: number[]) => [lat, lng] as LatLngTuple), real: true });
      })
      .catch(() => {
        // Falha, timeout ou desmonte: a reta já desenhada continua valendo.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelado = true;
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return rota;
}

/**
 * Enquadra marcadores + traçado. Incluir os pontos da rota importa: sem eles o mapa
 * fecharia só nos pinos e cortaria a curva do trajeto, que é justamente o que dá a
 * leitura de "a creche fica no caminho".
 */
function AjustarBounds({
  marcadores,
  pontosRota,
}: {
  marcadores: EnderecoMapMarcador[];
  pontosRota: LatLngTuple[];
}) {
  const map = useMap();

  const assinatura = `${marcadores.map((m) => `${m.id}:${m.latitude}:${m.longitude}`).join('|')}#${pontosRota.length}`;

  useMemo(() => {
    const pontos: LatLngTuple[] = [
      ...marcadores.map((m) => [m.latitude, m.longitude] as LatLngTuple),
      ...pontosRota,
    ];

    if (pontos.length === 0) return;
    if (pontos.length === 1) {
      map.setView(pontos[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pontos), { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, assinatura]);

  return null;
}

export function EnderecoMap({ marcadores, height = 220 }: { marcadores: EnderecoMapMarcador[]; height?: number }) {
  const moradia = marcadores.find((m) => m.tipo === 'moradia');
  const trabalho = marcadores.find((m) => m.tipo === 'trabalho');

  const rota = useRotaCasaTrabalho(
    moradia ? [moradia.latitude, moradia.longitude] : null,
    trabalho ? [trabalho.latitude, trabalho.longitude] : null
  );

  if (marcadores.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1.5,
          bgcolor: 'background.neutral',
          color: 'text.disabled',
          typography: 'caption',
        }}
      >
        Sem coordenadas cadastradas pra mostrar no mapa.
      </Box>
    );
  }

  const centro: [number, number] = [marcadores[0].latitude, marcadores[0].longitude];

  return (
    <Box
      sx={{
        height,
        borderRadius: 1.5,
        overflow: 'hidden',
        border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        '& .leaflet-container': { height: '100%', width: '100%', fontFamily: 'inherit' },
        '& .leaflet-tile-pane': { filter: 'grayscale(0.15) contrast(1.02)' },
        '& .leaflet-control-attribution': { fontSize: 9 },
      }}
    >
      <MapContainer center={centro} zoom={14} scrollWheelZoom={false} attributionControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <AjustarBounds marcadores={marcadores} pontosRota={rota?.pontos ?? []} />

        {/* Tracejado quando é só a reta ligando os pontos — o traço não deve dar a
            entender que aquele é o caminho real das ruas. */}
        {rota && (
          <Polyline
            positions={rota.pontos}
            pathOptions={{
              color: COR_ROTA,
              weight: rota.real ? 4 : 3,
              opacity: 0.7,
              dashArray: rota.real ? undefined : '6 8',
            }}
          >
            <Popup>{rota.real ? 'Trajeto casa → trabalho' : 'Casa → trabalho (linha direta)'}</Popup>
          </Polyline>
        )}

        {marcadores.map((m) => (
          <Marker key={m.id} position={[m.latitude, m.longitude]} icon={criarIcone(m.tipo)}>
            <Popup>{m.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
}
