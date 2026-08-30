import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { notFound } from '../../lib/errors';
import type { Grupamento, Turno } from '../unidades/types';

export interface VagaConfig {
  id: string;
  unidade_id: string;
  ano_processo: number;
  grupamento: Grupamento;
  turno: Turno;
  capacidade_total: number;
  vagas_ocupadas: number;
}

export function upsertVagaConfig(
  unidadeId: string,
  input: { anoProcesso: number; grupamento: Grupamento; turno: Turno; capacidadeTotal: number }
): VagaConfig {
  const existing = db
    .query(
      `SELECT * FROM vaga_config
       WHERE unidade_id = $unidadeId AND ano_processo = $ano AND grupamento = $grupamento AND turno = $turno`
    )
    .get({
      $unidadeId: unidadeId,
      $ano: input.anoProcesso,
      $grupamento: input.grupamento,
      $turno: input.turno,
    }) as VagaConfig | null;

  if (existing) {
    db.query('UPDATE vaga_config SET capacidade_total = $capacidade WHERE id = $id').run({
      $capacidade: input.capacidadeTotal,
      $id: existing.id,
    });
    return { ...existing, capacidade_total: input.capacidadeTotal };
  }

  const id = randomUUID();
  db.query(
    `INSERT INTO vaga_config (id, unidade_id, ano_processo, grupamento, turno, capacidade_total, vagas_ocupadas)
     VALUES ($id, $unidadeId, $ano, $grupamento, $turno, $capacidade, 0)`
  ).run({
    $id: id,
    $unidadeId: unidadeId,
    $ano: input.anoProcesso,
    $grupamento: input.grupamento,
    $turno: input.turno,
    $capacidade: input.capacidadeTotal,
  });

  return db.query('SELECT * FROM vaga_config WHERE id = $id').get({ $id: id }) as VagaConfig;
}

export function updateCapacidade(vagaId: string, capacidadeTotal: number): VagaConfig {
  const existing = db.query('SELECT * FROM vaga_config WHERE id = $id').get({ $id: vagaId }) as VagaConfig | null;
  if (!existing) throw notFound('VAGA_CONFIG_NAO_ENCONTRADA', `Configuração de vaga ${vagaId} não encontrada`);

  db.query('UPDATE vaga_config SET capacidade_total = $capacidade WHERE id = $id').run({
    $capacidade: capacidadeTotal,
    $id: vagaId,
  });

  return { ...existing, capacidade_total: capacidadeTotal };
}
