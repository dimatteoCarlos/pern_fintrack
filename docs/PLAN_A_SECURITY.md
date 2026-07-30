# PLAN A — Security Hardening

**Status:** Approved for execution, not started
**Branch:** `fix/security-hardening` (off `main`)
**Depends on:** nothing — fully independent of Plan B and Plan C
**Audit date:** 2026-07-28

---

## 1. Why this phase runs first

Every defect in this document exists on `main` today and is unrelated to the Budget refactor. Plan B and Plan C together are multi-week work; leaving an exploitable authorization hole in place for that duration is not an acceptable trade.

All findings below were verified by reading the code, not inferred. Line references are to the state of the repository at audit time.

---

## 2. Findings

### A1 — CRITICAL: ownership check disabled on account deletion

**Location:** `backend/src/fintrack_api/routes/accountRoutes.js` (DELETE route, ~line 118)

```js
router.delete(
  '/delete/:targetAccountId',
  // verifyUser,          ← commented out
  executeAccountDeletion,
);
```

**Why it is exploitable.** `backend/src/app.js:156` mounts the fintrack router behind `verifyToken` only:

```js
app.use('/api/fintrack', verifyToken, fintrack_routes);
```

`verifyToken` proves the caller is *logged in*. It does not prove the caller *owns the resource*. Ownership is the job of `verifyUser`, which resolves the account's owner from the database and compares it against the JWT claim (`authMiddleware.js:186-208`).

With `verifyUser` commented out, any authenticated user can permanently delete any other user's account by passing its ID in the URL.

**Aggravating detail:** the read-only impact-report route immediately above it *does* carry `verifyUser`. The protection was written, then removed from the destructive route while being kept on the harmless one.

**Fix:** restore `verifyUser` in the middleware chain.

**Verification:** authenticate as user A, attempt `DELETE /api/fintrack/account/delete/<account_id_owned_by_B>`. Expect `403`, not `200`.

**Learning topic:** authentication vs. authorization. `verifyToken` answers "who are you?"; `verifyUser` answers "may you touch this?". Conflating them is the single most common source of broken access control (OWASP A01). Note also *why* the ownership check requires a database round-trip: the JWT cannot carry the ownership of every resource, so authorization for object-level access is always a lookup.

---

### A2 — HIGH: client-controlled identity (IDOR), 16 call sites

**Pattern:**

```js
const userId = req.user.userId || (req.body.user ?? req.query.user);
```

Whenever the JWT claim is absent or falsy, the user ID falls back to attacker-controlled input. Every downstream query is scoped by `WHERE user_id = $1`, so control of that parameter is complete horizontal privilege escalation — read any user's accounts, balances, and transaction history.

**Complete site inventory:**

| File | Lines |
|---|---|
| `fintrack_api/controllers/dashboardController.js` | 41, 128, 319, 497, 1008 |
| `fintrack_api/controllers/getAccountController.js` | 197, 410, 483, 771, 861 |
| `fintrack_api/controllers/accountCreationController.js` | 446 |
| `fintrack_api/controllers/accountEditController.js` | 20 |
| `fintrack_api/controllers/dashboardMonthlyTotalAmountByType.js` | 30 |
| `fintrack_api/controllers/getTransactionsForAccountById.js` | 39 |
| `utils/fintrackUtils/accountDataRetrieval/getAccountByIdController.js` | 8 |

Note the variants — `req.user.userId ?? req.body.user` (getAccountController:410) and `req.user.userId ?? req.query.user` (dashboardController:1008) — a plain search for the full pattern will miss them.

**Fix.** Introduce one helper and use it everywhere. A single definition means this class of bug can never be reintroduced by copy-paste:

```js
// backend/src/utils/authUtils/getAuthenticatedUserId.js
import { createError } from '../errorHandling.js';

/**
 * Resolve the authenticated user's ID from the verified JWT payload.
 * The token is the ONLY acceptable source of identity.
 * Never accept a user ID from body, query, or params.
 */
export function getAuthenticatedUserId(req) {
 const userId = req.user?.userId;
 if (!userId) {
  throw createError(401, 'Authentication required.');
 }
 return userId;
}
```

Replace all 16 sites. Any call site that genuinely needs to act on *another* user's data must go through an explicit authorization middleware, not a query parameter.

**Verification:** authenticate as user A and call any listed endpoint with `?user=<B's uuid>`. Expect A's data (the parameter ignored), never B's.

**Learning topic:** the confused deputy problem. The server holds authority the client does not; if the client can name the subject the server acts as, the client borrows that authority. Identity must be derived from a credential the client cannot forge — here, the signed token.

---

### A3 — HIGH: `dashboardMovementTransactionsSearch` is dead and mis-authenticated

**Location:** `backend/src/fintrack_api/controllers/dashboardController.js:890, 939-940`

Two independent defects in one endpoint:

1. **Wrong JWT claim.** Line 890 reads `req.user.id`. The token payload uses `userId` — confirmed by `authMiddleware.js:174`, which destructures `const { userId: authId, role: authRole } = req.user`. `req.user.id` is `undefined`, so the guard on line 893 returns `400 User Id is required` on every call.

2. **Missing property accessor.** Lines 939-940 call `startDatetoISOString()` and `endDatetoISOString()` — the dot is missing. These are `ReferenceError`s. Even with a valid user ID, the endpoint would throw.

There is an uncommitted working-tree change on line 891 that comments out the `?? req.query.user` fallback. That instinct is correct (it closes the A2 hole for this endpoint) but the replacement reads the wrong claim, so the endpoint remains non-functional.

**Fix:** `req.user.id` → `getAuthenticatedUserId(req)`; `startDatetoISOString()` → `startDate.toISOString()` (and the same for `endDate`).

**Verification:** the endpoint returns results. It currently cannot have been exercised by anyone — treat its output as unreviewed on first run.

**Learning topic:** two bugs masking each other. The 400 guard short-circuits before the `ReferenceError` is reached, so fixing only the identity bug converts a silent 400 into a 500. Layered failures must be fixed together or the fix appears to make things worse.

---

### A4 — MEDIUM: no rate limiting on the application API

`authLimiter` and `passwordChangeLimiter` are applied in `auth_api/routes/authRoutes.js` and `auth_api/routes/userRoutes.js` only. Every `/api/fintrack` route — including account creation, edition, and deletion — is unthrottled.

**Fix:** apply a general limiter to the fintrack router in `app.js`, with a stricter limiter on the write and delete routes.

**Learning topic:** rate limiting is not only anti-brute-force. On authenticated endpoints it bounds the blast radius of a compromised token and protects the connection pool, which is configured at `DB_POOL_MAX=2`.

---

### A5 — MEDIUM: TLS certificate verification disabled against the database

**Location:** `backend/src/db/config/dbEnvironmentConfig.js:10`

```js
const ssl_env = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
```

This value is used by both the `development` and `production` config blocks. The connection is encrypted but **unauthenticated** — any party able to intercept the route can present its own certificate and read or modify all traffic, including credentials.

**Fix:** in production, supply the Supabase CA certificate and set `rejectUnauthorized: true`. Keep the relaxed setting for local development only, where the DB is on `localhost`.

**Learning topic:** encryption without authentication stops passive eavesdropping but not an active man-in-the-middle. `rejectUnauthorized: false` is the most widely copy-pasted insecure default in the Node.js ecosystem.

---

### A6 — LOW: inverted stack-trace disclosure

**Location:** `backend/src/fintrack_api/controllers/dashboardController.js:284`

```js
if (process.env.NODE_ENV !== 'development') {   // ← inverted
 console.log('stack:', error.stack);
}
```

Marked `//modificado` in the source. Every other handler in the same file uses `=== 'development'`. Logs stack traces only in production.

**Fix:** invert the condition to match the other five handlers.

---

### A7 — INFO: secrets hygiene (verified clean, two cleanup items)

**Verified, not assumed:**

- `git log --all --diff-filter=A -- "*.env" "*.env.*"` returns **empty**. No `.env` file has ever been committed on any branch.
- `git check-ignore` confirms all four are ignored: `backend/.env`, `backend/.env.local`, `frontend/.env.local`, `backend/archived/.env old verify be4 erase it`.
- `.gitignore` correctly pairs `.env` + `.env.*` with an `!.env.example` negation, so example files remain committable.

**Cleanup items (no git exposure, disk only):**

1. Delete `backend/archived/.env old verify be4 erase it` — it holds superseded credentials.
2. `backend/.env.local` contains a `VERCEL_OIDC_TOKEN`. Short-lived, but no reason to retain it.

**Deliverable:** create `backend/.env.example` and `frontend/.env.example` by copying the key names from the real files and stripping every value.

Two files, not one root file — they are consumed by different runtimes and deploy as two separate Vercel projects. A single root example forces whoever configures the frontend to filter out ~25 irrelevant database and FX keys, and breaks the "copy the example to `.env`" convention that makes the file useful.

Keys to include (values blanked):

- **backend:** `PORT`, `NODE_ENV`, `DATABASE_URI`, `DB_SSL`, `DB_POOL_MAX`, `CLIENT_URL`, `JWT_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, `SALT_ROUNDS`, `ACCOUNTING_CURRENCY_CODE`, `EXCHANGE_RATE_API_KEY`, `FREE_CURRENCY_API_KEY`, `API_KEY_COTIZAVE`, `FX_REQUEST_TIMEOUT_MS`, `FX_CACHE_TTL_HOURS`, `FX_CACHE_TTL_MS`, `FX_GITHUB_TTL_HOURS`, `FX_STATIC_FALLBACK_TTL_HOURS`, `CRON_SECRET`, `SYSTEM_ADMIN_EMAIL`, `SEED_ADMIN`, `RESET_EXCHANGE_RATES`
- **frontend:** `VITE_ENVIRONMENT`, `VITE_API_BASE_URL`, `VITE_API_BASE_URL_AUTH`, `VITE_API_URL_APP`

---

## 3. Execution order

Sequential — A2 introduces the helper that A3 consumes.

| # | Item | Files touched |
|---|---|---|
| 1 | A1 restore `verifyUser` | `accountRoutes.js` |
| 2 | A2 add `getAuthenticatedUserId`, replace 16 sites | new util + 7 controllers |
| 3 | A3 fix claim + `toISOString` typo | `dashboardController.js` |
| 4 | A6 invert stack-trace condition | `dashboardController.js` |
| 5 | A4 rate limiter on `/api/fintrack` | `app.js` |
| 6 | A5 production TLS | `dbEnvironmentConfig.js` |
| 7 | A7 delete stray `.env`, add two `.env.example` | new files |

## 4. Exit criteria

- A second test user cannot read, edit, or delete the first user's data through any endpoint.
- Passing `?user=<other-uuid>` changes nothing in any response.
- `DELETE /account/delete/:id` on a non-owned account returns `403`.
- The search endpoint returns results instead of `400`.
- No `.env` file is committed; both `.env.example` files exist.

## 5. Out of scope

Deliberately excluded, tracked in Plan C: the partial-PATCH data corruption in `accountEditController.js` (lines 111 and 129). Those are correctness bugs, not authorization bugs, and they touch the same `category_budget` write path that Plan C refactors. Fixing them here would create a merge conflict with Plan C for no security benefit.
