import Anthropic from '@anthropic-ai/sdk';
import { criarFerramentasRecomendacao, type FerramentasContext, type RecomendacaoFinal } from './tools';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const TIMEOUT_MS = 25000; // loop de várias tool calls (5 tools, até finalizar_recomendacao) mede ~15-20s na prática

const SYSTEM_PROMPT = `Você é o agente de recomendação de creches do GestaoEducRio (SME Rio de Janeiro).
Use as tools disponíveis para consultar o cadastro da família, buscar unidades candidatas, calcular
distâncias e conferir as regras de negócio antes de decidir — nunca responda de memória.
Baseie-se SOMENTE nos dados retornados pelas tools: nunca invente unidade, distância, vaga ou regra.
Encerre sempre chamando finalizar_recomendacao com o resultado final, mesmo que seja uma lista menor
que 5 unidades.`;

/**
 * Roda o agente de recomendação (Tool Runner: buscar_candidatas, calcular_distancia,
 * consultar_cadastro, consultar_regras, finalizar_recomendacao) com timeout curto.
 * Retorna null se a API não estiver configurada, falhar, ou expirar — o chamador
 * (routes.ts) cai no fallback determinístico nesse caso, então o endpoint nunca
 * quebra a demo por causa da IA.
 */
export async function recomendarComAgente(ctx: FerramentasContext): Promise<RecomendacaoFinal | null> {
  if (!client) return null;

  const { tools, getResultadoFinal } = criarFerramentasRecomendacao(ctx);

  try {
    await Promise.race([
      client.beta.messages.toolRunner({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools,
        messages: [
          {
            role: 'user',
            content: 'Recomende até 5 unidades de creche para esta família, seguindo as regras de negócio.',
          },
        ],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);

    return getResultadoFinal();
  } catch (error) {
    console.warn('[ia] recomendarComAgente falhou, caindo no fallback:', (error as Error).message);
    return null;
  }
}
