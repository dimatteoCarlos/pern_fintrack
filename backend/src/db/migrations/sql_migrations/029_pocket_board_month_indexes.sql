-- 029_pocket_board_month_indexes.sql
--
-- ============================================================================
-- Migration 029: index the two columns the month-bounded pocket board filters on
-- Depends on: 020_create_pocket_tables.sql (creates both tables and their two
--             existing indexes)
-- Measured before writing: the index list of 020 was read, not a query plan.
--             The local database holds a handful of pockets and a handful of
--             allocations, where Postgres picks a sequential scan whatever
--             indexes exist, so a timing taken here would measure nothing. The
--             justification below is structural and is stated as such.
-- ============================================================================
--
-- WHAT CHANGED IN THE QUERY
--
-- The board used to read one unbounded sum per pocket. It now reads four
-- aggregates per pocket, each with a FILTER on allocation_actual_date, and it
-- bounds the pocket population itself on pockets.created_at.
--
-- The ledger already has an index on pocket_id alone (020:171). That still
-- serves the join. What it does not serve is the date predicate: with only the
-- pocket indexed, every allocation row of every pocket is fetched and the date
-- comparison runs per row. On the pair, the planner can walk the pocket's rows
-- already ordered by date and stop at the window's edge.
--
-- The pocket table has no index on its owner at all. Every read of this module
-- filters on user_id, and the board now filters on created_at beside it.
--
-- WHY A COMPOSITE AND NOT TWO SINGLE-COLUMN INDEXES
--
-- The predicate is always both columns together — one pocket AND one date
-- window, one owner AND one creation bound. Two separate indexes make the
-- planner combine bitmaps or pick one and filter the rest; a composite in that
-- order answers the whole predicate from a single range scan. The order matters:
-- the equality column leads, the range column follows, which is the only order
-- in which the range stays a contiguous span of the index.
--
-- WHY NOT CONCURRENTLY
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and
-- runMigrations.js wraps every file in one so the schema change and its ledger
-- row commit together. Both tables are small and the lock is brief. When this
-- reaches a database where it is not, the index is built by hand with
-- CONCURRENTLY and this file is a no-op through its IF NOT EXISTS.

-- UP ------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pocket_allocations_pocket_date
 ON pocket_allocations(pocket_id, allocation_actual_date);

CREATE INDEX IF NOT EXISTS idx_pockets_user_created
 ON pockets(user_id, created_at);

-- DOWN ----------------------------------------------------------------------

-- Fully reversible: an index holds no data of its own, so dropping both returns
-- the schema to exactly what 020 left. The board's queries stay correct without
-- them and only get slower.

DROP INDEX IF EXISTS idx_pockets_user_created;

DROP INDEX IF EXISTS idx_pocket_allocations_pocket_date;
