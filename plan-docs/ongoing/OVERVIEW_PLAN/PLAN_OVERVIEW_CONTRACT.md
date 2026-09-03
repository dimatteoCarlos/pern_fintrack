# CONTRATO DE DATOS — Overview, fase 2

**Lives in `plan-docs/ongoing/`, which `.gitignore:123` re-includes: this file is versioned.**

Depende de `PLAN_OVERVIEW_KPI_CATALOG.md` (fase 1, cerrada y aprobada
2026-08-20). Cada tipo de abajo es la forma de cable de una entrada del
catálogo — el id `snake_case` del catálogo es el nombre de la fórmula, el campo
`camelCase` de aquí es lo que el cliente recibe. La convención camelCase sigue
el precedente ya en producción: `budgetCalculationService.js` (`budgetAmount`,
`referenceMonth`, `executionPercentage`), citado como precedente de forma en
`PLAN_OVERVIEW.md` §4.1 ("batch-payload precedent"). Es distinta a propósito de
la convención `snake_case` de los endpoints legacy del dashboard — `overview_services`
es un módulo nuevo (D2), no una extensión de esos.

No hay código en este archivo — sólo tipos. Regla del proyecto (D11): ningún
commit de implementación contra un contrato sin congelar. Este documento es lo
que se congela.

---

## 0. Dos decisiones de esta fase — cerradas 2026-08-20

El catálogo (fase 1) dejó tres campos como candidatos, no aprobados: **E4/E5**
(`budgetAmount`/`budgetVariance` en Expense) e **I4** (`income_by_source` en
Income). Ambas cerradas por el desarrollador, registradas como **D16** y
**D17** en `OVERVIEW_DECISIONS.md`:

- **D16 — E4/E5 entran**, con un matiz que la primera pregunta no traía: el
  contrato original mezclaba `totalAmount` (todo el gasto real) con
  `budgetAmount`/`actualSpent` de `budgetCalculationService` (sólo gasto
  atado a una cuenta `category_budget`, atadura que es opcional —
  `movementInputHandler.js:14`). `ExpenseCard` de abajo separa
  `categorizedExpense` de `totalAmount` y añade `hasUncategorizedExpense`
  para que `budgetVariance` no se lea como algo que no es.
- **D17 — I4 no entra**, sin matiz: Income ya llega al piso de campos con
  I1-I3.

---

## 1. Envelope compartido

```ts
type ApiEnvelope<T> = {
 status: number;
 message: string;
 data: T;
};

type ApiErrorEnvelope = {
 status: number;
 message: string;
 // Sólo presente en errores de validación (Zod) — mismo shape que
 // budgetController.js:57-66, ya en producción.
 errors?: ApiErrorIssue[];
};

type ApiErrorIssue = {
 field: string;
 message: string;
 code: string;
};
```

## 2. Meta y procedencia (D8)

```ts
type ProvenanceGrade = 'live' | 'cached' | 'synthetic';

type Provenance = {
 grade: ProvenanceGrade;
 source: string;
 fetchedAt: string | null;
};

// notices es siempre un arreglo, nunca ausente — mismo motivo que
// budgetCalculationService.js:400-403: un caller que itera no necesita un
// null-check, y la forma no cambia el día que aparece un segundo notice.
type SectionMeta = {
 notices: string[];
 // null hoy, siempre — D7: no hay conversión en lectura porque la moneda
 // contable y la preferida del usuario coinciden siempre todavía. El campo
 // se reserva ahora para no romper el contrato el día que diverjan (D7,
 // motivo: "es la puerta que dejaría de estar cerrada si el usuario alguna
 // vez pudiera fijar una moneda visual distinta de la contable"). D8 define
 // los tres grados que tomará cuando deje de ser null.
 provenance: Provenance | null;
};
```

## 3. Dominios y periodo

```ts
type OverviewDomain =
 | 'income'
 | 'expense'
 | 'investment'
 | 'debt'
 | 'pocket'
 | 'pnl';

// Mismo patrón que budgetCalculationService.getBudgetAccountsStatus: mes
// opcional y sólo pasado, por defecto el mes en curso en el calendario del
// dueño de la cuenta. El servidor siempre informa qué ventana usó — el
// cliente nunca la infiere de su propio reloj (mismo motivo que
// budgetController.js:414-419: el reloj del cliente no es el calendario del
// dueño de la cuenta).
type PeriodWindow = {
 periodStart: string; // YYYY-MM-DD
 periodEnd: string; // YYYY-MM-DD
};
```

## 4. Hero (tope 3, H1-H3)

```ts
type HeroSection = {
 netWorth: number; // H1 — nunca null, 0 es una cifra real
 cashPosition: number; // H2 — nunca null
 netMonthlyFlow: number; // H3 — nunca null, puede ser negativo
 currency: CurrencyType; // única para toda la respuesta — D7
 meta: SectionMeta;
};
```

## 5. Tarjeta genérica de dominio (Income, Expense, Debt, Pocket, PnL)

Las cinco comparten la misma forma — `totalAmount` + `transactionCount` +
`delta`, exactamente las prioridades 1-3 de cada bloque del catálogo (I1-I3,
E1-E3, D1-D3, P1-P3, PL1-PL3). Investment **no** entra aquí — sus cinco campos
no son una cifra total, un conteo y una delta, así que forzarlo a esta forma
perdería información (§6).

```ts
type DomainCardBase = {
 domain: OverviewDomain;
 totalAmount: number; // nunca null — 0 es actividad real en cero
 transactionCount: number;
 // null + notice cuando no existe un periodo anterior completo contra el
 // que comparar (cuenta más joven que un periodo) — nunca comparar contra
 // un periodo que no existió (I3/E3/D3/PL3 del catálogo).
 delta: number | null;
 currency: CurrencyType;
 window: PeriodWindow;
 meta: SectionMeta;
};

type IncomeCard = DomainCardBase & {
 domain: 'income';
 // I4, candidato — EXCLUIDO de este borrador (§0). Si se aprueba, se agrega
 // aquí, no reemplaza totalAmount.
 // bySource?: { sourceAccountId: number; sourceAccountName: string; amount: number }[];
};

type ExpenseCard = DomainCardBase & {
 domain: 'expense';
 // E4/E5 — aprobados, D16. Vienen de budgetCalculationService sin abrir su
 // contrato (D6) — overview_services los importa, no los recalcula.
 //
 // Alcance verificado, no simétrico con totalAmount: budgetAmount y
 // categorizedExpense sólo cuentan transacciones atadas a una cuenta
 // category_budget (budgetTransactionRepository.js:32-35); esa atadura es
 // opcional (movementInputHandler.js:14, getExpenseConfig acepta
 // category_account_id ?? null). budgetVariance compara presupuesto contra
 // gasto CATEGORIZADO, no contra totalAmount (que es todo el gasto real) —
 // de ahí el campo separado categorizedExpense, para que el cliente pueda
 // mostrar los dos sin inventar una resta que mezcle universos distintos.
 budgetAmount: number | null; // null + notice si no hay ninguna categoría presupuestada este periodo
 categorizedExpense: number | null; // gasto real, sólo transacciones con category_budget asociada
 budgetVariance: number | null; // budgetAmount - categorizedExpense; null si budgetAmount es null
 // presente cuando totalAmount > categorizedExpense: hay gasto real sin
 // categoría, y budgetVariance no lo refleja.
 hasUncategorizedExpense: boolean;
};

type DebtCard = DomainCardBase & {
 domain: 'debt';
 // D39 — las dos piernas de la posicion, al cierre del mes de referencia.
 //
 // Los nombres son los que la pantalla legacy ya les da: `DebtsLayout.tsx:44,48`
 // lee `debt_payable` y `debt_receivable` y los rotula `payable` y `receivable`.
 // "you owe" / "you're owed" NO es un par de cifras — es el rotulo que el signo
 // del neto elige en :66, un ternario sobre `total_debt_balance`. La vista lo
 // sigue derivando del signo de `totalAmount`; el backend no publica rotulos.
 //
 // MAGNITUDES POSITIVAS, las dos. La direccion la lleva el nombre del campo, no
 // el valor: un `payable` negativo seria un doble negativo.
 // La identidad que las ata es `totalAmount = receivable - payable`, y es una
 // COMPROBACION, no una definicion: `totalAmount` sigue saliendo de
 // getMonthlyBalance y no se recalcula desde las piernas ni en el servidor ni
 // en el cliente (§4.2 — una cifra, un camino).
 payable: number; // >= 0, nunca null; 0 es una respuesta real
 receivable: number; // >= 0, nunca null; 0 es una respuesta real
 // D39 — cuantas cuentas de deudor estan saldadas al cierre. Definicion
 // normativa en §5.2. Va al read model; §5.2 registra que NO se pinta en la
 // tarjeta de nivel 1.
 settledCount: number;
};

type PocketCard = DomainCardBase & {
 domain: 'pocket';
};

type PnlCard = DomainCardBase & {
 domain: 'pnl';
};
```

> **Anclajes remedidos 2026-08-30, sin cambio de tipos.**
>
> - **`DebtCard`.** El comentario cita `DebtsLayout.tsx:44,48` para
>   `debt_payable` / `debt_receivable` y `:66` para el ternario del rotulo. El
>   archivo esta modificado sin commitear hoy y los tres bajaron:
>   `debt_payable` en `:50`, `debt_receivable` en `:54`, y el ternario sobre el
>   signo de `total_debt_balance` en `:75-79`. Los rotulos literales
>   `'receivable'` y `'payable'` estan en `:83` y `:91`. El fondo de D39 no
>   cambia: sigue siendo un ternario que elige un rotulo para una sola cifra, no
>   un par de campos.
> - **`ExpenseCard`.** Los dos anclajes que sostienen el alcance no simetrico
>   siguen exactos: el filtro atado a `category_budget` en
>   `budgetTransactionRepository.js:32-35` (`movement_type_id IN (1, 6)` en `:35`)
>   y la atadura opcional en `movementInputHandler.js:14`
>   (`category_account_id ?? null`).

## 5.1 Saldo de cierre — definicion normativa (D42)

Toda cifra de esta seccion que diga "al cierre del mes" significa exactamente
esto, y ninguna otra lectura:

> El saldo de cierre del mes M de un conjunto de cuentas es el saldo actual de
> esas cuentas menos toda transaccion cuya `transaction_actual_date` sea igual o
> posterior al instante en que empieza el mes M+1 en la zona IANA del titular.

Las cuatro lecturas que esto descarta, y que sin la definicion escrita alguien
podria tomar por equivalentes:

| lectura descartada | por que no |
|---|---|
| El ultimo `transaction_actual_date` del mes | Un mes sin movimiento no tiene ninguno, y su saldo de cierre existe igual: es el anterior arrastrado |
| `transactions.account_balance_after_tr` | Es el saldo que el ledger anoto al escribir. Si alguna vez derivo de `user_accounts.account_balance`, la serie terminaria en un numero distinto al que publica la tarjeta |
| El cierre en UTC | El limite es la medianoche LOCAL del titular. Una transaccion del 31 a las 21:00 en America/Bogota es del mes que cierra, y en UTC ya es del siguiente |
| `ua.account_balance` a secas | Es el saldo de hoy. Coincide con el cierre solo para el mes de referencia |

**El mes de referencia es el caso limite, y es intencional.** Su cierre puede
estar en el futuro, asi que no resta nada y el saldo de cierre ES el saldo
actual. Eso no es una coincidencia a preservar a mano: es la razon por la que la
consulta se escribe desde el saldo actual hacia atras
(`overviewBalanceRepository.js:16-21`).

**Divergencia con la pantalla legacy, registrada a proposito.**
`dashboardController.js:216-226` publica `debt_receivable`, `debt_payable` y
`debtors_without_debt` leyendo `ua.account_balance` — o sea, a hoy, sin
reconstruir. Para el mes en curso las dos coinciden; para un mes cerrado no
tienen por que. Overview no sincroniza con esa pantalla y no la toca: la
limpieza de la cifra legacy ocurre en la fase 6, despues de que el nivel 2
funcione.

> **Remedido 2026-08-30 — la divergencia se mantiene, la columna citada no.**
> Las tres cifras legacy se publican hoy en `dashboardController.js:224-228`, y
> **ya no leen `ua.account_balance`**: `:23` define
> `DERIVED_BALANCE = derivedAccountBalanceSql('ua')` y las tres expresiones
> —`debt_receivable` con `CASE WHEN > 0`, `debt_payable` con `CASE WHEN < 0`,
> `debtors_without_Debt` con `FILTER (WHERE = 0)`— se calculan sobre esa
> expresión derivada del ledger. La mitad del argumento que este contrato
> necesita sobrevive intacta: sigue siendo un saldo **a hoy**, sin reconstruir,
> así que para un mes cerrado sigue sin tener por qué coincidir con `totalAmount`.
> Lo que ya no es cierto es la frase "leyendo `ua.account_balance`".
>
> El anclaje de §5.1 en la rama sin fundir sigue exacto:
> `overview_services/db/overviewBalanceRepository.js:16-21` es el comentario que
> explica por qué la consulta se escribe desde el saldo actual hacia atrás. Pero
> su `MONTHLY_BALANCE_QUERY` (`:41-56`) ancla la serie en
> `COALESCE(SUM(ua.account_balance), 0)` (`:47`) — la columna almacenada, la
> misma que el resto de la aplicación dejó de leer. La definición normativa de
> arriba no cambia; su implementación en esa rama lee una fuente que ya no es la
> autoritativa, y eso se suma a lo que hay que reescribir antes de fundir.

## 5.2 `settledCount` — definicion normativa (D43)

> `settledCount` es la cantidad de cuentas del **mismo conjunto sobre el que se
> calcula `totalAmount`** cuyo saldo de cierre del mes de referencia es
> exactamente 0 y que tuvieron al menos una transaccion con fecha anterior a ese
> cierre.

Las tres partes, cada una decidiendo una ambiguedad concreta:

| parte | que decide |
|---|---|
| "el mismo conjunto que `totalAmount`" | El conjunto es el de `getDebtAccountIds`: cuentas de tipo `debtor` del usuario, `slack` excluido, **borradas logicamente incluidas** (`overviewAccountRepository.js:92-106`). No se filtra por `deleted_at` y no se hace join a `debtor_accounts`. Contar sobre un conjunto distinto al del total pondria dos cifras sobre dos universos en la misma tarjeta |
| "exactamente 0" | Cero de verdad, comparado en decimal. No un umbral ni un redondeo |
| "al menos una transaccion antes del cierre" | Una cuenta de deudor recien creada y jamas usada tiene saldo 0 y **no es un deudor saldado**. Sin esta parte, crear cuentas inflaria la cifra |

**Lo que esto deja adentro a proposito:** una cuenta cerrada. El cierre escribe
una fila de anulacion (R212), asi que la cuenta llega a 0 habiendo tenido
movimiento — que es exactamente lo que la definicion llama saldado. Excluirla
seria contar sobre un conjunto distinto al del total, que es lo que la primera
parte prohibe.

**No coincide con `debtors_without_debt` de la pantalla legacy** ni siquiera
hoy, por dos razones acumuladas: aquella lee a hoy (§5.1) y ademas hace
`JOIN debtor_accounts`, que descarta toda cuenta de tipo `debtor` sin fila de
detalle. Son dos cifras distintas con nombres parecidos, y el contrato lo
registra para que nadie las cruce esperando que cuadren.

> **Reverificado 2026-08-30.** Las tres partes de la definicion siguen
> describiendo el codigo de la rama `feat/overview`: el conjunto de
> `getDebtAccountIds` es `overviewAccountRepository.js:98-106`, sin filtro
> `deleted_at` y sin join a `debtor_accounts`, con el motivo documentado en
> `:92-97`. Las dos razones de la no coincidencia con la cifra legacy siguen en
> pie; la primera se apoya en §5.1, cuya correccion de arriba no la altera —
> aquella sigue leyendo a hoy.

## 6. Tarjeta de Investment (bespoke — no extiende `DomainCardBase`)

Cinco cifras absolutas, ninguna es un total agregable con las otras tarjetas.
`D9` prohíbe expresamente publicar retorno % o valor de mercado — quedan fuera
del tipo, no como `null` sino ausentes: un campo `null` invita a un cliente a
preguntar "¿por qué está vacío?"; un campo que no existe no invita nada.

```ts
type InvestmentCard = {
 domain: 'investment';
 capitalContributed: number; // V1 — nunca null, 0 válido (cuenta recién abierta)
 ledgerBalance: number; // V2 — nunca null
 realizedPnl: number; // V3 — nunca null, 0 válido
 // V4 — null + notice "sin cuentas de inversión" si el usuario no tiene
 // ninguna; nunca 0 en ese caso. Con una sola cuenta, 1 es correcto.
 concentration: number | null;
 // V5 — null + notice "sin aportes registrados" si no hubo aportes más
 // allá de la apertura.
 daysSinceLastContribution: number | null;
 // Identidad contable capitalContributed + realizedPnl = ledgerBalance.
 // El cliente reconcilia, el servidor no publica una sexta cifra derivada.
 currency: CurrencyType;
 meta: SectionMeta;
};
```

## 7. ALL — consolidada (§4.2, no recalcula nada)

```ts
type AllCard = {
 domain: 'all';
 netWorth: number; // = HeroSection.netWorth (H1), mismo valor, no una segunda fórmula
 totalIncomePeriod: number; // = IncomeCard.totalAmount
 totalExpensePeriod: number; // = ExpenseCard.totalAmount
 netDebtPosition: number; // = DebtCard.totalAmount
 totalPocketBalance: number; // = PocketCard.totalAmount
 // Única cifra propia de ALL — un conteo, no una fórmula financiera.
 // Si Transfer cuenta aquí: cerrado NO — ver OVERVIEW_DECISIONS.md, la
 // decisión menor registrada junto con este contrato.
 transactionCountAll: number;
 currency: CurrencyType;
 window: PeriodWindow;
 meta: SectionMeta;
};
```

## 8. Monthly snapshot (MS1-MS4)

```ts
type MonthlySnapshot = {
 domain: 'income' | 'expense' | 'pocket'; // MS1 se define sólo para estos tres dominios, por catálogo §3
 domainMonthlyActual: number; // MS1 — nunca null
 // MS2/MS3 — null cuando ningún mes de la ventana tuvo actividad. El
 // frontend renderiza guion, nunca 0 (regla de frontend del proyecto).
 activeMonthAverage3m: number | null;
 activeMonthAverage12m: number | null;
 varianceVsAverage: number | null; // MS4 = domainMonthlyActual - activeMonthAverage12m; null si el segundo es null
 currency: CurrencyType;
 meta: SectionMeta;
};
```

## 9. Financial goals (G1-G3 — reusado, no recalculado)

```ts
type FinancialGoalsSection = {
 goalsTotalBalance: number;
 goalsTotalTarget: number | null; // null cuando no hay target fijado — nunca 0 (R59/R60)
 goalsTotalRemaining: number | null;
 currency: CurrencyType;
 meta: SectionMeta;
};
```

## 10. Recent activity (teaser ≤5 — no es una métrica)

No es una agregación: reusa la forma de fila ya servida por
`LastMovementRespType`/`MovementTransactionDataType` (`responseApiTypes.ts`),
sin campo de moneda a nivel de lista — cada fila ya trae la suya (D7).

```ts
type RecentActivitySection = {
 transactions: MovementTransactionDataType[]; // máximo 5, transaction_actual_date DESC, account_name != 'slack'
};
```

## 11. `GET /overview`

```ts
// Request — mismo patrón que POST /budget/accounts/status: mes opcional,
// pasado solamente, por defecto el mes en curso del dueño de la cuenta.
type GetOverviewParams = {
 month?: string; // YYYY-MM, opcional, sólo pasado
};

type GetOverviewData = {
 hero: HeroSection;
 all: AllCard;
 domainCards: {
  income: IncomeCard;
  expense: ExpenseCard;
  investment: InvestmentCard;
  debt: DebtCard;
  pocket: PocketCard;
  pnl: PnlCard;
 };
 monthlySnapshot: MonthlySnapshot[]; // uno por dominio de MonthlySnapshot['domain'] — income, expense, pocket
 financialGoals: FinancialGoalsSection;
 recentActivity: RecentActivitySection;
 charts: {
  // D18 — sólo los tres dominios que publican serie en §12.
  trend: {
   income: MonthlyTrendPoint[];
   expense: MonthlyTrendPoint[];
   pocket: MonthlyTrendPoint[];
  };
  // D19 — el Pareto del mes, sólo expense.
  expenseCategories: ExpenseCategoryStatus[];
  // D33 — el acumulado del año por categoría, sólo expense. Ventana propia:
  // 1 de enero → cierre del mes de referencia, no el mes del resto del payload.
  expenseYtdDistribution: ExpenseYtdShare[];
 };
};

type ExpenseYtdShare = {
 categoryName: string;
 actualSpentYtd: number;
 share: number;  // 0-1, participación en el gasto del año. Σ share = 1 (D33)
 rank: number;   // 1 = mayor actualSpentYtd, orden descendente
};

type GetOverviewResponse = ApiEnvelope<GetOverviewData>;
```

**No carga filas de transacción** fuera de `recentActivity` (§5 de
`PLAN_OVERVIEW.md`, obligación de contrato) — un domain card completo con su
paginación vive sólo en `GET /overview/:domain`. `charts` no la contradice: un
punto de serie y una fila de categoría son agregados, no filas de transacción.

### 11.1 Reglas de composición — congeladas 2026-08-20

`GET /overview` **no calcula ninguna cifra de dominio**. Cada tarjeta viene de la
calculadora que la posee; el resto es aritmética sobre esas tarjetas. R202 —el
defecto que abrió este módulo— era una cifra consolidada calculada por un segundo
camino que discrepaba del detalle a su lado; un servicio de página que
recalculara un total sería el mismo defecto reconstruido un piso más arriba, con
mejor SQL.

| campo | de dónde sale | decisión |
|---|---|---|
| `hero.netWorth` | saldo de banco + `investment.ledgerBalance` + `debt.totalAmount` + `pocket.totalAmount` | **D27** |
| `hero.cashPosition` | saldo de banco + `pocket.totalAmount` | **D27** |
| `hero.netMonthlyFlow` | `income.totalAmount − expense.totalAmount` | **D27** — hereda la corrección de D22 en vez de repetir la pata invertida |
| `all.*` (cinco cifras) | copiadas de `hero` y de las tarjetas | §7, sin fórmula nueva |
| `all.transactionCountAll` | suma de los cinco `transactionCount` de dominio | **D31** — un `COUNT(*)` duplicaría todo movimiento de dos patas |
| `domainCards.*` | las seis calculadoras, tal cual | §12 |
| `monthlySnapshot[]` | MS1 de la tarjeta; MS2/MS3 de una serie de 13 puntos | **D28** para pocket |
| `financialGoals` | consulta propia sobre `pocket_saving_accounts` | **D30** |
| `recentActivity` | consulta propia, 5 filas, sin acotar al mes | §10 |
| `charts.trend.*` | de las calculadoras de income, expense y pocket, tal cual | **D32** |
| `charts.expenseCategories` | de la calculadora de expense, tal cual | **D32** |

> ⛔ **La fila de `financialGoals` describe una consulta que hoy devuelve vacio —
> medido 2026-08-30. No se cierra ninguna decision; hace falta una nueva.**
>
> *Lo que afirma:* que `financialGoals` sale de una consulta propia sobre
> `pocket_saving_accounts`, y que es una de las tres lecturas propias que hace la
> pagina.
>
> *Lo que dice el codigo:* la consulta existe unicamente en la rama sin fundir —
> `overview_services/db/overviewPageRepository.js:50-58`, `SAVING_GOALS_QUERY`,
> con `JOIN pocket_saving_accounts psa` y
> `AND act.account_type_name = 'pocket_saving'`. La migracion `020` desmonto ese
> modelo el 2026-08-24 y `020_create_pocket_tables.sql:33-40` deja escrito que la
> tabla se conserva **vacia** a proposito. En la rama de trabajo la mitad de
> frontend tambien desaparecio: `SavingGoals.tsx` fue borrado por `b40c4b8` el
> 2026-08-30 junto con la peticion que la alimentaba.
>
> *Por que hace falta decidir de nuevo:* la seccion no falla, devuelve cero — el
> caso que la seccion "Overview se aborda al final" de `OVERVIEW_DECISIONS.md` ya
> describe para el dominio de bolsillo, aplicado tambien a las metas. D44 decidio
> que las metas **se repuntan y no mueren**, y §13 de este mismo documento ya
> registra que G1-G3 debe leer de `pocket_services` cuando exista. Lo que queda
> abierto es si esa lectura sigue siendo una **consulta propia de la pagina** —
> como dice esta fila— o pasa a ser una importacion mas, como `domainCards`.
> Los tipos de §9 no cambian: D44 ya anticipo que la nulabilidad se mantiene.

**Las tres lecturas propias** que la página hace y ninguna calculadora hace son:
el **saldo de banco** (el único stock que ninguna tarjeta publica, porque no hay
dominio Bank en §3), las **metas de ahorro** y el **teaser de actividad
reciente**. Nada más.

`recentActivity` **no se acota al mes pedido**: responde "qué pasó por último",
no "qué pasó en el mes que estoy estudiando". Un usuario leyendo agosto en
noviembre vería si no un teaser de tres meses atrás, que parece una app que dejó
de registrar.

## 12. `GET /overview/:domain` — parcial, un vacío señalado a propósito

```ts
type GetOverviewDomainParams = {
 domain: OverviewDomain;
 month?: string;
 page?: number;
 pageSize?: number;
};

// D18 — un punto por mes calendario, ventana de 6 meses. `value` reusa la
// fórmula de MS1 (domain_monthly_actual) aplicada mes a mes en vez de
// colapsada al mes en curso — nunca null: un mes sin actividad es 0 real,
// no se excluye (a diferencia del denominador de MS2/MS3, D14, que sí
// excluye meses en cero porque responde una pregunta distinta: "cuánto
// necesito en un mes activo" contra "cómo se movió esto en el tiempo").
type MonthlyTrendPoint = {
 month: string; // YYYY-MM
 value: number;
};

// D19 — un array único, no dos (distribution/pareto separados): el donut y
// el Pareto leen exactamente el mismo dataset, así que no pueden mostrar
// cifras distintas para la misma categoría. Los ocho primeros campos vienen
// tal cual de makeBudgetCategoryStatus, sin abrir su contrato (D6).
// rank/cumulativeActual/cumulativePercentage son cálculo nuevo, server-side
// (§4.1 de PLAN_OVERVIEW.md): makeCategoryGroups ordena alfabéticamente hoy,
// no por gasto. Incluye categorías borradas (soft-delete) con gasto real en
// el mes — la query no hereda el filtro deleted_at IS NULL de
// accountUtils.js, que responde una pregunta distinta ("cuentas asignables a
// una transacción nueva") — así que actualSpent sumado sobre el array
// reconcilia exacto con card.totalAmount (E1).
type ExpenseCategoryStatus = {
 categoryName: string;
 currency: CurrencyType | null; // null + notice si la categoría mezcla monedas (D7)
 accountCount: number;
 budgetAmount: number | null; // 0 si nunca se presupuestó — sin campo ni estado especial
 actualSpent: number | null;
 remainingBudget: number | null;
 executionPercentage: number | null; // null cuando budgetAmount es 0, división evitada
 isOverBudget: boolean | null;
 rank: number; // 1 = mayor actualSpent, orden descendente
 cumulativeActual: number; // suma corrida hasta esta fila, en el orden de rank
 cumulativePercentage: number; // cumulativeActual / SUM(actualSpent), 0-1
};

type GetOverviewDomainData = {
 card: IncomeCard | ExpenseCard | InvestmentCard | DebtCard | PocketCard | PnlCard;
 transactions: {
  rows: MovementTransactionDataType[];
  page: number;
  pageSize: number;
  totalRows: number;
 };
 // D18 — presente sólo para income/expense/pocket, mismo alcance que
 // MS1-MS3 (§8). Ausente para investment/debt/pnl, no null: no existe una
 // cifra mensual de flujo en el catálogo de la que derivar una serie, mismo
 // criterio que §6 usa para omitir retorno %/valor de mercado en vez de
 // publicarlos en null.
 //
 // D23 — el `value` de pocket es un SALDO A FIN DE MES, no un flujo. income
 // y expense publican el total del mes; pocket publica el saldo a esa fecha,
 // porque su `totalAmount` es un saldo y el último punto de la serie tiene
 // que ser la misma cifra que la tarjeta (§4.2). Un mes sin movimiento
 // arrastra el saldo en vez de publicar 0 — el "0 real" de D18 vale para
 // flujos; para un stock el equivalente es no dejar huecos, y eso se cumple.
 trend?: MonthlyTrendPoint[];
 // D19 — presente sólo para domain='expense'. Mismo mes que el resto de la
 // página (month de GetOverviewDomainParams), no un selector propio.
 categories?: ExpenseCategoryStatus[];
};

type GetOverviewDomainResponse = ApiEnvelope<GetOverviewDomainData>;
```

---

## 13. Lo que este contrato todavía no cierra

| pendiente | qué falta | bloquea |
|---|---|---|
| ~~Sonda de fase 2b (`account_type_id=7`, `cash`)~~ | **cerrada 2026-09-01 por D45** — una cuenta de efectivo es una cuenta bancaria y se lee como tal. Ya no hay nada que confirmar: la cifra no depende de si el tipo tiene escritura | nada. Lo que sí queda es trabajo de código: `hero.cashPosition` y el conjunto de cuentas reales deben incluir `cash`, y hoy no lo incluyen |
| `financialGoals` cuando exista `pocket_services` | `PLAN_POCKET_ALERT.md` §10.2 B1 propone `services/pocket_services/` para servir el snapshot por pocket. G1-G3 debe leer de ahí y no de una consulta propia, o será la cuarta copia de la misma cifra — §8.2 de ese plan ya registra que hoy son tres consultas solapadas | nada hoy: G1-G3 ya funciona. Es deuda registrada, no un bloqueo |
| R59 sobre G2/G3 | `accountCreationController.js:985-988` convierte un target ausente en `0.00`. **D30** ya decide qué hacer con esas filas; la base local no tiene ninguna (3 pockets, 3 targets reales) | nada hoy. El día que aparezca una, la regla ya está escrita |

> **Remedido 2026-08-30, las tres filas.**
>
> - **`cash`.** *Superado por D45, 2026-09-01.* Lo medido aquí sigue siendo
>   cierto — sin ruta de creación localizada, y con lectores confirmados en
>   `pocketAllocationService.js:45` y `accountAllocationService.js:23` — pero la
>   pregunta que sostenía dejó de importar: el desarrollador decidió que una
>   cuenta de efectivo **es** una cuenta bancaria, así que se lee como banco
>   exista o no alguna. Lo que este contrato tiene que corregir ya no es una duda
>   sino una omisión: `hero.cashPosition` y el conjunto de cuentas reales excluyen
>   `cash`, y por D45 deben incluirlo.
> - **`financialGoals` cuando exista `pocket_services`.** Ya existe:
>   `backend/src/fintrack_api/services/pocket_services/` está en la rama de
>   trabajo con `core/`, `db/` y `services/`, sus rutas montadas en
>   `pocketRoutes.js` y su tablero servido por `pocketBoardService.js`. La
>   columna "bloquea" decía "nada hoy: G1-G3 ya funciona"; **G1-G3 ya no
>   funciona**, por lo que registra el bloque de §11.1 de arriba. La deuda dejó
>   de ser deuda y pasó a ser la única fuente disponible.
> - **R59.** El anclaje `accountCreationController.js:985-988` ya no apunta a
>   nada: el archivo tiene 986 líneas y no asigna ningún `target`; la ruta que
>   creaba la cuenta del tipo retirado fue retirada (`accountRoutes.js:57-60`).
>   La conclusión de D44 se confirma en el esquema: `target_amount` es
>   `DECIMAL(15,2) NOT NULL CHECK (target_amount > 0)`
>   (`020_create_pocket_tables.sql:89`), así que la fila dañada que D30 preveía
>   no puede escribirse. La regla de D30 se conserva sin caso, tal como D44 la
>   dejó.

**Estado 2026-08-20:** §11 y §12 están implementados y verificados contra la base
local — seis dominios, la página completa, y el arnés del scratchpad cubriendo
las invariantes de §4.2. `plan-docs/ongoing/` lo re-incluye el `.gitignore:123`: este archivo sí se versiona.

> **Precisión 2026-08-30 sobre el párrafo anterior.** "Implementados" significa
> implementados **en la rama `feat/overview`, que sigue sin fundir**: 8 commits,
> 29 archivos, 3201 líneas sobre su punto de divergencia con `feat/budget`
> (`2540932`), remedido hoy y coincidente con lo que registra
> `OVERVIEW_DECISIONS.md`. Nada de `overview_services` existe en la rama de
> trabajo `fix/auth-screen`, así que todo anclaje de este documento a un archivo
> `overview_services/**` describe código que no está en el árbol donde se lee.

E4/E5 e I4 (D16/D17) ya cerradas — ver §0. `trend` (D18) y `categories` (D19)
ya cerradas — ver §12. D19 deja un requisito pendiente sobre D16: cuando
`categorizedExpense` se implemente en fase 3, su query debe incluir
categorías borradas con gasto histórico, igual que `categories` — si no, las
dos cifras dejan de reconciliar en la misma página.

Cerrado sin preguntar, registrado en `OVERVIEW_DECISIONS.md` junto con este
archivo: `Transfer` **no** cuenta en `transactionCountAll` — D1 ya lo trata
como sub-métrica sin peso de dominio propio; contarlo en un conteo de
actividad inflaría una cifra de "cuánto se movió" con filas que D1 mismo
declaró que no mueven patrimonio.

---

## Registro de correcciones — 2026-08-30

Sólo mediciones. Ningún tipo, ninguna nulabilidad y ninguna decisión se
modificaron. Medido en `fix/auth-screen`, `e919a89`, árbol de trabajo incluido.

| sección | qué se corrigió |
|---|---|
| §5 | anclajes de `DebtCard` en `DebtsLayout.tsx`: `:44`/`:48` → `:50`/`:54`, ternario `:66` → `:75-79`; los dos anclajes de `ExpenseCard` reverificados sin cambio |
| §5.1 | la divergencia legacy se mantiene, pero `dashboardController.js:216-226` es hoy `:224-228` y **no lee `ua.account_balance`**: suma `derivedAccountBalanceSql`. Registrado además que `MONTHLY_BALANCE_QUERY` de la rama sin fundir sí ancla en la columna almacenada (`overviewBalanceRepository.js:47`) |
| §5.2 | reverificada entera contra `overviewAccountRepository.js:92-106`, sin cambios |
| §11.1 | **marcada** la fila de `financialGoals` — su consulta lee `pocket_saving_accounts`, vaciada por la migración `020`, y su mitad de frontend fue borrada por `b40c4b8` |
| §13 | las tres filas: `cash` ya tiene lectores; `pocket_services` ya existe y G1-G3 dejó de funcionar; el anclaje de R59 ya no apunta a nada y el esquema nuevo impide la fila que D30 preveía |
| §13 | precisión sobre "implementados": lo están en `feat/overview`, sin fundir — 8 commits, 29 archivos, 3201 líneas, remedido hoy |

**Verificado y dejado como estaba:** el envelope compartido de §1 contra
`budgetController.js:57-66`, la convención de `notices` siempre-arreglo de §2
contra `budgetCalculationService.js` (hoy `:405-411`), la forma camelCase citada
como precedente, y todos los tipos de §4 a §12.

**Sin resolver:** las cifras "3 pockets, 3 targets reales, 0 nulos, 0 ceros" de
D30 y la fila de §13 son conteos sobre la base local; no se leyó ninguna base de
datos en esta sesión, así que se dejan como estaban.
