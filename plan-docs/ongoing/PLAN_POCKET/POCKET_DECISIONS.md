# PLAN — POCKET

**Written:** 2026-08-15 as `POCKET_INDICATORS.md` · **Unified 2026-08-22** ·
**Lives in `plan-docs/ongoing/`, which `.gitignore:123` re-includes: this file is versioned.**

> ### WHICH SECTIONS ARE ALIVE — read this before anything else
>
> **Renamed and moved 2026-08-29** from `ongoing/PLAN_POCKET/POCKET_DECISIONS.md`. The three
> pocket documents now sit together and divide like this:
>
> | file | what it holds |
> | --- | --- |
> | `POCKET_MODULE_SPEC.md` | **the contract** — what must exist |
> | `POCKET_BACKEND_INVENTORY.md` | **the measurement** — what does exist, endpoint by endpoint, plus nine defects |
> | this file | **the decisions** — what was decided and why |
>
> **Sections 15 to 18 are the current state and are newer than the spec.** They
> hold the frozen model, the migration rehearsal and the screen decisions, and
> where they disagree with `POCKET_MODULE_SPEC.md` they win. The spec's own
> section 16-bis points back here for exactly that reason.
>
> **Sections 1 to 14 are history.** They were written for a pocket that held
> money and they are kept to show how the decisions were reached, not to be
> implemented from. Section 14 is still titled PROVISIONAL and section 16
> replaced it.
>
> The banner this replaces said to implement from the spec and never from this
> file. That was true on 2026-08-23 and stopped being true on 2026-08-29, when
> the model was frozen here.
>
> The model changed underneath most of this file on 2026-08-23: **a pocket no
> longer holds money, it commits money that stays in the real account.** Three
> sections are now wrong as written and are kept only as history —
>
> - **§10**, the hero of *Current Balance / Contributions / Withdrawals / Net
>   Change*, designed for a pocket that held a balance. §7.1 of the spec replaces
>   it.
> - **§12**, the indicator contract frozen 2026-08-21, and **§2.2**, which derives
>   it from the transaction history. Both were written when the figure meant
>   *money deposited*; it now means *money committed*. Two of the four figures
>   survive (spec §6), two do not.
> - **§11**, the goal-revision block. Its argument is accepted and its cost is
>   recorded, but revisions are out of V1 (spec `Q3`).
>
> **§14 is adopted whole** — it is the allocation model this spec implements — and
> its one provisional rule, `QP-18`, is resolved by the source breakdown in spec
> §7.2. **§14.5's refusal of Investment as an allocation source stands unchanged.**
>
> The commit sequence of §7 is replaced by spec §13, which renumbers from 0 and
> starts with the merge of `feat/budget`.

> ### 🔀 THE TWO POCKET DOCUMENTS ARE NOW ONE — 2026-08-22
>
> `PLAN_POCKET_ALERT.md` is **absorbed and deleted**. This file is the only
> pocket plan; the question it deferred on 2026-08-16 — which of the two
> governs — is answered here by date and by measurement, not by preference.
>
> **This document governs.** It was measured against `feat/pocket` on
> 2026-08-21 (§10), it froze the indicator contract that same day (§12), and it
> is the one carrying the commit sequence that has already landed four commits.
> The other was written on 2026-08-16 against an earlier reading of the code, and
> everything it measured has since been re-measured here.
>
> **What was carried over from it lives in §13**, which is the merge record: the
> markup rule that governs every commit in this block, the inverted colour
> mapping, the write-path commits this sequence did not have, and three findings.
> Nothing else survived — §13 also lists what was dropped and why.
>
> Numbering after the merge: **defects are `P-n`**, **decisions are `QP-n`**,
> **commits are numbered `0a`…`12`**. The absorbed document's `A1`–`A4`,
> `B0`–`B4`, `P1`–`P7` and `Q1`–`Q8` are void as labels; where their content
> survived it was renumbered into this file's series.

> ▶ **TRIGGER FIRED, 2026-08-21. THE INDICATOR CONTRACT IS FROZEN — §12.**
> The budget module closed end to end that day and this block is open. Commits
> 0a, 0b, 1 and 2 of §7 have landed on `feat/pocket`; see §7 for what each one
> actually did and §10 for what the measurement of 2026-08-21 corrected in this
> document.
>
> **Read §12 before §8.** Every decision gating commits 3 to 7 was taken on
> 2026-08-21 and one of them, `QP-7`, went against this document's own
> recommendation: the hero's headline is the amount saved, not the target.
>
> **§11 is a second block and it is not frozen.** Editing a pocket's target and
> desired date is specified there, with three decisions still open.
>
> ~~⏸ Trigger: the budget module closing end to end. D7 holds — nothing here
> becomes a Gate 1 until the budget sequence is verified on screen.~~ This
> document exists so the pocket work starts from a measurement instead of from
> the sketch.
>
> Read `PLAN_BUDGET_V1.md` §7.4 and `PLAN_BUDGET_FRONTEND.md` §10.9–§10.12 first.
> Pocket is the same problem the budget module just solved — a board, a row and a
> detail, all reporting figures the client was computing — and **more than half
> of this plan is that solution applied to a second account type**. Where budget
> already has an answer, this document names it instead of inventing a second one.

---

## 0. What this plan is, and what it is answering

The developer supplied a KPI sketch and a reference image. This document is the
evaluation of both against the code and the schema, plus the plan that comes out
of it. Three questions, in this order:

1. **Which of the sketch's KPIs can the model answer today?** Some are free, one
   needs a query the model can support but does not have, and two are not in the
   model at all.
2. **What is wrong with the screen as it stands?** Six defects, measured. Two of
   them mean the headline figure on the board is the wrong number.
3. **What lands, in what order?** Contract first, figures second, pixels last —
   the order D11 imposes and the one the budget module validated.

---

## 1. What exists today — measured 2026-08-15, not recalled

### 1.1 The model

```sql
pocket_saving_accounts (
  account_id  INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE CASCADE,
  target      DECIMAL(15,2),
  note        VARCHAR(155),
  desired_date       TIMESTAMPTZ NOT NULL,
  account_start_date TIMESTAMPTZ NOT NULL,
  -- FX audit columns, migration 015
  original_target, original_currency_id, exchange_rate,
  exchange_rate_source, exchange_rate_timestamp, exchange_rate_target_currency_id
)
```

`createTables.js:123-124`. The saved amount is **not here**: it is
`user_accounts.account_balance`, the lifetime balance of the account.

Three facts decide most of this plan:

| fact | consequence |
| --- | --- |
| **`desired_date` exists and is `NOT NULL`** | Every deadline-derived KPI of the sketch — required monthly, time-to-target, at-risk — is computable **without a schema change**. This is the single best piece of news in the measurement |
| **`account_start_date` exists** | Elapsed time is in the model, so a pace is expressible |
| **`target` is nullable, and the balance is lifetime** | A pocket with no target renders no progress at all, and progress must never be divided by a null or a zero |

Migration 015 gave the target its FX columns on 2026-08-14. `target` is the
amount in the accounting currency; `original_target` is what the user typed. Every
figure below reads `target`, never `original_target` — the origin is audit, not
arithmetic. This is the project's currency model, not a pocket rule.

### 1.2 The two endpoints, and there is no pocket service

Pocket has no module of its own. Both figures come from `dashboardController.js`:

| endpoint | what it returns | where |
| --- | --- | --- |
| `GET dashboard/balance/type?type=pocket_saving` | `total_balance`, `total_target`, `total_remaining`, `accounts`, `currency_code` | `:200-215` *(re-anchored 2026-08-21; was `:197-211`)* |
| `GET dashboard/balance/summary/?type=pocket_saving` | one row per pocket: `account_name`, `account_id`, `account_start_date`, `balance`, `target`, `currency_code`, `note`, `desired_date` | `:370-381` *(re-anchored 2026-08-21; was `:367-378`)* |

**Both also answer `400` when the user owns no pocket** *(measured 2026-08-21,
not in the original text)*: `rows.length === 0` returns `No available accounts of
type pocket_saving`. An empty board and a broken request were indistinguishable
to the client, which is why the board's empty state could not be built on these
two endpoints. `GET /pocket/board` answers `200` with `pocketCount: 0`.

Both filter `ua.account_name != 'slack'` — a magic account name in a `WHERE`
clause, inherited, out of scope here and worth its own remark.

### 1.3 The three screens

| level | file | what it does |
| --- | --- | --- |
| 1 · board | `PocketLayout.tsx` → `Outlet` → `Pocket.tsx` → `pages/pocket/components/ListPocket.tsx` | Two requests for one screen. The layout fetched the totals; the list fetched the rows. *(2026-08-21: `Pocket.tsx` sits between the two and was missing from this row. Superseded by commit 2 — one request, one store.)* |
| 2 · row | `pages/pocket/components/ListPocket.tsx:43-95` | Name, note, desired date, saved, goal, status square. **No progress, no pace, no percentage** |
| 3 · detail | `pages/forms/pocketDetail/PocketDetail.tsx` | Target, saved, a client-computed percentage, and a transaction list |

**Pocket has two levels of navigation, not three.** *(Confirmed 2026-08-21:
`App.tsx:209` declares the layout and `App.tsx:336` declares
`pocket/pockets/:pocketId` BESIDE it, not inside its `children`. Opening a pocket
therefore unmounts `PocketLayout` and anything hanging from its Outlet — which is
why commit 2 put the payload in a store and not in a route context, exactly as
`useBudgetStatusStore` did for the same reason.)* The board links straight to
the detail; there is no intermediate screen the way budget has category → accounts.
So the sketch's three blocks map as: hero → card → detail. Said plainly because
"levels 1, 2 and 3" means something different in each module, and assuming they
match is how a plan ends up specifying a screen that does not exist.

### 1.4 Six defects, with evidence

| # | defect | evidence |
| --- | --- | --- |
| **P-1** | **The board's headline figure is the target, under a title that says savings.** `bigScreenInfo[0]` is `total_target` and the hero renders index 0 as the big number | `PocketLayout.tsx:47-51`, `PocketBigBoxResult.tsx:14-16`. *(2026-08-21: precise reading — the hero renders index 0 with **no label at all**; the string `'total target'` at index 0 is never read. The word "savings" comes from `TitleHeader`, which is a different component. The defect stands; its mechanism is a missing label, not a wrong one.)* |
| **P-2** | **`total_balance` is built and never rendered.** It sits at index 2 of the array under the title `'expenses'`, and nothing reads it | `PocketLayout.tsx:50`. This is byte-for-byte the budget hero defect fixed in `4ab3374`. **Half-closed by commit 2** *(2026-08-21)*: the positional array is gone and the hero takes named props. The saved amount still does not render — that is commit 3 |
| **P-3** | **Two pockets in two currencies silently lose one.** The aggregate query is `GROUP BY ct.currency_code`, so it returns one row per currency, and the handler returns `rows[0]` | `dashboardController.js:211` *(re-anchored 2026-08-21; was `:208`)*. **Closed by commit 1** |
| **P-4** | **Every unfinished pocket is permanently in alert.** The row's status is `balance - target < 0`, which is true for every goal not yet reached — so the alert marks *normality* and carries no information | `pages/pocket/components/ListPocket.tsx:90` **(open)**. Commit 2 stopped the row subtracting and reads the served `remaining`, but the RULE is unchanged and still marks every unfinished pocket. The same rule stands at the detail's `remaining > 0`, `SummaryPocketDetailBox.tsx:43` |
| **P-5** | **The detail's window is the browser's clock**, two months back, serialised with `toISOString()` — so the bounds shift by a day west of UTC. It is the defect the budget detail carried until `cac3e1c` | `PocketDetail.tsx:89-100` *(re-anchored 2026-08-21; was `:86-97,101`)*. **Open.** `getTransactionsForAccountById.js:100-116` names this screen by name as one of the three still on the legacy `start/end` path |
| **P-6** | **Two hardcoded locales in a single row**: the date renders `'es-ES'` and the amount `'en-US'`, inside an English interface | was `pages/pocket/components/ListPocket.tsx:65,75`. **Closed by commit 2**, not deferred to commit 5: the served deadline is a `YYYY-MM-DD` label and `new Date()` on one is UTC midnight, so the row had to stop parsing it as an instant. `formatCalendarDate` builds the label from its parts on `DATE_TEXT_FORMAT`. The copy at `pages/budget/components/ListPocket.tsx:65,75` is untouched and still holds both literals |

**P-7, measured 2026-08-21 and not in the original six.** The detail's
percentage is the **remaining** share, not the progress: `SummaryPocketDetailBox`
computes `|remaining / target| × 100` and renders it under a bare `%` with no
word qualifying it. At 0.27% saved it prints `99.7%`, which reads as a pocket
that is nearly full. It also renders `0` when `target` is 0, which the standing
rule forbids. `SummaryPocketDetailBox.tsx:45-50`. It belongs with commit 6.

P-1 and P-2 together mean the board's largest number answers a question nobody
asked. In the developer's own screenshot, *Total Pocket Savings $4,500.00* is the
**goal**; the amount actually saved is $12.00.

---

## 2. The sketch, KPI by KPI

### 2.1 Free — the model already holds every input

| KPI | formula against the real schema | note |
| --- | --- | --- |
| Total Savings Pool | `SUM(user_accounts.account_balance)` | per currency, see §3 |
| Overall Progress Rate | `SUM(balance) / SUM(target) × 100` | `null` when the target sum is 0, never `0` |
| Total Remaining Target | `SUM(target) - SUM(balance)` | may be negative — an over-funded pocket is not an error |
| Gap, per pocket | `target - balance` | |
| Pocket Progress | `balance / target × 100` | `null` when `target` is null or 0 |
| Required Monthly Savings | `(target - balance) / months_until(desired_date)` | **`desired_date` is `NOT NULL`, so this is free.** See the zero-denominator trap in §3.2 |

### 2.2 Needs the transaction history — the run rate

The sketch defines it as `account_balance / days_since_start × 30`. **That figure
is wrong in the same way `account_balance` was wrong in the budget detail**: it is
a lifetime average that cannot see a withdrawal, a pause, or a change of pace. A
pocket funded once with $500 eleven months ago and one funded $45 every month
report the same run rate, and only one of them will arrive.

The honest run rate is the **net movement over the last N complete months**, from
`transactions`. That is a monthly series grouped by account — the exact shape
`getMonthlySeriesForAccounts` already produces for budget. **Reuse that shape;
do not invent a second one.** Everything downstream of the run rate inherits its
quality:

- **Projected completion date** = `today + remaining / run_rate` months.
- **Time-to-target status** = `run_rate` against `required_monthly`.

Both are `null` when `run_rate <= 0`. A pocket that received nothing this quarter
has **no** projected date; it does not have one in the year 3000, and it must not
render `Infinity`, `NaN` or a dash-free blank. A missing figure is a dash.

### 2.3 Not in the model at all

| sketch element | why it cannot ship as drawn |
| --- | --- |
| **"Month trend: Up 5%"** (reference image) | There is no month-over-month series for pockets. It needs §2.2's endpoint first, and then it is a second reading of the same data — decide whether it earns its place beside the run rate |
| **Per-pocket icon** (🏖️, 🚗, 🐷) | There is no icon column. Inferring it from the account name is the prose-parsing trap already rejected twice (`PLAN_BUDGET_FRONTEND.md` §10.11.1, §10.12.1). Either a single fixed icon, or none, or a schema decision |

### 2.4 Rejected, with the reason

| sketch element | verdict |
| --- | --- |
| **Currency selector** (`USD`, `COP`…) | **Reject.** One accounting currency is stored per account; a selector would convert at read time and make the board disagree with every other screen. The FX columns exist to record an origin, not to re-express a total |
| **Server-side pagination** | **Reject**, as in §10.12.2: it turns one request into N and D12 governs |
| **Status colours green/yellow/blue/red** | **Not rejected — blocked.** Four states need four colours and the palette has two, teal and a muted red. CLAUDE.md forbids inventing a token: this is an open decision, §8 |

---

## 3. The two facts that govern every figure

### 3.1 Currency — the budget module already answered this

`SUM(target)` across two currencies is not a number. Budget V1's rule: when the
set mixes currencies, **every folded figure is `null` and a notice names the
offender** — the screen states it cannot add them rather than adding them at an
implicit 1:1. Pocket must adopt the same rule, which also fixes P-3, where today
one currency simply disappears.

Per-pocket figures are unaffected: a single pocket has one currency by
construction.

### 3.2 Calendar — and a denominator that can be zero or negative

`desired_date` is `TIMESTAMPTZ`. "Months until the deadline" is a question about
the **owner's calendar**, which the backend already resolves per request in the
budget module. The client must not compute it from `new Date()`; that is P-5 and
the reason the budget month travels in the response.

Three cases the formula must answer before it is written:

| case | what `required_monthly` should be |
| --- | --- |
| deadline in the future | `(target - balance) / months_remaining` |
| deadline **this month** | the whole gap, not a division by a fraction |
| deadline **passed** | **`null`, and the status is `At Risk`.** Not a negative number, not a division by zero |

### 3.3 The deadline is validated on edit and not on creation — measured

| path | what it does | where |
| --- | --- | --- |
| **Edit** | `pocketSavingEditSchema.desired_date` refines `date >= today` and fails with `INVALID_DATE_FUTURE`. The field metadata reads *"Today or a later date."* | `editSchemas.ts:30-51`, `accountEditSchema.ts:168-175`. *(Both changed by commit 0a; the refine was `> today` and the copy read "Must be a future date.")* |
| **Creation, client** | `FormDatepicker` now receives `minDate={startOfToday()}` | `NewPocket.tsx:475-481`. *(Commit 0a. The picker had no `minDate` at all.)* |
| **Creation, server** | Absent, defaults to `account_start_date + 1 month`. Present, checked against today on the **owner's** calendar and refused with 422 | `accountCreationController.js:1003-1029,1126`, `utils/fintrackUtils/date-utils/pocketDeadline.js`. *(Commit 0a. It invented `+ 1 year` and inserted a supplied date unchecked.)* |

**Still open after commit 0a, measured 2026-08-21.** The rule exists on the
**creation** endpoint only. `PATCH /account/:accountId` still writes
`desired_date` with no server check — `accountEditController.js:101-102` puts it
straight into `specificFields`. Closing that hole is **not** a one-line addition:
`EditAccount.tsx:297-303` submits the **whole validated form**, not a diff, so a
server rule on the edit path would make every pocket already holding a past
deadline uneditable — its note included. See §8, QP-11.

So the same field is refused on Tuesday's edit and accepted on Monday's creation.
The developer's own *Ahorro* pocket carries `09/08/2026`, six days in the past as
of this writing: a value the edit form would no longer let him save.

**Decision, taken by the developer on 2026-08-15: the desired date must be in the
future at creation too.** Four things that follow, and they are the whole reason
this is not a one-line change:

1. **The rule has to exist on the server.** Today it lives only in a browser
   schema, and the creation controller accepts any date from any caller. A rule
   enforced only in the client is not a rule — it is a suggestion the next
   caller ignores. The zod schema is the ergonomics; the controller is the
   authority.
2. **"Future" is a question about the owner's calendar**, not the device's.
   `new Date()` in `editSchemas.ts:37` is the browser clock, which is the defect
   this module has been removing everywhere else. The server check resolves the
   owner's timezone, as the budget module already does per request.
3. **Is *today* itself valid? Yes — settled by the developer, 2026-08-15.**
   Under the current refine the answer is an accident of the clock:
   `today.setHours(0,0,0,0)` means a date picked as today at 14:00 passes and the
   same day at 00:00 fails. It becomes a decision instead: today is a valid
   desired date, because a goal due this month is a real goal and the month is
   the unit everything else in the app is measured in. The comparison is
   therefore **`>=` against the start of today on the owner's calendar**, not
   `>` against whatever instant the picker stamped.
4. **The rows already stored do not move.** Validation on write does not erase a
   past deadline that exists, and it must not: those pockets render, and they
   render as `at_risk`. This is the half of QP-4 that stays open.

**The default becomes one month, not one year. Settled by the developer,
2026-08-15.** The branch at `accountCreationController.js:997-1001` fires when no
date arrives and writes `account_start_date + 1 year`. The column is `NOT NULL`,
so something has to be written, and the developer chose to keep a default rather
than reject the request — with the horizon cut from a year to a month.

That is the better of the two defaults, and the reason is worth stating because
it is not obvious: **a default deadline is a deadline the user never chose, and
every pace figure divides by it.** A year of invented runway is silent — the
pocket reports `On track` for twelve months on a promise nobody made. One month
expires almost immediately, the pocket surfaces as `at_risk`, and the user is
asked for the date the model actually needs. An invention that announces itself
is worth more than a plausible one that hides.

It also lines up with the decision above: if today is a valid desired date, the
smallest honest horizon is the current month, and the default gives exactly one.

### 3.4 A defaulted deadline says so — decided 2026-08-15

Keeping a default leaves one thing unresolved: for the month it is alive, the
screen serves `requiredMonthly` and `projectedDate` that **look served and rest
on a date nobody chose**, and no consumer can tell them apart from a deadline the
user actually picked. That is the shape of defect this project has spent weeks
removing from the budget module — a figure that reads as authoritative and comes
from an assumption.

**So the origin of the date is stored, and travels in the contract.**

```sql
desired_date_source VARCHAR(20) NOT NULL DEFAULT 'user'
  CHECK (desired_date_source IN ('user', 'default'))
```

*(Landed 2026-08-21 as migration **018**, not 017: `017_budget_allocation_fx_columns.sql`
already holds that number. Every other detail of this section shipped as written.)*

Named after `exchange_rate_source`, which is the same idea already in this table:
a column that records where a value came from. A source beats a boolean here
because the third case is foreseeable — an import, a template — and
`deadline_is_default` would have to be renamed the day it arrives. The `CHECK`
makes an unknown origin unrepresentable rather than merely unlikely.

**The backfill is exact, not approximate.** Rows written by the old branch carry
`desired_date = account_start_date + 1 year` **to the second**, because the code
derived one from the other (`accountCreationController.js:999-1001`); a date
chosen in the picker cannot coincide with that instant through the form. So:

```sql
UPDATE pocket_saving_accounts
SET desired_date_source = 'default'
WHERE desired_date = account_start_date + INTERVAL '1 year'
 AND desired_date_source = 'user';   -- added so the file stays re-runnable
```

**One case this section did not foresee, decided 2026-08-21.** A user who edits
the deadline of a defaulted pocket has now chosen it, so the row must stop
claiming otherwise. The edit path flips `'default'` back to `'user'` — but only
when the submitted value actually **differs** from the stored one, because the
editor resubmits the whole form and flipping on mere presence would relabel a
default nobody looked at.

Everything else stays `'user'`, which is the honest reading: those dates were
chosen, and claiming otherwise would be a statement the data cannot support.

Two constraints this inherits and neither is optional:

- **H13** — the budget and account schema is defined **twice**, in the migrations
  and in `createTables.js`, and production builds through the runtime path. The
  column enters both in the same commit or production never gets it.
- **D6** — the migration is written right the first time, with explicit UP and
  DOWN. No later migration corrects this one.

On screen, a pocket whose source is `'default'` renders **"Deadline not set"**
where its pace figures would go — not a pace derived from a date nobody picked.

---

## 4. The three surfaces

### 4.1 Level 1 — the board

One request, one payload, both halves of the screen fed from it (D12) — which is
what `1d321c3` did for budget.

**The hero carries the same four figures as the budget hero**, which is already on
screen and verified (`4ab3374`): a headline amount, and under it **one strip
holding two figures**, each with its amount **and its share**.

> *Corrected 2026-08-21.* This section said "two strips", which is what
> `4ab3374` shipped. `6ae71c8` merged them into one, and
> `BudgetBigBoxResult.tsx:106-108` records the reason — the pair are the halves
> of a single budget and now read as a split of it, and the strip that went is
> height the list gets back. Pocket copies what shipped, not what this paragraph
> described.

Pocket's version:

| slot | figure | today |
| --- | --- | --- |
| headline | `totalTarget`, **labelled as the target** | the same number, labelled *Total Pocket Savings* — P-1 |
| strip 1 | **Saved** — `totalSaved` and `overallProgress` | absent from the screen entirely — P-2 |
| strip 2 | **Remaining** — `totalRemaining` and its share | remaining only, with no share |
| secondary line | `monthlyRequired`, the contribution the whole board needs this month | absent |

The remaining share is `100 - overallProgress`, **derived from the served
percentage and not recomputed over the amounts** — the same identity the budget
hero uses, so the two figures inherit the server's rounding instead of
introducing a second one.

The `Monthly Required Savings` of the sketch is a sum over pockets, so it inherits
§3.1: a mixed-currency board serves it as `null` with the notice.

**Why the headline stays the target and does not become the saved amount.** Both
readings fix the defect, because the defect is that one number is wearing another
number's label. Keeping the target as the headline preserves all four figures —
goal, saved, remaining, and two shares — in the space the hero already occupies,
and it makes the pocket board and the budget board the same object: a goal on
top, consumption and remainder beneath it. Promoting `totalSaved` to the headline
would push the goal into a strip and leave the board without the number the
progress bar is measured against. Recorded as **QP-7**; it is a display decision
and it is the developer's to settle.

### 4.2 Level 2 — the card

The card is where the sketch is strongest, and where the current row is emptiest.
Four figures, no more: **progress**, **gap**, **required monthly**, **status**.
The projected date belongs on the detail — a list of eight cards each carrying a
projection is a list nobody reads.

The status square at `ListPocket.tsx:90` is replaced by the status of §5, because
"not finished yet" is not a warning.

### 4.3 Level 3 — the detail

Two changes, one of them structural:

1. **Off the browser clock** (P-5). The transaction window derives from the
   pocket's own timeline, and `getTransactionsForAccountById` already accepts a
   month since `785a45e`.
2. **The percentage stops being computed in the client**
   (`SummaryPocketDetailBox`). It is served, like every budget figure now is.

The detail is also where the pace lives: run rate, required monthly, projected
date, and the deadline the projection is measured against.

---

## 5. The contract

One endpoint, shaped after `POST /budget/accounts/status` so the two modules
answer the same way.

> *Shipped 2026-08-21 as `GET /api/fintrack/pocket/board`.* **GET, not POST.**
> Budget uses POST because it carries `accountIds` and `month` in a body; the
> pocket board carries nothing at all — it is every pocket the caller owns, and
> identity comes from the token. A POST with an empty body would be a verb
> chosen by imitation rather than by what the request does.
>
> Commit 1 serves `summary`, `pockets` and `meta.notices` with every field below
> **except** the five pace fields — `status`, `runRate`, `requiredMonthly`,
> `projectedDate` and `summary.monthlyRequired`. They are **absent** from the
> payload, not served as `null`: a null is an answer, and this commit has none.
> `summary.totalRemaining` and `overallProgress` are both `null` when no pocket
> carries a goal, and an empty board serves every figure as `null` with
> `pocketCount: 0` rather than a board reading $0.00. Percentages are numbers **0–100**, like
`executionPercentage`, never ratios — the sketch's JSON writes `"progress": 0.27`
next to a rendered `0.3%`, and that ambiguity is closed here.

```jsonc
{
  "summary": {
    "totalSaved": 4525.50,
    "totalTarget": 9039.00,
    "totalRemaining": 4513.50,
    "overallProgress": 50.07,      // null when totalTarget is 0
    "monthlyRequired": 425.00,     // null when no pocket has a live deadline
    "currency": "usd",             // null when the set mixes currencies
    "pocketCount": 2
  },
  "pockets": [
    {
      "accountId": 1,
      "accountName": "Ahorro",
      "note": "Ahorros",
      "target": 4500.00,
      "saved": 12.00,
      "progress": 0.27,            // null when target is 0 or null
      "remaining": 4488.00,
      "status": "behind",          // see below
      "runRate": 10.00,            // null when the history is shorter than the window
      "requiredMonthly": 350.00,   // null when the deadline has passed
      "projectedDate": "2027-01-01", // null when runRate <= 0
      "desiredDate": "2026-12-31",
      // 'user' or 'default'. A defaulted deadline is not a deadline: the card
      // says so instead of reporting a pace derived from it (§3.4)
      "desiredDateSource": "user",
      "startDate": "2026-07-01",
      "currency": "usd"
    }
  ],
  "meta": { "notices": [] }
}
```

Currency codes are **lowercase** — `usd`, not `USD`. H14: the V1 example prints
uppercase and a union type written from it would be a bug.

**The status is decided in one place, on the server**, and evaluated in this
order — the order matters, and a client that re-derives it will diverge, which is
precisely what `statusAlert` did across three files in the budget module:

| status | condition |
| --- | --- |
| `completed` | `saved >= target` |
| `at_risk` | not completed **and** the deadline has passed on the owner's calendar |
| `behind` | not completed, not at risk, and `runRate < requiredMonthly` |
| `on_track` | anything else |

Dates are served as `YYYY-MM-DD` on the owner's calendar, never as an ISO instant
the client re-parses — `new Date('2026-08-01')` is UTC midnight and renders as
July west of UTC.

---

## 6. The reference image, translated

The image is a dark board with a gold accent. The instruction is to use
`--light` / `--creme` in place of the gold, which is consistent with the identity:
the app is dark, and cream is what it already uses for data surfaces.

**One caution.** In the current system, cream is a **fill** with dark text, not an
**outline** on a dark card. The mockup's look is cream-on-dark outlines
throughout, which is a new surface treatment. Adopting it is a design-system
decision — it belongs in `FINTRACK_DESIGN_SYSTEM.md` before it is written into a
component, not invented at the point of use.

| element in the image | verdict |
| --- | --- |
| Horizontal progress bar in the hero | **Take.** CSS only, no dependency |
| Circular progress ring on the card | **Take the ring, drop the ticks.** A ring is `stroke-dasharray` on an inline SVG, no dependency; the finely-ticked bezel is decoration that reads identically at 0.3% and 3% |
| `HEALTHY` pill | **Blocked on the status definition** and on the colour decision, §8 |
| Per-pocket icon | §2.3 — no source in the model |
| `Month trend: Up 5%` | §2.3 — no data |
| `%0.27` | The symbol goes **after** the number, as the rest of the app writes it |
| Two `New Pocket` buttons, above and below the list | **A defect, not a design.** The budget board shows the same duplication in the developer's screenshots. One button |

Everything new obeys the standing rules without exception: tokens for colour,
spacing, radius and type; the five interactive states on anything clickable;
BEM; mobile-first from 360px; and a missing figure is a skeleton or a dash,
never `0` or `NaN`.

---

## 7. The sequence

Contract first, and no implementation commit against an unfrozen contract (D11).

| # | commit | what it delivers | depends on |
| --- | --- | --- | --- |
| 0a ✅ `19b35a9` | `fix(pocket): require a future desired date` | Creation refuses a past deadline, on the server first and in the form second, on the owner's calendar, comparing `>=` against the start of today. The absent-date branch drops from a year to a month. Closes §3.3. **Independent of everything below**, and it changes what the API accepts, so it is its own commit | — |
| 0b ✅ `a46d0e9` | `feat(pocket): record the deadline's origin` | Migration **018** *(corrected 2026-08-21; this row said 017, and §10 already records why)*, the same column in `createTables.js` (H13), the controller writing `'user'` or `'default'`, and the field in the payload. Closes §3.4. Separate from 0a because it is schema and must be revertible alone | 0a |
| 1 ✅ `48863b4` | `feat(pocket): serve the pocket board` | **BE.** The §5 payload minus the pace fields. Folds the two queries into one, adds the per-currency rule and `meta.notices`. **Fixes P-3** | — |
| 2 ✅ `7322b9b` | `refactor(pocket): read the board from the api` | **FE.** Level 1 on the contract, one request, client arithmetic removed | 1 |
| 3 ⛔ | `fix(pocket): show savings in the hero` | The headline is relabelled as the target it has always been, and the two strips arrive: saved and remaining, each with its share. **Fixes P-1 and P-2** | 2 |
| 4 ⛔ | `feat(pocket): add pace and projection` | **BE.** Run rate from the monthly series, `requiredMonthly`, `projectedDate`, `status`. **Fixes P-4** | 1 |
| 5 ⛔ | `feat(pocket): show progress on the card` | The bar, the ring, the status. **Fixes P-6** in passing, since the row is rewritten | 3, 4 |
| 6 ⛔ | `refactor(pocket): scope the detail to the goal` | Level 3 off the browser clock, percentage served. **Fixes P-5** | 4 |
| 7 ⛔ | `feat(pocket): filter and sort the board` | Client-side over the payload already in memory. Filtering **never** changes the totals in the header (§10.12.2) | 5 |

**Status, 2026-08-21, second reading.** ✅ landed on `feat/pocket`. **Nothing in
this table is blocked any more:** §12 answers QP-1, QP-2, QP-3, QP-5, QP-6,
QP-7 and QP-12, and QP-13 — the only one left — concerns a surface none of
these commits touch. Commit 3 carries one change this table did not anticipate:
the hero's headline becomes the amount saved, so `pocketBoardService.js` has to
start converting currencies instead of refusing to add them (§12.4).

**Commits 8 to 12 continue this sequence** and are specified in §11.8. They are
the editing block — target and desired date — and they are not frozen.

Commits 1 and 4 are the only ones that touch the backend. Commit 3 is the one the
developer will see immediately: the board's big number changes from $4,500.00 to
$12.00, and **that is the correction, not a regression** — it must be said out
loud in its Gate 1, exactly as `4ab3374` said it for budget.

---

## 8. Open decisions

> **Superseded by §12 on 2026-08-21.** Every question below that gated commits
> 3 to 7 was answered that day, and `QP-7` was answered **against** the
> recommendation this table carries. Read §12 for the decisions; this table is
> the reasoning that produced the questions, not the answers. The only entry
> still open is `QP-13`, and it blocks nothing.

| id | question | recommendation |
| --- | --- | --- |
| **QP-1** | Four status colours, and the palette has two | **Extend the palette in the design system first**, with the status semantics named — not four literals dropped into a component. Until then, ship the status as a **text label**, which is legible and needs no token |
| **QP-2** | Run-rate window: last 3 months, 6, or the whole life | **Three complete months.** Long enough to survive one skipped month, short enough to notice a stop. It must be stated on screen — a pace with no window is a number with no meaning |
| **QP-3** | Does the pocket detail keep its own transaction fetch, or read the board payload? | **Keep the fetch.** The movements are not board data, and level 3 already needs the account record |
| **QP-4** | `desired_date` in the past — is it a state or a validation error? | **Both, and they do not conflict. Settled 2026-08-15:** on *write* it is an error — creation refuses it, as the edit already does (§3.3, commit 0). On *read* it is a state — the rows already stored render as `at_risk`, because refusing to draw them would hide the pockets that most need attention |
| **QP-8** | Is *today* a valid desired date? | **Closed 2026-08-15: yes.** The comparison becomes `>=` against the start of today on the owner's calendar, so the answer stops depending on the time the picker stamps |
| **QP-9** | No date sent at creation: default to `start + 1 year`, or reject? | **Closed 2026-08-15: keep a default, and make it `start + 1 month`.** The column is `NOT NULL` and something must be written; a one-month horizon expires immediately and surfaces the pocket as `at_risk`, where a one-year one reports `On track` for twelve months on a date nobody chose |
| **QP-10** | The default is still a date the user never chose. Does the contract admit it? | **Closed 2026-08-15: yes**, through `desired_date_source` (§3.4). This is what separates keeping the default from rejecting the request — without it, a pocket reports a pace built on an assumption and nothing on screen can say so |
| **QP-5** | Does `Month trend` ship at all? | **Not in this sequence.** It is a second reading of the run rate's own data; decide it after the pace is on screen and its usefulness can be judged |
| **QP-6** | Cream outlines on dark cards as a surface treatment | **Design-system decision, before commit 5** |
| **QP-7** | The hero's headline: the target, or the amount saved? | **The target, relabelled** — it keeps all four figures on screen and makes the pocket hero and the budget hero the same object. §4.1. **Blocks commit 3**, and it can no longer be read in isolation: the prose appended after §9 proposes a different hero entirely. See QP-13 |
| **QP-11** *(opened 2026-08-21)* | Does the **edit** path get the same server-side deadline rule creation now has? | **Not as it stands.** `EditAccount` submits the whole validated form rather than a diff, so a server rule there would refuse every save on a pocket that already holds a past deadline — including a save that only touched the note. That contradicts QP-4, which keeps those rows readable and renders them `at_risk`. **Recommendation: validate on edit only when the submitted deadline differs from the stored one**, which is the same comparison the provenance flip already makes in `accountEditController.js`. Its own commit, after the board is on screen |
| **QP-12** *(opened 2026-08-21)* | What does a pocket whose `desiredDateSource` is `'default'` report for `status`? | §3.4 wants it to surface as `at_risk` once the invented month expires; §5 wants no pace figure derived from a date nobody chose. Both hold only if they are separated: **serve `status` normally — a defaulted deadline that has passed IS `at_risk`, and that is the point of shortening it to a month — and serve `requiredMonthly` and `projectedDate` as `null`.** The remaining hole is the `behind` rung, which is defined as `runRate < requiredMonthly` and cannot be evaluated against a null. **Recommendation: a defaulted deadline that has not yet passed reports `on_track` only when `runRate > 0`, and otherwise reports `behind`** — a pocket receiving nothing is not on track towards anything, whoever picked the date. **Blocks commit 4** together with QP-2 |
| **QP-13** *(opened 2026-08-21)* | The prose appended after §9 — an undated exchange proposing a Hero of *Current Balance / Contributions / Withdrawals / Change vs previous period* — is it in scope, and which surface is it about? | It names *"Emergency Fund"* as a title, which is **one pocket**, so it reads as a proposal for **level 3, the detail**, not for the board §4.1 specifies. If that is right the two do not conflict and both can ship. If it was meant as the board, it supersedes §4.1 and QP-7 and the sketch below it is void. **Recommendation: read it as the detail's hero, keep §4.1 for the board, and note that `Contributions` and `Withdrawals` need the same transaction query as the run rate (§2.2) — so it lands with or after commit 4, never before.** Nothing here is implemented until the developer says which surface it describes |

---

## 9. What this plan does not decide

- **The `slack` account filter** in both queries. It is inherited, it is in every
  account-type query, and it is not a pocket question.
- **Whether pocket gains an intermediate level.** Today the board links to the
  detail and this plan keeps that; a middle screen would need a grouping the
  model does not have, which is the super-category argument of §10.12.2 again.
- ~~**Editing a pocket.**~~ **Superseded by §11 on 2026-08-21.** The path was
  measured: `accountEditController.js:100-110` already writes `target`,
  `desired_date` and `note`, it overwrites without history, and it has no FX
  step — so the `R50` reproduction this bullet warned about is not a risk to
  check before writing an editor. It is already in the code, recorded as `P-8`.
- **Whether any of this precedes the style blocks L1–L3.** D8 governs, and the
  budget module closes first.

---

## 10. Measurement of 2026-08-21 — what this document got wrong

Every claim §1–§7 makes about the code was reopened against `feat/pocket` on the
day the trigger fired. The six defects are all real and all still present as
described, except where noted. What was stale:

| # | the claim | the measurement |
| --- | --- | --- |
| 1 | Migration **017** carries `desired_date_source` (§3.4) | `017_budget_allocation_fx_columns.sql` already exists. Shipped as **018** |
| 2 | The budget hero has **two strips** (§4.1) | It has **one**, holding two figures. `4ab3374` did ship two; `6ae71c8 feat(budget): hold the board in one frame` merged them, and `BudgetBigBoxResult.tsx:106-108` records why — the pair are halves of one budget, and the strip that went is height the list gets back |
| 3 | Board = `PocketLayout.tsx` + `components/ListPocket.tsx` (§1.3) | `Pocket.tsx` sits between them as the Outlet's index route, and there are **two** `ListPocket.tsx` — `pages/pocket/` and `pages/budget/`. Only the first is the pocket board |
| 4 | Endpoint anchors `:197-211` and `:367-378` (§1.2) | `:200-215` and `:370-381` |
| 5 | P-3 evidence `dashboardController.js:208` (§1.4) | `:211` |
| 6 | P-5 anchor `PocketDetail.tsx:86-97,101` (§1.4) | `:89-100` |
| 7 | `accountEditSchema.ts:163-170`, `NewPocket.tsx:463-469` (§3.3) | `:168-175` and `:475-481` |
| 8 | P-1 is "the headline under a title that says savings" | The headline carries **no label at all**; the `'total target'` string at index 0 is never read. The word "savings" is `TitleHeader`'s |

And three things the document did not know:

- **Both dashboard endpoints answer `400` on an empty result** (§1.2), so the
  board could not tell "no pockets" from "request failed".
- **The detail's percentage is the remaining share, not the progress**, rendered
  under a bare `%` — P-7 above.
- **The edit path has no server-side deadline rule and submits the whole form**,
  which is why closing that hole is QP-11 and not a line in commit 0a.

**What could not be verified.** No SQL was run against `fintrack_dev`: the
`feat/pocket` worktree carries no `.env`, and reading another worktree's was
refused. So the *count* of rows migration 018 will reclassify as `'default'` is
unknown; the backfill predicate itself is exact and does not depend on it.
Nothing was booted either — the dev server is owned by another session — so
every figure below rests on `tsc --noEmit` at zero, a succeeding `vite build`,
and the core factories exercised against fixtures.

> **Correction, 2026-08-31 — the first of those three proves nothing, so read the
> paragraph above as resting on two.** The root `tsconfig.json` in `frontend/`
> declares `"files": []` and only project references, and the compiler does not
> follow references unless invoked in build mode. A type check run without naming
> a project therefore looks at **zero files and exits successfully**, which is the
> same output a clean tree produces. The check that actually reads the 700-odd
> source files is the one pointed at `tsconfig.app.json`, saved since 2026-08-30
> as the `typecheck` script in `frontend/package.json` (commit `57f3207`).
>
> The second leg is weaker than it reads too: `build` is `vite build` on its own,
> which bundles without checking types.
>
> **Nothing below is being retracted** — no figure here is known to be wrong, and
> re-running the real check is cheap. It is stated so that the evidence line is
> not quoted again as if it had verified the types. The trap itself is recorded as
> finding H8 in `NEXT_SESSION.md:270`, and the working rule that comes out of it in
> `PROTOCOLO_DE_TRABAJO.md`, section 3.

---


> ⚠ **The text below is an undated exchange appended after §9, and it is not
> part of the plan above.** It proposes a Hero built on *Current Balance,
> Contributions, Withdrawals and Change vs previous period*, which is a
> different object from the board hero §4.1 specifies. It names one pocket by
> name, so it most likely describes **level 3**. Nothing in it is implemented.
> It is QP-13 and it is the developer's to settle. *(Flagged 2026-08-21.)*

  Sí. Y aquí conviene ser **muy restrictivo**: el Hero de `Pocket View` no debe convertirse en un mini-dashboard financiero.

Si `Pocket` representa una **bolsa de ahorro / reserva de dinero**, el Hero debería responder en pocos segundos:

> **¿Cuánto tengo, cuánto he aportado y cómo está evolucionando mi bolsillo?**

## Pocket Hero — propuesta

Yo limitaría el Hero a **4 indicadores como máximo**:

| Indicador               | Qué responde                     | Prioridad |
| ----------------------- | -------------------------------- | --------: |
| **Current Balance**     | ¿Cuánto dinero tengo ahora?      |       ⭐⭐⭐ |
| **Total Contributions** | ¿Cuánto dinero he puesto?        |       ⭐⭐⭐ |
| **Total Withdrawals**   | ¿Cuánto he retirado?             |        ⭐⭐ |
| **Net Change**          | ¿Cuánto ha cambiado el bolsillo? |        ⭐⭐ |

### 1. Current Balance — indicador principal

Debe ser **el protagonista absoluto**.

```text
┌─────────────────────────────────────────────────────────┐
│  Emergency Fund                              • Active   │
│                                                         │
│  Current Balance                                        │
│  $4,850.00                                               │
│                                                         │
│  +$350.00  this month                                    │
│                                                         │
│  Contributions     Withdrawals       Net Change          │
│  $5,200            $350              +$4,850             │
└─────────────────────────────────────────────────────────┘
```

Pero hay una precisión importante:

**`Current Balance` no debería calcularse sumando movimientos en el frontend.**

El BE ya posee la información necesaria para determinarlo. El Hero debería consumir un **snapshot financiero del Pocket**, no reconstruir contabilidad.

---

# 2. Total Contributions

Este sí lo mostraría porque da contexto al balance.

Por ejemplo:

```text
Contributed
$5,200.00
```

Permite interpretar:

> Tengo $4,850, habiendo aportado $5,200.

Eso inmediatamente hace visible que hubo retiros.

Pero no lo convertiría en una métrica excesivamente sofisticada.

---

# 3. Total Withdrawals

Es el complemento natural:

```text
Withdrawn
$350.00
```

No mostraría:

* número de retiros
* retiro promedio
* retiro máximo
* porcentaje de retiros
* etc.

Esos indicadores pueden existir en el **Financial Metrics & KPI Catalog**, pero no pertenecen al Hero.

---

# 4. Net Change

Aquí hay que tener cuidado porque **puede ser redundante**.

Si:

```text
Balance = Contributions - Withdrawals
```

entonces mostrar:

```text
Contributions
Withdrawals
Net Change
Balance
```

puede terminar repitiendo la misma información cuatro veces.

Por eso yo haría una de estas dos alternativas.

### Alternativa A — Hero minimalista

```text
Current Balance
$4,850

Contributions     Withdrawals
$5,200             $350
```

Y debajo:

```text
+$350 this month
```

**Esta es mi preferida.**

### Alternativa B — Hero orientado a evolución

```text
Current Balance
$4,850

+$350
vs. previous month

Contributed       Withdrawn
$5,200            $350
```

Aquí `Net Change` se transforma en **Change vs. previous period**, que tiene más valor analítico.

---

# Lo que NO pondría en el Hero

Aunque FinTrack pueda calcularlos, los dejaría fuera:

* ROI
* Savings Rate
* Burn Rate
* Average Monthly Contribution
* Average Withdrawal
* Number of Transactions
* Transaction Frequency
* Monthly Volatility
* Forecast
* Projection
* Budget Variance
* Performance %
* CAGR
* Growth Rate
* Liquidity Ratio
* Financial Health Score

No porque sean malos indicadores.

Sino porque **responden preguntas diferentes**.

El Hero no debe responder diez preguntas. Debe establecer el **estado financiero actual del Pocket**.

---

# Y hay una distinción todavía más importante

Yo separaría conceptualmente:

### Estado

> **¿Cuánto tengo?**

`Current Balance`

### Flujo acumulado

> **¿Cómo llegué hasta aquí?**

`Contributions` / `Withdrawals`

### Evolución

> **¿Está creciendo o disminuyendo?**

`Change vs previous period`

Eso nos da una arquitectura mucho más limpia:

```text
                 POCKET
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
      STATE       FLOWS      EVOLUTION
        │           │           │
      Balance    Inflows      Change
                 Outflows
```

Y esto es perfectamente compatible con la arquitectura de **Financial Metrics & KPI Catalog** que estamos planteando.

---

# Mi propuesta definitiva para FinTrack

Para una primera versión profesional de `Pocket View`, el Hero tendría:

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Emergency Fund                              ● Active   │
│                                                         │
│  Current Balance                                        │
│  $4,850.00                                               │
│                                                         │
│  ↑ $350.00  vs. previous month                          │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Contributions                  Withdrawals              │
│  $5,200.00                      $350.00                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Y **nada más**.

El resto de las métricas debe vivir debajo, organizadas por propósito:

```text
POCKET VIEW
│
├── HERO
│   ├── Current Balance
│   ├── Change vs Previous Period
│   ├── Contributions
│   └── Withdrawals
│
├── BALANCE TREND
│   └── evolución del balance
│
├── ACTIVITY
│   └── movimientos del Pocket
│
├── GOAL / BUDGET
│   └── si el Pocket tiene objetivo
│
└── DETAILS
    └── información secundaria
```

La clave es que **no debemos diseñar el Hero a partir de "qué indicadores puede calcular FinTrack"**, sino al revés:

> **Primero definimos qué decisiones o preguntas debe resolver Pocket View; después seleccionamos el mínimo conjunto de métricas necesarias.**

Eso evita exactamente el problema que quieres evitar: terminar colocando 20 KPIs simplemente porque el backend tiene los datos para calcularlos.


---

## 11. Editing the goal — opened 2026-08-21

**Developer instruction.** A pocket is an account whose **target** and **desired
date** are both editable, and the edit must follow the dynamic budget already
follows — back end and front end alike — reachable from level 2 and level 3.
This supersedes the line in §9 that said no pocket edit path had been measured.
One had. It is measured here.

### 11.1 What exists today

| fact | where |
| --- | --- |
| The server already accepts a pocket edit. `target`, `desired_date` and `note` are copied into `specificFields` and written straight onto `pocket_saving_accounts` | `accountEditController.js:100-110` |
| It **overwrites**. There is no revision, no `valid_from`, nothing that records what the goal was before | same |
| `EditAccount.tsx` has no pocket branch. It reads `desired_date` as a plain form field and never opens an editor for the pair | `EditAccount.tsx:232` |
| Budget's equivalent is `PUT /api/fintrack/budget/accounts/:accountId/current` plus `BudgetEditModal`, opened from **three** callers: the account editor, the level-2 list and the level-3 detail | `budgetRoutes.js:27`, `EditAccount.tsx:629`, `CategoryAccountList.tsx:320`, `CategoryDetail.tsx` |

**P-8, new and live.** That write has no FX step. Across its 381 lines
`accountEditController.js` never names `exchange_rate`, `original_target` or any
conversion, so an edited target lands in `target` — the **accounting-currency**
column — exactly as the user typed it, while `original_target`, `exchange_rate`,
`exchange_rate_source` and `exchange_rate_timestamp` keep whatever creation left
there. A pocket created in `eur` and edited to `2000` now claims 2000 of the
accounting currency and carries an audit trail describing a different number.

This is `R50` reproduced in a second table. §9 of this document predicted it as a
risk to check before writing an editor; the editor was already written.

### 11.2 Why the goal needs history

Every figure on the board is measured against the target. `progress` is
`saved / target`, `remaining` is `target - saved`, `requiredMonthly` divides the
remainder by the months left to the deadline, and `status` compares the pace to
that requirement.

Overwrite the target and all four change retroactively. A pocket that reached
90% of a $1,000 goal reads as 45% the instant the goal becomes $2,000 — not
because anything happened to the savings, but because the ruler moved. The same
holds for the deadline: pushing it out converts a pocket that was `at_risk` into
one that was never late, and the record of having been late disappears with it.

This is the argument `010_create_budget_tables.sql` already makes for budget, in
its own words: a row is in force from its date onwards until a later row
replaces it. Pocket needs the same shape for the same reason.

### 11.3 Where pocket must differ from budget

| | budget | pocket |
| --- | --- | --- |
| Anchor | `budget_month DATE`, pinned to the first of the month by `chk_budget_month_is_first` | **`valid_from DATE`, any day.** A budget *is* monthly; a goal is not. Forcing a goal onto month boundaries would invent a precision the decision does not have |
| What one row holds | one amount | **the pair — target and desired date.** "Save $X by date Y" is one decision, and changing either half is a new version of it. Splitting them into two tables lets a target and a deadline disagree about which revision they belong to |
| Zero | a positive marker meaning *the decision not to budget* | **no analogue.** A pocket with no goal is not a state the module has. `CHECK (target > 0)`, not `>= 0` |
| Recurrence | carry-forward is what makes "this budget recurs" implicit | **carry-forward for the same reason**: the current goal is the newest row whose `valid_from <= today`, and no column says "still in force" |
| FX | migration `017` gave the allocation its own FX columns | **the revision carries its own FX snapshot too.** The rate at the moment of a revision is not the rate at creation, and storing one on the account would overwrite the other |

**The account row keeps `target` and `desired_date`.** Purely additive, exactly
as `010` left `category_budget_accounts.budget` in place: the columns stay and
keep serving every read path until that path is migrated. Nothing that reads a
pocket today has to change on the day the table lands.

### 11.4 The write path

`PUT /api/fintrack/pocket/accounts/:accountId/goal`, shaped after budget's
`/current` so the two modules are written the same way.

One transaction writes three things or none: the revision row, the mirrored
`target` and `desired_date` on the account, and the `desired_date_source` flip
to `user` — which migration `018` already installed and which the edit path is
the only thing that can legitimately set.

**The FX step is not optional and it is not a later commit.** The revision
stores the accounting-currency amount, the amount the user typed, the currency
they typed it in, the rate and its source and timestamp — the same six columns
migration `015` put on the account. Without it the table inherits `P-8` on its
first row.

Validation is §3.3's, unchanged: the desired date is compared with `>=` against
the start of today on the **owner's** calendar, on the server first. A revision
whose `valid_from` is today cannot carry a deadline already past.

### 11.5 The panel

`PocketEditModal`, built the way `BudgetEditModal` is built and for the same
reasons.

- **It owns no request.** The values leave through `onSave`, which resolves with
  the server's answer, so the panel can word what it did without asking a second
  time.
- **Three callers, matching budget's three.** The card at level 2, the detail at
  level 3, and `EditAccount`.
- **It shows what the decision is taken against.** Budget's panel carries the
  spend, the remainder and the share because an amount is decided against what
  was already spent. Pocket's carries `saved`, `remaining`, `progress` and the
  current `runRate`: a new target is decided against what is already in the
  pocket and how fast it is arriving.
- **It states the consequence before saving.** Changing the target or the
  deadline moves `requiredMonthly`, and the panel says what it moves to. This is
  the one figure the developer will check first and the one a user is actually
  choosing.

### 11.6 What does not carry over

Budget's range control — *this month*, *until a month you name*, *every month
from here* — has no pocket analogue and must not be copied. A budget recurs; a
goal is a single commitment with one horizon. The pocket panel's second control
is the date picker, not a range.

Budget's remove action, which writes the zero marker, has none either. A pocket
stops having a goal by being completed or deleted.

### 11.7 New open decisions

| id | question | recommendation |
| --- | --- | --- |
| **QP-14** | Does a revision take effect from **today** or from a date the user names? | **Today, and only today.** A revision dated into the past rewrites readings that were already shown, which is the thing history exists to prevent; one dated into the future is a promise the pace figures cannot use. `valid_from` is the server's today on the owner's calendar, never a field the client sends |
| **QP-15** | Does the board's pace read the **current** goal or the goal in force at each point of the window? | **The current goal, and say so.** `runRate` is a fact about deposits and does not depend on the target at all; `requiredMonthly` and `projectedDate` are forward-looking and can only mean anything against the goal in force now. The history exists to keep the past honest, not to recompute it |
| **QP-16** | Is `P-8` fixed inside this block or before it? | **Before, and on its own.** It is live corruption on a path that ships today, and it is not waiting for a table that does not exist. `fix(pocket): convert the edited target` writes the FX step against the existing columns; the revision table lands after |

### 11.8 Commits

Appended to §7. **Migration numbering — corrected 2026-08-29. The paragraph
below used to reserve `019`, and that reservation was wrong twice over.**

It was written when `018_pocket_desired_date_source.sql` was the highest file
on this branch, so it did not know that `020_create_pocket_tables.sql` had
since landed. And `018` was never free to begin with: `fix/auth-screen`
already carries a different migration under that number, the one turning three
foreign keys from CASCADE to RESTRICT, so the two branches were on course to
collide the moment they met.

**Settled by the developer 2026-08-29.** The RESTRICT migration keeps `018`
because it has already landed on the receiving branch, and the pocket
date-source file was renumbered to `019` in `face84b`, filling the gap this
branch left when it jumped to `020`. Not one SQL statement changed.

**The chain now reads:** `018` foreign-key restriction · `019` the pocket
deadline's origin · `020` the pocket allocation tables · **`021` free, and it
is the number the goal-revision migration of commit 9 below takes.**

**The rule this cost is worth stating.** A number belongs to a file that
exists; reserving one for unwritten work is what produced the collision, and
doing it again would leave a hole in the chain until that commit lands.

| # | commit | what it delivers | depends on |
| --- | --- | --- | --- |
| 8 | `fix(pocket): convert the edited target` | The FX step on the existing edit path. **Fixes P-8.** Independent of everything below | — |
| 9 | `feat(pocket): record the goal's revisions` | Migration **`021`** — renumbered from `019` on 2026-08-29, see the note above — the same table in `createTables.js` (H13), and the revision written inside the existing edit transaction. Purely additive; the account columns stay | 8 |
| 10 | `feat(pocket): serve the goal editor` | **BE.** `PUT /pocket/accounts/:accountId/goal`, the validation of §3.3 and the `desiredDateSource` flip | 9 |
| 11 | `feat(pocket): edit the goal from the card` | **FE.** `PocketEditModal` and the level-2 caller | 10, and the card of commit 5 |
| 12 | `feat(pocket): edit the goal from the detail` | **FE.** The level-3 caller and the `EditAccount` block | 11 |

Commit 8 does not wait for anything in this plan and should not be scheduled
behind it.

---

## 12. Decisions taken 2026-08-21 — the indicator contract is frozen

Every question §8 left open for commits 3 to 7 was answered by the developer on
2026-08-21. **§8 is superseded by this section**: where the two disagree, this
one is the decision and §8 is the reasoning that led to the question.

### 12.1 What was decided

| id | decision | consequence |
| --- | --- | --- |
| **QP-1** | Four status colours, from tokens that already exist | See §12.2. The premise of the question was wrong |
| **QP-2** | **Three complete calendar months**, canonical | The window is three whole months, not a rolling ninety days. The current month is excluded because it is incomplete and would read as a collapse in pace on the 2nd of every month. The window must be named on screen |
| **QP-3** | **The detail keeps its own transaction fetch** | Level 3 does not read the board payload. It already needs the account record, and the movements are not board data |
| **QP-5** | **Month trend is postponed** | Out of this sequence. Revisit after the pace is on screen |
| **QP-6** | **Cream outlines on dark surfaces, approved** | This is a new surface treatment and it now applies to the card. See §12.3 for what it drags with it |
| **QP-7** | **Reversed.** The headline is the **amount saved** | Not the target. Historical — every deposit since each pocket opened, not a month — summed over **all** pockets and converted through FX. The target moves down into the strip |
| **QP-11** | **Rejected as framed** | The question was whether to validate the deadline on edit. The answer is that editing is a module, not a validation rule: §11 |
| **QP-12** | **`status` normal and `requiredMonthly` normal**, defaulted deadline or not | The plan recommended withholding both. The developer's reading is that the arithmetic is correct either way and the honest fix is elsewhere: the card **states** that the date was defaulted, using `desiredDateSource`, which the payload already carries |
| — | **`projectedDate` follows its own rule** | It is `remaining / runRate` months from today, `null` when `runRate <= 0`. It never touches the deadline, so the deadline's origin cannot affect it. This closes the last part of QP-12 without a second rule |
| — | **The board converts currencies** | FX applies, as budget already does. See §12.4 |
| — | **An empty board is never a 400** | See §12.5 |
| **QP-13** | **Still open**, and no longer blocking | The labels of §12.6 settle the board. What is unanswered is only whether the appended prose describes the detail |

### 12.2 The status colours — the question's premise was wrong

§8 said the palette holds two colours. That was measured against
`generalStyles.css`, which declares `--square` and `--squareAlert`.
`frontend/src/styles/tokens.css:53-58` declares **six** status tokens. Nothing
has to be extended and nothing has to be invented:

| status | token |
| --- | --- |
| `completed` | `--color-status-success` |
| `on_track` | `--color-status-ok` |
| `behind` | `--color-status-warning` |
| `at_risk` | `--color-status-alert` |

`--color-status-error` stays out on purpose: a pocket behind its pace is not an
error the system made.

**Two things to verify before this ships.** `--color-status-success` resolves to
`#008000`, a saturated green whose contrast against the dark surface is the
weakest of the four — check it on screen rather than on paper. And the square
carries the state with colour alone, which has no accessible name and no meaning
for a reader who cannot separate the red from the orange: it needs the status in
words as its `aria-label`.

### 12.3 What the cream outline drags with it

`.accountingBox__container` paints its background from a literal, `#272d35`,
with a comment recording that the surface scale stops below it. Putting a cream
border on that card places a token and a literal on the same element. Resolve it
in the same commit rather than leaving the pair.

### 12.4 The board converts, and today it refuses to

The decision is that FX applies, the way budget already applies it: the user may
open pockets in different currencies from the front end, and the board's totals
are one figure in the accounting currency.

`pocketBoardService.js` implements the opposite. It builds the set of currencies
present and serves `currency: null` when there is more than one, with a notice
saying totals are not converted, rather than converting them. **That is now a
defect, not a design**, and it lands with commit 3 — the hero cannot show a total
saved across all pockets while the service refuses to add two of them.

### 12.5 An empty board is a new user, not an error

`dashboardController.js` returns `400` on two branches when no account of the
type exists — *"No available accounts of type …"* and *"No accounts available of
type ….."* — both guarding the `category_budget | debtor | pocket_saving` path.

Both become `200` with an empty collection and a message the interface can show.
A user who has not created a pocket yet has not made a mistake, and a client that
has to read a 400 to learn that cannot tell the case apart from a real failure.

This touches all three account types, not only pocket, so it is **its own
commit** and not part of a pocket commit.

### 12.6 The labels, settled

| where | was | is |
| --- | --- | --- |
| hero, secondary line | `Needs $425.00 this month` | `Required rate $425.00 per month` |
| card | `Needs` | `Required rate` |
| card | `Missing` | `Remaining` |
| card | `Deadline` | `Desired date` — which is also the column's real name |
| card | `behind`, as a word | the status square, coloured per §12.2, with the word as its accessible name |
| card | a bare `%` | `% saved` — the number gets a subject, which is the defect `P-7` has today at the detail |

### 12.7 What this freezes, and what it does not

**Frozen: the indicator contract, §5.** Commits 3 to 7 are implementable as
written. No question in §8 blocks them any more.

**Not frozen: the editing block, §11.** `QP-14`, `QP-15` and `QP-16` are open and
each one shapes the table before it is written — when a revision takes effect,
which goal the pace is measured against, and whether `P-8` is fixed ahead of the
block. Commits 9 to 12 wait on them.

**Commit 8 waits on nothing.** The FX conversion missing from the edit path is
live corruption on code that ships today, and `QP-16` only asks whether to
schedule it inside the block or before it. Either answer leaves the commit
itself unchanged.

---

## 13. Merge record — what came from `PLAN_POCKET_ALERT.md`, 2026-08-22

That document was opened 2026-08-15 as the alert convention, widened 2026-08-16
with the Hero proposal and a measurement of the contract, and it deferred the
question of which of the two pocket plans governs. **The question is answered by
date and by measurement: this file governs.** Its 2026-08-21 measurement (§10)
re-read every claim the other one made about the code, and its §12 froze the
contract on the same day. The absorbed document has been deleted.

Four things survived the merge. They are stated here, not filed away, because
each one changes something in §5, §7 or §12.

### 13.1 The markup rule — it governs every commit in this block

**The commits change values and add elements. They do not restructure markup, and
they do not fix neighbouring defects, however tempting.**

This is not a style preference; it is the reason budget level 1 was frozen. A
commit that added exactly the colour §12.2 now specifies also straightened the
row's markup — a stray dot removed from a class name, inline styles lifted into
classes, the amount wrapped in a span. Removing the dot activated a flex layout
that had never applied, the row reflowed, and the whole commit was reverted.

Applied here: **commit 5**, which rewrites the card, is where this rule is most
likely to be broken. Anything found while measuring is recorded as a `P-n`
finding and scheduled separately.

### 13.2 The colour mapping inverts — budget's cannot be copied

§12.2 assigns four tokens to four statuses. What it does not say, and what the
absorbed document found, is that **the mapping between percentage and colour is
the opposite of budget's**:

| | budget | pocket |
|---|---|---|
| More movement is | **bad** — spending over the allotment | **good** — saving toward the target |
| The bad terminal state is | **exceeded** — you spent more than you had | **missed** — the date passed and you did not arrive |
| The good terminal state is | *none* — a month simply ends | **completed** — saved ≥ target |
| Reaching 100% means | ⚠ you are at the limit | ✅ you are done |

**The square is inherited; the mapping is not.** Copying budget's token
assignment mechanically paints an achieved goal in the danger colour. It affects
**commit 5** and the card, and it is this block's hardest trap alongside §13.1.

The vocabulary is §12.2's — `completed`, `on_track`, `behind`, `at_risk` — not
the absorbed document's `Reached` / `Missed` / `In progress`, which was written
before the four-rung status existed. Its underlying rule survives and is already
this document's: **a state that needs a business number the model does not carry
does not ship.** That is what `QP-2` settles by naming the window (three complete
calendar months) rather than leaving the pace unwindowed.

### 13.3 The write path — three commits this sequence did not have

The absorbed document measured the **creation** path and found two invented
answers. Commit `0a` closed half of one of them; the rest is still live, measured
again 2026-08-22 at `accountCreationController.js:985-988` and `:997-1001`.

**Developer instruction, 2026-08-16, still standing:** *a pocket cannot exist
without a target and without a date; both are mandatory.* That closes the two
defects as a **code correction with no migration** — `desired_date TIMESTAMPTZ
NOT NULL` was already the right shape, and the write path was walking around it.

| # | commit | what it delivers | depends on |
| --- | --- | --- | --- |
| 13 | `feat(pocket): require target and date` | `NewPocket.tsx` and its validation. **The form goes first**: making the server strict before the form always sends both would reject real submissions in the window between the two commits | — |
| 14 | `feat(pocket): validate the pocket payload` | A schema in `validation/zod/`, mounted on `accountRoutes.js:58`. **The route has no validator at all today.** Follows `budgetValidators.js`, the module's precedent. After this the controller's defaults are unreachable | 13 |
| 15 | `fix(pocket): stop inventing target and date` | Removes both defaults, now dead. **Closes `P-9` and `P-10`** | 14 |

**The order is the safety property, not a preference.** Form → validator →
remove defaults means the field is never simultaneously unvalidated and
undefaulted, and no commit leaves a working screen broken. That is `CLAUDE.md`'s
gradual-execution rule applied to a three-commit change.

**`target` stays nullable on purpose.** Tightening it to `NOT NULL` would be a
migration that buys nothing: rows already holding `0.00` cannot be told apart
from a deliberate zero, so the constraint would cement the damage instead of
curing it. The code prevents new bad rows, which is the only recoverable part.
**Recorded so a later reader does not "fix" the nullable column.** Backfilling
the existing `0.00` targets is out for the same reason — they are ambiguous
between *typed zero* and *never typed*, and nothing distinguishes them.

### 13.4 Three findings, renumbered into this document's series

Filed as `R59`–`R61` in the absorbed document. Renumbered here; the `R` numbers
stay valid in `REMARKS.md`.

| # | was | defect | why it matters here |
|---|---|---|---|
| **P-9** | R59 | `accountCreationController.js:985-988` coerces an absent target to **`0.0`**, although the column is nullable | **It breaks the status flag before it is written.** `saved >= target` is trivially true against zero, so every targetless pocket reads `completed`. And the database writes the zero the style rule forbids the UI from rendering |
| **P-10** | R60 | `accountCreationController.js:997-1001` defaults an absent `desired_date` to a computed date | A pocket created without a date is due on a date nobody chose. Commit `0a` shortened the horizon from a year to a month and `0b` records the provenance in `desiredDateSource`, so the *reporting* half is closed — **the invention itself is not.** Combined with `P-9` the two conspire: no target and no date reads `completed` forever; a target and no date reads `at_risk` within the month |
| **P-11** | R61 | `pages/pocket/components/ListPocket.tsx` and `pages/budget/components/ListPocket.tsx` are **byte-identical** | §10 established that only the first is the pocket board, so this is not a fork in the routing — it is a fork in the *surface commit 5 edits*. Any card work either lands twice or has to establish which file is reached. **Resolve it before commit 5**, by measurement, and comment the loser with a note rather than deleting it (D13, D8) |

`P-9` and `P-10` are **preconditions of the status flag**, not neighbouring
noise. The four rungs of §12.2 compute themselves only if their two inputs are
honest, and today an absent answer is stored as a real one.

### 13.5 A discrepancy to verify, not a finding

`015_pocket_target_fx_columns.sql:28` states that *"pocket_saving_accounts holds
no currency column of its own"*, while `002_accounts.sql:197` defines
`currency_id` on that table. One of the two is stale. **Not resolved here** — it
is a currency-model question, measured before anything touches the target's
currency, never patched on the way past. It is also the same column
`createTables.js` is missing, which is a separate live divergence between the
migration chain and the boot-time schema builder.

### 13.6 What was dropped, and why

| dropped | why |
|---|---|
| The alert convention as a standalone specification | It asked whether pocket has a status flag and where it is computed. §5 and §12 answer both: the flag is served, with four rungs and four tokens |
| The measurement checklist `P1`–`P5` | Every row was measured, here or in §10 |
| The open questions `Q1`–`Q8` | `Q1` is this merge. The rest were answered by §12 or restated as `QP-n` |
| The Hero proposal | Already present in this document as the appended prose after §9, and open as `QP-13` |
| The contract measurement of 2026-08-16 | Superseded by §10's re-measurement of 2026-08-21, which corrected eight of its anchors |
| The `A`/`B` block sequence | Block B is commits 1–7 of §7, already partly landed. Block A survives as §13.3 |

### 13.7 Where the work actually is

The four landed commits (`0a`, `0b`, `1`, `2`) are on **`feat/pocket`**. This
plan is being read from a different branch, so **every line anchor above must be
re-measured against `feat/pocket` before a Gate 1**, not trusted from here.

---

## 14. The allocation model — SUPERSEDED by section 16 on 2026-08-29

> This section was provisional and is no longer the model. **Section 16 is.**
> What survives unchanged is its refusal of an investment account as a source of
> committed money. Read it as history.

### 14.0 The provisional heading it carried

**Status: PROVISIONAL.** The conceptual model (§14.1–§14.5) is frozen and will
not be re-litigated commit by commit. The five schema rules (§14.6) are adopted
with their arguments recorded, `QP-18` provisionally — it imposes a breakdown by
source account on the pocket view that has not been designed. No migration is
written and no column is created until that screen is settled.

### 14.1 The problem this solves

A pocket today is a real account that really receives money. Funding a pocket
writes two rows in `transactions` and moves both balances, so
`user_accounts.account_balance` for the funding bank is the *spendable* balance,
not the balance the bank statement shows. The owner cannot reconcile FinTrack
against a real statement, and `hero.cashPosition` counts the same money twice —
once in the bank, once in the pocket.

The fix is to stop moving money. A pocket does not hold money; it *assigns*
money that stays in the real account.

### 14.2 The three figures

| figure | source | meaning |
|---|---|---|
| Account balance | `user_accounts.account_balance` | real money, ties to the bank statement |
| Allocated | `SUM(pocket_allocations.amount)` for that account | money committed to pockets |
| Available | balance − allocated | money free to spend, may be negative |

A bank at 700 with 300 allocated is 400 available. If 500 more is spent, it is
200 real, 300 allocated, −100 available: **over-allocated**, a valid financial
state, not a data-integrity error.

### 14.3 The three operations

- **Allocate** — creates a positive row. Does not change any account balance.
- **Release** — creates a negative row. Does not change any account balance.
- **Spend** — an ordinary transaction. Lowers the account balance and leaves
 allocations untouched. It may leave the account over-allocated, and it is
 never rejected for that reason.

The system never guesses which pocket a movement affects. A bank-to-bank
transfer is the same case as a spend: it lowers the source balance, the source
shows over-allocated, and the owner corrects it with `Release` on A and
`Allocate` on B — two rows, full history, no pro-rata machinery.

### 14.4 The precondition, which is not an invariant

`SUM(allocations) ≤ account_balance` is a **precondition of Allocate**, not a
property the system maintains. A spend breaks it legitimately. It therefore
lives in the allocation service only and **must never be written as a database
`CHECK`**, which would block the insert of a real expense.

### 14.5 Frozen decisions

| decision | V1 |
|---|---|
| A pocket moves money | No |
| A pocket carries an accounting balance | No |
| Allocate / Release | Yes |
| Allocation rows | Append-only, never updated |
| Amount | Signed: positive allocates, negative releases |
| Current state | `SUM(amount)` |
| History | The rows themselves |
| A spend consumes a pocket automatically | No — out of V1 |
| Over-allocation | Permitted and displayed |
| Allocate exceeding available | Rejected |
| `account_balance` of a pocket account | 0 |
| Pocket in net worth / total cash | No |
| Allocation source | A real account, mandatory |
| Investment account as source | **No.** Its balance is a market valuation, not spendable money; a price move would produce a false over-allocated state |
| Currency | The accounting currency, as everywhere else — no currency column |
| `user_id` on the allocation | Yes |
| Expense category pointing at a pocket | Out of V1 |

### 14.6 The five schema rules — each one argued

Four are mechanical and cost nothing. Only `QP-18` changes what the owner sees.

#### QP-17 — `CHECK (amount <> 0)`

**Rule.** A row whose amount is zero is rejected by the database.

**Why.** In an append-only ledger every row asserts a fact — *assigned 300*,
*released 100*. A zero row asserts that nothing happened, which is precisely
what a table of facts must not contain. It is normally the symptom of a form
submitted empty, and once written it is indistinguishable from a real entry in
the history the design exists to preserve.

It differs from the precondition of §14.4 on the point that decides where a rule
belongs: it depends **only on the row itself**, never on the balance of another
table. The database can therefore enforce it at all times without ever blocking
a legitimate operation.

Measured precedent: `transactions` in production carries two 0.00 rows from a
May test (ids 685 and 686). This is what keeps them out of the new table.

**Decision: adopted.**

#### QP-18 — release is bounded per (pocket, source account) pair

**Rule.** For every pair of pocket and source account, the running
`SUM(amount)` must never go below zero. Not merely per pocket.

**Why.** A pocket can be fed from several accounts:

```
 Allocate  +300  from CASH
 Allocate  +200  from Nu
 → pocket = 500
```

Release 400 charged to CASH. The pocket total lands on 100, which is positive,
so a per-pocket check accepts it. But CASH is now at **−100 net allocated**: the
application asserts that a real account committed negative money, and its
`available = balance − allocated` comes out **inflated by 100**. The distortion
lands on the real account, which is the exact figure the whole model exists to
protect.

Technically it is the same query with one more column in the `GROUP BY`.

The real consequence is not in the schema but in the interface. Releasing stops
being *"I release 400 from this pocket"* and becomes *"I release 400 of what
this pocket holds **from CASH**"*. The pocket view must show the breakdown by
source account, otherwise the owner cannot answer the question the release form
asks.

**Decision: adopted, provisionally — the breakdown by source is a UI cost
accepted without the screen being designed yet.**

#### QP-19 — a source account cannot be deleted while its net allocation is non-zero

**Rule.** Soft-deleting an account whose net allocated amount differs from zero
is blocked, with a message naming the pockets that must be released first.

**Why.** `user_accounts` has `deleted_at`, so accounts are soft-deleted. Delete
CASH while 300 of it is assigned to a pocket and the pocket is backed by an
account that no longer exists: that money is now nowhere.

The alternative is to insert the compensating negative rows automatically. That
makes the owner's goal drop on its own, with no act of theirs behind it — the
system guessing what a movement meant, which is the one behaviour this model
forbids everywhere else (§14.3).

**Decision: adopted.** The wider question of how an account is deleted at all is
`PLAN_ACCOUNT_DELETION.md`, opened 2026-08-22; this rule adds one state to its
§5 table and does not depend on which option that block chooses.

#### QP-20 — a pocket cannot be deleted while its net allocation is non-zero

**Rule.** The net must be released to zero before the pocket can be deleted.

**Why.** The mirror of `QP-19`. Delete the pocket and its allocations are
orphaned: the source account stays committed to something that does not exist,
so its available balance is understated permanently and nothing on screen
explains why.

Requiring zero first makes the release an explicit act with its own date and its
own row, which is what the history is for.

**Decision: adopted.**

#### QP-21 — no `updated_at` column

**Rule.** The table carries `created_at` only.

**Why.** This is not a constraint but a prohibition. Append-only means no row is
ever modified; an `updated_at` column **advertises** that rows are updated, and
eventually someone updates one, destroying the history that justified choosing a
ledger over a mutable balance.

It is recorded because the risk is inertia rather than disagreement:
`transactions`, `user_accounts` and `pocket_saving_accounts` all carry the
column, and the new table will be written by copying one of them.

**Decision: adopted.**

### 14.7 Provisional shape

```
 pocket_allocations
  allocation_id
  user_id
  source_account_id
  pocket_account_id
  amount             -- signed, CHECK (amount <> 0)          QP-17
  effective_date
  created_at                                                 QP-21: no updated_at
```

Service-level rules, never database constraints: the allocation precondition
(§14.4), the per-pair release bound (`QP-18`), and both deletion guards
(`QP-19`, `QP-20`).

Worked example:

```
 date      operation   amount   running
 May 01    Allocate     +300      300
 Jun 10    Release      -100      200
 Jul 05    Allocate     +150      350
 Aug 01    Release      -350        0
```

### 14.8 What production actually holds — measured 2026-08-22 on `fintrack_rehearsal`

One pocket, one funding chain, one source account.

| datum | value |
|---|---|
| Pocket accounts | 1 — `cash_loc_chinita`, id 108, balance 90.00 |
| Funding source | 1 — `CASH`, id 109, balance 0.01 |
| Funding transaction | id 264, +90.00, `movement_type_id` 5, 2026-05-14 |
| Rows with `movement_type_id = 5` | 4, of which 2 are zero-amount tests (685, 686) |
| Pocket opening balance | 0.00 — self-referencing row, transaction 259 |
| Withdrawals from a pocket | none, ever |
| Investment accounts | none exist |

Four of the hard cases have **no data exercising them**: cross-account
attribution, an unattributable historical opening balance, spending reserved
money, and over-allocation (90.00 allocated against 90.01 held). The migration
is the cheapest it will ever be, and grows with every new contribution.

Caveat: the copy's last transaction is 2026-08-11. Production must be
re-measured before the migration is written.

### 14.9 Migration shape — not written, blocked on the pocket view of §14.6

**UP** — create `pocket_allocations`; insert one row (account 109 → pocket 108,
+90.00, `effective_date` from transaction 264); restore
`user_accounts.account_balance` for account 109 from 0.01 to 90.01; set account
108's `account_balance` to 0; mark the `movement_type_id = 5` rows historical.
The two zero-amount test rows produce no allocation.

**DOWN** — reverse both balances and drop the table.

### 14.10 Downstream impact

| what | where | effect |
|---|---|---|
| `hero.cashPosition` and `netWorth` | `OVERVIEW_DECISIONS.md` D27, open as D44 | adding `pocket.totalAmount` to the bank balance becomes double counting. Adopting this model decides D44 |
| Totals by account type | `dashboardController.js:51`, `:171` | a pocket's `account_balance` is 0, so the pocket total must read from the allocations, not from the column |
| Transfer form | `Transfer.tsx:105`, `:113` | `pocket` leaves both the origin and destination selectors; allocation moves inside the pocket view |
| Pocket target FX | §13.5 | unaffected. `pocket_saving_accounts.currency_id` is NULL in production, still the open divergence |

### 14.11 What this section does not decide

The UX of the allocation action, whether the pocket list shows the source
account, and whether an allocation carries a note. None of them change the
model; all of them are surface decisions taken when §14.6 closes.

## 15. Decisions of 2026-08-29 — pocket under the allocation model

**These supersede section 11.7 and every row of section 12 they touch.** The model
they rest on is the one section 14 made provisional and the developer has now fixed:

> **A pocket is not an account and holds no money. It is a plan for distributing
> money that already sits in real accounts, expressed as allocations.**

Everything below follows from that one sentence, and the ones that changed changed
because the old answer described an object that owned a balance.

### 15.1 The detail hero is planning, not a statement — QP-13 CLOSED

**The proposed hero is deleted, not relocated.** The appended prose asked for
*Current Balance / Total Contributions / Total Withdrawals / Net Change*, and the
open question was only which surface it belonged to. Under the new model the
question is void in both directions: those four figures describe an object with its
own money, and a pocket has none. There is no surface for them.

The detail hero states the plan:

```
 EMERGENCY FUND

 Target              $10,000
 Allocated            $7,200
 Remaining            $2,800
 Progress                72%
 Desired date     Dec 31, 2026

 Required monthly      $700
 Days remaining         124
```

This is the psychological purpose of a pocket: how far the plan has got and what it
asks of the owner next. A balance statement answers a different question about a
different kind of object.

### 15.2 No revision history in V1 — QP-14 CLOSED, and the table is cancelled

The plan carried a contradiction: it recommended a revision take effect *today and
only today*, which is a rule about history, while also proposing a **revisions
table**, which is history. The developer removed the contradiction by removing the
history.

**V1 stores the current plan and nothing else** — `target`, `desired_date`,
`updated_at` on `pockets`. Changing 5,000 to 7,000 **replaces** the figure. The app
does not reconstruct what the plan looked like three months ago.

**The naming follows the decision.** This is not *revision history* and must not be
called that anywhere in the code, the payload or the interface. It is **edit the
current plan**.

**Migration 019 and its revisions table are cancelled**, and with them commit 9 as
that commit was specified. Commits 10 to 12 lose their dependency on it.

### 15.3 The pace question dissolves, and two indicators leave V1 — QP-15 CLOSED

With no history, there is no *goal in force at each point of the window* to choose
between, so the question has no second option. The calculation reads the current
target, the current allocated total and the current desired date.

The larger decision is what a pocket may claim to know:

| indicator | V1 | why |
| --- | --- | --- |
| Target | yes | stored |
| Allocated | yes | summed from allocations |
| Remaining | yes | subtraction |
| Progress % | yes | division |
| Desired date | yes | stored |
| Days remaining | yes | calendar |
| Required monthly | yes | remaining divided by the horizon. A present-tense arithmetic necessity, no history needed |
| **Run rate** | **no** | requires reading past allocation behaviour |
| **Projected date** | **no** | requires assuming a future pace |

The two that leave are the two that need a past or predict a future. Section 12
listed a rule for `projectedDate`; that rule is withdrawn, not amended.

### 15.4 The FX rule is general, not a pocket feature — QP-16 KEPT, generalised

Converting an edited target is **a data-corruption fix, not a pocket feature**, and
the rule that governs it is not a pocket rule:

> **Every form that accepts money in a currency other than the accounting currency
> passes through the FX mechanism FinTrack already has.**

That binds four pocket forms — **New Pocket, Edit Pocket, Allocate, Release** — the
same way it binds every other money form in the application. **No FX solution is
written for pocket.**

### 15.5 What this costs — measured on the built branch, 2026-08-29

The seven backend commits on `worktree-agent-a4aee04d12f126b4e` were written against
the previous specification. Measured against the decisions above:

| decision | state of the built code | rework |
| --- | --- | --- |
| No run rate, no projected date | Never built. `pocketBoardService.js:18-21` states the reason in the code: a rate over allocation rows *"measures how often the owner changed their mind, not how fast money arrived"* | **none** |
| The eight planning figures | `makePocketStatus.js:109-127` emits exactly target, allocated, remaining, progress, desiredDate, daysRemaining, requiredMonthly and status | **none** |
| No revisions table | Migration 020 creates two tables, `pockets` and `pocket_allocations`. No revision table anywhere | **none** |
| The shared FX mechanism | `pocketAllocationService.js:27` imports `currencyAmountConversion` from `fx_services`. Nothing pocket-specific | **none** |
| The planning hero, no balance hero | Backend only; the detail service serves the plan figures and no contributions or withdrawals aggregate | **none** |

**The backend needs no rework.** The decisions and the built code converged
independently.

**What is still broken, and is not on that branch:** the legacy edit path.
`accountEditController.js` contains **zero** references to `exchange_rate` or
`currencyAmountConversion` and writes `target` and `desired_date` raw. That is the
live corruption, and it is the path `EditAccount` uses today.

> **Re-measured 2026-08-30 — the defect stands, its reach does not.**
> `accountEditController.js` still holds the pocket branch at `:90-101`, its
> write map at `:311` and the deadline-provenance update at `:344-349`, and still
> contains no reference to `exchange_rate` or `currencyAmountConversion`. But it
> is no longer *"the path `EditAccount` uses today"*: the account editor's pocket
> branch went from the client, a pocket is edited at its own route
> (`EditPocket.tsx`, `App.tsx:352`) through `PATCH /api/fintrack/pocket/:pocketId`,
> and the development database holds no account of the retired type for the
> branch to corrupt. The whole backend module is on `fix/auth-screen`, so the
> "not on that branch" framing of this paragraph no longer applies either.

### 15.6 The two edit paths — CLOSED 2026-08-29

There were **two** ways to edit a pocket: the new module's endpoint, which satisfies
the FX rule of 15.4, and the legacy account editor, which violates it.

**Decided: a pocket is not editable at all until the module is fully defined.**
Pocket comes out of the account editor — `accountEditSchema.ts:168` and the
`pocket_saving` branch of `accountEditController.js`. The legacy path is retired
rather than repaired, which **discharges QP-16 for that path without writing an FX
fix for code that is going away.**

**Two consequences, both accepted rather than hidden.** Until the pocket branch is
integrated, a pocket cannot be edited by any route — which is what the decision
asks for. And the rows already written with an unconverted target stay wrong: that
is data repair, it has no plan, and retiring the path stops the bleeding without
treating the wound.

## 16. The final model — frozen 2026-08-29

**This closes the model. Section 14 was provisional; this is not.** Everything
above that describes a pocket as an account is superseded.

### 16.1 A pocket is a savings plan, and a savings account is a bank account

The confusion this removes: **a pocket is not a savings account, and none is
needed.** Real money lives in a real bank account, which may eventually carry a
`savings` subtype of its own. A pocket is the **goal** that money is committed
towards. The two are different objects and the relation between them is many to
many:

```
                 Emergency Fund
                 Target $10,000
                       |
              +--------+--------+
              |                 |
         BBVA Savings      Chase Checking
            $6,000            $1,200
              |                 |
              +--------+--------+
                       |
                   Allocated
                     $7,200
```

The money is still $6,000 in BBVA and $1,200 in Chase. The pocket only states
that $7,200 is currently committed to Emergency Fund. **Financial reality lives
in the accounts; discipline and planning live in the pockets**, and neither
rewrites the other.

`pocket_allocations` is that relation and the only N:N join in the module. It is
already built exactly this way: migration 020 creates `pockets` and
`pocket_allocations` and deletes the pocket rows from `user_accounts`.

### 16.2 Account detail shows the commitment, not a transaction

A bank account with money committed to pockets says so, as a **planning position**
and never as a movement:

```
 BANK ACCOUNT
 --------------------------------
 Balance                   $5,000

 Allocated to pockets      $2,200
 Unassigned cash           $2,800

 Pocket allocations
 Emergency Fund            $1,500
 Vacation                    $500
 Car Maintenance             $200
```

It answers *I have $5,000 in the bank, but how much of it have I already reserved
in my head?* without altering the real balance.

**Measured 2026-08-29: the whole sketch is already served.** Commit `bf41c2c`
attaches four fields to the account detail payload — `allocated`,
`unassignedCash`, `isOverAllocated` and **`pockets`**, the per-pocket breakdown
the third block draws. The three lines are absent, not zero, on account types
where they mean nothing. **What is missing is the frontend rendering, nothing
else.**

> **Re-measured 2026-08-30: still true, and the enrichment is now on this
> branch** at `getAccountController.js:857-885`. The frontend rendering is still
> missing: `AccountDetail.tsx:96` branches its url to `null` whenever the caller
> arrived with route state, `AccountListType` (`types/responseApiTypes.ts:303`)
> declares none of the four fields, and no component draws the breakdown.

## 17. The migration rehearsal — run 2026-08-29

**Migration 020 was applied to two throwaway clones. It fails on one and is exact
on the other, and both results matter.**

### 17.1 It fails against the production copy, for a nameable reason

Applied to a clone of the local production copy, the migration aborts:

```
 column u.timezone does not exist
 PL/pgSQL function inline_code_block line 28 at SQL statement
```

**The dependency is real and deliberate**, not a slip: step 2 writes
`(psa.desired_date AT TIME ZONE u.timezone)::date`, converting each legacy
deadline into a calendar day on its owner's clock. Without that column there is
no zone to convert against.

The production copy's `users` table runs `... currency_id, google_id, ...` with
**no `timezone` between them**; the development database has it. So that copy
predates the time zone work entirely. **Whether the live Supabase database also
lacks the column was not checked — this session did not connect to production**,
and the answer decides whether this is a stale local snapshot or a deployment
blocker. It is item 4 of the production checklist either way.

A second fact from the same clone: **its `migrations` table exists and holds zero
rows.** That schema was not built by the migration chain, so "apply the next
migration" is not a description of what deploying 020 there would be.

### 17.2 The DOWN section rests on a premise the copy contradicts

The DOWN states that steps 2 to 5 do not reverse, and justifies leaving them
irreversible with a measurement: *production held zero pocket accounts, zero
`pocket_saving_accounts` rows and zero pocket transactions when this migration
was authored (2026-08-24)*.

**The production copy holds one of each.** Account `108`, `cash_loc_chinita`, a
`pocket_saving` row not soft-deleted, carrying **90.00**, with one row in
`pocket_saving_accounts` and three transactions against it.

Two consequences. The irreversibility argument no longer holds unexamined — on
that data steps 3, 4 and 5 fire with non-zero counts, and the DOWN's own
instruction applies: **export `user_accounts`, `pocket_saving_accounts` and the
affected transactions before running the UP.** And the name is its own finding:
a *cash location* typed as a savings pocket is exactly the conceptual confusion
section 16 resolves.

### 17.3 Against a current schema it is exact

Applied to a clone of the development database, every step reported and the
money is conserved to the cent:

```
 step 2: 4 pocket account(s) copied into pockets
 step 3: 2 funding account balance(s) restored
 step 4: 10 transaction(s) deleted
 step 5a: 0 debtor account(s) no longer point at a pocket
 step 5b: 4 pocket account(s) deleted
 COMMIT
```

| check | result |
| --- | --- |
| Balance returned to the funding accounts | `banco` +18.49 and `transport/public/must` +0.50 = **18.99** |
| Balance the four pockets held | **18.99**. Exact, no rounding residue |
| Transaction rows touching a pocket on **either** side | **10**, which is what step 4 deleted — both legs of every entry, not only the owning one |
| Pocket rows left in `user_accounts` | 0 |
| Rows in `pockets` | 4, each with its target and its deadline as a calendar day |

**One thing the counts teach that is easy to get wrong:** counting
`transactions.account_id` on pocket accounts gives 7, and the migration deletes
10. The extra three are the funding-side legs. A movement is two rows, and step 4
is right to take both — a count that looks like over-deletion is the correct one.

**The second finding of the restoration:** one pocket was funded from a
`category_budget` account, not a bank. Any verification that sums only bank
balances reports a 0.50 shortfall that does not exist.

### 17.4 What is still unrehearsed

The DOWN was never executed — it is commented out in the file, by convention, so
the runner cannot reach it. Its first step, dropping the two tables, is trivially
reversible. Its steps 2 to 5 have no automated reverse by design, which 17.2 is
about.

## 18. The screen decisions — set 2026-08-29

**Taken before any component is written, and after the model of section 16 was
frozen. The backend inventory that section 19 will hold is what these are built
against; nothing here may be implemented from a specification the code has not
been measured against.**

### 18.1 The naming rule, binding on payloads, code and interface

- **Never the bare word *budget* inside this module.** That word belongs to the
  budget module, and mixing them is the confusion the model removes.
- **Never the bare word *allocation*.** It is ambiguous between
  `pocket_allocations` and `budget_monthly_allocations`. Write **pocket
  allocation** or **monthly budget allocation**.
- **Never *saved*. The figure is *allocated*.** The money is not saved anywhere:
  it sits in a real account and is committed. A screen that says *saved* has
  re-introduced the idea that a pocket holds money.

### 18.2 Creating a pocket — FROZEN 2026-08-29

> **A pocket may be created with nothing committed to it, or with one optional
> initial commitment drawn from one real account. That initial commitment is
> part of the creation transaction and remains a separate `pocket_allocations`
> row. Committing from several accounts is available only after creation,
> through the commit operation.**

This supersedes the first draft of this section, which forbade naming an account
at creation. The argument that a goal and a commitment are two decisions
survives: the second decision stays **optional and defaulted to not taken**.
Offering it is not the same as folding it in — what would have broken the model
is *requiring* an account, not permitting one.

**The form.** Name, target, desired date, optional note, and then an *initial
commitment, optional* block holding one source account and one amount, with a
skip. `New Pocket` does not become a management tool for commitments.

**One account, not several, in V1.** Several accounts at creation is the commit
modal embedded in the creation form, with per-row validation against each
account's unassigned cash and partial-failure semantics to define. The
many-to-many portfolio is built after creation, on the detail, where the pocket's
state is visible between commitments.

**The request is one, not two.** The frontend does not chain a creation and then
a commitment. The optional block travels inside the creation payload and the
server does both inside one transaction: create the pocket, and if a commitment
was named, resolve the source account, lock its row, check its unassigned cash,
and write the commitment.

**If the commitment fails, the pocket is not created.** An account holding $500
with $300 unassigned, asked for $400, answers 422 naming the $300 — and nothing
is written. That is cleaner than *the pocket was created but the commitment
failed*, which is what chaining two requests produces and which leaves the owner
holding a pocket they did not ask for on its own.

**Nothing about this reaches the schema.** There is no `pockets.initial_amount`
and no `pockets.source_account_id`, and adding either is precisely the mistake
this decision avoids: it would make the first commitment structurally different
from every later one and put a single account id on an object whose whole point
is that several accounts can fund it. The initial commitment is simply the first
row of `pocket_allocations`, written inside the creation workflow and
indistinguishable afterwards from one written a month later.

**What it costs in the code, measured 2026-08-29.** Two changes, both small and
both in one direction. The creation validator is declared `.strict()` and accepts
exactly name, note, target amount, currency and desired date, so it rejects any
extra key today and has to learn the optional block. And the commitment service
opens its own transaction and takes the account row `FOR UPDATE` inside it, so it
has to become callable with a connection the caller already opened — the ceiling
check, the lock and the 422 that names both figures are already written and are
reused unchanged.

### 18.3 The detail is the module's operating centre

The hero states the plan — allocated, target, remaining, progress, required
monthly, days remaining. Under it, **funding sources**: how much of the committed
total comes from each account, which answers the question the hero cannot,
*where does the money I have committed to this goal actually sit?*

### 18.4 Committing and releasing are operations, not editing

Editing a pocket changes its name, its target, its desired date and its note.
Committing money and releasing it are separate operations with their own forms,
because the underlying ledger is **append-only**: a commitment writes a positive
row, a release writes a negative one, and no row is ever updated or deleted.

**They must not live inside the edit form.** An interface that puts them there
states that releasing money is a correction of a field, and it is not.

**The action hierarchy on the detail:** two primary actions, *allocate* and
*release*, and a secondary menu holding *edit* and *delete*. Not four equal
buttons — the screen has to read as a goal being tracked, and the two
money-commitment operations are what the module is for.

### 18.5 The history is called allocation history, never transactions

These are not financial movements and calling them transactions re-introduces the
idea that a pocket holds money. Each entry shows its date, its signed amount, the
account it came from or returned to, and whether it was a commitment or a
release. Opening one shows the amount as typed, the currency as typed, the
converted amount, the rate used and the date the decision was taken — which is
`allocation_actual_date`, not the row's creation time.

### 18.6 The source picker shows three figures, and the real balance is one of them

The account selector in the commitment form shows, per account: the **balance**,
the amount already **allocated to pockets**, and the **unassigned cash**. The
ceiling on a commitment is the unassigned cash, and the server refuses above it.

**The real balance stays the real balance.** An account holding $4,000 with
$1,500 committed must never be presented as having $2,500 available: the owner
can spend the whole $4,000, because **a pocket does not lock money**. The three
figures are shown side by side precisely so the interface never has to choose one
number to call *available*.

### 18.7 Spending committed money is allowed, and produces a state

If the owner spends money that was committed, the spend is not refused, the
pocket is not silently adjusted, and no compensating row is written. The account
simply reports a negative unassigned cash and the state reads **over-allocated**.

A real movement takes precedence over an intention to save. This is why the
constraint is a displayed state and not a database `CHECK`.

### 18.8 Reaching the target is a derived state, and nothing moves

When the committed total reaches the target the pocket reports **funded**. No
account is created, no money moves, nothing is closed. The owner may leave it,
release part of it, raise the target, move the date or delete the pocket, and the
money stays where it always was.

### 18.9 The component tree

```
 PocketLayout
 |
 +-- PocketBoard
 |   +-- PocketSummary
 |   +-- PocketToolbar : search, sort, filters
 |   +-- PocketList -> PocketCard
 |   +-- NewPocketButton
 |
 +-- PocketDetail
 |   +-- PocketHero
 |   +-- PocketSourceAccounts
 |   +-- AllocationHistory
 |   +-- PocketActions
 |
 +-- NewPocket
 +-- EditPocket
 +-- AllocateModal
 +-- ReleaseModal
 +-- DeletePocketModal
```

### 18.10 Two screens, two questions, one set of rows

The account detail answers *where is my money really?* and the pocket detail
answers *how am I organising the money I already have towards my goals?* Both
read the same `pocket_allocations` rows from opposite ends, which is why each has
to know about the other and why neither may compute a figure the server did not
serve.

**The axis of the whole module, and the sentence to return to whenever a screen
is in doubt:** a pocket never represents money. It represents an intention about
money that stays in a real account. A pocket allocation represents the commitment
of that money. A transaction represents the movement that actually happened.

## 19. Defect triage and the order of work — set 2026-08-29

**The conceptual model is not in question.** Every problem the backend inventory
found is either a defect of the new module, or a leftover of the transition from
the old one, or the integration with account deletion. Nothing here reopens
section 16.

### 19.1 The classification

| # | the problem | weight | what it means |
| --- | --- | --- | --- |
| 1 | Two models of a pocket live on the branch at once | **blocks the migration** | Retire the legacy path, never repair it |
| 2 | A missing exchange rate answers `500` | **blocks the money endpoints** | It becomes `503`, not `422` |
| 3 | Which accounts may fund a pocket | **blocks the source picker** | Eligibility is a rule about cash, not a list of types |
| 4 | A soft-deleted source strands the money committed from it | **blocks account deletion** | Resolved together with 5 |
| 5 | Account deletion knows nothing about pockets | **blocks account deletion** | Impact report, then delete in one transaction |
| 6 | The six FX columns on the goal are written and never read | important | Show the target as typed beside the converted figure |
| 7 | The board handler bypasses the module's error mapper | cleanup | Before the module is called finished |
| 8 | The deadline is validated nowhere | important | `desiredDate >= today` on create and on edit |
| 9 | The ledger reads do not filter by owner | hardening | Cheap, and the column is already there |
| 10 | The minimum-amount message names the wrong currency | small | Say the typed currency, or say the converted one — never mix them |
| 11 | The module is unreachable from the working branch | **blocks execution** | Merge once, do not cherry-pick |

> **RE-MEASURED 2026-08-30 — four of the eleven are resolved; seven stand.**
>
> | # | state |
> |---|---|
> | 1 | **resolved on the write side.** The creation route and its handler are withdrawn (`accountRoutes.js:57-62`, `accountCreationController.js:977-985`) and no file under `frontend/src` names the retired type. The editor's branch and the two reads remain, over an empty table |
> | 2 | **stands.** A grep for `503` across `fx_services/`, `pocket_services/`, `pocketController.js` and `pocketValidators.js` returns nothing |
> | 3 | **resolved.** `getAllAccountsByType` serves the three figures per eligible account for `bank` (`getAccountController.js:431-462`), and `PocketSourcePicker.tsx` renders them |
> | 4, 5 | **stand.** `deleteAccountService.js` and `getAnnulmentImpactReport.js` still contain no reference to `pocket_allocations`, so a soft-deleted source still strands what was committed from it |
> | 6 | **stands.** `insertPocket` writes the six columns (`pocketRepository.js:189-190`) and `updatePocket` maintains five (`:244-248`); no read selects any |
> | 7 | **stands.** `pocketController.js:90` still catches the board with `next(error)` |
> | 8 | **stands.** Nothing on the pocket write path compares `desiredDate` against the owner's today |
> | 9 | **stands.** `getAccountAllocations` (`accountAllocationRepository.js:44`, join at `:59`) and the subquery inside `lockOwnedSourceAccount` (`:212-215`) still carry no `pa.user_id` |
> | 10 | **stands.** Not re-read line by line; nothing in the working tree touched that message |
> | 11 | **resolved.** The whole module is on `fix/auth-screen`; the merge happened once, as this row asked |

### 19.2 The legacy path is retired, never repaired

The old creation route, the account editor's pocket branch and the legacy read on
the account detail all still work on the branch, and migration `020` deletes the
rows they depend on. **Retiring them is a prerequisite of the migration, not a
tidy-up after it.**

This also disposes of the missing conversion on the old edit path for good: **it
gets no fix of its own.** Writing an FX step into code that is being removed is
work spent on a path that will not exist.

**The order:** the new endpoints exist, the frontend consumes them, the three
legacy consumers are retired, and only then is the old table dropped.

### 19.3 A provider outage is 503, and the client never guesses

Two different situations were collapsing into one server error. A request whose
data cannot be accepted is `422`. **A rate that could not be obtained is `503`** —
the service the request depends on is unavailable, which is not the caller's
fault and not a defect. The screen says the exchange rate is unavailable and
offers to retry.

**The client never recomputes and never guesses a rate.** That is the whole
reason conversion lives on the server.

### 19.4 Eligibility is a rule about cash, not a list of account types

The question is not *which account type may fund a pocket*. It is:

> **which accounts hold spendable cash whose balance is an actual cash balance?**

An investment account fails it — its balance is a valuation, not money that can
be committed. An income source is not an account holding money. A debtor is not
either. A pocket never can, because it holds nothing.

**A cash account passes the rule conceptually and fails it in practice**, because
no route creates one and the account detail refuses the type. **The account
domain is not being reshaped to serve this module**: if only bank accounts
satisfy the rule today, V1 ships with bank accounts only.

**The consequence for the screen, which is the part that matters:** the source
picker does not list every account and does not decide eligibility itself. It
renders what the server declares eligible, each with its balance, its committed
amount and its unassigned cash.

### 19.5 Deleting an account removes its commitments, in the same transaction

The decision already taken is that an account may be deleted and **its pocket
commitments are deleted explicitly with it, inside the same transaction, after
the impact report.** The code does not implement it yet, and that is the whole of
problems 4 and 5.

The sequence: discover the pocket commitments, put them in the impact report,
take the owner's confirmation, delete the commitments, dispose of the account.

A foreign key refusing the delete is technically safe and terrible product. The
owner should read *this account currently backs three pockets for $2,350*, named
one by one, and confirm — not a raw constraint violation.

**And this removes the stranded-money problem rather than solving it.** There is
no such thing as a commitment from a deleted account, so no screen has to
represent one. The pocket simply shows less committed and more remaining.

### 19.6 The goal's typed currency is shown, and it is not history

Six columns record what the target was typed as and the rate that produced it,
and nothing reads them. That loses information the schema deliberately keeps.

The detail should read `€5,000` with the converted figure beside it, not the
converted figure alone.

**On edit the pair is replaced, not versioned.** The target is recalculated and
the audit pair overwritten. This is not a history of target changes — that was
decided out in section 15.2 — so there is nothing to version.

### 19.7 A pocket may not be born overdue

`desiredDate` is compared against the owner's today on create and on edit, and a
day already past is refused. A target with a deadline of yesterday is not a plan.

**Reaching the deadline later is entirely valid** — a pocket whose day passes
with the target unmet is overdue, and that is a state the board reports.

**It is a calendar day, not an instant.** The comparison is against today on the
owner's calendar and nothing about it needs a timestamp.

### 19.8 The branch is merged once, not cherry-picked

The module lives on a worktree branch descended from `feat/pocket`; the working
branch has none of it. **Do not copy commits across.** Merge the working branch
with `feat/pocket` and `feat/budget`, resolve the conflicts once, and re-check
the migration number afterwards — the budget merge is what produced two files
numbered `018`.

### 19.9 The order of work

**Phase 1, the backend made safe.** Merge to one branch. Retire the three legacy
pocket paths. Settle the error contract for an unavailable rate. Fix the
eligibility of source accounts. Integrate with account deletion. Handle the
deletion of a source account. Add the explicit owner filters. Validate the
deadline.

**Phase 2, the migration.** Rehearse `020` against a copy of production again,
confirm what happens to the one real legacy pocket, verify the UP, verify the
DOWN, and only then run it for real.

**Phase 3, the frontend.** Creation with its one optional initial commitment in
the same request, the board, the detail, committing and releasing, editing, the
account detail's three figures, and finally the retirement of the legacy screens.

**No frontend is written before phase 1 closes.**

> **MARKED 2026-08-30 — phase 3 has largely run while four of phase 1's eight
> items are still open, so this ordering rule is being carried by nothing and
> needs a fresh decision.**
>
> **What the passage asserts:** that the backend is made safe first — one branch,
> the three legacy pocket paths retired, the error contract for an unavailable
> rate settled, source eligibility fixed, account deletion integrated, the
> deletion of a source account handled, explicit owner filters added, the
> deadline validated — then the migration, then the frontend, and that no
> frontend is written until all of that closes.
>
> **What the code actually says:** phase 1 is four of eight. Done: one branch, the
> legacy creation path retired, source eligibility settled for `bank`. **Not
> done:** the `503` for an unavailable rate, the account-deletion integration, the
> handling of a soft-deleted source, the two missing owner filters, and the
> deadline validation. Phase 2's migration has run on the development database
> only. Phase 3 has shipped almost whole — creation, the board, the detail,
> committing and releasing, editing and deletion all exist; the account detail's
> three figures do not.
>
> **What now needs deciding:** whether the five open phase-1 items are still
> prerequisites of anything, now that the screens they were meant to precede are
> written, or whether they become their own backlog. Nothing here is struck: each
> of the five is a real gap and the reasoning that placed them first is intact.

### 19.10 The one real legacy pocket — OPEN, and the data argues against closing it

It was proposed to close this as *nothing to convert*, on the premise that the
owner had already deleted that pocket and the money had returned to the cash
account. **Measured against the local production copy on 2026-08-29, that premise
does not hold there:**

| what was checked | what the copy holds |
| --- | --- |
| The account | `108`, `cash_loc_chinita`, typed `pocket_saving` |
| Is it deleted? | **No.** `deleted_at` is null |
| Its balance | **90.00**, still in it |
| Its target | **420.00** — it has one, so the migration's targetless guard does not fire |
| Its deadline | **1 January 2027**, in the future |
| Its movements | An opening at zero, a real transfer of **90 from `CASH #109`** on 14 May, and two test rows of 0.00. **No reversal** |

A target of 420, a deadline in 2027 and 90 already set aside is **exactly a
persistent intention**, which is what the argument for writing no commitment
denied existed.

**What the migration does to it as written:** step 2 copies it into `pockets`
with its target and deadline, step 3 returns the 90 to the cash account, step 4
deletes the movements and step 5 deletes the account. The pocket survives with
**allocated at zero** — the goal is kept and the commitment is lost.

**So the decision is live, not closed, and it is one question:** does the
migration write one `pocket_allocations` row of 90 from account `109` for that
pocket, or does it leave it at zero?

**Recommendation: write the row.** The owner stated a goal, named a figure and
moved money towards it; the new model represents that as a commitment, and
declining to write it discards a stated intention that is still current. The
argument against — that a converted row is indistinguishable from one the owner
adds later — is true and is not a cost here, because the row would say something
true either way.

**What cannot be checked from this session:** whether the live database still
matches this copy. If the pocket was deleted in production after the copy was
taken, there is nothing to convert and the question closes itself. **That is the
fact to establish before the migration runs.**

---

## 20. Which pocket to put money into next — OPEN, set 2026-08-30

### 20.1 What is being decided

Two different questions have been conflated, and they need different answers.

The first is **what the board's own tile announces as the next target**. That one
is answered today, in `PocketBigBoxResult.tsx:47-56`: drop the funded and the
overdue, then take the fewest days remaining, ties going to whoever arrived
first — which inherits the server's order, desired date then name.

> **Anchor corrected 2026-08-30: the selection is at `PocketBigBoxResult.tsx:77-86`.**
> The component was rewritten the same day and `:47-56` is now inside
> `countByLevel`, which counts rows by date level and does not choose one. The
> description of the selection is unchanged and still exact: `:79` filters on
> `!funded && !overdue`, and `:80-86` reduces on `daysRemaining` with a strict
> `<`, so a tie keeps whoever arrived first.

The second is **which pocket most needs money**, which is the question the owner
actually asks and which nothing on screen answers. The first rule is a poor
stand-in for it: a pocket five days out that is short five dollars outranks one
twenty days out that is short two thousand, and the second is the one to act on.

### 20.2 What each pocket carries

Everything below is served in the same board response. Nothing here costs a
second request, and nothing here is derived on the client.

| field | what it states | the trap in it |
|---|---|---|
| `target` | the goal | required and positive; there is no pocket without one |
| `allocated` | what is committed | never *saved*: no money moved |
| `remaining` | target less allocated | **negative** past the goal, and that is a fact, not an error |
| `progress` | 0-100 | **above 100** when over-funded; not clamped |
| `desiredDate` | a calendar day on the OWNER's calendar | `new Date()` on it renders the previous day west of UTC |
| `daysRemaining` | days to the deadline | **negative** once it has passed |
| `requiredMonthly` | the monthly rate that still makes the goal | **`null`** when the deadline passed, **`0`** when already funded — two different absences |
| `funded` / `overdue` | the date state | mutually exclusive by construction |
| `uncovered` | the funding accounts no longer hold what was committed | folded by the server; no component may derive it |
| `sourceCount` | how many accounts fund it | |
| `currency` | the pocket's own currency | see 20.5 |

**What does not exist, and bounds any rule written here:** there is no monthly
series of contributions, so there is no achieved rate, no velocity and no trend;
there is no priority column and no essential-versus-discretionary flag; and at
board level there is no figure for what the owner has free to commit — that
lives per account, on the eligible-account list.

### 20.3 The rule

**The monthly rate that still makes the goal already is the priority score.** It
is the shortfall divided by the months left, so it carries urgency and size in
one number, folded by the server. Ranking by it descending answers *which pocket
demands the most money per month from here on*, and that is what pressure means.

Two states cannot be ranked by it, so they sit outside the ranking rather than
inside it:

1. **Uncovered first.** The figure on screen is not backed. That is integrity,
   not pace, and nothing else matters until it is settled.
2. **Overdue next.** The required rate is null: there is no schedule left to
   meet. These need a DECISION — move the date, lower the target, accept the
   slip — not a payment.
3. **The rest**, by required monthly rate, descending.
4. **Funded last**, where they fall on their own, because their rate is zero.

Ties inside the third group: fewer days remaining first, then name.

### 20.4 The two rankings that were rejected

**By the raw shortfall** — ignores time. A large goal a year out outranks a small
one due next week.

**By days remaining alone** — ignores size. This is exactly the defect of the
next-target tile described in 20.1, so adopting it would spread that defect
rather than fix it.

The required monthly rate is the quotient of the two, and it is already on the
wire.

### 20.5 The open part: a board holding more than one currency

The required monthly rate is stated in each pocket's own currency, so ranking
across currencies compares unlike numbers.

**Option A, convert to the accounting currency and rank globally.** One order for
the whole board. Costs a rate at render time — and that rate is not the rate any
row was written at, so the order would shift with the market while none of the
underlying commitments changed.

**Option B, rank within each currency and present the groups separately.** No
conversion, no rate, nothing that moves on its own. The list stops being a single
global priority and the owner reads a group at a time.

**Recommendation: B for V1**, and the reason is NOT the one that first suggests
itself. The board's refusal to add mixed currencies is about *addition*, and
ordering adds nothing, so that rule does not reach this question. The reason is
that a converted ranking is only as good as a rate taken at the moment of
render: two loads a day apart would order the same unchanged pockets differently,
and an order that moves while nothing moved is worse than an order that admits
its own boundary.

**And this decision is smaller than it looks.** A board that mixes currencies
already returns its totals as nulls with a notice, so the ranking would be
offered on a board that has declined to state its own figures. Settle it, but do
not let it gate the rule in 20.3, which is complete and correct inside a single
currency — which is every board measured so far.

### 20.6 What this does not decide

Whether the ranking is *rendered* at all — as the order of the board list, as a
sort option beside the others, or only as the tile's choice of next target — is a
separate call and belongs with the toolbar, which does not exist yet.

### 20.7 The next-target tile — the algorithm, in words

Section 20.6 left open whether the ranking is rendered anywhere. This closes one
half of that: **the tile takes it.** Whether the board LIST is also ordered by it
stays open and belongs with the toolbar.

**What the tile answers:** which pocket the money should go into the next time
there is money to commit. Not which one falls due first.

**Step one, set aside what does not compete.** Three states are out, each for its
own reason, and none of them is a degree of the others.

A pocket that reached its target is out: there is nothing next to do with it.

A pocket whose date has passed is out because it does not need a contribution,
it needs a decision — move the date, lower the target, or accept the slip.
Offering it as the next destination for money proposes that the owner meet a
schedule that no longer exists.

A pocket whose funding accounts stopped covering what it says is committed is out
for a different reason again: its own figure is not backed, so what it already
claims has to be settled before it is given more.

**Step two, among the ones that compete, the winner is the one under most
pressure.** Pressure is how much money per month is needed, from now on, to reach
the target on time. That figure is already folded per pocket by the server, and
it is the only served number that carries both halves of the question at once —
how much is missing and how long is left. A pocket two thousand short with twenty
days left is under more pressure than one five short with five days left, even
though the second falls due first.

**Step three, ties break by date, then by name.** If two pockets are under the
same pressure, the one that falls due sooner wins; if they fall due the same day,
the earlier name wins. The tie-break has to be total and stable: without it two
consecutive loads of the same unchanged board could propose different pockets.

**If nothing competes, there is no next target and the tile reads empty.** A
pocket set aside in step one is never promoted: a tile that offers an overdue or
an uncovered pocket lies about what the owner should do with their money.

#### What the algorithm must not do

**It must not re-derive a served flag.** Funded and overdue come from the server
and are read, never recomputed. The server builds overdue as days remaining below
zero AND committed below target; a client that recomputed it from the shortfall
alone would disagree with the tally in the same header.

**It must not sum amounts.** The header figures are folded by the server so that
no component adds money up, and this rule ranks rows — it does not total them.

**It must not fold the two classification axes into one filter.** Date and
coverage are separate. Both contribute a discard in step one, and neither is
expressed in terms of the other.

#### What is in code today, precisely

`PocketBigBoxResult.tsx:47-56` drops funded and overdue, then reduces on days
remaining with a strict comparison, so a tie keeps whoever arrived first — which
inherits the server's order, desired date then name.

> **Anchor corrected 2026-08-30: `PocketBigBoxResult.tsx:77-86`.** The two
> differences this section names were re-read there and both hold — the tile
> still chooses by nearest date rather than by pressure (`:82`), and it still
> does not drop uncovered pockets (`:79` filters on `funded` and `overdue`
> only). The tile is now labelled **Next target** (`:284`, `:295`), which is the
> substitution §21 ruled the same day; it renders as a `Link` to the chosen
> pocket when one qualifies and as an empty card reading *Nothing pending a
> date* when none does (`:280-310`), which is what *"the tile reads empty"*
> asks for.

Two differences from the definition above, and only two:

1. It chooses by **nearest date**, not by pressure. This is the substantive gap.
2. It does **not** drop uncovered pockets, so it can promote one whose figure is
   not backed.

It does drop funded and overdue, which is already correct. A reading that says
otherwise is wrong about the filter.

#### Out of scope here

A board holding more than one currency. Ranking across currencies compares
figures stated in different units, and that decision is registered on its own in
20.5. Inside a single currency — which is every board measured so far — the
algorithm above is complete.

---

## 21. Target, not goal — RULED 2026-08-30

**The ruling, in the developer's terms:** *goal* names a saving goal; *target*
names the target of an allocation. **A pocket has a target.** The module says
*target* and does not say *goal*.

This amends the frozen vocabulary of `PLAN_POCKET_FE.md` §0.1, which allowed
*goal* to name the figure a pocket aims at so long as it never named the object.
Allowing both produced exactly the drift the vocabulary exists to prevent: the
board header said *Target* while the card said *Over goal* about the same
number, in the same module, two screens apart.

**What changes in the wording fixed elsewhere in this document:** the excess line
reads **committed above target**, not *committed above goal*, and the card's
reading for a pocket past its target reads **Above target**. Section 20 and the
plan's own §7.1 are to be read with that substitution.

**What does not change:** the served field is already named `target`, so nothing
in the contract moves. This is copy, and it was applied the same day it was
ruled.

**Left standing, and deliberately:** prose in the plan documents that predates
this ruling. The rule binds what renders, not the history of how it was decided.

---

## 22. Committed past the target is its own reading — RULED 2026-08-30

The date partition splits into five, not four: **funded** for a pocket that
landed on its target, and **above target** for one that passed it.

**Why they cannot share a reading.** They differ in what the owner can do. The
excess of a pocket past its target is the only committed money that can be
released without setting a plan back — releasing from a pocket still short of
its target sets that one back by exactly what is taken. A pocket that landed
exactly on its target holds no such money. One reading for both hides the only
place on the board where money can be moved at no cost.

**How the split is computed, and why it is legitimate.** The server sets the
funded flag at committed greater than OR equal to target, so both halves carry
it. The split is made on the shortfall, which the same payload serves and which
is negative by exactly the excess. This reads a served figure; it does not
recompute a served flag. The count of exact landings is the served funded count
minus the counted over-target rows, never a second count of the rows.

**The colour: information, not warning.** Amber in this module already means the
clock is running out. Giving it to a pocket past its target would make one
colour say two unrelated things — which is the defect just removed from the
board card, where amber stood for both *at risk* and *anything not yet funded*.
The reading takes the information colour instead: notable, not wrong. This adds
one square class to the shared component sheet, written on the token rather than
on the `--square` names the two older classes consume, which are declared
nowhere and paint by their hex fallback.

**What is NOT built, and was considered.** A rebalance operation — one action
that releases from a pocket past its target and commits to one that is short —
does not exist and is not scheduled. Releasing returns the commitment to the
funding account; committing to another pocket draws from an account. The owner
can already do it in two steps. What was missing was the screen saying so.

**And a question this leaves open for whoever builds that:** whether the module
should ever SUGGEST the move. Suggesting it means telling the owner to take
money from one target they set and give it to another, which is an opinion about
their priorities — the same opinion the next-target algorithm is careful not to
hold, because nothing in the model declares that one target matters more than
another.

---

## 23. The board reads a month, and a level reads the plan's own line — RULED 2026-09-03

Five rulings, taken as one section because they depend on each other. The month
bound is what makes a level computable at a date other than today; the
step-wise line is what stops that reading changing by the day; the retroactive
target is what stops any of it needing a history this model does not keep.

### 23.1 A level is set by the pace the plan still demands, not by nearness to its deadline

**Superseded in part by section 24 (2026-09-04).** The criterion and the
reasoning stand; the six-level table below is replaced by the seven-level one
there, which splits the band this table calls `onTrack` into being ahead of the
line, on it, and short of it.

**What was wrong.** The shipped classifier splits everything neither at target
nor overdue by how near the deadline is, at a threshold of thirty days
(`frontend/src/fintrack/helpers/pocketStatus.ts:24`, `:90-114`). Nearness to a
deadline states nothing about progress toward a target, and the two cases that
matter both read backwards: a pocket at 5% with 200 days left reads **on plan**,
and one at 98% with 20 days left reads **at risk**.

**The criterion that replaces it is a ratio of two paces.** What the pocket now
needs per month, over what its plan set per month.

- The numerator is served already: the remainder over the horizon
  (`requiredMonthly`, `makePocketStatus.js:127`).
- The denominator is the plan's **instalment**: the target over the number of
  full calendar months between the plan's creation month and its deadline.

**Why a ratio and not a day count.** A fixed horizon of thirty days treats a
three-month plan and a five-year plan identically. The question the owner is
actually asking is not *how long is left* but *can I still cover it*, and the
ratio answers it in the module's own terms — how many of the planned
contributions would have to be found at once.

**Worked**, on a target of 12,000 over twelve months, instalment 1,000:

| situation | needed per month | ratio | level |
| on the line at the close of month 8 | 1,000 | 1.0 | on track |
| short by 2,000 with four months left | 1,500 | 1.5 | behind |
| short by 2,000 with one month left | 3,000 | 3.0 | at risk |

The same shortfall, two readings. What separates them is whether an ordinary
month still closes it.

**The six levels, evaluated top down**, which makes them mutually exclusive by
construction:

| level | condition |
| `completed` | committed reaches the target |
| `aboveTarget` | committed passes the target |
| `overdue` | not complete, and the deadline passed on the owner's calendar |
| `atRisk` | not complete, deadline ahead, ratio at or above 2 |
| `behind` | not complete, deadline ahead, ratio above 1 and under 2 |
| `onTrack` | not complete, deadline ahead, ratio at or below 1 |

**Six, and the original request asked for six.** An earlier reading in this
process collapsed them to five, on the ground that *at risk* and *overdue* named
one condition. They did — but only in a draft that defined *at risk* as the
deadline having passed. Under the ratio there is no overlap, and both words
carry a distinct fact: **behind** is a plan that has fallen back, **at risk** is
one that an ordinary month can no longer recover.

**The thirty-day threshold is deleted** (`POCKET_AT_RISK_DAYS`). The ratio climbs
on its own as the deadline nears, so proximity is captured without a constant.
Days remaining stays a printed fact and classifies nothing.

**Both ends of the ratio are already guarded.** The needed monthly figure is 0
once the target is covered and null once the deadline has passed, and both cases
are decided by a level above the ratio, so it is only ever consulted inside the
live band.

**The owner's calendar** is the date read from the current instant in the zone
stored on the user row (`users.timezone`, `002_accounts.sql:37-39`), resolved
once per request (`getUserTimeZone.js:20-27`) and turned into a date in SQL
(`pocketRepository.js:31-38`). Never the browser clock, never UTC.

**A plan with no full calendar month in its window publishes no instalment**, so
it has no ratio and can read neither behind nor at risk. It falls to on track and
the card states that the plan has no window rather than printing a pace. Two
cases: a pocket created days before its own deadline, and the one legacy pocket,
whose creation stamp is migration 020's own date.

**What is NOT built, and was considered.** The achieved rate and the projected
date. Both stay decided out — a rate read over the ledger measures how often the
owner changed their mind, not how fast money arrived — and the reason written
into `pocketBoardService.js:18-21` stands unamended. This ruling reads no
sequence of rows: it reads the plan's two endpoints and one total.

### 23.2 The line is step-wise by month, never continuous

**The target is divided into monthly instalments and the amount due rises only
when a month closes.**

- **The creation month does not count.** A plan made on the 20th did not have
  that month to fund it, so its first instalment falls due at the close of the
  first full month after it.
- **The current month's instalment is not yet due.** At any point inside
  September, what is owed is the instalments through August.

**Why not a continuous line.** The expectation would climb every day, so the same
pocket would read on track on the 2nd and behind on the 28th with no change in
behaviour. Step-wise, the reading moves only when a month closes — which is the
boundary every other figure on this page now uses.

### 23.3 Committed beyond the plan's line is an axis, not a level

**Superseded by section 24 (2026-09-04).** Slack does cross `completed` and
`aboveTarget`, as this subsection says, but inside the live band it partitions
rather than crosses it: sitting at or above the line is algebraically the same
set as the ratio sitting at or below 1. It is a level. Everything below about
naming it by the fact, and about it being distinct from the surplus of section
22, is unchanged.

**The figure:** committed minus what the already-due instalments required, when
positive. It is what a pocket holds beyond its own schedule.

**It cannot be a level, and the reason is structural: it does not exclude the
others.** A pocket can be on track and ahead of its plan, or above target and
ahead of its plan. Levels are mutually exclusive; this crosses them. It follows
the pattern coverage already uses on this board — an orthogonal reading with a
row in the summary card and an option in the filter, and no new word in the
vocabulary map.

**What it is for.** It names where money can be moved from, toward a pocket
reading behind or at risk. A colour delivers neither of the two facts the owner
needs — *which* pockets hold it and *how much* each holds — so it appears as a
row in the readings card, an option in the filter, a line on the card, and a
sort criterion.

**Named by the fact, never by the permission.** It is *ahead of plan*, not
*movable*, *releasable* or *slack*. Releasing it drops the pocket to exactly its
line with nothing spare, so a word naming the permission would read as *spare*
and tell the owner something false. This is the ruling already made when the
remainder of an account was called **unassigned cash** and *available balance*
was refused.

**Distinct from the surplus of section 22.** What a pocket holds past its target
can be released at no cost to any plan. What it holds ahead of its line cannot —
that money is still needed by that plan, only not yet. Two amounts, two
consequences, two sentences.

**What is NOT built, and was considered.** A rebalance action in one step.
Releasing returns the commitment to the funding account and committing draws from
an account; the owner can already do it in two. Which target yields is an opinion
about their priorities — the same opinion section 22 refused to hold.

### 23.4 The board takes a month, and every figure reads at its close

**What changes.** `GET /api/fintrack/pocket/board` accepts an optional month.
Absent means the current one. This overrides the board contract of section 5 and
the statement in `PLAN_POCKET_FE.md` §7.1 that the board never grows a query
parameter — both written when every figure on the page was a lifetime sum.

**The current month never travels.** The server resolves it on the owner's
calendar, the rule the overview handlers already state
(`overviewController.js:7-10`). A later month is refused with 422.

**One evaluation date replaces today** across the page: today when the current
month is selected, the last day of the month otherwise. Every date comparison
reads at that close — the passed deadline, the days remaining, the needed monthly
figure and the ratio of section 23.1.

**What the ledger can and cannot answer.** It carries an owner-chosen date on
every row (`020_create_pocket_tables.sql:154`), anchored at noon in the owner's
zone when back-dated, so the committed total at a close and the amount moved
within a month are exact facts. Nothing here reads a series or a rate.

**The movement prints as the net**, with its direction in words. The server sends
both gross halves so the composition is available when a screen needs it, and
nothing prints them for now. Never a bare signed number: it cannot say which of
two opposite decisions happened.

### 23.5 An edited target is in force from the day the plan was made

**The ruling, in the developer's terms:** editing a target is a correction of the
plan, and the corrected figure is treated as having applied since the pocket was
created. **There is no historical target distinct from the current one.**

**What this settles.** V1 stores the current plan and nothing else (`QP-14`,
2026-08-29), so a board read at a past close necessarily divides by today's
target. Under this ruling that is not an approximation to be disclosed — it is
the correct reading.

**What it removes.** Three things were drafted as answers to a question this
ruling dissolves, and none is built: a note under the month badge, a per-row
marker built from the last-modified stamp (`pockets.updated_at`), and a
plan-revision table.

**What it must state, because it will be observed.** *A past month's figures
change when a target is edited.* The same month reports one progress before the
correction and another after it. That is this ruling working, and it is recorded
here so it is not later read as a defect and repaired.

**Why it is consistent with 23.1 and 23.2 rather than merely compatible.** The
instalment is computed from the plan's creation date and the current target, so
this ruling is that computation stated. The levels, the progress and the pace
cannot disagree about which plan they are reading.

**What is NOT built, and was considered.** A revision table storing each target
and deadline change with the date it took effect. It is the only thing that
recovers a genuine prior value, it reverses `QP-14`, and **it cannot be
backfilled** — every month before such a migration would stay unanswerable
regardless. It returns only if target corrections turn out to be frequent enough
that treating them as retroactive misreads what the owner meant.

### 23.6 What this section does not decide

- **Two tokens.** The scale has no sixth status colour for **behind** — the
  attention amber sits too close to the warning amber at the size of a status
  square — and no glyph size for the icon beside the progress bar, where the
  smallest declared is 2rem. Deferred deliberately: the concepts are agreed
  first, and the literals carry a comment until the tokens are named.
- **Whether the filter chips carry counts.** Still open from the visual
  proposal, and now with six levels rather than five.
- **Whether the ordering of the board is ever driven by the ratio.** The figure
  ranks pockets by how far their plan has slipped, which is a candidate for the
  next-target choice section 20 left open. Not taken here.

---

## 24. On the line, ahead of it and short of it are three readings, not two — RULED 2026-09-04

This re-decides section 23.3 with a date, and replaces the level table of
section 23.1. It does not touch 23.2 (the line is step-wise), 23.4 (the board
takes a month) or 23.5 (an edited target is retroactive), and it leaves the
achieved rate decided out exactly as it was.

**The full derivation, the seven criteria and one worked example of every
level live in `POCKET_LEVELS_REFERENCE.md`.** This section rules; that file
explains, and is written to be read without this one open.

### 24.1 The objection, and the measurement that proves it

**The objection.** A pocket running ahead of its plan is not *on track*, and one
running short of it is not *on track* either. The word claims the plan is being
met as written; it was being printed over three different situations.

**It is not a matter of taste — the two bands are algebraically the same set.**
Write the instalment as `I`, the instalments already due as `d`, the committed
amount as `A`, the target as `T` over `M` months, so `I = T / M`:

- what the schedule required is `S = d × I`, and `aheadOfPlan = A − S`
- the pace ratio is `remainder / instalmentsLeft / I = (T − A) / ((M − d) × I)`

Substituting `T = M × I` and reducing, `ratio ≤ 1` is true exactly when
`A ≥ d × I`, which is `aheadOfPlan ≥ 0`.

**So *on track* has never meant "on the plan's line". It has meant "on the line
or above it",** and the orthogonal *ahead of plan* filter of 23.3 was selecting a
strict subset of it rather than crossing it. The two controls asked one question
twice, which is the defect this module already corrected once when *at target*
and *on plan* were renamed for naming the mechanism instead of the state.

**What 23.3 got right and keeps.** Slack does cross *completed* and *above
target*: a pocket past its goal also sits above its own schedule. What it got
wrong is the claim that slack crosses the live band. Inside the live band it
partitions it.

### 24.2 The seven levels, evaluated top down

Top-down evaluation is what makes them mutually exclusive by construction, and
it is what keeps a finished pocket out of *ahead* even though its slack is
positive.

| level | condition |
| --- | --- |
| `completed` | committed reaches the target |
| `aboveTarget` | committed passes the target |
| `overdue` | not complete, and the deadline passed on the owner's calendar |
| `atRisk` | not complete, deadline ahead, ratio at or above 2 |
| `behind` | not complete, deadline ahead, ratio above the band's upper edge |
| `ahead` | not complete, deadline ahead, ratio below the band's lower edge, **and** the money figure `aheadOfPlan` above zero |
| `onTrack` | not complete, deadline ahead, ratio inside the band |

**A plan publishing no instalment still falls to `onTrack`**, unchanged from
23.1. A window holding no full calendar month has no line, so the pocket is
neither ahead of one nor short of one, and the card states that the plan has no
window rather than printing a pace.

### 24.3 On track is a band around the line, never the point where the ratio is 1

**Why a band is required.** Split at exactly 1 and *on track* means
`aheadOfPlan` is exactly zero. The instalment is a division that rarely
terminates — 12,000 over eleven months is 1,090.909… — so equality is reached by
almost no pocket after its first month. A level that is defined but never fires
is the same defect as the retired *Active* bucket, which appeared on a filter
and nowhere else on the screen it filtered.

**The band is symmetric and expressed on the ratio, not in money.** *On track* is
the ratio within a tolerance either side of 1; *ahead* and *behind* are what lie
beyond it. Proposed value: **five hundredths**, one named constant beside the
two the classifier already carries.

**Why on the ratio and not on a fixed sum.** A ratio tolerance is worth more
money early in a plan and less money late in it, which is the property the ratio
was chosen for in the first place when a thirty-day threshold was rejected.
Being half an instalment short with eleven months left is noise; being half an
instalment short with one month left is not. A fixed sum would call both by the
same word.

**Why symmetric.** *On track* has to mean the plan is being met as written, and
a pocket two hundredths over its line is meeting it exactly as much as one two
hundredths under. The asymmetry belongs in the colour, not in the boundary.

### 24.4 The one edge the money guard exists for

At the close of a month that is also the deadline's own month, with the deadline
falling on the last day of it, every instalment has fallen due and the count of
instalments left is floored at one. The ratio is then the remainder over one
instalment, which can read below 1 while `aheadOfPlan` is negative — the pocket
is short of its whole target, not ahead of anything.

**This is why `ahead` requires the money figure to be positive as well as the
ratio to be low.** Without it the card would print *"180.00 behind the plan"*
under a level word saying *Ahead*. It costs one condition and closes the only
case where the two figures disagree about direction.

### 24.5 What this costs, and what changes shape

| where | change |
| --- | --- |
| `pocketLevel.js` | one band constant, one new branch, `ahead` added to the exported level order |
| `makePocketLevel` inputs | gains `aheadOfPlan`, already computed by `planSchedule.js` |
| `levelCounts` | seven keys, every one always present with at least a zero |
| `aheadCount` | **retired.** It counted pockets with positive slack, which is now a level count minus a rounding — two answers to one question |
| `totalAheadOfPlan` | **narrowed to the same population as the level:** the slack held by pockets reading `ahead`, so the readings row pairs a count and an amount describing the same rows |
| the filter | *Ahead of plan* stops being a separate toggle and becomes a value of the status select, beside the other six |
| the sort criterion | unchanged — it ranks by the money figure, which every live pocket still carries |

**The status filter stays single-choice.** With slack no longer crossing the
live band there is nothing left for a second axis to express. Coverage
(*funding not covered*) is unaffected and remains the one genuinely orthogonal
option in that list.

### 24.6 The colour scale, agreed 2026-09-04 — values measured 2026-09-04

The deferral of 23.6 is lifted. Seven levels are named and the square
answers only five of them, so the two levels that ask the owner to act —
**behind** and **ahead** — were the two left with no colour.

**The surface the marks are measured against is pure black.** The board
cards paint `--color-surface-deep` (`pocket-styles.css:110`, `:132`), not the
raised surface. A first reading of this section quoted a band mixing the two
surfaces, copied from the comment on `--color-status-complete`, which cited
its own figure against raised beside two figures against deep. That comment
is corrected in `tokens.css` and the band below is the measured one.

**Why a band is imposed at all.** Contrast IS loudness: a mark with a much
higher ratio than its siblings dominates the screen whatever it means. The
palette records the exact failure — the warning token was the CSS keyword
`orange` at 10.63:1 while healthy read 5.62 and alert read 6.23, so the
warning was the loudest thing on the board and shouted over the alert. It was
muted to 6.73 to sit between its siblings. The band is therefore a rule about
outliers, NOT a severity ordering: the informational blue already measures
8.76 and is the loudest mark in the set, which is a separate question this
section does not open.

**The seven marks, measured against the board card:**

| level | token | value | against the card |
| --- | --- | --- | --- |
| on track | `--color-status-ok` | `#5b8c93` | 5.62 |
| **behind** | `--color-status-behind` | `#9c75d1` | **5.88** |
| overdue | `--color-status-alert` | `#c97474` | 6.23 |
| at risk | `--color-status-warning` | `#b8894e` | 6.73 |
| completed | `--color-status-complete` | `#5faa78` | 7.51 |
| **ahead** | `--color-status-ahead` | `#3db87a` | **8.34** |
| above target | `--color-status-info` | `#60b1d6` | 8.76 |

**Two new tokens, named by the state and not by the colour**, which is the
convention `--color-status-complete` already follows.

**Ahead is a saturated green, not a pale one.** A pale green was measured
first at 11.53:1 — the level that asks LEAST of the owner would have been the
strongest mark on the board, which is the orange defect repeated. Saturation
rather than lightness is also what separates it from the desaturated teal of
on track, so it reads as a different hue and not as a lighter version of the
same one.

**Behind is violet at half saturation.** Every warm hue is taken by a level
above it in severity, and a second amber was already tried and rejected for
sitting seven hundredths of lightness from the warning amber. It lands
quieter than both levels that outrank it in severity, which is the one place
the ordering does hold.

**Orange is refused, and the reason is on record.** It is the value the
warning token was moved away from, and it is the same hue family as the level
directly beneath the one it would mark.

**Completed is separated by shape, not by hue.** The palette already states
that a met goal carries a tick rather than a square. The tick exists
(`pocket-styles.css:1006`) and the hero strip uses it; what still paints a
square is the per-pocket card and the detail border. A class map cannot close
that — a shape is not a class name, so the component drawing the mark has to
choose tick or square from the level.

### 24.7 Two defects the measurement exposed

Neither is created by this ruling; both were found while measuring it, and
both are recorded here rather than fixed silently.

- **On track contradicts itself across the two screens.** Its square class is
  empty so the board paints the base teal, while its reading modifier is
  `--neutral` and the detail paints grey. One level, two colours, which is
  exactly what `pocketStatus.ts`'s own header says cannot happen. Giving on
  track an explicit grey square also frees the green family entirely for
  ahead and removes the only pair that collides under deuteranopia. The grey
  in use measures 3.09:1 against the card, at the floor for a graphic object,
  so it cannot be adopted at that value.
- **The whole series fails on the cream panel.** Against
  `--color-surface-panel` every mark measures under the 3:1 floor — ahead
  1.98, behind 2.81, and the five that already shipped between 1.89 and 2.94.
  The pocket detail summary is that surface. It needs an `-on-panel` set of
  its own, the way the amount tokens already have one, and that is separate
  work.

### 24.8 What this section does not decide

- **The band's value.** Five hundredths is the recommendation and the reasoning
  is above; the number itself is open until a real board is read at it.
- **Whether *ahead* ranks above or below *on track* in the level order.** It is
  written between `onTrack` and `behind` in the table above for reading order
  only; the summary strip's own ordering is a screen decision.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

**Not one decision was touched.** Sections 1 to 14 are marked history by this
file's own banner and were left exactly as they are; sections 15, 16, 18, 20.3 to
20.6, 21 and 22 are product rules and carry no measurement to age. What was
corrected is the small set of statements about the state of the code, all of them
in 15.5, 16.2, 19 and 20.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the legacy edit path as "the path `EditAccount` uses today", on another branch | §15.5 | the branch survives at `accountEditController.js:90-101` with no conversion, but no client reaches it and a pocket is edited at its own route |
| the account-detail sketch served but unrendered | §16.2 | still unrendered; the enrichment is now on this branch at `getAccountController.js:857-885` |
| the eleven-problem classification | §19.1 | four resolved, seven standing — measured row by row in the block under the table |
| "no frontend is written before phase 1 closes" | §19.9 | **marked, not struck.** Phase 3 has largely run while five phase-1 items are open, so the rule needs a fresh decision |
| the anchor of the next-target selection, twice | §20.1, §20.7 | `PocketBigBoxResult.tsx:77-86`; both differences the section names still hold |

**Left standing because they are still true:** the ruling of §21 is applied in
the interface — the card reads *Above target* and *Over target*, the header
*Next target* and *committed above target*, and the empty state *plan towards a
target*; §22's five-level split is implemented in
`frontend/src/fintrack/helpers/pocketStatus.ts:26-31` and `:71-95`, with the
over-target reading taking `--color-status-info` through a `.status__square.info`
rule written on the token (`pages/styles/generalStyles.css:335-337`) beside the
two older classes that still consume `--square` names declared nowhere; and
§19.10's question about the one legacy pocket account is untouched, because this
reading did not connect to production or to its local copy.

**One observation, recorded rather than acted on:** the ruling of §21 binds copy
and the copy obeys it, but two identifiers in the board header still spell the
retired noun — `findNextGoal` and the `nextGoal` binding it returns
(`PocketBigBoxResult.tsx:77`, `:133`). Whether the vocabulary rule reaches
identifiers as well as copy is `PLAN_POCKET_FE.md` §0.1's to say; no code was
changed here.
