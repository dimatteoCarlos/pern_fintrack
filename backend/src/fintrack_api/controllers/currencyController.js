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
