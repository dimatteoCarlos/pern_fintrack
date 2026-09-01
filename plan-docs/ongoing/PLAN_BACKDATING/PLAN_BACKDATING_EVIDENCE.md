> **SUPERSEDED AS THE PLAN OF RECORD, 2026-08-30.** The contract now lives in the
> condensed `PLAN_BACKDATING.md` beside this file. What is kept here is the raw
> measurement, the superseded drafts and the reasoning behind each ruling. **Where the
> two disagree, the condensed file wins** — this one records how we got here, not where
> we are.

# PLAN_BACKDATING — recording a movement on the day it happened

**Written 2026-08-24. Branch `feat/budget`.** This is the contract the commits
implement, not a discussion. Every figure in it was measured on 2026-08-24 against
the working tree, the real-data copies, or a live HTTP request — never recalled.

`plan-docs/` is in `.gitignore:102`. Nothing in this folder produces a commit.

**V1 carries no migration.** Not on `transactions`, not on `exchange_rates`.

**Where `feat/backdating` starts — settled 2026-08-26 by measurement.** The branch
does not exist yet, locally or on the remote. An earlier note had it coming off
`main` once `main` was fast-forwarded; that is wrong, and section 6 is the reason.
Four commits that live on `feat/budget` and on neither `main` nor the production
branch rewrite `getTransactionsForAccountById.js` — `78d1092`, `ab345e2`,
`97f4ad1`, `9b6a75e` — and section 6 rewrites that same file at its five read
sites. Branching off `main` would start from a copy of that file four commits
stale and turn each of the four into a merge conflict, in the one file where a
mis-resolved conflict produces a wrong balance and says nothing.

**`feat/backdating` comes off `feat/budget`, at its current tip.** The FX provider
back-dating depends on, `banrepTrmProvider.js`, arrived in `4f4afcd` and is on
every branch, so it does not discriminate; the statement controller does.

> ## Realigned 2026-08-29 — read this before section 8
>
> **Three of the fourteen commits have landed and the work stopped being a straight
> line.** The corrections below were made after an audit of the current state, and
> section 8 was restructured because of them.
>
> **Re-measured 2026-08-30 — "three of the fourteen have landed" is no longer the count.**
> Every commit of this block has landed except the credentialled arm (commit 6), which the
> condensed plan records as out of V1. The state table of §8.0 is corrected below; the
> ledger of record is `PLAN_BACKDATING.md` §7.
>
> - **Commit numbering stopped describing the order.** Commits 7 and 9 depend on
>   nothing and were buried behind blocked work purely by their number. Section 8 is
>   now a dependency graph in two lanes; the numbers survive as names because they
>   are cited from other documents, and they no longer imply sequence.
> - **Section 10 said "nothing is open". That is false again.** Five decisions
>   reopened between 2026-08-27 and 2026-08-29, and one of them — the daily-window
>   query — changes code already written. They are in the rewritten section 10.
> - **Commit 6 is proposed for removal from V1** (§10.4). It is the only credentialled
>   arm, its base URL exists in no file of this repository, and its window cannot
>   answer the older half of the problem this block exists to solve.
>
> **What did not change:** every decision of section 3, the routing rule of §5.1, the
> refusal of interpolation, and the safety rule that no screen ships before the
> resolver.

---

## 1. The problem

FinTrack stamps every movement with `new Date()`. A purchase entered three days
late is filed three days late — and in the wrong budget month when it crosses a
boundary.

The column exists and the endpoint already reads a date from the body:
`transactions.transaction_actual_date` has been `TIMESTAMPTZ` since
`003_transactions.sql:56`. What is missing is a control on the form, a guard that
does not discard the value, and a decision about the figures that depend on the
order in which rows were inserted.

**Nothing is corrupted today.** Swept 2026-08-24: **no frontend file sends
`transactionActualDate`** in a request body. The guard therefore always falls
through to `new Date()` and produces the right answer by accident. Every defect
below is latent, not active.

**Which is why fixing the guard alone would be the dangerous move.** It would
switch back-dating on for the one screen that already sends a date — Profit & Loss
— with none of the bounds, none of the derived reads and none of the FX work.

---

## 2. The measured write path

A tracker movement writes **exactly two tables**:

| table | rows | where |
|---|---|---|
| `transactions` | **two** — the source leg and the destination leg | `recordTransaction.js:80`, called from `transactionController.js:700` and `:741` |
| `user_accounts` | **two** `UPDATE`s — `account_balance` and `updated_at` | `transactionController.js:606` and `:628` |

Plus, occasionally, one `INSERT` into `user_accounts` to create the `slack` account
when it does not exist. Nothing else.

**No budget table and no extension table is written.** Budget spend is computed on
read — `getTotalSpentByAccountAndPeriod`
(`budget_services/db/budgetTransactionRepository.js:21-37`) sums a date window — so
a back-dated expense restates its month **with nothing to change**. The same holds
for `debtor_accounts.value`, `category_budget_accounts.budget` and
`pocket_saving_accounts.target`: they are definitions, not figures derived from
movements.

### 2.1 What actually depends on a date or an order

| persisted column | depends on | disposition |
|---|---|---|
| `transactions.account_balance_after_tr` | the **order of insertion** | a cache of a derivable figure — **stop reading it** (§6) |
| `transactions.exchange_rate` + its five FX siblings | the **date** | irreconstructible audit — **keep, and date it honestly** (§5) |
| `user_accounts.updated_at` | should be the write instant; today carries the movement's date | **defect — untie it** (§4.5) |
| `user_accounts.account_balance` | the **set** of movements, not their order | **stays persisted** |
| `budget_monthly_allocations.budget_amount` | what was budgeted | untouched |
| `debtor_accounts.value`, `category_budget_accounts.budget`, `pocket_saving_accounts.target` | a definition | untouched |

**Only two columns are genuinely at risk, and they resolve in opposite
directions.** The rule that separates them is the one every future column should be
tested against:

> **Store what cannot be reconstructed; compute what can.**

`account_balance_after_tr` is `account_starting_amount + Σ(prior signed amounts)` —
every input is already in the table. The FX pair is not: the rate of that instant
exists nowhere else, and without it there is no way back from the stored figure to
the figure the owner actually typed.

**`account_balance` stays persisted** even though it is derivable, because it is a
**stock of the present, not a historical series**: it does not depend on order, it
is read on every screen, and it is the input of the sufficient-funds guard at
`transactionController.js:571-581`. Recomputing it per read would scan every
account's whole history on every dashboard load.

A related consequence, stated so no future column repeats the mistake: **a stock of
the present may be materialised; a historical series may not.**

---

## 3. Decisions

### 3.1 Settled by the developer

| # | decision |
|---|---|
| **D1** | The stored value carries **day and time**. |
| **D3** | **Lower bound: `user_accounts.account_start_date`.** Not arbitrary — the derived series anchors on `account_starting_amount` at that date, so an earlier movement would have no anchor. |
| **D4** | **No figure that depends on a date or an order is persisted.** It is derived on read, for rendering only. No upsert, no materialised cache: two sources of truth that must be kept equal is the situation this block removes. |
| **D5** | **A closed budget month does not exist** in FinTrack and is not introduced. A past expense must restate its month, and already does. |
| **D6** | A past-dated rate comes from a **cascade of published sources** — never from the user, never from today. |
| **D2** | **Upper bound: today in the owner's zone. No future dates.** The budget module already answers `422` for a month later than the current one, so a future movement would be a movement no budget month can report. *Confirmed 2026-08-24.* |
| **D7** | **The client sends a calendar day; the server composes the instant.** The owner's zone lives in `users.timezone`, not in the browser. `PLAN_TIMEZONE_ROLLOUT.md` already established that the browser's zone is not the authority; this is the same rule applied to the write path. *Confirmed 2026-08-24.* |
| **D8** | **A past day is anchored at 12:00 in the owner's zone**; today's day is anchored at the actual current instant. Midday is maximally far from both day boundaries, so no zone conversion or drift can push the movement into the adjacent day — or the adjacent month. Midnight is dangerous for exactly that reason. Intra-day order is settled by `transaction_id`, which is monotonic, so the time of day carries no ordering burden. *Confirmed 2026-08-24.* |
| **D12** | **The cascade's ceiling is 5s and each call's timeout is 2s.** Sized by what a form submit may hang for, not by the sum of the arms. A timeout aborts its arm; only an empty answer consumes a walk-back step (§5.2). *Fixed 2026-08-24.* |
| **D13** | **Debts keeps the validator it has and the date gets no schema entry.** An earlier draft of this row said Debts had no validation at all; measured, it validates the whole form through `validationData` (`Debts.tsx:397`), which already walks the `date` key and passes it. The bound is the picker's `minDate` / `maxDate` on all five screens (§7.2), not a schema, so a `debtsSchema` would buy nothing here and cost the removal of `validationData` and three effects. **The migration onto `useFormManager` is a commit of its own, after this plan and outside it** (§7.1). *Settled 2026-08-26.* |

### 3.2 Taken by this document — confirm or overrule

| # | decision | why |
|---|---|---|
| **D9** | **No currency is refused.** | A first draft allowed only `usd` and `cop`. Measurement withdrew it the same day: every supported currency has a retrievable historical rate (§5.3). |

**Block A is unblocked.** D2, D7 and D8 were what the guard of commit 2 had to be
written against, and all three are settled above. Nothing in §8 now waits on a decision
except commit 6, which waits on an errand rather than a question (§10.3).

### 3.3 Explicitly out of scope

- **Editing the date of an existing transaction.** This block writes new movements
  only. Editing is a different operation with a different blast radius.
- ~~**`account_balance_before_tr`.**~~ **Moved into scope — it is now §6.1.** It was
  listed here as its own later commit; on measurement the derivation §6 already writes
  covers it exactly, so deferring it would mean leaving a column that exists in no
  table being read by code this block is rewriting anyway.
- **The duplicated `updateAccountBalance`** — one in `transactionController.js:125`,
  another in `utils/fintrackUtils/accountManagement/`. Two implementations of one
  thing. Its own commit.
- **Interpolating an exchange rate.** Refused permanently, reason in §5.8.

---

## 4. The write path

### 4.1 The field

**One name: `transactionActualDate`.** It matches the column and the server's own
destructure. Format: **a calendar day, `YYYY-MM-DD`, and nothing else** — no offset,
no time (D7). The legacy `date` field that `PnL.tsx:395` and
`Debts.tsx:83` send is retired with them (§7.3).

Optional. Absent or empty means *now*, which is today's behaviour and stays the
default on every form.

### 4.2 The guard, and why it discards the value today

`transactionController.js:473-478`, catalogued as **R66**:

```js
const { transactionActualDate: actualDate } = req.body;

const transaction_actual_date =
  !actualDate || actualDate === '' || !date || actualDate === ''
    ? new Date()
    : new Date(actualDate ?? date);
```

| # | defect | consequence |
|---|---|---|
| 1 | **`!date` sits in the OR chain**, and `date` is a different variable, destructured from the body at `:270` | whenever `date` is falsy the whole condition is true, so a `transactionActualDate` the client *did* send is discarded. **Two of the five screens do send `date`** — Debts and PnL (§7.3) — so the term is not even reliably falsy; the first term of the chain is what saves it today |
| 2 | `actualDate === ''` written **twice** | dead term; the tell that the condition was never read back |
| 3 | `new Date(actualDate ?? date)` | `?? date` is unreachable — that branch only runs when `actualDate` is truthy |
| 4 | **it validates nothing** | an unparseable string becomes `Invalid Date` and reaches the insert |

The replacement takes one field name, parses it, validates it, and composes the
instant. **It must move below the account lookups** at `:499` and `:516`: the lower
bound is not knowable until both accounts are loaded.

### 4.3 Validation, in order

| # | check | failure |
|---|---|---|
| 1 | parses as a calendar date | **`400`** — the payload is malformed |
| 2 | not later than `todayInZone(timeZone)` | **`422`** naming today |
| 3 | not earlier than the **later** of the two accounts' `account_start_date` | **`422`** naming that account and its opening date |

**Both bounds are inclusive, and both compare calendar days, not instants.** The day
the account was opened is a legal day for a movement, and so is today.

**This is not a formality — comparing instants would reject a legal date.**
`account_start_date` is written as `!!date && date !== '' ? date : new Date()`
(`accountCreationController.js:91`, `:532`, `accountCategoryCreationcontroller.js:47`),
so it holds an arbitrary wall-clock time — an account opened at 20:00. A movement
back-dated to that same day composes to **12:00** under **D8**, which as an instant is
eight hours *before* the opening and would be refused for a date the rule permits.
Compare `date_trunc('day', … AT TIME ZONE $z)` on both sides, in the owner's zone —
the same technique `createTables.js:644` already uses on this very column.

`400` for the first and `422` for the rest follows the convention the budget module
already states at `budgetAllocationService.js:42-46`: *the payload parsed and every
field is well formed; what fails is the relationship between one of them and the
owner's calendar.* Reuse that shape — `Object.assign(new Error(message), { status })`.

**The later of the two openings, not the source's**: a transfer has two accounts and
the movement cannot precede either.

### 4.4 Composing the instant (D7, D8)

```
requested day == todayInZone(zone)  ->  the actual current instant
requested day <  todayInZone(zone)  ->  that day at 12:00 in the owner's zone
```

Anchor in SQL with the house technique, `($d::timestamp AT TIME ZONE $z)` — never in
JavaScript. `PLAN_TIMEZONE_ROLLOUT.md` records that a second way to turn a wall-clock
day into an instant is the thing its §4 existed to prevent.

**Both legs carry the same instant.** `transaction_actual_date` is composed **once**
and passed to both `recordTransaction` calls, or the two halves of one entry fall in
different months.

### 4.5 `updated_at` stops carrying the movement's date

Three implementations write `updated_at = $2` from a transaction date. All three
drop the parameter and take the column's default:

- `transactionController.js:138`
- `utils/fintrackUtils/accountManagement/updateAccountBalance.js:21`
- `utils/fintrackUtils/accountDeletionUtils/updateAffectedAccountBalance.js:28`

Five call sites pass the argument and stop: `transactionController.js:606` and
`:628`, `accountCreationController.js:813`, `deleteAccountService.js:248` (which
passes a redundant `new Date()`). `deleteAccountService.js:285` already omits it.

**Nothing replaces it.** *When the balance changed* is what the transactions say.
`accountEditController.js:282` already writes `updated_at = NOW()` — this aligns the
other three with the pattern the codebase already has.

**One reader exists**: `getAccountController.js:627` orders accounts by
`created_at DESC, updated_at DESC`. Today that criterion rests on a value that does
not mean what it says; afterwards it orders by genuine last touch.

> **Shared ownership, recorded 2026-08-26. These same three files are claimed by
> `PLAN_ACCOUNT_DELETION.md` §13.10**, which collapses all three into one
> function that derives the balance from the ledger, takes `user_id`, and writes
> `updated_at = CURRENT_TIMESTAMP`. This section is a **strict subset** of that
> consolidation.
>
> **Whichever block reaches these files first owns them; the other records the
> outcome instead of repeating the work.**
>
> ```
>  this section first   §13.10 inherits three single-parameter functions and
>                       collapses them anyway; its updated_at half is done
>
>  §13.10 first         this section is absorbed and its commit is withdrawn,
>                       not re-implemented. Verification 6 still passes
> ```
>
> Neither order breaks anything and neither blocks the other: the deletion
> block's release order opens with a foreign-key change that touches none of
> these files. What must not happen is both blocks implementing this section as
> though they were its only owner.

### 4.6 What must be reused, not rewritten

| need | existing |
|---|---|
| the owner's zone | `getUserTimeZone(db, userId)` — `date-utils/getUserTimeZone.js:20` |
| today in that zone | `todayInZone(timeZone)` — `date-utils/resolveZonedWindow.js:42` |
| the sign of a movement | `balanceMultiplierFn` — `transactionController.js:116` |
| a day anchored in a zone, in SQL | `($d::timestamp AT TIME ZONE $z)` |
| the error shape | `budgetAllocationService.js:42-46` |

---

## 5. The exchange rate of a past day

### 5.1 The routing rule

```
transactionActualDate == todayInZone(ownerTimeZone)  ->  fxProviderOrchestrator, unchanged
otherwise (a past date)                              ->  the historical cascade, §5.2
a future date                                        ->  422 (D2)
```

**"Today" is today in the owner's zone.** A movement recorded at 23:00 in Bogota on
the 24th is otherwise compared against the 25th in UTC and routed to the historical
path asking for a date no source has published yet.

**The default path does not change at all.** When the form sends no date — what all
five screens do today and what remains the common case — that is "today", it goes to
the orchestrator byte for byte as now. **The historical cascade runs only on an
explicit past date**, so this section carries no risk to current behaviour.

**It is a separate path from the orchestrator, not a change to it.**
`fxProviderOrchestrator` resolves the *current* rate through a freshness cascade with
TTLs. A historical rate has no freshness — it is one published figure or none.
Mixing them would put a TTL on a fact that cannot change.

### 5.2 The cascade

> **"Why insist on one arm when there are other sources?" — asked 2026-08-29,
> answered here so it is not re-asked.**
>
> **The walk-back is not a retry. It is the business-day oracle**, and the two arms
> below it cannot be asked until it has answered.
>
> - **The CDN must never be asked for the raw requested date.** Measured across
>   `2026-05-14`…`18`: Saturday and Sunday move against Friday and against each other
>   on days nothing traded, and Monday snaps back to Friday's figure to the fourth
>   decimal. Asking it for a closed day returns **a fabricated number**, which is the
>   class this plan refuses under interpolation. It can only be asked for a resolved
>   `effectiveDate` — and the walk-back is what resolves it.
> - **AllRatesToday's window is today−5 to tomorrow.** For any date older than that it
>   has nothing to say, and the older dates are the reason this block exists.
>
> So *"try the others first and insist afterwards"* would mean asking the CDN for a
> holiday, taking the fabricated figure, and never reaching the insistence at all.
> **The order is not a preference; it is what stops a made-up rate from being stored.**
>
> **Where the cost actually falls, measured.** A source that is down costs **one**
> call, not five: only an empty answer consumes a step, and a transport failure aborts
> the arm immediately. The five calls happen only when the source is healthy and the
> day is genuinely closed — a real holiday run — and in that case no other arm could
> have answered anyway.
>
> **The remedy is §10.4, not a reordering.** The daily-window endpoint answers the
> oracle question and the rate question in one call, so the insistence stops existing
> instead of being moved. **If the window lands, this whole justification changes
> shape**: the oracle becomes one cheap call and the order of the arms below it can be
> revisited on cost alone, which it cannot be today.

```
resolveHistoricalRate(currency, requestedDate)

1. currency == usd
   -> rate 1, source "identity". No HTTP.

2. currency == cop
   a. Banrep   ?$where=vigenciadesde<=D AND vigenciahasta>=D
      Resolves weekends and holidays in ONE call: the row carries its own
      validity range. effectiveDate = vigenciadesde.
   b. on failure -> step 3 (Banca d'Italia covers cop too)

3. eur | mxn | ves  -- and cop as fallback
   a. Banca d'Italia
      ?referenceDate=D&baseCurrencyIsoCode=<cur>&currencyIsoCode=USD
      empty -> D minus one day -> retry. At most 5 steps.
      First non-empty answer wins; its date is effectiveDate.
   b. on failure -> step 4

4. [REMOVED FROM V1 2026-08-29 — see §5.9. The cascade has three arms, not four.]

5. CDN   @<effectiveDate>/v1/currencies/usd.json
   Asked for the resolved effective date, never the raw requested one.
   If no effectiveDate was established, the requested date is used.

6. Nothing answered -> 422. Never today's rate on a past movement.

Stored: exchange_rate_source = "<provider>@<effectiveDate>"
```

**Two asymmetries, stated because they do not read for themselves.** Banrep is first
only for `cop`, because it is the official Colombian rate and the only source that
spans a bridge without stepping back. And **Banca d'Italia is simultaneously the
universal fallback and the business-day oracle** — its emptiness is what defines a
day with no market, which is why the walk-back lives in that arm and every other arm
inherits the date it resolves.

**Every provider call carries a timeout, and the cascade carries a ceiling.** Without
one, a provider that accepts the connection and never answers holds the movement's
transaction open — the owner sees a form that does not return, not an error.

| bound | value | why |
|---|---|---|
| per HTTP call | **2s** | a published historical figure is a static document; a source that has not answered in two seconds is down, not slow |
| the whole cascade | **5s** | fixed by the developer on 2026-08-24 against what a form submit may hang for, not against the sum of the arms |

**The ceiling is sized by the user, not by the providers, and that is the right way
round.** This runs inside a form submit. A save that hangs longer than a few seconds
reads as broken no matter how principled the cascade behind it is, so the ceiling is
the budget and the per-call timeout is derived from it: **at 2s per call, two arms get
a full turn before the 5s ceiling cuts the third.**

**An earlier draft said 20s, and it was wrong in its premise.** It reasoned that the
walk-back can issue five sequential calls at 5s each, so 25s of timeouts, and set the
ceiling just under. That multiplies two things that are not the same:

- An **empty** answer — Saturday, a holiday — returns in roughly 300ms. It is a `200`
  with an empty array. Five of those is about 1.5s, not 25s. **This is the case the
  walk-back exists for**, and it fits inside one arm's budget.
- A **timeout** means the host is not answering, and **walking back against a host that
  is down cannot help**: the previous day would be asked of the same dead server.

**So a timeout aborts its arm; only an empty answer consumes a walk-back step.** With
that rule the walk-back never multiplies timeouts, and the worst case is one timeout per
arm rather than five.

The ceiling is checked before each new call and aborts the resolver, which then returns
`422` like any other exhausted cascade.

**Two consequences of a 5s ceiling, stated because they are real costs, not
footnotes:**

- **The arm order stops being a preference and becomes load-bearing.** With about two
  arms getting a turn, the CDN — the only source covering all four currencies — is
  rarely reached. It is the last resort in the literal sense now.
- **A long weekend against a slow-but-alive Banca d'Italia aborts.** Five walk-back
  steps answering in 1.8s each is 9s, over the ceiling, and the resolver returns `422`
  for a date the source would eventually have answered. The alternative was a ceiling
  that lets a form hang, and that was rejected.

**No retry and no backoff.** A retry is the right instrument when the answer might
differ on a second attempt; a historical rate is one published figure, so a provider
that failed will fail identically. The cascade's next arm *is* the retry, against a
different source — which is the only kind worth making. Adding backoff would multiply
the latency the ceiling above exists to bound.

**Failure never falls through to today's rate.** Step 6 already states it; it is
repeated here because it is the one behaviour a timeout handler is tempted to add.

### 5.3 Measured coverage — every cell a live request

| source | `cop` | `eur` | `ves` | `mxn` | exact date | weekend | key |
|---|---|---|---|---|---|---|---|
| Banrep TRM | ✓ official | — | — | — | yes | **carries forward itself** | no |
| Banca d'Italia | ✓ | ✓ | ✓ | ✓ | yes | **empty** | no |
| AllRatesToday | ✓ | ✓ | ✓ | ✓ | **7-day window only** | carries forward | **yes** |
| CDN `currency-api` | ✓ | ✓ | ✓ | ✓ | yes | **fabricates movement** | no |
| Frankfurter | ✗ absent | ✓ | ✗ absent | ✓ | yes | — | no |

For `2026-05-14`: Banrep `cop 3794.91` · Banca d'Italia `cop 3784.39`, `ves 510.15`,
`mxn 17.1983`, `eur 0.8546` · CDN `cop 3785.86`, `ves 508.88`.

**Why the currency rule is not "block foreign currencies".** The owner's real data,
counted on `fintrack_prod_data` and `fintrack_rehearsal` (identical, 785 movements):
`cop` 503 (64%), `usd` 272 (35%), `ves` 6, `mxn` 4. **513 of 785 rows carry a real
conversion**, so refusing foreign currencies would refuse back-dating on 65% of what
the owner actually records. The principle survives instead as *only a rate that can
be named truthfully is ever stored* — which every allowable date now has.

**The series floor cannot be reached.** The CDN resolves back to `2024-03-06` and
refuses `2024-03-01`. The owner's whole database begins **`2026-05-14`** — oldest
account and oldest movement the same day — so every source reaches further back than
**D3**'s lower bound will ever permit.

**Publication lag is irrelevant here.** A back-dated movement asks for a day that
closed weeks ago. Banrep in fact publishes *ahead*: queried on the 24th it already
returned the TRM effective the 25th.

### 5.4 Weekends and holidays

**A movement dated on a day with no published rate takes the last published business
day's rate, and the record names that day.** Not a workaround — it is what a bank
does with a weekend card purchase.

**Correction measured 2026-08-29, while implementing the Colombian arm: on that source
a Saturday is answered by itself, not by the Friday.** Banrep opens a new validity range
*on* the Saturday and runs it through the Monday, so the figure is calculated from
Friday's market but stamped effective Saturday, and it is a different number from
Friday's — Friday `2026-08-21` reads `3062.96`, the Saturday-through-Monday range reads
`3048.12`. The rule above therefore holds in substance for every source — a day never
gets a rate that was not in force on it — but the day recorded in
`exchange_rate_source` is **the day the official validity range opens**, which for this
source is the Saturday. A Sunday and a holiday do fall back: Sunday `2026-08-23` is
answered by the 22nd, the holiday Monday `2026-08-17` by the 15th. The walk-back arms of
the paragraph below are unaffected, because they resolve by absence of an answer rather
than by a published range.

**No holiday calendar is needed anywhere in the app.** Banca d'Italia returns empty
for `2026-05-16` and `2026-05-17` and answers `517.3144` for `2026-05-18`, so
stepping back until it answers resolves a Saturday, a Colombian holiday and Christmas
by the same mechanism, with the app knowing no country's calendar. Cap the walk at
five days.

**The CDN must never be asked for the raw requested date.** Measured across
`2026-05-14`…`18` for `ves`:

| day | `ves` | `cop` |
|---|---|---|
| Thu 14 | 508.8754 | 3785.86 |
| **Fri 15** | **510.1489** | 3789.72 |
| Sat 16 | 514.8062 | 3798.15 |
| Sun 17 | 514.4650 | 3793.37 |
| **Mon 18** | **510.1490** | 3799.05 |

Saturday and Sunday move — against Friday and against each other — on days nothing
traded, and Monday snaps back to Friday's figure to the fourth decimal. **That is the
same class of number this document refuses under interpolation.** AllRatesToday, by
contrast, reads `778.977` for Fri 21 through Mon 24: it carries forward, which is
independent evidence that the CDN's weekend wobble is the anomaly.

**Implementation note.** Banca d'Italia's `ves` for `2026-05-14` is `510.15`, which
matches the CDN's **Friday the 15th**, not its Thursday `508.88`. The two sources
carry a one-day offset. Whichever arm answers, `exchange_rate_source` names the date
the rate actually came from, which makes the discrepancy visible rather than silent.

**The rule, as the developer settled it on 2026-08-29.** Stated first as *"a holiday, a
Saturday and a Sunday always take the last business day's rate"*, and then reconciled
with the Banrep measurement above, which is the one case that does not walk back. Two
readings were put to the developer and **A was chosen**:

- **A, chosen — the official figure for that day wins.** A Colombian Saturday is worth
  `3048.12`, because that is the TRM legally in force on it, and `exchange_rate_source`
  names the Saturday.
- **B, rejected — the last business day literally.** The Saturday would be worth Friday's
  `3062.96`, overriding the published validity range in `banrepTrmProvider.js:192`.

B was rejected on the same ground this document rejects interpolation: it would record,
for a real Saturday, a rate that was not in force on that Saturday. The canonical
wording of the rule therefore becomes **"a day takes the rate the official source
declares in force on it, and the record names the day that rate came from"** — which the
walk-back arms satisfy by absence of an answer and Banrep satisfies by its published
range. No arm is exempt and no code changes because of this decision; it fixes the words
so a later reader does not "correct" `banrepTrmProvider.js` into B.

### 5.5 Five files — four arms and the resolver that orders them

The cascade of §5.2 has **four provider arms**, not three. Each is one function, and
two of them are additions to files already in the tree.

| # | file | function | state |
|---|---|---|---|
| 1 | `fxProviders/banrepTrmProvider.js` | `fetchTrmForDate(date)` | **exists**, gains a function |
| 2 | `fxProviders/bancaDItaliaProvider.js` | `fetchBancaDItaliaRate(cur, date)` | **new** |
| ~~3~~ | ~~`fxProviders/allRatesTodayProvider.js`~~ | ~~`fetchAllRatesTodayWindow(cur)`~~ | **REMOVED FROM V1 2026-08-29 — §5.9** |
| 4 | `fxProviders/githubFallback.js` | `fetchRatesForDate(base, date)` | **exists**, gains a function |
| 5 | `core/historicalRateResolver.js` | `resolveHistoricalRate(cur, date)` | **new** |

- **`fetchTrmForDate(date)`** beside `fetchTrm()`. Same URL, same row shape, same
  `parseColombianDate`; a `$where` on `vigenciadesde` / `vigenciahasta` replaces
  `$limit: 1, $order: … DESC`.
- **`bancaDItaliaProvider.js`**:
  `GET https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0/dailyRates`
  `?referenceDate=<date>&baseCurrencyIsoCode=<cur>&currencyIsoCode=USD&lang=en`
  with `Accept: application/json`. One currency per call, the rate in
  `rates[0].avgRate`, plus the walk-back of §5.4. **It owns the walk-back** because its
  emptiness is what defines a day with no market; the other arms inherit the date it
  resolves.
- **`allRatesTodayProvider.js`** returns the **window**, not a rate for a date, and the
  distinction is the whole safety argument — see below. The only credential in V1.
- **`fetchRatesForDate(base, date)`** — the same URL with the date in place of
  `latest`. One call returns all four currencies.
- **`historicalRateResolver.js`** sits **beside** `fxProviderOrchestrator.js` in
  `core/`, not inside it. §5.1 states why: the orchestrator resolves the *current* rate
  through a freshness cascade with TTLs, and a historical rate has no freshness. Making
  it a branch of the orchestrator would put a TTL on a fact that cannot change.

**AllRatesToday needs one usage rule to be safe: never send `date`.** It accepts the
parameter and silently ignores it — verified across six shapes (`date=`, `on=`,
`start=`/`end=`, `period=90d`, `/historical-rates/<date>`, `/rates/<date>`), always
returning the same 7-day window. So the caller requests the window and reads the row
whose `.date` matches, taking no neighbour if it is absent. Used that way it cannot
substitute a date, because the caller checks what it got rather than trusting what it
asked for.

**That is why its function is named for the window and not for a date.** A signature
reading `fetchRateForDate(cur, date)` would invite the next reader to trust the date it
passed, which is the exact defect. The provider hands back rows; the resolver picks the
one whose `.date` matches, or none.

**`API_KEY_AllRatesToday` is the only credential in V1** and is needed on the Vercel
backend too. **The rotation gates the deployment, not this commit** — the arm may be
written and run locally with the key as it stands. The errand and its deadline live in
`PLAN_DEPLOYMENT/PLAN_PRODUCTION_MERGE.md` section 4, item 9; see section 10.3.

### 5.6 Provenance costs no migration

`transactions.exchange_rate_source` is `VARCHAR(60)`
(`007_transactions_fx_columns.sql:13`) — room to spare for `banrep-trm@2026-05-14`,
`bancaditalia@2026-05-14`, `allratestoday@2026-08-21` or `currency-api@2026-05-14`.
The schema already has the slot.

### 5.7 The seam

`currencyAmountConversion(amount, from, to)`
(`fx_services/conversion/currencyAmountConversion.js:29`) gains a **fourth optional
`asOfDate`**. Absent, it behaves exactly as today — every existing caller (account
creation, budget, pocket target, debtor value) is unaffected.

### 5.8 What V2 owns, and what is refused forever

- **A user-typed rate override.** The most accurate source, because the owner's bank
  applied a rate with a spread no mid-market quote equals — but an accuracy
  refinement over a published figure, not a gap, and it costs a field on five forms.
- **The accumulated rate history.** `exchange_rates` gains
  `UNIQUE (base_currency_id, target_currency_id, rate_date)`; it is
  `UNIQUE (base, target)` today (`006_exchange_rates.sql:18`), one row per pair,
  overwritten. Only two functions write it, both in `fx_services/db/fxDBaccess.js`
  (`upsertRatesBatch`, `persistRateInDB`), one `ON CONFLICT` clause each;
  `getRateFromDB` is already written `ORDER BY fetched_at DESC LIMIT 1`. **Its real
  argument is not lookup speed but provider risk**: the CDN is one npm package
  maintained by one person, and a rate already stored does not depend on its
  provider's future.
- **Frankfurter and ECB SDMX**, if `eur` or `mxn` volume ever grows. Frankfurter
  exposes 30 currencies, not the 201 its documentation suggested, with `COP` and
  `VES` both absent — Banca d'Italia already serves the same ECB-derived figures to
  the fourth decimal *and* covers `ves`.
- **BANXICO SIE** for official `mxn`, if 4 rows ever becomes a number worth a token.

**Interpolation stays refused permanently.** An interpolated rate is a number no
market ever quoted, written into an audit record as a fact. FX moves in steps — a
devaluation is a discontinuity — so a linear interpolation is most wrong precisely on
the days that matter most, and a date before the series starts has no bracketing
points at all.

**Rejected outright:** `tipodecambio.co` (the same Banrep TRM through a third-party
wrapper, when the primary is already read directly), `bcv.today` (a BCV scrape the
CDN matches to 0.5%), and `BCRP` · `BCRA` · `BCB` · `BdE` · `BoE` (currencies the app
does not have; `SUPPORTED_CURRENCIES` is `['usd','eur','cop','ves','mxn']`).

---

## 6. The reads that stop being reads

### 6.1 The five read sites

Five sites read `account_balance_after_tr` as if it were history. **The column stays
in the table**; it stops being read. Dropping it is a later decision — see §6.2.

Line anchors refreshed 2026-08-26, after `ab345e2` shifted the controller.

| site | what it renders | becomes |
|---|---|---|
| `getTransactionsForAccountById.js:239` and `:312` | the per-row balance column, shipped by `tr.*` on both queries | a running window over the account's movements |
| `getTransactionsForAccountById.js:366-393` | the balance carried into the period, **both windows** since `ab345e2` | `account_starting_amount + Σ(everything strictly before the boundary)` |
| `getTransactionsForAccountById.js:452-478` | the panel's initial / final balance | first and last point of the derived series |
| `getAccountController.js:121-131` | the same, on another screen | the same |
| `transactionController.js:844` + `:973-974` | `getTransactionById`, the single-movement detail | the derived balance at that movement, or the field is dropped from the payload |

**CORRECTED 2026-08-30 — the formula in the second row of that table is wrong.**
`account_starting_amount + Σ(everything)` double-counts the opening amount on every
account whose account-opening row already carries it, measured on four accounts in
`fintrack_dev`. The sum must **exclude account-opening rows**:
`account_starting_amount + Σ(rows that are not movement type 8, strictly before the
boundary)`. The measurement, the two rival derivations and why this one wins are in
§10.3. Read that before writing commit 3; it is the commit's core arithmetic.

**The fifth site was found on 2026-08-24 and is the one that reaches a screen
unaccompanied.** `GET /api/fintrack/transactions/:id` selects the column and
`:973-974` parses it into the response, so the movement-detail view states a balance
with no series around it to contradict it. It is also the cheapest to get wrong,
because a single row cannot be checked for monotonicity by eye.

**~~The legacy window inherits the fix without code of its own.~~ SUPERSEDED
2026-08-26 by `ab345e2 fix(account): bound the panel to account life`**, which gave
the `start`/`end` branch its own correction ahead of this block, on the developer's
instruction after the defect surfaced on screen.

What that commit did, and why it did not wait: the branch read
`account_balance_before_tr`, **a column that exists in no table**, so the `||` fell
through on every call and reported *the balance at the account's birth* labelled as
*the balance at the start of the window* — on a start day that, for an account opened
mid-window, preceded the account itself. It now calls the same carried-balance query
the month branch uses, generalised to take its boundary day as a parameter
(`getBalanceCarriedIntoPeriod`, `getTransactionsForAccountById.js:366`), and both
period bounds pass through `clampToAccountLife`. Three screens display the result:
Pocket, Debtor and Account detail.

**What that leaves for §6 is smaller, not gone.** The carried-balance query still
reads `account_balance_after_tr` (`:370`) — it is now one call site instead of two, and
it is still the second row of the table above. Replacing it with
`account_starting_amount + Σ(everything strictly before the boundary)` is unchanged
work; what changed is that the range branch will inherit it for free, because both
windows now go through the one function.

**§6 no longer changes what these three screens display.** `ab345e2` already moved
them from the wrong figure to the right one, and the derivation replaces how that
figure is computed, not what it says. The remaining visible risk in §6 is the per-row
balance column and the movement-detail view.

**Two items from this section are already done.** The comment at the old `:369` that
called the column *"an audit fact written at transaction time, never re-derived here"*
was rewritten by `ab345e2` — see the "Correct on discovery" note below, which is
closed. And the range branch's period is now bounded, so it can no longer state a
window the account did not live.

**Found while verifying `ab345e2`, and NOT fixed there — a separate commit.** The
panel can state two currencies at once: `getFinalBalance` (`:466`) takes its currency
from `tr.currency_id`, the movement's **origin** currency, while `initialBalance` now
takes it from `ua.currency_id`, the account's **accounting** currency. Measured on
pocket 38, which returns `initial 0 usd` beside `final 0 cop`. The accounting currency
is the correct one — the origin currency is FX metadata, not what the balance is
denominated in. The same defect sits in the month branch's `getInitialBalance` (`:460`)
and in the prior-row arm of `getBalanceCarriedIntoPeriod`. It was left alone because
`getFinalBalance` is this section's territory and correcting one end without the other
would swap which half of the panel disagrees.

**The wire name does not change.** The account list renders the field under the label
`Balance` at
`accountDetailSharedComponents/accountTransactionsList/AccountTransactionsList.tsx:230`,
destructured by its raw name at `:116`, and typed at `types/responseApiTypes.ts:171`
and `:590`. The derived figure must be emitted under the same key
`account_balance_after_tr`, so **§6 is backend-only and no frontend file is touched.**

**The pattern already exists sixty lines above**, at
`getTransactionsForAccountById.js:227-236` — a cumulative window ordered
`tr.transaction_actual_date ASC, tr.transaction_id ASC`, already used for the month's
cumulative spend and already recolocating itself when a back-dated row arrives. The
sign needs no helper: `transactions.amount` is stored signed, so the window is a
plain sum. `balanceMultiplierFn` has no live caller and is registered for the
cleanup block (R257).

**The panel does not paginate** — measured: no `LIMIT` or `OFFSET` on the
transactions query (the two `LIMIT 1`s are the account lookup and the prior-balance
query). The window therefore runs over the complete set of the queried month.

**What it still needs is an anchor.** The window covers one month, not the account's
whole life, so the series must start from the balance carried into that month — the
second row of the table above, used as the window's starting offset rather than
rendered as a standalone number. **One query serving two purposes.**

**The second site is the worst today and becomes the safest.** It currently selects
the `account_balance_after_tr` of the last row *before* the month, so a back-dated row
becomes that "prior" row and carries a figure from the future. As an order-independent
sum it is correct by construction and cannot be broken by any insert.

**~~Correct on discovery~~ — DONE 2026-08-26 in `ab345e2`.** The comment called the
column *"an audit fact written at transaction time, never re-derived here"*. It is a
cache of a derivable figure, and that label is what protected it. The block that
carried it was rewritten, and the replacement above `getInitialBalance` names the
column as a stored figure without calling it audit.

### 6.2 The column also stops being written — `0.00`, no migration

Stopping the reads leaves the writes, and **a back-dated insert is exactly what makes
the stored values false.** The column holds the balance computed at the instant of
insertion; a movement landing in the middle of an existing series does not re-strike
the rows after it, so every later row keeps a figure that no longer corresponds to its
position. Left as it is, the table accumulates wrong numbers that nobody reads —
waiting for someone to read them again believing they are audit, which is precisely
how the comment at `:369` protected the column until now.

**Two writers, one parameter each:**

| writer | what it passes |
|---|---|
| `transactionManagement/recordTransaction.js:68` | `account_balance`, the twelfth value of the `INSERT` at `:80` |
| `accountDeletionUtils/recordAnnulmentTransaction.js:137` | the same column on the annulment path |

**Both write `0.00` explicitly, and the schema comment is annotated `deprecated`.**

- `DECIMAL(15,2) NOT NULL DEFAULT 0.00` (`003_transactions.sql:43`) already accepts it,
  so **no migration and no DDL change** — the constraint the column carries is
  satisfied by the value that means "this holds nothing".
- A stored `0.00` cannot be mistaken for a balance. A stale figure can.
- Dropping the column is a separate migration, scheduled once the derived series has
  been running long enough to be trusted. **A deletion waits for the working module**;
  this step makes the column harmless in the meantime without deleting anything.

**The two callers keep computing the balance** — `updateAccountBalance` needs it for
`user_accounts.account_balance`, which stays persisted (§2.1). What changes is that
the figure is no longer copied into the transaction row.

**Order matters: this lands with the reads, never before them.** While any of the five
sites of §6.1 still reads the column, writing `0.00` would render zeros on screen.

---

## 7. The control

Last on purpose: the only visible half, and the only one that cannot corrupt data.

**The client's silence is what keeps the window of §8.1 shut, and this section is
what breaks it.** No frontend file sends `transactionActualDate` — swept 2026-08-24,
re-measured 2026-08-26. The five screens below are the complete list of what has to
change for the field to exist at all, and no screen ships before commit 8.

### 7.1 Three validation systems, not one — measured 2026-08-26

The tracker does not validate the way a single sentence can describe, and an earlier
draft of this section said `trackerMovementSchema.ts` gains the field *on all five
schemas*. **It holds three.** Where the field lands differs per screen:

| system | file | screens | what the date needs there |
|---|---|---|---|
| zod | `validations/zod_schemas/trackerMovementSchema.ts:8,18,29` | Expense · Income · Transfer | a `transactionActualDate` entry in each of the three `z.object` literals |
| a hand-rolled validator registry | `validations/validationPnL/validationPnL.ts:152-164` | PnL | the `date` entry **already exists** and returns `isValid: true` for every input; it is renamed and given the bounds |
| a generic whole-object validator | `validations/utils/custom_validation.ts:4` | Debts | **no entry at all.** `validationData(datatrack)` (`Debts.tsx:397`) already iterates every key of the state object, `date` included, and a `Date` is never empty — the field passes today and keeps passing |

**Debts is not schema-less, and an earlier draft of this section said it was.**
Measured 2026-08-26: the screen validates the whole form at submit through
`validationData(datatrack)` (`Debts.tsx:397`), the generic helper of
`validations/utils/custom_validation.ts:4` that four other forms use as well —
`NewAccount.tsx:272`, `NewCategory.tsx:355`, `NewPocket.tsx:189`,
`NewProfile.tsx:269`. It is not a fourth system: it is the third of the three above,
and Debts is the only tracker screen inside it.

**Debts keeps `validationData` — settled by the developer 2026-08-26.** The date
field gets no schema entry on this screen, for two measured reasons. First, the
helper is generic over the state object: `date` sits in `datatrack` (`Debts.tsx:83`),
`validationData` already walks it, and a `Date` is neither empty nor a number, so it
passes every branch — present and inert, the same shape as PnL's registry entry.
Second, **the client-side bound does not live in a schema on any of the five
screens**: it is the `minDate` / `maxDate` props the picker gains in §7.2, and a day
the calendar will not let the owner press never reaches validation at all. The schema
entry is a third line of defence behind the control and the server's `422`, never the
enforcement.

**What adopting zod on Debts would actually cost, which is why it is out of this
block.** Validation messages are produced on this screen in four places: the amount
handler `useInputNumberHandler` (`Debts.tsx:276`), the inline branch of
`updateTrackerData` (`:325-343`), three `useEffect` blocks that couple the debtor,
account and note errors to the amount having a value (`:516-586`), and
`validationData` at submit. Adding a `debtsSchema` beside them leaves two validators
writing the same `validationMessages` object with different message text — the two
sources of truth that **D4** exists to remove. Making it coherent means deleting
`validationData` and the three effects, and that is the refactor, not a call site.

**The migration is its own commit, after this plan and outside it.** Debts moves onto
`useFormManager` with a `debtsSchema`, the way Income (`Income.tsx:140`) and Transfer
(`Transfer.tsx:177`) already run, as a single change with its own subject. It is not
carried by a commit whose subject is a date field. Nothing in the back-dating block
depends on it: the three effects fire on `formData.amount`, not on the set of keys,
so adding the date does not touch them.

### 7.2 The shared control

**Reuse `general_components/datepicker/Datepicker.tsx`**, the shared
`react-datepicker` control already in the tree. Three changes, all inside it:

- **The dead reset.** `isReset` is declared in `DatePickerProps` at `:21` and is
  **not destructured** by the component at `:49` — passing it does nothing, so a
  submitted form keeps the date the owner last chose and the next movement inherits
  it silently. Harmless on one screen; a source of mis-dated entries on five. Note
  that Expense, Income and Transfer each already hold an `isReset` state
  (`Expense.tsx:108`, `Income.tsx:106`, `Transfer.tsx:136`) that works for their
  other controls — only the picker's arm of it is dead.
- **The bounds are module constants**, `MIN_DATE = 1900` and `MAX_DATE = 2100` at
  `:28-29`. The bounds of §4.3 are per account and per owner zone, so they become
  props with those two as the fallback.
- **The five interactive states**, including the `:focus-visible` ring at 2px / 2px
  offset, on `styles/datepicker-styles.css`.

**The state lives in each form, never in `TrackerLayout.tsx`.** As `PnL.tsx` already
does it — `date` in `initialData` (`:72-77`), a `changeDate` handler writing both
input and validated state (`:334-338`), the value in the payload (`:395`). A
layout-owned date survives a route change between Expense and Income and carries a
date picked on another screen.

### 7.3 The five screens, one commit each

Whole components: markup, the state field, the validation entry of §7.1, its own CSS
block on the semantic tokens, and the five interactive states. Default today, **no
visible label** — P&G's current `Date` label goes; the field is identified inside the
picker's own control.

| # | screen | file | what it has today | what it needs |
|---|---|---|---|---|
| 10 | Expense | `pages/tracker/expense/Expense.tsx` | no date in state, none in the payload | the state field, the picker, the zod entry |
| 11 | Income | `pages/tracker/income/Income.tsx` | the same | the same |
| 12 | Transfer | `pages/tracker/transfer/Transfer.tsx` | a commented `transaction_actual_date` at `:316`, nothing live | the same, and the dead comment goes with it |
| 13 | Debts | `pages/tracker/debts/Debts.tsx` | **`date: new Date()` in state (`:83`) and in the payload by spread (`:412-416`), with no control that sets it** — the reset at `:479-482` re-stamps it | rename to `transactionActualDate`, send `YYYY-MM-DD`, draw the picker with its bounds. **No validation entry** — §7.1 |
| 14 | PnL | `pages/tracker/profitNloss/PnL.tsx` | **the only screen with a picker** (`:565-571`), sending `date` as a `Date` object at `:395` | rename the payload field, send a calendar day, adopt the bounds |

**Two screens already send a date and both are discarded.** Debts and PnL send a
field named `date`, which the controller does destructure at `:270` — this is the
`date` of the guard's defect 1 in §4.2, and correcting that row's wording is part of
commit 2: it is not a variable *nobody* sends, it is a variable **two of the five
send and the guard then uses to discard the other one**. Neither is corrupting
anything today only because `transactionActualDate` is absent, so the first term of
the OR chain is true regardless.

### 7.4 The payload needs no edit on three of the five

Expense (`:408-411`), Income (`:317-320`) and Transfer (`:506-509`) build the body by
spreading the validated object. **The field reaches the request the moment it exists
in state and passes validation** — there is no payload literal to extend. Debts
spreads its own tracker state (`:412-416`), which is why its `date` is already on the
wire. PnL is the only screen that names the field explicitly in the payload (`:395`),
and it is the only one whose payload literal changes.

`transactionActualDate` is optional on every schema. Absent or empty means *now*,
which is today's behaviour and stays the default on all five forms.

**This is what closes R66's annotation.** The P&G picker is decorative until this
block runs; the developer ruled on 2026-08-24 that it keeps the defect, annotated,
until then.

---

## 8. Order of work

**Restructured 2026-08-29.** It used to be four lettered blocks read as a sequence,
and the sequence was wrong in two places: commits 7 and 9 depend on nothing and sat
behind blocked work because of their number. **The numbers are names, not an order.**
They are kept because other documents cite them.

**The rule that does not move: the whole backend lands before the first picker is
drawn**, so by the time a date can be sent, every figure it can produce is correct.

### 8.0 State, measured 2026-08-29

| # | commit | state |
|---|---|---|
| 1 | `fix(account): untie updated_at from the movement` | **landed** `1208310` |
| 2 | `feat(tracker): validate the movement date` | **landed** `6adc8de`. Closes R66 |
| 4 | `feat(fx): fetch the trm of a past date` | **landed** `41502fd`. `fetchTrmForDate` exists and has no caller, by design |
| 5 | `feat(fx): add the banca d'italia provider` | **landed** `e7dc38a` *(corrected 2026-08-30; it read "written, uncommitted, no gate presented" and the arm shipped whole, with both §8.3 defects folded in)*. It no longer has zero callers: the resolver imports it |
| 9 | `fix(datepicker): drop the dead reset, add maxDate` | **landed** `7693fb0` 2026-08-30. `isReset` is out of the shared control and out of its two callers; `maxDate` mirrors `minDate` as an optional override |
| 7 | `feat(fx): fetch the rates of a past date` | **landed** `95b321d` 2026-08-30. `fetchRatesForDate` on `githubFallback.js`, no caller by design. Verified live: `USD` on `2026-05-15` returns 300 rates; `fetchAllRates` and `fetchRate` unaffected by the URL split |
| 3, 8, 10–14 | | ~~not written~~ **all landed — corrected 2026-08-30.** Commit 3 across `a2bd75a`, `f8cce22`, `f7cae5b` and `17a0714`; commit 8 the cascade resolver, `ddadb7d`; commits 10–14 the five screens, `81dbb5c`. Commits `15` (`34b6e18`), `16` (`664ad5c`), `17` (`2b4d3dc`), `18` (`ebd7622`), `19` (`83d22ca`) and `20` (`be6ebbf`) are not in this table at all; they are in `PLAN_BACKDATING.md` §7, which is the ledger of record |
| 6 | the credentialled arm | out of V1 — `PLAN_BACKDATING.md` §8.2 |

### 8.1 The dependency graph

Two lanes. Nothing in one waits on the other.

**Lane A — unblocked, executable in any order**

```
commit 7   fetchRatesForDate on githubFallback.js   — adds a function, no caller
commit 9   the shared datepicker                    — one component, five live callers
```

**Lane B — the chain**

```
window endpoint contract (§10.4) ──► commit 5 ──┐
                                                 ├──► commit 8 ──┐
commit 7 ───────────────────────────────────────┘                │
                                                                  ├──► commits 10–14
slack decision (§10.2) ──► scope decision (§10.3) ──► commit 3
```

**Why each edge exists, and only these edges exist:**

- **The window query precedes commit 5** because it rewrites the arm's core query.
  Committing first and rewriting after is two commits for one arm, the second of
  which has to explain why the first existed. **The choice was settled on 2026-08-30;
  what is still owed is the endpoint's URL, parameters and row shape, which no
  document records and which the host is not answering for right now (§10.4).**
- **Commits 5 and 7 precede commit 8** because the resolver orders the arms; it
  cannot order what is not written.
- **Commit 3 precedes the screens** because a back-dated row inserted mid-history
  makes the stored running balance show a step backwards. It does **not** precede the
  cascade: the two touch nothing in common.
- **Commit 8 precedes every screen.** This is the safety rule of §8.2, not a
  preference.
- **Commit 9 precedes the screens** so none of them inherits the dead reset, and
  nothing else.

### 8.2 The safety rule, unchanged

**Commit 2 opened the door and commit 8 is what makes the room safe** — a past date
the guard accepts has no historical rate until the resolver exists, and a
foreign-currency movement in that window would be stamped with today's rate, which
this plan refuses.

**That window is shut by measurement, not by luck.** No frontend file sends
`transactionActualDate` — swept 2026-08-24, re-measured 2026-08-26 and again
2026-08-29, always zero occurrences in `frontend/src`. The gap is closed by the
client's silence, and **commit 10 is what breaks that silence.**

> **Marked, not struck — 2026-08-30.**
>
> - **What the passage asserts:** no frontend file sends `transactionActualDate`, so the
>   window between the guard accepting a past date and the resolver existing is held shut
>   by the client's silence.
> - **What the code says:** six files carry it. The hook
>   `frontend/src/fintrack/hooks/useTransactionDate.ts:52` composes it, and it reaches the
>   payload from `Expense.tsx:540`, `Income.tsx:373`, `Transfer.tsx:644`,
>   `Debts.tsx:461` and `PnL.tsx:460`. The silence was broken by `81dbb5c`.
> - **The premise of the safety rule has therefore been consumed, in the order the rule
>   required**: the resolver (`ddadb7d`) and the dated conversion (`34b6e18`) landed
>   before the screens. The rule is not violated — it is spent. What now needs a fresh
>   decision is what replaces it as the guard on this block: with the client sending a
>   day, "the client is silent" is no longer available as a safety argument for any later
>   change to the cascade, and §9's seventeen hand checks — none of which has been run —
>   are the only thing left standing between a past date and a wrong rate.

Commits 4, 5 and 7 are each dead code on arrival: they add a function nobody calls.
That is deliberate — it makes each provider verifiable on its own against §5.3's
measured figures before the resolver can mask which arm answered.

**Corrected 2026-08-29:** this section used to end *"no commit in this block waits on
anything outside it"*. Three now do. Commit 3 waits on a question about a ledger this
block did not write (§10.2), and commit 6 waits on a URL that exists in no file
(§10.7). The rotation of `API_KEY_AllRatesToday` is **not** one of them: it gates the
deploy, and it left this plan (§10.5).

### 8.3 Commit 5 — audit of the uncommitted file, 2026-08-29

`bancaDItaliaProvider.js` was written and verified against the live source, and no
gate was presented. Read in full against §5.4 and §5.5.

**What matches the contract.** URL, parameters and row shape exactly as §5.5
specifies; the rate from `rates[0].avgRate`; **the walk-back lives here and nowhere
else**; `effectiveDate` read from the payload rather than from the day asked for, so
a Saturday is never recorded as if the market had been open; and a quote whose
`exchangeConventionCode` is not `'C'` is refused rather than inverted on a guess.

**Two things it does that the contract did not spell out, and both are right.** It
returns `null` for an empty day and throws for a transport failure, which is what
makes **only emptiness consume a walk-back step** — walking back against a host that
is not answering would ask a dead server one day earlier. And it honours the
caller's budget rather than its own: `deadlineAt` is checked before every call and
caps that call's timeout at the remaining time, without which five steps would be
five full timeouts and D12's 5s ceiling would be decorative.

**One defect, and it must land before Gate 1 — FIXED 2026-08-30.** The branch is gone
and the function now returns `null` for a `Date`, so an instant is refused at the module
boundary instead of being read in UTC. This matches the architecture-wide rule the debts
audit promoted: a timestamp becomes a calendar day exactly once, on the owner's calendar,
and the frontend's `toCalendarDay` in `helpers/functions.ts` is where that happens. The
original finding, kept for the reasoning: `toCalendarDay` accepts a `Date` and
reads it in UTC. For an owner at UTC−5 a movement at 20:00 resolves to the next day,
so the arm asks for the wrong day **and stamps the wrong provenance**. The comment
defends the UTC read as DST-safety, which is true of the arithmetic *between* days
and false at the entry point. **This is R250's defect class**: a UTC reader that is
correct in most of its call sites precisely because it reads UTC, and wrong in the
ones handed an instant. **The `Date` branch is deleted, not corrected** — D7 already
says the client sends a calendar day, so nothing in the designed flow produces a
`Date`, and the branch only admits the bug.

**Two things to record rather than change.**

- **The walk-back cap has zero margin, and that is measured, not estimated.**
  `MAX_WALK_BACK_STEPS = 5` gives five attempts: the requested day plus four back.
  Over 679 published days the largest gap between two published days is **exactly
  five calendar days**, four times — Easter 2024, 2025, 2026 and Christmas 2025 —
  and Easter Monday hits on the fifth attempt. One more closed day and the arm
  throws. The window of §10.4 removes the cap rather than raising it.
- **The arm returns `source: 'bancaditalia'` and `effectiveDate` separately**, as
  `banrepTrmProvider` does. **Composing `bancaditalia@2026-05-14` is commit 8's job**,
  not the arms'. Write the resolver knowing this or it will be written expecting the
  arms to carry the stamp. It fits: 22 characters in a `VARCHAR(60)`.

**One gate item, and it is not a decision — DONE 2026-08-30.** The file carried two
`// ======` decorative rules, which Gate 3 forbids outright. Its nine neighbours carry
between 1 and 13 each; that is the ambient-defect territory catalogued elsewhere and it
does not authorise one more. **They are out**; the title survives as a single plain
comment line.

---

## 9. Verification

**No test runner exists anywhere** (finding F-15). *Verified* means exercised by hand.

**One check runs before commit 3, not after it.** The derived series replaces a stored
column, and the only moment the two can be compared is while the stored one is still
being written by the old code. On a real-data copy — `fintrack_prod_data`, 785
movements, all of them recorded on the day they happened — **the derived balance must
equal the stored `account_balance_after_tr` row for row, and the last row of each
account must equal that account's `user_accounts.account_balance`.**

That is what makes the change provably a refactor rather than a rewrite: on data with
no back-dating in it, the two methods cannot disagree. **A discrepancy there is a bug
in the derivation, not evidence that back-dating breaks something** — nothing in that
copy is back-dated. Run it before the reads are switched; afterwards the stored column
is `0.00` (§6.2) and the comparison is no longer available.

#### RUN 2026-08-29 — the check FAILED on three accounts. Commit 3 is blocked.

Measured against `fintrack_prod_data`, 785 movements, 100 accounts, with the
derivation `account_starting_amount + running SUM(tr.amount)` ordered
`transaction_actual_date ASC, transaction_id ASC`. **`amount` is stored signed** —
withdrawals negative, deposits positive, account-opening rows zero — so no multiplier
is applied; `balanceMultiplierFn` has no live caller anywhere in `backend/`.

| check | result |
|---|---|
| derived = stored, row for row | **363 of 785 rows differ**, all inside 3 accounts |
| last derived row = `user_accounts.account_balance` | **3 of 100 accounts differ** |
| carried-in as a sum = carried-in as the stored prior row | 7 of 110 month boundaries differ, same 3 accounts |

**97 of the 100 accounts reconcile exactly, every row.** The three that do not are
`slack` (45, all 20 rows), `CDM_NU` (52, 329 of 332 rows) and
`Agua/Bolsa 6.5l/must` (71, 14 of 16 rows).

**In all three the stored column is the broken side, and it is broken by three
different write-time defects — none of them back-dating.**

- **A movement pair was deleted from the ledger without re-striking what followed.**
  Transaction ids 192 and 193 do not exist; 18 ids are missing in total. Account 52's
  stored balance drops from `54.89` to `52.28` across a withdrawal of `0.78` — an
  extra `1.83`, the amount of the deleted pair. The stored column preserves the ghost
  of a movement that is gone; a derivation over the surviving rows cannot, and should
  not.
- **The annulment path writes balances an account's own ledger cannot produce.**
  Account 45 is the `slack` account, it has **no account-opening row at all** —
  violating the rule stated at `getTransactionsForAccountById.js:235` — its
  `account_starting_amount` is `0.00`, and its *first* movement already stores
  `-15242.62`. Worse, each transfer pair is applied twice: rows 213 (`+12475.00`) and
  214 (`-12475.00`) net to zero, yet the stored column falls by `24950.00` across
  them. That figure is not derivable from any data in the database.
- **A cent lost to arithmetic at write time, then inherited forever.** Account 71,
  transaction 284: a deposit of `0.05` onto a stored `1.44` was written as `1.48`.
  Every later row carries the cent, and so does `user_accounts.account_balance`
  (`25.11` where the ledger sums to `25.12`).

**What this means for §6.** The measurement did not falsify the derivation; it proved
the column is already false without any back-dating, which is a stronger form of the
same argument. But it also means **switching the reads is not a pure refactor**: three
accounts will render different balances than they do today — by one cent on 71, and by
tens of thousands on the `slack` account. The derived figure is the correct one in
every case. **The developer decides whether that visible change ships with commit 3 or
is split out**, and whether `user_accounts.account_balance` on those three accounts is
corrected first. Nothing was changed pending that decision.

1. `APP LOADED OK` on boot; from `frontend/`,
   `NODE_OPTIONS=--max-old-space-size=4096 npx tsc -p tsconfig.app.json --noEmit`
   exits 0.
2. **The date lands.** An expense dated three days back shows that date in the
   account detail, not today.
3. **The bounds hold.** A date before the account's opening and a date tomorrow both
   return `422` naming the bound they broke.
4. **Both legs agree.** A transfer dated in the past puts both rows in the same month.
5. **The series is chronological.** With a back-dated row inserted mid-history, the
   per-row balance column moves monotonically with the movements — **no step
   backwards** — and the panel's initial and final balances reconcile with
   `user_accounts.account_balance`.
6. **The month restates.** The budget month of the back-dated expense shows the new
   spend; adjacent months are unchanged.
7. **`updated_at` is now.** Both touched accounts report today, not the movement's
   date.
8. **FX provenance**, against figures verified live. A past-dated `cop` movement on
   `2026-05-14` stores `3794.91` with `exchange_rate_source` reading
   `banrep-trm@2026-05-14`. The same date in `ves` stores `510.15` sourced
   `bancaditalia@2026-05-14`. A `usd` movement stores rate 1 with `identity`. **No
   currency is refused.**
9. **The weekend.** A movement dated Saturday `2026-05-16` stores the rate of
   `2026-05-15` and says so in `exchange_rate_source`.
10. **The reset.** Submitting a movement returns the picker to today; the next
    movement does not inherit the previous date.
11. **Five screens.** On-screen pass at 360, 400 and 768px on all of them — finding T5
    records that they are already not uniform, so one screen is not a pass.
12. **The inclusive bounds.** A movement dated on the account's own opening day is
    **accepted**, including when the account was opened late in the evening — the case
    an instant comparison would refuse (§4.3). A movement dated today is accepted and
    routes to the live orchestrator, not the historical cascade.
13. **The cascade gives up instead of hanging.** With the network cut, a past-dated
    foreign-currency movement returns `422` inside the 5s ceiling and stores nothing —
    in particular, no movement is written carrying today's rate.
14. **The legacy window's opening figure changes, and should.** On Pocket, Debtor and
    Account detail, the panel's initial balance is now the balance carried into the
    window — no longer the account's opening amount, unless the window starts at the
    account's birth, where the two legitimately coincide (§6.1).
15. **The detail view agrees with the list.** `GET /transactions/:id` on the
    back-dated movement reports the same balance the account list shows for that row —
    the fifth read site of §6.1, the one with no series around it to contradict it.
16. `git status` clean of `plan-docs/`.

---

## 10. Still open

**Five decisions, reopened between 2026-08-27 and 2026-08-29.** This section read
*"nothing is open"* until then, which was true on the day it was written and stopped
being true as soon as the first arm was measured against the live sources and the
derived balance was measured against the real-data copy.

**None of them can be closed by a session on its own.** Each states the evidence, the
options and a recommendation; the developer decides.

| # | decision | blocks |
|---|---|---|
| §10.4 | The daily-window query replaces the day-by-day walk-back | commit 5, and through it commit 8 |
| §10.2 | Which of the two `slack` balances is true | commit 3, and through it the five screens |
| §10.3 | Whether the visible balance change on three accounts ships with commit 3 | commit 3 |
| §10.6 | Whether commit 6 stays in V1 at all | commit 6, and the shape of §5.2 step 4 |
| §10.7 | The base URL of the credentialled provider — it exists in no file | commit 6 |

### 10.2 The `slack` ledger — CLOSED 2026-08-29

**The developer settled both the nature of the account and the principle that follows
from it.** `slack` is the system's counterparty account: it absorbs what leaves the
system, what enters it from outside, and it compensates accounts that are deleted.

**The derived figure is the true one, and the reason is structural, not a preference.**
A counterparty account exists by its postings. A stored balance that no movement
supports is not a balance — it is a posting that was never written.

**The developer's framing, which corrects §10.3 as it was written.** Replacing the
stored balances with derived ones is not a cleanup that this plan happens to bundle:
**it is a precondition of back-dating, and without it back-dating produces false
balances from the very first retroactive insert.** A stored running balance is a
snapshot taken in insertion order. Insert a movement whose real date is three months
ago and every snapshot after that date is wrong, because each was computed without it:

```
before:  ... -> movement 8 (stamped 1,200) -> movement 9 (stamped 1,500)
insert:  a -300 movement dated BEFORE movement 8
after:   movements 8 and 9 still read 1,200 and 1,500, and both are now wrong
```

Sustaining the stored column would mean **rewriting the stamp on every later row on
every retroactive insert**. Deriving rewrites nothing: the ledger is summed in real-date
order and the total is right wherever the row was inserted.

**Verification still owed.** The figures of this section — `slack` as account 45 with a
stored balance of −30 522.60 against a ledger of −44.70 — were measured against
`fintrack_prod_data`. The backend's current connection points at `fintrack_dev`, a
different database: 26 accounts, `slack` is account 14, and its stored balance is
−75.97. **The two databases are not comparable by account id**, and the prod figures
must be re-measured on the database the commit will actually run against before
commit 3 lands. The decision above does not depend on that measurement; the acceptance
check does.

### 10.3 The visible change on three accounts — CLOSED 2026-08-29

**This section was written as a scope decision and that framing was wrong.** It asked
whether to ship the visible balance change with commit 3 or to correct the three
accounts first so the commit would land invisibly. Neither branch survives the
developer's correction recorded in §10.2: **computing the balance from the ledger is a
precondition of back-dating, not a cleanup this plan chose to bundle.** There is no
version of this feature in which the stored column keeps being read.

**And there is nothing left to correct.** The two options assumed
`user_accounts.account_balance` would go on being the number the app shows, so a wrong
value in it had to be repaired. It does not: commit 3 stops reading it and §6.2 stops
writing it. The three disagreements are not defects to fix before the switch — they are
the measurement that proves the stored column had drifted, and the switch is what
retires it.

**What actually remains is a disclosure, not a decision.** Three accounts will render a
different figure the day after commit 3 lands — one cent on account 71, a double-counted
annulment on the third, and a large difference on the counterparty account `slack`. The
derived figure is the correct one in every case. The developer has to know which
accounts move and by how much **before** the commit, so that a corrected balance is not
mistaken for a new bug.

**That list has to be re-measured first.** It was taken on `fintrack_prod_data` and the
backend currently connects to `fintrack_dev`, where the same account names carry
different ids and different balances (§10.2). The disclosure is only worth anything on
the database the commit will actually run against.

#### Re-measured on `fintrack_dev`, 2026-08-30 — and it moved a decision, not just a list

Twenty-six live accounts, 115 transactions, every one `complete`. Three candidate
derivations were run against the stored `user_accounts.account_balance`:

| | derivation | reproduces the stored balance |
|---|---|---|
| A | `account_starting_amount + Σ(all rows)` | 19 of 26 |
| B | `Σ(all rows)` — the opening row carries the start | **22 of 26** |
| C | `account_starting_amount + Σ(rows that are not account-opening)` | **22 of 26** |

**The formula §6.1 states is A, and A is wrong.** It double-counts the opening amount on
every account whose account-opening row already carries it — measured on four:
`Picapiedras, Pedro`, `cuenta precargada`, `Palacios, Lucila` and `NewCategory`. On
`Picapiedras, Pedro` the stored balance is `1.30`, A derives `3.10`, and the extra `1.80`
is the opening amount counted twice. **This has to be settled before commit 3 is
written**, because it is the commit's core arithmetic and not a detail of it.

**B and C agree everywhere except one account, and that account is the interesting one.**
They part only on `slack`, which carries **two** account-opening rows — `-15.92` and
`-12.76` — against an `account_starting_amount` of `0.00`. Those two figures are the
*starting amounts of two other accounts*, `cuenta precargada` and `NewCategory`. So the
rows are counterparty legs of other accounts' openings, misfiled as movement type 8.
That is the same shape §9 measured on the other database: `slack` is where openings that
belong elsewhere land.

**SETTLED BY THE DEVELOPER 2026-08-30: C — then AMENDED the same day to C′, because C
is provably wrong.** The developer approved excluding account-opening rows from the sum,
on the evidence below. Building the query exposed that the exclusion has to be **one row,
not one movement type**.

**What C misses.** An account opened with funds writes its opening as a pair of equal and
opposite account-opening legs: a credit on the account being opened, and a debit on the
account that funded it. Only the credit duplicates `account_starting_amount`. The debit
is a real outflow — `banco` lending `1.80` to open the debtor `Picapiedras, Pedro`,
`slack` funding `cuenta precargada` with `15.92`, `cuenta precargada` funding
`Palacios, Lucila` with `0.11`, `slack` funding `NewCategory` with `12.76`, `banco`
funding `Marmol, Pablo` with `15.61`. C drops all five.

**The proof is conservation, not agreement with the stored column.** The ledger is
double-entry, so the derived balances of every account must sum to zero. Measured on
`fintrack_dev` 2026-08-30:

| derivation | sum of every account's derived balance |
|---|---|
| C, exclude every account-opening row | `46.20` — money that no account holds |
| **C′, exclude only the opening row of this account** | **`-0.00`** |

The `46.20` is exactly the five funding legs. C creates money; C′ conserves it to the
cent. Agreement with `user_accounts.account_balance` cannot arbitrate between them —
both tie at 23 of 27 — because that column is itself the thing being retired.

**C′, and this is what commit 3 implements:**

> `account_starting_amount` + Σ(`amount`) over the account's rows strictly up to and
> including the one being priced, **skipping only the row where the movement type is
> account-opening AND `account_id = destination_account_id`**.

That test is true of a credit leg and of a self-funded opening, and false of a funding
leg, which is precisely the distinction. Implemented once, in
`utils/fintrackUtils/accountDataRetrieval/derivedBalance.js`, as a common table
expression every read site joins.

The reasoning that earned the original exclusion follows, and still holds — C′ narrows
it, it does not overturn it.

**Recommendation: C, `account_starting_amount + Σ(non-opening rows)`.** It ties the same
number of accounts as B while keeping the opening amount in the column that is named for
it, so an account with no rows at all still derives its true balance instead of zero, and
a stray movement-type-8 row on a counterparty stops being able to move that
counterparty's balance. B would let exactly the `slack` defect keep propagating.

**The disclosure list on this database is four accounts, not three, and the names are
different.** No derivation reproduces the stored balance on any of them:

| account | stored | last `account_balance_after_tr` | B, `Σ(all)` | C, recommended |
|---|---|---|---|---|
| `slack` (14) | `-75.97` | `-75.97` | `-90.22` | `-61.54` |
| `banco` (15) | `111.96` | `93.47` | `99.95` | `101.75` |
| `inBestMen` (17) | `2.14` | `2.14` | `1.39` | `1.39` |
| `cuenta precargada` (24) | `135.49` | `135.49` | `207.49` | `207.60` |

**`banco` is worse than a drift and should be read first.** Its stored
`account_balance` does not agree with its own last ledger row either — `111.96` against
`93.47` — so the two stored figures the app can show for that account already contradict
each other today, with no back-dating anywhere near it.

**Currency is not part of the gap — checked 2026-08-30.** All four accounts are `usd`
and every one of their 57 rows is denominated in `usd`, so none of the difference is an
unconverted figure. The gaps are drift.

### 10.4 The daily-window query — DECIDED 2026-08-30, now blocked on a re-measurement

**Decision taken 2026-08-30.** The window is adopted as the arm's primary query and the
day-by-day walk-back stays as that same arm's internal fallback, exactly as the
recommendation below reads. It is one call instead of up to five against the same host,
with the same quote convention and no credential; it removes a cap that §8.3 measured as
having zero margin; and it frees about 0.8s of the 5s ceiling. The arm has zero callers,
so nothing that has landed pays for the change.

**What the decision does not unblock, and why.** The query cannot be written today for
two reasons that have nothing to do with the choice:

- **This document never recorded the window endpoint's contract.** The measurement of
  2026-08-29 recorded the *result* — one call, 0.87s, 3,629 bytes for thirty days, the
  last row identical to the walk-back's answer — and not the URL, the parameter names or
  the row shape. §5.5 spells all three out for `dailyRates` and says nothing about the
  window. Writing the query from a guessed endpoint name is the assumption this project
  forbids.
- **The host refuses the TLS handshake from this network today.** Measured 2026-08-30:
  `tassidicambio.bancaditalia.it` cuts the handshake before it completes, on both the
  window endpoint and the `dailyRates` endpoint that answered yesterday, under Node and
  under curl alike. So the contract cannot be re-measured right now either.

**So commit 5 is no longer blocked by a decision; it is blocked by one measurement** —
call the window endpoint once when the host answers, and write its URL, its parameters
and its row shape into §5.5 beside `dailyRates`. Then the query is a transcription.

**Landed in the meantime, 2026-08-30, `fix` to the uncommitted arm.** The two items
§8.3 marked as owed before Gate 1 need no network and are done: the `Date` branch is out
of `toCalendarDay`, which now refuses an instant instead of reading it in UTC and
stamping the wrong day as provenance, and the two decorative comment rules are out.
Verified by loading the module: a `Date` and an impossible day such as `2026-02-31` are
both refused before any request is attempted.

**Measured 2026-08-29.** The same host exposes a second endpoint, the daily series by
window, which returns the requested range with each row's reference date and omits the
closed days. **The last row of a window ending on the requested day is digit for digit
what the walk-back returns after exhausting its steps** — one call instead of up to
five, same host, same quote convention, no credential. Widening the window is free:
thirty days weigh 3,629 bytes and take the same time as asking for one day.

| | day-by-day walk-back (what is written) | daily window |
|---|---|---|
| calls | up to 5 | 1 |
| worst case measured | ~1.71s | 0.87s |
| cap | 5 attempts, **zero margin** | none |

**It also corrects a figure this plan carried.** §5.2's budget cites 210ms for an
empty day and 1.1s for an exhausted walk-back. The 210ms holds only from the second
call onward on an open connection; **the first call to the host costs 0.84–0.87s with
the TLS handshake inside**, so an exhausted walk-back is ~1.71s. The window frees
about 0.8s of the 5s ceiling — which is exactly what a third arm needs in order to run
at all.

**And it removes the cap rather than raising it.** §8.3 records that five attempts is
exactly the largest gap the real market produces.

**Recommendation: adopt the window as the arm's primary query and keep the walk-back
as that same arm's internal fallback.** The arm is written and uncommitted, so the
change costs nothing that has landed.

### 10.5 The credential errand left this plan — 2026-08-29

Rotating `API_KEY_AllRatesToday` **is not a decision of this module**. The developer's
ruling: it is operational security maintenance, mandatory before production
deployment, and mixing it into the functional design of backdating misfiles it. **It
moved to `PLAN_DEPLOYMENT/PLAN_PRODUCTION_MERGE.md` section 4, item 9.**

Commit 6 is no longer gated on the rotation. What gates it is §10.6 and §10.7.

### 10.6 Does commit 6 stay in V1 at all?

**Its justification exists and does not reach.** The arm serves the **window**, not a
date, and that window is today−5 to tomorrow. It covers the frequent case — logging
the expense of two days ago — and there it contributes something measured:
AllRatesToday reads `778.977` from Friday the 21st through Monday the 24th, **carrying
the Friday forward**, while the CDN publishes different figures on the Saturday and
the Sunday for days on which nothing traded.

**Against it:** it is the **only credential in V1** and therefore drags a
deploy-gating rotation into this block; **its base URL exists in no file** (§10.7);
and **it cannot answer the older half of the problem**, which is why the block exists.
Arms 1, 2 and 4 already cover all four currencies across the whole range.

**Recommendation: drop it from V1.** It removes a decision, an errand and a
dependency, and leaves no currency without a source. If independent corroboration in
the recent window is wanted later, it returns as its own unit with its own
justification — not as a commit that exists because the sequence numbered it.

### 10.7 The base URL of the credentialled provider — blocks commit 6

**The plan names the provider's function and its query string and never its host.**
Full sweep of the repository and of `plan-docs/` on 2026-08-29: the only occurrences
are the credential's *name*, in four documents. **No string with the shape of a host.**
It cannot be found by looking again; it has to be asked for.

**Ask it only if §10.6 keeps the arm.** Otherwise the question dissolves with the
commit.

### 10.1 Closed on 2026-08-24 — moved to §3.1

The three that used to block Block A are settled and now live with the rest of the
developer's decisions:

- **No future dates** — the upper bound is today in the owner's zone (**D2**).
- **The client sends a calendar day, the server composes the instant** (**D7**).
- **A past day is anchored at 12:00 in the owner's zone** (**D8**).
- **The cascade's ceiling is 5s, each call's timeout 2s** (**D12**), which replaced a
  20s ceiling built on a premise §5.2 now refutes.

The guard of commit 2 has everything it needs to be written.

### 10.2 The rate cascade — CLOSED 2026-08-29

Both answered by the developer, both confirming the recommendation. Everything else
§5 raises was already decided inside §5 — listed below so none of it is reopened as
if it were pending.

**D10 — one resolution per movement.** *"Una transaccion -> una resolucion FX."* The
question existed because a movement is **two rows**: `transferBetweenAccounts` calls
`recordTransaction` twice, at `:751` for the source leg and `:792` for the
destination leg. A lookup placed inside `recordTransaction` would therefore fire
twice, and two calls to a live service can return two different numbers for one
movement. The resolver is called once in the controller and its result passed to
both legs, exactly as the composed instant of section 4 already is.

**D11 — no preview. The conversion happens on save, on the server.** The developer's
reason supersedes the one this plan carried: a preview is a **second resolution at a
different instant**, so the figure shown and the figure stored can disagree. One
source of truth — *user submits -> server resolves the historical rate -> server
converts -> server persists*. This is not a deferral to V2: a preview that could not
disagree would have to resolve once and let the client carry the rate back, which is
the user-typed override of section 5.8 and its trust problem. The safe preview and
the V2 override are the same feature.

| # | question | recommendation, as written before the answer |
|---|---|---|
| **D10** | one rate lookup per movement, or one per leg? | **one per movement.** A transfer has two legs but one date and one typed currency, so a second lookup asks the same question twice and its only possible contribution is a different answer. The resolver is called once in `transactionController` and its result passed to both `recordTransaction` calls, the same way §4 already passes one composed instant to both |
| **D11** | does a rate that walked back to an earlier day get shown before the movement is saved? | **no in V1.** The record names the day the rate came from (§5.6) and the account detail can render it afterwards. A preview on the form means an FX call fired from a date field while the user is still choosing, and it belongs with the user-typed override in V2 (§5.8) |

**Already decided in §5 — not open:**

- **The timeouts.** 2s per HTTP call, **5s on the whole cascade**, fixed by the
  developer on 2026-08-24 and checked before each new call, aborting to `422` (§5.2).
  A timeout aborts its arm; only an empty answer consumes a walk-back step.
- **No retry and no backoff** (§5.2), because a published historical figure does not
  become available on a second attempt.
- **The one-day offset between Banca d'Italia and the CDN** is accepted and named, not
  reconciled: `exchange_rate_source` records which arm answered and for which date, so
  it stays visible in the record (§5.4).
- **The walk-back is capped at five days** and lives only in the Banca d'Italia arm
  (§5.4, §5.5).
- **AllRatesToday never receives a `date` parameter** (§5.5). This is a usage rule, not
  a preference.
- **Editing the date of an existing movement is out of scope** (§3.3). This block writes
  new movements only.

### 10.3 The errand left this plan — 2026-08-29

Rotating `API_KEY_AllRatesToday` **is not a decision of this module** and is no
longer registered here. The developer's ruling: it is operational security
maintenance, mandatory before production deployment, and mixing it into the
functional design of backdating misfiles it.

**It has moved to `PLAN_DEPLOYMENT/PLAN_PRODUCTION_MERGE.md` section 4, item 9.**

**One consequence, stated so nobody re-reads the old deadline:** commit 6 is no
longer gated on the rotation. Commit 6 may land and run locally with the key as it
stands, because nothing local exposes it. What the rotation gates is the deploy.
Section 8.2 is superseded on this point.

---

## Corrections of 2026-08-30 — measurements only

This file is the archive; `PLAN_BACKDATING.md` is the plan of record and wins wherever the
two disagree. Only assertions that are read as **current state** were touched. Dated
measurements — the live HTTP calls of §5.3, the database counts of §6 and §10.3, the audit
of §8.3 — were left exactly as they were recorded: a measurement stamped with its run is
not stale, it is history.

**No decision was closed, deleted or reworded, and no work unit was reordered.**

| § | what was asserted | what the code says today |
|---|---|---|
| realignment header | three of the fourteen commits have landed | every commit of the block has landed except the credentialled arm, which is out of V1 |
| 8.0 | commit 5, the Banca d'Italia arm, is written, uncommitted, with zero callers | landed `e7dc38a`, and the cascade resolver imports it |
| 8.0 | commits 3, 8 and 10-14 are not written | all landed — `a2bd75a` / `f8cce22` / `f7cae5b` / `17a0714`, `ddadb7d`, `81dbb5c` |
| 8.2 | no frontend file sends `transactionActualDate` | six do. **Marked in place, not struck**: the assertion is load-bearing for the safety rule of this section, so the original stands with the measurement beneath it |

**Left alone deliberately.** §4.2's guard anchors, §2's `transactionController.js:606`
and `:628`, §6.1's five read sites and §5.5's file table are all stale against today's
tree, and they are the raw record this file exists to keep. The corrected anchors are in
`PLAN_BACKDATING.md` §3.2, §3.4, §5.2 and §5.5.
