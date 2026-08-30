# Regras de Negócio — Inscrição Creche (Prefeitura do Rio / SME)

> Contexto de IA separado do briefing narrativo ([prefeitura-rio-creches.md](prefeitura-rio-creches.md)). Este arquivo lista as **regras concretas e atômicas** do sistema atual, numeradas para referência precisa (ex.: "respeitar R7" / "isso quebra R12"). Use como checklist ao desenhar schema, validações, endpoints do backend (Elysia) ou lógica de classificação/convocação — não ao explicar o problema para alguém, isso é papel do briefing.

## 1. Regras de Inscrição

- **R1.** CPF do responsável é obrigatório e validado contra a base da Receita Federal no momento da inscrição.
- **R2.** Cada inscrição permite escolher **até 5 unidades** (creches/EDIs), sem qualquer validação de distância, território ou CRE de origem.
- **R3.** Critérios socioeconômicos (vulnerabilidade) são **autodeclarados** pelo responsável no ato da inscrição, no site matricula.rio.
- **R4.** A comprovação dos critérios declarados depende de:
  - **R4.1.** comparecimento presencial do responsável em uma das unidades escolhidas, dentro do prazo definido;
  - **R4.2.** apresentação de documentos físicos (ex.: laudo médico, comprovantes de renda/residência);
  - **R4.3.** validação manual do documento pela própria escola;
  - **R4.4.** cruzamento com bases oficiais — CadÚnico e Bolsa Família — via Registro Municipal Integrado, **sem integração automática/tempo-real** entre os sistemas envolvidos.
- **R5.** A pontuação final da inscrição é registrada manualmente no Sistema após a validação dos critérios (R4).

## 2. Regras de Classificação

- **R6.** A classificação roda uma única vez, em **data pré-publicada no Diário Oficial**, via script batch — não é um processo contínuo/em tempo real.
- **R7.** O critério de prioridade é a pontuação obtida a partir dos critérios socioeconômicos comprovados (R3–R5).
- **R8.** **[Regra problemática — alvo do Eixo 2]** A classificação é executada **por unidade** (processa as 5 opções de cada inscrição simultaneamente, unidade a unidade), e **não por CPF/responsável**. Consequência: o mesmo CPF pode ser classificado/ofertado em **até 5 vagas ao mesmo tempo**, uma em cada unidade escolhida.
- **R9.** O resultado da classificação (classificados e lista de espera por unidade) é publicado no site.
- **R10.** Não há, hoje, nenhum critério de desempate ou corte territorial nas escolhas — a distância entre residência e unidade escolhida **não entra** na lógica de classificação (só influencia indiretamente via desistência posterior).

## 3. Regras de Convocação

- **R11.** A convocação é disparada apenas quando surge uma vaga (por desistência, cancelamento ou vaga ociosa remanescente).
- **R12.** Tentativa de contato pela escola: **1 tentativa por dia**, durante **3 dias consecutivos**, em **horários diferentes** a cada tentativa.
- **R13.** Canais de contato permitidos: telefone, e-mail, WhatsApp ou SMS.
- **R14.** A partir do contato bem-sucedido (ou do fim das tentativas), a família tem **3 dias úteis** para comparecer à unidade e confirmar a matrícula.
- **R15.** É possível estender o prazo em **+1 dia útil**, mas somente mediante justificativa apresentada **dentro do prazo original** (R14) — justificativa fora do prazo não é aceita.
- **R16.** Se a família não é localizada em nenhuma das 3 tentativas (R12), ou não confirma dentro do prazo (R14/R15), a criança é **removida da lista** e a vaga passa para o próximo classificado.
- **R17.** Todo o processo de convocação (R11–R16) é executado manualmente pela escola/CRE, sem rastreio automatizado centralizado.

## 4. Regras de Planejamento / Estrutura Organizacional

- **R18.** Hierarquia administrativa fixa em 3 níveis:
  1. **Nível Central** (1) — define métricas e subsidia com dados o planejamento do ano seguinte;
  2. **Coordenadorias Regionais de Educação — CREs** (11) — administram a matrícula em seu território;
  3. **Unidades escolares** (~872 na rede ativa) — indicam demandas pontuais da comunidade.
- **R19.** O planejamento de vagas para o ano seguinte é ancorado, prioritariamente, na **demanda histórica** (fila do ano anterior) — não há, hoje, modelo preditivo incorporando variáveis externas (ex.: crescimento populacional por bairro, natalidade, migração).
- **R20.** Cada CRE ajusta a oferta da sua rede com base na leitura própria do seu território — não há um modelo único, centralizado, de previsão de demanda.

## 5. Regras de Dados (dataset do hackathon)

- **R21.** O dataset cobre os processos seletivos de **2021 a 2025** (SME Rio).
- **R22.** Crianças e responsáveis são identificados por **código anônimo** — não há CPF, nome ou outro identificador direto nos dados fornecidos.
- **R23.** Quatro tabelas disponíveis:
  | Tabela | Grão | Volume |
  |---|---|---|
  | Inscrições por opção | 1 linha por opção de unidade escolhida dentro de uma inscrição (unidade, turno, situação) | 837.179 |
  | Respostas socioeconômicas | Respostas ao questionário de critérios de vulnerabilidade | ≈436 MB (não totalizado em linhas) |
  | Perguntas por processo | Catálogo de critérios e pontuação vigente em cada processo seletivo | 65 |
  | Unidades escolares | Cadastro de creches/EDIs, endereço e tipo de gestão | 2.188 |
- **R24.** Campos **generalizados/ofuscados** (não usar como se fossem exatos): endereço (só bairro/CEP), data de nascimento da criança (só ano-mês), contagem de crianças quando falta CPF/DNV/NIS.
- **R25.** Campos/estruturas **preservados fielmente** (podem ser usados para modelagem/análise real): sequência processo → polo → inscrição → opção; lógica de pontuação vigente em cada processo; relações entre as quatro tabelas (R23); dinâmica real de transição de status (ex.: inscrito → classificado → convocado → matriculado/desistente).
- **R26.** **Regra de uso:** por causa de R22 e R24, o dataset serve para **scoring, simulação e modelagem agregada/territorial** — não serve para reidentificar ou fazer lookup de uma família específica.

## 6. Mapa regra → problema (para orientar o design da solução)

| Regra atual | Problema que ela causa | Eixo relacionado |
|---|---|---|
| R2 (5 escolhas sem critério territorial) | Famílias escolhem unidades inviáveis geograficamente → cancelamentos e desistências disfarçados de "fila" | Eixo 2 |
| R8 (classificação por unidade, não por CPF) | Mesmo CPF pode ficar classificado em até 5 vagas simultâneas → vagas fantasmas, retrabalho na convocação | Eixo 2 |
| R12–R17 (convocação manual, tentativa por tentativa) | Processo lento e não rastreado → vagas ficam ociosas por mais tempo do que o necessário | Eixo 3 |
| R19–R20 (planejamento baseado só em histórico) | Oferta de vagas não antecipa mudanças reais de demanda por território | Eixo 1 |

> Ao propor uma solução para um eixo, referenciar explicitamente qual(is) regra(s) dessa tabela ela substitui ou corrige.

## 7. Regras adicionais (fonte: `briefing-oficial-sme.md`, documento oficial "problema completo")

- **R27.** A régua de pontuação vigente em 2021–2023 tinha 3 faixas: 100 pontos (Cartão Família Carioca / Bolsa Família / deficiência da criança / Programa Territórios Sociais), 10 pontos (violência doméstica, drogas/álcool no núcleo familiar, déficit nutricional/doença crônica, refugiado, responsável 60+ ou com deficiência), 5 pontos (membro do núcleo familiar presidiário/ex-presidiário nos últimos 5 anos).
- **R28.** Em 2024 a régua foi reformulada: CadÚnico passou a ter o maior peso; Bolsa Família/Cartão Carioca caiu drasticamente. Em 2025, CadÚnico isolado é o critério de maior peso (51 pontos) e "público-alvo da educação especial" vale 25 pontos. **Comparação de posição na fila entre anos exige a tabela de pesos do ano específico** — não existe régua fixa (reforça R7-R8 e o gotcha de Query C em `dataset-dicionario.md`).
- **R29.** Quando a criança não tem CPF, DNV nem NIS, o sistema gera o código anônimo agrupando por nome + data de nascimento — o que pode **colidir crianças diferentes sob o mesmo código anonimizado**, distorcendo contagem de fila por família. Isso é uma falha de identificação do sistema atual, não só uma característica da anonimização do dataset do hackathon.
- **R30.** Em cerca de **0,2% das inscrições**, uma opção do cadastro aparece "Selecionada" enquanto outra opção do mesmo cadastro permanece "Lista de espera" simultaneamente — um estado transitório inconsistente que hoje só é detectado por checagem manual, linha a linha.
- **R31.** Não existe hoje nenhum painel que sinalize, por unidade e por criança, há quanto tempo uma vaga está "Selecionada" aguardando confirmação — toda a visibilidade de prazo é manual.
- **R32.** O sistema interno de inscrição/classificação é internamente chamado **ICH** (explica o prefixo `ich_` nas colunas do dataset, ex. `ich_perg_id`, `ich_situacaoIntegral`).
- **R33.** O planejamento de vagas (Eixo 1) hoje já combina 3 fontes, não só a fila do ano anterior: (a) fila do ano anterior como "demanda manifesta", (b) análise de nascidos vivos do IBGE, (c) histórico de matriculados da rede — refina R19 (a demanda IBGE já é insumo real, não uma ideia nova de enriquecimento).
