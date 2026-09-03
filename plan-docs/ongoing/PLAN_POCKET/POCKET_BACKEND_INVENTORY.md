# POCKET BACKEND — INVENTORY OF WHAT IS IMPLEMENTED

**Measured 2026-08-29, read-only, from source. No database was connected.**
Lives in `plan-docs/ongoing/`, which `.gitignore:123` re-includes: this file is versioned.

This is a factual record of the pocket module's HTTP surface as the code actually
spells it — request fields, validation, response field names, status codes — plus
the gap between that surface and the register of indicators the frozen
specification names (`POCKET_MODULE_SPEC.md` §6.2).

**Naming, binding on every line below.** The word *budget* never appears
unqualified: a monthly figure belonging to the other module is a **monthly budget
allocation**. The bare noun *allocation* never appears either: a row of
`pocket_allocations` is a **pocket allocation**. A pocket figure is `allocated`,
never `saved` — the money is not saved anywhere, it is committed while it sits in
a real account.

---

## 0. Where the code is, and what is on which branch

**The whole module lives on a worktree and none of it is on the main checkout.**
The path is
`.claude/worktrees/agent-a4aee04d12f126b4e`, branch
`worktree-agent-a4aee04d12f126b4e`, eight commits from `450e15f` to `bbd7d39`.

| commit | what it added |
|---|---|
| `450e15f` | the two tables — migration `020_create_pocket_tables.sql` and its runtime mirror in `createTables.js` |
| `a5daffe` | the board reads the pocket-allocation ledger instead of an account balance |
| `b11c701` | the detail of one pocket |
| `12745ae` | create and edit |
| `acdd9bf` | commit money and release it |
| `b33c8d2` | delete a pocket |
| `bf41c2c` | the account-detail enrichment |
| `bbd7d39` | `CHECK (exchange_rate > 0)` on both new tables |

**Correction to the assumption this inventory was commissioned under: the
account-detail half is NOT in the main checkout.** The main checkout's
`backend/src/fintrack_api/controllers/getAccountController.js` contains no
reference to `accountAllocationService`, `allocated` or `unassignedCash`;
`bf41c2c` exists only on the worktree. Nothing of the pocket module is reachable
from `main` or from `fix/auth-screen`.

> **CORRECTED 2026-08-30 — the module is on `fix/auth-screen` and the worktree
> paths below are wrong.** Every file this section lists now sits under
> `backend/src` in the main checkout; read every path in this document with the
> `.claude/worktrees/agent-a4aee04d12f126b4e/` prefix removed. The account-detail
> half landed too: `getAccountController.js:16` imports
> `accountAllocationService` and `:872-885` attaches the four fields, so the
> paragraph above is false in both of its claims.

**The files that make up the module**, all under
`.claude/worktrees/agent-a4aee04d12f126b4e/backend/src`:

| role | file |
|---|---|
| routes | `fintrack_api/routes/pocketRoutes.js` |
| request validation | `validation/zod/pocketValidators.js` |
| HTTP handlers | `fintrack_api/controllers/pocketController.js` |
| the board | `fintrack_api/services/pocket_services/services/pocketBoardService.js` |
| one pocket's detail | `fintrack_api/services/pocket_services/services/pocketDetailService.js` |
| create, edit, delete | `fintrack_api/services/pocket_services/services/pocketWriteService.js` |
| commit and release | `fintrack_api/services/pocket_services/services/pocketAllocationService.js` |
| the account's side | `fintrack_api/services/pocket_services/services/accountAllocationService.js` |
| pocket reads and writes | `fintrack_api/services/pocket_services/db/pocketRepository.js` |
| ledger reads and the row lock | `fintrack_api/services/pocket_services/db/accountAllocationRepository.js` |
| the rounding point of one pocket | `fintrack_api/services/pocket_services/core/makePocketStatus.js` |
| the rounding point of one account | `fintrack_api/services/pocket_services/core/makeAccountAllocation.js` |
| the rounding point of one ledger row | `fintrack_api/services/pocket_services/core/makeAllocationEntry.js` |

### 0.1 Mount, authentication and the shape of an error

The router is mounted at `/api/fintrack/pocket` — `routes/index.js:27-28` under
`app.js:159`, which wraps the whole `/api/fintrack` tree in `verifyToken`. The
per-router rate limiter is off while rate limiting is revised (`app.js:156`).

Identity comes from the token on every handler, through
`requireUserId(req, res)`; no route reads a user id from the client. A missing
identity claim writes `401 Unauthorized: missing user identity claim in token.`
and the handler returns.

Every successful answer is the same envelope, `pocketController.js`:

```
 { status, message, data }
```

A failure raised by a schema is `400` with a per-field list
(`pocketController.js:37-46`):

```
 { status: 400, message: 'Validation Error',
   errors: [ { field, message, code } ] }
```

A failure the domain decided carries its status on the `Error` and answers
`{ status, message }` (`pocketController.js:57-69`). Anything with no status goes
to the global handler at `app.js:175`, which answers
`{ message, status: 500, stack }` — a different key order and an extra key, which
is worth knowing before a client parses both shapes with one type.

**There is no `404` anywhere in this module, by decision.** A pocket id that does
not exist and one belonging to another user both answer `403` with the same
sentence, `Pocket not found or not owned by the authenticated user.` Splitting
them would let a caller walk the id space.

### 0.2 Units, scales and dates

- Amounts are rounded to **2 decimals**, half-up (`AMOUNT_SCALE = 2`,
 `money.js:23`), and serialized as JSON **numbers**, not strings.
- Percentages are rounded to **2 decimals** and expressed **0–100**, not 0–1
 (`toRate`, `RATE_SCALE = 2`, `money.js:27`; `makePocketStatus.js:120` multiplies
 by `HUNDRED`).
- The accounting currency is `ACCOUNTING_CURRENCY_CODE`, `usd` unless the
 environment overrides it (`fintrackConfig.js:6`). Currency codes are served
 **lowercase**.
- Every calendar date in a payload is a **`YYYY-MM-DD` string** resolved on the
 owner's IANA zone in SQL — `desiredDate` and `allocationDate`. The one
 exception is `exchangeRateTimestamp`, which crosses the driver as a JS `Date`
 and therefore reaches the client as a **full ISO instant**.
- The owner's zone is read once per request in the controller
 (`getUserTimeZone`, falling back to `'UTC'`) and passed down; no service
 resolves it on its own.

---

## 1. The board — `GET /api/fintrack/pocket/board`

Declared before `/:pocketId` so the literal `board` is not parsed as an id
(`pocketRoutes.js:27`).

**Request:** no path parameter, no query string, no body. Nothing is validated
because there is nothing to validate.

**Response `200`**, `message: 'Pocket board retrieved successfully'`, `data`
carrying three keys — `summary`, `pockets`, `meta`.

### 1.1 Every field of the summary

Built by the fold `makeSummary` at `pocketBoardService.js:98-161`.

| field | type | what it is |
|---|---|---|
| `totalAllocated` | number \| null | the sum of every pocket's committed figure, summed from the already-rounded row values |
| `totalTarget` | number \| null | the sum of every goal |
| `totalRemaining` | number \| null | each pocket's gap clamped at zero **first**, then summed — an over-funded pocket cannot cancel a short one |
| `totalExcess` | number \| null | the mirror: each pocket's overshoot clamped at zero, then summed |
| `overallProgress` | number \| null | coverage as a percentage — `SUM(MIN(allocated, target)) / SUM(target) × 100`, capped at 100 by construction |
| `currency` | string \| null | the one lowercase code every pocket is kept in; `null` when the set is not a singleton |
| `pocketCount` | number | how many pockets the caller owns |
| `fundedCount` | number | how many have `funded: true` |
| `overdueCount` | number | how many have `overdue: true` |
| `uncoveredCount` | number | how many have `uncovered: true` |

**The empty-board contract holds:** with no pockets, every amount and every
percentage is `null` and every count is `0` (`pocketBoardService.js:108-120`).
The endpoint answers `200`, never `400`. The same all-null shape is returned when
the pockets span more than one currency (`:125-127`) — an invariant guard that
should never fire, since the write path stores every target in the accounting
currency.

### 1.2 Every field of a row

Built by `makePocketStatus` (`makePocketStatus.js:84-132`), with one field added
by the board service.

| field | type | what it is |
|---|---|---|
| `pocketId` | number | the primary key |
| `name` | string | up to 50 characters |
| `note` | string \| null | up to 155 characters; absent is `null`, never `''` |
| `target` | number | the goal, in the accounting currency |
| `allocated` | number | `COALESCE(SUM(pa.amount), 0)` over the pocket's ledger rows — **no account balance is read anywhere in this module** |
| `remaining` | number | `target − allocated`, **raw and signed**: negative means over-funded, and that is the fact, not an error |
| `progress` | number | `allocated / target × 100`, raw, so it can exceed 100 |
| `desiredDate` | string | `YYYY-MM-DD` |
| `daysRemaining` | number | whole calendar days from the owner's today to the deadline; negative once it has passed |
| `requiredMonthly` | number \| null | `0` once the goal is covered; **`null`** once the date has passed; otherwise `remaining ÷ (daysRemaining ÷ 30.44)` |
| `funded` | boolean | `allocated ≥ target` |
| `overdue` | boolean | `daysRemaining < 0 AND allocated < target` |
| `sourceCount` | number | `COUNT(DISTINCT pa.source_account_id)` — zero on a pocket nothing has been committed to |
| `currency` | string | lowercase code |
| `uncovered` | boolean | added at `pocketBoardService.js:184`: at least one account this pocket draws on no longer covers everything committed to it |

Rows are ordered by deadline then name (`pocketRepository.js:79`). The other two
sorts the screen offers read fields already on the row, so no sort costs a query
parameter.

### 1.3 `meta`

`{ notices: [] }`, or one string —
`'Totals add amounts in more than one currency and are not converted.'` — raised
only when there is something to fold and it could not be folded
(`pocketBoardService.js:192-195`).

### 1.4 Status codes

| code | when |
|---|---|
| `200` | always, including an empty board |
| `401` | no identity claim in the token |
| `500` | any unexpected failure — see the defect at §5.2 |

---

## 2. The detail of one pocket — `GET /api/fintrack/pocket/:pocketId`

**Request:** the path parameter only, parsed by `pocketParamsSchema`
(`pocketValidators.js:50-56`): `z.coerce.number().int().positive()`, `.strict()`.
A non-numeric, fractional, zero or negative id is a `400`.

**Response `200`**, `message: 'Pocket retrieved successfully'`, `data` carrying
four keys — `pocket`, `sources`, `history`, `meta`. One request serves the whole
screen; there is no separate history endpoint.

### 2.1 The hero figures — `data.pocket`

Every field of a board row **except `sourceCount`**, which is deleted at
`pocketDetailService.js:123` because the source table below answers the same
question in full. So: `pocketId`, `name`, `note`, `target`, `allocated`,
`remaining`, `progress`, `desiredDate`, `daysRemaining`, `requiredMonthly`,
`funded`, `overdue`, `currency`, plus `uncovered`.

Here `uncovered` is derived differently from the board's: it is
`sources.some((source) => source.covered === false)`
(`pocketDetailService.js:117`), where the board folds over the account rows
(`pocketBoardService.js:54-67`). The two agree on the data the write path can
produce; they diverge on a source account that has been soft-deleted, where both
report `false` — see §5.4.

### 2.2 The per-source-account breakdown — `data.sources`

One entry per (pocket, source account) pair whose running net is not zero
(`accountAllocationRepository.js:89` — `HAVING SUM(pa.amount) <> 0`), built by
`buildSources` (`pocketDetailService.js:45-83`), sorted by held amount
descending.

| field | type | what it is |
|---|---|---|
| `accountId` | number | the source account |
| `accountName` | string \| null | `null` when the account is soft-deleted or is the internal `slack` account |
| `accountType` | string \| null | the catalog name, `null` in the same case |
| `heldByThisPocket` | number | the net **this** pocket holds **from that one account** |
| `accountAllocated` | number \| null | that account's committed total across **all** pockets |
| `accountBalance` | number \| null | that account's real money |
| `accountUnassignedCash` | number \| null | `accountBalance − accountAllocated`, may be negative |
| `covered` | boolean \| null | `false` when the account no longer covers everything committed to it; `null` when the account figures are unavailable |

The three questions the spec insisted on keeping apart are kept apart:
`heldByThisPocket` is this goal's share, `accountAllocated` is every goal's, and
`accountBalance` is the real money.

### 2.3 The pocket-allocation history — `data.history`

Every row of the ledger for this pocket, newest decision first, ordered on
`allocation_actual_date` then `allocation_id` descending
(`pocketRepository.js:163`), shaped by `makeAllocationEntry`
(`makeAllocationEntry.js:81-109`). There is no transaction list, because no
pocket allocation ever moved money.

| field | type | what it is |
|---|---|---|
| `allocationId` | number | `BIGSERIAL` narrowed to a JS number at `makeAllocationEntry.js:97` |
| `amount` | number | **signed** — positive committed, negative released |
| `allocationDate` | string | `YYYY-MM-DD`, from `allocation_actual_date AT TIME ZONE` the owner's zone; **never `created_at`** |
| `sourceAccountId` | number | the account the decision was taken against |
| `sourceAccountName` | string | joined from `user_accounts`, with no soft-delete filter, so a deleted account still names itself here |

### 2.4 The FX fields on each history row

Served **with the row**, not fetched when a modal opens.

| field | type | what it is |
|---|---|---|
| `originalAmount` | number | what the owner typed, **signed the same way as `amount`** (`pocketAllocationService.js:244`) |
| `originalCurrency` | string | lowercase code of the unit it was typed in |
| `exchangeRate` | number | the effective rate that produced the stored figure, at the column's ten decimals — **not** passed through `toAmount`, so it keeps its precision (`makeAllocationEntry.js:106`) |
| `exchangeRateSource` | string | the provider, or the literal `identity` when no conversion was needed |
| `exchangeRateTimestamp` | ISO instant | when the rate was fetched — the one date in the module that is not a `YYYY-MM-DD` label |

**The pocket's own six FX columns are stored but never served.** `pockets`
carries `original_target`, `original_currency_id`, `exchange_rate`,
`exchange_rate_source`, `exchange_rate_timestamp` and
`exchange_rate_target_currency_id`, written by `insertPocket`
(`pocketRepository.js:187-190`), and no read query selects any of them. A screen
cannot show *what the target was typed as* — see the gap at §4.2.

### 2.5 `meta`

Always `{ notices: [] }` on the detail — the key exists for shape parity with the
board and is never populated (`pocketDetailService.js:129`).

### 2.6 Status codes

| code | when |
|---|---|
| `200` | the pocket exists and is the caller's |
| `400` | `pocketId` is not a positive integer |
| `401` | no identity claim |
| `403` | the pocket does not exist, **or** belongs to someone else |

---

## 3. Creating a pocket — `POST /api/fintrack/pocket`

### 3.1 The body and its validation

`createPocketBodySchema`, `pocketValidators.js:67-81`, **`.strict()`** — an
unknown key is a `400` naming it, so a client still sending the retired `amount`
key is told so rather than silently ignored.

| field | required | rule |
|---|---|---|
| `name` | yes | trimmed string, 1 to 50 characters |
| `note` | no | trimmed string, at most 155 characters. **Optional but not nullable** on create |
| `targetAmount` | yes | `z.number().positive()` — *"amount must be greater than zero"* |
| `currency` | yes | trimmed, lower-cased, must be one of `usd`, `eur`, `cop`, `ves`, `mxn` (`SUPPORTED_CURRENCIES`, `fxConfig.js:37`). **No default, deliberately** |
| `desiredDate` | yes | `/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/` — a calendar label, never parsed into a `Date` |

`currency` names the unit the target was **typed** in. It is not the unit the
pocket is kept in: the stored `currency_id` is always the accounting currency
(`pocketWriteService.js:143`).

A second validation layer runs after the conversion, in `normalizeAmount`
(`pocketWriteService.js:55-76`), and also answers `400`: the converted figure
must be finite, within `DECIMAL(15,2)`, and at least `0.01` after rounding.

**No source account and no money.** A pocket is created empty and the screen
offers to commit money next.

**The deadline is not checked against today.** A `desiredDate` in the past is
accepted; the pocket is born with a negative `daysRemaining`, `overdue: true`
and `requiredMonthly: null`.

### 3.2 The response

`201`, `message: 'Pocket created successfully'`, and **`data` is the entire
detail payload of §2**, not an id — the controller re-reads the pocket it just
wrote (`pocketController.js:133-145`) so the screen that follows a creation needs
no second request.

### 3.3 Status codes

| code | when |
|---|---|
| `201` | written |
| `400` | a schema issue, or the converted figure fails `normalizeAmount` |
| `401` | no identity claim |
| `500` | the FX state has no rate for the typed currency — see §5.1 |

---

## 4. Editing a pocket — `PATCH /api/fintrack/pocket/:pocketId`

### 4.1 What it accepts

`updatePocketBodySchema`, `pocketValidators.js:94-121`, **`.strict()`** with two
refinements.

| field | rule |
|---|---|
| `name` | optional, trimmed, 1 to 50 characters |
| `note` | optional **and nullable** — `null` clears the note, an absent key leaves it alone. The two are kept distinct through a `noteWasSent` flag (`pocketWriteService.js:191`) driving a `CASE WHEN` rather than a `COALESCE` (`pocketRepository.js:241`) |
| `targetAmount` | optional, positive number |
| `currency` | optional, one of the five supported codes |
| `desiredDate` | optional, `YYYY-MM-DD` |

Two refinements: **at least one field must be sent** — an empty body is a `400`,
never a `200` that wrote nothing — and **`currency` is required whenever
`targetAmount` is sent**, reported on the `currency` path.

### 4.2 What it refuses

- **Any key outside those five.** `.strict()` turns it into a `400`.
- **The pocket's own currency.** There is no field for it and no code path that
 writes `pockets.currency_id` after the insert: restating the unit would restate
 every past pocket allocation.
- **A new target with no currency beside it.** The second refinement.
- **An empty body.**
- **Committed money.** Editing writes only the plan — `name`, `note`,
 `target_amount`, `desired_date` and, when the target moves, the five FX
 columns that prove the conversion. The ledger is untouched.

The five FX columns move **with the target or not at all**
(`pocketRepository.js:259-265` gates each on `hasTarget`), so a rate left behind
by a previous target can never claim to have produced the new one.

**There is no revision history and no `valid_from`.** A target changed from 5,000
to 7,000 replaces the figure; `updated_at` is stamped and nothing else is kept.

**A weaker rule than the code comments claim:** `currency` sent **without**
`targetAmount` parses and is then silently discarded — `editPocket` reads
`body.currency` only inside `if (body.targetAmount !== undefined)`
(`pocketWriteService.js:198-204`). The route comment at `pocketRoutes.js:37-40`
and the schema docblock both say currency is "accepted only beside
targetAmount", and the schema does not enforce that direction.

**The deadline is not validated on edit either** — a past `desiredDate` is
accepted, exactly as on creation.

### 4.3 The response

`200`, `message: 'Pocket updated successfully'`, `data` again the whole detail
payload, recomputed after the write (`pocketController.js:165-177`) — a new
target moves the gap and the monthly pace it implies, and that pace is derived
here, never on the client.

### 4.4 Status codes

| code | when |
|---|---|
| `200` | written |
| `400` | schema issue, empty body, missing currency beside a target, or `normalizeAmount` |
| `401` | no identity claim |
| `403` | the pocket does not exist or is not the caller's — checked twice, once by the read and once by the `WHERE user_id` of the `UPDATE` |
| `500` | no FX rate for the typed currency |

---

## 5. Committing money and releasing it

Two endpoints, one handler (`writeAllocation`, `pocketController.js:195-224`) and
one service function (`writeLedgerRow`,
`pocketAllocationService.js:167-270`), because they are the same decision with
opposite effect.

- `POST /api/fintrack/pocket/:pocketId/allocations`
- `POST /api/fintrack/pocket/:pocketId/releases`

### 5.1 The payload — one schema for both

`allocationBodySchema`, `pocketValidators.js:133-142`, **`.strict()`**.

| field | required | rule |
|---|---|---|
| `sourceAccountId` | yes | coerced positive integer |
| `amount` | yes | **positive**, always. The client never sends a sign; the server writes it (`pocketAllocationService.js:237`) |
| `currency` | yes | one of the five supported codes — the unit the figure was typed in |
| `allocationDate` | no | `YYYY-MM-DD`; defaults to `CURRENT_TIMESTAMP` in SQL (`accountAllocationRepository.js:271`). It records **when the decision was taken**, so a set-aside agreed on Friday and typed on Monday can be dated Friday |

### 5.2 The checks, in the order they run

All inside one transaction with the source account locked `FOR UPDATE`
(`lockOwnedSourceAccount`, `accountAllocationRepository.js:190-215`), so the
ceiling cannot be read by two requests that then both pass.

1. **The pocket is the caller's** — otherwise `403`,
 *"Pocket not found or not owned by the authenticated user."*
2. **The account is the caller's** — otherwise `403`,
 *"Account not found or not owned by the authenticated user."*
3. **The account may back a pocket at all** (`assertEligibleSource`,
 `:97-113`), three `422`s:
 - soft-deleted — *"Account "X" has been deleted and cannot back a pocket."*
 - the internal account — *"The internal account cannot back a pocket."*
 - the wrong type — *"Account "X" is of type T; only bank and cash accounts can
   back a pocket."* `ELIGIBLE_SOURCE_TYPES = ['bank', 'cash']`, so investment,
   debtor, category-budget and income-source accounts are all refused.
4. **The account is kept in the accounting currency** (`convertTypedAmount`,
 `:125-132`) — otherwise `422`, *"Account "X" is kept in C; a pocket allocation
 is measured in usd and the two cannot be compared."*
5. **The conversion runs on the server** through `currencyAmountConversion`, the
 same converter every other write path uses. Then `normalizeAmount` — `400`
 when the figure is not finite, exceeds `DECIMAL(15,2)`, or rounds below `0.01`.
6. **The ceiling**, one per direction — below.

### 5.3 The two ceilings and the error each one produces

| direction | ceiling | where it is computed | the `422` |
|---|---|---|---|
| commit | the source account's **unassigned cash**, `accountBalance − accountAllocated`, read inside the lock (`pocketAllocationService.js:204-206`) | `accountAllocationRepository.js:200-204` | *"Cannot commit `<amount>` to this pocket: "`<accountName>`" has `<unassignedCash>` of unassigned cash."* — both figures named |
| release | the **net this pocket holds from that one account**, `getHeldByPocketFromAccount` (`accountAllocationRepository.js:230-248`) | the same lock | *"Cannot release `<amount>` from "`<accountName>`": this pocket holds `<held>` from it."* — both figures named |

Neither ceiling is a database `CHECK`, deliberately: a `CHECK` would also block
the insert of a real expense, and over-allocation is a state the app displays,
never an error the database refuses.

**No balance is written and no transaction is recorded.** Nothing in this path
touches `user_accounts.account_balance` or `transactions`.

### 5.4 The response

`201`, `message` either `'Funds allocated successfully'` or
`'Funds released successfully'`, and `data` **the whole detail payload of §2**.

The service's own return value —
`{ allocationId, pocketId, sourceAccountId, sourceAccountName, amount }`
(`pocketAllocationService.js:257-263`) — is **discarded by the controller** and
never reaches a client. One decision changes the hero, the source breakdown and
the history at once, so the row alone would leave a client deriving the other
two.

### 5.5 Status codes

| code | when |
|---|---|
| `201` | written |
| `400` | schema issue, or `normalizeAmount` on the converted or the typed figure |
| `401` | no identity claim |
| `403` | the pocket or the account is not the caller's |
| `422` | deleted account, internal account, ineligible type, non-accounting account currency, or either ceiling exceeded |
| `500` | no FX rate for the typed currency |

---

## 6. Deleting a pocket that has money committed — `DELETE /api/fintrack/pocket/:pocketId`

**Never refused for a non-zero net** (`pocketWriteService.js:248-285`). A pocket
allocation never moved money, so destroying the ledger destroys no financial
fact: the cash stops being committed and returns to each source account's
unassigned cash. No balance is written, no transaction is recorded, and there is
no impact report to run first — which is exactly what separates this from
deleting an account.

The figures are read **before** the delete and **inside the same transaction**
(`getFreedCashByAccount`, `accountAllocationRepository.js:146-165`); afterwards
the ledger is gone by `ON DELETE CASCADE` and there is nothing left to report.

**There is no close and no archive.** The schema carries no status column for an
inactive pocket to live in.

### 6.1 What the response names

`200`, `message: 'Pocket deleted successfully'`, and `data`:

| field | type | what it is |
|---|---|---|
| `pocketId` | number | the id just deleted, echoed from the path |
| `name` | string | the pocket's name, read before the delete, so the confirmation and the result state the same thing |
| `freed` | array | one entry per source account whose net was not zero, ordered by account name |
| `freed[].accountId` | number | the account |
| `freed[].accountName` | string | the account by name, because the answer is read by a human |
| `freed[].freedCash` | number | the amount that returns to that account's unassigned cash |

An account whose net had already fallen to zero is absent from `freed`
(`HAVING SUM(pa.amount) <> 0`).

### 6.2 Status codes

| code | when |
|---|---|
| `200` | deleted |
| `400` | `pocketId` is not a positive integer |
| `401` | no identity claim |
| `403` | the pocket does not exist or is not the caller's |

---

## 7. What the account detail now serves about pockets

The endpoint is `GET /api/fintrack/account/:accountId`, handler `getAccountById`
in `fintrack_api/controllers/getAccountController.js`, enriched at
`:774-802`. The pocket module supplies the figures through
`accountAllocationService.getAccountAllocation`, and that service is **the only
place** the three figures are computed — the same function the commit path
validates against, so the business rule and the number on screen cannot drift.

> **CORRECTED 2026-08-30 — the anchor has drifted and there is now a second
> endpoint serving these figures.** The enrichment sits at
> `getAccountController.js:857-885`, with the attachment at `:880-885`.
> **`getAllAccountsByType` serves them too**, for the list rather than for one
> account: `:431-462` attaches `allocated`, `unassignedCash` and
> `isOverAllocated` to every row when the requested type is `bank`, through
> `accountAllocationService.getAllocationsByAccountId`, in one query for the
> whole list. It does **not** attach `pockets`, and a row the allocation read
> filtered out is left unset rather than zeroed (`:455-456`). So the statement
> that the account detail is the only place these figures reach a client is no
> longer true, though the statement that one service computes them still is.

### 7.1 The four fields

They are attached to `data.accountList[0]`, beside the existing columns, and
`account_balance` is left exactly as it was — real money, tied to the statement.

| field | type | what it is |
|---|---|---|
| `allocated` | number | how much of this account is committed to pockets, `SUM(pocket_allocations.amount)` for that account |
| `unassignedCash` | number | `account_balance − allocated`. **Never "available balance"**: a pocket blocks no spend, and calling the remainder available would tell the owner they cannot spend money they can. It may be negative |
| `isOverAllocated` | boolean | `unassignedCash < 0` — a state the screen reports and does not correct |
| `pockets` | array | the per-goal breakdown: `{ pocketId, name, heldFromThisAccount }`, ordered by pocket name, omitting any goal whose net from this account has fallen to zero |

The shortfall is stated on the account and **never split across the pockets
listed beneath it** — any split needs a policy the app would have to invent.

### 7.2 On which account types the fields are present, and on which they are absent

`getAccountAllocation` returns `null` — and the four keys are then **absent from
the payload entirely, not zero** — for every account type outside
`ACCOUNTS_WITH_UNASSIGNED_CASH = ['bank', 'cash']`
(`accountAllocationService.js:23, 322-325`).

| account type | the four fields |
|---|---|
| `bank` | **present** |
| `cash` | present in the service — but unreachable, see below |
| `investment` | absent — the balance is a market valuation, not spendable money |
| `income_source` | absent |
| `debtor` | absent |
| `category_budget` | absent |
| `pocket_saving` (legacy) | absent |

They are also absent when the account read returns nothing — a soft-deleted
account or the internal `slack` account (`accountAllocationService.js:335-337`).

**Only `bank` is actually reachable today.** `getAccountById` refuses any account
whose type is outside
`['pocket_saving', 'category_budget', 'bank', 'investment', 'income_source', 'debtor']`
with a `404` at `getAccountController.js:572-583` — **`cash` is not in that
list**, so a cash account never reaches the enrichment 200 lines below. And no
route creates one: the catalog row exists (`005_base_catalogs.sql:43`,
`(7, 'cash')`) but `cash` appears nowhere else in `fintrack_api/` except the two
pocket constants. This is recorded as a defect at §5 of the closing list.

> **Re-measured 2026-08-30: the finding stands, the anchor moved.** The allowlist
> is at `getAccountController.js:631-641` and still excludes `cash`. The
> accounts-by-type enrichment added since is `bank` only by an explicit branch
> (`:431`), so nothing else made `cash` reachable either.

---

## 8. The gap table — every indicator of the specification's register

The register is `POCKET_MODULE_SPEC.md` §6.2. Every row of it appears below, in
its order, with the endpoint and the **exact field name as the code spells it**.

### 8.1 One pocket-allocation row, and one (pocket, account) pair

| indicator, in words | computed today | endpoint and exact field |
|---|---|---|
| whether a conversion happened on one pocket-allocation row, so the modal can show the pathway | **partly** — the boolean itself is not served, but everything it is derived from is | `GET /:pocketId` → `history[].originalCurrency` compared against `pocket.currency`; the five FX fields ride the same row |
| how much of one account one pocket holds, the figure a release is measured against | **yes** | `GET /:pocketId` → `sources[].heldByThisPocket` |

### 8.2 One pocket

| indicator, in words | computed today | endpoint and exact field |
|---|---|---|
| how much is committed to this goal | **yes** | `GET /board` → `pockets[].allocated`; `GET /:pocketId` → `pocket.allocated` |
| the gap still to commit, signed and unclamped | **yes** | `pockets[].remaining` / `pocket.remaining` |
| how far the goal has got, as a percentage that may exceed 100 | **yes** | `pockets[].progress` / `pocket.progress` |
| whether the goal is covered | **yes** | `pockets[].funded` / `pocket.funded` |
| whether the date has passed with the goal uncovered | **yes** | `pockets[].overdue` / `pocket.overdue` |
| how many calendar days are left to the date | **yes** | `pockets[].daysRemaining` / `pocket.daysRemaining` |
| how much must still be committed per month to reach the goal on time | **yes** | `pockets[].requiredMonthly` / `pocket.requiredMonthly` — `0` once covered, **`null`** once the date has passed |
| whether one of the accounts funding this goal no longer covers what is committed to it | **yes**, by two different derivations | `pockets[].uncovered` (folded over the account rows) / `pocket.uncovered` (folded over `sources[].covered`) |
| how many accounts fund this goal | **yes, board only** | `GET /board` → `pockets[].sourceCount`. Deliberately deleted from the detail payload, where the source table answers it |

### 8.3 One account

| indicator, in words | computed today | endpoint and exact field |
|---|---|---|
| how much of this account is committed to pockets | **yes**, three places, one formula | `GET /account/:accountId` → `allocated`; `GET /pocket/:pocketId` → `sources[].accountAllocated`; and inside the row lock of the commit path |
| how much of this account is not yet committed, the ceiling the commit form validates against | **yes** | `GET /account/:accountId` → `unassignedCash`; `GET /pocket/:pocketId` → `sources[].accountUnassignedCash` |

> **Re-measured 2026-08-30 — a fourth surface serves the account-level figures.**
> `GET /account/type/?type=bank` now carries `allocated`, `unassignedCash` and
> `isOverAllocated` on every row (`getAccountController.js:431-462`), which is
> what the source picker reads. `pockets` — the per-goal breakdown — is served on
> the single-account read only.
| whether the account no longer covers what is committed to it | **yes** | `GET /account/:accountId` → `isOverAllocated`; `GET /pocket/:pocketId` → `sources[].covered`, which is its negation |

### 8.4 The board

| indicator, in words | computed today | endpoint and exact field |
|---|---|---|
| the sum of everything committed, across goals | **yes** | `GET /board` → `summary.totalAllocated` |
| the sum of every goal | **yes** | `summary.totalTarget` |
| what is still to commit, each goal clamped before the sum | **yes** | `summary.totalRemaining` |
| what is committed above goal, each goal clamped before the sum | **yes** | `summary.totalExcess` |
| coverage across goals, which one over-funded goal cannot inflate | **yes** | `summary.overallProgress` |
| how many goals there are | **yes** | `summary.pocketCount` |
| how many are covered | **yes** | `summary.fundedCount` |
| how many are past their date and uncovered | **yes** | `summary.overdueCount` |
| how many have a source account that is short | **yes** | `summary.uncoveredCount` |

### 8.5 Decided out — not missing

| indicator, in words | state |
|---|---|
| the rate at which money has been committed over time | **decided out.** It needs a past, and a rate read over the pocket-allocation ledger measures how often the owner changed their mind, not how fast money arrived. The reason is written into the code itself at `pocketBoardService.js:18-21`, so the decision is recorded where the next reader will meet it |
| the date the goal would be reached at the current pace | **decided out.** It predicts a future by assuming a pace nothing measured |

### 8.6 The one level that is empty by decision

The application-wide level carries no pocket figure in V1: no pocket figure
enters the overview or the accounting dashboard. Nothing in the pocket module
exports one, and the two dashboard endpoints the board used to call are simply no
longer called.

**Every indicator the register names is implemented.** The gap between the
specification and the built backend is empty in this direction; the gaps that
exist run the other way — §9 — and in the surrounding code — §10.

---

## 9. Served, but the specification does not name it

A field the frontend could use that nobody has written down.

| served | where | why it matters |
|---|---|---|
| the pocket's own note, on every board row and on the detail | `pockets[].note`, `pocket.note`, up to 155 characters, `null` when absent | the spec's §7.1 card list mentions a note in passing but the register (§6.2) and the payload sketch of §8.1 both carry it without a level or a rule; nothing states whether an empty note renders as a blank line or is omitted |
| the name of the account each ledger row was taken against | `history[].sourceAccountName` | the payload sketch of §8.2 lists it, the register does not. It is joined **without a soft-delete filter**, so history keeps naming an account the source table has already stopped naming |
| the type of each source account | `sources[].accountType` | in the payload sketch, absent from the register. It is the raw catalog name (`bank`, `cash`), not a label |
| the deleted-account source row, served with four nulls | `sources[]` with `accountName`, `accountType`, `accountAllocated`, `accountBalance`, `accountUnassignedCash` and `covered` all `null` | `pocketDetailService.js:58-68` invents this shape; the spec's §7.2 table has no null case at all, so no screen behaviour is specified for it. The held figure is still real and the pocket still counts it |
| a `meta.notices` array on the detail that is always empty | `GET /:pocketId` → `meta.notices` | shape parity with the board; a client typing both payloads from the spec would not know the key exists on the detail |
| the mixed-currency notice string itself | `GET /board` → `meta.notices[0]` | the spec names the guard but not the sentence: *"Totals add amounts in more than one currency and are not converted."* |
| the deleted pocket's name in the delete answer | `DELETE /:pocketId` → `data.name` | §8.5 says the answer "returns what was freed, per account"; the name is served beside it and is what a result banner would print |
| the whole detail payload as the answer to **four** write endpoints | create, edit, commit, release all return the §2 shape | §8 documents only the request bodies. A client that expected the written row from a `POST` gets the whole screen instead — this is the module's most consequential undocumented contract |
| the effective rate, at ten decimals, on every history row | `history[].exchangeRate` | the spec names the field; it does not say that it is the **effective** rate the converter computed (including the inverted one for a non-accounting origin currency), nor that it escapes the two-decimal rounding every other number goes through |

---

## 10. Defects and divergences found — recorded, not fixed

Nothing below was changed. Ordered by how much a frontend would care.

### 10.1 A missing FX rate answers `500`, not a usable error

`currencyAmountConversion` throws a bare `Error` when the rate cache has no entry
for the typed currency (`currencyAmountConversion.js:56`). It carries no
`status`, so `respondWithServiceError` falls through to `next(error)` and the
global handler answers `500` with the raw sentence *"Rate for cop not available
in FX state."* Every one of the four money-taking pocket endpoints inherits this.
A form cannot distinguish a temporary provider outage from a defect.

### 10.2 The board's handler does not use the module's error mapper

`getPocketBoard` catches with `next(error)` (`pocketController.js:90`), where
every other handler uses `respondWithServiceError`. The global handler does read
`err.status`, so the code would still be right — but the body would be
`{ message, status, stack }` instead of `{ status, message }`, and a `ZodError`
raised anywhere below would not be turned into the per-field list. The board
raises none today, so this is latent rather than live.

### 10.3 The pocket's own FX audit trail is written and never read

Six columns on `pockets` record what the target was typed as and the rate that
produced it. `insertPocket` writes them and `updatePocket` maintains five of
them; **no read query selects any of them.** The detail modal pattern the spec
points at exists for a pocket-allocation row and has no equivalent for the goal
itself, so a target typed in a non-accounting currency can never be shown as
typed.

`exchange_rate_target_currency_id` is written on insert and **not** updated on
edit (`pocketRepository.js:244-248` omits it). Harmless while the accounting
currency is fixed; wrong the day it is not.

### 10.4 A soft-deleted source account strands the money committed from it

`assertEligibleSource` refuses a deleted account on **both** directions
(`pocketAllocationService.js:98-102`), release included. So once an account
backing a pocket is soft-deleted, the amount committed from it can never be
released; the only way to free it is to delete the whole pocket. Meanwhile the
source row is served with nulls and `covered: null`, and both `uncovered`
derivations read `false` for it — the screen says the goal is covered when the
account behind it no longer exists.

### 10.5 The account-deletion path knows nothing about pockets

Neither `deleteAccountService.js` nor `getAnnulmentImpactReport.js` mentions
`pocket_allocations`. The hard-delete branch
(`deleteAccountService.js:300, 358`) will be refused by the `ON DELETE RESTRICT`
foreign key on `pocket_allocations.source_account_id` and surface as a raw
Postgres foreign-key error, not a message naming the goals that block it. The
soft-delete branch (`:369`) succeeds and produces §10.4.

### 10.6 `cash` accounts are eligible in the pocket module and unreachable everywhere else

The module names `cash` twice as a valid source and as an account that has
unassigned cash. The catalog has the row. **No route creates a cash account, and
`getAccountById` answers `404` for one** because `cash` is absent from the
allowlist at `getAccountController.js:572-580`. So the eligibility list is
aspirational: in practice only `bank` accounts can back a pocket and only `bank`
accounts can display the three lines.

### 10.7 The legacy pocket-account paths are still live on this branch

`POCKET_DECISIONS.md` §15.6 decided a pocket comes out of the account editor and that
the legacy path is retired rather than repaired. On this branch it is not
retired:

- `POST /api/fintrack/account/new_account/pocket_saving` still creates a pocket
 as an account (`accountRoutes.js:58` → `accountCreationController.js:933`).
- The `pocket_saving` branch of `accountEditController.js:90` still writes
 `target` and `desired_date` into `pocket_saving_accounts`, and that controller
 contains **zero** references to `exchange_rate` or `currencyAmountConversion` —
 the live corruption §15.5 named.
- `getAccountById` still serves the legacy `pocket_saving` shape
 (`getAccountController.js:638-648`).

So two models of a pocket coexist on the branch, and migration `020` deletes the
accounts the first one depends on.

> **CORRECTED 2026-08-30 — the write path is gone; the two read paths and the
> edit branch remain.**
>
> - **The creation route no longer exists.** `accountRoutes.js:57-62` is the
>   comment in its place and `accountCreationController.js:977-985` the comment
>   where the handler was, so nothing can bring a row of the retired type into
>   existence any more. Migration `020` has also run against the development
>   database, which holds zero such rows.
> - **The account editor's branch is still live**, at
>   `accountEditController.js:90-101`, with its write map at `:311` and the
>   deadline-provenance update at `:344-349`; the controller still contains no
>   reference to `exchange_rate` or `currencyAmountConversion`. It is now
>   unreachable from any client — no file under `frontend/src` names
>   `pocket_saving` — but the route is mounted.
> - **Both reads still serve the legacy shape**, at
>   `getAccountController.js:270-370` (accounts by type) and `:631-641` with
>   `:696-703` (the detail), both joining `pocket_saving_accounts`.
>
> So it is one model plus three read-and-edit branches over an empty table, not
> two coexisting models.

### 10.8 The deadline is validated on neither create nor edit

Nothing compares `desiredDate` against the owner's today. A pocket can be created
already overdue.

### 10.9 Two smaller items

- **The ledger reads do not filter by owner on the join.**
 `getAccountAllocations` (`accountAllocationRepository.js:46`) and the subquery
 of `lockOwnedSourceAccount` (`:200-204`) sum `pocket_allocations` by
 `source_account_id` with no `pa.user_id` condition. The account is already
 scoped to the caller and the write path cannot produce a cross-owner row, so
 this is not exploitable today — it is a missing belt beside a working brace.
 > **Re-measured 2026-08-30: the finding stands, both anchors moved.**
 > `getAccountAllocations` is at `accountAllocationRepository.js:44`, its
 > `LEFT JOIN pocket_allocations` at `:59` still carrying no `pa.user_id`; the
 > subquery inside `lockOwnedSourceAccount` (`:202`) is at `:212-215`, likewise.
 > The three reads that **do** scope the ledger by owner — `:98`, `:133`,
 > `:167`, `:274` — are the ones keyed on `pa.user_id` in their own `WHERE`.
- **The minimum-amount message names the wrong currency for the typed figure.**
 `normalizeAmount` is applied to the origin amount as well as the converted one
 (`pocketWriteService.js:102`, `pocketAllocationService.js:145`) and its message
 always reads *"must be at least 0.01 in the accounting currency"*, which is
 false when the figure that failed was typed in another one.

---

## 11. What this inventory did not measure

- **No database was connected.** Every statement above is read from source.
- The migration rehearsal of `POCKET_DECISIONS.md` §17 is not re-run or re-checked
 here.
- The frontend is untouched and unexamined; designing it is the next step and it
 is not this document's.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

The HTTP surface this document records — every request field, validation rule,
response field name and status code of the seven pocket endpoints — was re-read
against the source and is unchanged. So is the gap table of §8: every indicator
the specification's register names is still implemented, and the two that were
decided out are still absent. Corrected in place; nothing struck.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the module living only on a worktree, and the account-detail half not being in the main checkout | §0 | every file listed is under `backend/src` on `fix/auth-screen`; read the paths with the worktree prefix removed |
| the account-detail enrichment anchor, and it being the only surface for these figures | §7 | `getAccountController.js:857-885`; the accounts-by-type list serves three of the four for `bank` at `:431-462` |
| the account-level indicators reaching a client on one endpoint | §8.3 | a fourth surface, `GET /account/type/?type=bank` |
| the allowlist anchor that keeps `cash` unreachable | §7.2, §10.6 | `:631-641`, still excluding `cash` — the finding stands |
| "the legacy pocket-account paths are still live", three of them | §10.7 | the creation route and its handler are withdrawn; the editor's branch and the two reads remain, at re-stated anchors |
| the two anchors of the unfiltered ledger reads | §10.9 | `:44` and `:212-215` — the finding stands |

**Left standing because they are still true:** a missing FX rate answering `500`
with no status on the error (§10.1); the board handler catching with
`next(error)` where every other handler uses the module's mapper — measured at
`pocketController.js:90` (§10.2); the pocket's own six FX columns written and
never selected by any read (§10.3); a soft-deleted source account stranding what
was committed from it (§10.4); the account-deletion path knowing nothing about
`pocket_allocations` (§10.5); the deadline validated on neither create nor edit
(§10.8); and the minimum-amount message naming the accounting currency for a
figure typed in another (§10.9).
