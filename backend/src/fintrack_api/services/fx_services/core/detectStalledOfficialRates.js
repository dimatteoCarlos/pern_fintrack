// backend/src/fintrack_api/services/fx_services/core/detectStalledOfficialRates.js

// Days on which the official source looks stuck, found by disagreeing with the
// independent one.
//
// THE PROBLEM THIS ANSWERS. The BCV arm reads a community scraper, and a scraper
// can stall: measured on 2026-06-02..06-22 it repeated 554.4258 for twenty-one
// days while the real rate climbed from 557 to 612, and again on 06-26..07-03 it
// held 617.6388. Those figures are wrong by up to 9.5%, and nothing about them
// looks wrong on its own -- a repeated rate is normal, because a central bank
// genuinely holds a rate over weekends and holidays. bcv_data.js has 2026-07-21
// and 07-22 both at 737.2321, published and correct.
//
// So a stall cannot be detected inside one source. It needs a second opinion.
//
// WHY THE SIGN IS THE SIGNAL, and not the size of the gap. The store already
// holds two independent observations for many bolivar days: the official one,
// and the CDN's cross, which is market-influenced. Measured over 58 healthy days
// from 2026-07-05 to 2026-09-01, the CDN sits BELOW the official rate on 54 of
// them, median 0.366% below, and never rises more than one percent above it.
// The market follows the official rate; it does not lead it.
//
// During the stall that ordering inverts, because the official figure stops
// moving while the market keeps going:
//
//   2026-07-01   official 617.6388   CDN 626.65   CDN 1.46% ABOVE
//   2026-07-02   official 617.6388   CDN 632.57   CDN 2.42% ABOVE
//   2026-07-03   official 617.6388   CDN 644.99   CDN 4.43% ABOVE
//
// WHY PERSISTENCE AND NOT MAGNITUDE. The first version of this required the gap
// to reach one percent, a level the healthy window never touched in the wrong
// direction. Run against the stall it found NOTHING: those three days are the
// twentieth to twenty-second of a stall that had been running for weeks, and by
// the time a stall is that wide the damage is done. The five days that survive
// in the store, 2026-06-26..06-30, are the beginning of one, and they only reach
// 0.55% to 0.76%. A magnitude band misses exactly the days worth catching.
//
// What separates them is not size, it is persistence. Measured over the same
// window with no magnitude band at all: those five days flagged, as one run of
// five, and the twenty healthy days around them flagged ZERO times -- the CDN
// was never once above the official rate on a day the source was working. So
// the default is the direction plus a run of at least two days, and the size of
// the gap is reported rather than required.
//
// Both knobs stay open. A caller who wants only wide stalls raises signalPct;
// one who wants the first day raises nothing and lowers minRunDays to 1, at the
// cost of the isolated day where the market genuinely leads -- four such days in
// fifty-eight, measured against the provider directly.
//
// WHY THE SECOND OPINION IS FETCHED AND NOT READ. The obvious version of this
// reads both sources out of the store and compares them. It finds nothing, and
// not because the rates are healthy: measured on 2026-06-20..07-31, the store
// held the official rate on 26 days and the independent one on ZERO of them.
// That is the cascade working as designed -- the first arm that answers ends it,
// and the answer is cached, so a day the official source resolved is a day the
// CDN is never asked about. The two sources coexist only where history happens
// to have left both. A check that depends on that coincidence reports silence
// and is read as health, which is the worst thing a diagnostic can do.
//
// So the independent figure is fetched, one call per day being audited. It costs
// a handful of seconds on a command nobody runs in a request path.
//
// WHAT THIS DOES NOT DO. It decides nothing. It writes nothing to the store,
// discards no row and changes no rate -- the fetch goes straight to the provider
// and its result is never persisted. A past rate is a fact the store records,
// and a diagnostic that quietly deleted facts would be a worse defect than the
// one it reports. It answers one question -- which days look wrong -- and leaves
// the judgement where it belongs.
//
// And it always says how many days it could NOT compare, so a quiet run is never
// mistaken for a clean one.

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import pc from 'picocolors';

import { pool } from '../../../../db/config/configDB.js';
import {
 ACCOUNTING_CURRENCY_CODE,
 BCV_RATE_SOURCE,
 FALLBACK_RATE_SOURCE,
 OFFICIAL_BCV_CURRENCY,
} from './fxConfig.js';
import { BACKDATING_WINDOW_MONTHS } from '../../../config/fintrackConfig.js';
import {
 earliestDatableDay,
 todayInZone,
} from '../../../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';
import { fetchRatesForDate } from '../fxProviders/githubFallbackProvider.js';

// How far above the official rate the independent one has to sit before a day
// is a candidate. Zero means the direction alone: on the measured window that
// gave five true positives and no false ones, while any positive band missed the
// stall entirely.
const DEFAULT_SIGNAL_PCT = 0;

// How many consecutive candidates make a stall rather than a day the market
// happened to lead. Two is the smallest number that is not a single day.
const DEFAULT_MIN_RUN_DAYS = 2;

/**
 * @typedef {Object} StalledDay
 * @property {string} day - The calendar day, YYYY-MM-DD.
 * @property {string} official - What the official source recorded, as text.
 * @property {string} independent - What the independent source recorded.
 * @property {number} gapPct - How far above the official the independent sits.
 * @property {number} runLength - Consecutive flagged days this one belongs to.
 */

/**
 * The days a currency's official source looks stalled on.
 *
 * The official figure is read from the store, because that is the record being
 * audited. The independent one is fetched from the CDN for the same day, and
 * never written anywhere -- see the header for why reading it from the store
 * finds nothing.
 *
 * @param {Object} [args]
 * @param {string} [args.currency='ves'] - The currency to examine.
 * @param {string} [args.officialSource='bcv'] - The source treated as official.
 * @param {string} [args.from] - First day, YYYY-MM-DD. Defaults to the floor of
 *  the back-dating window, because a day nobody can date a movement on is a day
 *  nobody needs warned about.
 * @param {string} [args.to] - Last day. Defaults to today.
 * @param {number} [args.signalPct] - The band, in percent. 0 is the direction alone.
 * @param {number} [args.minRunDays] - Consecutive candidates a run needs to be reported.
 * @returns {Promise<{flagged: StalledDay[], compared: number, uncomparable: string[]}>}
 */
export async function detectStalledOfficialRates({
 currency = OFFICIAL_BCV_CURRENCY,
 officialSource = BCV_RATE_SOURCE,
 from,
 to,
 signalPct = DEFAULT_SIGNAL_PCT,
 minRunDays = DEFAULT_MIN_RUN_DAYS,
} = {}) {
 // The window is read on UTC deliberately. This is not valuing anybody's
 // movement -- it is scanning a shared store that has no single owner, so there
 // is no calendar to prefer, and a day either way only widens the scan.
 const today = todayInZone('UTC');
 const start = from ?? earliestDatableDay(today, BACKDATING_WINDOW_MONTHS);
 const end = to ?? today;

 const { rows } = await pool.query(
  `SELECT d.rate_date::text     AS day,
          d.exchange_rate::text AS official
     FROM daily_exchange_rates d
     JOIN currencies base   ON base.currency_id   = d.base_currency_id
     JOIN currencies target ON target.currency_id = d.target_currency_id
    WHERE base.currency_code   = $1
      AND target.currency_code = $2
      AND d.source             = $3
      AND d.rate_date BETWEEN $4::date AND $5::date
    ORDER BY d.rate_date`,
  [ACCOUNTING_CURRENCY_CODE, currency, officialSource, start, end],
 );

 // Every day the store holds an official row for, in order, each with what the
 // comparison concluded. The verdicts are kept rather than only the findings,
 // because the run logic below has to tell a healthy day from a day it could
 // not judge.
 const examined = [];
 const uncomparable = [];
 let compared = 0;

 for (const row of rows) {
  const official = Number(row.official);

  if (!Number.isFinite(official) || official <= 0) {
   uncomparable.push(row.day);
   examined.push({ day: row.day, verdict: 'unknown' });
   continue;
  }

  let independent;

  try {
   const payload = await fetchRatesForDate(ACCOUNTING_CURRENCY_CODE, row.day);
   independent = payload.rates[currency]?.rate;
  } catch {
   // A day the CDN has no snapshot for. Not a finding either way: it is a day
   // with no second opinion, and it is counted as such rather than passed over.
   independent = undefined;
  }

  if (!Number.isFinite(independent) || independent <= 0) {
   uncomparable.push(row.day);
   examined.push({ day: row.day, verdict: 'unknown' });
   continue;
  }

  compared += 1;

  const gapPct = ((independent - official) / official) * 100;

  if (gapPct > signalPct) {
   examined.push({
    day: row.day,
    verdict: 'candidate',
    finding: {
     day: row.day,
     official: row.official,
     independent: String(independent),
     gapPct,
     runLength: 0,
    },
   });
  } else {
   examined.push({ day: row.day, verdict: 'healthy' });
  }
 }

 // A stall is a run of days, not a day. What breaks a run is a day that was
 // compared and came back healthy -- proof the source was moving again. A day
 // with no row and a day with no second opinion prove nothing either way, so
 // they leave an open run open; otherwise a hole in the middle of a stall would
 // split it into two runs too short to report.
 const runs = [];
 let open = null;

 for (const entry of examined) {
  if (entry.verdict === 'candidate') {
   if (!open) {
    open = [];
    runs.push(open);
   }
   open.push(entry.finding);
  } else if (entry.verdict === 'healthy') {
   open = null;
  }
 }

 const flagged = [];

 for (const run of runs) {
  if (run.length < minRunDays) continue;

  run.forEach((finding, index) => {
   flagged.push({ ...finding, runLength: index + 1 });
  });
 }

 return { flagged, compared, uncomparable };
}

/**
 * Run the scan and write what it found to the log.
 *
 * Separate from the function above so a caller can have the findings without
 * the output, and so the log wording lives in one place instead of at every
 * call site.
 *
 * @param {Object} [args] - Passed through to detectStalledOfficialRates.
 * @returns {Promise<StalledDay[]>}
 */
export async function reportStalledOfficialRates(args = {}) {
 const currency = args.currency ?? OFFICIAL_BCV_CURRENCY;

 let result;

 try {
  result = await detectStalledOfficialRates(args);
 } catch (error) {
  // A diagnostic that can bring down whatever called it is worse than no
  // diagnostic. It reports its own failure and returns nothing found.
  console.warn(pc.yellow(`Stall scan for ${currency} could not run: ${error.message}`));
  return [];
 }

 const { flagged, compared, uncomparable } = result;

 // The coverage line comes first and is printed on every run, clean or not. A
 // scan that compared nothing has found nothing, and those are not the same
 // thing: without this line the second reads as the first.
 console.log(
  pc.cyan(
   `Stall scan ${currency}: ${compared} day(s) compared against ` +
    `${FALLBACK_RATE_SOURCE}, ${uncomparable.length} with no second opinion.`,
  ),
 );

 if (uncomparable.length > 0) {
  console.log(pc.cyan(`  not compared: ${uncomparable.join(' ')}`));
 }

 if (flagged.length === 0) {
  console.log(pc.cyan('  nothing looks stalled.'));
  return flagged;
 }

 const longest = flagged.reduce((a, b) => (b.runLength > a.runLength ? b : a));

 console.warn(
  pc.yellow(
   `  ${flagged.length} day(s) where the independent source sits above the ` +
    `official one, longest run ${longest.runLength}.`,
  ),
 );

 for (const day of flagged) {
  console.warn(
   pc.yellow(
    `  ${day.day}  official ${day.official}  independent ${day.independent}  ` +
     `+${day.gapPct.toFixed(2)}%`,
   ),
  );
 }

 return flagged;
}

// Run by hand: npm run fx:stall-scan -- [currency] [from] [to]
//
// A command rather than a boot step. Hanging it off the server's start would put
// a query and its output in front of every restart to answer a question that
// changes at most once a day, and would make the scan's failure a boot concern.
// It is called explicitly, and its findings are read by a person.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const [currency, from, to] = process.argv.slice(2);

 await reportStalledOfficialRates({
  ...(currency ? { currency } : {}),
  ...(from ? { from } : {}),
  ...(to ? { to } : {}),
 });

 await pool.end();
}
