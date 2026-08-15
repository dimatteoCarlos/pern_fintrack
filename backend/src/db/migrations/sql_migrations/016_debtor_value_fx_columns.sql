-- 016_debtor_value_fx_columns.sql
--
-- Gives debtor_accounts its own FX audit columns.
--
-- createDebtorAccount stores value exactly as it arrives and inserts the account
-- declared in the accounting currency. Nothing has gone wrong yet only because
-- the New Profile form never offered a currency: it sends the constant
-- DEFAULT_CURRENCY on every request. The moment the badge is added, a loan typed
-- as 5000 mxn lands as 5000 against a bank balance in usd, and the funds check
-- compares the two before the row is even written.
--
-- Unlike 014 and 015, a loan IS an amount that moved, so its two transaction
-- rows already carry the origin. These columns are not redundant for two
-- reasons: value is editable after creation, and at that point the opening
-- transaction stops describing it; and reading the origin from transactions
-- would mean joining on movement_type_id = 8 on every debtor read.
--
-- original_value is the figure as typed, in original_currency_id. value stays
-- what every read path already selects — getAccountController reads it as
-- starting_value, dashboardController as dbt.value — now in the accounting
-- currency.
--
-- currency_id changes meaning, not content. It was written with the requested
-- currency id and read by nobody; from here it states the currency value is
-- expressed in, which is the accounting currency. Its ON DELETE goes from SET
-- NULL to RESTRICT for the same reason as in 014 and 015: a NULL currency turns
-- a stored amount into a number without a unit, silently. It stays nullable:
-- RESTRICT already closes the only path that produced a NULL, and making it NOT
-- NULL would force a decision about value, which is nullable too and out of
-- scope here.
--
-- Types mirror 007_transactions_fx_columns.sql, 014 and 015, so the four tables
-- answer an FX question the same way.
--
-- Pre-migration audit (local fintrack_dev, 2026-08-14):
--   Every existing row is backfillable and the backfill is exact rather than
--   approximate: the form never sent a foreign currency, and DEFAULT_CURRENCY
--   on the frontend and ACCOUNTING_CURRENCY_CODE on the backend resolve to the
--   same value, so no historic value can have an origin other than the
--   accounting currency.
--   user_accounts.currency_id is NOT NULL and already holds the accounting
--   currency for debtor accounts, so it is the safe source for the backfill and
--   the UPDATE cannot leave a NULL behind.
--
-- No BEGIN/COMMIT here, as in 011, 014 and 015. runMigrations.js already wraps
-- each file in a transaction together with its INSERT INTO migrations.

-- UP

-- Added nullable first, so the backfill decides the value instead of a default
-- silently claiming every historic loan was a dollar amount.
ALTER TABLE debtor_accounts
 ADD COLUMN IF NOT EXISTS original_value DECIMAL(15,2),
 ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
 ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
 ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
 ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER;

-- Historic rows were written without conversion, so the stored value IS the
-- original and the rate that produced it was 1. Origin and target currency are
-- both the account's currency: that is what the controller wrote, and the form
-- could not have sent anything else.
-- Only untouched rows are written, so re-running the file changes nothing.
UPDATE debtor_accounts d
SET original_value = COALESCE(d.value, 0),
 original_currency_id = COALESCE(d.currency_id, a.currency_id),
 exchange_rate = 1.0,
 exchange_rate_source = 'identity',
 exchange_rate_timestamp = d.account_start_date,
 exchange_rate_target_currency_id = a.currency_id,
 currency_id = a.currency_id
FROM user_accounts a
WHERE a.account_id = d.account_id
 AND d.original_currency_id IS NULL;

-- Defaults exist for the same reason as in transactions: a write that forgets a
-- column lands as an identity conversion rather than as a NULL that breaks the
-- read path. The controller always sends all six.
-- The two currency ids take no default on purpose. The four values above are
-- true when absent — they describe "no conversion happened". An id has no such
-- equivalent: DEFAULT 1 would not mean "no conversion", it would name whichever
-- currency happens to hold id 1 today, and would let a write that forgot the
-- origin pass as a fact.
ALTER TABLE debtor_accounts
 ALTER COLUMN original_value SET DEFAULT 0,
 ALTER COLUMN exchange_rate SET DEFAULT 1.0,
 ALTER COLUMN exchange_rate_source SET DEFAULT 'identity',
 ALTER COLUMN exchange_rate_timestamp SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE debtor_accounts
 ALTER COLUMN original_value SET NOT NULL,
 ALTER COLUMN original_currency_id SET NOT NULL,
 ALTER COLUMN exchange_rate SET NOT NULL,
 ALTER COLUMN exchange_rate_source SET NOT NULL,
 ALTER COLUMN exchange_rate_timestamp SET NOT NULL,
 ALTER COLUMN exchange_rate_target_currency_id SET NOT NULL;

-- Guarded so the file stays re-runnable: ADD CONSTRAINT has no IF NOT EXISTS.
-- The currency_id block is guarded on confdeltype = 'n' (SET NULL), so the drop
-- runs once and is skipped on any later run, when the rule is already 'r'.
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'debtor_accounts_currency_id_fkey'
   AND confdeltype = 'n'
 ) THEN
  ALTER TABLE debtor_accounts
   DROP CONSTRAINT debtor_accounts_currency_id_fkey;
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'debtor_accounts_currency_id_fkey'
 ) THEN
  ALTER TABLE debtor_accounts
   ADD CONSTRAINT debtor_accounts_currency_id_fkey
   FOREIGN KEY (currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'debtor_accounts_exchange_rate_check'
 ) THEN
  ALTER TABLE debtor_accounts
   ADD CONSTRAINT debtor_accounts_exchange_rate_check
   CHECK (exchange_rate > 0);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'debtor_accounts_original_currency_id_fkey'
 ) THEN
  ALTER TABLE debtor_accounts
   ADD CONSTRAINT debtor_accounts_original_currency_id_fkey
   FOREIGN KEY (original_currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'debtor_accounts_exchange_rate_target_currency_id_fkey'
 ) THEN
  ALTER TABLE debtor_accounts
   ADD CONSTRAINT debtor_accounts_exchange_rate_target_currency_id_fkey
   FOREIGN KEY (exchange_rate_target_currency_id) REFERENCES currencies(currency_id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;
END
$$;

-- DOWN
-- Run manually. Dropping the columns loses the origin of every loan created
-- after this migration: value keeps the converted figure, but what the user
-- actually typed is only in original_value. Export before running this.
-- Restoring ON DELETE SET NULL on currency_id restores the defect this file
-- closed; it is here only so the DOWN is a true inverse.
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- ALTER TABLE debtor_accounts
--  DROP CONSTRAINT IF EXISTS debtor_accounts_exchange_rate_check,
--  DROP CONSTRAINT IF EXISTS debtor_accounts_original_currency_id_fkey,
--  DROP CONSTRAINT IF EXISTS debtor_accounts_exchange_rate_target_currency_id_fkey,
--  DROP CONSTRAINT IF EXISTS debtor_accounts_currency_id_fkey;
-- ALTER TABLE debtor_accounts
--  ADD CONSTRAINT debtor_accounts_currency_id_fkey
--  FOREIGN KEY (currency_id) REFERENCES currencies(currency_id)
--  ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE debtor_accounts
--  DROP COLUMN IF EXISTS original_value,
--  DROP COLUMN IF EXISTS original_currency_id,
--  DROP COLUMN IF EXISTS exchange_rate,
--  DROP COLUMN IF EXISTS exchange_rate_source,
--  DROP COLUMN IF EXISTS exchange_rate_timestamp,
--  DROP COLUMN IF EXISTS exchange_rate_target_currency_id;
-- DELETE FROM migrations WHERE filename = '016_debtor_value_fx_columns.sql';
-- COMMIT;
