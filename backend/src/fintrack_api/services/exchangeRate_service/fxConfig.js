// backend/src/fintrack_api/services/exchangeRate_service/fxConfig.js

// ⚙️ FX CONFIGURATION: Shared constants for cache TTL

const FX_CACHE_TTL_HOURS = parseInt(process.env.FX_CACHE_TTL_HOURS || '22', 10);

const FX_CACHE_TTL_MS = FX_CACHE_TTL_HOURS * 60 * 60 * 1000;

const FX_STATIC_FALLBACK_TTL_HOURS = parseInt(process.env.FX_STATIC_FALLBACK_TTL_HOURS || '2', 10);
const FX_STATIC_FALLBACK_TTL_MS = FX_STATIC_FALLBACK_TTL_HOURS * 60 * 60 * 1000;

export {
  FX_CACHE_TTL_HOURS,
  FX_CACHE_TTL_MS,
  FX_STATIC_FALLBACK_TTL_HOURS,
  FX_STATIC_FALLBACK_TTL_MS,
};