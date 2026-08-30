import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { badRequest, notFound } from '../../lib/errors';
import { isValidCpf, normalizeCpf } from '../../lib/cpf';
import { geocodeEndereco } from '../../lib/geocode';
import { consultarBolsaFamiliaPorNis } from '../../lib/transparencia';

export interface Responsavel {
  id: string;
  cpf: string;
  nome: string;
  data_nascimento: string;
  telefone: string | null;
  email: string;
  cep: string | null;
  bairro: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  latitude: number | null;
  longitude: number | null;
  trabalho_cep: string | null;
  trabalho_bairro: string | null;
  trabalho_logradouro: string | null;
  trabalho_numero: string | null;
  trabalho_complemento: string | null;
  trabalho_latitude: number | null;
  trabalho_longitude: number | null;
  alternativo_cep: string | null;
  alternativo_bairro: string | null;
  alternativo_logradouro: string | null;
  alternativo_numero: string | null;
  alternativo_complemento: string | null;
  alternativo_latitude: number | null;
  alternativo_longitude: number | null;
  nis: string | null;
  bolsa_familia_status: 'sim' | 'nao' | 'nao_consultado';
  bolsa_familia_consultado_em: string | null;
  criado_em: string;
}

export interface CreateResponsavelInput {
  cpf: string;
  nome?: string;
  dataNascimento: string;
  email: string;
  telefone?: string;
  cep?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  trabalhoCep?: string;
  trabalhoBairro?: string;
  trabalhoLogradouro?: string;
  trabalhoNumero?: string;
  trabalhoComplemento?: string;
  alternativoCep?: string;
  alternativoBairro?: string;
  alternativoLogradouro?: string;
  alternativoNumero?: string;
  alternativoComplemento?: string;
  nis?: string;
}

/**
 * Cadastra o responsável, ou retorna o existente se o CPF já está cadastrado.
 * `dataNascimento` e `email` são obrigatórios porque são usados no login do
 * portal (CPF + data de nascimento + código de verificação enviado por e-mail).
 * R1: validação real de CPF contra a Receita Federal fica como stub — aqui só
 * valida formato/dígito verificador.
 *
 * `nome` e `bairro` são opcionais na criação — a tela de login (pura, sem
 * etapas) só coleta o mínimo pra autenticar: CPF/data/e-mail (e-mail porque
 * é o canal do código de verificação). Nome e endereço são preenchidos
 * depois, já autenticado, nas etapas "Dados pessoais" e "Endereço" da área
 * logada (via PATCH). Sem valor, caem no mesmo placeholder usado pra
 * unidade sem bairro na fonte ("Não informado").
 *
 * Se `nis` for informado, consulta Bolsa Família no Portal da Transparência
 * (best-effort — sem chave configurada, ou se a chamada falhar/expirar, o
 * cadastro segue normalmente com bolsa_familia_status='nao_consultado').
 */
export async function upsertResponsavel(input: CreateResponsavelInput): Promise<Responsavel> {
  const cpf = normalizeCpf(input.cpf);
  if (!isValidCpf(cpf)) {
    throw badRequest('CPF_INVALIDO', 'CPF inválido (formato ou dígito verificador)');
  }

  const existing = db.query('SELECT * FROM responsavel WHERE cpf = $cpf').get({ $cpf: cpf }) as Responsavel | null;
  if (existing) return existing;

  const coordenadas = await geocodeEndereco({
    logradouro: input.logradouro,
    numero: input.numero,
    bairro: input.bairro,
    cep: input.cep,
  });

  const nis = input.nis?.trim() || null;
  let bolsaFamiliaStatus: 'sim' | 'nao' | 'nao_consultado' = 'nao_consultado';
  let bolsaFamiliaConsultadoEm: string | null = null;
  if (nis) {
    const consulta = await consultarBolsaFamiliaPorNis(nis);
    if (consulta) {
      bolsaFamiliaStatus = consulta.recebe ? 'sim' : 'nao';
      bolsaFamiliaConsultadoEm = new Date().toISOString();
    }
  }

  const id = randomUUID();
  db.query(
    `INSERT INTO responsavel
       (id, cpf, nome, data_nascimento, telefone, email, cep, bairro, logradouro, numero, complemento,
        latitude, longitude, nis, bolsa_familia_status, bolsa_familia_consultado_em)
     VALUES
       ($id, $cpf, $nome, $dataNascimento, $telefone, $email, $cep, $bairro, $logradouro, $numero, $complemento,
        $latitude, $longitude, $nis, $bolsaFamiliaStatus, $bolsaFamiliaConsultadoEm)`
  ).run({
    $id: id,
    $cpf: cpf,
    $nome: input.nome?.trim() || 'Não informado',
    $dataNascimento: input.dataNascimento,
    $telefone: input.telefone ?? null,
    $email: input.email,
    $cep: input.cep ?? null,
    $bairro: input.bairro?.trim() || 'Não informado',
    $logradouro: input.logradouro ?? null,
    $numero: input.numero ?? null,
    $complemento: input.complemento ?? null,
    $latitude: coordenadas?.latitude ?? null,
    $longitude: coordenadas?.longitude ?? null,
    $nis: nis,
    $bolsaFamiliaStatus: bolsaFamiliaStatus,
    $bolsaFamiliaConsultadoEm: bolsaFamiliaConsultadoEm,
  });

  return getResponsavelByCpf(cpf);
}

export function getResponsavelByCpf(cpf: string): Responsavel {
  const normalized = normalizeCpf(cpf);
  const row = db.query('SELECT * FROM responsavel WHERE cpf = $cpf').get({ $cpf: normalized }) as Responsavel | null;
  if (!row) throw notFound('RESPONSAVEL_NAO_ENCONTRADO', `Responsável com CPF ${cpf} não encontrado`);
  return row;
}

export function getResponsavelById(id: string): Responsavel {
  const row = db.query('SELECT * FROM responsavel WHERE id = $id').get({ $id: id }) as Responsavel | null;
  if (!row) throw notFound('RESPONSAVEL_NAO_ENCONTRADO', `Responsável ${id} não encontrado`);
  return row;
}

const CAMPOS_ENDERECO = ['cep', 'bairro', 'logradouro', 'numero'] as const;

/**
 * Se `nis` vier no patch (e mudou), reconsulta Bolsa Família (best-effort,
 * mesma regra de falha silenciosa de `upsertResponsavel`).
 */
export async function updateResponsavel(id: string, patch: Partial<CreateResponsavelInput>): Promise<Responsavel> {
  const atual = getResponsavelById(id);

  const fieldMap: Record<string, string> = {
    nome: 'nome',
    dataNascimento: 'data_nascimento',
    telefone: 'telefone',
    email: 'email',
    cep: 'cep',
    bairro: 'bairro',
    logradouro: 'logradouro',
    numero: 'numero',
    complemento: 'complemento',
    trabalhoCep: 'trabalho_cep',
    trabalhoBairro: 'trabalho_bairro',
    trabalhoLogradouro: 'trabalho_logradouro',
    trabalhoNumero: 'trabalho_numero',
    trabalhoComplemento: 'trabalho_complemento',
    alternativoCep: 'alternativo_cep',
    alternativoBairro: 'alternativo_bairro',
    alternativoLogradouro: 'alternativo_logradouro',
    alternativoNumero: 'alternativo_numero',
    alternativoComplemento: 'alternativo_complemento',
    nis: 'nis',
  };

  const sets: string[] = [];
  const params: Record<string, unknown> = { $id: id };
  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in patch) {
      sets.push(`${column} = $${key}`);
      params[`$${key}`] = (patch as Record<string, unknown>)[key];
    }
  }

  const enderecoMudou = CAMPOS_ENDERECO.some((campo) => campo in patch);
  if (enderecoMudou) {
    const coordenadas = await geocodeEndereco({
      logradouro: patch.logradouro ?? atual.logradouro,
      numero: patch.numero ?? atual.numero,
      bairro: patch.bairro ?? atual.bairro,
      cep: patch.cep ?? atual.cep,
    });
    sets.push('latitude = $latitude', 'longitude = $longitude');
    params.$latitude = coordenadas?.latitude ?? null;
    params.$longitude = coordenadas?.longitude ?? null;
  }

  // Trabalho e alternativo também precisam de coordenada: são eles que sustentam a
  // distância por endereço e o desvio de rota casa→trabalho no agente de recomendação
  // (ver modules/ia/features.ts). Sem isso o endereço entra como texto e não pesa em nada.
  for (const prefixo of ['trabalho', 'alternativo'] as const) {
    const campos = CAMPOS_ENDERECO.map(
      (campo) => `${prefixo}${campo.charAt(0).toUpperCase()}${campo.slice(1)}` as keyof CreateResponsavelInput
    );
    if (!campos.some((campo) => campo in patch)) continue;

    const valor = (chave: keyof CreateResponsavelInput, coluna: keyof Responsavel) =>
      (patch[chave] as string | undefined) ?? (atual[coluna] as string | null);

    const coordenadas = await geocodeEndereco({
      logradouro: valor(`${prefixo}Logradouro`, `${prefixo}_logradouro`),
      numero: valor(`${prefixo}Numero`, `${prefixo}_numero`),
      bairro: valor(`${prefixo}Bairro`, `${prefixo}_bairro`),
      cep: valor(`${prefixo}Cep`, `${prefixo}_cep`),
    });
    sets.push(`${prefixo}_latitude = $${prefixo}Latitude`, `${prefixo}_longitude = $${prefixo}Longitude`);
    params[`$${prefixo}Latitude`] = coordenadas?.latitude ?? null;
    params[`$${prefixo}Longitude`] = coordenadas?.longitude ?? null;
  }

  if (patch.nis && patch.nis !== atual.nis) {
    const consulta = await consultarBolsaFamiliaPorNis(patch.nis);
    if (consulta) {
      sets.push('bolsa_familia_status = $bolsaFamiliaStatus', 'bolsa_familia_consultado_em = $bolsaFamiliaConsultadoEm');
      params.$bolsaFamiliaStatus = consulta.recebe ? 'sim' : 'nao';
      params.$bolsaFamiliaConsultadoEm = new Date().toISOString();
    }
  }

  if (sets.length > 0) {
    db.query(`UPDATE responsavel SET ${sets.join(', ')} WHERE id = $id`).run(params);
  }
  return getResponsavelById(id);
}
