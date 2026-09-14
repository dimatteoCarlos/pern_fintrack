# Findings of the migration-chain investigation

**What this file is.** The forensic findings the 2026-09-07 to 2026-09-13
migration-chain investigation produced — three local databases measured,
production's ledger read, an alignment file's idempotence tested, a boot
counterpart's blast radius traced — held until now in this project's session
memory and moved here on 2026-09-14 on the owner's instruction. Each entry is
the memory's body copied verbatim, under the date it was last written.
Nothing was rewritten on the way across: an entry says what was true when it
was measured, and where a later measurement changed it, the entry itself
carries the correction, because that is how they were kept.

**How to read a link.** A name in double brackets was a link to another
memory. Where that name appears in the index below, it is a section of this
file. Where it does not, it was a durable rule kept in memory — see
`CLAUDE.md`'s neighbours — or is gone. The notation never guaranteed the
target exists.

**Status when moved.** The 031-038 chain ran clean against production on
2026-09-11 and the standing restrictions it discharges are recorded in the
entry below. This file is a closed investigation record, not an open task
list — see `plan-docs/ongoing/PLAN_MIGRATION_CHAIN_031_035.md` for what, if
anything, is still open on the chain itself.

## Index

- [alignment-not-idempotent-after-chain](#alignment-not-idempotent-after-chain)
- [late-counterpart-blocks-earlier-migrations](#late-counterpart-blocks-earlier-migrations)
- [migration-010-was-edited-in-place](#migration-010-was-edited-in-place)
- [migration-022-has-no-boot-counterpart](#migration-022-has-no-boot-counterpart)
- [013-omission-defeated-by-the-runner](#013-omission-defeated-by-the-runner)
- [fintrack-dev-is-not-productions-schema](#fintrack-dev-is-not-productions-schema)
- [local-production-copy-is-prod-data](#local-production-copy-is-prod-data)
- [unset-prod-uri-reaches-localhost](#unset-prod-uri-reaches-localhost)
- [production-chain-031-038-is-applied](#production-chain-031-038-is-applied)
- [production-migrations-frozen](#production-migrations-frozen)
- [no-merge-until-production-migration](#no-merge-until-production-migration)

---

## alignment-not-idempotent-after-chain


Measured 2026-09-08 on `fintrack_prod_rehearsal_full`, built from the raw
production dump and taken through `db:align` then the whole chain to 035. A
second `db:align` returned `transactions_account_id_fkey`,
`transactions_source_account_id_fkey` and
`transactions_destination_account_id_fkey` to `user_accounts`. Three of 035's
seven repoints undone; `transactions_opening_for_account_id_fkey` survived on
`account_registry` because the alignment's step 8 does not name it. No statement
failed and no output said anything had changed.

**Why:** the file's header claims *"Idempotent throughout: every step is guarded,
so re-running changes nothing"*, and every step is guarded except step 8, which
is an unconditional `DROP CONSTRAINT` then `ADD CONSTRAINT`. That is correct for
the run it was written for — production's `transactions` table already existed,
so the `RESTRICT` rule declared inside `CREATE TABLE IF NOT EXISTS` never arrived
and only an `ALTER` could deliver it — and wrong for any run after 035. The
resulting state is worse than pre-035 because it looks applied: `account_registry`
exists, the ledger says 035 ran, the backfill rows are there, and three keys point
back at `user_accounts`.

**How to apply:** `db:align` (`backend/src/db/migrations/runAlignment.js`) refuses
when the ledger already carries `supabase/001_production_alignment.sql`, so the
hazard is closed through the runner rather than by editing a file already applied
to Supabase on 2026-08-22. To rehearse again, build a new database from the dump.
A claim of idempotence in a header is a claim about one starting state; check it
against the state the database is actually in. Related:
[[local-production-copy-is-prod-data]] and
[[013-omission-defeated-by-the-runner]].

---

## late-counterpart-blocks-earlier-migrations


Measured on production on 2026-09-11, during the `031`-`037` chain.

**What happened.** An accidental boot pointed at production ran
`ensureBalanceReversal()` (`backend/src/db/run_time_db_init/createTables.js:1289`),
the boot counterpart of migration `037`, the LAST file in the chain. It inserted
`movement_types` id 11 and `transaction_types` id 7. Then `032` refused:
`032_add_account_closure_movement_type.sql` installs a ten-value CHECK on
`movement_types.movement_type_name` that does not list `'balance-reversal'`, and
`ADD CONSTRAINT` validates every existing row. The chain could not advance until
both rows were deleted, guarded by `NOT EXISTS` subqueries, and `037` reinserted
them at the end.

**Why:** this is not weak idempotence, which a second run absorbs. It is a hard
incompatibility in one direction: an `ensure*` function applies the END state of
the chain, and an earlier migration asserts an INTERMEDIATE state that the end
state violates. The later the counterpart, the more migrations it blocks.

**How to apply:** when a boot counterpart has run somewhere the chain has not,
the fix is to undo the counterpart's data on that database and let the chain
reach it in order - never to edit the earlier migration's constraint to admit
the later value. Editing it desynchronises the file from `037:174` and
`populateDB.js:410`, and `db:parity` compares constraint definitions as text.
The generalisation of [[mirror-the-applied-schema-not-the-sql]]: a counterpart
is safe on a database that is AT the chain's head, and hostile on one behind it.
Related: [[sweep-both-build-paths]], [[boot-ddl-never-runs-in-production]],
[[local-boot-has-no-destination-guard]].

---

## migration-010-was-edited-in-place


`3b72371f refactor(budget): replace schema and write path` (2026-08-12, CarlosDR)
modified `010_create_budget_tables.sql` in place. It removed three
`CREATE TABLE` statements — `budget_frequency_types`, `budget_policies`,
`budget_policy_allocations` — and added `budget_monthly_allocations`.

**Why:** the current text of a migration file is not what a given database
received. A database that ran 010 before that commit holds the three
frequency/policy tables and will never lose them, because the ledger records 010
as applied and `runMigrations.js` only runs what the ledger does not name. This
is the whole explanation for `fintrack_dev` carrying three tables that
`fintrack_rehearsal` and the production copy do not, and for the boot-path
comments and the throw at `populateDB.js:529` naming migration 010 as the
remedy: they were true when written and an in-place edit invalidated them
without touching them. See [[013-omission-defeated-by-the-runner]] and
[[local-production-copy-is-prod-data]].

**How to apply:** never conclude "no build path creates X" from the current
files alone — run `git log -S` on the DDL before ruling on any table's origin.
When a comment or an error message names a migration that does not do what it
claims, check whether that migration was edited after it was applied before
calling the comment wrong. Reverting the file is not the remedy: that would be a
second in-place edit of an applied migration.

---

## migration-022-has-no-boot-counterpart


**The gap is closed and the headline of this note was wrong by 2026-09-11.**
`ensureTransactionOpeningFor()` in `createTables.js` adds
`transactions.opening_for_account_id` to an existing database and keys it, and
`initDatabase.js` calls it. Measured by reading both files on 2026-09-11, after
repeating the stale claim to a peer. Do not say 022 has no counterpart.

What was true, and how it was found: `022_add_transaction_opening_for_account.sql`
adds the column, `mainTables` in `createTables.js` declares it inside a
`CREATE TABLE IF NOT EXISTS` that only fires on a virgin database, and until the
counterpart was written no `ensure*()` added it to an existing one. Found
2026-09-08 when `ensureAccountRegistry()` raised 42703 building a foreign key on
it against a copy of the 2026-08-21 production dump.

**Why it is kept:** the lesson outlives the gap. It is the exact shape
[[parity-cannot-see-boot-path-gaps]] describes — `db:parity` builds both paths
from scratch, so a divergence that appears only on a preexisting database is
invisible to it, and this one survived a green parity run.

**How to apply:** when a boot counterpart builds a foreign key, verify the
referencing column and its table are both present and say which is missing when
they are not — a database old enough to need the counterpart is old enough to be
missing columns other migrations owe. Related: [[sweep-both-build-paths]],
[[mirror-the-applied-schema-not-the-sql]].

---

## 013-omission-defeated-by-the-runner


`supabase/001_production_alignment.sql` leaves `013` out of its ledger step
deliberately and records at `:32-33` that `account_name_case_backup_013` "exists
only on the chain". But `runMigrations.js:89-98` reads the whole directory,
sorts, and runs everything absent from the ledger. `013` sorts before `018`, and
`018_alter_transactions_account_fks_to_restrict.sql` reached production on
2026-08-27. So either someone inserted 013 into production's ledger by hand — no
such insert is recorded anywhere in the repo — or 013 ran that day.

**Why:** 013 is not inocuous. Counted by its own predicates against the local
production copy on 2026-09-08: the INSERT at `013:30-42` backs up 28 rows, the
UPDATE at `013:44-50` rewrites 27 `user_accounts.account_name` values, the UPDATE
at `013:52-56` rewrites 12 `category_budget_accounts` rows. Real values, e.g.
`Restorante/D'luchis/want`, `aceites/OLIVA/want`, `pan/TOSTADA CL/want`. Grouping
the 94 category_budget accounts by `LOWER(TRIM(account_name))` yields no group
larger than one, so nothing collapses — the damage is spelling, not identity.

**How to apply:** a "deliberately not reproduced" note in a hand-run file is a
statement about that file, not about the database. The runner decides what runs,
and the only thing that keeps a file out is a ledger row. Settling whether 013
ran needs a read of production's `migrations` table, which is Carlos's alone and
sits under his freeze. Note also that `013`'s DOWN is the backup table's only
reader, so once CLOSE deletes accounts the DOWN stops being real for them —
record that in the retirement register rather than gating CLOSE. Related:
[[local-production-copy-is-prod-data]], [[production-migrations-frozen]],
[[migrations-must-be-right-the-first-time]].

---

## fintrack-dev-is-not-productions-schema


Measured 2026-09-08, comparing `fintrack_dev` against
`fintrack_prod_rehearsal_full` on columns, constraints, indexes and triggers.
`budget_policies`, `budget_policy_allocations` and `budget_frequency_types` exist
only on `fintrack_dev`: 19 columns, 11 constraints and 8 indexes that no
production-shaped database has. The only other difference is cosmetic — the
`user_roles` CHECK renders as one cast per element on the aligned copy and as
`ARRAY[...]::text[]` on the chain-built one, accepting the same four strings.

**Why:** `fintrack_dev` ran `010_create_budget_tables.sql` before commit
`3b72371f` of 2026-08-12 removed those three `CREATE TABLE` statements from it,
so its schema records a version of 010 that no longer exists. A database's shape
depends on when it ran a migration, not on the file's current text — see
[[migration-010-was-edited-in-place]]. Nothing on the request path reads any of
the three: `budget_policies` and `budget_policy_allocations` have zero references
in `backend/src`, and `budget_frequency_types` is read only by `initDatabase.js`
and `populateDB.js`, which never run on the deployed backend.

**How to apply:** the difference is inert, so this is about evidence rather than
risk. A change verified on `fintrack_dev` is not verified against production's
schema when it touches the budget domain; verify it on
`fintrack_prod_rehearsal_full`, which is the dump aligned and migrated. And a
rehearsal is built from `fintrack_prod_data`, never derived from `fintrack_dev`.
CLOSE is one such change: it deletes `category_budget_accounts` rows.
Related: [[local-production-copy-is-prod-data]] and
[[frequency-catalog-is-a-closed-island]].

---

## local-production-copy-is-prod-data


Measured read-only on 2026-09-08. `fintrack_prod_data`: 1 user, 100
`user_accounts`, 785 `transactions`, 110 columns in `public`, `migrations`
empty, `app_initialization` present, no `account_name_case_backup_013`, no
`budget_monthly_allocations`. `fintrack_rehearsal`: 0 users, 0 accounts, 0
transactions, ledger 001-030 — a chain-built empty database, not a copy.
`fintrack_dev`: ledger through 034, 210 columns, and one ledger row,
`012_backfill_budget_policies.sql`, for a file that does not exist on disk.

**Why:** the 110 columns and the empty ledger are exactly what
`supabase/001_production_alignment.sql` describes production as being before it
ran on 2026-08-22, so the copy is the dump of 2026-08-21 and predates both the
alignment and the whole 018-034 stretch. Anything measured on it is evidence
about 2026-08-21, never about production today. `020_create_pocket_tables.sql`
shows the trap in miniature: its header states four production counts as zero on
2026-08-24, the copy holds one pocket account with 3 transactions, and the header
itself explains the gap — the owner deleted it through the app that day. The copy
corroborated the header; a careless read would have called it a contradiction.

**How to apply:** to point a read-only script at a named local database, set
`DB_NAME` and call `getDbConfig()` from
`backend/src/db/migrations/dbMigrationConfig.js` — `:64` gives `DB_NAME`
precedence over the database parsed out of `DATABASE_URI`, which is how
`getAdminDbConfig()` reaches `postgres`. Guard on `config.host` being localhost
and on `current_database()` matching the intended name, because `DB_NAME` keeps
whatever host the URI names. Never read the pool's connection string to repoint
it. A faithful rehearsal of the pending chain means restoring this copy into a
NEW database, applying the alignment file, then running the chain — not running
the chain against the copy, whose ledger is empty. Related:
[[production-migrations-frozen]] and [[013-omission-defeated-by-the-runner]].

**The rehearsal the paragraph above prescribes already exists.**
`fintrack_prod_rehearsal` is `fintrack_prod_data` restored into a new database
with `supabase/001_production_alignment.sql` applied and the chain run on top:
1 user, 99 accounts, 780 transactions, ledger 001-035 plus a hand-written row
named `supabase/001_production_alignment.sql`. It is the database to migrate
when Carlos asks for a run against a local copy of production;
`fintrack_prod_data` stays untouched because it is the source the rehearsal is
rebuilt from, and its empty ledger would make `db:migrate` attempt `001` against
populated tables. Measured 2026-09-08, when 035 was applied to it and to
`fintrack_dev`.

---

## unset-prod-uri-reaches-localhost


`psql "$PROD_URI"` with `PROD_URI` unset receives an empty connection string,
which libpq reads as "use every default": localhost, port 5432, the OS user.
It does not fail. It connects somewhere else and answers.

**Observed twice on 2026-09-11**, both times because the variable lived only in
one shell and the next command ran in another: `pg_dump "$PROD_URI"` dumped
nothing from production and prompted for a local password, which Carlos answered
with the Supabase one; and a verification capture wrote a file that recorded
`destino:` with nothing after it and `stdout is not a tty`, so an entire
before/after comparison had to be redone.

**Why:** an empty variable is not an error in shell expansion, so the failure
mode is a wrong answer rather than a refusal - the same class the destination
interlock in `dbMigrationConfig.js` exists to close for `db:migrate`.

**How to apply:** before any command that names `$PROD_URI`, print the
destination alone: `echo "destino: ${PROD_URI##*@}"`. An empty tail means stop.
Never print the whole string. And `psql` cannot prompt for a password when its
output is redirected to a file, so a capture either carries the password in the
environment or runs to the terminal and gets pasted back. Related:
[[db-name-is-the-rehearsal-override]],
[[each-production-run-needs-authorization]], [[measurement-discipline]].

---

## production-chain-031-038-is-applied


Measured on production 2026-09-11 and recorded in
`backend/src/db/docs/db-documented/production-runs/2026-09-11-after.txt`
(commit `e3dee3e8`): ledger at 39 rows, last executed
`038_constrain_transaction_status.sql`, 99 `user_accounts` against 99
`account_registry` rows with none stranded, 782 transactions, and all eight
markers present from the `boundary` account type through
`chk_transaction_status`.

**Three standing restrictions are discharged by it.** Migrations against
production are no longer frozen ([[production-migrations-frozen]] was Carlos on
2026-09-07 and he lifted it on 2026-09-08 for named files one at a time). The
merge is no longer blocked ([[no-merge-until-production-migration]]): `main`
fast-forwarded `feat/vercel-serverless` from `20de666d` to `e3dee3e8` on
2026-09-11, 491 commits, which is what triggers the two Vercel deploys. And the
freeze on `backend/src/db/migrations/`, `run_time_db_init/` and
`docs/db-documented/` that the peers were given is lifted.

**Why it still matters:** the run was not routine. `032` refused because an
accidental boot had already applied `037`'s catalog rows
([[late-counterpart-blocks-earlier-migrations]]), and three separate captures
reported on the wrong database ([[unset-prod-uri-reaches-localhost]]). Both
causes are now closed in code by the boot destination interlock
([[local-boot-has-no-destination-guard]]).

**How to apply:** production's schema is at `038`. A new migration starts from
there, needs a boot counterpart in `createTables.js` written at the same time
([[sweep-both-build-paths]]), and still needs Carlos to authorize its run by
file name ([[each-production-run-needs-authorization]]).

---

## production-migrations-frozen


His words: "migraciones a prduccion tienen que estar parado hasta que no se
definan los procesos." Direct to this session, not relayed. Development runs and
read-only queries are untouched; it is the production run that is stopped.
Frozen by it: 031, 032, 033, 034, the `income_source_accounts` drop he assigned,
and anything not yet written.

**Why:** it arrived the same day as his commit freeze during the definition
phase — "si estamos definiendo el plan y estamos definiendo los algoritmos, no
podemos estar comiteando si no esta bien cimentado" — and the two are one
posture. A migration is the artefact that cannot be revised after it runs, so
"nothing is settled until the processes are defined" binds hardest here. See
[[migrations-must-be-right-the-first-time]].

**How to apply:** the non-obvious half is that this freezes the backend deploy
too, without a second instruction. `main` carries 37 executable references to
`ua.closed_at` across 9 files plus two `account_type_name <> 'boundary'`
predicates, and production may hold none of the four migrations they need, so
merging `main` into the deploy branch while the freeze holds ships code against
a schema that does not exist. Merging into `main` itself stays fine — it is an
integration branch, see [[deploy-branch-is-not-a-work-branch]]. Still unknown
and deferred rather than refused: whether 019-034 ever ran in production. The
alignment file records production receiving 018 on 2026-08-27 and its own ledger
stops at 017, so 17 chain files are unaccounted for; the answer needs a read of
production's `migrations` table, which only he can authorise. Related:
[[boot-ddl-never-runs-in-production]] and [[pre-034-refuses-every-deletion]].

---

## no-merge-until-production-migration


Decided 2026-09-03. Nothing merges into `main` until the migration chain has
been tested against the production database. The developer stated it as "no
merge con feat/vercel-serverless", and `feat/vercel-serverless` points at the
same commit as `main` (`5b7babac` that day), so the instruction covers `main`.

Three merges are measured, ready and held by this: `fix/auth-screen` into `main`
as a fast-forward of 348 commits, `feat/pocket` into `main` clean, and
`feat/overview` into `main` with one conflict in
`backend/src/fintrack_api/routes/index.js`.

**Why:** production was built before migrations `007` to `017` existed and was
repaired by a one-shot alignment file, so whether its schema matches the chain
is unsettled in the documents. Landing code on the branch a Vercel project
deploys, before that is measured, publishes against an unknown schema.

**How to apply:** a deploy never changes the schema on its own — `backend/vercel.json`
declares no build command, `package.json` has no `build` or `postinstall`, and
`initializeDatabase()` is skipped under Vercel (`index.js:56-58`). The schema
moves only when someone runs `db:migrate` with the production connection string,
which requires the developer's explicit instruction given directly. Related:
[[budget-is-wip-supabase-comes-last]], [[two-vercel-projects]].

---

