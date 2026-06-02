// backend/src/fintrack_api/services/exchangeRate_providers/freeCurrencyApiProvider.js
// 💰 PROVIDER: FreeCurrencyAPI (Priority 2)

import axios from 'axios';

const FX_API_KEY = process.env.FREE_CURRENCY_API_KEY;
const FX_BASE_URL = 'https://api.freecurrencyapi.com/v1/latest';
const FX_TIMEOUT_MS = process.env.FX_REQUEST_TIMEOUT_MS || 2000;

/**
 * Fetch exchange rate from FreeCurrencyAPI
 * @param {string} baseCode - Base currency code (lowercase)
 * @param {string} targetCode - Target currency code (lowercase)
 * @returns {Promise<{rate: number, source: string, fetchedAt: Date}>}
 */
export async function fetchFromFreeCurrencyAPI(baseCode, targetCode) {
  const base = baseCode.toUpperCase();
  const target = targetCode.toUpperCase();
  const url = `${FX_BASE_URL}?apikey=${FX_API_KEY}&base_currency=${base}`;

  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });

  if (!response.data || !response.data.data) {
    throw new Error('FreeCurrencyAPI returned invalid response');
  }

  const rate = response.data.data[target];

  if (!rate || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid rate for ${target} from FreeCurrencyAPI`);
  }
// Use provider's last updated time if available, otherwise use current time
  const providerUpdated = response.data.meta?.last_updated_at;

  return {
    rate: Number(rate),
    source: 'freecurrencyapi',
    fetchedAt:  providerUpdated
     ? new Date(providerUpdated)
     : new Date()
  };
}