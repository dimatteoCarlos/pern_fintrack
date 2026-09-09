# OVERVIEW — plan of record

**Written 2026-09-07. This is the single plan for the Overview module.** Every
state below was measured in the code of `feat/overview`, not read from another
plan. Where a figure is named, it is the identifier the payload publishes.

On 2026-09-09 it absorbed the three documents whose sequencing and scope it had
already superseded - `PLAN_OVERVIEW_RECOVERY.md`, `OVERVIEW.md` and
`PLAN_OVERVIEW_LEVEL2.md` - so the stage board, the exit conditions, what is out
of scope and the traps are here rather than in four files that disagreed. It does
**not** supersede the reference that carries the semantics, the one that carries
the layout, or the frozen payload contract. Section 2 says which file answers
which question.

---

## 1. What the module is

Overview is the **read layer** of the application, not the analytical
destination. It answers three questions at three depths and refuses a fourth.

| depth | question | where it lives |
|---|---|---|
| level 1 | what is my situation | the Overview page, one request |
| level 2 | what explains this domain | the per-domain detail screen |
| level 3 | what explains this entity | the owning module computes it, **Overview routes to it** — `OVERVIEW_LEVEL3.md` |

**The level-3 row said "not Overview" until 2026-09-08 and that was wrong by
half.** Computing an entity's figures belongs to the owning module; routing from
a level-2 row to that entity belongs to Overview, because the row the user
clicks is Overview's payload. Measured, five of the six domains already publish
the id the destination screen reads, so level 3 needs no new endpoint and no new
figure — only links. `OVERVIEW_LEVEL3.md` carries the field and the destination
per domain.

The problem it exists to solve, still true today: the live screen renders **three
figures** — net worth, income, expense — built from **five calls** to the
balance-by-account-type endpoint, and never calls the Overview payload at all.
Everything Overview computes is computed and discarded.

---

## 2. The reference set — which file answers what

Two tracks. **Five documents and three mockups, once the layout merge below is
done. Nothing outside them is a source.** Eleven documents became seven on
2026-09-09 and become five when `OVERVIEW_LAYOUT.md` absorbs the last two: the
same stage board lived in three of them, the same out-of-scope list in two, and
the open decisions in six.

### What to build

| file | answers |
|---|---|
| `OVERVIEW_PLAN.md` (this file) | what is done, what remains, in what order, what is out of scope, and the traps |
| `OVERVIEW_INDICATORS.md` | the vocabulary the formulas are written in, and every indicator with its temporal nature, owning module, level and state |
| `OVERVIEW_LAYOUT.md` | which published field feeds each block, on which endpoint, at which depth |
| `PLAN_OVERVIEW_CONTRACT.md` | the exact wire shape of the payload - consulted, not read front to back |
| `OVERVIEW_DECISIONS.md` | why a thing was decided the way it was, and the rulings frozen for P5 - consulted |
| `OVERVIEW_CHART_TECHNIQUE.md` | how a chart is drawn in this module - **folds into `OVERVIEW_LAYOUT.md`** |
| `OVERVIEW_LEVEL3.md` | which entity each domain opens and the field carrying its id - **folds into `OVERVIEW_LAYOUT.md`** |

### How it looks

All five mockups moved to `plan-docs/mockups/overview/` on 2026-09-08, the
central folder the README there describes. The filenames below are unchanged and
are relative to that folder.

| file | covers |
|---|---|
| `bosquejo-overview-nivel-1.html` | the whole page at page density: month picker, hero, six domain cards, monthly snapshot, goals, activity teaser, charts |
| `propuesta-pareto-gasto.html` | the spend-distribution component: colour ramp, redundant encoding, sub-pixel segment, zero spend, uncategorised, reversal larger than spend, three fetch states, tokens consumed |
| `propuesta-snapshot-mensual.html` | the monthly-snapshot component: the state box, the dead band, the three fetch states, edge cases, tokens consumed |

**The sketch and the two proposals are not redundant.** The sketch draws the
block at page density and settles the technique — the distribution bar is native
CSS with no library, the library is for the trend line only. Each proposal
carries what the sketch does not: the component's behaviour when the data does
not cooperate. Measured, the spend-distribution proposal names the colour ramp 21
times against 2 in the sketch and 0 in `OVERVIEW_LAYOUT.md`, and accessibility 19
times against 4.

---

## 3. What is built — measured, with its commit

| stage | what it is | state |
|---|---|---|
| P0 | freeze the semantic contract | **DONE**, no code |
| P1a | re-anchor the four balance reads | **DONE**, `2f8cec3d` |
| P1b | make bank and investment obey the reference month | **DONE**, `4f9be6a0` and `229286df` |
| P2 | repoint Pocket to the plan model | **DONE**, `f4b999d9` and `f0388039` |
| P3 | complete and correct the level-1 indicators | **DONE** 2026-09-07 |
| P4 | the API contract, the served window and the activity page | **DONE**, `4b99fffa` and `7ba6761e` |
| P5 | frontend | **NOT STARTED**, no longer blocked |
| P6 | level 2 | **BACKEND DONE**, `7ba6761e`; renderer not started |

### The three endpoints

| route | returns |
|---|---|
| `GET /overview` | the level-1 page payload — one request for the whole page |
| `GET /overview/activity` | the activity view with its own range control and pagination; the page's five-row teaser is unchanged |
| `GET /overview/:domain` | the domain card and its paginated transactions, plus an optional analysis section |

### The two analysis depths

`GET /overview/:domain` takes an optional `analysis` parameter, declared once in
`analysisLevels.js` and read by the validator, so the schema and the services
cannot hold two different ideas of what a depth is.

| value | what it adds | what it costs |
|---|---|---|
| absent (default) | nothing — the response has no analysis key at all | the level-1 response, unchanged for any client not yet updated |
| `derived` | everything the level-1 request already fetched, reshaped | **no extra statement** |
| `full` | what has to be queried for the first time | one new statement per domain |

### What each domain publishes at level 2

| domain | analysis | depth |
|---|---|---|
| income, expense, pocket | the thirteen-month series (`series`) | `derived` |
| income | income by source (`bySource`), source concentration (`concentration`) | `full` |
| expense | the categorised/uncategorised split (`categorization`) | `derived` |
| profit and loss | the split by account type (`byAccountType`) | `derived` |
| pocket | progress per pocket (`progressByPocket`) | `derived` |
| pocket | committed against free cash (`committedAgainstFree`) | `full` |
| investment | the reconciliation with its difference and tolerance (`reconciliation`) | `derived` |
| investment | balance per account (`balanceByAccount`), contribution history (`contributionHistory`) | `full` |
| debt | by counterparty (`byCounterparty`), both legs month by month (`legsOverTime`) | `full` |

**Debt has no series at any depth, and that is a decision.** A net debt position
that has not moved is exactly what hides both legs doubling, which is the reading
level 2 exists to expose.

### Tests

`backend/test/overview` — six files, 69 tests, no database. Run the files
explicitly; pointing the runner at the directory makes it load the directory as
a module and fail.

---

## 4. Guard rules - non-negotiable

Inherited from `PLAN_OVERVIEW.md` sections 4 and 7-bis, deleted 2026-09-09. The
other sections of that file were a reading of the code on 2026-08-20 and are
superseded by section 3 here, by `OVERVIEW_DECISIONS.md` and by
`OVERVIEW_INDICATORS.md`. The four rules below and the table at 4.5 are the part
nothing else carried.

The deleted file paired each rule with the site that violated it in August 2026.
Those counts were a measurement, not the rule, and they are replaced here by
where the rule stands today.

### 4.1 Server-authoritative financial calculation

Totals, conversions, percentages, balances, periods and indicators are computed
in the backend. The frontend renders the supplied figure. **Do not reproduce a
financial formula in React.**

This is the rule `PLAN_OVERVIEW_CONTRACT.md` cites as the batch-payload
precedent: one request answers with every figure a screen needs, already
computed, rather than with rows the client folds.

*Today:* six sites recomputed money in the browser when the rule was written. The
sixteen-request mount they belonged to is gone, and `makeHeroSection.js` with the
six domain services publishes the figures those sites derived.

### 4.2 One indicator, one formula, one implementation, many consumers

The same indicator must not be independently recomputed in Overview, a domain
page and the consolidated card. The consolidated card consolidates domain facts;
it does not re-derive them - consolidating by re-running the calculation is how a
dashboard's total drifts from the sum of its parts.

*Today:* stated as an ownership rule in `PLAN_OVERVIEW_CONTRACT.md` section 14.3,
and it is why the count of movements behind a card is the count of the rows the
total summed rather than a `FILTER` of its own (D21). `OVERVIEW_INDICATORS.md` is
the table that enforces it: one row, one formula, one path.

### 4.3 Currency: convert before aggregating, server-side only

The backend converts, conversion happens before aggregation, the client never
converts, and aggregation is in the single accounting currency. Reuse
`currencyAmountConversion`; do not introduce a second implementation for
Overview. Mixed-currency values are never silently added - an aggregate that
cannot be represented safely returns an explicit `null` with a notice rather than
an invented figure.

*Today:* the rule holds by construction, because every amount is written in the
accounting currency (D7) and nothing converts on read. The mixed-currency branch
is written and unreachable under one accounting currency per installation, and it
is written anyway: the day it becomes reachable, a silent sum is a wrong number
on screen and a `null` is a question the owner can answer.

### 4.4 One read model, not a request aggregator

`GET /overview` must be a genuine read model. Moving a fan-out from the browser
into a `Promise.all` inside the controller is the same waterfall one layer down
and does not satisfy this rule.

*Exception:* if profiling proves independent queries materially improve latency
and the count stays bounded, document the reason and get it approved explicitly,
in this file, before writing it.

### 4.5 One module, one question - set by the developer 2026-08-29

**Overview is not touched to solve another module's problem.** The developer
placed this above adding indicators to Overview, and it is what decides where a
figure belongs: a figure that does not answer the module's question is on the
wrong screen.

| module | the question it answers |
|---|---|
| Overview | What is my overall financial situation? |
| Bank accounts | Where is my real money? |
| Debts | Who owes me and whom do I owe? |
| Budget | How am I executing my budget? |
| Pocket | Which savings goals am I funding, and how close am I? |
| Investments | How is my wealth invested? |

This is the rule `PLAN_POCKET/POCKET_DECISIONS.md` names when it records that the
sum of pocket targets and the overall pocket progress are refused by Overview
rather than merely missing from it. Reopening that boundary is the developer's
call.

### 4.6 What the page owes the reader, and what the payload owes the page

From `OVERVIEW.md` section 2.1, deleted 2026-09-09. Four rules that are not
restatements of 4.1 to 4.4.

| rule | what it says |
|---|---|
| **one request** | the whole page arrives in one response. A component that fetches its own figure fetches one the page already holds |
| **a card is an entry, not a report** | three to five values. A card that grows a sixth is a screen that has not been designed |
| **no charts at level 1 — qualified** | the original rule forbade every chart on the page. It was relaxed: the page already carries the six-point series and the category ranking **computed**, and discarding them to fetch them again is the second request rule 4.4 forbids |
| **whoever computes, publishes** | a figure a repository computes and that never reaches the payload is this module's characteristic failure. Four such figures were found and closed in P3 |

---

## 5. What remains

### P5 — the frontend, one component per commit

Each commit whole. The design file for each is named, because the sketch alone
does not carry component behaviour.

| # | component | design source |
|---|---|---|
| 1 | the month picker, with the conditional label | `bosquejo-overview-nivel-1.html` |
| 2 | the hero, with its four position figures and two flow figures | `bosquejo-overview-nivel-1.html` |
| 3 | the six domain cards — five on a shared component, investment on its own | `bosquejo-overview-nivel-1.html` |
| 4 | the spend distribution, from the page payload, no `analysis` parameter, no client-side reordering | `propuesta-pareto-gasto.html` |
| 5 | monthly snapshot, financial goals, activity teaser — all three from the same payload | `propuesta-snapshot-mensual.html` and the sketch |
| 6 | the six domain screens, `derived` where it suffices and `full` only where a ranked breakdown is needed | **no mockup exists** |
| 7 | the level-3 links out of the level-2 rows — five domains, no new calculation and no entity endpoint | `OVERVIEW_LEVEL3.md` |

**Two pieces of P5 do not wait on the remaining decisions and can start now.**
The month picker reading the served window off the response, and the level-3
navigation wiring. Both are settled inputs: the served window publishes the
month, its bounds and whether it is still running, and the five routable domains
each publish the identity their destination screen reads. What must not be
advanced with them is the semantics — the final figures, the hero, and the change
published as an amount or as a rate, which are still open.

**The exit condition is the one that matters to the user:** the live screen must
end with no dependency on the balance-by-account-type endpoint for any Overview
figure.

**The month picker reads the reference month from the response, never from what
it sent.** The served window publishes the month actually served, its bounds, and
whether that month is still running; the label is conditional on that last field,
because a closed month reads as the month and the current one reads as
month-to-date.

### The order P5 is built in

One component per commit, each one whole. From `OVERVIEW.md` section 4.

1. **The month picker**, with the conditional label. The control picks a whole
   month in both cases; the label cannot — a closed month reads as the month, the
   running month reads as month-to-date, and `isCurrentMonth` is the field that
   decides which.
2. **The hero**, with its four position figures and two flow figures, adopting the
   new hierarchy whole rather than the old triad with a figure bolted on.
3. **The six cards** — five on a shared component, **investment on its own**. The
   investment card shares only `domain`, `currency` and `meta` with the other
   five, so a shared component with exceptions prints undefined in four places.
4. **The category distribution**, from the page payload, with no `analysis`
   parameter and no reordering in the client.
5. **Monthly snapshot, goals and the activity teaser**, all three from the same
   payload.
6. **The domain screens**, at `derived` where it suffices and `full` only where
   there is a ranked breakdown.

**What the sketches show that a ruling has since deleted.** The sketches predate
the rulings, so none of this is anyone's mistake — it is the cost of the sketches
being older than the decisions, and it is written here so it is paid once.

| in the sketch | what replaced it |
|---|---|
| the cash position defined as bank plus pocket, and the note stating net worth as bank + investment + debt + pocket | the net-worth ruling (D54). The note is flagged in the sketch as a time-base defect; it is a double count as well, and fixing the time base alone would leave a wrong figure under a note saying it was fixed |
| the pocket total labelled *dinero disponible en pockets* | a pocket is a plan, not a container. The money is in the bank account and is spendable; the word *disponible* states the retired model where a reader will believe it |
| the flow and position labels written unconditionally | the label is conditional on `isCurrentMonth`. The sketch's own reasoning is right — the control picks a whole month — and its error is narrower than it looks: it conflates what the control selects with what the label says |
| raw hex values in the sketch blocks | a stylesheet takes a token. Whoever translates a block asks for the missing token rather than carrying the literal across |
| the hero as the old triad — net worth, cash position, net flow | the hierarchy this plan freezes: what is owned, how much of it is cash, and how much of that cash is unpromised. This is the largest gap, and it is why the hero is redesigned rather than corrected |

### Definition of done, per stage

Section 8 verifies the work as a whole. These are the exit conditions that stop a
stage being declared finished early.

| stage | does not advance until |
|---|---|
| **P1** | a past bank balance and a past investment balance both reconstruct correctly · the investment reconciliation still holds on historical months · the current month is month-to-date and a closed month is the full month |
| **P2** | Overview's target, allocated, remaining and progress equal the Pocket board's, figure for figure |
| **P3** | every level-1 indicator has a formula, a temporal nature, an owner, a null semantics and a currency semantics |
| **P4** | the payload contract is frozen and the contract tests pass |
| **P5** | the live screen has no remaining dependency on the balance-by-account-type endpoint for any Overview figure |
| **P6** | every level-2 view reads a figure the level-1 payload already publishes, or an endpoint owned by the domain it belongs to — no second aggregation of rows a card has already summed |

The last one is the point of the whole plan: today that screen makes five
separate calls to build three figures.

### The two gaps that are not stage work

| gap | what it is |
|---|---|
| **no mockup for the six domain screens** | the level-2 backend is served and committed; nothing draws it. This blocks commit 6 of P5 and nothing before it |

### The gap that was found and closed the same day

**The page's transaction count omitted investment, and now does not.**
`makeAllCard` summed the five counts `overviewPageService.js` handed it — income,
expense, debt, pocket, profit and loss — and no other domain counts an
investment movement, so `transactionCountAll` was short by every one of them.
`makeInvestmentCard` now carries `transactionCount`, taken from the paging
result the level-2 rows already came from, and the page sums six counts. The
count survives the level-1 request that suppresses rows, because
`readTransactionsPage` computes it whether or not rows were asked for.

**The other three fields of the shared card shape stay absent from this card,
and that is the standing decision.** It has no `totalAmount` because its
headline figure is `ledgerBalance` under its own name, no `delta` and no
`window`. Only the count was a wrong figure; the rest is why the card has its
own component.

### The gap that was recorded and does not exist

**Budget variance by category was listed here as missing. It is built.**
`makeBudgetCategoryStatus.js` publishes `budgetAmount`, `actualSpent`,
`remainingBudget`, `executionPercentage` and `isOverBudget` per category, and
`overviewExpenseService.js` puts the whole array into the level-1 page payload
under `charts.expenseCategories` — so it is available a level earlier than the
specification asked for it. The row was written against an older state of the
code and is removed rather than corrected.

---

## 6. Decisions

### Settled by the code since the level-2 specification was written

The specification recorded these as open. `7ba6761e` answered all three, so they
are recorded here as closed and removed from the open list.

| question | answer, and where it lives |
|---|---|
| one level-2 response per domain, or one per analysis | **one per domain**, with the caller naming the depth — `analysisLevels.js` |
| how far back a level-2 series reaches, six points or thirteen | **thirteen** at `derived`, published from one bound — `ANALYSIS_MONTHS` in `monthArithmetic.js`; the card's six-point chart is the tail of the same array |
| whether the reconciliation difference is published with its tolerance | **yes, at level 2 only** — `makeInvestmentAnalysis.js` publishes `difference` and `tolerance` beside the four terms. Level 1 still publishes the four terms and refuses the difference, because a client cannot reconstruct the tolerance: the comparison runs through the decimal library and a floating-point subtraction finds a cent where the server found none |

### Still open

None of these blocks building a component.

| decision | the two readings | who decides |
|---|---|---|
| whether the change is also published as a rate | the amount already exists and is always defined; the rate reads better but is null in the two cases that matter most | the developer |
| which card owns the spend distribution | it can render inside the expense card, or route to its own screen | frontend, during P5 |
| whether the six cards route to six screens or to three | investment, debt and pocket already have their own module; income, expense and profit-and-loss do not | frontend, during P5 |
| the missing colour tokens | the sketches carry raw hex values, which a sketch may do and a stylesheet may not | requested when the block is built, never before |
| whether a past month's category ranking is in scope | the ranking exists for the current month only; extending it is the same statement with a different bound, but it changes what the endpoint promises | the developer |

---

## 7. Folder cleanup

Fourteen files and one folder remain here. No code comment cites any of them —
twenty stems searched case-insensitively across `backend/src`, `frontend/src`
and `backend/test` returned nothing — so deleting one breaks nothing
compilable. What it can break is a citation from another document.

**Execution happens on `main` now that `feat/overview` is merged into it.** The
earlier instruction to delete on the branch held only while the branch carried
work `main` did not.

### Deleted — the first batch, no citation from anywhere

Removed on 2026-09-07 after re-measuring that the only reference to any of the
four was this list: `OVERVIEW_FRONTEND_RENDERING_SKETCH.md`,
`OVERVIEW_KPI_MAP_BY_DOMAIN.md`, `OVERVIEW_KPI_COMPUTED_VS_DERIVABLE.md`,
`OVERVIEW_PAGE_PROPOSAL_2026-09-04.md`.

The rendering sketch was measured redundant, not judged so: of its 110
identifiers, 108 appeared in `OVERVIEW.md` or `OVERVIEW_LAYOUT.md`, and the two
that did not were backend function names, not fields the frontend renders.

### Deleted — the second batch, after repointing five citations

Removed on 2026-09-07. This list said one citation and two; enumerating them
found five, two of them in files this folder still holds.

| file deleted | citation repointed to `OVERVIEW_PLAN.md` |
|---|---|
| `PLAN_OVERVIEW_EVAL.md` | `OVERVIEW_DECISIONS.md`, and the reading order in `plan-docs/INDEX.md` |
| `OVERVIEW_BRIEF_2026-09-04.md` | `ESTADO_PLANES.md` twice, `INVENTARIO_ENDPOINTS_E_INDICADORES.md`, `PLAN_OVERVIEW.md` |

**Count the citations before deleting, do not read the count off this file.**
The two missed here sit inside documents scheduled for the third batch, so a
search limited to outside the folder finds neither.

### Deleted - the third batch, after merging what only they held

Removed 2026-09-09 on the developer's instruction to leave the files that serve
development and delete what is obsolete. Every citation was repointed in the same
commit, four of them from outside this folder.

| file deleted | what only it held | where that lives now |
|---|---|---|
| `OVERVIEW_INDICATOR_MATRIX.md` | each indicator's temporal nature, owning module and level | `OVERVIEW_INDICATORS.md`, consolidated with the file below |
| `PLAN_OVERVIEW_KPI_CATALOG.md` | the vocabulary every formula depends on, the eleven-field entry format, and the pocket and savings entries | `OVERVIEW_INDICATORS.md` sections 1, 11, 12 and 13 |
| `PLAN_OVERVIEW.md` | the guard rules and the one-module-one-question table; its section 5, the eleven declared fields, was already carried | section 4 of this file, and `OVERVIEW_INDICATORS.md` section 11 |
| `INVENTARIO_ENDPOINTS_E_INDICADORES.md` | a historical endpoint measurement, declared unmaintained by its own header | nowhere, deliberately: `overviewRoutes.js` answers which routes exist and cannot go stale |

**Why the two indicator documents became one.** They answered the same question
from two sides and had drifted. The catalogue had already declared itself
superseded as the list of indicators, which left the vocabulary every formula
depends on - the three catalogues, the pseudo-account rule, the dead
`movement_type_id = 3`, the annulment description prefix - reachable only through
a file nobody was meant to open. Two statements of the consolidated file reverse
both sources: the budget variance is measured against total spend, not against
the categorized part, and the sections the catalogue numbered 3bis and 3ter are
12 and 13.

**Four citations from outside this folder were repointed** in the same commit:
three in `PLAN_POCKET/POCKET_MODULE_SPEC.md` and one in
`PLAN_POCKET/POCKET_DECISIONS.md`. `PLAN_POCKET/` is not this session's folder,
so the session that owns it was told.


### Deleted - the fourth batch, the same content in three files at once

Removed 2026-09-09, immediately after the third, on the developer's reading that
the folder still held too many files. What decided it was not the count but the
repetition, measured: the five temporal natures were written in three documents,
the stage board in three, the out-of-scope list in two, the traps in two, the
verification table in two, and the open decisions in six.

| file deleted | what only it held | where that lives now |
|---|---|---|
| `PLAN_OVERVIEW_RECOVERY.md` | the per-stage exit conditions, the out-of-scope list and the traps | sections 5, 8, 9 and 10 of this file |
| `OVERVIEW.md` | the three clocks with the served window's field names, the P5 build order, and four render-authority rules | `OVERVIEW_INDICATORS.md` section 1, and sections 4.6 and 5 of this file |
| `PLAN_OVERVIEW_LEVEL2.md` | the test a candidate level-2 figure has to pass, what level 2 refuses, and the ownership rule | `OVERVIEW_INDICATORS.md` section 9 |
| `OVERVIEW_P5_FROZEN_DECISIONS.md` | the developer's rulings of 2026-09-08 | `OVERVIEW_DECISIONS.md`, final section |

**Two documents both called themselves the plan of record**, which is the defect
underneath the count: `OVERVIEW_PLAN.md` said *"this is the single plan for the
Overview module"* and `PLAN_OVERVIEW_RECOVERY.md` said *"this is the plan of
record for the Overview module"*, six days apart. A reader following either was
following a real plan; the two disagreed on which stages were done.

### Scheduled, not yet executed - the last two

`OVERVIEW_CHART_TECHNIQUE.md` and `OVERVIEW_LEVEL3.md` are both render documents
and both fold into `OVERVIEW_LAYOUT.md`. **They stay until that file is rewritten
in English**, because deleting a document before its content lands is the failure
this log exists to prevent. `OVERVIEW_LAYOUT.md` carries the pending note.

**The folder becomes one language with that rewrite.** `OVERVIEW.md` and
`OVERVIEW_LAYOUT.md` were the castellano pair; the developer ruled on 2026-09-09
that the surviving set is English, as `CLAUDE.md` requires.
`PLAN_OVERVIEW_CONTRACT.md` and `OVERVIEW_DECISIONS.md` keep their castellano
bodies: one is a frozen contract and the other a dated register, and
retranslating either changes text whose whole value is that it has not changed.

### Keep

The files of section 2, plus:

| file | why it stays |
|---|---|
| `OVERVIEW_INDICATORS.md` | the indicator reference, written 2026-09-09 |
| `benchmarking_lookUp/monthly_average_kpi_benchmark.md` | primary research. Its conclusion is inside D14, so nothing needs to open it, and deleting a survey to save one file is poor value |

**The stage board was duplicated and the copy drifted.** `OVERVIEW.md` section 4
carried a second board whose contract-stage and level-2 rows both claimed
uncommitted work that was committed; the rows were corrected on 2026-09-07.
Section 3 of this file is now the board, and section 4 of `OVERVIEW.md` is the
one to remove.

---

## 8. Verification

### The rules a change is checked against

- No figure enters a sketch without existing in the builder that publishes it.
- A missing figure renders as a skeleton or a dash, never as `0` or `NaN`.
- Every colour comes from `var(--token)`; a value with no token is asked for, never invented.
- The month picker reads the reference month from the response, not from the request.
- No level-2 figure re-aggregates rows a card already summed.
- Before deleting a document, its citations from outside this folder are repointed in the same commit.

### The checks each stage was closed on

Merged 2026-09-09 from `PLAN_OVERVIEW_RECOVERY.md` part 5 and `OVERVIEW.md`
section 9, which held the same table in two languages and disagreed on two rows.

| step | check |
|---|---|
| **P1a** | the stored balance against the derived one, per account, **before** editing. Agreement means the change is inert and safe; disagreement is a separate bug |
| **P1b** | **run 2026-09-06 against the local development database. The binding passes; the identity fails, and not for the reason the row expected.** Fifteen months on the one owner holding investment accounts. The running month comes back identical to the pre-change query, figure for figure, so nothing was bounded away that should not have been. Every month before the first movement holds the identity exactly. The two months carrying movements are short by the same 0.75, and a discrepancy identical in a month that bounds nothing away cannot be a bounding error. Its cause is one annulment row; the finding is in `OVERVIEW_DECISIONS.md` under the heading naming the deleted account |
| **P2** | the pocket total in Overview equals the board's own total for the same month |
| **P3 hero** | `netWorth - liquidNetWorth == receivable` wherever both are reported. **This is the single check that catches the inverted payable sign** — get it backwards and it fails immediately instead of producing a plausible wrong number. It is a validation identity and never the production formula: liquid net worth is not derived from net worth |
| **P3 expense** | **corrected 2026-09-07.** There is no uncategorised field to check. Verify instead that `hasUncategorizedExpense` is true exactly when `totalAmount > categorizedExpense`, on a month that has uncategorised spend and on one that does not |
| **P3 debt** | the legs the Overview card emits match the legacy endpoint's two directions **in magnitude**, the payable leg differing only in sign |
| **P4 / P6** | the module's 69 contract tests pass. Run the files explicitly; pointing the runner at the directory makes it load the directory as a module and fail |
| **P5, per component** | the three fetch states are three — skeleton, error with retry, empty — and no missing figure prints as `0` or `NaN` |
| **all** | unit probes importing the builders directly, no database, following the pattern used for the savings rate. Boot test `APP LOADED OK` |

---

## 9. Out of scope

From `PLAN_OVERVIEW_RECOVERY.md` part 4, deleted 2026-09-09. Nothing here is
cancelled. Each item is out of **this plan's** scope, with the reason and the
place it goes instead.

### 9.1 Out because it already exists elsewhere

| item | where it already lives |
|---|---|
| pocket monthly progress, gap against plan, plan adherence, required-by-now | the pocket board — **built and published today**, not future work |
| required monthly contribution, the plan line, allocation history | the pocket detail screen |
| total allocated, total target, total remaining as a hero | the pocket board's own hero. Overview shows a summary, not a second board |

### 9.2 Out because it belongs at another level

Accumulations, trends and detailed baselines: accumulated income · capital
contributed since opening · realised result since opening · the largest position's
weight · days since the last contribution · debt aging · investment composition ·
the expense category ranking · six-month charts · full transaction tables · the
3-month and 12-month averages as cards of their own.

All computable, several already computed. **All level 2.** The rule that puts them
there: a card may not print a figure whose time base differs from the card's
without saying so, and "income this month 2,000 / income since January 17,000" on
one card is two scales pretending to be one.

### 9.3 Out because the data does not exist

**Market value, return percentage, and unrealised gain.** Measured rather than
assumed: no price, quantity, holding, ticker or market-value column exists
anywhere in the backend, and the card header already forbids these figures
(`makeInvestmentCard.js:12-14`). These are **not deferred indicators — they are
uncomputable** until a valuation source exists. Listing them as backlog would
imply otherwise.

### 9.4 Out because it is infrastructure this scope does not need

| not building | why |
|---|---|
| `account_balance_snapshots` or any balance-history table | the ledger derivation plus the month-end reconstruction already answer every question this plan asks |
| a generic indicator engine, metric registry runtime, or dashboard framework | the registry is **documentation and contract**, never runtime infrastructure |
| a new goals domain — service, repository, entity | Pocket is the only goal model. A second one would be the same data twice |
| a Transfer card | a transfer is a supporting fact, not a financial domain |
| rebuilding the month parameter | it exists, is validated, and rejects future months |
| recomputing the category distribution | rank, running total and cumulative share are already computed. Only the renderer is missing |

### 9.5 Out and deferred, pending a real need

- **Pocket year-to-date allocation** — only if a genuinely cross-cutting question
  justifies it. "How much did I put toward my goals this year?" is a different
  question from "how is my pocket doing this month?", and only the second has a
  home today.
- **A global pocket time series** — level 2 at the earliest.
- **Calendar-month averages** beside the active-month ones. If ever wanted, it is
  a **separate indicator with its own name**, never a redefinition of the
  existing one.

### 9.6 Out, and recorded nowhere before this plan

Named here so the omissions are decisions rather than oversights.

- **The eight zero fallbacks on the live Overview screen.** They violate the rule
  that a missing figure is a dash and never a zero, and they are real. But that
  screen is the one this work replaces, so fixing them is effort invested in code
  slated for deletion. **The rule binds the replacement.** Measured 2026-09-07:
  they are fixed on both checkouts anyway, and so is the expense guard that tested
  the income total to decide whether the expense total was a number — the comment
  at `OverviewLayout.tsx:203-204` describes it in the past tense.
- **The cleanup migration that migration `020` deferred.** It deliberately left the
  retired pocket account-type row and the legacy table in place, deferring removal
  to "a cleanup migration, last". **No such migration exists.** Out of scope here,
  but it must not be forgotten: after P2 nothing reads that table, which is
  precisely when the cleanup becomes safe.
- **The text-prefix fragility in the realised result.** Both realised-result
  figures exclude account-closure compensations by matching a description prefix
  built at `recordAnnulmentTransaction.js:40`. A financial definition that depends
  on a description string breaks the day someone edits that string. One writer
  against **four** readers — the investment figure, the monthly profit-and-loss
  figure, and twice in the transaction repository — so a change to that string
  reclassifies historical money in four places at once. Replacing it with a typed
  flag is its own work.
- **Debt aging.** Named in earlier proposals as a level-2 chart. Its semantics have
  never been defined, and a chart must not be drawn before them.
- **A dead guard in the deletion service, behind wrong fallback constants.** Those
  constants (`deleteAccountService.js:94-98`) set the profit-and-loss movement type
  to 1 — that type is 9, and 1 is expense — and invert deposit and withdraw.
  Measured on the development database, the fallback is **not** reachable while the
  catalog is healthy. The defect is the shape: the throw at `:133-141`, written to
  stop the operation when a catalog row is missing, is raised inside the `try` and
  caught by the same function's own `catch`, which returns the constants when the
  cache is null on a cold process — so the guard downgrades the operation to
  silently wrong ids in exactly the case it exists for. Belongs to the deletion
  module; recorded here because this module is where it would surface.
- **Account deletion appeared unable to complete since migration 018.** Read
  statically, not executed: that migration turned the three account foreign keys on
  the transactions table to `ON DELETE RESTRICT` and describes a deletion engine
  that detaches every reference first. Outside this scope, and worth executing once
  before it is trusted.

---

## 10. Traps already paid for

From `PLAN_OVERVIEW_RECOVERY.md` part 6 and `OVERVIEW.md` section 8, merged
2026-09-09. Recorded because each one produces **a plausible wrong number** rather
than an error.

- **The sign trap.** The legacy endpoint emits the payable leg **negative**; the
  frozen contract declares it a **positive magnitude**. Getting it backwards turns
  a subtraction into an addition and still looks reasonable. The check that catches
  it is `netWorth - liquidNetWorth == receivable`.
- **The Decimal zero trap.** Testing positivity returns true for zero, because the
  check tests the *sign* and zero is signed positive. The correct guard is a strict
  greater-than. Documented in the pocket board and in the hero builder.
- **The reconciliation trap.** Month-bounding one of the three investment
  statements and not the other two silently converts a passing check into a
  permanent failure notice.
- **The floor-before-the-sum trap.** Free cash floors the remainder **per account**
  before summing. Summing first lets one account's surplus conceal another's
  shortfall.
- **The rate granularity trap.** The shared rate helper rounds to two decimals on a
  0-1 scale — one percentage point of granularity. A rate is for display and must
  never be used to reconstruct an amount.
- **The shared-card trap.** Five cards share a shape and the sixth shares **no**
  base field. A shared component with exceptions prints undefined in four places or
  throws, and it is the failure shape that survives a review.
