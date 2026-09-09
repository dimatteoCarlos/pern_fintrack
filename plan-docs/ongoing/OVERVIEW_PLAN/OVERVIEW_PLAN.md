# OVERVIEW — plan of record

**Written 2026-09-07. This is the single plan for the Overview module.** Every
state below was measured in the code of `feat/overview`, not read from another
plan. Where a figure is named, it is the identifier the payload publishes.

It supersedes the stage sequencing of `PLAN_OVERVIEW_RECOVERY.md` and the
open-decision tables of `PLAN_OVERVIEW_LEVEL2.md` and `OVERVIEW.md` section 7,
all three of which had drifted from the code. It does **not** supersede the two
companion documents that carry the semantics and the layout, nor the frozen
payload contract. Section 2 says exactly which file answers which question.

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

Two tracks. Nothing outside these eleven files is a source.

### What to build

| file | answers |
|---|---|
| `OVERVIEW_PLAN.md` (this file) | what is done, what remains, in what order |
| `OVERVIEW.md` | what each figure measures, its formula, its null semantics |
| `OVERVIEW_INDICATORS.md` | the vocabulary the formulas are written in, and every indicator with its temporal nature, owning module, level and state |
| `OVERVIEW_LAYOUT.md` | which published field feeds each block, on which endpoint, at which depth |
| `OVERVIEW_LEVEL3.md` | which entity each domain opens, the field carrying its id, and the screen it lands on |
| `PLAN_OVERVIEW_CONTRACT.md` | the exact wire shape of the payload — consulted, not read front to back |
| `OVERVIEW_DECISIONS.md` | why a thing was decided the way it was — consulted |
| `OVERVIEW_CHART_TECHNIQUE.md` | how a chart is drawn in this module, taken off the one that ships |

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

### Keep

The files of section 2, plus:

| file | why it stays |
|---|---|
| `OVERVIEW_INDICATORS.md` | the indicator reference, written 2026-09-09 |
| `OVERVIEW_CHART_TECHNIQUE.md` | how a chart is drawn here, taken off the one that ships |
| `PLAN_OVERVIEW_LEVEL2.md` | the level-2 specification, and level 2 is the stage being built |
| `OVERVIEW_LEVEL3.md` | the level-3 navigation specification |
| `OVERVIEW_P5_FROZEN_DECISIONS.md` | the developer's own rulings for the frontend stage |
| `benchmarking_lookUp/monthly_average_kpi_benchmark.md` | primary research. Its conclusion is inside D14, so nothing needs to open it, and deleting a survey to save one file is poor value |
| `PLAN_OVERVIEW_RECOVERY.md` | **until its per-stage detail is compared against section 3 here, line by line.** Section 3 is the board; what that file holds beyond it has not been enumerated, and deleting it before that comparison is how a rule gets lost |

**The stage board was duplicated and the copy drifted.** `OVERVIEW.md` section 4
carried a second board whose contract-stage and level-2 rows both claimed
uncommitted work that was committed; the rows were corrected on 2026-09-07.
Section 3 of this file is now the board, and section 4 of `OVERVIEW.md` is the
one to remove.

---

## 8. Verification

- No figure enters a sketch without existing in the builder that publishes it.
- A missing figure renders as a skeleton or a dash, never as `0` or `NaN`.
- Every colour comes from `var(--token)`; a value with no token is asked for, never invented.
- The month picker reads the reference month from the response, not from the request.
- No level-2 figure re-aggregates rows a card already summed.
- Before deleting a document, its citations from outside this folder are repointed in the same commit.
