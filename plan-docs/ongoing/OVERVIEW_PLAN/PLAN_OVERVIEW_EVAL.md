# EVALUACIÓN — `plan-docs/ongoing/OVERVIEW_PLAN/PLAN_OVERVIEW.md`

**Lives in `plan-docs/`, which is in `.gitignore`: it produces no commit.**

Producido 2026-08-20 por un agente arquitecto de solo lectura, con especialidad
en KPI financieros, arquitectura de tableros y presentación de posiciones de
inversión. No modificó ningún archivo del repositorio.

Este documento evalúa el plan. **No lo reemplaza.** Donde los dos difieran, el
plan sigue siendo la especificación hasta que el desarrollador cierre la decisión
correspondiente en §D.

---

**Veredicto general.** El plan es sólido y su §2 está genuinamente medido: de 40
afirmaciones verificables se comprobaron **31 CONFIRMADAS, 6 IMPRECISAS y 3
OBSOLETAS**. Los anclajes `file:line` son exactos en la gran mayoría, incluyendo
los difíciles (`money.js:129/:141`, `currencyAmountConversion.js:30`,
`useBudgetStatusStore.ts:128`). Las tres arquitecturas que propone (§3), las
cuatro reglas guardián (§4) y el contrato (§5) son correctos en dirección. Donde
falla es en tres puntos que **bloquean la fase 1**: (1) §10 saca del alcance
reescribir los controladores legacy, lo cual choca de frente con §4.2 y garantiza
una *quinta* implementación de la fórmula de remaining; (2) §4.3 no dice nunca
**qué tasa** aplica a un flujo frente a un stock, que es precisamente la clase de
error que la regla existe para impedir; (3) §7.1 ("una sola request") y §7.13
("un fallo no borra la pantalla") son mutuamente incompatibles salvo que el read
model sea degradable por sección, y eso no está en el contrato. Además el plan
**no mide una sola línea de CSS** del módulo, y ahí hay violaciones directas de
las reglas que él mismo pone como criterio de aceptación.

---

## A. Verificación del plan contra el código

### A.1 Inventario del módulo (§2.1)

| afirmación | código hoy | veredicto | anclaje |
|---|---|---|---|
| 13 archivos, 2 CSS | exactamente 13; `overview-styles.css` + `transactionDetailModal.css` | CONFIRMADO | `pages/overview/` |
| conteos de líneas de los 11 archivos | coinciden todos (±1 por falta de salto final) | CONFIRMADO | `Overview.tsx:483`, `OverviewLayout.tsx:261`, `overviewFetchAll.ts:352` |
| sin archivo de tipos, todo inline | así es | CONFIRMADO | `Overview.tsx:44-78`, `CalculateMonthlyAverage.ts:7-26`, `LastMovements.tsx:7-23`, `overviewFetchAll.ts:54-86` |
| 4 sitios de import externos | exactos | CONFIRMADO | `App.tsx:42`, `App.tsx:45`, `ListContent.tsx:18`, `ListContent.tsx:25` |

> **Remedido 2026-08-30.** El módulo perdió un archivo. `SavingGoals.tsx` fue
> borrado por el commit `b40c4b8` *fix(overview): remove every pocket read*
> (2026-08-30), junto con las tres peticiones de bolsillo. El árbol tiene hoy
> **12 archivos, 2 de ellos CSS**, y los conteos de línea que esta tabla dio por
> coincidentes ya no coinciden: `Overview.tsx` 430 (era 483), `OverviewLayout.tsx`
> 233 (era 261), `overviewFetchAll.ts` 337 (era 352), `MonthlyAverage.tsx` 165
> (era 128, creció con `4c6299e` *feat(overview): show the year to date*). Los
> anclajes de tipos inline se mueven a `Overview.tsx:45-73` y
> `overviewFetchAll.ts:53-63, :78-81`. Los cuatro sitios de import externos
> siguen siendo exactos.

### A.2 Lista de render plana (§2.2)

| afirmación | código hoy | veredicto | anclaje |
|---|---|---|---|
| 11 widgets hermanos, sin flex ni grid | `.cards__presentation` sólo declara width/margin/radius/padding | CONFIRMADO | `Overview.tsx:407-481`; `generalStyles.css:236-242` |
| `AccountBalance` e `InvestmentAccBalance` devuelven fragmento | así es | CONFIRMADO | `AccountBalance.tsx:98-140`, `InvestmentAccBalance.tsx:81-177` |

### A.3 Dieciséis requests (§2.3) — recontadas

Contadas sitio por sitio, sin confiar en el número del plan:

- 6 × `useFetch` en `OverviewLayout.tsx:37, 52, 69, 86, 102, 118` (mismo controlador, seis `?type=`).
- 8 entradas en `overviewKPIendpoints` (`Overview.tsx:81-122`): `pocket_saving`, `monthly?type=expense`, y 6 × `dashboardMovementTransactions&movement=`.
- 1 × `InvestmentAccBalance.tsx:43-47`.
- 1 × `AccountBalance.tsx:41-50`.

**Total 16. CONFIRMADO.**

| afirmación | código hoy | veredicto | anclaje |
|---|---|---|---|
| "Ola A = 7 sin gate de auth; Ola B = 9 con gate" | el reparto real es **6 / 10**. `InvestmentAccBalance` no tiene gate propio, pero se monta dentro de `Overview`, que hace early-return mientras `isCheckingAuth` | **IMPRECISO** | `Overview.tsx:403-405` vs `InvestmentAccBalance.tsx:43` |
| request 8 duplica exactamente la 5 | `?type=pocket_saving` pedido desde dos componentes | CONFIRMADO | `Overview.tsx:84` vs `OverviewLayout.tsx:102-104` |
| controlador de movimientos 418 líneas, `switch` en `:555-825` | `export` en `:457`, `switch (movement_type_name)` en `:555` | CONFIRMADO | `dashboardController.js:457`, `:555` |
| "sin caché, sin retry, sin invalidación; `useFetch` tiene un efecto en `[url]` (`useFetch.ts:26`)" | el efecto depende de `[url, attempt]` y el hook **sí expone `refetch()`** documentado | **OBSOLETO** | `useFetch.ts:17`, `:41-43`, `:127` |
| seis flags de carga ORed + un séptimo | así es | CONFIRMADO | `OverviewLayout.tsx:219-225`, `Overview.tsx:144` |
| un fallo borra la pantalla | render de un `<div className='error-message'>` y nada más | CONFIRMADO | `Overview.tsx:400` |
| banner de error auto-descartado a 2 s | así es | CONFIRMADO | `OverviewLayout.tsx:178-201` |
| la ruta de detalle está fuera del layout | `overview/accounts/:accountId` declarada junto a `<Layout/>` | CONFIRMADO | `App.tsx:319` |
| — (no dicho) | `React.StrictMode` está activo: en dev cada efecto se invoca dos veces → **32 requests**, no 16 | **falta en el plan** | `main.tsx:10` |

> **Recontado 2026-08-30 — son 13, no 16.** Sitio por sitio, después de
> `b40c4b8`:
>
> - 5 × `useFetch` en `OverviewLayout.tsx:36, 51, 68, 85, 101`. La sexta,
>   `?type=pocket_saving`, fue eliminada.
> - 6 entradas en `overviewKPIendpoints` (`Overview.tsx:76-107`): `monthly?type=expense`
>   (`:79`) y 5 × `dashboardMovementTransactions&movement=` (`:84`, `:89`, `:94`,
>   `:99`, `:104`). La de `pocket_saving` y la de `movement=pocket` fueron
>   eliminadas.
> - 1 × `InvestmentAccBalance.tsx:43-50`.
> - 1 × `AccountBalance.tsx:43-50`.
>
> **Total 13.** Correcciones a las filas de arriba, en orden:
>
> - El reparto por olas pasa de **6 / 10** a **6 / 7**.
> - **La duplicación de `?type=pocket_saving` ya no existe**: las dos copias
>   desaparecieron, no una. La fila "request 8 duplica exactamente la 5" es hoy
>   falsa por ausencia de las dos peticiones.
> - El controlador de movimientos es `dashboardController.js:465-902` y su
>   `switch (movement_type_name)` está en `:560`.
> - La fila marcada OBSOLETO sigue siendo correcta y sus anclajes se mueven: el
>   efecto está en `useFetch.ts:45` y depende de `[url, attempt]` (`:132`, no
>   `:127`); `refetch()` en `:17`, `:41-43` y `:134`.
> - **Cinco** flags de carga ORed (`OverviewLayout.tsx:192-197`) más el séptimo
>   en `Overview.tsx:128`; **cinco** cadenas de error ORed (`:153-158`) con el
>   descarte a 2 s en `:151-183`.
> - Un fallo sigue borrando la pantalla, ahora en `Overview.tsx:353`.
> - La ruta de detalle está en `App.tsx:321-328`.
> - `React.StrictMode` sigue activo en `main.tsx:10`: en dev serían **26**, no 32.

### A.4 Aritmética financiera en el navegador (§2.4)

| afirmación | código hoy | veredicto | anclaje |
|---|---|---|---|
| A. net worth suma cuatro monedas | suma bank+pocket+investment+debtor sin conversión, y formatea con el default | CONFIRMADO | `OverviewLayout.tsx:154-158`; `BigBoxResult.tsx:28` |
| B. guarda `totalIncome`, emite `totalExpense`; `:165` es no-op; `:133` invierte signo | los tres, textuales | CONFIRMADO | `OverviewLayout.tsx:216`, `:165`, `:133` |
| C. promedio mensual calculado end-to-end en cliente | suma en `+=`, cuenta meses únicos, divide | CONFIRMADO | `CalculateMonthlyAverage.ts:56`, `:66-72`, `:82-84` |
| C. "segundo giro de signo, **por una regla distinta**" | `MonthlyAverage.tsx:74` aplica `incomeFactor = -1` — es la **misma** regla (negar income) sobre otra magnitud | **IMPRECISO** | `MonthlyAverage.tsx:74` vs `OverviewLayout.tsx:133` |
| D. el % de P/L nunca puede ser distinto de 0 | el mapper copia 8 campos y omite `account_starting_amount`; `capital` es siempre 0 y gana el `else` | CONFIRMADO | `InvestmentAccBalance.tsx:100`, `:114-117`, mapper `:54-63`, tipo opcional `responseApiTypes.ts:191` |
| D. el mismo valor renderizado dos veces | ambos bloques pasan `account_balance` | CONFIRMADO | `InvestmentAccBalance.tsx:139-143` y `:151-155` |
| E. dos indicadores son `Math.random()` | idénticos | CONFIRMADO | `MonthlyAverage.tsx:107`, `SavingGoals.tsx:80` |
| E. literales `'status prediction'` y `'% status'` | así es | CONFIRMADO | `SavingGoals.tsx:36`, `MonthlyAverage.tsx:81` |
| F. FX en el modal; hero con moneda por defecto; nombre de movimiento desde tabla cliente | los tres | CONFIRMADO | `TransactionDetailModal.tsx:94`, `:48`, `:59-60` |
| G. constante de moneda partida | `constants.ts:54` lee env; `currencyConstants.ts:22` fija `'usd'` | CONFIRMADO | ambos |
| G. "todos los demás componentes de overview importan la de env" | cierto dentro de overview, pero **el modal de cuenta que el plan propone adoptar también importa la hardcodeada** | **INCOMPLETO** | `AccountTransactionDetailModal.tsx:17-20` |
| H. 185 líneas de reshaping, 5 con `Array.from`, la de deuda con `.map()` | así es | CONFIRMADO | `Overview.tsx:186-371`, `:223` |
| I. `SavingGoals` es el modelo | sólo destructura y formatea | CONFIRMADO | `SavingGoals.tsx:26-31` |

Hallazgo adicional no listado: `currencyConstants.ts` duplica `CURRENCY_CYCLE` y
`CURRENCY_OPTIONS` con **orden distinto** al de `constants.ts:30-38`
(`usd,cop,eur…` vs `usd,eur,cop…`). Segundo síntoma del mismo split.

> **Remedido 2026-08-30, fila por fila.**
>
> - **A.** Suma **tres** monedas, no cuatro: banco + inversión + deudor en
>   `OverviewLayout.tsx:134-135`. El término de bolsillo lo quitó `b40c4b8`. El
>   formateo con la moneda por defecto sigue en `BigBoxResult.tsx:28`.
> - **B.** Los tres, textuales, en `OverviewLayout.tsx:189` (guarda
>   `totalIncome`, emite `totalExpense`), `:141` (no-op) y `:116` (giro de signo).
> - **C.** `CalculateMonthlyAverage.ts:56`, `:68-71`, `:82-84`. El segundo giro
>   está en `MonthlyAverage.tsx:101`, y hay un tercero en `:66` sobre el
>   acumulado del año que añadió `4c6299e` — la fila IMPRECISO ("es la misma
>   regla") sigue siendo correcta para los dos.
> - **D.** Ambas filas siguen exactas: `InvestmentAccBalance.tsx:100`, `:114-117`,
>   mapper `:54-63`, `:139-143`, `:151-155`, tipo opcional
>   `responseApiTypes.ts:191`.
> - **E.** **Queda un solo `Math.random()`**, en `MonthlyAverage.tsx:144`. El de
>   `SavingGoals.tsx:80` desapareció con el archivo. El literal `'% status'` está
>   en `MonthlyAverage.tsx:108`; el literal `'status prediction'` ya no existe.
> - **F.** `TransactionDetailModal.tsx:94` y `:59` siguen exactos.
> - **G.** `constants.ts:52` (no `:54`) lee el env; `currencyConstants.ts:22`
>   sigue fijando `'usd'`. La fila INCOMPLETO sigue siendo correcta: el modal de
>   cuenta importa la hardcodeada en `AccountTransactionDetailModal.tsx:17-20`.
> - **H.** **Cinco** bloques, no seis: cuatro con `Array.from`
>   (`Overview.tsx:178`, `:239`, `:271`, `:302`) y el de deuda con `.map()`
>   (`:209`). El rango es `:171-325`.
> - **I. Esta fila perdió su sujeto.** *Lo que afirma:* `SavingGoals.tsx:26-31`
>   sólo destructura y formatea, y es el modelo a seguir. *Lo que dice el
>   código:* `frontend/src/fintrack/pages/overview/components/SavingGoals.tsx` no
>   existe — `b40c4b8` lo borró el 2026-08-30 junto con la petición de metas que
>   lo alimentaba. *Por qué hace falta decidir de nuevo:* el módulo ya no tiene
>   ningún widget que sólo formatee cifras del servidor, así que la evaluación no
>   deja modelo que imitar, y §4 del catálogo de KPI sigue reusando G1-G3 de ese
>   archivo.
> - El hallazgo adicional sigue en pie: `CURRENCY_CYCLE` está en
>   `constants.ts:29` y en `currencyConstants.ts:14`, con orden distinto.

### A.5 Modal duplicado (§2.5) e inversión de dependencia (§2.6)

Toda la tabla comparativa es exacta: 382 líneas + 370 CSS, props idénticas
(`:11-14` vs `:26-29`), moneda propia de la fila (`:126`), fecha construida desde
`_date`+`_time` con la razón documentada (`:52-67`, `:48-51`),
`movement_type_name` del payload (`:166`), y el split declarado en cabecera
(`:6-9`). Seis modales montados a la vez: CONFIRMADO (`ListContent.tsx:39-40`,
`:92-95`, × 6 `LastMovements`). Dependencia invertida: CONFIRMADA
(`ListContent.tsx:18`, `:25`; único consumidor `LastMovements.tsx:4`).

> **Remedido 2026-08-30.** El fondo se sostiene entero; la copia de cuenta fue
> reescrita y ningún anclaje de este párrafo sigue en su sitio. Hoy son **312
> líneas + 372 de CSS**, no 382 + 370: cabecera del split `:1-9`, props `:27-31`,
> moneda propia de la fila `:108`, fecha desde `_date` + `_time` `:126-127` con
> la razón documentada en `:49-52`, `movement_type_name` en `:148`. La copia de
> overview tiene 186 líneas + 404 de CSS.
>
> **Cinco modales montados a la vez, no seis** — con la lista `(pocket)` fuera,
> Overview monta cinco `ListContent` y cinco `aria-modal="true"`
> (`TransactionDetailModal.tsx:108`). La dependencia invertida sigue confirmada
> sin cambios.

### A.6 Superficie de backend (§2.7)

Las cinco filas de la tabla son correctas: `dashboardRoutes.js:21-22`, `:29-32`,
`:35-36`; `dashboardController.js:118-298`;
`dashboardMonthlyTotalAmountByType.js:18-176`; `getAccountController.js:211`;
`transactionRoute.js:12`; `transactionController.js:821`.

| afirmación | código hoy | veredicto | anclaje |
|---|---|---|---|
| `rows[0]` descarta filas multimoneda | las cuatro queries hacen `GROUP BY ct.currency_code` y el controlador toma `rows[0]` | CONFIRMADO | `dashboardController.js:177/193/209/228`, `:248`, `:270` |
| — (no dicho) | **no hay `ORDER BY`**: qué moneda sobrevive es no determinista. Dos recargas pueden mostrar un net worth distinto sin que cambie ningún dato | **falta en el plan, y es peor** | mismas líneas |
| `getTransactionById` devuelve objeto plano sin envelope, errores `{error}` | exacto | CONFIRMADO | `transactionController.js:940-976`, `:922`, `:979` |

> **Remedido 2026-08-30 — el fondo se sostiene, la columna que se lee cambió.**
> Las cinco filas de la tabla de rutas se corrigen a: `dashboardRoutes.js:21-22`,
> `:29-32`, `:35-36`; `dashboardController.js:126-309`;
> `dashboardMonthlyTotalAmountByType.js:61-230`; `accountRoutes.js:77`;
> `transactionRoute.js:12`; `transactionController.js:922`.
>
> El `rows[0]` sigue descartando filas multimoneda, en `:256` y `:278`, sobre
> cuatro `GROUP BY ct.currency_code` en `:185`, `:201`, `:217` y `:236`, y
> **sigue sin `ORDER BY`** — la fila que el evaluador añadió es la que más
> aguanta.
>
> Lo que sí cambió: `dashboardController.js:23` define
> `DERIVED_BALANCE = derivedAccountBalanceSql('ua')` y las cuatro consultas suman
> esa expresión derivada del ledger en vez de la columna almacenada
> `ua.account_balance`. Todo argumento de este documento que se apoye en "el
> dashboard lee `ua.account_balance`" apunta a una columna que este controlador
> ya no toca; lo que el argumento necesita —que el agregado es *a hoy*— sigue
> siendo cierto.
>
> `getTransactionById` sigue devolviendo un objeto plano, ahora en
> `:1047-1085`, con errores `{ error }` en `:930`, `:1029` y `:1086`.

### A.7 Lo que ya existe y debe reusarse (§2.8)

| afirmación | código hoy | veredicto | anclaje |
|---|---|---|---|
| precedente de payload por lote | `POST /budget/accounts/status` sirve tres niveles de UI de una request | CONFIRMADO | `budgetController.js:69` → `budgetCalculationService.js:425-433` |
| capa KPI de tres niveles | `core/` (6 archivos puros), `db/` (2 repos), `services/` (2) | CONFIRMADO | `services/budget_services/` |
| conversión FX con `{amount, rate, source, fetchedAt}` | firma exacta | CONFIRMADO | `currencyAmountConversion.js:30` |
| catálogo de monedas, `getCurrencyCodeSync:78` | exacto | CONFIRMADO | `loadCurrencyCatalog.js:78` |
| `money.js` `toAmount:129`, `toRate:141` | exactos | CONFIRMADO | `budget_services/core/money.js` |
| invalidate-on-write | `invalidate()` y su cableado | CONFIRMADO | `useBudgetStatusStore.ts:128`, `:148-150`; `transactionEvents.ts:23-38` |
| "calculadora de 14 líneas en `utils/…/calculateBudgetMetrics.js`, usada en `getAccountController.js:41` y `:180`" | el archivo suelto tiene **cero importadores** (ni siquiera exporta). La copia viva está **definida** en `getAccountController.js:41` y **llamada** en `:178` y `:741`; ambas ya llevan banner `DEPRECATED` | **IMPRECISO** | grep repo-wide |
| R73 en `remarks/budget-module.md` | la ruta real es `plan-docs/remarks/budget-module.md`; el contenido es correcto **y peor**: nombra `dashboardController.js:187` como copia viva **dentro del endpoint que Overview consume** | **IMPRECISO (ruta) / CONFIRMADO (fondo)** | `plan-docs/remarks/budget-module.md:25-42` |
| §4 hereda de `FINTRACK_OVERVIEW_CLAUDE_CODE_SPEC.md`; §8 cita `spec.md:11` y `:29` | el spec superseded ya no existe en `plan-docs/`; **`spec.md` en la raíz sí existe y las dos citas son exactas** | OBSOLETO (el primero) / CONFIRMADO (el segundo) | `spec.md:11`, `spec.md:29` |
| `USE_NEW_BUDGET_SYSTEM` como flag existente | **no aparece en ningún archivo de `backend/src` ni `frontend/src`** — sólo en documentación | **OBSOLETO** | grep repo-wide |

**Recuento A: 31 CONFIRMADO · 6 IMPRECISO · 3 OBSOLETO.**

> **Remedido 2026-08-30, §A.7 fila por fila.**
>
> - El precedente de payload por lote sigue exacto: `budgetController.js:69` →
>   `budgetCalculationService.js:425-433`.
> - La conversión FX **ya no está en `:30`**: `currencyAmountConversion` se
>   declara en `currencyAmountConversion.js:73`, toma un cuarto parámetro
>   `asOfDate = null` (`:77`) y devuelve **cinco** campos, no cuatro —
>   `{ amount, rate, source, fetchedAt, effectiveDate }` (`:209-217`). La línea 30
>   es hoy el import de `resolveHistoricalRate`.
> - `getCurrencyCodeSync` sigue en `loadCurrencyCatalog.js:78`; `toAmount:129` y
>   `toRate:141` siguen exactos.
> - `invalidate()` sigue en `useBudgetStatusStore.ts:128`, pero su cableado a las
>   escrituras está en `:149` y `:157`, no en `:148-150`. El archivo vive en
>   `frontend/src/fintrack/stores/`, no en `store/`.
> - La fila IMPRECISO del calculador de 14 líneas se confirma y se reancla: el
>   archivo suelto sigue sin importadores, la copia viva se **define** en
>   `getAccountController.js:56` bajo el banner `DEPRECATED` de `:41`, y se
>   **llama** en `:217` y `:846`, no en `:178` y `:741`.
> - La fila de R73 se confirma y su anclaje interno se mueve: la copia dentro del
>   endpoint que Overview consume ya no está en `dashboardController.js:187` sino
>   en `:195` (`category_budget`) y `:210` (`pocket_saving`) — dos expresiones
>   `total_remaining`, no una.
> - `spec.md:11` y `:29` siguen exactas en la raíz del repo.
> - **`USE_NEW_BUDGET_SYSTEM` sigue sin aparecer** en ningún archivo de
>   `backend/src` ni `frontend/src`. La fila OBSOLETO sigue siendo correcta.

---

## B. Arquitectura objetivo (§3) y reglas guardián (§4)

| regla | por qué es correcta / dónde falla | riesgo si se relaja | costo de cumplirla |
|---|---|---|---|
| **§4.1 cálculo autoritativo en servidor** | Correcta y bien evidenciada. **Falla en el criterio, no en la regla**: §7.6 exige que un grep de operadores aritméticos bajo `pages/overview/` no devuelva nada. Eso es inaplicable e incorrecto — el ancho de una barra de progreso o el escalado de un eje son aritmética de presentación legítima. Y **omite el signo**: la convención de signo es semántica financiera y hoy vive en el cliente dos veces (`OverviewLayout.tsx:133`, `MonthlyAverage.tsx:74`); si el contrato no la fija, se reproduce | la cifra de una pantalla deja de reconciliar con la de otra | bajo; la capa ya existe en `budget_services` |
| **§4.2 un KPI, una fórmula** | La más importante y la mejor sustentada (R73). **Incompleta y en colisión interna**: gobierna el código nuevo y calla sobre las **cuatro copias vivas** (`dashboardController.js:187`, `getAccountController.js:178` y `:741`, `getAccountDataById.js:59`). §10 saca la reescritura de alcance ⇒ `overview_services` sería la **quinta** lectura. La regla queda violada por el refactor que la declara | net worth y remaining divergen entre pantallas en la misma sesión — ya ocurre | medio: exige decidir si Overview **deja de consumir** el endpoint divergente |
| **§4.3 FX antes de agregar, sólo servidor** | Los siete puntos son correctos; el 7 (null explícito) es lo que hace honesto al tablero. **Tres huecos**: (a) no dice **qué tasa** — un stock se convierte a la tasa de hoy, un flujo a la de cada fila (`transactions.exchange_rate` ya se almacena) o a una de cierre; mezclarlas en silencio es exactamente el error que la regla previene; (b) `currencyAmountConversion` es async y depende de proveedores externos (`fxProviders/`) — meterlo en la ruta crítica de la única request de §4.4 pone un HTTP externo en el camino del dashboard; (c) no define caché ni comportamiento con proveedor caído | se re-crea el problema una capa más abajo, ahora con latencia | alto: es el trabajo real de la fase 3 |
| **§4.4 un read model, no un agregador** | Intención correcta; **absolutismo equivocado**. §7.1 (una request) y §7.13 (un fallo no borra la pantalla) sólo coexisten si el payload es **degradable por sección** — `null` + `meta.notices` por bloque dentro de un 200. Eso debe estar en el contrato de fase 2, no descubrirse en fase 4. Además "recent activity ≤5" tiene una vida de caché distinta (se invalida en cada escritura) a net worth; empaquetarlas obliga a refrescar todo | una sola request es también un solo modo de fallo | medio |

**Sobre §3.** El árbol Overview → Domain → Transaction es el patrón correcto
(divulgación progresiva). Dos objeciones de dominio, en §C.

---

## C. Lo que el plan NO cubre

**Stock vs flujo.** No lo distingue. El hero de §3 pone *net worth* (stock),
*cash position* (stock) y *net monthly flow* (flujo) en una misma fila sin marca.
Hoy es peor: `BigBoxResult.tsx:26-29` renderiza "net worth / income / expenses"
con formato idéntico y **sin ninguna etiqueta de periodo**. Y el backend **sí
devuelve** el rango (`dashboardMonthlyTotalAmountByType.js:141-144` emite
`dateRange.start/end`) — el frontend lo descarta. §5 exige
`periodStart`/`periodEnd` en las tarjetas de dominio pero el hero de §3 no tiene
periodo. Recomendación: el stock se rotula "as of ⟨instante⟩", el flujo
"⟨inicio⟩–⟨fin⟩", y es obligatorio en el catálogo.

**Línea base de comparación.** §5 dice "un delta donde tenga sentido" — demasiado
blando. Una cifra financiera sin base no significa nada, y los dos
`Math.random()` y los literales `'% status'` / `'status prediction'` son
justamente marcadores de posición de una base que nunca se diseñó. Si no se
define, la fase 4 hereda el hueco y aparece un tercer placeholder. Recomendación:
base obligatoria por métrica (periodo anterior / mismo periodo del año anterior /
promedio móvil) o se elimina el indicador.

**Denominador del promedio mensual — defecto de KPI no detectado.**
`CalculateMonthlyAverage.ts:66-72` cuenta **meses con actividad** y `:82-84`
divide por eso, sobre un periodo que es 1-ene → 31-dic del año en curso
(`dashboardMonthlyTotalAmountByType.js:43-46`). Una categoría con una sola
transacción en marzo tiene "promedio mensual" = su total de marzo. Mover la
fórmula al servidor sin decidir el denominador sólo reubica el error. El vehículo
ya existe: los campos "time basis" y "aggregation rule" del catálogo (§5).

> **Reanclado 2026-08-30, sin cambio de fondo:** el conteo de meses con actividad
> está en `CalculateMonthlyAverage.ts:68-71` y la división en `:82-84`; la
> ventana fija 1-ene → 31-dic está en `dashboardMonthlyTotalAmountByType.js:102-105`.

**Inversiones — qué muestra hoy `InvestmentAccBalance.tsx`.** Nombre y tipo de
cuenta, "Capital Invested: ⟨account_balance⟩" y "Factual Balance:
⟨account_balance⟩" (**el mismo número dos veces**, `:139-143` y `:151-155`), y
"% Profit 0" con el cuadro permanentemente verde (`:100`, `:114-117`, `:164`). Es
decir: **la tarjeta no comunica hoy ninguna información de inversión**. Ni cost
basis, ni market value, ni ganancia.

- *Cost basis vs market value*: el campo existe en el tipo
  (`account_starting_amount`, `responseApiTypes.ts:191`) y el mapper lo tira
  (`:54-63`); habría que verificar en fase 2 si `getAllAccountsByType` siquiera lo
  devuelve.
- *Realizada vs no realizada*: el esquema tiene `movement_type` 9 = `pnl`
  (`constants.ts:78`) y Overview ya pide `&movement=pnl` — es decir, la ganancia
  **realizada** existe como transacciones, mientras la no realizada sería market
  value − cost basis. El plan §6 dice sólo "el % de P/L se mueve al servidor", lo
  que embarcaría **un número que confunde las dos**.
- *TWR vs MWR*: no aplica hoy porque no hay serie de valuaciones ni flujos
  fechados por posición. Pero `(balance − capital)/capital` es un retorno
  money-weighted mal formado y es **incorrecto en cuanto hay un aporte a mitad de
  periodo**, cosa que el movimiento `investment` permite. Recomendación en D9.
- *Multi-moneda en una posición*: hoy se formatea con la moneda de la cuenta
  (`:140`, `:152`) pero el % se calcula sobre magnitudes que nunca se
  convirtieron.

**Multi-moneda — qué hace Overview hoy.** Peor de lo que dice §2.4A. Los cuatro
`total_balance` que `OverviewLayout.tsx:154-158` suma vienen cada uno de `rows[0]`
de un `GROUP BY currency_code` **sin `ORDER BY`**. O sea: no es que mezcle
monedas, es que **reporta el subtotal de una moneda arbitraria como si fuera el
total**, y luego lo etiqueta con el default (`BigBoxResult.tsx:28`). La cifra no
es el total ni está en la moneda que dice, y **puede cambiar entre recargas sin
que cambie un dato** — la misma clase de defecto que los `Math.random()` de
§2.4E. El plan enuncia las dos mitades por separado y nunca dice en voz alta que
la composición hace del net worth mostrado una cifra indefendible.

**Estados de carga.** La regla de tres estados no está implementada en ninguna
parte del módulo:

| componente | loading | error | empty |
|---|---|---|---|
| `AccountBalance.tsx` | dos ramas contradictorias, la segunda inalcanzable (`:79-85`, `:87-93`), con hex inline | `return null` (`:95`) — el error se ve como nada | indistinguible del error |
| `InvestmentAccBalance.tsx` | `return null` (`:78`) | `return null` (`:78`) | `return null` (`:78`) — los tres colapsados en uno |
| `Overview.tsx` | spinner absoluto sobre la lista (`:410-422`) | string crudo y pantalla en blanco (`:400`) | no existe |
| `LastMovements.tsx` | — | — | **fabrica una fila con `record: 0`** (`:28-41`), que es exactamente el "una cifra ausente se pinta como `0`" que la regla prohíbe, presentado como dato |

Ese último no aparece en el plan y es una violación de regla a la vista. Y sí:
**un fallo parcial hoy borra toda la pantalla** (`Overview.tsx:400`). Bajo el
objetivo de una sola request, el fallo parcial tiene que representarse **dentro**
del payload.

> **Remedido 2026-08-30.** La tabla de estados de carga sigue describiendo el
> código, con dos anclajes movidos: el spinner absoluto de `Overview.tsx` está en
> `:363-375` y su string crudo con pantalla en blanco en `:353`. Lo demás es
> textual: `AccountBalance.tsx:79-85` y `:87-93` siguen siendo dos ramas
> contradictorias con la segunda inalcanzable, `:95` sigue devolviendo `null`;
> `InvestmentAccBalance.tsx:78` sigue colapsando los tres estados en un
> `return null`; y `LastMovements.tsx:28-41` sigue fabricando una fila con
> `record: 0` (`:31`) — la violación de regla más directa de la sección.
>
> **La fila de inversión de §C sigue exacta:** la tarjeta sigue imprimiendo
> `account_balance` dos veces bajo dos rótulos distintos (`:139-143`, `:151-155`)
> y `% Profit 0` con el cuadro permanentemente verde (`:100`, `:114-117`, `:164`).
>
> **El anclaje del rango de fechas del backend se mueve:**
> `dashboardMonthlyTotalAmountByType.js` emite `dateRange.start/end` en
> `:192-194` (era `:141-144`) y su ventana fija de año calendario está en
> `:102-105` (era `:43-46`). El defecto es el mismo.
>
> Y el fallo parcial sigue borrando la pantalla, ahora en `Overview.tsx:353`.

**Accesibilidad y responsive.** El plan no mide una línea de CSS, pero §7.17-18
lo exige como criterio. Estado real:

| archivo | `@media` | `:focus-visible` | hex fijos | tokens indefinidos |
|---|---|---|---|---|
| `overview-styles.css` (304 ln) | **0** | **0** (tampoco `:hover`) | 5 (`:34`, `:193`, `:250`, `:269`, `:295`) | `--crems` (`:275`), `--cremse` (`:276`) — typos de `--creme`, ambos indefinidos |
| `transactionDetailModal.css` (404 ln) | 3, en `min-width:600px` (`:293`), `max-height:643px` (`:383`), `max-height:770px` (`:395`) | **0** | 20 | — |

Ninguno de esos breakpoints está en la escalera obligatoria (480/768/1024 ·
735/568). El módulo no tiene escalera móvil en absoluto. Hay además estilos inline
con px/hex en `Overview.tsx:413-417`, `OverviewLayout.tsx:238`,
`InvestmentAccBalance.tsx:163`, `SavingGoals.tsx:97-102`, `AccountBalance.tsx:81`
/`:89`, `ListContent.tsx:57`/`:98`. Y todo el módulo escribe el vocabulario
**legado** (`--creme`, `--dark`, `--light`) mientras existe un sistema moderno de
234 tokens en `frontend/src/styles/tokens.css` (`--color-*`, `--font-*`) —
decisión abierta en D10. Sobre a11y: `TransactionDetailModal.tsx:25` enfoca el
contenedor y `:20-22` cierra con Escape, pero **no hay focus trap ni restauración
de foco**, y con seis instancias montadas hay **seis `aria-modal="true"`
simultáneos en el DOM**; el "colapsar a uno" de §6 lo arregla de rebote sin
nombrarlo.

> **Remedido 2026-08-30 — el CSS se movió, el diagnóstico no.**
>
> | archivo | `@media` | `:focus-visible` | hex fijos | tokens indefinidos |
> |---|---|---|---|---|
> | `overview-styles.css` (**339** ln, era 304) | **0** | **0** (tampoco `:hover`) | 5, ahora en `:43`, `:202`, `:259`, `:278`, `:304` | `--crems` (`:284`), `--cremse` (`:285`) |
> | `transactionDetailModal.css` (404 ln) | 3, sin cambios (`:293`, `:383`, `:395`) | **0** | 20 | — |
>
> Ninguno de esos breakpoints entró en la escalera obligatoria; el módulo sigue
> sin escalera móvil. Los estilos inline se reanclan a `Overview.tsx:364-371`,
> `OverviewLayout.tsx:210`, `InvestmentAccBalance.tsx:163`,
> `AccountBalance.tsx:81` y `:89`, `ListContent.tsx:57` y `:98` — el de
> `SavingGoals.tsx:97-102` desapareció con el archivo.
>
> **`tokens.css` tiene 130 propiedades personalizadas, no 234** (272 líneas, y el
> archivo está modificado sin commitear hoy), y sigue cargándose primero en
> `main.tsx:6`. El argumento de D10 no cambia; la cifra sí.
>
> Sobre a11y: `TransactionDetailModal.tsx:19-25` sigue enfocando el contenedor y
> cerrando con Escape (`:21`) sin focus trap ni restauración, y con **cinco**
> instancias montadas hay **cinco** `aria-modal="true"` simultáneos (`:108`), no
> seis.

---

## D. Decisiones abiertas

Las cinco de §8 primero. El evaluador coincide con las cinco recomendaciones del
plan.

| # | pregunta | opciones | recomendación y razón | ¿bloquea fase 1? |
|---|---|---|---|---|
| D1 | ¿`Transfer` tiene tarjeta propia? | tarjeta / sub-métrica de ALL | **sub-métrica**. De acuerdo: no mueve net worth, y darle el mismo peso visual que a un dominio miente sobre su importancia | no |
| D2 | ¿Dónde vive el catálogo de KPI? | extender `budget_services` / nuevo `overview_services` | **`overview_services` nuevo**, importando de budget. De acuerdo: extender acopla dos dominios con ciclos de vida distintos | no (ya resuelta) |
| D3 | ¿Quién es dueño de `USE_NEW_BUDGET_SYSTEM`? | `feat/budget` / `feat/overview` | **`feat/overview`**. Las dos citas del plan son verificables (`spec.md:11`, `spec.md:29`). **Matiz**: el flag **no existe en el código**, así que la decisión no es "propiedad" sino "creación" | no |
| D4 | ¿`ListContent` se mueve o se generaliza? | mover / generalizar | **mover**. De acuerdo: un consumidor y dependencia invertida; generalizar es trabajo sin segundo llamador | no |
| D5 | ¿Se arregla el envelope de `getTransactionById`? | aquí / registrar y diferir | **registrar y diferir**. De acuerdo: es defecto del módulo de transacciones y son dos cambios lógicos | no |

Y las encontradas por la evaluación:

| # | pregunta | opciones | recomendación y razón | ¿bloquea fase 1? |
|---|---|---|---|---|
| **D6** | ¿Qué hace este refactor con las cuatro copias vivas de la fórmula de *remaining*? | (a) `overview_services` calcula lo suyo y los endpoints legacy siguen igual · (b) reescribir `dashboardTotalBalanceAccountByType` para que delegue en `budgetCalculationService` · (c) Overview **deja de consumir** ese endpoint por completo | **(c)**. §10 saca la reescritura del alcance, y (a) crea la quinta implementación que §4.2 prohíbe. La única salida que honra ambas cosas es que Overview no lea de la fuente divergente. (b) queda registrado como plan aparte | **SÍ** |
| **D7** | ¿Qué tasa de cambio aplica a un flujo, frente a un stock? | (a) tasa de cada transacción (ya almacenada por fila) para flujos, tasa de hoy para stocks · (b) tasa de cierre de periodo para todo · (c) tasa de hoy para todo | **(a)**, declarado explícitamente en el campo "currency behaviour" de cada entrada del catálogo. Es lo único que hace que "gasto de marzo" siga significando lo mismo dentro de un año. (c) reescribe el pasado en cada recarga | **SÍ** (es un campo del catálogo) |
| **D8** | ¿Qué devuelve `GET /overview` si el proveedor FX no responde? | (a) 200 con secciones convertibles y `null`+notice en el resto · (b) 503 · (c) última tasa conocida marcada como stale | **(c) con caída a (a)**: usar la última tasa conocida marcándola `stale` en `meta.notices`, y sólo `null` si no hay ninguna. §7.13 y §4.4 sólo coexisten si el payload es degradable por sección; (b) contradice §7.13 directamente | **SÍ** (define el contrato de fase 2) |
| **D9** | ¿La tarjeta de inversión publica un porcentaje de retorno en v1? | (a) no: sólo cost basis, market value y ganancia **no realizada absoluta** · (b) sí, `(balance−capital)/capital` servido por el backend · (c) sí, MWR con flujos fechados | **(a)**. (b) es la misma fórmula que hoy está muerta y es incorrecta en cuanto hay un aporte a mitad de periodo — servirla desde el backend la vuelve *creíble* sin volverla correcta, que es peor que el cero actual. (c) es un plan aparte con requisitos de datos que no existen | **SÍ** |
| **D10** | ¿Qué vocabulario de tokens usa el CSS nuevo? | (a) `--color-*` de `tokens.css` · (b) el legado `--creme/--dark/--light` · (c) capa de alias | **(a)**, sin tocar el CSS vecino. `tokens.css` ya se carga primero (`main.tsx:6`) y su comentario dice que nadie lo consume aún: Overview es el primer consumidor natural | no (bloquea fase 4) |
| **D11** | ¿Se corrigen `--crems`/`--cremse` en este refactor? | (a) en el bloque de limpieza de fase 6 · (b) commit aparte ahora · (c) mueren con el archivo | **(c)** si `overview-styles.css` se reemplaza en fase 4; **(b)** si sobrevive. Decidirlo en fase 4, no antes | no |
| **D12** | ¿El criterio "1 request" se mide en dev o en producción? | (a) dev · (b) `vite build` + `vite preview` | **(b)**, y redactar §7.1 como "**1 URL distinta**; 2 invocaciones son tolerables en dev". Con `StrictMode` (`main.tsx:10`) el criterio literal es infalsificable | no (bloquea la aceptación de fase 4) |
| **D13** | ¿En qué rama se ejecuta? | (a) rama `feat/overview` nueva tras el merge de budget · (b) aquí, en `feat/budget` | **(a)**, y no arrancar hasta que dispare el trigger de la cabecera del plan. Ver §F | **SÍ** (es el bloqueo de nivel superior) |

---

## E. Secuencia de ejecución

La secuencia 0→6 de §6 es correcta en su columna de dependencias. Tres cambios:

1. **Bajar el nombramiento del flag de la fase 2 a la fase 0.** No cuesta nada y
   la fase 0 ya toca la propiedad del flag. Además el flag no existe: la fase 0 lo
   *crea*, no lo *hereda*.
2. **Insertar una fase 2b: sonda de viabilidad de datos.** §10 dice que si el
   esquema no puede servir el contrato eso es "otro gate". Ese descubrimiento
   tiene que ocurrir **antes** de que la fase 3 escriba servicios, no durante. La
   sonda es de sólo lectura: ¿devuelve `getAllAccountsByType` el
   `account_starting_amount`? ¿hay `exchange_rate` por fila en todas las
   transacciones históricas? ¿existe una valuación de posición distinta del
   `account_balance`?
3. **D6, D7, D8 y D9 se resuelven dentro de la fase 1**, no en la 2: los cuatro
   son campos del catálogo, no del contrato.

| fase | alcance | archivos | flag | "hecho" (§7) | rollback |
|---|---|---|---|---|---|
| **0** | propiedad y **creación** del flag; confirmar que el trigger disparó; crear rama | `plan-docs/` solamente | n/a | D3 y D13 cerradas por escrito | borrar el documento |
| **1** ← 0 | catálogo de KPI con los once campos por métrica; aprobar lista de campos de tarjeta; **cerrar D6, D7, D8, D9** | `plan-docs/` | n/a | toda métrica de §3 tiene entrada; ninguna entrada sin consumidor (§7.9, §7.11) | documento |
| **2** ← 1 | contrato `GET /overview` y `/overview/:domain` como tipos reales: params, forma, nulabilidad, envelope de error, **degradación por sección** | `plan-docs/` + tipos propuestos | nombre y default del flag fijados | cada campo del catálogo mapea a un campo del contrato; todo agregado no representable tiene su `null` + notice (§7.8) | documento |
| **2b** ← 2 | sonda de viabilidad (sólo lectura) sobre esquema y payloads existentes | ninguno | n/a | o el contrato es servible, o se abre un gate de migración (`018`) | n/a |
| **3** ← 2b | `overview_services/{core,db,services}`, controlador, ruta. FX **antes** de agregar | `services/overview_services/**` (nuevo), `routes/` (una línea) | ruta nueva, no sustituye nada | `node src/index.js` levanta; la ruta responde el contrato; sin consulta por dominio dentro del controlador (§7.5, §4.4) | quitar el `router.use`; nada preexistente se tocó |
| **4** ← 3 | Nivel 1: hero, tarjetas de dominio, snapshot, metas, actividad reciente, **junto** a la pantalla actual | componentes nuevos bajo `pages/overview/`; `Overview.tsx` sólo bifurca por flag | **sí** | flag off = pantalla actual intacta; flag on = §7.1, §7.2, §7.3, §7.7, §7.12, §7.13, §7.17, §7.18; `tsc -p tsconfig.app.json --noEmit` = 0; `vite build` = 0 | flag a `false` |
| **5** ← 4 | Nivel 2: una página por dominio + ALL; transacciones paginadas en navegación | rutas nuevas en `App.tsx`; páginas nuevas | **sí** (el mismo) | §7.4; ida y vuelta Nivel 1 → dominio → detalle sin refetch en frío | flag a `false` |
| **6** ← 5 | limpieza en **un** commit: quitar flag y widgets superseded, según la tabla de §6 | `CalculateMonthlyAverage.ts`, `overviewFetchAll.ts`, modal de overview, `ListContent.tsx` (mover) | se elimina | §7.6 con el criterio corregido de D12/§B | revertir el commit único |

Verificación por fase, tal cual §9: `tsc -p tsconfig.app.json --noEmit` exit 0,
`vite build` exit 0 (ojo: el script `build` es `vite build` a secas, **no**
encadena `tsc`, así que el type-check es un paso separado obligatorio), arranque
del backend, y la lista de conducción manual. No hay runner de tests (`backend`
tiene `"test": "exit 1"`, `frontend` no tiene script de test).

> **Remedido 2026-08-30, dos precisiones.**
>
> - La verificación sigue siendo válida entera: `build` es `vite build` a secas,
>   el backend termina en `exit 1` en su script `test`, y el frontend no tiene
>   script de test. Lo que sí tiene es un script `typecheck`
>   (`tsc --noEmit -p tsconfig.app.json`), así que el paso separado ya está
>   escrito y no hay que invocarlo a mano.
> - **El número de migración libre ya no es `018`.** La fase 2b dice que si el
>   esquema no sirve el contrato se abre un gate de migración `018`; esa y las
>   tres siguientes ya existen y están corridas
>   (`018_alter_transactions_account_fks_to_restrict.sql` hasta
>   `021_create_daily_exchange_rates.sql`). El siguiente número libre es `022`.

---

## F. Riesgos

| riesgo | probabilidad | impacto | mitigación |
|---|---|---|---|
| **Tocar Overview con el módulo budget abierto en la misma rama** — `feat/budget` tiene el working tree limpio pero doce commits recientes de budget, y la tarjeta de Expense consume lo que devuelva `budget_services` | alta si se ignora el trigger | alto: contrato en vuelo ⇒ segunda reescritura, y un `git bisect` que no puede separar los dos módulos | **no arrancar hasta que budget haga merge a producción** (D13); rama propia `feat/overview`; el plan ya lo dice en su cabecera y hay que respetarlo |
| El proveedor FX en la ruta crítica de la única request | media | alto: el dashboard hereda la disponibilidad de un tercero | D8: última tasa conocida marcada `stale`, caché con TTL, y `null`+notice sólo como último recurso |
| `overview_services` se convierte en la quinta implementación de *remaining* | **alta si D6 no se cierra** | alto: reproduce R73 con más código | D6 opción (c): Overview deja de consumir el endpoint divergente |
| §7.1 y §7.13 en conflicto, se descubre en fase 4 | media | medio: rediseño del contrato con backend ya escrito | resolver en fase 2 con degradación por sección |
| El % de retorno de inversión se sirve desde el backend y por eso se cree | media | alto: una cifra incorrecta y *creíble* es peor que el cero actual | D9 opción (a) |
| Las reglas de CSS (§7.17-18) se aplican sin línea base medida | alta | medio: la fase 4 arrastra la deuda del vecino, que CLAUDE.md prohíbe imitar | inventariar el CSS en fase 1 (los números están en §C) y cerrar D10 antes de escribir la primera regla |
| El criterio "1 request" se mide en dev con StrictMode y se declara fallido | media | bajo, pero atasca un gate | D12 |
| Borrar `overview-styles.css` rompe algo fuera del módulo | baja | medio | el radio de impacto son 4 sitios de import (`App.tsx:42/45`, `ListContent.tsx:18/25`); comprobado con grep repo-wide |

---

## Archivos críticos para la implementación

- `frontend/src/fintrack/pages/overview/OverviewLayout.tsx`
- `frontend/src/fintrack/pages/overview/Overview.tsx`
- `backend/src/fintrack_api/controllers/dashboardController.js`
- `backend/src/fintrack_api/services/budget_services/services/budgetCalculationService.js`
- `backend/src/fintrack_api/services/fx_services/conversion/currencyAmountConversion.js`

Las cinco rutas siguen existiendo, verificado 2026-08-30.

---

## Registro de correcciones — 2026-08-30

Sólo mediciones. No se cerró, borró ni reescribió ninguna decisión, y no se
reordenó ninguna unidad de trabajo. Medido en `fix/auth-screen`, `e919a89`,
árbol de trabajo incluido.

| § | qué se corrigió |
|---|---|
| A.1 | 13 archivos → 12; `SavingGoals.tsx` borrado; cuatro conteos de línea; anclajes de tipos inline |
| A.3 | 16 peticiones → 13, sitio por sitio; el duplicado de `?type=pocket_saving` ya no existe porque **las dos** copias desaparecieron; anclajes de `useFetch` (`:127` → `:132`); seis flags de carga → cinco; seis errores ORed → cinco; ruta de detalle `App.tsx:319` → `:321-328`; 32 peticiones en dev → 26 |
| A.4 | A tres monedas; B, C, E, G y H reanclados; E un solo `Math.random()`; H seis bloques → cinco; **I marcada** — el widget modelo ya no existe |
| A.5 | modal de cuenta 382 (+370) → 312 (+372) líneas, todos sus anclajes; seis modales montados → cinco |
| A.6 | las cinco filas de rutas y controladores; `rows[0]` `:248`/`:270` → `:256`/`:278`; las consultas suman `derivedAccountBalanceSql`, no `ua.account_balance`; `getTransactionById` reanclado |
| A.7 | `currencyAmountConversion` `:30` → `:73`, cuatro campos de retorno → cinco, más el parámetro `asOfDate`; ruta y llamadas del calculador de 14 líneas; anclaje de R73 `:187` → `:195`/`:210`; cableado de `invalidate()` `:148-150` → `:149`/`:157` |
| C | anclajes de estados de carga; `dateRange` `:141-144` → `:192-194` y ventana de año `:43-46` → `:102-105`; denominador del promedio `:66-72` → `:68-71`; inventario de CSS (339 líneas, cinco hex y los dos tokens tipo reanclados); `tokens.css` 234 tokens → 130; seis `aria-modal` → cinco |
| E | el frontend sí tiene script `typecheck`; el gate de migración `018` está ocupado, el siguiente libre es `022` |

**Verificado y dejado como estaba:** las cuatro filas de A.1 sobre sitios de
import, A.4 D y F, todo A.5 sobre la dependencia invertida, la fila de A.6 sobre
la ausencia de `ORDER BY`, la fila de A.7 sobre `spec.md:11`/`:29` y la de
`USE_NEW_BUDGET_SYSTEM`, y las tablas de riesgo de §F, que no contienen ninguna
medición nueva.

**Sin resolver:** el recuento global de §A ("31 CONFIRMADAS, 6 IMPRECISAS y 3
OBSOLETAS") no se recalculó. Reclasificar cada fila exigiría decidir si un
anclaje desplazado cuenta como impreciso u obsoleto, y esa es una convención del
evaluador, no una medición del código.
