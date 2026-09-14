# Findings of the Overview module

**What this file is.** The technical findings the Overview work produced
between 2026-09-07 and 2026-09-11 — the 031 dependency investigation, the
three `ListContent` transaction-row defects, and where that component now
lives — held until now in this project's session memory and moved here on
2026-09-14 on the owner's instruction. Each entry is the memory's body copied
verbatim, under the date it was last written. Nothing was rewritten on the
way across: an entry says what was true when it was measured, and where a
later measurement changed it, the entry itself carries the correction,
because that is how they were kept.

**How to read a link.** A name in double brackets was a link to another
memory. Where that name appears in the index below, it is a section of this
file. Where it does not, it was a durable rule kept in memory, or is gone —
the notation never guaranteed the target exists.

**Read `plan-docs/OVERVIEW_NEXT_SESSION.md` first** for what a fresh Overview
session should actually do next; this file is the record of what was
measured, not a task list.

## Index

- [overview-reads-depend-on-migration-031](#overview-reads-depend-on-migration-031)
- [overview-listcontent-defects](#overview-listcontent-defects)
- [listcontent-is-not-shared](#listcontent-is-not-shared)

---

## overview-reads-depend-on-migration-031


Established 2026-09-07 on `feat/overview`, commit `fix(overview): stop excluding
accounts by name`. Five account-name comparisons came out of the Overview reads,
leaving the account type as the sole exclusion of the system's compensation
account.

Before migration 031 that account is typed **bank** — the migration asserts it
and its backfill retypes exactly the bank-typed rows. So on a database without
031 four of those five reads do not merely lose an exclusion, they **invert**:
the income set and the bank balance carry an inclusive type list containing
bank, and the profit-and-loss set and the recent-activity list test inequality
against boundary, which a bank row passes. The system's compensation writes
enter the owner's own figures.

**Why:** no other feature can surface this. Every other reader in the backend
still excludes that account by NAME — the endpoint the live screen renders from
does it at seven sites, and the pocket allocation reader does it too — and a
name predicate works on any database regardless of the type catalog. Being the
only path that depends on 031 is exactly the property that lets a defect reach
production.

Two sharpenings from the migration session, both accepted:
- the dependency is on 031 **succeeding**, not on it having been run: its guard
  aborts if any account of that name carries an unexpected type, and an abort
  stops the rest of the chain, leaving the database in the inverted state.
- the deployed backend never runs database initialization at all, so the boot
  DDL is not a second carrier of the type in production; the SQL chain is the
  only one. See [[parity-cannot-see-boot-path-gaps]] and [[sweep-both-build-paths]].

A claimed permanent residue — accounts named a case variant surviving 031 still
bank-typed — was **falsified**: 031's own notice says the find-or-create resolver
matches names case-insensitively, but that lookup compares the name with a plain
equality and applies its only fold to the account TYPE. A case-variant account is
therefore always the owner's own, and admitting it is correct.

**Subsumed, measured 2026-09-07 after the above.** The inversion is
unreachable on any database where the API serves at all. The migration runner
applies each file in its own transaction and a failure throws out of the loop and
exits nonzero, so the chain HALTS rather than skipping ahead. 031 precedes 034,
and 034 is unconditionally required to serve: the live-account predicate naming
`closed_at` is interpolated into nine account-list queries in the account
controller plus the shared account reader, so a backend without it raises
`column ua.closed_at does not exist` on the core reads. Therefore any database
carrying 034 necessarily ran 031 successfully, and a database that failed 031
has a visibly broken API long before anyone can read an inverted Overview figure.

**Production's position, MEASURED.** Its migrations ledger holds 31 rows and
closes on `030_add_jpy_currency.sql` — read read-only on 2026-09-06, recorded in
`PLAN_MIGRATION_CHAIN.md`, with an earlier 29-row reading on 2026-09-03 whose
filenames were verified individually. The runner skips 001-030 by name and
resumes at 031, so the outstanding set is exactly 031, 032, 033 and 034. No
seeding step, and the alignment file's name is already in the ledger.

Two claims circulated on 2026-09-07 and BOTH were withdrawn by their authors:
that the ledger was empty and needed seeding, and that the outstanding set was
013 plus 019-034. Both came from `fintrack_prod_data`, the control copy restored
from the 2026-08-21 dump — not from production. Anything repeating either is void.

**The subsumption still holds and is now the operative statement.** The runner
applies each file in its own transaction and throws out of the loop on failure,
so the chain halts rather than skipping ahead. 031 precedes 034, and 034 is
unconditionally required to serve — the live-account predicate naming `closed_at`
is interpolated into nine account-list queries in the account controller plus the
shared account reader, so without it the core reads raise
`column ua.closed_at does not exist`. Any database carrying 034 therefore ran 031
successfully, and a database that failed 031 has a visibly broken API long before
anyone can read an inverted Overview figure.

What is RECORDED is not what is MEASURED TODAY. No agent session queries
production; its current state is one read-only query only Carlos runs.

**How to apply:** do not carry this as a separate Overview gate — on a
chain-built database it is a consequence of the chain running whole, which the
API already requires. For production, treat these reads as UNMEASURED rather than
safe until the outstanding files have run, and never infer their state from the
local database. Two things defeat the argument even on a chain-built database: an
operator applying files by hand out of order, and the runner losing its
halt-on-failure behaviour. Not reverting is
deliberate — the name comparison was a live defect that silently dropped an
owner's own account of that name out of their own figures, per
[[a-redundant-guard-is-not-a-defect]] and [[dont-revert-working-code-for-scope]].
Related: [[two-checkouts-read-main-before-reporting]], [[route-a-fix-to-one-owner]].
**THE SUBSUMPTION IS BROKEN AT ITS OPERATIVE STEP, measured 2026-09-07 after two
peers falsified the mechanism I gave it.** What survives: the runner applies each
file in its own transaction and throws out of the loop on failure, so the chain
halts; 031 precedes 034; any database carrying 034 ran 031 successfully. What
fails: the conclusion that nobody can therefore read an inverted Overview figure.
They can. The figure renders.

Measured per file, because a missing column fails loud or silent depending on
whether the code NAMES it in SQL or reads it off a `SELECT *` row:
- the by-type balance endpoints the live screen renders its three figures from
  name neither stamp at all — zero occurrences — so they serve fine without 034
  and return figures that include the compensation account;
- this module's own reads do not name the stamps either, so the new payload is
  in the same position once wired;
- the nine account-list queries in the account controller and the shared budget
  reader DO name it in SQL, so account management raises;
- the deletion service reads it four times as a JavaScript property on a
  `SELECT ua.*` row, so pre-034 `undefined !== null` is TRUE and every hard
  delete and returns-to-assets is refused with a 400 asserting the account was
  closed and settled — silent, and it looks like a product decision.

So a pre-031 database shows working money figures that are WRONG beside broken
account screens. The loud failure exists but it is not in front of the figure,
which is what the subsumption needed.

**The name arm still stands on main, and the 031 dependency is a BRANCH fact,
2026-09-07.** `PNL_ACCOUNT_IDS_QUERY` in `overviewAccountRepository.js` exists
under that name in both checkouts and does not carry the same predicates. Main
has both `ua.account_name != 'slack'` and `act.account_type_name <> 'boundary'`;
`feat/overview` dropped the name arm in the commit above, unmerged. So on the
code main actually holds, the compensation account is excluded by NAME even on a
pre-031 database, and the type dependency only becomes live on the merge. State
which checkout every claim in this file was measured in — the same query
produced two opposite errors in one day, mine true on the branch and false on
main, coordination's true on main and false on the branch.

**The name arm is not a safeguard, measured 2026-09-07 in
`accountEditController.js`.** Two facts, both bearing on whether main's
`ua.account_name != 'slack'` can be relied on. The patch endpoint's only test on
WHICH account it edits is ownership — resolve by account id and user id, 404
otherwise, no name or type exclusion — and it then writes `account_name` like any
other field, so renaming the compensation account is not refused and the arm is
defeatable by an ordinary product action rather than a code change. Whether the
interface exposes that account's id is UNMEASURED and is the half that decides
whether anyone can do it. Second, the name-collision check in the same controller
is scoped per account TYPE, comparing names case-insensitively only within the
edited account's own type — so an owner CAN hold an investment account named
`slack` beside a bank- or boundary-typed compensation account. That is the case
the arm would have wrongly dropped out of the owner's own figures, which makes
Overview's removal of it measured rather than stylistic. Do not record the arm as
protection on either branch without both halves.

**Two gates, conjunctive — do not collapse them in either direction.** I built a
pre-031 exposure on array membership alone and it was refuted: all three
profit-and-loss statements also test the annulment prefix on the ROW, so a
prefixed row never joins whatever array it belongs to. I then swung to
"membership is irrelevant", which is equally wrong. Both sit in the same LEFT
JOIN condition or the same WHERE, joined by AND, so each is decisive exactly when
the other has opened. An intact prefix makes the array moot; a prefix broken by
the name collision makes the array the ONLY remaining gate — and the row that can
break is always the boundary leg, so the compensation account's membership is
load-bearing for the one case that matters. Hence the 031 dependency is real for
that case, on the branch that dropped the name arm.

Before deriving a consequence from an account set, enumerate the other predicates
in the same statement AND ask which one is load-bearing under each failure, not
which one fires first. See [[erasure-misses-the-rows-rta-writes]] and
[[prefix-filters-sit-on-rewritable-text]].

**How to apply, replacing the earlier instruction.** Carry the 031 read to Carlos
as a genuine correctness dependency on the wiring decision, not as a precondition
softened by a loud failure elsewhere. Never argue that a defect is unreachable
because a DIFFERENT module breaks first: measure whether the module holding the
defect can serve, and ask whether the loud failure is on the path to the figure
being trusted. Related: [[missing-table-fails-loud-missing-type-fails-silent]],
[[anchor-user-impact-on-the-shipped-path]],
[[cite-the-shape-not-the-line-number]].

**031 SUCCEEDING does not discharge the dependency — verified in the migration
file 2026-09-07.** The backfill retypes `WHERE account_name = 'slack' AND
account_type_id = 1`. Its abort guard selects on that same exact name and fires
only for an account so named carrying an unexpected type; its case-variant notice
selects on the lowercased name. A RENAMED compensation account matches none of
the three. Nothing is raised, the row count comes back zero as a NOTICE, and the
migration succeeds and is recorded in the ledger — because zero retyped is also
the correct outcome for a database that has no compensation account yet, so the
success is indistinguishable from the healthy case.

The consequence lands hardest on this module, and it is worse than losing an
exclusion. The renamed account keeps type `bank`, and four of these reads scope
by an INCLUSIVE type list — the income set on bank, cash, investment and debtor,
the bank balance on bank and cash. A bank-typed row is not merely unexcluded
there, it is affirmatively SELECTED. So the account carrying the entire
compensation history enters the owner's own bank balance and income set
permanently, matched by no filter of either kind, while a fresh empty compensation
account is created beside it by the find-or-create resolver on the next reversal.

**How to apply:** the correct statement of the dependency is "once 031 has
succeeded AND the compensation account was still findable by name when it ran" —
a data condition the migration cannot assert and does not report. Before
authorising the production run, the row has to be confirmed findable, because
afterwards nothing in the schema says which account it was, and hand
reconciliation BEFORE is the only remedy — there is no repair after.

I first routed a fix to the migration's selection key and that was wrong: 031 is
committed as `b8480e4f` and published on `origin/main`, so it is not editable,
and a corrective file is what the no-corrective-migrations rule forbids — with no
honest key for one to use, since identifying a renamed compensation account
structurally would mean guessing which of the owner's accounts is really the
system's. The chain has no move. What remains is the missing system-account guard
on the account patch endpoint, which is coordination's and prevents new
instances, and the pre-run reconciliation above. Neither is mine to change.

**And the consequence is LIVE TODAY on the shipped path, no migration involved.**
Every by-type query in `dashboardController.js` — the endpoint the Overview screen
renders its three figures from — reads
`act.account_type_name = $2 AND ua.account_name != $3` with the requested type as
$2 and `'slack'` as $3. The type is the CALLER's parameter, so the name is the
sole exclusion. A renamed compensation account keeps type bank, the name arm no
longer matches it, and a request for bank accounts SELECTS it: its whole
compensation balance lands in the owner's rendered net worth. This is the one
version of the finding that reaches a figure a person sees, per
[[anchor-user-impact-on-the-shipped-path]]. 031 closes it for every account it
can retype and cannot touch a renamed one — which is the entire reason the
remedy is reconciliation before the run rather than the run itself. Measured by a
peer, verified by me in the file rather than relayed, per
[[verify-relayed-measurements]]. This is not an argument for restoring the name
arm — under a rename the name comparison fails in exactly the same breath, so the
arm buys nothing against it.

**The unmasking exception does NOT hand back the id — my claim, refuted the same
day by the peer I sent it to.** What is true: the movements search handler binds
its exclusion parameter as `search === 'slack' ? '' : 'slack'` against
`AND (ua.account_name != $5)`, so the exact term empties the parameter and every
account clears that comparison; the projection is `ua.*`; and the boundary
predicate beside it excludes nothing pre-031. What I did not carry is the NEXT
conjunct. The same statement requires the term to match one of eight text
expressions, and all eight are columns of the transaction or its catalogs —
description, status, movement type, transaction type, currency code, amount, and
the two account id columns cast to text. **The account name is not among them.**
So disabling the name exclusion returns only rows whose own text contains the
term, and the compensation account's legs carry generated descriptions that do
not, unless an account involved is itself named that way.

State this precisely rather than as "the finding was wrong": the deliberate
exception IS real — the ternary does disable the name exclusion and the
projection does return the whole account row. Only the search predicate stops it
producing rows for that account. So adding `ua.account_name` to those eight
matched expressions, a one-line change, would make the disclosure true. Carry it
as a latent condition on that statement, not as a retired claim.

Worse than a miss: I had printed those eight expressions in my own output and
concluded from the first predicate without reading the second. Same class as the
truncated WHERE — a conjunction cut short, and cutting one always widens what you
believe the statement returns.

**The conclusion that depended on it survives by a shorter route.** Account ids
are sequential integers scoped to the owner and the patch endpoint takes the id
in its URL, so enumeration is trivial and "nobody can find the id" was never
available as mitigation. The guard's priority rests on the rendered-figure
finding, not on any disclosure path.

**Do not publish a count for that controller.** Three sessions produced three
figures for its by-type statements in one day — six, eleven, and seventeen
occurrences of the name literal, one of them inside a commented block and one the
ternary above. The file was identical in all three readings; only the counting
rules differed. The structural claim carries the argument without a number: the
account type is the CALLER's parameter in every by-type statement, so the name
comparison is the sole exclusion, and the totals query at the top of the file has
no type predicate at all and groups by type instead. Per
[[cite-the-shape-not-the-line-number]] and [[a-grep-count-is-not-a-call-site]].


**DISCHARGED FOR THE ORDINARY CASE, 2026-09-11.** The 031-038 chain is applied on
production; the ledger closes at 39. So the compensation account is typed
`boundary` there, and every read in this file that scopes by an inclusive type
list stopped selecting it on that date. See
[[production-chain-031-038-is-applied]]. The three restrictions this file lived
under — the production freeze, the no-merge rule and the wait on the deploy
branch — were discharged with it.

**WHAT IS NOT DISCHARGED, and the reason is in 031 itself.** Its backfill is
`WHERE account_name = 'slack' AND account_type_id = 1`. A compensation account
RENAMED before the run matches neither that key nor either of the two guards, so
nothing is raised, zero rows are retyped, and the migration succeeds — because
zero is also the right count for a database that has no compensation account yet.
The success is indistinguishable from the healthy case, which is exactly why the
chain having run is not proof.

Under that residue the account stays typed `bank`, and this module's reads do not
merely fail to exclude it: `overviewPageRepository.js:136` scopes `bank_balance`
on `IN ('bank', 'cash')`, so a bank-typed row is affirmatively SELECTED and the
whole compensation history lands in the owner's bank balance and free cash. No
filter of either kind matches it afterwards, and there is no repair in the schema
— hand reconciliation before the run was the only remedy and the run has
happened.

**How to apply.** Do not treat "the chain is applied" as closing this. The one
thing that closes it is the retyped count 031 printed as a NOTICE during the
production run: a count of one (or however many owners hold such an account) says
the row was findable by name and the dependency is fully discharged; a count of
zero says either there was no compensation account or there was a renamed one,
and those two have to be told apart before any Overview figure from production is
trusted. That log line is Carlos's to read — no agent session queries production.
Related: [[measurement-discipline]], [[missing-table-fails-loud-missing-type-fails-silent]].

---

## overview-listcontent-defects


Found 2026-09-08 while sketching the Overview level-2 transaction list, and
**all three fixed the same day** in `7d625f33` on main / `cbe8c89a` on
`feat/overview`, in the order Carlos set. Kept because the reasons are the
constraints the level-2 list still has to respect.

**The row discarded its own identity.** It destructured `transactionId` and
then wrote `key={index}`, with `onClick={() => openTransaction(transactionId)}`
one line down. Harmless on a static page; once pages accumulate or a row is
removed, React reuses the node of a row that shifted, so the click stays correct
while the row under the reader's finger is not the one they aimed at. **This was
the blocking precondition for paginating the level-2 list with accumulation**,
which is why Carlos ordered it before any accumulating list is written.

**The row was not a button.** A `BoxContainer` div with an `onClick`: no
keyboard focus, nothing for `:focus-visible` to attach to, no role. It is now a
real `button`, and its children had to become spans and a bare `time` because a
button takes phrasing content and the `p`/`div` it held were not.

**The empty state fabricated a row.** `LastMovements` rendered
`accountName: 'Account Name'`, `record: 0`, `transactionId: 0` when `data` was
null — a missing figure drawn as `0`, which the style rules forbid, and a fake
row clickable into a transaction that does not exist. Empty is now a declared
state owned by `ListContent`, so the level-2 list inherits it.

**How to apply:** when the level-2 list adds accumulation, the key is already
`transactionId` and the empty state already exists — do not reintroduce either.
See [[listcontent-is-not-shared]] for where the file now lives.

---

## listcontent-is-not-shared


`ListContent.tsx` is the only component in the app that renders transaction
rows. It **used to** sit in `frontend/src/fintrack/general_components/listContent/`
and its folder said shared; its reach said otherwise.

**Four files named it, one was a consumer.** `LastMovements.tsx` imported and
rendered it. `useTransactionDetail.ts` and `TransactionDetailModal.tsx` only
mention it in comments — and the modal was not a consumer at all, since
`ListContent` imports and mounts the modal, so that dependency runs the other
way. The tell was the inverted import: it took its row type `LastMovementType`
from `pages/overview/components/LastMovements`.

**Carlos ruled on it 2026-09-08 and it has moved.** It now lives at
`frontend/src/fintrack/pages/overview/components/ListContent.tsx` with its
stylesheet beside it as `listContent-style.css`, and ownership moved with it.
His condition: the permission covered that component and its minimum
dependencies, and is **not** authorisation to reorganise `general_components/`.
Landed in `7d625f33` on main / `cbe8c89a` on `feat/overview`.

**Why this still matters after the move:** [[shared-tree-ownership]] names
`general_components/**` as one of three boundary paths, justified as "half the
application reads them". For this file that justification was measurably absent
— one consumer, inside Overview. The rule was written on the FOLDER, so it still
pointed at an announced yes even though its reason did not reach the file. See
[[rule-can-outlive-its-mechanism]]. The boundary itself is unchanged for
everything still in that folder.

**How to apply:** do not look for this component in `general_components/`, and
do not treat a change to it as reaching budget, pockets or debts. Its three
former defects were fixed in the same commit — see
[[overview-listcontent-defects]].

---

