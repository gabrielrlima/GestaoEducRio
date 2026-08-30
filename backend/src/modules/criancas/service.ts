import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { notFound } from '../../lib/errors';

export interface Crianca {
  id: string;
  responsavel_id: string;
  nome_completo: string;
  data_nascimento: string;
  sexo: 'M' | 'F' | null;
  cpf_crianca: string | null;
  criado_em: string;
}

export interface CreateCriancaInput {
  nomeCompleto: string;
  dataNascimento: string;
  sexo?: 'M' | 'F';
  cpfCrianca?: string;
}

export function createCrianca(responsavelId: string, input: CreateCriancaInput): Crianca {
  const id = randomUUID();
  db.query(
    `INSERT INTO crianca (id, responsavel_id, nome_completo, data_nascimento, sexo, cpf_crianca)
     VALUES ($id, $responsavelId, $nomeCompleto, $dataNascimento, $sexo, $cpfCrianca)`
  ).run({
    $id: id,
    $responsavelId: responsavelId,
    $nomeCompleto: input.nomeCompleto,
    $dataNascimento: input.dataNascimento,
    $sexo: input.sexo ?? null,
    $cpfCrianca: input.cpfCrianca ?? null,
  });
  return getCriancaById(id);
}

export function getCriancaById(id: string): Crianca {
  const row = db.query('SELECT * FROM crianca WHERE id = $id').get({ $id: id }) as Crianca | null;
  if (!row) throw notFound('CRIANCA_NAO_ENCONTRADA', `Criança ${id} não encontrada`);
  return row;
}

export function listCriancasDoResponsavel(responsavelId: string): Crianca[] {
  return db
    .query('SELECT * FROM crianca WHERE responsavel_id = $responsavelId ORDER BY nome_completo')
    .all({ $responsavelId: responsavelId }) as Crianca[];
}

/** Calcula o grupamento etário pela idade da criança numa data de corte (padrão: hoje). */
export function calcularGrupamentoPorIdade(dataNascimento: string, dataCorte = new Date()): 'Bercario' | 'Maternal I' | 'Maternal II' {
  const nascimento = new Date(dataNascimento);
  const idadeMeses =
    (dataCorte.getFullYear() - nascimento.getFullYear()) * 12 + (dataCorte.getMonth() - nascimento.getMonth());

  if (idadeMeses < 24) return 'Bercario';
  if (idadeMeses < 36) return 'Maternal I';
  return 'Maternal II';
}
