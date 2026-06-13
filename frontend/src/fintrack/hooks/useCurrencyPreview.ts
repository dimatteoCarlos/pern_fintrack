// frontend/src/fintrack/hooks/useCurrencyPreview.ts

// 💰 HOOK: useCurrencyPreview - Returns USD preview, rate and direction

// Receives amount and currency, calculates approximated USD value using store rates

import { useMemo } from 'react';
import { useCurrencyStore } from '../stores/useCurrencyStore';
import { CurrencyType } from '../types/types';
import { DEFAULT_CURRENCY } from '../helpers/constants';
import { numberFormatCurrency } from '../helpers/functions';

// ===============================
// 🎯 HOOK: useCurrencyPreview
// ===============================
export function useCurrencyPreview(amount: number | string, currency: CurrencyType) {
  // 1. Get exchange rates from global store
  const rates = useCurrencyStore((state) => { return state.rates;});

   // console.log("🚀 ~ useCurrencyPreview ~ rates:", rates);

  // 2. Convert amount to a valid number
  const numericAmount = useMemo(() => {
    const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(parsed) ? 0 : parsed;
  }, [amount]);

  // 3. Calculate preview, rate and direction (if applicable)
  const result = useMemo(() => {
   // No conversion needed for accounting currency (USD)
    if (currency === DEFAULT_CURRENCY) {
      return { targetCurrencyPreview: null, rate: null, direction: null };
    }

   // Get the exchange rate for the given currency
    const rate = rates[currency as keyof typeof rates];

   // Invalid amount or missing rate → no preview
    if (!rate || numericAmount <= 0 || rate <= 0)  return { targetCurrencyPreview: null, rate: null, direction: null };

   // Convert to USD: amount / rate (since rate = 1 USD = X units of foreign currency)
    const targetCurrencyValue = numericAmount / rate;
    
   // Format preview with 2 decimal places (toFixed(2) as agreed)
   const preview = `≈ ${numberFormatCurrency(targetCurrencyValue, 2, undefined, 'es-ES')} ${DEFAULT_CURRENCY}`;
    // const preview = `≈ ${targetCurrencyValue.toFixed(2)} ${DEFAULT_CURRENCY}`;

   // Build direction string: e.g., "cop->usd"
    const direction = `${DEFAULT_CURRENCY}→${currency}`;
    // const direction = `${currency}→${DEFAULT_CURRENCY}`;

    return { targetCurrencyPreview: preview, rate, direction };

  }, [numericAmount, currency, rates]);

  // 4. Return object for easy destructuring
   // console.log("🚀 ~ useCurrencyPreview ~ result:", result)

   return result;
}