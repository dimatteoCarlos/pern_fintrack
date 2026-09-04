# Overview — measured brief, 2026-09-04

Written for a session starting cold on the Overview proposal. Everything here was
read out of the code on 2026-09-04, not out of a plan. It is not a design and it
decides nothing: it is the set of facts a proposal has to survive, plus the
questions that are genuinely open.

**Why it exists.** `OVERVIEW_DECISIONS.md` and `PLAN_OVERVIEW_CONTRACT.md` moved
on 2026-09-03; the level-1 sketch `bosquejo-overview-nivel-1.html` is from
2026-08-21. The proposal is being redone because of that gap.

**Author:** the backend session on the pocket module (`pern-fintrack-35`). Ask it
for anything below that needs re-measuring.

---

## Nine facts a proposal has to respect

### 1. A folded aggregate endpoint for level 1 is impossible

The domains do not share one validity window. The account transactions endpoint
answers 422 for a month earlier than the account existed; the pocket board
refuses only a month later than the current one. One request folding them would
answer 422 for the narrowest domain and take the other four down with it.

**Consequence:** level 1 is several requests, and with five domains on one screen
the three fetch states become the main design problem rather than a detail.

### 2. The expense distribution charts are already built and routed

`overview_services/core/makeCategoryBreakdown.js` serves **one array for both the
donut and the Pareto** — one and not two, so the two charts read literally the
same rows. It ranks by spend descending with the category name breaking the tie,
so the rank cannot change between identical requests, and it carries the running
total and running share. A category holding more than one currency carries a null
amount, ranks last and contributes zero.

`overviewExpenseService.js:132` returns it, and `GET /api/fintrack/overview/:domain`
already routes it with month validation.

**The open question this leaves:** the developer has not decided whether these
charts live in a new "dashboard" environment, in Overview level 1, or inside the
expenses domain. The backend cost is zero in all three. **This is the first
question the proposal should answer.**

### 3. The pocket level counts are served, and there are now seven

Changed on 2026-09-04. The board's fold serves `levelCounts` with seven keys:
`completed`, `aboveTarget`, `ahead`, `onTrack`, `behind`, `atRisk`, `overdue`.

**`aheadCount` no longer exists** — it was retired because being at or above the
plan's line is algebraically the same condition as the pace ratio being at or
below 1, so it had become a level count minus a rounding. `totalAheadOfPlan` is
now bounded to the pockets reading `ahead`.

Any status strip in Overview that borrows the board's vocabulary borrows seven
words, not five. The full definition is `PLAN_POCKET/POCKET_LEVELS_REFERENCE.md`.

### 4. Overview's view of pockets is NOT the pocket module's

`makeFinancialGoals.js` says so in its own header: it answers a different
question — across every goal, how much is saved and how much is left. It also
carries a notice for no goal set, one for partial coverage, and the rule that a
target of 0.00 is excluded from the total.

Do not merge it with the board's reading or reuse the board's words for it.

### 5. Investment is deliberately outside the shared card shape

`makeDomainCard.js` declares once "the shape Income, Expense, Debt, Pocket and
PnL share", and excludes Investment explicitly, because five figures are not a
total, a count and a delta.

A mockup painting Investment with the same card as the other five contradicts the
code. It also carries a no-prior-period notice, and whether a prior period exists
is keyed on the age of the account, not on whether transactions occurred.

### 6. No handler accepts the current month

The current month is resolved on the server, on the owner's calendar. A past
month does travel. A month later than the current one is refused with **422 and
not 400**, through `resolveWindowOr422` (`overviewController.js:98-112`), shared
by both handlers on purpose — two handlers each holding their own copy of "later
than the current month" would be two places to fix it.

### 7. The debtor inactivity rule does not exist anywhere in the code

There is no `debt_services` directory and no constant of days for it. The only
`daysSince…` figure in the codebase is the investment card's days since the last
contribution.

If the August sketch shows anything like "60 days without movement", it is
inventing a rule. Remove it, or propose it explicitly as something to build — and
if it is proposed, say whether it is a fixed constant or a named band the way the
pocket levels are, because that question was raised and never answered.

### 8. Uncategorized spend is orphaned history, not ordinary spend

An expense's destination **is** a category account, so one cannot be recorded
without a category — `transactionController.js:516-532` rejects a write whose
destination does not resolve to one. The gap appears only when a category was
deleted or lost its budget row.

`makeExpenseCard.js` carries two spend figures on purpose and they are not the
same universe: the total is every expense leg of the period, while the budgeted
and categorized figures only count legs that still resolve to a live category.
The repository comment is explicit that deleted category accounts are included
precisely so this can be revealed.

**On a healthy dataset the amount is zero.** A non-zero value is a data-integrity
signal, not a spending category. Deciding whether it gets its own slice of the
donut or stays a notice is open; painting it as one more category is wrong either
way.

### 9. Three fetch states stay distinct, and a missing figure is a dash

Skeleton, error with retry, and empty are three different things. A figure the
server withheld renders as a dash, never as `0` or `NaN`. With five domains on one
screen this is the hard part of level 1.

---

## Fact 10, added 2026-09-04 — the backend is merged, and nobody calls it

The nine facts above were measured against code. This one was missed, and it
reframes the other nine: **`feat/overview` is not an unmerged branch any more.**

It reached `main` on 2026-09-02 in the merge `d5693f1d`, and from there the
current working branch. Its head `1fb66b9` is an ancestor of `HEAD` and
`git log feat/overview ^HEAD` returns nothing — **zero unmerged commits**. Both
routes are mounted (`overviewRoutes.js:17` and `:21`) and all six domains have a
calculator (`overviewController.js:49-56`).

**And the whole payload reaches nobody.** No frontend file calls either route:
every `fintrack/overview` string in `frontend/src` is a React Router navigation
path, not an API URL. The screen at that route still issues the thirteen legacy
dashboard requests of `Overview.tsx:76-108` and the five reads of
`OverviewLayout.tsx`, and still adds three currencies with no conversion
(`OverviewLayout.tsx:134-135`) and paints one indicator from `Math.random()`
(`MonthlyAverage.tsx:144`).

**Why this changes the shape of the work.** Level 1 is not blocked on backend
figures — it is blocked on having a screen. Seven of the eight blocks proposed
below are served today. What the merge also shipped is the defect: the saving
goals query still reads the retired pocket model
(`overviewPageRepository.js:56-58`) over a table migration `020` emptied on
purpose, so it reports nothing saved and no goal set without raising an error.
**The first request level 1 makes is what makes that visible**, which is why
rewriting it is the first backend task and not a later one.

**Two more pieces of the frozen contract are declared and not served**, found the
same day: the two legs of the debt position with the count of settled debtors
(the debt calculator delegates to the shared stock reader and produces neither —
`overviewDebtService.js:37-39`), and the year-to-date expense distribution by
category (the page publishes two chart keys, not three —
`overviewPageService.js:183-190`).

---

## What is stale and what is current

| document | last moved | trust |
| --- | --- | --- |
| `OVERVIEW_DECISIONS.md` | 2026-09-04 | **current, and it is now the register of open decisions for the whole folder** |
| `INVENTARIO_ENDPOINTS_E_INDICADORES.md` | 2026-09-04 | **current, and it rules on what the code does today** |
| `PLAN_OVERVIEW_CONTRACT.md` | 2026-09-04 | current for shapes; three entries marked as declared-and-unserved |
| `PLAN_OVERVIEW.md` | 2026-09-03 | current for the target architecture; its measured terrain is a photograph of the legacy screen and still accurate |
| `PLAN_OVERVIEW_EVAL.md` | 2026-09-03 | **historical.** It audits the plan as it stood on 2026-08-20; its verdicts were absorbed |
| `PLAN_OVERVIEW_KPI_CATALOG.md` | 2026-09-03 | current for formulas; superseded wherever a decision moved a figure |
| `bosquejo-overview-nivel-1.html` | **2026-08-21** | **the thing being redone** |
| `propuesta-pareto-gasto.html`, `propuesta-snapshot-mensual.html` | 2026-08-21 | same vintage, re-read before reusing |

~~**One live defect, unrelated to the proposal:** the shipped Overview still reads
the retired pocket model.~~ **Corrected 2026-09-04:** the shipped *screen* stopped
reading it when the saving-goals component was deleted; what reads it is the
merged *backend*, served and unconsumed. See fact 10.

---

## The map of this folder — six documents, which question each one owns

Written 2026-09-04. **Read them in this order**, and where two disagree the
"ruled by" column says which wins and why.

| document | the question it owns | current | superseded or duplicated | ruled by |
| --- | --- | --- | --- | --- |
| **`INVENTARIO_ENDPOINTS_E_INDICADORES.md`** (24 KB) | *What does the code compute today, and what does Overview ask for that nobody computes?* | Yes — the only document written by measurement first and plan second, and the only one that separates a missing figure from a wrong one | Its branch framing was wrong until today: it described a second worktree that no longer matters | **It rules on what exists.** Where a plan claims a field is served and this file says it is not, this file wins — it was read from code |
| **`OVERVIEW_DECISIONS.md`** (100 KB) | *What has been decided, by whom, on what date, and why?* | Yes, and it is the largest document because it carries the reasoning, not just the verdict | Its status table still describes phases 0-3 as if the code were unwritten. Its "Overview comes last" block reasons about a branch that has merged — marked in place | **It rules on every decision.** A formula in the catalog that a decision later moved is superseded by the decision, not the other way round |
| **`PLAN_OVERVIEW_CONTRACT.md`** (40 KB) | *What exact shape travels over the wire — every field, its type and its nullability?* | Yes for shapes | Three things it declares are not served, all marked in place: the two debt legs, the settled-debtor count, and the year-to-date distribution | **It rules on the wire shape.** But a type it declares is not evidence the field exists — the inventory rules on that |
| **`PLAN_OVERVIEW_KPI_CATALOG.md`** (46 KB) | *What is each indicator, in a formula, with its null rule and its currency behaviour?* | Yes for formulas | **Superseded in four places by decisions taken after it**, and it says so itself: the income leg was inverted, the change for a stock domain spanned two months instead of one, the count of movements inherited the total's filter, and the whole pocket block was replaced when a pocket stopped being an account. Its replacement sections for pocket and savings are the live text | The decisions register. Where the catalog and a decision disagree, the decision is newer by construction |
| **`PLAN_OVERVIEW.md`** (48 KB) | *What is wrong with the shipped screen, what replaces it, and what rules may never be broken?* | Yes for the four guard rules and the target architecture | Its request counts and anchors were corrected once on 2026-08-30 and hold today: thirteen requests, three currencies added without conversion, one random indicator. **Duplicates the decisions register**: its open-decision table restates five decisions that live there too | The decisions register, for anything that is a decision. This file rules on the **guard rules** — every financial figure is computed on the server, one indicator has one formula and one implementation, currency is converted before aggregating and only server-side, and the page is a read model rather than a request aggregator |
| **`PLAN_OVERVIEW_EVAL.md`** (47 KB) | *Was the plan accurate when it was written?* | **Historical.** It is an audit of the plan as of 2026-08-20 | Almost entirely absorbed: its verdicts became decisions, and its open-decision table is a third copy of the same five | Nothing reads it for a current fact. Keep it for the reasoning behind why a plan claim was accepted or rejected |

**Where two documents answer the same question differently, and who wins:**

| the question | the disagreement | which rules |
| --- | --- | --- |
| Is the Overview backend available? | Four documents say it lives only on an unmerged branch; the code says it is on the working branch | **The code.** All four corrected 2026-09-04 |
| Are the debt legs and the settled-debtor count served? | The contract declares them and the inventory listed them as computed today; neither is in the code | **The code.** Both files corrected; the fields moved to the decided-and-unbuilt list |
| How is the shortfall across saving goals summed? | The pocket board clips each goal before summing and ships the excess separately, so an overfunded goal cannot cancel an underfunded one; Overview subtracts flat and lets a met goal reduce the total. Both are argued in writing and both are in the code | **Neither — this is a genuine open decision** and it is in the consolidated register. The two answer different questions; what cannot stand is both being labelled the same word on screen |
| How many pocket levels are there? | Documents written before 2026-09-04 say five or six | **Seven**, defined in `PLAN_POCKET/POCKET_LEVELS_REFERENCE.md`. Corrected where the Overview folder repeated it |
| Which branch wins the saving-goals component? | The register treats it as an open question | **Closed by the merge:** the component does not exist in the repository. Level 1 builds it or does without |

**Where the open decisions now live: one place.** They used to be spread across
six files, several in two wordings. They are consolidated at the end of
`OVERVIEW_DECISIONS.md`, grouped by what each one blocks — the ones that stop the
first screen, the ones that are decided and merely unbuilt, the ones that only
touch the styling phase, and the ones a measurement closed without a decision.

---

## The open questions, none of them settled

1. Where the expense distribution charts live — a new dashboard environment,
   level 1, or inside the expenses domain.
2. Whether uncategorized spend is a slice or a notice.
3. Whether a debtor inactivity rule is built at all, and if so whether it is a
   constant or a named band.
4. What level 1 actually shows. **The developer stated on 2026-09-03 that the
   Overview design is still open**, and nothing since has closed it.

> **All four now have one recommendation each, written 2026-09-04, awaiting the
> developer.** They are in `OVERVIEW_DECISIONS.md` under *the four questions of
> the 2026-09-04 brief*, each with its reasoning and its backend cost. In short,
> and in the order above:
>
> 1. **The charts stay in level 1**, as their own section below the cards, not in
>    a new environment and not hidden inside the expense domain. **Backend cost:
>    zero** — the rows already travel in the page payload, one array feeding both
>    charts so they cannot disagree.
> 2. **Uncategorized spend is a notice, never a slice.** It is orphaned history,
>    not a spending category: an expense cannot be recorded without a category, so
>    a non-zero figure means a category was deleted. On healthy data it is zero.
>    **Backend cost: zero** — the flag and the sentence already ship on the card.
> 3. **No debtor inactivity rule is built.** It exists nowhere in the code, and
>    the question that would decide its cost — a fixed constant or a named band —
>    was raised and never answered; a named band is a classification, and the
>    pocket module just paid that price over weeks. **What is recommended instead
>    is already decided and unbuilt:** the count of counterparties settled at the
>    month's close, which answers a neighbouring question and invents nothing.
> 4. **Level 1 is eight blocks**, none of them a chart inside a card, and **no
>    month selector** until net worth reads on one time base. **Seven of the eight
>    cost nothing** — they are served today. The eighth, saving goals, costs the
>    rewrite that heads the unbuilt list. The blocks are listed in the register,
>    and the navigable mockup is
>    `plan-docs/design-refs/overview-level-1/overview-level-1.html`.

## Working rules in force

- Mockups are standalone HTML in `plan-docs/design-refs/`, opened in a browser,
  never an artifact.
- The design is decided first; missing tokens are agreed after and are never a
  blocker.
- No commits and no gates while the refactor is in the design phase.
- The pocket module is being finished in parallel by another session. **Do not
  touch `frontend/src/fintrack/pages/pocket/**`, the pocket stores, types or
  helpers** — that tree is owned by the session working on it right now.

---

## The mandate — set by the developer, 2026-09-04

Three things, in this order. The proposal is the last of them, not the first.

### 1. Organise the information

The six documents in this folder total roughly 260 KB and were written across
three weeks. Before proposing anything, establish what they actually say and
where they contradict each other or the code.

What to produce: **one map of the folder** — for each document, what question it
owns, what is current, what is superseded, and what is duplicated somewhere else.
Where two documents answer the same question differently, name which one rules
and say why. A statement about the code that no longer holds is a measurement
that aged, not a decision that changed, and it gets corrected in place on
discovery rather than left with a note beside it.

**The nine facts above are the measuring stick** for anything the documents claim
about the backend. Where a plan disagrees with them, the code wins and the plan
is corrected.

### 2. Update the plans

Correct the documents themselves — do not write a separate errata. Specifically:

- Every claim about a served field, an endpoint or a validity window, checked
  against the code and fixed where wrong.
- The pocket-derived material, which changed on 2026-09-04: seven levels,
  `aheadCount` gone, `totalAheadOfPlan` narrowed.
- The open decisions, gathered into one place instead of scattered across six
  files, each with what it blocks.

Plan documents in `ongoing/` need no approval gate to edit. The commit gates are
suspended for the whole refactor.

### 3. Then the proposal, with a mockup of level 1

**Level 1 is the minimum.** More levels are welcome if the ground supports them,
but the first screen is what is being asked for.

The proposal answers the four open questions at the end of the section above, and
it answers them with a recommendation each — not an unranked list of options.
Where the recommendation costs backend work, say how much; where it costs none,
say so, because two of the four cost nothing.

### How to report

The developer reads chat, not documents, for decisions. Lead with the decision or
the problem, name the exact file and line, and give one recommendation where
there is a choice. State what a thing IS in words before naming any identifier —
a section number or a code means nothing without the document open. All documents
and code comments in English; the chat follows the developer.
