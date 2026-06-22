// backend/src/fintrack_api/services/fx_services/db/fxDBaccess.js
// ====================================
// 📦 BATCH FUNCTIONS FOR FX GLOBAL STATE
// ====================================
/**
 * FX Database Access Layer
 *
 * ARCHITECTURE NOTE:
 * - FX prefers the currency catalog to be loaded for performance.
 * - However, currencyLookup.js provides a fallback to the database if needed.
 * - This coexistence is intentional:
 *   - FX attempts to reload the catalog if missing (resilience).
 *   - The system can still resolve currencies via database if catalog fails.
 */
//
import { pool } from '../../../../db/config/configDB.js';

import { getCurrencyId } from '../../../../utils/currencyLookup.js';

import { isCurrencyCatalogLoaded, loadCurrencyCatalog } from '../currency_catalog/loadCurrencyCatalog.js';
// ===========================
// INTERNAL HELPERS
// ===========================

/**
 * Ensure currency catalog is loaded before any FX operation.
 * If catalog is missing, attempt to reload it.
 * If reload fails, log a warning and continue (fallback to DB).
 */
async function ensureCurrencyCatalogLoaded() {
  if (!isCurrencyCatalogLoaded()) {
    console.warn('⚠️ Currency catalog not loaded. Attempting to reload...');
    try {
      await loadCurrencyCatalog();
      console.log('✅ Currency catalog reloaded successfully.');
    } catch (err) {
      console.warn(
        '⚠️ Failed to reload catalog. FX will fallback to database lookup via getCurrencyId().',
      );
    }
  }
}

/**
 * Resolve currency codes to IDs using the canonical currency resolution layer.
 * @param {string[]} currencyCodes - Array of currency codes (lowercase)
 * @returns {Promise<number[]>} - Array of currency IDs
 */
async function resolveCurrencyIds(currencyCodes) {
  const ids = await Promise.all(
    currencyCodes.map((code) => getCurrencyId(null, code)),
  );

  // Validate each ID is a positive integer
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    const invalid = currencyCodes.filter(
      (_, i) => !Number.isInteger(ids[i]) || ids[i] <= 0,
    );
    throw new Error(
      `Invalid or missing currency IDs for: ${invalid.join(', ')}`,
    );
  }

  return ids;
}

// ===========================
// PUBLIC API
// ===========================

/**
 * Get all exchange rates for multiple target currencies in a single query.
 * Uses ANY($2::int[]) for efficient IN-clause with integer array.
 *
 * @param {string[]} currencyCodes - Array of target currency codes (lowercase)
 * @param {number} baseCurrencyId - ID of the base currency
 * @returns {Promise<Object>} - { currencyCode: { rate, source, fetchedAt, providerUpdatedAt } }
 */
export async function getAllRatesFromDB(currencyCodes, baseCurrencyId) {
  if (!currencyCodes?.length) {
    return {};
  }

  await ensureCurrencyCatalogLoaded();

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
    [baseCurrencyId, targetIds],
  );

  // Build code map directly from the original currencyCodes.
  // targetIds preserves the same order as currencyCodes
  // because resolveCurrencyIds() maps them positionally.
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
 * Insert or update multiple exchange rates in a single transaction.
 * Uses ON CONFLICT (base_currency_id, target_currency_id) for upsert.
 *
 * @param {Array<Object>} ratesBatch - Array of { targetCode, rate, source, fetchedAt, providerUpdatedAt? }
 * @param {number} baseCurrencyId - ID of the base currency
 * @returns {Promise<void>}
 */
export async function upsertRatesBatch(ratesBatch, baseCurrencyId) {
  if (!ratesBatch?.length) {
    return;
  }

  await ensureCurrencyCatalogLoaded();

  const targetIds = await resolveCurrencyIds(
    ratesBatch.map((r) => r.targetCode),
  );

  const client = await pool.connect();
  let persistedCount = 0;

  try {
    await client.query('BEGIN');

    for (let i = 0; i < ratesBatch.length; i++) {
      const item = ratesBatch[i];
      const targetCurrencyId = targetIds[i];

      // Validate rate with warning
      if (!Number.isFinite(item.rate) || item.rate <= 0) {
        console.warn(
          `⚠️ Skipping invalid rate for ${item.targetCode}: ${item.rate}`,
        );
        continue;
      }

      const fetchedAt =
        item.fetchedAt instanceof Date
          ? item.fetchedAt
          : new Date(item.fetchedAt);

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
          provider_updated_at = EXCLUDED.provider_updated_at

        `,
        [
          baseCurrencyId,
          targetCurrencyId,
          item.rate,
          item.source || 'unknown',
          fetchedAt,
          item.providerUpdatedAt || null,
        ],
      );

      persistedCount++;
    }

    await client.query('COMMIT');
    console.log(
      `💾 Batch persisted: ${persistedCount} rates (${ratesBatch.length - persistedCount} skipped)`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to persist rates batch:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// ─── LEGACY FUNCTIONS (Backward compatibility for currencyAmountConversion) ───

/**
 * Get a single exchange rate from the database.
 * @param {number} baseCurrencyId - Base currency ID
 * @param {number} targetCurrencyId - Target currency ID
 * @returns {Promise<Object|null>} - { rate, source, fetchedAt } or null
 */
export async function getRateFromDB(baseCurrencyId, targetCurrencyId) {
  await ensureCurrencyCatalogLoaded();

  const result = await pool.query(
    `
    SELECT exchange_rate, source, fetched_at
    FROM exchange_rates
    WHERE base_currency_id = $1 AND target_currency_id = $2
    ORDER BY fetched_at DESC
    LIMIT 1
    `,
    [baseCurrencyId, targetCurrencyId],
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    rate: parseFloat(row.exchange_rate),
    source: row.source,
    fetchedAt: row.fetched_at,
  };
}

/**
 * Persist a single exchange rate in the database.
 * @param {number} baseCurrencyId - Base currency ID
 * @param {number} targetCurrencyId - Target currency ID
 * @param {number} rate - Exchange rate
 * @param {string} source - Rate source
 * @param {Date} fetchedAt - When the rate was obtained
 * @param {Date|null} providerUpdatedAt - Optional provider timestamp
 * @returns {Promise<void>}
 */
export async function persistRateInDB(
  baseCurrencyId,
  targetCurrencyId,
  rate,
  source,
  fetchedAt,
  providerUpdatedAt = null,
) {
  await ensureCurrencyCatalogLoaded();

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid rate value: ${rate}`);
  }

  await pool.query(
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
      provider_updated_at = EXCLUDED.provider_updated_at
    `,
    [
      baseCurrencyId,
      targetCurrencyId,
      rate,
      source || 'unknown',
      fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt),
      providerUpdatedAt,
    ],
  );
}
