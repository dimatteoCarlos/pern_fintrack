// backend/src/fintrack_api/services/exchangeRate_providers/exchangeRateApiProvider.js

// 💰 PROVIDER: ExchangeRate-API (Priority 1)
import axios from 'axios';

// 1. Read environment variables (constants for API configuration)
const FX_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const FX_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

const FX_BASE_URL = 'https://v6.exchangerate-api.com/v6';

/**
 * Fetch exchange rate from ExchangeRate-API
 * @param {string} fromCurrencyCode - Base currency code (lowercase)
 * @param {string|null} toCurrencyCode  - Target currency code (lowercase), or null to get all rates
 * @returns {Promise<{rate?: number, rates?: object, source: string, fetchedAt: Date}>}
 */

export async function fetchFromExchangeRateAPI(fromCurrencyCode, toCurrencyCode ) {

 // 2. Validate input parameters and API key configuration
  if (!FX_API_KEY) {
  throw new Error(
    'Missing EXCHANGE_RATE_API_KEY'
  );
}
// 3. Validate input parameters
  if (!fromCurrencyCode ) {
    throw new Error(
      'Base currency code is required'
    );
  }
  if (typeof fromCurrencyCode !== 'string') {
  throw new Error('Base currency code must be a string');
}
// toCurrencyCode  is optional (null means get all rates)
if (toCurrencyCode  !== null && typeof toCurrencyCode  !== 'string') {
  throw new Error('Target currency code must be a string or null');
}

  const base = fromCurrencyCode.toUpperCase();
  // const target = toCurrencyCode .toUpperCase();
  const url = `${FX_BASE_URL}/${FX_API_KEY}/latest/${base}`;

  console.log("🚀 ~ fetchFromExchangeRateAPI ~ url:", url)
  //-----------

 // 4. Perform request
  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });

  // console.log("🚀 ~ fetchFromExchangeRateAPI ~ response:", response)
  //-----------
  
 // 5. Validate response structure
  if (!response.data || response.data.result !== 'success') {
    throw new Error('ExchangeRate-API returned invalid response');
  }
//---------------------
// 6. If toCurrencyCode is not provided, return the full rates object (snapshot)
if (!toCurrencyCode ) {
//---------------
console.log('response.data.conversion_rates', response.data.conversion_rates)
//---------------
return {
   rates: response.data.conversion_rates,
   source: 'exchange-rate-api',
   fetchedAt: response.data.time_last_update_unix
     ? new Date(response.data.time_last_update_unix * 1000)
     : new Date(),
    };
  }
//---------------------
 // 7. For a single target currency
  const target = toCurrencyCode.toUpperCase();
  const rate = response.data.conversion_rates[target];

// 8. Validate rate value
  if (
    !rate ||
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(`Invalid rate for ${target} from ExchangeRate-API`);
  }

// 9. Log for debugging (no sensitive data)
  console.log(`[FX] ExchangeRateAPI ${base} -> ${target}`);
//--------------- 
// 10. Return normalized response
  return {
    rate: Number(rate),
    source: 'exchange-rate-api',
// Extract provider's last updated timestamp (if available)
    fetchedAt: response.data.time_last_update_unix
      ? new Date(response.data.time_last_update_unix * 1000)
      : new Date(),
  };
};