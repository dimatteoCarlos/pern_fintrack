# PLAN — ACCOUNT DELETION

**Opened 2026-08-22. Amended 2026-08-23: hard delete is the design.**

The deletion method is settled — **hard delete only**, honouring the right of
the owner to have their data removed. What is not settled is how to execute it
without breaking the ledger, which is what §5 specifies and §6 leaves open.

The rule this whole block serves: a deletion removes the rows of the deleted
account and **nothing else**, and the two accounting identities of §2.2 hold
before and after it. Today neither holds — the database cascade destroys rows
belonging to other accounts (§1.1) and the correction is written as a balance
update with no transaction behind it (§2.2).

---

## 1. What the code does today — measured

`deleteAccountService.js` declares four deletion methods and implements two.

| method | what it executes | where |
|---|---|---|
| `DELETION_TYPE_SOFT` | `UPDATE user_accounts SET deleted_at = CURRENT_TIMESTAMP` | `deleteAccountService.js:395` |
| `DELETION_TYPE_HARD` | `DELETE FROM user_accounts` | `deleteAccountService.js:384` |
| `DELETION_TYPE_RTA` | writes annulment entries against a `slack` account, adjusts every affected account's balance, then executes `DELETE FROM user_accounts` | `deleteAccountService.js:185-362` |
| — | the file's own header says *only implemented DELETION_TYPE_RTA* | `deleteAccountService.js:9` |

*Anchors re-measured 2026-08-30; the file is 747 lines and the four claims still
hold at the new lines.*

### 1.1 The cascade

`transactions` points at `user_accounts` three times, and all three are
`ON DELETE CASCADE`:

```
 003_transactions.sql:38-41   account_id             ON DELETE CASCADE
 003_transactions.sql:46-48   source_account_id      ON DELETE CASCADE
 003_transactions.sql:49-51   destination_account_id ON DELETE CASCADE
```

> **Measurement corrected 2026-08-30.** All three are `ON DELETE RESTRICT` today,
> at `003_transactions.sql:39-41`, `:48-50` and `:51-53`, and identically at
> `run_time_db_init/createTables.js:163`, `:169` and `:170`. The `ALTER` that
> reached the populated database is
> `sql_migrations/018_alter_transactions_account_fks_to_restrict.sql`, committed in
> `699827b`, with `7f96a43` carrying the two build paths and the alignment file.
> The paragraphs below are kept unchanged: they describe the mechanism that was
> live when every deletion recorded in this log was executed.

The first is bad enough: physically deleting an account destroys its history.
The other two are worse, and they are the reason this block exists.
`source_account_id` and `destination_account_id` are how a **transfer** names its
counterparty. Deleting account A therefore also deletes every transaction that
merely *mentions* A — including the leg that belongs to account B.

The consequence, stated exactly: **B's balance was really moved by that transfer,
B's balance keeps the movement, and B's history loses the row that explains it.**
B stops reconciling against the sum of its own transactions, and nothing on
screen says why. No amount of care in the service layer prevents this; the
database performs it.

## 2. Evidence in the production copy — `fintrack_rehearsal`, 2026-08-22

| datum | value | reading |
|---|---|---|
| Accounts present | 100 | — |
| Highest `account_id` | 159 | at least 59 ids are no longer in the table |
| Accounts with `deleted_at IS NOT NULL` | **0** | the soft path has never been used |
| Transactions present | 785, ids 162–964 | 161 ids below the minimum, 18 gaps inside the range |
| Transactions with a dangling `source_account_id` | 0 | not because they were preserved — because the cascade took them |
| Transactions touching `slack` (id 45) | 30, of which 20 are `movement_type_id = 9` (`pnl`) | the annulment path is in real use |
| `slack` balance | **−30,522.60** | — |
| `slack.account_type_id` | **1 — `bank`** | — |

**Caveat, stated so it is not overread:** a `SERIAL` leaves gaps on any
rolled-back insert, so the missing ids are *consistent with* physical deletion,
not proof of it. What is proven is that zero accounts were ever soft-deleted
while the only implemented path ends in `DELETE`.

### 2.1 The `slack` account distorts every bank figure

`slack` is a technical counter-account that absorbs annulment residue, and it is
typed as a **bank**. In the database its −30,522.60 is bank money: the whole bank
total in the copy is −30,244.02, so **the technical account is the entire
figure**, and the two real banks (`CDM_NU` 278.57, `CASH` 0.01) are noise beside
it.

> **Corrected 2026-08-26 by measurement.** This section claimed every aggregate
> reads that figure. It does not: `dashboardController.js` excludes the account
> in **seventeen** places, each one a bound `ua.account_name != $n` with the
> literal passed in `values` (`:54`, `:178`, `:194`, `:210`, `:229`, `:360`,
> `:376`, `:395`, `:584`, `:641`, `:707`, `:731`, `:777`, `:813`, `:952`,
> `:1076`, and the search branch at `:970`), plus six more outside it (§12.3).
> The screen is therefore right today.
>
> **Anchors re-measured 2026-08-30.** Sixteen, not seventeen — one of the
> seventeen is now commented out at `dashboardController.js:691`. The live ones
> are `:64`, `:187`, `:203`, `:219`, `:238`, `:371`, `:386`, `:405`, `:604`,
> `:661`, `:717`, `:753`, `:792`, `:826`, `:1093`, and the search branch at
> `:976`. Outside the file the literal now appears 25 times, not six (§12.3), so
> the total is 41 rather than 23. The exclusion is still remembered rather than
> structural, which is the point this note makes.
>
> The defect is not that the figure leaks — it is that **the exclusion is
> remembered twenty-three times instead of being structural**, exactly what `P6`
> forbids. One aggregate written without the filter re-admits it silently, and
> nothing in the schema would object. That is the argument for the system
> account type of §12.9, and the twenty-three filters are what it deletes.

### 2.2 The ledger is closed; the balances have drifted from it — measured 2026-08-23

| identity | measured | verdict |
|---|---|---|
| `SUM(transactions.amount)` over the whole table | **0.00** | the ledger is rigorously double-entry |
| the same sum, per `movement_type_id` | **0.00 for all six** — expense, income, pocket, transfer, account-opening, pnl | every movement type is internally paired |
| withdrawals / deposits | −17,382.75 / +17,382.75 | paired to the cent |
| `SUM(user_accounts.account_starting_amount)` | 0.00, and no account has a non-zero one | every peso entered through a transaction |
| `SUM(user_accounts.account_balance)` | **−30,493.21** | **must be 0.00. It is not** |

So the two identities that govern this system are exact and stateable:

```
 SUM(transactions.amount)   = 0
 SUM(user_accounts.balance) = SUM(transactions.amount) = 0
```

The first holds. The second is off by −30,493.21, and only three accounts
mismatch their own rows: `slack` by −30,477.90, `CDM_NU` by −15.30, and one
budget account by −0.01. `slack` carries a balance of −30,522.60 while its own
transactions sum to −44.70.

**That difference was written straight into the balance column with no
transaction behind it** — `updateAffectedAccountBalance`, called from the RTA
path. This is the second half of the defect: the cascade destroys the
counterparty rows (§1.1), and the balance adjustment bypasses the ledger.
Neither can be reconciled afterwards, because neither left a record.

## 3. Why this is a defect, in three sentences

- A balance that cannot be re-derived from its own transactions is not
 auditable, and auditability is the only reason to keep a ledger at all.
- Deleting A's row silently rewrites B's history, so the damage is invisible
 from the screen where it was caused.
- The residue is parked in an account typed as a bank, so the correction
 propagates into every figure that sums banks.

## 4. Hard delete is the design. What it must preserve

**Decided by the developer 2026-08-23: hard delete only.** No soft delete, no
logical deletion, no archive flag. The right of the owner to have their data
removed is honoured literally — the rows go.

That decision is available to FinTrack in a way it is not available to a
regulated institution, and the reason is worth stating: statutory retention
binds a *custodian of other people money*. FinTrack is the record the owner
keeps of their own money. Erasure wins.

What erasure does **not** license is breaking the ledger. The two identities of
§2.2 must hold after the deletion exactly as they held before it. Everything
below follows from that single requirement.

The mechanism professional systems use for precisely this case has a name: a
**suspense** or **clearing** account — an internal counterparty that absorbs a
leg whose real counterpart is gone or unknown, so the books still balance. That
is what `slack` already is: money enters the system through openings, leaves
through pnl, and `slack` is the internal counterparty. **The architecture is
right.** What is wrong is that the current implementation writes to it by
adjusting a balance instead of by recording a transaction, and lets the database
destroy the surviving side.

## 5. How the hard delete must work

### 5.1 The distinction that removes the propagation problem

Every transaction **belongs to exactly one account**: the one in `account_id`.
`source_account_id` and `destination_account_id` do not express ownership; they
name the counterparty of a transfer.

Deleting account A therefore touches two disjoint sets:

- rows **belonging** to A — `account_id = A`. These are deleted.
- rows **mentioning** A — `source_account_id = A` or `destination_account_id = A`
 with `account_id <> A`. These belong to somebody else. They are **never
 deleted**; their pointer is moved.

**Propagation is not a property of the data, it is a property of the cascade.**
It happens only when *mentions A* is treated as *belongs to A*, which is exactly
what the three `ON DELETE CASCADE` clauses do. Remove them and the depth of a
deletion is always one account, regardless of how many transfers that account
took part in.

This answers the income-account case directly. Delete an income source and its
own legs go; the bank legs it paid into survive, with their counterparty
re-pointed. Nothing propagates to a third account, because no third account owns
any of the rows involved.

### 5.2 The procedure, in one database transaction

Let `A` be the account being deleted and `X` its balance at that moment.

| # | step | why |
|---|---|---|
| 1 | Re-point every row where `source_account_id = A` or `destination_account_id = A` **and** `account_id <> A` to the internal counterparty account | the surviving owner keeps its row, its amount and a valid counterparty. Its reconciliation is untouched |
| 2 | Scrub the name and id of A from the `description` of those rows | see §5.4 — this is where the erasure actually leaks |
| 3 | Delete every row where `account_id = A` | this is the erasure |
| 4 | Record **one** transaction against the internal counterparty account for `+X` | step 3 removed rows summing to `X`, so the ledger identity is broken by exactly `X`. This row restores it. It is a transaction, never a balance write |
| 5 | `DELETE FROM user_accounts WHERE account_id = A` | — |
| 6 | Re-assert both identities of §2.2 before committing | if either fails, roll back. The deletion is refused, never half-applied |

After step 4 the arithmetic closes on both sides: the ledger sums to zero again
because `+X` replaced the deleted rows, and the sum of balances is unchanged
because the `X` of A left and the `X` of the counterparty account arrived.

`X` is the whole correction, no matter how many legs step 1 re-pointed — the
re-pointing moves a pointer, not an amount, and `account_balance` is driven by
`account_id` alone.

### 5.3 The schema change that makes step 1 unskippable

> **Shipped 2026-08-27, recorded 2026-08-30.** This subsection asks for work that
> is done. The three foreign keys are `RESTRICT` at `003_transactions.sql:39-41`,
> `:48-50` and `:51-53`, at `createTables.js:163`, `:169` and `:170`, and in the
> database itself through migration
> `018_alter_transactions_account_fks_to_restrict.sql` (`699827b`; the two build
> paths and the alignment file came in `7f96a43`). The reasoning below stands as
> the argument that produced it.

Move the three `transactions` foreign keys from `ON DELETE CASCADE` to
`ON DELETE RESTRICT` (`003_transactions.sql:38-51`). The database then refuses
to delete an account while any transaction still references it, so steps 1 and 3
cannot be forgotten or reordered. Reversible: the DOWN restores `CASCADE`.

Without this change §5.2 is a convention that one future `DELETE` can bypass.
With it, the destructive path does not exist.

### 5.4 Where the erasure actually leaks

`transactions.description` is free text written at transaction time, and it
embeds the name and id of the counterparty verbatim. Measured, transaction 264:

```
 Saving from loc ch income ene-abr 2026 ... Transfered 90 usd from CASH #109
 (bank) credited to cash_loc_chinita #108 (pocket_saving)
```

Delete `CASH` and its name survives in the row of the other account forever.
Step 2 of §5.2 exists for this, but the durable fix is that the description
should stop embedding the counterparty at all and be rendered at read time from
the foreign key — a separate change, not scoped here.

### 5.5 What is lost, stated rather than hidden

Deleting an income source removes its own legs, so every report attributing past
income to that source loses the attribution. The money is still in the account
that received it, and that history still shows it arriving — from an internal
account. This is inherent to hard delete and is the price of the decision, not a
defect to be engineered away.

### 5.6 The one case that still refuses

An account with a non-zero net pocket allocation (`POCKET_DECISIONS.md` §14.6,
`QP-19`). Releasing it is an act of the owner that must leave its own row, so
the deletion cannot perform it silently. The refusal names the pockets to
release first.

## 6. Open decisions

| # | decision | note |
|---|---|---|
| AD-1 **closed 13.3** | Does the internal counterparty account stop being typed as a bank, and what type replaces it | it currently owns the entire bank total (§2.1). Every consumer that groups by account type has to be re-read. **Blocks Overview**, whose hero reads that total |
| AD-2 | How the −30,477.90 already sitting in `slack` with no transaction behind it is corrected | it was written against accounts that no longer exist. Options: one adjusting transaction that makes the ledger and the balance agree, or freezing it and dating the discrepancy. Reversing it row by row is not possible — the rows are gone |
| AD-3 **closed 13.4** | Does `DELETION_TYPE_RTA` survive | §5.2 replaces it. Its two errors are the direct balance write and the cascade; its idea — an internal counterparty absorbing the residue — is kept |
| AD-4 **closed 13.3** | Which `movement_type_id` the closing entry of §5.2 step 4 carries | reuse `9` (`pnl`), or a new type that says *account closure*. A new type makes every past deletion legible; reusing `pnl` mixes it with real profit and loss |
| AD-5 **closed 13.6** | Is the description scrubbed per deletion (§5.2 step 2), or does the description stop embedding the counterparty altogether | the second is the durable fix and a larger change. The first is required either way for rows already written |
| AD-6 | Erasure of one account versus erasure of the user | deleting the user is already a clean `ON DELETE CASCADE` from `users` and satisfies a real erasure request. Deleting one account is a product operation with the opposite requirement — everything *else* must survive. The two must not share a code path |
| AD-8 **closed 13.1** | Does the deletion flow allow splitting the balance between a transfer and a discard | recommended **no**: the whole ledger position moves, and a partial relocation is an ordinary transfer done beforehand |
| AD-9 | Destination eligibility for the relocation branch | same owner, not deleted, not the account being deleted, able to hold funds. Under the pocket allocation model a pocket holds assignments, not funds, so it is not eligible |
| AD-7 **closed 13.8** | Does the deletion refuse when re-asserting the identities fails (§5.2 step 6), or repair and continue | refusing is safe and leaves the owner stuck; repairing hides the reason the identity broke |

## 7. What this block does not touch

The account **creation** path, the edit path, and the pocket allocation model.
`QP-19` and `QP-20` of `POCKET_DECISIONS.md` §14.6 depend on the rule chosen in §5
but do not change it: they add one more state that refuses closure.

## 8. Related, opened the same day — the self-referencing opening balance

`accountCreationController.js:357-383` writes the opening balance with
`source_account_id = destination_account_id = the new account's own id` and
`movement_type_id = 8` (`account-opening`). Measured in production as
transaction 259 for pocket 108. It is a separate question from deletion and is
argued in §9 rather than in this block's decisions.

## 9. The opening balance pointing at itself

**The problem.** `source` and `destination` exist to name the two ends of a
transfer. An opening balance has no two ends: money enters the system from
outside it. Writing the account's own id into both columns makes a row that
claims the account transferred to itself, which is false, and it makes the pair
of columns mean two different things depending on `movement_type_id` — a reader
cannot interpret them without first branching on the movement type.

It also breaks the query that ought to be trivial. *Every transfer that touched
account 108* is `source_account_id = 108 OR destination_account_id = 108`, and it
returns the opening balance, which is not a transfer.

**How professional systems write it.** An opening balance is the ledger's
*equity* side: the counterpart of the first entry is not another account of the
owner's, it is an opening-equity account the system owns. Double-entry survives,
and the row is honest about where the money came from — outside.

Three options:

| option | shape | consequence |
|---|---|---|
| **Both columns NULL** | `source_account_id = NULL`, `destination_account_id = NULL`, `account_id` carries the account, `movement_type_id = 8` says what it is | the two columns keep one meaning: *this row is a transfer between these two accounts*. NULL correctly says *no counterparty*. Cheapest, and the transfer query stops lying |
| **A system opening-equity account** | one hidden account per user; the opening balance is a real transfer from it | textbook double-entry, and the sum of all accounts stays zero. Costs a new account type, a hidden account, and a rule keeping it out of every aggregate — the same mistake `slack` is currently making |
| **Keep the self-reference** | as today | every consumer must branch on `movement_type_id` before reading the two columns, forever |

**Recommendation: both columns NULL.** It removes a false statement from the data
at the cost of one migration and one line in the creation controller, and it does
not introduce a second technical account when the first one is already distorting
the bank total (§2.1).

**Blast radius, to be measured before anything is written:** every query
filtering on `source_account_id` or `destination_account_id`, and the migration
that nulls the existing `movement_type_id = 8` rows. Not measured yet.

---

## 10. Where the −30,493.21 comes from — traced 2026-08-23

Nothing is adjusted before the origin is known. It is now known, and it splits
cleanly in two halves of the same size.

### 10.1 The twenty rows of the internal account

`slack` holds 20 transactions, all `movement_type_id = 9`. Five of them are
paired *Correction / Counterpart Adjustment* entries in which **both legs were
written against `slack` itself**:

| target deleted | amount written twice, opposite signs |
|---|---|
| GGZelle | 12,475.00 |
| cdmBin | 1,341.00 |
| GGBin | 1,162.95 |
| cdmBDV | 170.00 |
| CashHome | 90.00 |
| **sum** | **15,238.95** |

Each pair sums to zero. The remaining fifteen rows sum −44.70, which is the sum
of every row `slack` owns.

### 10.2 The arithmetic that identifies the mechanism

| quantity | value |
|---|---|
| `slack.account_balance` | −30,522.60 |
| sum of the rows `slack` owns | −44.70 |
| **mismatch** | **−30,477.90** |
| sum of the five paired adjustments | 15,238.95 |
| **twice that sum** | **30,477.90** |

The mismatch is **exactly twice** the sum of the five adjustments. And the first
row `slack` ever received, transaction 209, already reports an after-balance of
−15,242.62 following a movement of −3.67 — so **−15,238.95 was already in the
column before a single transaction existed to justify it**.

The two halves are therefore:

- **15,238.95 with no transaction at all behind it**, predating the first row.
- **15,238.95 more**, whose rows exist but cancel to zero, while the balance
 moved anyway.

The same five adjustments reached the balance twice: once as a naked write, once
as a pair of rows that annul each other. That is the whole discrepancy.

### 10.3 The cause in the code

`processRTAAnnulment` never derives a balance from the ledger. It computes
absolute values in JavaScript and writes them with
`updateAffectedAccountBalance`, which executes a bare
`UPDATE user_accounts SET account_balance = $1`:

- `newAffectedBalance = row.affectedAccountCurrentBalance + row.affectedAccountNetAdjustmentAmount` — `deleteAccountService.js:212-215`
- `finalSlackBalance = slackAccount.account_balance - totalAffectedAccountAdjustement` — `deleteAccountService.js:227-228`

Both inputs come from **`impactReport`, supplied by the frontend** — the route
rejects the call without it (`messages.noImpactReport`). The server never
recomputes what it is told. Two consequences:

- the balance is a **client-asserted absolute**, not a server-derived
 consequence of a movement;
- `slack` is written twice in the same run — once inside the per-account loop
 (`:245-250`) and once after it (`:285-289`) — and the second write is computed
 from a `slackAccount.account_balance` captured before the loop, so it discards
 whatever the first wrote.

> **Measurement corrected 2026-08-30. Half of this is no longer true, and the
> anchors all moved.**
>
> **The current balance is now derived, not client-asserted.**
> `deleteAccountService.js:239-241` reads
> `ledgerBalanceOf(row.affectedAccountId) + row.affectedAccountNetAdjustmentAmount`,
> where `ledgerBalanceOf` (`:222-223`) reads the locked ledger balances, and
> `finalSlackBalance` at `:253-254` derives the same way, from `:225`. The
> file's own comment at `:236-238` states the rule. **What still arrives from the
> browser is `affectedAccountNetAdjustmentAmount`**, so the adjustment is
> client-supplied even though the base it is applied to is not.
>
> **The double write is intact.** `slack` is still written once inside the loop —
> `updateAffectedAccountBalance` at `:273-277` — and once after it at `:311-315`,
> from the pre-loop figure. The second still discards the first.
>
> The trace of §10.2 is a measurement of data written under the old code and is
> unaffected.

`account_balance_after_tr` shows the same disease: row 214 records −27,717.62
where the preceding row and its own amount imply −15,242.62. The column is
written from the same JavaScript values instead of being derived.

### 10.4 A second, smaller defect in the same rows

Transactions 620 and 623 are a reversal pair of −5.77 and +5.76. **One cent is
lost to rounding** on an FX round trip. It is 0.01 of the −30,493.21 and it is
the third mismatched account. Different cause, same class: an amount computed
rather than derived.

### 10.5 The repair this implies, and the proof it is right

The drift is **not missing money**. It is a balance column that was never backed
by the ledger. Writing an adjusting transaction would give a ledger origin to a
number that has none — it would legitimise the error instead of removing it.

The honest repair is the opposite: **set every account balance to the sum of the
rows that account owns.** Three accounts change:

| account | balance today | sum of its rows | correction |
|---|---|---|---|
| `slack` | −30,522.60 | −44.70 | +30,477.90 |
| `CDM_NU` | 278.57 | 293.87 | +15.30 |
| a budget account | 25.11 | 25.12 | +0.01 |

```
 −30,493.21 + 30,477.90 + 15.30 + 0.01 = 0.00
```

The total lands **exactly** on zero, which is what `SUM(transactions.amount)`
already is. Three independent corrections converging on the exact identity is
the confirmation that the ledger is intact and only the derived column drifted.

### 10.6 Pros and cons of the current scheme

| | |
|---|---|
| **Pro** | Reads are cheap — one column, no aggregation, no join |
| **Pro** | `account_balance_after_tr` gives a running balance per row when it is correct |
| **Con** | The balance has **two writers** — the transaction path and the deletion path — and no arbiter between them |
| **Con** | It is written as an **absolute**, so a wrong value overwrites a right one with no trace; an incremental write would at least be auditable |
| **Con** | The authority is the **client**. `impactReport` decides what the server stores |
| **Con** | Nothing verifies the identity, so drift is silent and unbounded — it ran to 30,477.90 unnoticed |
| **Con** | The stored column and the ledger are two sources of truth for one fact |

### 10.7 Alternatives for determining the balance

| # | alternative | pro | con |
|---|---|---|---|
| A | **Derived** — drop the stored column, expose `SUM(amount)` through a view so readers do not change | drift becomes impossible by construction; one source of truth; matches the pocket decision, whose total is already derived | every read aggregates; `account_balance_after_tr` needs its own answer; a migration touching every consumer of the column |
| B | **Stored, one writer, incremental only** — only the transaction writer touches it, always `balance = balance + amount`, never an absolute; deletion goes through the same door | cheap; keeps reads as they are; makes the deletion path use the ledger instead of bypassing it | the class of bug survives, only caged. A second writer can be added by anyone at any time |
| C | **Stored plus a reconciliation check** — a query comparing every balance against the sum of its rows, run in tests and before deploy | detects drift early; costs one query; composes with A or B | detects, never prevents. Something still has to decide what to do when it fires |
| D | **Snapshots** — periodic checkpoints, balance recomputed from the ledger since the last one | scales to very large ledgers | 785 rows do not need it. It adds a moving part whose failure mode is the one being fixed |

### 10.8 Ranking

1. **A — derived.** Removes the class of defect rather than a defect.
2. **B — one incremental writer.** The pragmatic floor if A is judged too large.
3. **C — reconciliation check.** Not an alternative, a complement. Adopt it with
 whichever of A or B is chosen, and adopt it first.
4. **D — snapshots.** Rejected at this scale.

### 10.9 Recommendation

**C first, then A.**

The reconciliation query costs nothing and can land today: it turns an invisible
failure into a visible one, and it is the test that proves any later repair
worked. Then the derived balance, which makes the whole class impossible — no
second writer, no client-asserted absolute, no drift to detect.

**Order matters, and it is the answer to what to do with the −30,493.21:** the
repair of §10.5 must not be executed before the writer is fixed. Repairing first
and fixing later means the same path re-drifts and the repair looks like the
thing that broke it. Fix the writer, prove it with C, then set the three
balances to their ledger sums in a migration whose DOWN restores the recorded
originals.

And regardless of A or B: the deletion route must **compute the impact on the
server**. `impactReport` arriving from the frontend is the root of this, not a
detail of it.

---

## 11. Account Deletion Strategy and Ledger Integrity — consolidated 2026-08-23

Supersedes the earlier plan-level restatement. Written from the developer
specification of 2026-08-23. The five corrections **[C1]**–**[C5]** and the
counterparty question of §11.11 were **all closed by the developer on
2026-08-23** — see §11.33.

### 11.1 Purpose

Deleting an account is permanent physical deletion, and it must simultaneously
satisfy referential integrity, ledger integrity, balance consistency, the
survival of records belonging to other accounts, erasure of the identity of the
deleted account, and the absence of artificial effects on the financial figures
of the user.

The operation is not

```
 DELETE account → repair balances
```

but

```
 ACCOUNT DELETION → ledger closure → privacy erasure → physical deletion → reconciliation
```

Two rules govern every future implementation:

```
 RULE 1  A deletion must never destroy a ledger event a surviving account needs.
 RULE 2  No balance may change without a ledger event explaining the change.
```

### 11.2 The problem

Two independent paths can write `account_balance`: the transaction path, and the
deletion path through `impactReport` and an absolute `UPDATE`. The second lets
the financial state of an account change with no accounting event behind it, so
the balance stops being a consequence of the ledger and becomes an independent
figure.

The measured consequence: the ledger sums to 0.00 exactly while the balances
drift by −30,493.21 across three accounts, of which −30,477.90 is traced to the
deletion path applying the same adjustments twice (§10). **Repairing those
balances is therefore not a financial correction — it is the removal of a
materialised value that was never backed by transactions.**

### 11.3 Principles

| # | principle |
|---|---|
| **P1** | The ledger is the financial source of truth. `account_balance` is a materialised consequence of it: transaction → ledger effect → balance. Never frontend → balance |
| **P2** | The frontend never determines financial impact. `impactReport` is a **preview** (`GET /accounts/:id/deletion-impact`), never a command input. `DELETE /accounts/:id` recomputes everything server-side |
| **P3** | A deletion never destroys the ledger of a surviving account. Hence `ON DELETE RESTRICT`, not `CASCADE` |
| **P4** | Balances are never set to an absolute during normal operation. Absolute assignment exists only in migrations, explicit reconciliation procedures and controlled admin tools |
| **P5** | Deletion is a domain operation, not an isolated SQL `DELETE`. The `DELETE` is only its last step |
| **P6** | Technical accounts are not part of the user net worth and never enter cash position, bank totals or account aggregates |
| **P7** | The whole operation is atomic. No intermediate state may be visible in which the account is gone but its references remain, or a balance changed but its explaining transaction does not exist |

### 11.4 Invariants

| # | invariant |
|---|---|
| **I-1** | **Global ledger**: `SUM(all ledger effects) = 0`, system accounts included. A deletion may not create an artificial net difference |
| **I-2** | Per surviving account, user or system: `account_balance = SUM(applicable ledger effects)`, exact at the defined financial precision |
| **I-3** | If `account_balance_after_tr` survives: `balance_after = balance_before + transaction_effect`, derived at write time, never a previously captured value |
| **I-4** | After the operation no surviving transaction references the deleted account |
| **I-5** | For every surviving account, the set of its transactions before and after differs only by events created as a legitimate consequence of the closure |
| **I-6** | No information allowing the identity of the deleted account to be reconstructed survives, once it is no longer required by ledger integrity |
| **I-7** | **User economic position** excludes system accounts: `user financial position = SUM(user-account balances)`, and no aggregate presented to the owner reads a system account |

**Two identities, not one.** §2.2 measured
`SUM(user_accounts.account_balance) = SUM(transactions.amount) = 0`, and that
holds **today** only because no account is yet excluded from the user
aggregates. It is not a universal rule and must not be read as one once system
accounts exist. After a closure of 1,000:

```
 A                deleted
 SYSTEM           +1,000
 USER ACCOUNTS    -1,000
 GLOBAL LEDGER         0
```

That is not an inconsistency. It is exactly what §11.11 and `C4` decided. The
normative statement is therefore:

> **The global ledger must balance. User financial aggregates must exclude
> system accounts.**

`I-1` is the invariant a deletion may never break. `I-7` is the rule every
figure shown to the owner must obey. A future reader who collapses the two back
into `SUM(user_accounts.balance) = 0` will reintroduce `F-8`.

### 11.5 Identity is not the event

```
 Account identity        Financial event
 id, name, metadata      +500 / −500, date, movement type
```

Erasing the identity must not destroy the event that explains the position of a
surviving account. The goal is *erase account identity, preserve necessary
ledger semantics* — not *erase every row that ever referenced the account*.

**[C1] The tension is real and must be resolved per column, not left as a
principle.** `I-4` and `11.5` are compatible only if the surviving row keeps its
amount and loses its pointer. The rule: **the counterparty column that pointed
at the deleted account is set to NULL**, and the movement type carries the
meaning. This is the same decision already taken for the opening balance
(§11.20), so the two columns keep exactly one meaning across the whole table.

**Raised to an architectural rule:** the account foreign keys of a transaction
represent **current account identities**; the meaning of the operation lives in
`movement_type`, not in a requirement that both keys always be populated.
Nullability stops being a defect and becomes an explicit part of the model:

```
 source_account_id = NULL, destination_account_id = B,    movement = TRANSFER
 source_account_id = NULL, destination_account_id = NULL, movement = ACCOUNT_OPENING
```

Both columns are already nullable in `003_transactions.sql:48-53`; only
`account_id` is `NOT NULL` (`:39`), which is what makes it ownership.
*Anchors re-measured 2026-08-30; the nullability claim holds.*

#### 11.5.1 The ownership rule

This is the single most load-bearing definition in the module, so it is stated
on its own:

```
 account_id                                 = LEDGER OWNERSHIP
 source_account_id, destination_account_id  = CURRENT IDENTITY OF THE
                                              TRANSFER COUNTERPARTIES
```

`account_id = A` means *this row belongs to the ledger of A*.
`source_account_id = A` means *in this event, A was the source counterparty*.

Every deletion behaviour follows from that distinction alone:

```
 before                          after A is deleted
 account_id             = B      account_id             = B
 source_account_id      = A      source_account_id      = NULL
 destination_account_id = B      destination_account_id = B
 amount                 = +300   amount                 = +300
```

The row still belongs to B and still produces +300. What disappeared was the
identity of the counterparty, not the event. This is why the propagation problem
of §5.1 does not exist, why `C1` is correct, and why `C2` deletes only the rows
owned by the account.

### 11.6 The four phases

```
 1. DISCOVERY   what the account participates in
 2. CLOSURE     generate legitimate ledger effects until its position is zero
 3. ERASURE     remove identity and surviving textual references
 4. DELETION    physically delete rows and account
```

### 11.7 Phase 1 — Discovery

The server locks the account (`SELECT ... FOR UPDATE`) and builds a
`DeletionContext`: account, balance, type, currency, referencing transactions,
affected accounts, financial dependencies, privacy-bearing fields.

It must work from the **real reference model**, not from the two transfer
columns alone — any other column or table carrying a financial relation to the
account counts. The frontend never builds this context.

### 11.8 Phase 2 — Closure

Any financial position that cannot simply vanish is transformed into a
ledger-neutral state through **explicit events**, never through direct balance
edits:

```
 Account A ──closure effect──▶ closure counterparty
 A = 0
```

The account does not disappear while it holds an unresolved position.

**The closure amount is defined, not chosen:**

```
 closure_amount = ledger_balance(A)
```

the server-derived outstanding ledger position of A at the moment of closure.
Never `account_balance` read as a stored figure, never a value from
`impactReport`, never a manually supplied amount. Until phase 4 has repaired the
materialised balances, the stored column and the ledger can disagree — and the
ledger is the one that closes the account.

**[C4] The consequence must be stated out loud:** when the closure counterparty
is a system account (case 2 of §11.11), the balance leaves the user aggregates.
Deleting an account holding 1,000 **reduces net worth by 1,000**. That is not a
defect — it is what erasing money you decline to relocate means. The UI must say
so before the owner confirms.

### 11.9 The `slack` account today

`slack` is an internal account typed as a bank. The defect is semantic, not
nominal: typing it as a bank makes the system read every closure effect as real
bank money and contaminates cash position, bank totals and every dashboard built
on them. It currently **is** the whole bank total (§2.1).

### 11.10 Technical accounts

```
 USER ACCOUNT     BANK · INVESTMENT · POCKET · DEBT · …
 SYSTEM ACCOUNT   ACCOUNT_CLOSURE · …
```

Implementable as an `account_kind` discriminator or as a separate `system_accounts`
domain. The separate domain is stronger: it makes it impossible for a future
`if (account.type === 'bank')` to re-admit a technical account by accident.

The essential property is that `cash_position` must exclude system accounts
structurally, not by remembering to filter them.

### 11.11 Deletion with a remaining balance — revised 2026-08-23

**Decision (`C10`), replacing the first formulation of 2026-08-23:**

> Account deletion never chooses or invents a financial destination. When the
> account has a remaining balance, the owner may explicitly choose to relocate
> that balance to an eligible account; the deletion workflow then executes an
> ordinary `TRANSFER` as part of completing the deletion. The disposition of the
> balance may be part of the deletion, but it is always an explicit decision of
> the owner.

The earlier wording stated the prohibition absolutely, and so also forbade the
case the owner actually asks for. The correction is that the prohibition falls
on **choosing the destination**, never on **executing the movement** — read
absolutely it forced an artificial detour: close the dialog, go to Transfer,
come back, delete.

Three outcomes, and only three:

| the balance | the owner chooses | accounting event | result |
|---|---|---|---|
| already zero | nothing to choose | **none** | delete straight away |
| non-zero | relocate it | **`TRANSFER`** A → the selected account | the money stays in the economic position of the owner |
| non-zero | do not relocate it | **`ACCOUNT_CLOSURE`** A → system account | the amount leaves the economic position of the owner |

The relocation branch executes an **ordinary transfer**. It is not a special
deletion path: same accounting, same FX treatment, same locking, same single
balance writer, same rules as any other transfer in the application. The
deletion use case orchestrates it; it does not redefine it.

The line that matters is therefore not *who moves the money* but *who chose*:

```
 FORBIDDEN   the deletion decides:  "deleting CASH, so we move the money to BANK"
 CORRECT     the owner decides:     A -> B,  and the deletion use case executes it
```

Which is why the deletion use case **does** receive `destinationAccountId` when
the owner picked one. Withholding it would not be a safeguard, only an
inconvenience.

#### 11.11.1 Why `ACCOUNT_CLOSURE` still exists

Because relocating and discarding are economically different events and must not
share a movement type. *Transfer the balance to CASH* really is a transfer
between two accounts of the owner. *Delete without transferring* is not: the
amount stops being part of what the owner holds. Recording the second as a
transfer would invent a destination; recording the first as a closure would
pretend money left when it did not.

#### 11.11.2 The system account, unchanged

For the discard branch the counterparty is a **system ledger account that
absorbs the historical position of a permanently retired account** — never an
expense, a loss, a bank, cash or equity. It exists so the ledger keeps its
structure, not so the money keeps existing, and it is excluded from every user
aggregate (`I-7`).

#### 11.11.3 Consequences to state rather than discover

- **The relocation branch also erases provenance.** After the transfer, the row
 owned by the destination keeps `+X` and its `source_account_id` becomes NULL
 at step 8, so the destination can no longer say the money came from A. That is
 `I-6` applying to a movement the owner actively chose. §11.13 covers the copy:
 the UI renders *Deleted account*, never the identity.
- **The whole ledger position moves.** The deletion flow does not split the
 balance between a transfer and a discard; A must reach zero. Splitting is done
 beforehand with an ordinary transfer, exactly as before this revision.
 **Recommended, open as `AD-8`.**
- **A negative position works by the same mechanics with the opposite sign**, and
 the two branches then mean different things: relocating hands the liability to
 the destination account, discarding *raises* the economic position of the
 owner. The screen copy of §11.34 must not assume a positive balance.
- **Destination eligibility** must be defined: same owner, not soft-deleted, not
 the account being deleted, and able to hold money — which under the pocket
 allocation model excludes pocket accounts, since they hold assignments and not
 funds (`POCKET_DECISIONS.md` §14). **Open as `AD-9`.**

### 11.12 `ACCOUNT_CLOSURE` as its own movement type

Closures currently use `movement_type_id = 9` (`pnl`). Closing an account is
neither profit nor loss; it is an account lifecycle event. A dedicated
`ACCOUNT_CLOSURE` type separates economic events from lifecycle events and stops
analytics reading a deletion as a gain.

### 11.13 Phase 3 — Privacy erasure

`description` embeds identity in free text (`Transfer from Bank A - account 123`),
so physical deletion of the account alone does not erase the data.

Immediate measure: scrub or anonymise those descriptions during the deletion.
Architectural fix: stop storing in free text what is derivable from the foreign
keys, and compose the presentation at read time. When the account is gone the UI
shows *Deleted account* — **without name, id or metadata**. Privacy takes
priority over exact visual reconstruction of the past.

### 11.14 Phase 4 — Physical deletion

Only after closure, erasure and reference neutralisation. `ON DELETE RESTRICT`
is the last line of defence: any remaining reference turns the `DELETE` into a
foreign-key violation and a `ROLLBACK`, which is the desired outcome.

### 11.15 The transactional procedure

```
 BEGIN
  1  Lock A, and every surviving account whose balance will change
  2  Verify ownership and deletion eligibility (§5.6: a non-zero net pocket
     allocation refuses)
  3  Discover every ledger row involving A, from the real reference model
  4  Compute the ledger-derived position of A, server-side
  5  If ledger_balance(A) is not zero, execute the disposition the owner chose,
     for exactly ledger_balance(A), server-derived:
       - relocate -> an ordinary TRANSFER, A -> the selected account
       - discard  -> an ACCOUNT_CLOSURE, A -> the system account
     Validate the destination first when the owner chose to relocate: same
     owner, not deleted, not A, eligible to hold funds
  6  Apply the closure through the single balance writer
  7  Verify A.balance = 0 and A.ledger_balance = 0
  8  Remove the identity of A from surviving transactions: set the counterparty
     column that pointed at A to NULL, preserving the amount, the date, the
     movement type, the surviving account reference and every financial
     semantic                                                            [C1]
  9  Remove or anonymise any surviving textual identity of A
 10  Delete every transaction whose account_id is A                      [C2]
 11  Verify no foreign-key reference to A remains
 12  Verify every surviving account reconciles
 13  Verify the global ledger invariants
 14  DELETE A
 15  Verify A no longer exists, and verify the surviving accounts again
 COMMIT
```

**Order is the whole design.** Step 8 runs *after* the closure, not before, and
step 10 runs after both.

**Step 8 is two explicit statements, never one generic update.** The guard
`account_id <> :accountId` is what keeps the two sets apart, and it is kept
apart in the repository code as well so a later refactor cannot merge them:

```sql
 UPDATE transactions
 SET source_account_id = NULL
 WHERE source_account_id = :accountId
   AND account_id <> :accountId;

 UPDATE transactions
 SET destination_account_id = NULL
 WHERE destination_account_id = :accountId
   AND account_id <> :accountId;
```

and only then, at step 10:

```sql
 DELETE FROM transactions
 WHERE account_id = :accountId;
```

```
 rows OWNED by A                     -> DELETE
 rows OWNED by B but REFERENCING A   -> PRESERVE, counterparty NULL
```

Nulling both columns on every row that mentions A would also erase the
`source_account_id = B` of a transfer B -> A, destroying counterparty
information that has nothing to do with the deletion.

**[C2]** Step 10 was absent from the original specification, and without it the
procedure cannot execute: the rows owned by A carry `account_id`, which is
`NOT NULL` and cannot be nulled, so under `RESTRICT` step 14 fails with a
foreign-key violation.

It is also safe, for an exact reason: after step 6 the rows owned by A **sum to
zero**, because the closure leg cancels the position they describe. Deleting a
set that sums to zero moves neither identity. Run before the closure, the same
step would break the ledger by the balance — which is precisely the double count
that produced the drift of §10.

Worked through, with A funded at 1000, B at 500, and a transfer A -> B of 300:

```
 rows owned by A        +1000, -300            sum 700 = A.balance
 step 5-6  closure      A: -700  /  SYS: +700  A.balance = 0, A rows sum 0
 step 8                 the row owned by B keeps +300, its source becomes NULL
 step 10                A rows deleted; they summed 0, so the ledger is unchanged
 step 14                A is gone; B reconciles at 800; SYS holds 700
```

### 11.16 Locking and concurrency

The deleted account and every surviving account whose balance will change are
locked for the duration. Computing a balance and then discovering that another
transaction changed the counterparty is the failure mode to exclude, so
computation and write happen inside the same transaction under the same locks.

### 11.17 One balance writer

A single abstraction — `applyLedgerEffect(accountId, effect)` or its equivalent
in the existing architecture — is the only thing that modifies `account_balance`.
Every path goes through it: transaction, transfer, income, expense, investment,
debt, pocket, account closure. Deletion gets no special door.

### 11.18 `account_balance_after_tr`

If kept, it is derived at the moment the effect is applied
(`balance_before + effect`), never from a value captured earlier. If no consumer
genuinely needs it, removing it and deriving from the ledger is safer. The column
must not exist merely because it is convenient for a query.

### 11.19 FX and rounding

Transactions 620 and 623 lose one cent (−5.77 against +5.76). When two legs
represent one event the common amount is determined **once**, after rounding, and
reused. Rounding each leg independently lets a supposedly neutral operation
introduce an imbalance.

### 11.20 Account opening

`source = destination = own account` is false. The meaning belongs to the
movement type, so for `ACCOUNT_OPENING` both columns are NULL. Same rule as
**[C1]**: those two columns mean one thing and only one thing.

### 11.21 Soft delete

`deleted_at`, `DELETION_TYPE_SOFT` and the `deleted_at IS NULL` filters are
legacy under a physical-deletion-only model. The ambiguity of two coexisting
deletion models without a domain decision is itself the defect. Removal happens
after the new mechanism is stable, as its own task.

### 11.22 Repairing the current data

Not part of the deletion algorithm — a separate migration, and only after the
defective path is stopped.

```
 stop the incorrect deletion path
 verify the ledger
 compute the expected balance
 repair the materialised balance
```

The repair sets `balance = expected` and **creates no transaction**, because no
financial event of that size occurred; the system simply held a wrong
materialised value. Afterwards the ledger is unchanged and the balances are
ledger-derived.

### 11.23 The repair must be evidenced

Both invariants are recorded before and after, and the migration emits one row
per repaired account:

```
 account_id · old_balance · expected_balance · delta
```

Never *adjust until it balances*.

### 11.24 Reconciliation

A query or service returning, per account: stored balance, calculated balance,
difference, status. A non-zero difference is `MISMATCH` and is never hidden.

### 11.25 Where reconciliation runs

During development; after creation, transaction, transfer and deletion; in tests
as an assertion; before relevant deploys; and after every migration.

### 11.26 The principal deletion test

```
 A = 1000, B = 500
 A -> B = 300        =>  A = 700, B = 800
 delete A
```

The assertion is **identity removed, financial effect preserved** — never
*does the row still say it came from A*, which is what the deletion is there to
stop saying:

```
 A does not exist
 B.balance                              = 800, unchanged by the deletion
 SUM(B ledger effects)                  = 800
 the surviving transaction amount        unchanged
 its reference to B                      unchanged
 its reference to A                      NULL
 no transaction belonging to B disappeared
 global ledger invariant holds
```

This test fails against today's code, which is why it is written first. **[C3]**

### 11.27 The multi-reference test

An account carrying incoming and outgoing transfers, expenses, income,
investment, debt, pocket events, PnL and FX, then deleted, asserting: account
physically absent · surviving transactions preserved · no forbidden foreign key
remains · affected balances reconcile · ledger invariant holds · no account
identity survives · no system account appears in user totals.

### 11.28 The rollback test

Force an error after balances, rows and descriptions have been modified. The
result must be the original state, with no partial state surviving.

### 11.29 Implementation order

| phase | work | objective |
|---|---|---|
| **0** | **Freeze deletion** in production | **[C5]** nothing else is safe to sequence while the defective path can still run |
| **1** | Establish invariants — ledger and balance reconciliation, no functional change | know the current state, and own the test that proves every later phase |
| **2** | Stop corruption — server-side impact, single balance writer; remove the frontend `impactReport`, the absolute assignment and the duplicate internal-account writes | no new corruption |
| **3** | Restrict cascades — the three foreign keys to `ON DELETE RESTRICT` | the database cannot silently destroy surviving records. Deployable **while deletion stays frozen**: if anyone runs the old path, the database refuses instead of destroying |
| **4** | Repair the existing data — the three balances to their ledger sums, as a migration with per-account evidence | stored balances equal ledger-derived balances |
| **5** | **Isolate system accounts** and revisit every aggregate | technical accounting state is not user financial state |
| **6** | Implement account closure — `ACCOUNT_CLOSURE` and the procedure of §11.15 | close, preserve, then delete identity. Deletion unfreezes here |
| **7** | Ledger hygiene — `account_balance_after_tr`, FX rounding, account opening | every ledger event internally coherent |
| **8** | Remove the legacy deletion infrastructure | one deletion model |

**Repair before closure**, as the developer sequenced it: with deletion frozen
and corruption stopped, the repair lands on a still system, and the closure work
is then built and tested against data that already reconciles.

**One change to that order: isolation (5) moves ahead of closure (6).** Closure
writes `ACCOUNT_CLOSURE` entries against the system account. If that account is
still typed as a bank when the first closure runs, every closure re-contaminates
the bank total — the exact defect of `F-8`, recreated by the fix for `F-14`.
Isolating first means the first closure ever written already lands somewhere
excluded from the user aggregates.

### 11.30 The fourteen findings and their treatment

| id | problem | treatment |
|---|---|---|
| F-1 | `ON DELETE CASCADE` | `RESTRICT` |
| F-2 | the frontend computes the impact | the backend computes everything |
| F-3 | two balance writers | one writer |
| F-4 | duplicate writes to the internal account | removed by the single flow |
| F-5 | `account_balance_after_tr` incorrect | derive or drop |
| F-6 | no reconciliation | reconciliation query and service |
| F-7 | balances materialised wrongly | historical repair, phase 5 |
| F-8 | `slack` typed as a bank | system account |
| F-9 | closure recorded as PnL | `ACCOUNT_CLOSURE` |
| F-10 | identity inside `description` | erasure plus read-time composition |
| F-11 | FX loses cents | round once |
| F-12 | opening uses a self-reference | NULL / NULL |
| F-13 | dead soft-delete code | remove after stabilising |
| F-14 | no ledger-neutral procedure | closure, erasure, physical deletion |

### 11.31 The definition of success

A deletion succeeded only when all of the following hold: the account no longer
exists · no surviving foreign key references it · surviving ledger events are
preserved · surviving balances reconcile · the deleted account reached zero
before deletion · the global ledger invariant holds · no artificial profit or
loss was created · no technical account contaminates user aggregates · the
identity of the deleted account is not retained unnecessarily · the whole
operation committed atomically.

`DELETE returned 204` is not success.

### 11.32 The architectural decision

> **Account deletion is a domain-level closure operation followed by physical
> identity deletion.**

The account is not deleted directly. Its financial position is determined, the
accounting effects that leave it neutral are generated, the references surviving
accounts need are preserved, the identifying information is removed, and the
physical deletion runs last, protected by `ON DELETE RESTRICT`.

The balance is never *corrected* as a consequence of the deletion. The balance
changes only because a ledger event produced the change.

The question therefore stops being *how to delete an account without breaking
the balances* and becomes the correct one: **how to permanently withdraw the
identity of an account from an accounting system without destroying the economic
integrity of the ledger that remains.**

### 11.33 Decisions closed 2026-08-23 — the architecture is approved

| # | decision | state |
|---|---|---|
| C1 | the counterparty of a deleted account becomes `NULL`; the amount is preserved | **closed** |
| C2 | the rows owned by the account are deleted **after** the closure | **closed** |
| C3 | the test asserts the financial effect, not the erased identity | **closed** |
| C4 | closing without transferring **reduces the economic position of the owner**, and the UI says so before confirming | **closed** |
| C5 | deletion is frozen before the migration to `RESTRICT` and the new procedure | **closed** |
| §11.11 | choosing a destination account during the deletion | **reopened and re-decided 2026-08-23: yes**, when the owner selects it. See C10 |
| C10 | the deletion flow offers relocate / discard as an explicit choice, executes an ordinary `TRANSFER` for the first and `ACCOUNT_CLOSURE` for the second, and never picks a destination itself | **closed** |
| C6 | the global ledger invariant and the user economic position are two distinct statements (`I-1` / `I-7`) | **closed** |
| C7 | `account_id` is ledger ownership; the transfer columns are counterparty identities (§11.5.1) | **closed** |
| C8 | `closure_amount = ledger_balance(A)`, server-derived (§11.8) | **closed** |
| C9 | step 8 is two guarded `UPDATE`s, kept separate in the repository code (§11.15) | **closed** |

The governing rule:

> **Transfer is a financial operation. Account deletion is a lifecycle
> operation that may orchestrate an explicitly requested financial operation
> before completing the lifecycle transition. It never chooses that operation on
> behalf of the owner.**

### 11.34 What the deletion screen must say

The disposition is chosen **inside** the deletion flow, not by sending the owner
to another screen. What the flow must never do is decide for them.

```
 +------------------------------------------+
 | Delete CASH                              |
 |                                          |
 | This account has 1,000 remaining.        |
 |                                          |
 | What would you like to do?               |
 |                                          |
 | ( ) Transfer the balance                 |
 |     To: [ select account  v ]            |
 |                                          |
 | ( ) Remove the balance from my assets    |
 |                                          |
 |                    Cancel     Delete     |
 +------------------------------------------+
```

Internally:

```
 choice = TRANSFER  -> ordinary transfer -> verify A = 0 -> erase -> delete
 choice = DISCARD   -> ACCOUNT_CLOSURE   -> verify A = 0 -> erase -> delete
```

Neither option is preselected, and the discard option says what it costs — those
funds stop being counted in the assets of the owner (`C4`). When the balance is
zero the question is not asked at all; when it is negative the copy states an
outstanding negative position and the two options change meaning, per §11.11.3.

### 11.35 The workflow, end to end

Three diagrams: what the owner walks through, what the server executes, and
where the money ends up. All three describe the state **after phase 6**; until
then deletion is frozen (`C5`, §11.29).

**A — the owner-facing workflow**

```
 Accounts screen
      |
      | [ Delete CASH ]
      v
 the server returns ledger_balance(CASH), derived from the rows, never
 the stored account_balance column and never a client figure          (F-2, C8)
      |
      +-------------------------------+
      |                               |
 balance = 0                     balance <> 0
      |                               |
      |                    "This account has 1,000."
      |                    What would you like to do?
      |                       ( ) Transfer the balance to [ account v ]
      |                       ( ) Remove the balance from my assets
      |                    neither option preselected                    (C4)
      |                               |
      |                     +---------+---------+
      |                     |                   |
      |              disposition =        disposition =
      |                 TRANSFER              DISCARD
      |              + destinationAccountId       |
      |                     |                   |
      +---------------------+---------+---------+
                                      |
                                      v
        DELETE /accounts/:id  { disposition, destinationAccountId? }
```

The owner never lands on a second screen, and the request never carries an
amount or an impact report — only the choice.

**B — the server transaction**

```
 BEGIN
  |
  1  LOCK        A, and every account whose balance will change
  2  ELIGIBLE    ownership; net pocket allocation of A = 0          (QP-19)
  3  DISCOVER    every ledger row involving A
  4  MEASURE     ledger_balance(A), server-derived                    (C8)
  |
  5  DISPOSE     ledger_balance(A) <> 0 ?
  |                |
  |                +-- TRANSFER  A -> destination     ordinary transfer
  |                |                                  validate: same owner,
  |                |                                  alive, not A, may hold
  |                |                                  funds              (AD-9)
  |                +-- DISCARD   A -> system account  ACCOUNT_CLOSURE   (AD-4)
  |
  6  APPLY       through the single balance writer                      (F-3)
  7  ASSERT      A.balance = 0  AND  ledger_balance(A) = 0
  |
  8  ERASE ID    source_account_id      = NULL WHERE ... AND account_id <> A
  |              destination_account_id = NULL WHERE ... AND account_id <> A
  9  SCRUB       any surviving textual identity of A                   (F-10)
 10  DROP ROWS   DELETE FROM transactions WHERE account_id = A
  |              safe only here: after step 6 those rows sum to zero     (C2)
  |
 11  VERIFY      no foreign key still points at A
 12  VERIFY      every surviving account reconciles                     (I-2)
 13  VERIFY      global ledger = 0, user aggregates exclude system  (I-1, I-7)
 14  DELETE A
 15  VERIFY      A is gone, and the survivors still reconcile
  |
 COMMIT
```

Any assertion that fails rolls the whole thing back. There is no partial
deletion, and no state in which the account is half gone.

**C — where the money ends up**

```
 start        A = 1,000     B = 500     SYSTEM = 0     user position = 1,500

 relocate     A =     0     B = 1,500   SYSTEM = 0     user position = 1,500
              a TRANSFER moved it; the owner keeps the money
              B keeps its +1,000 row, but its source_account_id is now NULL

 discard      A =     0     B =   500   SYSTEM = 1,000 user position =   500
              an ACCOUNT_CLOSURE absorbed it; the ledger still sums to zero,
              the owner no longer holds it                          (I-1, I-7)
```

The global ledger closes at zero in both branches. What changes between them is
the economic position of the owner — which is exactly why they are two movement
types and not one.

---

## 12. DB audit — measured 2026-08-26, before any schema decision

Requested by the developer as the step that precedes designing tables: read the
migrations and the live code of `user_accounts`, `transactions`, the annulment
path and the internal counterparty account, then state what to reuse, what to
add and what not to touch. Nothing was written to any database.

### 12.1 The finding that reshapes the proposal: there is no entries table

`003_transactions.sql:65-81` contains a **commented-out** `transaction_entries`
table with `entry_type IN ('debit','credit')`. It was designed and never
created. The runtime initialiser does not create it either
(`createTables.js`, thirteen `tblName` entries of which three are themselves
commented out, so ten tables, none of them entries).
*Anchors re-measured 2026-08-30; the finding holds.*

What exists instead:

```
 one financial event  =  two rows in `transactions`
 each row owned by one account through `account_id NOT NULL`
 nothing links the two rows of the same event
```

`recordTransaction` (`recordTransaction.js:23`) inserts **one leg**; the movement
path calls it twice (`transactionController.js:780` and `:818`).
*Call-site anchors re-measured 2026-08-30; `recordTransaction.js:23` is unchanged.*

**Consequence for a reversal feature.** A `reverses_transaction_id` column would
point at a *leg*, not at an event, and reversing a transfer means reversing two
legs. Worse, *finding* the pair to reverse has to be inferred from amount, sign,
counterparty and adjacent id — and two identical transfers on the same day are
indistinguishable under that inference. **The minimal column for reversal is not
`reverses_transaction_id`, it is an event identifier** (`transaction_group_id`),
plus a backfill over the 785 existing rows that rests on the same unreliable
inference. That is the real cost of a delete-and-reverse strategy, and it is
larger than it looks from outside the schema.

### 12.2 The complete inventory of references to `user_accounts(account_id)`

| table.column | ON DELETE | verdict |
|---|---|---|
| `transactions.account_id` | **CASCADE** | destroys the account's own ledger. `003:38-40` |
| `transactions.source_account_id` | **CASCADE** | destroys rows owned by a *surviving* account. `003:46-48` |
| `transactions.destination_account_id` | **CASCADE** | the same. `003:49-51` |
| *the three above, re-measured 2026-08-30* | **RESTRICT** | migration `018` shipped 2026-08-27. New anchors `003:39-41`, `003:48-50`, `003:51-53` |
| `income_source_accounts.account_id` | CASCADE | correct — 1:1 extension of the account |
| `category_budget_accounts.account_id` | CASCADE | correct |
| `debtor_accounts.account_id` | CASCADE | correct |
| `pocket_saving_accounts.account_id` | CASCADE | correct |
| `account_name_case_backup_013.account_id` | CASCADE | correct — chain-only table |
| `budget_monthly_allocations.account_id` | CASCADE via `category_budget_accounts` | correct |
| `debtor_accounts.selected_account_id` | **SET NULL** | **already correct**, and it is a counterparty pointer |

Eight of the ten are right. The three on `transactions` are the outliers, and
`debtor_accounts.selected_account_id` (`002:178-179`) proves the correct pattern
was already understood when the schema was written — a pointer at another
account is nulled, not cascaded.

**Why `RESTRICT` and not `SET NULL` on the two counterparty columns.** `SET NULL`
would produce the right rows by itself and match the precedent above. It is
rejected because it acts *silently at `DELETE` time*: no description scrub, no
invariant assertion, no closure. `RESTRICT` on all three makes a bare `DELETE`
fail, which is the forcing function the whole procedure depends on (§5.3).

### 12.3 The internal counterparty account has no structural identity

`accountUtils.js:63` finds it with `AND ua.account_name = 'slack'`, and `:106`
excludes it from lists with `AND ua.account_name != 'slack'`. Six sites carry the
literal. Its `account_type_id` is **1 — `bank`**.

> **Count corrected 2026-08-30.** The two `accountUtils.js` anchors are unchanged.
> The literal is now carried by **25 non-comment sites outside
> `dashboardController.js`**, not six — the pocket module added most of them
> (`pocket_services/db/accountAllocationRepository.js:61`,
> `services/pocketAllocationService.js:47`), alongside
> `getAccountController.js` (11 sites), `transactionController.js` (`:56`, `:232`,
> `:241`, `:696`), `movementInputHandler.js:95` and `:100`,
> `checkAndInsertAccount.js:12`, `recordAnnulmentTransaction.js:122`,
> `accountCreationController.js:249` and
> `accountCategoryCreationcontroller.js:397`. With the dashboard's sixteen (§2.1)
> the convention is load-bearing in 41 places.

The catalog has exactly six types and every one of them is user-facing
(`populateDB.js:245-251`): `bank`, `investment`, `debtor`, `pocket_saving`,
`category_budget`, `income_source`. **There is no system or technical type in any
form.** So `I-7` — user aggregates exclude system accounts — has nothing to
filter on today except an account name.

### 12.4 `movement_types` has two different shapes depending on how the DB was built

| built by | definition | accepts a tenth value? |
|---|---|---|
| the migration chain | `001_initial_migration.sql:35-38`, no `CHECK` | yes |
| the runtime initialiser | `populateDB.js:397`, `CHECK(... IN (nine values))` | **no** |

*Anchors re-measured 2026-08-30: the migration-chain definition is unchanged at
`001_initial_migration.sql:35-38`; the initialiser's `CHECK` moved from `:395` to
`:397` and still lists the same nine values.*

Adding `account-closure` (`AD-4`, `F-9`) is therefore **not** a one-line seed
insert. It needs a constraint drop-and-recreate written to survive both shapes.
This is exactly the class of difference that passes locally and fails in
production, and it was not recorded anywhere before this audit.

The nine current values are `expense, income, investment, debt, pocket, transfer,
receive, account-opening, pnl`. `transaction_types` holds five and needs nothing.

### 12.5 What can be reused with no change at all

**The write helpers already accept the connection.** This is the single most
useful finding for the settlement design:

```
 recordTransaction(clientOrPool, option)      recordTransaction.js:23
 updateAccountBalance(clientOrPool, ...)      updateAccountBalance.js:13
```

> **Corrected 2026-08-30.** `recordTransaction.js:23` is unchanged and still takes
> the connection. **`updateAccountBalance.js` is deleted in the working tree.**
> Its replacement is
> `accountManagement/setAccountBalanceFromLedger.js:48`,
> `setAccountBalanceFromLedger(client, accountId, userId)`, which also takes the
> connection first — so the finding survives its subject, but every pointer at
> `updateAccountBalance.js` in this log names a file that no longer exists. The
> transaction boundary moved to `transactionController.js:539` `BEGIN` ->
> `:890` `COMMIT`.

and the movement path already runs one transaction end to end
(`transactionController.js:487` `BEGIN` -> `:789` `COMMIT`). So a settlement or a
relocation executed inside the deletion transaction is an **ordinary movement
written by the existing helpers**. No settlement table, no parallel model, no
new write path — the hypothesis that FinTrack needs very few new tables is
confirmed for this half.

The locking the procedure requires also already exists in the codebase:
`budgetAllocationService.js:122` uses `FOR UPDATE OF ua`. Copy it; do not invent
a second pattern.

### 12.6 What the current analysis cannot answer

`getAnnulmentImpactReport.js` is the only existing analysis, and two properties
of it decide the new design:

- **It runs on `pool`, not on a client** (`:92`, re-measured 2026-08-30), so it structurally cannot join
 the deletion transaction. Revalidation inside the transaction has to re-run it
 on the client — a signature change, not a rewrite.
- **It never computes the residual of the account being deleted.** It groups the
 target's signed amounts by counterparty and returns the adjustment each
 counterparty would need. That is the input a *reversal* needs. It is not the
 input a *settlement* needs, which is one number: `ledger_balance(A)`.

So the existing report is not an impact report that is missing fields. It
answers a different question, and the settlement query has to be written.

Two further defects in it, recorded on discovery: no `deleted_at IS NULL` filter
on either side, and `tr.destination_account_id != tr.source_account_id` is
NULL-unsafe, so once `C1` and `F-12` start writing NULLs into those columns the
predicate silently drops rows.

*Re-verified 2026-08-30: both defects are still there. The NULL-unsafe predicate
is at `getAnnulmentImpactReport.js:51`, and the file contains no `deleted_at`
filter at all.*

### 12.7 Reversal exists, and it lives inside deletion — corrected 2026-08-26

The earlier wording of this section ("no endpoint deletes, edits or reverses a
transaction") was true of `transactionRoute.js` and misleading about the
application. **Compensating entries are written today**, by
`recordAnnulmentTransaction.js`, reached from `deleteAccountService.js:185-362`
through the `RTA` branch of `accountDeleteController.js:99-112`.
*Anchors re-measured 2026-08-30; the controller branch is unchanged, the service
function `processRTAAnnulment` moved to `:185-362`.*

What it actually does, per affected counterparty:

```
 updateAffectedAccountBalance(client, newAffectedBalance, affectedAccountId)
 recordAnnulmentTransaction(client, {...})   -> two INSERTs, movement_type = pnl
     leg 1  account_id = affected   amount = +adjustment
     leg 2  account_id = slack      amount = -adjustment
```

So the pattern the settlement needs — two legs, opposite signs, written on the
deletion's own client — **is already implemented and working**. It is reused, not
invented.

Three defects in it, and the first is the one that matters for the UI:

- **The report round-trips through the browser.** `accountDeleteController.js:100`
 reads `impactReport` from `req.body`, and `deleteAccountService.js:212-216`
 computes `newAffectedBalance = affectedAccountCurrentBalance +
 affectedAccountNetAdjustmentAmount` from it. `affectedAccountCurrentBalance` is
 a **client-supplied balance**, written straight into `user_accounts`. That is
 both the staleness hole and an authorization hole, and no locking fixes it —
 the server has to recompute the report inside the transaction and treat the
 body as an echo to compare against, never as input (§5.3).

 > **Corrected 2026-08-30.** `accountDeleteController.js:100` is unchanged and
 > the body is still the source of the adjustments, but the **balance** half is
 > fixed: `deleteAccountService.js:239-241` now starts from
 > `ledgerBalanceOf(row.affectedAccountId)`, the locked ledger, not from the
 > report's `affectedAccountCurrentBalance`. What still arrives from the browser
 > and is still written unchecked is `affectedAccountNetAdjustmentAmount`.

- **Every slack leg stores the same `account_balance_after_tr`.**
 `finalSlackBalance` is computed once before the loop (`:225`, then re-derived at
 `:253-254`, both before the loop at `:259`) and passed to
 every `recordAnnulmentTransaction` call, so with more than one affected account
 all but the last slack leg carry a running balance that never existed.
 *Anchor re-measured 2026-08-30; the defect is unchanged.*
- **`updateAffectedAccountBalance` is absolute and not scoped by `user_id`**
 (§12.8).

The correct reading of the history: account deletion is the **only** place in
FinTrack where a compensating entry can be written, so every reversal
requirement landed here. That is an argument for reusing this code, not for
moving it.

### 12.8 Three balance writers, all absolute, none scoped by user

```
 transactionController.js:138                             UPDATE ... SET account_balance=$1
 accountManagement/updateAccountBalance.js:21             the same statement
 accountDeletionUtils/updateAffectedAccountBalance.js:28  the same, WHERE account_id=$3
```

None is incremental and none carries `user_id` in its `WHERE`. This is `F-3`
measured, and the third one is also the authorization hole: a fabricated body
sets the balance of any account, including another user's.

> **Census corrected 2026-08-30 — two writers, not three.**
>
> **What this subsection asserts.** Three functions write `account_balance` with
> the same absolute statement, none scoped by `user_id`.
>
> **What the code says today.** One of the three is gone, one is deleted, and a
> derived writer has taken their place:
>
> ```
>  transactionController.js:138        GONE. That range now holds getAccountTypes
>                                      and getTransactionTypes; the file has no
>                                      balance UPDATE of its own.
>  updateAccountBalance.js:21          FILE DELETED in the working tree.
>  updateAffectedAccountBalance.js:8   ALIVE, still absolute, still unscoped by
>                                      user_id, statement at :28. Two callers,
>                                      both on the delete path:
>                                      deleteAccountService.js:273 and :311.
>  setAccountBalanceFromLedger.js:48   NEW, untracked. Derives from
>                                      derivedBalance.js and carries user_id in
>                                      its WHERE.
> ```
>
> **What now needs a fresh decision.** The authorization hole this subsection
> names survives in exactly one function, on exactly one path — the delete path
> — so `F-3` is no longer a three-way consolidation but the retirement of a
> single legacy writer. Which unit owns that retirement is open.

### 12.9 What the audit says to add, reuse and leave alone

**Add — four migrations, in this order, each with explicit UP and DOWN:**

| # | change | why it cannot be skipped |
|---|---|---|
| 1 | the three `transactions` FKs -> `ON DELETE RESTRICT` | without it every rule below is a convention one `DELETE` can bypass (§5.3). **SHIPPED 2026-08-27 as migration `018`; recorded 2026-08-30** |
| 2 | `account_types` gains a seventh row for system accounts, and the internal counterparty account moves to it | every aggregate already joins `account_types`; exclusion then costs a join predicate instead of a new column plumbed through every query, and the six `account_name = 'slack'` literals die with it |
| 3 | `movement_types` gains `account-closure`, with the `CHECK` rewritten for both DB shapes of §12.4 | closures stop being recorded as profit and loss (`F-9`) |
| 4 | the balance repair — three accounts to their ledger sums, one evidence row each | §10.5, and only after the writer is fixed |

**Reuse unchanged:** `recordTransaction`, `updateAccountBalance` (once it is the
only writer), the transaction boundary of `transactionController.js:487-793`, the
`FOR UPDATE OF ua` pattern, the four 1:1 extension tables and their `CASCADE`,
and `debtor_accounts.selected_account_id`.

*Corrected 2026-08-30: the writer to reuse is `setAccountBalanceFromLedger`, not
`updateAccountBalance`, whose file is deleted; the transaction boundary is
`transactionController.js:539-890`; the `FOR UPDATE OF ua` pattern is still at
`budgetAllocationService.js:122` and now also at
`pocket_services/db/accountAllocationRepository.js:220`;
`debtor_accounts.selected_account_id` is still `ON DELETE SET NULL` at
`002_accounts.sql:178-179`.*

**Do not add:** `account_deletion_plan`, `account_deletion_events`,
`deleted_accounts`, or any settlement table — §12.5 shows the settlement is an
ordinary movement. **Do not revive `transaction_entries`** — it rewrites every
write path in the application. **Do not add `reverses_transaction_id`** — §12.1
shows it is the wrong column even for the feature that would want it.

**Do not touch:** `currencies`, `transaction_types`, `account_types` rows 1-6,
the FX columns of `007`, and the movement write path beyond making the balance
writer single.

### 12.10 One thing the audit cannot check yet

There is **no pocket allocation table**. The database holds eighteen tables and
none of them records an allocation; a pocket relationship today is a
`movement_type_id = 5` row. So the refusal of §5.6 — an account with a non-zero
net pocket allocation cannot be deleted — has nothing to read, and it becomes
implementable only when `POCKET_DECISIONS.md` §14 lands. Until then the eligibility
check of step 2 is a sum over transactions, not a lookup.

> **Measurement corrected 2026-08-30 — the premise has ceased to exist, and the
> passage is kept rather than struck.**
>
> **What it asserts.** No allocation table exists, so the pocket eligibility
> refusal cannot be implemented and must fall back to a sum over `transactions`.
>
> **What the code says today.** Migration
> `sql_migrations/020_create_pocket_tables.sql` creates `pockets` at `:83` and
> **`pocket_allocations` at `:143`**, and the module around them is written:
> `pocket_services/db/pocketRepository.js`,
> `pocket_services/services/pocketAllocationService.js`,
> `pocket_services/db/accountAllocationRepository.js`, and the routes at
> `routes/pocketRoutes.js`. The blocking condition — waiting for the pocket
> decisions to land — is met.
>
> **What now needs a fresh decision.** The eligibility check of step 2 can be a
> lookup against `pocket_allocations` rather than a sum over `transactions`, and
> which of the two it should be has not been decided. The table count of eighteen
> was a database measurement of 2026-08-26 and has not been re-taken.

### 12.11 What a bare `DELETE` breaks today — measured on the real-data copy

Run 2026-08-26 against `fintrack_prod_data`, read-only, no value printed. The
question: for each of the 100 accounts, how many rows **belonging to a different
account** would the three cascades destroy.

| measure | value |
|---|---|
| accounts whose deletion destroys rows owned by someone else | **95 of 100** |
| worst single deletion | **331 rows belonging to 91 other accounts** |
| median, over the 95 that have any | 3 rows |
| rows in the table referencing an account other than their owner | **676 of 785 — 86%** |

The worst case is the internal counterparty account, which is the counterparty of
every account opening. The number that matters for a product decision is the
median: **an ordinary deletion silently rewrites the history of about three rows
that belong to other accounts**, and 95% of accounts do it at all.

### 12.12 Account opening writes two legs, and both die with the account

`accountCreationController.js:357-396`. When the opening amount is non-zero
(`isTransfer` at `:161`), the controller writes:
*Anchors re-measured 2026-08-30; the two-leg shape below is unchanged.*

```
 leg 1   account_id = A       source = slack   destination = A    +2000
 leg 2   account_id = slack   source = slack   destination = A    -2000
```

Deleting A takes leg 1 through `account_id` **and leg 2 through
`destination_account_id`**. So the system account loses a row it owns, and its
stored `account_balance` keeps the −2000 that row explained.

**This is a second, independent producer of the exact signature of §10.2:** a
balance with no rows behind it. It leaves the global ledger at zero — the pair
leaves together — while breaking `I-2` for the system account. §10.2 traced the
whole −30,477.90 to the annulment path applying its adjustments twice; this
mechanism would add to it silently and could never be told apart from it
afterwards, because in both cases the evidence is the rows that are gone.

When the opening amount is zero, only leg 1 is written, with
`source = destination = A` — the self-reference of `F-12` — carrying 0.00.

### 12.13 Which of the classic hard-delete hazards actually apply here

Written against the seven consequences the developer enumerated 2026-08-26, so
the ones that do not apply stop being designed for.

| hazard | applies to FinTrack? |
|---|---|
| the `DELETE` fails on a foreign key | **no** — all three are `CASCADE`, so it succeeds and destroys. *Corrected 2026-08-30: **yes**, since migration `018`. A bare `DELETE` now fails on `RESTRICT`, which is the forcing function §5.3 asked for* |
| the account's own history is destroyed | **yes**, and it is the accepted price of hard delete (§5.5) |
| rows of *other* accounts are destroyed | **yes**, and this is the defect. §12.11 measures it |
| ownership becomes `NULL` | **impossible** — `account_id` is `NOT NULL` (`003:39`, re-measured 2026-08-30). `SET NULL` is only available on the two counterparty columns, where it is the correct answer |
| a journal entry is left structurally incomplete | **no** — there is no entry object. Each leg is a self-contained row, so the breakage is arithmetic (a sum off by X), never structural. This is why the repair is a compensating row and not a schema reconstruction |
| the surviving side cannot say who sent the money | **worse than that** — the surviving side's row is deleted outright, so it is not an unresolvable pointer, it is a balance that no longer reconciles with its own rows |
| the opening balance is orphaned | **no** — both legs of the opening leave together (§12.12). What survives is the system account's *balance*, not its row |
| a total shown to the owner drops by the deleted balance | **yes**, and that is correct behaviour, not a defect. `C4` already ruled that discarding a balance reduces the economic position of the owner and that the UI must say so before confirming |

**The one hazard the enumeration misses**, and it is the one that is actually
broken today: a third integrity beyond referential and financial —
`account_balance = SUM(the rows that account owns)`, which is `I-2`. It is
neither of the other two, no foreign key protects it, and it is off by
−30,493.21 right now.

### 12.14 The sentence to keep from the 2026-08-26 conceptualisation

> The settlement does not exist to make the account technically deletable. It
> exists to preserve the financial position of the account being deleted.

Correct, with one distinction it collapses. The settlement preserves the
**ledger**, not the wealth of the owner. Sending the residual to the system
account keeps `I-1` at zero and **removes** the amount from what the owner holds
(`I-7`, `C4`). Preserving the wealth is the *other* branch — the ordinary
transfer to an account the owner picks (`C10`). Naming both "preserve" is what
merges the two branches the plan deliberately separated.

### 12.15 The contradiction that has to be settled, not designed around

The conceptualisation asks how FinTrack will know that a set of preserved
transactions belonged to *"Bank A — Chase Checking"* once Bank A is gone.

Under hard delete it cannot, and it must not. The rows owned by A are deleted
(§5.5); the rows that survive belong to other accounts, and `I-6` requires that
the identity of A not be reconstructible from them. Keeping a historical account
identity so reports read well is the opposite of the erasure that was decided on
2026-08-23.

The two requirements are genuinely incompatible, and the choice has already been
made: **erasure wins, and the surviving row renders as *Deleted account*.** The
place the contradiction still physically lives is
`transactions.description`, which embeds the counterparty name and id in free
text (`F-10`, §5.4) — that text is a historical account identity, kept by
accident rather than by decision.

---

## 13. Implementation specification — derived 2026-08-26

> **Partly superseded by section 14, settled 2026-08-26.** Six subsections were
> replaced when the architecture moved from one operation to an account
> lifecycle: 13.1, 13.3, 13.6, 13.7, 13.8 and 13.14. They are kept rather than
> deleted because the reasoning in them is what produced 14. The exact list of
> what stands and what falls is in 14.10. **Read 14 first.**

Supersedes the design fragments scattered through sections 5 and 11. Sections 10
and 12 stay as they are: they are the measurement this specification rests on.

**The problem this solves is not how to perform a hard delete.** It is how to
turn the hard delete into a controlled domain operation, instead of letting
PostgreSQL define the financial behaviour by accident through `ON DELETE
CASCADE`.

Six statements fix the boundaries, and every subsection below implements exactly
one of them:

```
 what the owner asks for      remove an account from FinTrack
 what FinTrack decides        how to treat its position and its relationships
 what the database forbids    destroying rows owned by accounts that survive
 what execution guarantees    the financial state afterwards is coherent
 what must disappear          the account, and what identifies it
 what may survive             rows owned by other accounts, even if the
                              deleted account was their counterparty
```

**The governing principle, and the whole reason the module exists:**

> An account whose ledger balance is zero can be deleted without any financial
> position changing. When the balance is not zero, the deletion must first
> settle it according to an explicit choice by the owner.

*Reworded 2026-08-26.* The first form said "without any total changing", which
reads as a claim about the whole operation. It is not: the discard branch does
reduce the owner's position, in the settlement step, before the delete. The
principle is about the delete itself, and the rewording keeps it that way.

### 13.1 User-facing deletion policy

The owner is never shown a deletion mode. `RTA`, `HARD` and `SOFT` are internal
names and stay internal. One question is asked, and only when there is something
to ask about:

```
 Delete "Bank A"
 Current balance                                    2,000.00 USD

 This account has 27 movements of its own, and movements with 3 of
 your accounts.

 Where do the 2,000.00 go?

   ( ) To another account        [ pick an account v ]
   ( ) Out of FinTrack             your position drops by 2,000.00

 On delete: the detail of Bank A disappears. The movements you had with
 your other 3 accounts stay in them.

                                                   [ Delete account ]
```

Four rules the screen has to obey:

- **A zero residual asks nothing.** The consequences and the button, no question.
- **A negative residual asks the same question in the other direction** — which
 account covers the shortfall. Deletion is never refused on the sign of the
 balance; refusing leaves the owner unable to close an account without inventing
 income (`C4`, section 11).
- **Preserving the counterparties' history is not an option the owner picks.** It
 is an invariant of the operation (13.8). It is stated on the screen as a fact,
 never as a checkbox.
- **The account's own history is not preserved, and the screen says so before the
 confirmation.** That is what hard delete means (section 5.5), and the owner has
 to read it while the choice is still theirs.

### 13.2 Pre-deletion assessment

Replaces the impact report. Three figures, all computed **server-side**:

| figure | source | exists today |
|---|---|---|
| the residual — the account's ledger balance | `SUM(amount) WHERE account_id = A` | **no** |
| how many movements are its own | `count(*) WHERE account_id = A` | no |
| how many of the owner's accounts it has movements with | distinct counterparties | partially |

**The residual is the balance derived from the ledger, never
`user_accounts.account_balance`.** The two are the same number on a healthy
account, and 13.9 is the measurement of them coming apart — `banco` carried a
stored 205.41 against rows summing 262.40. Settling a deletion against the stored
column would move an amount no row supports: the defect this operation exists to
stop, executed by the operation itself.

The residual is the one piece of genuinely new SQL in this specification, and it
is the figure the whole screen turns on. `getAnnulmentImpactReport.js` never
computes it (12.6): it answers a different question — the adjustment each
counterparty would need — which is the input a reversal needs, not a settlement.

**The assessment is never accepted from the client.** Today
`accountDeleteController.js:100` reads `impactReport` from `req.body` and the
service writes `affectedAccountCurrentBalance` — a browser-supplied balance —
straight into `user_accounts`. That is both a staleness hole and an
authorization hole (12.7).

The rule: the assessment is recomputed **inside the deletion transaction**, on
the transaction's own client, and whatever the body carries is treated as an
**echo to compare against**. A mismatch is a `409` naming the figure that moved,
never a write. Locking alone does not fix this — it makes the execution correct
and says nothing about the owner having confirmed a number that has since
changed.

### 13.3 Financial treatment

Two destinations, **one code path**. They differ only in
`destination_account_id`:

```
 to an account the owner picked   -> an ordinary two-leg movement
 out of FinTrack                  -> the same movement, destination = holding
```

**What the system account represents, settled here rather than assumed.** It
carries two roles worth naming separately before deciding they are one: the
technical counterparty of money entering the system, and the counterparty of an
irreversible reduction of the owner's position. They are the same concept — the
account is the **boundary of the system**, and its balance is the negative of
everything that has ever entered, net of what has left. An opening credits the
new account and debits the boundary; a discard does the reverse. Splitting it in
two would add an entity and answer no question, and the sum across the pair would
still have to be the boundary.

What must stay distinguishable is not the account but the **direction**, and the
movement type is what carries it: `account-opening` on the way in,
`account-closure` on the way out. That is the semantic separation. A second
account is not.

The system holding account is therefore the account the code calls `slack`; it is
not a new entity (12.3). What it lacks is structural identity — it is recognised by
its name in six places and its type is `bank`, like any account of the owner's.

Nothing new is written to perform this. `recordTransaction` and
`updateAccountBalance` both take the connection as their first argument
(12.5), and `recordAnnulmentTransaction.js` already writes exactly this shape —
two rows, opposite signs, on the deletion's own client. The settlement reuses
it; it does not reinvent it.

**The movement type is `account-closure`, not `pnl`.** Today every annulment row
is written with `movement_type_id = 9`, so in any profit-and-loss report closing
an account is indistinguishable from a gain. Adding the value is a
drop-and-recreate of the `CHECK`, written for both database shapes of 12.4.

**What distinguishes the two branches after the delete is the type of the account
that owns the surviving closure row — not `destination_account_id`.** That column
is an obvious candidate and it is the wrong one: 13.6 nulls every counterparty
pointer aimed at `A`, and on the rows that survive it then merely repeats their
own owner. What is left, and what is durable, is:

```
 surviving closure row owned by a user account     the residual stayed with the owner
 surviving closure row owned by the system account  the residual left the owner's position
```

Reports can therefore recover the **economic meaning** of a closure without
recovering the identity of `A`, which is exactly the separation erasure requires.
It also means the system `account_type` is not model tidiness: without it the
distinction is not queryable at all, which is why 13.13 places it in tier A.

After this step the account's ledger balance is zero, which is the precondition
the governing principle names.

### 13.4 Optional transaction reversal

Reversal stays where it is and is not extended. It does **not** appear in the
destination selector of 13.1, and the reason is not scope:

> The two settlement branches move the owner's money between the owner's
> accounts. Reversal changes the balances of accounts the owner did not choose.
> Offering them at the same level presents "move my money" and "rewrite the
> history of six other accounts" as peers.

Its stated case — *this account should never have existed* — does not need it
either: an account that should not have existed has a residual like any other,
and the owner says where it goes. Reversing its effect on the counterparties is
only correct if *their* movements were also errors, and that is correcting
transactions, not deleting an account.

The capability belongs to a transaction module that does not exist (12.7). Until
it does, if the existing path stays reachable it obeys 13.5 through 13.8 like
every other path — the invariants are not optional for legacy routes.

**One rule the evidence of 13.9 makes necessary: reversal is not the repair for
damage a cascade caused.** The sequence

```
 CASCADE -> discover the drift -> write a compensating entry
```

is designing around the defect, and it cannot work anyway: the compensating entry
would need to know what was destroyed, and what was destroyed was the only record
of itself. The order runs the other way — make the model safe first (13.5), then
delete under control (13.7), and only then reverse anything, explicitly and for
its own reasons.

### 13.5 Referential safety

**The rule is read off the schema, not imposed on it:**

```
 account_id             NOT NULL   "this row belongs to this account"
                                   -> ownership. Cannot be detached.
                                      The row leaves with the account.

 source_account_id      nullable   "who was on the other side"
 destination_account_id nullable   -> identity. Can be detached.
                                      NULL means an account that no longer exists.
```

All three are `ON DELETE CASCADE` today (`003:38-51`, and identically in
`createTables.js:155-161`, which is what actually built production). The two
counterparty columns cascading is the defect: they destroy rows owned by
accounts that survive.

> **Shipped 2026-08-27, recorded 2026-08-30.** All three are `ON DELETE RESTRICT`
> at `003_transactions.sql:39-41`, `:48-50`, `:51-53` and at
> `createTables.js:163`, `:169`, `:170`. The reasoning that follows is what
> produced the change and is unaffected by it.

**All three become `ON DELETE RESTRICT`**, and `RESTRICT` rather than `SET NULL`
on the counterparty pair for one reason: `SET NULL` would produce the right rows
by itself, silently, at `DELETE` time — with no assessment, no description
scrub, no invariant check. `RESTRICT` makes a bare `DELETE` fail, which is the
forcing function every other subsection depends on. The detach becomes a
deliberate `UPDATE` inside the procedure (13.7), not a side effect.

**`RESTRICT` is a guard rail, not the integrity mechanism**, and the distinction
matters when reading this section. Integrity comes from the procedure — settle,
detach, scrub, verify, delete. All `RESTRICT` guarantees is that nobody reaches
the delete without passing through it. Reading it as the fix invites exactly the
mistake of leaving the procedure half-built because the database "already
protects" the rows.

**Verified before adopting `NULL` as the detached value**, 2026-08-26:

| read path | NULL-safe? |
|---|---|
| `AccountTransactionDetailModal.tsx:319,328` | yes — renders conditioned on `!== null` |
| `responseApiTypes.ts:109-110` | yes — both already declared optional |
| `transactionController.js:884,886` | yes — already `LEFT JOIN` |
| `dashboardController.js:960-961` search | harmless — `CAST(NULL AS TEXT) ILIKE` never matches |
| `getAnnulmentImpactReport.js` `dst != src` | **no** — a NULL makes the predicate NULL and the row is dropped from the report without a word |
| `dashboardController.js:576-577` counterparty match | **no** — same failure mode; needs an explicit decision about what a detached row means to that aggregate |

*Anchors re-measured 2026-08-30. Every verdict above still holds; five of the six
locations moved. The modal's two null-guarded renders are at
`AccountTransactionDetailModal.tsx:255` and `:264`; `responseApiTypes.ts:109-110`
is unchanged; the two `LEFT JOIN`s on the counterparty columns are at
`transactionController.js:991` and `:993`; the search branch's casts of those two
columns are at `dashboardController.js:966-967`; the annulment report's unsafe
predicate is at `getAnnulmentImpactReport.js:51`; the dashboard counterparty
match is at `dashboardController.js:582-583`.*

Two predicates to fix, both failing by silence rather than by error. The rest of
the application was already written for the nullable case.

**Three files carry the change, and only one of them moves production:**

| file | governs | moves production? |
|---|---|---|
| `run_time_db_init/createTables.js:155-161` | any database the app boots against for the first time — this is what built production | **no**: its `CREATE TABLE IF NOT EXISTS` is skipped on existing tables |
| `sql_migrations/003_transactions.sql:38-51` | any database built by the chain — the local test bed | no |
| `supabase/001_production_alignment.sql` | the live database | **yes, the only one** |

The chain has never run against production: its migrations ledger is empty with
its sequence at 5, which is why the alignment file exists and why it must not
become migration 018. `003` is still corrected, for a different reason — local
is rebuilt from the chain, and a test bed that cascades while production
restricts is not a test bed.

> **Measurement corrected 2026-08-30 — the ruling in this paragraph was overtaken
> by the work, and the paragraph is kept rather than struck.**
>
> **What it asserts.** The alignment file is the only mechanism that moves
> production, and the change must not become migration `018`.
>
> **What the code says today.** It became migration `018`:
> `backend/src/db/migrations/sql_migrations/018_alter_transactions_account_fks_to_restrict.sql`
> exists and is committed in `699827b`. Its own header gives the reason the
> alignment file could not carry it — a rule declared inside
> `CREATE TABLE IF NOT EXISTS` never fires on an existing table, and a file whose
> name is already in the migration ledger is never executed again. The alignment
> file was still edited, and its foreign-key step is section 8 at
> `supabase/001_production_alignment.sql:527-574`; it is what a fresh database
> gets, not what moved an existing one.
>
> **What now needs a fresh decision.** Nothing about the foreign keys. What is
> not settled by this log is production's alignment state — three documents
> describe it three different ways, and the block naming all three is in
> `on-hold/PLAN_DEPLOYMENT/PLAN_SUPABASE_MIGRATION.md` §1-ter. The "ledger empty,
> sequence at 5" figure above is a database measurement of 2026-08-26 and was not
> re-taken.

The statement, with the constraint names measured on the production clone:

```sql
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_account_id_fkey,
  DROP CONSTRAINT IF EXISTS transactions_source_account_id_fkey,
  DROP CONSTRAINT IF EXISTS transactions_destination_account_id_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES user_accounts(account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT transactions_source_account_id_fkey
    FOREIGN KEY (source_account_id) REFERENCES user_accounts(account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT transactions_destination_account_id_fkey
    FOREIGN KEY (destination_account_id) REFERENCES user_accounts(account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

Idempotent without the `pg_constraint` guard the other steps use: the
`DROP ... IF EXISTS` removes what the previous run added. `ADD CONSTRAINT`
validates the existing rows, which all reference valid accounts. `DOWN` is the
same six with `ON DELETE CASCADE`.

### 13.6 Identity erasure

Nulling the pointer is not erasure. This is a complete row after 13.5, and the
deleted account is still fully reconstructible from it:

```
 account_id             15
 source_account_id      NULL
 description            "Transfer from aseo hogar/esponjas/must (account 31)"
```

`transactions.description` embeds the counterparty's name and id in free text
(`F-10`, section 5.4). That text is a historical account identity kept by
accident rather than by decision, and it contradicts the erasure the hard delete
is for.

**The scrub runs inside the same transaction as the detach**, over the same set
of rows. What survives is the movement — amount, date, direction, movement type.
What goes is which account was on the other side.

**It touches only text FinTrack generated, never text the owner wrote.**
Measured on `fintrack_dev` 2026-08-26: of 94 rows, **88 carry the literal
`Transaction: `**, which separates an optional owner-written prefix from the
generated remainder; the other 6 are annulment rows generated in full. Every
description in the database is machine-separable, and **the account names sit in
the generated half** — `Received 6.49 USD in account "pocket de prueba"`.

The reason the boundary has to be respected rather than ignored is in the same
data: one row reads `20 mil cop para el pocket de prueba.` before its marker.
That is an account name, and the owner typed it. A scrub matching on the name
would rewrite the owner's own note.

So the rule is narrow on purpose:

```
 generated counterparty identity   -> replaced with a neutral label
 owner-authored free text          -> untouched
```

**The consequence is stated rather than hidden:** where the owner has written the
account's name themselves, erasure is incomplete. That is the correct trade.
FinTrack removes the identity it wrote; it does not edit what the owner wrote,
and deleting an account is not a licence to rewrite their notes.

This is also where the contradiction in the 2026-08-26 conceptualisation is
settled rather than designed around. Asking how FinTrack will know that a
preserved transaction belonged to *"Bank A — Chase Checking"* is asking for the
identity that erasure exists to remove. The surviving row renders as
**Deleted account**, and reports read accordingly.

### 13.7 Atomic execution

```
 1  LOCK       the lock set { A, D }                    SELECT ... FOR UPDATE, 13.14
 2  ASSESS     recompute the residual on this client   13.2
 3  COMPARE    the body's echo against it              mismatch -> 409, no write
 4  SETTLE     residual -> the chosen destination      13.3
                the account's ledger balance is now 0
 5  DETACH     source/destination_account_id -> NULL   only WHERE account_id <> A
 6  SCRUB      the deleted account's identity out of those rows' description
 7  DELETE     the account's own rows, then the account row
 8  ASSERT     the three invariants                    13.8
 9  COMMIT     or ROLLBACK on any failed assertion
```

Steps 5 and 6 touch **only rows whose `account_id` is not the target** — rows the
target owns are deleted in step 7, so scrubbing them is wasted work.

The locking pattern already exists in the codebase at
`budgetAllocationService.js:122` (`FOR UPDATE OF ua`). Copy it; do not write a
second one.

**The lock covers `{A, D}` and nothing else, and the boundary is deliberate.**
The counterparties whose rows step 5 detaches are *not* locked: the detach
changes their **rows**, never their **balance**, and the `UPDATE` takes row locks
on exactly the rows it modifies — the correct granularity, acquired
automatically. Pre-locking them would serialise the balances of every
counterparty against every deletion, and §12.11 measured a worst case of 91.
Invariant II can still be asserted over them without a lock, because both sides
of `account_balance = SUM(its own rows)` are read from the same snapshot, so a
concurrent writer that is itself consistent cannot produce a false positive.
13.14 names the four sets this distinction rests on.

The whole procedure runs on one client. The movement path already demonstrates
the boundary (`transactionController.js:487` `BEGIN` -> `:789` `COMMIT`), and the
current deletion service already opens one — what it lacks is steps 2, 3, 5, 6
and 8.

### 13.8 Post-operation invariants

Asserted inside the transaction, before `COMMIT`. Any failure is a `ROLLBACK`,
not a warning.

Three of them are assertions the code makes. The fourth is not an assertion at
all — it is an economic consequence the screen has already stated — and it is
written here because conflating it with the other three is exactly what makes
`SUM(amount) = 0` read as proof that nothing was lost.

**I — the accounting invariant. The global ledger closes.**

`SUM(amount)` over every row is unchanged by the operation. It measures `0.00`
on the real-data copy, and it stayed `0.00` through **both** deletions of 13.9 —
which is precisely why it is necessary and nowhere near sufficient.

*Catches:* a leg written without its counterpart.

**II — the reconciliation invariant. Every surviving account is explained by its
own rows.**

`account_balance = SUM(its own rows)`, for every account that still exists after
step 7.

*Catches:* rows destroyed under an account that keeps its balance. This is the
one nothing protects today — it is neither referential nor accounting integrity,
and no foreign key defends it. Both deletions of 13.9 violated it while
satisfying I.

**III — the authorization invariant. Nothing outside the authorized set moves.**

```
 TRANSFER   authorized = { A, the destination the owner picked }
 DISCARD    authorized = { A, the system account }
```

No account outside that set changes balance, **the destination's balance moves by
exactly the residual `R`**, and **A ends at zero** before step 7 deletes it.

The delta clause came from the developer's review and is a strict strengthening:
the set alone bounds *which* accounts may move, the delta bounds *by how much*.
Without it, an operation that credits the destination twice satisfies the
invariant. 13.14 writes all three as SQL.

*Catches:* an operation reaching accounts the owner never named — which is what
the annulment path does **by design** today, adjusting every counterparty it
finds.

> **Corrected 2026-08-26.** This invariant was first written as *exactly one
> account's balance changed — the destination the owner chose*, which is wrong in
> both branches: a settlement always moves two balances, the account being
> emptied and whatever receives the residual. The authorized-set form is the
> correct one, and it is strictly stronger — it bounds the blast radius instead
> of counting it.

**The economic rule, which is not an invariant.**

```
 TRANSFER   the owner's net position is unchanged
 DISCARD    the owner's net position falls by exactly the residual
```

Both branches satisfy I, II and III. They differ in what happens to the owner's
wealth, and **no invariant can tell them apart, because both are correct.** This
is the distinction 12.14 draws — the settlement preserves the *ledger*, not the
wealth — and it is why 13.1 requires the discard option to read *your position
drops by 2,000.00* on the screen itself. The invariants protect the books. Only
that sentence protects the owner.

Two preconditions before III can be asserted at all: the balance repair of
section 10.5, and the single balance writer of 13.10.

### 13.9 The evidence

Two deletions executed by the developer on `fintrack_dev`, 2026-08-26, through
the existing UI. Predicted to the cent beforehand from the schema and the
service code, then measured. Every figure matched.

**Account 31, a category budget holding 56.99, funded by `banco` in three
transfers.** Deleting it wrote two annulment rows and destroyed seven, **three of
them owned by `banco`** — the three transfers that had funded it. `banco`'s
balance was set to 205.41 while its rows now sum to 262.40: off by 56.99, with
no row anywhere recording that the three deleted rows had existed. The owner was
never asked where the 56.99 should go.

**Account 13, a category budget holding exactly zero.** Deleting it wrote four
annulment rows and destroyed five, **two of them owned by surviving accounts**.
`cuenta precargada`, which reconciled perfectly, ended off by −70.00.

**Why the damage does not surface.** After both deletions the sum of all
transaction amounts is still exactly `0.00`, and the sum of all balances did not
move on the second deletion at all. And `banco`'s drift went from −56.99 to
**+13.01** — not because anything was repaired, but because the second deletion's
error partially cancelled the first. Two deletions, about 127 of damage, a
visible residue of 13.01.

The summary figure:

```
 accumulated drift across the 21 accounts   -28.31
 sum of all account balances                -28.31
```

They are the same number because the rows sum to zero, and **in a closed
double-entry book the sum of every balance is zero by construction.** The -28.31
is therefore drift in its entirety.

> **Corrected 2026-08-26.** This paragraph first read *"the total position the
> system reports is, in its entirety, accumulated corruption"*. That is wrong
> twice. The sum of all balances is not a position anyone reports — it mixes the
> owner's accounts with the boundary account, and it is *supposed* to be zero. And
> the application does not report it: `dashboardController.js` excludes the system
> account from every aggregate, in **46 places**, by matching the literal string
> `'slack'`. Those 46 filters are correct.
>
> *Re-counted 2026-08-30: 41 non-comment occurrences under `backend/src`, 16 of
> them in `dashboardController.js`. Still correct, still a convention.*
>
> The figure that does state the damage to the owner is the one measured with the
> boundary excluded: **the application shows 30.98 where the owner's own rows
> support 87.97.**
>
> The distinction matters well beyond the wording. **Reconciliation and
> classification are different problems.** Every balance can equal the sum of its
> own rows while a report still misreads which accounts represent the owner.
> Invariant II asserts the first. Only the account type fixes the second. Reading
> a classification defect as a balance defect is what produced the sentence this
> note replaces.

**What this evidence establishes, and what it does not.** It is why 13.5 and 13.8
are obligatory rather than advisable: `RESTRICT` would have made both deletions
fail instead of destroy, and invariant II would have rolled both back. It is not
the specification — the specification is 13.1 through 13.8, and it would stand
unchanged if the two deletions had never been run.

One correction it forces on an earlier claim in this plan: the annulment rows
**do** carry a readable description naming the deleted account and explaining the
adjustment (transaction 110 is the example). The trace covers what the system
**wrote**. It does not cover what the system **destroyed**, and the drift is made
entirely of the latter.

### 13.10 The single balance writer

**This is a cross-cutting accounting invariant, not a part of account deletion**,
and it is written here because deletion is what makes it unavoidable: invariant
III cannot name the accounts whose balance changed while three functions can
change one. It alters a premise that holds everywhere in FinTrack —
`account_balance` stops being a figure the caller supplies and becomes a
projection of the ledger. That reaches account creation, movements, transfers,
back-dating, and any future write to `transactions`. It sits in tier B of 13.13;
the boundary is stated so implementation does not try to absorb all of it inside
the deletion service.

Invariant II of 13.8 asserts that a stored balance equals the sum of the rows
that explain it. The assertion is what *guarantees* it. This subsection is what
stops new drift from entering, and it belongs here rather than in a plan of its
own because invariant III cannot be asserted without it: III names the accounts
whose balance changed, and today three different functions can change one.

**The three, measured 2026-08-26. The statement is character-for-character the
same in all three:**

```sql
UPDATE user_accounts SET account_balance=$1, updated_at=$2 WHERE account_id=$3 RETURNING *
```

| # | where | callers |
|---|---|---|
| 1 | `transactionController.js:125-144` | `:606` and `:628` — the two legs of every movement |
| 2 | `accountManagement/updateAccountBalance.js:13-33` | `accountCreationController.js:813` |
| 3 | `accountDeletionUtils/updateAffectedAccountBalance.js:7-61` | `deleteAccountService.js:248` and `:285` |

**Five live call sites in total.** Three further calls are commented out
(`accountCategoryCreationcontroller.js:426`, `accountCreationController.js:282`
and `:1243`). The consolidation is smaller than the defect it removes.

> **Census corrected 2026-08-30 — the consolidation is mostly done, uncommitted,
> and this table is kept rather than struck because the tier and sequencing
> arguments below rest on it.**
>
> **What it asserts.** Three absolute writers, five live call sites, three
> commented-out calls, and a consolidation still to be written.
>
> **What the code says today.**
>
> ```
>  writer 1   GONE. transactionController.js:125-144 now holds getAccountTypes
>             and getTransactionTypes; the file writes no balance of its own.
>  writer 2   FILE DELETED in the working tree
>             (accountManagement/updateAccountBalance.js).
>  writer 3   ALIVE, unchanged in kind. updateAffectedAccountBalance.js:8,
>             statement at :28, absolute and unscoped by user_id. Callers moved
>             to deleteAccountService.js:273 and :311.
>
>  the target shape below EXISTS, untracked:
>             setAccountBalanceFromLedger.js:48, deriving through
>             derivedBalance.js and carrying user_id in its WHERE. Five call
>             sites: transactionController.js:832 and :838,
>             accountCreationController.js:402 and :910,
>             accountCategoryCreationcontroller.js:489.
>
>  the three commented-out calls: two are now live — accountCreationController.js:402
>             and accountCategoryCreationcontroller.js:489 — and the third,
>             createPocketAccount at :1243, has no function left to sit in.
> ```
>
> **What now needs a fresh decision.** This subsection is the plan's unit 2, and
> it is no longer a three-way collapse: what remains is retiring one legacy
> writer on one path. Whether that ships on its own or inside the settlement
> engine is open.

Three defects, and they are of different kinds:

- **Writers 1 and 2 have the same name.** `updateAccountBalance` is exported both
 from `transactionController.js:125` and from the shared utility, and
 `transactionController.js:9` carries a comment listing `updateAccountBalance`
 among its imports while the file defines its own thirty lines below. The
 duplication is invisible at every call site, which is why it survived.
- **None carries `user_id` in its `WHERE`.** A fabricated account id writes the
 balance of any account in the database, including another user's. This is an
 authorization hole, not a tidiness problem, and it is the reason this
 subsection cannot wait for a later plan.
- **All three are absolute, never derived.** Each accepts a balance computed in
 JavaScript by its caller and overwrites the column with it. **That is the route
 every drift takes**: the number written is never checked against the rows it is
 supposed to summarise, so the moment anything else touches those rows — a
 cascade, a failed leg, a double adjustment — the column keeps a figure nothing
 explains. Section 13.9 is that failure measured twice.

**The target shape. One function, and it computes the balance rather than
receiving it:**

```
 setAccountBalanceFromLedger(client, accountId, userId)

   UPDATE user_accounts ua
      SET account_balance = (SELECT COALESCE(SUM(amount),0)
                               FROM transactions
                              WHERE account_id = $1),
          updated_at = CURRENT_TIMESTAMP
    WHERE ua.account_id = $1
      AND ua.user_id   = $2
  RETURNING account_id, account_balance;
```

Four properties, each answering one of the defects above:

- **No caller passes a number.** The signature has no `newBalance` parameter, so
 there is no way to write a balance the rows do not support. Invariant II
 becomes true by construction for every account this function touches.
- **`user_id` is in the `WHERE`**, and a zero-row result is an error, not a
 silent no-op.
- **`updated_at` is `CURRENT_TIMESTAMP`, not the movement's date.** All three
 current writers stamp it from the transaction date, which is wrong and
 harmless only because that date is always `now` today. See the note on
 `PLAN_BACKDATING` below.
- **The empty account is `0.00`, not `NULL`** — `COALESCE` on an account whose
 last row was just deleted.

**The ordering consequence, and it is the only real cost.** The movement path
writes the balance *before* it inserts the rows: `transactionController.js:606`
and `:628` update the two accounts, and `recordTransaction` runs at `:700` and
`:741`. A derived writer computing a sum at `:606` would not see the row that
`:700` is about to insert. **Adopting this function requires the movement path to
insert its rows first and derive afterwards.** That is a reordering inside a
block that already runs in one transaction (`:487` `BEGIN` to `:789` `COMMIT`),
so it is not a new failure mode — but it is a change to the movement path, and
it is stated here rather than discovered during implementation.

*Paid, measured 2026-08-30.* The movement path now inserts first and derives
afterwards: `recordTransaction` at `transactionController.js:780` and `:818`,
then `setAccountBalanceFromLedger` at `:832` and `:838`, all inside `:539`
`BEGIN` -> `:890` `COMMIT`. The same reordering was applied in both creation
controllers.

**What this buys and what it does not.** It stops drift entering through the
writer. It does not detect drift that already exists, and it does not protect an
account the deletion never touches — if a row is destroyed under account X and
nothing calls the writer for X, X drifts and only the assertion of 13.8 catches
it. The two are complementary: this subsection closes the door, invariant II
checks that it stayed closed.

**Empirical support for deriving rather than accumulating.** Before the two
deletions of 13.9, twenty-two of the twenty-three accounts satisfied
`account_balance = SUM(its own rows)` exactly, and the one exception was known
damage. Account openings are written as ordinary rows
(`accountCreationController.js:357-396`, re-measured 2026-08-30), so the opening amount is inside the
sum and there is no starting figure held outside it. The identity holds for
every account type in the catalog.

**Two things to carry into implementation:**

- **An index on `transactions(account_id)`** if one does not exist. The subquery
 runs on every balance write, and at 785 rows it costs nothing — but the write
 path is the wrong place to leave a sequential scan to grow into.
- **These three files are also claimed by `PLAN_BACKDATING` §4.5**, whose first
 commit — `fix(account): untie updated_at from the movement` — drops the same
 parameter from the same three signatures. The `updated_at` fix is a **strict
 subset** of this consolidation.

 **Ownership rule, so neither plan is written as though it were the only owner:
 whichever block reaches these three files first owns them, and the other plan
 records the outcome rather than repeating the work.** Both orders are safe and
 neither is blocking:

 ```
  back-dating first   13.10 inherits three single-parameter functions and
                      collapses them anyway; its updated_at half is already done

  deletion first      PLAN_BACKDATING §4.5 is absorbed and its commit is
                      withdrawn, not re-implemented
 ```

 `PLAN_BACKDATING`'s verification that *`updated_at` is now* survives either
 way, because the single writer of this subsection sets `CURRENT_TIMESTAMP`.

 **This does not gate the start of either block.** The release order of 13.13
 opens with the three foreign keys to `RESTRICT`, which touch none of these
 files; the ownership question is due at step 2, not before.

### 13.11 The code this specification lands on — re-verified 2026-08-26

Three findings come from `on-hold/diagnostic/account_deletion.md`, an earlier
evaluation of the same flow. That file is on-hold, so none of it was taken on
faith: each was re-read against the current source today. **All three still
hold**, and all three are on the path 13.7 rewrites.

**A. Only one of the three deletion paths executes at all.**

`processStandardDelete` (`deleteAccountService.js:371-418`, re-measured
2026-08-30 — all three findings of this subsection still hold) declares
`(dbClient, targetAccountId, deletionType, isAdmin, accountCheck)` — there is no
`userId` parameter. Both of its branches log with `${userId}`, so both raise a
`ReferenceError` in the template literal **before any query runs**. And the call
underneath them,

```
 dbClient.query(queryText, [targetAccountId])
```

supplies one value to a statement that uses `$1` **and** `$2`, so even with the
name in scope it would fail on the bind.

**Hard delete and soft delete have never run. Only `RTA` works.** Two
consequences for this specification, both favourable:

- 13.1's rule that the owner never sees a deletion mode costs nothing to adopt.
 There is no working behaviour behind two of the three modes to preserve.
- The rejection of soft delete rested on `deleted_at` being honoured in only
 three queries — true, and beside the point: the branch that would set it is
 unreachable. Soft delete was never an option that existed.

**B. The permission guard rejects nobody.**

`deleteAccountService.js:483-484`:

```js
 let isAdmin =
   userRole === 'admin' || userRole === 'super_admin' || userRole === 'user'; //override isAdmin
```

Every authenticated role satisfies it, so the `RTA` guard at `:507` and the
hard-delete guard at `:659` are both inert. The comment says the override was
deliberate; nothing says it was ever removed.
*Anchors re-measured 2026-08-30; the override and both inert guards are unchanged.*

Read together with 13.2, deletion has **no server-side authority of any kind
today**: the caller names the account, and the caller supplies the balances that
get written. The `user_id` predicate of 13.10 and the server-side assessment of
13.2 are the two halves that close this, and neither is optional.

**C. The error handler on the deletion path is not imported.**

`checkAndInsertAccount.js:91` calls `handlePostgresError`; line 3 imports only
`createError`. *Both re-verified unchanged 2026-08-30.* `processRTAAnnulment`
calls `checkAndInsertAccount` as its first
action (`deleteAccountService.js:200`), so **any** failure locating or creating
the holding account surfaces as `handlePostgresError is not defined` and the real
cause is lost.

That is exactly the class of failure step 8 of 13.7 exists to surface. An
assertion that rolls back on a masked error tells the developer nothing.

**Nothing in 13.1 through 13.10 is retracted by any of this.** Three items are
added to the scope, all of them repairs to code the new procedure runs through.

### 13.12 What changes, by file

| file | change | subsection |
|---|---|---|
| `createTables.js:155-161` | three FKs -> `RESTRICT` | 13.5 |
| `003_transactions.sql:38-51` | the same, for the chain | 13.5 |
| `supabase/001_production_alignment.sql` | the same, as a new `ALTER` step | 13.5 |
| `populateDB.js:372-395` and the chain | `movement_types` gains `account-closure`, `CHECK` rewritten for both shapes | 13.3 |
| `account_types` | a seventh row for system accounts; the holding account moves to it | 13.3 |
| a new assessment service | the residual query, run on a client | 13.2 |
| `accountDeleteController.js:99-112` | stops trusting `req.body`; the echo becomes a comparison | 13.2 |
| `deleteAccountService.js:184-345` | gains steps 2, 3, 5, 6, 8 of 13.7 | 13.7 |
| `getAnnulmentImpactReport.js` | `dst != src` made NULL-safe; `deleted_at` filter added | 13.5 |
| `transactionController.js:125-144`, `updateAccountBalance.js`, `updateAffectedAccountBalance.js` | three writers collapse into one derived, user-scoped function; five call sites | 13.10 |
| `transactionController.js:606,628,700,741` | rows inserted before the balance is derived | 13.10 |
| `dashboardController.js:576-577` | counterparty match made NULL-safe | 13.5 |
| the deletion page and its UI components | the destination selector replaces the proceed button | 13.1 |
| `deleteAccountService.js:345-390` | `processStandardDelete` takes `userId`; the query is bound with both values | 13.11 |
| `deleteAccountService.js:457` | `isAdmin` stops including `'user'`; the two guards become real | 13.11 |
| `checkAndInsertAccount.js:3` | `handlePostgresError` imported | 13.11 |

> **Anchors re-measured 2026-08-30, and three rows are done.** The table is left
> as written; this note carries the new line numbers and the shipped state.
>
> | row | today |
> | --- | --- |
> | `createTables.js:155-161` -> `RESTRICT` | **done.** `:163`, `:169-170` |
> | `003_transactions.sql:38-51` -> `RESTRICT` | **done.** `:39-41`, `:48-53` |
> | `supabase/001_production_alignment.sql`, new `ALTER` step | **done.** section 8, `:527-574`. The `ALTER` that reached the populated database is migration `018`, not this file |
> | `populateDB.js:372-395` | now `:372-397`; the `CHECK` is at `:397` |
> | `accountDeleteController.js:99-112` | unchanged |
> | `deleteAccountService.js:184-345` | now `:185-418` |
> | `getAnnulmentImpactReport.js` | unsafe predicate at `:51`; still no `deleted_at` filter |
> | `transactionController.js:125-144`, `updateAccountBalance.js`, `updateAffectedAccountBalance.js` | the first two are gone, the third alive at `:8`. See the corrected census in 13.10 |
> | `transactionController.js:606,628,700,741` | **done.** Rows first at `:780`, `:818`; derivation after at `:832`, `:838` |
> | `dashboardController.js:576-577` | now `:582-583` |
> | `deleteAccountService.js:345-390` | now `:371-418` |
> | `deleteAccountService.js:457` | now `:483-484` |
> | `checkAndInsertAccount.js:3` | unchanged; the import is still missing |

**Not added:** `account_deletion_plan`, `account_deletion_events`,
`deleted_accounts`, any settlement table, a revived `transaction_entries`, or
`reverses_transaction_id`. Section 12 gives the reason for each.

### 13.13 Scope — three tiers

This specification touches more of the codebase than the words *account
deletion* suggest, and the real risk is not that it is wrong: it is that it
becomes an accounting-integrity refactor that never ships. Three tiers. The
boundary that matters is between A and B — **A is the capability, B is what
makes the capability safe to run, and both must ship together.** C was found on
the way and gates neither.

**A — the deletion capability**

| # | item | where |
|---|---|---|
| 1 | the destination question, and the screen that states the consequences | 13.1 |
| 2 | server-side assessment, including the residual | 13.2 |
| 3 | settlement — one path, two destinations | 13.3 |
| 4 | `account-closure` as the movement type of the closing entry | 13.3 |
| 5 | the three foreign keys to `RESTRICT` | 13.5 |
| 6 | explicit detach of the counterparty pointers | 13.5, 13.7 |
| 7 | identity scrub of the generated text | 13.6 |
| 8 | locking, and the whole procedure on one client | 13.7 |
| 9 | the hard delete itself | 13.7 |
| 10 | the three invariants asserted before `COMMIT` | 13.8 |

**B — required for A to be safe, not optional**

| # | item | where | why it cannot be deferred |
|---|---|---|---|
| 11 | the three balance writers collapse into one, derived | 13.10 | invariant III cannot name which accounts changed while three functions can change one |
| 12 | `user_id` in the balance `WHERE` | 13.10 | with the authorization override of 13.11, deletion currently has no server-side authority at all |
| 13 | the repair of the drift that already exists | 10.5, `AD-2` | invariant II fails on the first deletion otherwise, on damage this operation did not cause |
| 14 | `processStandardDelete` made reachable, or removed | 13.11 A | two dead branches sitting in the service the procedure rewrites |
| 15 | `isAdmin` stops including `'user'` | 13.11 B | the guards reject nobody today |
| 16 | `handlePostgresError` imported | 13.11 C | a failed assertion that reports the wrong error tells the developer nothing |

**C — found during the work, gates nothing**

| # | item | where |
|---|---|---|
| 17 | the dashboard counterparty predicate made NULL-safe | 13.5, open decision |
| 18 | the annulment report's `dst != src` made NULL-safe, and its missing `deleted_at` filter | 13.5 |
| 19 | the collision with `PLAN_BACKDATING`'s first commit | 13.10 |
| 20 | the runtime initialiser aligned with the chain | 13.5 |

> **Item 21 moved from C to A on 2026-08-26**, and the note that argued for C is
> withdrawn rather than deleted, because the reasoning is instructive. It read:
> *the discard branch works today by looking the holding account up by name, so
> the deletion is correct without it.* True of the **execution**, false of the
> **result**: 13.3 establishes that the only durable way to tell a closure that
> kept the owner's position from one that removed it is the type of the account
> owning the surviving closure row. Without the type, that distinction is
> unrecoverable the moment the delete commits. It is now item 10 of tier A.

**Release order, which is not the migration order.** The two are allowed to
differ, and here they do:

```
 1  RESTRICT on the three foreign keys      containment - stops the damage today
 2  the single derived balance writer       stops new drift entering
 3  the repair of the existing drift        only now is the figure stable
 4  system account type + account-closure   model preparation
 5  the deletion procedure                  13.7
 6  the UI                                  13.1
```

*State measured 2026-08-30: step 1 SHIPPED 2026-08-27 (`7f96a43`, `699827b`).
Step 2 is partly shipped and uncommitted - the derived writer exists and the
movement and creation paths use it; the delete path's absolute writer remains.
The order below is not touched.*

**`RESTRICT` goes first, ahead of the repair**, and this inverts the obvious
order for a reason worth stating: repairing while the three absolute writers are
live and the annulment path is still reachable is repairing into a leaking
bucket — one deletion between step 3 and step 2 re-corrupts it, and afterwards
there is no way to tell which of the two figures was the good one.

That `RESTRICT` breaks the annulment path is not a side effect, it is the point.
It is currently the **only** deletion route that executes (13.11 A) and the one
§13.9 measured corrupting surviving balances. Disabling it on day one is the
containment measure; steps 2 to 6 then proceed with no window in which the same
mechanism can do more damage.

Steps 4 and 5 may be prepared before or after step 3 — neither generates drift.
What may not move is step 1 before everything, and step 3 after step 2.

**The reading rule.** A without B ships a controlled deletion on top of a balance
column anything can overwrite and a guard that stops nobody. B without A repairs
plumbing for a feature that does not exist. C can follow in its own time, and
each item says which decision it is waiting on.

### 13.14 The formal model — four sets, three assertions, one closed inventory

This subsection exists to be turned into integration tests. Everything above is
prose about intent; what follows is the same thing written so it can be run. It
is the gate between a specification that reads as correct and one that is
checked.

**Symbols.** `A` is the account being deleted. `D` is the destination the owner
chose — a user account on the transfer branch, the system account on the discard
branch. `R` is the residual, `SUM(amount)` over the rows `A` owns, measured at
step 2 of 13.7 and held for the rest of the transaction.

#### The four sets

They are not the same set, and conflating any two of them is what produced the
lock-scope error corrected below.

```
 LOCK SET                    { A, D }
   SELECT ... FROM user_accounts WHERE account_id IN (A, D) FOR UPDATE

 OWNED ROW SET               rows that leave with A
   SELECT * FROM transactions WHERE account_id = A

 SURVIVING AFFECTED ROW SET  rows that stay, detached and scrubbed
   SELECT * FROM transactions
    WHERE account_id <> A AND (source_account_id = A OR destination_account_id = A)

 AUTHORIZED BALANCE SET      the only accounts whose balance may move
   { A, D }
```

Three properties worth stating because they are easy to assume wrongly:

- **The lock set and the authorized balance set coincide, and that is not a
 coincidence** — you lock exactly what you are permitted to change. If an
 implementation ever needs to lock more, the authorized set grew and invariant
 III has to be re-derived, not widened quietly.
- **An account can be in the surviving affected row set without being in the lock
 set.** That is the whole of the correction: the detach changes those accounts'
 *rows*, never their *balance*, and the `UPDATE` takes the row locks it needs by
 itself. Pre-locking B, C and D would serialise the balances of every
 counterparty — 91 accounts in the worst case measured in 12.11 — to protect
 something the operation does not touch.
- **`D` may also be in the surviving affected row set**, when the destination the
 owner picked had movements with `A`. Then `D`'s rows are detached *and* `D`'s
 balance moves. Both are authorized; the assertions below hold unchanged.

#### The three assertions

Run on the transaction's own client, immediately before `COMMIT`. Each must be
read as: **this query returns nothing, or the transaction rolls back.**

**I — the global ledger closes.** `sum_before` is taken at step 2.

```sql
SELECT COALESCE(SUM(amount), 0) AS sum_after FROM transactions;
-- fails unless sum_after = sum_before
```

Measured `0.00` on `fintrack_dev`, and it stayed `0.00` through both deletions of
13.9 — which is why this assertion is necessary and nowhere near sufficient.

**II — every surviving account is explained by its own rows.**

```sql
SELECT ua.account_id, ua.account_balance, COALESCE(SUM(t.amount), 0) AS ledger
  FROM user_accounts ua
  LEFT JOIN transactions t ON t.account_id = ua.account_id
 GROUP BY ua.account_id, ua.account_balance
HAVING ua.account_balance <> COALESCE(SUM(t.amount), 0);
-- must return zero rows
```

No lock is needed on the accounts this scans. Both sides of the comparison come
from the same snapshot, so a concurrent writer that is itself consistent cannot
produce a false positive.

**III — only the authorized set moved, and by exactly the residual.** Requires a
balance snapshot taken at step 2; at the scale of this database that is one cheap
read of every account.

```sql
-- III.a  nothing outside the authorized set moved
SELECT ua.account_id
  FROM user_accounts ua
  JOIN balances_before b ON b.account_id = ua.account_id
 WHERE ua.account_balance <> b.account_balance
   AND ua.account_id <> :D;
-- must return zero rows

-- III.b  the destination moved by exactly R
SELECT ua.account_balance - b.account_balance AS delta
  FROM user_accounts ua
  JOIN balances_before b ON b.account_id = ua.account_id
 WHERE ua.account_id = :D;
-- fails unless delta = R

-- III.c  A was at zero before it was deleted
--        asserted at step 6, between the settlement and the delete
SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = :A;
-- fails unless 0
```

`A` needs no exclusion in III.a: by the time it runs, `A` is gone and the join
drops it. III.c is what makes that safe, and it is the assertion that carries the
governing principle.

The `AND that delta must equal R` half of III came from the developer's review on
2026-08-26 and is a strict strengthening: the earlier form bounded *which*
accounts could move, this one also bounds *by how much*.

#### The identity inventory, measured and closed

The boundary of erasure is the application's persisted tables. Backups, logs,
database snapshots and any external system are retention policy with their own
rules and their own clock; a `COMMIT` cannot guarantee anything outside its own
transactional domain, and asking it to is what makes erasure an open-ended task
that never gets declared satisfied.

Measured on `fintrack_dev`, 2026-08-26:

```
 22 base tables in the public schema
  9 foreign keys reference user_accounts directly
```

The nine, with their current `ON DELETE`:

| table.column | on delete | after 13.5 |
|---|---|---|
| `transactions.account_id` | CASCADE | **RESTRICT** |
| `transactions.source_account_id` | CASCADE | **RESTRICT** |
| `transactions.destination_account_id` | CASCADE | **RESTRICT** |
| *the three above, 2026-08-30* | **already RESTRICT** | shipped 2026-08-27, migration `018` |
| `income_source_accounts.account_id` | CASCADE | unchanged — 1:1 extension |
| `category_budget_accounts.account_id` | CASCADE | unchanged |
| `debtor_accounts.account_id` | CASCADE | unchanged |
| `pocket_saving_accounts.account_id` | CASCADE | unchanged |
| `account_name_case_backup_013.account_id` | CASCADE | unchanged |
| `debtor_accounts.selected_account_id` | **SET NULL** | unchanged — already correct |

**`budget_policies` and `budget_policy_allocations` were checked and are covered.**
`budget_policies.account_id` carries a foreign key to `category_budget_accounts`,
not to `user_accounts`, so it reaches the account through the extension table and
cascades with it. The same holds for `budget_monthly_allocations`. Neither is an
unprotected reference, which is what a column named `account_id` with no entry in
the list above would otherwise suggest.

**Account identity in free text lives in exactly two places:**

- `transactions.description` — the counterparty's name and id, embedded by the
 writer. This is what 13.6 scrubs, and only in the generated half.
- `account_name_case_backup_013` — it stores `account_name`, `category_name` and
 `subcategory` as text. It is a chain-only table from migration `013`, holds zero
 rows on `fintrack_dev`, and its `account_id` cascades, so the identity leaves
 with the account. **No scrub is needed there, but it must be re-counted on
 production before the first deletion runs**, since a non-empty table there is
 identity surviving a delete that this specification has not accounted for.

With those two named, the claim becomes finite and checkable:

> Within the application's persisted tables, no identifiable reference to `A`
> remains after the transaction commits.

## 14. Account lifecycle — the closure engine, settled 2026-08-26

This section is the architecture. It was settled in conversation on 2026-08-26,
after the two measured deletions of 13.9 and after contrasting the design against
YNAB, Monarch, Quicken and Actual Budget.

**It supersedes section 13 in six places and leaves the rest of 13 in force.**
The list is in 14.10, and it is exact rather than approximate, so nobody has to
guess which of the two sections a given paragraph obeys.

**What changed, in one sentence.** Section 13 specified a single operation —
remove the account and its rows — because the question it was answering was "how
does a hard delete stop corrupting data". That is the wrong unit. The right unit
is the **account lifecycle**: what an account can become, and by which operations.
Removing the row is one of those operations, and it is the rare one.

---

### 14.1 The domain model

Three states. Two operations. Three settlement policies. They are independent
dimensions, and keeping them independent is the whole point of this section.

```
 STATE
   ACTIVE     the account participates in every operation and every total
   CLOSED     the row and its history survive; the account is out of circulation
   (absent)   the row does not exist
```

**"Deleted" is deliberately not a state.** A deleted account is the *absence* of a
row, not a row carrying a flag. Writing it as a third state invites someone to add
a `deleted` boolean and then to keep querying rows that were supposed to be gone.
The lifecycle has two states that exist and one terminus that does not.

```
 OPERATION
   CLOSE      ACTIVE -> CLOSED    normal, reversible, preserves everything
   DELETE     ACTIVE -> absent    exceptional, irreversible, erasure
   RTA        ACTIVE -> absent    undoes A's economic effect on the accounts
                                   that survive, then erases it
```

```
 SETTLEMENT POLICY — where a residual goes. Shared by all three operations.
   TRANSFER   to one account the owner picks
   DISCARD    to the system account; the owner's position drops
```

**RTA is an operation, not a settlement policy.** This was got wrong once already
and corrected the same day, so the distinction is stated rather than assumed:

> **RTA removes the effects of A's existence. DELETE removes A's existence.**

A settlement moves the money `A` holds **right now**. A reversal undoes the
movements `A` made **in the past**, which returns the counterparties to the
position they held before `A` existed — a strictly larger claim, and one that
generally requires more money than `A` has. 14.13 has the arithmetic.

**The policies belong to CLOSE and DELETE only. RTA takes none**, and that is the
sharpest statement of the difference:

```
              TRANSFER                     DISCARD
 CLOSE        move the money to an         write the money off,
              account, keep the history    keep the history
 DELETE       move the money, erase        write it off, erase the account
              the account
 RTA          -- not applicable --         -- not applicable --
```

RTA never asks where the residual goes because **it has no residual to place**.
Reversing every one of `A`'s movements lands `A` at exactly zero by construction
(14.13), so there is nothing left to send anywhere. A settlement moves wealth that
exists; a reversal removes the entries that produced it.

**The owner is asked two questions of different kinds, and conflating them is the
error to avoid.** DELETE asks *what happens to the money A holds now*. RTA asks
*should the movements A made be undone in the accounts that survive*. The second
is not an answer to the first, which is why RTA must not appear as a third radio
button beside "to another account" and "out of FinTrack".

Today all of this is welded into one route: RTA is the only path that executes,
it always erases, and the owner is never offered anything else.

---

### 14.2 Which operation is the normal one, and why it is CLOSE

Mature products in this category all separate the two, and all make closing the
default for an account with history — YNAB withholds *Delete* entirely once an
account has transactions; Quicken, Monarch and Actual Budget all keep the record
and the movements when an account is closed.

**FinTrack does not copy that policy, and the divergence is deliberate.** Those
products optimise for the historical integrity of the ledger. FinTrack also
honours the owner's claim to have their data removed, which is why DELETE exists
at all. What FinTrack takes from them is the *architecture* — the separation of
closing from erasing — not the policy that erasing should be unavailable.

Stated plainly so it is not mistaken for a market-research conclusion:

> The evidence from mature products argues **against** offering account-level
> hard delete. FinTrack offers it anyway, as a deliberate decision, because the
> owner's claim to erasure is judged to outweigh the historical argument. What
> the evidence does establish is that erasure must not be the *normal* mechanism
> for retiring an account. That is CLOSE.

---

### 14.3 What the owner is asked

Two entry points, never one screen with a mode selector. The owner is choosing an
outcome, not a strategy.

**Close** — the normal path, offered on every active account:

```
 Close "Bank A"
 Current balance                                    2,000.00 USD

 27 movements of its own, and movements with 3 of your accounts.
 All of them stay.

 Where do the 2,000.00 go?

   ( ) To another account          [ pick an account v ]
   ( ) Back where they came from   banco 1,400.00 - nequi 600.00
   ( ) Out of FinTrack             your position drops by 2,000.00

 Bank A stops appearing in your active accounts. Its history stays
 readable, and you can reopen it.

                                                    [ Close account ]
```

**Delete** — offered separately, never as the default button:

```
 Delete "Bank A" permanently

 This removes the account and its 27 movements. It cannot be undone.

 The movements you had with your other 3 accounts stay in them, but
 they will no longer say which account they were with.

 Where do the 2,000.00 go?   [ same three options ]

                                                    [ Delete permanently ]
```

Five rules the screens obey:

- **A zero residual asks nothing.** Consequences and the button, no question.
- **A negative residual asks the same question in the other direction** — which
 account covers the shortfall. The operation is never refused on the sign of the
 balance; refusing leaves the owner unable to retire an account without inventing
 income (the shortfall argument, section 11).
- **"Back where they came from" is offered only when there are counterparties**,
 and it shows the split it is about to write, per account, before the confirm.
- **Preserving the counterparties' history is not a checkbox.** It is an invariant
 of both operations (14.6), stated as a fact.
- **DELETE says what it destroys before the confirmation**, while the choice is
 still the owner's.

Internal names — `RTA`, `HARD`, `SOFT` — never reach the screen.

---

### 14.4 The assessment

Computed **server-side, on the operation's own client**, and never accepted from
the request body. Today the impact report arrives from the browser
(`accountDeleteController.js:100`), which means the client dictates the balances
the server writes. That is the single most serious defect in the current module
and it does not survive into the engine.

Three figures, plus one table when RTA is on offer:

```
 residual        SELECT COALESCE(SUM(amount),0) FROM transactions
                  WHERE account_id = A
 own movements   count of the same set
 counterparties  distinct accounts appearing in source_account_id or
                  destination_account_id on A's rows, or owning a row that
                  points at A

 contribution    per counterparty, the net amount that moved between it
  table           and A - only needed when RTA is offered (14.13)
```

**The residual is derived from the ledger, never read from
`user_accounts.account_balance`.** The two are the same number on a healthy
account and 13.9 is the measurement of them coming apart: `banco` carried a stored
205.41 against rows summing 262.40. Settling against the stored column would move
an amount no row supports — the exact defect this work exists to end, performed by
the operation meant to end it.

The assessment is echoed back to the client and re-computed at execution time;
a mismatch is a `409` and nothing is written (14.5, step 3).

---

### 14.5 The two settlement policies

Both end with the account's ledger balance at zero. Both write ordinary two-leg
movements, so the global ledger keeps summing to what it summed before. Neither
writes a balance the ledger does not support. **CLOSE and DELETE each finish with
one of these two. RTA finishes with neither** — see 14.13.

#### TRANSFER

```
 A            -R
 destination  +R
              ---
              0
```

One two-leg movement. The simplest policy and the default when the owner picks an
account.

#### DISCARD

```
 A               -R
 system account  +R
                 ---
                 0
```

Identical mechanically; it differs only in which account is on the other side.

**What the system account represents.** It is the **boundary of the system**: its
balance is the negative of everything that has ever entered, net of what has left.
An opening credits the new account and debits the boundary; a discard does the
reverse. It carries two roles — the counterparty of money entering, and the
counterparty of an irreversible reduction of the owner's position — and they are
the same concept, so it stays one account. What must remain distinguishable is the
**direction**, and the movement type carries it: `account-opening` inbound,
`account-closure` outbound.

It is the account the code calls `slack` (12.3). What it lacks is structural
identity: it is recognised by its name in six places and its type is `bank`, like
any account of the owner's. The seventh `account_types` row fixes that.

#### RESTORE — withdrawn

A third policy was specified here on 2026-08-26 and **withdrawn the same day**.
It was to return the residual to the counterparties in proportion to what each
contributed. The withdrawal is recorded rather than deleted because the reasoning
is the boundary between the two concepts:

Returning money to a counterparty is not a settlement of `A`'s current position;
it is a partial reversal of `A`'s history, capped at what `A` still holds. That
cap is what gives it away. A settlement is complete by construction — the residual
is exactly what there is to move. A reversal has a target it may be unable to
reach, and the shortfall has to come from somewhere. That "somewhere" is the whole
design question, and it belongs to RTA. See 14.13.

### 14.6 The engine

One procedure, one settlement, two terminal strategies. The steps before the
branch are identical for CLOSE and DELETE, and they are the hard ones.

```
  1  LOCK       lock set of the chosen policy (14.7)  SELECT ... FOR UPDATE
  2  ASSESS     recompute the residual and the        14.4
                 contribution table on this client
  3  VALIDATE   ownership, eligibility, destination,  mismatch -> 409,
                 and the client's echo of step 2       nothing written
  4  SETTLE     apply the chosen policy               14.5
  5  ASSERT     residual(A) = 0                       the governing precondition

  ---- branch ----

  CLOSE
  6c MARK       deleted_at = CURRENT_TIMESTAMP        the column keeps its name

  DELETE
  6d DETACH     source/destination_account_id -> NULL only WHERE account_id <> A
  7d SCRUB      A's identity out of those rows'       generated text only
                 descriptions
  8d DROP       A's own rows, then the A row          in that order - see 14.7
  9d ASSERT     invariant IV                          14.6

  ---- rejoin ----

 10  ASSERT     invariants I, II, III                 14.6
 11  COMMIT     or ROLLBACK on any failed assertion
```

**Why step 5 is not optional on the DELETE path.** A financial event in FinTrack
is two rows in `transactions`, one owned by each side, with nothing linking them.
Deleting `A`'s rows removes one leg of every event `A` took part in. If those rows
do not already sum to zero, the global ledger stops summing to what it summed
before. Settling first is what makes the removal safe, and it is why SETTLE
belongs to the common engine rather than to CLOSE.

**Why steps 6d and 7d skip `A`'s own rows.** They are removed at 8d. Scrubbing a
row that is about to be deleted is wasted work.

**The locking pattern already exists** at `budgetAllocationService.js:122`
(`FOR UPDATE OF ua`). Copy it; do not write a second one.

#### The invariants

Three are common to both operations. One belongs to DELETE alone.

**I — the global ledger closes.** `sum_before` is taken at step 2.

```sql
SELECT COALESCE(SUM(amount), 0) AS sum_after FROM transactions;
-- fails unless sum_after = sum_before
```

Measured `0.00` on `fintrack_dev`, and it stayed `0.00` through both deletions of
13.9 — which is why this assertion is necessary and nowhere near sufficient.

**II — every surviving account is explained by its own rows.**

```sql
SELECT ua.account_id, ua.account_balance, COALESCE(SUM(t.amount), 0) AS ledger
  FROM user_accounts ua
  LEFT JOIN transactions t ON t.account_id = ua.account_id
 GROUP BY ua.account_id, ua.account_balance
HAVING ua.account_balance <> COALESCE(SUM(t.amount), 0);
-- must return zero rows
```

No lock is needed on the accounts this scans: both sides of the comparison come
from the same snapshot, so a concurrent writer that is itself consistent cannot
produce a false positive. Re-measured 2026-08-26, it returns exactly three rows —
`slack` +28.68, `banco` +13.01, `cuenta precargada` -70.00 — the three accounts
the two deletions touched, and the only three of twenty-one that fail. **An
assertion that does not fail on known-broken data is not an assertion.**

**III — only the authorized set moved, and by exactly the residual.**

```
 changed accounts  subset of  authorized(policy)
 and               SUM of the deltas over that set = 0
 and               delta(A) = -R
```

Parameterised by **operation**, not by policy, because RTA genuinely moves the
counterparties' balances while CLOSE and DELETE never do (14.7). Requires a balance snapshot at step 2; at twenty-one accounts
that is one cheap read.

**IV — no surviving text names `A`.** DELETE only.

```sql
SELECT transaction_id FROM transactions
 WHERE description ILIKE '%' || :deleted_account_name || '%'
    OR description ILIKE '%account ' || :A || '%';
-- must return zero rows, modulo the owner-authored exception of 14.9
```

This is the one invariant the database cannot enforce. The three referential ones
are guaranteed by the foreign keys; identity lives in free text, so it has to be
asserted in code.

---

### 14.7 Lock sets, authorized sets, and referential safety

#### The sets, by policy

```
 operation + policy       lock set                     authorized balance set
 CLOSE / DELETE  + T      { A, D }                     { A, D }
 CLOSE / DELETE  + D      { A, S }                     { A, S }
 RTA  (no policy)         { A } u cp(A)                same

 cp(A) = every account holding the opposite leg of a row A owns.

**The system account appears in RTA's set, but as an ordinary counterparty, not as
an absorber.** Every account carries an opening entry whose opposite leg belongs to
the boundary — measured: 24 `account-opening` rows on `fintrack_dev`, netting
zero — so `S` is a member of `cp(A)` for essentially every `A`. It is locked
because reversing that opening moves its balance, exactly as reversing a transfer
moves `banco`'s. No special role, no shortfall.
```

**The lock set and the authorized balance set are always identical, and that is
not a coincidence: you lock exactly what you are permitted to change.** If an
implementation ever needs to lock more, the authorized set grew and invariant III
has to be re-derived, not widened quietly.

This also resolves an apparent contradiction. The DETACH of step 6d touches rows
belonging to counterparties that CLOSE and DELETE do **not** lock — and that is
correct, because the detach changes those accounts' *rows*, never their *balance*,
and the `UPDATE` takes row locks on exactly what it modifies. Under RTA the same
accounts *are* locked, because that operation does move their balances. One
principle, two outcomes, no exception.

Worst case measured in 12.11: 91 counterparties. CLOSE and DELETE never pre-lock
them; RTA does, and that cost is inherent to what RTA promises. **It is also the
strongest practical argument for keeping RTA a separate, rarely-used operation
rather than a policy offered on every deletion screen.**

#### The foreign keys

The three columns of `transactions` that reference `user_accounts` carry
`ON DELETE CASCADE` today, in all three places the schema is declared. They become
`ON DELETE RESTRICT`.

```
 transactions.account_id                 CASCADE -> RESTRICT
 transactions.source_account_id          CASCADE -> RESTRICT
 transactions.destination_account_id     CASCADE -> RESTRICT
```

> **Shipped 2026-08-27, recorded 2026-08-30.** All three read `RESTRICT` in both
> build paths (`003_transactions.sql:39-41`, `:48-50`, `:51-53`;
> `createTables.js:163`, `:169`, `:170`) and in the populated database, through
> migration `018_alter_transactions_account_fks_to_restrict.sql`. Everything the
> rest of this subsection says about what `RESTRICT` does and does not guarantee
> is unaffected and is now describing live behaviour rather than a target.

The other six foreign keys to `user_accounts` are deliberately untouched: they are
1:1 extension tables and their cascade is correct.

**`RESTRICT` is a guard rail, not the integrity mechanism.** Integrity comes from
the engine — settle, assert, then either mark or erase. All `RESTRICT` guarantees
is that nothing reaches a physical delete without passing through it. Reading it
as the fix invites leaving the procedure half-built because the database "already
protects" the rows.

**`RESTRICT` does not block the DELETE path**, and this is worth stating because it
is exactly where an implementation gets stuck. It works because of the order of
step 8d: the counterparty pointers were nulled at 6d, and `A`'s own rows are
dropped before the `A` row itself. By the time `DELETE FROM user_accounts` runs,
no row references `A` in any of the three columns, and the constraint is
satisfied. Invert the two statements of 8d and the database rejects the
transaction — which is the guard rail doing its job.

A consequence worth recording rather than discovering later: with `RESTRICT` in
force, deleting a **user** also fails, because `users` cascades to `user_accounts`
and the account's transactions block it. Whether account deletion and user
deletion share a code path is `AD-6`, still open (14.12).

---

### 14.8 Identity erasure — DELETE only

The boundary of erasure is **the application's persisted tables**. Backups, logs,
database snapshots and any external system are retention policy with their own
rules and their own clock. A `COMMIT` cannot guarantee anything outside its own
transactional domain, and asking it to is what turns erasure into an open-ended
task that never gets declared satisfied.

Measured on `fintrack_dev`, 2026-08-26: **22 base tables, 9 foreign keys
referencing `user_accounts` directly.** `budget_policies` and
`budget_monthly_allocations` were checked and are covered — they reference
`category_budget_accounts`, not `user_accounts`, and reach the account through the
extension table.

Account identity in free text lives in exactly two places:

- `transactions.description` — the counterparty's name and id, embedded by the
 writer. This is what step 7d scrubs.
- `account_name_case_backup_013` — stores `account_name`, `category_name` and
 `subcategory`. Chain-only table from migration `013`, zero rows on `fintrack_dev`,
 and its `account_id` cascades, so the identity leaves with the account. **It must
 be re-counted on production before the first DELETE runs**: a non-empty table
 there is identity surviving an erase this specification has not accounted for.

**The scrub touches only text FinTrack generated, never text the owner wrote.**
Measured on `fintrack_dev`: of 94 rows, **88 carry the literal `Transaction: `**,
which separates an optional owner-written prefix from the generated remainder; the
other 6 are annulment rows generated in full. Every description is
machine-separable, and the account names sit in the generated half.

The boundary has to be respected rather than ignored, and the reason is in the
same data: one row reads `20 mil cop para el pocket de prueba.` **before** its
marker. That is an account name the owner typed. A scrub matching on the name
would rewrite the owner's own note.

```
 generated counterparty identity   -> replaced with a neutral label
 owner-authored free text          -> untouched
```

**The consequence is stated rather than hidden:** where the owner wrote the
account's name themselves, erasure is incomplete. That is the correct trade.
FinTrack removes the identity it wrote; deleting an account is not a licence to
rewrite the owner's notes. Invariant IV is asserted modulo this exception, and the
exception is enumerated at execution time rather than assumed empty.

A surviving detached row renders as **Deleted account**. Asking which account it
was is asking for the identity erasure exists to remove.

---

### 14.9 The CLOSE sweep — the largest piece of work in this block

CLOSE keeps the row in `user_accounts`. Every query that reads that table
therefore has to decide whether a closed account belongs in its result. Measured
on the backend, 2026-08-26:

```
 68  FROM/JOIN user_accounts, across 22 files
  9  filter deleted_at IS NULL
```

*Re-measured 2026-08-30 over `backend/src/**/*.js`:*

```
 75  FROM/JOIN user_accounts, across 21 files
  8  filter deleted_at IS NULL
```

*The eight are `accountUtils.js:41`, `:65`, `:107`;
`accountCategoryCreationcontroller.js:151`; `accountEditController.js:248`;
`deleteAccountService.js:395`; `accountAllocationRepository.js:60`;
`checkAndInsertAccount.js:37`. The sweep grew rather than shrank — the pocket
module added read sites — so the argument below is stronger, not weaker.*

Roughly fifty-nine read paths would show a closed account as though it were
active: selectors, listings, dashboard totals, budget aggregates. **Not all of
them need the filter** — a detail view of a closed account must show it — but each
one needs a decision, recorded per call site.

This is larger than the settlement engine, and it is why CLOSE is sequenced before
DELETE in 14.11: the volume is here, not in the procedure.

The column keeps the name `deleted_at`. Renaming it to `closed_at` was proposed
and declined on 2026-08-26 on the grounds that this block is still definition, not
implementation. **The name is therefore known to be wrong**: it will hold closed
accounts, not deleted ones, because deleted accounts have no row. Revisit at
implementation.

---

### 14.10 What this section supersedes, exactly

```
 13.1  User-facing deletion policy        SUPERSEDED by 14.3
 13.3  Financial treatment                SUPERSEDED by 14.5 - two destinations
                                           become three policies
 13.6  Identity erasure                   SUPERSEDED by 14.8 - now DELETE-only
 13.7  Atomic execution                   SUPERSEDED by 14.6 - the branch
 13.8  Post-operation invariants          SUPERSEDED by 14.6 - invariant IV added,
                                           III parameterised by policy
 13.14 The formal model                   SUPERSEDED by 14.7 - the sets are
                                           per-policy
```

Everything else in section 13 stays in force and is not restated here:

```
 13.2   Pre-deletion assessment           extended by 14.4, not replaced
 13.4   Optional transaction reversal     unchanged
 13.5   Referential safety                unchanged; 14.7 adds the ordering note
 13.9   The evidence                      measurement, unchanged
 13.10  The single balance writer         unchanged and still cross-cutting
 13.11  The code this lands on            unchanged
 13.12  What changes, by file             unchanged
 13.13  Scope - three tiers               release order revised by 14.11
```

Sections 10 and 12 are the measurement everything rests on and are untouched.

---

### 14.11 Release order

Not the migration order. The two are allowed to differ, and here they do.

```
 1  RESTRICT on the three foreign keys      containment - stops the damage today
 2  the single derived balance writer       stops new drift entering
 3  the repair of the existing drift        only now is the figure stable
 4  system account type + account-closure   model preparation, and a hard
                                            prerequisite of step 7 - see 14.15
 5  the settlement engine, TRANSFER and     14.5, 14.6
     DISCARD
 6  CLOSE, and the sweep of 14.9            the normal operation ships
 7  RTA                                     the reversal operation, corrected
 8  DELETE                                  the irreversible one, last
```

*State measured 2026-08-30, order untouched: step 1 SHIPPED 2026-08-27
(`7f96a43`, `699827b`). Step 2 partly shipped and uncommitted — the derived
writer `setAccountBalanceFromLedger.js:48` serves the movement and both creation
paths; the delete path still calls `updateAffectedAccountBalance.js:8`. Steps 3
to 8 not started.*

**`RESTRICT` goes first, ahead of the repair.** This inverts the obvious order for
a reason worth stating: repairing while the current annulment path is still
reachable is repairing into a leaking bucket. One deletion between step 3 and step
2 re-corrupts it, and afterwards there is no way to tell which of the two figures
was the good one.

That `RESTRICT` breaks the current annulment path is not a side effect, it is the
point. It is today the only deletion route that executes, and 13.9 measured it
corrupting the balances of accounts that survived.

**RTA is not deprecated, not removed, and not absorbed.** It keeps its identity
as the fourth operation and is rebuilt at step 7 on the shared engine. What is
removed is its unconditional `DELETE FROM user_accounts`
(`deleteAccountService.js:326`, re-measured 2026-08-30) and the defects of 14.13. The compensating writer
`recordAnnulmentTransaction.js` is reused as it stands.

**Nothing is removed before its replacement works.** The current route stays
reachable until CLOSE ships at step 6, so the module is never left with no way to
retire an account.

---

### 14.12 Open decisions

```
 AD-2   how the existing drift is repaired: one adjusting transaction,
        or freeze and date it. Blocks asserting invariant II. Widened by
        14.14: the drift has two sources and only one is this module, so
        the repair has to name which rows it is answering for.

 AD-6   whether deleting an account and deleting the user share a code
        path. Sharpened by 14.7: with RESTRICT in force, deleting a user
        fails today.

 AD-9   destination eligibility for TRANSFER. Blocks building the
        selector of 14.3.

 AD-10  WITHDRAWN 2026-08-26, the same day it was opened. It asked how to
        present RTA's shortfall to the owner. There is no shortfall: a full
        reversal lands A at zero by construction (14.13). The entry is kept
        as a marker so the question is recognised rather than re-opened.

 --     the dashboard counterparty predicate at dashboardController.js:582-583
        - what a detached row means to that aggregate. (Anchor re-measured
        2026-08-30; the decision itself is untouched.)

 --     whether description stops embedding the counterparty going forward
        (the second half of AD-5). If it does, the scrub of 14.8 shrinks
        to a backfill.
```

None of them blocks step 1.

### 14.13 RTA — the reversal operation

Added 2026-08-26, after RESTORE was withdrawn from 14.5. RTA had been demoted to a
settlement policy earlier the same day and that was wrong; this subsection is the
correction and the reason it matters.

#### What it is

```
 A existed
 A wrote movements against B, C, D
 those movements changed B, C and D's positions
 RTA undoes that change, then erases A
```

The sentence that separates it from everything else in this section:

> **RTA removes the effects of A's existence. DELETE removes A's existence.**

DELETE is careful **not** to touch a surviving account's balance — its only
financial act is settling `A`'s residual to the one destination the owner chose.
RTA's entire purpose is to touch them. They are opposite intentions that happen to
share an ending.

#### The arithmetic, and why the system account is not a bug

Take the real case of 13.9. `banco` funded `aseo hogar/esponjas/must` with 56.99
over three transfers; suppose the transfers had totalled 100.00 and the account
had spent 43.01, leaving the 56.99 it actually held.

**Settlement** moves what `A` holds now:

```
 A       -56.99
 chosen  +56.99
         ------
              0
```

**Reversal** undoes each movement with its opposite pair:

```
 banco   +100.00     back to its position before A existed
 A       -100.00     A gives back everything it received
         -------
               0     the ledger closes
```

And now the point. `A` held 56.99 and has just given back 100.00, so it sits at
**-43.01** — precisely what it consumed on its own. That is not an error in the
reversal; it is the reversal being honest. The money is gone, it was spent, and
returning a counterparty to its prior position cannot conjure it back.

**Somebody has to absorb the 43.01.** The system account is the natural candidate,
because it is the boundary of the system and absorbing is what a boundary does.
That is exactly what `deleteAccountService.js:253-254` reaches for when it debits
`slack` by the total adjustment. *Anchor re-measured 2026-08-30; the expression
now starts from the locked ledger rather than the stored column, and still debits
the boundary by the total adjustment.*

> **Correction of record.** An earlier reading of this file, written and retracted
> on 2026-08-26, called that `slack` debit an arithmetic defect. It is not. It is
> the correct instinct for a reversal, and mistaking it for a bug is what made RTA
> look like a broken settlement instead of a different operation.

#### The three real defects

```
 1  A is never debited
    The counterparty is credited and the boundary is debited, but A's own
    leg is not written. The deltas therefore sum to -R instead of 0, which
    is the mechanism behind the measured +28.68 drift on slack (13.9).

 2  the figures come from the browser
    impactReport arrives in the request body
    (accountDeleteController.js:100). The client dictates the balances the
    server writes. The assessment of 14.4 replaces it, computed on the
    operation's own client.

 3  balances are written absolutely, from the stored column
    deleteAccountService.js:214-216 computes current + adjustment starting
    from user_accounts.account_balance. If that figure was already wrong -
    and 13.9 measured three accounts where it is - the error is carried
    forward and re-signed. Every figure derives from the ledger (13.10).
```

> **Defect 3 corrected 2026-08-30 — half of it is closed.** The expression is now
> at `deleteAccountService.js:239-241` and starts from
> `ledgerBalanceOf(row.affectedAccountId)`, the locked ledger, not from
> `user_accounts.account_balance`. **Defect 1 and defect 2 are unchanged**: the
> target's own leg is still never written, and the adjustment still arrives from
> the browser at `accountDeleteController.js:100`. What remains of defect 3 is
> that the *adjustment* added to the derived base is client-supplied, and that
> the write itself still goes through the absolute, user-unscoped
> `updateAffectedAccountBalance` at `:273` and `:311`.

A fourth behaviour disappears rather than being fixed: the unconditional
`DELETE FROM user_accounts` at `:326`, which under `ON DELETE CASCADE` destroyed
the rows that justify the compensations RTA had just written. *Anchor re-measured
2026-08-30; the statement is unchanged, and the cascade behind it is now
`RESTRICT`, so the same line fails instead of destroying.*

**What survives untouched is the writer.**
`accountDeletionUtils/recordAnnulmentTransaction.js` already emits a correct
two-leg compensating pair on the caller's client. RTA is rebuilt around it, not
in place of it.

#### The corrected procedure

```
  1  LOCK       { A, S } u counterparties(A)          14.7
  2  ASSESS     per-counterparty net contribution,    14.4
                 computed server-side from the ledger
  3  VALIDATE   ownership, the client's echo          mismatch -> 409
  4  REVERSE    for each row A owns, the opposite     both legs, always
                 pair: counterparty +x, A -x
  5  ASSERT     residual(A) = 0                       holds by construction;
                                                       asserted anyway
  6  ERASE      detach, scrub, drop A's rows, drop A  identical to DELETE, 14.6
  7  ASSERT     invariants I, II, III, IV             14.6
  8  COMMIT     or ROLLBACK
```

Steps 7 and 8 are **the same code** as the DELETE path. Steps 4 and 5 are what
only RTA does. That is the shape the architecture was after: a shared ending
reached for different financial reasons.

#### The shortfall is the open question

Step 5 is where the design is not settled. Absorbing 43.01 into the system account
is a **write-off**: the owner's total position drops by that amount, silently,
as a consequence of an operation they asked for in order to *undo* something.

#### There is no shortfall — the two-leg proof

An earlier draft of this subsection, written and **retracted on 2026-08-26**,
claimed that a full reversal generally costs more than `A` holds and that the
system account must absorb the difference. It opened a decision, `AD-10`, on how
to present that write-off. **The claim is false and the decision is withdrawn.**

The error was assuming that what `A` spent had left the system. It had not: a
FinTrack expense credits a **budget category account**, which is a counterparty
like any other. Measured on `fintrack_dev`, the positive legs of `expense` are
owned by category accounts — `transport/public/must`, `verduras/acelga/need` and
so on — never by the boundary.

The general statement, which does not depend on the example:

```
 let A own rows  a1, a2, ... an
 balance(A) = SUM ai                       by invariant II

 every ai has an opposite leg -ai owned by some other account
 reversing all of them writes A: -SUM ai

 balance(A) after = SUM ai - SUM ai = 0    always
```

**`A` lands at exactly zero by construction.** There is no residual left over,
nothing for the boundary to absorb, and no owner-visible write-off to disclose.
`AD-10` was not a domain condition; it was an arithmetic mistake.

The premise the proof rests on — that every row has an opposite leg — is measured
at the aggregate level: on `fintrack_dev` **every movement type nets to exactly
zero on its own** (14.14), not merely in total. A per-row pairing check is not
possible, because nothing links the two legs of an event; that absence is the
schema fact this whole plan is built around (12.1).

#### What each operation does to the owner's net worth

This is the property that separates the operations most cleanly, and it is stated
without a formula so it survives whatever the dashboard eventually computes.

```
 SETTLEMENT   moves a residual that already exists
              -> to another account of the owner's     net worth unchanged
              -> to the system account                 net worth falls by R
              it can never raise it

 RTA          removes entries from the ledger's history
              -> up   by whatever A consumed           that spending is undone
              -> down by whatever entered through      that funding is undone
                      A's opening
              it is the only operation that can move net worth either way
```

Worked on the example the developer posed. `banco` 100 transfers 10 to
`investment`, which then spends 4 on a category:

```
 start                    banco 90   investment 6   groceries 4   net 96

 settle -> banco          banco 96   investment 0   groceries 4   net 96
 settle -> system         banco 90   investment 0   groceries 4   net 90
 RTA                      banco 100  investment 0   groceries 0   net 100
```

**RTA raised net worth by 4 — exactly what the account had spent.** Not a side
effect: it is the operation's meaning. Declaring that `A` never existed declares
that `A`'s spending never happened, and the money comes back from the category
that received it.

The symmetric case is worth stating because it is the one that surprises: an
account opened with a starting amount received it from the boundary. Reversing
that opening returns it, and **net worth falls** by the starting amount. RTA moves
net worth by the net of everything `A`'s existence contributed, in whichever
direction that lands.

> **Only RTA can increase the owner's net worth.** That single sentence is the
> reason it needs its own screen, its own confirmation and its own audit trail,
> and the reason it must never appear as a third destination option beside "to
> another account" and "out of FinTrack".

#### What the boundary account actually costs — corrected 2026-08-26

An earlier version of this passage claimed the dashboard sums the system account
with the owner's real bank accounts and therefore reports 297.05 where the owner
holds 356.34. **That claim was not verified and it is false.**
`dashboardController.js` excludes the system account from every aggregate, by
matching the literal string `'slack'` — 46 occurrences in the backend. The figures
the application reports are right.

The real cost is **fragility, not arithmetic**:

```
 the boundary is identified by a string, in 46 places
 rename the account, or let an owner create one called "slack",
 and all 46 filters silently change meaning with no error anywhere
```

*Re-counted 2026-08-30: **41** non-comment occurrences under `backend/src`, 16 of
them in `dashboardController.js` and 25 elsewhere. The argument is unchanged; only
the number moved.*

There is already a symptom of the design in the code: `dashboardController.js:976`
reads `search === 'slack' ? '' : 'slack'`, a special case that un-excludes the
boundary when the owner happens to search for that word. *Anchor re-measured
2026-08-30.*

The seventh `account_types` row replaces a convention with a structure. It does
not fix a wrong number today; it stops one from appearing the first time the
convention breaks.

#### Where it belongs in the interface

**Not as a third option under "where does the money go".** That question is about
`A`'s current residual; RTA is about `A`'s history. Offering them together asks
the owner to answer two unrelated questions with one radio group.

RTA is its own entry, reached deliberately, phrased as an intention rather than a
mechanism — *undo the effects of this account* — and it is the least-travelled path
in the module. The volume is on CLOSE (14.9).

#### Why it is sequenced last

RTA locks every counterparty (14.7), writes the most rows, has an unsettled design
question, and is irreversible. CLOSE at step 6 of 14.11 already gives the owner a
complete way to retire an account. Nothing waits on RTA, which is why it ships
after everything that does.

### 14.14 The drift has two sources, not one — measured 2026-08-26

Opened by a question from the developer: *`slack` absorbs what enters and leaves
the system from outside, so what are the balances being reconciled against?* The
question is the right one to ask about a boundary account, and answering it
empirically uncovered a second defect that no section of this plan had.

#### The boundary is inside the ledger, so invariant II applies to it

Measured on `fintrack_dev`, every movement type nets to exactly zero on its own,
not merely in aggregate:

```
 movement type      rows   net
 account-opening      24   0.00
 debt                  4   0.00
 expense              38   0.00
 income                4   0.00
 pnl                  10   0.00
 pocket                6   0.00
 transfer              8   0.00
```

**That `account-opening` nets to zero is the proof.** If the system account sat
*outside* the book — if money entering wrote only the receiving account's row —
openings would net to the total that ever entered. They net to zero, so every
boundary crossing writes both legs: one owned by the new account, one owned by the
system account.

The system account is therefore not exempt from invariant II. Its balance must
equal the sum of the rows it owns, exactly like any other account, and it is what
makes the book closed rather than open. Reconciliation needs no external
reference, and there is none to be had.

#### The drift of each account is an identifiable subset of its own rows

```
 account              drift     rows the balance never received
 slack               +28.68     account-opening   2 rows, -28.68
 banco               +13.01     pnl               2 rows, -13.01
 cuenta precargada   -70.00     pnl               1 row,  +70.00
```

Not accumulated noise. In all three cases the drift is **exactly** a subtotal of
the account's own rows: entries that reached the ledger and never reached the
column.

#### Two causes, and only one of them is the deletion path

```
 banco, cuenta precargada   pnl rows - the annulment entries the deletion
                             path wrote. This is the module this plan owns.

 slack                      the two opening legs, transactions 28 and 91,
                             dated 2026-08-14 and 2026-08-19. Predates the
                             deletions of 13.9 by twelve and seven days.
```

```
 28 | -15.92 | src 14 -> dst 24 | 2026-08-14 | bal_after -15.92
 91 | -12.76 | src 14 -> dst 39 | 2026-08-19 | bal_after -15.06
```

**Corrected 2026-08-26, after the developer questioned the claim.** The first
wording read *"the account-creation path writes both ledger legs and updates only
the new account's balance"*, which implies code is missing. Nothing is missing
from the ledger — the opening pairs net to exactly zero — and nothing is missing
from the source either: **the call that posts the funding account's balance is
commented out**, in two of the three creation functions.

```
 createBasicAccount     accountCreationController.js:42    commented at :282
 createDebtorAccount    accountCreationController.js:439   live at :813
 createPocketAccount    accountCreationController.js:926   commented at :1243
```

> **Measurement corrected 2026-08-30 — the premise of this census has ceased to
> exist, and the census is kept rather than struck.**
>
> **What it asserts.** Two of the three creation functions never post the funding
> account's balance because the call is commented out, and that is a live,
> deletion-independent source of drift.
>
> **What the code says today.** Both calls exist, are live, and are guarded:
>
> ```
>  createBasicAccount     accountCreationController.js:50    live at :402,
>                                                            if (isTransfer)
>  createDebtorAccount    accountCreationController.js:460   live at :910
>  category budget        accountCategoryCreationcontroller.js:32
>                                                            live at :489,
>                                                            if (!isAccountOpening)
>  createPocketAccount    NO LONGER EXISTS in that file. Pocket creation moved to
>                         the pocket module and writes no user_accounts row.
> ```
>
> All three live calls are `setAccountBalanceFromLedger`, so the figure is derived
> from the ledger rather than computed in JavaScript, and all three run after the
> movement rows are inserted.
>
> **What now needs a fresh decision.** The sentence below — *it is live,
> independent of deletion, and it drifts the funding account of every bank,
> investment, category or pocket account created with a starting amount* — is no
> longer true of the code. The **historical** drift those unposted openings
> already wrote is untouched by the fix, so the repair unit still has to answer
> for it; what it no longer has to wait behind is a leak on this path. The
> figures below are `fintrack_dev` measurements of 2026-08-26 and were not
> re-taken.

The figure is computed at :246 and stored inside the movement itself, in
`account_balance_after_tr` at :274 — computed, recorded in the row, never posted
to the account. `createDebtorAccount` is the working reference.

The measured data splits exactly along that line:

```
 tx 14/15   Picapiedras, Pedro  +1.80   banco              -1.80   debtor -> posted
 tx 35/36   Palacios, Lucila    +0.11   cuenta precargada  -0.11   debtor -> posted
 tx 27/28   cuenta precargada  +15.92   slack             -15.92   basic  -> not
 tx 90/91   NewCategory        +12.76   slack             -12.76   basic  -> not
```

`slack`: rows -87.97, balance -59.29, difference **+28.68** = exactly
`-15.92 + -12.76`. It is live, independent of deletion, and it drifts the funding
account of every bank, investment, category or pocket account created with a
starting amount.

**Worth recording as a project-level observation:** this is the second defect in
this module traced to commented-out code rather than to written code — the first
being the deletion service's own dead branches. The commit workflow's rule against
commented-out code is not tidiness; here it is the difference between a balance
being posted and not.

The `bal_after` column corroborates it: the second row reports `-15.06` where a
running balance of `-15.92` followed by `-12.76` would give `-28.68`. The cached
running balance is wrong too, and wrong differently.

#### What this corrects, and what it changes

**Corrects.** 13.9 and earlier passages here read as though the drift on
`fintrack_dev` were caused by the two measured deletions. It is not, entirely: of
111.69 of absolute drift, the deletions explain 83.01 and **28.68 predates them**.

**Changes.** `RESTRICT` does not touch the second source — no cascade is involved,
only a leg nobody posts. The single derived balance writer at step 2 of 14.11 is
therefore not hygiene deferred behind containment: **it is the only measure that
stops account creation from injecting new drift**, and it is the reason the repair
at step 3 cannot come before it.

It also widens 13.10 beyond what that subsection claimed. The three absolute
balance writers are the mechanism, but the *callers* now include the account
creation path, not only the deletion path. Every call site is in scope for the
collapse, and the inventory in 13.10 must be re-counted before that commit is
written rather than assumed complete.

*Re-counted 2026-08-30, and the creation half of the collapse is done. The
derived writer holds five call sites — `transactionController.js:832` and `:838`,
`accountCreationController.js:402` and `:910`,
`accountCategoryCreationcontroller.js:489`. Two call sites remain on the absolute
writer, both on the delete path: `deleteAccountService.js:273` and `:311`.*

#### Still to measure

The same breakdown has **not** been run against production. `fintrack_dev` is a
test bed; the figures that matter for `AD-2` are production's, they were last
measured 2026-08-23 on a copy, and a repair computed from a stale measurement
repairs the wrong number. Re-measure before repairing, and re-measure with this
subsection's method — per account, per movement type — rather than as a single
total, because a single total is what hid this second source for three days.

### 14.15 The net worth rule, and the live RTA screen that fails it

Derived 2026-08-26 from a screenshot of the deletion screen as it ships today,
for account 42 `InVestMent`, balance 16.48. It is the first evaluation of this
module against a real interface rather than against the code, and it produced the
rule that governs how a reversal must be presented.

#### What the live screen shows

```
 Target   InVestMent   16.48 usd   RTA Deletion (Annulment with adjustment)

 ACCOUNT             CURRENT    NEW       NET ADJUSTMENT   TYPE
 SLACK                -59.49    -44.26          +15.23     BANK
 INBESTMEN              2.89      2.14           -0.75     INVESTMENT
 CUENTA PRECARGADA    133.49    135.49           +2.00     BANK

 Total Net Adjustment: 16.48 usd
```

#### What it gets right, and it is not trivial

```
 15.23 - 0.75 + 2.00 = 16.48 = balance(A)
```

The adjustments sum to exactly the target's balance. That is the theorem of 14.13
appearing in production data: in a two-leg book, reversing every row `A` owns
credits its counterparties precisely `balance(A)`. **The concept implemented in
the code is a full reversal, and the concept is correct.** What follows are defects
of implementation and of presentation, not of intent.

It also confirms, empirically, that the system account is an ordinary counterparty
of a reversal and not an absorber of any shortfall: `SLACK` appears in the list
receiving back the opening that funded the account.

#### The rule this produced

> **The net worth impact of a reversal is exactly the portion of the account's
> balance whose counterparty is the boundary.** Everything whose counterparty is
> another account of the owner's redistributes and nets to nothing; only the
> boundary portion leaves.

Applied to the case:

```
 1.25 + 15.23 = 16.48

 stays inside     1.25    CUENTA PRECARGADA +2.00, INBESTMEN -0.75
 leaves FinTrack 15.23    SLACK
```

**A falling net worth is the correct result here, not a defect.** Those 15.23 came
into FinTrack from outside through the account's opening; declaring that the
account never existed declares that they never entered, so they leave. The defect
would be failing to show it.

One trap worth recording, because it was got wrong once in conversation: **the
internal counterparties do not cancel against each other.** Here they net `+1.25`,
not zero. They redistribute part of `A`'s balance among the owner's other
accounts; what does not stay inside is exactly what came from outside.

#### The failure is in the screen, not in the aggregate — corrected 2026-08-26

An earlier version of this passage reasoned from the screen's TYPE column, which
shows `SLACK` as `BANK`, that the dashboard sums it with the owner's real banks
and would therefore report the change as:

```
 -16.48 + 15.23 - 0.75 + 2.00 = 0.00
```

**That was inferred, not verified, and it is false.** `dashboardController.js`
excludes the system account from every aggregate by matching the literal
`'slack'`. Excluding it, the reported change is:

```
 -16.48 - 0.75 + 2.00 = -15.23
```

**The aggregate is right. It is this screen that is wrong**, and the defect is
narrower and more fixable than claimed: the deletion screen computes and displays
`Total Net Adjustment: 16.48` — the reversal's magnitude — where the owner needs
the patrimonial effect, `-15.23`. Two different quantities, and the screen shows
the one that is not the answer to any question the owner has.

The lesson is worth keeping: **a defect in classification was read off a TYPE
column and asserted as a defect in a total that was never measured.** The type
column on the screen is real; the conclusion drawn from it was not checked against
the query that actually builds the aggregate.

Three further defects, visible on the same screen:

```
 1  the report starts from the stored column, not the ledger
    new = current + adjustment, computed on account_balance. SLACK's stored
    figure is 28.68 adrift from its own rows (14.14), so the -44.26 it will
    write carries that error forward and re-signs it.

 2  the account most affected is absent from "Affected Accounts"
    The owner watches three accounts move and never sees their own 16.48
    disappear. "Will automatically adjust balances to maintain financial
    consistency" is false twice over: it does not maintain consistency, and
    "automatically" conceals that the owner's position changes.

 3  the internal name reaches the screen
    "RTA Deletion (Annulment with adjustment)" is what 14.3 forbids.
```

`Total Net Adjustment: 16.48`, rendered in green, is the worst line on the screen:
it sums across the boundary and the owner's own accounts, which are different
kinds of quantity, and it reads as a gain at the moment the owner's position falls.

#### The screen the rule implies

```
 InVestMent holds                        16.48

 On reversal:
   stays in your accounts                 1.25
     CUENTA PRECARGADA                   +2.00
     INBESTMEN                           -0.75
   leaves FinTrack                       15.23
     SLACK  (external boundary)

 ──────────────────────────────────────────────
 Your net worth falls by                 15.23
```

One total, and it is the owner's. The sentence beneath it states the cause rather
than the mechanism: *15.23 originally entered FinTrack from outside, and this
reversal removes that entry.*

#### The consequence for sequencing

**The seventh `account_types` row is a hard prerequisite of RTA, not reporting
hygiene.** The assessment must partition counterparties into internal and boundary
to compute the figure at all, and today `SLACK` is typed `bank`, indistinguishable
from `CUENTA PRECARGADA`. Without the type the engine cannot derive `-15.23` even
if the screen were willing to show it.

It already sits in tier A of 13.13 and at step 4 of the release order in 14.11,
ahead of RTA at step 7. That ordering was chosen for a different reason — the
durability of the closure discriminator — and this finding independently requires
the same position. Recorded because two independent reasons for one sequencing
decision is what makes it safe to rely on.

#### Also observed, owned elsewhere

`InVestMent` and `INBESTMEN` are two `investment` accounts whose names differ by
case and one letter. That belongs to `PLAN_ACCOUNT_NAME_UNIQUENESS.md`, not here,
and is noted only so the observation is not lost.

---

### 14.16 The third deletion, executed through the live route and measured 2026-08-26

13.9 measured two deletions. **A third has since run**, on account 42
`InVestMent` — the same account whose assessment screen 14.15 evaluated. It went
through the live RTA route, so for the first time the model can be checked
against a reversal actually written to the ledger rather than against the figures
a screen predicted. Account 42 no longer exists.

#### The six rows it wrote

```
 id   owner              amount    src  dst   description
 136  slack              +15.23     14   14   Correction in slack
 137  slack              -15.23     14   14   Counterpart Adjustment
 138  inBestMen           -0.75     17   14   Correction in inBestMen
 139  slack               +0.75     17   14   Counterpart Adjustment
 140  cuenta precargada   +2.00     14   24   Correction in cuenta precargada
 141  slack               -2.00     14   24   Counterpart Adjustment
```

Three pairs. The magnitudes are exactly the ones 14.15 predicted from the screen,
so the assessment arithmetic is right. **What is written is not.**

#### The defect, stated exactly

Every pair puts the **system account** on the counterpart side. It should put the
**target** there. For each counterparty `c` the engine writes:

```
 written        c: +net(c)   and   S: -net(c)
 correct        c: +net(c)   and   A: -net(c)
```

Two consequences follow, and the second is the serious one.

**The target never receives a reversal leg.** `A` is about to be dropped, so the
code skips writing rows it would immediately delete. That is why the ledger still
closes at 0.00: each pair nets zero on its own, and `A`'s original rows left with
`A`. But it means the reversal never demonstrates that `A` reached zero — the
assertion of 14.13's theorem is never actually performed against written rows.

**When the counterparty is the boundary, the pair lands on the boundary twice.**
Rows 136 and 137 are `slack` on both sides of one pair, `src = dst = 14`. The
15.23 the screen promised to return is written and cancelled in the same
statement. The net movement of `slack` across all six rows is `-1.25`, not the
`+15.23` the screen displayed.

**So the operation that exists to remove money that entered from outside removes
none of it.** 14.15 argued the screen would report a falling net worth as flat;
the measurement is worse than that — the ledger does not move it either.

#### State of the database after it

```
 20 accounts        16 reconcile against their own rows        4 do not

 14  slack                stored  -75.97   ledger  -90.22   drift  +14.25
 15  banco                stored   93.47   ledger   81.46   drift  +12.01
 17  inBestMen            stored    2.14   ledger    1.39   drift   +0.75
 24  cuenta precargada    stored  135.49   ledger  207.49   drift  -72.00

 global ledger sum                   0.00     invariant I still holds
 owner excluding the boundary      stored 30.98   ledger 90.22
```

`inBestMen` is newly broken, by exactly the 0.75 of this operation. `cuenta
precargada` worsened by exactly the 2.00 of row 140 — **the reversal row was
written to the ledger and the balance was never posted**, which is the same
commented-out-writer failure as 14.14 appearing on a second path.

Honest limit on attribution: other activity ran against `fintrack_dev` between
measurements — rows 142 and 143 are an ordinary lend/borrow — and `banco` moved
by more than these six rows explain. **Only the three counterparties named in the
reversal are attributed to it here.** The rest is not claimed.

#### What this fixes in the plan

Three things, all of them precision rather than architecture:

```
 the unit of reversal is the counterparty, not the row and not the event
 the counterpart leg belongs to A, and the boundary is an ordinary counterparty
 the reversal legs of surviving counterparties must persist, or II breaks
```

#### The pairing rule, measured

The plan needed to state how a counterparty is discovered, since there is no
event identifier — `transaction_entries` is still commented out at
`003_transactions.sql:65-81` (anchor re-measured 2026-08-30; still commented out).
Measured over all 115 rows:

```
 49 rows   source_account_id names another account        sum +1268.63
 49 rows   destination_account_id names another account   sum -1268.63
 17 rows   neither column names another account           15 of them amount 0.00
```

**Every row resolves exactly one counterparty, or none — never two.** The
counterparty is therefore a projection of the row, not a join, and no pair
discovery is needed at all. The 17 are the self-referencing openings of 14.x and
the one self-cancelling pair above; they sum to zero per account, which is
assertable.


---

## Corrections of record — 2026-08-30

Measurements only. **No decision was closed, deleted or reworded**, no work unit
was reordered, and every withdrawn or retracted claim recorded on an earlier date
is left exactly as it was written. Verified against the working tree of
`fix/auth-screen`, HEAD `e919a89`, uncommitted changes included. No database was
queried.

### Corrected in place

| § | what was corrected |
| --- | --- |
| 1 | the four `deleteAccountService.js` anchors: soft at `:395`, hard at `:384`, the RTA function at `:185-362`, the header comment at `:9` |
| 1.1 | the three foreign keys read `RESTRICT`, not `CASCADE`; new anchors in both build paths, and migration `018` named |
| 2.1 | sixteen dashboard exclusions, not seventeen — one is commented out at `:691`; every line number relisted; 41 sites in total rather than 23 |
| 5.3 | the migration this subsection asks for shipped 2026-08-27 |
| 8, 12.12, 13.10 | the opening-balance write is at `accountCreationController.js:357-396`; `isTransfer` at `:161` |
| 10.3 | the RTA balance inputs now derive from the locked ledger at `:239-241` and `:253-254`; the double write to the boundary survives at `:273-277` and `:311-315` |
| 11.5 | the counterparty columns are nullable at `003_transactions.sql:48-53`; `account_id` is `NOT NULL` at `:39` |
| 12.1 | the commented-out entries table is at `003_transactions.sql:65-81`; `recordTransaction` is called at `transactionController.js:780` and `:818`; `createTables.js` declares thirteen entries of which ten are live |
| 12.2, 13.14 | the three `transactions` foreign keys now read `RESTRICT` |
| 12.3 | 25 sites outside `dashboardController.js` carry the `'slack'` literal, not six; the two `accountUtils.js` anchors are unchanged |
| 12.4, 13.12 | the initialiser's `CHECK` moved to `populateDB.js:397` |
| 12.5 | `updateAccountBalance.js` is deleted; the connection-first helper is now `setAccountBalanceFromLedger.js:48`; the transaction boundary is `transactionController.js:539-890` |
| 12.6 | `getAnnulmentImpactReport.js` runs on `pool` at `:92`; both of its defects re-verified present, the unsafe predicate at `:51` |
| 12.7 | the RTA function is `:185-362`; the affected-account base is now ledger-derived; the pre-loop `finalSlackBalance` is at `:225` and `:253-254` |
| 12.9 | migration 1 of the four shipped; the writer to reuse is the derived one |
| 12.13 | a bare `DELETE` now fails on the foreign key, where the table said it succeeds and destroys |
| 13.5 | five of the six NULL-safety anchors moved; all six verdicts still hold |
| 13.11 | `processStandardDelete` at `:371-418`, the `isAdmin` override at `:483-484`, its two inert guards at `:507` and `:659`, `checkAndInsertAccount` called at `:200`; all three findings re-verified |
| 13.12 | the whole by-file table re-anchored, with three rows marked done |
| 13.13, 14.11 | release-order state annotated: step 1 shipped, step 2 partly shipped and uncommitted. The order itself is untouched |
| 14.7 | the foreign-key change shipped |
| 14.9 | the CLOSE sweep re-measured: 75 read sites across 21 files, 8 filters |
| 14.12 | the dashboard counterparty predicate is at `dashboardController.js:582-583` |
| 14.13 | the boundary debit is at `:253-254`; defect 3 half closed; the unconditional `DELETE` at `:326`; the `'slack'` count re-taken; the search special case at `:976` |
| 13.9, 14.16 | the `'slack'` count, and the entries-table anchor |

### Marked, not struck — a premise that has ceased to exist

| § | the premise, and what replaced it |
| --- | --- |
| 12.8 and 13.10 | **three absolute balance writers.** Two remain, and one of those two is the derived replacement. `transactionController.js:125-144` holds no writer, `updateAccountBalance.js` is deleted, `updateAffectedAccountBalance.js:8` survives on the delete path with two callers, and `setAccountBalanceFromLedger.js:48` is live with five |
| 12.10 | **there is no pocket allocation table.** Migration `020_create_pocket_tables.sql` creates `pocket_allocations` at `:143`, and the pocket module around it is written. The eligibility check can be a lookup; whether it should be is undecided |
| 13.5 | **the change must not become migration `018`.** It did, and that migration's own header gives the two reasons the alignment file could not carry it |
| 14.14 | **the balance post is commented out in two of the three creation functions.** Both calls are live and derived, at `accountCreationController.js:402` and `accountCategoryCreationcontroller.js:489`; `createPocketAccount` no longer exists. The historical drift those openings wrote is untouched by the fix |

### Verified true and left alone

`budgetAllocationService.js:122` (`FOR UPDATE OF ua`); `recordTransaction.js:23`;
`accountUtils.js:63` and `:106`; `responseApiTypes.ts:109-110`;
`accountDeleteController.js:99-112` and `:100`; `checkAndInsertAccount.js:91` and
its missing import at line 3; `002_accounts.sql:178-179` (`ON DELETE SET NULL`);
`001_initial_migration.sql:35-38`; `populateDB.js:246-251`, the six user-facing
account types.

### Not re-measurable here

Every figure taken against `fintrack_dev`, `fintrack_rehearsal` or
`fintrack_prod_data`: the three executed deletions and all their row-level
evidence, the drift totals of §2.2, §10 and §14.14, the 22 base tables and 9
foreign keys of §13.14 and §14.8, the 95-of-100 cascade measurement of §12.11,
the eighteen-table count of §12.10, the description census of §13.6 and §14.8,
the zero row count of `account_name_case_backup_013`, the movement-type nets of
§14.14, and the six rows of §14.16. These are dated measurements, not claims
about today, and re-taking them needs a database this pass did not touch.
