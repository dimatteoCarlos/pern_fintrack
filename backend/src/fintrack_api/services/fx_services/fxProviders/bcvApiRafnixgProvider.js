// backend/src/fintrack_api/services/fx_services/fxProviders/bcvApiRafnixgProvider.js

// 🇻🇪 BCV PROVIDER — the official Venezuelan source for the bolivar
// ================================================================

/**
 * The rate the Banco Central de Venezuela published, read through the community
 * API that scrapes bcv.org.ve and keeps a dated record of what it saw.
 *
 * WHY THIS ARM EXISTS. Before it, a back-dated bolivar movement was valued by
 * the CDN of last resort, which recomputes a cross rather than reporting what a
 * national source published. Measured against the curated series in bcv_data.js
 * over 2026-06-01..2026-09-01: the CDN sat BELOW the BCV on 63 of 63 days, mean
 * gap 0.54%, worst 3.40%, with not one exact match. The bias is not noise — the
 * CDN's figure for a day fits the BCV's PREVIOUS published day more than twice
 * as well as it fits the day asked for. On a currency devaluing this fast, that
 * is a systematically undervalued ledger.
 *
 * The same measurement against this API: 34 of 37 comparable days identical to
 * the fourth decimal, the three exceptions in a stale stretch at the start of
 * July. It is the right source for this currency.
 *
 * WHY NOT THE URL THE ENVIRONMENT USED TO NAME. BCV_API_BASE_URL pointed at
 * bcv-api.rafnixg.dev, whose author states in his own README that the service
 * is retired and its endpoints are down; DNS confirms the host publishes no
 * address record at all. He names dolar-vzla.rafnixg.dev as its replacement,
 * which is live and is what the default below points at. The variable keeps its
 * name so an operator can still redirect it, including at a self-hosted copy.
 *
 * WHAT THE ENDPOINT ACTUALLY RETURNS, and why this file is not a thin wrapper:
 * it answers a POLLING LOG, not a daily series. Several rows carry the same
 * calendar day, one per scrape, and `date` is the instant of the scrape rather
 * than a validity. Collapsing that to one row per day is the first thing any
 * caller has to do, so it is done here, once.
 *
 * A row dated on a weekend is kept rather than dropped. It is not an invented
 * day: the BCV portal shows the rate in force, and a scrape on Saturday records
 * that the in-force official rate that Saturday was that figure. That is what a
 * ledger needs, and it is the coverage the CDN arm can never assert, because it
 * is asked for a single day and cannot speak for a span.
 *
 * Rows come back in the shape the historical store writes — rateDate, rate,
 * source — so the caller hands the array straight to persistDailyRates. The
 * rate stays a string; parsing it here would round the figure at the module
 * boundary, before the ledger has chosen its precision.
 */

import axios from 'axios';

import { BCV_RATE_SOURCE, OFFICIAL_BCV_CURRENCY } from '../core/fxConfig.js';

// The service the rate is read from. Trailing slashes are stripped so the paths
// below compose the same way whatever an operator writes in the environment.
const API_BASE_URL = (
 process.env.BCV_API_BASE_URL || 'https://dolar-vzla.rafnixg.dev'
).replace(/\/+$/, '');

const HISTORY_URL = `${API_BASE_URL}/api/v1/history/bcv`;

// The retired host, named so the failure explains itself. Pointed at it, this
// arm can only produce a DNS error, which reaches the cascade's 422 as an
// opaque ENOTFOUND and sends the reader looking for a network fault that is not
// there. The environment is not silently overridden -- an operator's setting is
// his -- but he is told exactly what is wrong with it and what to put instead.
const RETIRED_HOST = 'bcv-api.rafnixg.dev';

function assertHostIsNotRetired() {
 if (API_BASE_URL.includes(RETIRED_HOST)) {
  throw new Error(
   `BCV_API_BASE_URL points at ${RETIRED_HOST}, which its author retired and ` +
    'which publishes no DNS address; set it to https://dolar-vzla.rafnixg.dev ' +
    'or leave it blank to use that default',
  );
 }
}

const FX_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

// What the endpoint calls the dollar. Its currency parameter is an enum in
// Spanish — 'dolar', 'euro', 'yuan', 'lira', 'rublo' — and anything else comes
// back as a 422 naming the five it accepts.
const DOLLAR_PARAMETER = 'dolar';

// One request has to bring back a whole span, and the span is a month plus a
// few days of margin polled several times a day. The ceiling is generous enough
// that a span is never silently truncated into a hole the caller would read as
// a day the BCV did not publish.
const MAX_ROWS = 1000;

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The calendar day a value names, or null.
 *
 * The API's `date` is an ISO instant with no zone marker, written by a scraper
 * running on Caracas time. Slicing the first ten characters reads the day the
 * scraper meant; parsing it into a Date would attach this machine's zone to a
 * label that never had one and could shift it by a day.
 *
 * @param {string} value
 * @returns {string|null} YYYY-MM-DD
 */
function toCalendarDay(value) {
 if (typeof value !== 'string') return null;

 const day = value.slice(0, 10);

 return CALENDAR_DAY.test(day) ? day : null;
}

/**
 * A finite positive number, or null.
 *
 * The rate arrives as a JSON number from this endpoint, but the same shape is
 * served by self-hosted copies that emit it as text, so both are accepted. A
 * decimal comma is read as a decimal point: the upstream is Venezuelan and a
 * copy that forwards the portal's own formatting would otherwise parse as a
 * whole number several hundred times too small.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
function toRate(value) {
 let parsed = null;

 if (typeof value === 'number') {
  parsed = value;
 } else if (typeof value === 'string') {
  parsed = Number(value.trim().replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
 }

 return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Every rate the BCV had in force across a span, one row per calendar day.
 *
 * Serves the bolivar only. The endpoint does publish the euro, the yuan, the
 * lira and the rouble, but each of those is quoted as bolivars per unit of that
 * currency, and the store is USD-based: turning them into usd->x would compose
 * two quotes and put a cross from a national source under that source's name.
 * The dollar row needs no such arithmetic — bolivars per dollar IS the usd->ves
 * rate the store holds.
 *
 * @param {string} currency - Target currency code; only 'ves' is served
 * @param {string} startDate - First day of the span, 'YYYY-MM-DD'
 * @param {string} endDate - Last day of the span, 'YYYY-MM-DD'
 * @param {Object} [options] - Time budget
 * @param {number} [options.deadlineAt] - Absolute epoch ms the cascade may not pass
 * @param {number} [options.timeoutMs] - Call timeout, defaults to FX_REQUEST_TIMEOUT_MS
 * @returns {Promise<Array<{rateDate: string, rate: string, source: string}>>}
 * @throws {Error} - On an unsupported currency, an invalid span, an exceeded
 *  deadline, network failure or a malformed payload
 */
export async function fetchBcvRange(currency, startDate, endDate, options = {}) {
 const code = typeof currency === 'string' ? currency.toLowerCase() : '';

 if (code !== OFFICIAL_BCV_CURRENCY) {
  throw new Error(`BCV does not serve currency: ${currency}`);
 }

 const from = toCalendarDay(startDate);
 const to = toCalendarDay(endDate);

 if (!from || !to) {
  throw new Error(`Invalid BCV span requested: ${startDate}..${endDate}`);
 }

 if (from > to) {
  throw new Error(`BCV span ends before it starts: ${from}..${to}`);
 }

 let timeoutMs =
  Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : FX_TIMEOUT_MS;

 // One call, so the cascade budget caps it once instead of per step.
 if (Number.isFinite(options.deadlineAt)) {
  const remainingMs = options.deadlineAt - Date.now();

  if (remainingMs <= 0) {
   throw new Error(`BCV aborted for ${from}..${to}: cascade deadline reached`);
  }

  timeoutMs = Math.min(timeoutMs, remainingMs);
 }

 assertHostIsNotRetired();

 const response = await axios.get(HISTORY_URL, {
  timeout: timeoutMs,
  headers: { Accept: 'application/json' },
  params: {
   currency: DOLLAR_PARAMETER,
   start_date: from,
   end_date: to,
   limit: MAX_ROWS,
  },
 });

 const payload = response.data;
 const rows = payload && Array.isArray(payload.currencies) ? payload.currencies : null;

 if (!rows) {
  throw new Error(`BCV returned a malformed payload for ${from}..${to}`);
 }

 // The log is served newest first, and the last scrape of a day is the one that
 // carries what the BCV finally had in force that day, so the first row seen for
 // a day wins. Sorting is not assumed: the newest instant per day is chosen
 // explicitly, which is correct whichever order the endpoint answers in.
 const latestPerDay = new Map();

 for (const row of rows) {
  const day = toCalendarDay(row?.date);
  const rate = toRate(row?.rate);

  if (!day || rate === null) continue;

  // A span the caller did not ask for must not enter the store: the coverage it
  // records is exactly from..to, and a row outside it would be written as an
  // observation nothing can ever prove was queried.
  if (day < from || day > to) continue;

  const seen = latestPerDay.get(day);

  if (!seen || String(row.date) > seen.at) {
   latestPerDay.set(day, { at: String(row.date), rate });
  }
 }

 const series = [...latestPerDay.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([rateDate, { rate }]) => ({
   rateDate,
   rate: String(rate),
   source: BCV_RATE_SOURCE,
  }));

 console.log(
  `[FX] BCV ${from}..${to}: ${series.length} days from ${rows.length} observations`,
 );

 return series;
}
