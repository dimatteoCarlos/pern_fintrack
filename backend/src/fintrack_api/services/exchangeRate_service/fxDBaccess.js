// backend/src/fintrack_api/services/exchangeRate_service/fxDBaccess.js
// 💰 DATABASE ACCESS: Read/write exchange_rates table

import { pool } from '../../../db/config/configDB.js';
import { FX_CACHE_TTL_MS, FX_STATIC_FALLBACK_TTL_MS } from './fxConfig.js';

// =================================
// 1. Retrieve rate from database
// =================================
export async function getRateFromDB(baseId, targetId) {
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
  const age = Date.now() - fetchedAt.getTime();

  // Different TTL for static_fallback
  const maxAge = row.source === 'static_fallback' ? FX_STATIC_FALLBACK_TTL_MS : FX_CACHE_TTL_MS;
  if (age > maxAge) return null;

  return {
    rate: parseFloat(row.exchange_rate),
    source: row.source,
    fetchedAt: row.fetched_at,
  };
}

// ===================================
// 2. Persist rate (UPSERT)
// ===================================
export async function persistRateInDB(baseId, targetId, rate, source, fetchedAt) {
  // Validate rate before persisting
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