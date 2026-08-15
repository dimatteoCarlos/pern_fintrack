-- 015_pocket_target_fx_columns.sql
--
-- Gives pocket_saving_accounts its own FX audit columns.
--
-- createPocketAccount stores target exactly as it arrives and inserts the
-- account declared in the accounting currency. Nothing has gone wrong yet only
-- because the New Pocket form never offered a currency: it sends the constant
-- DEFAULT_CURRENCY on every request. The moment the badge is added, a target
-- typed as 50000 cop lands as 50000 against a balance in usd, and the pocket
-- detail divides one by the other to show progress.
--
-- The conversion alone is not enough, for the same reason as in 014: a target
-- is an amount that did not move. The pocket's opening transaction is 0.00 —
-- money cannot be added at creation — so there is no transaction row to carry
-- the origin. Without these columns what the user typed is unrecoverable.
--
-- original_target is the figure as typed, in original_currency_id. target stays
-- what every read path already compares against the balance: the amount in the
-- accounting currency.
--
-- Types mirror 007_transactions_fx_columns.sql and 014, so the three tables
-- answer an FX question the same way.
--
-- Pre-migration audit (local fintrack_dev, 2026-08-14):
--   Every existing row is backfillable and the backfill is exact rather than
--   approximate: the form never sent a foreign currency, so no historic target
--   can have an origin other than the account's own currency.
--   pocket_saving_accounts holds no currency column of its own, so the origin
--   is read from user_accounts.currency_id, which is NOT NULL. The UPDATE
--   therefore cannot leave a NULL behind and SET NOT NULL cannot fail.
--
-- No BEGIN/COMMIT here, as in 011 and 014. runMigrations.js already wraps each
-- file in a transaction together with its INSERT INTO migrations.

-- UP

-- Added nullable first, so the backfill decides the value instead of a default
-- silently claiming every historic target was a dollar amount.
ALTER TABLE pocket_saving_accounts
 ADD COLUMN IF NOT EXISTS original_target DECIMAL(15,2),
 ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
 ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
 ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
 ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER;

-- Historic rows were written without conversion, so the stored target IS the
-- original and the rate that produced it was 1. Origin and target currency are
-- both the account's currency: that is what the controller wrote, and the form
-- could not have sent anything else.
-- Only untouched rows are written, so re-running the file changes nothing.
UPDATE pocket_saving_accounts p
SET original_target = COALESCE(p.target, 0),
 original_currency_id = a.currency_id,
 exchange_rate = 1.0,
 exchange_rate_source = 'identity',
 exchange_rate_timestamp = p.account_start_date,
 exchange_rate_target_currency_id = a.currency_id
FROM user_accounts a
WHERE a.account_id = p.account_id
 AND p.original_currency_id IS NULL;

-- Defaults exist for the same reason as in transactions: a write that forgets a
-- column lands as an identity conversion rather than as a NULL that breaks the
-- read path. The controller always sends all six.
-- The two currency ids take no default on purpose. The four values above are
-- true when absent — they describe "no conversion happened". An id has no such
-- equivalent: DEFAULT 1 would not mean "no conversion", it would name whichever
-- currency happens to hold id 1 today, and would let a write that forgot the
-- origin pass as a fact.
ALTER TABLE pocket_saving_accounts
 ALTER COLUMN original_target SET DEFAULT 0,
 ALTER COLUMN exchange_rate SET DEFAULT 1.0,
 ALTER COLUMN exchange_rate_source SET DEFAULT 'identity',
 ALTER COLUMN exchange_rate_timestamp SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE pocket_saving_accounts
 ALTER COLUMN original_target SET NOT NULL,
 ALTER COLUMN original_currency_id SET NOT NULL,
 ALTER COLUMN exchange_rate SET NOT NULL,
 ALTER COLUMN exchange_rate_source SET NOT NULL,
 ALTER COLUMN exchange_rate_timestamp SET NOT NULL,
 ALTER COLUMN exchange_rate_target_currency_id SET NOT NULL;

-- Guarded so the file stays re-runnable: ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'pocket_saving_accounts_exchange_rate_check'
 ) THEN
  ALTER TABLE pocket_saving_accounts
   ADD CONSTRAINT pocket_saving_accounts_exchange_rate_check
   CHECK (exchange_rate > 0);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'pocket_saving_accounts_original_currency_id_fkey'
 ) THEN
  ALTER TABLE pocket_saving_accounts
   ADD CONSTRAINT pocket_saving_accounts_original_currency_id_fkey
   FOREIGN KEY (original_currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'pocket_saving_accounts_exchange_rate_target_currency_id_fkey'
 ) THEN
  ALTER TABLE pocket_saving_accounts
   ADD CONSTRAINT pocket_saving_accounts_exchange_rate_target_currency_id_fkey
   FOREIGN KEY (exchange_rate_target_currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;
END
$$;

-- DOWN
-- Run manually. Dropping the columns loses the origin of every target created
-- after this migration: target keeps the converted figure, but what the user
-- actually typed is only in original_target. Export before running this.
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- ALTER TABLE pocket_saving_accounts
--  DROP CONSTRAINT IF EXISTS pocket_saving_accounts_exchange_rate_check,
--  DROP CONSTRAINT IF EXISTS pocket_saving_accounts_original_currency_id_fkey,
--  DROP CONSTRAINT IF EXISTS pocket_saving_accounts_exchange_rate_target_currency_id_fkey;
-- ALTER TABLE pocket_saving_accounts
--  DROP COLUMN IF EXISTS original_target,
--  DROP COLUMN IF EXISTS original_currency_id,
--  DROP COLUMN IF EXISTS exchange_rate,
--  DROP COLUMN IF EXISTS exchange_rate_source,
--  DROP COLUMN IF EXISTS exchange_rate_timestamp,
--  DROP COLUMN IF EXISTS exchange_rate_target_currency_id;
-- DELETE FROM migrations WHERE filename = '015_pocket_target_fx_columns.sql';
-- COMMIT;
