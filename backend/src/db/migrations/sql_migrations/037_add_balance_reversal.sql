-- 037_add_balance_reversal.sql
--
-- ============================================================================
-- Migration 037: adds 'balance-reversal' to movement_types and to
--   transaction_types, rewrites the movement_types CHECK that would otherwise
--   reject it, and adds transactions.reversal_of_account_id keyed on
--   account_registry - so the operation that neutralises an account's balance
--   before closing it is identified by a column rather than by its description.
-- Depends on: 032_add_account_closure_movement_type.sql, which established the
--   eleventh value's constraint shape and seeded the tenth; and
--   035_create_account_registry.sql, which creates the table the new column
--   references.
-- Measured before writing, on the code rather than on a database: no file in
--   backend/src writes movement_type_id 11 today, and no column named
--   reversal_of_account_id exists on any path.
-- ============================================================================
--
-- WHAT THE OPERATION IS
--
-- An account whose type is in CLOSE_ZERO_BALANCE_TYPES
-- (deleteAccountService.js:68-73 - bank, cash, investment, debtor) can only be
-- closed at zero. The owner is offered one action for a balance that blocks it:
-- reverse the balance and close, in that order and in one transaction. FinTrack
-- computes the amount as -currentBalance; the owner chooses no destination, no
-- amount, no date and no method.
--
-- ONE OPERATION, TWO LEDGER LEGS. The books are double entry, so the reversal
-- posts the leg on the target account and the leg on the compensation account.
-- Both legs carry movement type 11 and both carry the new column naming the
-- same account. What is identified structurally is the operation, not a leg.
--
-- WHY A COLUMN AND NOT THE DESCRIPTION
--
-- The existing annulment is identified by a text prefix, and five overview
-- predicates match it with LIKE 'RTA Annulment Target(%'. That identity sits on
-- rewritable text: the deletion path rewrites descriptions with REPLACE to
-- scrub a deleted account's name out of them, so a name that is a substring of
-- the prefix literal corrupts the identity of a row that has nothing to do with
-- that account. A column cannot be rewritten by a text substitution.
--
-- WHY IT REFERENCES account_registry AND NOT user_accounts
--
-- The row it names is deleted moments later, in the same transaction: CLOSE
-- deletes the user_accounts row and keeps the account_registry row under the
-- same account_id. A key into the live table would either refuse that delete or
-- be nulled by it, and in both cases the reversal stops saying which account it
-- reversed. Every other key into a closed account was repointed to the registry
-- by migration 035 for exactly this reason; this one is born there.
--
-- reversal_of_account_id, not reversal_of_transaction_id. The operation does
-- not say "this transaction was annulled", it says "this account's position was
-- neutralised so it could be removed". There is no original transaction for it
-- to point at.
--
-- THE CHECK MAKES THE PAIRING STRUCTURAL RATHER THAN REMEMBERED
--
-- transactions.status is the cautionary case, one column over: it is a bind in
-- a shared writer whose callers each supply their own value
-- (recordTransaction.js:100 names it fourth against VALUES($1..$19)), so there
-- is no single point in the code where its legal set can be stated. The same
-- would be true of this column. The biconditional below states it once, in the
-- only place every writer passes through:
--
--   a row carries movement type 11 exactly when it names a reversed account.
--
-- It forbids both halves of the failure. A reversal leg written without the
-- column would be a reversal nothing can find; a non-reversal row carrying the
-- column would be a row claiming to be part of an operation it is not in.
--
-- IT IS TWO-VALUED, AND THAT DEPENDS ON A FACT WORTH STATING RATHER THAN
-- ASSUMING. movement_type_id is INTEGER NOT NULL on both build paths -
-- 003_transactions.sql:24 and createTables.js:170 - so `movement_type_id = 11`
-- is never NULL and the equality is a real biconditional. Were that column ever
-- made nullable, this CHECK would evaluate to NULL on such a row and a CHECK
-- passes on NULL: the constraint would go on being reported as present while
-- enforcing nothing on exactly the rows nobody looked at.
--
-- WHAT THE NEW TYPE DOES TO THE READS THAT ALREADY EXIST, MEASURED
--
-- Nothing on the day this lands, because nothing writes it yet, and the same
-- reasoning migration 032 recorded holds: every movement_type_id filter in the
-- backend is an explicit inclusion list, and there is no NOT IN and no <>
-- against the column anywhere.
--
-- ONE READER IS THE DELIBERATE EXCEPTION, AND IT IS THE SAME ONE 032 NAMED.
-- overviewInvestmentRepository.js publishes an accounting identity in its own
-- header at :8 - capital contributed plus realised result plus closure
-- adjustment equals the ledger balance - and makeInvestmentCard.js:136-139
-- asserts it, pushing UNRECONCILED_BALANCE_NOTICE at :141 when it fails. The
-- balance side is DERIVED_BALANCE, which sums every row of the account except
-- the one that opens it. The explaining terms are bounded by type: capital to
-- movement types 6 and 8, and realised/closure to IN (9, 10) at the outer WHERE
-- of the `realized` CTE, with closure_adjustment filtered to
-- `movement_type_id = 10 OR description LIKE 'RTA Annulment Target(%'`.
--
-- investment IS IN CLOSE_ZERO_BALANCE_TYPES, so a reversal will land on an
-- investment account. A type 11 row is then inside the balance and inside no
-- explaining term, and the card tells the owner their figures do not add up
-- while their money is fine.
--
-- THE RULE IS AN ORDERING CONSTRAINT ON THE FIRST WRITE, NOT ON THIS FILE. No
-- row carrying movement_type_id 11 may exist before closure_adjustment counts
-- it - both in its FILTER and in the outer WHERE that bounds the CTE, since
-- widening only the filter changes nothing. Seeding the catalog cannot break
-- the identity, because the type has no rows; writing the first reversal can.
--
-- overviewInvestmentRepository.js belongs to the overview module and the edit
-- is routed there rather than made here. Recorded in this file because this is
-- what a future reader opens when asking why type 11 exists.
--
-- THE TWO SHAPES, AND THE OTHER BUILD PATH
--
-- The movement_types constraint is discovered and dropped rather than named and
-- dropped, for the reason migration 032 gives at length: a chain-built database
-- has no check on this table and a boot-built one has one under a generated
-- name, and the same file has to survive both. That is also what makes this
-- file safe to run twice.
--
-- createTables.js and populateDB.js change in the same commit. The value list
-- in populateDB.js's CREATE TABLE gains the eleventh value, both catalog
-- seeders gain their row, and createTables.js gains ensureBalanceReversal() -
-- the runtime counterpart, which an already-created database needs because the
-- table DDL above it is CREATE TABLE IF NOT EXISTS and never runs again.
--
-- THE COLUMN CANNOT BE DECLARED IN THE TABLE DDL ON THE BOOT PATH, and that is
-- not an oversight. transactions is created before account_registry exists
-- there - the registry arrives from ensureAccountRegistry() - so an inline
-- REFERENCES account_registry in mainTables would fail on a virgin database.
-- The runtime step adds it after, which is the same shape
-- ensureTransactionOpeningFor() already uses for migration 022's column.

-- UP ------------------------------------------------------------------------

-- Discovered rather than named: the constraint exists only on a boot-built
-- database, under a name Postgres generated.
DO $$
DECLARE
 existing text;
BEGIN
 FOR existing IN
  SELECT con.conname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public'
    AND rel.relname = 'movement_types'
    AND con.contype = 'c'
 LOOP
  EXECUTE format('ALTER TABLE movement_types DROP CONSTRAINT %I', existing);
  RAISE NOTICE 'dropped check constraint % on movement_types', existing;
 END LOOP;
END $$;

-- The value order matches populateDB.js exactly. pg_get_constraintdef renders
-- an inline column CHECK and a named table CHECK identically, so the two build
-- paths compare equal only while both lists stay in this order.
ALTER TABLE movement_types
 ADD CONSTRAINT movement_types_movement_type_name_check
 CHECK (movement_type_name IN (
  'expense','income','investment','debt','pocket','transfer','receive',
  'account-opening','pnl','account-closure','balance-reversal'));

INSERT INTO movement_types (movement_type_id, movement_type_name)
VALUES (11, 'balance-reversal')
ON CONFLICT (movement_type_id) DO NOTHING;

INSERT INTO transaction_types (transaction_type_id, transaction_type_name)
VALUES (7, 'balance-reversal')
ON CONFLICT (transaction_type_id) DO NOTHING;

-- Nullable, and NULL is the ordinary answer: it reads as "this row is not part
-- of a reversal", which is true of every movement written so far.
--
-- RESTRICT rather than CASCADE or SET NULL. A registry row is never deleted by
-- any path in this codebase - it is what survives the account - so the clause
-- is a statement about what may not happen rather than a behaviour anyone will
-- observe. SET NULL would silently unname the reversed account; CASCADE would
-- delete accounting rows.
ALTER TABLE transactions
 ADD COLUMN IF NOT EXISTS reversal_of_account_id INTEGER
  REFERENCES account_registry(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Both halves, as one biconditional. A reversal leg without the column is a
-- reversal nothing can find; a non-reversal row carrying it claims membership
-- in an operation it is not in. Existing rows satisfy it: every one carries a
-- movement type other than 11 and NULL in the new column.
ALTER TABLE transactions
 DROP CONSTRAINT IF EXISTS transactions_reversal_pairing_check;

ALTER TABLE transactions
 ADD CONSTRAINT transactions_reversal_pairing_check
 CHECK ((movement_type_id = 11) = (reversal_of_account_id IS NOT NULL));

-- The reversal legs of one account, and the lookup the close screen and any
-- audit of a closed account run. Partial, because the column is NULL on every
-- other row and indexing those buys nothing.
CREATE INDEX IF NOT EXISTS idx_transactions_reversal_of_account
 ON transactions (reversal_of_account_id)
 WHERE reversal_of_account_id IS NOT NULL;

-- DOWN ----------------------------------------------------------------------
--
-- Run manually, and read this first, because the reverse is not symmetric.
--
-- Dropping the column DESTROYS the identity of every reversal already written.
-- The rows survive as movement type 11 with nothing saying which account they
-- reversed, and no later migration can reconstruct it - the account row they
-- named is gone, which is the whole reason the column exists. Check for rows
-- before running any of this:
--
--   SELECT count(*) FROM transactions WHERE reversal_of_account_id IS NOT NULL;
--
-- If that is not zero, this migration is not reversible and should not be made
-- so. The two catalog DELETEs will refuse on their own - movement_type_id and
-- transaction_type_id are both ON DELETE RESTRICT - but the column drop will
-- not refuse, and it is the one that loses information.
--
-- The movement_types constraint cannot be restored correctly without knowing
-- where the database came from, and nothing in the schema records that. Migration
-- 032's DOWN block states the rule; the same applies here one value up.
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_transactions_reversal_of_account;
-- ALTER TABLE transactions
--  DROP CONSTRAINT IF EXISTS transactions_reversal_pairing_check;
-- ALTER TABLE transactions DROP COLUMN reversal_of_account_id;
-- DELETE FROM transaction_types WHERE transaction_type_id = 7;
-- DELETE FROM movement_types WHERE movement_type_id = 11;
-- ALTER TABLE movement_types
--  DROP CONSTRAINT movement_types_movement_type_name_check;
-- ALTER TABLE movement_types
--  ADD CONSTRAINT movement_types_movement_type_name_check
--  CHECK (movement_type_name IN (
--   'expense','income','investment','debt','pocket','transfer','receive',
--   'account-opening','pnl','account-closure'));
-- DELETE FROM migrations WHERE filename = '037_add_balance_reversal.sql';
-- COMMIT;
