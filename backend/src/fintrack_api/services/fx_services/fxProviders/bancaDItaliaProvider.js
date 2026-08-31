// backend/src/fintrack_api/services/fx_services/fxProviders/bancaDItaliaProvider.js

// 🇮🇹 Banca d'Italia provider (universal historical arm)
/**
 * Universal historical provider. Serves the daily reference rates published by
 * Banca d'Italia on its "tassi di cambio" portal, one currency per call, with
 * no API key.
 *
 * It covers eur, mxn and ves, and it also covers cop as the fallback for when
 * the official Colombian source (banrepTrmProvider) fails.
 *
 * It is also the application's business-day oracle. The source answers with an
 * empty array on a day with no market, so stepping back one day and retrying
 * resolves a Saturday, a Colombian holiday and Christmas by the same mechanism,
 * and no holiday calendar is needed anywhere in the app. The walk-back lives
 * here and nowhere else; every other arm inherits the effective date it returns.
 *
 * - fetchBancaDItaliaRate(currency, date, options)
 *     → { rate, source, requestedDate, effectiveDate, stepsWalkedBack, ... }
 * - fetchBancaDItaliaRange(currency, startDate, endDate, options)
 *     → [ { rateDate, rate, source }, ... ], one row per published day
 *
 * The walk-back serves one figure; the range serves the store. Neither
 * replaces the other and both are called.
 *
 * Payload row:
 * { isoCode: 'VES', avgRate: '510.1488', referenceDate: '2026-05-14',
 *   exchangeConventionCode: 'C' }
 * Convention 'C' reads "foreign currency amount for 1 Dollar", which is the
 * usd -> currency direction this app stores; any other convention is refused
 * rather than inverted on a guess.
 */

import axios from 'axios';

const DAILY_RATES_URL =
 'https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0/dailyRates';

const FX_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

// One attempt is one calendar day, so five attempts walk five days back at most.
const MAX_WALK_BACK_STEPS = 5;

// The published quote direction this app stores: units of currency per 1 USD.
const USD_BASE_CONVENTION = 'C';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Host reachability ───────────────────────────────────────────────────────
//
// Both endpoints below live on one host, so one of them failing to CONNECT
// tells the other something. Measured 2026-08-31 from a development machine:
// DNS resolves, the TCP handshake on 443 never completes, and every call spends
// its whole timeout before the cascade moves on — about 2s of a 5s budget burnt
// on a host that is not answering, once per currency per uncovered day.
//
// This remembers only that, and only briefly. It is NOT a judgement that the
// provider is gone: the window is short so a host that is merely flaky is tried
// again almost immediately, which matters because this provider is preferred —
// it is the app's business-day oracle and it never invents movement on a closed
// day.
const HOST_RETRY_AFTER_MS = 60_000;

let hostUnreachableUntil = 0;

// Only a failure to REACH the host counts. An HTTP status or a malformed body
// means the host answered and the fault is elsewhere; skipping the provider for
// those would hide a bug instead of saving time.
const CONNECTION_FAILURE_CODES = new Set([
 'ECONNABORTED',
 'ECONNREFUSED',
 'ECONNRESET',
 'EAI_AGAIN',
 'EHOSTUNREACH',
 'ENETUNREACH',
 'ENOTFOUND',
 'ETIMEDOUT',
 'ERR_NETWORK',
]);

/**
 * Refuse the call outright while the host is known to be unreachable.
 * @throws {Error} - Named so the cascade's diagnostics say skipped, not failed.
 */
function assertHostReachable() {
 if (Date.now() < hostUnreachableUntil) {
  const seconds = Math.ceil((hostUnreachableUntil - Date.now()) / 1000);

  throw new Error(
   `Banca d'Italia skipped: the host did not connect, not retried for ${seconds}s`,
  );
 }
}

/**
 * Record what a request did to the host's reachability.
 * @param {Error|null} error - null on success.
 */
function noteHostOutcome(error) {
 if (!error) {
  hostUnreachableUntil = 0;
  return;
 }

 if (error.response) return;

 if (CONNECTION_FAILURE_CODES.has(error.code)) {
  hostUnreachableUntil = Date.now() + HOST_RETRY_AFTER_MS;
 }
}


const SUPPORTED_CURRENCIES = ['cop', 'eur', 'mxn', 'ves'];

/**
 * Normalize a requested day to the source's calendar day, 'YYYY-MM-DD'.
 *
 * A Date is refused rather than read: converting an instant to a calendar day
 * happens once, on the owner's calendar, before the value reaches this module.
 * Reading one here in UTC would resolve a 20:00 movement at UTC-5 to the next
 * day and stamp that wrong day as provenance.
 *
 * @param {string} value - 'YYYY-MM-DD' or an ISO timestamp opening with one
 * @returns {string|null}
 */
function toCalendarDay(value) {
 const day =
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
   ? value.slice(0, 10)
   : null;

 if (!day) return null;

 // Rejects a well-formed but impossible day such as '2026-02-31'.
 const parsed = new Date(`${day}T00:00:00.000Z`);

 if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
  return null;
 }

 return day;
}

/**
 * The calendar day before the given one, 'YYYY-MM-DD'.
 * @param {string} day - A validated 'YYYY-MM-DD' day
 * @returns {string}
 */
function previousDay(day) {
 const parsed = new Date(`${day}T00:00:00.000Z`);
 return new Date(parsed.getTime() - DAY_MS).toISOString().slice(0, 10);
}

/**
 * Request one day and report whether the market was open on it.
 *
 * An empty answer is a valid answer meaning "no market that day", so it is
 * returned as a value; only a transport failure throws. That distinction is
 * what lets the walk-back consume a step on emptiness and abort on a timeout.
 *
 * @param {string} isoCode - Upper-case ISO code, e.g. 'VES'
 * @param {string} day - 'YYYY-MM-DD'
 * @param {number} timeoutMs - Timeout for this single call
 * @returns {Promise<{rate: number, effectiveDate: string}|null>} - null when the day is empty
 * @throws {Error} - On network failure, timeout or a malformed payload
 */
async function fetchOneDay(isoCode, day, timeoutMs) {
 assertHostReachable();

 let response;

 try {
  response = await axios.get(DAILY_RATES_URL, {
   timeout: timeoutMs,
   headers: { Accept: 'application/json' },
   params: {
    referenceDate: day,
    baseCurrencyIsoCode: isoCode,
    currencyIsoCode: 'USD',
    lang: 'en',
   },
  });

  noteHostOutcome(null);
 } catch (error) {
  noteHostOutcome(error);
  throw error;
 }

 const rows = response.data && Array.isArray(response.data.rates)
  ? response.data.rates
  : null;

 if (!rows) {
  throw new Error(`Banca d'Italia returned a malformed payload for ${isoCode} on ${day}`);
 }

 // No market on that day. The caller steps back one day and asks again.
 if (rows.length === 0) return null;

 const row = rows[0];

 if (row.exchangeConventionCode !== USD_BASE_CONVENTION) {
  throw new Error(
   `Banca d'Italia quoted ${isoCode} on ${day} as '${row.exchangeConventionCode}', not per-USD`
  );
 }

 const rate = Number(row.avgRate);

 if (!Number.isFinite(rate) || rate <= 0) {
  throw new Error(`Invalid Banca d'Italia rate for ${isoCode} on ${day}: ${row.avgRate}`);
 }

 // The payload names the day it answered for; the requested day is only the ask.
 const effectiveDate = toCalendarDay(row.referenceDate) || day;

 return { rate, effectiveDate };
}

/**
 * Fetch the rate of one currency against the US dollar on a past day, walking
 * back to the last day the market was open.
 *
 * requestedDate is the day asked for and effectiveDate is the day that actually
 * supplied the figure; they differ on every weekend and holiday, and the caller
 * stores effectiveDate as provenance so a Saturday movement is never recorded
 * as if the market had been open.
 *
 * The time budget is the caller's, not this function's: deadlineAt is an
 * absolute epoch-ms ceiling for the whole cascade, checked before every call,
 * so five walk-back steps cannot add up to five independent full timeouts. A
 * transport failure or timeout aborts the arm immediately, because walking back
 * against a host that is not answering would only ask a dead server one day
 * earlier; only an empty answer consumes a step.
 *
 * @param {string} currency - Target currency code, e.g. 'ves' (case-insensitive)
 * @param {string} date - The requested day as a calendar label, 'YYYY-MM-DD'
 * @param {Object} [options] - Time budget
 * @param {number} [options.deadlineAt] - Absolute epoch ms the cascade may not pass
 * @param {number} [options.timeoutMs] - Per-call timeout, defaults to FX_REQUEST_TIMEOUT_MS
 * @returns {Promise<{rate: number, source: string, requestedDate: string, effectiveDate: string, stepsWalkedBack: number, fetchedAt: Date}>}
 * @throws {Error} - On an unsupported currency, an invalid day, network failure, an exhausted walk-back or an exceeded deadline
 */
export async function fetchBancaDItaliaRate(currency, date, options = {}) {
 const code = typeof currency === 'string' ? currency.toLowerCase() : '';

 if (!SUPPORTED_CURRENCIES.includes(code)) {
  throw new Error(`Banca d'Italia does not serve currency: ${currency}`);
 }

 const requestedDate = toCalendarDay(date);

 if (!requestedDate) {
  throw new Error(`Invalid Banca d'Italia date requested: ${date}`);
 }

 const isoCode = code.toUpperCase();
 const callTimeout = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : FX_TIMEOUT_MS;
 const deadlineAt = Number.isFinite(options.deadlineAt) ? options.deadlineAt : null;

 let day = requestedDate;

 for (let step = 0; step < MAX_WALK_BACK_STEPS; step += 1) {
  // The remaining budget caps this call, so the walk-back can never spend more
  // than the ceiling the caller set for the whole cascade.
  let timeoutMs = callTimeout;

  if (deadlineAt !== null) {
   const remainingMs = deadlineAt - Date.now();

   if (remainingMs <= 0) {
    throw new Error(
     `Banca d'Italia aborted for ${isoCode}: cascade deadline reached after ${step} step(s)`
    );
   }

   timeoutMs = Math.min(callTimeout, remainingMs);
  }

  let answer = null;

  try {
   answer = await fetchOneDay(isoCode, day, timeoutMs);
  } catch (error) {
   // A call cut by the shrunken budget must not read as the source being down.
   if (deadlineAt !== null && Date.now() >= deadlineAt) {
    throw new Error(
     `Banca d'Italia aborted for ${isoCode}: cascade deadline reached after ${step} step(s)`
    );
   }

   throw error;
  }

  if (answer) {
   console.log(
    `[FX] Banca d'Italia usd -> ${code} for ${requestedDate}: ${answer.rate} (effective ${answer.effectiveDate})`
   );

   return {
    rate: answer.rate,
    source: 'bancaditalia',
    requestedDate,
    effectiveDate: answer.effectiveDate,
    stepsWalkedBack: step,
    fetchedAt: new Date(),
   };
  }

  day = previousDay(day);
 }

 throw new Error(
  `No Banca d'Italia rate for ${isoCode} within ${MAX_WALK_BACK_STEPS} days back from ${requestedDate}`
 );
}

// The same portal's range endpoint: one call answers a whole span of days.
const TIME_SERIES_URL =
 'https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0/dailyTimeSeries';

/**
 * Fetch every published rate of one currency against the US dollar between two
 * days, inclusive.
 *
 * Why this exists beside fetchBancaDItaliaRate instead of replacing it: the
 * walk-back asks one day per request and stops at the first answer, which is
 * the right shape when a single figure is wanted and the wrong shape when the
 * answer is going to be stored. One range call costs the same round trip as one
 * walk-back step and brings the rest of the span back with it, so the days the
 * caller has not needed yet are already recorded when it needs them. The
 * walk-back stays: it is the natural second attempt if this endpoint errors.
 *
 * Rows come back in the shape the historical store writes - rateDate, rate,
 * source - so the caller hands the array straight to persistDailyRates. The
 * rate stays the provider's own string; parsing it here would round the figure
 * at the module boundary, before the ledger has chosen its precision.
 *
 * A day the market was closed is simply absent from the answer, and no row is
 * invented for it. The effective date always comes from the source that
 * supplied the rate.
 *
 * The quote convention is checked once on the envelope, not per row: this
 * endpoint states exchangeConventionCode in resultsInfo and gives each row only
 * the human legend, which is the reverse of the single-day endpoint above.
 *
 * @param {string} currency - Target currency code, e.g. 'eur' (case-insensitive)
 * @param {string} startDate - First day of the span, 'YYYY-MM-DD'
 * @param {string} endDate - Last day of the span, 'YYYY-MM-DD'
 * @param {Object} [options] - Time budget
 * @param {number} [options.deadlineAt] - Absolute epoch ms the cascade may not pass
 * @param {number} [options.timeoutMs] - Call timeout, defaults to FX_REQUEST_TIMEOUT_MS
 * @returns {Promise<Array<{rateDate: string, rate: string, source: string}>>}
 * @throws {Error} - On an unsupported currency, an invalid span, network failure,
 *  an exceeded deadline, a malformed payload or an unexpected quote convention
 */
export async function fetchBancaDItaliaRange(currency, startDate, endDate, options = {}) {
 const code = typeof currency === 'string' ? currency.toLowerCase() : '';

 if (!SUPPORTED_CURRENCIES.includes(code)) {
  throw new Error(`Banca d'Italia does not serve currency: ${currency}`);
 }

 const from = toCalendarDay(startDate);
 const to = toCalendarDay(endDate);

 if (!from || !to) {
  throw new Error(`Invalid Banca d'Italia span requested: ${startDate}..${endDate}`);
 }

 if (from > to) {
  throw new Error(`Banca d'Italia span ends before it starts: ${from}..${to}`);
 }

 const isoCode = code.toUpperCase();

 let timeoutMs =
  Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : FX_TIMEOUT_MS;

 // One call, so the cascade budget caps it once instead of per step.
 if (Number.isFinite(options.deadlineAt)) {
  const remainingMs = options.deadlineAt - Date.now();

  if (remainingMs <= 0) {
   throw new Error(`Banca d'Italia aborted for ${isoCode}: cascade deadline reached`);
  }

  timeoutMs = Math.min(timeoutMs, remainingMs);
 }

 assertHostReachable();

 let response;

 try {
  response = await axios.get(TIME_SERIES_URL, {
   timeout: timeoutMs,
   headers: { Accept: 'application/json' },
   params: {
    startDate: from,
    endDate: to,
    baseCurrencyIsoCode: isoCode,
    currencyIsoCode: 'USD',
    lang: 'en',
   },
  });

  noteHostOutcome(null);
 } catch (error) {
  noteHostOutcome(error);
  throw error;
 }

 const payload = response.data;
 const rows = payload && Array.isArray(payload.rates) ? payload.rates : null;

 if (!rows) {
  throw new Error(
   `Banca d'Italia returned a malformed payload for ${isoCode} on ${from}..${to}`
  );
 }

 // An empty span is a valid answer: no day in it was published. Whether that
 // counts as a miss is the caller's call, not this function's.
 if (rows.length === 0) {
  console.log(`[FX] Banca d'Italia usd -> ${code} for ${from}..${to}: no published day`);
  return [];
 }

 const convention = payload.resultsInfo?.exchangeConventionCode;

 if (convention !== USD_BASE_CONVENTION) {
  throw new Error(
   `Banca d'Italia quoted ${isoCode} on ${from}..${to} as '${convention}', not per-USD`
  );
 }

 const series = [];

 for (const row of rows) {
  const rateDate = toCalendarDay(row.referenceDate);

  // A row the source did not date cannot be stored under a date this app made
  // up, so it is dropped rather than assigned one.
  if (!rateDate) {
   console.warn(`Skipping undated Banca d'Italia row for ${isoCode}: ${row.referenceDate}`);
   continue;
  }

  series.push({ rateDate, rate: String(row.avgRate), source: 'bancaditalia' });
 }

 console.log(
  `[FX] Banca d'Italia usd -> ${code} for ${from}..${to}: ${series.length} published day(s)`
 );

 return series;
}
