# POCKET — THE DETAIL CHAIN, EXECUTABLE SPECIFICATION

**Written 2026-08-29 on `fix/auth-screen`, after `8c7ca8f` *"fix(pocket): read
the board the server answers"*. Lives in `plan-docs/ongoing/`, which
`.gitignore:123` re-includes: this file is versioned. No file under `frontend/` or `backend/` was
modified while writing it.**

It specifies ONE unit: the pocket detail, from the endpoint to the screen. It
consumes `POCKET_CONTRACT_AUDIT.md` (the measurement), `PLAN_POCKET_FE.md` (the
plan) and `POCKET_DECISIONS.md` (the frozen model), and restates none of them
beyond what this unit has to implement.

**Every field, type and status code below was read from the source on this
branch, not from a plan and not from memory.** Where the plan and the code
disagree, the disagreement is reported in §8 and is not resolved here: the code
is what answers requests, and a plan is a statement of intent.

> ## CORRECTION 2026-08-30 — this unit is built
>
> **The six files of §2 all landed, and so did the seventh §8.2 asked for.** The
> response contract's detail half is at `pocketTypes.ts:124-198`,
> `url_pocket_detail` at `urlConfig.ts:268`, `getPocketDetail` at
> `pocketApi.ts:63`, `stores/usePocketDetailStore.ts` at 167 lines,
> `PocketDetail.tsx` at 563 lines reading that store, `SummaryPocketDetailBox.tsx`
> at 126 lines reading the served figures, and
> `pages/forms/pocketDetail/styles/pocketDetail-styles.css` at 587 lines.
>
> **§1 is unchanged and still binds.** Every field, nullability rule and status
> code was re-read against its builder today and none has moved. What aged is
> §0's ordering argument, §2's "what old code is deleted" column, §4's *where the
> invariant is broken today*, and three of the five open decisions of §8. Each
> carries a dated correction where it stands.
>
> **§5 is a rule set, not a measurement, and none of it is touched.**

---

## 0. Why this unit comes first

Two reasons, in order of weight.

**One payload types five responses.** Create (`pocketController.js:141-145`),
edit (`:173-177`), allocate and release (`:213-220`) all answer with
`pocketDetailService.getDetail(...)` — the same object this screen reads. The
detail is not one screen; it is the module's central contract, and typing it
once types four of the seven endpoints plus its own.

**Shipping the creation form first would arm a live defect.** The screen behind
the detail route spends a pocket id as an account id (§4). It does not fire
today only because the `pockets` table can hold no rows — the creation form
writes into the retired model. A working create form puts rows on the board, and
every card then leads to that read. The order is forced: this unit disarms it,
and the creation unit follows.

> **CORRECTED 2026-08-30 — both premises are gone.** The creation form writes a
> row of `pockets` (`NewPocket.tsx:200-211` → `createPocket`, `pocketApi.ts:79`),
> and the detail screen keeps the parameter's name
> (`PocketDetail.tsx:75`). Both units shipped, the detail first as this section
> asked. The ordering argument is history, not a constraint on anything still
> open.

---

## 1. The response contract

`GET /api/fintrack/pocket/:pocketId`
(`routes/pocketRoutes.js:65` → `controllers/pocketController.js:91-114` →
`services/pocket_services/services/pocketDetailService.js:96-131`).

### 1.1 The envelope and the status codes

Every route of this API answers `{ status, message, data }`. Success is
`200` with `message: 'Pocket retrieved successfully'`
(`pocketController.js:109-113`).

| code | body | when |
|---|---|---|
| `200` | `{status, message, data}` | the pocket is the caller's |
| `400` | `{status, message: 'Validation Error', errors: [{field, message, code}]}` | the path id is not a positive integer (`pocketParamsSchema`, `pocketValidators.js:50-56`, coerced and `.strict()`); shaped at `pocketController.js:37-46` |
| `401` | the session envelope | `requireUserId` short-circuits before any query |
| `403` | `{status: 403, message: 'Pocket not found or not owned by the authenticated user.'}` | `pocketDetailService.js:102-104` |

**There is no `404` in this module, and the screen must not invent one.** A
pocket id that does not exist and one belonging to another user answer the same
`403`, deliberately (`pocketController.js:8-12`): splitting them would let a
caller walk the id space and learn which pockets are other users'. **A frontend
that words the two differently reintroduces exactly the leak the server
closed.** One message for both.

Note the error shape: a `400` carries `errors[]`, not a single `message` string.
No frontend layer declares that shape today. This unit issues no write, so it
only has to not swallow it — see §3.

### 1.2 `data.pocket`

Built at `pocketDetailService.js:114-123`: `makePocketStatus(row, today)`, plus
`uncovered`, minus `sourceCount`.

| field | type | null? | what it means |
|---|---|---|---|
| `pocketId` | number | never | `pockets.pocket_id`, `SERIAL PRIMARY KEY` (`020_create_pocket_tables.sql:84`). Its own sequence. **Not an account id** — see §4. Integer-checked at `makePocketStatus.js:88` |
| `name` | string | never | `VARCHAR(50) NOT NULL`. Non-empty, enforced at `makePocketStatus.js:92` |
| `note` | string \| null | **yes** | `VARCHAR(155)`, nullable. `null` means *the owner wrote no note*. Never `''`: an empty string would be a note written and then cleared, and `makePocketStatus.js:114` collapses `undefined` to `null` on purpose to keep the two apart |
| `target` | number | never | The goal, `DECIMAL(15,2) NOT NULL CHECK (target_amount > 0)` (`020:89`). Always positive. A pocket without a goal has no representation in the schema, so there is no absent case to render |
| `allocated` | number | never | **The committed figure**: how much of the real accounts is reserved for this goal, summed from the ledger (`pocketRepository.js:109`, `COALESCE(SUM(pa.amount), 0)`). `0` on a pocket created a minute ago, which is a fact, not a missing figure. **It is not a balance and it is never called *saved*** — no allocation ever moved money |
| `remaining` | number | never | `target − allocated`. **Negative when the pocket is over-funded**, and that is a fact rather than an error (`makePocketStatus.js:117-119`). Nothing is clamped at the level of one pocket |
| `progress` | number | never | `allocated / target × 100`. **May exceed 100.** Not a ratio, not clamped. It is the progress toward the goal, never the remaining share |
| `desiredDate` | string | never | `YYYY-MM-DD` **on the owner's calendar**, `DATE NOT NULL` rendered by `to_char` (`pocketRepository.js:110`). The date by which the target is meant to be fully allocated — **not** the date the money will be spent (`020:73-77`). It carries no instant to shift |
| `daysRemaining` | number | never | Whole calendar days from today to the deadline (`makePocketStatus.js:41-42`, `:107`). `0` means today. **Negative once the deadline has passed** |
| `requiredMonthly` | number \| null | **yes** | How much must still be committed per month to reach the goal on time. `0` means *the goal is already covered — there is nothing left to pace*. **`null` means the deadline has been reached or passed while money is still short: there is no monthly pace to state** (`makePocketStatus.js:50-60`, `:123-127`). The two are different answers and the screen must word them differently |
| `funded` | boolean | never | `allocated >= target` |
| `overdue` | boolean | never | `daysRemaining < 0 && allocated < target`. **Served, so no component derives it.** A pocket three months ahead of schedule and one whose deadline has passed are different states, and `remaining > 0` cannot tell them apart |
| `currency` | `CurrencyType` | never | Lowercase code — `'usd'`, never `'USD'`. `makePocketStatus.js:96-98` throws on anything else. The accounting currency the target is expressed in |
| `uncovered` | boolean | never | The funding accounts no longer hold what this pocket says they committed. Folded server-side at `pocketDetailService.js:117` as `sources.some(s => s.covered === false)` — **strict `=== false`, which excludes the `null`s.** No component may recompute it: `!covered` would flip every unknown into a warning |

**`sourceCount` is absent, deliberately** (`pocketDetailService.js:120-123`). The
card has no room for the source table and prints a count; the detail shows the
table itself, so a count would be a second answer to a question the rows already
answer. **It is not `sources.length`**: `sourceCount` counts every distinct
account in the whole ledger, while `sources[]` lists only the pairs whose running
net is non-zero — an account fully released still counts in the first and is
absent from the second. A screen that derives one from the other will be wrong.

### 1.3 `data.sources[]`

One entry per (pocket, source account) pair whose running net is not zero
(`accountAllocationRepository.js:78-95`, `HAVING SUM(pa.amount) <> 0`), sorted by
held amount descending (`pocketDetailService.js:82`). **The array is empty on a
pocket with no allocation, and empty is not an error.**

| field | type | null? | what it means |
|---|---|---|---|
| `accountId` | number | never | `user_accounts.account_id` — a real account |
| `accountName` | string \| null | **yes** | The account's name. `null` on the orphan branch below |
| `accountType` | string \| null | **yes** | The raw catalog name (`account_types.account_type_name`), not a display label |
| `heldByThisPocket` | number | never | **What THIS goal holds from THAT account.** Always real, always present, non-zero by the query's `HAVING`. This is the figure that survives when everything else on the row is `null` |
| `accountAllocated` | number \| null | **yes** | What **every** goal holds from that account, across all pockets |
| `accountBalance` | number \| null | **yes** | The account's real money |
| `accountUnassignedCash` | number \| null | **yes** | `accountBalance − accountAllocated` (`makeAccountAllocation.js:43`). **May be negative**, and that is a state rather than an error: an expense that spends committed money is always accepted, and the account then reports that it no longer covers what is committed to it |
| `covered` | boolean \| null | **yes** | Whether that account still holds what is committed to it — `!isOverAllocated` (`pocketDetailService.js:79`). **It is the account's own state, not this pocket's share of it** |

**The three amounts are three different questions and the screen must keep them
apart**: what this goal holds from the account, what every goal holds from it,
and what is actually in it. Collapsing any two of them is the defect the type
exists to prevent.

**The one branch that produces nulls.** When the allocation ledger names an
account that the account read did not return — it was soft-deleted
(`accountAllocationRepository.js:48`, `deleted_at IS NULL`) or it is the internal
`'slack'` account that read filters out (`:49`) — `pocketDetailService.js:58-68`
serves **five fields and `covered` as `null` together**, while
`heldByThisPocket` stays a real amount. Either all six are null or none is;
there is no partial row.

**What each null means, and the coercion each one forbids:**

- `accountName: null` — *the account behind this commitment is gone from the
  account list*. It is **not** an unnamed account. The screen words it; it never
  prints an empty cell.
- `accountBalance: null`, `accountAllocated: null`, `accountUnassignedCash:
  null` — *the server has no answer for this account*. **A `?? 0` here reports a
  deleted account's balance as zero, which is a stated amount the server refused
  to state.**
- `covered: null` — **unknown, not *not covered*.** The server itself excludes
  the nulls when folding `uncovered` (`:117`). A component computing `!covered`
  turns every unknown into a warning and disagrees with the flag on the same
  payload.

### 1.4 `data.history[]`

`makeAllocationEntry` over `getPocketHistory` (`pocketRepository.js:144-169`),
**newest decision first**, ordered by `allocation_actual_date DESC,
allocation_id DESC`. **The array is empty on a pocket with no allocation.**

**This is not a transaction list.** No pocket allocation ever moved money. It is
the list of decisions taken about the goal.

| field | type | null? | what it means |
|---|---|---|---|
| `allocationId` | number | never | `BIGSERIAL` crossing the driver as text, then `Number()` (`makeAllocationEntry.js:43`) |
| `amount` | number | never | **Signed, and the sign IS the decision**: positive committed to the goal, negative released back to the account's unassigned cash. Never `0` (`020:151`, `CHECK (amount <> 0)`). The screen prints the word beside the sign — colour alone survives neither colour blindness nor print (`makeAllocationEntry.js:5-8`) |
| `allocationDate` | string | never | `YYYY-MM-DD` on the owner's calendar, resolved in SQL by `AT TIME ZONE` (`pocketRepository.js:150`). **When the decision was taken, never when the row was written** — a set-aside agreed on Friday and typed on Monday belongs to Friday |
| `sourceAccountId` | number | never | The account the commitment was made from |
| `sourceAccountName` | string | **never** | A plain `JOIN user_accounts` with **no soft-delete filter and no `slack` filter** (`pocketRepository.js:152, :159`). **So this still names an account whose source row shows `accountName: null`.** The two fields name the same account and differ in nullability by construction; a type that declares them alike is wrong about one of them |
| `originalAmount` | number | never | **What the owner actually typed**, in `originalCurrency`, and **signed the same way as `amount`** (`pocketAllocationService.js:244`). `DECIMAL(15,2) NOT NULL` (`020:157`). **Audit metadata, never a second unit to do arithmetic in** |
| `originalCurrency` | `CurrencyType` | never | Lowercase. `original_currency_id` is `NOT NULL` (`020:158`) |
| `exchangeRate` | number | never | The rate that produced the stored figure. `DECIMAL(20,10) NOT NULL CHECK (> 0)` (`020:160`). **Not an amount: it keeps ten decimals and must never go through a two-decimal money formatter** (`makeAllocationEntry.js:50-52`) |
| `exchangeRateSource` | string | never | The provider, or the literal `'identity'` when no conversion was needed (`fx_services/conversion/currencyAmountConversion.js:43`). `VARCHAR(50) NOT NULL` |
| `exchangeRateTimestamp` | string | never | **The one date in this module that is a full ISO instant, not a calendar label.** Passed through raw from a `TIMESTAMPTZ` column (`pocketRepository.js:157`) and serialised by the driver as an instant. **Rendering it with the calendar-label helper moves the audit timestamp by a day west of UTC** |

### 1.5 `data.meta`

`{ notices: string[] }`, **always `[]` on this endpoint**
(`pocketDetailService.js:129`). The key exists for shape parity with the board
and is never populated. It is present, never absent — a screen may read
`meta.notices` without guarding it.

### 1.6 The declaration

Appended to `frontend/src/fintrack/types/pocketTypes.ts`, beside the board half.
**The board half is not re-typed and not renamed.**

```ts
 // A YYYY-MM-DD label resolved on the OWNER's calendar. Documentation, not
 // enforcement: it stops a call site from confusing it with the one instant in
 // this module, exchangeRateTimestamp.
 export type CalendarDate = string;

 // Present and empty on the detail; carries the board's notices on the board.
 export type PocketMeta = { notices: string[] };

 // The same pocket the board serves, minus the source count the table answers
 // in full. Omit rather than a hand-written copy, so the two cannot drift.
 export type PocketDetailFigures = Omit<PocketStatus, 'sourceCount'>;

 // One account this pocket draws on. The three amounts are three different
 // questions and are kept apart on purpose.
 export type PocketSourceAccount = {
  accountId: number;
  // null together with the four below when the account is soft-deleted or is
  // the internal one. heldByThisPocket stays real and the pocket still counts it.
  accountName: string | null;
  accountType: string | null;
  heldByThisPocket: number;
  accountAllocated: number | null;
  accountBalance: number | null;
  accountUnassignedCash: number | null;
  // null means unknown, never "not covered": the server's own uncovered fold
  // excludes the nulls.
  covered: boolean | null;
 };

 // One decision about the goal. Not a transaction: no allocation moved money.
 export type PocketAllocationEntry = {
  allocationId: number;
  // Signed: positive committed, negative released. Never zero.
  amount: number;
  allocationDate: CalendarDate;
  sourceAccountId: number;
  // Joined without a soft-delete filter, so this still names an account the
  // source table has already stopped naming.
  sourceAccountName: string;
  originalAmount: number;
  originalCurrency: CurrencyType;
  // Ten decimals, deliberately not rounded to two like every other number here.
  exchangeRate: number;
  // The provider, or the literal 'identity' when no conversion was needed.
  exchangeRateSource: string;
  // The one full ISO instant in this module, not a calendar label.
  exchangeRateTimestamp: string;
 };

 export type PocketDetailPayload = {
  pocket: PocketDetailFigures;
  sources: PocketSourceAccount[];
  history: PocketAllocationEntry[];
  meta: PocketMeta;
 };

 export type PocketDetailResponse = {
  status: number;
  message: string;
  data: PocketDetailPayload;
 };
```

**Not served, and the screen must not invent it:** the pocket's own six FX audit
columns. `original_target`, `original_currency_id`, `exchange_rate`,
`exchange_rate_source`, `exchange_rate_timestamp` and
`exchange_rate_target_currency_id` are written on `pockets` (`020:94-101`) and
**no read query selects any of them** — verified against `pocketRepository.js`.
So the hero states the converted target alone. Showing the goal as it was typed
is a backend requirement, already recorded at `PLAN_POCKET_FE.md` §9.3, and it
is **not** this unit's.

---

## 2. The six files

| # | file | created / modified | what old code is deleted |
|---|---|---|---|
| 1 | `frontend/src/fintrack/types/pocketTypes.ts` | modified | nothing. The detail contract of §1.6 is appended below the board half; `PocketStatus`, `PocketBoardSummary`, `PocketBoardPayload` and `PocketBoardResponse` are untouched, except that the board payload's inline `{ notices: string[] }` at `:98` now reads `PocketMeta` — the same shape, named once |
| 2 | `frontend/src/urlConfig.ts` | modified | nothing. One declaration beside `url_pocket_board` (`:248`): `url_pocket_detail`, a **function of the id**, matching the convention the file already uses for id-bearing routes. `url_get_account_by_id` (`:91`) and `url_get_transactions_by_account_id` (`:95`) stay — other screens use them. `url_create_pocket_saving_account` (`:74-75`) stays: it is the creation unit's |
| 3 | `frontend/src/fintrack/api/pocketApi.ts` | modified | nothing. One function beside `getPocketBoard`: `getPocketDetail(pocketId)`, unwrapping the envelope the way `:26-30` does and returning `PocketDetailPayload`. Errors propagated untouched |
| 4 | `frontend/src/fintrack/stores/usePocketDetailStore.ts` | **created** | — |
| 5 | `frontend/src/fintrack/pages/forms/pocketDetail/PocketDetail.tsx` | modified — rewritten onto the store | **the account fetch** (`:79-84`, and the `url_get_account_by_id` import at `:21`); **the transaction fetch** (`:89-110`, its date arithmetic, and the `url_get_transactions_by_account_id` import at `:22`); **the seed constant** (`:47`, `:64`, and the `DEFAULT_POCKET_ACCOUNT_LIST` import at `:10`); **the two effects that write them into state** (`:112-131`); **the transaction statement band** (`:214-241`) with `AccountBalanceSummary`, `AccountTransactionsList` and the period line; **the transaction detail modal and its hook** (`:36`, `:136-141`, `:254-259`); **the `<p>Loading...</p>` and the retry-less `<p>Error fetching account info</p>`** (`:246-249`); **the id rename at `:58`** (§4); the `PocketSavingAccountsResponseType` import (`:14`) |
| 6 | `frontend/src/fintrack/pages/forms/pocketDetail/summaryPocketDetailBox/SummaryPocketDetailBox.tsx` | modified — rewritten onto the served figures | **`Saved`** (`:20`); **the legacy destructure** `{ currency_code, account_balance, target }` (`:21`); **the derived remainder** `target - account_balance` (`:22`); **the derived percentage** `Math.abs((remaining / target) * 100)` (`:45-48`), replaced by the served `progress`; **the derived alert** `remaining > 0` (`:43`), replaced by the served `funded` and `overdue`; the `PocketSavingAccountListType` import (`:8`) |

**Deletion discipline.** Every deletion above lands in the unit that ships its
replacement, on the same route slot. None of them rests on *nobody imports it* —
mid-refactor that only means the caller is not written yet.

`DEFAULT_POCKET_ACCOUNT_LIST` (`helpers/constants.ts:210-228`) has **its use**
deleted here and **its declaration left in place**: removing it edits
`constants.ts`, which is not one of the six files. It is inert once unimported.
See §8.4 for the disagreement this creates with the plan's unit 8.

> **CORRECTED 2026-08-30 — the declaration is gone too.** A grep for
> `DEFAULT_POCKET` in `helpers/constants.ts` returns nothing; it went out with
> the sweep of the retired account type rather than staying inert. The one pocket
> entry that survives in that file is the movement-type label `5: 'pocket'`
> (`:73`), which is deliberate.
>
> **Also corrected in this table:** the stylesheet §8.2 argues for as a seventh
> file exists — `pages/forms/pocketDetail/styles/pocketDetail-styles.css`, 587
> lines — so the six-file boundary this section states was not what shipped.

---

## 3. The flow, link by link

```
 ListPocket.tsx:121  Link to={`pockets/${pocketId}`}
   -> App.tsx:336    path 'pocket/pockets/:pocketId'
     -> PocketDetail.tsx        useParams().pocketId
       -> usePocketDetailStore  fetchDetail(pocketId)
         -> pocketApi           getPocketDetail(pocketId)
           -> urlConfig         url_pocket_detail(pocketId)
             -> GET /api/fintrack/pocket/:pocketId
```

| link | is responsible for | must NOT |
|---|---|---|
| `urlConfig.ts` | stating the path once, as a function of the id | resolve to anything under `account/`. It builds `pocket/<id>` and nothing else |
| `pocketApi.ts` | the request, and unwrapping `{status, message, data}` to return `data` | flatten the error. The `400` envelope carries `errors[]` with a field and a code per issue; a form built later needs all three, and `catch`-to-string here would destroy them. Flattening is right at the point of display, not in the client |
| `usePocketDetailStore.ts` | holding one pocket's payload, its four fetch states, and accepting a payload handed to it by a write instead of refetching | recompute anything. Not `progress`, not `remaining`, not `uncovered`, not a source count. Every one of those is a server fold, and a second implementation is how the board's header came to disagree with its own list |
| `PocketDetail.tsx` | reading the route parameter, asking the store for it, and choosing between the four states | fetch. It owns no `useFetch` and no URL. It also owns no fallback data: with no answer there is nothing to render but a skeleton or an error |
| `SummaryPocketDetailBox.tsx` | presenting the served figures of the hero | derive. It receives figures and prints them; it computes no percentage and no remainder |

**The store's shape**, as `PLAN_POCKET_FE.md` §4.2 already settles it, verified
here as consistent with what the endpoint serves:

- state: `detailId: number | null`, `detail: PocketDetailPayload | null`,
  `status`, `error`;
- actions: `fetchDetail(pocketId)`, `setDetailFromWrite(payload)`, `clear()`;
- `fetchDetail` asks only when `detailId !== pocketId`, or when `status` is
  `idle` or `error` — so walking into a pocket and back costs no request, while
  walking into a **different** pocket always does;
- `setDetailFromWrite` writes the payload, sets `detailId =
  payload.pocket.pocketId` and `status: 'loaded'`. **No write in this module is
  followed by a refetch of the thing it wrote**, because four of them answer with
  this exact payload. That action is why this store exists before any write does;
- an error **leaves `detail` as it was**, so a failed refresh does not blank a
  screen that was rendering.

**`detailId` is a pocket id.** It is compared against the route parameter and is
never handed to anything that takes an account id.

---

## 4. The identifier invariant

> **A pocket id stays a pocket id for the whole length of the chain. It is never
> renamed to an account id, it is never passed to an account endpoint, and the
> detail screen issues no request whose path contains `account`.**

`pockets.pocket_id` is `SERIAL PRIMARY KEY` (`020_create_pocket_tables.sql:84`) —
a sequence of its own, starting at 1, with nothing to do with
`user_accounts.account_id`. **Both sequences start at 1, so the collision is the
normal case, not an edge case.**

> **CORRECTED 2026-08-30 — the invariant holds; nothing below is broken today.**
> `PocketDetail.tsx:75` reads `const { pocketId } = useParams()`, parses it, and
> `:118` calls `fetchDetail(parsedPocketId)`. The two legacy fetches are gone: a
> grep for `url_get_account_by_id` and `url_get_transactions_by_account_id` under
> `pages/forms/pocketDetail/` returns nothing. The table below is the record of
> what was fixed, and §7.1 remains the check that keeps it fixed.

**Where the invariant is broken today**, exactly:

| line | code as it stands | what it does |
|---|---|---|
| `PocketDetail.tsx:58` | `const { pocketId: accountId } = useParams();` | **the rename.** A pocket id acquires an account id's name, and every use below inherits the mistake |
| `PocketDetail.tsx:79` | `` const urlAccountById = `${url_get_account_by_id}/${accountId}`; `` | spends it as an account id against `GET /api/fintrack/account/:accountId` |
| `PocketDetail.tsx:104` | `` `${url_get_transactions_by_account_id}/${accountId}/?start=…` `` | spends it a second time, for a transaction statement a pocket does not have |

`getAccountById` resolves `WHERE ua.account_id = $1 AND ua.user_id = $2`
(`getAccountController.js:532-546`), so there are exactly two outcomes and both
are wrong:

- **the id matches one of the caller's real accounts** — the screen renders that
  account's name as the pocket's title (`:154`), its balance under the label
  *Saved* (`SummaryPocketDetailBox.tsx:38`) and **its transaction statement**
  (`:236-239`). `target` is absent from a bank account's row, so `:22` computes
  `undefined - number` and `:45-48` prints **`NaN%`**;
- **the id matches nothing** — `404`, and the screen keeps the seed constant on
  screen: a blank title, a target of `$0`, a committed figure of `$0` and
  `100.0%`. **Every one of those figures is invented by a frontend constant.**

**After this unit, the route parameter keeps its name** — `const { pocketId } =
useParams()` — and the only request the screen can issue is
`url_pocket_detail(pocketId)`. The invariant is not a convention: §7.1 makes it a
check that has to be run.

---

## 5. Presentation rules

Each rule states the value, not the layout. **Layout, spacing and colour belong
to `POCKET_VISUAL_PROPOSAL.md` and are not decided here.**

### 5.1 An absent figure is not zero

**Rule.** A figure the server did not send renders as a **skeleton** while the
request is in flight, and as a **dash** when the answer arrived without it.
Never `0`, never `NaN`, never an empty cell.

**Reason.** `0` is a stated amount. On a screen about committed money, "we do not
know" and "nothing is committed" are different facts, and the server takes care
to distinguish them — `makeSummary` refuses to fold a mixed-currency board rather
than serve a sum that is not one. A frontend `?? 0` throws that distinction away
one layer below where it was made.

**Concretely: no `?? 0` anywhere in this unit.** That is the check, and it is
greppable.

### 5.2 The committed figure is *allocated*, never *saved*

**Rule.** The figure under `allocated` is labelled **allocated**. The words
*saved*, *saving* and *balance* appear in no user-facing string on this screen.

**Reason.** A pocket holds no money. `allocated` is how much of the real
accounts is committed to this goal, summed from the ledger — no balance is read
anywhere in this module (`makePocketStatus.js:8-10`). *Saved* names an object
that has money of its own; *balance* names the retired model in one word.

`SummaryPocketDetailBox.tsx:20` carries the banned word today, on a figure that
is in fact a bank account's balance. Both defects die in the same edit.

### 5.3 The remainder of an account is unassigned cash, never "available balance"

**Rule.** `accountUnassignedCash` is worded as **uncommitted** or **unassigned**
cash. The word *available* appears nowhere on this screen.

**Reason.** The available balance is still the whole `accountBalance` — **a
pocket blocks no spending.** Calling the remainder "available" tells the owner
they cannot spend money they can (`makeAccountAllocation.js:14-18`). The figure
may also be negative, which is a state and not an error: an expense that spends
committed money is always accepted, and the account then reports that it no
longer covers what is committed to it.

Part of the same rule: when `covered` is `false`, the warning **names the account
and what it is short by, and never charges a share of that shortfall to this
pocket.** The shortfall belongs to the account; splitting it across the pockets
that draw on it needs a policy the app would have to invent
(`pocketDetailService.js:39-43`).

### 5.4 A figure the server withheld on purpose is never rendered as an amount

**Rule.** Four withheld values, four distinct renderings:

| value | renders as | never |
|---|---|---|
| `requiredMonthly === null` | a worded statement that **the desired date has passed**, with `remaining` beside it | a monthly figure of any kind |
| `requiredMonthly === 0` | a worded statement that **the goal is covered** | `$0.00` |
| a source row's `accountName === null`, and the figures beside it | a worded statement that **the account was removed**, with `heldByThisPocket` still shown | a blank cell, or `$0.00` under balance |
| `covered === null` | **no mark at all** — the state is unknown | a warning mark |

**Reason.** `null` and `0` are two different answers here. `$1,000` still owed on
a goal whose deadline passed is not "$1,000 per month", and a figure under a
label it does not answer is worse than a figure withheld
(`makePocketStatus.js:123-127`). `0` is the opposite statement: there is nothing
left to pace because the goal is covered.

### 5.5 The trap — the shared formatter prints zero for a figure the server refused to state

**Measured, both helpers in `frontend/src/fintrack/helpers/functions.ts`:**

```
 currencyFormat(chosenCurrency = 'USD', number = 0, countryFormat = 'en-US')   :19-23
 numberFormatCurrency(x: number | string = 0, decimals = 2, currency?, …)      :236-241
```

- `currencyFormat(code, undefined)` — the default parameter fires and the helper
  formats `0`. **Prints `$0.00`.**
- `currencyFormat(code, null)` — the default does **not** fire (a JavaScript
  default fires on `undefined` only), but `Intl.NumberFormat.format(null)`
  coerces `null` to `0`. **Prints `$0.00` anyway.** Both roads arrive at the same
  wrong figure.
- `numberFormatCurrency(undefined)` — the default fires. **Prints `0.00`.**
- `numberFormatCurrency(null)` — `parseFloat(String(null))` is
  `parseFloat('null')`, which is `NaN`, so `:247-249` returns the literal string
  **`'Not a valid number, please try again'`** — a sentence landing in the layout
  where an amount belonged.

**So: anything piped straight through either helper prints exactly the figure the
server refused to state, or an error sentence.** This unit is the first place a
nullable amount reaches a formatter — `requiredMonthly` and the four nullable
source figures — so the trap springs here or nowhere.

**Rule.** **A nullable amount is never passed to a currency formatter.** The
component decides between the worded value and the amount **before** formatting,
and only a `number` ever reaches `currencyFormat` or `numberFormatCurrency`.

Two corollaries from the same file:

- **`exchangeRate` never goes through an amount formatter.** It carries ten
  decimals by design (`makeAllocationEntry.js:50-52`), and both helpers are fixed
  at two.
- **`exchangeRateTimestamp` never goes through `formatCalendarDate`.** That
  helper splits on `-` and rebuilds a local `Date` from the parts
  (`functions.ts:330-344`) — correct for `desiredDate` and `allocationDate`,
  which are calendar labels, and wrong for an ISO instant. The audit timestamp
  needs an instant renderer; the two calendar dates need `formatCalendarDate`.

Fixing either helper's default is **not** this unit's: they are used across the
app, and changing a shared default inside a feature commit is how a repair on one
screen becomes a regression on five.

### 5.6 What the screen states, region by region

Values only — the visual proposal owns the rest.

- **the hero** — `name`, `target`, `allocated`, `remaining`, `progress` (the
  served figure, which may exceed 100 and is **never** the remaining share),
  `desiredDate`, then `requiredMonthly` and `daysRemaining` under §5.4;
- **the note** — `note` when present, a dash when `null`. **Never the string
  `null`, never an empty box**;
- **the sources** — one row per entry, the account name or *account removed*,
  then the three figures kept apart under §5.3, and `covered` as a mark under
  §5.4. Accounts whose net fell to zero are absent because the server does not
  serve them; the history keeps the trace of the one that left;
- **the history** — one row per entry, newest first: `allocationDate`, the word
  **Committed** or **Released** together with the sign, `amount`, and
  `sourceAccountName`. **Never called transactions and never rendered through
  `AccountTransactionsList`**;
- **empty** — no source rows and no history rows are **two separate worded
  lines**, and the hero renders regardless: a pocket with no allocation is a
  complete, valid pocket;
- **error** — one message, one **retry** wired to `fetchDetail(id)`. The `403`
  is worded once for both of its causes (§1.1);
- **loading** — skeletons for the hero, the source rows and the history rows.

---

## 6. What this unit must NOT do

- **No creation form.** `NewPocket.tsx` and `url_create_pocket_saving_account`
  (`urlConfig.ts:74-75`) are untouched. The creation defect is the graver of the
  two and it is the next unit's.
- **No allocate, no release, no delete, no edit.** No modal, no source picker, no
  write client function, no `AccountActionsMenu` wiring. The three-dots control
  at `PocketDetail.tsx:161-163` stays inert and unchanged — it is the anchor the
  edit unit needs.
  > **CORRECTED 2026-08-30:** the units this bullet held back have since shipped,
  > so the control is no longer inert. `PocketDetail.tsx:29-30` imports
  > `AccountActionsTrigger` and `AccountActionsMenu`, `:31-35` the deletion modal
  > and the commit-and-release modal, and `:519-531` opens them. This bullet
  > scoped one commit; it does not bind the ones that followed it.
- **No change to Transfer**, to the overview, to Account Detail, or to the two
  edit schemas. The cross-module integrations are their own units.
- **No migration, and nothing under `backend/`.** The `503` an unavailable
  exchange rate should answer instead of `500` is a real gap and it is not this
  unit's.
- **No change to the board.** `pages/pocket/` is correct as of `8c7ca8f` and the
  card's link already carries the right id.
- **No dead-code sweep.** `pages/budget/components/ListPocket.tsx`,
  `DEFAULT_POCKET_LIST`, `DEFAULT_POCKET_ACCOUNT_LIST`, the five account-shaped
  response types and the legacy half of `pocket-styles.css` above `:255` all
  stay.
- **No repair of the shared formatters** (§5.5).
- **No reopening of a closed decision.** A pocket is a planning object: no
  balance, no transactions of its own, no participation in Transfer. The
  vocabulary of `PLAN_POCKET_FE.md` §0.1 binds. The `403`-for-both rule is a
  security decision, not a UX one.

---

## 7. Acceptance criteria

Runnable in the working tree, without this document open.

### 7.1 The decisive one — the identifier

> **Given a valid pocket id, the detail must never show another account's data,
> even when an account exists with the same numeric id.**

**How to prove it — the collision has to be constructed, not hoped for.**

1. **Build the collision.** With the same user, confirm an account exists whose
   `account_id` equals the `pocket_id` of a pocket that user owns. Both sequences
   start at 1, so on a fresh database this is the default; if it is not, create
   accounts or pockets until the numbers meet. **A test where the ids differ
   proves nothing.**
2. **Make the two visibly distinct.** The pocket's `name` must differ from the
   account's `account_name`, and the allocation must come from a *different*
   account, so the source table cannot be mistaken for a coincidence.
3. **Open the card from the board** and watch the network panel. It must show:
   - **exactly one request**, whose path ends `pocket/<id>`;
   - **zero requests** whose path contains `account/<id>` or
     `account/transactions/<id>`.
4. **Read the screen.** The title is the **pocket's** `name`, not the account's.
   No transaction statement is present, in any state.
5. **The negative case.** Ask for an id that is a real account of this user but
   **not** a pocket of theirs. The screen must render the error state with a
   retry, worded identically to the not-found case, and **must show no figure at
   all** — no `$0`, no `100.0%`, no `NaN%`.
6. **Statically.** A search for `url_get_account_by_id` and
   `url_get_transactions_by_account_id` under
   `frontend/src/fintrack/pages/forms/pocketDetail/` returns **nothing**. A
   search for `accountId` in `PocketDetail.tsx` returns nothing outside the
   source table's own rows.

### 7.2 The rest

| # | criterion | how |
|---|---|---|
| 1 | the contract compiles against its consumers | `tsc` passes; `PocketSavingAccountsResponseType` is imported by no file; `PocketSavingAccountListType` is imported only by `helpers/constants.ts` |
| 2 | no invented figure survives a failure | stop the server, open the screen: an error with a retry. **Never a target of `$0`, never `100.0%`, never `NaN%`, never a blank title** |
| 3 | no coercion | a search for `?? 0` across the six files returns nothing |
| 4 | the deadline that passed states no pace | a pocket with `requiredMonthly: null` renders *the desired date has passed* and **no monthly figure**; one with `requiredMonthly: 0` renders *goal covered*, not `$0.00` |
| 5 | the percentage is the served one | a pocket at 72% displays **72%**, not `28.0%`. Over-funded, it displays above 100 and is not clamped |
| 6 | the alert is read, not derived | a pocket whose deadline has passed and one three months ahead of schedule do **not** carry the same mark; `funded` and `overdue` are the fields consulted, `remaining > 0` appears nowhere |
| 7 | the orphan source row is honest | with a source account soft-deleted, the row reads *account removed*, still shows `heldByThisPocket`, and shows **no balance figure** — not `$0.00` and not a blank cell |
| 8 | unknown coverage is not a warning | a source row with `covered: null` carries **no** warning mark, and the pocket-level `uncovered` flag agrees with the marks on the rows |
| 9 | the three account figures stay apart | the source row labels distinguish what this goal holds, what all goals hold, and the real balance. **The word *available* appears nowhere on the screen** |
| 10 | the vocabulary holds | a case-insensitive whole-word search for `saved`, `saving` and `balance` across the six files returns nothing user-facing; the committed figure is labelled **allocated** |
| 11 | the history is not a statement | no component named or classed as a transaction appears; each row shows the word **Committed** or **Released** beside the sign, not colour alone |
| 12 | the two date kinds are told apart | `desiredDate` and `allocationDate` render as calendar days; `exchangeRateTimestamp` renders as an instant. Changing the machine's time zone west of UTC moves **none** of the three |
| 13 | the rate keeps its precision | `exchangeRate` is not printed through a two-decimal amount formatter |
| 14 | empty is not error and not loading | a pocket with no allocation renders the hero plus **two** worded empty lines, one for sources and one for history — no skeleton, no error |
| 15 | the store does not re-ask | opening a pocket, going back to the board and reopening the same pocket issues **one** detail request; opening a *different* pocket issues a new one |
| 16 | the store computes nothing | a search for `progress`, `remaining` or `uncovered` on the right-hand side of an assignment in `usePocketDetailStore.ts` returns nothing |
| 17 | the diff is what it says | `git status` shows the six files and nothing else; no `backend/` path in the diff; boot test **`APP LOADED OK`** |

---

## 8. Open decisions — the developer's, recorded with a recommendation

Five, all found while writing this specification. **None is invented scope: each
is a disagreement between two documents, or a gap the six-file boundary creates.**

> **MEASURED 2026-08-30 — what the code did with each of the five. Recorded as a
> reading, not as a closure: the decisions below are the developer's and none of
> them is struck here.**
>
> | # | what shipped |
> |---|---|
> | 8.1 | the hero was **rewritten in place** — `SummaryPocketDetailBox.tsx`, 126 lines, reading `target`, `allocated`, `remaining` and `progress` from `PocketDetailPocket` |
> | 8.2 | the **seventh file exists**: `pages/forms/pocketDetail/styles/pocketDetail-styles.css`, 587 lines |
> | 8.3 | the **skeleton is local**: `PocketDetail.tsx:221-228` over `.pocketDetail__skeletonHero` and `.pocketDetail__skeletonRow` (`pocketDetail-styles.css:75`, `:82`). No `general_components/skeleton/` exists |
> | 8.4 | the seed constant was **deleted, not left**: a grep for `DEFAULT_POCKET` in `helpers/constants.ts` returns nothing |
> | 8.5 | the board row type is `PocketStatus` (`pocketTypes.ts:27`), as this specification uses; **`PocketMeta` was not declared** — both payloads still inline `{ notices: string[] }`, now at `:98` and `:185` |

### 8.1 The hero: rewritten in place, or retired for a shared component

`POCKET_CONTRACT_AUDIT.md` §4 lists
`summaryPocketDetailBox/SummaryPocketDetailBox.tsx` as the sixth file,
**rewritten** onto the served figures. `PLAN_POCKET_FE.md` §7.2 and unit 8 say
the opposite: the 58-line component is **retired**, and the hero is built on the
shared cream `SummaryDetailBox`
(`pages/forms/accountDetailSharedComponents/summaryDetailBox/`), which already
carries an `action` slot and a `surface: 'dark' | 'light'` modifier, plus three
new components — `PocketSourceAccounts`, `PocketAllocationHistory`,
`PocketActions`.

**Recommendation: rewrite in place and keep the six-file boundary**, because the
plan's component split ships alongside the write actions those components exist
to host, and this unit ships none of them — splitting now would create four files
whose props change again in the very next unit that touches them.

### 8.2 The stylesheet is a seventh file, or the markup reuses the statement's classes

The six files contain **no stylesheet**, yet the source rows, the history rows
and the three loading skeletons are all new markup. `PocketDetail.tsx` imports
`forms-styles.css` and an account-statement stylesheet (`:38-39`), whose classes
were written for a transaction statement this unit deletes.

**Recommendation: count the detail stylesheet as a seventh file.** Forcing new
markup onto classes named for a statement is what makes the next reader believe a
pocket has transactions, and the alternative — inline values — is barred by the
token rule.

### 8.3 The loading skeleton has no shared primitive yet

`PLAN_POCKET_FE.md` §7.5 builds `Skeleton` and `EmptyState` as shared components
in unit 5, **before** the detail. Nothing in `frontend/src` provides either
today; the board's skeleton is local markup with board-specific classes
(`ListPocket.tsx:57-77`).

**Recommendation: declare the skeleton locally in this unit's stylesheet, as the
board already does**, and let the plan's unit 5 extract the shared primitive from
two real call sites rather than one — an abstraction drawn from a single use is a
guess about the second.

### 8.4 Whether `DEFAULT_POCKET_ACCOUNT_LIST` dies here

The audit defers it (*"the seed constants stay until nothing imports them"*);
`PLAN_POCKET_FE.md` unit 8 deletes it in the detail unit. After this unit it has
**zero** consumers, so both readings are defensible.

**Recommendation: leave it.** Deleting it edits `helpers/constants.ts`, a seventh
file outside this unit's subject, and an unimported constant changes no
behaviour — while the deletion is one line in the sweep that removes the four
account-shaped pocket types with it.

### 8.5 Two naming disagreements, stated for the record

Neither is a decision so much as a fact the implementer will meet:

- the plan calls the board row type **`PocketBoardRow`** (§2); the code on this
  branch declares it **`PocketStatus`** (`pocketTypes.ts:27`), and the board
  store and the board card both import that name. **This specification uses
  `PocketStatus`** — renaming it would edit board files this unit declares
  untouched;
- the plan declares a **`PocketMeta`** type; the code inlines
  `{ notices: string[] }` at `pocketTypes.ts:98`. **This specification declares
  `PocketMeta` and points both payloads at it** — same shape, named once, one
  line changed in a file this unit already edits.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

The unit this document specifies has shipped. §1 (the response contract), §3 (the
flow and each link's responsibility), §5 (the presentation rules) and §7 (the
acceptance criteria) were re-read against the code and stand unchanged. Six
passages were corrected in place. No decision was closed and no recommendation
was struck.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| the ordering argument — the creation form arms the id-space defect | §0, second reason | both units shipped; neither premise exists |
| the seed constant left inert with only its use deleted | §2, closing note | `DEFAULT_POCKET` appears nowhere in `helpers/constants.ts` |
| the six-file boundary | §2 | seven files shipped: the detail stylesheet §8.2 argued for exists at 587 lines |
| "where the invariant is broken today" | §4 | `PocketDetail.tsx:75` keeps the parameter's name and no `account/` request is issued from that screen |
| the three-dots control staying inert | §6, second bullet | wired to `AccountActionsTrigger` / `AccountActionsMenu` and to three modals |
| the state of the five open decisions | §8 | measured row by row in the block under its heading — recorded as a reading, not as a closure |

**Left standing because they are still true:** the shared formatter defaults of
§5.5 (`helpers/functions.ts:19-23` and `:236-241`), the absence of a shared
skeleton primitive, and the inlined `{ notices: string[] }` where §8.5
recommended a named `PocketMeta`.
