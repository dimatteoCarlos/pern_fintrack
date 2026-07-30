# PLAN C — Budget Module & Overview Refactor

**Status:** Design outlined, execution not started
**Branches:** `feat/budget` (C1–C4), then `feat/overview` (C5–C8)
**Depends on:** Plan A (identity helper), Plan B (tables) — both complete and verified
**Audit date:** 2026-07-28

---

## PART 1 — AUDIT FINDINGS

## 1. Starting state: the module cannot load

The last six commits on `feat/budget` produced roughly 600 lines across ten files that are **unreachable at runtime**. Four independent blockers, each verified by reading the code.

### 1.1 Three imports resolve to files that do not exist

`fintrack_api/controllers/budgetController.js:18-21`:

| Import | Status |
|---|---|
| `../services/budget_services/services/budgetPolicyService.js` | Missing — never written |
| `../services/fintrackUtils/accountUtils.js` | Missing — no `services/fintrackUtils/` directory exists |
| `../services/fintrackUtils/exportUtils.js` | Missing — `convertBudgetResultsToCSV` never written |

`getAccountsByType` *does* exist, but in `utils/fintrackUtils/accountDataRetrieval/accountUtilsV2.js:67` — a different file in a different directory.

### 1.2 `ALLOWED_FREQUENCIES` is commented out but still imported

`budget_services/core/budgetConfig.js:8-14` has the array commented out. `validation/zod/budgetValidators.js:8` imports it and calls `z.enum(ALLOWED_FREQUENCIES)` on `undefined` — a throw at module-evaluation time. The entire validation layer is unloadable. A one-line fix that gates everything downstream.

### 1.3 The tables do not exist

`budget_policies` and `budget_policy_allocations` appear in no migration. Resolved by Plan B.

### 1.4 No route reaches the controller

There is no `budgetRoutes.js`. `fintrack_api/routes/index.js` mounts only `currency`, `account`, `transaction`, `dashboard`.

### 1.5 What is already sound

The domain layer needs **no rewriting**, only wiring — well-structured pure functions with explicit validation:

- `calculators/budgetVsActualCalculator.js`
- `core/makeBudgetResult.js`, `budgetPolicy.js`, `budgetAllocation.js`
- `utils/fintrackUtils/date-utils/periodResolver.js`, `getNumberOfPeriods.js`, `dateNormalizer.js`
- `utils/fintrackUtils/target-actual/varianceCalculator.js`
- `services/budget_services/db/budgetTransactionRepository.js`

## 2. Legacy code inventory (deprecation targets)

Per `CLAUDE.md`, obsolete calculations are identified explicitly **before** removal. Nothing here is deleted until the flag defaults to enabled and parity is confirmed.

### 2.1 Client-side budget arithmetic — four sites

| File | Lines | Calculation |
|---|---|---|
| `frontend/.../pages/budget/components/ListCategory.tsx` | 83-87 | `remain = Math.round(-total_balance + budget)`; `statusAlert = remain <= 0` |
| `frontend/.../forms/categoryDetail/ListAccountOfCategory.tsx` | 53-55 | Same formula, duplicated |
| `frontend/.../forms/categoryDetail/CategoryAccountList.tsx` | 91-95 | Aggregated variant |
| `frontend/.../editionAndDeletion/utils/categoryBudgetCalculations.ts` | 21-22 | `remain = Math.round(account.budget - account.account_balance)` |

**Sign-convention conflict:** `ListCategory` computes `-total_balance + budget`; `categoryBudgetCalculations` computes `budget - account_balance`. Opposite conventions for the same concept in the same application. Whichever is wrong is wrong *today* — resolved during C3.

Execution percentage is also inline in JSX (`ListCategory.tsx:124`): `((total_balance / budget) * 100).toFixed(1)`.

### 2.2 Already-dead legacy helper

`utils/fintrackUtils/accountDataRetrieval/calculateBudgetMetrics.js` — declared `const calculateBudgetMetrics = ...` with **no `export`**. Unreachable. This is the helper `spec.md` §1 names for deprecation; it is already effectively deleted.

### 2.3 Server-side legacy path

`dashboardController.js:344-365` — the `category_budget` branch of `dashboardAccountSummaryList`. Computes `total_remaining` as `COALESCE(SUM(cba.budget), 0) - SUM(ua.account_balance)` in SQL, with no period awareness. This is what `USE_NEW_BUDGET_SYSTEM` toggles against.

### 2.4 Duplicate utility modules

`accountUtils.js` and `accountUtilsV2.js` hold the same three functions with **incompatible signatures** — `getAccountTypeId(accountTypeName)` vs `getAccountTypeId(clientOrPool, accountTypeName)`. Nothing imports either. Both dead.

## 3. Spec compliance gap (`spec.md` §2)

| Requirement | Current state |
|---|---|
| `USE_NEW_BUDGET_SYSTEM` flag | Does not exist anywhere in the repository |
| Frontend sends `startDate` / `endDate` | No occurrence in `pages/overview` or `pages/budget` |
| `meta.notices` **array** | `dateNormalizer.js` returns singular `notice` string; service wraps as `meta: { notice }`. Logic correct, shape wrong |
| Server-driven aggregations | Client-side in four places (§2.1) |
| Multi-account type cards | `OverviewLayout.tsx:131-175` fires **six parallel requests** and computes net worth in a `useMemo` |
| `% execution` | Inline in JSX |

## 4. Correctness bugs in scope

These live in the `category_budget` write path this phase touches, which is why Plan A deliberately left them alone.

| ID | Location | Issue |
|---|---|---|
| **C-b1** | `accountEditController.js:111` | Partial PATCH corrupts data. Editing only `budget` unconditionally rebuilds `account_name` from absent payload fields, writing `"//undefined"`. `capitalize()` returns `""` for undefined; `payload.category_nature_type_name` stringifies to `"undefined"`. |
| **C-b2** | `accountEditController.js:129` | `payload.debtor_lastname.trim()` throws `TypeError` (500) on any partial debtor PATCH. |
| **C-b3** | `accountCategoryCreationcontroller.js:71-77` | Backend accepts `budget = 0` and manufactures it via `budget ? parseFloat(budget) : 0.0`. Violates the agreed invariant (§5.1). **Highest priority** — the only bug that can corrupt data *after* Plan B's backfill. |
| **C-b4** | `dashboardController.js:62-76` | Missing `return` on the 404 path → second `res.json()` → `ERR_HTTP_HEADERS_SENT`. |
| **C-b5** | `dashboardController.js:279` | `throw new error(...)` — lowercase, `ReferenceError`. |
| **C-b6** | `dashboardController.js:1079` | `catch` references `startDate` declared inside `try` → `ReferenceError` masks the real error. Flagged in an existing source comment. |
| **C-b7** | `budgetVsActualCalculator.js:75-76` | `remainingBudget` and `actualVsBudgetDifference` computed identically — two names, one metric. |
| **C-b8** | `frontend/src/urlConfig.ts` | `url_get_category_budget_full_data` produces `/api/fintrack/fintrack/account` — `BASE_URL_APP` already contains the segment. Dead URL. |
| **C-b9** | `accountEditSchema.ts:102` vs `editSchemas.ts:52` | `budget` is `isRequired: true` in field metadata but `.optional()` in the schema. |

---

## PART 2 — AGREED ARCHITECTURE

## 5. Domain invariants

### 5.1 `budget > 0` — a budget of zero does not exist

**This invariant is defined in `PLAN_B_INFRA_DATABASE.md` §2 and is binding on this phase.** Restated here because Plan C is where it must be enforced in application code.

The rule was already the product's real behaviour, enforced only in the browser:

- `frontend/.../zod_schemas/commonSchemas.ts:27-34` (creation) rejects `<= 0`
- `frontend/.../validations_zod/commonEditionSchemas.ts:141-148` (edition) rejects `<= 0`

Three layers must now agree:

| Layer | Enforcement | Status after Plan B + C |
|---|---|---|
| Frontend | `numberSchema` rejects `<= 0` | Already correct |
| Backend | Reject `<= 0`, never default to `0.0` | **C-b3 fixes this** |
| Database | `CHECK (budget_amount > 0)` | Plan B delivers |
| Domain | `budgetVsActualCalculator.js:39` throws on `<= 0` | Already correct |

Corollary: **an account with no policy means "not budgeted"** — it is not an account with a zero budget. The summary endpoint reports it as unbudgeted rather than producing a `0%` execution rate that would divide by zero.

**Learning topic:** an invariant enforced only in the UI is not enforced. The browser is the easiest layer to bypass. Business rules belong in the domain and are mirrored outward for user experience, never the reverse.

### 5.2 Identity comes only from the token

Plan A introduces `getAuthenticatedUserId(req)`. Every budget endpoint uses it. No budget endpoint accepts a user ID from body, query, or params.

### 5.3 Stored configuration beats client input

The stored budget frequency takes precedence over the `frequency` query parameter (C2). The parameter becomes a what-if override, not the source of truth.

## 6. Layering

Preserve the structure the budget module already uses — it is the pattern the rest of the backend should eventually adopt:

```
routes/        HTTP surface, no logic
controllers/   validate (Zod) → call service → shape response
services/      orchestration, transactions
calculators/   pure functions, no I/O
core/          immutable domain objects
db/            repositories, SQL only
```

The four legacy controllers (1000+ lines each, inline SQL against `pool`) are **not** refactored in this phase. Scope discipline: this phase makes the Budget module work, it does not rewrite the application.

## 7. Feature flag contract

`USE_NEW_BUDGET_SYSTEM` in `dashboardController.js`:

- Read **once at module scope** from the environment; no scattered `process.env` reads inside handlers.
- Defaults to **off**.
- Both paths remain fully functional in either position — the backward-compatibility requirement of `spec.md` §1.
- The flag is introduced **only after** parity is proven (C3). A flag switching to a broken implementation is not a flag.

## 8. Response contract

`meta.notices` is an **array** (`spec.md` §2), not the current singular `notice`. A request can trigger more than one adjustment — start normalized *and* end extended — and consumers should not need rewriting when a second notice type appears.

---

## PART 3 — STEP-BY-STEP EXECUTION PLAN

## 9. Phase C1–C4 — branch `feat/budget`

### C1 — Make the module loadable

Strictly ordered; each step unblocks the next.

1. **Uncomment `ALLOWED_FREQUENCIES`** in `budgetConfig.js`. Values must match the `budget_frequency_types` catalog seeded in Plan B *and* the keys of `MONTHS_PER_PERIOD` in the same file. Prefer deriving the array from `Object.keys(MONTHS_PER_PERIOD)` — three lists, one source of truth.
2. **Resolve the `accountUtils` duplication.** Keep `accountUtilsV2.js` (it has `getAccountsByType` and consistent `(pool, ...)` signatures), delete `accountUtils.js`, then rename V2 once no importer remains. A file named `V2` is a migration that never finished.
3. **Write `budgetPolicyService.js`** — `updateBudgetAllocation` and `getBudgetAllocationHistory`. `updateBudgetAllocation` must close the current row (`valid_until = NOW()`) and insert the new one **inside a single transaction**, using the existing `utils/withTransaction.js`. The unique partial index from Plan B is the safety net under concurrency.
4. **Write `exportUtils.js`** — `convertBudgetResultsToCSV`.
5. **Fix the three imports** in `budgetController.js`.
6. **Create `budgetRoutes.js`**, mount at `/budget` in `routes/index.js`.

**Authorization requirement.** `getSummary` currently accepts `accountId` from the query and never verifies ownership. Apply §5.2. `getMultiSummary` takes an **array** — validate every element, not the first.

### C2 — Close the frequency gap

Consume the `budget_frequency_code` exposed by Plan B step B4, applying §5.3. Without this, a user's configured quarterly budget is silently evaluated as monthly because that is the schema default.

### C3 — Parity verification (the gate)

**No flag until this passes.** Same user, same accounts, new endpoints vs legacy `dashboardAccountSummaryList`:

| Metric | Legacy source | New source |
|---|---|---|
| Budgeted | `SUM(cba.budget)` | `budgetAccumulatedAmount` |
| Spent | `SUM(ua.account_balance)` | `actualSpent` |
| Remaining | `budget - balance` in SQL | `remainingBudget` |

Differences are expected — the new path is period-aware and reads `transactions` (movement types 1 and 6) rather than the account balance. **Every difference must be explained before proceeding.** An unexplained difference is either a bug in the new path or a bug in the old one users have been reading as correct; both need a decision.

This is also where the §2.1 sign-convention conflict is resolved.

**Learning topic:** a feature flag switches between two *working* implementations. Wiring it before verification produces a toggle where one position is an error — it teaches nothing about the new system and destroys confidence in the old. Parity first, flag second, deprecation third.

### C4 — Introduce `USE_NEW_BUDGET_SYSTEM`

Per the contract in §7. Add the key to both `.env.example` files created in Plan A.

### C-b3 — fix before the flag

Backend must reject `budget <= 0` and stop defaulting to `0.0`. **Sequencing note:** this can be done any time after Plan B's backfill, but must land before C4. New zero rows created after the backfill would break the calculator's guard the moment the flag turns on.

## 10. Phase C5–C8 — branch `feat/overview`

### C5 — Reshape `meta.notice` → `meta.notices[]`

Per §8. Touches `dateNormalizer.js` and `budgetCalculationService.js`.

### C6 — Date range plumbing

Frontend sends `startDate` / `endDate`; backend normalizes and returns `meta.notices`. No Overview or Budget page currently sends either parameter.

### C7 — Server-driven cards

Deliver `budgetedAmount`, `actualSpent`, `remainingBudget`, `executionPercentage` pre-calculated. Consider consolidating the six parallel `useFetch` calls in `OverviewLayout.tsx` into one aggregate endpoint — six round-trips to render one screen, with net worth summed client-side, is the same architectural problem as the budget arithmetic.

### C8 — Deprecate

Only after the flag has run enabled by default and been observed. In order:

1. Delete the four client-side calculators (§2.1).
2. Delete `calculateBudgetMetrics.js` (§2.2 — already dead, zero risk).
3. Retire the `category_budget` branch of `dashboardAccountSummaryList` (§2.3).
4. Drop `category_budget_accounts.budget` — a separate, reversible migration, and the only destructive step in the entire plan.

Remaining bugs C-b1, C-b2, C-b4 … C-b9 are fixed opportunistically as their files are touched, except C-b3 which is scheduled above.

## 11. Standards note

`CLAUDE.md` mandates 1-space indentation. Newer budget files already comply; the older controllers use 2-space. **Do not mass-reformat** — a whitespace-only diff across 1000-line controllers destroys `git blame` and makes review impossible. Apply the standard to new files and to functions being substantively rewritten.

The frontend already complies with `type`-over-`interface`: 318 `type` vs 13 `interface`, 8 `any`, under `strict: true`.

## 12. Exit criteria

**C1–C4 (`feat/budget`):**
- All budget endpoints respond; no import resolves to a missing file.
- Every endpoint is ownership-scoped — a user cannot read another user's budget.
- Parity differences documented and explained.
- The flag toggles cleanly in both positions with no error in either.

**C5–C8 (`feat/overview`):**
- Overview renders `budgetedAmount`, `actualSpent`, `remainingBudget`, `% execution` entirely from server data.
- Custom date ranges work end to end; adjustments surface via `meta.notices`.
- Zero budget arithmetic remains in the frontend.
- The legacy path is removed only after the flag has defaulted to enabled.

## 13. Sequencing

```
Plan A (security, off main) ──┐
                              ├─→ Plan B (database) ─→ Plan C1-C4 ─→ Plan C5-C8
                              │      feat/budget       feat/budget    feat/overview
                              └─ independent, ship first
```

Plan B and Plan C1 must not be interleaved: application code querying tables that do not yet exist cannot be tested, and untested code merged onto a shared branch is precisely how the current unreachable module came to exist.
