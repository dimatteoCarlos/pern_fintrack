-- 017_budget_allocation_fx_columns.sql
--
-- Gives budget_monthly_allocations its own FX audit columns.
--
-- This is the same defect 014 fixed on category_budget_accounts, reopened by a
-- newer write path. PUT /budget/accounts/:accountId/current stores budgetAmount
-- verbatim: a budget typed as 50000 cop is written as 50000 in the accounting
-- currency, the same error of three orders of magnitude 014 describes. The
-- editor shows the origin currency beside the field and converts nothing, so
-- the figure the user reads back is neither what they typed nor what they meant.
--
-- 014, 015 and 016 closed this on category budgets, pocket targets and debtor
-- values. budget_monthly_allocations is the write path left, and it is the one
-- the budget module writes on every save.
--
-- The conversion alone is not enough, for the reason 014 gives: a budget is an
-- amount that did not move, so no transaction row carries its origin. Without
-- these columns the origin is unrecoverable.
--
-- original_budget_amount is the figure as typed, in original_currency_id.
-- budget_amount stays what it has always been: the amount in the accounting
-- currency, which is what every read path resolves and sums.
--
-- Restorer rows are the exception worth naming. writeAllocation writes a second
-- row at `to` + 1 carrying an amount it read back from the table, already in the
-- accounting currency. That row records an identity conversion in the account's
-- own currency, because no user typed it and there is no origin to preserve.
--
-- Types mirror 014_category_budget_fx_columns.sql so every table in the module
-- answers an FX question the same way.
--
-- No BEGIN/COMMIT here, as in 011 and 014. runMigrations.js already wraps each
-- file in a transaction together with its INSERT INTO migrations. A COMMIT
-- inside the file closes that transaction early and leaves the bookkeeping row
-- outside it.

-- UP

-- Added nullable first, so the backfill decides the value instead of a default
-- silently claiming every historic allocation was a dollar amount.
ALTER TABLE budget_monthly_allocations
 ADD COLUMN IF NOT EXISTS original_budget_amount DECIMAL(15,2),
 ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
 ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
 ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
 ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER;

-- Every historic row was written without conversion, so the stored amount IS
-- the original and the rate that produced it was 1. This is not an assumption
-- about what the user meant: it is what the repository did.
--
-- The currency comes from category_budget_accounts, which 010 made the single
-- owner of it and 011 made NOT NULL, so no row can be left NULL here and the
-- SET NOT NULL below cannot fail. The FK is ON DELETE CASCADE, so no allocation
-- can outlive the account the join reads.
--
-- Only untouched rows are written, so re-running the file changes nothing.
UPDATE budget_monthly_allocations bma
SET original_budget_amount = COALESCE(bma.budget_amount, 0),
 original_currency_id = cba.currency_id,
 exchange_rate = 1.0,
 exchange_rate_source = 'identity',
 exchange_rate_timestamp = bma.created_at,
 exchange_rate_target_currency_id = cba.currency_id
FROM category_budget_accounts cba
WHERE cba.account_id = bma.account_id
 AND bma.original_currency_id IS NULL;

-- Defaults exist for the same reason as in 014: a write that forgets a column
-- lands as an identity conversion rather than as a NULL that breaks the read
-- path. The repository always sends all six.
ALTER TABLE budget_monthly_allocations
 ALTER COLUMN original_budget_amount SET DEFAULT 0,
 ALTER COLUMN exchange_rate SET DEFAULT 1.0,
 ALTER COLUMN exchange_rate_source SET DEFAULT 'identity',
 ALTER COLUMN exchange_rate_timestamp SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE budget_monthly_allocations
 ALTER COLUMN original_budget_amount SET NOT NULL,
 ALTER COLUMN original_currency_id SET NOT NULL,
 ALTER COLUMN exchange_rate SET NOT NULL,
 ALTER COLUMN exchange_rate_source SET NOT NULL,
 ALTER COLUMN exchange_rate_timestamp SET NOT NULL,
 ALTER COLUMN exchange_rate_target_currency_id SET NOT NULL;

-- Guarded so the file stays re-runnable: ADD CONSTRAINT has no IF NOT EXISTS.
--
-- The FX target FK drops '_currency_id' from the name its siblings carry. With
-- it the name is 64 characters, one over the identifier limit, so Postgres
-- stores a truncated 63 and the guard above never matches its own constraint.
-- budget_monthly_allocations is the only FX table whose name is long enough to
-- overflow; 014, 015 and 016 keep the full name.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'budget_monthly_allocations_exchange_rate_check'
 ) THEN
  ALTER TABLE budget_monthly_allocations
   ADD CONSTRAINT budget_monthly_allocations_exchange_rate_check
   CHECK (exchange_rate > 0);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'budget_monthly_allocations_original_amount_check'
 ) THEN
  ALTER TABLE budget_monthly_allocations
   ADD CONSTRAINT budget_monthly_allocations_original_amount_check
   CHECK (original_budget_amount >= 0);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'budget_monthly_allocations_original_currency_id_fkey'
 ) THEN
  ALTER TABLE budget_monthly_allocations
   ADD CONSTRAINT budget_monthly_allocations_original_currency_id_fkey
   FOREIGN KEY (original_currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'budget_monthly_allocations_exchange_rate_target_fkey'
 ) THEN
  ALTER TABLE budget_monthly_allocations
   ADD CONSTRAINT budget_monthly_allocations_exchange_rate_target_fkey
   FOREIGN KEY (exchange_rate_target_currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;
END
$$;

-- DOWN
-- Run manually. Dropping the columns loses the origin of every allocation
-- written after this migration: budget_amount keeps the converted figure, but
-- what the user actually typed is only in original_budget_amount. Export
-- before running this.
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- ALTER TABLE budget_monthly_allocations
--  DROP CONSTRAINT IF EXISTS budget_monthly_allocations_exchange_rate_check,
--  DROP CONSTRAINT IF EXISTS budget_monthly_allocations_original_amount_check,
--  DROP CONSTRAINT IF EXISTS budget_monthly_allocations_original_currency_id_fkey,
--  DROP CONSTRAINT IF EXISTS budget_monthly_allocations_exchange_rate_target_fkey;
-- ALTER TABLE budget_monthly_allocations
--  DROP COLUMN IF EXISTS original_budget_amount,
--  DROP COLUMN IF EXISTS original_currency_id,
--  DROP COLUMN IF EXISTS exchange_rate,
--  DROP COLUMN IF EXISTS exchange_rate_source,
--  DROP COLUMN IF EXISTS exchange_rate_timestamp,
--  DROP COLUMN IF EXISTS exchange_rate_target_currency_id;
-- DELETE FROM migrations WHERE filename = '017_budget_allocation_fx_columns.sql';
-- COMMIT;
