# PLAN — Overview refactor

> ⏳ **TRIGGER — do not open until this fires.**
> Fires when the budget branch **merges to production** (`PLAN_PRODUCTION_MERGE.md`),
> not merely when it is code-complete. Overview's Expense domain card consumes
> whatever `budget_services` returns; building against a shape still in flight in
> `feat/budget` risks a second rewrite. Independent of budget otherwise.

**Written 2026-08-20.** `plan-docs/ongoing/` is re-included by `.gitignore:123`: this file is versioned.

**Supersedes three documents.** `OVERVIEW_REFACTOR.md` recorded three successive
iterations of the same idea and never marked one final; it also concatenated
unrelated budget-module status content. `FINTRACK_OVERVIEW_CLAUDE_CODE_SPEC.md`
retracted every concrete artifact it produced (its JSON contract is all `null`,
its two directory trees are annulled on the next line, and its §2.1 forbids
implementing from it at all) — its four guard rules survive here as §4.
`OverviewSintesis.md` is the architecture below. This file is the merge, plus
the one thing none of the three had: **measured terrain**.

---

## 1. Verdict

Domain-based hierarchy — Overview → Domain → Transaction — not a flat widget
list, and not a `movement_type`-keyed hierarchy. Financial semantics segment the
cards; the database schema does not.

The refactor is not cosmetic. The measurement below shows the current screen
issues **16 GET requests per mount**, computes net worth by adding four
different currencies with no conversion, and paints two of its status indicators
from `Math.random()`.

> **Corrected 2026-08-30.** All three counts dropped; none of the three defects
> went away. Commit `b40c4b8` *fix(overview): remove every pocket read*
> (2026-08-30) deleted `SavingGoals.tsx` and the three pocket requests — the
> layout's pocket balance, the savings goals and the pocket movement list. Today
> the screen issues **13 GET requests per mount**, net worth adds **three**
> currencies with no conversion (`OverviewLayout.tsx:134-135`), and **one**
> status indicator is painted from `Math.random()` (`MonthlyAverage.tsx:144`).

---

## 2. Measured terrain, 2026-08-20

Everything in this section was read from the code. Every claim carries an anchor.

### 2.1 The module

`frontend/src/fintrack/pages/overview/` — 13 files, 2 of them CSS.

| file | lines | kind |
|---|---|---|
| `Overview.tsx` | 483 | child route element; renders 11 widgets |
| `OverviewLayout.tsx` | 261 | parent route element; 6 `useFetch`, computes net worth |
| `CalculateMonthlyAverage.ts` | 179 | client-side aggregator (92-179 are commented sample data) |
| `overviewFetchAll.ts` | 352 | `Promise.allSettled` fan-out orchestrator |
| `components/AccountBalance.tsx` | 144 | fetches bank accounts, renders tiles |
| `components/InvestmentAccBalance.tsx` | 181 | fetches investments, computes a P/L percentage |
| `components/BigBoxResult.tsx` | 37 | presentational; the only widget `OverviewLayout` owns |
| `components/LastMovements.tsx` | 66 | card title + `ListContent`; exports `LastMovementType` |
| `components/MonthlyAverage.tsx` | 128 | three cards from the computed averages |
| `components/SavingGoals.tsx` | 134 | the one widget that only formats server figures |
| `components/transactionDetailModal/TransactionDetailModal.tsx` | 187 | the overview copy of the movement modal |

No types file: every type is declared inline where it is used
(`Overview.tsx:44-78`, `CalculateMonthlyAverage.ts:7-26`, `LastMovements.tsx:7-23`,
`overviewFetchAll.ts:54-86`).

> **Inventory re-measured 2026-08-30.** The tree is now **12 files, 2 of them
> CSS**. `components/SavingGoals.tsx` no longer exists — deleted by `b40c4b8`
> *fix(overview): remove every pocket read*. Corrected line counts and roles:
>
> | file | lines then | lines today | what changed |
> |---|---|---|---|
> | `Overview.tsx` | 483 | **430** | renders **9** widgets, not 11 |
> | `OverviewLayout.tsx` | 261 | **233** | **5** `useFetch`, not 6 |
> | `overviewFetchAll.ts` | 352 | **337** | one endpoint fewer |
> | `components/MonthlyAverage.tsx` | 128 | **165** | grew with `4c6299e` *feat(overview): show the year to date* |
> | `components/transactionDetailModal/TransactionDetailModal.tsx` | 187 | **186** | — |
> | `components/SavingGoals.tsx` | 134 | **gone** | deleted |
>
> `CalculateMonthlyAverage.ts` (179), `AccountBalance.tsx` (144),
> `InvestmentAccBalance.tsx` (181), `BigBoxResult.tsx` (37) and
> `LastMovements.tsx` (66) are unchanged. The inline-type anchors move to
> `Overview.tsx:45-73` and `overviewFetchAll.ts:53-63, :78-81`;
> `CalculateMonthlyAverage.ts:7-26` and `LastMovements.tsx:7-23` still hold.

**Blast radius is small.** Only four import sites outside the tree:
`App.tsx:42`, `App.tsx:45`, `ListContent.tsx:18`, `ListContent.tsx:25`. Nothing
else in the codebase imports `CalculateMonthlyAverage`, `overviewFetchAll` or any
overview component. This is what makes the refactor tractable.

> **Still true 2026-08-30.** The four anchors are exact and no fifth import site
> appeared.

### 2.2 The render list is flat

`Overview.tsx:407-481` renders 11 widgets as direct children of
`.cards__presentation`, which declares no flex and no grid
(`generalStyles.css:236-242`), so they stack in document order at one level:

`SavingGoals` (`:424`) · `MonthlyAverage` (`:427`) · `OpenAddEditBtn` (`:430`) ·
`AccountBalance` (`:439`) · `InvestmentAccountBalance` (`:442`) · then six
`LastMovements` titled `(expense)` `(debts)` `(income)` `(pocket)`
`(investment)` `(PnL)` at `:448`, `:453`, `:459`, `:465`, `:470`, `:475`.

`AccountBalance` and `InvestmentAccBalance` each return a bare fragment
(`AccountBalance.tsx:98-140`, `InvestmentAccBalance.tsx:81-177`), so their title
and `<article>` flatten into the same sibling row.

> **Re-measured 2026-08-30.** The flatness holds; the anchors moved.
> `.cards__presentation` is now at `generalStyles.css:272-278` and still declares
> only width, margin, radius and padding — no flex, no grid. The render list is
> `Overview.tsx:360-428` and carries **9** widgets, not 11: `SavingGoals` and the
> `(pocket)` movement list are gone. The order is `MonthlyAverage` (`:377`) ·
> `OpenAddEditBtn` (`:383`) · `AccountBalance` (`:392`) ·
> `InvestmentAccountBalance` (`:395`) · then **five** `LastMovements` titled
> `(expense)` `(debts)` `(income)` `(investment)` `(PnL)` at `:401`, `:406`,
> `:412`, `:418`, `:423`. The two bare fragments are still bare, at
> `AccountBalance.tsx:97-142` and `InvestmentAccBalance.tsx:80-177`.

### 2.3 Sixteen requests per mount

Two waves, separated only by the auth check. Both fan out in parallel.

**Wave A — 7 requests, no auth gate.** `OverviewLayout` calls `useFetch` six
times at top level; each owns its own effect keyed on `[url]`
(`useFetch.ts:26`), so six hooks in one component flush six effects in one
commit. Same controller, six different `?type=`:

| # | site | request |
|---|---|---|
| 1-6 | `OverviewLayout.tsx:37,52,69,86,102,118` | `url_get_total_account_balance_by_type` × `income_source`, `category_budget`, `bank`, `investment`, `pocket_saving`, `debtor` |
| 7 | `InvestmentAccBalance.tsx:43-47` | `url_get_accounts_by_type?type=investment` |

**Wave B — 9 requests, gated on `isCheckingAuth`.** `Overview.tsx:158-164` fires
`overviewFetchAll`, which is an explicit fan-out at `overviewFetchAll.ts:194-199`:

| # | site | request |
|---|---|---|
| 8 | `Overview.tsx:84` | balance by type, `pocket_saving` |
| 9 | `Overview.tsx:89` | `url_monthly_TotalAmount_ByType?type=expense` |
| 10-15 | `Overview.tsx:94,99,104,109,114,119` | `dashboardMovementTransactions` × six `&movement=` values |
| 16 | `AccountBalance.tsx:41-50` | `url_get_accounts_by_type?type=bank` |

**Facts that decide the contract:**

- **Request 8 duplicates request 5 exactly.** `?type=pocket_saving` is fetched
  twice per mount from two components, producing two independent copies in state.
- **Six near-identical movement requests** differ only by `&movement=`, and each
  lands on `dashboardController.js:457-874` — 418 lines with a per-movement
  `switch` building 7+ SQL variants at `:555-825`.
- **No cache, no retry, no invalidation.** `useFetch` has one effect on `[url]`.
  Nothing refetches after a transaction is written.
- **Six independent loading flags**, ORed at `OverviewLayout.tsx:219-225`, plus a
  seventh at `Overview.tsx:144`. Two spinners can be on screen at once
  (`OverviewLayout.tsx:235-242` and `Overview.tsx:410-422`).
- **One failed request blanks the screen.** `Overview.tsx:400` renders a bare
  `<div className='error-message'>` and nothing else. `OverviewLayout.tsx:178-201`
  ORs six error strings into one banner that auto-dismisses after 2s.
- **Navigating to an account tile remounts all 16.** The tiles link relative
  (`AccountBalance.tsx:118`, `InvestmentAccBalance.tsx:124`), resolving to
  `overview/accounts/:accountId` — declared **beside** `<Layout />` at
  `App.tsx:318-325`, not inside `OverviewLayout`. Going back is a cold start.

> **Re-counted 2026-08-30 — thirteen requests, and the duplicate is gone.**
> Site by site, after `b40c4b8`:
>
> - **Wave A, 6 requests.** Five `useFetch` in `OverviewLayout.tsx:36, 51, 68,
>   85, 101` — `income_source`, `category_budget`, `bank`, `investment`,
>   `debtor`; the sixth, `pocket_saving`, was removed. Plus
>   `InvestmentAccBalance.tsx:43-50`.
> - **Wave B, 7 requests.** Six entries in `overviewKPIendpoints`
>   (`Overview.tsx:76-107`) — `url_monthly_TotalAmount_ByType?type=expense`
>   (`:79`) and five `dashboardMovementTransactions&movement=` (`:84`, `:89`,
>   `:94`, `:99`, `:104`; the `pocket` one was removed). Plus
>   `AccountBalance.tsx:43-50`.
>
> Corrections to the four bullets and the two tables above:
>
> - **The `pocket_saving` duplicate no longer exists.** Both copies were removed,
>   so acceptance criterion §7.2 has nothing left to fix here.
> - **`useFetch` does have a retry.** Its effect is at `useFetch.ts:45` and keys
>   on `[url, attempt]` (`:132`), and the hook returns a documented `refetch()`
>   (`:17`, `:41-43`, `:134`). Cache and invalidation are still absent; "one
>   effect on `[url]`, no retry" is false and `useFetch.ts:26` is not the effect.
> - **Five loading flags ORed, not six** (`OverviewLayout.tsx:192-197`), plus the
>   seventh at `Overview.tsx:128`. Two spinners can still be on screen at once
>   (`OverviewLayout.tsx:207-214`, `Overview.tsx:363-375`).
> - **Five error strings ORed**, not six (`OverviewLayout.tsx:153-158`), still
>   auto-dismissed after 2 s (`:151-183`). One failed request still blanks the
>   screen at `Overview.tsx:353`.
> - The `dashboardMovementTransactions` controller is now
>   `dashboardController.js:465-902`, its per-movement `switch` at `:560`.
> - The account detail route is `App.tsx:321-328`, still declared beside
>   `<Layout />`. Going back is still a cold start — of 13, not 16.

### 2.4 The financial arithmetic happens in the browser

This is the defect the refactor exists to remove. Note there is **no `.reduce(`
anywhere** under `pages/overview/` — the summation uses `+=` in a `for…of`, which
is why a `.reduce(` search misses it.

**A. Net worth adds four currencies with no conversion.**
`OverviewLayout.tsx:154-158` adds bank + pocket + investment + debtor balances.
Each response carries its own `currency_code` (`responseApiTypes.ts:8-16, 28-42,
68-80`). There is no FX helper on the frontend to fix it with. The figure is
arithmetically meaningless the moment two accounts differ in currency — and
`BigBoxResult.tsx:28` then formats all three totals with `defaultCurrency`,
discarding whatever currency they were.

**B. A copy-paste bug in the same payload.** `OverviewLayout.tsx:216` guards on
`totalIncome` and emits `totalExpense`. Also `:165`
(`netWorthRaw == 0 ? 0 : netWorthRaw`) is a no-op, and `:133` flips the income
sign in a view component.

**C. The monthly average is computed client-side end to end.**
`CalculateMonthlyAverage.ts:56` sums, `:66-72` counts unique months, `:82-84`
divides. The server ships N rows per month per category per currency
(`responseApiTypes.ts:450-459`); the browser aggregates them. Then
`MonthlyAverage.tsx:73-83` applies a **second** sign flip, by a different rule
than the one at `OverviewLayout.tsx:133`.

**D. The investment P/L percentage can never be non-zero.**
`InvestmentAccBalance.tsx:100-117` divides by `account_starting_amount`, but the
mapper at `:52-63` copies eight fields and that is not one of them. The field is
optional on the type (`responseApiTypes.ts:191`), so TypeScript does not
complain: `capital` is always `0`, the `else` at `:114-117` always wins, and
every tile has always shown `% Profit 0` with a permanently green square.
Separately `:139-143` and `:151-155` render the same value twice, labelled
"Capital Invested" and "Factual Balance".

**E. Two status indicators are random numbers.**
`MonthlyAverage.tsx:106-108` and `SavingGoals.tsx:79-81` both paint
`alert={0.5 - Math.random() < 0 ? 'alert' : ''}`. Each re-render re-rolls.
`SavingGoals.tsx:36` renders the literal string `'status prediction'` as a value;
`MonthlyAverage.tsx:81` renders the literal `'% status'`.

**F. FX arithmetic inside the overview modal.**
`TransactionDetailModal.tsx:94` computes `1 / transaction.exchange_rate`.
`:48` labels the hero amount with the app default instead of the row's own
`currency_code` — a defect the sibling modal documents at
`AccountTransactionDetailModal.tsx:123-126`. `:59-60` looks the movement name up
in a client table (`helpers/constants.ts:70-80`) though the payload carries
`movement_type_name`.

**G. Split currency constant.** `helpers/constants.ts:54` reads
`VITE_ACCOUNTING_CURRENCY_CODE`; `helpers/currencyConstants.ts:22` hardcodes
`'usd'`. `TransactionDetailModal.tsx:7` imports the hardcoded one; every other
overview component imports the env-driven one. If the env var is ever set to
anything else, the modal and the page disagree.

**H. 185 lines of reshaping.** `Overview.tsx:186-371` holds six near-identical
blocks renaming the same five fields. Five use
`Array.from({ length: N }, (_, i) => ...)`; the debt one alone uses `.map()`
(`:223`). No arithmetic — it exists only because the payload shape and the prop
shape disagree.

**I. What is already right.** `SavingGoals.tsx:26-31` destructures
`total_balance`, `total_target`, `total_remaining` from the response and only
formats them. It is the one widget the browser does no arithmetic in, and it is
the model the rest should follow.

> **Re-measured 2026-08-30, point by point.**
>
> **A — three currencies, not four.** `OverviewLayout.tsx:134-135` adds bank +
> investment + debtor; the pocket term was removed by `b40c4b8`. The defect is
> unchanged in kind: still no conversion, and `BigBoxResult.tsx:28` still labels
> all three totals with `defaultCurrency`.
>
> **B — all three still there, moved.** The copy-paste guard is
> `OverviewLayout.tsx:189` (guards `totalIncome`, emits `totalExpense`); the
> no-op is `:141`; the income sign flip is `:116`.
>
> **C — moved.** `CalculateMonthlyAverage.ts:56` sums, `:68-71` counts unique
> months, `:82-84` divides. The second sign flip is `MonthlyAverage.tsx:101`
> (`incomeFactor`), with a third at `:66` on the year-to-date total added by
> `4c6299e`.
>
> **D — unchanged.** `InvestmentAccBalance.tsx:100-117` still divides by a field
> the mapper at `:54-63` never copies; `:114-117` still always wins; `:139-143`
> and `:151-155` still render `account_balance` twice.
>
> **E — one random indicator, not two.** `SavingGoals.tsx` is deleted, so the
> only survivor is `MonthlyAverage.tsx:144`. The literal `'% status'` is now
> `MonthlyAverage.tsx:108`; the literal `'status prediction'` died with
> `SavingGoals.tsx`.
>
> **F — unchanged.** `TransactionDetailModal.tsx:94` computes
> `1 / transaction.exchange_rate`; `:59` looks the movement name up in
> `helpers/constants.ts:68-80`.
>
> **G — the split constant is real, the anchor moved.**
> `helpers/constants.ts:52` reads `VITE_ACCOUNTING_CURRENCY_CODE`;
> `helpers/currencyConstants.ts:22` still hardcodes `'usd'`;
> `TransactionDetailModal.tsx:7` still imports the hardcoded one.
>
> **H — five reshaping blocks, not six.** `Overview.tsx:171-325`, ~155 lines:
> four use `Array.from` (`:178`, `:239`, `:271`, `:302`) and the debt one alone
> uses `.map()` (`:209`). The pocket block is gone.
>
> **I — THE MODEL WIDGET NO LONGER EXISTS.** `SavingGoals.tsx` was deleted by
> `b40c4b8` *fix(overview): remove every pocket read* on 2026-08-30, together
> with the savings-goals request that fed it. There is now **no widget in the
> tree that only formats server figures**, so §2.4I names no model for the rest
> to follow. Three passages rest on this and are flagged below rather than
> rewritten: the deprecation row that says *keep* it (§6), the acceptance
> criterion that leans on it, and the KPI catalog's §4, which reuses G1-G3 "tal
> cual" from `SavingGoals.tsx:26-31`.

### 2.5 The duplicated modal

| | overview copy | account-detail copy |
|---|---|---|
| path | `pages/overview/components/transactionDetailModal/TransactionDetailModal.tsx` | `pages/forms/accountDetailSharedComponents/accountTransactionDetailModal/AccountTransactionDetailModal.tsx` |
| lines | 187 (+404 CSS) | 382 (+370 CSS) |
| class prefix | `fx-*` | `transactionDetail__*` (BEM) |
| consumers | 1 — `ListContent.tsx:25` | 4 — Account, Category, Debtor, Pocket detail |

**Props are identical** (`:11-14` vs `:26-29`). The account copy is strictly
better on the three things that matter: it reads the row's own currency
(`:126`), it builds the date from `transaction_local_date` + `_time` to dodge the
UTC-midnight off-by-one (`:52-67`, documented at `:48-51`), and it reads
`movement_type_name` off the payload (`:166`). The split is deliberate and
documented at `AccountTransactionDetailModal.tsx:6-9`.

**Six instances mount at once.** `ListContent` mounts one `useTransactionDetail()`
(`:39-40`) and one modal (`:92-95`) per instance; Overview renders six
`LastMovements` → six `ListContent` → **six modals and six hooks with
independent state**.

> **Re-measured 2026-08-30.** The split still stands and the account copy is
> still the better one, but it was rewritten and every anchor moved. It is now
> **312 lines (+372 CSS)**, not 382 (+370). Its header comment declaring the
> split is `:1-9`; its props type is `:27-31`; it reads the row's own currency at
> `:108`; it builds the date from `transaction_local_date` + `_time` at `:126-127`
> with the UTC-midnight reason documented at `:49-52`; it reads
> `movement_type_name` at `:148`. The overview copy is 186 lines (+404 CSS) and
> its props are still identical.
>
> **Five instances mount at once, not six.** With the `(pocket)` list removed,
> Overview renders five `LastMovements` → five `ListContent` → **five modals and
> five hooks**, and five `aria-modal="true"` in the DOM
> (`TransactionDetailModal.tsx:108`).

### 2.6 An inverted dependency

`general_components/listContent/ListContent.tsx` imports **from** the overview
page tree — `LastMovementType` at `:18` and `TransactionDetailModal` at `:25` —
and has exactly one consumer in the repo, `LastMovements.tsx:4`. A component
sitting in `general_components/` is used only by Overview and depends back on it.

### 2.7 Backend: what Overview hits today

| constant | route | controller | lines |
|---|---|---|---|
| `url_get_total_account_balance_by_type` | `dashboardRoutes.js:21-22` | `dashboardController.js:118-298` | ~181 |
| `url_monthly_TotalAmount_ByType` | `dashboardRoutes.js:29-32` | `dashboardMonthlyTotalAmountByType.js:18-176` | ~159 |
| `dashboardMovementTransactions` | `dashboardRoutes.js:35-36` | `dashboardController.js:457-874` | ~418 |
| `url_get_accounts_by_type` | `accountRoutes.js:69` | `getAccountController.js:211-421` | ~211 |
| `url_get_transaction_by_id` | `transactionRoute.js:12` | `transactionController.js:821-983` | ~163 |

**Two backend facts the contract must answer:**

- `dashboardController.js:248` and `:270` take `rows[0]` only — **multi-currency
  rows are silently dropped** before the response is built. The client-side
  cross-currency addition in §2.4A sits on top of a server that already
  discarded a currency.
- `getTransactionById` returns a **flat object with no envelope**
  (`transactionController.js:940-976`) and errors as `{ error: '...' }`
  (`:922`, `:979`) — a different shape from every other endpoint.

> **Re-measured 2026-08-30 — the table and both facts moved; one changed in
> substance.** Corrected anchors:
>
> | constant | route | controller | lines |
> |---|---|---|---|
> | `url_get_total_account_balance_by_type` | `dashboardRoutes.js:21-22` | `dashboardController.js:126-309` | ~184 |
> | `url_monthly_TotalAmount_ByType` | `dashboardRoutes.js:29-32` | `dashboardMonthlyTotalAmountByType.js:61-230` | ~170 |
> | `dashboardMovementTransactions` | `dashboardRoutes.js:35-36` | `dashboardController.js:465-902` | ~438 |
> | `url_get_accounts_by_type` | `accountRoutes.js:77` | `getAccountController.js:250-500` | ~251 |
> | `url_get_transaction_by_id` | `transactionRoute.js:12` | `transactionController.js:922-1090` | ~169 |
>
> **The `rows[0]` defect survives, at `:256` and `:278`.** The four queries still
> `GROUP BY ct.currency_code` (`:185`, `:201`, `:217`, `:236`) with no `ORDER BY`,
> and the controller still takes `rows[0]` — so multi-currency rows are still
> dropped and which currency survives is still non-deterministic.
>
> **But the source column changed.** `dashboardController.js:23` now defines
> `DERIVED_BALANCE = derivedAccountBalanceSql('ua')` and every one of those
> queries sums the ledger-derived figure instead of the stored
> `ua.account_balance` column. Any passage that argues from "the dashboard reads
> `ua.account_balance`" is arguing from a column this controller no longer
> touches; the aggregate is still *as of now*, which is the half the argument
> actually needs.
>
> **`getTransactionById` is unchanged in substance, moved in place:** flat
> `res.json({...})` with no envelope at `:1047-1085`, errors as `{ error: '...' }`
> at `:930`, `:1029` and `:1086`.

### 2.8 What already exists and must be reused, not rebuilt

| capability | where | note |
|---|---|---|
| **Batch-payload precedent** | `budgetController.js:69` → `budgetCalculationService.js:425-433` | `POST /budget/accounts/status` serves three UI levels from one request. This is the shape `GET /overview` should follow |
| **KPI/calculator layer** | `services/budget_services/{core,db,services}/` | `core/` is pure, `db/` is SQL, `services/` orchestrates. The layering to mirror |
| **FX conversion** | `fx_services/conversion/currencyAmountConversion.js:30` | returns `{ amount: Decimal, rate, source, fetchedAt }` |
| **Currency catalog** | `fx_services/currency_catalog/loadCurrencyCatalog.js` | loaded at boot, `getCurrencyCodeSync:78` |
| **Decimal money** | `budget_services/core/money.js` | `toAmount:129`, `toRate:141` |
| **Invalidate-on-write** | `useBudgetStatusStore.ts:128` + `transactionEvents.ts` | `invalidate()`, wired to writes at `:148-150` |

**The dashboard has no calculator layer.** Its controllers compute in raw SQL
inline. A second tiny calculator lives outside `services/` at
`utils/fintrackUtils/accountDataRetrieval/calculateBudgetMetrics.js` (14 lines),
used at `getAccountController.js:41` and `:180`.

**R73 is the standing evidence for §4.2.** The remaining-budget formula exists in
four places, three contradicting the authoritative one, and the same account can
read *remaining 50* on the budget page and *remaining −600* on the overview, in
the same session, from the same database (`remarks/budget-module.md`, R73).

> **Re-measured 2026-08-30 — three rows of the reuse table are stale.**
>
> - **FX conversion.** `currencyAmountConversion` is declared at
>   `currencyAmountConversion.js:73`, not `:30` — line 30 is now the import of
>   `resolveHistoricalRate`. It takes a fourth parameter `asOfDate = null`
>   (`:77`) and returns **five** fields, not four:
>   `{ amount: Decimal, rate, source, fetchedAt, effectiveDate }` (`:209-217`).
>   A dated conversion is now available to Overview and was not when this table
>   was written.
> - **The 14-line calculator.** `utils/fintrackUtils/accountDataRetrieval/`
>   `calculateBudgetMetrics.js` has **no importer** in `backend/src`; the live
>   copy is redeclared inside `getAccountController.js:56` under a `DEPRECATED`
>   banner at `:41`, and called at `:217` and `:846` — not `:41` and `:180`. The
>   only other reference to the standalone name is
>   `getAccountDataById.js:59`, which is the dead path the scope note in
>   `OVERVIEW_DECISIONS.md` already describes.
> - **The remarks file** is `plan-docs/remarks/budget-module.md`, and R73 is at
>   `:25`. Its own anchor for the dashboard copy of the formula, once
>   `dashboardController.js:187`, is now `:195` (`category_budget`) and `:210`
>   (`pocket_saving`) — two `total_remaining` expressions, both still inside the
>   endpoint Overview consumes.
>
> Unchanged and re-verified: the batch-payload precedent (`budgetController.js:69`
> → `budgetCalculationService.js:425-433`), the three-layer split of
> `budget_services`, `getCurrencyCodeSync` at `loadCurrencyCatalog.js:78`,
> `money.js` `toAmount:129` / `toRate:141`, and `invalidate()` at
> `useBudgetStatusStore.ts:128` — whose wiring is now at `:149` and `:157`, not
> `:148-150`.

---

## 3. Target architecture

```
OVERVIEW (Level 1)
├── Hero: net worth, cash position, net monthly flow
├── Domain cards: ALL, Income, Expense, Investment, Debt, Pocket, PnL
├── Monthly snapshot (this month vs average)
├── Financial goals
└── Recent activity (teaser, 5 items max)

DOMAIN PAGE (Level 2) — one per card except ALL
├── Domain KPIs (3-5 max, from the catalog)
├── Trend
└── Transactions (paginated, lazy on navigation)

ALL PAGE (Level 2, consolidated)
├── Consolidated KPIs
├── KPIs by domain, reused from each domain's calculator — never recomputed
└── All transactions

TRANSACTION DETAIL (Level 3) — existing screens, unchanged
```

`Transfer` is a sub-metric of `ALL`, not a card: it relocates money without
changing net worth, so it does not carry the weight of the other six.

**Why this shape.** Progressive disclosure (summary → domain → ledger) is the
standard personal-finance pattern; a first screen listing every transaction
pushes classification work onto the user. A hero metric above the fold answers
the question the user opened the screen to ask. And cards keyed to financial
domains rather than to `movement_type` rows match the user's model of their own
money, not the database's classification.

---

## 4. Guard rules — non-negotiable

These four are inherited from `FINTRACK_OVERVIEW_CLAUDE_CODE_SPEC.md` §2.5,
§2.6, §11 and §16. They are the part of that document worth keeping. Each one is
now paired with the measurement that proves it is being violated today.

### 4.1 Server-authoritative financial calculation

Totals, conversions, percentages, balances, periods and KPIs are computed in the
backend. The frontend renders the supplied metric. **Do not reproduce a financial
formula in React.**

*Violated at:* §2.4 A, C, D, F. Six sites.

### 4.2 One KPI, one formula, one implementation, many consumers

The same KPI must not be independently recomputed in Overview, a domain page and
ALL. `ALL` consolidates domain facts; it does not re-derive them — consolidating
by re-running the calculation is how a dashboard's total drifts from the sum of
its parts.

*Violated at:* R73, four implementations of one formula, three contradicting the
authoritative one.

### 4.3 FX: convert before aggregating, server-side only

1. The backend converts.
2. Conversion happens **before** aggregation.
3. The client never converts.
4. Aggregation is in the single accounting currency (`fintrack-currency-model`:
   one accounting currency stored; the frontend-sent one is origin-only FX
   metadata).
5. Reuse `currencyAmountConversion` — **do not introduce a second FX
   implementation for Overview.**
6. Mixed-currency values are never silently added.
7. If an aggregate cannot be represented safely, return an explicit
   `null`/unavailable state rather than inventing a value.

*Violated at:* §2.4A (client adds four currencies) and §2.7 (server drops
multi-currency rows before the client ever sees them).

### 4.4 One read model, not a request aggregator

`GET /overview` must be a genuine read model. Moving the six-way fan-out from the
browser into a `Promise.all` inside the controller is the same waterfall one
layer down and does not satisfy this rule.

*Exception:* if profiling proves independent queries materially improve latency
and the count stays bounded, document the reason and get it approved
explicitly — in this file, before writing it.

*Violated at:* §2.3, 16 requests per mount, one of them an exact duplicate.

---

## 5. Data contract obligations

Settled before any component is written.

| endpoint | carries | does not carry |
|---|---|---|
| `GET /overview` | hero + domain cards + monthly snapshot + goals + recent activity (≤5) | transaction rows |
| `GET /overview/:domain` | domain KPIs + trend + paginated transactions | other domains' data |

**Rules the contract must satisfy:**

- Every monetary field is in the accounting currency, converted server-side.
- Any aggregate that cannot be represented safely is `null` with a reason in
  `meta.notices` — never a fabricated figure. `meta.notices` is always an array
  (the budget module's own §5 convention).
- `ALL` reuses the per-domain calculator outputs. It owns no second formula for
  a figure a domain already produces.
- Domain card fields, per §5.3 of the superseded spec, as **candidates to
  approve in Phase 1, not as an approved list**: `domain`, `transactionCount`,
  `totalAmount`, `periodStart`, `periodEnd`, `currency`, a comparison/delta
  where meaningful, and a `domainSpecificSummary`. Expense may additionally
  carry `budgetAmount` and `budgetVariance` **only if** those come consistently
  from the frozen budget contract.
- The KPI catalog lives in a new `overview_services` module mirroring
  `budget_services`' three-layer split (`core/` pure · `db/` SQL · `services/`
  orchestration). It **imports** from `budget_services` where a metric already
  exists there rather than extending that module — the two domains must not
  couple.
- Every catalog entry states: metric id, domain, business meaning, formula,
  source facts, currency behaviour, time basis, aggregation rule, null/zero
  behaviour, display priority, consumers.
- Cap: 3 hero metrics, 3-5 per domain card. A metric earns its place or it is
  not in the catalog.

---

## 6. Phase sequence

Each phase ends at a gate. **No file is written before the developer approves
the gate** — the project's Gate 1-4 workflow applies per commit inside each
phase, unchanged.

| phase | content | blocked by |
|---|---|---|
| **0** | Resolve `USE_NEW_BUDGET_SYSTEM` ownership (§8.2); confirm the trigger fired | nothing — documentation only |
| **1** | KPI catalog: every metric with its eleven fields. Approve the domain-card field list. No code | 0 |
| **2** | Data contract: `GET /overview` and `GET /overview/:domain`, as real types — request params, response shape, nullability, error envelope. No code | 1 |
| **3** | Backend: `overview_services` with `core/` + `db/` + `services/`, controller and route. FX conversion before aggregation | 2 |
| **4** | Frontend Level 1: hero, domain cards, snapshot, goals, recent activity, behind a feature flag beside the current screen | 3 |
| **5** | Frontend Level 2: one domain page per card, plus ALL. Transactions lazy on navigation | 4 |
| **6** | Cleanup block: remove the flag and the superseded widgets, in one commit, per D13 | 5 |

**Phase 4 needs a flag of its own.** The project rule is gradual execution
(`CLAUDE.md`), and the superseded spec named only `USE_NEW_BUDGET_SYSTEM`, which
belongs to budget. Name and default the Overview flag in Phase 2 so Phase 4 has
one to ship behind. Both paths stay functional until Phase 6.

**Deprecation triage — Phase 6, decided in Phase 1, not before.** D8 and D13
both apply: nothing is deleted for looking unused until the module works end to
end, and an approved deletion is commented, not removed, until the block ships.

| component | disposition | why |
|---|---|---|
| `CalculateMonthlyAverage.ts` | **delete** | its whole job moves to the KPI engine (§4.1) |
| `overviewFetchAll.ts` | **delete** | it exists only to orchestrate the fan-out §4.4 removes |
| `MonthlyAverage.tsx` | **adapt** | becomes the monthly-snapshot card, rendering served figures |
| `SavingGoals.tsx` | **keep** | already renders server figures without arithmetic (§2.4I) — but the `Math.random()` square goes |
| `AccountBalance.tsx`, `InvestmentAccBalance.tsx` | **adapt** | the P/L percentage moves server-side; the dead `capital` path (§2.4D) dies with it |
| `LastMovements.tsx` × 6 | **collapse to one** | recent-activity teaser at Level 1; the six lists become Level 2 |
| `TransactionDetailModal.tsx` (overview copy) | **delete, adopt the account one** | the account copy is correct on currency, dates and movement name (§2.5) |
| `ListContent.tsx` | **move into the overview tree or generalise** | resolves the inverted dependency (§2.6); it has one consumer |
| `BigBoxResult.tsx` | **adapt** | becomes the hero, fed by served figures |

> **Three rows lost their subject, 2026-08-30. Nothing struck; the triage needs a
> fresh decision.**
>
> - **What the table asserts.** `SavingGoals.tsx` is *keep* — "already renders
>   server figures without arithmetic (§2.4I) — but the `Math.random()` square
>   goes"; `LastMovements.tsx` × **6** collapses to one; and the whole table is a
>   phase-6 disposition over widgets assumed to still be on screen.
> - **What the code says.** `frontend/src/fintrack/pages/overview/components/`
>   `SavingGoals.tsx` does not exist. Commit `b40c4b8` *fix(overview): remove
>   every pocket read* (2026-08-30) deleted it, its `Math.random()` square and
>   the savings-goals request in the same change. `LastMovements` is rendered
>   **five** times (`Overview.tsx:401, 406, 412, 418, 423`), not six — the
>   `(pocket)` list went with it.
> - **Why it needs a decision.** *Keep* is not available for a file that is
>   already gone, and the phase-6 cleanup no longer has the widget it was told to
>   preserve. The open question is whether the savings-goals surface returns at
>   all under the assignment model — the pocket module owns that data now
>   (`pockets` / `pocket_allocations`) and §4 of the KPI catalog still reuses
>   G1-G3 from a component that no longer exists. Not reordered and not closed
>   here.

---

## 7. Acceptance criteria

Measurable, so the gate can be closed on evidence rather than on judgement.

**Architecture**

1. Level 1 issues **one** request on mount. Not six, not sixteen.
2. No URL is requested twice in one mount (§2.3 fixes the `pocket_saving`
   duplicate).
3. `GET /overview` returns no transaction rows.
4. Level 2 transactions are paginated and requested on navigation, not at Level 1.
5. The backend does not issue one query per domain inside the controller (§4.4).

**Financial correctness**

6. Grep for arithmetic operators on monetary fields under `pages/overview/`
   returns nothing. Every figure on screen comes from a response field.
7. `Math.random()` appears nowhere in the tree.
8. No cross-currency addition anywhere, client or server. A mixed aggregate is
   `null` plus a notice.
9. Every KPI on screen traces to exactly one catalog entry and one
   implementation.
10. The investment P/L percentage produces a real number, or the card does not
    claim one.

**Product**

11. A card carries 3-5 values. The hero carries 3.
12. A missing figure renders as a skeleton or a dash — never `0`, never `NaN`
    (the project's own frontend rule).
13. Loading, error and empty are three distinct states, per surface, and one
    failed request does not blank the screen (§2.3).

**Code quality**

14. No `any`.
15. `type`, not `interface`.
16. 1-space indentation in new files; no mass-reformatting of neighbours.
17. Tokens for every colour, spacing, radius, font size and weight. No hardcoded
    hex, no hardcoded px.
18. Every interactive element declares default, `:hover`, `:focus-visible`
    (2px ring, 2px offset), `:active` and `:disabled`.

---

## 7-bis. The separation of concerns — set 2026-08-29

**Overview is not touched to solve another module's problem.** The developer set
this above adding KPIs to Overview, and it is what decides where a figure belongs:
each module answers **one question**, and a figure that does not answer that
module's question is on the wrong screen.

| module | the question it answers |
| --- | --- |
| Overview | What is my overall financial situation? |
| Bank accounts | Where is my real money? |
| Debts | Who owes me and whom do I owe? |
| Budget | How am I executing my budget? |
| Pocket | Which savings goals am I funding, and how close am I? |
| Investments | How is my wealth invested? |

**This ranks above the two decisions still open below.** Adding indicators to
Overview is worth less than each screen answering its own question, so neither of
those two is scheduled before the modules are separated.

## 8. Open decisions

| # | question | options | recommendation |
|---|---|---|---|
| 1 | Does `Transfer` get its own card? | own card / sub-metric of ALL | **sub-metric** — it does not move net worth |
| 2 | Where does the KPI catalog live? | extend `budget_services` / new `overview_services` | **new `overview_services`**, importing from budget rather than extending it, so the two domains do not couple |
| 3 | `USE_NEW_BUDGET_SYSTEM` ownership | `feat/budget` / `feat/overview` | ~~`feat/overview`~~ **REVERSED. CLOSED 2026-08-29: budget owns it.** The plan reasoned from where the switch is read. The developer's rule is that **holding a switch is not owning the thing it switches**: budget owns the lifecycle of the new budget system, including when the flag is removed, and overview only decides whether it renders it. **Measured the same day: the flag does not exist anywhere in `backend/src` or `frontend/src`**, so this settles where it will be created, not where it moves from |
| 4 | Does `ListContent` move into the overview tree, or become genuinely general? | move / generalise | ~~move~~ **DEFERRED 2026-08-29.** *"No refactorizaria componentes solo para limpiar carpetas."* Not decided until what the list represents is defined. **And the plan's reason for moving it was wrong**: measured 2026-08-29, the live import is `LastMovements.tsx:4`, but `PocketDetail.tsx:243` holds a commented `<ListContent listOfItems={lastMovements} />`. The second consumer is not absent, it is pending — and it belongs to the module being rebuilt. Moving the component into overview now would move it away from the screen about to call it |
| 5 | Does the Overview refactor fix `getTransactionById`'s missing envelope (§2.7)? | fix here / register and defer | **CLOSED 2026-08-29: register and defer**, confirmed. *"No contaminar Overview para solucionar un defecto de Transaction."* **The register half had never been done** — the decision was taken here and the defect was never written into `REMARKS.md`. Corrected the same day: it is now **R256**, filed against the transaction module, where it is resolved |
| 1 | Does `Transfer` get its own card? | **STILL OPEN** | sub-metric of ALL, recommended above |
| 2 | Where does the KPI catalog live? | **STILL OPEN** | a new `overview_services`, recommended above |

> **Measurements inside this table, re-checked 2026-08-30. The decisions
> themselves are untouched.**
>
> - **Row 3 holds.** `USE_NEW_BUDGET_SYSTEM` still appears nowhere in
>   `backend/src` or `frontend/src` — grepped repo-wide today. It exists only in
>   `spec.md:11` and `:29`, so the row's "this settles where it will be created"
>   still reads correctly.
> - **Row 4 has lost its second consumer, and it was the deferral's stated
>   reason.**
>   - *What the row asserts.* "Measured 2026-08-29, the live import is
>     `LastMovements.tsx:4`, but `PocketDetail.tsx:243` holds a commented
>     `<ListContent listOfItems={lastMovements} />`. The second consumer is not
>     absent, it is pending — and it belongs to the module being rebuilt."
>   - *What the code says.* `frontend/src/fintrack/pages/forms/pocketDetail/`
>     `PocketDetail.tsx` contains no reference to `ListContent`, commented or
>     live, anywhere in the file. The file is one of the thirteen uncommitted
>     frontend files of the rebuilt pocket module. `ListContent` has exactly one
>     importer in the repo, `LastMovements.tsx:4`.
>   - *Why it needs a fresh decision.* The deferral was argued from a pending
>     second consumer inside the module being rebuilt. That consumer is not
>     pending any more — the rebuilt pocket detail was written without it. The
>     original text stands; whether the deferral survives its own premise is the
>     developer's call, not this correction's.

---

## 9. Verification

Per F-15 **there is no test runner anywhere in this repo.** "It works" means
"driven by hand". Do not claim automated tests passed.

Each phase is verified the same way:

1. Type-check the frontend with the app tsconfig — exit 0.
2. Production build — exit 0.
3. Boot the backend and confirm it loads.
4. Drive the running app and read the DOM:
   - count the network requests on a cold Level 1 mount — the criterion is 1;
   - open an account with a non-accounting currency and confirm no total mixes
     currencies, and that an unrepresentable aggregate shows a dash plus a
     notice rather than a number;
   - navigate Level 1 → domain → transaction and back, and confirm the return
     does not refetch Level 1 from scratch (§2.3, the current cold-start defect);
   - record a transaction, then open Overview, and confirm the figures moved
     without a hard reload;
   - reload the same screen twice and confirm no status indicator changes
     without the data changing (§2.4E).

---

## 10. Out of scope

- Infrastructure and the Supabase migration — `PLAN_SUPABASE_MIGRATION.md`,
  `PLAN_PRODUCTION_MERGE.md`.
- Rewriting the four legacy 1000+-line controllers. Scope discipline inherited
  from `PLAN_BUDGET_V1.md` §3: **this plan makes Overview coherent, it does not
  rewrite the application.** `dashboardController.js` is read from, not rebuilt,
  except where a new `overview_services` read replaces a call into it.
- Database migrations. None are planned. If the analysis in Phase 2 proves the
  schema cannot serve the contract, that is a **separate gate**, not a silent
  addition to this one — and it follows the repo's numbering, currently at `021`
  (corrected 2026-08-30: `backend/src/db/migrations/sql_migrations/` holds
  `001` through `021`, the last being `021_create_daily_exchange_rates.sql`; the
  plan was written when `017` was the highest).
- Excel/CSV export.
- The `AccountActionsMenu` restyle and the `.icon3dots` doors —
  `PLAN_ACTIONS_MENU.md` and `PLAN_EditAccount.md`.

---

## 11. Correction log — 2026-08-30

Measurements only. No decision was closed, deleted or reworded, and no work unit
or priority was reordered. Measured on `fix/auth-screen` at `e919a89`, working
tree included.

| § | what was corrected |
|---|---|
| 1 | 16 requests → 13; four currencies → three; two `Math.random()` → one |
| 2.1 | 13 files → 12; `SavingGoals.tsx` deleted; five line counts; inline-type anchors |
| 2.1 | blast radius re-verified — four import sites, still exact |
| 2.2 | render list `:407-481` → `:360-428`; 11 widgets → 9; six `LastMovements` → five; `.cards__presentation` `:236-242` → `:272-278` |
| 2.3 | 16 → 13 requests with the per-site count; the `pocket_saving` duplicate is gone; `useFetch` does have a retry (`:45`, `:132`, `:41-43`) — `useFetch.ts:26` is not the effect; six loading flags → five; six error strings → five; route `App.tsx:318-325` → `:321-328` |
| 2.4 | A three currencies; B, C, E, G and H anchors moved; E one random indicator; H six blocks → five; **I marked** — the model widget no longer exists |
| 2.5 | account modal 382 (+370) → 312 (+372) lines, every anchor moved; six modals mounted → five |
| 2.7 | all five controller ranges; `rows[0]` `:248`/`:270` → `:256`/`:278`; the queries now sum `derivedAccountBalanceSql`, not `ua.account_balance`; `getTransactionById` `:940-976`/`:922`/`:979` → `:1047-1085`/`:930`/`:1029`/`:1086` |
| 2.8 | `currencyAmountConversion` `:30` → `:73`, four return fields → five, plus the new `asOfDate` parameter; `calculateBudgetMetrics` has zero importers and its live copy sits at `getAccountController.js:56`, called at `:217` and `:846`; remarks path and R73's dashboard anchor `:187` → `:195`/`:210`; `useBudgetStatusStore` wiring `:148-150` → `:149`/`:157` |
| 6 | **marked** — the *keep* `SavingGoals.tsx` row and the *six* `LastMovements` row lost their subject |
| 8 | row 3 re-verified, the flag is still absent; **row 4 marked** — `PocketDetail.tsx:243` no longer holds the commented `ListContent` the deferral was argued from |
| 10 | migration numbering `017` → `021` |

**Verified and left alone:** the flat render list of §2.2, §2.4 D and F, the
inverted dependency of §2.6 (`ListContent.tsx:18`, `:25`; one consumer,
`LastMovements.tsx:4`), the batch-payload precedent of §2.8, `money.js`,
`loadCurrencyCatalog.js:78`, and the absence of any test runner.

**Left unsure:** whether the five reshaping blocks of §2.4H are exactly 155
lines. The block runs `:171-325` and its upper boundary is a comment, so the
count depends on where the reader starts it.
