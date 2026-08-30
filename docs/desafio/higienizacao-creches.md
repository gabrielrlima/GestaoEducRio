# Higienização de dados — Filtrar só creche (não escola regular)

> Registro da correção aplicada em 2026-08-30 pra parar de mostrar toda a rede municipal (escola regular, CIEP, etc.) no cadastro de "Unidades de Creche". Gerado sob demanda ("estamos mostrando tudo, precisamos da rede direta e parceria mas só creches").

## O problema

A Query D (`04_UnidadesEscolaresComEndereco.csv`) — apesar do dicionário oficial descrevê-la como "cadastro de creches e EDIs" — na prática traz **a rede municipal inteira**: 2.188 unidades, incluindo Escola Municipal regular (fundamental), CIEP, CEJA (educação de jovens/adultos) etc., não só creche. O `seed-unidades.ts` original importava todas as 2.188 sem filtro, e o front listava tudo.

Distribuição de prefixo de nome nas 2.129 unidades seedadas antes da correção:

| Prefixo | Qtd. | É creche? |
|---|---:|---|
| EM (Escola Municipal) | 916 | **Não** — ensino fundamental regular |
| CP (Creche Parceira) | 483 | Sim |
| EDI (Espaço de Desenvolvimento Infantil) | 309 | Sim |
| CM (Creche Municipal) | 262 | Sim (provável) |
| CIEP | 101 | Depende — maioria não é creche |
| Outros (EEM, CEM, CC, "CRECHE" no nome, etc.) | ~58 | Misto |

Ou seja: **quase metade da base (916/2129) era escola regular**, não creche — confirmado cruzando por nome com o Censo Escolar do INEP (ex.: `EM PEDRO BRUNO` → INEP: "ESCOLA MUNICIPAL PEDRO BRUNO", ensino fundamental, sem nenhuma modalidade de creche listada).

## Estratégia de classificação

Fonte de verdade: coluna `Tipo` da planilha `OferecimentosEvagas/Unidades_Unificadas_com_Localizacao.xlsx` (`Escola`, `CIEP`, `Creche`, `Creche Parceira`, `EDI`, `CEJA`, `CDEI`, `Núcleo`, `Clube`) — já é usada pro lat/long, mas antes o Tipo em si era descartado.

1. **Unidade encontrada na planilha** → usa o `Tipo` real: `ativa = 1` só se `Tipo` ∈ {Creche, Creche Parceira, EDI, CDEI}.
2. **Unidade não encontrada na planilha** (não tem geocodificação nem classificação) → heurístico por prefixo do nome:
   - Prefixo `CP`/`EDI`/`CM`/`CC`/`CDEI` ou nome contém "creche" → considera creche.
   - Prefixo `EM`/`EEM`/`CEM`/`CE`/`CIEP`/`CEJA` → considera não-creche.
   - Qualquer outro caso (nome ambíguo/atípico) → **não-creche por padrão** (mais barato corrigir um falso negativo via curadoria manual do que poluir a lista com escola regular).

Implementado em `backend/src/seed/seed-unidades.ts` (`parseTodosOsTipos`, `pareceCreche`) — grava o resultado na coluna `unidade.ativa` que já existia no schema.

## Resultado

```
[seed-unidades] higienização de tipo (só creche fica ativa): {
  crechePlanilha: 955,
  naoCrechePlanilha: 1049,
  crecheHeuristico: 157,
  naoCrecheHeuristico: 27,
  totalAtivas: 1112,
  totalInativas: 1076,
}
```

Base final seedada (após dedupe por `esc_codigo`): **1.061 unidades ativas** (creches) de 2.129 no cadastro completo.

- `GET /unidades` sem filtro continua retornando tudo (2.129) — útil pra auditoria/curadoria.
- `GET /unidades?ativa=true` retorna só as 1.061 creches — é o que o front agora usa (`src/sections/unidade/view/unidade-list-view.tsx`).
- `GET /unidades/proximas` (usado no Portal da mãe) **já filtrava `ativa = 1`** desde que o campo existe no schema — não precisou de mudança, só passou a filtrar corretamente depois que `ativa` passou a refletir o tipo real.

## Limitações conhecidas

- O heurístico por prefixo (157+27 = 184 unidades) não foi validado uma a uma — é uma aproximação razoável, não uma garantia. Se aparecer uma creche legítima marcada como inativa (ou vice-versa) na demo, é esse grupo que deve ser revisado primeiro.
- `1.112` (contagem do seed) ≠ `1.061` (contagem final no banco) — a diferença são duplicatas de `esc_codigo` que o `INSERT OR IGNORE` descarta; não afeta a classificação em si.
- Reclassificação é só na próxima vez que `bun run seed:unidades` rodar do zero — não existe (ainda) um endpoint pra reclassificar sem reseedar.
