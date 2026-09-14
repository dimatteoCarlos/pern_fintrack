# PLAN_AUTH_SESSION_DEFECTS — five defects on the frontend session pipeline

**State: closed 2026-09-14.** All five defects landed the same day, `main` at
`9d64ad91` — see §9 for the commit per defect. Scope was the developer's own
selection: defects 1,
3 and 4 from the 2026-09-14 authentication audit, plus 6 and 7, which this
document adds because they sit in the same frontend files and the same
session-lifecycle path. Defects 2 (the refresh cookie is third-party in
production) and 5 (token cleanup does not run in production) are excluded on
purpose — both are backend/infrastructure fixes (a Vercel rewrite, a cron
trigger), a different process from the four frontend files this plan touches.
Defect 8 (a low-probability cross-tab race) is accepted as-is, per the audit;
no block below addresses it.

Every line number below was re-measured on 2026-09-14 against `main` at
`f03bc371`, the commit at the top of this session — not copied from the
earlier audit.

---

## 0. Why this block exists

The 2026-09-14 audit found the access-token lifecycle correct at login,
refresh and logout individually, but wrong at the seams between them: what
happens when a tab opens with no token, what a write request does on a stale
token, what a failed refresh is assumed to mean, and what a "remember me"
logout leaves behind. All four seams are in `frontend/src/auth`, none needs a
schema or endpoint change, and two of the four share one function.

---

## 1. Block A — the boot effect: refresh on a missing token, fire once

**File:** `frontend/src/auth/hooks/useAuth.ts:170-228`, the `useEffect` headed
`SESSION INITIALIZATION`.

### Defect 1 — a new tab, or the browser reopened, never tries the cookie

**Wrong** (`useAuth.ts:174-179`):
```ts
const accessToken = sessionStorage.getItem('accessToken');

if (!accessToken) {
  setIsCheckingAuth(false);
  return;
}
```
The access token lives in `sessionStorage`, which dies with the tab. On a new
tab or a reopened browser this branch returns immediately, `isAuthenticated`
stays `false`, and the 7-day refresh cookie `e7804cdd` added is never sent.
The user is asked to log in again inside its own 7-day window.

**Right — shape, not final code:**
```ts
const accessToken = sessionStorage.getItem('accessToken');

if (!accessToken) {
  try {
    await getRefreshedToken(); // the cookie is the only credential this can use
    // on success, fall through to the existing validate-session branch below
  } catch {
    // no cookie, or the cookie is spent — this is an anonymous visitor,
    // not an expired session; invalidateSession() with NO reason argument
    setIsCheckingAuth(false);
    return;
  }
}
```

**The caveat the audit flagged, resolved here rather than left open:** a first
load with no cookie fails this same call, and failing it must not read as
"session expired." `invalidateSession(reason?)` only sets `sessionExpired` when
`reason === 'expired'` (`invalidateSession.ts:52-54`), and `ProtectedRoute`
reads that flag to choose its message. The catch above must call
`invalidateSession()` with no argument, never `invalidateSession('expired')` —
that reserved value stays for an authenticated session that a later refresh
rejects, not for a visitor who never had one.

### Defect 7 — the same effect re-fires on every `error` and `isLoading` change

**Wrong** (`useAuth.ts:222-228`):
```ts
}, [
  setIsAuthenticated,
  setIsCheckingAuth,
  error,
  isLoading,
  setUserData,
  isAuthenticated,
]);
```
`error` and `isLoading` are written by this same hook's sign-in and sign-up
paths, so a login attempt's own state change re-triggers the boot check that
is only meant to run once, on mount. The hook is imported in 15 files; every
one re-runs it.

**Right:**
```ts
}, []); // boot check runs once, on mount — the setters are stable references
```
Verify `setIsAuthenticated`, `setIsCheckingAuth` and `setUserData` are the
Zustand setters (stable across renders, per `useAuthStore.ts`) before dropping
them from the array — if any is reconstructed per render this needs a
different fix, not an empty array.

**Why A is one block:** both defects are inside the same effect; fixing 1
without narrowing the dependency array in 7 would make the new refresh call
re-fire on every login-page keystroke that touches `error`.

---

## 2. Block B — `authFetch.ts`: two routes excluded from refresh for the wrong reason

**File:** `frontend/src/auth/auth_utils/authFetch.ts:57-64`.

### Defect 3 — saving the profile or changing the password after an hour logs the user out

**Wrong:**
```ts
if (
  axios.isAxiosError(error) &&
  error.response?.status === 401 &&
  !requestConfig._retry &&
  !url.includes('/sign-in') &&
  !url.includes('/sign-up') &&
  !url.includes(url_update_user) && // Update profile handles 401 itself
  !url.includes(url_change_password) // Change password handles 401 itself
) {
```
Both excluded routes use `verifyToken` (`userRoutes.js:33,47`), and
`userController.js` returns no 401 of its own — every 401 those two routes can
produce is an expired token, which is exactly the case the refresh path exists
for. Excluding them sends a stale-token failure straight to
`invalidateSession`, logging the user out mid-edit.

**Right:**
```ts
if (
  axios.isAxiosError(error) &&
  error.response?.status === 401 &&
  !requestConfig._retry &&
  !url.includes('/sign-in') &&
  !url.includes('/sign-up')
) {
```
`/sign-in` and `/sign-up` stay excluded — they carry no token to refresh. A
wrong current password still returns 403 from `userController.js` and is
untouched by this branch, since the condition only matches 401.

---

## 3. Block C — `authRefreshManager.ts`: any failure reads as a rejected refresh

**File:** `frontend/src/auth/auth_utils/authRefreshManager.ts:57-68`, the
`catch` inside the single-flight refresh promise.

### Defect 4 — a timeout or a 500 logs the user out, not just a rejected token

**Wrong:**
```ts
} catch (error) {
  const currentPath = window.location.pathname + window.location.search;
  sessionStorage.setItem('returnTo', currentPath);
  invalidateSession('expired');
  throw error;
} finally {
```
The 10-second timeout (`:43`), a 500 from the refresh endpoint, and a dropped
network connection all land here, and all three invalidate the session the
same way a rejected refresh token does. None of the three means the refresh
token is bad — a retry a moment later could still succeed.

**Right — shape, not final code:**
```ts
} catch (error) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401 || status === 403) {
    const currentPath = window.location.pathname + window.location.search;
    sessionStorage.setItem('returnTo', currentPath);
    invalidateSession('expired');
  }
  // timeout, 5xx, network error: leave the session as-is and let the caller retry
  throw error;
} finally {
```
Callers of `getRefreshedToken()` (`authFetch.ts`, and Block A's new call) must
already handle a thrown error without assuming invalidation happened — confirm
that before this lands, since today invalidation was guaranteed on any catch
and some caller may be relying on it implicitly.

---

## 4. Block D — `logoutCleanup.ts`: "remember me" leaks the previous session's data

**File:** `frontend/src/auth/auth_utils/logoutCleanup.ts:52-61`.

### Defect 6 — the next sign-up in the same tab inherits the old user's contact info

**Wrong:**
```ts
if (!shouldKeepData) {
  setUserData(null);
  clearIdentity();
  localStorage.removeItem(LOCAL_STORAGE_KEY.USER_DATA);
  console.log('🔧 Full cleanup: all persistent data removed');
} else {
  console.log('🔧 Partial cleanup: keeping identity for next visit');
}
```
`setUserData(null)` — the in-memory Zustand user object — only runs when
"remember me" is off. With it on, `userData` survives logout. If a different
person registers in the same tab, `safeMergeUser` merges the stale `userData`
with the fresh signup response, and since that response carries no
`user_contact` (`authController.js:177-186`), the old user's contact fields
survive onto the new account's in-memory state.

**Right:**
```ts
setUserData(null); // always — this is volatile session state, not the remembered identity
if (!shouldKeepData) {
  clearIdentity();
  localStorage.removeItem(LOCAL_STORAGE_KEY.USER_DATA);
  console.log('🔧 Full cleanup: all persistent data removed');
} else {
  console.log('🔧 Partial cleanup: keeping identity for next visit');
}
```
"Remember me" already has its own channel — `identity` in `localStorage`,
read by `getIdentity()` — so clearing `userData` does not touch what
"remember me" is meant to preserve (the prefill email/username), only the
stale in-memory profile.

---

## 5. Execution order and why

1. **Block D first.** One line, one file, no dependency on the others, and it
   is the only defect with data leaking across accounts rather than a session
   dropping early.
2. **Block B second.** One file, removes two lines, no new logic.
3. **Block C third.** Touches the function Block A's new code calls in the
   next step — landing it first means Block A calls an already-narrowed
   `getRefreshedToken`.
4. **Block A last.** The largest change, and the one the caveat in §1 depends
   on Block C already treating a timeout differently from a 401.

Each block is its own gate under the Commit Workflow in the root `CLAUDE.md`:
file description, reviewer sign-off, technical checklist, post-commit — in
that order, before the next block starts.

---

## 6. What this plan does not cover

Defects 2 and 5, on purpose — see the note at the top. Defect 8 is accepted.
Point "criterio aceptado, no defecto" from the audit (the access token stays
valid up to an hour after logout, because `verifyToken` does not query the
database) is not a defect and is not touched. The disabled `returnTo` redirect
after re-login (`AuthPage.tsx:86-91`) is a parked decision, not a defect this
plan resolves.

---

## 7. Workflow — before the fix

Traced from the five files in scope, in the order a session actually hits
them: boot, an authenticated call, the refresh it triggers, and logout.

```
App loads (new tab, or the browser reopened)
  -> useAuth.ts:170 boot effect fires
    -> read sessionStorage.getItem('accessToken')
      +- found      -> validate session -> done
      +- NOT found  [DEFECT 1, useAuth.ts:176-179]
                    -> setIsCheckingAuth(false); return
                       the 7-day refresh cookie is never tried
  -> boot effect dependency array [DEFECT 7, useAuth.ts:222-228]
     [setIsAuthenticated, setIsCheckingAuth, error, isLoading, setUserData, isAuthenticated]
     -> re-fires on every error/isLoading change from this same hook's
        own sign-in/sign-up paths (15 importers)

Authenticated user calls a protected endpoint
  -> authFetch.ts response interceptor
    -> 401 received
      +- url is /sign-in or /sign-up          -> skip refresh (correct)
      +- url is update-user or change-password
      |  [DEFECT 3, authFetch.ts:124-125]      -> skip refresh
      |                                        -> invalidateSession()
      |                                           logged out mid-edit
      +- any other url                        -> getRefreshedToken()

getRefreshedToken() -> authRefreshManager.ts single-flight refresh
  -> axios call to /refresh-token (10s timeout, authRefreshManager.ts:43)
    +- success              -> new accessToken -> retry original request
    +- failure, ANY kind
       [DEFECT 4, authRefreshManager.ts:159-163]
       401/403, timeout, 500 or network error all take this branch
       -> invalidateSession('expired') -> throw

User logs out with "remember me" ON
  -> logoutCleanup.ts:52-61, shouldKeepData = true
    -> clearIdentity() / localStorage.removeItem  SKIPPED (correct)
    -> setUserData(null)  SKIPPED
       [DEFECT 6, logoutCleanup.ts:199-206]
       userData stays in the Zustand store after logout

Next person signs up, same tab
  -> signup response carries no user_contact (authController.js:177-186)
  -> safeMergeUser merges the stale userData with the fresh response
     -> the previous user's contact fields land on the new account
```

---

## 8. Workflow — after the fix (target)

Same trace, with each fix in place. This is the design already specified in
`Right` blocks above (§1-4); it becomes the actual flow only once every block
in §9 is committed — until then it documents intent, not shipped behavior.

```
App loads (new tab, or the browser reopened)
  -> useAuth.ts boot effect fires
    -> read sessionStorage.getItem('accessToken')
      +- found      -> validate session -> done
      +- NOT found  [FIXED — Block A, defect 1]
                    -> await getRefreshedToken()
                      +- success -> fall through to validate-session branch
                      +- failure -> invalidateSession()  (NO 'expired' arg)
                                    -> setIsCheckingAuth(false); return
  -> boot effect dependency array  [FIXED — Block A, defect 7]
     []  -> runs once, on mount only

Authenticated user calls a protected endpoint
  -> authFetch.ts response interceptor
    -> 401 received
      +- url is /sign-in or /sign-up            -> skip refresh (unchanged)
      +- any other url, INCLUDING update-user
         and change-password  [FIXED — Block B, defect 3]
                                                  -> getRefreshedToken()

getRefreshedToken() -> authRefreshManager.ts single-flight refresh
  -> axios call to /refresh-token (10s timeout)
    +- success                    -> new accessToken -> retry original request
    +- failure, status 401/403    -> invalidateSession('expired') -> throw
    +- failure, timeout/5xx/network
       [FIXED — Block C, defect 4]
       -> session left as-is, no invalidation -> throw (caller may retry)

User logs out, any "remember me" setting
  -> logoutCleanup.ts
    -> setUserData(null)  [FIXED — Block D, defect 6]  ALWAYS runs
    -> shouldKeepData?
       +- true  -> identity kept in localStorage (unchanged)
       +- false -> clearIdentity() + localStorage cleanup (unchanged)

Next person signs up, same tab
  -> userData is already null, nothing stale for safeMergeUser to merge
     the defect 6 leak has no state left to leak
```

---

## 9. Correction log

One row per defect, filled in with the commit sha when its block lands —
`pending` until then. This table is the record of how each defect was
actually corrected, not just how it was designed to be.

| defect | block | file | fix | status | commit |
| :-- | :-- | :--- | :--- | :--- | :--- |
| 6 | D | `logoutCleanup.ts` | `setUserData(null)` moved outside `!shouldKeepData` | done | `d615d35b` |
| 3 | B | `authFetch.ts` | removed the `update-user`/`change-password` refresh exclusion | done | `0b0e221d` |
| 4 | C | `authRefreshManager.ts` | invalidate only on 401/403; timeout/5xx/network re-throw without invalidating | done | `bf9212f1` |
| 1 | A | `useAuth.ts` | missing token tries `getRefreshedToken()` once before giving up | done | `9d64ad91` |
| 7 | A | `useAuth.ts` | boot effect dependency array emptied, runs once on mount | done | `9d64ad91` |

Order matches §5 (D, B, C, A). All five defects landed 2026-09-14, `main` at
`9d64ad91`, `npx tsc -p tsconfig.app.json --noEmit` clean after each block.
The §8 "after" workflow is no longer a target — it is the current code.
