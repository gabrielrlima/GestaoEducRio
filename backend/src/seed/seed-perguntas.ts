import { randomUUID } from 'node:crypto';
import { db } from '../db/client';

/**
 * Popula `pergunta` a partir da Query C oficial (perguntas do questionário
 * socioeconômico usado no ranqueamento/R8). Usa só o ano mais recente
 * (2025) — o CSV tem uma linha por pergunta×ano e não podemos misturar anos
 * na pontuação (R28). `perg_criterio='Sim'` marca pergunta de desempate
 * (pontuacao=0, só usada pra desempatar, não soma na nota).
 */
const DADOS_DIR = process.env.DADOSCRECHE_DIR ?? '../data/dadoscreche';
const QUERY_C_PATH = `${DADOS_DIR}/Bases IC_ ClassificadoseFila/03_QueryC_PerguntasComDescricao.csv`;
const ANO_PROCESSO = Number(process.env.ANO_PROCESSO_SEED ?? new Date().getFullYear());
const ANO_PERGUNTAS = 2025; // ano mais recente disponível na Query C

async function main() {
  console.log('[seed-perguntas] lendo Query C:', QUERY_C_PATH);
  const buffer = await Bun.file(QUERY_C_PATH).arrayBuffer();
  const texto = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
  const linhas = texto.split('\n').filter((l) => l.trim().length > 0);

  const inserir = db.query(
    `INSERT INTO pergunta (id, ano_processo, texto, pontuacao, criterio_desempate, ordem)
     VALUES ($id, $anoProcesso, $texto, $pontuacao, $criterioDesempate, $ordem)`
  );

  let inseridas = 0;
  const transacao = db.transaction(() => {
    db.query('DELETE FROM pergunta WHERE ano_processo = $ano').run({ $ano: ANO_PROCESSO });

    for (let i = 1; i < linhas.length; i++) {
      const campos = linhas[i]?.split(';') ?? [];
      const [ano, , , , perguntaTexto, , ordem, pontuacao, criterio] = campos;
      if (!perguntaTexto || Number(ano) !== ANO_PERGUNTAS) continue;

      inserir.run({
        $id: randomUUID(),
        $anoProcesso: ANO_PROCESSO,
        $texto: perguntaTexto.replace(/^"|"$/g, '').trim(),
        $pontuacao: Number(pontuacao) || 0,
        $criterioDesempate: criterio?.trim() === 'Sim' ? 1 : 0,
        $ordem: Number(ordem) || null,
      });
      inseridas++;
    }
  });
  transacao();

  console.log(`[seed-perguntas] ${inseridas} perguntas inseridas pro ano_processo ${ANO_PROCESSO} (fonte: Query C ${ANO_PERGUNTAS})`);
}

await main();
