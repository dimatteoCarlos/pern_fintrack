# COMPLETED — Database infrastructure and migrations

> ## ✅ COMPLETED — closed 2026-08-13
>
> Migrations `010`–`013` exist, are constrained and were backfilled. **Nothing
> here is pending work.**
>
> | what was left over | where it lives now |
> |---|---|
> | The Supabase production file, and the schema-drift audit that gates it | `on-hold/PLAN_DEPLOYMENT/PLAN_SUPABASE_MIGRATION.md` |
> | The three-table budget schema this document describes | Deleted by V1. See `DECISIONS.md` §1 |
>
> **Read the superseded notice below before trusting any budget-table detail:**
> `010` was rewritten in place and `012` renamed, so the tables named in the
> original text no longer exist.

**Status:** Delivered. Verified against `backend/src/db` on `feat/budget`, 2026-08-10.
**Audit date:** 2026-07-28 · **Closed:** 2026-08-10

> ⛔ **Superseded for the budget tables, 2026-08-12.** `budget_policies`,
> `budget_policy_allocations` and `budget_frequency_types` no longer exist:
> migration `010` was **rewritten in place** to create one table,
> `budget_monthly_allocations`, and `012` was renamed to
> `012_backfill_budget_allocations.sql`. Rewriting rather than adding a repair
> migration is D6, and it is safe only because Supabase has never run this
> chain — see `PLAN_BUDGET_V1.md` §10.1. Everything in this document about
> `011`, `013`, currency constraints and the infrastructure work stands
> unchanged.

---

## 1. Outcome

The three budget tables exist, are constrained, are seeded and were backfilled
from the legacy column. The Budget module reads real rows.

| Migration | Purpose |
|---|---|
| `010_create_budget_tables.sql` | The three tables, indices, constraints, catalog seed, `setval`, backfill, explicit `-- DOWN` |
| `011_enforce_category_budget_currency.sql` | `category_budget_accounts.currency_id` constraint |
| `012_backfill_budget_policies.sql` | Second backfill pass, `valid_from` at the start of the month |
| `013_normalize_category_budget_name_case.sql` | Category names stored lowercase |

The `xlsx` dependency was not moved (step B5): the XLSX export branch was
deleted instead and CSV is the only export format, so the dependency is gone
from both `package.json` files. `budgetController.js:281` records why.

---

## 2. The decision this plan closed — zero is not a budget

Three layers disagreed about `budget = 0`. The frontend rejected it, the backend
manufactured it (`budget ? parseFloat(budget) : 0.0` is falsy-based, so an
omitted budget was written as `0.0`), and the database had no constraint at all.

**Resolved: `budget > 0` is the invariant, enforced in all three layers.**

- `CHECK (budget_amount > 0)` on `budget_policy_allocations`
- The backfill takes `WHERE budget IS NOT NULL AND budget > 0` only
- An account with no policy means "not budgeted", not "budgeted at zero"

An account whose execution percentage would divide by zero cannot exist.

**Learning topic:** an invariant enforced only in the UI is not enforced. The
browser is the easiest layer to bypass. Business rules belong in the domain and
are mirrored outward for user experience, never the reverse.

---

## 3. The design corrections that shipped

| # | Correction | Why it mattered |
|---|---|---|
| 1 | Backfill `budget > 0` only; no `COALESCE(cba.budget, 0)` | The `CHECK` made the original insert unsatisfiable — the migration would have aborted |
| 2 | UNIQUE partial index on active allocations (`uq_budget_allocation_active`) | Without it SCD Type 2 is a convention, not a guarantee. Two active rows would silently double-count budgets with no error raised |
| 3 | `budget_frequency_type_id` removed from `budget_policies` | It sat on two tables with nothing keeping them consistent. Changing frequency **is** a budget change and belongs in the versioned row |
| 4 | `DECIMAL(15,2)`, matching the legacy column | Narrowing precision in a multi-currency app is an avoidable risk |
| 5 | `setval` after the seed | Explicit ids do not advance a `SERIAL`. Generalised later by `a63ac80`, which realigns every catalog sequence at boot |
| 7 | Explicit `-- DOWN` block | `CLAUDE.md` requires reversible migrations. `010` established the pattern; no earlier migration has one |
| 9 | No `ensureBudgetTables()` in the original shape | It would have created a third copy of the schema |

**Learning topic — SCD Type 2.** History is kept by closing the current row
(`valid_until = now()`) and opening a new one instead of overwriting. The design
"`valid_until IS NULL` means active" is only sound if the database enforces at
most one open row per policy. Without the unique partial index it is a naming
convention that the first concurrent update violates — and the failure is silent
double-counting, not an error.

---

## 4. Infrastructure debt this plan documented and did not fix

These predate the budget work and are still true.

| # | Debt | Where it is tracked now |
|---|---|---|
| 4.1 | Three sources of schema truth: the SQL migrations, `mainTables` in `createTables.js`, and `initDatabase.js`. All use `IF NOT EXISTS`, so drift no-ops silently | `REMARKS R13` — 37 divergences measured |
| 4.2 | Migration atomicity is illusory: `001`–`007` carry their own `BEGIN`/`COMMIT`, which closes the runner's transaction early. If migration N+1 fails, N is already committed | Open, unowned. Repairing it while adding migrations was rejected as two risky changes at once |
| 4.3 | `category_budget_accounts.budget` is still written and still read | `PLAN_F` task 8 — the inventory, which the developer scheduled last |

`ensureBudgetPolicyBackfill` in the boot path runs **outside a transaction**.
Recorded here because it belongs to this plan's surface; it has no owner yet.

---

## 5. Target schema, as built

### `budget_frequency_types`

Catalog of the five codes: `monthly`, `quarterly`, `four-month`, `semiannual`,
`yearly`. They must match `MONTHS_PER_PERIOD` in
`budget_services/core/budgetConfig.js` exactly — any divergence breaks period
resolution.

### `budget_policies`

One row per account, `UNIQUE (account_id)`, FK to
`category_budget_accounts(account_id)` `ON DELETE CASCADE`. Frequency
deliberately absent.

### `budget_policy_allocations` (SCD Type 2)

`budget_amount DECIMAL(15,2)`, `budget_frequency_type_id`, `valid_from`,
`valid_until`.

| Constraint | Role |
|---|---|
| `CHECK (budget_amount > 0)` | §2 |
| `CHECK (valid_until IS NULL OR valid_until >= valid_from)` | Admits `valid_until = valid_from`: a correction closes the replaced version to zero span. See `010:41` |
| `uq_budget_allocation_active` UNIQUE partial `WHERE valid_until IS NULL` | Makes SCD Type 2 real |

The `ON DELETE CASCADE` / `ON DELETE RESTRICT` asymmetry is intentional:
deleting an account removes its budget history; deleting a catalog frequency must
be refused while history references it.

---

## 6. Verification queries

Kept because they are the regression suite for any future schema change. Run
them after `db:reset` and before any Supabase application.

```sql
-- 1. The three tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'budget%';

-- 2. Every account with a positive budget has a policy — must be 0
SELECT COUNT(*) FROM category_budget_accounts cba
LEFT JOIN budget_policies bp ON bp.account_id = cba.account_id
WHERE cba.budget > 0 AND bp.budget_policy_id IS NULL;

-- 3. Every policy has exactly one active allocation — must return 0 rows
SELECT bp.budget_policy_id, COUNT(ba.budget_allocation_id) AS active_count
FROM budget_policies bp
LEFT JOIN budget_policy_allocations ba
  ON ba.budget_policy_id = bp.budget_policy_id AND ba.valid_until IS NULL
GROUP BY bp.budget_policy_id
HAVING COUNT(ba.budget_allocation_id) <> 1;

-- 4. No allocation violates the positive-amount rule — must return 0 rows
SELECT * FROM budget_policy_allocations WHERE budget_amount <= 0;

-- 5. Catalog codes match budgetConfig.MONTHS_PER_PERIOD
SELECT budget_frequency_code FROM budget_frequency_types ORDER BY sort_order;
-- Expect: monthly, quarterly, four-month, semiannual, yearly
```

Query 5 of the original set — legacy amounts round-trip — is retired. `valid_from`
now snaps to the start of the month (`d9d678e`) and allocations version by
intent, so an active allocation is no longer expected to equal the legacy column.

---

## 7. Rollback

The `-- DOWN` block in `010` drops the index, the three tables, and its own row
from the `migrations` control table. That last `DELETE` is essential: without it
the runner treats the migration as applied and skips it on re-run.

`010` is purely additive — it never modifies `category_budget_accounts` — so both
the migration and its reversal leave the legacy read path untouched.

**Untested:** the `DOWN` block of `010` has never been executed. It is written,
not proven.

---

## 8. The migration-chain rule that governs any future fix

Corrections are edited **inside the original migration**, never added as a
repairing migration. This is safe because `runMigrations.js` registers file names
without a checksum (`:41`, `:47`, `:71`): editing an applied file neither
re-executes it nor breaks boot. Proving a change requires `db:reset`.

The rule exists because Supabase has not been touched yet, and the chain that
lands there must be the clean one — not a sequence where a later migration
repairs an earlier one.
