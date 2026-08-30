-- 021_create_daily_exchange_rates.sql
--
-- Creates the store that lets a back-dated movement be valued at the rate that
-- was in force on its own date, instead of at today's.
--
-- Today a transaction dated in the past is converted with whatever the current
-- cache holds, so the same movement records a different figure depending on the
-- minute it was entered. The ledger keeps that figure forever, which makes the
-- entry time part of the accounting result.
--
-- WHY THIS IS A NEW TABLE AND NOT A CHANGE TO exchange_rates
--
-- exchange_rates is a cache of the CURRENT rate, and it is designed to be
-- discarded. Three properties, each independently disqualifying:
--
--  * createTables.js:297 runs DROP TABLE IF EXISTS exchange_rates CASCADE
--    unconditionally when it builds a database.
--  * RESET_EXCHANGE_RATES=true makes initDatabase.js:200 call
--    recreateExchangeRatesTable (createTables.js:772), which drops it on any
--    database at all. Its own comment describes this as resetting the cache.
--  * UNIQUE (base_currency_id, target_currency_id) is that cache's contract —
--    exactly one row per pair, overwritten on every fetch. Two live upserts
--    declare ON CONFLICT on that key (fxDBaccess.js:180 and :280), so replacing
--    it would break every conversion the app performs today.
--
-- The two objects have opposite lifecycles. The cache is mutable, one row per
-- pair, governed by fetched_at and a TTL. The history is append-only, one row
-- per pair and day, governed by rate_date, and it never expires. A ledger's
-- audit trail cannot live in a table the boot sequence is licensed to drop, so
-- this file adds a second table and leaves exchange_rates untouched.
--
-- WHAT A ROW MEANS
--
-- One row is one fact: on rate_date, one unit of base bought exchange_rate
-- units of target, according to source. rate_date is the provider's own
-- reference date — the day the rate was in force — and fetched_at is when this
-- installation retrieved it. They are different facts and both are kept.
--
-- No row is ever written for a day the provider did not quote. A movement dated
-- Sunday 2026-08-30 is valued from the Friday 2026-08-28 row by the resolver's
-- rate_date <= requested lookup; writing a 2026-08-30 row holding Friday's
-- number would record a rate as belonging to a day it was not in force on,
-- which is the same ground interpolation is refused on.
--
-- NO DATA STEPS
--
-- The table is created empty and filled lazily by the resolver, one provider
-- range call at a time. Backfilling it here would mean asking an upstream
-- provider for history during a migration, and a migration that depends on a
-- third-party host is one that fails when the host does.
--
-- ---------------------------------------------------------------------------
-- UP
-- ---------------------------------------------------------------------------
--
-- source is VARCHAR(30) to match exchange_rates.source, and holds the provider
-- name alone. The requested-to-effective pair belongs to the transaction that
-- used the rate, not to the rate itself: the same row serves many requested
-- dates.
--
-- No CHECK that rate_date is not in the future. A CHECK expression must be
-- immutable and CURRENT_DATE is not, so that rule is enforced by the resolver.
CREATE TABLE IF NOT EXISTS daily_exchange_rates (
 daily_rate_id      SERIAL PRIMARY KEY,
 base_currency_id   INTEGER NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 target_currency_id INTEGER NOT NULL
  REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 rate_date          DATE          NOT NULL,
 exchange_rate      DECIMAL(18,8) NOT NULL CHECK (exchange_rate > 0),
 source             VARCHAR(30)   NOT NULL,
 fetched_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

 -- Named rather than auto-generated so the boot-time ensureDailyExchangeRates
 -- DDL and this file produce the same constraint name on every database.
 --
 -- This is not index tuning. It is what makes two simultaneous submits needing
 -- the same absent day safe: both miss, both call the provider, both insert,
 -- and the second collapses onto the first's row instead of duplicating it.
 CONSTRAINT uq_daily_exchange_rate UNIQUE (base_currency_id, target_currency_id, rate_date)
);

-- No second index. The unique constraint's B-tree is already the index the only
-- read this table has uses: base and target equal on the leading columns, then
-- rate_date scanned backwards for the greatest value not after the requested
-- day, LIMIT 1.

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
--
-- Fully reversible. The UP is one CREATE TABLE with no data steps, nothing
-- references this table by foreign key, and nothing outside the FX resolver
-- reads it, so dropping it restores the previous state exactly. What is lost is
-- the accumulated rate history, which is re-fetchable from the provider.
--
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- DROP TABLE IF EXISTS daily_exchange_rates;
-- DELETE FROM migrations WHERE filename = '021_create_daily_exchange_rates.sql';
-- COMMIT;
