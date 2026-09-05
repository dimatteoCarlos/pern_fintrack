# Overview — what the backend computes, and what it could compute

Measured against `main` on 2026-09-05. Two lists, both segregated by domain.

**List A** is what the backend calculates today — in any module, not only in the
overview service. Where a figure is served by a different endpoint than the
overview one, that is said, because *calculated* and *reaching this page* are two
different states and confusing them is what put three wrong marks in the earlier
KPI map.

**List B** is what the backend does **not** calculate but already holds the data
for. Each row names the data that makes it computable, so the row is a measurement
and not a wish.

---

## The nature marks, and why every row carries one

The four natures were settled earlier in this plan, and the developer's question
names all four in his own words — cumulative, time series, the selected month,
averages. The nature is not a label: it decides **where a figure may be shown**,
because a card that mixes natures without saying so is the defect this whole plan
keeps finding.

| mark | nature | what it answers | what bounds it |
|---|---|---|---|
| **P** | Position | what is true at one instant | nothing — a stock |
| **F** | Flow | what happened inside the selected month | the month |
| **T** | Trend | how it moved across months | a range of months |
| **A** | Accumulation | the running total since an origin | the origin, not the month |
| **M** | Average / baseline | what is normal, to judge the month against | a window of months |

**The rule that follows from the table, and it is already decided:** an
Accumulation is served by the backend and never summed in the browser, and it is
discovered at the domain page, never on a level-1 card. A card carrying a running
total beside a monthly total states two time bases in one block with no way for
the reader to tell them apart.

---

# LIST A — computed by the backend today

## A1. Income

| indicator | nature | where it is computed |
|---|---|---|
| total received in the month | **F** | overview page payload |
| count of movements behind that total | **F** | overview page payload |
| change against the previous month's close | **F** | overview page payload |
| six-month series of the monthly total | **T** | overview trend series |
| the month's total, restated for comparison | **F** | overview monthly snapshot |
| average of a month **with activity**, over three months | **M** | overview monthly snapshot |
| average of a month **with activity**, over twelve months | **M** | overview monthly snapshot |
| the month minus the twelve-month active average | **F vs M** | overview monthly snapshot |
| total balance of income source accounts | **P** | by-type balance endpoint |

**Note on the two averages, because the choice is deliberate and easy to undo by
accident.** They average only months in which something happened, not calendar
months. And the variance is measured against the twelve-month figure, never the
three-month one: a month compared against a baseline that already moves fast
cannot be judged unusual, since both moved together.

## A2. Expense

The best-served domain, and the only one whose plan already sits beside its actual.

| indicator | nature | where it is computed |
|---|---|---|
| total spent in the month | **F** | overview page payload |
| count of movements | **F** | overview page payload |
| change against the previous close | **F** | overview page payload |
| budgeted amount for the month | **F** | overview expense card |
| categorised spend | **F** | overview expense card |
| budget variance — budget minus categorised spend | **F** | overview expense card |
| whether uncategorised spend exists | flag | overview expense card |
| spend by category, ranked, each with its plan and its share | **F** | overview category breakdown |
| running spend down that ranking, and its share of the whole | **A** | overview category breakdown |
| six-month series of the monthly total | **T** | overview trend series |
| the month, its three- and twelve-month active averages, and the variance | **F / M** | overview monthly snapshot |
| **budget against actual, per category, month by month over a range** | **T** | budget module monthly series reader |
| this month's budget and **next month's**, per category | **F** | budget module month status |

**On the month-by-month budget series**, since it is the largest thing on this
list that the page does not use: the budget module's month-by-month reader for a
set of accounts takes an account id array and a first and last month, and returns
one entry per account — an account here **is** a category — carrying every month
in the range **with no gaps**, each month holding the budgeted amount and the
actual spend. The gapless guarantee is deliberate and documented: a gap would make
the caller re-derive the carry-forward, which is the calculation that reader
exists to centralise. The range is capped at **sixty months** and defaults to
**twelve**.

**On next month's budget**, which is subtler than it looks: comparing this month's
amount to the next one is what tells a card that this month is an exception. A
budget that simply repeats changes nothing anyone would recognise, and correctly
shows nothing.

## A3. Debt

**Corrected 2026-09-05.** An earlier version of this plan's KPI map marked the two
legs and the settled count *absent*. They are **computed** — in the by-type
balance endpoint, not in the overview one. The distinction that matters is
*calculated somewhere* versus *reaching this page*, and marking a calculated
figure absent is the same error twice over.

| indicator | nature | where it is computed |
|---|---|---|
| net position, signed | **P** at month close | overview page payload |
| count of movements | **F** | overview page payload |
| change against the previous close | **F** | overview page payload |
| **what is lent — the receivable leg** | **P** | by-type balance endpoint |
| **what is owed — the payable leg** | **P** | by-type balance endpoint |
| count of counterparties who owe | **P** | by-type balance endpoint |
| count of counterparties owed | **P** | by-type balance endpoint |
| **count of counterparties settled to zero** | **P** | by-type balance endpoint |
| the same five figures **per counterparty** | **P** | by-type balance endpoint, detail branch |

## A4. Investment

Wears its own shape deliberately: five absolute figures are not a total, a count
and a delta.

| indicator | nature | where it is computed |
|---|---|---|
| capital contributed | **A** since opening | overview investment card |
| ledger balance | **P** | overview investment card |
| realised result | **A** since opening | overview investment card |
| weight of the largest position | **P** | overview investment card |
| days since the last contribution | **P** | overview investment card |
| number of investment accounts | **P** | overview investment repository |
| whether contributed plus realised reconciles to the balance | flag | overview investment card |

**This card is the clearest illustration of the mixed-time-base problem on the
page.** Contributed capital and realised result are Accumulations since the
account opened; the ledger balance is a Position today. Three figures, two time
bases, no label — and the reconciliation check between them only holds because all
three ignore the month equally.

## A5. Profit and loss

| indicator | nature | where it is computed |
|---|---|---|
| total realised result | **F** | overview page payload |
| count of movements | **F** | overview page payload |
| change against the previous close | **F** | overview page payload |

## A6. Pocket — every figure served, none of it wired

All of the following is computed by the pocket module's board **in a single
payload**. Overview does not call it. What is missing is the call, not the
calculation.

Amounts:

| indicator | nature |
|---|---|
| total committed | **A** — standing commitment, not a monthly gross |
| total target | **P** |
| total remaining | **P** |
| total excess over target | **P** |
| overall progress against target | **P** |
| moved within the month | **F** |
| **committed within the month** | **F** |
| **released within the month** | **F** |
| what the plans required by now | **P vs plan** |
| the signed gap against the plan line | **P vs plan** |
| adherence to the schedule | **P vs plan** |
| required monthly amount across the goals | **P vs plan** |
| total ahead of plan | **P vs plan** |

Counts, and they are the part no other domain has:

| indicator | nature |
|---|---|
| number of pockets | **P** |
| funded | **P** |
| overdue | **P** |
| uncovered — whose source account no longer covers what is committed | **P** |
| how many have a plan window at all | **P** |
| under the plan line / over it | **P** |
| one count per level, across the seven levels | **P** |
| how many source accounts actually fund a pocket | **P** |
| the furthest goal date on the board | **P** |

**Pocket is the reference every other domain should copy for the month question**,
and it is the only one that already separates the two: the committed total is an
Accumulation, and committed-in-month and released-in-month are Flows, as separate
fields rather than one net figure. A net would hide a month of heavy commitment
followed by heavy release behind a small number.

**The three schedule figures are withheld as a set**, never defaulted to zero: a
board whose plans have no full calendar month has nothing to measure against a
schedule, and a zero there would claim the plans required nothing.

## A7. Bank and accounts

| indicator | nature | where it is computed |
|---|---|---|
| per account: committed amount | **A** | pocket module, account allocations |
| per account: unassigned cash, signed | **P** | pocket module, account allocations |
| per account: whether it is over-allocated | flag | pocket module, account allocations |
| total balance per account type | **P** | by-type balance endpoint |
| **the total bank balance** | **P** | **computed inside the overview header and discarded** |

## A8. The header, across domains

| indicator | nature | state |
|---|---|---|
| net worth | **P** | served, and **wrong** — it adds a pocket term that is money already inside the bank balance |
| cash position | **P** | served, and **wrong twice** — it adds the committed amount instead of subtracting it, and its account set excludes cash accounts |
| net monthly flow — income minus expense | **F** | served, and the only header figure with no defect |

---

# LIST B — not computed, but the data is there

Every row names the data that makes it computable. A row with no such data is not
in this list — it is at the bottom, under what cannot be computed at all.

## B1. Income

| indicator | nature | the data that makes it computable |
|---|---|---|
| income by source account | **F** | every transaction carries its account, and accounts carry name and type. The rows are read; no per-source fold is made |
| concentration — what share the largest source contributes | **P** | the same fold, plus a maximum. The investment card already does exactly this shape over its own accounts |
| income accumulated since January | **A** | the month-by-month reader already accepts an arbitrary range; only a six- and thirteen-month window are ever asked for |
| average over calendar months, including months with nothing | **M** | the series is served; only the active-month average is computed. **These are different questions**, and the choice of which to show is a decision, not an oversight |

## B2. Expense

| indicator | nature | the data that makes it computable |
|---|---|---|
| **running plan down the category ranking, and its share** | **A** | the plan amount is already on every row of the breakdown, in rank order. Three fields, declared in the contract, not implemented |
| whether a row without a plan interrupted that running total | flag | same source; it is the honesty flag on the two fields above |
| spend accumulated since January, by category | **A** | the budget month-by-month reader answers this over any range up to sixty months |
| how many months a category ran over its plan | **T** | the same reader returns budget and actual for every month with no gaps; the count is a fold over what it returns |
| average spend per movement | **M** | the total and the count are both already on the card. It is one division |
| spend by day of month, or by weekday | **F** | the transaction reader already selects the local calendar date of every movement |

## B3. Debt

| indicator | nature | the data that makes it computable |
|---|---|---|
| the two legs **over time** | **T** | the legs are already computed as a Position; the monthly balance reader reconstructs any account set backwards from its current balance, and is simply never called for debtor accounts |
| counterparties settled to zero, over time | **T** | same reader, same set |
| how long a debt has been outstanding | **P** | transaction dates and the account start date are both stored |

**This is the domain where the gap costs the most.** A net position near zero reads
as *nothing happening*, and it equally describes a large loan against a large debt.
The legs distinguish them and are already calculated — what is missing is the
series that would show whether the two move together or one is shrinking.

## B4. Investment

| indicator | nature | the data that makes it computable |
|---|---|---|
| composition by position | **P** | the repository's own accounts sub-query already selects every account's balance; only the maximum is kept, and the rest is discarded |
| contributions month by month | **T** | contributions are identified by movement type and carry dates |
| realised result month by month | **T** | same |

## B5. Profit and loss

| indicator | nature | the data that makes it computable |
|---|---|---|
| realised result by origin domain | **F** | every transaction carries its movement type and its account, and the account carries its type |
| six-month series | **T** | the monthly reader pattern applies unchanged; this domain has no series key at all |

## B6. Pocket

| indicator | nature | the data that makes it computable |
|---|---|---|
| commitments against the plan line, month by month | **T** | allocations are an append-only signed ledger with dates, and the plan schedule is already computed per pocket |
| how much committed money gets taken back | **F** | a release is a negative row in that ledger, so the two directions are already distinguishable |

**And the one that must not be built**, which belongs here because the data
would allow it: a six-month series folding pocket allocation rows. The rows are
signed, so the fold oscillates between commitments and releases and draws a line
that means nothing. It renders cleanly and answers nothing, which is worse than a
missing chart because nobody goes looking for the defect.

## B7. Bank and cash

| indicator | nature | the data that makes it computable |
|---|---|---|
| **free cash — balance minus commitments, floored per account before summing** | **P** | both terms are already served per account by the pocket module. The flooring must happen per account **before** summing, or an account with spare cash covers one that is short |
| count of accounts no longer covering their commitments | **P** | the over-allocation flag is already on every account row |
| the bank balance as its own published field | **P** | it is computed in the header and thrown away |
| bank balance month by month | **T** | the monthly balance reader exists and is simply not called for bank accounts |
| cash accounts included in the set | **P** | cash accounts exist in the type catalogue; the overview account filter names four types and omits cash |

## B8. Savings — a behaviour, not an account type

Nothing here is implemented, and it is the domain with the largest gap between
what is defined and what exists. **It is also the cheapest**, which is why it is
last and why it matters.

| indicator | nature | the data that makes it computable |
|---|---|---|
| **savings rate — what share of income stayed** | **F** | income and expense for the month are **both already in the payload**. It is one division of two figures the page has already fetched |
| savings rate over six months | **T** | both six-month series are already served |
| net cash change over the month | **F** | the monthly balance reader produces the bank balance at two month closes |

---

## What cannot be computed, and why it is listed

**Investment market value, and the percentage return that depends on it.** There
is no valuation source anywhere in the schema — no price, no quote, no external
feed. This is not a missing fold; it is missing data.

It is recorded here so that it is never quietly added as a null field. Omitting
the key says there is no valuation. A null says there is one and it is unknown,
and the two are different claims about the same money.

---

## The three cheapest things on this page

Ranked by what they cost against what they answer, and all three are in List B.

1. **The savings rate.** Both terms are already in the payload the page fetches.
 One division. It is the only figure the page could show today that answers
 whether the owner is getting ahead, which is the question a personal finance
 overview exists to answer.
2. **The bank balance as its own field.** Already computed, inside the header,
 and discarded. Publishing it costs a key.
3. **Free cash, and the count of accounts that are short.** Both terms served per
 account by the pocket module; the work is folding them with the floor applied
 per account, and it replaces a header figure that is wrong today rather than
 adding a fourth.
