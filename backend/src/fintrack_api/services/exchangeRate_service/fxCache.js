// backend/src/fintrack_api/services/exchangeRate_service/fxCache.js
// 💰 CACHE: In-memory cache for exchange rates

import { FX_CACHE_TTL_MS } from './fxConfig.js';

const memoryCache = new Map();

// ===================================
// 1. Retrieve rate from memory cache
// ===================================
export function getRateFromMemoryCache(base, target) {
  const key = `${base}_${target}`;
  const entry = memoryCache.get(key);

  if (entry && entry.expiresAt > Date.now()) {
   console.log(`⚡ Memory cache hit: ${key} = ${entry.rate}`);

   return { rate: entry.rate, source: entry.source, fetchedAt: entry.fetchedAt };
  }
  return null;
}

// ===================================
// 2. Store rate in memory cache
// ===================================
export function setRateInMemoryCache(base, target, rate, source, fetchedAt,customTtlMs = null) {
  const key = `${base}_${target}`;

  const ttlMs = customTtlMs !== null ? customTtlMs : FX_CACHE_TTL_MS;
  
  memoryCache.set(key, {
    rate,
    source,
    fetchedAt,
    expiresAt: Date.now() + ttlMs,
  });
}

// ===================================
// 3. Clear memory cache (useful for testing)
// ===================================
export function clearMemoryCache() {
  memoryCache.clear();
  console.log('🗑️ Memory cache cleared');
}