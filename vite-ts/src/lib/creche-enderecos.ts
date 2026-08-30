import axios from 'axios';

import { getToken } from './creche-api';

// ----------------------------------------------------------------------
// Endereços múltiplos do responsável (backend/src/modules/responsaveis/enderecos.ts).
// Fica separado de creche-api.ts só por organização — mesma baseURL, mesmo esquema de
// token opaco no header Authorization, mesmo formato de erro `{ error: { code, message } }`.

const API_URL = import.meta.env.VITE_CRECHE_API_URL ?? 'http://localhost:3000/api';

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = getToken('admin') ?? getToken('responsavel');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = error?.response?.data?.error;
    const message = apiError?.message ?? error?.message ?? 'Erro ao comunicar com o servidor';
    return Promise.reject(new Error(message));
  }
);

// ----------------------------------------------------------------------

export type TipoEndereco = 'moradia' | 'trabalho' | 'alternativo';

export interface EnderecoResponsavel {
  id: string;
  responsavel_id: string;
  tipo: TipoEndereco;
  rotulo: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  /** Pode ser null: a geocodificação (Nominatim) é best-effort no cadastro. */
  latitude: number | null;
  longitude: number | null;
  criado_em: string;
}

/** Moradia (sintetizada do cadastro) sempre primeiro, depois trabalho e alternativos. */
export async function listarEnderecos(responsavelId: string) {
  const { data } = await client.get<EnderecoResponsavel[]>(`/responsaveis/${responsavelId}/enderecos`);
  return data;
}

export async function cadastrarEndereco(
  responsavelId: string,
  input: {
    tipo: 'trabalho' | 'alternativo';
    rotulo?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
  }
) {
  const { data } = await client.post<EnderecoResponsavel>(`/responsaveis/${responsavelId}/enderecos`, input);
  return data;
}

export async function removerEndereco(responsavelId: string, enderecoId: string) {
  const { data } = await client.delete<{ removido: boolean }>(
    `/responsaveis/${responsavelId}/enderecos/${enderecoId}`
  );
  return data;
}
