# Overview — the indicator matrix

The deliverable that closes the first stage of `PLAN_OVERVIEW_RECOVERY.md`: every
Overview indicator with its formula, its temporal nature, its owner, its level,
its chart and the endpoint that carries it.

It is a separate document rather than a fourteenth section of
`PLAN_OVERVIEW_CONTRACT.md` because the contract states **types** — what a field
is called and what shape it has — and this states **meaning**: what the figure
answers and where it comes from. A reader repairing a wrong number needs this
one; a reader writing a client needs that one.

**The rule this table exists to enforce:** one indicator, one definition, one
path. If two columns of the same row could be satisfied by two different queries,
the row is wrong.

---

## The five temporal natures

Every figure is exactly one of these. A figure that cannot be classified is a
figure whose question has not been settled.

| nature | answers | example |
|---|---|---|
| **Position** | what is true at one instant | net worth at the close of the reference month |
| **Flow** | what moved across a period | the expense of the month |
| **Trend** | how a figure moved across a series of periods | twelve months of expense |
| **Accumulation** | what has built up since an origin | realised result since the account opened |
| **Average** | the baseline a period is read against | the mean of the active months of the last twelve |

## The three states

A sixth column the stage added on purpose, because the failure it prevents has
already happened once in these documents: a figure was written about as though it
existed, and it was neither on screen nor served.

- **on screen** — a person can see it in the running application today.
- **computed** — the payload carries it and nothing renders it.
- **specified** — it exists in a contract or a ruling and in no code.

Today the live Overview screen renders **three** figures, and it builds them from
five calls to the by-type account balance endpoint rather than from the Overview
payload. Every other row below is computed or specified.

---

## Hero

The figures that answer "where do I stand", read at the reference date.

| indicator | formula | nature | owner | level | chart | endpoint | state |
|---|---|---|---|---|---|---|---|
| **Liquid Net Worth** | bank + cash + investment − payable | Position | Overview | L1 | figure | `GET /overview` · hero | specified |
| **Net Worth** | bank + investment + debt position | Position | Overview | L1 | figure | `GET /overview` · hero | on screen (three terms, `OverviewLayout.tsx:134-135`) · computed with a fourth term that D54 removes |
| **Available Balance** | bank + cash | Position | Overview | L1 | figure | `GET /overview` · hero | computed as `cashPosition`, and wrong: it adds the pocket total (D54) |
| **Free Cash** | `Σ max(accountBalance − accountAllocated, 0)`, over bank and cash | Position | pocket, imported | L1 | figure | `GET /overview` · hero | specified |
| **Net Monthly Flow** | income of the period − expense of the period | Flow | Overview | L1 | figure | `GET /overview` · hero | computed |
| **Savings Rate** | net monthly flow ÷ income of the period; null unless income > 0 | Flow, as a rate | Overview | L1 | figure | `GET /overview` · hero | computed |

**The floor in free cash is per account, before the sum.** An account committed
beyond its balance contributes zero, never a negative that another account's
surplus silently absorbs.

**Net monthly flow and the savings rate travel together.** The rate is the flow
divided by one of the two operands the flow is already built from, so wherever
the flow goes the rate follows — a rate whose denominator is not beside it is
unreadable.

---

## The shared domain card

Five domains carry the same three figures: income, expense, debt, pocket and
profit-and-loss. Investment does not, and §6 of the contract says why.

| indicator | formula | nature | owner | level | chart | endpoint | state |
|---|---|---|---|---|---|---|---|
| **total** | the domain aggregate over the window | Flow for income, expense and profit-and-loss · Position for debt and pocket | Overview | L1 | figure | `GET /overview` and `GET /overview/:domain` | computed |
| **movement count** | rows behind the total | Flow | Overview | L1 | figure | both | computed |
| **change, as an amount** | this period's total − the prior period's; null with a notice when no complete prior period exists | Flow, as a comparison | Overview | L1 | figure | both | computed |
| **change, as a rate** | change ÷ the prior period's total; null unless that total is strictly positive | Flow, as a comparison | Overview | L1 | figure | both | specified |

**Why the total is a Position for two of the five.** Debt and pocket do not sum a
period's movements; they state a balance at the close of the reference month. The
same field name carries two natures, which is exactly why the nature is a column
and not a footnote.

**The change rate is nullable for a reason that is not missing data.** A
percentage measured from zero has no value, and one measured from a negative base
inverts its own sign: a realised result moving from −100 to −50 would print +50%
and read as a gain. The amount is defined in every case the rate is not, so the
card always has something true to print.

---

## What each domain adds to the shared card

| indicator | formula | nature | owner | level | chart | endpoint | state |
|---|---|---|---|---|---|---|---|
| **budget of the period** | the sum of the budgeted categories | Flow | budget, imported | L1 | figure | expense card | computed |
| **categorised spend** | expense tied to a category account | Flow | budget, imported | L1 | figure | expense card | computed |
| **budget variance** | budget − categorised spend | Flow | budget, imported | L1 | figure | expense card | computed |
| **uncategorised spend** | total spend − categorised spend | Flow | Overview | L1 | figure | expense card | specified |
| **payable** | the negative debtor balances, as a positive magnitude, at the close | Position | Overview | L1 | figure | debt card | specified (declared in the type, emitted nowhere) |
| **receivable** | the positive debtor balances, at the close | Position | Overview | L1 | figure | debt card | specified (same) |
| **settled debtor count** | debtor accounts whose balance is zero at the close | Position | Overview | L2 | figure | debt card | specified (same) |
| **pocket target** | the sum of the plans' targets | Position | pocket, imported | L1 | figure | pocket card | specified |
| **pocket allocated** | the signed net of allocations after releases | Position | pocket, imported | L1 | figure | pocket card | specified |
| **pocket remaining** | target − allocated | Position | pocket, imported | L1 | figure | pocket card | specified |
| **pocket progress** | allocated ÷ target | Position, as a rate | pocket, imported | L1 | figure | pocket card | specified |
| **pocket status counts** | pockets funded, overdue and uncovered | Position | pocket, imported | L1 | one summary line, not three figures | pocket card | specified |

**Uncategorised spend is a disclosure figure, never a budget category.** It exists
so that `spend = categorised + uncategorised` is visible on the card, and it is
never charged against a budget line.

**The variance compares two different universes on purpose.** The budget is
measured against categorised spend and not against the total, because the tie
between a movement and a category account is optional. Publishing the difference
against the total would invent a subtraction across universes that do not match.

---

## Investment

Five absolute figures, none of them addable to another card's total. A return
percentage and a market value are forbidden by D9 and are absent from the type
rather than present and null.

| indicator | formula | nature | owner | level | chart | endpoint | state |
|---|---|---|---|---|---|---|---|
| **capital contributed** | contributions and account openings | Accumulation | Overview | L1 | figure | investment card | computed |
| **ledger balance** | the derived balance of the investment accounts | Position | Overview | L1 | figure | investment card | computed |
| **realised result since opening** | profit-and-loss movements, less the deletion adjustments | Accumulation | Overview | L1 | figure | investment card | computed |
| **concentration** | the largest account's balance ÷ the ledger balance | Position, as a rate | Overview | L1 | figure | investment card | computed |
| **days since the last contribution** | days from the newest funding movement to the reference date | Position, as an age | Overview | L1 | figure | investment card | computed |

**The identity the card asserts:** capital contributed + realised result = ledger
balance. It does not hold today, and the cause is enumeration rather than
arithmetic — an account-deletion movement is of the profit-and-loss type **and**
carries the annulment prefix, so no term claims it while the balance sums it. The
open question is whether the identity gains a third term or the premise is merely
written into the contract, and one production count decides which is
proportionate.

---

## Monthly snapshot

Defined for three domains only: income, expense and pocket.

| indicator | formula | nature | owner | level | chart | endpoint | state |
|---|---|---|---|---|---|---|---|
| **the month's own figure** | the domain total for the reference month | Flow | Overview | L1 | the snapshot block | `GET /overview` · snapshot | computed |
| **three-month average** | the mean of the active months of the last three | Average | Overview | L1 | the snapshot block | same | computed |
| **twelve-month average** | the mean of the active months of the last twelve | Average | Overview | L1 | the snapshot block | same | computed |
| **variance against the average** | the month's figure − the twelve-month average | Flow, as a comparison | Overview | L1 | the snapshot block | same | computed |

**"Active months" is the whole definition.** A month with no activity is excluded
from the denominator rather than counted as a zero, which is why the average is
null and not zero when no month in the window had any.

---

## Financial goals, the consolidated card, and recent activity

| indicator | formula | nature | owner | level | chart | endpoint | state |
|---|---|---|---|---|---|---|---|
| **goals balance** | what the goals hold | Position | pocket, imported | L1 | progress | `GET /overview` · goals | computed, and reading the retired model — it returns nothing |
| **goals target** | what the goals aim at; null when none is set | Position | pocket, imported | L1 | progress | same | same |
| **goals remaining** | target − balance | Position | pocket, imported | L1 | progress | same | same |
| **the consolidated figures** | the hero's and the cards' own values, restated | as each source | Overview | L2 | figure | `GET /overview/all` | computed |
| **the all-domain movement count** | rows across every domain in the window | Flow | Overview | L2 | figure | `GET /overview/all` | computed |
| **recent activity** | the five newest movements, excluding the internal account | not an indicator | Overview | L1 | list | its own endpoint, with its own period | computed |

**The consolidated card recalculates nothing.** Every figure on it is the same
value the hero or a card already published, by the same path. A second formula
producing the same name is the defect this rule exists to prevent.

**Recent activity is not a metric and does not take the analysis period.** It is
the one consumer that chooses its own window, which is why it earns a request
parameter the rest of the payload does not.

---

## What has no row yet, and why that is a statement

- **A return percentage and a market value for investment.** Forbidden by
  decision, not missing by oversight.
- **Any trend.** No indicator above has the Trend nature: the twelve-month series
  exists as an input to the averages and is published as no figure of its own.
  Level 2 is where a trend would land, and nothing has been specified for it.
- **A debtor inactivity rule.** Ruled out by decision.

Four of the five natures carry rows and one does not. That is the honest state of
the module, and it belongs in the matrix rather than in a reader's inference.
