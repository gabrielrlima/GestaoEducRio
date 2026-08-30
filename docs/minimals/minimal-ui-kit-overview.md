# Overview & Getting Started

> Referência distilada sobre o **Minimal UI Kit** (Vite + React + MUI), baseada na documentação oficial em docs.minimals.cc. Compilado para uso como contexto de IA (estilo CLAUDE.md).

## 1. O que é o Minimal UI Kit

- Kit de dashboard/admin profissional em React construído sobre o **Material-UI (MUI)**, com componentes prontos para acelerar o desenvolvimento de front-end.
- Distribuído em duas variantes de framework: **Next.js** e **Vite.js** (cada uma com opção JavaScript ou TypeScript).
- Inclui bibliotecas de terceiros já integradas, como o carrossel **Embla Carousel**.
- Existe um arquivo de design completo no **Figma** para quem quer estender o projeto visualmente.
- **Ponto crítico:** o kit entrega **somente a interface (UI)** — não inclui backend nem banco de dados. Toda lógica de servidor, autenticação real e persistência de dados fica por conta do time.
- A documentação cobre: customização de tema (cores, tipografia, ícones, sombras, variáveis CSS), layout/navegação, estilos globais, overrides de componentes MUI, roteamento (inclusive deploy em subpasta), variáveis de ambiente/integração de API, suporte a múltiplos idiomas e integração com Tailwind CSS.
- Referência de componentes MUI: mui.com/components.

## 2. Quick Start (primeiros passos)

### Requisitos
- **Node.js** versão 20 ou superior.
- Gerenciador de pacotes recomendado: **Yarn** (npm e pnpm também funcionam, mas pnpm exige um guia de migração à parte).

### Passo a passo de instalação
```bash
yarn install       # ou: npm i
yarn dev            # ou: npm run dev   -> ambiente de desenvolvimento
yarn build           # ou: npm run build -> build de produção
```

### Convenções/gotchas importantes
- **Nunca apague os arquivos de lock** (`package-lock.json` ou `yarn.lock`) — trocar de gerenciador de pacotes sem cuidado pode quebrar as versões travadas de dependências.
- Ao copiar/mover a pasta do projeto, preserve arquivos ocultos como `.env` (fácil de esquecer em cópias manuais).
- **Create React App (CRA) está descontinuado** — a documentação recomenda migrar para Vite ou Next.js em vez de CRA.
- O projeto vem com um servidor mock habilitado por padrão; para desenvolvimento realista é recomendado montar um servidor local próprio (ver seção Mock Server).
- Lembrete recorrente: este kit é **apenas UI**, sem funcionalidade de backend.

## 3. Mock Server (API local de desenvolvimento)

**Por que existe:** a API de demonstração online usada pelo template pode ser desativada a qualquer momento, então o projeto disponibiliza uma API mock local para desenvolvimento estável.

### Onde encontrar
- Pasta do servidor mock: `minimal-api-dev`.
- Instruções detalhadas variam por versão do kit:
  - v6: `next-ts/README.md`
  - v5: `Minimal_Typescript/MOCK_API.md`

### Configuração
- Porta padrão do mock server: **7272**.
- Chaves de config relevantes:
  - `DEV_API` → aponta para `http://localhost:7272` em desenvolvimento.
  - `PRODUCTION_API` → aponta para o domínio publicado (ex.: `https://your-domain-api.vercel.app`).
  - Variáveis de ambiente do lado do cliente (Vite): `VITE_SERVER_URL` e `VITE_ASSET_URL`.
- Arquivos tocados: `.env` (do projeto principal) e `next.config.mjs` (quando aplicável ao Next.js).

### Fluxo local
1. Baixar/obter a pasta `minimal-api-dev` (via README/MOCK_API.md correspondente).
2. Subir esse servidor na porta 7272.
3. Atualizar o `.env` do projeto principal para apontar para `http://localhost:7272`.

### Fluxo em produção
1. Enviar o código-fonte de `minimal-api-dev` para um repositório Git.
2. Fazer deploy desse servidor mock na Vercel (ou serviço equivalente).
3. Atualizar `next.config.mjs` (ou variável de API equivalente) com a URL de produção.
4. Atualizar o `.env` do projeto principal com o domínio publicado.

### Gotcha
- A porta configurada no servidor precisa **bater exatamente** com a porta usada nas variáveis de ambiente do cliente — divergência aqui é causa comum de erro de conexão.
- Vale tanto para variantes Next.js, Vite quanto para os templates "starter".

## 4. Deployment (publicação)

### Plataformas testadas oficialmente
| Plataforma | Frameworks validados |
|---|---|
| Vercel | Vite.js e Next.js |
| Netlify | Next.js |
| Azure | Next.js |
| Firebase | Next.js |
| Cloudflare | Vite.js |

### Ponto crítico de configuração
- **Variáveis de ambiente não migram automaticamente** do `.env` local para produção — cada plataforma exige que você configure manualmente as mesmas chaves no painel/console dela.
- Não existe um passo único e universal: cada provedor (Vercel, Netlify, Azure, Firebase, Cloudflare) tem seu próprio fluxo de configuração, então é preciso consultar a documentação específica do serviço escolhido.
- Há demos ao vivo publicadas em todas as cinco plataformas, úteis para comparar comportamento antes de fazer o próprio deploy.

## 5. Licenciamento e estrutura de pastas do pacote

### Tipos de licença
- **Standard** (produtos gratuitos): acesso às versões JavaScript (`next-js`, `vite-js` e variantes "starter").
- **Plus** (produtos gratuitos): acesso completo — JavaScript + TypeScript + arquivo Figma.
- **Extended** (obrigatória para produtos comerciais/pagos): acesso completo a todas as versões, incluindo Figma.
- Regra de aplicação: o tipo de licença depende de **se o produto final cobra dos usuários**, não de o projeto ser open source ou não. Ferramentas internas não-comerciais cabem em Standard/Plus; um SaaS pago exige Extended.
- Uma licença cobre **um produto final**; escalar para múltiplos produtos exige licenças adicionais.

### Estrutura de pastas do pacote baixado
```text
Minimal_Javascript/
  next-js/
  vite-js/
  starter-next-js/
  starter-vite-js/
Minimal_Typescript/
  next-ts/
  vite-ts/
  starter-next-ts/
  starter-vite-ts/
Minimal_Design/
  (arquivo Figma)
```

- As versões **"starter"** são reduzidas em relação às versões completas (menos componentes/páginas de exemplo). Convenção do próprio kit: é seguro copiar componentes da versão completa para dentro de uma versão starter conforme a necessidade.
- Links de referência para as versões completas em TypeScript: `minimals.cc`; para as versões starter: `starter.minimals.cc`.

## 6. Resumo prático para quem for codar neste stack

- Confirmar se o projeto usa a variante **Vite + TypeScript** (`vite-ts`) ou **Vite + JavaScript** (`vite-js`) antes de assumir convenções de arquivo.
- Nunca esperar lógica de backend "pronta" — autenticação, persistência e regras de negócio precisam ser implementadas ou conectadas à parte.
- Ao trabalhar com dados de exemplo/mock, checar primeiro se há um `minimal-api-dev` configurado e se a porta/URL em `.env` (`VITE_SERVER_URL`, `VITE_ASSET_URL`) está alinhada com o servidor mock rodando localmente.
- Antes de fazer deploy, revisar manualmente se todas as chaves do `.env` local foram replicadas no painel da plataforma de destino (Vercel/Netlify/Azure/Firebase/Cloudflare).
- Preservar `yarn.lock`/`package-lock.json` e arquivos ocultos (`.env`) ao mover ou duplicar a pasta do projeto.
- Evitar qualquer resquício de Create React App — o caminho recomendado pelo próprio autor do kit é Vite ou Next.js.

---

### Fontes consultadas
- https://docs.minimals.cc/introduction/
- https://docs.minimals.cc/quick-start/
- https://docs.minimals.cc/mock-server/
- https://docs.minimals.cc/deployment/
- https://docs.minimals.cc/package/
