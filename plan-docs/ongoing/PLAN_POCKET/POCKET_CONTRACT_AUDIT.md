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
