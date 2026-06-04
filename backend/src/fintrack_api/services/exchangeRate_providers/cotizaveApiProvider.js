// backend/src/fintrack_api/services/exchangeRate_providers/cotizaveApiProvider.js
// 💰 PROVIDER: Cotizave API (Venezuela - official BCV exchange rate)

console.log('[ENV CHECK] API_KEY_COTIZAVE START =', process.env.API_KEY_COTIZAVE);

const COTIZAVE_API_URL = 'https://api.cotizave.com/v1/fx/rates';

// const FZ_API_KEY = 'ctz_live_8j7Qf3S8xzFma57CF3XKufuc2e8K5wLK4u3cGv';

// const TIMEOUT_MS = Number(process.env.FX_REQUEST_TIMEOUT_MS || 3000);

export async function fetchFromCotizave(baseCode, targetCode) {

 const FZ_API_KEY = process.env.API_KEY_COTIZAVE;

 console.log('[ENV CHECK] API_KEY_COTIZAVE =',FZ_API_KEY);

  if (!FZ_API_KEY) {
    throw new Error('Missing COTIZAVE_API_KEY');
  }

  if (!baseCode || !targetCode) {
    throw new Error('baseCode and targetCode are required');
  }

  const base = baseCode.toLowerCase();
  const target = targetCode.toLowerCase();
  // DEBUG LOGS
  console.log('[FX DEBUG] ENV KEY EXISTS:', !!FZ_API_KEY);
  console.log('[FX DEBUG] ENV KEY:', FZ_API_KEY);
  console.log('[FX DEBUG] REQUEST URL:', COTIZAVE_API_URL);
  //---
  console.log('==============================');
  console.log('[FX DEBUG] FINAL REQUEST CHECK');
  console.log('[FX DEBUG] API KEY LENGTH:', FZ_API_KEY?.length);
  console.log('[FX DEBUG] API KEY PREFIX:', FZ_API_KEY?.slice(0, 10));
  console.log('==============================');
  // const response = await axios.get(COTIZAVE_API_URL, {
  //   headers: {
  //     'X-API-Key': FZ_API_KEY,
  //     Accept: 'application/json',
  //   },
  //   timeout: TIMEOUT_MS,
  // });

  const res = await fetch(COTIZAVE_API_URL, {
    headers: {
      'X-API-Key': FZ_API_KEY,
    },
  });

   const data = await res.json();

   console.log('[FX DEBUG] RAW RESPONSE:', data);

   const rates = data?.rates;

  // const text = await res.text();
  // console.log('[FX DEBUG] RAW RESPONSE:', text);

  // const rates = res.data?.rates;

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
