# SDD — Planilhas Complementares (OferecimentosEvagas + Nascidos Vivos)

> Contexto de IA separado de `dataset-dicionario.md` (que cobre só as 4 Queries CSV — o core do desafio). Este arquivo cobre as **planilhas Excel complementares** do repo [`CIT-SME-RJ/dadoscreche`](https://github.com/CIT-SME-RJ/dadoscreche): pasta `OferecimentosEvagas/` e `NascidosvivosRJ.xlsx`. Inspecionado diretamente (abas, cabeçalhos, linhas) em 2026-08-30 — os arquivos não têm dicionário oficial além de um LEIAME curto, então boa parte do que segue é observação direta, não documentação da fonte.

## Resumo executivo

| Arquivo | Qualidade dos dados | Uso recomendado |
|---|---|---|
| `NascidosvivosRJ.xlsx` | ✅ Limpo, formato de matriz estável | **Eixo 1** — proxy direto de demanda futura por bairro |
| `Unidades_Unificadas_com_Localizacao.xlsx` | ✅ Bom, mas 2 abas com schemas diferentes | **Eixo 1/2** — geocodificação (lat/long) das unidades |
| `Parceiras{2021..2025}.xlsx` | ⚠️ Schema muda **todo ano** | Uso pontual, exige parser por ano |
| `totalalunoscreche{2021..2025}.xlsx` | ⚠️ Schema muda quase todo ano, muitas células vazias | Uso pontual, exige parser por ano |

**Achado não documentado na fonte oficial:** os códigos de unidade usados nessas planilhas (`DESIGNAÇÃO` / `CÓDIGO SGA` / `Designacao`) **são o mesmo código que `esc_codigo`** da Query D / campo `unidade` da Query A do dataset core — só com zero à esquerda inconsistente entre arquivos (ex.: `1004` na planilha = `01004` no CSV; `101501` na planilha = `0101501` no CSV; `0101001` bate exatamente nos dois). Confirmado cruzando por nome em 3 unidades (Cantinho Feliz de Santa Teresa, Vicente Licínio Cardoso, CIEP Henfil). **Isso significa que dá pra enriquecer o dataset core com essas planilhas** (geolocalização, vagas ofertadas por parceira) — mas normalize o código antes de juntar (`int(codigo)` ou `zfill`/`lstrip('0')` dos dois lados) e trate como **não 100% verificado em escala**, só spot-checado.

## `NascidosvivosRJ.xlsx`

Aba única (`A094700187_111_98_112`, nome de export do sistema de origem — provavelmente DATASUS/SIM). **175 linhas, 13 colunas.**

- **Bloco de título** nas linhas 1–4 (não é dado — "Nascidos Vivos no Município do Rio de Janeiro", "Município Residência: 330455", "Período: 2016–2026").
- **Cabeçalho real na linha 5**: `Bairro Residencia`, `2016`...`2026` (uma coluna por ano), `Total`.
- **Uma linha por bairro** (ex.: `001 SAUDE`, `002 GAMBOA`...) — o código do bairro vem concatenado ao nome na mesma célula (`"NNN NOME"`), precisa `split` manual se quiser separar código/nome.
- Valores são contagem de nascidos vivos por ano, já com coluna `Total` pré-calculada.
- **Uso direto para Eixo 1**: nascimentos de hoje viram demanda de creche daqui a ~0–4 anos (idade de berçário/maternal) — dá pra projetar demanda futura por bairro sem nenhum modelo sofisticado, só deslocando a série temporal.
- **Gotcha de leitura**: `header=4` (pular as 4 linhas de título) ao ler com pandas/openpyxl.

## `Unidades_Unificadas_com_Localizacao.xlsx`

**Duas abas com schemas diferentes** — parecem ser duas versões/fontes do mesmo cadastro, não use as duas juntas sem checar duplicidade:

### Aba `Unidades_Unificadas` (1.942 linhas)
Colunas: `DESIGNACAO`, `CRE`, `microárea`, `DENOMINACAO`, `RUA`, `BAIRRO`, `LATITUDE`, `LONGITUDE`, `Tipo`.

Distribuição por `Tipo`: `Escola` 930, `Creche Parceira` 372, `EDI` 286, `Creche` 247, `CIEP` 101, `CEJA` 2, `CDEI`/`Núcleo`/`Clube` 1 cada.

- **Tem lat/long real** — pronta pra geoprocessamento/mapa sem precisar geocodificar nada.
- **Filtrar por Tipo** antes de usar: só `Creche`, `Creche Parceira`, `EDI` e `CDEI` são relevantes pro desafio de creche (≈ 906 linhas) — `Escola`, `CIEP`, `CEJA`, `Núcleo`, `Clube` são outras modalidades da rede (fundamental, jovens e adultos etc.), fora de escopo.
- `microárea` aqui já vem preenchida pra parte das linhas — cruza conceitualmente com o shapefile `Microáreas_SME_revisãoIPP/`, mas **não confirmei se o código bate exatamente com o campo de identificação do shapefile** — validar antes de assumir join direto.

### Aba `Planilha1` (1.915 linhas)
Colunas diferentes: `CRE`, `Designação`, `Nome`, `Endereço`, `Bairro`, `Referência`, `Microarea`, `Polo`. Sem lat/long, mas tem `Polo` (conceito que aparece no dataset core como `plm_id` — possível ponte, não confirmado).

## `Parceiras{2021..2025}.xlsx` — cadastro de unidades conveniadas

**Schema muda todo ano — não existe leitura genérica, precisa de um parser por ano:**

| Ano | Abas | Observação |
|---|---|---|
| 2021 | `Planilha1` | Cabeçalho em 2 linhas mescladas (linha 1 + linha 2), dado começa na linha 4 |
| 2022 | `MAIO`, `QUADRO RESUMO` | Cabeçalho em 2 linhas; `QUADRO RESUMO` é um pivot já agregado por CRE — útil se só precisar do total |
| 2023 | `2023` | **Primeiro ano com identificadores fortes**: `CÓDIGO SGA`, `INEP`, `CNPJ`, `SISEP` — melhor ano pra tentar join |
| 2024 | `Apoio`, `Endereços`, `Maio-2024` | 3 abas: `Apoio` é uma tabela de lookup numérica sem cabeçalho claro (não decifrado — investigar antes de usar); `Endereços` é um cadastro auxiliar (`DESIGNAÇÃO`/nome/endereço/bairro); dado principal em `Maio-2024`, cabeçalho de novo em múltiplas linhas com merge |
| 2025 | `Apoio`, `Endereços`, `MAIO -2025` | Mesma estrutura de 2024, mas a aba de dados reorganiza colunas (Meta/Vagas/Aluno/Incluído por grupamento em vez de Turma/Aluno) |

- Coluna de código de unidade existe em todos os anos (`Nº do Fomento` em 2021, `CÓDIGO SGA`/`DESIGNAÇÃO` em 2023–2025) mas **o nome da coluna muda**.
- Grupamentos etários (`B I`, `B II`, `M I`, `M II` = Berçário I/II, Maternal I/II) aparecem em todos os anos, mas a granularidade das sub-colunas (`Turmas`/`Alunos` vs. `Aluno`/`Incluído` vs. `Meta`/`Vagas`) muda ano a ano — **não dá pra montar série temporal direto sem normalizar manualmente cada ano primeiro**, igual ao gotcha já documentado da régua de pontuação em `dataset-dicionario.md`.

## `totalalunoscreche{2021..2025}.xlsx` — matrícula em unidades públicas

Mesma lógica de drift de schema ano a ano:

| Ano | Aba | Observação |
|---|---|---|
| 2021 | `2021` | Cabeçalho em 3 linhas (`TP`/`TU` = Turno Parcial/Turno... a confirmar sigla) |
| 2022 | `25MAI2022` | Nome da aba é uma data — não dá pra iterar por nome de aba fixo, precisa pegar a primeira/única aba do arquivo |
| 2023 | `CONSOLIDADO` | Volta ao padrão Integral/Parcial |
| 2024 | `Consolidado` | Cabeçalho tem uma linha extra "Rótulos de Linha" (resíduo de export de tabela dinâmica do Excel) |
| 2025 | `Consolidado` | Igual 2024 |

- **~1.550 linhas por ano, mas a maioria das células de contagem vem vazia (`None`)** — a amostra inspecionada mostrou dezenas de linhas seguidas sem nenhum aluno preenchido. Antes de tirar qualquer conclusão de "unidade sem alunos", checar se `None` significa zero ou significa "não é unidade de creche" (a base cobre TODAS as unidades da rede, não só as com oferta de creche).
- Coluna de código de unidade (`Designacao`/`Designação`) segue o mesmo formato `CRE + sequencial` (`0101001`) visto no achado de join acima — **é a mesma família de código de `esc_codigo`**.

## Recomendação prática de uso (dado o tempo do hackathon)

1. **Usar sem hesitar**: `NascidosvivosRJ.xlsx` (limpo, direto) e a aba `Unidades_Unificadas` de `Unidades_Unificadas_com_Localizacao.xlsx` (filtrada por Tipo) — ambos prontos pra consumir com pouquíssimo parsing.
2. **Usar com cautela, só se o eixo escolhido precisar**: `Parceiras2023.xlsx` (o ano com melhores identificadores) como amostra pontual de vagas ofertadas por parceira — não tentar reconstruir série temporal 2021–2025 sem orçar tempo extra pra normalizar cada ano.
3. **Evitar hoje**: reconciliar `totalalunoscreche*` ano a ano ou decifrar a aba `Apoio` de 2024/2025 — baixo retorno pro tempo que consome num hackathon de 1 dia.

## Como ler (Python)

```python
import openpyxl

# NascidosvivosRJ — pular bloco de título
wb = openpyxl.load_workbook("NascidosvivosRJ.xlsx", read_only=True, data_only=True)
ws = wb[wb.sheetnames[0]]
rows = list(ws.iter_rows(min_row=5, values_only=True))  # linha 5 = cabeçalho real

# Unidades_Unificadas — filtrar tipos relevantes de creche
wb2 = openpyxl.load_workbook("OferecimentosEvagas/Unidades_Unificadas_com_Localizacao.xlsx", read_only=True, data_only=True)
ws2 = wb2["Unidades_Unificadas"]
TIPOS_CRECHE = {"Creche", "Creche Parceira", "EDI", "CDEI"}
unidades_creche = [r for r in ws2.iter_rows(min_row=2, values_only=True) if r[8] in TIPOS_CRECHE]

# Normalizar código pra cruzar com esc_codigo da Query D / unidade da Query A
def norm_codigo(c):
    return str(c).lstrip("0") or "0"
```

> `pandas.read_excel` funciona igual para todos esses arquivos, mas openpyxl é mais previsível aqui porque vários arquivos têm cabeçalho em múltiplas linhas/mesclado — ler cru com openpyxl e montar o cabeçalho manualmente evita o pandas inferir errado.
