//backend/src/fintrack_api/controllers/currencyController.js

// 💰 CONTROLLER:: Currency rates endpoint
//  currencyConvert: conversion for frontend preview
//  getAllRates:get rates listing

import { currencyAmountConversion } from '../services/exchangeRate_service/currencyAmountConversion.js';
import { getCurrencyId } from '../../utils/currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../config/fintrackConfig.js';
import { supportedCurrencies } from '../config/constants.js';
import { fetchFromExchangeRateAPI } from '../services/exchangeRate_providers/exchangeRateApiProvider.js';

// ===============================
// 🎯 FUNCTION: Convert a specific amount (POST)
// ===============================
export async function currencyConvert(req, res, next) {
  try {
    const { amount, fromCurrency, toCurrency = ACCOUNTING_CURRENCY_CODE } = req.body;

    // 1. Validate amount
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // 2. Validate currencies (optional but recommended)
    const fromId = await getCurrencyId(null, fromCurrency);
    const toId = await getCurrencyId(null, toCurrency);
    if (!fromId || !toId) {
      return res.status(400).json({ error: 'Invalid currency code' });
    }

    // 3. Perform conversion
    const conversion = await currencyAmountConversion(numericAmount, fromCurrency, toCurrency);

    // 4. Return result
    res.json({
      convertedAmount: conversion.amount.toNumber(),//where amount is a Decimal object from Decimal.js lib.
      rate: conversion.rate,
      source: conversion.source,
      fetchedAt: conversion.fetchedAt
    });
  } catch (error) {
    console.error('Currency conversion error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// =================================
// 🎯 FUNCTION: Get all exchange rates (GET)
// =================================
export async function getAllRates(req, res, next) {
  const base = req.query.base || ACCOUNTING_CURRENCY_CODE;

  // ------------------------------------
  // 1. Attempt to fetch full snapshot from ExchangeRate-API (massive)
  // ------------------------------------
    try {
      const snapshot = await fetchFromExchangeRateAPI(base, null); // null means get all rates

     // 🔧 Normalize snapshot keys to lowercase
     const normalizedRates = {};
     for (const [key, value] of Object.entries(snapshot.rates)) {
       normalizedRates[key.toLowerCase()] = value;
     } 

     // Validate that snapshot contains all required currencies
     const requiredCurrencies = supportedCurrencies.filter(c => c !== base);
     const missing = requiredCurrencies.filter(curr => !normalizedRates[curr]);
   
      if (missing.length === 0) {
      // Build rates object exactly as frontend expects
        const rates = {};
        for (const curr of supportedCurrencies) {
          rates[curr] = curr === base ? 1 : normalizedRates[curr];
        }
        // Added base to log message 
        console.log(`✅ getAllRates: using massive snapshot from ExchangeRate-API for base ${base}`);
        return res.json({
          base,
          rates,
          timestamp: snapshot.fetchedAt || new Date().toISOString(),
        });
      } else {
        console.warn(`⚠️ Massive snapshot missing currencies: ${missing.join(', ')}. Falling back to iterative.`);
      }
    } catch (err) {
      console.warn(`⚠️ Massive snapshot failed for base ${base}:`, err.message);
    }
  

//-------------------------------------
// 2. Fallback: original iterative method (one request per currency)
//----------------------------------
  const rates = { [base]: 1 };
  for (const target of supportedCurrencies) {
    if (target === base) continue;
    try {
      const conversion = await currencyAmountConversion(1, base, target);
      rates[target] = conversion.rate;
    } catch (err) {
      console.error(`Failed to get rate for ${target}:`, err.message);
      rates[target] = null;
    }
  }
  console.log('🔄 getAllRates: using iterative fallback');
  res.json({
    base,
    rates,
    timestamp: new Date().toISOString(),
  });
 }