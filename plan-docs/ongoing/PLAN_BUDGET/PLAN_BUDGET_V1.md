# PLAN BUDGET V1 — Monthly allocation model

Architecture specification for the budget domain. Decided 2026-08-11 / 2026-08-12
by the product owner, superseding the multi-frequency model in full (`DECISIONS.md` §1).

**Status:** decisions closed. Commits 1 and 1b of §11 landed, `3b72371` and
`adc1150`. This document
is the specification the implementation is checked against, not a work list. §11
carries the work list.

**Audited 2026-08-12**, before the gate of commit 2 was approved, against eleven
questions raised by the owner. The audit found **two defects in already-committed
code** (§5.1.1 and §4.5) and ten unclosed points, of which the largest was that
no response body was written anywhere for endpoints the frontend is about to be
built against. Decisions 19–30 record the pass.

A second, narrower pass ran the same day while the gate for commit 2 was being
prepared, this one measured against the source. It moved the 2 / 4 commit
boundary and closed two gaps §7.3 and §9 had left. Decisions 31–33 record it.
Both passes share a lesson worth keeping: **the plan was wrong wherever it had
not been checked against the code since the code moved.**

The rule that forced it, stated by the owner and adopted here: *the complete
contract is frozen first, and the commit sequence is a strategy for implementing
it — never the reverse.* A consequence, also adopted: **that the current
frontend does not call something is not evidence that it can change or be
removed.** In a work-in-progress integration the absent caller is unwritten, not
missing. Removal and breakage are justified against this document, never against
the accidental state of today's client.

**Supersedes:** PLAN F entirely. PLAN F's governing principle — *"a budget is a
property of a canonical budget period"* — survives only in the degenerate case
where the only canonical period is the calendar month. Everything PLAN F built to
reconcile five frequencies is withdrawn.

---

## 0. The governing principle

> A budget is an amount assigned to one Expense Account for one calendar month.
> A month's budget depends on neither the budget nor the balance of the month
> before it.

Every rule below derives from that sentence. The second half is what forbids
rollover, and it is not negotiable in V1.

---

## 1. Domain invariants

1. The calendar month is the only temporal unit. There are no weeks, quarters,
   four-month periods, semesters, years or custom periods.
2. An account has at most one budget in force for a given month.
3. Nothing is prorated. A budget declared mid-month rules the whole month.
4. Nothing carries over. Neither a surplus nor an overspend reaches the next
   month.
5. A month's budget is a decision recorded for that month. Allocations for any
   month earlier than the current one in the account owner's timezone are not
   modified: the amount that governed an elapsed month is an established
   historical budget fact.
6. The backend is the only authority for deciding which month "now" is.
7. Budget never records spending. It reads what Tracker recorded.
8. A row is a decision, not a month. The budget in force for month M is the last
   row with `budget_month <= M`. This is the whole of recurrence (§3.3). It is
   stated among the invariants because a reader who does not find it here is the
   reader who adds a `recurring` column.
9. The effective budget of an account for a month is what the applicable
   decision resolves to, and `0` when no decision applies. There is no separate
   *"not budgeted"* state: an explicit decision of `0` and the absence of any
   decision produce the same figure. Whether a decision was recorded is a fact of
   `budget_monthly_allocations`, not a field of the contract (§3.5, decision 39,
   which replaced the earlier reading of this invariant on 2026-08-13).
10. Both sides of the comparison live on the account owner's calendar: the month
    a budget belongs to, and the month a transaction is counted in (§4.5).
11. A write is one transaction. The steps of §5.1 all take effect or none does.
    There is no state in which a month is written and the terminator that
    belongs to the same decision is not.
12. Writes on the same account are serialized. The transaction that commits last
    wins, and it resolves the amount it carries from what the previous one
    committed (§5.1).

---

## 2. Scope

The module answers five questions and no others:

- What is the budget in force for this account this month?
- How much was spent against it?
- How much is left, and is it overspent?
- What were the budget and the actual for each month of a given range?
- What is the accumulated budget and actual over that range?

It is **not** an envelope system, a forecasting engine, or a planning tool. §13
lists what the model deliberately cannot express and what would have to change to
express it.

---

## 3. Data model

### 3.1 The table

```sql
CREATE TABLE IF NOT EXISTS budget_monthly_allocations (
 budget_allocation_id SERIAL PRIMARY KEY,
 account_id           INTEGER       NOT NULL
  REFERENCES category_budget_accounts(account_id) ON DELETE CASCADE,
 budget_month         DATE          NOT NULL,
 budget_amount        DECIMAL(15,2) NOT NULL CHECK (budget_amount >= 0),
 created_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_budget_allocation_month UNIQUE (account_id, budget_month),
 CONSTRAINT chk_budget_month_is_first CHECK (EXTRACT(DAY FROM budget_month) = 1)
);
```

One table. No `budget_policies`, no `budget_frequency_types`.

### 3.2 Why each decision

| Decision | Reason |
|---|---|
| `DATE` on the first of the month, not `(year, month)` | `<=` and `generate_series` work natively; ordering needs no composite comparison |
| `EXTRACT(DAY …) = 1`, not `date_trunc` | `date_trunc(text, timestamptz)` is *stable*, not *immutable*, and cannot appear in a CHECK. The `date` overload resolves to the immutable `timestamp` version only through an implicit cast — a trap not worth setting. `EXTRACT` is immutable without ambiguity |
| No `budget_policies` | It held `account_id UNIQUE` and nothing else. It existed to parent the SCD2 chain; with no chain it is pure indirection |
| No currency column | Inherited from `category_budget_accounts.currency_id`, which migration 011 already made `NOT NULL` and guards with `enforce_category_budget_currency`. A copy here can drift |
| No `recurring` column | See §3.3 |
| `CHECK (budget_amount >= 0)` | See §3.4 |
| No additional index | `uq_budget_allocation_month (account_id, budget_month)` is the index the resolution needs. Postgres walks the btree backwards for `ORDER BY budget_month DESC LIMIT 1` |

### 3.3 Recurrence is not a column

A budget carries forward until a later row replaces it. That means "this
allocation is recurrent" is already encoded as *"no later row terminates it"*.

Storing it as a column creates a second source of truth for one fact, and two
sources of truth can disagree:

```
 row Aug = 300, recurring = true
 row Sep = 0
 → which one governs September?
```

That conflict has no correct answer, only a precedence rule that must be written,
documented and never forgotten. Without the column it cannot arise.

**Consequence:** one row equals one user decision, never one elapsed month. An
account budgeted at $300 in January, raised to $400 in June, with a $700
exception in September holds four rows for twelve months — and still four rows
after three years:

| `budget_month` | `budget_amount` |
|---|---|
| `2026-01-01` | 300.00 |
| `2026-06-01` | 400.00 |
| `2026-09-01` | 700.00 |
| `2026-10-01` | 400.00 |

The October row is the only one the user did not type. It is the *terminator*
that ends the September exception. Without it, $700 would carry forward forever.

### 3.4 Zero is a value, not an absence

"No budget from month M" cannot be expressed by deleting rows. Under carry-forward
an absent row does not terminate anything — the previous row keeps governing:

```
 rows:  Jan = 300           → Jan, Feb, Mar … all 300
 want:  no budget from March
 delete March row  → there was none
 delete Jan row    → January and February are destroyed too
```

Only a positive marker can stop the carry-forward, and the only marker available
is zero.

| Representation | Verdict |
|---|---|
| Delete rows | Rejected — cannot terminate the carry-forward, and deleting backwards destroys history |
| `budget_amount = NULL` | Rejected — pushes three-valued logic into every read, `SUM` and comparison |
| `budget_amount = 0` | **Accepted** — an ordinary value, one relaxed CHECK, no extra code |

Zero does not mean "a budget of zero". It means *the decision not to budget*, and
it occupies a row like any other decision.

The constraint lives at three layers, and they are deliberately different:

| Layer | Rule | Why |
|---|---|---|
| Database | `budget_amount >= 0` | Zero is a legitimate state. Negatives stay forbidden |
| Zod / form | `amount > 0` | The amount field rejects 0. Nobody disables a budget with a stray keystroke |
| "Remove budget" action | Writes the 0 | A separate action with its own confirmation, not a typed amount |

### 3.5 A budget of zero, and a month with no allocation

| State | How it resolves | `budgetAmount` |
|---|---|---|
| Before the account's first allocation | No row `<= M` | `0` |
| Budgeted at zero | A row resolving to `0` | `0.00` |
| Budgeted | A row resolving to `> 0` | the amount |

**The first two are one state for every purpose the contract has.** The effective
budget of an account for a period is the amount the applicable decision resolves
to; with no applicable decision it is `0`. There is no independent *"not
budgeted"* state, and no monetary field is ever `null`.

They remain **two different facts in the database** — one has a row, the other
does not — and any question that needs the difference answers it with a `SELECT`
over `budget_monthly_allocations`. What it is not is a business state the API
carries or the screen labels.

**Closed 2026-08-13 (decision 39).** `isBudgeted` published that distinction as a
contract field and was removed in `e1449e0`, with the two counters derived from
it. It was also the wrong indicator for what the read path used it for: an
account exists from its start month, while an account the backfill skips has no
row at all, so it reported `false` for every month of an account that was there
the whole time. The existence of the account and the existence of a decision are
different facts, and one flag cannot answer both.

---

## 4. Resolution

### 4.1 One account, one month

```sql
SELECT budget_amount
FROM budget_monthly_allocations
WHERE account_id = $1 AND budget_month <= $2
ORDER BY budget_month DESC
LIMIT 1;
```

### 4.2 N accounts, one month — single pass

```sql
SELECT DISTINCT ON (account_id) account_id, budget_amount
FROM budget_monthly_allocations
WHERE account_id = ANY($1) AND budget_month <= $2
ORDER BY account_id, budget_month DESC;
```

### 4.3 One account, a month range — carry-forward fills the gaps

```sql
SELECT m.month::date AS budget_month, (
  SELECT a.budget_amount
  FROM budget_monthly_allocations a
  WHERE a.account_id = $1 AND a.budget_month <= m.month
  ORDER BY a.budget_month DESC
  LIMIT 1
 ) AS budget_amount
FROM generate_series($2::date, $3::date, interval '1 month') AS m(month);
```

`NULL` in the result means *no allocation was in force that month* — the month
precedes the account's first row (§3.5). The API turns it into `budgetAmount: 0`,
the effective budget that the absence of a decision resolves to; the `NULL` does
not survive the response.

### 4.4 What this removes

**Before** — `budgetAccumulatedAmount = amount × floor(months / monthsPerPeriod)`

**After** — `SUM(budget_amount)` over rows

That `floor` is the origin of R14, of R36 and of the dead calculator. It
disappears with no replacement. No `NaN`, no window reporting zero, no
`monthsPerPeriod`.

### 4.5 Spending is bucketed on the owner's calendar too

Added by the 2026-08-12 audit, which found the document silent here — and the
silence had already produced a defect.

**Defect D-2 / R42.** `transactions.transaction_actual_date` is `TIMESTAMPTZ`
(`createTables.js:173`, was `:134`) and `SPENT_QUERY` compared it against bare dates
(`budgetTransactionRepository.js:169-170`; the query is now at `:187` and its two fixed
bounds at `:199-200`, re-measured 2026-08-30). A purchase at 23:00 on 31 August in
Bogotá is 04:00 on 1 September in UTC, so it is counted against the wrong month.
The budget side already resolves months on the owner's calendar (§5.1, invariant
6); the spending side did not. **A subtraction whose two terms use different
calendars is wrong at every month boundary.**

The fix is not "change the dates". It is invariant 10:

> The budget month and the spending window are determined with the **same**
> timezone — the account owner's. For a user in `America/Bogota` asking about
> August, `budget_month = 2026-08-01` and spending is every transaction from
> `2026-08-01 00:00:00` up to `2026-09-01 00:00:00` **read in
> `America/Bogota`**, not in UTC and not in the session zone.

```sql
 AND t.transaction_actual_date >= ($2::timestamp AT TIME ZONE $4)
 AND t.transaction_actual_date <  ($3::timestamp AT TIME ZONE $4)
```

`timestamp AT TIME ZONE zone` reads *"this local wall-clock boundary, in that
zone"* and yields a `timestamptz`: the instant local midnight actually happened.
That is the **opposite direction** to the round trip §10.2 rejects, and the
reason both are right with exactly one `AT TIME ZONE`:

| Direction | Purpose | Correct form |
|---|---|---|
| Local boundary → instant | Compare against a `TIMESTAMPTZ` column | `$bound::timestamp AT TIME ZONE tz` |
| Instant → local date | Store which month something belongs to | `date_trunc('month', $ts AT TIME ZONE tz)::date` |

**`::timestamp`, not `::date`, and the cast is load-bearing.** *(Corrected
2026-08-12: this section carried the `::date` form until commit 2 measured it.)*
`AT TIME ZONE` has two overloads, and given a `date` Postgres resolves to the one
taking a `TIMESTAMPTZ`, because that is the preferred type of the category. The
bound is then read as an instant in the **session** zone and converted OUT to
local time — the opposite direction to the one intended. Measured:
`'2026-08-01'::date AT TIME ZONE 'America/Bogota'` yields `2026-07-31 19:00`
where the `::timestamp` form yields `2026-08-01 05:00+00`. The month shifted five
hours the wrong way and every boundary transaction landed in the neighbouring
month, which is R42 again through a different door. Casting to `TIMESTAMP` first
picks the overload that takes a naive local time and returns the instant it
names.

Two conversions in either direction is the error, and it is the error that broke
the boot test of commit 1.

Half-open `[from, to)` throughout, matching §4.3's `generate_series`. The upper
bound is the first day of the month **after** the last month requested.

---

## 5. Write rules

### 5.1 The single write

**Superseded 2026-08-18 by `d21e669`, which widened the write from a flag to a
range. The routine below is what commit 1 shipped; §5.1.0 is what ships today.**
It is kept because §5.1.1 numbers its steps against it, and because every reason
it gives still holds — what changed is that the far edge of a change is a month
the caller names instead of always `M + 1`.

V1 writes **only the current month**. The month is derived server-side from the
account owner's timezone; the client never sends it.

```
 writeAllocation(accountId, amount, onlyThisMonth):

  1. M       := first day of the current month in the account owner's timezone
                The client never sends a month. There is no "requested month".

  2. carried := the amount in force immediately BEFORE this decision,
                resolved BEFORE step 4:

                  a row already exists at M  → use it
                  otherwise                  → the last row before M
                  otherwise                  → no previous budget (NULL)

                Which is one query: the last row with budget_month <= M (§4.1).

  3. DELETE FROM budget_monthly_allocations
      WHERE account_id = accountId AND budget_month > M

  4. UPSERT (accountId, M, amount)

  5. IF onlyThisMonth:
      INSERT (accountId, M + 1 month, COALESCE(carried, 0))

  6. ELSE: no terminator is written.
```

Three statements, no conditionals beyond the flag, idempotent.

**All six steps are one transaction** (invariant 11). Step 3 removes rows while
steps 4 and 5 write them, and no partial outcome is a state any user asked for: a
failure after step 4 leaves `Sep = 700` with October deleted instead of restored
to `300`. A decision commits whole or not at all.

**Writes on the same account are serialized** (invariant 12), by locking the
account row at the start of that transaction. Two concurrent saves cannot both
read the same prior amount: the second waits for the first to commit and then
resolves `carried` from the rows the first left. The semantics are **last
committed write wins, and the winner observes the loser** — which is what keeps
the terminator correct under concurrency, not merely the last one written.

The flag is named for the exception, never for the rule: recurrence is the normal
behaviour and has no name in the payload. There is no `recurring` field anywhere
in the API, the service or the schema (§3.3).

### 5.1.0 The range write — what ships today

**`d21e669`, 2026-08-18.** The caller sends both bounds and **neither has a
default**, because every default here destroys something: an open end erases the
decisions that follow, and a start month alone expires an amount the user meant
to keep.

```
 writeAllocation(accountId, amount, from, to):    to is a month, or NULL

  1. restoresFrom := to + 1 month, or NULL when to is NULL
     restoresTo   := the amount in force AT restoresFrom, resolved BEFORE
                     steps 2 and 3 — both destroy the evidence

  2. DELETE FROM budget_monthly_allocations
      WHERE account_id = accountId
        AND budget_month > from
        AND budget_month <= COALESCE(to, 'infinity')

  3. UPSERT (accountId, from, amount)

  4. IF restoresFrom IS NOT NULL:
       INSERT (accountId, restoresFrom, COALESCE(restoresTo, 0))
        ON CONFLICT DO NOTHING
```

§5.1.1 numbers the flag version. The mapping:

| §5.1.1 calls it | it is now |
|---|---|
| step 2 — resolved before the UPSERT | step 1 |
| step 3 — the `DELETE` | step 2, with a ceiling |
| step 5 — the terminator | step 4 |

Three differences from the flag version, each load-bearing:

- **`restoresTo` is read AT `to + 1`, not at `M`.** A row already sitting on the
  far edge states what that month is worth; carrying `from`'s amount there would
  overwrite a decision this write was never asked to touch.
- **The `DELETE` has a ceiling.** With `to` null it loses it, which is what *from
  this month on* means — every later decision goes. That is the one destructive
  branch, and asking before taking it is the caller's job, not this routine's.
- **The terminator is `DO NOTHING`, not a bare `INSERT`.** Step 2 no longer
  empties everything beyond `from`, so `to + 1` may already hold the very row
  step 1 read. Writing it back is a no-op at best and raises 23505 at worst.

`onlyThisMonth: true` becomes `appliesUntil = month`; `false` becomes
`appliesUntil = 'openEnded'`. The flag left the payload, it was not renamed.

**The §13 boundary is unmoved.** `month` later than the current one is still
**422**: no user authors a future *amount*. `appliesUntil` may be a future month
because it names when a present amount stops, which is the same thing the
terminator at `M + 1` always did — only now the user chooses how far out it sits.

### 5.1.1 Why each step is load-bearing

Every one of the three fails **silently** if dropped — the current month always
renders correctly and the defect only surfaces a month later.

| Step | If omitted | Failure |
|---|---|---|
| 3 — the `DELETE` | Rows: `Aug=300`. In September the user saves `700, onlyThisMonth` (→ `Sep=700, Oct=300`), then changes their mind and saves `700, recurrent` | October stays at **300**. The surviving terminator reverts a budget the user asked to be permanent |
| 2 — resolved **before** step 4 | Read after the UPSERT | `carried` returns the amount just written, the terminator repeats it, and **"only this month" becomes a no-op** |
| 5 — `COALESCE(carried, 0)` | Treating `carried IS NULL` as "nothing to terminate" | The amount carries forward **forever** — the exact opposite of the request. The `0` row is what makes §7.1's *"October will have no budget"* true |

**D-1 (R41) — corrected 2026-08-12, after commit 1 had landed.** Both this
section and `budgetAllocationRepository.js` said `< M`, strictly earlier. That
reading is wrong whenever a row already exists at `M`, and the §5.3 table never
exercises that state because every one of its five cases starts from a baseline
set in an earlier month. Measured against the real database, `writeAllocation`
saving `500, onlyThisMonth`:

| Seeded rows | `restoresTo` expected | `< M` produced | |
|---|---|---|---|
| `M-2 = 300`, nothing at `M` | `300` | `300` | OK |
| `M = 300` — the baseline was set earlier this same month | `300` | `0` | **KO**, the terminator wipes the budget |
| `M-2 = 300`, `M-1 = 700`, `M = 300` — a terminator already sits at `M` | `300` | `700` | **KO**, the exception is resurrected |

The second row is the ordinary case of budgeting an account and editing it the
same afternoon. The third is the ordinary case of correcting an exception in the
month the previous exception expired. `< M` reads *the month before*; what the
terminator has to restore is *the amount in force*, and when a row exists at `M`
those are different numbers.

The fix is one operator. `carried` becomes the §4.1 resolution — the same query
every read path already uses — applied at `M` before step 4 overwrites it. What
made this hard to see is that the failure is silent in the month of the write:
`M` renders the amount the user typed, and only `M+1` is wrong.

`getAllocationBefore` loses its only caller. Per D8 it is not deleted here; it
goes to the §9.4 register and leaves with the single deletion block.

The `DELETE` in step 3 is safe **only because V1 lets no user author a future
month**: the only thing that can exist beyond `M` is a terminator this same
routine wrote. §13 records this as the V2 boundary.

Step 5 stays an `INSERT`, not an `UPSERT`, for the same reason: step 3 has just
emptied everything beyond `M`, so `M+1` is always free. It becomes an `UPSERT`
the day V1's successor allows authoring future months and that `DELETE` turns
conditional — the boundary §13 draws.

Rollover is not a step and cannot be suppressed by one. It is absent because the
model has no second entity — a balance — for a surplus to live in. It is an
invariant of the module (§1.4), not a branch of this routine.

### 5.2 Why restricting writes to the current month matters

**Before** — with a month picker:

```
 forward : UPSERT(M) ; respect or overwrite already-authored future months?  ← open decision
 only    : UPSERT(M) ; IF M+1 has no row of its own → INSERT(M+1)           ← conditional
```

**After** — current month only: both conditionals disappear, and with them the
open decision.

### 5.3 The five cases from the specification

| Case | Write | Resulting rows | Reads as |
|---|---|---|---|
| First budget, $300 | `amount 300`, recurrent | `Aug=300` | Aug → ∞: $300 |
| Exception, $700 this month | `amount 700`, only-this-month | `Aug=300, Oct=700, Nov=300` | Oct $700, Nov back to $300 |
| Permanent raise to $400 | `amount 400`, recurrent | `Aug=300, Oct=400` | Oct → ∞: $400 |
| Stop budgeting | `amount 0`, recurrent | `Aug=300, Oct=0` | Oct → ∞: no budget |
| Amount and recurrence at once | one save | one row | — |

Two more states, added with D-1 because they are the ones the five cases above
never reach — both start from a row that already exists **at** the current month:

| Case | Starting rows | Write | Resulting rows | Reads as |
|---|---|---|---|---|
| Budgeted and edited the same month | `Aug=300` | `500`, only-this-month | `Aug=500, Sep=300` | Sep back to $300, not to "no budget" |
| An exception corrected where a terminator already sits | `Jun=300, Jul=700, Aug=300` | `500`, only-this-month | `Jun=300, Jul=700, Aug=500, Sep=300` | Sep back to $300, not to July's $700 |

### 5.4 Removing a budget entirely

Two distinct verbs, two distinct screens:

| Action | Where | Effect |
|---|---|---|
| "Stop budgeting" | Budget screen | Row `(M, 0)` |
| "This account is not budgeted" | Account edit | `DELETE` every row for the account |

---

## 6. Edge cases

| Case | Resolution |
|---|---|
| A month before the account's first row | No row resolves. `budgetAmount: 0`, the effective budget of an absent decision — the same figure a chosen `0` produces (§3.5) |
| Re-editing the current month | UPSERT. Free, as many times as the month lasts |
| Editing a month earlier than the current one | **Not offered.** No request carries a month, so a past month is not addressable. Rewriting July from December would change an established historical budget fact |
| Authoring a future month | **Not offered in V1.** §13 |
| Redundant row (same amount as the one carrying forward) | Kept. Collapsing means the write path deletes user rows for zero benefit |
| Two rows in the same month | Impossible — `uq_budget_allocation_month` |
| Account created with a budget | That amount is the first allocation, recurrent, written at the account's start month. No checkbox in the account form |
| `budget = 0` and a percentage is requested | Not calculated. This is the guard against division by zero, not a presentation choice |
| Spending on an unbudgeted account | Recorded normally. Budget does not govern spending. History shows actual with no budget, which is the truth |
| Stop budgeting cannot be scheduled ahead | Accepted cost of current-month-only writing. Takes effect from the current month with an explicit warning: *"August will have no budget."* To keep August, do it in September |

---

## 7. Frontend contract

### 7.1 The edit form

The first budget asks nothing — "only this month" is meaningless with no baseline
to return to:

```
 FIRST BUDGET (new account)

 Amount  [ 300.00 ]  USD
 ↳ Applies every month until you change it.
```

An edit offers the exception, unchecked by default:

```
 EDIT (currently $300)

 Amount  [ 700.00 ]  USD
 ☐ Apply to August 2026 only
 ↳ From September it goes back to $300.
```

The helper text carries the actual number the month returns to, or *"September
will have no budget"* when nothing preceded.

**Why recurrent is the default:** the two mistakes do not cost the same. Checking
"only this month" by accident drops the amount back **silently** next month.
Leaving it recurrent by accident keeps $700 into January — visible, and
self-correcting. The default belongs where the failure is loud.

*(Amended 2026-08-18. The checkbox is no longer sufficient: `d21e669` replaced
the flag with a range, so the form has to state a last month as well as a first
one, and `appliesUntil` has no default to fall back on — see §5.1.0. The
reasoning above survives intact and now decides which end of the range the form
pre-selects, not whether a box starts ticked. **What control replaces the
checkbox is an open decision**, and it is the only thing between the shipped
backend and a budget that can be edited from its own screen.
`PLAN_BUDGET_WRITE_PATH.md` unit A owns it.)*

### 7.2 The account card

```
 🍽  Food
 August budget    $700.00   · this month only
 From September   $300.00
```

The second line appears only when the current month is an exception.

### 7.3 API surface

| Endpoint | Purpose |
|---|---|
| `PUT /api/fintrack/budget/accounts/:accountId/current` | Body `{ amount, month, appliesUntil }`, **all three required, none defaulted**. *(Amended 2026-08-18 by `d21e669` — was `{ amount, onlyThisMonth }` with no month. See §5.1.0)* |
| `POST /api/fintrack/budget/accounts/status` | Current month for N accounts |
| `GET /api/fintrack/budget/accounts/:accountId/series?from=&to=` | Per-month budget, actual, remaining |
| `GET /api/fintrack/budget/export?from=&to=&accountId=` | The series, flattened to CSV |

Retired: `GET /budget/frequencies`, `PUT /budget/policy/:budgetPolicyId`,
`GET /budget/history/:budgetPolicyId`, and **`GET /budget/summary`**.
`budgetPolicyId` leaves the API surface entirely.

`/summary` is retired rather than kept because `POST /accounts/status` with one
id answers the identical question, and §7.4 defines one per-account shape. Two
routes for one fact means two shapes to keep in step, and the single-account one
is the one that drifts — it already differs from `/export` only in whether
`accountId` is required. *(Added 2026-08-12: §7.3 listed neither its survival nor
its retirement, which is the kind of hole this section exists to close.)*

That leaves six routes today and four after commit 4.

**All three `/export` parameters are optional, and the defaults are not `/series`'
defaults.** `accountId` omitted covers every budget account owned; `from`/`to`
omitted collapse the range to the **current month alone**, which is what the
endpoint already does. `/series` defaults to twelve months because it feeds a
chart; `/export` defaults to one because that is the file the user downloads
today, and a default that silently returned a year would change the meaning of a
request that already works. *(Amended 2026-08-12: this table omitted `accountId`,
which commit 2 had already shipped and which works. Narrowing the endpoint to
match the omission would have deleted a working capability to fit a line of the
plan — §0 forbids exactly that.)*

**The rule that decides what a request may carry.** The current month never
travels — the server computes it from the account owner's timezone, which removes
clock skew, device zone and a tampered month in one move, and removes an input
from the form. A **historical range** does travel, as `from`/`to`, because the
server cannot guess which twelve months the user is looking at.

That rule is what removed `date` from `POST /accounts/status`, not just
`aggregationLevel`: status was the current month by definition, and a `date`
parameter would have been a second way to ask a question the endpoint only
answered one way.

*(Amended 2026-08-18. The write now carries `month` too. The rule is unchanged
and this is not an exception to it: what it forbids is a month the **client
computed**, and `month` here is the month the user is standing on — the one
already in the URL as `?month=` and already rendered as `referenceMonth`. The
server still refuses a month later than the current one on the owner's calendar,
so the client cannot reach a future it invented. Decision 48.)*

*(Amended 2026-08-14: `POST /accounts/status` takes an optional `month`. The rule
above stands unchanged — what it forbids is a **default** month computed by the
client, never a month the user chose. `/series` already carries that exception,
and for the same reason: the server cannot guess which month the user is looking
at, and the budget screen now lets them choose one. Omitted, `month` still means
the current month resolved on the account owner's calendar, and the client is
still forbidden from filling it from `new Date()`. Decision 40.)*

### 7.4 Response bodies

These are the shapes commits 5–10 are written against. They are frozen here
before any of them is implemented, which is the point of §0: the frontend is
built against this section, not against whatever the backend happens to return.

**`PUT /budget/accounts/:accountId/current`** — body
`{ amount, month, appliesUntil }`. *(Rewritten 2026-08-18 against `d21e669`. The
previous shape — body `{ amount, onlyThisMonth }`, response carrying
`onlyThisMonth` and no `overwrittenMonths` — is gone, not deprecated.)*

**The request.**

| field | form | omitted |
|---|---|---|
| `amount` | a non-negative number. `0` is how *stop budgeting* is expressed | **rejected**, 400 |
| `month` | `YYYY-MM` or `YYYY-MM-DD`, day discarded. The first month in force | **rejected**, 400 |
| `appliesUntil` | the same month form, **or** the string `'openEnded'`. The last month in force | **rejected**, 400 |

Neither bound is defaulted, and that is a decision, not an omission: defaulting
`appliesUntil` to `'openEnded'` silently erases every decision after `month`,
and defaulting it to `month` silently expires an amount the user meant to keep.
The two mistakes are opposite and both are invisible until the following month,
so the payload refuses to guess. `MONTH_PATTERN` is shared by both bounds in
`budgetValidators.js`, so the two forms cannot drift apart.

**Three failures are 422, not 400**, because the payload parsed and every field
is well formed — what fails is a relationship a schema cannot see: `month` later
than the current month on the owner's calendar, `month` earlier than the month
the account starts, and `appliesUntil` earlier than `month`.

**The response.**

```json
 {
  "accountId": 13,
  "budgetMonth": "2026-08-01",
  "budgetAmount": 700.00,
  "appliesUntil": "2026-08-01",
  "restoresTo": 300.00,
  "restoresFrom": "2026-09-01",
  "overwrittenMonths": ["2026-09-01", "2026-10-01"]
 }
```

`appliesUntil` is echoed in the caller's own vocabulary — the month, or
`'openEnded'` — rather than as the `null` the repository speaks, so the response
reads back as the request.

`restoresTo` and `restoresFrom` are **both `null`** when `appliesUntil` is
`'openEnded'`: nothing was terminated, so there is no far edge and no month to
name. That is a change from the flag version, where `restoresFrom` was always
present. `restoresTo` is `0` when nothing governed the month after the range, and
that `0` is what §7.1's *"September will have no budget"* renders. Both are
returned rather than computed client-side so the month name in that sentence
comes from the same calendar that wrote the row (invariant 10).

`overwrittenMonths` is **new and has no equivalent in the flag version**: the
months whose stored decision this write replaced, ascending, empty when it
replaced none. It exists because the open-ended branch is destructive — it
deletes every later decision — and the screen cannot warn about what it cannot
see. The client does not derive it; `DELETE ... RETURNING` is the only thing that
knows.

**`POST /budget/accounts/status`** — body `{ accountIds: [...], month }`, both
**optional**. `accountIds` omitted covers every budget account the caller owns,
which is the request the budget landing screen makes. *(Amended 2026-08-13:
`accountIds` was mandatory. A screen that has to learn the ids before it can ask
for their figures needs two round trips to render one list, and the ids it would
send are exactly the set the server can resolve from the session. `/export`
already reads an omitted `accountId` this way — §7.3.)*

`month` is `YYYY-MM` or `YYYY-MM-DD` with the day discarded, read exactly as
`/series` reads `from`/`to`. **Omitted, it is the current month on the account
owner's calendar** — that default is the endpoint's original behaviour and it
does not change. A month later than the current one is **422**, the same answer
`/series` gives a `to` in the future: a month that has not happened has no
spending to report, and an allocation resolved for it would be a forecast the
module does not offer (§13). There is no lower bound. Any past month resolves
through §4.1's `<= M` rule, and a month before the first allocation resolves to
nothing — the empty state, not a zero. *(Added 2026-08-14. Decisions 40–41.)*

`referenceMonth` in the response is the month the server actually resolved, and
it is what the screen renders. The client displays that value; it never displays
the month it asked for, because the two differ whenever it asked for none.

```json
 {
  "referenceMonth": "2026-08-01",
  "accounts": [
   {
    "accountId": 13,
    "accountName": "Food",
    "categoryName": "food",
    "subcategory": "Groceries",
    "accountStartDate": "2026-08-14T00:00:00.000Z",
    "currency": "USD",
    "budgetAmount": 700.00,
    "nextMonthBudget": 300.00,
    "actualSpent": 415.20,
    "remainingBudget": 284.80,
    "executionPercentage": 59.31,
    "isOverBudget": false
   }
  ],
  "categories": [
   {
    "categoryName": "food",
    "currency": "USD",
    "accountCount": 3,
    "budgetAmount": 900.00,
    "actualSpent": 512.40,
    "remainingBudget": 387.60,
    "executionPercentage": 56.93,
    "isOverBudget": false
   }
  ],
  "totals": {
   "currency": "USD",
   "budgetAmount": 700.00,
   "actualSpent": 415.20,
   "remainingBudget": 284.80,
   "executionPercentage": 59.31
  },
  "meta": { "notices": [], "currentMonth": "2026-08-01" }
 }
```

**`accountStartDate` is the day the account was registered, and it is not a
budget figure.** *(Added 2026-08-30. Decision 47.)* It is never rendered and
never summed. It is here because this payload is the only selector source in the
application that could not answer "did this account exist on the day the movement
is being dated". The four screens that read it are tracker forms, and back-dating
gives them a day that is not today: without this field an expense dated back
still offered every category, and the server refused the entry the form had just
invited.

It ships raw, the same `TIMESTAMPTZ` the nine account list queries in
`getAccountController` already ship, so the one client-side predicate that reads
it treats both payloads identically instead of growing a second behaviour for
this one. Null is admitted rather than hidden — the server validates the window
independently, and hiding a row on missing data would empty a list on a contract
change instead of failing where it can be seen.

It costs no query: `ACCOUNTS_QUERY` already selects from `user_accounts`.

**Landed `2b4d3dc`, owned by `PLAN_BACKDATING` §3.3.3**, which is where the rule
it serves is stated. Recorded here because this is the contract it changed.

**`meta.currentMonth` is the latest month that may be asked for.** *(Added
2026-08-15. Decision 46.)* It is not `referenceMonth`: that one is the month
being reported, and the two diverge on every request that named a past month. A
client that read the ceiling off `referenceMonth` would offer the month already
on screen as the latest there is, and a deep link to `?month=2026-05` would trap
the user in the past with no way back to today. The client cannot derive it
either — its clock is not the account owner's calendar, which is decision 23.

It costs no query. A request that names a month already pays for the lookup in
the 422 check of §7.3; a request that names none resolves the current month by
definition, so the field is `referenceMonth`. `/series` does not carry it: its
default `to` already **is** the current month, and a second place to state it is
a second place for it to disagree.

**`categories` exists so the three screens of the module cost one request.**
*(Added 2026-08-13.)* Budget is a drill-down — categories, then the accounts of
one category, then one account — and the client navigates it by filtering what it
already holds: `accounts[]` carries `categoryName`, so entering a category issues
no request at all. The alternative is an endpoint per level, which is three round
trips to show one number three ways, and a fourth place for the arithmetic to
disagree with itself.

The grouping is the server's, not the client's, for the same reason `totals` is:
the moment the client adds amounts up, the rule that decides how they are added
lives in a component instead of a service.

Each entry follows the same rules as an account row — every monetary field is a
number, `executionPercentage` is `null` when `budgetAmount` is `0`,
`remainingBudget` is negative when the category is overspent — and
`accountCount` is how many accounts of that category the response carries.
`categoryName` is the stored name, and the screen capitalises it: the server does
not decide how a label looks.

Ordering is by `categoryName`, ascending. An order the server does not state is
an order the client has to impose, and two clients would impose two.

Three rules govern the null-ness of that object, and each one is an invariant
already stated, not a presentation choice:

**Exactly one field is nullable, and only for one reason.** Every monetary field
is always a number; the absence of a decision resolves to `0` and needs no field
of its own. An amount that is null forces every consumer — response, totals, CSV,
chart — to branch on it, and each branch is a place to decide differently from
the others.

| Condition | Fields | Why |
|---|---|---|
| No decision in force | `budgetAmount: 0`, `nextMonthBudget: 0`, `remainingBudget: -actualSpent`, `isOverBudget: true` when anything was spent | Spending 150 against no budget leaves the user 150 in the red, and that is what the screen has to say. `null` says nothing, and the user reads it as "no aplica" when what happened is that they overspent |
| `budgetAmount: 0` | `executionPercentage: null` | The **only** null in the contract. There is no percentage of zero — not `0`, which reads as "spent nothing", and not `Infinity`. Its absence is the fact |
| Accounts in more than one currency | `totals.currency: null`, monetary totals `null`, `notices: ["MIXED_CURRENCY_NOTICE"]` | There is no FX in V1. Summing across currencies would invent a number (§8.3) |

The two states of §3.5 **are** collapsed by this, deliberately. Both resolve to
`budgetAmount: 0`, the screen reads one sentence, and the difference between them
stays where it belongs: as rows, or their absence, in
`budget_monthly_allocations`.

**`nextMonthBudget` is what makes §7.2's second line appear**, and it is derived
by comparing amounts — `nextMonthBudget !== budgetAmount` — not by asking whether
a row exists at `M+1`. That is deliberate: a redundant terminator carrying the
same amount changes nothing the user would recognise, and correctly renders
nothing. The card never says "this month only" about a month that is identical to
the next.

**`GET /budget/accounts/:accountId/series?from=&to=`**

```json
 {
  "accountId": 13,
  "accountName": "Food",
  "currency": "USD",
  "from": "2025-09-01",
  "to": "2026-08-01",
  "months": [
   {
    "month": "2026-08-01",
    "budgetAmount": 700.00,
    "actualSpent": 415.20,
    "remainingBudget": 284.80,
    "executionPercentage": 59.31,
    "isOverBudget": false
   }
  ],
  "totals": {
   "budgetAmount": 3900.00,
   "actualSpent": 3612.40,
   "remainingBudget": 287.60,
   "executionPercentage": 92.63,
   "monthsOverBudget": 3,
   "averageMonthlySpend": 301.03
  }
 }
```

Every month between `from` and `to` is present, including months with no
allocation in force — that is the carry-forward fill of §4.3, and a gap in the
array would make the client re-derive it. A month before the account's first
allocation comes back with `budgetAmount: 0` and the same null rules as status
above.

Parameters: both coerced to the first of their month, so `2026-08-17` and
`2026-08-01` are the same request. Defaults `to` = current month and `from` = `to
− 11 months`, which is the twelve-month view the history screen opens on.
Constraints `from <= to`, `to <= current month` — V1 has no future to show — and
a span of at most 60 months, which bounds the `generate_series` (§8.2) at a size
a chart can still render.

**`GET /budget/export?from=&to=`** — the same series, one CSV row per account per
month:

| Column | Change |
|---|---|
| `Account Name` | unchanged |
| `Subcategory` | **now populated**, from `category_budget_accounts.subcategory`. It has been emitting empty since it was written: it read `budgetPolicy.subcategory`, a field that table never had |
| `Currency` | unchanged |
| `Frequency` | **kept**, emitting the constant `monthly`. The column is a fact about the model, and a consumer that has a column for it can keep its parser |
| `Period Start` / `Period End` | collapse into one **`Month`** column. They existed to express windows that are no longer resolvable (§8.1) |
| `Budgeted` / `Spent` / `Remaining` / `Execution %` | unchanged in meaning, now per month. `Execution %` is empty when the budget is `0` or absent, never `0` |

### 7.5 Errors

One shape for every endpoint, so the client writes one handler:

```json
 { "status": 400, "message": "Validation Error",
   "errors": [ { "field": "amount", "message": "...", "code": "too_small" } ] }
```

*(Amended 2026-08-12: this section froze `{ error, issues }`, a shape the codebase
never used. The shipped envelope carries `field` and `code` per issue and is
already what `validateRequest.js` returns for the auth module, so the client still
writes one handler — just not this one. Correcting the document was preferred over
rewriting three handlers that had already passed gate 3.)*

Non-validation failures carry `status` and `message` only; `errors` appears when
Zod produced issues.

| Status | When |
|---|---|
| `400` | Zod rejects the body, the params or the query. Schemas are `.strict()`, so an unknown key — `aggregationLevel`, `date`, `budgetPolicyId` — is a `400`, not a silent ignore |
| `401` | No session |
| `403` | The account does not exist, **or** exists and is not the caller's |
| `422` | The range is well-formed but not answerable: `from > to`, `to` in the future, span over 60 months |

**There is no `404` in this module, deliberately.** *(Amended 2026-08-12,
reversing this section's previous rule.)* An endpoint that answers `404` for an
id that does not exist and `403` for one that does is an oracle: a caller walks
the id space and learns exactly which accounts belong to other users, without
ever reading one. The cost of collapsing them is that a wrong id and a foreign id
look alike **to the client** — which is a developer, with the server logs, where
the distinction can be recorded safely. The cost of keeping them apart is paid by
a user who never sees it. The previous justification — that collapsing them hides
a real bug behind a plausible one during the frontend integration — is true and
still loses: it weighs developer convenience against enumeration of another
user's data.

This is not a new rule; it is the one already written into
`lockOwnedAccount`'s doc block and into every `403` the module returns. §7.5 was
the outlier.

---

## 8. Aggregation for Overview, Dashboard and Insights

Comparing spending against historical budget — monthly, accumulated, over
arbitrary ranges — is a **required** capability. It is served without
reintroducing frequencies.

### 8.1 What dies and what replaces it

| | Before | After |
|---|---|---|
| Parameter | `aggregationLevel: monthly\|quarterly\|four-month\|semiannual\|yearly` | `from` and `to`, two months |
| Machinery | `resolveWindowFor`, `MONTHS_PER_PERIOD`, `native/aggregated/resolved/mixed` | none |
| Result | One number per resolved period, with a `floor` | One row per month |
| Quarter | A period the model had to know about | `SUM` of three rows |
| Year | A period the model had to know about | `SUM` of twelve rows |
| Accumulated | Not expressible | Running sum over the series |

A month range is strictly more capable than the enum: it expresses every window
the enum expressed, plus every window it did not (a rolling 90 days, a fiscal
year that does not start in January, "since the account opened").

### 8.2 The series is the aggregation primitive

`§4.3` returns one row per month with the carry-forward already applied. Every
Overview and Insights figure is a fold over that series:

| Figure | Fold |
|---|---|
| Monthly comparison | the series itself |
| Quarter / semester / year | `SUM(budget)`, `SUM(actual)` over the slice |
| Accumulated budget vs actual | running `SUM` |
| Average monthly spend | `SUM(actual) / count(months in range)` |
| Months over budget | `count(actual > budget)` |

**Who folds: the backend.** `/series` returns the months **and** the range
totals; the client renders both and derives neither. The reason is rule 1 of
§8.3 — a range's percentage is recomputed from the sums, never averaged from the
per-month percentages. If the client folded, every client would have to
reimplement that rule, and the first one that writes `avg(executionPercentage)`
produces a number that looks right and is wrong.

The client still slices freely: a quarter is three consecutive entries of
`months`, and summing three `budgetAmount` values is addition, not a rule. What
it must not do is derive a **percentage** or an **average** from anything except
the sums. `totals` exists so it never has to.

One counting decision that the totals depend on, settled here because it is the
kind that gets decided twice otherwise:

| Question | Decision | Why |
|---|---|---|
| Does `averageMonthlySpend` divide by all months or by some subset? | **All months in the range** | Spending happens whether or not a decision was in force (§6). Any smaller denominator reports an average higher than any month actually spent |

*`budgetedMonthCount` was the second decision here and was removed with
`isBudgeted` in `e1449e0`: it counted a state §3.5 no longer defines, and it was
a denominator nowhere.*

### 8.3 Rules that survive from PLAN F

1. **Percentages are never summed or averaged.** A range's percentage is
   recomputed as `SUM(actual) / SUM(budget)`.
2. **`budget = 0` yields no percentage**, at every aggregation level. A range
   whose budget sums to zero has no percentage either.
3. **No FX conversion.** Amounts are in the Expense Account's currency. A total
   spanning currencies reports `currency: null`, **every monetary total `null`**,
   and the existing `MIXED_CURRENCY_NOTICE`. **Implemented in commit 2**
   (`makeTotals`), which closed the defect this rule was written against: the
   totals used to null the label and emit the sum anyway, adding USD to COP at an
   implicit rate of 1:1 — the invented number the rule exists to forbid. The
   per-account rows keep their own amounts and their own currency, so nothing was
   lost; only the bad addition disappeared. *(Updated 2026-08-12; the previous
   text still read "does not implement it yet" and cited line numbers from a file
   that has since been rewritten.)*

   The rule does not reach `/series` totals: a series covers **one** account, so
   its months cannot span currencies. `/export` spans accounts, but a CSV has no
   totals row — each line carries its own `Currency` column.
4. **Months with no decision in force contribute `0` to a `SUM`**, and are
   counted like any other month by `averageMonthlySpend`, which divides by every
   month in the range (§8.2).

`MIXED_PERIOD_NOTICE` dies — every row now shares one window, so periods can no
longer be mixed. `MIXED_CURRENCY_NOTICE` stays; currencies still can be.

---

## 9. What this replaces

Legacy artifacts marked for removal, per the deprecation rule in `CLAUDE.md`.
Line counts measured on `feat/budget`, 2026-08-11.

### 9.1 Removed outright

Two categories are mixed in this table and D8 separates them: **schema and
symbols** die inside the commit that supersedes them, because a column or an
exported constant cannot outlive the code that gave it meaning; **whole files**
lose their caller and wait for commit 13 (§9.4). Rows below say which.

| Artifact | Lines | Why |
|---|---|---|
| `budget_frequency_types` table + seed + FK | — | No frequency exists |
| `budget_policies` table | — | Held only `account_id UNIQUE` |
| `budget_policy_allocations` (SCD2) | — | Replaced by `budget_monthly_allocations` |
| `utils/fintrackUtils/date-utils/periodResolver.js` | 197 | Collapses to `date_trunc('month', … AT TIME ZONE tz)`. **File deleted in commit 13, §9.4** |
| `utils/fintrackUtils/date-utils/getNumberOfPeriods.js` | 27 | Accumulation stops being multiplication. **File deleted in commit 13, §9.4** |
| `resolveReplacementBoundary` | — | **R36 disappears with it** |
| `resolveWindowFor` + the `resolution` vocabulary | — | One period admits no `native/aggregated/resolved/mixed` |
| `makeMonthlyEquivalentBudget`, `monthlyEquivalentBudget` | — | Existed only to add rows on different periods |
| `MIXED_PERIOD_NOTICE` | — | Periods can no longer be mixed |
| `DEFAULT_FREQUENCY`, `MONTHS_PER_PERIOD`, `ALLOWED_WINDOW_FREQUENCIES`, `ALLOWED_ALLOCATION_FREQUENCIES` | — | `budgetConfig.js:11-24` |
| `ALLOCATION_INTENTS`, `DEFAULT_ALLOCATION_INTENT` | — | `budgetConfig.js:26-27`. The scope is now an explicit UI choice, not an inferred intent |
| `GET /budget/frequencies` + `getFrequencies` | — | No catalog to serve |
| `valid_until`, `close_reason`, `uq_budget_allocation_active` | — | The stored end date is what dies |

### 9.2 Rewritten

| File | Lines | Fate |
|---|---|---|
| `services/budgetPolicyService.js` | 505 | Becomes an allocation service; SCD2, `intent` and boundary resolution removed |
| `services/budgetCalculationService.js` | 409 | Loses window resolution and monthly equivalence. `makeTotals` is module-private at `:331` (was `:283`, re-measured 2026-08-30) and must not die with the surrounding code: it is rewritten in place to §7.4's totals — `budgetAmount`, the aggregate percentage from the sums, and `null` monetary totals under mixed currencies. *(It also emitted `budgetedAccountCount`, removed by decision 39.)* |
| `db/budgetTransactionRepository.js` | 251 | `SPENT_QUERY` survives, with the R42 timezone fix. `ALLOCATIONS_QUERY` and `POLICY_FREQUENCY_QUERY` go; a `<= M` resolution for N accounts replaces both |
| `core/makeBudgetAccountStatus.js` | 110 | Rounding survives (§9.3); the `resolution` field and its `RESOLUTIONS` enum go, and the shape becomes §7.4's |
| `core/budgetPolicy.js` | 42 | Merges into the allocation shape |
| `core/budgetAllocation.js` | 62 | Reshaped to `(account, month, amount)` |
| `core/budgetConfig.js` | 55 | Reduced to what is left |
| `controllers/budgetController.js` | 297 | New endpoints, no `budgetPolicyId` |
| `validation/zod/budgetValidators.js` | 137 | `amount > 0`, `onlyThisMonth`, `from`/`to` |

### 9.3 Survives untouched

| Artifact | Why it must not die by accident |
|---|---|
| `core/money.js` (155) | Decimal arithmetic. Nothing about it was frequency-dependent |
| Rounding in `core/makeBudgetAccountStatus.js` (110) | `ROUNDING-POLICY.md` still governs |
| `users.timezone` | Role narrows to classifying transactions into months and deciding which month "now" is — narrower, but load-bearing |
| Migration 011 (`enforce_category_budget_currency`) | Operates on `category_budget_accounts.currency_id`. Zero references to the budget tables — measured |
| Migration 013 (`normalize_category_budget_name_case`) | Zero references to `budget_polic*` or `allocation` — measured |

---

### 9.4 Deferred deletion register

**Rule, set by the owner 2026-08-12: nothing is deleted for being unused until
the module is complete — backend and frontend — and working.** An artifact that
looks unreferenced today may be what the frontend work still ahead needs, and
that work has not been done. What looks dead is recorded here and removed in one
cleanup commit at the end.

Two categories, and only the first is acted on during the sequence:

| Category | Treatment |
|---|---|
| **Forced by a commit** — it queries a table that commit removes, so boot or migrate fails with it present | Removed in that commit. There is no alternative |
| **Apparently unused** — the application compiles and boots unchanged with it present | **Recorded here. Not touched** |

> **Re-measured 2026-08-23 — five of these no longer exist.** `budgetPolicyService.js`,
> `calculators/budgetVsActualCalculator.js`, `core/budgetPolicy.js`,
> `core/budgetAllocation.js` and the whole `date-utils/` directory — with
> `periodResolver.js` and `getNumberOfPeriods.js` in it — are gone from the tree,
> and nothing imports any of them. The register below is left intact because each
> row records what was measured when it was written; this note records what is
> left. **Commit 13 is therefore mostly executed, and what remains of it must be
> re-measured before it is presented**, which is what its own row in §11 Phase 4
> already demands.
>
> **The two Phase 4 items that are genuinely open are 11 and 12**, and they now
> wait on nothing. `calculateBudgetMetrics.js` is live with four consumers —
> `getAccountController.js:43` (a local copy of the same function), `:196`,
> `:759` and `getAccountDataById.js:59` — plus `dashboardController.js:185-186,347`.
> That inventory is item 11; retiring the column is item 12.
>
> **Anchors re-measured 2026-08-30 — the inventory is the same size, the lines are not.**
> The local copy is `getAccountController.js:56`, its two callers `:217` and `:846`, and
> `getAccountDataById.js:59` is unchanged. The dashboard's two legacy budget reads are
> `dashboardController.js:194-195` and `:356`. **One thing about those two changed in
> substance, not only in position:** the balance term beside `cba.budget` is no longer the
> stored column — both now read `SUM(${DERIVED_BALANCE})`. The column being inventoried
> for retirement is `cba.budget`, and it is still read at both sites.

Running register. Each entry states what was measured, not what is assumed:

| Artifact | Lines | Measurement |
|---|---|---|
| `core/budgetPolicy.js` | 42 | `makeBudgetPolicy` imported by nothing |
| `core/budgetAllocation.js` | 62 | `makeBudgetAllocation` imported by nothing |
| `services/budgetPolicyService.js` | 505 | After commit 1 its only importer is `budgetController`, itself inside the declared KO |
| `budgetConfig.js` — `DEFAULT_FREQUENCY`, `ALLOWED_ALLOCATION_FREQUENCIES`, `ALLOCATION_INTENTS`, `DEFAULT_ALLOCATION_INTENT` | — | The account controllers stop importing them in commit 1 |
| `populateDB.js` — `tblBudgetFrequencyTypes` | ~40 | Loses its caller in commit 1; the function stays |
| `populateDB.js:59` — the `budget_frequency_types` row of `SEEDED_CATALOGS` | 1 | Harmless with the table gone: `resyncSequence` guards with `to_regclass` (`:75`) and returns false. The boot logs `6/7` instead of `6/6` |
| `initDatabase.js` — `assertBudgetFrequenciesMatchConfig` | 21 | Loses its caller in commit 1; the function stays |
| `date-utils/periodResolver.js` | 197 | Collapses to `date_trunc('month', … AT TIME ZONE tz)` |
| `date-utils/getNumberOfPeriods.js` | 27 | Accumulation stops being multiplication |
| `budgetAllocationRepository.js` — `getAllocationBefore` | 13 | Loses its only caller in commit 1b, which replaces it with the `<= M` resolution (§5.1.1). Kept, not deleted, because a `< M` lookup is exactly what authoring a future month would need at the V2 boundary |
| `budgetTransactionRepository.js:21-63` — `getTotalSpentByAccountAndPeriod`, `getTransactionsByAccountAndPeriod` | 43 | Already uncalled; measured again after commit 2 |
| `calculators/budgetVsActualCalculator.js` | 163 | Loses its only caller in commit 2. It cannot survive as written regardless: the `floor` at `:34-55` is the defect §8.1 removes, and the guard at `:84-115` rejects `budgetAmount <= 0`, which contradicts invariant 9 |

---

## 10. Migration strategy

### 10.1 Rewritten in place, not repaired

Migrations 010–013 exist in the chain but **have never been applied to Supabase**.
Under D6, a later migration that corrects an earlier one is forbidden. Therefore
010 and 012 are rewritten in place and the local database is rebuilt from scratch,
which D4 authorizes.

| File | Before | After |
|---|---|---|
| `010_create_budget_tables.sql` | 3 tables, a 5-row catalog seed, a partial unique index for SCD2 | 1 table, no catalog, no partial index |
| `012_backfill_budget_policies.sql` → `012_backfill_budget_allocations.sql` | Policy + open allocation from `cba.budget` | One row per budgeted account at its start month |
| `011`, `013` | — | Untouched |

The rename is safe for the same reason the rewrite is: Supabase never recorded the
old filename, and the local `migrations` table is discarded with the database. The
old name names tables that will not exist.

### 10.2 The backfill

```sql
INSERT INTO budget_monthly_allocations (account_id, budget_month, budget_amount)
SELECT cba.account_id,
 date_trunc('month', ua.account_start_date AT TIME ZONE u.timezone)::date,
 cba.budget
FROM category_budget_accounts cba
JOIN user_accounts ua ON ua.account_id = cba.account_id
JOIN users u          ON u.user_id     = ua.user_id
WHERE cba.budget IS NOT NULL AND cba.budget > 0
ON CONFLICT (account_id, budget_month) DO NOTHING;
```

`ON CONFLICT` replaces the old `NOT EXISTS` guard and makes the file idempotent by
construction. The backfilled row is recurrent by definition — it has no
terminator — which is the correct reading of a legacy `cba.budget`: a standing
monthly amount.

**One `AT TIME ZONE`, not two.** This document carried the round trip
`(date_trunc(...) AT TIME ZONE tz)::date` until the boot test of commit 1
rejected it. `ts AT TIME ZONE tz` already produces a TIMESTAMP WITHOUT TIME ZONE
on the owner's calendar; converting it back yields a `timestamptz`, and casting
*that* to `date` resolves through the **session's** TimeZone. Measured on a
session running at `-03`: an account starting `2026-08-01 00:00Z` on a `'UTC'`
profile stored `2026-07-31` and breached `chk_budget_month_is_first`. Truncating
and casting the local timestamp is both correct and session-independent.

The DST divergence documented in the old 012 header (a zone springing forward at
00:00 on the 1st normalizes backward in Postgres and forward in `zonedDayStart`)
**disappears**: the result is a `date`, so the instant-level disagreement cannot
reach the stored value.

### 10.3 The second build path

The schema is defined **twice**: in the SQL migrations and in the runtime
initializer. Measured references to the budget tables:

| File | Refs |
|---|---|
| `db/run_time_db_init/createTables.js` (568) | 23 |
| `db/run_time_db_init/populateDB.js` (558) | 8 |
| `db/run_time_db_init/initDatabase.js` (280) | 6 |

This duplication has already caused one divergence — the old 012 header documents
it: production is built by the runtime path, which created the budget tables and
never backfilled, leaving budgeted accounts invisible to the read path.

**Rule:** every change to 010 or 012 is applied to the runtime path in the same
commit. A commit that touches only one of the two build paths is incomplete by
definition.

### 10.4 `category_budget_accounts.budget`

After the backfill this column is legacy: it is the source of the migration and
nothing else should read it. Retiring it requires the inventory of its readers,
which is **task 8 of PLAN F** and is scheduled last by D3. The column is not
dropped in V1.

### 10.5 Three budget systems coexist today

Measured 2026-08-12. This is the starting state the plan below operates on, and
it is not what an earlier reading of this document assumed.

| | **A — legacy** | **B — budget module** | **C — target** |
|---|---|---|---|
| Where it lives | `category_budget_accounts.budget` | `budget_policies` + `budget_policy_allocations` | `budget_monthly_allocations` |
| State | **Live. It is what the user sees** | Built, ~960 lines | Specified, zero code |
| Read by | The whole frontend | **Nobody** | — |
| Has a month | No | Yes | Yes |

**Writes feed both A and B.** Creating or editing an account writes `cba.budget`
*and* calls `applyAllocationForAccount` — `accountEditController.js:170` and
`:389-396`. The comment at `:384` states it outright.

**Reads are split.** The frontend reads **only A**, through endpoints that do not
belong to the budget module:

| Screen | Endpoint | Source |
|---|---|---|
| `BudgetLayout.tsx:15` — totals box | `dashboard/balance/summary?type=category_budget` | `SUM(cba.budget)` |
| `ListCategory.tsx:44` — category list | `summary_balance_ByType?type=category_budget` | `SUM(cba.budget)` |
| Account detail | `getAccountController.js:41,178,741` | `calculateBudgetMetrics` |

**The defect this module exists to fix** is visible on screen, not buried in dead
code. `dashboardController.js:347`:

```sql
(COALESCE(SUM(cba.budget), 0) - SUM(ua.account_balance))::FLOAT AS total_remaining
```

`ua.account_balance` is a running column updated on every transaction
(`transactionController.js:138`) and **never reset by period**. So the figure the
user reads today is *monthly budget − lifetime account balance*, which degrades
every month forever. System B was built to replace this and was never wired.

**Corrected 2026-08-30 — the defect stands, the mechanism behind it does not.** The
query moved to `dashboardController.js:356` and its balance term is now
`SUM(${DERIVED_BALANCE})`, the ledger derivation, not the stored column; the sibling at
`:194-195` reads the same way. And `transactionController.js:138` no longer exists as a
writer: the controller's own `updateAccountBalance` went with `be6ebbf`,
`accountManagement/updateAccountBalance.js` is deleted in today's working tree, and the
column is now written by `accountManagement/setAccountBalanceFromLedger.js`, which
re-derives it from the ledger under a lock the caller already holds. **What the fix does
not change is what this paragraph is really about:** a lifetime balance, derived or
stored, is still not a month's spend, so *monthly budget − lifetime balance* is still the
wrong subtraction on that screen.

**Consequence for the plan:** B is not dead code to delete, it is unwired code
built on the model V1 discards. It is rewritten, not removed, and §9.3 governs
what survives the rewrite.

---

## 11. Implementation plan

Grouped by what blocks what. Each commit leaves the application booting
(`APP LOADED OK`, gate 3).

**Fourteen commits**: thirteen numbered, plus `1b` inserted by the audit. The
application boots in all of them, and the user-reachable paths work in all of
them, because the frontend reads system A (§10.5) until commit 9 moves it. The
note this section used to carry — *"the module is broken between commits 1 and
6"* — was written before §10.5 was measured and is false. It is removed.

The count is stated because two different numbers were in circulation: this
section said thirteen and decision 15 said fifteen. Thirteen was the count of
numbered rows; fifteen was never derivable from any list. The audit adds one
commit and keeps the existing numbers untouched, which is why the new one is
`1b` rather than a renumbering — the numbers are referenced from §9.4, §10 and
`PLAN_BUDGET_FRONTEND.md`, and renumbering would invalidate every one of those references.

Each commit is presented as a gate and implemented only after approval. Decided
2026-08-12: this is a change of conceptual model, not a refactor, so no commit
runs unattended. And per D11, no gate is approved for a commit whose contract is
not already frozen in this document — which is what §7.4 exists to satisfy for
commits 3 through 10.

### Phase 1 — Schema and write path

| # | Commit | Note |
|---|---|---|
| 1 | `refactor(budget): replace schema and write path` | Both migrations, the runtime path (§10.3), the new repository, the allocation service and the two account controllers, in one commit. Landed as `3b72371` |
| 1b | `fix(budget): resolve carried at the month` | D-1 (§5.1.1). One operator in `budgetAllocationRepository.js`, plus the doc block that froze the wrong justification. **Landed as `adc1150`**, the three scenarios verified at `300/300/300` |

Local database rebuilt from scratch after commit 1.

**Why `1b` is its own commit and not folded into commit 2.** They touch opposite
halves of the module: D-1 is a defect in the **write** path, commit 2 rewrites
the **read** path. Folding them would produce a commit whose message describes
one change and whose diff contains two — the golden rule in `CLAUDE.md`.

**Reachability, measured 2026-08-12.** The defect is **latent, not live**. The
only HTTP path that reaches `writeAllocation` today is `accountEditController`
→ `applyAllocationForAccount`, which passes `onlyThisMonth = false`; `carried` is
computed on that call and never used. `onlyThisMonth = true` gets its route in
commit 4. So no stored row is wrong today and there is nothing to repair.

That is the argument for fixing it **now** rather than later, not against it: the
window in which this costs one operator and no data migration closes when commit
4 opens the route. It is also why `1b` carries no data repair step — a fix landing
after commit 4 would have needed one.

**Why these four things are one commit.** The schema change reaches the account
controllers through `budgetPolicyService`, and a commit that dropped the tables
without rewriting them would break account creation and account edit — paths the
user reaches every day. Splitting the schema from its write path produces a state
nobody should commit. Decided 2026-08-12 over two alternatives:

| Considered | Rejected because |
|---|---|
| Schema alone, consumers next | Creating or editing a category account throws for two commits |
| Old and new tables coexisting until the last consumer migrates | Removes the stale-code cost below, at the price of a longer sequence. Weighed and declined by the owner |

**Declared KO, accepted.** The read chain — `budgetTransactionRepository.js:85-89,
110-118, 142-144` → `budgetCalculationService` → `budgetController` — still names
`budget_policies`, `budget_policy_allocations` and `budget_frequency_types` after
this commit, and those tables no longer exist. It is stale code, stated rather
than hidden.

It closes in two steps, not one: **commit 2** repairs `/accounts/status` and
`/export` by moving them onto the monthly table, and **commit 4** retires
`/frequencies`, `PUT /policy/:id` and `/history/:id` outright, since those three
serve a model that no longer exists. So the KO spans one commit for the routes
that survive and three for the routes that do not.

**What justifies it — and what does not.** The KO is accepted because the same
phase closes it, and because §7.3–§7.5 already define what those routes become or
why they end: the breakage is bounded by a contract that exists, not by luck.

The justification this paragraph used to carry — *"no frontend code calls
them"* — is withdrawn. It is not evidence of anything while the frontend is a
work in progress: an absent caller there is unwritten, not missing, and commits
5–10 are precisely the work of writing it. Breakage is justified against this
document, never against the accidental state of today's client (see the header
and §0). The rule is recorded here rather than only at the top because this
paragraph is where it was actually violated.

The timezone selector was originally scheduled here as a blocker. It is not one:
the module resolves months against whatever zone is stored, defaulting to `'UTC'`.
It moved to the adjacent blocks below, decided 2026-08-12.

### Phase 2 — Backend read path

| # | Commit | What it does |
|---|---|---|
| 2 | `refactor(budget): rebuild the budget api` | **Commits 2 and 4 merged, decision 36.** The read path moves onto `budget_monthly_allocations` and emits §7.4, taking with it `resolveWindowFor`, the `resolution` vocabulary, `makeMonthlyEquivalentBudget`, `MIXED_PERIOD_NOTICE`, the `floor` and `aggregationLevel`. Carries the D-2 fix (§4.5) and the overload defect it uncovered, populates `subcategory`. Retires `GET /summary`, `/frequencies`, `PUT /policy/:id` and `/history/:id`, and adds `PUT /accounts/:id/current`. **Closes the KO entirely: six routes become three, and every one of them runs** |
| 3 | `feat(budget): add month series endpoint` | Serves §8, to the shape frozen in §7.4. `/export` gains `from`/`to` |
| 4 | — | Merged into 2. The number is not reused; §9.4, §10 and `PLAN_BUDGET_FRONTEND.md` reference it |

**The 2 / 4 boundary was moved on 2026-08-12, measured before the gate.** Commit
2 was written as *"drop period resolution"*, and that is not something this
codebase can do on its own. `ALLOCATIONS_QUERY` and `POLICY_FREQUENCY_QUERY`
(`budgetTransactionRepository.js:106-150`) read `budget_policies`,
`budget_policy_allocations` and `budget_frequency_types`, and commit 1 dropped
all three. Pruning the resolution above a query that cannot run leaves the route
throwing for exactly the same reason as before.

And the window has to come from somewhere. Once `resolveWindowFor` and
`resolvePeriod` are gone, the answer is the monthly table — which *is* the read
path rewrite. So the two were never separable:

| Considered | Rejected because |
|---|---|
| Keep §11's wording: prune the resolution, keep the old field names, reshape in commit 4 | `buildAccountStatus:86-95` would have to **fabricate** a `budgetPolicy` — `budgetPolicyId`, `budgetFrequencyTypeId` — from a table that has no policies, for two commits. That is inventing a shape in order to delete it, and the owner has already rejected leaving inert scaffolding on the path |
| Fold 3 in as well | `/series` is added value, not a leftover. Nothing about it is blocked by shipping the read path, and it answers a question the current API never answered |

**Then 2 and 4 merged too, on the owner's rule that a commit must leave the thing
it touched whole.** The reason is not that the policy routes are broken —
measured 2026-08-12, `budget_frequency_types`, `budget_policies` and
`budget_policy_allocations` are all still present, and no migration drops them
yet. They work. That is the problem: leaving them up gives the module **two write
paths to the same budget**, one writing SCD2 rows nothing reads any more and one
writing `budget_monthly_allocations`. A user who edits a budget through the old
route would see the screen ignore the change, which is worse than an error.

The write route they are replaced by has to land in the same commit for the same
reason: retiring the only way to change a budget without providing the new one
leaves the module unusable between two commits.

Dropping the three tables is a separate migration, scheduled in Phase 4. Routes
retire in code; a table is data, and it goes when the deprecation window closes.

The names changed with the scope, because a message has to describe the diff:
*"drop period resolution"* would have named a deletion in a commit whose weight
is a rewrite, and *"rework routes and payloads"* would have named a reshape in a
commit that only retires.

What each of these removes is removed because it is *rewritten*, not because it
looks unused. Everything in the second category waits for the cleanup commit at
the end (§9.4).

### Phase 3 — Frontend

| # | Commit | Note |
|---|---|---|
| 5 | `feat(budget): define budget contract types` | `budgetTypes.ts`'s current 145 lines describe frequencies and SCD2. Discarded whole |
| 6 | `feat(budget): add budget api client` | `fintrack/services/` does not exist; everything goes through `useFetch` today |
| 7 | `feat(budget): add budget edit modal` | §7.1 — amount plus the `onlyThisMonth` checkbox |
| 8 | `feat(budget): show current month status` | §7.2 — the account card |
| 9 | `refactor(budget): read budget from module` | **The A → C migration.** `BudgetLayout.tsx:15` and `ListCategory.tsx:44,61,85,93` stop reading the dashboard endpoints |
| 10 | `feat(budget): add read-only history` | The month series in Overview and Insights |

*(Amended 2026-08-15: commit 7 shipped as `fix(budget): require the budget on
account edit` and the modal it named was never written. That leaves 8 and 9 in
the wrong order — 8 renders §7.2's exception line, which needs a second
allocation row, and only the unwritten modal writes one. The executable order is
**9, then the modal, then 8**. See `PLAN_BUDGET_FRONTEND.md` §10.3.)*

Commit 9 is the only one where the number on screen changes:

**Before** — `remaining = SUM(cba.budget) − SUM(account_balance)`, no month
**After** — `remaining = this month's budget − this month's actual`

`editionAndDeletion/utils/categoryBudgetCalculations.ts` performs budget
arithmetic client-side that now arrives computed: `enrichCategoryAccountData`
becomes redundant, and the stray `console.log` at line 24 goes with it.

### Phase 4 — Closure

| # | Item | Why last |
|---|---|---|
| 11 | PLAN F task 8 — inventory of `cba.budget` readers | D3. While the frontend reads system A the column has live readers and cannot be inventoried as retirable — which is why it follows commit 9, not precedes it |
| 12 | `chore(budget): retire legacy budget column` | Retires the column and its readers: `calculateBudgetMetrics.js`, its copy at `getAccountController.js:56` (was `:41`), and `dashboardController.js:194-195, 356` (was `:185-186,347`) — anchors re-measured 2026-08-30 |
| 13 | `chore(budget): remove superseded budget code` | **The single deletion block.** Executes §9.4's register, re-measuring each entry first. Last because only a working module — backend and frontend — proves what was really unused |
| — | R10 — `parseFloat` × 61 across 13 files | Still unowned |

PLAN I follows, per D7.

### Where recurrence lives, commit by commit

Recorded because the module's defining feature **has no column**. A reader who
looks for one and does not find it is the reader most likely to add
`recurring = true` and create the second source of truth §3.3 exists to prevent.

| Commit | What it contributes to recurrence |
|---|---|
| 1 · schema | `CHECK (budget_amount >= 0)` and `UNIQUE (account_id, budget_month)` — what *allows* the terminator row to exist. **Zero recurrence columns, deliberately** |
| 1 · repository | `writeAllocation(accountId, amount, onlyThisMonth)`. `carried` and the `M+1` terminator live here. **This is where recurrence becomes code** |
| 1 · controllers | The first budget is recurrent without asking. The account form carries no checkbox (decision 5) |
| 1b | `carried` becomes *the amount in force*, not *the previous month's*. Recurrence was correct; what the exception returned to was not (§5.1.1) |
| 2 | `nextMonthBudget` starts being returned — the read side of recurrence, and what the card's exception line is driven by (§7.4) |
| 4 | `PUT /budget/accounts/:id/current`, body `{ amount, onlyThisMonth }`. The month never travels; `restoresTo` comes back (§7.4) |
| 5 | The type carrying `onlyThisMonth`, and `restoresTo` / `nextMonthBudget` |
| 7 | The checkbox, unchecked by default, and the helper text naming the amount the next month returns to |
| 8 | The card's second line, shown only when `nextMonthBudget !== budgetAmount` |

### Adjacent blocks — deliberately outside this module

Decided 2026-08-12. Both are real work with designs already agreed; neither blocks
a single commit above, and neither belongs inside the budget module.

**Block T — timezone selector.** A searchable field on the profile form over the
full IANA catalog, built on `react-select` 5.8.0, which is already installed and
already bundled. Design closed: a thin controlled wrapper in
`auth/components/formUIComponents/`, a normalized `filterOption` (lowercase,
strip diacritics, `_` and `/` → space) since a raw substring filter was measured
to fail on `Bogotá`, `New York` and `gmt-5`; a short curated list shown while the
input is empty; offset labels computed by `Intl`, which also fixes the inverted
sign of `Etc/GMT+5`. `PROFILE_FIELD_MAPPING` must gain `timezone`, or the
backend's 400 is dropped silently at
`useUpdateProfileValidation.ts:133-135`. A second, one-time-only piece: prompt to
adopt the detected zone **only** when the stored value is the never-configured
`'UTC'` default — never on every login, because the accounting zone defines the
period boundaries and must not follow the device.

**Block C — enable all supported currencies.** The system supports five
(`usd`, `eur`, `cop`, `ves`, `mxn`) and the profile form offers three, hardcoded
at `UpdateProfileContainer.tsx:75-79`. The currency select is also disabled
whenever the value equals `DEFAULT_CURRENCY`. Changing a currency is a separate
module by product decision.

The curated timezone list is **not** anchored to the currency catalog. That
coupling was considered and rejected on 2026-08-12: one currency does not map to
one zone (`usd` spans seven, `eur` spans three offsets), and the two lists answer
different questions.

### Feature flag — declared exception

`CLAUDE.md` requires isolating new functionality behind `USE_NEW_BUDGET_SYSTEM`.
**This work does not use it**, and the omission is recorded here as accepted, not
hidden: production runs another branch (D4) and nothing deployed consumes this
code. A flag protecting zero users only duplicates every read path.

**The premise of that exception expired on 2026-08-22 — measured 2026-08-23.**
Both halves of the reason are now false:

- *Production runs another branch.* The production deploy target named in
  `spec.md` §3 is `feat/vercel-serverless`, and commit `7bb5a62`
  (`Merge branch 'feat/budget' into feat/vercel-serverless`, 2026-08-22) brought
  the whole module onto it. Its tree is now byte-identical to `main`:
  `git diff main feat/vercel-serverless` is empty. `budgetRoutes` is mounted
  unconditionally on that branch at `routes/index.js:24`.
- *Nothing deployed consumes this code.* `BudgetEditModal` is mounted on the same
  branch by three consumers — `EditAccount.tsx:674`, `CategoryDetail.tsx:518`
  and `CategoryAccountList.tsx:312` *(the three anchors read `:629`, `:466` and `:320`;
  re-measured 2026-08-30, the three consumers are unchanged)*.

The flag itself still does not exist anywhere in `backend/src` or
`frontend/src`; every occurrence of the name in the repository is prose. What
changed is not the code but the exposure: the decision was taken when the module
protected zero users, and it now sits on the branch that deploys. **Whether the
exception still holds is an open question, and it is not a budget-module
question — it belongs to whoever governs the release.**

---

## 12. Decisions register

| # | Decision | Closed |
|---|---|---|
| 1 | Recurrence is rows only. No `recurring` column, no `start_month` | 2026-08-11 |
| 2 | One table, `budget_monthly_allocations`. `budget_policies` and `budget_frequency_types` removed | 2026-08-11 |
| 3 | Rollover does not exist and is explicitly forbidden in V1 | 2026-08-11 |
| 4 | Writes touch the current month only. The server derives the month from the timezone | 2026-08-12 |
| 5 | The first budget is recurrent without asking; no checkbox | 2026-08-12 |
| 6 | The edit checkbox is "Apply to this month only", unchecked by default | 2026-08-12 |
| 7 | `CHECK (budget_amount >= 0)`; the form rejects `0`; only "Remove budget" writes it | 2026-08-12 |
| 8 | Months earlier than the current one are read-only | 2026-08-12 |
| 9 | Future planning is out of V1 | 2026-08-12 |
| 10 | Removing a budget takes effect from the current month, with a warning | 2026-08-12 |
| 11 | `aggregationLevel` is replaced by a month range; aggregation is a fold over the series | 2026-08-12 |
| 12 | 012 is renamed to `012_backfill_budget_allocations.sql` | 2026-08-12 |
| 13 | No feature flag; declared exception | 2026-08-12 |
| 14 | The flag is named `onlyThisMonth`, for the exception. Recurrence is the rule and has no name in the payload | 2026-08-12 |
| 15 | Every commit is gated. No unattended execution: this changes the conceptual model, it is not a refactor. *(Corrected by decision 30: this entry said "the 15 commits"; the sequence is fourteen)* | 2026-08-12 |
| 16 | The frontend reads the legacy column until **commit 9**, which is the A → C migration; system B is rewritten, not deleted (§10.5) | 2026-08-12 |
| 17 | Schema, repository, allocation service and the two account controllers ship as one commit. The read chain is left stale for three commits as a declared, accepted KO | 2026-08-12 |
| 18 | Nothing is deleted for looking unused until the module works end to end. Candidates accumulate in §9.4 and are removed in commit 13 | 2026-08-12 |

Decisions 19–30 close the audit of 2026-08-12, run against the owner's eleven
questions before the gate of commit 2. Two of them correct code that had already
been committed.

| # | Decision | Closed |
|---|---|---|
| 19 | **D-1.** `carried` is the amount **in force** at `M` — the `<= M` resolution of §4.1 — not the last row strictly before `M`. Measured wrong in two ordinary states (§5.1.1). Fixed in commit 1b | 2026-08-12 |
| 20 | **D-2.** `spent` is bucketed on the account owner's calendar, the same one that decides which month a budget belongs to. A new invariant 10 and §4.5. Fixed in commit 2 | 2026-08-12 |
| 21 | `isBudgeted` is the **existence** of a resolved allocation, never `budgetAmount > 0`. Invariant 9, §3.5. The validation rejecting `budgetAmount <= 0` in `budgetVsActualCalculator` is incompatible with it and dies with the file | 2026-08-12 |
| 22 | Full response bodies for all four endpoints are frozen in §7.4 before any of them is implemented. This is what D11 requires and what was missing when the gate was first presented | 2026-08-12 |
| 23 | The current month never travels in a request; a historical range travels as `from`/`to`. This removes `date` from `POST /accounts/status`, not only `aggregationLevel` | 2026-08-12 |
| 24 | `isBudgeted: false` nulls the budget fields but **keeps `actualSpent` a number**. Spending exists without a budget | 2026-08-12 |
| 25 | The exception line on the card is driven by `nextMonthBudget !== budgetAmount`, not by the existence of a row at `M+1`. A redundant terminator correctly renders nothing | 2026-08-12 |
| 26 | The backend folds: `/series` returns months **and** range totals, because §8.3's percentage rule would otherwise be reimplemented by every client | 2026-08-12 |
| 27 | A month of `budgetAmount = 0` counts as budgeted in `budgetedMonthCount`; `averageMonthlySpend` divides by **every** month in the range | 2026-08-12 |
| 28 | `aggregationLevel` and the `subcategory` fix move into commit 2, not commit 4. Neither is left inert: the parameter exists only to feed the resolution commit 2 deletes, and `budgetPolicy` going `null` would turn an inherited empty column into a dead path this plan created | 2026-08-12 |
| 29 | The CSV keeps its `Frequency` column, emitting the constant `monthly`. `Period Start`/`Period End` collapse into `Month` | 2026-08-12 |
| 30 | *"No frontend code calls it"* is withdrawn as a justification anywhere in this document. The sequence is fourteen commits: thirteen numbered plus `1b`; no renumbering, because §9.4, §10 and `PLAN_BUDGET_FRONTEND.md` reference the existing numbers | 2026-08-12 |

Decisions 31–33 close the scoping pass run when the gate for commit 2 was
prepared, and measured against the source rather than against §11's wording.

| # | Decision | Closed |
|---|---|---|
| 31 | The 2 / 4 boundary moves. Commit 2 **rewrites the read path onto the monthly table and emits §7.4**; commit 4 **only retires** the policy routes and adds `PUT /accounts/:id/current`. Pruning the resolution above queries whose tables were dropped in commit 1 repairs nothing, and the alternative would fabricate a `budgetPolicy` object from a table with no policies for two commits | 2026-08-12 |
| 32 | `GET /budget/summary` is retired. `POST /accounts/status` with one id answers the identical question, and §7.4 defines one per-account shape; two routes for one fact are two shapes to keep in step, and the single-account one is the one that drifts. §7.3 listed neither its survival nor its retirement — a hole found while preparing the gate | 2026-08-12 |
| 33 | `budgetController.js`'s decorative `// ====` rules go, all of them, and every handler keeps a visible title as a one-line JSDoc naming the full route. `CLAUDE.md` forbids the rules; it does not forbid the heading, and a file of handlers with no headings is worse than one with ugly ones | 2026-08-12 |
| 34 | Under mixed currencies `totals` nulls **every monetary field**, not only `currency`. §8.3 claimed `makeTotals` already did this; it does not, and the claim came from a wrong description of the existing code in `REMARKS.md` R24 that was copied forward. The claim is deleted, not the rule: a client handed `budgetAmount: 2000700` renders it, and a null label beside it does not stop that | 2026-08-12 |
| 35 | **No monetary field is ever null.** `budgetAmount` and `nextMonthBudget` are `0` when nothing was allocated, `remainingBudget` is `budgetAmount - actualSpent` always, and `isOverBudget` is always a boolean. Overriding decision 24: spending against no budget is being in the red, and `null` reports that as "not applicable". `executionPercentage` remains the single nullable field, because zero has no percentage. `isBudgeted` carries the two empty states of §3.5 by itself | 2026-08-12 |
| 36 | Commits 2 and 4 merge. A commit that rewrites the read path but leaves `/frequencies`, `PUT /policy/:id` and `/history/:id` querying tables commit 1 dropped ships a broken API and calls it one logical change. D8 still holds for the opposite case — a file whose only caller is unwritten frontend waits; a route already broken by a landed migration does not | 2026-08-12 |
| 37 | **`isBudgeted: false` is a state of a month, not of an account.** Account creation writes an allocation unconditionally and the amount is mandatory, so no account this system creates can report it for the current month. §3.5 described an account that "never had a budget", gave it `budgetAmount: null`, and said both empty states render the same — three statements that contradicted §7.4 and the code. §3.5 is rewritten; §7.4 and the code stand unchanged | 2026-08-13 |
| 38 | The field keeps the name `isBudgeted`. Once §3.5 stops describing a state that cannot occur, the name answers its question correctly for both the account status and the month series, and renaming it would move a contract field for no gain | 2026-08-13 |
| 39 | **`isBudgeted` leaves the contract, with `budgetedAccountCount` and `budgetedMonthCount`.** Overriding decisions 21, 27, 37 and 38, and the last clause of 35. The domain has no independent *"not budgeted"* state: the effective budget of an account for a period is what the applicable decision resolves to, and `0` when none applies — the same `0` an explicit decision of zero produces. The distinction survives as rows, or their absence, in `budget_monthly_allocations`, which is where a historical fact belongs; it is not a business state the API carries. The field was also the wrong indicator for its own consumers — an account the backfill skips has no row, so it reported `false` for every month of an account that existed throughout, which is account existence answered by decision existence. Both counters dissolve with it: `budgetedAccountCount` equals `accounts.length`, and `budgetedMonthCount` was a denominator nowhere. Landed as `e1449e0`; the frontend types follow in commit 5. The CSV consequence is deliberate — `/export` stops filtering and answers the whole requested range | 2026-08-13 |

Decisions 40–46 close the month-selector evaluation of 2026-08-14: the budget
screen shows one month and lets the user choose which. Decisions 44–45 extend it
down the drill-down, where the month is shown but not chosen, and 46 gives the
selector the ceiling neither of the existing month fields could provide.

| # | Decision | Closed |
|---|---|---|
| 40 | **`POST /accounts/status` gains an optional `month`.** Decision 23 stands: what never travels is the **default** month, because a client-computed one is the device's clock. A month the user picked is the case `/series` already covers — the server cannot guess which month is on screen. Omitted, `month` is still the current month on the owner's calendar, and the client is still forbidden from deriving it from `new Date()`. §7.3, §7.4 | 2026-08-14 |
| 41 | **The bounds are asymmetric, because only one of them is a rule.** Above: a month later than the current one is 422, matching `/series` — a month that has not happened has no spending, and resolving an allocation for it would be the forecast §13 excludes. Below: no bound. The `<= M` resolution of §4.1 answers any past month, and a month before the first allocation resolves to nothing, which is the empty state. **Rejected: returning the first month with data so the picker could stop there.** Nothing knows a month is empty until it is asked, the app included; precomputing it buys a `MIN` over two tables to move a discovery the mandatory empty state already makes | 2026-08-14 |
| 42 | **The chosen month travels in the URL, as `?month=YYYY-MM`.** Levels 2 and 3 are standalone routes, not children of `BudgetLayout` (`App.tsx:190-203`), so the layout unmounts on drill-down and a month held in a store or in `location.state` dies there. The URL is the only carrier that survives navigation, F5 and a shared link, and this module already carries a live defect from depending on `location.state` | 2026-08-14 |
| 43 | **A new `MonthPicker.tsx`, not a change to `Datepicker.tsx`.** The existing wrapper is a day picker consumed by every form; widening it to months to serve one screen changes all of them. The unit of this module is the month, and a control that accepts a day promises a precision the model does not have. Same library, month mode — no new dependency. The badge is a new class: `.month-badge` is documented as having no interactive states, and a trigger owes default, `:hover`, `:focus-visible`, `:active` and `:disabled` | 2026-08-14 |
| 44 | **The month is shown at every level of the drill-down and chosen only at the first.** Levels 2 and 3 render it as a read-only badge. At level 3 a picker would be a second way to ask the question `/series` already answers for that account, and in one month at a time — the duplication decision 32 removed when it retired `/summary`. The month is the scope of the board, and the scope is set where the whole board is visible. Consequence for the UI: the level-1 badge needs an affordance the other two do not carry, or the read-only ones invite a click | 2026-08-15 |
| 45 | **In the account detail the period stays the calendar month, and the balance dates are those of the movements.** `.period-info` renders the month's bounds, because the budget and its execution percentage are monthly and a label showing the span of activity would claim the figures cover only that span. The dates beside the initial and final balance are those of the **first and last transaction of the month** — not the first and last non-zero balance, which is undefined for a month with no movements and is truncated by a balance that legitimately reaches zero mid-month. A month with no movements carries the last balance known before it, with its real date; today that branch returns `account_starting_amount` stamped with the requested window's bounds, which prints a zero on a date nothing happened | 2026-08-15 |
| 46 | **The response states the current month, in `meta.currentMonth`.** The selector needs a ceiling and neither existing value gives one: `referenceMonth` is the month being *reported*, equal to the current month only on a request that named none, and the browser's clock is what decision 23 forbids. Placed in `meta` and not beside `referenceMonth` because it is a fact *about* the answer rather than part of it — the answer's subject is the month it reports. Free in both branches: a named month already queried it for the 422 of §7.3, an omitted one resolves to it by definition. **Rejected: exposing it on `/series` too.** Its default `to` already is the current month, so a second statement of the same fact is a second place for it to drift. §7.4 | 2026-08-15 |

Decision 47 closes the note audit of 2026-08-17, run while the level-3 row commit
was gated. Its presentation half is `PLAN_BUDGET_FRONTEND.md §10.14.7`.

| # | Decision | Closed |
|---|---|---|
| 48 | **The write carries a range — `{ amount, month, appliesUntil }` — and neither bound is defaulted.** `onlyThisMonth` could only say *this month* or *forever*, and the third thing a user means — *until December* — had no way to be said, so the flag was replaced rather than extended. Neither bound gets a default because the two possible defaults fail in opposite directions and both fail silently: `'openEnded'` deletes every decision after `month`, and `appliesUntil = month` expires an amount the user meant to keep. Month *allowedness* — later than today, earlier than the account, end before start — is a **422 raised by the service**, not by the schema: each is a relationship with a row or with the owner's calendar, and a schema sees neither. `MONTH_PATTERN` is shared by both bounds so the two forms cannot drift. §5.1.0, §7.4. `d21e669` | 2026-08-18 |
| 47 | **`user_accounts.note` becomes `account_note`, and both note fields cap at 90.** The account note describes an account for its whole life; the transaction note describes one movement and has no column at all — it lives inside `description`. One name for both, and one symbol named `noteSchema` in two modules, is what made three unrelated caps — 90, 150 and 155 — read as one broken field. Labels and payloads rename now; the column rename, the `VARCHAR(155)` → `VARCHAR(90)` narrowing at `002_accounts.sql:103` and `:201`, and dropping the duplicated `pocket_saving_accounts.note` all travel with commits 11–13. **Not a corrective migration**: no row in either environment exceeds 90, because the inputs have always capped there, so the width is edited in the file that creates the column and Supabase receives the chain already correct (D6). R64 | 2026-08-17 |
| 49 | **The account status row carries `accountStartDate`.** Not a figure and never rendered: it answers whether the account existed on the day a movement is being dated, which no other selector source in the application could answer, and which back-dating turned into a live question — an expense dated back still offered every category, and the server refused the entry the form had just invited. Shipped raw and nullable, in the same shape the nine account list queries already use, so one client-side predicate serves both payloads instead of two behaviours. A null reads as open, because the server validates the window independently and hiding a row on missing data would empty a list on a contract change rather than fail where it can be seen. Free — `ACCOUNTS_QUERY` already selects from `user_accounts`. **Rejected: a second request or a second endpoint.** Four screens read this payload; a per-screen lookup would be four round trips for one field. Landed `2b4d3dc`; the rule it serves is `PLAN_BACKDATING` §3.3.3 | 2026-08-30 |

---

## 13. Deliberate limitations and the V2 boundary

What V1 cannot express, and what it would cost:

| Limitation | What it would take |
|---|---|
| Authoring a future month | A month picker, and the `DELETE budget_month > M` in §5.1 becomes conditional. **This is the single line that guards the boundary** — and the moment it becomes conditional, step 5's `INSERT` has to become an `UPSERT`, because `M+1` is no longer guaranteed empty |
| Editing a month earlier than the current one | A month picker plus a scope preview showing which months a write affects. Structurally possible; rejected because it would change an established historical budget fact |
| Scheduling the end of a budget in advance | Same as authoring a future month |
| Non-monthly periods | Would reintroduce everything §9.1 removes. Out of scope permanently, not just in V1 |
| Rollover | Violates §0. Would require a second concept — a balance — that the model does not have |
| Proration | Violates invariant 3 |
| FX conversion in totals | Requires a rate source and an as-of date. `MIXED_CURRENCY_NOTICE` is the honest answer until then |

R36's corrected formula stays recorded in `REMARKS.md` for a future V2 that
reintroduces frequencies. V1 does not need it.

---

## Corrections of 2026-08-30 — measurements only

Assertions about the code that had stopped being true, corrected in place. **No decision
of §12 was closed, deleted or reworded; no work unit of §11 was reordered; §13's
boundaries are untouched.**

| § | what was asserted | what the code says today |
|---|---|---|
| 4.5 | `transaction_actual_date` is declared at `createTables.js:134`; `SPENT_QUERY` at `budgetTransactionRepository.js:169-170` | `createTables.js:173`; the query is at `:187` and its two fixed bounds at `:199-200` |
| 9.2 | `makeTotals` is module-private at `:283` | `budgetCalculationService.js:331` |
| 9.4 | the `calculateBudgetMetrics` inventory is `getAccountController.js:43, :196, :759`, `getAccountDataById.js:59`, `dashboardController.js:185-186,347` | same five consumers, at `getAccountController.js:56, :217, :846`, `getAccountDataById.js:59`, `dashboardController.js:194-195, :356` |
| 10.5 | the dashboard's remaining figure subtracts `SUM(ua.account_balance)`, a column `transactionController.js:138` updates on every transaction | the query is at `dashboardController.js:356` and subtracts `SUM(${DERIVED_BALANCE})`, the ledger derivation; the writer at `:138` is gone (`be6ebbf`), `accountManagement/updateAccountBalance.js` is deleted in the working tree, and the column is now written by `accountManagement/setAccountBalanceFromLedger.js`. **The defect the paragraph names survives the correction** — a lifetime balance is still not a month's spend |
| 11 Phase 4 | item 12's readers are `getAccountController.js:41` and `dashboardController.js:185-186,347` | `:56` and `:194-195, 356` |
| 11 feature flag | `BudgetEditModal` is mounted at `EditAccount.tsx:629`, `CategoryDetail.tsx:466`, `CategoryAccountList.tsx:320` | the same three consumers, at `:674`, `:518` and `:312` |

**Verified and left alone**, because they are still true: the tree of
`feat/vercel-serverless` is identical to `main` (`git diff` empty); `budgetRoutes` is
mounted unconditionally at `routes/index.js:24`; `USE_NEW_BUDGET_SYSTEM` exists nowhere in
`backend/src` or `frontend/src`; `BudgetAccountStatus` is at `budgetTypes.ts:82` and now
carries `accountStartDate` at `:98`, which is decision 49 shipped.
