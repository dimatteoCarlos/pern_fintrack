# Overview — the indicator reference

**Consolidated 2026-09-09 from `OVERVIEW_INDICATOR_MATRIX.md` and
`PLAN_OVERVIEW_KPI_CATALOG.md`, both of which are deleted.** They answered the
same question from two sides and had drifted apart: the catalogue held the
vocabulary every formula depends on and the eleven-field entry format, the matrix
held the figure-by-figure table with each figure's nature, owner and state. The
catalogue had already declared itself superseded as the indicator list, which
left the vocabulary reachable only through a file nobody was meant to read.

**What this file answers:** what each Overview figure means, what it is computed
from, which module owns that definition, at which level it appears, on which
endpoint, and whether a person can see it today.

**What it does not answer.** The wire shape is `PLAN_OVERVIEW_CONTRACT.md`; how a
block is drawn is `OVERVIEW_LAYOUT.md`; why a figure was decided the way it was
is `OVERVIEW_DECISIONS.md`; the sequence of work is `OVERVIEW_PLAN.md`.

**The rule this file exists to enforce:** one indicator, one definition, one path.
If two columns of the same row could be satisfied by two different queries, the
row is wrong.

**Every state below was re-measured against `main` on 2026-09-09.** Where a
figure moved since the two source documents were written, the row says so.

---

## 1. The vocabulary every formula depends on

This section was §0 of the catalogue. It is first because every table under it
reads a term defined here.

### The three catalogues, as they stand today

| catalogue | values |
|---|---|
| `account_types` | 1 bank · 2 investment · 3 debtor · 4 pocket_saving · 5 category_budget · 6 income_source · 7 cash · **8 boundary** (migration 031) |
| `movement_types` | 1 expense · 2 income · 3 investment (**dead, R211**) · 4 debt · 5 pocket · 6 transfer · 7 receive · 8 account-opening · 9 pnl · **10 account-closure** (032) · **11 balance-reversal** (037) |
| `transaction_types` | 1 withdraw · 2 deposit · 3 lend · 4 borrow · 5 account-opening · **6 account-closure** (032) · **7 balance-reversal** (037) |

**Three values are newer than both source documents** and neither carried them:
the boundary account type, and the two movement types the account-closing path
uses.

### Which accounts hold real money

**Summed as money:** `bank`, `investment`, `debtor`, and `cash` — which is read
as `bank` and never distinguished from it (D45, closed 2026-09-01). Every formula
below that names `bank` includes `cash`.

**Never summed as money:** `category_budget` and `income_source` are tracking
counterparties, and `boundary` is the compensation account the double-entry
writes land on.

**The compensation account is excluded BY TYPE and no longer by name, and that
is a correction to the catalogue.** It said the exclusion was
`account_name != 'slack'`. That comparison is gone since 2026-09-08
(`overviewAccountRepository.js:311-314`): it wrongly dropped an owner's own
investment account named `slack`. The `boundary` type is what keeps the
compensation account out, and it does so without reading a name a user can
choose.

### The rules a formula inherits without restating them

- **D7 — one accounting currency.** Every amount is already in it when it is
  written. No metric converts on read; every entry is
  `stored-in-accounting-currency`. The only surviving conversion is presentational
  and applies to an aggregate already summed.
- **R211 — `movement_type_id = 3` is dead.** Investment contributions and
  withdrawals are written as transfers (6). Every investment metric filters on
  `account_type_id = 2` on both legs, never on movement type 3.
- **R212 — movement type 9 (`pnl`) holds two populations**, separated only by the
  description prefix `RTA Annulment Target(`. Any metric summing profit and loss
  excludes that prefix; the closure term includes it.
- **The annulment prefix sits on rewritable text.** It is
  `RTA_ANNULMENT_TARGET_PREFIX`, and since 2026-09-08 it lives in
  `annulmentRowIdentity.js` rather than inside the writer. Nothing new is to be
  identified by description text — the balance reversal got
  `transactions.reversal_of_account_id`, a key the database enforces.
- **R66 — `transaction_actual_date` is the insertion instant**, not a date the
  user picks. Every period-based metric groups by entry date.
- **A closed account keeps its history.** `CLOSE` deletes the `user_accounts`
  row and keeps the `account_registry` row under the same id, so a read through
  `account_identity` still sees the account and a read `FROM user_accounts` does
  not. Which of the two a formula uses changes its answer, and the investment
  reconciliation depends on the difference.

---

## 2. The five temporal natures

Every figure is exactly one of these. A figure that cannot be classified is a
figure whose question has not been settled.

| nature | answers | example |
|---|---|---|
| **Position** | what is true at one instant | net worth at the close of the reference month |
| **Flow** | what moved across a period | the expense of the month |
| **Trend** | how a figure moved across a series of periods | twelve months of expense |
| **Accumulation** | what has built up since an origin | realised result since the account opened |
| **Average** | the baseline a period is read against | the mean of the active months of the last twelve |

**Trend now has rows, and that is the change since the matrix was written.** It
recorded that no field carried the trend nature and that nothing had been
specified for level 2. Both are out of date: `PLAN_OVERVIEW_LEVEL2.md` specifies
level 2, and the six-point card series and the thirteen-point analysis series are
served for the domains §9 lists.

## 3. The three states

A figure is in exactly one, and the column exists because the failure it prevents
already happened in these documents: a figure was written about as though it
existed, and it was neither on screen nor served.

- **on screen** — a person can see it in the running application today.
- **computed** — the payload carries it and nothing renders it.
- **specified** — it exists in a contract or a decision and in no code.

---

## 4. Hero

The figures that answer "where do I stand", read at the reference date.

| indicator | formula | nature | owner | level | endpoint | state |
|---|---|---|---|---|---|---|
| **Liquid net worth** | bank + cash + investment − payable | Position | Overview | L1 | `GET /overview` · hero | computed · null with a notice when the debt card reports no payable leg |
| **Net worth** | bank + investment + debt position | Position | Overview | L1 | same | on screen |
| **Cash position** | bank + cash | Position | Overview | L1 | same | computed |
| **Free cash** | `Σ max(accountBalance − accountAllocated, 0)` over bank and cash | Position | pocket, imported | L1 | same | computed · its own read, not composed from two totals |
| **Net monthly flow** | income of the period − expense of the period | Flow | Overview | L1 | same | computed |
| **Savings rate** | net monthly flow ÷ income of the period; null unless income > 0 | Flow, as a rate | Overview | L1 | same | computed |

**The floor in free cash is per account, before the sum.** An account committed
beyond its balance contributes zero, never a negative that another account's
surplus silently absorbs.

**So free cash can exceed the cash position, and that is not a defect.** With one
account overdrawn, the position takes that account's negative while the floor
gives free cash a zero for it. The pair answers two questions; neither figure
bounds the other.

**Net monthly flow and the savings rate travel together.** The rate is the flow
divided by one of the two operands the flow is built from, so a rate whose
denominator is not beside it is unreadable.

---

## 5. The shared domain card

Five domains carry the same figures: income, expense, debt, pocket and profit and
loss. Investment does not, and §6 of the contract says why.

| indicator | formula | nature | owner | level | endpoint | state |
|---|---|---|---|---|---|---|
| **total** | the domain aggregate over the window | Flow for income, expense and profit and loss · Position for debt and pocket | Overview | L1 | `GET /overview` and `GET /overview/:domain` | computed |
| **movement count** | rows behind the total | Flow | Overview | L1 | both | computed |
| **change, as an amount** | this period's total − the prior period's; null with a notice when no complete prior period exists | Flow, as a comparison | Overview | L1 | both | computed |
| **change, as a rate** | change ÷ the prior period's total; null unless that total is strictly positive | Flow, as a comparison | Overview | L1 | both | specified |

**Why the total is a Position for two of the five.** Debt and pocket do not sum a
period's movements; they state a balance at the close of the reference month. One
field name carries two natures, which is why nature is a column and not a
footnote.

**The movement count inherits the total's filter, whatever it is** (D21), and its
visible label says *movements* and never *expenses*: part of what it counts are
reversals.

**The change rate is nullable for a reason that is not missing data.** A
percentage measured from zero has no value, and one measured from a negative base
inverts its own sign: a realised result moving from −100 to −50 would print +50%
and read as a gain. The amount is defined in every case the rate is not, so the
card always has something true to print.

---

## 6. What each domain adds to the shared card

| indicator | formula | nature | owner | level | endpoint | state |
|---|---|---|---|---|---|---|
| **budget of the period** | the sum of the budgeted categories, resolved by carry-forward | Flow | budget, imported | L1 | expense card | computed |
| **categorised spend** | expense tied to a live category account | Flow | budget, imported | L1 | expense card | computed |
| **budget variance** | budget − **total** spend | Flow | Overview | L1 | expense card | computed · **changed 2026-09-08**, see below |
| **uncategorised spend** | total spend − categorised spend | Flow | Overview | L1 | expense card | **published as a flag, not an amount**, and the flag is a red alert |
| **payable** | the negative debtor balances as a positive magnitude, at the close | Position | Overview | L1 | debt card | computed |
| **receivable** | the positive debtor balances, at the close | Position | Overview | L1 | debt card | computed |
| **settled debtor count** | debtor accounts whose balance is zero at the close and which have a movement | Position | Overview | L1 | debt card | computed |
| **realised result from investments** | the share of the month's realised result that landed on investment accounts | Flow | Overview | L1 | profit-and-loss card | computed · a `FILTER` over the rows the total already summed, so it cannot exceed the total |
| **pocket target** | the sum of the plans' targets | Position | pocket, imported | L1 | pocket card | computed |
| **pocket allocated** | the signed net of allocations after releases | Position | pocket, imported | L1 | pocket card | computed |
| **pocket remaining** | target − allocated | Position | pocket, imported | L1 | pocket card | computed · clamped per pocket before summing, so an over-funded goal cannot cancel an underfunded one |
| **pocket progress** | allocated ÷ target | Position, as a rate | pocket, imported | L1 | pocket card | computed |
| **pocket status counts** | pockets funded, overdue and uncovered | Position | pocket, imported | L1 | pocket card | computed |

**The variance is measured against the WHOLE month's spending, and this reverses
what both source documents said.** They recorded that the budget is compared to
categorised spend, because the tie between a movement and a category account is
optional, and that comparing against the total would cross two universes. Carlos
ruled otherwise on 2026-09-08: *"el gasto total, es el total spent, corresponde a
todas las categorias de gastos"*. The budget is the ceiling for the month's
spending, and spending that has lost its category is still spending. The share
and the remaining word beside it moved to the same numerator, because read off
different figures the card could print "$5 left (140% spent)".

**Uncategorised spending is a red alert and takes precedence over the budget
reading** (Carlos, 2026-09-08: *"si hay algo uncategorized, por supuesto seria
aparte, y seria un alerta roja"*). It is not the quieter condition: while it
holds, the budget reading itself is incomplete.

**The gap between total and categorised has one measurable cause and it is not a
fault in every case.** `EXPENSE_ACCOUNT_IDS_QUERY` reads through
`account_identity` and keeps a category account whose `user_accounts` row is
gone; the budget module's `ACCOUNTS_QUERY` is `FROM user_accounts JOIN
category_budget_accounts`, both inner, so that account leaves the budget side and
its spending never enters the categorised figure. Closing a category is
supported and its past spending is real. A live account with no
`category_budget_accounts` row is the other way in, and that one is a fault.

**The amount stays refused at level 1 and is published at level 2.** The card
carries a boolean; the amount is one subtraction over two published fields. At
level 2 the analysis is not the amount, it is the pair — both parts side by side
summing back to the total, which is a decomposition and therefore a level-2
shape. One case is not recoverable by subtraction and is the only ground on which
the level-1 field could be reopened: the categorised figure is nullable, and with
it null the client has nothing to subtract from.

---

## 7. Investment

Five absolute figures, none of them addable to another card's total. A return
percentage and a market value are forbidden by D9 and are absent from the type
rather than present and null.

| indicator | formula | nature | owner | level | endpoint | state |
|---|---|---|---|---|---|---|
| **account count** | how many investment accounts exist | Position, as a count | Overview | L1 | investment card | computed · **not bounded by the month**: it counts the accounts that exist now while every money figure beside it obeys the reference month |
| **capital contributed** | contributions and account openings, movement types 6 and 8 | Accumulation | Overview | L1 | investment card | computed |
| **ledger balance** | the derived balance of the investment accounts | Position | Overview | L1 | investment card | computed |
| **realised result since opening** | movement type 9, less the annulment-prefixed rows | Accumulation | Overview | L1 | investment card | computed |
| **closure adjustment** | what the closing path moved on these accounts: movement type 10, movement type 11, or the annulment prefix | Accumulation | Overview | L1 | investment card | computed · 0 for most owners, and the row is hidden at 0 rather than printed |
| **concentration** | the largest account's balance ÷ the ledger balance | Position, as a rate | Overview | L1 | investment card | computed |
| **days since the last contribution** | days from the newest funding movement to the reference date | Position, as an age | Overview | L1 | investment card | computed |

**The identity the card asserts:** capital contributed + realised result +
closure adjustment = ledger balance. It used to be a two-term identity that
failed, and the cause was enumeration rather than arithmetic: an account-deletion
movement is of the profit-and-loss type **and** carries the annulment prefix, so
no term claimed it while the balance summed it. The third term claims it.

**The third term gained the balance reversal on 2026-09-08, and the reason is
arithmetic rather than naming.** Migration 037 seeds movement type 11 for a
writer that posts `-currentBalance` on an account being closed, and investment is
in the list of types that can only close at zero. The identity is stated over an
account set that outlives the account — the id list reads through
`account_identity` and keeps a closed account, while the balance side reads `FROM
user_accounts` and contributes nothing for it — so a closed account holds its
whole history in the explaining terms against a balance of zero, and the terms
have to sum to zero over it. The reversal is by construction the negation of
everything that account accumulated. Uncounted, the card would report that
account's entire history as unexplained.

**The three arms of the closure term cannot double-count one account.** The
deletion service forks on the deletion type and the annulment writer sits on the
other branch, so a reversed account carries type 11 legs and no prefix, and an
annulled account carries prefixed type 9 rows and no type 11.

**What the identity still cannot survive** is a movement type outside the ones
the terms name landing on an investment account — an expense, for instance.
Nothing in the database ties a movement type to an account type. The card fires
its unreconciled notice, so the owner is told the figures disagree and is given
no way to see why. **At level 2 the difference itself is published, with the
tolerance beside it** — that pair is the one condition on which level 2 may lift
the contract's prohibition, because the client cannot reconstruct the threshold
below which the server calls the difference zero.

---

## 8. Monthly snapshot

Defined for three domains only: income, expense and pocket.

| indicator | formula | nature | owner | level | endpoint | state |
|---|---|---|---|---|---|---|
| **the month's own figure** | the domain total for the reference month | Flow | Overview | L1 | `GET /overview` · snapshot | computed |
| **three-month average** | the mean of the active months of the last three | Average | Overview | L1 | same | computed |
| **twelve-month average** | the mean of the active months of the last twelve | Average | Overview | L1 | same | computed |
| **variance against the average** | the month's figure − the twelve-month average | Flow, as a comparison | Overview | L1 | same | computed |
| **year to date** | the calendar year of the reference month, inclusive | Accumulation | Overview | L1 | same | computed · summed off the same thirteen-month series, so it cannot disagree with the averages |

**"Active months" is the whole definition.** A month with no activity is excluded
from the denominator rather than counted as a zero, which is why the average is
null and not zero when no month in the window had any. The year to date follows
the opposite rule and does so deliberately: it is a total, it has no denominator
to protect, and an empty month contributes 0 to it honestly.

**A budget year to date does not exist yet.** It cannot be a `SUM` over the
allocations table: a month's budget is the last row at or before that month, so
the series has to be resolved month by month. Carlos decided on 2026-09-08 that
Overview should lead with the year-to-date reading, which makes this the one
missing figure of the snapshot block.

---

## 9. Series, distributions and the level-2 analyses

| indicator | formula | nature | owner | level | endpoint | state |
|---|---|---|---|---|---|---|
| **the six-point card series** | the tail of the same monthly rows the card totals | Trend | Overview | L1 | `GET /overview` · charts, and `GET /overview/:domain` | computed · income, expense and pocket only |
| **the thirteen-point analysis series** | the same rows over the wider bound | Trend | Overview | L2 | `GET /overview/:domain?analysis=` | computed |
| **the category ranking** | the categories by spend, with the running total and share | Distribution | budget, imported; ranked by Overview | L1 | `GET /overview` · charts | computed |
| **the plan's cumulative curve** | the running sum of each category's budget, over the SAME ranking | Distribution | Overview | L1 | same | computed 2026-09-08 · a row with no plan carries the running figure forward and `hasSkippedBudget` says so |
| **income by source** | the month's income by source account, ranked | Distribution | Overview | L2 | `analysis=full` | computed · a row with a null account id is real income attributed to no account |
| **income concentration** | the largest source's share | Position, as a rate | Overview | L2 | `analysis=full` | computed |
| **profit and loss by account type** | investment against everything else | Decomposition | Overview | L2 | `analysis=derived` | computed · both terms published, the client subtracts nothing |
| **investment balance per account** | the portfolio distributed across accounts | Distribution | Overview | L2 | `analysis=full` | computed · a zero-balance account is a real row |
| **contribution history** | when money went in and how much each time | series of events | Overview | L2 | `analysis=full` | computed · the newest page, with the count of what was left out |
| **debt by counterparty** | who owes and who is owed, largest by MAGNITUDE | Distribution | Overview | L2 | `analysis=full` | computed · a counterparty settled at zero stays in the list |
| **the two debt legs over time** | receivable and payable, month by month, never netted | Trend, two series | Overview | L2 | `analysis=full` | computed · a net position that has not moved can hide both legs doubling |
| **progress per pocket** | the board's own rows | Distribution | pocket, imported | L2 | `analysis=derived` | computed · carries `pocketId`, which is the level-3 identity |
| **committed against free** | the bank balance, the commitment and the free cash, with the floor's cost | Decomposition | Overview | L2 | `analysis=full` | computed |

**`derived` and `full` are the two depths, and absent is a third state.** Derived
is everything the level-1 request already fetched, reshaped, so it adds no
statement to the round trip. Full adds the statements that have to be run for the
first time. A request naming no analysis gets the level-1 response unchanged.

**An absent analysis section is absent, not null.** A missing key means the
statement never ran; a null would mean it ran and had no answer.

---

## 10. Financial goals, the consolidated card, and recent activity

| indicator | formula | nature | owner | level | endpoint | state |
|---|---|---|---|---|---|---|
| **goals balance** | what the goals hold | Position | pocket, imported | L1 | `GET /overview` · goals | computed · sums the allocation ledger over `pockets` and `pocket_allocations`, bounded by the reference month on both the allocation date and the pocket's creation |
| **goals target** | what the goals aim at; null when none is set | Position | pocket, imported | L1 | same | computed · null is a real answer, a pocket may exist with no target |
| **goals remaining** | target − balance | Position | pocket, imported | L1 | same | computed · null whenever the target is |
| **the consolidated figures** | the hero's and the cards' own values, restated | as each source | Overview | L2 | `GET /overview/all` | computed |
| **recent activity** | the five newest movements, excluding the boundary account | not an indicator | Overview | L1 | its own endpoint | on screen |

**The consolidated card recalculates nothing.** Every figure on it is the same
value the hero or a card already published, by the same path. A second formula
producing the same name is the defect this rule exists to prevent.

**Recent activity is not a metric and is NOT bounded by the reference month.**
The statement takes the user and the time zone and no month, caps itself at five
rows, and orders by date descending. It is the one block on the page that answers
what happened last rather than what happened in the month being studied, and
whether that should change is an open question for the developer.

---

## 11. The eleven declared fields of an entry

The format the catalogue established and the one thing in it nothing else
carries. A new indicator is specified by answering all eleven; an answer of
"not applicable" is an answer and is written.

1. **metric id** — `snake_case`, the name of the formula.
2. **domain** — hero, or one of the six.
3. **business meaning** — the question in words, not the field name.
4. **formula** — over named tables and columns.
5. **source facts** — the tables and the joins.
6. **currency behaviour** — `stored-in-accounting-currency` for every entry today.
7. **time basis** — a stock as of an instant, or a flow over a period, and which.
8. **aggregation rule** — including any clamp, and where it applies relative to
   the sum.
9. **null and zero behaviour** — stated separately. They are different answers.
10. **display priority** — and any condition on being shown at all.
11. **consumers** — which block reads it.

**The wire name is the contract's, not this one's.** The `snake_case` id here is
the formula's name; the `camelCase` field the client receives is
`PLAN_OVERVIEW_CONTRACT.md`'s.

---

## 12. Pocket as an allocation, not custody

**Kept under its own heading because `POCKET_MODULE_SPEC.md` cites it**, as
§3bis of the deleted catalogue. Those citations now name this section.

**The rule that decides every entry: an Overview pocket figure folds over
ACCOUNTS, never over pockets.** Overview answers *where is my money*; the pocket
board answers *are my goals covered*. Folding the same allocation rows by pocket
gives the second question, which already lives in `/fintrack/pocket`, and
duplicating it on the home screen is the discrepancy the one-figure-one-formula
rule forbids.

It is not a preference. The two folds return different figures as soon as one
account falls short: by pocket you get what the owner committed, by account you
get how much of it has real cash behind it.

**Free cash (`free_cash`)** — what can be spent without breaking a commitment.
`SUM(MAX(account_balance − allocated, 0))` over eligible accounts (`bank`,
`cash`), **clamped per account before summing**. The clamp is mandatory:
`SUM(balance) − SUM(allocated)` lets an account with spare cash cover an
over-allocated one, and the hero would publish free cash that cannot be spent
without breaking a commitment elsewhere. Null with no eligible account; a real 0
is a legitimate result.

**Over-allocated account count (`over_allocated_account_count`)** — how many
accounts no longer cover what they have committed. A count and not an amount,
deliberately: the shortfall is stated per account, and a total of shortfalls
reads as a debt nobody owes. Always an integer, never null.

**Committed cash (`committed_cash`)** — of the cash already shown, how much is
committed. A memo line, never added to net worth or to the cash position because
it is already inside them. Published only if free cash renders beside the cash
position: a subtraction whose subtrahend is not on the same screen is unreadable.

**What does not come here, and why.** No goal figure — not the total target, not
overall progress, not a count of completed or overdue. Those answer the board's
question, live in the module, and bringing them here is the boundary already
fixed for budget and then for pocket (D29). No pocket list and no nearest goal:
that is the board rendered twice. No trend series: a series of allocations draws
how often the owner changed their mind, not how their money grew.

**Where they are computed.** All three are folds of the ACCOUNTS read path, where
`allocated` and `unassignedCash` already live because the allocation form
validates against them. Overview calls no pocket endpoint: coupling the home
screen to another module's availability for three integers the accounts module
already produces is a cost with no counterpart.

---

## 13. Savings as behaviour, not an account type

**Kept under its own heading because `POCKET_MODULE_SPEC.md` cites it**, as
§3ter of the deleted catalogue. Those citations now name this section.

D41 held that `pocket_saving` *is* the savings account. No such account exists
any more. The old reading took net saving for the month from a difference of
pocket balances, which measures a decision to earmark rather than money kept.

**Saving is measured over a period as behaviour**: the net cash change of the
month and the savings rate over it, which is the pair §4 already publishes on the
hero. A pocket allocation is not saving — the money has not moved and nothing was
set aside; it is a claim on cash that is still in the bank.

---

## 14. What has no row, and why that is a statement

- **A return percentage and a market value for investment.** Forbidden by
  decision, not missing by oversight, and absent from the type rather than
  present and null.
- **A budget year to date.** Decided and unbuilt — §8 says what it needs.
- **A debtor inactivity rule.** Ruled out by decision.
- **Any forecast, projection or recommendation, at any level.** A trend is what
  happened; an extrapolation is a claim about what will happen, and this module
  has no model behind such a claim.
- **Any cross-domain analysis at level 2.** A level-2 view belongs to exactly one
  domain. "How does my spending relate to my income" is a hero question and the
  hero already answers it.
