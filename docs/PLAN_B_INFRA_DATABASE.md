# PLAN B — Infrastructure & Database

**Status:** Design frozen, execution not started
**Branch:** `feat/budget`
**Depends on:** nothing technically; run after Plan A by preference
**Blocks:** all of Plan C
**Audit date:** 2026-07-28

---

## 1. Objective

Create the database structures the Budget domain model already assumes: `budget_frequency_types`, `budget_policies`, and `budget_policy_allocations` (SCD Type 2), and backfill them from the legacy `category_budget_accounts.budget` column.

**Why this blocks everything:** `budgetTransactionRepository.js:86-87` queries `budget_policies` and `budget_policy_allocations`. Neither exists in any of the nine migrations (`grep -rn "budget_polic" sql_migrations/` → no matches). Until they do, no amount of application-layer repair makes the Budget module return data.

---

## 2. Resolved design decision — the zero-budget rule

This was the open question blocking the schema. **It is now closed: zero is not a budget.**

The evidence came from the frontend. Both `numberSchema` definitions reject any value `<= 0`:

- `frontend/src/fintrack/validations/zod_schemas/commonSchemas.ts:27-34` (creation path)
- `frontend/src/fintrack/editionAndDeletion/validations_zod/commonEditionSchemas.ts:141-148` (edition path)

Both push `ERROR_MESSAGES.POSITIVE_NUMBER_REQUIRED` and return `z.NEVER`. Through the UI, a `category_budget` account can never be created or edited to hold a zero budget. `budget > 0` is already the product's real invariant — it was simply never written down or enforced below the browser.

The other two layers disagree, which is the defect:

| Layer | Rule for `budget = 0` | Location |
|---|---|---|
| Frontend | **Rejected** | `commonSchemas.ts:27`, `commonEditionSchemas.ts:141` |
| Backend | **Accepted, and produced by default** | `accountCategoryCreationcontroller.js:71-77` |
| Database | **No constraint at all** (nullable, no CHECK) | `002_accounts.sql:117` |

The backend is the worst of the three. It rejects only negatives, and the coercion `budget ? parseFloat(budget) : 0.0` is falsy-based, so an omitted or empty budget is silently written as `0.0`. It does not merely permit the state the frontend forbids — it manufactures it.

### Consequences for the schema

1. Keep `CHECK (budget_amount > 0)` on `budget_policy_allocations`.
2. Backfill **only** `WHERE budget IS NOT NULL AND budget > 0`. The `COALESCE(cba.budget, 0)` from the original `011` draft is deleted.
3. An account with no policy means "not budgeted". The summary endpoint reports it as such, rather than as a zero-budget account whose execution percentage would divide by zero.
4. This aligns the database `CHECK` with the existing guard at `budgetVsActualCalculator.js:39` (`budgetAmount <= 0` throws) **and** with the frontend. Three layers, one rule.

### Consequence for verification

The original verification query #2 — "every account has a policy, must return 0" — asserted the wrong invariant and is unsatisfiable alongside the `CHECK`. Corrected assertion: *every account with `budget > 0` has exactly one active allocation.*

**Learning topic:** an invariant enforced only in the UI is not enforced. The browser is the easiest layer in the system to bypass — Insomnia, a mobile client, or a stale cached bundle all write directly to the API. Business rules belong in the domain and are mirrored outward for user experience, never the reverse.

---

## 3. Corrections applied to the original migration plan

The plan reviewed on 2026-07-28 was sound in naming, foreign-key targets, and test discipline. Nine corrections were identified. All are folded into the specification below.

| # | Correction | Reason |
|---|---|---|
| 1 | Drop `COALESCE(cba.budget, 0)`; backfill `budget > 0` only | `CHECK (budget_amount > 0)` made the original insert unsatisfiable — migration `011` would have aborted. Independently, `budgetVsActualCalculator.js:39` throws on `<= 0`. |
| 2 | Add **UNIQUE** partial index on active allocations | Without it, SCD Type 2 is a convention, not a guarantee. Two active rows would make `getBudgetDataForAccounts` return duplicate rows per account, silently double-counting budgets in Overview totals with no error raised. |
| 3 | Remove `budget_frequency_type_id` from `budget_policies` | It was on both tables with nothing keeping them consistent. `budgetTransactionRepository.js:73` reads the allocation's copy; the policy's is never read. Changing frequency *is* a budget change and belongs in the versioned row. |
| 4 | `DECIMAL(12,2)` → `DECIMAL(15,2)` | Matches legacy `category_budget_accounts.budget` (`002_accounts.sql:117`). Narrowing precision in a multi-currency app handling VES is an avoidable risk. |
| 5 | Add `setval` after the seed | Explicit IDs do not advance a `SERIAL` sequence. The first insert omitting the ID would fail with a duplicate primary key. |
| 6 | Merge `011` into `010` | `011`'s backfill was a strict superset of `010`'s `DO` block. One migration means one control-table entry and no half-applied window. |
| 7 | Add explicit `-- DOWN` block | `CLAUDE.md` requires reversible migrations with UP and DOWN. No existing migration has one; this establishes the pattern. |
| 8 | Correct two file paths | Plan referenced `backend/src/db/createTables.js` and `backend/src/db/run_time_migrations/populateDB.js`. Actual: `backend/src/db/run_time_db_init/createTables.js` and `.../run_time_db_init/populateDB.js`. There is no `run_time_migrations/` directory. |
| 9 | Drop `ensureBudgetTables()` (original Commit 4) | It would have made a **third** copy of the schema. See §4. |

---

## 4. Pre-existing infrastructure debt

Context for why the plan is shaped as it is. These are not introduced by this phase.

### 4.1 Three sources of schema truth

The same `CREATE TABLE` statements exist in:

1. `db/migrations/sql_migrations/*.sql` — the versioned migrations
2. `mainTables` in `db/run_time_db_init/createTables.js` — runtime bootstrap
3. `db/run_time_db_init/initDatabase.js` — startup path

All use `IF NOT EXISTS`, so when they drift they no-op silently against an existing table and nothing reports the divergence. The original plan would have added a fourth copy via `ensureBudgetTables()`.

**Decision:** `010` is the source of truth for existing databases; `createTables.js` remains for fresh bootstrap; `initDatabase.js` **verifies only** (via the existing `tableExists` helper) and logs a warning if migrations are pending. It does not create budget tables.

**Learning topic:** a startup path that creates schema is a second, unversioned migration system competing with the real one. Once you have a `migrations` control table, every other creation path is drift waiting to happen.

### 4.2 Migration atomicity is illusory

`runMigrations.js:35-78` wraps all migrations in a single transaction. But migrations `001`–`007` each contain their own `BEGIN; … COMMIT;`. The inner `COMMIT` closes the runner's transaction early; subsequent statements run in autocommit and the final `COMMIT` warns "no transaction in progress".

**Practical effect:** if migration N+1 fails, migration N is already committed and the runner's `ROLLBACK` cannot undo it.

**Decision for this phase:** follow the existing convention (keep `BEGIN`/`COMMIT` in the file) for consistency, but do **not** rely on cross-file atomicity. This is the main reason correction #6 merges `011` into `010` — a single file is atomic within itself. Repairing the runner is logged as future work, deliberately out of scope: changing transaction handling for all nine migrations while also adding a tenth is two risky changes at once.

### 4.3 Legacy budget model

`category_budget_accounts.budget DECIMAL(15,2)` — one nullable amount per account. No frequency, no history, no period semantics. This column is **not dropped** by this phase. It remains the legacy read path until Plan C's feature flag has run enabled by default and parity is confirmed.

### 4.4 Frequency is stored but never read

`calculateBudgetVsActual` receives `frequencyCode` as a string from the HTTP query (`budgetController.js:30`), never from the database. There is no `id → code` translation anywhere in the read path. A stored frequency would currently be ignored in favour of whatever the client sends.

This does not block the migration, but it means the catalog would initially be data nothing consumes. `010` therefore prepares for the fix (see step B4) and Plan C closes it.

---

## 5. Target schema

### `budget_frequency_types` (catalog)

| Column | Type | Notes |
|---|---|---|
| `budget_frequency_type_id` | `SERIAL PRIMARY KEY` | |
| `budget_frequency_code` | `VARCHAR(20) NOT NULL UNIQUE` | `monthly`, `quarterly`, `four-month`, `semiannual`, `yearly` |
| `budget_frequency_name` | `VARCHAR(50) NOT NULL` | Display label |
| `sort_order` | `INTEGER NOT NULL DEFAULT 0` | UI ordering |
| `is_active` | `BOOLEAN NOT NULL DEFAULT TRUE` | Retire a frequency without orphaning history |
| `created_at` / `updated_at` | `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP` | |

Codes must match `MONTHS_PER_PERIOD` in `budget_services/core/budgetConfig.js` exactly. Any divergence breaks `getNumberOfPeriods`.

### `budget_policies`

| Column | Type | Notes |
|---|---|---|
| `budget_policy_id` | `SERIAL PRIMARY KEY` | |
| `account_id` | `INTEGER NOT NULL` | FK → `category_budget_accounts(account_id)` `ON DELETE CASCADE` |
| `created_at` / `updated_at` | `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP` | |

Constraint: `UNIQUE (account_id)` — one policy per account.

Frequency deliberately **absent** (correction #3).

The FK target is correct: `category_budget_accounts.account_id` is that table's primary key (`002_accounts.sql:118`) and matches the join in `budgetTransactionRepository.js:88`.

### `budget_policy_allocations` (SCD Type 2)

| Column | Type | Notes |
|---|---|---|
| `budget_allocation_id` | `SERIAL PRIMARY KEY` | |
| `budget_policy_id` | `INTEGER NOT NULL` | FK → `budget_policies` `ON DELETE CASCADE` |
| `budget_amount` | `DECIMAL(15,2) NOT NULL` | `CHECK (> 0)` |
| `budget_frequency_type_id` | `INTEGER NOT NULL` | FK → `budget_frequency_types` `ON DELETE RESTRICT` |
| `valid_from` | `TIMESTAMPTZ NOT NULL` | |
| `valid_until` | `TIMESTAMPTZ` | `NULL` = active version |
| `created_at` | `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP` | |

Constraints:

- `CHECK (budget_amount > 0)`
- `CHECK (valid_until IS NULL OR valid_until > valid_from)`
- **`CREATE UNIQUE INDEX ... ON (budget_policy_id) WHERE valid_until IS NULL`** — the constraint that makes SCD Type 2 real

The `ON DELETE CASCADE` / `ON DELETE RESTRICT` asymmetry is intentional and correct: deleting an account should remove its budget history; deleting a frequency from the catalog must not be allowed while history references it.

**Learning topic — SCD Type 2.** Slowly Changing Dimension Type 2 keeps history by closing the current row (`valid_until = now()`) and opening a new one, rather than overwriting. The design intent "`valid_until IS NULL` means active, no redundant flag" is only sound if the database *enforces* at most one open row per policy. Without the unique partial index it is a naming convention that the first concurrent update will violate — and the failure is silent double-counting, not an error.

### Indices

| Index | Purpose |
|---|---|
| `idx_budget_policies_account_id` | Lookup by account |
| `idx_budget_policy_allocations_policy_id` | Fetch a policy's versions |
| `uq_budget_allocation_active` (UNIQUE, partial) | Enforce + accelerate active-row lookup |

`idx_budget_policies_frequency_type_id` from the original plan is dropped along with the column.

---

## 6. Execution steps

### B0 — Preparation

1. Confirm branch `feat/budget`.
2. `pg_dump` the local database.
3. **Audit the legacy data before migrating:**

```sql
-- How many accounts will the backfill skip?
SELECT
 COUNT(*) FILTER (WHERE budget IS NULL)  AS null_budget,
 COUNT(*) FILTER (WHERE budget = 0)      AS zero_budget,
 COUNT(*) FILTER (WHERE budget < 0)      AS negative_budget,
 COUNT(*) FILTER (WHERE budget > 0)      AS will_migrate,
 COUNT(*)                                AS total
FROM category_budget_accounts;
```

These are rows the UI cannot produce but the backend may have written (see §2). They will be skipped, which is correct — but review them first and confirm none is a real account the user expects to see budgeted. **Record the output in the commit message.**

### B1 — Write `010_create_budget_tables.sql`

Single migration: three tables, indices (including the unique partial index), constraints, catalog seed, `setval`, and the `budget > 0` backfill. Explicit `-- DOWN` block at the foot.

### B2 — Update `run_time_db_init/createTables.js`

Add the three tables to `mainTables` and add `addBudgetConstraints()` (indices and CHECKs), invoked from `createTables()`. Note the corrected path (§3, #8).

### B3 — Update `run_time_db_init/populateDB.js` and `initDatabase.js`

Add `tblBudgetFrequencyTypes()` following the existing `tblMovementTypes` pattern, including the `setval` call. `initDatabase.js` **verifies only** — no `ensureBudgetTables()` (§4.1).

### B4 — Expose the frequency code to the read path

Add `bft.budget_frequency_code` to the `SELECT` in `getBudgetDataForAccounts`, joining `budget_frequency_types`. The repository returns it; Plan C makes the service consume it. Without this the catalog is inert (§4.4).

### B5 — Move `xlsx` to `backend/package.json`

Currently declared in the **root** `package.json`. Node's directory walk resolves it locally, but `backend/` deploys to Vercel on its own and the dependency will be absent.

Note: `xlsx@0.18.5` from the npm registry has known advisories (prototype pollution, ReDoS) with no fixed release on npm. Evaluate whether XLSX export is required for the first iteration — CSV alone removes the dependency entirely. **Decision required before B5 runs.**

### B6 — Verify locally, then Supabase

Run the queries in §7 against local. Only when all pass, apply to Supabase and re-run them there.

---

## 7. Verification queries

```sql
-- 1. Tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'budget%';
-- Expect exactly 3 rows

-- 2. CORRECTED: every account WITH A POSITIVE BUDGET has a policy
SELECT COUNT(*) FROM category_budget_accounts cba
LEFT JOIN budget_policies bp ON bp.account_id = cba.account_id
WHERE cba.budget > 0 AND bp.budget_policy_id IS NULL;
-- Must be 0

-- 3. Every policy has exactly one ACTIVE allocation
SELECT bp.budget_policy_id, COUNT(ba.budget_allocation_id) AS active_count
FROM budget_policies bp
LEFT JOIN budget_policy_allocations ba
  ON ba.budget_policy_id = bp.budget_policy_id AND ba.valid_until IS NULL
GROUP BY bp.budget_policy_id
HAVING COUNT(ba.budget_allocation_id) <> 1;
-- Must return 0 rows

-- 4. No allocation violates the positive-amount rule
SELECT * FROM budget_policy_allocations WHERE budget_amount <= 0;
-- Must return 0 rows (the CHECK guarantees it; this confirms the CHECK is present)

-- 5. Amounts round-trip from legacy
SELECT cba.account_id, cba.budget AS legacy, ba.budget_amount AS migrated
FROM category_budget_accounts cba
JOIN budget_policies bp ON bp.account_id = cba.account_id
JOIN budget_policy_allocations ba
  ON ba.budget_policy_id = bp.budget_policy_id AND ba.valid_until IS NULL
WHERE cba.budget <> ba.budget_amount;
-- Must return 0 rows

-- 6. Sequence is correctly positioned
SELECT last_value FROM budget_frequency_types_budget_frequency_type_id_seq;
-- Must be 5

-- 7. Catalog codes match budgetConfig.MONTHS_PER_PERIOD
SELECT budget_frequency_code FROM budget_frequency_types ORDER BY sort_order;
-- Expect: monthly, quarterly, four-month, semiannual, yearly
```

---

## 8. Rollback

The `-- DOWN` block in `010`:

```sql
DROP INDEX IF EXISTS uq_budget_allocation_active;
DROP TABLE IF EXISTS budget_policy_allocations CASCADE;
DROP TABLE IF EXISTS budget_policies CASCADE;
DROP TABLE IF EXISTS budget_frequency_types CASCADE;
DELETE FROM migrations WHERE filename = '010_create_budget_tables.sql';
```

Safe because `010` is purely additive — it never modifies `category_budget_accounts`, so the legacy read path is untouched by both the migration and its reversal. The final `DELETE` is essential: without it the runner treats the migration as applied and will skip it on re-run.

---

## 9. Commit plan

| # | Message |
|---|---|
| 1 | `feat(db): add budget policy tables with SCD Type 2 allocations and backfill` |
| 2 | `feat(db): add budget table definitions and constraints to createTables` |
| 3 | `feat(db): add budget_frequency_types seed to populateDB` |
| 4 | `feat(db): expose budget frequency code in budget data repository query` |
| 5 | `chore(deps): move xlsx dependency from root to backend package` |
| 6 | `docs(db): document budget migration 010, backfill and verification` |

---

## 10. Exit criteria

- All seven verification queries pass locally **and** on Supabase.
- `budget_policies` and `budget_policy_allocations` are populated from legacy data with zero amount mismatches.
- The pre-migration audit counts are recorded.
- The legacy `category_budget_accounts.budget` column is untouched and the existing Budget page still renders exactly as before — this phase adds structures, it changes no behaviour.
- Rollback has been executed once against a scratch database and verified to restore the prior state.

---

## 11. Deferred to future work

- Repairing `BEGIN`/`COMMIT` nesting across migrations `001`–`007` (§4.2).
- Consolidating the three schema definition sites into one (§4.1).
- Dropping `category_budget_accounts.budget` — only after Plan C's flag defaults to enabled and parity is confirmed.
