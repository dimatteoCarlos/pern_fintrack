# Database Migration Procedure

How a schema change travels from a local file to the production database.

Companion documents: `db-lifecycle.md` (what migrations, seeds and resets are),
`db-bootstrap.md` (the boot path), `db-setup.md` (first local setup).

---

## 1. The two kinds of migration file

### The chain — `src/db/migrations/sql_migrations/`

Numbered files, `001` to `030` today, with no gap; the next free number is
`031`. They build a database **from zero**, in order: `002_accounts.sql` creates
the tables that `014_category_budget_fx_columns.sql` later alters. A file assumes
every lower-numbered file already ran.

**From zero, and only from zero.** Pointing the runner at an existing database
with an empty ledger does not replay the chain over it: measured 2026-09-06
against a clone of `fintrack_prod_data`, the run fails at `002_accounts.sql`,
because its `CREATE TABLE IF NOT EXISTS users` skips the table that is already
there and the IANA trigger it then declares has no `timezone` column to watch.
That is what `supabase/001_production_alignment.sql` exists for.

List the directory before writing one rather than trusting the count above. That
count goes stale on every migration, and it was three files behind until
2026-09-03 and two more behind until 2026-09-06.

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

---

## 4. Applying to a local database

```bash
npm run db:migrate
```

Reads `DATABASE_URI` from `backend/.env`. To point at a different local
database, override `DB_NAME`; see `dbMigrationConfig.js`.

Never point `npm run db:reset` at a database you care about: it terminates the
connections and drops it.

---

## 5. Applying to production

Production is Supabase. The connection string lives in `backend/.env` as
`DATABASE_URI_SUPABASE`, commented out on purpose, and in the Vercel project as
`DATABASE_URI`.

The procedure below is what the alignment file was rehearsed against on
2026-08-26, and what its execution has to follow. Each step exists because of
something that can go wrong; none of them is ceremony.

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

### 5.1 Rehearse on a copy of production data

```bash
pg_dump "$PROD_URI" -f prod_full.sql
createdb -U postgres fintrack_prod_data
psql -U postgres -d fintrack_prod_data -f prod_full.sql
```

Keep the dump **outside the repository**: it contains real names, emails and
balances. Delete it once the rehearsal is over.

Then clone that control into a disposable database and run the migration there —
`CREATE DATABASE fintrack_rehearsal TEMPLATE fintrack_prod_data;` copies schema
and data without going through a dump file, and leaves the control untouched.

### 5.2 Verify on two axes

- **Schema**: compare the rehearsal against a database built by running the
 chain from zero. They must agree column by column, and also on constraints,
 indexes, triggers, defaults and functions.
- **Data**: compare the rehearsal against the untouched control with a
 fingerprint — row counts, sums, and `md5(string_agg(...))` of the name columns.
 A migration that adds structure must not move a single existing value.

Run the migration a **second** time on the rehearsal. Every counter must come
back zero and the last line must be `COMMIT`. That is the idempotency proof, and
it is what caught the `ON CONFLICT` defect described above.

### 5.3 Back up production, immediately before writing

```bash
pg_dump "$PROD_URI" -f prod_before_<change>.sql
ls -la prod_before_<change>.sql
```

A dump from last week is not a backup for today's write. Check the file size:
a connection failure leaves an empty file and `pg_dump` does not always shout.

### 5.4 Apply

```bash
psql "$PROD_URI" -f path/to/migration.sql
```

- The file's own transaction, when it has one, is sufficient. Do **not** add
 `-1` to a file that carries `BEGIN`/`COMMIT`: it nests a second transaction and
 produces confusing warnings.
- Add `-1` to a chain file, which has no transaction of its own and would
 otherwise autocommit statement by statement — leaving the database half
 migrated if one of them fails.
- Read the last line. `COMMIT` means applied; `ROLLBACK` means nothing was
 written and production is untouched, which is the good failure.

### 5.5 Register it in the ledger

A file executed with `psql` does **not** register itself — that is the runner's
job, and the runner did not run. Without the row, a future deployment executes
it again.

```sql
INSERT INTO migrations (filename) VALUES ('NNN_name.sql')
ON CONFLICT (filename) DO NOTHING;
```

### 5.6 Read the final state

Count the ledger rows, the rows of any table the migration created, and whatever
the migration claims to have normalized. Compare against the numbers the
rehearsal produced. A figure that differs is a divergence to explain before
moving on, not a rounding error.

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
- **Never commit a production dump.** It holds personal data.
- **Never deploy a `NOT NULL` before the code that fills it.** Section 3.
