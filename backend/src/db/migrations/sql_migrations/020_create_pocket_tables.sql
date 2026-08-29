-- 020_create_pocket_tables.sql
--
-- Turns a pocket from an account that holds money into a savings plan that
-- commits money staying in the real account.
--
-- Today a pocket IS a user_accounts row of type 'pocket_saving'. Funding one
-- writes two transactions and moves both balances, so the funding bank's
-- account_balance stops being the balance its statement shows and the same
-- money is counted twice on the dashboard. This migration creates the two
-- tables that replace that model — pockets, the plan, and pocket_allocations,
-- the append-only ledger of what each account has committed to which plan —
-- and then dismantles the accounts that impersonated pockets.
--
-- An allocation never moves money. It is a claim over money that stays where it
-- is, so nothing in this file writes a transaction and nothing below creates an
-- allocation: pocket_allocations is created empty and the owner fills it.
--
-- MEASURED AGAINST PRODUCTION 2026-08-24, read-only, four counts all zero:
-- user_accounts with account_type_id = 4, rows in pocket_saving_accounts,
-- debtor_accounts pointing at a pocket, and transactions with
-- movement_type_id = 5. The owner deleted the last pocket account through the
-- app's own deletion path that day, which restored the 90.00 to CASH and left a
-- readable annulment transaction behind. Against production only step 1 below
-- does anything.
--
-- Steps 2 to 5 stay written and stay in this order anyway: local and rehearsal
-- databases still hold pocket accounts, and a migration whose data steps are
-- omitted because production happens to be empty is one that corrupts the first
-- environment that is not. Each is a set operation over whatever it finds, zero
-- rows is a legitimate result, and each reports the count it acted on.
--
-- What this file deliberately does NOT do:
--  * it does not rename or drop pocket_saving_accounts. Three live endpoints
--    still join it (getAccountController.js:341 and :640,
--    accountEditController.js:292); an empty table costs nothing and dropping it
--    here breaks them on the day the migration runs. It is dropped by a cleanup
--    migration, last.
--  * it does not remove or rename 'pocket_saving' in account_types. Every record
--    written before this file carries account_type_id = 4 meaning "pocket", and
--    restating the catalog row silently restates all of that history.
--  * it does not put SUM(allocations) <= account_balance in a CHECK. That rule
--    is a precondition of allocating only, and a CHECK would block the insert of
--    a real expense. Over-allocation is a state the app reports, not an error the
--    database refuses.
--  * it does not infer what a funding movement meant. See step 3.
--
-- No BEGIN/COMMIT here, as in 011, 014, 015, 017 and 018. runMigrations.js
-- already wraps each file in a transaction together with its INSERT INTO
-- migrations. A COMMIT inside the file closes that transaction early and leaves
-- the bookkeeping row outside it.
--
-- H13: both tables are defined twice, here and in
-- run_time_db_init/createTables.js, and production builds through the runtime
-- path. They enter both in the same commit or production never gets them.

-- UP

-- ---------------------------------------------------------------------------
-- STEP 1 — the two new tables.
-- ---------------------------------------------------------------------------

-- No state column. active, funded and overdue are all derived from
-- target_amount, desired_date and the ledger; a pocket that no longer applies is
-- deleted. A stored state a query can also derive is the defect
-- 010_create_budget_tables.sql rejected when it refused a current-flag.
--
-- currency_id is the accounting currency, the one target_amount is expressed in.
-- The six origin columns record what the owner actually typed, with the rate
-- that produced the stored figure, its provider and its timestamp. Every account
-- in this database is kept in the one accounting currency, so that pair is an
-- audit trail proving the conversion ran — never a second unit to do arithmetic
-- in. Same treatment as 007 on transactions and 014/015/016/017 here.
--
-- desired_date is NOT NULL and means one thing: the date by which the target is
-- meant to be fully allocated. It is not the date the money will be spent.
-- desired_date_source, added by 018, does not carry over: with the field
-- required on the form there is nothing for the server to invent, so the column
-- would hold one value and state no fact.
--
-- No unique constraint on (user_id, name). Two goals may legitimately share a
-- name, nothing joins a pocket by name, and rejecting a rename for a reason the
-- owner cannot see is worse than a duplicate label.
CREATE TABLE IF NOT EXISTS pockets (
 pocket_id      SERIAL PRIMARY KEY,
 user_id        UUID NOT NULL
  REFERENCES users(user_id) ON DELETE CASCADE,
 name           VARCHAR(50)  NOT NULL,
 note           VARCHAR(155),
 target_amount  DECIMAL(15,2) NOT NULL CHECK (target_amount > 0),
 currency_id    INT NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 desired_date   DATE NOT NULL,

 -- FX audit pair: what was typed, in which currency, and the rate between them.
 original_target                   DECIMAL(15,2) NOT NULL,
 original_currency_id              INT NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 exchange_rate                     DECIMAL(20,10) NOT NULL CHECK (exchange_rate > 0),
 exchange_rate_source              VARCHAR(50)   NOT NULL,
 exchange_rate_timestamp           TIMESTAMPTZ   NOT NULL,
 exchange_rate_target_currency_id  INT NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,

 created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The ledger. amount is signed: a release is a negative row, and CHECK
-- (amount <> 0) because a zero row states nothing and would show in the history
-- as an event that did not happen.
--
-- Append-only, and there is no updated_at because of it: a row is never edited
-- and never deleted. +300 becomes +250 by writing -50. No repository gets an
-- UPDATE or a DELETE path on this table.
--
-- allocation_actual_date is not created_at and both are needed. created_at
-- records when the row was written; allocation_actual_date records when the
-- decision was taken, and a set-aside agreed on Friday and typed on Monday
-- belongs to Friday. transactions already separates the two the same way
-- (003_transactions.sql:55-56); this column copies that convention, NOT NULL
-- where the original is nullable. Every screen renders this date, never
-- created_at.
--
-- One accounting amount, not two. user_accounts.currency_id is NOT NULL and
-- every account is kept in the one accounting currency, so the pocket's total
-- and the account's total read the same column in the same unit — one piece of
-- arithmetic seen from two sides. A second stored amount would be derivable
-- from the first and the rate, and the first rounding disagreement between them
-- would produce a pocket whose sources do not sum to its own total.
--
-- user_id is stored rather than reached through pocket_id: ownership is proven
-- on every read and every write, and a join through a second table to prove it
-- is a join that can be forgotten.
--
-- The two delete rules differ on purpose. pocket_id cascades because an
-- allocation is the pocket's own row and destroying it destroys no financial
-- fact — no allocation ever moved money. source_account_id RESTRICTs, the choice
-- 014, 016 and 017 made for every reference that carries meaning: deleting an
-- account is a decision taken in a service with an impact report, never a silent
-- side effect of a constraint. The counter-example is pocket_saving_accounts,
-- whose cascade is what makes today's pocket deletion destroy a goal with no
-- error and no trace.
CREATE TABLE IF NOT EXISTS pocket_allocations (
 allocation_id     BIGSERIAL PRIMARY KEY,
 user_id           UUID NOT NULL
  REFERENCES users(user_id) ON DELETE CASCADE,
 pocket_id         INT NOT NULL
  REFERENCES pockets(pocket_id) ON DELETE CASCADE,
 source_account_id INT NOT NULL
  REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 amount            DECIMAL(15,2) NOT NULL CHECK (amount <> 0),

 -- The date the decision was taken. Mirrors transactions.transaction_actual_date.
 allocation_actual_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

 -- FX audit pair, same six columns, same meaning.
 original_amount                   DECIMAL(15,2) NOT NULL,
 original_currency_id              INT NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 exchange_rate                     DECIMAL(20,10) NOT NULL CHECK (exchange_rate > 0),
 exchange_rate_source              VARCHAR(50)   NOT NULL,
 exchange_rate_timestamp           TIMESTAMPTZ   NOT NULL,
 exchange_rate_target_currency_id  INT NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,

 created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One index per aggregate the module reads: the pocket's own total, and the
-- account's committed total that the allocate form validates against.
CREATE INDEX IF NOT EXISTS idx_pocket_allocations_pocket  ON pocket_allocations(pocket_id);
CREATE INDEX IF NOT EXISTS idx_pocket_allocations_account ON pocket_allocations(source_account_id);

-- ---------------------------------------------------------------------------
-- STEP 2 — copy every pocket account into pockets, BEFORE any of it is deleted.
-- ---------------------------------------------------------------------------
--
-- This step precedes step 5 because pocket_saving_accounts.account_id is
-- REFERENCES user_accounts(account_id) ON DELETE CASCADE
-- (002_accounts.sql:190-193). Deleting the account row first destroys — with no
-- error and no trace — the target, the desired date, the note and the six FX
-- columns of 015, and nothing afterwards can recover what is already gone. The
-- owner's deletion of 2026-08-24 confirmed that cascade with real data.
--
-- Soft-deleted pocket accounts are NOT copied. A soft-deleted account is one the
-- owner removed, the new table has no state column to express "removed", and
-- copying it would resurrect a goal that was abandoned on purpose. They are
-- still deleted by step 5, and step 3 leaves their balances alone because the
-- deletion path that soft-deleted them already reversed their movements.
--
-- desired_date narrows from TIMESTAMPTZ to DATE on the OWNER's calendar. Read at
-- the server's zone instead, a deadline stored late in the day moves to the day
-- before west of UTC, and every pace figure derived from it moves with it.
--
-- currency_id falls back to the account's own currency: pocket_saving_accounts
-- allows NULL there and pockets does not, and user_accounts.currency_id is
-- NOT NULL and is the currency the stored target was always expressed in.
DO $$
DECLARE
 targetless_ids TEXT;
 copied_count   INTEGER;
BEGIN
 -- A pocket with no target, or one at zero, has no representation in the new
 -- schema: target_amount is NOT NULL CHECK (> 0) because a savings plan with no
 -- figure to reach cannot be measured against anything. There are only two ways
 -- to continue past such a row and both are wrong — invent a target the owner
 -- never stated, or delete the account at step 5 and lose the goal silently.
 -- So the migration stops and names the rows, and the owner sets a target
 -- before running it again.
 SELECT string_agg(ua.account_id::text, ', ' ORDER BY ua.account_id)
   INTO targetless_ids
   FROM user_accounts ua
   JOIN account_types act ON act.account_type_id = ua.account_type_id
   JOIN pocket_saving_accounts psa ON psa.account_id = ua.account_id
  WHERE act.account_type_name = 'pocket_saving'
    AND ua.deleted_at IS NULL
    AND (psa.target IS NULL OR psa.target <= 0);

 IF targetless_ids IS NOT NULL THEN
  RAISE EXCEPTION
   'Migration 020: pocket account(s) % have no positive target. pockets.target_amount is NOT NULL CHECK (> 0); set a target on each of them and run the migration again.',
   targetless_ids;
 END IF;

 INSERT INTO pockets (
  user_id, name, note, target_amount, currency_id, desired_date,
  original_target, original_currency_id, exchange_rate, exchange_rate_source,
  exchange_rate_timestamp, exchange_rate_target_currency_id,
  created_at, updated_at
 )
 SELECT
  ua.user_id,
  ua.account_name,
  psa.note,
  psa.target,
  COALESCE(psa.currency_id, ua.currency_id),
  (psa.desired_date AT TIME ZONE u.timezone)::date,
  psa.original_target,
  psa.original_currency_id,
  psa.exchange_rate,
  psa.exchange_rate_source,
  psa.exchange_rate_timestamp,
  psa.exchange_rate_target_currency_id,
  ua.created_at,
  ua.updated_at
 FROM user_accounts ua
 JOIN account_types act ON act.account_type_id = ua.account_type_id
 JOIN pocket_saving_accounts psa ON psa.account_id = ua.account_id
 JOIN users u ON u.user_id = ua.user_id
 WHERE act.account_type_name = 'pocket_saving'
   AND ua.deleted_at IS NULL;

 GET DIAGNOSTICS copied_count = ROW_COUNT;
 RAISE NOTICE 'Migration 020 step 2: % pocket account(s) copied into pockets.', copied_count;
END
$$;

-- ---------------------------------------------------------------------------
-- STEP 3 — give each funding account back the balance the pocket took from it.
-- ---------------------------------------------------------------------------
--
-- THE QUALIFIER IS LOAD-BEARING. This is correct only for a funding movement
-- that was a virtual set-aside — money the owner earmarked while it stayed in
-- the account. For money that genuinely moved to a separate store of value the
-- balance must NOT be restored, and that case is modelled as a real account plus
-- a real transfer instead. The migration never infers which of the two a
-- movement was; it is a fact the owner states.
--
-- The statement below therefore restores every pocket movement it finds, and it
-- is licensed to do so only because the owner has confirmed, for every database
-- this file is meant to run against, that no pocket ever held money that had
-- left its funding account (owner, 2026-08-23; the sole production movement,
-- transaction 264 of 90.00, was a set-aside and the 90.00 is still in CASH).
-- A database holding a movement of the other kind must not run this file
-- unchanged.
--
-- The arithmetic is a reversal, not a re-derivation. A transfer writes one row
-- per side, each signed from the point of view of its own account: the funding
-- bank gets -90.00 and the pocket gets +90.00 (transactionController.js:680,
-- :722). So the net effect on a funding account is SUM(amount) over its own
-- movement_type_id = 5 rows, and undoing it is a subtraction of that sum. The
-- same expression covers withdrawals back out of a pocket, which raised the
-- bank's balance and are reversed downward.
--
-- Rows whose own account IS the pocket are excluded: that account's balance is
-- about to stop existing, and including it would move money to nowhere.
-- Soft-deleted pocket accounts are excluded too — the deletion path already
-- reversed their movements and recorded an annulment transaction saying so, and
-- restoring a second time would credit the same money twice.
DO $$
DECLARE
 restored_count INTEGER;
BEGIN
 WITH live_pockets AS (
  SELECT ua.account_id
    FROM user_accounts ua
    JOIN account_types act ON act.account_type_id = ua.account_type_id
   WHERE act.account_type_name = 'pocket_saving'
     AND ua.deleted_at IS NULL
 ),
 funding_net AS (
  SELECT t.account_id,
         SUM(t.amount) AS net_amount
    FROM transactions t
   WHERE t.movement_type_id = 5
     AND t.account_id NOT IN (SELECT account_id FROM live_pockets)
     AND (
      t.source_account_id IN (SELECT account_id FROM live_pockets)
      OR t.destination_account_id IN (SELECT account_id FROM live_pockets)
     )
   GROUP BY t.account_id
  HAVING SUM(t.amount) <> 0
 )
 UPDATE user_accounts ua
    SET account_balance = ua.account_balance - fn.net_amount,
        updated_at = CURRENT_TIMESTAMP
   FROM funding_net fn
  WHERE ua.account_id = fn.account_id;

 GET DIAGNOSTICS restored_count = ROW_COUNT;
 RAISE NOTICE 'Migration 020 step 3: % funding account balance(s) restored.', restored_count;
END
$$;

-- ---------------------------------------------------------------------------
-- STEP 4 — delete the pocket's transactions explicitly, and count them.
-- ---------------------------------------------------------------------------
--
-- Two reasons this is not left to step 5. Since 018 all three of
-- transactions.account_id, source_account_id and destination_account_id are
-- ON DELETE RESTRICT on user_accounts, so step 5 cannot delete an account that
-- still has rows — the deletion is now required, not merely explicit. And a
-- migration that destroys financial rows has to name them and count them, which
-- is what makes a DOWN writable at all.
--
-- Everything touching a pocket account goes: the funding movements and their
-- mirrors, the pocket's own self-referencing opening row, and the zero-amount
-- rows left by testing. Step 3 has already read what it needed from them.
DO $$
DECLARE
 deleted_count INTEGER;
BEGIN
 WITH pocket_accounts AS (
  SELECT ua.account_id
    FROM user_accounts ua
    JOIN account_types act ON act.account_type_id = ua.account_type_id
   WHERE act.account_type_name = 'pocket_saving'
 )
 DELETE FROM transactions t
  WHERE t.account_id IN (SELECT account_id FROM pocket_accounts)
     OR t.source_account_id IN (SELECT account_id FROM pocket_accounts)
     OR t.destination_account_id IN (SELECT account_id FROM pocket_accounts);

 GET DIAGNOSTICS deleted_count = ROW_COUNT;
 RAISE NOTICE 'Migration 020 step 4: % transaction(s) deleted.', deleted_count;
END
$$;

-- ---------------------------------------------------------------------------
-- STEP 5 — release the last references, then delete the pocket accounts.
-- ---------------------------------------------------------------------------
--
-- debtor_accounts.selected_account_id is ON DELETE SET NULL
-- (002_accounts.sql:177-178), so the constraint would clear it without a word.
-- It is cleared here instead, and counted: a debtor that named a pocket as its
-- settlement account is a fact the owner has to be told about, not one a
-- constraint quietly erases. Measured zero in production 2026-08-24.
--
-- The pocket_saving_accounts rows then die by cascade with their accounts, which
-- is safe only because step 2 has already copied everything they carried.
-- Soft-deleted pocket accounts are deleted here too: they were never copied and
-- nothing else in the app is going to reach them again.
DO $$
DECLARE
 cleared_count INTEGER;
 deleted_count INTEGER;
BEGIN
 WITH pocket_accounts AS (
  SELECT ua.account_id
    FROM user_accounts ua
    JOIN account_types act ON act.account_type_id = ua.account_type_id
   WHERE act.account_type_name = 'pocket_saving'
 )
 UPDATE debtor_accounts da
    SET selected_account_id = NULL,
        selected_account_name = NULL
  WHERE da.selected_account_id IN (SELECT account_id FROM pocket_accounts);

 GET DIAGNOSTICS cleared_count = ROW_COUNT;
 RAISE NOTICE 'Migration 020 step 5a: % debtor account(s) no longer point at a pocket.', cleared_count;

 DELETE FROM user_accounts ua
  USING account_types act
  WHERE act.account_type_id = ua.account_type_id
    AND act.account_type_name = 'pocket_saving';

 GET DIAGNOSTICS deleted_count = ROW_COUNT;
 RAISE NOTICE 'Migration 020 step 5b: % pocket account(s) deleted.', deleted_count;
END
$$;

-- DOWN
-- Run manually.
--
-- Step 1 reverses completely: the two tables are dropped and nothing else in the
-- database refers to them.
--
-- Steps 2 to 5 do NOT reverse from anything stored. The transactions step 4
-- deletes would have to be reinserted from values written literally into this
-- file, and there are none to write: production held zero pocket accounts, zero
-- pocket_saving_accounts rows, zero movement_type_id = 5 transactions and zero
-- debtor accounts pointing at a pocket when this migration was authored
-- (measured 2026-08-24). They cannot be read back out of pocket_allocations
-- either, because the UP writes no allocation and any row the owner adds
-- afterwards is indistinguishable from a converted one — a DOWN reading that
-- table would resurrect transactions for money that never moved.
--
-- So: on any database whose steps 2 to 5 report a non-zero count, export
-- user_accounts, pocket_saving_accounts and the affected transactions BEFORE
-- running the UP. That export is the DOWN for those steps.
--
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- DROP TABLE IF EXISTS pocket_allocations;
-- DROP TABLE IF EXISTS pockets;
-- DELETE FROM migrations WHERE filename = '020_create_pocket_tables.sql';
-- COMMIT;
