// backend/src/fintrack_api/services/fx_services/conversion/currencyAmountConversion.js

// 💰 CONVERSION: Convert amounts using global FX state
// ================================

/**
 * Converts an amount from one currency to another using the global FX state.
 * This is the active version used by the frontend for real-time previews.
 *
 * Uses:
 * - fxState (global in-memory state) for the rate.
 * - ensureFXStateIsFresh() to guarantee fresh data.
 */

import { fxRateDecimal } from '../utils/fxRateDecimal.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';
import { ensureFXStateIsFresh, fxState } from '../core/fxService.js';

// ─── Main exported function ─────────────────────────────────────────

/**
 * Converts an amount from one currency to another using the global FX state.
 * Uses fxState.rates where each rate is defined as: 1 USD = X currency.
 *
 * @param {number|string} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code (e.g., 'eur')
 * @param {string} toCurrency - Target currency code (default 'usd')
 * @returns {Promise<{amount: Decimal, rate: number, source: string, fetchedAt: Date}>}
 */
export async function currencyAmountConversion(
  amount,
  fromCurrency,
  toCurrency = ACCOUNTING_CURRENCY_CODE,
) {
  const from = fromCurrency.toLowerCase();
  const to = toCurrency.toLowerCase();

  // Identity conversion (same currency)
  if (from === to) {
    return {
      amount: fxRateDecimal(amount, 1),
      rate: 1,
      source: 'identity',
      fetchedAt: new Date(),
    };
  }

  // Ensure the global FX state is fresh
  await ensureFXStateIsFresh();

  // 📝 helper to get rate and throw error if missing
  //function defined
  const getRate = (currency) => {
    const data = fxState.rates?.[currency];
    if (!data) {
      throw new Error(`Rate for ${currency} not available in FX state.`);
    }
    return data.rate;
  };

   //direct multiplication with rate direction logic
   let effectiveRate;

  // Case 1: Converting FROM a non-USD currency TO USD
  if (from !== ACCOUNTING_CURRENCY_CODE && to === ACCOUNTING_CURRENCY_CODE) {
    // 📝 CHANGE: Use inverse rate because rate = 1 USD = X fromCurrency
    const rate = getRate(from);
    effectiveRate = 1 / rate;
  }

  // Case 2: Converting FROM USD TO a non-USD currency (use direct rate)
  else if (
    from === ACCOUNTING_CURRENCY_CODE &&
    to !== ACCOUNTING_CURRENCY_CODE
  ) {
    // 📝 CHANGE: Use direct rate: 1 USD = X toCurrency
    const rate = getRate(to);
    effectiveRate = rate;
  }

  // Case 3: Cross conversion between two non-USD currencies
  else {
    // 📝 Cross conversion: amount * (1 / fromRate) * toRate
    const fromRate = getRate(from); // 1 USD = X fromCurrency
    const toRate = getRate(to); // 1 USD = Y toCurrency
    effectiveRate = (1 / fromRate) * toRate;
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
  // Perform conversion using Decimal.js
  const convertedAmount = fxRateDecimal(amount, effectiveRate);

  // 📝 Select source data based on the conversion case
   let sourceData;
   if (from !== ACCOUNTING_CURRENCY_CODE && to === ACCOUNTING_CURRENCY_CODE) {
     // Case 1: From non-USD to USD → rate comes from 'from' currency
     sourceData = fxState.rates?.[from] || {};
   } else if (from === ACCOUNTING_CURRENCY_CODE && to !== ACCOUNTING_CURRENCY_CODE) {
     // Case 2: From USD to non-USD → rate comes from 'to' currency
     sourceData = fxState.rates?.[to] || {};
   } else {
     // Case 3: Cross conversion → rate comes from 'from' (or 'to', but we choose 'from')
     sourceData = fxState.rates?.[from] || fxState.rates?.[to] || {};
   }

  return {
    amount: convertedAmount,
    // 📝 Return effectiveRate instead of raw fxState rate
    rate: effectiveRate,
    source: sourceData.source || 'system',
    fetchedAt: sourceData.fetchedAt || new Date(),
  };
}
