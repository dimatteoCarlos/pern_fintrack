// backend/src/utils/fintrackUtils/transactionManagement/fxMetadataHelper.js
/**
 * FX Metadata Helper - Centralized FX metadata creation
 * 
 * PURPOSE:
 * - Single function for all FX metadata scenarios
 * - Identity (1:1) mode by default
 * - Conversion mode with optional overrides
 */

import { getCurrencyId } from '../../currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../fintrack_api/config/fintrackConfig.js';

/**
 * Build FX metadata object
 * @param {number} originalAmount - Amount in original currency
 * @param {number} originalCurrencyId - ID of the original currency
 * @param {object} pool - Database pool for queries
 * @param {object} options - Optional parameters
 * @param {number} options.exchangeRate - Rate (default: 1.0)
 * @param {string} options.exchangeRateSource - Source (default: 'identity')
 * @param {Date} options.exchangeRateTimestamp - Timestamp (default: new Date())
 * @returns {Promise<Object>} FX metadata object
 */
export async function buildFxMetadata(
  originalAmount,
  originalCurrencyId,
  pool,
  options = {}
) {
  const {
    exchangeRate = 1.0,
    exchangeRateSource = 'identity',
    exchangeRateTimestamp = new Date(),
  } = options;

  const accountingCurrencyId = await getCurrencyId(pool, ACCOUNTING_CURRENCY_CODE);
  
  return {
    original_amount: originalAmount,
    original_currency_id: originalCurrencyId,
    exchange_rate: exchangeRate,
    exchange_rate_source: exchangeRateSource,
    exchange_rate_timestamp: exchangeRateTimestamp,
    exchange_rate_target_currency_id: accountingCurrencyId,
  };
}