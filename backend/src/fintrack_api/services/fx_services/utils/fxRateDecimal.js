// backend/src/fintrack_api/services/exchangeRate_service/fxRateDecimal.js
// 💰 DECIMAL CONVERSION: Precise amount multiplication using Decimal.js

import Decimal from 'decimal.js';

/**
 * Multiply an amount by a rate using Decimal.js for exact precision.
 * @param {number|string} amount - The amount to convert
 * @param {number} rate - The exchange rate
 * @returns {Decimal} - Result as a Decimal object (to preserve precision)
 */
export function fxRateDecimal(amount, rate) {
  return new Decimal(amount).times(rate);
}