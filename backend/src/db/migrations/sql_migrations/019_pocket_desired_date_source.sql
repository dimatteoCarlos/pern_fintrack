-- 019_pocket_desired_date_source.sql
--
-- Records where a pocket's desired_date came from.
--
-- desired_date is NOT NULL, so the creation controller has always had to write
-- something when the caller sent nothing. It wrote account_start_date + 1 year,
-- and now writes + 1 month. Either way the row carries a deadline the user
-- never chose, and every pace figure the board is about to serve — required
-- monthly, projected completion, at-risk — divides by it. Served without a
-- provenance, those figures read as authoritative and rest on an assumption.
--
-- So the origin is stored and travels in the contract. On screen, a pocket
-- whose source is 'default' says "deadline not set" where its pace would go.
--
-- A source, not a boolean, named after exchange_rate_source in this same table:
-- the third case is foreseeable — an import, a template — and a column called
-- deadline_is_default would have to be renamed the day it arrives. The CHECK
-- makes an unknown origin unrepresentable rather than merely unlikely.
--
-- H13: this table is defined twice, here and in run_time_db_init/createTables.js,
-- and production builds through the runtime path. The column enters both in the
-- same commit or production never gets it.
--
-- No BEGIN/COMMIT here, as in 011, 014 and 015. runMigrations.js already wraps
-- each file in a transaction together with its INSERT INTO migrations.

-- UP

-- DEFAULT 'user' is the honest reading for a row written before this column
-- existed only after the backfill below has moved the invented ones. It is set
-- here first so the column can be NOT NULL from the start: every historic row
-- gets a value, and the UPDATE then corrects the subset that was invented.
ALTER TABLE pocket_saving_accounts
 ADD COLUMN IF NOT EXISTS desired_date_source VARCHAR(20) NOT NULL DEFAULT 'user';

-- The backfill is exact, not approximate. The old branch derived the deadline
-- from the start date in one expression, so a defaulted row carries
-- desired_date = account_start_date + 1 year TO THE MICROSECOND. A date chosen
-- in the picker is stamped from the browser clock at the moment of submission
-- and cannot coincide with that instant.
--
-- Everything else stays 'user', which is what the data can support: those dates
-- were chosen, and claiming otherwise would be a statement with no evidence.
--
-- Only rows still holding the default are written, so re-running changes
-- nothing already corrected by hand.
UPDATE pocket_saving_accounts
SET desired_date_source = 'default'
WHERE desired_date = account_start_date + INTERVAL '1 year'
 AND desired_date_source = 'user';

-- Guarded so the file stays re-runnable: ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'pocket_saving_accounts_desired_date_source_check'
 ) THEN
  ALTER TABLE pocket_saving_accounts
   ADD CONSTRAINT pocket_saving_accounts_desired_date_source_check
   CHECK (desired_date_source IN ('user', 'default'));
 END IF;
END
$$;

-- DOWN
-- Run manually. Dropping the column loses the distinction between a deadline
-- the user picked and one the controller invented: desired_date keeps the
-- value, but nothing afterwards can tell the two apart, and re-running the UP
-- would then classify a + 1 month default as 'user'.
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- ALTER TABLE pocket_saving_accounts
--  DROP CONSTRAINT IF EXISTS pocket_saving_accounts_desired_date_source_check;
-- ALTER TABLE pocket_saving_accounts
--  DROP COLUMN IF EXISTS desired_date_source;
-- DELETE FROM migrations WHERE filename = '019_pocket_desired_date_source.sql';
-- COMMIT;
