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
// Esta ventana es el reloj de analisis, uno de los tres que distingue
// §14.1: la fecha de referencia responde donde estoy, esta ventana responde
// que paso, y la actividad reciente (§10) elige la suya aparte. En el mes en
// curso `periodEnd` es hoy, no el fin de mes: un flujo nunca fabrica los dias
// que al mes le faltan.
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
 // La tasa de ahorro: H3 dividido entre el ingreso del mes. Expresada 0-1 como
 // toda tasa de este contrato, y sin acotar en ninguno de los dos extremos.
 // null + notice cuando el ingreso del mes es 0 o negativo, nunca 0: un mes sin
 // ingreso no ahorro nada, no tiene tasa, y las dos cosas se leen igual una vez
 // impresas como 0%.
 savingsRate: number | null;
 // What the owner holds that is liquid, less what the owner owes, with money
 // owed TO the owner left out. bank + investment − debt.payable, and the bank
 // term already carries cash accounts (D45). null + notice only when the debt
 // card did not report its payable leg, never 0: a figure that could not be
 // computed and a figure that came out zero are different answers.
 liquidNetWorth: number | null;
 // How much of `cashPosition` nothing has been promised against: the bank and
 // cash balance less what the pockets have been allocated out of each account,
 // floored at zero PER ACCOUNT before the sum. Never null — an owner with no
 // pocket has all of it free — and never negative, because of that floor.
 freeCash: number;
 currency: CurrencyType; // única para toda la respuesta — D7
 meta: SectionMeta;
};
```

### Type change — 2026-09-07

`HeroSection` gains **one field**, `freeCash`. It is a fourth stock and the place
where the pocket commitment finally appears in the hero.

**It is the shape the 2026-09-06 correction prescribed, not an exception to it.**
That correction ruled that a pocket does not constrain spending, so no hero
figure subtracts it, and that if the Overview ever reports overcommitment the
committed total goes **beside** the balance and never inside it. This is that:
`cashPosition` keeps saying what the accounts hold and can be spent, and
`freeCash` says separately how much of it is unpromised. The objection was only
ever to folding one into the other and calling the result available.

**The floor is per account and comes before the sum.** One account's remainder
can go negative — an expense against committed money is always accepted — so
summing raw remainders lets one account's surplus absorb another's shortfall and
publishes free cash that no account can honour. The floor is applied inside the
statement, per account, which is also why the hero cannot compose this figure
from two totals and why it is a fourth read rather than arithmetic on the cards.
It is the one figure in the hero that is not composed from a domain card, for
the same reason `cashPosition` is not: there is no Bank domain in §3.

**A consequence to state rather than hide: `freeCash` can exceed
`cashPosition`.** With one account overdrawn, the balance figure takes that
account's negative and the floor gives free cash a zero for it. Both figures are
correct and they answer different questions.

**Frontend requirement.** `freeCash` renders beside `cashPosition` and never
instead of it — the pair is the point. It is never null, so it has no dash case
of its own, and it still renders as a skeleton while the payload is in flight.
`0` is a real answer here, meaning everything is committed, and is the one place
in this contract where a zero must be printed rather than treated as an absence.

### Type change — 2026-09-06

`HeroSection` gains **one field**, `liquidNetWorth`, and unlike the savings rate
it IS a fourth figure and is defended as one.

**It answers a question none of H1-H3 answers.** Net worth counts money owed to
the owner as wealth, which it is, and as available, which it is not — whether it
arrives is someone else's decision. Liquid net worth is the same holdings with
that leg removed. It adds no query and no time base: the payable leg comes off
the debt card, which now publishes both legs of the position it nets.

**It is composed from the payable leg, never from `netWorth`.** The two are
arithmetically identical and only the first leaves
`netWorth - liquidNetWorth == receivable` as something that can fail. Derived
from net worth it is a tautology, and the one check that catches a flipped
payable sign stops catching anything — flip that sign and the subtraction
becomes an addition, which still prints a plausible figure.

**Pocket commitments are NOT subtracted from it, and not from any hero figure.**
The reason is not that free cash asks a different question. It is that a pocket
does not constrain spending at all, which the correction below states in full.

**Frontend requirement.** `liquidNetWorth` is `number | null` and the null case
is real, so it renders as a dash or a skeleton and **never as 0** — a withheld
figure and a figure that came out zero are different answers and read
identically once printed. When it is withheld the hero carries a notice saying
why, and that notice is what the view shows rather than a generic error. It sits
beside `netWorth` and never replaces it: the pair is the point, because the gap
between them IS what the owner is owed.

**The pocket term leaves BOTH hero figures — corrected 2026-09-06.**
The paragraph this replaces said the term changes sign rather than disappearing:
that `netWorth` drops it and `cashPosition` subtracts it, and that removing it
from both would overstate what is free. That was wrong, and the correction
matters more than the arithmetic because it is about which verb the quantity
governs.

**What a pocket constrains is committing, not spending.** The allocation guard
does refuse a commitment above the account balance less what that account has
already allocated, and it names the remainder unassigned cash — the
message the owner reads uses that name. But the function that computes the three
figures a real account carries states, in its own words, that the available
balance is still the whole account balance, because a pocket never blocks a spend
and naming the remainder available would tell the owner they cannot spend money
they can. An expense against committed money is always accepted, which is why
that remainder may go negative and why a negative is a state rather than an
error.

**So a subtracting cash position would contradict the app, not protect the
owner.** It would publish a smaller figure than the expense path will actually
let them spend. The figure is the bank balance, and no pocket term appears in the
hero at all.

**And the shape is ruled out too, not only the formula.** The screen that picks
which account funds a pocket shows the balance, what is committed and what is
unassigned side by side, specifically so that no single one of the three can be
called available. A lone published number describing spendable money is what that
screen refuses to produce. If the Overview is later to warn about overcommitment,
the committed total goes BESIDE the balance and never inside it — which
is a contract decision to be proposed here first, not an arithmetic one.

**Where this came from.** The developer stated it directly: a pocket is not an
account and therefore cannot hold money, they are commitments against a bank
account, and the way this branch reads the pocket total is wrong because the real
source was already defined in the backend. The wording *money the pocket holds*
was this session's own invention and appears in no definition anywhere; it is
retracted. A peer session then found the ruling above and reversed this session's
recommendation, which had been to subtract.

### Cambio de tipo — 2026-09-05

`HeroSection` gana **un campo**, `savingsRate`. Es un cambio de tipo, no una
medicion, y por eso se registra aqui y no como un hallazgo.

**No convierte al hero en cuatro cifras.** Divide H3 entre uno de los dos
operandos con los que H3 ya se construye, asi que no agrega entrada, ni consulta,
ni base temporal: es el mismo movimiento enunciado como participacion en vez de
como monto. El precedente esta en este mismo contrato — `concentration` de la
tarjeta de inversion es una tasa publicada al lado de las cifras absolutas de las
que se deriva.

**Rango.** Puede pasar de 1 y puede ser negativa, y ninguna de las dos se acota.
Por encima de 1 es un mes real en el que entro una devolucion y se conservo mas de
lo que ingreso; por debajo de 0 es un mes real en el que salio mas de lo que
entro. Son respuestas, no errores.

**Dos notices distintos, y la diferencia importa.** Uno dice que el mes no
registro ingreso; el otro dice que el ingreso del mes salio negativo por
devoluciones o reversos. En el segundo caso la division si se puede hacer y
**miente**: un denominador negativo invierte el signo, de modo que un mes que
perdio dinero reportaria una tasa positiva. Por eso se retiene en vez de
publicarse invertida.

**Requisito de frontend que abre este cambio.** El campo es `number | null`. Un
`null` se pinta como guion con su notice al lado, nunca como `0%` — misma regla
que ya rige para `delta`, `concentration` y `daysSinceLastContribution`.

**Segundo requisito, medido al probar el campo: la tasa es para mostrar, nunca
para reconstruir el monto.** Toda tasa de este contrato se redondea a dos
decimales, asi que una tasa 0-1 tiene granularidad de 1%. Un mes que conservo un
tercio de 3.000 publica `0.33`, y un cliente que multiplique de vuelta obtiene
990 en vez de 1.000 — diez de diferencia contra un `netMonthlyFlow` que viaja al
lado y dice 1.000.

No es un defecto que se arregle subiendo la escala: subirla cambiaria todas las
tasas del modulo, y el monto exacto **ya esta publicado** en el campo de al lado.
Lo que se prohibe es derivar el monto de la tasa habiendo el monto. `concentration`
de la tarjeta de inversion tiene exactamente la misma propiedad.

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

// ✅ **The three fields above are served — implemented and measured 2026-09-06.**
// They were declared and served by nothing from 2026-09-04, and that record is
// kept rather than deleted: this module's characteristic failure is a figure
// computed in a repository that never reaches the payload, and the entry is what
// makes it visible when it happens again.
//
// **The cost was the one D39 predicted for itself.** The paragraph that used to
// stand here said the legs need a new query rather than a copied `CASE`, because
// `getMonthlyBalance` aggregates every account before subtracting and so admits
// no cut by sign — the legs have to be rebuilt per account and grouped by sign
// afterwards. That is exactly what `getDebtDomainFields` does
// (`overviewBalanceRepository.js`), and it reaches the card through a reader the
// shared stock body now takes, so pocket stays unaffected.
//
// **The cut is shared, not duplicated.** The month boundary is one function in
// that repository called by both queries. The legs are a SPLIT of the position
// and not a second computation of it, which is what makes
// `totalAmount = receivable - payable` an audit and not a definition. Measured
// on fintrack_dev over four months and the one owner holding debtor accounts:
// the identity holds on every reading and no leg is ever published negative.
// Flipping the payable sign in a copy of the hero breaks exactly ONE assertion
// of six — the identity — while every other figure still
// prints a plausible number. That is precisely why the check is written as an
// identity and not as a range: nothing else in the hero notices.
//
// **`settledCount` reads the activity clause of §5.2 as excluding the row that
// OPENS the account, not every row.** The definition's stated purpose is that a
// debtor account created and never used is not a settled debtor, and account
// creation writes an opening row, so counting any row at all would re-admit
// exactly what the clause excludes. The two readings are different populations
// and not a distinction without a difference: measured 2026-09-06, three of five
// debtor accounts have a row before the cut and no movement of their own.

type PocketCard = DomainCardBase & {
 domain: 'pocket';
};

type PnlCard = DomainCardBase & {
 domain: 'pnl';
 // Added 2026-09-07. How much of this month's realised result landed on
 // investment accounts. A SPLIT of `totalAmount`, never a second total: the
 // remainder is what came from bank and debtor accounts. Never null; 0 is a real
 // answer meaning the month's result came from somewhere else.
 realizedFromInvestment: number;
};
```

### Type change — 2026-09-07

`PnlCard` gains **one field**, `realizedFromInvestment`.

**What it fixes.** This domain reads every account except the internal
counterparty, which is what §1.4 defines it as and not a defect to narrow. Its
total therefore mixes two economically different things: a result the market
produced on a position, and a result recorded against a bank or a debtor account.
An owner seeing this figure beside the investment card's realised result had no
way to tell whether they are the same money seen twice or two different results
that happen to agree. On the development data they DO agree, and that is a
property of the data — no bank or debtor account there carries a
profit-and-loss row — rather than of the model.

**It is a split of one sum and not a second query.** The field is a `FILTER`
over exactly the rows the total already summed, so the share can never exceed the
total and the two cannot be built over different cuts. Written as a second
statement they could drift apart and the card would show a part larger than its
whole with nothing to say why.

**It is NOT the investment card's figure under another name.** That one is an
accumulation over the whole history of the investment accounts; this is a flow
bounded by the reference month. They coincide only for an owner whose entire
investment history falls inside the month being read.

**The remainder is deliberately not a second field.** Both terms are on the
card, so what came from every other account is one subtraction over two published
numbers, and a figure a client obtains that way is not one the server owes it.

**It is absent from the income and expense statements rather than zero there.**
The monthly reader spreads the field in only when the column was selected. An
income month reporting an investment share of 0 would assert a split that has no
meaning for income.

**Frontend requirement.** Rendered as a subordinate line under the card's total,
never as a figure of equal weight — it is a part of the number above it. When it
equals `totalAmount` the honest label is that the whole month's result came from
investments, not that there are two results.

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
> El anclaje de §5.1 ~~en la rama sin fundir~~ **— corregido 2026-09-04: en el
> árbol de trabajo, fundido el 2026-09-02 —** sigue exacto:
> `overview_services/db/overviewBalanceRepository.js:16-21` es el comentario que
> explica por qué la consulta se escribe desde el saldo actual hacia atrás. Pero
> su `MONTHLY_BALANCE_QUERY` (`:41-56`) ancla la serie en
> `COALESCE(SUM(ua.account_balance), 0)` (`:47`) — la columna almacenada, la
> misma que el resto de la aplicación dejó de leer. La definición normativa de
> arriba no cambia; su implementación en esa rama lee una fuente que ya no es la
> autoritativa, y eso se suma a lo que hay que reescribir antes de fundir.

> **Reparado — remedido 2026-09-06.** El párrafo anterior describe un defecto
> que ya no existe: el commit `2f8cec3d` reescribió las cuatro lecturas de saldo
> sobre la expresión derivada del ledger, y `MONTHLY_BALANCE_QUERY` toma hoy
> `COALESCE(SUM(${DERIVED_BALANCE}), 0)`. Se conserva la nota tachada por lo que
> explica, no por lo que afirma del código.
>
> **Y el comentario de esa consulta contesta una pregunta que §14.1 deja
> abierta para las posiciones.** Un flujo del mes en curso se mide hasta hoy;
> una posición del mes en curso **no necesita un caso especial**, porque la
> consulta se escribe desde el saldo actual hacia atrás y el último mes de la
> ventana no resta nada. La fecha de corte de toda posición es por tanto una
> sola regla, no dos: restar hacia adelante desde hoy. Quien escriba un `if`
> para el mes en curso está reimplementando a mano lo que la forma de la
> consulta ya garantiza.

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
> describiendo el codigo ~~de la rama `feat/overview`~~ **del árbol de trabajo,
> fundido el 2026-09-02 — corregido 2026-09-04. Y hay que leerlo sabiendo que
> este conteo NO se sirve: el servicio de deuda produce la tarjeta base y nada
> más.** El conjunto de
> `getDebtAccountIds` es `overviewAccountRepository.js:98-106`, sin filtro
> `deleted_at` y sin join a `debtor_accounts`, con el motivo documentado en
> `:92-97`. Las dos razones de la no coincidencia con la cifra legacy siguen en
> pie; la primera se apoya en §5.1, cuya correccion de arriba no la altera —
> aquella sigue leyendo a hoy.

## 6. Tarjeta de Investment (bespoke — no extiende `DomainCardBase`)

Seis cifras absolutas, ninguna es un total agregable con las otras tarjetas.
`D9` prohíbe expresamente publicar retorno % o valor de mercado — quedan fuera
del tipo, no como `null` sino ausentes: un campo `null` invita a un cliente a
preguntar "¿por qué está vacío?"; un campo que no existe no invita nada.
> **The identity gained a third term — 2026-09-06.** It had two, over a balance
> that holds three kinds of row, so it did not hold for anyone who had ever
> deleted an investment account and the card told them their books were
> inconsistent. Measured on the development database: contributed 100043.07 plus
> realised 2.30 against a balance of 100044.62, short by exactly one reversal row
> of −0.75. Found by the check that the month binding had to pass, which is why
> it is written here and not by whoever met it on screen.
>
> **Why the missing amount is not simply added back into the realised result.**
> The other half of that reversal is a +0.75 row sitting in the internal
> counterparty account, which is not an investment account and is excluded from
> this card's set by name and by type. Folding it in would close the number and
> mislabel an account closure as money the market produced; the counterparty
> account also carries reversals from every other module, so it cannot be added
> to an investment figure at all.
>
> **The two sums are one pass over one set of rows.** The realised result and the
> adjustment are `FILTER` clauses over the same movement type before the same
> cut, so the adjustment is defined as the rows the realised term drops. Written
> as two independent predicates they could drift apart and the identity would
> break with nothing to say why.
>
> **Frontend requirement.** The investment card renders a fourth money row for
> `closureAdjustment`, labelled as an adjustment from closed accounts and never
> as a gain or a loss. It is 0 for most owners, and a row reading 0 invites the
> question the field does not answer — so hide the row when the value is 0 and
> show it otherwise, including when it is positive. It must not be folded into
> `realizedPnl` for display: the sum would read as an investment result, which is
> the exact confusion the field exists to prevent.

```ts
type InvestmentCard = {
 domain: 'investment';
 // Added 2026-09-07. How many investment accounts the owner has. It decides two
 // of this card's notices and was consulted without being published, so a client
 // reading "the concentration figure is not reported" could not tell an owner
 // with no investment account from one whose accounts hold nothing. Never null;
 // 0 is the real answer for an owner with no such account.
 accountCount: number;
 capitalContributed: number; // V1 — nunca null, 0 válido (cuenta recién abierta)
 ledgerBalance: number; // V2 — nunca null
 realizedPnl: number; // V3 — nunca null, 0 válido
 // Added 2026-09-06. What account deletions moved on these accounts: the
 // reversal row the deletion writes is neither contributed capital nor a
 // realised result, and it is in the balance. Never null; 0 means no
 // investment account was ever deleted, which is the common case.
 closureAdjustment: number;
 // V4 — null + notice "sin cuentas de inversión" si el usuario no tiene
 // ninguna; nunca 0 en ese caso. Con una sola cuenta, 1 es correcto.
 concentration: number | null;
 // V5 — null + notice "sin aportes registrados" si no hubo aportes más
 // allá de la apertura.
 daysSinceLastContribution: number | null;
 // Identidad contable capitalContributed + realizedPnl + closureAdjustment
 // = ledgerBalance. El cliente reconcilia; el servidor publica los términos y
 // nunca la diferencia entre ellos.
 currency: CurrencyType;
 meta: SectionMeta;
};
```

### Type change — 2026-09-07

`InvestmentCard` gains **one field**, `accountCount`, and the prohibition on
publishing the reconciliation difference is **reaffirmed** against a plan that
asks for it.

**`accountCount` is a NEW field of this contract, not a restored one.** The
recovery plan calls it a dropped field. It was dropped from the builder function,
which computed it, used it to choose between two notices and then left it out of
the frozen object — but no version of this type ever declared it. The
`accountCount` that appears elsewhere in this contract belongs to
`ExpenseCategoryStatus` and is a different quantity on a different type.

**Why it is published rather than left internal.** Two of this card's three
withheld-concentration cases are distinguished only by the sentence in the
notice: no investment account at all, versus accounts that hold nothing between
them. A client that renders figures rather than sentences had no field to branch
on. With the count, `accountCount === 0` and `accountCount > 0` separate them
without parsing text.

**It is NOT bounded by the reference month, and that is a known limit rather
than a defect to discover later.** It counts the accounts that exist now; every
money figure on this card obeys the month. On a past month the card can report
three accounts beside a balance built from the two that were open then. Bounding
it needs a creation date the figures statement does not read, so it is a change
to that statement and not to this type.

**The reconciliation difference stays unpublished.** The recovery plan's
investment step asks for a reconciliation field on this card. It contradicts the
comment three lines above — the client reconciles, the server publishes the terms
and never the difference between them — and this contract is frozen while that
plan governs sequencing only, so the prohibition stands until the developer lifts
it in writing. The cost is bounded: all three terms and the balance are on the
card, so the difference is one subtraction over four published fields. The one
thing a client cannot reconstruct is the tolerance — the server compares through
the decimal library, and a client subtracting in floating point will find a cent
of difference where the server found none. That is what the notice is for, and
the notice is what this card publishes instead of the number.

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

### 10.1 `GET /overview/activity` — the reader chooses this period

Added 2026-09-07. §14.1 names three clocks and says this one is the only period a
consumer genuinely chooses, so it takes its own endpoint rather than a parameter
on the page. The teaser above stays exactly as it is: the page keeps publishing
five rows, and this endpoint is an addition rather than a move.

```ts
type GetOverviewActivityParams = {
 from?: string;      // YYYY-MM, inclusive. Absent means unbounded below
 to?: string;        // YYYY-MM, inclusive — the WHOLE month, not its first day
 page?: number;      // default 1
 pageSize?: number;  // default 5 — the size of the teaser; max 100, the shared ceiling
};

type GetOverviewActivityData = {
 transactions: {
  rows: MovementTransactionDataType[];
  page: number;
  pageSize: number;
  totalRows: number;
 };
 // Echoed, and null on an end the reader did not bound. An unbounded read is
 // the default, so a response naming no range would leave a client unable to
 // tell an unbounded answer from the one it asked for.
 range: {
  from: string | null;
  to: string | null;
 };
};

type GetOverviewActivityResponse = ApiEnvelope<GetOverviewActivityData>;
```

**No `ServedWindow` here, and no month ceiling.** The period of this section is
independent of the month the page reports, so publishing the reference month
beside it would answer a question nobody asked. And the 422 the other two
endpoints raise exists because a report about a month that has not happened is
not a report — this endpoint publishes no figure about a month, it filters rows
that exist, and a transaction can carry a future actual date in this schema.

**Default unbounded, and that is the teaser's own rule.** Recent activity answers
what happened last, not what happened in the month being studied: a user reading
August in November would otherwise open the section and find it empty.

**Frontend requirement.** The section becomes a top-level view with its own range
control and its own pagination. The five-row teaser on the page keeps its current
payload and its current shape; what changes is that it now has somewhere to link
to. Nothing on the page has to change for this endpoint to exist.

## 11. `GET /overview`

```ts
// Request — mismo patrón que POST /budget/accounts/status: mes opcional,
// pasado solamente, por defecto el mes en curso del dueño de la cuenta.
type GetOverviewParams = {
 month?: string; // YYYY-MM, opcional, sólo pasado
};

// The window the server actually used. Added 2026-09-07, and §14.1 already
// required it: "el servidor siempre reporta la ventana que usó y el cliente
// nunca la infiere de su propio reloj". Nothing published it, so a client that
// sent no month could not tell which month it was given.
//
// periodEnd is the REFERENCE DATE and not the last day of the month. The two are
// equal for a closed month and are not for the month in course, and §14.1 is
// explicit that a flow never fabricates the days an unfinished month has left.
// The same value reaches card.window.periodEnd on every card from this same
// object, so a payload cannot name two different ends for one period.
// currentMonth is the ceiling the 422 is raised against, and it is a field of
// its own because isCurrentMonth cannot stand in for it: the flag says whether
// the served month IS the ceiling and never says which month that is, so a
// client served any earlier month has no bound to offer a forward step.
type ServedWindow = {
 referenceMonth: string;  // YYYY-MM-01 — echoed even when the request named no month
 currentMonth: string;    // YYYY-MM-01 — the latest month that may be requested
 periodStart: string;     // YYYY-MM-01 — the first day of that month
 periodEnd: string;       // YYYY-MM-DD — month end, or today for the month in course
 isCurrentMonth: boolean;
};

type GetOverviewData = {
 window: ServedWindow;
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
  //
  // ⛔ DECLARADO Y NO SERVIDO — medido 2026-09-04. El servicio de página publica
  // `trend` y `expenseCategories` y ninguna tercera llave
  // (`overviewPageService.js:183-190`), y la cadena `expenseYtd` no aparece en
  // ningún archivo de `backend/src`. El tipo se conserva: es una decisión
  // cerrada sin implementar, no una afirmación que envejeció. Un cliente que lo
  // lea hoy recibe `undefined`, no un arreglo vacío.
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

**Frontend requirement of the served window, 2026-09-07.** The month selector
reads `window.referenceMonth` instead of holding the month it sent: a request
that names no month is answered with the owner's current month, and only the
response knows which that is. `window.isCurrentMonth` is what decides whether
the period label reads a month name or "so far this month", and `periodEnd` is
the date that label ends at — for the month in course it is today, not the last
day of the month, so a component printing the month end would state a period the
figures were not cut at. No component has to change for the payload to carry the
field; the ones above are what it unlocks.

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
| `hero.netWorth` | saldo de banco + `investment.ledgerBalance` + `debt.totalAmount` | **D27**, corregido por **D46** y por **D54** — sin término de bolsillo |
| `hero.liquidNetWorth` | saldo de banco + `investment.ledgerBalance` − `debt.payable` | plan de patrimonio líquido, 2026-09-06 |
| `hero.cashPosition` | saldo de banco, sin ningún otro término | **D27**, corregido por **D46**, **D54** y por la regla de gasto de 2026-09-06 — el término de bolsillo no aparece: un bolsillo limita comprometer, no gastar |
| `hero.netMonthlyFlow` | `income.totalAmount − expense.totalAmount` | **D27** — hereda la corrección de D22 en vez de repetir la pata invertida |
| `all.*` (cinco cifras) | copiadas de `hero` y de las tarjetas | §7, sin fórmula nueva |

> **Time base of the hero inputs — D46, 2026-09-03.** Two of the four terms of
> `netWorth` do not respect the requested month, and this is a defect, not a
> design: `getBankBalance(pool, userId)` (`overviewPageRepository.js:101`) takes
> no month argument, and the investment figures are as of now by declaration
> (`AS_OF_NOW_NOTICE`, `overviewInvestmentService.js:27`). `debt.totalAmount` and
> `pocket.totalAmount` are closing balances of the reference month. A past month
> therefore adds two current balances to two closing ones and yields a figure
> that corresponds to no instant; `cashPosition` mixes one of each.
>
> **Both terms must be reconstructed at the month's close**, with the technique
> `stockDomainCalculator` already applies to debt and pocket: current balance
> minus every transaction posted after the cut. Until that lands, the month
> selector of D46 stays off the Overview page — a control that relabels a figure
> it does not actually move is worse than no control.
>
> The investment notice is not a substitute. It correctly warns about the
> investment CARD, whose figures stand on their own; it cannot excuse an addition
> that mixes two time bases, because the sum has no notice to carry and no reader
> can subtract the wrong term back out.
> **Both terms landed — 2026-09-06.** The investment figures now respect the
> requested month: `getInvestmentFigures` takes the reference month and every
> figure of the card is read at it. The bank balance followed the same day:
> `getBankBalance` takes the reference month and the owner's zone and reads the
> balance at that month's close. **Every term of `netWorth` and of
> `cashPosition` is therefore read at one instant**, which is what the paragraph
> above asked for.
>
> **The notice cited above no longer exists, and the paragraph above must not be
> read as asking for it back.** It said the investment figures were stated as of
> now; that stopped being true when the figures moved, and a disclaimer that
> contradicts the number under it is worse than no disclaimer. The reasoning of
> the paragraph is untouched — a notice never repaired the addition — and what
> repaired the addition was binding the term, which is what happened.
>
> **Two anchors and one figure moved with it.** `getBankBalance` is at
> `overviewPageRepository.js:121`, not `:101`. And its account set widened from
> the bank type alone to bank and cash, which belongs to a different ruling
> (D45) and changes the number: the balance now includes money the user holds
> that no Overview figure counted before.
>
> What still keeps the month selector off the page is no longer a time base. It
> is the pocket term leaving `netWorth` and `cashPosition` (D54), and the fact
> that no screen calls this payload yet.
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
> *Lo que dice el codigo:* ~~la consulta existe unicamente en la rama sin fundir~~
> **— corregido 2026-09-04: la consulta está en la rama de trabajo, fundida el
> 2026-09-02, y sigue leyendo el modelo retirado en
> `overviewPageRepository.js:56-58`. Deja de ser un defecto que se pueda
> corregir antes de fundir y pasa a ser un defecto embarcado.** El resto del
> párrafo se conserva porque sigue describiendo el mecanismo:
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

 // D51 — the running plan, added 2026-09-04. Same two shapes as the two fields
 // above and computed in the same pass of makeCategoryBreakdown.js, so the two
 // accumulations can never be built over different orderings. The plan per
 // category is NOT a new field: it is budgetAmount, already the fourth field of
 // this type and already served.
 //
 // A row whose budgetAmount is null does not enter the accumulation and carries
 // the running figure forward unchanged. The curve therefore continues past it
 // instead of ending there, and its last point means "the plan of the categories
 // that have one", which is not the total budget whenever any row was skipped —
 // hasSkippedBudget says whether that happened, so the reader is told rather
 // than left to compare two totals that were never meant to match.
 cumulativeBudget: number; // suma corrida de budgetAmount, en el orden de rank
 cumulativeBudgetPercentage: number; // cumulativeBudget / SUM(budgetAmount), 0-1
 hasSkippedBudget: boolean; // true si alguna fila anterior no tenia plan
};

type GetOverviewDomainData = {
 // The same object §11 publishes, attached by the same expression in the
 // controller. Two handlers each picking their own fields would be two answers
 // to "what period is this", which is the question the window exists to answer
 // once.
 window: ServedWindow;
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
| ~~Sonda de fase 2b (`account_type_id=7`, `cash`)~~ | **cerrada 2026-09-01 por D45** — una cuenta de efectivo es una cuenta bancaria y se lee como tal. Ya no hay nada que confirmar: la cifra no depende de si el tipo tiene escritura | nothing. The code work this cell asked for is done as well — the bank balance query selects `IN ('bank', 'cash')` in `getBankBalance`, so `hero.cashPosition` and everything composed from the bank term already include cash. Verified 2026-09-06 |
| `financialGoals` cuando exista `pocket_services` | `PLAN_POCKET_ALERT.md` §10.2 B1 propone `services/pocket_services/` para servir el snapshot por pocket. G1-G3 debe leer de ahí y no de una consulta propia, o será la cuarta copia de la misma cifra — §8.2 de ese plan ya registra que hoy son tres consultas solapadas | nada hoy: G1-G3 ya funciona. Es deuda registrada, no un bloqueo |
| R59 sobre G2/G3 | `accountCreationController.js:985-988` convierte un target ausente en `0.00`. **D30** ya decide qué hacer con esas filas; la base local no tiene ninguna (3 pockets, 3 targets reales) | nada hoy. El día que aparezca una, la regla ya está escrita |

> **Remedido 2026-08-30, las tres filas.**
>
> - **`cash`.** *Superado por D45, 2026-09-01.* Lo medido aquí sigue siendo
>   cierto — sin ruta de creación localizada, y con lectores confirmados en
>   `pocketAllocationService.js:45` y `accountAllocationService.js:23` — pero la
>   pregunta que sostenía dejó de importar: el desarrollador decidió que una
>   cuenta de efectivo **es** una cuenta bancaria, así que se lee como banco
>   exista o no alguna. **And the omission this paragraph asked to correct is
>   corrected — verified 2026-09-06.** The bank balance query selects
>   `IN ('bank', 'cash')` in `getBankBalance`, with the reason in that file's
>   header, so `hero.cashPosition`, `hero.netWorth` and `hero.liquidNetWorth`
>   include cash by construction rather than by adding it separately.
>
>   It is written here and not only in §14.4 for a measured reason: the
>   integration session was about to build the liquid net worth view believing
>   the bank term excluded cash, because this document stated the convention in
>   one section and contradicted it as pending work in two others. A reader who
>   arrives through the pending list never sees §14.4.
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

> ~~**Precisión 2026-08-30 sobre el párrafo anterior.** "Implementados" significa
> implementados **en la rama `feat/overview`, que sigue sin fundir**: 8 commits,
> 29 archivos, 3201 líneas sobre su punto de divergencia con `feat/budget`
> (`2540932`), remedido hoy y coincidente con lo que registra
> `OVERVIEW_DECISIONS.md`. Nada de `overview_services` existe en la rama de
> trabajo `fix/auth-screen`, así que todo anclaje de este documento a un archivo
> `overview_services/**` describe código que no está en el árbol donde se lee.~~

> **Superada 2026-09-04: la rama se fundió y "implementados" hay que releerlo
> campo por campo.**
>
> **La rama ya no existe como pendiente.** `feat/overview` llegó a `main` el
> 2026-09-02 en el merge `d5693f1d`, y de ahí a la rama de trabajo actual
> `feat/vercel-serverless`. Su cabeza `1fb66b9` es ancestro de `HEAD` y
> `git log feat/overview ^HEAD` no devuelve nada: **cero commits sin fundir.**
> Todo anclaje `overview_services/**` de este documento describe ahora código del
> árbol en el que se lee, y hay que leerlo así en las tres notas de arriba que
> dicen lo contrario (§5.1, §11.1 y §13).
>
> **Pero "implementados" sigue sin ser cierto de dos partes del contrato**, y el
> merge no las trajo porque nunca se escribieron: las dos piernas de la posición
> de deuda con el conteo de deudores saldados (§5, §5.2, D39 y D43), y la
> distribución del gasto acumulado del año por categoría (§11, D33). Las dos
> están marcadas en su sitio. Lo demás del payload sí se sirve.
>
> **Y el merge cambió qué clase de problema es la sección de metas de ahorro.**
> Mientras la rama estaba fuera, la consulta que lee el modelo de bolsillo
> retirado era un defecto que se podía corregir antes de fundir. Hoy está en la
> rama: `overviewPageRepository.js:56-58` sigue uniendo `pocket_saving_accounts`
> y filtrando `account_type_name = 'pocket_saving'`, sobre una tabla que la
> migración `020` dejó vacía a propósito. **Lo único que lo mantiene invisible es
> que ningún frontend llama a estas rutas**, así que la sección informa cero
> ahorrado y ninguna meta fijada sin lanzar un error, y nadie lo ve.
> **Esa invisibilidad se acaba el día que el nivel 1 haga su primera petición**,
> que es exactamente lo que la propuesta de nivel 1 va a pedir. Es la primera
> pieza de backend que hay que arreglar, y va antes que cualquier campo nuevo.

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

## 14. The temporal frame and the ownership boundary

Added 2026-09-06, closing the first stage of `PLAN_OVERVIEW_RECOVERY.md`. Every
section above states a **shape** — what a field is called and what type it has.
This one states the two things a shape cannot carry: **when** a figure is read,
and **who owns its definition**. Both were implicit until now, and each had
already produced a defect by being implicit.

Written in English, like the recovery plan and the indicator matrix; the
sections above predate that rule and keep the language they were written in.

### 14.1 The three clocks

The largest correction the recovery plan made. These are three separate things,
and the earlier plan documents treated them as one.

| clock | the question it answers | its value |
|---|---|---|
| **reference date** | where do I stand? | the close of the month — or today, when the month is still running |
| **analysis period** | what happened? | `periodStart` → the reference date |
| **activity period** | what do I want to read? | chosen by the reader, independent of the other two |

**A flow never fabricates the days an unfinished month has left.** The running
month is measured `periodStart → referenceDate` and the payload says so; a closed
month is measured `periodStart → periodEnd`. A figure that silently treats the
running month as a whole one is not early, it is wrong.

**Three concepts are not three request parameters.** The contract names all
three; the request exposes a parameter only where the consumer actually chooses
the value. §3 keeps the month as the single input and derives the reference date
and the analysis period from it — the server always reports the window it used
and the client never infers it from its own clock, which is the rule §3 already
carries. Recent activity (§10) takes its own range on its own endpoint, because
it is the one consumer that genuinely chooses that window. Publishing a
reference date, an analysis start and an activity range as separate parameters
would model the vocabulary instead of the interaction.

### 14.2 The five temporal natures

Every published figure is exactly one of these. A figure that cannot be
classified is a figure whose question has not been settled, and it does not
enter this contract until it can be.

| nature | what it says | example in this contract |
|---|---|---|
| **Position** | what is true at one instant | `hero.netWorth` at the close of the reference month |
| **Flow** | what moved across a period | `ExpenseCard.totalAmount` |
| **Trend** | how a figure moved across a series of periods | — no field of this contract has this nature |
| **Accumulation** | what has built up since an origin | `InvestmentCard.realizedResult`, since the account opened |
| **Average** | the baseline a period is read against | the twelve-month mean of §8 |

**The nature belongs to the figure, not to the field name.** `totalAmount` on the
generic domain card of §5 is a Flow for income, expense and profit-and-loss, and
a **Position** for debt and pocket — those two do not sum a period's movements,
they state a balance at the close, which is exactly what §5.1 defines. One field
name, two natures; a client that assumes the first reading for all five will
misread two cards.

**Four of the five carry fields and one carries none.** The twelve-month series
is an input to the averages of §8 and is published as no figure of its own. That
absence is recorded here rather than left to a reader's inference: a trend is
level 2 work and nothing has been specified for it.

The full assignment, figure by figure, is `OVERVIEW_INDICATOR_MATRIX.md`.

### 14.3 What a domain owns, and what Overview owns

**Overview composes; it does not recalculate.** A figure's definition belongs to
the module that owns the data behind it, and Overview imports that service rather
than writing a second query producing the same name. This is the one-figure,
one-formula principle (`PLAN_OVERVIEW.md` §4.2) stated as an ownership rule, and
it is the rule §7 already applies to the consolidated card and D27 already
applies to the hero.

| figure | owner | how Overview gets it |
|---|---|---|
| the budget of the period, categorised spend, the variance | budget | imported, without opening the budget contract (D6) |
| the pocket target, what is committed, what remains, progress, the status counts | pocket | imported from `pocket_services`, never a query of Overview's own |
| the goals figures of §9 | pocket | the same service — a separate query here would be the fourth copy of one figure, and §13 already records three overlapping ones |
| the domain totals, counts and deltas of §5 | Overview | its own reads: no domain publishes a figure shaped for a card |
| net worth, liquid net worth, cash position, free cash | Overview | composed from the domain figures, because no single domain owns a figure that spans them |

**Overview owns exactly what no domain owns**, and that is a short list: the
figures that cross domains. Everything else it publishes is somebody else's
figure, restated by the same path.

**D27 states the composition; D54 corrects its terms.** Composing the hero from
the domain cards is still right, and it is why the hero inherits a domain's
corrections instead of repeating a formula. What D54 removes is the pocket term
from `netWorth` and from `cashPosition`: under the plan model an allocation is a
commitment recorded against a real account's balance and the money never leaves
it, so both figures already contain it through the bank term and adding
`pocket.totalAmount` counts the same money twice. Commitments belong to free cash
alone, floored per account before the sum.

**The failure this rule exists to prevent has already happened in this module.**
Net worth is computed in two places with a different number of terms — three on
the screen a person can see today, four in this payload — and the second is the
wrong one. Neither is an arithmetic mistake; both are a second path to one name.

### 14.4 One reading convention, so two formulas are not read as two sets

**Wherever a formula in this contract or in the matrix names `bank`, the term
includes `cash`** (D45): a cash account is a bank account for every purpose of
reading, and no formula distinguishes them. So the three-term net worth and the
`bank + cash` of the liquid figure describe the **same** account set, stated at
two levels of explicitness — the second spells the type out only because a figure
named *liquid* that appeared to omit cash would be read as excluding it.

This is a convention, not an implementation claim. §13 already records the code
side: the real-account set and the cash position exclude `cash` today and by D45
must include it.

---
## Registro de correcciones — 2026-08-30

Sólo mediciones. Ningún tipo, ninguna nulabilidad y ninguna decisión se
modificaron. Medido en `fix/auth-screen`, `e919a89`, árbol de trabajo incluido.

| sección | qué se corrigió |
|---|---|
| §5 | anclajes de `DebtCard` en `DebtsLayout.tsx`: `:44`/`:48` → `:50`/`:54`, ternario `:66` → `:75-79`; los dos anclajes de `ExpenseCard` reverificados sin cambio |
| §5.1 | la divergencia legacy se mantiene, pero `dashboardController.js:216-226` es hoy `:224-228` y **no lee `ua.account_balance`**: suma `derivedAccountBalanceSql`. Registrado además que `MONTHLY_BALANCE_QUERY` ~~de la rama sin fundir~~ sí ancla en la columna almacenada (`overviewBalanceRepository.js:47`) |
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

---

## Registro de correcciones — 2026-09-04

Sólo mediciones y una consecuencia de ellas. **Ningún tipo, ninguna nulabilidad
y ninguna decisión se modificaron.** Medido en `feat/vercel-serverless`, árbol de
trabajo incluido. No se leyó ninguna base de datos.

| sección | qué se corrigió |
|---|---|
| §5 | **marcados** los tres campos de la tarjeta de deuda que este contrato declara y el servidor no emite: las dos piernas de la posición y el conteo de deudores saldados. El tipo se conserva — son decisiones cerradas sin implementar, no afirmaciones que envejecieron |
| §5.1 · §5.2 | los dos anclajes dejan de decir "rama sin fundir": describen el árbol de trabajo desde el merge del 2026-09-02 |
| §11 | **marcada** la llave de distribución del gasto acumulado del año: declarada y no servida. El servicio de página publica dos llaves de gráfico y no tres |
| §11.1 | la fila de metas de ahorro deja de describir un defecto corregible antes de fundir y pasa a describir un defecto embarcado |
| §13 | la precisión del 2026-08-30 sobre "implementados" queda superada: cero commits sin fundir, y "implementado" hay que releerlo campo por campo — dos partes del contrato no lo están |

**Lo que sigue exacto y se dejó como estaba:** el envelope compartido, la
convención de avisos siempre-arreglo, la ventana de reporte con su rechazo de
**422 y no 400** para un mes posterior al actual —resuelto en un solo sitio
compartido por los dos manejadores a propósito, para que "más tarde que el mes en
curso" no tenga dos copias de las que sólo una se arreglaría—, y todos los demás
tipos de §4 a §12, verificados campo por campo contra los constructores de
`overview_services/core/`.

**Sin resolver:** los conteos sobre la base local que este archivo arrastra desde
agosto. Siguen sin recomprobarse; no se leyó ninguna base de datos.


---

## Cambio de tipo — 2026-09-04

**Este registro no es como los tres anteriores.** Los de 2026-08-30 y 2026-09-04
abren declarando que ningun tipo, ninguna nulabilidad y ninguna decision se
modificaron: eran mediciones. Este si modifica un tipo, y por eso se anota
aparte en lugar de colarse como una fila mas de una tabla de correcciones.

| seccion | que cambio |
|---|---|
| §11 · `ExpenseCategoryStatus` | tres campos nuevos al final del tipo: la suma corrida del plan, su cuota sobre el plan total y la bandera que dice si alguna fila quedo fuera de esa suma. Ninguno de los once campos anteriores cambia de forma ni de nulabilidad |

**Por que el plan por categoria no aparece en esa lista.** Ya estaba. Es
`budgetAmount`, el cuarto campo del tipo, que llega tal cual desde el modulo de
presupuesto (`makeBudgetCategoryStatus.js:82-89`) y que este contrato declara
desde su primera version. La peticion del desarrollador —el plan de cada
categoria dibujado junto a su gasto— no cuesta ningun campo nuevo en el
servidor; cuesta un elemento mas en el bloque que lo dibuja.

**Requisito de frontend que este cambio crea.** El bloque de distribucion del
gasto pinta dos barras por categoria, no una: la del gasto y la del plan, la
segunda al lado de la primera, con el mismo origen y la misma escala, de modo que
pasarse del plan se lea como una diferencia de longitud. Las dos curvas
acumuladas se distinguen **por color y por textura a la vez**, no solo por el
patron de trazo. La regla que las ordena a las dos es el gasto, y el bloque tiene
que decirlo: una categoria pequena en gasto y grande en plan hace subir la curva
del plan justo donde la del gasto ya esta plana, y un lector que suponga dos
curvas comparables malinterpreta exactamente ese tramo. Reordenar para que la
curva del plan parezca un Pareto queda prohibido — serian dos ordenaciones de las
mismas filas en una pantalla, que es el defecto que §4.2 existe para evitar.

**Lo que falta y no lo trae este registro.** Los tres campos estan declarados
aqui y **no estan implementados**: `makeCategoryBreakdown.js:66-82` sigue
acumulando solo el gasto. Es una deuda del mismo tipo que las dos que §13 ya
arrastra —contrato por delante del servidor—, no una afirmacion que envejecio.
