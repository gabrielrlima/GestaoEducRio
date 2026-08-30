# Layout, Navigation & Settings

> Referência distilada sobre o **Minimal UI Kit** (Vite + React + MUI), baseada em `docs.minimals.cc`. Documento de contexto para uso por IA/desenvolvedores neste projeto.

## Fontes consultadas

| Página | Status |
|---|---|
| `docs.minimals.cc/layout/` | OK |
| `docs.minimals.cc/navigation/` | OK (conteúdo oficial é escasso — a página é basicamente uma porta de entrada para um vídeo tutorial, sem trechos de código no texto) |
| `docs.minimals.cc/settings/` | OK |

---

## 1. Layout

### Propósito
Controla as dimensões, espaçamentos, transições e z-index dos dois "esqueletos" de layout do template: o layout **core** (genérico, usado por qualquer shell de página) e o layout **dashboard** (o admin propriamente dito, com nav lateral + header).

### Onde mexer

```
src/layouts/
├── core/
│   └── css-vars.ts        # dimensões/z-index do nav e do header (nível core)
├── dashboard/
│   └── css-vars.ts        # transições, larguras do nav, padding do conteúdo
├── config-nav-main        # itens de navegação do MainLayout (site público/marketing)
└── config-nav-dashboard   # itens de navegação do DashboardLayout (admin)
```

### Variáveis CSS relevantes

- **Core (`core/css-vars.ts`)**
  - `--layout-nav-zIndex`, `--layout-nav-mobile-width` (padrão 288px)
  - `--layout-header-blur` (8px), `--layout-header-zIndex`
  - `--layout-header-mobile-height` (64px), `--layout-header-desktop-height` (72px)
- **Dashboard (`dashboard/css-vars.ts`)**
  - `--layout-transition-easing` (linear), `--layout-transition-duration` (120ms)
  - `--layout-nav-mini-width` (88px) e `--layout-nav-vertical-width` (300px) — controlam o nav colapsado vs expandido
  - `--layout-nav-horizontal-height` (64px)
  - Padding do conteúdo: `--layout-dashboard-content-pt`, `--layout-dashboard-content-pb`, `--layout-dashboard-content-px`

### Convenção de customização
1. Identificar se a mudança é de dimensão/espaçamento (vai em `css-vars.ts` do layout correspondente — core ou dashboard) ou de itens de menu (vai nos arquivos `config-nav-*`).
2. Ajustar os valores numéricos/tokens de tema diretamente nas variáveis CSS.
3. Reconstruir os arrays de navegação em `config-nav-main` / `config-nav-dashboard` quando a estrutura de menu mudar.

**Gotcha:** as larguras do nav (mini vs vertical) e as alturas do header (mobile vs desktop) são valores separados — alterar um não afeta o outro automaticamente; ambos precisam ser sincronizados manualmente se o objetivo é uma mudança visual consistente entre breakpoints.

---

## 2. Navigation

### Propósito
Cobre a customização do menu padrão do dashboard, incluindo o caso de se ter **múltiplos menus** (não apenas um único nav lateral).

### O que a documentação oficial realmente entrega
A página em si é enxuta: não há blocos de código nem a definição formal do shape de um item de navegação (propriedades como `title`, `path`, `icon`, `children`, etc. não aparecem no texto da página). O conteúdo prático está concentrado em um **vídeo tutorial no YouTube** linkado a partir da página, com screenshots de "antes/depois" (desktop e mobile) do resultado esperado.

### Onde a navegação é efetivamente configurada no código
Com base na seção de Layout (acima), os arquivos que controlam os itens de menu são:
- `src/layouts/config-nav-main` — itens de navegação do `MainLayout`
- `src/layouts/config-nav-dashboard` — itens de navegação do `DashboardLayout`

Para múltiplos menus, a lógica esperada (conforme o propósito da página) é duplicar/estender esses arrays de configuração e alternar qual conjunto é renderizado pelo layout, mas os detalhes exatos de implementação **não estão documentados em texto** — só no vídeo.

**Gotcha:** ao trabalhar em navegação neste kit, não espere achar a resposta lendo a página de docs — o texto escrito é só um resumo de uma linha; a implementação de referência está no vídeo. Se for necessário replicar o padrão "múltiplos menus", inspecionar diretamente os arquivos `config-nav-*` do projeto é mais confiável do que depender da doc.

---

## 3. Settings

### Propósito
Gerencia o provedor de configurações de tema (modo claro/escuro/sistema, cor primária, direção do texto, etc.), com suporte a persistência via `localStorage` (SPA/Vite) ou cookies (Next.js), além de localização opcional dos componentes MUI.

### Onde mexer

```
src/components/settings/        # provider de settings + valores default
src/theme/create-theme.(js|ts)  # fábrica de criação do tema
src/theme/theme-config.(js|ts)  # configuração base do tema (ex.: defaultMode)
src/App.(jsx|tsx)               # ponto de montagem (Vite/CRA)
src/app/layout.(jsx|tsx)        # ponto de montagem (Next.js App Router)
```

### Identificadores-chave

- `defaultSettings` — objeto com a configuração default do tema, importado do módulo de settings.
- `cookieSettings` — equivalente a `defaultSettings`, mas lido de cookies (fluxo Next.js).
- `settingsState` — estado de settings definido pelo usuário em runtime.
- `themeConfig.defaultMode` — modo inicial do tema (`'light' | 'dark' | 'system'`), em `theme-config`.
- `SettingsProvider` — componente que envolve a aplicação e recebe `defaultSettings` ou `cookieSettings`.
- `detectSettings()` — função server-side (Next.js) para ler os settings salvos em cookie; precisa ser chamada de forma assíncrona em Server Components.
- `createTheme()` — fábrica de tema que recebe `settingsState` + overrides de tema.
- `applySettingsToTheme()` / `applySettingsToComponents()` — aplicam os settings do usuário sobre o tema base e sobre os overrides de componentes, respectivamente.

### Fluxo típico de setup

```tsx
// 1) importar defaults
import { defaultSettings } from 'src/components/settings';

// 2) envolver a app
<SettingsProvider defaultSettings={defaultSettings}>
  <App />
</SettingsProvider>

// 3) no theme provider, aplicar os settings ao tema base
const theme = createTheme({ settingsState, themeOverrides: baseTheme });
```

Para Next.js, o padrão troca `defaultSettings` por `cookieSettings`, obtido via `detectSettings()` chamado no server.

### Gotchas / convenções
- **Sempre limpar `localStorage` (ou os cookies)** ao alterar os valores de `defaultSettings` — configurações antigas em cache sobrescrevem os novos defaults e mascaram a mudança.
- No fluxo Next.js, `detectSettings()` é assíncrona e deve ser chamada em um Server Component.
- Ao usar cookies para persistir tema (evitando flash de tema errado), adicionar `suppressHydrationWarning` na tag `<html>`.
- Localização (i18n) dos componentes MUI é opcional e não vem pronta — é preciso injetar manualmente os componentes de locale do Material-UI, seguindo a documentação oficial do MUI.

---

## Cheatsheet rápido (para referência de IA)

| Preciso mexer em... | Vou em... |
|---|---|
| Largura/altura/z-index do nav ou header | `src/layouts/core/css-vars.ts` ou `src/layouts/dashboard/css-vars.ts` |
| Itens do menu lateral do admin | `src/layouts/config-nav-dashboard` |
| Itens do menu do site/marketing | `src/layouts/config-nav-main` |
| Múltiplos menus / trocar de nav dinamicamente | `config-nav-*` + lógica própria (doc oficial só tem vídeo, sem exemplo escrito) |
| Modo claro/escuro default, cor primária default | `src/theme/theme-config.(js|ts)` (`themeConfig.defaultMode`) e `src/components/settings` (`defaultSettings`) |
| Persistência de settings (Vite vs Next.js) | `SettingsProvider` com `defaultSettings` (localStorage) ou `cookieSettings` + `detectSettings()` (cookies) |
