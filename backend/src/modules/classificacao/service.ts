import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { conflict, notFound } from '../../lib/errors';
import type { InscricaoOpcao } from '../inscricoes/types';

function getOpcaoById(id: string): InscricaoOpcao {
  const row = db.query('SELECT * FROM inscricao_opcao WHERE id = $id').get({ $id: id }) as InscricaoOpcao | null;
  if (!row) throw notFound('OPCAO_NAO_ENCONTRADA', `Opção de inscrição ${id} não encontrada`);
  return row;
}

function marcarSituacao(opcaoId: string, situacao: string) {
  db.query(`UPDATE inscricao_opcao SET situacao = $situacao, data_mudanca_status = datetime('now') WHERE id = $id`).run({
    $situacao: situacao,
    $id: opcaoId,
  });
}

/**
 * "Chamar da fila" — fix de R8. Antes de ativar uma oferta, checa se a
 * inscrição já tem outra opção em estado ativo (Selecionado/Selecionado da
 * lista/Confirmado). Se sim, 409 com mensagem clara. O índice único parcial
 * no schema é a trava física final (pega até condição de corrida); este check
 * só existe pra dar um erro de aplicação legível em vez de estourar SQLite cru.
 */
export function selecionarOpcao(opcaoId: string): InscricaoOpcao {
  const opcao = getOpcaoById(opcaoId);

  const ofertaAtiva = db
    .query(
      `SELECT id FROM inscricao_opcao
       WHERE inscricao_id = $inscricaoId AND id != $opcaoId
         AND situacao IN ('Selecionado','Selecionado da lista','Confirmado')`
    )
    .get({ $inscricaoId: opcao.inscricao_id, $opcaoId: opcaoId });

  if (ofertaAtiva) {
    throw conflict(
      'R8_OFERTA_ATIVA',
      'Esta criança já tem uma oferta de vaga ativa em outra unidade — não é possível selecionar duas ao mesmo tempo (fix de R8).'
    );
  }

  marcarSituacao(opcaoId, 'Selecionado');
  return getOpcaoById(opcaoId);
}

/**
 * Confirma a matrícula: numa transação, marca a opção como Confirmado,
 * incrementa vagas_ocupadas (checando capacidade), cria a Matrícula, e
 * cancela em cascata as demais opções ATIVAS da mesma inscrição — garante
 * que não sobra nenhum estado onde a mesma criança tem 2 opções abertas.
 */
export function confirmarOpcao(opcaoId: string): { opcao: InscricaoOpcao; matricula: { id: string } } {
  const opcao = getOpcaoById(opcaoId);

  const vaga = db
    .query(
      `SELECT vc.* FROM vaga_config vc
       JOIN inscricao i ON i.id = $inscricaoId
       WHERE vc.unidade_id = $unidadeId AND vc.ano_processo = i.ano_processo
         AND vc.grupamento = i.grupamento_pretendido AND vc.turno = $turno`
    )
    .get({ $inscricaoId: opcao.inscricao_id, $unidadeId: opcao.unidade_id, $turno: opcao.turno }) as
    | { id: string; capacidade_total: number; vagas_ocupadas: number }
    | null;

  if (vaga && vaga.vagas_ocupadas >= vaga.capacidade_total) {
    throw conflict('VAGA_LOTADA', 'Não há capacidade disponível nesta combinação de unidade/grupamento/turno');
  }

  const matriculaId = randomUUID();

  const transacao = db.transaction(() => {
    marcarSituacao(opcaoId, 'Confirmado');

    if (vaga) {
      db.query('UPDATE vaga_config SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = $id').run({ $id: vaga.id });
    }

    db.query('INSERT INTO matricula (id, inscricao_opcao_id) VALUES ($id, $opcaoId)').run({
      $id: matriculaId,
      $opcaoId: opcaoId,
    });

    db.query(
      `UPDATE inscricao_opcao
       SET situacao = 'Cancelado na confirmacao', data_mudanca_status = datetime('now')
       WHERE inscricao_id = $inscricaoId AND id != $opcaoId AND situacao IN ('Ativo','Lista de espera')`
    ).run({ $inscricaoId: opcao.inscricao_id, $opcaoId: opcaoId });
  });
  transacao();

  return { opcao: getOpcaoById(opcaoId), matricula: { id: matriculaId } };
}

/** Libera a vaga (desistência) — a inscrição volta a poder receber oferta em outra unidade. */
export function desistirOpcao(opcaoId: string): InscricaoOpcao {
  getOpcaoById(opcaoId);
  marcarSituacao(opcaoId, 'Cancelado');
  return getOpcaoById(opcaoId);
}

export function filaDoProcesso(params: { anoProcesso: number; unidadeId?: string; grupamento?: string; turno?: string }) {
  const conditions = ['i.ano_processo = $anoProcesso'];
  const sqlParams: Record<string, unknown> = { $anoProcesso: params.anoProcesso };

  if (params.unidadeId) {
    conditions.push('io.unidade_id = $unidadeId');
    sqlParams.$unidadeId = params.unidadeId;
  }
  if (params.grupamento) {
    conditions.push('i.grupamento_pretendido = $grupamento');
    sqlParams.$grupamento = params.grupamento;
  }
  if (params.turno) {
    conditions.push('io.turno = $turno');
    sqlParams.$turno = params.turno;
  }

  return db
    .query(
      `SELECT io.*, i.pontuacao_total, c.nome_completo AS crianca_nome
       FROM inscricao_opcao io
       JOIN inscricao i ON i.id = io.inscricao_id
       JOIN crianca c ON c.id = i.crianca_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.pontuacao_total DESC NULLS LAST, io.criado_em ASC`
    )
    .all(sqlParams);
}

/** Opções "Selecionado" há mais de N dias sem confirmação — fix do gap "fila sem visibilidade de prazo" (R31). */
export function opcoesPendentes(diasParado: number) {
  return db
    .query(
      `SELECT io.*, u.nome AS unidade_nome, c.nome_completo AS crianca_nome
       FROM inscricao_opcao io
       JOIN unidade u ON u.id = io.unidade_id
       JOIN inscricao i ON i.id = io.inscricao_id
       JOIN crianca c ON c.id = i.crianca_id
       WHERE io.situacao IN ('Selecionado','Selecionado da lista')
         AND julianday('now') - julianday(io.data_mudanca_status) > $dias
       ORDER BY io.data_mudanca_status ASC`
    )
    .all({ $dias: diasParado });
}

/**
 * Prova viva do fix de R8/R30: pra dado gerado pelo fluxo operacional novo,
 * esta query deve SEMPRE retornar vazio (o índice único + a trava de
 * aplicação impedem o estado inconsistente que hoje ocorre em ~0,2% dos
 * cadastros reais, ver R30).
 */
export function inconsistencias() {
  return db
    .query(
      `SELECT i.id AS inscricao_id, c.nome_completo AS crianca_nome,
              GROUP_CONCAT(io.situacao || ' @ ' || io.unidade_id) AS opcoes_conflitantes
       FROM inscricao i
       JOIN crianca c ON c.id = i.crianca_id
       JOIN inscricao_opcao io ON io.inscricao_id = i.id
       WHERE io.situacao IN ('Selecionado','Selecionado da lista','Confirmado')
       GROUP BY i.id
       HAVING COUNT(*) > 1`
    )
    .all();
}
