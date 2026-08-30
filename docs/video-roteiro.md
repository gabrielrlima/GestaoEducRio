# GestaoEducRio — Projeto Completo (base para o vídeo de demo)

> Documento de apoio pra gravar o vídeo de submissão (60s, obrigatório se a app não estiver publicamente acessível — ver `docs/desafio/regras-evento.md`). Junta o problema oficial, a "Jornada Ideal" desenhada pelo time (fonte: `jornada_ideal_mae2.pdf`) e o que **já está de fato implementado** hoje — marcado honestamente separado do que é visão/próximo passo, como os critérios de julgamento pedem ("honesto sobre hoje vs. próximos passos").

---

## 1. O problema, em uma frase

A Prefeitura do Rio recebe **45 mil+ inscrições de creche por processo**, distribuídas por **872 unidades**, e a família escolhe até 5 delas **sem nenhum critério de distância/viabilidade** — o resultado não é falta de vaga, é descompasso: filas que na verdade são cancelamento por escolha inviável, e convocação manual tão frágil que perde família por não atender uma ligação.

**Nosso eixo: Eixo 2 — Inscrição e Classificação.** Construímos a ferramenta operacional que a prefeitura usaria de fato: cadastro de unidades, gestão de vagas por grupamento/turno, e um portal onde a mãe se cadastra, cadastra o(s) filho(s) e escolhe até 5 unidades — com proximidade real entrando na decisão, não mais "escolha às cegas".

---

## 2. A Jornada Ideal da mãe (TO-BE) — o coração da narrativa do vídeo

Este é o desenho de UX completo que o time fez da experiência ponta-a-ponta, comparando com a dor real de hoje (AS-IS). É a melhor história pro vídeo porque cada etapa resolve uma dor nomeada.

**Persona:** mãe/responsável de criança de 0 a 3 anos e 11 meses. Mesmo objetivo de sempre — conseguir uma vaga viável no menor tempo possível, sem perder o filho de vista no meio do processo.

**A virada, em uma frase:** ela deixa de ser passiva e invisível no processo — a plataforma trabalha ativamente a favor dela, do cadastro até a matrícula. Hoje ela só descobre o que está acontecendo se atender o telefone certo na hora certa; na jornada ideal, o sistema trabalha pra alcançá-la por múltiplos canais simultâneos, **dentro do mesmo prazo oficial** (não inventa regra nova — só aumenta a chance real de contato dentro da regra que já existe).

### As 7 etapas

| # | Etapa | Ação da mãe | Ação da plataforma | Dor do AS-IS resolvida | Sentimento |
|---|---|---|---|---|---|
| 1 | **Cadastro sem fricção** | Acessa o portal sem senha; preenche CPF, nascimento, e-mail, endereço, WhatsApp (obrig.) + 1 telefone + 1 contato extra opcional; recebe código de acesso pra voltar depois; é avisada — de forma explícita e obrigatória — que manter o contato atualizado é responsabilidade dela | Gera código único sem senha; guarda dado com consentimento LGPD; reforça o aviso de contato atualizado por e-mail logo após o cadastro | Barreira de senha/esquecimento eliminada. **Previne** a raiz do maior gargalo identificado (contato desatualizado), avisando desde o primeiro contato | "Não preciso lembrar de senha nenhuma" |
| 2 | **Comprovação & Elegibilidade** | Faz upload digital dos documentos dos critérios; se o agente não validar (qualidade/nome/CPF), só aí vai presencialmente a uma creche ou local indicado; cadastra o(s) filho(s) | Agente valida qualidade da imagem + confere nome/CPF; calcula o índice oficial de pontuação (regras reais da SME, 15 pontos de elegibilidade publicados no Diário Oficial) | Ida presencial deixa de ser regra — vira exceção só quando o documento falha | "Só vou pessoalmente se realmente precisar" |
| 3 | **Escolha Inteligente de Creches** | Vê recomendação por proximidade + chance real de vaga (índice próprio); pode escolher outro CEP de referência (ex.: casa de um familiar); escolhe suas 5 creches com apoio visual de mapa | Calcula índice próprio (proxy) de chance de vaga com base em histórico de vacância + distância; gera lista e mapa ordenados por essa chance | Escolha "às cegas" — sem noção de distância/viabilidade real | "Agora eu sei onde tenho mais chance real" |
| 4 | **Classificação** | Dia D (fechamento): recebe notificação com sua **posição inicial em cada uma das 5 creches** — cenário de fila desequilibrado mostrado com transparência; acompanha a evolução direto no portal; ao atingir a **5ª posição** em qualquer uma, recebe alerta extra: "fique atenta às ligações e notificações" | Simula a fila real (vagas ofertadas × mães que colocaram aquela creche entre as 5); aplica o índice oficial pra ranquear; Dia D dispara notificação em massa da posição inicial; a partir de D+1 roda 1x/dia monitorando e disparando o alerta de "5ª posição" | Falta de transparência sobre como a classificação realmente funciona. Ausência de qualquer sinal antecipado de convocação próxima | "Já sei minha posição real em cada creche desde o primeiro dia" |
| 5 | **Convocação Multicanal** | Já alertada previamente, reconhece o contato com mais facilidade; recebe contato do diretor (ligação) + notificações do agente (WhatsApp, e-mail, SMS) — **mínimo de 3 tentativas garantidas**; tem 3 dias pra confirmar | Notifica o diretor que a vaga está disponível; diretor liga (fluxo atual mantido); agente reforça via WhatsApp/e-mail/SMS pra garantir as 3 tentativas | **Maior dor crítica identificada**: contato desatualizado / zero visibilidade da tentativa de convocação | "Fui avisada de várias formas, não corro risco de perder por não atender uma ligação" |
| 6 | **Matrícula** | Tem 2 dias após confirmar pra efetivar presencialmente; se não comparecer, perde a vaga e volta pra fila | Registra a matrícula quando efetivada; se não houve contato/comparecimento, no dia seguinte o sistema roda o Data Lake e libera a vaga automaticamente, buscando o próximo da fila | Perder vaga sem nunca ter sido de fato informada | "Sei exatamente o prazo que tenho" |
| 7 | **Recirculação Automática** | Mesmo sem ter escolhido aquela unidade, pode ser notificada proativamente sobre creches próximas com vaga ociosa | Se não há mais ninguém na fila daquela creche, notifica proativamente mães cadastradas num raio definido (~30km) com a vaga disponível | Vaga ociosa que hoje só o diretor descobre sozinho, via relatório manual | "Mesmo sem ter escolhido, tenho uma chance" |

**Linha do tempo oficial da convocação (não muda, só ganha visibilidade):**
`Convocação iniciada → 3 dias pra responder → 2 dias pra matricular presencialmente → Matrícula efetivada`

**O diferencial da "5ª posição":** hoje não existe nenhum aviso prévio — a mãe só sabe que está sendo convocada se atender a ligação certa na hora certa. A solução cria dois momentos de comunicação que não existem hoje: (1) no Dia D, todo mundo já sabe sua posição real em cada uma das 5 creches — inclusive o retrato desequilibrado de oferta e demanda, mostrado com transparência; (2) a partir daí, o agente roda 1x/dia e dispara um alerta extra só quando a mãe atinge a 5ª posição — criando uma **janela de atenção antecipada** antes da convocação de fato acontecer.

---

## 3. O que já está implementado hoje vs. visão (honestidade > polimento)

| Etapa da Jornada Ideal | Status hoje | Onde está no código |
|---|---|---|
| 1. Cadastro sem fricção | 🟢 **Implementado** — login por CPF + data de nascimento + código de 6 dígitos por e-mail (sem senha) | `backend/src/modules/auth`, `vite-ts/src/pages/portal` (tab Dados pessoais) |
| Endereço (residencial + trabalho/alternativo opcionais) | 🟢 **Implementado** | `vite-ts/src/pages/portal` (tab Endereço), autofill via ViaCEP |
| Cadastro de filho(s), CPF opcional | 🟢 **Implementado** | tab "Cadastrar filho(a)" |
| 3. Escolha por proximidade | 🟡 **Parcial** — ordena por proximidade real do bairro (haversine), mas o "índice próprio de chance de vaga" (proxy com histórico de vacância) ainda não existe | `backend/src/modules/unidades` (`unidadesProximas`), tab "Escolher unidades" |
| Recomendação explicada por IA | 🟢 **Implementado** — `POST /api/ia/recomendar-unidades` usa Claude pra explicar a recomendação em linguagem natural, com fallback determinístico se a API falhar | `backend/src/modules/ia` |
| 4. Classificação com posição visível + alerta "5ª posição" | 🟡 **Parcial** — tab "Status" já mostra a situação consolidada da inscrição (`em_fila`, `confirmada` etc.) e as opções escolhidas com status; o alerta específico de "5ª posição" e a notificação em massa do Dia D são **próximo passo** | `vite-ts/src/pages/portal` (`EtapaStatus`) |
| 2. Comprovação com upload + validação de documento por agente | 🔴 **Próximo passo** — não implementado (upload de documento, validação de imagem/CPF por IA) | — |
| 5. Convocação multicanal (WhatsApp/SMS automático, 3 tentativas garantidas) | 🟡 **Parcial** — o admin já tem o fluxo de Chamar/Confirmar/Desistir por unidade (`unidade-detail.tsx`), com trava de R8 (uma criança não pode ter duas ofertas ativas simultâneas, ver Painel de Pendências); o disparo automático multicanal (WhatsApp/SMS) ainda não existe, só e-mail (usado hoje pro código de login) | `backend/src/modules/classificacao`, `vite-ts/.../unidade-detail.tsx` |
| Painel de Pendências (vaga "Selecionado" há +3 dias sem resposta, inconsistências) | 🟢 **Implementado** — resposta direta ao gap "hoje não existe um painel que sinalize isso" | `vite-ts/src/pages/dashboard/creche/painel.tsx` |
| 6. Matrícula + liberação automática se não comparecer | 🟡 **Parcial** — ação de confirmar/desistir existe; a liberação automática por timeout (Data Lake rodando no dia seguinte) é **próximo passo** | — |
| 7. Recirculação automática (vaga ociosa → raio de 30km) | 🔴 **Próximo passo** — não implementado; mas já identificamos e quantificamos vagas ociosas reais no dataset (ver seção 5) | `docs/desafio/planilhas-dicionario.md` |
| Ocupação visível por unidade (lotada / perto de lotar / quantas crianças) | 🟢 **Implementado hoje** (adicionado nesta sessão) — barra de progresso por unidade na listagem do admin, com cor (verde/amarelo/vermelho) por % de ocupação real | `vite-ts/.../unidade-table-row.tsx` |

**Resumo pro vídeo:** construímos o **esqueleto operacional real** (cadastro sem senha, endereço, filhos, escolha por proximidade real, painel de pendências, ocupação por unidade, IA explicando recomendações) e desenhamos — com nível de detalhe de produto pronto pra construir — as camadas de comunicação multicanal e recirculação automática que fecham a jornada ideal completa.

---

## 4. Papel da IA dentro do produto (exigido no README de submissão)

Não é só "usamos Claude Code pra programar" — o Claude atua **dentro da aplicação**:

- **`POST /api/ia/recomendar-unidades`**: recebe candidatas (unidades próximas, já filtradas por distância real via haversine) e usa a Claude API (`claude-haiku-4-5`) pra gerar uma explicação em linguagem natural de por que cada unidade foi recomendada — citando só números reais fornecidos, nunca inventando dado. Timeout curto (2.5s) e fallback determinístico: se a API falhar ou não tiver chave configurada, a explicação cai num template determinístico com os mesmos números — **a demo nunca quebra por causa da IA**.
- Papel de IA planejado (não implementado): validação de documento (foto + nome + CPF) na etapa de Comprovação, e geração de mensagens de convocação personalizadas por canal.

---

## 5. Dados reais por trás da decisão (prova de "Impacto Real")

- Dataset oficial anonimizado da SME, 2021–2025: 837 mil opções de creche escolhidas, 343 mil inscrições, ~260 mil crianças.
- **39% das opções são "Cancelado pelo sistema" e 14% "Cancelado na confirmação"** — mais da metade das linhas do dataset são cancelamento, não falta de vaga real. É a prova numérica da dor que a Jornada Ideal resolve.
- Achamos e quantificamos **vagas ociosas reais**: 1.665 vagas ociosas confirmadas nas unidades parceiras (maio/2025) — dado que sustenta diretamente a etapa 7 (Recirculação Automática) da jornada.
- Perfil típico: família concentrada na Zona Oeste (Campo Grande lidera), ~50% recebe Bolsa Família ou está no CadÚnico (2024–25) — reforça por que confiabilidade de contato (etapa 1 e 5) importa tanto: é população mais vulnerável a perder a vaga por um telefone desatualizado.

---

## 6. Roteiro sugerido — vídeo de 60s

**Regra do evento**: vídeo é obrigatório só se a app não estiver publicamente acessível. Se o deploy (Vercel + Railway) estiver no ar até 16h30, o vídeo vira reforço, não obrigação — mas ainda vale gravar como plano B garantido.

| Tempo | Cena | Fala/texto na tela |
|---|---|---|
| 0–8s | Abertura: número de cancelamentos (39%) em destaque | "Quase 4 em cada 10 inscrições de creche no Rio terminam canceladas pelo sistema. Não é falta de vaga — é descompasso." |
| 8–18s | Tela do portal: login sem senha, cadastro rápido | "A gente redesenhou a jornada da mãe do zero: cadastro sem senha..." |
| 18–30s | Escolha de unidades por proximidade real (mapa/lista ordenada) + explicação da IA | "...escolha de creche por proximidade real, não mais às cegas — com a Claude explicando por que cada unidade foi recomendada." |
| 30–42s | Painel admin: lista de unidades com barra de ocupação (verde/amarelo/vermelho) | "Do outro lado, o admin vê em tempo real quais unidades estão lotadas e quais têm vaga ociosa..." |
| 42–52s | Painel de Pendências: vaga "Selecionado" há +3 dias, trava de R8 funcionando | "...e um painel que hoje não existe: pendência de convocação parada, e a garantia de que nenhuma criança recebe duas ofertas ao mesmo tempo." |
| 52–60s | Fechamento: nome do time + "GestaoEducRio" + link do repo | "GestaoEducRio — inteligência real pra fila real. [repo/link]" |

---

## 7. Links de referência

- Repositório: https://github.com/gabrielrlima/GestaoEducRio
- Desafio oficial: `docs/desafio/briefing-oficial-sme.md`
- Regras de negócio numeradas: `docs/desafio/regras-negocio.md`
- Dicionário de dados: `docs/desafio/dataset-dicionario.md`
- Checklist do dia / lacunas: `docs/SDD.md`
