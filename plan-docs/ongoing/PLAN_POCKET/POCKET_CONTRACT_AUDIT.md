# POCKET — CONTRACT AUDIT, SEVEN ENDPOINTS TRACED END TO END

**Measured 2026-08-29 on `fix/auth-screen`, after `8c7ca8f` *"fix(pocket): read
the board the server answers"*. Lives in `plan-docs/ongoing/`, which
`.gitignore:123` re-includes: this file is versioned. No file under `frontend/` or `backend/` was
modified.**

Starting point: `POCKET_FE_RECONCILIATION.md`, which classified the plan's
eighteen implementation units. This document does not repeat that classification.
It answers a different question: **for each of the seven endpoints, what does the
server send, what does the frontend declare, and where do the two disagree.**

Every claim below was read from the source on this branch. Nothing was inferred
from a commit message.

> ## CORRECTION 2026-08-30 — read this before the body
>
> **Both headline findings are closed and six of the seven "no frontend layer
> exists" verdicts are false.** Re-measured against the working tree today:
>
> - **Creating a pocket writes a pocket.** `NewPocket.tsx:200-211` builds
>   `{name, note, targetAmount, currency, desiredDate}` and calls `createPocket`
>   (`api/pocketApi.ts:79`), which POSTs `url_pocket_create` (`urlConfig.ts:258`)
>   → `pocketRoutes.js:34` → `pocketRepository.js` `INSERT INTO pockets`. No
>   `user_accounts` row is written on that path, and the legacy URL is deleted.
> - **The detail screen spends a pocket id as a pocket id.**
>   `PocketDetail.tsx:75` reads `const { pocketId } = useParams()` and `:118`
>   hands it to `fetchDetail`; the screen issues no request under `account/`.
> - **Six endpoints have a client.** `pocketApi.ts` exports `getPocketBoard`
>   (`:44`), `getPocketDetail` (`:63`), `createPocket` (`:79`), `editPocket`
>   (`:101`), `deletePocket` (`:123`), `allocateToPocket` (`:144`),
>   `releaseFromPocket` (`:159`) and `getPocketSourceAccounts` (`:178`), and every
>   one of them has a screen: `EditPocket.tsx`, `DeletePocketModal.tsx`,
>   `PocketCashModal.tsx` with `PocketSourcePicker.tsx`, and
>   `AllocationEntryModal.tsx`.
>
> Each affected passage carries a dated correction where it stands, and §4 — the
> commit this document recommends — is **marked, not struck**, because it has
> already been built. What survives untouched is the field-by-field contract of
> §2: every nullability rule, every status code and every "the screen must not
> invent it" clause was re-checked against the builders and still holds.

---

## 1. Headline — is there another live defect of the board's kind?

**Yes. Two, and neither is on the board.** Both are the same class the board fix
closed: a frontend layer consuming a model the server no longer serves. Both are
strictly worse than the board's, because the board rendered `undefined` where
these render *another account's real money*, and *silent success*.

### The one a user reaches first: creating a pocket writes into the retired model

**The module's only creation path does not create a pocket.** The form posts to
the legacy account endpoint and the board reads the new table, and the two share
no row.

| link | file and line | what it does |
|---|---|---|
| the form's payload | `frontend/src/fintrack/pages/forms/newPocket/NewPocket.tsx:214-225` | sends `{name, note, type: 'pocket_saving', currency, target, desired_date}` |
| the URL it posts to | `NewPocket.tsx:113` → `urlConfig.ts:74-75` | `account/new_account/pocket_saving` |
| the handler | `routes/accountRoutes.js:58` → `controllers/accountCreationController.js:932` | writes a `user_accounts` row plus a `pocket_saving_accounts` row |
| what the board reads | `services/pocket_services/db/pocketRepository.js:62-84` | `FROM pockets` — a different table |

Migration `020_create_pocket_tables.sql` deliberately keeps both the
`pocket_saving` catalog row and the `pocket_saving_accounts` table alive
(`:32-40`), so this endpoint still answers `201`. The user reads *"New Pocket
account successfully created!"* (`NewPocket.tsx:129`) and returns to a board that
is still empty, forever. **No error is raised anywhere on that path.**

This is reachable **today, on an empty database, from the module's own screen,
with no precondition**. It is the first thing that breaks in a user's hands.

> **CORRECTED 2026-08-30 — every row of the table above is false.** The form
> posts to the pocket endpoint: `NewPocket.tsx:200-203` sends `targetAmount` and
> `desiredDate` as a `YYYY-MM-DD` label through `toCalendarDay`, sends no `type`
> key, and `:211` calls `createPocket`. The URL it resolves is
> `url_pocket_create` (`urlConfig.ts:258`); `url_create_pocket_saving_account` no
> longer exists — `urlConfig.ts:72-75` is the comment recording its deletion. The
> route behind it is withdrawn too (`accountRoutes.js:57-62`,
> `accountCreationController.js:977-985`). On success `:222` invalidates the
> board and `:224` navigates to the created pocket's detail, so there is no
> success message over an empty board left to read.

### The one that fires the moment a pocket row exists: the detail screen queries the wrong id space

The board card links with a **pocket id**; the detail screen spends it as an
**account id**.

```
ListPocket.tsx:121   to={`pockets/${pocketId}`}          ← pockets.pocket_id
App.tsx:336          path: 'pocket/pockets/:pocketId'
PocketDetail.tsx:58  const { pocketId: accountId } = useParams()
PocketDetail.tsx:79  `${url_get_account_by_id}/${accountId}`   → GET /api/fintrack/account/:accountId
PocketDetail.tsx:104 `${url_get_transactions_by_account_id}/${accountId}/…`
```

`pockets.pocket_id` is `SERIAL PRIMARY KEY`
(`020_create_pocket_tables.sql:84`), a sequence of its own that starts at 1 and
has nothing to do with `user_accounts.account_id`. `getAccountById`
(`getAccountController.js:532-546`) resolves `WHERE ua.account_id = $1 AND
ua.user_id = $2`. Two outcomes, and **the collision is the normal case, not the
edge case**, because both sequences start at 1:

- **The id matches one of the caller's real accounts.** The screen renders that
  account's name in the title (`PocketDetail.tsx:154`), its balance under the
  label `Saved` (`SummaryPocketDetailBox.tsx:38`) and **its transaction
  statement** (`PocketDetail.tsx:236-239`) — under a pocket's screen. `target` is
  absent from a bank account's row, so `SummaryPocketDetailBox.tsx:22` computes
  `undefined - number` and `:45-48` prints **`NaN%`**.
- **The id matches nothing.** `404` (`getAccountController.js:545`), and the
  screen keeps the seed constant `DEFAULT_POCKET_ACCOUNT_LIST[0]`
  (`helpers/constants.ts:210-228`) on screen: a blank title, a target of `$0`, a
  committed figure of `$0` and `100.0%`. **Every one of those figures is
  invented by a frontend constant.**

It does not fire today only because the `pockets` table holds no rows and, per
the previous finding, the app cannot put one there. **Shipping the creation form
first is what arms it.** That ordering constraint drives the recommendation at §4.

> **CORRECTED 2026-08-30 — the id-space break is gone and the chain above no
> longer describes the code.** The card links `pockets/${pocketId}`
> (`ListPocket.tsx:201`), the route slot is `App.tsx:339`, and
> `PocketDetail.tsx:75` keeps the parameter's name — `const { pocketId } =
> useParams()` — parses it and hands it to `fetchDetail` at `:118`, which reaches
> `getPocketDetail` (`pocketApi.ts:63`) and `url_pocket_detail`
> (`urlConfig.ts:268`). No `url_get_account_by_id`, no
> `url_get_transactions_by_account_id` and no `DEFAULT_POCKET_ACCOUNT_LIST`
> appear anywhere under `pages/forms/pocketDetail/`. The hero
> (`SummaryPocketDetailBox.tsx`) reads the served `allocated`, `target` and
> `progress` and computes no percentage of its own.

---

## 2. The seven chains

Shape of every answer in this module, set by the controller:
`{ status, message, data }`. A validation failure answers
`{ status: 400, message: 'Validation Error', errors: [{field, message, code}] }`
(`pocketController.js:37-46`) — **note `errors`, not a single `message` string**;
no frontend layer declares that shape. A domain refusal answers
`{ status, message }` with no `errors` key (`pocketController.js:57-69`).

### 2.1 The board — `GET /api/fintrack/pocket/board`

The only chain that exists end to end.

```
pocketBoardService.js:172-198          → pocketApi.ts:25-31
  → usePocketBoardStore.ts:58-88       → PocketLayout.tsx:43-53 / ListPocket.tsx:96-106
```

| link | file and line | shape |
|---|---|---|
| server | `services/pocket_services/services/pocketBoardService.js:197` | `{summary, pockets[], meta:{notices[]}}` |
| row builder | `core/makePocketStatus.js:109-132` + `pocketBoardService.js:184` | 15 fields per row |
| header fold | `pocketBoardService.js:98-161` | 10 fields |
| HTTP client | `api/pocketApi.ts:25-31` | unwraps the envelope, returns `data` |
| store | `stores/usePocketBoardStore.ts:71-78` | splits into `summary`, `pockets`, `notices` |
| consumers | `PocketLayout.tsx:43-53`, `PocketBigBoxResult.tsx:15-22`, `ListPocket.tsx:96-106` | 4 of 10 summary fields, 8 of 15 row fields |

**Fields the frontend declares that the server does not send:** none. The
contract file was rewritten field for field against the builder and matches it.

**Response envelope:** unwrapped correctly, at the client
(`pocketApi.ts:26-30`). This is the only endpoint in the module where that
question has an answer.

**Fields the server sends that no layer consumes — capability that exists and is
invisible.** Thirteen, all declared in `types/pocketTypes.ts` and read by
nothing:

- on each row: `progress`, `daysRemaining`, `requiredMonthly`, `funded`,
  `overdue`, `sourceCount`, `uncovered`;
- on the header: `totalAllocated`, `totalExcess`, `overallProgress`,
  `fundedCount`, `overdueCount`, `uncoveredCount`.

Two of those absences change what the screen states:

- `PocketBigBoxResult.tsx:57` headlines `totalTarget` — the sum of the goals —
  while `totalAllocated`, the figure the module exists to report, is served and
  discarded. The component's own comment at `:52-54` records this as deferred.
- `ListPocket.tsx:147-149` derives the alert square from `remaining > 0` instead
  of reading the served `funded` and `overdue` booleans. It is a second answer to
  a question the server already answered, and it marks a pocket three months
  ahead of schedule identically to one whose deadline has passed.

> **CORRECTED 2026-08-30 — the thirteen unconsumed fields are down to none that
> matter, and both consequences are closed.** `PocketLayout.tsx:75-79` hands the
> whole summary and the whole row array to `PocketBigBoxResult`, which no longer
> takes four picked figures. The header prints `totalTarget`, `totalAllocated`
> and `totalRemaining` as three peer tiles (`:154-192`), `totalExcess` under the
> gap when it is above zero (`:184-190`), `overallProgress` on the board's one
> bar (`:314-341`), `pocketCount` (`:206`), `fundedCount`, `overdueCount` and the
> per-level counts (`:50-70`), and `uncoveredCount` as its own mark
> (`:263-270`). The card reads `progress`, `daysRemaining`, `requiredMonthly`,
> `sourceCount` and `uncovered` (`ListPocket.tsx:149-163`) and takes its square
> from the shared `pocketDateLevel` over the served `funded` and `overdue`
> (`:176`, `helpers/pocketStatus.ts:71-95`) — no `remaining > 0` anywhere.
>
> **The nullability contradiction below still stands:** `currency ??
> DEFAULT_CURRENCY` is now at `ListPocket.tsx:165`, still a dead branch. So does
> the formatter trap: `currencyFormat(chosenCurrency = 'USD', number = 0, …)` is
> still declared at `helpers/functions.ts:19-23`.

**Nullability contradictions.** One, in the harmless direction:
`ListPocket.tsx:108` writes `currency ?? DEFAULT_CURRENCY` over a field the
contract types non-nullable (`pocketTypes.ts:58`) and the builder refuses to emit
as anything but a lowercase string (`makePocketStatus.js:96-98`). Dead branch, no
runtime effect.

**The dangerous direction is a trap that has not sprung yet.**
`helpers/functions.ts:19-23` declares `currencyFormat(chosenCurrency = 'USD',
number = 0, …)`. The default parameter means **any nullable amount passed to it
renders as `0.00`**. `requiredMonthly` is the module's one deliberately-null
figure — null means *the deadline passed, there is no monthly pace to state*
(`makePocketStatus.js:123-127`) — and the first component that formats it through
this helper will print a monthly commitment of zero where the server withheld
one. Same for the six nullable summary amounts.

### 2.2 The detail — `GET /api/fintrack/pocket/:pocketId`

```
pocketDetailService.js:96-131   →   no client, no store, no consumer
```

**No frontend layer exists for this endpoint.** `urlConfig.ts` declares no detail
URL (`:248` is the board and the only one), `pocketApi.ts` declares one function
and it is the board's, `usePocketDetailStore.ts` does not exist, and no component
imports anything of the kind — a repository-wide grep for `pocketApi`,
`usePocketBoardStore` and `pocketTypes` returns twenty lines, all of them the
board.

> **CORRECTED 2026-08-30 — the whole chain exists.** `url_pocket_detail`
> (`urlConfig.ts:268`), `getPocketDetail` (`pocketApi.ts:63`),
> `stores/usePocketDetailStore.ts` (167 lines) and `PocketDetail.tsx` (563
> lines), which renders the hero, the funding sources and the allocation history
> from the one payload. The contract file types it: `PocketDetailPocket`
> (`pocketTypes.ts:124`), `PocketSource` (`:137`), `PocketAllocationEntry`
> (`:162`), `PocketDetailPayload` (`:181`) and `PocketDetailResponse` (`:188`).

What the server sends, unclaimed by anything:

| part | file and line | fields |
|---|---|---|
| `pocket` | `pocketDetailService.js:114-123` | the 14 board-row fields **minus `sourceCount`**, which `:123` deletes on purpose |
| `sources[]` | `pocketDetailService.js:45-83` | `accountId`, `accountName`, `accountType`, `heldByThisPocket`, `accountAllocated`, `accountBalance`, `accountUnassignedCash`, `covered` |
| `history[]` | `core/makeAllocationEntry.js:39-55` | `allocationId`, `amount`, `allocationDate`, `sourceAccountId`, `sourceAccountName`, `originalAmount`, `originalCurrency`, `exchangeRate`, `exchangeRateSource`, `exchangeRateTimestamp` |
| `meta` | `pocketDetailService.js:129` | `{notices: []}` — always empty on this endpoint |

**Nullability the future contract must not get wrong.** Five fields of a source
row are `null` on one branch and never on the other: when the allocation ledger
names an account the account read does not return — soft-deleted, or the internal
account — `pocketDetailService.js:59-68` serves `accountName`, `accountType`,
`accountAllocated`, `accountBalance`, `accountUnassignedCash` and `covered` as
`null` while `heldByThisPocket` stays a real amount. **A contract that types
those non-nullable invites the `?? 0` that would report a deleted account's
balance as zero.** `covered: null` also means *unknown*, not *not covered*: the
pocket-level `uncovered` flag is folded with `some(s => s.covered === false)`
(`:117`), which excludes the nulls, and any component recomputing it with
`!covered` would flip that.

**One nullability the reverse way:** `sourceAccountName` on a history row comes
from a plain `JOIN user_accounts` (`db/pocketRepository.js:152, :159`), so it is
never null even for the deleted account whose source row shows `accountName:
null`. The two names for the same account disagree by construction, and a
contract that types them alike will be wrong about one of them.

**One field that is not a calendar label, unlike every other date in the
module:** `exchangeRateTimestamp` is passed through raw from a `TIMESTAMPTZ`
column (`db/pocketRepository.js:157`) and crosses the driver as an instant.
`allocationDate` and `desiredDate` are `YYYY-MM-DD` labels resolved on the
owner's calendar (`:150`, `:71`). Typing all three as `string` and rendering them
with one helper will move the audit timestamp by a day west of UTC.

### 2.3 Create — `POST /api/fintrack/pocket`

```
pocketController.js:121-149   →   no client, no store, no consumer
```

**No frontend layer exists for this endpoint.** What exists instead is the
creation form pointed at the retired account endpoint — §1, first finding.

> **CORRECTED 2026-08-30 — the creation chain exists and the renamed-field table
> below no longer describes what the form sends.** `url_pocket_create`
> (`urlConfig.ts:258`), `createPocket` (`pocketApi.ts:79`) typed against
> `CreatePocketBody` (`pocketTypes.ts:201`), and `NewPocket.tsx:200-211` sending
> exactly the five contract keys. The response type it consumes is the detail
> payload, not `new_pocket_saving_account`.

**Renamed fields**, the form's payload against the validator
(`validation/zod/pocketValidators.js:67-81`):

| the form sends | `NewPocket.tsx` | the server expects | consequence |
|---|---|---|---|
| `target` | `:219-222` | `targetAmount` | `.strict()` → `400`, key named |
| `desired_date`, a JS `Date` | `:223` | `desiredDate`, `YYYY-MM-DD` matched by regex | `400`; a `Date` serialises to an ISO instant, not a calendar label |
| `type: 'pocket_saving'` | `:217` | no such key | `.strict()` → `400`, unknown key |
| `name`, `note`, `currency` | `:215-218` | same names | the only three that carry over |

**The response the form does not know about.** Create answers `201` with **the
entire detail payload**, not an id (`pocketController.js:141-145`), for the
reason stated at `:130-132`. The form's declared response type
(`types/responseApiTypes.ts:293-320`) describes `new_pocket_saving_account` with
`account_id`, `target`, `desired_date` and six FX columns — a different object
entirely.

### 2.4 Edit — `PATCH /api/fintrack/pocket/:pocketId`

```
pocketController.js:152-181   →   no client, no store, no consumer
```

**No frontend layer exists.** No `EditPocket` component, no URL, no client
function. The account editor's pocket branch still exists
(`editionAndDeletion/validations_zod/editSchemas.ts:26-52`) and edits the retired
account type.

> **CORRECTED 2026-08-30 — both halves are false.** `EditPocket.tsx` exists (536
> lines) on its own route slot (`App.tsx:352`), reached from `PocketEditLink.tsx`
> on the detail; the client function is `editPocket` (`pocketApi.ts:101`), typed
> against `EditPocketBody` (`pocketTypes.ts:228`), and it reuses
> `url_pocket_detail` with a different verb rather than declaring a second URL.
> The account editor's pocket branch is gone: a grep for `pocket_saving` under
> `frontend/src` returns nothing, so no client path edits the retired type.
> **The note's tri-state contract below is unchanged and still binds that form.**

Request: any of `name`, `note`, `targetAmount`, `currency`, `desiredDate`, at
least one, and `currency` required whenever `targetAmount` is sent
(`pocketValidators.js:94-121`). **`note` is nullable on purpose and the null is
load-bearing:** `null` clears the note, an absent key leaves it alone
(`:102-109`, honoured at `pocketWriteService.js:191-196`). A form that always
sends `note: ''` instead of omitting it, or that coerces null to `''`, makes
"remove this note" unexpressible.

Response: `200` with the detail payload (`pocketController.js:173-177`).

### 2.5 Allocate — `POST /api/fintrack/pocket/:pocketId/allocations`

```
pocketController.js:195-224   →   no client, no store, no consumer
```

**No frontend layer exists.** No `AllocateModal`, no source picker, no URL.

> **CORRECTED 2026-08-30 — all three exist.** `url_pocket_allocations`
> (`urlConfig.ts:278`), `allocateToPocket` (`pocketApi.ts:144`) typed against
> `PocketAllocationBody` (`pocketTypes.ts:276`), and one component pair serving
> both directions:
> `pages/forms/pocketDetail/pocketCashModal/PocketCashModal.tsx` (398 lines) with
> `PocketSourcePicker.tsx` (108 lines) beside it. The modal renders a conversion
> preview through `useCurrencyPreview` inside a `RateTooltip` (`:236-239`,
> `:352-358`) that issues no request, shows the ceiling without enforcing it
> (`:223-230`, `:361-364`) and prints the server's `422` verbatim (`:275`).

Request: `{sourceAccountId, amount, currency, allocationDate?}`, **always a
positive amount and never a sign** (`pocketValidators.js:133-142`, and the reason
at `:39-42`).

Response: `201` with the detail payload (`:213-220`). The service does build and
return the written row — `{allocationId, pocketId, sourceAccountId,
sourceAccountName, amount}` at `pocketAllocationService.js:257-263` — and **the
controller discards it** (`:203` awaits without binding). That is deliberate
(`:191-193`): one decision changes the hero, the source table and the history at
once. The consequence for the frontend is that the id of the row just written is
reachable only as the first element of `history[]`.

**Refusals a form has to be able to display**, all `422` with a message and no
`errors` array: the amount exceeds the account's unassigned cash
(`pocketAllocationService.js:208-212`), the account is deleted, is the internal
account, or is of an ineligible type (`:97-113`), the account is kept in another
currency (`:128-132`).

**The gate the reconciliation recorded is still closed and was re-measured.** The
source picker needs the committed figure, the uncommitted cash and the balance
per account, side by side. Only the single-account read serves them
(`getAccountController.js:789-802`); `getAllAccountsByType` serves none of them.
And no frontend type declares them either: `AccountListType`
(`types/responseApiTypes.ts:334-338`) is an `Omit` of the basic account type, and
a repository-wide grep for `allocated`, `unassignedCash`, `isOverAllocated`,
`heldFromThisAccount` and `heldByThisPocket` returns **two lines in the whole
frontend**, both of them the board card's `allocated` (`ListPocket.tsx:101`,
`:136`).

> **CORRECTED 2026-08-30 — the gate is open for bank accounts, and the picker
> reads through it.** `getAllAccountsByType` now attaches `allocated`,
> `unassignedCash` and `isOverAllocated` to every row when the requested type is
> `bank`, computed by the same `accountAllocationService` the commit path
> validates against, in one query for the whole list
> (`getAccountController.js:431-462`). A row the allocation read filtered out is
> **left unset rather than zeroed** (`:455-456`). On the client the shape is
> typed as `PocketEligibleAccount` (`pocketTypes.ts:299`) and fetched by
> `getPocketSourceAccounts` (`pocketApi.ts:178`), which `PocketCashModal.tsx:133`
> calls; `PocketSourcePicker.tsx:24-35` declares the three figures per row and
> renders a dash where one is null. `AccountListType`
> (`types/responseApiTypes.ts:303`) still declares none of the four — that is
> unit 14's, on the account detail, and it is untouched.

### 2.6 Release — `POST /api/fintrack/pocket/:pocketId/releases`

```
pocketController.js:195-224   →   no client, no store, no consumer
```

**No frontend layer exists.** Same request schema and same response as allocate —
one controller serves both (`:195`), the endpoint is the only thing that
distinguishes them, and the row is written negative on the server
(`pocketAllocationService.js:237`).

> **CORRECTED 2026-08-30 — it exists, and it is the same component as allocate.**
> `url_pocket_releases` (`urlConfig.ts:288`) and `releaseFromPocket`
> (`pocketApi.ts:159`); `PocketCashModal.tsx` takes a `direction` prop and
> branches on it at `:263-264`, with the release ceiling read from
> `sources[].heldByThisPocket` (`:201`) and the commit ceiling from the eligible
> account's `unassignedCash` (`:212`) — which is the asymmetry this section
> names.

One refusal is its own: releasing more than **this pocket holds from that one
account** — not more than the pocket holds in total —
(`pocketAllocationService.js:227-231`), which is what forces the release form to
name a source rather than a total.

### 2.7 Delete — `DELETE /api/fintrack/pocket/:pocketId`

```
pocketWriteService.js:248-285   →   no client, no store, no consumer
```

**No frontend layer exists.** No `DeletePocketModal`, no URL, no client function.

> **CORRECTED 2026-08-30 — all three exist.** `deletePocket` (`pocketApi.ts:123`)
> reuses `url_pocket_detail` with the `DELETE` verb, returns `DeletePocketResult`
> (`pocketTypes.ts:256`) with `PocketFreedCash` (`:240`) beside it, and
> `pages/forms/pocketDetail/deletePocketModal/DeletePocketModal.tsx` (243 lines)
> renders it, opened from `PocketDetail.tsx:531`. The `freed[]` shape this
> paragraph says nothing declares is declared there.

This is the **only** endpoint of the seven whose response is not the detail
payload: `200` with `{pocketId, name, freed: [{accountId, accountName,
freedCash}]}` (`pocketWriteService.js:270-278`, served at
`pocketController.js:239-243`). The `freed` rows are read inside the transaction
before the cascade removes them (`:242-244`), so the confirmation and the result
state the same thing. Nothing on the frontend declares this shape.

---

## 3. The mismatches, ranked by what breaks first at runtime

| # | what breaks | where | why it ranks here |
|---|---|---|---|
| 1 | **Creating a pocket succeeds and creates nothing the module can see.** The form writes a `pocket_saving` account; the board reads the `pockets` table | `NewPocket.tsx:113, :214-225` against `db/pocketRepository.js:62-84` | reachable today, from the module's own screen, on an empty database, with no precondition and no error |
| 2 | **The detail screen spends a pocket id as an account id**, rendering another account's name, balance and transaction statement, or a frontend constant's zeros | `ListPocket.tsx:121` → `App.tsx:336` → `PocketDetail.tsx:58, :79, :104` | fires the instant one pocket row exists; fixing #1 first is what arms it |
| 3 | **`NaN%` and a blank target on that same screen**, because `target` is absent from a bank account's row | `SummaryPocketDetailBox.tsx:22, :45-48` | same trigger as #2, and it is the visible symptom the user reports |
| 4 | **The seed constant states figures the server never sent** — target `$0`, committed `$0`, `100.0%` — whenever the request fails or is still in flight | `helpers/constants.ts:210-228` consumed at `PocketDetail.tsx:47, :64` | a fetch failure renders as a fully-populated pocket worth zero, which is the exact reading `makeSummary` refuses to serve (`pocketBoardService.js:92-96`) |
| 5 | **`currencyFormat` defaults a missing amount to `0`** | `helpers/functions.ts:19-23` | not sprung yet — no nullable figure is formatted today — but it is the `?? 0` waiting for `requiredMonthly`, whose null means *the deadline passed*, and for the six nullable header amounts |
| 6 | **`Saved` on the pocket detail hero**, the banned word on the screen the module is built around | `SummaryPocketDetailBox.tsx:20` | user-facing today on the live legacy screen; the figure is **allocated**, and this one also labels a *balance*, which is the retired model in one word |
| 7 | **`New Pocket account successfully created!`** — the retired noun in the success message | `NewPocket.tsx:129` | user-facing today; a pocket is a plan, not an account |
| 8 | **The alert square is derived instead of read** — `remaining > 0` where `funded` and `overdue` are served | `ListPocket.tsx:147-149` | a second answer to an answered question; visible as a wrong badge, not as a crash |
| 9 | **`totalAllocated` is served and the header prints `totalTarget`** | `PocketBigBoxResult.tsx:57` against `pocketBoardService.js:153` | the module's central figure exists in the payload and is not on screen |
| 10 | **The four cross-module account fields are served and undeclared** | `getAccountController.js:798-801` against `types/responseApiTypes.ts:334-338` | capability nobody consumes; blocks nothing today |
| 11 | **The validation-error shape is undeclared.** `{status, message, errors[{field, message, code}]}` | `pocketController.js:37-46` | costs nothing until a write form exists; then it costs field-level messages |
| 12 | **An unavailable exchange rate answers `500`, not `503`** | `fx_services/conversion/currencyAmountConversion.js:56` throws a plain `Error`; grep for `503` across the whole pocket tree returns nothing | fixes what the four write forms' error copy is allowed to say; blocks building them, no |
| 13 | **`saved:` in the dead board copy** | `pages/budget/components/ListPocket.tsx:71` | not user-facing: both its import and its usage are commented out (`pages/budget/Budget.tsx:7`, `:64-74`) |

> **RE-MEASURED 2026-08-30 — nine of the thirteen rows are closed. Four stand.**
>
> | # | state today |
> |---|---|
> | 1 | **closed.** The form writes a pocket (`NewPocket.tsx:200-211`) |
> | 2 | **closed.** The route parameter keeps its name (`PocketDetail.tsx:75`) and no request under `account/` is issued from that screen |
> | 3 | **closed with 2.** The hero prints the served `progress` (`SummaryPocketDetailBox.tsx:98`, `:113`) and computes no remainder |
> | 4 | **closed.** `DEFAULT_POCKET_ACCOUNT_LIST` is gone from `helpers/constants.ts`, and the detail seeds from nothing |
> | 5 | **stands.** `currencyFormat(chosenCurrency = 'USD', number = 0, …)`, `helpers/functions.ts:19-23` |
> | 6 | **closed.** The hero's label reads `allocated` (`SummaryPocketDetailBox.tsx:68`); the file's own header at `:17` states the rule |
> | 7 | **closed.** The success path navigates to the created pocket (`NewPocket.tsx:224`); the retired noun is gone with the message |
> | 8 | **closed.** The square comes from `pocketDateLevel` over the served flags (`ListPocket.tsx:176`, `helpers/pocketStatus.ts:71-95`) |
> | 9 | **closed.** `totalAllocated` is one of three peer tiles (`PocketBigBoxResult.tsx:162-167`) |
> | 10 | **stands.** `AccountListType` (`types/responseApiTypes.ts:303`) declares none of the four; that is the account detail's unit, untouched |
> | 11 | **stands.** No frontend type declares `{errors:[{field,message,code}]}`; a grep for `errors` in `pocketTypes.ts` and `pocketApi.ts` returns nothing, and the four write forms now exist, so this has stopped being free |
> | 12 | **stands.** A grep for `503` across `fx_services/`, `pocket_services/`, `pocketController.js` and `pocketValidators.js` returns nothing |
> | 13 | **closed.** `pages/budget/components/ListPocket.tsx` no longer exists |

**Renamed fields, collected.** `target` → `targetAmount` and `desired_date` →
`desiredDate` on create and edit; `account_balance` → `allocated` and
`account_id` → `pocketId` between the retired model and the current one;
`accountName` on a source row versus `sourceAccountName` on a history row, which
name the same account and differ in nullability (§2.2).

**Envelopes not unwrapped.** The board's client unwraps correctly
(`pocketApi.ts:26-30`). The legacy detail chain does not: `useFetch` hands the
whole `{status, message, data}` to the component, which reaches through it at
`PocketDetail.tsx:124-125` (`accountsData?.data?.accountList[0]`). Six endpoints
have no client to judge.

---

## 4. The next commit

### Build the pocket detail chain, end to end, in one commit

> **MARKED 2026-08-30 — this commit has been built; the section needs a fresh
> decision about what comes next rather than execution.**
>
> **What the passage asserts:** that the next commit is the detail chain — the
> contract file's detail half, one URL declaration, one client function, a new
> `usePocketDetailStore.ts`, `PocketDetail.tsx` rewritten onto it and
> `SummaryPocketDetailBox.tsx` rewritten onto the served figures — and that the
> creation form must wait for it.
>
> **What the code actually says:** all six files landed and so did the creation
> form. `pocketTypes.ts` declares the detail half at `:124-198`,
> `urlConfig.ts:268` declares `url_pocket_detail`, `pocketApi.ts:63` declares
> `getPocketDetail`, `stores/usePocketDetailStore.ts` exists at 167 lines,
> `PocketDetail.tsx` reads it at `:85` and `:118`, and
> `SummaryPocketDetailBox.tsx` reads the served `allocated`, `target` and
> `progress`. Beyond the six, the edit route, the deletion modal, the commit and
> release modal with its source picker, and the allocation entry modal all exist
> as well.
>
> **What now needs deciding:** the ordering argument this section rests on — that
> the creation form arms the detail defect and must therefore come second — has
> no subject left, so the next commit is not derivable from this document. The
> live sequencing question is which of the units still open takes precedence: the
> account detail's committed-cash block, the board's remaining visual work, or
> the backend gaps at rows 11 and 12 of §3. That is `POCKET_SEQUENCE.md`'s to
> settle, and nothing below is struck: the file list, the exclusions and the
> verification table are the record of how this commit was specified.

**Objective.** Make the card's link land on a screen that reads the pocket
endpoint, and type the payload that four of the seven endpoints answer with.

**Why this one and not the creation form**, which is the higher-ranked defect —
three reasons, in order of weight:

1. **Four of the seven endpoints answer with exactly this payload.** Create
   (`pocketController.js:141-145`), edit (`:173-177`), allocate and release
   (`:213-220`) all return `pocketDetailService.getDetail(...)`. Typing the detail
   payload once types the response of five endpoints out of seven. No other single
   contract in this module has that reach.
2. **Shipping the creation form first arms the wrong-id-space read.** Today the
   detail defect is unreachable because no pocket row can exist. A working create
   form puts rows on the board, and every card then leads to the screen at §1's
   second finding. The order is forced.
3. **The write path needs a detail store to exist.** The plan makes every write
   hand its answer to the detail store rather than refetch; that store is this
   commit's, and its absence is what blocks create, edit, allocate, release and
   delete alike.

**The exact files, and the exact change in each.**

| file | change |
|---|---|
| `frontend/src/fintrack/types/pocketTypes.ts` | append the detail contract beside the board's. A pocket object of the 14 board-row fields **without** `sourceCount` (`pocketDetailService.js:123`); a source row of the 8 fields with **five of them nullable on the orphan-account branch** (`:59-68`); a history row of the 10 fields of `makeAllocationEntry.js:39-55`, with `exchangeRateTimestamp` typed as the instant it is and not as a calendar label; the payload `{pocket, sources, history, meta}`. Do not re-type the board half |
| `frontend/src/urlConfig.ts` | one declaration beside `url_pocket_board` (`:248`): the detail URL, `pocket/`, taking the id at the call site |
| `frontend/src/fintrack/api/pocketApi.ts` | one function beside `getPocketBoard`, taking a `pocketId` and returning the payload — unwrapping the envelope the way `:26-30` does |
| `frontend/src/fintrack/stores/usePocketDetailStore.ts` | **new.** Keyed by pocket id, with the same three fetch states the board store carries, and an action that seats a payload handed to it by a write instead of refetching |
| `frontend/src/fintrack/pages/forms/pocketDetail/PocketDetail.tsx` | rewrite onto the store. Delete both legacy fetches (`:79`, `:104`), the seed constant (`:47`, `:64`), the transaction statement (`:236-239`) and the transaction-detail modal (`:256-259`) — a pocket has no transactions of its own |
| `frontend/src/fintrack/pages/forms/pocketDetail/summaryPocketDetailBox/SummaryPocketDetailBox.tsx` | rewrite onto the served figures. `Saved` (`:20`) becomes the allocated figure; the percentage is the served `progress`, not `Math.abs((remaining/target)*100)` (`:45-48`) |

**Dependencies.** All satisfied. Every backend endpoint is mounted
(`pocketRoutes.js:27-65`), the board's contract file and client are the pattern
this follows, and the route slot already exists (`App.tsx:336`). Nothing waits on
a migration.

**What it must NOT touch.**

- `NewPocket.tsx` and `url_create_pocket_saving_account` — the creation form is
  the commit after this one.
- `pages/pocket/` — the board is correct as of `8c7ca8f`; the card's link already
  carries the right id.
- `AccountDetail.tsx` and its `location.state.detailedData` branch, `Transfer.tsx`,
  the two overview files, the two edit schemas, `languages.ts` — the legacy sweep
  and the cross-module integrations are their own units.
- `pages/budget/components/ListPocket.tsx`, `DEFAULT_POCKET_LIST` and
  `DEFAULT_POCKET_ACCOUNT_LIST` — dead code whose removal is its own commit, and
  the seed constants stay until nothing imports them.
- The legacy half of `pocket-styles.css` above `:255`.
- **Anything under `backend/`.** The `503` for an unavailable exchange rate is a
  real gap and it is not this commit's.

**How to verify before committing.**

| criterion | how |
|---|---|
| the contract compiles against its consumers | a production build; `PocketSavingAccountsResponseType` and `PocketSavingAccountListType` must no longer be imported by either rewritten file |
| the screen reads the pocket endpoint | seed one pocket and one allocation through the live endpoints directly, open the card, and confirm in the network panel that the screen issues exactly one request, to `pocket/<id>`, and **none** to `account/<id>` or `account/transactions/<id>` |
| the figures are the server's | the title is the pocket's name, the committed figure equals the row's `allocated`, the source table lists the funding account with its held amount, the history lists the allocation with its rate and source |
| no figure is invented | with the server stopped, the screen shows an error with a retry — never a target of `$0`, never `100.0%`, never `NaN%` |
| the vocabulary holds | no user-facing string on the screen reads *saved*, *saving* or *balance*; the figure is labelled **allocated** |
| the diff is what it says | `git status` shows the six files and nothing else; no `backend/` path in the diff |

---

## 5. What this audit did not check

- **No server was started and no endpoint was called.** Every backend claim is a
  claim about what the source says it serves.
- **Whether migrations 019 and 020 have been run** against any database. The
  wrong-id-space finding does not depend on it: it depends only on the two id
  sequences being separate, which the schema settles.
- **The design and layout** of the detail screen. `PLAN_POCKET_FE.md` §11
  reserves that.
- **The account-detail and overview integrations** were checked only for whether
  the four cross-module fields are declared anywhere on the frontend. They are
  not. Their own screens were not traced.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

The contract of §2 — every field, type, nullability rule and status code — was
re-read against its builder and is unchanged. What aged is every statement about
what the frontend consumes. No decision was touched and no unit was reordered.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the creation form writing into the retired model | §1, first finding; §3 row 1 | `NewPocket.tsx:200-211` calls `createPocket`; the legacy URL and its route are both withdrawn |
| the detail screen spending a pocket id as an account id | §1, second finding; §3 rows 2, 3, 4 | `PocketDetail.tsx:75` keeps the parameter's name and the screen issues no request under `account/` |
| thirteen served board fields consumed by nothing, and the two consequences | §2.1 | the header takes the whole summary and the whole row array (`PocketLayout.tsx:75-79`); the card's square comes from the served flags |
| "no frontend layer exists" | §2.2, §2.3, §2.4, §2.5, §2.6, §2.7 — six endpoints | every one has a URL, a client function, a type and a screen; the files are named in each block |
| the source picker's gate as closed | §2.5 | `getAccountController.js:431-462` enriches the accounts-by-type list for `bank`; `PocketSourcePicker.tsx` renders the three figures |
| the ranking of thirteen mismatches | §3 | nine closed, four stand — the row-by-row state is the table above the renamed-fields paragraph |
| the recommended next commit | §4 | **marked, not struck.** Built in full, so the section's ordering argument has no subject and the next commit is not derivable from it |

**Left standing because they are still true:** the shared formatter defaulting a
missing amount to zero (`helpers/functions.ts:19-23`), the four cross-module
fields undeclared on `AccountListType` (`types/responseApiTypes.ts:303`), the
validation-error envelope declared by no frontend type, and an unavailable
exchange rate answering `500` rather than `503`.

---

## Contract change 2026-09-03 — the board reads a month, and the row carries its level

The board endpoint gains a query parameter and eleven served fields. This is the
frozen shape the frontend builds against; it supersedes the field list of §2.1
and contradicts one earlier statement outright, recorded below.

### The request

`GET /api/fintrack/pocket/board?month=YYYY-MM`

| aspect | rule |
| --- | --- |
| optional | absent means the current month |
| accepted | `YYYY-MM` or `YYYY-MM-DD`; a full date is truncated to its month |
| validated by | `boardQuerySchema` (`validation/zod/pocketValidators.js`), reusing `monthBound` from `budgetValidators.js` — strict, so an unknown key is a 400 naming it |
| refused | a month later than the current one, `422`, message naming both months |
| never sent by the client | the current month itself — resolved on the owner's calendar by `getCalendarToday`, because a browser west of UTC disagrees with one east of it for several hours a day |

**This contradicts §2.1's statement that the board is a GET carrying nothing,
and the frontend plan's "the board never grows a query parameter".** Both are
superseded by the month ruling of 2026-09-03 (`POCKET_DECISIONS.md` §23.4). The
parameter is optional, so a client that never sends it keeps the behaviour it
had.

### The evaluation date — the one date every figure reads

Resolved in `pocketBoardService.js` by `resolveEvaluationDate(monthStart, today)`:
today when the selected month is the current one, the last day of that month
otherwise. Every date comparison on the payload — the passed deadline, the days
remaining, the required pace, the schedule position and the level — is made at
this single point, and it is served in `meta` because the screen cannot derive
it.

### New fields on each row

| field | type | meaning | null when |
| --- | --- | --- | --- |
| `planStart` | `string` | `YYYY-MM-DD`, the day the plan was made, on the owner's calendar | never |
| `planInstalment` | `number \| null` | the target divided by the plan's whole months | the plan has no window |
| `scheduledByNow` | `number \| null` | what the instalments already due required | the plan has no window |
| `aheadOfPlan` | `number \| null` | committed minus scheduled, **signed** — positive is slack, negative is a shortfall against the line | the plan has no window |
| `paceRatio` | `number \| null` | the pace now needed over the pace the plan set | the deadline has passed, or the plan has no window; `0` once the target is covered |
| `level` | `string` | one of `completed`, `aboveTarget`, `onTrack`, `behind`, `atRisk`, `overdue` | never |
| `movedInMonth` | `number \| null` | the net of the selected month, signed | the caller asked for no month — the detail endpoint |
| `committedInMonth` | `number \| null` | the month's positive rows | as above |
| `releasedInMonth` | `number \| null` | the month's negative rows, as a magnitude | as above |

`allocated` and `sourceCount` keep their names and change their meaning: both are
now bounded at the close of the selected month. Every other row field is
unchanged.

**`behindSchedule` was proposed and does not ship.** A boolean cannot separate
*behind* from *at risk*, which is the whole point of the ratio.

### New fields on the header

| field | type | meaning |
| --- | --- | --- |
| `levelCounts` | `{completed, aboveTarget, onTrack, behind, atRisk, overdue}` | one count per level, every key always present with at least a zero |
| `aheadCount` | `number` | pockets whose `aheadOfPlan` is above zero |
| `totalAheadOfPlan` | `number \| null` | the sum of the positive slack only — a pocket behind its line does not cancel the slack another one holds |
| `totalMovedInMonth` | `number \| null` | the month's net across the board |
| `totalCommittedInMonth` | `number \| null` | the month's gross in |
| `totalReleasedInMonth` | `number \| null` | the month's gross out, as a magnitude |

The empty-board rule is unchanged: every amount null, never zero; every count a
real zero.

### New `meta`

```
meta: { referenceMonth, currentMonth, evaluationDate, notices[] }
```

`referenceMonth` and `currentMonth` are `YYYY-MM`; `evaluationDate` is
`YYYY-MM-DD`. The stepper labels the badge with the first and disables its
forward arrow at the second.

### What the frontend must do with this

- **Stop classifying.** `pocketDateLevel` (`helpers/pocketStatus.ts`) becomes a
  map from the served `level` to a word and a colour. A client that re-derives
  the level from the flags is a second answer to a question the server already
  answered, which is the defect this module's own header comment exists to
  prevent.
- **Stop counting.** `countByLevel` in `PocketBigBoxResult.tsx` is replaced by
  `summary.levelCounts`.
- **Six words, not five.** *At target* → **Completed**, *On plan* → **On track**,
  and **Behind** is new. *Above target*, *At risk* and *Overdue* keep their
  words. The summary strip's inline lower-cased literals must be brought onto
  the shared map, or the strip will say *at target* while the card beside it
  says *Completed*.
- **Ahead of plan is an axis, not a word.** A row in the readings card, an option
  in the filter beside *Funding not covered*, a line on the card, and a sort
  criterion — never a seventh level.
- **A null is a dash.** `currencyFormat` still defaults a missing amount to
  `0.00` (`helpers/functions.ts:19-23`), and this payload adds seven nullable
  amounts. That trap is now reachable.

### Indexes

Migration `029_pocket_board_month_indexes.sql` adds
`pocket_allocations(pocket_id, allocation_actual_date)` and
`pockets(user_id, created_at)`, with the reverse written. Mirrored in
`run_time_db_init/createTables.js` in the same pass, per the two-build-path rule.

---

## Contract change 2026-09-04 — the level vocabulary gains a seventh word

Concepts and reasoning: `POCKET_DECISIONS.md` section 24. This amends the
contract change of 2026-09-03 above, in three places and nowhere else. Not yet
implemented — the shape is frozen here first, as the standing rule requires.

### `level` on every row

Seven values, not six: `completed`, `aboveTarget`, `ahead`, `onTrack`,
`behind`, `atRisk`, `overdue`. The addition is `ahead`.

**What moved out of `onTrack`.** That value used to cover every pocket at or
above its plan's line, because the ratio being at or below 1 is algebraically the
same condition as the money figure `aheadOfPlan` being at or above zero. It now
covers only the pockets inside a tolerance band around the line. Everything
clearly above the band reads `ahead`; everything clearly below it reads `behind`
as before.

**A row reading `ahead` satisfies two conditions, not one:** the ratio below the
band, and `aheadOfPlan` above zero. The second exists for the single date on
which a deadline falling on a month end is evaluated at that month's close,
where the instalments left are floored at one and the ratio can read low while
the pocket is short of its whole target.

`planStart`, `planInstalment`, `scheduledByNow`, `aheadOfPlan`, `paceRatio` and
the three month figures are unchanged in name, type and meaning.

### `levelCounts` on the header

Seven keys, every one always present with at least a zero. `ahead` is added in
reading order after `aboveTarget` and before `onTrack` — corrected on
2026-09-04 when the classifier was written. The list runs best to worst,
and a pocket running early asks less of its owner than one sitting exactly
on its line.

### Two header fields change

| field | before | after |
| --- | --- | --- |
| `aheadCount` | pockets whose `aheadOfPlan` is above zero | **removed** — it is now `levelCounts.ahead` minus a rounding, which is two answers to one question |
| `totalAheadOfPlan` | the positive slack of every pocket holding any | the slack held by the pockets reading `ahead`, so the readings row states a count and an amount describing the same rows |

### What the frontend must do with this

- **A seventh word in the vocabulary map** (`POCKET_STATUS_WORD`,
  `helpers/pocketStatus.ts:66-76`) and a seventh key in each of the two class
  maps beside it.
- **The filter select gains the value and loses the toggle.** *Ahead of plan*
  becomes an option of the status select
  (`PocketToolbar.tsx:47-59`), and the separate toggle
  (`PocketToolbar.tsx:194-203`) with its `aheadOfPlanOnly` prop and its clause
  in `usePocketListFilter.ts:95-100` is removed. Nothing is lost: the value it
  selected is now a level.
- **The readings row reads the two narrowed fields**, not the retired count
  (`PocketBigBoxResult.tsx:579-588`).
- **The sort criterion stays** — it ranks by the money figure, which every live
  pocket still carries, and `null` still sorts as the least ahead.
- **Three of the seven words still render identically.** `completed`, `onTrack`,
  `behind` and now `ahead` all resolve to the bare status square until the two
  deferred colour tokens exist. Named, unstyled and commented as such, exactly
  as `behind` already is.

---

## Contract change 2026-09-04 (second) — the header folds the schedule, and the month's net gains a scoped twin

Concepts and reasoning: `POCKET_DECISIONS.md` sections 25 and 27, and the
obligation recorded in `POCKET_MODULE_SPEC.md` §0ter. This amends the two
contract changes above in two places and nowhere else. **Served —
`pocketBoardService.js:339-369`, `pocketTypes.ts:191-242`,
`PocketBigBoxResult.tsx:454-578`** (`59c09c5a`, `a6cc7f86`, `44949a45`). A rename
of one level word was drafted here and withdrawn the same day; what remains of
it is recorded below, so that a reader meeting the draft elsewhere knows it is
not contracted.

### Nine new fields on the header

None of these has appeared in this audit before: the ruling that created the
first five lives only in the module spec, so all nine are stated here together.
Every one is a fold over a field the row already carries, so there is no query
change and no migration.

| field | type | what it holds |
| --- | --- | --- |
| `totalScheduledByNow` | amount | the sum of `scheduledByNow`: what the plans required by the close of the selected month |
| `scheduledPocketsAllocated` | amount | the committed amount of those same pockets, printed beside what those plans required |
| `scheduleAdherence` | percentage, nullable, **not clamped** | the share of what the plans required that is actually committed — described in full below |
| `totalScheduleGap` | amount, **signed** | the sum of `aheadOfPlan`: positive is slack held, negative is the shortfall |
| `totalRequiredMonthly` | amount | the sum of `requiredMonthly`: the pace needed to finish on time |
| `scheduledPocketCount` | integer | how many pockets have a plan window at all |
| `underScheduleCount` | integer, never null | how many of those stand strictly below their own line (`aheadOfPlan < 0`) |
| `overScheduleCount` | integer, never null | how many stand at or above it (`aheadOfPlan >= 0`) |
| `scheduledPocketsMovedInMonth` | amount, **signed**, nullable | the net moved within the selected month across those same pockets — described in full below |

### The adherence percentage is served, not divided on the client

`scheduleAdherence` is the committed amount of the scheduled pockets over what
those same plans required by the selected close. **Nullable** on the same terms
as the amounts it divides, and **not clamped**: a board standing past its
schedule serves a figure above one hundred, and that is the reading, not an
error.

**It is a quotient of the two sums, and never a fold of per-pocket ratios.**
Clamping each pocket at one hundred before summing discards the surplus held by
every pocket standing over its own line, so the folded figure would read lower
than the two amounts printed beside it on the same line, where a reader divides
them by eye. **A percentage that contradicts the two numbers next to it is a
worse defect than one that exceeds a hundred.**

**The clamping happens at the bar's fill and nowhere else.** The fill stops at
the track while the label states the true value, so a board past its schedule
reads a figure above one hundred over a full bar, with a sentence beside it
saying the owner stands past what the schedule asked for.

**It is not named as the progress of the schedule.** That name carried the
clamped-per-pocket definition while the two sessions were disagreeing, and a
name that has meant two things is how a wrong implementation ships later.

This does not change the rule the lifetime progress figure follows. The two are
different kinds of number: one divides by a target that cannot meaningfully be
exceeded, the other by a schedule where exceeding it is the interesting case.

**A pocket exactly on its line counts on the over side.** The negative test is
strictly less than zero, so a pocket that has committed precisely what its plan
asked for falls to the over side. With that tie-break the two counts partition
the scheduled population exactly, so
`underScheduleCount + overScheduleCount === scheduledPocketCount` is a property
the client may rely on. A pocket whose window holds no full calendar month has a
null difference against the schedule, together with the other three schedule
figures on the row, and is in neither count — the same exclusion the ratio and
the amount it divides already make.

**Both counts are served, and both are non-null on any board, an empty one
included.** Neither is recovered by subtracting the other on the client: no
arithmetic over this payload is left to the browser at all.

**The signed total does not replace the pair, and the pair does not replace it.**
A net that comes to zero cannot say whether the board holds one pocket with
slack or five pockets short. The counts say how many are on each side; the
signed total says by how much overall.

**The side of the schedule is an axis and not the level scale.** It is set by
the sign of one money figure. The level is set by the pace ratio and names one
of seven mutually exclusive bands. The two counts are not level counts and must
never be summed with, or checked against, `levelCounts`.

`totalAllocated` is unchanged and is **not** the amount the adherence figure
divides: it includes the pockets with no plan window, which the denominator
excludes.

### The month's net gains a scoped twin — nothing is redefined

**The three board-wide movement figures keep their meaning exactly**: the net
moved within the selected month, the gross committed and the gross released, all
three folds across every pocket on the board (`pocketBoardService.js:279-281`,
summed at `:255-257`, all three null on an empty board at `:206-208`). None
changes and none is removed.

A fourth figure joins them, and it is the ninth schedule fold in the table
above:

| field | population | how it relates to the three above |
| --- | --- | --- |
| `scheduledPocketsMovedInMonth` | the pockets that hold a plan window | a **separate** fold, not a component of `totalMovedInMonth` and not derivable from it |

It takes the qualifier the other schedule folds already carry — the same one on
the committed amount of those pockets (`scheduledPocketsAllocated`) — so **the
name states its population** instead of leaving it to a comment. It is nullable
on the same two terms as every other amount on this header: an empty board, or a
mix of currencies the module refuses to add at an implicit one to one. It is
never served as zero in either case.

**Why the field was added instead of the existing net being narrowed.** An
earlier draft of this section narrowed `totalMovedInMonth` in place. That was
refused, and the reason belongs in the contract rather than in a commit message:
**changing a served field's meaning under a name that does not state its scope
forces every reader of that field to be re-verified**, and the readers outside a
repository search — this document, the overview plan, whatever is written next —
cannot be. A client already reading it would go on reading it and would silently
be reading a different population.

**Only the net is scoped.** No scoped gross halves ship. Nothing prints them,
and the module does not add a field before the question it answers is written
down.

**The consequence to state plainly, because someone will try the arithmetic:**
the two gross halves are board-wide, so they **do not decompose the scoped net**.
Subtracting the released from the committed yields `totalMovedInMonth`, the
board-wide net, and never `scheduledPocketsMovedInMonth`.

**Where each is read.** The scoped figure prints inside the tile carrying the
committed side of the schedule equation, under a balance counting those same
pockets, which is the whole reason it exists. The board-wide net has no consumer
on the hero and is not removed: it answers how much the owner saved in the month
across everything they hold, which is the app-wide overview's question.

### The rename of the pace band is withdrawn

An earlier draft of this section renamed the level for a pace above the plan's
and under double it, moving the value on every row and the key inside the
per-level counts object. **Withdrawn 2026-09-04, and no part of it is
contracted.** The argument was that the word for the negative side of the
schedule axis and the word for that band were the same word on one screen; the
argument holds, but the word for running early collides in exactly the same way,
so renaming a single band would have left half of the ambiguity in place. **The
level vocabulary is unchanged: seven values on a row and seven keys in the
per-level counts, spelled as the contract change above froze them.** The
ambiguity is resolved in the hero's own words instead, which is a screen
decision and not a payload one (`POCKET_DECISIONS.md` section 26).

The coverage vocabulary is likewise unchanged on every surface.

### What the frontend must do with this

- **The board summary type gains all nine fields.** `PocketBoardSummary`
  (`frontend/src/fintrack/types/pocketTypes.ts`) carries the schedule amounts,
  the served percentage, the two counts and the scoped net. **The client divides
  nothing and counts nothing**: the bar's label prints the served percentage and
  only the bar's fill is clamped to the track.
- **No existing field changes meaning**, so nothing already reading the board
  summary needs re-verifying. The hero reads the scoped net inside the committed
  tile, worded as a net, and leaves the board-wide net where it is.
- **No level identifier, no filter value, no status class and no colour token
  moves.** The withdrawn rename would have touched the union and its four maps
  (`helpers/pocketStatus.ts:32-119`), the fixture, the filter option and its
  level list, the card's tone map, and four stylesheets including the level's
  colour token; none of that work is owed.
- **One defect the withdrawn rename exposed stays on the record.** The board
  summary component asks for a square class with the level spelled inline
  (`PocketBigBoxResult.tsx:573`, `:605`, `:621`, `:659`), which the shared
  vocabulary map's own comment says cannot happen. Nothing now forces the fix; it
  is written down rather than left unsaid.
- **The hero's wording for the new fields is already decided**, drawn in
  `plan-docs/design-refs/pocket-hero/schedule-bar.html` and ruled in
  `POCKET_DECISIONS.md` section 27: the two left tiles say `to date`, the two
  counts render inside the segment that counts pockets and both sides print, the
  pace is worded as a monthly pace and never as an amount due, and the variance
  tile spells the side of the line in words under the amount.
