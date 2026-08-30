# SDD — GestaoEducRio (Spec-Driven Development)

Documento gerado hoje, **30/08/2026, por volta de 10h30** (evento começou ~9h, prazo de submissão **16h30**, ~6h restantes no momento da geração). É uma varredura **ponto-no-tempo** feita por 6 auditorias independentes (Frontend, Backend, Pipeline de Dados, Produto/Escopo, Infra/Deploy, Compliance de Submissão) sobre o estado real do repo — não é uma spec formal de arquitetura. **Vai ficar desatualizado a cada decisão tomada e a cada commit.** Trate como checklist de trabalho do dia, não como documento de referência permanente — ver nota final sobre como mantê-lo.

---

## 1. Lacuna raiz: qual eixo o produto ataca

Nenhuma decisão de produto foi tomada. `docs/desafio/prefeitura-rio-creches.md` e o `CLAUDE.md` são explícitos: falta escolher entre os 3 eixos do desafio (ou uma combinação). **Toda outra lacuna do repo — schema de backend, rotas do frontend, tipos TS, mocks, endpoints, papel da IA, resumo do README — depende desta escolha.** É o único item que não é tarefa de código: é decisão de time, e precisa sair nos primeiros 30-60 min ou o dia inteiro fica sem paralelismo real entre front e back.

**Critério de decisão sugerido:** (a) menor risco técnico dado o stack já fixado (Elysia/Bun/TS + React/Vite/MUI), (b) o que gera o artefato mais convincente de "a prefeitura usaria isso hoje" em ~6h, (c) força/interesse do time. Usar `docs/desafio/regras-negocio.md` seção 6 (mapa regra→problema) como apoio.

| | **Eixo 1 — Planejamento preditivo territorial** | **Eixo 2 — Inscrição e Classificação** | **Eixo 3 — Convocação automatizada** |
|---|---|---|---|
| **O que é (MVP ~6h)** | Dashboard por CRE/bairro cruzando demanda histórica (Query A), oferta de vagas (OferecimentosEvagas) e nascidos vivos defasados, gerando ranking de "gap projetado" demanda×oferta. Mapa por microárea é stretch goal. | Simulador retroativo sobre dados históricos: (a) recomendador de unidades por proximidade real, ou (b) reprocessamento de Query A por CPF/família escolhendo a melhor entre até 5 opções em vez de ofertar todas. Ataca R2 e R8. | Painel operacional que modela o fluxo de convocação (R11-R17) como workflow assistido: checklist de prazos (3 tentativas/3 dias + 3 dias úteis de resposta + extensão), alerta de vencimento, sugestão de próxima ação. |
| **Dados usados** | Query A (demanda/situação), Query D (unidades), OferecimentosEvagas (oferta), NascidosvivosRJ.xlsx, shapefile de microáreas (opcional). | Query A, Query B+C (recalcular pontuação real), Query D. | Só Query A é diretamente aplicável — **não existe tabela de histórico de tentativas de contato** no dataset. |
| **Papel da IA** | Resumo executivo em linguagem natural por CRE/bairro explicando o gap; copiloto de cenário conversacional; normalização bairro→microárea. | Explicação em linguagem natural de por que uma família foi/seria classificada em cada unidade; auditor de inscrições com alta chance de cancelamento por distância. | Geração de mensagens de convocação personalizadas por canal; decisão da próxima ação dado o estado do caso — é o eixo onde a IA fica mais "vistosa" (chatbot de convocação é citado literalmente nas regras do evento). |
| **Risco técnico** | **Alto**: geoprocessamento (shapefile, join espacial) não tem lib madura no stack TS/Bun decidido; endereço é ofuscado a nível bairro/CEP, sem lat/long exato — mapa fino por microárea depende de de-para que não vem pronto. Recomendação: começar por bairro/CEP, shapefile só se sobrar tempo. | **Médio-alto**: regra de desempate/pontuação completa não está 100% especificada em `regras-negocio.md` (precisa assumir premissa simplificada e documentá-la como tal); quebra de régua de pontuação 2023→2024 exige tratamento explícito para não gerar número espúrio. | **Alto, mas de outro tipo**: pouquíssimo apoio em dado real — o motor de regras pode ser fiel, mas o histórico de tentativas precisa ser sintético/mockado. Se a banca perguntar "isso roda sobre dado real de convocação?", a resposta honesta é não. |
| **Formato de entrega natural** | Dashboard analítico + mapa. | Ferramenta de simulação interativa. | Ferramenta operacional tipo painel de casos. |

**Depois de decidir:** registrar por escrito no `CLAUDE.md` (seção Projeto) e no `README.md` raiz, junto com o **formato de entrega** (dashboard analítico / ferramenta operacional / POC de simulação — parcialmente amarrado ao eixo mas não automático, decidir na mesma conversa). Riscar os 2 specs não escolhidos aqui (ver nota final).

---

## 2. Checklist priorizado — até 16h30

Combinação de **todas** as lacunas `[BLOQUEANTE HOJE]` das 6 áreas, em ordem de dependência. Realista: um hackathon de 1 dia não fecha tudo — os itens marcados **(pode adiar)** só valem a pena se sobrar tempo depois do MVP mínimo publicado e demonstrável.

**Fase 0 — decisão, não código (~30 min, fazer agora)**
1. [ ] Decidir o eixo do produto + formato de entrega (seção 1 acima). Registrar em `CLAUDE.md` e `README.md`.
2. [ ] Corrigir a frase do `README.md` linha 3 ("desafio Inscrição Creche / matricula.rio") — hoje ela **contradiz** a decisão de eixo em aberto (lê como se o Eixo 2 já tivesse sido escolhido). Ajustar para o eixo real decidido, ou generalizar até decidir.
3. [ ] Decidir e registrar em 1 frase: qual **1 ponto de valor de IA** o produto vai incorporar de forma coerente com o eixo (não é opcional — regras do evento exigem que o Claude atue *dentro* da aplicação, não só como ferramenta de codificação). Isso já determina se precisa de endpoint dedicado no backend com `ANTHROPIC_API_KEY` server-side.

**Fase 1 — setup que independe do eixo (pode rodar em paralelo à Fase 0, fazer JÁ)**
4. [ ] `cd vite-ts && yarn install && yarn dev` — validar que o scaffold sobe limpo (nunca foi testado neste repo). Resolver a duplicidade `yarn.lock`/`package-lock.json` (apagar o `package-lock.json`, manter yarn — consistente com `packageManager` do `package.json`).
5. [ ] Setar `CONFIG.auth.skip = true` em `vite-ts/src/global-config.ts` — hoje o `AuthGuard` trava qualquer navegação a `/dashboard/*` numa tela de login que chama um backend inexistente. Sem isso, **nenhuma tela é acessível**, nem as genéricas do template.
6. [ ] Criar projeto Vercel (`vercel link`, **Root Directory = `vite-ts`** — não há `package.json` na raiz, build falha sem isso) e fazer o primeiro deploy do scaffold genérico. Valida o pipeline de deploy cedo, antes de depender dele sob pressão.

**Fase 2 — backend + dados (depois do eixo decidido)**
7. [ ] Decidir runtime do pipeline de dados: Python one-shot (pandas/duckdb, gera artefato estático) vs TypeScript/Bun nativo. Registrar em `CLAUDE.md`.
8. [ ] Decidir destino dos dados processados: JSON estático servido pelo Elysia, SQLite/DuckDB file, ou Postgres no Railway. (Decisão única — trava env vars, scaffold do backend e formato de saída do ETL; provavelmente JSON/SQLite estático é o caminho mais rápido para 1 dia.)
9. [ ] Escrever os parsers/loaders só das Queries que o eixo escolhido realmente usa, respeitando os gotchas do dicionário: Query A (BOM `utf-8-sig`, `sep=';'`, situação com grafia exata `'Cancelado na confirmacao'`), Query B (**nunca** carregar 436MB inteiro em memória — usar `chunksize`/DuckDB), Query D (`header=None`, `na_values=['NULL']`, nomear as 9 colunas manualmente).
10. [ ] Definir o diretório de saída do pipeline **fora** de `data/dadoscreche/` (que é gitignorado) — ex. `backend/src/data/processed/` — e versionar esse artefato no git (não contém PII, é seguro versionar; diferente do CSV cru).
11. [ ] Scaffold do backend Elysia: `bun init` + `elysia` + `@elysiajs/cors` + `@elysiajs/swagger`, estrutura `src/routes`/`src/services`/`src/types`, padrão único de resposta de erro. Publicar `GET /health` primeiro para testar o pipeline de deploy antes da lógica de negócio.
12. [ ] Mapear o dicionário de dados → 3-6 endpoints REST mínimos para as telas centrais do eixo escolhido; alinhar o contrato (path, método, shape) com quem faz o frontend antes de codar os dois lados em paralelo.
13. [ ] Criar projeto Railway, configurar start command (`bun run src/index.ts`) e as env vars de produção (banco/caminho do artefato, `ANTHROPIC_API_KEY`, `PORT`, `CORS_ORIGIN`). Criar `backend/.env.example` espelhando os nomes exatos.
14. [ ] Configurar CORS no Elysia (`@elysiajs/cors`) liberando a origem de produção da Vercel + `localhost:5173`. Alternativa mais simples: `rewrites` no `vercel.json` proxyando `/api/*` pro Railway, eliminando CORS por tratar como mesma origem.
15. [ ] Implementar o endpoint de IA decidido no item 3 (ex. `POST /insights/...`), chamando a API da Anthropic **server-side** — nunca expor a chave no bundle do Vite.

**Fase 3 — conectar frontend ao backend real**
16. [ ] Criar `vite-ts/.env` com `VITE_SERVER_URL` apontando pro Railway; atualizar `src/lib/axios.ts` com os endpoints reais de domínio (hoje são só os placeholders do template).
17. [ ] Criar rotas/telas/types/mocks de domínio mínimos para o eixo escolhido (reaproveitando esqueleto do template — ver seção Frontend abaixo para mapeamento sugerido).
18. [ ] Testar a integração fim a fim em produção (Vercel → Railway), não só local — é onde CORS e env vars faltantes costumam aparecer, perto do prazo.

**Fase 4 — fechamento da submissão**
19. [ ] Preencher os 5 itens obrigatórios do checklist de submissão no `README.md`: equipe (nome + membros), resumo da solução, arquitetura (incluindo papel do Claude *dentro* do produto), link da app publicada.
20. [ ] **(pode adiar até ter certeza do deploy)** Gravar vídeo demo de 60s — hoje é obrigatório por padrão (só vira opcional se o deploy estiver público). Reservar um bloco fixo na agenda (ex. 15h30-16h15) independente do deploy sair ou não, como plano B garantido.
21. [ ] Antes de enviar o e-mail final para `eventos@taicor.ai`: reconfirmar `git log --pretty=fuller` (repo continua com commits só após 09h) e `gh repo view --json isPrivate,visibility` (continua público) — regras 1 e 4 do evento causam desclassificação se violadas. Confirmar o número do grupo exigido no assunto/corpo do e-mail.

**O que é razoável adiar para depois de hoje (ou só fazer se sobrar tempo):** join materializado completo entre as 4 Queries, tratamento fino da quebra de régua de pontuação 2023→2024, reprojeção do shapefile e mapa por microárea (a menos que o Eixo 1 seja escolhido e sobre tempo), limpeza do `NascidosvivosRJ.xlsx` (formato TabNet), camada de pré-agregação/cache dedicada, contrato de tipos via Eden Treaty, CI/CD automático via GitHub Actions, branding completo (paleta/logo institucional), remoção das dependências de auth providers não usados (Firebase/Supabase/Auth0/Amplify).

---

## 3. Frontend

**Estado atual:** `vite-ts/` é 100% o scaffold de fábrica do Minimal UI Kit (v7.3.0) — nenhuma tela, rota, tipo ou mock de domínio existe; `node_modules` nunca foi instalado neste repo. Locale pt-br já é default e a estrutura de pastas (actions/hook-form/table/custom-data-grid) é reaproveitável assim que o eixo for escolhido.

Lacunas não cobertas na Fase 0/1 do checklist (todas dependem do eixo decidido):

- **Nenhum client de API/contrato de domínio** em `src/lib/axios.ts` (só endpoints placeholder do template). *Próximo passo:* depois do contrato de endpoints alinhado com o backend (checklist item 12), atualizar o objeto `endpoints`.
- **Nenhuma env var `VITE_*` documentada** (sem `.env.example`). *Próximo passo:* criar `vite-ts/.env.example` com `VITE_SERVER_URL` (e `VITE_MAPBOX_API_KEY` se Eixo 1).
- **Nenhuma rota/página/seção de domínio** — tudo em `routes/paths.ts`, `sections/*`, `pages/dashboard/*` é genérico (product, order, invoice, kanban etc.). *Próximo passo:* mapear entidade genérica → entidade real (ex. product list/table → "Unidades escolares"; invoice/order → "Inscrições"/"Fila"; kanban → pipeline de status de convocação) e criar as pastas correspondentes.
- **Nenhum type TS de domínio** em `src/types/`. *Próximo passo:* traduzir as colunas do dicionário de dados relevantes ao eixo para `src/types/<dominio>.ts` (camelCase, enum para `situacao` etc.) como contrato compartilhado entre mocks, componentes e API real.
- **`_mock/` sem dado de domínio** — só fixtures de e-commerce/blog do template. *Próximo passo:* criar `src/_mock/_<dominio>.ts` com ~20-50 registros amostrados de `data/dadoscreche/` (respeitando R26 — sem tentar reidentificar famílias).
- **Nav lateral (`nav-config-dashboard.tsx`) 100% genérica.** *Próximo passo:* ao criar rotas de domínio, adicionar itens correspondentes e remover seções puramente de demo (Level, Params, Subpaths, External link, Blank).
- **Branding não aplicado** — `appName: 'Minimal UI'`, `<title>Minimal UI Kit</title>`, paleta verde-menta padrão, logo do template. *Próximo passo:* trocar `appName`/`<title>`, ajustar `primary.main` em `theme-config.ts` + `core/palette.ts` juntos, substituir `public/logo/*`. Esforço baixo, retorno visual alto na demo.
- **Componente de mapa (Mapbox) pronto mas não configurado** — relevante só se Eixo 1 for escolhido. *Próximo passo:* criar conta Mapbox free tier, setar `VITE_MAPBOX_API_KEY`, alimentar `src/components/map/` com o GeoJSON gerado pelo pipeline.

---

## 4. Backend (Elysia)

**Estado atual:** zero código — nenhuma pasta `backend/`, `server/` ou `api/` existe; a seção Backend do `CLAUDE.md` está literalmente marcada "TBD". Todas as decisões de arquitetura estão em aberto e a maioria virou item bloqueante do checklist (Fase 2).

Lacunas não cobertas na Fase 2/3 do checklist:

- **Lista de endpoints candidatos não rascunhada por eixo.** *Próximo passo:* depois do eixo escolhido, desenhar o contrato mínimo direto num `backend/API_CONTRACT.md` ou via OpenAPI gerado pelo `@elysiajs/swagger`, junto com quem for mexer no frontend.
- **Decisão de autenticação real não registrada** (frontend hoje aponta pra `auth.method: 'jwt'` que o checklist já neutraliza com `skip: true`). *Próximo passo:* registrar explicitamente em `CLAUDE.md` que o MVP roda sem auth (dataset não tem CPF real para autenticar contra); só reavaliar se o eixo escolhido exigir papel diferenciado por CRE/unidade — e nesse caso usar mock de sessão simples, não um provider real.
- **Contrato de tipos compartilhado front/back não decidido** (Eden Treaty do Elysia vs duplicação manual de interfaces). *Próximo passo:* decisão leve — se o setup do Eden Treaty for rápido, adotar; senão, centralizar interfaces de resposta em `vite-ts/src/types/api.ts` e manter em sincronia manual com o backend.

---

## 5. Pipeline de Dados

**Estado atual:** zero linhas de código de ETL — nenhum script lê nenhum CSV/xlsx/shapefile hoje. Existem dois documentos de referência excelentes (`docs/desafio/dataset-dicionario.md` e o `README_dicionario_dados.md` dentro do dataset) que documentam os gotchas de leitura, mas sem implementação correspondente. As lacunas de maior risco (ausência de parser, runtime, destino dos dados, chunk de Query B) já estão na Fase 2 do checklist.

Lacunas não cobertas na Fase 2 do checklist:

- **Join materializado entre Query A, B, C, D não implementado** (chaves: A↔B por `prm_id`/`plm_id`/`ipl_id`, A↔D por `unidade`=`esc_codigo`, B↔C por `ich_perg_id`). *Próximo passo:* depois dos 4 loaders individuais, materializar pelo menos uma tabela larga (inscrição + unidade + respostas relevantes), documentando as chaves usadas.
- **Quebra de régua de pontuação 2023→2024 (Query C) sem tratamento.** *Próximo passo:* no loader de Query C, expor `perg_id` (estável, ao contrário de `ich_perg_id`) como chave de comparação e documentar explicitamente quais perguntas são comparáveis em quais janelas de anos — necessário para qualquer série temporal de pontuação.
- **`OferecimentosEvagas` tem schema inconsistente ano a ano** (nome/número de abas muda sem padrão; `totaalunoscreche2025.xlsx` tem typo no nome do arquivo — falta o "l"). *Próximo passo:* mapa hardcoded `{ano: {arquivo, aba}}` validado manualmente, não um loop genérico por convenção de nome. Só vale investir se o eixo usar dado de oferta/vagas (mais provável no Eixo 3).
- **`NascidosvivosRJ.xlsx` é export bruto tipo TabNet/DATASUS**, não tabela limpa (linhas de metadado no topo, formato pivô bairro×ano, código+nome de bairro concatenados). *Próximo passo:* script dedicado de limpeza (skip de linhas de metadado, split do código de bairro, melt wide→long). Só vale investir se Eixo 1 for escolhido.
- **Shapefile de microáreas está em CRS projetado** (SIRGAS 2000 / UTM 23S, metros) — precisa reprojeção para WGS84 antes de qualquer mapa web. *Próximo passo:* `gdf.to_crs(4326)` + export GeoJSON (geopandas) ou `ogr2ogr`. Só vale investir se Eixo 1 for escolhido e sobrar tempo.
- **Nenhuma camada de pré-agregação/cache** — os dados brutos somam >5,2M linhas; servir isso cru para uma tabela/gráfico React trava a UI. *Próximo passo:* depois do eixo escolhido, definir a lista curta de agregados que as telas realmente precisam e pré-computá-los uma vez no pipeline (KBs, não GBs) — esse é o artefato que o backend efetivamente serve.
- **Números de rede (unidades/creches) inconsistentes entre fontes** — briefing cita 854 (slide de rede) vs 872 (unidades com inscrição em Query A) vs 2.188 (cadastro completo em Query D). Não são necessariamente contraditórios (subconjuntos diferentes), mas isso não está reconciliado em nenhum lugar do repo. *Próximo passo:* padronizar no produto "872 unidades com inscrição de creche nos 5 processos analisados (2021-2025)" ao falar dos dados do hackathon, citando "2.188 no cadastro completo" só quando relevante ao contexto; evitar citar "854" sem explicar a que corresponde.

---

## 6. Infra & Deploy

**Estado atual:** nenhum projeto Vercel ou Railway criado/linkado ainda; `vercel.json` existente só tem rewrite de SPA fallback; zero CI (`.github/` não existe); repo confirmado só no GitHub, working tree limpo. Os itens de maior risco de "descobrir só no deploy" (projeto Vercel/Railway, Root Directory, env vars, CORS, persistência) já estão nas Fases 1 e 2 do checklist.

Lacunas não cobertas no checklist:

- **Sem instruções de "como rodar localmente"/"como fazer deploy" para o time.** *Próximo passo:* adicionar seção curta ao `README.md` raiz: comando para rodar o frontend (`cd vite-ts && yarn && yarn dev`), onde criar o `.env`, e — assim que existir — como rodar o backend local e fazer deploy manual se o auto-deploy falhar.
- **Nenhuma pipeline de deploy automático confirmada** (push → deploy). *Próximo passo:* ao criar os projetos Vercel/Railway, usar a integração nativa via GitHub App (não só CLI solto) para que todo push em `main` dispare deploy — não precisa de GitHub Actions customizado.
- **Dois lockfiles conflitantes** em `vite-ts/` (`yarn.lock` + `package-lock.json`, mas `packageManager: "yarn@1.22.22"` no `package.json`). *Próximo passo:* apagar `package-lock.json`, manter só `yarn.lock` (já coberto na Fase 1 do checklist — repetido aqui por completude).
- **`global-config.ts` referencia ~15 env vars de provedores não usados** (Firebase/Supabase/Auth0/Amplify) sem `.env`/`.env.example` no repo. *Próximo passo:* depois de decidido o eixo, criar `vite-ts/.env.example` só com as vars realmente usadas (mínimo `VITE_SERVER_URL`); remover do `package.json` as dependências de auth/DB provider não usadas para não confundir quem mexer em config depois.

---

## 7. Compliance de Submissão

**Estado atual:** repo confirmado **público** no GitHub, 2 commits, ambos hoje e ambos após 09h00 — em conformidade com as regras 1 e 4 do evento (desclassificação se violadas) na checagem de hoje. Nenhum CSV/xlsx/shapefile do dataset está commitado (`.gitignore` correto). O `README.md` é essencialmente um placeholder e nenhum dos 6 itens do checklist obrigatório de `regras-evento.md` está presente — os 4 itens mais críticos (resumo, arquitetura/papel do Claude, links, vídeo, e a frase contraditória sobre o eixo) já estão na Fase 4 do checklist.

Lacunas não cobertas no checklist:

- **Nome da equipe ausente no README.** *Próximo passo:* adicionar seção `## Equipe` com nome oficial e número do grupo (também exigido no e-mail de submissão).
- **Membros da equipe ausentes no README** (só um autor aparece no histórico git, o que não comprova a composição real do time). *Próximo passo:* listar membros com nome + função (dev, design, dados) na mesma seção `## Equipe`.
- **Número do grupo (exigido no assunto/corpo do e-mail para `eventos@taicor.ai`) não está registrado em nenhum arquivo do repo.** *Próximo passo:* confirmar com a organização se ainda não sabido, e anotar em local visível (`README.md` ou `CLAUDE.md`) para não ser esquecido na hora do envio final — já incluído como último item do checklist (Fase 4, item 21).
- **Verificação positiva a reconfirmar antes do envio:** repo público + commits pós-09h — não é lacuna, mas deve ser checado de novo no fechamento (já no checklist, item 21), especialmente se houver rebase/cherry-pick ou troca de remote ao longo do dia.

---

## 8. Documentação / Contexto de IA

**Estado atual:** `CLAUDE.md` documenta bem o domínio (regras de negócio numeradas, dicionário de dados) mas tem a seção Backend inteira marcada "TBD"; o `README.md` raiz é placeholder; `vite-ts/README.md` ainda é o README genérico do template Minimal (menciona mock server oficial do kit, links para versões pagas, nada do projeto real). Não existe nenhum registro de arquitetura nem de como o Claude atua *dentro* do produto — essa decisão em si já está na Fase 0 do checklist (item 3); aqui ficam os desdobramentos de documentação depois que a decisão for tomada.

- **`vite-ts/README.md` genérico do Minimal UI Kit**, sem nenhuma instrução deste projeto (não menciona `.env`, não menciona o backend Elysia). *Próximo passo:* reescrever com setup real (como rodar, quais `VITE_*` vars são necessárias, como conecta ao backend) ou reduzir e linkar de volta para o `README.md` raiz, que deve concentrar a submissão final.
- **`CLAUDE.md` seção Backend desatualizada ("TBD") conforme decisões avançam.** *Próximo passo:* atualizar em tempo real cada vez que uma decisão do checklist for tomada (runtime do pipeline, destino dos dados, estrutura de pastas, env vars) — não deixar a documentação da decisão só neste SDD, que fica congelado no tempo de geração.
- **Nenhum registro formal de arquitetura (diagrama simples + papel do Claude no produto).** *Próximo passo:* depois de implementado o endpoint de IA (checklist Fase 2, item 15), documentar em `## Arquitetura` no `README.md` com 1 diagrama simples e 1 parágrafo específico sobre o papel do Claude no produto (distinto de "usei Claude Code para programar") — é o item mais pesado do checklist de submissão (regras-evento.md linha 30).
- **Contrato de API não documentado formalmente** (OpenAPI/Swagger não gerado, `API_CONTRACT.md` não existe). *Próximo passo:* usar `@elysiajs/swagger` (já seria dependência mínima do scaffold do backend, checklist Fase 2 item 11) para gerar documentação automática dos endpoints, em vez de mantê-la manual.
- ~~`docs/SDD.md` não estava linkado a partir do `CLAUDE.md`~~ — **corrigido**: `CLAUDE.md` agora aponta pra este arquivo na seção Notas, e ganhou uma seção `## Decisões` com os placeholders (eixo, formato de entrega, papel da IA, runtime do pipeline, destino dos dados) prontos pra preencher assim que cada decisão sair.
- **`docs/desafio/prefeitura-rio-creches.md` e `regras-negocio.md` não vão sinalizar qual eixo foi escolhido** — descrevem os 3 eixos em pé de igualdade (correto como referência), mas quem abrir esses arquivos direto no meio da tarde pode achar que a decisão ainda está em aberto. *Próximo passo:* depois que o eixo sair (`CLAUDE.md` § Decisões preenchido), adicionar 1 linha de aviso no topo de cada um desses 2 arquivos ("Eixo escolhido: ver CLAUDE.md § Decisões").

---

## Nota final

Este documento foi gerado uma vez, hoje, a partir de uma varredura pontual. Ele **não se atualiza sozinho**. Para quem for mexer nele ao longo do dia:

- **Ao decidir o eixo** (checklist Fase 0, item 1): riscar (não apagar) os 2 mini-specs não escolhidos na seção 1, mover a decisão final + os "próximos passos" que ainda cabem para um changelog de decisões (pode ser uma seção nova `## Decisões` no `CLAUDE.md`, não precisa ser neste arquivo).
- **Ao fechar cada item do checklist da seção 2**: marcar o checkbox direto neste arquivo (`git commit` incluído) — serve como registro de progresso ao longo do dia, útil se alguém entrar no time no meio da tarde.
- **Não reabrir uma nova varredura completa** a cada hora — é caro e a maior parte do documento (seções 3-8) continua válida até o eixo mudar de novo ou uma fase inteira do checklist ser concluída. Atualizar pontualmente as seções afetadas conforme decisões forem tomadas, não regerar tudo.
- Se o prazo apertar e algo da seção 2 não fechar, isso é esperado — o próprio checklist já marca o que é razoável adiar. Preferir ter a Fase 4 (submissão) completa com um MVP menor do que um MVP maior sem README/vídeo/deploy — o critério de julgamento pesa fortemente em cima do que é demonstrável, não do que está "quase pronto".
