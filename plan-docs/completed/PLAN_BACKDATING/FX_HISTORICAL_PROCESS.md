# The historical FX process

What values a movement dated on a day that has already passed: every module it
touches, every function in them, what each one does and why it sits where it
does, from the provider request to the row in the ledger.

Verified against the working tree on 2026-09-03. Paths are repo-relative.

Companion documents. `FLOW_BACKDATED_MOVEMENT.md` walks the same feature from the
calendar glyph down and is the shorter read; this file is the FX engine itself.
`PLAN_BACKDATING.md` holds the plan and `PLAN_BACKDATING_EVIDENCE.md` the
measurements the decisions below cite.

---

## 0. What the subsystem answers, and the two rules it never breaks

One question: **what was one unit of the accounting currency worth in another
currency on a given past day**. Not what it is worth now, and not what it will
be worth.

The whole design follows from two invariants, both stated in the resolver's own
header and enforced in more than one place:

1. **No source may fabricate an effective date.** The day a rate belongs to
   always comes from the provider that supplied it. A day with no market is
   answered by the last day that had one, and the record names *that* day.
2. **A past movement is never valued at today's rate.** When no arm of the
   cascade answers, the request is refused with a 422 and nothing is written.
   Falling through to the live rate would silently record a figure no market
   quoted.

A third rule follows from the first two and governs the store: **a past rate is
a fact that does not change**, so every write is append-only
(`ON CONFLICT DO NOTHING`) and no time-to-live applies to anything here. The live
FX state has TTLs; the history has none, because a figure for August cannot go
stale.

---

## 1. File map

### The historical path

| file | role |
|---|---|
| `backend/src/fintrack_api/services/fx_services/conversion/currencyAmountConversion.js` | the only entry point. Routes to the live rate or to the cascade by whether the caller stated a day |
| `backend/src/fintrack_api/services/fx_services/core/historicalRateResolver.js` | the cascade: store, official sources, universal source, CDN, 422 |
| `backend/src/fintrack_api/services/fx_services/db/dailyRateDBaccess.js` | the store: reads and writes `daily_exchange_rates` and `exchange_rate_query_coverage` |
| `backend/src/fintrack_api/services/fx_services/core/fxConfig.js` | the currency list, the accounting currency and the provider names the store and the resolver must spell identically |
| `backend/src/fintrack_api/services/fx_services/core/warmRecentRates.js` | fills the store on boot for the window a back-dated movement can land in |
| `backend/src/fintrack_api/services/fx_services/core/detectStalledOfficialRates.js` | audits the official series against an independent one; not on any request path |

### The provider adapters

| file | serves | endpoint | shape |
|---|---|---|---|
| `fxProviders/banrepTrmProvider.js` | `cop`, official | datos.gov.co Socrata dataset `32sa-8pi3` | one row per **validity**, `vigenciadesde`..`vigenciahasta` |
| `fxProviders/bcvApiRafnixgProvider.js` | `ves`, official | `dolar-vzla.rafnixg.dev/api/v1/history/bcv` | a **polling log**, several scrapes per calendar day |
| `fxProviders/bancaDItaliaProvider.js` | `eur`, `mxn`, `ves`, and `cop` as fallback | `tassidicambio.bancaditalia.it`, `dailyTimeSeries` and `dailyRates` | one row per **published day**; silent on a closed day |
| `fxProviders/githubFallbackProvider.js` | every currency, last resort | `cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@<day>` | a **snapshot** of one day, all currencies at once |

### Where the result is consumed

| file | what it does with it |
|---|---|
| `backend/src/fintrack_api/controllers/currencyController.js` | `POST /api/fintrack/currency/convert`, the preview endpoint |
| `backend/src/fintrack_api/controllers/transactionController.js` | writes the movement and its FX metadata |
| `backend/src/fintrack_api/controllers/accountCreationController.js`, `accountCategoryCreationcontroller.js` | value an opening balance on the account's opening day |
| `backend/src/fintrack_api/services/pocket_services/services/pocketAllocationService.js` | values a pocket allocation on its own day |
| `backend/src/fintrack_api/services/budget_services/services/budgetAllocationService.js` | values a budget allocation on the month it belongs to |
| `frontend/src/fintrack/hooks/useServerCurrencyConversion.ts` | asks the server for the same figure the write path will produce |
| `frontend/src/fintrack/general_components/fxPathwayCard/FxPathwayCard.tsx` | renders the stored conversion back, rate and provenance included |

---

## 2. The path of one dated request

```
caller (controller / service / preview endpoint)
  │  amount, fromCurrency, toCurrency, asOfDate, timeZone
  ▼
currencyAmountConversion                  routes by asOfDate, never by comparing dates
  │  asOfDate === null ─────────────────▶  live path: ensureFXStateIsFresh + fxState
  ▼  asOfDate set
resolveHistoricalRate(currency, day)      once per currency the case needs
  │
  ├─ 1. guards        unsupported currency 400 · malformed day 400 · future day 422
  ├─ 2. identity      currency === accounting  ─▶  rate 1, no store, no network
  ├─ 3. findDailyRate                       ─▶  HIT ends it here
  ├─ 4. banrep    (cop only)   fetchTrmRange(span)            ─▶ store ─▶ re-read
  ├─ 5. bcv       (ves only)   fetchBcvRange(span)            ─▶ store ─▶ re-read
  ├─ 6. bancaditalia (all)     fetchBancaDItaliaRange(span)   ─▶ store ─▶ re-read
  ├─ 7. cdn                    fetchRatesForDate(one day)     ─▶ store ─▶ re-read
  └─ 8. nothing answered  ─▶  422 FX_RATE_UNAVAILABLE, the attempts logged
```

Every arm that reaches a provider **writes what it got and then re-reads the
answer out of the store**. That is deliberate: the resolution rule — the most
recent day not after the one asked for, inside the age bound, inside a covered
span — lives in one SQL statement, so the hit path and the miss path return the
same row. It costs one extra local round trip on a miss that has just paid for
an HTTP call.

The order of the arms is not a preference. A national central bank publishing
its own currency outranks a foreign central bank's cross, which outranks a CDN's
recomputation of one.

---

## 3. Function reference

### 3.1 The entry — `conversion/currencyAmountConversion.js`

| function | visibility | what it does |
|---|---|---|
| `currencyAmountConversion(amount, fromCurrency, toCurrency, asOfDate, timeZone)` | export | the only door. `asOfDate` null means now; a day means the cascade |
| `toCalendarDay(value)` | private | a `Date` or string to `'YYYY-MM-DD'`. Only the identity case needs it — every other path gets its day back from the source |
| `quoteFor(currency)` | closure | one currency's quote against the accounting currency, from whichever of the two sources this call is using |
| `reciprocalOf(rate)`, `composed(from, to)` | closures | the arithmetic. The dated path takes reciprocals in `Decimal`; the undated one keeps the float arithmetic it has always used, bit for bit, so no existing caller's figure moves |

**It does not decide whether a date is "today".** It has no timezone, and the
owner's day boundary settles that question, so the caller routes. A comparison
against the server's own today here would resolve a 20:00 movement at UTC-5
through the wrong path.

Three cases, and only the currencies a case needs are quoted:

- foreign → accounting: one quote, reciprocal.
- accounting → foreign: one quote, direct.
- foreign → foreign: two quotes, composed. When the two legs resolve to
  **different effective days**, the recorded source names both
  (`a@day+b@day`), because a cross valued from two days must not be recorded as
  if one day had supplied it.

What it returns, and why the shape carries both a rate and a quote:

| field | meaning |
|---|---|
| `amount` | a `Decimal`, the converted figure |
| `rate` | the conversion's own multiplier: `converted = amount * rate` |
| `quote` | `{ currency, rate }`, the market figure it was built from, in the direction every source publishes: 1 accounting unit = `quote.rate` of `quote.currency` |
| `source` | `provider@effectiveDate` on the dated path, the bare provider name on the live one |
| `fetchedAt` | when the rate was **read from the provider** — on the dated path that is when the store fetched it, not now |
| `effectiveDate` | the day that actually supplied the figure; `null` on the live path |

`rate` alone is not legible: a peso to a dollar gives 0.00031, which rounds to
zero in any display and reads as no rate at all, while the quote behind it is
3202.79. A client cannot derive one from the other either — a cross conversion's
rate is two quotes composed, so inverting it yields neither.

### 3.2 The cascade — `core/historicalRateResolver.js`

| function | visibility | what it does |
|---|---|---|
| `resolveHistoricalRate(currencyCode, requestedDate, options)` | export | the whole cascade. `options.budgetMs` caps it; `options.timeZone` decides which day is today |
| `toCalendarDay(value)` | private | normalises the requested date, rejecting anything that is not a calendar day |
| `spanAround(day, timeZone)` | private | the window a range provider is asked for |
| `asAnswer(hit, currency, requestedDate)` | private | a store row to the resolver's answer, `provenance` built as `source@rateDate` |
| `storeThenResolve(rows, span)` | closure | `persistQueriedRange` then `findDailyRate`, so the answer served now is the answer served next time |

**`spanAround` is the piece that decides how much history one call buys.** It
opens **five days before the first of the month** being valued and closes at
**today or the last day of that month, whichever comes first**:

- five days back, because a movement on the 1st of a month that fell on a
  Saturday would otherwise find nothing on or before it. Five is the same bound
  the store applies (`MAX_RATE_AGE_DAYS`), so the span always contains an answer
  if one exists.
- closing at today rather than at the day being valued costs the same round trip
  and the same handful of rows, and turns every later back-dated movement of that
  month into a store hit with no network at all.
- today is read on the **owner's** zone. In UTC it would run a day ahead for
  anyone west of Greenwich and ask a provider for a day that has not started.

**The budget.** `FX_HISTORICAL_BUDGET_MS` (5000 by default) is an absolute
deadline for the whole cascade, sized by what a form submit may hang for, not by
the sum of the arms. Each arm caps its own call at what is left of it
(`FX_REQUEST_TIMEOUT_MS`, 2000 by default). A cross conversion shares one
deadline across both currencies.

**The CDN arm is never asked for the requested day.** It is handed a day read out
of the store by `findLatestBusinessDay`, and `isDaySettled` decides whether the
call could write anything at all before it is made. Measured across
2026-05-14..18, this CDN invents movement on closed days — a Saturday and a
Sunday that move against the Friday and against each other, with the Monday
snapping back to the Friday to the fourth decimal. Asked for a day the market was
open it reports; asked for a closed day it fabricates.

**The 422 names what was tried.** Each arm pushes its failure onto an `attempts`
list, and the list goes to the log, not to the client: a client cannot act on
"bancaditalia: no published day" and should not have to read how the cascade is
built to learn that no rate exists.

### 3.3 The store — `db/dailyRateDBaccess.js`

| function | visibility | what it does |
|---|---|---|
| `findDailyRate(baseId, targetId, requestedDate, maxAgeDays)` | export | **resolution, not lookup**: the most recent row not after the requested day, inside the age bound, inside a covered span |
| `persistDailyRates(rateRows, baseId, targetId, client)` | export | one `INSERT ... UNNEST` for the whole range, `ON CONFLICT DO NOTHING`. Returns `{ stored, source }` |
| `recordQueryCoverage(client, span)` | export | merges the queried span into the stored ones, under an advisory lock |
| `persistQueriedRange({ rateRows, baseId, targetId, from, to })` | export | the two writes above **under one commit**. The only writer the resolver calls |
| `findLatestBusinessDay(requestedDate, maxAgeDays)` | export | the most recent day **any** source has published for, in any pair |
| `isDaySettled(baseId, targetId, day, source)` | export | whether asking that source for that day could still write anything |
| `toCalendarDay(value)` | private | this store speaks calendar days, never instants |
| `MAX_RATE_AGE_DAYS = 5` | export | how far back a stored row may be from the requested day |

**Why the age bound exists.** The lookup cannot tell a row missing because the
market was closed from a row missing because nothing was ever fetched. Without a
bound, an empty store would answer January with a rate from the previous year.
Five days clears the longest run of closed days a market produces and refuses
anything longer.

**Why coverage exists.** Walking back from the requested day to an older row
asserts that every day in between was absent from the provider — and that
assertion is only true if those days were ever asked for. Measured against the
Colombian peso with rows at 08-01, 08-07, 08-13, 08-15, 08-21 and 08-26, the
store answered 2026-08-20 with the 08-15 rate, 3128.65, against a true 3053.48:
2.46% high, inside the age bound, so nothing rejected it. The same walk gave
−3.78% on 08-30 and −2.67% on 08-04. Those figures go into a ledger and stay
there.

A coverage row asserts nothing about any rate. It says: *on `fetched_at`, this
installation asked `source` for `base`/`target` over `covered`, and got a
complete answer.* That is a fact about our own network traffic — it needs no
inference and cannot be wrong about the market. The rejected alternative, a
`valid_until` column on the rate, would have been *our* inference about the
provider's publication semantics written down as if the provider had said it.

**Coverage is matched on the row's own source.** Having queried one provider over
August proves nothing about another, which publishes on its own calendar.

**`findDailyRate`'s ordering**, now that a day may hold one observation per
provider: `rate_date DESC`, then the CDN last, then `fetched_at DESC`, then the
provider name. The last tiebreak is not meaningful in itself — it is there so a
read that feeds a ledger returns the same row every time it runs.

**`persistDailyRates` refuses three kinds of row** and warns on each: one with no
effective date (it is never assigned one), one dated in the future (the table
cannot express that as a `CHECK`, because a `CHECK` expression must be immutable
and `CURRENT_DATE` is not), and one whose rate is not a positive number. The
provider's own **string** reaches the column, not the parsed number: the parse
only validates, it does not decide precision.

**`recordQueryCoverage` merges in one statement.** Every stored span that
overlaps **or touches** the new one is deleted and its bounds folded in, so the
set stays one row per contiguous interval. Adjacency matters as much as overlap:
August and September stored apart would answer *no* to a span crossing the 31st
though every one of its days was queried. A transaction-scoped advisory lock
keyed on the provider and the pair serialises the writers that could collide;
the exclusion constraint on the table is the structural guarantee underneath.

**`persistQueriedRange` writes nothing when the answer was unusable** — coverage
included. An empty answer is indistinguishable from a provider returning success
with an empty body, and coverage is never invalidated by anything: recording it
would mark that period permanently as asked-and-empty and the store could never
recover from one bad response. Asking again costs a call; recording a false
emptiness costs correctness for good.

**`isDaySettled` asks the read's own question**, source included. It once matched
the row *without* its source, and while that held it reported settled for a day
whose only row `findDailyRate` refuses — skipping the very arm that would have
repaired it and turning a recoverable gap into a permanent 422.

### 3.4 The providers

Every historical adapter returns the same shape, `{ rateDate, rate, source }[]`,
so the resolver hands the array straight to the store. The rate stays a string
throughout.

#### `banrepTrmProvider.js` — the official Colombian source

| function | role |
|---|---|
| `fetchTrmRange(from, to)` | **the historical arm.** Every validity overlapping the window, one row per validity, oldest first |
| `fetchTrm()` | the live arm, used by the orchestrator. Carries `providerDay` from `vigenciadesde` |
| `fetchTrmForDate(date)` | a single day's validity. Exported, currently no caller |
| `fetchAllRates(base)`, `fetchRate(base, target)` | the orchestrator's standard interface. `usd` base only |
| `parseColombianDate`, `toColombianDay` | private. Colombia has no DST, so the dataset's naked timestamps are read at a fixed −05:00 |

**Why a range and not a day at a time.** The TRM is not a quote on a trading day,
it is a **rate with a validity**, and every calendar day of the window falls
inside exactly one of them. A store holding only some validities is not a
partially warm cache, it is wrong: a day whose own validity was never fetched
resolves onto an older one the provider had already superseded. Measured on
2026-08-20 with only 08-15 stored, 3128.65 was served where the rate in force was
3053.48.

The query filters on **overlap, not containment** — the validity in force on the
first day of the window usually opened before it. A page that comes back at the
200-row limit is treated as a failure, not as a short month: a truncated page
would leave the tail of the window silently uncovered.

#### `bcvApiRafnixgProvider.js` — the official Venezuelan source

| function | role |
|---|---|
| `fetchBcvRange(currency, startDate, endDate, options)` | every rate the BCV had in force across the span, **one row per calendar day** |
| `assertHostIsNotRetired()` | private. Refuses the retired host by name instead of letting it surface as an opaque DNS error |
| `toCalendarDay`, `toRate` | private. `toRate` accepts the Spanish thousands and decimal spelling |

**The endpoint answers a polling log, not a daily series.** Several rows carry the
same calendar day, one per scrape, and `date` is the instant of the scrape rather
than a validity. Collapsing it to one row per day is the first thing any caller
would have to do, so it is done here once — **the latest scrape of a day wins**,
chosen explicitly rather than by trusting the server's ordering. A row outside
the requested span is dropped, because coverage is recorded as exactly `from..to`
and a row outside it could never be proved to have been queried.

**A row dated on a weekend is kept.** It is not an invented day: the BCV portal
shows the rate *in force*, and a Saturday scrape records that the official rate
that Saturday was that figure. That is the coverage the CDN arm structurally
cannot assert, since it is asked for one day and cannot speak for a span.

Why this arm exists at all, measured against the curated series in `bcv_data.js`
over 2026-06-01..09-01: the CDN sat **below** the BCV on 63 of 63 days, mean gap
0.54%, worst 3.40%, not one exact match — its figure for a day fits the BCV's
*previous* published day more than twice as well as the day asked for. This
source matched on 34 of 37 comparable days to the fourth decimal.

Only the bolivar is served. The endpoint publishes the euro, yuan, lira and
rouble too, but each is quoted as bolivars per unit of *that* currency, and the
store is USD-based: turning them into `usd→x` would compose two quotes and file a
cross under a national source's name.

#### `bancaDItaliaProvider.js` — the universal arm and the business-day oracle

| function | role |
|---|---|
| `fetchBancaDItaliaRange(currency, startDate, endDate, options)` | **the historical arm.** One call, one row per published day |
| `fetchBancaDItaliaRate(currency, date, options)` | the walk-back: one day per request, stepping back up to five days. Exported, currently no caller — kept as the natural second attempt if the range endpoint errors |
| `fetchOneDay(isoCode, day, timeoutMs)` | private. An empty answer is **returned as a value**, a transport failure **throws** — that distinction is what lets the walk-back consume a step on emptiness and abort on a timeout |
| `assertHostReachable()`, `noteHostOutcome(error)` | private. A 60-second memory of a host that would not connect |
| `toCalendarDay`, `previousDay` | private |

**It is the business-day oracle.** The source answers nothing on a day with no
market, so every `rate_date` in the store is a day some market was open — which
is why **no holiday calendar exists anywhere in this codebase**. A Saturday, a
Colombian holiday and Christmas all resolve by the same mechanism.

**The quote convention is checked, never inverted on a guess.** Code `C` reads
"foreign currency amount for 1 Dollar", the direction this app stores; anything
else is refused. The range endpoint states the convention **once on the
envelope**, which is the reverse of the single-day endpoint — each is read where
it actually appears.

**The unreachable-host memory is not a judgement that the provider is gone.**
Measured 2026-08-31: DNS resolves, the TCP handshake on 443 never completes, and
every call burns its whole timeout — about 2s of a 5s budget, once per currency
per uncovered day. Only a failure to *reach* the host counts; an HTTP status or a
malformed body means the host answered and the fault is elsewhere. The window is
short on purpose, because this provider is the preferred one.

#### `githubFallbackProvider.js` — the CDN of last resort

| function | role |
|---|---|
| `fetchRatesForDate(baseCurrency, date, options)` | **the historical arm.** One snapshot, every currency for that day |
| `fetchFromGitHubFallback(baseCode, targetCode)` | the live fetch |
| `fetchAllRates`, `fetchRate` | the orchestrator's standard interface |
| `isCalendarDay(value)` | private. A day is a **string** here and never a `Date`: a `Date` is an instant, and reading one in UTC at an entry point shifts the day for a user west of Greenwich |

It **throws rather than returning null**, unlike its live siblings: it is the last
arm, and the resolver has to be able to say which arm failed and why. It also
**verifies the day it was answered** — the payload names its own date, and a
mismatch means the CDN served a different snapshot than the one asked for, which
must not pass as that day's rate.

### 3.5 The warm-up — `core/warmRecentRates.js`

| function | visibility | what it does |
|---|---|---|
| `warmRecentRates()` | export | resolves every day of the window for every currency. **Never throws and never rejects** |
| `daysToWarm()` | private | every day from the first of last month through today, in UTC |
| `currenciesToWarm()` | private | the peso first, then the rest |

Called from `backend/src/index.js` and **deliberately not awaited**: the store
fills while the server already answers, and a slow provider must not hold up a
boot.

**It resolves rather than fetches.** Nothing here knows what a provider is —
`resolveHistoricalRate` owns the cascade, the span arithmetic and the order of
the sources, so the official source stays first for the peso, which a uniform
range call would shadow.

Each of its three choices was a defect once:

- **every day, not just the first of the month.** Relying on whichever arm
  answered to have fetched a range around it is a dependency on *which* source
  answers. The CDN arm asks for one day and covers one day, so a currency falling
  to it warmed at most that day — and none at all when the first of the month was
  not a trading day, which it is not roughly two months in seven.
- **two months, not the month in course.** Not because anyone back-dates further
  — `transactionController` refuses a movement dated before the first of the
  current month — but because this module reads today in UTC while that floor
  reads it on the *owner's* calendar. With UTC on 1 September an owner in Bogotá
  is still on 31 August, and a UTC-month window had warmed exactly one day, of no
  use to them.
- **the peso first.** The CDN arm never names a date itself; it asks the store for
  the latest day some source established, and that calendar is shared across
  every pair. On a cold store a currency warmed before the one whose official
  source publishes a range has nothing to ask for. Measured: a cold November gave
  zero days ready for the euro against thirty for the peso; warmed after it, an
  equally cold October gave twenty-two, in the same total time.

A day the cascade cannot answer is **not an error here**. The summary line reports
the counts honestly rather than reading a partial window as a failure.

It does not try to serve budget allocation, which converts for any month from the
account's opening month onward and so reaches arbitrarily far back. Warming that
is unbounded work for a deliberate, occasional action that can afford the cascade
once.

### 3.6 The bridge from the live path — `core/fxService.js`

The two stores never fed each other. The live refresh wrote only the mutable
one-row-per-pair table, so the day it had just paid a provider for was never
recorded as that day's observation: a movement dated today took the historical
path, missed, and bought the same figure a second time.

| function | visibility | what it does |
|---|---|---|
| `recordLiveRatesAsDailyObservations(batch, baseCurrencyId)` | private | records what the live refresh just fetched as that day's observation too |

**The day comes from the provider or the row is not written.** Only an adapter
knows its provider's calendar semantics, so each states `providerDay` when it can
and leaves it null when it cannot — Cotizave quotes a market continuously rather
than publishing for a day, so its rate never becomes a daily observation.
Coverage travels with it: one day was asked for, so one day is covered, written
by the same `persistQueriedRange` the resolver uses. Its failure is warned and
swallowed: recording history is an optimisation on top of a live rate that is
already stored and being served.

### 3.7 The audit — `core/detectStalledOfficialRates.js`

Not on any request path. Run with `npm run fx:stall-scan` from `backend/`.

| function | role |
|---|---|
| `detectStalledOfficialRates({ currency, officialSource, from, to, signalPct, minRunDays })` | the days the official source looks stuck, as `{ flagged, compared, uncomparable }` |
| `reportStalledOfficialRates(args)` | the same findings, logged. Reports its own failure and returns `[]` rather than bringing down its caller |

**A stall cannot be detected inside one source.** A scraper can freeze: measured
2026-06-02..06-22 it repeated 554.4258 for twenty-one days while the real rate
climbed from 557 to 612 — and a repeated rate is normal on its face, because a
central bank genuinely holds one over weekends and holidays.

**The signal is the sign of the gap, not its size.** Over 58 healthy days the
CDN's cross sat below the official rate on 54 of them and never rose more than
one percent above it: the market follows the official rate, it does not lead it.
During a stall that ordering inverts. A one-percent magnitude band found
**nothing** in the five days at the start of a stall, which only reach 0.55% to
0.76% — so the default is the direction plus a run of at least two days, and the
size is reported rather than required. Both knobs stay open.

---

## 4. How the information is organised

### Two tables, opposite lifecycles

| | `exchange_rates` | `daily_exchange_rates` |
|---|---|---|
| holds | the **current** rate | what a rate **was**, per day |
| rows | one per pair, mutable | one per provider, pair and day, append-only |
| governed by | `fetched_at` and a TTL | `rate_date`; nothing expires |
| lifecycle | dropped on boot by `createTables.js`, and by `RESET_EXCHANGE_RATES` at any time | must survive that reset |
| written by | `db/fxDBaccess.js` | `db/dailyRateDBaccess.js` |

The history could not live in the cache's table: a ledger's audit trail cannot
sit in an object the boot sequence is licensed to drop, and the cache's
`UNIQUE (base, target)` is exactly the contract that makes it a cache.

### The schema

| migration | what it establishes |
|---|---|
| `021_create_daily_exchange_rates.sql` | the observation table. One row is one fact: on `rate_date`, one unit of base bought `exchange_rate` units of target, according to `source`. `rate_date` is the provider's reference date, `fetched_at` is when this installation retrieved it — different facts, both kept |
| `023_create_exchange_rate_query_coverage.sql` | the coverage table, `DATERANGE` in half-open form, plus `btree_gist` and the exclusion constraint that makes overlapping spans structurally impossible |
| `024_daily_exchange_rate_key_includes_source.sql` | adds `source` to the unique key, so an observation is unique per **provider**, pair and day |

Boot-time equivalents live in `backend/src/db/run_time_db_init/createTables.js`
as `ensureDailyExchangeRatesTable` and `ensureExchangeRateQueryCoverageTable`,
declaring the same named constraints so every database ends up identical.

**Why 024 was needed.** Under 021's key and 023's read at once, *the first
provider to write a day owned it exclusively and forever*: if that provider had
no coverage the read refused its row — correctly — and no other provider could
replace it, because the insert lost to the unique key and `DO NOTHING` discarded
it. The day became permanently unresolvable while looking, in the table, fully
populated. Measured before the migration: 146 stranded `bancaditalia`
observations, 75 of them inside the back-dating window, with a VES movement on
2026-08-12 returning 422 while a rate for that exact day sat in the table.

Widening the key rather than deleting those rows was deliberate: the moment their
provider answers again over a range containing them, the range write records its
coverage and the **same rows** become readable, at the precision the official
source published.

### The names that must agree

`fxConfig.js` defines the provider names once because two readers depend on the
same spelling: the resolver, to ask whether a call has anything left to write,
and the store, to rank a day holding observations from more than one provider.
Two spellings of one provider would silently disagree.

`ACCOUNTING_CURRENCY_CODE` · `SUPPORTED_CURRENCIES` · `OFFICIAL_TRM_CURRENCY`
(`cop`) · `OFFICIAL_BCV_CURRENCY` (`ves`) · `BCV_RATE_SOURCE` (`bcv`) ·
`FALLBACK_RATE_SOURCE` (`github-fallback`).

---

## 5. How the answer is delivered

### The endpoint

`POST /api/fintrack/currency/convert`, behind `verifyToken` →
`routes/currencyRoutes.js` → `currencyConvert`.

```
{ amount, fromCurrency, toCurrency, day? }
  ─▶ { convertedAmount, rate, quote, source, fetchedAt, effectiveDate }
```

The handler's own work, in order: validate the amount (`INVALID_FX_AMOUNT`),
refuse an unsupported currency as a **400** rather than letting `getCurrencyId`'s
plain `Error` default to a 500, validate the day's format (`INVALID_FX_DATE`),
read the owner's zone, and route.

**It routes on the owner's calendar, the same way `transactionController` does,
and it has to.** This endpoint exists so a form can show the figure the row will
carry; a preview that routes differently from the write shows a different number.
Measured before that was fixed: an entry dated today previewed at 3.1223 from the
historical store, which had walked back three days, while the row stored 3.1114
at the live rate.

The current-month rule is deliberately **not** applied here. That rule governs
whether an operation may be *recorded* on a date; this endpoint records nothing.

Errors are forwarded with `next(error)`, never rebuilt: the resolver's refusals
already declare their own status and stable code, and rebuilding them would
demote a 422 to a 500 and drop the code the client branches on.

### The frontend

| file | role |
|---|---|
| `hooks/useServerCurrencyConversion.ts` | asks the server, 400 ms debounce, `AbortController` plus a request stamp so a late answer cannot overwrite a newer one. Four states — `inactive`, `querying`, `resolved`, `failed` — and a `retry` |
| `hooks/useCurrencyPreview.ts` | the cheap approximation from the store's live rates. No request, instantaneous, non-binding |
| `pages/tracker/components/TopCard.tsx` and the eight other forms | pass the chosen day and render the figure |
| `general_components/rateTooltip/RateTooltip.tsx` | the chip naming the rate and the day it reaches. Focusable, so the figures are not pointer-only |
| `general_components/fxPathwayCard/FxPathwayCard.tsx` | reads a stored conversion back: what was typed, what was stored, the rate and when it was locked |

The two hooks are not versions of each other. `useCurrencyPreview` hints at an
order of magnitude; `useServerCurrencyConversion` asks the same service the write
path uses, for the same day, so the two cannot disagree. Use the second only
where the owner is about to commit to the number.

`day` is a **dependency** of the server hook's effect, not merely a payload
field: without it, changing the date would leave the previous day's figure on
screen.

`FxPathwayCard` never prints the rate through a money formatter. A rate rounded
to two — or four — decimals cannot be re-applied to the stored figure and checked
against it, which is the only thing that block is for.

---

## 6. How it persists into the ledger

The conversion's result becomes the row's FX metadata, built by
`backend/src/utils/fintrackUtils/transactionManagement/fxMetadataHelper.js`
(`buildFxMetadata`) and written by the controller:

| column | filled from |
|---|---|
| `original_amount`, `original_currency_id` | what the owner typed, in the unit they typed it in |
| `exchange_rate` | `conversion.rate` |
| `exchange_rate_source` | `conversion.source` — **`provider@effectiveDate`** on a back-dated movement |
| `exchange_rate_timestamp` | `conversion.fetchedAt`, when the figure was obtained |
| `exchange_rate_target_currency_id` | the accounting currency |

The effective day rides inside `exchange_rate_source` rather than taking a column
of its own because `exchange_rate_timestamp` already means *when the figure was
obtained* on every row ever written, and one column cannot hold two meanings.

The same metadata shape is written for category budgets (`014`), pocket targets
(`015`), debtor values (`016`) and budget allocations (`017`).

---

## 7. Failure modes

| condition | status | `errorCode` | raised by |
|---|---|---|---|
| a currency this installation does not convert | 400 | `UNSUPPORTED_FX_CURRENCY` | the resolver, and `currencyController` for either side of a conversion |
| a date that is not `YYYY-MM-DD` | 400 | `INVALID_FX_DATE` | the resolver and the controller |
| an amount that is not a positive number | 400 | `INVALID_FX_AMOUNT` | the controller |
| a day that has not happened on the owner's calendar | 422 | `FX_DATE_IN_FUTURE` | the resolver |
| no arm of the cascade could answer | 422 | `FX_RATE_UNAVAILABLE` | the resolver |

**The code is the contract; the message is for a human and may change.** A 422 is
the correct outcome, not a bug to route around: the movement is refused rather
than valued at a rate no market quoted.

---

## 8. Configuration

| variable | default | governs |
|---|---|---|
| `FX_HISTORICAL_BUDGET_MS` | 5000 | the whole cascade, and one dated conversion however many currencies it resolves |
| `FX_REQUEST_TIMEOUT_MS` | 2000 | one provider call, capped further by what is left of the budget |
| `BCV_API_BASE_URL` | `https://dolar-vzla.rafnixg.dev` | the BCV source. Pointed at the retired host, the arm refuses with an explanation instead of a DNS error |
| `DATOS_GOV_APP_TOKEN` | — | optional; raises the anonymous Socrata rate limit |
| `FX_CACHE_TTL_HOURS`, `FX_GITHUB_TTL_HOURS`, `FX_STATIC_FALLBACK_TTL_HOURS` | 22 / 0.5 / 0.25 | the **live** state only. Nothing in the historical path has a TTL |

---

## 9. Exported and currently unused

Both are documented as deliberate, not as leftovers:

- `fetchBancaDItaliaRate` — the day-by-day walk-back. The range call replaced it
  on the resolver's path; it stays as the natural second attempt if the range
  endpoint errors.
- `fetchTrmForDate` — a single validity for one day. The cascade fetches the
  whole window instead, for the reason given in 3.4.
