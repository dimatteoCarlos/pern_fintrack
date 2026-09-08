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
| Matrix by account type | settled: six types close, one never does, one no longer exists |
| Historical identity design | the registry, ruled by the migration session; its extension half reversed by the owner on 2026-09-07 |
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
  and the debtor's selected account. Since no row is ever deleted there, restrict
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

**Releasing does not remove the rows, and that has a named consumer on the
Overview branch.** `pocketAllocationService.release` calls `writeLedgerRow`, so a
release adds a negative row rather than deleting the positive one: the allocation
history survives the close, keyed by an account id that resolves in the registry
and not in `user_accounts`. The Overview session measured the consequence and
owns the fix — `overviewPocketRepository.js:120` joins `user_accounts` to
`pocket_allocations.source_account_id` with an inner join, so a surviving
allocation whose source account has been closed is dropped silently and the
pocket's committed figure falls with no figure contradicting another. They also
measured the sibling that behaves the opposite way: the same key read inside an
`EXISTS` at `overviewPageRepository.js:190`, which cannot match a non-existent
account and is safe. **This is the cost of repointing that one key, not of the
erasure**, and it is recorded here so the repointing is decided with its consumer
in view.

---

## 7. Phases

Phases one to three change nothing the user sees, so they can land separately and
be tested separately. The new close sits behind a flag until phase four is
complete.

| Phase | What it delivers | Depends on |
|---|---|---|
| 0 | Production measurement of how much history the previous mechanism already destroyed | the owner: no session queries production |
| 1 | The registry table, its backfill from live accounts, and the trigger that keeps issuance honest | the migration suspension lifting |
| 2 | The six keys repointed at the registry, plus their hand-written boot-path counterparts | phase 1 |
| 3 | The readers resolving through the registry | phase 2 |
| 4 | The close operation and its screen | phase 3 |
| 5 | The other three methods commented out and the surplus screens retired | phase 4 |

Phase two carries a hazard worth stating: schema parity builds both paths from
scratch and is **structurally blind** to a gap in the boot path, so it reports
clean while the runtime table builder lacks the new table and the repointed keys.
Those six keys and the table need hand-written counterparts in
`createTables.js`, and no automated check will notice their absence. The four
extension keys are untouched, so they need no counterpart.

### Inside phase four

1. Validate the account and refuse the system ones — **the guard is already
   written**: it refuses by non-creatable type and by reserved name, and both
   arms are evaluated before any branch (`deleteAccountService.js`).
2. Refuse unless the derived balance is zero — on `bank`, `cash`, `investment`
   and `debtor` only. `income_source` skips this step by the owner's ruling.
3. Release the pocket allocations with the existing mechanism.
4. Stamp the registry row — name, type, currency, starting amount — and write the
   closure fields, reason included.
5. Delete the account row.

**The order is load-bearing:** the stamp happens before the delete and inside the
same database transaction, or the name, type and currency go with the row and the
surviving transactions become uninterpretable. The type-specific attributes on
the extension row are deliberately **not** stamped — the owner ruled that row is
deleted — so the four columns the registry carries are the whole of what a closed
account leaves behind, and step 4 has to write all four.

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
| The four money types close | `bank`, `cash`, `investment` and `debtor` |
| The `category_budget` account closes | *las cuentas no son de categoria, son de category_budget, y si pueden desaparecer por cierre*. Said to this session directly and, in the same words, to the Overview session |
| The income source closes | *las cuentas income tambien son borrables*, reversing the recommendation recorded earlier the same day |
| The income source is exempt from the zero condition | *tambien es borrable, pero no se le exige que sea saldo cero* |
| The budget goes with the budget account | *category_budget tiene un presupuesto asociado, asi que con su borrado, se borra el budget asociado a ella*. Both cascades are therefore intended: `category_budget_accounts` and, through it, `budget_monthly_allocations` — see 3.5 |
| `income_source_accounts` is dropped | *yo creo que esa tabla es descartable y habria que eliminarla, esto es tarea para migration*. Measured first: created in both build paths, never inserted into, never read — see 5.2. **Assigned to the migration session**, not to this plan |
| The extension row is deleted with the account, by id | *cuando se borra hay tambien que eliminarla de esta otra tabla, buscando no por nombre sino por id*. The cascade on `002_accounts.sql:141-143` already does exactly this, so no code and no migration are owed — but it reverses the migration session's plan to repoint those four keys, and the repointing count drops from nine to six (4.3) |
| The pocket saving type | it does not exist; any surviving rows are deleted physically — already done by an applied migration, see 5.2 |
| The zero condition, on the four money types | derived balance equal to zero, for `bank`, `cash`, `investment` and `debtor` only |
| The close reason | a new field on the close, stored on the registry row |
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

- **Preserving the rows preserves nothing observable.** Repointing
  `010_create_budget_tables.sql:43` at the registry would keep the allocation
  rows, and all three readers would still miss them: the account id list roots in
  `user_accounts` (`overviewAccountRepository.js:32-39`), the budget totals
  inner-join the extension table (`budgetTransactionRepository.js:132-133`), and
  both of those are settled by the first cascade and by the account delete, not
  by this one. A seventh repointed key in three build paths would buy rows
  nothing reads.
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
| Whether the retroactive lowering of past months is acceptable | **it is not this plan's to accept.** `getAllocationForMonth` recomputes settled months live, so closing an account changes figures already reported. The budget module owns the fix; this plan only records that CLOSE triggers it. |
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

- **Whether the registry stamps the type-specific attributes: it does not.** The
  extension row is deleted with the account, so there is nothing to stamp and
  nothing to reconcile. The registry carries name, type, currency and starting
  amount, and that is the entire historical record of a closed account.
- **What happens to the debtor's copied account-name column: nothing, and its
  reference stops blanking.** `debtor_accounts.selected_account_id` is repointed
  at the registry, which is a different account from the one the debtor row
  belongs to, so the ruling above does not reach it.

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
