// backend/src/fintrack_api/services/fx_services/core/fxService.js

// ================================
// 🌍 FX GLOBAL STATE SERVICE
// ================================

/**
 * Global FX state and refresh logic.
 * 
 * Responsibilities:
 * - Maintain in‑memory fxState with rates, TTL, and concurrency control.
 * - Load state from database on startup.
 * - Refresh state from providers when expired or incomplete.
 * - Ensure state is fresh before serving requests.
 * - Provide a conversion function for backward compatibility.
 */

import { getCurrencyId } from '../../../../utils/currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';
import {
  SUPPORTED_CURRENCIES,
  FX_CACHE_TTL_MS,
} from './fxConfig.js';

import {
  getAllRatesFromDB,
  upsertRatesBatch,
} from '../db/fxDBaccess.js';
import { fetchRatesFromProviders } from './fxProviderOrchestrator.js';

// ─── GLOBAL STATE 

/**
 * In‑memory FX state.
 * 
 * @property {string|null} baseCurrency - Accounting currency (e.g., 'usd')
 * @property {Object|null} rates - { 'eur': { rate, source, fetchedAt }, ... }
 * @property {Date|null} oldestFetchedAt - MIN(fetchedAt) across all currencies (excluding base)
 * @property {number|null} stateTTL - Time-to-live in milliseconds (22h, 0.5h, or 0.25h)
 * @property {Promise|null} refreshPromise - Prevents concurrent refreshes
 */
export const fxState = {
  baseCurrency: null,
  rates: null,
  oldestFetchedAt: null,
  stateTTL: null,
  refreshPromise: null,
};

// ─── STATE VALIDATION (synchronous) 

/**
 * Check if fxState contains all supported currencies.
 * @returns {boolean} - True if complete
 */
function isFXStateComplete() {
  if (!fxState.rates) return false;
  
  const currencies = fxState.baseCurrency
    ? SUPPORTED_CURRENCIES
    : SUPPORTED_CURRENCIES.filter(c => c !== fxState.baseCurrency);

  return currencies.every(c => fxState.rates[c] !== undefined);
}

/**
 * Check if fxState has expired based on oldestFetchedAt and stateTTL.
 * @returns {boolean} - True if expired
 */
function isFXStateExpired() {
  if (!fxState.oldestFetchedAt || !fxState.stateTTL) return true;

  const age = Date.now() - new Date(fxState.oldestFetchedAt).getTime();
  return age > fxState.stateTTL;
}

/**
 * Check if fxState is valid (complete and not expired).
 * @returns {boolean} - True if valid
 */
export function isFXStateValid() {
  return isFXStateComplete() && !isFXStateExpired();
}

// ─── LOAD FROM DATABASE

/**
 * Load FX state from the database into memory.
 * @returns {Promise<boolean>} - True if successfully loaded and valid
 */
export async function loadFXStateFromDB() {
  try {
    const baseCurrency = fxState.baseCurrency || ACCOUNTING_CURRENCY_CODE;

    const baseId = await getCurrencyId(null, baseCurrency);

    if (!baseId) return false;

    const rates = await getAllRatesFromDB(SUPPORTED_CURRENCIES, baseId);

    if (!rates || Object.keys(rates).length === 0) return false;

    // Calculate oldestFetchedAt (excluding base)
    let oldest = null;
    for (const [code, data] of Object.entries(rates)) {
      if (code === baseCurrency) continue;
      const time = new Date(data.fetchedAt).getTime();
      if (oldest === null || time < oldest) oldest = time;
    }

    fxState.baseCurrency = baseCurrency;
    fxState.rates = rates;
    fxState.oldestFetchedAt = oldest ? new Date(oldest) : new Date();
    fxState.stateTTL = null; // will be set on next refresh

    // If the loaded state is already valid, set a default TTL (normal)
    if (isFXStateValid()) {
      fxState.stateTTL = FX_CACHE_TTL_MS;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to load FX state from DB:', error.message);
    return false;
  }
}

// ─── REFRESH FROM PROVIDERS 

/**
 * Refresh FX state by fetching fresh rates from all providers.
 * Persists the new rates to the database and updates fxState.
 * @returns {Promise<void>}
 * @throws {Error} - If the cascade fails to obtain all currencies
 */
export async function refreshFXState() {
  const baseCurrency = fxState.baseCurrency || ACCOUNTING_CURRENCY_CODE;

  // 1. Fetch rates from providers via orchestrator
  const result = await fetchRatesFromProviders(baseCurrency, SUPPORTED_CURRENCIES);
  // result = { rates, oldestFetchedAt, stateTTL }

  // 2. Persist to database (exclude base)
  const baseId = await getCurrencyId(null, baseCurrency);
  if (!baseId) throw new Error(`Base currency ${baseCurrency} not found`);

  const batch = Object.entries(result.rates)
    .filter(([code]) => code !== baseCurrency)
    .map(([code, data]) => ({
      targetCode: code,
      rate: data.rate,
      source: data.source,
      fetchedAt: data.fetchedAt,
      providerUpdatedAt: data.providerUpdatedAt || null,
    }));

  await upsertRatesBatch(batch, baseId);

  // 3. Update global state
  fxState.baseCurrency = baseCurrency;
  fxState.rates = result.rates;
  fxState.oldestFetchedAt = result.oldestFetchedAt;
  fxState.stateTTL = result.stateTTL;
}

// ─── ENSURE FRESH STATE 

/**
 * Ensure that fxState is fresh and valid.
 * If not, load from DB or refresh from providers with concurrency control.
 * @returns {Promise<void>}
 */
export async function ensureFXStateIsFresh() {
  // 1. If rates are null, try to load from DB
  if (fxState.rates === null) {
    const loaded = await loadFXStateFromDB();
    if (loaded && isFXStateValid()) {
      return;
    }
    // If loading failed or state is invalid, proceed to refresh
  }

  // 2. If state is not valid, trigger a refresh
  if (!isFXStateValid()) {
    // If a refresh is already in progress, wait for it
    if (fxState.refreshPromise) {
      await fxState.refreshPromise;
      return;
    }

    // Start a new refresh
    fxState.refreshPromise = refreshFXState();
    try {
      await fxState.refreshPromise;
    } finally {
      fxState.refreshPromise = null;
    }
  }
}

//CONVERSION (backward compatibility) 

/**
 * Convert an amount from one currency to the accounting base currency.
 * Uses fxState.rates for the rate.
 * 
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency (optional, defaults to base)
 * @returns {Promise<{ amount: number, rate: number, source: string, fetchedAt: Date }>}
 * @throws {Error} - If rate is not available
 */
export async function convertAmountToBaseCurrency(
  amount,
  fromCurrency,
  toCurrency = null
) {
  const target = toCurrency || fxState.baseCurrency || ACCOUNTING_CURRENCY_CODE;
  await ensureFXStateIsFresh();

  const from = fromCurrency.toLowerCase();
  if (from === target) {
    return {
      amount: amount,
      rate: 1,
      source: 'identity',
      fetchedAt: new Date(),
    };
  }

  const rateData = fxState.rates?.[from];
  if (!rateData) {
    throw new Error(`Rate for ${from} is not available.`);
  }

  return {
    amount: amount * rateData.rate,
    rate: rateData.rate,
    source: rateData.source,
    fetchedAt: rateData.fetchedAt,
  };
}

/*
# 1. Crear el archivo en fx_services/core/fxService.js

# 2. Verificar importación
node -e "import('./srfxProviderOrchestrator
c/fintrack_api/services/fx_services/core/fxService.js').then(m => console.log('✅ Exports:', Object.keys(m))).catch(e => console.error('❌', e))"

# 3. Probar ensureFXStateIsFresh (necesita que los providers estén configurados)
node -e "import('./src/fintrack_api/services/fx_services/core/fxService.js').then(async m => { await m.ensureFXStateIsFresh(); console.log('✅ fxState.rates keys:', Object.keys(m.fxState.rates)); }).catch(e => console.error(e))"

# 4. Probar conversión
node -e "import('./src/fintrack_api/services/fx_services/core/fxService.js').then(async m => { const result = await m.convertAmountToBaseCurrency(100, 'eur'); console.log('✅ Converted:', result); }).catch(e => console.error(e))"
*/