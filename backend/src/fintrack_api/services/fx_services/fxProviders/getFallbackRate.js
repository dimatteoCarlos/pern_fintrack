// backend/src/fintrack_api/services/exchangeRate_providers/getFallbackRate.js
// 💰 FALLBACK RATES: Static exchange rates + exponential projection for VES
//STATIC FALLBACK PROVIDER (Priority 4 – Last resort)

/**
 * Static fallback provider with dynamic VES projection.
 * This is the last line of defense when all other providers fail.
 * 
 * Features:
 * - Fixed rates for stable currencies (USD, EUR, COP, MXN)
 * - Exponential projection for VES based on historical BCV data
 * - Supports any currency pair (via USD cross rates)
 * - Synchronous (no network calls)
 * - Always available, TTL = 2 hours (degraded mode)
 */

// Historical BCV data (used for VES projection)
export const data = [
  { fecha: "2026-01-05", y: 304.6796 },
  { fecha: "2026-01-26", y: 355.5528 },
  { fecha: "2026-02-03", y: 372.1057 },
  { fecha: "2026-02-27", y: 417.3579 },
  { fecha: "2026-03-27", y: 468.51 },
  { fecha: "2026-03-30", y: 471.7004 },
  { fecha: "2026-05-13", y: 508.6004 },
  { fecha: "2026-05-25", y: 530.5047 },
  { fecha: "2026-05-26", y: 535.3853 },
  { fecha: "2026-05-29", y: 549.3716 },
  { fecha: "2026-06-02", y: 557.9741 },
  { fecha: "2026-06-03", y: 558.6436 },
  { fecha: "2026-06-04", y: 560.3753 },
  { fecha: "2026-06-05", y: 563.2892 },
  { fecha: "2026-06-09", y: 567.6828 },
  { fecha: "2026-06-10", y: 572.6828 },
  { fecha: "2026-06-11", y: 577.545 },
  { fecha: "2026-06-12", y: 582.69 },
  { fecha: "2026-06-15", y: 587.4059 },
  { fecha: "2026-06-16", y: 592.5163 },
  { fecha: "2026-06-17", y: 596.78 },
  { fecha: "2026-06-18", y: 602.33 },
  { fecha: "2026-06-19", y: 607.39 },
  { fecha: "2026-06-22", y: 612.4332 },
]

// =======================================
// 1. Fixed rates for stable currencies (base = USD)
// =======================================
export const fixedRates = {
  usd: 1,
  eur: 0.9,
  cop: 3500,
  mxn: 17,
  ves: 650,// Placeholder (overridden by projection in fetchAllRates/fetchRate)
};

// ============================================
// 2. Helper days between two dates
// ============================================
function daysBetween(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((da - db) / (1000 * 60 * 60 * 24));
}
//Exponential regression parameters
function calcularParametros(datos, nUltimos = 7) {
  const n = Math.max(1, Math.min(Number(nUltimos) || 7, datos.length));
  const muestra = datos.slice(-n);
  
  const baseDate = muestra[0].fecha;
  const baseY = muestra[0].y;

  if (n === 1) {
    return {
      a: baseY,
      b: 0,
      lnA: Math.log(baseY),
      r2: 1.0,
      baseDate,
      baseY,
      nUsados: 1,
      puntos: muestra.map(d => ({ fecha: d.fecha, x: 0, y: d.y }))
    };
  }

  const puntos = muestra.map(d => ({
    fecha: d.fecha,
    x: daysBetween(d.fecha, baseDate),
    y: d.y
  }));

  const xs = puntos.map(d => d.x);
  const ys = puntos.map(d => Math.log(d.y));

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);

  const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const lnA = (sumY - b * sumX) / n;
  const a = Math.exp(lnA);

  const yBar = sumY / n;
  const sst = ys.reduce((acc, y) => acc + (y - yBar) ** 2, 0);
  const sse = ys.reduce((acc, y, i) => acc + (y - (lnA + b * xs[i])) ** 2, 0);
  const r2 = sst === 0 ? 1 : 1 - sse / sst;

  return {
    a, b, lnA, r2, baseDate, baseY, nUsados: n, puntos
  };
}

//========================================
// 3. Helper: Project VES rate for a given date
// =======================================
function projectVesRate(date = new Date(), nUsados = 7) {
  const params = calcularParametros(data, nUsados);

  const fecha = new Date(date);
  const base = new Date(`${params.baseDate}T00:00:00`);
  const dias = Math.round((fecha - base) / (1000 * 60 * 60 * 24));

  const rate = params.a * Math.exp(params.b * dias);

  return rate;
}

// =========================================
// 4. Main function: get fallback rate (with VES projection)
// =========================================
/**
 * Get fallback exchange rate from any currency to USD (or vice versa).
 * For VES, uses dynamic exponential projection; for others, fixed values.
 * @param {string} fromCode - Origin currency code (lowercase)
 * @param {string} toCode - Target currency code (lowercase, default 'usd')
 * @param {number} nUsados - Number of recent data points for VES projection (default 7)
 * @returns {number}
 */
export function getFallbackRate(fromCode, toCode = 'usd', nUsados = 7) {
  const from = fromCode.toLowerCase();
  const to = toCode.toLowerCase();

  if (from === to) return 1.0;

  function getRateFromUsd(target) {
    if (target === 'usd') return 1;
    if (target === 'ves') return projectVesRate(new Date(), nUsados);

    const fixed = fixedRates[target];

    if (fixed === undefined) throw new Error(`No fallback rate for ${target}`);
    return fixed;
  }

  if (from === 'usd') {
    return getRateFromUsd(to);
  }

  if (to === 'usd') {
    const rate = getRateFromUsd(from);
    return 1 / rate;
  }

  const rateFromToUsd = getRateFromUsd(from);

  const rateUsdToTarget = getRateFromUsd(to);

  return (1 / rateFromToUsd) * rateUsdToTarget;
}
//=====================================
// STANDARDIZED FUNCTIONS (for FX global state)
//=====================================
/**
 * Fetch all exchange rates for a base currency (massive snapshot).
 * Uses the static fallback rates + dynamic VES projection.
 * 
 * @param {string} baseCurrency - Base currency code (e.g., 'usd')
 * @param {Object} options - { nUsados: number } for VES projection
 * @returns {Promise<Object>} - { rates: { target: { rate, source, fetchedAt } }, source, fetchedAt }
 */
export async function fetchAllRates(baseCurrency, options = { nUsados: 7 }) {
  const base = baseCurrency.toLowerCase();
  const nUsados = options.nUsados || 7;
  const now = new Date();

  // List of all supported currencies (from fixedRates keys)
  const allCurrencies = Object.keys(fixedRates);

  const rates = {};
  for (const target of allCurrencies) {
    try {
      // Use the existing getFallbackRate to get the rate
      const rate = getFallbackRate(base, target, nUsados);
      rates[target] = {
        rate,
        source: 'static-fallback',
        fetchedAt: now,
      };
    } catch (err) {
      console.warn(`⚠️ Static fallback: no rate for ${base} → ${target}:`, err.message);
      // Skip this currency (leave it out)
    }
  }

  return {
    rates,
    source: 'static-fallback',
    fetchedAt: now,
  };
}

//========================
/**
 * Fetch a specific exchange rate for a currency pair.
 * 
 * @param {string} baseCurrency - Base currency code
 * @param {string} targetCurrency - Target currency code
 * @param {Object} options - { nUsados: number } for VES projection
 * @returns {Promise<Object>} - { rate, source, fetchedAt } or null
 */
export async function fetchRate(baseCurrency, targetCurrency, options = { nUsados: 7 }) {
  try {
    const rate = getFallbackRate(
      baseCurrency,
      targetCurrency,
      options.nUsados || 7
    );
    return {
      rate,
      source: 'static-fallback',
      fetchedAt: new Date(),
    };
  } catch (error) {
    console.warn(`⚠️ Static fallback fetchRate failed for ${baseCurrency} → ${targetCurrency}:`, error.message);
    return null;
  }
}
//========================
// CLI TESTING
// Test getFallbackRate from command line
// ======================================
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const arg of args) {
    const [k, v] = arg.split("=");
    if (k && v !== undefined) out[k.replace(/^--/, "")] = v;
  }
  return out;
}

const args = parseArgs();

if (args.from || args.to) {
  const from = args.from || 'ves';
  const to = args.to || 'usd';
  const nUsados = args.n ? parseInt(args.n, 10) : 7;
  
  const rate = getFallbackRate(from, to, nUsados);
  
  console.log(`Fallback Rate: ${from} → ${to}`);
  console.log(JSON.stringify({
    from,
    to,
    rate,
    nUsados,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  if (from.toLowerCase() === 'ves' || to.toLowerCase() === 'ves') {
    const params = calcularParametros(data, nUsados);
    console.log('\nParámetros VES proyectados:');
    console.log(JSON.stringify({
      a: params.a,
      b: params.b,
      baseDate: params.baseDate,
      baseY: params.baseY,
      r2: params.r2,
      nUsados: params.nUsados
    }, null, 2));
  }
} else {
  console.log('Uso:');
  console.log('node getFallbackRate.js --from=ves --to=usd');
  console.log('node getFallbackRate.js --from=eur --to=ves');
  console.log('node getFallbackRate.js --from=ves --to=usd --n=5');
}
/*
Probar importación desde backend/
node -e "import('./src/fintrack_api/services/fx_services/fxProviders/getFallbackRate.js')..."

node -e "import('./src/fintrack_api/services/fx_services/fxProviders/getFallbackRate.js').then(m => console.log('✅ Exports:', Object.keys(m))).catch(e => console.error('❌', e))"

# 4. Probar fetchAllRates
node -e "import('./src/fintrack_api/services/fx_services/fxProviders/getFallbackRate.js').then(async m => { const r = await m.fetchAllRates('usd'); console.log('✅ Rates keys:', Object.keys(r.rates)); }).catch(e => console.error(e))"

# 5. Probar fetchRate desde backend/
node -e "import('./src/fintrack_api/services/fx_services/fxProviders/getFallbackRate.js').then(async m => { const r = await m.fetchRate('usd', 'ves'); console.log('✅ VES rate:', r); }).catch(e => console.error(e))"

desde raiz:
node -e "import('./backend/src/fintrack_api/services/fx_services/fxProviders/getFallbackRate.js').then(async m => { const r = await m.fetchRate('usd', 'ves'); console.log('✅ VES rate:', r); }).catch(e => console.error(e))"

*/
/*
Cómo ejecutarlo
1. VES → USD (por defecto con 7 datos)
bash
node backend/src/fintrack_api/services/exchangeRate_providers/getFallbackRate.js --from=ves --to=usd
2. EUR → VES
bash
node backend/src/fintrack_api/services/exchangeRate_providers/getFallbackRate.js --from=eur --to=ves
3. USD → VES con 5 datos
bash
node backend/src/fintrack_api/services/exchangeRate_providers/getFallbackRate.js --from=usd --to=ves --n=5
4. Por defecto (VES → USD)
bash
node backend/src/fintrack_api/services/exchangeRate_providers/getFallbackRate.js
Salida ejemplo
json
Fallback Rate: ves → usd
{
  "from": "ves",
  "to": "usd",
  "rate": 0.00172,
  "nUsados": 7,
  "timestamp": "2026-06-20T16:06:00.000Z"
}

Parámetros VES proyectados:
{
  "a": 558.6436,
  "b": 0.0032,
  "baseDate": "2026-06-03",
  "baseY": 558.6436,
  "r2": 0.9614,
  "nUsados": 7
}
*/