# PLAN — POCKET FRONTEND

**Written 2026-08-29 against `fix/auth-screen`. Lives in `plan-docs/`, which is
gitignored: this document produces no commit.**

This is the executable plan. It consumes `POCKET_DECISIONS.md` (the frozen
model), `POCKET_BACKEND_INVENTORY.md` (the closed contract) and
`POCKET_FE_INVENTORY.md` (the factual baseline) and does not restate them. Every
field, type and status code below is taken from the backend inventory as the code
spells it, not from the specification and not from memory.

---

## 0. The framing, and the rule that governs every decision in this document

**The Pocket frontend is a replacement, not a refactor.** What exists on this
branch is built as *a pocket is an account of type `pocket_saving`, carrying a
stored balance, read through the generic account and transaction endpoints*. The
frozen model is *a pocket is a planning object, and the money stays in real
accounts, committed through pocket allocations*. Those are different objects. A
screen written for the first one is retired, not adapted.

**The governing rule:** never repair a legacy behaviour merely because it exists.
First ask whether that behaviour still belongs to the frozen model. For most of
the current Pocket code the answer is no, and repairing it would be work spent on
a path that is being removed.

One consequence worth stating early, because it cuts the other way: the eager
import of `PocketLayout` at `App.tsx:32` was recorded as an anomaly, and it is
not one. `BudgetLayout` (`:30`), `DebtsLayout` (`:34`) and `OverviewLayout`
(`:43`) are all eager, by the convention written at `App.tsx:28` — layouts are
structure and load immediately, pages are lazy. It stays exactly as it is. The
rule cuts both ways: a legacy behaviour that still belongs to the model is left
alone too.

### 0.1 The vocabulary, binding on payloads, identifiers, CSS class names and copy

| the old word | the new word | why |
|---|---|---|
| the account's stored balance | **`allocated`**, the committed figure | a pocket holds no money; the figure states what is committed to it |
| `account_id`, `account_name` | **`pocketId`**, **`name`** | a pocket is not an account and has no account row |
| transactions, movements, statement | **pocket allocation history** | no pocket allocation ever moved money |
| *saved*, *savings goal*, *Saving* | **allocated**, **target**, **pocket** | the word *saved* is banned; a screen that says it has re-introduced the idea that a pocket holds money |
| transfer to / from a pocket | — | pocket leaves both Transfer selectors; the operation does not exist |
| pocket in net worth | — | that cash is already counted inside its bank account |
| account type `pocket_saving` | — | the type disappears |

Two further rules from the frozen naming decision: **never the bare word
*budget*** inside this module — it names the separate monthly budget system, and
mixing them is the confusion the model removes; and **never the bare noun
*allocation*** — write **pocket allocation** or **monthly budget allocation**.
Identifiers that mirror a served field (`allocationDate`, `allocated`) spell what
the contract spells and are exempt from the second rule; prose is not.

### 0.2 The branch boundary — stated once and held for the whole plan

**`fix/auth-screen` is the only working tree that counts as available.** Nothing
of `/api/fintrack/pocket` is reachable from it: the whole backend module and the
account-detail enrichment commit `bf41c2c` live on
`worktree-agent-a4aee04d12f126b4e`. Until that merge lands, units 1 to 3 can be
written and typechecked, and **nothing from unit 4 onward can be exercised
against a running server.**

Three frontend files exist only on `feat/pocket` and its descendant worktree —
a board client, a response contract and a board store. They are **historical
evidence of an earlier approach, not reusable implementation.** The inventory
measured them against the closed contract and found: they name the account id and
the account name where the contract names the pocket id and the pocket name; they
use the banned word for the committed figure, in both the row and the summary;
they declare the target as nullable where the contract requires it positive on
create; their summary carries six fields where the contract serves ten; and they
carry a `desiredDateSource` field the contract does not have.

**Binding clause: those three files may not be cherry-picked, copied, or used as
a starting point.** If any line of them is to be reused, the reuse is preceded by
a clause-by-clause review of that file against §1 of this document, recorded in
the commit's file description. The merge brings them in as history; it does not
make them a base. The default action on a merge conflict in those three paths is
**take this plan's version, discard theirs.**

> **CORRECTED 2026-08-30 — the branch boundary this section states no longer
> exists.** The whole `/api/fintrack/pocket` tree is on `fix/auth-screen`: seven
> routes mounted (`pocketRoutes.js:27-65`), migrations `019` and `020` on disk,
> and the account-detail enrichment in `getAccountController.js`. The clause
> *"nothing from unit 4 onward can be exercised against a running server"* is
> void, and so is the branch premise the reconciliation already flagged. The
> **binding clause was honoured by outcome**: all three worktree files landed in
> the merge and every one of them has since been rewritten rather than adapted —
> `pocketTypes.ts` is 316 lines with seventeen exported types and no `saved`
> anywhere, `pocketApi.ts` is 188 lines with eight functions, and
> `usePocketBoardStore.ts` was rewritten around the served names.

---

## 1. The contract — eight endpoints, field by field

Seven pocket endpoints plus the account-detail endpoint that serves the four
cross-module fields. Everything below is read from `POCKET_BACKEND_INVENTORY.md`.

**Common to all seven pocket endpoints.** Base `/api/fintrack/pocket`, mounted
under `verifyToken`. Identity comes from the token; no route reads a user id from
the client. Success is `{ status, message, data }`. A schema failure is `400`
with `errors: [{ field, message, code }]`. A domain failure is `{ status, message }`.
**There is no `404` in this module, by decision:** a pocket id that does not exist
and one belonging to another user both answer `403` with the same sentence,
`Pocket not found or not owned by the authenticated user.`

Units: amounts are JSON **numbers** at 2 decimals; percentages are **0–100**, not
0–1; currency codes are **lowercase**; every calendar date is a **`YYYY-MM-DD`
string** resolved on the owner's zone. The single exception is
`exchangeRateTimestamp`, which arrives as a **full ISO instant**.

### 1.1 `GET /board`

No path parameter, no query string, no body. `200` always, including an empty
board. `message: 'Pocket board retrieved successfully'`.

`data.summary` — ten fields:

| field | type | note for the screen |
|---|---|---|
| `totalAllocated` | number \| null | the headline |
| `totalTarget` | number \| null | |
| `totalRemaining` | number \| null | each pocket clamped at zero **before** the sum |
| `totalExcess` | number \| null | the mirror; rendered as its own line only when non-zero |
| `overallProgress` | number \| null | capped at 100 by construction |
| `currency` | string \| null | `null` when the set is not a singleton |
| `pocketCount` | number | |
| `fundedCount` | number | |
| `overdueCount` | number | |
| `uncoveredCount` | number | |

**The empty board is `200` with every amount and percentage `null` and every
count `0`.** It is a new user, not an error, and it is not a `400`.

`data.pockets[]` — fifteen fields: `pocketId`, `name`, `note` (`null`, never
`''`), `target`, `allocated`, `remaining` (**raw and signed** — negative means
over-funded and that is the fact, not an error), `progress` (raw, may exceed
100), `desiredDate`, `daysRemaining` (negative once passed), `requiredMonthly`
(`0` once covered, **`null`** once the date has passed), `funded`, `overdue`,
`sourceCount`, `currency`, `uncovered`.

Rows arrive ordered by deadline then name. The other two sort criteria read
fields already on the row, so **no sort costs a query parameter.**

`data.meta` — `{ notices: [] }`, or the single string
`'Totals add amounts in more than one currency and are not converted.'`

Status codes: `200` always, `401` no identity claim, `500` unexpected.

### 1.2 `GET /:pocketId`

Path parameter coerced to a positive integer, `.strict()`. **One request serves
the whole detail screen; there is no separate history endpoint.**

`data.pocket` — every board row field **except `sourceCount`**, which is deleted
server-side because the source table answers the same question in full.

`data.sources[]` — one entry per (pocket, source account) pair whose running net
is not zero, sorted by held amount descending:

| field | type | note |
|---|---|---|
| `accountId` | number | |
| `accountName` | string \| null | `null` when the account is soft-deleted or is the internal account |
| `accountType` | string \| null | the raw catalog name, not a label |
| `heldByThisPocket` | number | the net **this** pocket holds from **that** account |
| `accountAllocated` | number \| null | that account's committed total across **all** pockets |
| `accountBalance` | number \| null | that account's real money |
| `accountUnassignedCash` | number \| null | `accountBalance − accountAllocated`, may be negative |
| `covered` | boolean \| null | `null` when the account figures are unavailable |

The three questions are kept apart and the screen must keep them apart:
`heldByThisPocket` is this goal's share, `accountAllocated` is every goal's, and
`accountBalance` is the real money.

`data.history[]` — newest decision first, every row:

`allocationId`, `amount` (**signed** — positive committed, negative released),
`allocationDate` (`YYYY-MM-DD`, from the decision date, **never** the row's
creation time), `sourceAccountId`, `sourceAccountName` (joined **without** a
soft-delete filter, so history still names an account the source table has
stopped naming), plus the five FX fields served **with the row**, not fetched
when a modal opens: `originalAmount` (**signed the same way as `amount`**),
`originalCurrency`, `exchangeRate` (ten decimals, **not** rounded to two),
`exchangeRateSource` (the provider, or the literal `identity`),
`exchangeRateTimestamp` (ISO instant).

`data.meta` — always `{ notices: [] }` on the detail. The key exists for shape
parity and is never populated.

Status codes: `200`, `400` id not a positive integer, `401`, `403`.

**Not served, and the screen must not invent it:** the pocket's own six FX audit
columns. `original_target`, `original_currency_id`, `exchange_rate`,
`exchange_rate_source`, `exchange_rate_timestamp` and
`exchange_rate_target_currency_id` are written on `pockets` and **no read query
selects any of them.** So the hero shows the converted target only. Showing the
goal as typed is a frontend requirement recorded against the backend at §9.3.

### 1.3 `POST /` — create

Body, `.strict()` — an unknown key is a `400` naming it:

| field | required | rule |
|---|---|---|
| `name` | yes | trimmed, 1 to 50 characters |
| `note` | no | trimmed, at most 155. **Optional but not nullable on create** |
| `targetAmount` | yes | positive number |
| `currency` | yes | one of `usd`, `eur`, `cop`, `ves`, `mxn`. **No default, deliberately** |
| `desiredDate` | yes | `YYYY-MM-DD` |

`currency` names the unit the target was **typed** in, not the unit the pocket is
kept in — the stored currency is always the accounting currency.

`201`, and **`data` is the entire detail payload of §1.2**, not an id.

Status codes: `201`, `400` (schema, or the converted figure failing the second
validation layer), `401`, `500` when the FX state has no rate for the typed
currency — see the gate at §9.1.

**The deadline is not checked against today by the code that exists.** A past
`desiredDate` is accepted and the pocket is born overdue. The frozen decision
refuses that; it is a backend change, gated at §9.1.

### 1.4 `PATCH /:pocketId` — edit

`.strict()`, five optional fields, two refinements.

| field | rule |
|---|---|
| `name` | optional, trimmed, 1 to 50 |
| `note` | optional **and nullable** — `null` clears it, an absent key leaves it alone |
| `targetAmount` | optional, positive |
| `currency` | optional, one of the five |
| `desiredDate` | optional, `YYYY-MM-DD` |

Refinement one: **at least one field must be sent** — an empty body is a `400`,
never a `200` that wrote nothing. Refinement two: **`currency` is required
whenever `targetAmount` is sent**, reported on the `currency` path.

The pocket's own currency cannot be changed and there is no field for it.
Committed money cannot be edited here; the ledger is untouched. **There is no
revision history and none is to be built** — changing a target replaces the
figure.

`200`, `data` again the whole detail payload, recomputed after the write.

Status codes: `200`, `400`, `401`, `403`, `500` (no rate).

### 1.5 `POST /:pocketId/allocations` and `POST /:pocketId/releases`

Two endpoints, one payload schema, `.strict()`:

| field | required | rule |
|---|---|---|
| `sourceAccountId` | yes | coerced positive integer |
| `amount` | yes | **positive, always. The client never sends a sign; the server writes it** |
| `currency` | yes | one of the five — the unit the figure was typed in |
| `allocationDate` | no | `YYYY-MM-DD`, defaults to the server's today. It records **when the decision was taken** |

The checks, in order, and what each one answers with: the pocket is the caller's
(`403`); the account is the caller's (`403`); the account may back a pocket at
all (`422` — soft-deleted, the internal account, or the wrong type, with `bank`
and `cash` the only eligible types); the account is kept in the accounting
currency (`422`); the conversion and the amount normalisation (`400`); and the
ceiling.

The two ceilings, both enforced inside a row lock, both naming **two figures** in
the message the screen renders verbatim:

| direction | ceiling | the `422` |
|---|---|---|
| commit | the source account's **unassigned cash** | *"Cannot commit `<amount>` to this pocket: "`<accountName>`" has `<unassignedCash>` of unassigned cash."* |
| release | the **net this pocket holds from that one account** | *"Cannot release `<amount>` from "`<accountName>`": this pocket holds `<held>` from it."* |

`201`, `message` either `'Funds allocated successfully'` or
`'Funds released successfully'`, and **`data` the whole detail payload of §1.2.**
The written row itself is discarded server-side and never reaches the client:
one decision changes the hero, the source breakdown and the history at once.

Status codes: `201`, `400`, `401`, `403`, `422`, `500` (no rate).

### 1.6 `DELETE /:pocketId`

**Never refused for a non-zero net.** A pocket allocation never moved money, so
destroying the ledger destroys no financial fact. No impact report, no close, no
archive.

`200`, and `data`:

| field | type |
|---|---|
| `pocketId` | number |
| `name` | string, read **before** the delete |
| `freed[]` | `{ accountId, accountName, freedCash }`, ordered by account name, omitting any account whose net had already fallen to zero |

Status codes: `200`, `400`, `401`, `403`.

### 1.7 `GET /api/fintrack/account/:accountId` — the four cross-module fields

Attached to `data.accountList[0]`, beside the existing columns.
`account_balance` is left exactly as it was: real money, tied to the statement.

| field | type | what it is |
|---|---|---|
| `allocated` | number | how much of this account is committed to pockets |
| `unassignedCash` | number | `account_balance − allocated`. **Never called "available balance"** — a pocket blocks no spend. May be negative |
| `isOverAllocated` | boolean | `unassignedCash < 0`; a state the screen reports and does not correct |
| `pockets[]` | array | `{ pocketId, name, heldFromThisAccount }`, ordered by pocket name, omitting any goal whose net from this account is zero |

**The four keys are absent from the payload entirely — not zero — for every
account type outside `bank` and `cash`,** and also when the account read returns
nothing (soft-deleted, or the internal account). `bank` is the only type
reachable today: the account-detail controller's own allowlist excludes `cash`,
so a cash account answers `404` two hundred lines before the enrichment runs.

The shortfall is stated **on the account** and never split across the pockets
listed beneath it. Any split would need a policy the app would have to invent.

---

## 2. The response contract file — `frontend/src/fintrack/types/pocketTypes.ts`

New file. Modelled on `fintrack/types/budgetTypes.ts`, whose header states the
rule this file inherits: when this file and the server disagree, the server is
what has to change. **No legacy vocabulary appears anywhere in it** — no
`account_id`, no `account_name`, no `balance`, no `saved`, no nullable `target`.

```ts
 // frontend/src/fintrack/types/pocketTypes.ts
 // Response contract of /api/fintrack/pocket, written against the closed backend
 // contract measured 2026-08-29.
 //
 // A pocket is a plan, not an account. It holds no money and has no balance: the
 // money sits in real accounts and a pocket allocation states that some of it is
 // committed to this goal. Nothing here names an account id, an account balance,
 // or a figure as saved.

 import { CurrencyType } from './types.ts';

 // ---- shared -------------------------------------------------------------
 // Every calendar date in the module is a YYYY-MM-DD label resolved on the
 // owner's zone. It is never parsed into a Date to be re-serialized: a Date
 // round-trip is what turned the legacy creation payload into an ISO instant.
 export type CalendarDate = string;

 export type PocketMeta = { notices: string[] };

 // ---- one pocket, as the board serves it ---------------------------------
 export type PocketBoardRow = {
  pocketId: number;
  name: string;
  note: string | null;
  target: number;
  allocated: number;
  // Raw and signed. Negative means committed above goal, which is a state to
  // display and not an error to hide.
  remaining: number;
  // 0-100, raw, so it may exceed 100.
  progress: number;
  desiredDate: CalendarDate;
  // Negative once the date has passed.
  daysRemaining: number;
  // 0 once covered, null once the date has passed. Never coerced to a number:
  // null is what the screen words as "the desired date has passed".
  requiredMonthly: number | null;
  funded: boolean;
  overdue: boolean;
  // COUNT(DISTINCT source account) over the whole ledger. It is NOT
  // sources.length on the detail: a fully released account still counts here
  // and is absent there.
  sourceCount: number;
  currency: CurrencyType;
  uncovered: boolean;
 };

 // ---- the same pocket, as the detail serves it ---------------------------
 // sourceCount is deleted server-side because the source table answers it in
 // full. Omit is used rather than a hand-written copy so the two cannot drift.
 export type PocketDetailFigures = Omit<PocketBoardRow, 'sourceCount'>;

 // ---- the board summary --------------------------------------------------
 // Every amount and every percentage is null on an empty board, and on a board
 // whose pockets span more than one currency. The counts are 0, never null.
 export type PocketBoardSummary = {
  totalAllocated: number | null;
  totalTarget: number | null;
  totalRemaining: number | null;
  totalExcess: number | null;
  overallProgress: number | null;
  currency: CurrencyType | null;
  pocketCount: number;
  fundedCount: number;
  overdueCount: number;
  uncoveredCount: number;
 };

 export type PocketBoardPayload = {
  summary: PocketBoardSummary;
  pockets: PocketBoardRow[];
  meta: PocketMeta;
 };

 // ---- one source account of one pocket -----------------------------------
 // The three figures are three different questions and the type keeps them
 // apart: what this goal holds from this account, what every goal holds from
 // it, and what is actually in it.
 export type PocketSourceAccount = {
  accountId: number;
  // null when the account is soft-deleted or is the internal account. The held
  // figure below is still real and the pocket still counts it.
  accountName: string | null;
  accountType: string | null;
  heldByThisPocket: number;
  accountAllocated: number | null;
  accountBalance: number | null;
  accountUnassignedCash: number | null;
  covered: boolean | null;
 };

 // ---- one row of the pocket allocation history ---------------------------
 // Not a transaction. No pocket allocation ever moved money.
 export type PocketAllocationEntry = {
  allocationId: number;
  // Signed: positive committed, negative released.
  amount: number;
  // The date the decision was taken, not the row's creation time.
  allocationDate: CalendarDate;
  sourceAccountId: number;
  // Joined without a soft-delete filter, so this still names an account the
  // source table has already stopped naming.
  sourceAccountName: string;
  // Signed the same way as amount.
  originalAmount: number;
  originalCurrency: CurrencyType;
  // Ten decimals, and deliberately not rounded to two like every other number.
  exchangeRate: number;
  // The provider, or the literal 'identity' when no conversion was needed.
  exchangeRateSource: string;
  // The one date in the module that is a full ISO instant, not a calendar label.
  exchangeRateTimestamp: string;
 };

 export type PocketDetailPayload = {
  pocket: PocketDetailFigures;
  sources: PocketSourceAccount[];
  history: PocketAllocationEntry[];
  meta: PocketMeta;
 };

 // ---- requests -----------------------------------------------------------
 // Every schema on the server is .strict(): an unknown key is a 400 naming it,
 // so no request type carries a field the contract does not list.

 export type CreatePocketRequest = {
  name: string;
  // Optional and NOT nullable on create. An empty note omits the key.
  note?: string;
  // The figure as typed, in `currency`. Never converted here: the server owns
  // the rate, and a client that converted first would decide the stored amount
  // with a rate the server never saw.
  targetAmount: number;
  // Required, no default. The unit the target was typed in, not the unit the
  // pocket is kept in.
  currency: CurrencyType;
  desiredDate: CalendarDate;
 };

 // Optional and nullable, which are two different things here: null clears the
 // note, an absent key leaves it alone. The form tracks which of the two it is.
 export type UpdatePocketRequest = {
  name?: string;
  note?: string | null;
  targetAmount?: number;
  // Required by the server whenever targetAmount is sent.
  currency?: CurrencyType;
  desiredDate?: CalendarDate;
 };

 // One shape for both directions. The amount is always positive: the client
 // never sends a sign, the server writes it from the endpoint that was called.
 export type PocketAllocationRequest = {
  sourceAccountId: number;
  amount: number;
  currency: CurrencyType;
  allocationDate?: CalendarDate;
 };

 // ---- responses ----------------------------------------------------------
 // The four write operations all answer with the whole detail payload, which is
 // why no refetch follows a write.
 export type PocketBoardResponse = {
  status: number;
  message: string;
  data: PocketBoardPayload;
 };

 export type PocketDetailResponse = {
  status: number;
  message: string;
  data: PocketDetailPayload;
 };

 export type DeletePocketResult = {
  pocketId: number;
  name: string;
  freed: { accountId: number; accountName: string; freedCash: number }[];
 };

 export type DeletePocketResponse = {
  status: number;
  message: string;
  data: DeletePocketResult;
 };
```

**What this file must not contain, and the reason for each:** a nullable
`target`, because create requires it positive; a `desiredDateSource`, because the
defaulted-deadline idea is not in the closed contract; any figure the client
would derive; and any of the seven names the vocabulary table retires.

---

## 3. Transport — the URL declarations and the HTTP client

### 3.1 The order changes here, and this is the reason

The order set for this plan is *response contract → HTTP client → URL
declarations*. **Those last two swap.** `pocketApi.ts` imports its URLs from
`urlConfig.ts`, so a commit that adds the client before the exports it imports
does not compile, and the boot test of the commit workflow cannot pass on it. The
declarations are inert data; the client is the logical change that consumes them.
Everything else in the stated order is kept.

### 3.2 `frontend/src/urlConfig.ts` — six declarations added

The file today declares **no `/pocket` module URL of any kind**. Added beside the
monthly budget block at `:195-205`, which is the convention: a `const` string when
there is no id, a function of the id when there is.

> **CORRECTED 2026-08-30 — the declarations exist, and they are five rather than
> six.** `url_pocket_board` (`urlConfig.ts:248`), `url_pocket_create` (`:258`),
> `url_pocket_detail` (`:268`), `url_pocket_allocations` (`:278`) and
> `url_pocket_releases` (`:288`), under a block heading at `:240`. **The separate
> `url_pocket_edit` this section argues for was not written:** edit and delete
> reuse `url_pocket_detail` with a different verb (`pocketApi.ts:106`, `:127`),
> so the paragraph below about declaring the same string twice describes an
> intention the code did not take. `url_create_pocket_saving_account` at `:74-75`
> is **deleted**, not untouched — those lines are the comment recording it, and
> the server route behind it is withdrawn as well.

```ts
 // GET /api/fintrack/pocket/board
 export const url_pocket_board: string = BASE_URL_APP + 'pocket/board';

 // GET /api/fintrack/pocket/:pocketId  and  DELETE on the same path
 export const url_pocket_detail = (pocketId: string | number) =>
  `${BASE_URL_APP}pocket/${pocketId}`;

 // POST /api/fintrack/pocket
 export const url_pocket_create: string = BASE_URL_APP + 'pocket';

 // PATCH /api/fintrack/pocket/:pocketId
 export const url_pocket_edit = (pocketId: string | number) =>
  `${BASE_URL_APP}pocket/${pocketId}`;

 // POST /api/fintrack/pocket/:pocketId/allocations
 export const url_pocket_allocations = (pocketId: string | number) =>
  `${BASE_URL_APP}pocket/${pocketId}/allocations`;

 // POST /api/fintrack/pocket/:pocketId/releases
 export const url_pocket_releases = (pocketId: string | number) =>
  `${BASE_URL_APP}pocket/${pocketId}/releases`;
```

`url_pocket_detail` and `url_pocket_edit` resolve to the same string and are
declared twice on purpose: the two are different operations and a rename of one
must not silently move the other. The eighth endpoint — the account detail —
already has `url_get_account_by_id`; nothing is added for it.

`url_create_pocket_saving_account` at `:74-75` is **not** touched here. It is
deleted in the unit that lands its replacement (§8, unit 10).

### 3.3 `frontend/src/fintrack/api/pocketApi.ts` — seven functions

New file, modelled on `fintrack/api/budgetApi.ts`, including the reason its
header gives for living outside `pages/`: the module's screens sit in different
route trees, so a client inside either one would make the other import from a
page that is not its own. **Errors are propagated untouched** — the `400`
envelope carries `errors[]` with a field and a code per issue, and a form that
marks the offending field needs all three; `normalizeError` flattens them to a
string, which is right at the point of display and not here.

| function | method and URL | returns |
|---|---|---|
| `getPocketBoard()` | `GET url_pocket_board` | `PocketBoardPayload` |
| `getPocketDetail(pocketId)` | `GET url_pocket_detail(id)` | `PocketDetailPayload` |
| `createPocket(body)` | `POST url_pocket_create` | `PocketDetailPayload` |
| `updatePocket(pocketId, body)` | `PATCH url_pocket_edit(id)` | `PocketDetailPayload` |
| `allocateToPocket(pocketId, body)` | `POST url_pocket_allocations(id)` | `PocketDetailPayload` |
| `releaseFromPocket(pocketId, body)` | `POST url_pocket_releases(id)` | `PocketDetailPayload` |
| `deletePocket(pocketId)` | `DELETE url_pocket_detail(id)` | `DeletePocketResult` |

Each unwraps the `{ status, message, data }` envelope and returns `data`, the way
`budgetApi.ts` does. `updatePocket` sends the body as given: it does **not** strip
`undefined` keys and does **not** convert an absent key into `null` — that
distinction is the note-clearing contract and the form owns it.

**Four of the seven return the same type.** That is the module's most
consequential contract and it is what the store below is built on.

---

## 4. The state machine — two stores, and why a write never refetches

Two files under `fintrack/stores/`, following `useBudgetStatusStore.ts`, whose
header states the argument that applies here identically: the levels do not share
a route branch, so entering a detail unmounts the layout and any state hanging
from its `Outlet`. A store survives that.

### 4.1 `usePocketBoardStore` — the board payload

State: `summary`, `pockets`, `notices`, `status: 'idle' | 'loading' | 'loaded' | 'error'`,
`error: string | null`.

| transition | trigger | effect |
|---|---|---|
| idle → loading | `fetchBoard()` | guarded: returns immediately when `status` is `loading` or `loaded`, so walking into a detail and back asks nothing |
| loading → loaded | the answer lands | writes all three slices; `error: null` |
| loading → error | the throw | writes `error` and **leaves `pockets` and `summary` as they were**, so a failed refresh does not blank a board that was on screen |
| loaded → idle | `invalidate()` | drops the memo without clearing what is rendered; the next mount asks again |
| any → loading | `refreshBoard()` | sets idle then calls `fetchBoard()`; wired to the error state's retry control |

### 4.2 `usePocketDetailStore` — one pocket's payload, and the write handoff

State: `detailId: number | null`, `detail: PocketDetailPayload | null`, `status`,
`error`. Actions: `fetchDetail(pocketId)`, `setDetailFromWrite(payload)`,
`clear()`.

`fetchDetail` asks only when `detailId !== pocketId`, or when `status` is `idle`
or `error`. `setDetailFromWrite` writes the payload, sets
`detailId = payload.pocket.pocketId` and `status: 'loaded'`.

### 4.3 What every write does, in one rule

**No write is followed by a refetch of the thing it wrote.** All four write
operations answer with the whole detail payload, so:

```
 create / edit / allocate / release
   -> detailStore.setDetailFromWrite(data)
   -> boardStore.invalidate()
   -> (create only) navigate to /fintrack/pocket/pockets/{data.pocket.pocketId}
```

Creation is the case that would otherwise reintroduce a defect this plan is
already fixing on another screen. The created pocket's detail travels **through
the store, not through `location.state`** — typed, surviving the route unmount,
and read by the detail screen because `detailId` already matches the route
parameter. The detail issues zero requests after a creation. Passing it as route
state is the exact shape of the Account Detail bug at §6.1 and is forbidden here.

**The board is invalidated, never patched, and the reason is a rule not a
preference.** A detail payload cannot rebuild a board row: `sourceCount` is
`COUNT(DISTINCT source account)` over the whole ledger and is deleted from the
detail, while `sources[]` lists only pairs whose net is non-zero — an account
fully released still counts in the first and is absent from the second, so
`sources.length` is a client-side derivation that can be wrong. And the folded
summary fields (`totalRemaining` and `totalExcess` clamp per pocket before
summing; `overallProgress` is a coverage ratio) are server folds the client is
forbidden to recompute. Invalidating costs no request while the owner stays on
the detail, and the board refetches once on its next mount.

`deletePocket` is the exception, because its answer is not a detail payload:

```
 delete
   -> the modal renders data.name and data.freed[] as its result state
   -> detailStore.clear(); boardStore.invalidate()
   -> the owner dismisses -> navigate to /fintrack/pocket
```

### 4.4 The write-signal bus — which way it runs

`fintrack/stores/transactionEvents.ts` already carries both signals.

**The board store subscribes at module scope, to both.** A transaction changes
`account_balance`, and therefore `unassignedCash`, `sources[].covered` and both
`uncovered` derivations, so `onTransactionRecorded` invalidates the board. An
account rename, re-typing or deletion changes `sources[].accountName` and what is
eligible, so `onAccountChanged` invalidates it too. Same shape as the monthly
budget store, same reason.

**Pocket writes announce nothing.** A pocket allocation writes no balance and
records no transaction, so it must not call `notifyTransactionRecorded()`. It
does not call `notifyAccountChanged()` either: no account field changes. Firing
either would make the monthly budget store drop a memo that is still true and
refetch for nothing. What a pocket write does change is a **derived** figure the
Account Detail reads fresh on every mount, and §6.1 makes that read
unconditional, which closes the loop without a signal.

---

## 5. Routing — four slots, and one of them is new

`frontend/src/App.tsx:130-397`, the single `createBrowserRouter` array.

| path | element | where it is declared |
|---|---|---|
| `pocket` + `index` | `PocketLayout` + `PocketBoard` | **inside `<Layout />`**, unchanged, `:205-221` |
| `pocket/new_pocket` | `NewPocket` | beside `<Layout />`, unchanged, `:289-296` |
| `pocket/pockets/:pocketId` | `PocketDetail` | beside `<Layout />`, unchanged, `:335-342` |
| `pocket/pockets/:pocketId/edit` | `EditPocket` | **new**, beside `<Layout />`, after the detail slot |

> **CORRECTED 2026-08-30 — all four slots exist and the anchors have drifted.**
> `pocket` with its index at `App.tsx:212`, `pocket/new_pocket` at `:293`,
> `pocket/pockets/:pocketId` at `:339` and `pocket/pockets/:pocketId/edit` at
> `:352`, the last three still declared beside `<Layout />` as this section
> requires. **`PocketLayout` did not become a thin header:** it still issues the
> module's request (`PocketLayout.tsx:25-27`) and still owns the hero
> (`:75-79`), plus the 3-second error timer (`:29-35`) and the
> absolutely-positioned inline-red paragraph (`:81-93`). The board summary lives
> in `PocketBigBoxResult.tsx`, rendered by the layout, not by a `PocketSummary`
> inside `PocketBoard`.

**The nesting is kept exactly as it is, and this is a decision, not an
oversight.** The detail and the form are siblings of `<Layout />`, so navigating
unmounts the layout and everything hanging from its `Outlet`. The monthly budget
module does precisely the same — its category level is declared beside
`<Layout />` at `:345` — and answers it with a module store rather than a route
context; that argument is written into `useBudgetStatusStore`'s own header.
Honouring it here means one module-state pattern in the application instead of
two. Re-parenting the detail inside `<Layout />` would additionally change the
navbar and scroll behaviour of a screen this plan is already rewriting, which is
two variables moving at once on a screen with no before-state to compare against.

The path segment doubles the noun — `pocket/pockets/:pocketId`. It is **not**
changed: the navbar entry, the repointed accounting dashboard route and any
bookmark all read it, and renaming it is a routing change wearing a cosmetic
justification. Recorded as debt, not fixed here.

`EditPocket` is a route and not a modal because the frozen component tree lists
it beside `NewPocket`, while `AllocateModal`, `ReleaseModal` and
`DeletePocketModal` are named as modals. The shape follows the name, and it
matches `account/:accountId/edit` at `:375`.

`PocketLayout` becomes a thin white header plus `<Outlet />` and **stops owning a
hero.** The board summary lives in `PocketSummary`, inside `PocketBoard`, because
the empty board replaces the hero entirely — a layout-owned hero cannot do that
without the layout knowing whether the board it does not render is empty.

---

## 6. The three cross-module integrations

This is where the risk sits. None of the three is optional.

### 6.1 Account Detail — and the absent-versus-zero problem

`frontend/src/fintrack/pages/forms/accountDetail/AccountDetail.tsx`, 423 lines.

**Three states, not two, and the screen must tell them apart:**

| state | what the payload shows | what the screen renders |
|---|---|---|
| **served** | the four keys are present | the commitment block |
| **not applicable** | the four keys are absent and the account type is outside `bank`/`cash` | nothing at all — no block, no zeroes, no dashes |
| **not known** | the four keys are absent because the network was never asked | the block in its skeleton state, until the answer lands |

The third state is the defect. `urlAccountById` is `null` whenever the caller
arrived with `location.state.detailedData` (`:95-98`), and `useFetch` returns
early on a null url. The accounting dashboard's
`handleViewRegularAccountDetail` (`AccountingDashboard.tsx:440-452`) passes
`detailedData: account` on every bank row it links, so **on the most common path
into this screen the account row never comes from the network and the four fields
never arrive — for a reason that has nothing to do with the account's type.**

**The fix: make the account fetch unconditional.** `urlAccountById` becomes
`` `${url_get_account_by_id}/${accountId}` `` with no branch, and
`location.state.detailedData` is demoted to what it actually is — a first paint,
overwritten the moment the answer lands. It keeps the screen from flashing empty
and stops deciding what the screen knows.

The two alternatives, and why neither is taken. Removing `detailedData` from the
dashboard's navigation call fixes one caller and leaves the branch in place for
the next one. Keeping the conditional and re-fetching when the fields are absent
cannot work at all: **absent-versus-zero is a distinction the payload makes, but
absent-versus-never-asked is not a distinction the payload can make** — only the
caller knows, and by the time the screen looks, the caller is gone. The only safe
rule is that the screen always asks. The cost is one request on a screen that
already issues a transactions request beside it.

**The type change.** `AccountListType` in `types/responseApiTypes.ts` gains the
four fields, **all optional and none defaulted**:

```ts
 allocated?: number;
 unassignedCash?: number;
 isOverAllocated?: boolean;
 pockets?: { pocketId: number; name: string; heldFromThisAccount: number }[];
```

`?? 0` on any of them is the defect, not the fallback. The presence test is
`accountsData.allocated !== undefined`, never a truthiness check — `0` is a real
and common value.

**What is rendered**, into slots the screen already has:

- The committed figure and the uncommitted cash as two `.input__box` blocks in
  the existing `.form__container` flex column (`forms-styles.css:151-172`), which
  takes an nth child without any change, or as the two-up
  `.account__dateAndCurrency` row (`:349-373`) — the only existing slot that puts
  two labelled figures side by side. Both exist; the frontend designer picks.
- `isOverAllocated` as `StatusSquare` (`BoxComponents.tsx:43-49`), the app's one
  state mark. A negative uncommitted figure renders as the negative figure with a
  line naming the over-allocation, and **blocks nothing**.
- `pockets[]` as a new `AccountPocketAllocations` list in the
  `account-transactions__container` band (`:241-266`), under a `CardTitle`. Each
  row is the pocket name and `heldFromThisAccount`, linking to
  `/fintrack/pocket/pockets/{pocketId}`.

**The copy rule, and it is load-bearing:** `unassignedCash` is never labelled
*available balance*. A pocket blocks no spend, and calling the remainder
*available* tells the owner they cannot spend money they can.

### 6.2 Overview — three removals, no replacement

**V1 carries no pocket figure on the overview.** Nothing is put back where these
come out; that is settled, not deferred.

| site | what goes |
|---|---|
| `OverviewLayout.tsx:96-110` | the `pocket_saving` balance request and its three destructured values |
| `OverviewLayout.tsx:143-145` | `totalPocketBalance` |
| `OverviewLayout.tsx:154-158` | `totalPocketBalance` out of `netWorthRaw` — **the double count**: that cash is already inside its bank account |
| `OverviewLayout.tsx:174` | the dependency-array entry |
| `OverviewLayout.tsx:181` | `pocketBalanceError` out of the error fan-in |
| `Overview.tsx:53`, `:71`, `:84-88`, `:136`, `:174-177`, `:384`, `:435` | the `SavingGoals` key, its endpoint entry, its slot in the result fold and its panel |
| `Overview.tsx:109-112`, `:479-482` | the `MovementPocketTransactions` entry and the *Last Movements (pocket)* panel — those are **transactions against pocket accounts**, which migration 020 deletes |
| `pages/overview/components/SavingGoals.tsx` | deleted with its last caller |

### 6.3 Transfer — pocket leaves both selectors

Moving money into a pocket stops being a transfer because it stops being a
movement of money.

| site | what goes |
|---|---|
| `Transfer.tsx:105` | `{ value: 'pocket', label: 'Pocket' }` from the origin radio set |
| `Transfer.tsx:113` | the same option from the destination radio set |
| `Transfer.tsx:185-188` | the `'pocket' → 'pocket_saving'` remap before the fetch |
| `types/types.ts:140-141` | `'pocket'` and `'pocket_saving'` out of `TransferAccountType` — two spellings of one thing in one union |
| `validations/zod_schemas/trackerMovementSchema.ts:33-34` | `'pocket'` out of both enums |

`constants.ts:74` — movement type `5` mapping to `'pocket'` — **stays** until
migration 020 runs. Rows of that type still exist and still need naming; deleting
the label first turns existing history into a blank. It goes in the final sweep.

---

## 7. The screens

### 7.1 The board — information architecture

`PocketLayout` (white header, `<Outlet />`) → `PocketBoard` → three regions.

**`PocketSummary`** — the headline is `totalAllocated`, and this is the
correction the whole board exists to make: today the headline is the goal under a
title that says savings, while the committed figure is computed and never
rendered.

| line | field | rule |
|---|---|---|
| headline | `totalAllocated` | |
| beside it | `totalTarget` | |
| | `totalRemaining` | what is still to commit; one over-funded pocket cannot cancel a short one |
| | `overallProgress` | 0–100, capped by construction |
| | `fundedCount` / `pocketCount` | rendered as *n of m funded* |
| conditional | `totalExcess` | its own line **only when non-zero** — it exists so `totalRemaining` can answer its question without an excess elsewhere cancelling it |
| marks | `overdueCount`, `uncoveredCount` | shown only when non-zero |

Currency comes from `summary.currency`. When it is `null`, every amount renders
as a dash and `meta.notices[0]` renders as the notice — **never as an error.**

**`PocketToolbar`** — search by name over `pockets[].name`, client-side; sort by
desired date ascending (the default, and the order the rows already arrive in),
name, or remaining; filters `All` / `Active` / `Funded` / `Overdue` /
`Uncovered`, **exclusive, not cumulative** — funded and overdue cannot both hold,
and stacked chips produce an empty set with no explanation. `Active` is
`!funded && !overdue`. All three sort criteria and all five filters read fields
already on the row, so **the board never grows a query parameter.**

**`PocketCard`**, one per row: `name`; `note` **omitted entirely when `null`** —
never the string `null`, which is what the legacy row prints; `allocated` as the
card's own headline; `target`; `remaining`, signed, worded *committed above goal*
when negative; a progress bar from `progress`, filled to 100 with a distinct
over-goal mark above it; `desiredDate` and `daysRemaining`; and the source line,
worded **"no pocket allocations yet"** when `sourceCount` is `0` — never
*0 accounts*. State marks for `funded`, `overdue` and `uncovered` use
`StatusSquare` plus a word: **colour alone survives neither colour blindness nor
print.**

**`PocketBoardEmpty`** replaces the hero entirely when `pocketCount` is `0`. A
hero of five dashes invites reading five figures that do not exist.

**One create control**, not the two identical renders the current board carries
above and below its list.

Dates and amounts use **one locale**. The legacy row formats dates `es-ES` and
amounts `en-US` in the same line.

### 7.2 The detail — information architecture

One request fills the whole screen. Four regions.

**`PocketHero`** — the plan, and nothing else. It is not a balance statement, and
there is no surface anywhere in this module for contributions, withdrawals or a
net change: those describe an object with its own money.

```
 EMERGENCY FUND

 Target              $10,000
 Allocated            $7,200
 Remaining            $2,800
 Progress                72%
 Desired date     Dec 31, 2026

 Required monthly      $700
 Days remaining         124
```

Three rules the hero must implement, all of them cases the contract creates:

- `requiredMonthly === 0` renders as *goal covered*, not as `$0`.
- `requiredMonthly === null` renders as **"The desired date has passed"**
  followed by the remainder. **No monthly pace is invented**, and `null` is never
  coerced to a number.
- `progress` is the raw ratio and may exceed 100. The percentage printed is
  progress, never the remaining share — the legacy hero prints the remaining
  share under a bare `%`, so a pocket at 72% displays `28.0%`.

The cream `SummaryDetailBox`
(`pages/forms/accountDetailSharedComponents/summaryDetailBox/`) already carries
an `action` slot and a `surface: 'dark' | 'light'` modifier and is shared by the
monthly budget levels and by `EditAccount`. The hero is built on it rather than
on the 58-line `SummaryPocketDetailBox`, which is retired.

**`PocketActions`** — two primary controls, **Allocate** and **Release**, and a
secondary menu holding **Edit** and **Delete**. Not four equal buttons: the
screen has to read as a goal being tracked, and the two money-commitment
operations are what the module is for. Release is disabled when `allocated` is
`0`. The secondary menu uses `AccountActionsMenu`
(`editionAndDeletion/components/accountActionMenu/`), which already handles
Escape, click-outside and focus return to its trigger — and whose own header
comment already claims `PocketDetail` as a caller.

**`PocketSourceAccounts`** — one row per `sources[]` entry: the account name, or
**"account removed"** when `accountName` is `null` while `heldByThisPocket` is
still real; then `heldByThisPocket`, `accountAllocated`, `accountBalance`,
`accountUnassignedCash`, and `covered` as a mark. When `covered` is `false` the
warning **names the account and the amount it is short by, and never charges a
share of that shortfall to this pocket.** *Allocated* and *covered* are two
different words on this screen and the copy keeps them apart: allocated is what
the owner decided to reserve, covered is whether the account behind it still
holds the cash.

At 360px the rows are **cards, not a table**: horizontal scroll would hide the
very column that disambiguates the three figures. A table from 768px up.

Accounts whose net has fallen to zero are absent, because the server does not
serve them. The history keeps the trace of the one that left.

**`PocketAllocationHistory`** — every `history[]` row, newest decision first:
`allocationDate`, the word **Committed** or **Released** together with the sign,
the amount, and `sourceAccountName`. Never called transactions, never rendered
through `AccountTransactionsList`. Each row opens the entry detail — §7.3.

**What the detail cannot show today:** the target as it was typed. The pocket's
six FX audit columns are written and never served, so the hero shows the
converted figure alone. That is a backend requirement, recorded at §9.3.

### 7.3 The pocket allocation entry detail — an open decision, §9.5

Whichever option is taken, the content is fixed: `originalAmount`,
`originalCurrency`, the stored `amount`, `exchangeRate`, `exchangeRateSource` and
`exchangeRateTimestamp`, with the conversion pathway shown **only when
`originalCurrency !== pocket.currency`**, and the rate written the way the
existing modal writes it. `exchangeRate` keeps its ten decimals and is not passed
through the two-decimal amount formatter.

### 7.4 The four write forms

All four validate through **Zod**, in a new
`fintrack/validations/zod_schemas/pocketSchemas.ts`, driven by `useFormManager`
and `validateForm` — **not** through the hand-rolled `validationData` the legacy
creation form uses. The reason is specific: both server schemas are `.strict()`
and answer with a per-field `errors[]`, the edit body carries a cross-field rule
(currency required beside a target) and a tri-state field (note absent versus
`null` versus a string), and `validateForm` already flattens issues into
`{ [field]: message }` for the label-row message the forms render.

Money fields keep the existing pattern without exception: the input, a
`CurrencyBadge` that cycles the currency, and a `RateTooltip` wrapping a
`.form__fx-preview` fed by `useCurrencyPreview` — the store-based preview that
states what will actually be stored and **issues no request.** The client never
converts and never guesses a rate; that is the whole reason conversion lives on
the server.

**`NewPocket`** — route `pocket/new_pocket`, rewritten in place.

| field | control | rule |
|---|---|---|
| `name` | text + `CharacterCounter` | 1–50 |
| `targetAmount` | number + `CurrencyBadge` + FX preview | positive |
| `currency` | the badge | **no default** — the badge must be explicitly set, because the server has none |
| `desiredDate` | `FormDatepicker` `variant='form'` | `YYYY-MM-DD`, **minimum today** |
| `note` | textarea + counter | optional, ≤155. Empty **omits the key**; it is not nullable on create |
| initial commitment | `InitialCommitmentBlock`, optional, defaulted to not taken | one source account, one amount, one currency, and a skip |

Three defects of the legacy form that are not carried over: the date is sent as a
`YYYY-MM-DD` label, not a JS `Date` that serialises to a full ISO instant; no
`type` key is sent, because the strict validator rejects it outright; and the
success path **navigates to the created pocket's detail** instead of setting a
message and nulling it two lines later, which is why the current form shows no
confirmation at all.

**The initial commitment block is a separately gated sub-unit.** The creation
validator is `.strict()` and rejects its keys today; the block ships only after
the backend learns them, and the request stays **one request, never two** — the
server creates the pocket and writes the first commitment in one transaction, and
if the commitment fails, nothing is written.

**`EditPocket`** — route `pocket/pockets/:pocketId/edit`. The five optional
fields, seeded from `usePocketDetailStore`. Three rules the form owns:

- **Dirty-field tracking is required, not optional.** An untouched field is
  **omitted** from the body; the server distinguishes an absent key from a sent
  one and an empty body is a `400`. The submit control is disabled while nothing
  is dirty, which is the client's half of the same rule.
- **The note is tri-state.** Untouched omits the key; emptied sends `null`, which
  clears it; edited sends the string. Sending `''` is not a way to clear it.
- **`currency` travels whenever `targetAmount` does**, and only then — sent alone
  it parses and is silently discarded, which is a `200` that wrote nothing the
  owner asked for.

The form does **not** compute the new monthly pace before saving. It states that
the pace will change, and the new value arrives in the response — deriving it on
the client is the one figure the model forbids deriving.

**`AllocateModal` and `ReleaseModal`** — one component pair over one payload
shape, differing in the endpoint they call, the verb they print and the ceiling
they display. Fields: `sourceAccountId` through `PocketSourcePicker`, `amount`
(**positive, unsigned — the sign is the server's**), `currency`, and an optional
`allocationDate` defaulting to blank, with helper text stating it records when
the decision was taken, so a set-aside agreed on Friday and typed on Monday can
be dated Friday.

`PocketSourcePicker` lists **every eligible account the server declares eligible,
including those with zero unassigned cash, disabled**, with the ceiling written
into the option — hiding one leaves the owner unable to see why an account is
missing. Three figures per account, side by side: the **balance**, the amount
**allocated to pockets**, and the **unassigned cash**. The three are shown
together precisely so the interface never has to choose one number to call
*available*: an account holding $4,000 with $1,500 committed must never be
presented as having $2,500.

The picker does not decide eligibility itself and does not filter by account
type. **Where its three figures come from is open — §9.4**, and it gates this
unit.

On release, the ceiling is `sources[].heldByThisPocket` for the chosen account,
already on screen from the detail payload. On commit, the ceiling is that
account's unassigned cash. The client shows the ceiling; **the server enforces
it**, and the `422` is rendered verbatim because it names both figures.

**`DeletePocketModal`** — a modal, not a page like `AccountDeletionPage.tsx`,
because deleting a pocket moves no money and produces no impact report, which is
what justifies the page for an account.

Two states in one component. The confirmation names the pocket and lists, from
`sources[]` already on screen, what will return to each account. The result state
renders `data.name` and `data.freed[]` from the response — server-authoritative,
and the only figures the owner is shown after the fact. Dismissing navigates to
the board.

### 7.5 The four fetch states — what is built and what is reused

**Nothing in the tree provides a skeleton, an empty state or a shared modal.** The
search for `*skeleton*` under `frontend/src` returns nothing, `ListPocket` renders
an empty `<article>` on both error and empty, and four independent modal
implementations exist.

> **CORRECTED 2026-08-30 — no *shared* primitive exists, but two local ones do,
> and the board's empty `<article>` is gone.** `ListPocket.tsx:90-143` renders
> error with a retry, three placeholder cards, and a worded empty state as three
> distinct answers; `PocketDetail.tsx:221-228` does the same for the detail.
> Neither lives in `general_components/`, which still holds no `skeleton/` and no
> `emptyState/` — so unit 5 now has the two real call sites it wanted to extract
> from. `PocketModalShell` was never written: the pocket modals each portal on
> their own.

**Built by this plan** — three shared pieces, added in one unit before the board,
because the board is the first screen that needs all of them:

| piece | where | scope |
|---|---|---|
| `Skeleton` | `general_components/skeleton/` | a block taking width, height and radius from tokens; no content, no animation library |
| `EmptyState` | `general_components/emptyState/` | icon, title, body, one optional action |
| `PocketModalShell` | `fintrack/pages/pocket/components/` | `createPortal`, Escape, click-outside via `useClickOutside`, focus return — the `BudgetEditModal` mechanics, which is the newest of the four and the only one that portals |

`PocketModalShell` is deliberately **not** a fifth app-wide modal abstraction.
Unifying the four that exist is its own work on four screens this plan does not
touch, and doing it here would be tidying inside a feature commit. The two
primitives above are shared components because they have no pocket-specific
content at all; adopting them on other screens is out of scope and explicitly not
done by this plan.

**Reused unchanged:** `SummaryDetailBox`, `StatusSquare`, `CardTitle`,
`CurrencyBadge`, `useCurrencyPreview` + `RateTooltip`, `FormDatepicker`,
`CharacterCounter`, `FormSubmitBtn`, `DropdownSelection`, `AccountActionsMenu` +
`AccountActionsTrigger`, `MessageToUser` + `showToastByStatus` (the toast
container is already mounted at `App.tsx:404-417`), `TopWhiteSpace`,
`useFetchLoad`, `normalizeError`, and the `.page__container` / `.page__content` /
`.form__container` / `.input__box` envelope from
`pages/forms/styles/forms-styles.css`.

**The four states, per screen:**

| state | board | detail | forms and modals |
|---|---|---|---|
| loading | `Skeleton` for the summary and three card placeholders | `Skeleton` for the hero, the source rows and the history rows | the submit control's own disabled state |
| empty | `PocketBoardEmpty` **replacing the hero** | no source rows and no history rows are two separate worded empty lines; the hero always renders | n/a |
| error | a message plus a **retry** wired to `refreshBoard()` | a message plus a retry wired to `fetchDetail(id)` | `MessageToUser` `variant='form'`, the toast path every creation form already uses |
| success | n/a | n/a | navigate (create), return to the detail (edit), close with the payload applied (allocate, release), the freed list (delete) |

**Three practices that do not survive into this module:** the absolutely
positioned `<p>` with inline colours cleared by a 3-second timer; the bare
`<p>Error fetching…</p>` with no retry; and `<p>Loading...</p>`. Every error state
in this module has a retry control. `CircleLoader` stays where it is, as the
`LazyRoute` fallback.

**And the rule that makes the whole thing checkable: no `?? 0` anywhere in the
module.** A missing figure is a skeleton or a dash, never `0` and never `NaN`.
The legacy board coerces all four of its figures that way.

### 7.6 Styling — the rules the module is written under

Every value comes from a token: colour, spacing, radius, font size, font weight.
No hex, no pixel literal, in CSS or inline. No token is invented; a value with no
token is a question, not a guess.

Every interactive element declares default, `:hover`, `:focus-visible` (2px ring,
2px offset), `:active` and `:disabled` (`opacity: 0.5; pointer-events: none`).
The legacy board declares none of these on `.card__tile__pocket`, which is a
`<Link>`.

Mobile-first from 360px, `min-width` at 480/768/1024, and the two height steps at
735px and 568px. `pocket-styles.css` declares **zero** `@media` queries today, so
the module's stylesheets are written new, not extended.

BEM `.block__element--modifier`, interactive state as `.is-active`, one level of
descent, no `!important`. The board is dark (`--bgBodyColor`), its header is white
(`--light`), and the data panels are cream (`--creme`) with dark text (`--dark`);
a component landing on both surfaces exposes `.light` / `.dark` modifiers naming
the surface it sits on, not its own colour.

`index.css` sets `font-size` on the universal selector, so any inline element
inside a formatted figure must restate `font-size: inherit`.

**`pocket-styles.css` is replaced, not extended.** It carries an invalid
declaration the browser drops (`color: cyan f`), a duplicated `.pocketLayout`
block, `!important` on two rules and four hardcoded colours.

> **CORRECTED 2026-08-30 — the file was extended, not replaced, and the
> zero-`@media` premise is stale.** `pocket-styles.css` is now 1141 lines and
> declares breakpoints at 480 (`:387`) and 768 (`:1117`), the two height steps
> (`:1127`, `:1133`) and three `prefers-reduced-motion` blocks (`:375`, `:723`,
> `:1104`). **No 1024 breakpoint**, which criterion 7 of §10 asks for. The legacy
> half survives with drifted anchors: `color: cyan f` at `:156`, `!important` at
> `:14` and `:260`, the duplicated `.pocketLayout` at `:4` and `:11`, and the dead
> `.card__budget--title` at `:122` — the bare word this module's own vocabulary
> rule bans, inside its own stylesheet.

---

## 8. The units — one logical change each, in order

Units 1 to 3 can be written and typechecked before the merge of §0.2. **Nothing
from unit 4 onward can be exercised until it lands.**

| # | unit | what it contains | deletes |
|---|---|---|---|
| 0 | the broken dashboard route | one line at `AccountingDashboard.tsx:64` — **open, §9.2** | — |
| 1 | the response contract | `types/pocketTypes.ts` | — |
| 2 | the URL declarations | six exports in `urlConfig.ts` | — |
| 3 | the HTTP client | `api/pocketApi.ts`, seven functions | — |
| 4 | the stores | `usePocketBoardStore.ts`, `usePocketDetailStore.ts`, both bus subscriptions | — |
| 5 | the fetch-state primitives | `Skeleton`, `EmptyState` | — |
| 6 | the routes | the `EditPocket` slot; `PocketLayout` reduced to header + `Outlet` | the layout's hero fetch and its 3-second error timer |
| 7 | the board | `PocketBoard`, `PocketSummary`, `PocketToolbar`, `PocketCard`, `PocketBoardEmpty`, a new stylesheet | `Pocket.tsx`'s duplicated control and commented blocks, `pages/pocket/components/ListPocket.tsx`, `pages/budget/components/ListPocket.tsx` (the byte-identical dead copy), `PocketBigBoxResult.tsx`, `DEFAULT_POCKET_LIST`, `pocket-styles.css` |
| 8 | the detail | `PocketHero` on `SummaryDetailBox`, `PocketSourceAccounts`, `PocketAllocationHistory`, `PocketActions` | `PocketDetail`'s statement band, `SummaryPocketDetailBox` + its stylesheet, `DEFAULT_POCKET_ACCOUNT_LIST` |
| 9 | the entry detail | the pocket allocation entry modal — **shape open, §9.5** | — |
| 10 | create | `NewPocket` rewritten, `pocketSchemas.ts`, `PocketModalShell` | `url_create_pocket_saving_account` |
| 10b | the initial commitment | `InitialCommitmentBlock` — **gated, §9.1** | — |
| 11 | edit | `EditPocket` | the `pocket_saving` branch of `editSchemas.ts:26-48`, `:97`; `accountEditSchema.ts:147-183`; the label at `languages.ts:100`, `:217`, `:327` |
| 12 | allocate and release | `AllocateModal`, `ReleaseModal`, `PocketSourcePicker` — **gated, §9.4** | — |
| 13 | delete | `DeletePocketModal` | — |
| 14 | Account Detail | the unconditional fetch, the four optional fields on `AccountListType`, `AccountPocketAllocations` | — |
| 15 | Overview | the three removals of §6.2 | `components/SavingGoals.tsx` |
| 16 | Transfer | the five sites of §6.3 | — |
| 17 | the legacy sweep — **gated, §9.1** | — | the five account-shaped response types, `PocketsToRenderType`, `pocket_saving` from the account-type union at `types.ts:141`, the dashboard tile at `AccountingDashboard.tsx:51`, `MOVEMENT_TYPES[5]` |

> **RE-MEASURED 2026-08-30 — thirteen of the nineteen rows have landed.**
>
> | # | state | note |
> |---|---|---|
> | 0 | **superseded.** The dashboard's pocket tile and its route entry were deleted rather than repointed | there is no row left to send anywhere; the card labels an unknown type from the tile map's `other` entry (`AccountingDashboard.tsx:622-632`) |
> | 1, 2, 3, 4 | **landed** | `pocketTypes.ts` (316 lines, 17 types), five URL declarations, `pocketApi.ts` (8 functions), both stores |
> | 5 | **not landed** | no `general_components/skeleton/`, no `general_components/emptyState/` |
> | 6 | **half** | the fourth route slot exists (`App.tsx:352`); the layout reduction did not happen |
> | 7 | **substantially landed** | the header, the card and the empty state are rebuilt; the toolbar — search, sort, five filters — does not exist, and no component split into `PocketSummary` / `PocketCard` / `PocketBoardEmpty` happened |
> | 8 | **landed**, in place rather than on the shared cream box | `SummaryPocketDetailBox.tsx` (126 lines) plus the source table, the history and the actions inside `PocketDetail.tsx` |
> | 9 | **landed**, by extraction | `allocationEntryModal/AllocationEntryModal.tsx` over `general_components/fxPathwayCard/` |
> | 10 | **landed**, without `pocketSchemas.ts` and without `PocketModalShell` | `NewPocket.tsx:200-224` |
> | 10b | **still gated** | `createPocketBodySchema` is `.strict()` over five keys (`validation/zod/pocketValidators.js:65-81`) |
> | 11 | **landed** | `EditPocket.tsx` (536 lines); the account editor's pocket branch, its field list and its labels are all gone |
> | 12 | **landed** | `pocketCashModal/PocketCashModal.tsx` with `PocketSourcePicker.tsx`; the gate opened at `getAccountController.js:431-462` |
> | 13 | **landed** | `deletePocketModal/DeletePocketModal.tsx` |
> | 14 | **not landed** | `AccountDetail.tsx:96` still branches the url to `null`; `AccountListType` (`types/responseApiTypes.ts:303`) declares none of the four |
> | 15, 16, 17 | **landed** | no pocket read on the overview, no pocket in either transfer selector, and `pocket_saving` appears in no file under `frontend/src` |

> **Row 7 re-measured 2026-08-31 at head `fb4dc01`: the half of it that said the
> toolbar does not exist is now false.** It exists, whole and committed, in
> `pages/pocket/components/PocketToolbar.tsx` — search by name capped at 50
> characters, three sort criteria (deadline, name, shortfall) and **seven** filter
> chips rather than the five this plan asked for: `All`, the five status levels,
> and coverage last, because coverage is a different axis and not a sixth level.
> It owns no state of its own: every value arrives as a prop so `ListPocket` can
> back it with the URL, and the matched-of-total counts come from
> `usePocketListFilter`, so filtering changes what is listed and never what the
> hero reports. **None of its words are typed in the file** — the five level chips
> read the shared map, which is what stops the board from naming a level
> differently to the card beside it.
>
> **The other half of row 7 still holds**: no split into `PocketSummary` /
> `PocketCard` / `PocketBoardEmpty` happened. The board's empty state does exist,
> but inside the list (`ListPocket.tsx:192-201`), and **the hero has none of its
> own** — with zero pockets and totals served it still paints the equation and the
> partition at zero. Rows 0 through 6 and 8 through 17 were **not** re-measured in
> this pass.

**Why the retirements sit where they do.** Every deletion above lands in the unit
that ships its replacement, in the same commit, on the same route slot. None of
them rests on *nobody imports it* — during a refactor that only means the caller
is not written yet. The two exceptions are stated as such: the byte-identical
dead card copy, whose only two mentions are already commented out, and unit 17,
which is gated on a migration rather than on a replacement.

**The account editor's pocket branch is retired in unit 11 and not before.** It
is the path that writes a target with no conversion, and the frozen decision
retires it rather than repairing it — writing an FX step into code that is being
removed is work spent on a path that will not exist. Retiring it in the unit that
lands `EditPocket` means there is no window in which a pocket has no edit route.

---

## 9. Open decisions — recorded with a recommendation, not left blank

### 9.1 Retiring the account type `pocket_saving` — blocked on the migration

The frontend cleanup that removes `pocket_saving` from the account-type union,
from the accounting dashboard tile and from the movement-type label **cannot land
before migration 020 runs.** Two facts block it.

> **CORRECTED 2026-08-30 — the cleanup has landed, and one clause of it was
> deliberately not taken.** No file under `frontend/src` names `pocket_saving`:
> the union, the dashboard tile and its route entry, the two edit schemas, the
> labels file and the seed constants are all gone. **The movement-type label
> stays and is meant to** — `helpers/constants.ts:73` still maps `5: 'pocket'`,
> because rows of that movement type still exist and deleting the label turns
> existing history into a blank; the migration keeps the catalog row for the same
> reason. The server went further than this unit's scope: the route that created
> an account of the retired type is withdrawn (`accountRoutes.js:57-62`,
> `accountCreationController.js:977-985`).
>
> **What is still open is not the sweep but the satellite table.**
> `pocket_saving_accounts` still exists and three server branches still join it —
> the accounts-by-type read, the account detail read and the account editor —
> which is what the retired-type audit records as a later commit, gated on the
> production question below rather than on the sweep.

The migration **fails against the copy of production data**: it aborts with
`column u.timezone does not exist`, because step 2 converts each legacy deadline
into a calendar day on its owner's clock and that copy predates the time zone
work. Whether the live database also lacks the column was never checked. And
**one real legacy pocket exists** in that copy — account `108`,
`cash_loc_chinita`, not deleted, holding 90.00 against a target of 420.00 with a
deadline in 2027 — with an unresolved question: does the migration write a pocket
allocation row of 90 for it, or leave it at zero? The recorded recommendation is
to write the row, because the owner stated a goal, named a figure and moved money
towards it.

> #### MEASURED 2026-08-30 — development database `fintrack_dev`, read-only
>
> Taken through the connection `backend/.env` resolves to, which is `localhost`
> and the database `fintrack_dev`. Four readings:
>
> | reading | result |
> |---|---|
> | accounts of the retired pocket type — `user_accounts WHERE account_type_id = 4` | **0** |
> | rows in the legacy extension table `pocket_saving_accounts` | **0** |
> | rows in `pockets`, the new plan table | **4** — `ahorro`, `pocket de prueba`, `travels`, `test` |
> | rows in `pocket_allocations` | **0** |
>
> The migration ledger of that database holds 21 rows and its last three are
> `018`, `019` and `020`, so **migration `020` has run here** and the conversion
> it performs is what left the table in that state. The catalog row for
> `pocket_saving` is still present as `account_type_id = 4`, which is what the
> migration intends — it deliberately does not remove it.
>
> **What this does and does not settle.** It settles that **no account of the
> retired pocket type survives on the development database**, so nothing on that
> database is waiting on the open question above. It settles **nothing about
> account `108`**: that account lives in the copy of production data, and this
> reading was not taken there. `fintrack_dev` is not a copy of production and was
> never claimed to be.
>
> **The disagreement this paragraph is part of therefore stands**, between the
> text above and the header of `020_create_pocket_tables.sql:18-24`, which
> records the last pocket account as deleted by the owner on 2026-08-24 through
> the app's own deletion path. **Resolving it needs a reading of the production
> copy, which this measurement is not.**
>
> **Three databases, not one — which may be the whole of the disagreement.**
> Laid side by side, the three readings are not necessarily in conflict, because
> no two of them were taken on the same database:
>
> | reading | database | date | result |
> |---|---|---|---|
> | `020_create_pocket_tables.sql:18-24` | **production** | 2026-08-24 | four counts all zero; the owner deleted the last pocket account that day |
> | `POCKET_DECISIONS.md` §19.10 | **the local production copy**, `fintrack_prod_data` | 2026-08-29 | account `108` alive, `deleted_at` null, 90.00 in it |
> | this block | **the development database**, `fintrack_dev` | 2026-08-30 | zero accounts of the type; four rows in `pockets` |
>
> A copy taken before 2026-08-24 would show account `108` alive however many
> times it is re-read, and re-reading it on a later date does not make it a
> later measurement of production. **That is a hypothesis, not a finding** — it
> is not checkable from the repository, because the date the copy was taken is
> not recorded anywhere this document could read. **What would settle it:** the
> date `fintrack_prod_data` was dumped, against 2026-08-24.

| option | consequence |
|---|---|
| **hold unit 17 until the migration has run** — recommended | the account type survives on the frontend for the length of one unit, harmlessly: the tile links somewhere real once §9.2 lands, and the union tolerates a member nothing new creates |
| ship the union change with the board unit | the frontend stops naming a type the database still serves, and any legacy pocket account row renders untyped on the accounting dashboard |

The same gate covers the two backend changes the money units depend on: an
unavailable rate answering **`503`** instead of `500`, so a form can distinguish a
provider outage from a defect and offer a retry rather than reporting a bug; and
the creation validator learning the optional initial-commitment keys, which
unit 10b needs. Until the first lands, a `500` from any of the four money
endpoints is indistinguishable from a defect and the forms can only report it as
one.

### 9.2 The broken accounting dashboard route

`AccountingDashboard.tsx:64` sends every pocket row to `/fintrack/budget/pockets`,
**which `App.tsx` does not declare.** Clicking a pocket row on the dashboard lands
on the error element. It is broken today, for reasons independent of this work.

> **MARKED 2026-08-30 — the entry is deleted, so this decision has no subject
> left and needs a fresh one only if a pocket row can reappear.**
>
> **What the passage asserts:** that one line at `AccountingDashboard.tsx:64`
> still routes a pocket row to a path the router does not serve, and that the
> three options below are how to dispose of it.
>
> **What the code actually says:** neither the tile nor the route entry exists.
> A row of the retired type now falls through the route map's own default to the
> account detail, and its card label comes from the tile map's `other` entry
> (`AccountingDashboard.tsx:622-632`). The measurement that made the *repoint it
> at the pocket detail* option wrong also still holds: the dashboard composes its
> destination as `${baseRoute}/${account.account_id}`, an **account** id, so
> pointing it at a pocket-id route would restage the id-space defect.
>
> **What now needs deciding:** nothing, while the database holds no account of
> the retired type and no route creates one. It becomes live again only if the
> production question at §9.1 turns up such a row.

| option | consequence |
|---|---|
| **a defect commit of its own, now, repointing to `/fintrack/pocket/pockets`** — recommended | one line, testable immediately against the legacy detail screen that still exists, and it stops depending on a migration that has an unresolved question attached to it |
| fold it into the board unit | a feature commit carries an unrelated fix, and the fix waits on the merge of §0.2 |
| let it disappear with the tile in unit 17 | the row stays broken for the whole length of this plan |

### 9.3 The goal's typed currency is not served

Six FX columns on `pockets` record what the target was typed as and the rate that
produced it, and **no read query selects any of them.** So the detail hero can
show `$5,000` and cannot show `€5,000` beside it, while every pocket allocation
row in the history below it *can* — the same information, present on one object
and absent on the other, on the same screen.

| option | consequence |
|---|---|
| **record it as a backend requirement and ship the hero with the converted figure alone** — recommended | the detail is complete in every other respect and the pair is additive when it arrives; nothing built now has to be unbuilt |
| block the detail unit on it | one absent pair holds the module's operating centre |

The requirement, stated for the owning backend plan: `GET /pocket/:pocketId` adds
the goal's typed pair — the original amount, its currency, and the rate that
produced the stored figure — to `data.pocket`. On edit the pair is replaced, not
versioned: there is no history of target changes to version.

### 9.4 Where the source picker's three figures come from — this gates unit 12

> **CORRECTED 2026-08-30 — the recommended option was taken and the gate is
> open.** `getAllAccountsByType` attaches `allocated`, `unassignedCash` and
> `isOverAllocated` to every row when the requested type is `bank`, computed by
> the same `accountAllocationService` the commit path validates against, in one
> query for the whole list (`getAccountController.js:431-462`). A row the
> allocation read filtered out is **left unset rather than zeroed** (`:455-456`),
> which is a distinction the picker has to render and does:
> `PocketSourcePicker.tsx:24-35` types all three as nullable and prints a dash.
> The note below still holds — only `bank` is enriched, and the account domain
> was not reshaped.

The commitment form must show, **per eligible account**, the balance, the amount
allocated to pockets and the unassigned cash. `sources[]` on the detail carries
all three, but **only for accounts already funding this pocket** — which is
exactly the set the owner is not choosing from when committing from a new one.
`GET /account/:accountId` carries all three for **one** account. The account list
the picker would otherwise read, `url_get_accounts_by_type?type=bank`, carries
**the balance only**. There is no endpoint serving the list with its figures.

| option | consequence |
|---|---|
| **the accounts-by-type list gains `allocated` and `unassignedCash` for `bank` and `cash`** — recommended | one field pair on an endpoint that already runs the same query, computed by the same service the commit path validates against, so the business rule and the number on screen cannot drift |
| the picker lists accounts with the balance only and fetches the other two on selection | the owner chooses from a picker where two of the three required figures are blank, which is the opposite of what showing three figures side by side is for; and it costs one request per selection change |
| derive the figures on the client | forbidden — the client never computes a figure the server did not serve |

Note for whoever implements the recommendation: only `bank` is reachable in
practice. `cash` passes the eligibility rule conceptually, no route creates one,
and the account-detail controller's allowlist excludes the type. **The account
domain is not being reshaped to serve this module**; V1 ships with bank accounts.

### 9.5 The shape of the pocket allocation entry detail

> **CORRECTED 2026-08-30 — the recommended option was taken.** The FX-pathway
> block is extracted to `general_components/fxPathwayCard/FxPathwayCard.tsx` and
> the pocket entry modal is built on it
> (`pages/forms/pocketDetail/allocationEntryModal/AllocationEntryModal.tsx`).
> `AccountTransactionDetailModal` keeps its `transaction` prop and was not
> generalised.

The two source documents point in different directions. The frozen screen
decision says generalise `AccountTransactionDetailModal`'s prop from
`transaction` to `movement`, reasoning that adapting the row would mean
fabricating transaction fields a pocket allocation does not have. The frontend
inventory lists a new `PocketAllocationEntryModal` among the pieces that do not
exist.

| option | consequence |
|---|---|
| **extract the FX-pathway block into a shared presentational piece and build the pocket entry modal on it** — recommended | it satisfies the stated *reason* — nothing is fabricated — without a discriminated union branching through a 392-line component whose other caller is Account Detail, a screen this plan is already changing in unit 14 |
| generalise the existing modal's prop to `movement` | it satisfies the stated *remedy*, and puts a type branch on every transaction-only field the modal renders: movement type, category, counterparty |

Either way the content is identical and is listed at §7.3. The two most recent
commits on that modal make it the live pattern, so the extraction copies a
current implementation rather than reconstructing a precedent.

### 9.6 The field limits disagree with the contract

`NAME_MAX_LENGTHS.pocket_name` is **28** and the server accepts **50**;
`NAME_MAX_LENGTHS.note` is **90** and the server accepts **155**. Today's form
truncates on a client-side rule nobody wrote down.

> **CORRECTED 2026-08-30 — both figures are stale and the premise of the
> recommended option is false.** `nameMaxLengths.ts:20` reads `pocket_name: 50`
> and `:16` reads `note: 155`, each with a comment naming the server as the
> reason, so no counter stops the owner early any more. And the shared `note` key
> is **not** shared: its only consumers in the repository are the two pocket
> forms — `NewPocket.tsx:333`, `:347` and `EditPocket.tsx:431`, `:445` — so
> raising it in place moved no other form's counter and the separate `pocket_note`
> key recommended below would have protected nothing.

| option | consequence |
|---|---|
| **raise `pocket_name` to 50 and add a `pocket_note: 155` beside the shared `note`** — recommended | the counter states the limit the server actually enforces, and the shared `note` limit is untouched, so no other form's counter moves |
| raise the shared `note` to 155 | one pocket decision silently changes the counter on every form that shares the key |
| keep 28 and 90 | the owner is stopped at a length the server would accept, and no code states why |

---

## 10. Acceptance criteria, per unit

Checkable, in the working tree, without reading this document.

| # | criteria |
|---|---|
| 0 | clicking a pocket row on the accounting dashboard opens a detail screen, not the error element |
| 1 | `tsc` passes; a case-insensitive search for `saved`, `account_balance`, `account_id` or `account_name` in `pocketTypes.ts` returns nothing; `target` is not nullable; the summary declares ten fields |
| 2 | six exports resolve; `tsc` passes; no legacy pocket URL was touched |
| 3 | seven exported functions; four of them declare `PocketDetailPayload` as their return type; `updatePocket` sends the body unmodified; no `catch` swallows the `errors[]` envelope |
| 4 | the board store's guard makes a second `fetchBoard()` issue no request; `invalidate()` leaves `pockets` rendered; both bus subscriptions are registered at module scope; no store action recomputes a summary field |
| 5 | `Skeleton` and `EmptyState` render from tokens only; a search for a hex literal or a `px` literal in their stylesheets returns nothing |
| 6 | the four route slots resolve; `PocketLayout` issues no request; the 3-second error timer and the absolutely-positioned error paragraph are gone |
| 7 | an empty board renders the empty state and no hero; a board of one pocket renders the headline as `totalAllocated`; a `null` note renders no line, not the string `null`; a pocket with `sourceCount: 0` reads *no pocket allocations yet*; the five filters are exclusive; the three sorts issue no request; one create control exists; a search for `?? 0` in the board files returns nothing; the stylesheet declares breakpoints at 480, 768 and 1024 |
| 8 | a pocket with `requiredMonthly: null` renders *The desired date has passed* and no figure; one with `requiredMonthly: 0` renders *goal covered*; a pocket at 72% displays 72%; a source row with `accountName: null` renders *account removed* and still shows its held figure; the source rows are cards at 360px; no component named or classed as a transaction appears; the error state has a retry |
| 9 | a history row typed in the accounting currency shows no conversion pathway; one typed in another currency shows the typed amount, the rate at its full precision and the source; the timestamp renders as an instant, the allocation date as a calendar day |
| 10 | the payload sent carries exactly the five contract keys; `desiredDate` is a `YYYY-MM-DD` string in the network tab; a past date cannot be chosen; a `400` marks the named field; success navigates to the created pocket's detail and that detail issues **zero** requests |
| 10b | an over-ceiling initial commitment answers `422` and **no pocket is created** |
| 11 | an untouched form cannot be submitted; a field left alone is absent from the body; an emptied note sends `null`; a target sent without a currency is impossible to produce from the form; the response repaints the detail with no second request |
| 12 | the picker lists every eligible account including zero-unassigned-cash ones, disabled; three figures per account; the word *available* appears nowhere; the amount sent is unsigned; the `422` renders verbatim with both figures; the hero, the sources and the history all repaint from the one response |
| 13 | the confirmation names the pocket and what returns to each account; the result renders the response's own `freed[]`; dismissing lands on the board and the board refetches once |
| 14 | opening a bank account **from the accounting dashboard** shows the committed figure, the uncommitted cash and the pocket list; opening an investment account shows no such block and no zeroes; a bank account with nothing committed shows `0`, not a dash; a negative uncommitted figure renders with its over-allocation line and blocks nothing; the word *available* appears nowhere |
| 15 | the overview issues no request naming `pocket_saving` or `movement=pocket`; net worth equals bank + investment + debtor; no panel mentions a pocket |
| 16 | neither Transfer radio set offers a pocket; a search for `pocket` under `pages/tracker/` returns nothing; the movement schema enums no longer name it |
| 17 | a search for `pocket_saving` under `frontend/src/` returns nothing |
| all | a case-insensitive whole-word search for `saved` across the pocket pages, `pocketApi.ts`, `pocketTypes.ts` and the two stores returns nothing; boot test `APP LOADED OK` |

---

## 11. What this plan does not decide

- The pixel design of any screen. The information architecture above fixes what
  appears and in what hierarchy; the layout, the type scale and the token choices
  are the frontend designer's, under the rules of §7.6.
- Anything about the backend beyond the four requirements recorded at §9.1, §9.3
  and §9.4 for the plan that owns them.
- The migration itself, its rehearsal, and the question attached to the one real
  legacy pocket.
- Unifying the four modal implementations that exist, and adopting the two new
  fetch-state primitives on screens outside this module. Both are real debts and
  neither is this plan's.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

§1 (the contract of the eight endpoints), §2 (the response contract file), §4
(the two stores and the write rule), §6.1's absent-versus-zero argument, §7's
information architecture and §10's acceptance criteria were re-read against the
code and stand. What aged is every statement about what the tree contains.
Corrected in place; nothing struck, no unit reordered, no decision closed.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the branch boundary — nothing of `/api/fintrack/pocket` reachable | §0.2 | the whole module is on this branch; the binding clause was honoured by outcome, since all three worktree files were rewritten rather than adapted |
| "the file today declares no `/pocket` module URL of any kind", and six declarations | §3.2 | five declarations exist; edit and delete reuse the detail URL, and the legacy creation URL is deleted rather than left for unit 10 |
| the four route slots and the reduced layout | §5 | all four exist, anchors drifted; `PocketLayout` still fetches and still owns the hero |
| "nothing in the tree provides a skeleton, an empty state or a shared modal" | §7.5 | two local implementations exist; nothing shared, and no `PocketModalShell` |
| "`pocket-styles.css` declares zero `@media` queries" | §7.6 | 1141 lines with four breakpoints and three reduced-motion blocks; the legacy defects survive at drifted anchors, and there is no 1024 breakpoint |
| the state of the nineteen units | §8 | thirteen landed, measured row by row in the block under the table |
| the gate on retiring the account type | §9.1 | the sweep has run on both sides; what is still open is the satellite table and its three server readers |
| the broken accounting dashboard route | §9.2 | **marked, not struck.** The entry is deleted, so the decision has no subject unless a row of that type reappears |
| the source picker's gate | §9.4 | open, the recommended option taken |
| the shape of the entry modal | §9.5 | built by extraction, the recommended option |
| the two field limits and the shared `note` key | §9.6 | both raised in place; the key has two consumers, both pocket forms |

**Left standing because they are still true:** the deadline unchecked against
today on create and on edit (§1.3, §1.4); the pocket's six FX audit columns
written and never read (§1.2, §9.3); the four cross-module fields absent rather
than zero outside `bank` and `cash`, with `cash` unreachable behind the account
detail's own allowlist (§1.7); the Account Detail defect of §6.1 in full; and the
`503` an unavailable rate should answer instead of `500`.
