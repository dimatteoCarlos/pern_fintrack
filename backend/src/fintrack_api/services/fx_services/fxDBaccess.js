// backend/src/fintrack_api/services/fx_services/fxDBaccess.js

// [ADDED] ============================================
// 📦 BATCH FUNCTIONS FOR FX GLOBAL STATE
// ============================================

/**
 * FX Database Access Layer
 * 
 * ARCHITECTURE NOTE:
 * - FX requires the currency catalog to be loaded (checked via ensureCurrencyCatalogLoaded).
 * - However, currencyLookup.js provides a fallback to the database for other modules.
 * - This coexistence is intentional:
 *   - FX fails fast if catalog is missing (explicit dependency).
 *   - Other parts of the system can still resolve currencies via database if needed.
 * - This keeps FX simple while maintaining compatibility across the app.
 */

import { getCurrencyId, isCurrencyCatalogLoaded } from '../../../utils/currencyLookup.js';
import { pool } from '../../../db/config/configDB.js';

/**
 * Ensure currency catalog is loaded before any FX operation
 * @throws {Error} If catalog is not loaded
 */
function ensureCurrencyCatalogLoaded() {
  if (!isCurrencyCatalogLoaded()) {
    throw new Error('Currency catalog not loaded. FX subsystem unavailable.');
  }
}

/**
 * Resolve currency codes to IDs using the canonical currency resolution layer.
 * @param {string[]} currencyCodes - Array of currency codes (lowercase)
 * @returns {Promise<number[]>} - Array of currency IDs
 */
async function resolveCurrencyIds(currencyCodes) {
  const ids = await Promise.all(
    currencyCodes.map(code => getCurrencyId(null, code))
  );

  // Validate each ID is a positive integer
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    const invalid = currencyCodes.filter((_, i) => !Number.isInteger(ids[i]) || ids[i] <= 0);
    throw new Error(`Invalid or missing currency IDs for: ${invalid.join(', ')}`);
  }

  return ids;
}

/**
 * Get all exchange rates for multiple target currencies in a single query
 * @param {string[]} currencyCodes - Array of target currency codes (lowercase)
 * @param {number} baseCurrencyId - ID of the base currency
 * @returns {Promise<Object>} - { currencyCode: { rate, source, fetchedAt, providerUpdatedAt } }
 */
export async function getAllRatesFromDB(currencyCodes, baseCurrencyId) {
  if (!currencyCodes?.length) {
    return {};
  }

  ensureCurrencyCatalogLoaded();

  const targetIds = await resolveCurrencyIds(currencyCodes);

  const { rows } = await pool.query(
    `
    SELECT 
      target_currency_id,
      exchange_rate,
      source,
      fetched_at,
      provider_updated_at
    FROM exchange_rates
    WHERE base_currency_id = $1
      AND target_currency_id = ANY($2::int[])
    `,
    [baseCurrencyId, targetIds]
  );

  // Build code map directly from the original currencyCodes
  const codeMap = {};
  targetIds.forEach((id, index) => {
    codeMap[id] = currencyCodes[index];
  });

  const rates = {};
  for (const row of rows) {
    const code = codeMap[row.target_currency_id];
    if (!code) continue;

    rates[code] = {
      rate: parseFloat(row.exchange_rate),
      source: row.source,
      fetchedAt: row.fetched_at,
      providerUpdatedAt: row.provider_updated_at,
    };
  }

  return rates;
}

/**
 * Insert or update multiple exchange rates in a single transaction
 * @param {Array<Object>} ratesBatch - Array of { targetCode, rate, source, fetchedAt, providerUpdatedAt? }
 * @param {number} baseCurrencyId - ID of the base currency
 * @returns {Promise<void>}
 */
export async function upsertRatesBatch(ratesBatch, baseCurrencyId) {
  if (!ratesBatch?.length) {
    return;
  }

  ensureCurrencyCatalogLoaded();

  const targetIds = await resolveCurrencyIds(
    ratesBatch.map(r => r.targetCode)
  );

  const client = await pool.connect();
  let persistedCount = 0;

  try {
    await client.query('BEGIN');

    for (let i = 0; i < ratesBatch.length; i++) {
      const item = ratesBatch[i];

      if (!Number.isFinite(item.rate) || item.rate <= 0) {
        console.warn(`⚠️ Skipping invalid rate for ${item.targetCode}: ${item.rate}`);
        continue;
      }

      const fetchedAt = item.fetchedAt instanceof Date ? item.fetchedAt : new Date(item.fetchedAt);

      await client.query(
        `
        INSERT INTO exchange_rates (
          base_currency_id,
          target_currency_id,
          exchange_rate,
          source,
          fetched_at,
          provider_updated_at,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (base_currency_id, target_currency_id)
        DO UPDATE SET
          exchange_rate = EXCLUDED.exchange_rate,
          source = EXCLUDED.source,
          fetched_at = EXCLUDED.fetched_at,
          provider_updated_at = EXCLUDED.provider_updated_at,
          updated_at = NOW()
        `,
        [
          baseCurrencyId,
          targetIds[i],
          item.rate,
          item.source || 'unknown',
          fetchedAt,
          item.providerUpdatedAt || null,
        ]
      );

      persistedCount++;
    }

    await client.query('COMMIT');
    console.log(`💾 Batch persisted: ${persistedCount} rates (${ratesBatch.length - persistedCount} skipped)`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to persist rates batch:', error.message);
    throw error;
  } finally {
    client.release();
  }
}