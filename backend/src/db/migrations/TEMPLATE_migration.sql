-- backend/src/db/migrations/TEMPLATE_migration.sql
--
-- Copy this into sql_migrations/ as NNN_what_it_does.sql. This file lives one
-- directory up on purpose: runMigrations.js reads only sql_migrations/, so the
-- template is never executed.
--
-- ============================================================================
-- TRANSACTIONS
-- ============================================================================
-- Do not write BEGIN or COMMIT here. runMigrations.js opens one transaction per
-- file and commits it together with the file's row in the migrations ledger, so
-- the schema change and the record that names it survive or fall together. A
-- COMMIT in this file would close the runner's transaction and leave everything
-- after it in autocommit — which is exactly the defect that made files 001 to
-- 007 unsafe until they gave their transaction statements back.
--
-- A PL/pgSQL block is different: the BEGIN inside DO $$ ... $$ is a language
-- construct, not a transaction, and it is fine.
--
-- ============================================================================
-- THE REVERSE
-- ============================================================================
-- Every migration from 025 onward declares its reverse, under -- DOWN, as
-- statements and not as prose. The rule starts here and is not retrofitted:
-- the twenty-four files already applied carry no reverse by decision taken on
-- 2026-09-02, because a reverse written today for a migration that already ran
-- is one nobody will execute and nobody can test. That is a recorded decision,
-- not an omission — see plan-docs/ongoing/PLAN_MIGRATION_CHAIN.md.
--
-- There is no reverse runner yet. Writing the reverse is required; executing it
-- is manual, which is why it must read as statements someone can paste.
--
-- A reverse that would lose data says so in one line instead of pretending: a
-- dropped column cannot be un-dropped, and the honest reverse of a backfill is
-- usually "none: the previous values were not kept".
--
-- ============================================================================
-- Migration NNN: <one line, what this changes and why>
-- Depends on: <the migrations whose objects this one touches>
-- Measured before writing: <what was counted, on which database, on what date>
-- ============================================================================

-- UP ------------------------------------------------------------------------

-- Idempotent wherever the syntax allows it: IF NOT EXISTS on creation,
-- IF EXISTS on removal. A migration that can run twice without failing is one
-- that survives an interrupted deploy.


-- DOWN ----------------------------------------------------------------------

-- The statements that undo the UP block, in reverse order. If part of it cannot
-- be undone, say which part and why, on one line.


-- ============================================================================
-- THE OTHER BUILD PATH
-- ============================================================================
-- Whatever this migration adds to a table also goes into
-- run_time_db_init/createTables.js, in the same commit. That DDL is what
-- initializeDatabase() runs on every server start, and a database built by it
-- never sees this file. `npm run db:parity` builds one database by each path
-- and reports what does not match.
