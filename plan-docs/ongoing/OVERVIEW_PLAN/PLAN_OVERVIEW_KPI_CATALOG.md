# CATÁLOGO DE KPI — Overview, fase 1

**Lives in `plan-docs/`, which is in `.gitignore`: it produces no commit.**

Depende de D1-D13 cerradas en `OVERVIEW_DECISIONS.md`. Cada entrada declara los
once campos exigidos por `PLAN_OVERVIEW.md` §5: metric id, domain, business
meaning, formula, source facts, currency behaviour, time basis, aggregation
rule, null/zero behaviour, display priority, consumers.

Anclajes verificados por lectura de código en esta sesión, no heredados sin
revisar del plan o de la evaluación. Donde algo sigue sin verificar se marca
explícitamente como pendiente de la sonda de fase 2b — no se rellena con una
suposición (regla del proyecto, `CLAUDE.md`).

---

## 0. Convenciones — glosario verificado

| catálogo | valores reales (id → nombre) |
|---|---|
| `account_types` | 1 bank · 2 investment · 3 debtor · 4 pocket_saving · 5 category_budget · 6 income_source · 7 cash |
| `movement_types` | 1 expense · 2 income · 3 investment (**muerto, R211**) · 4 debt · 5 pocket · 6 transfer · 7 receive · 8 account-opening · 9 pnl |
| `transaction_types` | 1 withdraw · 2 deposit · 3 lend · 4 borrow · 5 account-opening |

**Cuentas que entran en cifras de dinero real:** `bank`, `investment`,
`pocket_saving`, `debtor`. **Cuentas pseudo/de rastreo, nunca sumadas como
dinero:** `category_budget` (presupuesto), `income_source` (contraparte de
ingreso), y la cuenta interna `'slack'` (`account_type_id=1`, nombre literal
`'slack'` — contraparte de `pnl`, `income` y `expense`; se excluye siempre con
`account_name != 'slack'`, igual que ya hace el dashboard hoy).

**D7 (cerrada):** todo monto y balance ya está en moneda contable al momento de
escribirse. Ninguna métrica de este catálogo convierte en lectura. Toda entrada
declara `currency behaviour: stored-in-accounting-currency`. La única conversión
que sobrevive es de presentación, sobre el agregado ya sumado, y sólo el día que
`users.currency_id` ("Preferred Currency") diverja de la moneda contable — hoy
no diverge.

**R211 (nuevo):** `movement_type_id = 3` está muerto. Los aportes/retiros de
inversión se escriben como `movement_type_id = 6` (transfer) sin distinguir —
toda métrica de inversión filtra por `account_type_id = 2` en las dos patas,
nunca por `movement_type_id = 3`.

**R212 (nuevo):** `movement_type_id = 9` (`pnl`) mezcla P/L real con
compensaciones de borrado de cuenta, distinguibles sólo por el prefijo de
descripción `RTA Annulment Target(`. Toda métrica que sume `pnl` excluye ese
prefijo.

**R66 (ya registrado, no nuevo):** `transaction_actual_date` es siempre el
instante de inserción, nunca la fecha que el usuario elige — ningún tracker
envía `transactionActualDate`. Toda métrica con "time basis" de periodo hereda
esta advertencia: agrupa por fecha de entrada, no por fecha editable.

**`cash` (`account_type_id = 7`) se lee como `bank` — D45, cerrada por el
desarrollador el 2026-09-01.** Una cuenta de efectivo es una cuenta bancaria a
todos los efectos de lectura: **toda fórmula de abajo que nombre `bank` incluye
`cash`, y ninguna las distingue.** La distinción se conserva en el esquema, donde
describe de dónde salió el dinero, y desaparece en la lectura, donde no cambia
ninguna respuesta.

*Texto anterior, conservado porque explica qué cambió:* «`cash` no aparece en
ningún flujo de escritura localizado esta sesión. Se excluye de todas las
fórmulas de abajo hasta que la sonda de fase 2b confirme si tiene datos reales o
es un tipo sin usar.» La sonda deja de ser un requisito: preguntaba si el tipo
tenía datos reales, y la respuesta la da el modelo y no el conteo — haya una
cuenta de efectivo o ninguna, se lee como banco.

> **Reverificado 2026-08-30.** Los tres catálogos del glosario siguen exactos,
> fila por fila, contra `005_base_catalogs.sql:36-44`, `:59-69` y `:74-80` —
> incluidos `4 pocket_saving` y `5 pocket`, que siguen en la tabla de catálogo
> aunque ya no se escriban (ver la derogación de P1-P4 en §2). Lo que sí cambió
> desde que se escribió esta sección: **`cash` ya tiene lectores**. Es uno de los
> dos tipos elegibles como origen de una asignación de bolsillo —
> `pocket_services/services/pocketAllocationService.js:45`
> (`ELIGIBLE_SOURCE_TYPES = ['bank', 'cash']`) y
> `accountAllocationService.js:23` — lo que es exactamente el conjunto que PA1
> y PA2 de §3bis dan por elegible. Sigue sin localizarse un flujo que **cree**
> una cuenta de ese tipo, así que la sonda de fase 2b conserva su pregunta.

---

## 1. Hero (tope 3)

### H1 — `net_worth`
- **Domain:** ALL / hero
- **Business meaning:** patrimonio neto actual del usuario — lo que tiene, menos lo que debe, más lo que le deben.
- **Formula:** `SUM(account_balance) WHERE account_type_id IN (1,2,3,4,7) AND account_name != 'slack'` — el `7` (`cash`) entra por **D45**: se lee como banco
- **Source facts:** `user_accounts.account_balance`, `account_types`
- **Currency behaviour:** `stored-in-accounting-currency`
- **Time basis:** stock, *as of* el instante de la respuesta
- **Aggregation rule:** suma directa fila por fila — **no** el `rows[0]` de un `GROUP BY currency_code` (eso es R202, la falla que este catálogo reemplaza). `debtor.account_balance` ya viene neto y firmado (prestar la sube, deber la baja, ver `movementInputHandler.js:32-53`) — se **suma**, nunca se resta
- **Null/zero behaviour:** nunca `null`; cero cuentas válidas es un patrimonio de `0`, y `0` es una cifra real aquí, no un vacío
- **Display priority:** 1 de 3
- **Consumers:** hero Nivel 1; cabecera consolidada de la página ALL (reusado, no recalculado — D6/§4.2)

> **La fuente de todo *stock* de este catálogo cambió — medido 2026-08-30.**
> Vale para **H1, H2, D1, P1, V2 y V4**, que están escritas como
> `SUM(account_balance)` sobre `user_accounts`, y para PA1/PA2/PA3 de §3bis, que
> comparan `account_balance` contra lo asignado.
>
> *Lo que afirman:* que el saldo de una cuenta es la columna
> `user_accounts.account_balance`.
>
> *Lo que dice el código:* esa columna dejó de ser la lectura autoritativa. El
> saldo se deriva del ledger con
> `derivedAccountBalanceSql(alias, cast)`
> (`backend/src/utils/fintrackUtils/accountDataRetrieval/derivedBalance.js:181`),
> y las pantallas ya migraron: `dashboardController.js:23` lo aplica a **todas**
> sus consultas de saldo, y `getAccountController.js:592` lo selecciona como
> `derived_account_balance` para después **sobrescribir** con él el
> `account_balance` de la respuesta del detalle de cuenta (`:822-824`, commit
> `17a0714` *fix(account): derive the detail screen balance*). Del lado de
> escritura, `updateAccountBalance.js` fue borrado y lo sustituye un único
> escritor derivado,
> `accountManagement/setAccountBalanceFromLedger.js` — sin commitear hoy — con un
> segundo escritor todavía vivo en la ruta de borrado
> (`accountDeletionUtils/updateAffectedAccountBalance.js:8`).
>
> *Por qué hace falta decidir de nuevo:* la columna sigue existiendo y sigue
> teniendo un valor, así que ninguna de estas fórmulas falla — devuelven una
> cifra que puede diferir de la que la misma pantalla publica al lado, que es
> exactamente el defecto R202 que abrió este módulo. La decisión pendiente es si
> el campo "source facts" de cada entrada de stock pasa a nombrar la expresión
> derivada en vez de la columna. No se toca aquí ninguna fórmula.

### H2 — `cash_position`
- **Business meaning:** dinero disponible de inmediato, sin vender una posición de inversión ni resolver una deuda.
- **Formula:** `SUM(account_balance) WHERE account_type_id IN (1,4,7) AND account_name != 'slack'` — el `7` (`cash`) entra por **D45**: se lee como banco
- **Source facts:** igual que H1, filtrado a bank + cash + pocket_saving
- **Currency behaviour:** `stored-in-accounting-currency`
- **Time basis:** stock, *as of* ahora
- **Aggregation rule:** SUM directo
- **Null/zero behaviour:** `0` es válido, nunca `null`
- **Display priority:** 2 de 3
- **Consumers:** hero Nivel 1

### H3 — `net_monthly_flow`
- **Business meaning:** si el usuario avanza o retrocede este mes — ingreso menos gasto.
- **Formula:** `SUM(amount) WHERE movement_type_id=2 AND transaction_type_id=2` (pata de la cuenta real — `bank`/deposit) `− SUM(amount) WHERE movement_type_id=1 AND transaction_type_id=2` (pata de la cuenta `category_budget`, no la de la cuenta real), ambas filtradas al mes en curso — **corregido 2026-08-20**, ver I1: los dos términos llevaban la misma anotación invertida que ya se corrigió en E1
- **Source facts:** `transactions.amount`, `movement_type_id`, `transaction_type_id`, `transaction_actual_date`
- **Currency behaviour:** `stored-in-accounting-currency`
- **Time basis:** flujo, mes calendario en curso — **hereda R66**: "este mes" significa fecha de entrada, no fecha elegida por el usuario
- **Aggregation rule:** dos SUM, diferencia
- **Null/zero behaviour:** `0` es válido (sin actividad este mes); nunca fabricado
- **Display priority:** 3 de 3
- **Consumers:** hero Nivel 1

---

## 2. Tarjetas de dominio (3-5 cada una)

### ALL — consolidada, sin fórmula propia (§4.2)

Por regla, ALL **reusa** las salidas de cada calculadora de dominio; no
recalcula nada. Sus campos son referencias, no nuevas entradas de catálogo:

| campo de ALL | reusa |
|---|---|
| `net_worth` | H1 |
| `total_income_period` | Income.I1 |
| `total_expense_period` | Expense.E1 |
| `net_debt_position` | Debt.D1 |
| `total_pocket_balance` | Pocket.P1 |
| `transaction_count_all` | `COUNT(*)` de todas las transacciones del periodo, `account_name != 'slack'` — única cifra nueva de ALL, y es un conteo, no una fórmula financiera |

`Transfer` es sub-métrica de ALL (D1 cerrada): no tiene tarjeta ni fila propia,
sólo aparece dentro del conteo de transacciones si se decide incluirlo — abierto
para fase 2, no bloquea.

---

### Income

**I1 — `total_income`**
- Business meaning: ingreso total del periodo.
- Formula: `SUM(amount) WHERE movement_type_id=2 AND transaction_type_id=2`, pata de la cuenta real (`bank`/deposit), filtrado al periodo — **corregido 2026-08-20**: la anotación original decía "pata de la cuenta real" sobre `transaction_type_id=1`, que es la pata de `income_source`. Es la misma inversión ya corregida en E1, que sobrevivió aquí porque aquella corrección se anotó sólo sobre la entrada de gasto. No es cosmético: `amount` viene firmado por pata y la de `income_source` es el withdraw, así que el filtro original habría publicado el ingreso en negativo. Verificado contra `movementInputHandler.js:20-30` (`getIncomeConfig`: origen=`income_source`/withdraw, destino=`bank`/deposit).
- Implementación: la pata se selecciona por el **conjunto de cuentas**, no por una segunda condición — `movement_type_id = 2` sobre las cuentas reales del usuario deja fuera la pata de `income_source` porque esa cuenta no está en el conjunto. Mismo patrón que ya usa gasto (`overviewMonthlyRepository.js`), y una condición menos que pueda desincronizarse del total.
- Source facts: `transactions.amount`.
- Currency: `stored-in-accounting-currency`. Time basis: flujo, periodo (hereda R66).
- Aggregation: SUM. Null/zero: `0` válido.
- Priority 1. Consumers: tarjeta Income, ALL.

**I2 — `income_transaction_count`**
- Business meaning: cuántos ingresos se registraron en el periodo.
- Formula: `COUNT(*)`, mismo filtro que I1.
- Priority 2.

**I3 — `income_delta_vs_prior_period`**
- Business meaning: si el ingreso mejoró o empeoró contra el periodo anterior de igual longitud.
- Formula: `I1(periodo) − I1(periodo anterior de igual longitud)`.
- Null/zero behaviour: si no existe un periodo anterior completo (cuenta más joven que un periodo), `null` + notice "sin histórico suficiente" — nunca comparar contra un periodo que no existió.
- Priority 3.

*Candidato para fase 2, no aprobado aquí:* `income_by_source`, desagregado por
`income_source`. Añadiría una cuarta fila; se decide cuando se apruebe la lista
de campos definitiva.

---

### Expense

**E1 — `total_expense`** — misma forma que I1, invertido: `movement_type_id=1 AND transaction_type_id=2`, pata de la cuenta `category_budget` (no la de la cuenta real) — corregido 2026-08-20, la anotación original tenía la dirección invertida; verificado contra `movementInputHandler.js:8-18` (`getExpenseConfig`: origen=banco/withdraw=`transaction_type_id` 1, destino=`category_budget`/deposit=`transaction_type_id` 2). La fórmula del WHERE no cambia, sólo la anotación. Ver D20 sobre si además hay que netear `movement_type_id=6`.

**E2 — `expense_transaction_count`** — mismo patrón que I2.

**E3 — `expense_delta_vs_prior_period`** — mismo patrón que I3.

**E4 — `budgetAmount` (candidato, no aprobado)** y **E5 — `budgetVariance`
(candidato, no aprobado)** — §5 los permite **sólo si** vienen de forma
consistente del contrato de presupuesto ya congelado (`budgetCalculationService`,
vía D6 — Overview nunca lee el endpoint legacy). No se cierran aquí: dependen de
que `overview_services` importe esa capa sin reabrir su contrato. Si se
aprueban, la tarjeta Expense llega a 5 campos; si no, se queda en 3.

---

### Investment

Las cinco vienen de la revisión como asesor financiero pedida por el
desarrollador (ver D9). Todas están en `stored-in-accounting-currency` — no hay
conversión de lectura (D7).

**V1 — `capital_contributed`**
- Business meaning: dinero puesto en la cuenta de inversión, neto de retiros — **no** es cost basis por posición, es efectivo neto movido.
- Formula: `SUM(amount) WHERE account_id = <cuenta_inversión> AND movement_type_id IN (6, 8)` — `amount` ya viene firmado por cuenta (positivo en la pata de depósito, negativo en la de retiro), así que la suma neta es directa. **Nunca `movement_type_id = 3`** — muerto, R211.
- Source facts: `transactions.amount`, `account_id`, `movement_type_id`.
- Time basis: stock acumulado, *as of* ahora.
- Aggregation: SUM. Null/zero: `0` válido (cuenta recién abierta).
- Priority 1.

**V2 — `ledger_balance`**
- Business meaning: saldo actual de la cuenta, tal como lo lleva el libro — no es una valuación de mercado.
- Formula: `user_accounts.account_balance` de la cuenta de inversión.
- Time basis: stock, *as of* `updated_at`.
- Priority 2.

**V3 — `realized_pnl`**
- Business meaning: ganancia o pérdida que el usuario registró a mano para esta cuenta.
- Formula: `SUM(amount) WHERE account_id = <cuenta_inversión> AND movement_type_id = 9 AND description NOT LIKE 'RTA Annulment Target(%'` — filtro obligatorio, R212.
- Time basis: flujo, periodo seleccionable (default: histórico completo).
- Null/zero: `0` válido — incluye el caso donde todas las filas `pnl` de la cuenta eran de anulación y quedaron filtradas.
- Priority 3.

**V4 — `concentration`**
- Business meaning: qué tan concentrado está el dinero de inversión en una sola cuenta/posición — señal de diversificación, no de retorno.
- Formula: `MAX(account_balance) / SUM(account_balance)` entre las cuentas del usuario con `account_type_id = 2`.
- Time basis: stock, *as of* ahora, ratio 0-1.
- Null/zero: con una sola cuenta de inversión el ratio es `1` — **correcto, no un defecto a corregir después**. Con cero cuentas de inversión, `null` + notice "sin cuentas de inversión", nunca `0`.
- Priority 4.

**V5 — `days_since_last_contribution`**
- Business meaning: qué tan reciente es el último aporte — señal de consistencia, no de retorno.
- Formula: `now() − MAX(transaction_actual_date) WHERE account_id = <cuenta_inversión> AND movement_type_id = 6 AND amount > 0` — **corregido 2026-08-20, ver D26**. La fórmula original decía `IN (6,8)` mientras la regla de null decía "sin aportes **más allá de la apertura**, `null` + notice": con el tipo 8 dentro, esa regla era inalcanzable — siempre habría respondido con la fecha de apertura. V1 sí incluye el 8, porque el dinero puesto al crear la cuenta es capital aportado; V5 no, porque abrir una cuenta una vez no es un hábito y V5 es una señal de constancia.
- Hereda R66: en la práctica es "días desde que se **registró** el último aporte", exacto porque nadie puede poner fecha retroactiva hoy.
- Null/zero: sin aportes más allá de la apertura, `null` + notice "sin aportes registrados" — nunca un número inventado.
- Priority 5.

**Regla de presentación, no una sexta métrica:** por identidad contable
`V1 + V3 = V2`. La tarjeta muestra esto como una **reconciliación**
(aportado + P/L = saldo), nunca como "ganancia absoluta" en un tile aparte — sería
la misma cifra que V3 disfrazada de una segunda medida independiente.

**No se publica ningún porcentaje de retorno ni valor de mercado (D9).**
Ganancia no realizada: `null` + notice permanente hasta que exista un modelo de
valuación.

---

### Debt

**D1 — `net_debt_position`**
- Business meaning: saldo neto de lo que le deben al usuario menos lo que el usuario debe.
- Formula: `SUM(account_balance) WHERE account_type_id = 3` — ya firmado (positivo = le deben, negativo = debe, ver `movementInputHandler.js:32-53`).
- Time basis: stock, *as of* ahora.
- Priority 1.

**D2 — `debt_transaction_count`**
- Formula: `COUNT(*) WHERE movement_type_id = 4`, filtrado al periodo.
- Priority 2.

**D3 — `debt_delta_vs_prior_period`**
- Formula: `D1(cierre del periodo de referencia) − D1(cierre del periodo anterior)` — **corregido 2026-08-20, ver D24**. La redacción original decía `D1(ahora) − D1(inicio del periodo anterior)`, que abarca dos periodos y habría hecho que `delta` significara "cambio en un periodo" en income/expense/pnl y "cambio en dos" en debt/pocket. §5 declara `delta` una sola vez para las cinco tarjetas. Semántica que queda fija: **`totalAmount` = estado al cierre del periodo, `delta` = cambio respecto al cierre anterior**.
- Implementación: no hay tabla de histórico de saldos en el esquema (verificado leyendo las migraciones), así que un saldo pasado se reconstruye restando del saldo actual todo lo posterior al corte. La serie termina en el saldo de hoy por construcción, así que la tarjeta y la serie no pueden discrepar (§4.2).
- Mismo patrón de null/zero que I3.
- Priority 3.

---

### Pocket

**P1 — `total_pocket_balance`**
- Formula: `SUM(account_balance) WHERE account_type_id = 4`.
- Time basis: stock. Priority 1.

**P2 — `pocket_transaction_count`**
- Formula: `COUNT(*) WHERE movement_type_id = 5`, filtrado al periodo. Priority 2.

**P3 — `pocket_delta_vs_prior_period`**
- Mismo patrón que D3, sobre P1 — **corregido igual que D3, ver D24**. Priority 3.
- Es, además, **lo ahorrado neto en el mes**: cierre del mes menos cierre del anterior es exactamente lo que entró menos lo que salió. `PLAN_POCKET_ALERT.md` §9.2 llega a la misma cifra por otro camino y por otra razón — descarta el acumulado por derivable y se queda con la cifra acotada al periodo.

**P4 — `trend` de pocket: serie de saldos a fin de mes** (D23, no es una métrica
nueva del catálogo sino la forma que toma `trend` en este dominio). No es una
serie de flujo mensual: el último punto **es** `P1`, así que la tarjeta y el
gráfico no pueden mostrar dos cifras distintas de lo mismo (§4.2). Un mes sin
movimiento arrastra el saldo, no publica 0 — el espíritu de D18 (sin huecos, un
mes plano se ve plano) se cumple; lo que no puede ser es 0, porque un mes en que
el usuario no ahorró no le vació los bolsillos.

*Nota de alcance:* esta tarjeta es sobre cuentas `pocket_saving` en general. Las
metas (`target`, `desired_date`) son el widget **Financial goals** de abajo, no
esta tarjeta — son dos vistas distintas del mismo tipo de cuenta. Confirmado
2026-08-20 contra `PLAN_POCKET_ALERT.md`, que gobierna la tarjeta y el hero **del
módulo Pocket** (barra de progreso, requerido/mes, cuadro de estado, una vista
por meta). Overview agrega, no detalla. Ver **D29**.

> ⛔ **P1 a P4 quedan derogadas por D44, cerrada el 2026-08-24.** Un bolsillo es
> una asignación sobre dinero que sigue en el banco, no una cuenta de custodia, y
> el desarrollador borró la última cuenta `pocket_saving` de producción ese mismo
> día. Las cuatro fórmulas leen `account_type_id = 4` o `movement_type_id = 5` y
> las dos cosas dejaron de existir. **Se conservan escritas porque describen lo
> que el código hace hoy** y §3bis y §3ter dicen qué las sustituye. No se
> implementa ninguna de las cuatro.

---

## 3bis. Pocket — asignación, no custodia (sustituye a P1-P4)

**Regla que decide cada entrada: una cifra de bolsillo en el overview se pliega
sobre CUENTAS, nunca sobre bolsillos.** El overview contesta *dónde está mi
dinero*; el tablero del módulo contesta *están cubiertas mis metas*. Plegar las
mismas filas de asignación por bolsillo da la segunda pregunta, que ya vive en
`/fintrack/pocket` y duplicarla en la pantalla de inicio es la discrepancia que
§4.2 prohíbe.

Y no es preferencia: los dos pliegues devuelven cifras distintas en cuanto una
cuenta queda corta. Por bolsillo sale lo que el usuario comprometió; por cuenta
sale cuánto de eso tiene efectivo real detrás.

**PA1 — `free_cash`**
- Business meaning: cuánto puedo gastar sin romper un compromiso.
- Formula: `SUM(MAX(account_balance − allocated, 0))` sobre cuentas elegibles
 (`bank`, `cash`; `account_name != 'slack'`), **acotada por cuenta antes de
 sumar**.
- Source facts: `user_accounts`, `pocket_allocations` agrupada por
 `source_account_id`.
- Aggregation rule: el clamp por cuenta es obligatorio. `SUM(saldo) − SUM(asignado)`
 deja que una cuenta con efectivo de sobra cubra a otra sobreasignada, y el hero
 publicaría efectivo libre que no se puede gastar sin romper un compromiso en otra
 parte. Es el mismo clamp que el spec de bolsillos aplica en su tablero, un nivel
 más arriba.
- Time basis: stock *as of* ahora. Currency: `stored-in-accounting-currency`.
- Null/zero: `null` sin cuentas elegibles; `0` real es un resultado legítimo.
- Priority 1. Consumers: hero (§11), junto a `cashPosition`.

**PA2 — `over_allocated_account_count`**
- Business meaning: cuántas cuentas ya no cubren lo que tienen comprometido.
- Formula: `COUNT(*)` de cuentas elegibles con `account_balance < allocated`.
- Aggregation rule: **es un conteo y no un monto, deliberadamente.** El déficit se
 enuncia en cada cuenta; un total agregado de déficits se lee como una deuda que
 nadie tiene.
- Null/zero: `0` real, nunca `null` — un conteo sobre el conjunto vacío es cero.
- Priority 2. Consumers: hero, como señal junto a PA1.

**PA3 — `committed_cash`**
- Business meaning: del efectivo que ya se muestra, cuánto está comprometido.
- Formula: `SUM(pocket_allocations.amount)` sobre cuentas elegibles.
- Aggregation rule: **línea memo, jamás sumada al patrimonio ni a la posición de
 efectivo** — ya está contenida en ellas. Es la línea que D44 describe al partir
 `cashPosition` en total, comprometido y disponible.
- Priority 3, y **condicionada**: se publica sólo si PA1 se renderiza al lado de
 `cashPosition`. Una resta cuyo sustraendo no está en la misma pantalla no se lee.

**Lo que no entra, y por qué.** Ninguna cifra de meta — ni `totalTarget`, ni
progreso global, ni conteo de completadas o vencidas: contestan la pregunta del
tablero, viven en el módulo y traerlas aquí es la frontera que ya se fijó para
presupuesto y luego para bolsillos (**D29**). Ninguna lista de bolsillos ni meta
más próxima: sería el tablero renderizado dos veces. Ninguna serie `trend`: una
serie de asignaciones dibuja la frecuencia con que el usuario cambió de idea, no
cómo creció su dinero.

**Dónde se calculan.** Las tres son pliegues del *read path de cuentas*, donde
`allocated` y `unassignedCash` ya viven porque el formulario de asignación valida
contra ellos. Las sirve el endpoint del overview desde las mismas filas por cuenta,
y **el overview no llama a ningún endpoint de bolsillos**: acoplar la pantalla de
inicio a la disponibilidad de otro módulo por tres enteros que el módulo de cuentas
ya produce es un coste sin contraparte.

> **Verificado 2026-08-30, con el anclaje que faltaba.** Es cierto:
> `allocated` y `unassignedCash` ya viven en el read path de cuentas, servidos
> por `pocket_services/services/accountAllocationService.js:62-63` y `:110-111`,
> y consumidos desde `getAccountController.js:445` y `:873` — una importación de
> servicio, no una llamada a un endpoint de bolsillos, que es justo lo que este
> párrafo pide. El conjunto elegible `['bank', 'cash']` está fijado en
> `pocketAllocationService.js:45` y `accountAllocationService.js:23`, y coincide
> con el que PA1 y PA2 declaran arriba.

---

## 3ter. Savings — conducta, no tipo de cuenta (sustituye la lectura de P3)

**D41 decía que `pocket_saving` *es* la cuenta de ahorro. Ya no existe ninguna.**
Y P3 leía *lo ahorrado neto en el mes* de una diferencia de saldos de bolsillo, que
bajo el modelo nuevo mide intención, no acumulación.

**Un bolsillo mide intención; el ahorro mide hecho.** `allocated` crece cuando el
usuario decide reservar dinero que ya tenía — no llegó dinero. El ahorro crece sólo
cuando el dinero se acumula de verdad. Las dos cifras pueden moverse en direcciones
opuestas el mismo mes: seis bolsillos pueden llegar al 100% mientras la posición de
efectivo baja, si lo que ocurrió fue comprometer un saldo existente.

Por eso **ninguna entrada de esta sección lee `pocket_allocations`.** Las tres leen
`transactions`, que es donde está el hecho.

**SV1 — `net_cash_change`**
- Business meaning: cuánto se acumuló de verdad en el periodo.
- Formula: posición de efectivo al cierre − posición al cierre del periodo anterior.
- Time basis: flujo, acotado al periodo. Es la misma aritmética que D24 fijó para
 toda `delta` de stock, aplicada al dominio que sí es un stock de dinero real.
- Priority 1.

**SV2 — `savings_rate`**
- Formula: `net_cash_change / total_income` del mismo periodo.
- Source facts: `transactions` con `movement_type_id = 2`, la pata que entra en la
 cuenta real — la corrección de **D22**, que aplica igual aquí.
- Null/zero: **`null` cuando el ingreso es 0**, nunca `0`. Un cociente sin
 denominador no es cero, es una pregunta sin respuesta, y la regla de frontend del
 proyecto la pinta como guion.
- Priority 2.

**SV3 — `trend` de savings: serie mensual de SV1**, ventana de 6 meses (**D18**).
A diferencia de la serie de bolsillo que sustituye (**D23**), un mes sin actividad
publica **`0` real y no arrastra**: SV1 es flujo, y un mes en que no se acumuló
nada acumuló cero. Ese era además el comportamiento que D18 fijó para los dominios
de flujo, del que P4 era la excepción por ser un stock.

**No hay subtipo de cuenta de ahorro sobre el que filtrar** (`Q12` del spec de
bolsillos). *Ahorro* aquí es una conducta medida sobre un periodo, no un lugar donde
el dinero está. Si el subtipo se agrega algún día, afina *dónde* terminó la
acumulación; no cambia ninguna de las tres fórmulas.

### La cifra que une los dos dominios — y la que `Q7` rechazó

**SV4 — `required_monthly_across_goals`** — `SUM(requiredMonthly)` sobre los
bolsillos donde no es nulo. La sirve el módulo de bolsillos, porque es una suma de
cifras por bolsillo; la comparación contra SV1 se hace aquí, que es donde las dos
mitades están en pantalla, y contesta *¿estoy acumulando al ritmo que mis metas
exigen?*

**Es la cifra de ritmo que `Q7` rechazó, leída del lado que la hace honesta.**
`runRate` se descartó porque leía un ritmo del libro de asignaciones, y ese ritmo
mide con qué frecuencia el usuario cambió de idea, no con qué velocidad llegó el
dinero. Leído de `transactions`, mide dinero entrando de verdad — lo único
comparable contra un ritmo requerido sin inventar causalidad.

Es también la única excepción a la regla de §3bis, y lo es porque **no es una cifra
de dinero**: es un ritmo, y un ritmo no tiene custodia.

**Se implementa al final**, después de PA1 y PA2. Es la más útil de todo lo
propuesto y la única que necesita una convención de periodo — qué mes, alineado a
qué — y esa convención es del módulo de presupuesto, no de éste. Ponerla primero
resolvería una pregunta de calendario dentro de una tarjeta de ahorro.

### Lo que no se propone para savings

- **Ninguna meta de ahorro.** Eso es un bolsillo. Una cifra de ahorro con meta
 encima es el tablero de bolsillos reconstruido en la pantalla de inicio.
- **Ninguna proyección.** *A este ritmo llegas en N meses* multiplica un ritmo
 medido por el supuesto de que continúe, y un mal mes convierte eso en una promesa
 que la app no cumplió.
- **Ninguna racha ni insignia.** Nada en esta app premia conducta; la reporta.

---


### PnL

Cubre `movement_type_id = 9` a través de **todas** las cuentas (`bank` e
`investment`), no sólo las de inversión — es una lista propia desde el Overview
actual (`LastMovements` `(PnL)`), distinta de `Investment.V3` que está acotada a
cuentas de inversión.

**PL1 — `total_realized_pnl`**
- Formula: `SUM(amount) WHERE movement_type_id = 9 AND account_name != 'slack' AND description NOT LIKE 'RTA Annulment Target(%'`, filtrado al periodo — mismo filtro R212 que V3, aplicado sin restringir por tipo de cuenta.
- Time basis: flujo, periodo. Priority 1.

**PL2 — `pnl_transaction_count`** — mismo filtro, `COUNT(*)`. Priority 2.

**PL3 — `pnl_delta_vs_prior_period`** — mismo patrón que I3/D3. Priority 3.

---

## 3. Monthly snapshot

Sustituye a `MonthlyAverage.tsx` (§6 del plan: se adapta, no se borra el widget,
se reescribe su fuente).

**MS1 — `domain_monthly_actual`**
- Business meaning: cuánto movió el dominio (expense/income/pocket) en el mes en curso.
- Formula: igual a `total_expense` / `total_income` según el dominio. **Para pocket es el neto del mes**, no `total_pocket_balance` — **corregido 2026-08-20, ver D28**. Con MS1 = saldo, MS4 (`MS1 − MS3`) restaría un promedio de flujo a un stock: una cifra sin significado en la única tarjeta que el catálogo define igual para los tres dominios. Las cuatro entradas del snapshot responden "¿cuánto muevo en un mes típico y este mes es inusual?", y eso sólo se contesta si las cuatro son de la misma naturaleza.
- El neto mensual de pocket y `PocketCard.delta` (P3) son la misma fórmula. `delta` se publica `null` cuando no existe un periodo anterior completo — eso suprime la comparación, no cambia la aritmética.
- Priority 1.

**MS2 — `active_month_average_3m`**
- Business meaning: monto típico de un mes en el que el dominio **sí tuvo actividad**, mirando sólo los últimos 3 meses — cifra reactiva, refleja un cambio reciente de comportamiento casi de inmediato.
- Formula: `SUM(amount) WHERE <filtro del dominio>` sobre una ventana móvil de los últimos 3 meses completos (o desde la apertura de la cuenta si es más joven, mínimo 1 mes transcurrido) `÷ COUNT(DISTINCT mes con al menos una transacción del dominio dentro de esa ventana)`.
- Null/zero behaviour: si no hubo ningún mes con actividad en la ventana, guion — nunca `0`.
- **Precisión de implementación, 2026-08-20.** "Meses completos" se toma literal: la ventana son los meses **anteriores** al de referencia, nunca el de referencia mismo. El mes en curso suele estar a medias, y promediarlo dentro de la línea base contra la que MS4 lo va a comparar haría que MS4 se encogiera solo a medida que el mes se llena. Por eso la serie que alimenta MS3 trae **13 puntos**: el mes juzgado y los doce que lo juzgan.
- **La actividad la decide el CONTEO de transacciones del mes, nunca su monto.** Un mes donde un depósito y un retiro iguales se cancelan netea a cero y aun así es un mes que ocurrió; juzgarlo por el monto lo empujaría fuera del denominador y subiría el promedio en silencio. Es la razón por la que la serie mensual de pocket se lee con una consulta propia en vez de derivarse restando saldos: un diff de saldos no trae conteo.
- Priority 2.

**MS3 — `active_month_average_12m`**
- Business meaning: la misma pregunta que MS2 — "¿cuánto necesito disponible cuando sí tengo este tipo de movimiento?" — pero sobre 12 meses: cifra estable, no se deja engañar por un mes suelto ni por gastos de frecuencia anual (seguro, impuestos) que un mes cualquiera no vería. El nombre lleva `active_month` a propósito, en ambas variantes: advierte que el denominador no es el total de meses del periodo.
- Formula: igual a MS2, ventana de 12 meses en vez de 3.
- Null/zero behaviour: igual a MS2.
- Priority 2 (mismo nivel que MS2 — son dos lentes del mismo hecho, no una jerarquía).

**MS4 — `variance_vs_average`**
- Formula: `MS1 − MS3` (mes en curso vs la cifra estable de 12 meses, no vs la reactiva de 3 — comparar contra un número que ya se mueve rápido no dice si el mes en curso es inusual).
- Priority 3.

### D14 — cerrada: dos KPI fijos (`active_month_average_3m` / `active_month_average_12m`), sin ventana elegida por el usuario

**Denominador** (parte que ya no cambia): excluye meses sin actividad — se
mantiene la lógica que ya tiene `CalculateMonthlyAverage.ts`, sólo se corrige
de dónde saca los datos. Se revierte la recomendación original de este mismo
catálogo, que proponía dividir por meses *transcurridos*.

**Por qué el denominador excluye meses en cero:** el propósito del indicador,
aclarado por el desarrollador, es dimensionar cuánto tener disponible en un
mes que sí tiene este tipo de movimiento — no suavizar una tasa de flujo de
caja incluyendo meses en cero. Diluir con meses sin actividad respondería una
pregunta distinta (tasa de ahorro/quema promedio) y subestimaría lo que el
usuario necesita disponible el mes en que el gasto sí ocurre.

**Ventana: dos KPI fijos, no un selector.** Se evaluaron tres opciones: una
sola ventana de 12 meses, un selector de ventana a elección del usuario, o dos
KPI fijos en paralelo (3 y 12 meses). Se descarta el selector: pide al usuario
una decisión estadística (¿3? ¿6? ¿12?) para leer una tarjeta que se supone es
de un vistazo, y abriría una superficie nueva — parámetro de API, control de
UI, persistencia de la preferencia (columna o tabla nueva) — que hoy nada más
necesita. Se adopta el patrón de dos KPI fijos: uno reactivo (3m) y uno
estable (12m), cada uno respondiendo una pregunta distinta sin pedirle nada al
usuario.

**Benchmark de apps profesionales** (`benchmarking_lookUp/monthly_average_kpi_benchmark.md`,
2026-08-20): ninguna app con metodología documentada excluye meses en cero del
denominador — eso sigue siendo una elección de producto propia de FinTrack, sin
precedente externo, de ahí que el nombre cargue `active_month` en vez de
`monthly_average`. La ventana dual sí tiene precedente real y verificado:
Empower publica exactamente este patrón, 3 meses para la cifra reactiva y 12
para la estable, dos preguntas distintas en vez de una ventana única o un
selector.

**El bug real que sí queda corregido, en ambas ventanas:** la ventana fija
enero-diciembre (`dashboardMonthlyTotalAmountByType.js:43-47`) se reemplaza por
ventanas móviles. Ese bug es independiente de la discusión del denominador: la
implementación actual reinicia el promedio de enero al total de un solo mes
cada año, sin memoria de diciembre anterior — eso sí era, sin ambigüedad, un
defecto.

> **Reanclado 2026-08-30:** el bug sigue en pie y su anclaje es
> `dashboardMonthlyTotalAmountByType.js:102-105` — el controlador se reescribió
> (`:61-230`, era `:18-176`) y la ventana fija
> `{ start: currentYear + '-01-01', end: currentYear + '-12-31' }` bajó de
> `:43-47` a `:102-105`. El denominador de meses con actividad que hoy vive en el
> cliente está en `CalculateMonthlyAverage.ts:68-71`.

---

## 4. Financial goals (widget de Nivel 1, no una tarjeta de dominio)

Ya server-computado y correcto hoy — el único widget que §2.4I señala como el
modelo a seguir. Se reusa tal cual, sin nueva fórmula:

**G1 — `goals_total_balance`**, **G2 — `goals_total_target`**,
**G3 — `goals_total_remaining`** — los tres, `stored-in-accounting-currency`,
stock *as of* ahora, reusados de la respuesta ya servida hoy (`SavingGoals.tsx:26-31`).

**Cambios obligatorios al adoptarlo, no nuevas métricas:**
- Quitar el indicador `Math.random()` (§2.4E) — no hay KPI que lo reemplace, se elimina.
- Un target ausente renderiza un guion, nunca `0` (regla de frontend del proyecto, y el propio R59/R60 del módulo de metas).

> ⛔ **Esta sección perdió su sujeto — medido 2026-08-30. No se toca ninguna
> decisión; hace falta una nueva.**
>
> *Lo que afirma:* que G1-G3 ya están servidas y correctas hoy, que se reusan
> "tal cual" de la respuesta que consume `SavingGoals.tsx:26-31`, y que adoptarlo
> sólo exige quitar el `Math.random()` de ese componente.
>
> *Lo que dice el código:*
>
> - `frontend/src/fintrack/pages/overview/components/SavingGoals.tsx` **no
>   existe**. Lo borró el commit `b40c4b8` *fix(overview): remove every pocket
>   read* el 2026-08-30, junto con la petición de metas de ahorro que lo
>   alimentaba y con el `Math.random()` que esta sección manda quitar. El cambio
>   está commiteado y es ancestro de `HEAD`.
> - La consulta que servía G1-G3 sólo sobrevive en la rama `feat/overview`, sin
>   fundir: `overview_services/db/overviewPageRepository.js:50-58`
>   (`SAVING_GOALS_QUERY`), que hace `JOIN pocket_saving_accounts` filtrando
>   `account_type_name = 'pocket_saving'` — las filas que la migración `020` dejó
>   en cero.
> - El anclaje de R59, `accountCreationController.js:985-988`, ya no apunta a
>   nada: el archivo tiene 986 líneas y no contiene ninguna asignación de
>   `target`. La ruta que creaba una cuenta del tipo retirado fue retirada
>   (`accountRoutes.js:57-60`).
>
> *Por qué hace falta decidir de nuevo:* las tres entradas se declaran "reusadas
> tal cual" de un componente y de una consulta que ya no están en la rama de
> trabajo, y el dato que describen vive ahora en `pockets` / `pocket_allocations`.
> D44 ya decidió que las metas **se repuntan y no mueren**; lo que queda abierto
> es de dónde las lee el nivel 1, y §13 del contrato ya registra esa deuda
> (`financialGoals` debe leer de `pocket_services` cuando exista). El texto de
> arriba se conserva entero.

---

## 5. Recent activity (Nivel 1, teaser ≤5) — no es una métrica

No entra en el catálogo de once campos: es una lista corta de transacciones
crudas, no una agregación. Contrato: `transactions` ordenado por
`transaction_actual_date DESC LIMIT 5`, `account_name != 'slack'` siempre. Cada
fila muestra la moneda de su propia cuenta (ya contable, D7) — no hay campo de
"moneda" a nivel de la lista completa.

---

## 6. Pendiente para fase 2 / 2b — no cierra en este archivo

| pendiente | por qué no cierra aquí |
|---|---|
| Aprobar o descartar E4/E5 (`budgetAmount`, `budgetVariance`) | movido a `OVERVIEW_DECISIONS.md` **D16**, junto con `PLAN_OVERVIEW_CONTRACT.md` §0 |
| Aprobar o descartar `income_by_source` | movido a `OVERVIEW_DECISIONS.md` **D17** |
| ~~Uso real de `account_type_id = 7` (`cash`)~~ | **cerrado 2026-09-01** — `OVERVIEW_DECISIONS.md` **D45**: una cuenta de efectivo es una cuenta bancaria y se lee como tal. Ninguna fórmula necesita ya la sonda |
| ~~Si `Transfer` entra en `transaction_count_all` de ALL~~ | **cerrado** — `OVERVIEW_DECISIONS.md` **D15**: no cuenta |

> **Cerrado 2026-09-01 — D45.** La nota del 2026-08-30 estrechaba la pregunta de
> la sonda de "¿se usa?" a "¿hay alguna ruta que cree una cuenta `cash`?". Ya no
> hace falta contestar ninguna de las dos: el desarrollador decidió que una cuenta
> de efectivo **es** una cuenta bancaria, así que se lee como banco exista o no
> alguna. Lo que aquella nota midió sigue siendo cierto y ahora es coherente: el
> único sitio del código que clasifica los dos tipos ya los pone juntos
> (`pocketAllocationService.js:45`, `accountAllocationService.js:23`).

---

## 7. Trazabilidad — qué corrige cada entrada

Toda entrada de dinero real de este catálogo reemplaza una lectura del endpoint
`url_get_total_account_balance_by_type` (R202/D6) por una suma directa sobre
`user_accounts`/`transactions`. Toda entrada de inversión filtra `R211`. Toda
entrada de `pnl` filtra `R212`. Toda entrada de periodo hereda la advertencia
`R66`. Ninguna entrada inventa una tasa de cambio (D7) ni un porcentaje de
retorno no honesto (D9). `active_month_average_3m`/`_12m` (MS2/MS3, D14) cargan
la advertencia en el propio nombre: el denominador de meses activos es una
elección de producto sin precedente en la industria
(`benchmarking_lookUp/monthly_average_kpi_benchmark.md`); la ventana dual (3m
reactiva / 12m estable) sí tiene precedente real — Empower publica ese mismo
patrón.

---

## Registro de correcciones — 2026-08-30

Sólo mediciones. No se cerró, borró ni reescribió ninguna decisión, ninguna
fórmula y ninguna prioridad. Medido en `fix/auth-screen`, `e919a89`, árbol de
trabajo incluido.

| sección | qué se corrigió |
|---|---|
| §0 | glosario reverificado contra `005_base_catalogs.sql`; `cash` pasó de "sin flujo localizado" a "con lectores confirmados, sin ruta de creación localizada" |
| §1 (H1) | **marcado** — la columna `user_accounts.account_balance` dejó de ser la lectura autoritativa de todo *stock* del catálogo (H1, H2, D1, P1, V2, V4 y PA1-PA3): el saldo se deriva con `derivedBalance.js:181` |
| §3bis | verificado y anclado: `allocated`/`unassignedCash` en `accountAllocationService.js:62-63`, `:110-111`, consumidos desde `getAccountController.js:445` y `:873` |
| §3 (D14) | ventana fija de año calendario `dashboardMonthlyTotalAmountByType.js:43-47` → `:102-105`; denominador cliente `:68-71` |
| §4 | **marcado** — G1-G3 se reusan "tal cual" de `SavingGoals.tsx:26-31`, componente borrado por `b40c4b8`; el anclaje de R59 en `accountCreationController.js:985-988` tampoco existe ya |
| §6 | fila de `cash` estrechada |

**Verificado y dejado como estaba:** las tres anotaciones corregidas el
2026-08-20 en I1, E1, V5, D3 y P3 contra
`movementInputHandler.js:8-18`, `:14`, `:20-30` y `:32-53` — los cuatro anclajes
siguen exactos. La derogación de P1-P4 por D44 sigue describiendo el código:
`pocket_saving_accounts` sobrevive vacía y `pocket_saving` sigue en el catálogo
de tipos, tal como `020_create_pocket_tables.sql:33-40` declara a propósito.

**Sin resolver:** si las filas de `pocket_saving_accounts` están efectivamente en
cero. La migración `020` lo declara medido contra producción el 2026-08-24, pero
esto es un conteo sobre una base de datos y no se leyó ninguna en esta sesión.
