# Adding and removing a foreign currency for FX conversion

Written 2026-09-05, measured against `main` and then exercised the same day by
adding the Japanese yen — the worked example at the foot of this document. Every
file, symbol and line named below was read, not inferred. The application
supports six currencies today: `usd`, `eur`, `cop`, `ves`, `mxn` and `jpy`.

**Read this first.** Adding a currency is one row in `currencies` written twice —
once in a migration and once in the boot seed — one entry in
`SUPPORTED_CURRENCIES` on the server, one entry in `fixedRates`, four
declarations in the client, and one conditional entry in the Banca d'Italia
provider that decides whether back-dated movements work. Exactly one of them is
irreversible.

**Corrected 2026-09-06**, after the yen shipped able to price today and unable to
price any past day. The conditional entry is step 3b and it was missing.

**Extended 2026-09-06** with the removal path, at the foot of this document.
`backend/scripts/removeCurrency.js` is the counterpart of the add script and it is
not the add run backwards: the keys that hold a currency in place are not uniform,
and two of them blank an owner's setting instead of failing.

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

**The boot path seeds the same rows, and moves in the same commit.**
`tblCurrencies` in `backend/src/db/run_time_db_init/populateDB.js:114-133` holds
the catalog as a `currenciesValues` array and writes it when the database is
built at runtime instead of through the migration chain. Add the currency there
too, with the same id and the same name.

**And `npm run db:parity` catches it if you forget.** `schemaParity.js:45-46`
names `currencies` in `SEEDED_CATALOGS` with all three of its columns, and the
check builds a database by each path and compares the *rows*, not only the
schema. So a missing boot seed fails the check rather than reporting green.

Do not take the opposite claim in `028_align_currency_names.sql`'s comment as
current — it says the parity check cannot see row divergence, which was true when
that migration was written and has since stopped being true. It stands as the
historical record of why 028 exists.

**What you do NOT touch here.** `backend/src/db/run_time_db_init/createTables.js`
and `schemaParity.js` itself. `SEEDED_CATALOGS` names the *columns* to compare,
literally `['currency_id', 'currency_code', 'currency_name']`, and a new row
changes no column. Both files matter only if a future change adds a column to
`currencies`, and then they move together or the parity check fails.

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

**The profile validator now reads it too, and did not until 2026-09-05.**
`currencySchema` in `backend/src/validation/zod/userSchemas.js` held its own
`z.enum` of five codes, with the list written a second time inside its error
message. The profile is the one place an owner chooses a currency at all, so a
currency added everywhere else was still refused at the only endpoint that sets
it. It was rewritten to the `.refine()` shape `budgetValidators.js` and
`pocketValidators.js` already use, so the file leaves this procedure
permanently. Nothing to edit there when adding a currency — verify it, do not
change it.

**A second list with the same name, which is a question to answer and not a
hazard to avoid.** `bancaDItaliaProvider.js:113` declares its own module-scoped
`SUPPORTED_CURRENCIES` naming the currencies that provider covers, and guards on
it at lines 248 and 361. It is not a second global list, so it is never edited
to *match* the global one. But it is not to be left alone either: whether that
provider covers the new currency decides whether back-dated movements work at
all, and that question is answered in step 3b, not skipped.

> **Corrected 2026-09-06.** This paragraph used to read "a naming hazard to know
> about, not to fix … must not be edited to match", with the condition tucked
> into a closing sentence. It was followed as a prohibition: the yen was added on
> 2026-09-05 without anyone asking whether Banca d'Italia publishes it — it does —
> so every back-dated conversion in yen returned a 422 until 2026-09-06. The
> instruction now names the check instead of naming the trap.

---

## Step 3 — Rate sourcing, which decides whether it works at all

Steps 1 and 2 make the currency legal. This one makes it convertible — and
"convertible" is two questions, not one. **Today's rate and a past day's rate
come from different code and different sources.** Step 3a covers the first, step
3b the second. A currency that passes 3a and fails 3b works in every screen that
shows a current figure and refuses every movement dated before today.

### Step 3a — Today's rate: the live cascade

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

### Step 3b — A past day's rate: Banca d'Italia, and it is not in that cascade

**The cascade above answers "what is it worth today". It cannot answer "what was
it worth on a given day".** That second question belongs to
`historicalRateResolver.js`, which is what a back-dated movement travels, and it
reaches exactly one source: `fetchBancaDItaliaRange`, imported at
`historicalRateResolver.js:46` and called at `:365`. Banca d'Italia appears
nowhere in `PROVIDERS`, and nothing else in the code serves a past day.

So the module-scoped list at `bancaDItaliaProvider.js:113` is not decoration. If
the new code is not in it, both guards — `:248` for one day, `:361` for a span —
throw before a request is made, the resolver has no other arm to try, and the
request ends in a **422**. The currency will look perfectly healthy everywhere a
current figure is rendered.

**The check, and it is empirical exactly like the aggregators in 3a.** Ask the
daily rates endpoint for the code and read what comes back:

```
https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0/dailyRates
  ?referenceDate=<a recent weekday>&baseCurrencyIsoCode=<CODE>&currencyIsoCode=USD&lang=en
```

**A row is not a rate.** The source answers for currencies it lists but does not
price — the North Korean won returns a row whose `avgRate` is the string `N.A.`
— so accept it only on the three conditions `fetchOneDay` itself applies at
`:199-212`: the `rates` array is non-empty, `exchangeConventionCode` is `C`, and
`Number(avgRate)` is finite and positive. An empty array means the market was
closed that day; step back a day and ask again, up to five times, which is what
the provider does.

**If it answers**, add the code to that array and back-dating works. **If it does
not**, leave the array alone: an entry there is a claim about coverage, and a
false one turns a clean 422 into a throw from inside the provider. Record that
the currency is live-only.

`addCurrency.js` performs this check and writes the entry only when the source
answers, so following the script is following this step.

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

## The script that does steps 1 to 6

`backend/scripts/addCurrency.js` applies every edit this guide describes:

```
node scripts/addCurrency.js <code> <locale>
node scripts/addCurrency.js jpy ja-JP --dry-run
```

Read the rest of this document anyway. The script performs the procedure; it
does not replace understanding what it touched, and two of its refusals only
make sense against the defects recorded below.

**It is all-or-nothing.** Every one of the seven anchors is located and verified
before a single byte is written. If a file was reformatted and an anchor no
longer resolves, the run aborts having written nothing and names the file. A
half-applied currency — one the API accepts and the client cannot name — is the
one outcome worse than not running it.

**The declaration check runs before anything else.** A currency already present
in `populateDB.js`, `fxConfig.js`, `getFallbackRate.js`, `types.ts` or
`currencyConstants.ts` is refused by name, with the files listed, before a single
request leaves the machine. It is the cheapest check and the only one that needs
no network, so it goes first.

**The acceptance test runs next, not last.** This guide puts confirming a real
rate at the end. That is the wrong order for a script: a currency no provider
serves cannot be converted, so the cascade is asked *before* anything is
written, and its answer seeds the `fixedRates` floor. Pass `--rate` to override
it, or `--offline --rate N` to skip the network entirely.

**There are two rate checks, because there are two questions.** After the live
cascade, the script asks Banca d'Italia whether it publishes the currency on past
days — step 3b — applying the same three conditions `fetchOneDay` applies, so a
listed-but-unpriced currency is a no. The eighth edit,
`bancaDItaliaProvider.js:113`, is written **only when that source answers**. When
it does not, the script says so and says what it costs: back-dated movements in
that currency fall through to a 422. When the host cannot be reached the answer
is neither yes nor no, and it says that too rather than guessing.

**It refuses a malformed locale.** `Intl` never throws on one — it falls back
silently, which is how `'cop-CO'` survived. The script asks the formatter which
locale it actually resolved to and compares the language subtag, so the defect
cannot be reintroduced by a typo.

**Two regression guards.** Before writing, it checks that `currencySchema` has
not gone back to a hardcoded `z.enum`, and that `constants.ts` has not started
redeclaring a currency constant under its own star re-export. Both are defects
that were live and neither announced itself.

**What it deliberately leaves to a human:** the position in `CURRENCY_CYCLE`
(that order is a judgement about which currencies sit next to each other),
applying the migration, restarting the backend, and the typecheck. It runs no
git command and never touches the database.

---

## Order of work

| # | Step | Reversible | Blocks |
|---|---|---|---|
| 1 | Migration inserting the `currencies` row | **no** | everything |
| 2 | Add the same row to `tblCurrencies` in `populateDB.js` | yes | the boot build path only |
| 3 | Add the code to `SUPPORTED_CURRENCIES` in `fxConfig.js` | yes | steps 4-6 |
| 4 | Add the entry to `fixedRates` in `getFallbackRate.js` | yes | conversion when providers fail |
| 5 | Restart the backend so `loadCurrencyCatalog()` re-reads | yes | catalog performance |
| 6 | Widen `CurrencyType`, then the four client lists | yes | user-facing selection |
| 7 | Confirm a real rate arrives from an aggregator | — | the whole feature |

**The last step is the acceptance test, not a formality.** Steps 1 through 6 make
the application willing to accept the currency. Only a rate actually arriving
makes it usable, and nothing in the code guarantees an aggregator covers a given
code. Confirm it before declaring the work done.

---

## Worked example — the Japanese yen, added 2026-09-05

Run against `main`. Seven files, and the two the guide was missing are the two
this exercise found.

| Step | File | What was written |
|---|---|---|
| 1 | `030_add_jpy_currency.sql` | `currency_id` 6, `'jpy'`, `'Japanese Yen'` |
| 2 | `populateDB.js:135` | the same row in `currenciesValues` |
| 3 | `fxConfig.js:40` | `'jpy'` appended to `SUPPORTED_CURRENCIES` |
| 4 | `getFallbackRate.js` | `jpy: 156` in `fixedRates` |
| 6 | `types.ts:214` | `'jpy'` added to the `CurrencyType` union |
| 6 | `currencyConstants.ts` | `SUPPORTED_CURRENCIES`, `CURRENCY_CYCLE`, and `CURRENCY_OPTIONS` mapping `jpy` to `'ja-JP'` |
| 6 | `functions.ts:205` | `'JPY'` moved out of the commented block into `validCurrencyCodes` |
| — | `userSchemas.js` | **not edited** — rewritten to derive from `SUPPORTED_CURRENCIES`, so it never needs editing again |

**The acceptance test passed.** `fetchRatesFromProviders('usd', [...,'jpy'])`
returned `156.2340721` from `githubFallbackProvider`, the fifth entry in the
cascade, with no new routing code. The three keyed aggregators above it declined
for want of an API key in this environment, which is exactly the condition the
cascade exists to survive — and it is also why `fixedRates` matters: had the
GitHub provider been down too, the entry added in step 4 would have been the only
answer.

**And the acceptance test that did not exist yet failed, silently, for a day.**
The table above is missing the entry this guide now calls step 3b:
`bancaDItaliaProvider.js:113` was never touched, so `historicalRateResolver.js`
refused every yen rate for a past day and every back-dated movement in yen ended
in a 422 — while the live figure above kept resolving perfectly. Measured at boot
the next morning: `cop 37/37, eur 37/37, ves 37/37, mxn 37/37, jpy 30/37`. The
line was added on 2026-09-06 in `0b602095` after asking the source directly, and
it does publish the yen: 156.2468 per dollar, effective 2026-09-04, against a
Colombian peso control of 3143.51. **Seven files were right and the eighth was
the one a user would notice.**

The same measurement after the fix, on the next boot, closes the loop:
`cop 37/37, eur 37/37, ves 37/37, mxn 37/37, jpy 37/37`. **That count is the
cheapest acceptance test in this guide** — it appears in the boot log without
being asked for, and a new currency short of the others is step 3b failing.

**One thing the yen exposed that the other five currencies never could, now
settled.** JPY has no minor unit. `currencyFormat` pinned
`minimumFractionDigits` and `maximumFractionDigits` at `2` for every currency, so
a yen amount rendered as `1,234.00` — the figure right and the precision false.
The decision was taken the same day, in favour of honest precision, and is
described in the next section. **Nothing here is left to do when adding a
currency with an unusual minor unit: the formatters read it from the currency.**

---

## Decimals follow the currency — decided 2026-09-05

The question the yen forced: does a column of amounts keep one decimal count, or
does each currency print the precision it actually has? **Honest precision won.**

`currencyMinorUnit` in `frontend/src/fintrack/helpers/functions.ts` asks Intl how
many decimal places a currency has rather than holding a list. Two functions
consume it, and they are treated differently on purpose:

| Function | Rule | Why |
|---|---|---|
| `currencyFormat` | the count **is** the currency's minor unit | every caller is rendering money in a named currency |
| `numberFormatCurrency` | the minor unit is a **ceiling** on the `decimals` argument, applied only in the branch that has a currency | almost every caller passes `2` positionally, and a currency with no minor unit cannot carry it |

**Why a ceiling and not a replacement in the second.** That function also formats
things that are not money — an exchange rate at four decimal places, for
instance, in `TransactionDetailModal.tsx`. Those calls pass no currency and reach
the branch below, which is untouched. Clamping only downward means a caller can
still ask for fewer digits and never silently gains digits it did not request.

**What the old comment feared, and why it does not happen.** The fixed `2` was
justified on the grounds that a varying decimal count stops a column of amounts
adding up on screen. The count now varies by *currency*, not by row: every amount
in one currency renders identically, and a column mixing currencies was never
aligned to begin with.

**Measured after the change**, at 1234.5: the five two-decimal currencies render
exactly as before, the yen renders `￥1,235` instead of `¥1,234.00`, and a
four-decimal exchange rate still renders `3.126,0812`.

---

## Removing a currency

`backend/scripts/removeCurrency.js`, written 2026-09-06. The same declaration
sites, the same all-or-nothing posture, one migration written and not applied.

```
node scripts/removeCurrency.js <code>
node scripts/removeCurrency.js chf --dry-run
```

**Removal is not addition run backwards, and that asymmetry is the whole design.**
Before a currency exists nothing points at it, so the worst outcome of a
half-applied add is a code the client cannot name. Before one is removed a great
deal can point at it, and the foreign keys holding those rows are not uniform:

| the column | on | on delete | what a `DELETE` does |
|---|---|---|---|
| `currency_id`, `original_currency_id`, `exchange_rate_target_currency_id` | the money tables — transactions, pockets, allocations, budget, debtor values | `RESTRICT` | fails, and the runner rolls the whole file back |
| `base_currency_id`, `target_currency_id` | `exchange_rates`, `daily_exchange_rates`, `exchange_rate_query_coverage` | `RESTRICT` | fails, which is why the migration deletes those rows first |
| `users.currency_id`, `income_source_accounts.currency_id` | the owner's own settings | **`SET NULL`** | **succeeds, and silently blanks the accounting currency of every owner who chose the code** |

The third row is why this is a script and not a hand-written `DELETE`.
`confdeltype = 'n'` in `pg_constraint` is what identifies those keys, and nothing
in the application announces what they do.

**It is answered twice.** Once by a read-only census, before anything is written,
and once by a guard inside the generated migration — because the census counts
rows in one database and the migration may be applied to another.

**Three refusals, cheapest first.**

- **The accounting currency.** `ACCOUNTING_CURRENCY_CODE` is what every stored
  amount is converted into, and every conversion resolves its target through the
  catalog. Removing it does not degrade the application, it stops it. The check
  needs neither network nor database, so it goes first.
- **A code not declared in `populateDB.js`.** No catalog row to remove, and no
  `currency_id` to write a migration against.
- **Rows in a money table.** Each one is somebody's money or somebody's setting,
  and what to do with it is a decision rather than a cleanup — a migration of its
  own, before this one.

**The census discovers rather than lists.** It reads every foreign key to
`currencies` out of `pg_constraint` and counts rows per key, so a table added
after the script was written is still counted, and it prints each key's delete
rule so the silent ones are named on screen. It connects through the same
`getDbConfig()` the migration runner uses, and refuses a target naming `prod` or
`supabase` — the refusal `schemaParity.js:221` already makes. `--offline` skips
the census and says loudly what was therefore not confirmed.

**The stray sweep.** `backend/src` and `frontend/src` are read for the code in
quotes outside the declaration sites. Each hit is either a use that will break or
a comment that will lie. `sql_migrations/` is skipped on purpose: an applied
migration is the record of what was done on a date, not a live reference, and
rewriting one to drop a currency would falsify the record. `--ignore-strays`
writes anyway, once a human has read every line.

**The migration it writes**, `NNN_remove_<code>_currency.sql`, carries the guard
as a `DO $$ ... $$` block that finds the `SET NULL` keys at run time and raises
instead of blanking a row. Then it deletes the rate rows, then the `currencies`
row. The money tables are left to their `RESTRICT` keys deliberately: failing
loudly is the correct outcome and needs no help from the file. Its `DOWN` is
commented out and marked to be run by hand, like every reverse from `025` onward.

**Both build paths move together.** The migration deletes the catalog row from a
database built by the chain; the same run removes it from `populateDB.js`, which
is where a database built by `createTables.js` takes its catalog. `npm run
db:parity` compares the two.

**Comments leave with the entry that owns them.** The yen's three lines above
`fixedRates.jpy` and the four above `CURRENCY_OPTIONS.jpy` go with it; a comment
at the head of a list does not, because that one explains the list. The rule is
that a comment block is taken only when the line above it is another entry.

**What it deliberately leaves to a human:** reading the migration before applying
it, `npm run db:migrate`, `npm run db:parity`, the restart, and the client
typecheck. It writes to no database and runs no git command.

### Order of work — removal

| # | Step | Reversible | Note |
|---|---|---|---|
| 1 | Census: what points at the currency | — | read-only, and refuses production |
| 2 | The source edits and the migration file | yes | all-or-nothing, written in one run |
| 3 | `npm run db:migrate` | **partly** | the catalog row comes back; the rate rows do not |
| 4 | `npm run db:parity` | — | confirms the two build paths still agree |
| 5 | Restart the backend | yes | `loadCurrencyCatalog()` reads the catalog once at startup |
| 6 | `npx tsc --noEmit` from `frontend/` | — | `CurrencyType` is narrower, so every stale use is a compile error |

**Step 6 is the acceptance test, the way confirming a real rate is the acceptance
test of an addition.** The sweep guesses from quoted strings; the compiler does
not. Narrowing `CurrencyType` turns every remaining use of the code into an
error, and that is the point of narrowing it.

**The one thing the reverse cannot restore** is the deleted history in
`daily_exchange_rates`. The `DOWN` block restores the catalog row, and the source
edits are undone by re-running `addCurrency.js`, but past days' rates come back
only if a source still publishes them — and Banca d'Italia's historical arm is
the only one that answers for a past day at all (step 3b). A currency re-added
after its history was deleted is not the currency it was.
