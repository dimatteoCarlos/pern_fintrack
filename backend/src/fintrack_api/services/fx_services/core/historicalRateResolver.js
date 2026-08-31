// backend/src/fintrack_api/services/fx_services/core/historicalRateResolver.js
/**
 * Historical FX Rate Resolver — the cascade that values a back-dated movement.
 *
 * Answers one question: what was one unit of the accounting currency worth in
 * another currency on a day that has already passed. Every arm below already
 * existed and none of them had a caller; this module is what makes the
 * historical path reachable.
 *
 * It sits BESIDE fxProviderOrchestrator, not inside it. That one resolves the
 * CURRENT rate through a freshness cascade governed by TTLs. A historical rate
 * has no freshness — the figure for a past day is a fact that does not change —
 * so folding this into that cascade would put a time-to-live on something that
 * cannot expire.
 *
 * Two invariants govern the whole file:
 *
 * 1. No source may fabricate an effective date. The date always comes from the
 *    provider that actually supplied the rate. A day with no market is answered
 *    by the last day that had one, and the record names that day.
 * 2. A past movement is never valued at today's rate. When no arm answers, the
 *    resolver raises a 422 and the caller refuses the movement. Falling through
 *    to the current rate would silently record a figure no market quoted.
 */

import { ACCOUNTING_CURRENCY_CODE, SUPPORTED_CURRENCIES } from './fxConfig.js';

import { createError } from '../../../../utils/errorHandling.js';
import { getCurrencyId } from '../../../../utils/currencyLookup.js';

import {
 MAX_RATE_AGE_DAYS,
 findDailyRate,
 findLatestBusinessDay,
 persistDailyRates,
} from '../db/dailyRateDBaccess.js';

import { fetchBancaDItaliaRange } from '../fxProviders/bancaDItaliaProvider.js';
import { fetchTrmForDate } from '../fxProviders/banrepTrmProvider.js';
import { fetchRatesForDate } from '../fxProviders/githubFallback.js';

// The ceiling for the whole cascade, sized by what a form submit may hang for,
// not by the sum of the arms. Each arm caps its own call by what is left.
const CASCADE_BUDGET_MS = Number(process.env.FX_HISTORICAL_BUDGET_MS || 5000);

const CALL_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

// The currency Banrep publishes the official rate for. It gets its own arm,
// first, so a Colombian movement is valued by the Colombian official source.
const OFFICIAL_TRM_CURRENCY = 'cop';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {Object} HistoricalRate
 * @property {string} rate - The rate as text: 1 accounting unit = rate currency.
 * @property {string} currency - The currency the rate is quoted in, lowercase.
 * @property {string} source - Which provider supplied it.
 * @property {string} requestedDate - The movement's own day, 'YYYY-MM-DD'.
 * @property {string} effectiveDate - The day the rate was in force.
 * @property {number} daysBack - requestedDate minus effectiveDate, in days.
 * @property {string} provenance - source@effectiveDate, for exchange_rate_source.
 */

/**
 * Normalize a value to the YYYY-MM-DD calendar day it names.
 * @param {Date|string} value
 * @returns {string|null}
 */
function toCalendarDay(value) {
 if (typeof value === 'string') {
  const trimmed = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
 }

 if (value instanceof Date && !Number.isNaN(value.getTime())) {
  return value.toISOString().slice(0, 10);
 }

 return null;
}

/**
 * The span to ask a range provider for, given the day being valued.
 *
 * It opens five days before the first of that month and closes at today or at
 * the end of that month, whichever comes first.
 *
 * Opening at the first of the month alone is not enough: a movement dated the
 * 1st of a month that fell on a Saturday would come back with nothing on or
 * before it. The five days are the same bound the store applies, so the span
 * always contains an answer if one exists at all.
 *
 * Closing at today rather than at the day being valued costs the same single
 * request and the same handful of rows, and it turns every later back-dated
 * movement of that month into a store hit with no network at all.
 *
 * @param {string} day - The day being valued, YYYY-MM-DD
 * @returns {{ from: string, to: string }}
 */
function spanAround(day) {
 const [year, month] = day.split('-').map(Number);

 const firstOfMonth = Date.UTC(year, month - 1, 1);
 const from = new Date(firstOfMonth - MAX_RATE_AGE_DAYS * DAY_MS)
  .toISOString()
  .slice(0, 10);

 // Day 0 of the next month is the last day of this one.
 const lastOfMonth = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
 const today = new Date().toISOString().slice(0, 10);

 return { from, to: today < lastOfMonth ? today : lastOfMonth };
}

/**
 * Turn a store hit into the resolver's answer.
 * @param {Object} hit - What findDailyRate returned
 * @param {string} currency
 * @param {string} requestedDate
 * @returns {HistoricalRate}
 */
function asAnswer(hit, currency, requestedDate) {
 return {
  rate: hit.rate,
  currency,
  source: hit.source,
  requestedDate,
  effectiveDate: hit.rateDate,
  daysBack: hit.daysBack,
  provenance: `${hit.source}@${hit.rateDate}`,
 };
}

/**
 * Resolve the rate that values a movement dated on a past day.
 *
 * The cascade, in order, and why the order is not a preference:
 *
 *   accounting currency  -> rate 1. No store, no HTTP.
 *   the store            -> a day already recorded. A hit ends it.
 *   cop                  -> Banrep, the official Colombian source. It carries
 *                           its own validity range, so a Colombian Saturday is
 *                           answered by the range in force on that Saturday and
 *                           not by the Friday's figure.
 *   every other currency -> Banca d'Italia over the span, which is also the
 *   and cop on a failure    app's business-day oracle: it answers nothing on a
 *                           day with no market, which is what makes a holiday
 *                           calendar unnecessary anywhere in this codebase.
 *   the CDN              -> last, and only for a day another source published.
 *                           Measured across 2026-05-14..18 it invents movement
 *                           on closed days, so asking it for a raw requested
 *                           date would store a number no market quoted.
 *   nothing answered     -> 422.
 *
 * Every arm that reaches a provider writes what it got back into the store and
 * then re-reads the answer from it. That is deliberate: the resolution rule —
 * the most recent day not after the one asked for, within the age bound — lives
 * in one SQL statement, and both the hit path and the miss path go through it.
 * The answer served now is the same answer that will be served next time. It
 * costs one extra round trip against a local table, on a miss that has just
 * paid for an HTTP call.
 *
 * @param {string} currencyCode - The movement's currency, e.g. 'eur'
 * @param {Date|string} requestedDate - The movement's own day
 * @param {Object} [options]
 * @param {number} [options.budgetMs] - Ceiling for the whole cascade
 * @returns {Promise<HistoricalRate>}
 * @throws {Error} - every one carries a stable errorCode and details beside the
 *   prose: UNSUPPORTED_FX_CURRENCY and INVALID_FX_DATE on a bad input (400),
 *   FX_DATE_IN_FUTURE and FX_RATE_UNAVAILABLE on a day that cannot be valued
 *   (422). The code is the contract; the message is for a human and may change.
 */
export async function resolveHistoricalRate(currencyCode, requestedDate, options = {}) {
 const currency = typeof currencyCode === 'string' ? currencyCode.toLowerCase() : '';

 if (!SUPPORTED_CURRENCIES.includes(currency)) {
  throw createError(
   400,
   `Unsupported currency for a historical rate: ${currencyCode}`,
   {
    errorCode: 'UNSUPPORTED_FX_CURRENCY',
    details: { currency: String(currencyCode) },
   },
  );
 }

 const day = toCalendarDay(requestedDate);

 if (!day) {
  throw createError(
   400,
   `Invalid date for a historical rate: ${requestedDate}`,
   {
    errorCode: 'INVALID_FX_DATE',
    details: { expectedFormat: 'YYYY-MM-DD' },
   },
  );
 }

 // A rate that has not happened yet cannot be resolved, only guessed.
 const today = new Date().toISOString().slice(0, 10);

 if (day > today) {
  throw createError(
   422,
   `Cannot value a movement dated in the future: ${day}`,
   {
    errorCode: 'FX_DATE_IN_FUTURE',
    details: { requestedDay: day, today },
   },
  );
 }

 // One unit of the accounting currency is one unit of itself on every day that
 // has ever existed. No store read and no network call.
 if (currency === ACCOUNTING_CURRENCY_CODE) {
  return {
   rate: '1',
   currency,
   source: 'identity',
   requestedDate: day,
   effectiveDate: day,
   daysBack: 0,
   provenance: `identity@${day}`,
  };
 }

 const budgetMs =
  Number(options.budgetMs) > 0 ? Number(options.budgetMs) : CASCADE_BUDGET_MS;

 const deadlineAt = Date.now() + budgetMs;

 const baseCurrencyId = await getCurrencyId(null, ACCOUNTING_CURRENCY_CODE);
 const targetCurrencyId = await getCurrencyId(null, currency);

 const stored = await findDailyRate(baseCurrencyId, targetCurrencyId, day);

 if (stored) {
  return asAnswer(stored, currency, day);
 }

 // Why each arm failed, so the 422 names what was tried instead of only saying
 // that nothing worked. A cascade that fails silently is one nobody can debug.
 const attempts = [];

 /**
  * Write what a provider returned and read the answer back out of the store.
  * @param {Array<{rateDate: string, rate: string, source: string}>} rows
  * @returns {Promise<HistoricalRate|null>}
  */
 const storeThenResolve = async (rows) => {
  await persistDailyRates(rows, baseCurrencyId, targetCurrencyId);
  const hit = await findDailyRate(baseCurrencyId, targetCurrencyId, day);
  return hit ? asAnswer(hit, currency, day) : null;
 };

 // ---- Banrep, the official Colombian source ----
 if (currency === OFFICIAL_TRM_CURRENCY) {
  try {
   const trm = await fetchTrmForDate(day);

   // Stored under the day Banrep declares the range opens on, never under the
   // day that was asked for. The store then resolves every later day of that
   // range forward onto this row, which is the same rule Banrep publishes.
   const answer = await storeThenResolve([
    { rateDate: trm.effectiveDate, rate: String(trm.rate), source: trm.source },
   ]);

   if (answer) return answer;

   attempts.push(
    `banrep answered ${trm.effectiveDate}, outside the ${MAX_RATE_AGE_DAYS}-day bound`,
   );
  } catch (error) {
   attempts.push(`banrep: ${error.message}`);
  }
 }

 // ---- Banca d'Italia, the universal arm and the business-day oracle ----
 try {
  const { from, to } = spanAround(day);

  const series = await fetchBancaDItaliaRange(currency, from, to, {
   deadlineAt,
   timeoutMs: CALL_TIMEOUT_MS,
  });

  if (series.length > 0) {
   const answer = await storeThenResolve(series);
   if (answer) return answer;
  }

  attempts.push(
   `bancaditalia: no published day on or before ${day} within the bound`,
  );
 } catch (error) {
  attempts.push(`bancaditalia: ${error.message}`);
 }

 // ---- The CDN, only for a day a real source published ----
 //
 // It is asked for a day read out of the store, never for the requested day.
 // On a database whose history is still empty there is no such day and this arm
 // does not run at all, which is the correct outcome: the alternative would be
 // letting the CDN name a date nobody quoted.
 try {
  const publishedDay = await findLatestBusinessDay(day);

  if (!publishedDay) {
   attempts.push('cdn: skipped, no source has established a business day yet');
  } else {
   const payload = await fetchRatesForDate(ACCOUNTING_CURRENCY_CODE, publishedDay, {
    deadlineAt,
    timeoutMs: CALL_TIMEOUT_MS,
   });

   const quote = payload.rates?.[currency];

   if (!quote) {
    attempts.push(`cdn: no ${currency} quote on ${publishedDay}`);
   } else {
    const answer = await storeThenResolve([
     { rateDate: publishedDay, rate: String(quote.rate), source: payload.source },
    ]);

    if (answer) return answer;

    attempts.push(
     `cdn answered ${publishedDay}, outside the ${MAX_RATE_AGE_DAYS}-day bound`,
    );
   }
  }
 } catch (error) {
  attempts.push(`cdn: ${error.message}`);
 }

 // What each arm tried belongs in the log, not in the response. It names
 // providers and their failures, which is infrastructure diagnostics: a client
 // cannot act on "bancaditalia: no published day" and should not have to read
 // how the cascade is built to understand that no rate exists.
 console.error(
  `No historical rate for ${currency} on ${day}. Tried -> ${attempts.join(' | ')}`,
 );

 throw createError(
  422,
  `No historical rate for ${currency} on ${day}.`,
  {
   errorCode: 'FX_RATE_UNAVAILABLE',
   details: { currency, requestedDay: day },
  },
 );
}
