# The retired pocket account type — audit of the state after the removals

Read-only audit, 2026-08-30. Nothing was modified. Every database statement ran
inside a read-only transaction.

**What this audit measures against:** a pocket is a planning object. It is not an
account, it has no balance of its own, and it does not take part in transfers.
The money stays in real accounts, and commitments are recorded through the
relation between a pocket and an account.

**The database read** is the development one, `fintrack_dev` on `localhost:5432`,
which is what the backend's own environment points at (`NODE_ENV=development`).
Production was **not** connected to, and every statement about it in this
document is quoted from a tracked source, never measured here.

**What was excluded from the reading.** Another session is mid-change in the same
tree, replacing the per-row stored balance with a figure derived from the ledger.
It has modified the account detail endpoint and the account statement endpoint
and added a derivation helper. The chain audited below does **not** pass through
either: the accounting dashboard is served by the account *list* endpoint, which
that work has not touched. Its uncommitted state is work in progress and is not
reported as a defect.

---

## 1. The measured state of the database

| what was counted | in `fintrack_dev` |
| --- | --- |
| Accounts carrying the retired pocket type, live | **0** |
| Accounts carrying the retired pocket type, soft-deleted | **0** |
| Rows in the retired type's satellite table (`pocket_saving_accounts`) | **0** — the table still exists, empty |
| Rows in the new plan table (`pockets`) | **4** |
| Rows in the commitment ledger (`pocket_allocations`) | **0** |
| Transactions carrying the pocket movement type (`movement_type_id = 5`) | **0** |
| Debtors naming a retired-type account as their settlement account | **0** |
| Transactions pointing at an account row that no longer exists | **0** |

The migration that dismantled the model — the one that creates the two pocket
tables and deletes the accounts that impersonated pockets
(`020_create_pocket_tables.sql`) — is recorded in the migrations ledger as having
run on **2026-08-29 at 21:41:54Z**. The measurements above are the state it left.

The catalog row naming the retired type is still present, id 4, and the movement
type meaning "pocket" is still present, id 5. Both are deliberate: the migration
states in writing that it does not restate either, because every record written
before it carries those ids and rewriting the catalog silently rewrites the
meaning of that history.

### 1.1 The four surviving plan rows

All four predate the migration run, so all four are rows it copied — none was
created afterwards through the new module. The commitment ledger is empty, so
none of them has money committed to it.

| plan row | name | target | deadline | note |
| --- | --- | --- | --- | --- |
| 1 | `ahorro` | 5000.00 | 2026-09-10 | typed as 4500 at an identity rate |
| 2 | `pocket de prueba` | 0.89 | 2026-08-26 | typed as 2750 COP, rate from the Colombian central bank |
| 3 | `travels` | 25.50 | 2026-08-14 | typed as 80000 COP |
| 4 | `test` | 1.38 | 2026-08-15 | typed as 4324 COP |

### 1.2 The correspondence between a plan row and the account it came from is gone

**There is no join to prove.** The plan table carries fifteen columns and not one
of them references an account: no source account id, no origin column, nothing.
The correspondence the migration used ran the other way and only during the copy
— the satellite table is keyed by the account's own primary key
(`pocket_saving_accounts.account_id` references `user_accounts.account_id`), and
the copy read through it and wrote nothing back.

So the trace survives only as two fields the migration copied verbatim from the
account: the name, and the creation timestamp. That is a correspondence you can
assert but cannot verify, because the other side of it has been physically
deleted — the account rows by an unconditional delete, their satellite rows by
the cascade that hangs off them.

No pre-migration export of the development database exists to recover it from.
The only dump in the repository predates a much earlier migration
(`fintrack_dev_pre_010_20260731.dump`, taken 2026-07-31, before three of the four
pockets were created), and the loose SQL backup at the repository root is from
April and belongs to a different user account entirely.

**This is a finding, not a fault of the migration.** The migration warned about
exactly this: its own reversal section instructs the owner to export the
accounts, their satellite rows and the affected transactions *before* running it,
and says plainly that the export is the only reversal those steps have. On this
database that export was not taken. The four plan rows are correct and complete
as plans; what cannot be reconstructed is which account each one used to be.

---

## 2. The chain from the database to the accounting dashboard

```
 user_accounts (every type, no filter)
  -> GET /api/fintrack/account/allAccounts
   -> getAccounts (getAccountController.js:484)
    -> the client's account-list URL (urlConfig.ts:113)
     -> the dashboard's single fetch (AccountingDashboard.tsx:189)
      -> the grouping function (AccountingDashboard.tsx:80)
       -> a group heading and a card per row
```

### 2.1 The query is type-agnostic, and that is the whole answer

The statement that feeds the dashboard selects every account of the caller and
filters on exactly two things: the owner, and the account not being named
`slack`, which is the internal account every query in this app excludes by name.

**It does not filter by account type.** It never did. That is why rows of the
retired type appeared on that screen before — not because a tile invited them,
but because the endpoint hands over the whole inventory and the screen groups
whatever arrives.

**It also does not filter on the soft-deletion column.** A soft-deleted account
of *any* type is therefore listed on the accounting dashboard, and the client
does not filter it either. This is latent rather than visible today, because
there are zero soft-deleted accounts in this database. It is a separate defect
from the pocket question and is recorded here only because the same query is
where it lives.

### 2.2 Removing the tile did not make a row unreachable

The grouping function looks each row's type up in the tile map and, when it finds
nothing, drops the row into a **fallback bucket named "other"** which has its own
icon and heading. So a row of the retired type is still listed, still counted in
its group's total, and still opens its actions menu.

Its detail navigation resolves the same way: the route map is consulted by the
row's own type name and, finding no entry, falls back to the generic account
detail route (`AccountingDashboard.tsx:440`). The server still serves that
request for the retired type — the detail endpoint keeps a branch that joins the
satellite table (`getAccountController.js:674-684`) — so the page renders rather
than erroring.

**No row was orphaned.** The route entry that was deleted pointed at
`/fintrack/budget/pockets`, and no router entry serves that path: the module now
lives at `/fintrack/pocket` and `/fintrack/pocket/pockets/:pocketId`. That entry
was already dead before it was removed.

### 2.3 What the removal did leave behind, on the card itself

The group heading now reads **"Other"**, which is honest. The card inside it does
not, because the card's type label is built from the row's own type name and
never from the tile map:

```tsx
account_type={`(${capitalize(account.account_type_name.split('_')[0])})`}
```
`AccountingDashboard.tsx:625`

A row of the retired type renders on that card as **"(Pocket)"** — the exact noun
the frozen model forbids — under a heading that says "Other". The tile removal
could not have fixed this, because this label never came from the tile.

This is the one place where the removal is incomplete. It is incomplete in
labelling only; it destroys nothing and hides nothing.

> **CORRECTED 2026-08-30 — the card no longer builds its label from the row's own
> type name, so this defect is closed.** The snippet above is not what the file
> says today. `AccountingDashboard.tsx:622-632` now reads the label out of the
> same tile map that chose the group, falling back to the `other` entry:
> `account_type={`(${capitalize(ACCOUNT_TYPE_DATA[account.account_type_name as
> AccountType]?.name ?? ACCOUNT_TYPE_DATA['other'].name)})`}`. A row of an
> unknown type therefore reads **"(Other)"** on the card, matching its heading.
> The comment at `:625-629` records the defect this replaced. The paragraphs
> above are kept as the measurement that produced the fix.

---

## 3. Every remaining reference to the retired type

### 3.1 On the client — three, none of them load-bearing

| where | what it is | verdict |
| --- | --- | --- |
| `urlConfig.ts:72-75` | the endpoint URL that creates an account of the retired type | declared, **imported by nothing**; deliberate, per the commit that retired the type |
| `urlConfig.ts:251-254` | the comment distinguishing that URL from the pocket creation endpoint | deliberate; it is what stops the two being confused |
| `types.ts:211-215` | the closed union describing where a pocket's deadline came from | **now dead** — its only consumer was deleted with the accounts-by-type response; nothing imports it |

> **CORRECTED 2026-08-30 — all three rows are false; the client holds no
> reference to the retired type at all.** A grep for `pocket_saving` across
> `frontend/src` returns **nothing**, and a grep for `DesiredDateSourceType` or
> `desired_date_source` returns nothing either. Row by row:
>
> - **The creation URL is gone, declaration and all.** `urlConfig.ts:72-75` is
>   now a four-line comment recording the withdrawal — *"The declaration that
>   created an account of the retired pocket type is gone with the route behind
>   it"* — and points at `url_pocket_create`. There is no export there.
> - **`urlConfig.ts:251-254` no longer holds that comment.** Those lines are part
>   of the docblock over `url_pocket_create` (`:258`), which states that the
>   endpoint writing an account of the retired type is withdrawn, route and
>   handler both.
> - **The deadline-provenance union is deleted.** `types.ts:199-208` holds
>   `PocketsToRenderType` and nothing else pocket-shaped; no closed union of that
>   description exists anywhere under `frontend/src`.

A fourth reference is not to the retired type but to the pocket **movement** type:
the movement id-to-name map (`constants.ts:68-78`) still carries id 5 as
`pocket`. It mirrors the catalog row, which the migration keeps on purpose. It
must stay.

### 3.2 On the server — the one that matters is writable

| where | what it does | verdict |
| --- | --- | --- |
| `accountRoutes.js:58` and the creation controller (`accountCreationController.js:930-1330`) | **creates an account of the retired type**, inserting into both the accounts table and the satellite table | **load-bearing and live.** No client calls it, but the route is mounted and any holder of a token can reach it |
| `getAccountController.js:233-350` | the accounts-by-type endpoint accepts the retired type and joins the satellite table | reachable; returns an empty list today |
| `getAccountController.js:609,674-684` | the account detail endpoint's branch for the retired type | reachable; this is what makes a row of that type render through the fallback route |
| `accountEditController.js:90-101,311,344-349` | the account editor's branch for the retired type, and the deadline-provenance update on the satellite table | reachable only for a row of that type; unreachable today |
| `dashboardController.js:155,200-208,335,370-374,406,475,716,729` | balance-by-type, summary-by-type and movement-by-type all still accept the retired type and the pocket movement | reachable; the summary screen stopped calling them, the endpoints did not stop answering |
| `transactionController.js:157,159,630` | derives the pocket movement type when either side of a transfer is a retired-type account | unreachable from the client since the pocket left both transfer selectors; still live server-side |
| `movementInputHandler.js:58-66` | maps a pocket movement onto the retired account type | same |
| `getAccountDataById.js:33` | the valid-types list includes the retired type | guard only |
| `createTables.js:123-124` | creates the satellite table at runtime | **must stay.** Production is built through this path, and three endpoints still join that table |
| `populateDB.js:249` | seeds the catalog row for the retired type | **must stay.** Every historical record carries its id |

The two the developer named as deliberate are indeed deliberate. **One more is
load-bearing and was not on that list: the creation route.** The frontend cannot
call it because no module imports its URL, but the route is mounted, the catalog
row exists and the satellite table exists — so the request succeeds and writes a
brand-new row of the retired type into a database that has none. That row would
then appear on the accounting dashboard under "Other", labelled "(Pocket)".

> **CORRECTED 2026-08-30 — the creation route is withdrawn. The first row of the
> table above is false and so is this paragraph.** `accountRoutes.js:57-62` is a
> comment in place of the route, stating the reason: *"While this route stood,
> any token holder could still write a row of a type nothing is meant to create
> again, and every measurement of 'none left' had a shelf life."* The handler
> went with it — `accountCreationController.js:977-985` is the comment where
> `createPocketAccount` was, and the import at `:4` is commented out. There is no
> longer any way, from any client, to create a row of the retired type.
>
> The other rows of this table were re-measured and stand, with drifted anchors:
> the accounts-by-type branch is `getAccountController.js:270-370`, the detail
> branch `:631-641` and `:696-703`, the account editor's branch
> `accountEditController.js:90-101`, `:311`, `:344-349`, the movement derivation
> `transactionController.js:156`, `:158`, `:698`, and the by-type dashboard
> branches `dashboardController.js:161`, `:206-214`, `:266`, `:341`, `:376-380`,
> `:412`, `:481`, `:721`. `movementInputHandler.js` is at
> `utils/fintrackUtils/transactionManagement/`, and `getAccountDataById.js` at
> `utils/fintrackUtils/accountDataRetrieval/`.

The new pocket module itself is clean of the retired type. Its write path
restricts a funding source to a bank or cash account by name
(`pocketAllocationService.js:45,108`), so a retired-type row could not fund a
pocket even if one existed. Its account read is unfiltered by type, but it is
used only as a lookup keyed by rows that already exist in the commitment ledger,
never as a picker.

---

## 4. The line between data that needs migrating and code that must stop showing it

**Nothing in this database needs migrating.** There are no rows of the retired
type, live or soft-deleted; no satellite rows; no pocket movements; no debtor
pointing at one. The migration already did the data work and did it cleanly —
the recorded rehearsal shows money conserved to the cent, with 18.99 returned to
the two funding accounts and both legs of every movement deleted rather than only
the owning one.

**What remains is entirely code**, and it splits in two:

- **Code that must stop *writing* the retired type.** One item: the creation
 route and its controller. This is the only remaining way for a row of the
 retired type to come into existence, and while it stands, every "there are zero
 such rows" statement in this document has a shelf life.
 > **CORRECTED 2026-08-30: this item is done.** The route
 > (`accountRoutes.js:57-62`) and the handler
 > (`accountCreationController.js:977-985`) are both withdrawn, so nothing writes
 > the retired type any more and the zero counts above no longer have a shelf
 > life on the write side.
- **Code that must stop *reading and showing* the retired type.** The
 accounts-by-type branch, the detail branch, the editor branch, the dashboard
 branches, the transfer derivation, and finally the satellite table itself. None
 of it can destroy anything; all of it is code answering about rows that do not
 exist.

The satellite table is last, and only after the three endpoints that join it stop
joining it. The migration says so itself, and the reason is precise: dropping it
while they still join it breaks them on the day the migration runs.

---

## 5. Judgement

### 5.1 Was hiding the type from the accounting dashboard separable from deleting the rows?

**Yes, and it was correct on its own.** The two are independent in both
directions. Hiding a type changes what a screen draws and touches no row. The
rows were already gone — deleted by the migration the day before — so the
removal did not even need the separation it was entitled to.

It was **safe**: it deleted no data, changed no query, and removed no path a row
depends on. Every file it touched was a client-side type declaration, a tile map,
a route map or a seed constant.

It was **not quite complete**, in one respect and one only: the card still labels
a row of the retired type "(Pocket)" from the row's own type name. That is
cosmetic and it destroys nothing.

> **CORRECTED 2026-08-30: that one respect is closed.** The card reads its label
> from the tile map with an `other` fallback (`AccountingDashboard.tsx:622-632`),
> so an unknown type reads "(Other)" on the card as it already did on the
> heading.

**It left no row unreachable.** The fallback bucket catches an unknown type, the
fallback route resolves to the generic account detail, and the server still
serves that detail for the retired type. The route entry that was deleted pointed
at a path no router serves, so it could not have been anyone's way in.

### 5.2 Can any change already made, or any recommended here, destroy money, a transaction, or a real account?

**Of the changes already made: no.** All three commits are client-side removals
of type declarations, widgets, selector options and map entries. Not one of them
issues a statement against the database.

**Of the changes recommended below: no**, because none of them deletes a row.

**What a deletion of a retired-type row *would* do**, traced through the
constraints as they stand:

| what points at an account | on delete | consequence for a retired-type row |
| --- | --- | --- |
| Transactions, by owning account, by source, by destination | **RESTRICT** | The database **refuses** the delete. A row that owns or is a counterparty on any transaction cannot be silently destroyed |
| The commitment ledger, by source account | **RESTRICT** | Same refusal |
| The satellite table holding the target, the note, the deadline and six exchange-rate columns | **CASCADE** | **Destroyed silently, with no error and no trace.** This is the dangerous one |
| A debtor's settlement account | **SET NULL** | **Cleared silently.** The debtor stops naming a settlement account and nobody is told |

So the ledger protects itself and the goal does not. A hard delete of such a row
loses its target, its deadline and its exchange-rate audit trail without a word —
which is precisely why the migration copies before it deletes, and why it clears
the debtor pointer explicitly and counts it instead of letting the constraint do
it quietly.

### 5.3 The one row that is part of the ledger, and it is not in this database

**Stated loudly, because it is the case item nine exists for.**

A tracked record in this same folder (`POCKET_DECISIONS.md`, sections 17.2 and
19.10) reports that a **local copy of the production database holds one live
account of the retired type**: id 108, named `cash_loc_chinita`, **not**
soft-deleted, **carrying 90.00**, with a target of 420.00, a deadline of 1
January 2027, one satellite row, and **three transactions including a real
transfer of 90 from a cash account on 14 May — with no reversal**.

That row is not a stray record. It is part of the ledger, and its name says it is
a *cash location*, which is money that may genuinely sit there rather than being
earmarked in place.

This matters because the migration's licence to restore balances is conditional
and the condition is written into the file: it restores every pocket movement it
finds, and it is allowed to do so **only** because the owner confirmed that no
pocket ever held money that had left its funding account. A cash location is
exactly the case that confirmation excludes. Against that row as written, the
migration copies the goal, returns the 90, deletes the three transactions and
deletes the account — leaving the plan with nothing committed to it, so the goal
survives and the commitment is lost.

**Three things about this are unsettled and this audit cannot settle any of
them,** because it read the development database and did not connect to
production:

- whether the live production database still matches that copy, or whether the
 row was deleted there afterwards;
- whether the live production database has the owner-timezone column the
 migration's copy step depends on — without it the migration aborts at that step,
 which is what happened against the copy;
- whether the one-shot production alignment file has run at all, which the
 repository's own documents openly disagree about.

The migration's own header claims production held zero of everything as of
2026-08-24. The later record contradicts it from a copy. **Both cannot be true,
and only a connection to production decides which is.**

---

## 6. Recommendation for the next commit

**One commit, client-side and server-side, that closes the only way a new row of
the retired type can be created, and finishes the labelling the tile removal
started.**

What it **must** do:

- Withdraw the creation route for the retired type and the controller behind it.
 This is the substance of the commit. While that route is mounted, the retired
 type is not retired — it is merely unused by the current client.
- Remove the now-unused client-side URL for it, and the comment that exists only
 to distinguish it from the pocket creation endpoint. Both lose their reason to
 exist in the same moment the route does.
- Stop the accounting dashboard's card labelling a row by its own raw type name,
 so an unknown type reads as "Other" on the card as it already does on the
 heading. One line (`AccountingDashboard.tsx:625`).
- Remove the deadline-provenance union on the client, which has had no consumer
 since its response type was deleted.

> **MARKED 2026-08-30 — the premise of this recommendation has ceased; the unit
> needs a fresh decision rather than execution.**
>
> **What the passage asserts:** that a next commit still has to withdraw the
> creation route for the retired type and its controller, remove the client-side
> URL and the comment beside it, stop the accounting dashboard's card labelling a
> row by its raw type name, and delete the deadline-provenance union.
>
> **What the code actually says:** all four are already done. The route is a
> comment at `accountRoutes.js:57-62` and the handler a comment at
> `accountCreationController.js:977-985`; `urlConfig.ts:72-75` is the note where
> the URL was; `AccountingDashboard.tsx:622-632` labels from the tile map with an
> `other` fallback; and a repository-wide grep for `pocket_saving`,
> `DesiredDateSourceType` and `desired_date_source` under `frontend/src` returns
> nothing.
>
> **What now needs deciding:** the commit this section recommends has no content
> left, so the open question is whether the *later* commit it defers — the read
> branches that join the satellite table, and the table itself — is now the next
> one, and that still turns on the production question at §5.3, which is
> unanswered. Nothing here is struck: the constraints in *What it must NOT do*
> below still bind whoever takes that later commit.

What it **must NOT** do:

- **It must not delete any row, in any table, in any environment.** There are no
 rows of the retired type in the development database and there may be one in
 production that is part of the ledger.
- **It must not drop the satellite table**, and must not remove the runtime
 creation of it. Three endpoints still join it and production is built through
 that path.
- **It must not remove the catalog row for the retired account type, nor the one
 for the pocket movement type**, on the client or the server. Historical records
 carry both ids and restating a catalog restates the meaning of everything
 written under it.
- **It must not touch the account list endpoint's query.** That query is the
 dashboard's chain and it is correct for this purpose; its missing soft-deletion
 filter is a real but separate defect, and a session is currently changing how
 balances are produced in neighbouring endpoints.
- **It must not be accompanied by a migration.** There is nothing to migrate here
 and the production question is open.

**What must happen before any migration is written**, and it is one question, not
a task: establish whether the live production database still holds that 90.00
cash-location row typed as a pocket. If it does, the decision already recommended
in the pocket decisions record — that the conversion write one commitment row of
90 from the cash account rather than leaving the plan at zero — has to be settled
and built into the file before it runs, because there are no corrective
migrations here. If the row is gone from production, the question closes itself.

**The removal of the satellite table, and of the read branches that join it, is a
later commit**, after the endpoints stop joining it and after the production
question is answered.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

This audit was written earlier the same day, before the commit that withdrew the
creation route and before the accounting dashboard's card label was repointed.
Five passages were corrected in place and one work unit was marked rather than
struck. Nothing else was changed, and no decision was touched.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the card labelling a row of the retired type "(Pocket)" from its own type name | §2.3, and again in §5.1 | `AccountingDashboard.tsx:622-632` reads the label from the tile map with an `other` fallback |
| the three surviving client-side references — the creation URL, its comment, the deadline-provenance union | §3.1 table | none of the three exists; `pocket_saving` appears nowhere under `frontend/src` |
| the creation route as "load-bearing and live" | §3.2 table, first row, and the paragraph under it | withdrawn: `accountRoutes.js:57-62` and `accountCreationController.js:977-985` |
| "code that must stop writing the retired type — one item" | §4, first bullet | that item is done |
| the anchors of the surviving server-side references | §3.2 table | drifted, re-stated in the correction block under that table; every claim of reachability still holds |
| the recommended next commit | §6 | **marked, not struck.** All four of its clauses are already implemented, so the unit needs a fresh decision — recorded in the block above the *must NOT* list |
