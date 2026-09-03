-- 025_email_case_insensitive_unique.sql
--
-- Makes the email address unique regardless of case, with the unique index
-- users_email_lower_key on lower(email).
--
-- THE DEFECT THIS CLOSES
--
-- users_email_key is a plain UNIQUE on the column, so 'Carlos@Mail.com' and
-- 'carlos@mail.com' are two different values and both become accounts. Sign-in
-- does not agree with that: authController.js:240-245 matches with
-- lower(identity column) = lower($1), so once the second account exists the
-- query can return either row and the owner reaches whichever one it picks.
--
-- The application already expects this index. authController.js:199-204 reads a
-- 23505 and maps two constraint names to the same answer, the plain
-- users_email_key and this file's users_email_lower_key, and it names the
-- migration that adds the second one.
--
-- WHY AN EXPRESSION INDEX AND NOT A NORMALIZED COLUMN
--
-- Lowering the stored address changes what the owner typed, and the local part
-- of an address is case sensitive in the standard even though no mail provider
-- in use treats it that way. The index folds the comparison and leaves the value
-- as the owner wrote it, which is also what the sign-in query already does.
--
-- WHY THE FILE STARTS BY MEASURING
--
-- CREATE UNIQUE INDEX fails on a table that already holds two addresses
-- differing only in case, and the driver's message names neither of them. Two
-- accounts cannot be merged by a migration: which one keeps the transactions is
-- a decision about a person's data. So the check runs first and reports the
-- addresses in the failure, and the resolution is manual.
--
-- Measured before writing this file: the development database holds one user and
-- no folded duplicate. Run the same query on any other database before applying:
--
--   SELECT lower(email), COUNT(*) FROM users GROUP BY lower(email)
--   HAVING COUNT(*) > 1;
--
-- ---------------------------------------------------------------------------
-- UP
-- ---------------------------------------------------------------------------
--
-- The runner wraps the file in one transaction, so a failure here leaves no
-- index and no ledger row.
DO $$
DECLARE
  collisions TEXT;
BEGIN
  SELECT string_agg(folded, ', ')
    INTO collisions
    FROM (
      SELECT lower(email) AS folded
        FROM users
       GROUP BY lower(email)
      HAVING COUNT(*) > 1
    ) AS duplicated;

  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot fold email uniqueness: these addresses exist more than once ignoring case: %. Decide which account survives before running this migration.',
      collisions;
  END IF;
END
$$;

-- The column is NOT NULL on both build paths, 002_accounts.sql:25 and the users
-- entry of mainTables in createTables.js, so every row carries a value and the
-- index covers the whole table. createTables.js declares the same index, so a
-- database built from empty is protected the same way.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
--
-- Dropping the index cannot fail and loses no data. The plain users_email_key
-- stays in place, so the column keeps its exact-match uniqueness.
--
-- BEGIN;
-- DROP INDEX IF EXISTS users_email_lower_key;
-- DELETE FROM migrations WHERE filename = '025_email_case_insensitive_unique.sql';
-- COMMIT;
