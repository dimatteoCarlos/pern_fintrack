// backend/scripts/addCurrency.js
//
// Adds a currency to every place the application declares one, following
// plan-docs/ongoing/GUIDE_ADD_FX_CURRENCY.md. Seven files, one command.
//
//   node scripts/addCurrency.js <code> <locale> [options]
//   node scripts/addCurrency.js jpy ja-JP
//   node scripts/addCurrency.js chf de-CH --dry-run
//
// Options:
//   --dry-run          print every edit and write nothing
//   --name "..."       override the name; defaults to what Intl.DisplayNames
//                      returns, which is what the interface renders
//   --rate <number>    override the fixedRates floor instead of taking the
//                      live rate from the provider cascade
//   --offline          skip the provider cascade; requires --rate
//
// WHY THIS IS ALL-OR-NOTHING
//
// Every target is hand-formatted source, and the lists it edits are exactly the
// ones that drift -- that is what the guide documents. A script that applied
// four of seven edits and failed on the fifth would leave the application in a
// state no human intended and no check catches: a currency the API accepts and
// the client cannot name. So every anchor is located and verified up front, and
// nothing is written unless all of them resolved.
//
// WHY THE RATE CHECK RUNS FIRST
//
// The guide calls confirming a real rate the acceptance test and puts it last.
// That is the wrong order for a script. A currency no provider serves is not a
// currency this application can convert, so it is a precondition: the cascade is
// asked before anything is written, and its answer seeds the static floor.
//
// WHAT THIS SCRIPT DELIBERATELY DOES NOT DO
//
// It does not touch the database. It writes the migration; applying it stays
// npm run db:migrate, so a code-generation failure and a migration failure never
// arrive as one event. It runs no git command. It does not decide the position
// in CURRENCY_CYCLE -- that order is a judgement about which currencies sit next
// to each other, so the code is appended and the choice is left to a human.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const ROOT = path.resolve(BACKEND, '..');

const MIGRATIONS_DIR = path.join(
 BACKEND,
 'src/db/migrations/sql_migrations',
);

const FILES = {
 populateDB: path.join(BACKEND, 'src/db/run_time_db_init/populateDB.js'),
 fxConfig: path.join(
  BACKEND,
  'src/fintrack_api/services/fx_services/core/fxConfig.js',
 ),
 fallbackRate: path.join(
  BACKEND,
  'src/fintrack_api/services/fx_services/fxProviders/getFallbackRate.js',
 ),
 userSchemas: path.join(BACKEND, 'src/validation/zod/userSchemas.js'),
 types: path.join(ROOT, 'frontend/src/fintrack/types/types.ts'),
 currencyConstants: path.join(
  ROOT,
  'frontend/src/fintrack/helpers/currencyConstants.ts',
 ),
 constants: path.join(ROOT, 'frontend/src/fintrack/helpers/constants.ts'),
 functions: path.join(ROOT, 'frontend/src/fintrack/helpers/functions.ts'),
};

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
 const positional = [];
 const flags = { dryRun: false, offline: false, name: null, rate: null };

 for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--dry-run') {
   flags.dryRun = true;
  } else if (arg === '--offline') {
   flags.offline = true;
  } else if (arg === '--name') {
   flags.name = argv[++i];
  } else if (arg === '--rate') {
   flags.rate = Number(argv[++i]);
  } else if (arg.startsWith('--')) {
   fail(`Unknown option ${arg}. Run with no arguments for usage.`);
  } else {
   positional.push(arg);
  }
 }

 return { positional, flags };
}

function fail(message) {
 console.error(`\n  ABORTED. ${message}\n`);
 process.exit(1);
}

const USAGE = `
  node scripts/addCurrency.js <code> <locale> [--dry-run] [--name "..."] [--rate N] [--offline]

  <code>    three-letter ISO 4217 code, lowercase, e.g. jpy
  <locale>  the BCP 47 locale the currency is formatted under, e.g. ja-JP
            A LOCALE, not a country code glued to the currency: 'cop-CO' is
            not a locale and makes the formatter fall back silently.
`;

// ---------------------------------------------------------------------------
// Validation of the two arguments
// ---------------------------------------------------------------------------

// Rejects a code Intl does not recognise. DisplayNames returns the input
// unchanged for an unknown code, which is how a typo is caught before it
// reaches a migration file.
function resolveCurrencyName(code) {
 const upper = code.toUpperCase();
 const displayed = new Intl.DisplayNames(['en'], { type: 'currency' }).of(
  upper,
 );
 if (!displayed || displayed === upper) {
  return null;
 }
 return displayed;
}

// Catches the defect the Colombian peso carried for months. Intl never throws
// on a malformed locale, it falls back, so the only way to know the locale was
// honoured is to ask the formatter which one it actually resolved to and
// compare the language subtag.
function assertLocaleResolves(locale, code) {
 let resolved;
 try {
  resolved = new Intl.NumberFormat(locale, {
   style: 'currency',
   currency: code.toUpperCase(),
  }).resolvedOptions();
 } catch (error) {
  fail(`'${locale}' is not a usable locale: ${error.message}`);
 }

 const asked = locale.split('-')[0].toLowerCase();
 const got = resolved.locale.split('-')[0].toLowerCase();

 if (asked !== got) {
  fail(
   `'${locale}' does not resolve: Intl fell back to '${resolved.locale}'.\n` +
    `  A locale is a language subtag and optional region, like 'ja-JP' or\n` +
    `  'es-CO'. A currency code in the language position never resolves, and\n` +
    `  nothing throws when it does not -- amounts simply format under the\n` +
    `  wrong rules.`,
  );
 }

 return resolved;
}

// ---------------------------------------------------------------------------
// Anchors
//
// Each entry locates its insertion point and returns the rewritten file
// content. It returns null when the anchor is absent, which aborts the run
// before anything is written. Indentation is read off the anchor line rather
// than assumed, so each file keeps its own style.
// ---------------------------------------------------------------------------

function readFileOrFail(key) {
 const file = FILES[key];
 if (!fs.existsSync(file)) {
  fail(`${path.relative(ROOT, file)} does not exist. The layout moved.`);
 }
 return fs.readFileSync(file, 'utf8');
}

// Inserts a row after the last entry of the currenciesValues array.
function editPopulateDB(source, { code, name, id }) {
 const marker = 'const currenciesValues = [';
 const start = source.indexOf(marker);
 if (start === -1) return null;

 const end = source.indexOf('\n  ];', start);
 if (end === -1) return null;

 const block = source.slice(start, end);
 const entries = [...block.matchAll(/^([ \t]*)\{ *currency_id:.*\},$/gm)];
 if (entries.length === 0) return null;

 const last = entries[entries.length - 1];
 const indent = last[1];
 const insertAt = start + last.index + last[0].length;
 const row = `\n\n${indent}{ currency_id: ${id}, currency_code: '${code}', currency_name: '${name}' },`;

 return source.slice(0, insertAt) + row + source.slice(insertAt);
}

// Appends the code to the single-line SUPPORTED_CURRENCIES array.
function editFxConfig(source, { code }) {
 const pattern = /^(export const SUPPORTED_CURRENCIES = \[)(.*)(\];)$/m;
 const match = source.match(pattern);
 if (!match) return null;

 return source.replace(pattern, `$1$2, '${code}'$3`);
}

// Inserts the static floor after the last numeric entry of fixedRates. The
// block carries comments between entries, so the anchor is the last entry
// itself rather than the closing brace.
function editFallbackRate(source, { code, rate }) {
 const marker = 'export const fixedRates = {';
 const start = source.indexOf(marker);
 if (start === -1) return null;

 const end = source.indexOf('\n};', start);
 if (end === -1) return null;

 const block = source.slice(start, end);
 const entries = [...block.matchAll(/^([ \t]*)([a-z]{3}): *[\d.]+,$/gm)];
 if (entries.length === 0) return null;

 const last = entries[entries.length - 1];
 const indent = last[1];
 const insertAt = start + last.index + last[0].length;
 const comment =
  `\n${indent}// ${code.toUpperCase()} per dollar, from the provider cascade on ` +
  `${new Date().toISOString().slice(0, 10)}.\n${indent}// A floor for when every provider above this one has failed, not a\n${indent}// figure anyone trades on.`;

 return (
  source.slice(0, insertAt) +
  comment +
  `\n${indent}${code}: ${rate},` +
  source.slice(insertAt)
 );
}

// Widens the CurrencyType union.
function editTypes(source, { code }) {
 const pattern = /^(export type CurrencyType = )(.*)(;)$/m;
 const match = source.match(pattern);
 if (!match) return null;

 return source.replace(pattern, `$1$2 | '${code}'$3`);
}

// Three lists in one file: the supported set, the badge toggle order, and the
// locale map. All three are rewritten in one pass so a partial result is not
// possible within the file either.
function editCurrencyConstants(source, { code, locale }) {
 let next = source;

 for (const name of ['SUPPORTED_CURRENCIES', 'CURRENCY_CYCLE']) {
  const start = next.indexOf(`export const ${name}: CurrencyType[] = [`);
  if (start === -1) return null;

  const end = next.indexOf('\n];', start);
  if (end === -1) return null;

  const block = next.slice(start, end);
  const entries = [...block.matchAll(/^([ \t]*)'[a-z]{3}',$/gm)];
  if (entries.length === 0) return null;

  const last = entries[entries.length - 1];
  const insertAt = start + last.index + last[0].length;
  next =
   next.slice(0, insertAt) +
   `\n${last[1]}'${code}',` +
   next.slice(insertAt);
 }

 const optionsStart = next.indexOf(
  'export const CURRENCY_OPTIONS: Record<CurrencyType, string> = {',
 );
 if (optionsStart === -1) return null;

 const optionsEnd = next.indexOf('\n};', optionsStart);
 if (optionsEnd === -1) return null;

 const optionsBlock = next.slice(optionsStart, optionsEnd);
 const optionEntries = [...optionsBlock.matchAll(/^([ \t]*)[a-z]{3}: '.*',$/gm)];
 if (optionEntries.length === 0) return null;

 const lastOption = optionEntries[optionEntries.length - 1];
 const insertAt = optionsStart + lastOption.index + lastOption[0].length;

 return (
  next.slice(0, insertAt) +
  `\n${lastOption[1]}${code}: '${locale}',` +
  next.slice(insertAt)
 );
}

// Adds the uppercase code to validCurrencyCodes, after the last live entry and
// before the commented block of codes the application does not support.
function editFunctions(source, { code }) {
 const marker = 'const validCurrencyCodes = new Set([';
 const start = source.indexOf(marker);
 if (start === -1) return null;

 const end = source.indexOf('\n]);', start);
 if (end === -1) return null;

 const block = source.slice(start, end);
 const entries = [...block.matchAll(/^([ \t]*)'[A-Z]{3}',$/gm)];
 if (entries.length === 0) return null;

 const last = entries[entries.length - 1];
 const insertAt = start + last.index + last[0].length;

 return (
  source.slice(0, insertAt) +
  `\n${last[1]}'${code.toUpperCase()}',` +
  source.slice(insertAt)
 );
}

// ---------------------------------------------------------------------------
// Regression guards
//
// Two defects the guide records were invisible while they were live. Both are
// cheap to detect, and a currency being added is the moment they would bite.
// ---------------------------------------------------------------------------

function checkNoHardcodedCurrencyEnum(source) {
 if (/z\s*\.\s*enum\(\s*\[\s*'usd'/.test(source)) {
  return (
   'currencySchema in userSchemas.js has gone back to a hardcoded z.enum.\n' +
   '  The profile is the only endpoint where an owner chooses a currency, so a\n' +
   '  local list there refuses the new code no matter what the rest of the\n' +
   '  application accepts. Restore the .refine() over SUPPORTED_CURRENCIES.'
  );
 }
 return null;
}

function checkNoShadowedCurrencyConstants(source) {
 const shadowed = [
  'CURRENCY_CYCLE',
  'CURRENCY_OPTIONS',
  'SELECT_CURRENCY_OPTIONS',
  'DEFAULT_CURRENCY',
  'SUPPORTED_CURRENCIES',
 ].filter((name) =>
  new RegExp(`^export const ${name}\\b`, 'm').test(source),
 );

 if (shadowed.length > 0) {
  return (
   `constants.ts redeclares ${shadowed.join(', ')} under its own star\n` +
   '  re-export of currencyConstants.ts. A local export wins over a star\n' +
   '  re-export, so this raises no error -- it splits the application in two,\n' +
   '  half reading each copy. Remove the redeclaration before adding a currency.'
  );
 }
 return null;
}

// ---------------------------------------------------------------------------
// The migration file
// ---------------------------------------------------------------------------

function nextMigrationNumber() {
 const numbers = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => Number.parseInt(f.slice(0, 3), 10))
  .filter((n) => Number.isInteger(n));

 if (numbers.length === 0) {
  fail(`No numbered migrations found in ${MIGRATIONS_DIR}.`);
 }

 return String(Math.max(...numbers) + 1).padStart(3, '0');
}

// The id is read from the boot seed rather than from the database, because the
// two must agree and the seed is the copy this script also edits. currency_id
// is INT PRIMARY KEY with no SERIAL: every id in this catalog is assigned by
// hand, so the next one is computed, never generated.
function nextCurrencyId(populateSource) {
 const ids = [...populateSource.matchAll(/currency_id: *(\d+)/g)].map((m) =>
  Number(m[1]),
 );
 if (ids.length === 0) return null;
 return Math.max(...ids) + 1;
}

function migrationBody({ code, name, id, number, filename }) {
 const upper = code.toUpperCase();
 return `-- ${filename}
--
-- Adds the ${name.toLowerCase()} to the currency catalog as currency_id ${id}.
--
-- Written by scripts/addCurrency.js. Read it before running it: the DOWN is
-- the part that needs a decision, and it is at the foot of this file.
--
-- WHY A MIGRATION AND NOT A SCHEMA CHANGE
--
-- No table that holds money knows which currencies exist. Every stored amount
-- carries the same audit pair -- original_amount, original_currency_id,
-- exchange_rate, exchange_rate_source, exchange_rate_timestamp and
-- exchange_rate_target_currency_id -- and every currency column in it is a
-- foreign key to currencies(currency_id). A new currency therefore needs a row
-- those keys can point at, and nothing else.
--
-- WHY THE ID IS WRITTEN OUT
--
-- currency_id is declared INT PRIMARY KEY in 001_initial_migration.sql with no
-- SERIAL, so every id in this catalog was assigned by hand. ${id} is the next one
-- and it is stated here rather than generated.
--
-- THE NAME
--
-- '${name}' is what Intl.DisplayNames(['en'], { type: 'currency' }) returns for
-- ${upper}, which is the string the frontend renders in every dropdown and label.
-- 028_align_currency_names.sql established that the stored name is chosen to
-- match what the interface already displays, so the column and the screen
-- cannot contradict each other.
--
-- THE BOOT PATH MOVED IN THE SAME COMMIT
--
-- populateDB.js seeds these same rows when the database is built at runtime
-- instead of through this chain, and the script that wrote this file edited it
-- too. npm run db:parity compares the seeded rows of both paths, not only the
-- schema, so a divergence here fails the check rather than passing unnoticed.
--
-- ---------------------------------------------------------------------------
-- UP
-- ---------------------------------------------------------------------------
--
-- Idempotent in the shape 008_update_currencies.sql uses, so a re-run is a
-- no-op rather than a unique violation on currency_code.
INSERT INTO currencies (currency_id, currency_code, currency_name)
VALUES (${id}, '${code}', '${name}')
ON CONFLICT (currency_id) DO UPDATE SET
 currency_code = EXCLUDED.currency_code,
 currency_name = EXCLUDED.currency_name;

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
--
-- Run manually, and read this before running it. The foreign keys pointing at
-- currencies(currency_id) are NOT uniform:
--
--   currency_id, original_currency_id and exchange_rate_target_currency_id on
--   every money table, and base_currency_id / target_currency_id on
--   exchange_rates and daily_exchange_rates, are ON DELETE RESTRICT. They fail
--   loudly, which is the correct outcome.
--
--   users.currency_id is ON DELETE SET NULL. It does not fail. It silently
--   blanks the accounting currency of every user who selected this currency.
--
-- So the rollback is safe only while no user has adopted it. A user who
-- selected it and recorded a movement is protected by the money tables; a user
-- who selected it and recorded nothing is protected by nothing. Measure first:
--
--   SELECT user_id FROM users WHERE currency_id = ${id};
--
-- and restore those users by hand afterwards, or do not run this at all.
--
-- BEGIN;
-- DELETE FROM currencies WHERE currency_id = ${id};
-- DELETE FROM migrations WHERE filename = '${filename}';
-- COMMIT;
`;
}

// ---------------------------------------------------------------------------
// The acceptance test, run as a precondition
// ---------------------------------------------------------------------------

async function fetchLiveRate(code) {
 const orchestrator = await import(
  '../src/fintrack_api/services/fx_services/core/fxProviderOrchestrator.js'
 );

 const result = await orchestrator.fetchRatesFromProviders('usd', [
  'usd',
  code,
 ]);

 const entry = result?.rates?.[code];
 if (!entry) return null;

 const rate = typeof entry === 'number' ? entry : entry.rate;
 const source = typeof entry === 'number' ? 'unknown' : entry.source;

 return Number.isFinite(rate) && rate > 0 ? { rate, source } : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
 const { positional, flags } = parseArgs(process.argv.slice(2));

 if (positional.length !== 2) {
  console.log(USAGE);
  process.exit(positional.length === 0 ? 0 : 1);
 }

 const code = positional[0].toLowerCase();
 const locale = positional[1];

 if (!/^[a-z]{3}$/.test(code)) {
  fail(`'${positional[0]}' is not a three-letter currency code.`);
 }

 if (flags.offline && !Number.isFinite(flags.rate)) {
  fail('--offline needs --rate <number>: the static floor has no other source.');
 }

 const intlName = resolveCurrencyName(code);
 if (!intlName) {
  fail(
   `'${code.toUpperCase()}' is not a currency code Intl recognises.\n` +
    '  A code the browser cannot name is a code no label can render.',
  );
 }

 const name = flags.name || intlName;
 const resolved = assertLocaleResolves(locale, code);

 console.log(`\n  ${code.toUpperCase()} -- ${name}`);
 console.log(`  locale ${locale} resolves to ${resolved.locale}`);

 // -- Read everything and verify every anchor before writing anything --------

 const sources = Object.fromEntries(
  Object.keys(FILES).map((key) => [key, readFileOrFail(key)]),
 );

 const guards = [
  checkNoHardcodedCurrencyEnum(sources.userSchemas),
  checkNoShadowedCurrencyConstants(sources.constants),
 ].filter(Boolean);

 if (guards.length > 0) {
  fail(guards.join('\n\n  '));
 }

 const alreadyIn = Object.entries({
  'populateDB.js': sources.populateDB,
  'fxConfig.js': sources.fxConfig,
  'getFallbackRate.js': sources.fallbackRate,
  'types.ts': sources.types,
  'currencyConstants.ts': sources.currencyConstants,
 })
  // Quoted in every list, but bare before a colon in fixedRates and in the
  // locale map, so both spellings count as already declared.
  .filter(([, source]) =>
   new RegExp(`'${code}'|^\\s*${code}\\s*:`, 'm').test(source),
  )
  .map(([file]) => file);

 if (alreadyIn.length > 0) {
  fail(
   `'${code}' is already declared in ${alreadyIn.join(', ')}.\n` +
    '  Adding it again would duplicate a list entry. Nothing was written.',
  );
 }

 const id = nextCurrencyId(sources.populateDB);
 if (id === null) {
  fail('Could not read any currency_id from populateDB.js.');
 }

 const number = nextMigrationNumber();
 const filename = `${number}_add_${code}_currency.sql`;

 // -- The acceptance test, before any write ---------------------------------

 let rate = flags.rate;
 let rateSource = 'given with --rate';

 if (!flags.offline && !Number.isFinite(rate)) {
  console.log('\n  Asking the provider cascade for a live rate...');
  const live = await fetchLiveRate(code);

  if (!live) {
   fail(
    `no provider in the cascade returned a rate for '${code}'.\n` +
     '  This currency is not convertible, so declaring it would give the owner\n' +
     '  a code the application accepts and cannot price. Nothing was written.\n' +
     '  If you know the rate and want it anyway, pass --rate <number>.',
   );
  }

  rate = Math.round(live.rate * 100) / 100;
  rateSource = live.source;
 }

 console.log(`  rate ${rate} per USD (${rateSource})`);

 // -- Apply every edit in memory; a null anchor aborts the run --------------

 const edits = [
  ['populateDB', editPopulateDB(sources.populateDB, { code, name, id })],
  ['fxConfig', editFxConfig(sources.fxConfig, { code })],
  ['fallbackRate', editFallbackRate(sources.fallbackRate, { code, rate })],
  ['types', editTypes(sources.types, { code })],
  [
   'currencyConstants',
   editCurrencyConstants(sources.currencyConstants, { code, locale }),
  ],
  ['functions', editFunctions(sources.functions, { code })],
 ];

 const missing = edits.filter(([, result]) => result === null);
 if (missing.length > 0) {
  fail(
   `could not locate the anchor in: ${missing
    .map(([key]) => path.relative(ROOT, FILES[key]))
    .join(', ')}.\n` +
    '  The file was reformatted or the list moved. Nothing was written --\n' +
    '  apply this currency by hand, following GUIDE_ADD_FX_CURRENCY.md, and\n' +
    '  fix the anchor in this script afterwards.',
  );
 }

 const migrationPath = path.join(MIGRATIONS_DIR, filename);
 if (fs.existsSync(migrationPath)) {
  fail(`${filename} already exists. Nothing was written.`);
 }

 // -- Write ------------------------------------------------------------------

 console.log(`\n  currency_id ${id}, migration ${filename}\n`);

 if (flags.dryRun) {
  console.log('  --dry-run: nothing written. Would have changed:');
  console.log(`   + ${path.relative(ROOT, migrationPath)}`);
  for (const [key] of edits) {
   console.log(`   M ${path.relative(ROOT, FILES[key])}`);
  }
  console.log('');
  process.exit(0);
 }

 fs.writeFileSync(
  migrationPath,
  migrationBody({ code, name, id, number, filename }),
  'utf8',
 );
 console.log(`   + ${path.relative(ROOT, migrationPath)}`);

 for (const [key, content] of edits) {
  fs.writeFileSync(FILES[key], content, 'utf8');
  console.log(`   M ${path.relative(ROOT, FILES[key])}`);
 }

 // -- What the script cannot do for you --------------------------------------

 const minorUnit = resolved.maximumFractionDigits;

 console.log(`
  WHAT IS LEFT, AND NONE OF IT IS OPTIONAL

  1. Apply the migration:            npm run db:migrate
  2. Confirm both build paths agree: npm run db:parity
  3. Restart the backend. loadCurrencyCatalog() reads the catalog once at
     startup, and a stale catalog does not error -- it logs a warning and
     issues a database query per conversion instead.
  4. Typecheck the client:           npx tsc --noEmit   (from frontend/)

  DECISIONS THIS SCRIPT DID NOT MAKE FOR YOU

  CURRENCY_CYCLE. The code was appended. That list is the badge toggle order
  and it is deliberately not the order of SUPPORTED_CURRENCIES -- the two most
  used currencies sit next to each other so one tap moves between them. Move
  the new entry if it belongs elsewhere.`);

 if (minorUnit !== 2) {
  console.log(`
  DECIMALS. ${code.toUpperCase()} has ${minorUnit} decimal ${minorUnit === 1 ? 'place' : 'places'}, not 2. currencyFormat in
  frontend/src/fintrack/helpers/functions.ts pins minimumFractionDigits and
  maximumFractionDigits at 2 for every currency, so amounts in this currency
  render with a precision the currency does not have. The figure is right and
  the precision is false. This is a known open decision -- the fixed 2 keeps a
  column of amounts on one decimal count -- and it is recorded in
  plan-docs/ongoing/GUIDE_ADD_FX_CURRENCY.md. Settle it or accept it.`);
 }

 console.log(`
  Nothing was committed and nothing was pushed.
`);

 process.exit(0);
}

main().catch((error) => {
 fail(`unexpected failure: ${error.message}`);
});
