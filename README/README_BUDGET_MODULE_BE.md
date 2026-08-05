# Budget Module — Backend Description

API contract and behaviour of `backend/src/fintrack_api/services/budget_services/`, written
for the frontend work in Plan D.

**Branch:** `feat/budget` · **Last verified:** 2026-08-02 against the source and a live
`fintrack_dev`, not inferred from the plans.

References to `Plan C §…`, `Plan D`, `ROUNDING-POLICY.md` and remark ids (`R9`…`R14`) point
into `plan-docs/`, which is deliberately untracked working notes. Everything needed to build
against this API is in this file; those pointers only say where a decision was argued.

---

## 1. Purpose

The module answers one question:

> Of what was budgeted for this account over this period, how much has been spent and how
> much is left?

It replaces a legacy calculation that compared the budget against the account's running
balance with no notion of a period. That legacy path reports an overspend permanently: an
account that exceeded its budget in July still shows the overspend in August, having spent
nothing. The new path reads `transactions` inside a date window instead.

Three concepts the frontend must keep apart:

| Concept | Table | What it is |
|---|---|---|
| **Policy** | `budget_policies` | One per account. The stable container. Its `budgetPolicyId` is what the edit form acts on |
| **Allocation** | `budget_policy_allocations` | The amount and its frequency, versioned (SCD Type 2). Changing the amount closes the current row and opens a new one — history is never overwritten |
| **Actual spending** | `transactions` | Summed inside the window from movement types 1 (expense) and 6 (transfer). Never the account balance |

An account with no policy means **not budgeted**. It is not an account with a budget of zero:
`CHECK (budget_amount > 0)` makes a zero budget unrepresentable.

---

## 2. Inputs

### 2.1 Read endpoints

All mounted under `/api/fintrack/budget`, already behind `verifyToken` and `globalLimiter`.
**No endpoint accepts a user id from the client** — identity comes from the token via
`requireUserId`. Every `accountId` received is checked against the caller's own accounts.

| Method | Path | Parameters |
|---|---|---|
| `GET` | `/summary` | Query: `accountId` (required, positive), `frequency`, `date`, `startDate`, `endDate` |
| `POST` | `/multi-summary` | Body: `accountIds[]` (required, min 1, unique, positive), `frequency`, `date`, `startDate`, `endDate` |
| `GET` | `/frequencies` | None |
| `GET` | `/history/:budgetPolicyId` | Path: `budgetPolicyId` (positive) |
| `GET` | `/export` | Query: `accountId` (**optional** — omitted means all owned accounts), `frequency`, `date`, `startDate`, `endDate` |

`frequency` here is the **query window**. It accepts `monthly` · `quarterly` · `four-month` ·
`semiannual` · `yearly`, and **defaults to `monthly`** when absent. Always the code, never the
surrogate id.

> **Do not confuse this with the frequency stored on an allocation.** Those are two different
> lists, deliberately. Any of the five windows may be *requested*; only `monthly` may be
> *stored*. See §2.4.

`startDate` must be less than or equal to `endDate`; the schema rejects the inverse.

### 2.2 Write endpoint

| Method | Path | Body |
|---|---|---|
| `PUT` | `/budget/policy/:budgetPolicyId` | `{ budgetAmount: number > 0, budgetFrequencyCode: 'monthly' }` |

Ownership is enforced inside the service, in the same transaction as the write, so there is no
window between the check and the update.

### 2.3 Write paths that are NOT under `/budget`

Two other controllers change a budget. This surprises people and is worth stating plainly.

| Action | Endpoint | Budget fields |
|---|---|---|
| Create account | `POST /account/new_account/category_budget` | `budget` (required, > 0) · `budgetFrequencyCode` (optional → `monthly`) |
| Edit account | account edit `PATCH` | `budget` (> 0) · `budgetFrequencyCode` (**absent means keep the one in force**, never reset to the default) |

There are therefore two ways to change a budget amount. Both version the allocation (SCD Type
2) in the same transaction as the account write, so neither corrupts history. They differ in
what they can do:

| | `PATCH` account edit | `PUT /budget/policy/:id` |
|---|---|---|
| Keeps the legacy `cba.budget` column in step | Yes | No — it drifts |
| Works on an account that has **no policy yet** | Yes, creates one dated from `account_start_date` | No — needs a policy id that does not exist |
| Needs the policy id up front | No, keyed by account | Yes |

**No account read endpoint returns `budget_policy_id`.** The only source is
`GET /budget/summary?accountId=…` → `result.budgetPolicy.budgetPolicyId`, which is `null` for
an unbudgeted account. Use the `PATCH` path for the account edit form; use the policy endpoint
where the id is already in hand, such as the history screen.

### 2.4 Allocations are monthly only

`budgetFrequencyCode` on a **stored allocation** accepts `monthly` and nothing else, on all
three write paths above. A request carrying any other code is rejected with
`400 budgetFrequencyCode must be one of: monthly.`

This is a **version 1 scope decision, not a limitation of the data model, and not permanent.**
The `budget_frequency_types` catalog still holds all five codes and the column still references
it; only what may be written is narrowed.

The reason is aggregation: adding up budgets that recur on different cycles into one per-user
total has no agreed answer yet, and until the Overview layer has one, a quarterly budget read
through the default monthly window would report zero budget and a full overspend.

The other four codes are meant to return. Editing the constant in `core/budgetConfig.js` is one
line, but it is **not sufficient on its own** — the period-counting defect in §7 has to be
fixed first, or a restored quarterly budget reports zero through the default window. The
ordered re-activation checklist is kept in `plan-docs/REMARKS.md` R15.

**Consequence for the frontend: do not build a frequency selector in v1.** Create and edit forms
send either `monthly` or nothing at all.

---

## 3. Outputs

### 3.1 The result object

Returned by `/summary` (as `result`) and inside the `results[]` of `/multi-summary`.

```json
{
 "accountId": 17,
 "isBudgeted": true,
 "currency": "usd",
 "period": {
  "start": "2026-08-01T00:00:00.000Z",
  "end":   "2026-09-01T00:00:00.000Z"
 },
 "budgetPolicy": {
  "budgetPolicyId": 1,
  "accountId": 17,
  "budgetFrequencyTypeId": 1,
  "createdAt": null,
  "updatedAt": null
 },
 "budgetAllocation": {
  "budgetAllocationId": 1,
  "budgetPolicyId": 1,
  "budgetAmount": 10,
  "budgetFrequencyTypeId": 1,
  "budgetFrequencyCode": "monthly",
  "validFrom": "2026-07-31T22:48:56.354Z",
  "validUntil": null
 },
 "budgetAccumulatedAmount": 10,
 "actualSpent": 0,
 "remainingBudget": 10,
 "actualVsBudgetDifference": 10,
 "executionPercentage": 0
}
```

| Field | Meaning |
|---|---|
| `isBudgeted` | `false` when the account has no policy at all |
| `period` | The resolved window. **Named `period`, not `startDate`/`endDate`** |
| `budgetAllocation` | The allocation in force at the end of the window — the one the edit form and history link act on. `null` when none applies |
| `budgetAccumulatedAmount` | Allocation amount × whole periods in the window |
| `actualSpent` | Signed. Positive for expenses, negative for reversals |
| `remainingBudget` | Identical to `actualVsBudgetDifference`. **Deprecated** — see §5 |
| `actualVsBudgetDifference` | `budgetAccumulatedAmount − actualSpent`. Negative means overspent |
| `executionPercentage` | `actualSpent / budgetAccumulatedAmount × 100`, or `0` when the denominator is zero |

### 3.2 Totals — `/multi-summary` only

```json
{
 "currency": "usd",
 "accountCount": 2,
 "budgetedCount": 2,
 "budgetAccumulatedAmount": 30,
 "actualSpent": 0,
 "remainingBudget": 30,
 "actualVsBudgetDifference": 30,
 "executionPercentage": 0
}
```

`currency` is `null` when the set mixes currencies, and a notice is added. **Amounts are never
converted**: budget-level FX is a schema change, and inventing a rate at report time would
produce a number no stored row supports.

The percentage is recomputed from the totals, not averaged across accounts. Averaging
percentages would weight a category budgeted at 10 the same as one budgeted at 10,000.

Unbudgeted accounts contribute their spending but no budget, which pulls the totals in the
honest direction: money spent with nothing allocated behind it.

### 3.3 Other responses

| Endpoint | Shape |
|---|---|
| `/frequencies` | `{ frequencies: [{ budgetFrequencyTypeId, budgetFrequencyCode, budgetFrequencyName, sortOrder }] }` |
| `PUT /policy/:id` | The new allocation: `{ budgetAllocationId, budgetPolicyId, budgetAmount, budgetFrequencyTypeId, budgetFrequencyCode, validFrom, validUntil }` |
| `/history/:id` | An array of the same, newest first, each with `isActive` |
| `/export` | `text/csv` with `Content-Disposition: attachment`. Only budgeted accounts are included: a CSV row of zeros is indistinguishable from a budget that was never spent |

### 3.4 Metadata

`meta.notices` is an **array of strings**, never a singular string. A request can trigger more
than one adjustment — a normalized start *and* an extended end.

### 3.5 Errors

| Status | Body | When |
|---|---|---|
| `400` | `{ errors: [...] }` | Zod validation failure |
| `400` | `{ status, message }` | Domain guard, e.g. `budgetAmount must be at least 0.01 in the account currency.` |
| `403` | `{ status, message }` | Account or policy not owned by the caller |

**There is no `404`.** Distinguishing "does not exist" from "not yours" would let a caller
enumerate other users' ids, so both answer `403`.

---

## 4. Interactions

```
routes/budgetRoutes.js
  -> controllers/budgetController.js        validate (Zod) -> check ownership -> shape response
      -> services/budgetCalculationService  reads: window resolution, aggregation
      -> services/budgetPolicyService       writes: SCD2 versioning, transactions
          -> db/budgetTransactionRepository SQL only
          -> calculators/budgetVsActualCalculator   pure, no I/O
          -> core/makeBudgetResult          builds every result object
          -> core/money.js                  the module's rounding boundary
```

External dependencies:

| Depends on | For |
|---|---|
| `utils/withTransaction.js` | Wrapping SCD2 writes so a close and its replacement commit together |
| `fx_services/currency_catalog` | `getCurrencyCodeSync`, loaded at boot |
| `utils/fintrackUtils/date-utils/` | Window resolution and period counting |
| `utils/fintrackUtils/exportUtils.js` | CSV formatting |
| `validation/zod/budgetValidators.js` | The declared request contract |

Consumed by: `accountCategoryCreationcontroller.js` (creation) and `accountEditController.js`
(edit), both passing their own client so the policy commits or rolls back with the account.

---

## 5. Rules the frontend must respect

**1. Do not calculate anything.** Amounts arrive rounded to two decimals by `core/money.js`,
which owns the module's single rounding boundary. Recomputing `remain = budget - balance` on
the client is exactly what this module exists to remove. Four such sites still exist and are
listed in Plan C §2.1, including `ListCategory.tsx:83-87`, which also rounds money to whole
integers with `Math.round()`.

**2. Two different frequencies, and neither overrides the other.**

| Concept | Source | Values | Answers |
|---|---|---|---|
| Query window | The request (`frequency`, or `startDate`/`endDate`) | All five codes | Which date range to report on |
| Multiplier | Each allocation's stored `budgetFrequencyCode` | `monthly` only (§2.4) | How often that budget recurs |

A monthly budget of 10 read through a yearly window accumulates **120**, not 10.

Since every allocation is monthly, the accumulated budget for any window is simply the sum of
the months it covers, and an amount changed mid-window is priced over its own slice: a
five-month window with a change in month three yields `2 × old + 3 × new`. Custom
`startDate`/`endDate` ranges are snapped to whole months before this is computed — see rule 7.

**3. Prefer `actualVsBudgetDifference`.** It and `remainingBudget` are one metric under two
names. `actualVsBudgetDifference` is canonical; `remainingBudget` is kept only until the
frontend stops reading it, then removed.

**4. Unbudgeted accounts still appear** in `/multi-summary`, with `isBudgeted: false`. They do
not vanish and do not raise.

**5. Spending with no budget is a real overspend.** An account with no allocation and 50 spent
reports `actualVsBudgetDifference: -50`. Money left with nothing behind it, and hiding that
would replace one lie with another.

**6. `meta.notices` is an array.** Render all of them.

**7. Custom ranges are snapped to whole months, so render `result.period`, not the dates the
user picked.** `startDate` moves back to the first of its month and `endDate` forward to the
first of the next month unless it is already there, and a notice is added when anything moved.
A user picking `Jul 1 – Jul 31` gets `Jul 1 – Aug 1`, one full month — the frontend does **not**
need to compute end-exclusive dates. But if the label reads `Jul 15 – Aug 20` while the figures
cover `Jul 1 – Sep 1`, the screen is wrong even though every number in it is right.

---

## 6. Verified state

**Parity gate passed** (Plan C §15.7, 2026-08-02). Where the window matches the period the
data lives in, the new and legacy systems agree exactly. Every difference traces to a named
cause: the new path is period-aware and reads transactions, and it prices each allocation over
the slice it was in force for.

**Rounding policy applied** (`plan-docs/ROUNDING-POLICY.md`, commit `e9dc13a`). Rounding
happens at three boundaries — entry, storage, presentation — never inside a calculation chain.
The mode is `ROUND_HALF_UP`, matching Postgres `numeric`.

---

## 7. Known limits

**R14 — unanchored period counting, now unreachable.** `getNumberOfPeriods` divides a month
span rather than identifying periods, so a quarterly budget of 600 viewed through a one-month
window returned `budgetAccumulatedAmount: 0` and reported the whole spend as overspend.

Restricting allocations to monthly (§2.4) makes this **unreachable rather than fixed**: with
`monthsPerPeriod = 1` there is never a remainder to discard, which is the entire failure mode.
The defect is still in the code and will matter again the day non-monthly allocations return.

**The resolution is designed but not built,** and is on record for that day. Proration was
rejected. A window will be answered with the full amount of the periods it touches, compared
against the spending in those same periods. Two sub-decisions remain open, recorded in Plan C
§19.3: calendar-anchored versus `validFrom`-anchored periods, and whether spending runs to the
end of the period or to today.

**Settled, and not coming back:**

| Question | Answer |
|---|---|
| Does unspent budget roll over? | **No.** It resets at the start of the next month |
| Do allocations expire at year end? | **No.** `valid_until IS NULL` stays in force across the boundary. "One year" is a display default for the accumulated view, which opens on the current calendar year with prior years available from the SCD2 history |
| Budget against an arbitrary date range? | Out of scope here. Overview handles stored facts and month-against-month; arbitrary ranges belong to Insights / Dashboards |

**The comparison layer moves out of this module.** `budget_services` delivers facts — which
allocations were in force, with what amount, frequency and validity, and how much was spent.
Projection, execution ratio and overspend status are product decisions and belong to the
Overview / Insights layer. That layer serves at least two screens, Overview and the budget
page, so it must not be built as an Overview-only endpoint.

**Other open items**, none of which block frontend work: R9 (FX rounding policy), R10 (float
arithmetic on account balances, outside this module), R11 (a single amount scale assumed for
every currency), R12 (`010` and `012` disagree on backfilled `valid_from`), R13 (37
divergences between the two schema build paths).
