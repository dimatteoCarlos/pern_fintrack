// backend/src/utils/currencyLookup.js
// 🔍 CURRENCY LOOKUP: Async functions to get currency id/code with catalog fallback

import { pool } from '../db/config/configDB.js';
import {
  isCurrencyCatalogLoaded,
  getCurrencyIdSync,
  getCurrencyCodeSync,
} from '../fintrack_api/services/fx_currency_catalog/loadCurrencyCatalog.js';

/**
 * Get currency ID from currency code.
 * Uses in-memory catalog if loaded, otherwise queries database.
 * @param {object} clientOrPool - Optional database client (for transactions)
 * @param {string} currencyCode - Currency code (e.g., 'usd')
 * @returns {Promise<number>} currency_id
 * @throws {Error} If currency not found
 */

export async function getCurrencyId(clientOrPool = null, currencyCode) {
 // 1. Try catalog first (sync, fast)
  if (isCurrencyCatalogLoaded()) {
    try {
      return getCurrencyIdSync(currencyCode);
    } catch (err) {
     // Not found in catalog -> fallback to DB
      console.warn(`Currency ${currencyCode} not in catalog: ${err.message}. Falling back to DB.`);
    }
  }

  // 2. Fallback to database query
  const db = clientOrPool || pool;
  const result = await db.query(
    'SELECT currency_id FROM currencies WHERE currency_code = $1',
    [currencyCode]
  );
  if (result.rows.length === 0) {
    throw new Error(`Currency code not found: ${currencyCode}`);
  }
  return result.rows[0].currency_id;
}
//----------------------------
/**
 * Get currency code from currency ID.
 * Uses in-memory catalog if loaded, otherwise queries database.
 * @param {object} clientOrPool - Optional database client (for transactions)
 * @param {number} currencyId - currency_id
 * @returns {Promise<string>} currency_code (lowercase)
 * @throws {Error} If currency ID not found
 */
export async function getCurrencyCode(clientOrPool = null, currencyId) {
  if (isCurrencyCatalogLoaded()) {
    try {
      return getCurrencyCodeSync(currencyId);
    } catch (err) {
      console.warn(`Currency ID ${currencyId} not in catalog: ${err.message}. Falling back to DB.`);
    }
  }

  const db = clientOrPool || pool;
  const result = await db.query(
    'SELECT currency_code FROM currencies WHERE currency_id = $1',
    [currencyId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Currency ID not found: ${currencyId}`);
  }
  return result.rows[0].currency_code;
}

// ======================================
// Export synchronous versions for direct catalog access
// ======================================
export { getCurrencyIdSync, getCurrencyCodeSync };