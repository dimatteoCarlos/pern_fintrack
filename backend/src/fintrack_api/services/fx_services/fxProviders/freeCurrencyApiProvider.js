// backend/src/fintrack_api/services/fx_services/fxProviders/freeCurrencyApiProvider.js

// 💰 PROVIDER: FreeCurrencyAPI (Priority 2)
import axios from 'axios';

/**
 * Primary function used by currencyAmountConversion.js and fxProviderOrchestrator.js.
 * Fetches exchange rates from FreeCurrencyAPI.
 * 
 * @param {string} baseCode - Base currency code (e.g., 'usd')
 * @param {string|null} targetCode - Target currency code, or null for all rates
 * @returns {Promise<Object>} - { rate, source, fetchedAt } or { rates, source, fetchedAt }
 * @throws {Error} - If network or API error occurs
 */

//Start setting url
const FX_BASE_URL = 'https://api.freecurrencyapi.com/v1/latest';

export async function fetchFromFreeCurrencyAPI(baseCode, targetCode) {

// 1. Read environment variables inside function (avoids ESM load order issues) and s
const FX_API_KEY = process.env.FREE_CURRENCY_API_KEY;
const FX_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

// 2. Validate API key
  if (!FX_API_KEY) {
    throw new Error('Missing FREE_CURRENCY_API_KEY');
  }

// 3. Validate input parameters
  if (!baseCode ) {
    throw new Error('Base currency code is required');
  }

  if (typeof baseCode !== 'string' ) {
    throw new Error('Base currency code must be strings');
   }

  // targetCode  is optional (null means get all rates)
  if (targetCode  !== null && typeof targetCode  !== 'string') {
    throw new Error('Target currency code must be a string or null');
  }

  const base = baseCode.toUpperCase();
  const url = `${FX_BASE_URL}?apikey=${FX_API_KEY}&base_currency=${base}`;

// 4. Perform request
  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });

// 5. Validate response structure
  if (!response.data || !response.data.data) {
    throw new Error('FreeCurrencyAPI returned invalid response');
  }
  console.log('data:', response.data);

// 6. Extract provider's last updated timestamp (if available)
const providerUpdated = response.data.meta?.last_updated_at;
const fetchedAt = providerUpdated ? new Date(providerUpdated) : new Date();

// 7. If targetCode is null, return the full rates object
  if (!targetCode ) {
  // Normalize keys to lowercase
   const normalizedRates = {};
    for (const [key, value] of Object.entries(response.data.data)) {
     normalizedRates[key.toLowerCase()] = value;
    }
  //---------------
   return {
    rates: normalizedRates,
    source: 'freecurrencyapi',
    fetchedAt,
    };
   }
//---------------------
// 8. For a single target currency
 const target = targetCode.toUpperCase();
 const rate = response.data.data[target];

// 9. Validate rate value
  if (!rate || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid rate for ${target} from FreeCurrencyAPI`);
  }
 
// 10. Log for debugging (no sensitive data)
  console.log(`[FX] FreeCurrencyAPI ${base} -> ${target}: ${rate}`);

// 11. Return normalized response
  return {
    rate: Number(rate),
    source: 'freecurrencyapi',
    fetchedAt,
  };
}

// ================================
// STANDARDIZED FUNCTIONS (for FX global state)
// ================================

/**
 * Fetch all exchange rates for a base currency (massive snapshot).
 * 
 * @param {string} baseCurrency - Base currency code (e.g., 'usd')
 * @returns {Promise<Object|null>} - { rates: { target: { rate, source, fetchedAt } }, source, fetchedAt } or null
 */
export async function fetchAllRates(baseCurrency) {
  try {
    const result = await fetchFromFreeCurrencyAPI(baseCurrency, null);

    if (!result || !result.rates || typeof result.rates !== 'object') {
      return null;
    }

    const rates = {};
    for (const [target, rate] of Object.entries(result.rates)) {
      if (typeof rate === 'number' && rate > 0) {
        rates[target.toLowerCase()] = {
          rate,
          source: result.source || 'freecurrencyapi',
          fetchedAt: result.fetchedAt || new Date(),
        };
      }
    }

    return {
      rates,
      source: 'freecurrencyapi',
      fetchedAt: result.fetchedAt || new Date(),
    };
  } catch (error) {
    console.warn('⚠️ FreeCurrencyAPI fetchAllRates failed:', error.message);
    return null;
  }
}
//============================
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
    const result = await fetchFromFreeCurrencyAPI(baseCurrency, targetCurrency);

    if (result && typeof result.rate === 'number' && result.rate > 0) {
      return {
        rate: result.rate,
        source: result.source || 'freecurrencyapi',
        fetchedAt: result.fetchedAt || new Date(),
      };
    }
    return null;
  } catch (error) {
    console.warn(`⚠️ FreeCurrencyAPI fetchRate failed for ${targetCurrency}:`, error.message);
    return null;
  }
}
