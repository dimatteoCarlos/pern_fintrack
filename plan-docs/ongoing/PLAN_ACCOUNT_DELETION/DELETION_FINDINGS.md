# Findings of the account-deletion module

**What this file is.** The technical findings the deletion work produced between
2026-09-07 and 2026-09-09, held until now in this project's session memory and
moved here on 2026-09-09 on the owner's instruction. Each entry is the memory's
body copied verbatim, under the date it was last written. Nothing was rewritten
on the way across: an entry says what was true when it was measured, and where a
later measurement changed it, the entry itself carries the correction, because
that is how they were kept.

**How to read a link.** A name in double brackets was a link to another memory.
Where that name appears in the index below, it is a section of this file. Where
it does not, it is still a memory, or was already gone when this file was
written - the notation never guaranteed that the target exists.

**Where a finding disagrees with the plan.** `PLAN_CLOSE_ACCOUNT.md` is the
specification and it wins. Two entries here record a decision and the decision
that replaced it on the same day - that the close deletes the account row, and
that no account is physically deletable - and section 13 of that file holds the
standing version.

## Index

| finding | memory it was kept as |
|---|---|
| [A database without the closing-stamp migration refuses every deletion, with a false reason](#a-database-without-the-closing-stamp-migration-refuses-every-deletion-with-a-false-reason) | `pre-034-refuses-every-deletion` |
| [The guard on the system account needs a stored-name arm beside the account-type arm](#the-guard-on-the-system-account-needs-a-stored-name-arm-beside-the-account-type-arm) | `boundary-guard-needs-both-arms` |
| [The compensation account can fork, and only code that resolves it to one row breaks](#the-compensation-account-can-fork-and-only-code-that-resolves-it-to-one-row-breaks) | `fork-breaks-whatever-resolves-to-one-row` |
| [A refusal attached to an account does not protect the rows that record its history](#a-refusal-attached-to-an-account-does-not-protect-the-rows-that-record-its-history) | `guards-protect-accounts-not-records` |
| [A handler can refuse in JavaScript rows its own WHERE clause admitted](#a-handler-can-refuse-in-javascript-rows-its-own-where-clause-admitted) | `the-refusal-may-not-be-in-the-query` |
| [Excluding a row from every list leaves the by-id read reachable](#excluding-a-row-from-every-list-leaves-the-by-id-read-reachable) | `list-exclusion-does-not-gate-a-detail-route` |
| [Four transaction keys into user_accounts restrict, not the three migration 018 altered](#four-transaction-keys-into-useraccounts-restrict-not-the-three-migration-018-altered) | `the-fourth-restricting-key` |
| [Every account carries its own opening row, so the restricting key fires on all of them](#every-account-carries-its-own-opening-row-so-the-restricting-key-fires-on-all-of-them) | `no-account-is-physically-deletable` |
| [A precondition for removing an account has to enumerate every referring table](#a-precondition-for-removing-an-account-has-to-enumerate-every-referring-table) | `removal-preconditions-go-over-referrers` |
| [Both deletion writers emit two-row pairs and nothing in the schema relates the two rows](#both-deletion-writers-emit-two-row-pairs-and-nothing-in-the-schema-relates-the-two-rows) | `transaction-pairs-have-no-pair-id` |
| [A foreign-key violation the server caused comes back as a 400 blaming the caller](#a-foreign-key-violation-the-server-caused-comes-back-as-a-400-blaming-the-caller) | `a-server-side-violation-returns-400` |
| [The stored balance column is kept and must always equal the ledger derivation](#the-stored-balance-column-is-kept-and-must-always-equal-the-ledger-derivation) | `account-balance-column-stays` |
| [The stored balance on the account and the after-transaction figure on the row are unrelated](#the-stored-balance-on-the-account-and-the-after-transaction-figure-on-the-row-are-unrelated) | `two-balance-columns-differ` |
| [The investment card reconciliation is a check that can fail, not an identity](#the-investment-card-reconciliation-is-a-check-that-can-fail-not-an-identity) | `the-reconciliation-is-not-an-identity` |
| [No constraint ties a movement type to an account type; the agreement is convention](#no-constraint-ties-a-movement-type-to-an-account-type-the-agreement-is-convention) | `movement-type-account-type-is-convention` |
| [The transaction status column is unconstrained text with one value ever written](#the-transaction-status-column-is-unconstrained-text-with-one-value-ever-written) | `transaction-status-is-an-unconstrained-enum` |
| [A CHECK on a record of something that already happened refuses to record the truth](#a-check-on-a-record-of-something-that-already-happened-refuses-to-record-the-truth) | `constraints-govern-state-not-history` |
| [The retyping migration keys every guard on the literal account name](#the-retyping-migration-keys-every-guard-on-the-literal-account-name) | `031-has-an-unstated-precondition` |
| [That migration reports success whether it retyped the account or skipped it](#that-migration-reports-success-whether-it-retyped-the-account-or-skipped-it) | `031-cannot-detect-a-renamed-boundary-account` |
| [A catalog seed keyed on the id cannot fail when that id already holds another name](#a-catalog-seed-keyed-on-the-id-cannot-fail-when-that-id-already-holds-another-name) | `conflict-on-the-id-hides-a-wrong-binding` |
| [The boot swallows a currency-catalog failure because it runs before the table exists](#the-boot-swallows-a-currency-catalog-failure-because-it-runs-before-the-table-exists) | `boot-catalog-catch-is-load-bearing` |
| [The module is rebuilt around one operation, CLOSE, and what that operation destroys](#the-module-is-rebuilt-around-one-operation-close-and-what-that-operation-destroys) | `close-deletes-the-account-row` |
| [A category account name is three parts joined by convention, not by any constraint](#a-category-account-name-is-three-parts-joined-by-convention-not-by-any-constraint) | `composite-category-name-is-unenforced` |
| [A deactivation filter that is right for a current total destroys a monthly series](#a-deactivation-filter-that-is-right-for-a-current-total-destroys-a-monthly-series) | `stamp-filters-differ-stock-vs-series` |

## The refusals, and what each one actually protects

### A database without the closing-stamp migration refuses every deletion, with a false reason

Written 2026-09-08, as the memory `pre-034-refuses-every-deletion`.

Found 2026-09-07 in `deleteAccountService.js`, held unfixed under the deletion
commit freeze ([[deletion-surface-commit-freeze]]).

`accountCheck` selects `ua.*`, which never names `closed_at`. Where
`034_add_account_closed_at.sql` has not been applied the returned row object
simply lacks the property, and nothing raises — the branch tests are JavaScript
property reads, not SQL column references. `undefined !== null` is **true**, so
every account reads as closed. The hard-delete branch and the RTA branch each
refuse with a 400 telling the owner the account "was closed and settled" and its
balance "has already been moved", of an account that was never closed. The soft
branch names the column in SQL and does raise.

**Why it is not a one-character fix:** loosening the comparison so a missing
column reads as "not closed" converts a false refusal into a permit — on exactly
the databases where the system-account guard's type arm is blind, since 031
precedes 034 and the runner halts on failure rather than skipping ahead.
Refusing on a schema mismatch may be right, but then the message has to say that.
It is a decision, and it depends on the unanswered production question of which
migrations are applied.

**How to apply:** this is the counter-example to reasoning about a missing
migration by asking what SQL would raise. `SELECT *` plus a property read fails
silently in JavaScript where a named column fails loudly in SQL, so the same
absent migration produces a loud error on one path and a confident wrong answer
on another. Check which of the two a given site is before predicting either.
Related: [[overview-reads-depend-on-migration-031]], and the type-predicate
blindness in [[boundary-guard-needs-both-arms]].

**The rule has a positive half, and leaving it out causes the opposite error.**
A peer sweeping for a different `SELECT ua.*` defect on 2026-09-07 wrote "a star
select is not by itself a defect", scoped it to the balance column in their head
and not on the page, and it read as a general clearance for this very statement.
The two halves have to travel together: a star-select is **safe** for a column
that exists and is being re-derived, and is a **silent-wrong-answer generator**
for any column a pending migration adds. Neither half alone is usable — one
clears a live refusal, the other condemns every `ua.*` in the codebase. Both were
accepted and written into that peer's plan. See
[[account-balance-column-stays]] for the reader that the safe half covers.

### The guard on the system account needs a stored-name arm beside the account-type arm

Written 2026-09-07, as the memory `boundary-guard-needs-both-arms`.

Carlos ruled 2026-09-07 that the compensation account, and any account the
system creates for itself, must not be deletable by any method. Built into
`deleteAccountService.js` before any branch, uncommitted under
[[deletion-surface-commit-freeze]].

**Two arms, either refusing.** The type arm asks whether the target's stored type
is in the creation whitelist, so an account type a user may not create is one
they may not destroy — creation and deletion share one list and cannot drift.
The name arm compares the stored account name, lowercased and trimmed, to the
reserved literal.

**The name arm is not redundant.** The type only exists where
`031_add_boundary_account_type.sql` has been applied; before it the compensation
account is typed `bank`, which is on the whitelist, so a type-only guard permits
the very account it exists to protect and reports success. That state is
currently unreachable only by accident — the four closed-stamp guards refuse
everything pre-034 ([[pre-034-refuses-every-deletion]]) — and the accident
depends on their comparison form. Rewritten as a bare truthiness test on a
nullable timestamp, `undefined` is falsy, the guard stops firing, and the hole
opens from a commit about something else entirely. Retire the arm only when 031
is confirmed applied in production **and** the name is reserved at creation,
case-insensitively; repairing the stamp reads first makes the arm look redundant
at the moment it stops being.

**Neither arm resolves an account, deliberately.** `checkAndInsertAccount` is
find-or-create with a not-deleted test and `LIMIT 1`, so the compensation account
can fork; a guard simplified into resolve-and-compare protects whichever row came
back and leaves the sibling deletable. A type question and a name question have
no cardinality.

**Accepted false positive:** a user's own account named any case of the reserved
literal is refused too, recoverable by renaming, and the 403 says so. 031's prose
calls such a row the owner's own, but its NOTICE says the resolver of the day
would have returned it *as* the compensation account and ends "reconcile by
hand" — so the migration declined to settle it, and a destructive gate is not the
place to. Both sentences are in the comment.

### The compensation account can fork, and only code that resolves it to one row breaks

Written 2026-09-07, as the memory `fork-breaks-whatever-resolves-to-one-row`.

The compensation (boundary) account is obtained by a find-or-create whose
lookup carries a not-deleted test, lowest id, limit one. So a soft delete of it
makes the next reversal or discard-close create a **second** one while the
original keeps every historical compensating leg. It forks rather than being
excluded.

**The rule that falls out:** everything that breaks under a fork breaks by
resolving that account to a single row. A **type predicate has no cardinality**,
so it refuses or excludes every row of the kind even after a fork. That is why
the Overview module is fork-immune — it excludes by account type at both sites
and never resolves the account — and why a guard written against the resolver
would protect only the row the resolver happened to return.

**Why:** established 2026-09-07 across the deletion, overview and backdating
sessions after each had reached part of it separately. It is the compact form
of a day's work and will otherwise be re-derived.

**How to apply:** write guards and exclusions for that account as type
questions, never as "resolve it and compare the id". Note the type-predicate
immunity is itself conditional on the migration that created the boundary type
being applied — see [[overview-reads-depend-on-migration-031]]. Related:
[[severity-belongs-to-the-consumer]].

### A refusal attached to an account does not protect the rows that record its history

Written 2026-09-07, as the memory `guards-protect-accounts-not-records`.

The deletion service refuses to erase a closed account, on the ground stated in
its own hard-delete branch that the preserved history is the whole product of
closing. The guard is attached to the account. The history it exists to protect
lives in a two-leg settlement pair, and one of those legs is owned by the
counterpart account.

`eraseAccountTail.js` keys on the account being deleted, not on the closed one.
Both settlement legs carry the same two accounts in `source_account_id` and
`destination_account_id` and differ only in `account_id`. So deleting the
COUNTERPART matches the closing account's leg through the shared key column —
nulling the key and replacing the counterpart's name with the placeholder — and
removes the counterpart's own leg by the row-owner delete. Neither closed-account
guard is consulted, because the closed account is never named in that deletion.

Under a discard close the counterpart is the compensation account, so the
system-account guard closes that door. Under a transfer close the counterpart is
an ordinary bank account and the door is open.

The sharper statement is not that the guard is attached to the wrong thing.
There is nothing to attach it to: the record is two rows the schema does not
relate, so "preserve the record" cannot be expressed as a predicate on an
account at all. The open door is not an oversight in the guard, it is the
absence of the relation — the same missing structure as
[[transaction-pairs-have-no-pair-id]].

**Why:** three sessions successively refined "closure keeps both names forever"
and each version was falsified. The last failed because everyone checked the
doors into the ACCOUNT and nobody checked the doors into its ROWS. Downstream
detection is nil: the surviving leg still carries the closure movement type, the
deleted leg sat on the counterpart's account, and the investment card's
reconciliation balances either way, so a half-destroyed closure record renders
as a healthy one.

**How to apply:** when a guard protects an entity because of what its records
mean, first ask whether the record is one object in the schema. If it is several
unrelated rows, no predicate on the entity can protect it, and enumerating
deletion paths only tells you how many doors there are. See
[[rule-can-outlive-its-mechanism]].

### A handler can refuse in JavaScript rows its own WHERE clause admitted

Written 2026-09-08, as the memory `the-refusal-may-not-be-in-the-query`.

Measuring what an endpoint serves by reading its SQL gives a true and incomplete
answer. The statement admits the row; the handler can still refuse it forty lines
later, in JavaScript, and that refusal is invisible to every grep aimed at the
query.

**Why:** on 2026-09-07 two sessions independently measured
`getAccountById` (`getAccountController.js:697-704`) as filtering on account id
and user id only — "no name, no type" — and concluded the compensation account
could be loaded into the edit form by URL. The statement does filter on those two
alone. But at `getAccountController.js:739-751` the handler tests
`account_type_name` against a whitelist of six type names, `boundary` not among
them, and returns 404. So after `031_add_boundary_account_type.sql` the fetch
already refuses that account — by type, accidentally, from a controller written
for an unrelated purpose. The conclusion was right for production, which is
pre-031 and where the account is still typed `bank`, and wrong for any base the
migration has reached. Nobody had read past the query.

**How to apply:** read a handler to its `return`, not to the end of its SQL. Two
consequences that cost time when missed. A test written against a base where the
accidental guard is active passes whether or not the guard you just added fires,
and the 404 comes from a different file than the one you edited — assert on the
message, or build the case on the shape where the accidental guard is absent. And
an accidental guard is single-armed almost by definition: this one is type-only,
so the same rename that defeats every other type predicate defeats it too, and
one addition to that whitelist reopens the path silently. It is never redundant
with the guard the rule actually calls for. Related:
[[one-guard-per-question]], [[a-redundant-guard-is-not-a-defect]],
[[boundary-guard-needs-both-arms]], and [[a-clause-opener-hides-the-rest]],
which is the same failure one scale smaller — reading part of a statement instead
of part of a handler.

### Excluding a row from every list leaves the by-id read reachable

Written 2026-09-08, as the memory `list-exclusion-does-not-gate-a-detail-route`.

On 2026-09-07 I reasoned that the compensation account could not be renamed
through the shipped UI, because every list in `getAccountController.js` excludes
it by name AND by type, and both arms cannot fail at once without a prior
rename. The bootstrap looked closed. It was not: `App.tsx` registers
`account/:accountId/edit`, `EditAccount.tsx` takes the id from `useParams`, and
the form fetches `GET /account/details/:accountId`, which re-uses
`getAccountById` — whose statement filters on account id and user id and nothing
else. A logged-in owner who types the route with the right integer loads the
account into the edit form. No list is involved at any point.

**Why:** a list and a detail route are two different reads. Hardening every list
only removes the *offer*; the detail route takes its subject from the URL, so it
answers a question no list was asked. Concluding "unreachable" from a list sweep
states a property of the navigation, not of the surface.

**How to apply:** when arguing that a record cannot be reached, enumerate the
by-id reads, not the lists — then say which of the two a user reaches with the
address bar. And expect two guard sites rather than one: the write must refuse,
and the by-id read must refuse too, or the form still renders the record's
fields. See [[one-guard-per-question]],
[[anchor-user-impact-on-the-shipped-path]] and
[[a-fork-breaks-whatever-resolves-to-one-row]].

## The referential surface the close has to cross

### Four transaction keys into user_accounts restrict, not the three migration 018 altered

Written 2026-09-07, as the memory `the-fourth-restricting-key`.

Migration 018 turned three foreign keys from `transactions` to `user_accounts`
into `ON DELETE RESTRICT`: `account_id`, `source_account_id`,
`destination_account_id`. **Migration 022 added a fourth**,
`opening_for_account_id`, with the same rule, and `createTables.js` declares it
the same way, so both build paths agree. "The three restricting keys" is the
figure that circulates between sessions and it is wrong — it was on its way to
an external reviewer on 2026-09-07 as a schema claim.

`eraseAccountTail.js` detaches **two** of the four: it nulls the two transfer
keys on surviving rows that name the target, then removes the target's own rows
by `account_id`. The fourth key is never detached and never fires, because no
row exists whose `opening_for_account_id` names an account other than its own —
all three creation writers assign it from the same variable as `account_id` on
the same row, and 022's backfill sets it to `tr.account_id` literally. The
counter leg carries none.

The same unenforced agreement is load-bearing outside deletion:
`overviewBalanceRepository.js` and `derivedBalance.js` identify the opening row
by `account_id = opening_for_account_id`. Nothing in the schema ties the two
columns together — the column is a plain nullable FK.

**Why:** two consequences from one convention, in opposite directions. If
anything ever stamps that column onto another account's row, the physical delete
fails on a key the engine was built to make unreachable, and Overview's opening
row stops being unique. Both failures look like data corruption rather than a
missing constraint.

**How to apply:** when counting the referrers of `user_accounts`, say four
transaction keys and name them. When citing 018 as the guard rail, use its own
sentence — "RESTRICT is a guard rail, not the integrity mechanism" — which
already refuses the reading that the keys preserve the counterparty record; the
erasure scrubs the name out of the description in the same statement that nulls
the key. See [[enumerate-the-set-before-ruling-on-one]],
[[movement-type-account-type-is-convention]] and
[[an-inline-duplicate-carries-no-guarantee]].

### Every account carries its own opening row, so the restricting key fires on all of them

Written 2026-09-07, as the memory `no-account-is-physically-deletable`.

Carlos ruled on 2026-09-07 that deletion does not revert historical movements:
the balance of the moment is disposed of, the owner picks a transfer to an
eligible account or a discard against the system account excluded from
aggregates, and no historical movement is modified, deleted or reverted. The
coordination session drew the referential consequence — the row deletions in the
erasure tail must go, because they are the only way to break the rule — and
concluded that an account that moved money cannot be physically deleted.

**The conclusion is stronger than that, and the extra step is the load-bearing
one.** Every account created through the API carries its OWN opening row from the
moment it is created, and that row's `account_id` is the account itself. That is
not an inference: it is exactly what the derived-balance exclusion predicate
tests (`tr.account_id = tr.opening_for_account_id`), and the predicate would
match nothing if the opening row named anyone else. The row exists before any
money moves. So there is no such thing as an account with no transaction rows,
and the restricting key fires on **every** account, not on the subset with
history.

Verified in the boot DDL, both build paths: `transactions.account_id` is
`INTEGER NOT NULL REFERENCES user_accounts(account_id) ON DELETE RESTRICT`, with
the source, destination and opening-reference keys RESTRICT beside it — four
keys, see [[the-fourth-restricting-key]]. `pocket_allocations.source_account_id`
RESTRICTs too and its comment states the intent: deleting an account stays a
decision taken in a service with an impact report.

**Consequence for the module.** Hard delete and the reversal path both stop
existing as PHYSICAL operations. The module collapses to one operation — dispose
the balance, then mark — and "terminal" can no longer mean the row is gone; it
can only mean the mark is unreachable. That contradicted the other thing Carlos
settled the same day, that deletion is terminal in the hard sense.

**Carlos resolved it the same day: terminal means the MARK is irreversible and
the `user_accounts` row always survives. There is no physical account deletion in
this system.** Five writes leave the erasure tail — the two deletes of historical
rows, the delete of the account, and also the two `UPDATE transactions` that null
the counterparty ids and rewrite the description, which existed only to detach
references before a delete that no longer happens. The four service methods
collapse to one: release the pocket allocations by writing the compensating
negative rows, dispose of the balance by transfer or discard, then stamp the
date — in that order, which is obligatory in both directions.

**Retiring the name scrub costs nothing, and the reason is the finding.** It
existed to prevent a dangling name: a counterparty description naming an account
whose row was about to stop existing. Under this rule the row always exists, so
there is no dangling name to prevent — which also dissolves the whole class of
held corrections about the erasure missing the reversal rows that carry the
deleted account's own name.

**The reactivation surface already exists.** The closed-accounts list route's
predicate is `closed_at IS NOT NULL` alone, and its comment already states what
the rule makes universal — a closed account is not gone, its transactions are
kept and readable, this is the only list that serves it — while excluding the
compensation account by name and type. That is the deactivated-accounts screen's
backend, complete, with only the reactivation write missing.

**Why:** a referential rule stated over "accounts with history" sounds bounded
and is not, because the creation path itself writes history. Before scoping a
RESTRICT consequence to a subset, ask what the CREATION path writes — if it
writes a referencing row, the subset is everything. Related:
[[zero-balance-deactivation-confirmed]], [[guards-protect-accounts-not-records]],
[[removal-preconditions-go-over-referrers]],
[[the-ui-already-made-the-schema-decision]].

### A precondition for removing an account has to enumerate every referring table

Written 2026-09-07, as the memory `removal-preconditions-go-over-referrers`.

A rule of the form "remove the row only if removing it destroys nothing" cannot
be tested over `transactions` alone. Two referrers of `user_accounts` are neither
a transaction key nor a cascading subtype table: `pocket_allocations.source_account_id`
and `debtor_accounts.selected_account_id`. Neither writer emits a transaction
row, so an account can be named by either while its sole ledger row is its own
opening.

**Why:** the constraints read as protection and are not. The allocation key
restricts, but `eraseAccountTail` deletes the allocations itself before the
account row, so it never fires. The debtor key is `ON DELETE SET NULL` in both
build paths — nothing refuses, nothing is deleted, another account's row is
silently pointed at nothing. Migration 020 had to clear that column by hand for
the same reason. What keeps it from biting today is accidental: a debtor's
opening entry has the selected account itself as counterparty and writes its row
unconditionally, so that account fails the precondition on a rule about
transactions rather than a rule about debtors.

**How to apply:** state the precondition as a list of referrers with transaction
rows as one item, and re-enumerate the list from both the migration chain and the
boot DDL rather than from either. See [[sweep-both-build-paths]] and
[[a-redundant-guard-is-not-a-defect]].

**The transactions item is FOUR keys, not three, verified 2026-09-07 after 02
corrected the count.** Migration 018 turned three to RESTRICT — the owning
`account_id` and the two transfer keys — and migration 022 added a fourth,
`opening_for_account_id`, RESTRICT in both build paths (`createTables.js:205`).
`eraseAccountTail` detaches two of the four. The fourth never fires today only by
a writer convention: all three creation writers assign it from the same variable
as `account_id` on the same row (`accountCreationController.js:348-350` and
`:852-856`, `accountCategoryCreationcontroller.js:400-402`), and the counter leg
carries none, so `DELETE FROM transactions WHERE account_id = $1` removes every
row that carries it. The day anything stamps that column onto another account's
row, the drop fails on a key nothing detaches — loudly, as a 23503, which is why
a comment naming the condition is proportionate and a fourth UPDATE would detach
nothing. Same accidental-coverage shape as the debtor counterparty row.

### Both deletion writers emit two-row pairs and nothing in the schema relates the two rows

Written 2026-09-07, as the memory `transaction-pairs-have-no-pair-id`.

`transactions` has no pair, group or batch identifier. `003_transactions.sql`
declares none and the only columns added since are the six FX ones in `007`. Two
legs of a settlement or a reversal are related only by sharing a
`source_account_id`/`destination_account_id` pair and being written in one
transaction — they differ in `account_id` alone.

The same file carries a commented-out `transaction_entries` table with a
grouping `transaction_id` and a debit/credit `entry_type`. The double-entry
design was written and abandoned, and both deletion writers
(`recordClosureSettlement.js`, `recordAnnulmentTransaction.js`) emit that shape
as loose rows.

Four defects found separately on 2026-09-07 by three sessions are all this one
absence:
- A half-written closure reversal is undetectable — with the movement type
 reused, type and sign match a genuine closure.
- Deleting an affected account removes its own leg and orphans the boundary
 account's, and an orphan cannot be told from a leg that never had a partner.
- A reversal cannot be attributed to the deletion that caused it: the target
 account is in no key column on those rows, only in the description text.
- Overview's five predicates match the `RTA Annulment Target(` prefix because
 nothing structural marks the rows.

**Why:** each session reported its own consequence and I answered each
separately for hours before noticing they shared a root. Three correct facts
that I failed to combine cost more than the five wrong measurements I withdrew
the same day.

**How to apply:** when two or more sessions report defects in one module,
look for the single missing structure before answering any of them. If a pair
identifier is ever added: nullable, never a foreign key to `user_accounts` —
`018`'s RESTRICT would block the erasure or let the tail null it — and
forward-only, since nothing in the data records which rows were partners.

Generated, never derived from `account_id`, for two reasons that cover
different paths. On hard delete it would dangle: `eraseAccountTail.js` runs
`DELETE FROM user_accounts` last, so the value points at a row that no longer
exists. On closure it would collide: closure and reopen repeat on a live
account, so every cycle would carry the same derived value and the identifier
would name an account instead of the event. Not a name leak — `account_id` is
`SERIAL` and its row is gone, so nothing maps the integer back to a name.

See [[absence-is-measured-in-the-module]] and
[[migrations-must-be-right-the-first-time]].

### A foreign-key violation the server caused comes back as a 400 blaming the caller

Written 2026-09-07, as the memory `a-server-side-violation-returns-400`.

`handlePostgresError` in `backend/src/utils/errorHandling.js` maps
`case '23503'` to `code = 400` with the message
`'Constraint violation: Invalid foreign key.'` Around a dozen modules import it
— the three account creation controllers, the edit controller, the transaction
and dashboard controllers, the deletion service, and several write utilities.
The file exports **two** mappers; the Spanish-suffixed `handlePostgresErrorEs`
is separate and its default demotes a domain 400 to 500. Confirm which one a
module imports before reasoning about its status codes.

The consequence is about triage, not about the number. A foreign-key violation
the **server** caused — a reference the code failed to detach, a catalog id it
failed to seed — comes back with the same status and the same string as a
genuinely malformed request. A 500 gets investigated; a 400 gets filed as caller
error and can sit unexamined while every individual request fails. The evidence
that separates them exists only in the server log, where the full error object
is printed by `console.error` before the mapping.

**Why:** this changes the severity of any finding whose failure mode is a
constraint violation. "It fails loudly, so it is note-it rather than fix-it" is
half true: loud in the log, silent in the response. The half that actually
carries the severity is whether the transaction rolls back — both deletion paths
`ROLLBACK` before propagating, so nothing is partially destroyed, and that is
the sentence worth writing down.

**How to apply:** when assessing a defect that ends in a constraint violation,
say which audience hears it, and anchor the severity on rollback rather than on
loudness. When specifying a frontend error state, remember a 4xx here does not
mean the user did anything wrong. See
[[missing-table-fails-loud-missing-type-fails-silent]],
[[severity-belongs-to-the-consumer]] and [[the-fourth-restricting-key]].

## The balances, and what may be inferred from them

### The stored balance column is kept and must always equal the ledger derivation

Written undated, as the memory `account-balance-column-stays`.

`user_accounts.account_balance` is **not** retired. Carlos ruled on 2026-09-07,
in his own words: *yo dejaria la columna, solo como informacion de consulta
rapida, y para no hacer una migracion para eliminar dicha columna, no obstante,
es importante mantenerla actualizada con el verdadero forma de calcularla.*

Two obligations follow, and the second is the live one:

- No migration drops the column, and no plan proposes dropping it.
- Every path that writes a `transactions` row must leave the column equal to
  `derivedAccountBalanceSql`. The single writer is
  `setAccountBalanceFromLedger.js`; measured 2026-09-07, every ledger writer
  calls it, closure settlement included (`deleteAccountService.js:840-841`).

This reverses my own recommendation of the same day, which was to close the two
sites that publish the stored column and then drop it. The first half stands as
work; the second half is cancelled.

**Why:** he wants a cheap column to read when inspecting the database by hand,
and he will not spend a migration on removing one. A stale value is what makes
that unsafe, so correctness is the whole requirement.

**How to apply:** treat the column as a cache with an invariant, never as a
source. Reads still take `derivedAccountBalanceSql`. A new write path is
incomplete until it re-derives. See [[derived-and-stored-share-names]],
[[two-balance-columns-differ]] and [[measured-agreement-is-not-an-invariant]] —
that last one is the reason a check has to exist rather than an observation
that the values currently match.

**The obligation has one client-facing consumer, found 2026-09-07 and verified.**
It is not only hygiene. `setAccountBalanceFromLedger.js` ends with `RETURNING
ua.*`; on the annulment path `deleteAccountService.js` reads
`slackRow.account_balance` off that returned row into `finalSlackBalance`, and
the RTA success response publishes it as `data.finalSlackBalance`. The read is
sound because it sits one statement after the write that re-derived that account
inside the same transaction — but it means a broken invariant reports a wrong
compensation-account balance to the owner, in the module whose writes are
frozen. Do not convert that read; it is the reason the invariant needs a check
rather than a comment.

### The stored balance on the account and the after-transaction figure on the row are unrelated

Written 2026-09-07, as the memory `two-balance-columns-differ`.

Corrected 2026-09-07 by the overview session. The two balance columns are not in
the same category and must not be discussed together.

`user_accounts.account_balance` is **not a cache**. It has one writer,
`setAccountBalanceFromLedger.js`, which computes it with `derivedAccountBalanceSql`
— the same expression every read path imports — under the row lock, called by the
money paths. Measured on `fintrack_dev`: 31 accounts, 0 disagreeing with the
ledger. The Overview lists publish it directly rather than recalculating.

`transactions.account_balance_after_tr` is an abandoned sentinel: `recordTransaction.js`
writes `0.00` into it deliberately, and it is absent from `MovementTransactionDataType`,
so no client reads it.

**Why:** I had been treating both as one "stored versus derived" problem and
routing findings on that basis. Only the second column is stale data; the first is
a projection that is correct by construction on every path except account creation.

The account-creation exception, verified in both controllers on 2026-09-07: every
refresher call passes the counterparty's id — `slackCounterAccountInfo.account_id`
in `accountCreationController.js`, `counterAccountId` in
`accountCategoryCreationcontroller.js` — and the new account's own id appears in
none of them. The new account's stored balance and its opening ledger row are two
distinct fields of the same options object, so they agree by two computations
coinciding, not by derivation.

**How to apply:** name which column before reasoning about drift. Related:
[[derived-and-stored-share-names]], [[severity-belongs-to-the-consumer]],
[[verify-relayed-measurements]] and [[measured-agreement-is-not-an-invariant]] —
the 31-of-31 figure is dated evidence that two computations agree, not evidence
that anything forces them to.

### The investment card reconciliation is a check that can fail, not an identity

Written 2026-09-07, as the memory `the-reconciliation-is-not-an-identity`.

The Overview investment card's reconciliation compares capital contributed plus
realised result plus closure adjustment against the ledger balance, all cut at
the same month boundary. It is NOT an identity, and calling it one invites a
reviewer to delete it. The comparison is real rather than float-fuzzy: the
derived expression is cast NUMERIC in that statement and all four figures pass
through `toAmount` before a decimal equality.

**The failure mode that stands, unconditionally.** The left side sums movement
types transfer and account-opening plus pnl and account-closure. The right side
is the whole derived balance. So any row on an investment account whose movement
type is outside those four, before the boundary — expense, income, debt, pocket,
receive — is in the ledger balance and in none of the three terms, and the
notice fires. That alone makes it a check, not an identity.

**A SEPARATE claim, found 2026-09-07 and confirmed by the Overview session the
same day. It does not revive the withdrawn one below, which stays withdrawn.**
That one was a value disagreement between the opening row and the
starting-amount column, and it is still false: all three creation paths write one
variable into every position. This one is a different mechanism with a different
failure — a producer exists and it is a DELETER, not a writer, which is why
enumerating the creation paths could not find it.
Migration 018's header states it: before that migration the three foreign keys
from transactions to user_accounts deleted on CASCADE, and the rule follows
`source_account_id` and `destination_account_id`, not only `account_id`. So
hard-deleting one account deleted ledger rows belonging to accounts that were
never deleted.

Applied to this comparison, the effect is sharper than the one I withdrew. It
does not make the row and the column disagree in VALUE — it deletes the row and
leaves the column. An investment account opened with money from another account
carries its opening credit as a row whose source is that funding account; delete
the funder before 018 and the row goes. The left side of the reconciliation sums
account-opening rows, so it loses the opening; the right side takes the opening
from `account_starting_amount` and never counted the row at all, since the
derived expression excludes the account's own opening credit by construction.
The two sides part by exactly the opening amount and the notice fires forever,
on data where nothing is wrong and no figure is incorrect — a row is simply
absent.

Bounded on both ends: it needs a hard delete performed before 018 ran in that
database, and RESTRICT plus the deletion engine make it unproducible now.

**The obvious test cannot see it, corrected the same day.** Comparing the stored
balance against the derived expression is blind to this mechanism in both
directions. The derived expression zeroes the row whose movement type is
account-opening and whose account equals its opening reference — which is
exactly the deleted row — so that row contributed zero while it existed and
deleting it moves the derived figure by zero. The stored column never moved
either. The account presents as clean while the card's notice fires.

The query that does answer it counts accounts holding a non-zero starting amount
with no surviving row whose opening reference is themselves. The stored-versus-
derived comparison is still worth running, but for a different case from the same
cascade. One cascade, two mechanisms, and neither instrument sees both.

**The discriminator is the exclusion predicate, never the movement type —
corrected 2026-09-07 after I and the deletion session both had it too narrow.**
The second population is NOT "ordinary transfer legs". It is any surviving row
naming the deleted account in `source_account_id` or `destination_account_id`,
whatever its movement type. `prepareTransactionOption` sets the opening reference
to `accountInfo.opening_for_account_id ?? null` and the counter leg's object
never supplies it, so **the funder's leg of an opening is movement type
account-opening with a NULL reference** — and the exclusion tests the row's
account against that reference, which a NULL comparison fails. The funder's leg
was always counted in the derived balance. So an opening PAIR straddles the
boundary: the opening account's own leg is invisible to the comparison, the
funder's leg of the same opening is visible to it.

Enumeration closing the set: pre-018 three keys cascaded. `account_id` took only
the deleted account's own rows, which is not survivor damage. `source_account_id`
and `destination_account_id` produced both survivor populations.
`opening_for_account_id` could not participate at all, because 022 created it
after 018. Two survivor populations, no third — see
[[the-fourth-restricting-key]].

The complementarity is exact, and the reason is worth stating as a rule: **a term
that a measurement zeroes by construction is a term whose DELETION that
measurement cannot detect.** Population one moves the reconciliation's left side
alone, so the notice fires and the comparison sees nothing. Population two moves
the derived figure and the stored column not at all, so the comparison sees it
and the notice never fires — both of the card's sides lose the same row and move
together. Two populations, two instruments, no overlap; granting only one request
leaves a population nothing can find.

One consequence for the card's own wording, accepted by the Overview session as a
stated limit rather than a defect: its contributed-capital term filters on
movement type alone, so an investment account that funds another account's
opening carries a negative account-opening row inside a figure labelled capital
contributed. The arithmetic closes because the derived side counts the same row.
The label is what is wrong, and narrowing the term would break the identity it
exists to satisfy.

**The failure mode I claimed and withdrew, 2026-09-07 — withdrawn as to writers,
see above.** The two sides count the
account's opening once each, the left from the opening ROW and the right from
`account_starting_amount`, so in principle a disagreement between the row and
the column shows up here. In practice it cannot arise from the API: all three
creation paths compute one value and pass it to all three positions —
`newAccountBalance = convertedAmount` in the basic path, one signed
`transactionAmount` in the debtor path, `transactionAmount =
convertedStartingAmount` in the category path — each passed into both the
starting-amount and balance columns and onto the opening row. The migration
session measured it and I verified all three. There is one conversion and one
variable, so nothing rounds twice.

**Why:** a derived balance is not "its transactions" — it is a stored column
plus its transactions — but the gap between the two is closed by construction at
every writer, and the difference between "the terms differ" and "nothing
produces a difference" is the whole finding. The remaining candidate is a data
claim, not a code one: the population migration 022 backfilled, where a legacy
opening row written before the current sign and conversion handling could
disagree with the column stored beside it. That needs a count before it is
stated as a fact.

**How to apply:** before calling a comparison an identity, write out both sides'
terms and look for one that is stored rather than summed — then check whether
any writer can actually make them differ. See
[[measured-agreement-is-not-an-invariant]], [[rule-can-outlive-its-mechanism]]
and [[verify-relayed-measurements]].

### No constraint ties a movement type to an account type; the agreement is convention

Written 2026-09-07, as the memory `movement-type-account-type-is-convention`.

The Overview investment card asserts that capital contributed plus realised
result plus closure adjustment equals the ledger balance. Measured on
fintrack_dev on 2026-09-07 it holds exactly, gap 0.00 on a balance of
100044.62, and the 0.75 discrepancy an older plan document still records as
open is claimed by a third term the code already has.

That identity depends on only three movement types ever landing on an
investment account — transfer, account-opening and profit-and-loss. A census
found exactly those three and nothing else. **Nothing in the schema enforces
it.** No constraint ties a movement type to an account type, so a movement of a
fourth type would sum into the derived balance with no term claiming it, and
the card would report the books inconsistent. The agreement is convention, held
up by which code paths happen to exist.

A constraint restricting movement types per account type was considered and
DECLINED on 2026-09-07, for two reasons worth keeping: it would express a rule
about business meaning as a schema constraint, the shape that already burned
this project once — see [[accounting-currency-has-no-home]], where no CHECK
could be written without a ruling first — and the census was nine rows on three
accounts of one user, enough to describe today and not to legislate.

The decline covers the SCHEMA form only. An allowed-pairs table inside the
transaction controller is a different proposal and is untouched by it: the
movement name arrives from the query string, the only rewrite is the pocket
case, and the allowed-pairs rules already in that file are prose comments rather
than code. The application layer is the right place precisely because the rule
is a business rule — the same argument that declined the schema form. When
raising it, say so explicitly or it reads as the same question returning.

The type predicate already in that file is not coverage for it. The account
lookup joins the account-type table and tests the type name, which makes the
request's DECLARED types answerable to reality — it stops a request lying about
an account's type. It does not stop a truthful request pairing a legal type with
an illegal movement. See [[one-guard-per-question]].

**Why:** recorded so a later migration touching the movement types catalog
names this as considered and declined, rather than rediscovering it as
something nobody thought of. An omission that was deliberate and an omission
that was missed look identical in a schema.

**How to apply:** if a migration of mine reaches the movement types catalog,
state this in its header as a deliberate omission and leave it declined unless
Carlos rules otherwise. See [[a-plan-file-is-not-the-module-state]] — the same
day, the plan for that module described a two-term identity the code had
already replaced with three, so the decision read as open while the code had
closed it.

### The transaction status column is unconstrained text with one value ever written

Written 2026-09-08, as the memory `transaction-status-is-an-unconstrained-enum`.

`transactions.status` is declared `status TEXT NOT NULL,` with no CHECK and no
default, identically on both build paths — `003_transactions.sql:56` and
`createTables.js:188`. The legal set of values lives only in JS literals — seven
of them, all writing `'complete'`: `transactionController.js:827` and `:868`,
`recordAnnulmentTransaction.js:151` and `:187`, `recordClosureSettlement.js:187`
and `:216`, and `prepareTransactionOption.js:23`.

The last is the shared builder for ordinary movements, and it hardcodes the
value rather than taking it as a parameter, so a second status cannot arrive
through the main path without someone editing that file.

Measured 2026-09-08 across four local databases, including the untouched
2026-08-21 production dump: `'complete'` is the only value present, 785 rows on
`fintrack_prod_data`, 780 on each rehearsal, 139 on `fintrack_dev`. No other
value has ever existed.

**Why it matters:** two deletion paths disagree about the column and the
disagreement is dead only while one value exists. The impact report filters
`AND tr.status='complete'` at `getAnnulmentImpactReport.js:52` — the line
carries the comment `--no effect so far` — while the erasure's
`DELETE FROM transactions WHERE account_id = $1` at `eraseAccountTail.js:105`
has no status filter. A second status makes the report under-count what the
erasure removes.

**How to apply:** the first migration that introduces a second status (a
scheduled or pending row, which is the shape backdating would need) owns the
fix, and has to settle it before the column gains a value: either the erasure
filters the same way or the report stops filtering. A CHECK constraint pinning
the column was deliberately NOT added — it would force that conversation at
migration time, but it also pre-empts a schema decision that belongs to whoever
owns backdating. Recorded by the deletion session in PLAN_CLOSE_ACCOUNT.md §12.2;
do not duplicate the finding elsewhere. See [[sweep-both-build-paths]].

### A CHECK on a record of something that already happened refuses to record the truth

Written 2026-09-08, as the memory `constraints-govern-state-not-history`.

Ruling given 2026-09-08 for the account closure registry, asked for by the
deletion session and settled from the chain side: **no CHECK binds the
registry's stamped `account_name` to its stamped `category_name` /
`subcategory`.**

**Why:** account 122 ends up with a name and parts that disagree because
`013_normalize_category_budget_name_case.sql` trimmed one column and skipped the
other. A CHECK would not prevent that state — it exists already — it would only
refuse to record it, so the one account that documents the migration's asymmetry
would become the one account that cannot be closed. The guard would protect the
schema from the truth. The creation-order argument points the same way: the
extension row is inserted after `user_accounts`, so the parts do not exist when
the registry row is written. See [[a-fork-breaks-whatever-resolves-to-one-row]]
and [[time-dependent-rules-cannot-be-constraints]].

**How to apply:** draw the line at what the row is *about*. A closure timestamp
and its reason appearing and disappearing together is a property of the record
itself and belongs as a CHECK. An agreement between values the record merely
observed is history, and history is reported by a query, never enforced by a
constraint. Do not quote this as "no CHECKs on the registry" — that is the
wrong generalisation. Related: [[guards-protect-accounts-not-records]].

## The compensation account, and the migration that types it

### The retyping migration keys every guard on the literal account name

Written 2026-09-07, as the memory `031-has-an-unstated-precondition`.

Measured on `main` 2026-09-07, in
`backend/src/db/migrations/sql_migrations/031_add_boundary_account_type.sql`.

All three of the migration's tests and its backfill key on the exact literal
name: the EXCEPTION fires for an account **named** `'slack'` carrying an
unexpected type, the NOTICE reports case variants of that name, and the UPDATE
retypes `WHERE account_name = 'slack' AND account_type_id = 1`. The commented
DOWN reverses on the same pair.

**A renamed compensation account matches none of them.** It is not retyped, not
flagged as an unexpected type, not reported as a near miss. `retyped` comes back
0, the NOTICE says so, and the migration **succeeds**.

**And 0 is also the right answer for a database where no compensation account
was ever created.** The migration cannot distinguish an empty system from a
renamed one — same notice, same success — and after it runs, the evidence of
which account was the compensation one is gone. The file is applied and sealed,
so this cannot be fixed inside it.

What produces the renamed account: `patchAccountById` in
`accountEditController.js` scopes only by account id and user id and carries no
system-account guard, while the deletion service's 403 explicitly tells the
owner to rename the account if it is their own.

**Why:** the four outstanding migrations were being treated as an attended run
with no preconditions, and this one has one that only shows up by reading the
backfill's WHERE clause rather than its header.

**How to apply:** before 031 runs against production, Carlos confirms
read-only that every user with compensation activity still has an account named
exactly `slack` typed bank (1). If any is missing, 031 must not run until that
row is reconciled by hand. His 031 authorisation cannot be a bare "run the
chain". See [[a-sealed-header-holds-only-durable-claims]],
[[overview-reads-depend-on-migration-031]] and
[[migrations-must-be-right-the-first-time]].

### That migration reports success whether it retyped the account or skipped it

Written 2026-09-08, as the memory `031-cannot-detect-a-renamed-boundary-account`.

Measured 2026-09-07 on main, after coordination found that `patchAccountById`
carries no system-account guard.

`031_add_boundary_account_type.sql` backfills with
`UPDATE user_accounts SET account_type_id = 8 WHERE account_name = 'slack' AND
account_type_id = 1`. Its two safety nets both key on that same name: an
EXCEPTION when an account **named** `slack` carries a type other than bank(1) or
boundary(8), and a NOTICE for case variants of that name. **A renamed
compensation account matches none of the three.** It is not retyped, raises
nothing, and the migration succeeds and lands in the ledger.

**The decisive property: zero rows retyped is indistinguishable from success.**
It is the correct outcome for a database where no compensation account has been
created yet, and the outcome for one where the account was renamed. Same NOTICE,
same exit status. The file is applied and sealed, so this cannot be corrected in
it — see [[a-sealed-header-holds-only-durable-claims]].

**The end state is permanent.** The original account keeps type bank(1) and a
name no filter matches, so neither the name filters nor the type predicate that
replaces them exclude it: the row carrying the entire compensation history
becomes an ordinary bank account of the owner's in every aggregate, on both
branches. `checkAndInsertAccount.js` is find-or-create on the exact name with the
type folded and defaults to `boundary`, so the next reversal or closure creates a
second, empty compensation account. 031's DOWN is also no longer exact: it claims
to send back "the same rows that came from it", and those rows never moved.

**How a rename happens.** `accountEditController.js` resolves the target by
account id and user id, returns 404 otherwise, and applies no name or type
exclusion — unlike `deleteAccountService.js`, which has that guard with both arms
before the branch. Coordination measured reachability: no account read returns
the compensation account, so it is not reachable by navigating, but the endpoint
takes the id in the URL and ids are sequential integers, so it is trivially
reachable through the API by the owner against their own account. Not an
isolation failure between users. The deletion guard's own 403 text tells the
owner to rename the account if it is theirs, which points at the damaging action.

**What this adds to the production run, and it is the operative output.** The
four outstanding migrations were being treated as an attended run with no
preconditions. 031 has one: before it runs, confirm every user with compensation
activity still has an account named exactly `slack` typed bank(1). After it runs,
the evidence of which account was the compensation one is gone. That is a
read-only production measurement, so it is Carlos's alone — no session queries
production — and it means his 031 authorisation cannot be a bare "run the chain".

**Why:** a migration that identifies its target by a mutable string cannot assert
it found anything, because finding nothing is a legitimate state. The guard that
would have caught it belongs on the writer that makes the string mutable, one
module away, and no amount of care inside the migration reaches it.

**How to apply:** when a migration selects rows by a value the product can edit,
ask what a zero-row result means and whether the file can tell the two meanings
apart. If it cannot, the precondition belongs with whoever runs it, stated before
authorisation rather than after. Related:
[[overview-reads-depend-on-migration-031]],
[[boot-ddl-never-runs-in-production]],
[[migrations-must-be-right-the-first-time]] and
[[conflict-on-the-id-hides-a-wrong-binding]], which is the same shape on a
catalog seed: a statement that swallows the one case that corrupts the binding.

**Measured 2026-09-07: the miss is not cosmetic and the two production actions
are coupled.** A skipped account stays typed bank(1) forever, and the close
path's destination query (`getCloseTransferDestinations.js`,
`ELIGIBLE_DESTINATIONS_QUERY`) excludes the compensation account **by type
alone** — `account_type_name = 'bank'`, no name arm — and is by design both the
owner's selector and the write path's validator, so there is no second gate.
A renamed compensation account therefore becomes a permanently offered
destination for a closing account's residual. It is unreachable today only
because both close-path statements name `ua.closed_at`, which 034 adds, and
`runMigrations.js` sorts by filename and throws on first failure — so no 031
implies no 034 and both fail loudly with 42703. **That mask lifts exactly when
the chain is brought to 034.** So the two production actions stopped being
independent: bringing the chain forward is what makes a missed rename reachable,
and the name check has to happen before 031, not before the deploy. Carlos's
authorisation for the chain needs the name precondition attached, not just the
balance reconciliation.

### A catalog seed keyed on the id cannot fail when that id already holds another name

Written 2026-09-07, as the memory `conflict-on-the-id-hides-a-wrong-binding`.

A catalog migration that pins an id — `INSERT INTO movement_types
(movement_type_id, movement_type_name) VALUES (10, 'account-closure') ON
CONFLICT (movement_type_id) DO NOTHING`, migration 032 — has two failure
directions and they behave oppositely:

- **The name already exists at a different id.** The name column is `NOT NULL
 UNIQUE`, and `ON CONFLICT (movement_type_id)` does not cover a violation of a
 different constraint. The insert raises 23505 and the migration fails loudly.
 Safe.
- **The id already exists under a different name.** The conflict target
 matches, `DO NOTHING` fires, the migration **reports success**, and the catalog
 is left binding that id to something else while the application constant still
 means the named row. Silent, and the migration cannot fail on it by
 construction.

Application code holds the id, not the name —
`ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID = 10` and
`ACCOUNT_OPENING_MOVEMENT_TYPE_ID = 8` in `derivedBalance.js`, plus a bare
`const movement_type_id = 8` inline in all three account creation controllers.
A wrong binding is loud at a write (a foreign key still resolves, so it is
worse: rows land under the wrong type) and **silent at a read**, because the
opening-row predicate in `derivedBalance.js` would simply match nothing and
return a wrong balance with no error.

One hazard that is NOT present here, checked because pinned ids usually imply
it: neither catalog uses a sequence. `movement_type_id` and
`transaction_type_id` are plain `INT PRIMARY KEY` in `001_initial_migration.sql`
— no SERIAL, no IDENTITY — so an explicit id cannot desynchronize anything.

**Why:** the seed verifies nothing after its own insert, so the one case that
corrupts the id-to-name contract is exactly the case the conflict clause
swallows. Recorded against my own file rather than someone else's.

**How to apply:** in a catalog migration, conflict on the NAME, or follow the
insert with an assertion that the id and name are bound as intended. In the
application, assert the id-to-name binding at boot rather than the id's
existence — an existence check passes in precisely the failing case. See
[[parity-cannot-see-boot-path-gaps]], [[a-server-side-violation-returns-400]]
and [[migrations-must-be-right-the-first-time]].

### The boot swallows a currency-catalog failure because it runs before the table exists

Written 2026-09-09, as the memory `boot-catalog-catch-is-load-bearing`.

`app.js:64` loads the currency catalog and `app.js:67` catches the failure and
only logs. That catch is not an oversight: `src/index.js:12` evaluates
`app.js` at import, before `startServer()` reaches `await initializeDatabase()`
at `src/index.js:37`, and `populateDB.js:140-143` is what creates the
`currencies` table when it is absent. On an empty database the load throws by
design, and the catch is what lets the boot reach the step that creates the
table. Making it exit or rethrow would leave a new database permanently
unbootable.

On the deployed path the catch has no repair step behind it at all:
`backend/index.js` is the Vercel handler and imports `./src/app.js` directly,
so `startServer()` and `initializeDatabase()` never run there. Only the lazy
reload at `fxDBaccess.js:30` can recover a failed catalog in production.

**Why:** the fail-fast guard three paragraphs above it (`app.js:50`, on
`JWT_SECRET`) reads like a convention this one breaks, so the catch invites a
"fix" that only fails on databases nobody has yet.

**How to apply:** the real hazard is `currencyLookup.js:71`, which re-exports
the throwing `getCurrencyIdSync` from a module whose `getCurrencyId` at `:17`
already falls back to a DB query on the given client. All four transaction
writers import the throwing one. Fix the writers, never the catch. See
[[a-probe-that-skips-reports-a-pass]] and [[boot-ddl-never-runs-in-production]].

## The accounts the close is offered on

### The module is rebuilt around one operation, CLOSE, and what that operation destroys

Written 2026-09-08, as the memory `close-deletes-the-account-row`.

Carlos annulled every earlier deletion plan on 2026-09-07 and ruled the module
is rebuilt from a fresh conceptualization. **Only one method survives: CLOSE.**
Reversal-by-annulment, hard delete and the soft path are out of scope. The plan
of record is `PLAN_CLOSE_ACCOUNT.md` in the deletion worktree.

**CLOSE physically deletes the account row and leaves every transaction row in
place.** It moves no money, writes no transaction, reverts nothing, and is not
reversible. His motive, in his own words, is to keep no dead rows in the tables.

**Which types close, ruled by him across one afternoon and reversed twice.** Six
of the eight: `bank`, `cash`, `investment`, `debtor`, `income_source` and
`category_budget`. Only the compensation account (`boundary`) never closes;
`pocket_saving` no longer exists. He rejected the words *categoria* and *familia*
outright — *las cuentas no son de categoria, son de category_budget, y si pueden
desaparecer por cierre* — so a `category_budget` account is one account row with
one extension row, never a grouping.

**The zero-balance refusal applies to four of the six.** He waived it himself for
`income_source`: *tambien es borrable, pero no se le exige que sea saldo cero*.
The reason it cannot be universal is measured off the writers, not a database:
the income source is always the source leg (`movementInputHandler.js:24`) and
that leg carries `amount: -numericAmount` (`transactionController.js:828`), so
its balance runs below zero with every income. `category_budget` is the mirror
image through `movementInputHandler.js:16` and runs above zero.

**The registry, and what he changed about it.** A table carrying every account id
ever issued, written at creation, never deleted from, with name, type, currency
and starting amount stamped at closure and the closure fields on the same row.
**Six keys are repointed at it, not nine:** the three on `transactions`,
`opening_for_account_id`, `pocket_allocations.source_account_id` and
`debtor_accounts.selected_account_id`. Never restate the registry as "a table
filled at closure" — that draft was refused.

**The four extension tables keep their own `ON DELETE CASCADE` primary key and
are NOT repointed.** He ruled it: *cuando se borra hay tambien que eliminarla de
esta otra tabla, buscando no por nombre sino por id*. That is already what
`002_accounts.sql:141-143` does, so no code and no migration are owed. It
reverses the migration session's preservation design and destroys ~30
type-specific columns at close, deliberately.

**The budget dies with the budget account, also his ruling:** *category_budget
tiene un presupuesto asociado, asi que con su borrado, se borra el budget
asociado a ella*. Two cascades fire, not one — `budget_monthly_allocations`
references `category_budget_accounts` with cascade, declared in **three** build
paths (`010_create_budget_tables.sql:43`, `supabase/001_production_alignment.sql:402`,
`createTables.js:407`). Preserving those rows was rejected on measurement: three
independent readers already miss a closed account, so the rows would be unread.

**Closing releases what the account committed to pockets, his ruling of the same
day:** *asi como cuando se cierra una cuenta bank, tambien hay que hacer la
liberacion de lo comprometido por esa cuenta en los pockets correspondientes.*
It reaches `bank` and `cash` only — `ELIGIBLE_SOURCE_TYPES` at
`pocketAllocationService.js:56` is exactly those two. CLOSE writes one negative
`pocket_allocations` row per pocket before the delete, and it cannot call
`pocketAllocationService.release`, which owns its own connection and transaction.
Releasing does NOT permit the delete: `source_account_id` is `ON DELETE
RESTRICT`, so the release and the repointing of that key are two separate
requirements.

**He then asked for the retroactive lowering to be FIXED, not just recorded:**
*cerrar una categoria hoy baja el presupuesto de todos los meses anteriores... sin
que nadie toque ese mes, hay que arreglarlo.* That supersedes the endorsed
recommendation above that preserving budget rows buys nothing — it was
conditional on the readers staying as they are. My recommendation, not yet his
ruling: repoint `budget_monthly_allocations.account_id` at the registry plus a
terminating zero row at closure. The requirement is not "freeze the past":
`budgetAllocationService.js:222` deliberately permits writing a budget into an
elapsed month.

**The category name survives only as a parse, and that was measured down on
2026-09-08.** `accountCategoryCreationcontroller.js:82` and
`accountEditController.js:175` are the only two places that compose
`user_accounts.account_name` as `category/subcategory/nature`, and NOTHING in the
database binds the composite to its parts — `010_create_budget_tables.sql:48-49`
declares only `uq_budget_allocation_month` and `chk_budget_month_is_first`. It is
a convention that holds across 111 accounts today, not an invariant, and
`debtor_accounts.selected_account_name` (`002_accounts.sql:182`) is this schema's
own precedent for a stored name going stale, nulled by
`020_create_pocket_tables.sql:386`. So the registry stamps `category_name`,
`subcategory` and `category_nature_type_id` outright.

**The new CLOSE keeps the name `CLOSE`, ruled 2026-09-07:** *DELETION_TYPE_CLOSE,
con politicas TRANSFER/DISCARD, ruta de preview y un expectedResidual que mueve
dinero, eso correspondia a un plan original que los estamos refactorizando, y tu
formas parte de eso.* The money-moving implementation behind that constant is
what is being replaced, not something to coexist with; its six sites
(`accountDeleteController.js:27, 34, 35, 145, 289, 302` and
`deleteAccountService.js:628, 860`) are commented out, not deleted.

**Deleting the row breaks the history, and the zero condition is what hides it.**
`overviewAccountRepository.js:175-181` says in its own words that *the balance
series would bend at the month of the deletion if those rows vanished*, and that
a closed account is safe because *closing an account writes a compensating
movement*. CLOSE makes the rows vanish and writes no transaction, so both halves
fail. In `MONTHLY_BALANCE_QUERY` (`overviewBalanceRepository.js:65-81`) the stock
term at `:71-73` and the flow term at `:76` are filtered by the same id array, so
they fall together and an elapsed month drops to zero while today's total is
unchanged. Four more statements share the shape, and closing the user's OLDEST
account moves `MIN(ua.created_at)` at `overviewAccountRepository.js:213` and can
suppress a period delta on an unrelated figure. Repointing the six keys makes the
`DELETE` succeed and fixes none of this — they are two separate pieces of work.

**Two decisions he closed on 2026-09-08, and they change the shape.** First:
*si: el historico de una cuenta cerrada debe seguir siendo correcto en los meses
transcurridos*, with the rule *una accion sobre la cuenta en septiembre no puede
modificar retrospectivamente marzo* — narrower than freezing the past, because
`budgetAllocationService.js:222` deliberately permits editing an elapsed month.
Second: the retroactive budget lowering takes **fix 1** — repoint
`budget_monthly_allocations.account_id` at the registry, keep the allocation
rows, write a terminating zero for the current month at closure. **That makes it
seven repointed keys, not six**, and the seventh is declared in three build paths
(`010_create_budget_tables.sql:42-43`, `supabase/001_production_alignment.sql:401-402`,
`createTables.js:406-407`) — but only the third is editable; the first two are
applied and sealed, so key 7 is a NEW chain file carrying an ALTER plus the
boot-path edit.

**He ordered the registry contract written BEFORE the implementation spec**, and
the reason is worth keeping: the budget fix determines part of the contract, so a
registry designed first is designed against the wrong consumer set. He also
rejected the framing that decision A is a join sweep — *A no significa simplemente
cambiar 13 JOINs* — because only one of the four mechanisms is a join, and *no hay
que reconstruir la historia modificando transactions*.

**The registry stamps eight fields, not four.** The earlier line in this memory
(name, type, currency, starting amount) is superseded: measured against the
readers, it also needs `user_id`, `account_start_date`, `created_at` and
`account_type_id` as a real key. `account_balance` and `note` stay out —
`note` is read by nothing off `user_accounts`, and every live `AS account_balance`
is the derived expression, not the stored column. The contract is section 4.6 of
the plan, and the plan now lives on BOTH `feat/deletion` and `main` (he asked for
it on main so he can open it; the three superseded deletion docs were removed in
the same commit).

**Key 7 alone changes nothing a reader can see, measured 2026-09-08.** FOUR
independent removals stand between a closed `category_budget` account and its
budget figure, and any one empties the result: the id array never names it
(`overviewAccountRepository.js:32-39`, filtered downstream by
`WHERE ua.account_id = ANY($1)`); the driving table `FROM user_accounts ua`; the
inner `JOIN category_budget_accounts cba`; and the allocation cascade. Key 7
closes the fourth ONLY, so the schema change and the read change ship in one
block — a migration whose effect cannot be demonstrated becomes a ledger row a
later session reads as proof the problem is solved.

**The contract is fourteen columns**, not the nine or eleven earlier drafts said.
Two written at creation and NOT NULL (`account_id`, `user_id`), twelve stamped at
closure and nullable, where null means *erased before this registry existed*. The
three budget ones above are the last additions, and `currency_id` must be the
RESOLVED value: `budgetTransactionRepository.js:125` reads
`COALESCE(cba.currency_id, ua.currency_id)` and both operands die at close.
Omitting `category_name` does not degrade quietly on the far side of the fix —
`budgetCalculationService.js:271-272` sorts group keys with `localeCompare`, so a
null key throws before any group is built.

**The contract is CLOSED, ruled by Carlos on 2026-09-08** — *cierra con tus
recomendaciones aprobadas*, approving all four: the registry stamps
`category_name`, `subcategory` and `category_nature_type_id`; `close_reason` is
mandatory free text; a BEFORE INSERT trigger on `user_accounts` writes the row at
creation (the schema's first side-effecting trigger); the backfill leaves live
accounts null. **Consequence to remember: the registry's `account_id` cannot
carry an FK to `user_accounts`**, because the trigger writes its row before the
account row exists — and the registry outlives it anyway.

**Section 7 is now an implementation spec, not a phase list**, written against
that closed contract: four blocks, blocks 1 and 2 reviewed apart but RELEASED
TOGETHER, and a six-step close where the stamp reads the extension row before the
cascade fires.

**How to apply:** treat every line as provisional until the plan is frozen — he
reversed himself twice in one afternoon on this module, both times against my own
argument that an account which classifies movements is not really an account.
Related: [[no-account-is-physically-deletable]], [[the-fourth-restricting-key]],
[[deletion-work-lives-in-its-own-worktree]], [[verify-relayed-measurements]] and
[[parity-cannot-see-boot-path-gaps]], since six repointed keys need hand-written
boot-path counterparts no check can miss for you.

### A category account name is three parts joined by convention, not by any constraint

Written 2026-09-08, as the memory `composite-category-name-is-unenforced`.

Measured 2026-09-08 across 111 category_budget accounts — 94 in
`fintrack_prod_data`, 17 in `fintrack_dev`: every `user_accounts.account_name`
splits into exactly three parts on `/`, segment 1 equals
`category_budget_accounts.category_name` and segment 2 equals `subcategory`
(lowercased and trimmed), zero exceptions, and no category or subcategory
contains a slash. Account 79 is the shape: `aceites/OLIVA/want` against `aceites`
+ `OLIVA`.

**Why:** the composite is built in exactly two places —
`accountCategoryCreationcontroller.js:82` and `accountEditController.js:175` —
and `010_create_budget_tables.sql` declares no CHECK and no trigger binding it to
its parts; its only constraints are `uq_budget_allocation_month` at `:48` and
`chk_budget_month_is_first` at `:49`. So the agreement is a convention held by
application code, true today and not guaranteed tomorrow. See
[[measured-agreement-is-not-an-invariant]].

**How to apply:** the temptation is to drop `category_name` from any new
structure because `split_part(account_name, '/', 1)` recovers it. Do not — that
is [[prefix-filters-sit-on-rewritable-text]] with a foreign key riding on it, and
it fails silently under an empty group key the first time a rename reaches
`account_name` without rebuilding the composite. The repo already has that exact
failure in `selected_account_name`. The concrete case: the closure registry must
stamp `category_name` and `subcategory` explicitly, because
`budgetCalculationService` groups the category payload by that string while the
extension row carrying it dies by CASCADE at CLOSE. Related:
[[close-deletes-the-account-row]].

**The convention already has one counter-example, and a migration creates it.**
Measured 2026-09-08 by the migration session on a throwaway restore of the
production dump: `013_normalize_category_budget_name_case.sql` leaves account 122
with `account_name` = `bolsas/plasticas /other` against parts `bolsas` +
`plasticas`. Both its UPDATEs call `LOWER(TRIM(...))` on different strings — the
name statement trims the whole name, where the space is internal and survives, so
the already-lowercase row fails its `WHERE` and is skipped; the parts statement
trims the subcategory alone, where the same space is trailing. 27 names changed
against 28 backed-up rows. So "zero exceptions" above describes the dump, which
predates the migration, not a database that has run the chain.

**It is not permanent: `accountEditController.js:174-176` recomposes and writes
`account_name` from the stored parts on any edit of a category_budget account**,
including a PATCH carrying no category field, and its comment says so. The window
closes on that account's next edit — unless it is closed first, because CLOSE
deletes the row and no edit path survives to reconcile the stamped name with the
stamped parts.

### A deactivation filter that is right for a current total destroys a monthly series

Written 2026-09-07, as the memory `stamp-filters-differ-stock-vs-series`.

The same `deleted_at` filter is right in one query and wrong in the next, and
what decides is whether the output carries a time coordinate.

STOCK figures answer "what do I hold now". `dashboardController.js` has eight
such queries over `user_accounts`, grouped by `account_type_name` and
`currency_code` with no date dimension. A soft-deleted account either counts
today or it does not; there is no curve to bend, so filtering the stamp is the
whole fix and it repairs rows already in that state.

SERIES figures answer "what did I hold each month". The Overview account
repository documents its missing filter with exactly this reason: a
soft-deleted account genuinely owned its balance in the months before deletion,
so removing those rows bends the series at the month of deletion and deletes a
true past. Filtering there is a defect, not a fix.

**Why:** I recommended "filter the stamp in the aggregates" as a general rule
and cf's module falsified the general form within the hour. The rule was right
for the queries I had measured and wrong one directory away, because I had
stated it about a column instead of about the shape of the output.

**How to apply:** before prescribing a filter on a lifecycle stamp, ask whether
the consuming query has a date dimension. Prescribe per reporting shape, never
per column and never per module - the same file can hold both shapes, which is
how a correct comment about the series absence made the stock absence
invisible. See [[severity-belongs-to-the-consumer]].

**Half of this was retired the same day it was written, 2026-09-07.** The stock
half — filter the stamp in current-holdings figures — was reasoning from the
reporting shape. Two later findings answer from the product instead: the soft
branch writes one stamp and nothing else, so the money is genuinely in the
ledger, and the shipped deactivation dialog tells the owner in both languages
that the balance and history stay exactly as they are. Under that promise a
total that hides the balance contradicts the product, and the repair is a surface
that SHOWS deactivated accounts rather than a filter on the totals. The
coordination session's proposal to Carlos is the uniform rule: no balance or
history query filters the deactivation stamp, only the transaction form's account
picker does. The series half survives inside it, and the list half survives as
the picker. Do not offer Carlos both versions — the superseded one reads as an
argument against the rule.
