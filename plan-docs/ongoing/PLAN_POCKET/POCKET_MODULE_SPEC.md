# POCKET MODULE — V1 SPECIFICATION

**Frozen 2026-08-23 · amended 2026-08-24** (§11.5 to §11.9 list what the
amendments changed). Branch: `feat/pocket`, after `feat/budget` is merged in.

This document is the contract. Where it disagrees with `../POCKET_DECISIONS.md`, this
one wins and the section below says which part of that plan it supersedes. Where
it disagrees with the code, the code is what has to change.

`plan-docs/ongoing/` is re-included by `.gitignore:123`, so this file is
versioned; it is the source the commits are written from.

---

## 0. What this replaces

| document | status |
|---|---|
| `POCKET_DECISIONS.md` §14 — the allocation model, frozen 2026-08-22 | **adopted whole.** This spec implements it |
| `POCKET_DECISIONS.md` §14.6 — `QP-18` marked provisional pending a screen | **resolved.** The source breakdown of §7.2 is that screen |
| `POCKET_DECISIONS.md` §10 — the hero of *Current Balance / Contributions / Withdrawals / Net Change* | **superseded.** Written for a pocket that held money; §7.1 replaces it |
| `POCKET_DECISIONS.md` §11 — the goal-revision argument | **accepted and deferred.** Its cost is recorded in `Q3`; its commits stay in that plan, after the module works |
| `POCKET_DECISIONS.md` §12 — the frozen indicator contract | **partially superseded.** Two of the four figures survive the change of meaning (`Q7`) |
| `POCKET_DECISIONS.md` §14.5 — *Investment as an allocation source: No* | **adopted unchanged** |

---

## 0bis. What is frozen, one line each

Written 2026-08-24 at the developer's request, as the digest of everything the
sections below argue. **It states decisions, never reasons** — every row points at
the section that carries the argument, and where the two disagree the section wins.

| concept | V1 decision | where |
|---|---|---|
| Pocket | a savings plan, not a place money is | §2.1 |
| Bank account | real money, ties to the statement | §2.2 |
| Pocket balance | **does not exist** | §2.3 |
| Allocation | a commitment over money that stays in the account | §2.1 |
| Does an allocation move money | no | §2.4 |
| Does Transfer manage pockets | no — pocket leaves both selectors | §7.4, §10.3 |
| Pocket to account | many to many | §3.2 |
| Several sources per pocket | yes | §3.2, §7.2 |
| Investment as a source | no — its balance is a market valuation | §4 |
| Allocate | from the pocket detail | §4 |
| Release | from the pocket detail, per source | §4 |
| Allocation ledger | append-only; no `PATCH`, no `DELETE` | §3.2 |
| Spending allocated money | never rejected | §2.4, §4 |
| Over-allocation | a state that is detected and reported | §2.5 |
| "Available" | not used for `balance − allocated` | §2.2 |
| `unassignedCash` | `balance − allocated`, may be negative | §2.2 |
| Target | required | §3.1 |
| Desired date | required — the date by which it must be covered | §11 `Q2` |
| Target and date history | not in V1 | §11 `Q3` |
| FX | yes, as capture of what was typed: the six-column audit pair | §11 `Q1` |
| Pocket transactions | do not exist | §7.2 |
| Pocket history | the allocation and release ledger | §7.2, §8.2 |
| Funded | derived: `allocated >= target` | §6 |
| Overdue | derived: past the date and `remaining > 0` | §6 |
| Pocket delete | hard delete, at any net | §11 `Q8` |
| Pocket close | not in V1 — delete replaces it | §11 `Q8` |
| Account delete with allocations | allowed; impact report first, rows deleted in the same transaction | §11.1 `Q8b` |
| Pocket in the overview | not as its own KPI | §11.2 `Q11`, §17 |
| Pocket in the account detail | yes — balance, allocated, unassigned | §7.3 |
| Savings account | still `bank`; out of scope for pocket V1 | §11.3 `Q12` |
| `pocket_saving` (catalog id 4) | kept, marked deprecated, never reused | §11.3 `Q12` |
| `pocket_saving_accounts` (the table) | rows die at `020` by cascade; the table is dropped in commit 24 | §9.1, §10.3 |
| The production 90.00 | returned to `CASH`; no allocation written | §9.1, §11.7 |

**In one sentence.** The account detail answers *how much money do I have and
where is it*; the pocket answers *what do I want to reserve part of it for, and how
far am I from that commitment*. Two simultaneous truths that are never mixed, and
§2.3 is the rule that keeps them apart: a pocket has no balance to mix in.

---

## 0ter. The questions the owner arrives with — RULED 2026-09-04

Written at the developer's request on 2026-09-04, after three exchanges in which
every served field could be named and none of them could be tied to a question
the owner was asking.

**This document specified what every figure IS and never what it ANSWERS.** §6
rules what each level may say, §7 lists what each screen shows, and the contract
audit traces every byte of the payload — and none of the three states why a
person opens this page. The consequence was concrete: `Target` reads *the sum of
the goals declared up to this month*, which is a correct definition and does not
say whether it is the figure the reader wanted. Without this section a new figure
is argued on whether it is computable, never on whether anyone needed it.

**The order is by what the owner does next.** A question that changes an action
this month outranks one that changes an opinion about the year. It is not the
order the screen renders in, and §7 is free to disagree with it for layout
reasons — but a question ranked here above another may not be the one that is
missing while the lower one is served.

### The scope premise — RULED 2026-09-04

**The board answers one question about a chosen month: how the owner's
commitment to their own allocations stands at its close.** The month's
commitment is the sum of everything that should have been saved to be on plan
**by** that month — the cumulative schedule, not the instalment of a single
month. Lifetime figures over the whole portfolio are the overview's, and they
leave this page as soon as the overview carries them.

The premise does not reorder the ranking below, which is ordered by what the
owner does next and stays defensible as such. What it settles is which question
owns the bar — the second — and which questions this page is only holding until
another module is built — the fourth.

### The ranking

| # | The question, in the owner's words | The figure that answers it | State |
|---|---|---|---|
| 1 | *How much do I have to put aside **this month**?* | `totalRequiredMonthly` | served — folded at `pocketBoardService.js:339-369` |
| 2 | *Am I where my own plans say I should be by now?* | `totalScheduledByNow`, `scheduledPocketsAllocated`, `scheduleAdherence`, `totalScheduleGap` | served — both sides of the shortfall are folded, not only the positive one (`pocketBoardService.js:339-369`) |
| 3 | *Which pocket needs money first?* | the row's `level`, and `levelCounts` in the header | served |
| 4 | *How far am I from everything I have promised myself?* | `totalTarget`, `totalAllocated`, `totalRemaining`, `overallProgress` | served — the hero's three tiles; the overview's question under the scope premise above |
| 5 | *Did I actually do anything this month?* | `totalCommittedInMonth`, `totalReleasedInMonth`, `totalMovedInMonth` | served, board-wide and unchanged — the hero prints the net over the pockets on a plan instead, a separate fold (§7.1) |
| 6 | *Where can I take money from without breaking a plan?* | `totalAheadOfPlan` with `levelCounts.ahead`, and `totalExcess` with `levelCounts.aboveTarget` | served — two distinct amounts, never added together |
| 7 | *Is the money I promised actually still in the accounts?* | the row's `uncovered`, `uncoveredCount` in the header | served |
| 8 | *What did this look like at the close of a past month?* | the month stepper and `meta.referenceMonth` | served |
| 9 | *Which accounts fund this pocket, and by how much?* | the sources table of the detail payload | served — on the detail, not on the board |

**The two questions at the top of the ranking are the two the board cannot
answer.** That is the finding this section exists to record: the module answers
every question about the *state* of the goals and neither of the two about the
*pace* of the owner, and pace is what a person opens a savings page to check.

### What follows from it

**A figure is added only after its question is written here.** A served field
that answers no question on this list is a field a screen has to invent a use
for, which is how `Target` came to be three different readings depending on who
was asked.

**The progress bar divides by the schedule — RULED 2026-09-04, reversing the
ruling taken earlier the same day.** The first ruling kept the lifetime target,
refusing a schedule denominator on the ground that the bar would stand at 100%
while the goal is 40% funded, and the bar is the one element on this page a
reader interprets without reading its label. That reasoning did not have the
scope premise above in front of it. A bar cannot mislead a reader about a figure
the page no longer claims to show, and adherence to the schedule is now the
page's whole subject.

The numerator is the committed amount of the pockets that have a plan window and
the denominator is what those same plans required by the selected close. Three
conditions come with the reversal, and the bar is wrong without them:

- **The label names its denominator and the month** — *of what your plans
  required by August 2026* — never the bare word *progress*. The hero and the
  cards then divide by different figures on purpose, and only the label keeps a
  reader from comparing them.
- **The fill clamps at 100% and the surplus prints as a sentence.** Committed
  passes the line by any amount; a clipped bar with no sentence loses how far
  ahead the owner stands.
- **The lifetime reading is not dropped from the product before the overview
  carries it.** The bar changes now; the hero's lifetime tiles stay until then.

**The sum of the targets whose deadline falls at or before the selected close is
NOT built — RULED 2026-09-04.** It was the third candidate reading of *the
accumulated target for this month*. It jumps from zero to a full target in the
month a deadline lands, so a twelve-month plan contributes nothing for eleven
months and everything in the twelfth: it measures deadlines passing, not saving
done. Question 1 above is what the owner meant, and its answer is a monthly pace.

### What this obliges

Nine fields enter the header fold (`makeSummary`), all of them folds over
fields already on the row — no query change and no migration:

| Field | What it holds |
|---|---|
| `totalScheduledByNow` | the sum of `scheduledByNow`: what the plans required **through the close of the selected month, that month included** (ruled 2026-09-04, decisions §28) |
| `scheduledPocketsAllocated` | the committed amount of those same pockets, printed beside what those plans required |
| `scheduleAdherence` | the share of what the plans required that is actually committed, **served as a percentage**, nullable and **not clamped** |
| `totalScheduleGap` | the sum of `aheadOfPlan`, **signed**: positive is slack held, negative is the shortfall |
| `totalRequiredMonthly` | the sum of `requiredMonthly`: what this month asks for |
| `scheduledPocketCount` | how many pockets have a plan window at all |
| `underScheduleCount` | how many of those pockets stand strictly below their own line (`aheadOfPlan < 0`), never null |
| `overScheduleCount` | how many stand at or above it (`aheadOfPlan >= 0`), never null |
| `scheduledPocketsMovedInMonth` | the net moved within the selected month across those same pockets, **signed** and nullable |

**The target carries its FX audit pair on the row — SHIPPED 2026-09-04.** Six
columns were written at creation and named by no `SELECT`, so what the owner
actually typed was audited and unreadable. Both reads carry them now, the board
row and the detail row, so no screen has to ask which one knows: `originalTarget`
and `originalCurrencyId` for what was typed and in which currency, and
`exchangeRate`, `exchangeRateSource`, `exchangeRateTimestamp` and
`exchangeRateTargetCurrencyId` for the conversion. **Addition only** — the
accounting `target` keeps its name and its meaning. No consumer reads them yet.

**The month's net gains a second figure and loses none — RULED 2026-09-04.** The
three board-wide movement figures already served — the net moved in the month,
the gross committed and the gross released — keep their meaning exactly and count
every pocket on the board. The ninth field above is a separate fold over the
pockets that hold a plan window, and it carries the same qualifier the other
schedule folds carry so that **the name states its population**. Narrowing the
existing net in place was considered and refused: changing a served field's
meaning under a name that does not state its scope forces every reader to be
re-verified, and the readers outside a repository search cannot be. Only the net
is scoped — no scoped gross halves ship, because nothing prints them — so the
two gross halves stay board-wide and **do not decompose the scoped net**.

**A pocket exactly on its line counts on the over side — RULED 2026-09-04.**
The negative test is strictly below zero, so a pocket that has committed
precisely what its plan asked for falls to the over side. The tie-break is not
cosmetic: with it the two counts partition the whole population of pockets that
have a plan window, so they always sum to `scheduledPocketCount`. A pocket with
no full calendar month in its window has no difference against a schedule at all
— that difference is null together with the other three schedule fields
(`planSchedule.js`, `planMonths < 1`) — and falls outside both counts, which is
the same exclusion the ratio and the amount it divides already make.

**Both counts are served and neither is subtracted on the client.** Both are
non-null on any board, an empty one included, and the percentage above is served
too: no arithmetic over this fold is left to the browser.

**The adherence percentage is a quotient of the two sums, never a fold of
per-pocket ratios — RULED 2026-09-04.** Clamping each pocket at one hundred
before summing discards the surplus held by every pocket standing over its own
line, so the folded figure would read lower than the two amounts printed beside
it on the same line, where the reader divides them by eye. A percentage that
contradicts the two numbers next to it is a worse defect than one above a
hundred. **The clamping happens at the bar's fill and nowhere else**, so a board
past its schedule shows a figure above one hundred over a full bar. It is not
called the progress of the schedule: that name carried the clamped-per-pocket
definition while it was disputed, and a name that has meant two things is how a
wrong implementation ships later. The lifetime progress figure is unaffected —
it divides by a target that cannot meaningfully be exceeded, this one by a
schedule where exceeding it is the interesting case.

**Why the signed total cannot replace them.** A net figure cannot say how many
pockets sit on each side of the line. A board whose signed difference nets to
zero can hold five pockets badly short of their plans and one holding enough
slack to cancel them; the owner acts on the five, not on the zero.

**The side of the schedule is an axis, not the level scale.** The axis is
binary and is set by the sign of one field, the difference between what a pocket
has committed and what its own plan asked for by the close. The levels
(`pocketLevel.js`) are a scale of seven mutually exclusive bands set by the pace
ratio, and a level is neither a side nor a subdivision of one. Reading the two
counts as level counts is what makes them look as if they cannot add up to the
population. The tolerance band for keeping up with the plan is symmetric — five
hundredths of the pace ratio either side of the line (`ON_TRACK_BAND`) — so it
straddles the axis, and a pocket reading *On track* can be on either side of it.

**Why the amounts do not travel alone.** The four schedule fields are null together when a
plan's window holds no full calendar month (`planSchedule.js`, `planMonths < 1`).
Those pockets are excluded from the line, so they must also be excluded from the
amount measured against it — which is why `totalAllocated` cannot be what the
adherence figure divides, and why the count ships beside the percentage, so the
screen can say how many pockets the reading leaves out.

`totalScheduleGap` does not replace `totalAheadOfPlan`. The clamped one answers
where money can be taken from (question 6) and must stay clamped, because a
pocket behind its line is not a source; the signed one answers whether the board
is on plan (question 2) and must keep its sign.

The frontend requirement that follows, per the standing rule that a payload
change records it in the owning plan: the board summary type
(`PocketBoardSummary`, `frontend/src/fintrack/types/pocketTypes.ts`) gains all
nine fields, the hero's bar prints the served percentage as its label and clamps
only its own fill, and §7.1
places the rest. Placement is not settled here — this section ranks the
questions and does not lay out the screen. The wording the hero carries for
these fields is settled, in the mockup and in the decision log
(`plan-docs/design-refs/pocket-hero/schedule-bar.html`; `POCKET_DECISIONS.md`
section 27).

**The per-pocket percentage is unchanged — RULED 2026-09-04.** The card keeps
`allocated ÷ target × 100` (`makePocketStatus.js:162`), because the card already
carries both axes: the lifetime bar and the schedule reading in words beside it,
with the level colour set by the pace ratio. The hero has one bar and has to
pick; the card does not.

---

## 1. The problem, measured

A pocket today is a **real account that really receives money**. Funding one
writes two rows in `transactions` and moves both balances. Three consequences,
all live:

- `user_accounts.account_balance` of the funding bank is the *spendable* balance,
  not the balance the bank statement shows. The owner cannot reconcile FinTrack
  against a real statement.
- The app-wide cash figure counts the same money twice — once in the bank tile,
  once in the pocket tile of the same dashboard.
- The detail screen claims money exists where it never was: the figure is called
  *saved*, and it is an account balance.

**Production held one pocket, and no longer holds any.** `cash_loc_chinita`
(account id 108, balance 90.00) was funded once from `CASH` (id 109) by
transaction 264 (+90.00, 2026-05-14), plus a self-referencing opening row at 0.00
and two zero-amount test rows — measured 2026-08-22 on `fintrack_rehearsal`.
**The owner deleted that account in production on 2026-08-24**, through the app's
own RTA path, and the inventory above is history.

**The 90.00 is back in `CASH`, and the app put it there.** It was a virtual
set-aside, never a transfer to a separate store of value (owner, 2026-08-23), and
`processRTAAnnulment` in `deleteAccountService.js:184-300` reversed it: it applied
the net adjustment to each affected account, **recorded an annulment transaction
stating why**, absorbed the mirror into the `slack` account and only then
hard-deleted the row. `CASH` reads 90.01 with a movement dated 2026-08-24 —
*"+90 USD to revert original DEPOSIT, for deletion of Cash_loc_chinita account"*.

**This is what migration `020` was going to do, done better.** The migration's
step 3 was a silent `UPDATE` of `account_balance`; the RTA path did the same
correction and left a transaction the owner can read on the account screen. The
step is not just unnecessary now — the pattern it should have copied already
existed in the codebase.

**It also confirmed §9.1's cascade warning with real data.** Deleting the account
row took the `pocket_saving_accounts` row with it (`002_accounts.sql:190-193`), so
the target, the desired date, the note and the six FX columns of migration `015`
are gone. Nothing was lost that matters — the owner deleted the pocket on purpose
— but the hazard the migration was ordered around is now measured rather than
predicted.

**The backend module already exists and its architecture is right.**
`pocketController.js`, `pocketRoutes.js` and `pocket_services/{core,db,services}`
serve `GET /pocket/board`: one request for the whole screen, totals folded from
the same rows the list renders, mixed currencies reported as null with a notice
rather than added at 1:1, an empty board answering `200` with `pocketCount: 0`.
Commits `48863b4` and `7322b9b`. **One line of it is wrong under this spec** —
`pocketRepository.js` reads `saved` from `ua.account_balance`.

**The frontend is untouched.** `PocketLayout.tsx`, `ListPocket.tsx`,
`PocketBigBoxResult.tsx` and `PocketDetail.tsx` are all still on the two old
dashboard endpoints, with `P-1`…`P-7` live.

> **CORRECTED 2026-08-30 — both paragraphs above are stale.**
>
> **The one wrong line in the backend is fixed.** No read in
> `pocketRepository.js` selects `ua.account_balance`; the pocket's committed
> figure is `COALESCE(SUM(pa.amount), 0)` over the ledger, and the field is named
> `allocated`.
>
> **The frontend is not untouched.** All four files were rewritten onto the
> pocket endpoints: `PocketLayout.tsx:25-27` issues the module's one request
> through `usePocketBoardStore`, `PocketBigBoxResult.tsx` renders the ten-field
> summary, `ListPocket.tsx` the fifteen-field row, and `PocketDetail.tsx` the
> detail payload. Of the seven defects, `P-1`, `P-2`, `P-3`, `P-4`, `P-6` and
> `P-7` are closed and `P-5` is void — the detail no longer fetches a transaction
> window at all. `P-8`, the unconverted target on the legacy edit path, is
> unreachable from any client but still mounted
> (`accountEditController.js:90-101`).

---

## 2. The model

**A pocket does not hold money. It commits money that stays in the real account.**

### 2.1 Five questions, five entities

| question | entity | table |
|---|---|---|
| Where is my money? | Account | `user_accounts` |
| What actually happened to it? | Transaction | `transactions` |
| How much may I spend this period? | Budget | `budget_monthly_allocations` |
| What do I want to reserve part of it for? | **Pocket** | **`pockets`** — new |
| How much of which account is committed to which purpose? | **Allocation** | **`pocket_allocations`** — new |

Custody and intent are separate domains. `user_accounts` answers *where*;
`pockets` answers *what for*; `pocket_allocations` is the only thing that joins
them, and it joins them N:N.

### 2.2 Three figures on a real account

| figure | source | meaning |
|---|---|---|
| `accountBalance` | `user_accounts.account_balance` | real money, ties to the statement |
| `allocated` | `SUM(pocket_allocations.amount)` for that account | committed to pockets |
| `unassignedCash` | `accountBalance − allocated` | not yet committed; **may be negative** |

The third figure is **`unassignedCash`**, never "available balance". The
available balance is still the full `accountBalance`: a pocket never blocks a
spend. Calling the remainder "available" would tell the owner they cannot spend
money they can.

### 2.3 The figures on a pocket

`allocated` · `target` · `remaining` · `progress`. **Never `saved`.** The money is
not saved, it is spoken for. Everything else a screen shows about a pocket derives
from these four plus `desired_date`, and §6.2 is the register of which level each
derived figure belongs to.

### 2.4 Three operations

| operation | writes | moves a balance |
|---|---|---|
| **Allocate** | one `pocket_allocations` row, positive | no |
| **Release** | one `pocket_allocations` row, negative | no |
| **Spend** | an ordinary transaction | yes — and it never consults an allocation |

A spend is never rejected because of a pocket, and never asks which pocket it
came from.

### 2.5 Over-allocation is a state, not an error

`SUM(allocations) ≤ balance` is a **precondition of Allocate only**, enforced in
the service, and **never a database `CHECK`** — a `CHECK` would block the insert
of a real expense. A spend that breaks it produces `unassignedCash < 0`, which
the app displays and does not correct.

### 2.6 The shortfall is not attributed to a pocket

An account over-allocated by 200 that feeds three pockets does **not** get its
deficit split among them. Any such figure needs a policy — pro-rata? oldest
first? — and choosing one means the system inventing causality, which this model
forbids everywhere else.

The deficit is reported **on the account**. A pocket reports only that one of its
sources is short, and the wording says so: *"This account no longer fully covers
its pocket allocations"*, never *"your Vacation pocket lost $100"*.

---

## 3. Data model

### 3.1 `pockets`

```sql
 CREATE TABLE IF NOT EXISTS pockets (
  pocket_id      SERIAL PRIMARY KEY,
  user_id        UUID NOT NULL
   REFERENCES users(user_id) ON DELETE CASCADE,
  name           VARCHAR(50)  NOT NULL,
  note           VARCHAR(155),
  target_amount  DECIMAL(15,2) NOT NULL CHECK (target_amount > 0),
  currency_id    INT NOT NULL
   REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  desired_date   DATE NOT NULL,
  -- FX audit pair: what was typed, in which currency, and the rate between them.
  original_target                   DECIMAL(15,2) NOT NULL,
  original_currency_id              INT NOT NULL
   REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  exchange_rate                     DECIMAL(20,10) NOT NULL,
  exchange_rate_source              VARCHAR(50)   NOT NULL,
  exchange_rate_timestamp           TIMESTAMPTZ   NOT NULL,
  exchange_rate_target_currency_id  INT NOT NULL
   REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
 );
```

**No state column.** No `status`, no `closed_at`. `active`, `funded` and
`overdue` are all derived (§6); a pocket that no longer applies is deleted
(`Q8`). A stored state a query can also derive is the defect
`010_create_budget_tables.sql` rejected when it refused SCD Type 2 a
current-flag.

**`currency_id` is the accounting currency**, the one the stored `target_amount`
is expressed in. The origin columns record what the owner actually typed. Every
account in this database is kept in the one accounting currency, so this pair is
not multi-currency arithmetic — it is the audit trail that proves the conversion
ran (`Q1`).

**`desired_date` is `NOT NULL`** (`Q2`). Its meaning is fixed and binding on every
figure derived from it: **the date by which the target is meant to be fully
allocated and available.** It is *not* the date the money will be spent.

**`desired_date_source` does not carry over.** Migration `018` added it
(`'user'` / `'default'`) to mark a date the form invented. With the field required
on the form there is nothing to invent, so the column would hold one value and
state no fact.

**No unique constraint on `(user_id, name)`.** Two goals may legitimately share a
name, and enforcing uniqueness would reject a rename for a reason the owner
cannot see. Nothing joins a pocket by name.

### 3.2 `pocket_allocations` — the ledger

```sql
 CREATE TABLE IF NOT EXISTS pocket_allocations (
  allocation_id     BIGSERIAL PRIMARY KEY,
  user_id           UUID NOT NULL
   REFERENCES users(user_id) ON DELETE CASCADE,
  pocket_id         INT NOT NULL
   REFERENCES pockets(pocket_id) ON DELETE CASCADE,
  source_account_id INT NOT NULL
   REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  amount            DECIMAL(15,2) NOT NULL CHECK (amount <> 0),
  -- The date the decision was taken. Mirrors transactions.transaction_actual_date.
  allocation_actual_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- FX audit pair, same six columns, same meaning.
  original_amount                   DECIMAL(15,2) NOT NULL,
  original_currency_id              INT NOT NULL
   REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  exchange_rate                     DECIMAL(20,10) NOT NULL,
  exchange_rate_source              VARCHAR(50)   NOT NULL,
  exchange_rate_timestamp           TIMESTAMPTZ   NOT NULL,
  exchange_rate_target_currency_id  INT NOT NULL
   REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
 );

 CREATE INDEX idx_pocket_allocations_pocket  ON pocket_allocations(pocket_id);
 CREATE INDEX idx_pocket_allocations_account ON pocket_allocations(source_account_id);
```

**`amount` is signed** (`QP-17`). A release is a negative row. `CHECK (amount <> 0)`
because a zero row states nothing and would appear in the history as an event
that did not happen.

**`allocation_actual_date` is not `created_at`, and both are needed.** `created_at`
records when the row was written; `allocation_actual_date` records when the
decision was taken, and they differ every time a decision is entered after the
fact — the allocate form dates the movement the way every other form in the app
does, and a set-aside agreed on Friday and typed on Monday belongs to Friday.
`transactions` already separates
the two as `transaction_actual_date` and `created_at` (`003_transactions.sql:55-56`),
and this column copies that convention, `NOT NULL` where the original is nullable.
The allocation history and the detail modal render this date, never `created_at`.

**No `updated_at`** (`QP-21`). The table is append-only: a row is never edited and
never deleted. `+300` becomes `+250` by writing `−50`. There is no `PATCH` and no
`DELETE` on this table.

**One accounting amount, not two — and this is a rejection, not an omission.**
A review of 2026-08-24 proposed splitting `amount` into `source_account_amount`
and `pocket_amount`, so that a COP account could back a USD pocket and each side
could be summed in its own unit. **That case does not exist in this database.**
`user_accounts.currency_id` is `NOT NULL` (`002_accounts.sql:95`) and every
account is kept in the one accounting currency — the owner's own correction of
2026-08-23. `pockets.currency_id` is that same currency, which is exactly why
`exchange_rate_target_currency_id` must equal it. The pocket's `allocated` and the
account's `allocated` therefore read the same column in the same unit; they are
one piece of arithmetic seen from two sides, not two amounts that need
reconciling.

Storing two would be worse than unnecessary. They would be related by
`exchange_rate`, so either is derivable from the other two — a value stored twice,
the defect this spec refuses for `status` / `closed_at` (§3.1) — and the first
rounding disagreement between them produces a pocket whose sources do not sum to
its own total, with nothing in the schema to say which of the two figures is
wrong. The budget module already settled this shape: `budget_monthly_allocations`
stores **one** amount in the account's currency plus the six origin columns, and
migration `017` is the commit that made it so.

**What the typed currency is, and all it is.** The owner may type an allocation in
any currency. The server converts it to the accounting currency, stores the
result in `amount`, and stores what was typed in `original_amount` /
`original_currency_id` with the rate, its source and its timestamp. That pair is
**audit metadata, not a unit of account** — it exists so the conversion can be
shown and re-checked, never so a second arithmetic can be done in it. Identical
treatment to `transactions` (migration `007`) and to the budget tables (`014`,
`017`).

**`user_id` is stored, not reached through `pocket_id`.** Ownership is checked on
every read and every write, and a join through a second table to prove it is a
join that can be forgotten.

**What each foreign key does on delete, and why they differ:**

- `pocket_id` — `ON DELETE CASCADE`. An allocation is the pocket's own row and
  means nothing without it. Deleting the pocket takes its ledger with it, which
  destroys no financial fact because no allocation ever moved money.
- `source_account_id` — **`ON DELETE RESTRICT`**, the choice migrations `014`,
  `016` and `017` made for every reference that carries meaning. The account is a
  different domain's object; its deletion must be a decision taken in the service
  with an impact report, never a silent side effect of a constraint. The
  counter-example this avoids is `002_accounts.sql:190-193`, whose cascade is what
  makes today's pocket deletion destroy a goal with no error and no trace.
- `currencies` — `ON DELETE RESTRICT ON UPDATE CASCADE`, matching `014`/`016`/`017`.
  Migration `016` records why: `ON DELETE SET NULL` on a currency is a defect,
  because an amount whose currency became null is unreadable afterwards.

### 3.3 The four rules, and where each one lives

Every one of them needs an aggregate over other rows, and one of them must stay
breakable by a real expense. **None is a database constraint.**

| rule | id | enforced in |
|---|---|---|
| `SUM(allocations of the account) + amount ≤ account.balance` on Allocate | §14.4 | `pocketAllocationService.js`, inside the transaction |
| running `SUM` per **(pocket, source account)** never below zero | `QP-18` | same service, on Release |
| deleting an account deletes its allocation rows explicitly, after the impact report | `QP-19` — **rewritten**, `Q8b` | `deleteAccountService.js` + `getAnnulmentImpactReport.js`, `PLAN_ACCOUNT_DELETION.md` |
| a pocket is deleted whole, allocations included, at any net | `QP-20` | **superseded** — see `Q8` |

`QP-18` is what forces the source breakdown on screen: a release is not *"release
400 from this pocket"* but *"release 400 of what this pocket holds **from
CASH**"*. Without the breakdown the form cannot state what it is allowed to do.

### 3.4 Concurrency

`check available` + `insert` is **one transaction with the source account locked
`FOR UPDATE`**. Two simultaneous requests would otherwise both read the same
unassigned cash and both pass.

The pattern is copied, not invented: `lockOwnedAccount` in
`budgetAllocationService.js:106-131` proves ownership by joining to
`user_accounts.user_id` rather than trusting the id, and locks the row for the
rest of the transaction.

### 3.5 Rounding

`money.js` owns the rounding policy and the pocket module already imports it from
`budget_services` with a comment saying so. Every amount is normalized at the
service boundary before it reaches the repository, and figures are rounded once —
totals are folded from already-rounded row values so a header reconciles with the
rows under it, which is what `pocketBoardService.js` already does.

Moving `money.js` to a shared core is its own refactor and is **not** done inside
this block.

---

## 4. Workflow

**Create.** Name, target, currency, desired date, optional note. No money and no
source account. The pocket lands at `allocated = 0` and the screen offers
*Allocate funds now* / *Do it later*. This is already how the backend behaves —
the creation controller states *"adding money to the pocket is not possible when
it is created"*.

**Allocate.** From the pocket detail. Choose a source account, see its unassigned
cash, type an amount. Rejected with `422` naming the figure when it exceeds that.

Eligible sources: **bank and cash only.** Never investment — its balance is a
market valuation, not spendable money, and a price move would produce a false
over-allocated state (`POCKET_DECISIONS.md` §14.5, unchanged). Never a debtor account,
never a category-budget account, never the `slack` account.

**Release.** From the pocket detail. The selector lists **the pocket's own sources
with the net each one holds**, not the user's accounts. Rejected when the amount
exceeds that net (`QP-18`).

**Spend allocated money.** Accepted, always. The account goes over-allocated, says
so, and the owner resolves it with a release or by putting money back. Nothing is
guessed and no pocket is debited.

**Move the backing from one bank to another.** A real transfer, then Release on A
and Allocate on B. Three facts, three rows, ledger still append-only. There is no
`reassignSource` operation and there will not be one.

**Turn a commitment into real savings.** `Funded` does not mean the money sits in
a savings account. A real transfer checking → savings, then Release on checking
and Allocate on savings. The pocket stays at 100%; only the custody moved.

**Reach the goal.** `allocated ≥ target` is derived. There is no *Meet target*
button and no *Stop allocating* operation. Raising the goal is *Edit target*.

**Delete.** At any net (`Q8`). The confirmation names each source account and the
amount that returns to its unassigned cash, and states that the allocation
history goes with it.

---

## 5. How every value is edited

| value | where | mechanism | history |
|---|---|---|---|
| allocation amount | never edited | a new row corrects it | the rows **are** the history |
| target | `PocketEditModal`, from the card and the detail | one request with the date | none — plain overwrite (`Q3`) |
| desired date | the same modal, the same request | target and date are **one decision**; splitting them lets the two disagree about which revision they belong to | none — plain overwrite (`Q3`) |
| name / note | the same modal | plain overwrite — they are labels, not figures | none |
| currency | not editable | changing it would restate every past allocation | — |
| source account of an allocation | never edited | Release on the old, Allocate on the new | two rows |

**The line that decides every future column:** an allocation is a decision about
money and is **appended**; a target and a date are the current statement of a plan
and are **overwritten**.

The modal is built the way `BudgetEditModal` is built: it owns no request, values
leave through `onSave`, and it **states the consequence before saving** — a new
target moves the gap and the required monthly pace, and that pace is the figure
the owner is actually choosing.

**Budget's range control** (*this month* / *until a month* / *every month from
here*) has **no pocket analogue** and must not be copied. A budget recurs; a goal
is one commitment with one horizon.

---

## 6. Derived figures — the levels, and what each level is allowed to say

Every figure is computed on the server. **No client re-derives any of them**, a
count included: a derivation the client repeats is a second answer to the same
question, and the disagreement between a header and a list is the defect this
module already has.

The indicators sit at **five levels of aggregation, bracketed by two that carry no
indicator at all** — the stored inputs below them and the app-wide view above
them, which is empty by decision, not by omission.

**The level decides where the figure is written.** A base sum is written in SQL; a
figure that needs `today` or a division is written in the pure core; a fold across
pockets is written in the service; the component clamps a bar and picks a label and
computes nothing.

Let `A = allocated`, `T = target_amount`, `D = desired_date`, `today` on the
owner's calendar (`AT TIME ZONE`, the same expression `budgetAllocationService.js`
uses — never the browser's clock).

### 6.1 The seven levels

| level | subject | what it answers |
|---|---|---|
| **L0** | stored input | nothing — `target_amount`, `desired_date`, `amount`, `account_balance` and the six FX columns are data, not indicators |
| **L1** | one allocation row | what one decision was, and in which currency it was typed |
| **L2** | the (pocket, source account) pair | how much of *this* account *this* pocket holds |
| **L3** | one pocket | is this goal covered, and on what pace |
| **L4** | one account | how much of this account is committed, and how much is free |
| **L5** | the board | are my goals covered, taken together |
| **L6** | the app | **nothing in V1.** No pocket figure enters the overview or the accounting dashboard (`Q10`, `Q11`). §17 proposes what could — pocket figures folded over *accounts* rather than over pockets, and savings figures read from `transactions`, which touch the pocket tables not at all |

`L2` is the level `QP-18` guards and the level the release form reads. `L4` is the
level the allocate form validates against. Both are indicators *and* write-path
preconditions, which is why neither may be computed twice (§6.4).

### 6.2 The register

| level | figure | formula | written in | rendered on |
|---|---|---|---|---|
| L1 | *a conversion happened* | `original_currency_id ≠` the accounting currency | the modal, a presentation boolean | the allocation detail modal (§7.2) |
| L2 | `heldByThisPocket` | `COALESCE(SUM(amount), 0)` for that pocket **and** that account | SQL, `pocketRepository.js` | source table, column 1; release selector |
| L3 | `allocated` | `COALESCE(SUM(amount), 0)` over the pocket's rows | SQL | card and detail hero |
| L3 | `remaining` | `T − A`, **raw** | `makePocketStatus` | card and detail hero |
| L3 | `progress` | `A / T`, **raw** | `makePocketStatus` | progress bar, which is where the clamp lives |
| L3 | `funded` | `A ≥ T` | `makePocketStatus` | badge, and the `Funded` filter |
| L3 | `overdue` | `today > D AND A < T` | `makePocketStatus` | badge, and the `Overdue` filter |
| L3 | `daysRemaining` | `D − today` | `makePocketStatus` | detail hero |
| L3 | `requiredMonthly` | `remaining ≤ 0 → 0`; `daysRemaining ≤ 0 → null`; else `remaining / (daysRemaining / 30.44)` | `makePocketStatus` | detail hero; the consequence line of the edit modal (§5) |
| L3 | `uncovered` | at least one source account of the pocket has `accountBalance < accountAllocated` | the service — it needs L4 | coverage warning, and the `Uncovered` filter |
| L3 | `sourceCount` | `COUNT(DISTINCT source_account_id)` | SQL | card |
| L4 | `accountAllocated` | `COALESCE(SUM(amount), 0)` over that account's rows | SQL, in the **account** read path | account detail; source table, column 2 |
| L4 | `unassignedCash` | `accountBalance − accountAllocated`, may be negative | the same service | account detail; the allocate form's ceiling |
| L4 | `isOverAllocated` | `unassignedCash < 0` | the same service | worded on the account, never split across its pockets (§2.6) |
| L5 | `totalAllocated` | `SUM(A)` over the already-rounded row values | `makeSummary` | board hero, and the headline |
| L5 | `totalTarget` | `SUM(T)` | `makeSummary` | board hero |
| L5 | `totalRemaining` | `SUM(MAX(T − A, 0))` — **clamped per pocket, then summed** (§6.3) | `makeSummary` | board hero |
| L5 | `totalExcess` | `SUM(MAX(A − T, 0))` | `makeSummary` | board hero, rendered only when non-zero |
| L5 | `overallProgress` | `SUM(MIN(A, T)) / SUM(T)` — coverage, never the average of the row percentages | `makeSummary` | board hero |
| L5 | `pocketCount` · `fundedCount` · `overdueCount` · `uncoveredCount` | counts over the same rows | `makeSummary` | `Funded n/m`, and the four filter chips |

**Amounts and percentages are null on an empty board; counts are `0`.** A sum over
no pockets is the absence of anything to sum and the screen renders an empty state,
not a board reading `$0.00`. A count over an empty set is legitimately zero, and
`pocketCount: 0` already establishes that reading.

### 6.3 L3 serves raw, L5 clamps per pocket — and the two are not in conflict

At the level of one pocket the sign **is** the information: `remaining = −100`
means over-funded by 100, which is a fact (`Q6`), and `makePocketStatus` already
says so in its own comment — *"not clamped: the excess is the fact"*. Nothing in
the response is clamped at L3. The bar stops at 100% and the card prints the excess
as its own line; that is the component's business and no other consumer may assume
a ceiling.

At the level of the board the sign stops being information and becomes
**compensation**. `SUM(T) − SUM(A)` lets a pocket over-funded by $100 cancel
another that is $100 short, and the hero then reports that nothing is missing —
which is false, because that excess is committed to the first pocket and releasing
it is a decision nobody has taken. **Money committed to one goal does not fund
another goal.** So L5 clamps each pocket first and sums after: `totalRemaining` is
what is still to allocate, `totalExcess` is what is committed above goal, and the
two are reported separately instead of netting into a single misleading number.

The same reasoning applies to `overallProgress`: it is `SUM(MIN(A, T)) / SUM(T)`,
so one pocket at 300% cannot report coverage it does not provide. It is capped at
100% by construction rather than by a clamp in the component, which is the one
place in this spec where a server figure carries a ceiling — and it carries it
because *coverage* is the question, not *how much is committed*. The uncapped
answer to that other question is `totalAllocated`, served beside it.

**This corrects what `makeSummary` does today.** The existing fold computes
`totalRemaining` as `totalTarget − totalSaved` and `overallProgress` as
`totalSaved / totalTarget`, both of which net. It was written when a pocket held
money and there was one balance per pocket to add up.

### 6.4 L4 is an indicator of the account module, not of the pocket module

`unassignedCash` is the figure the allocate service validates against inside the
row lock (§3.4) **and** the figure the owner reads on the account screen (§7.3). It
is one number with two consumers, and it is written once, in the account read path.
Computed a second time inside the pocket module, the business rule and the number
on screen become two implementations of the same formula that can drift apart —
which is exactly how the board's header came to disagree with its own list.

### 6.5 What no level carries

**`runRate` and `projectedDate` do not ship** (`Q7`). Both read a rate over time
from the allocation ledger, and under the new meaning that rate measures how often
the owner changed their mind, not how fast money arrived. Presenting a decision
cadence as a savings forecast is the kind of invented causality §2.6 forbids.

The pace question itself is answerable — just not from this table. §17 points at
reading it from `transactions`, where the rate is money actually arriving, and
comparing that against the pace the goals require. That is an overview proposal,
not part of V1.

**The shortfall is never attributed to a pocket.** An account over-allocated by 200
that feeds three pockets does not get its deficit split among them; L3 reports only
that a source is short, and the amount is stated at L4 (§2.6).

**`requiredMonthly` is null after the date, not the whole remainder.** An earlier
draft returned `remaining` once `daysRemaining ≤ 0`, which puts a figure under a
label it does not answer: $1,000 owed on a goal whose date passed is not "$1,000
per month". The endpoint returns `null` and the screen says *Target date passed —
$1,000 still to allocate*. A figure named wrongly is worse than a figure withheld,
and a dash is the app's own convention for a value that has no answer.

### 6.6 What this reshapes in the two files that already exist

| file | change |
|---|---|
| `makePocketStatus.js` | `saved` → `allocated`, and it stops reading `ua.account_balance`. The nullable-target branches go: `target_amount` is `NOT NULL` with `CHECK (> 0)`, so `hasGoal`, the null `progress` and the null `remaining` are unreachable states of the new schema. The `desiredDateSource` guard goes with the column (§3.1). It gains `funded`, `overdue`, `daysRemaining`, `requiredMonthly` and `sourceCount` |
| `pocketBoardService.js` | `makeSummary` keeps folding from already-rounded row values and keeps the empty-board contract; `totalRemaining` and `overallProgress` change formula (§6.3); it gains `totalExcess` and the four counts. The mixed-currency notice becomes an invariant guard rather than a live branch — every pocket is in the one accounting currency — and it is kept because a guard that never fires costs nothing and a silent 1:1 addition costs a total |

---

## 7. The screens

The behaviour questions these screens left open are closed in 11.10, one row
per question.

Pocket has **two levels of navigation, not three** — `App.tsx:209` and `:336`
declare the detail *beside* the layout, not inside its `Outlet`.

> **Re-measured 2026-08-30: the statement holds, the anchors moved and there are
> four route slots.** `App.tsx:212` declares the layout, `:293` the creation
> form, `:339` the detail and `:352` the pocket editor; the last three are
> siblings of `<Layout />`, which is why the module holds its payload in two
> Zustand stores rather than in route context.

Every screen carries the three fetch states as **three distinct states** —
skeleton, error with retry, empty. A withheld figure renders as a skeleton or a
dash, never as `0` or `NaN`.

### 7.1 Board — `/fintrack/pocket`

**Hero:** `Total allocated` · `Total target` · `Total remaining` ·
`Overall progress` · `Funded n/m`, plus `Committed above goal` as its own line
whenever it is non-zero. The last one exists so that `Total remaining` can answer
*what is still to allocate* without an excess elsewhere cancelling it (§6.3).

The headline is **Total allocated**. Today the headline is `total_target` under a
title that says savings, and the committed amount is built and never rendered
(`P-1`, `P-2`): in the owner's own screenshot *Total Pocket Savings $4,500.00* is
the goal, and the real figure was $12.

**Controls:** search by name, sort, and the filters `All` / `Active` / `Funded` /
`Overdue` / `Uncovered`. `All` is unambiguous because there is no closed state.

**Cards:** one per pocket — allocated, target, remaining, progress bar, desired
date, source count, note.

> **§7.1 re-measured 2026-08-31, at head `fb4dc01`. Three of the four blocks
> above are stale; the code moved past them and the code is what shipped.**
>
> **The hero is not five readings in a row.** It reads in two movements. First the
> money, as **three peer figures** — `Target`, `Total allocated` and `Still to
> allocate` — with the surplus printed under the gap only when it is non-zero
> (`PocketBigBoxResult.tsx:177-218`), because the three reconcile as
> `allocated − excess + remaining = target` and not as a subtraction: the shortfall
> is clamped per pocket before the server sums it
> (`pocketBoardService.js:138-139`). Then the ratio, as a labelled bar sitting
> **directly under the amounts it divides** (`:220-252`) rather than two cards
> below them.
>
> **`Funded n/m` no longer exists, and what replaced it is a partition rather than
> a ratio.** Two bands with their counts, each with its readings hanging under it:
> **Target reached**, holding *at target* and *above target*; and **In progress**,
> holding *on plan*, *at risk* and *overdue*. The two headings add up to the total
> the label above them declares (`:273`), which is the property `n/m` could not
> offer. Two consequences worth stating because neither is obvious:
> - **The late ones are counted inside *In progress***, and that is a domain call,
>   not a display one: a pocket past its date has not reached its target and has
>   not been closed, so it is late rather than finished.
> - **The pocket that lands exactly on its target now has a reading of its own**
>   (`:313-323`), marked with a tick instead of a square because it is the only
>   finished level on the strip. It is derived, not served: the flag is set at
>   *committed **≥** target*, so the served count holds both readings and only the
>   excess half is counted in the client.
>
> **Coverage left the partition.** It sits in an **Alerts** row beneath the two
> bands, together with overdue and at risk (`:386-429`). That row **carries no
> count on its heading, deliberately**: every figure in it is already counted in
> one of the two bands, so a number there would invite an addition that does not
> hold. It is absent when there is nothing to raise — unlike a band's readings,
> which print at zero because a partition has to keep adding up.
>
> **The filter list is seven chips, not five, and none of its words is typed
> here.** `All`, the five levels read from the shared map `POCKET_STATUS_WORD`,
> and coverage last (`PocketToolbar.tsx:42-51`). `Active` is gone — it was never a
> state, only the residue of the two the server folds — and `Funded` is now
> spelled **At target** (`helpers/pocketStatus.ts:65`).
>
> **One defect this block should not be read as blessing.** Two of those strings
> say the bare word *allocation* — the chip `Allocation not covered`
> (`PocketToolbar.tsx:50`) and the hero's `with allocation not covered`
> (`PocketBigBoxResult.tsx:423`) — and §18.1 of `POCKET_DECISIONS.md` forbids it
> as ambiguous between `pocket_allocations` and `budget_monthly_allocations`.
> **Not corrected here**: amending a frozen contract is the developer's.

**The schedule block and its wording — RULED 2026-09-04.** Reasoning in
`POCKET_DECISIONS.md` section 27; the three states are drawn in
`plan-docs/design-refs/pocket-hero/schedule-bar.html`. What the screen owes:

- **Two blocks, in this order: the money first, then the schedule.** The block
  is called **schedule** and never *progress*, because *progress* is the word the
  lifetime bar already owns and the two answer different questions. The
  accessibility role on the widget stays `progressbar`: that is the platform's
  name for the control, not the page's name for the block.
- **The bar's label prints the served percentage unclamped, and only the fill is
  clamped to the track** (`scheduleAdherence`). A board standing past what its
  plans asked for reads a figure above one hundred over a full bar, with the
  sentence beside it saying so. The screen divides nothing and counts nothing:
  the percentage and both pocket counts arrive served.
- **The third tile is labelled `Variance` and carries three rows** — the label,
  the signed amount, and under it the side of the board's own line spelled in
  words: `under the schedule` when the signed net is negative, `over the
  schedule` when it is at or above zero. The amount prints once, in the value; a
  bare signed number is never the whole tile, because the sign states the side
  only in symbols. Tile labels are authored in sentence case and uppercased by
  CSS.
- **The two left tiles of the equation are labelled `Required to date` and
  `Committed to date`**, and the two labels move together. Both figures are
  cumulative from each plan's creation through the close of the month in the
  stepper, and both count only the pockets that have a plan window. Without the
  phrase a reader takes the committed figure for the portfolio's total, which is
  the different figure on the lifetime strip. **Neither label names the month**:
  the badge does, and a label carrying a month would have to change as the
  stepper moves.
- **The month's movement reads `840.00 net committed in August`**, inside the
  committed tile. The word `net` is not decoration — the figure is what came in
  less what was released, and without it a release makes the figure look wrong.
  It is its own served fold over **only the pockets with a plan window**
  (`scheduledPocketsMovedInMonth`), the same six the tile's own balance counts,
  because a sub-figure drawn from a wider population is not a part of the number
  above it. The board-wide net stays served and unchanged, and is not what this
  line prints.
- **The two schedule-side counts sit inside the segment that counts pockets**,
  in parentheses and **both printed**: `6 of 8 pockets on a plan (3 under / 3
  over schedule)`. A free-standing segment of its own would read as a second
  population, and printing one side alone makes it read as contradicting the
  variance amount above it, which is a signed net over the whole board and can
  point the other way.
- **The monthly pace is worded `1,145.00 a month to finish on time`**, never
  *due this month*. *Due* makes a forward-looking pace sound like a bill landing
  beside the arrears and invites adding the two. They are not added: the
  accumulated difference against the schedule is already inside the pace, which
  divides what is left of the target by the time left
  (`computeRequiredMonthly`, `makePocketStatus.js:52-62`).
- **When no plan window covers the selected month the third segment is dropped
  entirely** — `No plan window covers August 2026 · 0 of 8 pockets on a plan` —
  because there is no line to be on either side of.
- **The lifetime strip stays on this page** and reads
  `Lifetime · 9,600.00 committed of 24,000.00 total target — 40%`. It leaves the
  pocket page only when the app-wide overview carries the question, and the
  overview's own KPI catalog currently refuses every pocket goal figure by name,
  so the strip has nowhere to go yet (see the note in section 27).

**The seven level words are untouched, and the hero's axis words change instead
— RULED 2026-09-04.** This reverses a ruling taken earlier the same day, which
renamed the pace band between the line and double it because the word *behind*
named both that band and the whole negative side of the schedule axis. The
collision was real but the remedy was wrong: **the word for running early
collides in exactly the same way**, so renaming one band leaves the other half of
the ambiguity standing. The level vocabulary keeps all seven words —
`Completed`, `Above target`, `Ahead`, `On track`, `Behind`, `At risk`,
`Overdue` — and the hero says `under` and `over` where it talks about the line.
The coverage word is unchanged and stays `Uncovered` on every surface.

**One consequence that survives the reversal:** the hand-typed lowercase level
literals in the board summary component (`PocketBigBoxResult.tsx:573`, `:605`,
`:621`, `:659`) contradict the shared vocabulary map's own claim to be the
single place a level is spelled (`POCKET_STATUS_WORD`,
`helpers/pocketStatus.ts:104-119`). No rename is pending now, so nothing forces
the fix, but it is a live defect and is recorded rather than left unsaid.

**One correction to the re-measured block above**, which is a measurement of
2026-08-31 and stays as written: the level scale has carried **seven** words
since 2026-09-04, not five, and the filter chip list is that many plus `All` and
coverage.

**The board is a pocket hero and nothing else.** No cash position, no net worth,
no accounting-dashboard figure. Same separation the owner required between the
app-wide overview and the budget module.

### 7.2 Detail — `/fintrack/pocket/pockets/:pocketId`

**Hero:** target, allocated, remaining, progress, desired date, `daysRemaining`,
`requiredMonthly`.

**Actions:** Allocate · Release · Edit · Delete.

**Source table** — the screen `QP-18` was waiting on. One row per source account,
three figures each, and they are three different questions:

| column | meaning |
|---|---|
| held by this pocket | the net this pocket holds **from that account** |
| the account's total allocated | across **all** pockets |
| the account's balance | real money |

Conflating the first two is the ambiguity in the original proposal's coverage
view, which showed *Allocated $700* beside *Balance $500* without saying that the
$700 belonged to three different goals.

**Allocation history** — every row, signed, with its date and its source account.
**No transaction list**: a pocket has no transactions.

**Each row opens a detail modal stating the conversion**, the way a transaction row
already does. This is not a new component to design: `AccountTransactionDetailModal.tsx`
takes `{ transaction, onClose }`, derives *a conversion happened* by comparing the
original currency code against the accounting currency, and renders the amount as
typed, the pathway between the two figures, and the rate as
`1 <accounting> = <n> <original>`. The allocation modal is the same modal with the
same six fields — `original_amount`, `original_currency_id`, `exchange_rate`,
`exchange_rate_source`, `exchange_rate_timestamp` and the stored `amount` — and it
shows the pathway only when the two currencies differ. Commits `4f4afcd` and
`634a7fb` are the most recent work on that modal, so it is the live pattern, not a
precedent to reconstruct.

This is why one stored `amount` is sufficient and two would be wrong: the modal is
where the origin figure belongs — on screen, beside the rate that produced the
stored one — not in a second column that every aggregate then has to choose
between.

**Coverage warnings** — shown when a source account is short, worded on the
account (§2.6). *Allocated* and *covered* are two different words on this screen
and the copy keeps them apart: allocated is what the owner decided to reserve,
covered is whether the account behind it still holds the cash. The warning names
the account and the amount it is short by — never a share of that amount charged
to this pocket.

### 7.3 Account detail — three lines it does not have today

A bank or cash account gains `Account balance` / `Allocated to pockets` /
`Unassigned cash`, plus the list of pockets drawing on it.

Not decoration: without it, the figure the Allocate form validates against exists
nowhere else in the app, and the owner cannot answer *how much may I spend*. The
business rule and the number on screen have to be the same number.

### 7.4 Transfer — pocket leaves both selectors

`Transfer.tsx:105` (origin) and `:113` (destination). Moving money into a pocket
stops being a transfer because it stops being a movement of money.

---

## 8. The API contract

Base `/api/fintrack/pocket`, extending the router that already exists on
`feat/pocket`.

**Errors follow the budget module's single shape** — `400` validation, `401` no
session, `403` the pocket is missing or not the caller's, `422` a rule a schema
cannot check. **No `404` anywhere**: answering 404 for an id that does not exist
and 403 for one that does lets a caller walk the id space and learn which pockets
belong to other users.

**Both write endpoints take a positive amount.** The client never sends a sign. A
contract where it sends `−100` is one typo away from inverting a financial
decision, and no validator can tell an intended negative from a slipped one.

**Conversion runs on the server, never on the client** (`Q1`). The client sends
the amount as typed plus its currency code, exactly as `BudgetWriteRequest` does.
A client that converted first would decide the stored amount with a rate the
server never saw.

| verb | path | body | frontend consequence |
|---|---|---|---|
| `GET` | `/board` | — | `PocketBigBoxResult.tsx` + `ListPocket.tsx` rebuilt on `allocated`; `PocketListSummaryType` / `PocketListType` replaced |
| `GET` | `/:pocketId` | — | `PocketDetail.tsx` stops calling the account endpoints; new `PocketDetailType` |
| `POST` | `/` | `{ name, note?, targetAmount, currency, desiredDate }` | `NewPocket.tsx` changes URL and payload key (`amount` → `targetAmount`) |
| `PATCH` | `/:pocketId` | `{ name?, note?, targetAmount?, currency?, desiredDate? }` | new `PocketEditModal`; the pocket case leaves `EditAccount.tsx` |
| `POST` | `/:pocketId/allocations` | `{ sourceAccountId, amount, currency }` | new `AllocateModal`, reusing `useCurrencyPreview` |
| `POST` | `/:pocketId/releases` | `{ sourceAccountId, amount, currency }` | new `ReleaseModal`; its selector reads the source table, not the account list |
| `DELETE` | `/:pocketId` | — | confirmation naming the cash each account gets back |

### 8.1 `GET /board`

Extends what exists. `saved` becomes `allocated` and stops reading
`ua.account_balance`.

```
 { summary: { totalAllocated, totalTarget, totalRemaining, totalExcess,
              overallProgress, currency,
              pocketCount, fundedCount, overdueCount, uncoveredCount },
   pockets: [ { pocketId, name, note, target, allocated, remaining, progress,
                desiredDate, daysRemaining, requiredMonthly,
                funded, overdue, uncovered, sourceCount, currency } ],
   meta: { notices: [] } }
```

`totalRemaining` and `overallProgress` are **not** `totalTarget − totalAllocated`
and `totalAllocated / totalTarget`; each pocket is clamped before the sum, and the
reason is §6.3. The four counts are served rather than counted on the client — the
filter chips and the hero read the same fold as the rows.

What survives untouched from the existing service: the fold of totals from
already-rounded row values, the empty board answering `200` with `pocketCount: 0`,
the amounts and percentages null there while the counts are `0`, the mixed-currency
notice as an invariant guard (§6.6), and the `account_name <> 'slack'` filter.

### 8.2 `GET /:pocketId`

```
 { pocket: { pocketId, name, note, target, allocated, remaining, progress,
             currency, desiredDate, daysRemaining, requiredMonthly,
             funded, overdue, uncovered },
   sources: [ { accountId, accountName, accountType,
                heldByThisPocket, accountAllocated, accountBalance,
                accountUnassignedCash, covered } ],
   history: [ { allocationId, amount, allocationDate,
                sourceAccountId, sourceAccountName,
                originalAmount, originalCurrency, exchangeRate,
                exchangeRateSource, exchangeRateTimestamp } ],
   meta: { notices: [] } }
```

One request for the whole screen — the same rule the board follows, and the
reason there is no separate history endpoint in V1.

`allocationDate` is `allocation_actual_date`, never `created_at` (§3.2): the list
is ordered by it and the row prints it. The three FX fields beside it are what the
detail modal renders, and they are served with the row rather than fetched on open
— the modal owns no request, the same way `AccountTransactionDetailModal` does not
(§7.2).

### 8.3 `POST /:pocketId/allocations`

`422` when `amount` exceeds the source account's unassigned cash, **naming both
figures** so the message is actionable. `403` when the source account is not the
caller's. **`422`, not `400`, when the account type is not an eligible source** —
the payload is structurally valid and every field parses; what fails is a domain
rule about the account behind the id, which is the line this module's error shape
already draws (`400` is what a schema can see, `422` is what it cannot).

The insert and the check are one transaction with the source account locked
`FOR UPDATE` (§3.4).

### 8.4 `POST /:pocketId/releases`

`422` when `amount` exceeds the net this pocket holds **from that account**,
naming both figures (`QP-18`). Writes the row negative.

### 8.5 `DELETE /:pocketId`

Deletes the pocket; `ON DELETE CASCADE` takes its allocations. Never refused for
a non-zero net (`Q8`). Returns what was freed, per account, so the confirmation
and the result state the same thing.

### 8.6 The account side

The account detail response gains `allocated`, `unassignedCash` and
`pockets: [{ pocketId, name, heldFromThisAccount }]`. This is a change to an
existing payload in another module's controller and it carries its own frontend
integration requirement (§7.3).

---

## 9. Migration `020`

Number re-checked **after** `feat/budget` is merged (`017` on `feat/budget`,
`018` on `feat/pocket`), not assumed.

**Was `019`; renumbered 2026-08-29 because pocket ceded 019 to the sign-up
commit.** Dropping the two name fields from sign up needs a two-line migration
that gives `user_firstname` and `user_lastname` a `DEFAULT ''`, and it ships this
week while this block is 25 commits away. The renumber cost nothing: 13 references
in this file, 2 in `future/PLAN_ACCOUNT_SUBTYPE.md`, and **no file on disk** — the
last migration written is `018_alter_transactions_account_fks_to_restrict.sql`, so
nothing was renamed and no chain was rewritten. The paragraph above still governs:
the number is re-checked after the merge, not assumed to stay 020.

> **RE-CHECKED 2026-08-30, as the paragraph above demands — `020` is correct and
> is no longer a reservation.** Counted on disk:
> `backend/src/db/migrations/sql_migrations/` holds **twenty files, `001` through
> `020`, with no gap**, and `020_create_pocket_tables.sql` is written and applied
> — it is the last row of the migration ledger of the local development database
> `fintrack_dev`, read the same day, behind `018` and `019`.
>
> **The next free number is `021`**, not `018`. The sentence just above — *"the
> last migration written is `018_…`"* — was true on 2026-08-29 and is not any
> more: `019_pocket_desired_date_source.sql` and `020_create_pocket_tables.sql`
> both exist on disk. Anything numbering itself from that sentence would collide.
>
> > **CORRECTED later on 2026-08-30: the next free number is `022`.**
> > `021_create_daily_exchange_rates.sql` was written the same day, so
> > `sql_migrations/` holds twenty-one files, `001` through `021`, with no gap.
> > The instruction in this block still governs: read the directory, not a
> > sentence in a plan.
>
> **`PLAN_AUTH_BACKEND.md` claimed the opposite** — that `018` had returned to
> the pool and whichever plan wrote first would take it. That is corrected in
> place there on the same date. Neither document should be read for a free number
> again: read the directory. The one-shot production alignment file under
> `migrations/supabase/` numbers separately and never competes with the chain.

### 9.0 Measured first, decided nowhere

**MEASURED 2026-08-24 against production, read-only. This list is closed.** Four
counts, all zero:

| reading | result |
|---|---|
| `user_accounts` with `account_type_id = 4` | **0** — 0 live, 0 soft-deleted |
| rows in `pocket_saving_accounts` | **0** |
| `debtor_accounts` whose `selected_account_id` names a pocket | **0** |
| `transactions` with `movement_type_id = 5` | **0** |

**Two things the readings settle beyond the count.** The soft-delete split matters
because `user_accounts.deleted_at` exists and a soft-deleted row is still a row the
UP's step 5 would have to delete — there is none. And the movement count at zero
means the cascade of `003_transactions.sql:39-51` already took transaction 264 when
the account was hard-deleted, so **production holds nothing for the DOWN to
reinsert**; §9.2 writes those rows literally into the migration file, which is what
makes the DOWN writable at all.

**The owner's deletion of 2026-08-24 answered most of this list**, and the
measurement above confirms it rather than assuming it. Measurements 2 and 5 have no
subject in production; 3 came back empty; 4 was never about pockets' data.

1. ~~Re-measure the pocket inventory against the live copy~~ — **done, all zero
   (table above)**. The §1 reading came from a rehearsal database whose last
   transaction is 2026-08-11 and predates the deletion; it is now superseded for
   production, and **stays the reference for the rehearsal databases, which still
   hold the pocket and are the only place the UP's steps 2 to 5 can be executed at
   all**.
2. `desired_date_source` of each pocket row. If `'default'`, `020` copies the date
   because there is no other value available, and **reports it**; it never
   promotes a system guess into a stated commitment silently.
3. ~~Whether any `debtor_accounts.selected_account_id` (`002_accounts.sql:178`)
   names a pocket~~ — **measured 2026-08-24: none.** The step stays written in the
   UP: it is a set operation over whatever it finds, and a rehearsal database that
   does hold one must still have it set to `NULL` and reported, never silently
   dropped.
4. ~~Whether the account editor actually sends `target` today~~ — **measured
   2026-08-24 from the code, no database needed. It does** (`Q14`, §11.8).
5. **For each funding movement, which of the two things it was**: a virtual
   set-aside, or money that genuinely moved to a separate store of value. The
   migration never infers this, and it is what licenses step 3 of the UP — giving
   the balance back to the source account is correct only if the money never left
   it. For the measured production dataset the answer is already on the record:
   the sole funding movement, transaction 264, is a virtual set-aside and the
   90.00 is still in `CASH` (owner, 2026-08-23). A movement of the second kind
   would be modelled as a real account plus a real transfer, and the balance would
   **not** be restored.

### 9.1 UP, in this order, and the order is a correctness requirement

**Against production as it stands, only step 1 does anything.** The owner deleted
the last `pocket_saving` account on 2026-08-24 and the app's RTA path already
restored the cash (§1), so steps 2 to 5 find no rows. They stay written, and they
stay in this order, for two reasons: local and rehearsal databases still hold
pocket accounts, and a migration whose data steps are omitted because production
happens to be empty is one that corrupts the first environment that is not.

Each of steps 2 to 5 is therefore a set operation over whatever it finds, not a
hand-written statement about account 108. Zero rows is a legitimate result and the
migration reports the count it acted on.

1. Create `pockets` and `pocket_allocations`, **and mirror both into
   `createTables.js`**, the runtime initializer, which diverges from the
   migrations if it is not touched.
2. Copy each `pocket_saving` account into `pockets` — name, target, note, desired
   date, currency and the six FX columns of migration `015`.
3. Restore each funding account's `account_balance` by the amount it was reduced
   by, **for each movement the owner has confirmed to be a virtual set-aside**
   (§9.0.5). The money never left the account (§1). The qualifier is load-bearing:
   *every non-zero `movement_type_id = 5` row gets restored* happens to be true of
   the measured dataset, but as a written rule it would license a future reader to
   give back a balance the money had genuinely left.
4. Delete those transactions **explicitly**, plus the pocket's own opening row and
   the two zero-amount test rows.
5. Delete the `user_accounts` row.

**No allocation is written.** `pocket_allocations` is created empty and stays
empty until the owner allocates. The alternative — converting each funding
movement into an allocation of the same amount — was considered and refused
2026-08-24: the 90.00 is real money that belongs to `CASH`, and turning it into an
allocation would state an intention the owner never expressed, on the migration's
authority rather than theirs. The deletion of the same day settled it a second
time and more plainly: there is no pocket left to allocate to (`Q4b`).

This is also what makes the migration reversible cheaply. It writes no row that
carries meaning, so the UP is three deletions and one balance correction, and the
DOWN is their inverse.

**Why step 2 precedes step 5.** `pocket_saving_accounts.account_id` is
`REFERENCES user_accounts(account_id) ON DELETE CASCADE`
(`002_accounts.sql:190-193`). Deleting the account row first destroys — with no
error and no trace — the target, the desired date, the note, the deadline's origin
and the six FX columns of `015`, and the DOWN cannot recover what the UP already
dropped.

**Why step 4 is not optional even though step 5 would do it.** All three of
`transactions.account_id`, `source_account_id` and `destination_account_id` are
`ON DELETE CASCADE` on `user_accounts` (`003_transactions.sql:39-51`). A migration
that destroys financial rows has to name them and count them — which is also what
makes the DOWN writable.

### 9.2 DOWN

Recreate the account row and its `pocket_saving_accounts` extension with their
original ids and repair the sequence; reinsert the deleted transactions with their
original ids, amounts and dates; reverse the balance restoration; drop both tables.
Production holds one pocket, so this is a handful of statements written out
literally rather than met by a flag nothing reads.

**Against production the DOWN is two `DROP TABLE` statements**, for the same
reason the UP is one `CREATE`: there is nothing to put back. The paragraphs below
describe what it does where rows exist.

**The DOWN reinserts the transactions from values written into the migration, not
from `pocket_allocations`.** Since §9.1 writes no allocation, there is nothing to
read them back from — and even with allocations there would not be: any row the
owner adds after the migration would be indistinguishable from a converted one,
and the DOWN would resurrect transactions for money that was never moved. The
deleted rows are enumerated in the migration file, which is also what step 4 of the
UP requires.

### 9.3 What the migration does **not** do

- It does not rename `pocket_saving_accounts` (see §10.3).
- It does not drop `pocket_saving_accounts` — three joins still read it (§10.3).
- It does not remove `'pocket_saving'` from `account_types`. Every record written
  before `020` carries `account_type_id = 4` meaning *pocket*; removing or
  renaming the catalog row silently restates all of that history (`Q12`).
- It does not branch on what a funding movement meant. That is a fact the owner
  states, never one the migration infers (`Q4`).

### 9.4 What has no data exercising it

Cross-account attribution, an unattributable opening balance, spending reserved
money, and over-allocation — none of which production ever held. Since the
deletion of 2026-08-24 the list is total: **the migration has no data at all.**

That is the best state this change could have arrived in, and it moves the risk
rather than removing it. The migration is now nearly untestable against production
data because there is none, so its data steps are exercised on a local database
seeded on purpose (§9.0.1), never on the strength of production coming back clean.

It also changes what the frontend is first verified against. `pockets` and
`pocket_allocations` are both empty on day one, so the first screens render the
**empty board**, not a board with one pocket at zero — and the empty state is one
of the three fetch states the pocket CSS does not implement today. Commit 8 is
verified against no pockets before it is verified against any. **The migration is the cheapest it will ever be and
grows with every new contribution** — which is the argument for writing it before
more pockets exist, not after.

---

## 10. Retirement inventory

### 10.1 Kept, repointed

`pocket_services/{core,db,services}`, `pocketController.js`, `pocketRoutes.js` —
one SQL change and one rename in `pocketRepository.js`, plus the new endpoints.
`makePocketStatus.js` and `pocketBoardService.js` keep their architecture and change
the figures they emit; §6.6 lists exactly what, and the two coverage totals of
`makeSummary` change formula rather than name. `NewPocket.tsx` keeps its fields and
its `useCurrencyPreview`; it changes URL and one payload key.

### 10.2 Rewritten

| file | why |
|---|---|
| `PocketBigBoxResult.tsx` | positional `bigScreenInfo` array (`PocketLayout.tsx:47-51`); target as headline |
| `pages/pocket/components/ListPocket.tsx` | no progress; alert is `balance - target < 0` (`:90`), true for every unfinished pocket, so it marks normality; `'es-ES'` and `'en-US'` in one row (`:65`, `:75`) |
| `PocketDetail.tsx` | transaction list → allocation history; the percentage is the *remaining* share under a bare `%`, so 0.27% allocated renders as `99.7%`; the fetch window uses the browser's clock via `toISOString()`, shifting a day west of UTC |

### 10.3 Retired, and in which step

| site | step |
|---|---|
| pocket in both transfer selectors (`Transfer.tsx:105`, `:113`) | with the migration |
| the `movement_type_id = 5` write path (`movementInputHandler.js:58-66`) | with the migration |
| `POST /new_account/pocket_saving` → `createPocketAccount` (`accountRoutes.js:58`) | **with the migration** — left in place, a pocket account can still be created the day after the model says pockets are not accounts |
| the pocket branch of the two dashboard endpoints, and the pocket contribution to account-type totals (`dashboardController.js:51`, `:171`) | with the migration |
| `transactionController.js:153-155` (movement type resolved from a `pocket_saving` account) and `:577` (the overdraft rule) | with the migration |
| `constants.ts:75`, movement type `5` → `'pocket'` | with the frontend |
| the accounting dashboard tile (`AccountingDashboard.tsx:52`, link `:65`) | `Q10` |
| the two overview readings (`OverviewLayout.tsx:145`, `Overview.tsx:111` and `:481`) | `Q11` |
| the byte-identical copy of the card at `pages/budget/components/ListPocket.tsx` | with the frontend — an already-tracked debt |
| the pocket case of `accountEditController.js:90-110` and its write map at `:292`; the pocket entries in `accountEditSchema.ts`, `editSchemas.ts`, `languages.ts` | with the frontend |
| `responseApiTypes.ts` — `BalancePocketSavingRespType`, `PocketListSummaryType`, `PocketListType`; the four pocket URLs in `urlConfig.ts`; the pocket branch of `trackerMovementSchema.ts` | with their callers |
| `pocket_saving_accounts` (the table) | **cleanup migration, last** |

> **RE-MEASURED 2026-08-30 — eight of the thirteen retirement rows have run.**
> Gone: the pocket in both transfer selectors, the `movement_type_id = 5` write
> path's reachability from the client, **the creation route and its controller**
> (`accountRoutes.js:57-62`, `accountCreationController.js:977-985`), the
> accounting dashboard's tile and link, the two overview readings, the
> byte-identical card copy at `pages/budget/components/ListPocket.tsx`, the
> frontend half of the account editor's pocket entries, and two of the three
> response types named in the second-to-last row.
>
> **Still standing:** the movement label `constants.ts:73` (`5: 'pocket'`), which
> is deliberate; the pocket branch of `accountEditController.js:90-101` and its
> write map at `:311`; the pocket branches of the two dashboard endpoints
> (`dashboardController.js:161`, `:206-214`, `:341`, `:376-380`); the movement
> derivation in `transactionController.js:156`, `:158`; four unimported
> account-shaped pocket response types in `types/responseApiTypes.ts` (`:28`,
> `:44`, `:492`, `:498`); and `pocket_saving_accounts` itself.

**The table is dropped last and it keeps its name until then.** Three joins read
it: `getAccountController.js:341` and `:640`, and `accountEditController.js:292`.
Dropping it with `020` breaks three live endpoints on the day the migration runs,
for no gain — an empty table costs nothing and the data is already elsewhere.
Renaming it costs a migration, breaks the same three sites, and buys a better name
for an object that will not exist.

### 10.4 Decided by adoption

`D44` in `OVERVIEW_DECISIONS.md` — whether the hero's cash position and net worth
add the pocket total to the bank balance. **They do not, because there is nothing
to add.**

---

## 11. Decision register

| id | decision | who | when |
|---|---|---|---|
| `Q1` | FX applies. Both tables carry the six-column audit pair; conversion on the server | developer | 2026-08-23 |
| `Q2` | `desired_date` is required, and means *the date by which the target must be fully allocated and available* | developer | 2026-08-23 |
| `Q3` | No goal revision history in V1. Target and date are overwritten | adopted, uncontested | 2026-08-23 |
| `Q4` | The 90.00 is a virtual set-aside; the migration is deterministic | developer | 2026-08-23 |
| `Q4b` | `020` restores the 90.00 to `CASH` and writes **no** allocation; the pocket lands at zero | developer | 2026-08-24 |
| `Q5` | The pocket keeps its `note` | assumed, unopposed | 2026-08-23 |
| `Q6` | Allocating above the target is allowed and shown | developer | 2026-08-23 |
| `Q7` | `daysRemaining` and `requiredMonthly` ship; `runRate` and `projectedDate` do not | spec | 2026-08-23 |
| `Q8` | **Hard delete**, at any net. No close, no `closed_at`. `QP-20` superseded | developer | 2026-08-23 |
| `Q8b` | An account backing pockets **can** be deleted; the service deletes its allocations explicitly after the impact report | review, adopted | 2026-08-24 |
| `Q9` | Dissolved with `Q8`: there is no closed state to filter | spec | 2026-08-23 |
| `Q10` | The accounting-dashboard pocket tile leaves the totals | spec, pending objection | 2026-08-23 |
| `Q11` | Both overview pocket readings are removed, not repointed | spec, pending objection | 2026-08-23 |
| `Q12` | No `savings` type and no reuse of catalog id 4 | spec | 2026-08-23 |
| `Q13` | `U7` of the edit block excludes the pocket door by name | spec | 2026-08-23 |
| `Q14` | The editor **does** send `target` and the controller stores it unconverted — but production holds no pocket account, so commit 0 is dropped | measured + spec | 2026-08-24 |
| `Q15` | Double submit: the control disables in flight; no idempotency key in V1 | spec | 2026-08-23 |

### 11.1 `Q8b` — **CLOSED 2026-08-24**: the account can be deleted

`QP-19` — *an account with a non-zero net allocation cannot be deleted* — was
frozen in `POCKET_DECISIONS.md` §14.6 under the assumption `Q8` has now overturned, and
it is enforced in `deleteAccountService.js`, which belongs to
`PLAN_ACCOUNT_DELETION.md`.

Neither answer loses money — an allocation is not money — so this is a question
about what the owner is told, not about integrity.

**Decision: the deletion proceeds.** `getAnnulmentImpactReport.js` names every
pocket that loses backing and by how much; the owner confirms; the service deletes
the allocation rows and the account **in the same transaction**. A real account is
never held hostage by a planning artefact — that would let the intent domain block
the custody domain, the coupling this whole model removes.

**The foreign key stays `ON DELETE RESTRICT`** (§3.2), and the reason has to be
written into `PLAN_ACCOUNT_DELETION.md` or the next reader will misread it as a
prohibition. `RESTRICT` does not mean *an account with allocations cannot be
deleted*; it means *the deletion of those allocations is a statement the service
makes out loud, inside the transaction, after the owner has seen the impact*. A
cascade would delete them too, silently, with no report and no chance to refuse —
which is exactly the failure mode `002_accounts.sql:190-193` produces today.

Order inside the transaction: report → confirm → `DELETE FROM pocket_allocations
WHERE source_account_id = $1` → the existing account deletion path.

**What the confirmation says, and the sentence it must not omit.** It names the
account, lists each pocket that loses backing with the amount that goes, and totals
them:

```
Delete BBVA Savings?

This account currently supports:

  Emergency Fund      $2,000.00
  Vacation              $500.00

  Total allocated     $2,500.00

Deleting this account removes these allocations from the affected pockets. The
money itself is not deleted; only the pocket assignments are removed.
```

The last sentence is the load-bearing one. Without it the dialog reads as *you are
about to destroy $2,500*, and an owner who believes that will not delete an account
they are entitled to delete. What actually happens is that each pocket keeps its
target and its date, loses that allocation, and its `remaining` grows by the same
amount — the plan is untouched, only the backing is gone.

The effect on the pocket side, stated in full: the allocation rows go, the pockets
keep target and date, `allocated` falls, `remaining` rises, and a pocket that was
`funded` may stop being so. No balance moves, because no allocation ever held one.

### 11.2 `Q10` and `Q11` — the two the spec decided and the developer has not objected to

**`Q10`.** `AccountingDashboard.tsx:52` renders a `pocket_saving` tile whose figure
is `SUM(ua.account_balance)` grouped by account type. Once the pocket account row
is gone that sum is empty; repointed at the allocations it would show money
**already counted inside the bank tiles beside it** — the on-screen double count
this whole change removes. Its link is `/fintrack/budget/pockets` (`:65`), a route
in the *budget* module, which is why the duplicated card exists at all.

Decision: the tile leaves the totals. If the figure is wanted there it returns as
a memo line clearly outside them — *Allocated to pockets*, not a balance — linking
to `/fintrack/pocket`.

**`Q11`.** `OverviewLayout.tsx:145` adds `pocketBalance.total_balance` into a
computed figure and `Overview.tsx:111`/`:481` render *Last Movements (pocket)*.
Under this model the first becomes 0 and the second is permanently empty.

Decision: both removed, not repointed. A *Pocket summary* card in the overview is
**declined for V1** — it is a new feature in a module this block does not own, and
the owner's boundary is that the app-wide overview does not carry another module's
KPIs. It is the overview block's decision, on its own evidence, and the proposal it
decides on now lives in that block's own documents — §17 points at them (written
2026-08-24 at the developer's request). None of it ships inside pocket V1.

### 11.3 `Q12` — why the freed catalog slot is not reused

The catalog has seven types and no `savings` (`005_base_catalogs.sql:35-42`). A
savings account is entered as a `bank` account, so nothing in the data marks the
account the owner does not touch. The question is real but it is **not a pocket
question**: `balance − allocated` is identical either way, and the source
breakdown already answers *where is the money backing this goal*, by account name.

Renaming id 4 from `'pocket_saving'` to `'bank_saving'` is refused twice over:

- **The id is free but its meaning is not.** Every pre-`020` record carries id 4
  meaning *pocket*. Restore a pre-migration dump against a post-migration catalog
  and pockets come back labelled as savings accounts, with nothing in the schema
  to reveal it.
- **A savings account is a bank account, and a type asserts behaviour.** It is a
  transfer origin and destination like a bank account, an allocation source like
  one, and it computes identically in every total. **26 sites in 11 backend files
  branch on the literal `'bank'`.** Making savings a *type* means every one of them
  becomes "bank or savings", and each one missed is a savings account that silently
  drops out of a total or a selector — the same class of leak this design removes
  for pocket, re-introduced for a label.

A **subtype** says *same behaviour, different flavour*, which is what a savings
account is. If it is wanted later the cheap shape is a nullable `account_subtype`
defaulting to `NULL` — no backfill guessing — rendered as a label and used by
nothing that computes.

**Disposition, in the words that go into the code comment and the block that
inherits it:**

> **Savings account classification:** out of scope for Pocket V1. A savings account
> remains `account_type = bank`. If account-level classification is required in a
> future release, use a nullable `account_subtype` (default `NULL`) as a descriptive
> attribute only; it must not alter account behaviour or financial calculations.

Id 4 keeps the name `'pocket_saving'` and is marked deprecated in the catalog's
comment.

**And the subtype does not stay buried here as a note.** It is not a pocket
question at all — it belongs to the account domain, it can affect modules this
block does not own, it needs a decision about every bank account that already
exists, and it is the thing that would drag the 26 `'bank'` branch sites into a
release that has no need of them. A note inside a pocket spec is where a
cross-domain decision goes to be forgotten. It gets its own document:
**`plan-docs/future/PLAN_ACCOUNT_SUBTYPE.md`**, opened 2026-08-24, and pocket V1
does not depend on it in any way — the allocation arithmetic never asks whether a
bank account is checking or savings.

### 11.4 `Q13` — the collision with the edit block

`PLAN_EDIT_BLOCK.md` unit `U7` lists `PocketDetail.tsx:161` as one of five inert
edit doors and specifies that all five navigate to `/fintrack/account/:accountId/edit`.
Under this spec a pocket is not an account, so that door must open
`PocketEditModal`. **`U7` lands on four screens and excludes the pocket door by
name, with the reason written in.** Whichever block moves first, the other has to
know.

> **CORRECTED 2026-08-30 — the collision is resolved and the pocket door is no
> longer inert.** The detail carries its own control,
> `pages/forms/pocketDetail/PocketEditLink.tsx`, which opens the pocket's own
> route (`App.tsx:352`) rather than the account editor — so the exclusion this
> section asks for was honoured and no pocket id is handed to
> `/fintrack/account/:id/edit`. What shipped is a **route**, not the
> `PocketEditModal` this section names; that difference is a decision recorded in
> `POCKET_SEQUENCE.md` §5.2 and is not settled here.

### 11.5 What the review of 2026-08-24 changed

A full review of this spec produced five corrections and one rejected proposal.

| # | raised | disposition |
|---|---|---|
| 1 | split `amount` into `source_account_amount` + `pocket_amount`, so a COP account could back a USD pocket | **rejected.** The premise does not describe this database — §3.2 |
| 2 | `requiredMonthly` returns the whole remainder once the date has passed, under a label that does not answer it | **adopted.** `null` plus a worded line — §6 |
| 3 | `progress` may exceed 100% and the contract only said so about the bar | **adopted.** The contract now states raw-versus-clamped explicitly — §6 |
| 4 | `400` for an ineligible source account is inconsistent with the module's own `400`/`422` line | **adopted.** `422` — §8.3 |
| 5 | *convert each non-zero `movement_type_id = 5` transaction* is too broad as a written rule | **adopted.** The qualifier is the owner's confirmation, not the movement type — §9.0.5, §9.1 |
| 6 | `Q8b` should close in favour of deleting the account | **adopted**, with the reason `RESTRICT` is kept written down — §11.1 |

**And one requirement the review did not raise, added by the owner:** each
allocation history row opens a detail modal stating the conversion, the way a
transaction row already does. Reuses `AccountTransactionDetailModal.tsx` — §7.2.

### 11.6 The indicator levels, added 2026-08-24

§6 was a flat list of formulas. It is now organised by the level each figure is an
indicator **of**, because the level is what decides where the figure is written and
what it is allowed to say. Three things the flat list left unstated, and one defect
it hid:

- **The level and the write site are the same decision.** A base sum belongs in
  SQL, a figure needing `today` or a division belongs in the pure core, a fold
  across pockets belongs in the service, and the component computes nothing — §6.
- **Counts are served, not counted on the client.** The filter chips and the hero
  read the same fold as the rows — §6.2.
- **`unassignedCash` is an indicator of the account module.** One number, two
  consumers: the allocate precondition inside the lock and the line on the account
  screen. Written once — §6.4.
- **The defect: `makeSummary` nets.** `totalTarget − totalAllocated` lets a pocket
  over-funded by $100 cancel another $100 short, and the hero then says nothing is
  missing. Money committed to one goal does not fund another. L5 clamps per pocket
  and sums after, reports the excess as its own figure, and `overallProgress`
  becomes `SUM(MIN(A, T)) / SUM(T)` — §6.3.

### 11.7 The review of 2026-08-24 (second), and what it changed

The review restates the model of §2 and agrees with it. Three things in it are new.

**Adopted: the allocation carries its own date.** The review's ledger sketch lists
a movement date beside `created_at`; this spec had only `created_at`, while §9.1
step 3, §7.2 and the detail modal all already required the date of the decision.
`allocation_actual_date` is added in §3.2 and served as `allocationDate` in §8.2.

**Adopted: the vocabulary, and a signal at the moment of the expense.** *Allocated*
— what the owner decided to reserve — and *Coverage* — how much of it real cash
still backs — are two different questions, and naming them apart is what stops the
screen from claiming money is backed when it is not. The wording of §7.2 and §7.3
takes those two words. The signal is new work and it does **not** belong to this
module: it fires when a transaction leaves an account whose allocations exceed the
new balance, so it is written on the transaction write path and carried into the
transactions block, not here.

**Rejected: a per-pocket uncovered amount.** The review shows a pocket reading
*Allocated $600 · Supported by cash $500 · Uncovered $100*. That is computable only
because its example has one pocket on one account. With two pockets drawing on the
same short account, splitting the deficit needs a policy — pro-rata, oldest first,
largest first — and every one of them has the system inventing which goal lost its
backing. §2.6 stands: the amount is stated on the account (`isOverAllocated`,
`unassignedCash`, L4), and the pocket carries the boolean `uncovered` plus the name
of the source that is short.

**Rejected, and why, for the rest.**

| the review proposes | why not |
|---|---|
| `allocation_type` = allocate / release | derivable from the sign of `amount`; the same fact stored twice (`QP-17`). The review concedes this in its own §25 |
| `fx_converted_amount` beside `amount` | the two-amount proposal already rejected in §3.2 |
| `pockets` without a currency column | `exchange_rate_target_currency_id` must equal something, and it is the pocket's own accounting currency (§3.1) |
| source accounts limited to `bank` | the production allocation's source is `CASH` (account 109). Cash is spendable money and is an eligible source; the exclusion is investment only (§4) |
| a *Target reached* panel with `Keep funded` | three of its four actions already exist as the detail's own actions, and the fourth closes the panel. §4 states there is no *Meet target* operation |
| an `On Track` count in the board hero | it needs actual pace against required pace, which is `runRate` — not shipped (`Q7`, §6.5). Defined without it, `On Track` is `not funded and not overdue`, which is the `Active` filter under a second name |

**Adopted, and it rewrote the migration: `020` writes no allocation.** The review
argued that converting the $90 into an allocation turns real money into an
intention the owner never stated, and the developer closed it that way on
2026-08-24 — *"deja el pocket en cero, creo que es lo más KISS"*. `CASH` gets its
90.00 back, the pocket lands at `allocated = 0`, and `pocket_allocations` is
created empty. §9.1 and §9.2 carry the consequences: one fewer step in the UP, and
a DOWN that reinserts the deleted transactions from values written into the
migration file rather than from a table that no longer holds them.

### 11.8 `Q14` — **CLOSED 2026-08-24: commit 0 is dropped**

Measured in the code, no database required.

**The path is reachable.** `accountEditSchema.ts:157-164` declares `target` for
`pocket_saving` as `isEditable`, `isRequired` and `isCritical`; `EditAccount.tsx`
renders that field map generically, so it needs no pocket branch of its own to
render the input and send the value. `accountEditController.js:92` then writes
`specificFields.target = payload.target` verbatim, and the file contains no
`exchange_rate` and no conversion anywhere. A target typed in a foreign currency is
stored as if it were the accounting currency — an error of whatever the rate is,
which the schema cannot detect afterwards.

`§11.1` of `POCKET_DECISIONS.md` guessed the opposite — that `EditAccount.tsx` has no
pocket branch and therefore never opens the editor — and it is wrong: the branch is
in the field map, not in the component.

**Its blast radius is zero.** The owner deleted the last `pocket_saving` account on
2026-08-24 (§1). There is no account the corruption can be applied to, and the
commit would repair a write path that migration `020` removes.

**Decision: commit 0 is dropped, and one condition comes with it.** The creation
route `POST /new_account/pocket_saving` (`accountRoutes.js:58`) is still live, and
it stays live — retiring it before the new module can create a pocket would leave
the app with no way to create one at all, which is a regression, not a cleanup
(§10.3 keeps it in the retirement step for that reason). So the defect returns to
reach the moment a pocket account is created the old way.

**The condition is on the owner, not on the code: do not create a pocket account
between now and migration `020`.** If one is created and its target is edited in a
foreign currency, commit 0 comes back and ships first — live corruption does not
wait for a migration.

> **CORRECTED 2026-08-30 — the condition has been discharged by the code and no
> longer rests on the owner.** The creation route is withdrawn
> (`accountRoutes.js:57-62`) and so is its handler
> (`accountCreationController.js:977-985`), so no pocket account can be created
> the old way; migration `020` has run against the development database, which
> holds zero accounts of that type and an empty extension table; and the new
> module creates pockets through `POST /api/fintrack/pocket`, so nothing was left
> without a way to create one. What survives is the **edit** branch
> (`accountEditController.js:90-101`, write map `:311`), still with no reference
> to `exchange_rate` or `currencyAmountConversion` — reachable by a token holder,
> but with no row of that type to apply it to and no client that names the type.

---

### 11.9 The overview indicators moved out, 2026-08-24

Written into §17 first, then moved to the overview plan at the developer's
instruction — `OVERVIEW_DECISIONS.md` D44 for the closure and its invalidations,
`PLAN_OVERVIEW_KPI_CATALOG.md` §3bis for the pocket entries and §3ter for the
savings entries. §17 keeps only the three pocket facts those sections rest on: the
fold is over accounts, a pocket measures intention while savings measures fact, and
the rejected pace figure is answerable from `transactions`.

The move is the point. A proposal duplicated in the module that supplied the
evidence and in the module that executes it drifts the first time either is edited,
and the overview block is the one that decides.

---


### 11.10 The eleven screen decisions, closed 2026-08-29

Section 7 defines the screens at the level of *which figures appear*. Eleven
questions remained at the level of *how the component behaves*, spread over the
commits from 8 to 19. All eleven are closed here, and each names the commit it
binds.

| id | question | decision |
|---|---|---|
| `QS-1` | what the board hero shows when every amount is null and every count is 0 | the empty state replaces the hero entirely; a hero of dashes invites reading five figures that do not exist (commit 8) |
| `QS-2` | what a card shows for a pocket created a minute ago, `sourceCount` 0 and nothing allocated | the bar at 0% and the source line worded *no allocations yet*, never *0 accounts* (commit 9) |
| `QS-3` | which criteria the board sorts by, which 7.1 calls *sort* and never enumerates | desired date ascending by default, plus name and remaining (commit 10) |
| `QS-4` | whether the five filters are exclusive or cumulative | exclusive: funded and overdue cannot both hold, and three stacked chips produce an empty set with no explanation (commit 10) |
| `QS-5` | the wording that replaces `requiredMonthly` when the desired date has passed and the value is null | *The desired date has passed*, followed by the remainder, and no invented monthly pace (commit 11) |
| `QS-6` | whether the source table lists an account whose net held fell to zero after a full release | no, only accounts still contributing; the allocation history already keeps the trace of the one that left (commit 12) |
| `QS-7` | how three numeric columns plus a name survive 360px | the table becomes cards; horizontal scroll hides the very column that disambiguates (commit 12) |
| `QS-8` | how the sign of a history row is presented | the word plus the sign; colour alone survives neither colour blindness nor print (commit 13) |
| `QS-9` | `AccountTransactionDetailModal` takes `{ transaction, onClose }` and an allocation is not a transaction | generalise the prop to `movement`; adapting the row means fabricating transaction fields an allocation does not have (commit 14) |
| `QS-10` | whether the source selector lists every eligible account or only those with unassigned cash above zero | all of them, the ceiling written into the option and the zeroes disabled; hiding one leaves the owner unable to see why an account is missing (commits 15 and 16) |
| `QS-11` | whether the edit modal computes the new monthly pace before saving | no: it would be the one figure derived on the client, which 6.2 forbids. The modal states that the pace changes and the new value arrives in the response (commit 17) |

Two further questions were raised and answered by consistency with what the app
already does, rather than by anything specific to this module:

- the deletion confirmation is a **modal**, not a page like `AccountDeletionPage.tsx`,
  because deleting a pocket moves no money and produces no impact report, which is
  what justifies the page for an account (commit 18);
- the three lines of 7.3 land on **bank and cash accounts only**, since *unassigned
  cash* means nothing on a credit card. A negative `unassignedCash` renders as the
  negative figure with a line naming the over-allocation, and blocks nothing (commit 19).

**What of this binds the backend.** Only `QS-3` can reach the contract: if a sort
criterion ever needs a value the server does not send, `GET /board` grows a query
parameter and stops being the frozen payload of 8.1. All three criteria chosen are
served today, so it does not.

---

## 12. Defect disposition

| id | defect | disposition |
|---|---|---|
| `P-1` | the board's committed amount is built and never rendered | fixed by §7.1 |
| `P-2` | the headline is `total_target` under a title that says savings | fixed by §7.1 |
| `P-3`…`P-6` | the four remaining board/card defects catalogued in `POCKET_DECISIONS.md` §1.4 | fixed by the rewrites in §10.2 |
| `P-7` | `POCKET_DECISIONS.md` §1.3 | fixed by the rewrites in §10.2 |
| `P-8` | the pocket edit path writes `target` with no conversion and no audit pair | **reachable and real, but it applies to zero accounts** (`Q14`, §11.8). Retired with the branch, the way `8fba00e` retired the budget module's twin defect |

> **RE-MEASURED 2026-08-30.** `P-1`, `P-2`, `P-3`, `P-4`, `P-6` and `P-7` are
> closed on screen: the board's headline is one of three peer tiles including
> `totalAllocated` (`PocketBigBoxResult.tsx:154-192`), the card's square comes
> from the served flags through `helpers/pocketStatus.ts`, the row formats its
> date through `formatCalendarDate` in one locale, and the detail hero prints the
> served `progress` (`SummaryPocketDetailBox.tsx:113`) rather than the remaining
> share. `P-5` is **void rather than fixed** — the detail fetches no transaction
> window at all, so there is no `toISOString()` bound left to shift. `P-8`
> stands: the branch is still mounted at `accountEditController.js:90-101`, still
> with no conversion, and still applying to zero rows.

---

## 13. Commit sequence

One commit, one logical change. Each message describes the actual change, not the
intent. Every commit passes the four gates of `CLAUDE.md`.

| # | message | note |
|---|---|---|
| — | merge `feat/budget` into `feat/pocket` | 23 commits behind and 5 ahead, measured 2026-08-26; re-check the free migration number after |
| — | *(commit 0, `fix(pocket): convert the edited target`, was dropped — `Q14`, §11.8)* | |
| 1 | `feat(db): add the pocket allocation tables` | `020` + `createTables.js`, same commit |
| 2 | `refactor(pocket): read allocations on the board` | the one wrong line in `pocketRepository.js` |
| 3 | `feat(pocket): add the pocket detail endpoint` | §8.2 |
| 4 | `feat(pocket): add create and edit endpoints` | §8, `POST /` and `PATCH /` |
| 5 | `feat(pocket): add allocate and release` | §8.3, §8.4, with the row lock |
| 6 | `feat(pocket): add pocket deletion` | §8.5 |
| 7 | `feat(account): expose allocated and unassigned` | §8.6 |
| 8 | `feat(pocket): rebuild the board hero` | `PocketBigBoxResult.tsx` — named props, the L5 totals of §6.2, `Committed above goal` as its own line |
| 9 | `feat(pocket): rebuild the pocket card` | `ListPocket.tsx` — allocated, target, remaining, the progress bar, the date, `sourceCount` |
| 10 | `feat(pocket): add the board control bar` | search, sort and the five filters (§7.1) |
| 11 | `feat(pocket): rebuild the detail hero` | `SummaryPocketDetailBox.tsx` — the formatted target, coverage, the funded and overdue badges |
| 12 | `feat(pocket): add the source breakdown table` | §7.2 — the three figures per source account, and the coverage warning |
| 13 | `feat(pocket): add the allocation history list` | §7.2 — replaces the transaction statement, which a pocket does not have |
| 14 | `feat(pocket): add the allocation detail modal` | §7.2 — reuses `AccountTransactionDetailModal.tsx`'s shape for the FX detail |
| 15 | `feat(pocket): add the allocate modal` | `useCurrencyPreview`; the ceiling is the source account's `unassignedCash` |
| 16 | `feat(pocket): add the release modal` | its selector reads the source table, not the account list (`QP-18`) |
| 17 | `feat(pocket): add the pocket edit modal` | target and date in one request, with the `requiredMonthly` consequence line (§5) |
| 18 | `feat(pocket): add the deletion confirmation` | names the cash each source account gets back (§8.5) |
| 19 | `feat(account): show allocated and unassigned` | §7.3 — the three lines on the account detail, consuming commit 7 |
| 20 | `refactor(transfer): drop the pocket movement` | |
| 21 | `refactor(dashboard): drop the pocket tile` | `Q10` |
| 22 | `refactor(overview): drop the pocket readings` | `Q11` |
| 23 | `refactor(account): drop pocket account creation` | route, controller, edit case |
| 24 | `refactor(db): drop pocket_saving_accounts` | cleanup migration, only after 23 |
| 25 | `docs(rules): correct the pocket balance rule` | `README_FRINTRACK_BUISINESS_RULES.md:13` |

> **RE-MEASURED 2026-08-30 — twenty-two of the twenty-five rows have shipped, in
> a different grouping.** Commits 1 to 7 are all in (`pockets` and
> `pocket_allocations`, the board reading the ledger, the detail endpoint, create
> and edit, allocate and release, delete, and the account-detail enrichment).
> Commits 8 to 19 shipped as fewer, larger units than one component each — the
> board header, the card, the detail hero, the source table, the allocation
> history, the entry modal, the commit-and-release form, the editor and the
> deletion confirmation all exist. Commits 20 to 23 have run: the pocket left
> both transfer selectors, the dashboard tile went, the overview readings went,
> and the creation route and its controller are withdrawn.
>
> **Three rows have not shipped:** commit 10, the board control bar — no search,
> sort or filter exists; commit 19, the three lines on the account detail —
> `AccountDetail.tsx` is untouched; and commit 24, dropping
> `pocket_saving_accounts`, which is correctly last and still gated. Commit 25,
> the business-rules note, was not checked.
>
> **The ordering this sequence rests on was not the one followed.** The frontend
> did not switch over component by component behind a working backend; the detail
> chain went first as `POCKET_SEQUENCE.md` §1 argued, and that document is what
> orders the remaining work.

**Backend before the frontend it feeds.** Commits 1–7 leave the app working on the
old screens; 8–19 switch the screens over one component at a time; 20–24 remove
what nothing calls any more.

**The frontend is built component by component, and that is why the backend goes
first.** Every component from 8 onward reads an endpoint that already exists and
already serves the whole screen — `GET /board` from commit 2, `GET /:pocketId` from
commit 3 — so a single component can switch over while its neighbours are still on
the old payload, and the app boots at every commit. The inverse order would force
each component to ship with a stub, which is how a screen ends up with two data
sources.

**One component per commit means the whole component**, not a first pass on it:
its markup, its own block of CSS on `tokens.css`, and its five interactive states
including the `:focus-visible` ring that no pocket rule declares today. A component
left with hardcoded hexes for a later cleanup pass is a half-applied change, not a
tidy commit.

**The stylesheet migrates with its components, not in one retrofit.**
`pocket-styles.css` consumes the legacy literals `--light`, `--creme` and `--dark`
plus `#1b1b1b`, `#5b5b5b` and `#bdb1b1`, and carries three dropped declarations
(`color: cyan f`, `white-space: 10px`, a `width` overridden in its own block) and
one `!important`.

> **Re-measured 2026-08-30: the migration happened by addition, not by
> replacement, and the legacy half is untouched.** The file is 1141 lines; the
> token-written blocks sit below the legacy ones, which still carry `color: cyan
> f` (`:156`), two `!important` (`:14`, `:260`), the duplicated `.pocketLayout`
> (`:4`, `:11`) and the dead `.card__budget--title` (`:122`). So the closing
> clause of this paragraph — *after commit 19 no legacy name and no raw value is
> left in the file* — is not what happened. Each commit above takes its component's block onto the semantic
tokens and leaves the rest untouched; after commit 19 no legacy name and no raw
value is left in the file. What is corrected on the way is the block the commit was
already rewriting — never a neighbouring one.

---

## 14. Reuse — what is not written from scratch

| need | what already does it |
|---|---|
| row lock + ownership proof | `lockOwnedAccount`, `budgetAllocationService.js:106-131` |
| server-side conversion | `currencyAmountConversion`, `fx_services/conversion/` |
| currency id lookup on the transaction's client | `getCurrencyId` / `getCurrencyCodeSync`, `utils/currencyLookup.js` |
| rounding at the write boundary | `money.js` under `budget_services` |
| converted preview in a form | `useCurrencyPreview`, already used by `NewPocket.tsx` |
| a modal that owns no request and states the consequence | `BudgetEditModal` |
| the error shape and the no-404 rule | `budgetTypes.ts:198-216` |
| totals folded from rounded rows, empty and mixed-currency handling | `pocketBoardService.js`, `makePocketStatus.js` |

---

## 15. Verification

**The schema.**
1. `SUM(pocket_allocations.amount)` per account equals what the account detail
   reports as `allocated`.
2. No `CHECK` anywhere enforces `SUM(allocations) ≤ balance` — inserting an expense
   that over-allocates an account succeeds.
3. `pocket_allocations` has no `UPDATE` and no `DELETE` path in any repository.
4. `createTables.js` and `020` produce the same two tables, column for column.

**The migration.**
5. Before: the funding account's balance plus the pocket's balance. After: the
   funding account's balance alone equals that sum, and the pocket's `allocated`
   equals what the pocket account held.
6. The DOWN restores the account row, its extension row, both transactions and
   both balances — verified by running UP, DOWN, UP on a copy.
7. Every artefact production holds is named in the migration, re-measured against
   the live copy (§9.0), not against the 2026-08-22 rehearsal reading.

**The rules.**
8. Allocating more than the source account's unassigned cash returns `422` naming
   both figures.
9. Releasing more than the pocket holds from that account returns `422` naming both
   figures.
10. Two concurrent allocations against the same account cannot both pass.
11. Deleting a pocket with a non-zero net succeeds, frees the cash, and writes no
    balance and no transaction.
12. A pocket id belonging to another user returns `403`, and a pocket id that does
    not exist returns `403` — never `404`, never a different code from the other.

**The screens.**
13. Every figure on every screen traces to a column or an aggregate in §3 or §6,
    and to exactly one level of §6.2 — no figure is computed at two levels.
14. Loading, error and empty are three distinct states on the board, the detail and
    the account detail; no figure renders as `0` or `NaN` while unknown.
15. The board's `Total allocated` and the sum of the cards' `allocated` agree.
15b. One pocket over-funded and one short by the same amount: `Total remaining`
    reports the shortfall, not zero, and `Committed above goal` reports the excess
    (§6.3). This is the test the current `makeSummary` fails.
15c. No client file computes a figure named in §6.2 — the components read and clamp.
16. `APP LOADED OK` on the boot test before every commit (Gate 3).

**The end state.**
17. No screen, endpoint or query treats a pocket as an account.
18. `git status` clean; the plan docs under `plan-docs/ongoing/` are committed.

---

## 16. Known limits, recorded rather than solved

- **A double submit writes two allocations** (`Q15`). The endpoint is append-only
  and has no natural key, so two clicks are two legitimate rows. The control
  disables while the request is in flight; there is no server-side idempotency key
  in V1, because a key means storing a client-supplied token per row for a case a
  disabled button already covers.
- **No goal revision history** (`Q3`). A pocket at 90% of $1,000 reads 45% the
  instant the goal becomes $2,000, with nothing having happened to the money — and
  pushing the date out erases the fact that it was overdue. Accepted; the argument
  and its commits stay in `POCKET_DECISIONS.md` §11.
- **No pace forecast** (`Q7`). `runRate` and `projectedDate` return when someone
  decides what the pace of a *commitment* means.
- **No pocket-to-pocket move.** Release on one, Allocate on the other. Two rows,
  both true.
- **`money.js` is imported across a module boundary.** It lives under
  `budget_services`. Moving it to a shared core is its own refactor.
- **No savings subtype** (`Q12`). The risk signal it would add — money allocated
  from an everyday account is likelier to end up over-allocated than money in an
  account nobody touches — is a reason to want it eventually, not a reason to block
  the module on it.

---

## 16-bis. The allocation model fixed the open indicator questions — 2026-08-29

**A pocket is not an account and holds no money.** It is a plan for distributing
money that sits in real accounts. Four decisions follow, all recorded with their
reasoning in `POCKET_DECISIONS.md` section 15, and all of them already satisfied by the
code on the pocket branch:

- The detail hero states the **plan** — target, allocated, remaining, progress,
  desired date, required monthly, days remaining. The balance-and-movements hero is
  deleted, not relocated: it describes an object that owns money.
- **No revision history in V1.** The plan is replaced when edited, and it is called
  *edit the current plan*, never *revision history*. Migration 019 and its revisions
  table are cancelled.
- **Run rate and projected date do not ship.** One needs a past, the other predicts
  a future. Required monthly stays: it is present-tense arithmetic.
- **FX is not a pocket feature.** Every money form in a non-accounting currency uses
  the mechanism the application already has, pocket forms included.

## 17. Overview-level indicators — moved out of this document

**This section is a pointer. The proposal now lives in the overview plan, which
owns the screen that would render it.** It was written here first, on 2026-08-24,
because the evidence for it is here; the developer then placed it where it is
executed. Keeping the full text in both files would let two documents drift on a
subject only one of them decides.

| where | what it holds |
|---|---|
| `OVERVIEW_DECISIONS.md`, **D44** | the closure — *a pocket is an allocation* — and the entry-by-entry list of what that invalidates in the overview plan |
| `PLAN_OVERVIEW_KPI_CATALOG.md`, **§3bis** | the pocket entries that replace P1-P4: free cash, the count of over-allocated accounts, committed cash as a memo line |
| `PLAN_OVERVIEW_KPI_CATALOG.md`, **§3ter** | the savings entries: net cash change, savings rate, its 6-month series, and the required-pace comparison |

Three statements from this document are what those sections are built on, and they
stay here because they are pocket facts, not overview facts:

**An overview pocket figure folds over accounts, never over pockets.** The overview
answers *where is my money*; the board answers *are my goals covered*. The same
allocation rows folded the two ways give different figures the moment an account is
short, and duplicating the board's fold on the home screen is the discrepancy §7.1
forbids. The single exception is the required pace across goals, and it is an
exception because a pace is not a money figure and has no custody.

**A pocket measures intention; savings measures fact.** `allocated` grows when the
owner reserves money they already had — no money arrived. Six pockets can reach
100% in a month the cash position falls. So **no savings figure reads
`pocket_allocations`**; all of them read `transactions`.

**The pace figure `Q7` rejected is answerable from the other side.** `runRate` was
refused because a rate read over the allocation ledger measures how often the owner
changed their mind (§6.5). Read over `transactions` it measures money actually
arriving, which is the only thing comparable against `SUM(requiredMonthly)`.

**L6 is no longer empty by decision** (§6.1). It was empty because the only
candidates were the two broken readings of `Q11`, both of which added a pocket
balance into a money figure. The level below is what makes a correct L6 figure
possible; what that figure is, the overview block decides.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

This document is the contract, and the contract did not move. §2 (the model), §3
(the data model), §4 (the workflow), §5 (how every value is edited), §6 (the
seven levels and the register), §8 (the API contract) and §11's decision register
were re-read against the code and stand. What aged is the small number of
statements about the state of the tree. Corrected in place; **no decision was
touched, no register row was closed and no commit was reordered.**

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| "one line of the backend is wrong — `pocketRepository.js` reads `saved` from `ua.account_balance`", and "the frontend is untouched" | §1, closing paragraphs | no read selects the stored balance; all four pocket screens were rewritten onto the module's endpoints, and six of the seven catalogued defects are closed |
| "the next free migration number is `021`" | §9, the re-check block | `021_create_daily_exchange_rates.sql` exists; the next free number is `022` |
| the thirteen retirement rows | §10.3 | eight have run, including the creation route this section scheduled "with the migration"; five stand, named in the block above the table |
| the condition placed on the owner not to create a pocket account | §11.8 | discharged by code: the route and its handler are withdrawn and the migration has run |
| the pocket's inert edit door and its collision with the edit block | §11.4 | resolved — `PocketEditLink.tsx` opens the pocket's own route, so no pocket id reaches the account editor |
| the two levels of navigation and their anchors | §7 | the statement holds; four route slots now, at `App.tsx:212`, `:293`, `:339`, `:352` |
| the disposition of the eight defects | §12 | six closed, `P-5` void rather than fixed, `P-8` standing and still applying to zero rows |
| the twenty-five-commit sequence and the stylesheet's per-component migration | §13 | twenty-two shipped in a different grouping; the stylesheet was extended, so its legacy half is intact |

**Left standing because they are still true:** the three-decimal-place contract
of §0.2 as the backend inventory records it; `pockets` carrying no unique
constraint on `(user_id, name)` and no state column; the six FX columns on
`pockets` written and never read; the deadline validated on neither create nor
edit, which §19.7 of the decisions record rules against and the code does not yet
implement; and every limit of §16.

**Not re-measured:** anything about production. §9.0's four counts were taken
against production on 2026-08-24 and this reading did not connect there; the
disagreement about the one legacy pocket account stays exactly where §9.1 of
`PLAN_POCKET_FE.md` leaves it.
