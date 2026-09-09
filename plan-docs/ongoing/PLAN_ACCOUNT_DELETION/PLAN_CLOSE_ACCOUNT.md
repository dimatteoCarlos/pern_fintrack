# PLAN — CLOSE, the only account deletion method

Written on 2026-09-07 on branch `feat/deletion`. It replaces the four documents
that used to live in this folder — the old plan, the specification written that
same morning, the method redirector and the research log — all annulled by the
owner on that date. They are recoverable from history and none of them is
consulted.

Everything this document asserts about the code is measured on `feat/deletion`
on 2026-09-07. Where a statement is a proposal rather than a measurement, it
says so.

Per the owner's standing rule, no bare identifier stands alone in this document:
every migration, table and function is named by what it does, with its filename
in parentheses when the file has to be found.

The twenty-four findings this work produced are beside this file, in
`DELETION_FINDINGS.md`. They were kept in session memory until 2026-09-09 and
the owner moved them here so they outlive a session. This document is the
specification and wins wherever the two disagree; a finding is the measurement
that produced a rule, not the rule itself.

---

## 0. Status

**This is work in progress and nothing is decided yet.** The owner said so in
those words. The rulings recorded below are working positions taken so the
design can advance; they can still move.

| Block | State |
|---|---|
| Method conceptualization | received, evaluated, accepted with three measured collisions |
| Matrix by account type | settled: six types close, one never does, one no longer exists |
| Historical identity design | the registry, ruled by the migration session; its extension half reversed by the owner on 2026-09-07 |
| Schema | **written and merged** on 2026-09-08 (`035_create_account_registry.sql`); applied to no production database. The suspension that held it there was lifted on 2026-09-08 — see below |
| Historical identity contract | **closed by the owner on 2026-09-08** — fourteen columns, 4.6 |
| Implementation spec | written against the closed contract, section 7 |
| Close operation | **written and merged** on 2026-09-08, all three blocks |
| Frontend | **written and merged** on 2026-09-08 by this session, not by the design session |
| Exercised against a database | **no**, and section 0.1 says what that costs |

---

## 0.1 Amendment of 2026-09-08 — what moved after this plan was written

Everything below is measured on `main` after the merges of 2026-09-08. Where
this section and the body of the plan disagree, this section is the later
measurement and the body is the earlier design.

### The historical identity table is called `account_registry`

Not the name used in the body of section 4. Its creation, its trigger, its
backfill and the seven keys it repoints all live in one file
(`035_create_account_registry.sql`).

**The column holding when the account was created is `account_created_at`, not
`created_at`.** The rename exists so the registry's own row-creation instant
and the account's are not two columns a reader has to tell apart by position.

### CLOSE deletes the row, and the marking `UPDATE` is retired

The statement that set `closed_at` and `deleted_at` on `user_accounts` is
commented out rather than removed, per the owner's standing rule. It existed
because deleting the row was refused by foreign keys, never because marking was
the intent. What the account leaves behind is the registry row.

### Both settlement policies are retired, and so is the release gate

`DISCARD` and `TRANSFER` are gone from the service, from the controller and
from the two read endpoints. **CLOSE does not settle, transfer, discard or
reverse anything: it refuses any balance that is not zero.** The three request
fields that drove the settlement — the policy, the destination account and the
residual the owner had been shown — are read by nobody. A request that still
sends them is ignored rather than refused, because the frontend deploys
separately from the backend.

The transfer-destination list is still queried by nothing: the preview returns
`destinations: []` and `destinationCount: 0`, keys kept so a consumer reads an
empty list instead of `undefined`.

### `close_reason` is mandatory, and the schema is what makes it so

`chk_close_reason_accompanies_closure` refuses a closure stamp with no reason
and refuses one made only of whitespace. The service therefore raises a 400
naming the field, before it takes its lock, rather than surfacing a constraint
name. The frontend collects it in a required field for the same reason.

### The registry's trigger writes two columns, not fourteen

Measured, and it corrects an assumption anything reading the registry could
otherwise make. The trigger (`fn_register_account_identity`) and the backfill
both insert `(account_id, user_id)` and nothing else. **Every other column on
an open account's registry row is NULL**, and is written only at closure, by
the upsert inside the close.

Consequence for any reader: an account's name, type, currency, starting amount
and start date must be resolved as `COALESCE(user_accounts.x, registry.x)`,
never off the registry alone. Reading the registry directly would blank the
identity of every open account in the application.

### The account identity builder exists, and the seventeen sites do not use it yet

`accountIdentityCte` in
`backend/src/utils/fintrackUtils/accountDataRetrieval/accountIdentity.js`
returns a common table expression named `account_identity`, driven from the
registry with `user_accounts` left-joined onto it, every identity column a
`COALESCE` as above, plus `is_closed` derived as `user_accounts.account_id IS
NULL`.

It is a CTE rather than a scalar expression for one reason: the query that
builds a transaction row reaches its account with an INNER join, so a closed
account's row is dropped by the `FROM` before any expression in the `SELECT`
could run. The substitution has to happen at the source.

`account_id` and `account_starting_amount` keep their names exactly, so the
shared balance builder (`derivedAccountBalanceSql`) works against the CTE with
no change to it and no change to any caller's arithmetic.

**Seventeen references to `user_accounts` under `overview_services/` still have
to be decided query by query** — measured as seventeen in SQL out of
twenty-four textual occurrences, the other seven being comments. Six of them
lose the row entirely; eleven use the account as a driving table, where a
closed account is the subject of the answer rather than an attribute of a
transaction. Two of those carry an explicit exclusion of the compensation
account type and one monthly leg deliberately keeps a side with no name, so a
mechanical repoint would move figures without raising anything.

**A query that used to get its exclusion free from the join now has to state
it.** Where a reader relied on a closed account simply vanishing from a `JOIN
user_accounts`, the CTE returns it and the reader needs `AND NOT
ai.is_closed`.

### The frontend exists

A close dialog, its hook and its types are merged. It reads the close preview
before it offers the button, because the balance decides whether the close is
accepted and the owner cannot see that balance from the menu they arrived
through; a nonzero balance disables the confirm and names the routes that do
accept one. It collects the closing reason as a required field.

`CLOSE` is deliberately not part of the frontend's standard-deletion union:
widening it would let the hook for the reversible deactivation and the erasure
be instantiated with `CLOSE` and send a request carrying no reason.

### None of it has been exercised

**The schema is applied and the operation is still unproven.** The migration
session applied `035_create_account_registry.sql` to `fintrack_dev` and to
`fintrack_prod_rehearsal` on 2026-09-08, production untouched — their
measurement, not this session's. So the sentence this paragraph carried until
that day, that no database had it, is retired.

What has never happened is a close. `scripts/verifyClose.js` reached
`fintrack_dev` on 2026-09-08 and stopped before exercising anything, for a
reason worth recording: **no account of a closing type sits at zero there**,
which is the ordinary state of a database in use — an account at zero is an
account nobody uses. The probe now creates its own subject inside the
transaction rather than skipping, and a skip that reported nothing and looked
like a pass is what it did before.

**The probe refuses any database it cannot confirm is a named local one.** The
target is decided entirely by `DATABASE_URI`, and `dbEnvironmentConfig.js`
gives `development` and `production` byte-identical bodies, so no configuration
the script can read tells a local copy from the live database. It asks the
server instead and requires all three: the database is the one named with
`--expect`, the server is on a loopback address, the connection is
unencrypted. Three arms rather than a name check, because a managed database
can be called anything.

### Two things measured elsewhere that the close depends on

Both are the migration session's measurements of 2026-09-08, recorded here as
preconditions rather than as work.

- **A second run of the production alignment undoes three of `035`'s seven
  repoints.** `transactions_account_id_fkey`,
  `transactions_source_account_id_fkey` and
  `transactions_destination_account_id_fkey` return to `user_accounts`, and
  nothing in the output says so. That state is worse for this module than no
  `035` at all, because it looks applied: `account_registry` exists, the
  ledger records the migration, the backfill rows are there, and the delete
  this module performs would be refused by `RESTRICT` on three keys while
  every signal the code can read says the repoint happened. `db:align` now
  refuses when the ledger already carries the alignment row.
- **`fintrack_dev` is not a model of production's schema.**
  `budget_policies`, `budget_policy_allocations` and `budget_frequency_types`
  exist there and on no production-shaped database, because it ran migration
  `010` before the commit that removed their `CREATE TABLE` statements. The
  close deletes `category_budget_accounts` rows, so **"verified on
  `fintrack_dev`" is not "verified against production's schema" for anything
  in the budget domain.**

### The Overview sites were taken by the Overview session

On 2026-09-08 the five statements that build Overview's account-id arrays were
moved onto `account_identity`, the shared builder, and two statements that
reached an account through an inner join — the transaction row shape and the
contribution history — were made outer. Their measurement: the id sets are
identical to the statements they replace, and no closed account exists on
`fintrack_dev` yet, so it is a no-op there today. The handoff recorded in this
section on the day it was written is therefore closed.

### Ownership moved on 2026-09-08

- **Everything to do with migrations and the database belongs to the backdating
  session**, by the owner's instruction. A migration this module turns out to
  need is taken there rather than written here.
- **The order of the remaining work is this session's to choose**, by the
  owner's instruction of the same day. Ordering is no longer put to him.

### A fifth reference survives into `user_accounts`, and the close cascades it

Found by the migration-chain session on 2026-09-08, verified here against the
file. Section 4 of the registry migration says the only references left on
`user_accounts` after the repoint are the four extension primary keys. There
are five. The case-normalization backup table
(`013_normalize_category_budget_name_case.sql`, line 24) declares its
`account_id` as a primary key referencing `user_accounts` `ON DELETE CASCADE`.

**The count is wrong and the conclusion is not:** it cascades, so the account
row stays deletable and nothing about the close breaks.

What it does mean, and it belongs to this module rather than to the migration:
closing a category budget account deletes its backup row with it, so migration
013's reverse step stops being real for that account. Accepted rather than
worked around. That migration performed a one-time lowercasing of names, and an
account whose name no longer exists has no original capitalization worth
restoring.

### The screen offers one method

On 2026-09-08 the owner ruled, looking at the deletion screen, that only CLOSE
is contemplated there. Four things on it said otherwise: the page title, the
action line on the account card, a section headed "Other deletion methods", and
three buttons. `CLOSE_IS_THE_ONLY_METHOD` in
`frontend/src/fintrack/editionAndDeletion/config/deletionMethodPolicy.ts`
decides it now.

**A flag, not deleted markup.** The RTA annulment, the reversible deactivation
and the erasure are reachable services with their own routes; only their entry
point on that screen is withdrawn, and turning it back on is one edit.

Two consequences had to be handled rather than left. The account card named the
RTA annulment unconditionally and now takes the action from a prop. And the
page still requested the impact report, where a failed request sets an error
the page reads as a finished operation — which would have replaced the close
screen with an error view for an operation nobody started; the hook takes
`isReportWanted` and skips the fetch.

**An account holding a balance briefly had no path from that screen**, because
CLOSE refuses one and the annulment that settles it was no longer offered. The
owner ruled the same day: the annulment returns for exactly that case and
disappears again once the balance is zero.

The condition reads the close preview, not `user_accounts.account_balance` —
the preview returns the figure the engine derives its own refusal from, and the
stored column is a different number. A loading or a failed preview leaves the
annulment hidden: a preview that has not answered is not evidence of a balance,
and guessing would flash a section in and out of the page while the request is
in flight. The page owns `useCloseAccount` for this reason and passes the
result to the dialog, so the preview is fetched once rather than twice.

### The closure movement type has readers and no writer

Measured in the files on 2026-09-08.

- **The writer exists and is retired.**
  `recordClosureSettlement.js` holds a live `INSERT INTO transactions` at
  `:235` carrying movement type 10, and no caller: every import of it is
  commented out (`deleteAccountService.js:35` and `:1000`). Its header records
  the retirement, made the day CLOSE stopped moving money.
- **Two live predicates still read that type.**
  `overviewInvestmentRepository.js:148` reads it as the investment card's
  closure adjustment, and `:153` folds it in beside the profit-and-loss type
  for the realised figure. The constant is `ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID`
  at `derivedBalance.js:61`.
- **The migration session measured zero rows carrying it** on `fintrack_dev`,
  `fintrack_prod_rehearsal` and `fintrack_prod_rehearsal_full` — their
  measurement, recorded as theirs. Production was not read.

**Overview settled its half on 2026-09-08 and both predicates stay.** Their
measurement, and it corrects the reasoning this section first carried: sixteen
rows on `fintrack_dev` carry the RTA annulment prefix and **every one of them
is movement type 9, not 10**, so the closure adjustment the investment card
publishes is produced entirely by its second arm today. The retired type is not
what keeps the column alive. What it still does is account for rows written
before the settlement was retired — and a zero on one database says nothing
about another's.

The two arms are not interchangeable, which is why keeping both is correct
rather than merely careful: a prefixed row is an annulment carrying the
profit-and-loss type, and a type-10 row was a settlement carrying no prefix.
Neither predicate finds the other's rows.

**A correction to how this section first put it.** The predicate compares an
integer and never joins `movement_types`, so removing the catalog row would not
break the query. What would refuse the removal is the foreign key, if any
type-10 transaction exists; where none does, the removal changes nothing in the
card. So the row's protection is referential, not a matter of a live predicate
losing its catalog entry.

**What is left for the owner is the catalog row itself**, and it belongs to the
migration session, which will write nothing touching it until he decides.

### Ruled by the owner on 2026-09-08

He approved every recommendation put to him in one answer. What each one means
and where it landed:

| Decision | Ruling | Where it lives |
|---|---|---|
| An account with a balance had no path from the close screen | the annulment returns while the balance is not zero | built, above |
| Exercising the close against a database | authorised | **still blocked** — see below |
| A maximum length for the closing reason | cap it in the schema, not in the form | the migration session's, unwritten |
| Telling the owner the budget goes with the account | say it before he confirms | built, on the close dialog |
| Whether a closed account appears in pickers and in history | history yes, pickers no | **needs no code** — see below |
| Migration 032's account-closure catalog row | leave it | nothing to do |
| Lifting the migration suspension | not yet | **superseded the same day** — see below |

**THE SUSPENSION IS LIFTED, AND IT CHANGES WHEN CLOSE CAN WORK IN
PRODUCTION.** Recorded by the migration session at `f175ed3f`, whose message
states that the owner lifted it on 2026-09-08 and that it is a change of
permission rather than of method. This session did not hear that from the owner
directly and does not record it as an instruction to itself; it records what
the commit says, and the commit is in `main`.

Why it matters to this module, and it is not a detail. The close makes three
writes, and the first of them is an `INSERT INTO account_registry`
(`deleteAccountService.js:1226`). On a database that has not run the chain
there is no such relation, so that statement raises `42P01` and the whole close
transaction rolls back. **CLOSE cannot work in production at all until the
chain runs there** — not partially, not with degraded history: the operation
fails outright. Every measurement in this plan was made against `fintrack_dev`
or the rehearsal, and none of it describes what production does today.

The run itself is the migration session's and none of its conditions are
relaxed by the lifting: through `db:align` and `db:migrate` and never `psql`,
`DB_EXPECTED` and `DB_REMOTE_OK` typed explicitly, `db:state` captured before
and after. Nothing in this module runs it or may run it.

### Fourteen queries wait on the production chain run

Two modules break the same promise for the same reason and are unblocked by the
same event. Recording it once here, at Overview's request, rather than in two
documents each naming its own half.

**The promise.** The close dialog tells the owner that the history stays and
that every movement naming the account remains readable. The registry stamp is
what makes that true in the DATA. It is not what makes it true on SCREEN.

**Where it is broken.** `dashboardController.js` carries nine INNER joins onto
`user_accounts` and no LEFT JOIN anywhere in the file. They come in two shapes
and they lose different rows:

| Shape | Sites | What leaves the answer |
|---|---|---|
| joined on the counterparty (`destination_account_id` / `source_account_id`) | `:588`, `:648` | other accounts' movements where the closed one was the counterparty |
| joined on the row's owner (`tr.account_id = ua.account_id`) | `:718`, `:742`, `:788`, `:826`, `:855`, `:968`, `:1091` | **the closed account's own movements** |

The owner shape is the one that contradicts the dialog. `transactions.account_id`
still holds the id after a close, and this is measured in the code rather than
inferred from the foreign key being repointed: `processCloseAccount` performs no
write to `transactions` at all. Its body contains no `INSERT`, `UPDATE` or
`DELETE` against that table, and none of the three helpers it awaits
(`lockAndDeriveBalances`, `pocketAllocationService.release`, `writeAllocation`)
writes to it either. Every writer of `transactions` in the backend belongs to the
annulment (`eraseAccountTail.js`, `recordAnnulmentTransaction.js`), to ordinary
movements (`recordTransaction.js`), or to `recordClosureSettlement.js`, whose
only call site is commented out at `deleteAccountService.js:282`. So the rows
survive with their id and the join is what removes them.

**The fix exists and cannot be applied yet.** `accountIdentityCte` in
`utils/fintrackUtils/accountDataRetrieval/accountIdentity.js` LEFT JOINs
`user_accounts` onto `account_registry`, COALESCEs the name, type, currency and
start date off the registry row, and derives `is_closed` from the join being
null. Its own header states the precondition: on a database without
`account_registry` it fails with `relation "account_registry" does not exist`.

`overviewAccountRepository.js` already embeds it in five statements (`:44`,
`:88`, `:191`, `:221`, `:255`), so Overview breaks whole rather than partially
against such a database.

**Nine plus five is fourteen queries behind one file.** The event is narrower
than "the chain runs": production sits at `030` with 31 ledger rows as of
2026-09-06, so what is pending is `031` through `036` — six files, one
`db:migrate`, and `035_create_account_registry.sql` is the one these fourteen
queries actually need. Measured by the migration session and recorded at
`ad014691`. The figure that circulated as nineteen is the rehearsal's and is
twenty: a rehearsal copy starts from the 2026-08-21 dump and runs `013` plus
`018` through `036`. Corrected by the migration session at `f1130b11` and
checked here against the directory: `036_cap_close_reason_length.sql` exists and
is the twentieth.

**And the run is not scheduled by anyone here.** The owner lifted the suspension
on 2026-09-08 and stated in the same breath that he authorizes each production
migration individually (`02e74d16`, condition 4 of section 5.B of
`db-migration-procedure.md`). That section names what does not constitute the
authorization: the lift itself, a previous run having been approved, and a peer
session relaying that he said yes. Nothing in this module may treat the lift as
a date.

**A second condition, in his own words, relayed by the Overview session on
2026-09-08.** Asked again about production he answered: "si pero bajo mi
autorizacion no quiero migrar a produccion si todavia hay codigo que completar y
decisiones abiertas". That is a hold on a different axis from approval of the
files: open code or open decisions are reason enough to wait even where he would
sign off on `031` through `036` themselves. This module has open decisions - the
reversal route on the screen, the divider token, whether frames 02, 03 and 10 are
built - so the condition binds here and not only on the migration session.

Recorded as relayed, and nothing in this plan is reasoned on top of it until he
has stated it here directly. Its one immediate effect is on the section below:
the feature flag stops being a way of shipping early and becomes the only shape
the change can take, because the event it waits on is now conditioned on this
module's own open decisions closing.

Until that file is applied:

- `dashboardController.js` must NOT be moved onto the CTE. Today it omits rows
  for closed accounts, of which production has none, because CLOSE cannot run
  there at all — `deleteAccountService.js:1226` raises `42P01` on the missing
  table. After a premature swap it would fail outright, and the dashboard is a
  wider surface than one operation.
- The ordering is the owner's to set. Raised 2026-09-08, not answered.

**WRITTEN, OFF, 2026-09-08.** The owner authorised the fix ("Arreglar las
catorce consultas: autorizado") and the constraint above forbids applying it, so
it is written behind a flag that defaults to off, which is what `CLAUDE.md`
prescribes for exactly this: "Use feature flags to isolate new functionality".

- **The switch is `INCLUDE_CLOSED_ACCOUNTS`**, read once at import in
  `closedAccountReads.js`. Absent or anything but `true` renders the identical
  SQL the file rendered before, so the deploy is inert on a `030` database.
- **The replacement is a derived table, not the CTE**, and that choice is what
  keeps the change to one line per query. A CTE has to be declared before the
  SELECT that uses it, so nine joins would have meant eighteen edit points
  inside template literals; `accountIdentitySource` substitutes for the table
  NAME alone, so the alias `ua` and every `ua.` reference after it survive
  untouched. `accountIdentityCte` is now built from the same body and its output
  is unchanged for Overview's five statements.
- **The subquery had to select `user_id`.** Eight of the nine queries filter
  `WHERE ua.user_id = $1`, and the CTE only ever filtered on that column without
  publishing it. Selecting it is additive and cannot affect a consumer that does
  not read it.
- **Two of the nine needed a second change, and this is the part a count of
  joins does not show.** `dashboardController.js:760` joins
  `pocket_saving_accounts` and `:807` joins `debtor_accounts`, both INNER, and
  CLOSE deletes the extension row with the account. Widening only the account
  source would have found the closed account and then dropped it again for
  having no extension row. Both take `ACCOUNT_EXTENSION_JOIN`, which is `JOIN`
  off and `LEFT JOIN` on. The consequence for the consumer: a closed pocket
  arrives with `target` and `desired_date` NULL, which is the correct answer -
  the plan those columns describe ended with the account - and a shape the
  screen did not previously receive.
- **The flip is a step after `035`, not a date.** Turning it on against a
  database below `035` fails loudly on the first dashboard request with
  `relation "account_registry" does not exist`, never silently with an empty
  result.
- **Overview's five statements are untouched** and need no flag: they already
  read `accountIdentityCte` and carry the same precondition.

**The closing reason is capped in the database, not in the form.** A limit that
lives only in the interface is not honoured by a second writer, and the column
is what every writer meets. The length itself is the migration session's to
choose; nothing here proposes one.

**The picker decision is already the behaviour, by construction.** Every
account list roots in `user_accounts` — `accountUtils.js:44`, `:134`, `:176`
and `getAccountDataById.js:55` — and CLOSE deletes that row, so a closed
account leaves every picker with no filter written anywhere. What puts it back
into history is the `account_identity` builder. There is nothing to implement
and nothing to guard; the risk it names would only appear if some future list
were rebuilt on the registry without stating `AND NOT ai.is_closed`.

**The close has still never been executed.** The owner authorised the run and
the session's own permission layer refused it, so the authorisation given in
conversation does not reach the process that runs it. That is a settings matter
on his side, and it is not routed through any other session: another session
running it would be that permission decision bypassed rather than met.

### Still open, and the owner rules

- **The closing reason's maximum length — RULED, and reassigned.** It is
  stored as unbounded text, supplied by the client, and nothing between the
  request and the column caps it. The owner ruled on 2026-09-08 that the cap
  belongs in the schema rather than in the form, for the reason the frontend
  field was left uncapped in the first place: a limit the schema does not
  enforce is one a second writer does not honour. The constraint and its
  length belong to the migration session.

### Left as measured, not repaired

- **Two verification scripts call the close with the pre-retirement argument
  list** (`verifyCloseAccount.js`, `verifyCloseTransfer.js`). They pass a
  settlement policy where the account row now goes, so they were already
  unrunnable before the settlement was retired. Recorded rather than fixed:
  repairing them means deciding what they should assert about a close that no
  longer settles, which is a rewrite rather than a signature change.

---

## 1. The owner's decision

- **One method only.** The module is rebuilt from the conceptualization and only
  the closing method, called CLOSE, is implemented.
- **A closed account is a deleted row in the accounts table.** He said this after
  being shown the cost. The motive is to keep no dead entities in the tables.
- **Explicitly out of scope:** the reversal engine, the hard delete and the
  reversible deactivation.
- **Migrations stay frozen** until every procedure and its implications are
  defined. A ruling on shape does not lift that freeze.
- **No code is deleted:** whatever stops being used is commented out.

---

## 2. What CLOSE is

**CLOSE is a terminal operation that physically deletes an account row and its
extension row, leaves every transaction intact, and records that the account
existed and was closed.** On the four types that hold money it first refuses
unless the balance is already zero; on the income source the owner waived that
condition (5.1).

Four negations that bound the scope as much as the sentence above:

- **It moves no money.** No transfer, no settlement, no compensation. Where the
  zero condition applies, a non-zero balance is refused rather than settled.
- **It reverts and modifies no transaction.** Neither the account's own nor the
  counterparty's.
- **It writes no transaction of its own.** Closing is a lifecycle fact, not an
  accounting fact.
- **It is not reversible.** A mistaken close is not undone; that is what
  deactivation would be for, and deactivation is not part of this plan.

### Why it is not the hard delete that already exists

Both delete the account row, and both let the cascade take the extension row.
The difference is countable and it is in one table: **after a hard delete the
transactions table has fewer rows; after a close it has exactly the same rows.**
The current hard delete runs a delete over the account's own transactions before
deleting the account (`eraseAccountTail.js`). CLOSE touches none.

That is why this plan never calls CLOSE a hard delete: in this codebase that
phrase already names the operation that does the opposite to history.

---

## 3. What blocks deleting the row today — measured

**No account is deletable today, not even one created a second ago.** This is
not a property of accounts with history; it is structural.

### 3.1 Six references, not five

| From | Column | On delete | What it means |
|---|---|---|---|
| `transactions` | `account_id` (not null) | restrict | which account the row belongs to |
| `transactions` | `source_account_id` | restrict | transfer origin |
| `transactions` | `destination_account_id` | restrict | transfer destination |
| `transactions` | `opening_for_account_id` | restrict | which account this row opens |
| `pocket_allocations` | `source_account_id` (not null) | restrict | which account backs an allocation |
| `debtor_accounts` | `selected_account_id` | **set null** | the bank account tied to a debtor |

The first five refuse the delete; any one of them is enough. The sixth does not
refuse — it silently blanks itself, and section 3.4 is about why that is worse.

### 3.2 Every account is born with a row that references it twice

`accountCreationController.js` writes the opening row in two places and
`accountCategoryCreationcontroller.js` in one. In that row the account appears
both as the transaction's owner and as the account being opened, so it occupies
two of the restricting references above. **There is therefore no such thing as an
account with no transactions.**

### 3.3 The detail tables cascade, and that is what CLOSE needs them to do

The four one-to-one extension tables — income source, budget account, debtor
and pocket saving (`002_accounts.sql`, at lines 122, 140, 165 and 191) — each
declare their primary key as a reference to the account **with cascade**. The
budget account's is the exact form of all four:

```sql
account_id INT PRIMARY KEY
  REFERENCES user_accounts(account_id)
  ON DELETE CASCADE,
```

These four are not among the six references that block the delete in 3.1. They
never refused anything; they follow it.

**The cascade is the only thing that touches those tables at all.** No
`DELETE FROM category_budget_accounts` or any of its three siblings exists
anywhere in `backend/src`, and the erasure tail does not write to them either
(`eraseAccountTail.js` touches transactions, pocket allocations and the accounts
table only). The pocket module's migration already measured this cascade against
real data and recorded what it removed (`020_create_pocket_tables.sql`).

**The owner ruled on 2026-09-07 that this is the behaviour CLOSE wants** —
*cuando se borra hay tambien que eliminarla de esta otra tabla, buscando no por
nombre sino por id*. The cascade matches the ruling exactly: it deletes the
extension row by the account id, in the same statement as the account, with no
name matching anywhere. So this plan writes no code and no migration for those
four tables; it leaves them alone. Section 4.3 records the design change that
follows.

### 3.4 A snapshot column already exists, and it is already wrong

`002_accounts.sql:179-182` declares the debtor's selected account with a
reference that blanks on delete, and immediately beside it the same account's
**name copied into a text column**. That name is written at creation
(`accountCreationController.js`, the debtor insert), read out to the client
(`getAccountController.js:826`) and interpolated into the opening transaction's
description (`accountCreationController.js:842`). It has no maintenance path: a
rename leaves it stale, and a delete blanks the id while leaving the name
standing.

It is a live, rendered instance of exactly the pattern the owner declined for
transactions. **Repointing that reference at the registry stops the blanking**,
since nothing is ever deleted there; the staleness on rename is a separate defect
that this plan neither fixes nor owns.
### 3.5 Closing a budget account fires two cascades, not one

**Measured after the owner's ruling, and it is the largest unstated consequence
in this plan.** The cascade out of `category_budget_accounts` is not the end of
the chain. `budget_monthly_allocations` declares

```sql
account_id           INTEGER       NOT NULL
 REFERENCES category_budget_accounts(account_id) ON DELETE CASCADE,
```

so deleting one `user_accounts` row of type `category_budget` removes the
extension row **and every monthly budget allocation ever recorded against that
account** — one row per month, the whole history, in the same statement, with
nothing on screen.

**The declaration exists in all three build paths**, which is why no schema
comparison would report it: `010_create_budget_tables.sql:43` in the migration
chain, `supabase/001_production_alignment.sql:402` in the production alignment
file, and `createTables.js:407` in the runtime table builder. There is no third
level — nothing anywhere references `budget_monthly_allocations`.

**Preserving those rows would preserve nothing, and that is the part worth
knowing before anyone proposes a seventh repointed key.** Three independent
removals already take a closed budget account out of every set that would ask
for its allocations, and any one of them is sufficient:

- The account id list is rooted in the accounts table.
  `EXPENSE_ACCOUNT_IDS_QUERY` at `overviewAccountRepository.js:32-39` selects
  `ua.account_id FROM user_accounts ua JOIN account_types act` where the type is
  `category_budget`, so a deleted row never enters the list.
- The budget totals inner-join the extension table.
  `budgetTransactionRepository.js:132-133` reads
  `FROM user_accounts ua JOIN category_budget_accounts cba ON cba.account_id =
  ua.account_id`, so the first cascade alone drops the account.
- The allocation cascade measured above.

So the second cascade deletes rows that were already unreadable. **It is a
factually correct finding with no observable effect on its own**, and this plan
records it that way rather than as something to act on.

**What does have an observable effect is upstream and is not this plan's to
fix.** `getAllocationForMonth` (`budgetAllocationRepository.js:46-58`) resolves a
month's budget live every time — `WHERE account_id = $1 AND budget_month <= $2
ORDER BY budget_month DESC LIMIT 1` — so a settled month's figure is recomputed
from whatever exists at the moment it is asked for. Closing a budget account
therefore lowers the budget reported for **every past month**, and no ordering
inside the close prevents it, because the cause is where the reading query is
rooted rather than what the close deletes. The Overview session owns it and has
it open with the owner.

**The owner ruled this outcome on 2026-09-07, after being shown the two
cascades:** *category_budget tiene un presupuesto asociado, asi que con su
borrado, se borra el budget asociado a ella*. So both cascades are intended and
neither key is repointed.

**Stated plainly so this plan promises nothing it cannot keep: CLOSE preserves
every transaction, and it does not preserve budget figures.** Historical budget
amounts for a closed budget account are gone by his ruling, and historical budget
amounts for every other account are recomputed rather than stored, which is the
upstream defect above and is not his ruling.


---

### 3.6 The category name is not lost, and the reason is in the account name

**The owner asked the right question on 2026-09-07** — *el nombre de la
categoria, `category_budget_accounts.category_name`: no, entonces como podemos
resolver esto? no borrando la cuenta de user_accounts? es decir no sobreviven al
borrado, ni el budget, ni los datos de la cuenta borrada, y el budget no esta
dentro de las transacciones.* The premise is exact: that column dies with the
cascade, and no transaction row carries it. **The answer is that the name is
stored twice, and the copy that survives is the one on `user_accounts`.**

**The account name IS the category, composed at creation.**
`accountCategoryCreationcontroller.js:80-83`:

```js
const account_name =
  account_type_name === 'category_budget'
    ? `${category_name}/${subcategory}/${nature_type_name_req}`
    : req.body.name;
```

The three parts come from `:74-76`, each `.trim().toLowerCase()`, and `:326`
inserts the very same `category_name` variable into `category_budget_accounts`.
**So `cba.category_name` is a copy of the first segment of `ua.account_name`, not
an independent fact.** The close stamps `account_name` on the registry row before
deleting, so `food/restaurants/must` survives the account, and the category, the
subcategory and the nature survive inside it.

**The frontend already reads the category out of the composite rather than out of
the extension table.** `newCategoryHelper.ts:26-33` declares
`parseCategoryAccountName(fullName)`, which splits on `/` and returns
`{ category, subcategory, nature }`, with a branch for a legacy two-part name.
That function is what turns a stored account name back into the three fields the
user typed, and it needs nothing from `category_budget_accounts`.

**The one transaction-level reader that names a category already falls back to
it.** `dashboardMonthlyTotalAmountByType.js:121` selects
`COALESCE(cba.category_name, ua.account_name) AS name` over a `LEFT JOIN
category_budget_accounts cba ON tr.account_id = cba.account_id` at `:132`. When
the extension row is gone the left join yields null and the composite name is
used — the query degrades to the surviving copy on its own, with no change.

**What genuinely does not survive is budget data, which is what the owner ruled
should not survive:** `budget`, `original_budget` and the six FX columns on
`category_budget_accounts`, plus every row of `budget_monthly_allocations`
through the second cascade. Nothing there is a name.

| Field on the closed budget account | Survives the close? | Where |
|---|---|---|
| category name | yes | first segment of the stamped `account_name` |
| subcategory | yes | second segment of the same |
| nature type, as text | yes | third segment of the same |
| `category_nature_type_id`, as an id | no | the catalog key is not stamped; the name is |
| `budget`, `original_budget`, the FX pair | no | ruled by the owner |
| monthly budget history | no | ruled by the owner, second cascade (3.5) |

**One pre-existing weakness, not created by the close and not fixed by it.** The
composite is split on `/` and the creation path normalizes the typed name with
nothing more than `.trim().toLowerCase()` at `:74`; no rejection of a `/` inside
it was found in that path. A category typed as `food/drink` therefore produces a
four-part name that `parseCategoryAccountName` reads as category `food`,
subcategory `drink`. That is already true of every open budget account today, is
owned by the account creation path, and is recorded here only because the close
makes the composite the last remaining copy.

---

### 3.7 The retroactive lowering, and the fix the owner asked for

**The owner asked for a fix on 2026-09-07** — *cerrar una categoria hoy baja el
presupuesto de todos los meses anteriores, y la desviacion de un mes ya cerrado
cambia a posteriori, sin que nadie toque ese mes, hay que arreglarlo,
sugerencias y propuestas?*

#### The measurement: three removals, and both sides of the deviation fall

Closing a `category_budget` account takes it out of every past month through
**three independent mechanisms, any one of which is sufficient**:

- **The id set never names it.** `getBudgetAccountsStatus` builds `accountIds`
  from `getOwnedBudgetAccounts` (`budgetController.js:43-46`), which calls
  `getAccountsByType(userId, 'category_budget')`. That query
  (`accountUtils.js:167-188`) reads `FROM user_accounts ua` and inner-joins
  `category_budget_accounts cba`, so a deleted account cannot appear in it.
- **The account detail query inner-joins the extension table.**
  `ACCOUNTS_QUERY` at `budgetTransactionRepository.js:132-133`.
- **The allocation rows are gone.** `budget_monthly_allocations.account_id`
  cascades from `category_budget_accounts`
  (`010_create_budget_tables.sql:42-43`).

**And it is not only the budget side that falls.** `SERIES_QUERY` at
`budgetTransactionRepository.js:317` and `SPENT_BY_MONTH_QUERY` at `:353` both
filter on `t.account_id = ANY($1)` — the same id array. So a closed category
loses its budget *and* its spending from every elapsed month, and the month's
deviation moves by the difference between the two. It only stays put if the
category happened to land exactly on budget.

#### What the system's own rule is, measured rather than assumed

**A settled month is not immutable in this codebase, and that is deliberate.**
`budgetAllocationService.js:222` refuses a write only when `month >
currentMonth`, and `:231` only when the month precedes the account's start
month. **Writing a budget into an elapsed month is explicitly permitted.** The
carry-forward comment at `010_create_budget_tables.sql:25-29` is built on the
same idea: a row rules from its month onward until a later row replaces it.

So the requirement is not "freeze the past". The owner stated the real one
himself — *sin que nadie toque ese mes*. **A month may change when the owner
decides to change it, and must not change as a side effect of an action that was
about something else.** Closing an account in September is not a decision about
March.

#### This supersedes a recommendation recorded earlier in this plan

Section 3.5 argues that preserving `budget_monthly_allocations` rows past the
close *buys nothing*, because the three readers listed above already miss the
account. **That argument was conditional on the readers staying as they are, and
the owner's request removes the condition.** The rows would be unread only
because nothing asks for them; he is now asking for them. Recorded as a
supersession rather than edited away, because the measurement in 3.5 is still
correct and only its conclusion is not.

#### The four candidate fixes

| # | Fix | What it satisfies | What it costs | Recommendation |
|---|---|---|---|---|
| 1 | Repoint `budget_monthly_allocations.account_id` at the registry, write a terminating zero at closure, and let the budget readers include closed accounts for elapsed months | the requirement exactly, and keeps the ruling that the account row is deleted | a seventh repointed key in three build paths, plus a past-month branch in two readers | **recommended** |
| 2 | Copy the account's allocation series into a closure snapshot table at closure | the same result | the same reader work plus a second store for one fact, which can drift from the first | no |
| 3 | Freeze every elapsed month into a settled-month snapshot, read instead of recomputed | far more than asked | a new subsystem, and it would also freeze the retroactive budget edit the code deliberately allows | no |
| 4 | Change nothing; warn on the close screen | nothing; it only tells the user the past will move | one line of copy | fallback only if 1 is deferred |

#### RULED: fix 1, by the owner, 2026-09-08

**The owner closed this on 2026-09-08** — *de las cuatro opciones de 3.7, yo
cerraria Fix 1* — and stated the rule the fix has to satisfy in his own words:
*un cierre en septiembre no puede alterar el resultado historico de marzo*, which
he narrowed himself so it cannot be misread as freezing the past: *una accion
sobre la cuenta en septiembre no puede modificar retrospectivamente marzo*. He
names what this is: **a temporality defect, not an acceptable consequence of
CLOSE.**

What the ruling commits to, in the five steps he wrote out:

1. `budget_monthly_allocations.account_id` references the registry.
2. The allocation rows survive CLOSE.
3. CLOSE writes a terminating zero for the current month.
4. The budget readers can find a closed category for elapsed months.
5. From the closing month onward the series ends at zero.

**A second ruling in the same message settles the question 3.8 left open** —
whether the history of a closed account must stay correct in elapsed months: *si:
el historico de una cuenta cerrada debe seguir siendo correcto en los meses
transcurridos.* The resolution rule he wrote for the twelve Overview reads and
`ledgerBody`:

```text
open account   -> read identity and stock from user_accounts
closed account -> read historical identity from the registry
                  read the surviving movements unchanged
```

**He also ruled what that is NOT:** *no hay que reconstruir la historia
modificando transactions*, and *A no significa simplemente cambiar 13 JOINs* —
because 3.8.3 measured four distinct mechanisms and only one of them is a join.
It means introducing one historical population and letting the reads that need
the past see it. The contract for that population is 4.6, which he ordered
written before section 7.

#### Fix 1, in detail

- **The terminating zero, which is required by any design that keeps the rows
  and not only by this one.** `getAllocationForMonth`
  (`budgetAllocationRepository.js:46-58`) resolves a month as the last row at or
  before it — `WHERE account_id = $1 AND budget_month <= $2 ORDER BY budget_month
  DESC LIMIT 1`. **Carry-forward has no end**, so a closed category whose rows
  survive keeps publishing its final budget into every future month, forever.
  Before the delete, CLOSE writes one `budget_monthly_allocations` row for the
  **current** month with `budget_amount = 0`. That is the mechanism the schema
  already documents: *the only way to express "no budget from month M" is a
  positive marker, and zero is the only one available*
  (`010_create_budget_tables.sql:25-29`), and `CHECK (budget_amount >= 0)` at
  `:45` admits it. (Stated as design-independent by the Overview session;
  verified here.)
- **The key.** `account_id INTEGER NOT NULL REFERENCES
  category_budget_accounts(account_id) ON DELETE CASCADE` at
  `010_create_budget_tables.sql:42-43` becomes a reference to the registry.
  Declared in three build paths, not one — the same file,
  `supabase/001_production_alignment.sql:402` and `createTables.js:407`.
- **The readers.** Two need a past-month branch: the id set at
  `accountUtils.js:167-188` and `ACCOUNTS_QUERY` at
  `budgetTransactionRepository.js:132-133`. `SERIES_QUERY` and
  `SPENT_BY_MONTH_QUERY` need no change at all — they filter on the id array
  they are handed, so a wider array is all they require.
- **The display fields resolve without the extension table**, which is what
  makes this affordable: `ACCOUNTS_QUERY` needs `category_name`, `subcategory`
  and the nature, and 3.6 measures that all three are segments of the
  `account_name` the registry stamps, split by `parseCategoryAccountName`
  (`newCategoryHelper.ts:26-33`). Currency comes from the registry stamp too.
  The one field that cannot be rebuilt is `category_nature_type_id` as a catalog
  key; the nature's name survives as text.

**Ownership, and a correction to an earlier draft of this paragraph.** The key
and the terminating zero are CLOSE's; the two reader branches are the budget
module's. **The Overview expense page does not reach the budget through either of
them**, which an earlier draft here got wrong. `overviewExpenseService.js:62`
builds its own id array with `getExpenseAccountIds` and hands it to
`budgetCalculationService.getBudgetAccountsStatus` at `:72`, so `owned` at
`budgetController.js:43-46` is never consulted. `EXPENSE_ACCOUNT_IDS_QUERY`
(`overviewAccountRepository.js:32-39`) reads `FROM user_accounts ua JOIN
account_types act` with **no join to `category_budget_accounts`**, deliberately —
the comment above it at `:22-26` says an account whose budget row was removed is
exactly what the uncategorized-expense figure exists to reveal. On that path the
first mechanism is the disappearance of the `user_accounts` row itself; the
second and third apply unchanged. (Correction measured by the Overview session,
verified here. Their citation is `:88` and `:94`; on `feat/deletion` the same two
statements are at `:62` and `:72`, and both branches are right about their own
file.)

**The retroactive change reaches Overview as one symptom, not as a series.**
Neither `SERIES_QUERY` nor `SPENT_BY_MONTH_QUERY` is called from
`overview_services` — the only callers of `getMonthlySeriesForAccounts` are
`budgetCalculationService.js:457` and `:496`, both reached from
`budgetController.js`. Overview's thirteen-month expense series carries no budget
figure at all; the only budget on that page is the reference month's. So
navigating to a past month moves that month's variance and its categorized
expense, and nothing else. Narrower exposure than the budget module's, same
defect.

---

### 3.8 The whole-app impact of deleting the row — measured

**The owner asked for this on 2026-09-07** — *quiero que evalues el impacto de
eliminar la fila de una cuenta de la tabla user_accounts, porque hay kpis que se
tienen que calcular, historicos que se tienen que mantener, valores futuros de
budget que se van con la ida de una cuenta de category_budget; veamos el impacto
en forma integral y sus efectos a lo largo de la app.*

**The short answer, and it is not the one the rest of this plan assumed.** The
zero condition of 5.1 makes **today's** figures agree. It does nothing at all for
the history, and the codebase says so in its own words, in a comment written
before this plan existed.

#### 3.8.1 The comment that already answers the question

`overviewAccountRepository.js:175-181`, immediately above
`ACCOUNT_IDS_BY_TYPE_QUERY`:

```
// No deleted_at filter, for the same reason the expense set has none and the
// catalog's D1/P1/H1 state none: a soft-deleted account still owns the balance
// it held in the months before it was closed, and the balance series would bend
// at the month of the deletion if those rows vanished. Closing an account writes
// a compensating movement (R212's annulment rows), so a closed account
// contributes 0 to today's figure without being filtered out of yesterday's.
```

**Both halves of that sentence fail under CLOSE, at the same time.**

- *if those rows vanished* — CLOSE makes them vanish. Not soft-deleted with
  `deleted_at`: physically gone, which is the ruling in 1 and 2.
- *closing an account writes a compensating movement* — **CLOSE writes no
  transaction of any kind.** Section 2 states it: *never modifies or reverts a
  transaction, writes no transaction of its own*. Nothing compensates.

The Overview module's balance series is built on the premise that a closed
account keeps its `user_accounts` row. CLOSE removes the premise.

#### 3.8.2 The arithmetic, so this is not an argument about a comment

`MONTHLY_BALANCE_QUERY` (`overviewBalanceRepository.js:65-81`) computes a past
month as today's stock minus everything that moved after it:

```sql
    b.current_balance - COALESCE(SUM(t.amount), 0) AS total_amount   -- :68
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  CROSS JOIN (
    SELECT COALESCE(SUM(${DERIVED_BALANCE}), 0) AS current_balance   -- :71
    FROM user_accounts ua                                            -- :72
    WHERE ua.account_id = ANY($1::int[])                             -- :73
  ) b
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])                                 -- :76
   AND t.transaction_actual_date >= ${nextMonthStart('m.month', '$4')}
```

`$1` is the id array `ACCOUNT_IDS_BY_TYPE_QUERY` returns, built `FROM
user_accounts ua` at `overviewAccountRepository.js:182-184`. **The stock term and
the flow term are filtered by the same array, so they fall together.** Take a
`bank` account holding 500 in March, emptied to zero in September and closed the
same day:

| state | its part of `current_balance` | its movements after March | March reads |
|---|---|---|---|
| open | 0 | −500 | **500** |
| soft-deleted today | 0 (row kept; no `deleted_at` filter in the set) | −500 | **500** |
| **row deleted, as CLOSE does** | 0 (no row to sum) | 0 (id absent from `$1`) | **0** |

**The zero condition is what makes the first column agree, and it is exactly why
the third row is invisible until someone opens March.** Today's total is
identical in all three states. March moves from 500 to 0 with no figure on
today's screen contradicting another.

#### 3.8.3 Four mechanisms, and each needs a different remedy

A transaction row survives the close in every case. Whether its money reaches a
figure depends on which of these the reading query uses:

| # | Mechanism | The statement that does it | What repointing the seven keys fixes |
|---|---|---|---|
| 1 | **Inner join from `transactions` to `user_accounts`** | `JOIN user_accounts ua ON ua.account_id = tr.account_id` (`transactionRowShape.js:83`) | **nothing.** The join fails on the missing row whatever the foreign key says |
| 2 | **Id set built from `user_accounts`, applied to `transactions`** | `t.account_id = ANY($1::int[])` where `$1` came from `SELECT ua.account_id FROM user_accounts ua` | **nothing.** The id is absent from the array |
| 3 | **Stock read directly off `user_accounts`** | `SUM(${DERIVED_BALANCE}) ... FROM user_accounts ua` (`dashboardController.js:58`, `overviewPageRepository.js:81`) | **nothing.** No row, no term |
| 4 | **Cascade** | `ON DELETE CASCADE` on the four extension keys and on `account_name_case_backup_013` | **nothing.** The rows are destroyed, not orphaned |

**Repointing the seven keys makes the `DELETE` succeed and keeps the budget rows
alive. It does not make one figure correct.** The reads are a separate piece of
work, specified in 7.3.

#### 3.8.4 The eleven references, and what each does when the row goes

| # | Column | Declared at | On delete | Effect |
|---|---|---|---|---|
| 1 | `income_source_accounts.account_id` | `002_accounts.sql:122-125` | CASCADE | row destroyed. Ruled droppable (5.2) |
| 2 | `category_budget_accounts.account_id` | `002_accounts.sql:140-143` | CASCADE | row destroyed. Ruled intended (10.1) |
| 3 | `debtor_accounts.account_id` | `002_accounts.sql:165-168` | CASCADE | row destroyed. Ruled intended |
| 4 | `debtor_accounts.selected_account_id` | `002_accounts.sql:179-180` | **SET NULL** | **a different account's row is silently modified** — 3.8.7 |
| 5 | `pocket_saving_accounts.account_id` | `002_accounts.sql:191-194` | CASCADE | the type no longer exists (5.3) |
| 6 | `transactions.account_id` | `018:35-36` | RESTRICT | blocks the delete; repointed |
| 7 | `transactions.source_account_id` | `018:38-39` | RESTRICT | blocks the delete; repointed |
| 8 | `transactions.destination_account_id` | `018:41-42` | RESTRICT | blocks the delete; repointed |
| 9 | `transactions.opening_for_account_id` | `022:66-67` | RESTRICT | blocks the delete; repointed |
| 10 | `pocket_allocations.source_account_id` | `020:149-150` | RESTRICT | blocks the delete; repointed (6.5) |
| 11 | `account_name_case_backup_013.account_id` | `013:24` | CASCADE | **destroys the only copy of the original capitalization** — 3.8.6 |
| 12 | `budget_monthly_allocations.account_id` | `010:42-43` | CASCADE **from #2** | the whole budget series, through the second cascade (3.5, 3.7) |

**Eleven direct references and one indirect.** The count of nine that the
repointing design was written against (4.3) was taken before #11 was found; the
number of *repointed* keys is still six, because #11 cascades rather than
restricts, but it is not therefore harmless.

#### 3.8.5 The figures, one row each

| Figure | Computed at | Mechanism | What happens when the row goes |
|---|---|---|---|
| Balance total per account type | `dashboardController.js:58` | 3 | the account's term disappears; zero today by 5.1, so no visible move |
| Monthly balance series | `overviewBalanceRepository.js:65-81` | 3 + 2 | **every elapsed month bends** — 3.8.2 |
| Bank and cash headline | `overviewPageRepository.js:69-84` (`BANK_BALANCE_QUERY`) | 3 | same shape: the reference month's figure loses the account's contribution for every past month |
| Investment figures | `overviewInvestmentRepository.js:86-107` (`INVESTMENT_FIGURES_QUERY`) | 3 + 2 | `FROM user_accounts ua` at `:104` for the stock, `t.account_id = ANY($1::int[])` at `:108` for the contributed capital; both terms fall together |
| Debt receivable, payable, settled count | `overviewBalanceRepository.js:154-180` (`DEBT_DOMAIN_FIELDS_QUERY`) | 3 | **a debtor closed at zero is the definition of a settled debtor, and closing it removes it from `COUNT(*) FILTER (WHERE balance = 0 AND has_movement)`** |
| Uncategorized expense | `overviewAccountRepository.js:32-39` (`EXPENSE_ACCOUNT_IDS_QUERY`) | 2 | the comment at `:20-26` protects this figure from the *extension* row being removed; **the account row going is the case it does not cover** and the spending leaves the set entirely |
| Income | `overviewAccountRepository.js:74-81` (`INCOME_ACCOUNT_IDS_QUERY`) | 2 | a closed `income_source` — exempt from the zero condition by ruling — takes its history with it |
| Profit and loss | `overviewAccountRepository.js:150-158` (`PNL_ACCOUNT_IDS_QUERY`) | 2 | both sides fall, and the sign of the residual depends on which side was larger |
| Period-over-period deltas, every domain at once | `overviewAccountRepository.js:212-216` (`OLDEST_ACCOUNT_DATE_QUERY`) | 3 | **the statement is `SELECT MIN(ua.created_at) ... FROM user_accounts ua WHERE ua.user_id = $1` — no id array and no type predicate, so it reads the whole population rather than a set that loses one member.** Closing the owner's first account moves the delta guard forward for every domain simultaneously, on figures that have nothing to do with the closed account. (Sharpened by the Overview session; the shape verified here.) |
| Recent activity list | `transactionRowShape.js:83` | 1 | rows drop out of the list |
| Pocket allocations listing | `overviewPocketRepository.js:108-135` | 1 | count and listing disagree — 6.5 |
| Pocket committed total | `overviewPocketRepository.js:81` | none | safe: no `user_accounts` in the statement |
| Account ledger and running balance | `derivedBalance.js:238-259` (`ledgerBody`) | 1 | `JOIN user_accounts ua ON ua.account_id = tr.account_id` at `:255-256`, so the series returns **no rows at all** |
| Dashboard, nine statements | `dashboardController.js:588, 648, 718, 742, 788, 826, 849, 959, 1080` | 1 | each is `JOIN user_accounts ua ON tr.account_id = ua.account_id`; the transactions vanish from every one |
| Transaction list with counterparties | `transactionController.js:1051, 1058, 1060` | none | `LEFT JOIN` on all three; the row survives with a null name |
| Category name on a transaction | `dashboardMonthlyTotalAmountByType.js:121, 133, 135` | none | `COALESCE(cba.category_name, ua.account_name)` over a `LEFT JOIN`; degrades correctly (3.6) |

#### 3.8.6 What exists nowhere else once the row is gone

| Datum | Column | Survives? | Where, or why not |
|---|---|---|---|
| Account name, and with it the category, subcategory and nature | `user_accounts.account_name` | **yes** | stamped on the registry before the delete (4); the composite is the category (3.6) |
| Type, currency | `user_accounts.account_type_id`, `currency_id` | **yes** | stamped on the registry (4) |
| Opening amount | `user_accounts.account_starting_amount` | **the value yes, the arithmetic no** | see below |
| Creation timestamp | `user_accounts.created_at` | **no** | read by `OLDEST_ACCOUNT_DATE_QUERY` (`:213`); not stamped by the registry design in 4.3 |
| Account start date | `user_accounts.account_start_date` | **no** | read at `getTransactionsForAccountById.js:97-100` beside the starting amount |
| Original capitalization of a budget category | `account_name_case_backup_013.account_name` | **no, and the table says so** | its own comment at `013:21-22`: *Lowercasing is destructive: the original capitalization exists nowhere else once it is overwritten.* The cascade at `:24` destroys the backup, and migration 013's DOWN stops being real for that account — bounded and assessed in 3.8.12 |
| Budget amount and its FX pair | `category_budget_accounts.budget`, `original_budget`, six FX columns | **no** | ruled (10.1) |
| Monthly budget history | `budget_monthly_allocations` | **no unless fix 1 of 3.7 is taken** | second cascade (3.5) |

**The opening amount is the subtle one, and it is a correction to an assumption
worth stating.** The value is not lost: `derivedBalance.js:15-16` records that
*an account carries its opening in `user_accounts.account_starting_amount` and
again as an account-opening transaction*, and `accountCreationController.js:344-350`
writes that transaction with `amount: convertedAmount` and
`opening_for_account_id: account_basic_data.account_id`. That row survives the
close, because `opening_for_account_id` is one of the seven repointed keys.

**What breaks is the reader.** `ledgerBody` reads the opening off the column
(`derivedBalance.js:244`) and deliberately excludes the transaction that carries
it a second time:

```sql
            CASE WHEN tr.movement_type_id = ${ACCOUNT_OPENING_MOVEMENT_TYPE_ID}
                   AND tr.account_id = tr.opening_for_account_id
              THEN 0 ELSE tr.amount END
```

Delete the row and that exclusion turns a duplicate into a hole. **Any design
that keeps the ledger readable after the close has to invert this test for a
closed account** — take the opening from the transaction, since the column is
what is gone. That is a change to a file this plan does not own.

#### 3.8.7 A side effect on an account nobody closed

`002_accounts.sql:179-180`:

```sql
  selected_account_id  INT REFERENCES user_accounts(account_id)
    ON DELETE SET NULL,
```

**Closing a `bank` or `cash` account silently blanks the settlement account of
every debtor that had chosen it.** The debtor is not the account being closed,
nothing in the close names those debtors, and no message is produced. The
neighbouring column `selected_account_name VARCHAR(50)` at `:182` keeps the text
of a link that no longer exists, so the debtor screen shows a name pointing at
nothing.

#### 3.8.8 Future budget values

3.7 covers the retroactive half of the owner's budget question. The forward half
is a different statement and it is worse, because it never terminates:
`getAllocationForMonth` (`budgetAllocationRepository.js:48-53`) resolves a month
as the last row at or before it — `AND budget_month <= $2` at `:51` followed by
`ORDER BY budget_month DESC` at `:52`. **A surviving series with no
terminating zero publishes the closed category's final budget into every future
month, without end.** The terminating zero in fix 1 of 3.7 is what stops it, and
it is required by every design that keeps the rows, not only by that one.

#### 3.8.9 The frontend

The frontend issues no SQL. Every effect above arrives as a short payload or a
null field, and the interface has no way to tell that from an empty account.
Fifty files under `frontend/src/fintrack` name `account_name` or `accountId`;
the ones the close reaches are:

- **`AccountDetail.tsx` and `OverviewAccountReading.tsx`** — the account no
  longer resolves, and the running balance arrives empty (mechanism 1 on
  `ledgerBody`).
- **`CategoryDetail.tsx`, `CategoryDetailReading.tsx`, `ListAccountOfCategory.tsx`**
  — a closed budget category disappears from the category screens, past months
  included.
- **`PocketFundingAccounts.tsx` and `PocketAllocationModal.tsx`** — the released
  commitment is correct, the row that recorded the release is not listed (6.5).
- **`Expense.tsx`, `Income.tsx`, `PnL.tsx`, `Transfer.tsx`, `Debts.tsx`,
  `ListOfDebtors.tsx`** — transaction rows drop out silently.
- **`useAccountExistence.ts`** — the index is built from `/account/allAccounts`
  keyed by `account_id`, so a closed name becomes free again the moment the row
  goes. That is the behaviour 10.2 relies on, and it is the one place where the
  deletion helps rather than costs.

**One project rule is broken by every case above.** `CLAUDE.md` requires that a
missing figure render as a skeleton or a dash, never as `0`. A bent history is a
wrong number, not a missing one, and no frontend state can represent it.

#### 3.8.10 What it costs to make the delete safe

| Work | Owner | Status |
|---|---|---|
| Repoint the seven keys at the registry | this plan (4.6, 7.2.4) | specified |
| Stamp the twelve closure columns before the delete | this plan (4.6, 7.4) | specified |
| Release the pocket commitment | this plan (6) | designed |
| Terminating zero on the budget series | this plan (3.7 fix 1, 7.4 step 5) | **ruled by the owner on 2026-09-08: fix 1** |
| Repoint `budget_monthly_allocations.account_id` | this plan (3.7 fix 1) | **open, same decision** |
| Classify the twelve Overview reads and decide each one | overview module | **not designed anywhere** — enumerated in 3.8.11; nine are visible on this branch and three arrive with the merge from `main` |
| Invert the opening-row exclusion in `ledgerBody` for a closed account | `derivedBalance.js`, peer-owned | **not designed anywhere** |
| Decide what happens to `account_name_case_backup_013` | migration session | **assessed in 3.8.12** — bounded loss, severity low, their proposal is a retirement-register entry rather than a gate on CLOSE |
| Decide whether a debtor whose settlement account is closed is warned | this plan | **not raised before this section** |

**Three of these were not visible before this assessment**, and the honest
statement is that the erasure is a larger change than the repointing design
implies. The alternative — keeping the row and marking it — was refused by the
owner in 1 and is not reopened here; what is recorded is what the refusal costs.

#### 3.8.12 The name-case backup: what is actually lost, and what nobody can answer

**The migration session assessed the eleventh reference after it was reported,
and the loss is bounded** — which the raw finding did not say. Measured here as
well:

- **Nothing in the running application ever selects from that table.** The four
  occurrences of the name in the backend are the `CREATE` at
  `013_normalize_category_budget_name_case.sql:23`, the `INSERT` at `:30`, the
  commented-out DOWN at `:63-75`, and `schemaParity.js:34`, which only declares
  it an accepted chain-only difference. **The DOWN is the table's only reader.**
- **Only rows that actually differed were ever backed up.** The `INSERT`'s
  `WHERE` at `:36-41` captures an account only when
  `ua.account_name <> LOWER(TRIM(ua.account_name))` or one of the two
  `category_budget_accounts` columns differs the same way. For an account already
  lowercase the DOWN was a no-op before CLOSE existed, so nothing is lost.
- **The loss is therefore exactly this set:** `category_budget` accounts whose
  name carried uppercase before 013 ran, and which the owner later closes.

**That set has been counted, and it is not small.** The migration session was
authorized by the owner to measure against the production copy held locally
(*lo que si puedes ir probando es en la copia de produccion que esta en local*)
and sized 013 by its own predicates without executing it:

| What 013 would do on that copy | Rows |
|---|---|
| `INSERT` at `013:30-42` backs up | 28 |
| `UPDATE` at `013:44-50` rewrites `user_accounts.account_name` | 27 |
| `UPDATE` at `013:52-56` rewrites `category_budget_accounts` | 12 |

**Twenty-eight of the ninety-four `category_budget` accounts in that copy**, with
real spellings: `Restorante/D'luchis/want`, `aceites/OLIVA/want`,
`Agua/Bolsa 6.5l/must`, `Verduras/Chanpiñon/other`, `cereales/FETTUCCINE/want`,
`pan/TOSTADA CL/want`. Closing any one of them after 013 destroys the only copy
of that spelling.

**No two accounts collapse into one name.** Grouping the ninety-four by
`LOWER(TRIM(account_name))` returns no group with more than one member, so 013 is
a spelling change and not a merge — the one way it could have been worse than
described.

**The copy is dated 2026-08-21 and predates the alignment**, so it is evidence
about what the data was, not about what production is today. The migration
session states the same caveat itself and gives the case that proves it: the copy
holds one `pocket_saving_accounts` row (account 108, `cash_loc_chinita`) while
`020_create_pocket_tables.sql:18-24` records four counts of zero measured on
2026-08-24 — 020's own header says the owner deleted the last pocket account that
day, so the copy corroborates the header instead of contradicting it. **Anything
measured on that copy is evidence about 2026-08-21.** (Counts measured by the
migration session under the owner's authorization; not re-run here, since that
authorization was given to them.)

**The migration session's severity call, recorded with its reasoning rather than
as a verdict:** low, and CLOSE should not be gated on it. Rolling 013 back would
return the database to the two-forms state the migration existed to end, since
both writing paths — `accountEditController.js` and
`accountCategoryCreationcontroller.js` — now write the canonical lowercase form
unconditionally. Their proposal is to state it in the retirement register:
**013's DOWN becomes partial once account deletion ships.**

**What no session can settle, and it is not a detail.** Whether that table exists
in production at all is unresolved. `001_production_alignment.sql:32-33` records
that *account_name_case_backup_013 exists only on the chain — migration 013 is
deliberately not reproduced here*, and its ledger step lists 001-012 and 014-017,
skipping 013 on purpose. But `runMigrations.js:89-98` reads the whole directory,
sorts it, and runs everything absent from the ledger — and filename order puts
013 before 018. **If the production run of 2026-08-27 that delivered
`018_alter_transactions_account_fks_to_restrict.sql` went through the chain
runner, then 013 ran with it**, and production carries both the table and a
lowercasing `UPDATE` that was never rehearsed. **The fork is now stated
sharply:** either someone inserted 013 into production's ledger by hand — nothing
in the repository records such an insert — or those twenty-seven names were
rewritten on 2026-08-27 by a chain run whose own author had deliberately excluded
that migration. The local copy cannot settle it, because it predates the
alignment. The alignment header's parity note
describes 2026-08-26 and is stale for anything after it. Settling this needs a
read of production's `migrations` table, which is the owner's alone, and
production migrations are frozen by his instruction of 2026-09-07. (Reported by
the migration session; the chain-side anchors verified here, the production
question left open.)

---

#### 3.8.11 The Overview reads enumerated, and why a sample is dangerous here

**A list of the worst cases invites a fix that repairs those and leaves the
rest.** The Overview session enumerated the full set on its own branch and the
count was measured here independently. **Nine statements on `feat/deletion` take
`user_accounts` as the driving table across the four Overview repositories:**

| File | Lines with `FROM user_accounts ua` as the driving table |
|---|---|
| `overviewAccountRepository.js` | `:34`, `:76`, `:152`, `:184`, `:214` |
| `overviewBalanceRepository.js` | `:72`, `:173` |
| `overviewInvestmentRepository.js` | `:104` |
| `overviewPageRepository.js` | `:81` |

**Twelve is the number for the fix and nine is what is visible from here.**
`main` already carries the three statements this branch has not received, and
this was measured rather than taken on report: `git log --oneline
main..feat/deletion -- backend/src/fintrack_api/services/overview_services/db`
returns **nothing**, so not one of this branch's seventeen commits touches those
files and `main` is a strict superset of them rather than a variant.
`git rev-list --left-right --count main...feat/deletion` returns `17 17`. The
three arrive with the merge, without anyone writing a line:

| Statement | On `main` |
|---|---|
| `MONTHLY_BALANCE_BY_ACCOUNT_QUERY` | declared at `:147`, reads `CROSS JOIN user_accounts ua` at `:159` |
| the second investment read | `:196` |
| `FREE_CASH_QUERY`'s account read | `:193` |

**One of those twelve is invisible to the obvious search, and this plan's own
count missed it for that reason.** `MONTHLY_BALANCE_BY_ACCOUNT_QUERY` takes the
account table as `CROSS JOIN user_accounts ua`, not as `FROM user_accounts ua`,
so a search for the `FROM` form returns eleven and not twelve. **A sweep for
reads of this table matches both forms or it under-reports.** (Count from the
Overview session; the `CROSS JOIN` at `main :159` opened and verified here.)

The same drift explains the line numbers: this branch's
`overviewBalanceRepository.js` declares only `MONTHLY_BALANCE_QUERY` at `:65` and
`DEBT_DOMAIN_FIELDS_QUERY` at `:154`, while `main` declares three and puts
`DEBT_DOMAIN_FIELDS_QUERY` at `:203`. **Anyone acting on either list re-measures
on the branch they are editing** — and takes twelve as the size of the work.

**They do not all fail the same way, but the example offered for that was
measured and does not hold.** The Overview session cited `user_accounts` sitting
inside an `EXISTS` correlated as `WHERE pa.source_account_id = ua.account_id`,
where a missing account would flip a flag rather than lower a total. Opened on
`main`: that read is a scalar `SUM` subquery inside `FREE_CASH_QUERY`, not an
`EXISTS`, and `user_accounts` at `:193` is the driving table of the CTE — so the
account leaves the CTE and lowers `free_cash`. **The only `EXISTS` in the four
files is at `overviewBalanceRepository.js:212`**, and it is correlated to
`transactions`, not to `user_accounts`: `EXISTS (SELECT 1 FROM transactions t
WHERE t.account_id = ua.account_id ...)`, the `has_movement` flag. When the
account row goes, its CTE row goes with it and that flag is never evaluated at
all. **So all twelve fail the same way after all, by mechanism 3 of 3.8.3.** The
Overview session opened `FREE_CASH_QUERY` on `main` and withdrew the instance —
*your correction is right and my counter-example was wrong* — so this is settled
between the two sessions rather than left as a disagreement. **The caution that
each read is classified before any of them is changed is kept anyway**, on the
grounds that twelve statements sharing one mechanism still differ in what a
missing account does to the figure each one publishes.

---

## 4. The historical identity

### 4.1 The problem, measured

**An inner join drops the row when the account is absent, and raises nothing.** A
May salary posted from an income source closed in June would stop adding to May's
income total, silently. The
inventory below is measured per branch, because the two branches carry different
readers and a single number would be wrong on both.

| Where | Count | Sites |
|---|---|---|
| This branch | 12 | ten in `dashboardController.js`, one in `getAccountController.js`, one in the Overview row shape (`transactionRowShape.js`) |
| Overview branch, additional | 2 | `overviewInvestmentRepository.js` on the transaction's own account, `overviewPocketRepository.js` on an allocation's source account |

Two more sites are not inner joins onto the accounts table and drop no row, yet
they produce a **wrong figure**, which is worse than a missing one because
nothing looks absent:

- **The month's realised profit and loss stops summing to its own split.**
  `overviewMonthlyRepository.js` reads the account type through two left joins
  and splits the total with a filter on the investment type; a closed account
  resolves to a null type, lands in neither part, and the parts stop adding up to
  the total they split. Measured by the Overview session on its branch.
- **A thirteenth site on this branch drops rows through a different door.**
  `dashboardMonthlyTotalAmountByType.js` left-joins the accounts table from the
  transaction and then **inner-joins the type catalog on the account's type
  column**. Its comment justifies that inner join by the constraint making the
  type column not-null behind a restricting key — true today, and false the
  moment the parent row can be absent, because the column then arrives null from
  the left join. The comment is correct about the constraint and is precisely
  what makes the exposure invisible.

Two Overview sites were checked and are **not** exposed: income by source is
already left-joined and its comment already commits to keeping a null source as
its own part, and the balance series takes the account list as an input
parameter, so a deleted account is simply absent from it.

What those queries read off the account is not just the name:

| Column | What it is for |
|---|---|
| `account_name` | display |
| `account_type_id` | **classifies the movement into its domain** |
| `currency_id` | interpreting the amount |
| `user_id` | filtering by owner |
| `account_starting_amount` | a term of the balance formula |
| `account_start_date` | the time window |
| `account_balance` | the fast-read cached column |

**The type is the decisive one.** Without it a transaction cannot be added to any
total, even when the name is known.

### 4.2 The two candidate designs, and why one was chosen

| | Snapshot inside the transaction | A table of account identities |
|---|---|---|
| What is added | name, type and currency **per side**: six columns | one table |
| How much it occupies | every transaction row, forever | one row per account |
| Writers | every transaction writer changes | none |
| Initial backfill | mandatory, over the whole table | none |
| Cost in readers | the twelve queries | the twelve queries |

The reader cost is identical, so it does not discriminate. **The table was
chosen:** the price is paid per account rather than per movement.

### 4.3 The shape, as ruled by the migration session

The first draft of this plan proposed a table filled only at closure, with the
five restricting keys dropped to plain integers. **That was refused, and the
refusal is correct:** it gives up the guarantee twice — the column stops refusing
an id that was never issued, and the fallback table is empty for every live
account, so any path reaching the delete without capturing produces rows pointing
at nothing with nothing able to detect it. One of those two failures cannot even
be observed.

**The ruled shape — a registry of every account id ever issued:**

- One row per account, created **when the account is created**, not when it is
  closed. Nothing ever deletes from it.
- **Six keys are repointed at the registry** instead of at the accounts table:
  the three on transactions, the opening marker, the pocket allocation's source,
  and the debtor's selected account. **A seventh was added on 2026-09-08 when the
  owner ruled fix 1** — `budget_monthly_allocations.account_id`, repointed from
  `category_budget_accounts` rather than from `user_accounts` (4.6, 7.2.4). Since no row is ever deleted there, restrict
  never fires and costs nothing, the referencing columns keep a real constraint,
  and the accounts table becomes freely deletable because the only references
  left to it are the four extension keys, which cascade.
- **The four extension primary keys are not repointed. They keep the cascade
  they have, and the owner ruled it explicitly on 2026-09-07**: *cuando se borra
  hay tambien que eliminarla de esta otra tabla, buscando no por nombre sino por
  id*. That is already what the schema does and it needs no code —
  `002_accounts.sql:141-143` declares
  `account_id INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE
  CASCADE`, so deleting the account deletes the extension row by id, in the same
  statement, with no name matching anywhere. The other three tables are declared
  the same way at lines 122, 165 and 191. **Nothing in the codebase deletes from
  any of those four tables** — no `DELETE FROM category_budget_accounts` or its
  three siblings exists in `backend/src` — so the cascade is not merely the
  simplest route, it is the only one.
- **This reverses the extension half of the migration session's design, and the
  reason it does is the owner's, not a measurement.** That session repointed the
  four keys so the roughly thirty type-specific columns — the budget amount, the
  budget account's nature and subcategory, the debtor's terms, the currency
  audit pairs — would survive the close. The owner's position is that a closed
  account leaves no row behind in any table, which makes surviving extension
  rows the thing to remove rather than the thing to preserve. The preservation
  argument was sound about databases and wrong about this product.
- **What is lost at close, stated so nobody discovers it later:** for a spending
  category, `category_name`, `category_nature_type_id`, `subcategory` and
  `budget`; for an income source, a debtor and a pocket saving, the equivalent
  columns on their own tables. The registry stamps name, type, currency and
  starting amount and nothing else, so a report that wants a closed category's
  old budget amount cannot have it. **No reader measured on this branch asks for
  one**, and the transactions that carry the spending are untouched.
- The debtor's copied account-name column stops being a defect for free: its
  `selected_account_id` reference blanks itself only because it points at the
  accounts table, and repointed at the registry it never blanks. That key is
  about a *different* account from the one the row belongs to, so the owner's
  ruling does not reach it.
- **While the account is live the registry row carries the id and the owner
  only**, with the descriptive columns null; the live values keep being read from
  the accounts table exactly as today. **Name, type, currency and starting amount
  are stamped at closure** — at the one moment the source is about to disappear
  and can no longer change. No column is ever two things at once.
- A reader resolves in one step: present in the accounts table, read live;
  absent, read the stamp.
- **The closure record lives on that same row** — closed at, closed by, and the
  mandatory reason as three more columns. The rule behind it, so the next case
  decides itself: an event that happens at most once per account belongs on the
  account's row; an event that repeats needs its own table. Closure happens once.
  If deactivation is ever recorded, deactivation repeats, and that is when a
  second table earns its place.
- **Id issuance order is the genuinely hard part.** The registry row must exist
  before the accounts table references it, and there are two creation controllers
  plus the boot path to keep honest. A trigger firing before insert on the
  accounts table is the version no writer can forget, and this schema already
  carries one trigger (the time-zone assertion on users in `002_accounts.sql`),
  so it is not a foreign idiom here.

### 4.4 Backfilled rows are nullable, and that is not a preference

For accounts erased by the old mechanism, **only the name survives** — the type
and the currency lived on the accounts table and its extension table and both are
gone. So a backfilled registry row carries a name and nulls, and a null type is
precisely what the type-required migration exists to forbid on the live side.

**The stamped columns therefore have to be nullable, with null meaning "erased
before this registry existed", and every reader needs a branch for it.**

The cascade on the four extension keys does not change this either. For accounts
the old mechanism already erased, the extension rows went with the cascade at the
time, exactly as the name did — and under the owner's ruling that is also what a
future close does, so the two eras behave alike on this point.

### 4.5 Three sites that would have been a problem, and are not

**This section recorded the cost of letting extension rows survive. The owner's
ruling that they are deleted with the account removes all three.** They are kept
here because each one was measured and because a future proposal to preserve
those rows has to re-answer them.

- **The category name.** The collision check that decides whether a category name
  is taken (`accountCategoryCreationcontroller.js`) joins the accounts table and
  ends `AND (ua.closed_at IS NOT NULL OR ua.deleted_at IS NULL)`, with a comment
  stating that a soft-deleted category releases its name while a closed one keeps
  it. With both rows deleted the name is released, so the code's stated rule is
  inverted — but that is a consequence of deleting the account row, which the
  owner ruled first, and it is the same for every type. It belongs to whoever
  writes the account-name uniqueness plan (`PLAN_ACCOUNT_NAME_UNIQUENESS.md`).
- **The edit read.** `accountEditController.js` reads the stored category name
  parts directly on the extension table's account id with no join to the accounts
  table. With the extension row deleted it returns nothing, which is the correct
  behaviour for a closed account and needs no guard.
- **The budget write.** `budgetAllocationService.js` updates the category's
  budget by account id alone. With the extension row deleted the update matches
  zero rows instead of writing onto a closed category, so the defect this section
  reported does not arise. **It remains a real weakness in that service** — it
  will still silently write nothing rather than report a missing account — and it
  goes to whoever owns the budget service, as a separate matter from this plan.

Everything else measured — the dashboard, the account reads, the budget
transaction repository, the creatable-type helper and the export — joins in from
the accounts table and needs no change.

---

### 4.6 The historical identity contract

**The owner ordered this written before section 7, and gave the reason** — *no
conviene disenar el registry definitivo antes, porque el problema del presupuesto
determina una parte de su contrato.* The sequence matters: fix 1 adds a seventh
referencing key and a reader that has to resolve a closed category, so a registry
designed before that ruling would have been designed against the wrong consumer
set.

**He also corrected the column set this plan had been carrying.** Sections 4.3 and
4.5 say the registry stamps *name, type, currency and starting amount and nothing
else*. That is too narrow. The correction below is measured rather than accepted
on his say-so: every column is in the contract because a named statement reads it
and would resolve to nothing without it.

#### The measurement: what the codebase reads off an account

Every reference to a `user_accounts` column through the `ua` alias in
`backend/src`, counted **on this branch** — `main` differs, and the two places it
differs are called out where they fall:

| Column | Reads | Decisive consumer, and what fails without it |
|---|---|---|
| `account_id` | 133 | the join key of all of them, and the correlation `WHERE tr.account_id = ${accountAlias}.account_id` inside the balance builder (`derivedBalance.js:227`) |
| `account_name` | 91 | display, and for a spending category it is the **only** surviving source of `category_name`, `subcategory` and the nature — 3.6 measures all three as segments of it |
| `user_id` | 67 | the ownership filter; without it a historical row cannot be scoped to an owner and cannot be returned at all |
| `account_type_id` | 67 | **classifies the movement into its domain.** `TRANSACTION_ROW_SOURCE` left-joins the type catalog on it (`transactionRowShape.js:84`); a null type lands a movement in neither part of a split total |
| `currency_id` | 46 | `COALESCE(cba.currency_id, ua.currency_id) AS currency_id` at `budgetTransactionRepository.js:125` — the fallback arm of a **fix 1 reader**, whose preferred arm dies with the extension row |
| `account_starting_amount` | 27 | the first term of the balance formula: `${accountAlias}.account_starting_amount` at `derivedBalance.js:219` |
| `account_start_date` | 26 | `transactionRowShape.js:70`, `getTransactionsForAccountById.js:99`, and the budget's `ACCOUNTS_QUERY` at `budgetTransactionRepository.js:131` |
| `deleted_at` | 12 | soft-delete state; a closed account has no row that could carry it |
| `closed_at` | 10 | the closure stamp added by `034_add_account_closed_at.sql` |
| `account_balance` | 3 | one live read on this branch, none on `main` — measured below |
| `created_at` | 2 | `SELECT (MIN(ua.created_at) AT TIME ZONE $2)::date::text` at `overviewAccountRepository.js:213`, the whole-population delta guard of 3.8.5 |
| `updated_at` | 1 | one `ORDER BY ua.created_at DESC, ua.updated_at DESC` over a list of live accounts (`getAccountController.js:790`) |
| `note` | 0 | nothing reads it off the accounts table anywhere in `backend/src` |

**The stored balance column, and a correction to 4.1.** The table in 4.1 lists
`account_balance` among the things these queries read off the account, calling it
*the fast-read cached column*. Measured: of its three occurrences, two are inside
commented-out statements (`dashboardController.js:682` and `:699`) and one is
live — `ua.account_balance,` at `transactionRowShape.js:69`. **On `main` that same
line reads `${DERIVED_BALANCE} AS account_balance`**, so the branch carries the
defect and the fix arrives with the merge, exactly as the three Overview
statements of 3.8.11 do. Everywhere else the name is the derived expression
wearing it: nineteen `AS account_balance` sites across `dashboardController.js`,
`getAccountController.js`, `transactionController.js`, the two close-path reads
and `overviewInvestmentRepository.js`.

**Twenty-six statements ship the stored column anyway, through `ua.*`**, and
`getAccountController.js:933` says so in its own comment: *Every branch above
selects ua.\*, so every one of them shipped the stored...*. Those that also alias
the derived expression overwrite it in the row object before any caller sees it
(`getAccountController.js:1146` is the clearest, selecting `ua.*` and
`${DERIVED_BALANCE} AS account_balance` in the same list).

**So the column does not enter the registry.** It stays on `user_accounts` by the
owner's ruling of 2026-09-07 — *yo dejaria la columna, solo como informacion de
consulta rapida* — and stamping it would mean preserving a figure whose only live
reader is a defect the merge removes.

#### The contract

The row exists for every account from the moment the account is created.
**Fourteen columns in twelve rows.** An earlier draft said nine, counting the
table's rows instead of the columns in them, and a second said eleven, before the
budget measurement added three. The closure record is three columns on one row.

| Column | Written at creation | Stamped at closure | Nullable | Why there and not elsewhere |
|---|---|---|---|---|
| `account_id` | yes | — | no | the identity itself; it is what the seven keys reference |
| `user_id` | yes | — | no | the ownership filter, and it is known at creation and never changes |
| `account_name` | — | yes | yes | the live value is read from `user_accounts` and can change until the last instant |
| `account_type_id` | — | yes | yes | same, and the edit path can move an account between types |
| `currency_id` | — | yes | yes | same, and it must be the **resolved** value. `ACCOUNTS_QUERY` reads `COALESCE(cba.currency_id, ua.currency_id) AS currency_id` (`budgetTransactionRepository.js:125`); once both rows are gone the COALESCE has no second operand, so the stamp has to be the answer that expression would have given |
| `account_starting_amount` | — | yes | yes | same |
| `account_start_date` | — | yes | yes | same |
| `created_at` | — | yes | yes | same |
| `category_name` | — | yes | yes | **`category_budget` only.** The key `budgetCalculationService` folds the payload on; read off the extension row in the closing transaction, before the cascade |
| `subcategory` | — | yes | yes | same source, published as its own field by `ACCOUNTS_QUERY` |
| `category_nature_type_id` | — | yes | yes | same source, and the catalog key rather than the name text: `category_nature_types` rows are never deleted, so the existing LEFT JOIN stays answerable |
| `closed_at`, `closed_by`, `close_reason` | — | yes | yes | the closure record, on the same row, by the rule in 4.3: an event that happens at most once per account belongs on the account's row. **`close_reason` is NOT NULL by the owner's ruling of 2026-09-08**, free text |

**Two columns at creation and the rest at closure is not a compromise, it is the
only shape with no ambiguous state.** While the account is live its descriptive
values are read from `user_accounts`, which is where they change; the registry's
copies stay null and no two writers have to be kept in agreement. At closure the
source is about to disappear and can no longer change, so the stamp is taken once
and is final. A reader resolves in one step: **present in `user_accounts`, read
live; absent, read the stamp** — which is the rule the owner wrote.

**Not null on the two creation columns, nullable on every stamp, and the null has
exactly one meaning:** *erased before this registry existed*. 4.4 measures why it
cannot be otherwise — for an account the old mechanism already erased, the type
and the currency lived on the accounts table and its extension row and both are
gone, so a backfilled row can only carry nulls. Every reader that consults a stamp
needs a branch for that null.

**What is deliberately absent, each absence measured rather than assumed:**

- **`account_balance`** — written on every account write, read by one statement
  that `main` has already fixed; the derived formula reproduces it from
  `account_starting_amount` plus the surviving transaction rows.
- **`note`** — no statement in `backend/src` reads it off the accounts table. It
  is lost at close and no figure moves. Recorded so it is not found later as a
  surprise.
- **`updated_at`** — its one reader orders a list of live accounts.
- **`deleted_at`** — CLOSE deletes the row, so a closed account cannot carry a
  soft-delete timestamp. The two states stop being confusable by construction,
  which is the ambiguity `034_add_account_closed_at.sql` exists to end.
- **The type-specific columns** — the budget amount, the debtor's terms, the
  currency audit pairs. The owner ruled the extension row is deleted with the
  account (4.3), so there is nothing to stamp. **Three of them are the exception
  fix 1 creates**, immediately below.

#### Three columns fix 1 forces back in, and why they reopen a closed decision

**Key 7 keeps the allocation rows alive; on its own it changes nothing a reader
can see.** Found by the Overview session, measured by the migration session,
verified here. **Four independent removals stand between a closed
`category_budget` account and its budget figure, and any one of them empties the
result. Key 7 closes the fourth only.**

| # | The removal | Where |
|---|---|---|
| 1 | the id array never names the account — `SELECT ua.account_id FROM user_accounts ua JOIN account_types act ... AND act.account_type_name = 'category_budget'`, and everything downstream filters `WHERE ua.account_id = ANY($1)` | `overviewAccountRepository.js:32-39` |
| 2 | the driving table — `FROM user_accounts ua` | `budgetTransactionRepository.js:132` |
| 3 | the inner join onto the extension table — `JOIN category_budget_accounts cba ON cba.account_id = ua.account_id` | `budgetTransactionRepository.js:133` |
| 4 | the allocation cascade | closed by key 7 |

**Removals 2 and 3 are two, not one.** CLOSE destroys a row on each side of that
join, and a registry that perfectly restores the `user_accounts` side still loses
the row on the extension side.

**What the statement selects decides the contract, not what the group key needs.**
`ACCOUNTS_QUERY` reads seven columns and **three come off the table that
cascades**:

| Selected | Line | Published as |
|---|---|---|
| `cba.category_name` | `:122` | `categoryName` at `:264` |
| `cba.subcategory` | `:123` | `subcategory` at `:265` |
| `cba.category_nature_type_id` | via `LEFT JOIN category_nature_types cnt ON cnt.category_nature_type_id = cba.category_nature_type_id` at `:134-135`, read as `cnt.category_nature_type_name AS nature` at `:124` | `nature` at `:268` |

All three are declared on `category_budget_accounts`, whose primary key carries
`ON DELETE CASCADE` (`002_accounts.sql:140-143`, the nature key at `:147-148`).
The statement also orders on `cba.category_name, ua.account_name` at `:137`.

**So the three go into the registry, stamped at closure from the extension row in
the same transaction, before the cascade fires** — `category_name`, `subcategory`,
`category_nature_type_id`. The last one is the **catalog key, not the name text**:
`category_nature_types` rows are never deleted, so one stamped integer keeps the
existing LEFT JOIN answerable and removes an entry from *What no contract
recovers*.

**Why this reopens a decision 10.3 records as closed.** 10.3 closes *whether the
registry stamps the type-specific attributes: it does not*, on the reason *the
extension row is deleted with the account, so there is nothing to stamp*. **Fix 1
falsifies that reason for one type**: after key 7 a `category_budget` account
leaves rows behind, and those rows need columns that died with the extension row.
The decision was correct on its own premise and the premise changed — the same
pattern as 3.5 being superseded by 3.7. **It stays a bounded exception**: only
`category_budget` leaves surviving rows, so nothing is stamped for the other five
types and their roughly thirty type-specific columns still die at close.

**Parsing `account_name` instead is a convention, not an invariant, and it is the
option this plan should not take.** 3.6 records that the three segments of a
`category_budget` account name are the category, the subcategory and the nature.
The migration session measured the agreement holding across **111
`category_budget` accounts** — 94 on the production copy, 17 on the development
database — every one splitting into exactly three parts on `/`, segment 1 equal to
`category_name` and segment 2 equal to `subcategory` lowercased and trimmed, zero
exceptions. **Nothing enforces it.** `010_create_budget_tables.sql` declares only
`uq_budget_allocation_month` at `:48` and `chk_budget_month_is_first` at `:49`;
there is no CHECK and no trigger binding the composite to its parts. Two lines
hold it:

```js
? `${category_name}/${subcategory}/${nature_type_name_req}`        // accountCategoryCreationcontroller.js:82
normalizeAccountName(`${categoryName}/${subcategory}/${nature}`)   // accountEditController.js:175
```

**And this schema already has a stored name that went stale exactly that way** —
`debtor_accounts.selected_account_name` (`002_accounts.sql:182`), which
`020_create_pocket_tables.sql:386` has to set to NULL because nothing kept it in
agreement with the account it names.

**What it costs to omit them, on each side of the change.** Today, before any
registry exists, removals 1 to 3 mean the closed category contributes to no group
at all: the surviving budget becomes an amount nothing reads, and there is no
empty row left behind to notice. **After a registry-sourced reader that omits
`category_name`, the failure inverts and becomes loud**: the row arrives with a
null group key, `makeCategoryGroups` folds it in at
`budgetCalculationService.js:265-268`, and `:271-272` sorts the keys with
`.sort(([a], [b]) => a.localeCompare(b))` — **a null key raises a `TypeError`
before any group is built**, so the whole payload fails rather than one category,
and only when there are at least two groups, because a one-element sort never
calls the comparator. Had it survived that, `makeBudgetCategoryStatus.js:40-41`
refuses it anyway: *categoryName is required and must be a non-empty string*.
Neither outcome is acceptable, and the second is what the registry would ship.

**The chain owner's ruling on how this migrates, recorded as theirs.** None of the
pieces is demonstrable alone — not the registry `CREATE TABLE`, not its
population, not the `ALTER` that repoints
`budget_monthly_allocations_account_id_fkey` — because three other removals still
stand behind each of them. **So they go in one chain file, not a sequence, and it
ships in the same block as the read change**, with the header naming the four
removals and saying which the file closes and which the reader closes. That is a
deliberate exception to the usual preference for the smallest possible migration:
a file whose effect cannot be shown becomes a ledger row a later session reads as
proof the problem is solved.

#### What points at the registry: seven keys, not six

Fix 1 adds the seventh, and it is the only change decision B makes to the key set:

| # | Key | Where it is declared |
|---|---|---|
| 1-3 | `transactions.account_id`, `.source_account_id`, `.destination_account_id` | `018_alter_transactions_account_fks_to_restrict.sql` |
| 4 | `transactions.opening_for_account_id` | the opening marker |
| 5 | `pocket_allocations.source_account_id` | the pocket source |
| 6 | `debtor_accounts.selected_account_id` | `002_accounts.sql:179-180`; repointing it also stops it blanking a different account's row |
| 7 | **`budget_monthly_allocations.account_id`** | `010_create_budget_tables.sql:42-43`, `supabase/001_production_alignment.sql:401-402` and `createTables.js:406-407` — **three declarations, two files touched**, see below |

**The four extension primary keys are still not repointed.** They keep
`ON DELETE CASCADE` by the owner's ruling of 2026-09-07, and key 7 is what lets
the budget rows survive that cascade: they stop hanging off
`category_budget_accounts` and hang off the registry instead.

#### Key 7 is three declarations and two edits, not three edits

**Two of the three are sealed, and the migration session is right that this
changes the shape of the work.** The three carry identical text — verified here,
line by line:

```sql
 account_id           INTEGER       NOT NULL
  REFERENCES category_budget_accounts(account_id) ON DELETE CASCADE,
```

| Declaration | Status |
|---|---|
| `010_create_budget_tables.sql:42-43` | **applied**, named in the ledger of `fintrack_dev` and of `fintrack_rehearsal`, and in the alignment file's own ledger step — sealed, prose included |
| `supabase/001_production_alignment.sql:401-402` | **applied and published**, ran against Supabase on 2026-08-22 — sealed |
| `createTables.js:406-407` | not a migration; it is the boot path and is edited in place |

**So key 7 is a NEW chain file carrying an `ALTER`, plus the matching edit to
`createTables.js`** so a database built from scratch by the boot path comes out
with the same key. It cannot be earlier than 035: `034_add_account_closed_at.sql`
is the last file on disk, and the registry table has to exist before the `ALTER`
runs — same file with the registry first, or an earlier one.

**The constraint name has to be dropped by the name Postgres generated**, because
the declaration is inline and unnamed. Measured read-only by the migration session
on both local databases and identical on both:
`budget_monthly_allocations_account_id_fkey`, `FOREIGN KEY (account_id)
REFERENCES category_budget_accounts(account_id) ON DELETE CASCADE`. Same name on
the chain-built database and on the development one, so one `DROP CONSTRAINT`
covers every environment. `fintrack_prod_data` has no `budget_monthly_allocations`
at all, which is consistent with it being the 2026-08-21 dump: the alignment file
is what creates that table in production. (Their measurement, on databases the
owner authorized them to read; not re-run here.)

**The DOWN is real only until the first CLOSE, and that belongs in the header
before the file is written rather than discovered afterwards.** Pointing
`account_id` back at `category_budget_accounts` requires every surviving
`budget_monthly_allocations.account_id` to still exist in that table. Key 7 exists
precisely so allocations outlive the category, so the first closed category leaves
rows whose `account_id` is in the registry and not in the extension table, and
from that moment the DOWN cannot run without deleting exactly the rows the change
was made to preserve. **Same shape as 013's DOWN** (3.8.12), and it should be
stated the same way: real until the feature is used once, after which the rollback
is a data decision and not a schema one.

#### Why this contract keeps the reader change small

**The balance formula is already a builder that takes an alias.**
`derivedAccountBalanceSql(accountAlias, castAs)` (declared at
`derivedBalance.js:203`) reads exactly two things off whatever alias it is handed:
`${accountAlias}.account_starting_amount` at `:219` and
`${accountAlias}.account_id` at `:227`. Both are in the contract. **So a
historical population carrying those two columns satisfies the builder without the
builder changing at all**, and the twelve Overview reads plus `ledgerBody` change
where they take their population from, not how they compute.

**And one shared string is the widest single fix in the module: eight statements
on `main`, six here.** `TRANSACTION_ROW_SOURCE` (`transactionRowShape.js:90` on
`main`) opens with `JOIN user_accounts ua ON ua.account_id = tr.account_id` — an
inner join, so every transaction row of a closed account leaves all of them at
once:

| File | Statements |
|---|---|
| `overviewPageRepository.js` | the activity page at `:285`, the domain teaser's page at `:307`, and its `SELECT COUNT(*) AS total_rows` at `:318` |
| `overviewTransactionRepository.js` | `:45`, `:76`, `:99`, `:120`, `:155` |

**The count matters for how wide the fix is, not for whether it is one fix.** All
eight take the same string, so they cannot drift apart from each other — and that
is what makes this the well-built case: the teaser's page query and its
`COUNT(*)` both carry the shared source, so they drop the same rows and cannot
disagree. **The pocket pair in 6.5 is the counter-example** — there the page query
joins `user_accounts` and the count query does not, so the two disagree by exactly
the rows a closed account owns. Same mechanism, opposite consequence, because one
pair shares its source and the other does not. (Count and the eight sites measured
by the Overview session on `main`; verified here, including the six on this branch
— one in `overviewPageRepository.js` and five in `overviewTransactionRepository.js`.)

**That is the practical content of the owner's warning that this is not thirteen
joins.** Of the four mechanisms in 3.8.3 only the first is a join. The second
builds an id set `FROM user_accounts` and applies it as `t.account_id = ANY($1)`,
so it is fixed by widening the set. The third reads stock directly off
`user_accounts`, so it is fixed by pointing at the historical population. The
fourth is the cascade, which no read can fix; key 7 handles it for the budget and
the extension ruling accepts it everywhere else.

#### What no contract recovers

- **`category_nature_type_id` as a catalog key — removed from this list if the
  owner rules the three stamps above.** Without them the nature survives only as
  the third segment of `account_name`, split by `parseCategoryAccountName`
  (`newCategoryHelper.ts:26-33`), and the foreign key into `category_nature_types`
  does not survive at all.
- **The original capitalization of a budget category**, for the twenty-eight
  accounts sized in 3.8.12, because `account_name_case_backup_013.account_id`
  cascades.
- **`note`**, as above.

#### RULED: the contract is closed, by the owner, 2026-09-08

He approved the four recommendations as they stood — *cierra con tus
recomendaciones aprobadas*. **Nothing in this contract is open. Section 7 is
written against it.**

| Question | Ruling |
|---|---|
| Whether the registry stamps `category_name`, `subcategory` and `category_nature_type_id` | **YES.** It reopens what 10.3 closed, because fix 1 falsified that decision's premise for `category_budget` and for no other type |
| Whether `close_reason` is mandatory | **YES, NOT NULL, free text.** No statement reads it, so it constrains nothing technically; it is the only record of why an irreversible action was taken |
| Who writes the registry row at creation | **a BEFORE INSERT trigger on `user_accounts`**, and it is the schema's first side-effecting trigger — see below |
| Whether the backfill stamps existing live accounts | **NO, they stay null.** Those accounts are live, so their values are read from `user_accounts`; stamping them would create the two-writer problem this shape avoids |

**One consequence of the trigger ruling that has to be stated before the DDL is
written: the registry's `account_id` cannot carry a foreign key to
`user_accounts`.** A BEFORE INSERT trigger writes the registry row while the
account row does not yet exist, so such a key would refuse the very insert it is
meant to accompany. That is the right shape anyway — the registry outlives
`user_accounts` by construction — but it is a constraint the DDL has to omit
deliberately rather than by oversight. Column defaults are applied before BEFORE
ROW triggers fire, so `NEW.account_id` already carries the value the sequence
issued.

**The trigger, and a correction to how this plan justified it.** An earlier draft
of the row above said the schema already carries a trigger *so it is not a foreign
idiom here*. That overstates the precedent, and the migration session is right to
refuse it. Measured: `trg_users_timezone_is_iana` is the schema's **only** trigger,
and its function raises or returns —

```sql
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Invalid IANA time zone: %', NEW.timezone
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
```

— so it is an **assertion** trigger and it writes nothing. A registry writer
inserts into a second table. **This schema has no side-effecting trigger, and a
registry trigger would be its first.** The reason for it still holds — two
creation controllers plus the boot path cannot be kept honest by convention — but
the header says it is a deliberate step up, not something borrowed from
`assert_iana_timezone`.

**And it has to be declared in all three build paths, which is why the existing
one survives.** `assert_iana_timezone` is declared at `002_accounts.sql:57` with
its trigger at `:69`, at `supabase/001_production_alignment.sql:99` and `:111`,
and at `createTables.js:35` and `:47`. A registry trigger written only into the
chain file leaves the boot path building a database whose registry never fills,
and **`db:parity` compares tables and columns, so it would not see a missing
trigger** unless someone extends it. (Correction and the parity point from the
migration session; the three declaration sites and the single-trigger count
verified here.)

---

## 5. Which types CLOSE applies to

**The owner settled this on 2026-09-07 and the wording of his ruling is part of
it:** *las cuentas no son de categoria, son de category_budget, y si pueden
desaparecer por cierre.* Two things at once — the type is called
`category_budget` and an account of that type closes like any other. He had said
earlier the same day *las categorias no se cierran, porque no son cuentas*, then
withdrew it (*no lo puedes declarar como decidido*), then ruled the opposite.
Only the last one stands.

**This document does not call a `category_budget` account a category or a family
of categories.** He rejected both words: *una cuenta tipo category_budget no es
una categoria o familia de categorias, es una cuenta unica en `user_accounts`*.
It is one account row with one extension row, and it closes.

He ruled the income source in the same series: *las cuentas income tambien son
borrables*.

| Type | `account_types.account_type_name` | Closes? | Why |
|---|---|---|---|
| Bank | `bank` | yes | holds money the owner can move out |
| Cash | `cash` | yes | same, and the ordinary transfer path can empty it |
| Investment | `investment` | yes | holds a position that can be liquidated into a liquid account |
| Debtor | `debtor` | yes | holds an amount owed in one direction or the other |
| Income source | `income_source` | yes, **without the zero condition** | owner's ruling, 2026-09-07: *tambien es borrable, pero no se le exige que sea saldo cero* — see 5.1 |
| Budget account | `category_budget` | yes, **without the zero condition** | owner's ruling, 2026-09-07: *si pueden desaparecer por cierre*. The waiver is a recommendation acted on, not his words — see 5.1 |
| Pocket saving | `pocket_saving` | **no** | the type is to be removed entirely — see 5.3 |
| Compensation | `boundary` | **no** | the system's counterparty; the refusal is already written |

The first seven catalog rows are seeded by `005_base_catalogs.sql:37-44`;
`boundary` is added later by `031_add_boundary_account_type.sql`.

**A `category_budget` account and an `income_source` account are both rows in
`user_accounts` with an extension row and a derived balance, exactly like a bank
account.** That is now the ruling as well as the schema: seven of the eight types
are settled, and the only one that never closes is the compensation account.

### 5.1 The zero condition cannot be one rule for every type that closes

For the four types that hold money the condition is **derived balance equal to
zero**, computed by `derivedAccountBalanceSql` in `derivedBalance.js` — the
starting amount plus every movement except the account's own opening row. A
debtor's balance is signed by direction, but zero is zero in both directions, so
nothing special is owed there.

**On an income source that same condition refuses every account that was ever
used, and this is read off the writers, not off a database.** Recording income
inserts two rows: the source leg carries `amount: -numericAmount`
(`transactionController.js:828`) and the destination leg carries
`amount: numericAmount` (`transactionController.js:869`). The income source is
always the source leg — `getIncomeConfig` sets
`sourceAccountTypeName: 'income_source'` (`movementInputHandler.js:24`) — so
every income posts a negative row on it and its derived balance runs further
below zero with each one. An income source reaches zero only if it never
received anything.

**The same measurement applies to a `category_budget` account with the sign
reversed.** `getExpenseConfig` sets
`destinationAccountTypeName: 'category_budget'` (`movementInputHandler.js:16`),
so it only ever receives the positive leg and its balance runs above zero. It
inherits the problem unchanged, and the owner has ruled it closes.

**The owner ruled this himself on 2026-09-07, in the same message that made the
income source closable:** *la cuenta income_source tambien es borrable, pero no
se le exige que sea saldo cero*. So the zero refusal applies to `bank`, `cash`,
`investment` and `debtor`, and not to `income_source`. The reasoning agrees with
the measurement above — the figure on an income source is accumulated historical
income, not a holding, so no money sits there for the owner to move out first
and the refusal would protect nothing.

CLOSE is unchanged on an income source in every other respect: it moves no
money, writes no transaction, reverts nothing, and deletes the row.

**For a `category_budget` account the same waiver is a recommendation acted on,
not his words.** He ruled that it closes and said nothing about its balance. The
figure on it is accumulated historical spending, equally not a holding, and
applying the zero refusal would allow closing only an account nobody ever spent
on — which would make the ruling he just gave inoperative. It is recorded here so
he can overturn it in one line if that is not what he meant.

**So the zero refusal applies to four of the six types that close**: `bank`,
`cash`, `investment` and `debtor`. The two that classify movements rather than
hold money are exempt.

### 5.2 `income_source_accounts` is created by both build paths and never used

**The owner asked for this measurement on 2026-09-07** — *habria que borrarla
tambien de la tabla income_source_accounts, hay que verificar si esta tabla
realmente se usa*. Measured on `feat/deletion`, across `backend/src` and
`frontend/src`. The answer is that it is not used at all.

| Question | Answer |
|---|---|
| Is the table created? | Yes, in both paths: `002_accounts.sql:122` in the chain and `createTables.js:82-84` in the runtime builder |
| Does anything insert a row? | **No.** The only inserts into any extension table are `accountCategoryCreationcontroller.js:321` into `category_budget_accounts` and `accountCreationController.js:783` into `debtor_accounts` |
| Does anything read it? | **No.** The single `JOIN income_source_accounts` in the codebase is commented out, at `dashboardController.js:693` |
| Does any executable line name it? | One, and it is dead: `dashboardController.js:626` assigns `tableName = 'income_source_accounts'` |

**That assignment is provably dead, and the proof is in the same switch rather
than in an absence.** `tableName` is declared at `dashboardController.js:564` and
assigned in seven branches, and no line anywhere reads it. One of those branches
assigns `'investment_accounts'` (`:706`) — a table that is never created in
either build path, appearing only in a commented-out line of a documentation file
(`dev_queries.sql:27`). A variable naming a non-existent table without failing is
a variable nothing uses.

**So the owner's instruction is satisfied and there is nothing to write.**
Deleting an `income_source` account removes a row from `income_source_accounts`
through the cascade at `002_accounts.sql:122` if one exists, and none ever does,
because the account creation path writes only to `user_accounts`. The same holds
for `pocket_saving_accounts`. **Two of the four extension tables are live and two
are empty by construction:** `category_budget_accounts` and `debtor_accounts` get
rows; `income_source_accounts` and `pocket_saving_accounts` never have.

**Why that table and not another: the edit path never had the type.**
`accountEditController.js:318-322` declares the map that chooses which extension
table an edit writes to —

```js
const allowedTables = {
  category_budget: 'category_budget_accounts',
  pocket_saving: 'pocket_saving_accounts',
  debtor: 'debtor_accounts',
};
```

— three keys, and `income_source` is not one of them. The absence has a cause
rather than being an oversight nobody can explain. (Measured by the migration
session, verified here.)

**The map cannot produce a broken statement, and the reason is not where it
looks.** `:326` reads `const tableName = allowedTables[account_type_name];` and
`:361` interpolates it directly into `` UPDATE ${tableName} SET ``, with no guard
between the two — so on its face an `income_source` edit builds `UPDATE
undefined SET`. It cannot happen: the switch that fills `specificFields` starts
at `:89` and has exactly three cases — `pocket_saving` (`:90`),
`category_budget` (`:104`) and `debtor` (`:185`) — with **no `default`**, so for
every other type the object stays empty and `if
(Object.keys(specificFields).length > 0)` at `:317` never opens the block. The
switch and the map carry the same three keys, and the refusal lives at `:317`,
not between `:326` and `:361`. Recorded because the opposite conclusion was
reported and is wrong: five types are missing from that map, not one, and none
of them can reach the interpolation.

**The owner ruled on the measurement, the same day and in one line:** *yo creo
que esa tabla es descartable y habria que eliminarla, esto es tarea para
migration.* So the table is dropped, and **the work is assigned to the migration
session, not to this plan.** What this document owes it is the measurement above
and three facts it needs before writing the file:

- **Both build paths declare the table**, so a drop that touches only the chain
  leaves the runtime builder recreating it: `002_accounts.sql:122` and
  `createTables.js:82-84`.
- **The one executable line naming it cannot break.**
  `dashboardController.js:626` assigns the table's name to a variable nothing
  reads; it is a string, never executed as SQL, so dropping the table does not
  reach it. Removing that dead assignment is separate work and is not required
  for the drop.
- **The migration suspension is the owner's to lift**, and this ruling assigns
  the task without saying when it runs. Nothing in CLOSE depends on it.
- **A production count comes before the drop, and a local rehearsal cannot
  stand in for it.** `DROP TABLE` has a rollback that recreates the structure
  and can never recreate a row. Production's tables were built by the runtime
  builder long before the chain existed, so whatever wrote accounts then is not
  what writes them now, and no code either session can read proves the table is
  empty there. The asymmetry that makes this sharp: `initializeDatabase()` never
  runs on the deployed backend, so the boot path cannot recreate the table in
  production — the drop is permanent exactly where the risk is — while on a
  developer machine the next boot recreates it and the mistake repairs itself.
  (Migration session's analysis; the production read is the owner's alone.)
- **`pocket_saving_accounts` is not the same case and must not be dropped with
  it.** It has no `INSERT` either, but it is a value in the map above, it is
  special-cased by name at `accountEditController.js:353` for the
  `desired_date_source` branch, and `:361` updates through it — a live
  executable write path that `income_source_accounts` does not have. Same
  measurement on the writer side, opposite conclusion.

Nothing else in this plan changes: nobody designing the close writes a stamp, a
guard or a cleanup for a table that has never held a row.

### 5.3 The pocket saving type: already deleted, and still creatable

The owner ruled the type does not exist and that any surviving rows are to be
deleted physically. **An applied migration already did exactly that, and this
plan owes nothing.** `020_create_pocket_tables.sql:392-395` runs

```sql
DELETE FROM user_accounts ua
 USING account_types act
 WHERE act.account_type_id = ua.account_type_id
   AND act.account_type_name = 'pocket_saving';
```

with no user filter, no date filter and no guard: every row of the type in the
database, unconditionally. It is applied on the development database. Its own
rollback notes record production holding zero such accounts when measured, and
the type-required migration's header, measured on the development database on
2026-09-07, lists the type as seeded and unreferenced.

**So there is nothing to delete, and no new work is scheduled.** A migration
would be a corrective migration for something an applied file already did, which
this chain does not accept, and a script would delete zero rows. The earlier
draft of this section listed the deletion as blocked on the registry; that was
wrong, and it is not blocked, it is finished.

**What is genuinely unfinished is the half that lets the rows come back.** The
same migration deliberately left the catalog row in place, the boot path
re-seeds it (`populateDB.js:256` inserts the type by name) and the runtime
builder still creates its table (`createTables.js:130`). The type therefore
remains creatable, and the earlier deletion is final only for as long as nothing
writes a new one. Removing the catalog row is a migration with a real rollback
and a self-verifying property the retype-by-name migration lacks — the account
type reference now refuses a delete rather than blanking silently, so it either
succeeds against a genuinely empty population or errors. **It is gated on a code
sweep of the paths that still name the type** — the movement input handler, the
account edit controller, the account read helper, the creatable-type whitelist
and several dashboard branches — because today those are reads returning zero
rows, and removing the catalog row first would make the write paths among them
harmful. The sweep is not part of this plan and the migration is written after
it, never before.

**The newer pocket module is a different thing entirely** — its own table and
allocations over real accounts, with its own deletion, and it never touches
`pocket_saving_accounts`. Deleting a pocket there is not closing an account.

### 5.4 The income source closes, and what that costs

**The owner ruled on 2026-09-07 that an income source closes** — *las cuentas
income tambien son borrables* — reversing the recommendation recorded earlier
the same day, which had argued from a symmetry with the budget account. The
earlier text is superseded, not qualified.

Three consequences, each measured:

- **The balance refusal does not apply to it**, for the reason set out in 5.1:
  the income leg is always negative on the income source, so the zero condition
  would refuse every income source that ever received anything.
- **Its extension row is deleted with it, by the cascade — and there is never
  one to delete.** `income_source_accounts` keeps its own `ON DELETE CASCADE`
  primary key (`002_accounts.sql:122`), so the owner's rule is enforced by the
  schema, but the table has never held a row: no code inserts into it (5.2). The
  ruling is satisfied vacuously here and substantively on `category_budget`.
- **Every reader that joins the accounts table to attribute income by source is
  in the join inventory of 4.1** and behaves the same way it does for any other
  closed account: an inner join drops the movement, a left join keeps it with a
  null type. Closing an income source is not a special case for those readers.

What is **not** ruled and is not assumed here: whether a closed income source
still appears in the income form's source picker. That is a read filter, and it
sits with the other picker questions in 10.3.

---

## 6. Pockets, inside the close

**The owner ruled on 2026-09-07 that the close releases what the account has
committed:** *asi como cuando se cierra una cuenta bank, tambien hay que hacer la
liberacion de lo comprometido por esa cuenta en los pockets correspondientes.*
That is a step CLOSE performs, not a precondition it checks, and it runs before
the account row is deleted.

### 6.1 The ruling reaches two of the six types and no other

`pocketAllocationService.js:56` declares `const ELIGIBLE_SOURCE_TYPES = ['bank',
'cash'];` and `:217` refuses anything outside it with *only bank and cash
accounts can back a pocket*. So `investment`, `debtor`, `income_source` and
`category_budget` can never hold a commitment, and the release step is a no-op
for them by measurement rather than by assumption. The owner named `bank`; `cash`
is the other member of that array and takes the same step.

### 6.2 The zero-balance refusal does not already cover this

**A committed figure is not a balance, and the two are read separately.**
`lockOwnedSourceAccount` returns `accountAllocated` from `SUM(pa.amount)` over
`pocket_allocations` and `accountBalance` from a second statement over the
transaction ledger (`accountAllocationRepository.js:208-269`). The only place
they are compared is the allocate branch —
`const unassignedCash = money(account.accountBalance).minus(account.accountAllocated,)`
at `pocketAllocationService.js:345` — and that comparison is made **once, at the
moment of committing**, never afterwards. Nothing re-checks it when money later
leaves the account.

So an account can sit at a zero balance with a positive commitment: commit 300
while the balance is 500, then spend the 500. **The refusal this plan applies to
`bank` and `cash` is stated over the balance, so it admits exactly that account**,
and without the owner's ruling the close would delete an account that a pocket
still counts on. The ruling is operative, not decorative.

### 6.3 The existing service cannot be called from inside the close

`pocketAllocationService.release` is the right algorithm and the wrong entry
point, for three measured reasons:

- **It owns its own transaction.** `writeLedgerRow` runs `const client = await
  pool.connect();` at `:307`, `await client.query('BEGIN');` at `:310`, `await
  client.query('COMMIT');` at `:401` and `client.release();` at `:414`. A release
  committed on a second connection survives a rollback of the close, which would
  leave a released pocket beside an account that still exists.
- **It prices through a rate provider.** `convertTypedAmount` calls
  `currencyAmountConversion`, an HTTP round trip, and the module's own comment at
  `:295-299` says why that must not sit inside an open transaction. The close
  does not need it: what it releases is the net already stored in
  `pocket_allocations.amount`, which is in the accounting currency.
- **It refuses a deleted account.** `assertEligibleSource` throws at `:207` when
  `account.deletedAt !== null`. Harmless in the ordering below, and a reason not
  to reorder.

### 6.4 What the close writes instead

**One negative row per pocket, inside the close's own transaction, with the
account already locked.** The set comes from `getPocketsForAccount`
(`accountAllocationRepository.js:130`), which groups `pocket_allocations` by
pocket for one `source_account_id` and returns `heldFromThisAccount` as
`SUM(pa.amount)`, dropping the pockets whose net is already zero through `HAVING
SUM(pa.amount) <> 0` at `:142`. Each row is written through `insertAllocation`
(`:311`) with `amount` equal to the negative of that net.

**That is the same row the service would have produced**, because the ceiling on
a release is `getHeldByPocketFromAccount` (`:271`) and the refusal is
`requested.greaterThan(held)` at `pocketAllocationService.js:368` — releasing
exactly what is held is never refused. The sign is applied at `:378` and this
step applies it the same way.

**Six columns have to be filled and none of them may be null.**
`020_create_pocket_tables.sql:157-164` declares `original_amount`,
`original_currency_id`, `exchange_rate`, `exchange_rate_source`,
`exchange_rate_timestamp` and `exchange_rate_target_currency_id` all `NOT NULL`,
with `CHECK (exchange_rate > 0)`. Nothing is being converted — the figure is read
out of the same column it is written back into — so the fill is the identity, and
**the shape to copy already exists in this module's own code**:
`recordAnnulmentTransaction.js:169-172` writes `exchange_rate:
DEFAULT_EXCHANGE_RATE` and `exchange_rate_source: DEFAULT_EXCHANGE_RATE_SOURCE`,
declared as `1.0` and `'identity'` at `fxConfig.js:8-9`, with
`original_currency_id` set to the row's own currency and
`exchange_rate_target_currency_id` to `getCurrencyIdSync(ACCOUNTING_CURRENCY_CODE)`
resolved at `:127`. Its comment at `:124` states why the column defaults are
false rather than merely unset. (Precedent identified by the migration session,
verified here.)

**The two CHECK constraints decide the writer's control flow, not its values.**
`CHECK (amount <> 0)` at `020_create_pocket_tables.sql:151` means a pocket whose
net from this account is already zero takes **no row at all**, rather than a zero
row recording that nothing was released — a branch in the writer, not an edge
case discovered by a failing insert. `CHECK (exchange_rate > 0)` at `:160` means
"no conversion" cannot be expressed by leaving the rate at zero, which is why the
identity constants above are the fill and not a placeholder.

### 6.5 Releasing does not permit the delete, and does not remove the rows

**The restricting key stays.** `pocket_allocations.source_account_id` is declared
`REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE` at
`020_create_pocket_tables.sql:149-150`, and a release adds a row rather than
removing one — so after the release the account is referenced by more rows than
before and the delete is refused exactly as it was. **The release and the
repointing of this key at the registry are two separate requirements and neither
substitutes for the other.** Anyone reading the owner's ruling as a way to avoid
the sixth repointed key is reading it wrong.

**What has to go is the direct delete.** `eraseAccountTail.js:97` runs `DELETE
FROM pocket_allocations WHERE source_account_id = $1 AND user_id = $2`, which
destroys the allocation history instead of releasing it and defeats the
restricting reference that was meant to protect it. CLOSE does not run it.

**The surviving rows have a named consumer on the Overview branch, and the
release row this step writes is one of the rows it loses.** The history outlives
the close, keyed by an account id that resolves in the registry and not in
`user_accounts`. The defect is a **disagreement between two queries in the same
response**, not a total that quietly falls:

- `ALLOCATIONS_PAGE_QUERY` (`overviewPocketRepository.js:108`) carries `JOIN
  user_accounts ua ON ua.account_id = pa.source_account_id` at `:120`, taken only
  to read `ua.account_name AS "sourceAccountName"` at `:115`. An inner join, so a
  row whose source account no longer exists is dropped from the listing.
- `ALLOCATIONS_COUNT_QUERY` (`:129-135`) has no such join and counts the row.
- Both are issued together at `:210-211`.

So the count reports a number the listing cannot fill, with an empty trailing
page at the end of the pagination. **The release row written by 6.4 is dated in
the month of the close and names the account being closed, so it is precisely one
of the dropped rows** — the owner sees the count move and cannot see the decision
that moved it. (Measured by the Overview session, verified here on this branch;
an earlier draft of this section said the pocket's committed figure falls, which
is wrong — see the next paragraph.)

**The committed total is safe and needs nothing.**
`MONTHLY_ALLOCATED_NET_QUERY` at `overviewPocketRepository.js:81` joins `pockets`
and `pocket_allocations` only and never `user_accounts`, so the release rows land
correctly in the monthly series and in its transaction count.

**A second statement was recorded here as safe and is not — retracted on
measurement.** An earlier draft said the same key is read inside an `EXISTS` at
`overviewPageRepository.js:190`, which *cannot match a non-existent account and
is safe too*. Both halves are wrong. That statement does not exist on this branch
at all; on `main` it is `FREE_CASH_QUERY` (`overviewPageRepository.js:175-204`),
and the read is a scalar subquery, not an `EXISTS`:

```sql
      COALESCE((
        SELECT SUM(pa.amount)
        FROM pocket_allocations pa
        WHERE pa.source_account_id = ua.account_id          -- main :190
          AND pa.allocation_actual_date < (SELECT next_month_start FROM bounds)
      ), 0) AS allocated
    FROM user_accounts ua                                    -- main :193
    JOIN account_types act ON act.account_type_id = ua.account_type_id
    WHERE ua.user_id = $1
      AND act.account_type_name IN ('bank', 'cash')
```

`user_accounts` is the driving table of the `per_account` CTE, so a closed `bank`
or `cash` account leaves the CTE entirely and takes its `balance` and its
`allocated` with it. `SELECT COALESCE(SUM(GREATEST(balance - allocated, 0)), 0)
AS free_cash` at `main :198` then reports a smaller free-cash figure. **It is the
stock-read failure of 3.8.3, not an exception to it.** The claim reached this plan
through a relay, was written down without being opened, and is corrected here
rather than deleted.

**And it carries the signature of every other figure in 3.8: today identical,
elapsed months wrong.** For the current month the closed account contributes
nothing whether the row exists or not — the zero condition of 5.1 puts `balance`
at zero, and the release of 6.4 puts `allocated` at zero, so
`GREATEST(0 - 0, 0)` is zero either way. **It is a past reference month that
breaks**: the account did hold a balance then and did hold allocations then, both
terms fall together with the row, and the free-cash figure for that month drops
by what the account actually had free. (Refinement measured by the Overview
session on `main`; the outer statement at `:198` opened and verified here.)

**This is the cost of repointing that one key, not of the erasure**, and it is
recorded here so the repointing is decided with its consumer in view. The fix is
the Overview session's.

**Pocket coverage is derived and never stored** (`makePocketStatus.js`), so the
release is sufficient and there is nothing to recompute after it.

### 6.6 The order inside the close, for `bank` and `cash`

1. Lock the account row.
2. Read the pockets it backs, with their nets.
3. Write one negative row per pocket.
4. Stamp the registry row.
5. Delete the account row.

Step 3 before step 5 is not a preference: after step 5 the account id no longer
resolves in `user_accounts` and `insertAllocation` writes a column that still
references it.

---

## 7. The implementation spec

**This section is written against a closed contract.** The owner ruled decisions
A and B on 2026-09-08 (3.7), and closed the four remaining contract questions the
same day (4.6). Nothing below waits on a decision. **Nothing below is written
either**: production migrations are frozen by his instruction of 2026-09-07, and
this is the specification the work follows when that lifts.

### 7.1 The blocks, and why they are not five independent deployments

| Block | What it delivers | Cannot ship before |
|---|---|---|
| 0 | Production measurement of how much history the previous mechanism already destroyed | the owner: no session queries production |
| 1 | The registry table, its trigger, its backfill, and the seven repointed keys — **one chain file** | the migration suspension lifting |
| 2 | The readers resolving through the registry | block 1 |
| 3 | The close operation and its screen | block 2 |
| 4 | The other three methods commented out and the surplus screens retired | block 3 |

**Blocks 1 and 2 are reviewed apart and released together, ruled by the migration
session as chain owner.** None of the schema pieces is demonstrable on its own:
neither the `CREATE TABLE`, nor the backfill, nor the `ALTER` that repoints
`budget_monthly_allocations_account_id_fkey` changes one figure any query
returns, because the other removals in 4.6 still stand behind each of them. A
migration whose effect cannot be shown becomes a ledger row a later session reads
as proof the problem is solved. **So the schema is one file, its header names the
four removals and says which the file closes and which the reader closes, and it
lands in the same release as block 2.**

**That is a deliberate exception to the usual preference for the smallest
possible migration**, and the four-removal count is exactly what justifies it.

**Block 1 carries a hazard no automated check will catch.** `db:parity` builds
both paths from scratch and compares tables and columns, so it is **structurally
blind** to a missing trigger and reports clean while `createTables.js` lacks one.
Every piece of block 1 needs a hand-written counterpart in the boot path, and the
registry trigger is the piece parity cannot see at all.

### 7.2 Block 1, the schema

**Three build paths, every time.** The chain file, `createTables.js`, and
`supabase/001_production_alignment.sql` for anything the alignment file is still
allowed to carry. The two applied declarations of key 7 are sealed, so key 7
arrives as an `ALTER` and not as an edit (4.6).

**7.2.1 The table.** Fourteen columns, exactly the contract of 4.6, and three
constraints stated rather than assumed:

- **No foreign key on `account_id` into `user_accounts`.** The trigger writes the
  registry row before the account row exists, and the registry outlives it. This
  omission is the design, not a gap. **Demonstrated rather than reasoned**, below.
- **`user_id` NOT NULL**, and it is the only stamp written at creation beside the
  id itself.
- **The closure pair is a CHECK, not a column-level NOT NULL** — a column-level
  one would refuse every row the trigger writes at creation. The exact predicate
  is below, because the obvious spelling does not enforce what the owner ruled.

**Why the foreign key really fails, tested and not inferred.** The migration
session ran a probe against `fintrack_dev` inside one transaction that was always
rolled back, using only `CREATE TEMP TABLE ... ON COMMIT DROP` and a `pg_temp`
function, and reported zero surviving objects afterwards on every run. Three
results, recorded as theirs:

| Probe | Result |
|---|---|
| `account_id INT PRIMARY KEY REFERENCES parent(account_id)` plus a BEFORE INSERT trigger writing into it | **fails** — *insert or update on table "probe_registry" violates foreign key constraint*. The registry INSERT is its own statement inside the function, so its referential check fires at the end of THAT statement, before the outer insert completes |
| the same with the foreign key removed | **succeeds**, and the registry receives the row: `NEW.account_id` carries the sequence value inside a BEFORE INSERT trigger |
| `DELETE FROM parent` with no foreign key | **succeeds and the registry row survives it** — the registry outliving `user_accounts` is now demonstrated, not assumed |

They expected the first to pass, on the reasoning that referential integrity runs
in internal AFTER ROW triggers firing at end of statement. It does not, and they
recorded the correction under their own name.

**The mandatory reason needs a stricter predicate than "not null", and this is a
defect in an earlier draft of this section.** *Mandatory, free text* is not what
`CHECK (closed_at IS NULL OR close_reason IS NOT NULL)` enforces: measured, that
shape **accepts an empty string and accepts a run of spaces** — exactly the row
the requirement exists to prevent. The obvious repair is also insufficient:
`length(btrim(close_reason)) > 0` **accepts a newline and tabs**, because
one-argument `btrim` strips spaces only. The predicate that holds, verified across
eight cases by the migration session:

```sql
CONSTRAINT chk_close_reason_accompanies_closure CHECK (
 (closed_at IS NULL) = (close_reason IS NULL)
 AND (close_reason IS NULL OR close_reason ~ '[^[:space:]]')
)
```

**It accepts** both null — the row the trigger writes at creation — a real closure
with both present, and a reason padded around real text. **It refuses** a closure
with no reason, an empty string, spaces, a newline and tabs, and a reason with no
closure.

**That last case is a biconditional and it is deliberate.** An earlier draft said
*a reason is required when a closure exists*, which is an implication and would
accept a reason with no closure. The only writers are the trigger, which writes
both null, and CLOSE, which writes both, so a reason without a closure can only
come from a bug or a hand-written row, and refusing it costs nothing.

**One thing the null pair does not distinguish, and does not need to.** A live
account and an account the old mechanism erased both carry a null `closed_at`.
They are told apart by presence in `user_accounts`, which is the resolution rule
of 7.3, not by any column of the registry.

**The name and the parts can already disagree, and CLOSE is where that stops
being repairable.** The registry stamps `account_name` alongside `category_name`
and `subcategory` by the owner's ruling of 2026-09-08, and the convention is that
the first is the other two plus the nature joined by slashes. **One real account
breaks it, and a migration in the chain is what breaks it.** Measured by the
migration session on a throwaway restore of the production dump, run under the
owner's authorisation to test against the local copy and never against
production: `013_normalize_category_budget_name_case.sql` rewrote 27 account
names and backed up 28 rows, and account 122 is the difference.

| Column | After 013 |
|---|---|
| `user_accounts.account_name` | `bolsas/plasticas /other` — internal space kept |
| `category_budget_accounts.category_name` + `subcategory` | `bolsas` + `plasticas` — space gone |

**Both statements call `LOWER(TRIM(...))`, on different strings.** The name
`UPDATE` at `013:44-50` trims the whole name, where the space is internal and
survives, so the already-lowercase row fails its own `WHERE` and is skipped. The
parts `UPDATE` at `013:52-56` trims the subcategory alone, where the same space
is trailing. The backup `INSERT` at `:31-42` catches the row through its
`subcategory` arm, which is why 28 rows are backed up and 27 names changed.

**Before the migration the two agree, which inverts what the finding is.**
Measured in the backup table the migration itself writes: the stored subcategory
was `plasticas ` with the trailing space, and the name was composed from that
untrimmed part, so `bolsas` + `plasticas ` + `other` is exactly
`bolsas/plasticas /other`. **The convention held until 013 ran.** The divergence
is not a pre-existing defect the migration exposes; the migration creates it.

**And the same migration is what makes the repair possible, which is why the
state is self-correcting rather than merely broken.** `normalizeAccountName` is
`String(text).trim().toLowerCase()` (`helpers.js:56`) — it trims the ends and
never collapses an internal space. Recomposing from the *original* part would
rebuild `bolsas/plasticas /other` and heal nothing. The edit path yields the
consistent name **only because 013 already trimmed the part it recomposes from**.
Neither of the two statements alone leaves a state that fixes itself: the parts
`UPDATE` opens the window and supplies the correction, and the name `UPDATE`'s
skip is what leaves the window open in between.

**Today this heals itself and after CLOSE it cannot.**
`accountEditController.js:174-176` recomposes `account_name` from the stored
parts on any edit of a `category_budget` account, including a PATCH carrying no
category field, and the comment at `:143-147` states the intent: *"It also
repairs a name corrupted by an earlier partial edit."* **That is the only
recomposition site in `backend/src`** — one hit across the whole sweep, and
neither the close path nor the delete path is among them. So account 122
converges on its next edit of any kind. **But CLOSE deletes the account row, and
with it the edit path**, so an account closed while divergent leaves a registry
row whose stamped name and stamped parts disagree with no statement left that
could reconcile them.

**No constraint binds the stamped name to the stamped parts, ruled by the
migration session as chain owner and by this plan as registry owner.** Two
reasons, and the second is the one to quote.

**First, the creation order forbids it.** The extension row is inserted after the
account row — `category_budget_accounts.account_id` is a primary key referencing
`user_accounts`, so the order is structural, and the insert sits at
`accountCategoryCreationcontroller.js:321`. At the moment the BEFORE INSERT
trigger writes the registry row, the parts do not exist yet, so the registry
cannot assert anything about them.

**Second, and this is the reason that generalises: a CHECK is a rule about every
row that will ever be written, and the registry's rows are records of something
that already happened.** A constraint there would not prevent a bad state, it
would prevent *recording* a state that exists anyway. Account 122 is closed by an
owner who did nothing wrong, and the close fails — not because the closure is
invalid, but because a migration trimmed one column and skipped another months
earlier. **The one account that documents the 013 asymmetry would become the one
account that cannot be closed.** The guard would protect the schema from the
truth.

**That is a ruling about this relationship and not a licence to drop constraints
from the registry.** The line: a constraint that describes the registry's own row
belongs, and a constraint that describes the world the row is about does not. The
closure timestamp and its reason appearing and disappearing together is a
property of the record itself and stays a CHECK (7.2.1). The name agreeing with
the parts is a property of the account's history, which the registry observes and
does not govern.

**Where the divergence surfaces instead: a read, not a constraint.** A query
listing closed accounts whose stamped name is not the composition of its stamped
parts costs nothing, refuses no closure, and stays correct when a future partial
edit produces the same shape — which `accountEditController.js:143-148` records
as having happened once already. Not specified here and not required by any
block; noted so that whoever wants it knows where it goes.

**What the design does require** is that a reader take the name from
`account_name` and never rebuild it from the parts — which 7.3 already says for a
different reason.

**7.2.2 The trigger, and what makes it new here.** A BEFORE INSERT row trigger on
`user_accounts` that inserts `(account_id, user_id)` into the registry. Two
creation controllers plus the boot path cannot be kept honest by convention,
which is the reason for it. **It is the schema's first side-effecting trigger**:
`trg_users_timezone_is_iana` is the only trigger that exists and its function
raises or returns `NEW` and writes nothing (4.6). That is a deliberate step up
and the file header says so.

**7.2.3 The backfill, and what it cannot reach.** One row per **live** account,
carrying `account_id` and `user_id` and nulls everywhere else — the owner ruled
live accounts are not stamped, because their values are read from
`user_accounts` and a stamp would create a second writer. **Accounts the old
mechanism already erased are a different problem and block 0 owns it**: their
ids are recoverable only where a surviving reference still names them, and 4.4
records that such a row can carry nothing but nulls anyway.

**7.2.4 The seven keys.** Six repointed from `user_accounts` to the registry, and
the seventh, `budget_monthly_allocations.account_id`, repointed from
`category_budget_accounts`.

**`transactions` carries four of the six, not three.** An earlier draft wrote
*the three on `transactions`, `opening_for_account_id`, …*, which sends a reader
looking for the opening marker on another table. Read from `pg_constraint` on
both local databases by the migration session, identical lists, so this is the
chain's shape rather than one database's:

| Repointed | Today's rule |
|---|---|
| `transactions_account_id_fkey` | RESTRICT |
| `transactions_source_account_id_fkey` | RESTRICT |
| `transactions_destination_account_id_fkey` | RESTRICT |
| `transactions_opening_for_account_id_fkey` | RESTRICT |
| `pocket_allocations_source_account_id_fkey` | RESTRICT |
| `debtor_accounts_selected_account_id_fkey` | **SET NULL** |

**Not repointed: five, all CASCADE** — the four extension primary keys, kept by
the owner's ruling of 2026-09-07, plus
`account_name_case_backup_013_account_id_fkey`.

**One of the six changes behaviour in the opposite direction from the other five,
and it has to be ruled rather than absorbed.** Five are RESTRICT, so repointing
them **removes a refusal**. The sixth is `ON DELETE SET NULL`
(`002_accounts.sql:179-180`), so repointing it **removes a cleanup**: today,
deleting a bank account nulls every debtor's `selected_account_id`; after the
repoint the delete no longer touches it and the pointer survives, naming a closed
account.

**That is the behaviour this design wants, and the reason is the same one the
registry exists for.** Today's SET NULL destroys the historical fact of which
account a debtor was opened against — the same class of loss as 3.8. Under the
registry the surviving id still resolves, so the fact is preserved instead of
erased. **What must not survive with it is the stale name.**

**`selected_account_name` is written once, at creation, and never maintained.**
Measured here, correcting a relayed claim that it is written in exactly one
place: it is inserted with the debtor row at
`accountCreationController.js:785` and `:795`, set to NULL once by
`020_create_pocket_tables.sql:386`, and read at `getAccountController.js:836`.
**`accountEditController` never touches it**, so renaming the referenced account
already leaves it stale today, before any of this. **The reader takes the name
through the id — live from `user_accounts`, historical from the registry — and
`selected_account_name` stays what it already is: a creation-time snapshot no
statement maintains.** That is 7.3's resolution rule applied to this column, and
it needs no schema change.

**The seventh key is confirmed against the catalog too**:
`budget_monthly_allocations_account_id_fkey` is `ON DELETE CASCADE` into
`category_budget_accounts` on both databases, exactly as 4.6 records.

**The seventh is dropped by the name Postgres generated**, because the
declaration is inline and unnamed:
`budget_monthly_allocations_account_id_fkey`, identical on both local databases.

**7.2.5 The DOWN, and the date it stops being real.** Pointing
`budget_monthly_allocations.account_id` back at `category_budget_accounts`
requires every surviving allocation row's account to still exist in that table —
which is exactly what key 7 exists to make false. **From the first close of a
`category_budget` account, the DOWN cannot run without deleting the rows the
change was made to preserve.** Same shape as 013's DOWN (3.8.12), and the header
states it before the file is written rather than leaving it to be discovered.

### 7.3 Block 2, the readers

**The resolution rule, in the owner's own shape:**

```
account present in user_accounts  → read identity and stock live
account absent                    → read historical identity from the registry
                                  → read the movements, which were never touched
```

**No transaction row is rewritten. This is not a history reconstruction**, and
the owner ruled out that framing — *no hay que reconstruir la historia modificando
transactions*.

**A read branches on presence in `user_accounts`, never on `closed_at IS NULL`.**
The registry cannot tell a live account from one the old mechanism erased —
both carry a null `closed_at` (7.2.1) — so the column answers a different
question than the one a reader is asking. **The Overview module already satisfies
this by absence**: measured across
`backend/src/fintrack_api/services/overview_services/`, there is **no executable
predicate on `closed_at`, `deleted_at` or any soft-delete flag**; the three hits
are comment text at `overviewAccountRepository.js:8`, `:13` and `:196`. Its id
sets read `FROM user_accounts` with no such filter, deliberately, because an
account deleted last week still spent money while it existed. (Measured by the
Overview session, verified here.)

**But the header that justifies that choice rests on a claim the code no longer
supports, and block 2 replaces the reasoning rather than re-anchoring the
citation.** `overviewAccountRepository.js:12-16` reads:

```js
// Deleting an account is a soft delete (deleteAccountService.js:362-372 marks
// deleted_at and nothing else), so its transactions survive the account.
```

Measured at HEAD on `main`, `deleteAccountService.js:362-372` is the **erase**
block — its own comment reads *6. Erase the target: detach and scrub every
surviving reference to it, then drop its own rows and the account*, with
`await eraseAccountTail(dbClient, userId, targetAccountId, accountName)` at
`:367` and a log at `:369` reading *ERASED*. The soft-delete
`UPDATE user_accounts ua SET deleted_at = CURRENT_TIMESTAMP` now lives at `:513`.
**The citation names the opposite mechanism.**

**And the consequence is not cosmetic.** Omitting a `deleted_at` filter protects
the reconciliation only on the path where the row survives. On the erase path the
row is gone from `user_accounts`, so the account never enters the id set, no
filter is involved, and the breakdown loses the spending exactly as the comment
says it must not. **The header claims a guarantee the module does not have — and
CLOSE makes that path the only path.** So block 2 does not fix a citation; it
makes the claim true for the first time, by resolving the absent account through
the registry.

**Editing that comment is not this plan's to do.** It belongs to a set of
sixteen comment corrections the Overview session found in its own module and has
not opened, pending the owner's answer on whether to open them.

**Four mechanisms, and each takes a different edit.** 3.8.3 enumerates them; the
join is only the first:

| Mechanism | What changes |
|---|---|
| An inner join to `user_accounts` taken only to read a name | becomes a resolution against the registry, or a LEFT JOIN plus a coalesce over the two sources |
| A driving table that is `user_accounts` | the row set has to come from the registry for elapsed periods, not from the live table |
| An id array built from `user_accounts` and then used as `= ANY($1)` | the array has to include closed ids when the question is about an elapsed period |
| An aggregate over live accounts — `MIN(ua.created_at)` in `OLDEST_ACCOUNT_DATE_QUERY` (`overviewAccountRepository.js:212-213` on this branch, `:231-232` on `main`) | the window's own start date moves when the oldest account closes. **This is the worst of the four**, see the delta guard below |

**The single widest edit is one shared string.** `TRANSACTION_ROW_SOURCE` opens
with `JOIN user_accounts ua ON ua.account_id = tr.account_id` and feeds eight
statements on `main` and six on this branch (4.6), so all of them move together
and cannot drift apart.

**A page query and its `COUNT(*)` are reviewed as a pair, never one at a time.**
The domain teaser's two statements both carry the shared source, so they drop the
same rows and cannot disagree. The pocket pair used to be the counter-example and
**is now the worked repair**, landed by the Overview session on `main` at
`79f061e4` and verified here:

- `ALLOCATIONS_FILTER` (`overviewPocketRepository.js:112`) is the single `WHERE`
  clause, interpolated into `ALLOCATIONS_PAGE_QUERY` at `:140` and into
  `ALLOCATIONS_COUNT_QUERY` at `:148`, with the same three placeholders. The two
  cannot disagree about which rows the month holds.
- `LEFT JOIN user_accounts ua ON ua.account_id = pa.source_account_id` at `:138`.
  The join supplied `account_name` and nothing else — amount, date, `pocket_id`
  and `source_account_id` all sit on `pocket_allocations` — so **a close now
  costs the name and no longer costs the row**.
- `sourceAccountName: row.sourceAccountName ?? null` at `:236`, so a reader
  branches on a null value rather than on a missing key, and registry-sourced
  identity has a field to land in.

**The other two joins in that file stay inner deliberately**: an allocation cannot
outlive its pocket, and `currencies` is a catalog nothing deletes from. That is
the shape this block reproduces elsewhere — LEFT only where the row must survive
the absence, and a shared filter so the pair cannot drift.

**The budget read is the one with four removals and it is the acceptance test of
this block.** A `category_budget` account closed in September must leave March's
budget figure unchanged, and its own series must end at zero from the closing
month on. If closing an account moves an elapsed month, the block is not done —
that is the owner's rule, *una accion sobre la cuenta en septiembre no puede
modificar retrospectivamente marzo*.

**The test is not complete at "the total is unchanged", and the oldest-account
aggregate is why.** Measured by the Overview session, verified here: that
aggregate is the guard on the period delta.

```js
const hasCompletePriorPeriod = (oldestAccountDate, priorMonth) =>   // makeDomainCard.js:35
 oldestAccountDate !== null && oldestAccountDate < priorMonth;      // :36
```

It is read at `:57`, and when it turns false `makePeriodDelta` returns
`delta: null` — **the figure disappears rather than changing**, which is quieter
than a wrong number.

**Four of the six cards route through it**, verified by following the import:
expense, income and pnl call `getOldestAccountDate` directly
(`overviewExpenseService.js:88`, `overviewIncomeService.js:86`,
`overviewPnlService.js:80`), and debt reaches it through `readStockDomain`
(`stockDomainCalculator.js:110`, whose only caller is
`overviewDebtService.js:64`). Pocket and investment do not.

**So closing the owner's oldest account can make the delta vanish from four cards
at once, retroactively, for a month that already had a complete prior period** —
the guard compares one date against the prior month and reads today's account set
whatever month is being served. **The acceptance test is therefore: March's total
unchanged AND March's `delta` still non-null.**

**One failure mode to guard explicitly**: a registry-sourced row that reaches
`makeCategoryGroups` with a null `categoryName` throws on
`.sort(([a], [b]) => a.localeCompare(b))` before any group is built, and
`makeBudgetCategoryStatus.js:40-41` refuses it after that. Rows backfilled with
nulls (4.4) hit this, so the reader branches on the null rather than passing it
through.

### 7.4 Block 3, the close operation

**The sequence, and the order is load-bearing:**

1. **Validate and refuse the system accounts.** The guard is already written and
   already has both arms — it refuses by non-creatable type and by reserved name,
   both evaluated before any branch (`deleteAccountService.js`). The compensation
   account never closes, by the owner's ruling.
2. **Refuse unless the derived balance is zero** — on `bank`, `cash`,
   `investment` and `debtor` only. `income_source` skips this by his ruling, and
   the reason is measured off the writers: the income source is always the source
   leg and that leg carries a negative amount, so its balance runs below zero
   with every income.
3. **Release what the account committed to pockets.** `bank` and `cash` only —
   `ELIGIBLE_SOURCE_TYPES` at `pocketAllocationService.js:56` is exactly those
   two. CLOSE writes one negative `pocket_allocations` row per pocket inside its
   own transaction; it cannot call `pocketAllocationService.release`, which owns
   its own connection. **The release does not permit the delete** (6.5).
4. **Stamp the registry row** — the twelve closure columns of 4.6, including
   `close_reason`, the resolved `currency_id`, and for a `category_budget`
   account the three extension columns **read before the cascade fires**.
5. **Write the terminating zero** — one `budget_monthly_allocations` row for the
   current month at amount zero, for a `category_budget` account. This is fix 1's
   second half: elapsed months keep their rows, and the series ends at zero from
   the closing month on.
6. **Delete the `user_accounts` row.** The four extension cascades fire here.

**Steps 4, 5 and 6 are one database transaction, and step 4 precedes step 6, or
the identity goes with the row and the surviving transactions become
uninterpretable.** Step 4 also precedes the cascade in step 6 for a stronger
reason: after the cascade the extension row it reads no longer exists.

**What must never run: `eraseAccountTail.js:97`**, which deletes
`pocket_allocations` rows directly and destroys the history the restricting key
exists to protect (6.5). CLOSE does not call it.

### 7.5 Block 4, the retirement

The three other methods are commented out with the date and a reason, never
deleted, per the standing rule. The sites are enumerated in section 9. Of the
thirty-four files in the deletion page, those of the impact report, the reversal
modal, the hard-delete confirmation and the deactivation view are left with no
method behind them.

### 7.6 The frontend, per block

- **Blocks 0 to 2:** no screen changes.
- **Block 3:** the screen lands **with** the backend, not after it. The refusal
  gate is useless if the owner cannot see why the button is disabled or where to
  go and settle the balance, and `close_reason` is a mandatory form field. The
  screen also warns that the budget goes with the account, which his ruling
  settles the mechanics of but not the disclosure, and the action is
  irreversible.
- **Block 4:** the surplus screens are retired.

The block-three screen is designed by the frontend design session before the
component is written.

### 7.7 What this spec deliberately does not cover

- **Production state.** Whether the chain has run there and which filenames its
  `migrations` table names are the owner's reads alone (section 11), and the
  closure-timestamp column is a deployment blocker independent of this design
  (section 8).
- **Any figure measured on a database.** Nothing here was run; the schema is
  frozen.
- **The budget writer's blind update by account id alone**
  (`budgetAllocationService.js`), which belongs to whoever owns that service and
  is not a risk this plan creates (10.3).

---

## 8. Collisions with the migration chain

Ruled by the migration session on 2026-09-07. Nothing is written; the suspension
is untouched.

- **The account-closure movement type migration stays**
  (`032_add_account_closure_movement_type.sql`), and not for the settlement.
  Two things ride in that file and only one is about closing. It is the file that
  rewrites the movement-type check constraint, which is the single constraint
  difference schema parity reports between a chain-built and a boot-built
  database — one difference in the entire schema. Dropping the file reopens a
  measured parity gap to save two catalog rows nobody would read, and three
  values in that same catalog are already seeded and unreferenced. It also
  carries the conflict-tolerant fix on two seeders, without which a chain-built
  database fails on its first boot.
- **The closure timestamp column migration cannot be held out of the chain, and
  it is a deployment blocker rather than a design question**
  (`034_add_account_closed_at.sql`). The migration session first ruled it could
  be skipped because the new design never writes it, then withdrew that ruling
  under its own name: the question is not what writes the column, it is what
  **reads** it. Measured on main, **eight files name it in SQL** — the account
  read controller through a live-account predicate interpolated into nine
  statements plus the closed-accounts list, the category collision check, the
  rename collision check, the deletion service's soft path, the close preview,
  the close destination query, the pocket allocation repository, and the shared
  account-retrieval helper. On a database the migration has not reached, every
  one of them raises a missing-column error, and the shared helper carries the
  widest blast radius because it is imported rather than owned by one route.
  Production never reaches the boot path — the deployed backend never calls the
  runtime initializer — so the chain is the only way that column arrives. **This
  is independent of CLOSE:** whether the column is useful afterwards is a much
  smaller question than whether main boots without it.
  **The ledger read settled the rest.** The owner authorized it and it was run
  against the development database: the closure-movement-type file, the
  type-required file and the closure-timestamp file are all applied there. So the
  file is not optional, cannot be held out, and lands as written; if its column is
  ever removed under this design that is a forward migration decided later. **The
  half that remains is production**, which the development database says nothing
  about — the whole hazard is that development is ahead.
  Note the asymmetry with the same absence elsewhere: the deletion service's four
  branch tests read it as a JavaScript property off a star select, which fails
  silently and grants nothing, while the eight SQL sites fail loudly. Same
  missing migration, opposite failure mode, and only one of the two is visible.
- **The type-required migration must run before any closure stamps a type.** It
  is what makes the account type column not-null; before it a live account can
  carry null, and a closure would stamp null into the registry permanently. That
  is an ordering constraint on the first close, not on the table.
- **The queued migration adding counterparty-name columns to transactions is
  superseded and retired by the migration session.** The registry gives every
  historical row its counterparty's name through a join on an id that still
  resolves, which is strictly better than a denormalized column per row.
- **The restricting-keys migration's assertion becomes historical.** It states,
  in an applied and therefore uneditable file, that transactions carries exactly
  three foreign keys to accounts and that all three restrict. Repointing them
  makes that false, so the registry migration carries the correction in its own
  header — the same mechanism already used once in this chain.

---

## 9. What the current code hands down

Measured facts the plan has to handle even though they are not part of its
design.

- **The current service refuses every deletion on a database missing the closure
  timestamp column.** The row is fetched with a star select, which never names
  that column, and the branch test is a JavaScript property read, so an absent
  property compares as not-null and every account reads as closed. It fails
  silently, with a message asserting something false.
- **The current erasure tail leaves a detectable signature only on the
  counterparty** — a nulled origin or destination plus a marker inside the
  description — and **deletes the account's own rows without a trace.** The
  second half is not recoverable.
- **The close method already half exists, and the owner ruled on it on
  2026-09-07** — *DELETION_TYPE_CLOSE, con politicas TRANSFER/DISCARD, ruta de
  preview y un expectedResidual que mueve dinero, eso correspondia a un plan
  original que lo estamos refactorizando, y tu formas parte de eso.* So the name
  is not contested: the money-moving implementation is what this plan replaces,
  and the constant keeps its spelling. What exists today, all in
  `accountDeleteController.js` unless stated:
  - `export const DELETION_TYPE_CLOSE = 'CLOSE';` at `:27`, beside `RTA` `:24`,
    `HARD` `:25` and `SOFT` `:26`.
  - `export const CLOSE_POLICY_DISCARD = 'DISCARD';` at `:34` and
    `export const CLOSE_POLICY_TRANSFER = 'TRANSFER';` at `:35`.
  - `getCloseAccountPreview` at `:145`, behind the route
    `/delete/close_preview/:targetAccountId`.
  - `req.body.policy` at `:289`, `req.body.destinationAccountId` at `:292-293`
    and `req.body.expectedResidual` at `:302-303`.
  - `deleteAccountService.js:860`, whose own comment reads *6c MARK: CLOSE keeps
    the row* — the opposite of what CLOSE now means.
  - `const CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED = true;` at
    `deleteAccountService.js:628`.
  **Per the standing rule that code is commented rather than deleted, each of
  these is commented out with the date and this section as the reason**, in the
  same way 10.1 rules for the other three methods.

---

## 10. Decisions

### 10.1 Settled by the owner on 2026-09-07

| Decision | Ruling |
|---|---|
| The four money types close | `bank`, `cash`, `investment` and `debtor` |
| The `category_budget` account closes | *las cuentas no son de categoria, son de category_budget, y si pueden desaparecer por cierre*. Said to this session directly and, in the same words, to the Overview session |
| The income source closes | *las cuentas income tambien son borrables*, reversing the recommendation recorded earlier the same day |
| The income source is exempt from the zero condition | *tambien es borrable, pero no se le exige que sea saldo cero* |
| Closing releases what the account committed to pockets | *asi como cuando se cierra una cuenta bank, tambien hay que hacer la liberacion de lo comprometido por esa cuenta en los pockets correspondientes*. It is a step CLOSE performs before deleting the row, and it reaches `bank` and `cash` only — see 6 |
| The budget goes with the budget account | *category_budget tiene un presupuesto asociado, asi que con su borrado, se borra el budget asociado a ella*. Both cascades are therefore intended: `category_budget_accounts` and, through it, `budget_monthly_allocations` — see 3.5 |
| `income_source_accounts` is dropped | *yo creo que esa tabla es descartable y habria que eliminarla, esto es tarea para migration*. Measured first: created in both build paths, never inserted into, never read — see 5.2. **Assigned to the migration session**, not to this plan |
| The extension row is deleted with the account, by id | *cuando se borra hay tambien que eliminarla de esta otra tabla, buscando no por nombre sino por id*. The cascade on `002_accounts.sql:141-143` already does exactly this, so no code and no migration are owed — but it reverses the migration session's plan to repoint those four keys, and the repointing count drops from nine to six (4.3) |
| The pocket saving type | it does not exist; any surviving rows are deleted physically — already done by an applied migration, see 5.2 |
| The zero condition, on the four money types | derived balance equal to zero, for `bank`, `cash`, `investment` and `debtor` only |
| The close reason | a new field on the close, stored on the registry row |
| The new CLOSE keeps the name `CLOSE` | *DELETION_TYPE_CLOSE, con politicas TRANSFER/DISCARD, ruta de preview y un expectedResidual que mueve dinero, eso correspondia a un plan original que lo estamos refactorizando, y tu formas parte de eso*. The money-moving implementation behind that constant is what is being replaced, not something to coexist with — see 9 for the six sites |
| The other three methods | their route registrations and their service bodies are commented out, not removed |
| The migration ledger read | authorized and performed |
| The close screen is not commissioned yet | *no hacer nada*, 2026-09-07, in answer to whether the design session should be given phase four now |

### 10.2 Settled the same day, on a recommendation the owner endorsed

| Decision | Ruling |
|---|---|
| A closed account's name is **not** renamed with a suffix | deleting the row already frees the name — the rename collision check joins the accounts table and finds nothing. A suffix would be stored as the registry's historical name and would then appear on transactions that happened before the close. To tell two same-named accounts apart in a report, the screen uses the closure date the registry already carries. |

**Two rows that stood here earlier the same day have been removed, not
amended, and the owner reversed both within hours.** The income source was
recorded as not closing; the `category_budget` account as outside this plan. He
overturned the first, withdrew the second — *no lo puedes declarar como
decidido* — and then ruled it the other way. Both now sit in 10.1 as his
decisions. They are kept in view here because the reasoning that produced them
was mine and it was wrong twice on the same argument: that an account which
classifies movements is not really an account.

### 10.3 Open, and the owner rules

**The owner ruled the budget question on 2026-09-07** — *category_budget tiene
un presupuesto asociado, asi que con su borrado, se borra el budget asociado a
ella* — so it is in 10.1 and not here. The analysis that produced the same answer
is kept below, because it is the reason no seventh key is repointed and because
it names the one loss his ruling does **not** cover.

- **Preserving the rows preserves nothing observable — SUPERSEDED as a
  conclusion, correct as a measurement.** Repointing
  `010_create_budget_tables.sql:42-43` at the registry keeps the allocation rows,
  and all the readers still miss them: the account id list roots in
  `user_accounts` (`overviewAccountRepository.js:32-39`) and the budget totals
  inner-join both `user_accounts` and the extension table
  (`budgetTransactionRepository.js:132-133`). **That is still true and it is why
  the key alone is not enough**, but the owner ruled on 2026-09-08 that the
  history must stay correct, so the answer is to change the readers rather than
  to let the rows go. 4.6 counts the removals: four, of which this key closes
  one.
- **Letting them go costs nothing extra**, because it is what the schema already
  does and because the loss the user actually experiences arrives by another
  route entirely.
- **The loss the user experiences is retroactive and upstream.**
  `getAllocationForMonth` recomputes each month's budget live from the rows that
  exist when the question is asked, so closing a budget account lowers the budget
  reported for every past month. That is owned by the budget module and is open
  with the owner through the Overview session. Nothing in the close sequence
  prevents it.

| Decision | Recommendation |
|---|---|
| Whether the confirmation screen warns that the budget goes with the account | **yes.** His ruling settles what happens; it does not say whether the user is told before it happens, and the deletion is not reversible. One line on the close screen. |
| Which of the four fixes for the retroactive lowering is taken | **CLOSED — fix 1, ruled by the owner on 2026-09-08.** Repoint `budget_monthly_allocations.account_id` at the registry, write a terminating zero at closure, and let the budget readers find a closed category for elapsed months. Recorded in 3.7, and its consequence for the registry in 4.6. |
| Whether a closed account still appears in a picker or a historical list | a filter on a read, not a schema change; nothing depends on it, and it waits for the close screen |

**One thing no decision here changes.** The statement at
`accountCategoryCreationcontroller.js:163` names `ua.closed_at`
syntactically — `AND (ua.closed_at IS NOT NULL OR ua.deleted_at IS NULL)` — so
it fails against a database lacking that column whatever is ruled above. The
deployment blocker in section 8 is untouched.

Outside this plan's scope but found by it, and with no owning session running:
**the budget writer updates a category's budget by account id alone**
(`budgetAllocationService.js`), while the same service's other statement joins the
accounts table and is self-filtering. With the extension row now deleted by the
cascade, the first path writes zero rows instead of writing onto a closed
category, so it is no longer a risk this plan creates — it stays a weakness of
that service, which reports nothing when the account is missing. It goes to
whoever owns the budget service.

Two decisions that stood in the first version of this document are **closed, not
deferred**, and the owner closed them in opposite directions on the same day:

- **Whether the registry stamps the type-specific attributes: it does not —
  REOPENED AND AMENDED on 2026-09-08, for one type only.** The reason given here
  was that the extension row is deleted with the account, so there is nothing to
  stamp. Fix 1 falsified that reason for `category_budget`: after the seventh key
  its allocation rows outlive the account and need three columns that died with
  the extension row, so the registry stamps `category_name`, `subcategory` and
  `category_nature_type_id`. **The other five closable types are unchanged** and
  their roughly thirty type-specific columns still die at close. The registry
  carries fourteen columns, not four; 4.6 is the contract.
- **What happens to the debtor's copied account-name column: nothing, and its
  reference stops blanking.** `debtor_accounts.selected_account_id` is repointed
  at the registry, which is a different account from the one the debtor row
  belongs to, so the ruling above does not reach it. **7.2.4 now states this as a
  behaviour change and gives the reason**: it is the one repointed key that
  removes a cleanup rather than a refusal.

---

## 11. Measurements no session can make

Both are production reads, and no session queries production.

**Partially superseded on 2026-09-07, and the distinction is what matters.** The
owner authorized the migration session to test against **the production copy held
locally** — *lo que si puedes ir probando es en la copia de produccion que esta
en local*. That is not production: the copy is `fintrack_prod_data`, 1 user, 100
`user_accounts`, 785 transactions, an empty `migrations` table and no
`account_name_case_backup_013`, which is exactly the state
`001_production_alignment.sql` describes production as being in **before** the
alignment ran. **The copy is the dump of 2026-08-21 and everything measured on it
is evidence about that date**, not about production today. The second local
database, `fintrack_rehearsal`, holds no users, accounts or transactions and is a
chain-built empty database stopped at 030 — not a copy of anything.

Two questions this plan had deferred are answered on that copy, and both are
recorded as measurements of 2026-08-21:

| Question | Answer on the copy | What it settles |
|---|---|---|
| The row count of `income_source_accounts` | **zero**, while two accounts are typed `income_source` — `From_CDDS` (51) and `local chinita` (107), neither with an extension row | the empty-by-construction finding of 5.2 now rests on production data, not only on the development database |
| How many accounts are named `slack` | **one**, `account_id` 45, typed `bank` | the unstated precondition of migration 031 holds in that copy |

**What the copy cannot answer stays open**: whether the migration chain has run
in production, and which migration filenames production's `migrations` table
names. Both need a read of production itself, both are the owner's alone, and
production migrations are frozen by his instruction of the same day. (Measured by
the migration session under the owner's authorization; not re-run here, because
that authorization was given to them and a relayed grant is not a grant.)

**The first one was specified wrongly in the draft of this plan, and the
correction matters more than the count.** Counting rows with a null origin or
destination plus the deleted-account marker cannot key anything: after the
erasure tail runs, **no surviving row carries the erased account's id in any
column** — origin and destination are nulled by the two updates, and the rows
carrying it as owner and as opened account are removed by the final delete. The
registry is keyed by the original id, so for already-erased accounts the backfill
answer is neither "all" nor "part": it is **zero rows**, and that is decided by
the code, not by a count. The predicate is also wrong in both directions — a null
origin or destination is an ordinary state on ordinary rows, and the marker
appears only where the account's name was literally a substring of that row's
text.

- **The exact signature is in the annulment writer, and it is the count worth
  authorizing.** Both annulment rows draw owner, origin and destination from the
  affected account and the compensation account (`recordAnnulmentTransaction.js`,
  the source and destination determination at lines 131-132 and both option
  objects); **the target is in none of the three**. So the scrub never matches
  them and the final delete never matches them: they survive, carrying the
  deleted account's name verbatim inside the annulment prefix's parentheses. That
  is the only place a physically deleted account's name still exists. The count
  is: rows whose description begins with the annulment prefix, and the distinct
  names inside the parentheses.

- **The null-plus-marker count answers a different and still useful question** —
  how many rendered rows will read "[deleted account]" forever. It should be
  asked as that question, never as the backfill's input.

- **Whether every user with compensation activity still owns an account named
  exactly as the retype migration expects.** After that migration runs, the
  evidence of which account was the compensation one is gone.

## 12. Edge cases of account reversal — measured 2026-09-08

The owner asked for this analysis before deciding whether the second route stays
on the close screen ("pero habria que analizarla bien, por los desbalances que
se pueden crear", 2026-09-08). Every case below was opened in the file named
beside it; none is carried over from an earlier reading. The route is
`DELETION_TYPE_RTA`, which reverses the account's effect on other accounts by
writing a pair of adjusting rows per counterparty and then running the same
erasure tail the hard delete runs.

Ordered by what each one costs the owner, not by where it sits in the file.

### 12.1 The reversal has no balance gate; the hard delete has one

`deleteAccountService.js:577-582` refuses a hard delete with 409 whenever the
target derives to a nonzero balance, and the message names the two ways out.
The reversal branch begins at `deleteAccountService.js:1512` and its only two
refusals are the system-account guard above it and `closed_at !== null` at
`:1542`. No balance is read before `processRTAAnnulment` is called at `:1565`.

The imbalance this could create does not occur today, and the reason is stated
at `deleteAccountService.js:454-461`: the residual is the stored
`account_starting_amount` plus the account's rows with its own opening zeroed,
the report sums the rows, and the column adds back exactly what the zeroing
removes. The two agree **by construction, not by a rule anything enforces**.

- **What this means for the decision.** The route is not unsafe by measurement;
  it is unsafe by absence. The hard delete states its precondition and refuses;
  the reversal has the same precondition and never states it, so the day the two
  derivations stop agreeing the reversal erases the difference silently.
- **What it does not mean.** No reachable row is known to make them disagree,
  and none is claimed here.

### 12.2 Rows that are not `status = 'complete'` are destroyed unreversed

The report's CTE filters `AND tr.status='complete'`
(`getAnnulmentImpactReport.js:52`, whose own trailing comment reads "no effect
so far"). The erasure has no such filter:

```
  await dbClient.query('DELETE FROM transactions WHERE account_id = $1', [
    targetAccountId,
  ]);
```
(`eraseAccountTail.js:105-107`)

- **Latent, not live, and measured rather than argued.** `003_transactions.sql:56`
  declares `status TEXT NOT NULL` with no default and no CHECK, and
  `createTables.js:188` declares the same column the same way, so a boot-built
  database is identical here and the sweep closes on both build paths. The
  writers are seven, not the five first relayed: `transactionController.js:827`
  and `:868`, `recordAnnulmentTransaction.js:151` and `:187`,
  `recordClosureSettlement.js:187` and `:216`, and
  `prepareTransactionOption.js:23`. All seven write `'complete'`, so the count
  changes and the conclusion does not.
- **The seven literals are option builders, not the insert.** An earlier version
  of this bullet read them as sealing the column and concluded a second status
  could only arrive through a file edit. That is wrong, withdrawn twice by the
  session that supplied it and checked here in the writers.
- **THE COLUMN IS A BIND, AND ITS VALUE COMES FROM THE CALLER.** Three
  statements insert into `transactions`: `recordAnnulmentTransaction.js:207`,
  `recordClosureSettlement.js:235`, and `recordTransaction.js:100`. The third is
  the general writer - the other two say so in their own comments - and its
  column list names `status` fourth against `VALUES($1,$2,$3,$4,...)`, taken
  from the caller's `values` array. It hardcodes nothing. So a second status
  arrives the moment any caller passes one, with no file edited and no new
  insert path.
- **THAT IS WHY THE DATABASE IS THE ONLY PLACE THAT CAN ENFORCE IT.** `status`
  is a bind in a shared writer whose callers each supply their own value, so
  there is no single point in the code where the legal set can be stated. Every
  caller passes through the column; none passes through a common guard. A CHECK
  is not a way of making a future hazard loud - it is the only enforcement point
  that exists.
- **No other value has ever existed.** The migration session queried the
  distinct values across four databases on 2026-09-08 and found `'complete'`
  alone: 785 rows on `fintrack_prod_data`, the untouched 2026-08-21 dump, 780 on
  each rehearsal copy, 139 on `fintrack_dev`. That is stronger than "none exists
  today"; it says the column has never carried a second value.
- **What makes it live.** The first second status turns the asymmetry into a row
  that is skipped by the arithmetic and removed by the erasure in the same
  transaction.
- **That status has no author today**, corrected 2026-09-08 after the migration
  session checked instead of assuming. Backdating was named as the likely author
  and is not: `PLAN_BACKDATING` sits in `plan-docs/completed/` and never needed a
  second status, because a backdated movement happened and is simply earlier, so
  it is written `'complete'` like any other. No plan in `plan-docs/ongoing/`
  proposes a scheduled transaction either - the only recurrence there is budget
  allocations, and `PLAN_BUDGET_V1.md:132` is titled "Recurrence is not a column"
  and encodes it as rows. The single mention of a scheduled or pending row in
  `ongoing/` was this section's own.
- **The fix is one predicate in one statement**, and it belongs with whoever
  adds the second status, not here: either the erasure filters the same way, or
  the report stops filtering.
- **A CHECK constraint pinning the column was deliberately NOT added**, and the
  reason first recorded here was withdrawn by the session that gave it. It said
  the constraint would pre-empt a schema decision belonging to whoever designs
  the pending row; there is no such designer, per the bullet above. The reason
  that survives is narrower and is about the run, not the schema: adding it now
  would make the production run seven files when the owner authorized six by
  name. The migration session's recommendation is to add it AFTER `031` through
  `036` land, as its own file with its own authorization. The owner has not
  decided.

### 12.3 The deleted account's name survives permanently in the rows the reversal itself wrote

`eraseAccountTail.js:48-63` nulls the counterparty keys and rewrites
descriptions on rows where the target is the source or the destination. The
reversal's own rows are not in that population: `recordAnnulmentTransaction.js`
sets `account_id` to the affected account (`:154`) and to the compensation
account (`:190`), and both key columns to those same two (`:155` and `:157`,
`:191` and `:193`), so the target appears in neither key column. Its name
appears only inside the description text, built at `:83-86`.

- **Consequence.** Every reversal writes rows naming an account that no longer
  exists, and the erasure that runs seconds later cannot reach them. The
  endpoint still reports success, because nulling the keys is unaffected.
- **This is the case the erasure's own header already carries**, corrected there
  on 2026-09-07 (`eraseAccountTail.js:38-47`). It is repeated here because it is
  an argument against the route, not only a note about the file.

### 12.4 The description rewrite is a blind substring replace

```
            description = REPLACE(description, $2, '[deleted account]')
```
(`eraseAccountTail.js:51`, and again at `:59`)

The second bind is the account's own name read from the database
(`deleteAccountService.js:1573`, `accountCheck.rows[0].account_name`), which is
correct — the client-supplied name defaults to `'Unknown Account'` on the hard
delete path. But `REPLACE` has no word boundary and no anchor.

- **An account named `Cash` rewrites the word "Cash" wherever it occurs** in the
  description of any surviving row that referenced it, including inside another
  account's name and inside the fixed prose the description builders emit.
- **Short and generic names are the whole risk**, and account names are
  unconstrained in length and content.

**Narrowed by the Overview session on 2026-09-08, verified here.** The exposure
to Overview's five prefix predicates is real but far narrower than "sits on
rewritable text" states, and the narrowing is worth having because it changes
which fix is the right one.

- **The five predicates read a literal, not an account name.** They are
  `overviewInvestmentRepository.js:162` and `:166`,
  `overviewMonthlyRepository.js:162`, `overviewTransactionRepository.js:102` and
  `:114`, and every one of them matches the constant
  `RTA_ANNULMENT_TARGET_PREFIX` - `'RTA Annulment Target('` at
  `recordAnnulmentTransaction.js:53` - followed by a trailing `%`, so it reads
  the opening of the description and nothing else. `:166` is the positive
  `LIKE`; the other four are `NOT LIKE`.
- **A rewrite reaches them only when the deleted account's name is a substring
  of that literal** - an account called `Target`, or `An`, or a single letter.
  Any other name is replaced further along the description, which no predicate
  reads.
- **And only on a second deletion.** The first deletion's own rows are outside
  both UPDATEs, as 12.3 states. But a row written by deleting A carries the
  affected account B in a key column, so deleting B later does match it -
  specifically the compensation account's leg, since the affected account's own
  leg is excluded by `AND account_id <> $1`.
- **A word boundary would not fix it**, because the collision is inside a
  literal rather than at a word edge. The durable fix is to stop keying the
  reversal on description text at all - a column on the row saying it is a
  reversal - which is a decision for the owner, alongside 12.10.

### 12.5 Pocket allocations leave with the account, and the constraint that looks like it prevents that does not

```
  await dbClient.query(
    'DELETE FROM pocket_allocations WHERE source_account_id = $1 AND user_id = $2',
    [targetAccountId, userId],
  );
```
(`eraseAccountTail.js:96-99`)

- **The RESTRICT never fires**, because the rows are cleared before the account
  is deleted. Reading that constraint as "allocations are never removed, only
  marked" is reading a guard that this line disarms.
- **An account can back allocations while its only ledger row is its own
  opening**, since `insertAllocation` writes to `pocket_allocations` and emits
  nothing into `transactions`. Any precondition for physical removal stated over
  transaction rows alone admits exactly that account.
- **The removal is deliberate and documented** (`POCKET_MODULE_SPEC.md` §11.1
  Q8b) and the assessment endpoint publishes it before the owner confirms. The
  edge case is not that it happens; it is that the allocation history is gone
  with no registry counterpart, because the reversal writes no
  `account_registry` row at all.

### 12.6 An empty report with a nonzero unattributed total is logged and then ignored

`getUnattributedAnnulmentTotal` (`getAnnulmentImpactReport.js:193-228`) sums the
target's rows whose counterparty is NULL — the residue of an earlier deletion's
detach step — and logs them in yellow at `:222-227`. They are excluded from the
report by construction, and the reason is argued at
`getAnnulmentImpactReport.js:88-104`: the earlier deletion already reversed
them, its annulment row sits on this same account against the compensation
account, so the pair cancels and the group arrives settled.

- **The argument is right and the figure is still a signal.** If the netting
  held, the unattributed sum is zero. A nonzero one is evidence that it did not
  hold for this account — and nothing acts on it.
- **The shape that produces it**: an account all of whose counterparties were
  deleted before it. The report comes back empty, the else branch at
  `deleteAccountService.js:429` writes nothing, and the account is erased.

### 12.7 A non-empty report can move nothing

`deleteAccountService.js:325-333`. An account created with a starting amount and
never used has exactly one qualifying row — its own funded opening, whose source
is the compensation account — so the report holds a single entry whose affected
account **is** the compensation account. Both legs of the pair are then written
on that one account, `+adjustment` and `-adjustment`, and the ledger nets them
to zero.

- **The screen says the reversal will touch one account and the books do not
  move.** For that shape the two routes differ by the gate alone: the hard
  delete refuses the same account with 409, the reversal accepts it.

### 12.8 Self-referential opening rows are excluded and then destroyed

`getAnnulmentImpactReport.js:51` excludes them with `tr.destination_account_id
IS DISTINCT FROM tr.source_account_id`, and `eraseAccountTail.js:105` destroys
them with everything else the account owns.

- **Nothing is lost.** `createBasicAccount` sets both key columns from its own
  `isTransfer`, which is the nonzero-amount test, so a self-referential opening
  carries amount zero. Destroying a zero-amount row moves no money.
- **Recorded because the predicate that finds them is not the obvious one**: the
  transaction type is `'deposit'` for bank and investment at any amount, zero
  included, so a rule keyed on `'account-opening'` misses them. Test the two
  columns against each other, never the type name.

### 12.9 Cross-currency summation into the compensation account — checked, not a defect

`recordAnnulmentTransaction.js:153` and `:189` both write `currency_id:
currencyId`, and that value is the **affected** account's currency, carried from
`ua.currency_id` in the report. The compensation account's leg therefore
declares the other account's currency, and `derivedAccountBalanceSql`
(`derivedBalance.js:241-251`) sums `tr.amount` with no currency predicate and no
conversion.

- **It cannot be reached through any creation path.** All three `insertAccount`
  call sites pass `accountingCurrencyId`
  (`accountCreationController.js:326` and `:772`,
  `accountCategoryCreationcontroller.js:297`), so every account row carries the
  accounting currency and `currencyId` equals `accountingCurrencyId` at both
  writes.
- **It is a convention, not a constraint.** `user_accounts.currency_id` has no
  check tying it to the accounting currency, so the writer depends on a property
  it never asserts. Stated here so that a future path writing a different
  currency onto an account is recognised as making this reachable, rather than
  as an unrelated change.

### 12.10 What this analysis recommends

**Take the reversal route off the close screen and keep the code.** The reason
is not any single case above; it is that 12.1, 12.2 and 12.6 are all the same
shape — a precondition the route depends on and never states — and the route's
value on that screen is small: it is offered only while a nonzero balance
refuses the close, and CLOSE with TRANSFER or DISCARD answers that same
situation without rewriting other accounts' history. Two more, the surviving
name in 12.3 and the blind substring replace in 12.4, happen on every run today
rather than under a condition.

Nothing is deleted. `processRTAAnnulment`, `getAnnulmentImpactReport` and the
`DELETION_TYPE_RTA` branch stay exactly as they are, reachable from the API and
covered by the assessment endpoint; only the button leaves the screen. The
decision is the owner's.

## 13. The owner's decisions of 2026-09-08

Every open decision this plan carried was settled on one day, and the settlement
overrides two earlier recommendations that were written before it — including
one of this module's own. They are recorded here rather than left in the
sections that raised them, so a reader who wants to know what governs reads one
place.

### 13.1 The contract, and what it supersedes

**CLOSE requires a zero balance and settles nothing.** A balance that blocks the
close is resolved outside CLOSE, and the refusal screen is the official path.

```
CLOSE
  |
  +-- balance = 0 --> close
  |
  +-- balance != 0 --> refuse; the balance is resolved outside CLOSE
```

**This supersedes the recommendation at the end of
`plan-docs/mockups/account-deletion/close-account.html`.**
That file states as its first unsettled item that frames 02 and 06 cannot both
be right, and this plan then recommended that 02 govern — that CLOSE settle a
non-zero balance rather than refuse it. The owner ruled the other way and the
recommendation is withdrawn. It is named here rather than quietly dropped
because it is still written in the mockup and a later reader will find it.

| Decision | Ruling |
|---|---|
| `CLOSE_POLICY_TRANSFER` | Not reactivated |
| `CLOSE_POLICY_DISCARD` | Not reactivated |
| Balance not zero | 409, CLOSE refuses |
| Mockup frames 02, 03 and 10 | **Obsolete for CLOSE, not implementable** |
| The "delete with adjustment" button | Off the screen, code kept |
| Pocket release | Inside the same CLOSE transaction |
| `writeLedgerRow` | Extract a primitive taking `dbClient` |
| Identifying a reversal | A column, never the description |
| A reversed account and the registry | It must stamp: historical identity is preserved |
| A zero-balance gate on the reversal | Not added; removing the route answers it |
| A divider token on a light surface | Created |
| The eighteen loose files | Archived, never deleted |
| The budget curve | Goes to implementation |
| A theme toggle | Out of scope |
| Migrations `031` to `036` | **Production not authorized yet** |

### 13.2 Why the three frames are obsolete rather than deferred

- **Frame 02, a residual with destinations available, has no executable state
  left.** It exists to let the owner move a balance out during the close, and
  the close no longer moves a balance.
- **Frame 03, a residual with no destination, disappears with it.** Its answer
  was "then discard", and the ruling's answer is "you cannot close yet, resolve
  the balance first". The remedy the frame already draws — create an account —
  survives as the remedy; the discard does not.
- **Frame 10, the transfer confirmation, has nothing to confirm**, because there
  is no destination inside CLOSE to name.
- **The investment inconsistency the mockup raised resolves itself.** That frame
  was drawn on an investment account precisely because transfer destinations are
  bank accounts and there is no in-screen route, and the ruling is that CLOSE
  does not need one: liquidating a position is that module's flow, not an
  operation invented inside the close.

### 13.3 What is being designed to replace the route, and what it is not

The owner is designing a second operation, and its whole point is that it takes
no decisions from the owner:

```
balance != 0
  |
  +-- resolve manually --> Tracker
  |
  +-- reverse the balance --> reversalAmount = -currentBalance
                              |
                              balance = 0 --> CLOSE
```

- **It runs BEFORE the close, not instead of it.** CLOSE stays a zero-balance
  operation; this is what gets an account to zero. Naming it that way is what
  keeps CLOSE from becoming a settlement engine again by a different door.
- **The owner chooses nothing but whether to use it.** No destination, no
  amount, no date, no currency, no method, no splitting across accounts. The
  amount is `-currentBalance` and the sign follows from it, which is why the
  label says "reverse the balance" and never "withdraw" or "deposit": it is an
  administrative operation on a position, not a movement the owner chose.
- **It reuses the components already on the screen.** `ProceedButtonUI` for its
  button and `ImpactReportUI` for the related-accounts panel. That is the reason
  nothing was deleted when the route left the screen: the switch in
  `AccountDeletionPage.tsx` turns off what the annulment put on screen, and the
  components stay whole.
- **What is NOT settled and blocks its implementation** is the counterparty. The
  earlier design sent the residual to the compensation account, and whether that
  is right depends on six questions about that account which have never been
  answered here: whether it is per user or global, whether it is excluded from
  net worth, whether it appears in aggregate balances, whether it may hold a
  non-zero balance permanently, whether its history means anything to the owner,
  and whether this operation writes a real reversal or a boundary movement of
  its own kind. Nothing may be built on the compensation account until those are
  answered.

### 13.4 The related-accounts panel survives the route that produced it

The accordion was built to show what annulling an account would do to every
other account. The annulment is gone and the panel is not, because its value was
never the projection:

- **Its question changes from consequence to fact.** It stops saying "these
  accounts will be adjusted" and says "this account has operated with these
  accounts", which is true regardless of which operation the owner picks.
- **One level, never recursive.** The counterparties of the account being
  closed, not their counterparties. A second level is an accounting graph and
  answers no question the owner is asking.
- **What it should carry per account, beyond the balance**: how many
  interactions, when the last one was, and the net effect on that account if a
  reversal runs. The count is what answers "why is this account listed at all",
  which the balance alone never does.
- **A total on that panel must not be called a net adjustment.** The name
  invites reading it as a change in net worth, and whether it is one depends
  entirely on the compensation-account questions in 13.3. Until those are
  answered, no total on that panel may be labelled as an effect on net worth.

### 13.5 One ruling could not be carried out as stated

**The gate on movement type 10 that the owner ordered retired is not where the
ruling places it, and retiring the one that exists would change a published
figure.** Recorded rather than acted on.

- **There is no gate on `movement_type_id = 10` in `dashboardController.js`.**
  The line the ruling names is a join, not a predicate, and a search of that
  file for the value and for the constant returns nothing.
- **The gate that does exist is in Overview's file**, at
  `overviewInvestmentRepository.js:164-165`, and it is two predicates: a
  `FILTER` summing rows of that movement type into `closure_adjustment`, and the
  `IN` list that admits the type to the query at all.
- **Its own header already argues against retiring it, on a ground the ruling
  does not address.** The writer is gone — `recordClosureSettlement.js:186` was
  the only one and its imports are commented out — but the type still counts
  rows written BEFORE the settlement was retired. Dropping it would not remove a
  dead branch; it would stop counting those rows, silently, on any database that
  holds one. Zero on `fintrack_dev` says nothing about another database.
- **It is Overview's file and the fix is Overview's to make**, if the owner
  confirms the ruling against this reading.

**What it costs is worse than an undercount**, measured through the consumer by
the Overview session on 2026-09-08 and checked here in their files.

- **`closure_adjustment` is the third term of an identity, not a display
  figure.** `makeInvestmentCard.js:136-139` requires
  `capitalContributed + realizedPnl + closureAdjustment` to equal
  `ledgerBalance`, and `:140-142` pushes `UNRECONCILED_BALANCE_NOTICE` onto the
  card when it does not.
- **So on a database holding one pre-retirement row of that type, retiring the
  term breaks an identity that currently holds.** The investment card would tell
  the owner their books do not add up, on every load, about a row the system
  itself wrote correctly. A false alarm on the integrity of their own ledger is
  a worse failure than a quiet miscount, and the reader cannot recover from it.
- **There is no partial version of this change.** The type appears twice: in the
  `FILTER` that sums it into `closure_adjustment` and in the `IN` list at
  `overviewInvestmentRepository.js:170` that admits the rows to the CTE.
  Dropping it from the `FILTER` alone leaves the rows read and landing nowhere,
  which is the same outcome.
- **And it moves exactly one of the two arms.** `realized_pnl` filters on the
  profit-and-loss type with a `NOT LIKE` on the annulment prefix, so a row of
  the closure type never enters it. The term the retirement moves is the one the
  reconciliation depends on.

## 14. Reverse the balance and close — the closed architecture

Settled by the owner on 2026-09-08, after two of this plan's own recommendations
were overridden. Both are named below rather than dropped, because a reader who
finds them in the earlier sections needs to know they were answered.

### 14.1 The operation

```
balance != 0
  |
  +-- resolve manually --> Tracker
  |
  +-- reverse the balance
         |
         ACCOUNT_REVERSAL: target account <-> SLACK, amount = -currentBalance
         |
         balance = 0 --> CLOSE
```

- **One operation, two ledger legs.** This plan had written it as "a single
  entry"; the owner corrected it, and the correction is not pedantic. The books
  are double entry, so the reversal is one conceptual operation composed of the
  leg on the target and the leg on the compensation account. The unit that gets
  identified structurally is the operation, not either leg.
- **The owner chooses nothing but whether to use it.** No destination, no
  amount, no date, no currency, no method, no split. `amount = -currentBalance`
  and the sign follows from the balance, which is why the label says "reverse
  the balance" and never "withdraw" or "deposit".
- **It runs before the close and inside the same transaction.** Two actions to
  the owner, one atomic operation to the database. The state `reversed = yes,
  closed = no` must not be reachable, which is the whole reason the two are not
  two requests.

### 14.2 The compensation account, and the recommendation that was overridden

**THIS PLAN RECOMMENDED MAKING IT PER USER. THE OWNER RULED IT STAYS GLOBAL.**
The recommendation was that a single account shared by every user mixes their
positions; the ruling is that mixing positions is only a problem for balances
that represent someone's money, and this one represents none.

| Property | Ruling |
|---|---|
| Scope | Global, one account |
| Part of net worth | **No** |
| Part of aggregate user balances | **No** |
| May hold a non-zero balance | Yes |
| Its history means something | Yes |

- **The exclusion is a domain rule, not a condition added to one screen.** It
  has to hold in the queries that compute the aggregates, so that no future read
  has to remember it. A screen-level exclusion is one query away from being
  wrong.
- **What this makes true**: the ledger still sums to zero after a reversal, and
  the owner's net worth does not move, because the leg that received the balance
  sits outside the set the aggregate is computed over.

### 14.3 The identity of a reversal

- **A column, never the description.** Settled earlier and unchanged; the reason
  is section 12.4, where a substring rewrite can corrupt an identity carried in
  text.
- **`reversal_of_account_id`, not `reversal_of_transaction_id`.** The operation
  does not say "this transaction was annulled", it says "this account's position
  was neutralised so it could be removed". There is no original transaction to
  point at.
- **It must reference `account_registry`, not `user_accounts`.** The row it
  names is deleted moments later in the same transaction. A key into the live
  table would either refuse the delete or be nulled by it, and in both cases the
  reversal stops saying which account it reversed.
- **A new movement type, not the existing closure type.** Movement type 10
  carries historical meaning - rows written before the settlement was retired -
  and section 13.5 measures what reusing or retiring it costs.

### 14.4 The related-accounts panel, and the second overridden recommendation

**THIS PLAN PROPOSED KEEPING THE BALANCE COLUMNS AND THE OWNER REMOVED THEM,
including one this plan had not questioned.** With the reversal posted against
the compensation account, its effect on every account in this list is zero, so
`New Balance` and `Net Adjustment` would be columns of zeroes reading as a claim
that the reversal touches these accounts. `Current Balance` goes too, and that
one is the owner's own catch: the current balance of an account this one once
transacted with has no causal link to the reversal, and showing it beside a
reversal implies one.

| Column | Before | Now |
|---|---|---|
| Account | kept | kept |
| Type | kept | kept |
| Current balance | shown | **removed** |
| New balance | shown | **removed** |
| Net adjustment | shown | **removed** |
| Interactions | — | **added** |
| Last interaction | — | **added** |

- **The panel's question changes from consequence to fact.** It stops saying
  "these accounts will be adjusted" and says "this account has operated with
  these accounts", which answers the question the owner actually asks of it:
  why is this account in the list at all. A count answers that; a balance never
  did.
- **The total is removed rather than renamed.** `Total Net Adjustment` invites
  reading as a change in net worth, and with the columns gone there is nothing
  left to total.
- **One level, by construction rather than by choice.** The shared CTE filters
  `tr.account_id = $2`, so only the target's own rows are read. A second level
  would be a different query.
- **The compensation account is not injected into this list.** It appears only
  if the target genuinely transacted with it, which a funded opening does.
  Adding it because the reversal will be posted there would make one row mean
  something different from every other row. The screen states the boundary
  separately, above the panel.
- **Transactions do not go in the panel.** Overview is where the owner opens the
  movements themselves. The close screen summarises consequences; Overview holds
  the history, and neither duplicates the other.

### 14.5 What it is offered on

**Only the types in `CLOSE_ZERO_BALANCE_TYPES`** - `bank`, `cash`, `investment`
and `debtor`. The other three close at any balance, so they never need
neutralising and the option is not shown to them.

**That is a statement about the offer, not a prohibition in the architecture.**
The owner made the distinction explicitly so that a later reader does not turn
"the other three do not need it" into "the other three may not use it".

### 14.6 Built for it so far

- **`getRelatedAccounts.js`** — the panel's read. Account, type, interaction
  count and last interaction, ordered by count with the name breaking ties so
  the order is stable across renders. It shares
  `TARGET_ACCOUNT_TRANSACTIONS_CTE` with the annulment report, which gained
  `transaction_actual_date` and is now exported; both existing consumers name
  their columns and group explicitly, so the extra column reaches neither.
- **`ImpactReportUI` renders both readings** rather than a second component
  being written beside it, which is what the owner asked for. `isProjectionShown`
  already chose the columns; it now chooses the rows too, reading `report` in
  the projection and `relatedAccounts` in the close. Two arrays and not one
  union type, because every column the projection draws is required on its row
  and folding the shapes would make those four optional - handing the projection
  a row it cannot render, checked by nothing.
- **The panel travels on the impact report's response**, not on a route of its
  own. `generateImpactReport` runs `getRelatedAccounts` as a fourth parallel
  read and publishes `relatedAccounts` beside `impactReport`. Both come from
  one CTE over one population; two endpoints reading the same rows is how one
  screen ends up naming more counterparties than the other for one account.
- **The date is formatted in the reader's zone.** `transaction_actual_date` is
  `TIMESTAMPTZ` and `MAX()` folds it to an instant, so a movement recorded at
  21:00 in a UTC-4 zone is already the next calendar day in UTC. The existing
  `formatDateToDDMMYYYY` reads UTC parts and would print tomorrow for it.
- **Both ledes were rewritten.** Each said the close leaves "every balance
  above" unchanged, naming a column that is no longer on screen.
- **`037_add_balance_reversal.sql` and both build paths.** Movement type 11 and
  transaction type 7, both `balance-reversal`; the `movement_types` CHECK
  widened to eleven values; `transactions.reversal_of_account_id` keyed on
  `account_registry(account_id)`; and the biconditional
  `CHECK ((movement_type_id = 11) = (reversal_of_account_id IS NOT NULL))`,
  which is where the pairing is enforced because `status` one column over shows
  what happens when a bind in a shared writer has no such place.
- **`recordBalanceReversal.js`**, the writer. Two legs, both carrying the column
  and both naming the account being closed, so what is identified structurally
  is the operation rather than a leg. Sequential rather than `Promise.all`: one
  transactional client serialises them anyway, and interleaving makes which leg
  failed unreadable.
- **The close calls it, atomically.** `processCloseAccount` takes
  `reverseBalance`, resolves the compensation account before the lock because it
  must exist to be locked, locks both accounts, writes the pair, follows both
  stored balances from the ledger and re-derives to assert zero before the close
  proceeds. The state `reversed = yes, closed = no` is not reachable.
- **The screen offers it.** With a blocking balance the one trigger button reads
  "Reverse the Balance and Close" rather than a button that can only refuse, the
  dialog confirms that operation, and the boundary is stated above the panel the
  compensation account is deliberately not in.
- **The investment card counts it.** `closure_adjustment` was widened in both
  places it had to be - the FILTER and the outer WHERE that bounds the CTE - by
  the overview module, since the term's meaning is theirs to decide. Verified in
  their commit rather than on relay.
- **It has been run, on 2026-09-08, against `fintrack_dev`.**
  `backend/scripts/verifyClose.js` reports 25 assertions passing and none
  failing, and rolls the whole transaction back; a check afterwards found no probe account, no registry
  row, no movement type 11 row and no `reversal_of_account_id` committed. The
  nine that are new cover the reversal: the probe account really holds 137.50,
  the same account is refused without the flag, two legs are written, both carry
  movement type 11, the target's leg is -137.50, the pair sums to zero, the
  counterpart sits on a `boundary`-typed account, and the account is gone in the
  same transaction. The database refuses a hand-written type-11 row with no
  `reversal_of_account_id` by name:
  `transactions_reversal_pairing_check`.
- **The run found one defect, in the script rather than in the operation.**
  `recordBalanceReversal` resolves the accounting currency through
  `getCurrencyIdSync`, which throws when the catalog has never been loaded;
  `app.js:66` loads it at boot and a script has to load it itself, exactly as
  `verifyCloseAccount.js:173`, `verifyCloseTransfer.js:180` and
  `verifyClosureSettlement.js:124` already did. This script had never needed it
  because the plain close writes no transaction at all.
- **The boot-path counterpart is exercised too, by
  `backend/scripts/verifyBootGuards.js`.** 15 assertions, none failing, all
  rolled back. `ensureBalanceReversal` carries two refusals that only fire on a
  database that already exists - it returns early when `movement_types` is
  absent, and it skips the column and the pairing constraint when
  `account_registry` is absent instead of pointing the key elsewhere - and
  `db:parity` cannot reach either, because it builds both databases from zero.
  The probe makes that situation inside a savepoint. The assertion carrying the
  weight is not that the column is missing but that no foreign key on it points
  at any other table, read from `pg_constraint` through `confrelid`:
  `user_accounts` has a column of the same name and would accept the reference.

### 14.7 The one point where the code and the ruling do not yet agree

**THE COMPENSATION ACCOUNT IS ONE ROW PER USER IN THE CODE, AND THE RULING SAYS
GLOBAL.** `checkAndInsertAccount.js:69` filters `WHERE ua.user_id = $1`, so each
owner gets their own account named `slack` and typed `boundary`, created the
first time one is needed.

- **Nothing built here changed that, deliberately.** The reversal takes its
  counterpart from the caller and the caller uses the existing find-or-create,
  so this operation behaves exactly as the annulment already does.
- **What a single system-wide row would cost, measured rather than estimated**:
  a migration that merges the existing per-user rows and repoints their
  transactions, plus a sweep of the read filters that exclude the account by
  name - `031_add_boundary_account_type.sql` counts 26 or more of them.
- **The reading this plan applied**: "global" was answering a proposal to create
  a NEW per-user compensation account for reversals, and it settled that there
  is one compensation account concept rather than one per module. It did not
  order the existing rows merged, and merging them moves stored data, which is
  not a decision to take by inference.

**AN ACCOUNT WITH NO OWNER CANNOT EXIST IN THIS SCHEMA.** Measured by the
migration session and checked here in all three places: `user_id UUID NOT NULL
REFERENCES users(user_id)` on `002_accounts.sql:86`, on `createTables.js:67`
with `ON DELETE CASCADE`, and carried to the registry by
`035_create_account_registry.sql:172`. Every account belongs to exactly one
user, and so does every registry row.

So "one global account" is not one option but two, and they are nowhere near
each other in cost:

| Reading | What it changes | Cost |
|---|---|---|
| `user_id` becomes nullable on `user_accounts` and `account_registry` | Every read that joins on `user_id` changes meaning, and the CASCADE on user deletion becomes undefined for the ownerless row | High, and it touches every module |
| One system user owns it | Nothing in the schema. The account still has an owner; the work is teaching the 26 or more per-user filters to admit that one user | The sweep already scoped, and nothing else |

- **The recommendation, if the answer is "merge them", is the system user.** It
  reaches the same end state - one compensation account for the whole
  application - without making ownership optional for every account in the
  database to obtain it for one.
- **The merge of the existing rows is a repoint, never a delete.** Migration 035
  made `transactions.account_id` RESTRICT into `account_registry`, so the old
  per-user rows cannot be dropped while anything references them; their
  transactions move first and the empty rows then leave through the close engine
  like any other account.

### 14.8 Three things measured and found not to be problems

Recorded because each looks like a defect on a first reading, and each cost a
session most of an afternoon to dismiss. A negative that is not written down is
re-chased.

- **The close's `pocket_saving` branch has an empty subject set, not an
  unreachable one.** Migration 020 step 5b deletes every `pocket_saving` row
  from `user_accounts`, and the extension row goes with it through
  `pocket_saving_accounts.account_id`, which is `ON DELETE CASCADE`. Production
  held exactly one such account and ran 020 on 2026-08-27, measured on the
  untouched dump and on the rehearsal by the migration session. Pocket creation
  is withdrawn - the handler is gone with its route - so nothing replenishes it.
  **The type stays in `USER_CREATABLE_ACCOUNT_TYPES` even so**, because this
  module's guard reads that list and removing the entry would make a surviving
  historical pocket account permanently undeletable. The rule is kept; the
  instance is no longer described as live.
- **Nothing lets a request create an account of the compensation type.** The
  doc comment on that list describes it as the creation-side guard, while its
  only consumer outside its own file is this module's deletion guard, which
  reads as a hole and is not one: `createBasicAccount` compares the body's type
  against the URL segment and only three such paths are mounted,
  `createCategoryBudgetAccount` hardcodes its own, and the debtor path - the one
  that did reach the catalog unchecked - calls `assertUserCreatableAccountType`
  on both types it resolves. All of it is already stated at
  `accountCreationController.js:511-517`. **The wrong turn that produced this
  entry** was grepping for a function name inferred from a doc comment instead
  of read: `resolveAccountType` does not exist, the name is
  `assertUserCreatableAccountType`, and the invented name returned a single hit
  and made the guard look absent.
- **The four extension tables really do cascade, on production's schema and not
  only on a developer's.** The close deletes the extension row explicitly
  anyway, for the reason its own comment gives - the explicit delete yields a
  count this path reports, and a cascade is a schema property a later migration
  can change without this file mentioning it. `confdeltype` on the `account_id`
  key into `user_accounts` is `c` for all four tables on `fintrack_dev`, on the
  untouched production dump and on the rehearsal. Read from the catalog rather
  than from `002_accounts.sql`, because migration 010 was edited in place and a
  file is not what a database ran.

### 14.9 What a chain run on production's own data answered, 2026-09-09

The migration session ran the whole chain against a clone of the 2026-08-21
production dump and reported the result; every figure below was read back from
its commit (`087226c8` on `main`) rather than taken from the message. **The
subject is the dump, not production.** It is evidence about that date, and the
owner can rename an account on any day after it.

- **The two migrations this module owns applied clean from production's data.**
  A clone aligned to 17 ledger rows, then one migration run through
  `037_add_balance_reversal.sql`, ending at 38 rows with no refusal, all four
  catalog bindings correct afterwards - movement types 10 and 11 holding
  `account-closure` and `balance-reversal`, transaction types 6 and 7 the same -
  and eight foreign keys resolving to `account_registry`. The clone was dropped.
- **The precondition this module raised on the retyping migration is satisfied
  on that data, and it stays a precondition anyway.** The run ended with exactly
  one account typed `boundary`: account 45, `account_name` the exact literal
  `slack`, and the only row matching `lower(account_name) = 'slack'`, so no case
  variant exists for that migration's NOTICE to report. The subject it keys on
  exists and carries the name it keys on. What the finding says is that success
  proves nothing by itself, and that is unchanged: the check has to be made at
  the moment of the run.
- **The new seed assertions have nothing to catch on the run that matters, and
  that is not an argument against them.** Production's catalogs are shorter than
  the ids being seeded - the highest movement type is 9 and the highest
  transaction type 5 - so both inserts insert and no binding is contested. The
  assertions earn their place on every database that already carries those ids,
  which is every local one, and on any future database that acquires them by
  another path.

### 14.10 Three things the close screen got wrong, reported 2026-09-09

All three were found by the owner looking at the screen, and each was measured
before being changed.

- **"Your net worth does not change" was false, and the compensation account's
  exclusion is the reason rather than the defence.** Net worth is the bank and
  cash balance plus the investment balance plus the debt position
  (`makeHeroSection.js:197`), and the query behind the first term excludes the
  compensation account by type (`overviewAccountRepository.js:195`). So a bank
  account closed holding 500 counted 500 towards net worth before the
  operation, and after it the account is gone and the 500 sits where nothing
  adds it up: the figure falls by exactly the balance that left. The sentence
  had the mechanism right and the conclusion backwards. **What replaced it says
  the balance stops counting towards whatever it was counting towards**, which
  is also true of the two closable types whose balance was never in net worth -
  a budget category and an income source - without the screen having to branch
  by type.
- **"It is not one of your accounts and is not listed below" was false whenever
  the target had already dealt with the compensation account.** The
  related-accounts panel lists whoever the target genuinely transacted with, and
  a discard close or an annulment posted earlier puts the compensation account
  in that history like any other counterparty. Measured on `fintrack_dev`: the
  account named `slack`, typed `boundary`, three interactions, most recent
  2026-08-27. The first half of the claim stands - it is not the owner's account
  and sits outside every aggregate - and only the second half was removed, with
  a line saying that if the row appears it is history and not the reversal about
  to be made.
- **The only way off the page that closes nothing was invisible.** The header
  carried a link to the previous route drawing `LeftArrowDarkSvg`, and three
  things kept it from reading as a control: the asset hardcodes `fill="#141414"`
  on its root and the element set `color: 'black'` inline, on a header whose
  title is `--color-content-on-dark`; the class attribute read
  `header-back-button .iconArrowLeftDark`, and the second token carries a
  leading dot so it matches no rule; and `.header-back-button` has no rule in
  any stylesheet, so there was no hover, no focus ring and no hit area. The link
  also held nothing but the glyph, so it announced as an unnamed link. **It now
  carries a visible label beside the arrow, an `aria-label` saying that leaving
  closes nothing, and the four states.** Styled on the page rather than by
  taking the shared `backArrow.css` class, which is `position: absolute`
  against a title row this header does not have.
- **The related-accounts panel now states the net amount moved with each
  account**, which the owner asked for on the same day. It is the same `SUM`
  over the same rows the annulment report published as `net_adjustment_amount`,
  through the CTE both queries already share, so it cost one line and no new
  join. What changed is what it means: there it was what annulling WOULD apply
  to the counterparty, here it is what the two accounts have already moved
  between them. Its sign is read from the target's own rows, so a positive
  figure is what the target received net.

### 14.11 The close was unreachable from its own route, 2026-09-09

The owner tried to close an account and was told its balance was already zero,
of an account holding 17.42. Nothing was wrong with the account: both the stored
column and the derivation read 17.42, measured on `fintrack_dev` for account
109.

- **The route handed over a string and the balance map is keyed by a number.**
  `lockAndDeriveBalances` returns `new Map(rows.map((row) => [row.account_id,
  row.balance]))`, and `account_id` arrives from the driver as a number. The
  delete route read its path segment as the string a route always gives -
  `req.params.targetAccountId`, unlike the three read routes beside it, which
  all `parseInt` - so `balances.get('109')` was `undefined` and `parseFloat`
  turned it into `NaN`.
- **`NaN` passes every test this file makes.** `residual !== 0` is true of
  `NaN`, so the close entered its reversal branch and handed `NaN` to the
  writer, whose `if (!balance)` is equally true of `0`, `NaN`, `undefined` and
  `null` - and its message names only the first. The hard-delete path refused
  the same account for holding `NaN`.
- **Three changes, and only the first is the fix.** The route parses its
  segment like its neighbours; the service reads every balance through
  `residualOf`, which coerces the key and raises a 500 naming the account when
  the map has no entry or the value is not finite; and the writer separates the
  two refusals, so a balance that never arrived is a 500 about a caller defect
  and only a real zero is the 400 the owner sees.
- **What let it ship is that every probe passed a number.** `verifyClose.js`
  calls the engine directly, as the service does, so the one shape that failed
  was the one nothing exercised. It now closes the same probe account with
  `String(fundedId)` inside a savepoint and requires the two reversal legs: 26
  assertions, none failing, everything rolled back.

### 14.12 The related-accounts list says what each interaction was, 2026-09-09

The owner read the close screen's table and worked out for himself why the
compensation account was in it: opening a funded account brings the money in
from outside the application, and that arrival is recorded against `slack`. The
table could not say so - it published a count and a date, and a count does not
distinguish an opening from an expense.

- **The shared CTE now carries the movement type.**
  `TARGET_ACCOUNT_TRANSACTIONS_CTE` in `getAnnulmentImpactReport.js` selects
  `tr.movement_type_id` beside the amount and the date. It reaches no other
  consumer: both the impact report and the unattributed total name their
  columns explicitly.
- **`getRelatedAccounts.js` groups the same rows one level deeper.** A
  `MovementBreakdown` CTE counts per counterparty AND movement type, and a
  correlated `json_agg` folds it back onto the counterparty row as
  `movement_breakdown`, ordered by count descending. The parts sum to the
  `interaction_count` beside them by construction - both are counts over the
  same rows - so the cell cannot show a total its own detail contradicts.
- **The join to `movement_types` is inner and cannot lose a row.**
  `transactions.movement_type_id` is `INTEGER NOT NULL` with a foreign key into
  that catalog (`003_transactions.sql:24-25`).
- **The interactions cell carries the breakdown as a visible second line, not
  as a tooltip.** A tooltip is invisible to a touch screen and to a keyboard,
  and this is the answer to the question the row raises rather than an
  ornament. A single-entry breakdown states only the movement - "Account
  opening" - because the count is already the figure above it.
- **Eleven movement labels reach the dictionary in both languages,
  prefixed.** `movement_account_opening`, `movement_expense`, and so on.
  Prefixed because `investment` is both an account type and a movement type and
  `languages.ts` is one flat record: a shared entry would make renaming either
  label silently rename the other. A catalog name with no entry renders as the
  name the database holds, never as the key.
- **`verifyRelatedAccounts.js` is new, and is the first probe that reads this
  query at all.** It fabricates a target and two counterparties inside a
  transaction, writes movements with known answers, and asserts the count, the
  net, the breakdown's contents and order, and that the parts sum to the whole:
  9 assertions, all passing, everything rolled back. Verified failing by
  changing one probe row's movement type before restoring it.

Measured on `fintrack_dev` for account 109: `slack` now reads
`account-opening`, the two category accounts read `expense`, the investment
account reads `transfer` and the debtor reads `debt`.

