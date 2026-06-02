// backend/src/fintrack_api/services/exchangeRate_providers/freeCurrencyApiProvider.js

// 💰 PROVIDER: FreeCurrencyAPI (Priority 2)
import axios from 'axios';

const FX_BASE_URL = 'https://api.freecurrencyapi.com/v1/latest';

// 1. Read environment variables inside function (avoids ESM load order issues)
  const FX_API_KEY = process.env.FREE_CURRENCY_API_KEY;
  const FX_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

/**
 * Fetch exchange rate from FreeCurrencyAPI
 * @param {string} baseCode - Base currency code (lowercase)
 * @param {string} targetCode - Target currency code (lowercase)
 * @returns {Promise<{rate: number, source: string, fetchedAt: Date}>}
 */

export async function fetchFromFreeCurrencyAPI(baseCode, targetCode) {

// 2. Validate configuration
  if (!FX_API_KEY) {
    throw new Error('Missing FREE_CURRENCY_API_KEY');
  }

// 3. Validate input parameters
  if (!baseCode || !targetCode) {
    throw new Error('Currency codes are required');
  }
  if (typeof baseCode !== 'string' || typeof targetCode !== 'string') {
    throw new Error('Currency codes must be strings');
  }

  const base = baseCode.toUpperCase();
  const target = targetCode.toUpperCase();
  const url = `${FX_BASE_URL}?apikey=${FX_API_KEY}&base_currency=${base}`;

// 4. Perform request
  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });

// 5. Validate response structure
  if (!response.data || !response.data.data) {
    throw new Error('FreeCurrencyAPI returned invalid response');
  }

console.log('data:', response.data)

  const rate = response.data.data[target];

// 6. Validate rate value
  if (!rate || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid rate for ${target} from FreeCurrencyAPI`);
  }

// 7. Extract provider's last updated timestamp (if available)
  const providerUpdated = response.data.meta?.last_updated_at;
  const fetchedAt = providerUpdated ? new Date(providerUpdated) : new Date();

// 8. Log for debugging (no sensitive data)
  console.log(`[FX] FreeCurrencyAPI ${base} -> ${target}: ${rate}`);

// 9. Return normalized response
  return {
    rate: Number(rate),
    source: 'freecurrencyapi',
    fetchedAt,
  };
}