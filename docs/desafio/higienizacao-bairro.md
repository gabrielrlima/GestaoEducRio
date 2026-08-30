# Higienização de dados — Unidades sem bairro

> Registro da investigação e da estratégia aplicada em 2026-08-30 pra reduzir o número de unidades sem `bairro` no cadastro (`backend/src/seed/seed-unidades.ts`). Gerado sob demanda ("existem muitas unidades sem bairro, trace uma estratégia").

## Tamanho do problema

Na Query D bruta (`04_UnidadesEscolaresComEndereco.csv`), **258 das 2.188 unidades (11,8%)** têm o bloco de endereço inteiro vazio na fonte — `logradouro`, `numero`, `bairro` e `cep` todos `NULL` juntos. Não é só bairro faltando isoladamente; é o mesmo grupo de linhas sem endereço nenhum (gotcha já registrado em `dataset-dicionario.md`).

Dessas 258:
- **21 nem têm `esc_codigo`** (também `NULL` na fonte) — impossível cruzar com qualquer outra base por código.
- **237 têm `esc_codigo` válido** — dá pra tentar recuperar por cruzamento.

## Estratégia (camadas, da mais barata pra mais cara)

| Camada | Fonte | Resultado |
|---|---|---|
| **1 — Unidades_Unificadas** (aba com lat/long) | `OferecimentosEvagas/Unidades_Unificadas_com_Localizacao.xlsx`, aba `Unidades_Unificadas`, coluna `BAIRRO` | Já era consultada pro lat/long (`parseGeolocalizacoes`), mas o bairro dela nunca era aproveitado — **bug corrigido** nesta mudança |
| **2 — Planilha1** (aba sem lat/long) | Mesma planilha, aba `Planilha1`, colunas `Designação`/`Bairro` — cobre um conjunto de unidades parcialmente diferente da aba 1 (1.913 linhas) | Fallback quando a Camada 1 não encontra o código |
| **3 — Planilhas de parceiras** (`Parceiras2024/2025.xlsx`, aba `Endereços`) | Testado e descartado — **zero match adicional** além do que as Camadas 1+2 já cobrem (só tem unidade parceira, que já bate nelas) | Não implementado |
| **4 — CEP → bairro (ViaCEP ou similar)** | Testado e descartado — **as mesmas 258 linhas sem bairro também não têm CEP** na fonte, não há nada pra geocodificar a partir de | Não implementado |
| **5 — Geocodificação por nome (API externa)** | Casar unidade por nome contra uma API de lugares (Google Places, Nominatim) | Testado e descartado — falso-positivo (ver item 2 do resíduo abaixo) |
| **6 — Censo Escolar do INEP** (`data/inep/escolas-rio-censo.csv`, download manual do usuário) | Casar por "núcleo" do nome (sem prefixo/tipo/código) contra o CSV; extrai bairro do campo `Endereço`; só aceita match único e sem conflito de código | **Implementado** — ver item 3 do resíduo abaixo |

## Resultado

Rodando `bun run seed:unidades` do zero:

```
[seed-unidades] higienização de bairro: {
  semBairroNaFonte: 258,
  recuperadosViaPlanilha: 99,
  recuperadosViaInep: 11,
  aindaSemBairro: 148,
}
```

(Depois do `INSERT OR IGNORE` deduplicar por `esc_codigo`, a base final fica com **141 de 2.129 unidades** ainda sem bairro — antes eram 210, depois 152 com a Camada 2, agora 141 com a Camada 3 do INEP. Entre as **1.061 creches ativas** especificamente, 119 ficam sem bairro.)

## Camada 3 — Censo Escolar do INEP (implementada em 2026-08-30, sob demanda)

O usuário baixou manualmente um recorte do Censo Escolar do INEP já filtrado pro Rio (`data/inep/escolas-rio-censo.csv`, 4.153 escolas, gitignored — é preciso baixar de novo pra reseedar do zero numa máquina limpa; ver `INEP_CSV_PATH` em `seed-unidades.ts`, tem fallback silencioso se o arquivo não existir).

**Primeira tentativa (descartada): join por código.** O nome de cada escola no CSV do INEP às vezes vem prefixado com um código numérico (`"0918802 EDI PINTANDO O SETE"`, `"05006 - CRECHE CARDEAL CAMARA"`). Confirmamos que esse código bate 1:1 com nosso `esc_codigo` — mas só pra unidades que **já têm bairro preenchido** por outra fonte. Testado contra as unidades que faltam: **0 de 128** aparecem no INEP por código — não estão censadas lá (provavelmente creches conveniadas pequenas, fora do escopo do Censo Escolar).

**Segunda tentativa (implementada): join por "núcleo" do nome.** Normaliza os dois lados (remove prefixo de tipo — `CM`/`CP`/`EDI`/`ESCOLA MUNICIPAL`/etc. —, código numérico inicial, acento e pontuação) e casa pelo nome restante. Extrai o bairro do campo `Endereço` do INEP (formato `"<LOGRADOURO>, <NÚMERO> [COMPLEMENTO.] <BAIRRO>. <CEP> Rio de Janeiro - RJ."` — pega o segmento imediatamente antes do CEP). Só aceita o match se:
- o núcleo do nome for **único** no INEP (descarta nomes ambíguos, ex.: duas escolas diferentes chamadas só "CRECHE MUNICIPAL X"), **e**
- quando os dois lados têm código numérico, os códigos **não colidirem** — achado real que motivou essa checagem: `CM PINTANDO O SETE` (esc_codigo `0918612`) bate por nome com `EDI PINTANDO O SETE` do INEP (código embutido `0918802`) — nomes populares iguais, unidades diferentes (mesmo padrão do falso-positivo que já tínhamos visto com Nominatim). Esse par foi descartado; caiu fora dos 11 recuperados.

Resultado: **11 de 258** unidades recuperadas (todas com nome exclusivo e sem conflito de código) — retorno modesto, mas real e verificado um a um antes de entrar no seed (ex.: `CC CASA SANTA MARTA` → Botafogo, batendo com a favela Santa Marta que fica lá; `CP EDUQUE - VAL` → Vila Valqueire).

**Limitação conhecida:** a checagem de conflito de código só funciona quando *nosso lado* também tem um `esc_codigo` numérico. Unidades sem código na Query D recebem um UUID sintético no seed — nesses casos não há como cross-checar contra um código conflitante do INEP, então o match é aceito só pela unicidade do núcleo do nome (risco residual menor, mas não nulo).

## O que fica em aberto (resíduo de ~141 unidades, ~119 delas creches ativas)

Essas unidades não têm bairro, CEP nem coordenadas em nenhuma fonte de dados testada até agora (Query D, planilhas complementares, Censo Escolar do INEP). Não é (mais) um problema de matching — é ausência real do dado, provavelmente porque são unidades pequenas/conveniadas que nunca foram censadas oficialmente. Saída pendente:

**Curadoria manual pelas CREs** — o backend já expõe `PATCH /unidades/:id` (aceita `bairro`, `cep`, `logradouro` etc.) pronto pra isso. Falta só uma tela de edição no Admin (hoje só tem visualização) e, idealmente, um filtro "Unidades pendentes de higienização" (`GET /unidades?bairro=Não informado` já funciona via o parâmetro de busca existente).

## Onde está o código

`backend/src/seed/seed-unidades.ts` — funções `parseGeolocalizacoes` (Camada 1, já existia, ganhou o campo `bairro`), `parseBairrosPlanilha1` (Camada 2) e `parseInepPorNucleo`/`resolverBairroPorNucleo`/`normalizarNucleoNome`/`extrairBairroDeEndereco` (Camada 3, INEP). Cada camada só roda quando `unidade.bairro === 'Não informado'` depois das anteriores — nunca sobrescreve um bairro que já veio preenchido de uma fonte melhor.
