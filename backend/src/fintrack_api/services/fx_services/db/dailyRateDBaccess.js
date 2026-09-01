// backend/src/fintrack_api/services/fx_services/db/dailyRateDBaccess.js
/**
 * Historical FX Rate Store — data access.
 *
 * Reads and writes daily_exchange_rates, the append-only record of what a rate
 * was on a given day. Created by migration 021 and by
 * ensureDailyExchangeRatesTable at boot.
 *
 * NOT the same store as fxDBaccess.js. That one caches the CURRENT rate in
 * exchange_rates: one mutable row per pair, governed by fetched_at and a TTL,
 * and dropped outright when RESET_EXCHANGE_RATES is set. This one is the
 * history a back-dated movement is valued from, so it has to survive that
 * reset. The two never share a table and neither reads the other's.
 *
 * Its caller is the cascade resolver, core/historicalRateResolver.js, which
 * both reads from here and writes back every row a provider range returned.
 *
 * It also owns exchange_rate_query_coverage, created by migration 023, which
 * records WHICH DAY RANGES were actually asked of a provider. The two tables are
 * read together and written together: an observation says what a rate was, and
 * coverage says whether the period around it was ever downloaded. Only both
 * together make a walk-back to an older day mean anything.
 */

import { pool } from '../../../../db/config/configDB.js';
import { FALLBACK_RATE_SOURCE } from '../core/fxConfig.js';

/**
 * How far back a stored row may be from the requested day before it stops
 * counting as an answer.
 *
 * The lookup cannot tell a row that is missing because the market was closed
 * from a row that is missing because nothing was ever fetched for that stretch.
 * Without a bound, an empty store would answer January with a rate from the
 * previous year. Five days is the same bound the provider walk-back uses: it
 * clears the longest run of closed days a market produces and refuses anything
 * longer.
 */
export const MAX_RATE_AGE_DAYS = 5;

/**
 * @typedef {Object} DailyRateRow
 * @property {string} rateDate - The day the rate was in force, YYYY-MM-DD.
 * @property {string|number} rate - The rate itself.
 * @property {string} source - Provider name, at most 30 characters.
 */

/**
 * @typedef {Object} DailyRateHit
 * @property {string} rate - The rate, as DECIMAL text.
 * @property {string} rateDate - The day it was in force, YYYY-MM-DD.
 * @property {string} source - Which provider supplied it.
 * @property {number} daysBack - Requested day minus rateDate, in days.
 */

/**
 * Format a Date or an ISO-ish string as the YYYY-MM-DD calendar day.
 * Kept local: this store speaks calendar days, never instants.
 * @param {Date|string} value
 * @returns {string|null} null when the value states no calendar day.
 */
const toCalendarDay = (value) => {
 if (typeof value === 'string') {
  const trimmed = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
 }
 if (value instanceof Date && !Number.isNaN(value.getTime())) {
  return value.toISOString().slice(0, 10);
 }
 return null;
};

/**
 * Find the rate to value a movement dated on the requested day.
 *
 * Resolution, not lookup: the answer is the most recent row whose rate_date is
 * not after the requested day. A Sunday is answered by the preceding Friday,
 * which is why no row is ever written for a day the provider did not quote.
 *
 * Both bounds are in the statement, so a row that exists but is too old comes
 * back as zero rows — a miss the caller handles by calling the provider, not a
 * hit it has to second-guess.
 *
 * The row must also be COVERED. Walking back from the requested day to an older
 * row asserts that every day in between was absent from the provider, and that
 * assertion is only true if those days were ever asked for. An absent day inside
 * a queried span is a real absence; outside one it means nothing. Without the
 * coverage test the walk-back served a superseded rate — measured on the peso at
 * +2.46% for 2026-08-20, inside the age bound, so nothing rejected it.
 *
 * Coverage is matched on the source of the row itself: having queried one
 * provider over August proves nothing about another, which publishes on its own
 * calendar. The exclusion constraint on the coverage table guarantees at most
 * one row can contain a given span for a source and pair, so EXISTS is exact.
 *
 * Since 024 a day may hold one observation per provider, so the ordering has to
 * choose between them and not merely between days. The CDN goes last: it is
 * asked for a single day and answers with a cross recomputed from the accounting
 * currency, while a national source publishes the figure itself. Among the rest
 * the most recently fetched wins, and the provider name breaks the final tie —
 * not because either is meaningful, but because a read that feeds a ledger must
 * return the same row every time it is run.
 *
 * The rate is returned as DECIMAL text, exactly as Postgres delivers it. This
 * store feeds a ledger, and parsing to a float here would round at the module
 * boundary, before the caller has decided on its own precision.
 *
 * @param {number} baseCurrencyId
 * @param {number} targetCurrencyId
 * @param {Date|string} requestedDate - The movement's own date.
 * @param {number} [maxAgeDays=MAX_RATE_AGE_DAYS]
 * @returns {Promise<DailyRateHit|null>} null on a miss.
 */
export async function findDailyRate(
 baseCurrencyId,
 targetCurrencyId,
 requestedDate,
 maxAgeDays = MAX_RATE_AGE_DAYS,
) {
 const day = toCalendarDay(requestedDate);
 if (!day) {
  throw new Error(`Invalid requested date for rate lookup: ${requestedDate}`);
 }

 const { rows } = await pool.query(
  `
    SELECT exchange_rate,
           TO_CHAR(rate_date, 'YYYY-MM-DD') AS rate_date,
           source,
           ($3::date - rate_date)           AS days_back
      FROM daily_exchange_rates d
     WHERE base_currency_id = $1
       AND target_currency_id = $2
       AND rate_date <= $3::date
       AND rate_date >= $3::date - $4::int
       AND EXISTS (
             SELECT 1
               FROM exchange_rate_query_coverage c
              WHERE c.source             = d.source
                AND c.base_currency_id   = d.base_currency_id
                AND c.target_currency_id = d.target_currency_id
                AND c.covered @> daterange(d.rate_date, $3::date + 1, '[)')
           )
     ORDER BY rate_date DESC,
              (source = $5) ASC,
              fetched_at DESC,
              source ASC
     LIMIT 1
    `,
  [baseCurrencyId, targetCurrencyId, day, maxAgeDays, FALLBACK_RATE_SOURCE],
 );

 if (rows.length === 0) return null;

 const row = rows[0];
 return {
  rate: row.exchange_rate,
  rateDate: row.rate_date,
  source: row.source,
  daysBack: row.days_back,
 };
}

/**
 * Persist every row a provider range call returned, each under its own
 * effective date.
 *
 * The whole response is stored, not only the day the movement needed. The call
 * has already been made; keeping the other rows is one statement and saves
 * every later movement of that month a network round trip.
 *
 * ON CONFLICT DO NOTHING, never DO UPDATE. A past rate is a fact that does not
 * change, so a re-fetch must not rewrite what is already recorded. It is also
 * what makes two simultaneous submits for the same absent day safe: both miss,
 * both call the provider, both insert, and the second collapses onto the
 * first's row.
 *
 * A row whose day the provider did not state is dropped rather than assigned
 * one. The effective date always comes from the source that supplied the rate.
 *
 * @param {DailyRateRow[]} rateRows
 * @param {number} baseCurrencyId
 * @param {number} targetCurrencyId
 * @returns {Promise<{stored: number, source: string}>} How many rows were
 *   newly written, and the provider they were written under — the caller needs
 *   the second to record coverage under the same name the rows carry. A stored
 *   count of zero is legitimate: every row was already known. A source of
 *   'unknown' with zero stored means nothing usable arrived.
 */
export async function persistDailyRates(
 rateRows,
 baseCurrencyId,
 targetCurrencyId,
 client = pool,
) {
 if (!rateRows?.length) return { stored: 0, source: 'unknown' };

 // Today in UTC, the calendar the provider's reference dates are stated in.
 const todayUtc = new Date().toISOString().slice(0, 10);

 const days = [];
 const rates = [];
 let source = null;

 for (const item of rateRows) {
  const day = toCalendarDay(item.rateDate);
  if (!day) {
   console.warn(`Skipping rate with no effective date: ${item.rateDate}`);
   continue;
  }

  // The table cannot express this as a CHECK — a CHECK expression must be
  // immutable and CURRENT_DATE is not — so the invariant is enforced here.
  if (day > todayUtc) {
   console.warn(`Skipping rate dated in the future: ${day}`);
   continue;
  }

  const numericRate = Number(item.rate);
  if (!Number.isFinite(numericRate) || numericRate <= 0) {
   console.warn(`Skipping invalid rate for ${day}: ${item.rate}`);
   continue;
  }

  days.push(day);
  // The provider's own string, not the parsed number: the parse above only
  // validates, it does not decide the precision that reaches the column.
  rates.push(String(item.rate));
  source = source ?? item.source;
 }

 if (days.length === 0) return { stored: 0, source: 'unknown' };

 // One statement over the whole range. UNNEST pairs the two arrays
 // positionally, so the insert is atomic on its own; a caller that also has
 // coverage to write passes its client and gets both under one commit.
 const { rowCount } = await client.query(
  `
    INSERT INTO daily_exchange_rates (
      base_currency_id,
      target_currency_id,
      rate_date,
      exchange_rate,
      source
    )
    SELECT $1, $2, d.rate_date, d.exchange_rate, $5
      FROM UNNEST($3::date[], $4::numeric[]) AS d(rate_date, exchange_rate)
    ON CONFLICT ON CONSTRAINT uq_daily_exchange_rate DO NOTHING
    `,
  [baseCurrencyId, targetCurrencyId, days, rates, source || 'unknown'],
 );

 console.log(
  `Rate history: ${rowCount} new of ${days.length} returned (${rateRows.length - days.length} skipped)`,
 );

 return { stored: rowCount, source: source || 'unknown' };
}

/**
 * Record that one provider was asked for one currency pair over one span of
 * days, and answered.
 *
 * What it asserts and what it does not. The row is a fact about this
 * installation's own network traffic: on fetched_at we asked <source> for
 * <base>/<target> over <covered>. It says nothing about any rate, and nothing
 * about how long a rate stays valid. It is what lets the resolver tell "the
 * provider published nothing that day" from "we never downloaded that period".
 *
 * Why the lock and the constraint are both here and are not the same thing. The
 * advisory lock is transaction-scoped and keyed on the provider and the pair, so
 * two submits that queried overlapping spans serialise instead of both reading
 * the same neighbours and each writing a merged row over them — the phantom the
 * read-merge-write is exposed to when neither row exists yet. The exclusion
 * constraint on the table is the structural guarantee underneath: whatever gets
 * built later, no two rows for one provider and pair can overlap. Overlapping
 * rows would make the coverage test ambiguous, and an ambiguous coverage test is
 * worse than none because it reports a hit it cannot back.
 *
 * The merge is one statement. Every stored span that overlaps OR touches the new
 * one is deleted and its bounds folded in, so the set stays one row per
 * contiguous interval and the constraint never has to reject anything. Adjacency
 * matters as much as overlap: August and September stored apart would answer no
 * to a span crossing the 31st, though every one of its days was queried. With no
 * neighbours the aggregate is over zero rows, LEAST and GREATEST ignore the
 * NULLs, and the new span is inserted as it stands.
 *
 * @param {object} client - A client already inside a transaction.
 * @param {Object} span
 * @param {number} span.baseCurrencyId
 * @param {number} span.targetCurrencyId
 * @param {string} span.source - The provider that answered.
 * @param {string} span.from - First day asked for, 'YYYY-MM-DD'.
 * @param {string} span.to - Last day asked for, INCLUSIVE.
 * @returns {Promise<void>}
 */
export async function recordQueryCoverage(
 client,
 { baseCurrencyId, targetCurrencyId, source, from, to },
) {
 // The same key space the exclusion constraint uses, so the writers that can
 // collide are exactly the ones that wait for each other.
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
  `${source}:${baseCurrencyId}:${targetCurrencyId}`,
 ]);

 // to + 1 and not to + INTERVAL '1 day': adding an interval to a date yields a
 // timestamp and there is no daterange(date, timestamp). The upper bound is the
 // day after the last day asked for, because the half-open form excludes it.
 await client.query(
  `
    WITH asked AS (
      SELECT daterange($4::date, $5::date + 1, '[)') AS span
    ),
    absorbed AS (
      DELETE FROM exchange_rate_query_coverage c
       USING asked a
       WHERE c.source             = $3
         AND c.base_currency_id   = $1
         AND c.target_currency_id = $2
         AND (c.covered && a.span OR c.covered -|- a.span)
      RETURNING c.covered
    )
    INSERT INTO exchange_rate_query_coverage
           (base_currency_id, target_currency_id, source, covered)
    SELECT $1, $2, $3,
           daterange(
             LEAST(MIN(lower(covered)), (SELECT lower(span) FROM asked)),
             GREATEST(MAX(upper(covered)), (SELECT upper(span) FROM asked)),
             '[)')
      FROM absorbed
    `,
  [baseCurrencyId, targetCurrencyId, source, from, to],
 );
}

/**
 * Store what a provider returned and the span it was asked for, under one
 * commit.
 *
 * The two writes cannot be separated. Observations without coverage are rows the
 * resolver will never read; coverage without observations claims a period was
 * downloaded when it was not. Either half alone is a lie about the store, so
 * they share a transaction and a failure takes both.
 *
 * A span answered with no usable row writes NOTHING, coverage included. An empty
 * answer is indistinguishable from a provider that returned a success with an
 * empty body, and coverage is never invalidated by anything: recording it would
 * mark that period permanently as asked-and-empty, so no later request would
 * ever go back and the store could not recover from one bad response. Asking
 * again costs a call; recording a false emptiness costs correctness for good.
 *
 * @param {Object} args
 * @param {DailyRateRow[]} args.rateRows - What the provider returned.
 * @param {number} args.baseCurrencyId
 * @param {number} args.targetCurrencyId
 * @param {string} args.from - First day asked for, 'YYYY-MM-DD'.
 * @param {string} args.to - Last day asked for, inclusive.
 * @returns {Promise<number>} Rows newly stored. Zero is legitimate: every
 *   observation was already known, and the span is recorded all the same.
 */
export async function persistQueriedRange({
 rateRows,
 baseCurrencyId,
 targetCurrencyId,
 from,
 to,
}) {
 if (!rateRows?.length) return 0;

 const client = await pool.connect();

 try {
  await client.query('BEGIN');

  const { stored, source } = await persistDailyRates(
   rateRows,
   baseCurrencyId,
   targetCurrencyId,
   client,
  );

  // Nothing the provider sent was usable, so nothing was learnt about the span.
  if (source === 'unknown' && stored === 0) {
   await client.query('ROLLBACK');
   return 0;
  }

  await recordQueryCoverage(client, {
   baseCurrencyId,
   targetCurrencyId,
   source,
   from,
   to,
  });

  await client.query('COMMIT');

  return stored;
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
}

/**
 * The most recent day, on or before the requested one, that any source has
 * actually published a rate for — in any pair, not just the one being valued.
 *
 * This is how a business day is known without a holiday calendar. Banca
 * d'Italia is the app's business-day oracle: it answers nothing on a day with
 * no market, so every rate_date in this table is a day some market was open,
 * and the set of them accumulates across currencies as movements are valued.
 *
 * Its one caller is the CDN arm of the cascade, which may only be asked for an
 * effective date that a real source established. Reading that date out of this
 * table is what keeps the rule intact: the CDN never fabricates a date, it is
 * handed one that another provider published. When the table holds nothing
 * inside the bound, the answer is null and that arm simply does not run.
 *
 * @param {Date|string} requestedDate
 * @param {number} [maxAgeDays=MAX_RATE_AGE_DAYS]
 * @returns {Promise<string|null>} 'YYYY-MM-DD', or null when no day is known.
 */
export async function findLatestBusinessDay(
 requestedDate,
 maxAgeDays = MAX_RATE_AGE_DAYS,
) {
 const day = toCalendarDay(requestedDate);
 if (!day) {
  throw new Error(`Invalid requested date for business day lookup: ${requestedDate}`);
 }

 const { rows } = await pool.query(
  `
    SELECT TO_CHAR(MAX(rate_date), 'YYYY-MM-DD') AS rate_date
      FROM daily_exchange_rates
     WHERE rate_date <= $1::date
       AND rate_date >= $1::date - $2::int
    `,
  [day, maxAgeDays],
 );

 return rows[0]?.rate_date || null;
}

/**
 * Whether asking a source for one day could still write anything.
 *
 * A provider call is worth making only if its result can change what the store
 * answers. It cannot when both halves of that answer are already there: a row
 * exists for the pair on that day, so the insert loses to it and immutability
 * keeps the older observation; and the span covering that day is already
 * recorded for that source, so the coverage write adds nothing either. The read
 * that follows then returns exactly what it returned before the call.
 *
 * This is not a cache and it is not a freshness rule. A past day's figure cannot
 * change, so there is nothing to refresh; the question is only whether the two
 * writes have any work left to do.
 *
 * The row is matched ON ITS SOURCE, which is what makes this the same question
 * findDailyRate asks, restricted to a single day. It was written matching the
 * row without its source, on the reasoning that a day holding ANOTHER
 * provider's observation was a day this one could not overwrite either. That
 * was true of the key 021 wrote and it is no longer true: since 024 an
 * observation is unique per provider, so a second provider's call does have
 * something to write. Worse, while it held, this function reported SETTLED for
 * a day whose only row findDailyRate refuses — and the arm that would have
 * repaired it was skipped, turning a recoverable gap into a permanent 422.
 *
 * A guard over a read must ask the read's own question. Any weaker predicate
 * suppresses a call the read still needs.
 *
 * @param {number} baseCurrencyId
 * @param {number} targetCurrencyId
 * @param {string} day - 'YYYY-MM-DD', the day the source would be asked for.
 * @param {string} source - The name the call would store its coverage under.
 * @returns {Promise<boolean>} true when the call cannot change the answer.
 */
export async function isDaySettled(
 baseCurrencyId,
 targetCurrencyId,
 day,
 source,
) {
 const { rows } = await pool.query(
  `
    SELECT EXISTS (
             SELECT 1
               FROM daily_exchange_rates
              WHERE base_currency_id   = $1
                AND target_currency_id = $2
                AND rate_date          = $3::date
                AND source             = $4
           )
       AND EXISTS (
             SELECT 1
               FROM exchange_rate_query_coverage
              WHERE base_currency_id   = $1
                AND target_currency_id = $2
                AND source             = $4
                AND covered @> daterange($3::date, $3::date + 1, '[)')
           ) AS settled
    `,
  [baseCurrencyId, targetCurrencyId, day, source],
 );

 return rows[0]?.settled === true;
}
