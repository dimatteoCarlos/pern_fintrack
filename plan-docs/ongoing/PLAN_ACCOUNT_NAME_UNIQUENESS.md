# PLAN — ACCOUNT NAME UNIQUENESS, SURFACED IN THE FORM

**Opened 2026-08-26**, from the developer's request: the datalist-assisted name
check that `NewCategory` already has must reach account **edition** and the
remaining **creation** screens, and the Save button must not enable while the
name collides.

`plan-docs/ongoing/` is re-included by `.gitignore:123`. This file is versioned.

---

## 1. Purpose

Every creation path already refuses a duplicate name, and the account editor
refuses one for `category_budget`. All of them refuse it **after** the round
trip, as a red banner over a form the user has finished filling. This block
moves the refusal forward into the form: the names that exist are offered as
suggestions, the collision is stated while the user types, and the submit
control stays disabled until the name is free.

The server checks are the enforcement and do not move. What is added is a
courtesy that fires earlier — and, in one place (unit **U2** below), a server
check that is missing outright.

---

## 2. The exception the developer named — editing only the note must be accepted

This is the rule the whole block turns on, and it is why edition is not a copy
of creation.

> **A name is a duplicate of another account. It is never a duplicate of
> itself.**

Open the account `food/restaurants/must`, change only the note, and a naive
check finds that exact name in the index and calls it taken. The form would
refuse to save an edit that never touched the name.

**The exclusion is by account, not by name.** Two reasons it cannot be done by
remembering the name the form loaded with and comparing against it:

- The name is precisely what may change. A name-to-name exclusion stops holding
  the moment the user edits the field it is meant to protect.
- For `category_budget` and `debtor` the name is **derived** and read-only in the
  form — the user edits category, subcategory and nature, or first name and last
  name, and the server composes. The form has no name field to compare.

**The backend already implements this correctly, and the frontend must mirror it
rather than invent a second rule.** The check that runs on a rename, at
[`accountEditController.js:239-264`](backend/src/fintrack_api/controllers/accountEditController.js#L239-L264),
carries all three predicates the frontend needs:

> **Corrected 2026-08-30.** This paragraph read *"the check that runs when a
> category account is renamed, at `accountEditController.js:183-195`"*. Both
> halves have moved. The check is no longer inside the `category_budget` arm and
> is no longer at those lines: it sits **after** the whole switch, at
> `accountEditController.js:239-264` inside `patchAccountById`, and it fires
> whenever `userAccountFields.account_name !== undefined` — so it covers bank,
> `pocket_saving`, `category_budget` and `debtor` from one place. Unit **U2**
> shipped it; §10 records the commit.

| predicate | why it is there |
|---|---|
| `user_id = $1` | the same name under another owner is not a conflict |
| `account_id <> $3` | **the account does not collide with itself** |
| `deleted_at IS NULL` | a removed account does not hold its name hostage |

Its own comment states the rule in one line: *"the same name under another user
is not a conflict, and neither is the account matching itself."* That predicate,
expressed client-side over the account list, is the whole of unit **U1**.

---

## 3. What the uniqueness key actually is, per account type

The key is not `account_name` everywhere, which is why one generic check will not
serve all four types.

| account type | key the server enforces | where |
|---|---|---|
| `bank`, `cash`, and the other basic types | `account_name` + type, per user, exact match, case folded | [`verifyAccountExistence.js:19-28`](backend/src/utils/fintrackUtils/accountManagement/verifyAccountExistence.js#L19-L28), called from [`accountCreationController.js:139`](backend/src/fintrack_api/controllers/accountCreationController.js#L139) |
| `category_budget` | **two** checks: the composed name + type, then category + subcategory + nature per user | [`accountCategoryCreationcontroller.js:114`](backend/src/fintrack_api/controllers/accountCategoryCreationcontroller.js#L114) and [`:141-163`](backend/src/fintrack_api/controllers/accountCategoryCreationcontroller.js#L141-L163) |
| `pocket_saving` | **no creation key — the account-type creation path is withdrawn.** See the correction below | — |
| `debtor` | the composed `lastname, name` + type | [`accountCreationController.js:503`](backend/src/fintrack_api/controllers/accountCreationController.js#L503), checked at [`:602`](backend/src/fintrack_api/controllers/accountCreationController.js#L602) |

> **Corrected 2026-08-30 — three of the four rows had moved, and one lost its
> subject.** The three creation anchors above are re-read against the working
> tree; the row that changed in kind is `pocket_saving`.
>
> **What the row asserted.** That a pocket is created as a `user_accounts` row of
> type `pocket_saving`, keyed on `account_name` + type, at
> `accountCreationController.js:1021`.
>
> **What the code says.** That file is 986 lines long and exports two handlers
> only, `createBasicAccount` (`:50`) and `createDebtorAccount` (`:460`); there is
> no pocket handler in it. The route that reached one is withdrawn, and
> `accountRoutes.js:57-62` states why in the source: *"The route that created an
> account of the retired pocket type is withdrawn. A pocket is a planning object,
> not an account."* A pocket is now created by `POST /api/fintrack/pocket`
> (`pocketRoutes.js:34`), which lands on `pocketRepository.js:187`,
> `INSERT INTO pockets (...)`.
>
> **The key for a pocket is therefore not "no check yet" but a recorded refusal
> to have one.** Migration `020_create_pocket_tables.sql:80-82` declares it in the
> schema's own comment: *"No unique constraint on (user_id, name). Two goals may
> legitimately share a name, nothing joins a pocket by name, and rejecting a
> rename for a reason the owner cannot see is worse than a duplicate label."*
> Whether this block still wants a client-side name check on the pocket form is a
> **fresh decision**, not a gap — it is unit **U6**, marked at §7.

**The two composed names, and the good news about both.**

- `category_budget` stores `category/subcategory/nature`, lowercased, built at
  [`accountCategoryCreationcontroller.js:70-73`](backend/src/fintrack_api/controllers/accountCategoryCreationcontroller.js#L70-L73).
  The frontend helper
  [`buildCategoryAccountName`](frontend/src/fintrack/helpers/newCategoryHelper.ts#L80)
  composes **the identical string** — verified 2026-08-26, same separator, same
  lowercasing, same trimming. It is reusable as-is; the rule is not duplicated.
- `debtor` stores `${lastname}, ${name}` with each part passed through
  [`normalizePersonName`](backend/src/utils/helpers.js#L62) — whitespace
  collapsed, **case left as typed**, because capitalisation like `O'Connor` is
  user data. There is **no frontend counterpart of this helper today**; one has
  to be written for unit **U7**, and it must collapse whitespace without
  touching case, or the client check and the server check will disagree on
  `Van  Dyke`.

---

## 4. The audit — what the five screens do today

| screen | suggestions | live message | blocks the button |
|---|---|---|---|
| [New Category](frontend/src/fintrack/pages/forms/newCategory/NewCategory.tsx) | yes, two `datalist` — category [:500](frontend/src/fintrack/pages/forms/newCategory/NewCategory.tsx#L500) and subcategory [:535](frontend/src/fintrack/pages/forms/newCategory/NewCategory.tsx#L535) | yes, and the nature tiles re-fire it [:323](frontend/src/fintrack/pages/forms/newCategory/NewCategory.tsx#L323) | **no** — [:648](frontend/src/fintrack/pages/forms/newCategory/NewCategory.tsx#L648) gates on `isLoading` alone |
| [New Account](frontend/src/fintrack/pages/forms/newAccount/NewAccount.tsx) | yes, one `datalist` [:421](frontend/src/fintrack/pages/forms/newAccount/NewAccount.tsx#L421) | yes [:124](frontend/src/fintrack/pages/forms/newAccount/NewAccount.tsx#L124), re-checked when the type changes [:218](frontend/src/fintrack/pages/forms/newAccount/NewAccount.tsx#L218) | **no** — [:492-497](frontend/src/fintrack/pages/forms/newAccount/NewAccount.tsx#L492-L497), `disabled={isLoading \|\| isFormDisabled}` |
| [New Pocket](frontend/src/fintrack/pages/forms/newPocket/NewPocket.tsx) | no | no | no — [:435](frontend/src/fintrack/pages/forms/newPocket/NewPocket.tsx#L435), `disabled={isSubmitting \|\| isFormDisabled}` |
| [New Profile](frontend/src/fintrack/pages/forms/newProfile/NewProfile.tsx), which creates a debtor | no | no | no |
| [Edit Account](frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx), the **five** types it configures | no | no | no — [:661](frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx#L661) gates on `isFormDisabled \|\| !accountId \|\| !isDirty` |

> **Corrected 2026-08-30 — four of the five rows had drifted.** The three submit
> anchors are re-read above. Two corrections are not just line numbers:
>
> - **The editor's gate is no longer `isDirty` alone.** It is
>   `isFormDisabled || !accountId || !isDirty` at `EditAccount.tsx:661`, so a
>   name-collision gate joins an expression that already has three terms rather
>   than replacing a single one.
> - **The editor no longer covers four types; it covers five, and `pocket_saving`
>   is not among them.** `accountEditSchema.ts` declares field lists for `bank`
>   (`:63`), `investment` (`:64`), `income_source` (`:68`), `category_budget`
>   (`:74`) and `debtor` (`:146`), and `editSchemas.ts:65-69` maps those same
>   five. `EditAccount.tsx:252-254` states the reason in the source: *"a pocket is
>   edited on its own screen now — this editor no longer reaches one."* Unit
>   **U3** therefore has five types to serve, of which two carry a composed key.

**The shared piece already exists and already holds enough data.**
[`useAccountExistence`](frontend/src/fintrack/hooks/useAccountExistence.ts)
requests `/account/allAccounts`, which returns every account of the user of
**every** type with its `account_type_name`. No new endpoint and no new payload
is needed anywhere in this block. What it lacks is the account identifier, which
is what the self-exclusion of §2 requires.

---

## 5. Two server-side gaps found while measuring this

Recorded here because the frontend guard is a courtesy and the enforcement has
to exist underneath it.

**~~The rename is unchecked for three of the four types.~~ CLOSED — measured
2026-08-30, it is one check covering every type.** The passage below is the
diagnosis unit **U2** was written against; it is kept because it is what the fix
was measured against, and struck because the code no longer reads that way.

> **What this passage asserted.** That the switch at
> `accountEditController.js:89` ran the name-collision query in the
> `category_budget` arm only, that `bank` and `pocket_saving` wrote
> `payload.account_name` straight through, and that the `debtor` arm rebuilt the
> composed name and then did not check it — so two accounts of one type could be
> made to share a name by renaming one of them.
>
> **What the code says today.** One collision query, at
> `accountEditController.js:239-264`, placed **after** the switch and guarded by
> `if (userAccountFields.account_name !== undefined)`. It keys on
> `ua.user_id` + `LOWER(ua.account_name)` + `LOWER(act.account_type_name)`,
> excludes the row itself (`ua.account_id <> $4`) and excludes soft-deleted rows
> (`ua.deleted_at IS NULL`), and answers `400` on a hit (`:257-262`). The switch
> above it only *derives* the name: `category_budget` composes it at `:174-176`,
> `debtor` at `:219`. So all four types are covered from one place, and the
> `pocket_saving` arm at `:90-102` no longer has a rename to leak because the
> editor does not reach a pocket at all (§4).
>
> **The comment in the source states the same thing** at `:225-238`: *"Creation
> refuses a duplicate for every account type; edition only did it inside the
> `category_budget` arm … Placed after the switch because the name is not always
> the payload's."*
>
> Unit **U2** shipped. §10 carries the commit and the one deliberate difference
> from the plan (the lifted check gained the account-type predicate).

- `bank` and the other basic types take `payload.account_name` verbatim at
  [`:57-60`](backend/src/fintrack_api/controllers/accountEditController.js#L57-L60)
  and are then checked at `:239-264` like every other type.

**A soft-deleted account still holds its name at creation.**
`verifyAccountExistence` does not filter `deleted_at`
([`verifyAccountExistence.js:19-28`](backend/src/utils/fintrackUtils/accountManagement/verifyAccountExistence.js#L19-L28)),
so the name of a removed account cannot be reused. Already recorded in the
comment at
[`accountCategoryCreationcontroller.js:137-140`](backend/src/fintrack_api/controllers/accountCategoryCreationcontroller.js#L137-L140).
Verified still true 2026-08-30.
**Out of scope for this block** — it is a deletion-semantics decision, not a form
one, and it belongs beside `PLAN_ACCOUNT_DELETION.md`.

---

## 6. The shared piece — what `useAccountExistence` becomes

One hook change, no visible effect, landing before any screen consumes it.

- **The index carries the account identifier.** `AccountListItem` gains
  `account_id`, and the per-type map goes from a `Set` of names to the pairs
  name/id, so a match can be discarded when it is the account being edited.
- **`checkDuplicate` takes an optional account to exclude**, applying exactly the
  predicate of §2. Absent, it behaves as it does today, so both call sites that
  exist now are untouched.
- **The loading state is exposed to the caller and means "unknown", not
  "free".** Today `checkDuplicate` returns `false` while the request is in
  flight, because the index is empty — a false negative. Harmless while the
  result only paints a message; the moment it gates the submit button, the form
  would let a duplicate through during the first moments on screen.
  **Recommendation: do not block while the index is loading**, and do not claim
  the name is available either — the server still enforces, and a button that
  starts disabled for no visible reason is worse than a late message.
- **Suggestions honour the same exclusion** so the account being edited does not
  offer its own name back as a suggestion.

---

## 7. The units, one commit each, in order

The order is not preference: **U1** is a dependency of everything after it, and
**U2** is the enforcement that **U3** presents. The five screen units are
independent of one another and can be reordered freely.

| unit | what it does | files |
|---|---|---|
| **U1** — the shared check learns to exclude an account | index by id, optional exclusion, loading exposed. No visible change | [`useAccountExistence.ts`](frontend/src/fintrack/hooks/useAccountExistence.ts) — **shipped, §10** |
| **U2** — the rename is checked for every type | lift the collision query out of the `category_budget` arm so it runs whenever `account_name` is being written, composed or typed | [`accountEditController.js:239-264`](backend/src/fintrack_api/controllers/accountEditController.js#L239-L264) — **shipped, §10** |
| **U3** — the account editor states the collision | suggestions, live message and the button gated, for the **five** types the editor configures; the composed key for `category_budget` and `debtor` | [`EditAccount.tsx`](frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx), [`UniversalDynamicInput.tsx`](frontend/src/fintrack/editionAndDeletion/pages/editionAccount/UniversalDynamicInput.tsx) |
| **U4** — New Category gates its button | the message exists; wire it into the submit control | [`NewCategory.tsx:648`](frontend/src/fintrack/pages/forms/newCategory/NewCategory.tsx#L648) |
| **U5** — New Account gates its button | same, plus the message currently lands in the field's validation channel and has to survive the gate | [`NewAccount.tsx:492-497`](frontend/src/fintrack/pages/forms/newAccount/NewAccount.tsx#L492-L497) |
| **U6** — New Pocket gets the whole thing | suggestions, message, gate. Nothing exists today | [`NewPocket.tsx`](frontend/src/fintrack/pages/forms/newPocket/NewPocket.tsx) — **premise gone, see the block below** |
| **U7** — New Profile gets the whole thing | same, on the composed `lastname, name`, and it needs the frontend counterpart of the person-name normaliser | [`NewProfile.tsx`](frontend/src/fintrack/pages/forms/newProfile/NewProfile.tsx), plus one helper |

> ### ⚠️ Unit **U6** cannot be implemented as written — measured 2026-08-30
>
> Not struck, not closed. It needs a fresh decision before anyone opens
> `NewPocket.tsx`.
>
> **What the unit asserts.** That the pocket creation form writes a
> `user_accounts` row of type `pocket_saving`, so the same uniqueness key the
> other creation screens use (`account_name` + type, per user, §3) applies to it,
> and the whole apparatus of this block — suggestions from
> `/account/allAccounts`, live message, submit gate — transfers to that form
> unchanged.
>
> **What the code says.** The form no longer writes a `user_accounts` row at all.
> `NewPocket.tsx:197-211` builds a `CreatePocketBody`
> — `{ name, currency, targetAmount, desiredDate, note? }` — and calls
> `createPocket` from `frontend/src/fintrack/api/pocketApi.ts`, which `POST`s
> `/api/fintrack/pocket`. That route is `pocketRoutes.js:34`; it lands on
> `pocketWriteService` and on `pocketRepository.js:187`,
> `INSERT INTO pockets (...)`. There is no `INSERT INTO user_accounts` anywhere on
> that path, and the account-type creation route is withdrawn on purpose
> (`accountRoutes.js:57-62`).
>
> Two consequences follow, and each removes a different leg of the unit:
>
> - **The index the check reads does not contain pockets any more.**
>   `useAccountExistence` requests `/account/allAccounts`
>   (`getAccountController.js:511-522`), which selects from `user_accounts`. A row
>   in `pockets` is invisible to it, so a client check built on that index would
>   report every pocket name free however many pockets exist.
> - **The server has decided the opposite rule for pockets, in writing.**
>   `020_create_pocket_tables.sql:80-82`: *"No unique constraint on (user_id,
>   name). Two goals may legitimately share a name, nothing joins a pocket by
>   name, and rejecting a rename for a reason the owner cannot see is worse than a
>   duplicate label."* A form that gated its submit on a duplicate pocket name
>   would state a rule the server does not keep — which is the failure mode
>   decision **D-e** exists to prevent, read in the other direction.
>
> **The unit therefore needs a fresh decision**, and it is a product one, not a
> line of code: does a pocket name have to be unique at all? If no, **U6** is not
> a screen to build but a unit to retire deliberately. If yes, it grows a server
> half in `pocketWriteService` and a source of truth that is the `pockets` table,
> neither of which this plan has scoped. The unit and its position in the order
> are left exactly as written until that is settled.

**Why the editor is one unit and not four.** Its fields are rendered from a
single configuration list through one dynamic input component, so the types
differ in *which key to compose*, not in *where the control lives*. Splitting it
per type would mean several commits touching the same two files. *(Corrected
2026-08-30: the editor configures five types, not four — §4.)*

**Unit U3 carries a wrinkle the creation screens do not have.** For
`category_budget` the key is composed from three separate controls — category,
subcategory and nature — while `account_name` sits above them read-only and
server-built
([`accountEditSchema.ts:74-141`](frontend/src/fintrack/editionAndDeletion/validations_zod/accountEditSchema.ts#L74-L141),
the read-only `account_name` entry at
[`:76-84`](frontend/src/fintrack/editionAndDeletion/validations_zod/accountEditSchema.ts#L76-L84),
whose `helpText` already says *"Built by the server from Category, Subcategory
and Nature"*).
The message therefore belongs to the composed value, not to any one of the three
fields that feed it. See decision **D-b**.

---

## 8. Open decisions

**D-a — does the editor's suggestion list include the account's own name?**
Recommendation: **no**. It is excluded from the collision check, so offering it
as a suggestion invites the user to type a name the form will then accept for a
reason they cannot see. Exclude it from both.

> **SETTLED 2026-08-30 — no.** Taken as recommended. The suggestion builder
> takes the same optional account to exclude as the collision check, so the two
> can never disagree about which account is exempt.

**D-b — where does the message sit when three fields compose one key?**
Recommendation: **under the read-only composed name**, which is the only place on
screen that represents the key being tested. Attaching it to whichever of the
three fields was typed last would move the message around as the user works.

**D-c — how faithfully must the client mirror the person-name normaliser?**
Recommendation: **write one small frontend helper that collapses whitespace and
leaves case alone**, matching [`normalizePersonName`](backend/src/utils/helpers.js#L62)
exactly. Anything looser and the client will disagree with the server on names
that differ only by spacing.

**D-d — block the submit while the account index is still loading?**
Recommendation: **no**, per §6. Allow it and let the server refuse; a disabled
button with no stated reason is the worse failure.

> **SETTLED 2026-08-30 — no, the submit is not blocked while the answer is
> unknown.** Taken as recommended. The check now returns three states rather
> than a boolean, so a screen can tell "no collision" from "no answer yet" and
> present the third state without disabling the control. The server enforces
> underneath either way, and the enforcement is now complete for all four types
> (the rename check of unit **U2**, shipped), so an unknown that slips through
> is refused with a message rather than saved.

**D-e — does U2 belong to this block or to the edit block?**
Recommendation: **this block**. It is the enforcement that unit **U3** brings
forward; splitting them ships a form that states a rule the server does not keep.

> **SETTLED 2026-08-30 — this block, and it shipped second, before any form
> work.** Taken as recommended, for the reason given: the editor cannot state a
> rule the server does not keep.

---

## 9. Verification

There is no test runner. Verified means exercised by hand.

1. **The exception holds.** Open an account of each of the four types, change
   only the note, save. All four accept.
2. **The collision is stated before the request.** Rename an account onto the
   name of another of the same type: the message appears while typing and the
   button does not enable. No request is sent.
3. **The composed keys behave.** For a category account, produce the collision by
   changing only the nature, and separately by changing only the subcategory. For
   a debtor, produce it by changing only the first name.
4. **The type is part of the key.** A bank account and a pocket may share a name;
   creating the second is not refused.
5. **The server still refuses on its own.** With the frontend guard bypassed,
   `PATCH` a rename onto a taken name for each type the editor configures and
   confirm the `400`. *(Corrected 2026-08-30: the tail of this item read "which
   today only `category_budget` returns (unit **U2**)". Unit **U2** shipped —
   `accountEditController.js:239-264` answers `400` for every type — so this item
   is now a regression check, not a known failure.)*
6. **The first seconds on screen.** Reload the editor and submit immediately: the
   form does not block, and a duplicate submitted that way is refused by the
   server with its message shown.
7. On-screen pass at 360, 480 and 768px on the five screens, with the message
   present and absent, since it changes the height of the form.
8. `git status` clean of `plan-docs/`.
## 10. What shipped, and three measurements that corrected this plan

**Shipped 2026-08-30**, in this order, one commit each:

| unit | commit | file |
|---|---|---|
| **U1** — the shared check learns to exclude an account | `feat(accounts): tri-state name check keyed by id` | `useAccountExistence.ts` |
| **U2** — the rename is checked for every type | `fix(account): check rename for every account type` | `accountEditController.js` |

**What the shared check now exposes.** The index is keyed by account type and
holds identifier/folded-name pairs rather than a `Set` of names. Three entry
points, all taking the same optional account to exclude:

- `checkNameCollision(name, type, excludeAccountId?)` returns `'taken'`,
  `'free'` or `'unknown'`. This is the one a submit gate must read.
- `checkDuplicate(name, type, excludeAccountId?)` keeps the boolean shape the
  two creation screens already destructure, reading `'unknown'` as
  not-a-duplicate. Both existing call sites are untouched, which matters
  because `NewAccount.tsx` is held by another writer.
- `getSuggestions(type, excludeAccountId?)` applies the same exclusion (**D-a**).
- `isIndexReady` is exported alongside `isLoading` for a caller that needs the
  waiting state independently of any particular name.

**Correction 1 — the false negative is wider than "while the request is in
flight".** §6 attributes it to the loading window. Measured: `useFetch`
initialises `isLoading` to `false`
([`useFetch.ts:27-34`](frontend/src/fintrack/hooks/useFetch.ts#L27-L34)) and
only sets it inside the effect, so the very first render is neither loading nor
answered — a screen gating on `isLoading` alone would still read a false "free"
there. The implemented predicate for *answered* is therefore "an account array
actually came back", not "not loading".

**Correction 2 — the rename check the plan says to lift was keyed more widely
than creation is.** The query, now at
[`accountEditController.js:240-255`](backend/src/fintrack_api/controllers/accountEditController.js#L240-L255)
*(anchor corrected 2026-08-30 — this line read `:183-190`, which is where the
pre-**U2** query sat inside the `category_budget` arm)*,
carried no account-type predicate, so it refused renaming a category onto a name
held by an account of *any* other type. Creation keys on name **plus type**
(§3), and so does the client-side check of **U1**. Lifting it verbatim would
have made the server refuse renames no screen warns about, and would contradict
verification item 4 of §9. The lifted check therefore joins `account_types` and
adds `LOWER(act.account_type_name) = LOWER($3)`. Net effect: rename and creation
now enforce the same key, and the `category_budget` rename is slightly *less*
strict than before, deliberately.

**Correction 3 — the client index contains soft-deleted accounts, and that is
the right behaviour today.** `/account/allAccounts`
([`getAccountController.js:511-522`](backend/src/fintrack_api/controllers/getAccountController.js#L511-L522))
has no `deleted_at` filter, and soft deletion only stamps the column
([`deleteAccountService.js:395`](backend/src/fintrack_api/services/delete_account/deleteAccountService.js#L395)).
*(Both anchors re-read 2026-08-30; they were `:490-500` and `:368`. The claim
itself still holds — and note that the same query now serves a **derived**
`account_balance` at `:512`, which changes nothing for a name index.)*
So the client check reports a removed account's name as taken. That **matches
`verifyAccountExistence` at creation**, which does not filter `deleted_at`
either, so the creation screens stay truthful. It **does not match the rename
check**, which does filter it — so on the editor a removed account's name will
be reported as taken by the form and accepted by the server. That is the
false-positive direction, and it is the same deletion-semantics decision §5
already sends to `PLAN_ACCOUNT_DELETION.md`; it must be settled there before
unit **U3** gates a button on it.

**Ownership transferred 2026-08-30.** Whether a soft-deleted account keeps
holding its name is **not decided in this document**. It belongs to the
account-deletion block, and the owning document is
`plan-docs/ongoing/PLAN_ACCOUNT_DELETION.md`.

**The inconsistency is live, and that is what makes the transfer urgent.** The
client index and the creation check both treat a removed account's name as
taken; the new rename check does not. So the editor's form will call a name
taken that the server accepts.

---

## 11. Measurements corrected 2026-08-30

Working tree of `fix/auth-screen`, `HEAD` `e919a89`, uncommitted changes
included. Only assertions about the code were touched; no decision, no
recommendation and no unit order was altered.

| where | what it said | what the code says |
|---|---|---|
| §2 | the rename check is the `category_budget` arm's, at `accountEditController.js:183-195` | one check for every type, after the switch, at `:239-264` |
| §3, basic types | creation calls `verifyAccountExistence` at `accountCreationController.js:131` | `:139` |
| §3, `category_budget` | `accountCategoryCreationcontroller.js:113` and `:140-161` | `:114` and `:141-163`; the composed name is built at `:70-73` |
| §3, `pocket_saving` | a creation key enforced at `accountCreationController.js:1021` | **the account-type creation route is withdrawn** (`accountRoutes.js:57-62`); a pocket is created through `POST /api/fintrack/pocket` into the `pockets` table, and `020_create_pocket_tables.sql:80-82` refuses a unique constraint on the name deliberately |
| §3, `debtor` | composed at `:482`, checked at `:581` | `:503` and `:602` |
| §4 | New Account submits at `:495`, New Pocket at `:477`, the editor at `:650` gating on `isDirty` alone, over four types | `:492-497`, `:435`, and `:661` gating on three terms, over **five** types with `pocket_saving` absent |
| §5 | the rename is unchecked for three of the four types | false — one site covers all four; the passage is kept struck with the measurement beneath it |
| §5 | the soft-delete note sits at `accountCategoryCreationcontroller.js:136-139` | `:137-140`; the claim itself still holds |
| §7 | **U2** pending, **U3** over four types, **U6** implementable as written | **U2** shipped; **U3** has five types; **U6** is marked — its premise is gone |
| §7 | the composed-key wrinkle at `accountEditSchema.ts:78-133` | `:74-141`, read-only entry at `:76-84` |
| §9, item 5 | only `category_budget` returns the `400` today | every type does |
| §10, correction 2 | the lifted query was at `accountEditController.js:183-190` | it now stands at `:240-255` |
| §10, correction 3 | `getAccountController.js:490-500`, `deleteAccountService.js:368` | `:511-522`, `:395` |

**Verified true and left alone:** the three predicates of §2 (owner, self, soft
delete) and the source comment that states them; `verifyAccountExistence.js:19-28`
and its throw at `:42-46`; `newCategoryHelper.ts:80`; `normalizePersonName` at
`backend/src/utils/helpers.js:62`; every anchor of §6 and of §10's correction 1,
including `useFetch.ts:27-34`; the New Category datalists at `:500` and `:535`,
its nature re-fire at `:323` and its submit at `:648`; the New Account datalist at
`:421`, its debounced check at `:124` and its type re-check at `:218`; the whole
of `useAccountExistence.ts` as §10 describes it — three entry points, the
tri-state return, and `isIndexReady` beside `isLoading`.

**One thing this correction pass could not settle**, and it is left open rather
than answered: whether the pocket form still needs a name check at all (unit
**U6**). The block at §7 states the measurement; the decision is the developer's.

