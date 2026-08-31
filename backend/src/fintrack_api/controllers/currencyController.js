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

import { createError } from '../../utils/errorHandling.js';
import { isCalendarDate } from '../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';

// ===============================
// 🎯 FUNCTION: Convert a specific amount (POST)
// ===============================
export async function currencyConvert(req, res, next) {
  try {
    const {
      amount,
      fromCurrency,
      toCurrency = ACCOUNTING_CURRENCY_CODE,
      day,
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

    // 3. The day the caller wants the conversion for.
    //
    // This does not turn the endpoint into a historical-rate endpoint: it lets
    // a consumer say which day it is asking about, and today stays the default.
    // Omitted means now, which is what every existing caller sends.
    //
    // The current-month rule is deliberately NOT applied here. That rule governs
    // whether an operation may be recorded on a date; this only answers which
    // rate corresponds to a date being asked about, and writes nothing.
    const requestedDay = typeof day === 'string' ? day.trim() : '';

    if (requestedDay !== '' && !isCalendarDate(requestedDay)) {
      throw createError(400, `day must be a calendar day, YYYY-MM-DD`, {
        errorCode: 'INVALID_FX_DATE',
        details: { expectedFormat: 'YYYY-MM-DD' },
      });
    }

    const asOfDay = requestedDay !== '' ? requestedDay : null;

    // 4. Perform conversion
    const conversion = await currencyAmountConversion(
      numericAmount,
      fromCurrency,
      toCurrency,
      asOfDay,
    );

    // 5. Return result
    //
    // effectiveDate is the day whose rate actually answered, which is not always
    // the day asked for: a validity published on the 15th values the 20th, and a
    // market closed on a Saturday is valued by the Friday it quoted. It already
    // travels glued inside source as provider@day; naming it as its own field is
    // what lets a client tell "the rate for that day" from "the rate in force on
    // that day" without parsing a string. null on the undated path, where today
    // has no effective day of its own.
    res.json({
      convertedAmount: conversion.amount.toNumber(), //where amount is a Decimal object from Decimal.js lib.
      rate: conversion.rate,
      source: conversion.source,
      fetchedAt: conversion.fetchedAt,
      effectiveDate: conversion.effectiveDate ?? null,
    });
  } catch (error) {
    // Forwarded rather than turned into a 500. A dated conversion reaches the
    // historical resolver, whose refusals already declare their own status and
    // stable code; rebuilding them here would demote a 422 to a 500 and drop
    // the code the client is meant to branch on.
    console.error('Currency conversion error:', error);
    return next(error);
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
