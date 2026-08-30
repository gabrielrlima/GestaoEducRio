import Anthropic from '@anthropic-ai/sdk';
import { criarFerramentasRecomendacao, type FerramentasContext, type RecomendacaoFinal } from './tools';
import { PROMPTS, PROMPT_PADRAO, type NomePrompt } from './prompts';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const MODELO = process.env.IA_MODELO ?? 'claude-haiku-4-5';
const TIMEOUT_MS = Number(process.env.IA_TIMEOUT_MS ?? 40_000);
const MAX_ITERACOES = 14;

export interface ResultadoAgente {
  recomendacao: RecomendacaoFinal;
  /** Telemetria usada pelo harness de avaliação; o endpoint ignora. */
  toolsChamadas: string[];
  duracaoMs: number;
}

/**
 * Roda o agente de recomendação (Tool Runner) com timeout curto. Retorna null se a API
 * não estiver configurada, falhar, ou expirar — o chamador (routes.ts) cai no fallback
 * determinístico nesse caso, então o endpoint nunca quebra por causa da IA.
 */
export async function recomendarComAgente(
  ctx: FerramentasContext,
  opcoes: {
    prompt?: NomePrompt;
    modelo?: string;
    onToolResult?: (nome: string, resultado: string) => void;
  } = {}
): Promise<ResultadoAgente | null> {
  if (!client) return null;

  const { tools, getResultadoFinal } = criarFerramentasRecomendacao(ctx, {
    onToolResult: opcoes.onToolResult,
  });
  const toolsChamadas: string[] = [];
  const inicio = Date.now();

  try {
    const runner = client.beta.messages.toolRunner({
      model: opcoes.modelo ?? MODELO,
      max_tokens: 4096,
      max_iterations: MAX_ITERACOES,
      system: PROMPTS[opcoes.prompt ?? PROMPT_PADRAO],
      tools,
      messages: [
        {
          role: 'user',
          content:
            'Monte a lista de até 5 unidades de creche para esta família, seguindo as regras de negócio.',
        },
      ],
    });

    // O runner é um async iterator: consumir mensagem a mensagem dá a telemetria de quais
    // tools o modelo escolheu — é o sinal que o eval usa pra comparar system prompts.
    const consumir = (async () => {
      for await (const mensagem of runner) {
        for (const bloco of mensagem.content) {
          if (bloco.type === 'tool_use') toolsChamadas.push(bloco.name);
        }
      }
    })();

    await Promise.race([
      consumir,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);

    const recomendacao = getResultadoFinal();
    if (!recomendacao) return null;

    return { recomendacao, toolsChamadas, duracaoMs: Date.now() - inicio };
  } catch (error) {
    console.warn('[ia] recomendarComAgente falhou, caindo no fallback:', (error as Error).message);
    // Timeout no meio do loop ainda pode ter passado por finalizar_recomendacao.
    const parcial = getResultadoFinal();
    if (parcial) return { recomendacao: parcial, toolsChamadas, duracaoMs: Date.now() - inicio };
    return null;
  }
}
