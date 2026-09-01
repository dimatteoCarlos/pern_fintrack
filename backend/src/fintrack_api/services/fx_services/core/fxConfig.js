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

// The currency an official national source publishes for. Its historical arm
// asks for a whole range and stores one row per validity, so it is also what
// establishes the shared business-day calendar every other currency reads.
export const OFFICIAL_TRM_CURRENCY = 'cop';

// The currency the Banco Central de Venezuela publishes for, and the name its
// observations are stored under. Its arm is a range provider like the TRM one,
// so it asserts coverage over a span -- which is what lets a bolivar movement
// dated on a weekend resolve at all, since the CDN arm is asked for a single
// day and can never speak for the days between two publications.
export const OFFICIAL_BCV_CURRENCY = 'ves';

export const BCV_RATE_SOURCE = 'bcv';

// The name the CDN arm stores its observations and its coverage under. It is
// the arm of last resort: it is asked for a single day, and it answers with a
// cross recomputed from the accounting currency rather than a figure a national
// source published. Two readers need to know which name that is -- the resolver,
// to ask whether the call has anything left to write, and the historical store,
// to rank a day that now holds observations from more than one provider -- so it
// is defined once here instead of twice beside each of them.
export const FALLBACK_RATE_SOURCE = 'github-fallback';
