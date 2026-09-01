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
import {
  isCalendarDate,
  todayInZone,
} from '../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';
import { getAuthenticatedUserId } from '../../utils/authUtils/getAuthenticatedUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { pool } from '../../db/config/configDB.js';

/**
 * Refuse a currency code this installation does not convert, as a client error.
 *
 * getCurrencyId throws a plain Error for a code it cannot find, and a plain
 * Error declares no status, so the handler defaulted it to 500 — a server fault
 * reported for the client's own typo. Measured: `zzz` answered
 * `{ message: 'Currency code not found: zzz', status: 500 }`.
 *
 * The lookup's own contract is left alone. It is called across the API and its
 * throw is documented; narrowing the failure belongs to the endpoint that knows
 * the code arrived in a request body.
 *
 * The code is the one the historical resolver already raises for the same fact,
 * so a client branches on one name whichever layer refuses. details names the
 * side, since a conversion carries two currencies.
 *
 * @param {string} code - The currency code as the client sent it.
 * @param {string} side - 'fromCurrency' or 'toCurrency'.
 * @returns {Promise<void>}
 * @throws {Error} 400 UNSUPPORTED_FX_CURRENCY
 */
async function assertCurrencySupported(code, side) {
  try {
    if (await getCurrencyId(null, code)) return;
  } catch {
    // Not found. Refused below, with the status and the code the client needs.
  }

  throw createError(400, `unsupported currency code: ${code}`, {
    errorCode: 'UNSUPPORTED_FX_CURRENCY',
    details: { currency: String(code), side },
  });
}

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
    //
    // Raised rather than returned, and carrying a code rather than only prose.
    // Every other refusal on this path — the date, the currency, the day that
    // cannot be valued — reaches the client as errorCode plus details, and a
    // caller that has to read English to tell one 400 from another cannot act
    // on the difference.
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw createError(400, 'amount must be a positive number', {
        errorCode: 'INVALID_FX_AMOUNT',
        details: { amount: String(amount) },
      });
    }

    // 2. Validate currencies
    await assertCurrencySupported(fromCurrency, 'fromCurrency');
    await assertCurrencySupported(toCurrency, 'toCurrency');

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

    // Which day is today is the OWNER'S question, and the answer routes the
    // conversion: today takes the live rate, an earlier day takes the one that
    // was in force on it. transactionController decides it the same way, and it
    // has to — this endpoint exists so a form can show the figure the row will
    // carry, and a preview that routes differently from the write shows a
    // different number. Measured before this: an entry dated today previewed at
    // 3.1223 from the historical store, which had walked back to the validity of
    // three days earlier, while the row stored 3.1114 at the live rate.
    //
    // This is not the current-month rule, which stays out of here: that one
    // governs whether an operation MAY be recorded on a date, and this endpoint
    // records nothing.
    //
    // The route is behind verifyToken, so the identity is there; UTC is the
    // fallback rather than a refusal, because a missing claim is the token
    // middleware's error to raise and not this handler's.
    const ownerId = getAuthenticatedUserId(req);
    const timeZone = ownerId ? await getUserTimeZone(pool, ownerId) : 'UTC';
    const todayForOwner = todayInZone(timeZone);

    const asOfDay =
      requestedDay !== '' && requestedDay < todayForOwner ? requestedDay : null;

    // 4. Perform conversion
    const conversion = await currencyAmountConversion(
      numericAmount,
      fromCurrency,
      toCurrency,
      asOfDay,
      // The same zone asOfDay was decided on, so the resolver's future guard and
      // this handler's routing agree on which day it is.
      timeZone,
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
      // The market figure behind the rate, in the direction every source
      // publishes: 1 accounting unit = quote.rate of quote.currency. rate alone
      // is the conversion's multiplier, and for a currency worth a fraction of
      // an accounting unit it rounds to zero in any display — the reader is told
      // there is no rate when there is one.
      quote: conversion.quote,
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
