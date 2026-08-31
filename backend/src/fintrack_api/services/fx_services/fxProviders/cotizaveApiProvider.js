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

import { formatDateToVenezuelanStyle } from "../../../../utils/helpers.js";

// - API key validation (API_KEY_COTIZAVE)
// - URL: https://api.cotizave.com/v1/fx/rates
// - Response parsing (reference market)
// - Both usd→ves and ves→usd pairs
//=======================================
const COTIZAVE_API_URL = 'https://api.cotizave.com/v1/fx/rates';

/**
 * Pure helper function to format and log exchange rate data in Venezuelan local style.
 * @param {Object} data - The raw JSON response from Cotizave API
 */

function logFormattedRates(data) {
  if (!data || !Array.isArray(data?.rates)) return;

  // 1. Format current timestamp dynamically
  const lastUpdate =
    new Date(data.rates.find((r) => r.market === 'reference')?.updated_at) ||
    new Date();
  const dateStr = formatDateToVenezuelanStyle(lastUpdate).dateStr;
  const timeStr = formatDateToVenezuelanStyle(lastUpdate).timeStr;
  //--------------------------
  const now = new Date();
  const nowDateStr = formatDateToVenezuelanStyle(now).dateStr;
  const nowTimeStr = formatDateToVenezuelanStyle(now).timeStr;
  //--------------------------
  // 2. Pure formatting function for Venezuelan currency style
  const formatVES = (val) => {
    if (typeof val !== 'number') return '0,00';
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };
  //---------------------------------
  // 3. Extract required rates safely
   const bcv = data.rates.find((r) => r.market === 'reference')?.mid;
   const parallel = data.rates.find((r) => r.market === 'parallel')?.mid;
   const binance = data.rates.find((r) => r.market === 'binance')?.mid;
   const euro = data.rates.find((r) => r.market === 'bcv_eur')?.mid;
  //---------------------------------
  // 4. Calculate exchange rate spread dynamically between BCV and Binance
  const spread = bcv && binance ? ((binance - bcv) / bcv) * 100 : 0;

  // 5. Output formatted dashboard to logs
  console.log(`\n💸 Dólar ahora » ${nowDateStr}. ${nowTimeStr}`);

  console.log(`📅 Última actualización » ${dateStr}. ${timeStr}\n`);

  console.log('💵 Dólar BCV: Bs.', formatVES(bcv));

  console.log(`💰 Binance USDT: Bs.`, formatVES(binance));
  
  console.log('⚖️  Promedio BCV / USDT: Bs.', formatVES((binance + bcv) / 2));
  
  console.log(
    '📊 Brecha cambiaria BCV / USDT:',
    formatVES(spread) + '%',
    '',
  );
  
  console.log('\n🤑 Dólar Paralelo: Bs.', formatVES(parallel));

  if (euro) {
    console.log('💶 Euro BCV: Bs.', formatVES(euro));
  }
}
//-------------------------------------
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

  // console.log('==============================');
  // DEBUG LOGS
  // console.log('[FX DEBUG] ENV KEY EXISTS:', !!FZ_API_KEY);
  // console.log('[FX DEBUG] REQUEST URL:', COTIZAVE_API_URL);
  //------------
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
  // console.log('🚀 ~ fetchFromCotizave ~ data:', data);

  // Execute pure logging function with API response context
  logFormattedRates(data);

  //---DEBUG--------------------
  // console.log('[FX DEBUG] RAW RESPONSE:', data);
  // console.log('VES BCV:', data?.rates?.find((r) => r.market === 'reference').mid);
  // console.log('[FX DEBUG] VES PRL:', data?.rates?.find((r) => r.market === 'parallel').mid);
  // console.log('[FX DEBUG] VES BNC:', data?.rates?.find((r) => r.market === 'binance').mid);
  // console.log('[FX DEBUG] VES BNC:', data?.rates?.find((r) => r.market === 'binance').mid);
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

  // console.log(`[FX] Cotizave API ${base} -> ${target}: ${rate}`);

  // updated_at is when Cotizave refreshed its reference market, not when this
  // installation asked. Read as fetchedAt it aged the cache from the provider's
  // clock; the two now travel separately.
  //
  // Parsed and checked rather than trusted: new Date(undefined) yields an
  // Invalid Date, which is truthy, so the old `|| new Date()` fallback could
  // never fire and an absent reference market stored an unusable timestamp.
  const referenceUpdatedAt = new Date(
    data.rates.find((r) => r.market === 'reference')?.updated_at,
  );

  return {
    rate,
    source: 'cotizave',
    fetchedAt: new Date(),
    providerUpdatedAt: Number.isNaN(referenceUpdatedAt.getTime())
      ? null
      : referenceUpdatedAt,
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
            providerUpdatedAt: result.providerUpdatedAt || null,
          },
        },
        source: 'cotizave',
        fetchedAt: result.fetchedAt || new Date(),
        providerUpdatedAt: result.providerUpdatedAt || null,
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
        providerUpdatedAt: result.providerUpdatedAt || null,
      };
    }
    return null;
  } catch (error) {
    console.warn('⚠️ Cotizave fetchRate failed:', error.message);
    return null;
  }
}
//-------------------------------------
