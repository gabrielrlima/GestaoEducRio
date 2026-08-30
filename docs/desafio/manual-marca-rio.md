# Manual de Marca — Prefeitura do Rio 2025 (cores)

> Extraído de `MANUAL DE MARCA PREFEITURA RIO 2025.pdf` (páginas 3-4, seção "Cores"), fornecido pelo usuário. Só a paleta de cores foi extraída — o manual completo tem 46 páginas (tipografia, aplicações de marca, alinhamento de layout, fundos, fotografia, padrões).

## Cores oficiais

### Página 3 — "Cores" (paleta primária)

| | RGB | Hex | CMYK | Pantone |
|---|---|---|---|---|
| Azul-marinho (primária) | R19 / G51 / B90 | `#13335A` | C100 M84 Y38 K30 | 108-16C |
| Neutro claro | R236 / G237 / B237 | `#ECEDED` | C0 M0 Y0 K8 | 179-1C |

### Página 4 — "Cores/degradê" (variação em gradiente)

| | RGB | Hex | CMYK |
|---|---|---|---|
| Azul médio (início do degradê) | R42 / G104 / B143 | `#2A688F` | C83 M50 Y20 K16 |
| Azul claro/vivo (fim do degradê) | R66 / G185 / B235 | `#42B9EB` | C63 M8 Y0 K0 |

## Como foi mapeado pro tema do Minimal UI Kit

`vite-ts/src/theme/theme-config.ts` (`palette.primary`) — as 3 cores azuis reais viraram os 3 tons centrais da rampa de 6 chaves do Minimal (`lighter → light → main → dark → darker → contrastText`), do mais claro pro mais escuro:

| Chave Minimal | Valor | Origem |
|---|---|---|
| `lighter` | `#D6F0FC` | derivado (tint mais claro que `light`, não está no manual) |
| `light` | `#42B9EB` | manual, p.4 (azul vivo do degradê) |
| `main` | `#2A688F` | manual, p.4 (azul médio do degradê) |
| `dark` | `#13335A` | manual, p.3 (**cor primária oficial** da marca) |
| `darker` | `#0A1B30` | derivado (mais escuro que `dark`, não está no manual) |
| `contrastText` | `#FFFFFF` | branco — todas as cores da rampa são escuras/médias o bastante pra texto branco |

**Por que a cor "primária oficial" do manual (`#13335A`) virou `dark` e não `main`**: no Minimal, `main` é usado pervasivamente (botões, links, estado ativo de navegação, chips) — usar o azul-marinho mais escuro em todo elemento pequeno da UI ficaria pesado demais. O azul médio do degradê (`#2A688F`) é mais utilizável como cor de ação geral mantendo a identidade visual, e o marinho oficial aparece no tom `dark` (hover, ênfase, texto do logo) — onde seu peso visual faz mais sentido. `#ECEDED` (neutro claro do manual) não entrou na rampa de `primary` — é um cinza quase-branco, mais adequado como cor de fundo/superfície do que como parte da escala de azul.

`vite-ts/src/theme/core/palette.ts` não precisou de edição própria — ele já deriva `primary` de `themeConfig.palette.primary` via `createPaletteChannel`, então a mudança em `theme-config.ts` propaga sozinha.
