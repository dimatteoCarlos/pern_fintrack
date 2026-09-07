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

  5  the seventh account_type (`boundary`) and the account-closure
     movement type
     IN PROGRESS - see "Unit 5 scoping" below. Makes the `slack` boundary
     convention structural instead of a name match.

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
     OPEN. Which accounts may receive a residual: types, currency, closed
     state.

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

 D5  whether `description` stops embedding the counterparty going forward.
     If it does, the scrub of §8 shrinks to a one-time backfill.

 D6  whether `deleted_at` is renamed to `closed_at`, at unit 7.
     Recommended yes (§3.1). Until it is, the name means CLOSED, not
     deleted, and nothing in the code may read it as deletion.
```

### Unit 5 scoping, 2026-09-06

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

**Open, blocking the migration:** the backfill scope for existing `'slack'`
accounts - insert `boundary` rows for them in the same migration, or leave
existing accounts as `'bank'` and backfill later. Needs further explanation
from the developer plus a check with the migration chain owner; not decided
here.

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
