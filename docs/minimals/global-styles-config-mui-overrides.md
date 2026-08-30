# Global Styles, Config & MUI Overrides

> Destilado de referência sobre o Minimal UI Kit (Vite + React + MUI, docs.minimals.cc) para uso como memória de contexto de IA. Cobre três páginas oficiais: Global Styles, Global Config e MUI Overrides.

## 1. Estilos Globais (`global-styles`)

**Para que serve:** ponto único onde ficam registrados os estilos CSS "soltos" que não pertencem ao sistema de tema do MUI — principalmente os CSS de componentes de terceiros/extras (mapa, lightbox, gráficos, scrollbar customizada).

**Arquivo principal:**
- `src/global.css` — arquivo raiz de estilos globais da aplicação.

**Convenção de organização:**
- Cada componente "extra" tem seu próprio CSS dentro de `src/components/<nome-do-componente>/styles.css` (ex.: `src/components/scrollbar/styles.css`, `src/components/map/styles.css`, `src/components/lightbox/styles.css`, `src/components/chart/styles.css`).
- Esses arquivos **não são importados automaticamente** — é preciso referenciá-los manualmente em `src/global.css` via `@import`.

```css
/* src/global.css */
@import './components/scrollbar/styles.css';
@import './components/map/styles.css';
@import './components/lightbox/styles.css';
@import './components/chart/styles.css';

a { color: inherit; text-decoration: none; }
```

**Gotcha importante:** ao adicionar/instalar um componente do kit completo que não veio na versão mínima (ex.: chart, lightbox), só copiar a pasta do componente não é suficiente — é obrigatório também importar o `styles.css` correspondente em `global.css`, senão o componente renderiza sem estilo. `global.css` também aceita CSS puro normal (resets, seletores de tags HTML, etc.), não só imports.

---

## 2. Configuração Global (`global-config`)

**Para que serve:** arquivo único e centralizado com todas as configurações de app, integrações e credenciais de serviços externos, para não espalhar `process.env`/chaves de API pelo código.

**Arquivo principal:**
- `src/global-config.ts`

**Principais chaves expostas:**
- `appName` — nome exibido do app.
- `appVersion` — normalmente lido do `package.json`.
- `serverUrl` / `assetsDir` — URLs derivadas de variáveis de ambiente.
- `auth.method` — provedor de autenticação ativo: `jwt` | `amplify` | `firebase` | `supabase` | `auth0`.
- `auth.skip` — booleano para pular autenticação (bypass de login).
- `auth.redirectPath` — rota de redirecionamento pós-login.
- Blocos de credenciais por provedor: Mapbox (API key), Firebase (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId), AWS Amplify (userPoolId, userPoolWebClientId, region), Auth0 (clientId, domain, callbackUrl), Supabase (url, anonKey).

**Convenção:** os valores vêm de variáveis de ambiente com fallback para string vazia via nullish coalescing (`env.VAR ?? ''`), evitando `undefined` se a env var não estiver setada.

```ts
// src/global-config.ts (ilustrativo)
export const globalConfig = {
  appName: 'Minimal UI',
  serverUrl: import.meta.env.VITE_SERVER_URL ?? '',
  auth: {
    method: 'jwt',
    skip: false,
    redirectPath: '/dashboard',
  },
  // ...mapbox, firebase, amplify, auth0, supabase
};
```

**Gotcha / atenção:**
- A documentação oficial fetchada mostrou os nomes de env var com prefixo `NEXT_PUBLIC_` (ex.: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_SUPABASE_URL`) — isso corresponde à variante **Next.js** do template. Como este projeto é **Vite + React**, o prefixo real das env vars no `.env` deve ser `VITE_` (padrão do Vite, lido via `import.meta.env`), não `NEXT_PUBLIC_`. Ao configurar `.env` neste projeto, adaptar o prefixo — não copiar literalmente os nomes `NEXT_PUBLIC_*` da doc.
- `auth.skip` (bypass de autenticação) deve ser usado só em desenvolvimento; deixar ativo em produção é um risco de segurança.
- Export estático (`isStaticExport` / equivalente de build estático) é uma opção de build separada, configurada fora do `global-config.ts` (nos arquivos de config do framework, ex. `next.config.ts` na variante Next.js — no Vite o equivalente seria `vite.config.ts`).

---

## 3. Sobrescrita de Componentes MUI (`mui-overrides`)

**Para que serve:** customizar a aparência/comportamento **padrão** de componentes do MUI (Material UI) de forma centralizada no tema, em vez de repetir `sx`/props em cada uso do componente pelo app.

**Estrutura de pastas:**
```
src/theme/core/components/
├── accordion.jsx
├── alert.jsx
├── appbar.jsx
└── ... (um arquivo por componente MUI)
```
Convenção: 1 componente MUI = 1 arquivo dedicado, nomeado em minúsculo conforme o componente (ex.: `appbar.jsx` para `MuiAppBar`, `alert.jsx` para `MuiAlert`).

**Duas alavancas de customização, por componente:**
- `styleOverrides` — sobrescreve estilos/CSS das partes internas do componente (ex.: `root`).
- `defaultProps` — define props padrão aplicadas a toda instância do componente, sem precisar passá-las manualmente.

```tsx
// src/theme/core/components/appbar.tsx
const MuiAppBar: Components<Theme>['MuiAppBar'] = {
  defaultProps: { color: 'transparent' },
  styleOverrides: {
    root: { boxShadow: 'none' },
  },
};
```

**Gotcha importante:** qualquer alteração feita nesses arquivos é **global** — afeta todas as instâncias do componente no app inteiro, não apenas um caso de uso específico. Para uma variação pontual, usar `sx`/props locais no componente em vez de editar o arquivo de tema. Os arquivos seguem a tipagem oficial do MUI (`Components<Theme>['MuiXxx']`), então vale consultar a documentação de customização de tema do MUI para propriedades disponíveis por componente.

---

## Resumo rápido (onde mexer em quê)

| Preciso de... | Vou em... |
|---|---|
| CSS extra de um componente (map, chart, lightbox, scrollbar) | `src/components/<nome>/styles.css` + `@import` em `src/global.css` |
| Nome do app, URL do servidor, método de auth, chaves de provedores (Firebase/Auth0/Supabase/Amplify/Mapbox) | `src/global-config.ts` |
| Mudar aparência/props padrão de um componente MUI (AppBar, Alert, Accordion, etc.) para o app inteiro | `src/theme/core/components/<componente>.jsx` (`styleOverrides` / `defaultProps`) |
