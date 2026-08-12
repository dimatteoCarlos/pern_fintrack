-- 012_backfill_budget_allocations.sql
--
-- Backfills the first monthly allocation of every budgeted account from the
-- legacy category_budget_accounts.budget column.
--
-- Migration 010 could carry this, but a backfill only ever reaches databases
-- built by the migration runner. Production is built by the runtime path
-- (initDatabase.js -> ensureBudgetTables), which creates the table and never
-- backfills: there, an account with budget > 0 would stay invisible to the read
-- path. This file and its runtime twin, ensureBudgetAllocationBackfill, close
-- that gap together — §10.3 requires both build paths to change in one commit.
--
-- Idempotent by construction: ON CONFLICT DO NOTHING. On a database where the
-- rows already exist it changes nothing.
--
-- The backfilled row is recurrent by definition — nothing terminates it — which
-- is the correct reading of a legacy cba.budget: a standing monthly amount.
--
-- No BEGIN/COMMIT: runMigrations.js wraps every file in one transaction
-- together with its INSERT INTO migrations. Same convention as 010 and 011.

-- UP

-- budget > 0 only. Zero is not a legacy budget: the old frontend rejected it,
-- and a zero row here would read as "the user decided to stop budgeting" (§3.5)
-- rather than "never budgeted".
--
-- The month is the account owner's, not the server's: a boundary resolved in
-- any other zone lands in the previous month when the owner reads it back.
--
-- `ts AT TIME ZONE tz` already yields a TIMESTAMP WITHOUT TIME ZONE on the
-- owner's calendar, so date_trunc and the ::date cast operate on local time and
-- nothing else is needed. Converting back with a second AT TIME ZONE would
-- return a timestamptz, and casting THAT to date reads the session's TimeZone
-- instead of the owner's — measured shifting 2026-08-01 to 2026-07-31 on a
-- session running at -03.
INSERT INTO budget_monthly_allocations (account_id, budget_month, budget_amount)
SELECT cba.account_id,
 date_trunc('month', ua.account_start_date AT TIME ZONE u.timezone)::date,
 cba.budget
FROM category_budget_accounts cba
JOIN user_accounts ua ON ua.account_id = cba.account_id
JOIN users u          ON u.user_id     = ua.user_id
WHERE cba.budget IS NOT NULL AND cba.budget > 0
ON CONFLICT (account_id, budget_month) DO NOTHING;

-- DOWN
-- Deliberately empty. A backfilled row is indistinguishable from one a user
-- created: both are a row in budget_monthly_allocations. Deleting by "the
-- amount still matches cba.budget" would destroy real edits that happen to
-- coincide. To revert the budget domain outright, use 010's DOWN, which drops
-- the table. The DELETE below only lets db:migrate re-apply this file.
--
-- BEGIN;
-- DELETE FROM migrations WHERE filename = '012_backfill_budget_allocations.sql';
-- COMMIT;
