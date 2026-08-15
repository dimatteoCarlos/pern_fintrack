-- 014_category_budget_fx_columns.sql
--
-- Gives category_budget_accounts its own FX audit columns.
--
-- createCategoryBudgetAccount is the only write path in the API that never
-- called currencyAmountConversion. A budget typed as 50000 cop was stored as
-- 50000 in the accounting currency, an error of three orders of magnitude that
-- nothing in the schema could detect afterwards.
--
-- The conversion alone is not enough. Every other converted figure records its
-- origin on the transaction that moved it, but a budget is an amount that did
-- not move: the account's opening transaction is 0.00, so it has no row to
-- carry the metadata. Without these columns the origin is unrecoverable, and
-- the day a user asks why their budget reads 12.50 there is no answer.
--
-- original_budget is the figure as typed, in original_currency_id. budget stays
-- what it has always been: the amount in the accounting currency, which is what
-- every read path sums. The pair is what makes the row auditable.
--
-- Types mirror 007_transactions_fx_columns.sql so both tables answer an FX
-- question the same way.
--
-- Pre-migration audit (local fintrack_dev, 2026-08-14):
--   total_rows: read before applying. Every row is backfillable: budget and
--   currency_id are both populated since 011 made currency_id NOT NULL.
--   No row can be left NULL by the UPDATE below, so SET NOT NULL cannot fail.
--
-- No BEGIN/COMMIT here, as in 011. runMigrations.js already wraps each file in
-- a transaction together with its INSERT INTO migrations. A COMMIT inside the
-- file closes that transaction early and leaves the bookkeeping row outside it.

-- UP

-- Added nullable first, so the backfill decides the value instead of a default
-- silently claiming every historic budget was a dollar amount.
ALTER TABLE category_budget_accounts
 ADD COLUMN IF NOT EXISTS original_budget DECIMAL(15,2),
 ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
 ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
 ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
 ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER;

-- Historic rows were written without conversion, so the stored budget IS the
-- original and the rate that produced it was 1. This is not an assumption about
-- what the user meant: it is what the controller did.
-- Only untouched rows are written, so re-running the file changes nothing.
UPDATE category_budget_accounts
SET original_budget = COALESCE(budget, 0),
 original_currency_id = currency_id,
 exchange_rate = 1.0,
 exchange_rate_source = 'identity',
 exchange_rate_timestamp = account_start_date,
 exchange_rate_target_currency_id = currency_id
WHERE original_currency_id IS NULL;

-- Defaults exist for the same reason as in transactions: a write that forgets a
-- column lands as an identity conversion rather than as a NULL that breaks the
-- read path. The controller always sends all six.
ALTER TABLE category_budget_accounts
 ALTER COLUMN original_budget SET DEFAULT 0,
 ALTER COLUMN exchange_rate SET DEFAULT 1.0,
 ALTER COLUMN exchange_rate_source SET DEFAULT 'identity',
 ALTER COLUMN exchange_rate_timestamp SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE category_budget_accounts
 ALTER COLUMN original_budget SET NOT NULL,
 ALTER COLUMN original_currency_id SET NOT NULL,
 ALTER COLUMN exchange_rate SET NOT NULL,
 ALTER COLUMN exchange_rate_source SET NOT NULL,
 ALTER COLUMN exchange_rate_timestamp SET NOT NULL,
 ALTER COLUMN exchange_rate_target_currency_id SET NOT NULL;

-- Guarded so the file stays re-runnable: ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'category_budget_accounts_exchange_rate_check'
 ) THEN
  ALTER TABLE category_budget_accounts
   ADD CONSTRAINT category_budget_accounts_exchange_rate_check
   CHECK (exchange_rate > 0);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'category_budget_accounts_original_currency_id_fkey'
 ) THEN
  ALTER TABLE category_budget_accounts
   ADD CONSTRAINT category_budget_accounts_original_currency_id_fkey
   FOREIGN KEY (original_currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'category_budget_accounts_exchange_rate_target_currency_id_fkey'
 ) THEN
  ALTER TABLE category_budget_accounts
   ADD CONSTRAINT category_budget_accounts_exchange_rate_target_currency_id_fkey
   FOREIGN KEY (exchange_rate_target_currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;
END
$$;

-- DOWN
-- Run manually. Dropping the columns loses the origin of every budget created
-- after this migration: budget keeps the converted figure, but what the user
-- actually typed is only in original_budget. Export before running this.
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- ALTER TABLE category_budget_accounts
--  DROP CONSTRAINT IF EXISTS category_budget_accounts_exchange_rate_check,
--  DROP CONSTRAINT IF EXISTS category_budget_accounts_original_currency_id_fkey,
--  DROP CONSTRAINT IF EXISTS category_budget_accounts_exchange_rate_target_currency_id_fkey;
-- ALTER TABLE category_budget_accounts
--  DROP COLUMN IF EXISTS original_budget,
--  DROP COLUMN IF EXISTS original_currency_id,
--  DROP COLUMN IF EXISTS exchange_rate,
--  DROP COLUMN IF EXISTS exchange_rate_source,
--  DROP COLUMN IF EXISTS exchange_rate_timestamp,
--  DROP COLUMN IF EXISTS exchange_rate_target_currency_id;
-- DELETE FROM migrations WHERE filename = '014_category_budget_fx_columns.sql';
-- COMMIT;
