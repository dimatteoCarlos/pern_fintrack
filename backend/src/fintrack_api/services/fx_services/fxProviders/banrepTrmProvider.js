// backend/src/fintrack_api/services/fx_services/fxProviders/banrepTrmProvider.js

// ================================
// 🇨🇴 BANREP TRM PROVIDER (Priority 1 for COP)
// ================================
/**
 * Official COP provider. Serves the Tasa Representativa del Mercado (TRM),
 * published daily by the Superintendencia Financiera de Colombia and exposed
 * as an open dataset on datos.gov.co (Socrata). No API key required.
 *
 * Single-currency provider, same shape as cotizaveApiProvider for VES:
 * - fetchAllRates(baseCurrency) → { rates: { cop: {...} }, source, fetchedAt }
 * - fetchRate(baseCurrency, targetCurrency) → { rate, source, fetchedAt } or null
 *
 * Dataset row:
 * { valor: '3048.12', unidad: 'COP', vigenciadesde: '2026-08-22T00:00:00.000',
 *   vigenciahasta: '2026-08-24T00:00:00.000' }
 * A row stays valid from vigenciadesde to vigenciahasta, so a weekend or a
 * holiday carries the last business day's rate.
 */

import axios from 'axios';

const TRM_DATASET_URL = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

const FX_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

// Colombia has no DST, so the dataset's naked timestamps are always UTC-05:00.
const COLOMBIA_UTC_OFFSET = '-05:00';

// A published TRM older than this is treated as unusable rather than served stale.
const MAX_TRM_AGE_DAYS = 7;

/**
 * Parse a dataset timestamp as Colombian local time.
 * @param {string} value - e.g. '2026-08-22T00:00:00.000'
 * @returns {Date|null}
 */
function parseColombianDate(value) {
 if (typeof value !== 'string' || !value) return null;
 const parsed = new Date(`${value}${COLOMBIA_UTC_OFFSET}`);
 return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Fetch the currently effective TRM.
 *
 * fetchedAt is the read time, not vigenciadesde: the TRM is published at
 * midnight and stays officially effective until vigenciahasta, so dating it by
 * publication would make a Sunday rate look 48h stale and expire the FX state
 * on every request. publishedAt carries the issue date for traceability.
 *
 * @returns {Promise<{rate: number, source: string, fetchedAt: Date, publishedAt: Date}>}
 * @throws {Error} - On network failure, malformed payload or a stale rate
 */
export async function fetchTrm() {
 const headers = {};

 // Optional: raises the anonymous Socrata rate limit. Not required.
 if (process.env.DATOS_GOV_APP_TOKEN) {
  headers['X-App-Token'] = process.env.DATOS_GOV_APP_TOKEN;
 }

 const response = await axios.get(TRM_DATASET_URL, {
  timeout: FX_TIMEOUT_MS,
  headers,
  params: { '$limit': 1, '$order': 'vigenciadesde DESC' },
 });

 const row = Array.isArray(response.data) ? response.data[0] : null;

 if (!row) {
  throw new Error('TRM dataset returned no rows');
 }

 const rate = Number(row.valor);

 if (!Number.isFinite(rate) || rate <= 0) {
  throw new Error(`Invalid TRM value: ${row.valor}`);
 }

 const publishedAt = parseColombianDate(row.vigenciadesde);

 if (!publishedAt) {
  throw new Error(`Invalid TRM vigenciadesde: ${row.vigenciadesde}`);
 }

 const ageDays = (Date.now() - publishedAt.getTime()) / 86400000;

 if (ageDays > MAX_TRM_AGE_DAYS) {
  throw new Error(`TRM is ${Math.floor(ageDays)} days old`);
 }

 console.log(`[FX] Banrep TRM usd -> cop: ${rate} (published ${row.vigenciadesde})`);

 return {
  rate,
  source: 'banrep-trm',
  fetchedAt: new Date(),
  publishedAt,
 };
}

// ================================
// STANDARDIZED FUNCTIONS (for FX global state)
// ================================

/**
 * Fetch the COP rate for the given base currency.
 * @param {string} baseCurrency - Base currency code (e.g., 'usd')
 * @returns {Promise<Object|null>} - { rates: { cop }, source, fetchedAt } or null
 */
export async function fetchAllRates(baseCurrency) {
 try {
  const base = typeof baseCurrency === 'string' ? baseCurrency.toLowerCase() : '';

  // The TRM is a USD/COP quote; any other base has to come from an aggregator.
  if (base !== 'usd') return null;

  const result = await fetchTrm();

  return {
   rates: {
    cop: {
     rate: result.rate,
     source: result.source,
     fetchedAt: result.fetchedAt,
    },
   },
   source: result.source,
   fetchedAt: result.fetchedAt,
  };
 } catch (error) {
  console.warn('⚠️ Banrep TRM fetchAllRates failed:', error.message);
  return null;
 }
}

/**
 * Fetch a specific rate. Only the usd/cop pair is served, in both directions.
 * @param {string} baseCurrency - Base currency code
 * @param {string} targetCurrency - Target currency code
 * @returns {Promise<Object|null>} - { rate, source, fetchedAt } or null
 */
export async function fetchRate(baseCurrency, targetCurrency) {
 try {
  const base = typeof baseCurrency === 'string' ? baseCurrency.toLowerCase() : '';
  const target = typeof targetCurrency === 'string' ? targetCurrency.toLowerCase() : '';

  const isDirect = base === 'usd' && target === 'cop';
  const isInverse = base === 'cop' && target === 'usd';

  if (!isDirect && !isInverse) return null;

  const result = await fetchTrm();

  return {
   rate: isDirect ? result.rate : 1 / result.rate,
   source: result.source,
   fetchedAt: result.fetchedAt,
  };
 } catch (error) {
  console.warn(`⚠️ Banrep TRM fetchRate failed for ${targetCurrency}:`, error.message);
  return null;
 }
}
