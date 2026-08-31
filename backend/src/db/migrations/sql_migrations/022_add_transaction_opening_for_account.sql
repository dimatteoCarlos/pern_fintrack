-- 022_add_transaction_opening_for_account.sql
--
-- Makes an opening row say WHICH account it opens, instead of leaving the
-- derivation to infer it from the direction the money moved.
--
-- WHAT IS WRONG TODAY
--
-- The canonical balance derivation adds an account's movements to its
-- account_starting_amount, and must skip that account's own opening row or the
-- opening is counted twice. It identifies that row by testing
-- account_id = destination_account_id, written identically in all three
-- builders: derivedBalance.js:142, :200 and :225.
--
-- That test is a proxy for "this row opens this account", and it holds only
-- while the opening money flows TOWARD the account being opened. Funding an
-- account writes a PAIR of rows, and both legs of a pair carry the SAME
-- destination, so the test cannot tell one leg from the other — it simply picks
-- whichever leg's account happens to equal that shared destination.
--
-- For a debtor the user LENT to, that is the debtor's own leg, which is right.
-- For a debtor the user OWES, the debtor is the source and the funding account
-- is the destination, so the test picks the funding leg and the proxy inverts.
--
-- Measured against fintrack_dev, the pair that opens the one such debtor:
--
--   tx 156  account 54  destination 15  amount -6.24   NOT excluded, must be
--   tx 157  account 15  destination 15  amount +6.24   excluded, must not be
--
-- Both are wrong, in opposite directions, from the same test. Account 54 counts
-- its opening twice and derives -12.48 against a starting amount of -6.24, and
-- the funding account silently loses a real 6.24 inflow.
--
-- WHY A COLUMN AND NOT A BETTER TEST
--
-- Every alternative discriminator is another proxy. Matching the row whose
-- amount equals account_starting_amount breaks on two openings of equal value;
-- taking the earliest opening row per account breaks on an account that has
-- none. The destination proxy has already failed once on a shape nobody
-- anticipated, and the next shape breaks the next proxy. The row is written by
-- a controller that knows exactly which account it is opening, so it can state
-- it rather than encode it in a pattern to be decoded later.
--
-- NOTHING READS THIS COLUMN YET
--
-- This file only adds and backfills it. The derivation keeps its current test
-- until the creation controllers write the column on new rows; flipping the
-- read first would leave every account created in between with a NULL marker
-- and its opening counted twice. Read and write change together, in one commit,
-- after this one.
--
-- ---------------------------------------------------------------------------
-- UP
-- ---------------------------------------------------------------------------
--
-- Nullable on purpose, and it stays nullable. Most transactions are not opening
-- rows, and NOT NULL would be a lie about the column's meaning. NULL reads as
-- "this row opens no account", which is true of every ordinary movement and of
-- every funding leg.
--
-- ON DELETE RESTRICT ON UPDATE CASCADE matches the three account foreign keys
-- migration 018 established on this same table. It adds no restriction that is
-- not already in force: transactions.account_id already restricts the delete of
-- any account this column could point at, so no deletion that succeeds today
-- starts failing because of this.
ALTER TABLE transactions
 ADD COLUMN IF NOT EXISTS opening_for_account_id INTEGER
  REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- The backfill. Marks, for each account, the single row that opens it.
--
-- Identified by BOTH conditions together, because neither alone is sound: the
-- row must be the earliest opening row carrying that account, AND its amount
-- must equal the account's starting amount. The first alone marks a funding leg
-- on an account that has no opening row of its own; the second alone marks a
-- funding leg that happens to move the starting amount.
--
-- The movement type is read from the catalog by name rather than written as 8,
-- so this file does not encode a seeded id.
--
-- Measured against fintrack_dev before writing: 27 rows marked, one per
-- account, no account matched twice, and no account with a nonzero starting
-- amount was left unmarked. The 6 rows left NULL are all funding legs. One
-- account is left with no marked row because it has no opening row at all; its
-- starting amount is 0.00, so nothing is double counted by the NULL.
UPDATE transactions tr
SET opening_for_account_id = tr.account_id
FROM user_accounts ua
WHERE ua.account_id = tr.account_id
 AND tr.movement_type_id = (
  SELECT mt.movement_type_id FROM movement_types mt
  WHERE mt.movement_type_name = 'account-opening'
 )
 AND tr.amount = ua.account_starting_amount
 AND tr.transaction_id = (
  SELECT MIN(t2.transaction_id) FROM transactions t2
  WHERE t2.account_id = tr.account_id
   AND t2.movement_type_id = (
    SELECT mt.movement_type_id FROM movement_types mt
    WHERE mt.movement_type_name = 'account-opening'
   )
 );

-- An account is opened once. Enforced rather than assumed, so a second opening
-- row for the same account fails loudly at write time instead of quietly
-- subtracting itself from that account's balance forever — which is the failure
-- mode this whole file exists to remove.
--
-- Partial, so the NULLs are not indexed: they are the overwhelming majority of
-- the table and they carry no meaning to enforce.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_opening_for_account
 ON transactions (opening_for_account_id)
 WHERE opening_for_account_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
--
-- Fully reversible, and it destroys no financial data. The UP adds a column,
-- fills it from rows that already existed, and indexes it. Dropping the column
-- drops the index with it and leaves every amount, date and account untouched.
-- What is lost is the marking, which this same file recomputes.
--
-- Reverse only while nothing reads the column. Once the derivation and the
-- creation controllers are switched over, dropping this puts every account's
-- opening back to being inferred, and the debtor shape above breaks again.
--
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- DROP INDEX IF EXISTS uq_transaction_opening_for_account;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS opening_for_account_id;
-- DELETE FROM migrations WHERE filename = '022_add_transaction_opening_for_account.sql';
-- COMMIT;
