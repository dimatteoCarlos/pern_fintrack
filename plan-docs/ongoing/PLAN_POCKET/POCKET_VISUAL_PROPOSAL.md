# POCKET — THE VISUAL PROPOSAL, VERIFIED AGAINST WHAT THE SERVER ACTUALLY SENDS

> **OBSOLETE, 2026-09-05.** Its central open question, "Pocket or Goal" (§5.4),
> was closed the same day by `POCKET_DECISIONS.md` §21, which goes further than
> this document's own recommendation. Its visual/token proposals are superseded
> by the shipped `PocketBigBoxResult.tsx`, `PocketCard.tsx`, `pocket-styles.css`
> and by the newer mockup `plan-docs/design-refs/pocket-hero/schedule-bar.html`.

**Measured 2026-08-29 on `fix/auth-screen`, HEAD `610e399` *"feat(budget): open
the editor from the category card"*. Lives in `plan-docs/ongoing/`, which
`.gitignore:123` re-includes: this file is versioned. No file under `frontend/` or `backend/` was
modified, nothing was staged, nothing was committed.**

The proposal under review is the developer's own, quoted in the brief. It is
design intent, not a specification. This document answers one question about
every element of it: **is the data behind it served, derivable, absent, or in
conflict with the model the module froze.**

Every field name below was read from the builder that emits it, not from
`POCKET_CONTRACT_AUDIT.md`, not from `PLAN_POCKET_FE.md`, and not from the brief.
Where a document and the code disagreed, the code is what is written here.

---

## 0. The three sources that disagreed, before anything else

Three conflicts surfaced during verification. Each is resolved the same way — the
specification wins over the reference image, and the code wins over both — and
each is named here rather than quietly absorbed.

| Conflict | Reference says | Code or specification says | Resolution |
|---|---|---|---|
| The board card's surface | `referencia_pocket_01.jpeg` draws dark cards on a dark page; `referencia_pocket_02.jpeg` draws the whole module on white | `tokens.css:29-31` declares `--color-surface-deep` with the comment *"The board cards use it"*, and `pocket-styles.css:48,61` already consumes it | The board card is `--color-surface-deep`, the detail hero is the cream panel. The two references disagree with each other, so neither can arbitrate |
| The source picker's third figure | `referencia_pocket_01.jpeg` labels it **"Free: $1,500"** | `makeAccountAllocation.js:12-19` states in the source that the figure is never called *available*, because a pocket blocks no spend | The word is **unassigned cash**. *Free* is the same claim *available* makes, one synonym away |
| A note on a money movement | `referencia_pocket_01.jpeg` draws a **Note (optional)** textarea inside the allocate modal | `pocket_allocations` has no note column (`020_create_pocket_tables.sql:143-167`) and `allocationBodySchema` is `.strict()` over four keys (`pocketValidators.js:126-138`) | Not storable. A migration plus a validator change, not a design decision |

`FRONTEND_VISUAL_SYSTEM.md` carries its own superseded banner and points at
`plan-docs/REMARKS.md` as the live register. It was read for its measurements,
not scheduled from. `PLAN_STYLE_SYSTEM_V2.md` is the current state of the token
migration and is what the token map at §3 is written against.

> ## CORRECTION 2026-08-30 — the classification survives, the "against what
> exists" half does not
>
> **§1's verdicts — supported, derivable, not served, contradicts — were
> re-checked against the builders that emit each field and none of them moved.**
> The board and the detail were rebuilt the same day this was written, so what
> aged is every statement about what the screens currently draw:
>
> - the edit control on the detail is live (`PocketEditLink.tsx`, route slot
>   `App.tsx:352`), so §1.8's *"not served on the frontend"* verdict is spent;
> - the two field-length disagreements of §1.9 and §5.5 are gone —
>   `nameMaxLengths.ts:20` reads `pocket_name: 50` and `:16` reads `note: 155`;
> - the creation form sends a `YYYY-MM-DD` label, not a JS `Date`;
> - the detail's `<p>Loading...</p>` and its retry-less error paragraph are gone,
>   and so is the transaction statement under it;
> - most of §4's *New* and *Replaces* rows have been built.
>
> **Two things this document decided are now visible in the code and are recorded
> as measurements, not as closures:** the progress indicator is a bar in both
> places (§5.3), and the object is called a **Pocket** with *target* — not *goal*
> — naming the figure, which `POCKET_DECISIONS.md` §21 ruled on the same day and
> which tightens §5.4 rather than answering it.

---

## 1. THE CLASSIFICATION — every element of the proposal, four ways

**Supported** — the server sends it; the field and its builder are named.
**Derivable** — not sent, computable from what is, inventing nothing; the source
is named. **Not served** — it is a backend requirement, stated as one.
**Contradicts** — the element would assert something the module denies.

Totals: **31 supported · 8 derivable · 6 not served · 4 contradicting.**

### 1.1 The board header — four summary tiles

| Proposal | Verdict | Evidence |
|---|---|---|
| TOTAL ALLOCATED `$8,800.00` | **Supported** | `summary.totalAllocated`, folded at `pocketBoardService.js:153`. **Null on an empty board and null on a mixed-currency board** (`:109`, `:118`, `:124`) — those two cases render a dash and the notice, never `$0.00` |
| ACTIVE GOALS `3 of 5` | **Derivable, and flagged** | `pocketCount` and `fundedCount` are served (`pocketBoardService.js:102-103`). **No `activeCount` exists.** *Active* is `!funded && !overdue` per row (`makePocketStatus.js:128-129`), so the count can be folded on the client — but the board service's own header (`:14-17`) states that a count the client repeats from the same rows is a second answer to the same question, and that the header disagreeing with the list under it is the defect this module already had. See the recommendation at §5.1 |
| NEXT GOAL `Emergency Fund · 72%`, target date `31 Dec 2026` | **Derivable** | Rows arrive ordered `desired_date ASC, name ASC` (`pocketRepository.js:78`), so the next goal is the first row whose `funded` is false. `progress` (`makePocketStatus.js:120`) and `desiredDate` (`:121`) are that row's own served fields. This is a **selection**, not a recomputation — nothing is invented |
| TOTAL PROGRESS bar `58%` | **Supported** | `summary.overallProgress`, `pocketBoardService.js:157`. Coverage, `SUM(MIN(allocated, target)) / SUM(target)`, capped at 100 by construction — the component must not clamp it a second time. Null on the same two boards as above |

### 1.2 The board filter row

| Proposal | Verdict | Evidence |
|---|---|---|
| `All (5)` | **Supported** | `summary.pocketCount`, `pocketBoardService.js:102` |
| `Active (3)` | **Derivable** | `!funded && !overdue` per row. The count itself is the flagged case above |
| `Upcoming (1)` | **Not served, and undefinable** | Nothing in `makePocketStatus.js:109-132` distinguishes *upcoming* from *active*. Defining it would mean inventing a horizon — thirty days? sixty? — and no token, constant or column states one. **This is the one filter that cannot be built without a decision that does not exist yet** |
| `Completed` | **Supported under another name** | The served concept is `funded`, `makePocketStatus.js:128`. *Completed* is vocabulary drift: a pocket whose target is met is not finished, the money is still committed and can still be released |
| `Overdue` | **Supported** | `overdue`, `makePocketStatus.js:129` — past the date **and** short of target, both conditions |
| *(absent from the proposal)* `Uncovered` | **Served and dropped** | `uncovered`, attached at `pocketBoardService.js:178` from `findUncoveredPockets` (`:52-66`), and folded as `uncoveredCount` at `:105`. It is the one board state the proposal has no chip for, and it is the one that reports a real problem: a source account no longer covers what is committed to it |
| Sort control `Date` | **Supported** | `desiredDate` is the arrival order; `name` and `remaining` are on every row, so all three sorts are client-side and **the board never grows a query parameter** |

> **CORRECTED 2026-08-30 — the *Upcoming* row's evidence has moved: a horizon now
> exists.** `frontend/src/fintrack/helpers/pocketStatus.ts:24` declares
> `POCKET_AT_RISK_DAYS = 30`, fixed by the developer as a business rule with the
> reason written beside it — one income cycle, so a square that turns amber still
> leaves one salary to close the gap. `pocketDateLevel` (`:71-95`) splits what is
> neither funded nor overdue into **at risk** at or under that horizon and **on
> plan** above it, and the board reads both (`ListPocket.tsx:176`,
> `PocketBigBoxResult.tsx:50-70`). So the state this row calls undefinable is
> defined and rendered; what is still true is that **the server folds no count of
> it** — `makeSummary` (`pocketBoardService.js:100-106`) serves `pocketCount`,
> `fundedCount`, `overdueCount` and `uncoveredCount` and nothing else, so a chip
> carrying that count would still be a client fold beside four server figures,
> which is what §5.1 objects to.

### 1.3 The board card

| Proposal | Verdict | Evidence |
|---|---|---|
| Emoji | **Not served** | `pockets` has no icon column (`020_create_pocket_tables.sql:84-105`) and nothing in `makePocketStatus.js` emits one. A column, a migration, a picker in the create form and a validator key — four changes, none of them planned |
| Goal name | **Supported** | `name`, `makePocketStatus.js:111` |
| Percentage with a small bar | **Supported** | `progress`, `makePocketStatus.js:120`. **Nothing clamps it** (`:66-72` says so explicitly): a pocket at 130% sends 130. The bar fills to 100 and the excess is its own mark |
| Status dot with the label `Active` | **Derivable** | From `funded` and `overdue`. The dot alone is not enough — the standing rule is a mark **plus a word**, because colour alone survives neither colour blindness nor print |
| Target | **Supported** | `target`, `makePocketStatus.js:115`. `NOT NULL CHECK (> 0)`, so there is no absent case to render |
| Allocated | **Supported** | `allocated`, `makePocketStatus.js:116` |
| Target date with days remaining | **Supported** | `desiredDate` (`:121`) is a `YYYY-MM-DD` calendar label resolved on the owner's clock, and `daysRemaining` (`:122`) is served — **never recompute it from the label**, because `new Date('2026-12-31')` is UTC midnight and reads as the previous day west of UTC |
| Required monthly `$933.00 / month` | **Supported, and tri-state — the single most dangerous figure on the card** | `requiredMonthly`, `makePocketStatus.js:127` via `computeRequiredMonthly` (`:50-61`). See §1.7, which is about this field alone |
| *(absent from the proposal)* `note`, `remaining`, `sourceCount` | **Served and dropped** | `note` (`:114`), `remaining` signed (`:119`), `sourceCount` (`:130`). Dropping `remaining` is the notable one: it is the only figure that states *committed above goal* when it is negative |

### 1.4 The detail — top bar and hero

| Proposal | Verdict | Evidence |
|---|---|---|
| `Back to Pockets` | **Supported** | Route exists, `App.tsx:336` |
| Goal name | **Supported** | `pocket.name`, `pocketDetailService.js:114-116` spreads `makePocketStatus` |
| Status pill | **Derivable** | From `funded`, `overdue` and `uncovered` (`pocketDetailService.js:117`, recomputed there over `sources`) |
| Edit control | **See §1.8** | The route it should open does not exist, and the shared control the other three detail cards just gained cannot serve it |
| Delete control | **Supported** | `DELETE /pocket/:pocketId` answers `{pocketId, name, freed:[{accountId, accountName, freedCash}]}` (`pocketWriteService.js:270-278`) — the **only** endpoint of the seven that does not answer with the detail payload |
| Hero: Target amount, Total allocated, Remaining | **Supported** | `target`, `allocated`, `remaining` on `pocket`. `remaining` is **signed** and negative means over-funded, which is a fact and not an error (`makePocketStatus.js:117-118`) |
| Hero: Progress percentage with a long bar | **Supported** | `progress` |
| Hero: Desired date | **Supported** | `desiredDate` |
| Hero: Required monthly | **Supported, tri-state** | §1.7 |
| `+ Allocate money` / `− Release money` | **Supported as endpoints, contradicting as labels** | The endpoints exist (`pocketController.js:195-224`). The `+` and `−` glyphs are fine on the button; **the amount field behind them must be unsigned**, because `positiveAmount` rejects a sign and the server writes it (`pocketValidators.js:44-46`, `pocketAllocationService.js:236`). A form that renders a minus into the input is one typo from inverting a financial decision |

### 1.5 The detail — MONEY SOURCES

**This is the section the brief asked me to check hardest, and the answer is
better than expected: it costs zero extra requests.**

| Proposal | Verdict | Evidence |
|---|---|---|
| `Account` column | **Supported, nullable** | `accountName`, `pocketDetailService.js:73` — **or `null` at `:61`** |
| `Allocated to this goal` column | **Supported, never null** | `heldByThisPocket`, `pocketDetailService.js:63` and `:75`. It is real on **both** branches |
| `Unassigned cash` column | **Supported by the detail itself, not by a second endpoint** | `accountUnassignedCash`, `pocketDetailService.js:78`, computed once in `makeAccountAllocation.js:41-46` as balance minus allocated. `GET /pocket/:pocketId` already carries it. **No extra request, for the accounts already funding this pocket** |
| `Total committed` row at the foot | **Supported — read it, do not sum it** | It equals `pocket.allocated`, already served. The rows can be summed to the same figure (`getPocketSourceHoldings` drops only pairs whose net is exactly zero, `accountAllocationRepository.js:88`), but summing on the client is a second answer to an answered question |
| *(absent from the proposal)* `accountAllocated`, `accountBalance`, `covered` | **Served and dropped, and dropping two of them breaks the third** | `pocketDetailService.js:76-79`. Showing *unassigned cash* without the balance and the committed total beside it is exactly the ambiguity the model refuses: an account holding `$4,000` with `$1,500` committed must never be presented as having `$2,500` of anything, and the three figures are shown together so the interface never has to pick one number to call *available* |

**The nullability the brief asked me to find, and what the table must render.**
`buildSources` has two branches (`pocketDetailService.js:56-81`):

| Field | Normal branch `:72-79` | Orphan branch `:60-67` — the ledger names an account the account read does not return: soft-deleted, or the internal `slack` account filtered out at `accountAllocationRepository.js:48` | The table renders |
|---|---|---|---|
| `accountId` | real | real | — |
| `heldByThisPocket` | real | **real** | the amount, on both branches |
| `accountName` | real | **`null`** | *account removed* — never a blank, never the string `null` |
| `accountType` | real | `null` | nothing |
| `accountAllocated` | real | `null` | **a dash**, never `0` |
| `accountBalance` | real | `null` | **a dash**, never `0` |
| `accountUnassignedCash` | real | `null` | **a dash**, never `0` |
| `covered` | `true` / `false` | **`null`, meaning *unknown*, not *not covered*** | **no mark at all.** `uncovered` is folded with `some(s => s.covered === false)` (`:117`), which excludes the nulls on purpose; a component recomputing it as `!covered` inverts it and marks a deleted account as failing |

A `?? 0` on any of those four reports a removed account's balance as zero. That is
the concrete shape of the rule *a missing figure is a dash, never `0`*.

### 1.6 The detail — ALLOCATION HISTORY

| Proposal | Verdict | Evidence |
|---|---|---|
| `Date` | **Supported** | `allocationDate`, `makeAllocationEntry.js:45` — a `YYYY-MM-DD` label resolved on the owner's calendar in SQL (`pocketRepository.js:150`), not an instant |
| `Type` — Allocated `+` / Released `−` | **Derivable** | From the sign of `amount` (`makeAllocationEntry.js:44`), written by the server at `pocketAllocationService.js:236`. The word goes beside the sign, not the colour alone |
| `Amount` | **Supported** | `amount` |
| `Source account` | **Supported, and never null** | `sourceAccountName`, `makeAllocationEntry.js:47`, from a plain `JOIN user_accounts` (`pocketRepository.js:159`). **It disagrees with the source table by construction:** the same account is `accountName: null` in `sources[]` and a real name here. Both are correct; a type that treats them alike is wrong about one |
| `Note` | **Not served, and not storable** | No note column on `pocket_allocations` (`020_create_pocket_tables.sql:143-167`); `allocationBodySchema` is `.strict()` over `sourceAccountId`, `amount`, `currency`, `allocationDate` (`pocketValidators.js:126-138`). **A migration and a validator change, not an endpoint tweak** |
| *(absent from the proposal)* the FX audit pair | **Served and dropped** | `originalAmount`, `originalCurrency`, `exchangeRate`, `exchangeRateSource`, `exchangeRateTimestamp` (`makeAllocationEntry.js:48-54`). `exchangeRate` keeps ten decimals and must not pass through the two-decimal amount formatter; `exchangeRateTimestamp` is the **only** raw `TIMESTAMPTZ` in the module (`pocketRepository.js:157`) and renders as an instant while every other date renders as a calendar day |

### 1.7 Required monthly — the figure that must never print as zero

`computeRequiredMonthly` (`makePocketStatus.js:50-61`) has three outcomes, and
each is a different sentence on screen:

| Server sends | It means | The card and the hero render |
|---|---|---|
| a positive number | the pace still to keep | `$933.00 / month` |
| **exactly `0`** (`:52`) | the goal is covered; there is nothing left to pace | **"goal covered"** — not `$0.00`, which reads as a monthly commitment of nothing |
| **`null`** (`:56`) | the desired date has passed; there is no monthly pace to state | **"the desired date has passed"** followed by the remainder. **No pace is invented** |

**The trap, confirmed in the source.** `currencyFormat` is declared
`currencyFormat(chosenCurrency = 'USD', number = 0, countryFormat = 'en-US')` at
`frontend/src/fintrack/helpers/functions.ts:19-23`. The default on the second
parameter means a `null` piped straight through prints **`$0.00`** — the module's
one deliberately-withheld figure rendered as a commitment of zero, under a label
that says *per month*. The same default reaches the six nullable summary amounts
of an empty or mixed-currency board.

The card must branch on `=== null` and on `=== 0` **before** the formatter is
called. Not `?? 0`, not `|| '-'` — `0` is falsy and would take the dash branch,
which is the opposite error.

### 1.8 The edit control on the pocket detail — what it opens

Three of the four detail cards gained a working edit control today: the account
(`a9488d8`), the debtor (`32baed3`) and the category (`610e399`). All three use
the same shared control,
`frontend/src/fintrack/general_components/accountEditLink/AccountEditLink.tsx`,
which navigates to a **hardcoded** destination at `:59`:

```
to={`/fintrack/account/${accountId}/edit`}
```

The pocket detail still draws the dead control those three replaced: a bare
`<div id='edit' className='flx-col-center icon3dots'>` at
`frontend/src/fintrack/pages/forms/pocketDetail/PocketDetail.tsx:161-163`, above
the commented-out `<Link to='edit'>` at `:157-159`. It is not focusable, answers
no key and carries no state, so it cannot declare the five interactive states the
standing rule requires.

**The shared control cannot be reused here, for two independent reasons, and
either one alone is fatal.**

1. **The id spaces are different.** `pockets.pocket_id` is its own `SERIAL`
   sequence (`020_create_pocket_tables.sql:84`), unrelated to
   `user_accounts.account_id`. Passing a pocket id to `/fintrack/account/:id/edit`
   resolves it as an account id — the wrong-id-space defect the contract audit
   ranked second, which does not fail loudly: it opens **another account's**
   editor, because both sequences start at 1.
2. **The account editor does not edit a pocket.** `EditAccount.tsx:138` drives its
   field set off `account_type_name` from the fetched `user_accounts` row. A
   pocket has no such row in the current model; the surviving `pocket_saving`
   branch in `accountEditSchema.ts:147-151` and `editSchemas.ts:26-52` edits the
   **retired** account type, not a `pockets` row.

**What the pocket's edit control must open:** a pocket editor of its own, at a
route that does not exist yet — `App.tsx` declares exactly three pocket paths
(`:209`, `:290`, `:336`) and no edit slot. `PLAN_POCKET_FE.md §5` already reserved
`pocket/pockets/:pocketId/edit` for an `EditPocket` route, backed by
`PATCH /pocket/:pocketId` (`pocketController.js:152-181`), which answers with the
whole detail payload.

**Verdict: not served on the frontend.** The control stays dead until that route
and that screen exist. My recommendation is that the proposal's edit entry point
be drawn but explicitly labelled as blocked on the `EditPocket` unit, rather than
wired to `AccountEditLink` — pointing it at the account editor would open a
different user-visible object under the pocket's name, which is worse than a
control that is honestly absent. The visual treatment should copy
`AccountEditLink`'s markup exactly — a `Link`, not a `div`; a glyph with
`aria-hidden`; an `aria-label` naming the pocket — so the fourth card matches the
three that landed today.

> **CORRECTED 2026-08-30 — the route exists and the control is live, so this
> section's verdict and two of its measurements are false.**
>
> - **`App.tsx` declares four pocket paths, not three:** `pocket` with its index
>   (`:212`), `pocket/new_pocket` (`:293`), `pocket/pockets/:pocketId` (`:339`)
>   and `pocket/pockets/:pocketId/edit` (`:352`).
> - **The dead `<div id='edit'>` is gone.** The detail carries
>   `pages/forms/pocketDetail/PocketEditLink.tsx`, and the secondary menu is
>   wired: `PocketDetail.tsx:29-30` imports `AccountActionsTrigger` and
>   `AccountActionsMenu`.
> - **The two reasons this section gives for not reusing `AccountEditLink` were
>   sound and were honoured** — the pocket has its own control at its own route,
>   and no pocket id is handed to `/fintrack/account/:id/edit`.

### 1.9 The create form

| Proposal | Verdict | Evidence |
|---|---|---|
| Goal name with a `14/50` counter | **Supported at 50, and the frontend disagrees with itself** | Server: `.max(50)` (`pocketValidators.js:67-69`). Column: `VARCHAR(50)` (`020_create_pocket_tables.sql:87`). **Frontend today: `NAME_MAX_LENGTHS.pocket_name` is `28`** (`nameMaxLengths.ts:16`), consumed at `NewPocket.tsx:360,376`. The form stops the owner 22 characters early on a client-side rule nobody wrote down |
| Target amount with a currency selector | **Supported, with one rule the form must not break** | `targetAmount` and `currency` (`pocketValidators.js:75-76`). **`currency` has no default on the server, deliberately** (`:28-31`): the badge must be explicitly set, and a client-side default is the exact defect migration 014 documents |
| Desired date with a calendar control | **Supported, with a serialisation rule** | `desiredDate` must be a `YYYY-MM-DD` string matched by regex (`pocketValidators.js:24-26`). A JS `Date` serialises to a full ISO instant and is a `400`; that is what `NewPocket.tsx:223` sends today |
| Note, optional, `36/155` counter | **Supported at 155, same disagreement** | Server `.max(155)` (`pocketValidators.js:70-74`), column `VARCHAR(155)` (`:88`). **Frontend: `NAME_MAX_LENGTHS.note` is `90`** (`nameMaxLengths.ts:14`) — and that key is **shared** with the account, category, debtor and profile forms, so raising it in place moves five counters nobody asked to change |
| `Cancel` / `Create goal` | **Supported** | `POST /pocket` answers `201` with the **entire detail payload** (`pocketController.js:141-145`), not an id — so success can navigate to the created pocket and that detail issues **zero** requests |
| *(implied)* a source account or an opening amount on the form | **Not served** | The create schema is `.strict()` over exactly five keys (`pocketValidators.js:65-81`) and the comment at `:60-64` states a pocket is created empty on purpose. Any initial-commitment field is a `400` today |

> **CORRECTED 2026-08-30 — three rows of this table state a frontend that no
> longer exists. The server-side halves are unchanged.**
>
> - **The name counter is at 50 and the note counter at 155.**
>   `nameMaxLengths.ts:20` reads `pocket_name: 50` and `:16` reads `note: 155`,
>   both with a comment naming the server as the reason. The frontend no longer
>   disagrees with itself.
> - **The `note` key is not shared with four other forms.** Its only consumers in
>   the repository are the two pocket forms — `NewPocket.tsx:333`, `:347` and
>   `EditPocket.tsx:431`, `:445` — so the separate `pocket_note` key §5.5
>   recommends would protect nothing.
> - **The deadline is sent as a calendar label.** `NewPocket.tsx:203` sends
>   `desiredDate: toCalendarDay(pocketData.desiredDate)`, and the picker takes
>   `minDate={startOfToday()}` at `:426`.
> - **Unchanged:** the currency badge has no client-side default, the create
>   schema is still `.strict()` over five keys, and success navigates to the
>   created pocket (`:224`) on a `201` that carried the whole payload.

### 1.10 The six anti-stacking principles

| Principle | Verdict |
|---|---|
| 1. Space with `gap` from spacing tokens rather than fixed margins | **Supported.** `--space-1` through `--space-16` exist (`tokens.css:172-181`) |
| 2. Strict type scale, tabular numerals on financial figures | **Supported, and new.** Seven sizes and four weights exist (`tokens.css:157-170`). `font-variant-numeric: tabular-nums` is a CSS keyword needing no token — and `FRONTEND_VISUAL_SYSTEM.md` PART 0 measured **zero** declarations of it in the repository, so this module is the first |
| 3. Fewer frames — separate with space and type | **Supported** |
| 4. Skeletons instead of `Loading...` | **Supported, and precedent already exists.** `pocket-styles.css:334-372` already declares a token-only skeleton with a `prefers-reduced-motion` block. The legacy `<p>Loading...</p>` it replaces is still on the detail at `PocketDetail.tsx:246` |

> **CORRECTED 2026-08-30, principle 4 only.** The legacy loading paragraph is
> gone: the detail draws its own skeleton at `PocketDetail.tsx:221-228` over
> `.pocketDetail__skeletonHero` and `.pocketDetail__skeletonRow`
> (`pocketDetail-styles.css:75`, `:82`), and the board's skeleton has moved to
> `pocket-styles.css:352-376` with its reduced-motion block at `:375`. Neither is
> a shared primitive — `general_components/` still holds no `skeleton/`.
| 5. Consistent vocabulary; drop *available balance* | **Supported, and it is the model's own rule.** `makeAccountAllocation.js:12-19` states it in the source. Two drifts in the proposal's own copy: *Goal* where the object is a **Pocket** (§5.4), and *Completed* where the served state is **funded** |
| 6. Progressive disclosure — the pocket block appears on Account Detail **only when allocations exist** | **Contradicts the model.** `getAccountController.js:789-801` attaches `allocated`, `unassignedCash`, `isOverAllocated` and `pockets` and serves them as **null for every account type that is not eligible** — the block is gated by **account type**, not by whether allocations exist. A bank account with nothing committed must show `0` committed and its whole balance as unassigned cash, because zero committed is a measured fact about that account. Hiding the block there tells the owner the question does not apply, when the answer is simply zero. `PLAN_POCKET_FE.md §10` criterion 14 states the same rule from the other side |

### 1.11 What contradicts the frozen model — collected

Four, and only the first is structural.

1. **Progressive disclosure by presence of allocations** (§1.10). A bank account
   with zero committed is a real answer, not an absent one.
2. **`Completed` as a filter chip.** A funded pocket is not finished — the money
   is still committed and can still be released. `funded` says *the target is
   met*; *completed* says *this is over*.
3. **The `−` on the release amount input** (§1.4), if it reaches the field rather
   than staying on the button label. The client never sends a sign.
4. **The card reading like an account card.** Not a defect in the proposal as
   written — it shows no balance and no transaction list — but it is the standing
   risk. The mitigation is copy, not layout: the card's own headline is the
   allocated figure worded as *committed to this goal*, never a bare amount in the
   position an account card puts its balance.

---

## 2. THE SCREENS AS I WOULD BUILD THEM

Information architecture only. `PLAN_POCKET_FE.md §11` reserves the pixel design
and §7.1–7.4 fix what appears; nothing below overrides either.

### 2.1 The board, `/fintrack/pocket`

**Header, on the white navbar surface.** Title *Pockets*; subtitle *Plan and
track the money committed to your goals*; one **New pocket** control — one, not
the two identical renders the current board carries above and below its list.

**Summary, four tiles on `--color-surface-deep`, all four served, none folded on
the client:**

| Tile | Field |
|---|---|
| Total allocated *(the headline, larger than the other three)* | `summary.totalAllocated` |
| Of a target of | `summary.totalTarget` |
| Still to commit | `summary.totalRemaining` |
| Overall progress, with the bar | `summary.overallProgress` |

A fifth line **only when non-zero**: `totalExcess`, worded *committed above goal*.
Marks for `overdueCount` and `uncoveredCount`, shown only when non-zero, as a
`StatusSquare` plus a word. `fundedCount / pocketCount` reads *n of m funded*.

This replaces the proposal's NEXT GOAL tile, which duplicates the first card
directly beneath it, and its ACTIVE GOALS tile, which needs a count the server
does not fold.

`summary.currency === null` renders every amount as a dash and
`meta.notices[0]` as a notice — **never as an error**, because on an empty board
that null means *no pockets* and on a mixed board it means *two currencies*,
neither of which is a failure. `pocketCount === 0` replaces the whole summary with
the empty state: a hero of five dashes invites reading five figures that do not
exist.

**Toolbar.** Search over `name`, client-side. Sort: desired date (the arrival
order), name, remaining. Filters, **exclusive and not cumulative** — funded and
overdue cannot both hold, and stacked chips produce an empty set with no
explanation:

`All` · `Active` · `Funded` · `Overdue` · `Uncovered`

`Upcoming` is dropped (no definition exists). `Completed` becomes `Funded`.
`Uncovered` is added. **No counts on the chips** — see §5.1.

> **Shipped 2026-08-31 with seven chips, not five, and one different word.**
> `PocketToolbar.tsx:42-51` reads `All`, then the **five** status levels from the
> shared map, then coverage last. The change of shape is that `Active` is gone:
> it was never a state, only the residue of the two the server folds, and it hid
> the one reading that asks for action by lumping a pocket thirty days out with
> one that has a year. In its place stand the two levels it was covering, `On
> plan` and `At risk`, plus `Above target`, which the five-chip list had no room
> for.
>
> **And `Funded` is now spelled `At target`** (`helpers/pocketStatus.ts:65`).
> Two reasons, both recorded beside the map: the word named the mechanism while
> the four beside it name an outcome, and it collided with the board's own
> grouping, where *Target reached* is the heading that holds this level and the
> one above it. **The three decisions this section made still stand** — exclusive
> and not cumulative, coverage included, and no counts on the chips.

**Card, one per row up to 768px.** Emoji dropped. Name; `note` omitted entirely
when null, never the string `null`, which is what the row prints today
(`ListPocket.tsx:129` renders `note ?? DASH`, so a missing note currently draws a
dash where the plan asks for no line); the allocated figure as the card's own
headline; target; `remaining` signed and worded *committed above goal* when
negative; the progress bar from `progress`, filled to 100 with a distinct
over-goal mark; `desiredDate` and `daysRemaining`; required monthly through the
three-way branch of §1.7; the source line, worded *no pocket allocations yet* when
`sourceCount` is `0` — never *0 accounts*. State marks are square plus word.

**Class names are new and namespaced under a `pocketBoard__` block.** This is not
a preference. `.card__tile__pocket`, `.line__container` and
`.list__main__container` are each declared in **both** `budget-styles.css` and
`pocket-styles.css`, `.tile__title` in three files, and `.tile__subtitle` in
**five** — all at equal specificity, so which one wins depends on the order the
lazy routes load. Restyling any of them changes the monthly budget and the
overview, screens nobody asked for.

### 2.2 The detail, `/fintrack/pocket/pockets/:pocketId`

**Top bar.** Back; the pocket name; the status word; the edit control per §1.8;
delete.

**Hero, on the cream panel with dark text**, built on the existing shared
`SummaryDetailBox`, which already exposes `surface: 'dark' | 'light'` naming the
surface it lands on rather than its own colour (`SummaryDetailBox.tsx:38-40`).
Target, allocated, remaining, progress with the bar, desired date, required
monthly, days remaining. **No balance, no contributions, no withdrawals, no net
change** — every one of those describes an object with money of its own.

**Two primary controls, Allocate and Release**, plus edit and delete as
secondary. Not four equal buttons: the screen has to read as a goal being
tracked. Release is disabled — `opacity: 0.5; pointer-events: none` — when
`allocated` is `0`.

**Money sources, four columns, not three:**

`Account | Held by this goal | Committed to all goals | Unassigned cash`

plus a covered mark, and a foot row reading `pocket.allocated`. The third column
is what the proposal drops, and without it the fourth cannot be reconciled by the
reader. Both null branches render per the table at §1.5.

**At 360px these are cards, not a table.** Horizontal scroll would hide exactly
the column that disambiguates the three figures. A table from 768px up.

**Allocation history**, newest first: date, the word *Committed* or *Released*
beside the sign, the amount, the source account name. Never called transactions,
never rendered through `AccountTransactionsList` — a pocket has no transactions,
and `PocketDetail.tsx:236-239` renders one today. Each row opens the entry detail
carrying the FX pair.

**The `Note` column is dropped** until the column exists.

### 2.3 Create, `/fintrack/pocket/new_pocket`

Single centred column: name with a counter at **50**; target amount with the
currency badge and no default; desired date, minimum today, sent as
`YYYY-MM-DD`; note with a counter at **155**; cancel and create. Success
navigates to the created pocket's detail, which issues zero requests because the
`201` carried the whole payload.

### 2.4 Allocate, release and delete — modals, not routes

**I disagree with the proposal here, and flag it rather than designing around
it.** `PLAN_POCKET_FE.md §5` settled `EditPocket` as a route and allocate,
release and delete as modals; `referencia_pocket_02.jpeg` draws all three as
bottom sheets, agreeing with the plan; the proposal draws them as routes.

**The plan is right, for one reason that is about the contract and not about
taste:** allocate and release answer with the **entire detail payload**
(`pocketController.js:213-220`), so a modal repaints the hero, the source table
and the history from the one response with no navigation and no refetch, while a
route unmounts the detail and pays a second request to come back to a screen the
response had already filled.

The detail is declared beside `<Layout />` (`App.tsx:336`), so a route also
unmounts the layout and everything hanging from its `Outlet` — which is precisely
why the module keeps its state in a store rather than in route context.

### 2.5 The three fetch states, per screen

| | Board | Detail | Forms and modals |
|---|---|---|---|
| Loading | skeleton for the summary and three card placeholders | skeleton for the hero, the source rows and the history rows | the submit control's own disabled state |
| Error | message **plus a retry** wired to the board refresh | message **plus a retry** wired to the detail fetch | the form message path |
| Empty | the empty state **replacing the summary entirely** | no source rows and no history rows are **two separately worded lines**; the hero always renders | n/a |

Three practices do not survive: the absolutely-positioned `<p>` with inline
colours cleared by a timer, the bare `<p>Error fetching…</p>` with no retry
(`PocketDetail.tsx:247-248`), and `<p>Loading...</p>` (`:246`).

> **CORRECTED 2026-08-30 — two of the three are gone; the first survives.** The
> detail renders a skeleton (`PocketDetail.tsx:221-228`) and an error state with
> a retry wired to `fetchDetail`; the board's list does the same
> (`ListPocket.tsx:90-131`). **The absolutely-positioned paragraph with an inline
> `color: 'red'`, cleared by a three-second timer, is still there** —
> `PocketLayout.tsx:29-35` sets the timer and `:81-93` renders the paragraph.
> That is the layout reduction the pocket editor's unit listed and did not carry
> out.

**And the rule that makes it checkable: no `?? 0` anywhere in the module.**

### 2.6 Responsive, including the two height breakpoints

| Breakpoint | Board | Detail |
|---|---|---|
| 360px, the base | one card per row; summary tiles stacked | source rows as cards; history as stacked rows |
| 480px | summary tiles two-up | unchanged |
| 768px | **the only point where two cards per row becomes an option** — see §5.2 | source rows become a table |
| 1024px | column centres; it does not stretch | same |
| **height ≤ 735px** | the summary collapses to the headline plus the progress bar; the other three tiles fold away. The list is what the screen is for | the hero keeps target, allocated and progress; the pace figures move below the fold |
| **height ≤ 568px** | the summary collapses to the headline alone | the two primary controls stay in view; everything else scrolls |

`@media` cannot read a custom property, so the four width values and the two
height values are literals in the query condition. That is the one place a
literal is permitted, and nowhere else.

---

## 3. THE TOKEN MAP

Read from `frontend/src/styles/tokens.css`, imported once at `main.tsx:6`. Every
name below was confirmed declared in that file. **Nothing here is invented; four
gaps are named at §3.3 as questions rather than filled with a guess.**

The legacy vocabulary in
`frontend/src/fintrack/pages/styles/generalStyles.css:7-26` is still live and
still working. `PLAN_STYLE_SYSTEM_V2.md` QS-11 recommends migrating by
consumption site straight to the canonical token rather than aliasing, so **new
pocket CSS consumes the canonical names directly** and touches no legacy name.

### 3.1 Surfaces and content

| Where | Token |
|---|---|
| Page ground | `--color-surface-app` |
| Board card, summary tile | `--color-surface-deep` *(the token's own comment names board cards as its consumer; `pocket-styles.css:48,61` already uses it)* |
| Modal panel, dropdown, secondary menu | `--color-surface-raised` |
| Detail hero, data panel | `--color-surface-panel` |
| Header and navbar | `--color-surface-inverse` |
| Modal scrim | `--color-surface-overlay` |
| Text on the panel and on white | `--color-content-primary`; secondary `--color-content-secondary` |
| Text on the app and on a card | `--color-content-on-dark`; muted `--color-content-on-dark-muted`; subtle `--color-content-on-dark-subtle` |
| Input placeholder | `--color-content-placeholder` |

Every shared component exposes `.light` / `.dark` naming **the surface it sits
on**, following `SummaryDetailBox.tsx:38-40` and `AccountEditLink.tsx:41-44`,
which both already do exactly this.

### 3.2 The rest

| Role | Token |
|---|---|
| Funded / covered mark | `--color-status-ok` |
| Overdue mark | `--color-status-alert` |
| Uncovered mark | `--color-status-warning` *(calibrated to sit between ok and alert against the board card — the token's own comment records the measurement)* |
| Committed amount, positive movement | `--color-amount-positive` |
| Released amount | `--color-amount-negative` |
| Form error banner on cream | `--color-feedback-error-content` / `-surface` / `-border` |
| The `422` refusal banner on the write forms | the same feedback triad — those messages land inside a modal on a light panel, not on the app surface |
| Focus ring | `outline: var(--border-width-thick) solid var(--color-border-inverse)` at `outline-offset: var(--border-width-thick)` — the 2px-at-2px rule, and the exact pattern `pocket-styles.css:317-320` already ships |
| Type scale | `--font-size-2xs` … `--font-size-2xl`; the root clamps 14→16px via `--font-size-root` |
| Weights | `--font-weight-regular` / `-medium` / `-semibold` / `-bold`. `bold` and `normal` as keywords are forbidden: they defeat the variable font's weight axis |
| Tracking | `--letter-spacing-wide` labels · `-wider` titles and totals · `-widest` the summary amount row |
| Spacing and gap | `--space-1` … `--space-16` |
| Radius | `--radius-xs` … `--radius-xl`, `--radius-full` for pills and the retry control. **`--radius-lg` is under a documented collision** — three leaves of the account deletion flow overwrite it in the global `:root` (`tokens.css:198-205`), so this module does not consume it |
| Touch target | `--size-touch-target` (44px, deliberately px because it is bounded by a finger) |
| Toolbar controls | `--size-control-sm` |
| Status square | `--size-status-square` |
| Motion | `--motion-fast` for colour, `--motion-normal` for the progress bar's width. Enumerated, never `transition: all`, and each with a `prefers-reduced-motion: reduce` block |
| Layering | `--z-modal` for the allocate and release sheets, `--z-overlay` for the scrim, `--z-toast` |
| Column | `--layout-width-max` (40rem), `--layout-top-space`, `--layout-navbar-bottom` |

Tabular numerals are the CSS keyword `font-variant-numeric: tabular-nums`,
applied to every money figure, every percentage and the day count. No token is
needed and none is invented.

### 3.3 The four values with no token — questions, not guesses

| What needs a value | Why no existing token fits | Blocks |
|---|---|---|
| **The progress bar's track height** | The spacing scale's own comment restricts it to *padding, margin, gap and absolute offsets* and says it does **not** apply to width or height, which come from the sizing tokens — and the sizing tokens are a status square, an icon, a badge, two control heights and a touch target. None of them is a bar | Every card, and the hero |
| **The progress ring's diameter and stroke width** in `referencia_pocket_02.jpeg` | Same gap, twice over | Only the ring. **Avoidable:** the specification says *bar*, and a bar needs one value instead of two |
| **The status pill's ground** | `--color-financial-*-surface/-border/-content` exist and are the right shape, but they name **what a movement did to net worth** and are marked PROVISIONAL in the file. A pocket state is not a financial effect; borrowing the triad assigns it a meaning it does not carry | Only the pill. **Avoidable:** `StatusSquare` plus a word is the established pattern and needs no new value |
| **The skeleton bar's height** | Solved by precedent, not by a token: `pocket-styles.css:340-341` sizes it with `--font-size-sm`, the height of the text it stands in for. Reusable, and worth recording as the convention | Nothing |

**One value, the bar height, genuinely has to be decided.** The other three
disappear if the recommendations at §5.3 are taken.

---

## 4. WHAT IS NEW VERSUS WHAT REPLACES SOMETHING ALREADY ON SCREEN

| Piece | Status | Against what exists |
|---|---|---|
| Board summary tiles | **Replaces** | `PocketBigBoxResult.tsx:57` headlines `totalTarget` — the sum of the goals — while `totalAllocated`, the figure the module exists to report, is served and discarded. Its own comment at `:52-54` records this as deferred. **This is the correction the whole board exists to make** |
| Board toolbar | **New** | No search, no sort, no filter exists on this board |
| Board card | **Replaces** | `ListPocket.tsx:94-155`, a two-column tile. Four specific corrections: the alert square is derived from `remaining > 0` (`:147-149`) instead of reading the served `funded` and `overdue`, so a pocket three months ahead of schedule is marked identically to one whose deadline passed; `note ?? DASH` (`:129`) draws a dash where the plan asks for no line; the date is formatted `es-ES` while the amount beside it is `en-US`; and `currency ?? DEFAULT_CURRENCY` (`:108`) is a dead branch over a field the builder refuses to emit as anything but a lowercase string |
| Board empty state | **Partly exists** | `pocket-styles.css:255-380` already ships the three-state block, token-only, with a retry that declares all five states and a reduced-motion block. **Extend it; do not rewrite it** |
| Detail hero | **Replaces** | `SummaryPocketDetailBox.tsx`, 58 lines, which labels the figure **`Saved`** at `:20` — the banned word, on a *balance*, which is the retired model in one word — and prints `NaN%` at `:45-48` when `target` is absent |
| Money sources table | **New** | Nothing on the frontend declares `heldByThisPocket`, `accountUnassignedCash`, `accountAllocated` or `isOverAllocated`. A repository-wide grep for those names returns nothing outside the board card's `allocated` |
| Allocation history | **Replaces** | `PocketDetail.tsx:236-239` renders `AccountTransactionsList` — another account's transaction statement, under a pocket's screen |
| Allocation entry detail | **New** | No component shows the FX pair for a pocket allocation |
| Allocate / release sheets | **New** | No component, no client function, no URL |
| Delete modal | **New** | Nothing declares the `{pocketId, name, freed[]}` shape |
| Edit control | **Replaces a dead control** | `PocketDetail.tsx:161-163`, per §1.8. The three sibling cards were fixed today; this is the fourth and the only one the shared control cannot serve |
| Create form | **Replaces** | `NewPocket.tsx` posts to the **retired** account endpoint (`:113`), sends `target` where the server wants `targetAmount`, a JS `Date` where it wants a label, and a `type` key a `.strict()` schema rejects (`:214-225`) — then reports *"New Pocket account successfully created!"* (`:129`) over a board that stays empty forever |
| Skeleton, empty state | **New as shared components** | A search for `*skeleton*` under `frontend/src` returns only the pocket board's own block |
| Account detail pocket panel | **New** | The four fields are served (`getAccountController.js:798-801`) and declared by nothing on the frontend |

> **RE-MEASURED 2026-08-30 — eleven of these fourteen rows have been built. The
> "against what exists" column describes screens that were replaced the same day
> this table was written.**
>
> | piece | state |
> |---|---|
> | board summary tiles | **built.** Three peer tiles — target, total allocated, still to commit — at `PocketBigBoxResult.tsx:154-192`, with the excess printed under the gap when it is above zero |
> | board toolbar | **not built.** No search, no sort, no filter chips |
> | board card | **built.** `ListPocket.tsx`; the square reads the served flags through `pocketDateLevel`, the date goes through `formatCalendarDate`, and `note ?? DASH` is now at `:220` — still a dash where this document asks for no line |
> | board empty state | **built**, extending the token block as recommended: `ListPocket.tsx:133-143` |
> | detail hero | **built.** `SummaryPocketDetailBox.tsx`, 126 lines, labelled *allocated* at `:68`, printing the served `progress` at `:113` |
> | money sources table | **built.** `PocketDetail.tsx` renders the source rows; `PocketSourcePicker.tsx:24-35` declares the three figures per row |
> | allocation history | **built.** `PocketDetail.tsx:476` prints the word beside the sign; `AccountTransactionsList` is not imported there |
> | allocation entry detail | **built.** `allocationEntryModal/AllocationEntryModal.tsx` over a shared `general_components/fxPathwayCard/` |
> | allocate / release sheets | **built.** One component pair, `pocketCashModal/PocketCashModal.tsx`, branching on a `direction` prop |
> | delete modal | **built.** `deletePocketModal/DeletePocketModal.tsx`; the `{pocketId, name, freed[]}` shape is `DeletePocketResult` (`pocketTypes.ts:256`) |
> | edit control | **built.** `PocketEditLink.tsx` on the route slot `App.tsx:352` |
> | create form | **built.** The endpoint, the payload keys, the date type and the success path are all corrected; see the block under §1.9 |
> | skeleton, empty state as shared components | **not built.** Both the board and the detail declare their own |
> | account detail pocket panel | **not built.** `AccountDetail.tsx:96` still branches the url to `null` on route state, and `AccountListType` (`types/responseApiTypes.ts:303`) declares none of the four |

---

## 5. THE OPEN QUESTIONS, EACH WITH A RECOMMENDATION

### 5.1 Do the filter chips carry counts?

The proposal draws `All (5) · Active (3) · Upcoming (1)`. Three of those counts
are served (`pocketCount`, `fundedCount`, `overdueCount`, `uncoveredCount`) and
**`activeCount` is not**, so the chip row would mix four server figures with one
the client folded — which is the exact shape the board service's header comment
names as how the header came to disagree with the list.

> **Recommendation: no counts on the chips; the summary states the counts the
> server serves.** One answer per question, and the chip row stops being a second
> place where a total can be wrong.

If the developer wants the counts on the chips, the honest route is a backend
requirement: **`makeSummary` folds an `activeCount` beside its three siblings
(`pocketBoardService.js:100-106`)** — three lines, in the one place the other
counts are computed.

### 5.2 One card per row, or two?

`tokens.css:252-256` declares the column *single, centred rather than stretched
on wide viewports* and states *it never becomes a multi-column desktop layout*,
capped at `--layout-width-max` (40rem / 640px). Two cards inside that column are
roughly 300px each — narrower than `--layout-card-width` (350px), the width the
account card is built to.

> **Recommendation: one card per row through 768px, two from 768px up, inside the
> unchanged 40rem column** — the token's sentence is about the page column, which
> does not change, and a card carrying seven figures at 300px is where the
> collision risk at 360px reappears at a wider viewport.

I cannot see the render, so this is the layout decision I am least sure of and the
first one to look at on a real screen.

### 5.3 The progress indicator: bar or ring?

`referencia_pocket_02.jpeg` draws a ring on the detail hero; the specification
says bar in both places. The ring needs two values with no token; the bar needs
one.

> **Recommendation: a linear bar in both places**, because the specification wins
> over the reference and it halves the token gap at §3.3.

If the ring is wanted anyway, build it as a `<circle>` driven by
`stroke-dasharray` and `stroke-dashoffset` rather than a computed path arc: one
number to get right instead of four, it animates, and it degrades to a full ring
when the value is unknown.

### 5.4 Is the object a **Pocket** or a **Goal**?

The proposal says *New goal*, *Create goal*, *Active goals*. The module, the
route, the table, the endpoints and `referencia_pocket_01.jpeg`'s own button all
say **Pocket**. The frozen vocabulary bans *budget*, bare *allocation* and
*saved*; it does not rule on *goal*.

> **Recommendation: the object is a Pocket and the word *goal* names only its
> target** — *"$2,800 still to commit to reach this goal"* — because two nouns for
> one object is how *saved* and *balance* got onto the current screen.

This is a decision for the developer, not for me: it is copy, and it is his.

### 5.5 The two length limits

`pocket_name` is `28` on the frontend and `50` on the server and in the column;
`note` is `90` on the frontend and `155` — and that `note` key is shared with four
other forms.

> **CORRECTED 2026-08-30 — every figure in this paragraph is stale and the
> premise of its recommendation is false.** `nameMaxLengths.ts:20` reads
> `pocket_name: 50` and `:16` reads `note: 155`, each with a comment naming the
> server as the reason, so neither counter disagrees with the column any more.
> And `NAME_MAX_LENGTHS.note` is **not** shared with four other forms: its only
> consumers in the repository are `NewPocket.tsx:333`, `:347` and
> `EditPocket.tsx:431`, `:445`. The separate `pocket_note` key recommended below
> would have had nothing to protect; raising the shared key in place moved no
> other form's counter.

> **Recommendation: raise `pocket_name` to 50 and add a separate `pocket_note:
> 155` beside the shared `note`** (`nameMaxLengths.ts:9-27`), because the counter
> should state the limit the server actually enforces and no other form's counter
> should move for a pocket decision.

### 5.6 The three requirements this design hands back to the backend

Stated as requirements, not designed around silently. **None of them blocks the
board or the detail.**

| Requirement | What it unblocks | Recommendation |
|---|---|---|
| A note on an allocation: a column on `pocket_allocations` and a fifth key on `allocationBodySchema` | The history's `Note` column and the reference's note field in the allocate sheet | **Drop the column from V1.** It is a migration for a field nobody has asked to search or report on, and the FX pair already fills that space with something the ledger can be audited by |
| The accounts-by-type list gains `allocated` and `unassignedCash` | The source picker, which must show balance, committed and unassigned **side by side for every eligible account** — `sources[]` carries all three but only for accounts **already** funding this pocket, which is exactly the set the owner is not choosing from | **Take it.** One field pair on an endpoint that already runs the query, computed by the same service the commit path validates against, so the rule and the number on screen cannot drift. The alternative costs one request per selection change and shows two of three figures blank |
| An icon or emoji column on `pockets` | The card's emoji | **Drop it from V1.** Four changes — column, migration, picker, validator — for decoration, on a module whose creation path does not work yet |

### 5.7 The one thing I would build before any of this

> **MARKED 2026-08-30 — built, in the order this section asked for.** The detail
> chain shipped first and the creation form second, so the ordering argument has
> no subject left. The two defects it turns on are closed: the form calls
> `createPocket` (`NewPocket.tsx:211`) and the detail keeps the route parameter's
> name (`PocketDetail.tsx:75`). Nothing here is struck; the recommendation is the
> record of why the order was what it was.

Not a design question, but it decides whether any of the above is reachable.

> **Recommendation: the detail chain before the create form.** Four of the seven
> endpoints answer with the detail payload — create, edit, allocate and release
> all return it — so typing it once types five responses out of seven; and
> shipping a working create form first is what puts rows on the board and arms the
> wrong-id-space read at §1.8. The order is forced by the defect, not by
> preference.

---

## 6. WHAT THIS DOCUMENT DID NOT VERIFY

Named plainly, because a document that says what it could not confirm is worth
more than one that sounds complete.

- **No server was started and no endpoint was called.** Every backend claim is a
  claim about what the source says it serves.
- **Nothing was rendered.** I have no eyes on the screen. I cannot tell whether
  the four summary tiles fit at 360px, whether the four-column source table
  survives 768px, whether the required-monthly line wraps, or whether the card's
  seven figures collide at two-up. **Visual confirmation is outstanding on every
  layout claim in §2**, and §5.2 is where I would look first.
- **No build was run.** No `tsc`, no `vite build` — this document writes no code,
  so there was nothing to compile.
- **Whether migrations 019 and 020 have been run** against any database. The
  id-space finding at §1.8 does not depend on it: it depends only on the two
  sequences being separate, which the schema settles.
- **The account editor's `pocket_saving` branch was read, not traced.** I
  confirmed the schema entries survive (`accountEditSchema.ts:147-151`,
  `editSchemas.ts:26-52`) and that `EditAccount.tsx:138` drives its fields off a
  `user_accounts` row; I did not walk that branch end to end. It does not change
  the conclusion — a pocket id sent to the account editor resolves as an account
  id either way.
- **`referencia_pocket_02.jpeg` carries Spanish copy** (*Volver*, *Activo*,
  *Todo*, *Próximo*) and a visible typo, *Nest Goal* for *Next Goal*. Read as
  layout references only; the copy language of the module is a decision I did not
  find settled anywhere and did not assume.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

§1's classification of every proposal element — supported, derivable, not served,
contradicts — was re-read against the builder that emits each field, and none of
the verdicts moved. §2 (the information architecture), §3 (the token map) and the
four token gaps of §3.3 were not affected either. What aged is every statement
about what the screens draw today, because the board and the detail were rebuilt
the same day. Corrected in place; nothing struck and no decision closed.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the edit control as dead and the edit route as absent | §1.8 | `PocketEditLink.tsx` on `App.tsx:352`; `App.tsx` declares four pocket paths (`:212`, `:293`, `:339`, `:352`), not three |
| the two field-length disagreements and the JS `Date` deadline | §1.9, restated at §5.5 | `nameMaxLengths.ts:16`, `:20` match the server; `NewPocket.tsx:203` sends a calendar label and `:426` sets a minimum of today |
| the `note` key shared with four other forms | §1.9, §5.5 | two consumers, both pocket forms |
| the legacy `<p>Loading...</p>` on the detail | §1.10, principle 4 | replaced by a local skeleton at `PocketDetail.tsx:221-228` |
| the three practices that do not survive | §2.5 | two are gone; the absolutely-positioned inline-red paragraph on a three-second timer survives at `PocketLayout.tsx:29-35`, `:81-93` |
| what is new versus what replaces something on screen | §4, all fourteen rows | eleven built; the board toolbar, the shared fetch-state primitives and the account detail's pocket panel are not |
| the recommendation to build the detail chain before the create form | §5.7 | **marked, not struck.** Executed in that order |

**Left standing because they are still true:** the three conflicts of §0 and
their resolutions; every nullability rule of §1.5 and the tri-state of §1.7; the
contradiction §1.10 records about gating the account-detail block by presence of
allocations rather than by account type; the four token gaps of §3.3, with the
skeleton bar's precedent now at `pocket-styles.css:352-376`; and the three
backend requirements of §5.6, none of which has landed.

**What was not re-measured:** the layout judgements of §2, which this document
already states it could not verify without a render. That limitation is
unchanged — nothing here was rendered either.
