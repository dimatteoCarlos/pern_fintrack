# POCKET — THE IMPLEMENTATION SEQUENCE, ORDERED BY DEPENDENCY

**Written 2026-08-29 on `fix/auth-screen`, after `32baed3`. Lives in
`plan-docs/ongoing/`, which `.gitignore:123` re-includes: this file is
versioned. No file
under `frontend/` or `backend/` was modified while writing it, nothing was
staged and nothing was committed.**

It orders what remains of the Pocket module. It consumes `PLAN_POCKET_FE.md`
(the plan), `POCKET_CONTRACT_AUDIT.md` (the end-to-end measurement),
`POCKET_FE_RECONCILIATION.md` (the post-merge measurement),
`POCKET_DETAIL_SPEC.md` (the detail chain's specification) and
`POCKET_VISUAL_PROPOSAL.md` (the verified design), and restates none of them
beyond what the ordering needs.

**Every claim that decides an order below was re-read from the source on this
branch.** Where a document and the code disagree, the code wins and the
disagreement is named at §5, not quietly absorbed.

---

## 0. The rule this sequence is built on

> **First prove a screen consumes the right object; then make it look right.**

It is not a preference. The detail screen spends a pocket id as an account id
(`PocketDetail.tsx:58`), `pockets.pocket_id` and `user_accounts.account_id` are
two `SERIAL` sequences that both start at 1
(`020_create_pocket_tables.sql:84`), so **the collision is the default case, not
the edge case.** A perfectly designed screen built on that read shows another
account's name, balance and full transaction statement under a pocket's title.

Consequence, held for the whole sequence: **nothing cosmetic is scheduled before
every screen is proved to consume the right object.** The board's toolbar, its
summary tiles, its card and its stylesheet — all specified in
`POCKET_VISUAL_PROPOSAL.md` §2.1 — sit at position 11, after the last write path
is proved.

---

## 1. The first commit, and why that one

**Build the pocket detail chain, end to end, in one commit** — the response
contract's detail half, the URL, the client function, the detail store, the
screen and its hero, plus a stylesheet of its own. Specified clause by clause in
`POCKET_DETAIL_SPEC.md`.

Three reasons, in order of weight.

1. **It disarms the graver-in-consequence defect before anything can fire it.**
   The wrong-id-space read is unreachable today only because the `pockets` table
   can hold no rows. Every other candidate first commit either puts rows there or
   leaves the read in place.
2. **One payload types five of the seven endpoints.** Create
   (`pocketController.js:141-145`), edit (`:173-177`), allocate and release
   (`:213-220`) all answer with `pocketDetailService.getDetail(...)` — the same
   object this screen reads. No other single contract in this module has that
   reach.
3. **Every write hands its answer to a store that does not exist yet.**
   `usePocketDetailStore.ts` is absent from `frontend/src/fintrack/stores/`
   (measured: the directory holds six stores and none of them is it), and
   `setDetailFromWrite` is the mechanism create, edit, allocate, release and
   delete all depend on. It is this commit's.

It waits on nothing. Every endpoint is mounted (`pocketRoutes.js:27-65`), the
route slot exists (`App.tsx:336`), and the board's contract file and client are
the pattern it follows.

---

## 2. The sequence

Thirteen units plus three deferred backend requirements. **Ordered by technical
dependency, not by the plan's numbering.** The plan's own unit numbers appear in
parentheses at the end of each row so the two documents can be read side by side;
they are labels, not arguments.

| order | the unit, in words | plan's row |
|---|---|---|
| 1 | the pocket detail chain, endpoint to screen | 1, 2, 3, 4, 8 (their detail halves) |
| 2 | the creation form rewritten onto the pocket endpoint | 10 |
| **3** | **the board's remaining wrong reads, then its visual rework — moved here from position 11 by the developer, 2026-08-29** | 7 |
| 4 | the pocket editor, and retiring the account editor's pocket branch | 6, 11 |
| 4 | the deletion confirmation and its freed-cash result | 13 |
| 5 | **backend** — the eligible-account list gains its two committed-cash figures | §9.4 requirement |
| 6 | committing and releasing cash, with the source picker | 12 |
| 7 | the pocket allocation entry detail | 9 |
| 8 | the account detail's committed-cash block | 14 |
| 9 | the overview's three pocket removals — **implemented, `b40c4b8`** | 15 |
| 10 | removing the pocket from both transfer selectors — **implemented, `bafa8b6`** | 16 |
| 11 | the board's remaining wrong reads, then its visual rework | 7 |
| 12 | extracting the shared skeleton and empty-state primitives | 5 |
| 13 | retiring the legacy pocket account type — **implemented, `02b0a04`; the gate on migration 020 opened 2026-08-30** | 0, 17 |

> ### RE-MEASURED 2026-08-30 — where each unit actually stands
>
> **Ten of the thirteen have landed.** Measured against the working tree,
> uncommitted files included. The unit sections below are left as written; each
> one that moved carries its own dated block.
>
> | order | state | the evidence |
> |---|---|---|
> | 1 · the detail chain | **built** | `pocketTypes.ts:124-198`, `urlConfig.ts:268`, `pocketApi.ts:63`, `stores/usePocketDetailStore.ts`, `PocketDetail.tsx`, `SummaryPocketDetailBox.tsx`, plus the seventh file its open decision asked for: `pocketDetail-styles.css`, 587 lines |
> | 2 · the creation form | **built** | `NewPocket.tsx:200-211` sends the five contract keys and `:224` navigates to the created pocket; `url_pocket_create` at `urlConfig.ts:258`; the legacy URL deleted |
> | 3 · the pocket editor | **built, except the layout reduction** | `EditPocket.tsx` (536 lines) on `App.tsx:352`, opened by `PocketEditLink.tsx`; the account editor's pocket branch is gone. **`PocketLayout.tsx` is unchanged** — it still issues the fetch (`:26`), still holds the 3-second timer (`:29-35`) and still renders the inline-red error paragraph (`:81-93`) |
> | 4 · the deletion confirmation | **built** | `deletePocketModal/DeletePocketModal.tsx` (243 lines), `deletePocket` (`pocketApi.ts:123`), `DeletePocketResult` (`pocketTypes.ts:256`) |
> | 5 · the eligible-account list | **built** | `getAccountController.js:431-462`, `bank` only, a row the allocation read filtered out left unset rather than zeroed |
> | 6 · committing and releasing | **built** | `pocketCashModal/PocketCashModal.tsx` (398 lines) with `PocketSourcePicker.tsx`; `allocateToPocket` and `releaseFromPocket` (`pocketApi.ts:144`, `:159`) |
> | 7 · the allocation entry detail | **built, by extraction as recommended** | `allocationEntryModal/AllocationEntryModal.tsx` over a shared `general_components/fxPathwayCard/` |
> | 8 · the account detail's block | **untouched** | `AccountDetail.tsx:96` still branches the url to `null` on route state; `AccountListType` (`types/responseApiTypes.ts:303`) declares none of the four fields; no `AccountPocketAllocations` |
> | 11 · the board | **substantially built** | the five-level partition in `helpers/pocketStatus.ts`, the three-tile header in `PocketBigBoxResult.tsx:154-192`, the card in `ListPocket.tsx`, one create control in `Pocket.tsx:32-38`. Not built: search, sort and the filter chips |
> | 12 · the shared primitives | **untouched** | no `general_components/skeleton/` and no `general_components/emptyState/`; both the board and the detail declare their own |
> | 13 · retiring the legacy account type | **complete on both sides** | zero mentions of `pocket_saving` under `frontend/src`, and the server route is withdrawn too (`accountRoutes.js:57-62`, `accountCreationController.js:977-985`) |

---

### Unit 1 — the pocket detail chain, endpoint to screen

**What it unblocks.** Every write in the module. Create, edit, allocate and
release all answer with this exact payload, so typing it once types five of the
seven endpoints; and `setDetailFromWrite` — the action that seats a write's own
answer instead of refetching it — is the reason each of those four units is one
commit rather than two. It also removes the module's most consequential live
read.

**What it needs first.** Nothing. This is the root of the graph.

**Files.**

- `frontend/src/fintrack/types/pocketTypes.ts` — modified; the detail contract
  appended below the board half, which stays untouched
- `frontend/src/urlConfig.ts` — modified; one declaration beside
  `url_pocket_board` (`:248`), a function of the id
- `frontend/src/fintrack/api/pocketApi.ts` — modified; one function beside
  `getPocketBoard`, unwrapping the envelope the way `:25-31` already does
- `frontend/src/fintrack/stores/usePocketDetailStore.ts` — **created**
- `frontend/src/fintrack/pages/forms/pocketDetail/PocketDetail.tsx` — rewritten
  onto the store; both legacy fetches (`:79`, `:104`), the seed constant, the
  transaction statement and the transaction-detail modal deleted
- `frontend/src/fintrack/pages/forms/pocketDetail/summaryPocketDetailBox/SummaryPocketDetailBox.tsx`
  — rewritten onto the served figures; `Saved` (`:20`), the derived remainder
  (`:22`) and the derived percentage (`:45-48`) deleted
- a stylesheet of its own — **see the open decision below**

**Open decisions inside it.**

| decision | recommendation | why, in one sentence |
|---|---|---|
| the hero is rewritten in place, or retired for the shared cream `SummaryDetailBox` plus three new components | **rewrite in place**, keeping the six-file boundary | the plan's component split exists to host the write actions, and this unit ships none of them, so splitting now creates four files whose props change again in the very next unit that touches them |
| the detail stylesheet is a seventh file, or the markup reuses the statement's classes | **a seventh file** | forcing new markup onto classes named for a transaction statement is what makes the next reader believe a pocket has transactions, and the alternative — inline values — is barred by the token rule |
| the loading skeleton is local, or waits for a shared primitive | **local, as the board already does** at `pocket-styles.css:334-372` | an abstraction drawn from one call site is a guess about the second; unit 12 extracts it from two real ones |

**Acceptance criterion.** With an account and a pocket that share the same
numeric id, opening the card from the board issues **exactly one** request, whose
path ends `pocket/<id>`, and **zero** requests whose path contains `account/`.
The title is the pocket's name.

---

### Unit 2 — the creation form rewritten onto the pocket endpoint

**What it unblocks.** Every pocket that will ever exist. Nothing downstream can
be exercised on real data until a pocket can be made from the app; today the
module's only creation path writes into the retired model and the board stays
empty forever.

**What it needs first.** Unit 1, for two independent reasons and either alone is
sufficient. Success answers `201` with the **whole detail payload**
(`pocketController.js:141-145`), which is seated through `setDetailFromWrite` so
the created pocket's detail issues zero requests — no detail store, nowhere to
seat it. And a working create form is what puts rows on the board and arms the
wrong-id-space read; unit 1 is what disarms it.

**Files.**

- `frontend/src/fintrack/pages/forms/newPocket/NewPocket.tsx` — rewritten; the
  legacy payload at `:214-225` (`type: 'pocket_saving'`, `target`,
  `desired_date`) and the endpoint at `:113` replaced by the five contract keys
  `{name, note?, targetAmount, currency, desiredDate}`
- `frontend/src/urlConfig.ts` — the create declaration added;
  `url_create_pocket_saving_account` (`:74-75`) deleted
- `frontend/src/fintrack/api/pocketApi.ts` — `createPocket`
- `frontend/src/fintrack/validations/zod_schemas/pocketSchemas.ts` — created
- `frontend/src/fintrack/validations/utils/inputConstraints/nameMaxLengths.ts` —
  the two limits raised

**Open decisions inside it.**

| decision | recommendation | why, in one sentence |
|---|---|---|
| the object is called **Pocket** or **Goal** in the interface | **Pocket is the object; *goal* names only its target** — *"$2,800 still to commit to reach this goal"* | two nouns for one object is exactly how the retired model's *saved* and *balance* reached the current screen, and this is the first unit whose copy names the object to the user in a title, a button and a success message. **This is the developer's to settle, not mine** |
| the name and note length limits | **raise `pocket_name` to 50 and `note` to 155, both in place** — no new key | **measured, and it corrects two documents:** `NAME_MAX_LENGTHS.note` has exactly one consumer in the whole repository, `NewPocket.tsx:386` and `:400`; the claim in `PLAN_POCKET_FE.md` §9.6 and `POCKET_VISUAL_PROPOSAL.md` §5.5 that the key is shared with four or five other forms is false, so the separate `pocket_note` key those documents recommend has nothing to protect |
| a write invalidates the board or refreshes it | **invalidate**, here and for edit, allocate and release; **refresh** only for delete | both actions already exist (`usePocketBoardStore.ts:91` and `:93`), and the distinction is where the owner is left standing: these four leave them on the detail, so a refetch buys nothing, while delete lands them on the board and must refresh |
| the currency badge has a client-side default | **no default** | `currency` has none on the server deliberately (`pocketValidators.js:28-31`); a client-side default is the exact defect migration 014 documents |

**Acceptance criterion.** The network panel shows one `POST` to `pocket/` whose
body carries exactly the five contract keys, `desiredDate` as a `YYYY-MM-DD`
string, and the created pocket appears on the board.

---

### Unit 3 — the pocket editor, and retiring the account editor's pocket branch

**What it unblocks.** The fourth detail card's edit control, which is the only
one of four still dead — the account (`a9488d8`), the debtor (`32baed3`) and the
category (`610e399`) all gained a working one this week. It also removes the last
write path that reaches a pocket through the account model, which the legacy
sweep at unit 13 depends on being gone.

**What it needs first.** Unit 1, because `PATCH /pocket/:pocketId` answers with
the whole detail payload and the editor repaints the detail from that one
response. Not a preference: without the detail store the editor has nowhere to
put its answer and would have to refetch a screen the response had already
filled.

**Files.**

- `frontend/src/App.tsx` — the fourth route slot,
  `pocket/pockets/:pocketId/edit`; three pocket paths exist today (`:209`,
  `:290`, `:336`) and no edit slot
- a new `EditPocket` screen
- `frontend/src/fintrack/pages/forms/pocketDetail/PocketDetail.tsx` — the dead
  `<div id='edit'>` at `:161-163` replaced by a `Link`, markup copied from
  `general_components/accountEditLink/AccountEditLink.tsx`
- `frontend/src/fintrack/pages/pocket/PocketLayout.tsx` — reduced to header plus
  `Outlet`; the module fetch at `:24-26`, the 3-second timer at `:28-34` and the
  absolutely-positioned inline-red error paragraph at `:85-97` deleted
- `frontend/src/fintrack/editionAndDeletion/validations_zod/editSchemas.ts` —
  the `pocket_saving` branch at `:26-52` and its registry entry `:101`
- `frontend/src/fintrack/editionAndDeletion/validations_zod/accountEditSchema.ts`
  — `:147-183`
- `frontend/src/fintrack/editionAndDeletion/utils/languages.ts` — the label at
  `:100`, `:217`, `:327`

**Open decision inside it.**

| decision | recommendation | why, in one sentence |
|---|---|---|
| the write actions are **modals or routes** | **`EditPocket` is a route; allocate, release and delete are modals** | the ground is the contract, not taste — allocate and release answer with the entire detail payload (`pocketController.js:213-220`), so a modal repaints the hero, the sources and the history from that one response, while a route unmounts the detail (declared beside `<Layout />` at `App.tsx:336`) and pays a second request to return to a screen the answer had already filled; edit is a route because it is the one write that needs an addressable slot the three sibling cards already establish. **This is the developer's to settle:** the plan settled modals, the visual proposal draws routes, and its own verification argued back to modals |

Note that the shared `AccountEditLink` **cannot** be reused: it navigates to a
hardcoded `/fintrack/account/${accountId}/edit` (`:59`), and passing a pocket id
there resolves it as an account id — the same id-space defect unit 1 removes,
restaged. Copy its markup, not its destination.

**Acceptance criterion.** Editing a pocket's target repaints the detail from the
`PATCH` response with **no second request**, and a search for `pocket_saving`
under `frontend/src/fintrack/editionAndDeletion/` returns nothing.

---

### Unit 4 — the deletion confirmation and its freed-cash result

**What it unblocks.** Nothing downstream. It is placed here because it is the
last write whose contract needs no backend work, and because a module that can
create and edit but not delete accumulates test rows the developer then removes
by hand.

**What it needs first.** Unit 1, for the detail store the confirmation reads its
figures from. Delete is the one write that does **not** answer with the detail
payload — it answers `{pocketId, name, freed[]}` — so it is also the one write
that must call `refreshBoard()` rather than `invalidate()`, because it lands the
owner on the board.

**Files.**

- a new `DeletePocketModal`
- `frontend/src/urlConfig.ts` and `frontend/src/fintrack/api/pocketApi.ts` — the
  delete declaration and function
- `frontend/src/fintrack/types/pocketTypes.ts` — the delete result type

**Open decisions inside it.** None. The endpoint is live (`pocketRoutes.js:59`)
and its refusal rule is settled: deletion is never refused for a non-zero net,
because the cash was only ever committed.

**Acceptance criterion.** The result renders the response's own `freed[]`, and
dismissing it lands on the board with **one** board request.

---

### Unit 5 — backend: the eligible-account list gains its two committed-cash figures

**What it unblocks.** The allocate form's source picker, and only that.

**What it needs first.** Nothing. It is scheduled here rather than earlier
because it is the first point at which its absence actually stops a unit.

**Why it is a real dependency and not a preference.** The picker must show, per
eligible account, the balance, what is committed to pockets and what is
unassigned cash — three figures side by side, precisely so no single number gets
called *available*. Measured: `getAccountById` attaches all four cross-module
fields at `getAccountController.js:798-801`, and `getAllAccountsByType`
(`:230-448`) attaches none of them — a search for `allocated`, `unassigned` or
`accountAllocationService` across its body returns nothing. The detail's
`sources[]` carries all three, but only for accounts **already** funding this
pocket, which is exactly the set the owner is not choosing from.

**Files.** `backend/src/fintrack_api/controllers/getAccountController.js`, inside
`getAllAccountsByType`, calling the same `accountAllocationService` the
single-account read already uses (imported at `:13`).

**What can proceed around it.** Not the allocate form. But **the release modal
can be built in full without it** — its picker reads `sources[]` from the detail
payload, which already carries all three figures for exactly the accounts release
can draw from. So the fallback, if this backend change slips, is to ship release
alone and hold allocate.

**Open decision inside it.**

| decision | recommendation | why, in one sentence |
|---|---|---|
| enrich the list, or have the picker fetch per selection | **enrich the list** | one field pair on an endpoint that already runs the query, computed by the same service the commit path validates against, so the business rule and the number on screen cannot drift; the alternative shows two of three figures blank at the moment of choosing and costs one request per selection change |
| whether `cash` accounts are enriched alongside `bank` | **bank only for V1** | no route creates a cash account and the account-detail controller's allowlist excludes the type, so enriching it serves nobody |

**Acceptance criterion.** `GET /account/type/?type=bank` returns `allocated` and
`unassignedCash` on every row, and the sum of `allocated` across the list equals
the sum of `totalAllocated` on the board for a single-currency board.

---

### Unit 6 — committing and releasing cash, with the source picker

**What it unblocks.** The module's whole reason for existing: until this ships, a
pocket can be created, edited and deleted but never funded, and every figure on
every screen reads zero.

**What it needs first.** Unit 1, for the detail store both writes hand their
answer to; unit 5, for the picker's three figures. Both are real: the first
because these are the two endpoints that answer with the entire detail payload,
the second because the picker cannot render two of its three columns without it.

**Files.**

- a new `AllocateModal`, a new `ReleaseModal`, a new `PocketSourcePicker`
- `frontend/src/urlConfig.ts` and `frontend/src/fintrack/api/pocketApi.ts` — the
  two declarations and the two functions
- `frontend/src/fintrack/types/pocketTypes.ts` — the two request types

**Open decisions inside it.**

| decision | recommendation | why, in one sentence |
|---|---|---|
| how a provider outage on the exchange rate is worded | **word it as a retry now and record the `503` as a backend requirement** | `currencyAmountConversion.js:56` throws a plain `Error` and a search for `503` across the whole pocket tree returns nothing, so a rate outage is indistinguishable from a defect today — which fixes what the copy may say, not whether the form can be built |
| the release amount input carries a minus sign | **no sign in the field; the sign lives in the button label** | the client never sends a sign — the row is written negative on the server |
| a note on an allocation | **not in V1** | `pocket_allocations` has no note column (`020_create_pocket_tables.sql:143-167`) and `allocationBodySchema` is `.strict()` over four keys; it is a migration plus a validator change, not a design decision |

**Acceptance criterion.** Committing cash from an account repaints the hero, the
source table and the history from **one** response, and an over-ceiling amount
renders the server's `422` verbatim with both figures. The word *available*
appears nowhere on the screen.

---

### Unit 7 — the pocket allocation entry detail

**What it unblocks.** Nothing. It is the last piece of the detail screen's
information architecture.

**What it needs first.** Unit 6, and this is a real dependency rather than a
preference: the modal renders one row of the allocation history, and until the
allocate path works there is no row of that shape to open in the running app that
was not inserted by hand.

**Files.** A new pocket allocation entry modal, plus — under the recommendation
below — a shared presentational piece extracted from
`accountDetailSharedComponents/accountTransactionDetailModal/`.

**Open decision inside it.**

| decision | recommendation | why, in one sentence |
|---|---|---|
| extract the FX-pathway block into a shared piece and build a new modal on it, or generalise the existing modal's prop from `transaction` to `movement` | **extract** | it satisfies the stated reason — nothing is fabricated — without putting a discriminated union on every transaction-only field of a 392-line component whose other caller is Account Detail, a screen unit 8 is already changing |

**Acceptance criterion.** A history row typed in the accounting currency shows no
conversion pathway; one typed in another currency shows the typed amount, the
rate at its full precision and the source. The rate is not printed through a
two-decimal amount formatter.

---

### Unit 8 — the account detail's committed-cash block

**What it unblocks.** Nothing in this module. It is the first of the three
cross-module integrations and it is the one that consumes capability the backend
already serves and nothing declares.

**What it needs first.** Nothing technically — the four fields are served at
`getAccountController.js:798-801` today. It is placed after the pocket screens
because the block reports figures that are all zero until unit 6 ships, so
verifying it before then proves only that zero renders.

**Files.**

- `frontend/src/fintrack/pages/forms/accountDetail/AccountDetail.tsx` — the
  `location.state.detailedData` branch at `:70` and the url short-circuit at
  `:96-98` deleted, so the screen always asks
- `frontend/src/fintrack/types/responseApiTypes.ts` — the four optional fields on
  `AccountListType` (`:334-338`)
- a new `AccountPocketAllocations` block

**Open decisions inside it.** One, and it is already answered against the
proposal: the block is gated by **account type**, not by whether allocations
exist. A bank account with nothing committed shows `0` committed and its whole
balance as unassigned cash, because zero committed is a measured fact about that
account; hiding the block there tells the owner the question does not apply when
the answer is simply zero.

**Acceptance criterion.** Opening a bank account **from the accounting
dashboard** — the path whose route state currently suppresses the request — shows
the committed figure, the unassigned cash and the pocket list.

---

### Unit 9 — the overview's three pocket removals

> **IMPLEMENTED 2026-08-30, commit `b40c4b8`** *"fix(overview): remove every
> pocket read"*. Every file and anchor below was found where it is stated. The
> reasoning below stands as written; only the state is now past.
>
> **What landed beyond the file list.** The removal of the two keys from
> `ApiRespDataType` made two comparisons in `overviewFetchAll.ts` (`:247`,
> `:258`) unreachable literals, which the type-checker rejects; following them
> out took the pocket balance type guard and its import with them. The
> savings-goals endpoint was the last reader of
> `url_get_total_account_balance_by_type` in `Overview.tsx`, so that import went
> too. **The response type `BalancePocketRespType` was deliberately left in
> `types/responseApiTypes.ts`** — nothing imports it now, but in a refactor
> mid-flight that is not proof it is dead.
>
> **The acceptance criterion governs the count, not the heading.** The unit's
> title says three removals; its own file list names a fourth site, the
> last-movements request on `movement=pocket` (`Overview.tsx:110-111`), and the
> criterion below names that request explicitly. All four went.

**What it unblocks.** Nothing. It removes assertions that contradict the frozen
model: a pocket has no balance, and its cash is already counted inside its bank
account, so counting it again in net worth double-counts it.

**What it needs first.** Nothing. Placed here because it is a removal, and a
removal that lands before the replacement screens work leaves the module with
less on screen than it started with.

**Files.** `pages/overview/OverviewLayout.tsx` (`:96-103`, `:144-145`, `:156`,
`:174`, `:184`), `pages/overview/Overview.tsx` (`:53`, `:85-87`, `:110-111`,
`:174-176`), and `pages/overview/components/SavingGoals.tsx` deleted.

**Open decisions inside it.** None.

**Acceptance criterion.** Net worth equals bank plus investment plus debtor, and
the overview issues no request naming `pocket_saving` or `movement=pocket`.

---

### Unit 10 — removing the pocket from both transfer selectors

> **IMPLEMENTED 2026-08-30, commit `bafa8b6`** *"fix(transfer): drop the pocket
> from both selectors"*. **All six sites were found at the anchors below**, the
> destination remap (`Transfer.tsx:263-264`) included — the reconciliation's
> count of six is confirmed against the five of `PLAN_POCKET_FE.md` §6.3.
>
> **What landed beyond the file list.** With the pocket branch gone, both remaps
> were the identity, so the two constants holding them were removed and the
> account queries now read `formData.originAccountType` and
> `formData.destinationAccountType` directly; the destination's truthiness guard
> is preserved. Two comments above the component asserted pocket accounts were
> an allowed transfer type and were corrected, which the criterion below
> requires.

**What it unblocks.** Nothing. A pocket holds no money, so there is nothing to
transfer to or from it; the operation does not exist in the frozen model.

**What it needs first.** Nothing.

**Files.** `pages/tracker/Transfer.tsx` at `:105`, `:113`, `:186-187` **and
`:263-264`** — the destination remap, which `PLAN_POCKET_FE.md` §6.3 does not
name and `POCKET_FE_RECONCILIATION.md` found; `types/types.ts:140-141`;
`validations/zod_schemas/trackerMovementSchema.ts:33-34`.

**Open decisions inside it.** None.

**Acceptance criterion.** A search for `pocket` under `frontend/src/fintrack/pages/tracker/`
returns nothing.

---

### Unit 11 — the board's remaining wrong reads, then its visual rework

> **MOVED TO POSITION 3 by the developer, 2026-08-29**, directly after the
> creation form. The reason the unit sat this late no longer holds, and the
> paragraph below that states it is superseded by the measurement that follows.
>
> **Why it no longer holds.** The dependency was about proof, not compilation:
> filters and summary tiles could not be verified against a board of zero
> pockets all reading zero. Migration 020 ran on 2026-08-29 and converted four
> legacy accounts into real pockets, and their deadlines give the variety the
> proof needed — one falls in the future and three have already passed, so the
> active, upcoming and overdue readings are all exercised by live data today.
>
> **What still cannot be proven at position 3, and is accepted as such.**
> Everything that needs a committed amount above zero: the progress bar with a
> real fill, the completed filter, and the excess reading. No allocation exists
> yet, so those land visually correct and read zero until cash can be committed.
> That is honest output, not a broken screen.
>
> **What the developer measured and objected to**, which is what moved the unit:
> the header receives four of the ten figures the summary serves and prints two
> of them, and the row card prints six of the fourteen fields its contract
> carries. The reference design's four header tiles are three-quarters served
> already, and its card is served entirely except for the names of the funding
> accounts — where the payload carries a count instead. The count stays: the
> card has no room for two account names and the detail screen already lists
> them one by one, so adding names to the board payload would cost a join for a
> line another screen answers. The list also has no scroll management at all —
> `.list__main__container` (`pocket-styles.css:104`) is a flex column with a gap
> and no bound — and that stylesheet declares a light-surface token that does
> not exist in `tokens.css`, the same defect just corrected in the detail hero.

**What it unblocks.** Nothing. This is where the cosmetic work is allowed to
start, and not before.

**What it needs first.** Units 2 and 6, and the dependency is about proof rather
than compilation: a filter row, a sort and a summary tile cannot be verified
against a board of zero pockets all reading zero. Nothing here compiles against
anything the earlier units produce.

**Two corrections come first, in the same commit, because they are wrong reads
rather than wrong looks.** The board's headline prints `totalTarget`
(`PocketBigBoxResult.tsx:57`) while `totalAllocated` — the figure the module
exists to report — is served and discarded; and the card's alert square is
derived from `remaining > 0` (`ListPocket.tsx:147-149`) while `funded` and
`overdue` are served, so a pocket three months ahead of schedule is marked
identically to one whose deadline has passed. Both read a served payload and pick
the wrong field out of it.

**Files.** `pages/pocket/Pocket.tsx` (the duplicated create control at `:43-49`
and `:55-61`, and the commented blocks between them), `pages/pocket/components/ListPocket.tsx`,
`pages/pocket/components/PocketBigBoxResult.tsx`, new board components, and
`pages/pocket/styles/pocket-styles.css` — whose legacy half above `:255` still
carries the invalid `color: cyan f` (`:145`), the duplicated `.pocketLayout`
(`:4`, `:11`), two `!important` (`:14`, `:249`) and four raw colours. The
byte-identical dead copy at `pages/budget/components/ListPocket.tsx` and
`DEFAULT_POCKET_LIST` (`helpers/constants.ts:187`) go out here.

**Open decisions inside it.** All three are layout and all three are the
frontend designer's under the plan's reservation of the pixel design:

| decision | recommendation | why, in one sentence |
|---|---|---|
| the filter chips carry counts | **no counts on the chips** | three of the four counts are served and `activeCount` is not, so the chip row would mix four server figures with one the client folded — a second place a total can be wrong |
| one card per row, or two | **one through 768px, two from 768px up**, inside the unchanged 40rem column | a card carrying seven figures at roughly 300px is where the collision risk at 360px reappears at a wider viewport; this is the layout call to look at on a real screen first |
| the progress indicator is a bar or a ring | **a linear bar in both places** | the specification wins over the reference image, and the bar needs one value with no token where the ring needs two |
| the token-written block at `pocket-styles.css:255-380` is extended or replaced | **extend it** | it already ships the three fetch states token-only with a reduced-motion block, so replacing it discards work that already follows the module's own rules |

**Acceptance criterion.** The board's headline is `totalAllocated`; a pocket
whose deadline has passed and one three months ahead of schedule carry different
marks; exactly one create control exists; and a search for `?? 0` across the
board files returns nothing.

---

### Unit 12 — extracting the shared skeleton and empty-state primitives

**What it unblocks.** Nothing in this module. It pays down the duplication the
sequence deliberately created.

**What it needs first.** Units 1 and 11, and the dependency is the point of the
unit: an abstraction drawn from one call site is a guess about the second. After
the detail declares its skeleton locally and the board declares its own, there
are two real uses to extract from.

**Files.** New `general_components/skeleton/` and
`general_components/emptyState/`, plus the two call sites that adopt them.

**Open decisions inside it.** None.

**Acceptance criterion.** Both primitives render from tokens only, and a search
for a hex literal or a raw `px` value in their stylesheets returns nothing.

---

### Unit 13 — retiring the legacy pocket account type

> **IMPLEMENTED 2026-08-30, commit `02b0a04`** *"refactor(pocket): retire the
> legacy account type"*. The reasoning below stands as written; the gate it
> describes has since opened, and the state is now past.
>
> **The gate is satisfied, on both counts it names.** The pocket tables migration
> has run: measured on the development database, no account of the retired type
> exists, live or soft-deleted, the legacy extension table is empty, four
> converted rows sit in the pockets table, and the chain on disk ends at `020`
> with no gap. And the last frontend code that could edit an account of that type
> went with `614c553`, along with the account editor's whole branch for it.
>
> **The file count was five, not the thirteen recorded below** — the sweeps of
> the summary screen (`b40c4b8`) and the transfer selectors (`bafa8b6`) had
> already taken three of them. What went: the seed constant of the retired type
> and its import (`helpers/constants.ts`), the accounting dashboard's tile and
> its route entry (`AccountingDashboard.tsx`), and four response structures
> (`types/responseApiTypes.ts`). The compiler then named the closed union
> recording where a deadline came from as an unused import, which went with them.
>
> **The open decision below is closed in the recommended direction.** The
> dashboard's entry was deleted with its tile; an account of the retired type now
> falls through the route map's own default to the account detail,
> `/fintrack/overview/accounts`, so no account id ever enters the pocket route.
>
> **Two mentions survive by decision, so the criterion below is met in substance
> rather than literally.** The endpoint declaration that writes an account of the
> retired type (`urlConfig.ts:72-75`) and its comment stay: withdrawing the
> server route is not this unit, and nothing on the client calls it. And a
> comment citing the database CHECK on
> `pocket_saving_accounts.desired_date_source` (`types/types.ts:212`) stays,
> because it is a true statement about a table the migration deliberately keeps
> alive.
>
> **Suspected dead, not proven, so left standing.** Two exported types now have
> no importer: the total-balance response of the retired type
> (`BalancePocketRespType`) and the closed union recording whether a pocket's
> deadline was typed by the owner or invented by the controller
> (`DesiredDateSourceType`). The new module carries a deadline but no source
> discriminator, so the union may yet be wanted when the pace figures land. In a
> refactor mid-flight, "nothing imports it" is blast radius, not permission.
>
> > **CORRECTED 2026-08-30, later the same day.** Two statements in this block
> > have moved.
> >
> > **The two surviving mentions are gone; the count is zero, not two.** A grep
> > for `pocket_saving` across `frontend/src` returns nothing:
> > `urlConfig.ts:72-75` is now a comment with no export beside it, and the
> > `types.ts` comment citing the database CHECK is deleted. The criterion at the
> > foot of this unit — *a search for `pocket_saving` under `frontend/src`
> > returns nothing* — is therefore met literally, not only in substance.
> >
> > **Of the two types left standing, one is gone and one remains.**
> > `DesiredDateSourceType` no longer exists anywhere under `frontend/src`;
> > `BalancePocketRespType` is still declared at
> > `types/responseApiTypes.ts:28`, still with no importer, alongside
> > `BalancePocketSavingRespType` (`:44`), `PocketListSummaryType` (`:492`) and
> > `PocketListType` (`:498`) — four account-shaped pocket response types, not
> > one.
> >
> > **And the withdrawal went further than this unit's scope.** The server route
> > that created an account of the retired type is withdrawn too
> > (`accountRoutes.js:57-62`, `accountCreationController.js:977-985`), which
> > this unit explicitly left out of its own boundary.

**What it unblocks.** Nothing. It is the last unit by construction.

**What it needs first.** **Migration `020_create_pocket_tables.sql` having
actually run**, which is not visible from the repository. This is a real gate,
not a preference: the migration deliberately keeps the `pocket_saving` catalog
row and the `pocket_saving_accounts` table alive (`:32-40`), so removing the type
from the frontend union while the database still serves it makes any surviving
legacy account row render untyped. It also needs unit 3, which deletes the last
frontend code that edits that type.

**Files.** Thirteen frontend files still name `pocket_saving`, including
`types/types.ts:141`, `helpers/constants.ts`, and the accounting dashboard's tile
(`AccountingDashboard.tsx:51`) and its route entry (`:64`).

**Open decision inside it — and it contradicts two documents.**

`PLAN_POCKET_FE.md` §9.2 and `POCKET_FE_RECONCILIATION.md` §6 both recommend
repointing the dashboard's pocket row from `/fintrack/budget/pockets` to
`/fintrack/pocket/pockets` as a standalone one-line defect commit that *"depends
on nothing"*. **Measured, it does not.** The dashboard groups `user_accounts`
rows by `account_type_name` and composes its destination as
`${baseRoute}/${account.account_id}` (`AccountingDashboard.tsx:446`), so the id
it carries is an **account** id. Repointing it at the pocket detail feeds an
account id into the pocket-id route — the same id-space defect unit 1 exists to
remove, restaged in the opposite direction, and it becomes live the moment unit 1
lands.

| option | consequence |
|---|---|
| **point it at the account detail, `/fintrack/overview/accounts`, and let unit 13 delete the entry with the tile** — recommended | a legacy `pocket_saving` row *is* an account until the migration removes it, so this is the honest destination; one line, no id-space violation, and the sweep discards it anyway |
| repoint it at the pocket detail, as the two documents recommend | an account id enters the pocket route; today it is a `403`, and once accounts and pockets share numeric ids it is the wrong pocket |
| leave it pointing at a route the router does not declare | it fails loudly at the error element, which is worse copy but not a wrong figure — acceptable only until the sweep |

**Acceptance criterion.** A search for `pocket_saving` under `frontend/src/`
returns nothing.

---

### Deferred backend requirements — recorded, not scheduled

None of the three blocks a unit above; each fixes what a screen is allowed to
say or show.

| requirement | what it changes | when |
|---|---|---|
| an unavailable exchange rate answers `503` rather than `500` (`currencyAmountConversion.js:56`) | the four write forms can offer a retry instead of reporting a defect | before or after unit 6; it changes copy, not structure |
| `GET /pocket/:pocketId` serves the goal's typed pair — the original amount, its currency, and the rate that produced the stored figure | the hero can show `€5,000` beside `$5,000`, which every history row below it can already do | additive; nothing built now has to be unbuilt |
| `createPocketBodySchema` learns the optional initial-commitment keys — it is `.strict()` over exactly five today (`pocketValidators.js:67-81`) | an opening commitment on the creation form | only if the developer wants it; the model's own comment at `:60-64` says a pocket is created empty on purpose, so the honest default is not to build it |

---

## 3. The two defects, and how their tension was resolved

> **CORRECTED 2026-08-30 — both defects are closed and the tension has no
> subject.** The creation form writes a row of `pockets`
> (`NewPocket.tsx:200-211` → `createPocket`, `pocketApi.ts:79`), and the endpoint
> it used to post to is withdrawn on both sides — `url_create_pocket_saving_account`
> is deleted from `urlConfig.ts` and the route is a comment at
> `accountRoutes.js:57-62`. The detail screen keeps the route parameter's name
> (`PocketDetail.tsx:75`) and issues no request whose path contains `account`.
> The section is kept because the ordering it argues for is the one that was
> executed, and the argument is the record of why.

### The tension, stated plainly

The graver defect is the one whose fix arms the other. Ranked by what a user
meets first, the creation form is worse; ranked by what a user is shown, the
detail screen is worse. Fixing the creation form first is precisely what puts
rows on the board and makes every card lead to the detail screen's wrong read.

### The creation form writes the wrong entity

**Severity: high — reachable today, from the module's own screen, on an empty
database, with no precondition and no error anywhere on the path.**

`NewPocket.tsx:113` posts to `url_create_pocket_saving_account`
(`urlConfig.ts:74-75`), which writes a `user_accounts` row plus a
`pocket_saving_accounts` row (`accountCreationController.js:932`); the board
reads `FROM pockets` (`pocketRepository.js:62-84`). Migration 020 deliberately
keeps both legacy structures alive, so the endpoint answers `201`, the user reads
*"New Pocket account successfully created!"* (`NewPocket.tsx:129`), and the board
stays empty forever.

**What it costs: a false success and a junk row.** It exposes no figure, corrupts
no pocket data — there are no pockets to corrupt — and misattributes nothing. It
is a lie, not a leak.

**Placed second**, immediately after the detail chain.

### The detail screen spends a pocket id as an account id

**Severity: critical in consequence, latent in reach.** It cannot fire today
because the `pockets` table can hold no rows; shipping the creation form first is
exactly what arms it.

`PocketDetail.tsx:58` renames the route parameter — `const { pocketId: accountId }
= useParams()` — and `:79` and `:104` then spend it against
`GET /account/:accountId` and the transaction statement. Both id sequences start
at 1 (`020_create_pocket_tables.sql:84`), so the collision is the default case.
The screen renders that account's name as the pocket's title (`:154`), its
balance under the label *Saved*, its full transaction statement (`:236-239`), and
`NaN%` where a bank account has no `target`. On a miss it renders a frontend seed
constant's invented figures — a target of `$0`, a committed figure of `$0` and
`100.0%`.

**One precision the source documents do not state, and it bounds the severity.**
`getAccountById` resolves `WHERE ua.account_id = $1 AND ua.user_id = $2`
(`getAccountController.js:537`), so the account shown always belongs to the same
user. This is total misattribution of one of the owner's own accounts, not a
cross-user disclosure. That does not soften the ordering — a screen that presents
one account's statement under another object's name is unshippable either way —
but it means the defect is a correctness failure, not a privacy incident.

**Placed first.**

### Why that resolution and not the other

**Because the window each ordering opens is not the same length or the same
kind.**

Ship the detail chain first, and the creation defect stays live for exactly one
commit. During that window its whole cost is a false success message and a junk
account row on a local test bed — and the developer can seed pockets through the
live endpoints directly, which is what the detail chain's acceptance criterion
requires anyway.

Ship the creation form first, and the detail defect goes from unreachable to
reachable from every card on the board, for as long as the detail chain takes.
Its cost is a screen presenting another account's money as a pocket's. **An
ordering that turns a latent critical defect into a live one, in order to close a
high one a commit earlier, trades down.**

**One option considered and not recommended: an interim commit that disables the
broken create control** before the detail chain. It removes the false success at
near-zero cost and arms nothing. It is declined because it is a third commit
spanning a two-commit window, it deletes the only creation affordance the module
has while offering no replacement, and unit 2 removes the same defect properly
one commit later. If the developer wants the lie gone immediately, this is the
cheap way to do it — but the sequence does not need it.

---

## 4. What stays blocked, and on what

> **RE-MEASURED 2026-08-30 — two of the five rows below no longer block
> anything.**
>
> - **The source picker (row 1) is unblocked and built.**
>   `getAccountController.js:431-462` attaches the committed total, the
>   uncommitted cash and the over-allocation flag to every row of the
>   accounts-by-type list when the type is `bank`;
>   `PocketSourcePicker.tsx` renders all three, and the release side reads
>   `sources[].heldByThisPocket` from the detail payload as this row predicted.
> - **The retirement of the legacy account type (row 2) has run**, on the client
>   and on the server.
> - **Rows 3, 4 and 5 stand unchanged.** `createPocketBodySchema` is still
>   `.strict()` over five keys (`validation/zod/pocketValidators.js:65-81`); a
>   grep for `503` across `fx_services/`, `pocket_services/`,
>   `pocketController.js` and `pocketValidators.js` returns nothing; and the
>   pocket's six FX columns are written by `insertPocket`
>   (`pocketRepository.js:189-190`) and maintained by `updatePocket`
>   (`:244-248`) while **no read query selects any of them** — the history rows'
>   FX fields at `:155-160` are the allocation's, not the goal's.

| what is blocked, in words | the gate, in words | can anything proceed around it |
|---|---|---|
| the allocate form's source picker (unit 6) | **no endpoint serves the eligible-account list with what each account has committed and what it has free.** `getAccountById` attaches all four cross-module fields (`getAccountController.js:798-801`); `getAllAccountsByType` (`:230-448`) attaches none | **Yes, partly.** The release modal is fully buildable today — its picker reads `sources[]` from the detail payload, which carries all three figures for exactly the accounts release can draw from. The modal shell, both client functions and the `422` ceiling copy are also unblocked. Only allocate's picker waits. **Recommended: ship the backend field pair as unit 5 and keep allocate and release together**, because they are one symmetric pair and splitting them writes the same modal shell twice |
| retiring the legacy pocket account type (unit 13) | **migration 020 having actually run,** which the repository cannot show. The migration deliberately keeps the `pocket_saving` catalog row and table alive (`:32-40`) | Yes — every other unit. Nothing else in the sequence touches the account-type union |
| an opening commitment on the creation form | **the create validator is `.strict()` over exactly five keys** (`pocketValidators.js:67-81`) and rejects the block's keys with a `400` naming the field | Yes — the creation form itself, without the block. The model's own comment at `:60-64` says a pocket is created empty on purpose |
| what the four write forms' error copy may say | **a rate outage answers `500`, not `503`** — a search for `503` across the whole pocket service tree and its controller returns nothing | Yes — all four forms. It fixes the wording, not the structure |
| the hero showing the goal's typed currency beside the converted figure | **six FX columns on `pockets` record it and no read query selects any of them** | Yes — the whole detail. The pair is additive when it arrives and nothing built now has to be unbuilt |

---

## 5. The decisions waiting on the developer

Two are his by nature. The rest carry a recommendation and are settled by
approving the unit they sit in.

### 5.1 Is the object a **Pocket** or a **Goal**? — falls at unit 2

The module, the route, the table, the endpoints and the reference image's own
button all say **Pocket**; the visual proposal's copy says *New goal*, *Create
goal*, *Active goals*. The frozen vocabulary bans *budget*, bare *allocation* and
*saved*, and does not rule on *goal*.

**Recommendation: the object is a Pocket and the word *goal* names only its
target.** Two nouns for one object is exactly how the retired model's *saved* and
*balance* reached the current screen. **It is copy, and it is his.**

### 5.2 Modals or routes for the write actions? — falls at unit 3

Three documents point three ways: the plan settled `EditPocket` as a route and
allocate, release and delete as modals; the visual proposal draws all three as
routes; the verification of that proposal argued back to modals.

**Recommendation: modals, on the contract ground.** Allocate and release answer
with the entire detail payload (`pocketController.js:213-220`), so a modal
repaints the hero, the source table and the history from that one response, while
a route unmounts the detail — which is declared beside `<Layout />` at
`App.tsx:336`, so it unmounts the layout too — and pays a second request to
return to a screen the answer had already filled. Edit stays a route because it
is the one write that needs an addressable slot, matching the three sibling
detail cards.

### 5.3 The decisions carried by a unit, each with its recommendation

> **MEASURED 2026-08-30 — what the code did with each row. A reading, not a
> closure: none of these decisions is settled here.**
>
> | decision | what shipped |
> |---|---|
> | the hero rewritten in place | **in place.** `SummaryPocketDetailBox.tsx`, 126 lines, on the served figures |
> | the detail stylesheet as a seventh file | **a seventh file.** `pocketDetail-styles.css`, 587 lines |
> | the loading skeleton local | **local.** `PocketDetail.tsx:221-228` over `.pocketDetail__skeletonHero` / `.pocketDetail__skeletonRow`; no shared primitive exists |
> | the two length limits | **raised in place, no new key.** `nameMaxLengths.ts:20` reads `pocket_name: 50` and `:16` reads `note: 155`. The measurement that justified it holds: `NAME_MAX_LENGTHS.note` has exactly two consumers, both pocket forms — `NewPocket.tsx:333`, `:347` and `EditPocket.tsx:431`, `:445` |
> | a write invalidates the board or refreshes it | **invalidate.** `NewPocket.tsx:222` calls `usePocketBoardStore.getState().invalidate()`; both bus subscriptions do the same (`usePocketBoardStore.ts:104-113`), and `refreshBoard` (`:95`) is wired to the board's retry control |
> | the dashboard's pocket row destination | **neither option.** The tile and its route entry were deleted rather than repointed, so no row of that type has a destination of its own; the card now labels an unknown type from the tile map's `other` entry (`AccountingDashboard.tsx:622-632`) |
> | the allocation entry modal: extract or generalise | **extracted.** `general_components/fxPathwayCard/FxPathwayCard.tsx`, consumed by `allocationEntryModal/AllocationEntryModal.tsx` |
> | filter chip counts, one card or two, bar or ring | **not reached.** The board has no toolbar, so the chip question is unexercised; the progress indicator is a bar on both the header (`PocketBigBoxResult.tsx:323-340`) and the card (`ListPocket.tsx:222-234`) |

| decision | unit | recommendation |
|---|---|---|
| the hero rewritten in place, or retired for the shared cream box plus three components | 1 | **rewrite in place** |
| the detail stylesheet as a seventh file | 1 | **yes, seventh file** |
| the loading skeleton local, or waiting for a shared primitive | 1 | **local now, extracted in unit 12 from two call sites** |
| the two length limits | 2 | **raise `pocket_name` to 50 and `note` to 155 in place; no new key** — measured, the shared-key premise is false |
| a write invalidates the board or refreshes it | 2 | **invalidate for create, edit, allocate, release; refresh for delete** |
| the dashboard's pocket row destination | 13 | **the account detail, not the pocket detail** — measured, the id it carries is an account id |
| filter chip counts, one card or two, bar or ring, extend or replace the stylesheet | 11 | no counts; one then two at 768px; bar; extend |
| the allocation entry modal: extract or generalise | 7 | **extract the FX block** |

---

## 6. Where the input documents contradict each other or the code

Named rather than absorbed, with which one this sequence followed.

| the disagreement | followed |
|---|---|
| `POCKET_FE_RECONCILIATION.md` §3.1 reports the board as a live runtime break reading `accountId`, `accountName` and `saved`; §3.3 reports the client returning the envelope; and its unit rows for the contract, the client and the board are marked Partial-and-adverse | **the code.** All three are stale: the reconciliation was measured before `8c7ca8f`. `pocketTypes.ts:27-62` now declares `pocketId`, `name` and `allocated`; `pocketApi.ts:25-31` unwraps and returns the payload; `ListPocket.tsx:95-104` destructures the served names. Those units are done and are not in this sequence |
| `PLAN_POCKET_FE.md` §9.2 and `POCKET_FE_RECONCILIATION.md` §6 both recommend repointing the accounting dashboard's pocket row at the pocket detail as a standalone commit depending on nothing | **the code.** `AccountingDashboard.tsx:446` composes `${baseRoute}/${account.account_id}` — an account id. The repoint would restage the id-space defect. Moved into unit 13 with a different destination |
| `PLAN_POCKET_FE.md` §9.6 and `POCKET_VISUAL_PROPOSAL.md` §5.5 both assert the note-length key is shared with four or five other forms, and both recommend a separate `pocket_note` key to protect them | **the code.** `NAME_MAX_LENGTHS.note` has exactly one consumer in the repository — `NewPocket.tsx:386` and `:400`. The separate key protects nothing; raise it in place |
| `POCKET_DETAIL_SPEC.md` §8.1 rewrites the hero in place; `PLAN_POCKET_FE.md` §7.2 and its unit 8 retire it for the shared `SummaryDetailBox` plus three new components | **the specification**, recorded as an open decision at unit 1 with its reasoning, not resolved silently |
| `PLAN_POCKET_FE.md` §4.3 has every write call `invalidate()`; the landed board store's own comment at `usePocketBoardStore.ts:38-42` argues for `refreshBoard()` | **neither wholesale.** Split by where the owner is left standing — recorded at unit 2 |
| `PLAN_POCKET_FE.md` §9.1 treats one real legacy pocket account as live with an open question attached; `020_create_pocket_tables.sql:18-24` records it as already deleted by the owner and the question as closed | **not resolved here — the developer knows which measurement is current.** It does not change the ordering: unit 13 is last either way, gated on the migration having run. **See the dated measurement added below.** |
| `PLAN_POCKET_FE.md` §6.3 names five transfer sites; `POCKET_FE_RECONCILIATION.md` found a sixth at `Transfer.tsx:263-264` | **the reconciliation.** Unit 10 lists six |

> **MEASURED 2026-08-30 — development database `fintrack_dev`, read-only.**
> Against the sixth row of that table, the one about the surviving legacy pocket
> account. Taken through the connection `backend/.env` resolves to, `localhost`,
> database `fintrack_dev`. **Zero accounts of the retired pocket type exist**
> (`user_accounts WHERE account_type_id = 4` returns 0), the legacy extension
> table `pocket_saving_accounts` is empty, and **the `pockets` table holds four
> converted rows** — `ahorro`, `pocket de prueba`, `travels`, `test` — with
> `pocket_allocations` still empty. The ledger of that database ends in `018`,
> `019`, `020`, so **migration `020` has run there.**
>
> **This narrows the gate on retiring the legacy account type; it does not open
> it.** What it settles: on the development database the account type has no
> surviving rows, so nothing there waits on the open question. What it does not
> settle: account `108` lives in the copy of production data, and that database
> was not read. **The ordering is unchanged** — retiring the legacy account type
> stays last, gated on the migration having run against the database that
> matters, which is still not something the repository can show. The same
> measurement is recorded in `PLAN_POCKET_FE.md` §9.1.
>
> **The disagreement in that sixth row may be three databases and not two
> claims.** The migration header read **production** on 2026-08-24;
> `POCKET_DECISIONS.md` §19.10 read **the local production copy**
> `fintrack_prod_data` on 2026-08-29 and found account `108` alive with 90.00 in
> it; this block read **the development database** on 2026-08-30. A copy dumped
> before 2026-08-24 shows that account alive no matter when it is re-read.
> **Hypothesis, not finding** — the date the copy was taken is not recorded
> anywhere the repository can show, and that date is what would settle it. The
> side-by-side table is in `PLAN_POCKET_FE.md` §9.1.

---

## 7. What this document did not check

- **No server was started and no endpoint was called.** Every backend claim is a
  claim about what the source on this branch says it serves.
- **Whether migrations 019 and 020 have been run** against any database. It is
  the gate on the last unit and it is not visible from the repository.
- **No build was run.** No `tsc`, no `vite build`.
- **Nothing was rendered.** Every layout judgement at unit 11 is inherited from
  `POCKET_VISUAL_PROPOSAL.md`, which states the same limitation.
- **The pixel design of any screen**, which `PLAN_POCKET_FE.md` §11 reserves.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

Ten of the thirteen units this document orders have landed since it was written,
seven of them without a dated note in the unit section. Corrected in place;
nothing struck, no unit reordered and no decision closed.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the state of every unit | §2, under the sequence table | ten built, three open — the account detail's block, the shared primitives, and the board's toolbar half |
| the two surviving `pocket_saving` mentions, and the two types left standing | unit 13's implementation note | zero mentions under `frontend/src`; `DesiredDateSourceType` is gone and four account-shaped pocket response types survive, not one |
| the two defects and the tension between them | §3 | both closed; the ordering argued for is the one that was executed |
| the source picker's gate and the retirement gate | §4, rows 1 and 2 | both open; rows 3, 4 and 5 re-measured and unchanged |
| the eight unit-carried decisions | §5.3 | measured row by row in the block under its heading — a reading, not a closure |

**Left standing because they are still true:** the layout reduction of unit 3
(`PocketLayout.tsx` still fetches at `:26`, still holds the timer at `:29-35` and
still renders the inline-red paragraph at `:81-93`); the account detail's
conditional fetch and undeclared fields (unit 8); the absence of shared skeleton
and empty-state components (unit 12); and all three deferred backend
requirements — the `503` for an unavailable rate, the goal's typed pair on the
detail payload, and the initial-commitment keys on the creation validator.

**What was not re-measured:** the two open decisions of §5, which are the
developer's — whether the object is called a Pocket or a Goal, and modals versus
routes for the write actions. What shipped is recorded in §5.3's measurement
block; neither decision is closed here.
