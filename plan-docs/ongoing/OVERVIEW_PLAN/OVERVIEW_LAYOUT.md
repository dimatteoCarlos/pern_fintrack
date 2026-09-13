# Overview — layout and render contract

**The single presentation document, written 2026-09-07 and rewritten in English on
2026-09-13.** Its companion is `OVERVIEW_INDICATORS.md`, which says what is measured
and why. This one says **how it is drawn**: for each block on screen, which
published field it comes from, on which endpoint and at which depth, with the exact
payload shape.

> **Consolidation done 2026-09-13.** The note of 2026-09-09 scheduled this file to
> move to English and absorb two documents. Both landed that day:
> `OVERVIEW_CHART_TECHNIQUE.md` (how a chart is drawn) is **section 8**, and
> `OVERVIEW_LEVEL3.md` (which entity each row opens) is **section 9**. The two
> source files remain, each with a header pointing here. The castellano body of
> this file was translated whole; nothing was dropped except text the two folded
> documents repeated.
>
> **Implementation reference for charts:** `docs/charts/SVG_CHARTS_GUIDE.md`, the
> tracked repository guide to hand-drawn SVG charts.

Originally measured on the code of `feat/overview`; the states in sections 3, 5, 7,
8 and 9 were re-measured on `main` on 2026-09-13. Field names stay in English
because they are payload identifiers.

---

## 1. The three endpoints

All three hang from `/api/fintrack/overview`, behind the token check and the global
rate limiter declared in the app, so no route repeats them.

| endpoint | query it accepts | what it answers | screen |
|---|---|---|---|
| `GET /` | `month` | the whole page in one response | the Overview page |
| `GET /:domain` | `month`, `page`, `pageSize`, `analysis`, `category` | one domain in depth, with its own paginated list | the per-domain detail |
| `GET /activity` | `from`, `to`, `search`, `movementType`, `page`, `pageSize` | movements over a range the reader picks | the activity view |

Three things here condition the frontend:

- **The page is one request, not one per widget.** Six cards, the hero, the
  snapshot, the goals, the teaser and the two charts arrive together.
- **`/activity` is a literal segment declared before `/:domain`**, and the order
  carries behaviour. It is not a seventh domain and it takes a range, not a month.
  Both bounds are optional and the default is **unbounded**.
- **`analysis` is opt-in and belongs only to the per-domain endpoint.** The page
  endpoint **rejects** the parameter with a 400 naming the key, because its schema
  is strict.

### 1.1 The query schemas, exact

```ts
// GET /overview — strict. No page, no pageSize, no analysis:
// the page carries no paginated list, so asking for page 2 of it
// answers 400 naming the key.
type GetOverviewPageParams = {
 month?: string; // YYYY-MM, past or the running month only
};

// GET /overview/:domain — strict.
type GetOverviewDomainParams = {
 domain: 'income' | 'expense' | 'investment' | 'debt' | 'pocket' | 'pnl';
 month?: string;
 page?: number;     // default 1
 pageSize?: number; // server default, with a cap
 // Opt-in and the only parameter with no default. Absent means the response
 // HAS NO `analysis` key at all and is identical to the level-1 response from
 // before the parameter existed.
 //
 // An unrecognised value answers 400 naming the key; it is never read as
 // "no analysis": asking for a depth the server does not have is an error, and
 // silently serving a poorer payload would look like an empty result.
 analysis?: 'derived' | 'full';
 // Narrows ONLY the list (row 35). Served since 2026-09-11.
 category?: string;
};

// GET /overview/activity — strict.
// search and movementType added to this type on 2026-09-13 from
// overviewValidators.js:167-188; from/to are validated by `monthBound`
// (:167-168) — the name suggests month bounds, not re-read further.
type GetOverviewActivityParams = {
 from?: string;         // unbounded by default
 to?: string;           // unbounded by default
 search?: string;       // trimmed, min 1 character, capped length
 movementType?: string; // one of MOVEMENT_TYPE_NAMES
 page?: number;
 pageSize?: number;
};
```

`page` and `pageSize` carry defaults rather than being plain optionals: the
response always reports the window it served, so a client that sent neither still
receives the page it is looking at instead of having to assume it.

### 1.2 The two depths and what each costs

| depth | what it adds | what it costs |
|---|---|---|
| absent | nothing | the level-1 response |
| `derived` | everything already fetched, reshaped — the thirteen-month series, the expense split, the realised-result partition, the investment reconciliation, the per-pocket progress | **no extra statement** |
| `full` | income by source, contribution history and balance per investment account, the counterparty ranking, both legs month by month, and the committed-against-free decomposition | one new statement per domain |

**A screen that only draws a long line asks for `derived`. Only one that draws a
ranked breakdown needs `full`.**

### 1.3 The envelope, the same for all three

```ts
type ApiEnvelope<T> = { status: number; message: string; data: T };

type ApiErrorEnvelope = {
 status: number;
 message: string;
 errors?: { field: string; message: string; code: string }[]; // validation errors only
};

// Present in every section. notices is ALWAYS an array, never absent and
// never a loose string, so a component that iterates it needs no null
// check. provenance is null today, always.
type SectionMeta = {
 notices: string[];
 provenance: { grade: 'live' | 'cached' | 'synthetic'; source: string; fetchedAt: string | null } | null;
};

// The window is READ from the response, never rebuilt from the month. The
// server names the month it actually served, because a request that sends no
// month is answered with the running month of the owner's calendar and only
// the response knows which that is.
type PeriodWindow = {
 referenceMonth: string;  // YYYY-MM-01 — the served month, present even if the request did not name one
 periodStart: string;     // YYYY-MM-DD
 periodEnd: string;       // YYYY-MM-DD — in the running month this is TODAY, not the month end
 isCurrentMonth: boolean; // what decides the picker's conditional label
};
```

---

## 2. The level-1 page, block by block

A single `GET /` returns everything in this section.

```
┌──────────────────────────────────────────────────────────────────────┐
│  MONTH PICKER           [ ‹ ]  August 2026  [ › ]                    │
├──────────────────────────────────────────────────────────────────────┤
│  HERO                                                                 │
│    what is owned · how much is liquid · how much is cash ·           │
│    how much of that cash is unpromised                                │
│    ───────────────────────────────────────────────                    │
│    month flow  ·  savings rate                                        │
├──────────────────────────────────────────────────────────────────────┤
│  CONSOLIDATED CARD                                                    │
├───────────────────────────────┬──────────────────────────────────────┤
│  income    │  expense         │  investment  (OWN SHAPE)             │
│  debt      │  pocket          │  realised result                     │
├───────────────────────────────┴──────────────────────────────────────┤
│  SPEND DISTRIBUTION — bars + cumulative curve (Pareto)               │
├──────────────────────────────────────────────────────────────────────┤
│  MONTHLY SNAPSHOT — income · expense · pocket                         │
├───────────────────────────────┬──────────────────────────────────────┤
│  FINANCIAL GOALS              │  RECENT ACTIVITY (≤5)                │
└───────────────────────────────┴──────────────────────────────────────┘
```

The sketch is the 2026-09-07 plan. The mounted order differs and is measured in
section 5.0.

### 2.1 The month picker

It comes from the `window` of any section, and **the field it reads is
`referenceMonth`, not the month the component sent**: the request may name none,
and then only the response knows which was served. **The label is frontend work and
is conditional**, and `isCurrentMonth` decides it: when false it reads `August
2026`; when true it reads as **month to date**, ending at `periodEnd` — which in the
running month is today and not the month end, so a component printing the month
end would declare a period different from the one the figures were cut to. The
control picks a whole month in both cases — the fix is to the label, not to the
control.

The month is optional, past or running only, and defaults to the running month in
the account owner's calendar.

### 2.2 The hero — `hero`

```ts
type HeroSection = {
 netWorth: number;              // never null; bank + investment + debt. THREE terms, not four
 liquidNetWorth: number | null; // null + notice only if the payable leg did not arrive
 cashPosition: number;          // never null; bank AND cash, one figure
 freeCash: number;              // never null and never negative
 netMonthlyFlow: number;        // never null; negative is a real answer
 savingsRate: number | null;    // null + notice when income cannot be a denominator, NEVER 0
 currency: string;
 meta: SectionMeta;
};
```

| rendered | field | how an empty reads |
|---|---|---|
| what is owned | `netWorth` | never empty |
| what is owned and liquid | `liquidNetWorth` | dash + the notice explaining it |
| how much of that is cash | `cashPosition` | never empty |
| how much of that cash is unpromised | `freeCash` | never empty |
| whether the month moved forward or back | `netMonthlyFlow` | never empty; negative is painted as negative |
| that movement as a share of income | `savingsRate` | dash, **never 0%** |

**The new hierarchy is adopted whole.** It is not the old triad — net worth, cash,
flow — with a fourth figure bolted on: it is four positions answering a narrowing
question (*what do I have · how much of it is liquid · how much is cash · how much
of that cash is free*) and two flows below, separated by a rule, because movement
and position are two classes and the screen has to say so.

### 2.3 The consolidated card — `all`

```ts
type AllCard = {
 domain: 'all';
 netWorth: number;            // the hero's own value, passed through
 totalIncomePeriod: number;
 totalExpensePeriod: number;
 netDebtPosition: number;
 totalPocketBalance: number;
 transactionCountAll: number; // one count per domain — SIX since investment gained transactionCount (OVERVIEW_PLAN.md section 5)
 currency: string;
 window: PeriodWindow;
 meta: SectionMeta;
};
```

Built by `makeAllCard.js:52-69`. **Decided 2026-09-13: rendered, not retired**, as
variant A of `plan-docs/design-refs/overview-all-card-preview.html`. It is a card
above the domain cards on level 1 that folds like them. Net worth is the headline;
income and expense are flows; net debt (worded by sign) and pockets are positions.
The footer carries the month's movement count. It is being built that day as
`ConsolidatedCard`, reading `all` from the overview store (`OVERVIEW_PLAN.md`
section 6).

### 2.4 The six cards — `domainCards`

`domainCards` is an **object keyed by domain**, not an array: `income`, `expense`,
`investment`, `debt`, `pocket`, `pnl`.

**Five of the six share the base shape:**

```ts
type DomainCardBase = {
 domain: string;
 totalAmount: number;      // never null — 0 is real activity at zero
 transactionCount: number;
 delta: number | null;     // null + notice when there is no prior period (coverage 'none')
 // ...domain-specific fields go here...
 currency: string;
 window: PeriodWindow;
 meta: SectionMeta;
};
```

The 2026-09-09 rulings added `priorPeriodCoverage` (`complete` / `partial` / `none`)
and `priorTotalAmount` to this shape (`OVERVIEW_DECISIONS.md:2373-2451`); a partial
prior month still publishes a delta.

| card | own fields beyond the base |
|---|---|
| **income** | none |
| **expense** | `budgetAmount`, `categorizedExpense`, `budgetVariance` (all three `number \| null`), `hasUncategorizedExpense: boolean` |
| **debt** | `payable: number`, `receivable: number` (**both ≥ 0**), `settledCount: number` |
| **pocket** | `target`, `remaining`, `progress` (`number \| null`), `fundedCount`, `overdueCount`, `uncoveredCount` |
| **pnl** | `realizedFromInvestment: number` and `realizedFromBank: number` — **two lines subordinate to the total, never figures of the same weight**. Each is measured by its own `FILTER` (2026-09-09): the bank one is not the total minus the investment one, because that remainder includes debtors and pockets. They are not required to sum to the total and no total is drawn under them; a leg at zero is omitted rather than printed |

**`delta` is `null` when there is no prior period** — that is the skeleton-or-dash
case, not a zero.

**The pocket status line is one line, not three figures:**
`5 funded · 2 overdue · 1 uncovered`.

**Pocket `progress` is a rate over 100, not a 0-1 ratio.**

#### The sixth card — investment, own shape

```ts
type InvestmentCard = {
 domain: 'investment';
 accountCount: number;
 capitalContributed: number;
 ledgerBalance: number;
 realizedPnl: number;
 closureAdjustment: number;
 concentration: number | null;
 daysSinceLastContribution: number | null;
 transactionCount: number; // added when the page's count was found short; see OVERVIEW_PLAN.md section 5
 currency: string;
 meta: SectionMeta;
};
```

**No `totalAmount`, `delta` or `window`.** Besides `transactionCount`, it shares only
`domain`, `currency` and `meta` with the other five.

The builder states the reason: its figures **are not** a total, a count and a delta
— they are positions as of today, not a flow over a period. That is also why it has
no window: there is no period to label.

**It needs its own component, not the shared one with exceptions.** A shared
component breaks **only** on this card and **in several fields at once**: five
cards render and the sixth prints `undefined` or throws, which is the failure shape
that survives a review. If it needs to show a period, it takes it from the hero or
the consolidated card.

**What counts as a capital contribution — decided 2026-09-13.** An expense reversal
into an investment account (a transfer, movement type 6, out of a `category_budget`
account) **counts**: `contributions` and `last_funding` already include it
(`overviewInvestmentRepository.js:129-143`), and the identity ledger balance =
contributions + realised result + closure adjustment stays intact.

### 2.5 The monthly snapshot — `monthlySnapshot`

An array of **exactly three** entries: `income`, `expense` and `pocket`.

```ts
type MonthlySnapshotEntry = {
 domain: 'income' | 'expense' | 'pocket';
 domainMonthlyActual: number;
 activeMonthAverage3m: number | null;
 activeMonthAverage12m: number | null;
 activeMonths3m: number;             // the three-month average's denominator
 activeMonths12m: number;            // the twelve-month average's denominator
 varianceVsAverage: number | null;   // against the TWELVE, not the three
 yearToDate: number;                 // running calendar year, all months
 currency: string;
 meta: SectionMeta;
};
```

An owner with no history gets `null` in both averages and in the variance: **three
dashes, not three zeros.** Income figures are net of income reversals since
2026-09-13 (`incomeReversalSql.js`).

### 2.6 Financial goals — `financialGoals`

```ts
type FinancialGoals = {
 goalsTotalBalance: number;
 goalsTotalTarget: number | null;
 goalsTotalRemaining: number | null;
 currency: string;
 meta: SectionMeta;
};
```

Target and remaining are `null` **together** when no pocket has a target, and the
notice says which case it is: no target at all, or only some pockets with one.
Progress against a null target renders as a dash. Per-band counts ("target reached
/ in progress") are not served and are deferred to a later version.

### 2.7 Recent activity — `recentActivity`

`recentActivity.transactions` — an array of rows and nothing else. **No currency of
its own**, because each row carries its own.

Each row is the shape the module's six transaction lists share, twenty-four named
columns including `transaction_local_date`, the date stamped in the owner's zone and
**the one the list sorts and groups by**.

It is not bounded by the requested month: it answers "what happened last", not "what
happened in the month I am studying". Since 2026-09-09 the mounted block reads
`GET /activity` instead and this teaser has no reader (row 12).

### 2.8 The page's two charts — `charts`

```ts
type Charts = {
 trend: {
  income?: MonthlyTrendPoint[];
  expense?: MonthlyTrendPoint[];
  pocket?: MonthlyTrendPoint[];
 };
 expenseCategories: ExpenseCategoryStatus[];
};

type MonthlyTrendPoint = { month: string; value: number }; // month is 'YYYY-MM'
```

`charts.trend` carries **only** the three domains with a series. The other three
**do not have the key**, not an empty array — absent says the domain has no series;
empty would say it has one and it is blank. **The chart component branches on the
key's presence.**

---

## 3. The charts — Pareto, lines and donuts

### 3.1 The spend Pareto — served whole, at level 1

`charts.expenseCategories` **already is** the ranked, cumulative series. It needs no
depth parameter and no second request. The ranking is cut to the chosen month
(`overviewExpenseService.js:161-166`, ranked at `:228`).

```ts
type ExpenseCategoryStatus = {
 // the eight that come from the budget module, as they are
 categoryName: string;
 currency: string | null;           // null + notice if the category mixes currencies
 accountCount: number;
 budgetAmount: number | null;       // 0 if never budgeted
 actualSpent: number | null;
 remainingBudget: number | null;
 executionPercentage: number | null; // RATE OVER 100. null when the plan is 0
 isOverBudget: boolean | null;

 // the three the Pareto needs
 rank: number;                 // 1-based, spend descending, name breaks the tie
 cumulativeActual: number;     // the running total, same rounding rule as the rows
 cumulativePercentage: number; // 0-1 RATIO with four decimals

 // the plan drawn beside the spend
 cumulativeBudget: number;
 cumulativeBudgetPercentage: number; // 0-1 RATIO
 hasSkippedBudget: boolean;          // true if some earlier row had no plan
};
```

**Where it is drawn, measured 2026-09-13.**

| level | component | draws |
|---|---|---|
| 1 | `ParetoBar.tsx` and `DonutChart.tsx` via `ExpenseByCategory.tsx`, mounted at `Overview.tsx:628` | spend bars and the spend cumulative curve; the donut. No plan bar, no plan curve (`ParetoBar.tsx` never reads `cumulativeBudget`) |
| 2 expense | `CategoryBudgetPareto.tsx` at `ExpenseDomain.tsx:232-237` (`d898c7c0`, `f516f1ec`) | spend and plan bars side by side, both cumulative curves, and the execution rate. `ExpenseByCategory.tsx:54-56` records that level 2 mounts this **instead**, so the two screens do not repeat one reading |

**How it is drawn:**

- Bars from `actualSpent`. **Two bars per category**, not one: the spend and the plan
  (`budgetAmount`) beside it, same origin and same scale, so exceeding the plan reads
  as a difference in length. Built at level 2 (`CategoryBudgetPareto.tsx:293-294`).
- Cumulative curve from `cumulativePercentage`; the second curve from
  `cumulativeBudgetPercentage` (`CategoryBudgetPareto.tsx:149-157`). **The two curves differ by colour and
  by texture at once**, not by dash pattern alone.
- **The frontend sorts nothing.** The order is the server's. Reordering in the
  client is exactly how the bars and the cumulative line stop agreeing.
- **The rule ordering both curves is spend, and the block must say so.** A category
  small in spend and large in plan makes the plan curve rise just where the spend
  curve has flattened. **Reordering so the plan curve looks like a Pareto is
  forbidden**: that would be two orderings of the same rows on one screen.
- **A row with no plan does not enter the accumulation** and carries the running
  figure unchanged. Its last point means "the plan of the categories that have one",
  and `hasSkippedBudget` says whether that happened.
- A mixed-currency category carries `actualSpent: null`, ranks last and contributes
  0 to the running total. **The row is not dropped** — dropping it breaks the
  Pareto's reconciliation with the expense card total. It renders as a dash, with the
  notice as explanation.
- Deleted categories with real spend in the month are included, so the sum of
  `actualSpent` reconciles exactly with the card total.
- **Level 2 stops the drawing where spending reaches 100%:** a category with no
  spend adds no bar and no step (`CategoryBudgetPareto.tsx:101-105`, `f516f1ec`); the
  totals still read every category.

**Served since 2026-09-08.** `cumulativeBudget`, `cumulativeBudgetPercentage` and
`hasSkippedBudget` are built by `makeCategoryBreakdown.js` in the same pass as the
two spend fields, over the same ordering.

**A precision on the flag, because the contract states it more loosely.**
`hasSkippedBudget` is true **including the row that skips**, not only from the next
one. The flag exists to say whether the running figure printed beside it covers
every row up to that point, so the row that breaks it is the one that must raise it.

**A row with a plan of 0 is not skipped.** `budgetAmount` is null only when the
category mixes currencies; a zero plan is a decision and enters the accumulation
contributing 0.

#### The execution rate — decided 2026-09-13

- **The level-2 Pareto's rate divides categorised spending:** the last ranked row's
  `cumulativeActual` over its `cumulativeBudget`, so the rate and the chart head
  cannot disagree.
- **Why:** Carlos, 2026-09-13: *"lo que estamos presentando es gastos con
  categoria"*. Uncategorised spending is stated under the chart, not ranked
  (`CategoryBudgetPareto.tsx:180`, `:417-419`).
- **The expense card divides total spending, on purpose:** its
  `executionPercentage` is `totalAmount / budgetAmount` (`DomainCards.tsx:232-240`,
  ruling of 2026-09-08), the universe `budgetVariance` is measured over.
- **Served since 2026-09-13 (`e1c19f9f`), no longer client arithmetic:**
  `makeCategoryBudgetExecution.js:18-34` builds it, `overviewExpenseService.js:234`
  publishes it as `categoryExecution`, `CategoryBudgetPareto.tsx:165-171` reads it,
  and `categoryBudgetExecution.test.js` tests it.

```ts
// GET /overview/expense → categoryExecution. null when there is no category.
type CategoryBudgetExecution = {
 spentAmount: number;
 budgetAmount: number;
 executionPercentage: number | null; // RATE OVER 100; null when no budget is set
 remainingBudget: number;            // negative by the overrun when overspent
 isOverBudget: boolean;
};
```
- **Deferred:** a year-to-date reading per category is not served, and the client
  may not sum months (D40).

### 3.2 Trend lines — six points on the page, thirteen in the analysis

The card's six-point series is the **tail** of the analysis's thirteen, not a second
fetch, so the two **cannot report different values for a month both contain**. On
level 2 the thirteen-month series replaces the six-month trend (P5-6).

| domain | 6-point `trend` (page) | 13-point `analysis.series` |
|---|---|---|
| income | yes | yes |
| expense | yes | yes |
| pocket | yes | yes |
| pnl | **no** | yes — drawn with a signed variant, because `TrendCharts.tsx` draws `Math.abs` (P5-6) |
| debt | **no** — the `publishesTrend: false` flag denies it | **no** — carries `legsOverTime` |
| investment | **no** | **no** |

**The pocket series is POSITIONS, not flows**: the committed balance at each month
close. The last point is exactly the card figure. A flow series would put "80
committed" under a card saying "1,200 committed in total": two numbers on one card
with no relation between them.

**A series shorter than the cut is served whole and never padded**: an owner with
three months of history has three points, and padding would draw three months in
which nothing happened.

For income and expense a month with no activity **does** publish `0`, because for a
flow zero is real. For pocket, a stock, the equivalent is carrying the balance
forward with no gaps.

### 3.3 Donuts — four ranked distributions

| donut | field | depth | label of each part |
|---|---|---|---|
| income by source | `bySource` + `concentration` | `full` | `accountName`, `null` when the income is unattributed |
| investment by account | `balanceByAccount` | `full` | `accountName` |
| debt by counterparty | `byCounterparty` | `full` | `accountName`, plus `direction` |
| pocket by pocket | `progressByPocket` | `derived` | `name` |

The frozen level-2 mockup draws these four as ranked rows with one bar ink, not as
rings (P5-6: "bar ink — one ink, no categorical colour"); the level-1 expense donut is
the only ring mounted.

**The first three come from the shared distribution builder:**

```ts
type DistributionPart = {
 accountId: number | null;
 accountName: string | null;
 accountIsClosed?: boolean; // income by source, added 2026-09-13
 label: string;          // the sort tiebreak
 amount: number;
 rank: number;           // 1-based
 share: number | null;   // 0-1 RATIO with four decimals
};
```

**`share` is a 0-1 ratio with four decimals, not a percentage.** Four and not two:
with two decimals every source contributing less than half a percent rounds to
`0.00` and reads as a part that contributed nothing, which is the one thing a
distribution cannot say about a row it is publishing. The frontend multiplies and
formats.

**`share` is `null` — never 0 — when the total is zero:** a share of nothing is a
division with no answer, and 0 would read as "this part contributed nothing" for a
part that is the whole of an empty set.

**Exception 1 — debt by counterparty does not use that builder.** It carries `rank`
but **no `share`**, because it is ordered by **absolute magnitude** of the balance:
a receivable of 500 and a payable of 500 weigh the same in the ranking. Its shape is
`{accountId, accountName, balance, direction, rank}`, and `direction` names where the
money runs.

**Exception 2 — per-pocket progress is different in kind.** It is the Pocket board
rows republished verbatim: `pocketId`, `name`, `note`, `target`, `allocated`,
`remaining`, `progress`, `desiredDate`, `planStart`, `daysRemaining`,
`requiredMonthly`, `movedInMonth`, `committedInMonth`, `releasedInMonth`, `funded`,
`overdue`, and the status classification. It carries `progress` as a **rate over
100** and **no `rank`**. A component treating it like the other three prints each
pocket at **a hundred times** its size.

**The expense donut is the Pareto rows read as parts of a whole**, so it needs no
fifth statement.

---

## 4. The per-domain detail — level 2

Every per-domain response has this shape:

```ts
type GetOverviewDomainData = {
 card: DomainCardBase | InvestmentCard;
 transactions: {
  rows: MovementTransactionRow[];
  page: number;
  pageSize: number;
  totalRows: number;
 };
 trend?: MonthlyTrendPoint[];            // income, expense, pocket only
 categories?: ExpenseCategoryStatus[];   // expense only
 categoryExecution?: CategoryBudgetExecution | null; // expense only, since 2026-09-13 (section 3.1)
 analysis?: DomainAnalysis;              // ABSENT if no depth was asked for
};

// The three fields every analysis section shares.
type AnalysisBase = {
 domain: string;
 level: 'derived' | 'full';
 meta: { notices: string[] };
};
```

### 4.1 What each domain carries, by depth

| domain | at `derived` | added at `full` |
|---|---|---|
| **income** | `series` (13 pts) | `bySource` (ranked, with `share`), `concentration` |
| **expense** | `series`, `categorization` | — |
| **pnl** | `series`, `byAccountType` | — |
| **pocket** | `series`, `progressByPocket` | `committedAgainstFree` |
| **investment** | `reconciliation` | `balanceByAccount` (ranked, with `share`), `contributionHistory` |
| **debt** | — *(only the wrapper with its notice)* | `byCounterparty`, `legsOverTime` |

**Debt at `derived` publishes only `domain`, `level` and a notice saying this
analysis needs the full depth.** It is not an error: it is the honest answer of a
domain whose two analyses are both the expensive ones.

**The request sequence on screen (P5-3, P5-6):** one `derived` request paints the
screen; ONE `full` request fires when the first `full` section reaches the viewport
and resolves every `full` section. Built: `useFullAnalysisTrigger.ts:10`, called at
`AnalysisPanel.tsx:76`.

### 4.2 The shape of each analysis

```ts
// income
type IncomeAnalysis = AnalysisBase & {
 series: MonthlyTrendPoint[];       // 13 points
 bySource?: DistributionPart[];     // full
 concentration?: number | null;     // full — the share of the largest source
};

// expense
type ExpenseAnalysis = AnalysisBase & {
 series: MonthlyTrendPoint[];
 categorization?: { categorized: number; uncategorized: number };
};

// pnl — byAccountType ALWAYS present when analysis was asked for
type PnlAnalysis = AnalysisBase & {
 series: MonthlyTrendPoint[];
 // bank added 2026-09-13; other = total − investment − bank
 byAccountType: { investment: number; bank: number; other: number };
};

// pocket
type PocketAnalysis = AnalysisBase & {
 series: MonthlyTrendPoint[];       // POSITIONS at each month close
 progressByPocket?: PocketBoardRow[];
 committedAgainstFree?: {           // full
  bankBalance: number;
  committed: number;
  freeCash: number;
  flooredShortfall: number;
 };
};

// investment — reconciliation ALWAYS present when analysis was asked for
type InvestmentAnalysis = AnalysisBase & {
 reconciliation: {
  capitalContributed: number;
  realizedPnl: number;
  closureAdjustment: number;
  ledgerBalance: number;
  difference: number;   // the first three minus the fourth
  tolerance: number;    // below this, the identity is considered to hold
 };
 balanceByAccount?: DistributionPart[];  // full
 contributionHistory?: {                 // full
  rows: { transactionId: number; accountId: number; accountName: string; amount: number; contributionDate: string }[];
  totalRows: number;
 };
};

// debt
type DebtAnalysis = AnalysisBase & {
 byCounterparty?: {                      // full
  accountId: number;
  accountName: string;
  balance: number;
  direction: string;
  rank: number;
 }[];
 legsOverTime?: { month: string; receivable: number; payable: number }[]; // full
};
```

### 4.3 Three shapes that must be drawn with the right reading

A component that misreads them is wrong **in a way that still looks plausible**,
which is the worst kind.

- **`committedAgainstFree` has three terms that do not add up, on purpose.** Free
  cash is floored per account before summing, so one account's surplus cannot absorb
  another's shortfall. `flooredShortfall` is exactly what that floor cost and is the
  field explaining the gap. It is always shown, `$0.00` included (P5-6). A client
  given two of the three that computes the third is wrong precisely for the owner
  who most needs it right.
- **`legsOverTime` carries both legs POSITIVE**, so whoever plots the two lines never
  has to invert one. A month with no debtors reports `0` in both instead of
  disappearing — a missing month bends the line between its neighbours.
- **`contributionHistory` is the newest page of a history with no lower bound.** It
  carries `totalRows` beside it for that reason: a reader who cannot tell the page
  from the whole would read "fifty contributions" from an owner who made five
  hundred. Rendered as "Latest N of totalRows", no pager (P5-6).

### 4.4 The activity view

`GET /activity` returns `transactions`, the `range` it actually served and `filters`
with the term and movement type it applied. It is the only screen of the module
whose period **the reader chooses**, and both bounds are optional, defaulting to
unbounded.

**All three narrowings are served; none is filtered in the client.** The term goes
in `search` and the type in `movementType`, so `totalRows` answers for the whole set.
A filter over the page in hand would say "3 of 5" while the account has two thousand
movements.

**`filters` is returned for the same reason as `range`.** Five rows out of two
thousand is not a short list, it is a filtered list, and only the server can say
which of the two the reader is looking at.

**The term is literal, not a pattern.** The query uses `strpos(lower(...))` and not
`ILIKE`: with `ILIKE` a `%` or `_` the reader types would be wildcards, and searching
`50%` would return every row.

Closed accounts' movements are shown since 2026-09-13, marked `"<name> (closed)"`
(`RecentActivity.tsx`, worklog D1).

---

## 5. Master table of render tasks

One row per block the frontend has to build. **`state` does not say whether the
component exists**, it says whether the data it needs is published today. The two
questions were separated on purpose: a block can be served and undrawn, and drawn
against a field that later changes shape.

The sentence that opened this section — "none exists yet" — was true on 2026-09-07
and stopped being so. What is built is measured below in 5.0 and not annotated row
by row, so this table keeps answering one question.

### 5.0 What is built, re-measured 2026-09-13

Measured by reading the mounts, not the file list: a component that exists and that
nobody mounts is not built. Line numbers replace those of the 2026-09-11 measurement,
which had shifted.

| rows | block | component | where it is mounted |
|---|---|---|---|
| 1, 2 | hero, position and flow | `BigBoxResult.tsx`, `HeroIndicators.tsx` | `OverviewLayout.tsx:178`, `:186` |
| 29 | month picker with the running-month label | `MonthPicker.tsx` (label at `:206`) | `OverviewLayout.tsx:135-143` |
| — | account balances, reads `hero` | `AccountBalance.tsx` | `Overview.tsx:568` |
| 9 | investment card | `InvestmentAccBalance.tsx` (imported as `InvestmentAccountBalance`, `Overview.tsx:31`) | `Overview.tsx:578` |
| 4-8 | the six domain cards | `DomainCards.tsx` | `Overview.tsx:604`, hidden in an empty month (`:591-613`) |
| 10 | monthly snapshot | `MonthlySnapshot.tsx` | `Overview.tsx:611`, hidden in an empty month |
| 11 | financial goals | `FinancialGoals.tsx` | `Overview.tsx:618` |
| 15 | trend lines | `TrendCharts.tsx` | `Overview.tsx:621` |
| 13 | spend Pareto | `ParetoBar.tsx` via `ExpenseByCategory.tsx` | `Overview.tsx:628`, hidden in an empty month |
| 34 | month share donut | `DonutChart.tsx` via `ExpenseByCategory.tsx` | `Overview.tsx:628` |
| 12 | recent activity | `RecentActivity.tsx` | `Overview.tsx:644` |
| 17, 35 | per-domain list and its filter | `OverviewDomain.tsx`; `CategoryFilter` at `ExpenseDomain.tsx:243`, with the level-3 link at `:185-191` | route `:domain`, `App.tsx:310` |
| 14 | Pareto — plan bar and plan curve | `CategoryBudgetPareto.tsx` | `ExpenseDomain.tsx:232-237` (level 2 only) |
| 18 | 13-point series | `DomainSeries` | e.g. `ExpenseDomain.tsx:222-228` |
| 19-28 | the level-2 analysis sections | `AnalysisPanel.tsx` | `IncomeDomain.tsx:56`, `InvestmentDomain.tsx:187,217,246`, `DebtDomain.tsx:73,104`, `PocketDomain.tsx:124,170`, `PnlDomain.tsx:57` |

**What the measurement found unbuilt.**

- **Row 3, the consolidated card, has no reader and the store does not hold it.** No
  component reads `all`, and the frontend declares no type or store field for it, so
  the whole stretch from store to screen is missing. It stays **SERVED** by the
  endpoint, which is what its row asserts. Decided 2026-09-13: built as the folding
  `ConsolidatedCard` above the domain cards (variant A), in progress that day.
- **Row 29, the picker's conditional label — BUILT 2026-09-13 (`c7e80bda`).** The
  2026-09-11 measurement found `isCurrentMonth` read only for two card footers
  (`AccountBalance.tsx:115`, `InvestmentAccBalance.tsx:122`). Now
  `OverviewLayout.tsx:39-41` reads `window.isCurrentMonth`, passes it at `:141`,
  and `MonthPicker.tsx:206` appends "· to date".
- **Row 14 at level 1:** not drawn, by design — level 2 draws it instead
  (`ExpenseByCategory.tsx:54-56`). The 2026-09-11 note that it was undrawn is closed.

| # | render task | field it comes from | endpoint · depth | state |
|---|---|---|---|---|
| 1 | Hero — 4 position figures | `netWorth`, `liquidNetWorth`, `cashPosition`, `freeCash` | `GET /` · level 1 | **SERVED** |
| 2 | Hero — 2 flow figures | `netMonthlyFlow`, `savingsRate` | `GET /` · level 1 | **SERVED** |
| 3 | Consolidated card | `all` | `GET /` · level 1 | **SERVED** — no reader yet; `ConsolidatedCard` being built 2026-09-13 (variant A) |
| 4 | Income card | `domainCards.income` | `GET /` · level 1 | **SERVED** |
| 5 | Expense card, with budget | `domainCards.expense` + `budgetAmount`, `categorizedExpense`, `budgetVariance`, `hasUncategorizedExpense` | `GET /` · level 1 | **SERVED** |
| 6 | Debt card, two legs | `domainCards.debt` + `payable`, `receivable`, `settledCount` | `GET /` · level 1 | **SERVED** |
| 7 | Pocket card, total and status line | `domainCards.pocket` + `target`, `remaining`, `progress`, `fundedCount`, `overdueCount`, `uncoveredCount` | `GET /` · level 1 | **SERVED** |
| 8 | Realised result card | `domainCards.pnl` + `realizedFromInvestment` | `GET /` · level 1 | **SERVED** |
| 9 | Investment card | `domainCards.investment` — **own shape** | `GET /` · level 1 | **SERVED, with its own component** |
| 10 | Monthly snapshot, 3 domains | `monthlySnapshot[]` | `GET /` · level 1 | **SERVED** |
| 11 | Financial goals | `financialGoals` | `GET /` · level 1 | **SERVED** |
| 12 | Recent activity, with search, filter and pagination | `GET /activity` → `transactions` + `range` + `filters` | `GET /activity` | **BUILT 2026-09-09** — `RecentActivity.tsx`. The page's `recentActivity.transactions` teaser has no reader |
| 13 | Spend Pareto — spend bars and cumulative curve | `charts.expenseCategories` with `rank`, `cumulativeActual`, `cumulativePercentage` | `GET /` · level 1 | **SERVED** |
| 14 | Pareto — plan bar and second curve | `budgetAmount` + `cumulativeBudget`, `cumulativeBudgetPercentage`, `hasSkippedBudget` | `GET /:domain` expense · `categories` | **SERVED** since 2026-09-08 — **DRAWN at level 2** by `CategoryBudgetPareto.tsx` (`d898c7c0`, `f516f1ec`) |
| 15 | Trend lines, 6 points | `charts.trend.income`, `.expense`, `.pocket` | `GET /` · level 1 | **SERVED — 3 of 6 domains only** |
| 16 | Activity screen with range | `GET /activity` → `transactions` + `range` | `GET /activity` | **ABSORBED BY ROW 12** — the level-1 block already picks its period |
| 17 | Paginated per-domain list | `transactions{rows, page, pageSize, totalRows}` | `GET /:domain` · level 1 | **SERVED** |
| 18 | Long series, 13 points | `analysis.series` | `?analysis=derived` | **SERVED — 4 of 6 domains**; drawn at level 2 |
| 19 | Income by source | `analysis.bySource` + `concentration` | `?analysis=full` | **SERVED**; drawn at level 2 |
| 20 | Investment by account | `analysis.balanceByAccount` | `?analysis=full` | **SERVED**; drawn at level 2 |
| 21 | Debt ranking by counterparty | `analysis.byCounterparty` with `direction` | `?analysis=full` | **SERVED — no `share`, ordered by magnitude**; drawn at level 2 |
| 22 | Per-pocket progress | `analysis.progressByPocket` | `?analysis=derived` | **SERVED — `progress` on a 0-100 scale**; drawn at level 2 |
| 23 | Committed / free decomposition | `analysis.committedAgainstFree` (4 terms) | `?analysis=full` | **SERVED**; drawn at level 2 |
| 24 | Investment reconciliation | `analysis.reconciliation` (6 terms) | `?analysis=derived` | **SERVED**; drawn at level 2 |
| 25 | Contribution history | `analysis.contributionHistory{rows, totalRows}` | `?analysis=full` | **SERVED**; drawn at level 2 |
| 26 | Realised result partition | `analysis.byAccountType{investment, bank, other}` | `?analysis=derived` | **SERVED**; drawn at level 2 |
| 27 | Categorised / uncategorised split | `analysis.categorization` | `?analysis=derived` | **SERVED** |
| 28 | Two debt legs over time | `analysis.legsOverTime` | `?analysis=full` | **SERVED**; drawn at level 2 |
| 29 | Month picker with conditional label | `window{referenceMonth, isCurrentMonth, periodStart, periodEnd}` from any section | `GET /` · level 1 | **SERVED; label BUILT 2026-09-13** (`MonthPicker.tsx:206`, `c7e80bda`) — `isCurrentMonth` is the field that decides it |
| 30 | Fetch states: skeleton, error, empty | `meta.notices` + the absent/`null`/`0` semantics | all | **SERVED — the frontend applies the rule** |
| 31 | Realised result card sparkline | — | — | **NOT SERVED** — that card has no 6-point `trend` |
| 32 | Debt over time, single field | — | — | **DOES NOT EXIST BY DECISION** — row 28 is drawn |
| 33 | Investment portfolio over time | — | — | **DOES NOT EXIST** — investment has no series at any depth |
| 34 | Month spend share donut | `charts.expenseCategories` — **the Pareto rows read as parts of a whole**, no new field | `GET /` · level 1 | **SERVED** — uncategorised spend stays out of the ring by D48: it is outside the ranked set, so a slice would count it twice |
| 35 | Category filter on the level-2 list | `category` in the `GET /:domain` query; membership comes from `getBudgetAccountsStatus` rows | `GET /:domain` · level 1 | **SERVED since 2026-09-11** — narrows **only the list**: card, curve and ranking stay the whole month's |

### 5.1 The gaps, stated as gaps

| gap | consequence on screen | remedy |
|---|---|---|
| ~~the two plan curves in the Pareto are not implemented~~ **CLOSED** | drawn at level 2 by `CategoryBudgetPareto.tsx` (`d898c7c0`); the server fields have existed since 2026-09-08 | — |
| the realised result card has no 6-point `trend` | that card cannot draw a sparkline from the page payload | ask the per-domain endpoint for `derived` and cut the last six points, or keep the card to figures |
| debt has no series at any depth | no single-field "debt over time" line | draw `legsOverTime` as two positive lines at `full`. **It is the decision, not the lack** |
| investment has no series at any depth | no portfolio-over-time line | the reconciliation, balance per account and contribution history are what that card has. A time series needs a new statement and is not in this plan |

---

## 6. Rules the payload imposes on components

These are not style preferences. A component that ignores them prints a wrong
number.

- **Absent, `null` and `0` are three different statements.** Absent = the question
  was not asked. `null` = it was asked and has no answer. `0` = the answer is zero. A
  missing figure renders as a skeleton or a dash, **never** as `0` or `NaN`.
- **The three fetch states are three**: loading (skeleton), error (message and
  retry) and empty. They are not one state with different text.
- **Never reorder, never re-sum.** The rank comes from the server with an explicit
  tiebreak. Every share is taken against the figure the card published.
- **Scales do not mix.** `share` and both `cumulative*Percentage` are 0-1 ratios with
  four decimals; the Pocket board's `progress` and the budget's
  `executionPercentage` are rates over 100.
- **The window is read from the response**, never rebuilt from the month.
- **The month label is conditional** on the chosen month.
- **Currency lives in the section**, not in the app; list rows carry their own.
- **Notices are rendered.** A card that paints figures and discards notices loses
  the explanation of every dash it shows. On level 2 they sit at the foot of the
  section they qualify, in secondary ink, italic (P5-6).
- **Colours come from tokens.** The sketches this document replaced carried raw hex
  values; a sketch may, a stylesheet may not. A missing token does not stall a block:
  add what the component needs and normalise later (Carlos, 2026-09-08).

---

## 7. What was open for the frontend — settled

All three items this section listed as open are answered (re-measured 2026-09-13).

| question | answer |
|---|---|
| which card owns the Pareto | **level 1, its own section below the cards** (D47, `OVERVIEW_DECISIONS.md:675-704`), at `Overview.tsx:628`; the plan-against-spend reading lives on level 2 expense (`ExpenseDomain.tsx:232-237`) |
| six screens or three | **six level-2 screens**, separate from the Budget, Pocket and Debts boards (P5-1, `OVERVIEW_DECISIONS.md:2187-2223`); route `:domain`, `App.tsx:310` |
| the missing colour tokens | **add the token the component needs and normalise later** (Carlos, 2026-09-08, `OVERVIEW_DECISIONS.md:2330-2331`) |

**This document adds no backend requirement.** Row 14, its only one, has been served
since 2026-09-08. The Pareto's execution rate became a served field on 2026-09-13
(`categoryExecution`, section 3.1).

---

## 8. How a chart is drawn in this module

**Folded from `OVERVIEW_CHART_TECHNIQUE.md` on 2026-09-13.** That document was written
2026-09-08 from the one chart then shipped, `TrendCharts.tsx`, with its rules in
`overview-styles.css`. It is a technique section, not a design one: what a chart looks
like is decided in the mockups and in `OVERVIEW_DECISIONS.md`; this says how it is
made. **The implementation reference for new charts is
`docs/charts/SVG_CHARTS_GUIDE.md`** (coordinates §3, scales §4, marks §5, labels §6,
colour §7, responsive width §8, accessibility §10, checklist §12).

### 8.0 Two geometries are in use, re-measured 2026-09-13

| chart | geometry | anchors |
|---|---|---|
| trend lines, `TrendCharts.tsx` | a 0-100 square stretched to the card (8.2) | `TrendCharts.tsx:36` `PLOT_PADDING`, `:185` `role='img'`, `:197` `viewBox='0 0 100 100'`, `:204`, `:213` `vectorEffect`; rules at `overview-styles.css:534-618` |
| level-2 budget Pareto, `CategoryBudgetPareto.tsx` | user units drawn 1:1 in a measured box, so text keeps its token size; the chart scrolls below a minimum group width | `CategoryBudgetPareto.tsx:32` (`MIN_GROUP_WIDTH`), `:84` (measured `availableWidth`), `:115-124` (group and bar width), `:240` `viewBox={\`0 0 ${width} ${height}\`}`; the method is `SVG_CHARTS_GUIDE.md` §8.2-8.5 |
| month share donut, `DonutChart.tsx` | a square `viewBox` in its own units, so the ring scales with its box | `DonutChart.tsx:36`, `:106` |

Sections 8.2-8.4 bind the stretched-box chart. Everything else in section 8 binds
all of them.

### 8.1 The decision everything follows from: no chart library

The trend line is a `<polyline>` in an inline `<svg>` and the point markers are
ordinary elements with a position. No dependency was added.

**Why, and when that stops being right.** A library earns its place when there is a
coordinate system to draw — axes with ticks, a legend, zoom, a brush, a tooltip that
follows the pointer across a continuous domain. A six-point line over named months
has none of that. Six numbers do not need a runtime.

Three gains, and they are the reason to keep the rule:

- **`var(--token)` resolves on an element and on an SVG attribute alike.** A library
  that paints from a JavaScript colour array puts every colour outside the design
  system, and the theme switch stops reaching it.
- **Every value stays a DOM node.** A month can carry a `title`, a link, a focus
  ring. A canvas renderer gives back one rectangle with no parts.
- **The page weighs nothing extra.** Overview is the first screen after login.

**The line at which to reconsider:** a chart that needs hit-testing against a
continuous axis, or more than a few hundred points. Neither exists in this module;
the level-2 series is thirteen points.

### 8.2 The plot box: a 0-100 square, stretched

```
viewBox='0 0 100 100'  preserveAspectRatio='none'
```

The plot is authored in a 100 by 100 square and stretched to whatever the card gives
it. Every coordinate the component computes is therefore a **percentage of the
plot**, never a pixel, and the same arithmetic serves a 320px phone and a 900px card
with no breakpoint.

Three consequences, all load-bearing:

- **The stroke must not scale.** A stretched box scales the stroke with it, so the
  line would be thicker on a wide card than on a narrow one, and thicker horizontally
  than vertically. `vectorEffect='non-scaling-stroke'` on the `polyline` keeps it one
  width. **Not optional in a stretched box.**
- **A round marker cannot be an SVG circle.** A circle in a stretched box comes out
  an ellipse. The markers are `<span>` elements positioned over the plot in
  percentages, outside the SVG, where `border-radius` still means a circle. (The 1:1
  budget Pareto may use SVG circles, because its box is not stretched.)
- **Nothing may touch the edge of the box.** Stroke and markers are drawn in real
  pixels centred on their coordinate, so a point at 0 or 100 is cut in half. The band
  is inset:

```ts
const PLOT_PADDING = 10;              // percent of the plot, at each end
const PLOT_BAND = 100 - PLOT_PADDING * 2;
```

Every vertical coordinate is then `PLOT_PADDING + ratio * PLOT_BAND`, never
`ratio * 100`.

### 8.3 Two readings of one ratio, because two axes run opposite ways

A point is computed once as a 0-1 ratio and read twice:

```ts
y:      PLOT_PADDING + (1 - ratio) * PLOT_BAND,   // svg, grows DOWNWARD
bottom: PLOT_PADDING + ratio * PLOT_BAND,          // css, placed from the FLOOR
```

The SVG y axis grows down from the top and a CSS `bottom` grows up from the floor.
Deriving one from the other rather than computing two ratios keeps the marker on the
line: two independent computations are two chances to round differently.

### 8.4 A point sits at the CENTRE of its cell, not at a division of the width

```ts
const positionX = (index, count) => ((index + 0.5) / count) * 100;
```

**Not `index / (count - 1)`.** The axis under the plot is a row of equal cells with
the month name centred in each, so a divide-by-gaps layout puts the first point on
the card's left edge with its month name half a cell away. The `+ 0.5` puts the
point over its label.

The axis row therefore carries **no `gap`**, and each cell is `flex: 1` with
`text-align: center`. A gap there and the labels drift out from under their points,
progressively, the last one worst. The budget Pareto applies the same centring in
user units: `xCenter = PAD_LEFT + groupWidth * index + groupWidth / 2`
(`CategoryBudgetPareto.tsx:146-147`).

### 8.5 Scale: per series, from zero

```ts
const peak = Math.max(...points.map((p) => Math.abs(p.value)), 0);
const ratioOf = (value, peak) => (peak <= 0 ? 0 : Math.abs(value) / peak);
```

- **Against this series' own peak, not a scale shared across charts.** Income and
  expense differ by an order of magnitude for most owners, and a shared scale
  flattens the smaller onto the axis. Each chart answers *how did this domain move*;
  *which domain is bigger* is answered by the cards' figures.
- **From zero, not from the smallest month.** Starting at the minimum makes a point's
  height its rank in the window rather than its size, so a flat year renders as
  dramatic movement.
- **`peak <= 0` returns 0 rather than dividing.** An all-zero series is a real flat
  line at the floor; the alternative is a division by zero — the invented number the
  money rules forbid.
- **`Math.abs` is wrong for a signed series.** Profit and loss needs a signed trend
  variant, or a loss reads as a gain (P5-6).
- **A readable axis top:** the budget Pareto rounds the tallest bar up to 1, 2, 2.5 or
  5 times a power of ten (`axisCeiling`, `CategoryBudgetPareto.tsx:54`; `SVG_CHARTS_GUIDE.md` §4).

### 8.6 Accessibility, and why the `title` is not enough

The plot container is the accessible object:

```tsx
<div className='trendChart__plot' role='img'
     aria-label={`${label}, last 6 months. ${plotted.map(p => p.title).join('. ')}`}>
```

- **The whole series goes in the label.** A screen reader and a keyboard user both
  get every figure, the same information the pointer gets by hovering.
- **The `<svg>` is `aria-hidden`.** It is the same information a second time.
- **The markers keep their `title`** for the pointer, and that is all a `title` is: it
  is not announced on its own and the markers are not focusable.
- **The chart is never `aria-hidden` as a whole.** It carries figures; it is not
  decoration.

### 8.7 Tokens, and the declared exceptions

Every colour, radius and size comes from `var(--token)`: `--color-accent` for the
stroke and the marker, `--space-1` for the marker size, `--radius-full`,
`--color-border-subtle`, `--font-size-xs`.

Two values in the trend chart were not tokens when measured on 2026-09-08, and both
said so in the stylesheet (not re-measured 2026-09-13):

- **`stroke-width: 2`** — no stroke-width token. The card border is declared at `1px`
  the same way, so the line is set at twice that.
- **`letter-spacing: 0.65px`** on the axis labels.

**The rule when a chart needs a value with no token** (Carlos, 2026-09-08): add the
token the component needs and normalise later. Do not stall, and do not hardcode a
raw value inside a rule — declare the token, use it, and say in the commit that it
awaits normalisation.

**The categorical ramp now exists.** The distribution bar reads
`--color-scale-category-*` (`Overview.tsx:625-626`); the 2026-09-08 note that the ramp
was missing is closed. Colour encodes magnitude, never rank or state (P5-4).

### 8.8 The trap that costs an hour if it is not known

`index.css` sets `font-size` on the **universal selector**. An inline element
therefore does not inherit the size of its line — it takes 16px from the universal
rule. Every text node inside a chart that should take its parent's size restates:

```css
font-size: inherit;
```

`overview-styles.css:611-618` carries it on the trend axis span; without it the six
month names render at twice their size and touch each other.

### 8.9 Fetch states, said in the shape of the data

`TrendCharts` reads the absence of a key as the statement:

```ts
const drawn = SERIES.filter(({ key }) => charts.trend[key] !== undefined);
if (drawn.length === 0) return null;
```

- **An absent key means the domain has no series.** Three of the six never carry one.
- **An empty array would mean something else** — it has a series and the months came
  back blank — and the two must not render alike.
- **A month with a value of 0 is a real point** and is drawn. Dropping it bends the
  line between its neighbours.
- **A missing figure is a skeleton or a dash, never `0` and never `NaN`.**

### 8.10 Currency comes off the card, never from a constant

```ts
const currency = domainCards?.income.currency ?? DEFAULT_CURRENCY;
```

Every figure is stored in the accounting currency and the cards publish it per
domain. Read it from the payload so a tooltip cannot name a currency the figures are
not in. The budget Pareto takes `card.currency` (`CategoryBudgetPareto.tsx:98-99`).

### 8.11 The technique applied to further shapes

Nothing below needs a new mechanism. State as of 2026-09-13 in the last column.

| shape | what it adds | the one thing to get right | state |
|---|---|---|---|
| **a second line over the first** — plan cumulative curve over spend | a second `<polyline>` in the SAME `<svg>`, its own class | the two curves differ by **two** codes, not one: colour plus dash, or value plus texture | **built**, `CategoryBudgetPareto.tsx:149-157` |
| **a bar per category** — the distribution | elements, not SVG; a row whose width is `${share * 100}%` | a sub-pixel segment stays visible: a `min-width` makes a 0.2% category a sliver, not nothing | **built** at level 1, `ParetoBar.tsx` |
| **plan beside spend** | two bars in one group | both bars share **one origin and one scale**, or the overshoot stops reading as a length. An outline is `background: transparent` with a border, never a pale fill | **built side by side** at level 2, `CategoryBudgetPareto.tsx:293-294` |
| **two series side by side** — the debt legs | two charts sharing a peak, or one chart with two polylines | the one case where a **shared** peak is right: the question is whether one leg is bigger than the other. State it in the component | not re-measured |
| **a cumulative percentage axis** | a second scale, 0-100, on the right | a cumulative curve is a ratio ending at 1, so it does NOT share the money scale; label the second scale or the reader takes the curve for money | **built**, `SHARE_TICKS` at `CategoryBudgetPareto.tsx:49` |

**What none of them gets.** No animation on first paint of a figure — a number that
counts up is unreadable while it moves. No gradient fill under a line. No gridlines
behind a six-point series; there is nothing to align against.

### 8.12 Checklist before a chart is called done

- A stretched box is `viewBox='0 0 100 100'` with `preserveAspectRatio='none'`, and
  every stroke carries `vectorEffect='non-scaling-stroke'`; a 1:1 box measures its
  width and follows `SVG_CHARTS_GUIDE.md` §8.
- No round marker in a stretched box is an SVG circle.
- Every coordinate is inset by the padding band; nothing sits at the box edge.
- Points are centred in their cells and the axis row has no `gap`.
- The scale starts at zero, and the choice of shared or per-series peak is stated in
  the component with its reason.
- The plot carries `role='img'` and an `aria-label` holding every figure; the drawing
  inside is `aria-hidden`.
- Every colour and size is a `var(--token)`; any exception is declared where it sits.
- Every text node inside the chart restates `font-size: inherit`.
- An absent series and an empty series render differently, and neither renders as `0`.
- The currency is read from the payload.

---

## 9. Level 3, the entity depth

**Folded from `OVERVIEW_LEVEL3.md` on 2026-09-13.** That document was written
2026-09-08, measured on `main`. It exists because `OVERVIEW_PLAN.md` once carried a
single row saying level 3 was "not Overview", which conflated who computes the entity
figures with who navigates to them; only the first is true.

**This is P5 work, not a gate.** It specifies navigation wiring and sits on no
critical path of the stages that fix the figures.

### 9.1 What level 3 is, and which half belongs to Overview

Level 3 answers **what explains this entity**: one debtor, one investment account,
one pocket, one category, one income source.

| half | owner |
|---|---|
| computing the entity's figures | the owning module — Budget, Pocket and the account screens |
| **routing from a level-2 row to that entity** | **Overview** |

Overview owns the second half because the level-2 row is where the user decides which
entity to open, and the row is Overview's payload. A breakdown whose rows cannot be
opened is a ranking the user can read and not act on.

**Level 3 requires no new Overview calculation and no entity endpoint.** It consumes
identity fields already in the level-2 payload and navigates to the owning module's
existing screen. This is a statement about level 3, not a rule against Overview
endpoints in general — the activity view has its own endpoint for unrelated reasons.

**The two paths stay independent (P5-1):** `Overview -> level 2 of a domain -> level 3
of an entity`, and separately `Budget -> the category`. A reader who starts at a board
reaches the entity without passing through Overview.

### 9.2 The six domains — five navigate, profit and loss does not

Routes re-measured in `App.tsx` on 2026-09-13; links built by
`frontend/src/fintrack/pages/overview/helpers/levelThreeLink.ts`.

| domain | level-2 source | identity field | route (`App.tsx`) | link builder | wired at |
|---|---|---|---|---|---|
| debt | `analysis.byCounterparty[]` | `accountId` | `debts/debtor/:debtorId`, `:407` | `debtorLink`, `levelThreeLink.ts:29-32` | `DebtDomain.tsx:97` |
| investment | `analysis.balanceByAccount[]` | `accountId` | `overview/account/:accountId`, `:386` (the reading variant) | `accountLink`, `:16-25` | `InvestmentDomain.tsx:239` |
| income | `analysis.bySource[]` | `accountId`, nullable | `overview/account/:accountId`, `:386` | `accountLink` | `IncomeDomain.tsx:92-96` |
| pocket | `analysis.progressByPocket[]` | `pocketId` | `pocket/pockets/:pocketId`, `:415` | `pocketLink`, `:35-38` | `PocketDomain.tsx:163`; also `OverviewDomain.tsx:118` |
| expense | `charts.expenseCategories[]` / `categories[]` | `categoryName` | `budget/category/:categoryName`, `:437` | `categoryLink`, `:46-53` | `ExpenseDomain.tsx:185-191` — **wired 2026-09-13** (`79eb08d0`), from the category selected in the level-2 filter, not from each ranked row |
| profit and loss | `analysis.byAccountType` | — | — | — | — |

The destination folders exist under `frontend/src/fintrack/pages/forms/`:
`debtorDetail`, `accountDetail`, `pocketDetail`, `categoryDetail`. **Route paths are
implementation inputs, not open decisions:** read each from `App.tsx`, never infer it
from a folder name.

The debt route names its parameter `:debtorId` and `DebtorDetailReading.tsx:81` reads
it back as the account id, so the row's `accountId` passes through unchanged
(`levelThreeLink.ts:27-28`).

#### The null and closed cases in income

`makeIncomeAnalysis.js:61` (measured 2026-09-08) pushes a notice when a source row
carries `accountId === null`. That row is income with no source account attributed;
it has an amount and a share and is a real part of the distribution.

- **A null id is a valid row that is not navigable.** No id is invented for it. It is
  labelled "Unattributed", static, never linked (P5-6; `IncomeDomain.tsx:80-81`), and
  the component branches on the id, not on the notice.
- **A closed source keeps its name and loses its link** (2026-09-13): its
  `user_accounts` row is gone and `getAccountById` answers 404, so the row reads
  `"<name> (closed)"` unlinked (`IncomeDomain.tsx:84-95`).

#### Pocket — the id is a pocket id and is never converted

Measured 2026-09-08, because this module has a history of confusing the two: the
board row carries `pocketId` and nothing derives it from an account.
`makePocketStatus.js` validates it as an integer at :96-98 and throws rather than
coerce, publishes it at :139, and `pocketBoardService.js:419-422` spreads that object
into every board row, which is what `progressByPocket` passes through.

**Acceptance test:** every pocket level-2 row renders its link directly from the
published `pocketId`, with no account id conversion and no lookup between row and
URL.

#### Why expense routes by name and not by id

A category in this schema is not a row — it is a **name shared by N `category_budget`
accounts**. `budgetCalculationService.js:261-269` groups the account rows by
`categoryName` and publishes `accountCount` as the group size, discarding the ids.

That is enough to navigate. `App.tsx:437` declares `budget/category/:categoryName`,
and `CategoryAccountList.tsx` resolves the category by comparing
`account.categoryName === categoryName` against the live account list (`:86`,
measured 2026-09-08). The name travels in the same lowercased form on both sides —
migration 013 lowercased the stored values, and both readers read that column.

The deeper route, `App.tsx:449` `budget/category/:categoryName/account/:accountId`,
opens one account, and `CategoryDetail.tsx` refuses to render without `accountId`
(`:69-75`, measured 2026-09-08). Overview cannot address it directly, so a category
with exactly one account still lands on a list holding one row.

**That extra step is accepted and not a gap.** Publishing an `accountIds` array on the
category rows would remove it, and one click on a screen that already works is not
worth a change to a builder three modules away.

**No `previousRoute` on the category link.** `CategoryAccountList.tsx:297` builds its
own child links from that value, so an Overview path there would break them; the
month travels as `?month=` instead, because that screen reads it from its own URL
(`levelThreeLink.ts:43-52`).

#### The category name is navigation identity, not display text

Because the name is the route parameter, it has to survive being placed in a URL
segment.

- **The two existing Budget builders still interpolate it raw**, re-measured
  2026-09-13: `CategoryDetail.tsx:86` and `CategoryDetailReading.tsx:89` write
  `` `/fintrack/budget/category/${categoryName}` ``. Migration 013 lowercases the
  stored name but restricts no character, so a name holding `/`, `#` or `?` breaks
  those routes.
- **Overview encodes what it puts in a URL segment and decodes what it reads back.**
  Built: `categoryLink` applies `encodeURIComponent` (`levelThreeLink.ts:50-52`). This
  is the rule for Overview's link, not a request to change the two Budget screens.

#### Why profit and loss has no level 3

Its `analysis.byAccountType` is a three-part split — `investment`, `bank` (bank and
cash) and `other`, the third added 2026-09-13 — and no part is an entity. The domain
is a **movement type**, not a set of accounts: `makePnlAnalysis.js` partitions one sum
by where the rows landed, so the parts are groupings of accounts of different types
and there is nothing single to open.

**A movement having landed in an account does not make the split a list of
entities.** No `profit and loss → account` navigation is fabricated for symmetry. A
user following the investment part arrives at the investment domain, which has its
own level 3.

### 9.3 How the navigation is built

One rule, five applications: **the level-2 row carries its own identity, and the
component reads it from the row rather than reconstructing it.**

- **Ruled out:** a component that takes a name off the row, searches the account list
  for a match and builds the route from what it found, when the backend already
  published the id.
- **The destination URL is derived from the row at the point of navigation.** Not
  held in a store, not duplicated in local state: the clicked row is the only input
  the URL needs. A click that sets an id, runs an effect, performs a lookup and then
  navigates is four steps replacing one.
- **The back arrow returns to level 2 on the month being studied:** the link carries
  `state.previousRoute` (`levelThreeLink.ts:9-11`), except the category link (9.2).
- **The destination is another module's screen, so Overview does not restyle it.** A
  level-3 commit that changes the target screen has left Overview.

### 9.4 State, re-measured 2026-09-13

The 2026-09-08 version said the visual treatment waited on a level-2 mockup that did
not exist. The mockup exists and is frozen, and both halves are largely built.

| half | state |
|---|---|
| **technical wiring** — identity off the row, URL, navigation | **all five built** (table in 9.2); expense landed 2026-09-13 (`79eb08d0`) |
| **visual treatment** — how a navigable row reads as navigable, its states, where the affordance sits | **mockup frozen** 2026-09-12 (`bosquejo-overview-nivel-2-dominios.html`, P5-6; the routing table and the four row states approved in P5-4). Built as `LevelThreeRow.tsx` with a `levelThreeRow--linked` and a `levelThreeRow--static` variant (`:110`, `:123`); hover, focus-visible and active at `overview-domain-styles.css:466-484`. Pocket rows take two lines — name and amount, then bar and "of its goal" (P5-6) |

**There is no frontend test in this repository** (P5-5): links are verified by hand.

### 9.5 Verification

- Every routable domain names the **field** carrying the id, not the concept.
- No level-3 link is wired against a folder name; the path comes from `App.tsx`.
- The income row with a null `accountId` renders as a row and not as a link; so does a
  closed source.
- The pocket link is built from `pocketId` with no account id in the path.
- The category name is encoded into the URL segment and decoded out of it.
- No figure is computed in Overview for a level-3 screen. If one is needed, it belongs
  to the owning module and this file is the wrong place for it.
