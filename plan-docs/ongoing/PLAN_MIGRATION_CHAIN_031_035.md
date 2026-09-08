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
branch is at `20de666d`, dated 2026-09-06, and `main` is **202 commits ahead of
it with none behind**. Its highest migration file is
`030_add_jpy_currency.sql`: none of the five files in section 1 exist on the
branch Vercel builds. Merging any of this work into `main` therefore changes
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
  statements that name those constraints. The first half of block 3 is committed
  at `9b859c0e` and writes nothing that needs the registry.
- **035 carries one conditional precondition.** Its seventh key alters
  `budget_monthly_allocations`, which does not exist on a database that ran
  `010_create_budget_tables.sql` before commit `3b72371f` rewrote it. The
  `to_regclass` check at the top of 035 is what decides this, and it must be run
  first.
- **Nothing blocks 031 through 034.** They have runtime counterparts, they are
  independent of the registry, and no code waits on them.

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
| 2 | In what order, relative to the code deploy | The deploy branch is 202 commits behind `main` and holds none of these files, so code and schema currently move on separate schedules with no defined relation |
| 3 | How an execution is recorded | `runMigrations.js` registers file names in the `migrations` table without a checksum, so an edited file is neither re-executed nor detected |
| 4 | What happens when one fails midway | Migrations `001`-`007` carry their own `BEGIN`/`COMMIT`, which closes the runner's transaction early: if migration N+1 fails, N is already committed |

**A fifth question is unanswerable without reading a production database:**
whether `013_normalize_category_budget_name_case.sql` ran there on 2026-08-27.
That read is Carlos's alone. Migrations to production are stopped until these
processes are defined.

---

## 7. What this document is not

It is not a schedule and it does not ask for the migrations to be applied. The
035 gap in the boot path is deliberate and stays open until its stated condition
is met; treating it as an urgent task is the specific outcome Carlos ruled
against on 2026-09-08: *"no permitir que el hueco del 035 se convierta en una
tarea urgente artificial."*
