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

---

## 0. Status

**This is work in progress and nothing is decided yet.** The owner said so in
those words. The rulings recorded below are working positions taken so the
design can advance; they can still move.

| Block | State |
|---|---|
| Method conceptualization | received, evaluated, accepted with three measured collisions |
| Matrix by account type | written, three gaps open |
| Historical identity design | ruled by the migration session — the shape changed |
| Schema | designed, not written; the migration suspension still holds |
| Phases | defined |
| Frontend | not started; the screen goes to the design session |

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

**CLOSE is a terminal operation that physically deletes an account whose balance
has already been brought to zero, leaves its transactions intact, and records
that the account existed and was closed.**

Four negations that bound the scope as much as the sentence above:

- **It moves no money.** No transfer, no settlement, no compensation. If there is
  a balance, it refuses.
- **It reverts and modifies no transaction.** Neither the account's own nor the
  counterparty's.
- **It writes no transaction of its own.** Closing is a lifecycle fact, not an
  accounting fact.
- **It is not reversible.** A mistaken close is not undone; that is what
  deactivation would be for, and deactivation is not part of this plan.

### Why it is not the hard delete that already exists

Both delete the account row. The difference is countable: **after a hard delete
the transactions table has fewer rows; after a close it has exactly the same
rows.** The current hard delete runs a delete over the account's own transactions
before deleting the account (`eraseAccountTail.js`). CLOSE touches none.

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

### 3.3 The detail tables cascade, and that is the only thing that destroys them

The four one-to-one extension tables — income source, spending category, debtor
and pocket saving (`002_accounts.sql`, at lines 122, 140, 165 and 191) — each
declare their primary key as a reference to the account **with cascade**.
Deleting the account row silently removes the category's budget amount, the
saving target and the debtor's terms. The pocket module's migration already
measured that cascade against real data and recorded the loss
(`020_create_pocket_tables.sql`).

**The cascade is the sole destroyer: the erasure tail never touches those four
tables** (`eraseAccountTail.js` writes only to transactions, pocket allocations
and the accounts table). That is what makes section 4.3's answer possible —
repoint those four keys and the rows simply do not die, so nothing has to be
copied before the delete.

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

---

## 4. The historical identity

### 4.1 The problem, measured

**An inner join drops the row when the account is absent, and raises nothing.** A
closed category's May expense would stop adding to May's total, silently. The
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
- **Nine keys are repointed at the registry** instead of at the accounts table:
  the three on transactions, the opening marker, the pocket allocation's source,
  and the primary keys of the four extension tables. Since no row is ever deleted
  there, restrict never fires and costs nothing, the referencing columns keep a
  real constraint, and the accounts table becomes freely deletable because
  nothing references it any more.
- **Nothing from the extension tables is copied into the registry.** Repointing
  their four primary keys means the cascade never fires, so the budget amount,
  the saving target, the debtor's terms and their currency audit columns survive
  in place, keyed by an id that resolves in the registry — the same state the
  transaction rows are in. Roughly thirty type-specific columns stay typed,
  constrained and foreign-keyed instead of becoming a sparse block on the
  registry of which at most eleven are ever non-null, which is the same
  denormalization the owner declined for transactions, one table over.
- The debtor's copied account-name column stops being a defect for free: its
  reference blanks itself only because it points at the accounts table, and
  repointed at the registry it never blanks.
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

Repointing the four extension keys does not change this. It preserves the future
only: for accounts the old mechanism already erased, the extension rows went with
the cascade at the time, exactly as the name did.

### 4.5 What surviving extension rows expose

Repointing has a cost that stamping would not have had, and it is measured rather
than assumed. Almost every reader of the four extension tables joins in **from**
the accounts table, which is self-filtering — the parent row is gone, so the join
matches nothing. Three sites do not, and they are the ones the closing phase has
to settle:

- **The category name is released on close, and the code already says it should
  not be.** The collision check that decides whether a category name is taken
  (`accountCategoryCreationcontroller.js`) joins the accounts table and tests the
  two lifecycle stamps, with a comment stating in as many words that a
  soft-deleted category releases its name while **a closed one keeps it, because
  its transactions are kept**. Delete the row and that join matches nothing, so
  the rule the code states is inverted by the new close. This is the concrete
  form of the name-uniqueness question and it belongs to whoever writes the
  account-name uniqueness plan (`PLAN_ACCOUNT_NAME_UNIQUENESS.md`), who has to
  know these rows persist.
- **One read reaches an extension row without the parent.** The edit path reads
  the stored category name parts directly on the extension table's account id
  (`accountEditController.js`), with no join to the accounts table, so a closed
  category's row is reachable through it.
- **One write reaches one without the parent.** The budget writer updates the
  category's budget by account id alone (`budgetAllocationService.js`), so
  nothing in the statement stops a budget being written onto a closed category.

Everything else measured — the dashboard, the account reads, the budget
transaction repository, the creatable-type helper and the export — joins in from
the accounts table and needs no change.

---

## 5. Which types CLOSE applies to

**The owner ruled on 2026-09-07 that a spending category is not an account and
therefore does not close** — in his words, *las categorias no se cierran, porque
no son cuentas*. That narrows the method to the four types that hold money.

| Type | Closes? | Why |
|---|---|---|
| Bank | yes | holds money the owner can move out |
| Cash | yes | same, and the ordinary transfer path can empty it — see 5.1 |
| Investment | yes | holds a position that can be liquidated into a liquid account |
| Debtor | yes | holds an amount owed in one direction or the other |
| Spending category | **no** | classifies movements; it is not an account |
| Income source | **no** | same shape as the category, ruled the same day |
| Pocket saving | **no** | the type is to be removed entirely — see 5.2 |
| Compensation | **no** | the system's counterparty; the refusal is already written |

**The schema disagrees with the concept, and that has to be said plainly rather
than argued.** A spending category is stored as a row in `user_accounts` with an
extension row in `category_budget_accounts`, and it carries a derived balance
like any other. The ruling is about what the product offers, not about what the
tables hold. **Not yet ruled and needed before the phase list is final:** what a
user does with a category they no longer want, since CLOSE will not take it.

### 5.1 The zero check is one condition, not a family rule

With the classifying types out of scope the rule collapses to
**derived balance equal to zero**, computed by `derivedAccountBalanceSql` in
`derivedBalance.js` — the starting amount plus every movement except the
account's own opening row. There is no per-type formula to design. A debtor's
balance is signed by direction, but zero is zero in both directions, so nothing
special is owed there either.

The earlier draft of this document proposed a rule per family of account type.
That was only necessary because the classifying types were in scope; they are
not, and the rule is gone rather than simplified.

### 5.2 The pocket saving type is removed, and its rows deleted

**The owner ruled the type does not exist and that any surviving rows are to be
deleted physically.** That is separate work from CLOSE, and it has one hard
dependency worth stating before it is scheduled: **those rows cannot be deleted
today**, because they are accounts and every account is blocked by its own
opening row and the references section 3 enumerates. The physical deletion is
therefore only possible after the registry lands and the keys are repointed —
the same phase order CLOSE needs.

Two other facts about the type, measured:

- The frontend contains **no reference to it at all**, so nothing creates one
  through the application, but it is still in the creatable-type whitelist
  (`accountUtils.js`) and the controllers still serve it, so the API accepts one.
- **The newer pocket module is a different thing entirely** — its own table and
  allocations over real accounts, with its own deletion, and it never touches
  `pocket_saving_accounts`. Deleting a pocket there is not closing an account and
  is outside this plan.

**Needed before the deletion runs, and it is the owner's alone:** whether any
account of this type exists in production, and whose.

### 5.3 The income source falls the same way

An income source classifies movements exactly as a spending category does, holds
no money the owner can move, and its derived balance is accumulated historical
income. The owner's ruling named categories; asked whether the symmetry carried,
he confirmed it does. Neither type closes.

---

## 6. Pockets, inside the close

The release mechanism **already exists and does not have to be written**:
`pocketAllocationService.release` releases by writing a **negative** allocation
row, and `getPocketsForAccount` enumerates the pockets an account backs. Pocket
coverage — committed, uncovered, funded — is **derived, never stored**
(`makePocketStatus.js`), so releasing is sufficient and there is nothing to
recompute.

**What has to go:** the current erasure tail runs a direct delete over the
allocations (`eraseAccountTail.js`), which destroys the allocation history
instead of releasing it, and incidentally defeats the restricting reference that
was supposed to protect them.

---

## 7. Phases

Phases one to three change nothing the user sees, so they can land separately and
be tested separately. The new close sits behind a flag until phase four is
complete.

| Phase | What it delivers | Depends on |
|---|---|---|
| 0 | Production measurement of how much history the previous mechanism already destroyed | the owner: no session queries production |
| 1 | The registry table, its backfill from live accounts, and the trigger that keeps issuance honest | the migration suspension lifting |
| 2 | The nine keys repointed at the registry, plus their hand-written boot-path counterparts | phase 1 |
| 3 | The readers resolving through the registry, and the three sites that reach a surviving extension row | phase 2 |
| 4 | The close operation and its screen | phase 3 |
| 5 | The other three methods commented out and the surplus screens retired | phase 4 |

Phase two carries a hazard worth stating: schema parity builds both paths from
scratch and is **structurally blind** to a gap in the boot path, so it reports
clean while the runtime table builder lacks the new table and the repointed keys.
Those nine keys and the table need hand-written counterparts in
`createTables.js`, and no automated check will notice their absence.

### Inside phase four

1. Validate the account and refuse the system ones — **the guard is already
   written**: it refuses by non-creatable type and by reserved name, and both
   arms are evaluated before any branch (`deleteAccountService.js`).
2. Apply the zero-balance gate according to the type's family.
3. Release the pocket allocations with the existing mechanism.
4. Stamp the registry row — name, type, currency, starting amount — and write the
   closure fields, reason included.
5. Delete the account row.

**The order is load-bearing:** the stamp happens before the delete and inside the
same database transaction, or the type and the currency go with the row and the
surviving transactions become uninterpretable. The type-specific attributes are
not part of that risk, because repointing preserves them without a copy — which
is the reason the irreversible step preserves and only the reversible step, a
filter on a read, chooses.

### The frontend, per phase

- **Phases 0 to 3:** no screen changes.
- **Phase 4:** the screen lands with the backend, not after it. The gate is
  useless if the owner cannot see why the button is disabled or where to go and
  settle the balance, and the mandatory reason is a form field.
- **Phase 5:** of the thirty-four files in the deletion page, those of the impact
  report, the reversal modal, the hard-delete confirmation and the deactivation
  view are left with no method behind them.

The phase-four screen is designed by the frontend design session before the
component is written.

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
- **The close method already half exists**: declared in the controller
  (`accountDeleteController.js`), accepting a policy in the request body, with a
  route that transfers the residual balance. The new design removes that
  money-moving half entirely.

---

## 10. Decisions

### 10.1 Settled by the owner on 2026-09-07

| Decision | Ruling |
|---|---|
| Which types close | only the four that hold money; a spending category is not an account |
| The pocket saving type | it does not exist; any surviving rows are deleted physically, after the registry lands |
| The zero condition | derived balance equal to zero, one rule for all four types |
| The close reason | a new field on the close, stored on the registry row |
| The other three methods | their route registrations and their service bodies are commented out, not removed |
| The migration ledger read | authorized and performed |

### 10.2 Settled the same day, on a recommendation the owner endorsed

| Decision | Ruling |
|---|---|
| A closed account's name is **not** renamed with a suffix | deleting the row already frees the name — the rename collision check joins the accounts table and finds nothing. A suffix would be stored as the registry's historical name and would then appear on transactions that happened before the close. To tell two same-named accounts apart in a report, the screen uses the closure date the registry already carries. |
| An income source does **not** close | it classifies movements and holds no money the owner can move, exactly like a spending category |
| Removing a spending category is **not** part of this plan | recorded so the gap stays visible: a category is a row in the accounts table with a derived balance, and after this plan no method removes it |

### 10.3 Deferred, because nothing is at risk either way

| Decision | Who rules |
|---|---|
| Whether a closed account still appears in a picker or a historical list — a filter on a read, not a schema change | owner |

Outside this plan's scope but found by it, and with no owning session running:
**the budget writer updates a category's budget by account id alone**
(`budgetAllocationService.js`), while the same service's other statement joins the
accounts table and is self-filtering. Once extension rows survive a close, the
first path can write a budget onto a closed category and the second cannot. It
goes to whoever owns the budget service.

Two decisions that stood in the first version of this document are **closed, not
deferred**: whether the registry stamps the type-specific attributes, and what
happens to the debtor's copied account-name column. Repointing the four extension
keys answers both by preserving everything, so there is nothing left to choose.

---

## 11. Measurements no session can make

Both are production reads, and no session queries production.

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
