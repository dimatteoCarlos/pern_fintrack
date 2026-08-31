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
 * - fetchTrmForDate(date) → { rate, source, effectiveDate, ... } — the historical arm
 * - fetchTrmRange(from, to) → one row per validity — how the resolver fills a window
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
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;

// A published TRM older than this is treated as unusable rather than served stale.
const MAX_TRM_AGE_DAYS = 7;

// A month holds at most 31 validities. The cap is a tripwire for a window
// wider than intended, not a page size: hitting it is treated as a failure.
const TRM_RANGE_ROW_LIMIT = 200;

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

/**
 * Normalize a requested day to the dataset's calendar day, 'YYYY-MM-DD'.
 * Colombia has no DST, so a Date is read at a fixed UTC-05:00 offset.
 * @param {string|Date} value - 'YYYY-MM-DD', an ISO timestamp, or a Date
 * @returns {string|null}
 */
function toColombianDay(value) {
 let day = null;

 if (value instanceof Date) {
  if (Number.isNaN(value.getTime())) return null;
  day = new Date(value.getTime() - COLOMBIA_OFFSET_MS).toISOString().slice(0, 10);
 } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
  day = value.slice(0, 10);
 }

 if (!day) return null;

 // Rejects a well-formed but impossible day such as '2026-02-31'.
 const parsed = new Date(`${day}T00:00:00.000Z`);

 if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
  return null;
 }

 return day;
}

/**
 * Fetch the TRM in force on a past day.
 *
 * The TRM is published on trading days only, so the query is not an equality:
 * it takes the most recent row whose validity starts on or before the requested
 * day, which is how a Sunday or a holiday resolves in a single call. The row's
 * own vigenciahasta then confirms the day really falls inside its validity.
 *
 * effectiveDate is the day that actually supplied the rate and differs from the
 * requested day on every non-trading day; the caller stores it as provenance.
 *
 * @param {string|Date} date - The requested day, 'YYYY-MM-DD' or a Date
 * @returns {Promise<{rate: number, source: string, requestedDate: string, effectiveDate: string, effectiveUntil: string, fetchedAt: Date, publishedAt: Date}>}
 * @throws {Error} - On an invalid day, network failure, malformed payload or no rate in force
 */
export async function fetchTrmForDate(date) {
 const day = toColombianDay(date);

 if (!day) {
  throw new Error(`Invalid TRM date requested: ${date}`);
 }

 const headers = {};

 // Optional: raises the anonymous Socrata rate limit. Not required.
 if (process.env.DATOS_GOV_APP_TOKEN) {
  headers['X-App-Token'] = process.env.DATOS_GOV_APP_TOKEN;
 }

 const response = await axios.get(TRM_DATASET_URL, {
  timeout: FX_TIMEOUT_MS,
  headers,
  params: {
   // The day is validated above, so it cannot carry a SoQL fragment.
   '$where': `vigenciadesde <= '${day}T23:59:59.999'`,
   '$order': 'vigenciadesde DESC',
   '$limit': 1,
  },
 });

 const row = Array.isArray(response.data) ? response.data[0] : null;

 if (!row) {
  throw new Error(`No TRM published on or before ${day}`);
 }

 const rate = Number(row.valor);

 if (!Number.isFinite(rate) || rate <= 0) {
  throw new Error(`Invalid TRM value for ${day}: ${row.valor}`);
 }

 const publishedAt = parseColombianDate(row.vigenciadesde);

 if (!publishedAt) {
  throw new Error(`Invalid TRM vigenciadesde for ${day}: ${row.vigenciadesde}`);
 }

 const effectiveDate = String(row.vigenciadesde).slice(0, 10);
 const effectiveUntil = String(row.vigenciahasta || '').slice(0, 10);

 // Guards a day past the published series: the last row must still cover it.
 if (effectiveUntil && effectiveUntil < day) {
  throw new Error(`No TRM in force on ${day}; last one ended ${effectiveUntil}`);
 }

 console.log(`[FX] Banrep TRM usd -> cop for ${day}: ${rate} (effective ${effectiveDate})`);

 return {
  rate,
  source: 'banrep-trm',
  requestedDate: day,
  effectiveDate,
  effectiveUntil,
  fetchedAt: new Date(),
  publishedAt,
 };
}


/**
 * Fetch every TRM validity that overlaps a window, one row per validity.
 *
 * Why a range and not a day at a time. The TRM is not a quote on a trading day:
 * it is a rate with a validity, and every calendar day of the window falls
 * inside exactly one of them. A store holding only some of those validities is
 * not a partially warm cache — it is wrong. The as-of lookup answers with the
 * most recent row on or before the day, so a day whose own validity was never
 * fetched resolves onto an older one that the provider had already superseded.
 * Measured on 2026-08-20 with only 08-15 stored: 3128.65 served where the rate
 * in force was 3053.48.
 *
 * One call returns the whole month, so the window is either complete or the arm
 * fails and the cascade continues. There is no in-between state to reason about.
 *
 * A window the dataset does not cover comes back as an empty array rather than
 * an error: nothing published is a fact about the window, not a transport
 * failure. Only a broken response or an unreachable host throws.
 *
 * @param {string|Date} from - First day of the window
 * @param {string|Date} to - Last day of the window
 * @returns {Promise<Array<{rateDate: string, rate: string, source: string}>>}
 *   Each row under the day its validity opens on, oldest first.
 * @throws {Error} - On an invalid window, network failure or malformed payload
 */
export async function fetchTrmRange(from, to) {
 const firstDay = toColombianDay(from);
 const lastDay = toColombianDay(to);

 if (!firstDay || !lastDay) {
  throw new Error(`Invalid TRM range requested: ${from}..${to}`);
 }

 const headers = {};

 if (process.env.DATOS_GOV_APP_TOKEN) {
  headers['X-App-Token'] = process.env.DATOS_GOV_APP_TOKEN;
 }

 const response = await axios.get(TRM_DATASET_URL, {
  timeout: FX_TIMEOUT_MS,
  headers,
  params: {
   // Overlap, not containment: the validity in force on the first day of the
   // window usually opened before it, and dropping it would leave that day
   // resolving onto whatever older row the store happens to hold.
   //
   // Both days are validated above, so neither can carry a SoQL fragment.
   '$where':
    `vigenciahasta >= '${firstDay}T00:00:00.000'` +
    ` AND vigenciadesde <= '${lastDay}T23:59:59.999'`,
   '$order': 'vigenciadesde ASC',
   '$limit': TRM_RANGE_ROW_LIMIT,
  },
 });

 if (!Array.isArray(response.data)) {
  throw new Error(`Banrep returned a malformed payload for ${firstDay}..${lastDay}`);
 }

 // A truncated page would look exactly like a short month and silently leave
 // the tail of the window uncovered, which is the failure this function exists
 // to prevent. Say so rather than store an incomplete window.
 if (response.data.length === TRM_RANGE_ROW_LIMIT) {
  throw new Error(
   `Banrep range ${firstDay}..${lastDay} hit the ${TRM_RANGE_ROW_LIMIT}-row limit`,
  );
 }

 const series = [];

 for (const row of response.data) {
  const rate = Number(row.valor);
  const effectiveDate = String(row.vigenciadesde || '').slice(0, 10);

  if (!Number.isFinite(rate) || rate <= 0 || effectiveDate.length !== 10) {
   console.warn(`[FX] Banrep skipping malformed row: ${JSON.stringify(row)}`);
   continue;
  }

  // The provider's own string, not the parsed number: the parse validates, it
  // does not decide the precision that reaches the column.
  series.push({ rateDate: effectiveDate, rate: String(row.valor), source: 'banrep-trm' });
 }

 console.log(
  `[FX] Banrep TRM usd -> cop for ${firstDay}..${lastDay}: ${series.length} validities`,
 );

 return series;
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
