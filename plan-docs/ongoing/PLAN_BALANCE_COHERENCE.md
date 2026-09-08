# PLAN — one arithmetic for the balance, and a column that keeps up with it

Written 2026-09-07, measured against `main` at `7e3d8ac4`. Every line reference
below was read in the working tree that day, not copied from an earlier review.

`plan-docs/ongoing/` is re-included by `.gitignore:123`. This file is versioned.

## 1. The developer's ruling, which this plan implements

His words, 2026-09-07:

> yo dejaria la columna, solo como informacion de consulta rapida, y para no
> hacer una migracion para eliminar dicha columna, no obstante, es importante
> mantenerla actualizada con el verdadero forma de calcularla.

So `user_accounts.account_balance` **stays**. No migration drops it. It is a
column to read by hand when inspecting the database, and it carries one
obligation: it must always equal what `derivedAccountBalanceSql` produces for
that account.

This cancels the recommendation made earlier the same day, which was to close
the two sites that publish the stored column and then retire it. Closing those
two sites stays; retiring the column is off the table.

## 2. What was measured, and what turned out to be sound

Three things were checked before writing this plan and need no work:

- **Every ledger writer re-derives the column.** The only writer is
  `setAccountBalanceFromLedger.js:56-57`, and it is called after the rows exist
  by account creation (`accountCreationController.js:421`, `:954`), category
  account creation (`accountCategoryCreationcontroller.js:510`), ordinary
  movements on both legs (`transactionController.js:899`, `:905`), annulment
  (`deleteAccountService.js:363`, `:369`) and closure settlement
  (`deleteAccountService.js:840-841`). No write path was found that leaves the
  column behind.
- **The funds check no longer reads the column.** `lockAndDeriveBalances.js`
  locks the rows in ascending `account_id` order and then derives the balance in
  a second statement. Ten call sites use it. The comment at
  `lockAndDeriveBalances.js:21-25` describes a defect that is closed, not open.
- **Every account list serves the derivation** under the name the stored column
  used, via `derivedAccountBalanceSql`.

What is **not** established is that the rows in any given database still satisfy
the invariant. The writers are correct as written; whether values written before
the derivation landed were ever re-derived is a database question, and
`fintrack_dev` is on record as having held drifted values. Section 3.6 covers it.

## 3. The defects, ranked by what a user sees

### 3.1 `remain` subtracts a lifetime total from a monthly budget — LIVE

`calculateBudgetMetrics` (`getAccountController.js:67-74`) computes
`remain = round(budget - account_balance)` and `statusAlert = remain <= 0`.

Both operands are wrong for the comparison:

- `account_balance` on a `category_budget` account is **the accumulated spend
  since the account opened**, with no period. `movementInputHandler.js:16`
  defines the `expense` movement as `sourceAccountTypeName: 'bank'`,
  `destinationAccountTypeName: 'category_budget'`, so the category account's leg
  of a spend is a deposit with positive `amount`; the derivation adds every one
  of them and nets the `movement_type_id = 6` reversals.
- `budget` is `category_budget_accounts.budget`, the legacy column that
  migration 010 deliberately left in place. The per-month plan lives in
  `budget_monthly_allocations`, resolved as the latest row with
  `budget_month <= $2` (`budgetTransactionRepository.js:150-158`).

Reached by `GET /:accountId` (`accountRoutes.js:86`) at
`getAccountController.js:977-983`. The frontend repeats the same subtraction at
`frontend/src/fintrack/editionAndDeletion/utils/categoryBudgetCalculations.ts:21`.

Effect: on any category account whose accumulated spend has passed one month's
budget — which is every account more than a month old that is used — `remain` is
a large negative number and `statusAlert` is permanently true.

The function's own header already declares it superseded and names the
replacement: `GET /api/fintrack/budget/summary`, which returns `remainingBudget`
and `executionPercentage` for an explicit period.

### 3.2 Three statements publish the stored column instead of the derivation

**Corrected 2026-09-07: this section said two. The third was found while running
the verification of section 6, and it is the only one of the three a user sees.**

- `transactionRowShape.js` selects `ua.account_balance` into the shared row
  shape. Both mappers spread the row (`overviewTransactionRepository.js`,
  `overviewPageRepository.js`), so the stored value reaches the client on
  every Overview transaction row. No consumer reads it — the Overview core files
  never mention it — and three sibling files in the same module carry comments
  stating that nothing there reads `user_accounts.account_balance`.
- `getCategoryBudgetFullData` (`getAccountController.js`) selects `ua.*`
  and feeds `calculateBudgetMetrics` from it. Its route is commented out in
  `accountRoutes.js`, so it is unreachable today.
- **`dashboardController.js`, three statements, all reachable.** The legacy
  dashboard is mounted in `routes/index.js`, where the line carries the comment
  `//overview info`. That module converted almost every statement to the
  derivation and missed three, in two different ways:
  - the `'all'` branch of `dashboardMovementTransactions` selects `ua.*, tr.*`
    with no derivation at all. The six sibling branches of the same `switch`
    each alias the derived expression as `account_balance`; only this one was
    left behind, so `all` was the single movement filter serving the stored
    value.
  - `dashboardMovementTransactionsSearch` and
    `dashboardMovementTransactionsByType` both **do** carry the derivation, cast
    to FLOAT — with no output alias. Measured against `fintrack_dev`: an
    un-aliased cast of that scalar subquery lands under the output name
    `float8`, so it collides with nothing and the `account_balance` that `ua.*`
    ships is the column the client receives. The conversion was written and then
    silently defeated by the missing two words.

Two facts make the fix safe and both were measured, not assumed. Postgres emits
both columns when an output name repeats and the pg driver keeps the last, so the
derived alias must sit **after** `ua.*`; and `transactions` carries
`account_balance_after_tr` and no `account_balance`, so a trailing `tr.*` does
not take the name back.

### 3.3 The two balance builders differ, in the same file

`derivedBalance.js` writes the arithmetic twice:

| | `derivedAccountBalanceSql` (218-227) | `ledgerBody` (238-258) |
|---|---|---|
| shape | aggregate subquery | window function over the account's rows |
| cast | `FLOAT` or `NUMERIC`, caller's choice | `FLOAT`, fixed |
| empty input | `COALESCE(SUM(...), 0)` returns the starting amount | returns no rows |
| exclusion | `movement_type_id = 8 AND account_id = opening_for_account_id` | identical |

The sum itself is identical today. The two differences are real but neither is a
live failure:

- the cast means the same account's balance arrives as a float through
  `account_balance_after_tr` and can arrive as an exact decimal through
  `account_balance`;
- the missing `COALESCE` is guarded at both readers by an early return on an
  empty list (`getTransactionsForAccountById.js:443`,
  `getAccountController.js:157-172`), and in practice every account carries its
  own opening row from creation, so the empty case barely occurs.

The defect is that one arithmetic is maintained in two places with nothing
tying them together.

### 3.4 The expense netting is written four times

**Corrected 2026-09-07: this section said twice. The count came from reading the
two modules' headline queries; the edit that replaced them failed its uniqueness
assertion and revealed two more inside the budget repository alone.**

The same `CASE` over `movement_type_id` 1 and 6 appears in:

- `budgetTransactionRepository.js`, three times — the actual-spend query, the
  total spent for one account over one period, and a third alongside them. The
  per-account-and-period statement had no table alias at all, so it also had to
  gain one before it could call a shared builder.
- `overviewMonthlyRepository.js`, once, in the monthly expense query. Its
  comment said the expression was the budget module's netting "verbatim", and it
  was — with nothing keeping it that way.

Nothing enforced the agreement, and a change to any one of the four was
invisible from the other three. A statement could also filter on one movement
type set and sum over another with nothing to notice.

### 3.5 A module that would throw on load

**Corrected 2026-09-07: this section described a pair. It is a trio, one member
of which needs nothing, and the count of load-time faults is three, not one.**

`getAccountDataById.js` cannot run, for three independent reasons:

- it imports `pool` from `../../src/db/configDB`, which from
  `backend/src/utils/fintrackUtils/accountDataRetrieval/` resolves to
  `backend/src/utils/fintrackUtils/src/db/configDB`. The module is at
  `backend/src/db/config/configDB.js`, and the specifier carries no `.js`
  extension, which ESM requires. It throws on load;
- it calls `getSpecificAccountQuery` with no import, and **no module in the
  repository defines that name**;
- it calls `calculateBudgetMetrics` with no import either.

The third file is `calculateBudgetMetrics.js`, in the same directory. It already
carried a deprecation header naming this same defect and this same replacement
endpoint, and its `const` is never exported, so importing it yields nothing. It
needed no change beyond one stale sentence: its header pointed at the copy in
`getAccountController.js` as a live twin, and that copy is now commented out.

`getAccountByIdController.js` turned out to be **entirely inside a block comment
already**, from its fourth line to its last. It therefore exports nothing and
imports nothing, which is why `getAccountDataById.js` has no importer at all
rather than one unreachable importer. Its final block was never a function body
either: it is a fragment of some other controller's success branch, and it
contains a top-level `export const updatedAccount = await ...` that would make
the module perform a database read at import time.

All three compute `remain` and `statusAlert` the way 3.1 does, so they are the
same defect in unreachable form. `getAccountDataById.js` also selects `ua.*`,
which makes it a fourth instance of 3.2, likewise unreachable.

### 3.6 Nothing checks the invariant the ruling creates

The column is now specified as equal to the derivation. No test, script or
constraint asserts it. Agreement measured today is a state, not a rule.

## 4. Ownership and what is frozen

| item | files | owner | blocked by |
|---|---|---|---|
| 3.1 | `getAccountController.js`, `categoryBudgetCalculations.ts` | budget module | — |
| 3.2 Overview half | `transactionRowShape.js` | Overview (this session) | — |
| 3.2 category half | `getAccountController.js` | budget module | — |
| 3.2 dashboard half | `dashboardController.js` | Overview (this session) — the module is mounted as `//overview info` | — |
| 3.3 | `derivedBalance.js` | shared utility, no single owner — assign before starting | — |
| 3.4 | `overviewMonthlyRepository.js`, `budgetTransactionRepository.js` | Overview and budget, one change each | — |
| 3.5 | `getAccountDataById.js`, `getAccountByIdController.js`, `calculateBudgetMetrics.js` | budget module | — |
| 3.6 | new check | migration-chain session if it lands as SQL | — |

`getAccountController.js` is modified in the working tree at the time of
writing. Nothing in this plan touches `backend/src/db/migrations/`, and nothing
in it is account-deletion work, so the deletion freeze does not reach it.

Per the developer's standing rule, no code is deleted in any of these items;
what is superseded is commented out.

## 5. Order of work, with the recommendation

**Do 3.1 first.** It is the only item a user can see today, and it makes a
category account report a permanent overspend. The fix is not arithmetic: it is
to stop serving `remain` and `statusAlert` from `GET /:accountId` and let the
screen read `GET /api/fintrack/budget/summary`, which already computes the
figure for a stated period. That removes the subtraction from the backend and
from `categoryBudgetCalculations.ts:21` in one change.

Then, in order: 3.2 (two statements, mechanical), 3.3 (give `ledgerBody` the
same cast parameter and the same `COALESCE`), 3.6 (the check), 3.4 (one shared
builder for the netting), 3.5 (comment out the dead pair).

3.6 is placed after 3.3 on purpose: a check written against two arithmetics that
still differ in their cast would have to encode the difference.

**What was actually done, 2026-09-07, and where it departed from the above.**
The developer's instruction was that the plan be implemented in the same session:
*EL PLAN BALANCE COHERENCE, DEBEMOS IMPLANTARLO EN ESTA SESION, SI NO OVERVIEW
CORRE EL RIESGO DE MOSTRAR BASURA.* The executed order was 3.1, 3.2, 3.3, 3.4,
3.6, 3.5. Two departures, both deliberate:

- **3.6 ran after 3.4, not after 3.3.** The reason for placing it after 3.3 was
  that the two arithmetics differed in their cast; 3.3 closed that by giving
  both builders one shared expression, so by the time 3.4 finished the check had
  nothing left to encode. Running it later cost nothing.
- **3.3 kept the two builders' cast difference instead of removing it.** The
  recommendation said to give `ledgerBody` the same cast parameter and the same
  `COALESCE`. What the arithmetic actually shares is the amount of one row, and
  that is what was extracted into a private helper the three copies now call.
  The fixed FLOAT cast and the absent `COALESCE` were left in place and
  documented as deliberate: every consumer of the series publishes it as
  `account_balance_after_tr`, which the response type declares as a number, so
  NUMERIC would hand the driver's string to a numeric field; and a window `SUM`
  over a result set always has at least the current row, so it can never be
  NULL. Removing either would have been a change with no defect behind it.

## 6. Verification, with what each check returned

| check | result |
|---|---|
| a category account with spend in more than one month returns a `remain` matching `GET /api/fintrack/budget/summary`, or no `remain` at all | **no `remain` at all.** The enrichment block is commented out, so the field is simply absent. It is optional in the response type and every frontend render site was already commented out |
| no response body outside the account detail carries a value read from `user_accounts.account_balance` | **holds for every statement, but the check as worded was too strong — see below.** `ua.account_balance` has no executable reference left: the three remaining hits are two commented-out statements and one comment. `ua.*` needed splitting into what publishes and what does not, which is how the dashboard sites of 3.2 were found |
| `derivedAccountBalanceSql` and `ledgerBody` produce the same value at the same precision | **the same expression, not the same value.** Both now render one shared helper, verified by loading the module and comparing the generated SQL of all three builders |
| a check reports every account whose stored column differs from its derivation, against a development database only | **31 accounts checked on `fintrack_dev`, 0 disagree.** The script refuses to run when the database name reads as production |
| the application still loads | **`APP LOADED OK`** |

The `ua.*` search is the one that has to be read rather than counted, and the
distinction is what a repeat of this verification depends on. Selecting `ua.*`
is not by itself a defect; what matters is whether the row reaches a response
body still holding the stored column. Three shapes are safe and were left alone:

- statements that alias the derivation **after** `ua.*`, where the driver keeps
  the last of two same-named outputs;
- `getAccountById`, whose branches all select `ua.*` and which then overwrites
  `account_balance` from a separately-derived value in JavaScript before it
  builds the response;
- internal reads that never reach a client — the account resolution in
  `transactionController.js`, the compensation-account lookup, the account check
  in `deleteAccountService.js`, and `checkAndInsertAccount.js`.

**One reader depends on the invariant rather than avoiding it, and the check as
worded above missed it.** Reported by the deletion-module session and verified
here on 2026-09-07. `setAccountBalanceFromLedger.js` ends with `RETURNING ua.*`,
which this plan first listed as an internal read. It is not: on the annulment
path `deleteAccountService.js` reads `slackRow.account_balance` off that
returned row, assigns it to `finalSlackBalance`, and the RTA success response
publishes it as `data.finalSlackBalance`. The stored column therefore does reach
a client, in the one module whose writes are frozen.

It is **not a defect**, and it should not be converted. The read sits one
statement after the write that re-derived that same account from its ledger,
inside the same transaction, so the value is the derivation. What it is, is the
first identified consumer of the obligation the developer's ruling created: if
`user_accounts.account_balance` ever stops equalling `derivedAccountBalanceSql`,
this response reports a wrong compensation-account balance to the owner. That
moves the invariant out of hygiene and into a user-visible figure, and it is the
strongest argument for section 8's open decision.

**A second correction, to the sentence above that says selecting `ua.*` is not
by itself a defect.** That is true about the balance and false as a general
clearance, and the same session named the counter-example. `accountCheck` in
`deleteAccountService.js` is a star-select, so `accountCheck.rows[0].closed_at`
is a property read; on any database where the migration that adds `closed_at`
has not run it evaluates to `undefined`, `undefined !== null` is true, and every
hard delete is refused with a message asserting the account was closed and
settled when it never was. A named-column select would have failed loudly with
42703 instead. The rule is narrower than this plan stated: a star-select is safe
for a column that **exists** and is being re-derived, and is a silent-wrong-
answer generator for any column a pending migration adds. That defect is already
documented at its site and is the developer's call, not a cleanup — loosening
the comparison turns it into a permit on exactly the databases where the
system-account guard is blind.

## 7. What is not in this plan

No migration. No change to `category_budget_accounts`, whose `budget` column
migration 010 keeps on purpose. No account-deletion work. No commits — the
developer's instruction `escribe codigo, no commits` is in force.

## 8. State

Every item is implemented in the working tree of `main`. Nothing is committed:
the developer's instruction `escribe codigo, no commits` is in force, and the
plan-docs gate has not been presented.

| item | state | what carries it |
|---|---|---|
| 3.1 `remain` | done | enrichment commented out in `getAccountController.js`, `enrichCategoryAccountData` commented out in `categoryBudgetCalculations.ts`, both naming the replacement endpoint |
| 3.2 Overview | done | `transactionRowShape.js` selects the derivation under the same name |
| 3.2 category | done | the unreachable call inside `getCategoryBudgetFullData` is commented out |
| 3.2 dashboard | done | three statements in `dashboardController.js`, one gaining the derivation and two gaining the alias that was missing |
| 3.3 two builders | done | one private helper in `derivedBalance.js`, called by all three copies |
| 3.4 netting | done | `spentAmountSql.js`, a new shared builder called by all four sites |
| 3.5 dead trio | done | `getAccountDataById.js` commented out under a header naming its three faults; a header on `getAccountByIdController.js`; one stale sentence corrected in `calculateBudgetMetrics.js` |
| 3.6 the check | done | `backend/scripts/verifyStoredBalance.js`, run against `fintrack_dev` |

One thing this plan does not close. The invariant is now checked by a script
somebody has to run. Nothing runs it, so the column can still drift between one
run and the next; what changed is that the drift is findable in one command
instead of being invisible. Whether that check belongs in a pipeline, or as a
constraint the migration chain owns, is a decision for the developer.
