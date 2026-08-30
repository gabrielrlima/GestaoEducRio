# Project Structure & Routing

> Referência condensada sobre o **Minimal UI Kit** (template admin Next.js/Vite + React + MUI, docs.minimals.cc) para uso como memória de contexto em assistentes de IA. Cobre estrutura de pastas, limpeza de projeto, dependências, deploy em subpasta e roteamento/navegação.

## 1. Estrutura de pastas (`/structure/`)

O template organiza o código-fonte dentro de `src/`, com `public/` reservado para assets estáticos (fontes, logos, imagens).

Principais subpastas de `src/` e sua função:

- `_mock/` — dados fictícios usados em desenvolvimento/testes (mantidos separados do código de produção).
- `actions/` — lógica de aplicação e manipulação de estado.
- `app/` — estrutura central da aplicação (rotas do Next.js quando aplicável).
- `auth/` — lógica de autenticação de usuário.
- `components/` — componentes de UI reutilizáveis.
- `layouts/` — layouts compartilhados entre páginas.
- `locales/` — arquivos de internacionalização (i18n).
- `routes/` — definição de rotas e navegação.
- `sections/` — blocos maiores de UI por funcionalidade (telas/páginas compostas).
- `theme/` — tokens de estilo e configuração de tema MUI.
- `types/` — tipos e interfaces TypeScript.
- `utils/` — funções utilitárias.
- `lib/` — bibliotecas/utilitários customizados.

Arquivos-chave dentro de `src/`:

- `global-config.ts` — configurações globais da aplicação.
- `global.css` — estilos globais.

Arquivos de configuração na raiz do projeto:

- `.env` — variáveis de ambiente.
- `.editorconfig` — regras de estilo de código (indentação, charset etc.).
- `eslint.config.mjs` — regras de lint.
- `prettier.config.mjs` — regras de formatação.
- `tsconfig.json` — opções do compilador TypeScript.
- `next.config.ts` — configuração do Next.js (quando o projeto usa essa variante).

```text
src/
├── _mock/        # dados fake para dev/testes
├── actions/      # lógica de estado/negócio
├── app/          # rotas do Next.js (quando aplicável)
├── auth/         # autenticação
├── components/   # UI reutilizável
├── layouts/      # layouts compartilhados
├── locales/      # i18n
├── routes/       # rotas e navegação
├── sections/     # blocos de tela por feature
├── theme/        # tema/design tokens
├── types/        # tipos TS
└── utils/ lib/    # helpers e libs
```

**Convenção a observar:** dados mock ficam isolados em `_mock/`, nunca misturados com código de produção — útil para saber onde procurar (ou remover) fixtures de exemplo.

## 2. Limpeza do projeto (`/clean-project/`)

Guia para remover código, páginas e dependências não utilizadas antes de customizar o boilerplate, reduzindo tamanho e melhorando performance.

Passos recomendados:

1. Apagar manualmente páginas de exemplo não usadas em `/pages` ou `/app` (ex.: `src/pages/contact-us.tsx`).
2. Criar/ajustar `knip.jsonc` na raiz do projeto para configurar a análise estática.
3. Rodar `npx knip` para detectar exports, arquivos e dependências não utilizados.
4. Revisar manualmente os itens apontados antes de excluí-los.

Chaves relevantes do `knip.jsonc`:

- `paths` — mapeia diretórios de origem.
- `project` — define quais extensões de arquivo serão escaneadas.
- `ignoreExportsUsedInFile` — booleano para ignorar exports já usados no próprio arquivo.
- `ignoreDependencies` — padrões (regex) de pacotes a ignorar na checagem.
- `ignore` — pastas/arquivos excluídos da análise (ex.: `"src/_mock/**"`).

```jsonc
// knip.jsonc (exemplo ilustrativo)
{
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": ["src/_mock/**"],
  "ignoreDependencies": ["^@types/.*"],
  "ignoreExportsUsedInFile": true
}
```

**Gotcha:** o Knip é uma ferramenta de apoio (helper), não uma fonte de verdade — os resultados exigem julgamento humano antes de deletar algo, pois pode haver falsos positivos. Ver documentação oficial do Knip para detalhes avançados.

## 3. Dependências (`/dependencies/`)

Mapa de referência para decidir o que manter, remover ou instalar no projeto (base Next.js/Vite + React + MUI).

Categorias principais:

- **Base:** Next.js/Vite, React, React DOM.
- **UI/estilo:** ecossistema Material-UI (`@mui/material`, `@mui/lab`, pacotes `@mui/x-*`), Emotion (CSS-in-JS), fontes via `@fontsource-variable/*`.
- **Formulários:** `react-hook-form`, `zod`, `@hookform/resolvers`.
- **Editor de texto rico:** Tiptap e suas extensões.
- **Gráficos/dados:** ApexCharts.
- **i18n:** ecossistema `i18next`.
- **Drag-and-drop:** pacotes `@dnd-kit`.
- **Carrossel:** Embla Carousel e plugins.
- **Markdown:** `react-markdown` com plugins `rehype`.
- **Autenticação (opcionais, escolher um):** Auth0, AWS Amplify, Firebase, Supabase.
- **Utilitários:** `axios` (HTTP), `dayjs` (datas), `framer-motion` (animações), `SWR` (data fetching), `sonner` (notificações/toasts).
- **Dev tools:** ESLint com plugins `perfectionist`, `import` e regras para React; suporte a TS/JS.

**Convenção:** o template inclui múltiplas opções para a mesma necessidade (ex.: 4 provedores de auth) — a orientação é revisar cada categoria e remover o que não será usado, em vez de manter tudo instalado por padrão.

## 4. Rodando em subpasta (`/subfolder/`)

Como servir o dashboard a partir de um caminho não-raiz (ex.: `meusite.com/sub`) em vez do domínio raiz. **Aplica-se a partir da v6.1.0** do template.

### Projetos Vite

- `.env`: definir `VITE_ASSETS_DIR=/sub`
- `vite.config.ts`: adicionar `base: '/sub/'`
- `src/main.tsx`: configurar o basename do router, de uma das duas formas:
  - envolver a app com `<BrowserRouter basename="sub">`, ou
  - passar `basename: '/sub'` na config de `createBrowserRouter()`.

### Projetos Next.js

- `.env`: definir `NEXT_PUBLIC_ASSETS_DIR=/sub`
- `next.config.mjs`: adicionar `basePath: '/sub'`

```ts
// vite.config.ts (Vite)
export default defineConfig({
  base: '/sub/',
});

// .env
VITE_ASSETS_DIR=/sub
```

**Gotchas:**

- O valor do subpath precisa ser **idêntico** em todos os pontos (env var, config de build e basename do router) — inconsistência quebra assets/rotas.
- Nomes de propriedade variam por framework: `base` (Vite) vs `basePath` (Next.js).
- Prefixo de env var também varia: `VITE_` (Vite) vs `NEXT_PUBLIC_` (Next.js).
- Notação: barra final em `base`/`basePath` (`/sub/`) mas sem barra final no `basename` do router (`sub`).

## 5. Roteamento e navegação (`/routing/`)

Cobre como adicionar itens de menu e novas rotas, com variações para Vite/CRA e Next.js.

Arquivos relevantes:

- `src/layouts/nav-config-dashboard.tsx` — configuração dos itens de navegação (menu lateral).
- `src/routes/sections/dashboard.tsx` — definição das rotas do dashboard (Vite/CRA).
- `src/routes/sections/index.js` — ponto central que agrega as seções de rotas.
- `src/app/dashboard/[page-name]/page.tsx` — padrão de rota no App Router do Next.js.

Estrutura de cada item em `navData`:

- `subheader` — rótulo de agrupamento da seção no menu.
- `title` — nome exibido.
- `path` — destino da rota.
- `icon` — ícone associado.
- `children` (opcional) — itens de navegação aninhados.
- `roles` (opcional) — array de papéis/roles com permissão de ver o item (controle de acesso).

```ts
// exemplo ilustrativo de item em navData
{
  title: 'Produtos',
  path: '/dashboard/products',
  icon: <Iconify icon="solar:box-bold" />,
  roles: ['admin'],
  children: [
    { title: 'Lista', path: '/dashboard/products/list' },
  ],
}
```

Passo a passo:

- **Novo item de menu:** adicionar objeto ao array `navData` com, no mínimo, `title`, `path` e `icon`.
- **Nova rota (Vite/CRA):** importar o componente de página com `lazy()` e registrar `path`/`element` no array `dashboardRoutes`.
- **Nova rota (Next.js):** criar uma nova pasta em `src/app/dashboard/` contendo um `page.tsx`.
- **Definir página inicial padrão:** usar uma rota de redirect, ex. `{ path: '/', element: <Navigate to={CONFIG.auth.redirectPath} /> }`, para pular a home e ir direto a outra tela.

Identificadores importantes:

- `CONFIG.auth.skip` — flag para bypassar a autenticação (útil em dev).
- `CONFIG.auth.redirectPath` — rota padrão de destino após login/redirect.
- `AuthGuard` — componente wrapper que protege rotas exigindo autenticação.
- `RouterLink` — componente de link customizado para navegação interna.

**Convenções:**

- Filtragem por permissão usa a propriedade `roles` (array) em cada item de navegação.
- Carregamento sob demanda (lazy loading) das páginas é combinado com `Suspense` e um fallback `LoadingScreen`.
- Rotas aninhadas seguem o padrão de array `children`, espelhando a estrutura de `navData`.

---

### Fontes consultadas

- https://docs.minimals.cc/structure/
- https://docs.minimals.cc/clean-project/
- https://docs.minimals.cc/dependencies/
- https://docs.minimals.cc/subfolder/
- https://docs.minimals.cc/routing/
