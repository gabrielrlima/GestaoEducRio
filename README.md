# GestaoEducRio

Projeto para o **Claude Impact Lab Rio** (hackathon de 1 dia, Prefeitura do Rio + SME) — desafio **Inscrição Creche** (matricula.rio), Eixo 2 (Inscrição e Classificação).

## Demo

- **Aplicação em produção**: https://gestaoeducrio-frontend.vercel.app
- **Painel Admin**: mesmo link → `/admin-login`
  - Usuário: `admin`
  - Senha: `vL9L9oSkG1ydxSYyp0R9`
- **Portal da família** (cadastro/inscrição): mesmo link → `/portal` — login por CPF + data de nascimento + código enviado por e-mail (2FA)
- **API**: https://gestaoeducrio-backend-production.up.railway.app (`/health`, docs Swagger em `/docs`)
- **Vídeo**: [`PERSONA.mp4`](PERSONA.mp4)

## Contexto do projeto

- Contexto completo do desafio, regras de negócio, regras do evento e dicionário de dados: ver [`docs/desafio/`](docs/desafio/).
- Contexto de IA / stack / decisões do projeto: ver [`CLAUDE.md`](CLAUDE.md).
- Frontend: [`vite-ts/`](vite-ts/) — Minimal UI Kit (Vite + TypeScript), deploy na Vercel.
- Backend: [`backend/`](backend/) — Elysia (TypeScript/Bun) + SQLite, deploy no Railway. Ver [backend/README.md](backend/README.md) para rodar local.
