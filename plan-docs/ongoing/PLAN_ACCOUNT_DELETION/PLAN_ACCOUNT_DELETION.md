# PLAN — Account removal

**Block:** account removal. **Status:** architecture frozen 2026-08-26. Units 1
through 4 are shipped, unit 5 is in progress, units 6 through 11 are open by
design, not unfinished — see §9. **Migration:** unit 1's is written and
applied; unit 5's is pending on `backdating`.

`PLAN_ACCOUNT_DELETION/RESEARCH_LOG.md` is superseded, marked historical
2026-09-06 — every measurement and architecture decision it produced is
folded into this file. Read it only for the audit trail behind a specific
figure; nothing here depends on it.

---

## 1. The problem

`transactions` references `user_accounts` three times — `account_id`,
`source_account_id`, `destination_account_id`. A financial event is **two
rows**, one owned by each side, with nothing linking them: there is no entries
table (`transaction_entries` is commented out,
`003_transactions.sql:65-81`). Deleting an account without first handling the
rows that merely mention it — rather than own it — corrupts every
counterparty's ledger.

All three foreign keys are `ON DELETE RESTRICT`, shipped 2026-08-27 in
migration `018_alter_transactions_account_fks_to_restrict.sql`; both schema
build paths declare it too
(`createTables.js:163,169-170`, `003_transactions.sql:39-41,48-53`).
**`RESTRICT` is a guard rail, not the integrity mechanism (§6):** it stops a
physical delete that still has references, but it does not settle a residual
balance, detach a survivor's rows, scrub identity, or assert an invariant.
That is what §2-§9 build.

**Measured under the old cascade**, before `RESTRICT` shipped — evidence for
why an engine is needed, not a live threat today:

```
 account 31   wrote 2 annulment rows, destroyed 7 - three of them owned by banco
 account 13   wrote 4 annulment rows, destroyed 5 - two owned by surviving accounts
 account 42   wrote 6 reversal rows, and broke a fourth account by 0.75
```

`banco` was left carrying a stored balance of 205.41 against rows summing
262.40. The third deletion ran through the live reversal route and is
informative beyond the cascade: **it pairs every correction against the
system account instead of against the target**, so the pair that should
return 15.23 to the boundary lands on the boundary twice and cancels itself
(log §14.16). That defect survives `RESTRICT` and is why unit 11 (RTA) is
still open.

**A second, independent drift source is closed at the source.** Two
account-creation paths used to skip posting the funding account's balance on
an opening with a starting amount; both now call the derived writer live
(`accountCreationController.js:402`, guarded by `if (isTransfer)`;
`accountCategoryCreationcontroller.js:489`, guarded by `if (!isAccountOpening)`).
`createPocketAccount` no longer writes a `user_accounts` row at all — pocket
creation moved to the pocket module. The drift those two paths had already
written before the fix was separately repaired (unit 4, executed 2026-08-30).

The ledger itself was always intact — every movement type nets to zero. What
broke was the stored balance column, not the record, which is why every
figure was recoverable by derivation (§7).

---

## 2. What is being built

Three operations over an account's life, two settlement policies, two states
that exist and one terminus that does not.

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

**"Deleted" is not a state.** A deleted account is the absence of a row, not a
row carrying a flag. Written as a state it invites a `deleted` boolean and
queries that keep reading rows meant to be gone.

**The policies belong to CLOSE and DELETE. RTA takes neither**, because a full
reversal leaves no residual to place (§3.3).

### The governing principle

> An account whose ledger balance is zero can be removed without any
> financial position changing. When the balance is not zero, the removal must
> first settle it according to an explicit choice by the owner.

### Why CLOSE is the normal operation

Mature products in this category all separate closing from deleting, and all
make closing the default once an account has history. **FinTrack diverges
deliberately: it offers account-level erasure anyway**, because the owner's
claim to have their data removed is judged to outweigh the historical
argument. What the divergence does not license is making erasure the
*ordinary* way to retire an account.

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

**The column is `deleted_at`, and that name is legacy.** Until it is renamed
it means **closed**, never deleted: a deleted account has no row for a column
to carry. Every query reading `deleted_at IS NULL` is asking *is this account
in circulation*, and must be read that way.

**Recommendation, to be executed at unit 7: rename it to `closed_at`.**
Recorded as D6 (§9). Unit 7 is the moment because unit 8 immediately
afterwards visits 75 read sites, 8 of which filter this column — renaming
first means unit 8 sweeps under the final name instead of being redone.

### 3.2 DELETE — the exceptional one

**The owner asks:** remove this account and what belongs to it.

```
 settle the residual  ->  detach counterparty pointers
                      ->  scrub A's identity from surviving text
                      ->  drop A's rows, then A
```

Rows owned by other accounts survive, detached, rendering as **Deleted
account**.

**Settlement is not optional here.** A financial event is two rows; deleting
`A`'s rows removes one leg of every event `A` took part in. Unless those rows
already sum to zero, the global ledger stops closing. Settling first is what
makes the removal safe.

**Net worth:** identical to CLOSE. Erasure moves no money.

### 3.3 RTA — the reversal

**The owner asks:** make it as though this account had never existed.

```
 for each counterparty c of A:  write the pair   c: +net(c)   A: -net(c)
   ->  A is at zero by construction
   ->  detach, scrub, drop A's rows, then A
```

**The unit of reversal is the counterparty — not the row, and not the
event.** Written as *reverse every row A owns with its opposite pair*, an
implementation has to rediscover the pair by matching fields, and writes it
twice for any event whose two legs `A` owns. The per-counterparty form cannot
double-count, because `net(c)` is an aggregate. §4.2 gives it as SQL.

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
self-referencing openings of §10, plus one self-cancelling pair. **They sum
to zero per account**, so they contribute nothing to `balance(A)` and nothing
to any `net(c)`. They are skipped, and the sum being zero is asserted rather
than assumed: a nonzero residue is a broken row whose counterparty cannot be
guessed, and the operation aborts.

A reversal never needs the system account to absorb a shortfall: what `A`
spent never left the system — a FinTrack expense credits a budget category
account, a counterparty like any other.

**Net worth: RTA is the only operation that can raise it**, by whatever `A`
consumed, since that spending is undone. It can also lower it, by whatever
entered through `A`'s opening. Which is correct — money that came from
outside and is declared never to have entered must leave.

> **The net worth impact of a reversal is exactly the portion of the balance
> whose counterparty is the boundary.** Everything with an internal
> counterparty redistributes; only the boundary portion leaves.

**Internal counterparties do not cancel against each other.** They
redistribute part of `A`'s balance among the owner's other accounts, and what
does not stay inside is exactly what came from outside.

**RTA must never appear as a third destination option** beside "to another
account" and "out of FinTrack". Those answer *where does this money go*; RTA
answers *should these movements have happened*. Different questions, one of
which can increase net worth.

---

## 4. The engine

CLOSE and DELETE share one procedure and differ only after the settlement.
RTA is a separate procedure that shares infrastructure, not control flow.

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

Steps 6d and 7d skip rows `A` owns; those are dropped at 8d, so scrubbing
them is wasted work.

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

Measured over all 115 rows of `fintrack_dev` on 2026-08-26:

```
 49 rows   source_account_id names another account        sum +1268.63
 49 rows   destination_account_id names another account   sum -1268.63
 17 rows   neither does                                   15 of them amount 0.00
```

**Every row resolves exactly one counterparty, or none — never two.** So the
counterparty is a projection of the row, and both steps 2 and 4 read from the
same expression:

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

**The boundary is an ordinary `c`, and this is where the live route fails.**
It pairs every correction against the system account rather than against
`A`, so when `c` is the system account both legs land there and cancel (log
§14.16). Pairing against `A` makes the case disappear: there is nothing
special about the boundary.

#### What becomes of the reversal rows

**The legs owned by surviving counterparties persist. They are not
scaffolding.** Only the legs owned by `A` disappear, at step 6, with every
other row `A` owns, because `A` does.

Invariant II is what forces it. Take the measured case — `cuenta precargada`
holds 133.49 and the reversal credits it 2.00:

```
 rows kept    the original -2.00, detached, and the reversal +2.00
 balance      135.49, back to what it was before A ever existed
 reconciles   yes, and only because the reversal row is still there
```

Drop the reversal row and the balance says 135.49 while the rows say 133.49.
**A reversal that erases its own evidence breaks the invariant it exists to
satisfy.** It is also the counterparty's honest history: they did send 2.00,
and it was later reversed. These rows are detached and scrubbed like any
other surviving row that names `A` (§8).

**The description prefix `RTA Annulment Target(` is a cross-module
invariant, not just wording.** Four Overview queries
(`overviewInvestmentRepository.js:71`, `overviewMonthlyRepository.js:113`,
`overviewTransactionRepository.js:135,147`) filter these rows out of
investment/spend figures by matching that exact literal. Step 7d's SCRUB must
strip the account name *inside* the parentheses only, never the prefix
itself — rewriting it would desynchronize all four filters with no error, and
annulment rows would silently start counting as ordinary activity. The
prefix is `RTA_ANNULMENT_TARGET_PREFIX`, exported from
`recordAnnulmentTransaction.js`, for the four readers to import instead of
hand-copying.

### 4.3 Lock sets

```
 CLOSE / DELETE + TRANSFER    { A, D }
 CLOSE / DELETE + DISCARD     { A, S }
 RTA                          { A } u cp(A)
```

**The lock set and the set of accounts permitted to change balance are
always identical** — you lock exactly what you may change. If an
implementation needs to lock more, the authorized set grew and invariant III
must be re-derived, not widened quietly.

The DETACH of step 6d touches rows of counterparties that CLOSE and DELETE do
**not** lock. That is correct: it changes their rows, never their balance,
and the `UPDATE` takes its own row locks. RTA does lock them, because it
moves their balances. One principle, two outcomes.

**The system account is in RTA's lock set as an ordinary counterparty**, not
as an absorber: every account carries an opening whose opposite leg belongs
to the boundary.

The locking pattern already exists at `budgetAllocationService.js:122`
(`FOR UPDATE OF ua`). Copy it.

---

## 5. The invariants

Asserted on the transaction's own client, immediately before `COMMIT`. Each
must return nothing, or the transaction rolls back.

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

**Reconciliation is not classification, and invariant II only asserts the
first.** Every balance can equal the sum of its own rows while a report still
misreads which accounts represent the owner: the sum of *all* balances is
zero by construction in a closed book, so it is not a position and no screen
shows it. The owner's position is the sum of the accounts that represent the
owner, which is a question of account type (§9, unit 5), not of arithmetic.

**III — only the authorized set moved, and by exactly the right amount.**
The first two clauses hold for every operation. The third is the operation.

```
 all          changed accounts  subset of  the lock set of the operation
              SUM of deltas over the changed set = 0
              delta(A) = -balance_before(A)

 settlement   exactly two accounts move
              delta(D or S) = +R,  where R = balance_before(A)

 reversal     delta(c) = +net(c) for every counterparty c
              SUM over c of net(c) = balance_before(A)
```

`delta(A)` is the same expression in both, so the clause that actually
separates them is the one below it: **settlement moves the whole balance to
one place the owner named; reversal returns each piece to where it came
from.** An implementation asserting only `delta(A) = -R` accepts a reversal
that credited the wrong counterparties — which is exactly the live defect of
log §14.16.

One dependency to state rather than assume: `delta(D) = +R` holds in raw
amounts only if `A` and `D` share a currency. Whether they may differ is
decision D2 (§9). If cross-currency destinations are allowed, this clause
becomes `delta(D) = +convert(R)` and the sum-to-zero clause has to be
evaluated in one currency.

**IV — no surviving text names `A`.** DELETE and RTA only. This is the one
invariant the database cannot enforce; the three referential ones are
guaranteed by the foreign keys, and identity lives in free text.

### Confirmed violation of invariant I, found 2026-09-06

`overview-agent` measured, read-only on `fintrack_dev`: summing every account
of the same owner, boundary account included, should net to zero under
double entry. It comes to `-60.00`. Traced with a read-only script against
the live rows (kept at `eraseAccountTail.js`'s own reasoning, not guesswork):

- `RTA_TEST_TARGET_RTA`'s deletion wrote the usual annulment pair — its
  counterparty `RTA_TEST_COUNTERPARTY_RTA` got a `+10`/`-10` correction row,
  boundary got the mirrored `-10`. `RTA_TEST_COUNTERPARTY_RTA` was later
  deleted too. That second deletion's `eraseAccountTail` ran `DELETE FROM
  transactions WHERE account_id = $1` unconditionally over
  `RTA_TEST_COUNTERPARTY_RTA`'s own rows (§4.1 step 8d) - which erased its
  half of the first annulment along with everything else it owned. Boundary's
  mirrored row (`transaction_id 182`, `account_id 14`) was never touched,
  because it belongs to boundary, not to the account being erased.
- Same mechanism, `UNIT6_TARGET` / `UNIT6_COUNTERPARTY_1788738324084`,
  `transaction_id 185`, `-50.00`.
- The other six recorded annulments cancel to the cent - only pairs where the
  counterparty side was *itself later deleted* are affected.

**Root cause:** an RTA annulment pair (`recordAnnulmentTransaction.js`) is
two `transactions` rows on two different `account_id`s, correlated only by
matching text in `description`. Nothing links them at the schema level.
`eraseAccountTail`'s 8d DROP treats "every row this `account_id` owns" as
free to erase - correct for an ordinary account, wrong for one that is half
of a still-load-bearing pair whose other half lives on boundary and survives.
Invariant I, if it had been asserted at commit time, would have caught this
the moment it happened; the legacy route (§9, "Legacy route patched") predates
the invariant engine and asserts nothing.

**Recommended fix, not yet built - needs a schema decision before it can be
written safely:**

1. Give `recordAnnulmentTransaction` a way to link the pair it writes -
   a nullable, self-referencing `related_transaction_id` on `transactions`,
   set on both inserted rows to point at each other. Free to add at that
   call site; the two rows are already written together.
2. `eraseAccountTail`'s 8d DROP, before deleting a target's own rows, deletes
   any row's `related_transaction_id` counterpart too (wherever it lives -
   boundary or elsewhere) and re-derives that counterpart owner's balance
   through the existing `setAccountBalanceFromLedger` writer. An annulment
   pair then either survives whole or is erased whole; boundary can never be
   left holding half of one.

**Why not patched now:** text-matching the pair well enough to delete the
right row (same target name, opposite account, no coincidental collision) is
the fragile alternative, and `migrations-must-be-right-the-first-time`
applies here as much as to a schema file - a wrong match deletes the wrong
transaction. The link column is `backdating`'s file
(`agent-ownership-split`), scoped separately from unit 5's boundary-type
migration; this fix waits for that coordination rather than shipping a
text-matched guess. Flagged, not silently deferred: this is a real,
production-reachable bug (any live RTA delete whose counterparty is later
itself deleted hits it), not dev-only noise.

---

## 6. Referential safety

```
 transactions.account_id                RESTRICT
 transactions.source_account_id         RESTRICT
 transactions.destination_account_id    RESTRICT
```

Declared in three places, which must change together:

```
 backend/src/db/run_time_db_init/createTables.js:163,169-170
 backend/src/db/migrations/sql_migrations/003_transactions.sql:39-41,48-53
 backend/src/db/migrations/supabase/001_production_alignment.sql:527-574 (section 8)
```

Shipped 2026-08-27 in two commits: `7f96a43` (both schema build paths and the
alignment file) and `699827b` (the dedicated chain migration
`018_alter_transactions_account_fks_to_restrict.sql`, 83 lines, with UP and
DOWN). The migration is what reached the populated database — a rule
declared inside `CREATE TABLE IF NOT EXISTS` is inert on a table that already
exists, and a file whose name is already in the migration ledger is never
executed a second time. `018` is in the migration ledger of `fintrack_dev`
(read 2026-08-30). `PLAN_SUPABASE_MIGRATION.md` §1 records it as run against
production on 2026-08-27; this document does not independently verify
production.

The other six foreign keys to `user_accounts` stay untouched — they are 1:1
extension tables and their cascade is correct.

**`RESTRICT` is a guard rail, not the integrity mechanism. Integrity comes
from the engine.** It does not block an authorized deletion — it blocks any
physical deletion that still has transaction references:

```
 DELETE A directly                ->  RESTRICT rejects
 DELETE A through the engine      ->  settle, detach, drop A's rows  ->  accepted
```

By the time the engine drops `A`'s row, counterparty pointers are nulled and
`A`'s own rows are already gone, so nothing references `A` any more.

**Consequence to record:** with `RESTRICT` in force, deleting a *user* also
fails, since `users` cascades to `user_accounts`. That is decision D3 (§9).

---

## 7. The single balance writer

One function writes `account_balance` today:

```sql
setAccountBalanceFromLedger(client, accountId, userId)

  UPDATE user_accounts ua
     SET account_balance = (SELECT COALESCE(SUM(amount),0)
                              FROM transactions WHERE account_id = $1),
         updated_at = CURRENT_TIMESTAMP
   WHERE ua.account_id = $1 AND ua.user_id = $2
 RETURNING account_id, account_balance;
```

`backend/src/utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js:48`,
consuming the canonical derivation at `accountDataRetrieval/derivedBalance.js:24`
— the same builder every read site joins, so there is one definition of an
account's balance, not two.

Seven call sites: the movement path (`transactionController.js:832` and
`:838`, after `recordTransaction` inserts its rows), both account-creation
paths (`accountCreationController.js:402` and `:910`;
`accountCategoryCreationcontroller.js:489`), and both delete-path sites
(`deleteAccountService.js:307`, per affected account inside
`processRTAAnnulment`'s loop; `:313`, the compensation account once after the
loop) — all scoped by `user_id` inside the writer itself.

**Shipped and closed**, across four commits dated 2026-08-30 —
`921bd216`, `83d22cab`, `d41aca25`, `3de47e4d`. The absolute writers this
unit replaced — the inline statement that used to sit in
`transactionController.js`, `updateAccountBalance.js` and
`updateAffectedAccountBalance.js` — no longer exist in the repository. Unit 2
of §9 needs no further decision.

**The consequence this unit exists for:** `user_accounts.account_balance` is
no longer a source of truth; it is an enforcement projection of the ledger.
No screen reads it — what still does is the sufficient-funds guard on the
write path and the pocket module's committed-cash ceiling
(`CROSS_PLAN_MATRIX.md`). This is cross-cutting, not exclusive to account
removal — it reaches creation, movements, transfers and back-dating, and
lives here because invariant III (§5) cannot name the accounts whose balance
changed while more than one function could change it.

---

## 8. Identity erasure

**Boundary: the application's persisted tables.** Backups, logs and
snapshots are retention policy with their own clock. A `COMMIT` cannot
guarantee anything outside its own transactional domain, and asking it to is
what makes erasure an open-ended task that never gets declared satisfied.

Measured: 22 base tables, 9 foreign keys referencing `user_accounts`
directly. `budget_policies` and `budget_monthly_allocations` are covered —
they reference `category_budget_accounts` and reach the account through the
extension table.

Account identity in free text lives in exactly two places:

- `transactions.description` — what the scrub of step 7d rewrites.
- `account_name_case_backup_013` — zero rows on `fintrack_dev`, and its
  `account_id` cascades. **Re-count it on production before the first DELETE
  runs**: a non-empty table there is identity surviving an erase this plan
  has not accounted for.

**The scrub touches only text FinTrack generated, never text the owner
wrote.** Of 94 rows, 88 carry the literal `Transaction: ` separating an
owner-written prefix from the generated remainder; the account names sit in
the generated half. One row reads `20 mil cop para el pocket de prueba.`
**before** its marker — an account name the owner typed. A scrub matching on
the name would rewrite their note.

```
 generated counterparty identity   -> a neutral label
 owner-authored free text          -> untouched
```

**Stated rather than hidden:** where the owner wrote the name themselves,
erasure is incomplete. That is the correct trade. Deleting an account is not
a licence to rewrite the owner's notes.

**The interim legacy patch (§9) does not implement this split yet.**
`eraseAccountTail.js` runs a plain `REPLACE` of the account name anywhere in
`description`, generated or owner-authored — the generated/owner-half
distinction above is unit 7/8's job, not built into the patch that keeps the
legacy route reachable today.

---

## 9. The work

Eleven units. Each is one logical change; several will be more than one
commit. The order is forced where stated and free otherwise.

```
  1  RESTRICT on the three foreign keys                    §6
     SHIPPED 2026-08-27 - 7f96a43, 699827b (migration 018).

  2  the single derived balance writer                     §7
     SHIPPED 2026-08-30 / 2026-09-04. setAccountBalanceFromLedger is the
     only writer, seven call sites; both absolute writers it replaced are
     gone from the repository.

  3  D1: how the existing drift is repaired                 
     CLOSED 2026-08-30 by the developer: a silent re-derivation, writing no
     row - the drift was a wrong projection of the ledger, not a ledger
     error.

  4  repair the drift                                      needed 2 and 3
     EXECUTED 2026-08-30 on fintrack_dev: slack -75.97 -> -90.22, banco
     102.59 -> 90.58, inBestMen 2.14 -> 1.39, in one transaction using the
     shipped locking/derivation helpers. Zero accounts left unreconciled on
     that database. Not re-verified since.

  5  the eighth account_type (`boundary`) and the account-closure
     movement type
     `boundary` account_type SHIPPED 2026-09-06, `b8480e4f` - see "Unit 5
     scoping" below. Makes the `slack` boundary convention structural
     instead of a name match for the account side, account_types row 8.
     The `account-closure` movement type SHIPPED 2026-09-06/07,
     `backdating`'s 032_add_account_closure_movement_type.sql - applied to
     fintrack_dev, movement_type_id 10 and transaction_type_id 6, both
     named `account-closure`; parity green. Both halves of unit 5 are
     closed. No writer references either id yet - that is unit 7's
     settlement engine, not this unit.

  6  the assessment endpoint                               §4.1 step 2
     STARTED 2026-09-06 - see "Unit 6 started" below. The lock-then-compute
     step is built for RTA; a standalone endpoint reachable ahead of any
     deletion type, not just RTA, is still open.

  7  the settlement engine and CLOSE                       §3.1, §4.1
     OPEN. TRANSFER and DISCARD, the invariants, the deleted_at write path,
     and the deleted_at -> closed_at rename (D6).

  8  the read sweep                                        
     OPEN. 75 FROM/JOIN of user_accounts across 21 files, 8 filtering
     deleted_at IS NULL - each needs a recorded filter decision.

  9  D2: destination eligibility for TRANSFER              blocks unit 7's selector
     DECIDED 2026-09-07, Carlos. The eligible type is bank, alone. See
     "Destination eligibility decided" below for the rule, the reason, and
     why withdrawal from the system is not a destination.

 10  DELETE                                                §3.2
     OPEN, behind units 6, 7, 9.

 11  RTA                                                   §3.3, needs unit 5
     OPEN. The legacy interim patch (below) keeps the route reachable; this
     unit replaces it with the real engine, including the correct
     per-counterparty pairing (§4.2) the live route still gets wrong.
```

**Nothing is removed before its replacement works.** The current route stays
reachable until unit 7 ships.

### Decisions still open

Two block units inside this plan and are listed above as units 3 and 9 (unit
3 is now closed). Three do not block and are closed when the code reaches
them:

```
 D3  whether deleting an account and deleting the user share a code path.
     Sharpened by §6: with RESTRICT in force, deleting a user fails today.

 D4  what a detached counterparty row means to the dashboard aggregate at
     dashboardController.js:576-583 - the JOIN predicate matching
     tr.destination_account_id and tr.source_account_id.
     MEASURED, 2026-09-06 (main-agent): not the same shape as this module's
     NULL-unsafe predicate. The aggregate pairs the two columns positionally,
     `(amount > 0 AND account_id = destination_account_id) OR (amount < 0
     AND account_id = source_account_id)` - a nulled counterparty drops one
     side of the OR, the row still counts through the other side. Different
     failure mode, not a silent drop. The remaining open question is
     Overview/main-agent's own: whether a residual with no live counterparty
     should get a new inflow path into the boundary account, tracked on
     their side, decided together with the sweep-vs-line answer below so the
     correction is not written twice.

 D5  whether `description` stops embedding the counterparty going forward.
     If it does, the scrub of §8 shrinks to a one-time backfill.

 D6  whether `deleted_at` is renamed to `closed_at`, at unit 7.
     Recommended yes (§3.1). Until it is, the name means CLOSED, not
     deleted, and nothing in the code may read it as deletion.
```

### Unit 5 scoping, 2026-09-06

**This unit renames no account.** It converts the existing `slack` account's
`account_type` to `boundary`; the account's `account_name` stays `'slack'`
throughout, including through a partial backfill. That is what keeps
Overview's 34 name-based filters (`account_name != 'slack'`) valid and
unaffected by this unit or by how long the backfill takes — a name change is
what would break them silently, and none is planned here or anywhere else in
this document. If one is ever proposed, it goes to `overview-agent` first,
per the sequencing `overview-agent` set: name only moves after Overview's
filters have already switched to `account_type_id`, itself gated on the
backfill being provably complete.

**Why boundary must stay out of every published figure — measured, not just
argued.** Boundary is a contra account: every account-opening credits the new
account and debits boundary, so boundary's balance is the mirror image of
everything every account in the system has ever held. On `fintrack_dev`,
boundary's own derived balance for the test owner is `-100,166.14`. Summing
that into net worth doesn't shade the number, it collapses it toward zero —
the type filters exist for this reason, not as a technicality.

**Names decided by the developer.** The new `account_type` is `boundary` —
the term this document already uses for the concept (§4.2-§4.3), not an
invented one, and not `system_boundary`: "system" implies internal
machinery, which contradicts the RTA treating this account as "an ordinary
counterparty" (§4.3). The new `movement_type`/`transaction_type` for closing
an account is `account-closure`, mirroring `account-opening`'s exact naming
convention.

**Backward-compatibility scope, measured.** The `'slack'` literal falls into
three patterns, and only one depends on `account_type`:

| pattern | sites | depends on `account_type` | touched by this unit |
|---|---|---|---|
| A - inline name exclusion (`account_name != 'slack'`) | 8 | no | no |
| B - parameterised name exclusion (`values:['slack']`) | 26 (`dashboardController.js`, `getAccountController.js`) | no | no |
| C - identification/creation by name+type | 13, of which **3 hardcode `account_type_name = 'bank'`** (`accountUtils.js:63` `getSlackAccountId`; `checkAndInsertAccount.js:12` default param; its inline duplicate at `transactionController.js:229-260`) | yes, those 3 | yes, only those 3 |

The 34 name-only sites (A+B) are untouched - the account's name doesn't
change in this unit. Only the 3 sites that today require
`account_type_name = 'bank'` are updated, and they accept `'boundary'` OR
`'bank'`, not `'boundary'` alone: if the backfill (below) lands after this
unit's migration, existing boundary accounts stay typed `'bank'` until it
runs, and a strict `'boundary'`-only check would stop recognising them.

**Done, 2026-09-06 - identification widened, insertion left unchanged.** All
three sites now recognise the account under either type; none of them create
a new one as `'boundary'` yet, because that type doesn't exist in any catalog
until `backdating` applies the migration - inserting against it today would
404. This is a deliberate split, not a partial fix:

- `accountUtils.js:56-75` (`getSlackAccountId`) - a read-only lookup, its
  `JOIN` now matches `account_type_name IN ('bank', 'boundary')`.
- `checkAndInsertAccount.js` - a generic check-or-create helper also used
  with explicit types for unrelated accounts
  (`accountCreationController.js:648`), so only the omitted-type call shape
  (the one every boundary-account caller uses) was widened: the existence
  check matches either type, the insert path still resolves `'bank'` when no
  type is given. An explicit-type caller is untouched.
- `transactionController.js:229-263` (`checkAndInsertSlackAccount`) - its
  existence check was already type-agnostic
  (`WHERE account_name = $1 AND user_id = $2`, no join to `account_types`),
  so nothing changed there; a comment now documents that its hardcoded
  `account_type_id` literal `1` is `'bank'`.

Once the backfill is resolved and `backdating` applies the migration, a
follow-up change decides whether these sites should start inserting new
boundary accounts as `'boundary'` - not part of this unit.

**Settled, 2026-09-06 - `b8480e4f`.** The backfill scope question above is
closed: `031_add_boundary_account_type.sql` backfills existing `'slack'`
accounts to `boundary` in the same transaction as the type's own insertion,
not in a later migration. The migration's own reasoning (quoted from its
header): "a type with no rows in it is worse than no type at all" - the
first read filter rewritten to `account_type_id <> 8` against an
unbackfilled catalog would stop excluding the compensation account
silently, with nothing on screen to say the figure had gone wrong.

**Migration authorship.** Per the 2026-09-06 session split
(`agent-ownership-split` memory), the session named `backdating` is sole
owner of `backend/src/db/migrations/sql_migrations/`. No migration file for
this unit is written until coordinating with it; this unit can still prepare
the migration's exact content and the three call-site updates ahead of that.

**Adjacent, not decided here:** whether the `movement_type` <-> `account_type`
pairing (only `investment`, `account-opening` and `pnl` appear on
`investment` accounts today) becomes a real constraint (FK/CHECK) or stays
convention. Flagged as a measurement, not a request - it isn't part of unit
5's scope and stays open.

**Corrections from `overview-agent`, 2026-09-06.** The 34 above counts every
textual occurrence of `'slack'`; the number that answers "what would a rename
break" is 26 (the live SQL exclusion predicates that actually run) - reconcile
against their own message if the two numbers are needed side by side, it's
their count to own. Separately: `accountUtils.js:56-77` (`getSlackAccountId`)
has zero callers anywhere in `backend/src` - confirmed by grep. It was listed
above as one of the three sites this unit widened; the widening is harmless
but the function is dead code, not a live site, so it shouldn't be counted
alongside `checkAndInsertAccount.js` and `transactionController.js` as
something a rename or a backfill gap would actually reach.

**`backdating` has applied the migration - `b8480e4f`.**
`031_add_boundary_account_type.sql` ran on `fintrack_dev` and everything is
committed, including the matching updates to `checkAndInsertAccount.js`,
`transactionController.js` and `populateDB.js`. Measured after applying, per
`backdating`'s own report: `account_types` now holds eight rows; account 14
(the one named `'slack'`) moved from `bank` to `boundary`; live `bank`
accounts dropped from five to four; `npm run db:parity` is green on both
build paths; the backend boots and loads the currency catalog. The
sequencing risk flagged in the previous version of this paragraph -
`insertAccountType` defaulting to `'boundary'` before the type existed - no
longer applies, since the type and the default landed in the same commit.

**Real vulnerability found by `overview-agent`, fixed here, 2026-09-06.**
Nothing reserves the name `'slack'` at account creation - no `UNIQUE` on
`(user_id, account_name)`, no validation. An owner can create an ordinary
bank account named exactly `'slack'`; every read filter then excludes their
own account as if it were the boundary one, and
`checkAndInsertAccount.js`'s existence check, matching on name with no
`ORDER BY`, could hand either row back as "the" compensation account -
meaning RTA could start writing annulment legs into a real user account.
Preventing the collision at creation is out of this module's scope
(`accountCreationController.js`, per `agent-ownership-split` - already with
the developer). What's in scope and fixed: `checkAndInsertAccount.js`'s
existence check now compares `account_name` exact-case instead of
`LOWER()` on both sides (closes the cheaper case-variant version of the same
hole - a `'Slack'` account, unnoticed by the case-sensitive read filters,
used to be handed back as the compensation account) and orders by
`account_id ASC LIMIT 1`, so if a genuine exact-name collision exists the
oldest account wins deterministically instead of whichever row Postgres
returns first - not a full fix, but no longer a coin flip. Committed as
part of `b8480e4f` - `backdating` folded both changes into their own
migration commit rather than splitting them out, with this unit's authorship
of the two named explicitly in that commit's message.

### Legacy route patched, 2026-09-06

Migration 018 (unit 1) turned the three `transactions` foreign keys to
`user_accounts` from `CASCADE` to `RESTRICT`. No application code ever
detached a target account's transaction references before deleting it, so
the legacy route - the only one that executes, per units 10/11 above - was
throwing a foreign-key violation on every deletion of an account with at
least one transaction row, from that migration onward.

Applied §4.1's own DETACH/SCRUB/DROP algorithm (steps 6d/7d/8d) to the
existing legacy service, as an interim patch, not as unit 6/7's replacement:

- Shared helper `backend/src/utils/fintrackUtils/accountDeletionUtils/eraseAccountTail.js`,
  called from all three places in `deleteAccountService.js` that used to run
  a bare `DELETE FROM user_accounts` - the RTA path with financial impact,
  the RTA path with none, and the plain hard-delete path.
- `processStandardDelete` gained a `userId` parameter it was missing; its
  hard-delete branch referenced `userId` in a log line while never receiving
  it, throwing `ReferenceError` before the query ran.
- The RTA lock set (§4.3, `{A} ∪ cp(A)`) now includes `targetAccountId`
  itself in the `lockAndDeriveBalances` call in `processRTAAnnulment` - it
  was locking every affected account and the boundary account, but not the
  target, leaving two concurrent deletes of the same account unserialized.

`RESTRICT` remains the actual safety net; this patch's only job is making a
correct call reach it. Units 7, 9, 10 and 11 are unaffected and still fully
open - CLOSE, TRANSFER/DISCARD and the invariant assertions are not part of
this change. Unit 6 is addressed next.

### Unit 6 started, 2026-09-06: RTA no longer trusts a client-supplied impact report

`getAnnulmentImpactReport(userId, targetAccountId)` used to run on `pool`,
before the RTA execution transaction opened, and the result travelled to the
client and back as `impactReport` in the execution request body - a TOCTOU
gap: a stale or tampered copy was taken at face value when writing the
financial adjustment.

- `getAnnulmentImpactReport` now takes `dbClient` as its first parameter and
  queries through it; the GET preview endpoint
  (`accountDeleteController.js#generateImpactReport`) passes `pool`,
  unchanged for that read-only path.
- `processRTAAnnulment` (`deleteAccountService.js`) locks `targetAccountId`
  first, then calls `getAnnulmentImpactReport(dbClient, userId,
  targetAccountId)` itself, inside the open transaction, and computes both
  the non-empty and zero-impact cases from that result. It no longer
  receives `impactReport` as a parameter.
- `executeAccountDeletion` (`accountDeleteController.js`) no longer reads or
  validates `req.body.impactReport`; `deleteAccountService` dropped the
  parameter entirely. `targetAccountName` is still read from the body - it
  is cosmetic (annulment description text only), never a financial figure.

**FE requirement:** `useRTAImpactAndDeletion.ts` (`~line 101`) still sends
`impactReport` in the DELETE execution body. It is now ignored server-side,
so nothing breaks, but it should be dropped from that payload as cleanup -
it is dead weight, not a contract the backend reads.

Still open for unit 6: a standalone assessment endpoint that runs this same
lock-then-compute step ahead of any deletion type, not just RTA.

**Extracted, 2026-09-06/07 - not yet committed (freeze).** The lock-then-report
step RTA already ran inline is now `assessDeletionImpact(dbClient, userId,
targetAccountId)` (`getAnnulmentImpactReport.js`), and `processRTAAnnulment`
calls it instead of inlining the two steps - a pure extraction, verified by
boot test, RTA's own behavior unchanged. Two open decisions this does NOT
settle, deliberately left to the developer rather than guessed:

- **Should HARD's execution call `assessDeletionImpact` too**, purely to lock
  the target (closing the same concurrency gap RTA already closed) and to
  return the impact it is about to leave uncorrected, without applying any
  of it - or does a type whose entire point is "no reversal" gain nothing
  from computing the reversal it will not make? Not called from
  `processStandardDelete` yet.
- **The impact-report's NULL-unsafe predicate** (`getAnnulmentImpactReport.js`,
  `tr.destination_account_id != tr.source_account_id`) silently drops a row
  whose counterparty was already nulled by an earlier deletion's DETACH step
  - the same mechanism behind the invariant-I violation above. What should
  happen to that residual amount: swept into the boundary/slack account, or
  surfaced as its own "no live counterparty" line in the report? Needs an
  answer before this gets a fix; a guessed one risks writing the wrong
  correction rather than none.

  **Evidence gathered, 2026-09-06, still Carlos's decision.**
  `pern-fintrack-cf` measured the live shape of this on `fintrack_dev` (named
  explicitly here - the original message said only "the development ledger,"
  ambiguous now that a third, unmeasured database has surfaced; corrected by
  `cf` on the same day): summing every account under one owner,
  boundary/compensation account included, must net to zero under double
  entry; it is instead −60.00, entirely from two prior deletions whose
  annulment wrote only the
  compensation leg and never the leg on the affected account (the other six
  recorded deletions cancel to the cent). Overview's own ruling is that the
  compensation account is legitimate to read only as a server-side
  sum-to-zero assertion, never as a figure shown on a card - which means a
  silent sweep into it leaves exactly this kind of drift invisible on every
  screen. That measurement favors the "no live counterparty" line over a
  silent sweep, since it is the only one of the two that keeps the residual
  visible to the one reader positioned to act on it. Recorded as input, not
  as the decision - it is still Carlos's to make.

**Widened, 2026-09-06 - the same query drops rows two more ways, and the
consequence reaches further than the display.** Answering `e4`'s and `cf`'s
cross-module sweep for the third NULL shape (a nullable join key eliminating
a row before any predicate runs), `getAnnulmentImpactReport.js` has two more
sites beside line 917's inequality, both in the same query
(`getAnnulmentImpactReport.js:37-92`):

- Line 76, `JOIN user_accounts ua ON ua.account_id = tat.affected_account_id`
  (inner): when the CASE at lines 43-46 falls through to a counterparty
  column already NULLed by `eraseAccountTail.js`, `affected_account_id`
  itself is NULL and this join drops the row outright.
- Line 82, `JOIN account_types acctype ON ua.account_type_id =
  acctype.account_type_id` (inner): an affected account whose
  `account_type_id` is NULL is invisible to this join. Confirmed reachable
  by `pern-fintrack-02`: `account_type_id` is nullable with `ON DELETE SET
  NULL` in both build paths (`002_accounts.sql:92-94`,
  `createTables.js:69`), a legal state everywhere, not only after 031's
  catalog rollback.

All three sites are inside `assessDeletionImpact`'s report, and `cf`
identified the consequence this doc had not written down: `impactReport`
is not only what the owner reviews before confirming - `processRTAAnnulment`
(`deleteAccountService.js:205-264`) builds its financial-adjustment rows
and `finalSlackBalance` directly from that same array. A row the report
drops is a row the annulment never writes and an adjustment the slack
account never receives, so the defect is not under-display, it is
under-correction: fewer annulment rows than the deletion required, and the
boundary account left short by the missing amount. `cf` also traced four
Overview readers that consume exactly those written rows by description
prefix (`overviewInvestmentRepository.js:126,130`,
`overviewMonthlyRepository.js:114`, `overviewTransactionRepository.js:
136,148`), and flagged that Overview's own capital+PnL+closure reconciliation
cannot detect this class of shortfall - both sides of that identity read the
same possibly-incomplete row set, so it stays balanced even when the set is
short.

Not measured against a live instance - no database here has both a
completed prior HARD delete and a later RTA on the same counterparty - but
`pern-fintrack-02` confirmed lines 55 and 76 trace to this module's own
`eraseAccountTail.js` regardless of any catalog ruling, and only line 82's
reachability depends on Carlos's open `account_type_id` decision below. Not
fixed, not staged - holding on this per the new completion-pause rule
(2026-09-06, "each peer pauses at the end of a finished unit and reports to
main-agent rather than picking up the next thing"), pending Carlos and
triage.

**`account_type_id` NOT NULL, 2026-09-06 (`pern-fintrack-02`, open with
Carlos).** `NOT NULL` cannot coexist with the column's current `ON DELETE
SET NULL` - the catalog delete would try to write a forbidden NULL and fail
at runtime - so ruling `NOT NULL` necessarily replaces the delete action.
Of the three candidates, `CASCADE` would delete user accounts when a
catalog row goes (wrong direction of destruction) and `NO ACTION` buys
nothing; `RESTRICT` is the survivor. **Corrected, 2026-09-06
(`pern-fintrack-02`): the stronger precedent is not another table but the
adjacent line in this one.** `user_accounts` declares its two catalog
references consecutively at `createTables.js:69-70` -
`account_type_id` nullable with `ON DELETE SET NULL`, then `currency_id`
immediately below it, `NOT NULL` with `ON DELETE RESTRICT`. The outlier is
against its own neighbour in its own table, which a "transactions has
different requirements" counter-argument cannot reach; the
movement-type/transaction-type precedent on `transactions`
(`createTables.js:169-172`) is secondary support, cited first only because
it was read first. **Corrected a second time, 2026-09-06
(`pern-fintrack-02`): the first correction's own qualification was a
relayed partial list, not a full count, and understated the convention it
was meant to temper.** Measured directly against the file rather than
relayed a third time: `createTables.js` holds 32 references to
`currencies(currency_id)`, of which 29 are `ON DELETE RESTRICT` and
exactly 3 are `SET NULL` (`:18, :83, :135`) - not the roughly-even split
the earlier eight-citation list implied. With `transactions`' two movement
catalog columns at `:169-172` also `RESTRICT`, the schema's convention for
catalog references is `NOT NULL` with `RESTRICT`, held at 29 of 32
`currency_id` references and both of `transactions`' catalog columns, with
three `currency_id` exceptions. `account_type_id` at `:69` is the outlier
against a near-uniform convention, not against a split file - against its
own neighbour `currency_id` at `:70` before any other table is consulted.
Whether the three `currency_id` exceptions are themselves defects is a
separate, unopened question. Ruling `RESTRICT` for `account_type_id` would
make the database enforce, rather than merely comment, the ordering 031's
own reverse section already states
by hand. If ruled, line 82 above stops being reachable
(with it, `cf`'s two Overview left-joins and `e4`'s seven become
unnecessary); lines 55 and 76 are unaffected either way. Separately,
`pern-fintrack-02` found 031's own reverse-migration guard already uses
`IS DISTINCT FROM` and fails closed on a NULL type, but its error message
misdescribes the cause (blames an unknown creation path rather than a
deleted catalog row) - not corrected, since the migration is applied and
editing one after the fact is what "right the first time" forbids.

**Ruled, 2026-09-06.** Carlos, verbatim via `pern-fintrack-e4`: "si, cn
restrict, entonce." `account_type_id` becomes `NOT NULL` with
`ON DELETE RESTRICT`. Enforcing migration `033` is backdating's, not yet
written - its shape waits on a read nobody has taken yet, whether any row
in a live database carries a NULL type today. Until `033` is applied on
both build paths, a database short of it still permits the NULL, so no
defensive code comes out here on the strength of the ruling alone.
**What it closes, re-confirmed against the file, not re-derived from
memory:** `getAnnulmentImpactReport.js:82`'s `JOIN account_types acctype
ON ua.account_type_id = acctype.account_type_id` only - the NULL that
join could see becomes impossible once the column can't hold one.
Line 55's `tr.destination_account_id != tr.source_account_id` and line
76's `JOIN user_accounts ua ON ua.account_id = tat.affected_account_id`
both trace to a NULL on `transactions.source_account_id` /
`destination_account_id` (nulled by `eraseAccountTail.js`'s DETACH step
on an earlier deletion), a different nullable column on a different
table - the ruling does not reach either. Of the three sites, one closes,
two remain fully open regardless.

**Fixed, 2026-09-06.** Line 82's join is now `LEFT JOIN`, guarding the
window before `033` lands; line 55's comparison is now `IS DISTINCT FROM`,
guarding the self-affected-account filter against either side being NULL.
Both are correct today and become redundant once `033` ships on both the
chain and the boot DDL - `pern-fintrack-02` will record that redundancy in
`033`'s own header when it is written, rather than either guard being read
later as leftover mess and tidied away. Line 76's join is unchanged,
waiting on Carlos's ruling on what the report does with an amount whose
counterparty no longer exists (a different question from this one -
whether the row survives to be reported at all, not whether its type can
be resolved).

**Holds as one block, not two commits (`pern-fintrack-e4`, binds on
sight, no separate authorization needed).** The three sites are the same
file, the same report, the same defect class - a commit carrying the two
finished fixes without the third would publish a report that is
null-safe in two places and still wrong in the one that needed the
ruling, with no way for a reader of that commit to tell which is which.
Nothing from this fix lands until line 76 is answered too.

**Ruled, 2026-09-06 (line 76).** Carlos, verbatim via `pern-fintrack-e4`:
"si con B." The question: when a transaction's counterparty account no
longer exists (its reference already nulled by an earlier deletion), does
the report fold that amount silently into the boundary/slack account
(A), or show it as its own line with no account name, so the owner sees
both the amount and the fact that its counterparty is gone (B)? Carlos
took B - the same principle applied twice already tonight elsewhere:
publish the third thing rather than fold it into one of the other two.

**Fixed and pushed, 2026-09-06 (`30bbd526`).** All three sites now
null-safe in `getAnnulmentImpactReport.js`: line 76's `user_accounts` join
is `LEFT`, and the `currencies` join right after it is `LEFT` too -
flagged by `pern-fintrack-e4` before it shipped, since `ua.currency_id` is
NULL the moment `ua` is absent, and an INNER join there would drop the
same row a second time. The current-balance field is guarded so a NULL
correlation (no live account to derive a balance from) surfaces as
`null`, never `NaN` - the derived-balance subquery correlates on
`ua.account_id`, which does not exist for this row. Also persisted
`assessDeletionImpact` (lock-then-report, unit 6's TOCTOU fix), already
decided, sitting uncommitted in the file until now. `origin/main..HEAD`
checked clean before push - only this session's own commit was ahead.

**Still open, discovered while fixing the report: the execution path has
nowhere to put the money.** `processRTAAnnulment`
(`deleteAccountService.js:247-320`) still recomputes the same report
inside its transaction, and for this row `affectedAccountId` is `null`.
`recordAnnulmentTransaction` needs a real account to post the reversing
leg against - there is none. `setAccountBalanceFromLedger(dbClient, null,
userId)` does not throw (`WHERE account_id = NULL` matches nothing, a
silent no-op), but `ledgerBalanceOf(null)` returns `NaN`, and the
amount was already subtracted from `finalSlackBalance` via
`totalAffectedAccountAdjustement` regardless of whether the corresponding
leg ever gets written anywhere. Carlos's ruling settled what the REPORT
shows before confirmation; it did not settle what EXECUTION does with an
amount that has no live counterparty to post against - a distinct
question from the original D4 framing (which asked about both together).
Not fixed, not attempted - broadcast to all three peers, held pending a
decision.

**RESOLVED AND REVERTED, 2026-09-06/07 - read the resolution below before
acting on anything in this entry. The crash described here was created by
`30bbd526` and removed by reverting it; the reasoning that follows is kept
because it is how the underlying arithmetic was finally understood, not
because it still describes the code.**

**LIVE CRASH, confirmed by `pern-fintrack-e4`, 2026-09-06 - not a pending
design choice, a hard failure today.** `createTables.js:178` declares
`transactions.account_id INTEGER NOT NULL REFERENCES
user_accounts(account_id) ON DELETE RESTRICT`.
`recordAnnulmentTransaction` inserts two rows per report row - one at its
own line 108 with `account_id: affectedAccountId`, one at line 136 with
`account_id: slackAccountId`. For the orphaned row, the first insert
writes `account_id: null` and violates the `NOT NULL`, aborting the whole
RTA transaction. Before `30bbd526`, the inner join silently dropped this
row, so execution never reached it and the deletion completed on an
understated report; after it, the row is present and correctly reported,
and execution now hits the constraint - a better failure (loud, correct
number) than the one before it (silent, wrong number), per `e4`'s framing,
but still a failure. **Reachable, not theoretical**: any account being
deleted that has a transaction whose counterparty was itself deleted
earlier - ordinary history in a database where more than one account has
ever been deleted. Not behind the CLOSE release gate - this is the RTA
path.

Checked, per `e4`'s ask, whether the two other reads of a null
`affectedAccountId` in the same loop have their own failure modes:
neither does. `lockAndDeriveBalances`'s `WHERE ua.account_id = ANY($1::int[])`
accepts a `null` array element without error - it simply never matches a
row, so `ledgerBalanceOf(null)` resolves through `Map.get(null)` to
`undefined`, and `parseFloat(undefined)` is `NaN`, not a crash.
`setAccountBalanceFromLedger(dbClient, null, userId)`'s `WHERE
ua.account_id = $1` behaves the same way - zero rows match, `NOT NULL`
constraints on `user_accounts` are never reached, no throw. The
`NOT NULL` on `transactions.account_id` is the only hard stop; it fires
first in the loop, before either of these two would otherwise produce a
wrong-but-silent number.

`e4`'s recommendation, put to Carlos directly, not yet ruled: when there
is no live counterparty, post the reversing leg against the compensation
account alone (the only account that exists, and the one
`totalAffectedAccountAdjustement`'s arithmetic already assumes it lands
on - skipping the row outright would make the predicted and the
ledger-derived `finalSlackBalance` disagree by exactly the orphaned
amount, the disagreement `deleteAccountService.js`'s own comment on that
loop says should not happen). Compatible with Carlos's "B" - that ruling
governs what the report shows before confirmation, not where the money
lands once confirmed. Not implemented; `deleteAccountService.js` and
`recordAnnulmentTransaction` untouched pending the ruling.

**Resolution: Carlos withdrew B, the join is back to INNER, and the crash
is gone with it (2026-09-07).** Carlos's words, relayed by `e4`: "bueno,
entonces que la decision de B, no aplica," and then, on the revert
itself, "si ya evaluaste pros y cons y esta tu recomendacion?, entonces
dale." So the LEFT JOIN on `user_accounts` that `30bbd526` introduced no
longer has a ruling behind it, and it is not being kept as a compromise
on top of one.

**`e4` retracted the compensation-account recommendation above, and the
arithmetic that overturned it is the part worth keeping.** Traced
independently here before reverting anything, because it reverses a fix
this session had already pushed. A transfer of 90 from C to T writes two
rows, `account_id = C` for -90 and `account_id = T` for +90, both naming
C as source and T as destination. Deleting C by RTA reports T as affected
for -90 and writes the reversing pair, which puts -90 on T against the
compensation account and +90 on the compensation account itself. The
erasure tail then nulls the source on T's surviving +90 row and deletes
C's own row. **T is now holding both halves**: +90 with a NULL
counterparty, and -90 against the compensation account. They cancel
inside T.

So when T is deleted later, the NULL group's +90 arrives at the report
**already reversed** - its reversal is the other row, sitting in the same
account. An INNER join drops a group that is settled, not an amount that
is lost, and the earlier framing of this as a silently wrong number was
wrong. Compensating it a second time would move the same money twice and
would break the agreement between the report's total and the compensation
balance the execution path re-derives from the rows it actually wrote.
The pre-`30bbd526` behaviour was correct arithmetic. `30bbd526` fixed
something that was not broken and, through `transactions.account_id NOT
NULL`, converted it into a hard abort of the whole deletion.

**What changed in the file, and what deliberately did not.** The
`user_accounts` join is INNER again with the reasoning above written into
it, and the `currencies` join follows it back for the reason it followed
it out - with `ua` guaranteed present, `ua.currency_id` is present. The
`account_types` join **stays LEFT**: that one is right for its own
separate reason, since `account_type_id` is nullable until 033 and the
type name is purely informational, so a NULL there costs nothing while an
INNER join would drop a real financial adjustment. The `IS DISTINCT FROM`
guard on the source/destination comparison stays exactly as it is; it
addresses a different failure and is still true - a row whose source was
nulled but whose destination is a live account is still correctly kept by
it and still survives the INNER join. The NULL guard on the balance was
**removed** rather than left as harmless: `user_accounts.account_starting_amount`
is `NOT NULL` and the derived-balance subquery `COALESCE`s its SUM, so
with `ua` guaranteed present the figure can no longer be NULL, and a
guard against an unreachable state would have gone on advertising a
nullable balance that nothing can produce.

**The durable fix is recorded here and deliberately not commissioned.**
The erasure tail nulls the counterparty reference; the plan's own
procedure (RESEARCH_LOG.md §5.2 step 1) says to RE-POINT it at the
internal counterparty account instead. Re-pointing removes the NULL group
at its source rather than dropping it at read time. It is not this
block's work and was not attempted: it changes the erasure tail shared by
CLOSE, HARD and RTA, and it does not repair the rows already nulled on
`fintrack_dev`, which need a backfill of their own. **Open block:
divergence between §5.2 step 1 and `eraseAccountTail.js`, plus the
backfill for rows already detached.** Both halves have to land together -
re-pointing alone leaves the existing NULL rows behind, and a backfill
alone leaves the next deletion creating more of them.

### Unit 5/7 catalog decision, 2026-09-06: the settlement pair keeps both ids

Gating question from `backdating`: does CLOSE's settlement write its own
`transaction_type`, or reuse `withdraw`/`deposit`? Decided: **both catalog
rows stay, and the settlement writer references both** -
`movement_type_id = 10` and `transaction_type_id = 6`, the pair
`032_add_account_closure_movement_type.sql` seeded, on the settlement's own
transaction row.

**Corrected twice, same day, both times by measurement.** First pass here
argued reusing `withdraw`/`deposit` would put the settlement back into the
PnL/dashboard inclusion lists (`dashboardMonthlyTotalAmountByType.js:125-127,
142-146`). `main-agent` checked it against the actual filters and it does not
hold - every one of those branches requires `movement_type_id` in `{1, 2,
5}` together with the transaction-type condition, the settlement always
writes `movement_type_id = 10`, so it is excluded regardless of which
`transaction_type_id` rides alongside it; nothing filters on
`transaction_type_id` alone. That reasoning was withdrawn in favor of
"consistency, not safety."

**`backdating` then measured the consistency framing itself and found it
understated the stakes: row 6 is a real, user-visible consumer, not a
naming nicety.** `dashboardController.js` reads `transaction_type_name`
through the catalog join and shows it to the owner directly - :779 and :817
select it for on-screen display in the debt/transfer/pnl movement lists,
:970 matches it in the dashboard's free-text search, :1092 filters on it by
name on its own, not paired with any movement-type condition. Reusing
`deposit` or `withdraw` for the settlement does not just misname it in
theory - the owner would see "deposit" in their transaction list and could
search for "closure" and find nothing, the same class of defect §3.1
describes for recording a closure as `pnl`, one catalog over.
`transaction_type_id = 6` is what the owner reads and searches by, not only
what a future maintainer reads in code.

`account-opening` already carries its own pair (`movement_type_id = 8` with
`transaction_type_id = 5`), and `deleteAccountService.js:117-121` already
resolves `deposit`/`withdraw` by name for RTA's own writes - a settlement
that names its own transaction type the same way reads as the same kind of
operation as every other boundary event, not a special case reusing a label
that means ordinary transfers. Follow-up for whoever writes the settlement
(unit 7, mine): name the closure id as a constant next to
`ACCOUNT_OPENING_MOVEMENT_TYPE_ID`, per the same file's own idiom, rather
than inlining `10`.

**Decided while answering `pern-fintrack-cf` (Overview), 2026-09-06: the
settlement does not carry `RTA_ANNULMENT_TARGET_PREFIX`.** That prefix means
"this row corrects for annulling target account X"
(`recordAnnulmentTransaction.js:24`, and Overview's own four readers key
their RTA-only filters on the exact string, per that file's comment). A CLOSE
settlement is not an annulment - the account being closed is not being
undone, it is being retired on purpose - so writing it under RTA's own
prefix would misrepresent the row to any RTA-specific reader and blur the
one signal Overview currently uses to tell the two operations apart. The
settlement gets its own description text; `movement_type_id = 10` is what
identifies it, the same way `deposit`/`withdraw` plus `movement_type_id`
identify every other operation without needing a shared text prefix.

**Gate, stated per branch, not per person - corrected 2026-09-06 by `cf`:**
no row of `movement_type_id = 10` is written until the investment card's
reconciliation (`overviewInvestmentRepository.js`, capital contributed +
realized PnL = ledger balance) accounts for that type **on both branches
that ship it.**

- `feat/overview` already carries a third, closure-adjustment term; widening
  it to read types 9 and 10 together (keeping the `RTA_ANNULMENT_TARGET_PREFIX`
  split for the two kinds of type-9 row) is `cf`'s four-line fix, written and
  held only for lack of a type-10 row to test against.
  **DONE, 2026-09-06** (`cf`, uncommitted at first): the realised/adjustment split
  moved the movement-type predicate into both filter clauses instead of the
  WHERE, so every row lands in exactly one term. Verified against
  `fintrack_dev` over six months: three PnL rows on investment accounts, zero
  closure rows, output byte-identical to before the edit - a no-op check,
  not a positive one. **Superseded same day - see "Superseded within the
  hour..." below**: pushed to `feat/overview` (`368f6c1c`) and then
  transplanted onto `main` (`0c5ab2bb`) by Carlos, closing this branch's
  side of the dependency at the source, not only in a working tree.
- `main` has no closure-adjustment term at all - a two-term reconciliation
  that a `movement_type_id = 10` row would enter on the balance side with
  nothing on the other side to absorb it. Satisfying the dependency against
  `feat/overview` alone still breaks `main`, which is the branch the card
  ships from.
- `main`'s reconciliation is already wrong today, independent of closure:
  `overviewInvestmentRepository.js:70-72` excludes
  `RTA_ANNULMENT_TARGET_PREFIX` rows from `realized_pnl` while the balance
  term counts every row - confirmed by reading the file, not relayed. Every
  RTA correction already understates the card by the corrected amount. This
  unit's writer would not create that defect, only add a second, larger
  source of the same failure to a figure the owner checks by eye.

Whoever ships unit 7's settlement coordinates the release with `cf` against
both branches before merging - not a flag-after courtesy.

**Independently re-measured on `main`, 2026-09-06 (`pern-fintrack-02`).**
Same conclusion as the line above, now with the exact citation, taken
directly rather than restated from a migration header. The durable part,
which survives any line shift: `main`'s `overviewInvestmentRepository.js`
reads capital contributed as `movement_type_id IN (6, 8)`, realized PnL as
`movement_type_id = 9` (less annulment-prefixed rows), and the ledger
balance as `SUM(account_balance)` over a CTE (`overviewInvestmentRepository.js:49-53`)
that aliases the shared DERIVED-balance expression as `account_balance` -
**corrected, 2026-09-06 (`pern-fintrack-02`, caught by `cf`, verified in
the file rather than taken on their word): this is a computation over
`transactions` recomputed on every read, wearing the stored column's name
two lines above the sum that reads it, not `user_accounts.account_balance`
itself.** The distinction sharpens rather than changes the finding: the
identity fails by the settlement amount as arithmetic, not as a stored
figure that merely might drift. At the state this was checked -
`main` at `b269463d`, file unmodified in the shared tree - those three
land at lines 58, 71 and 76 respectively
(`overviewInvestmentRepository.js:58/71/76` on `main` at `b269463d`); the
line numbers move once the closure-adjustment term lands, and are
`main`'s numbers specifically - `feat/overview` already carries a third
aggregate and its own, different lines for the same file. A
`movement_type_id = 10` row enters
none of the three aggregates but does move the balance the third one sums -
the card goes off by exactly the settlement amount, with no error, no NULL,
no zero, nothing to notice it by. `backdating` frames this as an ordering
constraint rather than a queue position: the event that breaks the card is
this writer's first row, not anyone's commit, so the closure-adjustment
term has to exist in `main`'s reader before that row reaches a database
anyone looks at - migration 032 itself (`b269463d`) changed nothing any
reader sees, since nothing writes the type yet. Confirms the gate stays
closed on the current condition; changes nothing about what unblocks it.

**Pushed, 2026-09-06 (`pern-fintrack-e4`).** `origin/main` is now
`78c4a95f` - Carlos authorized transplanting `032` (`b269463d`) and a
second commit adding a `closureAdjustment` field to the investment card
payload onto `main` by hand, and that push, nothing more. Resolves the
catalog-ordering dependency above: a fresh clone now carries the row this
writer references. Does not touch the gate.
`CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED` stays `false`, still uncommitted,
and `recordClosureSettlement.js` is still untracked - no committed code
path on any branch can write a closure row, so the closure-adjustment
decision carries no time pressure.

**Corrected within the hour, twice, independently (`cf` and
`pern-fintrack-02`): the pushed term does not satisfy the gate's
condition, despite its name.** Measured directly on `main` at `78c4a95f`
by both: the `realized` CTE's own `WHERE` still restricts to
`movement_type_id = 9` before either output column is computed. The
`closureAdjustment` field splits type-9 rows by the
`RTA_ANNULMENT_TARGET_PREFIX` description prefix - it closes the
pre-existing annulment double-count (real, separate work) - but a
`movement_type_id = 10` row is excluded by the CTE's `WHERE` before that
split ever sees it. A settlement row still enters the derived balance and
none of the three published terms, by exactly the settlement amount,
unchanged by tonight's push. At the time this was written, `cf`'s own
widened version existed only as nineteen uncommitted lines - since
superseded, next entry.

**Superseded within the hour by `cf`'s own correction, then by Carlos
transplanting it himself.** `cf`'s widened form never had the
prefix-vs-type trap described above: the realised branch selects the
profit-and-loss type AND an unprefixed description; the closure branch
selects the account-closure type OR a prefixed description, with the type
as the FIRST disjunct, so a no-prefix closure row is claimed by the
closure branch on its type alone and never reaches the realised one. `cf`
checked all four type/prefix combinations independently before calling it
disjoint and exhaustive. Pushed to `feat/overview` as `368f6c1c`
("split closures by type, not text"), verified against `fintrack_dev`
across six months: the identity holds, the adjustment is a real figure
rather than a zero standing in for one, no closure row exists yet so the
change measures as a no-op today, the module graph loads. **Then
transplanted onto `main` by hand as `0c5ab2bb`, by Carlos himself** (not
by any peer's authority) - same reasoning as the earlier transplant of
`032`: `feat/overview` binds every investment figure to the requested
month and `main` does not, so the transplant carries the type/prefix
split without the month bound. Verified there structurally only (module
graph loads, the mapping returns the field) - not executed against any
database in that checkout, since no writer produces a `movement_type_id =
10` row on any committed path yet. **`main`'s reconciliation gap for the
closure type is closed at the source as of `0c5ab2bb`**, pending the
live-row test neither branch can run until a settlement row exists to
run it against.

**The gate-wording point, `cf`, still stands and matters more than the
mechanism above.** A field or term existing on `main` is not the same
fact as the identity holding for a real closure row. A release condition
that reads "`main` has the closure-adjustment term" is now literally
true, while the property that actually matters - a closure row is
claimed by the closure term and the three-way identity closes over it -
remains unverified against any row, because none is committed anywhere
yet. The migration session's suggestion: test this by inserting a
`movement_type_id = 10` row inside a transaction and rolling it back,
which verifies the identity against a real row without ever publishing
one. **Written, run and passing as of the entry below.** This sharpens,
rather than replaces, the earlier candidate CI test for
`CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED` staying `false` - that test
guards the constant, this one guards the arithmetic the constant is
standing in front of.

### The gate's condition is now checkable, 2026-09-06/07

**The rollback probe exists and passes (`cf`).** A transaction inserts a
row carrying the account-closure movement type with no annulment prefix,
runs the investment pass, asserts, and rolls back. All three properties
hold on `fintrack_dev` against the code as it stands on `main`: the row
is claimed by the closure-adjustment term, it is not claimed by the
realised term, and the three published terms still sum to the ledger
balance with it present. Figures, so the condition carries a number
rather than a claim - baseline on the three investment accounts: realised
2.30, closure adjustment -0.75, ledger balance 100044.62; with one
settlement of -1234.56 present and uncommitted: realised unchanged at
2.30, closure adjustment -1235.31, balance 98810.06, contributed plus the
two terms equal to 98810.06 exactly. Zero closure rows in the table
before and after. Nothing persisted, no release constant touched.

**Its sixth assertion is the one worth tying the gate to.** It runs the
PRE-CHANGE predicate - bounded to the profit-and-loss type alone, split on
the description prefix - over the same row set and shows the identity
would be off by exactly the settlement amount. That makes the test exhibit
the false alarm rather than only confirm its absence, and it fails if
either half of the reconciliation change is reverted. A check that only
asserts the good state passes on code that never had the problem; this one
tells them apart.

**The writer's shape, asked by `pern-fintrack-02` and answered here from
the file rather than from memory: both legs carry the closure movement
type.** A settlement is a pair, and the probe inserted one hand-built row,
so the probe's result only extends to a real settlement if the pair is
uniform. It is: in `recordClosureSettlement.js`, both
`targetTransactionOption` and `boundaryTransactionOption` set
`movement_type_id: ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID`, unconditionally -
`isTargetPositive` decides the amount sign and which side is source and
which destination, and touches neither the movement type nor the
transaction type. There is no differently-shaped second leg. The scope
that makes this complete rather than partial: this is the DISCARD-policy
writer, and `processCloseAccount` refuses every other policy with a 400
(TRANSFER blocked on destination eligibility, D2, unimplemented), so the
uniform pair is the only shape any live code path can emit.

**Still to do before the constant flips, per `pern-fintrack-02`'s
proposal, which I accepted rather than substituting my reading of the
source for it:** have the probe call `recordClosureSettlement.js` inside
the same rolled-back transaction instead of hand-building its row. That
proves the reader and the writer agree, rather than proving the reader
agrees with somebody's reading of the writer, and it keeps proving it if
the writer's shape changes later. Requested `cf`'s script to extend with
the real call; it needs a live database, so it lands as an integration
script under the deletion module, not as a unit test pretending otherwise.
Result goes to `cf` and `pern-fintrack-02` before
`CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED` changes value.

**Only one of the two legs is ever visible to the investment pass
(`cf`, and it changes what the extended test proves).** The pair is
double-entry with opposite amounts, and the counterpart leg lands on the
boundary account - which every account set in the overview repository
excludes. So the leg on the boundary account is outside the investment
set, outside the three terms, and outside the derived balance, since the
balance is computed over that same set. What a real DISCARD settlement
shows the pass is exactly one row: the closure type, on the investment
account, carrying the negation of the residual, unprefixed - which is
the row the probe hand-builds. The consequence for the extended run,
worth asserting by direction rather than by magnitude: the closure term
must move **by the negation of the residual, not by zero**. Zero would
mean both legs entered the set, which is a finding about the boundary
exclusion rather than about the reconciliation - and both outcomes leave
the identity closing, so an assertion that only checks the identity
cannot tell them apart. Two properties of `cf`'s script to preserve if
it lands in the repository: the sixth assertion, which is what makes it
fail on a revert instead of passing on code that never had the problem,
and the exhaustiveness comparison against the unfiltered sum, which
catches a leg landing in neither branch - the identity alone can close by
coincidence wherever the missing amount happens to be zero.

**The boundary account's exclusion is by name, and migration 031 already
did the work that lets it stop being - checked here rather than taken
from the relay.** `cf` flagged the fragility: every aggregate keeps the
compensation account out by comparing `account_name` to the literal
`slack` (`overviewAccountRepository.js`, `AND ua.account_name != 'slack'`
in each account set), and nothing reserves that name at creation, so an
owner who names a real account exactly `slack` has it leave their own
figures silently. Correct as stated, and the enabling half is already
shipped: `031_add_boundary_account_type.sql` created the structural type
`boundary` **and backfilled the existing compensation accounts into it in
the same transaction**, for exactly this reason in its own words - "A
type with no rows in it is worse than no type at all. The whole purpose
of 'boundary' is to let a filter say `account_type_id <> 8` instead of
`account_name <> 'slack'`." It deliberately left the name alone so all
twenty-seven filters keep working through the retype untouched, which is
what makes rewriting them safe to do afterwards rather than atomically
with it.

So this is not an unknown fragility but the unfinished half of a plan
whose hard part is done, and the collision `cf` describes is precisely
what the type predicate resolves: post-031 the compensation account is
typed `boundary`, while an owner's colliding `slack` account carries a
real type, so a type predicate separates them where the name predicate
cannot. Two things for whoever rewrites those filters, neither of them
this module's file: the comment justifying the name check - "slack is
excluded by name because it is a bank account by type" - is **stale on
any database at chain 031 or later**, and is the reason the rewrite looks
unnecessary from inside that file; and the rewrite is only safe on a
database that has run 031, since an earlier chain still types its
compensation accounts `bank` - the same asymmetry `checkAndInsertAccount.js`
already handles on the write side by matching `['bank', 'boundary']` when
the caller omits a type. Note the split that leaves: post-031 the
**writer** already resolves the boundary account safely, by type and by
oldest id; the **readers** do not.

**The trap for whoever writes the real fix, flagged by `pern-fintrack-02`
before anyone attempts it: widening the `WHERE` to `movement_type_id IN
(9, 10)` alone makes this worse, not better.** The FILTER split
partitions on the description prefix, not on the movement type. This
settlement writer's rows deliberately carry no
`RTA_ANNULMENT_TARGET_PREFIX` (Unit 5/7 catalog decision, above - "a
closure is not an annulment"), so a naively widened split would land
every closure row in the `realized_pnl` branch: a retired account
indistinguishable from a gain, the exact defect `032`'s catalog type was
created to eliminate. A correct fix has to select the closure branch on
`movement_type_id`, not the prefix, in both the CTE's `WHERE` and the
`FILTER` clauses together. This also confirms, from the opposite
direction, that the writer's no-prefix design is the right call and not
something to revisit for Overview's convenience - a prefix-based
reconciliation was always going to need the type, not the text, to tell
the two apart.

**The mechanism, checked independently by `cf` rather than taken from the
above, line citation corrected twice more the same day
(2026-09-06).** The investment balance is derived from the ledger on
every read, not stored - the shared expression zeroes exactly one row, an
account-opening movement whose own account equals its `opening_for_account_id`,
and lets every other movement type fall through into the sum. **Named by
shape, not by line, per `pern-fintrack-02`'s correction**: this CASE
recurs identically in all three balance builders in `derivedBalance.js`
(`ledgerBody`, `derivedAccountBalanceSql`, `userAccountBalancesCte`) - a
first attempt cited working-tree line numbers that a fresh clone of `main`
would not match (a ten-line offset from the closure constants block this
session added), and one of the two even clipped mid-expression against
the committed blob. A shape survives the next insertion above it; a line
number does not. **Confirmed independently by two sessions against the
committed blob, not one relaying the other**: `cf` checked it after
`pern-fintrack-02` raised that an earlier "on `main`" claim was really
about the shared tree, and `pern-fintrack-02` checked it separately,
before repeating the conclusion rather than on its strength alone - three
CASE occurrences in the committed file, only
`ACCOUNT_OPENING_MOVEMENT_TYPE_ID = 8` present, no closure constant, no
comment, every CASE already falling through on every non-opening type
regardless. This is the one load-bearing claim in the whole thread: the
identity failure exists on a fresh clone of `main` today, with no
uncommitted work of this session's involved. The closure-specific comment naming
why it does not read `ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID` - "a closure
settlement is a real movement of money and stays inside the sum, unlike
the opening row above" - sits at `derivedBalance.js:56-61`, **which is
this session's own uncommitted work, not something a fresh checkout of
`main` carries** (`git status` shows the file modified; the closure
constants and that comment are mine, added alongside
`recordClosureSettlement.js`). The mechanism it describes was already true
on `main` before this session touched the file - an unlabelled `ELSE
tr.amount` already caught every non-opening type, closure included - the
comment only names a case that already fell through. So the settlement
row enters the balance by design, on the very
first write, with no code change required to make it happen - which is
what turns this writer's first row into the event that breaks the card,
not anyone's migration or commit. `cf`'s framing: readiness and hazard are the
same moment here - if this writer is ready before the freeze decision on
`main`'s missing term comes back, being ready early is the risk, not an
advantage, and is worth saying to Carlos in those words if that ordering
is ever close. Separately noted: this writer is currently the only
consumer of `ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID` anywhere on `main`.

**The gate is two independent facts, not one - `cf`, 2026-09-06.**
`recordClosureSettlement.js` is untracked - it exists in no commit on any
branch, not just behind the release constant. So the hazard is held shut
twice over: the constant, and the writer's absence from history. The
constant alone is the weaker of the two - one line a merge could resolve
the wrong way, with nothing that fails when it does. Worth adding before
this file is committed: a test asserting
`CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED === false` (or that
`processCloseAccount` throws), so a flip is caught by CI rather than by a
reader. Not written yet - noted as a candidate next step, not started
under the pause.

Also reconfirmed, unrelated to the above: migration 033 (the `account_type_id`
`NOT NULL`/`RESTRICT` enforcement, ruled two sections above) does not exist
yet. Ruled is not applied - until 033 lands on both the chain and the boot
DDL, a database still permits the NULL, so no defensive check in the
deletion path comes out on the strength of the ruling alone. Matches what
this doc already recorded; carried here because it was reconfirmed
independently rather than assumed still true.

**Flagged by `cf`, 2026-09-06: account resolution elsewhere constrains on
type, not only on id.** The transfer path's account resolution matches on
owner, id (or name) AND account type in both its branches - by design, it
is how a retired movement type becomes unwritable (a request naming that
type finds no account of a type that no longer exists, and 404s before
any row is written). Relevant here because this module retypes and
deletes accounts: any path that resolves an account by id while also
requiring its current type will stop resolving the moment CLOSE or a
future retype moves that account to a different type - correct behavior,
but it surfaces as "account not found" for an account that plainly
exists, with nothing in the message about the type. Not a defect in this
module today; a note for whoever writes CLOSE's TRANSFER policy (D2) or
any retype path, so the failure is not mistaken for a missing account
when it happens.

**Writer built and gated behind this section, 2026-09-06.** CLOSE's DISCARD
settlement is implemented -
`processCloseAccount`/`recordClosureSettlement.js` - but sits behind
`CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED = false` at the top of
`processCloseAccount` (`deleteAccountService.js`), which throws before
anything is locked. Fails closed: the constant is checked before any lock is
taken, so there is no window where a row can exist and a reader not account
for it yet - not dependent on remembering a merge order. The literal reason
a `movement_type_id = 10` row cannot exist yet: it flips to `true` only once
`feat/overview`'s widened reconciliation (done, above) AND `main`'s missing
closure-adjustment term (still absent) both exist, and `cf` has confirmed
the writer's first row against both. Boot-tested clean; no row has been
written by this code.

**Status code corrected same day, `cf`'s catch.** First written as 503;
`cf` flagged the semantics without measuring whether it mattered yet -
generic retry logic treats "service unavailable" as worth retrying, and this
will never succeed until a constant changes in code, so a caller that
retries would loop forever on a permanent block. Checked before fixing:
grepped `frontend/src` for `DELETION_TYPE_CLOSE`, zero matches - unreachable
from any UI today, so the fix cost nothing to make immediately. Changed to
409, matching the HARD-delete guard's own use of 409 for a state-dependent
refusal, not a transient one.

**Catalog landed, gate unchanged, 2026-09-06.** Migration 032 is in `main`'s
chain (backdating's commit) - the `movement_type_id = 10` /
`transaction_type_id = 6` pair exists on `fintrack_dev`, chain at 032, with
zero transactions referencing it there. Named the database and the chain
position rather than "the development database" - the migration session
flagged that phrase as identifying nothing with three databases on this
machine, and `cf` re-took the reading in scoped form. `cf` re-checked their
own widened
reconciliation pass against this rather than re-asserting the earlier claim
that it was inert either way: it filters transaction rows by type id without
joining the movement-type catalog, so a missing catalog row cost it nothing
- confirmed safe by measurement, not by construction alone. None of this
moves the release gate: it still needs `main`'s missing closure-adjustment
term (line 1126-1130 above), still absent. Standing agreement with `cf`:
tell them the moment this writer produces its first real closure row, so
they can re-run the reconciliation against an actual row instead of an
empty type. Two empty sets on `fintrack_dev`, chain at 032, noted for
whenever a closure test is built: zero accounts of the pocket-saving type,
zero of the cash type - that is a property of this database's seed data
today, not of the application, and a closure test exercised against either
type on `fintrack_dev` will find nothing to
run against.

**That empty type does not reach this module's pocket reads - checked here
rather than assumed, 2026-09-06/07.** `cf` broadcast that the retired
pocket account type carries zero live accounts while the same database
holds six planned pockets and twenty-three commitment rows, so a query
that reaches pocket figures *through that account type* returns a
structural zero instead of an error - and flagged it as possibly bearing
on the deletion paths. It does not, for a structural reason worth
recording rather than re-deriving: both places this module touches pocket
data key on the commitment row's own source account, never on an account
type. The read is `getPocketAllocationImpact`'s
`WHERE pa.source_account_id = $1 AND pa.user_id = $2` in
`getAnnulmentImpactReport.js`, and the write is the matching
`DELETE FROM pocket_allocations WHERE source_account_id = $1 AND user_id = $2`
in `eraseAccountTail.js`. Neither joins `account_types`, so neither can
be silently emptied by a type that has no accounts under it - both see
commitment rows directly, and would see any of those twenty-three that
named the account being deleted.

**Two further `cf` findings, checked and clean.** The product's existing,
enforced, user-facing name for spendable cash is *unassigned cash* - bank
balance less pocket allocations - and any new "available"/"free" figure
would have to defer to it: this module publishes no such figure at all
(nothing in `services/delete_account/` names one), so there is no
conflicting framing to correct. And `cf`'s self-correction that "money the
pocket holds" is not a real system concept - a pocket is a plan, an
allocation is a commitment against a real account, and no allocation moves
money - was checked against this module's own documents for propagation
from the earlier wrong phrasing: the only place the wording appears is
`RESEARCH_LOG.md`'s destination-eligibility row, which already states it
the corrected way ("a pocket holds assignments, not funds, so it is not
eligible") and is the reason a pocket was ruled out as a TRANSFER
destination in the first place. Nothing to fix.

**Corroborated independently, 2026-09-06 (`e4`).** A repo-wide sweep found no
other endpoint answering a deliberately-disabled feature with a retryable
status, and a matching precedent already exists -
`overviewController.js:157` returns 501 for a section not yet built, with
its own reasoning at `:18`. 409 (this case: the request conflicts with
current system state) and 501 (that case: the resource genuinely does not
exist) are both correct for what each actually is, and neither is
interchangeable with the other's case. Frontend side checked too: no retry
logic in the repo keys on any status but 401 (`authFetch.ts:54-84`, once,
flag-guarded, skipped for four auth endpoints); `"503"` appears in no
`.ts`/`.tsx` file. **Verified independently against `e4`'s note that CLOSE's
only current "entry point" is `AccountingDashboard.tsx:520`:** read the
function - `handleDeleteAccount` only navigates to
`/fintrack/account/:id/delete`, this module's own route. Not a second
deletion flow, no duplicate to reconcile - the eventual method-choice screen
(SOFT/HARD/RTA/CLOSE picker) stays entirely inside
`editionAndDeletion/`.

### Two frontend seams agreed with `e4`, 2026-09-06

**Route registration stays split by file, not by feature.** `App.tsx` is
`e4`'s; every component under `editionAndDeletion/` is this module's.
Whoever adds a route there sends the path and the component import to `e4`
to register - neither side edits the other's file. Keeps the shared tree
from taking two writers on one file, the same failure the freeze exists to
avoid at the git level.

**The recovery/reopen screen for closed accounts is unowned, flagged to
Carlos by `e4`, not decided here.** Carlos asked where a user gets back an
account they closed or soft-deleted; nothing in the frontend does this
today - no listing of closed accounts, no reopen action. `e4` is right that
it is not obviously this module's: it is CLOSE/SOFT's inverse, not a
deletion flow, and the read it needs (accounts whose `deleted_at` is set) is
the opposite of the filter the accounting dashboard already applies to its
own list.

**Recommendation, offered as input to Carlos's decision, not a claim on
either module's behalf:** split it the same way CLOSE's entry point already
splits today (`AccountingDashboard.tsx:520` navigates into this module's own
route) - the closed-accounts list is a dashboard-owned read, the reopen
action is a small screen inside `editionAndDeletion/` that the dashboard
navigates into. Registered with `e4` via the seam above once built.

**Agreed by `e4`, 2026-09-06, with two corrections to my own framing.**
`e4` checked the list half rather than accepting it on my say-so:
`getAccountController.js:38` already declares the exclusion as a module-local
fragment, `AND ua.deleted_at IS NULL`, interpolated at the sites that filter
closed accounts out - so the closed-accounts read is one inverted fragment
beside a filter `e4` already owns and maintains in one place, not a new
query shape. Split agreed: list is `e4`'s, reopen action and its endpoint
are mine.

**Correction one, on sequencing - a single decision with two orderings, not
two decisions, put to Carlos by `e4`, not settled here.** If the recovery
surface ships before D6's `deleted_at` -> `closed_at` rename, it ships a
screen whose entire purpose is reopening accounts while every query behind
it, `e4`'s list included, still says "deleted" where it means "closed." Ship
it after the rename and both halves are written once against the final
name. Argues for sequencing the recovery surface after unit 7's rename,
without either of us deciding it.

**Correction two, on what "structural inverse" actually covers - mine to
carry, not `e4`'s.** Reopening is the inverse of CLOSE's MARK step only
(clearing the same column CLOSE sets), not of its SETTLE step. CLOSE settles
the residual first, against the boundary account (DISCARD) or a destination
(TRANSFER, once D2 lands), then marks second; reopening restores the mark,
not the money, which by then sits wherever the settlement sent it. An
account closed with a residual and later reopened comes back empty, its
former balance elsewhere - whether that is the intended outcome, or whether
reopening needs its own reversal step, is an open product question this
module owns, not yet answered, and belongs beside D2/D4 rather than assumed
away by calling reopen a "structural inverse."

**Where the gate can actually be tested, 2026-09-06.** `feat/overview`'s
migration chain stops at `030` - it does not have `031` (the boundary
account type) at all, and that branch's seeder still lists account types
ending at cash/7. The tenth type unit 5 introduced does not exist on that
branch in either build path yet, so nothing about it - including this gate -
can be verified there; it has to be checked on `main` or after `cf` rebases.
`pern-fintrack-02` adds the matching caveat for `main`'s own parity tool:
`npm run db:parity` compares the migration chain against the boot path
against each other, not against a fixed reference, so a green result on
`feat/overview` would mean "chain and seeder agree with each other" (both
missing the boundary type), not "current." Every parity result cited in this
plan so far was run on `main`'s working tree - stated here since the doc
had not been naming the checkout.

### HARD/DELETE settlement gap, 2026-09-06/07

Read against `processStandardDelete`'s HARD branch
(`deleteAccountService.js:394-406`, line numbers confirmed independently):
the branch goes from the admin check straight to `eraseAccountTail` with no
lock, no balance check, and no settlement step. §3.2 (DELETE) requires
"settle the residual" before DETACH/SCRUB/DROP and states this step is not
optional - "unless those rows already sum to zero, the global ledger stops
closing." Today's HARD skips it unconditionally, so hard-deleting any
account with a nonzero derived balance corrupts the global ledger's closure
invariant today, in production - not a gap that only matters once CLOSE
ships, a live one.

**Recommendation: block it now, ship the fix inside unit 7.** Add a balance
check to the HARD branch - reuse `lockAndDeriveBalances` (already imported in
this file) to lock and derive the target's own balance, and if it is
nonzero, return 409 rather than calling `eraseAccountTail`, directing the
owner to RTA (which does reverse everything) until CLOSE/DELETE's
TRANSFER/DISCARD settlement exists. This is the same shape as the
already-shipped RESTRICT interim patch (`cbecbc9d`): a small, reversible
guard in front of an engine that is not built yet, not a redesign of HARD
itself. The alternative - waiting for unit 7 before guarding anything -
leaves the live corruption path open for as long as unit 7 takes, which is
the worse trade given the guard costs one query and one new error response
on a path that is not supposed to succeed silently anyway.

**IMPLEMENTED, 2026-09-06** (`deleteAccountService.js`, HARD branch, ahead of
the `eraseAccountTail` call): locks the target with the same
`lockAndDeriveBalances` RTA already uses, derives its balance, and returns
409 when it is nonzero instead of calling `eraseAccountTail`. Boot-tested
clean (`node src/app.js` starts with no import/reference errors). Uncommitted,
per the standing freeze. `pern-fintrack-02` reviewed the change and confirmed
it is ledger-shape only, nothing in its own files affected. Whether HARD
should also call `assessDeletionImpact` (to lock and report, without
applying) is unchanged and still open, deliberately not folded into this
guard.

**Provenance caveat, 2026-09-06 (`cf`).** The guard's read is only as good as
`opening_for_account_id` on the target database. That column is added AND
backfilled together by migration 022; a database that acquired it only from
the boot path's `createTables.js:204` declaration (a fresh build) has no
backfill problem, but one that acquired the column from an older boot path
and never ran 022 would carry it NULL on every pre-existing row - and NULL
makes derivedBalance.js's exclusion never fire, so every account-opening
credit double-counts on top of the starting amount. On such a database this
guard would refuse a hard delete of an account that genuinely holds zero,
with no visible reason. **Present-and-all-NULL is worse than absent**: it
reads as the fixed schema and behaves as the broken one. `fintrack_dev` has
it populated, so the guard is correct there today; this stays a caveat, not
a fix, until a database of unknown provenance is actually the target -
recorded here so it isn't rediscovered the hard way. The same dependency
applies to unit 7's settlement writer below, for the same reason.

**Refined, 2026-09-06 (`backdating`).** `schemaParity`'s constraint check
reads `pg_constraint` only, which misses a unique index not owned by a
constraint - Postgres has no way to express a partial/expression uniqueness
as one. Measured on `fintrack_dev`: 44 unique indexes total, 3 invisible to
that tool, one of them `uq_transaction_opening_for_account`
(`022_add_transaction_opening_for_account.sql:110-112`, unique on
`opening_for_account_id` where not null) - created by the chain, never by
the boot path (`createTables.js:204` declares the column and stops). A
boot-built database therefore does not enforce "an account is opened once,"
the exact failure 022 exists to prevent. **This sharpens rather than
replaces the caveat above: if unit 7 ever grows a precondition against an
unfamiliar database, checking that the column exists is not enough and
checking that it is merely non-NULL is not enough either - the two things
that actually matter are the values on the account-opening rows (not NULL,
per the caveat above) and whether the unique index exists at all** (its
absence being the more likely first-order problem: a second opening row
silently corrupts a balance forever, before any NULL-derived double-count
even enters the picture). No known target database needs this check today -
recorded for whoever eventually builds one, same as the caveat above.

**Verified clean, 2026-09-06 - the generalizable NULL-unsafety shape
`pern-fintrack-cf` raised does not recur in deletion's own files.** Overview
found the account-opening exclusion is safe written as `CASE WHEN
movement_type_id = 8 AND account_id = opening_for_account_id THEN 0 ELSE
amount END` (a NULL `WHEN` falls to `ELSE`, keeping the row) and unsafe
written as `NOT (...)` in a `WHERE` (NULL inverts to a silent drop) - the
same mechanism behind this module's own NULL-unsafe predicate below. Checked
every file under `services/delete_account/` for `NOT (` and `!=`/`<>`
against a nullable column: the only match is the already-tracked
`getAnnulmentImpactReport.js:55` predicate below, nothing new.
`derivedBalance.js` - which `lockAndDeriveBalances` calls, and which this
guard now depends on - writes the exclusion in the safe `CASE` form three
times (:153-155, :211-213, :236-238), confirmed by reading the file. The
balance this guard checks is not exposed to the unsafe shape.

### Open defects carried forward from the research log

Four items the log raised were never carried into this plan. Two are fixed,
two are still open on `main` today:

- **FIXED, 2026-09-06.** The admin gate for hard delete and RTA accepted
  every role: `deleteAccountService.js:504` read `userRole === 'admin' ||
  userRole === 'super_admin' || userRole === 'user'` - the `|| userRole ===
  'user'` clause satisfied `isAdmin` for any authenticated caller, so the 403
  checks that follow it never fired. A leftover test override, not a design
  gap - removed.
- **FIXED, 2026-09-06.** `checkAndInsertAccount.js` called
  `handlePostgresError` around line 100 but only imported `createError` -
  a real Postgres error on this path threw `ReferenceError:
  handlePostgresError is not defined` instead of surfacing. Import added.
- **`movement_types`'s CHECK constraint has two different shapes** - none in
  the migration chain, nine enumerated values in the runtime initializer.
  Adding `account-closure` or a new `boundary` account type (unit 5) needs a
  drop-and-recreate written for both shapes, not a seed insert.
- **`getAnnulmentImpactReport.js` has three defects:** it queries on `pool`,
  outside any transaction, so it cannot structurally join the deletion
  transaction it is meant to inform; its `destination_account_id !=
  source_account_id` predicate is NULL-unsafe, so a NULLed counterparty
  drops that row from the report silently instead of surfacing it; and it
  applies no `deleted_at` filter. **The first of the three is fixed, unit 6
  above:** the function now takes the transaction's own `dbClient` and is
  called after the target account is locked, so the report can no longer be
  computed outside the transaction it informs. The other two — the
  NULL-unsafe predicate and the missing `deleted_at` filter — are still
  open.

The `movement_types` dual-shape hazard and `getAnnulmentImpactReport.js`'s
remaining two defects are still open - tracked here so the log can stay
archived without losing them.

---

## 10. Out of scope

The self-referencing opening balance, where an account's opening writes its
own id into both transfer columns (`accountCreationController.js:357-383`,
`movement_type_id = 8`), is a separate question, adjacent to this block and
not part of it. Three shapes were weighed: both columns `NULL` (cheapest -
the "every transfer that touched this account" query stops returning a row
that was never a transfer); a system opening-equity account (textbook
double-entry, but a second technical account distorting aggregates the same
way `slack` already does); or keeping the self-reference as today (every
consumer branches on `movement_type_id` before reading the two columns,
forever). **Recommendation: both columns `NULL`.** One migration and one
line in the creation controller, no second technical account.

Account name collisions — two `investment` accounts named `InVestMent` and
`INBESTMEN` were observed while measuring — belong to
`PLAN_ACCOUNT_NAME_UNIQUENESS.md`.

No frontend work is specified here beyond the three screens implied by §3.
The component-by-component sequence is written when unit 7 opens.

---

## 11. Where the evidence is

`PLAN_ACCOUNT_DELETION/RESEARCH_LOG.md`, 4,186 lines, marked historical
2026-09-06 (§9). Kept as the archive behind this plan's measurements and
architecture decisions — not a document that needs reading for current
state.

---

## Destination eligibility decided, 2026-09-07

Closes the open decision on which accounts may receive a residual under
CLOSE's TRANSFER policy (unit 9, D2). Decided by Carlos; this section is the
frozen rule and the selector implements it rather than re-deciding it.

**The rule.** A destination is eligible when all four hold: it belongs to the
same owner, it is not deleted, it is not the account being closed, and its
type is `bank`.

**Why one type and not a set.** The research log's draft said "able to hold
funds", which is not a property the schema carries — there is no column that
states it, so it cannot be written as a predicate and every reader resolves it
differently. Replacing the phrase with an explicit type was `e4`'s
recommendation and is right for that reason. `e4` proposed three types — bank,
investment and cash. Carlos narrowed it to `bank` alone, in his words the
account "que el usuario puede mover mas facilmente": the destination is where
the owner will actually reach the money afterwards, and a bank account is the
one they can move without a further operation. Investment and cash are not
excluded on principle; they are simply not the answer to "where does the owner
want this to land", and a narrower rule is the one that can be widened later
without invalidating rows already written.

**What the other types would have meant**, kept because each exclusion is a
stated reason rather than an omission:

- `debtor` represents a person who owes the owner, so a residual sent there
  fabricates a loan that was never made.
- `income_source` would fabricate income the owner never earned.
- `category_budget` is an expense envelope, so it would fabricate spending
  capacity.
- `pocket_saving` belongs to the model migration 020 retired, and under the
  allocation model a pocket holds assignments rather than funds — the same
  conclusion the research log already reached, with the second reason added.
- `boundary` is the DISCARD policy itself; see below.

**Withdrawal from the system is not a destination.** Carlos raised sending the
residual to the boundary account when the intent is to take the money out of
the books. That intent is correct and it is already built, but it is the other
policy: DISCARD settles the residual against the boundary account, and the
money leaves the owner's net worth because every published figure excludes
that account. Offering the boundary account as a row in the destination list
would give the owner two routes to the same write under two different names,
one of them labelled with an internal account name that means nothing to them.
So the owner chooses the policy first — send it to another account, or take it
out of the books — and only the first choice asks for a destination.

**Frontend requirement this creates.** The close screen presents the two
policies as a choice, and the destination selector appears only under
TRANSFER, listing the owner's non-deleted bank accounts excluding the account
being closed. DISCARD needs no selector and must state where the residual goes
rather than leaving it unexplained.

**Currency, decided 2026-09-07.** A fifth condition: the destination's stored
currency must equal the closing account's stored currency. Not "must be the
accounting currency" — that phrasing is true today and becomes the wrong test
the moment an account can be stored in anything else, which is the exact
failure mode this round was spent on.

The predicate is a no-op today and nothing can violate it. Every user-facing
creation path stores the accounting currency and never the currency the
request sent: both paths in `accountCreationController.js` pass the resolved
accounting currency id to the shared insert helper, the category-budget
controller does the same, and as of 2026-09-07 both compensation-account
inserts do too. The request's currency converts the amount and is kept as FX
provenance only. Measured by `e4` and verified here against the controller
rather than restated.

It is written anyway because "all eligible accounts" and "all same-currency
accounts" are the same set **by construction, not by constraint** — nothing in
the schema or the code enforces it. The day accounts can hold different
currencies, a selector without this predicate silently starts offering
destinations that reproduce the account/row disagreement the compensation
insert fix just closed, and the settlement writer would tag both legs with the
closing account's currency regardless. A predicate that costs nothing now and
is load-bearing later cannot be added retroactively to rows already settled.

## The DISCARD settlement verified against a database, 2026-09-07

The settlement writer has been run against `fintrack_dev` through the
verification script `backend/scripts/verifyClosureSettlement.js`, which opens a
transaction, calls the real writer rather than a hand-built row, measures the
Investment card's figures before and after, and rolls back. Eighteen
assertions, both directions of the residual, all passing, and the closure row
count identical before and after.

**What the run establishes.** Closing an investment account holding +1234.56:
the closure-adjustment term moves by exactly −1234.56, the realised term does
not move, the ledger balance moves by the same amount, the card's identity
closes, and the two terms remain exhaustive against the unfiltered sum over
both movement types. Reversed with a residual of −500, every figure moves the
other way by 500 and the pair's source and destination swap with it.

**The result that a single hand-built row could not have produced.** The writer
emits a pair, and only one leg of it is inside the account set the card
publishes: the target leg lands on the closing account, the counterpart on the
boundary account, which every overview set excludes. That is why the term moves
by the negation of the residual and not by zero. The zero case is its own
failing assertion in the script rather than an inference from the first, so a
boundary exclusion that stopped working would fail loudly instead of leaving a
figure that merely looks stable.

**What it does not establish.** Every assertion is on the movement of a figure
and never on its value. The closure term reads non-zero on any database with
deletion history, because it is defined as what account deletions moved on
these accounts and admits both the settlement rows and the pre-existing
profit-and-loss rows carrying the annulment prefix — closures recorded before
the closure movement type existed, which do not migrate. A passing run says the
term claims a settlement correctly, not that a settlement is separable from the
deletion history already in it. `cf` verified the other half on live data: the
identity holds across two months without any closure row present.

**The catalog agreement is checked before the write, not after.** The script
refuses to run when the movement and transaction type ids the writer stamps
disagree with the ids the catalog assigned. A settlement written under that
disagreement is misfiled rather than wrong-valued: every figure still adds up
and the rows sit in the wrong population with nothing to say so.

**FX provenance is asserted on all six columns, not on the two that were
false.** Four of the six defaults happen to be correct for an internal
movement, so a row left to the defaults presents as well formed and invites no
second look — which is what makes it worse to audit than a row that is wrong
throughout.

### The settlement's currency, recorded 2026-09-07

**Both legs take `currency_id` from the closing account, and neither reads the
compensation account's own.** This is deliberate — a settlement is one movement
and its two legs are the same amount in the same unit — but it means that if
the boundary account were ever stored in a different currency, its leg would
carry a currency that disagrees with the account it sits on, with no error
possible anywhere: no constraint compares the two, and the boundary account is
excluded from every published figure, so the disagreement would never surface
in a number anyone reads.

Not a live defect. `02` measured the deployment: all 31 accounts sit on
currency 1, the boundary account included, and every transaction row carries
FX target currency 1, so the historic backfill is consistent here too. Both
close as no correction needed.

It is recorded because the property that makes it silent is permanent. The
account whose row would carry the disagreement is the one account excluded from
everything, so the usual way a wrong figure gets noticed does not apply. The
script asserts the rule explicitly for that reason, so a database where the two
diverge makes it visible at the point of the write rather than never.

## The CLOSE engine verified end to end, and the gate cleared, 2026-09-07

The settlement writer being correct in isolation said nothing about the path
around it, which is most of what CLOSE does: locking the target and the
boundary account together, deriving the residual from the locked state rather
than from the stored column, settling only when there is something to settle,
re-deriving afterwards to prove the account reached zero, rewriting both stored
balances from the ledger, and marking the account closed while leaving its row
and its transactions in place. A writer that is right cannot rule out a path
that computes the wrong residual, marks the wrong account, or reports success
after skipping a step.

`backend/scripts/verifyCloseAccount.js` covers that path on `fintrack_dev`,
inside a transaction it always rolls back. Nineteen assertions, all passing.
The engine is imported directly because the only other way in opens its own
connection and commits, so nothing could check what CLOSE writes without really
closing an account.

**Both branches of the engine, not only the one that writes.** Closing an
account holding 1.39: the residual it reports settling equals the one derived
independently, the account re-derives to zero, its row survives with
`deleted_at` set, its transactions survive plus the settlement leg, the stored
balance is rewritten from the ledger rather than left stale, and the boundary
account's stored balance agrees with its own ledger. Closing an account already
at zero: marked closed with **no settlement row written at all**, because a
zero-amount pair would carry no financial meaning and would still appear in the
closure term as a row.

**Both refusals.** TRANSFER answers 400 while its destination rule has no
selector, and closing an already-closed account answers 400. Each was run
inside a savepoint, so a refusal cannot leave the transaction unusable for the
checks after it.

**The published figures.** The closure term moves by the negation of the
residual, the realised term does not move, the identity closes, and the card's
balance falls by the residual rather than staying put — which is the assertion
that proves the boundary counterpart stayed outside the published set.

**Rollback verified**: closure rows and account count both identical
afterwards, and the account the probe closed is open again.

### The gate is cleared

`CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED` now reads true. Its condition was that
no closure row be written until the Investment card's reconciliation accounted
for that movement type on **both** branches, and both were checked rather than
assumed: `main` sums the closure movement type together with the historic
annulment-prefixed rows, `feat/overview` sums the movement type. The comment
that claimed main had no such term at all was true when written and stopped
being true when the Investment card shipped one; it is corrected in the same
edit, and it now records what the measurement covered so a later reader knows
what it does not.

`processCloseAccount` is exported for the same reason. It takes a caller's
client rather than opening one, which is what makes a rolled-back verification
possible at all.

### What still stands between this and CLOSE reaching a user

- TRANSFER answers 400 for want of a destination selector. The rule is frozen
  above, so the selector implements it rather than re-deciding it.
- No frontend component triggers CLOSE: the close deletion type appears in the
  type definitions and in no button. Until one exists, the open gate changes
  nothing a user can reach — it makes the path exercisable rather than
  reachable.
