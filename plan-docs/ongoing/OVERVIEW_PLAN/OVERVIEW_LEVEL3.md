# OVERVIEW — level 3, the entity depth

**Written 2026-09-08.** Every state below was measured in the code of `main`,
both stacks, not read from another plan. Where a field is named, it is the
identifier the payload publishes or the route parameter the screen reads.

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

**Level 3 needs no new Overview endpoint and no new Overview figure.** It is
navigation over fields already published, into screens that already exist.

---

## 2. The six domains — entity, route key, destination

| domain | the entity | route key published today | destination screen | state |
|---|---|---|---|---|
| debt | one counterparty, a `debtor` account | `analysis.byCounterparty[].accountId` | `pages/forms/debtorDetail` | **routable** |
| investment | one investment account | `analysis.balanceByAccount[].accountId` | `pages/forms/accountDetail` | **routable** |
| income | one income source | `analysis.bySource[].accountId` | `pages/forms/accountDetail` | **routable, with one null case** |
| pocket | one pocket | `pocketId` on the board rows carried through `analysis.progressByPocket` | `pages/forms/pocketDetail` | **routable** |
| expense | one category | `charts.expenseCategories[].categoryName` | `pages/forms/categoryDetail` | **routable by name** |
| profit and loss | **none** | — | — | **no level 3 exists** |

### The null case in income

`makeIncomeAnalysis.js:61` pushes a notice when any source row carries
`accountId === null`. That row is income with no source account attributed to
it, and it is a real part of the distribution — it has an amount and a share.
It is the one level-2 row that must render without a link, and the frontend
branches on the id being null rather than on the notice.

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

### Why profit and loss has no level 3

Its `analysis.byAccountType` is a two-part split — `investment` and `other` —
and neither part is an entity. The domain is a **movement type**, not a set of
accounts: `makePnlAnalysis.js` partitions one sum by where the rows landed, so
the parts are groupings of accounts of different types and there is nothing
single to open. A user following the investment part arrives at the investment
domain, which has its own level 3.

---

## 3. What the frontend has to do, per domain

One rule, six applications: the level-2 row carries its own identity, and the
component reads the identity from the row rather than reconstructing it.

| domain | the link the row renders |
|---|---|
| debt | the debtor screen, keyed on `accountId` |
| investment | the account screen, keyed on `accountId` |
| income | the account screen, keyed on `accountId`; **no link when `accountId` is null** |
| pocket | the pocket screen, keyed on `pocketId` |
| expense | `/fintrack/budget/category/:categoryName` |
| profit and loss | nothing — the rows are not entities |

**The destination is another module's screen, so Overview does not restyle it.**
Level 3 is a link out. Whatever the target screen looks like is that module's
decision, and a level-3 commit that changes the target screen has left Overview.

---

## 4. What this file does not resolve

| item | why it is not level-3 work |
|---|---|
| the four route paths | the destination folders exist under `frontend/src/fintrack/pages/forms/`; the live URL of each has to be read from `App.tsx` when the link is wired, not assumed from the folder name |
| the investment transaction count | it was a level-1 defect, not level-3 work, and it is fixed: the card carries `transactionCount` and the page sums six counts |
| the mockup for the six level-2 screens | still absent, and level 3 cannot be drawn before the row it hangs off is |

---

## 5. Verification

- Every routable domain names the **field** carrying the id, not the concept.
- No level-3 link is wired against a folder name; the path comes from `App.tsx`.
- The income row with a null `accountId` renders as a row and not as a link.
- No figure is computed in Overview for a level-3 screen. If one is needed, it
  belongs to the owning module and this file is the wrong place for it.
