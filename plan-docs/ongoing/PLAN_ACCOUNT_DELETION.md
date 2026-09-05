# PLAN — Account removal

**Block:** account removal. **Status:** architecture frozen 2026-08-26. The
implementation decisions listed in §9 are open by design, not unfinished.
**Branch:** `fix/auth-screen` — settled by the fact that the first unit shipped
there. **Migration:** yes; the first one is written and applied.

> **Correction 2026-08-30.** The first unit — turning the three transaction
> foreign keys from cascade to restrict — **is no longer pending.** It shipped on
> 2026-08-27 in `7f96a43` and `699827b`. The plan below still described it as
> containment yet to be done, and the mechanism it prescribed (a step inside the
> one-shot production alignment file) was overtaken by a chain migration, for the
> reason recorded in the shipped block at §6. Units 2 through 11 were not
> re-measured; treat them as of the frozen date, not as of today.

Everything measured that this plan rests on is in
`PLAN_ACCOUNT_DELETION/RESEARCH_LOG.md` — 4,186 lines of audit, three live
deletions executed and measured, and the four architecture corrections that
produced the model below. **Nothing in this file needs that one to be read.** It
is cited where a figure appears, so a claim can be traced without the log being
part of the plan.

---

## 1. The problem

Retiring an account destroys financial data belonging to accounts that survive.

`transactions` references `user_accounts` three times — `account_id`,
`source_account_id`, `destination_account_id` — and all three are
`ON DELETE CASCADE`. A financial event is **two rows**, one owned by each side,
with nothing linking them: there is no entries table. So deleting account `A`
deletes the leg owned by `A` *and* every row belonging to `B` that merely
mentions `A`.

> **Measurement corrected 2026-08-30.** The three references are
> `ON DELETE RESTRICT` today, not `CASCADE`. Both build paths declare it —
> `backend/src/db/migrations/sql_migrations/003_transactions.sql:39-41`, `:48-50`
> and `:51-53`, and `backend/src/db/run_time_db_init/createTables.js:163`, `:169`
> and `:170` — and migration `018_alter_transactions_account_fks_to_restrict.sql`
> is the `ALTER` that reached the populated database. The paragraph is kept
> because it states the mechanism this block exists to answer, and because the
> three deletions below were executed while the cascade was still in force.

Measured, by executing three real deletions on `fintrack_dev`:

```
 account 31   wrote 2 annulment rows, destroyed 7 - three of them owned by banco
 account 13   wrote 4 annulment rows, destroyed 5 - two owned by surviving accounts
 account 42   wrote 6 reversal rows, and broke a fourth account by 0.75
```

`banco` was left carrying a stored balance of 205.41 against rows summing 262.40.

The third one is the most informative, because it ran through the live reversal
route and can be read row by row (log §14.16). **It pairs every correction against
the system account instead of against the target**, so the pair that should return
15.23 to the boundary lands on the boundary twice and cancels itself. The
operation that exists to remove money that entered from outside removed none of
it.

There is a second, independent source of the same damage, and it has nothing to do
with deletion. **Account creation writes both ledger legs correctly — the opening
pairs net to exactly zero — but never posts the funding account's balance, because
the call that would do it is commented out:**

```
 createBasicAccount     accountCreationController.js:42    call commented at :282
 createDebtorAccount    accountCreationController.js:439   call live at :813
 createPocketAccount    accountCreationController.js:926   call commented at :1243
```

The figure is computed at :246 and even stored inside the movement itself, in
`account_balance_after_tr` at :274. It is never written to `user_accounts`.
`createDebtorAccount` is the working reference, and the data splits exactly along
that line: the two debtor openings are posted to their funder, the two
basic-account openings are not. **Creating a bank, investment or category account
with a starting amount, or any pocket, leaves its funding account adrift today.**

> **Measurement corrected 2026-08-30 — the premise of this passage has ceased to
> exist, and the passage is kept rather than struck.**
>
> **What it asserts.** Two of the three account-creation functions never post the
> funding account's balance, because the call that would do it is commented out,
> and that is a second, live source of drift independent of deletion.
>
> **What the code says today.** Both calls exist and are live, and they call the
> derived writer rather than an absolute one:
> `backend/src/fintrack_api/controllers/accountCreationController.js:402`, guarded
> by `if (isTransfer)`, and
> `backend/src/fintrack_api/controllers/accountCategoryCreationcontroller.js:489`,
> guarded by `if (!isAccountOpening)`. The working reference
> `createDebtorAccount` is now declared at `accountCreationController.js:460` and
> posts at `:910`; `createBasicAccount` is at `:50`. **`createPocketAccount` no
> longer exists in that file at all** — pocket creation moved to the pocket module
> and writes no `user_accounts` row (`routes/pocketRoutes.js` -> `pocketWriteService`
> -> `pocket_services/db/pocketRepository.js:187`, an `INSERT INTO pockets`), so
> the third row of the census above has no code behind it.
>
> **What now needs a fresh decision.** The account-creation half of the drift is
> closed at the source, so the repair unit no longer has a live leak to wait
> behind on that path. The historical drift those openings already wrote is
> untouched by the fix and is still whatever it was; the figures below were
> measured on `fintrack_dev` on 2026-08-26 and have not been re-taken.

The result, on the test database, re-measured 2026-08-26 after the third deletion:

```
 20 accounts   16 reconcile against their own rows   4 do not
 the owner is shown 30.98 where the ledger supports 90.22
```

The ledger itself is intact — every movement type nets to exactly zero. **What is
broken is the balance column, not the record**, which is why every correct figure
is recoverable by derivation.

---

## 2. What is being built

Three operations over an account's life, two settlement policies, two states that
exist and one terminus that does not.

```
 STATE     ACTIVE     participates in every operation and every total
           CLOSED     row and history survive; out of circulation
           (absent)   the row does not exist

 OPERATION CLOSE      ACTIVE -> CLOSED   normal, reversible, preserves everything
           DELETE     ACTIVE -> absent   exceptional, irreversible, erasure
           RTA        ACTIVE -> absent   undoes A's economic effect, then erases

 POLICY    TRANSFER   the residual goes to an account the owner picks
           DISCARD    the residual goes to the system account
```

**"Deleted" is not a state.** A deleted account is the absence of a row, not a row
carrying a flag. Written as a state it invites a `deleted` boolean and queries
that keep reading rows meant to be gone.

**The policies belong to CLOSE and DELETE. RTA takes neither**, because a full
reversal leaves no residual to place (§3.3).

### The governing principle

> An account whose ledger balance is zero can be removed without any financial
> position changing. When the balance is not zero, the removal must first settle
> it according to an explicit choice by the owner.

### Why CLOSE is the normal operation

Mature products in this category all separate closing from deleting, and all make
closing the default once an account has history. **FinTrack diverges deliberately:
it offers account-level erasure anyway**, because the owner's claim to have their
data removed is judged to outweigh the historical argument. What the divergence
does not license is making erasure the *ordinary* way to retire an account.

---

## 3. The three operations

### 3.1 CLOSE — the normal one

**The owner asks:** stop showing me this account; keep what it did.

```
 settle the residual  ->  mark deleted_at  ->  done
```

The row survives, its transactions survive, its counterparties keep a named
counterparty. The account can be reopened.

**Net worth:** unchanged with TRANSFER; falls by the residual with DISCARD.
It can never rise.

**The column is `deleted_at`, and that name is legacy.** Until it is renamed it
means **closed**, never deleted: a deleted account has no row for a column to
carry. Every query reading `deleted_at IS NULL` is asking *is this account in
circulation*, and must be read that way.

**Recommendation, to be executed at unit 7: rename it to `closed_at`.** The rename
was proposed and declined earlier on 2026-08-26, when the block was still
definition and CLOSED was not yet a named state. §2 now fixes CLOSED as a real
state and absence as the terminus, so the name no longer merely reads badly — it
contradicts the model. Unit 7 is the moment because unit 8 immediately afterwards
visits 68 read sites, 9 of which filter this column: renaming first means unit 8
sweeps under the final name instead of being redone. Recorded as D6 (§9).

### 3.2 DELETE — the exceptional one

**The owner asks:** remove this account and what belongs to it.

```
 settle the residual  ->  detach counterparty pointers
                      ->  scrub A's identity from surviving text
                      ->  drop A's rows, then A
```

Rows owned by other accounts survive, detached, rendering as **Deleted account**.

**Settlement is not optional here.** A financial event is two rows; deleting `A`'s
rows removes one leg of every event `A` took part in. Unless those rows already
sum to zero, the global ledger stops closing. Settling first is what makes the
removal safe.

**Net worth:** identical to CLOSE. Erasure moves no money.

### 3.3 RTA — the reversal

**The owner asks:** make it as though this account had never existed.

```
 for each counterparty c of A:  write the pair   c: +net(c)   A: -net(c)
   ->  A is at zero by construction
   ->  detach, scrub, drop A's rows, then A
```

**The unit of reversal is the counterparty — not the row, and not the event.**
Written as *reverse every row A owns with its opposite pair*, an implementation
has to rediscover the pair by matching fields, and writes it twice for any event
whose two legs `A` owns. The per-counterparty form cannot double-count, because
`net(c)` is an aggregate. §4.2 gives it as SQL.

> **RTA removes the effects of A's existence. DELETE removes A's existence.**

**There is no shortfall, and this is a theorem rather than a happy case:**

```
 A owns rows a1..an        balance(A) = SUM ai
 each ai has an opposite leg owned by another account
 reversing all of them writes A: -SUM ai
 balance(A) after = SUM ai - SUM ai = 0        always
```

The second line has one measured exception and it is harmless. 17 rows on
`fintrack_dev` name no account but their own in both transfer columns — the
self-referencing openings of §10, plus one self-cancelling pair. **They sum to
zero per account**, so they contribute nothing to `balance(A)` and nothing to any
`net(c)`. They are skipped, and the sum being zero is asserted rather than
assumed: a nonzero residue is a broken row whose counterparty cannot be guessed,
and the operation aborts.

An earlier draft claimed a reversal costs more than `A` holds and needs the system
account to absorb the difference. **False**, and the error is instructive: it
assumed what `A` spent had left the system. It had not — a FinTrack expense
credits a budget category account, which is a counterparty like any other.

**Net worth: RTA is the only operation that can raise it**, by whatever `A`
consumed, since that spending is undone. It can also lower it, by whatever entered
through `A`'s opening. Which is correct — money that came from outside and is
declared never to have entered must leave.

> **The net worth impact of a reversal is exactly the portion of the balance whose
> counterparty is the boundary.** Everything with an internal counterparty
> redistributes; only the boundary portion leaves.

A trap that cost one round of analysis: **internal counterparties do not cancel
against each other.** They redistribute part of `A`'s balance among the owner's
other accounts, and what does not stay inside is exactly what came from outside.

**RTA must never appear as a third destination option** beside "to another
account" and "out of FinTrack". Those answer *where does this money go*; RTA
answers *should these movements have happened*. Different questions, one of which
can increase net worth.

---

## 4. The engine

CLOSE and DELETE share one procedure and differ only after the settlement. RTA is
a separate procedure that shares infrastructure, not control flow.

```
 SETTLEMENT ENGINE                    REVERSAL ENGINE
   CLOSE | DELETE                       RTA

 shared: the transaction writer, the derived balance writer, locking,
         authorization, the erasure tail, the invariant framework
```

### 4.1 CLOSE and DELETE

```
 1  LOCK       the lock set of the chosen policy      SELECT ... FOR UPDATE
 2  ASSESS     recompute the residual on this client  server-side, always
 3  VALIDATE   ownership, eligibility, destination,   mismatch -> 409,
               and the client's echo of step 2         nothing written
 4  SETTLE     apply the policy                       an ordinary two-leg movement
 5  ASSERT     residual(A) = 0

 CLOSE   6c  MARK    deleted_at = CURRENT_TIMESTAMP

 DELETE  6d  DETACH  source/destination -> NULL, only WHERE account_id <> A
         7d  SCRUB   A's identity out of those rows' descriptions
         8d  DROP    A's own rows, then the A row
         9d  ASSERT  invariant IV

 10  ASSERT   invariants I, II, III
 11  COMMIT   or ROLLBACK on any failed assertion
```

Steps 6d and 7d skip rows `A` owns; those are dropped at 8d, so scrubbing them is
wasted work.

### 4.2 RTA

```
 1  LOCK      { A } u counterparties(A)
 2  ASSESS    per-counterparty net contribution, from the ledger
 3  VALIDATE  ownership, the client's echo
 4  REVERSE   one pair per counterparty      c: +net(c)   A: -net(c)
 5  ASSERT    residual(A) = 0                 holds by construction; asserted anyway
 6  ERASE     detach, scrub, drop A's rows, drop A      the same code as 4.1
 7  ASSERT    invariants I, II, III, IV
 8  COMMIT    or ROLLBACK
```

#### How a counterparty is found, since there is no event identifier

`transaction_entries` is commented out at `003_transactions.sql:65-81`, so nothing
links the two legs of an event. It turns out nothing needs to. Measured over all
115 rows of `fintrack_dev` on 2026-08-26:

```
 49 rows   source_account_id names another account        sum +1268.63
 49 rows   destination_account_id names another account   sum -1268.63
 17 rows   neither does                                   15 of them amount 0.00
```

**Every row resolves exactly one counterparty, or none — never two.** So the
counterparty is a projection of the row, and both steps 2 and 4 read from the same
expression:

```sql
 cp(t) = CASE WHEN t.source_account_id IS NOT NULL
               AND t.source_account_id <> t.account_id      THEN t.source_account_id
              WHEN t.destination_account_id IS NOT NULL
               AND t.destination_account_id <> t.account_id THEN t.destination_account_id
         END                                        -- NULL for the 17

 net(c) = SUM(t.amount) FROM transactions t WHERE t.account_id = A AND cp(t) = c
```

Summed over every `c`, `A` receives `-SUM net(c) = -balance(A)`. That is the
theorem of §3.3 in the form the engine executes.

**The boundary is an ordinary `c`, and this is where the live route fails.** It
pairs every correction against the system account rather than against `A`, so when
`c` is the system account both legs land there and cancel (log §14.16). Pairing
against `A` makes the case disappear: there is nothing special about the boundary.

#### What becomes of the reversal rows

**The legs owned by surviving counterparties persist. They are not scaffolding.**
Only the legs owned by `A` disappear, at step 6, with every other row `A` owns,
because `A` does.

Invariant II is what forces it. Take the measured case — `cuenta precargada` holds
133.49 and the reversal credits it 2.00:

```
 rows kept    the original -2.00, detached, and the reversal +2.00
 balance      135.49, back to what it was before A ever existed
 reconciles   yes, and only because the reversal row is still there
```

Drop the reversal row and the balance says 135.49 while the rows say 133.49. **A
reversal that erases its own evidence breaks the invariant it exists to satisfy.**
It is also the counterparty's honest history: they did send 2.00, and it was later
reversed. These rows are detached and scrubbed like any other surviving row that
names `A` (§8).

### 4.3 Lock sets

```
 CLOSE / DELETE + TRANSFER    { A, D }
 CLOSE / DELETE + DISCARD     { A, S }
 RTA                          { A } u cp(A)
```

**The lock set and the set of accounts permitted to change balance are always
identical** — you lock exactly what you may change. If an implementation needs to
lock more, the authorized set grew and invariant III must be re-derived, not
widened quietly.

The DETACH of step 6d touches rows of counterparties that CLOSE and DELETE do
**not** lock. That is correct: it changes their rows, never their balance, and the
`UPDATE` takes its own row locks. RTA does lock them, because it moves their
balances. One principle, two outcomes.

**The system account is in RTA's lock set as an ordinary counterparty**, not as an
absorber: every account carries an opening whose opposite leg belongs to the
boundary.

The locking pattern already exists at `budgetAllocationService.js:122`
(`FOR UPDATE OF ua`). Copy it.

---

## 5. The invariants

Asserted on the transaction's own client, immediately before `COMMIT`. Each must
return nothing, or the transaction rolls back.

**I — the global ledger closes.** `sum_before` taken at step 2.

```sql
SELECT COALESCE(SUM(amount), 0) FROM transactions;   -- must equal sum_before
```

**II — every surviving account is explained by its own rows.**

```sql
SELECT ua.account_id, ua.account_balance, COALESCE(SUM(t.amount), 0) AS ledger
  FROM user_accounts ua
  LEFT JOIN transactions t ON t.account_id = ua.account_id
 GROUP BY ua.account_id, ua.account_balance
HAVING ua.account_balance <> COALESCE(SUM(t.amount), 0);   -- zero rows
```

Run read-only against `fintrack_dev`, it returns exactly the three damaged
accounts. **An assertion that does not fail on known-broken data is not an
assertion.**

**Reconciliation is not classification, and invariant II only asserts the
first.** Every balance can equal the sum of its own rows while a report still
misreads which accounts represent the owner: the sum of *all* balances is zero by
construction in a closed book, so it is not a position and no screen shows it.
The owner's position is the sum of the accounts that represent the owner, which is
a question of account type (§9, unit 5), not of arithmetic. Conflating the two
produced one wrong diagnosis in the research log, corrected there.

**III — only the authorized set moved, and by exactly the right amount.** The
first two clauses hold for every operation. The third is the operation.

```
 all          changed accounts  subset of  the lock set of the operation
              SUM of deltas over the changed set = 0
              delta(A) = -balance_before(A)

 settlement   exactly two accounts move
              delta(D or S) = +R,  where R = balance_before(A)

 reversal     delta(c) = +net(c) for every counterparty c
              SUM over c of net(c) = balance_before(A)
```

`delta(A)` is the same expression in both, so the clause that actually separates
them is the one below it: **settlement moves the whole balance to one place the
owner named; reversal returns each piece to where it came from.** An
implementation asserting only `delta(A) = -R` accepts a reversal that credited the
wrong counterparties — which is exactly the live defect of log §14.16.

One dependency to state rather than assume: `delta(D) = +R` holds in raw amounts
only if `A` and `D` share a currency. Whether they may differ is decision D2 (§9).
If cross-currency destinations are allowed, this clause becomes
`delta(D) = +convert(R)` and the sum-to-zero clause has to be evaluated in one
currency.

**IV — no surviving text names `A`.** DELETE and RTA only. This is the one
invariant the database cannot enforce; the three referential ones are guaranteed
by the foreign keys, and identity lives in free text.

---

## 6. Referential safety

```
 transactions.account_id                CASCADE -> RESTRICT
 transactions.source_account_id         CASCADE -> RESTRICT
 transactions.destination_account_id    CASCADE -> RESTRICT
```

Declared in three places, all three of which must change together or the change
undoes itself:

```
 backend/src/db/run_time_db_init/createTables.js:163,169-170
 backend/src/db/migrations/sql_migrations/003_transactions.sql:39-41,48-53
 backend/src/db/migrations/supabase/001_production_alignment.sql:527-574
```

*Line anchors re-measured 2026-08-30. All three now read `ON DELETE RESTRICT`,
and the alignment step is no longer "new" — it is section 8 of that file.*

003 is corrected in place, not patched by a corrective migration: production never
ran the chain. The alignment file has no foreign-key step today, and its new step
must sit **before** the ledger step, because that step declares
`003_transactions.sql` applied — a claim that is only true once the constraints
match.

> ### SHIPPED 2026-08-27 — recorded 2026-08-30
>
> **The containment described above is done.** It landed in two commits, and the
> mechanism is not the one this section proposed.
>
> | commit | what it changed |
> | --- | --- |
> | `7f96a43` *"fix(db): cascade to restrict on account fks"* | the two schema build paths and the alignment file: `003_transactions.sql`, `run_time_db_init/createTables.js`, and a new step in `supabase/001_production_alignment.sql` |
> | `699827b` *"fix(db): migrate account fks to restrict"* | a dedicated chain migration, `018_alter_transactions_account_fks_to_restrict.sql`, 83 lines, with UP and DOWN |
>
> **Why the alignment file was not the mechanism, and why that reasoning stands.**
> This section asked for the change to be carried by a new step in the one-shot
> alignment file. That is not what reaches a database that already holds data,
> and migration `018`'s own header says why:
>
> > *"all three declare the rule inside a `CREATE TABLE`, which is inert on a
> > table that exists. The alignment file additionally ran on Supabase on
> > 2026-08-22 and its name is in the ledger, so the runner will never execute it
> > again. Only an `ALTER` reaches a database that already holds data."*
>
> Two independent reasons, and either one alone is enough: a rule declared inside
> `CREATE TABLE IF NOT EXISTS` never fires on an existing table, and a file whose
> name is already in the migration ledger is never executed a second time
> whatever it contains. The edit to the alignment file was still made and still
> belongs there — it is what a *fresh* database gets — but it is not what moved
> production.
>
> **The ordering argument above is therefore moot, not wrong.** It only applied
> while the alignment file was the delivery mechanism.
>
> **Measured state.** `018` is in the migration ledger of the local development
> database `fintrack_dev`, read 2026-08-30, as the third-from-last row.
> `PLAN_SUPABASE_MIGRATION.md` §1 records it as run against production on
> 2026-08-27. **This document cannot verify the production half and does not
> claim it** — three documents describe production's alignment three different
> ways, and the block that names all three is in
> `on-hold/PLAN_DEPLOYMENT/PLAN_SUPABASE_MIGRATION.md` §1-ter and in
> `NEXT_SESSION.md` §2.1. Read one of those before treating production as aligned.

The other six foreign keys to `user_accounts` stay untouched: they are 1:1
extension tables and their cascade is correct.

**`RESTRICT` is a guard rail, not the integrity mechanism.** Integrity comes from
the engine. All `RESTRICT` guarantees is that nothing reaches a physical delete
without passing through it.

**`RESTRICT` does not block an authorized deletion — it blocks any physical
deletion that still has transaction references.** The distinction is worth being
exact about, because the loose reading is that it fails to protect DELETE. It
protects DELETE. What gets through is the engine, and only because the engine has
already removed every reference by the time it drops the row:

```
 DELETE A directly                ->  RESTRICT rejects
 DELETE A through the engine      ->  settle, detach, drop A's rows  ->  accepted
```

By step 8d the counterparty pointers are nulled and `A`'s own rows are dropped
first, so nothing references `A` when its row goes. Invert those two statements
and the database rejects the transaction — the guard rail working.

**Consequence to record:** with `RESTRICT` in force, deleting a *user* also fails,
since `users` cascades to `user_accounts`. That is decision D3 (§9).

---

## 7. The single balance writer

Three functions write `account_balance` today, with identical SQL:

```sql
UPDATE user_accounts SET account_balance=$1, updated_at=$2 WHERE account_id=$3
```

```
 transactionController.js:125-144
 accountManagement/updateAccountBalance.js:13-33
 accountDeletionUtils/updateAffectedAccountBalance.js:7-61
```

> **Census corrected 2026-08-30 — the count is two, and the unit is half done.**
>
> **What this passage asserts.** Three functions write `account_balance` with the
> same absolute statement, and the unit replaces all three.
>
> **What the code says today.** Two remain, and one of them is the replacement:
>
> ```
>  setAccountBalanceFromLedger(client, accountId, userId)   the derived writer
>    backend/src/utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js:48
>    untracked in the working tree; consumes derivedAccountBalanceSql('ua','NUMERIC')
>    from accountDataRetrieval/derivedBalance.js:24
>    called at transactionController.js:832 and :838 (after recordTransaction at
>    :780 and :818), accountCreationController.js:402 and :910,
>    accountCategoryCreationcontroller.js:489
>
>  updateAffectedAccountBalance(dbClient, newBalance, accountId)   REMOVED
>    was backend/src/utils/fintrackUtils/accountDeletionUtils/updateAffectedAccountBalance.js:8
>    the file no longer exists in the repository (zero matches for the name,
>    re-measured 2026-09-04); its two callers on the delete path now call
>    setAccountBalanceFromLedger instead
> ```
>
> The inline writer at `transactionController.js:125-144` is gone — that range now
> holds `getAccountTypes` and `getTransactionTypes` — and
> `accountManagement/updateAccountBalance.js` is **deleted in the working tree**.
> Every pointer at `updateAccountBalance.js:13-33` or `:21` in this plan and in
> the research log names a file that no longer exists.
>
> **Corrected 2026-09-04 — the unit is closed, not left needing a fresh
> decision.** `updateAffectedAccountBalance.js` is gone too, not merely
> half-replaced. Both delete-path call sites now read
> `setAccountBalanceFromLedger(dbClient, affectedAccountId, userId)` at
> `delete_account/deleteAccountService.js:307` (per affected account, inside the
> loop of `processRTAAnnulment`) and `:313` (the compensation account, once,
> after the loop), both scoped by `user_id` inside the writer itself
> (`setAccountBalanceFromLedger.js:59-60`). Landed in four commits dated
> 2026-08-30, already on `HEAD`: `921bd216`, `83d22cab`, `d41aca25`, `3de47e4d`.
> Unit 2 of §9 is **fully shipped**, and the "single derived balance writer" is
> the name that still applies — no retitling and no further decision needed on
> this unit.

Two of them share the name `updateAccountBalance`. They are replaced by one
function that derives the figure rather than accepting it:

```sql
 setAccountBalanceFromLedger(client, accountId, userId)

   UPDATE user_accounts ua
      SET account_balance = (SELECT COALESCE(SUM(amount),0)
                               FROM transactions WHERE account_id = $1),
          updated_at = CURRENT_TIMESTAMP
    WHERE ua.account_id = $1 AND ua.user_id = $2
  RETURNING account_id, account_balance;
```

**This is cross-cutting, not part of account removal.** It changes a premise that
holds everywhere in FinTrack: `account_balance` stops being a figure the caller
supplies and becomes a projection of the ledger. It reaches account creation,
movements, transfers and back-dating. It is here because invariant III cannot name
the accounts whose balance changed while three functions can change one.

**The call-site inventory must be re-counted before this unit is written.** It was
built from the deletion module and is known incomplete: the account-creation path
calls these writers too, and it is the one injecting drift today.

*Re-counted 2026-08-30, and the account-creation half is done.* The derived writer
holds five call sites — `transactionController.js:832` and `:838`,
`accountCreationController.js:402` and `:910`,
`accountCategoryCreationcontroller.js:489` — and the account-creation path no
longer injects drift. Two call sites remain on the absolute writer, both on the
delete path (`deleteAccountService.js:273` and `:311`).

**The `updated_at` collision is closed — retroactive dating won the race.** Its commit
`1208310 fix(account): untie updated_at from the movement` untied all three functions
from the movement's date, so **this plan inherits that result rather than deciding it.
Unit 2 replaces only the remaining balance-writing logic.** The ownership rule both
plans recorded — whichever block reaches the files first owns them — has been exercised;
it is not a pending question and must not be reopened as one.

**The formula above is not this plan's to invent, and as written it is a second
definition of an account's balance.** `SUM(amount)` over every row differs from the
derivation the read path uses the moment an account carries a starting amount without a
matching opening row in the ledger, where this one silently misses it. The two agree on
every account in `fintrack_dev` today, which is exactly what makes the divergence
dangerous: it would appear as a wrong balance with nothing on screen to contradict it.

> **This unit consumes the canonical derivation rather than restating it.** The `SET`
> expression comes from
> `utils/fintrackUtils/accountDataRetrieval/derivedBalance.js`, the same builder every
> read site joins. One definition of what an account's balance means, feeding both the
> screens and the stored projection the guards check inside their locks.

The consequence to carry: **`user_accounts.account_balance` stops being a source of truth
and becomes an enforcement projection.** After retroactive dating's read commit, no screen
reads it; what still does is the sufficient-funds guard on the write path and the pocket
module's committed-cash ceiling. See `CROSS_PLAN_MATRIX.md`.

---

## 8. Identity erasure

**Boundary: the application's persisted tables.** Backups, logs and snapshots are
retention policy with their own clock. A `COMMIT` cannot guarantee anything
outside its own transactional domain, and asking it to is what makes erasure an
open-ended task that never gets declared satisfied.

Measured: 22 base tables, 9 foreign keys referencing `user_accounts` directly.
`budget_policies` and `budget_monthly_allocations` were checked and are covered —
they reference `category_budget_accounts` and reach the account through the
extension table.

Account identity in free text lives in exactly two places:

- `transactions.description` — what the scrub of step 7d rewrites.
- `account_name_case_backup_013` — zero rows on `fintrack_dev`, and its
 `account_id` cascades. **Re-count it on production before the first DELETE
 runs**: a non-empty table there is identity surviving an erase this plan has not
 accounted for.

**The scrub touches only text FinTrack generated, never text the owner wrote.**
Of 94 rows, 88 carry the literal `Transaction: ` separating an owner-written
prefix from the generated remainder; the account names sit in the generated half.
One row reads `20 mil cop para el pocket de prueba.` **before** its marker — an
account name the owner typed. A scrub matching on the name would rewrite their
note.

```
 generated counterparty identity   -> a neutral label
 owner-authored free text          -> untouched
```

**Stated rather than hidden:** where the owner wrote the name themselves, erasure
is incomplete. That is the correct trade. Deleting an account is not a licence to
rewrite the owner's notes.

---

## 9. The work

Eleven units. Each is one logical change; several will be more than one commit.
The order is forced where stated and free otherwise.

```
  1  RESTRICT on the three foreign keys                    §6
     SHIPPED 2026-08-27 - 7f96a43 (both schema build paths and the
     alignment file) and 699827b (migration 018, the ALTER that reaches a
     populated database). See the shipped block in §6.
     Containment. Stops the damage today. Depended on nothing.
     Breaks the current deletion route, which is the point: it is the only
     route that executes and the one that corrupts.

  2  the single derived balance writer                     §7
     Re-count the call sites first - the inventory was built from the
     deletion module and the account-creation path calls these writers too.
     The updated_at question is NOT settled here: retroactive dating closed
     it in 1208310 and this unit inherits the result.
     Waits on retroactive dating's read commit, which freezes the
     derivation this writer consumes. Building it first would propose a
     second definition of the same number.
     SHIPPED, committed, re-measured 2026-09-04. setAccountBalanceFromLedger
     exists and consumes derivedBalance.js; the movement path, both creation
     paths and both delete-path call sites call it after inserting their rows
     or annulment rows. The inline writer, updateAccountBalance.js and
     updateAffectedAccountBalance.js are all gone from the repository. Four
     commits, all dated 2026-08-30: 921bd216, 83d22cab, d41aca25, 3de47e4d.
     See the corrected census in §7.

  3  D1: how the existing drift is repaired                blocks unit 4
     An adjusting transaction that leaves a visible trail, or a dated freeze.
     The correct figures are already known - every balance is derivable.
     This is an audit-trail decision, not an accounting one.
     CLOSED 2026-08-30 by the developer, per ESTADO_PLANES.md §4: neither
     option above - a third, silent re-derivation, writing no row, on the
     grounds that the drift was never a ledger error, only a wrong projection
     of it. This document's own text above still poses D1 as open; that text
     is superseded by the developer's decision, not by a measurement of this
     file.

  4  repair the drift                                      needs 2 and 3
     Only after 2, or the repair leaks. Re-measure production first: the
     figure is from 2026-08-23 and was taken on a copy, and the per-account,
     per-movement-type breakdown is what revealed the second drift source.
     EXECUTED 2026-08-30 on fintrack_dev, per ESTADO_PLANES.md §4: slack
     -75.97 -> -90.22, banco 102.59 -> 90.58, inBestMen 2.14 -> 1.39, inside
     one transaction using the shipped helpers (ascending-id lock, derivation
     as a later statement). Zero accounts left unreconciled on that database.
     Not independently re-verified here - it is a database measurement, not a
     code one, and this pass does not query fintrack_dev.

  5  the seventh account_type, and the account-closure movement type
     Makes the boundary structural. Today it is a convention: the account is
     recognised by the literal string 'slack', matched in 41 places, and
     those 41 are correct - the dashboard already excludes it from every
     aggregate, so the figures it reports today are right.
     (Re-measured 2026-08-30: 41 non-comment occurrences of the literal
     'slack' under backend/src, 16 of them in dashboardController.js and 25
     elsewhere. The figure was 46 when it was first taken.)
     What the type buys is that the convention stops being load-bearing.
     Rename the account, or let an owner create one called "slack", and 41
     filters change meaning with no error anywhere.
     Unit 11 needs the same distinction to partition counterparties for its
     net-worth figure. It could match on the name like everything else, so
     this is robustness, not enablement - but it is the last unit that would
     have to be rewritten if the convention is kept and later breaks.

  6  the assessment endpoint                               §4.1 step 2
     Server-side. Replaces the impact report that arrives in the request
     body today, where the client dictates the balances the server writes.

  7  the settlement engine and CLOSE                       §3.1, §4.1
     TRANSFER and DISCARD, the invariants, and the deleted_at write path.
     Revisit the column name here.

  8  the read sweep                                        several commits
     75 FROM/JOIN of user_accounts across 21 files; 8 filter
     deleted_at IS NULL. Each remaining call site needs a recorded decision
     - filter, or deliberately not. This is the largest unit in the block.
     (Re-measured 2026-08-30 over backend/src/**/*.js. It was 68 across 22
     files with 9 filters when first taken; the pocket module added read
     sites and one file dropped out.)

  9  D2: destination eligibility for TRANSFER              blocks the selector
     Which accounts may receive a residual. Types, currency, closed state.

 10  DELETE                                                §3.2
 11  RTA                                                   §3.3, needs 5
     One pair per counterparty, the counterpart leg owned by A. The live
     route pairs against the system account instead, so its boundary pair
     cancels itself and the reversal moves no money out (log §14.16).
     The legacy route is retired only here, once both replacements work.
```

**Unit 1 goes before unit 4, and that inversion is deliberate.** Repairing while
the destructive route is still reachable is repairing into a leaking bucket: one
deletion between the two re-corrupts it, and afterwards nothing distinguishes the
good figure from the bad one.

**Nothing is removed before its replacement works.** The current route stays
reachable until unit 7 ships.

### Decisions still open

Two block units inside this plan and are listed above as units 3 and 9. Three do
not block and are closed when the code reaches them:

```
 D3  whether deleting an account and deleting the user share a code path.
     Sharpened by §6: with RESTRICT in force, deleting a user fails today.

 D4  what a detached counterparty row means to the dashboard aggregate at
     dashboardController.js:582-583 - the JOIN predicate matching
     tr.destination_account_id and tr.source_account_id. (Anchor
     re-measured 2026-08-30; :576-577 is now the SELECT list.)

 D5  whether `description` stops embedding the counterparty going forward.
     If it does, the scrub of §8 shrinks to a one-time backfill.

 D6  whether `deleted_at` is renamed to `closed_at`, at unit 7.
     Recommended yes (§3.1). Until it is, the name means CLOSED, not
     deleted, and nothing in the code may read it as deletion.
```

---

## 10. Out of scope

The self-referencing opening balance, where an account's opening writes its own id
into both transfer columns, is a separate question with its own recommendation
(both `NULL`) in the research log. It is adjacent, not part of this block.

Account name collisions — two `investment` accounts named `InVestMent` and
`INBESTMEN` were observed while measuring — belong to
`PLAN_ACCOUNT_NAME_UNIQUENESS.md`.

No frontend work is specified here beyond the three screens implied by §3. The
component-by-component sequence is written when unit 7 opens.

---

## 11. Where the evidence is

`PLAN_ACCOUNT_DELETION/RESEARCH_LOG.md`, 4,186 lines. It is a research log, not a
plan, and it is kept because every figure in this file is traceable to a
measurement in it:

```
 §10       the production drift traced to its mechanism
 §12       the schema audit - no entries table, the FK inventory, movement types
 §13       the first specification, superseded in six places by §14
 §13.9     the two deletions executed and measured on fintrack_dev
 §14       the architecture, and the four corrections that produced it
 §14.14    the second drift source, found in the account-creation path
 §14.15    the live RTA screen evaluated against the model
 §14.16    the third deletion, executed through the live route and measured
```

The four corrections are worth knowing about before re-opening a settled point:
account removal is a lifecycle rather than one operation; RTA is an operation and
not a settlement policy; a reversal has no shortfall; and a falling net worth is
the correct outcome of a reversal rather than a defect.

---

## Corrections of record — 2026-08-30

Measurements only. No decision was closed, deleted or reworded, and no work unit
was reordered. Verified against the working tree of `fix/auth-screen`, HEAD
`e919a89`, uncommitted changes included.

| where | what was corrected |
| --- | --- |
| §1, the cascade | the three transaction foreign keys read `RESTRICT` today, not `CASCADE`; the real anchors named. Correction added beneath the paragraph, which is kept because the three measured deletions ran under the cascade |
| §1, the second drift source | **marked, not struck.** The two commented-out balance posts are live calls to the derived writer at `accountCreationController.js:402` and `accountCategoryCreationcontroller.js:489`; `createPocketAccount` no longer exists in that file |
| §4.2 | the commented-out `transaction_entries` block is at `003_transactions.sql:65-81`, not `:63-79` |
| §6 | the three declaration anchors re-measured: `createTables.js:163,169-170`, `003_transactions.sql:39-41,48-53`, and section 8 of `supabase/001_production_alignment.sql` at `:527-574` |
| §7, the writer census | **marked, not struck.** Two writers, not three. `setAccountBalanceFromLedger.js:48` is the derived one with five call sites; `updateAffectedAccountBalance.js:8` is the surviving absolute one with two, at `deleteAccountService.js:273` and `:311`. `updateAccountBalance.js` is deleted in the working tree, and `transactionController.js:125-144` no longer holds a writer |
| §7, the call-site inventory | re-counted; the account-creation half is closed and the movement path already inserts rows before deriving |
| §9 unit 2 | marked as partly shipped and uncommitted, with what remains named. The unit is not reordered and not closed |
| §9 unit 5 | the `'slack'` literal is matched in 41 non-comment places, not 46 — 16 in `dashboardController.js`, 25 elsewhere |
| §9 unit 8 | the read sweep re-measured: 75 `FROM`/`JOIN` of `user_accounts` across 21 files, 8 carrying `deleted_at IS NULL` |
| §9, D4 | the dashboard counterparty predicate is at `dashboardController.js:582-583` |

**Verified and left alone:** the locking pattern at `budgetAllocationService.js:122`
(`FOR UPDATE OF ua`); the canonical derivation builder at
`accountDataRetrieval/derivedBalance.js`; commit `1208310`; the shipped block of
§6, which was already correct. The research log's stated length was updated to
4,186 lines, since this pass lengthened it.

**Not re-measurable here.** Everything taken against `fintrack_dev`,
`fintrack_rehearsal` or `fintrack_prod_data` — the three executed deletions and
their figures, the 22 base tables and 9 foreign keys of §8, the zero row count of
`account_name_case_backup_013`, the 20-account reconciliation state, and the
description census of §8. No database was queried. Those figures stand as dated
measurements, not as claims about today.
