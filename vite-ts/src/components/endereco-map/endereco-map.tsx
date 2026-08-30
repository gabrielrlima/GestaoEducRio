import L from 'leaflet';
import { useMemo } from 'react';
import { Popup, Marker, useMap, TileLayer, MapContainer } from 'react-leaflet';

import Box from '@mui/material/Box';

import iconSets from 'src/components/iconify/icon-sets';

// ----------------------------------------------------------------------
// Mapa minimalista (Leaflet + tiles OpenStreetMap, sem API key) pra mostrar
// a unidade de creche e os endereços cadastrados do responsável no mesmo mapa.
// Hoje só existe o endereço de "moradia" no schema (ver backend/src/db/schema.sql
// — responsavel.latitude/longitude); `tipo` já é uma union pronta pra
// trabalho/alternativo quando esses campos existirem, sem precisar tocar aqui
// (sem ícone próprio ainda, cai no pino liso — não quebra nada).

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
  trabalho: '#FFAB00',
  alternativo: '#8E33FF',
};

// SVG dos ícones registrados em src/components/iconify/icon-sets.ts (biblioteca
// Iconify do Minimal UI Kit) — bebê pra creche, casa pra moradia.
const ICONES_SVG: Partial<Record<TipoMarcador, string>> = {
  unidade: iconSets['mingcute:baby-fill'].body,
  moradia: iconSets['solar:home-2-bold'].body,
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

function AjustarBounds({ marcadores }: { marcadores: EnderecoMapMarcador[] }) {
  const map = useMap();

  useMemo(() => {
    if (marcadores.length === 0) return;
    if (marcadores.length === 1) {
      map.setView([marcadores[0].latitude, marcadores[0].longitude], 15);
      return;
    }
    const bounds = L.latLngBounds(marcadores.map((m) => [m.latitude, m.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, marcadores.map((m) => `${m.id}:${m.latitude}:${m.longitude}`).join('|')]);

  return null;
}

export function EnderecoMap({ marcadores, height = 220 }: { marcadores: EnderecoMapMarcador[]; height?: number }) {
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
        <AjustarBounds marcadores={marcadores} />
        {marcadores.map((m) => (
          <Marker key={m.id} position={[m.latitude, m.longitude]} icon={criarIcone(m.tipo)}>
            <Popup>{m.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
}
