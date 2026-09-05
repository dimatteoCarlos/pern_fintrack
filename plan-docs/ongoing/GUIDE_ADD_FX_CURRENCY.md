# Adding a foreign currency for FX conversion

Written 2026-09-05, measured against `main`. Every file, symbol and line named
below was read, not inferred. The application supports five currencies today —
`usd`, `eur`, `cop`, `ves` and `mxn` — and this document lists every place a
sixth has to be declared, naming the actual identifiers to edit, in the order the
work has to happen.

**Read this first.** Adding a currency is one row in `currencies`, one entry in
`SUPPORTED_CURRENCIES` on the server, one entry in `fixedRates`, and four
declarations in the client. Exactly one of them is irreversible.

**The architectural fact that makes this cheap.** No table that holds money knows
which currencies exist. Every stored amount carries the same six-column audit
pair — `original_amount`, `original_currency_id`, `exchange_rate`,
`exchange_rate_source`, `exchange_rate_timestamp` and
`exchange_rate_target_currency_id` — and every currency column in it is a foreign
key to `currencies(currency_id)`. So a new currency needs no schema change to
`transactions`, `pockets`, `pocket_allocations`, the budget allocations or the
debtor values. It needs a row they can point at.

---

## Step 1 — The row in `currencies`

**File:** a new migration under `backend/src/db/migrations/sql_migrations/`,
numbered after the highest existing one.

`currencies` was created by `001_initial_migration.sql` with three columns:
`currency_id`, `currency_code` (three lowercase letters, `UNIQUE`) and
`currency_name`.

**`currency_id` is not a sequence.** It is declared `INT PRIMARY KEY` with no
`SERIAL`, so every id was assigned by hand in `005_base_catalogs.sql`: `1` is
`usd`, `2` is `eur`, `3` is `cop`, `4` is `ves`, `5` is `mxn`. **The next id is
`6`**, and the migration must write it explicitly.

Write `currency_name` in the English style `028_align_currency_names.sql`
imposed — `US Dollar`, `Colombian Peso`, `Venezuelan Bolívar` — not the
abbreviated Spanish forms the original seed used and that migration corrected.
The column was widened by `027_widen_currency_name.sql`; check its current width
before writing a long name.

**The UP** is one `INSERT INTO currencies (currency_id, currency_code,
currency_name)`. Make it idempotent in the same shape
`008_update_currencies.sql` uses, so a re-run is a no-op rather than a unique
violation on `currency_code`.

**The DOWN deletes that row, and this is the part to think about before writing
it.** The foreign keys pointing at `currencies(currency_id)` are not uniform:

| Referencing column | On delete | What a rollback does |
|---|---|---|
| `currency_id`, `original_currency_id` and `exchange_rate_target_currency_id` on every money table | `RESTRICT` | fails loudly — correct |
| `base_currency_id` and `target_currency_id` on `exchange_rates`, `daily_exchange_rates` | `RESTRICT` | fails loudly — correct |
| **`users.currency_id`** | **`SET NULL`** | **succeeds, and silently blanks the accounting currency of every user who adopted it** |

So the rollback is safe only while no user has selected the new currency. Once
one has and has recorded a movement, the money tables refuse the delete — but a
user who selected it and recorded nothing has their `currency_id` nulled without
a word. Say this in the migration's own comment.

**What you do NOT touch here.** `backend/src/db/run_time_db_init/createTables.js`
and `backend/src/db/migrations/schemaParity.js` describe the *columns* of
`currencies` — `schemaParity.js` lists them literally as `['currency_id',
'currency_code', 'currency_name']`. A new row changes no column, so neither file
is in scope. They matter only if a future change adds a column, and then both
must move together or the parity check fails.

---

## Step 2 — `SUPPORTED_CURRENCIES`, the constant that unlocks eleven consumers

**File:** `backend/src/fintrack_api/services/fx_services/core/fxConfig.js`,
line 37.

```js
export const SUPPORTED_CURRENCIES = ['usd', 'eur', 'cop', 'ves', 'mxn'];
```

The single highest-value edit in the procedure. Eleven call sites read it:

| Consumer | What it does with it |
|---|---|
| `fxProviderOrchestrator.js:58` | default `supportedCurrencies` argument of `fetchRatesFromProviders` |
| `fxService.js:61-62` | chooses the set to fetch, filtering out `fxState.baseCurrency` |
| `fxService.js:100` | the set handed to `getAllRatesFromDB` |
| `fxService.js:141` | the set handed to `fetchRatesFromProviders` |
| `historicalRateResolver.js:202` | **a guard** — a code absent from the list is refused before any provider is consulted |
| `warmRecentRates.js:115,119` | primes recent rates, and checks whether `OFFICIAL_TRM_CURRENCY` is in the set |
| `budgetValidators.js:144-145` | the `.refine()` on the request schema, whose error message prints the allowed set |
| `pocketValidators.js:40-41` | the same `.refine()` for pocket requests |

Those last two are why this constant, not the database row, is what makes the
currency real to the application: the row lets amounts reference it, this
constant lets a request name it.

**A naming hazard to know about, not to fix.** `bancaDItaliaProvider.js:113`
declares its own module-scoped `SUPPORTED_CURRENCIES`, listing the four
currencies that provider covers, and guards on it at lines 248 and 361. It is
not a second global list and must not be edited to match. Leave it unless that
provider actually covers the new currency.

---

## Step 3 — Rate sourcing, which decides whether it works at all

Steps 1 and 2 make the currency legal. This one makes it convertible.

**The good news is architectural.** `fetchRatesFromProviders` in
`fxProviderOrchestrator.js` walks the `PROVIDERS` array in priority order and
after each one keeps only the currencies still in `missing`. There is no
per-currency branching anywhere in it. So a new currency needs **no new routing
code** as long as some provider returns it.

The cascade in `PROVIDERS`: `banrepTrmProvider` → `cotizaveApiProvider` →
`exchangeRateApiProvider` → `freeCurrencyApiProvider` → `githubFallbackProvider`
→ `getFallbackRate`. The first two are single-currency official sources and are
irrelevant to a new currency. The two aggregators in the middle are what will
serve it, and whether they do is empirical — test it, do not assume it.

**The one mandatory code change here** is `fixedRates`, exported from
`backend/src/fintrack_api/services/fx_services/fxProviders/getFallbackRate.js`:

```js
export const fixedRates = {
 usd: 1,
 eur: 0.9,
 cop: 3500,
 ves: 820,
 mxn: 17,
};
```

Without an entry the last-resort provider cannot answer, and every provider above
it is a network call that can fail. Add an approximate rate against the dollar.
It is a floor, not a figure anyone trades on.

**What stays untouched.** `OFFICIAL_TRM_CURRENCY` (`'cop'`) and
`OFFICIAL_BCV_CURRENCY` (`'ves'`), with `BCV_RATE_SOURCE` and
`FALLBACK_RATE_SOURCE` beside them in `fxConfig.js`, name currencies that have a
national publisher issuing a daily series. A new currency without one inherits
the shared business-day calendar the TRM source establishes for every other
currency. Do not add a calendar; there is one and it is shared deliberately.

---

## Step 4 — Restart the backend, and know why

`loadCurrencyCatalog()` in
`backend/src/fintrack_api/services/fx_services/currency_catalog/loadCurrencyCatalog.js`
reads all of `currencies` **once at startup** into two maps behind
`getCurrencyIdSync` and `getCurrencyCodeSync`. Nothing invalidates it on a write.

`getCurrencyId` in `backend/src/utils/currencyLookup.js` degrades rather than
breaks: on a catalog miss it logs `Currency <code> not in catalog … Falling back
to DB` and queries. So a forgotten restart produces no error — it produces a
warning per lookup and a query per conversion. A performance defect that hides
as a log line.

---

## Step 5 — The client, four declarations

Start with the type. It is the gate, and TypeScript points at part of the rest.

| # | File and symbol | Compiler-enforced? |
|---|---|---|
| 1 | `frontend/src/fintrack/types/types.ts:214` — the `CurrencyType` union | — do this first |
| 2 | `frontend/src/fintrack/helpers/currencyConstants.ts` — `SUPPORTED_CURRENCIES` | no |
| 3 | same file — `CURRENCY_OPTIONS`, the code-to-locale map | **yes**, it is a `Record<CurrencyType, string>` and the build fails without the key |
| 4 | same file — `CURRENCY_CYCLE`, the badge toggle order | **no** — it is `CurrencyType[]`, so a missing entry compiles and the toggle silently skips the currency |
| 5 | `frontend/src/fintrack/helpers/functions.ts` — `validCurrencyCodes`, **uppercase** ISO codes read by `isValidCurrencyCode` | no |

Entry 4 is the trap in this step: it is the one list a missing entry does not
announce.

**What follows automatically.** `SELECT_CURRENCY_OPTIONS` is generated by
mapping `SUPPORTED_CURRENCIES` through `Intl.DisplayNames`, so every dropdown
that consumes it gains the currency with no edit. `normalizeCurrency` in
`profileTransformation.ts` validates against `SUPPORTED_CURRENCIES`, so profile
normalisation follows too. Currency symbols need no work at all:
`getCurrencySymbol` in `functions.ts` derives them from `Intl.NumberFormat` with
narrow-symbol lookup and an ISO fallback.

**Where these constants live.** `constants.ts` re-exports `currencyConstants.ts`
wholesale with `export * from './currencyConstants'`, so a consumer may import
either path and gets the same binding. Do not declare a currency constant in
`constants.ts`: a local export wins over a star re-export, so a redeclaration
does not raise a conflict — it splits the application in two, half reading each
copy. That is defect 5 below, and it was live.

---

## The five defects found while writing this guide — all fixed 2026-09-05

None was introduced by adding a currency. All of them would have made adding one
worse, which is why they were repaired first.

**1. `normalizeCurrency` accepted three of five currencies.**
`profileTransformation.ts:218` held `const validCurrencies: CurrencyType[] =
['usd', 'eur', 'cop']`. An owner whose currency was `ves` or `mxn` had it
silently rewritten to `DEFAULT_CURRENCY` every time a profile passed through.
*Fixed:* validates against `SUPPORTED_CURRENCIES`.

**2. The profile dropdown offered the same three.**
`UpdateProfileContainer.tsx:85` hardcoded `currencyOptions` with `usd`, `eur` and
`cop`, ignoring the generated `SELECT_CURRENCY_OPTIONS` entirely — which had no
consumer anywhere in the codebase. *Fixed:* `currencyOptions` is now
`SELECT_CURRENCY_OPTIONS`, so this file leaves the procedure permanently.

**3. A malformed locale.** `CURRENCY_OPTIONS` mapped `cop` to `'cop-CO'`, a
language subtag filled with a currency code, so the formatter fell back instead
of formatting as the map said. *Fixed:* `'es-CO'`.

**4. A stale pointer.** The header of `currencyConstants.ts` told the reader to
keep the list matching `backend/src/fintrack_api/config/constants.js`, a file
that does not exist — the only file in that folder is `fintrackConfig.js`.
*Fixed:* it now names `fxConfig.js` and says why that list governs.

**5. The one that mattered most, and was invisible.** `constants.ts` re-exported
`currencyConstants.ts` at line 46 and then **redeclared four of its five
exports** — `CURRENCY_CYCLE`, `CURRENCY_OPTIONS`, `SELECT_CURRENCY_OPTIONS` and
`DEFAULT_CURRENCY`. A local export takes precedence over a star re-export, so
this raised no error: consumers importing from `constants` got one copy and the
seven files importing `currencyConstants` directly got the other. The copies
disagreed — `CURRENCY_CYCLE` in a different order, and `DEFAULT_CURRENCY` reading
`VITE_ACCOUNTING_CURRENCY_CODE` in one and hardcoding `'usd'` in the other. With
`CURRENCY_OPTIONS` consumed by twenty-two components, fixing the `cop` locale in
one copy alone would have left half the application formatting Colombian pesos
one way and half the other. *Fixed:* `currencyConstants.ts` is the single home
and holds the live implementations; `constants.ts` keeps only the re-export, with
a comment saying why nothing may be declared under it.

Verified with `tsc --noEmit`: clean, exit code 0.

---

## Order of work

| # | Step | Reversible | Blocks |
|---|---|---|---|
| 1 | Migration inserting the `currencies` row | **no** | everything |
| 2 | Add the code to `SUPPORTED_CURRENCIES` in `fxConfig.js` | yes | steps 3-5 |
| 3 | Add the entry to `fixedRates` in `getFallbackRate.js` | yes | conversion when providers fail |
| 4 | Restart the backend so `loadCurrencyCatalog()` re-reads | yes | catalog performance |
| 5 | Widen `CurrencyType`, then the four client lists | yes | user-facing selection |
| 6 | Confirm a real rate arrives from an aggregator | — | the whole feature |

**Step 6 is the acceptance test, not a formality.** Steps 1 through 5 make the
application willing to accept the currency. Only a rate actually arriving makes
it usable, and nothing in the code guarantees an aggregator covers a given code.
Confirm it before declaring the work done.
