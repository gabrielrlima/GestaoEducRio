# Desafio: Inscrição Creche — Prefeitura do Rio (SME)

> Registro do briefing apresentado no hackathon (slides da Secretaria Municipal de Educação do Rio). Fonte primária para orientar o escopo do produto. Ver também `briefing-oficial-sme.md` (documento oficial completo, mais autoritativo em caso de divergência).
>
> **Eixo escolhido: Eixo 2 — Inscrição e Classificação.** Ver `CLAUDE.md` § Decisões para o escopo exato do produto.

## O que é o sistema hoje

A **Inscrição Creche** é o sistema que organiza o acesso às unidades da rede municipal do Rio de Janeiro, recebendo inscrições feitas no site (**matricula.rio**) para realizar o processo de classificação.

### A rede de educação infantil (modalidade creche)

- **+89 mil** crianças matriculadas
- **482 + 372** unidades públicas e parceiras (854 no total, segundo o slide de rede) — um outro slide cita **872 unidades escolares** no contexto de planejamento, e **2.188 unidades escolares** no dataset histórico (cadastro cumulativo de creches e EDIs). Confirmar com a organização qual número é o vigente antes de usar em UI.
- Estrutura administrativa: **1** Nível Central (define métricas e subsidia o planejamento do ano seguinte) → **11** Coordenadorias Regionais de Educação — CREs (administram a matrícula em seu território) → unidades escolares (indicam demandas pontuais da comunidade).

### Como a prioridade é definida hoje

Por critérios socioeconômicos declarados na inscrição. A comprovação desses critérios hoje depende de:

- comparecimento presencial na unidade, dentro do prazo;
- documentos físicos (laudo médico, comprovantes, etc.);
- validação manual pela escola;
- cruzamento com bases oficiais (CadÚnico e Bolsa Família) — mas **sem integração entre sistemas**.

### Jornada do cidadão (fluxo atual)

1. **Inscrição no matricula.rio** — CPF obrigatório com validação da Receita Federal + até **5 opções de unidades**.
2. **Comprovação dos critérios de vulnerabilidade** nas unidades escolhidas + validação de parte dos critérios via **Registro Municipal Integrado** ([docs.dados.rio/rmi/overview](https://docs.dados.rio/rmi/overview)).
3. **Classificação** em data publicada no Diário Oficial + resultado no site.
4. **Confirmação de matrícula** na unidade escolhida.
5. **Lista de espera** publicada, com períodos de 3 dias para convocação.

### Fluxo entre sistemas (bastidores)

1. **Planejamento de Matrícula** — site de planejamento que organiza a rede entre o ano atual e o seguinte.
2. **Site de Matrícula** — recebe as vagas que serão ofertadas para o processo de inscrição.
3. **Inscrição Creche** — as inscrições feitas no site são exportadas para o processo de classificação e convocação.
4. Antes do período de classificação, as inscrições são analisadas e os critérios via Registro Municipal Integrado são confirmados usando o **datalake**.
5. **Classificação** — em data publicada em DO, o sistema executa o script de classificação, gerando lista de classificados e espera por unidade.

## Os 3 eixos do desafio

O hackathon está estruturado em torno de 3 eixos-problema. O time precisa escolher (ou combinar) qual(is) atacar — ver seção "Próxima decisão" no final.

### Eixo 1 — Planejamento
**Pergunta:** como aprimorar o planejamento para atender à demanda de uma metrópole com territórios tão heterogêneos?

- Estrutura: 1 Nível Central → 11 CREs → 872 unidades escolares.
- O planejamento atual de vagas se ancora, prioritariamente, na **demanda histórica** (a fila do ano anterior como bússola). Cada CRE interpreta os movimentos do seu próprio território e ajusta a oferta com base na realidade local.
- **Desafio:** que outras variáveis incorporar para que esse olhar, hoje retrospectivo, comece a **antecipar** o comportamento futuro da demanda?

### Eixo 2 — Inscrição e Classificação
**Pergunta:** a lógica de inscrição e classificação precisa ser reavaliada — a escolha livre de unidades, sem critério territorial, gera filas que não refletem falta de vaga, mas sim cancelamentos e desistências por distância.

**Onde o fluxo quebra hoje:**
1. Família se inscreve e escolhe até 5 unidades + declara os critérios no site (matricula.rio).
2. Leva a documentação em uma das unidades escolhidas para comprovar parte dos critérios.
3. A creche confirma manualmente no Sistema + SME confirma os critérios (CadÚnico e Bolsa Família).
4. Pontuação é registrada no Sistema → classificação é realizada e as vagas são priorizadas e distribuídas.
5. O ano inicia com vagas ociosas + convocação manual + contatos desatualizados = convocação demorada.

**Ponto crítico:** a escolha das 5 unidades pelo responsável é feita **sem qualquer critério de distância ou território**, o que resulta em opções inviáveis e, consequentemente, em futuros cancelamentos. Além disso, a classificação é orientada pelo **total de escolhas por unidade, não por CPF** — o sistema classifica as opções simultaneamente, chegando a ofertar até **5 vagas para o mesmo CPF** ao mesmo tempo (gerando lacunas e pontos cegos na convocação).

### Eixo 3 — Convocação
**Pergunta:** é possível automatizar? O modelo atual, manual e descentralizado, sobrecarrega escolas e CREs com retrabalho e atrasos na ocupação das vagas.

**Linha do tempo da convocação, quando surge uma vaga:**
1. **Contato da escola** — 1 tentativa por dia, durante 3 dias consecutivos, em horários diferentes (telefone, e-mail, WhatsApp ou SMS).
2. **Prazo da família** — 3 dias úteis para comparecer e confirmar a vaga na unidade.
3. **Possível extensão** — mais 1 dia útil, mediante justificativa apresentada dentro do prazo original.

**Onde a agilidade falta:** não localizar a família ou não obter resposta a tempo retira a criança da lista e passa a vaga adiante. É um fluxo manual e repetitivo, tentativa a tentativa, com potencial claro de automação e rastreio.

## Dados disponibilizados

Base cobre os processos seletivos de **2021 a 2025** (SME Rio). Crianças e responsáveis são identificados por **código anônimo** (não há PII direta).

| Tabela | Descrição | Qtd. |
|---|---|---|
| Inscrições por opção | Cada opção de creche escolhida dentro de uma inscrição, com unidade, turno e situação | 837.179 |
| Respostas socioeconômicas | Respostas ao questionário de critérios de vulnerabilidade | ≈436 MB (não totalizado) |
| Perguntas por processo | Catálogo de critérios e pontuação vigente em cada processo seletivo | 65 |
| Unidades escolares | Cadastro de creches e EDIs, com endereço e tipo de gestão | 2.188 |

### Técnicas de anonimização aplicadas

**O que NÃO representa a realidade** (foi ofuscado/generalizado):
- identidade real de crianças e responsáveis;
- endereço exato (apenas bairro/CEP);
- data de nascimento exata da criança (apenas ano-mês);
- contagem exata de crianças quando falta CPF/DNV/NIS.

**O que está preservado** (íntegro para análise):
- sequência processo → polo → inscrição → opção;
- lógica de pontuação vigente em cada processo;
- relações entre as quatro tabelas;
- dinâmica real de transição de status.

> Nota de engenharia: como PII foi removida/generalizada, mas a *estrutura relacional* e a *lógica de pontuação/transição* foram preservadas, o dataset é adequado para modelagem, scoring e simulação — mas não para lookup de indivíduos reais.

## Referências citadas nos slides

- Site de inscrição: matricula.rio
- Registro Municipal Integrado: https://docs.dados.rio/rmi/overview

## Próxima decisão (em aberto)

Ainda não definimos:
1. **Qual eixo (ou combinação) o produto vai atacar** — planejamento preditivo, redesenho de inscrição/classificação (ex.: matching com critério territorial, classificação por CPF em vez de por unidade), ou automação de convocação.
2. **Formato do dataset real** — se teremos os CSVs/arquivos de fato (schema exato de colunas) ou apenas esta descrição de alto nível dos slides.
3. **Formato de entrega esperado pelo hackathon** — dashboard analítico, ferramenta operacional, POC de algoritmo/simulação, etc.

Essas decisões vão direcionar o desenho de endpoints do backend (Elysia) e das telas do frontend (Minimal UI Kit).
