# PLAN — taking a new FX currency to production

Written 2026-09-05, against `main` at `98b105cb`.

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
this project putting it there is currently blocked by twelve unapplied
migrations that have nothing to do with currencies.

---

## 1. What is already true, measured

| fact | measurement | where |
|---|---|---|
| The yen code is on the production branch | `main`, `feat/vercel-serverless`, `origin/main` and `origin/feat/vercel-serverless` are all `98b105cb` | `git rev-parse`, 2026-09-05 |
| Both Vercel projects deploy from that branch | frontend and backend production branches were pointed at `feat/vercel-serverless` on 2026-08-22 | memory `two-vercel-projects` |
| Production's ledger stops at `018` | 19 rows: files `001`-`018` plus `supabase/001_production_alignment.sql` | `PLAN_SUPABASE_MIGRATION.md` §1, measured 2026-08-27 |
| Files on disk | `001` through `030` | `sql_migrations/` |
| **Therefore pending on production** | **`019` through `030` — twelve files** | derived from the two rows above |

**The consequence that decides this whole plan.** The seventh row is not a
schema observation, it is an operational constraint: the runner is not
selective.

```js
// runMigrations.js:49-58 — every unapplied file, in name order, no filter
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
for (const file of migrationFiles) {
 if (executedMigrations.includes(file)) { continue; }
```

`npm run db:migrate` against production today does not apply the currency
migration. It applies **twelve** migrations, of which the currency one is the
last, and three of the other eleven create tables (`020` pocket tables, `021`
`daily_exchange_rates`, `023` the query-coverage table). Adding a currency is a
one-row change; running it through this door is not.

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

### Route A — run the backlog, then the currency migration

Apply `019` through `030` in one `npm run db:migrate` against production.

- **For it:** ends with the ledger and the disk in agreement, which is where the
 project has to arrive eventually anyway. The currency needs no special
 handling.
- **Against it:** it makes a one-row change into a twelve-file schema
 operation on live data, with its own rehearsal, its own dump, and a blast
 radius that includes three new tables and `028_align_currency_names.sql`
 rewriting the five existing currency names. It also cannot be sized here:
 `019`-`029` belong to the pocket, backdating and budget plans, and each needs
 its own review before it touches production data.

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

**Recommendation: Route B.** The two changes have different risk profiles and
different owners, and binding them means the currency waits for the pocket and
backdating migrations to be reviewed for production. Route A is the right
*eventual* operation and belongs in `PLAN_MIGRATION_CHAIN.md` step 6, where the
ledger-seeding procedure already lives — not in the path of a catalog row.

The precedent already exists: `supabase/001_production_alignment.sql` is exactly
this move at a larger scale, and its step 9 wrote seventeen ledger rows for
migrations it had subsumed.

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

## 5. The procedure, Route B

Every step names what it is for. Steps 1 and 2 are read-only.

### Step 1 — Establish the ledger by name, not by count

Run `plan-docs/on-hold/PLAN_DEPLOYMENT/db_guides/probe_production_state.mjs`
against the live database. It is read-only.

`SELECT filename FROM migrations ORDER BY id` turns the arithmetic argument of
§1 into a list. Two things depend on the answer:

- whether `030` is genuinely absent, which is the premise of everything below;
- whether `013_normalize_category_budget_name_case.sql` is present. It is the
 only pending file that **rewrites existing data**, and if it were missing it
 would have to run before anything else, with its own rehearsal.

**This step also settles a documented three-way disagreement.**
`PLAN_SUPABASE_MIGRATION.md` §1-ter records that three documents describe
production's state differently, and asks whoever runs this probe to correct all
three. Two of them — `plan-docs/NEXT_SESSION.md` §2.1 and
`backend/src/db/docs/db-documented/db-migration-procedure.md` §1 — still say the
alignment file never executed. The third is a tracked file, so correcting it is
a commit.

**Output:** the list of filenames, pasted into this document with its date.

### Step 2 — Establish which commit production is serving

The backend Vercel project's latest production deployment, and its commit. If it
is at or after `a29f2f67` (`feat(currency): add the Japanese yen`), the window
of §2 is open and steps 3-4 are urgent rather than scheduled.

**Do not deploy anything to close it.** Rolling the backend back removes the
yen from `SUPPORTED_CURRENCIES` but leaves the frontend bundle offering it, and
a rollback is a larger change than the `INSERT` that fixes it properly.

### Step 3 — Rehearse against the restored copy

Against `fintrack_prod_data` or a throwaway clone of it, never against
`fintrack_dev`, and never against Supabase:

1. Confirm `currencies` holds five rows and no `currency_id = 6`.
2. Apply the `INSERT` from `030_add_jpy_currency.sql` verbatim.
3. Confirm six rows, and that `currency_name` was not truncated.
4. Apply it a second time. It must be a no-op — the file is written
 `ON CONFLICT (currency_id) DO UPDATE`, and re-running it is a supported case,
 not an accident to avoid.

**The truncation check is not ceremonial.** `027_widen_currency_name.sql` takes
`currency_name` from `VARCHAR(25)` to `VARCHAR(50)` and it is **pending**, so
production's column is still 25. `'Japanese Yen'` is twelve characters and fits.
A future currency whose English name exceeds 25 characters does not, and would
fail here — which is the reason this step measures rather than assumes.

### Step 4 — Apply to production, in one transaction

Two statements, together:

```sql
BEGIN;

INSERT INTO currencies (currency_id, currency_code, currency_name)
VALUES (6, 'jpy', 'Japanese Yen')
ON CONFLICT (currency_id) DO UPDATE SET
 currency_code = EXCLUDED.currency_code,
 currency_name = EXCLUDED.currency_name;

-- Recorded so the runner never applies 030 again once the backlog is cleared.
-- The ledger will name 030 while 019-029 are still absent: that is deliberate
-- and it is what Route B of PLAN_CURRENCY_TO_PRODUCTION.md decided.
INSERT INTO migrations (filename)
VALUES ('030_add_jpy_currency.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
```

The ledger row is not optional. Without it, whoever eventually runs Route A
applies `030` a second time — harmless here because the file is idempotent, and
not harmless as a habit.

**Authorisation.** This is a write against live data and the developer
authorises it in person. No agent session opens a connection to Supabase, and
`.env` is not edited to point anywhere near it.

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

Route A's eventual completion is what makes the next currency cheap. Once the
ledger and the disk agree:

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
