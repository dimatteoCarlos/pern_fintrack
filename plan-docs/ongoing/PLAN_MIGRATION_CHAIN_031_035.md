# PLAN_MIGRATION_CHAIN_031_035 — five migrations written, none applied

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
- **No session has read any database's `migrations` table.** Both peer sessions
  were asked on 2026-09-08 and both answered that they have not queried one, on
  `fintrack_dev` or anywhere else. The applied state of every database is
  therefore unknown to the repository, and the only evidence that the `boundary`
  type resolves on the development database is a code comment in
  `overviewAccountRepository.js` dated 2026-09-07 — which proves the type exists,
  not that 031 ran, because `populateDB.js` seeds the same catalog row on the
  boot path.

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
That read is Carlos's alone. Migrations to production are stopped until these
processes are defined.

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

**No session has fixed this and none should.** Adding a guard changes how a
production run behaves, which is Carlos's decision, and it would also require
knowing where `DATABASE_URI` points — which means reading `.env`. Not being able
to tell which database that variable names is the correct state for a session
here, not a gap to close.

---

## 7. What this document is not

It is not a schedule and it does not ask for the migrations to be applied. The
035 gap in the boot path is deliberate and stays open until its stated condition
is met; treating it as an urgent task is the specific outcome Carlos ruled
against on 2026-09-08: *"no permitir que el hueco del 035 se convierta en una
tarea urgente artificial."*
