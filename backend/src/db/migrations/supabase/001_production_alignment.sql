-- 001_production_alignment.sql
--
-- Brings the live database from the schema it holds today to the schema the
-- migration chain produces. Run once, by hand, against production only.
--
-- WHY THIS FILE EXISTS.
-- Every column it adds is already declared in the chain and in createTables.js,
-- inside CREATE TABLE IF NOT EXISTS statements. Production's tables already
-- exist, so those statements are skipped and the columns never arrive; a
-- redeploy runs the same skipped statement again. IF NOT EXISTS protects the
-- table, not its columns. Only ALTER TABLE moves a database that already holds
-- data, and the chain has no ALTER for these columns because locally they
-- arrived with a CREATE on an empty database.
--
-- WHY IT IS NOT MIGRATION 018.
-- Production's migrations ledger is empty with its sequence at 5, so the runner
-- would read "nothing applied" and attempt 001 onwards against 17 populated
-- tables: every CREATE TABLE IF NOT EXISTS skipped, the 31 columns still
-- missing, and 17 ledger rows claiming success. The database would end up
-- exactly as incomplete while declaring itself current, which is worse than
-- leaving it alone because it destroys the only signal that anything is wrong.
--
-- HOW IT WAS BUILT.
-- From a column diff measured 2026-08-21 between a restored production clone
-- (110 columns) and a database built by the chain (141). It is not a
-- transcription of migrations 010 to 017: those carry starting assumptions that
-- hold on a database the chain built and are false here. See step 2.
-- That measurement compared columns only. The rest was verified on 2026-08-26,
-- by diffing the rehearsed copy against the chain-built database on constraints,
-- indexes, triggers and defaults: triggers identical, nothing missing. Three
-- differences, none of them a defect:
--   account_name_case_backup_013 exists only on the chain — migration 013 is
--     deliberately not reproduced here; see step 8.
--   app_initialization exists only on the aligned copy — createTables.js makes
--     it at runtime, which is why production has it and the chain does not.
--   user_roles' CHECK renders differently (ARRAY[...]::text[] against one cast
--     per element) and accepts the same four strings.
--
-- BEGIN/COMMIT ARE IN THIS FILE, unlike 010 to 017. Nothing wraps it —
-- runMigrations.js is not what executes it. Do not remove them.
--
-- Idempotent throughout: every step is guarded, so re-running changes nothing.
--
-- ORDER IS FORCED, not stylistic:
--   1 before 6 — the allocation month is resolved on users.timezone.
--   2 before 3 and 7 — both read category_budget_accounts.currency_id, which
--     production holds NULL on all 94 rows.
--   6 before 7 — step 7 makes two currency-id columns NOT NULL with no default,
--     so step 6's three-column INSERT would fail once they exist. A second run
--     is that same situation, which is why step 6 skips with NOT EXISTS.
--   8 before 9 — step 9 records 003_transactions.sql as applied. That claim is
--     only true once the foreign keys it declares match, which is step 8. In
--     the other order the ledger states a schema the database does not have.
--
-- REHEARSED 2026-08-26, against a copy restored from the production dump of
-- 2026-08-21 23:04. Every step ran as one transaction through to COMMIT with
-- ON_ERROR_STOP=1 and no errors: 110 columns across 17 tables became 141 across
-- 18. Step 2 filled 94 rows, step 3 dated 94, step 4 one pocket, step 5 none,
-- step 6 created the table with 94 allocations, step 7 updated 94, and the
-- ledger step wrote its 17 rows. A second pass returned zero on every statement
-- and left 141 columns, so the idempotency above is measured, not asserted.
-- What the rehearsal could NOT exercise: step 5, because debtor_accounts holds
-- no rows in production. It is verified structurally and nothing further.
-- The rehearsal predates step 8: the file had eight steps then, the ledger was
-- the eighth, and the foreign-key step did not yet exist.
--
-- STEP 8 NEVER RAN FROM THIS FILE, and never will. It was added 2026-08-27,
-- five days after this file was applied to Supabase on 2026-08-22, and
-- runMigrations.js skips any filename already in its ledger. The change reached
-- production as chain migration
-- 018_alter_transactions_account_fks_to_restrict.sql, applied 2026-08-27.
-- The step is kept here so this file still builds a correct database from a
-- production-shaped copy; it is no longer the path by which the live database
-- receives anything.

-- UP

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. users.timezone and its IANA trigger
-- ---------------------------------------------------------------------------
-- A period boundary means nothing without the calendar it is read on.
--
-- DECIDED 2026-08-26: DEFAULT 'UTC' stands and no UPDATE is added here.
-- The default reproduces exactly what the code does today, and it is also what
-- step 6 uses to decide which month each backfilled budget lands in. The
-- pre-flight query was run on the restored copy: of the 94 budgeted accounts,
-- not one changes month under America/Caracas or America/Bogota. Naming a zone
-- would therefore move no data while asserting an owner zone the app has never
-- asked for. If a future measurement does shift a month, the statement to add
-- to this step, inside this same transaction, is:
--   UPDATE users SET timezone = '<IANA zone>';
ALTER TABLE users
 ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- A CHECK cannot consult a catalog (no subqueries), so it would admit 'UTC-5',
-- which cannot express DST or a historical rule change.
CREATE OR REPLACE FUNCTION assert_iana_timezone()
RETURNS TRIGGER AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
  RAISE EXCEPTION 'Invalid IANA time zone: %', NEW.timezone
   USING ERRCODE = '22023';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_timezone_is_iana ON users;
CREATE TRIGGER trg_users_timezone_is_iana
 BEFORE INSERT OR UPDATE OF timezone ON users
 FOR EACH ROW EXECUTE FUNCTION assert_iana_timezone();

-- ---------------------------------------------------------------------------
-- 2. category_budget_accounts.currency_id: filled, then made mandatory
-- ---------------------------------------------------------------------------
-- This is the step a transcription of the chain would get wrong. Migration 014
-- states in its own header that its SET NOT NULL cannot fail because 011
-- already populated this column. True on a database the chain built; false
-- here, where all 94 rows hold NULL. Filling it first is what makes that
-- statement true before anything relies on it.
--
-- The value is the accounting currency from user_accounts, written by
-- insertAccount. It is never the origin currency the client sent.
-- Measured 2026-08-21: 94 rows, 94 fillable, 0 without a parent.
UPDATE category_budget_accounts cba
SET currency_id = ua.currency_id
FROM user_accounts ua
WHERE ua.account_id = cba.account_id
 AND cba.currency_id IS NULL;

ALTER TABLE category_budget_accounts
 ALTER COLUMN currency_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. category_budget_accounts FX columns
-- ---------------------------------------------------------------------------
-- A budget is an amount that did not move: the account's opening transaction is
-- 0.00, so no transaction row carries its origin. Without these columns what
-- the user typed is unrecoverable.
--
-- Added nullable first, so the backfill decides the value instead of a default
-- silently claiming every historic budget was already in the accounting
-- currency.
ALTER TABLE category_budget_accounts
 ADD COLUMN IF NOT EXISTS original_budget DECIMAL(15,2),
 ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
 ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
 ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
 ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER;

-- Historic rows were written without conversion, so the stored budget IS the
-- original and the rate that produced it was 1. Not an assumption about intent:
-- it is what the controller did.
UPDATE category_budget_accounts
SET original_budget = COALESCE(budget, 0),
 original_currency_id = currency_id,
 exchange_rate = 1.0,
 exchange_rate_source = 'identity',
 exchange_rate_timestamp = account_start_date,
 exchange_rate_target_currency_id = currency_id
WHERE original_currency_id IS NULL;

-- A write that forgets a column lands as an identity conversion rather than as
-- a NULL that breaks the read path. The two currency ids take no default: an id
-- has no "no conversion happened" value, and DEFAULT 1 would name whichever
-- currency holds id 1 today and let a forgotten origin pass as a fact.
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

-- Guarded because ADD CONSTRAINT has no IF NOT EXISTS.
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

-- ---------------------------------------------------------------------------
-- 4. pocket_saving_accounts FX columns
-- ---------------------------------------------------------------------------
-- Same argument as step 3: a target is an amount that did not move, and money
-- cannot be added at creation, so the opening transaction is 0.00 and carries
-- no origin.
--
-- The origin is read from user_accounts.currency_id, which is NOT NULL, and not
-- from this table's own nullable currency_id. Measured 2026-08-21: 1 row, 1
-- fillable. Note that migration 015's header claims this table holds no
-- currency column of its own; it does, at 002_accounts.sql:197. The header is
-- stale, the backfill is not.
ALTER TABLE pocket_saving_accounts
 ADD COLUMN IF NOT EXISTS original_target DECIMAL(15,2),
 ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
 ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
 ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
 ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER;

-- The form never offered a currency, so no historic target can have an origin
-- other than the account's own currency. The backfill is exact, not estimated.
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

-- ---------------------------------------------------------------------------
-- 5. debtor_accounts FX columns
-- ---------------------------------------------------------------------------
-- A loan IS an amount that moved, so its transaction rows carry the origin.
-- These columns are still not redundant: value is editable after creation, and
-- at that point the opening transaction stops describing it.
--
-- The table is empty in production (measured 2026-08-21), so the UPDATE writes
-- nothing. The columns and constraints still have to exist before the first row
-- is written, which is the whole point of aligning ahead of use.
ALTER TABLE debtor_accounts
 ADD COLUMN IF NOT EXISTS original_value DECIMAL(15,2),
 ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
 ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
 ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
 ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER;

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

-- currency_id changes meaning, not content: from the currency the client asked
-- for to the currency value is expressed in. Its ON DELETE moves from SET NULL
-- to RESTRICT because a NULL currency turns a stored amount into a number
-- without a unit, silently. The first block is guarded on confdeltype = 'n' so
-- the drop runs once and is skipped when the rule is already 'r'.
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

-- ---------------------------------------------------------------------------
-- 6. budget_monthly_allocations, and its backfill from the legacy budget column
-- ---------------------------------------------------------------------------
-- One monthly allocation per user decision. A row is in force from its month
-- onwards until a later row replaces it, so "this budget recurs" is already
-- encoded as "no later row terminates it"; a column saying so would be a second
-- source of truth for one fact and the two can disagree.
--
-- Purely additive: category_budget_accounts.budget stays and keeps serving the
-- read path.
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

-- Without this INSERT the 94 accounts holding a budget stay invisible to the
-- read path: the runtime initializer creates the table and never backfills.
--
-- budget > 0 only. Zero is not a legacy budget; it is the marker meaning "the
-- user decided to stop budgeting".
--
-- The month is the owner's, not the server's — see the decision at step 1.
-- `ts AT TIME ZONE tz` yields a timestamp without time zone on the owner's
-- calendar, so date_trunc and the ::date cast operate on local time. Converting
-- back with a second AT TIME ZONE would return a timestamptz whose ::date reads
-- the session's zone instead of the owner's.
--
-- Skipped with NOT EXISTS, not left to ON CONFLICT: a NOT NULL is checked when
-- the row is formed, before the unique index ON CONFLICT reads, so on a re-run
-- the row would die on step 7's two currency ids before the guard could discard
-- it. ON CONFLICT stays as the guard on the unique constraint itself.
INSERT INTO budget_monthly_allocations (account_id, budget_month, budget_amount)
SELECT cba.account_id,
 date_trunc('month', ua.account_start_date AT TIME ZONE u.timezone)::date,
 cba.budget
FROM category_budget_accounts cba
JOIN user_accounts ua ON ua.account_id = cba.account_id
JOIN users u          ON u.user_id     = ua.user_id
WHERE cba.budget IS NOT NULL AND cba.budget > 0
 AND NOT EXISTS (
  SELECT 1 FROM budget_monthly_allocations bma
  WHERE bma.account_id = cba.account_id
   AND bma.budget_month
    = date_trunc('month', ua.account_start_date AT TIME ZONE u.timezone)::date
 )
ON CONFLICT (account_id, budget_month) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. budget_monthly_allocations FX columns
-- ---------------------------------------------------------------------------
-- After step 6, never before: the two currency-id columns below take no default
-- and become NOT NULL, so step 6's three-column INSERT would fail once they
-- exist.
--
-- The currency comes from category_budget_accounts, which step 2 made NOT NULL,
-- so no row can be left NULL here and the SET NOT NULL cannot fail.
ALTER TABLE budget_monthly_allocations
 ADD COLUMN IF NOT EXISTS original_budget_amount DECIMAL(15,2),
 ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
 ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
 ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
 ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER;

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

-- The FX target FK drops '_currency_id' from the name its siblings carry: with
-- it the identifier is 64 characters, one over the limit, so Postgres stores a
-- truncated 63 and the guard never matches its own constraint.
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

-- ---------------------------------------------------------------------------
-- 8. transactions -> user_accounts: CASCADE becomes RESTRICT
-- ---------------------------------------------------------------------------
-- The three foreign keys are declared inside CREATE TABLE IF NOT EXISTS, in
-- 003_transactions.sql and in createTables.js. Production's table exists, so
-- both statements are skipped and the corrected rule never arrives: IF NOT
-- EXISTS protects the table, not its constraints. Only ALTER TABLE moves it.
--
-- Why it matters: a cascade from user_accounts deleted the counterparty's own
-- ledger rows, not just the deleted account's. Three accounts in the local
-- database no longer reconcile against their own rows for that reason.
-- RESTRICT is a guard rail, not the integrity mechanism - integrity comes from
-- the deletion engine. All it guarantees is that nothing reaches a physical
-- delete without passing through that engine, which detaches every reference
-- before it drops the row.
--
-- The other six foreign keys to user_accounts stay untouched: they are 1:1
-- extension tables and their cascade is correct.
ALTER TABLE transactions
 DROP CONSTRAINT IF EXISTS transactions_account_id_fkey,
 DROP CONSTRAINT IF EXISTS transactions_source_account_id_fkey,
 DROP CONSTRAINT IF EXISTS transactions_destination_account_id_fkey;

ALTER TABLE transactions
 ADD CONSTRAINT transactions_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES user_accounts(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT transactions_source_account_id_fkey
  FOREIGN KEY (source_account_id) REFERENCES user_accounts(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT transactions_destination_account_id_fkey
  FOREIGN KEY (destination_account_id) REFERENCES user_accounts(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Asserts three, and only three. The constraint names above are PostgreSQL's
-- defaults, measured on the local database; if production named them anything
-- else the DROP finds nothing and the ADD leaves the old CASCADE constraint in
-- place beside the new one, which counts six and aborts here.
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'transactions'::regclass
       AND confrelid = 'user_accounts'::regclass) <> 3
 OR (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'transactions'::regclass
       AND confrelid = 'user_accounts'::regclass
       AND confdeltype = 'r') <> 3 THEN
  RAISE EXCEPTION
   'transactions foreign keys to user_accounts are not exactly three RESTRICT';
 END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. The ledger, last
-- ---------------------------------------------------------------------------
-- Production's migrations table is empty with its sequence at 5, so a runner
-- pointed here would consider every chain file pending. These rows record that
-- the chain's effect is already present, so it skips them instead of re-running
-- files whose starting assumptions no longer hold.
--
-- 013 is deliberately absent: this file does not normalize name case. It gets
-- its row when 013 itself runs, which is the correct order anyway — the runner
-- would then apply that one file and nothing else.
CREATE TABLE IF NOT EXISTS migrations (
 id SERIAL PRIMARY KEY,
 filename TEXT NOT NULL UNIQUE,
 executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO migrations (filename) VALUES
 ('001_initial_migration.sql'),
 ('002_accounts.sql'),
 ('003_transactions.sql'),
 ('004_auth.sql'),
 ('005_base_catalogs.sql'),
 ('006_exchange_rates.sql'),
 ('007_transactions_fx_columns.sql'),
 ('008_update_currencies.sql'),
 ('009_backfill_fx_metadata.sql'),
 ('010_create_budget_tables.sql'),
 ('011_enforce_category_budget_currency.sql'),
 ('012_backfill_budget_allocations.sql'),
 ('014_category_budget_fx_columns.sql'),
 ('015_pocket_target_fx_columns.sql'),
 ('016_debtor_value_fx_columns.sql'),
 ('017_budget_allocation_fx_columns.sql'),
 ('supabase/001_production_alignment.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- DOWN
-- Run manually, as one transaction. It is a true inverse of the UP and it is
-- destructive in one specific way: dropping the FX columns loses the origin of
-- every budget, target, loan and allocation written after this file ran. The
-- converted figure survives in budget, target, value and budget_amount; what
-- the user actually typed exists only in the original_* columns. Export first.
--
-- The allocation table goes whole, which is safe for the rows this file created
-- and destroys any allocation a user created afterwards. There is no way to
-- tell the two apart: both are a row in budget_monthly_allocations.
--
-- BEGIN;
--
-- DELETE FROM migrations WHERE filename IN (
--  '001_initial_migration.sql', '002_accounts.sql', '003_transactions.sql',
--  '004_auth.sql', '005_base_catalogs.sql', '006_exchange_rates.sql',
--  '007_transactions_fx_columns.sql', '008_update_currencies.sql',
--  '009_backfill_fx_metadata.sql', '010_create_budget_tables.sql',
--  '011_enforce_category_budget_currency.sql',
--  '012_backfill_budget_allocations.sql', '014_category_budget_fx_columns.sql',
--  '015_pocket_target_fx_columns.sql', '016_debtor_value_fx_columns.sql',
--  '017_budget_allocation_fx_columns.sql',
--  'supabase/001_production_alignment.sql'
-- );
--
-- The foreign keys return to CASCADE. This is the one DOWN statement that
-- restores a defect rather than a state: it re-opens the path that deletes a
-- counterparty's own ledger rows. Run it only to undo the whole file.
-- ALTER TABLE transactions
--  DROP CONSTRAINT IF EXISTS transactions_account_id_fkey,
--  DROP CONSTRAINT IF EXISTS transactions_source_account_id_fkey,
--  DROP CONSTRAINT IF EXISTS transactions_destination_account_id_fkey;
-- ALTER TABLE transactions
--  ADD CONSTRAINT transactions_account_id_fkey
--   FOREIGN KEY (account_id) REFERENCES user_accounts(account_id)
--   ON DELETE CASCADE ON UPDATE CASCADE,
--  ADD CONSTRAINT transactions_source_account_id_fkey
--   FOREIGN KEY (source_account_id) REFERENCES user_accounts(account_id)
--   ON DELETE CASCADE ON UPDATE CASCADE,
--  ADD CONSTRAINT transactions_destination_account_id_fkey
--   FOREIGN KEY (destination_account_id) REFERENCES user_accounts(account_id)
--   ON DELETE CASCADE ON UPDATE CASCADE;
--
-- DROP TABLE IF EXISTS budget_monthly_allocations CASCADE;
--
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
--
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
--
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
--
-- The column returns to nullable. The values written by step 2 stay: they are
-- correct, and nulling them would discard a fact rather than restore one.
-- ALTER TABLE category_budget_accounts
--  ALTER COLUMN currency_id DROP NOT NULL;
--
-- DROP TRIGGER IF EXISTS trg_users_timezone_is_iana ON users;
-- DROP FUNCTION IF EXISTS assert_iana_timezone();
-- ALTER TABLE users DROP COLUMN IF EXISTS timezone;
--
-- COMMIT;
