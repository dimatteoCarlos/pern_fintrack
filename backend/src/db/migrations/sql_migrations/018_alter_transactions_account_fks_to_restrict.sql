-- 018_alter_transactions_account_fks_to_restrict.sql
--
-- Turns the delete rule of the three foreign keys from transactions to
-- user_accounts from CASCADE into RESTRICT.
--
-- Why a migration and not the edit already made to 003, createTables.js and the
-- alignment file: all three declare the rule inside a CREATE TABLE, which is
-- inert on a table that exists. The alignment file additionally ran on Supabase
-- on 2026-08-22 and its name is in the ledger, so the runner will never execute
-- it again. Only an ALTER reaches a database that already holds data.
--
-- What the cascade does today: deleting an account also deletes the ledger rows
-- of its counterparty, because the rule follows source_account_id and
-- destination_account_id, not only account_id.
--
-- RESTRICT is a guard rail, not the integrity mechanism. It guarantees that
-- nothing reaches a physical delete without passing through the deletion engine,
-- which detaches every reference first.
--
-- The other six foreign keys to user_accounts stay untouched: they are 1:1
-- extension tables and their cascade is correct.
--
-- No BEGIN/COMMIT: runMigrations.js wraps every file in one transaction
-- together with its INSERT INTO migrations. Same convention as 010 to 017.

-- UP

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

-- Asserts three, and only three. The names above are PostgreSQL's defaults,
-- measured on production 2026-08-27. If one were named otherwise the DROP finds
-- nothing, the ADD leaves the old CASCADE constraint beside the new one, and the
-- count reaches six instead of three.
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

-- DOWN
-- Restores a defect rather than a state: it re-opens the path that deletes a
-- counterparty's own ledger rows. Run manually, only to undo this file.
--
-- BEGIN;
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
-- DELETE FROM migrations
--  WHERE filename = '018_alter_transactions_account_fks_to_restrict.sql';
-- COMMIT;
