# PLAN — THE EDIT BLOCK

**Opened 2026-08-15**, from the developer's proposal: rework the edit account
module, and additionally reach editing from every account detail screen through
the three-dots control at title level (`.icon3dots`).

`plan-docs/` is gitignored. Nothing in this file produces a commit.

> ### 🛑 The boundary below was reversed by the developer — 2026-08-19
>
> **Q8 is re-opened and answered the other way. Q1's answer does not hold.**
>
> The instruction, given more than once: **`EditAccount` edits the whole account,
> and that includes the budget.** The amount stays in this module, as a **budget
> edit block** — the existing `BudgetEditModal` mounted as a component inside the
> account edition module, not as a bare field and not behind a separate route.
>
> So the block below is wrong on both counts it closes:
>
> - **Q8** — the budget edit modal *does* live behind this door. It is not the
>   only door: unit A.4 still puts a control on the budget screen's own rows. Two
>   entry points, one endpoint.
> - **Q1** — "the amount leaves this form entirely" is void. The question of what
>   an edit means with a past month on screen returns, and the modal's own
>   `appliesUntil` is what answers it, not a rule in this form.
>
> `PLAN_BUDGET_WRITE_PATH.md` unit D is cancelled; its diagnosis survives, its
> remedy does not.
>
> **Corrected 2026-08-29: the endpoint question is closed, and this paragraph used
> to say it was open.** It closed on 2026-08-23 with `8fba00e`
> `refactor(budget): drop the editor budget write` — 21 insertions against 150
> deletions across the account edit controller and the budget allocation service.
> The budget block writes through `PUT /budget/accounts/:accountId/current`, the
> account `PATCH` stopped carrying `budget`, and `applyAllocationForAccount`
> retired with it: that service wrote identity FX on the premise that the editor
> had already converted, and the editor no longer touches the amount. So the FX
> audit pair is no longer left false, which was unit D's whole diagnosis.
> `PLAN_BUDGET_FRONTEND.md:125` records the closure; this file did not, and a
> reader arriving here was sent looking for a decision that had already been made.
>
> ---
>
> ### Boundary with `PLAN_BUDGET_WRITE_PATH.md` (2026-08-17) — superseded, kept as record
>
> That document's **unit D removes the `budget` field from `EditAccount`** for
> `category_budget` accounts — two commented-out blocks, in
> `accountEditSchema.ts:89-99` and `editSchemas.ts:60-62`. Nothing else of this
> module is touched: not its layout, not its route, not the `.icon3dots` that
> reaches it, and not the other five account types, which map to different
> schemas at `editSchemas.ts:89-97`.
>
> **It closes two of §4's questions, not one.**
>
> **Q8 — does the budget edit modal live behind this same door.** No. Unit A.4
> puts the control on the budget screen itself, on the level-2 and level-3 rows,
> and `PUT /budget/accounts/:accountId/current` is reached from there. §4 calls
> Q8 *"the one that has to be settled first: it decides whether this block is one
> thing or two"* — the answer is **one thing**. This block is the account editor
> and its door, and nothing else.
>
> **Q1 — editing with a past month on screen.** Closed, and not the way §1 below
> expects. The answer is not a rule inside `EditAccount`: the amount leaves this
> form entirely, and it is the budget screen's own control that is disabled on a
> past month. What stays in the form — name, category, nature — is not
> month-scoped, so the question no longer has a subject here.
>
> Whatever this plan decides about the three-dots, it no longer decides anything
> about editing a budget amount.

---

## 1. What the proposal settles

`PLAN_BUDGET_FRONTEND.md` §10.10.5 left one question open and named it: *"Editing
is unreachable from here: `CategoryDetail` has no link to `EditAccount`, and the
edit form is a standalone route."* It also refused to answer what an edit means
while a past month is on screen, because that question arrives with the link.

**The proposal answers the first half.** The entry point is the three-dots
control on each account detail view. The second half — editing while looking at a
past month — is still open and is now unavoidable, because the link is what makes
it reachable. See §4.

## 2. Measured terrain, 2026-08-15

The route already exists and is wired. Nothing has to be created for it:

| what | where |
|---|---|
| Route `account/:accountId/edit` | `App.tsx:392` *(was `:376`, re-read 2026-08-30)* |
| Lazy import of `EditAccount` | `App.tsx` |
| Module | `frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount` |

**The control is inert on every screen, and inert in the same way.** Each site
holds a commented-out `<Link to='edit'>` immediately above a live `<div id='edit'>`
that renders the same icon and does nothing. Whoever disabled it kept the markup:

| screen | commented link | inert div |
|---|---|---|
| `AccountDetail.tsx` | `:175-177` | `:179-181` |
| `DebtorDetail.tsx` | `:192` | `:195` |
| `PocketDetail.tsx` | `:144` | `:148` |
| `CategoryDetail.tsx` | `:210` | `:214` |
| `CategoryAccountList.tsx` | `:152` | `:156` |

`AccountingBox.tsx:37` also renders `.icon3dots`, on the dashboard rather than on
a detail view. It is **out of this block's scope** unless the developer says
otherwise.

Two stylesheets define `.icon3dots` independently — `forms-styles.css:327` and
`accountingDashboard-styles.css:163`. Turning the div into an interactive control
requires the five states CLAUDE.md mandates, and neither definition has them
today. Which of the two owns the shared control is an open question (§4).

> **Corrected 2026-08-30 — this section is a 2026-08-15 measurement and every
> present-tense claim in it has since been overtaken.** Kept whole because it is
> the terrain the block was planned against, and superseded by §7.3.1.
>
> - **No `.icon3dots` element is rendered anywhere in `frontend/src` today.** The
>   five inert `<div id='edit'>` sites of the table above are gone: three became
>   `AccountEditLink` (`AccountDetail.tsx:192`, `CategoryDetail.tsx:328`,
>   `DebtorDetail.tsx:244`), the budget category list closed differently, and the
>   pocket detail screen simply has no edit control.
> - **`AccountingBox.tsx` no longer renders `.icon3dots`.** It renders
>   `AccountActionsTrigger` at `:31-35`, imported at `:6` — which is unit `U5`
>   landing, recorded at §7.6.
> - **The two stylesheet rules are at `forms-styles.css:366` and
>   `accountingDashboard-styles.css:457`**, not `:327` and `:163`, and both are now
>   dead rules awaiting the cleanup block (D13).

## 3. Two doors, one destination — developer's clarification, 2026-08-15

Editing is **one destination reached from two places**. `EditAccount` is not a
second form; it is the form, and the three-dots control on the detail views is a
second door into it.

| door | state | how it works |
|---|---|---|
| Accounting dashboard | **Working** | `AccountingBox.tsx:31-35` renders `AccountActionsTrigger`, a real `<button>` → `handleMenuClick` (`AccountingDashboard.tsx:410`) → `AccountActionsMenu` → `handleEditAccount` (`AccountingDashboard.tsx:488-498`). *Anchors corrected 2026-08-30; they read `:32-40` and `:277-288`* |
| Account detail views | **Inert** | The five sites of §2. Nothing wired |

### 3.1 The destination is cheaper to reach than it looks

`EditAccount` **does not receive the account. It fetches it.** It reads
`accountId` from `useParams` (`:96`) and takes its data from its own request
(`:128`, `apiData?.data?.accountList[0]`). Of everything the dashboard passes in
router state — `accountData`, `previousRoute`, `originRoute` — it reads
`previousRoute` (`:99-100`), with a fallback to `/fintrack/tracker/accounting`,
and `originRoute` (`:106`), which it hands back on both return paths as
`returnState` (`:111`). *(Anchors corrected 2026-08-30 — they read `:73`, `:93`,
`:76`; `originRoute` arrived later, with the return-path fix `a6c1f6c` this same
section records.)*

**Consequence:** the second door needs nothing but the id in the URL and, to
return to the right place, a `previousRoute` in state. It does not need to
assemble an `AccountListType`.

### 3.2 What the dashboard's door actually opens

Not a link — `AccountActionsMenu`, which is a centred modal with three options:
view details, edit, delete. It closes on click-outside via `useClickOutside`.

Two things follow for the detail views:

- **"View details" is meaningless from a detail view.** The user is already
  there. The menu needs a variant, or the option is hidden, or the detail views
  get a different control. Reusing it whole means offering a door to the room
  the user is standing in.
- **The menu is typed `account: AccountListType`** and renders
  `account.account_name` in its header. `AccountDetail` holds that type;
  `DebtorDetail` and `PocketDetail` hold their own. Reuse on those two means
  either widening the prop or building the object.

So Q2 is answered — a menu, not a link, because that is what the working door
already is — but the answer costs more than descommenting the `<Link>`.

## 4. Open questions

**Answered by §3:** the old Q2 (link or menu → menu) and the old Q6's premise
(`EditAccount` is one destination, not a parallel form).

| # | question |
|---|---|
| Q1 | **Editing with a past month on screen.** V1 permits no edit to a month earlier than the current one. Does the control disappear, disable itself, or open and refuse? A control that opens and then refuses is the worst of the three, but it is also the only one that explains why |
| Q3 | **Does `EditAccount` cover debtor and pocket**, or only the generic account types. It fetches by id through one endpoint, so the question is whether that endpoint and the form's schema describe those two |
| Q4 | **Which stylesheet owns `.icon3dots`** once it becomes interactive, given two independent definitions (`forms-styles.css:327`, `accountingDashboard-styles.css:163`) and a shared control that must declare the five states |
| Q5 | **Does the month travel in the link**, and does the edit return to the month it was opened from. `previousRoute` is the mechanism that already exists for this |
| Q7 | **Is `AccountActionsMenu` reused, varied, or a second control.** Decided by whether "view details" can be hidden cleanly and by the `AccountListType` typing on debtor and pocket |
| Q8 | **Does the budget edit modal live behind this same door.** `NEXT_SESSION.md:1063` has a modal against `PUT /budget/accounts/:accountId/current` — the *"budget and frequency"* half of the goal. A budget account has a monthly allocation that `EditAccount`'s form does not describe, so either the menu branches by account type or the modal is a fourth option in it |

Q8 is the one that has to be settled first: it decides whether this block is one
thing or two.

## 5. Dependency, not a suggestion

`NEXT_SESSION.md:1063` places the budget edit modal behind the month commit. This
block inherits that: the entry point cannot be opened before the destination
exists, or the control leads to a form that does not yet do what it promises.

> **Revised 2026-08-17.** With Q8 answered, that dependency no longer reaches
> this block through the modal — the modal is not behind this door. What binds
> now is unit D: it comments the `budget` field out of `EditAccount`, so opening
> the three-dots before unit A ships leads to a form that can no longer change an
> amount while the budget screen cannot change it either. **Unit A, then unit D,
> then this block.**

## 6. Where this block sits against the standing directives

- **D11** — no implementation commit on an incomplete contract. §4 must be closed
  before a commit sequence is written, not during it.
- **D13** — the five commented `<Link>` blocks are removed in the cleanup block,
  not here, whichever way the control ends up implemented.

---

## 7. What is pending — state of 2026-08-23

> ### ⚠️ Corrected 2026-08-23. The 2026-08-22 version of this section was false.
>
> It said *"Nothing here has been executed … no commit of this block exists on
> any branch"* and marked all seven units as not started. **Six of the seven are
> done**, and both prerequisites it declared blocking were already satisfied when
> it was written. The measurement is §7.3 below.
>
> **How it drifted, so the same mistake is not repeated.** The commit that landed
> most of the block is `ddae29a`, *"feat(edit): edit an account from its detail
> page"* (2026-08-20) — a message that reads like `U7`, the doors, while its diff
> is `U1`, `U3`, `U5` and `U6` and leaves all five doors inert. Anyone checking
> progress with `git log --oneline` would have concluded the opposite of the
> truth in both directions. **Progress is read from the diff, never from the
> message.**
>
> A document that under-reports progress is worse than one that over-reports it:
> it orders work already done to be done again.

Written because the developer asked what this block still owes. **One unit is
left: `U7`, the inert doors.** `U8` — the save that reported a change it never
made — **landed 2026-08-25 as `ce544d2`**, so of the eight units only the doors
remain.

### 7.1 Where the block stands

| | |
|---|---|
| This document | The **question** document. Its open questions are answered — see §7.2 |
| `on-hold/PLAN_EDIT_BLOCK/PLAN_EditAccount.md` | The **execution** plan, written 2026-08-19. Seven units, `U1`–`U7`, each with its own *complete when* |
| Landed | **Six of seven units**, chiefly in `ddae29a` (2026-08-20, nine files, +760). See §7.3 |
| Open | **`U7` alone.** Tracked code in four screens; `U8` landed 2026-08-25 as `ce544d2` |
| Migrations | **None**, in either document |
| Blocked by | **Nothing.** Both prerequisites of the old §7.4 are satisfied — see §7.4 |

### 7.2 The questions this document opened, and where they went

| # | question | state |
|---|---|---|
| Q1 | Editing with a past month on screen | **Returns.** It was closed on the premise that the amount leaves this form; the reversal of 2026-08-19 put the amount back, so the question has a subject here again. It is answered by the modal's own `appliesUntil`, not by a rule in this form |
| Q2 | Link or menu into the editor | **Closed** — a menu, because that is what the working door on the dashboard already is |
| Q3 | Does the editor cover debtor and pocket | **Answered by measurement** in the execution plan, unit `U4` |
| Q4 | Which stylesheet owns `.icon3dots` | **Answered by measurement**, unit `U5`. Open decision 1 below reopens the shape, not the ownership |
| Q5 | Does the month travel in the link | **Answered by measurement**, unit `U7`. `previousRoute` is the mechanism, and it already exists |
| Q7 | Is the actions menu reused, varied, or replaced | **Answered by measurement**, unit `U6` — a variant, through a prop |
| Q8 | Does the budget edit modal live behind this door | **Reversed by the developer 2026-08-19: yes.** The existing `BudgetEditModal` is mounted as a block inside the editor. This cancels unit `D` of `PLAN_BUDGET_WRITE_PATH.md` |
| — | Which endpoint the block writes through | **Settled and landed.** `PUT /api/fintrack/budget/accounts/:accountId/current` is the single writer. The account `PATCH` stopped carrying `budget` in `8fba00e` (2026-08-23), which also retired `applyAllocationForAccount` — the service that wrote identity FX on the premise that the editor had already converted, which it never did |

### 7.3 The units, measured 2026-08-23

| unit | what it does | state |
|---|---|---|
| `U1` | The budget block replaces the amount field. **The unit the whole block exists for** | **Done.** `EditAccount.tsx` imports `setCurrentBudget` at `:53`, `BudgetEditModal` at `:61` and `normalizeBudgetError` at `:74`, and mounts the modal at `:674`. The amount field is commented out of `accountEditSchema.ts:87-101` with its reason written |
| `U2` | The save announces itself — the editor currently writes silently | **Done.** `EditAccount.tsx:357` emits `notifyAccountChanged()` after a successful PATCH; `useBudgetStatusStore.ts:156` is subscribed, still at that line. The emitter is payload-free, so the editor does not know which caches it invalidated |
| `U3` | Three fetch states, loading / error / empty, instead of two paragraphs | **Done.** Form skeleton at `EditAccount.tsx:485-492`, and the budget block carries its own at `:541` |
| `U4` | ~~The six field lists verified against the six account types.~~ **Register only**, no corrections shipped | **Done as a register**, measured 2026-08-20 inside the execution plan. Decision 2 below held: it shipped no corrections. **Corrected 2026-08-30: the editor configures FIVE lists, not six** — `accountEditSchema.ts` declares `bank` (`:63`), `investment` (`:64`), `income_source` (`:68`), `category_budget` (`:74`) and `debtor` (`:146`), and `editSchemas.ts:65-69` maps the same five. `pocket_saving` left the editor with the pocket module; `cash` was never in it |
| `U5` | The trigger becomes a real control — five interactive states, which neither `.icon3dots` definition has today | **Done.** `general_components/accountActionsTrigger/AccountActionsTrigger.tsx` with its own stylesheet — its own BEM block, which is what decision 1 recommended |
| `U6` | The menu gains a variant, so *view details* is not offered from the detail view the user is standing in | **Done.** `editionAndDeletion/components/accountActionMenu/AccountActionsMenu.tsx:26` makes `onViewDetails` optional and the option is rendered only inside `{onViewDetails && …}` at `:125-129`, so omitting it is what removes it. The prop takes `accountName` alone (`:21`), not the whole account, precisely so a detail screen can open it without assembling a type it never received. All three anchors re-verified 2026-08-30 |
| `U7` | The five inert doors open — `AccountDetail`, `DebtorDetail`, `PocketDetail`, `CategoryDetail`, `CategoryAccountList` | ~~**Four of five closed, measured 2026-08-29.** Only the pocket detail screen still renders a dead control~~ — **corrected 2026-08-30: no dead control is left anywhere. See §7.3.1** |
| `U8` | The save is refused when nothing changed, instead of reporting a success that did not happen | **Done.** `ce544d2` (2026-08-25). The snapshot the effect threw away is held in `pristineDataRef` (`EditAccount.tsx:241`, written at `:259`), `isDirty` compares by value at `:269-276`, the handler refuses at `:309` and the control carries `disabled` at `:661`. Every *complete when* of §7.3.2 is met. *(Anchors corrected 2026-08-30 — they read `:259`, `:299`, `:650`.)* |

#### 7.3.1 `U7`, the one open unit

Five screens still render a dead control: a `<div id='edit' className='flx-col-center icon3dots'>`
above a commented-out `<Link to='edit'>`, at `AccountDetail.tsx:193`,
`CategoryAccountList.tsx:253`, `CategoryDetail.tsx:328`, `DebtorDetail.tsx:208`
and `PocketDetail.tsx:161`. ~~One pattern, five sites.~~

**Corrected 2026-08-25 by measurement: one pattern, four sites — the fifth is a
different screen in kind.** `CategoryAccountList` is level 2 of budget. Its route
is identified by `categoryName`, its header title is the category name, and the
screen **lists several accounts**. There is no `accountId` to hand to
`/fintrack/account/${accountId}/edit`, so the account editor is not what that
control can open. Either it opens something else, or it opens nothing and the
`div` is deleted with the commented `<Link>` in the cleanup block (D13). Open.

**Two further corrections from the same measurement.**

*A door is not an account type.* `ACCOUNT_TYPE_DETAIL_PAGE`
(`AccountingDashboard.tsx:57-63`) routes `bank`, `investment` **and**
`income_source` to the same `/fintrack/overview/accounts`, so the single door on
`AccountDetail` serves three of the seven catalogued types. The four doors cover
the catalogue.

*Except `cash`, which blocks this unit.* The catalogue declares seven types
(`005_base_catalogs.sql:36-45`, the seven rows at `:37-43`) and `cash` is absent
from the whole frontend — icon map, route map, and the editor's own field
configuration in `accountEditSchema.ts`. A `cash` account reaches the detail
screen through the `||` default in `ACCOUNT_TYPE_DETAIL_PAGE`'s lookup
(`AccountingDashboard.tsx:440`) and would reach the editor with no fields to
render. *(Anchor corrected 2026-08-30; the seven-type count is unchanged, and so
is `cash`'s absence — `accountEditSchema.ts` still declares five lists and none of
them is `cash`.)*
~~**Measure whether one exists in the local copies before opening the doors**~~
— **measured 2026-08-25, and this no longer blocks:** counted by type on both
local copies, there are **zero `cash` accounts** anywhere (remark R244). The type
is declared in the catalogue and never used, so the frontend's silence about it
costs nothing today and the doors may open. It stays a catalogue disagreement,
recorded in R244, not a prerequisite of this unit.

*The `div` is not a control.* It takes no focus, answers no key, and cannot
declare the five interactive states the standing rule requires. Opening the door
means replacing it with a `<button>`, not attaching an `onClick`.

*And the delete case is new here.* Editing from the dashboard returned to a list
with one row fewer; editing from a detail screen leaves `previousRoute` pointing
at a detail that no longer exists. That return resolves to the module, not to the
record.

The pattern to copy is the working door on the dashboard — `handleEditAccount`
at `AccountingDashboard.tsx:488-498` *(anchor corrected 2026-08-30, it read
`:439-451`)*. Each screen needs its own open/closed
state, the trigger in place of the dead `div`, and a handler that navigates to
the **flat** route `/fintrack/account/${accountId}/edit` (`App.tsx:392` —
*anchor corrected 2026-08-30, it read `:376`*);
the commented `to='edit'` is relative and would 404. `previousRoute` still
carries `location.pathname + location.search` — `refactor(menu): drop unused
previousRoute prop` (`954f467`) removed it from the *menu component's* props, not
from the navigation state, which `EditAccount.tsx:99-106` and
`AccountDeletionPage.tsx` both still read.

The commented `<Link>` blocks **stay commented**: their removal belongs to the
cleanup block (D13), not here.

##### Where the five doors stand, measured 2026-08-29

Four are closed and one remains. The resolution differed from what was planned
above in two of the five, so the sites are listed with what actually landed
rather than with the pattern they were expected to follow.

| screen | what is mounted today |
|---|---|
| account detail (`AccountDetail.tsx:192`) | the shared edit link, `a9488d8` |
| debtor detail (`DebtorDetail.tsx:244`) | the shared edit link, `32baed3` |
| category detail (`CategoryDetail.tsx:328`) | the shared edit link, `610e399` |
| the budget category's account list (`CategoryAccountList.tsx`) | **closed differently, and correctly.** It opens a budget editor per row through `onEditAccount` at `:299`, mounting `BudgetEditModal` at `:312`. There is no header control at all, which is the right answer for a screen whose route carries a category name and no account id |
| pocket detail (`PocketDetail.tsx`) | ~~**the last dead control.** A `<div id='edit'>` above a commented `<Link>` at `:161`~~ — **no control at all, measured 2026-08-30** |

> **Corrected 2026-08-30 — the row that said a dead control survives on the
> pocket detail screen is false, and so is the debtor row's line number.**
>
> **What the table asserted.** That `PocketDetail.tsx:161` still renders
> `<div id='edit' className='flx-col-center icon3dots'>` above a commented-out
> `<Link to='edit'>`, making it the one open site of `U7`.
>
> **What the code says.** `PocketDetail.tsx` — modified and uncommitted in the
> working tree — contains no `id='edit'`, no commented `<Link to='edit'>`, no
> `Dots3` glyph and no `AccountEditLink`. Swept over the whole of
> `frontend/src`, the token `icon3dots` survives in exactly four places, none of
> them a rendered control: two explanatory comments in
> `general_components/accountActionsTrigger/AccountActionsTrigger.tsx` and
> `general_components/accountEditLink/`, and the two stylesheet rules the cleanup
> block owns (`accountingDashboard-styles.css:457`, `forms-styles.css:366` —
> **not** `:419` and `:327` as §7.5 and §2 give them).
>
> `AccountEditLink` has exactly three call sites, and the debtor one has moved
> with that screen's rewrite: `accountDetail/AccountDetail.tsx:192`,
> `categoryDetail/CategoryDetail.tsx:328`, `debtorDetail/DebtorDetail.tsx:244`.
>
> **So `U7` has no dead control left to open, and the question it leaves is not
> the one the paragraph below poses.** The paragraph says the last site closes
> inside the pocket detail rewrite. That rewrite has happened and it deleted the
> control rather than replacing it, so what is now open is a **decision, not a
> commit**: does the pocket detail screen get an edit door of its own, given that
> the account editor no longer configures `pocket_saving` at all
> (`accountEditSchema.ts` declares `bank`, `investment`, `income_source`,
> `category_budget` and `debtor`; `editSchemas.ts:65-69` maps the same five; and
> `EditAccount.tsx:252-254` says in the source *"a pocket is edited on its own
> screen now — this editor no longer reaches one"*)? The unit is left open and in
> place; nothing here closes it.

**Two corrections to the pattern this section prescribed.** The door is a
`<Link>`, not the actions trigger with its own open/closed state: the shared
component `general_components/accountEditLink/AccountEditLink.tsx` navigates
directly to the flat editor route, and it is deliberately not a variant of
`AccountActionsTrigger`, which announces a popup menu it does not open. And no
screen needed its own state, because a link has none.

**A live defect surfaced when the doors opened, and is fixed.** Returning from
the editor to a detail card handed it no navigation state, so the card
remounted with nothing to derive its back arrow from and fell through to its own
default — the user walked dashboard, detail, editor, back, and landed on
overview instead of the accounting board. The editor now carries the caller's
origin through and hands it back on both return paths (`EditAccount.tsx:97-107`,
`a6c1f6c`). The case had never been reachable before this unit, which is why it
appeared only now.

**The one open site closes inside the pocket detail rewrite**, not here. That
screen is being rebuilt against the pocket endpoint, and deleting an inert
control in a file that is about to be replaced whole would be a commit against a
line that is already gone.

#### 7.3.2 `U8`, the save that reported a change it never made — closed by `ce544d2`

Reported by the developer 2026-08-23 and measured the same day: submitting the
editor **without touching a field** shows *"Account updated successfully!"*.

**What the code does** *(as measured 2026-08-23, before `ce544d2`; the anchors
below are the pre-fix ones and the current file is anchored in the `U8` row of
§7.3)*. `onSubmitForm` compared nothing. It validated `formData` whole, sent it
whole, and on any 200 ran the success flow. The backend cannot help: the `PATCH` builds its
`UPDATE` from whatever keys arrive, so re-sending the stored values is a valid
request that legitimately answers 200. **Nothing in either half knows the values
did not change.**

**Why the toast is the least of it.** The success flow also calls
`notifyAccountChanged()` — today at `EditAccount.tsx:357` — which invalidates the
accounting dashboard and the budget status caches. An empty save therefore costs
a network round trip, a write of identical values, and a cache invalidation
across two modules — and then navigates away (today the `setTimeout` at `:359-361`)
as if work had been done. The wrong message is the symptom; **the unrequested
invalidation is the cost.**

**Why it is a dirty check and not a reworded toast.** A message that says
*"nothing to save"* still pays for the round trip and the invalidation. The
control has to refuse before the request, which is also what the standing rule on
interactive states already asks of a save button: a disabled state exists to say
*not now*, and this is the case it exists for.

**The snapshot already exists and is thrown away.** The effect built
`initialData` from the fetched account and passed it to `setFormData` without
keeping it. Holding that object — a ref is enough, it is written once per load —
gives the comparison its left-hand side at no extra fetch. *(That is what shipped:
`pristineDataRef` at `EditAccount.tsx:241`, written at `:259` one line before
`setFormData` at `:260`.)*

**Complete when**

- The save control is disabled while `formData` equals the snapshot seeded in the
  effect (today `EditAccount.tsx:244-262`), and enabled the moment any field
  differs. The comparison is by value. ~~The date field is parsed at `:231-234`,
  so a raw string and a parsed date must not read as a change.~~ **Corrected
  2026-08-30: there is no date field left in this editor.** `EditAccount.tsx:252-254`
  states it in the source — *"No date field survives here. The deadline of a
  pocket was the only one this editor ever parsed, and a pocket is edited on its
  own screen now."* The clause is void, not unmet; `areValuesEqual` still resolves
  `Date` for the derived fields.
- The disabled state follows the standing rule — `opacity: 0.5` and
  `pointer-events: none` — and does not remove the control from the tab order
  without a reason stated in the code.
- An untouched form issues **no request**, emits **no** `notifyAccountChanged()`,
  and shows **no** success message.
- The budget block is untouched. It writes through its own endpoint and owns its
  own enabled state; the two saves are independent and must stay that way.
- Re-editing a field back to its original value disables the control again, which
  is the case that separates a real dirty check from a "has been touched" flag.

**Out of scope.** The wording of the success message, the navigation
delay (today `EditAccount.tsx:359-361`), and the same pattern anywhere else it exists — the account
deletion screen and the creation forms were **not** measured for this.

### 7.4 The two prerequisites, both satisfied

The 2026-08-22 version of this section declared the block unable to start. Both
of its blockers had already fallen when it was written:

| declared blocker | measured 2026-08-23 |
|---|---|
| **Budget commits 3, 4 and 5** — *"the modal, `normalizeBudgetError` and the frontend write contract are uncommitted"* | The modal landed in `744f986` (2026-08-18) and its own screen in `6c03e02` (2026-08-20); `normalizeBudgetError.ts` is tracked |
| **Budget unit `A.1`** — the `cba.budget` mirror inside `setCurrentMonthBudget` | **Written.** `budgetAllocationService.js:357-365`, inside the transaction and guarded by `appliesUntil === OPEN_ENDED`, with the comment stating why only the open-ended save writes it: a bounded range does not change the standing monthly amount, which is the figure the accounting dashboard sums |

The reasoning was correct — choosing the budget endpoint is what promoted `A.1`
from *queued* to *blocking*. What was wrong was the state, not the argument.

### 7.5 The three decisions, re-read

| # | decision | state 2026-08-23 |
|---|---|---|
| 1 | Does the trigger keep `.icon3dots` or take its own BEM block (`U5`) | **Settled by the code, as recommended.** `AccountActionsTrigger` carries its own block and its own stylesheet; the two `.icon3dots` rules (`accountingDashboard-styles.css:457`, `forms-styles.css:366` — *anchors corrected 2026-08-30, they read `:419` and `:327`*) were left alone rather than given states that would make one of them silently wrong. Both rules are now dead: no `.icon3dots` element is rendered anywhere in `frontend/src` |
| 2 | Does `U4`'s measurement pass ship corrections, or only a register | **Still open, and still recommended as register only.** Correcting six field lists inside a unit whose job is to measure them is how a measurement becomes an unreviewable diff |
| 3 | `U1` first, or `U5`–`U7` first | **Moot.** `U1` went first, which is what this row recommended. The question has no subject left |

### 7.6 What is deliberately out

- The dashboard's own door and `AccountingBox.tsx`'s trigger — §2 of this document.
  **Amended 2026-08-23:** the new trigger *was* mounted there, and only there
  (`AccountingBox.tsx:31`). Recorded rather than reverted, and it is the right
  call: the dashboard is where the door already worked, and its old control was
  the one missing the five interactive states this block exists to give it.
- The actions-menu restyle, emoji → SVG — `on-hold/PLAN_EDIT_BLOCK/PLAN_ACTIONS_MENU.md`.
- Removing the five commented `<Link>` blocks and the two `.icon3dots` rules —
  the cleanup block (D13). *(Measured 2026-08-30: the commented `<Link>` blocks
  have gone with the rewrites of the screens that held them; what the cleanup
  block still owns is the two now-dead stylesheet rules,
  `forms-styles.css:366` and `accountingDashboard-styles.css:457`.)*
- Migrations. There are none in this block.

---

## 8. Measurements corrected 2026-08-30

Working tree of `fix/auth-screen`, `HEAD` `e919a89`, uncommitted changes
included. Only assertions about the code were touched. No question was closed, no
decision reopened, no unit reordered.

| where | what it said | what the code says |
|---|---|---|
| §2 | the control is inert on five screens, `AccountingBox.tsx:37` renders `.icon3dots`, the two rules are at `forms-styles.css:327` and `accountingDashboard-styles.css:163` | no `.icon3dots` element renders anywhere in `frontend/src`; `AccountingBox.tsx:31-35` renders `AccountActionsTrigger`; the rules are at `:366` and `:457` |
| §2 | the edit route is `App.tsx:376` | `App.tsx:392` |
| §3, dashboard door | `AccountingBox.tsx:32-40`, `AccountingDashboard.tsx:277-288` | `:31-35`, and `handleEditAccount` at `:488-498` with `handleMenuClick` at `:410` |
| §3.1 | `useParams` at `:73`, the fetch at `:93`, `previousRoute` at `:76` | `:96`, `:128`, `:99-100`, plus `originRoute` at `:106` and `returnState` at `:111` |
| §7.3, `U1` | imports at `:47`, `:55`, `:69`; modal at `:629`; field commented at `accountEditSchema.ts:89-94` | `:53`, `:61`, `:74`; modal at `:674`; field commented at `accountEditSchema.ts:87-101` |
| §7.3, `U2` | `notifyAccountChanged()` at `:313` | `:357`; `useBudgetStatusStore.ts:156` is still the subscriber |
| §7.3, `U3` | skeletons at `:443-447` and `:503` | `:485-492` and `:541` |
| §7.3, `U4` | six field lists against six account types | **five** — `accountEditSchema.ts` declares `bank`, `investment`, `income_source`, `category_budget`, `debtor`; `editSchemas.ts:65-69` maps the same five |
| §7.3, `U7` | four of five doors closed, the pocket detail one still dead | **all five sites resolved**; the pocket screen carries no edit control at all |
| §7.3, `U8` | `isDirty` at `:259`, refusal at `:299`, `disabled` at `:650` | `pristineDataRef` at `:241`/`:259`, `isDirty` at `:269-276`, refusal at `:309`, `disabled` at `:661` |
| §7.3.1 | the seven-type catalogue at `005_base_catalogs.sql:36-44`, the detail default at `:444-446` | `:36-45` (rows `:37-43`); the default lookup is `AccountingDashboard.tsx:440`, and `ACCOUNT_TYPE_DETAIL_PAGE` is at `:57-63` |
| §7.3.1, doors table | debtor detail at `DebtorDetail.tsx:208` | `:244` |
| §7.3.2 | the date field is parsed at `:231-234` | **no date field survives in this editor** — the source says so at `EditAccount.tsx:252-254` |
| §7.5, decision 1 | the two `.icon3dots` rules at `:419` and `:327` | `:457` and `:366`, both now dead |

**Verified true and left alone:** everything the reversal block at the head of
the file records about `Q8` and `Q1`, and the endpoint closure of `8fba00e`; the
`U5` finding that `AccountActionsTrigger` carries its own BEM block and its own
stylesheet; the `U6` mechanism — `AccountActionsMenu.tsx:26` makes `onViewDetails`
optional, `:125-129` renders the option only when it is passed, and `:21` takes
`accountName` alone; `CategoryAccountList.tsx:299` and `:312`; the three
`AccountEditLink` call sites as a set; and the two prerequisites of §7.4.

**Left unresolved, and deliberately not answered here:** whether the pocket
detail screen is owed an edit door of its own now that the account editor no
longer configures `pocket_saving`. That is the residue of `U7` and it is a
decision, not a measurement.
