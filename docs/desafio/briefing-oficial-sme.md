# Briefing Oficial — SME-Rio (documento completo do desafio)

> Transcrito de `Briefing_SME.docx`, o documento oficial "problema completo" linkado no repo de dados (mais detalhado que os slides da apresentação de abertura). Este é hoje **o documento mais autoritativo sobre o problema** — em caso de divergência de número/detalhe com `prefeitura-rio-creches.md` (baseado nos slides fotografados) ou com os slides do PDF oficial, **confiar neste arquivo**. Nome oficial do desafio: **"Match Perfeito: Inteligência na Inscrição de Creche"** (Hackathon SME-Rio + Rio Impact Lab 2026).

## 1. Contexto

A Inscrição Creche organiza e prioriza a demanda por vagas em creches e EDIs da rede **direta, conveniada e em parceria**. O responsável se inscreve pelo portal **matricula.rio** ou pelo app **Rioeduca em Casa**, indicando até 5 unidades por ordem de preferência.

Processo centralizado (planejamento/parametrização), mas com as **11 CREs** administrando a matrícula em seu território, incluindo pontos físicos de avaliação de vulnerabilidade social.

**Escala (2021–2025, 5 processos):** 837 mil opções de creche escolhidas, 343 mil inscrições, ~260 mil crianças distintas, **872 unidades escolares** — sendo **855 diretas, 10 conveniadas e 7 em parceria**. ⚠️ Este detalhamento (855+10+7=872) **diverge** do slide "482 + 372 unidades públicas e parceiras" visto na apresentação de abertura — não foi possível reconciliar os dois números com as fontes disponíveis; usar 872 (bate com a Query A do dataset) como número de unidades ativas nos processos analisados.

Grupamentos etários: **Berçário, Maternal I, Maternal II**. Turnos: **Integral** (83% das opções escolhidas) e **Parcial**. Um único processo seletivo pode reunir **mais de 45 mil inscrições em um ano**.

**As 7 responsabilidades operacionais da equipe CRE/polo** (o que hoje é feito manualmente):
1. Planejar a oferta de vagas do ano seguinte prevendo demanda territorial.
2. Receber e conferir inscrição + respostas do questionário socioeconômico.
3. Aplicar a pontuação vigente para ordenar a fila por unidade e turno.
4. Chamar o próximo da fila quando uma vaga abre (opção → "Selecionado").
5. Acompanhar o prazo de confirmação e registrar a resposta da família.
6. Cancelar as demais opções do mesmo cadastro quando confirmada em outra unidade.
7. Monitorar a fila remanescente e a ocupação das unidades do polo.

## 2. Os 3 eixos (redação oficial, complementa `prefeitura-rio-creches.md`)

- **Eixo 1 — Planejamento**: "como qualificar o planejamento e atender a demanda de uma metrópole com territórios tão distintos?" Hoje a definição de vagas por unidade parte, em boa parte, de **3 fontes**: (a) fila do ano anterior como "demanda manifesta", (b) **análise de nascidos vivos (IBGE)**, (c) histórico de matriculados da rede. → Confirma que `NascidosvivosRJ.xlsx` já é insumo real do processo atual, não só uma ideia nossa de enriquecimento.
- **Eixo 2 — Classificação**: "a lógica de classificação de hoje precisa ser reavaliada." O sistema classifica simultaneamente as opções, com 3 dias de convocação/confirmação para cada uma. Pergunta central: dá pra mudar a lógica pra otimizar preenchimento de vagas, com agilidade e sem gargalo, sem comprometer o fluxo contínuo de matrículas?
- **Eixo 3 — Convocação**: "mais agilidade — dá pra automatizar esse fluxo?" Mínimo 1 tentativa/dia, 3 dias consecutivos, horários diferentes, por telefone/e-mail/WhatsApp/SMS. Família tem 3 dias úteis. (Este documento não menciona a extensão de +1 dia útil por justificativa que aparece no slide — tratar R15 de `regras-negocio.md` como correta, só sem confirmação cruzada aqui.)

## 3. Fluxo típico de uma inscrição (NOVO — nível de detalhe maior que os slides)

| Momento | O que acontece | Ferramenta usada |
|---|---|---|
| Inscrição | Responsável se cadastra e escolhe até 5 opções, por ordem de preferência | Portal matricula.rio / app Rioeduca em Casa |
| Avaliação socioeconômica | Responde questionário de vulnerabilidade (violência, drogas, CadÚnico, deficiência, etc.) | Formulário de inscrição / Polo de Avaliação (creche) |
| Classificação | Sistema soma pontuação das respostas e ordena a fila por unidade e turno | **Sistema interno de inscrição (ICH)** |
| Chamada de vaga | Vaga abre → próximo da fila é chamado → opção muda para "Selecionado" | Sistema interno + contato com a família |
| Confirmação | Responsável confirma matrícula na unidade dentro do prazo | Unidade escolar / sistema interno |
| Fechamento das demais opções | Outras opções do cadastro são canceladas ("Cancelado na confirmação") ou expiram ("Cancelado pelo sistema") | Rotina automática do sistema interno |

**Achado técnico:** o sistema interno se chama **ICH** — explica o prefixo `ich_` usado nos nomes de coluna reais do dataset (`ich_perg_id`, `ich_situacaoIntegral`, `ich_id`, etc., ver `dataset-dicionario.md`). Provavelmente "Inscrição CrecHe" ou similar.

**Problema central (citação oficial, é praticamente um pedido de produto):**
> "A equipe da CRE/polo acompanha milhares de inscrições por processo sem um painel que sinalize, por unidade e por criança, há quanto tempo uma vaga está 'Selecionada' aguardando confirmação, ou que aponte inconsistências entre as opções de um mesmo cadastro — hoje isso só aparece com checagem manual, linha a linha."

## 4. Critérios de classificação — a régua de pontuação (NOVO, valores exatos)

**Vigente em 2021–2023:**

| Critério | Peso |
|---|---|
| Cartão Família Carioca, Bolsa Família, deficiência da criança ou Programa Territórios Sociais | **100 pontos** |
| Violência doméstica, uso de drogas/álcool no núcleo familiar, déficit nutricional/doença crônica, refugiado, responsável 60+ anos ou com deficiência | **10 pontos** |
| Membro do núcleo familiar presidiário ou ex-presidiário (últimos 5 anos) | **5 pontos** |

**Mudanças (reforça o gotcha já documentado em `dataset-dicionario.md` sobre a Query C):**
- **2024**: SME revisou a fórmula — maior peso passou para inscrição no **CadÚnico**; peso de Bolsa Família/Cartão Carioca caiu drasticamente.
- **2025**: CadÚnico isoladamente virou o critério de maior peso (**51 pontos**); "público-alvo da educação especial" passou a valer **25 pontos**.
- ⚠️ Comparar a posição de uma criança entre anos diferentes **exige olhar a tabela de pesos daquele ano específico** — não existe régua única. Ao usar Query C, sempre filtrar por `ano`/`ich_perg_id` do processo em questão, nunca assumir peso fixo por `perg_id`.

**O que é registrado em cada opção de inscrição:** opção (1ª–5ª) + unidade, grupamento etário, situação (8 valores confirmados: `Ativo`, `Selecionado`, `Selecionado da lista`, `Confirmado`, `Lista de espera`, `Cancelado`, `Cancelado na confirmação`, `Cancelado pelo sistema` — bate exatamente com a distribuição real observada na Query A; lembrar que **no dado real a grafia é sem acento**: `Cancelado na confirmacao`), respostas do questionário (Sim/Não + confirmação), data de criação, CEP/bairro.

## 5. Gaps do processo atual (NOVO — tabela oficial, é praticamente um backlog de produto)

| Gap | Impacto prático |
|---|---|
| **Fila sem visibilidade de prazo** | Não há registro de quando uma opção mudou de status; ninguém sabe há quanto tempo uma vaga "Selecionada" está aguardando confirmação. |
| **Estados transitórios não sinalizados** | Em **~0,2% das inscrições**, uma opção aparece "Selecionada" enquanto outra do mesmo cadastro segue "Lista de espera" — sem painel, ninguém identifica esses casos a tempo de agir. |
| **Identificação da criança sujeita a colisão** | Quando a criança não tem CPF/DNV/NIS, o sistema agrupa por nome + data de nascimento — em parte dos casos multi-inscrição isso **mistura crianças diferentes sob o mesmo código**, distorcendo a contagem de fila por família. |
| **Critérios de pontuação mudam a cada processo** | Pesos revisados em 2024 e 2025 — difícil explicar às famílias por que a posição mudou de um ano pro outro. |
| **Fila histórica represada** | Mesmo com vagas ociosas em partes da rede, ainda há listas de espera expressivas — é **fila de preferência/descompasso territorial**, não ausência real de vaga. |

⚠️ **Gotcha de qualidade de dado não documentado no dicionário oficial**: o achado "identificação da criança sujeita a colisão" significa que `aluno_anon` **não é 100% confiável como identificador único de criança** quando a família não declarou CPF/DNV/NIS — duas crianças com nome+mês de nascimento parecidos podem colidir no mesmo código. Qualquer análise de "trajetória da mesma criança entre anos" (ex.: os 13,3% que reaparecem, citado em `dataset-dicionario.md`) tem essa margem de erro residual.

## 6. Dados disponibilizados — com a "utilidade sugerida" oficial (NOVO)

A própria SME já sugere a que serve cada tabela — isso é essencialmente um hint de quais métricas eles esperam ver:

| Dataset | Utilidade sugerida pela SME |
|---|---|
| Inscrições por opção (Query A) | Calcular **tempo de espera**, **taxa de conversão por unidade** e mapear **demanda × oferta** |
| Respostas socioeconômicas (Query B) | Reconstituir o **perfil de vulnerabilidade** de cada inscrição |
| Catálogo de perguntas por processo (Query C) | Aplicar corretamente a régua de pontuação vigente em cada processo (pesos mudam a cada ano) |
| Unidades escolares com endereço (Query D) | Mapear a **oferta geográfica** de vagas e cruzar com bairro/CEP do responsável |

Essas 4 métricas sugeridas (tempo de espera, taxa de conversão, demanda×oferta, perfil de vulnerabilidade, oferta geográfica) são um bom ponto de partida pra qualquer eixo escolhido — são literalmente o que a banca já sinalizou que espera ver calculado.
