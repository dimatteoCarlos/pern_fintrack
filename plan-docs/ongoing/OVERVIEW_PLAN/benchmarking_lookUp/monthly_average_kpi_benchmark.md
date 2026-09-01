# Benchmark — "average monthly spending" en apps de fintech personal

**Lives in `plan-docs/`, which is in `.gitignore`: it produces no commit.**

Contexto: soporte de **D14** (`OVERVIEW_DECISIONS.md`) — qué ventana temporal y
qué denominador usa el widget `active_month_average` (antes `MonthlyAverage.tsx`
/ `domain_monthly_average`). Investigación hecha 2026-08-20 vía búsqueda web,
con fuente citada por cada afirmación. Donde no hay documentación pública real,
se anota como tal — no se completa por impresión general.

## Resultado

| app | ventana temporal | ¿excluye meses en cero del denominador? | fuente |
|---|---|---|---|
| Mint (discontinuada) | sin documentación pública del método exacto | no documentado | — |
| Copilot Money | año calendario en curso, sólo meses **completos** (excluye el mes en curso) | no documentado explícitamente; el denominador es "meses completos", no "meses con actividad" | [help.copilot.money — Understanding Key Metrics for Spending](https://help.copilot.money/en/articles/6918427-understanding-key-metrics-for-spending) |
| Monarch Money | ventana móvil de 3 o 6 meses, sólo para sugerir presupuesto por categoría (no un KPI de "gasto promedio") | no documentado | [help.monarch.com — Creating Your Budget](https://help.monarch.com/hc/en-us/articles/360048883631) |
| YNAB | sin KPI "average monthly spending" propio; el reporte de gasto promedia sobre el rango de fechas que el usuario elige manualmente | no documentado | [ynab.com/blog — YNAB Reports and Data](https://www.ynab.com/blog/ynab-reports-and-data) |
| Empower (ex Personal Capital) | ventana móvil fija: **3 meses** para "average monthly spending", **12 meses** para "average yearly spending" — dos ventanas para dos propósitos | no documentado — denominador fijo | [support-personalwealth.empower.com](https://support-personalwealth.empower.com/hc/en-us/articles/204228324) |
| Rocket Money | sin documentación pública | no documentado | — |
| PocketGuard | sin documentación pública; "In My Pocket" es otra métrica (proyección de saldo disponible, no promedio histórico) | no documentado | [pocketguard.com/help/insights](https://pocketguard.com/help/insights/) |

## Conclusión

Documentación real verificada sólo para 3 de 7 apps (Copilot, Empower, Monarch
parcial). Donde el método sí se publica, el denominador es un **conteo fijo de
meses** (calendario o ventana móvil), nunca "meses con transacciones" — lo cual
sugiere que los meses en cero se incluyen, no que se excluyen. Ninguna fuente
confirma ni refuta explícitamente la exclusión de meses en cero.

Patrón real y verificado que sí es útil de imitar: **Empower usa dos ventanas
para dos preguntas distintas** (3 meses = cifra reactiva, 12 meses = cifra
estable), no una ventana única sirviendo dos propósitos.

## Consecuencia para D14

La pregunta que motivó este benchmark — "¿cuánto necesito disponible en un mes
en que sí tengo este tipo de gasto?" — no es la pregunta que ninguna app
documentada responde con su "average monthly spending". Si FinTrack excluye
meses en cero del denominador, es una **decisión de producto propia de
FinTrack** para ese caso de uso específico, no una convención copiada de la
industria. De ahí que el KPI se nombre `active_month_average` y no
`monthly_average`: el nombre debe advertir, en el propio catálogo y en
cualquier tooltip que lo use, que no es un promedio del periodo completo.
