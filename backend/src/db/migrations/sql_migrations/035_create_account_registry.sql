-- 035_create_account_registry.sql
--
-- ============================================================================
-- Migration 035: creates account_registry, the durable historical identity of
--   an account, and repoints seven foreign keys onto it so that references
--   survive the deletion of the user_accounts row. Block 1 of
--   PLAN_CLOSE_ACCOUNT.md.
--
-- THE RULING THAT PUT THIS FILE HERE. It was written on 2026-09-08 as a draft
--   in the deletion plan's folder, because the standing record said the
--   migration session adds every file in this directory, and this session had
--   been told only that the migration suspension was lifted for writing block
--   1 - not the same statement. The owner settled it the same day, in his own
--   words: "La carpeta correcta es la cadena de migraciones SQL, no
--   plan-docs/. El registro no es documentacion: es una dependencia
--   estructural del esquema." The file moved here unchanged by git mv; only
--   this header block was rewritten.
--
-- WHAT THE REGISTRY IS, in the owner's framing of the same ruling: not a table
--   of closed accounts, but "la identidad historica durable que permite que
--   sobrevivan las referencias cuando user_accounts desaparece". Every account
--   has a row here from the moment it is created, written by the trigger
--   below, and that row carries a null closed_at for as long as the account is
--   open. Closure fills the closure columns; it does not create the row.
--
-- 035 IS FREE. Measured by the migration session on 2026-09-08 across all five
--   worktrees, and re-checked here against origin/main and
--   origin/feat/backdating immediately before the move: 034 is the highest
--   number on every branch.
--
-- WHAT IT DELIVERS, and why the four pieces are one file. The registry table,
--   the trigger that populates it, the backfill of existing accounts, and seven
--   repointed foreign keys. Section 7.1 rules them inseparable, and the reason
--   is that none of them changes a figure any query returns on its own: the
--   other removals of section 4.6 still stand behind each one. A migration whose
--   effect cannot be demonstrated becomes a ledger row a later session reads as
--   proof the problem is solved.
--
-- NOT MEASURED AGAINST ANY DATABASE. Nothing here was run. Every count and
--   constraint name quoted below is the migration session's measurement, taken
--   on fintrack_dev and on the local production copy fintrack_prod_data under
--   the owner's authorisation, and recorded as theirs. Production was not read
--   by anyone. Production migrations remain frozen by the owner's instruction of
--   2026-09-07.
-- ============================================================================
--
--
-- ============================================================================
-- PRECONDITIONS: WHAT MUST ALREADY BE APPLIED, AND HOW TO CHECK IT
-- ============================================================================
--
-- THIS FILE WILL BE APPLIED BY HAND, IN AN ORDER A PERSON CHOOSES, AGAINST A
-- DATABASE WHOSE LEDGER CANNOT BE SEEN FROM THE REPOSITORY. Nothing applies the
-- chain automatically: backend/package.json starts with node src/index.js, there
-- is no postinstall and no vercel-build, vercel.json carries only version,
-- builds and routes, and db:migrate exists solely as its own script definition.
-- The boot path does not close the gap either - initializeDatabase() is called
-- inside startServer() in backend/src/index.js, while the serverless entrypoint
-- backend/index.js imports ./src/app.js and nothing else. So 031 through 034 are
-- already sitting in a queue with no runner and this file joins them. The
-- preconditions are therefore stated rather than assumed.
--
-- THE FOUR TABLES THIS FILE ALTERS, AND THE FILE THAT CREATES EACH:
--   user_accounts, debtor_accounts       002_accounts.sql
--   transactions                         003_transactions.sql
--   transactions.opening_for_account_id  022_add_transaction_opening_for_account.sql
--   pocket_allocations                   020_create_pocket_tables.sql
--   budget_monthly_allocations           010_create_budget_tables.sql - CONDITIONALLY,
--                                        see the hazard below
--
-- ONE PRECONDITION CANNOT BE CHECKED BY FILENAME, AND IT IS THE SEVENTH KEY'S.
-- 010_create_budget_tables.sql was edited in place. Commit 52c93d6c created
-- budget_frequency_types, budget_policies and budget_policy_allocations inside
-- it; commit 3b72371f, on 2026-08-12, removed those three CREATE TABLE
-- statements from the same file and added budget_monthly_allocations. The
-- filename and the ledger entry never changed. So whether a database holds
-- budget_monthly_allocations depends on WHEN it ran 010, not on what 010 says
-- today, and a ledger naming 010 proves nothing either way.
--
-- CHECK IT DIRECTLY RATHER THAN THROUGH THE LEDGER. The seventh ALTER at the end
-- of section 4 fails unless this returns a row:
--
--   SELECT to_regclass('public.budget_monthly_allocations');
--
-- THE SAME QUERY TELLS YOU WHICH SIDE OF 3b72371f THE DATABASE IS ON, and the
-- migration session's receipt is the ledger name: a database that ran the old
-- 010 has an entry for 012_backfill_budget_policies.sql, a file that no longer
-- exists in the repository. fintrack_dev names it and holds the three orphan
-- tables; the production copy does not name it and does not hold them.
--
-- NOT A PRECONDITION OF THIS FILE, BUT OF THE BLOCK: 034_add_account_closed_at.sql
-- must be applied before the close operation of block 3 runs anywhere, for a
-- reason unrelated to this file. deleteAccountService.js reads the account with
-- SELECT ua.* and then tests accountCheck.rows[0].closed_at !== null; without
-- the column that is a property read on a plain object, undefined !== null is
-- true, and every deletion is refused with a message asserting the account was
-- already closed and settled when it never was.
--
--
-- ============================================================================
-- THIS FILE IS NEVER EDITED AFTER IT IS APPLIED ANYWHERE
-- ============================================================================
--
-- Stated as a consequence rather than as a rule, because the consequence is in
-- this repository and can be read. Commit 3b72371f edited an applied migration,
-- and the cleanup is still running two weeks later: fintrack_dev holds three
-- tables the current text of 010 does not create, and five separate places in
-- the codebase describe that situation wrongly - two boot files, budgetConfig.js,
-- getAccountController.js and a document in plan-docs/completed/ that claims the
-- tables "no longer exist". A migration edited after it ran makes a database's
-- schema depend on when it ran rather than on what the repository says. A
-- deleted filename fails loudly; a rewritten one does not fail at all.
--
--
-- ============================================================================
-- SECTION 1 OF 5: THE TABLE
-- ============================================================================
--
-- A registry of every account id ever issued, carrying one row per account from
-- the moment the account is created. Nothing ever deletes from it.
--
-- THE NAME. PLAN_CLOSE_ACCOUNT.md never named this table in a schema sense, but
-- its running text had already chosen one: "registry" appears 99 times, and the
-- sentence that defines the shape is ":912 The ruled shape - a registry of every
-- account id ever issued". Two alternatives were considered and both were worse.
--   account_identities was proposed by this session and refused by the migration
--     session, correctly: identity is taken three times over in this codebase
--     and one of those is a stored value, not a concept. authController.js:223
--     destructures identity as the login string and :233 resolves it to u.email
--     or u.username; exchange_rate_source VARCHAR(60) NOT NULL DEFAULT
--     'identity' appears eight times in createTables.js, where 'identity' means
--     a conversion at rate 1; and RESTART IDENTITY at initDatabase.js:300 is
--     Postgres's own use of the word about tables. Twenty hits on identit in
--     backend/src, none of them about an account. Four hits on registr, all of
--     them prose in comments.
--   closed_accounts was refused because every live account has a row here from
--     creation, so the name would misdescribe most of the table and read as a
--     filter - and GET /closed already names a different set at
--     accountRoutes.js:84.
-- The singular breaks the plural convention of user_accounts and account_types,
-- and it is the right break: a registry is one book with many entries, the way
-- exchange_rate_query_coverage (023) is one measure over many rows.
--
-- NO FOREIGN KEY ON account_id INTO user_accounts, and this is the design rather
-- than an omission. One reason, demonstrated by the migration session on
-- fintrack_dev inside a transaction that was always rolled back, using only
-- CREATE TEMP TABLE ... ON COMMIT DROP and a pg_temp function: the registry must
-- outlive user_accounts. The probe deleted the parent row with no foreign key
-- present and the registry row survived it.
--
-- A SECOND REASON STOOD HERE AND IS WITHDRAWN, 2026-09-08. It said the parent
-- row does not exist yet, because the trigger wrote from inside a BEFORE INSERT.
-- The trigger is AFTER INSERT now, so the parent row does exist and the timing
-- forbids nothing. Read that before concluding the key may now be added: the
-- reason above is the one that was always carrying the decision, and a key into
-- a table whose rows are deleted at closure would refuse every closure.
--
-- account_created_at DEVIATES FROM THE PLAN'S COLUMN LIST, deliberately. Section
-- 4.6 names the column created_at, after the source column it stamps
-- (user_accounts.created_at, read by overviewAccountRepository.js:213). On this
-- table a bare created_at is a trap: every other created_at in the schema is the
-- row's own insertion time, and this one is the ACCOUNT's, stamped at closure,
-- therefore null on every live account - a column that means the opposite of its
-- name for most of the table. The prefix costs one word and removes the
-- ambiguity. The plan is amended to match rather than the other way round.

CREATE TABLE IF NOT EXISTS account_registry (
 -- Written at creation, by the trigger in section 2. Never null, never changed.
 -- Not SERIAL: the value is issued by user_accounts and copied here.
 account_id INT PRIMARY KEY,

 user_id UUID NOT NULL REFERENCES users(user_id)
  ON DELETE CASCADE
  ON UPDATE CASCADE,

 -- Stamped at closure, by the close operation of block 3. Null means one thing
 -- only: the account was erased before this registry existed. Section 4.4
 -- measures why such a row can carry nothing else - the type and the currency
 -- lived on user_accounts and on the extension row and both are already gone.
 -- Every reader consulting a stamp needs a branch for that null.
 account_name VARCHAR(50),

 account_type_id INT REFERENCES account_types(account_type_id)
  ON DELETE SET NULL
  ON UPDATE CASCADE,

 -- The RESOLVED currency, not the raw column. ACCOUNTS_QUERY reads
 -- COALESCE(cba.currency_id, ua.currency_id) at
 -- budgetTransactionRepository.js:125; once both rows are gone that COALESCE has
 -- no second operand, so the stamp has to be the answer the expression would
 -- have given.
 currency_id INT REFERENCES currencies(currency_id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE,

 account_starting_amount DECIMAL(15,2),
 account_start_date TIMESTAMPTZ,
 account_created_at TIMESTAMPTZ,

 -- category_budget only. Read off the extension row inside the closing
 -- transaction, BEFORE the cascade destroys it. budgetCalculationService folds
 -- its payload on category_name, and ACCOUNTS_QUERY publishes subcategory as its
 -- own field, so neither may be recovered by parsing account_name (7.3). The
 -- nature is stamped as the catalog key rather than the name text:
 -- category_nature_types rows are never deleted, so the existing LEFT JOIN stays
 -- answerable.
 --
 -- NOTHING BINDS account_name TO THESE PARTS, and no CHECK is added. A CHECK is
 -- a rule about every row that will ever be written, and these rows are records
 -- of something that already happened; the constraint would not prevent a bad
 -- state, it would prevent RECORDING a state that exists anyway. It already
 -- exists: 013_normalize_category_budget_name_case.sql trims the whole name in
 -- one statement and the subcategory alone in another, so account 122 carries
 -- account_name 'bolsas/plasticas /other' against parts 'bolsas' + 'plasticas'.
 -- The one account documenting that asymmetry would become the one account that
 -- cannot be closed.
 category_name VARCHAR(50),
 subcategory VARCHAR(25),
 category_nature_type_id INT
  REFERENCES category_nature_types(category_nature_type_id),

 -- The closure record. Three columns on this row rather than a second table, by
 -- the rule of 4.3: an event that happens at most once per account belongs on
 -- the account's row. If deactivation is ever recorded, deactivation repeats,
 -- and that is when a second table earns its place.
 --
 -- closed_by is SET NULL rather than CASCADE on purpose: a deleted user must not
 -- take a closure record with them, and the closure still happened.
 closed_at TIMESTAMPTZ,
 closed_by UUID REFERENCES users(user_id)
  ON DELETE SET NULL
  ON UPDATE CASCADE,
 close_reason TEXT,

 -- THE OBVIOUS SPELLINGS DO NOT ENFORCE WHAT THE OWNER RULED - mandatory, free
 -- text - and both failures were measured by the migration session across eight
 -- cases:
 --   CHECK (closed_at IS NULL OR close_reason IS NOT NULL) accepts an empty
 --     string and accepts a run of spaces, which is exactly the row the
 --     requirement exists to prevent.
 --   length(btrim(close_reason)) > 0 accepts a newline and accepts tabs, because
 --     one-argument btrim strips spaces only.
 -- The regex arm is the one that holds: at least one non-whitespace character
 -- anywhere in the string.
 --
 -- THE FIRST ARM IS A BICONDITIONAL AND THAT IS DELIBERATE. An earlier draft
 -- said a reason is required when a closure exists, which is an implication and
 -- would accept a reason with no closure. The only writers are the trigger,
 -- which writes both null, and the close operation, which writes both, so a
 -- reason without a closure can only come from a defect or a hand-written row,
 -- and refusing it costs nothing.
 --
 -- IT IS A TABLE CONSTRAINT AND NOT A COLUMN-LEVEL NOT NULL because a
 -- column-level one would refuse every row the trigger writes at creation.
 CONSTRAINT chk_close_reason_accompanies_closure CHECK (
  (closed_at IS NULL) = (close_reason IS NULL)
  AND (close_reason IS NULL OR close_reason ~ '[^[:space:]]')
 )
);

-- The ownership filter of every historical read: a closed account's rows are
-- returned to their owner and to nobody else.
CREATE INDEX IF NOT EXISTS idx_account_registry_user_id
 ON account_registry (user_id);

-- Block 2's readers ask for the closed accounts of one owner, which is a small
-- slice of a table holding every account ever issued. Partial, because the rows
-- it excludes are the majority and are never the answer to that question.
CREATE INDEX IF NOT EXISTS idx_account_registry_closed
 ON account_registry (user_id, closed_at)
 WHERE closed_at IS NOT NULL;


-- ============================================================================
-- SECTION 2 OF 5: THE TRIGGER
-- ============================================================================
--
-- Two creation controllers plus the boot path write accounts, and convention
-- cannot keep three writers honest. An AFTER INSERT row trigger is the version
-- no writer can forget.
--
-- THIS IS THE SCHEMA'S FIRST SIDE-EFFECTING TRIGGER, and it is worth stating
-- rather than discovering. trg_users_timezone_is_iana is the only trigger that
-- exists today, and its function raises or returns NEW; it writes nothing. A
-- trigger that INSERTs into another table is a step up in what this schema does,
-- taken deliberately and for the reason above.
--
-- AFTER INSERT RATHER THAN BEFORE, decided 2026-09-08. Both timings see the
-- account id, because a SERIAL default is evaluated before either one fires, so
-- the choice is settled by what each does when the outer INSERT produces no row.
-- A BEFORE ROW trigger runs before ON CONFLICT is arbitrated, so a writer adding
-- ON CONFLICT DO NOTHING to user_accounts would leave an identity behind for an
-- account that was never written. None of the three writers carries a conflict
-- clause today - transactionController.js:289, checkAndInsertAccount.js:114 and
-- insertAccount.js:21 - so the hazard is latent rather than live. AFTER costs
-- nothing and cannot produce it.
--
-- ONE HAZARD NO AUTOMATED CHECK WILL CATCH (7.1). db:parity builds both paths
-- from scratch and compares tables and columns, so it is structurally blind to a
-- missing trigger and will report clean while createTables.js lacks one. Every
-- piece of this file needs a hand-written counterpart in the boot path, and this
-- is the piece parity cannot see at all.

CREATE OR REPLACE FUNCTION fn_register_account_identity()
RETURNS TRIGGER AS $$
BEGIN
 -- NO ON CONFLICT CLAUSE, and the omission is the point. An earlier version
 -- swallowed the conflict so that re-running the backfill in section 3 would not
 -- fail against rows this trigger had written - but that backfill inserts into
 -- account_registry directly and never fires this trigger, so nothing it does
 -- reaches this statement. What can reach it is a reissued account id: TRUNCATE
 -- TABLE ... RESTART IDENTITY CASCADE at initDatabase.js:300 resets the
 -- user_accounts sequence while this table, which no foreign key ties to it,
 -- keeps every row. The next account is then issued id 1 and meets the registry
 -- row of a different account 1, carrying its closure stamp, its category and
 -- its currency. Swallowed, the new account inherits them in silence. Raised,
 -- the insert stops on the one state that must never pass.
 --
 -- THAT TRUNCATE CANNOT RUN AS SHIPPED, measured 2026-09-08 by the deletion
 -- session and recorded here so nobody re-derives the hazard as live. It sits
 -- behind const tableActions = { isTruncate: false, ... } at initDatabase.js:286,
 -- written as a literal in the same function and assigned nowhere else in
 -- backend/src, so the branch at :288 is never entered. The hazard is latent,
 -- exactly like the ON CONFLICT timing that moved this trigger to AFTER INSERT:
 -- one flag away rather than one request away. It is still the right thing to
 -- fail on, because a clause that swallows it costs nothing to remove and the
 -- state it hides - an account wearing another account's closure - is not one
 -- any later reader could diagnose from the data.
 INSERT INTO account_registry (account_id, user_id)
 VALUES (NEW.account_id, NEW.user_id);

 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_register_account_identity ON user_accounts;

CREATE TRIGGER trg_register_account_identity
 AFTER INSERT ON user_accounts
 FOR EACH ROW
 EXECUTE FUNCTION fn_register_account_identity();


-- ============================================================================
-- SECTION 3 OF 5: THE BACKFILL
-- ============================================================================
--
-- One row per LIVE account, carrying the id and the owner and nulls everywhere
-- else. Live accounts are not stamped, by the owner's ruling: their values are
-- read from user_accounts, and a stamp would create a second writer for the same
-- fact. A reader resolves in one step - present in user_accounts, read live;
-- absent, read the stamp.
--
-- WHAT IT CANNOT REACH, and this is block 0's problem rather than a gap here.
-- Accounts the previous mechanism already erased have no row in user_accounts to
-- select from. Section 11 measures why none can be recovered: the erasure tail
-- nulls source and destination on surviving rows and deletes the target's own
-- rows, so no surviving row carries an erased account's id in any column. For
-- those accounts the backfill answer is zero rows, and that is decided by the
-- code rather than by a count.
--
-- ORDER MATTERS AND IT IS WHY THIS SECTION PRECEDES SECTION 4. Every repointed
-- key below validates against this table at creation. Backfilling afterwards
-- would fail on the first surviving transaction row.
--
-- IF ANY REPOINTED KEY FAILS TO VALIDATE, THAT IS THE CORRECT OUTCOME and the
-- file must not be made to pass. It would mean a referencing column names an
-- account id that is neither live nor erased by the tail, which is a state
-- nothing in this codebase is known to produce. Adding the keys NOT VALID would
-- hide exactly that.

INSERT INTO account_registry (account_id, user_id)
SELECT ua.account_id, ua.user_id
FROM user_accounts ua
ON CONFLICT (account_id) DO NOTHING;


-- ============================================================================
-- SECTION 4 OF 5: THE SEVEN KEYS
-- ============================================================================
--
-- Six repointed from user_accounts to the registry, and the seventh from
-- category_budget_accounts. Every constraint name below was read from
-- pg_constraint by the migration session on both local databases, identical
-- lists, so these are the chain's names and not one database's.
--
-- WHAT THE REPOINT ACHIEVES: user_accounts becomes freely deletable, because the
-- only references left to it are the four extension primary keys, which cascade.
-- The referencing columns keep a real constraint rather than becoming plain
-- integers - the registry never deletes a row, so RESTRICT never fires and costs
-- nothing, while the column still refuses an id that was never issued.
--
-- transactions CARRIES FOUR OF THE SIX, NOT THREE. An earlier draft of the plan
-- wrote "the three on transactions, opening_for_account_id, ...", which sends a
-- reader looking for the opening marker on another table. It is the fourth of
-- four, added by 022_add_transaction_opening_for_account.sql.
--
-- FIVE OF THE SIX REMOVE A REFUSAL. THE SIXTH REMOVES A CLEANUP, in the opposite
-- direction, and it is ruled rather than absorbed.
-- debtor_accounts_selected_account_id_fkey is ON DELETE SET NULL today
-- (002_accounts.sql:179-180): deleting a bank account nulls every debtor's
-- selected_account_id. After the repoint the delete no longer touches it and the
-- pointer survives, naming a closed account. THAT IS THE INTENDED BEHAVIOUR.
-- Today's SET NULL destroys the historical fact of which account a debtor was
-- opened against, which is the same class of loss the registry exists to stop.
-- The key is about a DIFFERENT account from the one the row belongs to, so the
-- owner's ruling that a closed account leaves no row behind does not reach it.
--
-- WHAT MUST NOT SURVIVE WITH IT IS THE STALE NAME, and it needs no schema
-- change. debtor_accounts.selected_account_name is written once with the debtor
-- row (accountCreationController.js:785 and :795), set to null once by
-- 020_create_pocket_tables.sql:386, and read at getAccountController.js:836.
-- accountEditController never touches it, so renaming the referenced account
-- already leaves it stale today, before any of this. The reader takes the name
-- through the id - live from user_accounts, historical from here - and that
-- column stays what it already is: a creation-time snapshot no statement
-- maintains.

ALTER TABLE transactions
 DROP CONSTRAINT IF EXISTS transactions_account_id_fkey,
 ADD CONSTRAINT transactions_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES account_registry(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE transactions
 DROP CONSTRAINT IF EXISTS transactions_source_account_id_fkey,
 ADD CONSTRAINT transactions_source_account_id_fkey
  FOREIGN KEY (source_account_id) REFERENCES account_registry(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE transactions
 DROP CONSTRAINT IF EXISTS transactions_destination_account_id_fkey,
 ADD CONSTRAINT transactions_destination_account_id_fkey
  FOREIGN KEY (destination_account_id) REFERENCES account_registry(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE transactions
 DROP CONSTRAINT IF EXISTS transactions_opening_for_account_id_fkey,
 ADD CONSTRAINT transactions_opening_for_account_id_fkey
  FOREIGN KEY (opening_for_account_id) REFERENCES account_registry(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE pocket_allocations
 DROP CONSTRAINT IF EXISTS pocket_allocations_source_account_id_fkey,
 ADD CONSTRAINT pocket_allocations_source_account_id_fkey
  FOREIGN KEY (source_account_id) REFERENCES account_registry(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The one that changes behaviour: SET NULL becomes RESTRICT, for the reason
-- above. RESTRICT never fires here, because the registry never deletes a row.
ALTER TABLE debtor_accounts
 DROP CONSTRAINT IF EXISTS debtor_accounts_selected_account_id_fkey,
 ADD CONSTRAINT debtor_accounts_selected_account_id_fkey
  FOREIGN KEY (selected_account_id) REFERENCES account_registry(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- THE SEVENTH KEY, added to this block on 2026-09-08 when the owner ruled fix 1.
-- It is repointed from category_budget_accounts rather than from user_accounts,
-- and it is what makes a closed category's past months survive: the allocation
-- rows outlive the extension row that used to hold them up. Its declaration in
-- 010_create_budget_tables.sql is inline and unnamed, so it is dropped by the
-- name Postgres generated, identical on both local databases.
--
-- THIS IS THE STATEMENT WITH THE CONDITIONAL PRECONDITION. It fails outright on
-- a database that ran 010 before commit 3b72371f, because there
-- budget_monthly_allocations does not exist. Run the to_regclass check at the
-- top of this file first.
ALTER TABLE budget_monthly_allocations
 DROP CONSTRAINT IF EXISTS budget_monthly_allocations_account_id_fkey,
 ADD CONSTRAINT budget_monthly_allocations_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES account_registry(account_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- SECTION 5 OF 5: THE DOWN, AND THE DATE IT STOPS BEING REAL
-- ============================================================================
--
-- STATED BEFORE IT IS NEEDED RATHER THAN DISCOVERED WHEN IT IS. The DOWN below
-- is honest only until the first category_budget account is closed. Pointing
-- budget_monthly_allocations.account_id back at category_budget_accounts
-- requires every surviving allocation row's account to still exist in that
-- table, and that is exactly what the seventh key exists to make false. From the
-- first such closure the DOWN cannot run without deleting the rows the change
-- was made to preserve. Same shape as 013's DOWN.
--
-- The other six reverse cleanly only while no account has been closed at all: a
-- closed account has no user_accounts row, so a key pointed back at that table
-- has nothing to validate its surviving references against.
--
-- DROPPING THE TABLE DESTROYS THE ONLY RECORD OF EVERY CLOSED ACCOUNT. That is
-- the last statement below and it is the one that cannot be undone by running
-- the UP again.
--
-- LEFT COMMENTED DELIBERATELY. This file has no runner that would ask first, and
-- an accidental execution repoints seven keys at tables that may no longer hold
-- the rows they need. Uncomment to run.
--
-- ALTER TABLE budget_monthly_allocations
--  DROP CONSTRAINT IF EXISTS budget_monthly_allocations_account_id_fkey,
--  ADD CONSTRAINT budget_monthly_allocations_account_id_fkey
--   FOREIGN KEY (account_id) REFERENCES category_budget_accounts(account_id)
--   ON DELETE CASCADE;
--
-- ALTER TABLE debtor_accounts
--  DROP CONSTRAINT IF EXISTS debtor_accounts_selected_account_id_fkey,
--  ADD CONSTRAINT debtor_accounts_selected_account_id_fkey
--   FOREIGN KEY (selected_account_id) REFERENCES user_accounts(account_id)
--   ON DELETE SET NULL ON UPDATE CASCADE;
--
-- ALTER TABLE pocket_allocations
--  DROP CONSTRAINT IF EXISTS pocket_allocations_source_account_id_fkey,
--  ADD CONSTRAINT pocket_allocations_source_account_id_fkey
--   FOREIGN KEY (source_account_id) REFERENCES user_accounts(account_id)
--   ON DELETE RESTRICT ON UPDATE CASCADE;
--
-- ALTER TABLE transactions
--  DROP CONSTRAINT IF EXISTS transactions_opening_for_account_id_fkey,
--  ADD CONSTRAINT transactions_opening_for_account_id_fkey
--   FOREIGN KEY (opening_for_account_id) REFERENCES user_accounts(account_id)
--   ON DELETE RESTRICT ON UPDATE CASCADE;
--
-- ALTER TABLE transactions
--  DROP CONSTRAINT IF EXISTS transactions_destination_account_id_fkey,
--  ADD CONSTRAINT transactions_destination_account_id_fkey
--   FOREIGN KEY (destination_account_id) REFERENCES user_accounts(account_id)
--   ON DELETE RESTRICT ON UPDATE CASCADE;
--
-- ALTER TABLE transactions
--  DROP CONSTRAINT IF EXISTS transactions_source_account_id_fkey,
--  ADD CONSTRAINT transactions_source_account_id_fkey
--   FOREIGN KEY (source_account_id) REFERENCES user_accounts(account_id)
--   ON DELETE RESTRICT ON UPDATE CASCADE;
--
-- ALTER TABLE transactions
--  DROP CONSTRAINT IF EXISTS transactions_account_id_fkey,
--  ADD CONSTRAINT transactions_account_id_fkey
--   FOREIGN KEY (account_id) REFERENCES user_accounts(account_id)
--   ON DELETE RESTRICT ON UPDATE CASCADE;
--
-- DROP TRIGGER IF EXISTS trg_register_account_identity ON user_accounts;
-- DROP FUNCTION IF EXISTS fn_register_account_identity();
-- DROP TABLE IF EXISTS account_registry;
