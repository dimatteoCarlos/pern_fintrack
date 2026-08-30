// backend/src/fintrack_api/services/fx_services/fxProviders/githubFallbackProvider.js

// 💰 GITHUB FALLBACK PROVIDER (Priority 3)
// ================================

/**
 * GitHub fallback provider (fawazahmed0/currency-api).
 * Free, no API key required. Provides all currencies for a base.
 * 
 * Primary function: fetchFromGitHubFallback(baseCode, targetCode)
 * - If targetCode is null, returns all rates.
 * - If targetCode is specific, returns only that rate.
 * 
 * Standardized functions:
 * - fetchAllRates(baseCurrency) → all rates in standard format.
 * - fetchRate(baseCurrency, targetCurrency) → specific rate.
 */

import axios from 'axios';

// The CDN serves the current day and any past day from the same path; the version
// segment is what selects between them, '@latest' or '@YYYY-MM-DD'. It is split out
// so the historical arm below can name a date without rebuilding the whole URL.
const FX_CDN_ROOT = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api';
const FX_BASE_URL = `${FX_CDN_ROOT}@latest/v1/currencies`;
const FX_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

// ─── PRIMARY FUNCTION (used by currencyAmountConversion.js) ──────

/**
 * Fetch exchange rates from GitHub fallback API.
 * @param {string} baseCode - Base currency code (lowercase)
 * @param {string|null} targetCode - Target currency code, or null for all rates
 * @returns {Promise<Object>} - { rate, source, fetchedAt } or { rates, source, fetchedAt }
 * @throws {Error} - If network or API error occurs
 */
export async function fetchFromGitHubFallback(baseCode, targetCode) {
  // 1. Validate input
  if (!baseCode) {
    throw new Error('Base currency code is required');
  }
  if (typeof baseCode !== 'string') {
    throw new Error('Base currency code must be a string');
  }
  // targetCode is optional (null means get all rates)
  if (targetCode !== null && typeof targetCode !== 'string') {
    throw new Error('Target currency code must be a string or null');
  }

  const baseLower = baseCode.toLowerCase();
  const url = `${FX_BASE_URL}/${baseLower}.json`;

  // 2. API request
  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });

  // 3. Validate response structure
  if (!response.data || !response.data[baseLower]) {
    throw new Error('GitHub API returned invalid response');
  }

  // 4. Extract provider's update date (if available)
  const providerUpdated = response.data?.date;
  const fetchedAt = providerUpdated ? new Date(providerUpdated) : new Date();

  // 5. If targetCode is null, return all rates (massive snapshot)
  if (!targetCode) {
    const rates = response.data[baseLower];
    return {
      rates,
      source: 'github-fallback',
      fetchedAt,
    };
  }

  // 6. Single rate
  const targetLower = targetCode.toLowerCase();
  const rate = response.data[baseLower][targetLower];

  // 7. Validate rate value
  if (!rate || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid rate for ${targetCode} from GitHub API`);
  }

  // 8. Log and return
  console.log(`[FX] GitHub fallback ${baseLower} -> ${targetLower}: ${rate}`);
  return {
    rate: Number(rate),
    source: 'github-fallback',
    fetchedAt,
  };
}

// ─── STANDARDIZED FUNCTIONS (for FX global state) ─────────────────

/**
 * Fetch all exchange rates for a base currency (massive snapshot).
 * 
 * @param {string} baseCurrency - Base currency code (e.g., 'usd')
 * @param {Object} options - Unused (kept for interface consistency)
 * @returns {Promise<Object|null>} - { rates: { target: { rate, source, fetchedAt } }, source, fetchedAt } or null
 */
export async function fetchAllRates(baseCurrency, options = {}) {
  try {
    // Call primary function with null target to get all rates
    const result = await fetchFromGitHubFallback(baseCurrency, null);

    if (!result || !result.rates || typeof result.rates !== 'object') {
      return null;
    }

    // Convert to standard format: rates.{target}.{rate, source, fetchedAt}
    const rates = {};
    for (const [target, rate] of Object.entries(result.rates)) {
      if (typeof rate === 'number' && rate > 0) {
        rates[target.toLowerCase()] = {
          rate,
          source: result.source || 'github-fallback',
          fetchedAt: result.fetchedAt || new Date(),
        };
      }
    }

    return {
      rates,
      source: 'github-fallback',
      fetchedAt: result.fetchedAt || new Date(),
    };
  } catch (error) {
    console.warn('⚠️ GitHub fallback fetchAllRates failed:', error.message);
    return null;
  }
}

/**
 * Fetch a specific exchange rate for a currency pair.
 * 
 * @param {string} baseCurrency - Base currency code
 * @param {string} targetCurrency - Target currency code
 * @param {Object} options - Unused (kept for interface consistency)
 * @returns {Promise<Object|null>} - { rate, source, fetchedAt } or null
 */
export async function fetchRate(baseCurrency, targetCurrency, options = {}) {
  try {
    const result = await fetchFromGitHubFallback(baseCurrency, targetCurrency);

    if (result && typeof result.rate === 'number' && result.rate > 0) {
      return {
        rate: result.rate,
        source: result.source || 'github-fallback',
        fetchedAt: result.fetchedAt || new Date(),
      };
    }
    return null;
  } catch (error) {
    console.warn(`⚠️ GitHub fallback fetchRate failed for ${targetCurrency}:`, error.message);
    return null;
  }
}

// Historical arm — the cascade's last resort

/**
 * Validate a calendar day, 'YYYY-MM-DD'.
 *
 * A day is a string here and never a Date: a Date is an instant, and reading one
 * in UTC at an entry point silently shifts the day for a user west of Greenwich.
 * The caller composes the instant; this file only ever names a calendar day.
 *
 * The resolver of the cascade will own this check once it exists, and both arms
 * can drop their local copy then.
 *
 * @param {string} value - The day to validate
 * @returns {boolean}
 */
function isCalendarDay(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

 // Rejects a well-formed but impossible day such as '2026-02-31'.
 const parsed = new Date(`${value}T00:00:00.000Z`);

 return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Fetch every rate this CDN publishes for a base currency on a past day.
 *
 * **The date must be an effective date already resolved by a business-day source,
 * never the day the user asked for.** This CDN answers for a Saturday and a Sunday
 * with figures that move against the Friday and against each other on days nothing
 * traded, and the Monday snaps back to the Friday to the fourth decimal — measured
 * across 2026-05-14..18. Asked for a closed day it fabricates; asked for a day the
 * market was open it reports. Resolving which day that is belongs to the Banca
 * d'Italia arm, and this function inherits the answer.
 *
 * It is the last arm of the cascade, so it throws rather than returning null like
 * fetchAllRates and fetchRate above: the resolver needs to say which arm failed and
 * why, and a null erases that. One call carries every currency, so the resolver asks
 * once for a day and serves each currency from the same payload.
 *
 * @param {string} baseCurrency - Base currency code, e.g. 'usd' (case-insensitive)
 * @param {string} date - The effective day, 'YYYY-MM-DD'
 * @param {Object} [options] - Time budget
 * @param {number} [options.deadlineAt] - Absolute epoch ms the whole cascade may not pass
 * @param {number} [options.timeoutMs] - Per-call timeout, defaults to FX_REQUEST_TIMEOUT_MS
 * @returns {Promise<{rates: Object, source: string, requestedDate: string, effectiveDate: string, fetchedAt: Date}>}
 * @throws {Error} - On an invalid base or day, an exceeded deadline, network failure or a malformed payload
 */
export async function fetchRatesForDate(baseCurrency, date, options = {}) {
 const baseLower = typeof baseCurrency === 'string' ? baseCurrency.toLowerCase() : '';

 if (!baseLower) {
  throw new Error('GitHub fallback historical: base currency code is required');
 }

 if (!isCalendarDay(date)) {
  throw new Error(`GitHub fallback historical: invalid day requested: ${date}`);
 }

 const callTimeout = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : FX_TIMEOUT_MS;
 let timeoutMs = callTimeout;

 // The remaining cascade budget caps this call, so the last arm cannot spend a full
 // timeout of its own after the arms before it have already used the ceiling.
 if (Number.isFinite(options.deadlineAt)) {
  const remainingMs = options.deadlineAt - Date.now();

  if (remainingMs <= 0) {
   throw new Error(`GitHub fallback historical aborted for ${baseLower} on ${date}: cascade deadline reached`);
  }

  timeoutMs = Math.min(callTimeout, remainingMs);
 }

 const url = `${FX_CDN_ROOT}@${date}/v1/currencies/${baseLower}.json`;

 const response = await axios.get(url, { timeout: timeoutMs });

 if (!response.data || !response.data[baseLower]) {
  throw new Error(`GitHub fallback historical returned no ${baseLower} block for ${date}`);
 }

 // The payload names the day it answered for. A mismatch means the CDN served a
 // different snapshot than the one asked for, which must not pass as this day's rate.
 const answeredDate = typeof response.data.date === 'string' ? response.data.date.slice(0, 10) : null;

 if (answeredDate && answeredDate !== date) {
  throw new Error(`GitHub fallback historical asked ${date} for ${baseLower} and was answered ${answeredDate}`);
 }

 const rates = {};
 const fetchedAt = new Date();

 for (const [target, rate] of Object.entries(response.data[baseLower])) {
  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
   rates[target.toLowerCase()] = {
    rate,
    source: 'github-fallback',
    effectiveDate: date,
    fetchedAt,
   };
  }
 }

 if (Object.keys(rates).length === 0) {
  throw new Error(`GitHub fallback historical returned no usable ${baseLower} rate for ${date}`);
 }

 console.log(`[FX] GitHub fallback historical ${baseLower} for ${date}: ${Object.keys(rates).length} rates`);

 return {
  rates,
  source: 'github-fallback',
  requestedDate: date,
  effectiveDate: date,
  fetchedAt,
 };
}
