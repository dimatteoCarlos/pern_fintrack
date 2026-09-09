# Database Migration Procedure

How a schema change travels from a local file to the production database.

Companion documents: `db-lifecycle.md` (what migrations, seeds and resets are),
`db-bootstrap.md` (the boot path), `db-setup.md` (first local setup).

---

## 1. The two kinds of migration file

### The chain — `src/db/migrations/sql_migrations/`

Numbered files with no gap, `001` upward. They build a database **from zero**,
in order: `002_accounts.sql` creates the tables that
`014_category_budget_fx_columns.sql` later alters. A file assumes every
lower-numbered file already ran.

**From zero, and only from zero.** Pointing the runner at an existing database
with an empty ledger does not replay the chain over it: measured 2026-09-06
against a clone of `fintrack_prod_data`, the run fails at `002_accounts.sql`,
because its `CREATE TABLE IF NOT EXISTS users` skips the table that is already
there and the IANA trigger it then declares has no `timezone` column to watch.
That is what `supabase/001_production_alignment.sql` exists for.

List the directory for the highest number. This paragraph used to carry the
count and it was wrong five times, most recently within a day of being
corrected, so it no longer carries one.

**Listing `main` is not enough on its own, and asking is.** A number can be
claimed on a branch hours before it reaches `main`, and a listing of `main`
during that window hands the same number to two authors. `037` spent
2026-09-08 in exactly that state, written on `feat/deletion` and invisible to
`main` until it merged the same day. Ask on the shared channel before claiming
one.

This is the only kind that is written from now on.

### The one-shot — `src/db/migrations/supabase/`

`001_production_alignment.sql`, written 2026-08-21 and rehearsed 2026-08-26.

**It ran. Settled 2026-09-03, recorded here 2026-09-06.** This document used to
say "not yet executed" and then, less wrongly, that the question was disputed.
Neither stands: `plan-docs/NEXT_SESSION.md` §2.1 records a read-only connection
to production on 2026-09-03 that read the ledger and found **29 rows** — the
twenty-eight numbered files of the day plus `001_production_alignment.sql`. The
two sources that already pointed that way agree with it:

- the header of `sql_migrations/018_alter_transactions_account_fks_to_restrict.sql`
  states that the alignment file **ran on Supabase on 2026-08-22** and that its
  name is in the ledger, so the runner will never execute it again;
- the same header records the three transaction foreign keys as **measured on
  production 2026-08-27**, which is a reading of the live database and not of a
  dump.

**Production is at `030` since 2026-09-06.** The run of that day applied the two
files that were pending, `029_pocket_board_month_indexes.sql` and
`030_add_jpy_currency.sql`, leaving the ledger at **31 rows**. Verified against
the database rather than against the runner's output: six currencies including
the yen, and both of `029`'s indexes present — that second reading is the one
that matters, because the version of `029` in circulation until that morning
wrote its ledger row while creating nothing. The full account is in
`plan-docs/ongoing/PLAN_CURRENCY_TO_PRODUCTION.md` §10.

**That question is closed. Measured 2026-09-06: the column exists.** It was open
because the alignment file's step 1 adds `timezone` with `ADD COLUMN IF NOT
EXISTS`, while `002_accounts.sql:39` declares it inside `CREATE TABLE users` —
which reaches a database built from zero and no other. Production's `users`
predates the chain, so the alignment file was the only path by which it could
have arrived, and every login query selects it. The read taken immediately before
the 2026-09-06 production run found it present, which confirms the alignment file
did what its ledger row claims rather than merely being recorded.

It exists because production was created before migrations `007` to `017` were
written. It held the owner's data but not the structure those files add, and the
chain could not be run over it: every `CREATE TABLE IF NOT EXISTS` would skip the
tables that already existed without adding a single column, and the runner would
write 17 ledger rows declaring success over an incomplete database.

The file reproduces the **effect** the chain would have had, guarded step by
step, and writes the ledger rows itself. It carries its own `BEGIN`/`COMMIT`
because `runMigrations.js` is not what executes it.

**The state this file was written to correct**, read from the dump taken
2026-08-21 at 23:04: 110 columns across 17 tables, no
`budget_monthly_allocations`, and an empty ledger. A deployment cannot move it,
and that part is not in dispute: a `CREATE TABLE IF NOT EXISTS` over a table
that already exists is a no-op, so only the `ALTER TABLE`s in this file reach a
populated database. That is also why the chain migration `018` exists as an
`ALTER` rather than as a rule declared inside a `CREATE TABLE`.

**It runs once, by hand, and only then is it history.** The rehearsal of
2026-08-26 against a restored copy says it runs clean. If the reading recorded
in the `018` header is right, that run already happened on 2026-08-22 and
production and local already share the same chain; section 5 then describes what
was done rather than what remains. Confirm before treating it as either.

### The boot path is not a third kind, and it never reaches production

`run_time_db_init/createTables.js` holds an `ensure*()` function for most of
what the chain does, and this document is full of them because a migration
without its boot-path counterpart leaves a preexisting local database behind.
None of that is a production mechanism. **Every `ensure*()` function is a
local-development and attended-run device.**

The reason is one guard. `src/index.js` calls `startServer()` — the only caller
that reaches `initializeDatabase()` on a boot — inside
`if (!process.env.VERCEL)`, and Vercel sets that variable in its own
environment. The deployed entry point is `backend/index.js`, which imports
`./src/app.js` and exports a handler, and never imports `src/index.js` at all.
So the deployed backend calls no initializer, and no `ensure*()` has ever run
against production.

**The consequence is the reason this document exists.** Production receives a
schema change through the migration chain and through nothing else. A deploy
self-heals nothing, so every outstanding migration needs an attended run before
a backend that depends on it is deployed — which is section 5.C stated from the
other end.

It is kept this way deliberately, ruled 2026-09-07: wiring the initializer into
the serverless handler would run DDL on the path of a user request, let
concurrent cold starts contend for `ACCESS EXCLUSIVE` locks, and — decisively —
its first-time branch would build the whole schema from JavaScript against
production with no ledger, no ordering and no `DOWN`.

**One run applies every pending file, not one run per file.** `db:migrate`
takes all of them in a single invocation inside one transaction, so the number
of files pending and the number of runs needed are different questions with
different answers.

---

## 2. How the runner works

`npm run db:migrate` → `src/db/migrations/runMigrations.js`.

- Reads `src/db/migrations/sql_migrations`, filters `.sql`, sorts by filename
 (line 53-55). Ordering is lexical, which is why the numeric prefix is padded.
- Reads the `migrations` table and skips every filename already there (line 47).
- Wraps **the whole run** in one transaction — `BEGIN` at line 35, `COMMIT` at
 line 78. Not one transaction per file. If the fourth pending file fails, the
 three before it roll back with it.
- Writes one row per file into `migrations` as it goes (line 71).
- **Refuses to run against a database nobody named.** Before the ledger table is
 created, and therefore before anything is written, `assertExpectedDatabase` asks
 the open connection what it reached with `current_database()` and stops unless
 `DB_EXPECTED` names it. An absent `DB_EXPECTED` is also a refusal; the refusal
 prints the database it reached, so naming it takes one step. `NODE_ENV` is
 checked too, as a separate refusal, but it is the weaker of the two: it cannot
 decide the destination, because `dbEnvironmentConfig.js` declares `development`
 and `production` with identical bodies that both read `DATABASE_URI`.
- **Refuses a destination that is not this machine.** `DB_EXPECTED` confirms a
 name the operator types, and a remote database can carry any name, so
 `assertExpectedDatabase` also reads `inet_server_addr()` and stops unless the
 answer is loopback or a Unix socket. `DB_REMOTE_OK=1` is the way through, and
 the run announces the off-machine destination when it is set. An allowlist of
 addresses rather than a denylist of names: `schemaParity.js` tests the
 connection string against `/prod|supabase/i`, which matches a spelling and not
 a database.
- **The single transaction is not as single as it looks.** Migrations `001`-`007`
 carry their own `BEGIN`/`COMMIT`, which closes the runner's transaction early,
 so a failure in file N+1 leaves N already committed. Recorded in
 `PLAN_MIGRATION_CHAIN_031_035.md`.

Consequences to keep in mind:

- A migration file must **not** carry its own `BEGIN`/`COMMIT`. The runner owns
 the transaction. The one-shot in `supabase/` is the documented exception.
- The `migrations` table is the source of truth, not the file listing. A file
 whose row exists is never executed again, whatever it contains.

---

## 3. Writing a new migration

1. Name it `NNN_what_it_does.sql`, continuing the sequence.
2. Open with a header stating **why the change is needed**, not what the SQL
 says. If the order relative to another file matters, say so explicitly.
3. Write the `UP` section. No `BEGIN`, no `COMMIT`.
4. Write the `DOWN` section, commented out, as a true inverse. State what the
 inverse cannot recover — a lowercased name, a dropped origin currency — and
 what to export before running it.
5. Make every statement idempotent: `IF NOT EXISTS`, `WHERE col IS NULL`,
 `ON CONFLICT DO NOTHING`. A migration that cannot tolerate a second run is a
 buried mine.

### Idempotency has a trap

`ON CONFLICT DO NOTHING` is **not** a valid guard for an `INSERT` whose omitted
columns are `NOT NULL`. PostgreSQL checks `NOT NULL` when the row is formed,
before it probes the unique index that `ON CONFLICT` reads, so the row dies
before the guard can discard it.

Use `WHERE NOT EXISTS (...)` in the `SELECT` instead: it discards the candidate
before any row is built. Keep `ON CONFLICT` as the guard on the unique
constraint itself. This is exactly the defect found in step 6 of the alignment
file and fixed there.

### `NOT NULL` without a default breaks the deployed code

`ALTER COLUMN x SET NOT NULL` on a column the running backend does not write
turns every `INSERT` from that backend into an error, immediately, on a database
that until that moment was fine.

Two columns are always in this position: `original_currency_id` and
`exchange_rate_target_currency_id`. They deliberately take no default — there is
no honest default for "which currency did the user actually type".

So: **the code that writes the new columns must be deployed in the same window
as the migration that requires them.** Schema first, then code, with nobody
creating records in between; or relax the `NOT NULL`, deploy, and restore it.

### A data step that calls a transaction writer is not a chain file

`runMigrations.js:97` filters the directory with `.endsWith('.sql')`, so the
chain executes SQL and nothing else. A data change that a SQL file cannot
express is therefore a script run by hand, and that changes what it depends on.

Four writers read the in-memory currency catalog before they write a row:
`recordTransaction.js:25`, `recordAnnulmentTransaction.js:127`,
`recordClosureSettlement.js:153` and `recordBalanceReversal.js:135`. Each calls
`getCurrencyIdSync` above its own `try`, so an unloaded catalog throws before
any statement is issued. Under HTTP that never happens: `app.js:66` awaits
`loadCurrencyCatalog()` at boot and every request inherits it. A script started
with `node scripts/...` never runs `app.js` and inherits nothing.

**The failure lands at the worst moment for a migration.** The DDL has already
applied and committed, and the data step that was supposed to follow it dies on
its first call. Found 2026-09-08 by the deletion session, when
`backend/scripts/verifyClose.js` ran for the first time and died exactly there.
The three older verifiers already load it — `verifyCloseAccount.js:173`,
`verifyCloseTransfer.js:180` and `verifyClosureSettlement.js:124`, the last with
the comment explaining why.

So a hand-run data step calls `loadCurrencyCatalog()` before it writes, or it
writes through SQL and avoids the dependency entirely. Pure SQL migrations are
unaffected and this section does not apply to them.

**The `catch` around that load is deliberate and must not be turned into an
exit.** `src/index.js:12` imports `app.js`, whose top-level
`await loadCurrencyCatalog()` therefore runs during module evaluation, before
`startServer()` reaches `initializeDatabase()`. On an empty database it queries
a `currencies` table that nothing has created yet, so it throws by design, and
the `catch` at `app.js:67` is what lets the boot continue to the step that
creates and seeds it. Making it exit would stop a new database booting at all.
Measured and argued by the deletion session on 2026-09-08, correcting an earlier
version of this paragraph that called the `catch` a defect and said the server
would then be unable to write a transaction. Both were wrong: the `catch` is
load-bearing, and `fxDBaccess.js` reloads the catalog on the first FX operation,
so a process that boots without one usually repairs itself.

**The defect is one file over, and it is why this section exists at all.**
`utils/currencyLookup.js` says in its own second line that it provides "catalog
fallback", and `getCurrencyId` at `:17` is that fallback — catalog first through
`isCurrencyCatalogLoaded()`, then a query on the client it is handed, never
throwing for an absent catalog. The same file then re-exports `getCurrencyIdSync`
unchanged at its end, and that is the one all four writers import. So the writers
reach past the fallback that was written for them.

**If the writers move to `getCurrencyId(dbClient, ACCOUNTING_CURRENCY_CODE)`,
this whole section stops applying** — a hand-run data step would need to load
nothing, and it would work on a fresh database where no catalog can exist.
Proposed by the deletion session and put to Carlos on 2026-09-08, undecided as
of this writing, deliberately not half-applied: three of the four writers are
that module's and `recordTransaction.js` is on every ordinary transaction path
and belongs to none. Delete this section when the four move.

---

## 4. Applying to a local database

```bash
DB_EXPECTED=fintrack_dev npm run db:migrate
```

Reads `DATABASE_URI` from `backend/.env`. To point at a different local
database, override `DB_NAME`; see `dbMigrationConfig.js`.

`DB_EXPECTED` is not the target and does not change it. It is the name you
believe the run will reach, checked against what the connection actually
reports, and the run stops if the two differ. Running without it prints the
database it reached and refuses, which is the supported way to find out where
`DATABASE_URI` points without opening `.env`.

To read what a database already has, without writing anything:

```bash
DB_EXPECTED=fintrack_dev npm run db:state
```

It prints the ledger and the objects the last five migrations create. Two
`SELECT`s and no writes.

Never point `npm run db:reset` at a database you care about: it terminates the
connections and drops it. Since 2026-09-08 it carries the same interlock as the
rest, and confirms through a connection to the database it is about to drop
rather than through the admin connection to `postgres`, so the name it checks is
the one being destroyed:

```
DB_EXPECTED=fintrack_dev npm run db:reset
```

---

## 5. Applying to production

Production is Supabase. The connection string lives in `backend/.env` as
`DATABASE_URI_SUPABASE`, commented out on purpose, and in the Vercel project as
`DATABASE_URI`.

### 5.Z The suspension is lifted, 2026-09-08

Carlos suspended production migrations until the process was defined. The
process is this section, and he lifted the suspension on 2026-09-08. What that
changes is permission, not method: every condition in 5.B still binds, and the
runner is still a person at a terminal.

**The lift is permission for the process, not for any given run.** Stated by
Carlos on 2026-09-08, immediately after lifting it: each production migration
is authorized by him individually. So there is no state in which a run is
already approved because the suspension is gone — the approval is per run, and
it is condition 4 in 5.B.

**It required no code change.** The `NODE_ENV=production` refusal in `db:align`
and `db:migrate` was never the suspension — see 5.4 — and it stays.

**The open question about `013` does not gate the run.** Whether
`013_normalize_category_budget_name_case.sql` ran against production on
2026-08-27 is still unknown, and it was treated as a precondition because the
chain applies it first. Measured on 2026-09-08 against a copy of
`fintrack_prod_rehearsal_full`, where 013 had already run: with its ledger row
deleted so the runner would apply it again, a second run left the account count,
the `account_name_case_backup_013` row count and the `md5` fingerprints of both
`user_accounts.account_name` and `category_budget_accounts`
`category_name`/`subcategory` byte-identical.

The file is idempotent by construction and the measurement agrees with the
reading: the table is `CREATE TABLE IF NOT EXISTS`, the backup insert carries
`ON CONFLICT (account_id) DO NOTHING` over a `SELECT` already filtered to
un-normalized rows, and both `UPDATE`s are guarded by
`WHERE x <> LOWER(TRIM(x))`. So the answer is still worth having — it belongs in
the before-reading of 5.6 — but not knowing it costs nothing.

### 5.A Who runs it, decided 2026-09-08

**A person at a terminal, running the repository's own scripts.** Decided by
Carlos on 2026-09-08 after the three candidates were weighed. It is not the
permanent answer; it is the right answer for the pending set of 5.4, which
introduce a table every reader of `account_registry` depends on and have never
executed against production.

Why not a step in the Vercel build. `backend/vercel.json` uses the legacy
`builds` format with `@vercel/node` on `index.js` and declares no
`buildCommand`, so the step does not exist and would have to be added. That is
the smaller objection. The larger one is that a build runs on **every**
deployment, on every retry, and on preview deployments, while `db:align` must
run **exactly once** — a second run undoes three of migration 035's seven
repoints and says nothing. Automating it would also start by lifting
`db:migrate`'s own refusal under `NODE_ENV=production`, which is the freeze
itself.

Why not Supabase's migration tooling. The repository has never used it: there is
no `supabase/` directory at the root and no `config.toml`. The one path carrying
that name, `src/db/migrations/supabase/001_production_alignment.sql`, is a loose
file and not a CLI layout. Adopting it means re-expressing thirty-five
migrations plus the alignment in another format and living with two ledgers.

**The evolution, when the chain is at parity and each deploy carries at most one
small file: not the build step but a manually dispatched GitHub Action** — the
same person deciding, with the record kept for free. It is not proposed yet
because it puts production credentials into CI secrets, which is a new exposure
and a separate decision.

### 5.B The five conditions the decision carries

The manual run as it was performed on 2026-08-22 is not good enough on its own:
it left `align.log` at the repository root and a ledger row typed by hand under
a name no runner produces. The first three conditions are what make the manual
run auditable, the fourth is what makes it authorized, and the fifth is what
decides whether the moment has arrived at all.

1. **Through `db:align` and `db:migrate`, never through `psql`.** The runner
 writes the ledger row inside the same transaction as the schema it names. A
 file applied with `psql` does not register itself, which is how
 `supabase/001_production_alignment.sql` came to be recorded by hand.
2. **With `DB_EXPECTED` and `DB_REMOTE_OK` typed explicitly.** Two deliberate
 assertions rather than one: which database, and that the destination leaves
 this machine. `assertExpectedDatabase` refuses without either.
3. **With `db:state` captured before and after, into the repository.** That is
 the record. A `.log` at the repository root is not one.
4. **With Carlos's authorization for that specific run.** Stated by him on
 2026-09-08 when he lifted the suspension. It is not carried by the lift, not by
 a previous run having been approved, and not by a peer session relaying that it
 was: the authorization is per run and comes from Carlos directly. Nothing in
 the code enforces this one — `DB_EXPECTED` and `DB_REMOTE_OK` assert which
 database, not who agreed to it — so it is enforced by the operator naming the
 files about to run and getting a yes for those files.
5. **With no code left to complete and no open decisions.** Carlos, 2026-09-08:
 *"no quiero migrar a produccion si todavia hay codigo que completar y
 decisiones abiertas"*. This one holds the run even when he would approve the
 files, so it is checked before condition 4 is worth asking about. It is a
 condition on the moment and not on the method: nothing about the pending set
 changes while it holds, and none of the other four is satisfied any less. What
 it forbids is treating a green rehearsal as a reason to go.

### 5.0 Prove which database you are about to write to

Two checks, both before anything is written. The run of 2026-09-06 needed three
attempts to reach production and each wrong target was caught here.

**Identify the database by a name only one of them has, never by a count.**
`fintrack_dev` carries an inert ledger row, `012_backfill_budget_policies.sql`,
beside the real `012_backfill_budget_allocations.sql`. Production does not have
it. Any reading that shows that row is `fintrack_dev`, whatever its ledger count
says. A count can be coincidentally right; a filename cannot.

The reason a wrong target is easy to reach: `dotenv` takes the **last**
assignment of a repeated key, and commented lines do not count toward that. So
uncommenting the production line changes nothing while a local assignment
survives below it, and the pool goes on resolving to the local database while the
file appears to say otherwise. A variable already present in `process.env` beats
the file entirely, which is the safer route when one exists.

**Read the migration files on disk, not the branch they came from.** The runner
executes what `sql_migrations/` holds at that moment. On 2026-09-06 the working
tree was on `feat/vercel-serverless`, which did not carry the corrected `029`,
and the branch difference was invisible to every check that looked at the ledger
rather than at the file. Confirm the pending files read the way the rehearsal
proved them.

### 5.1 Rehearse the whole sequence on a copy of production data

The rehearsal is the sequence, not the last file of it. Rehearsed end to end for
the first time on 2026-09-08.

```bash
pg_dump "$PROD_URI" -f prod_full.sql
createdb -U postgres fintrack_prod_data
psql -U postgres -d fintrack_prod_data -f prod_full.sql
```

Keep the dump **outside the repository**: it contains real names, emails and
balances. Delete it once the rehearsal is over.

`fintrack_prod_data` is then the untouched control and never receives a
migration — its ledger is empty, so `db:migrate` would attempt `001` against
populated tables. Clone it into the database that does:

```
CREATE DATABASE fintrack_prod_rehearsal_full TEMPLATE fintrack_prod_data;
```

```bash
DB_NAME=fintrack_prod_rehearsal_full DB_EXPECTED=fintrack_prod_rehearsal_full npm run db:state
DB_NAME=fintrack_prod_rehearsal_full DB_EXPECTED=fintrack_prod_rehearsal_full npm run db:align
DB_NAME=fintrack_prod_rehearsal_full DB_EXPECTED=fintrack_prod_rehearsal_full npm run db:migrate
```

**The chain step runs twenty files, and the number is the last file plus one.**
The alignment stamps `001`-`012` and `014`-`017` and leaves `013` out
deliberately, so the runner takes `013_normalize_category_budget_name_case.sql`
first and `018` through `036` after it. That is where
`account_name_case_backup_013` comes from on a rehearsed copy. It was nineteen
until `036` was written on 2026-09-08, so read the count off the highest
numbered file rather than off this sentence. Measured: a copy of
`fintrack_prod_data` aligned and then migrated on 2026-09-08 reported twenty
files completed and `7 of 7 repointed keys reach account_registry`.

### 5.2 Verify on two axes

- **Schema**: compare the rehearsal against a database built by running the
 chain from zero. They must agree column by column, and also on constraints,
 indexes, triggers, defaults and functions. Two differences are expected and
 documented: the `user_roles` CHECK renders differently and accepts the same
 four strings, and `budget_policies`, `budget_policy_allocations` and
 `budget_frequency_types` exist only on a chain-built database, because
 `fintrack_dev` ran `010` before commit `3b72371f` removed their `CREATE TABLE`
 statements.
- **Data**: compare the rehearsal against the untouched control with a
 fingerprint — row counts, sums, and `md5(string_agg(...))` of the name columns.
 A migration that adds structure must not move a single existing value.

**Do not re-run the alignment as an idempotency proof.** An earlier version of
this section said to run the migration a second time and expect every counter at
zero. That holds for a chain file, which the runner skips by name. It is false
for `supabase/001_production_alignment.sql` once the chain has run on top: its
step 8 is an unconditional `DROP CONSTRAINT` then `ADD CONSTRAINT`, and a second
run returns three of the four `transactions` foreign keys to `user_accounts`,
undoing three of 035's seven repoints with no error. Measured 2026-09-08.
`db:align` refuses a second run for that reason. To rehearse again, build a new
database from the dump.

### 5.C The chain runs before the code deploy, decided 2026-09-08

**Schema first, then code.** Decided by Carlos on 2026-09-08, and for this batch
it is not a preference between two workable orders.

The reason is measurable today. `git grep -l account_registry` over
`backend/src` returns **ten paths on `main` and zero on
`origin/feat/vercel-serverless`**, so the deployed backend does not mention the
table anywhere, let alone query it. That is why production is sound today with
035 unapplied.

Of those ten, **three execute SQL against the table** and they are what the
merge would carry into production:

- `accountIdentity.js:120` declares `account_registry ar` inside
 `accountIdentityCte`. It is the only definition.
- `overviewAccountRepository.js` embeds that CTE in five statements, at lines
 44, 88, 191, 221 and 255, which resolve the income, expense and
 profit-and-loss account ids, the ids of one requested type, and the oldest
 account date. Every card on the Overview page is cut against one of them.
- `deleteAccountService.js:1226` writes the closure stamp with
 `INSERT INTO account_registry`.

The other seven mention it without querying it, and the distinction matters
because a grep alone overstates the exposure: `transactionRowShape.js` and
`assessAccountDeletion.js` name it only in comments, `035`, `036` and
`runAlignment.js` are the chain itself, this document is the tenth, and
`createTables.js` is the boot path that builds the table rather than reading it.

If 035 has not run when the merge lands, the three above meet a relation that
does not exist: the Overview page errors rather than degrading, and the close
fails on its stamp.

Counted and classified on 2026-09-08, against `main` at `3ad15e40` and
`origin/feat/vercel-serverless` at its head of that date. Re-run the grep before
acting on this: the ten is a fact about a commit, not about the project, and a
merge into either branch changes it.

The order is therefore forced in one direction only. Running the chain early
costs nothing, because the deployed code ignores what it adds. Deploying the
code early breaks the Overview page and the deletion path at once, against a
missing relation.

**What makes the reverse order safe in general, and why it does not apply
here.** A migration can precede its code when it is additive, and every file
from `013` to `036` is: new tables, new columns, new catalog rows, repointed
foreign keys. None removes a column or a table the deployed code reads. The one
class that would force code first is a `NOT NULL` on a column the running code
does not fill, and section 3 states that rule separately because it survives
this decision.

The consequence for the branch: `main` must not merge into
`feat/vercel-serverless` until the chain has run against production. That is a
sequencing constraint on the merge, not a second decision.

**The constraint binds the merge rather than the deploy, deliberately.** Neither
`backend/vercel.json` nor `frontend/vercel.json` names a branch — the first
declares only a legacy `builds` entry for `index.js`, the second only a rewrite —
so which branch triggers a production deployment lives in the Vercel project
settings and cannot be read from this repository. With the trigger invisible, the
merge is treated as the deploy. Anyone who establishes otherwise from the Vercel
side can loosen this, and should record where they read it.

**Cleaning `main` is not blocked by any of the above.** The constraint was raised
on 2026-09-08 against a wish to merge on the grounds that `main` carries
leftovers and obsolete comments, and those are two different actions: removing a
leftover is a commit on `main`, while the merge is what publishes `main` to the
branch that reaches production. Merging a `main` that needs tidying moves the
untidiness rather than removing it, and it carries the three executing readers
above with it. So the tidying can proceed at any time and the merge waits — the
two wishes only compete if the merge is assumed to be the tool for the tidying.

### 5.3 Back up production, immediately before writing

```bash
pg_dump "$PROD_URI" -f prod_before_<change>.sql
ls -la prod_before_<change>.sql
```

A dump from last week is not a backup for today's write. Check the file size:
a connection failure leaves an empty file and `pg_dump` does not always shout.

### 5.4 Apply

```bash
DB_EXPECTED=<production database name> DB_REMOTE_OK=1 npm run db:migrate
```

- **One command, not two, and `db:align` is not the one that was dropped by
 mistake.** An earlier version of this block opened with `db:align` against
 production. That was wrong and this section contradicted its own opening: the
 alignment ran on Supabase on 2026-08-22 and its ledger row is there, so
 `db:align` refuses. The refusal is correct and typing the command is still a
 defect, because an operator who sees a refusal on the first line of a
 production procedure has to decide whether the document or the runner is wrong
 while connected to production.
- **The pending set is every numbered file above production's last ledger row,
 and it is read rather than quoted.** The record puts production at `030` with
 the alignment applied and the ledger at 31 rows, read 2026-09-06, which makes
 the set `031` upward. Derive it from that reading; do not carry a count here.
 The figure has aged three times, most recently within a single day:
 `037_add_balance_reversal.sql` merged to `main` on 2026-09-08, hours after
 this bullet was written to name it as pending on a branch, and the derivation
 absorbed it with no edit. That is what the rule is for.
- **The record is not the reading, and 5.0 is what turns it into one.** Read the
 ledger before writing. If it does not end at `030_add_jpy_currency.sql`, stop:
 the pending set is not the one this section describes.
- **Carlos authorizes files by name, so the set is named to him at the moment of
 the run.** Condition 4 is satisfied by the files the reading actually returns,
 never by a count carried over from an earlier conversation. A file that merged
 in between is a file he has not approved yet.
- **`DB_REMOTE_OK` is required and is the point.** Without it the run refuses,
 because `DB_EXPECTED` confirms a name and a remote database can carry any name.
 Setting it is the operator stating that an off-machine destination is meant.
- **`NODE_ENV` must not be `production` in the shell that runs these.** Both
 scripts refuse under it, and an earlier version of this bullet called that
 refusal the migration freeze. It never was. The freeze was Carlos's suspension
 of production migrations until the process was defined; this guard keys on the
 environment variable and not on the destination, so it stops a **deployed**
 process from migrating itself and does nothing to an operator's shell. Lifting
 the suspension required no code change and this guard stays.
- **`db:align` runs once per database, ever.** It refuses if the ledger already
 carries its row. That is why it is absent from the block above and present in
 5.2: a rehearsal copy is a new database every time, production is not.
- Read the last line of the run. A refusal prints the database it reached, which
 is the whole point of reaching it before writing.

### 5.5 The ledger registers itself

Nothing to do. `db:migrate` writes one row per file inside that file's own
transaction, and step 9 of the alignment writes its own row plus the sixteen
chain rows it makes true, inside the transaction that makes them true.

The manual `INSERT` below is the fallback for a file that was applied outside
the runner, and applying a file outside the runner is what condition 1 forbids.
It is kept because `supabase/001_production_alignment.sql` was recorded that way
on 2026-08-22 and a reader of that ledger deserves to know how the row got there.

```sql
INSERT INTO migrations (filename) VALUES ('NNN_name.sql')
ON CONFLICT (filename) DO NOTHING;
```

### 5.6 Read the final state and keep it

```bash
NO_COLOR=1 DB_EXPECTED=<production database name> DB_REMOTE_OK=1 npm run --silent db:state \
 > src/db/docs/db-documented/production-runs/<YYYY-MM-DD>-after.txt
```

The same command before the run, into `<YYYY-MM-DD>-before.txt`. Commit both.
Two files per run, in the repository, is the answer to how a production run is
recorded — verifiable by anyone later, unlike a `.log` at the repository root.

`--silent` drops npm's own two-line banner and `NO_COLOR=1` drops the escape
sequences `picocolors` still emits when the output is redirected. Without both,
the record is a file of terminal control codes rather than a reading.

Compare the pair against the numbers the rehearsal produced: the ledger rows,
the registry parity line, and the foreign keys into the account identity. A
figure that differs is a divergence to explain before moving on, not a rounding
error.

**The pair is a schema reading and does not answer a question about data.**
`db:state` reports tables, constraints, ledger rows and the registry parity
count; it does not report what any row holds. So an empty `production-runs/`
says no migration reached production through a runner, and says nothing at all
about whether production carries the rows a card sums. A claim about data needs
its own query against the copy, named and dated like any other measurement.

---

## 6. What must never be done

- **Never point `runMigrations.js` at production while its ledger is
 incomplete.** It would mark every file as executed over a database that does
 not have their effects.
- **Never write a corrective migration.** A migration that fixes a previous
 migration doubles the surface every future environment has to replay. Fix the
 file and rebuild locally; breaking a local database is an accepted cost, a
 broken chain is not.
- **Never run `db:reset` against anything but a disposable local database.**
- **Never run `db:align` twice against the same database.** Its step 8 is an
 unconditional `DROP CONSTRAINT` then `ADD CONSTRAINT` and a second run returns
 three of the four `transactions` foreign keys to `user_accounts`, undoing three
 of 035's seven repoints without failing. `db:align` refuses it; the rule exists
 for anyone tempted to apply the file another way.
- **Never commit a production dump.** It holds personal data.
- **Never deploy a `NOT NULL` before the code that fills it.** Section 3.

---

## 7. Seeding the ledger of a database built by the boot DDL

**When this applies.** A database whose schema came from
`run_time_db_init/createTables.js` — the DDL that `initializeDatabase()` runs on
every server start — rather than from the chain. Its ledger is empty or short
while its schema already carries the effect of files nobody ran through the
runner, because the boot path writes no ledger row at all: its own flag is
`app_initialization`.

**Why the runner cannot fix it by being run.** Pointed at such a database it
reads `SELECT filename FROM migrations`, finds nothing, and starts at `001`. A
`CREATE TABLE IF NOT EXISTS` over a table that already exists is a no-op, so the
tables are skipped without acquiring one column, while the `ALTER TABLE`s and the
backfills do run — and a ledger row is written for every file, declaring success
over a database that received a fraction of them. Measured: the chain from `001`
fails at the second file. This is the situation `001_production_alignment.sql`
was written for (section 1), and why it writes its own ledger rows.

### 7.1 What decides whether a file may be marked

One question per file, and the answer is a reading of the target database, never
of the file list.

| the file's effect | where it is read on the target | may be marked when |
|---|---|---|
| schema — a table, a column, a constraint, an index | `information_schema.columns`, `pg_constraint`, `pg_indexes` | the object is present with the same declaration |
| data — a backfill, a catalog seed, a normalisation | the rows themselves | the rows the file would write are already there |

**The schema half has a tool.** `npm run db:parity` builds one throwaway database
by each path — `fintrack_parity_chain` from the chain, `fintrack_parity_boot`
from the boot DDL — and compares the columns, the constraints and the six seeded
catalogs, treating the three bookkeeping tables as expected differences rather
than as drift. It answers whether the boot path reproduces the chain's shape
**today**: green means a database built by that path has the schema of every file
on the chain, and no schema-effect file needs its own reading. Red names the
divergences, and each one is a file that must not be marked.

**The data half has no tool, and it is where the mistake gets made.** A backfill
leaves nothing in the schema to read, so the parity check above stays silent on
it while the file list looks complete. The two worked examples are in
`001_production_alignment.sql`, which faced this question for real and answered
it both ways in one statement. It marks `012_backfill_budget_allocations.sql`,
whose rows it had produced. It leaves `013_normalize_category_budget_name_case.sql`
out, and the comment above its `INSERT INTO migrations` says why: the file does
not normalize name case, so the row is not earned and `013` receives it when
`013` runs. Two data migrations, opposite decisions, and the difference is a
reading of the rows.

**A ledger row can outlive its file, which is what makes the identity test in
§5.0 work.** `fintrack_dev` carries a row for `012_backfill_budget_policies.sql`,
a file no longer in `sql_migrations/`; production never had it. The runner
iterates the directory, so a row naming a file that is not on disk changes
nothing about what runs — it only breaks a count, and it breaks it in the
direction that looks like production is missing a backfill. Corrected here on
2026-09-07, after a session derived exactly that gap from a count and found no
such gap on reading the names.

### 7.2 The rehearsal, which never happens on the target

1. Restore a copy of the target into a local database.
2. Seed the ledger there, one statement per file judged present:
   ```sql
   INSERT INTO migrations (filename) VALUES ('NNN_name.sql')
   ON CONFLICT (filename) DO NOTHING;
   ```
3. Run `npm run db:migrate` against the copy. It must execute only the files left
   out, and finish clean.
4. Read the final state: the ledger's **filenames**, and the objects and rows the
   executed files claim to have created.

Only then the target itself, through the whole of section 5 — the proof of which
database is about to be written to (5.0), the backup taken immediately before
(5.3), and the verification on two axes (5.2).

### 7.3 What must never be done here

- **Never mark a file whose effect has not been read on that database.** The
  ledger row is a claim that the effect is present, and the runner never revisits
  a file it names.
- **Never mark in bulk from the directory listing.** It says which files exist,
  not which ones ran.
- **Never identify a database by its ledger count.** Two databases hold 31 rows
  and differ by one filename.
- **Never seed the ledger and run the chain in one pass.** Read the ledger back
  between the two.
