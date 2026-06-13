// backend/src/fintrack_api/services/exchangeRate_providers/fallbackRates.js
// 💰 FALLBACK RATES: Static exchange rates + exponential projection for VES

// ============================================
// 1. Fixed rates for stable currencies (base = USD)
// ============================================
export const fixedRates = {
  usd: 1,
  eur: 0.9215,
  cop: 3600,
  mxn: 16.85,
  ves: 615, // Projected static rate for VES (2026-06-30) - will be overridden by projection
};

// ============================================
// 2. Exponential projection parameters for VES
// Derived from historical BCV data (Jan–May 2026)
// ============================================
const VES_PROJECTION = {
  a: 556.9345935995726, // rate on base date (2026-01-01)
  b:0.0035256890195482517, // daily growth factor
  baseDate: new Date('2026-06-02'),
};

//========================================
// 3. Helper: Project VES rate for a given date
// =======================================
/**
 * Calculate projected VES/USD rate for a specific date.
 * @param {Date} date - Date for projection (defaults to today)
 * @returns {number} Projected rate (VES per 1 USD)
 */
function projectVesRate(date = new Date()) {
  const days = Math.floor(
    (date - VES_PROJECTION.baseDate) / (1000 * 60 * 60 * 24),
  );
  const rate = VES_PROJECTION.a * Math.exp(VES_PROJECTION.b * days);
  // Warn if projection uses data older than 3 months
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  if (date > threeMonthsAgo && VES_PROJECTION.baseDate < threeMonthsAgo) {
    console.warn(
      '[FX] VES projection using parameters older than 3 months. Update recommended.',
    );
  }
  return rate;
}

// =========================================
// 4. Main function: get fallback rate (with VES projection)
// =========================================
/**
 * Get fallback exchange rate from any currency to USD (or vice versa).
 * For VES, uses dynamic exponential projection; for others, fixed values.
 * @param {string} fromCode - Origin currency code (lowercase)
 * @param {string} toCode - Target currency code (lowercase, default 'usd')
 * @returns {number}
 */
export function getFallbackRate(fromCode, toCode = 'usd') {
  const from = fromCode.toLowerCase();
  const to = toCode.toLowerCase();

  if (from === to) return 1.0;

  // Helper: get rate from USD to target (USD is base)
  function getRateFromUsd(target) {
    if (target === 'usd') return 1;
    if (target === 'ves') return projectVesRate();
    const fixed = fixedRates[target];
    if (fixed === undefined) throw new Error(`No fallback rate for ${target}`);
    return fixed;
  }

  if (from === 'usd') {
    return getRateFromUsd(to);
  }
  if (to === 'usd') {
    const rate = getRateFromUsd(from);
    return 1 / rate;
  }
  // Cross rate via USD: from → usd → to
  const rateFromToUsd = getRateFromUsd(from);
  const rateUsdToTarget = getRateFromUsd(to);
  return (1 / rateFromToUsd) * rateUsdToTarget;
}
