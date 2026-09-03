# INVENTARIO — endpoints e indicadores financieros

**Vive en `plan-docs/ongoing/`, que el `.gitignore` exceptua explicitamente
(`.gitignore:123`): este archivo si se versiona.**

Medido el 2026-09-01 sobre dos árboles:

| árbol | rama | qué se midió |
|---|---|---|
| `pern_fintrack` | `fix/auth-screen` | la app que corre: rutas, controladores, `budget_services`, `pocket_services`, frontend legacy |
| `pern_fintrack_overview` | `feat/overview` | el módulo Overview, sin fundir |

Ningún dato de este archivo se heredó del plan: todo se leyó del código en esta
sesión.

---

## 1. Endpoints — 48 rutas montadas

Una más escrita y desconectada: `POST /api/cronjob/clean-tokens`, cuyo montaje
está comentado en `app.js:150`.

| grupo | montaje | nº |
|---|---|---|
| Públicas de `app.js` | — | 2 |
| Auth | `/api/auth` | 6 |
| Usuario | `/api/user` | 4 |
| Cuentas | `/api/fintrack/account` | 14 |
| Dashboard | `/api/fintrack/dashboard` | 7 |
| Bolsillos | `/api/fintrack/pocket` | 7 |
| Presupuesto | `/api/fintrack/budget` | 4 |
| Transacciones | `/api/fintrack/transaction` | 2 |
| Divisas | `/api/fintrack/currency` | 2 |
| **Total** | | **48** |

Todo `/api/fintrack/*` pasa por `verifyToken` en `app.js:155`. `/api/auth` y
`/api/user` protegen ruta por ruta.

### 1.1 Públicas — `app.js`

| método | ruta |
|---|---|
| GET | `/api/health` |
| GET | `/api/db-test` |

### 1.2 Auth — `auth_api/routes/authRoutes.js`

| método | ruta |
|---|---|
| GET | `/api/auth/ping` |
| POST | `/api/auth/sign-up` |
| POST | `/api/auth/sign-in` |
| POST | `/api/auth/refresh-token` |
| POST | `/api/auth/sign-out` |
| GET | `/api/auth/validate-session` |

### 1.3 Usuario — `auth_api/routes/userRoutes.js`

| método | ruta |
|---|---|
| GET | `/api/user/:userId` |
| GET | `/api/user/profile` |
| PATCH | `/api/user/update-profile` |
| PATCH | `/api/user/change-password` |

### 1.4 Cuentas — `fintrack_api/routes/accountRoutes.js`

| método | ruta |
|---|---|
| POST | `/account/new_account/bank` |
| POST | `/account/new_account/income_source` |
| POST | `/account/new_account/investment` |
| POST | `/account/new_account/debtor` |
| POST | `/account/new_account/category_budget` |
| GET | `/account/allAccounts` |
| GET | `/account/type` |
| GET | `/account/:accountId` |
| GET | `/account/details/:accountId` |
| GET | `/account/transactions/:accountId` |
| GET | `/account/category/:categoryName` |
| PATCH | `/account/edit/:accountId` |
| GET | `/account/delete/report_of_affected_accounts/:targetAccountId` |
| DELETE | `/account/delete/:targetAccountId` |

### 1.5 Dashboard — `fintrack_api/routes/dashboardRoutes.js`

| método | ruta |
|---|---|
| GET | `/dashboard/balance/` |
| GET | `/dashboard/balance/type/` |
| GET | `/dashboard/balance/summary/` |
| GET | `/dashboard/balance/monthly_total_amount_by_type/` |
| GET | `/dashboard/movements/movement/` |
| GET | `/dashboard/movements/account_type/` |
| GET | `/dashboard/movements/search/` |

### 1.6 Bolsillos — `fintrack_api/routes/pocketRoutes.js`

| método | ruta |
|---|---|
| GET | `/pocket/board` |
| GET | `/pocket/:pocketId` |
| POST | `/pocket/` |
| PATCH | `/pocket/:pocketId` |
| POST | `/pocket/:pocketId/allocations` |
| POST | `/pocket/:pocketId/releases` |
| DELETE | `/pocket/:pocketId` |

### 1.7 Presupuesto, transacciones y divisas

| método | ruta | archivo |
|---|---|---|
| POST | `/budget/accounts/status` | `budgetRoutes.js:23` |
| PUT | `/budget/accounts/:accountId/current` | `budgetRoutes.js:27` |
| GET | `/budget/accounts/:accountId/series` | `budgetRoutes.js:31` |
| GET | `/budget/export` | `budgetRoutes.js:36` |
| **cualquiera** | `/transaction/transfer-between-accounts` | `transactionRoute.js:8` |
| GET | `/transaction/:transactionId` | `transactionRoute.js:12` |
| POST | `/currency/convert` | `currencyRoutes.js:13` |
| GET | `/currency/rates` | `currencyRoutes.js:16` |

### 1.8 Overview — sólo en `feat/overview`

| método | ruta |
|---|---|
| GET | `/api/fintrack/overview/` |
| GET | `/api/fintrack/overview/:domain` |

### 1.9 Dos hallazgos del recorrido

**La transferencia entre cuentas se declara con `router.use`, no con
`router.post`** (`transactionRoute.js:8`). Un `use` no filtra método: un `GET` a
esa ruta entra al mismo controlador que escribe la transferencia.

**El módulo Overview no está en la rama que corre.** No existe
`services/overview_services/` en `fix/auth-screen`. Todo anclaje a
`overview_services/**` describe código de otra rama.

---

## 2. Indicadores que se calculan hoy

### 2.1 Dashboard — `controllers/dashboardController.js`

| indicador | línea | significado |
|---|---|---|
| `total_balance` por tipo | :57 | Suma del saldo derivado del libro mayor por tipo de cuenta, agrupada por moneda |
| `total_balance` + `accounts` de un tipo | :174 | Saldo del tipo pedido y cuántas cuentas lo componen |
| `total_budget`, `total_remaining` | :190-196 | Presupuesto agregado de las categorías y cuánto falta por gastar |
| `total_target`, `total_remaining` | :206-212 | Meta agregada de los bolsillos y cuánto falta |
| `total_debt_balance` | :230 | Posición neta de deuda: positivo le deben, negativo debe |
| `debt_receivable` / `debt_payable` | :230 | Las dos piernas: lo que le deben y lo que debe |
| `debtors`, `lenders`, `debtors_without_debt` | :232-234 | Contrapartes que le deben, a las que debe, y las que quedaron en cero |
| Resumen por categoría | :359 | Saldo y remanente de cada categoría de gasto |
| Resumen por bolsillo | :383 | Saldo, meta, nota y fecha deseada de cada bolsillo |
| Resumen por deudor | :396 | Posición y piernas de cada contraparte |

### 2.2 Movimientos del año — `controllers/dashboardMonthlyTotalAmountByType.js`

| indicador | línea | significado |
|---|---|---|
| `monthlyAmounts` | :185 | Monto por mes, tipo (gasto / ingreso / ahorro), cuenta y moneda |
| `yearlyTotals` | :43 | Total del año por tipo. Devuelve `null` si el tipo mezcla monedas, en vez de sumar mal |

### 2.3 Overview legacy — calculado en el navegador

| indicador | archivo | significado |
|---|---|---|
| `netWorth` | `OverviewLayout.tsx:134` | Banco + inversión + deuda. **No incluye bolsillos** |
| `totalIncome` / `totalExpense` | `:116`, `:118` | Saldo acumulado de las cuentas de ingreso y de gasto |
| `monthlyAverage` | `CalculateMonthlyAverage.ts:83` | Total dividido entre los meses **con movimiento** |
| Year to date | `MonthlyAverage.tsx:136` | Acumulado del año en curso |

`netWorth` es la doble implementación más cara: el patrimonio del legacy y el del
Overview nuevo **no son la misma cifra**, porque uno omite los bolsillos.

### 2.4 Presupuesto — `services/budget_services/`

| indicador | archivo | significado |
|---|---|---|
| `budgetAmount` | `makeBudgetAccountStatus.js:69` | Lo asignado a esa cuenta para el mes |
| `nextMonthBudget` | `:73` | Lo ya fijado para el mes siguiente |
| `actualSpent` | `:74` | Acumulado del mes con su signo; un reverso viene descontado dentro |
| `remainingBudget` | `:77` | Asignado menos gastado. Negativo es el monto en rojo |
| `executionPercentage` | `:80` | Porcentaje de ejecución. `null` si el presupuesto es 0 |
| `isOverBudget` | `:81` | Bandera de categoría excedida |
| `accountCount` | `makeBudgetCategoryStatus.js:78` | Cuántas cuentas componen la categoría |
| `monthsOverBudget` | `budgetCalculationService.js:227` | Meses del rango que se pasaron del presupuesto |
| `averageMonthlySpend` | `:231` | Gasto medio entre **todos** los meses del rango, no sólo los activos |

### 2.5 Bolsillos — `services/pocket_services/`

| indicador | archivo | significado |
|---|---|---|
| `target` / `allocated` | `makePocketStatus.js:117` | Meta del bolsillo y cuánto de las cuentas reales está comprometido con ella |
| `remaining` | `:121` | Lo que falta. Negativo = sobrefinanciado |
| `progress` | `:122` | Avance porcentual hacia la meta |
| `daysRemaining` | `:124` | Días de calendario hasta la fecha deseada |
| `requiredMonthly` | `:129` | Cuánto comprometer por mes para llegar a tiempo. `null` si la fecha pasó |
| `funded` / `overdue` | `:130-131` | Meta cubierta / fecha vencida sin cubrir |
| `sourceCount` | `:132` | De cuántas cuentas distintas se nutre el bolsillo |
| `pocketCount`, `fundedCount`, `overdueCount`, `uncoveredCount` | `pocketBoardService.js:99-106` | Conteos del tablero |
| `totalAllocated`, `totalTarget`, `totalRemaining`, `totalExcess` | `:153-156` | Agregados. Faltante y excedente se acumulan por separado, no se cancelan |
| `overallProgress` | `:157` | Avance global, con cada bolsillo recortado al 100 % antes de sumar |
| `accountBalance`, `accountAllocated`, `accountUnassignedCash`, `isOverAllocated` | `makeAccountAllocation.js:49-52` | Por cuenta: saldo, comprometido, libre, y si se comprometió de más |

### 2.6 Overview nuevo — sólo en `feat/overview`

| indicador | significado |
|---|---|
| `netWorth` | Banco + inversión + deuda + bolsillos |
| `cashPosition` | Lo disponible sin vender una posición ni cobrar una deuda |
| `netMonthlyFlow` | Ingreso menos gasto del mes |
| `totalAmount`, `transactionCount`, `delta` | Base de las seis cards |
| `budgetAmount`, `categorizedExpense`, `budgetVariance`, `hasUncategorizedExpense` | Gasto contra presupuesto y bandera de gasto sin categoría |
| `capitalContributed`, `ledgerBalance`, `realizedPnl` | Inversión: capital aportado, saldo en libros, resultado realizado |
| `concentration`, `daysSinceLastContribution` | Peso de la mayor posición y días desde el último aporte |
| `receivable`, `payable`, `settledCount` | Piernas de deuda y contrapartes saldadas |
| `activeMonthAverage3m` / `12m`, `varianceVsAverage` | Promedio reactivo y estable del mes activo, y desviación del mes |
| `rank`, `cumulativeActual`, `cumulativePercentage` | Curva de Pareto del gasto por categoría |
| `goalsTotalBalance`, `goalsTotalTarget`, `goalsTotalRemaining` | Agregados de metas |

---

## 3. Lo que el Overview pide y nadie calcula

Tres orígenes distintos, y la diferencia importa: uno tiene fórmula cerrada en el
catálogo, otro tiene decisión cerrada sin fórmula, y el tercero es un acuerdo
verbal sin entrada de catálogo.

### 3.1 Con fórmula cerrada en el catálogo, sin implementar

| id | indicador | qué contesta | quién debería calcularlo |
|---|---|---|---|
| PA1 | `free_cash` | Cuánto puedo gastar sin romper un compromiso: saldo menos asignado, **recortado por cuenta antes de sumar** | **`pocket_services`**, ya produce la cifra por cuenta en `accountAllocationService.js:62-63`. Overview la pliega, no la recalcula |
| PA2 | `over_allocated_account_count` | Cuántas cuentas ya no cubren lo comprometido | **`pocket_services`**, mismas filas que PA1 |
| PA3 | `committed_cash` | Del efectivo que ya se muestra, cuánto está comprometido | **`pocket_services`**, mismas filas. Es línea memo: nunca se suma al patrimonio |
| SV1 | `net_cash_change` | Cuánto se acumuló de verdad en el periodo: posición de efectivo al cierre menos al cierre anterior | **`overview_services`**. Es la aritmética de cierres que D24 ya fijó y que la reconstrucción de saldos del repositorio de balances ya sabe hacer |
| SV2 | `savings_rate` | Qué fracción del ingreso se acumuló. `null` si el ingreso es 0 | **`overview_services`**: cociente de dos cifras que la misma página ya publica |
| SV3 | `trend` de savings | Serie mensual de SV1, seis meses. Un mes sin actividad publica `0` real, no arrastra | **`overview_services`**, mismo repositorio mensual que sirve las otras tres series |
| SV4 | `required_monthly_across_goals` | Suma del ritmo que las metas exigen, para comparar contra SV1 | **`pocket_services`** produce la suma de `requiredMonthly`; Overview sólo hace la comparación. Va al final: necesita una convención de periodo que es del módulo de presupuesto |

**PA1-PA3 y SV1-SV3 son la deuda mayor.** Sustituyen a P1-P4 y a la lectura de
P3, derogadas por D44 cuando el bolsillo dejó de ser una cuenta de custodia.

### 3.2 Con decisión cerrada, sin fórmula ni implementación

| decisión | indicador | qué contesta | quién debería calcularlo |
|---|---|---|---|
| D33 | `charts.expenseYtdDistribution` | Dónde se fue el dinero **en el año**, por categoría: `categoryName`, `actualSpentYtd`, `share`, `rank` | **`overview_services`**, con consulta propia de doce meses. **No** reusa `makeCategoryBreakdown`: el Pareto acumula una suma corrida, esto es participación por fila. El tipo ya está escrito en el contrato §11 (`:432-441`) y el payload no lo publica |
| D40 | YTD en las seis cards | Cuánto llevo acumulado este año — una cuarta naturaleza junto a Posición, Flujo y Tendencia | **`overview_services`**. Nunca el cliente: sumar doce meses en pantalla es el mismo defecto que abrió el módulo. Hay un precedente vivo de ese error en `feat/accountingDashboard` |

### 3.3 Acordados con el desarrollador, sin entrada de catálogo

Están en el traspaso §H.4.3 y **no** en `PLAN_OVERVIEW_KPI_CATALOG.md`. Antes de
implementarlos les falta el paso de catálogo: los once campos que exige
`PLAN_OVERVIEW.md` §5.

| indicador | qué contesta | quién debería calcularlo |
|---|---|---|
| Nº de cuentas por card (income, expense) | Cuántas cuentas componen la cifra de la card | **`overview_services`**. El patrón ya existe: la card de inversión lleva `accountCount` (`overviewInvestmentService.js:58`) |
| Nº de categorías excedidas de presupuesto | Cuántas categorías se pasaron este mes | **`overview_services`, sin consulta nueva**: `budget_services` ya emite `isOverBudget` por categoría y Overview sólo cuenta |
| Nº de categorías en banda 75-100 % | Cuántas están cerca del límite sin haberlo pasado | **`overview_services`, sin consulta nueva**: sale de `executionPercentage`, que `budget_services` ya emite |
| Nº de depósitos y de retiros de resultado | Cuántas veces entró y salió P/L en el periodo | **`overview_services`**: mismo filtro que ya usa el total de resultado, partido por pata |
| Balance acumulado histórico de resultado | Cuánto P/L se ha registrado desde el principio | **`overview_services`**: mismo filtro sin cota de periodo |

### 3.4 Abiertos, sin decisión

| pendiente | qué falta |
|---|---|
| `income_by_source` (D17) | Desagregar el ingreso por fuente. Añade una cuarta fila a la card; se decide con la lista de campos definitiva |
| ~~Cuentas `cash` (`account_type_id = 7`)~~ | **Cerrado 2026-09-01 por D45:** una cuenta de efectivo es una cuenta bancaria y se lee como tal en toda fórmula que nombre `bank`. Deja de ser una pregunta abierta y pasa a ser trabajo de código: el conjunto de cuentas reales de `overviewAccountRepository.js:62` no incluye `cash`, y `dashboardTotalBalanceAccountByType` filtra por nombre exacto de tipo, así que hoy una cuenta de efectivo no entra en la cifra de banco de ninguno de los dos |

---

## 4. Lo que sí se calcula, pero sobre un modelo retirado

No son huecos: son cifras que responden hoy y que responden mal. Cuestan más que
las de §3, porque una cifra ausente se ve y una equivocada no.

| indicador | qué lee | por qué ya no vale | quién lo debería calcular |
|---|---|---|---|
| `pocket.totalAmount` y su `trend` (P1-P4) | Cuentas `account_type_name = 'pocket_saving'` (`overviewAccountRepository.js:201-208`) | La migración `020` dejó ese conjunto en cero. La card publica el saldo de un tipo de cuenta que ya no se crea | **`pocket_services`** vía PA1-PA3 de §3.1. Las cuatro fórmulas quedan derogadas, no migradas |
| `financialGoals` (G1-G3) | `SAVING_GOALS_QUERY` con `JOIN pocket_saving_accounts` (`overviewPageRepository.js:50-58`) | Mismo conjunto vacío. Su mitad de frontend ya fue borrada por `b40c4b8` | **`pocket_services`**, que ya sirve el tablero con `target` y `allocated`. El contrato §13 registra esta deuda desde antes de que se volviera bloqueante |
| `netWorth` del hero | Suma banco e inversión **a hoy** con deuda y bolsillo **al cierre del mes** (`overviewPageService.js:120-127`) | Para cualquier mes pasado la cifra no corresponde a ningún instante | **`overview_services`**: reconstruir banco e inversión al cierre del mes, con la misma técnica de las piernas de deuda |

---

## 5. Resumen de esfuerzo

| bloque | entradas | dónde se escribe |
|---|---|---|
| Bolsillo y ahorro (PA1-PA3, SV1-SV4) | 7 | `pocket_services` produce 4, `overview_services` pliega y calcula 3 |
| Metas repuntadas (G1-G3) | 3 | `pocket_services` |
| YTD (D33, D40) | 2 datasets | `overview_services` |
| KPIs acordados sin catálogo | 5 | `overview_services`, 2 de ellos sin consulta nueva |
| Corrección de base temporal del hero | 1 | `overview_services` |
