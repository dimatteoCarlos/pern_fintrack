//backend/src/fintrack_api/controllers/currencyController.js

// 💰 CONTROLLER:: Currency rates endpoint
//  currencyConvert: conversion for frontend preview
//  getAllRates:get rates listing

import { currencyAmountConversion } from '../services/fx_services/conversion/currencyAmountConversion.js';

import { getCurrencyId } from '../../utils/currencyLookup.js';

import { ACCOUNTING_CURRENCY_CODE } from '../config/fintrackConfig.js';

import {
  ensureFXStateIsFresh,
  fxState,
} from '../services/fx_services/core/fxService.js';

// ===============================
// 🎯 FUNCTION: Convert a specific amount (POST)
// ===============================
export async function currencyConvert(req, res, next) {
  try {
    const {
      amount,
      fromCurrency,
      toCurrency = ACCOUNTING_CURRENCY_CODE,
    } = req.body;

    // 1. Validate amount
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res
        .status(400)
        .json({ error: 'Amount must be a positive number' });
    }

    // 2. Validate currencies (optional but recommended)
    const fromId = await getCurrencyId(null, fromCurrency);
    const toId = await getCurrencyId(null, toCurrency);
    if (!fromId || !toId) {
      return res.status(400).json({ error: 'Invalid currency code' });
    }

    // 3. Perform conversion
    const conversion = await currencyAmountConversion(
      numericAmount,
      fromCurrency,
      toCurrency,
    );

    // 4. Return result
    res.json({
      convertedAmount: conversion.amount.toNumber(), //where amount is a Decimal object from Decimal.js lib.
      rate: conversion.rate,
      source: conversion.source,
      fetchedAt: conversion.fetchedAt,
    });
  } catch (error) {
    console.error('Currency conversion error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// =================================
// 🎯 FUNCTION: Get all exchange rates (GET)
// =================================
/**
 * Get all exchange rates for the accounting base currency.
 * Uses the global FX state (fxState) for fast, cached responses.
 */
export async function getAllRates(req, res, next) {
  const base = req.query.base || ACCOUNTING_CURRENCY_CODE;

  try {
    // 1. Ensure FX state is fresh (load from DB or refresh if needed)
    await ensureFXStateIsFresh();

    // 2. Build rates object from fxState.rates
    const rates = {};
    for (const [currency, data] of Object.entries(fxState.rates || {})) {
      rates[currency] = currency === base ? 1 : data.rate;
    }

    // 3. Return response
    res.json({
      base,
      rates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({
      error: error.message || 'FX subsystem unavailable',
    });
  }
}
//========================================
//Test the endpoint:
//curl -H "Authorization: Bearer <tu_token>" http://localhost:5000/api/fintrack/currency/rates
//========================================

// export async function getAllRates(req, res, next) {
//   const base = req.query.base || ACCOUNTING_CURRENCY_CODE;

//   // ------------------------------------
//   // 1. Attempt to fetch full snapshot from ExchangeRate-API (massive)
//   // ------------------------------------
//   try {
//     //const snapshot = await fetchFromGitHubFallback(base, null); // null means get all rates
//     const snapshot = await fetchFromFreeCurrencyAPI(base, null); // null means get all rates
//     //const snapshot = await fetchFromExchangeRateAPI(base, null); // null means get all rates

//     // 🔧 Normalize snapshot keys to lowercase
//     const normalizedRates = {};
//     for (const [key, value] of Object.entries(snapshot.rate)) {
//       normalizedRates[key.toLowerCase()] = value;
//     }

//     // Validate that snapshot contains all required currencies
//     const requiredCurrencies = SUPPORTED_CURRENCIES.filter((c) => c !== base);
//     const missing = requiredCurrencies.filter((curr) => !normalizedRates[curr]);

//     if (missing.length === 0) {
//       // Build rates object exactly as frontend expects
//       const rates = {};
//       for (const curr of SUPPORTED_CURRENCIES) {
//         rates[curr] = curr === base ? 1 : normalizedRates[curr];
//       }
//       // Added base to log message
//       console.log(
//         `✅ getAllRates: using massive snapshot from ExchangeRate-API for base ${base}`,
//       );
//       return res.json({
//         base,
//         rates,
//         timestamp: snapshot.fetchedAt || new Date().toISOString(),
//       });
//     } else {
//       console.warn(
//         `⚠️ Massive snapshot missing currencies: ${missing.join(', ')}. Falling back to iterative.`,
//       );
//     }
//   } catch (err) {
//     console.warn(`⚠️ Massive snapshot failed for base ${base}:`, err.message);
//   }

//   //-------------------------------------
//   // 2. Fallback: original iterative method (one request per currency)
//   //----------------------------------
//   const rates = { [base]: 1 };
//   for (const target of SUPPORTED_CURRENCIES) {
//     if (target === base) continue;
//     try {
//       const conversion = await currencyAmountConversion(1, base, target);
//       rates[target] = conversion.rate;
//     } catch (err) {
//       console.error(`Failed to get rate for ${target}:`, err.message);
//       rates[target] = null;
//     }
//   }
//   console.log('🔄 getAllRates: using iterative fallback');
//   res.json({
//     base,
//     rates,
//     timestamp: new Date().toISOString(),
//   });
// }
