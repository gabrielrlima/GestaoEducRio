import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { db } from '../db/client';
import { normalizeUnitCode } from '../lib/geo';
import type { TipoGestao } from '../modules/unidades/types';

const DADOS_DIR = process.env.DADOSCRECHE_DIR ?? '../data/dadoscreche';
const QUERY_D_PATH = `${DADOS_DIR}/Bases IC_ ClassificadoseFila/04_UnidadesEscolaresComEndereco.csv`;
const UNIDADES_XLSX_PATH = `${DADOS_DIR}/OferecimentosEvagas/Unidades_Unificadas_com_Localizacao.xlsx`;
const INEP_CSV_PATH = process.env.INEP_CSV_PATH ?? '../data/inep/escolas-rio-censo.csv';

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

interface InepRow {
  nomeOriginal: string;
  codigoEmbutido: string | null;
  bairro: string | null;
}

/**
 * Higienização — Camada 3 de recuperação de bairro (última, mais arriscada).
 * O Censo Escolar do INEP (CSV baixado manualmente pelo usuário, filtrado
 * pro Rio) não compartilha nenhum ID com nosso `esc_codigo` de forma
 * confiável pras ~128 unidades que ainda faltam depois das Camadas 1+2 —
 * testado: código embutido no nome (`"0918802 EDI ..."` / `"05006 - ..."`)
 * bate 1:1 com `esc_codigo` quando a unidade JÁ tem bairro preenchido, mas
 * dá **zero** match pras que faltam (não estão censadas, provavelmente
 * conveniadas pequenas). Fallback: casar pelo "núcleo" do nome (sem
 * prefixo/tipo/código) — só aceita se o núcleo for único na base do INEP E
 * (quando ambos os lados têm código numérico) os códigos não colidirem, pra
 * evitar o mesmo tipo de falso-positivo por nome que descartamos com
 * Nominatim (ver docs/desafio/higienizacao-bairro.md).
 */
function normalizarNucleoNome(nome: string): string {
  let n = nome.toUpperCase();
  n = n.normalize('NFD').replace(/[̀-ͯ]/g, '');
  n = n.replace(/^\d{2,7}\s*-?\s*/, '');
  n = n.replace(
    /^"?(CM|CP|CC|CDEI|EDI|EM|EEM|CEM|CE|CIEP|CEJA|CRECHE MUNICIPAL|CRECHE PARCEIRA|CRECHE COMUNITARIA|CRECHE|ESCOLA MUNICIPAL|ESCOLA ESTADUAL|COLEGIO MUNICIPAL|ESPACO DE DESENVOLVIMENTO INFANTIL|ASSOCIACAO)\s+/,
    ''
  );
  n = n.replace(/\(DUPLICAD[AO]\)/g, '');
  n = n.replace(/[^A-Z0-9\s]/g, ' ');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

function extrairCodigoEmbutido(nomeOriginal: string): string | null {
  const m = nomeOriginal.match(/^(\d{2,7})\s*-?\s+/);
  return m ? m[1] : null;
}

function extrairBairroDeEndereco(endereco: string): string | null {
  const semCep = endereco.split(/\d{5}-\d{3}/)[0];
  if (!semCep) return null;
  const semPonto = semCep.replace(/\.\s*$/, '').trim();
  if (!semPonto) return null;
  const partes = semPonto.split('.').map((p) => p.trim()).filter(Boolean);
  if (partes.length >= 2) return partes[partes.length - 1];
  const m = partes[0]?.match(/,\s*(?:S\/?N\.?|\d+[A-Z]?)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function parseCsvLine(linha: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (entreAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else entreAspas = false;
      } else atual += c;
    } else if (c === '"') entreAspas = true;
    else if (c === ',') {
      campos.push(atual);
      atual = '';
    } else atual += c;
  }
  campos.push(atual);
  return campos;
}

function parseInepPorNucleo(csvText: string): Map<string, InepRow[]> {
  const linhas = csvText.split('\n').filter((l) => l.trim().length > 0);
  const cabecalho = parseCsvLine(linhas[0]).map((c) => c.trim());
  const idxEscola = cabecalho.indexOf('Escola');
  const idxEndereco = cabecalho.indexOf('Endereço');
  const idxMunicipio = cabecalho.indexOf('Município');

  const porNucleo = new Map<string, InepRow[]>();
  for (let i = 1; i < linhas.length; i++) {
    const campos = parseCsvLine(linhas[i]);
    if (campos.length < cabecalho.length) continue;
    if (campos[idxMunicipio]?.trim() !== 'Rio de Janeiro') continue;

    const nomeOriginal = campos[idxEscola]?.trim() ?? '';
    const endereco = campos[idxEndereco]?.trim() ?? '';
    const nucleo = normalizarNucleoNome(nomeOriginal);
    if (!nucleo) continue;

    const row: InepRow = {
      nomeOriginal,
      codigoEmbutido: extrairCodigoEmbutido(nomeOriginal),
      bairro: extrairBairroDeEndereco(endereco),
    };
    const arr = porNucleo.get(nucleo) ?? [];
    arr.push(row);
    porNucleo.set(nucleo, arr);
  }
  return porNucleo;
}

/**
 * Só aceita o match se for único (núcleo não ambíguo) e, quando os dois
 * lados têm código numérico, eles baterem — descarta match único mas com
 * código conflitante (achado real: "CM PINTANDO O SETE" [0918612] batia
 * por nome com "EDI PINTANDO O SETE" [0918802] no INEP — unidades
 * diferentes, mesmo nome popular).
 */
function resolverBairroPorNucleo(
  nomeUnidade: string,
  escCodigo: string,
  porNucleo: Map<string, InepRow[]>
): string | null {
  const candidatos = porNucleo.get(normalizarNucleoNome(nomeUnidade));
  if (!candidatos || candidatos.length !== 1) return null;

  const candidato = candidatos[0];
  const codigoNossoENumerico = /^\d+$/.test(escCodigo);
  if (candidato.codigoEmbutido && codigoNossoENumerico && candidato.codigoEmbutido !== escCodigo) {
    return null;
  }
  return candidato.bairro;
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

  let inepPorNucleo = new Map<string, InepRow[]>();
  try {
    const inepBuffer = await Bun.file(INEP_CSV_PATH).arrayBuffer();
    const inepText = new TextDecoder('utf-8').decode(inepBuffer).replace(/^﻿/, '');
    inepPorNucleo = parseInepPorNucleo(inepText);
    console.log(`[seed-unidades] ${inepPorNucleo.size} núcleos de nome únicos no Censo Escolar do INEP (Rio)`);
  } catch (error) {
    console.warn('[seed-unidades] CSV do Censo Escolar (INEP) não encontrado, pulando Camada 3 de bairro:', (error as Error).message);
  }

  const contarPorTipo: Record<string, number> = {};
  let comLatLong = 0;
  let bairroRecuperado = 0;
  let bairroRecuperadoInep = 0;
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
      if (bairroFinal === SEM_BAIRRO) {
        const bairroInep = resolverBairroPorNucleo(unidade.nome, unidade.escCodigo, inepPorNucleo);
        if (bairroInep) {
          bairroFinal = bairroInep;
          bairroRecuperadoInep++;
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
    recuperadosViaInep: bairroRecuperadoInep,
    aindaSemBairro: semBairroAntes - bairroRecuperado - bairroRecuperadoInep,
  });
  console.log('[seed-unidades] higienização de tipo (só creche fica ativa):', {
    ...contarAtivacao,
    totalAtivas,
    totalInativas,
  });
}

await main();
