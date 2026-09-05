# Overview — KPIs by domain, and the charts that answer questions

Written 2026-09-05, measured against `main`. Companion to the whole-page proposal
of 2026-09-04; that document argues the layout, this one lists the figures.

**Marks.** *Served* — in the payload today. *Partial* — arrives but wrong, empty,
or on a different time base than the block claims. *Absent* — no field; where the
server computes it and discards it, that is said, because it is worse than absent.

**The rule that decides the split between the two columns.** A card is a state, so
it carries a figure, the population behind it, and a direction of travel — three
things, and the third is what makes the first mean something. Everything that
needs a second question asked before it can be read belongs on the level below.
The test is not importance: it is whether the figure answers on its own.

---

## 1. Income

| level | indicator | mark |
|---|---|---|
| **card** | total received this month | served |
| **card** | how many movements are behind that total | served |
| **card** | change against the previous month's close | served |
| next | the movements themselves, paged | served |
| next | six-month series of the monthly total | served |
| next | this month against the average of a month with activity, at three and twelve months, and the difference between them | served |
| next | by source: which income accounts produced the month | **absent** — the account rows exist, no per-source fold is served |
| next | concentration of income: what share the largest source contributes | **absent** — the figure most worth having here, and it is one fold away from a set already read |

---

## 2. Expense

The best served domain on the page, and the only one whose plan is already beside
its actual.

| level | indicator | mark |
|---|---|---|
| **card** | total spent this month | served |
| **card** | how many movements are behind it | served |
| **card** | change against the previous month's close | served |
| **card** | budgeted amount for the month, and the variance against it | served |
| next | spend by category, ranked, each with its plan, its share and the running share | served |
| next | the running plan accumulated in the same order, and its share | **absent** — three fields, declared in the contract, not implemented |
| next | categorised versus uncategorised spend | served, as a flag |
| next | six-month series, monthly snapshot at three and twelve months | served |
| next | year-to-date distribution rather than month | **absent** — declared, and the page service publishes two chart keys, not three |
| next | budget against actual per category, month by month over a range | **served by the budget module, not wired** — corrected 2026-09-05, see below |
| next | which categories are over plan, and by how much | served per row |

---

## 3. Debt

| level | indicator | mark |
|---|---|---|
| **card** | net position — lent minus owed, signed | served |
| **card** | movements behind it | served |
| **card** | change against the previous close | served |
| next | the two legs separately: what is owed, what is lent | **computed, not on this page** — corrected 2026-09-05 |
| next | count of counterparties settled to zero | **computed, not on this page** — corrected 2026-09-05 |
| next | by counterparty: who owes what | **computed, not on this page** — corrected 2026-09-05 |
| next | six-month series | **absent** — the domain has no series key at all, deliberately |

**Correction, 2026-09-05.** The three rows above were marked *absent*. They are
calculated — by the by-type account balance endpoint, which emits the receivable
leg, the payable leg, the count of counterparties who owe, the count of those owed
and **the count settled to zero**, and emits the same five per counterparty in its
detail branch. What is absent is their arrival in the overview payload, which is a
different state and a much cheaper one. Marking a computed figure absent
overstates the work twice: once by hiding that the query exists, and once by
inviting someone to write it a second time.

**The gap that still matters here:** a net position near zero reads as *nothing
happening* and can equally be a large loan against a large debt. The two legs
distinguish them — and now that they are known to be computed, what is missing is
not the legs but **the series over them**, which is the only thing that says
whether the two move together or one is shrinking.

---

## 4. Investment

Does not wear the shared shape, deliberately: five absolute figures are not a
total, a count and a delta.

| level | indicator | mark |
|---|---|---|
| **card** | capital contributed | served |
| **card** | ledger balance | served |
| **card** | realised result | served |
| next | weight of the largest position | served |
| next | days since the last contribution | served |
| next | composition by position | **absent** — the concentration figure implies the fold that would produce it |
| next | market value and percentage return | **absent, and deliberately** — omitted rather than published as null, because no valuation source is defined |
| next | six-month series | **absent** — no series key |

---

## 5. Profit and loss

| level | indicator | mark |
|---|---|---|
| **card** | total realised result | served |
| **card** | movements behind it | served |
| **card** | change against the previous close | served |
| next | realised result by origin — which domain produced it | **absent** |
| next | six-month series | **absent** — no series key |

---

## 6. Pocket

Ruled by the developer on 2026-09-04: the domain carries the global indicators and
the global commitments. Every figure below is **served by the pocket module's
board in one payload** — what is absent is the call, since Overview does not
invoke it.

| level | indicator | mark |
|---|---|---|
| **card** | total committed | served by the module, not wired |
| **card** | progress against the target overall | served by the module, not wired |
| **card** | how many goals are not meeting their plan line | served by the module, not wired |
| next | target total, remaining, excess | served by the module |
| next | the signed gap against the plan line, and schedule adherence | served by the module |
| next | required monthly amount across goals | served by the module |
| next | counts: funded, overdue, uncovered, how many have a plan line, how many sit under and over it, and the seven levels | served by the module |
| next | committed and released within the month, separately | served by the module |
| next | how many source accounts back the commitments | served by the module |

**Pocket is the reference for the month question.** It is the only domain that
already separates a cumulative figure from a month figure at the source — the
committed total is cumulative, and committed-in-month and released-in-month are
bounded. The other domains should copy that shape rather than each inventing one.

**What this domain must never carry:** a balance, a count of movements, or a
six-month series over signed allocation rows. A commitment is not a balance, an
allocation writes no transaction, and a fold over signed rows oscillates between
commitments and releases and draws nothing about growth.

---

## 7. Bank accounts

| level | indicator | mark |
|---|---|---|
| **card** | total bank and cash balance | **computed and discarded** — folded inside the header, never published as its own field |
| **card** | free cash: balance minus commitments, floored per account before summing | **absent** — defined, not implemented |
| **card** | how many accounts no longer cover what they have committed | **absent** — defined, not implemented |
| next | by account: balance, committed, unassigned, and whether it is over-allocated | **served by the pocket module**, per account, in one batched call |
| next | cash accounts included | **absent** — the account set excludes them, against a decision saying every formula naming bank includes cash |

**The cheapest card on the page.** Its headline figure is already in memory when
the header is built.

---

## 8. Savings — a behaviour, not an account type

| level | indicator | mark |
|---|---|---|
| **card** | net cash change over the month | **absent** |
| **card** | savings rate — what share of income stayed | **absent** |
| next | six-month series of the net cash change | **absent** |
| next | required monthly amount across goals | served by the pocket module |

Nothing here is implemented. It is the domain with the largest gap between what is
defined and what exists.

---

## 9. The charts, and the question each one answers

**A chart earns its place by answering a question a number cannot.** The test used
below: if the figure beside it already answers, the chart is decoration.

| chart | question it answers | mark |
|---|---|---|
| Spend by category, ranked bars with the plan beside each | Which categories dominate the month, and which ran past their plan | **served** |
| The two accumulated curves over those bars | Does spending concentrate faster than the plan does — a shape, not two columns | spend served, plan **absent** |
| The ring beside those bars | What share the top categories take of the whole | served |
| Six-month series, income | Is income steady or lumpy | served |
| Six-month series, expense | Is this month's spend normal for me | served |
| Six-month series, pocket | *(retired)* — a fold over signed allocations answers nothing | do not build |
| This month against a month with activity, at three and twelve months | Is this month unusual, judged against months where something happened rather than against calendar months | served, three domains |
| Savings rate over six months | Am I keeping more of what I earn than I used to | **absent** |
| Debt, the two legs over time | Is the net position steady because nothing moves, or because two large legs move together | **absent as a series** — the legs themselves are computed |
| Investment composition by position | How concentrated am I, beyond the single largest weight | **absent** |
| Commitments against the plan line over time | Am I ahead of or behind the schedule my own goals imply | **served by the pocket module** |
| Budget execution by category over months | Which categories chronically overrun, as opposed to overran once | **served by the budget module, not wired** |

### The items worth building first, and why

Revised 2026-09-05 after the deliberation with the session owning the pocket and
budget backends. The revision is not a change of opinion: **one item left the
absent column because it was measured and found served**, which changes what is
cheapest, not what is most valuable.

1. **The accumulated plan curve over the spend bars.** Three fields, the only
 chart on the page that compares two shapes rather than two numbers, and the
 rest of the block already exists around it.
2. **Budget against actual per category over months.** *(new, was marked absent)*
 The budget module already serves this whole. Its month-by-month reader for a set
 of accounts (`getMonthlySeriesForAccounts`, in the budget transaction
 repository) takes an account id array and a first and last month, and returns
 one entry per account — an account here **is** a category — carrying every
 month in the range with no gaps, each month holding the budgeted amount and the
 actual spend. The gapless guarantee is deliberate and documented: a gap would
 make the caller re-derive the carry-forward, which is the calculation the reader
 exists to centralise. The range is bounded in the calculation service at
 **sixty months**, defaulting to **twelve**.
3. **The two debt legs over time.** It is the only chart that would change how a
 figure already on the page is read — a net position near zero means two
 opposite things and today the page cannot say which.
4. **Commitments against the plan line.** Zero backend cost; the pocket module
 serves it and the wiring is the whole job.

**Two of these four are wiring-only and two need backend work**, and that split
should drive the order rather than the ranking above. What separates the two
wiring-only items: the pocket board answers in a single shaped payload, while the
budget series returns per-account rows that Overview has to fold across categories
itself. The pocket one is less work; the budget one answers a question no figure
on the page can answer at all.

### The one that must not be built

A six-month series over pocket allocations. It is served today, it draws a line,
and the line means nothing: the rows are signed, so the fold oscillates between
commitments and releases. A chart that renders cleanly and answers nothing is
worse than a missing one, because nobody goes looking for the defect.

---

## 10. What every card owes regardless of which figures it carries

- **Its time base, stated in the block.** Three words — *today*, *this month*,
 *since opening*. The page currently mixes five and labels none.
- **A withheld figure as a dash**, never a zero and never a not-a-number. Three
 domains would print zeros today from sets that no longer fill.
- **The population behind an aggregate printed beside it**, so a total and the
 count under it always describe the same rows.
