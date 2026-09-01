// backend/src/fintrack_api/services/fx_services/core/warmRecentRates.js

// The days a back-dated movement is likely to fall on, fetched before anybody
// asks for them.
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
// It asks for every day, over two months, in a deliberate order. Each of those
// three was a defect once, and each is a correctness fix rather than an
// optimisation — see daysToWarm and currenciesToWarm for the measurements.

import pc from 'picocolors';

import {
 ACCOUNTING_CURRENCY_CODE,
 OFFICIAL_TRM_CURRENCY,
 SUPPORTED_CURRENCIES,
} from './fxConfig.js';
import { resolveHistoricalRate } from './historicalRateResolver.js';

/**
 * Every day from the first of last month up to today.
 *
 * Why every day and not just the first of the month. An earlier version asked
 * for one day and relied on the arm that answered having fetched a range around
 * it. That is a dependency on WHICH source answers, not on what this module
 * wants: the arms that fetch a range do warm the month as a side effect, but the
 * CDN arm asks for exactly one day and covers exactly one day, so a currency
 * that falls to it warmed at most that day — and none at all when the first of
 * the month was not a trading day, which it is not roughly two months in seven.
 *
 * Why two months and not the month in course. The window used to be the calendar
 * month, which meant that on the first of a month it covered a single day while
 * the movements people actually back-date — the ones from a few days ago — had
 * just fallen out of it. A calendar unit is not the window a movement falls in.
 * The boundary is month-aligned rather than a rolling count of days because
 * spanAround fetches by month: a window of exactly two months is two range calls
 * per currency, where a rolling forty-five days would straddle three.
 *
 * The cost is bounded by the work actually left to do. A range arm covers a
 * month on the first day of it that answers, so every later day of that month is
 * a single indexed read. Only the days a provider must still be asked for cost a
 * call, which is precisely the work this module exists to move off the request.
 *
 * Read in UTC, not on the server's local calendar. The resolver refuses a day
 * that has not happened yet and reads that boundary in UTC by default, since a
 * shared store has no owner whose zone to use. A list built on a local calendar
 * ahead of UTC would end on a day the resolver then rejects.
 *
 * @returns {string[]} 'YYYY-MM-DD', ascending.
 */
const daysToWarm = () => {
 const today = new Date();
 const year = today.getUTCFullYear();
 const month = today.getUTCMonth();

 const days = [];
 // Day 1 of last month through today, walked in UTC so no local zone and no
 // daylight-saving shift can drop or repeat a day.
 const cursor = new Date(Date.UTC(year, month - 1, 1));
 const end = today.toISOString().slice(0, 10);

 for (;;) {
  const day = cursor.toISOString().slice(0, 10);

  days.push(day);
  if (day === end) break;

  cursor.setUTCDate(cursor.getUTCDate() + 1);
 }

 return days;
};

/**
 * The currencies to warm, in the order they have to be warmed in.
 *
 * The order is not cosmetic. The CDN arm never names a date itself: it asks the
 * store for the latest day some source has already established and requests that
 * one, which is what stops it inventing a day no market quoted. That calendar is
 * shared across every pair. So on a cold store a currency warmed before the one
 * whose official source publishes a range has nothing to ask for, and its arm
 * reports that no business day exists yet — measured, on a cold November, as
 * zero days ready for the euro against thirty for the peso; warmed after it, in
 * an equally cold October, twenty-two, for the same total time.
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
 * Fill the historical store for every currency the app converts, over the window
 * a back-dated movement is likely to land in.
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
 * a partial window as a failure.
 *
 * @returns {Promise<{days: number, ready: Object<string, number>, warmed: string[], failed: string[]}>}
 *  for a caller that wants to log or test the outcome. Startup ignores it.
 */
export async function warmRecentRates() {
 const days = daysToWarm();
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
   // fails every day of the window for the same reason.
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
