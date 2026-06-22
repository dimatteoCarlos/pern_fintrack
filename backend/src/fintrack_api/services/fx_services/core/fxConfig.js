// backend/src/fintrack_api/services/fx_services/core/fxConfig.js

// =====================
// ⚙️ FX CONFIGURATION:
// =====================
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';
// 🌐 FX Default Values
export const DEFAULT_EXCHANGE_RATE = 1.0;
export const DEFAULT_EXCHANGE_RATE_SOURCE = 'identity';
export const DEFAULT_ORIGINAL_AMOUNT = 0;

//Cache TTL (from environment or defaults)
const FX_CACHE_TTL_HOURS = parseInt(process.env.FX_CACHE_TTL_HOURS || '22', 10);

const FX_CACHE_TTL_MS = FX_CACHE_TTL_HOURS * 60 * 60 * 1000;

const FX_GITHUB_TTL_HOURS = parseFloat(process.env.FX_GITHUB_TTL_HOURS || '0.5');

const FX_GITHUB_TTL_MS = FX_GITHUB_TTL_HOURS * 60 * 60 * 1000;

const FX_STATIC_FALLBACK_TTL_HOURS = parseFloat(
 process.env.FX_STATIC_FALLBACK_TTL_HOURS || '0.25', 10,);

const FX_STATIC_FALLBACK_TTL_MS = FX_STATIC_FALLBACK_TTL_HOURS * 60 * 60 * 1000;

export {
 ACCOUNTING_CURRENCY_CODE,   
 FX_CACHE_TTL_HOURS,
 FX_CACHE_TTL_MS,
 FX_GITHUB_TTL_HOURS,
 FX_GITHUB_TTL_MS,
 FX_STATIC_FALLBACK_TTL_HOURS,
 FX_STATIC_FALLBACK_TTL_MS,
};

// List of supported currencies (can be extended later)
export const SUPPORTED_CURRENCIES = ['usd', 'eur', 'cop', 'ves', 'mxn'];