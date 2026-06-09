// backend/src/fintrack_api/services/exchangeRate_service/exchangeRateService.js

// 💰 MAIN SERVICE: Convert amounts using cascade (memory → DB → providers → fallback)

import { pool } from '../../../db/config/configDB.js';

import Decimal from 'decimal.js';
import { getCurrencyId } from '../../../utils/currencyLookup.js';

//fx rate providers
import { fetchFromExchangeRateAPI } from '../exchangeRate_providers/exchangeRateApiProvider.js';
import { fetchFromFreeCurrencyAPI } from '../exchangeRate_providers/freeCurrencyApiProvider.js';
import { fetchFromGitHubFallback } from '../exchangeRate_providers/githubFallbackProvider.js';
import { fetchFromCotizave } from '../exchangeRate_providers/cotizaveApiProvider.js';
import { getFallbackRate } from '../exchangeRate_providers/getFallbackRate.js';

// ============================
// 1. Configuration
// ============================
const TTL_HOURS = parseInt(process.env.FX_CACHE_TTL_HOURS || '22', 10);
const TTL_MS = TTL_HOURS * 60 * 60 * 1000;

// ============================
// 2. In-memory cache
// ============================
const memoryCache = new Map();

function getFromMemoryCache(base, target) {
  const key = `${base}_${target}`;
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    console.log(`⚡ Memory cache hit: ${key} = ${entry.rate}`);
    return { rate: entry.rate, source: entry.source, fetchedAt: entry.fetchedAt };
  }

  return null;
}

function setMemoryCache(base, target, rate, source, fetchedAt) {
  const key = `${base}_${target}`;
  memoryCache.set(key, {
    rate,
    source,
    fetchedAt,
    expiresAt: Date.now() + TTL_MS,
  });
}

// =======================================
// 3. Database cache (exchange_rates table)
// =======================================
async function getFromDatabase(baseId, targetId) {
  const result = await pool.query(
    `SELECT exchange_rate, source, fetched_at
     FROM exchange_rates
     WHERE base_currency_id = $1 AND target_currency_id = $2
     ORDER BY fetched_at DESC LIMIT 1`,
    [baseId, targetId]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const fetchedAt = new Date(row.fetched_at);
  if (Date.now() - fetchedAt.getTime() > TTL_MS) return null; // stale

  return {
    rate: parseFloat(row.exchange_rate),
    source: row.source,
    fetchedAt: row.fetched_at,
  };
}

async function persistRate(baseId, targetId, rate, source, fetchedAt) {
  // Validate rate
  if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid rate: ${rate} (not persisting)`);
  }
  await pool.query(
    `INSERT INTO exchange_rates (base_currency_id, target_currency_id, exchange_rate, source, fetched_at, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (base_currency_id, target_currency_id)
     DO UPDATE SET exchange_rate = EXCLUDED.exchange_rate, source = EXCLUDED.source, fetched_at = EXCLUDED.fetched_at`,
    [baseId, targetId, rate, source, fetchedAt]
  );
  console.log(`💾 Persisted rate for (${baseId},${targetId}): ${rate} (source: ${source})`);
}

// ======================================
// 4. External providers cascade
//  (with VES priority)
// ======================================
async function fetchFromExternalProviders(baseCode, targetCode) {
  const providers = [];

  // Priority 1: Cotizave (official BCV) – only if pair involves VES
  if (baseCode === 'ves' || targetCode === 'ves') {
    providers.push({ name: 'Cotizave API', fn: () => fetchFromCotizave(baseCode, targetCode) });
  }

  // Priority 2: ExchangeRate-API
  providers.push({ name: 'ExchangeRate-API', fn: () => fetchFromExchangeRateAPI(baseCode, targetCode) });

  // Priority 3: FreeCurrencyAPI
  providers.push({ name: 'FreeCurrencyAPI', fn: () => fetchFromFreeCurrencyAPI(baseCode, targetCode) });

  // Priority 4: GitHub fallback (all currencies)
  providers.push({ name: 'GitHub fallback', fn: () => fetchFromGitHubFallback(baseCode, targetCode) });
//--------------
  for (const provider of providers) {
    try {
      console.log(`🌐 Trying ${provider.name} 
       
      for ${baseCode}/${targetCode}...`);
      const result = await provider.fn();
      console.log(`✅ ${provider.name} success: ${result.rate}`);

      return result;

    } catch (error) {
      console.warn(`⚠️ ${provider.name} failed: ${error.message}`);
    }
  }
  throw new Error(`All external providers failed for ${baseCode}/${targetCode}`);
}

// ============================
// 5. Main exported function
// ============================
export async function convertAmountToBaseCurrency(amount, fromCurrency, toCurrency = 'usd') {
  const from = fromCurrency.toLowerCase();
  const to = toCurrency.toLowerCase();

  // Same currency – identity conversion
  if (from === to) {
    return {
      amount: new Decimal(amount),
      rate: 1.0,
      source: 'identity',
      fetchedAt: new Date(),
    };
  }

  // 1. Check memory cache
  const cached = getFromMemoryCache(from, to);
  
  if (cached) {
   console.log("🚀 ~ convertAmountToBaseCurrency ~ cached:", cached)

    const converted = new Decimal(amount).times(cached.rate);

    return { amount: converted, rate: cached.rate, source: cached.source, fetchedAt: cached.fetchedAt };
  }

  // Resolve currency IDs once
  const baseId = await getCurrencyId(null, from);
  const targetId = await getCurrencyId(null, to);

  // 2. Check database cache
  const dbCached = await
   getFromDatabase(baseId, targetId);
  if (dbCached) {
    setMemoryCache(from, to, dbCached.rate, dbCached.source, dbCached.fetchedAt);
    const converted = new Decimal(amount).times(dbCached.rate);
    return { amount: converted, rate: dbCached.rate, source: dbCached.source, fetchedAt: dbCached.fetchedAt };
  }

  // 3. External providers cascade
  let result;
  try {
    result = await fetchFromExternalProviders(from, to);
  } catch (err) {
    console.warn(`All external providers failed, using static fallback: ${err.message}`);
    const rate = getFallbackRate(from, to);
    result = { rate, source: 'static_fallback',
    fetchedAt: new Date() };
  }

  // 4. Persist (only if not static_fallback)
  if (result.source !== 'static_fallback') {
    try {
      await persistRate(baseId, targetId, result.rate, result.source, result.fetchedAt);
    } catch (err) {
      console.error(`Failed to persist rate: ${err.message}`);
    }
  }

  setMemoryCache(from, to, result.rate, result.source, result.fetchedAt);

  const converted = new Decimal(amount).times(result.rate);
  
  return { amount: converted, rate: result.rate, source: result.source, fetchedAt: result.fetchedAt };
}

// ===============================
// 6. Utility to clear cache (testing / admin)
// ============================
export function clearMemoryCache() {
  memoryCache.clear();
  console.log('🗑️ Memory cache cleared');
}