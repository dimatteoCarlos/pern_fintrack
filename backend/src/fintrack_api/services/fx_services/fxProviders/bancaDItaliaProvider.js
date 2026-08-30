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
 const response = await axios.get(DAILY_RATES_URL, {
  timeout: timeoutMs,
  headers: { Accept: 'application/json' },
  params: {
   referenceDate: day,
   baseCurrencyIsoCode: isoCode,
   currencyIsoCode: 'USD',
   lang: 'en',
  },
 });

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
