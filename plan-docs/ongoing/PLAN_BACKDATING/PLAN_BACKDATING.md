# PLAN_BACKDATING — recording a movement on the day it happened

**Condensed 2026-08-30 from the working document, now `PLAN_BACKDATING_EVIDENCE.md`.**
This file is the contract: every decision, every bound, every open item. The evidence
file keeps the raw measurements, the superseded drafts and the reasoning that produced
each ruling. **Where the two disagree, this file wins** — the other is a record of how
we got here, not of where we are.

`plan-docs/` is gitignored. Nothing in this folder produces a commit.

**V1 carries no migration.** Not on `transactions`, not on `exchange_rates`.

**Branch: `feat/backdating`, off `feat/budget` at its tip** — not off `main`. Four
commits that live only on `feat/budget` rewrite `getTransactionsForAccountById.js`, the
same file section 5 rewrites, and branching elsewhere turns each into a merge conflict
in the one file where a mis-resolved conflict produces a wrong balance silently.

---

## 1. The problem

FinTrack stamps every movement with `new Date()`. A purchase entered three days late is
filed three days late, and in the wrong budget month when it crosses a boundary.

The column already exists — `transactions.transaction_actual_date`, `TIMESTAMPTZ` since
`003_transactions.sql:56` — and the endpoint already destructures a date from the body.
What is missing is a control on the form, a guard that does not discard the value, and a
decision about the figures that depend on insertion order.

**Nothing is corrupted today.** No frontend file sends `transactionActualDate` — swept
2026-08-24, re-measured 2026-08-26 and 2026-08-29. The guard always falls through to
`new Date()` and is right by accident. Every defect below is latent.

**Which is why fixing the guard alone is the dangerous move.** It would switch
back-dating on for the one screen that already sends a date, with none of the bounds,
none of the derived reads and none of the exchange-rate work.

---

## 2. What actually depends on a date or an order

A tracker movement writes exactly two tables: two rows into `transactions` (source leg
and destination leg, `recordTransaction.js:80`) and two `UPDATE`s on `user_accounts`.
Occasionally one `INSERT` to create the counterparty account. Nothing else — **no budget
table is written**, because budget spend is computed on read, so a back-dated expense
restates its month with nothing to change.

| persisted column | depends on | disposition |
|---|---|---|
| `transactions.account_balance_after_tr` | the **order of insertion** | a cache of a derivable figure — **stop reading it** (§5) |
| `transactions.exchange_rate` + its five siblings | the **date** | irreconstructible audit — **keep, and date it honestly** (§4) |
| `user_accounts.updated_at` | should be the write instant; carries the movement's date today | **defect — untie it** (§3.4) |
| `user_accounts.account_balance` | the **set** of movements, not their order | stays persisted; **stops being read** (§5) |
| `budget_monthly_allocations.budget_amount`, `debtor_accounts.value`, `category_budget_accounts.budget`, `pocket_saving_accounts.target` | a definition, not a derived figure | untouched |

**The rule every future column is tested against:**

> **Store what cannot be reconstructed; compute what can.**
> A stock of the present may be materialised; a historical series may not.

`account_balance_after_tr` has every input already in the table. The exchange-rate pair
does not: the rate of that instant exists nowhere else, and without it there is no way
back from the stored figure to what the owner typed.

---

## 3. The write path

### 3.1 The field

**One name: `transactionActualDate`**, a calendar day `YYYY-MM-DD` and nothing else — no
offset, no time. Optional; absent or empty means *now*, which is today's behaviour and
stays the default on every form. The legacy `date` field that two screens send is retired
with them.

### 3.2 The guard

`transactionController.js:473-478` has four defects: a `!date` term referring to a
*different* variable that discards a date the client did send; `actualDate === ''`
written twice; an unreachable `?? date`; and no validation at all, so an unparseable
string becomes `Invalid Date` and reaches the insert.

The replacement takes one field name, parses it, validates it and composes the instant.
**It must move below the account lookups** at `:499` and `:516` — the lower bound is not
knowable until both accounts are loaded.

**Corrected 2026-08-30 — the anchors above describe the guard before `6adc8de`.** The
replacement shipped and `664ad5c` split it: the field is destructured at
`transactionController.js:345`, the calendar-day parse and checks 1, 2 and 3 run at
`:350-376`, and `asOfDay` is composed at `:382` — all of it **above** the FX conversion
at `:400-405`, not below the account lookups, which now sit at `:551` and `:568` inside
the transaction. Check 4, the two accounts' opening days, is the only one that stayed
below them.

### 3.3 Validation and bounds

| # | check | failure |
|---|---|---|
| 1 | parses as a calendar date | **`400`** — the payload is malformed |
| 2 | not later than today in the owner's zone | **`422`** naming today |
| 3 | not earlier than the first day of the current month in the owner's zone | **`422`** naming that day |
| 4 | not earlier than the **later** of the two accounts' `account_start_date` | **`422`** naming that account and its opening date |

**The effective floor is the later of checks 3 and 4** — the first day of the month, or
the account's opening when the account was opened mid-month. The ceiling is today. A
movement is therefore always recorded inside the month it is being recorded in, which is
a deliberate editing window and not a consequence of anything the arithmetic needs: the
month's spend is computed on read from `transaction_actual_date`, so a movement dated
into a past month would restate that month correctly and silently. The window exists so
that it cannot.

**All four checks exist.** Checks 1, 2 and 4 landed first; the month floor followed, and
`664ad5c` split the block: the three that need only the owner's zone run above the FX
conversion, so the conversion can be told which day to value, and check 4 stays inside the
transaction because its floor is the two accounts' opening days.

**Both bounds are inclusive and both compare calendar days, never instants.** This is not
a formality: `account_start_date` holds an arbitrary wall-clock time, so an account opened
at 20:00 would refuse a movement on its own opening day, which composes to 12:00 — eight
hours "before" it as an instant. Compare `date_trunc('day', … AT TIME ZONE $z)` on both
sides, the technique `createTables.js:644` already uses on this column.

`400` for malformed and `422` for a broken relationship follows the shape the budget
module already states at `budgetAllocationService.js:42-46`:
`Object.assign(new Error(message), { status })`.

**Composing the instant:**

```
requested day == today in the owner's zone  ->  the actual current instant
requested day <  today in the owner's zone  ->  that day at 12:00 in the owner's zone
```

Midday is maximally far from both day boundaries, so no zone conversion can push the
movement into the adjacent day or month. Anchor in SQL with `($d::timestamp AT TIME ZONE
$z)`, never in JavaScript. **Both legs carry the same instant**, composed once and passed
to both `recordTransaction` calls, or the two halves of one entry fall in different months.

### 3.3.1 Where each rule lives — settled 2026-08-30

Three layers, stated separately because they are not the same statement and one does not
substitute for another.

| layer | what it owns |
|---|---|
| business rule | the window is `[max(first day of the current month, the account's opening), today]`, read on the owner's calendar |
| frontend | the chosen date filters the account selector: an account whose `account_start_date` is later than the chosen day is not offered. If the account already chosen stops qualifying, the selection is cleared |
| backend | validates all four checks independently, on every request, whatever the client offered |

**The frontend controls what the owner may choose; the backend controls what the system may
write.** The filter is a convenience, never the guarantee: it removes the options that
would be refused, so a `422` is reached by a hand-built request rather than by the form.

The list filter needs **no new endpoint, no new query and no extra request** — the nine
account list queries in `getAccountController.js` already ship `account_start_date`, so the
form filters the payload it already holds. That is a statement about the list, not about
the write path, which does take the new guard named above.

**The rule is expressed over the stored column, not over history.** The predicate is
`account_start_date <= chosen day`. FinTrack does not know when a category began to exist
in the world; it knows when the account was registered. Wording the rule as "accounts that
already existed" claims knowledge the database does not hold.

**`account_start_date` stays a strict bound in V1 and back-dating never edits it.** That
date anchors two things at once — the origin of the derived balance (§5.1) and the first
month of the budget allocation — so moving it retroactively is its own module, not a
side effect of a date picker. The escape hatch already exists: the creation screen accepts
a client-supplied opening date at `accountCategoryCreationcontroller.js:47`.

**Measured consequence, `fintrack_dev` 2026-08-30:** 26 of 27 live accounts were opened
this month, ten category accounts on the 28th alone. Dating a movement to the 12th hides
all ten. The filter is the dominant case, not an edge case, and that is the rule working.

**The date is not a gate on the form.** It defaults to today, which is always valid and
always shows every account, so the ordinary entry behaves exactly as it does now; the list
re-filters only when the owner actively moves the date back. Making the date a required
first step would add a step to every entry to serve the back-dated minority.

### 3.3.3 The category selector cannot be filtered yet — found 2026-08-30

"No new query and no extra request" in §3.3.1 holds for every selector served by
`getAccountController.js`, which ships `account_start_date` on all nine of its list
queries. Expense's category dropdown is not one of them: it is built from the budget
status store, whose row type `BudgetAccountStatus` (`budgetTypes.ts:82`) carries
accountId, accountName, categoryName, subcategory, nature, currency and the four
figures — **and no opening date**.

**Corrected 2026-08-30 — this is closed and the paragraphs below describe the state
before it.** The row type carries `accountStartDate: string | null` at
`budgetTypes.ts:98`, shipped by `2b4d3dc` (`feat(budget): ship each account's opening
day`), and the Expense screen filters and clears on it the way the other tracker screens
already filtered their own account lists.

So Expense filters its bank accounts by the chosen day and its categories not at all.
The entry is still refused by the server, so nothing incorrect can be recorded; what is
missing is the filter that keeps the owner from meeting that refusal.

**The fix is one field on that contract**, not a second request: the status query already
selects from `user_accounts`, so it can carry the account's opening day the way
`getAccountById` already resolves `account_start_local_date`. Four screens read this
payload, so it is a contract change and belongs in its own commit, with the budget plan's
own record of it.

### 3.3.2 PnL already has a date control, and it writes nothing — found 2026-08-30

`PnL.tsx:568` renders the shared `Datepicker`, `PnL.tsx:395` puts the chosen day in the
payload as `date`, and the controller destructures it at `transactionController.js:274`
only to print it at `:283`. `getPnLConfig` never reads it. The guard reads
`transactionActualDate` (`:477`), which PnL does not send, so `:533` falls back to
`new Date()`. **The movement is stamped with the moment of the request whatever the owner
picked.** PnL is not the view missing back-dating; it is the view whose date control is
already decorative.

**Corrected 2026-08-30 — the whole paragraph above is the state before `81dbb5c` and
`ebd7622`, and none of its anchors is live.** The screen is
`frontend/src/fintrack/pages/tracker/profitNloss/PnL.tsx` and it sends
`transactionActualDate: toCalendarDay(chosenDate || new Date())` at `:460`; the legacy
`date` key left the wire, and the controller's destructure at
`transactionController.js:266-274` now carries a comment where the field used to be. The
wiring described below as owed is the wiring that shipped.

The wiring is one payload key: PnL sends `transactionActualDate`. It posts to the same
endpoint through the same controller, so the four checks then apply to it with no further
change, and its calendar takes `minDate` / `maxDate` the way any other caller does.

**Trap — the internal counterparty imposes a floor it should not.** A PnL entry's other
leg is `slack`, created on demand at `transactionController.js:243` with
`account_start_date = new Date()`. Check 4 takes the **later** of the two accounts'
openings, so a back-dated PnL is refused by an account the owner never created and cannot
see — and on a user's first PnL that account is born inside the same request, making every
back-dated first entry impossible. **The floor must be computed over the accounts the owner
selected, excluding the internal counterparty.**

The discreet trigger of §3.3.1 does not reach PnL. Its date is already a primary field with
its own label and panel, so PnL keeps the calendar it has and joins this flow through the
payload key and the bounds only.

### 3.4 `updated_at` stops carrying the movement's date

Three implementations write `updated_at = $2` from a transaction date —
`transactionController.js:138`, `accountManagement/updateAccountBalance.js:21`,
`accountDeletionUtils/updateAffectedAccountBalance.js:28`. All three drop the parameter
and take the column's default. Five call sites stop passing it. Nothing replaces it:
*when the balance changed* is what the transactions say.

**Corrected 2026-08-30 — done, and not one of the three anchors survives.** No writer
takes a date any more. The controller's own copy went with `be6ebbf`;
`accountManagement/updateAccountBalance.js` is deleted in the working tree today and
replaced by `accountManagement/setAccountBalanceFromLedger.js`, which writes
`updated_at = NOW()` at `:58` and states the rule at `:54-55`; and
`accountDeletionUtils/updateAffectedAccountBalance.js:28` writes `updated_at=NOW()`,
with the same rule in its header at `:7`.

> **Shared ownership.** The same three files are claimed by `PLAN_ACCOUNT_DELETION.md`
> §13.10, which collapses them into one function. This section is a strict subset of that
> consolidation. **Whichever block reaches the files first owns them; the other records
> the outcome instead of repeating the work.** Neither order breaks anything. What must
> not happen is both implementing it as sole owner.

### 3.5 Reuse, do not rewrite

| need | existing |
|---|---|
| the owner's zone | `getUserTimeZone(db, userId)` — `date-utils/getUserTimeZone.js:20` |
| today in that zone | `todayInZone(timeZone)` — `date-utils/resolveZonedWindow.js:60` *(was `:42`, re-measured 2026-08-30)* |
| a day anchored in a zone, in SQL | `($d::timestamp AT TIME ZONE $z)` |
| the error shape | `budgetAllocationService.js:38-46` — `badRequest` at `:38`, `unprocessable` at `:45` *(re-measured 2026-08-30)* |

---

## 4. The exchange rate of a past day

### 4.1 Routing

```
date == today in the owner's zone  ->  fxProviderOrchestrator, unchanged
a past date                        ->  the historical cascade below
a future date                      ->  422
```

**The default path does not change at all.** No date sent means "today" and goes to the
orchestrator byte for byte as now, so this section carries no risk to current behaviour.
The historical resolver sits **beside** the orchestrator in `core/`, not inside it: the
orchestrator resolves the current rate through a freshness cascade with TTLs, and a
historical rate has no freshness. Making it a branch would put a TTL on a fact that
cannot change.

### 4.2 The cascade

```
resolveHistoricalRate(currency, requestedDate)

1. usd                  -> rate 1, source "identity". No HTTP.
2. cop                  -> Banrep, $where on vigenciadesde/vigenciahasta.
                           One call resolves weekends and holidays: the row
                           carries its own validity range. On failure -> 3.
3. eur | mxn | ves      -> Banca d'Italia. Empty means no market that day;
   and cop as fallback     step back one day and retry, at most 5 steps.
                           Its answer establishes effectiveDate. On failure -> 4.
4. CDN currency-api     -> asked for the resolved effectiveDate, NEVER for the
                           raw requested date.
5. nothing answered     -> 422. Never today's rate on a past movement.

Stored: exchange_rate_source = "<provider>@<effectiveDate>"
```

**Banca d'Italia is simultaneously the universal fallback and the business-day oracle.**
Its emptiness is what defines a day with no market, which is why the walk-back lives in
that arm alone and every other arm inherits the date it resolves. **No holiday calendar
exists anywhere in the app** — a Saturday, a Colombian holiday and Christmas all resolve
by the same mechanism.

**The order is not a preference.** The CDN fabricates on closed days: measured across
`2026-05-14`…`18`, Saturday and Sunday move against Friday and against each other on days
nothing traded, and Monday snaps back to Friday's figure to the fourth decimal. Asking it
for a raw requested date would store a number no market quoted. It can only be asked for
a resolved effective date, and the walk-back is what resolves one.

| bound | value | why |
|---|---|---|
| per HTTP call | **2s** | a published historical figure is a static document; a source silent for two seconds is down, not slow |
| the whole cascade | **5s** | sized by what a form submit may hang for, not by the sum of the arms |

**A timeout aborts its arm; only an empty answer consumes a walk-back step.** Walking back
against a host that is down would ask a dead server one day earlier. So a source that is
down costs one call, not five. **No retry and no backoff**: a published historical figure
does not become available on a second attempt — the cascade's next arm *is* the retry,
against a different source. **Failure never falls through to today's rate.**

Two real costs of the 5s ceiling, stated rather than hidden: about two arms get a turn, so
the CDN is rarely reached; and a long weekend against a slow-but-alive Banca d'Italia
aborts to `422` for a date the source would eventually have answered.

### 4.3 Coverage, every cell a live request

| source | `cop` | `eur` | `ves` | `mxn` | exact date | weekend | key |
|---|---|---|---|---|---|---|---|
| Banrep TRM | ✓ official | — | — | — | yes | **carries its own range** | no |
| Banca d'Italia | ✓ | ✓ | ✓ | ✓ | yes | **empty** | no |
| CDN `currency-api` | ✓ | ✓ | ✓ | ✓ | yes | **fabricates movement** | no |
| Frankfurter | ✗ absent | ✓ | ✗ absent | ✓ | yes | — | no |

**No currency is refused.** An early draft allowed only `usd` and `cop`; measurement
withdrew it the same day. The owner's real data is `cop` 503, `usd` 272, `ves` 6, `mxn` 4
of 785 movements — **513 rows carry a real conversion**, so refusing foreign currencies
would refuse back-dating on 65% of what the owner records. The principle survives as *only
a rate that can be named truthfully is ever stored*.

**The series floor cannot be reached.** The CDN resolves back to `2024-03-06`; the owner's
whole database begins `2026-05-14`. Every source reaches further back than the lower bound
will ever permit.

### 4.4 The rule for a day with no market

> **A day takes the rate the official source declares in force on it, and the record names
> the day that rate came from.**

The walk-back arms satisfy this by absence of an answer. Banrep satisfies it by its
published range — and that range is why a Colombian Saturday is answered by *itself*, not
by the Friday: Banrep opens a new validity range on the Saturday, calculated from Friday's
market but legally in force on the Saturday, and it is a different number (`3048.12` against
Friday's `3062.96`). The alternative — forcing the Saturday to take Friday's figure — was
rejected on the same ground as interpolation: it would record a rate that was not in force.
No code changes because of this; the wording exists so a later reader does not "correct"
`banrepTrmProvider.js` in the wrong direction.

**A one-day offset between Banca d'Italia and the CDN is accepted and named, not
reconciled.** `exchange_rate_source` records which arm answered and for which date, so the
discrepancy stays visible rather than silent.

### 4.5 The files

| file | function | state |
|---|---|---|
| `fxProviders/banrepTrmProvider.js` | `fetchTrmForDate(date)` | **landed** `41502fd` |
| `fxProviders/bancaDItaliaProvider.js` | `fetchBancaDItaliaRate(cur, date)` | **landed** `e7dc38a` *(corrected 2026-08-30; the arm shipped whole, as §7 already records)* |
| `fxProviders/githubFallback.js` | `fetchRatesForDate(base, date)` | **landed** `95b321d` |
| `core/historicalRateResolver.js` | `resolveHistoricalRate(cur, date)` | **landed** `ddadb7d`. The file exists and exports `resolveHistoricalRate(currencyCode, requestedDate, options)` at `:171` *(corrected 2026-08-30; "not written" was true when the row was set)* |

`currencyAmountConversion(amount, from, to)` gains a **fourth optional `asOfDate`**.
Absent, it behaves exactly as today, so every existing caller is unaffected.

**Landed `34b6e18`, measured 2026-08-30.** The signature at
`fx_services/conversion/currencyAmountConversion.js:73` takes `asOfDate = null` as its
fourth parameter (`:77`), imports the resolver at `:30`, calls it at `:132` and switches
to decimal arithmetic whenever the date is set (`:150`, `:153`, `:176`).

**Provenance costs no migration**: `exchange_rate_source` is `VARCHAR(60)`, ample for
`bancaditalia@2026-05-14`. Composing that stamp is the resolver's job, not the arms' — the
arms return `source` and `effectiveDate` separately.

**One resolution per movement, not one per leg.** A transfer is two rows but one date and
one typed currency; two calls to a live service can return two different numbers for one
movement. The resolver is called once in the controller and its result passed to both legs,
exactly as the composed instant already is.

**No preview.** A preview is a second resolution at a different instant, so the figure
shown and the figure stored can disagree. One source of truth: submit, resolve, convert,
persist. A preview that could not disagree would have to let the client carry the rate
back, which is the user-typed override and its trust problem.

**The window endpoint, transcribed from a live call on 2026-08-30.** Measured HTTP 200,
3,577 bytes, 0.83s for thirty days — which confirms the figures §8.1 recorded before the
host became reachable.

```
GET https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0/dailyTimeSeries
    ?startDate=YYYY-MM-DD
    &endDate=YYYY-MM-DD
    &baseCurrencyIsoCode=<ISO>   the currency asked about
    &currencyIsoCode=USD         fixed, the quote side
    &lang=en

{ "resultsInfo": { "totalRecords": 20, "isoCode": "EUR",
                   "exchangeConventionCode": "C", ... },
  "rates": [ { "referenceDate": "2026-08-03",
               "avgRate": "0.8669",
               "exchangeConvention": "Foreign currency amount for 1 Dollar." },
             ... ] }
```

**Same quote convention and same parameter names as the single-day endpoint** the arm
already calls — `dailyRates` takes `referenceDate` where this one takes `startDate` and
`endDate`, and nothing else differs. `avgRate` is the foreign currency for one dollar, and
it arrives as a string, which is how it must stay until it reaches the decimal conversion.

**Closed days are absent rows, not empty ones.** Asked for 2026-08-01 to 2026-08-30 the
answer carried twenty rows: no weekend appears, and neither does the requested end date,
a Sunday. The last row was Friday the 28th. **The requested-to-effective resolution is
therefore in the response itself** — the greatest `referenceDate` not after the requested
day — and the day-by-day walk-back never runs when the range is asked for.

### 4.5.1 The historical rate store — an independent store, not an extension

**The historical store is not an extension of `exchange_rates`; it is an independent store
of historical rates.** The existing current-rate cache keeps its contract untouched. The
history uses `rate_date` as the effective date and a uniqueness of
`(base_currency, target_currency, rate_date)`. The rows returned by a historical range
query are persisted under their own effective dates. Resolving a requested date looks for
the most recent rate whose `rate_date <= requestedDate`, provided the distance does not
exceed the five-day maximum.

**Why it cannot live in `exchange_rates` — measured 2026-08-30, not a preference.** Three
findings, each independently sufficient:

| finding | where | consequence |
|---|---|---|
| the table is dropped unconditionally on a virgin database | `createTables.js:297` — `DROP TABLE IF EXISTS exchange_rates CASCADE` | the history would not survive an initialisation |
| an environment variable drops it on any database | `RESET_EXCHANGE_RATES=true` → `initDatabase.js:200` → `recreateExchangeRatesTable`, `createTables.js:772` | one variable erases months of immutable rates. Its own comment calls it "reset the cache" |
| `UNIQUE (base_currency_id, target_currency_id)` is the current cache's contract, not an oversight | `createTables.js:227` | two live upserts declare `ON CONFLICT` on exactly that key — `fxDBaccess.js:180` and `:280`. Replacing it breaks every conversion the app performs today |

The two objects have opposite lifecycles: the current cache is **mutable, one row per pair,
governed by `fetched_at` and a TTL**; the history is **append-only, one row per pair and
day, governed by `rate_date` and never expiring**. A ledger's audit trail cannot be held in
a table the boot sequence is licensed to discard.

```
exchange_rates            current rate     mutable      fetched_at   upsert, droppable
daily_exchange_rates      rate history     append-only  rate_date    permanent
```

**The store.** Populated by the range call with every row it returns, not only the day the
movement needed — promoted out of V2 (§4.6) because the call is being made anyway: keeping
the other nineteen rows costs one statement and saves every later movement of that month a
network round trip.

```sql
CREATE TABLE daily_exchange_rates (
 daily_rate_id      SERIAL PRIMARY KEY,
 base_currency_id   INTEGER NOT NULL REFERENCES currencies(currency_id),
 target_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id),
 rate_date          DATE NOT NULL,
 exchange_rate      DECIMAL(18,8) NOT NULL CHECK (exchange_rate > 0),
 source             VARCHAR(30) NOT NULL,
 fetched_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE (base_currency_id, target_currency_id, rate_date)
);
```

`rate_date` is the day the rate was in force — the provider's own `referenceDate`.
`fetched_at` is when it was retrieved. They are different facts and the store keeps both.

**A day with no market is answered from the store without a second call**, because the
lookup is not an equality:

```sql
SELECT exchange_rate, rate_date
  FROM daily_exchange_rates
 WHERE base_currency_id = $1 AND target_currency_id = $2 AND rate_date <= $3
 ORDER BY rate_date DESC
 LIMIT 1
```

The unique constraint's index is exactly this query's index — leading columns equal, last
column scanned backwards — so no second index is created.

**No artificial row is ever written for the requested day.** A movement dated Sunday
2026-08-30 does not get a row saying `rate_date = 2026-08-30`. The twenty rows the provider
actually delivered are stored under their own effective dates, and

```
requested: 2026-08-30
effective: 2026-08-28
rate:      0.8589
```

is obtained by resolution. Storing it under the requested date would record a rate as
belonging to a day it was not in force on, which is the ground interpolation is refused on
(§4.6). A second table mapping requested day to effective day is refused too — it stores
what the query above derives.

**No source may fabricate an effective date.** The effective date always comes from the
source that actually supplied the rate. A provider that returns a rate without saying which
day it belongs to cannot have one assigned by the resolver, and the CDN fallback is bound by
this exactly as the primary arm is: a rate whose day is unknown is not persisted and not
used for a past movement.

**The gap this query cannot see, and the bound that covers it.** A row missing because the
market was closed and a row missing because nothing has been fetched yet are the same
absence to the statement above, so an unfetched stretch would be answered with a rate from
before it. The bound is the one the walk-back already uses: **if the row found is more than
five days older than the requested date, it is treated as a miss and the provider is
called.** No new column and no new table; the same five that bounds the walk-back.

**Today is never served from this store.** A past rate is immutable and therefore
cacheable; today's is resolved by the existing freshness cascade with its TTLs, and reading
it from a persisted row would turn a freshness policy into a permanent one.

**Two simultaneous submits needing the same absent day is not a correctness problem.** Both
miss, both call the provider, both insert — and the uniqueness on
`(base, target, rate_date)` makes the second an upsert onto the first's row rather than a
duplicate. The unique constraint is what makes this safe, which is why it is part of the
store's contract rather than the index tuning §4.6 originally filed it as.

### 4.5.2 The cascade resolver — the frozen contract, settled 2026-08-30

The one file that does not exist. Neither the historical rate store nor any of the three
provider arms has a single importer today, so nothing in §4.2 is reachable: writing
`core/historicalRateResolver.js` is what makes all of it live at once.

**Corrected 2026-08-30 — the file exists and the cascade is reachable.**
`fx_services/core/historicalRateResolver.js:171` exports `resolveHistoricalRate`, and it
is called from `fx_services/conversion/currencyAmountConversion.js:132`, which
`transactionController.js:400-405` reaches with `asOfDay`. The store
(`021_create_daily_exchange_rates.sql`, `fx_services/db/dailyRateDBaccess.js`) and the
Banca d'Italia arm are wired behind it. The contract below is what shipped, not what is
owed.

```
resolveHistoricalRate(currencyCode, requestedDate)
    -> { rate, source, effectiveDate, requestedDate, provenance }
    -> throws a 422 when no arm answers. Never today's rate on a past movement.

rate         DECIMAL as text, in the app's own direction: 1 USD = rate currencyCode
effectiveDate the day the rate was in force, from the source that supplied it
provenance   "<provider>@<effectiveDate>", for exchange_rate_source
```

```
resolveHistoricalRate
  ├─ usd                       -> rate 1, "identity". No store, no HTTP.
  ├─ the store                 -> findDailyRate, §4.5.1. A hit ends it.
  ├─ cop                       -> Banrep, its own validity range
  ├─ every other currency      -> Banca d'Italia, the month range
  │                               persist every row returned
  ├─ the CDN                   -> only for an effectiveDate already resolved
  └─ nothing answered          -> 422
```

#### The five decisions this contract settles

**The store is consulted and written inside the resolver, not around it.** The alternative
— a caller that looks up first and persists afterwards — was rejected: the effective date
is computed *by* the cascade, so a caller persisting the result would be writing under a
date it did not derive, and every future caller would have to repeat the lookup, the bound
and the persistence correctly. The cost of the chosen shape is that the resolver touches
the database, which makes it harder to test as a pure function; that is paid once, in the
resolver, instead of at every call site. Same ground as the ownership invariant of the
funds-check helper (§5.5): a helper whose correctness depends on what its caller did first
is unsafe the first time it is called from somewhere else.

**Banca d'Italia gains a range function beside its single-day walk-back, and does not lose
it.** `fetchBancaDItaliaRate` walks back one day at a time, up to five; the measured range
call answers the same question in one request and returns the rest of the month with it.
The resolver calls the range. Deleting the walk-back was rejected: it is committed, it was
verified against the live host, and it is the natural second attempt if the range endpoint
itself errors. The cost is two functions where the resolver uses one — accepted, and named
here so a later reader does not delete the walk-back believing it dead.

**The range asked for is the first day of the requested date's month through today**, not
through the requested day. Both cost one HTTP call and about thirty rows. Stopping at the
requested day leaves every later day of the month un-fetched, so a movement dated the 5th
would fetch nothing useful for one dated the 20th; running to today covers every date the
editing window (§3.3) can ever produce for that month, which turns the second back-dated
movement of the month into a pure store hit with no network at all. Days the provider has
not published simply come back absent, and `persistDailyRates` refuses a future row anyway.

**The rate keeps the direction the whole application already uses: `1 USD = rate
currency`.** `currencyAmountConversion` documents this at its head and its three direction
branches depend on it, and Banca d'Italia's own answer is already in that direction —
`baseCurrencyIsoCode=EUR&currencyIsoCode=USD` returns `0.8669` under the legend *Foreign
currency amount for 1 Dollar*. So the store holds `base_currency_id` = the accounting
currency and `target_currency_id` = the foreign one, the same orientation
`getAllRatesFromDB` already queries `exchange_rates` with. Inverting either at the boundary
was rejected: it buys nothing and puts a reciprocal in the audit trail that no source
quoted.

**The rate crosses every boundary as text.** `findDailyRate` returns what Postgres
delivered and Banca d'Italia's `avgRate` arrives as a string; both stay strings until the
decimal conversion. Parsing to a float at the resolver would round before the caller has
chosen its precision, in a value that a ledger keeps forever.

#### What this commit deliberately does not do

| left out | why |
|---|---|
| `currencyAmountConversion` gaining `asOfDate` | its own commit. Nine call sites across seven files depend on that signature; the parameter is added once the function it would call is proven — **shipped since, `34b6e18`; the parameter is the fourth, at `currencyAmountConversion.js:77`** |
| hoisting the day parse in `transferBetweenAccounts` | the controller cannot pass a date to a conversion that does not accept one yet — **shipped since, `664ad5c`; the parse and checks 1-3 sit at `transactionController.js:350-376`, above the conversion at `:400-405`** |
| a preview endpoint | §4.5. A preview is a second resolution at a different instant. **Still out** |

*(The three rows above scope the resolver's own commit and are kept as written. The two
marked "shipped since" were re-measured 2026-08-30 and are no longer owed.)*

#### What the implementation settled on top of the contract

Three things the contract did not pin down, decided while writing the file and
measured against the live sources.

**The span asked for opens five days before the first of the month, not on it.**
Opening on the first alone leaves a hole: a movement dated the 1st of a month
that fell on a Saturday comes back with nothing on or before it, because the
first published day of that span is the Monday after. The five days are the same
bound the store applies, so the span always contains an answer if one exists at
all. It closes at today or at the last day of that month, whichever comes first,
which keeps a movement dated in an older month from pulling every day since. The
cost is about five extra rows per call and no extra call.

**Every arm that reaches a provider writes to the store and then re-reads the
answer out of it, rather than answering from the payload it just received.** The
resolution rule -- the most recent day not after the one asked for, inside the
age bound -- then lives in exactly one SQL statement, and the cold path and the
warm path both go through it. The answer served on a miss is the same answer
that will be served on the next hit, which is not something a second code path
formatting the payload could guarantee. The cost is one round trip against a
local table, on a request that has just paid for an HTTP call. Measured: 673 ms
cold against Banca d'Italia, 1 ms warm.

**The CDN arm is reachable, and reads its date out of the store.** The rule that
no source may fabricate an effective date leaves that arm with nothing to ask
for when the arm before it failed, since Banca d'Italia is what establishes a
date. The store closes it: every rate_date in the table is a day some source
actually published, so the most recent one on or before the requested day --
across every pair, not just the one being valued -- is a business day that a
real provider established. `findLatestBusinessDay` returns it, and when the
table holds no such day the arm does not run. Dropping the arm from V1 was the
alternative and was rejected: it costs one small query, and without it a request
raises a 422 in a case where a truthful answer was available.


### 4.6 Refused permanently, and what V2 may own

**Interpolation is refused forever.** An interpolated rate is a number no market ever
quoted, written into an audit record as a fact. Rates move in steps — a devaluation is a
discontinuity — so interpolation is most wrong precisely on the days that matter most.

**The accumulated rate history moved to V1 on 2026-08-30** and is specified in §4.5.1. It
was filed here while the resolver was expected to ask for one day at a time; once the range
call became the arm's primary query, keeping the other twenty-nine rows it already returns
stopped being an optimisation and became the thing that lets a market-closed day resolve
without a network call at all.

V2 may still own: a user-typed rate override; Frankfurter or ECB if `eur`/`mxn` volume
grows; BANXICO for official `mxn`.

Rejected outright: `tipodecambio.co` (a wrapper around the Banrep TRM already read
directly), `bcv.today` (a scrape the CDN matches to 0.5%), and the central banks of
currencies this app does not have.

---

## 5. The reads that stop being reads

**This is the precondition, not a cleanup.** A stored running balance is a snapshot taken
in insertion order. Insert a movement dated three months ago and every snapshot after that
date is wrong, because each was computed without it. Sustaining the column would mean
rewriting the stamp on every later row on every retroactive insert. Deriving rewrites
nothing.

### 5.1 The canonical derivation — settled 2026-08-30

> `account_starting_amount` + Σ(`amount`) over the account's rows up to and including the
> one being priced, **skipping only the row where the movement type is account-opening AND
> `account_id = destination_account_id`**.

`transactions.amount` is stored signed, so the sum needs no per-type sign rule. Ordering is
`transaction_actual_date ASC, transaction_id ASC`, so a back-dated insert relocates itself
in the series instead of being appended to it.

**Why the exclusion is one row and not one movement type.** An account opened with funds
writes its opening as a pair of equal and opposite legs: a credit on the new account, a
debit on the account that funded it. Only the credit duplicates `account_starting_amount`.
Excluding the whole movement type drops five real outflows and **creates 46.20 usd** that
no account holds. The test that separates them is whether the account is the *destination*
of the opening — true of a credit leg and of a self-funded opening, false of a funding leg.

**The arbiter is conservation, not agreement with the stored column.** The ledger is
double-entry, so the derived balances of every account must sum to zero. Measured on
`fintrack_dev` 2026-08-30: the narrow exclusion sums to `-0.00`; the type-wide one to
`46.20`.

**Agreement with `user_accounts.account_balance` cannot arbitrate**, and not only because
it ties: that column is itself what is being retired, so using it as the referee would
settle the question by consulting the value under suspicion. The counts, stated once so
they are not read as a discrepancy: the first run saw **26 live accounts, 22 agreeing**;
the second saw **27, 23 agreeing** — one account was created in the application between
the two runs. The universe grew by one and the disagreeing set never moved off the same
four. **`fintrack_dev` is written to while it is being measured**, so every count in this
document is stamped with its run rather than treated as a constant.

**The narrow and the type-wide exclusion produce identical balances for every account
except the counterparty account**, so agreement counts could never have separated them
either. The chain that does:

```
the type-wide exclusion drops every account-opening leg,
including the funding legs, which are real outflows
        ↓
money is created: the derived balances sum to +46.20
        ↓
the narrow exclusion differs only by keeping those funding legs
        ↓
the derived balances sum to -0.00
```

**The narrow exclusion is the settled derivation, and it is the only one this plan
defines.** The rejected formulations are not carried here; they are in the evidence file
with the measurement that rejected them.

### 5.1.1 The two invariants this derivation rests on

Stated and verified, because the predicate identifies a row by its shape rather than by a
flag, and a shape that holds for today's data is a heuristic until it is shown to be a
contract.

> **Invariant 1 — `account_starting_amount` is the canonical opening state of the
> account.** It is a property of the account, not a duplicate of a ledger event. The
> destination-side account-opening row is the *accounting representation* of that same
> opening, and it must never affect the starting state a second time.

> **Invariant 2 — at most one destination-side account-opening row exists per account, and
> when it exists its amount equals `account_starting_amount`.** It is therefore the only
> ledger row excluded from that account's derived balance.

**Measured on `fintrack_dev`, 2026-08-30, across all 27 live accounts.** Twenty-six carry
exactly one such row and its amount matches `account_starting_amount` **to the cent**. One
does not, and it is the case that proves the rule rather than breaking it: the counterparty
account carries **two** account-opening rows, both funding legs of *other* accounts'
openings, **none of them destination-side**, and its own `account_starting_amount` is
`0.00`. There the exclusion excludes nothing and the formula degenerates to the plain sum
of the ledger, which is the correct answer for an account that was never opened with funds.

**So the answer to "can an account-opening row be destination-side and not be the opening
credit" is no, and the answer to "can an account have none" is yes** — and the formula is
correct in both cases. What would break it is an account carrying *two* destination-side
opening rows, or one whose amount disagreed with the starting amount. **The query above is
the regression check**; re-run it before the commit and on any future change to the account
creation path.

**One implementation:** `utils/fintrackUtils/accountDataRetrieval/derivedBalance.js`, in
three shapes, all the same arithmetic.

| builder | question it answers | shape |
|---|---|---|
| `accountLedgerCte(accountId)` | what did this account hold at each of its movements | running window |
| `accountLedgerCteForTransaction(txId, userId)` | the same, for the account a movement belongs to | running window, account resolved from the movement |
| `userAccountBalancesCte(userId)` | what does each of this owner's accounts hold now | grouped sum, one pass |

The third exists because a list of accounts wants only the last point of each series, and
because an `ORDER BY` over the balance needs the figure to exist before the sort.

### 5.2 The read sites

**The wire name does not change.** The derived figure is emitted under
`account_balance_after_tr`, the key the frontend already destructures and types, so this is
backend-only and **no frontend file is touched**.

| site | renders | state |
|---|---|---|
| the per-account list queries and the period's opening figure | the panel's figures | landed `a2bd75a`. *(Corrected 2026-08-30: the note that said this file "does not exist" is false. `backend/src/fintrack_api/controllers/getTransactionsForAccountById.js` is present, 543 lines, and it is where the two list queries and `getBalanceCarriedIntoPeriod` live — `:248`, `:328`, `:388`. Only the shared SQL builders live under `accountDataRetrieval/`.)* |
| `transactionController.js` — `getTransactionById` | a single movement's balance | landed `a2bd75a` |
| `getAccountController.js` — the summary's initial / final | the account screen's panel | landed `a2bd75a` |
| `delete_account/getAnnulmentImpactReport.js` | **the deletion screen's balance per affected account** | landed `f7cae5b`, and it was missing from this table |
| `getAccountController.js` — nine list queries, five of which also **`ORDER BY`** the column | every account list | landed `a2bd75a` |
| `pocket_services/db/accountAllocationRepository.js` — two sites | the uncommitted-cash ceiling | landed `a2bd75a` |
| `dashboardController.js` — **29 sites** | the accounting dashboard's totals | landed `f8cce22` |

**The dashboard was not in this plan's original count and it is the largest remaining
surface.** It reads the stored account column ~29 times, mostly as `SUM(ua.account_balance)`
inside grouped totals by account type and currency, plus the debt board's receivable and
payable split. **Leaving it produces the same contradiction on a bigger screen**: every list
derives while the headline totals above them do not. It takes the scalar builder like the
lists do — `SUM(<derived>)` in place of `SUM(ua.account_balance)`.

**The sweep that closed this section, 2026-08-30.** After the write paths were
converted, three readers of the stored column were left in the backend. One was
live and is fixed: the deletion impact report, which showed each affected
account's balance beside the adjustment deleting the target would apply — one
figure from the drifted column, the other from the ledger, describing different
accounts on the screen the owner reads before confirming a deletion. Deleting
the bank listed thirteen affected accounts with three of them wrong; deleting
the compensation account listed four with three wrong, the bank itself among
them at 102.59 against 84.34.

**The other two are unreachable and stay as they are.** The category-budget
detail in `getAccountController.js` is behind a route that is commented out, and
its own comment in the file says so. The `getAccountById` pair under
`accountDataRetrieval/` cannot load at all: it imports `../../src/db/configDB`,
a path that does not exist, with no extension. Neither is fixed and neither is
deleted — a deletion waits for a working module, and "nothing reaches it" is
blast radius, not permission.

**The single-movement detail is the one that reaches a screen unaccompanied** and the
cheapest to get wrong, because a figure with no neighbours cannot be checked against them.

**The locked validation path takes the derivation as a separate statement, after the lock,
never as a join inside the locking statement.** The pocket module checks the
uncommitted-cash ceiling inside `FOR UPDATE OF ua`. In that statement the locked row is
re-read at its latest version while the other tables come from the original snapshot, so a
joined derivation would combine two points in time. Issued afterwards on the same client,
the statement takes a fresh snapshot and the lock still serialises. **If the display path
derives and the validation path does not, the server refuses a commitment with a `422`
quoting a figure the owner was never shown.**

### 5.3 The column also stops being written — a separate commit

Two writers pass the figure — `transactionManagement/recordTransaction.js:80` and
`accountDeletionUtils/recordAnnulmentTransaction.js:137`. Both write `0.00` explicitly,
which the existing `DECIMAL(15,2) NOT NULL DEFAULT 0.00` already accepts, so **no migration
and no DDL change**. A stored `0.00` cannot be mistaken for a balance; a stale figure can.
Both callers keep computing the balance, because `user_accounts.account_balance` stays
persisted.

**Landed `260c54f`, and the precondition was verified rather than assumed.** No
query in the codebase SELECTs the column; the one list that still ships `tr.*`
has the stored value overwritten in JavaScript before the row leaves the
backend. Measured proof: the column was zeroed on all 21 rows of the account
with the most movements, inside a rolled-back transaction, and not one displayed
balance moved.

**What the column was worth by the end: 19 of those 21 rows already disagreed
with the derived figure.** It was never a balance — it recorded what the balance
had been assumed to be at the instant the row was written, and that assumption
had been wrong on nearly every row for a while.

**One thing this did not close, found while doing it.** `deleteAccountService.js`
builds the compensation account's new balance from the stored
`user_accounts.account_balance` (`:203`) and writes the result back (`:285`).
That is the Class D shape again, in the deletion path. It is inert today — every
read derives, so the figure it writes reaches no screen — but it is the same
defect and it is not fixed here.

**Closed since, `83d22ca`, re-measured 2026-08-30.** The deletion path locks and derives
before it decides anything: `deleteAccountService.js:217` calls `lockAndDeriveBalances`
over every account the annulment touches, and the two writes at `:273` and `:311` go
through `updateAffectedAccountBalance` with a figure the ledger produced. The stored
column is no longer an input on that path. §9.1 records the same closure.

**Order is load-bearing: this lands after every read is derived, never before.** While any
site still reads the column, writing `0.00` renders zeros on screen.

Dropping the column is a later migration, once the derived series has been trusted long
enough. **A deletion waits for a working module.**

### 5.4 Disclosure — accounts whose displayed figure will move

Re-measured on `fintrack_dev` 2026-08-30, the database the commit will run against. The
owner has to know which accounts move before the commit, so a corrected balance is not
mistaken for a new bug.

**What is being claimed about these figures, stated precisely.** The derived figure is
*the balance derivable from the surviving ledger under the invariants of §5.1.1*. That is
a narrower claim than "the true balance", and the narrower one is what the measurement
supports. This plan does not prove that the counterparty account's history is complete —
rows are missing from it and two of its openings belong to other accounts. What it proves
is that **a stored balance cannot be the authority when it contradicts the ledger**, since
it is a snapshot of an insertion order rather than a statement about the movements. Where
the ledger is itself incomplete, the derived figure inherits that incompleteness, visibly,
instead of hiding it behind a number nothing supports.

| account | stored | derived |
|---|---|---|
| `slack` | `-75.97` | `-90.22` |
| `banco` | `96.35` | `84.34` |
| `inBestMen` | `2.14` | `1.39` |
| `cuenta precargada` | `135.49` | `207.49` |

Currency is not part of the gap: all four are `usd` and every one of their rows is `usd`.
**`fintrack_dev` is written to while measuring** — `banco` moved and a new account appeared
between two runs the same evening — so **the list is re-taken immediately before the
commit**, not before.

Why the stored column is the broken side, from the earlier run on `fintrack_prod_data`
(785 movements, 97 of 100 accounts reconciled exactly): a deleted movement pair whose ghost
the column preserves; an annulment path that applies each transfer pair twice; and a cent
lost to write-time arithmetic and inherited forever. **None of them is back-dating.** The
measurement did not falsify the derivation — it proved the column was already false without
any back-dating.

### 5.5 The four classes of balance figure — swept 2026-08-30

**The chosen date does not reach every balance the same way, and three of the four classes
need nothing from this plan.** Sweeping every figure the app renders — the account lists,
the per-movement column on a transaction card, the panel's initial and final, the dashboard
totals, the pocket ceilings, the budget spend, the sufficient-funds check — they separate by
*how* a movement's date enters the arithmetic. The classification is what tells the
implementation which figure has to be recomputed on read and which one never could go stale.

#### Class A — the lifetime sum. The date does not enter it.

`account_starting_amount + SUM(every movement except the account's own opening credit)`.
Addition is commutative, so **which day a movement carries cannot change this figure, only
whether the movement exists at all.** A back-dated entry inside the month moves nothing here
that a same-day entry would not have moved.

| what it renders | backend file | name to read |
|---|---|---|
| every account list, nine queries | `getAccountController.js:288, 303, 322, 337, 354, 378, 404, 512, 1014` | `${DERIVED_BALANCE} AS account_balance` *(the last anchor was `:1003`; re-measured 2026-08-30)* |
| the dashboard's totals by type and by currency | `dashboardController.js:57, 177, 194, 208, 355` | `SUM(${DERIVED_BALANCE})` |
| the debt board's receivable / payable split | `dashboardController.js:224, 390` | `total_debt_balance`, `debt_receivable`, `debt_payable` |
| the uncommitted-cash ceiling, display and locked check | `accountAllocationRepository.js:54, 242` | `"accountBalance"` |
| what each pocket holds, and cash freed by a deletion | `accountAllocationRepository.js:96, 130, 164, 272` | `SUM(pa.amount)` |

**Nothing in this class is modified.** The pocket sums are a second ledger with its own
`allocation_actual_date` and this plan does not touch it.

#### Class B — the running series ordered by the date. Retroactive, and the reason for §5.

```
SUM(...) OVER (ORDER BY tr.transaction_actual_date ASC, tr.transaction_id ASC
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
```

The date decides **where the row lands in the series**, so a back-dated insert changes its
own balance *and every balance printed after it*. This is the only class back-dating breaks,
and the whole of §5 exists for it.

| what it renders | backend file | name to read |
|---|---|---|
| the series itself | `derivedBalance.js:216` — `ledgerBody` | `balance` |
| the account screen's transaction cards | `getAccountController.js:102, 109` | `al.balance AS derived_balance_after_tr` |
| the account-detail lists, both queries | `getTransactionsForAccountById.js:248, 328` | `al.balance AS derived_balance_after_tr` |
| the balance carried into a period | `getTransactionsForAccountById.js:388` | `getBalanceCarriedIntoPeriod` |
| one movement's balance, unaccompanied | `transactionController.js:908` | `accountLedgerCteForTransaction` |
| the wire rename onto the old key | `derivedBalance.js:252` — `withDerivedBalance` | `account_balance_after_tr` |

**Two figures inherit from this series rather than computing their own**, and they move when
the series moves:

| what it renders | backend file | name to read |
|---|---|---|
| the account screen's panel, opening and closing | `getAccountController.js:136-156` | `initialBalance`, `finalBalance` |
| the account-detail panel, opening and closing | `getTransactionsForAccountById.js:486, 489` | `getInitialBalance`, `getFinalBalance` *(anchors re-measured 2026-08-30)* |

**A subtlety the owner will see.** In month mode `getInitialBalance` does not return the
balance carried into the period — it returns the balance *after the oldest movement of the
month*:

**Corrected 2026-08-30 — the two are already unified and the branch below no longer
exists.** `getTransactionsForAccountById.js:486-487` reads
`const getInitialBalance = () => getBalanceCarriedIntoPeriod(period.periodStartDate);`
with no month branch, and `getBalanceCarriedIntoPeriod` (`:388`) resolves the
no-movement case in SQL with a `COALESCE` rather than in JavaScript. The candidate commit
this paragraph proposed has been taken; the snippet that follows is the code it replaced.

```js
      if (window.mode !== 'month') {
        return getBalanceCarriedIntoPeriod(period.periodStartDate);
      }
      const oldestTransaction = transactions[transactions.length - 1];
      return { amount: parseFloat(oldestTransaction.account_balance_after_tr), ... };
```

So a movement dated the 3rd, entered when the month's oldest row was the 9th, **changes the
panel's opening figure to a different row's post-balance.** It is not a defect of the
derivation; it is that definition meeting a back-dated row for the first time. The correct
notion already exists three functions above — `getBalanceCarriedIntoPeriod` — and the month
branch does not use it. Unifying the two is a candidate commit of its own, deliberately not
folded into the derivation work.

#### Class C — the aggregate over a date window. Membership, not arithmetic.

The date decides **which month the movement counts in**. Same amount, different bucket.

| what it renders | backend file | name to read |
|---|---|---|
| the budget's spend for one month | `budgetTransactionRepository.js:187` — `SPENT_QUERY`, bounds at `:199-200` | `t.transaction_actual_date` between `$2` and `$3` |
| the budget's spend per month over a range | `budgetTransactionRepository.js:353` — `SPENT_BY_MONTH_QUERY` | `budget_month` *(both anchors re-measured 2026-08-30; they read `:181` and `:346`)* |
| the dashboard's movement lists by period | `dashboardController.js:594, 651, 740` | period bounds |
| the dashboard's monthly totals by type | `dashboardMonthlyTotalAmountByType.js:116-151` | period bounds |
| the transaction lists, filtered to a month | `getAccountController.js:120-123`, `getTransactionsForAccountById.js:281-290, 359-362, 402-411` | period bounds |

**Nothing in this class is modified, and the reason is the month rule of §3.3.** Because the
picker never leaves the current calendar month, a movement can never be filed into a month
that is already closed. **No past budget, no past monthly total and no closed period is ever
restated.** The bound is what makes this class inert; widen it later and every figure here
becomes retroactive at once.

#### Class D — a stale projection AND a missing lock in the write path

Not a read site, and not covered by §5.3. The sweep found a fourth class no earlier section
names, and it carries **two independent defects**. The recording path reads the **stored**
column, computes the next figure from it, and writes it back — a loop that never consults
the ledger — and it does all of that **without ever locking the account row**.

| step | backend file | name to modify |
|---|---|---|
| resolves the account, `ua.*`, stored column included | `transactionController.js:81` — `getAccountInfo` | `SELECT ua.*`, **no `FOR UPDATE`** |
| refuses the movement on insufficient funds | `transactionController.js:647` | `sourceAccountBalance` |
| carries the stored figure forward | `transactionController.js:673` | `newSourceAccountBalance` |
| computes the destination's next figure | `transactionController.js:698` | `destinationAccountBalance`, `newDestinationAccountBalance` |
| writes it back | `transactionController.js:148` — `updateAccountBalance` | `UPDATE user_accounts SET account_balance=$1` |

**The five rows above are the diagnosis, and every anchor in them is now historical —
re-measured 2026-08-30.** What the same path holds today: `getAccountInfo` at
`transactionController.js:94`, still without `FOR UPDATE` and now correctly so, since the
lock is a separate statement; `lockAndDeriveBalances(client, userId, [source, destination])`
at `:678`; the funds check at `:688-694`, comparing `money(ledgerBalances.get(...))` against
`money(numericAmount)` — decimal, not `parseFloat` (`6deddc8`); and the write-back through
`setAccountBalanceFromLedger` at `:832` and `:838`, which re-derives the column from the
ledger instead of storing a figure computed in JavaScript. `newSourceAccountBalance` and
`newDestinationAccountBalance` survive only inside comments (`:737`, `:789`, `:856`,
`:875`).
| the same loop at account creation | `accountCreationController.js` | **converted** `921bd21` |
| and at category-account creation | `accountCategoryCreationcontroller.js` | **converted** `921bd21` |

**Defect one — the figure is wrong.** `cuenta precargada` reads `135.49` stored against
`207.49` derived (§5.4), so the funds check at `:647` admits or refuses against a ceiling
wrong by 72.00 — and the error message quotes that ceiling to the owner.

**Defect two — nothing serialises two concurrent movements, and it is the graver of the
two.** `BEGIN` at `:486` gives atomicity, not exclusion: `getAccountInfo` is a plain
`SELECT` with no `FOR UPDATE`, so two simultaneous movements on one account both read the
same prior state, both pass the guard, and both write. **This produces a wrong decision even
if the stored balance were perfectly correct when the transaction began**, which is why
correcting only the figure would leave the guard exactly as vulnerable as it is today.

**The error is also propagated rather than absorbed.** `newSourceAccountBalance` is
`stored − amount`, so a divergence once introduced is rewritten intact by every later
movement. Deriving makes it `derived − amount`, and **the projection then self-heals on the
next movement of each account** — which shrinks the eventual drift repair to the accounts
that never move again.

**It is also an ordering constraint on §5.3.** That commit stops persisting the per-row
`transactions.account_balance_after_tr` and deliberately leaves `user_accounts.account_balance`
persisted; Class D is why. Stop writing that second column while this loop still reads it and
every movement is refused against a balance of zero. **Class D is converted before
`user_accounts.account_balance` is ever retired**, and retiring it is not in this plan.

##### What the conversion measured, 2026-08-30

Five of the owner's twenty-eight accounts differ from the stored column, and the
two that decide a request differ in opposite directions:

| account | stored | derived | what the old check did |
|---|---|---|---|
| `banco` (bank) | 102.59 | 84.34 | admitted a loan of 95 the account cannot cover |
| `cuenta precargada` (bank) | 135.49 | 207.49 | refused draws it could afford |
| `slack` (bank) | −75.97 | −90.22 | no check; the figure reached the audit trail |
| `inBestMen` (investment) | 2.14 | 1.39 | — |
| `Bolivar, Simon` (debtor) | −6.24 | −12.48 | — |

**The permissive direction is the dangerous one.** A ceiling that is too high
admits a movement the ledger cannot support, and the refusal message quoted that
same wrong ceiling back to the owner, so the screen agreed with itself while
disagreeing with the money.

**`lockAndDeriveBalances` moved to `utils/fintrackUtils/accountManagement/`.** It
was defined inside `transactionController.js`, which made the second caller
choose between importing one controller from another and copying the invariant.
Neither is acceptable for the one function that decides how a money decision
reads a balance.

##### The frozen contract — settled 2026-08-30, implementation follows it

Three responsibilities, and none of them borrows another's:

```
getAccountInfo(client, { accountId, accountName, accountTypeName, userId })
    -> identity, ownership and account type. No lock, no balance.

lockAndDeriveBalances(client, userId, accountIds)
    -> locks EVERY affected account, ascending account_id
    -> derives their balances in a SECOND statement, after the locks
    -> returns Map<account_id, NUMERIC-as-text>

transferBetweenAccounts(...)
    -> resolve, lock+derive, enforce, insert the ledger row, update the projection
```

```
BEGIN
  ├─ resolve source          getAccountInfo
  ├─ resolve destination     getAccountInfo
  ├─ LOCK both               ORDER BY account_id ASC, FOR UPDATE
  ├─ DERIVE both             a second statement, after the locks
  ├─ sufficient-funds check  against the derived source balance
  ├─ insert the ledger rows
  └─ updateAccountBalance    from the derived figures, not the stored ones
COMMIT
```

**The ascending order is the deadlock argument, not a style preference.** A transfer
`A -> B` racing a transfer `B -> A` would, locking in the direction of the movement, have
each transaction holding the row the other waits for. Locking by ascending `account_id`
gives both the same global order — `10` then `20` — so one waits and the wait-for cycle a
deadlock needs never forms.

**The derivation is a second statement and never joined into the locking one.** This is the
pattern `accountAllocationRepository.js:227-248` already proves: inside a locking statement
the locked row is re-read at its latest committed version while every other table is still
read from the statement's original snapshot, so a derivation joined there would combine the
lock's view of the account with a stale view of `transactions`. Issued after the lock is
held, the second statement takes a fresh snapshot and sees every movement the competitor it
just waited out committed.

**Ownership is an invariant of the helper, not a precondition inherited from the caller.**
Both statements filter on `user_id`, including the derivation, even though `getAccountInfo`
has already proven ownership on this path. A helper whose safety depends on what its caller
happened to do first is a helper that is unsafe the first time it is called from somewhere
else.

**Deliberately outside the first commit, and each for its own reason:**

| left out | why |
|---|---|
| `accountCreationController.js`, `accountCategoryCreationcontroller.js` | the same loop on the account that *funds* an opening, but a different transactional flow that needs its own concurrency analysis |
| money through a float — `sourceAccountBalance < numericAmount` | real debt, and exactly what the pocket module forbids itself, but converting this controller's arithmetic to decimal is its own change — **taken since, `6deddc8`; the comparison at `transactionController.js:688-694` is `money().lessThan(money())`, importing `money` and `toAmountString` at `:42-47` from `budget_services/core/money.js`, and the refusal now throws `createError(400)` so the transaction rolls back** |
| retiring `updateAccountBalance` | the projection is kept on purpose: the point is to prove enforcement works off the ledger *before* the projection goes — **overtaken 2026-08-30: `accountManagement/updateAccountBalance.js` is deleted in the working tree and `setAccountBalanceFromLedger.js` writes the projection as `derivedAccountBalanceSql('ua','NUMERIC')`. The projection is still persisted; what went is the JavaScript arithmetic behind it** |

#### The four read sites still on the stored column

**Corrected 2026-08-30 — two of the four are closed and the count in this heading is
wrong. The live one, the account detail, is closed at exactly one site.**

- The account detail and the edition form: `17a0714` (`fix(account): derive the detail
  screen balance`). The basic-data query in `getAccountController.js` selects
  `${derivedAccountBalanceSql('ua','NUMERIC')} AS derived_account_balance` at `:592`, and
  `:822-824` overwrite `data.accountList[0].account_balance` with it and delete the helper
  key, so the wire name does not change. **One site, not several.**
- The deletion module's impact report: `f7cae5b`. `getAnnulmentImpactReport.js:9` now
  builds `DERIVED_BALANCE` from `derivedAccountBalanceSql('ua','FLOAT')`, as §5.2 already
  records.
- The two that remain are the two unreachable ones already named in §5.2 —
  `getAccountDataById.js:18, 60`, which cannot load because it imports
  `../../src/db/configDB`, and `getCategoryBudgetFullData` at
  `getAccountController.js:187, 218`, behind a route commented out at
  `accountRoutes.js:91`. Neither is fixed and neither is deleted.

They belong to Class A by arithmetic, so no reordering affects them — they are simply wrong
by the divergence of §5.4.

| site | backend file | reached by |
|---|---|---|
| the account detail and the edition form | `getAccountController.js:588` — `getAccountById` | `GET /:accountId`, `GET /details/:accountId` — ~~live, converted next~~ **closed `17a0714`, at `:592` and `:822-824`** |
| the deletion module's impact report | `getAnnulmentImpactReport.js:55, 73` | ~~`ua.account_balance AS affected_account_current_balance`~~ **closed `f7cae5b`** |
| an account read no route reaches | `getAccountDataById.js:18, 60` | dead — still stored, still unreachable |
| the category-budget full read | `getAccountController.js:187, 218` — `getCategoryBudgetFullData` | route commented out — still stored, still unreachable |

`getAccountById` selects the stored column inside `ua.*` rather than naming it, which is why
the textual sweep of `a2bd75a` did not reach it. The fix is one line — `${DERIVED_BALANCE} AS
account_balance` placed after `ua.*`, so the later alias wins. **Shipped as `17a0714`, and
by a different route than the one proposed**: the query aliases the derivation to
`derived_account_balance` at `:592` and the response object is overwritten in JavaScript at
`:822-824`, which keeps the wire name `account_balance` without depending on alias
precedence.

---

## 6. The control — five screens, one commit each

Last on purpose: the only visible half, and the only one that cannot corrupt data. **No
screen ships before the resolver exists.**

**Superseded: six files carry `transactionActualDate` today** — the four tracker screens
that share `useTransactionDate`, PnL, and the hook itself. What follows described the
state before `81dbb5c` and is kept for the safety argument it makes, not as a
measurement of the current tree. **The Expense screen is what
introduces the client-side calendar-day field**, and until it ships no request can carry a
past date, whatever the server would accept. That is the mechanism behind the safety rule of
§7, stated as a fact about the code rather than as a figure of speech.

**The shared control** is `general_components/datepicker/Datepicker.tsx`. Its bounds were
module constants, `1900` and `2100`; the real bounds are per account and per owner zone, so
they became props with those two as fallback. Its `isReset` prop was declared and never
read — deleted rather than implemented, because the component is controlled through
`selected={date}` and an internal flag would only fight the incoming value. **Landed**
`7693fb0`.

**The state lives in each form, never in the layout.** A layout-owned date survives a route
change and carries a date picked on another screen.

**Three validation systems, not one:**

| system | file | screens | what the date needs |
|---|---|---|---|
| zod | `zod_schemas/trackerMovementSchema.ts` | Expense · Income · Transfer | an entry in each of the three objects |
| a hand-rolled registry | `validationPnL/validationPnL.ts:152-164` | PnL | the entry exists and returns true for everything; rename it and give it the bounds |
| a generic whole-object validator | `utils/custom_validation.ts:4` | Debts | **no entry at all**, and none is added |

**Debts keeps its generic validator.** `validationData` already walks every key including
`date`, and a `Date` passes every branch. The client-side bound does not live in a schema on
any screen — it is the picker's `minDate`/`maxDate`, and a day the calendar will not let the
owner press never reaches validation. Adding a `debtsSchema` beside the four places that
already write validation messages would leave two validators writing the same object with
different text. **Migrating Debts onto `useFormManager` is its own commit, after this plan
and outside it.**

| # | screen | today | needs |
|---|---|---|---|
| 10 | Expense | no date in state, none in the payload | the state field, the picker, the schema entry |
| 11 | Income | the same | the same |
| 12 | Transfer | a commented-out field, nothing live | the same, and the dead comment goes |
| 13 | Debts | `date: new Date()` in state and on the wire, **with no control that sets it** | rename to `transactionActualDate`, send a calendar day, draw the picker. No schema entry |
| 14 | PnL | **the only screen with a picker**, sending a `Date` object | rename the payload field, send a calendar day, adopt the bounds |

**Three of the five need no payload edit** — Expense, Income and Transfer build the body by
spreading the validated object, so the field reaches the request the moment it exists in
state. PnL is the only screen whose payload literal changes.

No visible label: the field is identified inside the picker's own control.

---

## 7. Order of work

**The numbers are names, not a sequence.** They are kept because other documents cite them.
The rule that does not move: **the whole backend lands before the first picker is drawn**,
so by the time a date can be sent, every figure it can produce is correct.

| # | commit | state |
|---|---|---|
| 1 | `fix(account): untie updated_at from the movement` | **landed** `1208310` |
| 2 | `feat(tracker): validate the movement date` | **landed** `6adc8de` |
| 4 | `feat(fx): fetch the trm of a past date` | **landed** `41502fd` |
| 7 | `feat(fx): fetch the rates of a past date` | **landed** `95b321d` |
| 9 | `fix(datepicker): drop the dead reset, add maxDate` | **landed** `7693fb0` |
| 3 | canonical reads — every balance from the ledger | **landed** across `a2bd75a`, `f8cce22`, `f7cae5b` and `17a0714`, §5.2 *(was "in progress"; re-measured 2026-08-30)* |
| 3a | the account detail stops reading the stored column | **landed** `17a0714`, §5.5 *(was "not written")* |
| 3b | the funds check derives under a lock, ascending-id | **landed** `7bc1aa7`, §5.5 |
| 5 | `feat(fx): add the Banca d'Italia rate provider` | **landed** `e7dc38a` |
| 6 | the historical rate store — `daily_exchange_rates`, its own table | **landed** e0bfc60, §4.5.1 |
| 8 | the cascade resolver | **landed** `ddadb7d`, §4.5.2 |
| 15 | `currencyAmountConversion` takes `asOfDate` | **landed** `34b6e18`, §4.5 |
| 16 | the transfer values itself at its own date | **landed** `664ad5c`, §7.1 |
| 3c | Class D at account creation — lock and derive there too | **landed** `921bd21`, §5.5 |
| 3d | the deletion impact report reads the ledger | **landed** `f7cae5b`, §5.2 |
| 3e | the per-row balance stops being persisted | **landed** `260c54f`, §5.3 |
| 17 | the budget status payload ships each account's opening day | **landed** `2b4d3dc`, §3.3.3 |
| 18 | the legacy `date` key leaves the wire | **landed** `ebd7622`, §3.1 |
| 19 | the deletion corrects against the locked ledger | **landed** `83d22ca`, §5.5 |
| 20 | one `updateAccountBalance`, not two | **landed** `be6ebbf`, §10 |
| 10–14 | the five screens | **landed** `81dbb5c`. All five send `transactionActualDate`; four share
`useTransactionDate` and PnL keeps its own calendar with the bounds |

```
commit 5 (landed) ──┐
                     ├──► commit 8 ──► commit 15 ──► commits 10–14
commit 7 (landed) ──┤
commit 6 ───────────┘

commit 3 ──► commits 10–14
commit 3b ──► before user_accounts.account_balance is ever retired
```

**Why each edge exists.** Commits 5 and 7 precede the resolver because it orders the arms
and cannot order what is not written, and commit 6 joins them because the resolver reads the
store before it reaches for an arm at all — build it after and the first month of movements
pays a network call each. **Commit 15 is the one that makes any of it visible**: until
`currencyAmountConversion` takes `asOfDate`, the resolver exists and nothing calls it, which
is the state a back-dated foreign-currency movement is stamped with today's rate in. The reads precede the screens because a back-dated row
inserted mid-history makes a stored running balance show a step backwards. **The resolver
precedes every screen**, and that is a safety rule rather than a preference: a past date the
guard accepts has no historical rate until the resolver exists, and a foreign-currency
movement in that window would be stamped with today's rate.

Commits 4, 5 and 7 are each dead code on arrival — a function nobody calls. That is
deliberate: it makes each provider verifiable on its own against the measured figures before
the resolver can mask which arm answered.

**The unambiguous state of the Banca d'Italia arm, 2026-08-30.** Three facts that have been
read as three different states:

> **Superseded 2026-08-30.** The arm landed whole as `e7dc38a`, with the two fixes below
> folded into it, and the ledger row above says so. The paragraph is kept because the state
> it describes was read three different ways on the same day and the record of how it was
> settled is worth more than the deletion. What it said at the time: the provider file
> existed only in the working tree, the two fixes sat on top of it, and nothing about the
> arm was in git history, so "landed" applied to no part of it until the commit went in whole.

**The two fixes.** Its date normaliser accepted a `Date` and read it in UTC, so a movement
at 20:00 for an owner at UTC−5 resolved to the next day and stamped the wrong day as
provenance; the branch is deleted and the module now refuses an instant at its boundary.
Its two decorative comment rules are out. Both verified by loading the module: a `Date` and
an impossible day such as `2026-02-31` are refused before any request is attempted.

**The caller sweep that closes the instant-at-the-boundary risk, measured 2026-08-30.** The
function's behaviour alone does not prove the flow is safe — no caller may supply a `Date`.
Two functions carry this name and they have opposite contracts, deliberately:

| where | contract | callers |
|---|---|---|
| `frontend/helpers/functions.ts:355` | **takes** a `Date`, reads local parts, returns `YYYY-MM-DD` | two, both in the pocket forms |
| `bancaDItaliaProvider.js:57`, private | **refuses** a `Date`, accepts only `YYYY-MM-DD` | two, both internal, both passing strings — the payload's own `referenceDate` and the caller's argument |

**That is the architecture-wide rule with exactly one implementation point.** A timestamp
becomes a calendar day **once, on the client, on the owner's calendar**; every boundary
downstream refuses an instant rather than converting one. The two are not a contradiction
to be harmonised, and a later reader must not "fix" the backend one into accepting a `Date`.
The arm's only external entry is `fetchBancaDItaliaRate(currency, date, options)`, whose
sole future caller is the resolver, which the contract obliges to pass a calendar day.

**Two things about commit 5 to record rather than change.** The walk-back cap of five
attempts has **zero margin** — over 679 published days the largest gap between two published
days is exactly five, four times, and Easter Monday hits on the fifth attempt. And the arm
returns `source` and `effectiveDate` separately, as its Colombian sibling does; composing
the stamp is the resolver's job.

---

## 8. Still open

| # | question | blocks |
|---|---|---|
| ~~8.1~~ | ~~the window endpoint's contract~~ | **closed 2026-08-30**, transcribed in §4.5 |
| ~~8.2~~ | ~~whether the credentialled arm stays in V1 at all~~ | **closed 2026-08-30**, it is out |

### 8.1 The daily-window query — closed, contract transcribed

**The decision is not open and is not revisited.** What remains open is one measurement.

**Closed 2026-08-30: the window is the arm's primary query and the day-by-day walk-back
stays as its internal fallback.** One call instead of up to five against the same host, same
quote convention, no credential; it removes the zero-margin cap rather than raising it; and
it frees about 0.8s of the 5s ceiling, which is what a third arm needs to run at all.
Measured: one call at 0.87s against ~1.71s for an exhausted walk-back, and thirty days weigh
3,629 bytes. **The last row of a window ending on the requested day is digit for digit what
the walk-back returns.**

**Closed 2026-08-30, later the same day.** The handshake that had been refused earlier
succeeded on a retry — 3,577 bytes in 0.83s, HTTP 200 — so the refusal was transient and
not a weekend policy, which it could not have been in any case: a closed market returns an
empty dataset over a completed TLS session, and that emptiness is the very signal the
cascade reads. The contract is transcribed in §4.5 and the query is now a transcription.

**The measurement changed one thing beyond the transcription.** Closed days come back as
absent rows, so the requested-to-effective resolution falls out of the response and does
not have to be stored separately. That is what let the rate store of §4.5.1 answer a
Sunday from a Friday row with an inequality instead of a second table.

### 8.2 The credentialled arm

**Closed 2026-08-30: it is out of V1, and the cascade shipped without it.** The four arms
the resolver actually calls — the identity of the accounting currency, the store, Banrep
and Banca d'Italia, with the CDN behind them — cover every currency the owner records.
It is also the only credential the release would carry, and its host name appears in no
file of this repository, so there is nothing to disconnect: there is only something that
was never connected. Reversing this costs one arm in one file.

**The claim is that it is not necessary for V1, not that it is a bad source.** Nothing here
measures it as inaccurate — on the contrary, it carries a Friday forward across a weekend
where the CDN fabricates movement, which is better behaviour. What disqualifies it from this
release is scope and cost, not quality.

- **Its window is today−5 to tomorrow**, so it cannot answer the older half of the problem
  this block exists to solve.
- **It is the only credential in V1**, dragging a deploy-gating rotation into the block.
- **Its base URL exists in no file of this repository** — a full sweep on 2026-08-29 found
  only the credential's name, in four documents. It cannot be found by looking again; it
  has to be asked for.
- **The three remaining arms already cover all four currencies across the whole range**, so
  removing it leaves no currency without a source.

> **Status, set by the developer 2026-08-30: not required for V1; the recommendation to
> drop it remains open.** This is deliberately not an implementation decision. The arm is
> neither a defect nor a requirement, and the document does not get to settle it. It blocks
> nothing in the meantime: the resolver is written against the three arms that exist, and if
> this one is ever adopted it enters as its own unit with its own justification.

**Recommendation: drop it from V1**, returning later if corroboration in the recent window
is wanted. The plan will say "removed from V1" only once the developer says so.

The credential rotation itself **left this plan**: it is operational security maintenance
that gates the deploy, not this module's design, and lives in
`PLAN_DEPLOYMENT/PLAN_PRODUCTION_MERGE.md` section 4, item 9.

---

## 9. Verification

**No test runner exists anywhere.** *Verified* means exercised by hand.

**The authority for a balance changes at commit 3, and the checks change with it.** Before
it, the stored columns are what the application shows, so they are the thing the derivation
is compared against. After it, they are retired — and a retired value cannot be the referee
for the thing that replaced it. Comparing against them afterwards would be asking the
suspect to grade the investigation.

**Before commit 3 — comparability, and it exists only in this window**

| check | against |
|---|---|
| the derived series, row for row | the stored `account_balance_after_tr` |
| the last point of each derived series | the stored `user_accounts.account_balance` |
| the two invariants of §5.1.1 | the account creation path's actual output |

On data with no back-dating in it the two methods cannot legitimately disagree, so a
discrepancy is a bug in the derivation. **That check ran**, and the accounts that failed it
failed because the stored column was already broken without any back-dating — a deleted
movement pair whose ghost the column preserves, an annulment applied twice, a cent lost to
write-time arithmetic (§5.4). Once the writers switch (§5.3) this comparison no longer
exists, so it cannot be deferred.

**After commit 3 — the ledger's own properties, which need no stored column**

| check | property |
|---|---|
| every account's derived balance summed | **zero**: the ledger is double-entry |
| row by row, in `transaction_actual_date ASC, transaction_id ASC` order | `balance(n) = balance(n-1) + amount(n)`, except at the excluded opening row, where `balance = account_starting_amount` |
| a back-dated insert | appears in its chronological position, and **every subsequent derived balance reflects it** |
| the two invariants of §5.1.1 | still hold after the insert |

**No check anywhere asserts that a balance only goes up.** A ledger of `+100, −30, +20, −50`
produces `100, 70, 90, 40`, and the step down is correct. What the third row above tests is
**chronological consistency** — that the series recomputes around an inserted row rather
than appending it — which is the actual property back-dating has to satisfy.

1. `APP LOADED OK` on boot; the frontend typecheck exits 0.
2. **The date lands.** An expense dated three days back shows that date in the account
   detail, not today.
3. **The bounds hold.** A date before the account's opening and a date tomorrow both return
   `422` naming the bound they broke.
4. **The inclusive bounds.** A movement on the account's own opening day is accepted,
   including when the account was opened late in the evening. A movement dated today routes
   to the live orchestrator, not the cascade.
5. **Both legs agree.** A transfer dated in the past puts both rows in the same month.
6. **The series recomputes around the insert.** With a back-dated row inserted mid-history,
   it appears in its chronological position and every later derived balance reflects it —
   `balance(n) = balance(n-1) + amount(n)` down the whole account. **Not monotonicity: a
   balance may fall and that is correct.**
7. **The detail agrees with the list.** `GET /transactions/:id` on the back-dated movement
   reports the same balance the list shows for that row.
8. **The lists agree with the detail.** The four accounts of §5.4 render the same figure in
   the account list, the account header and the pocket picker.
9. **The ceiling the server enforces is the ceiling the screen showed.** Committing exactly
   the displayed uncommitted cash is accepted, not refused by a `422`.
10. **The month restates.** The budget month of the back-dated expense shows the new spend;
    adjacent months are unchanged.
11. **`updated_at` is now.** Both touched accounts report today, not the movement's date.
12. **Provenance**, against figures verified live. A `cop` movement on `2026-05-14` stores
    `3794.91` sourced `banrep-trm@2026-05-14`; the same date in `ves` stores `510.15` sourced
    `bancaditalia@2026-05-14`; a `usd` movement stores rate 1 with `identity`.
13. **The weekend.** A movement dated Saturday `2026-05-16` stores the rate of `2026-05-15`
    and says so.
14. **The cascade gives up instead of hanging.** With the network cut, a past-dated
    foreign-currency movement returns `422` inside the 5s ceiling and stores nothing — in
    particular, no movement carrying today's rate.
15. **The reset.** Submitting returns the picker to today; the next movement does not inherit
    the previous date.
16. **Five screens** on-screen at 360, 400 and 768px. They are already not uniform, so one
    screen passing is not a pass.
17. `git status` clean of `plan-docs/`.

---

## 9.1 What is still open after the backend closed — reviewed 2026-08-30

The backend of this plan is complete and every screen sends the day. Four things
in the code and one whole class of verification are not.

**All four closed the same day.**

| was open | closed by | what it measured |
|---|---|---|
| the category selector was never filtered by the chosen day | `2b4d3dc` | on 2026-08-12 the form offers 3 of 17 categories, not 17 |
| the legacy `date` key travelled beside the calendar day | `ebd7622` | two answers to one question; the controller only logged the second |
| the deletion corrected balances from the stored column | `83d22ca` | deleting `cuenta precargada` wrote the compensation account at 11.95, now −2.30 — the sign flips |
| two implementations of `updateAccountBalance` | `be6ebbf` | same SQL byte for byte; only one logged its error |

**What remains is the verification, and one gap on the creation path (§9.2).**

**None of the seventeen checks of §9 has been run.** There is no test runner, so
each one is a hand exercise against the live app, and the app has not been driven
end to end since the first of these commits. What has been verified is narrower
and should not be mistaken for it: each commit was exercised against the live
database and the live rate sources through a script, and the backend boots. The
frontend typecheck exits 0.

**Two of those checks can only be run now, and one can never be run again.** The
comparison of the derived series against the stored per-row column existed only
until §5.3 switched the writers; it ran before that and cannot be repeated. The
chronological-consistency check — that a back-dated row lands in its position and
every later balance recomputes — has no substitute and has not been done.


## 9.2 The creation path never joined this plan — found 2026-08-30

Every screen that records a **movement** sends the chosen day and the backend
prices it at that day's rate. Every screen that **opens an account** does not.
The block was scoped to transactions and the creation controllers were never
read into it.

**What was measured.** `currencyAmountConversion` has nine callers. Exactly one
passes a date: `transactionController.js:400`. The four on the creation path do
not — `accountCreationController.js:189` and `:656`,
`accountCategoryCreationcontroller.js:232` and `:247` — although the day is in
scope at each of them as `account_start_date`.

**Two consequences, both live.**

| defect | effect | state |
|---|---|---|
| the opening amount is converted undated | opening a euro account dated in June values it at **today's** rate, which is the exact defect this plan exists to close | open, blocked |
| nothing rejects a future opening day | neither controller validates the date at all — no format check, no future check, no month floor | open, blocked |
| the calendar offered 1900–2100 | `NewAccount.tsx` passed no `maxDate`, so it fell to the component default; a forward-dated account is then hidden from every tracker selector by `isAccountOpenOn` with nothing on screen saying why | closed by `5144129` |

**Why the two backend rows are blocked and not merely pending.** Two reasons,
each sufficient on its own.

The files carry another session's uncommitted work on the single-balance-writer
change. Editing them now puts an FX change and a balance change into one
unreviewed diff, and Carlos has said he reads that diff before it lands.

The second reason outlives the first. The canonical derivation excludes an
account's own opening row by testing `tr.account_id = tr.destination_account_id`,
identical at `derivedBalance.js:142`, `:200` and `:225`. That test infers the
opening leg from the direction of the money, which holds only when the money
flows toward the account being opened. For a debtor the user OWES, the debtor is
the source leg and the funding account is the destination, so both legs carry the
funding account as destination and the test cannot tell them apart. Reported
measured against `fintrack_dev` by the peer session, not re-measured here:
account 54 derives −12.48 against a starting amount of −6.24, and the same row
drops a real 6.24 inflow from the funding account's ledger.

**This orders the two.** The opening leg must be identified before the opening
amount is valued at a historical rate. Fix the FX date first and a row-selection
defect starts reading as a currency discrepancy, which is much harder to find.

**The floor is an open decision, not an oversight.** The form now refuses a
future day because an account cannot have been opened after today, which is a
domain truth and needs no ruling. How far *back* an opening may be claimed is a
ruling nobody has made. Two candidates: the first day of the current month, the
same window movements live in; or the earliest day the rate cascade can price,
which measured at 2019-12-27 for the euro. Neither is assumed — the form still
offers 1900 as its floor until this is settled.

### 9.2.1 The blockers cleared, and a fifth undated site — measured 2026-08-30

**Both reasons 9.2 gives for calling the two backend rows blocked are spent.**

The uncommitted work in the creation controllers landed. `d41aca2` restored the
funding account's balance write and made the opening leg declare which account it
opens; `3de47e4` closed the deletion path, the last writer that stored a figure its
caller had computed in JavaScript. The peer session released both controllers and
the backend tree is clean.

The row-selection defect is closed. `7434601` added
`transactions.opening_for_account_id` and backfilled the opening rows on both
conditions — the earliest `account-opening` row for the account AND an amount equal
to `account_starting_amount`, the movement type read from `movement_types` by name
rather than as a literal. `3c6e1e0` flipped the three builders in
`derivedBalance.js` to test `tr.account_id = tr.opening_for_account_id` at `:154`,
`:212` and `:237`.

**Re-measured here, not carried over from the peer.** Both predicates were run side
by side over every live account against `fintrack_dev`. Exactly two accounts move,
which is what the argument predicted:

| id | account | stored | derived, marker test | derived, direction test |
|---|---|---|---|---|
| 54 | Bolivar, Simon | -6.24 | **-6.24** | -12.48 |
| 15 | banco | 102.59 | **90.58** | 84.34 |
| 14 | slack | -75.97 | -90.22 | -90.22 |
| 17 | inBestMen | 2.14 | 1.39 | 1.39 |
| 24 | cuenta precargada | 135.49 | 207.49 | 207.49 |

Account 54 now derives its starting amount to the cent. The other four rows are a
separate question: the stored column drifted from the ledger for causes this change
does not touch, and the single writer only re-derives an account the next time it
moves.

**A fifth undated call site, which 9.2 does not list.** The count of nine callers is
right; the classification is not. `budgetAllocationService.js` validates the
requested month against the account's opening month at `:231` and then converted the
amount at `:245` with today's rate, nine lines later. A budget saved for March was
valued at the rate of the day it was saved.

Closed by `b4e02fe`, which passes `month` as the conversion's fourth argument. The
day chosen is the one the period BEGINS on, `YYYY-MM-01`, including for the current
month: a month is a period, not an event, and reproducibility requires that the same
figure saved twice for the same month give the same amount. The rejected
alternative — today for the current month, the 1st for past months — splits the rule
in two and makes one March budget worth two different figures depending on the day
it was entered.

Verified against `fintrack_dev` with the arguments the service passes:

| case | result |
|---|---|
| current month, 500 eur to usd at 2026-08-01 | rate 1.1485, source `bancaditalia@2026-07-31` |
| past month, 500 eur to usd at 2026-03-01 | rate 1.1805, source `bancaditalia@2026-02-27` |
| unpriceable, 500 eur to usd at 1990-01-01 | **422**, no fallback to the current rate |
| accounting currency, 500 usd to usd at 2026-03-01 | rate 1, source `identity@2026-03-01` |
| control, the same call undated | rate 1.1597, source `exchange-rate-api` |

The control is the measure of the defect: the same 500 EUR for March is 590.25 under
March's rate against 579.84 under today's, 10.40 on a single allocation.

**A drifted anchor.** The second creation-path caller is at
`accountCreationController.js:658`, not `:656`.

**The four creation-path sites are unblocked** and are the next unit. Nothing about
them changed except that both reasons for holding them are gone.

**What this hands the frontend.** The budget screen can now receive a 422 where it
always received a 200. `budgetApi.ts` has to surface the backend's message rather
than a generic failure. That is a frontend commit and deliberately not part of
`b4e02fe`.

**The floor decision gains a user-visible edge.** 9.2 leaves the earliest claimable
opening day open and the pickers still default to 1900 — `MIN_DATE` at
`Datepicker.tsx:48`, `MIN_MONTH` at `MonthPicker.tsx:38`. Until it is settled, a
screen that passes no `minDate` of its own offers a day the cascade cannot price,
and the refusal is no longer silent: it is the 422 measured above. The rate store is
not a candidate for that floor — it holds 51 rows, filled on demand, and `usd` to
`cop` has exactly one day in it.

---


## 9.3 The frozen error contract, and what the frontend owes it — 2026-08-31

Two commits closed the creation path. `68730da` bounds the opening day to the
month in course and values the conversion on that day; `f650d96` gives the
resulting errors a machine-readable identity.

### The wire contract

A domain error now answers with `status`, a human `message`, and — when the
thrower declared one — a stable `error` code plus a `details` object carrying
the values the message mentions, already parsed.

| condition | HTTP | `error` | `details` |
|---|---|---|---|
| not a calendar day | 400 | `INVALID_OPENING_DATE` | `expectedFormat` |
| dated after today | 422 | `OPENING_DATE_AFTER_TODAY` | `openingDay`, `today` |
| dated before this month | 422 | `OPENING_DATE_BEFORE_CURRENT_MONTH` | `openingDay`, `currentMonthStart` |
| no rate for a valid day | 422 | `FX_RATE_UNAVAILABLE` | `currency`, `requestedDay` |
| unsupported currency | 400 | `UNSUPPORTED_FX_CURRENCY` | `currency` |
| unparseable FX date | 400 | `INVALID_FX_DATE` | `expectedFormat` |
| FX date after today | 422 | `FX_DATE_IN_FUTURE` | `requestedDay`, `today` |

An error that declares no identity keeps the body it has always returned. The
rest of the API is untouched by design: this is not a transversal refactor.

### FE-1 — branch on `error`, never on `message`

The frontend must switch on the `error` code and render its own copy. Matching
the English sentence puts presentation back into the contract, which is the
exact problem the code exists to remove. The message is a fallback for a
condition that has no code yet.

Owner: the account creation forms and whatever shares their request helper.

### FE-2 — the picker floor — DONE, 29db31e

`NewAccount.tsx` gained `earliestOpeningDay()`, mirroring the ceiling already
beside it, and passes it as `minDate`. The calendar now offers 2026-08-01 to
2026-08-31 against a server window of the same two days.

Written as a local helper, not extracted into `useTransactionDate`: the file
already carries `latestOpeningDay()` as a local duplicate of the same idea, and
extracting would touch a hook four forms depend on to save two lines. KISS.

### The FX store is unevenly warmed — measured 2026-08-31

Not a bug in this plan's code; a live gap the opening-day work exposed. What the
historical store actually holds:

```
cop    1 day     2026-08-26 .. 2026-08-26
eur   96 days    1999-01-04 .. 2026-08-28
mxn    —         nothing
ves    —         nothing
```

`eur` is well covered because one `dailyTimeSeries` range call brings a whole
month back at once. `cop` holds one row because the Banrep arm stores only the
TRM's effective date, not a range. `mxn` and `ves` have never been asked for.

The consequence, on the day it was measured: a `cop` opening resolves only
because 08-26 is exactly `MAX_RATE_AGE_DAYS` back. On 2026-09-01 that row falls
out of the window, and every `cop` opening goes to the network. An `mxn` or
`ves` opening already does, paying up to the 5000 ms cascade budget before the
screen answers.

Batching is not available: both Banca d'Italia endpoints take one currency and
quote it against USD. So the fix is not fewer calls — it is the same four calls
moved off the user's request path. Warm the current month for the four
non-accounting currencies at boot; every opening then reads SQL.

Own commit, not scheduled. It is where the real work is, and it is independent
of everything above.
window is already computed for movements in `useTransactionDate.ts`; extract it
### The contract is closed — f8ce0f7

The four resolver conditions carry stable codes as of `f8ce0f7`. The cascade's
attempt log left the response body: it names providers and their failures, which
a client cannot act on, and it now goes to `console.error` instead. Verified
end to end, including a forced exhaustion with a 1 ms cascade budget:

```
log      No historical rate for eur on 2020-03-17. Tried -> bancaditalia: ... | cdn: ...
response {"message":"No historical rate for eur on 2020-03-17.","status":422,
          "error":"FX_RATE_UNAVAILABLE","details":{"currency":"eur","requestedDay":"2020-03-17"}}
```

Only `FX_RATE_UNAVAILABLE` is reachable from a valid account opening — the other
three are already filtered by `resolveOpeningDay`. They still matter because
Transactions share the resolver.

Nothing further is owed to the backend contract. The next work is the frontend:
FE-1 above, then FE-2.

### The open finding: the resolver reads UTC, not the owner's calendar

`historicalRateResolver.js` computes today as `new Date().toISOString().slice(0,10)`
before refusing a future day. That is the UTC day, while every caller decides
what "today" means on the owner's calendar. The two disagree either side of
midnight, and east of Greenwich UTC can be the earlier day — so a movement dated
today, and valid, would be refused as future.

No caller reaches it today: `resolveOpeningDay` and `transactionController` both
refuse a future day first, on the owner's calendar. It is latent, not live.

Fixing it means giving the resolver a zone, which means threading one through
`currencyAmountConversion` — a shared abstraction whose own header states it
deliberately has no timezone. That is a design decision, not a patch, and it
gets its own analysis. Not scheduled.
### Known limitation, unchanged by either commit

`account_start_date` still stores the raw instant the client sent, not the
resolved calendar day. Storing the bare day would break the allocation month:
`insertFirstAllocation` derives it with `$2::timestamptz AT TIME ZONE $3`, and a
`YYYY-MM-DD` casts to UTC midnight, which is the previous day west of
Greenwich — wrong month on the first of any month. Account 55's opening, stored
a day forward, is that artifact and predates this work.
## 9.4 FX temporal coverage: the developer's ruling — 2026-08-31

Recorded, **not started**. It is deliberately kept out of the endpoint work in
flight, and the order below is his.

### 9.4.1 The finding, in his words

> **The month warm-up must not declare a currency hot because one date of the
> month resolved.** It has to guarantee coverage of the requested period
> according to each provider's publication model: for daily providers, coverage
> by date; for validity-interval providers, coverage by interval. **The absence
> of a local row does not constitute an unavailable rate while a provider can
> still resolve the date.**

### 9.4.2 Three questions that are currently one

The reason the warm-up misreports is that three separate questions are answered
by a single lookup:

1. **Is there a valid rate for that day at all?**
2. **Is it stored locally?**
3. **Do we have to go to the network to discover it?**

Only the first is a domain fact. The other two are storage and transport.
`FX_RATE_UNAVAILABLE` must mean the first and only the first: a day the store
does not hold but a provider answers is **not** unavailable, and returning 422
for it reports a cache miss as an economic fact.

### 9.4.3 Two provider models, not one

The store must not force a provider that publishes ranges to be rewritten as a
provider that publishes days. The two models FinTrack already depends on:

| provider | model | currencies |
|---|---|---|
| Banca d'Italia | a rate published per business day; weekends and holidays simply have none | EUR, MXN, VES |
| Banco de la Republica | one rate with a validity interval — when a day cannot be calculated, the last certified rate remains in force | COP |
| the CDN fallback | **measured after this ruling was written.** It does serve any past day, by version segment. But it **invents movement on closed days** — 14 to 18 May 2026 measured — so it is never asked for the day requested, only for a day another source has already established as a trading day. It is a source of FIGURES for a known day, not a source of DAYS | fallback |

This is why the observed behaviour of one rate answering for 15 through 25
August and a new one from the 26th is **not an approximation the application
invented**. It is the validity of the rate, as that provider defines it.

It follows that **filling those intermediate days into the store as rows would
be manufacturing data** to make a cache look complete. The right unit of
coverage for that provider is the interval, not the day.

### 9.4.4 The contract the resolver owes the rest of the app

Whatever model a provider uses, the application asks one question and must get
one answer:

> *Which rate was applicable on this date?*

The resolver's job is to translate both publication models into that single
question. Everything above it — the preview, the tracker, the statement — asks
only that.

### 9.4.5 Two levels, and only the first is in scope when this starts

- **First, the plain one.** The warm-up stops treating a single resolved date as
  proof of a warm month and checks coverage of the period: by date for a daily
  provider, by interval for a validity provider.
- **Later, and only if measured to be worth it.** Providers declare their
  coverage model explicitly, so the warm-up can request intervals rather than
  days. Not to be introduced on elegance alone.

Neither is to run 31 requests per currency per month. The evidence that this is
avoidable already exists: a date inside an interval resolved from the interval's
own rate without a request of its own.

### 9.4.6 The order, and what must not be merged into what

1. the conversion endpoint accepts the day;
2. the server-side hook accepts the day;
3. the tracker uses the hook;
4. **only then** the warm-up's period coverage, as its own unit.

The warm-up correction is **not** to be folded into the endpoint work. Both
paths — the preview and the warm-up — go through the same resolver, and that is
exactly why fixing one does not require touching the other. One commit, one
thing; a finding made during a unit does not widen that unit.

### 9.4.7 What this owes the frontend, when step one lands

Recorded here so the requirement is not discovered later on the screen.

The pocket's commit and release preview already asks the server for the
conversion rather than dividing by a cached rate (`79c371d`,
`useServerCurrencyConversion.ts`). It sends the amount and the two currencies
and **no date**, so it prices at today whatever day the movement is dated to.
The moment the endpoint accepts a day, that hook has to send the movement's own
date, or a backdated commit will keep previewing at a rate that is not the one
its row will carry — which is the exact failure the server-side preview was
built to remove.

### 9.4.8 The frozen contract

Settled 2026-08-31, before any of the work below starts. Nothing in the coverage
unit may contradict it.

> **Historical FX is stored according to the publication semantics of its
> source; the resolver translates those semantics into a rate-as-of-day answer;
> daily rows are never fabricated to represent a validity interval; and the
> source and the effective date are preserved for audit.**

The conceptual normalised shape each provider answer maps onto — `currency`,
`rate`, `valid_from`, `valid_to`, `source` — is the model, whether or not it
ever becomes columns. A daily provider produces an interval of one day; a
validity provider produces an interval of many.

`source` keeps carrying `provider@effectiveDate`. That is not decoration: it is
how a valuation can be explained afterwards, and it is the only field that
distinguishes a rate published on a day from a validity inherited onto it.

**No migration of `daily_exchange_rates` is authorised by this.** The prior
hypothesis to test first is that `rate_date` already functions as `valid_from`,
in which case the fix is in the resolver and the warm-up, not in the schema.

### 9.4.9 What the coverage unit must measure before it proposes anything

1. How Banrep's validity intervals are represented today.
2. How Banca d'Italia's non-business days are represented today.
3. What the CDN fallback actually does — granularity and its policy for days
   with no quote. Measured, never assumed.
4. What query `historicalRateResolver` performs today.
5. Whether `daily_exchange_rates` can already express all of it unchanged.

**Partial evidence already gathered, to save that unit the work.** On point 4:
the store's lookup is a single as-of walk-back — `rate_date <= day AND rate_date
>= day - MAX_RATE_AGE_DAYS ORDER BY rate_date DESC LIMIT 1` — applied
identically whatever the source. So the as-of query is *already* uniform, and it
is already correct for both models, but for different reasons: for a daily
provider the walk-back means "the last business day quoted", and for a validity
provider it means "the interval in force".

**Where the two models actually collide is the bound, not the query.** Five days
is sized to the longest run of closed days a market produces, which is right for
Banca d'Italia. It is wrong for a TRM interval, which legitimately ran from
2026-08-15 to 2026-08-25 — ten days. That single constant is why thirteen days
of August cannot be answered from the store for `cop` while every day of the
month can be for `eur`, `mxn` and `ves`. On point 3: the CDN serves any past day
by changing its version segment, `@latest` or `@YYYY-MM-DD`, but the resolver
already records that it invents movement on closed days, measured over
2026-05-14..18 — so it is a source of figures for a day already established as a
business day, never a source of days.

### 9.4.10 The contract closed — 2026-08-31

The developer settled the historical model in full. What §9.4.8 froze as
storage semantics, this closes as the answer shape the rest of the app may
rely on:

> **requested day → effective rate → effective day → source → provenance.**

Three rulings inside it, in his words and in order of consequence:

1. **A missing row is not a missing rate.** The store is not a calendar. That
   `daily_exchange_rates` holds nothing for 2026-08-09 says nothing about
   whether a rate was in force that day.
2. **`FX_RATE_UNAVAILABLE` is redefined.** It does not mean "no row for that
   day". It means **no available source can establish a valid rate for the
   requested day**. A weekend, a holiday, a validity interval spanning the day,
   or a store miss a provider can answer are all resolutions, not failures.
3. **The warm-up must not fabricate.** Discovering which intervals a month
   needs is legitimate; persisting one row per calendar day is not. For `cop`,
   August ends stored as three rows — 08-01, 08-15, 08-26 — and never as
   thirty-one. Writing 08-20 as though a provider had published it that day
   destroys the origin of the figure.

**Deliberately not authorised.** No schema change. No `warmCurrentMonthRates`
rewrite yet. The contract is frozen first; the storage and cache follow it.

#### Two measurements taken while closing this

**The answer shape already exists, and is dropped at the last hop.**
`asAnswer` in `historicalRateResolver.js:123-132` already returns `rate`,
`currency`, `source`, `requestedDate`, `effectiveDate`, `daysBack` and
`provenance`. `currencyAmountConversion` carries `effectiveDate` through to its
own return at `:216`, and at `:189-193` handles the case the ruling does not
mention: a cross conversion whose two legs resolve to *different* effective
days names both sources rather than crediting one. The loss is at the endpoint —
`currencyController.js:76-81` answers with `convertedAmount`, `rate`, `source`
and `fetchedAt` only. The effective day reaches the client solely glued inside
`source` as `provider@YYYY-MM-DD`. **The gap between the frozen contract and
the shipped code is one field in one response body.**

**The post-processing already obeys the ruling, in full.** `persistDailyRates`
at `dailyRateDBaccess.js:162-188` stores each row under `item.rateDate` — the
effective date the provider declared — and never under the day that was asked
for. A row whose day the provider did not state is dropped rather than assigned
one. The insert is `ON CONFLICT DO NOTHING`, so a re-fetch never rewrites a past
rate. Points 5 and 6 of the ruling required no change.

**The thirteen days of August are days never fetched, not validity intervals —
measured against the provider 2026-08-31.** This corrects, and reverses, what
this section asserted earlier the same day. `fetchTrmForDate` was called
directly for six days inside the gaps:

| asked | validity the provider reports | rate |
|---|---|---|
| 2026-08-07 | 08-07 → 08-10 | 3157.43 |
| 2026-08-10 | 08-07 → 08-10 | 3157.43 |
| 2026-08-14 | 08-14 → 08-14 | 3127.51 |
| 2026-08-18 | 08-15 → 08-18 | 3128.65 |
| 2026-08-20 | 08-20 → 08-20 | 3053.48 |
| 2026-08-25 | 08-25 → 08-25 | 3056.51 |

The longest validity observed is **four days**. The store's rows at 08-01, 08-15
and 08-26 are therefore a record of what FinTrack happened to fetch, not a
record of three long intervals.

**Consequence: the age bound is correct and must not be removed.** — **WITHDRAWN, see §9.4.12.** Measured the same day: the bound admits a superseded rate whenever the gap is within it, which is the majority of cases. Asked for
08-20 with no bound, the store would answer with its 08-15 row at 3128.65 when
the rate actually in force that day was 3053.48 — a 2.5% error on a valuation.
The bound refuses that row, the cascade reaches the provider, and the right
figure is stored and served. Five days also clears the longest validity the
provider produces, so the two publication models do not in fact collide there.
The earlier claim in §9.4.9 that the bound is "wrong for a TRM interval, which
legitimately ran from 2026-08-15 to 2026-08-25 — ten days" rests on reading a
gap in FinTrack's own fetch history as a provider interval. It is withdrawn.

#### What is actually left

The cost of those thirteen days is one network call per uncached day, never a
wrong answer. So the open item is the warm-up alone, and it is smaller than
§9.4.9 implies: `warmCurrentMonthRates` asks for the first of the month, that
day resolves from the store, and it concludes the currency is warm. Resolving
one day is not evidence that a month is covered. Nothing about the schema, the
resolution query or the persistence needs to change for that to be fixed.

### 9.4.11 The model closed, and the four units it separates into — 2026-08-31

The developer closed the conceptual model. Two rulings settle what may no longer
be reopened, and one names the boundaries between what is left.

**The age policy is domain, and it is frozen.** The store is not queried as an
unbounded "latest rate on or before the day". There is an explicit age policy,
it belongs to the FX domain, and it stays. The measurement above is its
justification: without it, 2026-08-20 would be valued at the rate of 08-15.

**Neither the contract nor the post-processing is reopened.** What remains is
not a question about what a historical rate is.

**The four units, which must not be merged.**

| unit | question it answers | nature |
|---|---|---|
| warm-up | is the historical window covered far enough ahead of use? | latency, infrastructure |
| resolution | which rate corresponds to the requested day? | FX domain — **closed** |
| temporal validation | may the requested day be used as an operative date? | account creation and transactions — **closed** |
| timezone | what does "today" mean for this user? | temporal infrastructure — **open, design decision** |

The warm-up's gap does not compromise financial accuracy: the resolver still
finds the correct rate, it just pays a provider call while a user waits on a
form instead of before anyone asked. It is an optimisation, not a correction.

The rule that survives into it unchanged: **the warm-up must not fabricate daily
rows.** It obtains the effective rates the resolver needs and stores them under
the provenance date the provider stated.

The timezone question opens as its own unit, not inside the warm-up.

### 9.4.12 The walk-back serves a superseded rate — measured 2026-08-31

This withdraws the claim made twice earlier in this file, that the age bound is
what prevents 2026-08-20 being valued at the rate of 08-15. **The bound does not
prevent it. It is what permits it.** 08-20 is five days from 08-15, inside the
bound, so the store accepts that row and answers with a rate the provider had
already superseded.

Measured by calling the conversion endpoint and comparing against the validity
the provider reports for the same day:

| day | provider | FinTrack answers | from row | error |
|---|---|---|---|---|
| 2026-08-04 | 3230.44 | 3144.14 | 08-01 | −2.67% |
| 2026-08-05 | 3204.51 | 3144.14 | 08-01 | −1.88% |
| 2026-08-12 | 3121.07 | 3157.43 | 08-07 | +1.16% |
| 2026-08-20 | 3053.48 | 3128.65 | 08-15 | +2.46% |

**Root cause: the as-of walk-back encodes one publication model and is applied
to both.** It reads an absent day as *no publication occurred*. That is true of
Banca d'Italia — a closed market does not quote, and the previous quote is the
correct answer for the day. It is false of Banrep, which publishes a validity
covering every calendar day, so an absent row means *never fetched* and walking
back manufactures a stale figure.

**The invariant this establishes.** For a validity provider the walk-back is
sound only when the store is complete over the window. It is not a cache whose
gaps cost latency; a gap changes the answer.

**Consequence for the warm-up unit.** Fetching the peso by month stops being an
optimisation and becomes the correctness fix: one Socrata range call returns all
19 August validities — 08-01→08-03, 08-04, 08-05, 08-06, 08-07→08-10, 08-11,
08-12, 08-13, 08-14, 08-15→08-18, 08-19, 08-20, 08-21, 08-22→08-24, 08-25,
08-26, 08-27, 08-28, 08-29→08-31 — covering every day of the month with no gap.
With every validity start stored, each day resolves onto its own row and the
walk-back never guesses.

**What is not yet established.** Whether any movement already recorded carries a
rate produced this way. The two transactions that opened this investigation, 161
and 162, are dated 2026-08-16 and carry `banrep-trm@2026-08-15`, whose validity
runs 08-15→08-18 — so those two are correct. No sweep of the rest has been run.

### 9.4.13 The validity end is rejected, coverage replaces it — decided 2026-08-31

The developer closed the decision without asking for more evidence, and corrected the
reasoning this plan had been using to reach it.

**Storing when a rate stops being valid is rejected for now.** Not because the notion is
useless, but because nothing measured so far shows the provider hands us that semantics
explicitly. Writing "this rate was valid until the 30th" because the 29th and the 30th
came back empty is an inference of ours, and inventing it would break the storage rule
this plan closed one section earlier: we persist what the provider declares, never what
we deduce from a silence.

**The phrasing this plan used was wrong and is replaced.** It said the walk-back stops
erring once "the store holds the correct validity of every day". That smuggles a
per-day validity back in through the vocabulary. The correct statement is:

> The walk-back stops erring once we know the interval was actually asked of the
> provider, and every publication that interval produced was persisted.

Those are different claims. The second needs no new fact about the rate — only a fact
about our own fetches.

**The invariant that follows.** An answer read from the store, giving effective day E for
requested day D, is trustworthy if and only if the whole span from E to D was queried
from the provider. Inside a queried span an absent day genuinely means "nothing was
published"; outside one it may only mean "we never downloaded it", which is exactly the
defect measured in the previous section.

This splits the two questions the age ceiling was silently answering at once:

| Question | Answered by |
|---|---|
| Is this absence real, or did we simply never fetch it? | coverage of the span |
| Is a rate this old still acceptable to value with? | the age ceiling, domain policy, unchanged |

**The decisions, as settled.**

| Point | Decision |
|---|---|
| Column for when a validity ends | No, not now |
| Separate historical table | Yes, as it already is |
| Persist every row the provider returns | Yes |
| Invent rows for days without publication | No |
| Lookup by greatest stored day not after the requested one | Yes |
| Five-day ceiling | Yes, provisionally |
| Preload by monthly range | Yes |
| Preload that asks only for the first of the month | No |
| Resolver must know whether the span was queried | Yes |
| Reading "today" in UTC | Separate unit |
| Trigger that runs the preload in production | Separate unit |

**Order of work, as settled.** Resolver, then store, then coverage of the queried range,
then the monthly preload, then the peso tests. The validity end is reopened only if a
case appears that genuinely demands representing intervals.

**Still to be approved before anything is written.** The shape coverage takes on disk.
The recommendation on the table is one row per queried span per currency pair, holding
the first and last day asked, merged with any overlapping or adjacent span on insert so
that a single row answers containment. The rejected alternative is a single high-water
pair per currency: it is smaller, but it claims coverage of everything between two
distant fetches, so backdating to March while August is warm would assert five months
that were never downloaded.

**Diagnosis to be re-run.** The sweep that classified the existing movements ran against
the local database, because the active connection profile is the local one. The developer
asked for it against the copy of production. The sweep only reads, so it is safe there.
Corrected 2026-08-31: what it needs is not "the production profile made active" — no
such mechanism exists — but a production dump restored into a local database, with
`.env` pointed at that copy. See `PLAN_SUPABASE_MIGRATION.md` §9.1.

**Found while measuring this, and it shrinks a unit.** The scheduled-job infrastructure
already exists — a router at `src/cronjob/cronRoutes.js` behind a shared-secret
middleware — but its import and its mount in `src/app.js` (`:26` and `:161`) are both
commented out, and the Vercel configuration declares no schedule. The production trigger
is therefore not new construction: it is re-enabling that router, giving it a route that
runs the monthly range preload, and declaring the schedule.

### 9.4.14 The coverage contract, frozen — 2026-08-31

Approved by the developer. Nothing here is open; the only work left on it is writing it.

**What a coverage row means, stated so it cannot be misread later.** One row records a
date interval that was actually asked of one provider for one currency pair, and whose
answer was accepted as complete. It does not mean "we hold rates for these days", and it
does not describe how long any rate stays valid. Inside a covered interval an absent day
is a real absence: the provider was asked and published nothing. Outside one, an absent
day means nothing at all.

**Frozen rules.**

| Rule | Decision |
|---|---|
| Separate table for coverage | Yes |
| Interval stored as a date range, not two loose dates | Yes |
| Overlapping or adjacent intervals merged on write | Yes |
| Advisory transaction lock keyed on source and pair | Yes |
| Exclusion constraint as the last guardrail, not the merge mechanism | Yes |
| The provider call sits outside the transaction | Yes |
| Coverage written only after a complete, accepted answer | Yes |
| Coverage written after the observations, in the same transaction | Yes |
| Preload asks the month plus a lead-in | Yes |
| Empty interval rejected by a check constraint | Yes |
| Column for when a validity ends | No |
| Table mapping requested day to effective day | No |
| One coverage row per day | No |
| A single earliest/latest pair per currency | No |
| Resolver that always calls the provider | No |

**The two ceilings are separate concepts that happen to share a value.** How far back the
resolver will walk looking for a rate is a domain policy. How far before the start of a
period the preload queries, so that the resolver can find that rate, is a consequence of
the first. They are five today. The second derives from the first and must never be
re-tuned on its own.

**Naming follows the tables that already exist.** The moment we went to the provider is
already called `fetched_at` in both rate tables, so coverage uses `fetched_at` and not a
new word for the same idea. Same for `source`, `base_currency_id`, `target_currency_id`
and `created_at`.

**Not a separate database, and not a slowly-changing dimension.** The coverage test and
the observation lookup have to resolve in one query and commit in one transaction, which
rules out a second database; the advisory lock and the exclusion constraint are also
per-instance. And the observation table holds immutable published facts, not a versioned
entity: a rate published for a given day never changes, so there is no current version to
supersede. Type 2 versioning would reintroduce validity columns through the back door.

**Recorded, not fixed.** If a provider ever corrects a rate it already published, the
unique constraint's `DO NOTHING` keeps the first value and drops the correction silently.
No evidence yet that any provider in use does this. Out of scope here.

### 9.4.15 The schema unit landed — 2026-08-31

`023_create_exchange_rate_query_coverage.sql` creates the table the contract above
froze, plus its boot-time twin `ensureExchangeRateQueryCoverageTable` in
`createTables.js` and its call in `initDatabase.js`. Commit `fe31fb6`. Schema only:
no backfill, no resolver change, no preload, no provider traffic.

**The frozen predicate had to be respelled, and the contract is the new spelling.**
`covered @> daterange(E, D + INTERVAL '1 day', '[)')` does not resolve: adding an
interval to a date yields a timestamp and there is no `daterange(date, timestamp)`
overload. It fails loudly rather than misbehaving, but it fails. The contract is

    covered @> daterange(E, D + 1, '[)')

which is day arithmetic on a date and preserves exactly the semantics that were
asked for — the requested day D included, and the bounds argument always written
out so no later reader spells `daterange(E, D)` and drops it.

**Proven by execution against the local database**, every insert inside a
transaction that was rolled back: `btree_gist` present; overlap for the same
provider and pair rejected by `ex_exchange_rate_query_coverage_no_overlap`;
adjacency permitted, which is what leaves the merge to the writer; the same
overlap under a different `source` accepted, which is coverage being per provider;
an empty range rejected by `ck_exchange_rate_query_coverage_not_empty`;
containment true both inside the range and on its last day; zero rows left behind.

**Unverified on the target, and the phrase used earlier for how to verify it was
wrong.** There is no "production connection profile" to activate: the application
reads one variable, `DATABASE_URI`, so switching database is editing one line of
`.env`, and the migration runner takes the application's own pool. The production
guard is inside a commented block and would not catch this case even if it ran.
Verification splits in two: whether the migration survives real rows is answered by
a production dump restored into a **local** database, and whether the Supabase role
may create the extension is answered by a **read-only** query against Supabase, not
by running the migration there. `PLAN_SUPABASE_MIGRATION.md` §9 and §9.1 carry the
detail, including why the five pending files apply in one transaction.

**Next in the order of work:** the resolver's coverage-aware HIT/MISS test.

### 9.4.16 "Today" is settled: the owner's zone, not UTC — decided 2026-08-31

The developer closed the one unit §9.4.11 left open as a design decision. **For a
user, today is today in their own time zone.** No qualification, no per-screen
exception.

What that binds. The resolver reads `new Date().toISOString()` twice — at
`historicalRateResolver.js:111`, which closes the span a range provider is asked
for, and at `:202`, which decides whether a requested day is in the future and
must be refused. Both are UTC, so a user at -05 submitting late in the evening is
told their own current day is in the future. The users table already carries the
IANA zone with a UTC default, and the transaction read sites already resolve the
local day through it, so the column and the pattern both exist; what is missing is
that the resolver reads them.

Still its own unit, not folded into coverage. The coverage contract is about
whether a span was queried; this one is about which calendar day the request
names. They meet only in that both feed the same lookup.

### 9.4.17 The coverage unit verified against the peso — 2026-08-31

Commit `aaa931d`. The resolver now refuses a stored row it cannot prove was inside
a queried span, and every arm that reaches a provider records the span it asked
for, both under one commit. Run against the development database with live
provider calls.

**The four days §9.4.12 measured as wrong now return the provider's own figure**,
each on its own row, with no walk-back at all:

| day | provider | before | now | daysBack |
|---|---|---|---|---|
| 2026-08-04 | 3230.44 | 3144.14, −2.67% | **3230.44** | 0 |
| 2026-08-05 | 3204.51 | 3144.14, −1.88% | **3204.51** | 0 |
| 2026-08-12 | 3121.07 | 3157.43, +1.16% | **3121.07** | 0 |
| 2026-08-20 | 3053.48 | 3128.65, +2.46% | **3053.48** | 0 |

**A legitimate walk-back still happens, and now it means something.** 2026-06-15
was outside every covered span: it missed, fetched 21 validities in 563ms, and
answered from 06-13 at two days back — a real absence inside a span that was
actually queried. The same day asked again answered in 1ms with no network.

**The merge folds neighbours, through the real path.** Coverage stood as two cop
spans with a gap, `[2026-05-27,2026-07-01)` and `[2026-07-27,2026-09-01)`. A
request for 2026-07-10 fetched 2026-06-26..07-31, which overlaps the first and
touches the second, and the three collapsed into one row,
`[2026-05-27,2026-09-01)`. Spans that do not touch stay apart: April remained its
own row rather than claiming the uncovered gap.

**The advisory lock holds under the race it exists for.** Four simultaneous
submits for an uncovered April all missed, all called the provider, and all
merged identical spans at once. Result: one coverage row, no constraint
violation, four correct answers.

**Refusals unchanged**: a future day, an unsupported currency and an unparseable
date still raise their own error codes.

**Noticed while testing, not part of this unit.** The euro resolved through the
CDN arm, not through Banca d'Italia, so the universal arm is not answering for it
today. Pre-existing and unrelated to coverage.

### 9.4.18 The FX chain closed — 2026-08-31

Four commits after the coverage schema, and the sequence §9.4.13 set out is
complete. What was left open in each is stated, not hidden.

| unit | commit | what it does |
|---|---|---|
| resolver reads coverage, writer records the span | `aaa931d` | one commit, as decided: the two halves cannot ship apart |
| the provider date stops posing as ours | `7c38f42` | four adapters routed |
| the live rate becomes its own daily row | `acb8185` | the redundant call, removed for three of four currencies |
| today is read on the owner's calendar | `2df9ba9` | the timezone unit |

**The date defect had a fifth adapter and a live consequence.** Two adapters put
the provider's publication instant into `fetchedAt`; a third, Cotizave, did the
same; the fourth, Banrep, kept them apart under a name — `publishedAt` — that the
assembler did not read. Since the cache ages from the oldest `fetchedAt` against
a 22-hour ceiling, a publication instant there meant the cache was born nearly
expired. Measured before the fix: expired on arrival. After: zero minutes old,
same ceiling. **The 22 hours were never the defect** and are not changed — being
just under a day is what makes each daily publication get picked up.

**A day is stated, never derived.** Only an adapter knows its provider's calendar
semantics, so each states `providerDay` when it can. Banrep takes `vigenciadesde`
verbatim; the two daily-cadence APIs take the UTC day of their documented daily
update; **Cotizave states none** — it quotes a market continuously — so its rate
never becomes a daily observation. The cost is visible and accepted: the
bolivar still pays a provider call for today while the euro and the Mexican peso
answer from the store in 3ms. Inventing a day for it would be the fabrication the
store exists to refuse.

**Banrep's own row was refused, correctly.** On 2026-08-31 the TRM validity
starts 09-01, and the store logged `Skipping rate dated in the future` and wrote
no coverage. The no-fabrication rule held without anyone enforcing it.

**The timezone unit, and what it actually changed.** `todayInZone` already
existed and was already used across the controllers; the resolver simply was not
given a zone. It now takes `options.timeZone`, defaulting to UTC — which is right
for the warm-up, since it fills a shared store with no owner. Five call sites that
already had the owner's zone in scope now pass it; the anonymous conversion
endpoint has no owner and keeps UTC.

Measured: a user in Tokyo valuing a movement dated on their own current day used
to get `FX_DATE_IN_FUTURE`. It now gets past the guard. That day then resolves or
not on its merits — on the run above no provider had published 09-01 yet, so the
answer was `FX_RATE_UNAVAILABLE`, which is a different and true statement.

**A diagnostic that became a lie, and was fixed with it.** With coverage in
force, a null from the store means either "too old" or "not covered", and the
three failure strings still named only the first. They now name both. The CDN
arm's says why it is structurally limited: it asks for one day, so it covers one
day, and it cannot answer a later one.

## 10. Out of scope

- **Editing the date of an existing transaction.** This block writes new movements only;
  editing is a different operation with a different blast radius.
- **The duplicated `updateAccountBalance`** — one in `transactionController.js:125`, another
  in `accountManagement/`. Two implementations of one thing, its own commit.
- **Dropping `account_balance_after_tr`.** A later migration, after the derived series has
  been trusted.
- **Migrating Debts onto `useFormManager`.** Its own commit, after this plan.
- **Interpolating an exchange rate.** Refused permanently (§4.6).

---

## Corrections of 2026-08-30 — measurements only

Every entry below is an assertion about the code that had stopped being true. **No
decision was closed, deleted or reworded, and no work unit was reordered.** Where a false
passage still carries an argument, the original text was left standing and a dated block
was added beneath it.

| § | what was asserted | what the code says today |
|---|---|---|
| 3.2 | the guard sits at `transactionController.js:473-478` and must move below the account lookups at `:499` and `:516` | the guard shipped in `6adc8de` and `664ad5c` split it: field at `:345`, checks 1-3 at `:350-376`, `asOfDay` at `:382`, all **above** the conversion at `:400-405`. The lookups are at `:551` and `:568` |
| 3.3.2 | PnL renders a date control and sends nothing; the movement is stamped with the request instant | `PnL.tsx:460` sends `transactionActualDate`; the legacy `date` key left the controller's destructure at `:266-274` (`81dbb5c`, `ebd7622`) |
| 3.3.3 | the budget status row type carries no opening date | `budgetTypes.ts:98` carries `accountStartDate: string \| null` (`2b4d3dc`) |
| 3.4 | three implementations write `updated_at` from the movement's date, at `transactionController.js:138`, `updateAccountBalance.js:21` and `updateAffectedAccountBalance.js:28` | none does. The controller's copy went with `be6ebbf`; `updateAccountBalance.js` is deleted in the working tree and replaced by `setAccountBalanceFromLedger.js` (`updated_at = NOW()` at `:58`); `updateAffectedAccountBalance.js:28` writes `NOW()` |
| 3.5 | `todayInZone` at `resolveZonedWindow.js:42`; the error shape at `budgetAllocationService.js:42-46` | `:60` and `:38-46` |
| 4.5 | the Banca d'Italia arm is "written, uncommitted"; the resolver is "not written" | both landed — `e7dc38a` and `ddadb7d`. `historicalRateResolver.js:171` exports `resolveHistoricalRate` |
| 4.5 | `currencyAmountConversion` "gains" a fourth `asOfDate` | it has it: `currencyAmountConversion.js:73`, parameter at `:77`, resolver called at `:132` (`34b6e18`) |
| 4.5.2 | the resolver is "the one file that does not exist" and nothing in §4.2 is reachable | it exists and the whole cascade is reachable from `transactionController.js:400-405` |
| 4.5.2 | the dated conversion and the hoisting of the day parse are deliberately left out | both shipped since — `34b6e18` and `664ad5c`. Only the refusal of a preview endpoint still stands. **This says the parameter exists and the movement path uses it, never that every conversion is dated:** §9.2, added by another session the same day, measures one of nine callers passing a date — `transactionController.js:400` — and the four on the account-creation path passing none |
| 5.2 | `getTransactionsForAccountById.js` "does not exist" | it exists, 543 lines, at `backend/src/fintrack_api/controllers/`; its anchors are `:248`, `:328`, `:388`, `:486`, `:489` |
| 5.3 | the deletion path still builds a balance from the stored column at `deleteAccountService.js:203` and writes it back at `:285` | closed by `83d22ca`: `lockAndDeriveBalances` at `:217`, writes at `:273` and `:311` |
| 5.5 | in month mode `getInitialBalance` returns the balance after the month's oldest movement | unified: `:486-487` calls `getBalanceCarriedIntoPeriod` with no branch |
| 5.5 | Class D — the stored column is read at `:81`, the funds check at `:647` compares floats, the write-back is `updateAccountBalance` at `:148` | `getAccountInfo` at `:94`, `lockAndDeriveBalances` at `:678`, a decimal funds check at `:688-694` (`6deddc8`), and `setAccountBalanceFromLedger` at `:832` and `:838` |
| 5.5 | **four** read sites still on the stored column, the account detail "converted next" | **one live site, and it is closed** — `17a0714`, `getAccountController.js:592` with the response overwritten at `:822-824`. The impact report closed with `f7cae5b`. The two survivors are the unreachable ones |
| 5.5 / 7 | commit 3 "in progress", commit 3a "not written" | both landed — `a2bd75a`, `f8cce22`, `f7cae5b`, `17a0714` |
| 5.5 | the nine list queries end at `getAccountController.js:1003`; `SPENT_QUERY` at `:181`, `SPENT_BY_MONTH_QUERY` at `:346` | `:1014`; `:187` and `:353` |

**Left unresolved, and stated rather than acted on.** The Class A table's
`dashboardController.js` anchors (`:57, 177, 194, 208, 355` and `:224, 390`) have drifted
with the file; the derivation is present at 28 sites, and two of the legacy budget reads
are now at `:194-195` and `:356`. Re-anchoring every one of them was not attempted here —
the assertion that matters, that the dashboard derives, is true.

### 9.4.19 Banca d'Italia is unreachable, and the rows it left behind — ruled 2026-08-31

**Not a code defect.** Measured from this development machine: DNS resolves
`tassidicambio.bancaditalia.it` to 85.159.192.122, the TCP handshake on 443 never
completes (`UND_ERR_CONNECT_TIMEOUT`, still failing at an 8s timeout), while a control
host over HTTPS answers 200 in 928ms. Geographic block, ISP filter and a provider outage
are indistinguishable from one vantage point, so **the reachability question is deferred
to the deployment environment** — it is a measurement, not a change, and nothing about
the design is revised until it is taken.

**The latency it was costing, and the fix.** Every resolution of an uncovered day spent
the full ~2000ms timeout on that host before the cascade moved on — close to half the 5s
budget of the whole cascade, once per currency per uncovered day. `bancaDItaliaProvider.js`
now remembers a *connection* failure for 60 seconds and refuses the call outright while it
stands. Measured: first resolution 2447ms, subsequent 78ms / 110ms / 88ms; a four-currency
sequence fell from ~8000ms to 2723ms. Shipped as `39ad5f44 perf(fx): stop re-paying an
unreachable host`.

The breaker is deliberately narrow, and the narrowness is the point. An HTTP status or a
malformed body means the host answered; skipping the provider for those would hide a bug
instead of saving time, so `noteHostOutcome` returns early whenever `error.response`
exists. And the window is 60 seconds rather than minutes because this provider is
preferred — it is the app's business-day oracle and never invents movement on a closed
day — so a merely flaky host is retried almost immediately. **This is a latency
optimisation, not a judgement that the provider is gone**, and it must not grow into one.

**The stranded observations.** The euro holds `bancaditalia` rows for twelve March days
with no `bancaditalia` coverage span: they were written before the coverage table existed.
Since the coverage test matches on the row's own source, those rows are unreadable, and
while the host will not connect the coverage can never be earned. A second mechanism keeps
them dark even when the CDN answers one of those days: the CDN's row loses the insert to
the existing one (`ON CONFLICT DO NOTHING`, immutability holding correctly) but coverage is
recorded under `github-fallback`, so the row under `bancaditalia` stays unproven.

**Ruled: leave them exactly as they are.** An existing row is not evidence of a query. That
distinction is the entire reason the coverage table exists, and backfilling coverage from
the presence of a row would make the system assert something about a period it never asked
for — which is precisely what migration 023 refused, for want of an honest range. The rows
are not corrupt; what they lack is query provenance, not accuracy. When the provider is
reachable from whatever environment runs FinTrack, the first resolution of one of those
days misses, asks, persists idempotently, records coverage and answers — the observation
survives untouched and simply becomes provable.

**Ruled: `source` stays part of coverage identity.** Letting one provider's coverage
legitimise another provider's row would answer "was anyone asked?" where the invariant asks
"was *this* provider asked?" — and providers differ in publication calendar, market
convention and validity semantics, which is the whole reason the per-source guarantee was
adopted (9.4.14). Not revisited.

**Proved end to end on a reachable provider — 2026-08-31.** The euro's own rows cannot be
exercised while the host is down, so the case was reproduced on the peso, whose arm is the
same shape: a covering span was split so 2026-08-20 fell outside it, leaving the
`banrep-trm` row with no proof. Before: HIT in 67ms. Stranded: the resolver refused the
row, went to Banrep (`24 validities`, 702ms), wrote `0 new of 24 returned` — nothing
overwritten — merged the coverage back into one span and answered 3053.48. After: HIT in
1ms from the database alone. The observation was byte-identical throughout.

One point of precision the rehearsal settled: **a coverage miss is never returned to the
caller.** It is handled inside the same call — refuse the unproven row, ask the provider,
record, answer. The `FX_RATE_UNAVAILABLE` the euro returns is therefore not the coverage
contract failing; it is the host not connecting. The coverage design is validated and
carries no architectural blocker.

**Open, and owned by the developer.** A historical resolution run from the deployment
environment for one of the euro's twelve March days. If Banca d'Italia answers there, the
local failure is a vantage-point problem and the twelve rows heal themselves on first
demand.

### 9.4.20 The warm-up warmed almost nothing — fixed 2026-08-31

**Two defects, both measured on cold months rather than argued.** The module
resolved a single day, the first of the month, and depended on the arm that
answered having fetched a range around it. Against a cold February that left the
euro, the bolivar and the peso mexicano at **0 of 28 days** each; only the
Colombian peso reached 28 of 28, because its arm is the one that fetches a range.

The first defect is the single seed day. The CDN arm asks for exactly one day and
covers exactly one day, so a currency that falls to it warms at most that day —
and none at all when the first of the month is not a trading day, which it is not
roughly two months in seven. Asking for every day of the month up to today states
the intent instead of inheriting it from whichever source answers. It is
self-throttling: a range arm covers the month on the first day it answers, so
every later day is a single indexed read of about 1ms.

The second defect is the order. `findLatestBusinessDay` queries
`daily_exchange_rates` **without filtering by currency pair**, so the business-day
calendar is shared across every pair, and the CDN arm reads it rather than naming
a date itself — which is what stops it inventing a day no market quoted. The
currency list ran `eur` before `cop`, so on a cold store the euro was warmed
against a calendar nothing had established yet and its arm reported exactly that:
`cdn: skipped, no source has established a business day yet`.

**Measured, two cold months so neither run warms the other.**

| month | order | cop | eur | ves | mxn | total |
|---|---|---|---|---|---|---|
| 2025-11 | eur first (old) | 30/30 | **0/30** | 17/30 | 17/30 | 11627ms |
| 2025-10 | cop first (new) | 31/31 | **22/31** | 22/31 | 22/31 | 11775ms |

The reorder costs nothing and converts zero days into twenty-two. On a cold
February the per-day loop alone moved the three CDN-served currencies from 0/28 to
15/28, 19/28 and 19/28, at 2.4s to 6.7s off the request path, 0.8s to 1.3s on a
second pass.

A partial month is the correct outcome, not a failure. A day no market quoted is
answered by walking back to one that did, and that walk needs the span between to
have been queried — so a currency served only by the one-day CDN arm warms its
trading days and leaves the rest until a range source covers them. The counts are
reported per currency for that reason.

`OFFICIAL_TRM_CURRENCY` moved from `historicalRateResolver.js` to `fxConfig.js`.
The warm-up has to privilege exactly the currency the resolver privileges, and a
second copy of the literal would let the two drift apart silently.

Shipped as `8e0202ae fix(fx): the warm-up warms the whole month`. Boot verified on
port 5078.

**Closed by 9.4.21 the same day.** The window was the calendar month, so on the
first of a month the warm-up covered one day while the movements people actually
back-date had just fallen out of it — observed here, where the UTC day had already
rolled to 2026-09-01 and the warm-up reported `cop 1/1`.

**Still open, unchanged.** The warm-up never runs in production: `index.js:57`
guards `startServer` behind `!process.env.VERCEL`, and the cron router that would
replace it is commented out at `app.js:26` and `:161` with no schedule declared in
the Vercel configuration.

### 9.4.21 The warm-up window is two months, not one — 2026-08-31

The window is now the first of last month through today.

**The reason first stated for this was wrong, and is corrected here.** It was not
that people back-date further than a month: `transactionController.js:369-374`
refuses any movement dated before the first of the current month, so on the first
of September nobody can date one in August, and widening for that buys nothing.

The real reason is a disagreement about whose day it is. This module reads today
in UTC; that floor reads it on the OWNER'S calendar. With UTC on 2026-09-01 an
owner in Bogota is still on 2026-08-31, so every August day is legal for them —
and a window of the UTC month had warmed exactly one day, of no use to them at
all. Owners span UTC-12 to UTC+14, so around every month boundary the previous
month is still live for somebody. The window must cover the current month of every
owner, not the current month of the server.

Widening only while UTC sits on the first was considered and dropped: the warm-up
runs on boot and nothing schedules it, so a rule keyed to the calendar day is only
right for a server that happens to start that day. A fixed two-month window is
correct for any boot in any zone, and its whole cost is boot-time work that blocks
nothing.

It does not try to serve budget allocation, which converts for any month between
the account's opening month and the current one
(`budgetAllocationService.js:222-232`) and so reaches arbitrarily far back.
Warming that is unbounded work for a deliberate, occasional action that can afford
the cascade once.

Month-aligned rather than a rolling count of days, because `spanAround` fetches by
month: exactly two months is two range calls per currency, where a rolling
forty-five days would straddle three. The days are walked in UTC with
`setUTCDate`, so no local zone and no daylight-saving shift can drop or repeat one,
and the last day agrees with the UTC boundary the resolver reads by default.

The module is renamed `warmRecentRates.js` / `warmRecentRates()`. The old name
asserted a window the function no longer has, and `index.js:15` and `:43` are its
only callers.

**Measured on the live local store**, window `2026-08-01..2026-09-01`, 32 days:
`cop 32/32, eur 6/32, ves 5/32, mxn 6/32`, 9664ms first pass, 7653ms on a second.
Boot verified on port 5078. Shipped as `b484dfc1 fix(fx): warm the window a
movement falls in`.

**The low counts for the euro, the bolivar and the peso mexicano are the stranded
observations of 9.4.19, not a defect in this module.** Those three hold
`bancaditalia` rows through most of August with no `bancaditalia` coverage; the CDN
arm answers a day, loses the insert to the existing row and records coverage under
`github-fallback`, so the row stays unproven. The peso reaches 32/32 because its
range arm both writes the rows and covers the span.

**Closed by 9.4.22.** Each of those uncovered days cost a CDN round trip on every
boot whose outcome was deterministic, roughly 7s of futile traffic per start.

### 9.4.22 A provider call that can write nothing is not made — 2026-08-31

The CDN arm paid a full network round trip per uncovered day, on every warm-up,
for an answer the store already held. When the day carries an observation the
insert cannot displace and its span is already covered under that source, both
writes have nothing to do and the read that follows returns exactly what it
returned before the call.

`isDaySettled` in `dailyRateDBaccess.js` asks that in one query before the call is
made. It matches the row **without** its source, deliberately: a day holding
another provider's observation is a day this one cannot overwrite either, and that
is the case that made the guard worth writing — a store whose rows came from a
provider that no longer connects would otherwise pay that trip per day, on every
boot, forever.

It is neither a cache nor a freshness rule. A past day's figure cannot change, so
there is nothing to refresh; the only question is whether the two writes have work
left.

**Measured on the live local store**, window `2026-08-01..2026-09-01`:

| | before | after |
|---|---|---|
| first pass | 9664ms | 2949ms |
| second pass | 7653ms | 647ms |
| counts | `cop 32/32, eur 6/32, ves 5/32, mxn 6/32` | identical |

The identical counts are the check that matters: no answer changed, only dead work
disappeared. Boot verified on port 5078. Shipped as `04491746 perf(fx): skip a
provider call that can write nothing`.
