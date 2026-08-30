# Arquitetura — Modelo C4

> Documentação de arquitetura (C4 Model: Contexto → Container → Componente) do **GestaoEducRio**. Reflete o estado real do sistema implementado hoje (2026-08-30), não um plano futuro — atualizar conforme a arquitetura evoluir.

## Nível 1 — Diagrama de Contexto

Quem usa o sistema e com quais sistemas externos ele conversa.

```mermaid
C4Context
    title Contexto do Sistema — GestaoEducRio

    Person(mae, "Responsável (mãe/pai)", "Cadastra o(s) filho(s) e acompanha o status da inscrição em creche")
    Person(admin, "Equipe CRE/SME", "Gerencia unidades, vagas, fila e classificação")

    System(gestaoeduc, "GestaoEducRio", "Sistema de Inscrição e Classificação de creches — cadastro de unidades, gestão de vagas, portal de inscrição com matching territorial")

    System_Ext(claude, "Claude API (Anthropic)", "Gera a explicação em linguagem natural da recomendação de unidades")
    System_Ext(smtp, "SMTP (Hostinger)", "Envia o código de verificação (2FA) por e-mail no login do portal")

    Rel(mae, gestaoeduc, "Cadastra filho, escolhe unidades, consulta status", "HTTPS")
    Rel(admin, gestaoeduc, "Gerencia unidades/vagas, chama e confirma vagas da fila", "HTTPS")
    Rel(gestaoeduc, claude, "Pede explicação da recomendação territorial", "HTTPS/API")
    Rel(gestaoeduc, smtp, "Envia código de acesso", "SMTP")
```

**Fora do escopo deste sistema** (não integrado hoje): sistemas oficiais da Prefeitura (matricula.rio, Registro Municipal Integrado, CadÚnico) — o dataset histórico usado pra seed vem de um repositório de dados estático (`CIT-SME-RJ/dadoscreche`), não de uma integração ao vivo.

## Nível 2 — Diagrama de Container

Como o sistema se divide em unidades implantáveis.

```mermaid
C4Container
    title Containers — GestaoEducRio

    Person(mae, "Responsável")
    Person(admin, "Equipe CRE/SME")

    Container_Boundary(gestaoeduc, "GestaoEducRio") {
        Container(spa, "Frontend (SPA)", "React + Vite + TypeScript, MUI (Minimal UI Kit)", "Portal da família (/portal) e Painel Admin (/dashboard/creche/*), servido estático na Vercel")
        Container(api, "Backend (API)", "Elysia + TypeScript, Bun runtime", "REST API: unidades, vagas, responsáveis, crianças, inscrições, classificação, auth, IA — hospedado no Railway")
        ContainerDb(db, "Banco de dados", "SQLite (bun:sqlite), arquivo local", "Dados operacionais: unidade, vaga_config, responsavel, crianca, inscricao, inscricao_opcao, matricula, sessao, login_codigo")
    }

    System_Ext(claude, "Claude API")
    System_Ext(smtp, "SMTP Hostinger")

    Rel(mae, spa, "Usa", "HTTPS")
    Rel(admin, spa, "Usa", "HTTPS")
    Rel(spa, api, "Chama", "JSON/HTTPS, Bearer token opaco")
    Rel(api, db, "Lê/escreve", "SQL")
    Rel(api, claude, "Chama (com timeout de 2.5s + fallback determinístico)", "HTTPS")
    Rel(api, smtp, "Envia e-mail de código", "SMTP")
```

**Por que SQLite, não Postgres**: decisão consciente pra hoje (ver `docs/desafio/backend-spec.md` §1) — zero infra externa, setup instantâneo, suficiente pras invariantes do domínio (`UNIQUE`/`CHECK`/índice único parcial). Se o projeto for adiante, migrar pra Postgres gerenciado no Railway é o próximo passo natural — o SQL é padrão o bastante pra portar sem reescrever a lógica de negócio.

## Nível 3 — Componentes do Backend

O container "Backend (API)" por dentro — um módulo por recurso de domínio, cada um com `routes.ts` (HTTP) + `service.ts` (regra de negócio + acesso a dado). Hoje CRUD direto, **não CQRS** (leitura e escrita no mesmo `service.ts` de cada módulo) — ver decisão registrada em `CLAUDE.md`.

```mermaid
C4Component
    title Componentes — Backend API

    Container_Boundary(api, "Backend (Elysia)") {
        Component(unidades, "unidades", "module", "CRUD de unidades + GET /unidades/proximas (ranking territorial — fix R2)")
        Component(vagas, "vagas", "module", "Capacidade por unidade × grupamento × turno")
        Component(responsaveis, "responsaveis", "module", "Cadastro do responsável (CPF, data nascimento, e-mail)")
        Component(criancas, "criancas", "module", "Cadastro de crianças + status consolidado por criança")
        Component(inscricoes, "inscricoes", "module", "Cria inscrição + até 5 opções numa transação; calcula distância/aviso territorial")
        Component(classificacao, "classificacao", "module", "selecionar/confirmar/desistir (trava de R8), fila, painel de pendências/inconsistências")
        Component(auth, "auth", "module", "Login admin único; login do responsável via CPF+nascimento+código por e-mail; sessão por token opaco")
        Component(ia, "ia", "module", "POST /ia/recomendar-unidades — Claude com fallback determinístico")
        ComponentDb(schema, "db/schema.sql", "SQLite DDL", "Schema único, com o índice único parcial que trava R8 no nível do banco")
    }

    Rel(inscricoes, unidades, "consulta unidade/proximidade")
    Rel(inscricoes, criancas, "consulta criança")
    Rel(classificacao, vagas, "incrementa vagas_ocupadas na confirmação")
    Rel(ia, unidades, "reaproveita a mesma query de /unidades/proximas")
    Rel(auth, responsaveis, "valida CPF+nascimento")
```

## Decisões de arquitetura registradas (ADR-lite)

| Decisão | Alternativa considerada | Por quê |
|---|---|---|
| SQLite via `bun:sqlite`, sem ORM | Postgres gerenciado no Railway | Zero setup de infra externa; hackathon de 1 dia — reversível depois (ver nota acima) |
| CRUD por módulo (não CQRS) | Separar commands/queries desde já | Volume de código ainda pequeno o bastante pra não precisar da separação; reavaliar se o domínio crescer |
| Trava de R8 como índice único parcial no schema | Só checagem na aplicação | Garante o invariante mesmo sob condição de corrida — não depende de nenhum service "lembrar" de checar |
| IA com fallback determinístico obrigatório, timeout 2.5s | Deixar a chamada à IA bloquear a resposta | A demo não pode quebrar se a API do Claude falhar ou não tiver chave configurada |
| Sessão via token opaco em tabela `sessao` | JWT | Mais simples de revogar/expirar num MVP; sem necessidade de assinatura/verificação de JWT hoje |

## Notas de manutenção

- Gerado uma vez, ponto-no-tempo (2026-08-30). Se um módulo novo for adicionado ou um container mudar (ex.: trocar SQLite por Postgres), atualizar o diagrama correspondente — não deixar desatualizado.
- Fonte de verdade sobre endpoints/schema exatos: `backend/src/db/schema.sql` e `docs/desafio/backend-spec.md`. Este documento é a visão de arquitetura, não o dicionário de dados.
