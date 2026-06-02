// backend/src/fintrack_api/services/exchangeRate_providers/bcvApiProvider.js
// 💰 PROVIDER: BCV API ((Venezuela - official USD/VES exchange rate))

import axios from 'axios';

const FX_BCV_API_URL = 'https://bcv-api.rafnixg.dev/rates/';

const FX_TIMEOUT_MS = process.env.FX_REQUEST_TIMEOUT_MS || 2000;

/**
 * Fetch USD/VES exchange rate from BCV API.
 * @param {string} targetDate - Optional date in YYYY-MM-DD format.
 * @returns {Promise<{rate: number, source: string, fetchedAt: Date}>}
 */

export async function fetchFromBcvApi(targetDate = null) {
// 1. Build URL w/wo date
 let url = FX_BCV_API_URL;
 if (targetDate) {
  url += `${targetDate}`;
 }

//2. Request to API
  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });

//3. Data Validation and data extraction
  if (!response.data || !response.data.dollar) {
    throw new Error('BCV API invalid response');
  }

  const rate = response.data.dollar;

  if (
    !rate ||
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(`BCV API returned invalid rate: ${rate}`);
  }

//4. Use provider's last updated time if available, otherwise use current time
  const providerUpdated = response.data?.date
  ? new Date(response.data.date)
  : new Date();

// 5. Create date object for fetchedAt
  const fetchedAt = providerUpdated;

  return {
    rate: Number(rate),
    source: 'bcv-api',
    fetchedAt,
  };
}
