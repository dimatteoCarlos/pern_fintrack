// backend/src/fintrack_api/services/fx_services/conversion/currencyAmountConversion.js

// 💰 CONVERSION: Convert amounts using global FX state
// ================================

/**
 * Converts an amount from one currency to another.
 *
 * Two sources of rate, chosen by whether the caller states a date:
 *
 * - No date. Today's rate, from fxState, the global in-memory state, after
 *   ensureFXStateIsFresh() guarantees it is not stale. This is the path the
 *   whole application already uses and it is unchanged.
 * - A date. The rate that was in force on that day, from the historical
 *   cascade. fxState is never touched and no freshness check runs: a past
 *   figure cannot go stale, so a time-to-live on it would mean nothing.
 *
 * The function does NOT decide whether a given date is "today". It has no
 * timezone, and the owner's day boundary is what settles that question, so the
 * caller routes: no date means now, a date means the historical path. Adding a
 * comparison against the server's own today here would resolve a 20:00
 * movement at UTC-5 through the wrong path.
 */

import Decimal from 'decimal.js';

import { fxRateDecimal } from '../utils/fxRateDecimal.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';
import { ensureFXStateIsFresh, fxState } from '../core/fxService.js';
import { resolveHistoricalRate } from '../core/historicalRateResolver.js';

// What a dated conversion may spend in total, however many currencies it has
// to resolve. Same ceiling the resolver applies to a single one.
const HISTORICAL_BUDGET_MS = Number(process.env.FX_HISTORICAL_BUDGET_MS || 5000);

/**
 * The calendar day a value names, as 'YYYY-MM-DD'.
 * Only the identity case needs this; every other path gets its day back from
 * the source that supplied the rate.
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

// ─── Main exported function ─────────────────────────────────────────

/**
 * Converts an amount from one currency to another.
 * Every rate, from either source, is defined as: 1 USD = X currency.
 *
 * @param {number|string} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code (e.g., 'eur')
 * @param {string} toCurrency - Target currency code (default 'usd')
 * @param {Date|string|null} [asOfDate=null] - The day to value the amount on.
 * @param {string} [timeZone='UTC'] - The IANA zone the day boundary is read on,
 *   passed through to the historical cascade. A caller that knows the owner
 *   supplies theirs; UTC preserves the behaviour of every caller that does not.
 *   Omitted means now, which is the behaviour every existing caller gets.
 * @returns {Promise<{amount: Decimal, rate: number, quote: {currency: string, rate: number}, source: string, fetchedAt: Date, effectiveDate: string|null}>}
 *   source is what belongs in exchange_rate_source: the bare provider name on
 *   the current path, and provider@effectiveDate on the historical one, so the
 *   record names the day the rate actually came from. effectiveDate is null on
 *   the current path and the day that supplied the figure on the historical one.
 *
 *   rate is the conversion's own multiplier: convertedAmount = amount * rate.
 *   quote is the market figure it was built from, always in the one direction
 *   every source publishes — 1 accounting unit = quote.rate of quote.currency.
 *   The two are different facts and only the second is legible: converting a
 *   peso to a dollar gives a rate of 0.00031, which rounds to zero in any
 *   display and reads as no rate at all, while the quote behind it is 3202.79.
 *   A client cannot derive one from the other either — a cross conversion's
 *   rate is two quotes composed, so inverting it yields neither of them.
 */
export async function currencyAmountConversion(
  amount,
  fromCurrency,
  toCurrency = ACCOUNTING_CURRENCY_CODE,
  asOfDate = null,
  timeZone = 'UTC',
) {
  const from = fromCurrency.toLowerCase();
  const to = toCurrency.toLowerCase();

  // Identity conversion (same currency)
  if (from === to) {
    // One unit of a currency is one unit of itself on every day there has ever
    // been, so the day asked for IS the day the rate was in force. No source is
    // consulted and none has to be: nothing here can be wrong about a date.
    const day = asOfDate ? toCalendarDay(asOfDate) : null;

    return {
      amount: fxRateDecimal(amount, 1),
      rate: 1,
      // One unit of a currency quoted against itself. No source published it,
      // and none had to.
      quote: { currency: from, rate: 1 },
      source: day ? `identity@${day}` : 'identity',
      fetchedAt: new Date(),
      effectiveDate: day,
      provider: 'identity',
    };
  }

  // The current path needs the global state fresh. The historical one must not
  // touch it at all, so the freshness check is inside this branch, not above it.
  if (!asOfDate) {
    await ensureFXStateIsFresh();
  }

  // The whole cascade's budget for this conversion, shared. A cross conversion
  // resolves two currencies, and without a shared deadline the two would each
  // get a full budget and the request could hang for twice as long.
  const deadlineAt = asOfDate ? Date.now() + HISTORICAL_BUDGET_MS : null;

  /**
   * The quote for one currency against the accounting currency, from whichever
   * of the two sources this call is using.
   * @param {string} currency
   * @returns {Promise<{rate: string|number, source: string, fetchedAt: Date, effectiveDate: string|null}>}
   */
  const quoteFor = async (currency) => {
    if (!asOfDate) {
      const data = fxState.rates?.[currency];

      if (!data) {
        throw new Error(`Rate for ${currency} not available in FX state.`);
      }

      return {
        rate: data.rate,
        source: data.source || 'system',
        fetchedAt: data.fetchedAt || new Date(),
        effectiveDate: null,
      };
    }

    const resolved = await resolveHistoricalRate(currency, asOfDate, {
      budgetMs: deadlineAt - Date.now(),
      timeZone,
    });

    return {
      rate: resolved.rate,
      source: resolved.provenance,
      fetchedAt: new Date(),
      effectiveDate: resolved.effectiveDate,
    };
  };

  // The undated path keeps the float arithmetic it has always used, down to
  // the last bit. Taking the reciprocal in Decimal is more accurate, but it
  // moves the converted amount in its seventeenth digit, and this commit must
  // not change a number any of the eight existing callers already gets. The
  // dated path is new, so it takes its reciprocal in Decimal, where a cross
  // conversion does not round on the way to the amount.
  const reciprocalOf = (rate) => (asOfDate ? new Decimal(1).div(rate) : 1 / rate);

  const composed = (fromRate, toRate) =>
    asOfDate
      ? new Decimal(1).div(fromRate).times(toRate)
      : (1 / fromRate) * toRate;

  // Only the currencies a case actually needs are quoted, so a conversion
  // against the accounting currency never pays for a second resolution.
  let effectiveRate;
  let sourceData;

  // The market figure the conversion was built from, kept as the source states
  // it: 1 accounting unit = quotedRate of quotedCurrency. The quoted currency is
  // the foreign side of the pair, which is the one a reader needs named — an
  // accounting unit against itself says nothing.
  let quotedCurrency;
  let quotedRate;

  // Case 1: Converting FROM a non-USD currency TO USD
  if (from !== ACCOUNTING_CURRENCY_CODE && to === ACCOUNTING_CURRENCY_CODE) {
    // Inverse rate, because rate = 1 USD = X fromCurrency
    sourceData = await quoteFor(from);
    effectiveRate = reciprocalOf(sourceData.rate);
    quotedCurrency = from;
    quotedRate = sourceData.rate;
  }

  // Case 2: Converting FROM USD TO a non-USD currency (use direct rate)
  else if (
    from === ACCOUNTING_CURRENCY_CODE &&
    to !== ACCOUNTING_CURRENCY_CODE
  ) {
    // Direct rate: 1 USD = X toCurrency
    sourceData = await quoteFor(to);
    effectiveRate = asOfDate ? new Decimal(sourceData.rate) : sourceData.rate;
    quotedCurrency = to;
    quotedRate = sourceData.rate;
  }

  // Case 3: Cross conversion between two non-USD currencies
  else {
    // Cross conversion: amount * (1 / fromRate) * toRate
    const fromQuote = await quoteFor(from); // 1 USD = X fromCurrency
    const toQuote = await quoteFor(to); // 1 USD = Y toCurrency

    effectiveRate = composed(fromQuote.rate, toQuote.rate);

    // The side the amount is typed in. Naming the other one would quote a
    // currency the reader never entered.
    quotedCurrency = from;
    quotedRate = fromQuote.rate;

    // The leg that decides the record. Both legs are named when they disagree,
    // because a cross conversion valued from two different effective days must
    // not be recorded as if one day had supplied it.
    sourceData =
      fromQuote.effectiveDate && fromQuote.effectiveDate !== toQuote.effectiveDate
        ? { ...fromQuote, source: `${fromQuote.source}+${toQuote.source}` }
        : fromQuote;
  }
  //---DEBUG---
  // console.log('🔍 [CONVERSION] from:', from, 'to:', to);
  // console.log('🔍 [CONVERSION] rate for from:', fxState.rates?.[from]);
  // console.log('🔍 [CONVERSION] effectiveRate:', effectiveRate);
  // console.log('🔍 [CONVERSION] amount:', amount);
  // console.log(
  //   '🔍 [CONVERSION] convertedAmount:',
  //   fxRateDecimal(amount, effectiveRate).toNumber(),
  // );
  //-----------------------------
  // Perform conversion using Decimal.js. The rate above is already a Decimal,
  // so the reciprocal of a cross conversion never passes through a float.
  const convertedAmount = fxRateDecimal(amount, effectiveRate);

  return {
    amount: convertedAmount,
    // The effective rate of the conversion, not the raw quote it came from.
    rate: typeof effectiveRate === 'number' ? effectiveRate : effectiveRate.toNumber(),
    quote: { currency: quotedCurrency, rate: Number(quotedRate) },
    source: sourceData.source || 'system',
    fetchedAt: sourceData.fetchedAt || new Date(),
    // null on the current path: today's rate has no effective day of its own.
    effectiveDate: sourceData.effectiveDate,
  };
}
