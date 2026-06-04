// backend/src/fintrack_api/services/fx_currency_catalog/loadCurrencyCatalog.js

// 💰 CURRENCY CATALOG: In-memory cache for currency_id ↔ currency_code (sync access)

import { pool } from '../../../db/config/configDB.js';

// ===================================
// 1. Internal state
// ===================================
// Map<currency_code (lowercase), currency_id>
let currenciesByCode = null;
// Map<currency_id, currency_code (lowercase)>
let currenciesById = null;
let isLoaded = false;

// ===================================
// 2. Load catalog from database (call once at startup)
// ===================================
/**
 * Load all currencies from the database into memory.
 * Must be called during application initialization.
 * @param {object} client - Database client (optional, defaults to pool)
 * @returns {Promise<void>}
 */
export async function loadCurrencyCatalog(client = pool) {
  const res = await client.query('SELECT currency_id, currency_code FROM currencies');
  currenciesByCode = new Map();
  currenciesById = new Map();
  for (const row of res.rows) {
    const currencyCode = row.currency_code.toLowerCase();
    currenciesByCode.set(currencyCode, row.currency_id);
    currenciesById.set(row.currency_id, currencyCode);
  }
  isLoaded = true;
  console.log(`✅ Currency catalog loaded: ${currenciesByCode.size} currencies`);
}

// ===================================
// 3. Synchronous accessors (must be called after load)
// ===================================
/**
 * Get currency ID by currency code (case-insensitive) – SYNC.
 * @param {string} currencyCode - Currency code (e.g., 'usd', 'eur')
 * @returns {number} currency_id
 * @throws {Error} If catalog not loaded or code not found
 */
export function getCurrencyIdSync(currencyCode) {
  if (!isLoaded) {
    throw new Error('Currency catalog not loaded. Call loadCurrencyCatalog() first.');
  }
  const normalizedCode = currencyCode.toLowerCase();
  const currencyId = currenciesByCode.get(normalizedCode);
  if (currencyId === undefined) {
    throw new Error(`Currency code not found: ${currencyCode}`);
  }
  return currencyId;
}

/**
 * Get currency code by currency ID – SYNC.
 * @param {number} currencyId - currency_id
 * @returns {string} Currency code (lowercase)
 * @throws {Error} If catalog not loaded or ID not found
 */
export function getCurrencyCodeSync(currencyId) {
  if (!isLoaded) {
    throw new Error('Currency catalog not loaded. Call loadCurrencyCatalog() first.');
  }
  const currencyCode = currenciesById.get(currencyId);
  if (currencyCode === undefined) {
    throw new Error(`Currency ID not found: ${currencyId}`);
  }
  return currencyCode;
}

// ===================================
// 4. Utility to check if catalog is ready
// ===================================
export function isCurrencyCatalogLoaded() {
  return isLoaded;
}