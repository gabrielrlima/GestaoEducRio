# Design Tokens (Colors, Typography, Icons, Shadows, CSS vars, Logo)

> Referência destilada sobre o Minimal UI Kit (Vite + React + MUI), baseada em docs.minimals.cc, para uso como contexto de IA (estilo CLAUDE.md).

## Visão geral

- O tema do Minimal UI fica centralizado em `src/theme/`.
- Overrides gerais (cores, tipografia) ficam em `src/theme/theme-config.ts`.
- Definições mais granulares ficam em `src/theme/core/` (paleta, tipografia, shadows).

## 1. Cores

Fonte: docs.minimals.cc/colors/

- Arquivos a editar: `src/theme/theme-config.ts` e `src/theme/core/palette.ts`. Para uma troca de cor consistente, os dois devem ser atualizados juntos.
- Cada cor do tema (primary, secondary, etc.) é um objeto com 6 chaves fixas: `lighter`, `light`, `main`, `dark`, `darker`, `contrastText`.
- Convenção ao importar paletas externas (ex.: Eva Design): mapear os pesos numéricos para os tokens do Minimal:
  - 100 → lighter
  - 300 → light
  - 500 → main
  - 700 → dark
  - 900 → darker
- Ferramentas sugeridas na doc: Eva Design (colors.eva.design) e o color tool do MUI (mui.com/customization/color).
- Gotcha: editar só um dos dois arquivos (`theme-config.ts` ou `palette.ts`) pode deixar a paleta inconsistente, já que ambos participam da definição final das cores.

```ts
// src/theme/theme-config.ts (estrutura ilustrativa)
primary: {
  lighter: '#C8FAD6',
  light:   '#5BE49B',
  main:    '#00A76F',
  dark:    '#007867',
  darker:  '#004B50',
  contrastText: '#FFFFFF',
}
```

## 2. Tipografia

Fonte: docs.minimals.cc/typography/

- Arquivos: `src/theme/theme-config.ts` (config principal), `src/theme/core/typography.ts` (escala/pesos), `src/global.css` (import da fonte).
- Chave de config: `fontFamily.primary`.
- Passo a passo para trocar a fonte:
  1. Instalar o pacote da fonte via npm — o template usa pacotes Fontsource (ex.: `npm install @fontsource-variable/inter`).
  2. Importar a fonte em `src/global.css` via `@import`.
  3. Referenciar o nome exato da fonte em `fontFamily.primary` dentro de `theme-config.ts`.
- Gotcha: o nome em `fontFamily` precisa bater exatamente com o nome exposto pelo pacote Fontsource instalado (ex.: `'Inter Variable'` para `@fontsource-variable/inter`); um nome divergente faz a fonte não ser aplicada.

```ts
// src/theme/theme-config.ts
fontFamily: {
  primary: 'Inter Variable',
  // outras famílias (secondary, etc.)
}
```

## 3. Ícones

Fonte: docs.minimals.cc/icons/

- A partir da v7.0.0, o Minimal recomenda parar de carregar ícones via CDN do Iconify (iconify.design) e registrar os ícones localmente — evita ausência de suporte offline e flicker/layout shift durante o carregamento.
- Fluxo recomendado em 3 etapas:
  1. Registrar localmente os ícones usados, escolhidos entre os icon sets do Iconify, através do componente de ícone do Minimal.
  2. Registrar sets de ícones proprietários/customizados (fluxo próprio, com tutorial em vídeo separado na doc).
  3. Limpar ícones não usados com o pacote `find-unused-iconify`:
     - `npx find-unused-iconify` → apenas detecta ícones não usados.
     - `npx find-unused-iconify -d` → detecta e remove.
- Gotcha: esta página da doc não expõe caminhos de arquivo nem nomes de config específicos — é um guia de processo/arquitetura, não de API. Para detalhes de registro de ícone, é preciso consultar a página do componente de ícone do Minimal (não coberta aqui).

## 4. Sombras (Shadows)

Fonte: docs.minimals.cc/shadows/

- Módulos: `src/theme/core/shadows` (sombras padrão) e `src/theme/core/customShadows` (sombras customizadas/estendidas).
- Dois objetos de config distintos:
  - `shadows` — estilos de sombra padrão do tema/MUI.
  - `customShadows` — variantes adicionais definidas pelo Minimal (ex.: sombras coloridas por marca, usadas em cards/botões).
- Convenção: manter sombras "base" separadas das extensões próprias do template, permitindo sobrescrever cada camada de forma independente.

## 5. CSS Variables (Theme Vars / Dark Mode)

Fonte: docs.minimals.cc/css-vars/

- Aplica-se a partir do MUI v6.0.0+: o Minimal passou a usar CSS variables nativas do MUI para theming, especialmente para dark mode dinâmico.
- Mudanças de padrão de código ao adotar essa abordagem:
  - Acesso a cor: trocar `theme.palette.common.white` por `theme.vars.palette.common.white`.
  - Alpha/transparência: em vez de `alpha(theme.palette.text.primary, 0.2)`, usar `varAlpha(theme.vars.palette.text.primaryChannel, 0.2)` — `varAlpha` vem de `minimal-shared/utils`; a convenção é sempre sufixar a propriedade da paleta com `Channel`.
  - Estilos específicos de dark mode: usar `theme.applyStyles('dark', { ... })` em vez de checar `theme.palette.mode === 'light'` com ternário.
- Gotcha: código antigo com `theme.palette.x` direto ou checagem manual de `theme.palette.mode` ainda funciona, mas não aproveita as CSS vars; ao mexer em estilos de tema, preferir `theme.vars.*` / `varAlpha` / `applyStyles` para manter consistência com o resto do template.

```ts
// Antes
sx={{ bgcolor: alpha(theme.palette.text.primary, 0.2) }}

// Depois (CSS vars)
import { varAlpha } from 'minimal-shared/utils';
sx={{ bgcolor: varAlpha(theme.vars.palette.text.primaryChannel, 0.2) }}
```

## 6. Logo e Favicon

Fonte: docs.minimals.cc/logo/

- Componente do logo: `src/components/logo/logo` (importar e usar, estilizando via `sx`, ex.: `sx={{ width: 64, height: 64 }}`).
- Favicon: `public/favicon.ico`.
- Metadados do layout que referenciam o favicon: `src/app/layout.(tsx|jsx)`.
- Duas formas de implementar o logo:
  - Imagem estática: `Box` com `component="img"` apontando para um arquivo em `public` (ex.: `/logo/logo-single.svg`), com `width`/`height`.
  - SVG inline: markup SVG dentro do componente, permitindo gradientes e uso de tokens de cor do tema (`PRIMARY_DARK`, `PRIMARY_MAIN`, `PRIMARY_LIGHT`) e um `gradientId` para referenciar o gradiente.
- Passo a passo para trocar o favicon:
  1. Gerar os assets de favicon a partir do logo (a doc sugere favicon.io).
  2. Baixar e extrair os arquivos gerados.
  3. Sobrescrever `public/favicon.ico`.
  4. Atualizar a referência ao favicon nos metadados de `src/app/layout.(tsx|jsx)`.
  5. Trocar a imagem/SVG usada no componente de logo.

```tsx
// Uso do componente de logo
import { Logo } from 'src/components/logo';

<Logo sx={{ width: 64, height: 64 }} />
```

## Resumo rápido de arquivos-chave

```
src/
  theme/
    theme-config.ts        # cores + tipografia (config central)
    core/
      palette.ts           # paleta detalhada
      typography.ts        # escala tipografica
      shadows               # sombras padrao
      customShadows          # sombras estendidas
  components/
    logo/logo                # componente de logo
  global.css                  # import de fontes
public/
  favicon.ico
  logo/logo-single.svg
```

---

**Fontes consultadas:** docs.minimals.cc/colors/, /typography/, /icons/, /shadows/, /css-vars/, /logo/ — todas obtidas com sucesso, nenhuma falhou.
