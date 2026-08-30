# CLAUDE.md

## ⚠️ Evento: Claude Impact Lab Rio — hackathon de 1 dia (hoje, 30/08)

Prazo de entrega: **16h30 de hoje**. Primeiro commit válido só a partir das 09h00 de hoje (projeto com histórico anterior é desclassificado — mas usar libs/frameworks prontos, como Minimal UI Kit e Elysia, é permitido). Repositório final precisa ser **público**. Ver [docs/desafio/regras-evento.md](docs/desafio/regras-evento.md) para regras completas de submissão e critérios de julgamento (Impacto Real pesa 40% — mais que Produto+Engenharia somados).

## Decisões

Registrar aqui assim que forem tomadas (não deixar só no chat):

- **Eixo do desafio**: TBD (Planejamento / Inscrição-Classificação / Convocação) — ver `docs/SDD.md` seção 1 para specs candidatos.
- **Formato de entrega**: TBD (dashboard analítico / ferramenta operacional / POC de simulação).
- **Papel da IA dentro do produto**: TBD (obrigatório pelas regras do evento — não é só "usei Claude Code pra programar").
- **Runtime do pipeline de dados**: TBD (Python vs TypeScript/Bun).
- **Destino dos dados processados**: TBD (JSON estático / SQLite / Postgres Railway).

## Projeto

Projeto de hackathon para o desafio da **Prefeitura do Rio (SME) — Inscrição Creche** (sistema matricula.rio). O desafio tem 3 eixos-problema: **Planejamento** (antecipar demanda futura, hoje baseado só em histórico), **Inscrição e Classificação** (escolha de unidades sem critério territorial, classificação por unidade em vez de por CPF) e **Convocação** (processo manual e lento quando surge vaga). Ainda não decidimos qual eixo o produto vai atacar. Ver [docs/desafio/prefeitura-rio-creches.md](docs/desafio/prefeitura-rio-creches.md) para o briefing completo (fluxos, dados disponibilizados, anonimização) — leia esse arquivo antes de propor features ou schema de dados.

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

Ainda **não scaffolded** — convenções TBD. Preencher esta seção assim que a estrutura inicial do backend for criada (organização de rotas/plugins, padrão de resposta de erro, autenticação, integração com o frontend, variáveis de ambiente do Railway, etc.).

## Notas

- `docs/desafio/prefeitura-rio-creches.md` — briefing narrativo do desafio (problema, fluxos, dados disponibilizados, anonimização), baseado nos slides do evento. Ler antes de propor features.
- `docs/desafio/regras-negocio.md` — regras de negócio atômicas e numeradas (R1, R2, ...), separadas do briefing narrativo. Usar como checklist ao desenhar schema, validações, endpoints ou lógica de classificação/convocação.
- `docs/desafio/regras-evento.md` — regras de **submissão/competição** do hackathon (prazo, README obrigatório, critérios de julgamento). Diferente das regras de negócio acima.
- `docs/desafio/dataset-dicionario.md` — dicionário de dados **oficial e preciso** (fonte: repo [`CIT-SME-RJ/dadoscreche`](https://github.com/CIT-SME-RJ/dadoscreche)), com colunas exatas, chaves de join, gotchas de leitura (encoding, arquivos sem cabeçalho, limites de memória) e a distribuição real de `situacao`. Mais autoritativo que os números em `prefeitura-rio-creches.md`. **Ler antes de escrever qualquer código que leia os dados.**
- `docs/desafio/planilhas-dicionario.md` — SDD das planilhas complementares (`OferecimentosEvagas/*.xlsx`, `NascidosvivosRJ.xlsx`), inspecionadas diretamente (não têm dicionário oficial). Documenta o drift de schema ano a ano e um achado não-documentado na fonte: os códigos de unidade dessas planilhas batem com `esc_codigo`/`unidade` do dataset core (só com zero à esquerda inconsistente).
- `docs/minimals/` contém a referência completa e destilada do Minimal UI Kit (fonte: docs.minimals.cc), dividida em:
  - `minimal-ui-kit-overview.md` — Overview & Getting Started
  - `minimal-ui-structure-routing.md` — Estrutura de pastas & Roteamento
  - `design-tokens.md` — Design Tokens (cores, tipografia, ícones, shadows, CSS vars, logo)
  - `global-styles-config-mui-overrides.md` — Estilos globais, config & overrides MUI
  - `layout-navigation-settings.md` — Layout, navegação & settings
  - `minimal-ui-kit-reference.md` — Env vars, chamadas de API, autenticação, i18n, Tailwind
- `docs/SDD.md` — **checklist de trabalho do dia**, não doc de referência estático: varredura de todas as lacunas do repo (frontend, backend, dados, produto, infra, submissão, documentação) com um checklist priorizado por dependência até o prazo das 16h30. Gerado uma vez, ponto-no-tempo — atualizar pontualmente, não regenerar do zero.
- Este CLAUDE.md deve ser mantido atualizado conforme o projeto evolui — especialmente a seção Decisões acima, e quando o produto for definido e o backend for scaffolded.
