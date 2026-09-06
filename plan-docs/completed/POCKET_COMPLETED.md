# COMPLETED — Pocket, the savings-commitment module

> ## ✅ COMPLETED — closed 2026-09-06
>
> Pocket replaced the retired `pocket_saving` account type with a commitment
> model. The module is built, merged and reachable in production. **The three
> items in "What was not built" below are the only work this document leaves
> open, and each one says who owns it.**

**Status:** Delivered. Verified against the working tree on `main`, 2026-09-06 —
every figure in this document was read out of the code on that date, not copied
from the plan.
**Branch:** `feat/pocket`, fully merged. `git rev-list --left-right --count main...feat/pocket` returns `502 0`.
**Volume:** 146 commits, concentrated between 2026-08-29 and 2026-09-05.

---

## 1. What Pocket is

A pocket is a **savings goal with a deadline**, funded by committing money that
stays where it is. Committing does not move money and writes no transaction: the
cash remains in the bank account it was already in, and the pocket records a
claim on it.

That single sentence is the whole model, and it is what the retired design got
wrong. Under `pocket_saving` a pocket was an *account*, so funding it was a
transfer — money left the bank account, the ledger recorded a movement that
never happened in the world, and deleting the pocket destroyed the goal through
a cascade with no error and no trace.

The consequence that every other rule descends from: **an account's committed
total is still inside its balance.** The allocation guard is the proof — it
computes the ceiling as the balance minus what is already committed
(`pocketAllocationService.js:345-347`), a subtraction that is only meaningful if
the committed money is still in the figure being subtracted from. The model
states it in words at `makeAccountAllocation.js:15-17`: the available balance
remains the whole account balance, because a pocket never blocks a spend, and
calling the remainder "available" would tell the owner they cannot spend money
they can.

The remainder is named `unassignedCash`, never *available*. It may be negative,
and that is a state rather than an error: an expense that spends committed money
is always accepted, and the account then reports that it no longer covers what is
committed to it. The shortfall is reported on the account and never split across
the pockets drawing on it, because any such split needs a policy the app would
have to invent.

---

## 2. The data model

Migration `020_create_pocket_tables.sql` creates two tables and deletes the old
model in five ordered steps. The order is a correctness requirement: every
pocket account is copied into `pockets` (step 2) before anything is deleted.

### `pockets`

`pocket_id`, `user_id`, `name` (50), `note` (155), `target_amount`
(`CHECK > 0`), `currency_id`, `desired_date`, plus the six-column FX audit pair
— `original_target`, `original_currency_id`, `exchange_rate`,
`exchange_rate_source`, `exchange_rate_timestamp`,
`exchange_rate_target_currency_id` — and `created_at` / `updated_at`.

The FX pair records what the owner typed, in which currency, and the rate between
that and the stored figure. The stored target is always in the accounting
currency; the typed currency is origin metadata only.

### `pocket_allocations` — the ledger

`allocation_id`, `user_id`, `pocket_id`, `source_account_id`, `amount`
(`CHECK <> 0`), `allocation_actual_date`, the same six FX columns, and
`created_at`.

Four properties of this table were decided rather than inherited, and each one
is load-bearing:

- **`amount` is signed and the table is append-only.** A release is a negative
  row. A commitment of 300 becomes 250 by writing −50. No repository has an
  `UPDATE` or a `DELETE` path on it. `CHECK (amount <> 0)` because a zero row
  states nothing and would appear in the history as an event that did not happen.
- **`allocation_actual_date` is not `created_at`, and both are needed.** The
  first records when the decision was taken, the second when the row was written;
  a set-aside agreed on Friday and typed on Monday belongs to Friday. This copies
  the convention `transactions` already uses (`003_transactions.sql:55-56`), NOT
  NULL where the original is nullable. Every screen renders this date.
- **One accounting amount, not two.** Every account is kept in the one accounting
  currency, so the pocket's total and the account's total read the same column in
  the same unit. A second stored amount would be derivable from the first and the
  rate, and the first rounding disagreement between them would produce a pocket
  whose sources do not sum to its own total.
- **The two delete rules differ on purpose.** `pocket_id` cascades, because an
  allocation is the pocket's own row and destroying it destroys no financial fact
  — no allocation ever moved money. `source_account_id` RESTRICTs, the choice
  `014`, `016` and `017` made for every reference that carries meaning: deleting
  an account is a decision taken in a service with an impact report, never a
  silent side effect of a constraint. `pocket_saving_accounts` is the
  counter-example, and its cascade is exactly what made the retired deletion
  destroy a goal silently.

### The four migrations

| migration | what it does |
|---|---|
| `015_pocket_target_fx_columns.sql` | the FX audit columns on the target |
| `019_pocket_desired_date_source.sql` | the source of the desired date |
| `020_create_pocket_tables.sql` | the two tables; copies, then deletes the retired model |
| `029_pocket_board_month_indexes.sql` | `idx_pocket_allocations_pocket_date`, `idx_pockets_user_created` |

`020` deletes, in order: the transactions on pocket accounts (step 4), the
debtor references pointing at a pocket — cleared and counted rather than let a
`SET NULL` constraint erase them silently — and then the accounts themselves
(step 5b, `DELETE FROM user_accounts` joined to `account_types` on
`pocket_saving`).

---

## 3. The API contract — seven endpoints

Mounted under `/api/fintrack/pocket`, inside the guard `app.js` already applies.
Every handler resolves identity from the token; no route accepts a user id from
the client.

| method and path | body | what it is |
|---|---|---|
| `GET /board` | — | every pocket the caller owns. The header totals and the list are read from this one answer, so they cannot disagree |
| `GET /:pocketId` | — | the whole detail screen: hero, source breakdown and allocation history are three views of the same rows |
| `POST /` | `name, note?, targetAmount, currency, desiredDate` | creates an empty pocket. No source account and no money |
| `PATCH /:pocketId` | the same fields, all optional | target and date together, because they are one decision. The pocket's own currency is not editable |
| `POST /:pocketId/allocations` | `sourceAccountId, amount, currency, allocationDate?` | commit. Always a positive amount; the ceiling is the source's unassigned cash, checked inside the row lock |
| `POST /:pocketId/releases` | the same body | release. Positive amount again, written negative on the server. The ceiling is what this pocket holds *from that one account* |
| `DELETE /:pocketId` | — | never refused for a non-zero net: the cash was only ever committed, so it stops being committed. The answer names each source account and the amount that returns to its unassigned cash |

`/board` is declared before `/:pocketId`, which would otherwise match the literal
`board` and send it to a parameter expecting an id.

---

## 4. The seven levels

One classifier, `pocketLevel.js`, evaluated top down — which is what makes the
levels mutually exclusive by construction rather than by a rule written in a
comment. It lives on the server for the same reason the board's counts do: a
level the client derives from the same row is a second answer to the same
question, and a header disagreeing with the card under it is a defect this module
already had once.

**The criterion is progress against the plan's own line, never nearness to the
deadline.** The retired thirty-day threshold treated a three-month plan and a
five-year plan identically, and the question the owner asks is not how long is
left but whether the goal can still be covered.

Evaluation order: `aboveTarget`, `completed`, `overdue`, then — for a plan with a
window — `atRisk` at a required pace of twice the plan's own or more, `behind`
above the tolerance band, `ahead` below it when the signed money agrees, and
`onTrack` otherwise. A plan with no window publishes no line and reads `onTrack`.

Two rulings inside it are worth restating because both were reached by
measurement:

- **On track is a band, not a point** (±0.05 on the ratio, ruled 2026-09-04). The
  instalment is a division that rarely terminates — 12,000 over eleven months is
  1,090.909… — so exact equality is reached by almost no pocket after its first
  month, and splitting at the point would define a level that never fires. The
  tolerance is expressed on the ratio rather than on a sum of money, deliberately:
  a ratio tolerance is worth more money early in a plan and less late in it, which
  is the property the ratio was chosen for. It is symmetric, because a pocket two
  hundredths over its line is meeting the plan exactly as much as one two
  hundredths under; the asymmetry belongs in the colour, not the boundary.
- **Below the band, the signed money decides between `ahead` and `behind`** (ruled
  2026-09-04). The two can disagree, and the money is the one telling the truth: a
  pocket can reach a low ratio while standing short of its own line, and `ahead`
  would then print over a card reading "180.00 behind the plan".

The reading order the board reports in is not the evaluation order:
`completed`, `aboveTarget`, `ahead`, `onTrack`, `behind`, `atRisk`, `overdue` —
exported as `POCKET_LEVELS` so every consumer shares one list instead of two
literals that drift apart.

---

## 5. What was built

**Backend — 21 files.** Controller and routes; six core calculators
(`makeAccountAllocation`, `makeAllocationEntry`, `makePocketStatus`,
`planSchedule`, `pocketLevel`); two repositories (`pocketRepository`,
`accountAllocationRepository`); five services (`accountAllocationService`,
`pocketAllocationService`, `pocketBoardService`, `pocketDetailService`,
`pocketWriteService`); the deadline utility; the zod validators; and
`overviewPocketService` on the Overview side.

**Frontend — 30 files.** The board (`Pocket.tsx`, `PocketLayout.tsx`,
`ListPocket.tsx`, `PocketBigBoxResult.tsx`, `PocketCard.tsx`,
`PocketToolbar.tsx`, `PocketFundingAccounts.tsx`, `usePocketListFilter.ts`); the
detail (`PocketDetail.tsx`, `SummaryPocketDetailBox.tsx`, and four modals —
allocation entry, allocate/release with `PocketSourcePicker`, delete); the two
forms (`NewPocket`, `EditPocket`); the cross-module block
`AccountPocketCommitments.tsx`; the transport layer (`pocketApi.ts`,
`pocketTypes.ts`, `pocketStatus.ts`, two stores); and ten SVG assets.

### The nineteen units, final state

Re-measured 2026-09-06. Three rows had moved since the plan's last measurement
and are marked.

| unit | state |
|---|---|
| the broken dashboard route (0) | superseded — the tile and its route entry were deleted rather than repointed |
| the contract, URLs, HTTP client, stores (1-4) | landed |
| the fetch-state primitives (5) | **not landed.** No `skeleton/` or `emptyState/` under `general_components/` |
| the routes (6) | half — the fourth route slot exists; the layout reduction did not happen |
| the board (7) | landed, **but not under the plan's names.** See below |
| the detail (8) | landed, in place rather than on the shared cream box |
| the entry detail (9) | landed, by extraction over `general_components/fxPathwayCard/` |
| create (10) | landed, without `pocketSchemas.ts` and without `PocketModalShell` |
| the initial commitment (10b) | still gated — the create body schema is `.strict()` over five keys |
| edit (11) | landed. The account editor's pocket branch, its field list and its labels are all gone |
| allocate and release (12) | landed |
| delete (13) | landed |
| Account Detail (14) | **landed since the plan's last measurement.** `AccountPocketCommitments.tsx` mounts at `AccountDetail.tsx:279`, and `AccountListType` declares `allocated?` and `unassignedCash?` at `responseApiTypes.ts:357-364` |
| Overview, Transfer (15, 16) | landed — no pocket read on the overview, no pocket in either transfer selector |
| the legacy sweep (17) | **half.** See §6 |

**On unit 7: the plan asked for a split into `PocketSummary` / `PocketCard` /
`PocketBoardEmpty` and for `ListPocket.tsx` and `PocketBigBoxResult.tsx` to be
deleted. That is not what happened, and the outcome is not a leftover.** Both
files were rewritten in place and are the live board: `PocketBigBoxResult.tsx`
(1,031 lines) mounts at `PocketLayout.tsx:152` and exports `PocketBoardReadings`,
consumed by `Pocket.tsx:6`; `ListPocket.tsx` mounts at `Pocket.tsx:5`. The
byte-identical dead copy under `pages/budget/components/` **is** gone. Anyone
reading the plan's deletion column and acting on it would delete the working
board.

The toolbar landed whole (`PocketToolbar.tsx`): search capped at 50 characters,
three sort criteria, and **seven** filter chips rather than the five the plan
asked for — `All`, the five status levels, and coverage last, because coverage is
a different axis and not a sixth level. It owns no state; every value arrives as
a prop, and the matched-of-total counts come from `usePocketListFilter`, so
filtering changes what is listed and never what the hero reports. None of its
words are typed in the file: the level chips read the shared map, which is what
stops the board naming a level differently to the card beside it.

---

## 6. What was not built

Three items, and each one has an owner.

### 6.1 The retired account type is gone from the frontend and alive in the backend

`pocket_saving` appears in no file under `frontend/src` — the sweep is complete
there. In the backend it survives in three places: the catalog still seeds it
(`005_base_catalogs.sql:41`), `002_accounts.sql:191` still creates
`pocket_saving_accounts`, and **two Overview reads still point at it.**

**Those two reads need opposite treatments, and confusing them ships a defect.**

| read | what it feeds | what it needs |
|---|---|---|
| `getPocketAccountIds` (`overviewAccountRepository.js:207-209`) | the pocket term of net worth (`makeHeroSection.js:110-114`) and of the cash position (`:117`) | **deletion** |
| `SAVING_GOALS_QUERY` (`overviewPageRepository.js:70-81`) | the financial-goals widget: progress against target | **repointing to `pockets`** |

The first returns an empty set today, because `020` deleted every account of that
type, so the term is zero and the four-term formula returns the right number by
accident. **Repointing it would not fix it — it would break it.** The plan model
never moves money into an account of its own, so the committed total is already
inside the bank balance; adding it as a term counts the same money twice, in both
the hero and the cash position. Removal is the only correct answer, not the
tidier of two.

The second is not a term in any money identity — it is a progress reading, no
double count is possible, and it should read `pockets`. The file's own comment
already says so: *"It needs repointing to the plan model, not re-anchoring."*

**Owner:** the session holding Overview's backend and Pocket's backend. Ruled as
D54 in `OVERVIEW_DECISIONS.md`. The check on the way out is that the hero has
three terms and the cash position has one.

### 6.2 The fetch-state primitives were never extracted

No `skeleton/` or `emptyState/` under `general_components/`. The board's empty
state exists but lives inside the list (`ListPocket.tsx:192-201`), and the hero
has none of its own — with zero pockets and totals served it still paints the
equation and the partition at zero.

### 6.3 Which pocket most needs money is still unanswered

Two questions were conflated and only one is answered. The board's tile
announces a **next target**: drop the funded and the overdue, take the fewest
days remaining, ties to whoever arrived first (`PocketBigBoxResult.tsx:77-86`).
The question the owner actually asks is **which pocket most needs money**, and
nothing on screen answers it. The first is a poor stand-in: a pocket five days out
that is short five dollars outranks one twenty days out short two thousand, and
the second is the one to act on. Recorded as decision 20 in
`POCKET_DECISIONS.md`, still open.

---

## 7. Where the detail lives

This document is the record of what Pocket became. The reasoning behind each
ruling stays in `plan-docs/ongoing/PLAN_POCKET/`:

| document | what it holds |
|---|---|
| `POCKET_DECISIONS.md` | the decision register, 29 sections. Sections 21 through 29 carry the rulings of 2026-08-30 to 2026-09-04 that shaped the levels, the hero and the plan line |
| `POCKET_MODULE_SPEC.md` | the frozen V1 contract |
| `POCKET_CONTRACT_AUDIT.md` | the seven endpoints traced end to end, measured 2026-08-29 |
| `POCKET_LEVELS_REFERENCE.md` | the level scale — ruled, implemented and verified 2026-09-04 |
| `PLAN_POCKET_FE.md` | the frontend execution plan. **Its unit table is superseded by §5 above** |
| `POCKET_RETIRED_TYPE_AUDIT.md` | the inventory of what `pocket_saving` touched |
| `POCKET_SEQUENCE.md` | the commit sequence |

Five documents in that folder declare themselves superseded and name no
successor document — `POCKET_FE_INVENTORY.md`, `POCKET_FE_RECONCILIATION.md`
and `POCKET_DETAIL_SPEC.md` cite "the working tree" or "the code itself", which
is not a document. **This file is that successor.** With it written, those five
are obsolete by the standing definition — a document is obsolete when another
document records what was finally done, not when it stops being useful.

`POCKET_BACKEND_INVENTORY.md` was already obsolete on its own terms: its content
was absorbed by `POCKET_CONTRACT_AUDIT.md`.
