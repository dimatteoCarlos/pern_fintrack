# OVERVIEW — level 3, the entity depth

**Written 2026-09-08.** Every state below was measured in the code of `main`,
both stacks, not read from another plan. Where a field is named, it is the
identifier the payload publishes or the route parameter the screen reads.

**This is a P5 document, not a gate.** It specifies navigation wiring. It does
not sit on the critical path of the stages that fix the figures, and nothing in
P0 through P4 waits on it.

This file exists because `OVERVIEW_PLAN.md` carried a single row saying level 3
was "not Overview". That row conflated two different things — who computes the
entity figures, and who navigates to them — and only the first is true.

---

## 1. What level 3 is, and which half belongs to Overview

Level 3 answers **what explains this entity**: one debtor, one investment
account, one pocket, one category, one income source.

| half | owner |
|---|---|
| computing the entity's figures | the owning module — Budget, Pocket, and the account screens |
| **routing from a level-2 row to that entity** | **Overview** |

Overview owns the second half because the level-2 row is where the user decides
which entity to open, and the row is Overview's payload. A level-2 breakdown
whose rows cannot be opened is a ranking the user can read and not act on.

**Level 3 requires no new Overview calculation and no entity endpoint.** It
consumes identity fields already present in the level-2 payload and navigates to
the owning module's existing screen. This is a statement about level 3 and not a
rule against Overview endpoints in general — the activity view has its own
endpoint, for reasons that have nothing to do with this depth.

---

## 2. The six Overview domains — five have entity navigation, profit and loss does not

| domain | level-2 source | identity field | route source | target screen |
|---|---|---|---|---|
| debt | `analysis.byCounterparty[]` | `accountId` | `App.tsx` | debtor detail |
| investment | `analysis.balanceByAccount[]` | `accountId` | `App.tsx` | account detail |
| income | `analysis.bySource[]` | `accountId`, nullable | `App.tsx` | account detail |
| pocket | `analysis.progressByPocket[]` | `pocketId` | `App.tsx` | pocket detail |
| expense | `charts.expenseCategories[]` | `categoryName` | `App.tsx` | category detail |
| profit and loss | `analysis.byAccountType` | — | — | — |

The destination folders exist under `frontend/src/fintrack/pages/forms/`:
`debtorDetail`, `accountDetail`, `pocketDetail`, `categoryDetail`.

### The null case in income

`makeIncomeAnalysis.js:61` pushes a notice when any source row carries
`accountId === null`. That row is income with no source account attributed to
it, and it is a real part of the distribution — it has an amount and a share.

**A null id means a valid row that is not navigable.** It is not an error, and
no id is to be invented for it. It is the one level-2 row that renders without a
link, and the component branches on the id being null rather than on the notice.

### Pocket — the id is a pocket id and is never converted

Measured, because this module has a history of confusing the two: the board row
carries `pocketId` and nothing derives it from an account. `makePocketStatus.js`
validates it as an integer at :96-98 and throws rather than coerce, publishes it
at :139, and `pocketBoardService.js:419-422` spreads that object into every board
row, which is what `progressByPocket` passes through.

**Acceptance test for P5:** every pocket level-2 row renders its link directly
from the published `pocketId`. No account id conversion is performed, and no
lookup runs between the row and the URL.

### Why expense routes by name and not by id

A category in this schema is not a row — it is a **name shared by N
`category_budget` accounts**. `budgetCalculationService.js:261-268` groups the
account rows by `categoryName` and publishes `accountCount` as the size of the
group, discarding the ids.

That is enough to navigate. `App.tsx:405` declares
`budget/category/:categoryName`, and `CategoryAccountList.tsx:86` resolves the
category by comparing `account.categoryName === categoryName` against the live
account list. The name travels in the same lowercased form on both sides —
migration 013 lowercased the stored values, and both readers read that column.

The deeper route, `App.tsx:417`
`budget/category/:categoryName/account/:accountId`, opens one account, and
`CategoryDetail.tsx:69-75` refuses to render without `accountId`. Overview
cannot address it directly, so a category with exactly one account still lands
on a list holding one row.

**That extra step is accepted and not a gap.** Publishing an `accountIds` array
on the category rows would remove it, and it is not worth a change to a builder
three modules away for one click on a screen that already works.

### The category name is navigation identity, not display text

Because the name is the route parameter, it carries an obligation the other five
identity fields do not: it has to survive being placed in a URL segment.

**Measured, it is not encoded today.** The two existing builders interpolate it
raw — `CategoryDetail.tsx:86` and `CategoryDetailReading.tsx:89` both write
`` `/fintrack/budget/category/${categoryName}` `` — and the only
`encodeURIComponent` in the whole frontend is `urlConfig.ts:258`, on a month.
Migration 013 lowercases the stored name but restricts no character, so a name
holding `/`, `#` or `?` breaks the route.

**Overview encodes what it puts in a URL segment and decodes what it reads back.**
This is not a request to change the two existing screens; it is the rule for the
link Overview builds, so a new consumer does not inherit an unstated assumption
that category names are already route-safe.

### Why profit and loss has no level 3

Its `analysis.byAccountType` is a two-part split — `investment` and `other` —
and neither part is an entity. The domain is a **movement type**, not a set of
accounts: `makePnlAnalysis.js` partitions one sum by where the rows landed, so
the parts are groupings of accounts of different types and there is nothing
single to open.

**A movement having landed in an account does not make the split a list of
entities.** No `profit and loss → account` navigation is to be fabricated for
symmetry with the other five. A user following the investment part arrives at the
investment domain, which has its own level 3.

---

## 3. How the navigation is built

One rule, five applications: **the level-2 row carries its own identity, and the
component reads the identity from the row rather than reconstructing it.**

What that rules out is a component that takes a name off the row, searches the
account list for a match, and builds the route from what it found — when the
backend already published the id.

**The destination URL is derived directly from the row at the point of
navigation.** It is not held in a store and not duplicated in local state:
there is no selected-entity state to keep, because the row that was clicked is
the only input the URL needs. A click that sets an id, runs an effect, performs a
lookup and then navigates is four steps replacing one.

**The destination is another module's screen, so Overview does not restyle it.**
Level 3 is a link out. Whatever the target screen looks like is that module's
decision, and a level-3 commit that changes the target screen has left Overview.

---

## 4. What can start now and what waits

The two halves separate cleanly, and only the second one waits on anything.

| half | state |
|---|---|
| **technical wiring** — reading the identity off the row, building the URL, navigating, and the tests that hold each link | **can start now.** The payload, the identity field, the destination and the route are all known |
| **visual treatment** — how a navigable row reads as navigable, its hover and focus states, where the affordance sits in the row | **waits on the level-2 mockup**, which does not exist. A row's link cannot be styled before the row is |

**Route paths are implementation inputs, not open decisions.** Read each one from
`App.tsx` when wiring the link; never infer it from the destination folder name.
There is no product decision here and no research pending.

---

## 5. Verification

- Every routable domain names the **field** carrying the id, not the concept.
- No level-3 link is wired against a folder name; the path comes from `App.tsx`.
- The income row with a null `accountId` renders as a row and not as a link.
- The pocket link is built from `pocketId` with no account id in the path.
- The category name is encoded into the URL segment and decoded out of it.
- No figure is computed in Overview for a level-3 screen. If one is needed, it
  belongs to the owning module and this file is the wrong place for it.
