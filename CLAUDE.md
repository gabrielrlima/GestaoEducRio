# CLAUDE.md

## ⚠️ Evento: Claude Impact Lab Rio — hackathon de 1 dia (hoje, 30/08)

Prazo de entrega: **16h30 de hoje**. Primeiro commit válido só a partir das 09h00 de hoje (projeto com histórico anterior é desclassificado — mas usar libs/frameworks prontos, como Minimal UI Kit e Elysia, é permitido). Repositório final precisa ser **público**. Ver [docs/desafio/regras-evento.md](docs/desafio/regras-evento.md) para regras completas de submissão e critérios de julgamento (Impacto Real pesa 40% — mais que Produto+Engenharia somados).

## Decisões

Registrar aqui assim que forem tomadas (não deixar só no chat):

- **Eixo do desafio**: **Eixo 2 — Inscrição e Classificação**, na forma de ferramenta operacional (não dashboard analítico). Decidido em 2026-08-30.
- **Formato de entrega**: **Ferramenta operacional** — serviço que cadastra unidades de creche, gerencia vagas por unidade/grupamento/turno, e portal para o responsável cadastrar filhos e inscrevê-los em até 5 unidades (fluxo equivalente ao matricula.rio real). Ataca diretamente R2 (escolha sem critério territorial) e R8 (classificação por unidade em vez de por CPF).
- **Papel da IA dentro do produto**: `POST /api/ia/recomendar-unidades` — agente (Tool Runner, 7 tools) que monta a lista de até 5 unidades considerando **todos** os endereços da família (moradia, trabalho, alternativo), desvio de rota casa→trabalho, vagas atuais e **histórico real de convocação/vacância** (Query A, 2021-2025), devolvendo por unidade um parágrafo de justificativa e um `badge` opcional. Regra de projeto: **a IA não calcula nada** — todo número vem de `features.ts`, e o mesmo motor alimenta o fallback determinístico se a Claude API falhar/expirar (nunca quebra a demo). Ver [docs/desafio/agente-recomendacao.md](docs/desafio/agente-recomendacao.md).
- **Runtime do pipeline de dados**: TypeScript/Bun nativo — scripts em `backend/src/seed/*.ts`, sem Python.
- **Destino dos dados processados**: SQLite local (`backend/data/app.db`, via `bun:sqlite`, gitignored — cada um roda `bun run migrate && bun run seed`).
- **Login**: admin único genérico (usuário/senha em env); mãe (portal) por CPF + data de nascimento + código de 6 dígitos enviado por e-mail (Hostinger SMTP, `contato@keyva.com.br` — cai em modo console/log se `SMTP_PASS` não estiver configurado). Sessão via token opaco em `sessao` (sem JWT).
- **Deploy**: backend + banco no **Railway** (importação direta do GitHub, root directory `backend`, Nixpacks + `backend/railway.json`), front na **Vercel** (root directory `vite-ts`). Banco não é re-seedado na nuvem (o pipeline de seed depende de ~68MB de dataset externo não commitado) — `backend/src/db/bootstrap.ts` copia um snapshot commitado (`backend/seed-baseline/unidades-seed.db`, só `unidade`+`vaga_config`, sem dado de teste) pro volume persistente na primeira subida, e preserva o volume em redeploys seguintes. Passo a passo completo em [docs/desafio/deploy-runbook.md](docs/desafio/deploy-runbook.md). Decidido em 2026-08-30.
- **Portal da mãe — fluxo de cadastro**: login é tela pura (sem etapas, igual ao login admin) — só CPF/data de nascimento e, se for cadastro novo, e-mail (canal do código). Depois de autenticado entra na "área logada" em tabs: Dados pessoais → Endereço → Cadastrar filho(a) → Escolher unidades → Status. `nome`/`bairro` do responsável são opcionais na criação (default "Não informado"), preenchidos via PATCH já logado.
- **Endereços do responsável**: cadastra até 3 — residencial (obrigatório, é o usado pelo motor de recomendação de creches), trabalho e alternativo (opcionais, campos extra em `responsavel` prefixados `trabalho_`/`alternativo_`, não uma tabela separada). Decidido em 2026-08-30.

## Fluxo de Git (time)

Trabalhando com mais de um dev (Ian + Claude) — a partir de 2026-08-30 ~13h, **não commitar direto na `main`**. Fluxo:

1. Criar uma branch por tarefa (`git checkout -b <prefixo>/<nome-curto>`, ex.: `claude/deploy-vercel`, `ian/turno-selector`).
2. Testar a mudança (manual, ver seção de verificação de cada parte) antes de mergear.
3. Merge direto na `main` depois de testado — **sem PR formal** (decisão do time, dado o prazo). `git checkout main && git merge <branch> && git push`.
4. Puxar (`git pull`) antes de começar qualquer branch nova, pra não divergir do que o outro já mergeou.

## Projeto

Projeto de hackathon para o desafio da **Prefeitura do Rio (SME) — Inscrição Creche** ("Match Perfeito: Inteligência na Inscrição de Creche", sistema matricula.rio). O desafio tem 3 eixos-problema: Planejamento, Inscrição e Classificação, Convocação (ver `docs/desafio/briefing-oficial-sme.md`). **Eixo escolhido: Eixo 2 — Inscrição e Classificação** (ver seção Decisões acima para o escopo exato). Ver [docs/desafio/briefing-oficial-sme.md](docs/desafio/briefing-oficial-sme.md) (documento oficial, mais autoritativo) e [docs/desafio/prefeitura-rio-creches.md](docs/desafio/prefeitura-rio-creches.md) (briefing baseado nos slides) — leia antes de propor features ou schema de dados.

## Stack

- **Frontend**: React com o template [Minimal UI Kit](https://minimals.cc) (variante **Vite**), deploy na **Vercel**.
- **Backend**: [Elysia](https://elysiajs.com) (TypeScript, roda em **Bun**), deploy no **Railway**.
- **Versionamento**: GitHub.

## Frontend — Minimal UI Kit (Vite)

Cheat-sheet do essencial. Para detalhes, ver os docs em `docs/minimals/` (índice completo na seção Notas).

- **Código-fonte** vive em `src/`; assets estáticos (fontes, logos, imagens) em `public/`.
- **Estrutura de pastas principal**: `_mock/` (dados fake), `actions/` (lógica de app/estado), `auth/` (autenticação), `components/` (UI reutilizável), `layouts/` (layouts compartilhados), `locales/` (i18n), `routes/` (rotas/navegação), `sections/` (blocos de UI por feature), `theme/` (tokens/config MUI), `types/` (TS types).
  → detalhes: `docs/minimals/minimal-ui-structure-routing.md`
- **Tema/design tokens** ficam centralizados em `src/theme/`:
  - Cores e tipografia: `src/theme/theme-config.ts` + `src/theme/core/palette.ts` (editar os dois juntos ao trocar cor, senão a paleta fica inconsistente).
  - Cada cor tem 6 chaves fixas: `lighter`, `light`, `main`, `dark`, `darker`, `contrastText`.
  → detalhes: `docs/minimals/design-tokens.md`
- **Estilos globais**: `src/global.css` na raiz. CSS de componentes "extras" (mapa, lightbox, chart, scrollbar) fica em `src/components/<nome>/styles.css` e precisa ser importado manualmente via `@import` em `global.css` — não é automático.
  → detalhes: `docs/minimals/global-styles-config-mui-overrides.md`
- **Layout/navegação**: dimensões, transições e z-index do shell ficam em `src/layouts/core/css-vars.ts` (genérico) e `src/layouts/dashboard/css-vars.ts` (admin). Itens de nav em `config-nav-main` (site público) e `config-nav-dashboard` (admin).
  → detalhes: `docs/minimals/layout-navigation-settings.md`
- **Variáveis de ambiente**: prefixo obrigatório **`VITE_`**, declaradas em `.env` na raiz, lidas via `import.meta.env.VITE_NOME_DA_VARIAVEL`. Não usar prefixos de outros frameworks (`NEXT_PUBLIC_`, `REACT_APP_`) — a variável chega `undefined`.
  → detalhes: `docs/minimals/minimal-ui-kit-reference.md`
- **Importante**: o kit entrega só a UI — sem backend, sem persistência, sem auth real embutida. Isso é responsabilidade do backend Elysia.
  → visão geral: `docs/minimals/minimal-ui-kit-overview.md`

## Backend — Elysia

Fica em `backend/` (Bun + Elysia + TypeScript, SQLite via `bun:sqlite`, sem ORM). Ver [docs/desafio/backend-spec.md](docs/desafio/backend-spec.md) para a spec completa e a justificativa de cada decisão.

- **Rodar local**: `cd backend && bun install && bun run migrate && bun run seed && bun run dev` (o `seed` agora inclui `seed:historico`, que agrega a Query A em `unidade_historico`/`unidade_disponibilidade` — ~3s) — sobe em `http://localhost:3000`, docs Swagger em `/docs`, health check em `/health`. Copiar `.env.example` para `.env` antes (`ADMIN_USER`/`ADMIN_PASSWORD`, `SMTP_*`, `ANTHROPIC_API_KEY` — todos têm fallback seguro se ficarem em branco).
- **Estrutura**: `src/db/` (schema.sql + client + migrate), `src/modules/<dominio>/` (routes.ts + service.ts, um módulo por recurso: `unidades`, `vagas`, `responsaveis`, `criancas`, `inscricoes`, `classificacao`, `ia`, `auth`), `src/lib/` (helpers puros: geo/haversine, cpf, email, otp, errors), `src/seed/` (scripts que leem `data/dadoscreche/` e populam o SQLite).
- **Padrão de erro**: `ApiError` (`src/lib/errors.ts`) capturado num `onError` global em `src/index.ts` → `{ error: { code, message } }` com status HTTP correspondente. Sempre lançar `ApiError`/`badRequest`/`notFound`/`conflict`, nunca `throw new Error()` cru numa rota.
- **Auth**: `src/modules/auth/guard.ts` exporta `requireAdmin`/`requireResponsavel`/`requireAuth` (plugins Elysia `.derive`) — ainda **não aplicados** nas rotas de negócio (endpoints hoje são todos públicos pra facilitar teste; aplicar os guards antes da entrega final).
- **Dados**: `esc_codigo` é sempre `TEXT` (zero à esquerda é significativo). `situacao` de `inscricao_opcao` preserva a grafia exata do dataset real (`Cancelado na confirmacao`, sem acento). Trava de R8 é um índice único parcial no schema (`uq_oferta_ativa_por_inscricao`), não só lógica de aplicação.
- **Achado de seed**: o campo numérico `tipo` da Query D **não indica tipo de gestão** (checamos: mesmo prefixo de nome aparece nos 3 valores) — `tipo_gestao` é inferido pelo prefixo do nome (`CP ` → Parceria, resto → Direta), com o código bruto preservado em `tipo_origem_raw` só pra auditoria.

## Notas

- `docs/desafio/briefing-oficial-sme.md` — **documento oficial "problema completo"** (fonte: Briefing_SME.docx, mais detalhado e autoritativo que os slides), com nome oficial do desafio ("Match Perfeito"), tabela exata de pesos de pontuação, gaps do processo atual (ex.: 0,2% de inconsistência de estado, colisão de identidade de criança), fluxo detalhado e a "utilidade sugerida" de cada tabela de dados. **Em caso de divergência com os outros docs, este é o mais autoritativo.**
- `docs/desafio/prefeitura-rio-creches.md` — briefing narrativo do desafio (problema, fluxos, dados disponibilizados, anonimização), baseado nos slides do evento. Ler antes de propor features.
- `docs/desafio/regras-negocio.md` — regras de negócio atômicas e numeradas (R1, R2, ...), separadas do briefing narrativo. Usar como checklist ao desenhar schema, validações, endpoints ou lógica de classificação/convocação.
- `docs/desafio/regras-evento.md` — regras de **submissão/competição** do hackathon (prazo, README obrigatório, critérios de julgamento). Diferente das regras de negócio acima.
- `docs/desafio/dataset-dicionario.md` — dicionário de dados **oficial e preciso** (fonte: repo [`CIT-SME-RJ/dadoscreche`](https://github.com/CIT-SME-RJ/dadoscreche)), com colunas exatas, chaves de join, gotchas de leitura (encoding, arquivos sem cabeçalho, limites de memória) e a distribuição real de `situacao`. Mais autoritativo que os números em `prefeitura-rio-creches.md`. **Ler antes de escrever qualquer código que leia os dados.**
- `docs/desafio/planilhas-dicionario.md` — SDD das planilhas complementares (`OferecimentosEvagas/*.xlsx`, `NascidosvivosRJ.xlsx`), inspecionadas diretamente (não têm dicionário oficial). Documenta o drift de schema ano a ano e um achado não-documentado na fonte: os códigos de unidade dessas planilhas batem com `esc_codigo`/`unidade` do dataset core (só com zero à esquerda inconsistente).
- `docs/desafio/higienizacao-bairro.md` — estratégia em camadas pra recuperar `bairro` das ~258 unidades que vêm com endereço vazio na Query D (implementada em `seed-unidades.ts`: reduz de 210 → 152 sem bairro na base final). Documenta também o que **não** deu pra recuperar automaticamente e por quê (sem CEP nem coordenadas na fonte pras mesmas linhas) — resíduo fica como curadoria manual via `PATCH /unidades/:id`.
- `docs/desafio/higienizacao-creches.md` — a Query D traz a rede municipal **inteira** (escola regular, CIEP, CEJA...), não só creche, apesar do dicionário oficial sugerir o contrário. `seed-unidades.ts` agora classifica cada unidade (via `Tipo` da planilha complementar + heurístico por prefixo do nome) e só marca `ativa=1` quem é creche de verdade — front usa `GET /unidades?ativa=true` (1.061 de 2.129 unidades).
- `docs/minimals/` contém a referência completa e destilada do Minimal UI Kit (fonte: docs.minimals.cc), dividida em:
  - `minimal-ui-kit-overview.md` — Overview & Getting Started
  - `minimal-ui-structure-routing.md` — Estrutura de pastas & Roteamento
  - `design-tokens.md` — Design Tokens (cores, tipografia, ícones, shadows, CSS vars, logo)
  - `global-styles-config-mui-overrides.md` — Estilos globais, config & overrides MUI
  - `layout-navigation-settings.md` — Layout, navegação & settings
  - `minimal-ui-kit-reference.md` — Env vars, chamadas de API, autenticação, i18n, Tailwind
- `docs/desafio/agente-recomendacao.md` — como funciona o agente de recomendação: separação entre cálculo determinístico (`features.ts`) e escolha da IA, as métricas históricas derivadas da Query A (`taxa_oferta`, vacância, concorrência) e a classificação em tercis por bairro, os cálculos de rota (desvio diário / ponto-segmento), as 7 tools, o formato de saída com `badge`, o fallback e o harness de avaliação (`bun run eval:ia`).
- `docs/desafio/backend-spec.md` — spec completa do backend Elysia (schema DDL-ready, endpoints, como R2/R8 são resolvidos, ordem de implementação sugerida) — gerada antes do scaffold, algumas decisões de auth evoluíram durante a implementação (ver seção Backend acima para o estado real).
- `docs/arquitetura-c4.md` — Modelo C4 (Contexto → Container → Componente) da arquitetura real implementada, com tabela de decisões de arquitetura (ADR-lite). Backend hoje é CRUD por módulo, **não CQRS** — decisão registrada e justificada nesse doc.
- `docs/SDD.md` — **checklist de trabalho do dia**, não doc de referência estático: varredura de todas as lacunas do repo (frontend, backend, dados, produto, infra, submissão, documentação) com um checklist priorizado por dependência até o prazo das 16h30. Gerado uma vez, ponto-no-tempo — atualizar pontualmente, não regenerar do zero.
- `docs/desafio/deploy-runbook.md` — passo a passo de deploy (Railway pro backend+banco, Vercel pro front): configuração de root directory, variáveis de ambiente, volume persistente, e por que o banco de produção usa um snapshot commitado em vez de rodar o seed na nuvem.
- Este CLAUDE.md deve ser mantido atualizado conforme o projeto evolui — especialmente a seção Decisões acima, e quando o produto for definido e o backend for scaffolded.
