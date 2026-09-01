// backend/src/fintrack_api/services/fx_services/core/warmCurrentMonthRates.js

// The current month's rates, fetched before anybody asks for them.
//
// A conversion dated earlier than today takes the historical path, and on a
// cold store that path costs a provider call — up to the whole cascade budget —
// while a user waits on a form. The work is the same either way; this only
// moves it off the request.
//
// It resolves rather than fetches: resolveHistoricalRate owns the cascade, the
// span arithmetic and the order of the sources, and asking it for a day is the
// whole job. Nothing here knows what a provider is. That also keeps the
// official source first for the peso, which a uniform range call would shadow.
//
// It asks for every day, and it asks in a deliberate order. Both were defects
// once: seeding a single day left three of the four currencies with zero days
// warmed, measured on a cold February. See daysOfCurrentMonth and
// currenciesToWarm for why neither is an optimisation but a correctness fix.

import pc from 'picocolors';

import {
 ACCOUNTING_CURRENCY_CODE,
 OFFICIAL_TRM_CURRENCY,
 SUPPORTED_CURRENCIES,
} from './fxConfig.js';
import { resolveHistoricalRate } from './historicalRateResolver.js';

/**
 * Every day of the month in course, from the first up to today.
 *
 * Why every day and not just the first. The previous version asked for one day
 * and relied on the arm that answered having fetched a range around it. That is
 * a dependency on WHICH source answers, not on what this module wants: the arms
 * that fetch a range do warm the month as a side effect, but the CDN arm asks
 * for exactly one day and covers exactly one day, so a currency that falls to it
 * ended the warm-up with a single day ready — and with none at all when the
 * first of the month was not a trading day, which it is not roughly two months
 * in seven. Asking for each day states the intent instead of inheriting it.
 *
 * The cost is bounded by the work actually left to do. A range arm covers the
 * month on the first day it answers, so every later day is a single indexed read
 * — measured at about 1ms. Only the days a provider must still be asked for cost
 * a call, which is precisely the work this module exists to move off the request.
 *
 * Read in UTC, not on the server's local calendar. The resolver refuses a day
 * that has not happened yet and reads that boundary in UTC by default, since a
 * shared store has no owner whose zone to use. A list built on a local calendar
 * ahead of UTC would end on a day the resolver then rejects.
 *
 * @returns {string[]} 'YYYY-MM-DD', ascending.
 */
const daysOfCurrentMonth = () => {
 const today = new Date().toISOString().slice(0, 10);
 const month = today.slice(0, 7);
 const lastDay = Number(today.slice(8, 10));

 return Array.from(
  { length: lastDay },
  (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
 );
};

/**
 * The currencies to warm, in the order they have to be warmed in.
 *
 * The order is not cosmetic. The CDN arm never names a date itself: it asks the
 * store for the latest day some source has already established and requests that
 * one, which is what stops it inventing a day no market quoted. That calendar is
 * shared across every pair. So on a cold store a currency warmed before the one
 * whose official source publishes a range has nothing to ask for, and its arm
 * reports that no business day exists yet — measured, on a cold February, as
 * zero days ready for the euro against twenty-eight for the peso.
 *
 * @returns {string[]}
 */
const currenciesToWarm = () => {
 // The accounting currency is an identity conversion and consults no source.
 const rest = SUPPORTED_CURRENCIES.filter(
  (code) => code !== ACCOUNTING_CURRENCY_CODE && code !== OFFICIAL_TRM_CURRENCY,
 );

 return SUPPORTED_CURRENCIES.includes(OFFICIAL_TRM_CURRENCY)
  ? [OFFICIAL_TRM_CURRENCY, ...rest]
  : rest;
};

/**
 * Fill the historical store for every currency the app converts, for the month
 * in course.
 *
 * Never throws and never rejects. A provider that is down must not stop a
 * server from starting, and the lazy path stays exactly as it is: an unwarmed
 * currency resolves on first use, the way it does today.
 *
 * A day the cascade cannot answer is not an error here. Days no market quoted
 * are answered by walking back to one that did, and that walk needs the span in
 * between to have been queried — so a currency served only by the one-day CDN
 * arm warms its trading days and leaves the rest to resolve later, once a range
 * source covers them. The counts below report that honestly rather than reading
 * a partial month as a failure.
 *
 * @returns {Promise<{days: number, ready: Object<string, number>, warmed: string[], failed: string[]}>}
 *  for a caller that wants to log or test the outcome. Startup ignores it.
 */
export async function warmCurrentMonthRates() {
 const days = daysOfCurrentMonth();
 const ready = {};
 const warmed = [];
 const failed = [];

 for (const currency of currenciesToWarm()) {
  let lastError = null;

  ready[currency] = 0;

  for (const day of days) {
   try {
    await resolveHistoricalRate(currency, day);
    ready[currency] += 1;
   } catch (error) {
    lastError = error;
   }
  }

  if (ready[currency] > 0) {
   warmed.push(currency);
  } else {
   failed.push(currency);
   // One line per currency, not one per day: a provider that is unreachable
   // fails every day of the month for the same reason.
   console.warn(
    pc.yellow(`FX warm-up: ${currency} unavailable — ${lastError?.message}`),
   );
  }
 }

 const summary =
  warmed.map((code) => `${code} ${ready[code]}/${days.length}`).join(', ') || 'none';

 console.log(
  pc.cyan(
   `FX warm-up for ${days[0]}..${days[days.length - 1]}: ${summary}${
    failed.length > 0 ? `; ${failed.join(', ')} left to the lazy path` : ''
   }.`,
  ),
 );

 return { days: days.length, ready, warmed, failed };
}
