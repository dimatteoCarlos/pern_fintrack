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

const FX_BASE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';
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