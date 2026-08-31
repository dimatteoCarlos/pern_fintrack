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

import pc from 'picocolors';

import { ACCOUNTING_CURRENCY_CODE, SUPPORTED_CURRENCIES } from './fxConfig.js';
import { resolveHistoricalRate } from './historicalRateResolver.js';

/**
 * The first day of the month the server is in, as 'YYYY-MM-DD'.
 *
 * The server's own calendar, not a user's: this warms a shared store, so there
 * is no owner to read a zone from. A few hours either side of a month boundary
 * only decides whether the previous month is warmed too, which costs one call.
 *
 * @returns {string}
 */
const firstOfCurrentMonth = () => {
 const now = new Date();

 return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

/**
 * Fill the historical store for every currency the app converts, for the month
 * in course.
 *
 * Never throws and never rejects. A provider that is down must not stop a
 * server from starting, and the lazy path stays exactly as it is: an unwarmed
 * currency resolves on first use, the way it does today.
 *
 * @returns {Promise<{warmed: string[], failed: string[]}>} for a caller that
 *  wants to log or test the outcome. Startup ignores it.
 */
export async function warmCurrentMonthRates() {
 // The accounting currency is an identity conversion and consults no source.
 const currencies = SUPPORTED_CURRENCIES.filter(
  (code) => code !== ACCOUNTING_CURRENCY_CODE,
 );
 const day = firstOfCurrentMonth();
 const warmed = [];
 const failed = [];

 for (const currency of currencies) {
  try {
   await resolveHistoricalRate(currency, day);
   warmed.push(currency);
  } catch (error) {
   failed.push(currency);
   console.warn(pc.yellow(`FX warm-up: ${currency} unavailable — ${error.message}`));
  }
 }

 console.log(
  pc.cyan(
   `FX warm-up for ${day}: ${warmed.length} ready${
    failed.length > 0 ? `, ${failed.length} left to the lazy path` : ''
   }.`,
  ),
 );

 return { warmed, failed };
}
