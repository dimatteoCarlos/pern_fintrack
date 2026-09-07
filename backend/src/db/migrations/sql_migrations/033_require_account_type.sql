-- 033_require_account_type.sql
--
-- ============================================================================
-- Migration 033: makes user_accounts.account_type_id NOT NULL and changes its
--   foreign key from ON DELETE SET NULL to ON DELETE RESTRICT, so an account
--   can no longer exist without a type and deleting a catalog row fails
--   instead of silently blanking the accounts that use it.
-- Depends on: 001_initial_migration.sql, which declares user_accounts and
--   account_types, and 031_add_boundary_account_type.sql, which added the
--   eighth type and typed the compensation account with it.
-- Measured before writing: fintrack_dev on 2026-09-07, read-only.
--   user_accounts holds 31 rows and exactly zero carry a NULL
--   account_type_id, so SET NOT NULL rewrites no data and needs no backfill.
--   The column is nullable ('YES' in information_schema.columns). One foreign
--   key covers it, user_accounts_account_type_id_fkey, with confdeltype 'n'
--   (SET NULL) and confupdtype 'c' (CASCADE). account_types holds eight rows;
--   six are referenced - bank 4, investment 3, debtor 5, category_budget 17,
--   income_source 1, boundary 1 - and two are seeded and unreferenced,
--   pocket_saving and cash.
-- ============================================================================
--
-- WHY THE COLUMN IS CLOSED
--
-- An account with no type is not a state the application can act on. Every
-- read that groups, filters or totals by type drops such a row silently, and
-- every write that creates an account supplies a type, so the nullable column
-- describes no reachable state - it only describes what the schema would do to
-- existing rows if a catalog row were deleted. Closing it moves that outcome
-- from silent data loss to a failed statement.
--
-- The two halves are one change and not two. NOT NULL alone would leave
-- ON DELETE SET NULL able to violate it: deleting a referenced catalog row
-- would attempt to write NULL into a NOT NULL column and fail with a
-- confusing error about the column rather than about the catalog. RESTRICT
-- alone would leave the column open to a NULL that no writer produces but no
-- constraint forbids. Together they say one thing: the type is part of what an
-- account is.
--
-- WHAT RESTRICT ACTUALLY CHANGES TODAY
--
-- Nothing, and that is deliberate. No code path in the backend deletes from
-- account_types: the only DELETE statements against that table in the whole
-- repository are commented out, one in a scratch queries document and one in
-- the DOWN section of 031. So the new behaviour is entirely prospective - it
-- constrains a future writer rather than fixing a present defect. A migration
-- whose effect is prospective should say so, because a reader who assumes it
-- fixed something will look for the symptom it fixed and find none.
--
-- IT INVERTS THE DOWN SECTION OF 031, WHICH CANNOT BE EDITED
--
-- 031's rollback notes cite createTables.js:69 to justify their ordering and
-- state that deleting the account_types row for 'boundary' "does not fail: it
-- blanks the type on that account". That was true when 031 was written and is
-- false the moment this file runs: the compensation account references type 8,
-- so the DELETE now raises a foreign key violation instead. 031 is applied and
-- an applied migration is not edited, prose included, so the correction is
-- recorded here, in the file that causes it.
--
-- The consequence for anyone rolling 031 back after this: run this file's DOWN
-- section first, or delete the referencing account, or the rollback stops on
-- its first statement. That is the correct outcome - it refuses rather than
-- quietly untyping an account - but it is not what 031 tells the operator to
-- expect.
--
-- The same applies to the line anchor itself. createTables.js:69 is the
-- declaration this migration's runtime counterpart rewrites, so after this
-- lands, 031's citation resolves to a line saying the opposite of what 031
-- says it says.
--
-- THE DEFENSIVE JOINS THIS RETIRES, AND WHY NOT HERE
--
-- Two committed sites work around the nullable column with a LEFT JOIN where
-- an inner join would read more plainly, and one of them names this migration
-- by number in its own comment. Both become retirable when this lands. Neither
-- is touched here: a file that changes a column constraint AND rewrites join
-- semantics across several files and owners is two logical changes, and if a
-- figure moves afterwards nobody can say which half moved it. They retire in
-- their owners' own commits, after this one.
--
-- A CLASS OF SITE THIS MAKES VISIBLE
--
-- Worth recording because 031 produced an instance of it and the shape is not
-- obvious from the application side. A site can be correct before a migration
-- and correct after it, comparing both halves of an identity exactly as the
-- rule requires, and still break - because one half of that identity changed
-- underneath a hardcoded literal that the site never questioned. Nothing about
-- the site is wrong at either moment. The defect exists only in the transition,
-- and only the migration that causes the transition is positioned to see it.
-- The check that finds it is not "does this site still compile" but "which
-- sites compare against a literal I am about to redefine".
--
-- ============================================================================

-- UP ------------------------------------------------------------------------

ALTER TABLE user_accounts
 ALTER COLUMN account_type_id SET NOT NULL;

-- The constraint is found rather than named. Postgres generated the current
-- name, and a database built by the boot DDL generates it from the same column
-- and table, so both paths carry the same one today - but a name that is
-- assumed rather than looked up is a name that fails silently on the one
-- database where it differs.
DO $$
DECLARE
 existing text;
BEGIN
 SELECT con.conname INTO existing
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att
   ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
  WHERE rel.relname = 'user_accounts'
   AND con.contype = 'f'
   AND att.attname = 'account_type_id';

 IF existing IS NULL THEN
  RAISE EXCEPTION 'no foreign key found on user_accounts.account_type_id';
 END IF;

 EXECUTE format('ALTER TABLE user_accounts DROP CONSTRAINT %I', existing);
 RAISE NOTICE 'dropped foreign key % on user_accounts.account_type_id', existing;
END $$;

-- Re-added under the name Postgres would have generated, so the two build
-- paths compare equal: schemaParity reads constraint names, and a hand-picked
-- name here would report a difference on every run that nobody introduced.
ALTER TABLE user_accounts
 ADD CONSTRAINT user_accounts_account_type_id_fkey
 FOREIGN KEY (account_type_id) REFERENCES account_types (account_type_id)
 ON DELETE RESTRICT ON UPDATE CASCADE;

-- DOWN ----------------------------------------------------------------------
--
-- Run manually. Reversing is safe here in a way 031's reversal is not: this
-- file wrote no rows, so nothing depends on the new state having existed.
-- Dropping NOT NULL cannot fail, and widening RESTRICT back to SET NULL cannot
-- fail either - both accept every row the stricter version accepted.
--
-- What it does not restore is the reason. Any site that retired its defensive
-- LEFT JOIN because this landed will be reading a column that can be NULL
-- again, and those sites are in other files with other owners. Reverse this
-- only together with them.
--
-- BEGIN;
-- ALTER TABLE user_accounts
--  ALTER COLUMN account_type_id DROP NOT NULL;
-- ALTER TABLE user_accounts
--  DROP CONSTRAINT user_accounts_account_type_id_fkey;
-- ALTER TABLE user_accounts
--  ADD CONSTRAINT user_accounts_account_type_id_fkey
--  FOREIGN KEY (account_type_id) REFERENCES account_types (account_type_id)
--  ON DELETE SET NULL ON UPDATE CASCADE;
-- DELETE FROM migrations WHERE filename = '033_require_account_type.sql';
-- COMMIT;
