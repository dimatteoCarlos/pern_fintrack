# PLAN_MIGRATION_CHAIN_031_035 — five written, 035 applied locally

**State: open, 2026-09-08.** This is a live register of the queued half of the
migration chain. It exists because five migration files were written for the
account closure work and no document tracked what applying them requires; the
facts were scattered across `PLAN_CLOSE_ACCOUNT.md`, which belongs to a feature,
and `PLAN_MIGRATION_CHAIN.md`, which was closed on 2026-09-06.

Every claim below was measured on 2026-09-08 against `main` at `0d5c41a6`. Where
a claim is a reading rather than a measurement, it says so.

---

## 1. What is queued

| file | what it does |
|---|---|
| `031_add_boundary_account_type.sql` | Adds the structural account type `boundary` as `account_type_id` 8 and retypes the existing compensation accounts from `bank`, so the system's own counterpart account stops counting as one of the user's |
| `032_add_account_closure_movement_type.sql` | Adds `account-closure` to `movement_types` and to `transaction_types` and rewrites the `movement_types` CHECK that would reject it |
| `033_require_account_type.sql` | Makes `user_accounts.account_type_id` NOT NULL and moves its foreign key from `ON DELETE SET NULL` to `ON DELETE RESTRICT` |
| `034_add_account_closed_at.sql` | Adds `user_accounts.closed_at`, so closing an account and deleting one stop writing the same column |
| `035_create_account_registry.sql` | Creates `account_registry`, its trigger and backfill, and repoints seven foreign keys onto it so references survive the deletion of the `user_accounts` row |

---

## 2. Applied state — nothing runs them

**No path applies the chain, and this is the fact the rest of the document rests
on.** Four measurements, each on its own file:

- `backend/package.json` starts the server with `"start": "node src/index.js"`
  and declares no `postinstall` and no `vercel-build`.
- `backend/vercel.json` carries `version`, `builds` and `routes` and nothing
  else.
- `db:migrate` is declared in `backend/package.json`. Its only two callers are
  `bootstrapping.js`, a script a person runs, and `schemaParity.js`, which
  builds throwaway databases to compare them. Neither is a deploy step.
- The boot path states its own scope. `initDatabase.js` carries the sentence
  *"NOT ON THE DEPLOYED REQUEST PATH"*, and *"Production receives a schema
  change exclusively through the migration chain."*

**The backend deploys from `feat/vercel-serverless`, not from `main`.** That
branch is at `20de666d`, dated 2026-09-06, and carries **zero commits that `main`
does not have**; the count in the other direction was 202 when this document was
written and 204 hours later, so read the direction and not the number. Its
highest migration file is `030_add_jpy_currency.sql`: none of the five files in
section 1 exist on the branch Vercel builds. Merging any of this work into `main` therefore changes
nothing a user can reach, and does so until Carlos merges `main` into the deploy
branch.

---

## 3. The second build path, and where it stops

`createTables.js` and `initDatabase.js` build a schema for a virgin local
database. They are not a substitute for the chain and cannot be measured against
it by `db:parity`, which builds both paths from scratch and compares tables and
columns — it cannot see a missing trigger.

| migration | runtime counterpart | covered |
|---|---|---|
| 031 | the catalog row `{ account_type_id: 8, account_type_name: 'boundary' }` seeded in `populateDB.js` | the catalog, yes. The retyping of existing compensation accounts has no counterpart and needs none: a virgin database has no accounts to retype |
| 032 | `ensureAccountClosureCatalog` | yes |
| 033 | `ensureAccountTypeRequired` | yes |
| 034 | `ensureAccountClosedAt` | yes |
| 035 | none | **deliberately none.** Ruled by Carlos on 2026-09-08 and recorded in `createTables.js` in the block headed `NO COUNTERPART FOR MIGRATION 035, DELIBERATELY` |

**The condition that ends the 035 gap, stated so it is checkable rather than a
later judgement call:** 035 applied at least once, its constraints read back from
the database and matched against the design, the counterpart then derived from
what was applied, and the result tested on a virgin build. Carlos's framing:
*"una réplica verificada del esquema aplicado, no una segunda interpretación del
SQL."*

**It takes all four pieces of 035 or none.** Four of the seven repointed keys sit
on `transactions`, the rest on `debtor_accounts`,
`budget_monthly_allocations` and `pocket_allocations` — every one of those tables
is created by `createTables.js` with `CREATE TABLE IF NOT EXISTS`, so on a virgin
database they are born pointing at `user_accounts`. Creating the registry without
repointing them leaves a table nothing references while its presence reads as
proof the repoint happened.

---

## 4. What is blocked on what

- **Block 3 of the close plan is not exercisable until 035 is applied.** Deleting
  the `user_accounts` row is refused by
  `pocket_allocations_source_account_id_fkey` and
  `budget_monthly_allocations_account_id_fkey`, which are `ON DELETE RESTRICT`
  into `user_accounts` until 035 repoints them onto `account_registry`, which
  never deletes a row. Measured on `feat/deletion` at the two `ALTER TABLE`
  statements that name those constraints. **Block 3 is written whole** — the
  first half at `9b859c0e`, the second at `23cda78c`, which stamps the registry
  row and then deletes the extension row and the account. Writing it was never
  blocked; what 035 gates is proving it works, and the deletion session states it
  is not asking for 035 to be applied in order to keep going.
- **035 carries one conditional precondition.** Its seventh key alters
  `budget_monthly_allocations`, which does not exist on a database that ran
  `010_create_budget_tables.sql` before commit `3b72371f` rewrote it. The
  `to_regclass` check at the top of 035 is what decides this, and it must be run
  first.
- **Nothing blocks 031 through 034.** They have runtime counterparts, they are
  independent of the registry, and no code waits on them.
- **Code that runs without 031 fails in two different ways, and only one is
  audible.** `transactionController.js` raises *"Account type 'boundary' not
  found: the migration chain has not reached 031"*. The Overview reads instead
  carry `AND act.account_type_name <> 'boundary'` in both
  `overviewAccountRepository.js` and `overviewPageRepository.js`: a negative
  comparison excludes nothing when no row holds that type, so a compensation
  account still typed `bank` enters net worth and the account inventory with no
  error anywhere. Whoever applies 031 should expect a wrong figure, not a crash,
  as the sign that it has not run.
- **`fintrack_dev` had 031 through 034 applied and 035 not, before the run recorded below.** Read on 2026-09-08
  on Carlos's instruction, read-only, against the database the connection
  reported as `fintrack_dev` at `::1:5432`. The ledger holds 35 rows ending at
  `034_add_account_closed_at.sql`, executed 2026-09-07. The schema agrees: the
  `boundary` row is in `account_types`, `account-closure` is in `movement_types`,
  `user_accounts.account_type_id` reports `is_nullable = NO`,
  `user_accounts.closed_at` exists, and `to_regclass('public.account_registry')`
  is NULL.
- **035's conditional precondition is satisfied there.**
  `to_regclass('public.budget_monthly_allocations')` returns the table, so the
  seventh key has something to repoint and the `to_regclass` branch at the top of
  035 takes the path that alters it.

### 035 is applied on the two local databases, and on nothing else

**Run on 2026-09-08 on Carlos's instruction**, *"aplica 035 contra base local y
contra una copia de la bd de produccion en local"*, with `DB_EXPECTED` naming
each destination and `db:state` read before and after each run. Production was
not reached and no connection was opened to it.

**Four local databases exist and only two were candidates.** The choice is the
whole answer to "a local copy of the production database", because the runner
applies every pending file rather than the one named.

| database | users / accounts / transactions | ledger before | what it is |
|---|---|---|---|
| `fintrack_dev` | 2 / 31 / 139 | 35 rows, 035 pending | the local development database |
| `fintrack_prod_rehearsal` | 1 / 99 / 780 | 35 rows plus the alignment row, 035 pending | the production dump with `supabase/001_production_alignment.sql` and the chain to 034 applied |
| `fintrack_prod_data` | 1 / 100 / 785 | **0 rows**, all 35 pending | the raw 2026-08-21 dump. Its schema exists and its ledger is empty, so `db:migrate` would attempt `001` against populated tables. Left untouched, and it is what makes the rehearsal reproducible |
| `fintrack_rehearsal` | 0 / 0 / 0 | 30 rows | an empty scaffold, not a copy of anything |

**Both runs applied exactly one file.** `035_create_account_registry.sql` was the
only pending entry on each; every earlier file was skipped by name.

**The measured effect, identical in shape on both.** `account_registry` holds one
row per live account — 31 on `fintrack_dev`, 99 on `fintrack_prod_rehearsal` —
and no row without an account, which is the expected reading while no account has
ever been closed. Seven foreign keys moved from `user_accounts` and
`category_budget_accounts` onto `account_registry`, all `RESTRICT`. Five remain
on `user_accounts`, all `CASCADE`, so the row is now deletable.

**Zero closed accounts on both, which is what makes the DOWN honest.**
`user_accounts.closed_at IS NOT NULL` counts 0 on each. Section 5 of the
migration states its DOWN is truthful only until the first `category_budget`
account is closed; that condition holds today on both databases.

**One key changed its delete action, not just its target.**
`debtor_accounts_selected_account_id_fkey` was `ON DELETE SET NULL` into
`user_accounts` and is now `RESTRICT` into `account_registry`. The migration
documents this as the sixth of six removing a cleanup rather than a refusal, and
the measurement confirms it happened.

**A twelfth referrer exists that 035 does not touch, and does not need to.**
`account_name_case_backup_013.account_name_case_backup_013_account_id_fkey`,
left by `013_normalize_category_budget_name_case.sql`, still points at
`user_accounts`. Section 4 of the migration says *"the only references left to it
are the four extension primary keys, which cascade"*; the count is five, not
four, and the conclusion survives because this one cascades too.

**The trigger was exercised, not assumed.** `trg_register_account_identity`
fires `AFTER INSERT ON user_accounts`, and until an account is created nothing
proves it. Probed on `fintrack_dev` inside a transaction that was rolled back:
the insert produced a matching `account_registry` row with the owner carried
across, and the counts afterwards are unchanged at 31 and 31. Only
`account_id` and `user_id` are written, so every other column of an open
account's registry row is NULL, which is why an identity read has to fall back
to `user_accounts` rather than replace it.

**The backend boots against the migrated schema.** `node src/index.js` on port
5078 reached *"Server running"* with the boot path reporting every table already
present and creating nothing, so the seven repointed keys do not collide with
`initDatabase.js`.

**The alignment script had no runner and its ledger row was typed by hand.**
`src/db/migrations/supabase/001_production_alignment.sql` exists on disk, and
nothing under `backend/src` or `backend/scripts` reads that path, applies it, or
writes the row `supabase/001_production_alignment.sql` that
`fintrack_prod_rehearsal` carries. This is a measured answer to the third open
decision in section 6, how a production run gets recorded: on the one database
where it has already happened, by hand.

### The whole production sequence, rehearsed from the raw dump

**Run on 2026-09-08 on Carlos's instruction**, after he authorised local database
scripts. `fintrack_prod_rehearsal_full` was created from `fintrack_prod_data`
with `CREATE DATABASE ... TEMPLATE`, which only reads the dump, and then taken
through the three steps a production run would be. `fintrack_prod_rehearsal` was
left alone so the earlier measurement survives.

| step | command | effect |
|---|---|---|
| 1 | `CREATE DATABASE fintrack_prod_rehearsal_full TEMPLATE fintrack_prod_data` | the 2026-08-21 dump: 0 ledger rows, 100 accounts, 785 transactions |
| 2 | `db:align` | the ledger goes to 17 rows and the schema to production-plus-alignment |
| 3 | `db:migrate` | 19 files: `013` first, then `018` through `035` |

**Nineteen files, not eighteen, and `013` is the first of them.** The alignment
stamps `001`-`012` and `014`-`017` and leaves `013` out on purpose, so
`runMigrations` runs `013_normalize_category_budget_name_case.sql` immediately
after it. That is why `account_name_case_backup_013` exists on a rehearsed copy
even though the alignment's header lists it as chain-only: the header measured
the state after step 2, and step 3 changes it.

**The sequence from zero reproduces the copy built incrementally, exactly.**
`fintrack_prod_rehearsal_full` against `fintrack_prod_rehearsal`: 205 columns,
113 constraints, 46 indexes and 2 triggers, identical on every one, and the same
99 accounts, 780 transactions, 94 category budgets and 94 allocations.

**`fintrack_dev` is not a model of production's schema, and the difference is
three tables.** `budget_policies`, `budget_policy_allocations` and
`budget_frequency_types` exist on `fintrack_dev` and on no production-shaped
database, because `fintrack_dev` ran `010_create_budget_tables.sql` before commit
`3b72371f` of 2026-08-12 removed those three `CREATE TABLE` statements from it.
Nothing on the request path reads any of the three: `budget_policies` and
`budget_policy_allocations` have zero references in `backend/src`, and
`budget_frequency_types` is read only by `initDatabase.js` and `populateDB.js`,
which never run on the deployed backend. The difference is inert today and it is
still the reason a rehearsal has to be built from the dump rather than compared
against `fintrack_dev`.

**Everything else matches.** The only other difference is the one the alignment's
header already records: `user_roles`' CHECK renders as one cast per element on
the aligned copy and as `ARRAY[...]::text[]` on the chain-built one, and both
accept the same four strings.

#### The alignment is not idempotent once the chain has run on top

**Measured, and it is the sharpest answer the register has to the question of
what happens when a deployment fails halfway.** The file's header says
*"Idempotent throughout: every step is guarded, so re-running changes nothing"*.
A second `db:align` on `fintrack_prod_rehearsal_full`, after the chain had
reached 035, returned `transactions_account_id_fkey`,
`transactions_source_account_id_fkey` and
`transactions_destination_account_id_fkey` to `user_accounts`. Three of 035's
seven repoints undone; the fourth key on the same table,
`transactions_opening_for_account_id_fkey`, stayed on `account_registry` because
step 8 does not name it. No statement failed and nothing in the output said
anything had changed.

**What it costs is capability, not data, and that decides how fast anyone has to
act.** Step 8 restores the three keys as `ON DELETE RESTRICT ON UPDATE CASCADE`,
so no transaction row is ever cascade-deleted; the `ON DELETE CASCADE` spellings
further down the file are inside its commented DOWN block and do not run. The
regression is that `user_accounts` gains three refusing references again, so
CLOSE stops being able to delete the row and the account stops being closable.
`account_registry` and its rows are untouched by step 8, so every read over the
registry keeps working. Measured by the Overview session in the file and
confirmed against this session's own constraint diff, which already reported
`ON DELETE RESTRICT`.

**Step 8 is an unconditional `DROP CONSTRAINT` then `ADD CONSTRAINT`**, and it is
right that way for the run it was written for: production's `transactions` table
already existed, so the `RESTRICT` rule declared inside `CREATE TABLE IF NOT
EXISTS` never arrived and only an `ALTER` could deliver it.

**The hazard was created by writing the runner, and the runner is what closes
it.** Until `db:align` existed the file could only be applied by hand, and on the
live database step 8 was added five days after the file ran, so it never executed
from there. `db:align` now refuses when the ledger already carries the alignment
row and says why. The rehearsal database was rebuilt from the dump afterwards and
matches again.

---

## 5. What changed underneath the chain while it waited

- **The catalog row 032 adds now has no writer.** `movement_type_id` 10,
  `account-closure`, was written by `recordClosureSettlement`, and CLOSE stopped
  moving money on `feat/deletion` at `782d9834`: the import and the call are
  commented and no other executable reference remains. The catalog row is
  harmless and the INSERT stays. **032's header argues in the future tense**,
  *"the day the settlement writer starts producing type 10"*, and that day is
  cancelled rather than pending. The file is not amended for it: an applied
  migration's text records what ran, not what is current.
- **Measured 2026-09-08: the row exists on three databases and is used on
  none.** `movement_type_id` 10 is in `movement_types` on `fintrack_dev`,
  `fintrack_prod_rehearsal` and `fintrack_prod_rehearsal_full`, and the count of
  `transactions` carrying it is 0 on each.
- **The writer exists and is live code with no caller, which is not the same as
  absent.** This session first reported that nothing under `backend/src` inserts
  the type, and that was wrong: `recordClosureSettlement.js` carries an
  uncommented `INSERT INTO transactions` writing it, and its own header says
  *"RETIRED 2026-09-08. This whole module wrote CLOSE's settlement pair"*. What
  it lacks is a caller — the import at `deleteAccountService.js:35` and the call
  at `:1000` are both commented. The first report searched for the literal `10`
  and the string `'account-closure'`, and the code names the value:
  `export const ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID = 10` in `derivedBalance.js`,
  under a comment stating the idiom is *"a named export, never an inlined
  literal"*. A search for a value cannot find it where the codebase has agreed
  never to write it.
- **The row has two live readers, so it is not dead weight.**
  `overviewInvestmentRepository.js` matches it twice, once alone as the
  investment card's closure adjustment and once beside the P/L type. Dropping the
  catalog row would leave two live predicates matching a value the catalog no
  longer admits.
- **So the open decision is not the migration's.** It is whether the investment
  card should still account for a closure type nothing writes, which is Overview's
  question before it is a schema question. Corrected by the deletion session, who
  own the writer; the row counts above are this session's and stand.
- **035 was corrected twice before ever being applied**, in
  `fix(db): 035 trigger fires after and fails loud`. The identity trigger moved
  from `BEFORE INSERT` to `AFTER INSERT`, and the `ON CONFLICT (account_id) DO
  NOTHING` inside it was removed so a reissued account id raises instead of
  silently binding a new account to an older account's closure stamp. Both
  hazards are latent, not live: no writer of `user_accounts` carries a conflict
  clause, and the `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` in
  `initDatabase.js` sits behind `tableActions.isTruncate`, a literal `false`
  assigned nowhere else in `backend/src`.
- **The corrected 035 travels by one route only.** It is on `feat/deletion`,
  cherry-picked with the amendment `docs(db): 035 names the flag that disables
  the truncate` on top. `feat/backdating` holds the same change and is parked,
  because `git merge-tree` between the two branches reports a conflict on that
  one file. `main` still carries the uncorrected version.

---

## 6. Open decisions — none of these has an answer yet

These are Carlos's, and no session should answer them by inference.

| # | question | why it cannot be answered from the code |
|---|---|---|
| 1 | Which runner applies 031-035 | `db:migrate` exists and no deploy step calls it; both existing callers build or compare throwaway databases |
| 2 | In what order, relative to the code deploy | The deploy branch holds none of these files and nothing `main` does not, so code and schema currently move on separate schedules with no defined relation |
| 3 | How an execution is recorded | `runMigrations.js` registers file names in the `migrations` table without a checksum, so an edited file is neither re-executed nor detected |
| 4 | What happens when one fails midway | Migrations `001`-`007` carry their own `BEGIN`/`COMMIT`, which closes the runner's transaction early: if migration N+1 fails, N is already committed |

**A fifth question is unanswerable without reading a production database:**
whether `013_normalize_category_budget_name_case.sql` ran there on 2026-08-27.
That read is Carlos's alone; the 2026-09-08 reading covers `fintrack_dev` only,
where 013 is recorded as executed on 2026-08-08. Migrations to production are
stopped until these processes are defined.

### Question 3 has a measured instance, not just a risk

The `fintrack_dev` ledger carries `012_backfill_budget_policies.sql`, executed
2026-08-08. **No such file exists** — `sql_migrations` holds
`012_backfill_budget_allocations.sql`, and that one is recorded separately,
executed 2026-08-15. A migration was renamed or replaced after it had run, and
because the runner keys on the file name and stores no checksum, the successor
was treated as a migration nobody had applied and ran on the same database. This
is the abstract risk in question 3 with a date on it.

Two further readings from the same ledger, recorded because they are visible and
unexplained rather than because they are known to matter: the `id` sequence skips
18, between `016` and `017`, which is what a deleted row or a rolled-back insert
leaves behind — every migration file carries a commented
`DELETE FROM migrations WHERE filename = ...` in its DOWN section, so a deletion
is the likelier of the two; and `026` is recorded before `025`, which the runner
allows because each run only considers files the ledger does not already name.

### The freeze is a decision, not something the code enforces

Measured 2026-09-08 across the four database scripts. Two refuse to run under
`NODE_ENV=production` and two do not, and the split does not fall where it would
be useful:

| script | guard | live |
|---|---|---|
| `db:migrate`, `runMigrations.js` | `if (isProduction())` with *"Migrations are not allowed in production"* | **no** — it sits inside the block comment opened at line 14 and closed at line 28, headed *"Alternative using dbMigrationConfig.js"*. The one live `isProduction()` call refuses only the `DB_NAME` override |
| `db:seed:base` / `db:seed:admin`, `runSeeds.js` | the same guard | **no** — same shape, inside the comment opened at line 37 and closed at line 50 |
| `db:bootstrap`, `bootstrapping.js` | `if (isProduction())` at line 34 | yes |
| `db:reset`, `runResetDb.js` | `NODE_ENV === 'production'` at lines 48 and 141 | yes |

So the two scripts that create or drop a whole database refuse, and the two that
write into an existing one do not — and `db:migrate` is the one the freeze is
about.

**The synthesis, measured by the deletion session: every guard that exists tests
`NODE_ENV`, and `NODE_ENV` does not select the database.** `dbEnvironmentConfig.js`
declares `development` and `production` with identical bodies, both
`connectionString: process.env.DATABASE_URI`. A run with `NODE_ENV` unset or set
to `development`, pointed at a production `DATABASE_URI`, passes every live guard
and reaches production. The guards are blind to the case that matters because the
variable they read is not the variable that decides the destination.

**Closed on 2026-09-08, on Carlos's instruction, in `feat(db): guard the
destination, not the mode`.** `assertExpectedDatabase` asks the open connection
what it reached, with `current_database()`, and refuses unless `DB_EXPECTED`
names it; an absent `DB_EXPECTED` is also a refusal, and the refusal prints the
database it reached so naming it takes one step. It reads no secret and prints no
connection string. Both runners call it before their first write — before the
ledger `CREATE TABLE` in one, before `BEGIN` in the other — and the `NODE_ENV`
test is kept beside it as an independent second refusal.

**The two callers that spawn the runner now declare their destination**, because
they are the ones that know it: `bootstrapping.js` passes the name of the
database it created three steps earlier, and `schemaParity.js` passes `CHAIN_DB`,
the only database its spawn can reach. Restoring the commented guard was never an
option: the block is an abandoned alternative implementation that re-imports
`pc` and `getDbConfig` already imported live and pulls from `'../dbConfig.js'`, a
path that does not exist, so it breaks the module at import time.

---

## 7. What this document is not

It is not a schedule and it does not ask for the migrations to be applied. The
035 gap in the boot path is deliberate and stays open until its stated condition
is met; treating it as an urgent task is the specific outcome Carlos ruled
against on 2026-09-08: *"no permitir que el hueco del 035 se convierta en una
tarea urgente artificial."*
