# PLAN — taking a new FX currency to production

Written 2026-09-05, against `main` at `98b105cb`.
**Corrected 2026-09-06**: the first version was built on a superseded reading of
production's ledger and recommended the wrong route. What changed, and why, is
in §1 under "Correction".

Companion to `GUIDE_ADD_FX_CURRENCY.md`. That guide ends where the local
database accepts the currency; this one starts there and ends where production
does. It argues the order and names the failure modes; the steps are executable
as written.

The worked case throughout is the Japanese yen, added locally on 2026-09-05 by
migration `030_add_jpy_currency.sql`. Nothing here is specific to it.

---

## 0. The one-sentence version

A new currency is **one row in a catalog**, and that row is the only thing on
the server that a code deployment cannot carry — so the row goes first, and on
this project it now travels through an ordinary migration run, because the two
files standing between production and the currency are one catalog insert and
two indexes.

---

## 1. What is already true, measured

| fact | measurement | where |
|---|---|---|
| The yen code is on the production branch | `main`, `feat/vercel-serverless`, `origin/main` and `origin/feat/vercel-serverless` are all `98b105cb` | `git rev-parse`, 2026-09-05 |
| Both Vercel projects deploy from that branch | frontend and backend production branches were pointed at `feat/vercel-serverless` on 2026-08-22 | memory `two-vercel-projects` |
| Production's ledger reaches `028` | 29 rows: files `001`-`028` plus `supabase/001_production_alignment.sql` | `NEXT_SESSION.md` §2.1, measured 2026-09-03 on a read-only connection |
| Files on disk | `001` through `030` | `sql_migrations/` |
| **Therefore pending on production** | **`029` and `030` — two files** | derived from the two rows above |

### Correction — what the first version of this plan got wrong

This table originally read "ledger stops at `018`, nineteen rows, twelve files
pending", citing `PLAN_SUPABASE_MIGRATION.md` §1 of 2026-08-27. A later reading
existed and was not checked. `NEXT_SESSION.md` §2.1 records a read-only
connection of 2026-09-03 that applied `019` through `028` and verified each one
individually **against the database**, not against the runner's output — down to
`currency_name` accepting fifty characters (`027`) and the five currency names
being English (`028`). It supersedes the August figure.

Everything the first version derived from the old number is therefore wrong: the
recommendation of an out-of-band apply, and the caveat that production's
`currency_name` is still `VARCHAR(25)`. Both are corrected below.

**What survives the correction**, because it does not depend on the count: the
runner is not selective.

```js
// runMigrations.js — every unapplied file, in name order, no filter
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
for (const file of migrationFiles) {
 if (executedMigrations.includes(file)) { continue; }
```

That property was the whole argument against a plain migrate run while twelve
files were pending, three of them creating tables. With two files pending — two
indexes and one catalog row — the same property is now an argument *for* it: the
runner does exactly what is wanted and nothing else.

### The defect this correction uncovered, and why it had to be fixed first

Rehearsing `029` revealed that it was a no-op reporting success. Its DOWN block
was live SQL rather than commented out, unlike every other file on the chain,
and since the runner reads the whole file and executes it as one statement, the
two `DROP INDEX` lines undid the `CREATE INDEX` lines inside the same
transaction. The run printed a checkmark and wrote the ledger row anyway.

Measured on a database built from empty through the full chain: the ledger row
for `029` present, zero of its two indexes created. Nobody saw it locally
because `createTables.js:536` and `:539` create those same two indexes on every
boot, so the runtime path masked it. Production does not run that path.

Fixed inside `029` itself, per the rule that a correction is edited into the
original migration and never added as a repairing one. Re-rehearsed from empty:
both indexes present.

---

## 2. The failure window, and whether it is already open

**No self-healing exists in production.** `backend/src/index.js:56-58`:

```js
// VERCEL automatically assigns VERCEL variable to '1' when executing inside its environment
if (!process.env.VERCEL) {
 startServer();
}
```

`startServer()` is the only caller of `initializeDatabase()`, so the boot path —
`createTables.js` and `populateDB.js` — **never runs on Vercel**. Locally,
`tblCurrencies` in `populateDB.js` would have healed a missing row on the next
restart, because its seeded-check compares against `currenciesValues.length` and
six rows are now expected where five exist. In production that mechanism is not
merely disabled, it is absent.

**What a user hits if the code is deployed and the row is not there.**
`getCurrencyId` degrades from the in-memory catalog to a query, finds nothing,
and throws (`currencyLookup.js:34-36`):

```js
if (result.rows.length === 0) {
 throw new Error(`Currency code not found: ${currencyCode}`);
}
```

That is a **500**, not a validated rejection. The request already passed
`SUPPORTED_CURRENCIES` in the zod refinement, so the currency is offered in
every dropdown, accepted by the API, and fails at the write. Every creation path
that stamps FX metadata is affected: transactions, accounts, categories, pockets
and budget allocations.

**Open question, and the first thing to measure.** The code is on the branch
both Vercel projects track. If either project has auto-deployed since
`a29f2f67`, **production is in that window right now**. Check the backend
project's latest production deployment commit before anything else; the answer
changes this plan from *scheduled* to *incident*.

---

## 3. The two routes, and the recommendation

Both routes are kept, with the arguments each was written under, because the
choice turned entirely on how far behind production was and a future currency
may meet a different backlog.

### Route A — run the pending files, currency migration included

Apply everything pending in one `npm run db:migrate` against production. As of
2026-09-06 that is `029` and `030`.

- **For it:** ends with the ledger and the disk in agreement, which is where the
 project has to arrive eventually anyway. The currency needs no special
 handling, and no row is written by hand.
- **Against it, when the backlog is long:** it turns a one-row change into a
 multi-file schema operation on live data, with its own rehearsal, its own dump,
 and a blast radius that included three new tables and
 `028_align_currency_names.sql` rewriting the five existing currency names. It
 also could not be sized in this document, because those files belong to the
 pocket, backdating and budget plans and each needs its own review.
- **Against it today:** nothing. The files that carried that argument were
 applied on 2026-09-03 and reviewed there. What remains is two indexes and a
 catalog row.

### Route B — apply the currency migration alone, out of band, and record it

Run `030`'s `INSERT` against production by itself, then insert its filename into
the ledger so the runner never repeats it. `019` through `029` stay pending and
are dealt with on their own schedule.

- **For it:** the change is one idempotent `INSERT ... ON CONFLICT DO UPDATE`
 on a catalog table with no dependents yet. It is the smallest operation that
 closes the failure window, and it is separable from a backlog that has nothing
 to do with currencies.
- **Against it:** it deepens the divergence between the ledger and the disk —
 the ledger would name `030` while `019`-`029` are absent, which is a shape the
 runner tolerates but a reader will not expect. It needs a comment in the
 ledger's story, which §5 provides.

**Recommendation: Route A — corrected 2026-09-06.**

The first version recommended Route B, on the premise that Route A meant twelve
files on live data. With the ledger at `028`, Route A means two files:
`029_pocket_board_month_indexes.sql`, which creates two indexes and touches no
row, and `030_add_jpy_currency.sql`, which is one idempotent
`INSERT ... ON CONFLICT DO UPDATE` on a catalog table. Neither reads or writes
user data. The backlog that made Route B worth its cost no longer exists.

Route B is now the worse option for the reason it was always weakest: it writes
a ledger row by hand and leaves the disk and the ledger describing different
things, in exchange for skipping a single index migration that carries no risk.
The precedent it leaned on — `supabase/001_production_alignment.sql`, whose step
9 wrote seventeen ledger rows for migrations it had subsumed — is a procedure for
a database the chain never built, not for one that is two files behind.

**Route A also has to be the choice for a second reason.** `029` and `030` are
adjacent on the chain, and the runner applies everything unapplied in name
order. There is no supported way to take `030` and leave `029`; Route B would
have to write `029`'s ledger row too, claiming an effect that was never applied
— and after the defect described in §1, an unapplied `029` with a ledger row is
precisely the state that had to be repaired.

---

## 4. Ordering — the rule that does not change with the route

**The row lands before the code that names it.** Both directions of the mistake
are asymmetric:

| order | result |
|---|---|
| row first, code second | between the two, production holds a currency nothing offers. Invisible: no list reads the table to build a dropdown. |
| code first, row second | between the two, production offers a currency that 500s on every write. Visible to any user who picks it. |

The second is where the project may already be, per §2. The rule is therefore
not "deploy carefully next time" — it is **measure now**.

---

## 5. The procedure, Route A

Every step names what it is for. Steps 1 and 2 are read-only.

### Step 1 — Establish the ledger by name, not by count

Run `plan-docs/on-hold/PLAN_DEPLOYMENT/db_guides/probe_production_state.mjs`
against the live database. It is read-only.

`SELECT filename FROM migrations ORDER BY id` turns the arithmetic argument of
§1 into a list. It confirms rather than discovers — §1 already records the
2026-09-03 reading — and three things depend on it:

- that the ledger names `001` through `028` and the alignment file, and neither
 `029` nor `030`;
- that `013_normalize_category_budget_name_case.sql` is present. It is the only
 file on the chain that **rewrites existing data**, and it sits well below the
 last applied row, so its absence would mean the ledger cannot be trusted at all;
- that `029` is absent. If it were present without its two indexes, production
 would already be carrying the defect described in §1, and the repair is to
 delete that ledger row before the run — not to add a migration.

**Correcting the record is part of this step.** `PLAN_SUPABASE_MIGRATION.md`
§1-ter records that several documents describe production's state differently
and asks whoever reads the live ledger to correct all of them. As of 2026-09-06
`plan-docs/NEXT_SESSION.md` §2.1 is the current one and names the three that
still lag: `db-migration-procedure.md` §1, `PLAN_MIGRATION_CHAIN.md` §4 paso 0,
and `HANDOFF_AGENTES.md` §F. All three are tracked, so correcting them is a
commit.

**Output:** the list of filenames, pasted into this document with its date.

### Step 2 — Establish which commit production is serving

The backend Vercel project's latest production deployment, and its commit. If it
is at or after `a29f2f67` (`feat(currency): add the Japanese yen`), the window
of §2 is open and steps 3-4 are urgent rather than scheduled.

**Do not deploy anything to close it.** Rolling the backend back removes the
yen from `SUPPORTED_CURRENCIES` but leaves the frontend bundle offering it, and
a rollback is a larger change than the `INSERT` that fixes it properly.

### Step 3 — Rehearse with the runner, not with the statement

**Done 2026-09-06. Result below.** The rehearsal drives the same tool that will
run against production, because under Route A the operation *is* a runner
invocation — rehearsing the bare `INSERT` would test a statement nobody is
going to type.

`fintrack_prod_data` cannot be the target and this was measured, not assumed. It
holds five currencies under the pre-alignment names (`Pesos col`, `Bs`,
`Pesos mxn`), an **empty** migrations ledger, and `currency_name` still at
`VARCHAR(25)` — the control copy restored from the 2026-08-21 dump, eleven
migrations behind live production. Pointing the runner at a clone of it fails at
`002_accounts.sql`: that file creates `users` with a `timezone` column and a
trigger over it, `CREATE TABLE IF NOT EXISTS` skips the table that already
exists, and the trigger then has no column to watch. **The chain is replayable
from empty, not over an existing database.**

What was done instead, and what it proves:

1. A throwaway database `fintrack_rehearsal`, created empty.
2. `npm run db:migrate` against it with the target override, applying `001`
 through `030` — so `029` and `030` land on a schema at exactly `028`, which is
 the operation production will perform.
3. The same command a second time. It applied nothing, which is what makes a
 repeat run safe.
4. Read back: six currencies including `6 jpy Japanese Yen`, `currency_name` at
 width 50, both indexes of `029` present, 30 ledger rows.

Step 3 as originally written — apply the bare `INSERT`, confirm six rows, apply
it again — also passed, and its truncation caveat is now void: it warned that
production's `currency_name` was still `VARCHAR(25)` because `027` was pending.
`027` was applied on 2026-09-03 and the column is 50. The check itself stays
worth doing for a currency whose English name is long.

**What this rehearsal does not cover.** Neither pending file reads or writes user
data — `029` is two `CREATE INDEX`, `030` is one catalog upsert — so an empty
database exercises them fully. What it cannot measure is index build time on
production's real `pockets` and `pocket_allocations`. Both are small tables and
the runner holds a transaction while it builds, so the lock is brief; a faithful
timing would need a current production dump, which is the developer's to take.

### Step 4 — Apply to production with the runner

One command, pointed at production, applying `029` and then `030`. Each file
gets its own transaction, and each ledger row commits with the change it records
— so a failure in either leaves the other's row untouched and the run is simply
repeated.

Nothing is written by hand. Route B's manual ledger row is gone with it, and
with it the reason it was ever needed.

**Before the run:** a backup of production taken immediately beforehand, per
`db-migration-procedure.md` §5. **After the run:** re-read the ledger and expect
31 rows ending in `030_add_jpy_currency.sql`, six currency rows, and both indexes
of `029` present — that last one specifically, because a ledger row for `029`
without its indexes is exactly the state the defect in §1 produced.

**Authorisation.** This is a write against live data and the developer
authorises it in person and runs it. No agent session opens a connection to
Supabase, and `.env` is not edited to point anywhere near it.

### Step 5 — Deploy the code, or confirm it is already deployed

Nothing to do if step 2 found production already serving `98b105cb` or later.
Otherwise, a deploy of the branch both projects track.

**No restart step exists and none is needed.** `loadCurrencyCatalog()` is
awaited at module scope in `backend/src/app.js:66`, so every cold start of every
lambda re-reads `currencies`. A deployment replaces the instances; the catalog
follows. The guide's step 4 — "restart the backend" — is a local instruction and
does not translate.

### Step 6 — The acceptance test, in production, not locally

**A rate arriving locally does not predict production.** The yen's local
acceptance test was answered by `githubFallbackProvider`, the fifth arm, because
the three keyed aggregators above it declined for want of an API key in the
development environment. Production has those keys. A different arm will answer,
with a different figure and a different `source` string.

Confirm, against the deployed API:

1. `POST /api/fintrack/currency/convert` with `from: 'jpy'` returns a rate, and
 record which `source` answered.
2. A back-dated conversion in the new currency — see §6, this is where it fails
 today.
3. One real write in the new currency: create a transaction and confirm
 `original_currency_id = 6` and a non-identity `exchange_rate_source`.

---

## 6. Two things production does not get, and both are code

Neither blocks the row. Both belong on the deploy that follows it.

**The historical arm is missing for any new currency.**
`bancaDItaliaProvider.js:113` carries its own four-entry list —
`['cop', 'eur', 'mxn', 'ves']` — and guards both entry points on it, so a
back-dated conversion in a new currency skips the universal arm and the
business-day oracle and lands on the CDN of last resort. Banca d'Italia does
publish the yen. `GUIDE_ADD_FX_CURRENCY.md:123-129` says to leave that list
alone *"unless that provider actually covers the new currency"* — the condition
is met and was not exercised. The convention check at `:203` refuses anything
but a per-USD quote rather than inverting on a guess, so the change is bounded.

**The store is never warmed in production.** `warmRecentRates()` has exactly one
caller, `index.js:43`, inside `startServer()` — which §2 established never runs
on Vercel. So `daily_exchange_rates` fills only on demand, for every currency,
and a new one starts from nothing. This is not a currency defect and it is not
fixed by this plan; it is named here because the acceptance test in §5 step 6.2
is the first thing that will notice it.

---

## 7. Rollback

**The row.** `030`'s own DOWN block carries the warning and it is the operative
one: the foreign keys pointing at `currencies` are **not uniform**. Every money
table restricts, and fails loudly, which is correct. But `users.currency_id` is
`ON DELETE SET NULL` — it silently blanks the accounting currency of every user
who adopted the currency. Measure before removing:

```sql
SELECT user_id FROM users WHERE currency_id = 6;
```

A non-empty result means do not delete the row. Remove it from
`SUPPORTED_CURRENCIES` instead and deploy: the currency stops being offered and
stops being accepted, existing rows keep resolving, and nothing is blanked.

**The code.** A backend deploy of the previous commit removes the currency from
the accepted set. Do not do this while the row is absent — that is the §4
ordering mistake in reverse and it produces the same 500.

---

## 8. Steady state — what this costs once the chain is aligned

Route A's completion is what makes the next currency cheap, and after the run of
§5 step 4 the ledger and the disk agree. From then on:

1. Run the guide's script locally, review the seven edits, commit.
2. Merge to the production branch.
3. `npm run db:migrate` against production — **one** file.
4. Deploy.
5. Acceptance test in production.

Steps 3 and 4 are in that order for the reason in §4, and that ordering is the
only part of this document that survives the chain being fixed.

---

## 9. What this plan does not do

- It does not apply `019` through `029` to production, or size that work.
- It does not change `ACCOUNTING_CURRENCY_CODE` or
 `VITE_ACCOUNTING_CURRENCY_CODE`. Adding a currency the app can *hold* is a
 catalog row; changing the currency the app *accounts in* re-denominates every
 stored amount and is a different plan entirely.
- It does not touch `.env`, which three sessions share and which must never
 point at `fintrack_prod_data` or at Supabase.
- It executes nothing against Supabase. Every step above that writes is
 authorised and run by the developer.
