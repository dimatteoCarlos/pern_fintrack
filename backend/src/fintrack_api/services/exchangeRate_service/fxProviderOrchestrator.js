// backend/src/fintrack_api/services/exchangeRate_service/fxProviderOrchestrator.js

// 💰 PROVIDER ORCHESTRATOR: Cascade external providers (with VES priority)
// This module builds a list of external providers in order of priority (Cotizave first if the currency is VES) and executes the cascade until the first successful rate is obtained. If all fail, it throws an error (which will be captured by the main service and trigger a static fallback).

import { fetchFromExchangeRateAPI } from '../exchangeRate_providers/exchangeRateApiProvider.js';
import { fetchFromFreeCurrencyAPI } from '../exchangeRate_providers/freeCurrencyApiProvider.js';
import { fetchFromGitHubFallback } from '../exchangeRate_providers/githubFallback.js';
import { fetchFromCotizave } from '../exchangeRate_providers/cotizaveApiProvider.js';

// =======================================
// 1. Build provider list dynamically based on currency pair
// =======================================
function buildProviderList(baseCode, targetCode) {
  const providers = [];

  // Priority 1: Cotizave (BCV official) – only if pair involves VES
  if (baseCode === 'ves' || targetCode === 'ves') {
    providers.push({ name: 'Cotizave API', fn: () => fetchFromCotizave(baseCode, targetCode) });
  }

  // Priority 2, 3, 4: Generic providers (in order)
  providers.push(
    { name: 'ExchangeRate-API', fn: () => fetchFromExchangeRateAPI(baseCode, targetCode) },
    { name: 'FreeCurrencyAPI', fn: () => fetchFromFreeCurrencyAPI(baseCode, targetCode) },
    { name: 'GitHub fallback', fn: () => fetchFromGitHubFallback(baseCode, targetCode) }
  );

  return providers;
}

// =======================================
// 2. Execute cascade and return first successful rate
// =======================================
export async function fetchFromExternalProviders(baseCode, targetCode) {
  const providers = buildProviderList(baseCode, targetCode);

  for (const provider of providers) {
    try {
      console.log(`🌐 Trying ${provider.name} for ${baseCode}/${targetCode}...`);
      const result = await provider.fn();
      console.log(`✅ ${provider.name} success: ${result.rate}`);
      return result;
    } catch (error) {
      console.warn(`⚠️ ${provider.name} failed: ${error.message}`);
    }
  }

  // If all external providers fail, throw error (caller will fallback to static)
  throw new Error(`All external providers failed for ${baseCode} → ${targetCode}`);
}