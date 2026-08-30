export type TipoGestao = 'Direta' | 'Conveniada' | 'Parceria';
export type Grupamento = 'Bercario' | 'Maternal I' | 'Maternal II';
export type Turno = 'Integral' | 'Parcial';

export interface Unidade {
  id: string;
  esc_codigo: string | null;
  nome: string;
  tipo_gestao: TipoGestao;
  tipo_origem_raw: number | null;
  cre: number | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  ativa: 0 | 1;
  criado_em: string;
}

export interface CreateUnidadeInput {
  escCodigo?: string;
  nome: string;
  tipoGestao: TipoGestao;
  cre?: number;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
}
