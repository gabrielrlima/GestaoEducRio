import type { Grupamento, Turno } from '../unidades/types';

export interface OpcaoInscricaoInput {
  unidadeId: string;
  turno: Turno;
}

export interface CreateInscricaoInput {
  criancaId: string;
  anoProcesso: number;
  grupamentoPretendido?: Grupamento;
  turnoPreferido?: Turno | 'Qualquer';
  opcoes: OpcaoInscricaoInput[];
}

export interface InscricaoOpcao {
  id: string;
  inscricao_id: string;
  ordem_preferencia: number;
  unidade_id: string;
  turno: Turno;
  distancia_km: number | null;
  tipo_distancia: 'geocodificada' | 'estimada_bairro' | 'indisponivel' | null;
  mesmo_bairro: 0 | 1;
  confirmou_ciente_distancia: 0 | 1;
  situacao: string;
  data_mudanca_status: string;
  criado_em: string;
}

export interface Inscricao {
  id: string;
  crianca_id: string;
  responsavel_id: string;
  ano_processo: number;
  grupamento_pretendido: Grupamento;
  turno_preferido: string | null;
  pontuacao_total: number | null;
  criado_em: string;
}
