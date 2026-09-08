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
  (`010_create_budget_tables.sql:41-43`).

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
  `010_create_budget_tables.sql:41-43` becomes a reference to the registry.
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

| # | Mechanism | The statement that does it | What repointing the six keys fixes |
|---|---|---|---|
| 1 | **Inner join from `transactions` to `user_accounts`** | `JOIN user_accounts ua ON ua.account_id = tr.account_id` (`transactionRowShape.js:83`) | **nothing.** The join fails on the missing row whatever the foreign key says |
| 2 | **Id set built from `user_accounts`, applied to `transactions`** | `t.account_id = ANY($1::int[])` where `$1` came from `SELECT ua.account_id FROM user_accounts ua` | **nothing.** The id is absent from the array |
| 3 | **Stock read directly off `user_accounts`** | `SUM(${DERIVED_BALANCE}) ... FROM user_accounts ua` (`dashboardController.js:58`, `overviewPageRepository.js:81`) | **nothing.** No row, no term |
| 4 | **Cascade** | `ON DELETE CASCADE` on the four extension keys and on `account_name_case_backup_013` | **nothing.** The rows are destroyed, not orphaned |

**Repointing the six keys makes the `DELETE` succeed. It does not make one
figure correct.** The two are separate pieces of work and this plan has only
specified the first.

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
close, because `opening_for_account_id` is one of the six repointed keys.

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
| Repoint the six keys at the registry | this plan (4.3) | designed |
| Stamp name, type, currency and starting amount before the delete | this plan (4.3) | designed |
| Release the pocket commitment | this plan (6) | designed |
| Terminating zero on the budget series | this plan (3.7 fix 1) | **open — the owner has not chosen among the four** |
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
| Which of the four fixes for the retroactive lowering is taken | **fix 1 in 3.7** — repoint `budget_monthly_allocations.account_id` at the registry, write a terminating zero at closure, and let the budget readers include closed accounts for elapsed months. The owner asked for a fix on 2026-09-07 and has not chosen among the four. |
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
