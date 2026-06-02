// backend/src/fintrack_api/services/exchangeRate_providers/exchangeRateApiProvider.js

// 💰 PROVIDER: ExchangeRate-API (Priority 1)
import axios from 'axios';

// 1. Read environment variables (constants for API configuration)
const FX_BASE_URL = 'https://v6.exchangerate-api.com/v6';

const FX_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

const FX_TIMEOUT_MS = Number(
  process.env.FX_REQUEST_TIMEOUT_MS || 4000
)*2;

/**
 * Fetch exchange rate from ExchangeRate-API
 * @param {string} baseCode - Base currency code (lowercase)
 * @param {string} targetCode - Target currency code (lowercase)
 * @returns {Promise<{rate: number, source: string, fetchedAt: Date}>}
 */

export async function fetchFromExchangeRateAPI(baseCode, targetCode) {
 // 2. Validate input parameters and API key configuration
  if (!FX_API_KEY) {
  throw new Error(
    'Missing EXCHANGE_RATE_API_KEY'
  );
}
// 3. Validate input parameters
  if (!baseCode || !targetCode) {
    throw new Error(
      'Currency codes are required'
    );
  }
  if (typeof baseCode !== 'string' ||
  typeof targetCode !== 'string'
) {
  throw new Error(
    'Currency codes must be strings'
  );
}
  const base = baseCode.toUpperCase();
  const target = targetCode.toUpperCase();
  const url = `${FX_BASE_URL}/${FX_API_KEY}/latest/${base}`;

 // 4. Perform request
  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });
  
 // 5. Validate response structure
  if (!response.data || response.data.result !== 'success') {
    throw new Error('ExchangeRate-API returned invalid response');
  }

  const rate = response.data.conversion_rates[target];

// 6. Validate rate value
  if (
    !rate ||
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(`Invalid rate for ${target} from ExchangeRate-API`);
  }

// 8. Log for debugging (no sensitive data)
  console.log(
  `[FX] ExchangeRateAPI ${base} -> ${target}`
);

// 9. Return normalized response
  return {
    rate: Number(rate),
    source: 'exchange-rate-api',
// Extract provider's last updated timestamp (if available)
    fetchedAt: response.data.time_last_update_unix
      ? new Date(response.data.time_last_update_unix * 1000)
      : new Date(),
  };
};