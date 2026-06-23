// backend/src/fintrack_api/services/fx_services/core/fxProviderOrchestrator.js

// ================================
// 🔄 FX PROVIDER ORCHESTRATOR
// ================================

/**
 * Orchestrates the cascade of providers to fetch all required exchange rates.
 * 
 * Responsibilities:
 * - Inject the base currency locally (rate = 1).
 * - Iterate through providers in order: Cotizave → ExchangeRate → FreeCurrency → GitHub → Static.
 * - Fill missing currencies without overwriting existing ones.
 * - Calculate oldestFetchedAt = MIN(fetchedAt) across all currencies (excluding base).
 * - Determine stateTTL based on the lowest-priority provider used.
 * - Throw error if any currency remains missing after the cascade.
 */

import {
  FX_CACHE_TTL_MS,
  FX_GITHUB_TTL_MS,
  FX_STATIC_FALLBACK_TTL_MS,
  SUPPORTED_CURRENCIES,
} from './fxConfig.js';

import * as cotizave from '../fxProviders/cotizaveApiProvider.js';
import * as exchangeRate from '../fxProviders/exchangeRateApiProvider.js';
import * as freeCurrency from '../fxProviders/freeCurrencyApiProvider.js';
import * as github from '../fxProviders/githubFallback.js';
import * as staticFallback from '../fxProviders/getFallbackRate.js';

// ─── Provider list in priority order ──

const PROVIDERS = [
  { name: 'cotizave', fn: cotizave.fetchAllRates, ttl: FX_CACHE_TTL_MS },
  { name: 'exchange-rate-api', fn: exchangeRate.fetchAllRates, ttl: FX_CACHE_TTL_MS },
  { name: 'free-currency-api', fn: freeCurrency.fetchAllRates, ttl: FX_CACHE_TTL_MS },
  { name: 'github-fallback', fn: github.fetchAllRates, ttl: FX_GITHUB_TTL_MS },
  { name: 'static-fallback', fn: staticFallback.fetchAllRates, ttl: FX_STATIC_FALLBACK_TTL_MS },
];

// ─── Main exported function ─────────────

/**
 * Fetch all exchange rates for the supported currencies.
 * 
 * @param {string} baseCurrency - Base currency code (e.g., 'usd')
 * @param {string[]} supportedCurrencies - List of all currencies to fetch
 * @param {Object} options - Additional options (e.g., for static fallback)
 * @returns {Promise<{ rates: Object, oldestFetchedAt: Date, stateTTL: number }>}
 * @throws {Error} - If any currency remains missing after all providers
 */
export async function fetchRatesFromProviders(
  baseCurrency,
  supportedCurrencies = SUPPORTED_CURRENCIES,
  options = {}
) {
  // 1. Initialize rates with the base currency (rate = 1)
  const now = new Date();
  const rates = {
    [baseCurrency]: {
      rate: 1,
      source: 'system',
      fetchedAt: now,
    },
  };

  // 2. Track missing currencies (exclude base)
  const missing = new Set(supportedCurrencies.filter(c => c !== baseCurrency));

  // 3. Track the lowest-priority TTL used
  let stateTTL = FX_CACHE_TTL_MS;

  // 4. Track oldest fetchedAt (excluding base)
  let oldestFetchedAt = null;

  // 5. Iterate through providers in order
  for (const provider of PROVIDERS) {
    if (missing.size === 0) break; // all currencies found

    try {
      const result = await provider.fn(baseCurrency, options);

      if (!result || !result.rates || typeof result.rates !== 'object') {
        continue; // provider returned nothing
      }

      // 6. Fill missing currencies without overwriting
      let providerUsed = false;
      for (const [code, data] of Object.entries(result.rates)) {
        const c = code.toLowerCase();
        if (c === baseCurrency) continue; // never overwrite base
        if (missing.has(c) && !rates[c]) {
          rates[c] = {
            rate: data.rate,
            source: data.source || provider.name,
            fetchedAt: data.fetchedAt || new Date(),
          };
          missing.delete(c);
          providerUsed = true;

          // Update oldestFetchedAt
          const fetchedTime = new Date(rates[c].fetchedAt).getTime();
          if (oldestFetchedAt === null || fetchedTime < oldestFetchedAt) {
            oldestFetchedAt = fetchedTime;
          }
        }
      }

      // 7. Degrade TTL if this provider was used and has a shorter TTL
      if (providerUsed && provider.ttl < stateTTL) {
        stateTTL = provider.ttl;
      }
    } catch (error) {
      console.warn(`⚠️ Provider ${provider.name} failed:`, error.message);
      // Continue with next provider
    }
  }

  // 8. Validate completeness
  if (missing.size > 0) {
    throw new Error(
      `Fallback data incomplete. Missing currencies: ${[...missing].join(', ')}`
    );
  }

  // 9. If oldestFetchedAt is still null (only base currency existed), set to now
  if (oldestFetchedAt === null) {
    oldestFetchedAt = now.getTime();
  }

  // 10. Return unified result
  return {
    rates,
    oldestFetchedAt: new Date(oldestFetchedAt),
    stateTTL,
  };
}

/*
# 1. Crear el archivo en fx_services/core/fxProviderOrchestrator.js

# 2. Verificar que se importa sin errores, desde /backend/
node -e "import('./src/fintrack_api/services/fx_services/core/fxProviderOrchestrator.js').then(m => console.log('✅ Exports:', Object.keys(m))).catch(e => console.error('❌', e))"

# 3. Probar el orquestador (necesita que los providers estén listos)
node -e "import('./src/fintrack_api/services/fx_services/core/fxProviderOrchestrator.js').then(async m => { const result = await m.fetchRatesFromProviders('usd', ['usd','eur','cop','ves','mxn']); console.log('✅ Rates keys:', Object.keys(result.rates)); console.log('✅ TTL:', result.stateTTL); }).catch(e => console.error(e))"

*/