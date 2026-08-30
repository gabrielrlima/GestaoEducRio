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
| **5 — Geocodificação por nome (API externa)** | Casar unidade por nome contra uma API de lugares (Google Places, Nominatim) | Não implementado — risco de falso-positivo por nome ambíguo, e são só ~2h30 restantes de hackathon; ver "resíduo" abaixo |

## Resultado

Rodando `bun run seed:unidades` do zero:

```
[seed-unidades] higienização de bairro: {
  semBairroNaFonte: 258,
  recuperadosViaPlanilha: 99,
  aindaSemBairro: 159,
}
```

(Depois do `INSERT OR IGNORE` deduplicar por `esc_codigo`, a base final fica com **152 de 2.129 unidades** ainda sem bairro — antes eram 210.)

## O que fica em aberto (resíduo de ~152 unidades)

Essas unidades não têm bairro, CEP nem coordenadas em **nenhuma fonte de dados fornecida pro hackathon**. Não é um problema de código — é ausência de dado na origem. Duas saídas, nenhuma implementada automaticamente hoje:

1. **Curadoria manual pelas CREs** — o backend já expõe `PATCH /unidades/:id` (aceita `bairro`, `cep`, `logradouro` etc.) pronto pra isso. Falta só uma tela de edição no Admin (hoje só tem visualização) e, idealmente, um filtro "Unidades pendentes de higienização" (`GET /unidades?bairro=Não informado` já funciona via o parâmetro de busca existente).
2. **Geocodificação por nome via API externa** — mais rápido de escalar, mas arriscado sem revisão humana (nome de escola não é único o bastante pra confiar cegamente). Não fizemos isso hoje por causa do tempo e do risco.

## Onde está o código

`backend/src/seed/seed-unidades.ts` — funções `parseGeolocalizacoes` (Camada 1, já existia, ganhou o campo `bairro`) e `parseBairrosPlanilha1` (Camada 2, nova). O fallback só é aplicado quando `unidade.bairro === 'Não informado'` — nunca sobrescreve um bairro que já veio preenchido da Query D.
