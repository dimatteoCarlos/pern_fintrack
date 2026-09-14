// frontend/src/fintrack/hooks/useCurrencyPreview.ts

// 💰 HOOK: useCurrencyPreview - Returns USD preview, rate and direction

// Receives amount and currency, calculates approximated USD value using store rates

import { useMemo } from 'react';
import { useCurrencyStore } from '../stores/useCurrencyStore';
import { CurrencyType } from '../types/types';
import { currencyMinorUnit, numberFormatCurrency } from '../helpers/functions';
import { CURRENCY_OPTIONS } from '../helpers/currencyConstants';

// ===============================
// 🎯 HOOK: useCurrencyPreview
// ===============================
export function useCurrencyPreview(amount: number | string, currency: CurrencyType) {
  // 1. Get exchange rates from global store
  const rates = useCurrencyStore((state) => { return state.rates;});

  // Currency the amount will be STORED in, which is the question this preview
  // answers. Not DEFAULT_CURRENCY: that one is only what the interface renders.
  const accountingCurrency = useCurrencyStore((state) => { return state.accountingCurrency;});

   // console.log("🚀 ~ useCurrencyPreview ~ rates:", rates);

  // 2. Convert amount to a valid number
  const numericAmount = useMemo(() => {
    const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(parsed) ? 0 : parsed;
  }, [amount]);

  // 3. Calculate preview, rate and direction (if applicable)
  const result = useMemo(() => {
   // The accounting currency's own locale, not a fixed 'es-ES': the same
   // literal used to be copy-pasted into every caller that re-formats `rate`
   // for its own tooltip, so fixing it once here and exposing `formattedRate`
   // below removes the other copies instead of leaving them out of step.
   const locale = CURRENCY_OPTIONS[accountingCurrency];

   // No conversion needed when the amount is already in the stored currency
    if (currency === accountingCurrency) {
      return { targetCurrencyPreview: null, rate: null, direction: null, formattedRate: null };
    }

   // Get the exchange rate for the given currency
    const rate = rates[currency as keyof typeof rates];

   // Invalid amount or missing rate → no preview
    if (!rate || numericAmount <= 0 || rate <= 0)  return { targetCurrencyPreview: null, rate: null, direction: null, formattedRate: null };

   // Convert to USD: amount / rate (since rate = 1 USD = X units of foreign currency)
    const targetCurrencyValue = numericAmount / rate;

   // The accounting currency's own decimals, not a fixed 2: a yen amount has
   // none. The code is appended after, so the number is formatted without it.
   const preview = `≈ ${numberFormatCurrency(targetCurrencyValue, currencyMinorUnit(accountingCurrency), undefined, locale)} ${accountingCurrency}`;

   // Direction of the RATE, which reads "1 accounting = rate foreign"
    const direction = `${accountingCurrency}→${currency}`;

   // Same rate, formatted once here rather than by each tooltip that reads it.
   const formattedRate = numberFormatCurrency(rate, 2, undefined, locale);

    return { targetCurrencyPreview: preview, rate, direction, formattedRate };

  }, [numericAmount, currency, rates, accountingCurrency]);

  // 4. Return object for easy destructuring
   // console.log("🚀 ~ useCurrencyPreview ~ result:", result)

   return result;
}