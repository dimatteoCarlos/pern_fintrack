# Overview — whole-page proposal, 2026-09-04

Measured against `main` today. Every figure below carries **what the backend does
about it**, which is the part that was asked for, not a footnote to it.

Three marks are used and they mean three different things:

- **Served** — the payload of `GET /api/fintrack/overview` carries it today.
- **Partial** — it arrives, but wrong, empty, or on a time base that is not the
 one the block claims.
- **Absent** — no field. Some are computed inside the server and thrown away,
 which is worse than absent and is marked as such.

---

## 1. The finding that decides the layout

**The page already mixes five time bases and labels none of them.** This is not a
future risk; it is the payload as served. Carlos asked how to distinguish
cumulative, global and month-only figures — the answer starts by admitting the
page cannot distinguish them today.

| time base | which figures | how the reader is told |
|---|---|---|
| stock, as of today | net worth, cash position, the investment card's ledger balance | nothing says so |
| flow, this month | net monthly flow, and the totals of income, expense and profit-and-loss | nothing says so |
| stock, at the month's close | the debt position and the pocket balance | nothing says so |
| cumulative, since the account opened | the investment card's contributed capital and realised result | nothing says so |
| not bounded by any month | the last five movements | the block says so, alone |

The consequence is concrete and already decided: **net worth adds two figures that
ignore the month to two that respect it.** Ask for a past month and the headline
shows two of today's balances plus two closes — a number belonging to no instant.
That is why the month selector cannot ship yet, and it is the reason, not a
preference.

**Proposal.** The page states the time base of every block, as a fixed part of the
block and not as a tooltip. Three words are enough — *today*, *this month*, *since
opening*. Whatever is decided about a month selector, this is owed regardless, and
it is the cheapest thing on this page: no backend field, no query.

---

## 2. Scope — global, or by month

**Undecided, and it stays undecided here**, but the cost is now known and it is
not symmetric.

The endpoint already accepts a month and already refuses a future one with the
right status, resolved on the owner's calendar in one shared place. So the request
side is built. What is not built is two of the four net-worth terms: bank and
investment are read as of today and cannot answer for a past month until they are
reconstructed at that month's close.

| option | what it costs | what it gives |
|---|---|---|
| global only, current month | nothing | the page as it can be built this week |
| global plus a month selector | reconstructing two balance terms at the close | every block answerable for a past month |

**Recommendation: ship global, current month, with every block labelled by its
time base, and add the selector when the two terms are reconstructed.** A control
that relabels a figure it does not move is worse than no control — and today, two
of the four terms do not move.

---

## 3. The domain cards, and what each one can actually show

Carlos names seven domains. Six exist as cards in the payload; one does not exist
at all.

| domain | mark | what is served, exactly |
|---|---|---|
| Expense | **served** | total of the month, movements behind it, change against the previous close, plus the budgeted amount, the categorised spend, the variance and a flag for uncategorised spend |
| Income | **served** | total, movements, change |
| Profit and loss | **served** | total, movements, change |
| Investment | **served, own shape** | contributed capital, ledger balance, realised result, weight of the largest position, days since the last contribution. **Deliberately not the shared shape** — five absolute figures are not a total, a count and a delta |
| Debt | **partial** | the shared shape is served. The two legs of the position — what is owed and what is lent — and the count of settled counterparties are written in the contract and **not emitted** |
| Pocket | **partial, and misleading** | the card is served and folds a set of accounts that a migration emptied. It publishes a zero total, zero movements and a zero change — a zero where the rule says a dash |
| Bank accounts | **absent, and computed** | there is no bank card. The bank balance IS computed, inside the header, and never published as its own field. The cheapest card on this page and the only one whose data is already in memory |

### The pocket card — two readings, and the choice is Carlos's

An earlier conclusion in this plan was to **drop** the pocket card. That conclusion
is narrower than it sounds and must not be presented as settled:

- **What was rejected** is pocket wearing the shared card shape — a balance, a
 count of movements, a series. Under the model in force a pocket is a plan, not
 an account: the money stays in the bank account, so there is no pocket balance
 distinct from it, and an allocation writes no transaction, so the count of
 movements does not exist.
- **What survives every objection** is a different card: **plan against
 progress.** Committed, target, remaining, how many goals are funded, how many
 are overdue, how many accounts no longer cover what they have committed. None of
 those is a balance and none is a movement count.

The second reading is **served today** — by the pocket module's own board, not by
the overview payload. Overview does not call it.

---

## 4. The cards that route to their own pages

| card | mark | detail |
|---|---|---|
| Expenses against budget | **served** | every row of the spend distribution already carries its budgeted amount. The block is built |
| Savings-goal fulfilment | **served and lying** | the block exists in the payload and its query joins a table the migration emptied. It returns nothing and shows it as nothing-shaped, not as an error |
| Pocket allocations against saving goals | **served elsewhere** | the pocket board answers it whole. Overview does not call it, and whether it should is the boundary question below |
| Goal analysis, financial engineering | **not defined** | no formulas yet. Shown in the mockup as a routing card with no figures, because inventing figures for it is the one thing that would make this document lie |

---

## 5. Charts inside the cards, or one card routing to all of them

**Undecided by Carlos, but one half is already closed and cannot be reopened
casually:** a domain card is a state — no bar, no progress ring, no sparkline
inside it. The reason is that a card carrying a chart starts answering a second
question in a space sized for the first.

So the live question is narrower than it was put: not *charts in cards or a
dashboards card*, but **where the charts that already exist go**. Two are served —
the spend distribution by category, and six-month series for income, expense and
pocket. The other three domains have no series, and the payload omits the key
rather than sending an empty one, deliberately: absent says there is no series,
empty would say there is one and it is blank.

**Recommendation: the charts stay on level 1 as their own blocks, and a routing
card is added for the dashboards that do not fit there.** They are served, they
are the part of the page that answers *why*, and moving them behind a route to
make room would hide the only served analysis the page has.

---

## 6. What the header should be

The header exists and Carlos does not know whether its shape is right. It is not,
and for a measurable reason rather than a taste.

| figure | mark | what is wrong |
|---|---|---|
| Net worth | **partial** | adds a pocket term that, under the model in force, is money already counted inside the bank balance. It reads correctly today only because that term evaluates to zero |
| Cash position | **partial, wrong in two directions** | it adds the committed amount instead of subtracting it, and the account set it sums **excludes cash accounts**, against a decision saying every formula naming bank includes cash |
| Net monthly flow | **served** | income minus expense for the month. The only header figure with no defect |

**Proposal for the header: three figures, and the third replaces a defect rather
than adding a block** — what I own, what I can spend today, and whether the month
moved forward. What I can spend today is free cash, floored per account before
summing, with the count of accounts no longer covering their commitments beside
it as its signal. Both are defined in the indicator catalogue and **neither is
implemented**.

---

## 7. Summary of backend work this proposal implies

Nothing here is approved and no code is written. In dependency order:

| # | work | why it is first |
|---|---|---|
| 1 | the header's two stock figures | the only items that can publish a wrong number silently |
| 2 | saving goals rewritten against the two pocket tables | served and lying is worse than absent |
| 3 | a bank card | the figure is already computed and thrown away |
| 4 | the debt card's two legs and its settled count | declared in the contract, not emitted |
| 5 | pocket's card, whichever reading is chosen | plan-against-progress needs the board's numbers reaching this page |

**One open question this proposal does not settle**, because it is not Overview's
to settle: the pocket module reconstructs an account balance from its ledger, and
Overview sums the stored balance column. Two derivations of one balance in one
header. The pocket module's reason for reconstructing is specific to a figure that
gates a write, so it does not transfer automatically — but two balances of the
same accounts side by side is the defect this plan keeps finding.
