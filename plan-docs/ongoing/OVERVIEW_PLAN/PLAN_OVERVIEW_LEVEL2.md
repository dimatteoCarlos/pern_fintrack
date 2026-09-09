# Overview — Level 2 specification

Written 2026-09-07. This document exists because both `PLAN_OVERVIEW_CONTRACT.md`
and the indicator matrix - consolidated into `OVERVIEW_INDICATORS.md` on
2026-09-09 - state, in as many words, that **nothing has
been specified for level 2**. That absence is what blocks the last stage of
`PLAN_OVERVIEW_RECOVERY.md`, not the frontend stage ahead of it: a backend can
be built before a screen exists, but not before a contract does.

It is a specification and not a plan. It says what level 2 publishes and what it
refuses to publish. The sequencing stays in the recovery plan.

---

## 1. What level 2 is

**Level 1 answers "what is my situation". Level 2 answers "why".**

Level 1 is a fixed page: one figure per question, six domain cards, a hero, a
snapshot widget, saving goals and a five-row teaser. Every figure on it is a
single number and the page is the same shape for every owner.

Level 2 is entered from one card and is about one domain. It is where a figure
becomes a series, a total becomes a ranking, and a card's single delta becomes
the reason for that delta. It is not a second page of numbers of the same kind —
if a figure belongs on level 2 only because level 1 ran out of room, it belongs
on level 1.

**The test a candidate figure has to pass.** Level 2 publishes a figure only when
the question it answers cannot be asked of a single number. A series, a
distribution, a ranking, a decomposition into named parts — those are level 2. A
second total is not.

## 2. What already exists, measured rather than assumed

Level 2's endpoint is already routed and already answers. `GET /overview/:domain`
returns the domain's card and a paginated transaction list, and the six
calculators behind it are complete. What follows is therefore an extension of a
working endpoint, not a new surface.

| already published | shape | where it comes from |
|---|---|---|
| the domain card | the same card level 1 shows | the domain calculator |
| the domain's transactions | rows, page, pageSize, totalRows | the domain calculator, paginated |
| a six-point monthly series | `{ month, value }[]` | income, expense and pocket only |
| the current month's category ranking | rows with rank, cumulative amount and cumulative percentage | expense only |
| a thirteen-month series behind the averages | consumed, never published | income, expense and pocket only |

Three of those matter for what follows. **The series exists for three domains and
not six.** **The ranking exists for one domain and not six.** And **the
thirteen-month series is already fetched and thrown away** — the averages of the
snapshot widget consume it and no field carries it.

## 3. The nature level 1 has no field for

The contract classifies every published figure as one of five temporal natures —
position, flow, trend, accumulation, average — and records that **trend is the
one nature no field of the contract has**. That is not an oversight to correct at
level 1. A trend is a shape, and a page that gives each question one number has
nowhere to put a shape.

**So level 2 is, first and mostly, where trend becomes a published nature.** Every
figure below is one of: a trend, a distribution over a dimension, or a
decomposition of a level-1 figure into parts that sum back to it. Nothing else
qualifies.

## 4. What each domain publishes at level 2

One row per analysis. Each names the question in words, because a field name is
not a question. Null semantics are stated for every one: a level-2 figure that
cannot be computed is absent or null with a notice, never zero — the same rule
level 1 carries.

### 4.1 Income

| analysis | question | nature | null semantics |
|---|---|---|---|
| the monthly series | how has what I receive moved over the last six months | trend | already published; a month with no income is a real 0, not a gap |
| by source | which income sources account for what share of the month | distribution | absent when the owner has no income source with a movement in the month |
| the concentration of income | how much of the month came from the single largest source | ratio | null with a notice when the month's income is zero — a ratio over nothing is not a small number |

**Why concentration and not a count of sources.** A count says how many sources
exist; concentration says how exposed the owner is to losing one. The second is
the question a person asks about their own income and the first is inventory.

### 4.2 Expense

| analysis | question | nature | null semantics |
|---|---|---|---|
| the monthly series | how has what I spend moved over the last six months | trend | already published |
| the category ranking | which categories account for most of the month | distribution | already published for the current month; extending it to a past month is the same statement with a different bound |
| categorised against uncategorised | how much of the month's spending is charged to no category | decomposition | both terms always exist; the uncategorised term is 0 when everything is charged |
| budget variance by category | which categories are over and by how much | decomposition | absent for a category with no budget — an unbudgeted category has no variance, which is different from a variance of zero |

**The uncategorised decomposition is the one figure level 1 deliberately refused.**
Level 1 publishes a boolean saying uncategorised spending exists, and the frozen
contract refuses the amount because it is one subtraction over two published
fields. At level 2 that refusal reverses on its own terms: the analysis is not
the amount, it is the pair — the two parts side by side summing back to the
month's total. A decomposition is a level-2 shape; the amount alone was a second
total, which is why level 1 was right to refuse it.

### 4.3 Profit and loss

| analysis | question | nature | null semantics |
|---|---|---|---|
| the monthly series | how has my realised result moved | trend | negative points are real; a month with no realised result is 0 |
| by account type | how much of the result came from investment accounts and how much from everywhere else | decomposition | the investment share is already published on the level-1 card; the remainder is its complement and the two sum to the total |

**This one is already half built and it is the reason the split exists.** Level 1
publishes how much of the month's realised result landed on investment accounts,
so that an owner can tell that figure from the investment card's own realised
result instead of guessing whether they are the same money seen twice. Level 2
completes it into a decomposition. The remainder is deliberately not a third
field: both terms are published and a client subtracts.

### 4.4 Investment

| analysis | question | nature | null semantics |
|---|---|---|---|
| contribution history | when did I put money in, and how much each time | series of events, not a monthly trend | absent when nothing beyond the opening ever funded the accounts — the same condition level 1 already publishes as a notice |
| balance per account | how is the portfolio distributed across the accounts | distribution | absent with no investment account; a zero-balance account is a real row, not an omission |
| the reconciliation, itemised | which movements make up the balance, term by term | decomposition | this is where the difference the level-1 card refuses to publish becomes legitimate, and §5 says on what condition |

**No monthly series, and that is a decision not a gap.** The investment card's
figures are accumulations and positions, not flows. A six-point series of an
accumulation is a cumulative curve that only ever rises, which tells an owner
less than the two endpoints do. If a series is wanted here it has to be a series
of contributions — a flow — which is the first row above.

### 4.5 Debt

| analysis | question | nature | null semantics |
|---|---|---|---|
| by counterparty | who do I owe and who owes me, largest first | distribution | absent with no debt of either direction |
| the two legs over time | how have what I owe and what is owed to me moved separately | trend, two series | a month with neither is 0 on both, not a gap |

**Two series and not one.** The card publishes a net position, and a net position
that has not moved can hide both legs doubling. Level 2's job here is precisely
to separate them, so one series would defeat the purpose of the section.

### 4.6 Pocket

| analysis | question | nature | null semantics |
|---|---|---|---|
| progress per pocket | which plans are on track and which are not | distribution | a pocket with no target has no progress — absent, not zero, which is what level 1 already rules |
| the monthly net movement | how much did I commit or release each month | trend | already published; 0 is a real month |
| committed against free | how much of the bank and cash balance is promised | decomposition | both terms always exist |

**The last row is the level-2 form of the hero's pair.** Level 1 publishes the
cash position and free cash side by side and leaves the commitment implicit
between them. Level 2 states the three explicitly, and it is the one place the
per-account floor becomes visible: an owner whose free cash exceeds their cash
position has an overdrawn account, and only this breakdown can say which.

## 5. The reconciliation difference — the one prohibition level 2 may lift, and its condition

The frozen contract says the client reconciles and the server publishes the terms
and **never the difference between them**. The investment card obeys that: it
publishes all three terms and the balance, emits a sentence when they fail to
agree, and refuses the number.

Level 2 may publish the difference, on one condition: **it publishes the tolerance
with it.** The prohibition was never about the subtraction — four published fields
make that trivial — it was about a client subtracting in floating point, finding
a cent that the server's decimal comparison did not find, and telling the owner
their books are broken. An itemised reconciliation that states the difference AND
the threshold below which the server calls it zero gives the client the one thing
it cannot reconstruct. Without the tolerance the field stays refused.

## 6. What level 2 does not get

**No new aggregation of rows a level-1 card already summed.** Every figure above
is either a series over the months a calculator already fetches, a grouping of
the rows it already reads, or arithmetic on figures already published. That is
not an efficiency preference: the defect that opened this whole module was a
consolidated figure computed by a second path that disagreed with the detail
beside it, and a level-2 view that re-sums a card's rows is the same defect at a
different altitude.

**No forecast, no projection, no recommendation.** A trend is what happened. An
extrapolation is a claim about what will happen, and this module has no model
behind such a claim.

**No market valuation anywhere in the investment section.** The contract forbids a
return percentage and a market value at level 1 because there is no valuation
model, and level 2 does not acquire one by being a deeper page.

**No cross-domain analysis.** A level-2 view belongs to exactly one domain. The
question "how does my spending relate to my income" is a hero question, and the
hero already answers it with the net monthly flow and the savings rate.

## 7. Where the code lives

**Each analysis belongs to the domain that owns the data.** Overview composes and
does not recalculate — a figure's definition belongs to the module that owns the
rows behind it, and Overview imports that service. Applied to level 2 this means
the domain analyses return to their domains: the category ranking is the expense
module's, the counterparty breakdown is the debt module's, the contribution
history is the investment module's. Overview's own code publishes them; it does
not define them.

That is the phrase "the domain analyses returned to their domains" in the
recovery plan, and it is an ownership rule rather than a folder move.

## 8. Open decisions

Recorded rather than settled, and none of them blocks starting the section they
belong to.

| decision | why it is open |
|---|---|
| **Whether level 2 is one response or several.** One request per domain returning every analysis, against one request per analysis | the one-payload rule argues for a single response, and the analyses differ enormously in cost — the counterparty breakdown is cheap and a thirteen-month two-leg debt series is not. A single response makes the expensive one everybody's cost |
| **How far back a level-2 series reaches.** Six points as level 1 uses, or thirteen as the averages already fetch | thirteen months are already read and discarded, so the longer series is free where the shorter one is already paid for. Whether a reader wants six or thirteen is a design question, not a cost one |
| **Whether the reconciliation difference is published with its tolerance** (§5) | the condition is stated and the developer has not ruled on it. Until then the field stays refused, exactly as at level 1 |
| **Whether a past month's category ranking is in scope** | the ranking exists for the current month only. Extending it is the same statement with a different bound, but it changes what the endpoint promises |

## 9. Definition of done

Level 2 does not advance until every figure it publishes reads a figure level 1
already publishes, or a series or grouping over rows a calculator already
fetches. No second aggregation of rows a card has already summed, and no figure
whose nature is not one of trend, distribution or decomposition.
