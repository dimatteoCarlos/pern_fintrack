# PLAN — Budget module, frontend

**Lives in `plan-docs/ongoing/`, which `.gitignore:123` re-includes: this file is versioned.**
**This is the next step to execute.** Backend V1 is delivered; nothing in the UI
consumes it yet.

Extracted 2026-08-13 from `PLAN_D_BUDGET_FRONTEND.md` PART 10, which was the only
live part. PARTs 0–9 described the multi-frequency model and were discarded — the
decisions worth keeping from them are in `DECISIONS.md`.

The contract lives in `PLAN_BUDGET_V1.md` §7.4 and is **not** duplicated here: a
contract written in two documents is a contract that drifts. Commit numbers are
`PLAN_BUDGET_V1.md` §11's, so both documents stay addressable by the same index.

---

> ## 📍 STATE — 2026-08-13
>
> **Commits 5, 6 and 7 landed and are pushed.** The four contract slots that
> blocked them are closed. What is open now is one **amendment** to §7.4, and it
> blocks commit 8.
>
> | id | the question that blocked commit 5 | outcome |
> |---|---|---|
> | **D-A** | Does `budgetAllocationId` enter the contract, or stop being sent? | **Closed.** Not in §7.4, not in `budgetTypes.ts` |
> | **D-B** | What frozen shape does `budget_allocation` have on account create/edit? | **Open as documentation only.** §7.4 still lacks the paragraph. It does not block the read path, so it does not block commits 8–10 |
> | **D-C** | §7.4 says *"exactly one field is nullable"* | **Closed.** `executionPercentage` is the only null in the contract |
> | **D-D** | How does the client discriminate "mixed currencies"? | **Dissolved.** One accounting currency per installation, so the defensive branch in `makeTotals` is unreachable. `totals.currency` is nullable for the **empty set** — `makeTotals([])` returns a null currency with numeric amounts — not for a mix |
>
> | commit | hash | what landed |
> |---|---|---|
> | 5 | `66f091b` | `refactor(budget): rewrite the budget types` — the file rewritten whole against §7.4, +106/−110 |
> | 6 | `371bc75` | `feat(budget): add the budget api client` — `fintrack/api/budgetApi.ts` plus three URLs in `urlConfig.ts` |
> | 7 | `503f9b8` | `fix(budget): require the budget on account edit` — `.optional()` removed from `categoryBudgetEditShema` |
>
> ### ⛔ What blocks commit 8
>
> §7.4 as originally frozen serves screens 2 and 3 and **nothing served screen
> 1**: the landing view is per-category, the endpoint is per-account.
>
> **The amendment was accepted on 2026-08-13.** `accountIds` becomes optional,
> `accounts[]` gains `categoryName`, and a `categories[]` array joins the body,
> so one request serves all three navigation levels.
>
> What blocks commit 8 is therefore no longer a decision but an implementation:
> **a backend commit has to ship the amended body first.** No frontend gate is
> presented against a contract the server does not yet answer — that is D11.
>
> ### Two things that did not close
>
> | gap | state |
> |---|---|
> | **F-07** | Un-budgeting an account has no endpoint, and **should not get one**. Stopping a budget is a recurring `0` — the account stays budgeted, spending still lands, `remainingBudget` goes negative. `deleteAllocationsForAccount` erases past months and so contradicts invariant 5; it has no caller and must not acquire one. The contract must **say this** rather than leave it implicit (V1 §3.5, decision 37) |
> | **F-15** | There is still no test runner anywhere (H10), so no Gate 3 in this plan has an objective pass criterion |
>
> Evidence for the findings: `docs/budget/BUDGET_MODULE_TECHNICAL_GUIDE.md` §31.

---

## 10.0 Why this plan exists

`PLAN_BUDGET_V1.md` replaces the model this document was written against. Not the
implementation — **the model**. Frequencies, policies, SCD2 allocations and
resolved periods stop existing; one row per account per month replaces all of
them.

This part is written under the standing rule that **every backend endpoint or
payload change carries an entry in this plan**. Commits 2–4 of V1 §11 change all four
budget endpoints, so this is that entry, written before any of those commits
runs rather than after.

It supersedes PART 4 and PART 5 outright. PART 8's findings are re-read below
rather than deleted: some of them dissolve with the model, and the rest are still
live bugs in files nobody has touched.

**Nothing here is a licence to start.** Commits 5–10 of V1 §11 are the frontend
work, each one gated. This part is what those gates will be presented against.

## 10.1 The contract, and where it lives

The response bodies are frozen in `PLAN_BUDGET_V1.md` §7.4 and are **not**
duplicated here — a contract written in two documents is a contract that drifts.
What belongs here is what the frontend has to do about it.

| Endpoint | Replaces | Screens |
|---|---|---|
| `POST /budget/accounts/status` | `GET /budget/summary`, `POST /budget/multi-summary` | Budget list, account cards |
| `PUT /budget/accounts/:accountId/current` | `PUT /budget/policy/:id` | Edit modal |
| `GET /budget/accounts/:accountId/series?from=&to=` | nothing — new capability | History, Overview, Insights |
| `GET /budget/export?accountId=&from=&to=` | same route, new payload and new query | Export |
| — | `GET /budget/frequencies` | **Retired with no replacement** |
| — | `GET /budget/history/:accountId` | Retired; `/series` is the month-based answer, and it lands in commit 3 |

All three `/export` parameters are optional and independent. `accountId` omitted
covers every budget account the caller owns; **`from`/`to` omitted export the
current month**, the one `/accounts/status` reports. That default is deliberately
not `/series`' twelve months — see §10.8.4.

## 10.2 What the frontend deletes, and what it gains

| Frontend concept | Fate |
|---|---|
| `budgetFrequencyCode`, `budgetFrequencyTypeId`, the frequency selector, the "one value" workaround of §8.2 and 9.10 | **Gone.** There is no frequency to select. R14 closes as "not applicable", not as "done" |
| `aggregationLevel` and every custom-range control that emits it | **Gone.** Replaced by `from`/`to` months (V1 §8.1) |
| `budgetPolicy` / `budgetAllocation` objects | **Gone.** Their useful fields are flat on the account now |
| `period.start` / `period.end` **of the budget** | **Gone.** Replaced by `referenceMonth` or `month` |
| `periodStartDate` / `periodEndDate` **of the account** | **Untouched.** Different concept — the account's own transaction period. It has live consumers and V1 does not go near it. The name collision is the single most likely mistake in this migration |
| `budgetAccumulatedAmount` | **Gone.** It was `amount × floor(months / monthsPerPeriod)`; the `floor` was a defect |
| `remainingBudget` / `actualVsBudgetDifference` — two names, one number | Collapses to **`remainingBudget`** alone |
| — | **Gained:** `nextMonthBudget`, `restoresTo`, `restoresFrom`, `subcategory` populated, and a full month series |

## 10.3 What each frontend commit owes

Commit numbers are `PLAN_BUDGET_V1.md` §11's, so the two documents stay
addressable by the same index.

> ### STATE — 2026-08-23. The 2026-08-15 block below is superseded
>
> Measured against the code, not against the documents. **The read path is
> finished. Three things were open on that date; row 1 closed 2026-08-23 and two
> remain, both of them code.**
>
> | # | what is open | evidence |
> |---|---|---|
> | 1 | ~~**A decision.**~~ **CLOSED 2026-08-23 by `8fba00e` `refactor(budget): drop the editor budget write`.** The budget block writes through `PUT /budget/accounts/:accountId/current` and the account `PATCH` stopped carrying `budget`, which also retired `applyAllocationForAccount` — the service that wrote identity FX on the premise that the editor had already converted. The audit pair is no longer left false, because the editor no longer touches it. Original diagnosis: The account editor leaves the FX audit pair false: it writes `cba.budget` and the allocation but keeps `original_budget`, `exchange_rate` and the rate source at their creation values, so after one edit the row states an origin that never happened. The unit that would have fixed it by removing the field was reversed by the developer; its diagnosis survives and its remedy waits on one answer — **does the budget block write through the budget endpoint, leaving the account PATCH to stop carrying `budget`, or does the PATCH keep the amount and gain the conversion engine?** | ~~`accountEditController.js:338-351`~~ — that range holds the pocket-saving deadline logic today; the `category_budget` arm states at `:105-107` that the budget is not edited there at all. The reversal is `PLAN_BUDGET_WRITE_PATH.md` unit D *(re-measured 2026-08-30)* |
> | 2 | **Commit 10, the read-only history** — the only commit of the sequence never started. The month series in Overview plus the year's accumulated figure | `getBudgetAccountSeries` at `budgetApi.ts:76` (was `:78`) still has zero callers, and there is still no `insights` directory under `pages/` — re-measured 2026-08-30, the row is unchanged in substance |
> | 3 | **Retiring the legacy `cba.budget` column** — V1 §11 Phase 4, items 11 to 13. It now waits on nothing | `calculateBudgetMetrics.js` is live with four consumers: `getAccountController.js:43` (a local copy), `:196`, `:759` and `getAccountDataById.js:59`, plus `dashboardController.js:185-186,347`. *(Anchors re-measured 2026-08-30: `getAccountController.js:56`, `:217`, `:846`, `getAccountDataById.js:59`, `dashboardController.js:194-195` and `:356`. Same five consumers. What changed in substance is that the balance term beside `cba.budget` at both dashboard sites is now the ledger derivation, not `ua.account_balance` — the column under inventory is still read at both.)* |
>
> Two residues, neither blocking anything:
>
> | residue | where | what is owed |
> |---|---|---|
> | The fifth remainder formula, the only one that rounds, with its `console.log` | `categoryBudgetCalculations.ts:18-30` | Zero importers. §10.9.5 asks for a retirement marker, **not** a deletion — D8 |
> | The invalidation emitter on account deletion | `AccountDeletionPage.tsx` | Only `EditAccount.tsx:357` and `NewCategory.tsx:415` emit — the second under `pages/forms/newCategory/`, not `editionAndDeletion/`. **Deferred by the developer** to the deletion block, registered as `R209` *(the row read `EditAccount.tsx:313`; re-measured 2026-08-30)* |
>
> **What the 2026-08-15 block below gets wrong, corrected here rather than
> deleted:**
>
> - *"Commit 9 is the next thing to execute"* — **it closed.** §10.9.4's optional
>   percentage prop exists at
>   `pages/forms/accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx:31`
>   — `executionPercentage?: number | null` — used when supplied and
>   computed as before when absent, so the pocket and debtor screens are
>   unaffected. §10.9.5's marker is the only piece of commit 9 still owed, and it
>   is listed as a residue above.
> - *"Not started, planned: the `AccountActionsMenu` restyle"* — **rebuilt** in
>   `1eb8fe6`, and the trigger it opens became its own component in `f33c97a`.
> - The edit modal row and commit 8 — **both landed.** The exception line renders
>   at level 3 (`CategoryDetail.tsx:376`), on the level-2 row
>   (`ListAccountOfCategory.tsx:338`) and in the editor (`EditAccount.tsx:620`),
>   all three under the same `nextMonthBudget !== budgetAmount` predicate this
>   document said must not be re-derived *(the three anchors read `:340`, `:337` and
>   `:575`; re-measured 2026-08-30, all three sites are still there)*.
>
> ### State on 2026-08-15 — superseded by the block above, kept for its reasoning
>
> **The sequence.** Commits 5, 6 and 7 and both backend rows are done. **Commit 9
> is the next thing to execute** and it blocks four items: the edit modal, commit
> 8, search and sort, and the `Near limit` threshold. Commit 10 is last.
>
> **Side work that landed beside the sequence and is finished:** the transaction
> detail modal on the three detail screens, the movement pill coloured by its
> effect on Net Worth in *both* modals, the budget store invalidated on a tracker
> write (R53, `d7cd81d`), and the status square on the hero's `Remaining` label.
> None of these were sequence commits; none of them blocks one.
>
> **Frozen, do not reopen:** level 1's markup and layout. See §10.12.4.
>
> **Waiting on the developer, not on code:** whether `receive` reads as
> `attention` (R58), and the mixed-currency query that would locate R55.
>
> **Registered as findings, scheduled for the cleanup block:** R56 (the stray dot
> that keeps a flex class unselectable), the three global `--radius-lg` writes,
> the 14 `--fx-*` properties the overview modal writes on the global `:root`, and
> PnL's commented-out balance refresh.
>
> **Not started, planned:** Pocket adopting the same alert convention
> (§10.12.4), and the `AccountActionsMenu` restyle (`PLAN_EDIT_BLOCK.md` §7,
> icons settled, five decisions open).

| # | Commit | State | What it owes |
|---|---|---|---|
| 5 | `refactor(budget): rewrite the budget types` | ✅ `66f091b` | `budgetTypes.ts`'s 145 lines described frequencies and SCD2; discarded whole and rewritten from V1 §7.4. **Exactly one field is nullable — `executionPercentage`.** Every monetary field is typed `number`, never `number \| null`; see §10.7 |
| 6 | `feat(budget): add the budget api client` | ✅ `371bc75` | Landed under **`fintrack/api/`, not `fintrack/services/`** — one typed client per domain in a shared layer, never inside a route folder, because `EditAccount.tsx` and the budget pages sit in different trees. Three calls over `authFetch`; the axios error propagates untouched so V1 §7.5's `errors[]` survives (`useFetchLoad` flattens it to a string). **It never sends a month for the current month** |
| 7 | `fix(budget): require the budget on account edit` | ✅ `503f9b8` | Scope shrank to one line: F-5 was the only live defect. Creation already required a non-zero amount; the edit schema carried `.optional()`, so an emptied field left the budget out of the PATCH and reported the save as successful |
| — | *backend* — amended `/accounts/status` body | ✅ `599fda0` | Optional `accountIds`, `categoryName` on every account row, and the `categories[]` array. Accepted 2026-08-13. Commit 8 could not be gated before it shipped |
| — | *backend* — optional `month` on `/accounts/status` | ✅ `b53f69f` | `feat(budget): add month and nature to status`. V1 decisions 40–41. A month later than the current one is 422; no lower bound. Omitted still means the current month on the owner's calendar. Also carries `nature` per account row (§10.12). Verified against the database: omitted ≡ current month field by field, and `nextMonth` tracks the requested month. `subcategory` needed nothing — it had travelled since commit 2 |
| — | *backend* — balance dates in `getTransactionsForAccountById` | ✅ `785a45e` | `feat(account): scope transactions to a month`. V1 decision 45. Adds an optional `month`; the legacy `start`/`end` path is untouched because Pocket, Debtor and Account detail all send it and none of them is a monthly domain. Sending both is a 400. Each row gains `transaction_local_date` and `month_cumulative_spent`. The two fields level 4 needs (§10.11) were split out — see the note under this table |
| — | *backend* — `accountStartDate` on `/accounts/status` | ✅ `2b4d3dc` | `feat(budget): ship each account's opening day`. V1 decision 49. Not a figure and never rendered: it is what lets a tracker form stop offering a category on a day that category did not exist yet. Shipped raw and nullable, the same shape the nine account list queries use, so one client-side predicate serves both payloads. Consumed by `Expense.tsx`, which filters and clears; the other three tracker screens already filtered their own account lists this way. Measured: on 2026-08-12 the form offers 3 of 17 categories. The rule it serves is `PLAN_BACKDATING` §3.3.3 |
| 9 | `refactor(budget): read budget from module` | 🟡 **mostly landed, measured 2026-08-15** | The A → C migration was executed **incrementally inside the month commits**, and the code numbers the parts `9a` / `9b` in its retirement markers. Levels 1, 2 and 3 all read the store today: `ListCategory.tsx:42`, `CategoryAccountList.tsx:43-44`, `ListAccountOfCategory.tsx` via its prop, `CategoryDetail.tsx:75`. **What remains is §10.9.4's `SummaryDetailBox` optional-prop change and §10.9.5's helper**, plus the Q-A threshold. The full per-view inventory is §10.9 |
| — | the edit modal | after 9 · **specified 2026-08-17 in `PLAN_BUDGET_WRITE_PATH.md`** | V1 §7.1. The only writer of a one-month exception, and therefore what commit 8 waits on. **This row no longer describes the work — the write path has its own document**, structured as five logical units rather than commits |
| 8 | `feat(budget): show current month status` | after the modal | V1 §7.2. The second line appears **only** when `nextMonthBudget !== budgetAmount` — see the correction below |
| 10 | `feat(budget): add read-only history` | pending | The series in Overview and Insights, plus the yearly accumulated figure. Read-only: V1 does not permit editing a month earlier than the current one, so no cell on this screen is an input |

The edit modal that the old commit 7 described has not been written. It re-enters
the sequence after commit 9, against `PUT /budget/accounts/:accountId/current`,
which `budgetApi.setCurrentBudget` already exposes.

**Its plan is `PLAN_BUDGET_WRITE_PATH.md`, opened 2026-08-17.** This document
keeps the **read** path and presentation — §10.9's remainder, §10.10, §10.11,
§10.12, §10.13, §10.14 and commit 10. That one owns the **write**, and the only
file both reach is `ListAccountOfCategory.tsx`: this document restyles the row,
that one adds the control and the exception marker to it.

One predicate is shared and must not be re-derived: the marker at level 2 and
commit 8's second line on the card both render under
`nextMonthBudget !== budgetAmount`.

### Two corrections to commit 8's row (2026-08-15)

**Commit 8 moved behind the edit modal.** Its one unique deliverable is §7.2's
second line, and that line renders only when `nextMonthBudget !== budgetAmount`.
Measured on 2026-08-15: nothing in the frontend calls `setCurrentBudget` or sends
`onlyThisMonth`, and all eight budget accounts hold exactly one allocation row,
all at `2026-08`. With one row, the carry-forward resolves the next month to that
same row, so the two amounts are always equal and the branch cannot execute. The
only writer of a second row is `PUT /accounts/:id/current` with
`onlyThisMonth: true` — the modal. The dependency runs opposite to the numbering,
and the numbering is what was wrong.

Running 9 first also removes the question of where the card fetches from: once
levels 2 and 3 sit under the parent route (§10.10.2), the card reads the row from
context and adds no request. Ordered 8-then-9 it would have had to add a request
that 9 immediately removes.

**"Three render states, not two" was wrong and is withdrawn.** The row read *"no
budget, budget of zero, budget"*. The frozen model says the opposite: the absence
of a decision **is** an effective budget of 0 (V1 §1.9, §3.5), and no monetary
field is null (§10.7.3). In the response an account with no allocation and an
account set to 0 are byte-identical — `budgetAmount: 0` for both — so no client
can tell them apart, and none should try. **There are two render states:
`budgetAmount > 0`, and `budgetAmount === 0` with `executionPercentage: null`
rendering `—` and no bar.**

## 10.4 Three rules the frontend must not re-implement

Each of these is a rule the backend now enforces, and each has a plausible
client-side version that is wrong.

| Rule | The wrong client version |
|---|---|
| A range's percentage is `SUM(actual) / SUM(budget)` (V1 §8.3) | `avg(executionPercentage)` over the months. Looks right, is not. This is why `/series` returns `totals` — use them |
| An absent decision and a decision of `0` are one state: effective budget `0` (V1 invariant 9, decision 39) | Reintroducing *"Sin presupuesto"* as a second label, whether from a removed flag or from `budgetAmount === 0`. The screen reads one sentence; the difference is a database fact, not a state to render |
| The current month comes from the account owner's timezone (V1 invariant 10) | Computing the month from the browser's clock, which disagrees with the server for part of every day |

## 10.5 PART 8's findings, re-read

| Finding | Status under V1 |
|---|---|
| F-1 — the nature control does nothing and lies about it | **Dissolves.** The control it describes is removed in commit 7 |
| F-2 — the form accepts a budget the backend rejects | **Changes shape.** The rule is now V1 §3.4: the form rejects `0`, and only "Stop budgeting" writes it. Still a real fix, in commit 7 |
| F-3 — the budget label hardcodes a frequency | **Dissolves.** Monthly is the model, so a hardcoded "monthly" is now correct |
| F-4 — creation sends no `budgetFrequencyCode` | **Dissolves.** There is no such field |
| F-5 — budget is mandatory at creation | **Live, and inverted.** The backend *requires* it: `createAllocationForAccount` runs unconditionally and the write path answers `400` when the amount is absent (V1 §3.5). So the form must mark it required, not optional — an account cannot be created unbudgeted. Belongs to commit 7 |
| F-6 — `SummaryDetailBox` is a fifth calculation site | **Live.** Commit 9 |
| F-7 — client-arithmetic inventory | **Live, and shrinks.** The server now returns what most of these sites compute. Re-measure during commit 9 |
| F-8 — two incompatible time frames on one screen | **Live.** One of the two is the account transaction period, which V1 does not touch, so this does not resolve itself |
| F-9 — `remain` reaches the detail screen from two producers | **Live.** Commit 9 removes one of them |
| F-10 — custom ranges snapped to whole months, and the UI must say so | **Dissolves as a warning, survives as a fact.** The month *is* the unit now, so there is nothing to warn about; `from`/`to` are coerced to first-of-month by the API (V1 §7.4) |

## 10.6 What is untouched by all of this

`9.12` (timezone — now `on-hold/PLAN_DEPLOYMENT/PLAN_TIMEZONE_ROLLOUT.md`) and `9.13` (R25) stand unchanged. Neither depends on
the budget model, and `9.12` becomes **more** load-bearing, not less: V1 resolves
both the budget month and the spending window against `users.timezone`
(V1 §4.5), so a user whose zone is wrong now gets wrong numbers, not just wrong
labels.

## 10.7 FE integration required by commit 2 — `refactor(budget): rebuild the budget api`

Written under the standing rule that a backend payload change carries its
frontend requirement. Commit 2 is backend-only; **nothing in this section is
implemented by it.** It is the work commits 5–9 owe, listed now so no rename is
discovered by a runtime error.

### 10.7.1 What the frontend is holding today

`frontend/src/fintrack/types/budgetTypes.ts` (145 lines) is the entire blast
radius. Every route it describes was searched for across `frontend/src`, and
**no component, hook or service calls any of them.** The file is a contract
declaration with no consumers.

That is the reason the migration is cheap. It is **not** the reason the backend
routes changed — that reason is in `PLAN_BUDGET_V1.md` §9. An absent caller
buys no permission; it only bounds the repair.

### 10.7.2 Field-by-field rename table

| Old | New | Note |
|---|---|---|
| `results` | `accounts` | `BudgetMultiSummaryResponse` → the status response |
| `result` (singular, `/summary`) | — | Route gone. One account is `accountIds: [id]` |
| `period: { start, end }` | `referenceMonth` | One `'YYYY-MM-DD'` string, first of the month |
| `budgetAccumulatedAmount` | `budgetAmount` | The accumulation multiplier is gone with the frequency |
| `budgetPolicy`, `budgetAllocation` | — | Removed. `budgetAmount` is flat on the account |
| `actualVsBudgetDifference` | `remainingBudget` | Two names collapse into one number |
| `totals.accountCount`, `totals.budgetedCount` | — | Both go. `accounts.length` is the only count, and decision 39 removed `budgetedAccountCount` before any client read it |
| `totals.budgetAccumulatedAmount` | `totals.budgetAmount` | |
| — | `accountName`, `subcategory` | New on every row. `subcategory` was in the schema all along and shipped empty |
| — | `nextMonthBudget`, `isOverBudget` | New |
| `BudgetFrequency*`, `BudgetPolicyType`, `BudgetAllocationType`, `BudgetAllocationHistoryType`, `BudgetHistoryResponse`, `BudgetPeriodType` | — | Deleted whole |

Route changes, for the client module commit 6 writes:

| Old | New |
|---|---|
| `GET /budget/summary?accountId=&…` | `POST /budget/accounts/status` `{ accountIds }` |
| `POST /budget/multi-summary` | same |
| `PUT /budget/policy/:id` | `PUT /budget/accounts/:accountId/current` `{ amount, onlyThisMonth }` |
| `GET /budget/frequencies` | — retired |
| `GET /budget/history/:id` | — retired; `/series` replaces it in commit 3 |
| `GET /budget/export?…` | `GET /budget/export?accountId=` (optional) |

Every request schema is now **strict**: a retired key still being sent —
`date`, `aggregationLevel`, `budgetFrequencyCode`, `intent` — returns a 400
naming the key rather than a 200 computed over something the client never
asked for.

### 10.7.3 The nullability rule, and the one render it forces

**No monetary field is ever null on an account row.** `budgetAmount`,
`nextMonthBudget`, `actualSpent` and `remainingBudget` are always numbers.
An account with no budget reads `budgetAmount: 0` and
`remainingBudget: -actualSpent`, because "you are 150 over" is the true
sentence and `null` says nothing at all.

**`executionPercentage` is the only nullable field in the contract,** and only
when `budgetAmount === 0`. It is not a stylistic null:

- `0%` would be a lie — it claims nothing was consumed while 150 may have been spent.
- The same `0` would collapse "spent nothing" and "spent with no budget", which are opposite situations.
- `150 ÷ 0` is undefined, not `0`, and not a large number either.
- JSON has no `Infinity`. `JSON.stringify(Infinity)` produces `"null"`, so any attempt to send one arrives as a null the client cannot distinguish from an error.

The render rule, which commit 8 implements:

| `executionPercentage` | Card | Progress bar |
|---|---|---|
| a number | `42%` | drawn at that value |
| `null` | `—` | **not rendered**, not rendered at 0% and not rendered full |

`null` in the payload is not `null` on screen. A bar drawn at 0% for a null
percentage re-tells the lie the null exists to avoid.

`totals.executionPercentage` follows the same rule when the budget sum is zero,
and **every** monetary field of `totals` is null when the set mixes currencies —
with `MIXED_CURRENCY_NOTICE` in `meta.notices`. The per-account rows keep their
own amounts, so the screen still has something to show.

### 10.7.4 What the write response gives the confirmation line

`PUT /budget/accounts/:accountId/current` answers with `budgetMonth`,
`budgetAmount`, `onlyThisMonth`, `restoresTo` and `restoresFrom` — the last two
so the modal can word "September returns to $X" without resolving a month on
the browser's clock. `restoresTo` is `null` when the change is recurring, and
`0` — not null — when the exception restores nothing, which reads *"September
will have no budget"*.

## 10.8 FE integration required by commit 3 — `feat(budget): add month series endpoint`

Same standing rule as §10.7: commit 3 is backend-only, **nothing here is
implemented by it**, and it is listed now so commits 5, 6 and 10 find no surprise
at runtime. `/series` is what replaces the retired `GET /budget/history/:id`.

### 10.8.1 The route, and the two parameters that travel

`GET /api/fintrack/budget/accounts/:accountId/series?from=&to=`

| Parameter | Rule |
|---|---|
| `from`, `to` | Optional. `YYYY-MM` or `YYYY-MM-DD`; the day is discarded, so `2026-08-17` and `2026-08-01` are the same request |
| default `to` | The current month, resolved on the **account owner's** calendar |
| default `from` | `to − 11 months` — the twelve-month window the history screen opens on |

This is the **only** budget route that accepts a date, and the exception is
narrow: the current month never travels, because the server computes it and a
client-supplied one would be the device's clock. A historical range does travel,
because the server cannot guess which months the user is looking at.

**The frontend must not compute the default range.** Sending nothing is not the
same as sending `from`/`to` derived from `new Date()`: the browser's month and
the account owner's month differ for part of every day, and the request that
omits them is the one that lands on the right calendar.

### 10.8.2 The response shape

```ts
type BudgetMonthType = {
 month: string;              // 'YYYY-MM-01'
 budgetAmount: number;
 actualSpent: number;
 remainingBudget: number;
 executionPercentage: number | null;
 isOverBudget: boolean;
};

type BudgetSeriesResponse = {
 accountId: number;
 accountName: string;
 currency: string;           // stated once, not per month
 from: string;
 to: string;
 months: BudgetMonthType[];
 totals: {
  budgetAmount: number;
  actualSpent: number;
  remainingBudget: number;
  executionPercentage: number | null;
  monthsOverBudget: number;
  averageMonthlySpend: number;
 };
};
```

`months` is **contiguous and gapless**: every month between `from` and `to` is
present, including the months before the account's first allocation, which come
back with `budgetAmount: 0`. The chart indexes the array directly and never fills
a hole.

The nullability rule of §10.7.3 applies unchanged, at both levels:
`executionPercentage` is the only nullable field, `null` exactly when the
corresponding `budgetAmount` is `0`. A month with `null` renders `—` and **no
bar**; the same holds for `totals.executionPercentage`.

### 10.8.3 The three folds the frontend must not write

`totals` exists so the client never derives these. Slicing is free — a quarter is
three consecutive entries of `months`, and adding three `budgetAmount` values is
addition, not a rule. What must never be derived:

| Never write | Because |
|---|---|
| `avg(months.map(m => m.executionPercentage))` | A range's percentage is `SUM(actual) / SUM(budget)`. The average weights a month budgeted at 10 the same as one budgeted at 10,000, and produces a number that looks right and is wrong |
| `actualSpent / months.filter(...).length` | `averageMonthlySpend` divides by **every** month in the range. Any smaller denominator reports an average higher than any month actually spent |
| `months.filter(m => m.budgetAmount > 0).length` as a "budgeted months" count | There is no such state to count (decision 39). A month of `0` is a month with an effective budget of `0`, like any other |

### 10.8.4 `/export` gains a range, and keeps `accountId`

| Old | New |
|---|---|
| `GET /budget/export?accountId=` | `GET /budget/export?accountId=&from=&to=` |

All three are optional and independent. `accountId` omitted covers every budget
account owned; **`from`/`to` omitted collapse to the current month**, which is
what the endpoint already did — the export default is deliberately *not*
`/series`' twelve months, so a download button that sends no parameters keeps
returning the file it returned before.

The file is one row per account **per month**, and the `Month` column now varies
down the file. Only budgeted months are emitted: an unbudgeted month would be a
line of zeros indistinguishable from a budget that was never spent. The filename
carries the range — `budget_export_2025-09-01_2026-08-01.csv` — and collapses to
the single month when `from === to`.

### 10.8.5 Errors

The envelope is the module's, not the one `PLAN_BUDGET_V1` §7.5 originally
froze — that section was corrected on 2026-08-12 to match what ships:

```json
 { "status": 400, "message": "Validation Error",
   "errors": [ { "field": "from", "message": "...", "code": "invalid_format" } ] }
```

| Status | The client's case |
|---|---|
| `400` | A malformed bound, or an unknown query key. Every schema is strict |
| `403` | The account is not the caller's — **or does not exist**. There is no `404` in this module, deliberately: splitting them would let a caller enumerate other users' account ids |
| `422` | The range parsed but is not answerable: `from > to`, `to` later than the current month, or a span over 60 months. Carries `status` and `message`, no `errors` array |

A `422` is a message the user can act on ("that range is too wide"), not a bug
report. The history screen has to render it as text next to the range picker,
not as a generic failure.

## 10.9 The view-by-view restructuring — what commit 9 actually does

Written 2026-08-13 from a full audit of every screen that renders or computes a
budget figure. This supersedes the one-line description of commit 9 in §10.3:
that row named two files, and there are **nine sites across seven**.

Read the whole section under one correction the owner made explicitly: **no view
is deleted, and no rendered element is deleted.** What changes is where a number
comes from — a client-side formula becomes a served field. `statusAlert` is not
removed either; its *source* and its *threshold* change.

**Nothing is deleted outright.** Under the rule dictated 2026-08-13, an approved
removal is **commented out**, not erased, and registered in V1 §9.4 so the whole
set comes out in one block once the module is verified working (commit 13, D8).

### 10.9.1 The navigation the module actually has

Three levels, and the request count is the point:

```
 Budget (categories)  ──click──►  Accounts of a category  ──click──►  Account detail
```

| | Requests today | Requests after |
|---|---|---|
| Level 1 | 2 — `BudgetLayout.tsx:15` and `ListCategory.tsx:43` | 1 — `POST /budget/accounts/status`, no body ids |
| Level 2 | 1 — `CategoryAccountList.tsx:57` | **0** — filter `accounts[]` by `categoryName` in memory |
| Level 3 | 1 account fetch (fallback) + 1 transactions fetch | transactions only; the budget row is already in memory |

Three budget requests collapse to one. This is the standing minimum-requests
constraint applied to the drill-down, and it is the reason the amended body
carries `categories[]` instead of a second endpoint: an endpoint per level would
have been five requests to walk the path.

### 10.9.2 Level 1 — Budget, the category list

| File | Status today | Proposal | Impact |
|---|---|---|---|
| `pages/budget/BudgetLayout.tsx` | Own request to the dashboard route (`:15`); builds `bigScreenInfo` with three entries (`:44-48`) | The **single** call to `/budget/accounts/status` with no `accountIds`; header fed from `totals`; response handed down through the `Outlet` context | −1 request. `bigScreenInfo[2]` (`expenses`) is built and discarded — `BudgetBigBoxResult` reads only indices 0 and 1. Measured impact of touching it: **zero**. Left alone; it is not part of this migration |
| `pages/budget/components/ListCategory.tsx` | Second request (`:43`); computes `total_budget = total_balance + total_remaining` (`:61`), `remain = -total_balance + budget` (`:85`), `statusAlert = remain <= 0` (`:87`), `remainPercentage` (`:92-95`) | Consumes `categories[]` from the context. `budgetAmount`, `remainingBudget`, `isOverBudget` and `executionPercentage` all arrive served. The four computations are commented out with a retirement marker | −1 request. **This is where the number on screen changes**: today it is a dashboard balance sum, afterwards it is the month's real budget. `statusAlert`'s threshold moves from `<= 0` to the server's `< 0` — open decision Q-A |
| `ListCategory.tsx:102-109` — the `state` handoff | Injects `categorySummaryDetailed` (a computed `remain` and `statusAlert`) into level 2 | Stops injecting; level 2 filters the same payload | Kills the duplicate computation, **but breaks entry by direct URL** unless level 2 has a fallback. That fallback is the point below |

### 10.9.3 Level 2 — the accounts of a category

| File | Status today | Proposal | Impact |
|---|---|---|---|
| `pages/forms/categoryDetail/CategoryAccountList.tsx` | Third request (`:57`); `calculateCategorySummaryInfo` (`:70-103`) and the `useEffect` that runs it only when `location.state` is absent (`:109-125`) | Reads the `categories[]` row whose `categoryName` matches the route param. Function and `useEffect` commented out | −1 request. That `useEffect` exists **only** as the fallback for the handoff above; it dies with it. Its own comment already concedes the single-currency assumption (`:114`) |
| `pages/forms/categoryDetail/ListAccountOfCategory.tsx` | Recomputes `remain` (`:55`), `statusAlert` (`:56`), `remainPercentage` (`:61-64`) — the same four formulas again | Filters `accounts[]` by the new `categoryName` field and renders the served values | No new request. Same threshold decision as level 1 |
| `ListAccountOfCategory.tsx:72` — the `state` handoff | Injects `detailedData: { ...account, remain, statusAlert }` into level 3 | Passes the `account_id` only | Removes the second producer of `remain` — finding **F-9** closes here |

### 10.9.4 Level 3 — the account detail

| File | Status today | Proposal | Impact |
|---|---|---|---|
| `pages/forms/categoryDetail/CategoryDetail.tsx` | `summaryData` (`:84-102`) reads `accountDetailed.remain` and `.statusAlert` — **fields that do not exist in any API response**; they exist only because the previous screen injected them. Conditional fallback fetch by id (`:67-75`) | Reads the `accounts[]` row from context; the fallback becomes `accountIds: [id]` | The screen stops depending on fabricated fields. Its transactions request (`:120`) and its two-month period (`:105-116`) are **untouched** — that is F-8, a different time frame, and V1 does not go near it |
| `pages/forms/accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx` | Recomputes both percentages: spent-over-budget (`:54-57`) and remaining-over-budget (`:38`) | Gains an **optional** `executionPercentage` prop: used when supplied, computed as today when absent | Shared with the pocket and debtor screens, which have no server figures. A straight substitution would break them; the optional prop is the only safe shape. Finding **F-6** closes here |

### 10.9.5 The helper

| File | Status today | Proposal | Impact |
|---|---|---|---|
| `editionAndDeletion/utils/categoryBudgetCalculations.ts` | `enrichCategoryAccountData` (`:18-30`): **zero importers**, rounds with `Math.round` — the fifth formula, and the only one that rounds — and carries a `console.log` at `:24` | Commented out whole, with a retirement marker. `isCategoryBudgetAccount` **stays**: `AccountingDashboard.tsx:266` uses it | None today. It prevents someone importing the stale formula while the module is mid-migration. This is **not** a licence to delete it now — D8 |

### 10.9.6 The inventory F-7 asked for, closed

Five client-side sites computed the same figure with **four different formulas**,
one of them rounding:

| Site | Formula |
|---|---|
| `ListCategory.tsx:85` | `-total_balance + (total_balance + total_remaining)` |
| `ListAccountOfCategory.tsx:55` | `-total_balance + budget` |
| `CategoryAccountList.tsx:93` | `-Σ balance + Σ budget` |
| `SummaryDetailBox.tsx:38` | `|amount2| / amount × 100` |
| `categoryBudgetCalculations.ts:21` | `Math.round(budget - balance)` |

All five collapse to `remainingBudget` and `executionPercentage`, served. F-7 is
closed by this table; it does not need re-measuring during commit 9.

### 10.9.7 Decisions this section leaves open

| id | Decision | Options | Recommendation |
|---|---|---|---|
| **Q-A** | The alert threshold | `remain <= 0` (today: spending exactly the budget already alerts) vs the server's `isOverBudget`, which is `< 0` | `isOverBudget`. Spending exactly the budget is not exceeding it, and one threshold in one place beats two that agree by accident |
| **Q-B** | Both percentages are useful and answer different questions — with 700 budgeted and 415 spent, execution says 59.3% and remaining says 40.7% | Show one, show both, or split them | Execution drives the bar and the colour; remaining stays in the `left`/`over` text. Never print two bare percentages side by side |
| **Q-C** | No view states which month it is reporting | Add the label, or leave it implicit | Render `referenceMonth` in the layout header. The figures became month-scoped at the backend and the UI never said so. **Closed 2026-08-14 by §10.10**, which makes that label the selector |
| **Q-D** | Whether the yearly accumulated figure is served too | `/series` already answers it via `totals` | Fold it into commit 10 rather than computing it — §10.8.3 forbids the client fold |

## 10.10 The month selector

Frozen 2026-08-14, against V1 decisions 40–43. The budget screen reports one
month and lets the user choose which. This section is the frontend half; the
contract half is V1 §7.4.

### 10.10.1 Why it is a contract change and not a control

The figures have been month-scoped at the backend since commit 2, and no view
says so — that is Q-C. A label alone would close Q-C. Making the label
*selectable* is a different thing: it adds an input to a request that was defined
as having none, so it is frozen in V1 §7.4 first and implemented after, never the
other way round.

The rule it appears to break survives intact. *The current month never travels*
is about the **default**, and the reason is the clock: a month the browser
computes lands on the wrong calendar for part of every day. A month the user
picked is not a computed default, and `/series` already carries exactly that
exception. So `month` is optional, and **omitting it is not the same as sending
the month the user is looking at** — the client omits it until the user chooses.

### 10.10.2 Where it goes, and how it survives the drill-down

The badge sits in `BudgetLayout.tsx`'s `layout__header`, beside `TitleHeader` and
above `BudgetBigBoxResult`, because the layout is what issues the request the
hero and the category list are drawn from.

It does **not** reach levels 2 and 3 by context. `budget/category/:categoryName`
and `budget/category/:categoryName/account/:accountId` are standalone routes
declared beside the layout, not inside its `children` (`App.tsx:190-203` versus
`:344-360`); only the index route hangs from the `Outlet`. Entering a category
unmounts `BudgetLayout` entirely.

*(This corrects §10.9's line for `BudgetLayout.tsx`, which describes the response
being "handed down through the `Outlet` context". That is true of the index route
and of nothing else. Commit 9 either moves levels 2 and 3 under the layout or
re-requests with the same month; it may not assume the context reaches them.)*

So the month travels as a query parameter, `?month=YYYY-MM`, on every budget URL.

| Carrier | Survives navigation | Survives F5 | Shareable link |
|---|---|---|---|
| `?month=` | yes | **yes** | yes |
| store | yes | no | no |
| `location.state` | yes | **no** | no |

The third row is not hypothetical: this module already breaks on reload for
depending on `location.state.previousRoute`. Adding the month to the same carrier
would widen a live defect.

### 10.10.3 The control

A new `general_components/monthPicker/MonthPicker.tsx`, over the
`react-datepicker` already installed. Not a widening of `Datepicker.tsx`: that
wrapper is a day picker consumed by every form, and a control that accepts a day
here would promise a precision the module does not have — the day would be
discarded on the wire.

| Aspect | Rule |
|---|---|
| Granularity | Month. The value emitted is the first of the month |
| Year | Native to the month view — a twelve-month grid with year navigation. The year needs no separate control and `YYYY-MM` carries it |
| Upper bound | The current month, read from `meta.currentMonth`. Not the browser's, and **not `referenceMonth`** — that is the month being reported, so on a deep link to a past month it would offer the month already on screen as the latest there is. Corrected 2026-08-15 by V1 decision 46 |
| Lower bound | None beyond the static floor the project's existing picker already uses. A month with no data is the empty state, which is owed anyway |
| Trigger | Badge. `.month-badge` is documented as non-interactive, so the selector's is a new class carrying default, `:hover`, `:focus-visible`, `:active` and `:disabled` |

Two implementation facts worth keeping, both found on screen (2026-08-15):

**The badge floats out of the header's flow.** `layout__header` is positioned
from a constant, `--header-content-height: 6.8rem`, and every absolute box under
it — the hero among them — is placed from that number. A child added to the
header's flow moves all of them. The badge is absolutely positioned against
`.headerContent__container` and hangs off its bottom edge, so the header's height
is unchanged. It lands on white there, which is why it wears `--light` while the
form's and levels 2–3's wear `--dark`.

**A month picked during another month's request wins.** The store's guard refused
any call while one was in flight, which silently dropped the second month and
left the badge reporting a month the user had moved off. It now guards on the
month key and discards the *older answer* on arrival instead.

### 10.10.4 What the screen renders

The label is the response's `referenceMonth`, never the month the client asked
for — the two differ on every request that asked for none, which is the first
one. Until the response arrives there is no month to show, so the badge is a
skeleton, not a guess.

A month the user selects that holds no allocation is **empty, not zero**: the
`<= M` resolution answers "no budget was in force", and a missing figure renders
as a dash or a skeleton, never as `0` or `NaN`.

### 10.10.5 What this section does not decide

Editing is unreachable from here: `CategoryDetail` has no link to `EditAccount`,
and the edit form is a standalone route. The question of what an edit means while
a past month is on screen — V1 permits no edit to a month earlier than the
current one — arrives with that link, and is not answered here.

### 10.10.6 The month down the drill-down (V1 decisions 44–45, 2026-08-15)

Levels 2 and 3 show the month and do not let the user change it. Each reads it
from `?month=YYYY-MM`; a level-1 badge that opens and two below it that do not
must not look alike, so the trigger carries an affordance — a chevron — that the
read-only badges omit.

**Corrected 2026-08-30 — both paragraphs below describe the state before commit 9, and
both are closed.** `CategoryAccountList.tsx:52-59` reads `accounts`, `categories`,
`referenceMonth`, `currentMonth` and `fetchStatus` off `useBudgetStatusStore`, and the
browser-side fold is gone — its own comment at `:166` records what it used to sum.
`CategoryDetail.tsx:94-105` does the same and takes its month from the URL as
`monthParam`, passing it to `fetchStatus` at `:122`; no `new Date()` builds the window
any more.

**Level 2 is blocked behind the contract, not behind the badge.**
`CategoryAccountList` does not consume `/accounts/status`. It fetches
`url_get_accounts_by_category`, a route with no month parameter, and folds the
category total in the browser at `CategoryAccountList.tsx:70-103` by summing
`account_balance` and `budget` across the accounts. `account_balance` is the
lifetime balance, so that total belongs to no month and a badge over it would
label a figure with a month that is not its own. The month reaches level 2 only
after commit 9 moves the view onto the contract, where it reads its row from the
server's `categories[]` and folds nothing.

**Level 3 already has a month, and it is the browser's.**
`CategoryDetail.tsx:105-116` builds the transaction window from `new Date()` —
two months back, serialised with `toISOString()`, so the bounds shift by a day in
any negative offset. A badge saying July over a list holding the last two months
from today is a screen contradicting itself. The window is derived from the
selected month, and `new Date()` leaves that file.

Three facts, three places — none of them claiming the other's scope:

| element | what it states | source |
|---|---|---|
| header badge | the scope: `July 2026` | `referenceMonth` from the response |
| `.period-info` | the window: `01/07 – 31/07` | the month's bounds |
| `AccountBalanceSummary` | each balance with the date of its movement | first and last transaction of the month |

The period label stays the calendar month because the budget and the execution
percentage are monthly; the activity span belongs beside the balances, where it
answers a different question. A month with no movements shows the last balance
known before it with its real date — not `account_starting_amount` stamped with
the window's bounds, which is what `getTransactionsForAccountById.js:134-158`
returns today and which prints `0` on a date nothing happened. `initialBalance`
and `finalBalance` are inconsistent at the source: the final one already carries
its transaction's date (:184-188), the initial one carries `startDate` (:177).

**Corrected 2026-08-30 — the inconsistency is gone and none of those three anchors is
live.** `getTransactionsForAccountById.js:486-487` is
`const getInitialBalance = () => getBalanceCarriedIntoPeriod(period.periodStartDate);`
with no month branch, and `getBalanceCarriedIntoPeriod` (`:388`) resolves the
no-movement case in one SQL statement with a `COALESCE`, so the carried-in balance
carries the date of the movement that struck it. `getFinalBalance` is at `:489`. The
requirement this paragraph states is met; what is described as owed is what shipped.

**Carrying the payload.** Every level remounts, because all three are separate
routes. Two ways to feed them:

| | one request per level | one request for the three |
|---|---|---|
| how | each view calls `/accounts/status?month=` and filters in memory | a **pathless parent route** holding the fetch and rendering only `<Outlet/>` |
| requests per drill-down | 3 | 1 |
| visual change | none | none — the parent renders no chrome |
| cost | the same response fetched three times | the three routes hang from a common parent |

The pathless parent is what satisfies the minimum-requests rule without touching
how any page looks: level 1 sits inside `<Layout>` and levels 2–3 are standalone,
which is why they differ, and a parent with no path above both branches keeps
that difference intact while sharing the data. It must skip the fetch outside
`/fintrack/budget`, which `useFetch` already supports with a null URL.

---

## 10.11 Level 4 — the transaction detail modal (recorded 2026-08-15, not scheduled)

Clicking a row opens the detail. The component already exists:
`overview/components/transactionDetailModal/TransactionDetailModal.tsx`. It takes
the transaction as a prop and fetches nothing — the list already holds the object,
so level 4 costs zero requests. It is reused, not rebuilt.

Its existence settles where the narrative belongs: in the modal, not in the row.
An account id is noise in a list and legitimate in an audit detail, which is why
the reference mockup leads with `Transaction Details (#88)`.

### 10.11.1 Why the modal cannot be filled from `description`

The question was asked and the answer is no. The stored sentence reads
`... Received 1.59 Usd In Account "…" # 21, From "Cuenta Precargada" # 24 (Bank).`
— that amount is the **converted** one, in the account's currency. The original
amount, the original currency, the rate and the rate timestamp were never written
into it, so the whole FX section of the modal is unreachable by any parser.

Beyond this instance: the sentence is not a contract and nobody versions it, so a
reworded template breaks the parser against rows already written; the user's own
note is concatenated into the same field with no delimiter, so a note containing
`From`, `#` or `Account` shifts the parse; and the values in it are
locale-formatted strings, so recovering a decimal from one loses precision. The
symptom is already on screen — `description.split('Date:')` in
`AccountTransactionsList.tsx:86-95` is why the date renders as grey prose instead
of a field.

The data does not need recovering. `original_amount`, `exchange_rate`,
`exchange_rate_source`, `exchange_rate_timestamp` and `original_currency_id` are
columns (`createTables.js:168-174`), and `SELECT tr.*` already carries four of
them to the browser.

### 10.11.2 What level 3 does not send

Six fields the modal reads are absent from `AccountTransactionType`. Two are
missing from the SQL; four are missing only from the TypeScript type:

| field | read at | gap | effect if reused today |
|---|---|---|---|
| `original_currency_code` | :73, :87, :136, :149 | **SQL** — `currencies` is joined once, on `tr.currency_id`, never on `original_currency_id` | `showFXCard` is false, so the FX section silently never renders |
| `transaction_type_name` | :61 | **SQL** — `transaction_types` is joined at :113-114 but its column is never selected | the badge reads `N/A` |
| `original_amount` | :41 | type only | — |
| `exchange_rate` | :54, :77 | type only | — |
| `exchange_rate_source` | — | type only | — |
| `exchange_rate_timestamp` | :36 | type only | — |

The degradation is silent: no error, the FX section just disappears. On an audit
screen a missing rate is worse than a failing one. The two SQL fields ride in the
same commit as the balance dates — it opens that query anyway.

### 10.11.3 The real defect: one entity, two types

`TransactionDataType` (overview) and `AccountTransactionType` (level 3) describe
the same row twice and diverge exactly where the modal needs them. While both
exist, every new screen picks one and the modal needs another adapter. Level 3's
`account_balance_after_tr` is a legitimate extension, not grounds for a parallel
type. `AccountTransactionType` also carries `user_id`, so the user's UUID travels
to the browser on every row; it goes when `tr.*` becomes an explicit column list.

### 10.11.4 Mockup deltas, for when this is scheduled

The reference image is a style and layout example with invented data. Against the
component as it stands: an ACCOUNT CONTEXT card naming source and destination is
new and needs two joins on `user_accounts`; TRANSFER SUMMARY reorganises what the
FX card already holds; the mockup shows one badge where the component shows two,
drops Rate Clean, and drops the footer button. Two cautions — the mockup omits
**Description**, the only field the user writes, which should stay; and its
`Account Type: Ingreso` is a Spanish value inside an English interface, seeded
that way in `account_types`.

---

## 10.12 The level-2 row, and lists at production scale (2026-08-15)

### 10.12.1 The row stops rendering a composed string

`ListAccountOfCategory.tsx:78` renders `account_name` raw, and the stored name is
`Transport/Public/Must` — so the category repeats on every row under a title that
already states it. It cannot be removed from the render, because the row holds no
category field to drop; removing it there means `account_name.split('/')`, the
same prose-parsing trap as §10.11.1.

All three segments are already columns: `category_name`, `subcategory` and
`category_nature_type_id` → `category_nature_types`, seeded `must | need | other |
want` (`createTables.js:82-85`, `populateDB.js:306-309`). **Decision: the row
renders `subcategory` as its title and the nature as a tag** — two elements, no
separator, because writing `Public/Must` would recompose by hand the string being
taken apart. `subcategory` is nullable (`VARCHAR(25)`), and falls back to
`account_name`.

Nature earns its place because it **varies between accounts of the same
category** — `Transport/Public/Must` and `Transport/Taxi/Want` coexist — so in a
list scoped to one category it distinguishes rows rather than repeating a
constant. It costs one join in `ACCOUNTS_QUERY`, which already joins
`category_budget_accounts`, and it enters with the `month` commit because the
contract is not built yet. If the tag takes colour, the tokens must already
exist; none are to be invented.

Navigation is unaffected: `ListAccountOfCategory.tsx:70` links by
`account/${account_id}` and level 3 reads `:accountId`. The label and the route
are independent. Where a name *is* load-bearing is level 2's own URL,
`/budget/category/aseo%20hogar` — renaming a category breaks the link. Recorded,
not opened: `category_budget_accounts` is organised by name and changing that is
schema.

Two defects in the same file: `key={indx}` at :67 should be `account_id`, and
:83-91 carries inline styles with a bare `0.5px`.

### 10.12.2 Long lists — production already runs 100+ expense accounts

The pressure is at level 1, which lists categories; level 2 lists the accounts of
one category and stays short. The place scale actually bites the backend is
neither: `getMonthlySeriesForAccounts` over 100 accounts × 60 months is 6,000
rows per request, and that arrives with commit 10.

**The rule that governs every option here: filtering must never change the
totals.** A board filtered to "over budget" still shows the whole board's budget
and spend in its header, or says explicitly that it is showing a subset. So
filtering and sorting happen on the client over the complete payload — the client
holds every row, the totals stay the server's, and there is no path where the two
disagree. Server-side pagination would turn one request into N and is rejected.

| option | verdict | reason |
|---|---|---|
| search box | take | filter over rows in memory |
| sort (spend, % consumed, A-Z) | take | `executionPercentage` already ships per row |
| status pills | **unblocked 2026-08-17** | `Over budget` exists. **`Near limit` is fixed at 75%** by the developer — the business rule this row was waiting for. `over` stays served (`isOverBudget`); `near` is `executionPercentage >= 75` and not over, which applies a presentation threshold to a served figure rather than recomputing one |
| sticky action bar | take | CSS only, the cheapest win here |
| super-category accordion | schema, not UI | see below |
| infinite scroll | reject | hiding rows behind scroll breaks "see everything" and kills Ctrl+F on a financial list |
| virtualisation | premature | 100–200 simple rows do not trouble the DOM. Revisit past ~500; it is a new dependency |

The threshold must exist **once**, next to whatever computes the status — a pill
at 80% beside a status square at `remain <= 0` is a list contradicting itself.
`statusAlert` is computed in the client in three files today, so where it lives
is an open item for commit 9.

**The accordion.** Grouping `Aseo`, `Aseo Hogar` and `Aseo Person` under a parent
`Hogar & Limpieza` has no basis in the model: `category_name` is a flat
`VARCHAR(50)` with no parent table. It means a new table, a migration, an
assignment UI and a backfill of 100+ existing accounts — a schema design, held to
the rule that migrations are right the first time. What *does* exist is
`category_name` → `subcategory`, which is precisely levels 1 and 2. An accordion
expanding a category's accounts in place costs no schema — but it **competes**
with the drill-down designed in §10.10: fold level 2 into level 1 and the URL
month, the read-only badges and the pathless parent lose half their purpose.
Recorded as the alternative it is, not merged into work in flight.

### 10.12.3 When each piece lands

| piece | when | why there |
|---|---|---|
| nature tag on the level-2 row | **the `month` commit** | the contract does not exist yet; later means reopening it |
| sticky bar | any time | CSS, touches no data |
| search and sort | **unblocked, measured 2026-08-15** | The condition was that they filter the contract's payload. They now do: level 1 reads `state.categories` (`ListCategory.tsx:42`), level 2 reads `state.accounts` (`CategoryAccountList.tsx:43`), and both carry `RETIRED by commit 9` / `9b` markers over the retired formulas. What is left of 9 is level 3's `SummaryDetailBox`, which search and sort never touch |
| `Near limit` threshold | decided **in commit 9** | it belongs with whatever computes status, and 9 is what moves it off the client |
| `/series` measured at 100 accounts | commit 10 | where the volume actually appears |
| super-categories | V2, with its own schema design | migration, backfill and an assignment UI |
| virtualisation | past ~500 rows | a new dependency that buys nothing today |

### 10.12.4 The alert block and the colour of `Remaining`

> **LEVEL 1 IS FROZEN — 2026-08-15.** An attempt to add the colour here also
> straightened the row's markup: it removed the stray dot from
> `className='box__container .flx-row-sb'`, lifted the inline styles into
> classes, and wrapped the amount in a span. The dot removal activated a flex
> layout that had never applied, and the row's layout changed. Reverted, and the
> level is closed.
>
> Nothing in this section is to be implemented on level 1. The lesson is the
> scope, not the colour: the colour was two CSS rules, and everything that broke
> came from the tidying attached to it.
>
> **Pocket moved out of this document on 2026-08-15** and now lives in
> `PLAN_POCKET_ALERT.md`, which has to be reviewed before it is executable. What
> stays here is the record of what budget did and why.

Asked for by the developer, and it extends to Pocket in the same terms.

**What exists today, measured.**

| place | file:line | state |
|---|---|---|
| Level 1 rows — status square | `budget/components/ListCategory.tsx:150` | **Renders.** `<StatusSquare alert={isOverBudget ? 'alert' : ''} />`, driven by the served flag |
| Level 1 rows — `over` / `left` word | `ListCategory.tsx:111-112` | **Renders.** `remainingBudget < 0 ? 'over' : 'left'`. The word carries the sign; the colour does not |
| Level 1 rows — the amount's colour | `ListCategory.tsx:155` | **Absent.** One class for both signs |
| Hero — status square | `budget/components/BudgetBigBoxResult.tsx:69-76` | **Absent.** The `Remaining` line has no indicator at all |
| Hero — the amount's colour | `BudgetBigBoxResult.tsx:73` | **Absent.** `displayScreen--result` is the same class as `Spent` |
| Pocket views | — | Same two gaps. Scope confirmed by the developer in the same message |

So the block is not new work everywhere: level 1 already has the square, and what
is missing there is only the colour. The hero is missing both.

**The rule this obeys.** §10.12.2 already fixed it: the threshold must exist
**once**, next to whatever computes the status. A square at `remain <= 0` beside a
differently-coloured amount is the same list contradicting itself. The server
serves `isOverBudget`; nothing on screen may re-derive it from the sign of the
amount when the flag is in the payload.

**Scope, as settled.** Budget views, Pocket views, and the Overview saving goals —
the same alert convention in the three, since they are the same reading.

| open decision | why it is not settled here |
|---|---|
| Which tokens colour `over` and `left` | `--color-financial-negative` / `--color-financial-positive` are the obvious pair — overspending is an effect on net worth, not a direction of money — but a token is never chosen without the developer |
| Whether `left` is coloured at all | Colouring only the exception is a legitimate reading: green on every row in range is noise, and the square already says "fine" by being off |
| The `Near limit` third state | §10.12.3 puts this decision **in commit 9**. It needs a threshold, which is a business rule and does not exist in the model |

## 10.13 Search, sort and the long list at level 1

Opened 2026-08-15. Named by the developer as the critical path to closing the
module. Supersedes the three scattered rows §10.12.2 and §10.12.3 gave the
subject. **Scope is level 1 only**; level 2 inherits the same hook and the same
component and gets its own section once level 1 is on screen.

### 10.13.1 The problem, stated where it actually is

Level 1 lists categories. Production runs 100+ expense accounts and those fold
into categories, so this list grows with how finely the owner organises their
spending — not with how many transactions they record. It is the longest list in
the module and the one every session starts on. The screen offers exactly one
tool for it: the scrollbar.

**There is already a symptom in the code.** `Budget.tsx` renders the *New
Category* button twice, at `:32-38` and again at `:44-50`, above and below the
list. Nobody duplicates an action button on a short list. That duplication is a
compensation for a scroll that was already uncomfortable, applied to the action
instead of to the list.

### 10.13.2 One idea, three controls

Search, sort and the scroll treatment are not three features. They are three
answers to one question — **how does the reader reach the row they came for?** —
and which one applies depends on what the reader already knows:

| the reader… | the control | what it does to the list |
|---|---|---|
| knows which category | **search** | Shortens it to one row |
| does not, and wants the worst | **sort** | Puts the answer at the top |
| does not, and is browsing | **the sticky bar** | Leaves the list alone, keeps the controls reachable while they read |

**The principle underneath, and the one that decided every rejection below: the
scroll is a symptom, not the problem.** Making the scroll smoother — animating
it, virtualising it, paginating it — treats the symptom. Making the list shorter
treats the cause. A reader who finds their category in one keystroke never
scrolls at all, and no amount of scroll polish beats not scrolling.

This is why virtualisation is not the answer here even though it is the usual
one. It makes a 500-row list cheap for the **browser**, and does nothing for the
**reader**, who still has 500 rows to walk past.

### 10.13.3 What is rejected, and why the reason matters

| option | verdict | reason |
|---|---|---|
| Pagination | **Reject** | Turns one request into N, against the standing minimum-requests directive, and hides rows behind a control on a screen whose purpose is *see everything* |
| Infinite scroll | **Reject** | The same objection, plus it defeats the browser's own find-in-page, which on a financial list the reader already relies on |
| Server-side search | **Reject** | The full inventory is already in memory. A request per keystroke is the exact inverse of the directive |
| Super-category accordion | **Not a UI option** | `category_name` is a flat `VARCHAR(50)` with no parent table. New table, migration, assignment UI and a backfill of 100+ accounts. Schema design, V2 |
| Virtualisation | **Defer past ~500 rows** | A new dependency that answers DOM cost, not reader cost. Revisit only if a *filtered* result is still long |
| A–Z index rail | **Defer** | Earns its space only once the list is name-sorted and long enough that a filtered result still scrolls |
| Collapse a category in place | **Reject for now** | Competes with §10.10's drill-down: folding level 2 into level 1 costs the URL month, the read-only badges and the pathless parent half their purpose |

### 10.13.4 The invariant

**Filtering never changes the totals.** Fixed in §10.12.2, restated here because
it is what the whole design is arranged around: the header keeps the server's
figures and the list states that it is showing a subset. The hook therefore
returns `matched` and `total` alongside the rows — a filtered list that does not
announce itself reads as a short one, and a reader who believes they are seeing
everything will trust a wrong total.

There is no arrangement of these controls where the header and the rows can
disagree, because the header never reads the rows.

### 10.13.5 Where the state lives

`?q=` and `?sort=` beside the existing `?month=`, through the same
`useSearchParams` the level already reads. Three consequences, and the third
decides it:

- The back button restores the filter.
- A filtered view is shareable.
- **Entering a category and returning does not lose the search.** The drill-down
  is the central flow of this module; a filter that clears every time the reader
  looks at something is a filter they stop using.

Written with `replace: true` so typing does not stack history, and on key-up
rather than per keystroke. `MonthPicker` is the precedent for a control in this
layout that writes to the URL.

> **Open, and the sequence is built on it:** this is decision D2, recommended and
> not yet confirmed. If it is overturned in favour of component state, commit 3
> changes shape and commits 1, 2, 4 and 5 do not.

### 10.13.6 What the level-1 freeze permits

Level 1 is frozen: a colour commit also straightened the row's markup, activated
a flex layout that had never applied, and reflowed the row.

**The freeze is read by its cause — what it forbids is editing existing row
markup.** This sequence stays outside it:

- `ListCategory.tsx` gains **one element** before its `<article>` and reads the
  filtered array instead of the raw one.
- The `.map` body is not edited. `.box__container`, `.box__title--spent`, the
  status square and the subtitle are untouched.
- **R56 is not fixed on the way past.** The stray dot stays; removing it
  activates the flex layout and reflows the row, which is the frozen behaviour.

### 10.13.7 The commit sequence

| # | commit | files | why here |
|---|---|---|---|
| 1 | `feat(budget): add the list filter hook` | **new** `pages/budget/hooks/useBudgetListFilter.ts` | Pure function over rows, no consumer. Lands inert so the sorting rules are reviewable before a screen depends on them |
| 2 | `feat(budget): add the list controls bar` | **new** `pages/budget/components/BudgetListControls.tsx` and `pages/budget/styles/budgetListControls.css` | The bar with its five states, mounted nowhere. The sort control is a **native `<select>`**, not `DropDownSelection` — see D-A |
| 3 | `feat(budget): search and sort the categories` | `ListCategory.tsx` (+1 element) | **The first commit the reader sees.** Search matches `categoryName`; sort offers Name A–Z, Spent, Remaining, % consumed |
| 4 | `feat(budget): filter the categories by status` | `BudgetListControls.tsx`, `budgetListControls.css`, `ListCategory.tsx` | The `All` / `Over budget` chips over the served `isOverBudget`. Introduces no threshold, so it does not touch the `Near limit` question |
| 5 | `style(budget): keep the controls in reach` | `budgetListControls.css` | Sticky bar. CSS only, no markup, no logic |

Commits 1 and 2 are deliberately invisible. Commit 3 is where the behaviour
appears, and it is the smallest possible diff on a frozen file.

**Landed:** commit 1 is `4eb063c` (pushed), commit 2 is `ae7e17d`.

> **Corrected 2026-08-23 — all five landed, and two more after them.** Commit 3
> is `fbbff56` *(search and sort the category list)*, commit 4 is `0b947f3`
> *(status filter and near limit)*, and the bar was then reworked twice:
> `38fefe6` made it one control strip and `9c9a11c` extracted its icons. The bar
> is mounted on **two** screens, not one — `ListCategory.tsx:168` at level 1 and
> `ListAccountOfCategory.tsx:176` at level 2, both through the same
> `useBudgetListFilter` hook.
>
> **Row 5 was reversed on purpose and the reversal is the current behaviour: the
> bar is not sticky.** `budgetListControls.css:10` states it and gives the
> reason. The row above is left as written because it records what was planned;
> this note records what shipped.

**D-A — the sort control is a native `<select>`, settled 2026-08-15.** The first
draft of row 2 reused `DropDownSelection`, and the measurement overturned it:
that component exposes no `value` prop — the selection lives inside `react-select`
and is reachable only through `selectRef.current.clearValue()` — it is
`isClearable` where `BudgetSortKey` has no empty member, and it requires a dead
`isReset` / `setIsReset` pair. Under D2 the state is the URL, so a page opened on
`?sort=spent` would sort the list while the control still showed its placeholder.
Making it controlled means editing a component **eight screens import**, inside a
feature commit. A native `<select>` takes `value` and is controlled by
construction; the caret and the surface are drawn from tokens, so the only thing
given up is the shared widget's look.

**D-B — the bar owns the "no results" message, settled 2026-08-15.** §10.13.6
permits `ListCategory.tsx` exactly one new element. Rendering the empty state
inside the list would spend a second one on a frozen file, and the bar already
holds `matched` and `total`, which is what the message has to state.

### 10.13.8 Three rules this sequence carries

1. **No tidying rides along.** The lesson that froze this level. These commits add
   elements and consume a filtered array; they do not restructure what is there,
   and defects found while working are recorded, not fixed in passing.
2. **Nothing is computed to sort by.** Every sort key is a field the contract
   already ships. `executionPercentage` in particular: recomputing it would put a
   second rounding beside the server's.
3. **A withheld figure is not a zero.** The server nulls the totals of a set
   holding more than one currency rather than adding them at an implicit 1:1.
   Those rows sort last in every direction, never among the healthy ones.

### 10.13.9 Verification

No test runner exists (F-15). After each commit: `tsc -p tsconfig.app.json
--noEmit` must exit 0, plus this on-screen pass.

| # | check |
|---|---|
| 1 | **Totals never move.** Note the three header figures, type a term. The header must be identical and the list must state the subset |
| 2 | **The month survives.** With `?month=` on a past month, search and sort: the badge must not change and the figures stay that month's |
| 3 | **The drill-down survives.** Search, enter a category, come back — the term is still applied |
| 4 | **Empty is a state.** A search matching nothing renders a message, never a blank area and never a zero |
| 5 | **Ties are stable.** Two categories with the same spend keep their order across renders |
| 6 | **The row did not move.** Compare against a screenshot taken before commit 3: pixel-identical, only the bar above is new |
| 7 | Keyboard only: tab to the search box, the sort control and the chips. Each shows a focus ring |

---

## 10.14 The level-3 row: the note and the running total (2026-08-16)

Two figures the row is meant to gain, decided together because both are already
in the response and neither costs a request.

### 10.14.1 The note is served, not split in the client

> **Landed 2026-08-17.** `c3ffd61` serves it, `dea60ee` renders it. Both pushed.
> The three properties below hold as written; §10.14.7 records what the second
> commit decided that this section did not anticipate.

Measured and recorded as **R62**. The extraction already exists, and it is in the
frontend: `ListContent.tsx:69` renders
`description.split('Transaction')[0]`, cutting on the word without its colon.
Overview reaches it through `LastMovements`.

**Decision:** the same rule moves to the backend as one helper,
`extractNoteFromDescription`, placed beside the existing transaction utilities.
Two consumers: the account-detail controller and the dashboard controller that
feeds Overview. `ListContent.tsx:69` then consumes a served `note` field instead
of cutting.

The reason is not tidiness. The level-3 row needs the same note; copying the
split into `AccountTransactionsList` would leave **two** readings of the server's
own format inside the client, on a sentence ten backend sites compose and nobody
versions — of which **only two ever prepend the owner's note** (R62's table).
One rule, one place, on the side that already owns the format —
so the day the `note` column exists, only the helper changes.

Three properties this carries, all consequences of R62's table:

1. **An empty result is a dash, not blank space.** Three of the five measured
   cases return `''`. The row obeys the project rule for a missing value; it does
   not paint an empty paragraph.
2. **The reversal prefixes are not the owner's words.** `Expense Reversal. ` and
   `Income Reversal. ` survive the split today and read as if typed. The helper
   strips them; they belong to the narrative, which the modal shows in full.
3. **The interim label stays visible.** This is a heuristic, adopted knowingly.
   The `note` column remains the correct fix and stays deferred — R62 is not
   closed by this work, its interim form is.

**Scope: all six account types.** `getTransactionsForAccountById.js` is the only
endpoint behind every account detail and `AccountTransactionsList` the only list
component, so the change lands once and reaches all of them at no extra cost.

### 10.14.2 The running total is already served, including the month's total

`getTransactionsForAccountById.js:210-212` computes the window `ORDER BY ... ASC`
while `:227-228` returns the rows `ORDER BY tr.transaction_actual_date DESC`. The
two orderings are independent, so the **first** element of the array carries the
sum of everything before it:

```
transactions[0].month_cumulative_spent  ===  the whole month's total
```

No new field, no second request (D12). Two caveats that are part of the contract:

- It exists **only** in `window.mode === 'month'`. The by-account branch does not
  select it.
- A month with no movements returns no rows, so the total is *absent*, not zero.
  It renders as a dash.

### 10.14.3 Where the MTD belongs across the three levels

The finding that shrinks this work: **at levels 1 and 2 the MTD is not a new
figure.** It is the name of the one already on screen, because `actualSpent` is
the spend of the selected month, and when that month is the current one, that is
the MTD.

| level | where | figure | source | verdict |
|---|---|---|---|---|
| 1 hero | `BudgetBigBoxResult` | `totals.actualSpent` | served | already rendered — nothing to add |
| 1 row | `ListCategory` | `categories[].actualSpent` | served | already rendered |
| 2 row | `ListAccountOfCategory` | `accounts[].actualSpent` | served | already rendered |
| 3 hero | `SummaryDetailBox` | `amount1`, from the budget module | served | **no second line.** It would print one number from two sources |
| 3 row | `AccountTransactionsList` | `month_cumulative_spent` per row | served | **this is the addition** — the progression, which no other level shows |

`transactions[0].month_cumulative_spent` is not painted in the hero. It is used as
a **check**: if it disagrees with the `amount1` the budget module serves, the two
counted sets have drifted and there is a defect. Free, and it occupies no pixels.

### 10.14.4 The counted set is what limits the MTD's scope

The running total sums **movement types 1 and 6 only** — `expense` and `transfer`
(`populateDB.js:373,378`). That set was chosen for a budget category, and it does
not transfer to the other account types:

| account type | its own movements | counted by `IN (1, 6)`? |
|---|---|---|
| `category_budget` | expense · transfer | ✅ exact — it *is* the spend |
| `bank` | expense · transfer · **pocket (5)** | ⚠️ undercounts: contributions to a pocket do not enter |
| `pocket_saving` | pocket (5) | ❌ would sit at zero |
| `investment` | investment (3) | ❌ |
| `debtor` | debt (4) | ❌ |
| `income_source` | income (2) | ❌ |

**Decision: V1 serves the running total on `category_budget` only.** On the other
five the field does not travel and the row shows nothing extra — an absent figure
beats a false zero, which is the same rule R59 broke one layer down. Deciding the
counted set per account type is account-detail work, not budget work.

This is the one place where §10.14.1's scope and this section's diverge, and
deliberately: **the note reaches all six account types; the total reaches one.**

### 10.14.5 The one thing missing at every level

Nothing on screen says the figure is **partial** while the month is running. The
same `$210.15` reads identically in a closed July and in a half-finished August.

A discreet marker in the hero of levels 1 and 3, rendered **only when the
selected month is the current one**, using `--font-size-xs` and
`--color-content-on-dark-subtle`:

```
 Spent
 $ 210.15   as of Aug 16
 ▪ 189.85 left (47.5%)
```

On a past month it disappears, because the figure is final. It does not go on the
rows — there it is repetition.

### 10.14.6 What this section does not decide

| left open | why |
|---|---|
| The `note` column | Deferred by decision. R62 stays open |
| The counted set per account type | Belongs to the account-detail block, with the label question it carries: types 1 and 6 read as *spend* on a category and as *outflow* on a bank |
| The modal | §10.11 owns level 4 and is unchanged by this. The narrative stays there in full; the row gets the note only |

### 10.14.7 What the row commit settled (2026-08-17)

Six decisions taken while `dea60ee` was gated. Each is measured, and each closes a
question §10.14.1–.6 either left open or got wrong.

| # | decision | evidence |
|---|---|---|
| **E** | **Only the in-progress mark, not the elapsed percentage.** §10.14.5's `as of Aug 16` ships; the *"40% spent on day 3 vs day 30"* pacing indicator does not. It belongs to `on-hold/PLAN_BUDGET/BUDGET_INDICATORS.md` | a figure alone does not say how much month has passed; a date does, at no interpretive cost |
| **F1** | **The per-row cumulative hides when the sort is not chronological.** The column is a *chronological* fact: under a sort by amount it stops being monotonic (150 → 150, 80 → 270, 40 → 190) and reads as broken. Level 3 has no sort or search today, so this is a rule recorded before the controls arrive | `getTransactionsForAccountById.js:340` — `month_cumulative_spent`; the `OVER(...)` orders ASC while the result set returns DESC, which is what makes the figure right *only* in date order *(the row read `:201-205`; re-anchored 2026-08-30)* |
| **H2** | **`Balance:` and the cumulative coexist on the row.** They are not alternatives: the balance is the accounting fact of the transaction, the cumulative is an indicator. Rejected replacing one with the other | ~~`account_balance_after_tr` is a stored audit fact (`createTables.js:157`)~~ — **corrected 2026-08-30: it is no longer a stored fact.** The column is declared at `createTables.js:165` and both writers now put an explicit `0.00` in it (`260c54f`); the figure the row renders is derived on read and emitted under the same wire name (`derivedBalance.js:252` — `withDerivedBalance`). The decision this row records is unaffected: the balance and the cumulative still coexist, and both are computed per request |
| **I0** | **No fallback to the movement name when the note is absent.** The row shows a dash | both surfaces already name the movement: `AccountTransactionsList.tsx:88-90` titles the row with it, and the six overview cards are titled `Last Movements (expense)` … `(PnL)` at `Overview.tsx:448-478`. See `DECISIONS.md §16` |
| **G** | **`user_accounts.note` is renamed `account_note`.** Labels and payloads now; the column migration travels with commits 11–13, and `pocket_saving_accounts.note` is dropped with it | it is a property of the account for its whole life, already edited by `accountEditController.js:104`. *"Opening account note"* was rejected: it is not about the opening |
| **J1** | **Two named length constants, `account_note` and `transaction_note`, both 90.** Same value today, two contracts | see the table below |

#### The note length, normalised

Both fields already cap at **90** on screen. Every other number in the chain is
unreachable, and three of them lie:

| capa | account note | transaction note |
|---|---|---|
| input | `textarea`, `maxLength` = `DB_MAX_LENGTHS.note` = 90 (`UniversalDynamicInput.tsx:101-103,144`) | `textarea rows={3}`, `maxLength={90}` **hardcoded** (`CardNote.tsx:18`) |
| zod | 90 (`commonEditionSchemas.ts:118`) | **150** (`commonSchemas.ts:137`) — dead validation, the input never lets 91 through |
| column | `VARCHAR(155)` (`002_accounts.sql:103`, `:201`) — 65 characters nobody can write | none: inside `description TEXT` (`003_transactions.sql:21`) |

**There are two symbols named `noteSchema`** — a value in
`validations/zod_schemas/commonSchemas.ts` and a factory in
`editionAndDeletion/validations_zod/commonEditionSchemas.ts`. That shared name,
not a schema defect, is what made this look like one field with three caps. **No
data is at risk in either environment**, which is why none of this is a corrective
migration: the column widths are edited in the file that creates them, before
Supabase runs the chain for the first time (D6).

| # | change | where | when |
|---|---|---|---|
| 1 | `.max(150)` → the constant | `commonSchemas.ts:137` | with G |
| 2 | the literal `90` → the constant | `CardNote.tsx:18` | with G |
| 3 | `VARCHAR(155)` → `VARCHAR(90)` | `002_accounts.sql:103`, `:201` | commits 11–13 |
| 4 | the future transaction-note column → `VARCHAR(90)` | R62 | commits 11–13 |

Recorded as **R64**.

#### What `dea60ee` also fixed, unplanned

The note render was inside a `{description && …}` gate, correct while the block
only showed pieces cut out of `description` and wrong the moment the note started
arriving on its own — a row with no composed sentence showed no note either. Only
the `Date:` line stays gated, because it is still cut from the prose.

**That line is the section's open KO.** It needs `transaction_local_date` on the
legacy `?start=&end=` branch, which `AccountDetail.tsx:127`, `PocketDetail.tsx:104`
and `DebtorDetail.tsx:147` all use and which serves no local date today. Only
`CategoryDetail.tsx:156` asks for `?month=`.

---

## Corrections of 2026-08-30 — measurements only

Assertions about the code, corrected in place. **No decision was closed, deleted or
reworded; no commit was reordered; §10.12.4's freeze on level 1 stands.**

| where | what was asserted | what the code says today |
|---|---|---|
| STATE 2026-08-23, row 1 | the FX-audit diagnosis is evidenced at `accountEditController.js:338-351` | that range holds the pocket-saving deadline logic; the `category_budget` arm states at `:105-107` that the budget is not edited there at all |
| STATE, row 2 | `getBudgetAccountSeries` at `budgetApi.ts:78` | `:76`, and still zero callers with no `insights` directory — the row's substance is unchanged |
| STATE, row 3 | the `calculateBudgetMetrics` inventory is `getAccountController.js:43, :196, :759`, `getAccountDataById.js:59`, `dashboardController.js:185-186,347` | `:56`, `:217`, `:846`, `getAccountDataById.js:59`, `dashboardController.js:194-195, :356`. The balance term beside `cba.budget` at both dashboard sites is now the ledger derivation |
| STATE, residue | the emitters are `EditAccount.tsx:313` and `NewCategory.tsx:415` | `EditAccount.tsx:357`, and `NewCategory.tsx:415` under `pages/forms/newCategory/` |
| STATE, commit 9 | the optional percentage prop is at `SummaryDetailBox.tsx:31` | true, and the file is `pages/forms/accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx` |
| STATE, commit 8 | the exception line renders at `CategoryDetail.tsx:340`, `ListAccountOfCategory.tsx:337`, `EditAccount.tsx:575` | `:376`, `:338` and `:620` — all three sites are still there |
| 10.10 | level 2 does not consume `/accounts/status` and folds the category total in the browser; level 3 builds its window from `new Date()` | both closed. `CategoryAccountList.tsx:52-59` and `CategoryDetail.tsx:94-105` read the store; the month comes from the URL as `monthParam` and reaches `fetchStatus` at `CategoryDetail.tsx:122` |
| 10.10 | the initial balance is `account_starting_amount` stamped with the window's bounds, inconsistent with the final one — `getTransactionsForAccountById.js:134-158`, `:177`, `:184-188` | unified: `:486-487` calls `getBalanceCarriedIntoPeriod` (`:388`), which resolves the no-movement case in SQL and carries the real date. `getFinalBalance` at `:489` |
| §10.14 F1 | the ordering trap is at `getTransactionsForAccountById.js:201-205` | `month_cumulative_spent` is at `:340` |
| §10.14 H2 | `account_balance_after_tr` is a stored audit fact at `createTables.js:157` | the column is at `:165` and both writers now store an explicit `0.00` (`260c54f`); the rendered figure is derived on read and emitted under the same wire name. **The decision the row records is unaffected** |
