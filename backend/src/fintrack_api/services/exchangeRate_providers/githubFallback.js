// backend/src/fintrack_api/services/exchangeRate_providers/githubFallbackProvider.js
// 💰 PROVIDER: GitHub fallback API (Priority 3 - free, no API key)

import axios from 'axios';

const FX_BASE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';
const FX_TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 2000);

/**
 * Fetch exchange rate from GitHub fallback API (fawazahmed0/currency-api)
 * @param {string} baseCode - Base currency code (lowercase)
 * @param {string} targetCode - Target currency code (lowercase)
 * @returns {Promise<{rate: number, source: string, fetchedAt: Date}>}
 */
export async function fetchFromGitHubFallback(baseCode, targetCode) {
  // ===========================
  // 1. Input validation
  // ===========================
  if (!baseCode || !targetCode) {
    throw new Error('Currency codes are required');
  }
  if (typeof baseCode !== 'string' || typeof targetCode !== 'string') {
    throw new Error('Currency codes must be strings');
  }

  const baseLower = baseCode.toLowerCase();
  const targetLower = targetCode.toLowerCase();
  const url = `${FX_BASE_URL}/${baseLower}.json`;

  // ===========================
  // 2. API request
  // ===========================
  const response = await axios.get(url, { timeout: FX_TIMEOUT_MS });

  // console.log("🚀 ~ fetchFromGitHubFallback ~ response:", response)

  // ===========================
  // 3. Validate response structure
  // ===========================
  if (!response.data || !response.data[baseLower]) {
    throw new Error('GitHub API returned invalid response');
  }

  const rate = response.data[baseLower][targetLower];

  // ===========================
  // 4. Validate rate value
  // ===========================
  if (!rate || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid rate for ${targetCode} from GitHub API`);
  }

  // ===========================
  // 5. Extract provider's update date (if available)
  // ===========================
  const providerUpdated = response.data?.date;
  const fetchedAt = providerUpdated ? new Date(providerUpdated) : new Date();

  // ===========================
  // 6. Log (no sensitive data)
  // ===========================
  console.log(`[FX] GitHub fallback ${baseLower} -> ${targetLower}: ${rate}`);

  // ===========================
  // 7. Return normalized response
  // ===========================
  return {
    rate: Number(rate),
    source: 'github-fallback',
    fetchedAt,
  };
}