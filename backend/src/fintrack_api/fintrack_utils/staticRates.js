// backend/src/fintrack_api/fintrack_utils/staticRates.js

// Static fallback exchange rates (base = USD)
// Used only when all external API providers fail.

export const staticRates = {
  usd: 1,
  eur: 0.9215,
  cop: 4000,
  ves: 550,
  mxn: 16.85,
};

/**
 * Get static rate from any currency to USD (or vice versa).
 * For non-USD pairs, conversion is done via USD as bridge.
 * @param {string} fromCode - Origin currency code (lowercase)
 * @param {string} toCode - Target currency code (lowercase)
 * @returns {number} Exchange rate (from → to)
 */
export function getStaticRate(fromCode, toCode='usd') {
  const from = fromCode.toLowerCase();
  const to = toCode.toLowerCase();

  if (from === to) return 1.0;

  // Direct USD rate
  if (from === 'usd' && staticRates[to]) {
    return staticRates[to];
  }
  if (to === 'usd' && staticRates[from]) {
    return 1 / staticRates[from];
  }

  // Cross rate via USD: from → usd → to
  const rateFromToUsd = staticRates[from];
  const rateUsdToTarget = staticRates[to];
  if (rateFromToUsd && rateUsdToTarget) {
    return (1 / rateFromToUsd) * rateUsdToTarget;
  }

  // Fallback: if rate missing (should not happen with defined currencies)
  console.error(`No static rate available for ${from} -> ${to}`);
  return 1.0;
}