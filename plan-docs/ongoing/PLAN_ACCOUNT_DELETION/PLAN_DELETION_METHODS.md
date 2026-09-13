# PLAN — The deletion methods beside CLOSE: SOFT, RTA and HARD

Written on 2026-09-13 on branch `feat/deletion`, at the owner's request: *"deja
documentado en el archivo de plan correspondiente, las advertencias que hiciste
junto con un documento de plan de metodos de borrado soft y rta o hard delete."*

CLOSE is the only deletion method the owner contemplates (2026-09-08, restated
2026-09-11: *"el unico metodo de borrado es close"*). Its plan is
`PLAN_CLOSE_ACCOUNT.md` beside this file, and that document wins wherever the two
disagree. This one records the other three methods: what each does in the code
today, how it is reached, what was measured against it, and what bringing it
back would take.

Measurement basis. SOFT's reader sweep in section 2 was a read-only exploration
of `feat/deletion` at `de2ce287`, 2026-09-13. The branch was fast-forwarded to
`7bbf7b04` the same day; that moved Overview and pocket repositories, so a line
number quoted there for those files can be off by a few lines. The RTA cases in
section 3 are `PLAN_CLOSE_ACCOUNT.md` section 12, measured 2026-09-08 and not
re-measured here.

---

## 0. Status

| Method | What it is | On the deletion screen | Through the API | Owner's ruling |
|---|---|---|---|---|
| SOFT | Deactivation: stamps `user_accounts.deleted_at` and keeps the row | hidden (`AccountDeletionPage.tsx:562`) | **refused with 403 since 2026-09-13** | *"dejaremos en esta version, sin efecto el soft delete"* (2026-09-13) |
| RTA | Reversal-then-annulment: writes an adjusting pair per counterparty against the compensation account, then erases the account | hidden (`isAnnulmentOffered = false`, `AccountDeletionPage.tsx:159`) | **accepted** | withdrawn from the screen 2026-09-08; no ruling on the API |
| HARD | Erasure: detaches, scrubs and deletes the account and its own transactions | hidden (`AccountDeletionPage.tsx:602`) | **accepted** | withdrawn from the screen 2026-09-08; no ruling on the API |

Every method shares one guard ahead of its branch: the compensation account and
any system-created account type cannot be deleted by any method
(`deleteAccountService.js:1622-1632`).

---

## 1. The flag that hides three methods does not disable them

`CLOSE_IS_THE_ONLY_METHOD` (`frontend/.../config/deletionMethodPolicy.ts`) removes
the buttons. It changes no route and no service: `DELETE
/delete/:targetAccountId?type=<method>` (`accountRoutes.js:181-185`) runs any of
the four for the account's owner. The administrative restriction on RTA and HARD
was suspended by the owner on 2026-09-07 and is kept commented
(`deleteAccountService.js:539`, `:1797`).

- **SOFT is now refused server-side**, by `SOFT_DELETION_ENABLED = false`
  (`accountDeleteController.js:35`), checked before any transaction opens
  (`deleteAccountService.js:1637`). The assessment endpoint publishes SOFT as
  unavailable with the same reason (`assessAccountDeletion.js:196`).
- **RTA and HARD are not.** A direct request still runs them. Whether they get
  the same server-side refusal is open, section 5.

---

## 2. SOFT — deactivation

### 2.1 What it does

`processStandardDelete`, SOFT branch (`deleteAccountService.js:600-664`):

1. refuses an account already closed, and one already deactivated;
2. releases every pocket commitment the account backs, through the pocket
   module's own release, writing a compensating negative row per pocket
   (`releasePocketCommitments.js`, called at `:633`) — the owner's rule of
   2026-09-11 that no deletion leaves a pocket backed;
3. stamps `deleted_at` and `updated_at`, guarded on both `deleted_at` and
   `closed_at` being null.

It writes no transaction, derives no balance and writes nothing to the registry
or the budget.

### 2.2 Warnings, measured 2026-09-13

**IT IS NOT RECOVERABLE.** No statement in the backend sets `deleted_at` back to
null, on any path (`getCloseTransferDestinations.js:128-130` says so in its own
comment). There is no restore route, no restore service and no screen.

- **The interface promises a restore that does not exist.** The dialog copy says
  the account "can be reactivated later" (`languages.ts:465`, Spanish `:700`),
  the component calls itself fully reversible (`SoftDeactivateAccountUI.tsx:13-14`)
  and the policy file calls it "the reversible deactivation"
  (`deletionMethodPolicy.ts:10-12`). Unreachable while the method is off; wrong
  the day it returns without a restore.

**THE ACCOUNT LEAVES THE LISTS AND STAYS IN THE TOTALS.**

| Readers that hide it | Readers that still count it |
|---|---|
| Accounting dashboard lists and tracker pickers, through `LIVE_ACCOUNT` (`getAccountController.js:45`, nine uses) | Overview account sets, through `accountIdentityCte`, which marks an account closed only when its row is missing and never reads `deleted_at` (`accountIdentity.js:135`) |
| Budget page account set (`accountUtils.js:186-187`) | Overview hero bank balance and free cash (`overviewPageRepository.js:133-136`, `:193-196`) |
| Pocket source picker and board (`accountAllocationRepository.js:64-65`) | Overview balance series and debt card (`overviewBalanceRepository.js:78`, `:159`, `:222`), investment card (`overviewInvestmentRepository.js:126`, `:257`, `:289`) |
| Close preview and its net worth figure (`getClosePreview.js:73-74`, `:110-111`) | All eight totals of the legacy dashboard (`dashboardController.js`) and the monthly totals (`dashboardMonthlyTotalAmountByType.js:135`) |

So the owner saw net worth that includes an account no list shows.

- **No zero balance is required.** The assessment published SOFT as available at
  any balance and flagged `leavesResidualUnsettled` (`assessAccountDeletion.js`,
  SOFT option). An account holding 500 disappeared from view with its 500 still in
  net worth.
- **A deactivated account still accepts movements.** The account lookup that new
  movements go through does not filter it (`transactionController.js:120-126`),
  nor does account edit (`accountEditController.js:37-45`), the balance lock
  (`lockAndDeriveBalances.js:56`, `:67`) or the budget allocation lock
  (`budgetAllocationService.js:113-122`).
- **A deactivated account can never be closed.** CLOSE refuses it
  (`deleteAccountService.js`, `processCloseAccount`, "was deleted and cannot be
  closed") and the close preview cannot see it. HARD and RTA still accept it:
  their only state guard is `closed_at`.
- **Its budget keeps running.** CLOSE writes a terminating zero for the current
  month; SOFT writes nothing, and a monthly allocation applies until a later row
  replaces it (`budgetTransactionRepository.js:138-154`).
- **The name rule disagrees with itself.** No database constraint makes account
  names unique (`002_accounts.sql:90`, no unique index in the migrations or
  `createTables.js`). Creation treats a deactivated account's name as taken
  (`verifyAccountExistence.js:19-26`, no state test). Renaming another account onto
  it is allowed (`accountEditController.js:257`), and so is the category tuple
  check (`accountCategoryCreationcontroller.js:163`). A restore after such a
  rename leaves two live accounts with the same name and type.
- **Likely duplicate, inferred and not traced end to end.** Creating a debtor
  against a deactivated bank passes the existence check
  (`verifyAccountExistence.js:67`), while the find-or-create helper filters
  `deleted_at` (`checkAndInsertAccount.js:75`), does not find the bank, and would
  insert a second one.
- **Pockets do not come back.** A restore would not reinstate the released
  commitments; the owner would allocate again.
- **Nothing lists deactivated accounts.** The closed-account registry reads
  `account_registry` closures (`getClosedAccountRegistry.js:98`), which SOFT never
  writes, and `is_deleted` exists in the frontend only as a type
  (`responseApiTypes.ts:341`).

### 2.3 What bringing it back as a recoverable deactivation would take

A module, not a switch.

| Layer | Change |
|---|---|
| Schema | Optional deactivation record (when, by whom, reason), on the row or as a history table, as `035_create_account_registry.sql:224-225` anticipates. A unique index on owner, lowercased name and type, after resolving the duplicates renames may already have created |
| Backend | Restore service and route: lock the row, require `deleted_at` set and `closed_at` null, refuse a name collision, clear `deleted_at`, report that pocket commitments were not reinstated |
| Backend | Deactivated-accounts list, the inverse of `LIVE_ACCOUNT` |
| Backend | One name rule in creation, rename and category checks; the find-or-create helper aligned with it |
| Backend | Refuse movements, edits and debtor links on a deactivated account |
| Backend | Decide whether HARD, RTA and CLOSE may start from a deactivated account |
| Backend | Decide, figure by figure, whether Overview and the legacy dashboard count it; excluding it rewrites the history series, because SOFT writes no offsetting entry |
| Backend | Decide whether SOFT stops the budget with a zero, as CLOSE does, and what a restore writes back |
| Backend | Decide whether SOFT requires a zero balance |
| Frontend | A switch per method in place of `CLOSE_IS_THE_ONLY_METHOD`, plus `SOFT_DELETION_ENABLED` on the server |
| Frontend | Deactivated-accounts page and hook, on the model of `ClosedAccountsPage.tsx` and `useClosedAccounts.ts`, and a restore action that puts the account back in the store |
| Frontend | A deactivated banner on the account detail, and copy that states what a restore does and does not bring back |

---

## 3. RTA — reversal then annulment

### 3.1 What it does

The RTA branch of `deleteAccountService` (`deleteAccountService.js:1647` onward)
and `processRTAAnnulment` (`:277`):

1. refuses a closed account (`:1677`);
2. recomputes the impact report inside its own transaction, under a lock, rather
   than trusting the client's copy;
3. writes, per affected counterparty, a pair of adjusting rows against the
   compensation account (`recordAnnulmentTransaction.js`), prefixed
   `RTA Annulment Target(<name>)`;
4. runs the erasure tail HARD runs (`eraseAccountTail.js`, called at `:482`).

### 3.2 Warnings

All measured 2026-09-08 in `PLAN_CLOSE_ACCOUNT.md` section 12, which carries the
evidence; one line each here.

- **No balance gate** (12.1). HARD refuses a nonzero balance with 409; RTA reads
  none. The report and the residual agree by construction today, not by a rule,
  so the day they diverge RTA erases the difference silently. The assessment
  publishes the figure it would erase as `unreversedResidualAmount`.
- **Rows not marked complete are destroyed unreversed** (12.2). The report
  filters `status = 'complete'`; the erasure does not. Latent: every writer writes
  `'complete'` and no other value has ever existed.
- **The deleted account's name survives forever in the rows RTA writes** (12.3).
  The erasure rewrites descriptions only where the target is a key column, and
  the annulment rows carry the target in neither.
- **The description rewrite is a blind substring replace** (12.4). An account
  named `Cash` rewrites "Cash" in every surviving description that referenced it.
  Overview's five prefix predicates are reached only when the name is a substring
  of `RTA Annulment Target(`, on a second deletion.
- **Pocket allocations are deleted, not released** (12.5). `eraseAccountTail.js:96-99`
  removes them before the account, so their RESTRICT never fires and the
  allocation history goes with the account.
- **A nonzero unattributed total is logged and ignored** (12.6), and **a
  non-empty report can move nothing** (12.7) when the only counterparty is the
  compensation account itself.
- **It rewrites other accounts' history.** That is its purpose and the reason the
  owner withdrew it from the screen: reversing the account's effect on its
  counterparties is not what an owner closing an account asks for.

### 3.3 What replaced it on the screen

"Reverse the balance and close" (`PLAN_CLOSE_ACCOUNT.md` section 14): movement type
11 against the compensation account, then CLOSE, in one request. It touches only
the account being closed and keeps its history in the registry.

---

## 4. HARD — erasure

### 4.1 What it does

`processStandardDelete`, HARD branch (`deleteAccountService.js:540-599`):

1. refuses a closed account (`:561`);
2. locks the account and derives its balance; refuses anything but zero with 409
   (`:586`);
3. runs `eraseAccountTail` (`:593`): nulls `source_account_id` and
   `destination_account_id` on other accounts' rows that name it, replacing its
   name in their descriptions with `[deleted account]`; deletes its pocket
   allocations; deletes its own transactions; deletes the account row.

### 4.2 Warnings

- **Nothing of the account survives in the ledger.** Its own transactions are
  deleted, and every counterparty row loses the reference. The assessment says
  `keepsHistory: false`. CLOSE exists because the owner ruled the history must
  stay.
- **The same blind substring replace as RTA** (`eraseAccountTail.js:51`, `:59`).
- **Pocket allocations are deleted, not released**, as in RTA.
- **It accepts a deactivated account**: its state guard reads `closed_at` only.
- **A known defect on databases without migration `034`** (`deleteAccountService.js`
  comment above `:561`): `closed_at` is undefined there, `undefined !== null` is
  true, and every hard delete is refused as closed. Production has `034` since
  2026-09-11, so this no longer reaches it.

---

## 5. Decisions

| Decision | State |
|---|---|
| SOFT in this version | **SETTLED 2026-09-13: no effect.** Server refuses it, assessment marks it unavailable, button stays hidden, the branch stays in the code |
| A recoverable deactivation in a later version | open; section 2.3 is its scope |
| Whether RTA and HARD get the same server-side refusal as SOFT | **open, and the owner rules.** Recommendation: yes, the same flag pattern. Both are hidden, both run on a direct request, and both erase history the owner ruled must stay |
| Whether the buttons are removed from the markup | settled by the standing rule: kept, behind the flag |
