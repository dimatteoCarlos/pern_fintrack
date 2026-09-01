# PLAN — Budget module, the write path

**Lives in `plan-docs/`, which is in `.gitignore`: it produces no commit.**

Opened 2026-08-17. This is the document `PLAN_BUDGET_FRONTEND.md` §10.3 points at
with its unspecified row — `| — | the edit modal | after 9 | V1 §7.1 |`. That row
named the work and never described it.

**Five logical units. Each one is a whole function: it is not done until the
capability it names works end to end from the screen. No unit is sized to fit a
commit.**

> ### ⚠️ Amended 2026-08-18 — the contract under this plan changed
>
> `d21e669` replaced the write's `{ amount, onlyThisMonth }` with
> `{ amount, month, appliesUntil }`, where `appliesUntil` is a month or the
> sentinel `'openEnded'`. The spec is frozen in `PLAN_BUDGET_V1.md` §5.1.0 and
> §7.4, and decision 48 records why neither bound is defaulted.
>
> **Unit A is written against the flag and has been corrected in place** — A.0
> is new, A.1's condition inverted, A.3's `handleSave` re-signed and A.7
> rewritten. B, C, D and E are unaffected: none of them names the payload.
>
> **One decision this opened is still open and it blocks A.0.3:** what control
> replaces the `Only this month` checkbox, now that the form has to state a last
> month as well as a first. Evaluated in *Open decisions* → **O3**.

> ### STATE — 2026-08-23. Four of the five units are done
>
> Measured against the code. The unit blocks below keep their *"built,
> uncommitted"* notes because those record how each one was verified; **all of
> that work is committed now.**
>
> | unit | state | evidence |
> |---|---|---|
> | **A** — change the amount from its own screen | **Done.** The modal is reachable from three screens | `744f986` added it, `6c03e02` opened it from the budget screen. Mounted at `CategoryAccountList.tsx:312`, `CategoryDetail.tsx:518` and `EditAccount.tsx:674`. The backend mirror `A.1` is at `budgetAllocationService.js:278-282`, inside `setCurrentMonthBudget` at `:194` *(all four anchors re-measured 2026-08-30; they read `:320`, `:466`, `:629` and `:357-365`)* |
> | **B** — stop budgeting an account | **Done and committed.** `handleRemove` at `BudgetEditModal.tsx:385`, the button at `:775` and `:793`, and `canRemove = currentAmount > 0 && !saved && !isSaving` at `:402`, which is completion criterion 4 |
> | **C** — no screen shows a replaced figure | **Four of five criteria.** Both remaining emitters landed — `EditAccount.tsx:357` and `NewCategory.tsx:415`, the latter under `pages/forms/newCategory/`, not `editionAndDeletion/`. The deletion emitter is still absent and stays absent: deferred by the developer to the deletion block, registered as `R209` *(anchors re-measured 2026-08-30; the row read `EditAccount.tsx:313`)* |
> | **D** — one door for the amount | **Cancelled**, see the reversal below. Its surviving question — whether the write goes through the budget endpoint or the account `PATCH` — was closed by the code on 2026-08-23 in `8fba00e`, so this unit no longer holds a live decision |
> | **E** — the panel is actually modal | **Done and committed.** Criterion 4, which failed when driven on 2026-08-20, was fixed in `6c0a3c1`: `previouslyFocused = document.activeElement` is captured at `BudgetEditModal.tsx:228` before `inert` blurs it and restored at `:238` |
>
> **The one thing this document said was left is a CLOSED question, and the code
> closed it.** Unit D's — does the budget block write through the budget
> endpoint, leaving the account `PATCH` to stop carrying `budget`; or does the
> `PATCH` keep writing the amount and gain the
> conversion engine? — was closed on 2026-08-23 by `8fba00e refactor(budget):
> drop the editor budget write`. **The budget block writes through the budget
> endpoint, and the account `PATCH` no longer carries the budget.**
>
> **Evidence measured 2026-08-30.** The `category_budget` arm of
> `accountEditController.js` now carries the decision as an explicit comment: the
> budget is not edited there — it is a four-part decision (amount, currency,
> month and range) owned by the budget endpoint, and a budget key in that payload
> is ignored. The line anchors of the old text cited as proof of the opposite
> (`accountEditController.js:338-351`) no longer exist; that range holds the
> pocket-saving deadline logic today.
>
> **Both *Open decisions* of Group 1 are closed by the code:**
>
> - What control replaces the `Only this month` checkbox (`O3`) — **three named
>   tiles**, declared as data in `RANGE_MODES` at `BudgetEditModal.tsx:114-118`, over the
>   `RangeModeType` union at `:99`, so the three shapes `appliesUntil` can take are written
>   out rather than derived, and resolved to the payload at `:286-291`. Their labels were
>   wrapped in `a131ce4`. *(The tile anchor read `:96-101`; re-measured 2026-08-30.)*
> - Whether the control is offered on a past month (`O4`) — **no.** `canEdit`
>   gates it at `CategoryAccountList.tsx:113` and `CategoryDetail.tsx:158`, and
>   `ff1e36b` hides the icon rather than only disabling it *(the row read `:114` and
>   `:140`)*.

### Boundary with the neighbouring documents

| document | owns | this document does not touch it |
|---|---|---|
| `PLAN_BUDGET_V1.md` | **the specification.** §5.1.0 and §7.4 are the frozen contract | no contract change here. *(Amended 2026-08-18: the endpoint no longer matched. `d21e669` widened it and the spec had not been told; §5.1.0, §7.3, §7.4 and decision 48 were written to record what ships. This plan implements that spec, it does not amend it)* |
| `PLAN_BUDGET_FRONTEND.md` | the **read** path and presentation: §10.9 what remains of commit 9, §10.10 the month selector, §10.12 the level-2 row, §10.13 search and sort, §10.14 the level-3 row, and commit 10 | untouched. This document owns only the write |
| `PLAN_EDIT_BLOCK.md` | `EditAccount` and reaching it from `.icon3dots` | **unit D removes one field from it.** Cross-referenced there |

**One overlap to keep in sight.** Unit A.4 renders an exception marker on the
level-2 row under `nextMonthBudget !== budgetAmount`. That is the same condition
commit 8 (`feat(budget): show current month status`, V1 §7.2) uses for its second
line on the *card*. Different surface, same predicate — commit 8 stays where it
is and is not brought forward here, but whoever writes it should reuse the
condition rather than re-derive it.

---

## Context

The budget module has read since it was built and has never written from its own
screens. Every piece of the write path exists — endpoint, API client, response
type, store invalidator, modal component — and **nothing imports the modal**.

A budget *can* be edited today, but only through the account editor:
`EditAccount` renders the `budget` field of `categoryBudgetEditShema`
(`editSchemas.ts:60-62`), reached from `AccountingDashboard.tsx:398` through
`AccountActionsMenu`. That door cannot express the two cases the budget screen
owns — an amount of `0` ("stop budgeting") and a one-month exception — and
`accountEditController.js:113-115` says so in its own comment.

**Corrected 2026-08-30.** That comment is now at `accountEditController.js:105-107`, and
it says something stronger than the sentence above quotes it for: the budget is **not**
edited in that arm at all, because it is a four-part decision — amount, currency, month
and range — owned by `PUT /budget/accounts/:id/current`, and a budget key in the PATCH
payload is ignored. That is `8fba00e`, the closure the STATE block above records. The
three-door table that follows describes the state before it: the `EditAccount` row no
longer writes `cba.budget` or an allocation.

One amount, three doors, three rule sets:

| door | minimum | converts FX | writes `cba.budget` | writes allocation | frequency |
|---|---|---|---|---|---|
| `NewCategory` — POST | `> 0` | **yes** | yes | yes | recurring |
| `EditAccount` — PATCH | `>= 0.01` | no | yes | yes | recurring |
| modal — PUT | `>= 0` | no | **no** | yes | recurring **or one month** |

Intended outcome: **one door for the amount** — the modal — with the other two
reduced to what only they can do. The account editor keeps identity and nature;
creation keeps the opening amount and its FX conversion.

**Ruled out by measurement, needs no work:** allocations delete on cascade
(`createTables.js:385`, was `:376`); level 1 repaints itself because `BudgetLayout.tsx:32-34`
re-issues `fetchStatus` on mount; the FX columns are audit-only and block nothing
(`original_budget` has zero SELECTs, and migration `014` states `budget` is what
every read path sums). **No migration in this plan.**

---

## Decisions taken

| decision | resolution |
|---|---|
| `cba.budget` desynchronised by the PUT | the PUT writes it too, **only when `appliesUntil` is `'openEnded'`** *(was: only when `onlyThisMonth` is false — the same rule under the range contract)* |
| the `budget` field in `EditAccount` | comment it out, **after** the modal works |
| who invalidates on create / edit / delete | a second signal, `notifyAccountChanged` |
| no "remove budget" action | a named button with confirmation, inside the modal |
| `USE_NEW_BUDGET_SYSTEM` | **not implemented** — declared exception. **Its premise expired 2026-08-22**, see below |
| `handleSave` conflates two failures | one `try`; the refetch reports nothing of its own |
| no focus trap or scroll lock | `inert` on the background + scroll lock |

Three that need their reason on the record:

- **Only when recurring.** `cba.budget` is the standing monthly amount. A bounded
  change does not change the standing amount, so writing it there would make the
  dashboard state a figure that stops being true the month the range ends. Under
  the range contract *recurring* is exactly `appliesUntil === OPEN_ENDED`: it is
  the only branch with no far edge, and therefore the only one where the amount
  written is still in force a year from now.
- **No flag.** A flag protects when an old path stays alive and a new one may
  fail. Here there is no old path — today no control opens the modal, so the
  flag's "off" is identical to not wiring the control. This departs from
  `CLAUDE.md` and is recorded as a decision, not an omission.
  **Both premises expired — measured 2026-08-23.** A control does open the modal:
  `BudgetEditModal` is mounted by `EditAccount.tsx:629`, `CategoryDetail.tsx:466`
  and `CategoryAccountList.tsx:320`. And the code is no longer undeployed: the
  production deploy target `feat/vercel-serverless` merged the module on
  2026-08-22 (`7bb5a62`) and its tree is identical to `main`. The reasoning was
  sound when written; the situation it described no longer holds.
- **One `try` is enough.** `fetchStatus` catches its own error and does not
  rethrow (`useBudgetStatusStore.ts:107-117`), so `await fetchStatus()` never
  rejects. A failed refetch surfaces through the store's `error`, which level 2
  already renders at `:198-202`.

---

## Already built — do not rewrite

| symbol | file |
|---|---|
| `PUT /budget/accounts/:accountId/current` | `backend/.../routes/budgetRoutes.js:27` *(was `:26`)* |
| `setCurrentBudget` controller | `backend/.../controllers/budgetController.js:123` |
| `setCurrentMonthBudget` — owns the transaction, enforces the three 422s | `backend/.../services/budgetAllocationService.js:194` *(was `:239`)* |
| `writeAllocation` — the four steps of §5.1.0 | `backend/.../db/budgetAllocationRepository.js:135` *(was `:129`)* |
| `OPEN_ENDED`, `MONTH_PATTERN`, `currentBudgetBodySchema` | `backend/src/validation/zod/budgetValidators.js` |
| `fetchStatus`, `invalidate`, `referenceMonth`, `currentMonth` | `frontend/src/fintrack/stores/useBudgetStatusStore.ts` |
| `normalizeError(error) → { message, status }` | `frontend/src/fintrack/helpers/normalizeError.ts:4` |
| `notifyTransactionRecorded` / `onTransactionRecorded` | `frontend/src/fintrack/stores/transactionEvents.ts` |
| `BudgetEditModal` — form, context figures, checkbox, buttons | `pages/budget/components/budgetEditModal/BudgetEditModal.tsx` |
| its stylesheet | `.../budgetEditModal/styles/budgetEditModal-styles.css` |

An earlier session implemented this plan without being asked and it was reverted
in full, hand-reverts included. The modal and its stylesheet are the pre-session
versions: no `result` state, no confirmation branch, no
`.budgetEdit__confirmation` block.

**Built against the dead contract — rewire, do not reuse as-is** *(measured
2026-08-18)*. These three are the whole of A.0:

**A.0 has since landed — re-measured 2026-08-30, and none of the four rows below still
describes the tree.** `setCurrentBudget` at `frontend/src/fintrack/api/budgetApi.ts:61`
takes the three fields as one object, with the comment at `:56` giving the reason A.0.2
gave; `BudgetWriteResponse` at `budgetTypes.ts:38` carries `overwrittenMonths: string[]`
at `:62` and no `onlyThisMonth`; and the modal's checkbox is the three-tile control
recorded in the STATE block. The table is kept as the record of what A.0 had to change.

| symbol | file | what is stale |
|---|---|---|
| `setCurrentBudget(accountId, amount, onlyThisMonth)` | `frontend/src/fintrack/api/budgetApi.ts:57` | sends `{ amount, onlyThisMonth }`; the server 400s on the unknown key and on the two missing ones — the schema is `.strict()` |
| `BudgetWriteResponse` | `frontend/src/fintrack/types/budgetTypes.ts:17` | declares `onlyThisMonth: boolean` and a non-null `restoresFrom`; the server sends `appliesUntil` and `overwrittenMonths`, and nulls both restore fields on an open-ended save |
| the URL comment | `frontend/src/urlConfig.ts:199` | states the old body |
| `BudgetEditModal` — checkbox, `onSave` signature, header lines 12-14 | `pages/budget/components/budgetEditModal/BudgetEditModal.tsx` | header says *"It writes the CURRENT month, always … the payload has no field for any other"*, which is now false in both halves |

**`onlyThisMonth` survives in one tracked file**,
`docs/budget/BUDGET_MODULE_TECHNICAL_GUIDE.md`. That file is committed, so its
correction is its own `docs(budget)` gate and it goes **after** the code, not
before: a guide corrected ahead of the screens would describe a module that does
not exist yet.

---

## Order

| unit | depends on |
|---|---|
| **A — Change the amount of a budget from its own screen** | — |
| **B — Stop budgeting an account** | A |
| **C — No screen shows a replaced figure** | — |
| **D — One door for the amount** | A |
| **E — The panel is actually modal** | A |

A is the spine. C is independent and can go first or last. D must not go before A
or no door is left for changing an existing budget.

---

# A — Change the amount of a budget from its own screen

**The broken function.** The module cannot write. There is no control at any
level, so the amount can only be changed from the account editor, which cannot
express an exception; and when the PUT is finally called, it writes the
allocation and leaves `cba.budget` behind, so the accounting dashboard and the
budget screens start disagreeing.

**Complete when all of these hold** *(list revised 2026-08-18 for the range
contract; 5, 6 and 9 changed)*:

1. A control on levels 2 and 3 opens the modal over the account it belongs to.
2. The control is `disabled` on a past month and says why — see **O4**, which is
   what decides whether this line survives the unit.
3. Saving writes the month, and the row on screen shows the new figure without a
   manual reload.
4. Returning to level 1, the hero already carries the new figure.
5. Saving a **bounded** range prints which month the budget returns to, and what
   it returns to. Saving an **open-ended** one announces nothing, because it
   terminates nothing.
6. The account saved with a bounded range carries a marker in the list; the
   open-ended one does not.
7. The accounting dashboard shows the same figure as the budget screen for the
   same account.
8. A write that fails leaves the form open with the reason; a refetch that fails
   does not claim the write failed.
9. **A save that would delete decisions already stored says so before writing.**
   `overwrittenMonths` is what makes this answerable, and the open-ended branch
   is what makes it necessary.

### A.0 — the frontend speaks the range contract

**New 2026-08-18. Nothing below A.0 can be verified until it lands**: every FE
symbol on the write path was typed against `{ amount, onlyThisMonth }`, and the
server's schema is `.strict()`, so today's `setCurrentBudget` is not a stale call
that half-works — it is a guaranteed 400.

**A.0.1 — `types/budgetTypes.ts`.** `BudgetWriteResponse` loses `onlyThisMonth`,
gains `appliesUntil: string` and `overwrittenMonths: string[]`, and
`restoresFrom` becomes `string | null` — it is null on every open-ended save,
which the flag version could not produce. A second type for the request body,
named for what it is rather than for the function that sends it.

**A.0.2 — `api/budgetApi.ts` and `urlConfig.ts`.** `setCurrentBudget` takes the
three fields as one object, not three positionals: two of them are month strings
of the same shape, and positional arguments of the same type in a row is how a
caller swaps them without the compiler noticing. **No default parameter** — the
server refuses to guess and so does this, for the reason decision 48 gives.

**A.0.3 — `BudgetEditModal.tsx`.** `onSave` re-signed; the checkbox replaced by
whatever **O3** settles; header lines 12-14 rewritten — they currently state the
opposite of what the endpoint does. `initialOnlyThisMonth` keeps its job under a
new name: `nextMonthBudget !== currentAmount` still means *this month is already
bounded*, so the form must not open on the option that would silently make it
permanent.

### A.1 — the backend mirror

`backend/.../services/budget_services/services/budgetAllocationService.js`

Inside `setCurrentMonthBudget` (`:239-309`), between `writeAllocation` and
`COMMIT`, on the same `client`. **Measured 2026-08-18: no runtime statement
anywhere in the backend writes `cba.budget` for this endpoint** — the only two
`UPDATE category_budget_accounts` in the tree are migrations `011` and `013`,
and the account editor writes the column through its generic field builder
(`accountEditController.js:124`), not through this service. There is no
double-write to avoid here; there is a missing write.

**Corrected 2026-08-30 — the second half of that sentence is no longer true.** The
account editor writes no budget at all: the `category_budget` arm at
`accountEditController.js:104-107` states that the amount is owned by
`PUT /budget/accounts/:id/current` and that a budget key in the PATCH is ignored
(`8fba00e`). The missing write this unit named is the one that shipped — it is at
`budgetAllocationService.js:278-282`, guarded by `appliesUntil === OPEN_ENDED` exactly as
the block below specifies. What the correction does not change is the reason the mirror
sits in the service and not in `writeAllocation`: the creation controller still writes
`cba.budget` with its FX conversion on its own path.

```js
 const normalizedAmount = normalizeAmount(amount);

 const written = await writeAllocation(
  client,
  accountId,
  normalizedAmount,
  month,
  appliesUntil === OPEN_ENDED ? null : appliesUntil,
 );

 // cba.budget is the standing monthly amount, which is what the accounting
 // dashboard sums. Only an open-ended save has no far edge, so it is the only
 // one whose amount is still in force after the range would have expired.
 if (appliesUntil === OPEN_ENDED) {
  await client.query(
   `UPDATE category_budget_accounts SET budget = $1 WHERE account_id = $2`,
   [normalizedAmount, accountId],
  );
 }
```

Normalizing once into a const rather than twice: the mirror and the allocation
must store the same number, and two calls to the same rounding function is two
places for that to stop being true.

**Not** inside `writeAllocation` (`budgetAllocationRepository.js:129`): that
routine is also called by `applyAllocationForAccount`, whose controller already
writes `cba.budget` at `accountEditController.js:124`, and by
`createAllocationForAccount`, whose controller writes it with its FX conversion
at `accountCategoryCreationcontroller.js:302`. Mirroring there would double-write
on both paths and put a legacy concern inside the §5.1.0 routine. The transaction
is already owned by `setCurrentMonthBudget`, so the mirror rolls back with the
allocation.

**Known and accepted: the mirror is blind to a past month.** A save with
`month` in the past and `appliesUntil` open-ended is in force today, so the
standing amount did change and the mirror is right. A save with `month` in the
past and a bounded end that expires *before* today also changes what is in force
today — and the mirror does not run. That case is unreachable from the screen
this plan builds, because the form's first month is the month on screen and the
screen cannot show a month whose range has already closed. It is registered, not
fixed: fixing it means re-resolving the amount in force at the current month
after the write, which is a second read on every save to correct a case no
control can produce.

### A.2 — `pages/budget/components/budgetEditModal/EditBudgetIcon.tsx` — new

Both levels render the same control, so the glyph cannot live inside either.
Drawn as JSX and not imported: Vite types an `.svg` import as a string, so an
icon cannot travel as a component (R34) — the same reason
`BudgetListControls.tsx:59` draws its own. No `width`/`height` on the `<svg>`;
each caller's stylesheet sizes it.

### A.3 — `pages/forms/categoryDetail/CategoryAccountList.tsx` — level 2

Owns the modal. The list below takes `accounts` as a prop and its comment at
`:161-163` states the parent owns loading, error and empty; request state follows
the same line.

```ts
const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);

const currentMonth = useBudgetStatusStore((state) => state.currentMonth);
const invalidate = useBudgetStatusStore((state) => state.invalidate);
// referenceMonth and fetchStatus are already selected in this file.

// 'YYYY-MM-01' text on both sides, so >= compares them correctly. No new Date():
// that string parses as UTC midnight and renders the previous month west of
// Greenwich, which is the defect the module removed.
const canEdit =
 referenceMonth !== null && currentMonth !== null && referenceMonth >= currentMonth;

// Read back out of the payload rather than copied into state when the modal
// opens: after a save the row is refetched, and a copy would keep showing the
// figures the write replaced.
const editingAccount =
 categoryAccounts.find((account) => account.accountId === editingAccountId) ?? null;
```

`handleSave({ amount, month, appliesUntil })` *(re-signed 2026-08-18)*:

1. `setIsSaving(true)`, `setSaveError(null)`
2. `await setCurrentBudget(editingAccount.accountId, { amount, month, appliesUntil })`
3. on rejection `setSaveError(normalizeError(err).message)` and return `null`
4. on success `invalidate()`, then `await fetchStatus(month ?? undefined)`, and
   return the response
5. `setIsSaving(false)` in `finally`

Step 4 must **not** close the modal: the modal is what decides whether there is a
confirmation to render, and closing here makes that branch unreachable.
`invalidate()` before `fetchStatus` is required — `fetchStatus` refuses a month
already in `loadedMonth` (`useBudgetStatusStore.ts:84`), so without dropping the
memo the refetch is a no-op and the screen keeps the figure just replaced.
`month ?? undefined`, never a month computed here (`budgetApi.ts:27-30`).

Mount the modal **outside** `<section>`, beside where level 3 mounts its
transaction modal: the board is a frame with its own scroll
(`categoryDetail-styles.css:61`), and a panel inside it would scroll with the
list instead of over it.

```tsx
{editingAccount && (
 <BudgetEditModal
  accountName={editingAccount.subcategory ?? editingAccount.accountName}
  month={referenceMonth ?? ''}
  currency={editingAccount.currency}
  currentAmount={editingAccount.budgetAmount}
  nextMonthBudget={editingAccount.nextMonthBudget}
  actualSpent={editingAccount.actualSpent}
  remainingBudget={editingAccount.remainingBudget}
  isSaving={isSaving}
  error={saveError}
  onClose={closeEditor}
  onSave={handleSave}
 />
)}
```

`accountName` is the subcategory, not the composed account name: that is the
label the row shows, and the panel has to name the row that was pressed.
`closeEditor` clears both `editingAccountId` and `saveError`. Pass
`onEditAccount={setEditingAccountId}` and `canEdit={canEdit}` down.

### A.4 — `pages/forms/categoryDetail/ListAccountOfCategory.tsx`

Two new props on `ListAccountOfCategoryProp`:

```ts
onEditAccount: (accountId: number) => void;
canEdit: boolean;
```

Add `nextMonthBudget` to the per-row destructure at `:193-200`.

The control goes in the first `BoxRow` and **outside** the `<Link>` that wraps
the name — a button nested in an anchor is invalid markup and the click would
navigate instead of opening the modal.

```tsx
<button
 type='button'
 className='budgetDetail__editBudget'
 onClick={() => onEditAccount(accountId)}
 disabled={!canEdit}
 aria-label={`Edit budget for ${subcategory ?? accountName}`}
 title={canEdit ? 'Edit budget' : 'Only the current month can be edited'}
>
 <EditBudgetIcon />
</button>
```

It cannot be a third child of the `BoxRow`: `.box-row` is
`justify-content: space-between` (`boxComponents.css:15-20`), so a third child
pushes the spent/budget pair to the middle of the line. The pair and the button
travel together in a `.budgetDetail__rowAmounts` wrapper, keeping the row at two
children.

The exception marker goes inside the existing `.box__subtitle` of the second
`BoxRow`, after the `left`/`over` word — that is the sentence it qualifies, and
it keeps `.flx-row-sb` at two children for the same reason:

```tsx
{nextMonthBudget !== budgetAmount && (
 <span className='budgetDetail__exception' title='This amount applies to this month only'>
  this month only
 </span>
)}
```

The comparison is on the two amounts, not on whether a row exists at M+1 — the
condition `budgetTypes.ts:63-65` documents, and the same predicate commit 8 uses
for §7.2's second line on the card.

### A.5 — `pages/forms/categoryDetail/CategoryDetail.tsx` — level 3

One account. Same three state hooks, the same `canEdit`, the same `handleSave`,
over the `budgetAccount` it already holds at `:95-98`. A boolean instead of an
id: there is one account, so the flag has no row to name. `fetchStatus` takes
`monthParam`, this screen's own URL parameter.

The control and the marker sit **beside** `SummaryDetailBox`, not inside it: that
component is rendered by two screens and only one writes a budget. Wrap the box
in `.budgetDetail__summary` and put both in a `.budgetDetail__summaryActions` row
under it — inside, they would compete with a surface that is already a
`space-between` of its own (`summaryDetailBox-style.css:3-12`).

### A.6 — `pages/forms/categoryDetail/styles/categoryDetail-styles.css`

1-space indentation, matching the file.

- `.budgetDetail__rowAmounts` — flex row, `--space-2` gap.
- `.budgetDetail__summary` / `.budgetDetail__summaryActions` — level 3's column
  and its right-aligned action row.
- `.budgetDetail__editBudget` — five states: default, `:hover`,
  `:focus-visible` (2px ring, 2px offset), `:active`, `:disabled`
  (`opacity: 0.5; pointer-events: none`). Box from `--size-control-sm`, glyph
  from `--font-size-base`. Trade-off to accept: `pointer-events: none` makes the
  `title` explaining *why* it is disabled unreachable with a pointer. It stays
  exposed to assistive technology, and the month badge above the list already
  states which month is on screen.
- `.budgetDetail__exception` — `--font-size-2xs`,
  `--color-content-on-dark-subtle`, `--radius-full`, `white-space: nowrap`. Two
  declarations it cannot inherit: `font-size`, because `index.css` sets one on
  the universal selector; and `text-transform: none`, because it sits inside
  `.box__subtitle`, which capitalises every word and would print "This Month
  Only".
- The `transition` ships its `@media (prefers-reduced-motion: reduce)` block.
- `--radius-lg` is not used: `tokens.css:168-175` records it as a collision a
  lazy chunk overwrites for the rest of the session.

### A.7 — the confirmation, in `BudgetEditModal.tsx`

The unit is not complete without it: an exception changes what happens *next*
month and nothing on screen would say so. No caller changes — `onSave` already
carries the response through its signature, which `:126-131` states is why.

```ts
const [result, setResult] = useState<BudgetWriteResponse | null>(null);
```

`handleSubmit` reads what `onSave` resolves with. `null` is a failed write — the
caller states the reason through `error` and the form stays open. Otherwise the
**server's** `restoresFrom` decides, not the option that was sent: a month stores
the response, `null` calls `onClose()`, because an open-ended save terminates
nothing and has nothing to announce. *(Amended 2026-08-18: this read
`onlyThisMonth` from the response, which the range contract removed.
`restoresFrom` is the same fact stated by the field that survived — it is
non-null exactly when the range has a far edge.)*

When `result` is set, the form is replaced by one sentence built from
`budgetAmount`, `budgetMonth`, `appliesUntil`, `restoresFrom` and `restoresTo`,
and Save/Cancel by a single Close. Months go through the existing `formatMonth`
helper (`:56-64`), which builds a date from the string parts. The sentence names
**both** ends when they differ — `budgetMonth` and `appliesUntil` were one month
under the flag and can now be twelve apart, so a confirmation that names only the
first states a third of what was written.

**The blocking half — new, and it is completion item 9.** A confirmation that
arrives *after* the write cannot stop a destructive one. `overwrittenMonths`
comes back with the response, which is too late for the branch that needs it, so
the warning cannot be built from it: it has to be built from what the form
already knows. An open-ended save over a row whose `nextMonthBudget` differs from
`currentAmount` is, by that same comparison the marker uses, a save that will
delete a decision already stored. That is the state the form asks about before
sending. `overwrittenMonths` then reports what actually went, which is the
audit, not the guard.

Two consequences to handle:

- `handleOverlayClick` must close unconditionally once `result` is set. It
  currently refuses on `isDirty`, and after a save the typed string still differs
  from `currentAmount` for any input like `60.00`.
- The Save button unmounts with the form, so focus falls to the body — outside a
  panel declared `aria-modal`. An effect on `result` returns focus to `panelRef`.

`.budgetEdit__confirmation` and `.budgetEdit__confirmationText` go in the
stylesheet. No `line-height`: there is no line-height token and `CLAUDE.md`
forbids inventing one.

---

# B — Stop budgeting an account

> **Driven 2026-08-20 — built, uncommitted, all four criteria pass.** Verified
> in the running app at level 2 (`/fintrack/budget/category/aseo hogar`, account
> `esponjas / Must`, budget $50.00) over CDP:
>
> | # | criterion | observed |
> |---|---|---|
> | 1 | a named control expresses the removal | the action row is `Remove budget` (danger) · `Cancel` · `Save`, in that order |
> | 2 | it asks for confirmation before writing | the first click swaps the whole trio for `Keep budget` / `Remove budget`; the list still read `$56.99 / $50.00` at that point, so nothing was written |
> | 3 | after it, still listed, zero figure, no budget | row became `$56.99 / $0.00 · $56.99 over · —`. The percentage is a dash, not `0`, matching §10.3's `executionPercentage: null` |
> | 4 | not offered when there is no budget | reopening the panel at $0.00 gives `Cancel` · `Save` only |
>
> The confirmation read *"$0.00 applies from August 2026 onwards. 1 later month
> replaced."* — open-ended, which is what `handleRemove` intends. The $50.00 was
> written back afterwards and the row is byte-identical to before the test.

**The broken function.** The backend reserves `0` for this and says so twice
(`budgetValidators.js:96`, `accountEditController.js:113-115`), and no control
sends it. *(Anchors re-measured 2026-08-30: the non-negative amount is
`budgetValidators.js:129`, and the account editor's statement is
`accountEditController.js:105-107`.)* "Stop budgeting" exists in the contract and nowhere in the interface.
Typing `0` in the field works, but nobody reads a zero as a decision.

**Complete when:**

1. A named control expresses the removal — not a value the user has to infer.
2. It asks for confirmation before writing.
3. After it, the account is still listed, with a zero figure and no budget.
4. It is not offered when there is no budget to remove.

**Spec.** A third button in `.budgetEdit__actions`, `Remove budget`, which
confirms inside the panel and then calls the same `onSave` with `0`. No new
endpoint, no new prop on the caller. Hidden when `currentAmount` is already `0`.

The asymmetry with creation is intended and stays: creation refuses `0`
(`accountCategoryCreationcontroller.js:87`, with its reason at `:75-76`; the row read
`:86-87`) because an account is not created without a budget, but an existing one can
stop having one.

Two render states, per §10.3's withdrawn correction: `budgetAmount > 0`, and
`budgetAmount === 0` with `executionPercentage: null` rendering `—` and no bar.
A removed budget is the second, and it is byte-identical to an account that never
had one. Nothing should try to tell them apart.

---

# C — No screen shows a replaced figure

> **Measured 2026-08-20 — three of five emitters in place, and the unit can no
> longer close as written.** `transactionEvents.ts` carries the
> `notifyAccountChanged` / `onAccountChanged` pair, `useBudgetStatusStore.ts` is
> subscribed to it beside `onTransactionRecorded`, and `EditAccount.tsx:313`
> emits after a successful PATCH. `NewCategory.tsx` does not emit, and neither
> does the deletion path.
>
> **The deletion emitter is deferred by developer instruction, 2026-08-20** —
> the deletion path is not touched by the budget close and gets its own block.
> It is registered as **R209**, beside **R208** (the page reads its account from
> router `state` with no fallback) and **R210** (the by-id endpoint serves no
> `currency_code` for basic account types).
>
> **Consequence, stated rather than hidden:** completion criterion 2 — *deleting
> one and returning shows it gone* — cannot be met in this module. C closes with
> four of its five criteria, or it waits for the deletion block. That is a
> decision for the developer, not something this document can resolve.


**The broken function.** The budget store drops its memo only on
`notifyTransactionRecorded`, which five tracker screens emit. Creating, editing
or deleting a budget account changes the server and emits nothing. Both
`NewCategory` and `AccountDeletionPage` return to `previousRoute`, so entering
from budget lands back on a stale list with the deleted account still in it.

This is the same class of defect as R53, which `d7cd81d` fixed for tracker
writes. `LEARN_CACHE_INVALIDATION.md` is the write-up: writer signals, reader
re-reads.

**Complete when:**

1. Creating a budget account and returning to budget shows it.
2. Deleting one and returning shows it gone.
3. Editing an account from the dashboard and navigating to budget shows the edit.
4. None of the three requires a manual reload.
5. `transactionEvents.ts` still imports nothing.

**Spec.**

| file | change |
|---|---|
| `stores/transactionEvents.ts` | add `notifyAccountChanged` / `onAccountChanged`, same shape as the pair already there |
| `stores/useBudgetStatusStore.ts` | subscribe: `onAccountChanged(() => …invalidate())`, beside the existing `onTransactionRecorded` block |
| `editionAndDeletion/.../NewCategory.tsx` | emit after a successful create |
| `editionAndDeletion/.../EditAccount.tsx` | emit after a successful save |
| `editionAndDeletion/.../AccountDeletionPage.tsx` | emit after a successful delete |

Payload-free and consumer-agnostic, matching the design the module's own header
states. The three emitters import only the notifier, never a store of the budget
module.

---

# D — One door for the amount

> ## 🛑 REVERSED BY THE DEVELOPER — 2026-08-19
>
> **This unit as written below is cancelled. Do not implement it.**
>
> The developer's instruction, given more than once and reaffirmed on 2026-08-19:
> **`EditAccount` edits the whole account, and that includes the budget.** The
> amount does not leave the form. The editor gains a **budget edit block** — the
> existing `BudgetEditModal` mounted as a component inside the account edition
> module, not a bare field.
>
> **What survives of this unit is its diagnosis, not its remedy.** The defect it
> measured is real and still has to be fixed: the account editor writes
> `cba.budget` and leaves `original_budget`, `exchange_rate` and the rate source
> at their creation values, so after one edit the row states an origin that never
> happened. This unit's answer was "remove the field, it is cheaper". The
> developer's answer is the option this unit dismissed — give the editor the
> conversion engine — but reached without duplicating it: the block writes
> through the endpoint that already has it.
>
> **Measured 2026-08-19, and it strengthens the reversal.** The editor is not a
> second writer of `cba.budget` alone. `accountEditController.js:343-351` already
> writes the allocation too, on the transaction's client and in the user's zone.
> What it lacks is not a writer — it is the conversion and the `appliesUntil`
> range, both of which `PUT /budget/accounts/:accountId/current` already has.
>
> **CLOSED by the code on 2026-08-23:** does the block write through the budget
> endpoint, leaving the account PATCH to stop carrying `budget` — or does the
> PATCH keep writing the amount and gain the conversion engine? Resolved in
> favour of the budget endpoint by `8fba00e refactor(budget): drop the editor
> budget write` — the block writes through the endpoint, and the account PATCH
> stopped carrying the budget.
>
> Sections that cross-reference this unit and must be re-read against that closed
> answer: the dependency table at `:34`, the order table at `:154`, the question
> on the shape of the write at `:753` (Q5), and `PLAN_EDIT_BLOCK.md`'s boundary
> block for the same question (Q8).

**The broken function.** Two forms write one amount under two rule sets — `≥0.01`
always recurring against `≥0` with an exception — so a rule learned on one screen
is violated on the other. And the account editor breaks the FX audit pair: it
writes `cba.budget` and leaves `original_budget`, `exchange_rate` and the rate
source at their creation values, so after one edit the row reads `budget = 200`,
`original_budget = 100`, `exchange_rate = 1.0`. Fixing that inside the editor
means giving it the conversion engine only the creation controller has; removing
the field is cheaper and more correct.

**Complete when:**

1. The account editor for a `category_budget` account shows five fields, no
   amount, and saves without touching the budget.
2. The amount of an existing budget can only be changed from the budget screen.
3. `pocket_saving` and `debtor` editors are unaffected.
4. `cba.budget` still has a writer for recurring changes — which is unit A.1, and
   is why this unit cannot go first.

**Spec.**

| file | change |
|---|---|
| `validations_zod/accountEditSchema.ts:89-99` | comment out the `budget` element of the `category_budget` field array |
| `validations_zod/editSchemas.ts:60-62` | comment out the `budget` key of `categoryBudgetEditShema` |

Both, or validation breaks: the key is **non-optional on purpose** — the comment
above it records that an emptied field must fail there, because the PATCH would
otherwise omit the budget and report the save as successful. That comment is
commit 7's (`503f9b8`, F-5), so this unit undoes a rule by removing the field it
guarded, not by weakening it.

Per D13 the two blocks are commented, not deleted, each with a line naming why
and the cleanup block that will remove them. The six account types map to four
schemas at `editSchemas.ts:89-97`; only `category_budget` carries a budget, so
nothing else is touched.

**Cross-reference:** `PLAN_EDIT_BLOCK.md` owns `EditAccount`. This unit changes
which fields it renders for one of six account types and nothing else — not its
layout, not its route, not the `.icon3dots` that reaches it.

---

# E — The panel is actually modal

> **Driven 2026-08-20 — built, uncommitted, three of four criteria pass.**
> Verified in the running app at level 2 over CDP:
>
> | # | criterion | observed |
> |---|---|---|
> | 1 | Tab cycles inside the panel | passes. `#root` carries `inert` while the panel is open, and its 14 focusables are all inside it; the panel's 7 are not, because it is portalled to `body` |
> | 2 | the list does not scroll behind the panel | **passes.** With the panel closed a trusted wheel at the list's centre moved it 0 → 47.2px, its full room; with the panel open the same wheel at the same point left it at 0 |
> | 3 | a screen reader does not reach the background | passes, same `inert` |
> | 4 | closing restores focus and scroll | **fails on focus.** The pencil was focused before opening; after `Escape`, `document.activeElement` is `BODY`. Nothing captures `document.activeElement` on mount, so only the scroll is restored |
>
> **Correction to this unit's spec.** It expected the risk to be the level-2
> board's own scroll through `.home__layout:has(.budgetLayout)`. That container
> is not mounted at level 2 at all — the scroller there is
> `article.list__main__container.categoryList`, `overflow-y: auto`. So
> `document.body.style.overflow = 'hidden'` is a no-op on this screen and is
> **not** what holds the lock; the fixed overlay at `inset: 0` intercepting the
> wheel is. The lock works, for a different reason than the one written down.

**The broken function.** The panel declares `aria-modal='true'`
(`BudgetEditModal.tsx:512`, was `:143`; re-measured 2026-08-30), which promises assistive
technology that the background is unreachable. It is not: Tab leaves the panel for the list's links,
and the list scrolls behind. The attribute states something false.

**Complete when:**

1. Tab cycles inside the panel and never reaches the rows behind.
2. The list does not scroll while the panel is open.
3. A screen reader does not reach the background.
4. Closing restores focus and scroll to where they were.

**Spec.** `inert` on the content container does the work of a focus trap and of
click blocking in one declaration — no Tab handler. Its browser support matches
`:has()`, which this module already requires (`categoryDetail-styles.css:60`).
The scroll lock has to be verified against the level-2 board, which administers
its own scroll through `.home__layout:has(.budgetCategoryBoard)`; that
interaction is the only thing in this unit that can surprise.

---

## Out of scope

- **Level 1** (`ListCategory.tsx`) — no control, no marker.
  `BudgetCategoryStatus` (`budgetTypes.ts:93-103`) carries neither `accountId`
  nor `nextMonthBudget`, and folding an exception across a category would state
  one for a group that may hold several. It needs no refresh either:
  `BudgetLayout.tsx:32-34` re-issues `fetchStatus` on mount, and levels 2 and 3
  are routes declared beside the layout, so returning remounts it. Level 1's
  markup and layout are frozen per §10.12.4.
- **`SummaryDetailBox.tsx`** — shared by two screens; the control sits beside it.
  Its optional-prop change is §10.9.4's, not this document's.
- **Retiring `cba.budget`** — seven consumers, three outside the budget module,
  and the column is a monthless scalar the allocation cannot replace without
  giving every reader a reference month. Expand → migrate → contract; this plan
  is only the expand half. The contract half is the cleanup block (V1 §9.4).
- **The FX columns** on either table.
- **`MonthPicker`** — `:78` caps `maxDate` at `currentMonth`, so no future month
  is selectable and `canEdit`'s `>` half is unreachable by design.
- **The three-dots** on budget, pockets, debtors and saving goals. They stay
  inert; this plan adds its own control and does not touch them.
- **Commit 8, commit 10, search and sort** — `PLAN_BUDGET_FRONTEND.md`'s.
- **Migrations** — none.

## Registered, not fixed here

| finding | where |
|---|---|
| `id='edit'` duplicated across six screens | levels 2 and 3 and four detail pages |
| the commented `<Link to='edit'>` is relative and would 404 | the edit route is flat: `App.tsx:376` |
| `original_budget` goes stale after an account edit | ~~`accountEditController.js:338-351`~~ — that range holds the pocket-saving deadline logic today. The editor stopped writing the budget in `8fba00e`, so the FX pair is no longer left false by an edit; the finding is closed, and the STATE block above is where it is recorded |
| the exception marker's meaning on a past month | display-only, no write involved |

---

## Open decisions around this plan, evaluated

**Written 2026-08-18.** None of these is a decision *this* plan takes — its own
seven are settled above in *Decisions taken*. The table exists because the
session that executes A–E has to know what is waiting around it and what is not.

**Grouped by what each one blocks, and each row names the document that owns it.
A resolution is written there, not here.** This section is a map, not a second
register.

### Group 1 — blocks starting A–E

| # | decision | option and what it buys | the other option and what it costs | recommendation |
|---|---|---|---|---|
| **O1** | Where execution starts | **A first.** A is the spine: B, D and E each name it as their dependency and A itself waits on nothing | **C first.** *Order* declares C independent, so it is legal — but C's whole subject is *"no screen shows a replaced figure"*, and the only writer that replaces a figure is A. Shipped first, C cannot be observed, only argued | **A, beginning at A.1.** The backend mirror first, because A.3 onward assume the `PUT` already leaves `cba.budget` consistent. C becomes verifiable the moment A exists, so it moves from *independent* to *cheap* rather than the reverse |
| **O2** | The unlabelled level-1 hero figure — `NEXT_SESSION.md` §D row 1 | **Before A, own commit.** `.total__amount` (`BudgetBigBoxResult.tsx:104`) prints `$158.36` with no label while the two figures under it carry one, so the largest number on the screen is the only one that does not say what it is | **After A–E.** Nothing interleaves and the plan runs uninterrupted — but A.3's refetch and A.7's confirmation both make that hero repaint more often, so the unlabelled figure gets *more* exposure during the very work that would hide it | **Before A.** It is a defect in what the number states, not in how it looks. The finding sits on the hero, which §10.12.4's level-1 freeze does not cover — the freeze is the row and the layout |

**O2 was two findings when this table was written; `e1449f7` closed the first.**
The hero no longer prints a bare percentage: `BudgetBigBoxResult.tsx:69-80` now
parenthesises it and `budgetRemainWord` supplies the `over`/`left` in front of
it, so the screen reads `Remaining ■ $100.99 over (63.8%)`. Measured on
`/fintrack/budget?status=over` on 2026-08-18.

**The unlabelled figure — closed 2026-08-18, no action.** Reviewed again with
the developer: `BudgetLayout`'s `TitleHeader` + `MonthPicker` already identify
the figure as the month's budget; the label is not forced only for symmetry
against `Spent` / `Remaining` inside the same card. O2 is fully closed — A
starts at A.1 with nothing ahead of it.

### O3 — what control replaces the `Only this month` checkbox

**Opened 2026-08-18 by `d21e669`. Blocks A.0.3 and nothing before it.** The
checkbox had two positions because the payload had two values. `appliesUntil` has
three shapes — this month, a month the user names, no end — and a checkbox cannot
say the middle one. `month` is not part of this decision: it is the month already
on screen, and the form does not offer to change it.

| option | what it buys | what it costs |
|---|---|---|
| **(a) Keep the checkbox** — ticked → `appliesUntil = month`, clear → `openEnded` | Nothing new to build. The module becomes writable in one commit | **The range the backend just gained stays unreachable.** *Until December* still cannot be said from any screen, which is the half of *"budget and frequency"* the project set out to close |
| **(b) A radio group of three**, the middle one revealing a month selector | Says all three things, in the user's words. It is what the contract describes | A **forward-looking** month selector, which does not exist: `MonthPicker.tsx:78` caps `maxDate` at `currentMonth`, because it was built for a read path with no future. It needs `minDate`/`maxDate` as props |
| **(c) Two options plus a count of months** — *for N months* | No picker. `appliesUntil = month + (N − 1)` | The client computes a month bound. It is string arithmetic on `YYYY-MM` and touches no timezone, so invariant 10 survives — but *"for 5 months"* is a worse question than *"until which month"* for a user thinking of December, and it puts in the client a formula the server already owns |

**Recommendation: (b).** It is the only one that delivers what the endpoint was
widened for, and its cost is a refactor that is owed anyway — `MonthPicker` is
capped at the current month because it has only ever served reads, and the
pending list already names *"it must serve write too"*. (a) is not a smaller
version of (b), it is a different capability, and choosing it means the range
lands as a second pass over the same modal.

**One consequence to accept with (b):** the selector's upper bound is a business
rule nobody has stated. With no ceiling a user can write a terminator in 2099.
The bound is not invented here — it is the question the developer answers when
approving this row.

### O4 — is the control offered on a past month

**Opened 2026-08-18.** Completion item 2 says `disabled` on a past month. That
line was written when the endpoint could only write the current one; it now
accepts any month from the account's start month to the current one, both
inclusive, and answers 422 outside that band. The restriction is now a choice the
screen makes, not a limit it reports.

| option | what it buys | what it costs |
|---|---|---|
| **(a) Stay disabled on past months** | Every comment in A.3 and A.4 stays true. `canEdit` is one comparison | A budget mis-entered in June can never be corrected, and the server would have accepted the correction |
| **(b) Enabled back to the account's start month** | The screen matches the endpoint. Correcting history is what a past month is for | Editing a past month changes an execution percentage the user has already read — and an **open-ended** save dated June deletes every decision from July onward, the most destructive thing this endpoint can do |

**Recommendation: (b), but not before A.7.** The cost of (b) is entirely the
unguarded destructive branch, and A.7 is the commit that builds the guard. Order
resolves it without giving anything up: ship A.3–A.6 with `canEdit` as written,
then widen it in the same commit that adds the blocking confirmation. Enabling
past months first would ship the destruction and the warning in that order.

### Group 2 — blocks closing the module, not A–E

| # | decision | option and what it buys | the other option and what it costs | recommendation |
|---|---|---|---|---|
| **V1** | ~~Verifying the amber `Near limit` square (NL-75, 75%)~~ — **CLOSED 2026-08-21, by measurement, not by seeding** | Measured read-only against local: **two categories already sit in the band.** `#23 verduras/acelga/need` at 79.5% (43.71 of 55.00) and `#33 dairy/yogurt/need` at 75.2% (4.00 of 5.32). The screen read on 2026-08-17 held 12.4%, 53.1%, 246.7% and 700%; transactions have moved since. | — | **Nothing to seed.** Open the budget list and look at those two rows. |
| **C1** | ~~Did *"esto"* include the column headers~~ — **CLOSED 2026-08-21, by measurement, not by an answer** | The four headers ship in `5352ad2` `feat(budget): label the four cells of a row`: `Category List` / `Spent / Budget` on the first row, `Remaining over / left` / `% of spent budget` on the second, rendered through `CardTitle`'s legend, subtitle and subLegend slots from `Budget.tsx:46-52` and `CategoryAccountList.tsx:279-285`. `CardTitle.tsx` and `styles/cardTitle.css` are both tracked. | — | **Nothing to ask.** The gate this row reserved over `CardTitle.tsx` was already spent. |
| **Q-D** | ~~The yearly accumulated figure~~ — **AMENDED and BUILT 2026-08-21** | The plan said serve it from `/series`. **`/series` is per account** — `GET /budget/accounts/:accountId/series` — so a portfolio figure would have needed a new endpoint, and Overview already fires eight requests. **It is served from `dashboardMonthlyTotalAmountByType` instead**, the payload Overview already asks for at `Overview.tsx:89`, as `yearlyTotals` beside `monthlyAmounts`: no ninth request and §10.8.3 holds, the client folds nothing. | Folding the twelve months client-side, rejected: that is the line §10.8.3 draws | **Placed on Overview, not on the budget hero.** The budget screen sits under a MonthPicker and a yearly figure there does not answer the picker, which reads as a defect rather than as a second scale. |
| **R55** | The mixed-currency query that nulls a category total | **Run it read-only against local now.** One query; it answers whether any category on this database is affected while the write path is being built | **Leave it in the Supabase block**, where `PLAN_SUPABASE_MIGRATION.md` §0.7 already schedules it against the real clone — but a nulled total then stays on screen through all of A–E | **Both, in order.** Run the local read-only version now — it is one query and it scopes the defect. The clone diagnosis stays in §0.7 |
| **R58** | `receive` is in the movement catalogue with no writer | **Leave open.** `REMARKS.md` registers `R58` *"Open — informational"* | **Decide the wording now** — but nothing renders it, so any decision taken today is taken blind | **Leave open.** It decides when a screen has to draw it, not before |
| **S1** | ~~The stash `stash@{0}: wip-split`~~ — **CLOSED 2026-08-21: inspected, harvested, dropped** | Compared file by file against HEAD. **Five of eleven were byte-identical** — `CardTitle.tsx`, `cardTitle.css`, `Budget.tsx`, `BudgetLayout.tsx`, `useBudgetListFilter.ts` — that work had already shipped. The other six held 157 lines HEAD did not, and all but one were superseded revisions: an inline `Icon` wrapper the imported SVG assets replaced, the percentage rendering `e1449f7` closed, older row and padding revisions. | — | **The one thing worth keeping:** `__direction` and `__filter` had `:hover` but no `:active`, while their sibling `__reset` had both under the same rule, and neither sits inside `__fields` so the container's `:active` misses them. Fixed in `1b9f09e`. The stash object is anchored by the local tag **`archive/wip-split`** (`2d75930`) and can be restored with `git stash store`; delete the tag when you are sure. |

### Group 3 — waits for the module to close, blocks nothing here

`PLAN_EDIT_BLOCK.md` §4, with Q1 and Q8 now closed:

| # | question | recommendation |
|---|---|---|
| **Q3** | Does `EditAccount` cover debtor and pocket | **Measure before deciding.** It fetches by id through one endpoint; whether that endpoint and the form's schema describe those two is a fact, not a preference |
| **Q4** | Which stylesheet owns `.icon3dots` once it is interactive | **`forms-styles.css`.** The control lives on the detail and form screens; `accountingDashboard-styles.css` is one screen's sheet and would have the other five importing across |
| **Q5** | Does the month travel in the link | **Yes, through `previousRoute`**, which already exists (`EditAccount.tsx:76`). With unit D the amount leaves the form, so the month is only a return address |
| **Q7** | Reuse, vary, or replace `AccountActionsMenu` | **Vary it** — hide *"view details"* when the caller is already a detail view. A second control duplicates three options to change one |

`PLAN_ACTIONS_MENU.md` §6, decision A already settled:

| # | decision | recommendation |
|---|---|---|
| **B** | The class-name mismatch | **Its own `fix(ui)` before the restyle.** The option does not work at all today, which makes it a defect, not a style change |
| **C** | Container border | **`--border-width-thin`.** The reference's 1.5px has no token and none is invented |
| **D** | Row label size | **`--font-size-sm`**, the stated default UI size |
| **E** | Modal width | **Drop the fixed width**, bound by `--layout-width-max` with padding. Naming a new sizing token for one modal is inventing a token |
| **F** | Danger colour | **`--color-status-alert`**, which is what the reference already reached for via the legacy `--squareAlert` |

`NEXT_SESSION.md`'s style questions **QS-2, QS-3, QS-5, QS-6 and QS-7** already
carry a recommendation and a trigger in that file. They are not repeated here and
are not re-litigated.

---
## Verification

There is no test runner (F-15). "It works" is: the unit's own completion list
run by hand, plus `tsc -p tsconfig.app.json --noEmit` exit 0, `vite build`
exit 0, and the app booting to `APP LOADED OK`.

Final pass on `/fintrack/budget/category/dairy`, with `dairy/milk` at 82.8% and
`dairy/yogurt` at 71.7%:

1. Control opens the modal; `disabled` on a past month.
2. Saving updates the row; back at level 1 the hero already carries it.
3. Saving with the exception prints the month and the amount it returns to.
4. The exception account shows the marker; the recurring one does not.
5. The dashboard's figure matches the budget screen's for the same account.
6. Deleting the account from budget returns to a list without it.
7. Removing a budget leaves the account listed with a zero figure.

## Decisions of 2026-08-29 — O3, O4 and the horizon

**These close the three rows this document left open.** Where they disagree with
the *Open decisions* tables above, these are the decisions and those are the
reasoning that produced the question.

### O3 — the control, and the rule about who owns a date

**The three-option control is confirmed.** The checkbox is replaced by a control
that can say *this month*, *until a month I name*, and *no end*, with the middle
option revealing a forward-looking month selector. `MonthPicker` gains its bounds
as props, which it was owed anyway.

**The developer added an architectural rule that governs the payload:**

> The frontend sends **intent**. The backend resolves the dates. Duplicating the
> date rules on both sides is what produces two answers to one question.

**Measured against the shipped contract, 2026-08-29 — the rule is already
honoured, and no contract change is owed.** `budgetValidators.js:58-71` accepts
`appliesUntil` as either the literal `'openEnded'` or a month written `YYYY-MM`:

- *no end* sends `'openEnded'`, which **is** intent — the client computes nothing
  and names no date;
- *until a month I name* sends the month the user picked in the selector, which is
  the user's own choice echoed, not a client derivation;
- *this month* sends the month already on screen, likewise echoed.

The shape the rule forbids is the one the plan called option (c), *for N months*,
where the client computed `month + (N - 1)`. That option was already rejected on
its own merits. **Recommendation: ship against the contract as it stands.** Adding
a separate `scope` discriminator would change an endpoint that already ships in
order to express a distinction its values already carry.

### O4 — a past month is editable, and the confirmation must say what it does

**Confirmed: enabled back to the account's start month, not before A.7.** The
developer added a condition on the confirmation itself:

> *"Are you sure?"* is not enough. The confirmation must state the effect, because
> the user is changing a historical rule — for example, **"This change will affect
> all budget periods from June 2026 onward."**

That makes the confirmation semantic rather than ceremonial, and it is what makes
the open-ended branch safe to expose: the single most destructive thing this
endpoint can do is an open-ended save dated in the past, which erases every
decision after it. **The confirmation must name the month the change starts from
and say that everything after it is replaced.** A dialogue that does not name the
month does not discharge this decision.

### The horizon — a business rule, owned by the backend

**The plan's *no ceiling* is rejected**, and so is the alternative it implied.

> The answer is not a magic year in the frontend. It is a business rule that says
> how many months forward FinTrack lets you plan, and that rule lives in the
> backend.

So: a **planning horizon expressed in months**, enforced in `budgetValidators.js`
alongside the bounds already there, and **served to the client** so the selector's
upper bound comes from the server rather than being restated in the picker. A
request past the horizon answers 422, the same way a month outside the account's
life already does.

**The one value still to name is the number of months.** Recommendation: **24**.
A budget is a monthly decision; two years covers the longest commitment a personal
budget realistically carries and keeps the selector short enough to scroll. It is
a constant with a name, changed in one place, not a date buried in a component.

---

## Corrections of 2026-08-30 — measurements only

Assertions about the code, corrected in place. **No decision was closed, deleted or
reworded — O3, O4 and the horizon keep the resolutions the developer set on 2026-08-29,
unit D stays cancelled, and no unit was reordered.**

| where | what was asserted | what the code says today |
|---|---|---|
| STATE, row A | the modal is mounted at `CategoryAccountList.tsx:320`, `CategoryDetail.tsx:466`, `EditAccount.tsx:629`; the mirror at `budgetAllocationService.js:357-365` | `:312`, `:518`, `:674`; the mirror at `:278-282`, inside `setCurrentMonthBudget` at `:194` |
| STATE, row C | the emitters are `EditAccount.tsx:313` and `NewCategory.tsx:415` | `EditAccount.tsx:357` and `NewCategory.tsx:415`, the latter under `pages/forms/newCategory/` |
| STATE, O3 / O4 | the tiles are declared at `BudgetEditModal.tsx:96-101`; `canEdit` at `CategoryAccountList.tsx:114` and `CategoryDetail.tsx:140` | `RANGE_MODES` at `:114-118` over `RangeModeType` at `:99`; `canEdit` at `:113` and `:158` |
| Context | the account editor's own comment at `accountEditController.js:113-115` explains why that door cannot express the two cases | the comment is at `:105-107` and goes further: the budget is not edited there at all, and a budget key in the PATCH is ignored (`8fba00e`). The three-door table describes the state before that commit |
| Already built | `budgetRoutes.js:26`, `budgetAllocationService.js:239`, `budgetAllocationRepository.js:129` | `:27`, `:194`, `:135` |
| A.0 | the API client, the response type and the modal are still typed against `{ amount, onlyThisMonth }` | A.0 landed: `budgetApi.ts:61` sends the object, `budgetTypes.ts:38` carries `overwrittenMonths` at `:62`, and the checkbox is the three-tile control |
| A.1 | the account editor writes `cba.budget` through its generic field builder at `accountEditController.js:124` | it writes no budget at all (`8fba00e`); the mirror this unit specified is live at `budgetAllocationService.js:278-282` |
| B | `budgetValidators.js:96`, `accountCategoryCreationcontroller.js:86-87` | `:129` and `:87`, with the reason at `:75-76` |
| E | `aria-modal` at `BudgetEditModal.tsx:143` | `:512` |
| Ruled out / Registered | allocations cascade at `createTables.js:376`; `original_budget` stales at `accountEditController.js:338-351` | `:385`; and the second is closed — the editor no longer writes the budget, and that line range now holds the pocket-saving deadline logic |

**Not re-measured, and stated rather than guessed.** The seven completion criteria of A,
the four of B and the four of E were verified by hand on 2026-08-20 and 2026-08-23 and
are recorded as such. Nothing here re-drove the app, so those observations stand as
dated evidence, not as a claim about today.
