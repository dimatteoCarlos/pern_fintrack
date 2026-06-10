//backend/src/fintrack_api/controllers/currencyController.js

// 💰 CONTROLLER:
//  currencyConvert: conversion for frontend preview
//  getAllRates:get rates listing

import { currencyAmountConversion } from '../services/exchangeRate_service/currencyAmountConversion.js';
import { getCurrencyId } from '../../utils/currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../config/fintrackConfig.js';
import { supportedCurrencies } from '../config/constants.js';

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

//----------------------------------
// =================================
// 🎯 FUNCTION: Get all exchange rates (GET)
// =================================
export async function getAllRates(req, res, next) {

  try {
    // Use accounting currency as default base, or override with query param
    const base = req.query.base || ACCOUNTING_CURRENCY_CODE;

    // List of supported currencies (can be extended later)
    // const supportedCurrencies = ['usd', 'eur', 'cop', 'ves', 'mxn'];
    const rates = {};

    for (const target of supportedCurrencies) {
      if (target === base) {
        rates[target] = 1;
      } else {
        const conversion = await currencyAmountConversion(1, base, target);
        rates[target] = conversion.rate;
      }
    }

//----------------------------
    console.log('getAllRates:', {
      base,
      rates,
      timestamp: new Date().toISOString()
    })
//----------------------------
    res.json({
      base,
      rates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
}