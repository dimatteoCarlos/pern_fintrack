# REMARKS — Findings Outside the Plans

Running log of defects, surprises, and corrections discovered **during execution** that are
not part of the original Plan A / Plan B / Plan C audits.

Rules for this file:

- Append, never rewrite history. Each entry keeps its date and status.
- One entry per finding. If a finding graduates into a plan, link it and mark it `Promoted`.
- Record the *evidence*, not the impression. A finding without a file:line or a command
  output is a suspicion, not a remark.

Status values: `Open` · `Fixed` · `Promoted` · `Accepted` (known and deliberately tolerated)

---

## R1 — Nested `.gitignore` shadows the root `!.env.example` negation

**Date:** 2026-07-30 · **Status:** Open · **Relates to:** Plan A, A7

Plan A §A7 assumes the root `.gitignore` negation is enough to commit the example files:

```
.gitignore:26  .env
.gitignore:27  .env.*
.gitignore:28  !.env.example
```

It is not. Both sub-projects carry their own ignore file with a broader rule:

```
backend/.gitignore:27   *.env*
frontend/.gitignore:27  *.env*
```

Verified:

```
$ git check-ignore -v backend/.env.example frontend/.env.example
backend/.gitignore:27:*.env*    backend/.env.example
frontend/.gitignore:27:*.env*   frontend/.env.example
```

**Why it happens.** Git resolves ignore rules from the deepest `.gitignore` upward, and the
first file that matches decides. A negation in a *parent* cannot re-include a path that a
*child* has already excluded. The root `!.env.example` never gets consulted.

**Consequence for execution order.** A7 must fix the two nested ignore files *before*
creating the templates, otherwise `git add` silently refuses them.

---

## R2 — `process.env.ENV` is read but never defined

**Date:** 2026-07-30 · **Status:** Open · **Severity:** Low (dead code, no security impact)

Two live sites branch on a variable that does not exist in any `.env`:

- `backend/src/utils/authUtils/authFn.js:24`
- `backend/src/fintrack_api/controllers/accountCreationController.js:811`

The project defines `NODE_ENV`, never bare `ENV`. Both conditions are permanently false.

No security impact — in `authFn.js` the unreachable branch is the *verbose* one, so the safe
generic message is what actually runs. But it means the debug output these lines were written
for has never appeared, in any environment, since they were added.

**Learning topic:** a conditional whose predicate can never be true is indistinguishable from
working code in review. It only shows up when someone asks "why is this log never in the
output?" — which is why environment variable names deserve a single documented source
(this is exactly what A7's `.env.example` buys).

---

## R3 — express-rate-limit v8 does not expose `windowMs` on the middleware

**Date:** 2026-07-30 · **Status:** Fixed (`a7da781`)

All four limiters computed `retryAfter` by reading their own exported const:

```js
retryAfter: Math.ceil(profileUpdateLimiter.windowMs / 1000)
```

The middleware returned by `rateLimit()` attaches only `resetKey` and `getKey`
(`node_modules/express-rate-limit/dist/index.mjs:976-977`). `windowMs` is not among them.

**The silent-failure chain:** `undefined` → `Math.ceil(undefined / 1000)` → `NaN` →
`JSON.stringify` serializes `NaN` as `null`. The client receives well-formed JSON carrying
`"retryAfter": null`. No exception, no log, no failed request. A client honouring that field
has nothing to back off on.

**Fix:** take the fourth handler argument. `next` must be declared purely to reach position 4.

```js
handler: (req, res, next, options) => { ... options.windowMs ... }
```

**Learning topic:** `NaN` is the most dangerous value in JavaScript arithmetic because it
propagates silently and serializes to something that *looks* deliberate. `null` in a response
reads as "the server chose not to say", not as "the server miscalculated".

---

## R4 — Rate limiter key generation depends on unenforced middleware order

**Date:** 2026-07-30 · **Status:** Fixed (`71da26b`)

`keyGenerator` reads `req.user?.userId` to key limits per user. That has an implicit
precondition: `verifyToken` must have already run. `globalLimiter` was originally mounted
*before* it, so `req.user` was always `undefined` and the optional chaining quietly degraded
the limiter to bare-IP keying — which puts every user behind one NAT on a shared budget.

Express cannot express this precondition; it is enforced only by argument order in
`app.js:159`.

**Learning topic:** optional chaining converts a contract violation into a silent
downgrade. When `?.` guards something a middleware *should* have populated, it hides the very
bug it appears to defend against.

---

## R5 — Two commits described work they did not contain

**Date:** 2026-07-30 · **Status:** Fixed (history rewritten, force-pushed with lease)

- `572b036 chore(cleaning): add space after comma` — the diff was the entire A4 change
  (globalLimiter import + mount). The space it named was never added.
- `5c50e6c chore(cleaning): unused spaces` — removed the trailing newline from `configDB.js`.

Both were already pushed. Replaced by three correctly scoped commits (`a7da781`, `71da26b`,
`2c012d1`) after a `git reset --mixed`, with `backup/pre-reword-20260730` kept as a safety net.

**Learning topic:** a security control filed under `chore(cleaning)` is invisible to
`git log --grep` for *sec* or *limit*, and its `git blame` line misleads the next reader about
why the code exists. Write the message after reading `git diff --staged`, never before.

---

## R6 — `/api/health` publishes the refactor phase

**Date:** 2026-07-30 · **Status:** Open · **Severity:** Informational

`backend/src/app.js:132` returns a `step` field used as a progress tracker for the Vercel
serverless migration:

```js
step: 'TESTING ADDING ENDPOINTS. - NOW TEST 09.Enable fintrack routes with auth middleware - .TEST 08:WAS OK.',
```

The endpoint is public. A health check should answer *up or down*; anything else it returns is
free reconnaissance. Remove the field when the migration closes.

---

## R7 — `/api/db-test` is public and returns raw driver errors

**Date:** 2026-07-30 · **Status:** Open · **Severity:** Low–Medium

`backend/src/app.js:137-148` registers an unauthenticated route that executes a query and, on
failure, returns `error.message` verbatim to the caller. Driver errors carry host names, role
names, and SSL negotiation details.

It also consumes a connection from a pool configured at `DB_POOL_MAX=2`, so it doubles as an
unauthenticated pool-exhaustion lever. It sits *above* the `/api/fintrack` mount, so
`globalLimiter` does not cover it.

Not urgent while the app is pre-production, but it should not survive the migration.

---

## R8 — In-memory rate limiting gives no guarantee on serverless

**Date:** 2026-07-30 · **Status:** Accepted (tracked for Plan B follow-up)

`express-rate-limit` defaults to a per-process memory store. On Vercel each warm lambda holds
its own counters, so the effective limit is `limit × warm instances`, and it resets on every
cold start.

The limits committed in `a7da781` are still worth having — they bound a single instance and
protect the `DB_POOL_MAX=2` pool — but they are not a distributed control. A shared store
(Upstash Redis + `rate-limit-redis`) is the real fix.

**Learning topic:** stateful middleware and stateless compute are in direct tension. Any
control that counts (rate limits, idempotency keys, sessions) needs storage outside the
process the moment the process stops being singular.
