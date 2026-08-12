-- 010_create_budget_tables.sql
--
-- Budget domain: one monthly allocation per user decision.
--
-- A row is in force from its month onwards until a later row replaces it, so
-- "this budget recurs" is already encoded as "no later row terminates it".
-- Storing that as a column would create a second source of truth for one fact,
-- and the two can disagree. See PLAN_BUDGET_V1 §3.3.
--
-- Purely additive: category_budget_accounts is never modified. The legacy
-- `budget` column stays in place and keeps serving the frontend until the
-- module's read path is migrated.
--
-- No BEGIN/COMMIT here: runMigrations.js wraps every file in one transaction
-- together with its INSERT INTO migrations. A COMMIT inside the file closes
-- that transaction early, leaving the bookkeeping row and every later migration
-- outside it. Same convention as 011.

-- UP

-- budget_month is a DATE pinned to the first of the month rather than a
-- (year, month) pair: `<=` and generate_series then work natively, and ordering
-- needs no composite comparison.
--
-- CHECK (budget_amount >= 0) rather than > 0. Under carry-forward an absent row
-- terminates nothing — the previous row keeps governing — so the only way to
-- express "no budget from month M" is a positive marker, and zero is the only
-- one available. It means "the decision not to budget", not "a budget of zero".
-- The form still rejects 0; only the explicit remove action writes it (§3.4).
--
-- EXTRACT(DAY ...) = 1 rather than date_trunc: date_trunc(text, timestamptz) is
-- stable, not immutable, so it cannot appear in a CHECK, and the date overload
-- reaches the immutable version only through an implicit cast.
--
-- No currency column: it is inherited from category_budget_accounts.currency_id,
-- which migration 011 already makes NOT NULL. A copy here can drift.
--
-- No extra index: uq_budget_allocation_month is the index the resolution needs,
-- and Postgres walks its btree backwards for ORDER BY budget_month DESC LIMIT 1.
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

-- DOWN
-- Run manually. Safe because the migration is purely additive: dropping the
-- table restores the exact pre-010 state, and the legacy cba.budget column it
-- was backfilled from is still there. The final DELETE lets db:migrate re-apply
-- the file afterwards.
--
-- BEGIN;
-- DROP TABLE IF EXISTS budget_monthly_allocations CASCADE;
-- DELETE FROM migrations WHERE filename = '010_create_budget_tables.sql';
-- COMMIT;
