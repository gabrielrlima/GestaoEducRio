import axios from 'axios';

// ----------------------------------------------------------------------
// Cliente de API pro backend GestaoEducRio (Elysia). Independente do
// axiosInstance genérico do template (src/lib/axios.ts) porque nosso backend
// tem seu próprio esquema de auth (token opaco em header Authorization),
// não o CONFIG.auth.method (jwt/firebase/...) do template.

const API_URL = import.meta.env.VITE_CRECHE_API_URL ?? 'http://localhost:3000/api';

const TOKEN_KEYS = { admin: 'creche_admin_token', responsavel: 'creche_responsavel_token' } as const;

export function getToken(tipo: 'admin' | 'responsavel'): string | null {
  return localStorage.getItem(TOKEN_KEYS[tipo]);
}

export function setToken(tipo: 'admin' | 'responsavel', token: string) {
  localStorage.setItem(TOKEN_KEYS[tipo], token);
}

export function clearToken(tipo: 'admin' | 'responsavel') {
  localStorage.removeItem(TOKEN_KEYS[tipo]);
}

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
// Tipos (espelham backend/src/modules/*/service.ts)

export type TipoGestao = 'Direta' | 'Conveniada' | 'Parceria';
export type Grupamento = 'Bercario' | 'Maternal I' | 'Maternal II';
export type Turno = 'Integral' | 'Parcial';
export type Situacao =
  | 'Ativo'
  | 'Selecionado'
  | 'Selecionado da lista'
  | 'Confirmado'
  | 'Lista de espera'
  | 'Cancelado'
  | 'Cancelado na confirmacao'
  | 'Cancelado pelo sistema'
  | 'Bloqueada';

export interface Unidade {
  id: string;
  esc_codigo: string | null;
  nome: string;
  tipo_gestao: TipoGestao;
  cre: number | null;
  bairro: string;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  ativa: 0 | 1;
  /** Só vem preenchido em listUnidades (soma de vaga_config do ano_processo pedido). */
  capacidade_total?: number;
  vagas_ocupadas?: number;
}

export interface VagaConfig {
  grupamento: Grupamento;
  turno: Turno;
  capacidade_total: number;
  vagas_ocupadas: number;
  vagas_disponiveis: number;
}

export interface UnidadeProxima {
  unidadeId: string;
  nome: string;
  bairro: string;
  distanciaKm: number | null;
  mesmoBairro: boolean;
  vagasDisponiveis: number;
}

export interface Responsavel {
  id: string;
  cpf: string;
  nome: string;
  data_nascimento: string;
  email: string;
  telefone: string | null;
  cep: string | null;
  bairro: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  trabalho_cep: string | null;
  trabalho_bairro: string | null;
  trabalho_logradouro: string | null;
  trabalho_numero: string | null;
  trabalho_complemento: string | null;
  alternativo_cep: string | null;
  alternativo_bairro: string | null;
  alternativo_logradouro: string | null;
  alternativo_numero: string | null;
  alternativo_complemento: string | null;
}

export interface Crianca {
  id: string;
  responsavel_id: string;
  nome_completo: string;
  data_nascimento: string;
  sexo: 'M' | 'F' | null;
  cpf_crianca: string;
}

export interface InscricaoOpcao {
  id: string;
  inscricao_id: string;
  ordem_preferencia: number;
  unidade_id: string;
  unidade_nome?: string;
  turno: Turno;
  distancia_km: number | null;
  mesmo_bairro: 0 | 1;
  situacao: Situacao;
  data_mudanca_status: string;
  crianca_nome?: string;
}

export interface Inscricao {
  id: string;
  crianca_id: string;
  responsavel_id: string;
  ano_processo: number;
  grupamento_pretendido: Grupamento;
  opcoes: InscricaoOpcao[];
  avisoTerritorial?: boolean;
}

export interface StatusConsolidado {
  crianca: Crianca;
  inscricaoAtiva: Inscricao | null;
  opcoes: InscricaoOpcao[];
  situacaoConsolidada: 'confirmada' | 'aguardando_confirmacao' | 'em_fila' | 'sem_oferta' | 'sem_inscricao';
}

// ----------------------------------------------------------------------
// Auth

export async function loginAdmin(usuario: string, senha: string) {
  const { data } = await client.post<{ token: string; expiraEm: string }>('/auth/admin/login', { usuario, senha });
  setToken('admin', data.token);
  return data;
}

export async function solicitarCodigoResponsavel(cpf: string, dataNascimento: string) {
  const { data } = await client.post<{ enviado: boolean; modo: 'email' | 'console' }>(
    '/auth/responsavel/solicitar-codigo',
    { cpf, dataNascimento }
  );
  return data;
}

export async function verificarCodigoResponsavel(cpf: string, codigo: string) {
  const { data } = await client.post<{ token: string; responsavelId: string }>(
    '/auth/responsavel/verificar-codigo',
    { cpf, codigo }
  );
  setToken('responsavel', data.token);
  return data;
}

// ----------------------------------------------------------------------
// Unidades / vagas

export async function listUnidades(params?: { bairro?: string; ativa?: boolean }) {
  const { data } = await client.get<Unidade[]>('/unidades', { params });
  return data;
}

export async function getUnidade(id: string) {
  const { data } = await client.get<Unidade & { vagas: VagaConfig[] }>(`/unidades/${id}`);
  return data;
}

export async function unidadesProximas(params: {
  bairro?: string;
  lat?: number;
  lng?: number;
  grupamento?: Grupamento;
  turno?: Turno;
  anoProcesso: number;
}) {
  const { data } = await client.get<UnidadeProxima[]>('/unidades/proximas', { params });
  return data;
}

export async function solicitacoesPorUnidade(anoProcesso: number) {
  const { data } = await client.get<
    Array<{ unidade_id: string; nome: string; total_solicitacoes: number; confirmadas: number; em_fila: number }>
  >('/inscricoes/solicitacoes-por-unidade', { params: { anoProcesso } });
  return data;
}

// ----------------------------------------------------------------------
// Responsáveis / crianças

export async function cadastrarResponsavel(input: {
  cpf: string;
  dataNascimento: string;
  email: string;
  nome?: string;
  telefone?: string;
  bairro?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
}) {
  const { data } = await client.post<Responsavel>('/responsaveis', input);
  return data;
}

export async function getResponsavel(idOuCpf: string) {
  const { data } = await client.get<Responsavel & { criancas: Crianca[] }>(`/responsaveis/${idOuCpf}`);
  return data;
}

export async function atualizarResponsavel(
  id: string,
  patch: Partial<{
    nome: string;
    dataNascimento: string;
    email: string;
    telefone: string;
    cep: string;
    bairro: string;
    logradouro: string;
    numero: string;
    complemento: string;
    trabalhoCep: string;
    trabalhoBairro: string;
    trabalhoLogradouro: string;
    trabalhoNumero: string;
    trabalhoComplemento: string;
    alternativoCep: string;
    alternativoBairro: string;
    alternativoLogradouro: string;
    alternativoNumero: string;
    alternativoComplemento: string;
  }>
) {
  const { data } = await client.patch<Responsavel>(`/responsaveis/${id}`, patch);
  return data;
}

export async function cadastrarCrianca(
  responsavelId: string,
  input: { nomeCompleto: string; dataNascimento: string; cpfCrianca: string; sexo?: 'M' | 'F' }
) {
  const { data } = await client.post<Crianca>(`/responsaveis/${responsavelId}/criancas`, input);
  return data;
}

export async function atualizarCrianca(
  id: string,
  patch: Partial<{ nomeCompleto: string; dataNascimento: string; cpfCrianca: string; sexo: 'M' | 'F' }>
) {
  const { data } = await client.patch<Crianca>(`/criancas/${id}`, patch);
  return data;
}

export async function getStatusCrianca(criancaId: string) {
  const { data } = await client.get<StatusConsolidado>(`/criancas/${criancaId}/status`);
  return data;
}

// ----------------------------------------------------------------------
// Inscrições / classificação

export async function criarInscricao(input: {
  criancaId: string;
  anoProcesso: number;
  opcoes: Array<{ unidadeId: string; turno: Turno }>;
}) {
  const { data } = await client.post<Inscricao>('/inscricoes', input);
  return data;
}

export async function filaDoProcesso(ano: number, params?: { unidadeId?: string }) {
  const { data } = await client.get<InscricaoOpcao[]>(`/processos/${ano}/fila`, { params });
  return data;
}

export async function opcoesPendentes(diasParado = 3) {
  const { data } = await client.get<Array<InscricaoOpcao & { unidade_nome: string; crianca_nome: string }>>(
    '/painel/opcoes-pendentes',
    { params: { diasParado } }
  );
  return data;
}

export async function inconsistencias() {
  const { data } = await client.get<Array<{ inscricao_id: string; crianca_nome: string; opcoes_conflitantes: string }>>(
    '/painel/inconsistencias'
  );
  return data;
}

export async function selecionarOpcao(opcaoId: string) {
  const { data } = await client.post<InscricaoOpcao>(`/opcoes/${opcaoId}/selecionar`);
  return data;
}

export async function confirmarOpcao(opcaoId: string) {
  const { data } = await client.post<{ opcao: InscricaoOpcao; matricula: { id: string } }>(
    `/opcoes/${opcaoId}/confirmar`
  );
  return data;
}

export async function desistirOpcao(opcaoId: string) {
  const { data } = await client.post<InscricaoOpcao>(`/opcoes/${opcaoId}/desistir`);
  return data;
}

export default client;
