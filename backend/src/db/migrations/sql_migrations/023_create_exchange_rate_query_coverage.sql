-- 023_create_exchange_rate_query_coverage.sql
--
-- Creates the record of WHICH DAY RANGES THIS INSTALLATION ACTUALLY ASKED a
-- provider for, so the historical resolver can tell a real absence from a gap
-- it never downloaded.
--
-- THE DEFECT THIS CLOSES
--
-- daily_exchange_rates holds one row per day the provider quoted, and 021
-- states the rule that makes it honest: no row is ever written for a day the
-- provider did not quote. The resolver then answers a requested day D with the
-- greatest rate_date <= D. That lookup is correct only if every day between the
-- row it found and D is known to have been asked for.
--
-- It is not. An absent day in the store has two meanings that look identical:
--
--   * the provider published nothing that day, or
--   * this installation never downloaded that period.
--
-- The resolver reads every absence as the first. Measured against the Colombian
-- peso with rows at 08-01, 08-07, 08-13, 08-15, 08-21 and 08-26, the store
-- answered 2026-08-20 with the 08-15 rate, 3128.65, against a true 3053.48 —
-- 2.46% high, and inside the five-day age ceiling, so nothing rejected it. The
-- same walk gave -3.78% on 08-30, +1.16% on 08-12 and -2.67% on 08-04. Those
-- figures are written into a ledger and kept forever.
--
-- THE INVARIANT
--
-- An answer read from the store, giving effective day E for requested day D, is
-- trustworthy IF AND ONLY IF the whole span [E, D] was queried of the provider.
-- Inside a queried span an absent day is a real absence. Outside one it means
-- nothing at all.
--
-- WHY THIS IS COVERAGE AND NOT A VALIDITY END ON THE RATE
--
-- The obvious alternative is a valid_until column on daily_exchange_rates. It
-- is rejected, and not because validity is uninteresting. Writing "the 08-15
-- rate was valid until the 20th" because the 16th through the 20th came back
-- empty is OUR INFERENCE about the provider publication semantics, not
-- something the provider told us. 021 already refuses to write a rate under a
-- day it was not in force on; a fabricated validity end is the same act with a
-- different column name.
--
-- A coverage row asserts nothing about any rate. It says: on fetched_at, this
-- installation asked <source> for <base>/<target> over <covered>, and got a
-- complete answer back. That is a fact about our own network traffic. It needs
-- no inference, no provider cooperation, and it cannot be wrong about the
-- market.
--
-- This table therefore answers "is this absence real?". It does NOT answer "is
-- this rate too old to value with?" — that is the age ceiling in fxConfig, a
-- domain policy, and the two must never be collapsed into one number.
--
-- WHY THE KEY IS source PLUS THE PAIR
--
-- Coverage is not a property of a date range in the abstract. Having queried
-- Frankfurter for USD/EUR over August proves nothing about Frankfurter for
-- USD/VES, and nothing at all about the Banco de la Republica for USD/COP:
-- different providers publish on different calendars and have different gaps.
-- The resolver coverage test must match the source that produced the
-- observation it is about to trust.
--
-- WHY daterange AND WHY THE HALF-OPEN FORM
--
-- PostgreSQL normalises a discrete range to the half-open form, so [Aug 1,
-- Sep 1) is exactly Aug 1 through Aug 31 and there is one canonical spelling of
-- every interval. Containment is then the native @> operator over a GiST index,
-- with no arithmetic in the resolver.
--
-- The contract the resolver must build is: every day from the effective day E
-- through the requested day D, D INCLUDED, was queried. In half-open form that
-- is the range [E, D + 1 day). Written as daterange(E, D) it would silently
-- drop D itself, which is the one day the caller actually asked about, so the
-- upper bound is always the day after the requested day and the bounds argument
-- is always spelled out:
--
--   covered @> daterange(E, D + 1, '[)')
--
-- D + 1 and not D + INTERVAL '1 day'. Adding an interval to a date yields a
-- TIMESTAMP, and there is no daterange(date, timestamp) — the expression fails
-- to resolve rather than misbehaving quietly. Adding a plain integer to a date
-- is day arithmetic that yields a date, which is what the constructor takes.
--
-- WHY THE EXCLUSION CONSTRAINT IS A PREREQUISITE AND NOT AN OPTION
--
-- Two mechanisms protect this table and they are not interchangeable. The
-- writer serialises itself with a transaction-scoped advisory lock keyed on
-- source and the pair, which is what makes the read-merge-write safe against
-- the phantom case where neither row exists yet. That is a discipline the
-- calling code has to remember.
--
-- EXCLUDE USING gist is the structural guarantee that no future write path,
-- however it is built, can leave two overlapping intervals for the same source
-- and pair. Overlapping rows would make the coverage test ambiguous, and an
-- ambiguous coverage test is worse than none: it reports a HIT it cannot back.
--
-- Mixing integer equality with range overlap in one GiST constraint requires
-- btree_gist, a standard contrib extension. If the role running this migration
-- cannot create it, the migration must FAIL rather than produce a table that
-- looks like the coverage model but has lost one of its guarantees. The runner
-- gives that for free: runMigrations.js wraps every pending file in one
-- transaction and rolls the whole thing back on any error, and CREATE EXTENSION
-- is transactional DDL.
--
-- NO DATA STEPS
--
-- The table is created empty. Every rate already sitting in
-- daily_exchange_rates was fetched before coverage existed, so there is no
-- record of what was asked for and no honest range to backfill. An empty
-- coverage table makes the resolver report MISS for those periods, which is the
-- correct answer: it does not know, and it will ask the provider once and then
-- know.
--
-- WHAT IS DELIBERATELY NOT IN THIS FILE
--
-- Schema only. The coverage-aware HIT/MISS test in the resolver, the writer
-- that merges a new range into the stored ones, the monthly preload and its
-- lead-in, and any provider traffic all belong to later commits. If one of them
-- breaks the contract, the unit that broke it is identifiable.
--
-- ---------------------------------------------------------------------------
-- UP
-- ---------------------------------------------------------------------------
--
-- Before the table, because the exclusion constraint below cannot be created
-- without the operator classes this installs.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Column names are taken from exchange_rates and daily_exchange_rates wherever
-- the idea already has a name there: source, base_currency_id,
-- target_currency_id, fetched_at and created_at all mean here exactly what they
-- mean in those tables. fetched_at is when this installation made the request,
-- which is the same sense 021 gives it. covered is the only genuinely new name.
--
-- source is VARCHAR(30) to match exchange_rates.source and holds the provider
-- name alone.
CREATE TABLE IF NOT EXISTS exchange_rate_query_coverage (
 coverage_id        SERIAL PRIMARY KEY,
 base_currency_id   INTEGER NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 target_currency_id INTEGER NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 source             VARCHAR(30) NOT NULL,
 covered            DATERANGE   NOT NULL,
 fetched_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

 -- An empty range contains nothing, so it would satisfy no containment test and
 -- overlap no other row: it can never be read back and never be merged away. It
 -- is a write that looks like progress and is not.
 CONSTRAINT ck_exchange_rate_query_coverage_not_empty
  CHECK (NOT isempty(covered)),

 -- Named rather than auto-generated so the boot-time
 -- ensureExchangeRateQueryCoverageTable DDL and this file produce the same
 -- constraint on every database.
 --
 -- Read as: for one provider and one currency pair, no two rows may describe
 -- overlapping day ranges. Adjacent ranges are permitted by this constraint and
 -- merged by the writer, so the stored set stays one row per contiguous
 -- interval.
 CONSTRAINT ex_exchange_rate_query_coverage_no_overlap
  EXCLUDE USING gist (
   source             WITH =,
   base_currency_id   WITH =,
   target_currency_id WITH =,
   covered            WITH &&
  )
);

-- No second index. The exclusion constraint builds a GiST index over exactly
-- the four columns the only read this table has uses: source, base and target
-- equal, then covered tested with @> against the requested [E, D+1) range.

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
--
-- Fully reversible. The UP creates one table with no data steps, nothing
-- references it by foreign key, and the resolver treats an absent coverage row
-- as MISS, so dropping the table degrades the store to exactly the behaviour it
-- had before this migration. What is lost is the record of which ranges were
-- fetched, which is rebuilt by fetching them again.
--
-- The extension is NOT dropped. btree_gist is a database-wide facility that any
-- other object may come to depend on, and a DOWN that removes a shared resource
-- because one of its users went away is not a reversal, it is a second change.
--
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- DROP TABLE IF EXISTS exchange_rate_query_coverage;
-- DELETE FROM migrations WHERE filename = '023_create_exchange_rate_query_coverage.sql';
-- COMMIT;
