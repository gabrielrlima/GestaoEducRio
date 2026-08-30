-- GestaoEducRio backend schema
-- Ver docs/desafio/backend-spec.md na raiz do repo para a justificativa de cada decisão.
-- Convenções: snake_case, UUID como TEXT, timestamps TEXT ISO-8601, booleans INTEGER 0/1.
-- Enums de `situacao` preservam a grafia exata do dataset real (sem acento) para permitir
-- import histórico 1:1 futuramente.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS unidade (
  id              TEXT PRIMARY KEY,
  esc_codigo      TEXT UNIQUE,            -- = esc_codigo (Query D) / unidade (Query A). String: zero à esquerda é significativo
  nome            TEXT NOT NULL,
  tipo_gestao     TEXT NOT NULL CHECK (tipo_gestao IN ('Direta','Conveniada','Parceria')),
  tipo_origem_raw INTEGER,                -- código numérico bruto da coluna `tipo` da Query D (1/3/4); NÃO usado pra derivar tipo_gestao (checamos: não correlaciona com prefixo de nome/gestão) — preservado só pra auditoria futura, ver seed-unidades.ts
  cre             INTEGER,                -- 1-11
  logradouro      TEXT,
  numero          TEXT,
  complemento     TEXT,
  bairro          TEXT NOT NULL,
  cep             TEXT,
  latitude        REAL,
  longitude       REAL,
  ativa           INTEGER NOT NULL DEFAULT 1,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vaga_config (
  id                TEXT PRIMARY KEY,
  unidade_id        TEXT NOT NULL REFERENCES unidade(id),
  ano_processo      INTEGER NOT NULL,
  grupamento        TEXT NOT NULL CHECK (grupamento IN ('Bercario','Maternal I','Maternal II')),
  turno             TEXT NOT NULL CHECK (turno IN ('Integral','Parcial')),
  capacidade_total  INTEGER NOT NULL DEFAULT 0,
  vagas_ocupadas    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (unidade_id, ano_processo, grupamento, turno)
);

CREATE TABLE IF NOT EXISTS responsavel (
  id                TEXT PRIMARY KEY,
  cpf               TEXT NOT NULL UNIQUE,
  nome              TEXT NOT NULL,
  data_nascimento   TEXT NOT NULL,     -- da mãe/responsável — usado no login do portal (CPF + data nascimento + código por e-mail)
  telefone          TEXT,
  email             TEXT NOT NULL,     -- obrigatório: é pra onde vai o código de verificação (2FA)
  cep               TEXT,               -- endereço residencial (principal — usado pelo motor de recomendação de creches)
  bairro            TEXT NOT NULL,
  logradouro        TEXT,
  numero            TEXT,
  complemento       TEXT,
  latitude          REAL,
  longitude         REAL,
  trabalho_cep          TEXT,           -- endereço de trabalho — opcional, referência extra pra escolha de creches
  trabalho_bairro       TEXT,
  trabalho_logradouro   TEXT,
  trabalho_numero       TEXT,
  trabalho_complemento  TEXT,
  trabalho_latitude     REAL,           -- geocodificado junto com o endereço; sem isso não há distância nem rota
  trabalho_longitude    REAL,
  alternativo_cep          TEXT,        -- endereço alternativo (ex.: casa de familiar) — opcional
  alternativo_bairro       TEXT,
  alternativo_logradouro   TEXT,
  alternativo_numero       TEXT,
  alternativo_complemento  TEXT,
  alternativo_latitude     REAL,
  alternativo_longitude    REAL,
  nis                          TEXT,     -- Número de Identificação Social, opcional — usado só pra consultar Bolsa Família
  bolsa_familia_status         TEXT CHECK (bolsa_familia_status IN ('sim','nao','nao_consultado')) NOT NULL DEFAULT 'nao_consultado',
  bolsa_familia_consultado_em  TEXT,
  criado_em         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agregado histórico por unidade × ano × grupamento × turno, derivado da Query A do dataset
-- oficial (01_QueryA_InscricoesPorAno.csv.gz, 837k linhas / 2021-2025) pelo seed
-- src/seed/seed-historico.ts. Fonte da "vacância histórica" e da concorrência real.
CREATE TABLE IF NOT EXISTS unidade_historico (
  id                     TEXT PRIMARY KEY,
  unidade_id             TEXT NOT NULL REFERENCES unidade(id),
  ano                    INTEGER NOT NULL,
  grupamento             TEXT NOT NULL CHECK (grupamento IN ('Bercario','Maternal I','Maternal II')),
  turno                  TEXT NOT NULL CHECK (turno IN ('Integral','Parcial')),
  inscricoes             INTEGER NOT NULL DEFAULT 0,   -- opções escolhidas nessa unidade/grupamento/turno
  primeira_opcao         INTEGER NOT NULL DEFAULT 0,   -- subconjunto que escolheu a unidade como 1ª opção
  confirmados            INTEGER NOT NULL DEFAULT 0,   -- situacao = 'Confirmado' (matrícula efetivada)
  lista_espera           INTEGER NOT NULL DEFAULT 0,
  selecionados           INTEGER NOT NULL DEFAULT 0,   -- 'Selecionado' + 'Selecionado da lista' + 'Ativo'
  cancelados_sistema     INTEGER NOT NULL DEFAULT 0,   -- 'Cancelado pelo sistema' (efeito de R8: vaga fantasma)
  cancelados_confirmacao INTEGER NOT NULL DEFAULT 0,   -- 'Cancelado na confirmacao' (grafia do dataset, sem acento) = vaga que vagou
  cancelados_outros      INTEGER NOT NULL DEFAULT 0,   -- 'Cancelado' + 'Bloqueada'
  UNIQUE (unidade_id, ano, grupamento, turno)
);

CREATE INDEX IF NOT EXISTS idx_unidade_historico_unidade ON unidade_historico(unidade_id, grupamento, turno);

-- Consolidação de `unidade_historico` em métricas por unidade × grupamento × turno, com a
-- classificação determinística em tercis (baixa/media/alta) dentro da região de referência.
-- Recalculada inteira pelo seed — não escrever aqui em runtime.
CREATE TABLE IF NOT EXISTS unidade_disponibilidade (
  unidade_id                    TEXT NOT NULL REFERENCES unidade(id),
  grupamento                    TEXT NOT NULL,
  turno                         TEXT NOT NULL,
  anos_cobertos                 INTEGER NOT NULL,
  inscricoes_media              REAL NOT NULL,   -- demanda média por ano
  confirmados_media             REAL NOT NULL,   -- matrículas efetivadas por ano (proxy de vagas que giram)
  vacancia_media                REAL NOT NULL,   -- 'Cancelado na confirmacao' médio/ano = vaga ofertada que vagou
  taxa_oferta                   REAL NOT NULL,   -- (confirmados + cancelados_confirmacao) / inscricoes = chance histórica de ser convocado
  taxa_absorcao                 REAL NOT NULL,   -- confirmados / inscricoes — convocados que de fato matricularam
  taxa_vacancia                 REAL NOT NULL,   -- cancelados_confirmacao / (confirmados + cancelados_confirmacao) = vaga ofertada que vagou
  concorrencia                  REAL,            -- inscricoes / confirmados (candidatos por vaga preenchida); NULL se confirmados = 0
  indice_disponibilidade        REAL NOT NULL,   -- = taxa_oferta (ver seed-historico.ts para a justificativa)
  regiao_referencia             TEXT NOT NULL,   -- 'bairro:TIJUCA' ou 'cidade' quando o bairro tem amostra pequena
  percentil_regiao              REAL NOT NULL,   -- 0-1 dentro da região de referência
  classe_regiao                 TEXT NOT NULL CHECK (classe_regiao IN ('baixa','media','alta')),
  percentil_cidade              REAL NOT NULL,
  classe_cidade                 TEXT NOT NULL CHECK (classe_cidade IN ('baixa','media','alta')),
  PRIMARY KEY (unidade_id, grupamento, turno)
);

-- Código de verificação (2FA) enviado por e-mail no login do portal da mãe
CREATE TABLE IF NOT EXISTS login_codigo (
  id              TEXT PRIMARY KEY,
  responsavel_id  TEXT NOT NULL REFERENCES responsavel(id),
  codigo          TEXT NOT NULL,        -- 6 dígitos
  expira_em       TEXT NOT NULL,
  usado           INTEGER NOT NULL DEFAULT 0,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessão simples pós-login (portal da mãe ou admin) — token opaco, sem JWT (suficiente pro MVP de hoje)
CREATE TABLE IF NOT EXISTS sessao (
  token           TEXT PRIMARY KEY,
  tipo            TEXT NOT NULL CHECK (tipo IN ('responsavel','admin')),
  responsavel_id  TEXT REFERENCES responsavel(id),  -- NULL quando tipo='admin'
  expira_em       TEXT NOT NULL,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crianca (
  id                TEXT PRIMARY KEY,
  responsavel_id    TEXT NOT NULL REFERENCES responsavel(id),
  nome_completo     TEXT NOT NULL,
  data_nascimento   TEXT NOT NULL,
  sexo              TEXT CHECK (sexo IN ('M','F')),
  cpf_crianca       TEXT NOT NULL,
  criado_em         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inscricao (
  id                    TEXT PRIMARY KEY,
  crianca_id            TEXT NOT NULL REFERENCES crianca(id),
  responsavel_id        TEXT NOT NULL REFERENCES responsavel(id),
  ano_processo          INTEGER NOT NULL,
  grupamento_pretendido TEXT NOT NULL CHECK (grupamento_pretendido IN ('Bercario','Maternal I','Maternal II')),
  turno_preferido       TEXT CHECK (turno_preferido IN ('Integral','Parcial','Qualquer')),
  pontuacao_total       INTEGER,
  criado_em             TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (crianca_id, ano_processo)
);

CREATE TABLE IF NOT EXISTS inscricao_opcao (
  id                          TEXT PRIMARY KEY,
  inscricao_id                TEXT NOT NULL REFERENCES inscricao(id),
  ordem_preferencia           INTEGER NOT NULL CHECK (ordem_preferencia BETWEEN 1 AND 5),
  unidade_id                  TEXT NOT NULL REFERENCES unidade(id),
  turno                       TEXT NOT NULL CHECK (turno IN ('Integral','Parcial')),
  distancia_km                REAL,
  tipo_distancia              TEXT CHECK (tipo_distancia IN ('geocodificada','estimada_bairro','indisponivel')),
  mesmo_bairro                INTEGER NOT NULL DEFAULT 0,
  confirmou_ciente_distancia  INTEGER NOT NULL DEFAULT 0,
  situacao                    TEXT NOT NULL DEFAULT 'Ativo' CHECK (situacao IN (
                                 'Ativo','Selecionado','Selecionado da lista','Confirmado',
                                 'Lista de espera','Cancelado','Cancelado na confirmacao',
                                 'Cancelado pelo sistema','Bloqueada')),
  data_mudanca_status         TEXT NOT NULL DEFAULT (datetime('now')),
  criado_em                   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (inscricao_id, ordem_preferencia),
  UNIQUE (inscricao_id, unidade_id)
);

-- Trava física de R8: nunca mais de 1 opção "ativa" (oferta em curso ou vaga tomada) por inscrição
CREATE UNIQUE INDEX IF NOT EXISTS uq_oferta_ativa_por_inscricao
  ON inscricao_opcao (inscricao_id)
  WHERE situacao IN ('Selecionado','Selecionado da lista','Confirmado');

CREATE TABLE IF NOT EXISTS pergunta (
  id                  TEXT PRIMARY KEY,
  ano_processo        INTEGER NOT NULL,
  texto               TEXT NOT NULL,
  pontuacao           INTEGER NOT NULL DEFAULT 0,
  criterio_desempate  INTEGER NOT NULL DEFAULT 0,
  ordem               INTEGER
);

CREATE TABLE IF NOT EXISTS resposta_socioeconomica (
  id           TEXT PRIMARY KEY,
  inscricao_id TEXT NOT NULL REFERENCES inscricao(id),
  pergunta_id  TEXT NOT NULL REFERENCES pergunta(id),
  resposta     TEXT NOT NULL CHECK (resposta IN ('Sim','Nao')),
  confirmado   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (inscricao_id, pergunta_id)
);

CREATE TABLE IF NOT EXISTS matricula (
  id                  TEXT PRIMARY KEY,
  inscricao_opcao_id  TEXT NOT NULL UNIQUE REFERENCES inscricao_opcao(id),
  data_confirmacao    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Saída do agente de recomendação de IA (backend/src/modules/ia/) — registro do que foi
-- recomendado e por quê, independente das opções que a família de fato escolheu em inscricao_opcao.
CREATE TABLE IF NOT EXISTS ia_recomendacao (
  id              TEXT PRIMARY KEY,
  responsavel_id  TEXT NOT NULL REFERENCES responsavel(id),
  crianca_id      TEXT NOT NULL REFERENCES crianca(id),
  inscricao_id    TEXT REFERENCES inscricao(id),
  resumo          TEXT NOT NULL,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ia_recomendacao_item (
  id               TEXT PRIMARY KEY,
  recomendacao_id  TEXT NOT NULL REFERENCES ia_recomendacao(id),
  unidade_id       TEXT NOT NULL REFERENCES unidade(id),
  ordem            INTEGER NOT NULL CHECK (ordem BETWEEN 1 AND 5),
  porque           TEXT NOT NULL,
  badge            TEXT,               -- rótulo curto opcional pro card do portal ("Alta chance de vaga", ...)
  UNIQUE (recomendacao_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_unidade_bairro ON unidade(bairro);
CREATE INDEX IF NOT EXISTS idx_inscricao_opcao_unidade ON inscricao_opcao(unidade_id);
CREATE INDEX IF NOT EXISTS idx_inscricao_opcao_inscricao ON inscricao_opcao(inscricao_id);
CREATE INDEX IF NOT EXISTS idx_ia_recomendacao_responsavel ON ia_recomendacao(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_ia_recomendacao_item_recomendacao ON ia_recomendacao_item(recomendacao_id);
CREATE INDEX IF NOT EXISTS idx_crianca_responsavel ON crianca(responsavel_id);
