import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { badRequest, notFound } from '../../lib/errors';
import { isValidCpf, normalizeCpf } from '../../lib/cpf';

export interface Crianca {
  id: string;
  responsavel_id: string;
  nome_completo: string;
  data_nascimento: string;
  sexo: 'M' | 'F' | null;
  cpf_crianca: string;
  criado_em: string;
}

export interface CreateCriancaInput {
  nomeCompleto: string;
  dataNascimento: string;
  cpfCrianca: string;
  sexo?: 'M' | 'F';
}

/**
 * CPF da criança é obrigatório — o briefing oficial lista "colisão de
 * identidade de criança" como gap real do processo atual; exigir e validar
 * o CPF aqui (mesma checagem de dígito verificador usada pro responsável)
 * ataca esse problema na entrada, não só no relatório.
 */
export function createCrianca(responsavelId: string, input: CreateCriancaInput): Crianca {
  const cpfCrianca = normalizeCpf(input.cpfCrianca);
  if (!isValidCpf(cpfCrianca)) {
    throw badRequest('CPF_CRIANCA_INVALIDO', 'CPF da criança inválido (formato ou dígito verificador)');
  }

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
    $cpfCrianca: cpfCrianca,
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

/** Permite corrigir um cadastro feito com erro — mesma validação de CPF da criação quando o CPF muda. */
export function updateCrianca(id: string, patch: Partial<CreateCriancaInput>): Crianca {
  getCriancaById(id); // 404 se não existir

  const fieldMap: Record<string, string> = {
    nomeCompleto: 'nome_completo',
    dataNascimento: 'data_nascimento',
    sexo: 'sexo',
    cpfCrianca: 'cpf_crianca',
  };

  const sets: string[] = [];
  const params: Record<string, unknown> = { $id: id };
  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in patch) {
      let valor = (patch as Record<string, unknown>)[key];
      if (key === 'cpfCrianca') {
        const cpfNormalizado = normalizeCpf(valor as string);
        if (!isValidCpf(cpfNormalizado)) {
          throw badRequest('CPF_CRIANCA_INVALIDO', 'CPF da criança inválido (formato ou dígito verificador)');
        }
        valor = cpfNormalizado;
      }
      sets.push(`${column} = $${key}`);
      params[`$${key}`] = valor;
    }
  }

  if (sets.length > 0) {
    db.query(`UPDATE crianca SET ${sets.join(', ')} WHERE id = $id`).run(params);
  }
  return getCriancaById(id);
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
