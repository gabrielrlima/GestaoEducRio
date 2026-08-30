# Especificação Final — Backend Elysia (Match Perfeito, Eixo 2)

> Síntese das 3 propostas. Decisão de produto (dada, não revisitada): serviço operacional cobrindo (1) cadastro de unidades + vagas por grupamento×turno, (2) portal da mãe para cadastrar filhos e inscrever em até 5 unidades. Ataca R2 (escolha sem critério territorial) e R8 (classificação por unidade permite até 5 vagas simultâneas pro mesmo CPF/criança).

## 1. Stack de persistência

**SQLite via `bun:sqlite`, sem ORM (SQL cru + um camada fina de helpers), com `db.transaction()` do bun:sqlite para as operações compostas.**

Justificativa (não reabrir): zero setup de infra externa (sem Postgres gerenciado, sem migração de driver), roda embutido no processo Elysia, `bun:sqlite` é nativo do runtime (sem dependência extra), suporta `UNIQUE`/`CHECK`/índice parcial (`CREATE UNIQUE INDEX ... WHERE ...`) — suficiente pra travar R8 no nível do banco (Ângulo 3), e é trivialmente re-seedável do zero em segundos, importante quando o schema ainda vai iterar nas próximas horas. Arquivo `data/app.db` versionado fora do git (gitignore), recriado por script de seed. Se der tempo ao final e o deploy Railway precisar de volume persistente entre restarts, considerar montar um volume — mas isso é operação de deploy, não decisão de arquitetura de dados.

## 2. Entidades e schema (DDL-ready)

Convenções: `snake_case` nas colunas (nativo SQLite), UUID como `TEXT` gerado em app (`crypto.randomUUID()`), timestamps `TEXT` ISO-8601 (`datetime('now')`), booleans como `INTEGER` 0/1. Enums de `situacao` preservam grafia exata do dataset real (sem acento) para permitir import histórico 1:1.

```sql
-- ========== UNIDADES ==========
CREATE TABLE unidade (
  id              TEXT PRIMARY KEY,
  esc_codigo      TEXT UNIQUE,            -- = esc_codigo (Query D) / unidade (Query A). Manter como string (zero à esquerda significativo)
  nome            TEXT NOT NULL,
  tipo_gestao     TEXT NOT NULL CHECK (tipo_gestao IN ('Direta','Conveniada','Parceria')),
  cre             INTEGER,                -- 1-11, de Unidades_Unificadas.CRE (nullable até enriquecer)
  logradouro      TEXT,
  numero          TEXT,
  complemento     TEXT,
  bairro          TEXT NOT NULL,
  cep             TEXT,
  latitude        REAL,                   -- da planilha Unidades_Unificadas_com_Localizacao.xlsx (join por esc_codigo normalizado)
  longitude       REAL,
  ativa           INTEGER NOT NULL DEFAULT 1,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== VAGAS (capacidade agregada, não vaga individual) ==========
CREATE TABLE vaga_config (
  id                TEXT PRIMARY KEY,
  unidade_id        TEXT NOT NULL REFERENCES unidade(id),
  ano_processo      INTEGER NOT NULL,
  grupamento        TEXT NOT NULL CHECK (grupamento IN ('Bercario','Maternal I','Maternal II')),
  turno             TEXT NOT NULL CHECK (turno IN ('Integral','Parcial')),
  capacidade_total  INTEGER NOT NULL DEFAULT 0,
  vagas_ocupadas    INTEGER NOT NULL DEFAULT 0,  -- só incrementa na confirmação, nunca editado direto
  UNIQUE (unidade_id, ano_processo, grupamento, turno)
);
-- vagas_disponiveis = capacidade_total - vagas_ocupadas, sempre calculado na query, nunca armazenado

-- ========== RESPONSÁVEL (identidade real, não anonimizada) ==========
CREATE TABLE responsavel (
  id          TEXT PRIMARY KEY,
  cpf         TEXT NOT NULL UNIQUE,     -- 11 dígitos; valida formato+dígito verificador (algoritmo puro); Receita Federal fica como stub documentado (R1 parcial)
  nome        TEXT NOT NULL,
  telefone    TEXT,
  email       TEXT,
  cep         TEXT,
  bairro      TEXT NOT NULL,            -- input primário do fallback territorial
  logradouro  TEXT,
  numero      TEXT,
  latitude    REAL,                     -- geocodificado do CEP/bairro se der tempo; NULL cai no fallback por bairro/CRE
  longitude   REAL,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== CRIANÇA ==========
CREATE TABLE crianca (
  id                TEXT PRIMARY KEY,
  responsavel_id    TEXT NOT NULL REFERENCES responsavel(id),
  nome_completo     TEXT NOT NULL,
  data_nascimento   TEXT NOT NULL,       -- YYYY-MM-DD real (dado vivo, não generalizado como o histórico)
  sexo              TEXT CHECK (sexo IN ('M','F')),
  cpf_crianca       TEXT,                -- opcional; se ausente, dedup por nome+nascimento é só soft-warning, nunca hard-block (ver R29 abaixo)
  criado_em         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== INSCRIÇÃO (cabeçalho — 1 por criança por processo) ==========
CREATE TABLE inscricao (
  id                  TEXT PRIMARY KEY,
  crianca_id          TEXT NOT NULL REFERENCES crianca(id),
  responsavel_id      TEXT NOT NULL REFERENCES responsavel(id),
  ano_processo        INTEGER NOT NULL,
  grupamento_pretendido TEXT NOT NULL CHECK (grupamento_pretendido IN ('Bercario','Maternal I','Maternal II')), -- calculado da idade na data-corte
  turno_preferido     TEXT CHECK (turno_preferido IN ('Integral','Parcial','Qualquer')),
  pontuacao_total     INTEGER,           -- uma pontuação por inscrição, não por opção (fix R8 estrutural)
  criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (crianca_id, ano_processo)      -- impede 2 inscrições da mesma criança no mesmo processo
);

-- ========== OPÇÃO DE INSCRIÇÃO (grão = Query A: 1 linha por unidade escolhida) ==========
CREATE TABLE inscricao_opcao (
  id                        TEXT PRIMARY KEY,
  inscricao_id              TEXT NOT NULL REFERENCES inscricao(id),
  ordem_preferencia         INTEGER NOT NULL CHECK (ordem_preferencia BETWEEN 1 AND 5),
  unidade_id                TEXT NOT NULL REFERENCES unidade(id),
  turno                     TEXT NOT NULL CHECK (turno IN ('Integral','Parcial')),
  distancia_km              REAL,        -- haversine(responsavel.lat/lng, unidade.lat/lng) se ambos existirem
  tipo_distancia            TEXT CHECK (tipo_distancia IN ('geocodificada','estimada_bairro','indisponivel')),
  mesmo_bairro              INTEGER NOT NULL DEFAULT 0,
  confirmou_ciente_distancia INTEGER NOT NULL DEFAULT 0, -- true quando família opta mesmo fora do raio/bairro recomendado
  situacao                  TEXT NOT NULL DEFAULT 'Ativo' CHECK (situacao IN (
                               'Ativo','Selecionado','Selecionado da lista','Confirmado',
                               'Lista de espera','Cancelado','Cancelado na confirmacao',
                               'Cancelado pelo sistema','Bloqueada')),  -- 8 primeiros = grafia exata do dado real; 'Bloqueada' é novo (fix R8)
  data_mudanca_status       TEXT NOT NULL DEFAULT (datetime('now')),   -- re-carimbado a cada update de situacao (fix R31)
  criado_em                 TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (inscricao_id, ordem_preferencia),
  UNIQUE (inscricao_id, unidade_id)
);

-- Trava física de R8: nunca mais de 1 opção "ativa" (oferta em curso ou vaga tomada) por inscrição
CREATE UNIQUE INDEX uq_oferta_ativa_por_inscricao
  ON inscricao_opcao (inscricao_id)
  WHERE situacao IN ('Selecionado','Selecionado da lista','Confirmado');

-- ========== QUESTIONÁRIO SOCIOECONÔMICO (mirror simplificado de Query B/C) ==========
CREATE TABLE pergunta (
  id                  TEXT PRIMARY KEY,
  ano_processo        INTEGER NOT NULL,
  texto               TEXT NOT NULL,
  pontuacao           INTEGER NOT NULL DEFAULT 0,  -- 0-100, por processo (nunca hardcode — R28)
  criterio_desempate  INTEGER NOT NULL DEFAULT 0,
  ordem               INTEGER
);

CREATE TABLE resposta_socioeconomica (
  id           TEXT PRIMARY KEY,
  inscricao_id TEXT NOT NULL REFERENCES inscricao(id),
  pergunta_id  TEXT NOT NULL REFERENCES pergunta(id),
  resposta     TEXT NOT NULL CHECK (resposta IN ('Sim','Nao')),
  confirmado   INTEGER NOT NULL DEFAULT 0,   -- vira true após validação presencial manual (R4.3)
  UNIQUE (inscricao_id, pergunta_id)
);

-- ========== MATRÍCULA (estado terminal, consome vaga) ==========
CREATE TABLE matricula (
  id                  TEXT PRIMARY KEY,
  inscricao_opcao_id  TEXT NOT NULL UNIQUE REFERENCES inscricao_opcao(id),
  data_confirmacao    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Cortado deliberadamente do escopo de hoje** (documentar como decisão consciente, não descuido): `TentativaConvocacao`/tracking de canal de contato (Eixo 3), `CentroideBairro` pré-calculado, `EstatisticaCancelamentoUnidade` histórica, importação em lote do dataset histórico para as mesmas tabelas. Se sobrar tempo depois da ordem de implementação da seção 8, essas são as próximas peças (nessa ordem de valor).

## 3. Como o schema resolve R2 e R8

### R2 — escolha sem critério territorial

Não é geoprocessamento pesado nem bloqueio duro do direito de escolha (risco jurídico) — é tornar a distância um **dado de primeira classe visível no momento da escolha**, com fallback gradual conforme o dado disponível:

1. `unidade.latitude/longitude` vem da planilha `Unidades_Unificadas_com_Localizacao.xlsx` (aba `Unidades_Unificadas`, filtrada por `Tipo` em `Creche`/`Creche Parceira`/`EDI`/`CDEI`, ~906 linhas, já geocodificadas — zero geocoding próprio necessário). `responsavel.bairro` é sempre obrigatório; `latitude/longitude` do responsável é opcional (best-effort, não bloqueia cadastro).
2. Em `POST /inscricoes`, para cada opção calculada: se **ambos** unidade e responsável têm lat/long → `distancia_km` = haversine (função pura, ~10 linhas, sem lib) e `tipo_distancia = 'geocodificada'`; senão → `mesmo_bairro = (unidade.bairro === responsavel.bairro)` e `tipo_distancia = 'estimada_bairro'` (ou `'indisponivel'` se nem bairro bate).
3. **Regra de negócio, não bloqueio**: se **nenhuma** das opções escolhidas está dentro de um raio configurável (ex. 5 km, quando geocodificado) nem no mesmo bairro (fallback), a resposta de `POST /inscricoes` volta `201` com `avisoTerritorial: true` e uma mensagem explicando o risco de desistência — a família confirma ciência marcando `confirmouCienteDistancia=true` por opção (endpoint de opções aceita esse campo). Isso não impede a inscrição, só torna auditável o que hoje é invisível — dado direto: mais da metade das linhas históricas de Query A são cancelamento (`Cancelado pelo sistema` 39% + `Cancelado na confirmacao` 14,2%), plausivelmente escolha inviável geograficamente.
4. `GET /unidades/proximas` (ranking por distância/bairro + vagas disponíveis) é o ponto de entrada **default** do fluxo de inscrição no frontend — a mãe parte de "unidades perto de mim" em vez de uma lista de 872 sem ordem, mudando o comportamento sem remover a opção de escolher qualquer unidade.

### R8 — classificação por unidade permite até 5 vagas simultâneas pro mesmo CPF

Trava em **duas camadas** (defesa em profundidade, ambas implementáveis hoje):

1. **Física, no banco** (Ângulo 3): `CREATE UNIQUE INDEX uq_oferta_ativa_por_inscricao ON inscricao_opcao(inscricao_id) WHERE situacao IN ('Selecionado','Selecionado da lista','Confirmado')`. Como `inscricao` já é 1-por-criança-por-processo (`UNIQUE(crianca_id, ano_processo)`), essa trava garante — no nível do engine, mesmo sob concorrência — que nunca existem 2 opções em estado de oferta ativa para a mesma criança ao mesmo tempo. Um segundo `UPDATE` que tente ativar outra oferta falha com violação de unicidade, não com bug de aplicação.
2. **De aplicação, no endpoint** (`POST /opcoes/:id/selecionar` — "chamar da fila"): antes do `UPDATE`, verifica se a `inscricao_id` já tem outra opção em `Selecionado`/`Selecionado da lista`/`Confirmado`. Se sim, retorna **409 Conflict** com mensagem clara (a checagem do índice único pega isso de qualquer forma, mas o `if` explícito dá uma mensagem de erro amigável em vez de estourar exceção de SQLite crua). Se não, marca a opção escolhida como `Selecionado` e **as demais opções ativas da mesma inscrição** (que ainda estão `Ativo`) permanecem intocadas — só viram `Bloqueada` quando uma **oferta** de fato existe em outra unidade (não force-cancelar preferências que ainda não foram nem chamadas).
3. `POST /opcoes/:id/confirmar`: numa única transação (`db.transaction`) — marca a opção como `Confirmado`, incrementa `vaga_config.vagas_ocupadas` (com checagem de capacidade, 409 se já lotado), cria a `Matricula`, e marca as **demais opções da mesma inscrição** como `Cancelado na confirmacao` (grafia idêntica ao dataset real). Ao final, estruturalmente não existe estado onde a mesma criança tem 2 opções `Confirmado`/`Selecionado` simultâneas — nem por race condition (índice único), nem por bug de fluxo (transação).
4. `POST /opcoes/:id/desistir`: libera a vaga (`Cancelado`), e a `Inscricao` volta a poder receber nova oferta em outra unidade da lista (a trava do índice único se auto-libera porque não há mais linha em estado ativo).
5. `GET /painel/inconsistencias` — detecta o defeito histórico documentado (R30, ~0,2% dos casos, `Selecionado` + `Lista de espera` simultâneos no mesmo cadastro): para dado gerado pelo fluxo operacional novo, essa query **deve sempre retornar vazio** — é a prova viva do fix na demo.

## 4. Endpoints REST (prefixo `/api`)

### Unidades
| Método | Path | Request → Response | Propósito |
|---|---|---|---|
| `POST` | `/admin/unidades/seed` | (nenhum body — lê CSV local) → `{ importadas, comLatLong }` | bulk-import Query D + join lat/long da planilha (utilitário de hackathon) |
| `POST` | `/unidades` | `{ escCodigo?, nome, tipoGestao, cre?, bairro, cep?, logradouro?, numero?, latitude?, longitude? }` → `Unidade` | cadastro manual de unidade |
| `GET` | `/unidades?bairro=&cre=&tipoGestao=&ativa=` | → `Unidade[]` | listar/filtrar |
| `GET` | `/unidades/:id` | → `Unidade & { vagas: VagaConfig[] }` | detalhe + vagas |
| `GET` | `/unidades/proximas?lat=&lng=&bairro=&grupamento=&turno=&raioKm=5` | → `{ unidadeId, nome, distanciaKm|null, mesmoBairro, vagasDisponiveis }[]` | **núcleo do fix R2** — ranking territorial, default do fluxo de inscrição |
| `PATCH` | `/unidades/:id` | `{ ...campos parciais }` → `Unidade` | atualizar cadastro |

### Vagas
| Método | Path | Request → Response | Propósito |
|---|---|---|---|
| `POST` | `/unidades/:id/vagas` | `{ anoProcesso, grupamento, turno, capacidadeTotal }` → `VagaConfig` | upsert de capacidade (por UNIQUE constraint) |
| `GET` | `/unidades/:id/vagas?anoProcesso=` | → `{ grupamento, turno, capacidadeTotal, vagasOcupadas, vagasDisponiveis }[]` | capacidade × ocupação |
| `PATCH` | `/vagas/:id` | `{ capacidadeTotal }` → `VagaConfig` | ajustar capacidade |

### Responsáveis (portal da mãe — "login" por CPF, sem senha)
| Método | Path | Request → Response | Propósito |
|---|---|---|---|
| `POST` | `/responsaveis` | `{ cpf, nome, telefone?, email?, cep?, bairro, logradouro?, numero? }` → `Responsavel` | cadastra; se CPF já existe, retorna o existente (upsert = "login" simplificado) |
| `GET` | `/responsaveis/:cpf` | → `Responsavel & { criancas: Crianca[] }` | buscar por CPF (chave de sessão simplificada) |
| `PATCH` | `/responsaveis/:id` | `{ ...campos parciais de contato/endereço }` → `Responsavel` | atualizar (recalcula lat/lng se endereço mudar e houver tempo de geocoding) |

### Crianças
| Método | Path | Request → Response | Propósito |
|---|---|---|---|
| `POST` | `/responsaveis/:id/criancas` | `{ nomeCompleto, dataNascimento, sexo?, cpfCrianca? }` → `Crianca` | cadastrar filho(a) |
| `GET` | `/responsaveis/:id/criancas` | → `Crianca[]` | listar filhos |
| `GET` | `/criancas/:id/status` | → `{ crianca, inscricaoAtiva, opcoes[], situacaoConsolidada }` | status **por criança**, não por opção isolada — a tela que hoje não existe |

### Inscrições
| Método | Path | Request → Response | Propósito |
|---|---|---|---|
| `POST` | `/inscricoes` | `{ criancaId, anoProcesso, turnoPreferido?, opcoes: [{ unidadeId, turno }] }` (máx 5, ordem = índice do array) → `{ inscricao, opcoes[], avisoTerritorial? }` | cria inscrição + até 5 opções numa transação; calcula `distanciaKm`/`mesmoBairro` por opção; aplica soft-warning R2 |
| `GET` | `/inscricoes/:id` | → `Inscricao & { opcoes: InscricaoOpcao[] }` | detalhe |
| `GET` | `/responsaveis/:id/inscricoes` | → `Inscricao[]` | inscrições da família |
| `POST` | `/inscricoes/:id/respostas` | `{ respostas: [{ perguntaId, resposta }] }` → `RespostaSocioeconomica[]` | questionário socioeconômico |
| `PATCH` | `/inscricoes/:id/opcoes/:opcaoId` | `{ unidadeId?, turno?, confirmouCienteDistancia? }` → `InscricaoOpcao` | trocar unidade/turno antes do fechamento (só se `situacao='Ativo'`) |
| `DELETE` | `/inscricoes/:id/opcoes/:opcaoId` | → `204` | remover opção (só se `situacao='Ativo'`) |

### Classificação / operação de vaga (operador/CRE)
| Método | Path | Request → Response | Propósito |
|---|---|---|---|
| `POST` | `/opcoes/:id/selecionar` | → `InscricaoOpcao` ou `409` | "chamar da fila" — **trava R8** (checa oferta ativa em outra unidade) |
| `POST` | `/opcoes/:id/confirmar` | → `{ opcao, matricula }` | confirma matrícula, incrementa `vagas_ocupadas`, cancela demais opções em cascata (transação) |
| `POST` | `/opcoes/:id/desistir` | → `InscricaoOpcao` | libera vaga, reabre a inscrição para nova oferta |
| `GET` | `/processos/:ano/fila?unidadeId=&grupamento=&turno=` | → `InscricaoOpcao[]` ordenado por `pontuacaoTotal` desc | fila de uma turma específica |
| `GET` | `/painel/opcoes-pendentes?diasParado=3` | → `InscricaoOpcao[]` | opções `Selecionado` há mais de N dias sem confirmação (fix R31) |
| `GET` | `/painel/inconsistencias` | → `Inscricao[]` (deve ser sempre `[]` para dado operacional) | prova viva do fix R8/R30 |

### IA
| Método | Path | Request → Response | Propósito |
|---|---|---|---|
| `POST` | `/ia/recomendar-unidades` | `{ responsavelId, criancaId, grupamento, turno }` → `{ recomendacoes: [{ unidadeId, distanciaKm|null, vagasDisponiveis, porque }], resumo }` | feature de IA (detalhada na seção 5) |

## 5. Feature de IA — Copiloto de Escolha de Unidades

**Endpoint**: `POST /ia/recomendar-unidades` — combinação do "Copiloto" (Ângulo 1) com a separação determinístico/IA e o fallback obrigatório (Ângulo 3), porque é a mais forte: ataca R2 diretamente, dentro do fluxo real (não um chat solto), e não quebra a demo se a API falhar.

**Fluxo dentro do handler:**
1. **Determinístico primeiro (SQL/haversine, sem IA)**: dado `responsavelId`/`criancaId` + `grupamento`+`turno`, resolve a lista de candidatas — mesma query de `GET /unidades/proximas` — cada uma já com `distanciaKm` (ou `mesmoBairro` se sem geocoding), `vagasDisponiveis` (via `vaga_config`) e tamanho atual da fila (via `GET /processos/:ano/fila`, se já houver inscrições no processo). Corta para as ~8 melhores candidatas.
2. **Só então** esse conjunto de fatos computados (nunca inventados pela IA) vai para a Claude API, server-side (`ANTHROPIC_API_KEY` só no Railway, nunca no bundle Vite), pedindo saída estruturada via `tools`/tool-choice forçado:
   ```json
   {
     "resumo": "string curta orientando a família",
     "recomendacoes": [
       { "unidadeId": "...", "porque": "≤280 chars, ex: 'A 1,2 km de casa, com 4 vagas no turno Integral — sua melhor opção.'" }
     ]
   }
   ```
   Prompt system: "Você ajuda famílias do Rio a entender por que cada creche foi recomendada, priorizando proximidade e chance real de vaga. Use SOMENTE os números fornecidos no payload — nunca invente distância, vaga ou unidade fora da lista." Modelo: `claude-haiku-4-5` (latência baixa, chamada inline num formulário).
3. **Fallback obrigatório** (crítico pra demo estável, do Ângulo 3): timeout curto (~2.5s); se a chamada falhar/expirar, gera `porque` por template determinístico a partir dos mesmos campos ("Fica a {distanciaKm} km de casa, com {vagasDisponiveis} vagas no turno {turno}."). O fluxo de inscrição nunca trava esperando a IA — a resposta sempre volta 200 com `recomendacoes`, só variando a origem do texto (`fonte: "ia"|"fallback"`, opcional no payload de resposta para instrumentar a demo).
4. Frontend: no passo "escolher até 5 unidades" do portal, isso pré-preenche as opções em ordem sugerida — a família aceita ou reordena antes de confirmar via `POST /inscricoes`. É a IA fazendo o trabalho que hoje falta no processo real (R2), como feature de produto, não decoração.

**Por que essa e não as outras**: "explicar classificação" (stretch nas 3 propostas) e "perfil melhor unidade" em linguagem livre são válidas mas dependem de estado que só existe depois da classificação rodar (pontuação, fila) — arriscado ter pronto e testável até 16h30. O copiloto de recomendação roda no primeiro passo do fluxo (cadastro/inscrição), é demonstrável imediatamente após o seed de unidades, e ataca a regra de negócio mais citada no desafio (R2).

## 6. Estrutura de pastas (Elysia)

```
backend/
├── src/
│   ├── index.ts                 # bootstrap Elysia, monta plugins/rotas, porta via env
│   ├── db/
│   │   ├── client.ts             # abre bun:sqlite, PRAGMA foreign_keys=on
│   │   ├── schema.sql            # DDL da seção 2 (executado no startup se tabelas não existem)
│   │   └── migrate.ts            # roda schema.sql idempotente
│   ├── modules/
│   │   ├── unidades/
│   │   │   ├── routes.ts
│   │   │   ├── service.ts        # queries SQL + regra de negócio (proximas, haversine)
│   │   │   └── types.ts
│   │   ├── vagas/
│   │   │   ├── routes.ts
│   │   │   └── service.ts
│   │   ├── responsaveis/
│   │   │   ├── routes.ts
│   │   │   └── service.ts
│   │   ├── criancas/
│   │   │   ├── routes.ts
│   │   │   └── service.ts
│   │   ├── inscricoes/
│   │   │   ├── routes.ts
│   │   │   ├── service.ts        # cria inscrição+opcoes em transação, calcula distancia/aviso
│   │   │   └── types.ts
│   │   ├── classificacao/
│   │   │   ├── routes.ts         # selecionar/confirmar/desistir, fila, painel
│   │   │   └── service.ts
│   │   └── ia/
│   │       ├── routes.ts
│   │       ├── anthropic-client.ts   # wrapper fetch/SDK, timeout, tool schema
│   │       └── fallback.ts           # template determinístico
│   ├── lib/
│   │   ├── geo.ts                # haversine, normalizacao de codigo (lstrip zero)
│   │   ├── cpf.ts                 # validação formato + dígito verificador
│   │   └── errors.ts              # helpers de erro padronizado (400/404/409)
│   └── seed/
│       ├── seed-unidades.ts       # lê Query D + planilha lat/long, popula `unidade`
│       └── seed-perguntas.ts      # opcional: popula `pergunta` de Query C do ano corrente
├── data/
│   └── app.db                     # SQLite, gitignored
├── .env                            # ANTHROPIC_API_KEY, PORT, DATABASE_PATH
├── package.json
└── tsconfig.json
```

Padrão de resposta de erro sugerido (documentar em CLAUDE.md quando scaffolded): `{ error: { code: "R8_OFERTA_ATIVA", message: "..." } }` com status HTTP correspondente — mantém consistência entre módulos sem precisar de middleware complexo hoje.

## 7. Plano de seed inicial

1. **Fonte**: `data/dadoscreche/Bases IC_ ClassificadoseFila/04_UnidadesEscolaresComEndereco.csv` (Query D, sem cabeçalho — colunas `seq,esc_codigo,nome,tipo,logradouro,numero,complemento,bairro,cep`, encoding UTF-8 com BOM, separador `;`).
2. Script `seed-unidades.ts` (Bun, roda direto sem Python): lê o CSV, ignora `seq`, mapeia `tipo` → `tipoGestao` (`Direta`/`Conveniada`/`Parceria` — checar valores reais de `tipo` na Query D antes de fixar o mapeamento; fallback `Direta` se não reconhecido), insere as 2.188 linhas em `unidade` com `escCodigo` normalizado como string (preservando zero à esquerda).
3. **Enriquecimento de geolocalização** (mesma rota de seed, passo 2): ler `data/dadoscreche/OferecimentosEvagas/Unidades_Unificadas_com_Localizacao.xlsx`, aba `Unidades_Unificadas`, filtrar `Tipo` em `{Creche, Creche Parceira, EDI, CDEI}` (~906 linhas), normalizar `DESIGNACAO` (`lstrip('0')` nos dois lados ao comparar com `esc_codigo` normalizado da `unidade` já inserida) e fazer `UPDATE unidade SET latitude=?, longitude=?, cre=? WHERE esc_codigo_normalizado=?`. Ler xlsx com `openpyxl`/lib JS equivalente (`xlsx`/`exceljs` no Bun) — como o achado do join não é 100% verificado em escala (só spot-checado), reportar no log do seed quantas unidades bateram (~esperado próximo de 872, já que essas são as que aparecem em Query A).
4. **Vagas**: sem fonte de capacidade real granular por unidade×grupamento×turno pronta pra hoje — popular `vaga_config` com um valor default plausível (ex. 20-30 por combinação) para as unidades que aparecem na Query A (872), só para a demo não começar com "0 vagas em tudo". Deixar claro na demo que isso é seed sintético, e que o cadastro real de capacidade é o endpoint `POST /unidades/:id/vagas` (o operador da CRE ajusta depois).
5. **Perguntas** (opcional, só se o fluxo de questionário socioeconômico entrar no escopo): popular `pergunta` a partir de `03_QueryC_PerguntasComDescricao.csv`, filtrado pelo ano do processo mais recente (2025) — usar `perg_pontuacao`/`perg_criterio='Sim'` diretamente, sem misturar anos (R28).
6. Endpoint `POST /admin/unidades/seed` expõe esse script via HTTP para rodar/re-rodar durante a demo sem precisar de acesso a terminal (útil se o Railway reiniciar o volume).

## 8. Ordem de implementação sugerida

1. **Setup + schema** (30 min): `bun init` do backend, `bun:sqlite` client, rodar `schema.sql` da seção 2 (sem a IA ainda). Confirmar que sobe com `bun run src/index.ts` e responde em `/health`.
2. **Seed de unidades** (45 min): script da seção 7, passos 1-3 (Query D + lat/long). Validar com `GET /unidades` retornando ~2188 linhas e boa parte com lat/long preenchido. Este passo desbloqueia tudo que depende de unidade existir — priorizar antes de qualquer tela de frontend.
3. **CRUD unidades + vagas** (30 min): `POST/GET/PATCH /unidades`, `POST/GET /unidades/:id/vagas`, seed sintético de `vaga_config` (passo 4 da seção 7). Dá ao frontend algo pra listar imediatamente.
4. **Responsável + crianças** (30 min): `POST /responsaveis` (com validação de CPF formato+dígito), `POST /responsaveis/:id/criancas`. Sem geocoding do responsável ainda (fica pra depois se sobrar tempo — cair no fallback por bairro já é suficiente pro R2 funcionar).
5. **`GET /unidades/proximas`** (30 min): haversine quando lat/long dos dois lados existir, fallback por `mesmoBairro` senão. Esta é a peça mais crítica de R2 — priorizar sobre qualquer polish de outros endpoints.
6. **`POST /inscricoes` + opções** (45 min): transação criando inscrição + até 5 opções, calculando `distanciaKm`/`mesmoBairro`/`avisoTerritorial` por opção. Endpoints de detalhe (`GET /inscricoes/:id`, `GET /responsaveis/:id/inscricoes`).
7. **Trava R8** (45 min): índice único parcial no schema (já deveria estar desde o passo 1, mas testar agora com dado real) + `POST /opcoes/:id/selecionar` (checagem + 409) + `POST /opcoes/:id/confirmar` (transação com cascata) + `POST /opcoes/:id/desistir`. Escrever 1 teste manual (script ou curl) que prova que uma 2ª seleção retorna 409 — isso é o argumento central do pitch, precisa estar rock-solid.
8. **`GET /painel/inconsistencias` e `/painel/opcoes-pendentes`** (20 min): queries simples, mas é a "prova viva" visual do fix — vale ter pronto antes da IA.
9. **Feature de IA** (45-60 min): `POST /ia/recomendar-unidades` com o fluxo determinístico→Claude→fallback da seção 5. Implementar o fallback **antes** de testar a chamada real à API, pra garantir que o endpoint nunca quebra a demo mesmo sem internet/API key configurada.
10. **Polish final** (tempo restante): conectar no frontend Minimal UI Kit as 2-3 telas mínimas (lista de unidades próximas, formulário de inscrição, painel simples de opções pendentes/inconsistências), ajustar mensagens de erro, gravar dados de exemplo variados pra demo (pelo menos 1 caso que dispara `avisoTerritorial` e 1 caso que passa pela trava R8 visivelmente).

Prioridade se o tempo apertar: 1→2→5→6→7 é o caminho crítico que já prova R2+R8 funcionando ponta a ponta. IA (passo 9) e painel (passo 8) são a segunda onda — cortáveis pra um "stub que retorna fallback sempre" se faltar tempo, mas não cortar o passo 7 (é o coração do pitch).
