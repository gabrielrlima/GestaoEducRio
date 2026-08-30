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
}

const TIPOS_CRECHE_RELEVANTES = new Set(['Creche', 'Creche Parceira', 'EDI', 'CDEI']);

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
    });
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
  try {
    const xlsxBuffer = await Bun.file(UNIDADES_XLSX_PATH).arrayBuffer();
    geoMap = parseGeolocalizacoes(xlsxBuffer);
    console.log(`[seed-unidades] ${geoMap.size} unidades geocodificadas na planilha complementar`);
  } catch (error) {
    console.warn('[seed-unidades] planilha de geolocalização não encontrada, seguindo sem lat/long:', (error as Error).message);
  }

  const contarPorTipo: Record<string, number> = {};
  let comLatLong = 0;

  const inserir = db.query(
    `INSERT OR IGNORE INTO unidade
       (id, esc_codigo, nome, tipo_gestao, tipo_origem_raw, cre, logradouro, numero, complemento, bairro, cep, latitude, longitude)
     VALUES ($id, $escCodigo, $nome, $tipoGestao, $tipoOrigemRaw, $cre, $logradouro, $numero, $complemento, $bairro, $cep, $latitude, $longitude)`
  );

  const transacao = db.transaction(() => {
    for (const unidade of unidades) {
      contarPorTipo[unidade.tipoGestao] = (contarPorTipo[unidade.tipoGestao] ?? 0) + 1;
      const geo = geoMap.get(normalizeUnitCode(unidade.escCodigo));
      if (geo) comLatLong++;

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
        $bairro: unidade.bairro,
        $cep: unidade.cep,
        $latitude: geo?.latitude ?? null,
        $longitude: geo?.longitude ?? null,
      });
    }
  });
  transacao();

  console.log('[seed-unidades] importação concluída:', { total: unidades.length, comLatLong, contarPorTipo });
}

await main();
