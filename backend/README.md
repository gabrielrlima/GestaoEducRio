# Backend — GestaoEducRio

API Elysia (Bun + TypeScript) para o sistema de Inscrição e Classificação de creches. Ver [docs/desafio/backend-spec.md](../docs/desafio/backend-spec.md) e a seção "Backend — Elysia" do [CLAUDE.md](../CLAUDE.md) na raiz do repo para a spec completa e as convenções.

## Rodar local

```bash
bun install
cp .env.example .env        # ajuste ADMIN_USER/ADMIN_PASSWORD, SMTP_*, ANTHROPIC_API_KEY se tiver
bun run migrate             # cria o schema em data/app.db
bun run seed                # popula unidades reais (Query D) + vagas sintéticas
bun run dev                 # sobe em http://localhost:3000, docs em /docs
```

Sem `SMTP_PASS` configurado, o código de verificação do login da mãe é logado no console em vez de enviado por e-mail. Sem `ANTHROPIC_API_KEY`, `POST /api/ia/recomendar-unidades` funciona normalmente com o fallback determinístico.

## Scripts

| Comando | O que faz |
|---|---|
| `bun run dev` | sobe o servidor com reload automático |
| `bun run start` | sobe o servidor sem reload (produção) |
| `bun run migrate` | aplica `src/db/schema.sql` (idempotente) |
| `bun run seed:unidades` | importa as unidades reais da Query D + geolocalização |
| `bun run seed:vagas` | gera capacidade sintética por unidade×grupamento×turno |
| `bun run seed` | roda os dois seeds acima em sequência |
