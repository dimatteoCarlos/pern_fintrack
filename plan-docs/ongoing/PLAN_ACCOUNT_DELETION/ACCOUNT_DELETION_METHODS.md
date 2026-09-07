# Account deletion — method sketches

Snapshot of every deletion path that exists today, plus the two units still
open. Full rationale and the target architecture live in
`PLAN_ACCOUNT_DELETION.md`; this file is the quick map of what each method
actually does, in the current code, with file:line anchors.

## 1. SOFT delete — mark inactive, nothing erased

- **Trigger:** `DELETE /api/fintrack/accounts/:targetAccountId?type=SOFT`
- **Controller:** `accountDeleteController.js#executeAccountDeletion` (L79-149)
- **Service:** `deleteAccountService.js#processStandardDelete`, SOFT branch (L404-415)
- **Who can call it:** any authenticated owner of the account (no admin check).
- **Flow:**
  1. `deleteAccountService` opens a transaction, confirms the account exists and belongs to `userId`.
  2. Rejects if `deleted_at` is already set (L406-408).
  3. `UPDATE user_accounts SET deleted_at = NOW() ... WHERE account_id = $1 AND user_id = $2` (L418-423).
  4. Commit. No row in `transactions` or `user_accounts` is removed — fully reversible by clearing `deleted_at`.
- **RESTRICT exposure:** none — the account row is never deleted, so migration 018's foreign keys never fire.

## 2. HARD delete — permanent erase, no financial correction

- **Trigger:** `DELETE /api/fintrack/accounts/:targetAccountId?type=HARD`
- **Controller:** same as above, HARD branch.
- **Service:** `deleteAccountService.js#processStandardDelete`, HARD branch (L391-403).
- **Who can call it:** meant to be admin-only (L683-688 rejects non-admins), but
  **known bug**: `isAdmin` at L503-504 is computed as
  `userRole === 'admin' || userRole === 'super_admin' || userRole === 'user'` —
  the `|| userRole === 'user'` clause grants hard-delete permission to every
  authenticated role, contradicting the 403 branch two lines below it. Not yet
  fixed; flagged here so nobody reads the 403 check and assumes the gate holds.
- **Flow:**
  1. Same existence check as SOFT.
  2. `eraseAccountTail(dbClient, userId, targetAccountId, accountCheck.rows[0].account_name)` — detach every surviving `transactions` row that names this account as source/destination (FK → NULL, name scrubbed from `description`), delete the account's own transactions, delete the `user_accounts` row (`eraseAccountTail.js` L18-60).
  3. Commit.
- **What it deliberately skips:** no reversal of the financial impact this account had on counterparties — their historical net position from transacting with the deleted account is left as-is (only the dangling reference is nulled). That correction is RTA's job, below.
- **FIXED, 2026-09-06.** `eraseAccountTail` deletes `pocket_allocations` rows naming this account as `source_account_id`, before the transactions DETACH/SCRUB above — see §5.

## 3. RTA — Retroactive Total Annulment (reverse impact, then erase)

- **Preview endpoint:** `GET /api/fintrack/account/delete/report_of_affected_accounts/:targetAccountId` → `accountDeleteController.js#generateImpactReport` (L24-74) → `getAnnulmentImpactReport(userId, targetAccountId)`.
- **Execution endpoint:** `DELETE /api/fintrack/accounts/:targetAccountId` with `deletionType: 'RTA'`, `impactReport`, `targetAccountName` in the body → `executeAccountDeletion` → `deleteAccountService`, RTA branch (L525-671) → `processRTAAnnulment` (L186-372).
- **Who can call it:** admin only (L527-532) — same `isAdmin` flag as HARD, so it inherits the bug above.
- **Flow:**
  1. `getAnnulmentImpactReport` computes, per counterparty account, the net signed amount the target account moved against it (double-entry: the target's own signed rows sum to exactly the correction the counterparty needs).
  2. Client reviews the report, confirms; the confirmation POSTs that same `impactReport` back.
  3. `processRTAAnnulment` opens the transaction, gets-or-creates the compensation ("Slack") account, and locks `{every affected account} ∪ {Slack} ∪ {target account}` in id order before reading any balance (`lockAndDeriveBalances`, L219-226 — the target account itself was the fix applied 2026-09-06, closing a concurrent-delete race).
  4. For each affected account: records two annulment transactions (affected ↔ Slack, opposite signs) via `recordAnnulmentTransaction`, then re-derives that account's stored balance from the ledger.
  5. Re-derives Slack's stored balance once, after every counterpart is done.
  6. `eraseAccountTail(...)` — same detach/scrub/drop as HARD delete.
  7. Commit.
- **Trust boundary — open issue (unit 6):** step 1's report is computed on `pool` (outside any lock) and handed to the client; step 3 trusts whatever `impactReport` the client sends back at execution time, rather than recomputing it itself inside the open transaction. A stale or tampered `impactReport` is currently taken at face value. This is the unit currently being worked: give `getAnnulmentImpactReport` a `dbClient` parameter, have `processRTAAnnulment` call it itself right after the lock (replacing the client-supplied array), and drop `impactReport` from what the execution endpoint requires in the request body.
- **FIXED, 2026-09-06.** Same `eraseAccountTail` fix as HARD delete, above.
- **Confirmed defect, found 2026-09-06 (open):** if the account being deleted
  here was itself the affected counterparty of an earlier RTA annulment, its
  own leg of that annulment pair is destroyed by `eraseAccountTail`'s 8d
  DROP while boundary's mirrored leg survives untouched — boundary's derived
  balance is left permanently off by that leg's amount, with nothing raised
  anywhere. Confirmed against `fintrack_dev` (`transaction_id` 182 and 185,
  `-10.00` and `-50.00`). Root cause, evidence and the recommended fix (a
  `related_transaction_id` link, `backdating`'s migration) are in
  `PLAN_ACCOUNT_DELETION.md` §5, "Confirmed violation of invariant I."

## 4. Pocket deletion — separate module, separate endpoint

Pockets are **not** an account type any more (the retired `pocket_saving`
type has zero live rows — see `POCKET_RETIRED_TYPE_AUDIT.md`) and are **not**
deleted from the accounting/account-deletion dashboard. They have their own
module and their own delete path:

- **Trigger:** `DELETE /api/fintrack/pocket/:pocketId` — `pocketRoutes.js` L59.
- **Controller:** `pocketController.js#deletePocketById` (L275).
- **Service:** `pocketWriteService.js#removePocket(userId, pocketId)` (L248-269) — reads the pocket's freed cash before deleting, inside the same transaction as the delete.
- **Repository:** `pocketRepository.js#deletePocket(db, userId, pocketId)` (L346): `DELETE FROM pockets WHERE pocket_id = $1 AND user_id = $2`.
- **Cascade:** `pocket_allocations.pocket_id` is `ON DELETE CASCADE` — deleting the pocket row removes its allocations automatically. No RESTRICT involved on this side.
- **Policy:** hard delete, allowed at any net balance (`POCKET_MODULE_SPEC.md` §11 Q8).
- **Where it does NOT belong:** the account-deletion flows above (SOFT/HARD/RTA) must never reach into `pockets` to delete a pocket on the account's behalf — only the account's own `pocket_allocations` rows are removed, never the pocket itself (§5). Removing a pocket is exclusively this module's own action, from its own menu.

## 5. FIXED, 2026-09-06 — pocket_allocations RESTRICT

`pocket_allocations.source_account_id` is `ON DELETE RESTRICT` by design
(`createTables.js` L492-493: "deleting an account stays a decision taken in a
service with an impact report"). `POCKET_MODULE_SPEC.md` §11.1 Q8b decided the
account-deletion service must show the impact report and delete these rows
explicitly, in the same transaction as the account delete — never a silent
cascade.

Both halves are now built:

- **Delete, in-transaction:** `eraseAccountTail.js` runs `DELETE FROM
  pocket_allocations WHERE source_account_id = $1 AND user_id = $2` before
  dropping the target's own transactions and the account row itself. Since
  `source_account_id` is `NOT NULL`, this is a genuine row deletion, not a
  DETACH-to-NULL like the two `transactions` FKs above it in the same file.
- **Report, before confirmation:** `getPocketAllocationImpact(dbClient,
  userId, targetAccountId)` (`getAnnulmentImpactReport.js`) names every
  pocket that loses backing and the amount, grouped and summed. Wired into
  the existing preview endpoint (`accountDeleteController.js#generateImpactReport`,
  additive `pocketImpact` field, `impactReport`'s own shape untouched) and
  rendered in the confirmation dialog itself
  (`InitialConfirmationDeleteAccountUI.tsx`) when non-empty, naming each
  pocket, the total, and Q8b's own load-bearing sentence: the money is not
  deleted, only the pocket assignment is.

This reached the one live, user-facing deletion flow because the frontend has
no separate pure-HARD-delete path today — `useRTAImpactAndDeletion.ts` always
calls the RTA preview endpoint first, even for the zero-impact case (its
button just relabels to "Confirm Hard Deletion"). A true standalone
assessment endpoint ahead of every deletion type, decoupled from RTA, is
still unit 6's open remainder (§6 below) — this fix rides the one preview
endpoint that actually exists.

## 6. Planned, not built — CLOSE and the assessment endpoint

- **CLOSE (TRANSFER / DISCARD)** — `PLAN_ACCOUNT_DELETION.md` unit 7: a fourth
  deletion type that moves an account's balance elsewhere or writes it off
  before erasing the account. No route, controller or service exists yet.
- **Assessment endpoint** — unit 6, the item this doc's §3 trust-boundary fix
  is part of: a single endpoint that computes locks, impact and invariants
  up front for any deletion type, instead of each type recomputing its own
  slice ad hoc.
- Units 9, 10 and 11 (invariant assertions, full lock-set enforcement across
  all types, and the CLOSE UI) remain open behind these two.
- **SOFT and HARD have no frontend trigger of their own — this is WIP to
  build, not a reason to leave the report RTA-shaped.** `AccountDeletionPage.tsx`
  is the only live delete screen and it always executes as RTA
  (`useRTAImpactAndDeletion.ts:98-103` sends `deletionType: 'RTA'`
  unconditionally); the "Confirm Hard Deletion" button label is cosmetic.
  An owner can never deactivate an account (SOFT) or knowingly skip the
  reversal (HARD, when impact exists) from the UI today. Two real screens are
  missing: a SOFT toggle (reversible, `deleted_at`, no impact report needed —
  §1) and a genuine HARD confirmation path for when the owner explicitly
  wants no reversal. Scoped as its own unit, not folded into §6's two items
  above since neither of those is a prerequisite for it.
