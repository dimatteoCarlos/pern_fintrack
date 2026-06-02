// backend/src/fintrack_api/services/providers/githubFallbackProvider.js
// 💰 PROVIDER: GitHub fallback API (Priority 3 - free, no API key)

import axios from 'axios';

const FX_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';
const FX_TIMEOUT_MS = process.env.FX_REQUEST_TIMEOUT_MS || 2000;

/**
 * Fetch exchange rate from GitHub fallback API (fawazahmed0/currency-api)
 * @param {string} baseCode - Base currency code (lowercase)
 * @param {string} targetCode - Target currency code (lowercase)
 * @returns {Promise<{rate: number, source: string, fetchedAt: Date}>}
 */

export async function fetchFromGitHubFallback(baseCode, targetCode) {
  const baseLower = baseCode.toLowerCase();
  const targetLower = targetCode.toLowerCase();
  const url = `${FX_BASE_URL}/${baseLower}.json`;

  // ========================
  // 1. Request to API
  // ========================
  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });

  // ========================
  // 2. Validate response structure
  // ========================
  if (!response.data || !response.data[baseLower]) {
    throw new Error('GitHub API returned invalid response');
  }

  const rate = response.data[baseLower][targetLower];

  // ========================
  // 3. Validate rate value
  // ========================
  if (
    !rate ||
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(`Invalid rate for ${targetCode} from GitHub API`);
  }

  // ========================
  //  4. Extract date (if present)
  // ========================
  // Use provider's last updated time if available, otherwise use current time
  const providerUpdated = response.data?.date;

  const fetchedAt = providerUpdated ? new Date(providerUpdated) : new Date();

  // =============================
  // 5. Return normalized response
  // =============================
  return {
    rate: Number(rate),
    source: 'github-fallback',
    fetchedAt,
  };
}
