# POCKET FE — RECONCILIATION AGAINST THE MERGED CODE

**Measured 2026-08-29 on `fix/auth-screen`, after the merge `68cb4f1`
*"merge(pocket): land the pocket backend and board"* (15 commits, 39 files,
3713 insertions). Lives in `plan-docs/`, which is gitignored: this document
produces no commit.**

> ## CORRECTION 2026-08-30 — read this before the body
>
> **This document is a measurement taken on 2026-08-29 and it is no longer a
> description of now.** Nine commits have landed against the pocket frontend
> since it was written, and they invalidate its two headline conclusions: that
> nothing is complete, and that the board is a live runtime break.
>
> **Re-measured on 2026-08-30 and marked in place:** the response contract, the
> URL declarations, the HTTP client, the two stores, the route slots, the board,
> the detail screen, the creation form, the edit route, and the gate on the
> commitment modals — rows 1, 2, 3, 4, 6, 7, 8, 10, 11, 12 and 17 of §2, plus
> §3.1, §3.3, §4 and §5. Each carries a dated correction where it stands.
>
> **Everything else was NOT re-measured** and stays as it was on 2026-08-29:
> rows 0, 5, 9, 10b, 13, 14, 15 and 16, and §3.2, §3.4, §3.5, §3.6, §6 and §7.
> Those lines are a reading of a tree that has since moved. Verify before acting.
>
> **The commits, oldest first:** the detail chain read from the pocket endpoint
> (`4a3ebd9`), the creation form rewritten onto it (`69a6b50`), the board reading
> the served fields (`2610585`), one create control left on the board with the
> duplicate card component deleted (`4d4a9f6`), the eligible-account list gaining
> what is committed and what is unassigned (`175a33a`), the pocket editor as its
> own route (`9ed0130`), a fuller card in a scrolling list (`a4057e0`), and the
> account editor's pocket branch removed (`614c553`). The account editor also
> learned to carry the origin route back (`a6c1f6c`).
>
> > ### SECOND CORRECTION, later on 2026-08-30
> >
> > **The re-measurement above has itself aged; five of its own rows are now
> > false.** Measured again against the working tree, uncommitted files included:
> > the two commitment endpoints have URLs, client functions and a screen; the
> > deletion modal and the allocation entry modal exist; the retired account type
> > has no reference left anywhere under `frontend/src`; and the pocket module's
> > board was rebuilt around a five-level partition. Rows 2, 3, 7, 12 and 17 of
> > §2-bis, plus §4 and §5, carry a second dated correction where they stand.

This document reconciles `PLAN_POCKET_FE.md` against the working tree. It does
not modify that plan and it does not touch `frontend/` or `backend/`. Every line
below was read from the file on this branch; nothing was inferred from a commit
message, for the reason `PLAN_EDIT_BLOCK.md` §7 records — the commit that landed
most of that block carried a message describing a different unit entirely, and
reading progress off `git log` produced a conclusion that was wrong in both
directions. **Progress is read from the diff, never from the message.**

---

## 0. Why this document exists

`PLAN_POCKET_FE.md` §0.2 states a premise: *"`fix/auth-screen` is the only
working tree that counts as available. Nothing of `/api/fintrack/pocket` is
reachable from it."* **That premise is false as of today.** The whole backend
module, its two migrations, the account-detail enrichment and a rewritten board
list all landed on this branch in one merge.

The plan's §0.2 also binds a clause about three frontend files that lived only on
the worktree — a board client, a response contract and a board store: *"those
three files may not be cherry-picked, copied, or used as a starting point … the
default action on a merge conflict in those three paths is take this plan's
version, discard theirs."*

**All three landed.** They are on this branch now, wired into a screen the user
can open, and the merge resolved in their favour because there was no version of
this plan's to take — units 1 to 4 had not been written. The binding clause was
not violated by anyone; it was overtaken. What it now describes is not a
temptation to resist but a state to reconcile, and that reconciliation is
below.

---

## 1. Headline — how much of the plan is already built

**Roughly one unit and a half of nineteen rows, and the part that landed is
built on the retired model, not on the frozen one.** The backend is complete and
matches the closed contract clause for clause: seven pocket endpoints are mounted
(`backend/src/fintrack_api/routes/pocketRoutes.js:27-65`), the board summary
serves all ten fields and the board row all fifteen
(`pocketBoardService.js:99-197`, `core/makePocketStatus.js:110-131`), the detail
serves the pocket, the source breakdown, the history with its five FX fields per
row and an empty `notices` array (`pocketDetailService.js:125-129`,
`core/makeAllocationEntry.js:43-54`), and the account-detail endpoint carries the
four cross-module fields (`getAccountController.js:798-801`). On the frontend,
what exists is: a response contract file at the plan's target path holding the
**legacy** contract, a board store, a rewritten board list with three distinct
fetch states, and a token-written block appended to the module stylesheet. Of the
plan's seven HTTP client functions **one** exists; of its six URL declarations
**one** exists; of its two stores **one** exists, and the missing one is the one
the entire write model rests on.

**The consequential finding is not a count.** The board that landed is typed
against a response the server no longer sends: it destructures `accountId`,
`accountName` and `saved` (`pages/pocket/components/ListPocket.tsx:97-106`) and
the board endpoint serves `pocketId`, `name` and `allocated`
(`core/makePocketStatus.js:110-131`). Three of the eight values the card renders
are `undefined` at runtime. **The board is not working code that the plan can now
build on; it is a screen whose backend was replaced underneath it.** Detail at
§3.1.

> **CORRECTED 2026-08-30. Both headline claims above are out of date.**
>
> **The count.** *"Roughly one unit and a half of nineteen rows"* was true on
> 2026-08-29. Re-measured today: the response contract, the HTTP client, both
> stores, the board, the detail screen, the creation form and the edit route have
> landed, and the URL declarations stand at three of six. No replacement headline
> figure is given, because only the eleven rows named in the correction block at
> the top were re-measured — read those rows, not a number.
>
> **The runtime break is fixed.** `2610585` *"feat(pocket): read the board's
> served fields"* repointed the card at the names the server sends. Measured
> today: `ListPocket.tsx:141-144` destructures `pocketId` and `allocated`, `:191`
> links to `pockets/${pocketId}`, `:194` keys on it, and
> `PocketBigBoxResult.tsx:85` headlines `totalAllocated`, with `totalTarget`
> demoted to the meta line at `:87`. **No field the board reads is unserved.**
>
> What survives is the judgement, not its evidence: the merged files were never
> reusable implementation, and every one of them has since been rewritten rather
> than adapted — which is what the plan's replacement rule said would happen.

---

## 2. The nineteen rows of §8, measured

The plan numbers eighteen units, 0 through 17, plus one gated sub-unit (`10b`).
All nineteen rows are below.

| # | the unit, in words | state | the evidence, file and line |
|---|---|---|---|
| 0 | repointing the accounting dashboard's pocket row, which today links to a route the router does not declare | **Untouched** | `pages/accountingDashboard/AccountingDashboard.tsx:64` still maps `pocket_saving: '/fintrack/budget/pockets'`; `App.tsx` declares `pocket/pockets/:pocketId` at `:336` and no `budget/pockets` anywhere |
| 1 | the response contract file for the module | **Partial, and adverse** | `types/pocketTypes.ts` exists, 74 lines, at the plan's exact target path — but it is the retired contract: `accountId` and `accountName` (`:19-20`), the banned figure `saved` (`:28`), a nullable `target` (`:25`), a `desiredDateSource` (`:40`), a six-field summary (`:51-62`). None of the eight types §2 specifies exist — no `PocketBoardRow`, `PocketDetailFigures`, `PocketSourceAccount`, `PocketAllocationEntry`, the three request types or `DeletePocketResult`. It fails every clause of acceptance criterion 1 |
| 2 | the six URL declarations | **Partial — one of six** | `urlConfig.ts:248` declares `url_pocket_board`. Absent: the detail, create, edit, allocations and releases declarations. `url_create_pocket_saving_account` at `:74-75` is untouched, which is correct — the plan retires it in unit 10 |
| 3 | the HTTP client, seven functions | **Partial — one of seven** | `api/pocketApi.ts:19-25` declares `getPocketBoard()` only. Absent: detail, create, update, allocate, release, delete. And the one that exists returns the whole `{ status, message, data }` envelope, where §3.3 requires each function to unwrap it and return `data` — see §3.3 below |
| 4 | the two stores, and the bus subscriptions | **Partial — one store of two** | `stores/usePocketBoardStore.ts`, 111 lines, exists; both bus signals are subscribed at module scope (`:102-104` and `:109-111`), which satisfies that clause of acceptance criterion 4. `usePocketDetailStore.ts` **does not exist**, so `setDetailFromWrite` — the mechanism §4.3 makes every write depend on — has no implementation. The board store's state shape also differs from §4.1: three booleans `isLoaded`/`isRequested`/`isLoading` (`:31-35`) where the plan specifies a four-value `status` union |
| 5 | the two shared fetch-state primitives | **Partial — the behaviour exists, board-local; the shared pieces do not** | No `general_components/skeleton/` and no `general_components/emptyState/` — a filesystem search for either name returns nothing. But `pages/pocket/components/ListPocket.tsx:57-79` renders three placeholder rows and `:81-91` a worded empty state, both pocket-local, with their styles at `pocket-styles.css:255-380` written on tokens |
| 6 | the fourth route slot and reducing the layout to a header | **Untouched** | `App.tsx` declares three pocket slots (`:209`, `:290`, `:336`) and no `pocket/pockets/:pocketId/edit`. `PocketLayout.tsx:24-26` still issues the module's fetch, `:28-34` still holds the 3-second error timer, `:85-97` still renders the absolutely-positioned error paragraph with an inline `color: 'red'`. All three are the unit's stated deletions |
| 7 | the board and its five components | **Partial** | Landed: `ListPocket.tsx` rewritten onto the store with loading, error-with-retry and empty as three distinct answers (`:35-91`), a dash constant instead of `?? 0` (`:15`), a single-locale date through `formatCalendarDate` (`helpers/functions.ts:328-343`), and a token-written stylesheet block with a 480px breakpoint (`pocket-styles.css:376`). Not landed: no `PocketSummary`, `PocketToolbar`, `PocketCard` or `PocketBoardEmpty`; `Pocket.tsx:43-49` and `:55-61` still render two identical create controls with commented blocks between them; `PocketBigBoxResult.tsx:57` still headlines `totalTarget`, where §7.1 requires `totalAllocated`; the byte-identical dead card copy survives at `pages/budget/components/ListPocket.tsx` (100 lines); `DEFAULT_POCKET_LIST` survives at `helpers/constants.ts:187`; and the stylesheet was extended, not replaced, so it still carries the invalid `color: cyan f` (`:145`), the duplicated `.pocketLayout` block (`:4` and `:11`), two `!important` (`:14`, `:249`) and four raw colours (`:204`, `:207`, `:238`, `:239`), with no 768 or 1024 breakpoint |
| 8 | the detail screen and its four regions | **Untouched** | `pages/forms/pocketDetail/PocketDetail.tsx`, 264 lines, unchanged: it reads `url_get_account_by_id` and `url_get_transactions_by_account_id` (`:79`, `:104`), renders `AccountTransactionsList` and `AccountTransactionDetailModal` (`:33-34`), and seeds from `DEFAULT_POCKET_ACCOUNT_LIST[0]` (`:47`). `SummaryPocketDetailBox` survives, 58 lines, with its own stylesheet |
| 9 | the pocket allocation entry modal | **Untouched, shape still open** | No pocket entry modal exists. `AccountTransactionDetailModal.tsx` is unchanged at 392 lines. The data it would render **is** served now — the five FX fields travel with every history row (`core/makeAllocationEntry.js:48-54`) — so the unit is unblocked on data and still open on shape (§9.5) |
| 10 | the creation form, rewritten | **Untouched, with one clause satisfied early** | `pages/forms/newPocket/NewPocket.tsx` still posts `type: 'pocket_saving'`, a `target` key and a JS `Date` as `desired_date` to `url_create_pocket_saving_account` (`:46-55`, `:113`, `:214-217`), validated by the hand-rolled `validationData` (`:12`), and its success path sets a message rather than navigating (`:125-135`). No `validations/zod_schemas/pocketSchemas.ts`, no `PocketModalShell`. **The exception:** the merge taught `Datepicker.tsx` an optional `minDate` prop and `NewPocket.tsx:71-75` passes `startOfToday()` into it at `:479`, with `ERROR_MESSAGES.INVALID_DATE_FUTURE` reworded to *"Date must be today or later"*. That is the *"a past date cannot be chosen"* clause of acceptance criterion 10, satisfied ahead of its unit |
| 10b | the optional first commitment on the creation form | **Untouched, and still gated** | The gate is confirmed closed by reading the validator: `createPocketBodySchema` (`backend/src/validation/zod/pocketValidators.js:67-81`) is `.strict()` over exactly five keys — `name`, `note`, `targetAmount`, `currency`, `desiredDate`. It rejects the block's keys today, exactly as §9.1 predicts |
| 11 | the edit route | **Untouched** | No `EditPocket` component anywhere. Every deletion target survives, with the plan's line anchors drifted by the merge: the account editor's pocket branch is now `editionAndDeletion/validations_zod/editSchemas.ts:26-52` (the plan cites `:26-48`) and its registry entry `:101` (the plan cites `:97`); the field list is `editionAndDeletion/validations_zod/accountEditSchema.ts:147-183`; the labels are `editionAndDeletion/utils/languages.ts:100`, `:217`, `:327`. Note the two schema files sit under `editionAndDeletion/`, not the `validations/` path the plan's §8 table implies |
| 12 | the two commitment modals and the source picker | **Untouched, and still gated** | No `AllocateModal`, `ReleaseModal` or `PocketSourcePicker`. **The gate is confirmed still closed by measurement**, and this is the check the task asked for: only the single-account read is enriched. `getAccountById` (`getAccountController.js:513`) attaches the committed figure, the uncommitted cash, the over-allocation flag and the pocket list at `:798-801`; `getAllAccountsByType` (`:230`) attaches none of them — a grep for `allocated`, `unassigned` or `accountAllocationService` across its whole body, `:230-448`, returns nothing. The list the picker would read still carries the balance only |
| 13 | the deletion modal | **Untouched** | No `DeletePocketModal`. Its endpoint is live (`pocketRoutes.js:59`), so the unit is unblocked |
| 14 | the account detail integration | **Untouched on the frontend, unblocked on the backend** | `pages/forms/accountDetail/AccountDetail.tsx:96-98` still branches the account url to `null` when the caller arrived with `location.state.detailedData` (`:70`) — the exact defect §6.1 exists to fix. `AccountListType` (`types/responseApiTypes.ts:334-338`) is still an `Omit` of the basic account type and gains none of the four optional fields. No `AccountPocketAllocations` component |
| 15 | the three overview removals | **Untouched** | Every site named in §6.2 survives: the `pocket_saving` balance request at `OverviewLayout.tsx:96-103`, `totalPocketBalance` at `:144-145` and inside the net-worth fold at `:156`, the dependency entry at `:174`, the error fan-in at `:184`; the `SavingGoals` key and endpoint at `Overview.tsx:53`, `:85-87`, its fold at `:174-176`, and the pocket-movements entry at `:110-111`. `pages/overview/components/SavingGoals.tsx` still exists |
| 16 | removing the pocket from both transfer selectors | **Untouched** | All five sites survive: `Transfer.tsx:105` and `:113` (the two radio sets), `:186-187` (the origin remap), `types/types.ts:140-141` (both spellings in `TransferAccountType`), `validations/zod_schemas/trackerMovementSchema.ts:33-34`. **The plan's site list is short by one** — a second remap exists at `Transfer.tsx:263-264` for the destination account, which §6.3 does not name |
| 17 | the legacy sweep | **Untouched, and still gated** | Thirteen frontend files still name `pocket_saving`: the two edit schemas, the labels file, `helpers/constants.ts`, the accounting dashboard, both `ListPocket` copies, the creation form, both overview files, the transfer page, both type files and `urlConfig.ts`. The gate is discussed at §5 — and one of the two facts the plan gives for it is contradicted by the migration that landed |

### 2-bis. Re-measured 2026-08-30 — these eleven rows supersede the same numbers above

**The table above is the 2026-08-29 measurement and is left intact**, because its
line anchors are the evidence for what the commits then changed. Where a row
appears below, **the row below is the current state and the row above is history.**
The eight rows not listed here — 0, 5, 9, 10b, 13, 14, 15, 16 — were not
re-measured and stay as the table above records them.

| # | the unit, in words | state on 2026-08-30 | the evidence, file and line |
|---|---|---|---|
| 1 | the response contract file for the module | **Landed, with different type names than the plan asked for** | `types/pocketTypes.ts` is now 266 lines and declares fourteen exported types: `PocketStatus` (`:27`), `PocketBoardSummary` (`:71`), `PocketBoardPayload` (`:93`), `PocketBoardResponse` (`:101`), `PocketDetailPocket` (`:124`), `PocketSource` (`:137`), `PocketAllocationEntry` (`:162`), `PocketDetailPayload` (`:181`), `PocketDetailResponse` (`:188`), `CreatePocketBody` (`:201`), `EditPocketBody` (`:228`), `PocketFreedCash` (`:240`), `DeletePocketResult` (`:256`) and `DeletePocketResponse` (`:262`). **The banned figure `saved` is gone from every board type.** `accountId` and `accountName` survive only at `:138-139` and `:241-242`, inside the source breakdown and the freed-cash result, where they name a real bank account and are correct. **Naming divergence to record, not a defect:** the plan named `PocketBoardRow`, `PocketDetailFigures` and `PocketSourceAccount`; the file calls them `PocketStatus`, `PocketDetailPocket` and `PocketSource`. Two of the plan's three request types exist — the allocate and release bodies do not. Landed across `4a3ebd9`, `69a6b50`, `9ed0130` |
| 2 | the six URL declarations | **Partial — three of six, and two more are folded into one** | Present: `url_pocket_board` (`urlConfig.ts:248`), `url_pocket_create` (`:258`), `url_pocket_detail(pocketId)` (`:268`). **Edit and delete do not have their own declarations by design** — both reuse `url_pocket_detail` with a different verb (`pocketApi.ts:100` and `:121`), so the plan's count of six will not be reached and should not be. Genuinely absent: the allocations and the releases declarations. `url_create_pocket_saving_account` (`:74-75`) is still untouched, still correct |
| 3 | the HTTP client, seven functions | **Partial — five of seven, and the envelope complaint is closed** | Present: `getPocketBoard` (`api/pocketApi.ts:38`), `getPocketDetail` (`:57`), `createPocket` (`:73`), `editPocket` (`:95`), `deletePocket` (`:117`). Absent: allocate and release. **All five unwrap.** `getPocketBoard` is now typed `Promise<PocketBoardPayload>`, not `Promise<PocketBoardResponse>` — the disagreement §3.3 recorded is resolved in the plan's favour |
| 4 | the two stores, and the bus subscriptions | **Both stores exist** | `stores/usePocketDetailStore.ts` landed with `4a3ebd9`, 167 lines, alongside the existing `usePocketBoardStore.ts`. The board store's three-boolean state shape (`:31-35`) was **not** changed to the plan's four-value `status` union, so that half of the row stands |
| 6 | the fourth route slot and reducing the layout to a header | **Split — the route landed, the layout reduction did not** | `App.tsx:352` now declares `pocket/pockets/:pocketId/edit` (`9ed0130`), the fourth slot the plan asked for. The layout is unchanged: `PocketLayout.tsx:26` still issues the module's fetch, `:30-35` still holds the 3-second error timer, and `:81-91` still renders the error paragraph with an inline `color: 'red'` at `:84`. **All three of the unit's stated deletions survive** |
| 7 | the board and its five components | **Substantially landed; the component split did not happen** | The runtime break is fixed — see the correction under §1. `4d4a9f6` deleted the byte-identical duplicate at `pages/budget/components/ListPocket.tsx`, removed the sample constant `DEFAULT_POCKET_LIST` from `helpers/constants.ts`, and left **one** create control, which navigates from `Pocket.tsx:14`. `a4057e0` rewrote the card into a scrolling list and added 368 lines of stylesheet. The board's empty state now reads *"No pockets yet. Create one to plan towards a goal."* (`ListPocket.tsx:129`) — the banned verb is gone. **Not landed:** `pages/pocket/components/` still holds exactly two files, `ListPocket.tsx` and `PocketBigBoxResult.tsx`; no `PocketSummary`, `PocketToolbar`, `PocketCard` or `PocketBoardEmpty` exists. **The legacy stylesheet defects survive** — the invalid `color: cyan f` is now at `:147` and the two `!important` at `:14` and `:251`, the line numbers having drifted |
| 8 | the detail screen and its four regions | **Rewritten onto the pocket endpoint** | `4a3ebd9` replaced the screen wholesale: `pages/forms/pocketDetail/PocketDetail.tsx` rewritten against `usePocketDetailStore`, a 196-line stylesheet added, and `SummaryPocketDetailBox` reworked — its hero label now reads *"allocated of goal"* (`:59`) where it read *"Saved"*. **Whether the four regions match the spec was not re-measured**, only that the screen no longer reads the account endpoints. **A concurrent session is editing this screen right now** — `PocketDetail.tsx`, its stylesheet and a new `deletePocketModal/` directory are uncommitted in the working tree |
| 10 | the creation form, rewritten | **Rewritten; the schema file still does not exist** | `69a6b50` moved the form onto the pocket endpoint and gave it the plan's success path: `NewPocket.tsx:224` navigates to `/fintrack/pocket/pockets/${detail.pocket.pocketId}` instead of setting a message. It no longer posts `type: 'pocket_saving'`. **Still absent:** `validations/zod_schemas/pocketSchemas.ts` — that folder holds only `commonSchemas.ts` and `trackerMovementSchema.ts` — and `PocketModalShell` |
| 11 | the edit route | **Landed, and its deletion targets are gone** | `9ed0130` added `pages/forms/editPocket/EditPocket.tsx` (536 lines), the route slot at `App.tsx:352` and `PocketEditLink.tsx` on the detail screen. `614c553` *"refactor(pocket): drop the account editor's branch"* then removed the deletion targets this row listed: the pocket branch of `editionAndDeletion/validations_zod/editSchemas.ts`, the field list in `accountEditSchema.ts`, and the labels in `utils/languages.ts` — 85 lines deleted across four files |
| 12 | the two commitment modals and the source picker | **The gate opened for bank accounts; the components still do not exist** | `175a33a` attaches the committed total, the uncommitted cash and the over-allocation flag to every row of the accounts-by-type list, but **only when the type is `bank`** (`getAccountController.js`, the block after `const accountList = accountListResult.rows`), computed by the same `accountAllocationService` the commit path validates against, in one query for the whole list. An account the allocation read filtered out is **left unset rather than zeroed** — a deliberate distinction the picker has to render. Other account types carry none of the three, by design. Still absent: `AllocateModal`, `ReleaseModal`, `PocketSourcePicker` |
| 17 | the legacy sweep | **Done, 2026-08-30, `02b0a04`** | Files naming `pocket_saving` across `frontend/src` are down from thirteen to **two, both deliberate**: `urlConfig.ts:72-75`, the endpoint declaration that writes an account of the retired type, kept with its comment because withdrawing the server route is a separate change and no client code calls it; and `types/types.ts:212`, a comment citing the database CHECK on `pocket_saving_accounts.desired_date_source`, a table migration `020` deliberately keeps alive. Left along the way: both edit schemas and the labels file (`614c553`), the duplicate list component (`4d4a9f6`), the creation form (`69a6b50`), the summary screen's reads and the transfer selectors (`b40c4b8`, `bafa8b6`), and finally the seed constant, the accounting dashboard tile and route entry, the create response and the accounts-by-type response (`02b0a04`). **The gate opened before the sweep ran** — the pocket tables migration has run and the development database holds no account of the retired type, live or soft-deleted, its extension table empty and four converted rows in the pockets table; the chain on disk ends at `020` with no gap. The last code that could edit an account of that type went with `614c553`. Superseded here: the earlier reading of this row, that the gate was unchanged — see §3.6 and `PLAN_POCKET_FE.md` §9.1, whose gate language is now historical |

> ### 2-ter. Re-measured later on 2026-08-30 — these rows supersede §2-bis
>
> **The table above is left intact**, because its anchors are the evidence for
> what the commits then changed. Five rows have moved again.
>
> | # | state now | the evidence, file and line |
> |---|---|---|
> | 2 | **Complete, and at five declarations rather than six** | Present: `url_pocket_board` (`urlConfig.ts:248`), `url_pocket_create` (`:258`), `url_pocket_detail` (`:268`), `url_pocket_allocations` (`:278`), `url_pocket_releases` (`:288`). Edit and delete reuse the detail URL with a different verb, by design. **`url_create_pocket_saving_account` is deleted** — `:72-75` is the comment recording it, so §2-bis's *"still untouched, still correct"* is false |
> | 3 | **Complete, and one function beyond the plan's seven** | `getPocketBoard` (`pocketApi.ts:44`), `getPocketDetail` (`:63`), `createPocket` (`:79`), `editPocket` (`:101`), `deletePocket` (`:123`), `allocateToPocket` (`:144`), `releaseFromPocket` (`:159`), plus `getPocketSourceAccounts` (`:178`), which reads the enriched accounts-by-type list for the source picker |
> | 7 | **Rebuilt around a five-level partition; the legacy stylesheet defects survive with drifted anchors** | `helpers/pocketStatus.ts` exports `PocketStatusLevel` at five values (`:26-31`), `POCKET_AT_RISK_DAYS = 30` (`:24`) and `pocketDateLevel` (`:71`); `PocketBigBoxResult.tsx:50-70` counts by level and `:154-192` prints three peer tiles with the excess under the gap; `ListPocket.tsx:36-53` reads the same helper. The empty state now says *"plan towards a target"* (`:138`). Still there: `color: cyan f` at `pocket-styles.css:156`, `!important` at `:14` and `:260`, `.card__budget--title` at `:122`, the duplicated `.pocketLayout` at `:4` and `:11`. The file now declares breakpoints at 480 (`:387`) and 768 (`:1117`) plus the two height steps (`:1127`, `:1133`) — **no 1024** |
> | 12 | **Built.** The components §2-bis records as absent all exist | `pages/forms/pocketDetail/pocketCashModal/PocketCashModal.tsx` (398 lines) serves both directions on a `direction` prop (`:263-264`), with `PocketSourcePicker.tsx` (108 lines) beside it declaring the three figures per row (`:24-35`). The board-side gate is `getAccountController.js:431-462` |
> | 17 | **Complete: the count is zero, not two** | A grep for `pocket_saving` across `frontend/src` returns nothing. Both survivors §2-bis names are gone — the endpoint declaration with its comment, and the `types.ts` comment citing the database CHECK. `DesiredDateSourceType` and `desired_date_source` return nothing either |
>
> **Rows that were not re-measured on 2026-08-29 and have since moved:** the
> accounting dashboard's pocket row (`0`) — its tile and its route entry are gone,
> so nothing links there any more; the allocation entry modal (`9`) — built, at
> `pages/forms/pocketDetail/allocationEntryModal/AllocationEntryModal.tsx`, over a
> shared `general_components/fxPathwayCard/`; and the deletion modal (`13`) —
> built, at `pages/forms/pocketDetail/deletePocketModal/DeletePocketModal.tsx`.
> **Unchanged:** the shared fetch-state primitives (`5`) still do not exist, and
> the account detail (`14`) is untouched — `AccountDetail.tsx:96` still branches
> the url to `null` on `location.state.detailedData`, and `AccountListType`
> (`types/responseApiTypes.ts:303`) still declares none of the four fields.

---

**Scope note, stated rather than forced into a bucket.** Unit 1 is the one row
where the three buckets do not fit cleanly. The file exists at the plan's target
path, with live callers — the board store imports two of its types
(`usePocketBoardStore.ts:17`) and the board client its response type
(`pocketApi.ts:14`). So the unit is no longer a greenfield write of a new file;
it is the replacement of a file that three modules compile against. That changes
the unit's shape and its blast radius, not its content. It is recorded as
**Partial** with that caveat rather than as **Untouched**, because pretending the
path is empty would understate what the commit has to do.

---

## 3. Where the merged code and the plan disagree

Six disagreements. The first is a defect, not a difference of opinion. The rest
are decisions the developer settles; this document does not settle them.

### 3.1 The board on screen is typed against a response the server stopped sending

**This is the sharpest finding and it is not a stylistic mismatch — it is a
runtime break.**

> **FIXED 2026-08-30 — this section is history, not a live defect.** `2610585`
> *"feat(pocket): read the board's served fields"* repointed the card at the
> names the endpoint sends. The four consequence rows in the table below no
> longer describe the screen: `ListPocket.tsx:191` links to
> `pockets/${pocketId}`, `:194` keys on the same value, the title renders `name`,
> and `:226` formats `allocated`. `PocketBigBoxResult.tsx:85` headlines
> `totalAllocated`. **The whole section is kept** because the field-by-field
> comparison of what the endpoint serves against what the card read is the
> evidence that produced the fix, and because the last paragraph — that these
> merged files were never reusable implementation — is the conclusion the plan
> still rests on.

The board endpoint serves this row (`core/makePocketStatus.js:110-131`, plus
`uncovered` folded in at `pocketBoardService.js:184`):

`pocketId`, `name`, `note`, `target`, `allocated`, `remaining`, `progress`,
`desiredDate`, `daysRemaining`, `requiredMonthly`, `funded`, `overdue`,
`sourceCount`, `currency`, `uncovered`.

The board list destructures this (`pages/pocket/components/ListPocket.tsx:97-106`):

`accountId`, `accountName`, `note`, `saved`, `target`, `remaining`,
`desiredDate`, `currency`.

**Three of those eight are not served.** The consequences, each at its line:

| line | what it renders | what actually happens |
|---|---|---|
| `ListPocket.tsx:124` | ``to={`pockets/${accountId}`}`` | every card links to `pockets/undefined` |
| `ListPocket.tsx:127` | ``key={`pocket-${accountId}`}`` | every row carries the identical React key `pocket-undefined` |
| `ListPocket.tsx:131` | `{accountName}` | the card's title is blank |
| `ListPocket.tsx:139` | `saved: {currencyFormat(currency_code, saved)}` | the card's headline figure is formatted from `undefined` |

The route is live and the frontend points at it: `url_pocket_board` resolves to
`/api/fintrack/pocket/board` (`urlConfig.ts:248`), mounted at
`routes/index.js:27` and handled at `pocketRoutes.js:27`. The header survives
because `PocketBigBoxResult` reads only `totalTarget`, `totalRemaining`,
`currency` and `pocketCount`, all four of which are served — so the screen shows
correct totals above a list of blank, identically-keyed cards pointing at a
route parameter of `undefined`.

**What this means for the plan.** It removes the reading that the merge brought
in *a working frontend board*. It brought in a board whose backend was replaced
in the same merge. The plan's §0.2 judgement — that these files are historical
evidence and not reusable implementation — is **confirmed by measurement**, not
overtaken. What changes is only the reason: not that they were unreachable, but
that they no longer describe the server.

### 3.2 Whether a write invalidates the board or refreshes it — the landed store argues the opposite case

The plan, §4.3: *"No write is followed by a refetch of the thing it wrote"*, and
every write ends `boardStore.invalidate()`, on the argument that invalidating
costs no request while the owner stays on the detail and the board refetches once
on its next mount.

The landed store argues against exactly that, in its own words, at
`stores/usePocketBoardStore.ts:38-42`:

> *"Asks again for what is already on screen, guard and all. A write knows its
> own answer is obsolete, and routing that through `invalidate()` plus a call
> `fetchBoard` is free to refuse would make correctness depend on the caller
> getting two statements in the right order."*

That comment declares `refreshBoard()` — which clears both flags and refetches
immediately (`:93-96`) — as the write-facing action. Both actions exist in the
file: `invalidate()` at `:91` and `refreshBoard()` at `:93`. **What conflicts is
not which action exists but which one a write calls:** the plan says the lazy one,
the landed code's stated design says the eager one. The plan's cost argument and
the store's ordering argument are both sound and they point opposite ways.

The two bus subscriptions agree with the plan and are not in dispute: both call
`invalidate()`, at `:102-104` and `:109-111`.

**This is a decision for the developer, not something this measurement resolves.**

### 3.3 The HTTP client does not unwrap the envelope

The plan, §3.3: *"Each unwraps the `{ status, message, data }` envelope and
returns `data`, the way `budgetApi.ts` does."* The landed
`getPocketBoard()` (`api/pocketApi.ts:19-25`) is typed
`Promise<PocketBoardResponse>` and returns the whole envelope. The store consumes
it in that shape at `usePocketBoardStore.ts:70-72` (`response.data.summary`).

Small in itself, but it is a two-file change rather than a one-file change:
adopting the plan's shape moves the store's three reads at the same time.

> **RESOLVED 2026-08-30, in the plan's favour.** `getPocketBoard()` is now typed
> `Promise<PocketBoardPayload>` (`api/pocketApi.ts:38`) and returns the unwrapped
> payload, and the four functions added since — detail, create, edit and delete —
> do the same. The two-file cost this paragraph predicted was paid: the store's
> reads moved with it.

### 3.4 Where the created pocket's detail travels — not yet a conflict, and the forbidden pattern is alive next door

The plan settles this at §4.3: the created pocket's detail travels **through the
store**, never through `location.state`, and passing it as route state *"is the
exact shape of the Account Detail bug at §6.1 and is forbidden here."*

**The landed code neither honours nor breaks that, because no creation path
exists to do either.** `usePocketDetailStore` does not exist, and
`NewPocket.tsx:125-135` sets a message on success and does not navigate at all.
The board list does pass route state — ``state={{ previousRoute }}`` at
`ListPocket.tsx:125` — but that is navigation context, not detail data, and is
not the forbidden shape.

The forbidden shape itself is untouched and one screen away:
`AccountDetail.tsx:70` reads `state?.detailedData` and `:96-98` uses its presence
to decide whether to ask the network at all. That is unit 14's target and it is
exactly as §6.1 describes it.

### 3.5 The plan's factual claim about the module stylesheet is now stale

§7.6 states: *"`pocket-styles.css` declares **zero** `@media` queries today, so
the module's stylesheets are written new, not extended."* The file now declares
two — a reduced-motion query at `:364` and a 480px breakpoint at `:376` — both
inside the token-written block the merge appended at `:255-380`.

The conclusion the plan draws from that premise is not obviously wrong: the file
was **extended**, and the legacy half above `:255` still carries the invalid
`color: cyan f` (`:145`), the duplicated `.pocketLayout` (`:4`, `:11`), the two
`!important` (`:14`, `:249`) and the four raw colours. The new block's own comment
at `:260-262` says as much: *"The rules above this block predate the token system
and hold raw hex, raw rem and an `!important`; they are not the model for anything
added here."* So the file is now two stylesheets in one, and the question the
plan answered — replace or extend — is worth re-asking with the token-written
block on the table, because replacing it would discard work that already follows
the module's own rules.

### 3.6 The plan and the landed migration disagree about the one fact that gates the sweep

§9.1 gives two facts to justify holding the legacy sweep, and one of them is
contradicted by the migration that landed with the merge.

The plan says: *"one real legacy pocket exists in that copy — account `108`,
`cash_loc_chinita`, not deleted, holding 90.00 against a target of 420.00 with a
deadline in 2027 — with an unresolved question: does the migration write a pocket
allocation row of 90 for it, or leave it at zero?"*

The landed migration's header says the opposite, at
`backend/src/db/migrations/sql_migrations/020_create_pocket_tables.sql:18-24`:

> *"MEASURED AGAINST PRODUCTION 2026-08-24, read-only, four counts all zero …
> The owner deleted the last pocket account through the app's own deletion path
> that day, which restored the 90.00 to CASH and left a readable annulment
> transaction behind. Against production only step 1 below does anything."*

Same 90.00, opposite conclusion: the plan treats the row as live with an open
question attached; the migration records it as already deleted by the owner and
the question as closed. **One of the two is out of date and the developer knows
which.** If the migration's measurement is the current one, the unresolved
question §9.1 hangs the sweep on no longer exists.

The plan's second fact — that the migration aborts with `column u.timezone does
not exist` — is **not checkable from the repository**, and this document does not
claim either way. What is checkable: the migration still reads `u.timezone` at
`:237`, and the column is declared in the schema chain, at
`002_accounts.sql:38` and `run_time_db_init/createTables.js:19`. So a database
built by the current chain has it; whether the specific copy the plan was
rehearsed against does is a question for the database, not the repository.

---

## 4. Vocabulary — does the landed code honour the frozen rules

The three rules of §0.1: never the bare word *budget* inside this module; never
the bare noun *allocation* unqualified; and the figure is **allocated**, never
**saved**.

**Four violations in user-facing strings.** The first is the one the plan's
acceptance criterion *"all"* explicitly tests for.

> **RE-MEASURED 2026-08-30: all four are gone, and one of the two identifier
> violations survives.** The card's headline figure now prints `allocated`
> (`ListPocket.tsx:226`); the detail hero's label reads *"allocated of goal"*
> (`SummaryPocketDetailBox.tsx:59`); the board's empty state reads *"No pockets
> yet. Create one to plan towards a goal."* (`ListPocket.tsx:129`); and the
> account-type labels left with the account editor's pocket branch in `614c553`
> — a search for `Ahorro` or `Saving` in `editionAndDeletion/utils/languages.ts`
> now returns nothing. The contract file's `saved` and `totalSaved` fields are
> gone with the rewrite. **Still there:** the bare word *budget* as a class name
> in the pocket module's own stylesheet, now at `pocket-styles.css:113`, still
> dead. The table below is kept as the record of what was found and fixed.
>
> > **SECOND CORRECTION 2026-08-30.** Two anchors in the block above have moved
> > and one string has changed. The dead class is now `pocket-styles.css:122`.
> > The board's empty state reads *"No pockets yet. Create one to plan towards a
> > target."* (`ListPocket.tsx:138`) — the word *goal* left it with the ruling
> > recorded in `POCKET_DECISIONS.md` §21. The detail hero's label is now the
> > single word *allocated* (`SummaryPocketDetailBox.tsx:68`), with the target
> > stated on its own line at `:80`, so *"allocated of goal"* is no longer what
> > it says. The card's reading for a pocket past its target is **Above target**
> > (`ListPocket.tsx:38`) and its shortfall label flips to *Over target*
> > (`:247`).

| what the user reads | file and line | the rule it breaks |
|---|---|---|
| `saved: $7,200` — the card's headline figure, the module's central number | `pages/pocket/components/ListPocket.tsx:139` | the figure is **allocated**, never *saved*; §0.1 calls the word banned outright |
| `Saved ` — the detail hero's label under the target | `pages/forms/pocketDetail/summaryPocketDetailBox/SummaryPocketDetailBox.tsx:20` | the same rule, on the screen the module is built around |
| `No pockets yet. Create one to start saving towards a goal.` — the board's empty state | `pages/pocket/components/ListPocket.tsx:86` | the verb form of the banned word, and it re-introduces the idea the model removes: a pocket does not receive money, it records a commitment. The rest of the sentence is right; the last five words are not |
| `Saving` / `Ahorro` — the account-type label the edition screens print | `editionAndDeletion/utils/languages.ts:217` and `:327` | the retired word as a user-visible label, in both languages. It rides on the account type the model deletes, so it goes with unit 11's deletions rather than as a rewording |

**Two more, in identifiers rather than in copy.** §0.1 binds *"payloads,
identifiers, CSS class names and copy"*, so these count, though they are not
what the task asked to be reported and are cheaper to fix:

- `types/pocketTypes.ts:28` declares the field `saved: number`, and `:52`
  declares `totalSaved`. Neither is served by the backend any more; both are
  removed by unit 1 regardless.
- `pocket-styles.css:111` declares `.card__budget--title`, the bare word *budget*
  as a class name inside the pocket module's own stylesheet. It is dead — a grep
  for `card__budget` across every `.tsx` returns nothing — so it goes out with
  whatever unit touches the stylesheet.

**No violation of the unqualified-*allocation* rule was found** in any
frontend string. The backend uses the noun in identifiers that mirror served
fields (`allocationId`, `allocationDate`, `pocket_allocations`), which §0.1
exempts.

One backend comment reads *"the savings board"*
(`backend/src/fintrack_api/routes/index.js:28`). It is not user-facing and not
covered by the rule as written; recorded here only so it is not discovered later
and mistaken for a served string.

---

## 5. What is unblocked, what is done, what is still gated

**Nothing is Done.** Not one of the nineteen rows is complete against its own
acceptance criterion.

> **FALSE AS OF 2026-08-30.** Seven rows have landed since this was written — the
> response contract, the HTTP client (five of its seven functions), both stores,
> the board, the detail screen, the creation form and the edit route — and the
> gate on the commitment modals opened for bank accounts. **Whether each meets
> its own acceptance criterion word for word was not re-checked**, so this
> document does not replace *"Nothing is Done"* with *"seven are Done"*; it
> replaces it with the eleven re-measured rows at §2-bis. The sentence above is
> the only one in this section that is now wrong: the thirteen-unblocked count
> and the three named gates below still read correctly, except that the gate on
> the source picker has partly opened.

**Unblocked by the merge and blocked by nothing else — thirteen rows.** Every
unit from the response contract through the deletion modal, plus the three
cross-module integrations, can now be exercised against a running server:
units 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 15, 16. The plan's own sentence
*"nothing from unit 4 onward can be exercised until it lands"* no longer
applies to any of them.

**Three rows are still gated, and each gate is named in words below.**

| the unit, in words | the gate, in words | measured how |
|---|---|---|
| the optional first commitment on the creation form (`10b`) | **the creation validator does not accept its keys.** The server's create schema is strict over exactly five fields, so any request carrying a source account or an initial amount is a `400` naming the key | `backend/src/validation/zod/pocketValidators.js:67-81` |
| the two commitment modals and their source picker (`12`) | **no endpoint serves the picker's three figures for a list of accounts.** The single-account read carries the committed total and the uncommitted cash; the accounts-by-type list carries the balance alone. The picker must show all three side by side, per account, precisely so no single number gets called *available* | enriched: `getAccountController.js:798-801` inside `getAccountById` (`:513`); not enriched: `getAllAccountsByType` (`:230-448`), which mentions neither the service nor either field |
| the legacy sweep of the retired account type (`17`) | **the migration that removes the type from the database has not been confirmed run**, and the plan and the migration disagree about whether the one legacy row it was waiting on still exists | `020_create_pocket_tables.sql:18-24` against `PLAN_POCKET_FE.md` §9.1 — see §3.6 above |

> **SECOND CORRECTION 2026-08-30 — two of the three gates above are open and the
> third is not a gate any more.**
>
> - **The source picker's gate (`12`) is open for bank accounts and has been
>   consumed.** `getAllAccountsByType` attaches `allocated`, `unassignedCash` and
>   `isOverAllocated` to every row when the type is `bank`
>   (`getAccountController.js:431-462`), leaving a row the allocation read
>   filtered out **unset rather than zeroed** (`:455-456`). The client reads it
>   through `getPocketSourceAccounts` (`pocketApi.ts:178`) into
>   `PocketEligibleAccount` (`pocketTypes.ts:299`).
> - **The legacy sweep (`17`) has run.** No file under `frontend/src` names
>   `pocket_saving`, and the route that wrote such an account is withdrawn on the
>   server as well (`accountRoutes.js:57-62`).
> - **The initial-commitment gate (`10b`) still stands, unchanged.**
>   `createPocketBodySchema` is still `.strict()` over five keys
>   (`validation/zod/pocketValidators.js:65-81`).

**A fourth gate is not a unit's but every money form's.** §9.1 asks the backend
to answer an unavailable exchange rate with a service-unavailable status rather
than a server error, so a form can offer a retry instead of reporting a bug. A
search for `503` across the whole pocket service tree and its controller returns
nothing. Until it lands, the four write forms can only report a provider outage
as a defect — which does not block building them, but does fix what their error
copy is allowed to say.

---

## 6. What I would do first, ranked

> **MARKED 2026-08-30 — four of this ranking's five entries have been executed
> and the fifth has lost its subject; the ranking needs replacing rather than
> following.**
>
> **What the passage asserts:** that the first commit is the response contract
> taken together with the board list, the second is settling the envelope and
> board-refresh decisions, the third is repointing the accounting dashboard's
> pocket row, the fourth is the units the merge unblocked, and the fifth is
> leaving three gated rows alone.
>
> **What the code actually says:** the contract and the board landed together, the
> client returns the unwrapped payload (`pocketApi.ts:44`), the dashboard's pocket
> tile and its route entry are deleted so there is no row left to repoint, and the
> units listed under (4) — the URLs, the client, both stores, the detail, the
> entry modal, the deletion modal and the two commitment modals — all exist. Of
> the three gated rows under (5), two are open: the source picker's
> (`getAccountController.js:431-462`) and the legacy sweep's.
>
> **What now needs deciding:** which unit is next is no longer answerable from
> this list. `POCKET_SEQUENCE.md` owns the ordering, and the entries still open
> there are the account detail's committed-cash block, the shared fetch-state
> primitives, and the two backend gaps — an unavailable rate answering `503` and
> the goal's typed pair on the detail payload. Nothing below is struck.

**1. Rewrite the response contract file (unit 1), and take the board list with
it in the same commit.**

The reason, in one sentence: the board currently renders blank titles and links
to `pockets/undefined` because it reads three fields the server does not send, so
this is not the first step of a plan any more — it is a live defect on a screen
the user can open, and the contract file is where the defect is declared.

Two consequences worth stating before it is written. First, the unit is no
longer the greenfield file the plan describes: the path has two live importers
(`pocketApi.ts:14` and `usePocketBoardStore.ts:17`), so the commit changes three
files or it does not compile. Second, the plan's §8 keeps the contract and the
board four units apart, and the measurement argues they now belong together —
splitting them leaves a commit that typechecks and renders a broken screen,
which is exactly the state the branch is in today.

**2. Settle the two decisions of §3 before writing the store work (units 3 and
4).** Whether a write refreshes the board or invalidates it, and whether the
client returns the envelope or its `data` — both are one-line decisions that
each move two files if taken after the code is written rather than before.

**3. Repoint the accounting dashboard's pocket row (unit 0).** One line at
`AccountingDashboard.tsx:64`, testable immediately against the legacy detail
screen that still exists, and it depends on nothing — the same recommendation
§9.2 already makes, now with no merge to wait for.

**4. Then the units the merge unblocked, in the plan's own order** — the URL
declarations, the client, the stores, the primitives, the routes, the detail,
the entry modal, the deletion modal, and the three cross-module integrations.

**5. Leave the three gated rows where they are.** Two of them are gated on
backend work that has not landed; the third is gated on a fact the developer has
to settle, at §3.6.

---

## 7. What this measurement did not check

Stated so nothing here is read as more than it is.

- **The backend's behaviour was read from its code, not exercised.** No server
  was started and no endpoint was called. Every backend claim above is a claim
  about what the source says it serves.
- **Whether migrations 019 and 020 have actually been run** against any
  database. The files exist; whether the schema they describe is live is not
  visible from the repository, and it is the gate on the legacy sweep.
- **The plan's claim that the migration aborts on a missing time-zone column.**
  Checkable only against the database copy in question. §3.6 records what the
  repository does say.
- **The design and layout of anything.** §11 of the plan reserves that, and this
  document does not trespass on it.

---

## Corrections applied later on 2026-08-30 — re-measured against the working tree

This document already carried a correction dated earlier the same day. That
correction has itself aged: the two commitment modals, the deletion modal, the
allocation entry modal and the sweep of the retired account type have all landed
since, and thirteen frontend files are uncommitted in the tree. Corrected in
place, nothing struck, no decision closed and no unit reordered.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the URL declarations at three of six | §2-bis row 2 | five declarations, complete; the legacy creation URL is deleted, not untouched |
| the HTTP client at five of seven | §2-bis row 3 | eight functions, allocate and release among them |
| the board's five-level partition, and the stylesheet anchors | §2-bis row 7 | `helpers/pocketStatus.ts` and the rewritten header and card; `cyan f` at `:156`, `!important` at `:14` and `:260`, the dead class at `:122` |
| the commitment modals and the source picker as absent | §2-bis row 12 | `PocketCashModal.tsx` and `PocketSourcePicker.tsx` exist and consume the enriched list |
| the legacy sweep leaving two deliberate mentions | §2-bis row 17 | zero mentions of `pocket_saving` under `frontend/src` |
| three rows not re-measured on 2026-08-29 | §2-bis closing note | the dashboard row, the entry modal and the deletion modal have all moved |
| the vocabulary block's anchors and strings | §4 | *target* replaced *goal* in the empty state, the card reading and the hero label |
| the three named gates | §5 | two are open, the initial-commitment one still stands |
| the ranked plan of what to do first | §6 | **marked, not struck.** Four entries executed and the fifth without a subject, so the ordering question goes back to `POCKET_SEQUENCE.md` |

**Left standing because they are still true:** the board store's three-boolean
shape (`usePocketBoardStore.ts:31-35`) where the plan specified a four-value
`status` union; both bus subscriptions calling `invalidate()` (`:104-113`); the
absence of `validations/zod_schemas/pocketSchemas.ts` and of any
`PocketModalShell`; the absence of shared skeleton and empty-state components;
the account detail's conditional fetch; and the disagreement of §3.6 about the
one legacy pocket in the production copy, which no reading taken today touches.
