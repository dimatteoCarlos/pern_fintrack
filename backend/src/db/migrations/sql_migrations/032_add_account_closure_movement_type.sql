-- 032_add_account_closure_movement_type.sql
--
-- ============================================================================
-- Migration 032: adds 'account-closure' to movement_types and to
--   transaction_types, and rewrites the movement_types CHECK that would
--   otherwise reject it, so closing an account stops being recorded as profit
--   and loss.
-- Depends on: 001_initial_migration.sql, which declares movement_types and
--   transaction_types, and 005_base_catalogs.sql, which seeds their rows.
-- Measured before writing: fintrack_dev on 2026-09-06, inside a read-only
--   transaction. movement_types holds nine rows, 1 expense through 9 pnl, and
--   carries no check constraint at all. transaction_types holds five, 1
--   withdraw through 5 account-opening, also with no check constraint. In use:
--   expense 46 rows, income 8, debt 12, transfer 14, account-opening 39, pnl
--   20; investment, pocket and receive are seeded and unused. A parity build of
--   both paths on the same date reported exactly one constraint difference in
--   the entire schema, and it is the one this file rewrites.
-- ============================================================================
--
-- WHY THE VALUE IS NEEDED
--
-- Closing an account writes a settlement pair, and today both rows carry
-- movement_type_id 9, 'pnl'. So in any profit-and-loss report a closed account
-- is indistinguishable from a gain. What has to stay distinguishable is not the
-- account but the direction of the movement: 'account-opening' on the way in,
-- 'account-closure' on the way out. The name mirrors 'account-opening' exactly,
-- which is the convention PLAN_ACCOUNT_DELETION.md fixed rather than an
-- invention of this file.
--
-- No code writes the value on the day this lands, and one is scheduled to. The
-- settlement step of closing an account - the owner deciding whether the
-- residual balance is transferred to a named account or discarded, before the
-- account is marked closed - is the writer these two rows exist for, and it is
-- being built in deleteAccountService.js. The catalog and the constraint move
-- first so that writer has a value to reference rather than a second migration
-- to wait on.
--
-- WHAT THE NEW VALUE DOES TO THE READS THAT ALREADY EXIST, MEASURED
--
-- Nothing, and that is not luck. Every movement_type_id filter in the backend
-- is an explicit inclusion list - IN (1, 6) across the budget and overview
-- repositories, IN (6, 8) in overviewInvestmentRepository.js:58, and bare
-- equalities elsewhere. There is no NOT IN and no <> against this column
-- anywhere, so a tenth value is excluded from every existing report by the
-- shape of the code rather than by a site anyone has to remember.
--
-- The balance is the deliberate exception. derivedBalance.js sums every row of
-- an account except the single row that opens it, and the test is one row, not
-- one type: movement_type_id = 8 AND tr.account_id = tr.opening_for_account_id
-- (:153, :211, :236). A settlement written with movement type 10 therefore
-- moves the residual for real while appearing in no profit-and-loss figure,
-- which is the whole point of separating it from 'pnl'.
--
-- For whoever writes that settlement: name the id, do not inline it.
-- derivedBalance.js:52 exports ACCOUNT_OPENING_MOVEMENT_TYPE_ID = 8 as a named
-- constant pointing back at its catalog row, and that is the repo's idiom for
-- a catalog id used in a query.
--
-- THE ONE THING THAT MUST MOVE WITH THE WRITER, NOT WITH THIS FILE
--
-- Four overview reads currently identify a closure by its description rather
-- than its type, because until now it had no type of its own: they exclude rows
-- whose description carries the annulment prefix while bounded by
-- movement_type_id = 9 (overviewInvestmentRepository.js:71-72,
-- overviewMonthlyRepository.js:114, overviewTransactionRepository.js:136 and
-- :148). Adding the catalog value changes none of them, since no row carries
-- type 10 today. The day the settlement writer starts producing type 10, it
-- does: those rows leave the type-9 term by type while remaining inside the
-- derived balance, which sums every row of the account. A figure computed as a
-- share of the balance and a figure bounded by type 9 then stop agreeing.
--
-- The rule is an ordering constraint on the first write, not on this file: no
-- row carrying movement_type_id 10 may exist before INVESTMENT_FIGURES_QUERY
-- has an aggregate that counts it. Seeding the catalog cannot break the
-- identity, because the type has no rows; writing the first settlement can.
--
-- Stated as a rule rather than as an edit because the two branches are in
-- different states, measured 2026-09-06. main's query has two aggregates
-- explaining the balance, capital_contributed over movement types 6 and 8 and
-- realized_pnl over type 9 minus the annulment-prefixed rows; a third does not
-- exist there and has to be written and carried out through
-- getInvestmentFigures to the card. feat/overview has that third aggregate,
-- closure_adjustment, and its widening to types 9 and 10 is written but not
-- committed. So one of the two readers accounts for this type today and the
-- other has no term to widen. Neither is a switch from one type to the other:
-- rows already stored as type 9 do not migrate, so whatever counts closures
-- reads both types and keeps splitting on the description for the old ones.
-- Recorded against the two branches rather than against whoever happens to be
-- holding them.
--
-- One of those four is not an omission but a broken sum, and it is on main.
-- overviewInvestmentRepository.js publishes an accounting identity in its own
-- header at :5-9: capital contributed plus realised result equals the ledger
-- balance. The two explaining terms are bounded - contributions to movement
-- types 6 and 8 at :58, realised result to type 9 at :71 - while the balance
-- term is DERIVED_BALANCE at :28, which sums every row of the account except
-- the one that opens it. A closure written as type 10 therefore lands inside
-- the balance and inside neither term, and the card tells the owner their
-- figures do not add up while their money is fine.
--
-- The distinction is worth stating because the reasoning that says "every
-- filter is an inclusion list, so a new type is excluded everywhere" is true
-- and not sufficient. Exclusion is harmless for a plain sum over an enumerated
-- set, which is what budget's IN (1, 6) and the dashboard's pairs are. It is
-- not harmless for a reconciliation between an unbounded side and a bounded
-- one, which is what this card is.
--
-- Measured on main, and it already fails there today for a reason that has
-- nothing to do with this migration: the realised term at :72 also excludes
-- annulment-prefixed descriptions, so those rows are in the balance and in
-- neither term, exactly like a future closure. feat/overview added a third
-- closure_adjustment term to catch them (afbcb0b3, that branch alone). main has
-- the identity and no term that can ever account for either. So main is the
-- worse case, not the safer one, and whoever lands the writer coordinates with
-- whichever branch carries the card at that moment.
--
-- THE TWO SHAPES, AND WHY THIS IS NOT A ONE-LINE SEED
--
-- The two build paths disagree about this table, and only about this table. The
-- chain creates movement_types with no check constraint
-- (001_initial_migration.sql:36-39). The boot path creates it with an inline
-- CHECK listing all nine values (populateDB.js:422). A database built by the
-- boot path therefore rejects a tenth value that a database built by the chain
-- accepts, and until the parity tool was widened to read check constraints
-- neither the tool nor anyone else could see the difference.
--
-- So the constraint is discovered and dropped rather than named and dropped: on
-- a chain-built database there is nothing to drop, on a boot-built one there is
-- one with a generated name, and the same file has to survive both. The DO
-- block below loops over whatever check constraints exist on the table, which
-- is also what makes this migration safe to run twice.
--
-- WHY THE CHAIN ACQUIRES THE CONSTRAINT INSTEAD OF THE BOOT PATH LOSING IT
--
-- The two paths could equally have been reconciled by deleting the CHECK from
-- populateDB.js. They are not, because the constraint is worth having: this
-- catalog is read by name in application code, a value that is not in the list
-- is a typo rather than a feature, and the primary key does not catch it. The
-- path that had the weaker guarantee is the one that changes.
--
-- BOTH CATALOGS, NOT ONLY THE MOVEMENT TYPE
--
-- transaction_types already carries 'account-opening' as id 5. The closing
-- entry needs its counterpart there for the same reason the movement type needs
-- one, and leaving it out would mean a second migration against the same
-- concept. transaction_types has no check constraint on either path, so it
-- takes a row and nothing else.
--
-- Row 6 is not a guess about what the writer will want. The session building
-- the settlement engine confirmed it before this file landed: the settlement
-- transaction carries movement_type_id 10 AND transaction_type_id 6 together,
-- mirroring the account-opening pair 8+5, rather than reusing 'withdraw' or
-- 'deposit' on the transaction side.
--
-- What row 6 is actually for is worth stating, because searching the codebase
-- for transaction_type_id finds none of it and concludes the row is dead. Only
-- one file filters on that column at all, and it always pairs it with a
-- movement type the settlement will not carry
-- (dashboardMonthlyTotalAmountByType.js:125-127, :142-146). The consumers are
-- elsewhere, and they reach the catalog by NAME through a join:
--
--   - the transaction lists select transaction_type_name and render it
--     (dashboardController.js:779, :817, :949, :1068). A closure reusing
--     'deposit' is displayed to the owner as a deposit.
--   - the free-text search matches it (dashboardController.js:970), so a
--     closure is findable by typing "closure" only if that is its name.
--   - one filter reads the transaction type by name alone, not paired with any
--     movement type (dashboardController.js:1092).
--
-- So the row earns its place through what the owner sees and searches, not
-- through an id predicate. Without it the settlement would be indistinguishable
-- from a deposit in three places, which is the same defect as recording a
-- closure as profit and loss, one catalog over.
--
-- A vocabulary trap while this catalog is open, unrelated to the closure and
-- not fixed here: movement type 5 is 'pocket' in the catalog and labelled
-- 'saving' in dashboardMonthlyTotalAmountByType.js:127 and :146. Nothing is
-- broken, since the code reads the id, but the two names are one row.
--
-- THE OTHER BUILD PATH
--
-- populateDB.js changes in the same commit, in three places rather than one,
-- and the third is not optional. The value list in the CREATE TABLE at :422
-- gains the tenth value; movementTypeValues at :397-407 and
-- transactionTypeValues at :461-467 gain their rows; and both seeders gain
-- ON CONFLICT DO NOTHING, which they did not have.
--
-- That last one is a defect this change would otherwise trigger. Each seeder
-- decides whether the table is already populated by comparing its row count to
-- the number of rows the seeder writes, then inserts every row with a bare
-- INSERT. Adding a tenth movement type raises that threshold from nine to ten,
-- so a table holding the nine reads as unpopulated, the loop reinserts from the
-- first row, and the primary key rejects it.
--
-- Which databases that reaches is narrower than it looks, and still includes
-- the ordinary one. Both seeders run only inside the first-time block of
-- initializeDatabase (initDatabase.js:110-125), which is skipped once
-- app_initialization.tables_created is TRUE, so a long-lived local database
-- never re-enters them. What does enter them is a database whose tables exist
-- but whose app_initialization row does not - which is every chain-built
-- database on its first boot, because the chain does not create that table.
-- Migrate, then start the server, and the seeder meets nine rows and a
-- threshold of ten. tblAccountTypes already inserts ON CONFLICT DO NOTHING
-- (populateDB.js:306), which is why adding the boundary type in 031 was safe;
-- these two seeders never got the same treatment.

-- UP ------------------------------------------------------------------------

-- Discovered rather than named: the constraint exists only on a boot-built
-- database, under a name Postgres generated. Dropping whatever is there is also
-- what lets this file run twice without failing on its own constraint.
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

-- The value order matches populateDB.js:422 exactly. pg_get_constraintdef
-- renders an inline column CHECK and a named table CHECK identically, so the
-- two build paths compare equal only while both lists stay in this order.
ALTER TABLE movement_types
 ADD CONSTRAINT movement_types_movement_type_name_check
 CHECK (movement_type_name IN (
  'expense','income','investment','debt','pocket','transfer','receive',
  'account-opening','pnl','account-closure'));

INSERT INTO movement_types (movement_type_id, movement_type_name)
VALUES (10, 'account-closure')
ON CONFLICT (movement_type_id) DO NOTHING;

INSERT INTO transaction_types (transaction_type_id, transaction_type_name)
VALUES (6, 'account-closure')
ON CONFLICT (transaction_type_id) DO NOTHING;

-- DOWN ----------------------------------------------------------------------
--
-- Run manually, and read this first, because the reverse is not symmetric.
--
-- The two DELETEs fail rather than cascade if anything already references the
-- new rows: transactions.movement_type_id and transactions.transaction_type_id
-- are both ON DELETE RESTRICT (createTables.js:169-172). That is the correct
-- outcome and needs no help here - once a closure has been recorded, this
-- migration is not reversible and should not be made so.
--
-- The constraint cannot be restored correctly without knowing where the
-- database came from, and nothing in the schema records that. A boot-built
-- database had the nine-value CHECK before this ran and should get it back. A
-- chain-built one had none and should be left without one. Restoring the wrong
-- one is silent: the database keeps working and the next parity run reports a
-- difference nobody introduced. Decide by checking whether the migrations
-- ledger predates this file, and if that is unclear, leave the ten-value
-- constraint in place - it is a superset of the nine and rejects nothing the
-- old one accepted.
--
-- BEGIN;
-- DELETE FROM transaction_types WHERE transaction_type_id = 6;
-- DELETE FROM movement_types WHERE movement_type_id = 10;
-- ALTER TABLE movement_types
--  DROP CONSTRAINT movement_types_movement_type_name_check;
-- -- boot-built databases only, skip on a chain-built one:
-- -- ALTER TABLE movement_types
-- --  ADD CONSTRAINT movement_types_movement_type_name_check
-- --  CHECK (movement_type_name IN (
-- --   'expense','income','investment','debt','pocket','transfer','receive',
-- --   'account-opening','pnl'));
-- DELETE FROM migrations
--  WHERE filename = '032_add_account_closure_movement_type.sql';
-- COMMIT;
