// backend/src/fintrack_api/services/exchangeRate_providers/cotizaveApiProvider.js
// 💰 PROVIDER: Cotizave API (Venezuela - official BCV exchange rate)

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

  // console.log('[FX DEBUG] RAW RESPONSE:', data);

  console.log('[FX DEBUG] VES BCV:', data?.rates?.find((r) => r.market === 'reference').mid);

  console.log('[FX DEBUG] VES PRL:', data?.rates?.find((r) => r.market === 'parallel').mid);

  console.log('[FX DEBUG] VES BNC:', data?.rates?.find((r) => r.market === 'binance').mid);

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
//===================================

