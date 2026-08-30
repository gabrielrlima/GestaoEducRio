# Agente de Recomendação de Unidades

> Como funciona o `POST /api/ia/recomendar-unidades` — o papel da IA dentro do produto. Código em `backend/src/modules/ia/`. Ver `CLAUDE.md` § Decisões para o enquadramento no desafio (Eixo 2, regras R2 e R10).

## O problema, no dado

Mais da metade das 837.179 opções de inscrição de 2021-2025 termina em cancelamento (`Cancelado pelo sistema` 39% + `Cancelado na confirmacao` 14,2%). A família escolhe 5 unidades numa lista sem nenhum critério territorial (**R2**) e a distância não entra na classificação (**R10**) — quem é convocado para uma vaga longe de casa e do trabalho simplesmente não assume. O agente existe para montar uma lista que a família consiga usar.

## Separação: cálculo determinístico vs. escolha da IA

Regra de projeto: **a IA não calcula nada**. Todo número mora em `features.ts` (distâncias, rota, vagas, histórico, chance) e o modelo só escolhe entre candidatas e escreve a explicação. Consequências:

- o mesmo motor alimenta o agente e o fallback sem IA (`fallback.ts`), então a qualidade dos **dados** não depende da API responder;
- todo número que aparece na tela é auditável até uma linha do banco;
- o harness de avaliação consegue checar *grounding* comparando os números do texto contra as respostas de tool.

## Fontes de dado

| Sinal | Origem | Onde |
|---|---|---|
| Coordenadas da unidade | `Unidades_Unificadas_com_Localizacao.xlsx` | `unidade.latitude/longitude` |
| Coordenadas da família | Nominatim, no cadastro de cada endereço | `responsavel.{,trabalho_,alternativo_}latitude/longitude` |
| Vagas do ano corrente | reais onde a fonte tem (`Parceiras2025.xlsx`); estimadas por `Turma × 24,67` nas diretas — ver `seed-vagas-real.ts` | `vaga_config` |
| Histórico de convocação e vacância | **Query A**, 837k linhas, 2021-2025 | `unidade_historico` → `unidade_disponibilidade` |

O seed `src/seed/seed-historico.ts` lê a Query A em streaming (~3s) e casa 100% das chaves com o cadastro: 8.422 linhas de histórico, 2.576 combinações unidade × grupamento × turno, cobrindo as 872 unidades que tiveram inscrição real.

## Métricas históricas

Todas por unidade × grupamento × turno, agregando os 5 processos:

- **`taxa_oferta`** = `(confirmados + cancelados na confirmação) / inscrições` — de cada 100 inscrições, quantas chegaram a receber a oferta de uma vaga. É a resposta literal a "qual a chance de eu ser chamada aqui?", e é o **índice de disponibilidade**.
- **`taxa_absorcao`** = `confirmados / inscrições` — quantas viraram matrícula de fato.
- **`taxa_vacancia`** = `cancelados na confirmação / (confirmados + cancelados na confirmação)` — a **vacância histórica**: vaga ofertada que vagou porque a família não confirmou. É o problema R2 aparecendo diretamente no dado.
- **`concorrencia`** = `inscrições / confirmados` — candidatos por vaga preenchida.

Escolhemos uma métrica única e literal como índice em vez de um score ponderado porque cada número que o agente cita precisa ser explicável em uma frase.

### Classificação em tercis (baixa / média / alta)

Determinística, calculada no seed: dentro de cada **grupamento × turno**, as unidades são ordenadas por `taxa_oferta` e cortadas em tercis. A comparação é **dentro do bairro** quando o bairro tem ao menos 6 unidades naquele grupamento/turno; senão cai para o ranking da cidade (o campo `regiao_referencia` registra qual foi usado). Isso importa: 40% de chance pode ser excelente num bairro disputado e medíocre em outro — dizer "alta disponibilidade" sem uma referência regional seria enganoso.

## Endereços múltiplos

Os três endereços (**moradia**, **trabalho**, **alternativo**) são colunas de `responsavel` — `bairro`/`logradouro`/`numero`/`cep`/`complemento` e `latitude`/`longitude` para cada um, todos geocodificados por Nominatim em `updateResponsavel`. `montarPerfil` normaliza os três numa lista `EnderecoFamilia` e descarta os que não têm nem coordenada nem bairro.

> Esta branch chegou a ter uma tabela `endereco_responsavel` (que permitia N alternativos com rótulo livre) antes de a `main` resolver o mesmo problema com colunas. Ficamos com o modelo da `main`, que já tinha UI no portal; o `migrate.ts` derruba a tabela órfã.

**`'Não informado'` não é um bairro.** É o placeholder gravado quando a família não informou endereço — e também o de 128 unidades ativas sem endereço na fonte. Comparar as duas ocorrências como texto daria "mesmo bairro" entre uma família sem endereço e creches espalhadas pela cidade, produzindo exatamente o R2 que o produto ataca. `normalizarBairro` mapeia o placeholder para `null`, e sem nenhum sinal territorial `buscarCandidatas` ordena por chance de vaga em vez de fingir proximidade — com o agente obrigado a avisar a família disso em `alertas`.

Para cada unidade, `calcularDistancias` produz:

- distância de casa, do trabalho e do alternativo;
- `menorKm` + qual endereço é o mais próximo (o filtro de raio usa este, não a moradia: uma creche longe de casa mas colada no trabalho é uma opção legítima que o matricula.rio hoje não enxerga);
- **`desvioRotaCasaTrabalhoKm`** = `d(casa,creche) + d(creche,trabalho) − d(casa,trabalho)` — quanto a família andaria a mais **por dia** passando pela creche. Responde "essa creche fica no meu caminho?" melhor que qualquer distância isolada;
- **`distanciaAteRotaKm`** — afastamento lateral da linha casa→trabalho (projeção ponto-segmento num plano local em km; o erro da aproximação equirretangular na escala do município é desprezível).

## Chance estimada

`estimarChance` combina, com pesos fixos e auditáveis: 60% chance histórica de convocação + 25% folga de vaga no ano corrente (vagas livres sobre a demanda média anual) + 15% prioridade socioeconômica (Bolsa Família, pontuação da inscrição). É comparativa entre unidades, **não previsão** — a classificação real roda uma vez por ano em batch sobre a fila inteira (R6).

## As 7 tools

| Tool | Para quê |
|---|---|
| `consultar_perfil_familia` | Endereços cadastrados, criança, grupamento elegível pela idade, sinais de prioridade |
| `buscar_candidatas` | Candidatas com vaga, enriquecidas; `criterio` = moradia \| trabalho \| qualquer_endereco \| rota \| disponibilidade \| chance |
| `unidades_no_caminho` | Unidades no trajeto casa→trabalho, ordenadas por desvio diário |
| `detalhar_unidades` | Ficha completa lado a lado de até 5 finalistas |
| `classificar_disponibilidade_regiao` | Ranking em tercis das unidades de um bairro |
| `consultar_regras` | Limites de negócio (máx. 5, só com vaga, diversificar, nunca inventar número) |
| `finalizar_recomendacao` | Saída estruturada; persiste em `ia_recomendacao` / `ia_recomendacao_item` |

## Saída

```ts
{
  resumo: string,                        // estratégia da lista
  recomendacoes: [{
    unidadeId: string,
    porque: string,                      // parágrafo de 2-3 frases, 2ª pessoa, com números das tools
    badge?: 'Mais perto de casa' | 'Mais perto do trabalho' | 'No caminho para o trabalho'
          | 'Alta chance de vaga' | 'Muitas vagas abertas'
          | 'Perto do endereço alternativo' | 'Melhor equilíbrio',
  }],
  alertas?: string[],
  fonte: 'ia' | 'fallback',
}
```

`badge` é **enum fechado** de propósito: é elemento de UI, e deixar o modelo inventar o texto produziria rótulos de tom e tamanho imprevisíveis quebrando o layout do card. A personalização mora no parágrafo livre.

## Fallback determinístico

Sem `ANTHROPIC_API_KEY`, com a API falhando ou com o loop expirando, `recomendarSemIA` usa as **mesmas features**, ordena por uma nota composta (60% proximidade + 40% chance — não só distância, senão devolveria as 5 mais próximas ainda que todas fossem disputadíssimas), gera o parágrafo por template e atribui badges pela mesma regra de unicidade do prompt. A demo nunca quebra por causa da IA, e o piso de qualidade é alto.

## Avaliação

`bun run eval:ia [variante]` (`EVAL_VERBOSE=1` imprime os textos gerados) roda 5 personas × variante de system prompt e mede o que é determinístico:

- finalizou com saída estruturada;
- ids existem, estão ativos e têm vaga no grupamento/turno;
- **grounding**: cada número do texto apareceu literalmente numa resposta de tool (ordinais ≤ 5 ignorados, vírgula decimal normalizada);
- explorou os endereços além da moradia (chamou `unidades_no_caminho` quando havia trabalho);
- badges válidos e não repetidos;
- nº de tool calls e latência.

As personas cobrem trajeto curto (Tijuca→Centro), trajeto longo (Bangu→Barra), só moradia (Campo Grande), três endereços (Madureira + Centro + casa da avó) e **endereço sem geocodificação** (Irajá) — este último é o caso em que o agente precisa degradar para comparação por bairro sem inventar quilometragem.

Variantes de prompt em `prompts.ts`: `minimo` (baseline), `procedimental` (fixa a sequência de tools e a estratégia de portfólio) e `criterios` (descreve o que é uma boa recomendação e deixa o modelo planejar). `PROMPT_PADRAO` aponta para a vencedora da última rodada.

### Resultado da última rodada

| Variante | Nota média | Finalizou | Tool calls | Usou rota | Violações | Latência |
|---|---|---|---|---|---|---|
| `minimo` | 92,4 | 5/5 | 7,8 | 2/3 | 0 | 25,5s |
| **`procedimental`** | **96,0** | 5/5 | 8,6 | 3/3 | 0 | 30,2s |
| `criterios` | 95,0 | 5/5 | 8,2 | 3/3 | 0 | 30,2s |

**`procedimental` venceu** e é o `PROMPT_PADRAO`: única sem nenhuma queda abaixo de 90 e a única que chamou `unidades_no_caminho` nas 3 personas em que ela se aplica — o `minimo` perdeu justamente o diferencial do produto uma vez. Custa ~5s a mais.

Duas leituras honestas desses números:

1. **Zero violações de grounding em 15 execuções**, incluindo na persona sem coordenada. A distância entre a melhor e a pior variante é de 4 pontos, o que sugere que o trabalho pesado está nas **descrições das tools** e no schema de saída, não na prosa do system prompt — resultado bom, porque descrição de tool é mais estável do que prompt.
2. A métrica de portfólio original reprovava igualmente as três variantes em duas personas, sinal de que media o **cenário**, não a decisão: na persona sem geocodificação não existe nenhuma unidade de chance alta no bairro para escolher. `avaliarPortfolio` só cobra "incluiu uma de chance alta" quando havia alguma no universo. Depois desse ajuste e da migração para o modelo de endereços da `main`, `procedimental` mede **97,0** com portfólio ok em 4/5.
