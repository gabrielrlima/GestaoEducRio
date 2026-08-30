import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { badRequest, notFound } from '../../lib/errors';
import { isValidCpf, normalizeCpf } from '../../lib/cpf';

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
  latitude: number | null;
  longitude: number | null;
  criado_em: string;
}

export interface CreateResponsavelInput {
  cpf: string;
  nome: string;
  dataNascimento: string;
  email: string;
  telefone?: string;
  cep?: string;
  bairro: string;
  logradouro?: string;
  numero?: string;
}

/**
 * Cadastra o responsável, ou retorna o existente se o CPF já está cadastrado.
 * `dataNascimento` e `email` são obrigatórios porque são usados no login do
 * portal (CPF + data de nascimento + código de verificação enviado por e-mail).
 * R1: validação real de CPF contra a Receita Federal fica como stub — aqui só
 * valida formato/dígito verificador.
 */
export function upsertResponsavel(input: CreateResponsavelInput): Responsavel {
  const cpf = normalizeCpf(input.cpf);
  if (!isValidCpf(cpf)) {
    throw badRequest('CPF_INVALIDO', 'CPF inválido (formato ou dígito verificador)');
  }

  const existing = db.query('SELECT * FROM responsavel WHERE cpf = $cpf').get({ $cpf: cpf }) as Responsavel | null;
  if (existing) return existing;

  const id = randomUUID();
  db.query(
    `INSERT INTO responsavel (id, cpf, nome, data_nascimento, telefone, email, cep, bairro, logradouro, numero)
     VALUES ($id, $cpf, $nome, $dataNascimento, $telefone, $email, $cep, $bairro, $logradouro, $numero)`
  ).run({
    $id: id,
    $cpf: cpf,
    $nome: input.nome,
    $dataNascimento: input.dataNascimento,
    $telefone: input.telefone ?? null,
    $email: input.email,
    $cep: input.cep ?? null,
    $bairro: input.bairro,
    $logradouro: input.logradouro ?? null,
    $numero: input.numero ?? null,
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

export function updateResponsavel(id: string, patch: Partial<CreateResponsavelInput>): Responsavel {
  getResponsavelById(id);

  const fieldMap: Record<string, string> = {
    nome: 'nome',
    dataNascimento: 'data_nascimento',
    telefone: 'telefone',
    email: 'email',
    cep: 'cep',
    bairro: 'bairro',
    logradouro: 'logradouro',
    numero: 'numero',
  };

  const sets: string[] = [];
  const params: Record<string, unknown> = { $id: id };
  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in patch) {
      sets.push(`${column} = $${key}`);
      params[`$${key}`] = (patch as Record<string, unknown>)[key];
    }
  }

  if (sets.length > 0) {
    db.query(`UPDATE responsavel SET ${sets.join(', ')} WHERE id = $id`).run(params);
  }
  return getResponsavelById(id);
}
