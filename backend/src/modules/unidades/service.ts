import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { haversineKm } from '../../lib/geo';
import { notFound } from '../../lib/errors';
import type { CreateUnidadeInput, Grupamento, Turno, Unidade, UnidadeComOcupacao } from './types';

/**
 * 128 das 1.061 unidades ativas vêm da fonte sem endereço nenhum: bairro é o placeholder
 * "Não informado" e latitude/longitude são NULL. Não dá pra dizer se ficam perto de alguém,
 * então elas não podem ser OFERECIDAS a uma família — cair numa dessas é o R2 (escolha sem
 * critério territorial) acontecendo dentro da nossa própria tela.
 *
 * O predicado exclui essas unidades de tudo que é voltado à família (`unidadesProximas`,
 * candidatas do agente). `listUnidades` NÃO usa o filtro de propósito: é por lá que o admin
 * enxerga e corrige as unidades sem endereço (PATCH /unidades/:id) — ver
 * docs/desafio/higienizacao-bairro.md.
 */
export const SQL_UNIDADE_LOCALIZAVEL =
  "(u.latitude IS NOT NULL AND u.longitude IS NOT NULL OR LOWER(TRIM(COALESCE(u.bairro, ''))) NOT IN ('', 'não informado'))";

export function createUnidade(input: CreateUnidadeInput): Unidade {
  const id = randomUUID();
  db.query(
    `INSERT INTO unidade (id, esc_codigo, nome, tipo_gestao, cre, logradouro, numero, complemento, bairro, cep, latitude, longitude)
     VALUES ($id, $escCodigo, $nome, $tipoGestao, $cre, $logradouro, $numero, $complemento, $bairro, $cep, $latitude, $longitude)`
  ).run({
    $id: id,
    $escCodigo: input.escCodigo ?? null,
    $nome: input.nome,
    $tipoGestao: input.tipoGestao,
    $cre: input.cre ?? null,
    $logradouro: input.logradouro ?? null,
    $numero: input.numero ?? null,
    $complemento: input.complemento ?? null,
    $bairro: input.bairro,
    $cep: input.cep ?? null,
    $latitude: input.latitude ?? null,
    $longitude: input.longitude ?? null,
  });
  return getUnidadeById(id);
}

export function getUnidadeById(id: string): Unidade {
  const row = db.query('SELECT * FROM unidade WHERE id = $id').get({ $id: id }) as Unidade | null;
  if (!row) throw notFound('UNIDADE_NAO_ENCONTRADA', `Unidade ${id} não encontrada`);
  return row;
}

/**
 * Ocupação (capacidade_total/vagas_ocupadas) vem agregada de vaga_config —
 * soma todos os grupamentos/turnos de um ano_processo (padrão: ano atual).
 * Unidade sem nenhuma linha em vaga_config para o ano volta com os dois
 * campos zerados (LEFT JOIN + COALESCE), não null — mais simples de tratar
 * na UI (0/0 = "sem dados de vaga configurados", não erro).
 */
export function listUnidades(filters: {
  bairro?: string;
  cre?: number;
  tipoGestao?: string;
  ativa?: boolean;
  anoProcesso?: number;
}): UnidadeComOcupacao[] {
  const conditions: string[] = ['1=1'];
  const params: Record<string, unknown> = { $anoProcesso: filters.anoProcesso ?? new Date().getFullYear() };

  if (filters.bairro) {
    conditions.push('u.bairro LIKE $bairro');
    params.$bairro = `%${filters.bairro}%`;
  }
  if (filters.cre !== undefined) {
    conditions.push('u.cre = $cre');
    params.$cre = filters.cre;
  }
  if (filters.tipoGestao) {
    conditions.push('u.tipo_gestao = $tipoGestao');
    params.$tipoGestao = filters.tipoGestao;
  }
  if (filters.ativa !== undefined) {
    conditions.push('u.ativa = $ativa');
    params.$ativa = filters.ativa ? 1 : 0;
  }

  return db
    .query(
      `SELECT u.*,
              COALESCE(SUM(vc.capacidade_total), 0) AS capacidade_total,
              COALESCE(SUM(vc.vagas_ocupadas), 0) AS vagas_ocupadas
       FROM unidade u
       LEFT JOIN vaga_config vc ON vc.unidade_id = u.id AND vc.ano_processo = $anoProcesso
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.id
       ORDER BY u.nome`
    )
    .all(params) as UnidadeComOcupacao[];
}

export function updateUnidade(id: string, patch: Partial<CreateUnidadeInput>): Unidade {
  getUnidadeById(id); // 404 se não existir

  const fieldMap: Record<string, string> = {
    escCodigo: 'esc_codigo',
    nome: 'nome',
    tipoGestao: 'tipo_gestao',
    cre: 'cre',
    logradouro: 'logradouro',
    numero: 'numero',
    complemento: 'complemento',
    bairro: 'bairro',
    cep: 'cep',
    latitude: 'latitude',
    longitude: 'longitude',
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
    db.query(`UPDATE unidade SET ${sets.join(', ')} WHERE id = $id`).run(params);
  }
  return getUnidadeById(id);
}

export function getVagasDaUnidade(unidadeId: string, anoProcesso?: number) {
  const condition = anoProcesso ? 'AND ano_processo = $ano' : '';
  return db
    .query(
      `SELECT grupamento, turno, capacidade_total, vagas_ocupadas,
              (capacidade_total - vagas_ocupadas) AS vagas_disponiveis
       FROM vaga_config WHERE unidade_id = $unidadeId ${condition}
       ORDER BY grupamento, turno`
    )
    .all({ $unidadeId: unidadeId, ...(anoProcesso ? { $ano: anoProcesso } : {}) });
}

interface UnidadeProxima {
  unidadeId: string;
  nome: string;
  bairro: string;
  latitude: number | null;
  longitude: number | null;
  distanciaKm: number | null;
  mesmoBairro: boolean;
  vagasDisponiveis: number;
}

/**
 * Núcleo do fix de R2 (escolha sem critério territorial): ordena unidades por
 * proximidade real (haversine) quando há lat/lng dos dois lados, com fallback
 * por bairro quando não há geocodificação — nunca deixa a família "escolhendo
 * às cegas" entre 872 unidades sem nenhuma ordenação territorial.
 */
export function unidadesProximas(params: {
  lat?: number;
  lng?: number;
  bairro?: string;
  grupamento?: Grupamento;
  turno?: Turno;
  anoProcesso: number;
  raioKm?: number;
  limite?: number;
}): UnidadeProxima[] {
  const { lat, lng, bairro, grupamento, turno, anoProcesso, raioKm = 5, limite = 20 } = params;

  const conditions = ['u.ativa = 1', SQL_UNIDADE_LOCALIZAVEL];
  const sqlParams: Record<string, unknown> = { $anoProcesso: anoProcesso };

  if (grupamento) {
    conditions.push('vc.grupamento = $grupamento');
    sqlParams.$grupamento = grupamento;
  }
  if (turno) {
    conditions.push('vc.turno = $turno');
    sqlParams.$turno = turno;
  }

  const rows = db
    .query(
      `SELECT u.id, u.nome, u.bairro, u.latitude, u.longitude,
              COALESCE(SUM(vc.capacidade_total - vc.vagas_ocupadas), 0) AS vagas_disponiveis
       FROM unidade u
       LEFT JOIN vaga_config vc ON vc.unidade_id = u.id AND vc.ano_processo = $anoProcesso
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.id`
    )
    .all(sqlParams) as Array<{
    id: string;
    nome: string;
    bairro: string;
    latitude: number | null;
    longitude: number | null;
    vagas_disponiveis: number;
  }>;

  const withDistance: UnidadeProxima[] = rows.map((row) => {
    const mesmoBairro = bairro != null && row.bairro?.toLowerCase() === bairro.toLowerCase();
    let distanciaKm: number | null = null;
    if (lat != null && lng != null && row.latitude != null && row.longitude != null) {
      distanciaKm = haversineKm(lat, lng, row.latitude, row.longitude);
    }
    return {
      unidadeId: row.id,
      nome: row.nome,
      bairro: row.bairro,
      latitude: row.latitude,
      longitude: row.longitude,
      distanciaKm,
      mesmoBairro,
      vagasDisponiveis: row.vagas_disponiveis,
    };
  });

  // Unidade sem coordenada NÃO passa no filtro de raio só por não ter distância calculada:
  // "não sei onde fica" não é o mesmo que "fica perto". Ela só entra se o bairro bater com o
  // da família, que é o outro sinal territorial que temos.
  const dentroDoRaio =
    lat != null && lng != null
      ? withDistance.filter((u) => (u.distanciaKm != null && u.distanciaKm <= raioKm) || u.mesmoBairro)
      : withDistance;

  // Família fora do raio de qualquer creche (moradia em outro município, por exemplo):
  // devolver lista vazia esconderia opções reais. Cai para as mais próximas de fato,
  // com a distância verdadeira na tela, em vez de relaxar o raio silenciosamente.
  const filtered =
    dentroDoRaio.length === 0 && lat != null && lng != null
      ? withDistance.filter((u) => u.distanciaKm != null)
      : dentroDoRaio;

  return filtered
    .sort((a, b) => {
      if (a.distanciaKm != null && b.distanciaKm != null) return a.distanciaKm - b.distanciaKm;
      if (a.distanciaKm != null) return -1;
      if (b.distanciaKm != null) return 1;
      if (a.mesmoBairro !== b.mesmoBairro) return a.mesmoBairro ? -1 : 1;
      return b.vagasDisponiveis - a.vagasDisponiveis;
    })
    .slice(0, limite);
}
