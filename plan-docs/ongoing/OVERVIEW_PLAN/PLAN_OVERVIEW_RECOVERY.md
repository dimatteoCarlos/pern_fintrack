# Overview — Recovery plan

**Written 2026-09-06. This is the plan of record for the Overview module.**

It supersedes the sequencing in `PLAN_OVERVIEW.md` and consolidates three
proposals into one. It does not supersede `PLAN_OVERVIEW_CONTRACT.md`, which
remains the frozen payload contract; where this plan changes the contract, the
change is named explicitly in Part 3.

The document is ordered so that the first half needs no discussion. Part 1 is
settled. Part 2 is the three questions still open. Part 3 is the work. **Part 4
is what is deliberately left out**, and is the most useful page here — a plan
that names only what it includes silently readmits everything it forgot.

---

## Why this plan exists

The Overview module is written, correct in most of its arithmetic, and
**invisible**. The screen a person actually sees renders three figures — net
worth, income, expenses — from five calls to the by-type account balance
endpoint, and never calls the Overview payload at all. Every figure in that
payload is computed and unrendered.

So the work is not "build Overview". It is: make the time base correct, repoint
the one domain reading a deliberately emptied table, publish the figures already
computed and discarded, and only then wire a screen to it. Wiring first would
ship three silently changed balances and one regression.

---

# PART 1 — WHAT IS ALREADY DEFINED

Nothing in this part is open. It is recorded so that no later turn reopens it.

## 1.1 The architecture — decided by the developer

| decision | statement |
|---|---|
| **purpose** | Overview is the financial *reading* layer, not the analytical destination |
| **levels** | L1 recognises the situation · L2 explains the domain · L3 explains the entity |
| **charts** | L2 only. **Overview L1 carries no chart at all** |
| **hero** | three figures, all Position: Liquid Net Worth · Available Balance · Free Cash |
| **net flow** | leaves the hero. It is movement, not position |
| **cards** | 3–5 values maximum, entry points and not mini-reports |
| **snapshot** | a top-level section, not a domain. Renamed **Financial Snapshot** — it is not always a month |
| **recent activity** | top-level, **its own independent period**, all movements of that period, own endpoint |
| **financial goals** | **dropped as a section.** Pocket is the only goal model that exists |
| **authority** | the backend computes. The frontend never calculates a balance, a rate, a variance or a conversion |
| **reuse** | one definition, one authoritative implementation, many consumers |

### The five temporal natures

Every indicator carries exactly one, and the nature decides which level it may
appear on.

| mark | nature | meaning | may appear on L1 |
|---|---|---|---|
| **P** | Position | state at an instant | yes |
| **F** | Flow | movement during a period | yes |
| **T** | Trend | a series across periods | **no — L2** |
| **A** | Accumulation | running total since an origin | **no — L2** |
| **M** | Average / baseline | normal behaviour for reference | snapshot only |

### The three clocks

The single largest correction to the earlier plan. These are three separate
things and were one:

```
1. REFERENCE DATE   — "what is my position?"     → month close, or today for the current month
2. ANALYSIS PERIOD  — "what happened?"           → period start → reference date
3. ACTIVITY PERIOD  — "what do I want to read?"  → chosen independently by the user
```

A flow never fabricates the days remaining in an unfinished month. The current
month is month-to-date, and it says so on screen.

## 1.2 Closed by measurement

These were the six items the developer would not freeze without checking the
model. Five are closed. Each row is a measurement, not a proposal.

| # | question | answer | evidence |
|---|---|---|---|
| 2 | what is a realised result | one movement type (`pnl`, id 9), a **signed sum of amounts**, never derived from prices | `005_base_catalogs.sql:69`, `overviewMonthlyRepository.js:104-118` |
| 3 | can uncategorised spend be identified | yes. The condition is total expense **greater than** categorised expense; the **amount is a subtraction of two fields already published** | `makeExpenseCard.js:75-77`, `:96-97` |
| 4 | `allocated`, `netAllocated` or `netCommitted` | **`allocated`** — it is already a signed sum at nine sites, and the two gross halves are already named apart | `pocketRepository.js:97-113` |
| 5 | pocket plan progress formula | **exists.** `target ÷ planDays × clamped elapsed days`, continuous in days, withheld as null when the window has no duration | `planSchedule.js:75-101` |
| 6 | 3M / 12M — active or calendar months | **active months**, rolling, not year-to-date. 3 for reactive domains, 12 for stable ones | `makeMonthlySnapshot.js` |
| 1 | liquid net worth | **inputs measured, formula open** — see Part 2 | `005_base_catalogs.sql:37-45` |

### Measured facts the work depends on

Recorded so the implementer does not measure them again.

**The stored-versus-derived split.** Six files rebuild an account balance from
its ledger through the shared builder (`derivedAccountBalanceSql`). **The
Overview module is the sole exception, in all four of its balance reads** —
`overviewPageRepository.js:31` and `:52`, `overviewInvestmentRepository.js:42`,
`overviewBalanceRepository.js:47`. The stored column is not an independent
value: it is rewritten from the derivation after every money write
(`setAccountBalanceFromLedger.js:56-61`), which is what makes re-anchoring low
risk.

**Which figures obey the selected month.**

| figure | obeys the month |
|---|---|
| income, expense, realised result, every transaction count | yes, fully |
| debt position, pocket balance | yes — rebuilt at month close |
| **bank balance** | **no — the query never joins `transactions`** |
| **every investment figure** | **no — the card carries no period and says so in a notice** |
| saving goals | no |

**The month parameter already exists.** It arrives as an optional `month`,
truncates to the first of the month, and is rejected with 422 when later than the
current month in the owner's timezone (`overviewController.js:98-113`). There is
a ceiling and **no floor**: `month=1970-01` is accepted and served.

**No balance-history table exists**, and none is needed. Month-close balances are
rebuilt by walking backwards from a summed balance and subtracting every movement
dated after the month's end (`overviewBalanceRepository.js:41-56`). That query
carries **no account-type filter of its own** — it takes a bare array of account
ids — and today has exactly one call site (`stockDomainCalculator.js:64`),
reached only by debtor and pocket accounts.

**The pocket generational break.** Migration `020` created the plan model and
**deleted every legacy pocket row from the accounts table**
(`020_create_pocket_tables.sql:373-400`). The Overview pocket path still reads
the emptied table (`overviewPageRepository.js:56`). Five figures therefore report
zero today: the Pocket card, the pocket term inside net worth, the ALL card's
pocket total, the pocket row of the snapshot, and the whole Financial Goals
section.

**Three things are cheaper than any proposal assumed.** The Pareto is already
computed — rank, running total and cumulative share at four decimals
(`makeCategoryBreakdown.js:69-81`). The investment account count is computed in
SQL, used to branch, and dropped before the card freezes. Debt and profit-and-loss
both fetch six months of series and read two points from it.

**Free cash is nearly free.** The per-account remainder is already published
(`accountUnassignedCash`, `makeAccountAllocation.js:45`) with an over-allocation
flag when it goes negative. The committed amount is already net of releases,
because a release is stored as a negative row and the sum is signed. The real
trap is that a per-account remainder **can** be negative, so the floor must be
applied per account before summing — otherwise one account's surplus hides
another's shortfall.

**Seven account types exist** (`005_base_catalogs.sql:37-45`): bank, investment,
debtor, pocket_saving, category_budget, income_source, **cash**. Two of them —
category_budget and income_source — are internal envelopes and not money, so
"sum every account" is never available as a shortcut. Cash accounts exist and sit
outside every balance figure Overview publishes today.

## 1.3 Settled by recommendation — overridable, but decided

| item | ruling |
|---|---|
| **month floor** | 60 months, borrowed from the budget module's own span limit. **This is a new decision, not a restoration** — Overview has never had a floor. It is a **history boundary of the interface**, not part of the financial temporality: it says how far back a month may be selected, never what a month means |
| **expense variance** | stays `budget − categorised`. Budget is assigned per category; uncategorised spend has no line to charge. The **uncategorised amount** becomes a fourth field so the card reconciles by showing the gap rather than absorbing it |
| **debt directions** | extracted into a shared SQL builder beside the derived-balance builder, so the legacy screen and Overview share one definition. Not copied into the Overview repository |
| **pocket naming** | `allocated` keeps its name and is the canonical term: the signed net of allocations after releases, which the contract prose states. **`netAllocated` is not used anywhere in this plan.** A rename touches nine SQL sites and three services outside the pocket module and buys clarity the structure already has |
| **total net worth** | **stays computed** even though the hero publishes the liquid figure. `netWorth − liquidNetWorth == receivable` is the only check that catches an inverted payable sign |

---

## 1.4 Realised result — one economic class, two scopes

| | Overview profit-and-loss domain | Investment card |
|---|---|---|
| movement type | `pnl`, id 9 | `pnl`, id 9 — identical |
| account scope | **every account** except the internal counterparty | **investment accounts only** |
| time bound | month, lower inclusive / upper exclusive | **none — whole history** |
| where | `overviewMonthlyRepository.js:104-118` | `overviewInvestmentRepository.js:59-65` |

The initial worry was that publishing both under one word reproduces the failure
the one-definition rule exists to prevent. Measurement dissolved it: these are not
two definitions of an indicator, they are one economic quantity read at two scopes
and two temporal natures.

**Measured, the aggregate is not a raw register of account variations.** It is
the signed sum of one movement type over every account the owner holds except
the internal counterparty, and three things are excluded by construction:

- **transfers**, which are a different movement type built by a different
  configuration function (`movementInputHandler.js:57` against `:84`) and are
  already claimed by the expense total, which nets them in as the reversal leg
  (`overviewMonthlyRepository.js:51-53`);
- **account-deletion corrections**, removed by description prefix — and the
  prefix is prepended to *both* legs the deletion writes
  (`recordAnnulmentTransaction.js:40-43`), so the filter catches the pair and
  not half of it;
- **the contra-entry leg**, which always lands on the internal counterparty
  account that the account scope excludes by name
  (`overviewAccountRepository.js:76-82`).

What remains is the gains and losses the owner recorded, net, on the accounts
they hold — on any account type, since the movement takes its account type
freely from the request body, so bank interest and bank fees sit here beside
investment results. That is a profit-and-loss quantity, so the objection that
the name would be semantically false does not hold. What does hold is the
collision: two figures, same economics, different window and different scope.

**Ruling.** `Realised Result` is the economic result carried by profit-and-loss
movements. Its scope and its temporal nature are always stated beside it, never
assumed:

| consumer | name | nature | scope |
|---|---|---|---|
| profit-and-loss card | `Realised Result` | flow | applicable owner accounts, selected analysis period |
| investment card | `Realised Result since opening` | accumulation | investment accounts, since origin |

**The module is not the indicator.** The profit-and-loss movement type carries
more kinds of variation than the indicator reports — that is why the aggregate
excludes transfers, deletion corrections and the contra leg. Naming the figure
after the ledger movement would name the table's word rather than the subject,
so `PnL Movements` is rejected.

## 1.5 Liquid Net Worth — the formula

**Liquid Net Worth = bank + cash + investment − debt payable.** Money owed *to*
the owner is excluded: a receivable depends on someone else choosing to pay, and
a *liquid* figure measures what the owner controls. Investment enters — it is
realisable by the owner's own decision, which is the line that separates it from
a receivable.

Pocket commitments are **not** subtracted here. They belong to free cash, which
answers a different question. The three hero figures form a hierarchy and each
must keep its own question:

| figure | question | formula |
|---|---|---|
| **Liquid Net Worth** | what do I own, net of what I owe? | bank + cash + investment − payable |
| **Available Balance** | how much cash do I have? | bank + cash |
| **Free Cash** | how much of that cash is not already promised? | `Σ max(accountBalance − accountAllocated, 0)` |

The floor in free cash is **per account, before the sum**. An account whose
commitments exceed its balance contributes zero, never a negative that another
account's surplus silently absorbs.

---

# PART 2 — WHAT IS STILL OPEN

Two remain, and only one of them is a decision. The naming of the realised
result and the formula of Liquid Net Worth are closed and have moved to §1.4
and §1.5.

### 1. The change figures — an amount or a rate

The backend publishes an **amount** delta against the prior period
(`makeDomainCard.js:54-68`). Every mockup prints a **percentage**. The frontend
cannot compute the percentage, because the prior period's total is not in the
payload.

**"Leave the backend alone" is not one of the options.** Every way of printing
a percentage adds a field: either the rate itself, or the prior period's total
for the frontend to divide by. So the real fork is which of the two the payload
carries.

| option | what it costs | what it risks |
|---|---|---|
| **rate beside the amount** | one field per card, computed where the delta already is | none the code does not already handle |
| **prior total, frontend divides** | one field per card, plus division in every card component | money arithmetic in floating point, and each card re-deciding what an undefined rate renders as |
| **mockups print amounts** | no field | a change of +180 means nothing until the reader knows whether the base was 200 or 20,000 |

**Recommendation: publish the rate beside the amount, computed in the backend,
nullable with its own notice.** The code already has both halves of it. The
delta is already `number|null` and already carries the reason it is absent,
through `canCompare` (`makeDomainCard.js:64-67`); and the savings rate already
establishes exactly this shape for a rate — `null` rather than `0` when the
denominator cannot serve, with a notice constant naming which reason it was
(`makeHeroSection.js:66`, `:104-105`). Adding the rate is one more line beside a
figure that already exists, in the one place that already holds the prior
period's total.

**The rule the rate needs, stated once here rather than five times on the
screen:** the rate is null unless the prior period is strictly positive. A
percentage measured from zero has no value, and one measured from a negative
base inverts its own sign — a realised result moving from −100 to −50 prints as
+50% and reads as a gain. This is the same guard the savings rate applies to
income (`income.greaterThan(0)`), for the same reason.

The amount stays, always. It is defined in every case the rate is not, so the
card always has something true to print and the rate is the enrichment, never
the fallback.

### 2. The investment reconciliation — gated on one production count

The card asserts that contributed capital plus realised profit and loss equals
the ledger balance (`makeInvestmentCard.js:96-99`). It does not hold. The gap is
**one account-deletion row that no term claims**, worth 0.75 in the only sample
measured — three investment accounts of a single user on the development
database. The mechanism is the finding and the amount is incidental: correcting
the 0.75 would fix nothing.

The cause is enumeration, not arithmetic. Contributions claim movement types 6
and 8 (`overviewInvestmentRepository.js:57`); the realised figure claims type 9
minus the deletion prefix (`:70-71`); an account-deletion row is type 9 **and**
prefixed, so no term claims it while the derived balance sums it (`:49`).

Removing the filter would make the identity hold and the figure lie: it would
report an act of bookkeeping as investment performance. The exclusion is
deliberate and applied consistently — one writer
(`recordAnnulmentTransaction.js:40`) against four readers, all of them in this
module (`overviewInvestmentRepository.js:71`,
`overviewMonthlyRepository.js:113`, `overviewTransactionRepository.js:135` and
`:147`).

**The premise the identity rests on is a convention, not a constraint.** A
census of every movement type on every investment account of every user, taken
on the development database, returns only three: transfer (3 rows, 43.07),
account-opening (3 rows, 100000.00) and profit-and-loss (3 rows, 1.55, one of
them an annulment). Nothing outside those. But that is nine rows on three
accounts of one user — enough to prove the identity can fail, and nothing more
— and no
constraint ties a movement type to an account type — so the identity holds by
habit, and an expense landing on an investment account would open the same gap
silently.

**Recommendation: do not amend the identity yet — measure first.** The right
question is what an account-deletion movement represents inside an investment
ledger, and the production count decides which answer is proportionate:

- **count is zero** — keep the two-term identity, write the three-movement-type
  premise into the contract so it stops being implicit, and leave it there. It
  is a correctness question with no live symptom.
- **count is above zero** — the identity gains a third term for the deletion
  adjustments, and the card publishes the **unclaimed amount** rather than only
  saying the books disagree. The shortfall measured on dev surfaced only because
  someone checked the identity by hand.

Either way the third term is the same sum with the filter inverted: one more
common table expression inside the statement that already runs, no new query.

**One question here has a single source, and it is not an agent session.**
Whether production holds any account-deletion row on an investment account
decides which fix is proportionate: with none, this is a correctness repair with
no live symptom and dropping the assertion becomes defensible; with some, it is
a live wrong warning and the third term is the answer. No session here queries
production — standing rule, unrelated to any migration window — so it is one
query for the developer: the count of rows on investment accounts whose
description carries the annulment prefix.

**This one is not this module's to write.** The two-term identity is stated in
the frozen contract, so amending it is the developer's call, and the rows
themselves belong to the deletion module whose scope now covers that writer end
to end. Only the reading of them is this module's.

**The deletion repair does not settle this, and the reason is that two
different populations of rows are involved.** Account deletion is currently
unable to complete: migration 018 turned the three account references on the
ledger from cascade to restrict, and no step anywhere in the backend detaches
those references first, so a delete of an account carrying any movement raises
a foreign-key violation and rolls back. Repairing that touches **the target
account's own rows** — the ones that block the delete.

The rows this identity fails to claim are the other population: the annulment
rows written onto the **surviving** accounts and onto the internal counterparty
(`recordAnnulmentTransaction.js:39-40`). They persist by design and no repair
removes them, so the third-term question stands whatever the deletion module
decides.

**No second population arrives — the deletion module has ruled and the schema
agrees.** The target's own rows are deleted outright rather than reassigned to
the internal counterparty: the owning account column on a movement is
`NOT NULL` (`003_transactions.sql:40`), so those rows cannot survive as
the deleted account's, and making the internal account their owner would give
it history that was never its own. Rows on the surviving counterparties keep
that column untouched; only the two reference columns naming the deleted
account are nulled, and both are nullable (`:49`, `:52`). So a surviving row
keeps its full contribution and merely loses a reference. **Overview enumerates
it exactly like any other row on that account** — nothing about it is
provisional, and nothing here is waiting on the deletion module any more.

Two measurements make that safe to rely on, and the second is a constraint
Overview imposes on the deletion work rather than a note to itself:

- **The detach is invisible here.** No query in the Overview module reads
  either reference column — zero occurrences across the whole module — so
  nulling them changes no figure.
- **The description scrub must not touch the opening literal.** All four
  readers that exclude annulment rows match `RTA Annulment Target(` and
  wildcard the rest (`overviewInvestmentRepository.js:71`,
  `overviewMonthlyRepository.js:113`, `overviewTransactionRepository.js:135`
  and `:147`). The deletion step that scrubs the deleted account's name from
  descriptions strips it from **inside** those parentheses, which is harmless;
  rewriting the prefix itself would break all four filters at once and turn
  every annulment row into ordinary spend and ordinary activity, silently.

### Consequence nobody has recorded

The savings rate was built as the rate form of net monthly flow, riding along
with it in the hero (`makeHeroSection.js:65-66`, `:124`). **Net flow now leaves
the hero for the Financial Snapshot.** The savings rate must follow it, or it
becomes a rate whose denominator is no longer beside it.

---

# PART 3 — THE WORK

Ordered by dependency, not by value. Each step names what it unblocks.

### P0 — Freeze the semantic contract · DONE, no code

**The temporal frame is written: `PLAN_OVERVIEW_CONTRACT.md` §14.** The three
clocks, the five natures, the domain-versus-Overview boundary, and a reading
convention the section added because two documents needed it — wherever a
formula names the bank term it includes cash accounts (D45), so the three-term
net worth and the `bank + cash` of the liquid figure name the same account set
rather than two. The period window type of §3 now says which of the three clocks
it is, so the rule is reachable from the place it governs.

**One thing the section had to correct rather than restate.** The hero-composition
decision (D27) fixes a four-term net worth that includes the pocket total, and
the net-worth ruling (D54) removes exactly that term. The composition rule stands
— the hero is built from the domain cards and inherits their corrections — and
the term list does not. Writing the boundary without saying so would have left
two live decisions contradicting each other in the same document.

**The indicator matrix is written: `OVERVIEW_INDICATOR_MATRIX.md`.** Every
indicator with its formula, temporal nature, owner, level, chart and endpoint,
plus a column the stage added on purpose — whether the figure is on screen,
computed and unrendered, or specified only. It is its own document rather than a
section of the contract because the contract states types and the matrix states
meaning.

**What it exposed, which is the point of writing it:** four of the five temporal
natures carry indicators and one carries none. No figure in the module is a
trend — the twelve-month series exists only as an input to the averages and is
published as no figure of its own. Level 2 is where a trend would land and
nothing has been specified for it.

Not blocked. Both decisions in Part 2 now carry a ruling, and the one question
still with the developer — the production count — has its answer written for
each outcome.

### P1a — Re-anchor the four balance reads · DONE, commit `2f8cec3d`

**Committed and in the working tree, not deployed.** `main` carries it, so the
balance reads on disk are the ledger derivation. It is **not** in what production
runs: `feat/vercel-serverless` is deploy-only and does not contain it, and it
arrives there when the backend is shipped by a deliberate merge from `main`.
Nothing on screen calls the Overview payload, so the gap costs nothing today.

Point the Overview module's four balance reads at the shared ledger derivation
the other six files already use. It was the only step in the plan requiring no
decision from anyone, which is why it did not wait behind P0.

**The precondition was measured before the substitution, not after.** Stored
column against ledger derivation, one row per account, all 31 accounts of every
type: zero disagreements, and per-type totals identical both ways. So the change
moved no money, and any divergence found later is real drift the derivation
caught rather than the change laundering one.

**A trap paid for here:** the shared builder defaults to `FLOAT`, and money
arithmetic must not pass through a float. Every Overview read feeds a decimal
library, so all of them ask for `NUMERIC`.

Excludes the saving-goals read (`overviewPageRepository.js:52`) — re-anchoring a
query against an emptied table changes nothing. It belongs to P2.

**Surfaced by this step and not caused by it:** the smoke test after the
substitution showed the investment card's reconciliation failing. It is
pre-existing — stored and derived agree on those accounts — and it is open
decision 4.

### P1b — Make bank and investment obey the reference month

**Not a change of arguments.** The reconstruction SQL is generic but neither
domain has a call site into it:

- **Bank** has no domain calculator at all. Its balance is a scalar in the page
  repository, never routed through the stock domain calculator.
- **Investment** computes contributed capital, ledger balance and realised result
  as three CTEs in one statement, **none date-bounded**
  (`overviewInvestmentRepository.js:59-68`). The card asserts that the first two
  sum to the third (`makeInvestmentCard.js:96-99`). **Bound only the balance and
  that identity fails on every historical month**, so the card publishes "this
  does not reconcile" every time a past month is opened. Those predicates go in
  together.

Also here: the bank balance stops filtering on the bank type alone, so **cash
accounts enter Available Balance**. One predicate.

**Remeasured 2026-09-06: it is five bindings, not three, and the two this stage
was missing are the ones a person can see.** Counted in the code rather than
taken from the paragraph above.

| # | what gets bound | where |
|---|---|---|
| 1 | the ledger balance of the account set | the accounts CTE, `overviewInvestmentRepository.js:50-52` |
| 2 | contributed capital | the contributions CTE, `:54-59` |
| 3 | the realised result | the realized CTE, `:67-73` |
| 4 | **the newest funding movement** | the last_funding CTE, `:60-66` — a bare `MAX` over every row |
| 5 | **the instant the age counts back from** | `:80`, which reads `now()` |

**The fourth and fifth are one figure, and leaving them is worse than leaving
all five.** Days since the last contribution is a Position read at the reference
date, like every other figure on the card. Bind the three money CTEs and leave
these two, and opening a closed month gives that month's balances sitting beside
an age measured from today — two clocks on one card, which is exactly the defect
the temporal frame of the contract (§14.1) exists to prevent. The identity would
reconcile and the card would still be wrong.

The fifth is a substitution and not a predicate: `now()` becomes the reference
date, so a closed month reports the age at that month's close and the running
month reports it as of today. That falls out of the reference date being one
value, and needs no branch.

**And the bank read has no date parameter at all**, so it is not a predicate
being narrowed but a signature being widened: `getBankBalance(pool, userId)`
(`overviewPageRepository.js:121`) takes no month, and its query takes only the
user (`:45-52`). It also excludes an account by literal name, `slack` (`:51`) —
left exactly as it is here, and noted only so the next reader does not take it
for an oversight of this stage.

**Acceptance criterion, explicit because the wording invites the opposite.**
This step talks about month close throughout, which can read as though every
month were a full month. It is not:

- **the current month runs `monthStart → referenceDate`** — month to date;
- **a closed month runs `monthStart → monthEnd`**.

**Unblocks:** the reference month meaning one thing across the whole page.

### P2 — Repoint Pocket to the plan model

Overview stops reading the emptied legacy table and reads the plan model.
Publishes four global figures — **target, allocated, remaining, progress** —
plus the three status counts: **funded, overdue, uncovered**.

**Seven figures is a board, not a card.** The four global figures are the
card's own; the counts render as one summary line beneath them
(`5 funded · 2 overdue · 1 uncovered`), so the information survives without
the card turning into a miniature Pocket board.

**Unblocks:** the Pocket card · the pocket term in net worth · the ALL card's
pocket total · the snapshot's pocket row · **and Free Cash, the third hero
figure**.

### P3 — Complete and correct the L1 indicators

| domain | action |
|---|---|
| **hero** | publish Liquid Net Worth, Available Balance, Free Cash per the formulas in §1.5. **Pocket leaves both Liquid Net Worth and Available Balance entirely.** Commitments apply only in Free Cash, through the per-account floor before aggregation — not as a sign flip inside a cash figure. Keep total net worth computed for the identity check |
| **income** | publish what already exists: received, change, movement count |
| **expense** | add the uncategorised amount as a fourth field; leave variance against categorised spend. **Uncategorised is a disclosure figure, not a budget category** — it exists so `spent = categorised + uncategorised` is visible, and it is never charged against a budget line |
| **investment** | restore the account count (**a dropped field, one line**) and add a reconciliation field (**a new contract field — today it is only a notice sentence**) |
| **debt** | emit both directions through the shared builder, normalising the payable leg to a **positive magnitude** |
| **pocket** | target, allocated, remaining, progress — plus the status counts as one summary line |
| **profit and loss** | realised result, change, movement count — named per §1.4 |

### P4 — The API contract

`GET /overview` and `GET /overview/:domain` already exist. This is a revision,
not a design — but a larger one than "review": the window builder is rewritten,
since it freezes exactly three fields all derived from one month
(`monthArithmetic.js:78-82`).

**Three concepts do not mean three parameters.** Expose all three temporal
concepts in the contract, but expose a *request parameter* only where the
consumer actually chooses the value. Overview keeps `month` as its single input
and derives the reference date and the analysis period from it; Recent Activity
takes its own `from` and `to` on its own endpoint, because that period is the
one the reader chooses. Publishing a reference date, an analysis start and an
activity range as five parameters would model the vocabulary rather than the
interaction.

Recent Activity becomes its own endpoint with its own period.

**P4 ends with contract tests, and they are the gate into P5.** The frontend
must not be the first consumer to discover that a figure changed from a number
to `{ amount, rate }`, or that the pocket figures changed from legacy to plan
semantics.

### P5 — Frontend

The month selector, then the cards. Last, deliberately: a screen wired before P1
would show three silently changed balances.

Independent one-line fix, shippable at any time: the live screen tests the income
total to decide whether the **expense** total is a number
(`OverviewLayout.tsx:189`), so a broken expense prints as real and a valid expense
blanks when income breaks.

#### What the three sketches already show that a ruling has since deleted

Read 2026-09-06. The sketches predate the rulings, so none of this is a mistake
anyone made — it is the cost of the sketches being older than the decisions, and
it is written down here so the cost is paid once.

**Two figures the net-worth ruling removes (D54), both in the level-1 outline
`bosquejo-overview-nivel-1.html`.**

| where | what it shows |
|---|---|
| `:401` and `:656` | the cash position defined in the sketch's own words as bank plus pocket, and rendered |
| `:667` | the note under the hero stating net worth as bank + investment + debt + pocket |

The second is the one to be careful with: the sketch already flags that line as a
defect, but it flags it as a **time-base** problem. It is a double count as well,
and fixing the time base alone would leave the wrong figure with a note saying it
had been fixed.

**Three period labels, and here the sketch is more right than it looks.** The
month selector's rationale (`:629`) rules that the control picks a whole month
and not a month to date, and argues that August read in November is a closed
month, so calling it month-to-date would be false eleven months of the year.
**That argument is correct and the temporal frame of the contract (§14.1) does
not contradict it.** The rule is not that every month is measured to today; it is
that the *running* month is. The sketch's error is narrower than it appears: it
conflates what the control selects with what the label says.

So the repair is not to make the selector pick a month to date. It is to make the
**label conditional on which month was picked** — a closed month reads
`agosto 2026`, the running month reads as month to date. The labels that need the
second form are `Flujo · agosto 2026` (`:663`, `:683`, `:690`, `:697`, `:748`,
`:759`, `:770`) and `Posición · cierre de agosto` (`:705`, `:712`), plus the bare
month chip in the monthly snapshot proposal (`propuesta-snapshot-mensual.html`
`:665`, `:689`, `:713`, and its loading, error and empty states at `:855-941`)
and the single label in the spend-distribution proposal
(`propuesta-pareto-gasto.html` `:712`, `:926`, `:945`, `:961`, `:1263`).

Neither proposal carries a wealth, cash or pocket term, so neither inherits the
double count. Their only exposure is the label.

**Two more, found in the same read and worth more than the labels.**

- The outline defines the pocket total as *dinero disponible en pockets*
  (`:465`, in its table of definitions; the card it describes is at `:710`).
  A pocket is a plan and not a container; the money is in the bank account and
  is spendable. The word *disponible* states the retired model in the one place
  a reader will believe it.
- **The sketches carry raw hex values**, e.g. `#3E6577` at `:705` and `:712`
  and `#8A6520` at `:748`. They are sketches and the rule does not bind them,
  but P5 translates these blocks into real stylesheets, where a colour must come
  from a token. Whoever does that asks for the missing tokens rather than
  carrying the literals across.
- **The hero is still the old triad** — net worth, cash position, net flow — and
  not the hierarchy this plan freezes: what is owned, how much of it is cash, and
  how much of that cash is unpromised. This is the largest gap between the
  sketches and the plan, and it is not a defect in the sketch so much as the
  reason the hero has to be redesigned rather than corrected.

### P6 — Level 2

Trends, breakdowns, the Pareto renderer, and the domain analyses returned to
their domains.

### Definition of done, per stage

Part 5 verifies the work as a whole. These are the exit conditions that stop a
stage from being declared finished early.

| stage | does not advance until |
|---|---|
| **P1** | a past bank balance and a past investment balance both reconstruct correctly · the investment reconciliation still holds on historical months · the current month is month-to-date and a closed month is the full month |
| **P2** | Overview's target, allocated, remaining and progress equal the Pocket board's, figure for figure |
| **P3** | every level-1 indicator has a formula, a temporal nature, an owner, a null semantics and a currency semantics |
| **P4** | the payload contract is frozen and the contract tests pass |
| **P5** | the live screen has no remaining dependency on the by-type balance endpoint for any Overview figure |

The last one is the point of the whole plan: today that screen reads five
separate calls to build three figures.

---

# PART 4 — WHAT IS LEFT OUT

Nothing here is cancelled. Each item is out of **this plan's** scope, with the
reason and the place it goes instead.

## 4.1 Left out because it already exists elsewhere

| item | where it already lives |
|---|---|
| pocket monthly progress, gap against plan, plan adherence, required-by-now | the pocket board — **built and published today**, not future work |
| required monthly contribution, the plan line, allocation history | the pocket detail screen |
| total allocated, total target, total remaining as a hero | the pocket board's own hero. Overview shows a summary, not a second board |

## 4.2 Left out because it belongs at another level

Accumulations, trends and detailed baselines: accumulated income · capital
contributed since opening · realised result since opening · the largest-position
weight · days since last contribution · debt aging · investment composition ·
expense category ranking · six-month charts · full transaction tables · the
3-month and 12-month averages as cards of their own.

All computable, several already computed. **All L2.** The rule that puts them
there: a card may not print a figure whose time base differs from the card's
without saying so, and "income this month $2,000 / income since January $17,000"
on one card is two scales pretending to be one.

## 4.3 Left out because the data does not exist

**Market value, return percentage, and unrealised gain.** Measured rather than
assumed: no price, quantity, holding, ticker or market-value column exists
anywhere in the backend, and the card header already forbids these figures
(`makeInvestmentCard.js:12-14`). These are **not deferred indicators — they are
uncomputable** until a valuation source exists. Listing them as backlog would
imply otherwise.

## 4.4 Left out because it is infrastructure this scope does not need

| not building | why |
|---|---|
| `account_balance_snapshots` or any balance-history table | the ledger derivation plus the month-end reconstruction already answer every question this plan asks |
| a generic indicator engine, metric registry runtime, or dashboard framework | the registry is **documentation and contract**, never runtime infrastructure |
| a new goals domain — service, repository, entity | Pocket is the only goal model. A second one would be the same data twice |
| a Transfer card | a transfer is a supporting fact, not a financial domain |
| rebuilding the month parameter | it exists, is validated, and rejects future months |
| recomputing the Pareto | rank, running total and cumulative share are already computed. Only the renderer is missing |

## 4.5 Left out and deferred, pending a real need

- **Pocket year-to-date allocation** — only if a genuinely cross-cutting question
  justifies it. "How much did I put toward my goals this year?" is a different
  question from "how is my pocket doing this month?", and only the second has a
  home today.
- **A global pocket time series** — L2 at the earliest.
- **Calendar-month averages** beside the active-month ones. If ever wanted, it is
  a **separate indicator with its own name**, never a redefinition of the
  existing one.

## 4.6 Left out, and not recorded anywhere before this plan

These are not in any earlier proposal's exclusion list. They are named here so
the omissions are decisions rather than oversights.

- **The eight zero-fallbacks on the live Overview screen.** They violate the rule
  that a missing figure is a dash and never a zero, and they are real. But that
  screen is the one this work replaces, so fixing them is effort invested in code
  slated for deletion. **The rule binds the replacement**, and that is where it
  will be enforced. The single exception is the expense guard, a genuine bug
  fixed in P5.
- **The cleanup migration that migration `020` deferred.** It deliberately left
  the retired pocket account-type row and the legacy table in place, deferring
  removal to "a cleanup migration, last". **No such migration exists** — the
  sequence ends at 030. Out of scope here, but it must not be forgotten: after
  P2 nothing reads that table, which is precisely when the cleanup becomes safe.
- **The text-prefix fragility in the realised result.** Both realised-result
  figures exclude account-closure compensations by matching a description prefix
  built at `recordAnnulmentTransaction.js:40`. A financial definition that
  depends on a description string breaks the day someone edits that string.
  Recorded as a known fragility; replacing it with a typed flag is its own work.
  Measured since: it is one writer against **four** readers — the investment
  figure, the monthly profit-and-loss figure, and twice in the transaction
  repository — so a change to that string reclassifies historical money in four
  places at once.
- **Debt aging.** Named in earlier proposals as an L2 chart. Its semantics have
  never been defined, and a chart must not be drawn before them.
- **A dead guard in the deletion service, behind wrong fallback constants.**
  Those constants (`deleteAccountService.js:94-98`) set the profit-and-loss
  movement type to 1 — that type is 9, and 1 is expense — and invert deposit and
  withdraw. Measured on the development database, the fallback is **not**
  reachable while the catalog is healthy: all three names are seeded, so the
  lookups return rows and the real ids win. The defect is the shape. The throw
  at `:133-141`, written to stop the operation when a catalog row is missing, is
  raised inside the `try` and caught by the same function's own `catch`, which
  returns the constants when the cache is null on a cold process — so the guard
  downgrades the operation to silently-wrong ids in exactly the case it exists
  for. It needs an unseeded catalog, a rename, or an unreachable database. The
  expense total takes movement types 1 and 6 with no description filter, so the
  prefix that protects the profit-and-loss figures would protect nothing there.
  Belongs to the deletion module, recorded here because this module is where it
  would surface.
- **Account deletion appears unable to complete since migration 018.** Read
  statically, not executed: that migration turned the three account foreign keys
  on the transactions table to `ON DELETE RESTRICT` and describes a deletion
  engine that detaches every reference first. No such detach exists — there is
  no `UPDATE transactions` and no `DELETE FROM transactions` anywhere in
  `backend/src` outside migration `020`. The plain delete at
  `deleteAccountService.js:331` should therefore raise a foreign key violation
  for any account holding a ledger row, which is every account the correction
  path runs for. Outside this scope, and worth executing once before it is
  trusted.

---

# PART 5 — VERIFICATION

| step | check |
|---|---|
| **P1a** | diff stored against derived per account **before** editing. Agreement means the change is inert and safe; disagreement is a separate bug |
| **P1b** | for a past month, the investment reconciliation identity still holds — contributed plus realised equals the balance. If it fails, the three CTEs were not bounded together |
| **P2** | the pocket total in Overview equals the board's own total for the same month |
| **P3 hero** | `netWorth − liquidNetWorth == receivable`, for every case where both are reported. **This is the single check that catches the inverted payable sign** — get it backwards and this fails immediately instead of producing a plausible wrong number |
| **P3 expense** | spent equals categorised plus uncategorised, on a month that has uncategorised spend |
| **P3 debt** | the legs emitted by the Overview card match the legacy endpoint's two directions **in magnitude**, the payable leg differing only in sign |
| **all** | unit-level probes importing the builders directly, no database, following the pattern used for the savings rate. Boot test `APP LOADED OK` |

---

# PART 6 — TRAPS ALREADY PAID FOR

Recorded because each one produces a plausible wrong number rather than an error.

- **The sign trap.** The legacy endpoint emits the payable leg **negative**; the
  frozen contract declares it a **positive magnitude**
  (`PLAN_OVERVIEW_CONTRACT.md:232`). Getting it backwards turns a subtraction
  into an addition and still looks reasonable.
- **The Decimal zero trap.** Testing positivity returns true for zero, because
  the check tests the *sign* and zero is signed positive. The correct guard is a
  strict greater-than. Documented in the pocket board and in the hero builder.
- **The reconciliation identity.** Month-bounding one investment CTE and not the
  other two silently converts a passing check into a permanent failure notice.
- **The floor before the sum.** Free cash floors the remainder **per account**
  before summing. Summing first lets one account's surplus conceal another's
  shortfall.
- **Rate granularity.** The shared rate helper rounds to two decimals on a 0-1
  scale — one percent of granularity. A rate is for display and must never be
  used to reconstruct an amount.
