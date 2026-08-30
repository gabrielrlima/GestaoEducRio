import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { db } from '../db/client';
import { normalizeUnitCode } from '../lib/geo';
import type { TipoGestao } from '../modules/unidades/types';

const DADOS_DIR = process.env.DADOSCRECHE_DIR ?? '../data/dadoscreche';
const QUERY_D_PATH = `${DADOS_DIR}/Bases IC_ ClassificadoseFila/04_UnidadesEscolaresComEndereco.csv`;
const UNIDADES_XLSX_PATH = `${DADOS_DIR}/OferecimentosEvagas/Unidades_Unificadas_com_Localizacao.xlsx`;

/**
 * Mapeamento de tipo_gestao NÃO usa o código bruto `tipo` da Query D — checamos
 * (contagem por tipo × prefixo de nome) e o código 1/3/4 não correlaciona com
 * gestão: o prefixo "CP" (confirmado como "Creche Parceira" cruzando com as
 * planilhas Parceiras20XX.xlsx) aparece distribuído nos 3 valores de `tipo`
 * quase na mesma proporção — ou seja, esse campo mede outra coisa (situação?
 * categoria escolar? não documentado). Preservamos o valor bruto em
 * `tipo_origem_raw` só para auditoria futura, não para derivar tipo_gestao.
 *
 * Em vez disso, usamos o PREFIXO DO NOME: unidades "CP ..." → Parceria
 * (grounded: mesmo nome aparece como "Creche Parceira" nas planilhas
 * complementares). Não temos sinal confiável pra distinguir "Conveniada" de
 * "Direta" no dado disponível — dado que o documento oficial cita só 10
 * conveniadas contra 855 diretas (das 872 com inscrição real), agrupamos as
 * duas como "Direta" por simplicidade, documentando essa aproximação aqui.
 */
function mapTipoGestao(nome: string): TipoGestao {
  return /^"?CP\s/i.test(nome) ? 'Parceria' : 'Direta';
}

interface UnidadeSeed {
  escCodigo: string;
  nome: string;
  tipoGestao: TipoGestao;
  tipoOrigemRaw: number;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  cep: string | null;
}

function parseQueryD(csvText: string): UnidadeSeed[] {
  const linhas = csvText.split('\n').filter((l) => l.trim().length > 0);
  const unidades: UnidadeSeed[] = [];

  for (const linha of linhas) {
    const campos = linha.split(';').map((c) => c.trim());
    const [, escCodigo, nome, tipoStr, logradouro, numero, complemento, bairro, cep] = campos;

    if (!nome) continue;

    const tipoRaw = Number(tipoStr) || 0;
    const nullify = (v: string | undefined) => (!v || v === 'NULL' ? null : v);

    unidades.push({
      escCodigo: nullify(escCodigo) ?? randomUUID(),
      nome,
      tipoGestao: mapTipoGestao(nome),
      tipoOrigemRaw: tipoRaw,
      logradouro: nullify(logradouro),
      numero: nullify(numero),
      complemento: nullify(complemento),
      bairro: nullify(bairro) ?? 'Não informado',
      cep: nullify(cep),
    });
  }

  return unidades;
}

interface Geolocalizacao {
  codigoNormalizado: string;
  latitude: number;
  longitude: number;
  cre: number | null;
  bairro: string | null;
}

const TIPOS_CRECHE_RELEVANTES = new Set(['Creche', 'Creche Parceira', 'EDI', 'CDEI']);

/**
 * Higienização — o `unidade` importava TODAS as ~2.188 linhas da Query D sem
 * filtro, incluindo modalidades que não são creche (Escola Municipal regular,
 * CIEP, CEJA etc. — a Query D não é só "creches e EDIs" como o dicionário
 * oficial sugere, na prática ela cobre a rede toda). O front deve mostrar só
 * creche. Fonte de verdade: coluna `Tipo` da planilha
 * `Unidades_Unificadas_com_Localizacao.xlsx` (sem o filtro que
 * `parseGeolocalizacoes` já aplica) — pra unidades que não aparecem lá
 * (nem como creche nem como outra coisa), cai num heurístico por prefixo do
 * nome. Ver docs/desafio/higienizacao-creches.md.
 */
function parseTodosOsTipos(buffer: ArrayBuffer): Map<string, string> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['Unidades_Unificadas'];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const map = new Map<string, string>();
  for (const row of rows) {
    const designacao = row.DESIGNACAO;
    const tipo = row.Tipo;
    if (designacao == null || !tipo) continue;
    map.set(normalizeUnitCode(String(designacao)), String(tipo));
  }
  return map;
}

const PREFIXOS_CRECHE = /^"?(CP|EDI|CM|CC|CDEI)\s/i;
const NOME_CONTEM_CRECHE = /creche/i;
const PREFIXOS_NAO_CRECHE = /^"?(EM|EEM|CEM|CE|CIEP|CEJA)\s/i;

/**
 * Decide se uma unidade é creche quando ela não aparece na planilha (nem
 * como creche, nem como outra coisa) — heurístico por prefixo do nome,
 * validado manualmente contra o Censo Escolar do INEP pra uma amostra (ver
 * docs/desafio/higienizacao-creches.md). Onde há dúvida real, prefere
 * excluir (falso negativo é mais barato de corrigir via curadoria manual
 * do que poluir a lista de creches com escola regular).
 */
function pareceCreche(nome: string): boolean {
  if (PREFIXOS_CRECHE.test(nome) || NOME_CONTEM_CRECHE.test(nome)) return true;
  if (PREFIXOS_NAO_CRECHE.test(nome)) return false;
  return false;
}

function parseGeolocalizacoes(buffer: ArrayBuffer): Map<string, Geolocalizacao> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['Unidades_Unificadas'];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const map = new Map<string, Geolocalizacao>();
  for (const row of rows) {
    const tipo = String(row.Tipo ?? '');
    if (!TIPOS_CRECHE_RELEVANTES.has(tipo)) continue;

    const designacao = row.DESIGNACAO;
    const lat = Number(row.LATITUDE);
    const lng = Number(row.LONGITUDE);
    if (designacao == null || Number.isNaN(lat) || Number.isNaN(lng)) continue;

    const codigoNormalizado = normalizeUnitCode(String(designacao));
    map.set(codigoNormalizado, {
      codigoNormalizado,
      latitude: lat,
      longitude: lng,
      cre: row.CRE != null ? Number(row.CRE) : null,
      bairro: row.BAIRRO != null ? String(row.BAIRRO).trim() : null,
    });
  }
  return map;
}

/**
 * Higienização de dados — ~210 unidades (≈10%) vêm da Query D sem bairro
 * (endereço vazio na fonte). A aba `Unidades_Unificadas` (acima) só cobre
 * geolocalização de unidades de creche; esta segunda aba da mesma planilha
 * (`Planilha1`, sem lat/long, mas com bairro) cobre um conjunto de códigos
 * parcialmente diferente — usada aqui só como fallback de bairro pras
 * unidades que o `parseGeolocalizacoes` não encontrou. Ver
 * docs/desafio/higienizacao-bairro.md para a estratégia completa e o que
 * fica de fora (fica só "Não informado", requer curadoria manual via
 * PATCH /unidades/:id).
 */
function parseBairrosPlanilha1(buffer: ArrayBuffer): Map<string, string> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['Planilha1'];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const map = new Map<string, string>();
  for (const row of rows) {
    const designacao = row['Designação'];
    const bairro = row['Bairro'];
    if (designacao == null || !bairro) continue;
    map.set(normalizeUnitCode(String(designacao)), String(bairro).trim());
  }
  return map;
}

async function main() {
  console.log('[seed-unidades] lendo Query D:', QUERY_D_PATH);
  const csvBuffer = await Bun.file(QUERY_D_PATH).arrayBuffer();
  const csvText = new TextDecoder('utf-8').decode(csvBuffer).replace(/^﻿/, '');
  const unidades = parseQueryD(csvText);
  console.log(`[seed-unidades] ${unidades.length} unidades encontradas na Query D`);

  let geoMap = new Map<string, Geolocalizacao>();
  let bairroFallbackMap = new Map<string, string>();
  let tipoMap = new Map<string, string>();
  try {
    const xlsxBuffer = await Bun.file(UNIDADES_XLSX_PATH).arrayBuffer();
    geoMap = parseGeolocalizacoes(xlsxBuffer);
    bairroFallbackMap = parseBairrosPlanilha1(xlsxBuffer);
    tipoMap = parseTodosOsTipos(xlsxBuffer);
    console.log(`[seed-unidades] ${geoMap.size} unidades geocodificadas na planilha complementar`);
    console.log(`[seed-unidades] ${bairroFallbackMap.size} unidades com bairro na aba Planilha1 (fallback)`);
    console.log(`[seed-unidades] ${tipoMap.size} unidades com Tipo classificado na planilha`);
  } catch (error) {
    console.warn('[seed-unidades] planilha de geolocalização não encontrada, seguindo sem lat/long:', (error as Error).message);
  }

  const contarPorTipo: Record<string, number> = {};
  let comLatLong = 0;
  let bairroRecuperado = 0;
  const SEM_BAIRRO = 'Não informado';
  const contarAtivacao = { crechePlanilha: 0, naoCrechePlanilha: 0, crecheHeuristico: 0, naoCrecheHeuristico: 0 };

  const inserir = db.query(
    `INSERT OR IGNORE INTO unidade
       (id, esc_codigo, nome, tipo_gestao, tipo_origem_raw, cre, logradouro, numero, complemento, bairro, cep, latitude, longitude, ativa)
     VALUES ($id, $escCodigo, $nome, $tipoGestao, $tipoOrigemRaw, $cre, $logradouro, $numero, $complemento, $bairro, $cep, $latitude, $longitude, $ativa)`
  );

  const transacao = db.transaction(() => {
    for (const unidade of unidades) {
      contarPorTipo[unidade.tipoGestao] = (contarPorTipo[unidade.tipoGestao] ?? 0) + 1;
      const codigoNormalizado = normalizeUnitCode(unidade.escCodigo);
      const geo = geoMap.get(codigoNormalizado);
      if (geo) comLatLong++;

      // Higienização: quando a Query D não trouxe bairro, tenta recuperar
      // cruzando por esc_codigo com a planilha complementar (Camada 1:
      // Unidades_Unificadas com bairro; Camada 2: Planilha1) — ver
      // docs/desafio/higienizacao-bairro.md.
      let bairroFinal = unidade.bairro;
      if (bairroFinal === SEM_BAIRRO) {
        const bairroRecuperadoValor = geo?.bairro ?? bairroFallbackMap.get(codigoNormalizado);
        if (bairroRecuperadoValor) {
          bairroFinal = bairroRecuperadoValor;
          bairroRecuperado++;
        }
      }

      // Higienização: só creche/EDI/CDEI/Creche Parceira ficam ativas (o
      // front só deve listar creche) — ver docs/desafio/higienizacao-creches.md.
      const tipoPlanilha = tipoMap.get(codigoNormalizado);
      let ativa: 0 | 1;
      if (tipoPlanilha) {
        ativa = TIPOS_CRECHE_RELEVANTES.has(tipoPlanilha) ? 1 : 0;
        if (ativa) contarAtivacao.crechePlanilha++;
        else contarAtivacao.naoCrechePlanilha++;
      } else {
        ativa = pareceCreche(unidade.nome) ? 1 : 0;
        if (ativa) contarAtivacao.crecheHeuristico++;
        else contarAtivacao.naoCrecheHeuristico++;
      }

      inserir.run({
        $id: randomUUID(),
        $escCodigo: unidade.escCodigo,
        $nome: unidade.nome,
        $tipoGestao: unidade.tipoGestao,
        $tipoOrigemRaw: unidade.tipoOrigemRaw,
        $cre: geo?.cre ?? null,
        $logradouro: unidade.logradouro,
        $numero: unidade.numero,
        $complemento: unidade.complemento,
        $bairro: bairroFinal,
        $cep: unidade.cep,
        $latitude: geo?.latitude ?? null,
        $longitude: geo?.longitude ?? null,
        $ativa: ativa,
      });
    }
  });
  transacao();

  const semBairroAntes = unidades.filter((u) => u.bairro === SEM_BAIRRO).length;
  const totalAtivas = contarAtivacao.crechePlanilha + contarAtivacao.crecheHeuristico;
  const totalInativas = contarAtivacao.naoCrechePlanilha + contarAtivacao.naoCrecheHeuristico;
  console.log('[seed-unidades] importação concluída:', { total: unidades.length, comLatLong, contarPorTipo });
  console.log('[seed-unidades] higienização de bairro:', {
    semBairroNaFonte: semBairroAntes,
    recuperadosViaPlanilha: bairroRecuperado,
    aindaSemBairro: semBairroAntes - bairroRecuperado,
  });
  console.log('[seed-unidades] higienização de tipo (só creche fica ativa):', {
    ...contarAtivacao,
    totalAtivas,
    totalInativas,
  });
}

await main();
