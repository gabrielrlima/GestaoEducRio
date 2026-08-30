import { db } from '../../db/client';
import { desvioDeRotaKm, distanciaAteRotaKm, haversineKm, type Ponto } from '../../lib/geo';
import type { Responsavel } from '../responsaveis/service';
import { calcularGrupamentoPorIdade, type Crianca } from '../criancas/service';
import type { Grupamento, Turno } from '../unidades/types';

/**
 * Camada determinística do agente de recomendação: tudo que é cálculo (distâncias por
 * endereço, desvio de rota, disponibilidade atual, histórico da unidade, chance estimada)
 * mora aqui, e as tools em `tools.ts` são só a fachada que o modelo enxerga. Assim o
 * fallback sem IA e o agente usam exatamente os mesmos números, e nada que a IA cita
 * depende dela ter "calculado certo" — ela só escolhe e explica.
 */

// ----------------------------------------------------------------------
// Perfil da família

export type TipoEndereco = 'moradia' | 'trabalho' | 'alternativo';

/** Um dos três endereços de `responsavel`, normalizado numa forma comum. */
export interface EnderecoFamilia {
  tipo: TipoEndereco;
  rotulo: string;
  bairro: string | null;
  logradouro: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PerfilFamilia {
  responsavel: Responsavel;
  crianca: Crianca;
  /** Só os endereços efetivamente preenchidos, moradia primeiro. */
  enderecos: EnderecoFamilia[];
  moradia: EnderecoFamilia | null;
  trabalho: EnderecoFamilia | null;
  alternativo: EnderecoFamilia | null;
  grupamento?: Grupamento;
  turno?: Turno;
  anoProcesso: number;
  /** Pontuação da inscrição, quando já existe uma (classificação SME). */
  pontuacaoTotal: number | null;
  bolsaFamilia: 'sim' | 'nao' | 'nao_consultado';
}

/**
 * Placeholder gravado quando a família ainda não informou o bairro (e também usado nas
 * unidades sem endereço na fonte). NÃO é um bairro: comparar duas ocorrências dele daria
 * "mesmo bairro" entre um responsável sem endereço e uma creche sem endereço, produzindo
 * recomendação do outro lado da cidade — exatamente o R2 que o produto ataca.
 */
const BAIRRO_DESCONHECIDO = 'não informado';

function normalizarBairro(bairro: string | null | undefined): string | null {
  const limpo = bairro?.trim().toLowerCase();
  if (!limpo || limpo === BAIRRO_DESCONHECIDO) return null;
  return limpo;
}

function temCoordenada(e: EnderecoFamilia | null | undefined): e is EnderecoFamilia & Ponto {
  return e != null && e.latitude != null && e.longitude != null;
}

/**
 * Um endereço "existe" se tem coordenada OU bairro de verdade — sem nenhum dos dois não
 * há sinal territorial nenhum e ele só poluiria as distâncias com nulos.
 */
function montarEndereco(
  tipo: TipoEndereco,
  rotulo: string,
  dados: { bairro: string | null; logradouro: string | null; latitude: number | null; longitude: number | null }
): EnderecoFamilia | null {
  const bairro = normalizarBairro(dados.bairro) ? dados.bairro : null;
  if (dados.latitude == null && bairro == null) return null;
  return {
    tipo,
    rotulo,
    bairro,
    logradouro: dados.logradouro,
    latitude: dados.latitude,
    longitude: dados.longitude,
  };
}

export function montarPerfil(params: {
  responsavel: Responsavel;
  crianca: Crianca;
  grupamento?: Grupamento;
  turno?: Turno;
  anoProcesso: number;
  inscricaoId?: string;
}): PerfilFamilia {
  const r = params.responsavel;

  const moradia = montarEndereco('moradia', 'Moradia', {
    bairro: r.bairro,
    logradouro: r.logradouro,
    latitude: r.latitude,
    longitude: r.longitude,
  });
  const trabalho = montarEndereco('trabalho', 'Trabalho', {
    bairro: r.trabalho_bairro,
    logradouro: r.trabalho_logradouro,
    latitude: r.trabalho_latitude,
    longitude: r.trabalho_longitude,
  });
  const alternativo = montarEndereco('alternativo', 'Endereço alternativo', {
    bairro: r.alternativo_bairro,
    logradouro: r.alternativo_logradouro,
    latitude: r.alternativo_latitude,
    longitude: r.alternativo_longitude,
  });

  const pontuacao = params.inscricaoId
    ? (db
        .query('SELECT pontuacao_total FROM inscricao WHERE id = $id')
        .get({ $id: params.inscricaoId }) as { pontuacao_total: number | null } | null)
    : null;

  return {
    responsavel: r,
    crianca: params.crianca,
    enderecos: [moradia, trabalho, alternativo].filter((e) => e != null),
    moradia,
    trabalho,
    alternativo,
    grupamento: params.grupamento,
    turno: params.turno,
    anoProcesso: params.anoProcesso,
    pontuacaoTotal: pontuacao?.pontuacao_total ?? null,
    bolsaFamilia: r.bolsa_familia_status,
  };
}

/**
 * Grupamento elegível pela idade da criança na data de corte do processo (31/03 do ano,
 * como o calendário da SME). Reusa a régua de `criancas/service.ts` — a mesma que
 * `criarInscricao` aplica — para não existirem dois cortes de idade divergentes no
 * sistema. Serve pra avisar quando o grupamento pedido não bate com a idade; não
 * sobrescreve a escolha da família.
 */
export function grupamentoPorIdade(dataNascimento: string, anoProcesso: number): Grupamento | null {
  const nascimento = new Date(dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;
  return calcularGrupamentoPorIdade(dataNascimento, new Date(`${anoProcesso}-03-31`));
}

// ----------------------------------------------------------------------
// Distâncias multi-endereço

export interface DistanciasUnidade {
  moradiaKm: number | null;
  trabalhoKm: number | null;
  alternativoKm: number | null;
  alternativoRotulo: string | null;
  /** Menor distância entre todos os endereços cadastrados. */
  menorKm: number | null;
  enderecoMaisProximo: string | null;
  /** Km a mais por dia no trajeto casa→trabalho passando pela creche. */
  desvioRotaCasaTrabalhoKm: number | null;
  /** Afastamento lateral da linha casa→trabalho. */
  distanciaAteRotaKm: number | null;
  mesmoBairroMoradia: boolean;
  mesmoBairroTrabalho: boolean;
}

function distanciaSePossivel(origem: EnderecoFamilia | null, unidade: Ponto | null): number | null {
  if (!temCoordenada(origem) || !unidade) return null;
  return haversineKm(origem.latitude, origem.longitude, unidade.latitude, unidade.longitude);
}

export function calcularDistancias(
  perfil: PerfilFamilia,
  unidade: { bairro: string; latitude: number | null; longitude: number | null }
): DistanciasUnidade {
  const ponto: Ponto | null =
    unidade.latitude != null && unidade.longitude != null
      ? { latitude: unidade.latitude, longitude: unidade.longitude }
      : null;

  const moradiaKm = distanciaSePossivel(perfil.moradia, ponto);
  const trabalhoKm = distanciaSePossivel(perfil.trabalho, ponto);
  const alternativoKm = distanciaSePossivel(perfil.alternativo, ponto);

  const candidatos: Array<{ km: number; rotulo: string }> = [];
  if (moradiaKm != null) candidatos.push({ km: moradiaKm, rotulo: 'moradia' });
  if (trabalhoKm != null) candidatos.push({ km: trabalhoKm, rotulo: 'trabalho' });
  if (alternativoKm != null) candidatos.push({ km: alternativoKm, rotulo: 'alternativo' });
  const maisProximo = candidatos.sort((a, b) => a.km - b.km)[0] ?? null;

  const temRota = temCoordenada(perfil.moradia) && temCoordenada(perfil.trabalho) && ponto != null;

  // `normalizarBairro` devolve null pro placeholder "Não informado", então duas ausências
  // nunca contam como "mesmo bairro" — sem isso a família sem endereço casaria com as 128
  // unidades ativas que também estão sem bairro na fonte.
  const bairroUnidade = normalizarBairro(unidade.bairro);
  const mesmoBairro = (endereco: EnderecoFamilia | null) => {
    const bairroFamilia = normalizarBairro(endereco?.bairro);
    return bairroFamilia != null && bairroUnidade != null && bairroFamilia === bairroUnidade;
  };

  return {
    moradiaKm,
    trabalhoKm,
    alternativoKm,
    alternativoRotulo: alternativoKm != null ? (perfil.alternativo?.rotulo ?? null) : null,
    menorKm: maisProximo?.km ?? null,
    enderecoMaisProximo: maisProximo?.rotulo ?? null,
    desvioRotaCasaTrabalhoKm: temRota
      ? desvioDeRotaKm(perfil.moradia as Ponto, perfil.trabalho as Ponto, ponto!)
      : null,
    distanciaAteRotaKm: temRota
      ? distanciaAteRotaKm(perfil.moradia as Ponto, perfil.trabalho as Ponto, ponto!)
      : null,
    mesmoBairroMoradia: mesmoBairro(perfil.moradia),
    mesmoBairroTrabalho: mesmoBairro(perfil.trabalho),
  };
}

// ----------------------------------------------------------------------
// Disponibilidade: vagas atuais + histórico da Query A

export interface HistoricoUnidade {
  anosCobertos: number;
  inscricoesMediaAno: number;
  confirmadosMediaAno: number;
  vacanciaMediaAno: number;
  chanceHistoricaConvocacaoPct: number;
  taxaAbsorcaoPct: number;
  taxaVacanciaPct: number;
  candidatosPorVaga: number | null;
  classeDisponibilidade: 'baixa' | 'media' | 'alta';
  percentilNaRegiao: number;
  regiaoReferencia: string;
  classeNaCidade: 'baixa' | 'media' | 'alta';
}

export interface DisponibilidadeUnidade {
  vagasDisponiveis: number;
  capacidadeTotal: number;
  ocupacaoPct: number | null;
  historico: HistoricoUnidade | null;
}

const pct = (n: number) => Math.round(n * 1000) / 10;

export function consultarDisponibilidade(
  unidadeId: string,
  params: { anoProcesso: number; grupamento?: Grupamento; turno?: Turno }
): DisponibilidadeUnidade {
  const filtros: string[] = ['unidade_id = $unidadeId', 'ano_processo = $ano'];
  const args: Record<string, unknown> = { $unidadeId: unidadeId, $ano: params.anoProcesso };
  if (params.grupamento) {
    filtros.push('grupamento = $grupamento');
    args.$grupamento = params.grupamento;
  }
  if (params.turno) {
    filtros.push('turno = $turno');
    args.$turno = params.turno;
  }

  const vagas = db
    .query(
      `SELECT COALESCE(SUM(capacidade_total), 0) AS capacidade,
              COALESCE(SUM(vagas_ocupadas), 0)   AS ocupadas
       FROM vaga_config WHERE ${filtros.join(' AND ')}`
    )
    .get(args) as { capacidade: number; ocupadas: number };

  return {
    vagasDisponiveis: Math.max(0, vagas.capacidade - vagas.ocupadas),
    capacidadeTotal: vagas.capacidade,
    ocupacaoPct: vagas.capacidade > 0 ? pct(vagas.ocupadas / vagas.capacidade) : null,
    historico: consultarHistorico(unidadeId, params.grupamento, params.turno),
  };
}

/**
 * Sem grupamento/turno definidos, agrega o histórico da unidade inteira ponderando as
 * combinações pela demanda (inscrições) — o mesmo número que sairia de recontar a Query A
 * sem filtro. A classe (baixa/media/alta) vira a da combinação de maior demanda, que é a
 * que domina a experiência real de quem se inscreve ali.
 */
export function consultarHistorico(
  unidadeId: string,
  grupamento?: Grupamento,
  turno?: Turno
): HistoricoUnidade | null {
  const filtros = ['unidade_id = $unidadeId'];
  const args: Record<string, unknown> = { $unidadeId: unidadeId };
  if (grupamento) {
    filtros.push('grupamento = $grupamento');
    args.$grupamento = grupamento;
  }
  if (turno) {
    filtros.push('turno = $turno');
    args.$turno = turno;
  }

  const linhas = db
    .query(`SELECT * FROM unidade_disponibilidade WHERE ${filtros.join(' AND ')} ORDER BY inscricoes_media DESC`)
    .all(args) as Array<{
    anos_cobertos: number;
    inscricoes_media: number;
    confirmados_media: number;
    vacancia_media: number;
    taxa_oferta: number;
    taxa_absorcao: number;
    taxa_vacancia: number;
    concorrencia: number | null;
    regiao_referencia: string;
    percentil_regiao: number;
    classe_regiao: 'baixa' | 'media' | 'alta';
    classe_cidade: 'baixa' | 'media' | 'alta';
  }>;

  if (linhas.length === 0) return null;

  const pesoTotal = linhas.reduce((soma, l) => soma + l.inscricoes_media, 0) || 1;
  const ponderar = (campo: (l: (typeof linhas)[number]) => number) =>
    linhas.reduce((soma, l) => soma + campo(l) * l.inscricoes_media, 0) / pesoTotal;

  const dominante = linhas[0]!;
  const inscricoesMedia = linhas.reduce((s, l) => s + l.inscricoes_media, 0);
  const confirmadosMedia = linhas.reduce((s, l) => s + l.confirmados_media, 0);

  return {
    anosCobertos: Math.max(...linhas.map((l) => l.anos_cobertos)),
    inscricoesMediaAno: Math.round(inscricoesMedia * 10) / 10,
    confirmadosMediaAno: Math.round(confirmadosMedia * 10) / 10,
    vacanciaMediaAno: Math.round(linhas.reduce((s, l) => s + l.vacancia_media, 0) * 10) / 10,
    chanceHistoricaConvocacaoPct: pct(ponderar((l) => l.taxa_oferta)),
    taxaAbsorcaoPct: pct(ponderar((l) => l.taxa_absorcao)),
    taxaVacanciaPct: pct(ponderar((l) => l.taxa_vacancia)),
    candidatosPorVaga: confirmadosMedia > 0 ? Math.round((inscricoesMedia / confirmadosMedia) * 100) / 100 : null,
    classeDisponibilidade: dominante.classe_regiao,
    percentilNaRegiao: dominante.percentil_regiao,
    regiaoReferencia: dominante.regiao_referencia,
    classeNaCidade: dominante.classe_cidade,
  };
}

// ----------------------------------------------------------------------
// Chance estimada (determinística)

export interface ChanceEstimada {
  classe: 'baixa' | 'media' | 'alta';
  score: number;
  fatores: string[];
}

/**
 * Combina, com pesos fixos e auditáveis:
 *  - 60% chance histórica de convocação da unidade (Query A, 2021-2025);
 *  - 25% folga de vaga no ano corrente (vagas livres sobre a demanda média anual);
 *  - 15% prioridade da família na régua socioeconômica (R7/R28) — Bolsa Família e
 *    pontuação da inscrição, quando já respondida.
 *
 * É estimativa comparativa entre unidades, não previsão: a classificação real roda uma
 * vez por ano em batch (R6) sobre a fila inteira daquele processo.
 */
export function estimarChance(
  disponibilidade: DisponibilidadeUnidade,
  perfil: Pick<PerfilFamilia, 'pontuacaoTotal' | 'bolsaFamilia'>
): ChanceEstimada {
  const fatores: string[] = [];

  const historicoScore = disponibilidade.historico
    ? disponibilidade.historico.chanceHistoricaConvocacaoPct / 100
    : 0.35; // sem histórico, assume o meio da distribuição em vez de premiar ou punir
  if (disponibilidade.historico) {
    fatores.push(
      `${disponibilidade.historico.chanceHistoricaConvocacaoPct}% das inscrições nessa unidade foram convocadas nos últimos ${disponibilidade.historico.anosCobertos} processos`
    );
  } else {
    fatores.push('sem histórico de inscrição nessa unidade no dataset 2021-2025');
  }

  const demandaAnual = disponibilidade.historico?.inscricoesMediaAno ?? 0;
  const folga =
    demandaAnual > 0
      ? Math.min(1, disponibilidade.vagasDisponiveis / demandaAnual)
      : disponibilidade.vagasDisponiveis > 0
        ? 0.5
        : 0;
  fatores.push(
    `${disponibilidade.vagasDisponiveis} vaga(s) aberta(s) hoje` +
      (demandaAnual > 0 ? ` para uma demanda média de ${demandaAnual} inscrições/ano` : '')
  );

  let prioridade = 0;
  if (perfil.bolsaFamilia === 'sim') {
    prioridade += 0.6;
    fatores.push('família recebe Bolsa Família (pontua na régua socioeconômica)');
  }
  if (perfil.pontuacaoTotal != null && perfil.pontuacaoTotal > 0) {
    prioridade += Math.min(0.4, perfil.pontuacaoTotal / 100);
    fatores.push(`inscrição com ${perfil.pontuacaoTotal} pontos na classificação`);
  }

  const score = 0.6 * historicoScore + 0.25 * folga + 0.15 * Math.min(1, prioridade);
  const classe = score < 0.3 ? 'baixa' : score < 0.55 ? 'media' : 'alta';

  return { classe, score: Math.round(score * 100) / 100, fatores };
}

// ----------------------------------------------------------------------
// Candidatas enriquecidas

export interface CandidataEnriquecida {
  unidadeId: string;
  nome: string;
  bairro: string;
  tipoGestao: string;
  temCoordenada: boolean;
  distancias: DistanciasUnidade;
  disponibilidade: DisponibilidadeUnidade;
  chance: ChanceEstimada;
}

export type CriterioOrdenacao = 'moradia' | 'trabalho' | 'qualquer_endereco' | 'rota' | 'disponibilidade' | 'chance';

interface UnidadeRow {
  id: string;
  nome: string;
  bairro: string;
  tipo_gestao: string;
  latitude: number | null;
  longitude: number | null;
}

function ordenar(a: CandidataEnriquecida, b: CandidataEnriquecida, criterio: CriterioOrdenacao): number {
  const porKm = (valor: (c: CandidataEnriquecida) => number | null) => {
    const ka = valor(a);
    const kb = valor(b);
    // Unidade sem a distância pedida vai pro fim, mas continua na lista.
    if (ka == null && kb == null) return 0;
    if (ka == null) return 1;
    if (kb == null) return -1;
    return ka - kb;
  };

  switch (criterio) {
    case 'moradia':
      return porKm((c) => c.distancias.moradiaKm);
    case 'trabalho':
      return porKm((c) => c.distancias.trabalhoKm);
    case 'qualquer_endereco':
      return porKm((c) => c.distancias.menorKm);
    case 'rota':
      return porKm((c) => c.distancias.desvioRotaCasaTrabalhoKm);
    case 'disponibilidade':
      return b.disponibilidade.vagasDisponiveis - a.disponibilidade.vagasDisponiveis;
    case 'chance':
      return b.chance.score - a.chance.score;
  }
}

/**
 * Busca e enriquece candidatas. O filtro de raio é aplicado sobre a MENOR distância entre
 * todos os endereços da família — uma creche longe de casa mas colada no trabalho continua
 * sendo uma opção legítima, e é exatamente o caso que o matricula.rio hoje não enxerga.
 */
export function buscarCandidatas(
  perfil: PerfilFamilia,
  opcoes: { criterio?: CriterioOrdenacao; raioKm?: number; limite?: number } = {}
): CandidataEnriquecida[] {
  const { criterio = 'qualquer_endereco', raioKm = 6, limite = 10 } = opcoes;

  const unidades = db
    .query(
      `SELECT u.id, u.nome, u.bairro, u.tipo_gestao, u.latitude, u.longitude
       FROM unidade u WHERE u.ativa = 1`
    )
    .all() as UnidadeRow[];

  const enriquecidas = unidades.map<CandidataEnriquecida>((u) => {
    const distancias = calcularDistancias(perfil, u);
    const disponibilidade = consultarDisponibilidade(u.id, {
      anoProcesso: perfil.anoProcesso,
      grupamento: perfil.grupamento,
      turno: perfil.turno,
    });
    return {
      unidadeId: u.id,
      nome: u.nome,
      bairro: u.bairro,
      tipoGestao: u.tipo_gestao,
      temCoordenada: u.latitude != null && u.longitude != null,
      distancias,
      disponibilidade,
      chance: estimarChance(disponibilidade, perfil),
    };
  });

  const familiaTemCoordenada = perfil.enderecos.some((e) => e.latitude != null);
  const familiaTemBairro = perfil.enderecos.some((e) => normalizarBairro(e.bairro) != null);

  const comVaga = enriquecidas.filter((c) => c.disponibilidade.vagasDisponiveis > 0);

  if (familiaTemCoordenada) {
    return comVaga
      .filter((c) => c.distancias.menorKm != null && c.distancias.menorKm <= raioKm)
      .sort((a, b) => ordenar(a, b, criterio))
      .slice(0, limite);
  }

  if (familiaTemBairro) {
    // Sem geocodificação, o bairro é o único sinal territorial que resta.
    return comVaga
      .filter((c) => c.distancias.mesmoBairroMoradia || c.distancias.mesmoBairroTrabalho)
      .sort((a, b) => ordenar(a, b, criterio))
      .slice(0, limite);
  }

  // Nenhum sinal territorial: ordenar por "proximidade" aqui seria inventar uma ordem.
  // Devolve as de maior chance, e o agente avisa a família que falta endereço.
  return comVaga.sort((a, b) => ordenar(a, b, 'chance')).slice(0, limite);
}

export function getCandidata(perfil: PerfilFamilia, unidadeId: string): CandidataEnriquecida | null {
  const u = db
    .query('SELECT id, nome, bairro, tipo_gestao, latitude, longitude FROM unidade WHERE id = $id')
    .get({ $id: unidadeId }) as UnidadeRow | null;
  if (!u) return null;

  const distancias = calcularDistancias(perfil, u);
  const disponibilidade = consultarDisponibilidade(u.id, {
    anoProcesso: perfil.anoProcesso,
    grupamento: perfil.grupamento,
    turno: perfil.turno,
  });

  return {
    unidadeId: u.id,
    nome: u.nome,
    bairro: u.bairro,
    tipoGestao: u.tipo_gestao,
    temCoordenada: u.latitude != null && u.longitude != null,
    distancias,
    disponibilidade,
    chance: estimarChance(disponibilidade, perfil),
  };
}
