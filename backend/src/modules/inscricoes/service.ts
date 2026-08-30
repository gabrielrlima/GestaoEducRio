import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { badRequest, notFound } from '../../lib/errors';
import { haversineKm } from '../../lib/geo';
import { calcularGrupamentoPorIdade, getCriancaById } from '../criancas/service';
import { getResponsavelById } from '../responsaveis/service';
import { getUnidadeById } from '../unidades/service';
import type { CreateInscricaoInput, Inscricao, InscricaoOpcao } from './types';

interface InscricaoComOpcoes extends Inscricao {
  opcoes: InscricaoOpcao[];
  avisoTerritorial: boolean;
}

const RAIO_TERRITORIAL_KM = 5;

/**
 * Cria a inscrição + até 5 opções numa única transação, calculando
 * distância/mesmo-bairro por opção (fix de R2). Não bloqueia a escolha fora
 * do raio — sinaliza `avisoTerritorial` pra família confirmar ciência,
 * tornando visível o que hoje é invisível até virar cancelamento.
 */
export function criarInscricao(input: CreateInscricaoInput): InscricaoComOpcoes {
  if (input.opcoes.length === 0 || input.opcoes.length > 5) {
    throw badRequest('OPCOES_INVALIDAS', 'A inscrição precisa ter entre 1 e 5 opções de unidade');
  }

  const unidadeIds = new Set(input.opcoes.map((o) => o.unidadeId));
  if (unidadeIds.size !== input.opcoes.length) {
    throw badRequest('UNIDADES_DUPLICADAS', 'Não é possível escolher a mesma unidade mais de uma vez');
  }

  const crianca = getCriancaById(input.criancaId);
  const responsavel = getResponsavelById(crianca.responsavel_id);

  const jaInscrita = db
    .query('SELECT id FROM inscricao WHERE crianca_id = $criancaId AND ano_processo = $ano')
    .get({ $criancaId: input.criancaId, $ano: input.anoProcesso });
  if (jaInscrita) {
    throw badRequest('INSCRICAO_DUPLICADA', 'Esta criança já tem inscrição neste processo seletivo');
  }

  const grupamento = input.grupamentoPretendido ?? calcularGrupamentoPorIdade(crianca.data_nascimento);
  const inscricaoId = randomUUID();

  let avisoTerritorial = true;
  const opcoesParaInserir = input.opcoes.map((opcao, index) => {
    const unidade = getUnidadeById(opcao.unidadeId);

    let distanciaKm: number | null = null;
    let tipoDistancia: 'geocodificada' | 'estimada_bairro' | 'indisponivel' = 'indisponivel';
    const mesmoBairro = unidade.bairro?.toLowerCase() === responsavel.bairro?.toLowerCase();

    if (responsavel.latitude != null && responsavel.longitude != null && unidade.latitude != null && unidade.longitude != null) {
      distanciaKm = haversineKm(responsavel.latitude, responsavel.longitude, unidade.latitude, unidade.longitude);
      tipoDistancia = 'geocodificada';
    } else if (mesmoBairro) {
      tipoDistancia = 'estimada_bairro';
    }

    const dentroDoRaio = (distanciaKm !== null && distanciaKm <= RAIO_TERRITORIAL_KM) || mesmoBairro;
    if (dentroDoRaio) avisoTerritorial = false;

    return {
      id: randomUUID(),
      ordemPreferencia: index + 1,
      unidadeId: opcao.unidadeId,
      turno: opcao.turno,
      distanciaKm,
      tipoDistancia,
      mesmoBairro,
    };
  });

  const transacao = db.transaction(() => {
    db.query(
      `INSERT INTO inscricao (id, crianca_id, responsavel_id, ano_processo, grupamento_pretendido, turno_preferido)
       VALUES ($id, $criancaId, $responsavelId, $ano, $grupamento, $turnoPreferido)`
    ).run({
      $id: inscricaoId,
      $criancaId: input.criancaId,
      $responsavelId: crianca.responsavel_id,
      $ano: input.anoProcesso,
      $grupamento: grupamento,
      $turnoPreferido: input.turnoPreferido ?? null,
    });

    for (const opcao of opcoesParaInserir) {
      db.query(
        `INSERT INTO inscricao_opcao
           (id, inscricao_id, ordem_preferencia, unidade_id, turno, distancia_km, tipo_distancia, mesmo_bairro)
         VALUES ($id, $inscricaoId, $ordem, $unidadeId, $turno, $distanciaKm, $tipoDistancia, $mesmoBairro)`
      ).run({
        $id: opcao.id,
        $inscricaoId: inscricaoId,
        $ordem: opcao.ordemPreferencia,
        $unidadeId: opcao.unidadeId,
        $turno: opcao.turno,
        $distanciaKm: opcao.distanciaKm,
        $tipoDistancia: opcao.tipoDistancia,
        $mesmoBairro: opcao.mesmoBairro ? 1 : 0,
      });
    }
  });
  transacao();

  return { ...getInscricaoById(inscricaoId), avisoTerritorial };
}

export function getInscricaoById(id: string): InscricaoComOpcoes {
  const inscricao = db.query('SELECT * FROM inscricao WHERE id = $id').get({ $id: id }) as Inscricao | null;
  if (!inscricao) throw notFound('INSCRICAO_NAO_ENCONTRADA', `Inscrição ${id} não encontrada`);

  const opcoes = db
    .query('SELECT * FROM inscricao_opcao WHERE inscricao_id = $id ORDER BY ordem_preferencia')
    .all({ $id: id }) as InscricaoOpcao[];

  return { ...inscricao, opcoes, avisoTerritorial: false };
}

export function listInscricoesDoResponsavel(responsavelId: string): InscricaoComOpcoes[] {
  const inscricoes = db
    .query('SELECT id FROM inscricao WHERE responsavel_id = $responsavelId ORDER BY criado_em DESC')
    .all({ $responsavelId: responsavelId }) as Array<{ id: string }>;
  return inscricoes.map((i) => getInscricaoById(i.id));
}

/** Status por criança (não por opção isolada) — a tela que o documento oficial diz que hoje não existe. */
export function getStatusConsolidadoCrianca(criancaId: string) {
  const crianca = getCriancaById(criancaId);
  const inscricao = db
    .query('SELECT * FROM inscricao WHERE crianca_id = $criancaId ORDER BY criado_em DESC LIMIT 1')
    .get({ $criancaId: criancaId }) as Inscricao | null;

  if (!inscricao) {
    return { crianca, inscricaoAtiva: null, opcoes: [], situacaoConsolidada: 'sem_inscricao' as const };
  }

  const opcoes = db
    .query(
      `SELECT io.*, u.nome AS unidade_nome
       FROM inscricao_opcao io JOIN unidade u ON u.id = io.unidade_id
       WHERE io.inscricao_id = $inscricaoId ORDER BY io.ordem_preferencia`
    )
    .all({ $inscricaoId: inscricao.id }) as Array<InscricaoOpcao & { unidade_nome: string }>;

  let situacaoConsolidada: 'confirmada' | 'aguardando_confirmacao' | 'em_fila' | 'sem_oferta' = 'sem_oferta';
  if (opcoes.some((o) => o.situacao === 'Confirmado')) situacaoConsolidada = 'confirmada';
  else if (opcoes.some((o) => o.situacao === 'Selecionado' || o.situacao === 'Selecionado da lista'))
    situacaoConsolidada = 'aguardando_confirmacao';
  else if (opcoes.some((o) => o.situacao === 'Ativo' || o.situacao === 'Lista de espera')) situacaoConsolidada = 'em_fila';

  return { crianca, inscricaoAtiva: inscricao, opcoes, situacaoConsolidada };
}

/**
 * Conta solicitações (opções de inscrição) por unidade, para o requisito de
 * "mapear a quantidade de solicitações e endereçar isso por unidade" —
 * usado tanto no Portal (mostrar quão concorrida está uma unidade antes de
 * escolher) quanto no Admin (fila dentro de cada unidade).
 */
export interface Pergunta {
  id: string;
  ano_processo: number;
  texto: string;
  pontuacao: number;
  criterio_desempate: 0 | 1;
  ordem: number | null;
}

export function listarPerguntas(anoProcesso: number): Pergunta[] {
  return db
    .query('SELECT * FROM pergunta WHERE ano_processo = $ano ORDER BY ordem, pontuacao DESC')
    .all({ $ano: anoProcesso }) as Pergunta[];
}

export interface RespostaInput {
  perguntaId: string;
  resposta: 'Sim' | 'Nao';
  arquivoNome?: string;
  arquivoTipo?: string;
  arquivoBase64?: string;
}

/**
 * Salva as respostas do questionário socioeconômico (upsert por pergunta) e
 * recalcula `inscricao.pontuacao_total` como a soma da pontuação de toda
 * pergunta NÃO-desempate respondida "Sim" — é o que alimenta o ORDER BY de
 * `filaDoProcesso` (classificacao/service.ts), hoje sempre NULL porque nada
 * escrevia esse campo.
 */
export function salvarRespostas(inscricaoId: string, respostas: RespostaInput[]): InscricaoComOpcoes {
  getInscricaoById(inscricaoId); // 404 se não existir

  const transacao = db.transaction(() => {
    for (const r of respostas) {
      const existente = db
        .query('SELECT id FROM resposta_socioeconomica WHERE inscricao_id = $inscricaoId AND pergunta_id = $perguntaId')
        .get({ $inscricaoId: inscricaoId, $perguntaId: r.perguntaId }) as { id: string } | null;

      if (existente) {
        db.query(
          `UPDATE resposta_socioeconomica
             SET resposta = $resposta, arquivo_nome = $arquivoNome, arquivo_tipo = $arquivoTipo, arquivo_base64 = $arquivoBase64,
                 confirmado = $confirmado
           WHERE id = $id`
        ).run({
          $id: existente.id,
          $resposta: r.resposta,
          $arquivoNome: r.arquivoNome ?? null,
          $arquivoTipo: r.arquivoTipo ?? null,
          $arquivoBase64: r.arquivoBase64 ?? null,
          $confirmado: r.arquivoBase64 ? 1 : 0,
        });
      } else {
        db.query(
          `INSERT INTO resposta_socioeconomica
             (id, inscricao_id, pergunta_id, resposta, confirmado, arquivo_nome, arquivo_tipo, arquivo_base64)
           VALUES ($id, $inscricaoId, $perguntaId, $resposta, $confirmado, $arquivoNome, $arquivoTipo, $arquivoBase64)`
        ).run({
          $id: randomUUID(),
          $inscricaoId: inscricaoId,
          $perguntaId: r.perguntaId,
          $resposta: r.resposta,
          $confirmado: r.arquivoBase64 ? 1 : 0,
          $arquivoNome: r.arquivoNome ?? null,
          $arquivoTipo: r.arquivoTipo ?? null,
          $arquivoBase64: r.arquivoBase64 ?? null,
        });
      }
    }

    const total = db
      .query(
        `SELECT COALESCE(SUM(p.pontuacao), 0) AS total
         FROM resposta_socioeconomica rs
         JOIN pergunta p ON p.id = rs.pergunta_id
         WHERE rs.inscricao_id = $inscricaoId AND rs.resposta = 'Sim' AND p.criterio_desempate = 0`
      )
      .get({ $inscricaoId: inscricaoId }) as { total: number };

    db.query('UPDATE inscricao SET pontuacao_total = $total WHERE id = $id').run({
      $total: total.total,
      $id: inscricaoId,
    });
  });
  transacao();

  return getInscricaoById(inscricaoId);
}

export interface RespostaComPergunta {
  id: string;
  pergunta_id: string;
  resposta: 'Sim' | 'Nao';
  confirmado: 0 | 1;
  arquivo_nome: string | null;
  pergunta_texto: string;
  pergunta_pontuacao: number;
}

export function listarRespostas(inscricaoId: string): RespostaComPergunta[] {
  return db
    .query(
      `SELECT rs.id, rs.pergunta_id, rs.resposta, rs.confirmado, rs.arquivo_nome,
              p.texto AS pergunta_texto, p.pontuacao AS pergunta_pontuacao
       FROM resposta_socioeconomica rs
       JOIN pergunta p ON p.id = rs.pergunta_id
       WHERE rs.inscricao_id = $inscricaoId`
    )
    .all({ $inscricaoId: inscricaoId }) as RespostaComPergunta[];
}

export function contagemSolicitacoesPorUnidade(anoProcesso: number) {
  return db
    .query(
      `SELECT u.id AS unidade_id, u.nome,
              COUNT(io.id) AS total_solicitacoes,
              SUM(CASE WHEN io.situacao = 'Confirmado' THEN 1 ELSE 0 END) AS confirmadas,
              SUM(CASE WHEN io.situacao IN ('Ativo','Lista de espera') THEN 1 ELSE 0 END) AS em_fila
       FROM unidade u
       LEFT JOIN inscricao_opcao io ON io.unidade_id = u.id
       LEFT JOIN inscricao i ON i.id = io.inscricao_id AND i.ano_processo = $anoProcesso
       GROUP BY u.id
       ORDER BY total_solicitacoes DESC`
    )
    .all({ $anoProcesso: anoProcesso });
}
