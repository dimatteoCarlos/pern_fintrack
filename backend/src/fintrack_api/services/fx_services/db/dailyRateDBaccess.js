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
 * Nothing imports this module yet. The cascade resolver is its first caller.
 */

import { pool } from '../../../../db/config/configDB.js';

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
      FROM daily_exchange_rates
     WHERE base_currency_id = $1
       AND target_currency_id = $2
       AND rate_date <= $3::date
       AND rate_date >= $3::date - $4::int
     ORDER BY rate_date DESC
     LIMIT 1
    `,
  [baseCurrencyId, targetCurrencyId, day, maxAgeDays],
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
 * @returns {Promise<number>} Rows newly stored. Zero is a legitimate result:
 *   every row was already known.
 */
export async function persistDailyRates(
 rateRows,
 baseCurrencyId,
 targetCurrencyId,
) {
 if (!rateRows?.length) return 0;

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

 if (days.length === 0) return 0;

 // One statement over the whole range. UNNEST pairs the two arrays
 // positionally, so the insert is atomic without an explicit transaction.
 const { rowCount } = await pool.query(
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

 return rowCount;
}
