-- 031_add_boundary_account_type.sql
--
-- ============================================================================
-- Migration 031: adds the structural account type 'boundary' as
--   account_type_id 8 and retypes the compensation accounts that already exist
--   from 'bank' to it, so the system's own counterpart account stops counting
--   as one of the owner's bank accounts.
-- Depends on: 001_initial_migration.sql, which declares account_types and the
--   user_accounts.account_type_id foreign key, and 005_base_catalogs.sql,
--   which seeds types 1 to 6. Type 7, 'cash', arrived through the boot seed and
--   is present on both build paths.
-- Measured before writing: fintrack_dev on 2026-09-06, inside a read-only
--   transaction. Ledger head 030_add_jpy_currency.sql. account_types holds
--   seven rows, 1 bank through 7 cash, so 8 is the next free id. user_accounts
--   holds 31 rows, of which exactly one is named 'slack' -- account_id 14,
--   typed bank(1), not soft-deleted. Nine accounts carry a mixed-case name and
--   none of them is a variant of 'slack'.
-- ============================================================================
--
-- WHAT THE BOUNDARY ACCOUNT IS
--
-- Every movement in this system has two legs. Some movements have only one real
-- account: a profit or loss on an investment, the opening of an account, the
-- deletion of one. The second leg goes to a per-user compensation account named
-- 'slack', created by the application and never by the owner. It is the point
-- where money enters or leaves the set of accounts the owner actually holds,
-- which is what 'boundary' names.
--
-- It has been typed 'bank' since it was introduced, and that is the defect this
-- migration closes. Typed 'bank' it is indistinguishable from a real bank
-- account in every aggregate that groups by type, so twenty-seven read filters
-- across the Overview and account modules exclude it by matching the literal
-- account name instead. A name is not a type, and every one of those filters is
-- one rename away from being wrong.
--
-- WHY THE ID IS WRITTEN OUT
--
-- account_type_id is declared INT PRIMARY KEY in 001_initial_migration.sql with
-- no SERIAL, so every id in this catalog was assigned by hand. 8 is stated here
-- rather than generated. realignCatalogSequences in populateDB.js covers
-- catalogs that own a sequence; this one does not.
--
-- WHY THE BACKFILL IS IN THIS FILE AND NOT A LATER ONE
--
-- A type with no rows in it is worse than no type at all. The whole purpose of
-- 'boundary' is to let a filter say account_type_id <> 8 instead of
-- account_name <> 'slack'. The first filter rewritten that way against an
-- unbackfilled catalog stops excluding the compensation account, silently, and
-- the figure it feeds is wrong with nothing on screen to say so. The type and
-- the rows that belong to it therefore arrive together, in one transaction.
--
-- WHY THE PREDICATE IS CASE-SENSITIVE
--
-- The twenty-seven read filters compare account_name to 'slack' case
-- sensitively. That comparison, and not the intent behind it, is what defines
-- the set of accounts the application currently treats as the boundary. An
-- account named 'Slack' is excluded by none of them, so today it is an ordinary
-- account of the owner's, and retyping it here would change what it means
-- without anyone having asked for that. This migration moves exactly the rows
-- the filters already exclude, and reports any near-miss instead of claiming it.
--
-- The near-miss is real and is not this file's to fix:
-- checkAndInsertAccount.js compares the name with LOWER() on both sides, so it
-- would hand back a 'Slack' account as the compensation account while the read
-- filters count it among the owner's. The NOTICE below names any such row.
--
-- WHAT THIS FILE DOES NOT CHANGE
--
-- The account name. All twenty-seven filters keep working through the retype
-- untouched, which is what makes this migration safe to apply before any of
-- them is rewritten, and its reverse exact.
--
-- THE OTHER BUILD PATH
--
-- populateDB.js:263-269 seeds this same catalog when the database is built by
-- initializeDatabase() at server start instead of through the chain. Row 8 is
-- added there in the same commit; leaving it behind would seed seven types on
-- one path and eight on the other. npm run db:parity compares the contents of
-- account_types and not only its schema (schemaParity.js:48), so it fails on a
-- missing seed rather than reporting green.
--
-- No boot-path DDL changes: this migration adds no column and no constraint.

-- UP ------------------------------------------------------------------------

-- The catalog row. Idempotent, and it refuses rather than overwrites: id 8 held
-- by another name means the assumption this file was measured under no longer
-- holds, and renaming somebody else's type to make room is not a migration.
DO $$
DECLARE
 name_at_8 text;
 id_of_boundary int;
BEGIN
 SELECT account_type_name INTO name_at_8
 FROM account_types WHERE account_type_id = 8;

 SELECT account_type_id INTO id_of_boundary
 FROM account_types WHERE account_type_name = 'boundary';

 IF name_at_8 IS NOT NULL AND name_at_8 <> 'boundary' THEN
  RAISE EXCEPTION
   'account_type_id 8 is already held by ''%''. This migration was measured on a catalog ending at 7 (cash), and the boot seed in populateDB.js writes 8 as well, so the id cannot be changed on one side only.',
   name_at_8;
 END IF;

 IF id_of_boundary IS NOT NULL AND id_of_boundary <> 8 THEN
  RAISE EXCEPTION
   'account type ''boundary'' already exists as id %, not 8. The backfill below writes 8 and would type the compensation accounts wrongly.',
   id_of_boundary;
 END IF;

 INSERT INTO account_types (account_type_id, account_type_name)
 VALUES (8, 'boundary')
 ON CONFLICT (account_type_id) DO NOTHING;
END $$;

-- The backfill. Soft-deleted rows are included on purpose: deleted_at is a
-- restorable state, and a restored account carrying the old type would be an
-- ordinary bank account holding a compensation account's balance.
DO $$
DECLARE
 candidate record;
 unexpected_type int;
 near_miss int;
 retyped int;
BEGIN
 SELECT count(*) INTO unexpected_type
 FROM user_accounts
 WHERE account_name = 'slack'
   AND account_type_id IS DISTINCT FROM 1
   AND account_type_id IS DISTINCT FROM 8;

 IF unexpected_type > 0 THEN
  RAISE EXCEPTION
   '% account(s) named ''slack'' carry a type other than bank(1) or boundary(8). Every compensation account this migration was measured against was typed bank; another type means something creates them by a path this file does not know, and that path has to be found before the rows are moved.',
   unexpected_type;
 END IF;

 SELECT count(*) INTO near_miss
 FROM user_accounts
 WHERE lower(account_name) = 'slack' AND account_name <> 'slack';

 IF near_miss > 0 THEN
  RAISE NOTICE
   '% account(s) named a case variant of ''slack'' are left untouched. The read filters do not exclude them, so they are the owner''s accounts, but checkAndInsertAccount.js matches case-insensitively and would return one as the compensation account. Reconcile by hand.',
   near_miss;
 END IF;

 FOR candidate IN
  SELECT account_id, user_id, account_balance, deleted_at
  FROM user_accounts
  WHERE account_name = 'slack' AND account_type_id = 1
  ORDER BY account_id
 LOOP
  RAISE NOTICE
   'retyping account % of user % to boundary (balance %, deleted_at %)',
   candidate.account_id, candidate.user_id,
   candidate.account_balance, candidate.deleted_at;
 END LOOP;

 -- updated_at is deliberately left alone. It records when the owner last
 -- changed the account, and nothing the owner can see has changed. The column
 -- carries no trigger (createTables.js:76), so it only moves if written here.
 UPDATE user_accounts
 SET account_type_id = 8
 WHERE account_name = 'slack' AND account_type_id = 1;

 GET DIAGNOSTICS retyped = ROW_COUNT;
 RAISE NOTICE '% account(s) retyped from bank to boundary', retyped;
END $$;

-- DOWN ----------------------------------------------------------------------
--
-- Run manually. Exact, and exact only because the account name was never
-- changed: the rows sent back to 'bank' are the same rows that came from it.
-- Compensation accounts created after this migration ran are included, which is
-- right -- 'bank' is the type they would have been given.
--
-- Order matters, and not for tidiness. user_accounts.account_type_id is
-- ON DELETE SET NULL (createTables.js:69), so deleting the catalog row while an
-- account still points at it does not fail: it blanks the type on that account
-- and leaves nothing behind to say what it was. Retype first, confirm the count
-- is zero, then delete.
--
--   SELECT count(*) FROM user_accounts WHERE account_type_id = 8;
--
-- BEGIN;
-- UPDATE user_accounts SET account_type_id = 1
--  WHERE account_name = 'slack' AND account_type_id = 8;
-- DELETE FROM account_types WHERE account_type_id = 8;
-- DELETE FROM migrations WHERE filename = '031_add_boundary_account_type.sql';
-- COMMIT;
