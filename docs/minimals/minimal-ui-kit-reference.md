# Environment Variables, API calls, Authentication, i18n, Tailwind

> Resumo destilado da documentação oficial do Minimal UI Kit (docs.minimals.cc) — referência rápida para trabalhar corretamente neste projeto (Vite + React + MUI).

## 1. Variáveis de Ambiente

- O Minimal UI existe em variantes para bundlers diferentes (Next.js, Vite, Create React App), e cada variante tem seu próprio prefixo obrigatório e forma de leitura da variável. Usar o padrão errado faz a variável chegar `undefined` em runtime.
- Para este projeto (**Vite**):
  - Prefixo obrigatório: `VITE_`
  - Leitura no código: `import.meta.env.VITE_NOME_DA_VARIAVEL`
  - Onde declarar: arquivo `.env` na raiz do projeto
- Convenções de outras variantes (citadas na doc só para contraste, não se aplicam aqui):
  - Next.js → prefixo `NEXT_PUBLIC_`, lido via `process.env.NEXT_PUBLIC_*`
  - Create React App → prefixo `REACT_APP_`, lido via `process.env.REACT_APP_*`
- Exemplos de chaves usadas nos exemplos da doc: `MAP` (chave de serviço de mapas) e `WEBSITE_URL` (URL base do app).
- **Gotcha**: ao copiar um exemplo de outro framework (ex.: um trecho com `REACT_APP_`), lembrar de trocar para o prefixo `VITE_` — é o erro mais comum ao seguir a documentação genérica.

```
# .env (padrão Vite deste projeto)
VITE_SERVER_URL=...
VITE_HOST_API=...
```

## 2. Chamadas de API

- Padrão de data-fetching da doc: **Axios** para a instância HTTP + **SWR** (stale-while-revalidate) para os hooks de fetch nos componentes.
- Instância do Axios configurada em `src/utils/axios.js` (na doc; em TS seria `axios.ts`), lendo a URL base a partir de uma env var de host de API. A doc genérica usa `REACT_APP_HOST_API` (exemplo CRA) — no padrão Vite deste projeto o equivalente é algo como `VITE_HOST_API`.
- Função fetcher padrão para o SWR:
  ```ts
  const fetcher = (url) => axios.get(url).then((res) => res.data);
  ```
- Uso típico em componente:
  ```ts
  const { data, error, isLoading } = useSWR(endpoint, fetcher);
  ```
- Fluxo recomendado:
  1. Definir a env var de host da API no `.env`.
  2. Configurar a base URL do Axios em `src/utils/axios.(js|ts)` usando essa env var.
  3. Importar `fetcher` + `useSWR` no componente e chamar `useSWR(endpoint, fetcher)`.
  4. Tratar os três estados retornados: erro, carregando (`isLoading`) e dado pronto (`data`).
- **Convenções/gotchas**:
  - Com a base URL já configurada no Axios, preferir **paths relativos** nas chamadas (ex.: `/api/product/list`) em vez de montar URL absoluta — evita duplicar/conflitar domínio.
  - O template vem com uma API de demonstração pronta para dev; trocar pelo endpoint real antes de ir para produção.
  - Dá para não configurar base URL nenhuma e usar URLs absolutas completas em cada chamada, mas o padrão preferido é base URL + paths relativos.

## 3. Autenticação

- A página índice `/authentication/` retorna 404 — a doc está dividida por provedor em sub-páginas: `jwt`, `firebase`, `supabase`, `auth0`, `amplify` (todas confirmadas existentes).
- Em qualquer provedor, a seleção do método ativo é sempre no mesmo lugar:
  - Arquivo: `src/config-global.ts`
  - Chave: `auth.method`, valor um de `'jwt' | 'firebase' | 'supabase' | 'auth0' | 'amplify'`
- Todas as credenciais de todos os provedores vão no `.env`, sempre com prefixo `VITE_`.

**JWT**
- `.env`: `VITE_SERVER_URL` (ex.: `https://api-dev-minimal-v6.vercel.app`, ou servidor próprio).
- Sem essa variável, o método JWT não tem para onde autenticar.
- O endpoint de "dados do usuário" pode ser configurado separadamente na config de auth.

**Firebase**
- `.env`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APPID`.
- Passos: criar o projeto/Firestore, definir regras de segurança (ex.: só permitir leitura/escrita quando `request.auth.uid != null`), pegar as credenciais no console do Firebase e preencher o `.env`.

**Supabase**
- `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — obtidas no dashboard do projeto Supabase.

**Auth0**
- `.env`: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_CALLBACK_URL`.
- **Gotcha**: a callback URL no `.env` precisa bater exatamente com a configurada no painel do Auth0, senão o fluxo de login quebra.

**AWS Amplify**
- `.env`: `VITE_AWS_AMPLIFY_USER_POOL_ID`, `VITE_AWS_AMPLIFY_USER_POOL_WEB_CLIENT_ID` — obtidos no console AWS (Cognito User Pool).

- Nota geral: a doc menciona uma versão "v5" legada do template com guias de auth separados — cuidado ao usar exemplos antigos como referência.

## 4. Internacionalização (multi-idioma / i18n)

- Objetivo: suportar múltiplos idiomas com troca automática de layout **RTL** (right-to-left) quando o idioma ativo é árabe, voltando para LTR nos demais.
- Estrutura de arquivos envolvida:
  ```
  src/locales/
    en.json
    fr.json
    locales-config.ts
  src/theme/theme-config.ts
  src/theme/theme-provider.tsx
  src/components/settings/drawer/settings-drawer.tsx
  ```
- Traduções em JSON com chaves aninhadas via dot-notation (ex.: `"nested.nested1"`).
- Config relevante: `theme-config.ts` define `direction: 'rtl'`; `locales-config.ts` define o idioma padrão de fallback, ex. `fallbackLng: 'ar'`.
- Hooks principais:
  - `useLocales()` → retorna `allLang` (lista de idiomas disponíveis) e `currentLang` (idioma atual; valor em `currentLang.value`).
  - `useTranslate()` → retorna a função `t()` para traduzir chaves e `onChangeLang()` para trocar de idioma.
  - `useLocaleDirectionSync()` → plugado no `theme-provider.tsx`, sincroniza a direção do layout (LTR/RTL) com o idioma selecionado.
- Fluxo para adicionar um novo idioma: criar o JSON correspondente em `src/locales/`, registrar em `locales-config.ts`, garantir que `useLocaleDirectionSync()` está ativo no theme provider.
- **Gotcha**: o RTL é acoplado especificamente ao código de idioma árabe (`'ar'`) — chamar `onChangeLang('ar')` já dispara a troca de direção automaticamente, não é uma opção separada e manual.

## 5. Tailwind CSS (integração com MUI)

- Objetivo: usar Tailwind CSS junto com Material UI sem que os estilos-base de um conflitem com os do outro.
- Instalação:
  ```
  npm install -D tailwindcss postcss autoprefixer
  ```
- Arquivos a criar/editar:
  - `tailwind.config.js` (raiz do projeto)
  - `postcss.config.js` (ou `postcss.config.cjs`, dependendo do formato de módulo do setup Vite)
  - `src/global.css`
- Config crítica em `tailwind.config.js`:
  - `content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']`
  - `corePlugins.preflight: false` — desliga o reset de estilos padrão do Tailwind para não brigar com o `CssBaseline` do MUI, que já cumpre esse papel.
- `postcss.config.js` precisa registrar os plugins `tailwindcss` e `autoprefixer`.
- Em `src/global.css`, adicionar as diretivas do Tailwind:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
- **Gotcha principal**: esquecer de desativar o `preflight` do Tailwind é a causa mais comum de estilos quebrados ao misturar com MUI.
- A doc referencia repositórios de exemplo prontos (Tailwind + Vite; MUI + CRA + Tailwind) como ponto de partida.

---

## Fontes consultadas

- https://docs.minimals.cc/environment-variables/
- https://docs.minimals.cc/api-calls/
- https://docs.minimals.cc/authentication/ — **404** (página índice não existe)
  - https://docs.minimals.cc/authentication/jwt/
  - https://docs.minimals.cc/authentication/firebase/
  - https://docs.minimals.cc/authentication/supabase/
  - https://docs.minimals.cc/authentication/auth0/
  - https://docs.minimals.cc/authentication/amplify/
- https://docs.minimals.cc/multi-language/
- https://docs.minimals.cc/tailwind/
