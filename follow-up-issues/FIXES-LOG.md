# Fixes log — how each defect was corrected

One entry per corrected defect, newest first. Each entry carries the code before
and after, why that fix was chosen over the alternative, and the lesson it leaves
for the next defect of the same shape.

The backlog files say **what** is resolved and with which proof. This file says
**how** and **why**. An entry is written when the commit lands, not before.

**Entry template:** symptom · mechanism · code before and after · why not the
other fix · blast radius measured · how it was verified · lesson.

---

## The lesson is typed, and it carries both versions of the code

**In force for every entry written from 2026-09-09 onward. The four entries below
predate the rule and are NOT rewritten to it** — a lessons log is a record of what
was learned when, and back-dating its form would misrepresent when each lesson was
actually available.

Every new entry closes with a `### Lesson` section built from three required
parts, in this order:

| part | what it must contain |
| :--- | :--- |
| **Type** | one label from the table below, on its own line as `**Type:** <label>` |
| **Wrong** | the erroneous code, in a fenced block, exactly as it stood — not paraphrased, not shortened to the offending token |
| **Right** | the corrected code, in a fenced block, from the same file and the same scope, so the two blocks can be read side by side |

The prose that follows states what the type means **in this codebase**, and what
to check to catch the next one before it ships. Prose alone is not a lesson: a
reader who has not seen the defect cannot recognise a shape from a description of
it, only from the two versions of the code.

### The types

A closed list, so the same defect is filed under the same name twice. It grew out
of the defects this repository has actually produced; a defect that fits none of
these gets a new row added here in the same commit, never a free-text label.

| type | what makes a defect this type |
| :--- | :--- |
| `unchecked-boundary` | a value enters the program from outside — environment, response body, query string, form — and is typed or trusted without being validated |
| `contract-mismatch` | two sides of a boundary disagree about the accepted shape or value, and the disagreement is only visible at runtime |
| `duplicated-constant` | one number or value is written in more than one place, so the places can drift apart silently |
| `unit-error` | an expression mixes units, or applies the same conversion factor twice, producing a comparison that cannot fail or cannot succeed |
| `wrong-protocol-semantics` | the mechanism works and reports the wrong standard code or state, so a correct caller reacts wrongly |
| `stale-reference` | code, comment or document points at a file, line, column or value that has since moved or changed meaning |
| `silent-fallback` | a failure is absorbed by a default that keeps the program running and produces a wrong result nothing throws on |

---

## 2026-09-09 · `4a840346` · A cast that laundered an unchecked currency code

**Frontend** · group: Locale and money formatting · severity 🟡

### The backlog was wrong about where the defect was

The entry said the money formatter's default currency is written upper case
against an all-lower-case catalog, so the lookup returns `undefined` and the
formatter falls back to the machine's locale. The symptom was right. The location
was not, and the fix it implied would have changed three literals that break
nothing.

Measured, the three upper-case `'USD'` defaults in `helpers/functions.ts` reach
only consumers that do not care about case:

| default | consumer | why case cannot matter |
| :--- | :--- | :--- |
| `:39` `currencyFormat` | `Intl.NumberFormat({ currency })` | Intl resolves an ISO code case-insensitively |
| `:71` `getCurrencySymbol` | its own comparison at `:74` | upper-cases both sides before comparing |
| `:238` `validCurrencyCodes` | `isValidCurrencyCode` at `:257` | upper-cases the input against an upper-case set |

And no call site indexes the locale map with either default: all 23 uses of
`CURRENCY_OPTIONS[...]` pass `DEFAULT_CURRENCY`, or a `currency_code` the API can
only emit lower case, because its validators derive from `SUPPORTED_CURRENCIES`
in `backend/src/fintrack_api/services/fx_services/core/fxConfig.js:40`.

### Where the same symptom was actually reachable

One file away, in how the default is built:

```ts
// helpers/currencyConstants.ts:73-74 — before
export const DEFAULT_CURRENCY = (import.meta.env
 .VITE_ACCOUNTING_CURRENCY_CODE || 'usd') as CurrencyType;
```

`CurrencyType` is a lower-case-only union (`types/types.ts:214`), so the `as`
asserts a shape the value was never checked against. An operator who sets
`VITE_ACCOUNTING_CURRENCY_CODE=USD` — the natural way to write a currency code —
type-checks clean and leaves `CURRENCY_OPTIONS[DEFAULT_CURRENCY]` `undefined` at
every one of those 23 sites, sending each formatter to the machine's locale
without throwing.

### Code

```ts
// helpers/currencyConstants.ts — after
const declaredCurrency = String(
 import.meta.env.VITE_ACCOUNTING_CURRENCY_CODE ?? '',
).toLowerCase();

// The cast cannot check the value, so the value is checked here. A key that is
// not in CURRENCY_OPTIONS leaves every lookup undefined and the formatters fall
// back to the machine's locale without throwing -- 'USD' does it by case, 'gbp'
// by not being supported.
export const DEFAULT_CURRENCY = (
 SUPPORTED_CURRENCIES.includes(declaredCurrency as CurrencyType)
  ? declaredCurrency
  : 'usd'
) as CurrencyType;
```

### Why the guard checks membership and not only case

Lower-casing alone fixes `USD` and leaves `gbp` producing the identical
`undefined`. Both are the same failure — a key the map does not hold — and the
membership test costs the same expression, so splitting them into a fixed case
and an open one would have been an arbitrary line.

### Blast radius

Zero today. `VITE_ACCOUNTING_CURRENCY_CODE` is set in no `.env` in the repository,
so the fallback `'usd'` applied before and applies now. The defect was reachable
only the first time the variable is set in Vercel — which is precisely when it
would have been hardest to attribute, since nothing throws and every figure still
prints.

### Verified

`tsc -p tsconfig.app.json --noEmit` exit 0. `npm run build` exit 0.

### Lesson

**A type assertion is not a check; it is a promise that something else checked.**
`as CurrencyType` told the compiler the value belonged to a six-member union and
nothing ever tested that it did. Wherever a value crosses into the program from
outside — an environment variable, a response body, a query string — the cast at
the boundary is the exact place a wrong value stops being visible.

**A backlog entry names a symptom reliably and a location unreliably.** This one
described the failure precisely and pointed one file away from it. Reading the
consumers before editing the line the entry cites is what separates the two: three
literals would have been changed, the commit would have looked like a fix, and the
defect would have survived untouched.

---

## 2026-09-09 · `e7804cdd` · Three declared lifetimes for one refresh token

**Backend** · group: Backend and Security · severity 🔴

### Symptom

Two, from one theme. The session died whenever the browser closed, even with a
refresh token good for another week — this is also the mechanism behind the open
item *the session expires even when a refresh token exists*, which is the same
defect seen from the user's side. And separately, `refresh_tokens` grew one row
on every refresh call, forever.

### Mechanism — the lifetimes

Three places declared how long a refresh token lives, and none of them agreed:

| source | value | did it rule? |
| :--- | :--- | :--- |
| the signed JWT (`authFn.js:95-98`) | 8.9 days | no — the row killed it 1.9 days earlier |
| the `refresh_tokens` row (`authController.js:149`, `:287`, `authFn.js:180`) | 7 days | yes, of the two written ones: the endpoint filters `expiration_date > NOW()` (`authRefreshToken.js:42`) |
| the cookie (`cookieConfig.js:10-15`) | none declared | **in practice yes** — no `maxAge` makes it a session cookie |

### Mechanism — the rotation threshold

```js
// authRefreshToken.js:81 — already in milliseconds
const totalLifetime = (decoded.exp - decoded.iat) * 1000;
// :86 — multiplied by a thousand a second time
const limitRemLife = (totalLifetime * 1000) / 10;
// :91 — therefore always true
if (remainingTime < limitRemLife) { /* rotate */ }
```

The threshold sat a thousand lifetimes ahead of a remainder that never exceeds
one, so the token rotated on **every** refresh rather than at 10% remaining life.
Each rotation revokes a row and inserts another (`authFn.js:164-194`).

### Code

```js
// backend/src/utils/authUtils/authFn.js — new, the only place the number is written
export const REFRESH_TOKEN_DAYS = 7;
export const REFRESH_TOKEN_MS = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

export const refreshTokenExpiryFrom = (from = new Date()) =>
  new Date(from.getTime() + REFRESH_TOKEN_MS);
```

```js
// authFn.js:95-98 — before
const expiresIn =
  process.env.NODE_ENV === 'development'
    ? '8.9d'
    : '8.9d';
// after
const expiresIn = `${REFRESH_TOKEN_DAYS}d`;
```

```js
// authFn.js:180 and authController.js:149, :287 — before (three copies)
const expirationDate = new Date();
expirationDate.setDate(expirationDate.getDate() + 7);
// after
const expirationDate = refreshTokenExpiryFrom();
```

```js
// cookieConfig.js:22 — before
return baseOptions;
// after
return { ...baseOptions, maxAge: REFRESH_TOKEN_MS };
```

```js
// authRefreshToken.js:86 — before
const limitRemLife = (totalLifetime * 1000) / 10;
// after
const limitRemLife = totalLifetime / 10;
```

The `clear` branch of `getCookieOptions` deliberately keeps **no** `maxAge`:
`clearCookie` expires a cookie, it does not renew one.

### Why 7 days and not 8.9

Seven is what the row already enforced, so **no live session is shortened**. The
1.9 extra days the signature claimed were never reachable. Aligning the other way
— raising the row to 8.9 — would have lengthened everyone's access without anyone
deciding to.

### What changes for the user

The session now survives a browser restart for up to 7 days. That is the point of
the item, and it is not a new policy: the backend had already chosen 7 days when
it wrote `expiration_date`. The cookie simply stopped contradicting it.

### Verified

`APP LOADED OK` on boot, exit 0. Backend suite: 71 pass, 0 fail. Threshold
arithmetic checked directly: 700 days before, 0.7 days (16.8 h) after, against a
7-day lifetime.

### Lesson

**When several layers must agree on one number, the number gets one home and the
layers read it.** Three literals for one lifetime is not redundancy, it is three
chances to disagree — and they did, silently, because the shortest one wins
without raising anything.

**A missing value is a decision too.** The cookie declared no lifetime, which
reads as *unset* and behaves as *shortest possible*. The bug was not a wrong
number, it was the absence of one, and absence never shows up in a search for a
wrong value.

**Check units before trusting an expression that never fires.** `totalLifetime`
already carried its unit; the second `* 1000` made a comparison that could not
be false. A branch that is always taken looks exactly like a branch that works.

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
