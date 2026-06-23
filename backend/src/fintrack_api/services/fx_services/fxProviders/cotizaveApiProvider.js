// backend/src/fintrack_api/services/fx_services/fxProviders/cotizaveApiProvider.js

// ============================
// 💰 COTIZAVE API PROVIDER
// ============================
/**
 * Cotizave provider for VES (Venezuelan Bolívar) exchange rates.
 * Provides both l(single-rate) and standardized (batch + specific) interfaces.
 * standardized interfaces (fetchAllRates, fetchRate) for the FX global state.
 * API Response Structure (example):
 * {
 *   rates: [
 *     { market: 'reference', mid: 602.3324, updated_at: '...' },
 *     { market: 'parallel', mid: 798.2555, ... },
 *     ...
 *   ],
 *   index: { value: 739.2508, ... },
 *   fetched_at: '...'
 * }
 */

// - API key validation (API_KEY_COTIZAVE)
// - URL: https://api.cotizave.com/v1/fx/rates
// - Response parsing (reference market)
// - Both usd→ves and ves→usd pairs
//============================================
const COTIZAVE_API_URL = 'https://api.cotizave.com/v1/fx/rates';

export async function fetchFromCotizave(baseCode, targetCode) {
  const FZ_API_KEY = process.env.API_KEY_COTIZAVE;

  if (!FZ_API_KEY) {
    throw new Error('Missing COTIZAVE_API_KEY');
  }

  if (!baseCode || !targetCode) {
    throw new Error('baseCode and targetCode are required');
  }

  const base = baseCode.toLowerCase();
  const target = targetCode.toLowerCase();

  // DEBUG LOGS
  // console.log('[FX DEBUG] ENV KEY EXISTS:', !!FZ_API_KEY);
  // console.log('[FX DEBUG] REQUEST URL:', COTIZAVE_API_URL);
  //---
  // console.log('==============================');
  // console.log('[FX DEBUG] FINAL REQUEST CHECK');
  // console.log('[FX DEBUG] API KEY LENGTH:', FZ_API_KEY?.length);
  // console.log('[FX DEBUG] API KEY PREFIX:', FZ_API_KEY?.slice(0, 10));
  // console.log('==============================');
  const res = await fetch(COTIZAVE_API_URL, {
    headers: {
      'X-API-Key': FZ_API_KEY,
    },
  });

  const data = await res.json();

//---DEBUG
  // console.log('[FX DEBUG] RAW RESPONSE:', data);

  console.log('[FX DEBUG] VES BCV:', data?.rates?.find((r) => r.market === 'reference').mid);

  console.log('[FX DEBUG] VES PRL:', data?.rates?.find((r) => r.market === 'parallel').mid);

  console.log('[FX DEBUG] VES BNC:', data?.rates?.find((r) => r.market === 'binance').mid);
//------------------------
  const rates = data?.rates;

  if (!Array.isArray(rates)) {
    throw new Error('Invalid API response');
  }

  const bcv = rates.find((r) => r.market === 'reference');

  if (!bcv || typeof bcv.mid !== 'number' || bcv.mid <= 0) {
    throw new Error('BCV rate not found or invalid');
  }

  const usdToVes = bcv.mid;
  let rate;

  if (base === 'usd' && target === 'ves') {
    rate = usdToVes;
  } else if (base === 'ves' && target === 'usd') {
    rate = 1 / usdToVes;
  } else {
    throw new Error(`Unsupported pair: ${base}/${target}`);
  }

  console.log(`[FX] Cotizave API ${base} -> ${target}: ${rate}`);

  return {
    rate,
    source: 'cotizave',
    fetchedAt: new Date(),
  };
}

//=======================================
// fetchAllRates (standardized interface)
export async function fetchAllRates(baseCurrency) {
  try {
    const result = await fetchFromCotizave(baseCurrency, 'ves');
    if (result && typeof result.rate === 'number') {
      return {
        rates: {
          ves: {
            rate: result.rate,
            source: result.source || 'cotizave',
            fetchedAt: result.fetchedAt || new Date(),
          },
        },
        source: 'cotizave',
        fetchedAt: result.fetchedAt || new Date(),
      };
    }
    return null;
  } catch (error) {
    console.warn('⚠️ Cotizave fetchAllRates failed:', error.message);
    return null;
  }
}

//--------------------------------------
//-- fetchRate (standardized interface)
export async function fetchRate(baseCurrency, targetCurrency, options = {}) {
  try {
    const target = targetCurrency.toLowerCase();
    if (target !== 'ves') return null;
    const result = await fetchFromCotizave(baseCurrency, target);
    if (result && typeof result.rate === 'number') {
      return {
        rate: result.rate,
        source: result.source || 'cotizave',
        fetchedAt: result.fetchedAt || new Date(),
      };
    }
    return null;
  } catch (error) {
    console.warn('⚠️ Cotizave fetchRate failed:', error.message);
    return null;
  }
}