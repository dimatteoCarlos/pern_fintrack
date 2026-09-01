# COMPLETED — Security hardening

> ## ✅ COMPLETED — closed 2026-08-13
>
> Six of seven findings delivered and verified. **Nothing here is pending work.**
>
> | what was left over | where it lives now |
> |---|---|
> | A4 — implemented and then deliberately withdrawn | `REMARKS.md` R23 |
>
> Kept as the record of what was hardened and why. Not a work list.

**Status:** Delivered, except A4. Verified against the source on `feat/budget`, 2026-08-10.
**Audit date:** 2026-07-28 · **Closed:** 2026-08-10

---

## 1. Outcome

Six of the seven findings are fixed and verified in the working tree. The
seventh was implemented and then deliberately withdrawn; it now lives in
`REMARKS R23`.

| # | Finding | Severity | State | Verified by |
|---|---|---|---|---|
| A1 | Ownership check disabled on account deletion | CRITICAL | **Fixed** | `verifyUser` present in the DELETE chain, `accountRoutes.js:119` |
| A2 | Client-controlled identity (IDOR), 16 call sites | HIGH | **Fixed** | Zero occurrences of `req.body.user` / `req.query.user` in `backend/src`. Helper at `utils/authUtils/requireUserId.js`, consumed by 10 files |
| A3 | `dashboardMovementTransactionsSearch` dead and mis-authenticated | HIGH | **Fixed** | No `req.user.id`, no `startDatetoISOString` remain |
| A4 | No rate limiting on the application API | MEDIUM | **Withdrawn — see §2** | `app.js:156` carries the reason |
| A5 | TLS certificate verification disabled against the database | MEDIUM | **Fixed** | `dbEnvironmentConfig.js:29` — `{ ca: caCert, rejectUnauthorized: true }` |
| A6 | Inverted stack-trace disclosure | LOW | **Fixed** | No `NODE_ENV !== 'development'` remains in `dashboardController.js` |
| A7 | Secrets hygiene | INFO | **Fixed** | `backend/.env.example` and `frontend/.env.example` both exist |

Two helpers exist where the plan specified one: `getAuthenticatedUserId.js` and
`requireUserId.js`. They differ in how they answer — one throws, the other writes
the response and returns a falsy value, which is why controllers read
`const userId = requireUserId(req, res); if (!userId) return;`. Both take
identity from the verified token only.

---

## 2. A4 — implemented, then withdrawn on purpose

A general limiter was applied to `/api/fintrack` and later removed. The reason is
recorded in the source:

```js
// app.js:156
// globalLimiter is off this router while rate limiting is revised (REMARKS R23).
```

`REMARKS R23` is the finding that makes the limiter unsound as written: the
limiters key on the request object rather than on the IP, so the throttle does
not partition callers the way it claims to. Shipping a limiter that mis-keys is
worse than shipping none — it reports protection that does not exist.

**A4 is therefore not a pending item of this plan.** It is superseded by R23 and
is executed there, on its own branch, together with the keying fix.

---

## 3. The two rules this plan established, still in force

**Authentication is not authorization.** `verifyToken` answers "who are you?";
`verifyUser` answers "may you touch this?". Object-level authorization always
costs a database round-trip, because a token cannot carry the ownership of every
resource.

**Identity comes only from the token.** No controller reads a user id from body,
query or params. Any future call site that must act on another user's data goes
through an explicit authorization middleware, never through a parameter.

---

## 4. What this plan deliberately did not touch

The partial-PATCH corruption in `accountEditController.js` was excluded as a
correctness defect rather than an authorization one. It was fixed in `3afbaff`
under Plan C (C-b1 / C-b2).
