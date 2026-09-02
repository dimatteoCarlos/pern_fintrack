# Seeding the migrations ledger on a database the chain never built

Written 2026-09-02. **This is a procedure, not an execution.** Nothing here has
been run against production, and running it is the developer's decision, taken
in person, never through an agent.

---

## The problem this solves

Production was built by the boot DDL in `run_time_db_init/`, not by the
migration chain. Its `migrations` ledger was therefore empty while its schema
already held the effect of most of the chain. A runner pointed at it considers
every file pending and starts from `001`, which fails on the second file:
`002_accounts.sql` attaches a trigger on `users.timezone` to a `users` table
that already exists without that column, so the `CREATE TABLE IF NOT EXISTS`
above it is a no-op and the trigger has nothing to hang from.

Fixing the runner does not solve this. What the database needs is a ledger that
records the migrations whose effect it already has, so the runner skips them and
applies only what is genuinely missing.

This was already done once, by hand, inside
`migrations/supabase/001_production_alignment.sql`: its step 9 creates the
ledger table and inserts seventeen rows. That file is the worked example this
procedure generalises, and it deliberately left `013` out because it does not
normalise name case — that migration gets its row when it actually runs.

---

## The procedure

### 1. Establish what the target database already holds

Read the target read-only. For each migration file in the chain, decide whether
its effect is present, absent, or partial. The evidence is the schema, never the
file's name:

| the migration does | how presence is established |
|---|---|
| creates a table | the table exists with every column the file declares |
| adds a column | the column exists with the same type, nullability and default |
| adds a constraint or index | the constraint exists with the same definition |
| backfills or rewrites data | **cannot be established from the schema** — see below |

A data migration leaves no schema trace. It is never marked as applied on the
strength of a guess: either its effect is measurable in the data (a count of
rows that would still need changing is zero), or it is left unmarked and
allowed to run.

### 2. Rehearse against a restored copy, never against the target

Restore the target's dump into a throwaway local database. Everything below runs
there first, in full, and the result of each step is recorded before the same
step is considered for the real database.

`npm run db:parity` reports where the two build paths disagree today. Every
difference it reports is a candidate for a file that will not apply cleanly.

### 3. Write the seed as a file, not as ad-hoc statements

One file, under `migrations/supabase/`, that:

- creates the `migrations` table if it is absent, with the same shape the runner
  creates,
- inserts exactly the rows established in step 1, each one on its own line so
  the diff is readable,
- states in its header the date, the database it was written for, and the
  measurement each row rests on.

It carries no `BEGIN` or `COMMIT` if it is going to be handed to the runner. If
it is going to be applied by hand, it opens its own transaction and says so.

### 4. Run the chain against the rehearsal copy

With the ledger seeded, the runner should apply only the files step 1 marked
absent, and exit 0. Record which files ran.

**The one to watch is `013_normalize_category_budget_name_case.sql`**, wherever
it turns out to be pending. It is the only file in the chain that rewrites
existing data — it lower-cases the names of `category_budget` accounts and the
parts they derive from — so it is the only one whose rehearsal has to record the
names before and after and match a count of rows changed against step 1.

The alignment file leaves it out of its seventeen rows on purpose. A read-only
probe of production on 2026-08-27 nonetheless counted nineteen ledger rows,
which is the eighteen chain files through 018 plus the alignment file and leaves
no room for a missing 013 — so it appears to have run already. **That count is
arithmetic, not a list.** Step 1 confirms it by name before anyone relies on it.

### 5. Verify the rehearsal copy

- The ledger holds one row per chain file and no more.
- `npm run db:parity` reports no unaccepted difference between the rehearsal
  copy and a database built by the chain from empty.
- The application boots against the rehearsal copy on port **5078**, never 5000.
- A transaction inserts and a balance derives.

### 6. Only then, the decision

Applying any of this to the live database is a separate decision, taken by the
developer, with a backup taken immediately before and the rehearsal's record in
hand. No agent connects to production, and no agent is the authority for this
step.

---

## What must not happen

- No connection to Supabase or to any production database from a session that
  was not told to open one by the developer directly.
- No credential reuse: a script does not read the pool's connection string in
  order to point it somewhere else.
- No ledger row written for a data migration whose effect was not measured.
- No `.env` edited to reach another database.
