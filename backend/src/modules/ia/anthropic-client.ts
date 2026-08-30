import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

interface CandidataParaIa {
  unidadeId: string;
  nome: string;
  distanciaKm: number | null;
  mesmoBairro: boolean;
  vagasDisponiveis: number;
}

export interface RecomendacaoIa {
  resumo: string;
  recomendacoes: Array<{ unidadeId: string; porque: string }>;
}

const RECOMENDACAO_TOOL = {
  name: 'recomendar_unidades',
  description: 'Retorna a recomendação estruturada de unidades de creche para a família.',
  input_schema: {
    type: 'object' as const,
    properties: {
      resumo: { type: 'string' as const, description: 'Resumo curto orientando a família' },
      recomendacoes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            unidadeId: { type: 'string' as const },
            porque: { type: 'string' as const, description: 'Até 280 caracteres, cite só números fornecidos' },
          },
          required: ['unidadeId', 'porque'],
        },
      },
    },
    required: ['resumo', 'recomendacoes'],
  },
};

const TIMEOUT_MS = 2500;

/**
 * Chama a Claude API para explicar a recomendação em linguagem natural, com
 * timeout curto. Retorna null se a API não estiver configurada, falhar, ou
 * expirar — o chamador (routes.ts) cai no fallback determinístico nesse caso,
 * então o endpoint nunca quebra a demo por causa da IA.
 */
export async function recomendarComIa(candidatas: CandidataParaIa[]): Promise<RecomendacaoIa | null> {
  if (!client || candidatas.length === 0) return null;

  try {
    const response = await Promise.race([
      client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system:
          'Você ajuda famílias do Rio de Janeiro a entender por que cada creche foi recomendada, priorizando proximidade e chance real de vaga. Use SOMENTE os números fornecidos no payload — nunca invente distância, vaga ou unidade fora da lista fornecida.',
        messages: [
          {
            role: 'user',
            content: `Candidatas (JSON): ${JSON.stringify(candidatas)}`,
          },
        ],
        tools: [RECOMENDACAO_TOOL],
        tool_choice: { type: 'tool', name: 'recomendar_unidades' },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return null;

    return toolUse.input as RecomendacaoIa;
  } catch (error) {
    console.warn('[ia] recomendarComIa falhou, caindo no fallback:', (error as Error).message);
    return null;
  }
}
