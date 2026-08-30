import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { badRequest, notFound } from '../../lib/errors';
import { isValidCpf, normalizeCpf } from '../../lib/cpf';
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
        nis, bolsa_familia_status, bolsa_familia_consultado_em)
     VALUES
       ($id, $cpf, $nome, $dataNascimento, $telefone, $email, $cep, $bairro, $logradouro, $numero, $complemento,
        $nis, $bolsaFamiliaStatus, $bolsaFamiliaConsultadoEm)`
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
