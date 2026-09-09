# Fixes log — how each defect was corrected

One entry per corrected defect, newest first. Each entry carries the code before
and after, why that fix was chosen over the alternative, and the lesson it leaves
for the next defect of the same shape.

The backlog files say **what** is resolved and with which proof. This file says
**how** and **why**. An entry is written when the commit lands, not before.

**Entry template:** symptom · mechanism · code before and after · why not the
other fix · blast radius measured · how it was verified · lesson.

---

## 2026-09-09 · `2f641f3a` · A broken token answered 403, not 401

**Backend** · group: Authentication · severity 🔴

### Symptom

Two visible failures with one cause. On every mount the session bootstrap
revalidates the stored token; an altered or not-yet-valid token ended the session
**without the refresh ever being tried**, even with a live refresh cookie. And on
the change-password screen a broken token was reported to the owner as *wrong
current password* — their own typo.

### Mechanism

`handleTokenError` is called from exactly two places, both authentication guards:
`verifyToken` (`authMiddleware.js:152`) and `verifyUser` (`:170`). It answered 403
for two of the three checks `jwt.verify` performs, and for the unnamed fallback.

The client cannot act on that. Its retry branch tests 401 only
(`authFetch.ts:58`), so the 403 fell through to the generic throw; `useAuth.ts:206-211`
catches any error and calls `invalidateSession`. The session did end — by a blanket
catch, in the one case that should have recovered silently.

### Code

```js
// backend/src/auth_api/middlewares/authMiddleware.js:21-25 — before
const TOKEN_ERRORS = {
  TokenExpiredError: { message: 'Token expired.', status: 401 },
  JsonWebTokenError: { message: 'Invalid token.', status: 403 },
  NotBeforeError: { message: 'Token not yet active.', status: 403 },
};

// after
const TOKEN_ERRORS = {
  TokenExpiredError: { message: 'Token expired.', status: 401 },
  JsonWebTokenError: { message: 'Invalid token.', status: 401 },
  NotBeforeError: { message: 'Token not yet active.', status: 401 },
};
```

```js
// backend/src/auth_api/middlewares/authMiddleware.js:110-113 — before
const errorConfig = TOKEN_ERRORS[error.name] || {
  message: 'Invalid token. Please sign in again.',
  status: 403,
};

// after — same block, status 401
```

No frontend line changed.

### Why not the fix the backlog proposed

The backlog entry said to widen `authFetch.ts:58` to also catch 403. That would
sign out anyone who mistyped their current password, because in this app 403 is
almost always a domain refusal:

| 403 emitted for | where |
| :--- | :--- |
| resource ownership | `authMiddleware.js:212` |
| someone else's pocket or budget account | `pocketController.js:10`, `budgetController.js:83,172` |
| transactions on an account that is not the caller's | `getTransactionsForAccountById.js:118` |
| the reserved compensation account | `deleteAccountService.js:1601` |
| **a wrong current password** | `userController.js:352`, with `403: Current password wrong (NO logout)` written at `:293` |

Only three 403s in the whole backend meant *broken token*. Moving those three is
one edit in one file; the client-side alternative needs an exemption list that
grows with every new endpoint.

### The test that decides which status applies

> **Would presenting a fresh token change the outcome?**
> Yes → 401. No → 403.

| what `jwt.verify` checks | claim | error | fresh token helps? | was | now |
| :--- | :--- | :--- | :--- | :--- | :--- |
| not expired | `exp` | `TokenExpiredError` | yes | 401 | 401 |
| signature authentic, format well-formed | signature | `JsonWebTokenError` | yes | **403** | **401** |
| already in effect | `nbf` | `NotBeforeError` | yes | **403** | **401** |
| anything unnamed | — | — | yes | **403** | **401** |

### Blast radius measured before the change

Everything behind the two guards: the whole `/api/fintrack` tree
(`app.js:187` — currency, account, transaction, dashboard, budget, pocket,
overview), `GET /validate-session` (`authRoutes.js:31`), `PATCH /update-profile`
(`userRoutes.js:33`), `GET /profile` (`:42`), `PATCH /change-password` (`:47`),
`GET /:userId` (`:40`) and four account routes (`accountRoutes.js:128,139,158,183`).

Frontend consumers of 403 checked before editing: `useAuth.ts:503-504` (reads it
as a wrong password — improved by the change), `handleError.ts:13`
(`isAuthError: 401 || 403`, unchanged in effect) and its single reader
`Expense.tsx:573`, which only suppresses a toast and never signs anyone out.

### Verified

`APP LOADED OK` on boot, exit 0. Backend suite: 71 pass, 0 fail.

### Lesson

**An HTTP status is an instruction to the client about what to do next, not a
label for how bad the failure was.** Before reusing a status, enumerate every
place that already emits it. If two of those places need opposite client
reactions — recover silently versus show the user a message — one of them is
wrong, and it is usually not the one you were about to edit.

**And: when a backlog entry names the fix, verify the fix, not only the symptom.**
This entry had the symptom right and the remedy backwards. A fix applied where the
note pointed would have created a worse defect than the one it closed.

**Left recorded, out of scope:** the refresh endpoint still answers 403 for an
invalid refresh signature (`authRefreshToken.js:36,124`). Same inconsistency, not
a live defect — `authRefreshManager` invalidates on any rejection without reading
the status.

---

## 2026-09-09 · `36353a96` · A null column made the whole account uneditable

**Frontend** · group: Account editor register (E-1) · severity 🔴

### Symptom

An account with a `NULL` in `subcategory`, `debtor_name` or `debtor_lastname`
could not be saved at all — not the offending field, the entire form. The owner
saw `Please fix validation errors` with no field marked.

### Mechanism

Three parts, each harmless alone:

1. The seeding effect copied every value that was not `undefined`, so a database
   `NULL` entered form state as `null` (`EditAccount.tsx:251`).
2. Those three fields are validated with `optionalButNotEmptySchema`, which is
   `.optional()` — it accepts `undefined` and rejects `null`
   (`editSchemas.ts:39,55,56` → `commonEditionSchemas.ts:122`).
3. One field error aborts the whole submit, not that field
   (`EditAccount.tsx:325-334`).

### Code

```tsx
// frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx:251
// before
if (val !== undefined) {
  initialData[field.fieldName] =
    val as GenericEditFormData[keyof GenericEditFormData];
}

// after
// null is dropped with undefined: the field schemas are .optional(),
// so a NULL column seeded as null fails validation and aborts the
// whole submit, not just its own field.
if (val !== undefined && val !== null) {
  initialData[field.fieldName] =
    val as GenericEditFormData[keyof GenericEditFormData];
}
```

### Why normalise at load and not loosen the schemas

Making the schemas `.nullish()` would let a `null` through to the PATCH — and that
endpoint carries **no validation middleware** (`accountRoutes.js:104`), so the
frontend schema is the only gate on the payload. The schema describes what leaves
towards the server; the loader describes what enters the form. The absent key is
what the endpoint already treats as *no change*.

The convention was already established elsewhere and this screen was the outlier:

| screen that hydrates from the server | how it handles `null` |
| :--- | :--- |
| `EditPocket.tsx:143,147` | `pocket.note ?? ''`, `fromCalendarDay(...) ?? startOfToday()` |
| `profileTransformation.ts:52-59` (`storeToForm`) | `\|\|` or `??` on all five fields |
| `EditAccount.tsx:251` | **passed `null` through** — the only one |

### Blast radius measured before the change

The pattern was searched across `frontend/src`. The other eighteen `!== undefined`
sites are render guards (`UniversalDynamicInput.tsx:96`, `SummaryDetailBox.tsx:71`,
`PocketFundingAccounts.tsx:180`) or outbound payload cleaners
(`profileTransformation.ts:154`, `safeMergeUser.ts:27`) — none hydrates a form
against a Zod schema.

**No regression on the save button.** `isDirty` compares the form against a
snapshot taken at load (`EditAccount.tsx:241,259,269-277`) using `areValuesEqual`,
which is strict identity (`:79-83`). The key now disappears from both sides at
once, so `undefined === undefined` keeps an untouched form clean, exactly as
`null === null` did.

**Nothing changed on screen.** `UniversalDynamicInput.tsx:96` already rendered
`null` and `undefined` identically as an empty input.

### Verified

`tsc -p tsconfig.app.json --noEmit` exit 0; `npm run build` exit 0, built in 10.05s.

### Lesson

**Normalise at the boundary where data enters, never by widening the validator.**
When a value the validator rejects is already inside your state, the reflex is to
make the validator accept it. That moves the bad value one step closer to the
database instead of one step further away — and here the next step had no gate at
all.

**A guard written against one absent-value shape only covers that shape.**
`!== undefined` reads as "skip what is missing", but SQL has two ways to be
missing and JavaScript has two more. When a value crosses from a database into a
form, decide explicitly what each of them becomes.

**And check what the neighbours already do.** Two of the three screens had the
right convention. The fix was not invention, it was alignment — which is also why
it carried no risk.
