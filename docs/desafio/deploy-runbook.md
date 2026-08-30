# Runbook de deploy — Railway (backend + banco) + Vercel (front)

Passo a passo pra colocar o `GestaoEducRio` no ar. Feito via importação direta do
GitHub em ambas as plataformas (deploy automático a cada push na `main`), sem
precisar de CLI logada — qualquer um do time pode repetir isso na própria conta.

## Por que um snapshot em vez de rodar o seed na nuvem

O pipeline de seed (`backend/src/seed/seed-unidades.ts`, `seed-vagas.ts`) lê de
`data/dadoscreche/` (~68MB, clone do repo oficial `CIT-SME-RJ/dadoscreche`),
`data/inep/` e planilhas complementares — nenhum desses diretórios está no git
(propositalmente, ver `.gitignore`). Reproduzir isso no build do Railway exigiria
clonar/baixar tudo de novo a cada deploy, o que é lento e frágil perto do prazo.

Em vez disso: `backend/data/seed/unidades-seed.db` é um snapshot do SQLite já
seedado (só as tabelas públicas `unidade` + `vaga_config`, sem nenhuma linha de
`responsavel`/`crianca`/`sessao`/`login_codigo` de teste) commitado no repo
(~2MB). `backend/src/db/bootstrap.ts` roda antes do servidor subir: se
`DATABASE_PATH` ainda não existe (volume novo), copia esse snapshot pra lá; se já
existe (redeploy), não mexe — preserva inscrições reais que a família já fez.
Pra regenerar o snapshot depois de rodar o seed local de novo (dado novo, fix de
higienização etc.):

```bash
cd backend
cp data/app.db data/seed/unidades-seed.db
sqlite3 data/seed/unidades-seed.db "DELETE FROM responsavel; DELETE FROM login_codigo; DELETE FROM sessao; DELETE FROM crianca; DELETE FROM inscricao; DELETE FROM inscricao_opcao; DELETE FROM matricula; DELETE FROM resposta_socioeconomica; VACUUM;"
```

## Railway — backend + banco

1. [railway.com](https://railway.com) → login com GitHub → **New Project** → **Deploy from GitHub repo** → selecionar `GestaoEducRio`.
2. No serviço criado, **Settings → Source → Root Directory** = `backend`. Railway detecta `backend/railway.json` automaticamente a partir daí (build via Nixpacks, comando de start `bun run deploy:start`, healthcheck em `/health`).
3. **Settings → Volumes → New Volume**, mount path `/app/data` (mesmo caminho relativo `data/` do `DATABASE_PATH=data/app.db`, resolvido a partir do working dir do container). Sem isso, cada redeploy perde as inscrições reais — o volume é o que faz o bootstrap "já existe" preservar dado.
4. **Variables** — colar (sem espaço) a partir do `backend/.env` local (nunca cole a senha do e-mail em texto puro em nenhum outro lugar além dessa tela):
   ```
   DATABASE_PATH=data/app.db
   CORS_ORIGIN=https://<dominio-vercel>.vercel.app
   ADMIN_USER=<definir senha forte de produção, não o placeholder do .env.example>
   ADMIN_PASSWORD=<idem>
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   SMTP_USER=contato@keyva.com.br
   SMTP_PASS=<senha da caixa, mesma do .env local>
   ANTHROPIC_API_KEY=<opcional — sem isso cai no fallback determinístico>
   TRANSPARENCIA_API_KEY=<opcional>
   ```
   `PORT` não precisa ser setado — o Railway injeta automaticamente e `src/index.ts` já lê `process.env.PORT`.
5. **Settings → Networking → Generate Domain** — copiar a URL pública (`https://<algo>.up.railway.app`), vai ser o `VITE_CRECHE_API_URL` do front (com `/api` no final).
6. Testar: `curl https://<dominio-railway>.up.railway.app/health` deve responder `{"status":"ok",...}`.

## Vercel — frontend

1. [vercel.com](https://vercel.com) → login com GitHub → **Add New → Project** → importar `GestaoEducRio`.
2. **Root Directory** = `vite-ts` (Vercel detecta o preset Vite sozinho a partir daí; `vite-ts/vercel.json` já define `buildCommand`/`outputDirectory`/rewrite de SPA).
3. **Environment Variables**:
   ```
   VITE_CRECHE_API_URL=https://<dominio-railway>.up.railway.app/api
   ```
4. Deploy. Depois, voltar no passo 4 do Railway e atualizar `CORS_ORIGIN` pro domínio real gerado pela Vercel (o header `Access-Control-Allow-Origin` do backend só libera o que estiver nessa env var).

## Depois de ambos no ar

- Trocar `ADMIN_PASSWORD` do placeholder do `.env.example` (`troque-esta-senha`) por uma senha real antes de divulgar a URL.
- Aplicar os guards `requireAdmin`/`requireResponsavel` (`backend/src/modules/auth/guard.ts`) nas rotas de negócio, hoje todas públicas — pendente separado, não bloqueia o deploy em si mas bloqueia expor a URL com segurança.
