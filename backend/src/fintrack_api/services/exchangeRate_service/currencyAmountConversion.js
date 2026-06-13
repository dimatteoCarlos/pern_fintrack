// backend/src/fintrack_api/services/exchangeRate_service/currencyAmountConversion.js

// 💰 MAIN ORCHESTRATOR: Convert amounts using cascade (memory → DB → providers → fallback)

import { getCurrencyId } from '../../../utils/currencyLookup.js';
import { getRateFromMemoryCache, setRateInMemoryCache, clearMemoryCache } from './fxCache.js';
import { getRateFromDB, persistRateInDB } from './fxDBaccess.js';
import { fetchFromExternalProviders } from './fxProviderOrchestrator.js';
import { fxRateDecimal } from './fxRateDecimal.js';
import { getFallbackRate } from '../exchangeRate_providers/getFallbackRate.js';
import { FX_STATIC_FALLBACK_TTL_MS } from './fxConfig.js';

// ====================================
// 1. Helper to set memory cache with optional TTL (for static_fallback)
// ====================================
function setMemoryCacheWithTTL(base, target, rate, source, fetchedAt) {
 
  if (source === 'static_fallback') {
    // Use shorter TTL for fallback rates
    setRateInMemoryCache(base, target, rate, source, fetchedAt, FX_STATIC_FALLBACK_TTL_MS);

  } else {
    setRateInMemoryCache(base, target, rate, source, fetchedAt);
  }
}

// ====================================
// 2. Main exported function
// ====================================
/**
 * Convert an amount from one currency to another (defaults to USD).
 * Uses cascade: memory → DB → external providers → static fallback.
 * @param {number|string} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code (e.g., 'eur')
 * @param {string} toCurrency - Target currency code (default 'usd')
 * @returns {Promise<{amount: Decimal, rate: number, source: string, fetchedAt: Date}>}
 */
//MAIN FUNCTION: currencyAmountConversion
// Convert amount with cascade and caching
export async function currencyAmountConversion(amount, fromCurrency, toCurrency = 'usd') {
  const from = fromCurrency.toLowerCase();
  const to = toCurrency.toLowerCase();

  // Identity conversion (same currency)
  if (from === to) {
    return {
      amount: fxRateDecimal(amount, 1),
      rate: 1,
      source: 'identity',
      fetchedAt: new Date(),
    };
  }

  // 1. Memory cache
  const cached = getRateFromMemoryCache(from, to);
  if (cached) {
    return {
      amount: fxRateDecimal(amount, cached.rate),
      rate: cached.rate,
      source: cached.source,
      fetchedAt: cached.fetchedAt,
    };
  }

  // Resolve currency IDs synchronously (catalog must be preloaded)
  const baseId = await getCurrencyId(null,from);
  const targetId = await getCurrencyId(null,to);

  // 2. Database cache
  const dbCached = await getRateFromDB(baseId, targetId);
  if (dbCached) {
    setRateInMemoryCache(from, to, dbCached.rate, dbCached.source, dbCached.fetchedAt);
    return {
      amount: fxRateDecimal(amount, dbCached.rate),
      rate: dbCached.rate,
      source: dbCached.source,
      fetchedAt: dbCached.fetchedAt,
    };
  }

  // 3. External providers cascade
  let result;
  try {
    result = await fetchFromExternalProviders(from, to);
  } catch (err) {
    console.warn(`All external providers failed, using static fallback: ${err.message}`);
    const rate = getFallbackRate(from, to);
    result = { rate, source: 'static_fallback', fetchedAt: new Date() };
  }

  // 4. Persist always (including static_fallback)
  await persistRateInDB(baseId, targetId, result.rate, result.source, result.fetchedAt);

  // 5. Store in memory cache (with different TTL for static_fallback)
  setMemoryCacheWithTTL(from, to, result.rate, result.source, result.fetchedAt);

  console.log('result:', {
    amount: fxRateDecimal(amount, result.rate),
    rate: result.rate,
    source: result.source,
    fetchedAt: result.fetchedAt,
  })

  return {
    amount: fxRateDecimal(amount, result.rate),
    rate: result.rate,
    source: result.source,
    fetchedAt: result.fetchedAt,
  };
}

// ====================================
// 3. Re-export utility for clearing cache (testing/admin)
// ====================================
export { clearMemoryCache };