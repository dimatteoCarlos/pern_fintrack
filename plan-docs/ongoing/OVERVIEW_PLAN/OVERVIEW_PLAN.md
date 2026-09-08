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

Two tracks. Nothing outside these nine files is a source.

### What to build

| file | answers |
|---|---|
| `OVERVIEW_PLAN.md` (this file) | what is done, what remains, in what order |
| `OVERVIEW.md` | what each figure measures, its formula, its null semantics |
| `OVERVIEW_LAYOUT.md` | which published field feeds each block, on which endpoint, at which depth |
| `OVERVIEW_LEVEL3.md` | which entity each domain opens, the field carrying its id, and the screen it lands on |
| `PLAN_OVERVIEW_CONTRACT.md` | the exact wire shape of the payload — consulted, not read front to back |
| `OVERVIEW_DECISIONS.md` | why a thing was decided the way it was — consulted |

### How it looks

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

## 4. What remains

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
| 7 | the level-3 links out of the level-2 rows — five domains, no new endpoint and no new figure | `OVERVIEW_LEVEL3.md` |

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

## 5. Decisions

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

## 6. Folder cleanup

Twenty files live in this folder. No code comment cites any of them — twenty
stems searched case-insensitively across `backend/src`, `frontend/src` and
`backend/test` return nothing — so deleting one breaks nothing compilable. What
it can break is a citation from another document.

**Execution belongs on `feat/overview`.** Deleting on `main` is undone by the
next merge.

### Delete now — no citation from anywhere

`OVERVIEW_FRONTEND_RENDERING_SKETCH.md`, `OVERVIEW_KPI_MAP_BY_DOMAIN.md`,
`OVERVIEW_KPI_COMPUTED_VS_DERIVABLE.md`, `OVERVIEW_PAGE_PROPOSAL_2026-09-04.md`.

The rendering sketch is measured redundant, not judged so: of its 110
identifiers, 108 appear in `OVERVIEW.md` or `OVERVIEW_LAYOUT.md`, and the two
that do not are backend function names, not fields the frontend renders.

### Delete after repointing one citation

| file | cited by |
|---|---|
| `PLAN_OVERVIEW_EVAL.md` | `OVERVIEW_DECISIONS.md` |
| `OVERVIEW_BRIEF_2026-09-04.md` | `ESTADO_PLANES.md`, twice, outside this folder |

### Merge first, delete after

Each carries something no other file does.

| file | what only it has |
|---|---|
| `PLAN_OVERVIEW.md` | section 4, the guard rules, and section 5, the contract obligations; its own header says the rest is superseded |
| `PLAN_OVERVIEW_LEVEL2.md` | the null semantics per analysis. Its second claim to uniqueness — the per-category budget variance — is void: the variance is built and published at level 1 |
| `OVERVIEW_INDICATOR_MATRIX.md` | each indicator's temporal nature, owning module and level |
| `PLAN_OVERVIEW_KPI_CATALOG.md` | the entry format of an indicator; `POCKET_MODULE_SPEC.md` cites it three times |
| `INVENTARIO_ENDPOINTS_E_INDICADORES.md` | a historical endpoint measurement, declared unmaintained |
| `benchmarking_lookUp/monthly_average_kpi_benchmark.md` | the market research behind the monthly-average window and denominator |

### Keep

The eight files of section 2, plus `PLAN_OVERVIEW_RECOVERY.md` until its
per-stage detail is folded into this file.

**The stage board was duplicated and the copy drifted.** `OVERVIEW.md` section 4
carried a second board whose contract-stage and level-2 rows both claimed
uncommitted work that was committed; the rows were corrected on 2026-09-07.
Section 3 of this file is now the board, and section 4 of `OVERVIEW.md` is the
one to remove.

---

## 7. Verification

- No figure enters a sketch without existing in the builder that publishes it.
- A missing figure renders as a skeleton or a dash, never as `0` or `NaN`.
- Every colour comes from `var(--token)`; a value with no token is asked for, never invented.
- The month picker reads the reference month from the response, not from the request.
- No level-2 figure re-aggregates rows a card already summed.
- Before deleting a document, its citations from outside this folder are repointed in the same commit.
