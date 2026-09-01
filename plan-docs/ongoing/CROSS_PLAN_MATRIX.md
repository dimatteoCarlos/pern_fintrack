# CROSS_PLAN_MATRIX — where three blocks touch the same contract

**Written 2026-08-30.** A supervision of three blocks read as one set, not three reviews:
the single balance writer (`PLAN_ACCOUNT_DELETION.md` §7), retroactive dating
(`PLAN_BACKDATING/`), and the tracker's form (`PLAN_TRACKER_UX.md`). Every claim here was
checked against the documents and, where it is a fact about data, against `fintrack_dev`.

**There is no `PLAN_MONEY_SERVICE.md`.** Swept across `plan-docs/`, `backend/src` and
`frontend/src`: the document does not exist under that name or any variant. What answers to
the description — the writer that stops accepting a balance and starts deriving one — is
**section 7 of the account-deletion plan**, and that is what this matrix supervises. Naming
it "Money Service" in conversation is fine; expecting a file by that name is not.

---

## 1. The finding that matters: two plans define two formulas for one number

**Both plans replace the stored account balance with a figure derived from the ledger, and
they write different arithmetic.**

| block | formula |
|---|---|
| account deletion §7, `setAccountBalanceFromLedger` | `COALESCE(SUM(amount), 0)` over every row of the account |
| retroactive dating §5.1 | `account_starting_amount` + Σ(`amount`) **except the destination-side account-opening row** |

**They agree today, to the cent, on all 27 live accounts.** That is not luck and not a
coincidence — it is an identity that holds *while* the second invariant of the dating plan
holds. If every account's destination-side opening row carries exactly
`account_starting_amount`, then adding the column and dropping that row gives the same total
as keeping the row and not adding the column.

**They diverge the moment that invariant does**, and the divergence is silent:

| case | deletion §7 | dating §5.1 |
|---|---|---|
| opening row present, amount matches the column | correct | correct |
| **opening row absent, column non-zero** | **misses the opening amount entirely** | correct |
| opening row present, amount disagrees with the column | trusts the ledger row | trusts the column |
| opening row absent, column zero — the counterparty account today | correct | correct |

The third row is where they differ by policy rather than by accident, and the plans have
never had that argument because neither knew the other had an opinion.

**Recommendation: one formula, imported, not two written.** The deletion plan's writer takes
its `SET` expression from the same builder the read path uses,
`utils/fintrackUtils/accountDataRetrieval/derivedBalance.js`. It is the only way the write
path and the read path cannot drift, and it costs the deletion plan nothing — the file
already exists and its arithmetic is already measured.

> **Measured 2026-08-30, working tree.** The writer landed and it does import that builder.
> `utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js` — untracked, not yet
> committed — opens with
> `const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC')` taken from
> `accountDataRetrieval/derivedBalance.js`, and its `UPDATE user_accounts ua SET
> account_balance = ${DERIVED_BALANCE}` is that expression verbatim. So the table above no
> longer describes two written formulas: there is one builder with one caller on each side of
> the pipe. **The open item this section raised is left open in §8 for the developer to close
> in words** — what is recorded here is only what the code does today.

**The risk if this is not settled:** the write path stores one figure and every screen
derives another, on the same account, from the same rows. That is precisely the failure the
dating plan exists to end, reintroduced at the other end of the pipe.

---

## 2. What `user_accounts.account_balance` is for after both blocks land

The two plans read as if they contradict each other and do not. Stated once so the end state
is not re-derived:

```
after retroactive dating commit 3     no screen reads the stored column;
                                      every displayed balance is derived

after account deletion unit 2         the stored column is still written,
                                      now as a projection of the ledger

what still reads it                   the sufficient-funds guard on the write
                                      path, and the pocket module's committed-cash
                                      ceiling inside its row lock
```

**So the column stops being a display value and remains an enforcement value.** That is
coherent, and it is the reason the deletion plan's unit 2 keeps mattering after the reads
switch. It also means **unit 4, the drift repair, has no visible effect on any screen** — it
corrects a figure only the guards consult. Worth knowing before it is scheduled as though
users would see the difference.

> **MARKED, not struck — the premise under this section stopped holding on 2026-08-30, and it
> is the premise the frozen contract at the end of §8 rests on.**
>
> **What this section asserts:** two guards still read the stored column, so it survives as an
> enforcement value — the sufficient-funds check on the write path and the pocket module's
> committed-cash ceiling.
>
> **What the code says.** Neither of the two reads the column any more.
> - The transfer's sufficient-funds check takes its ceiling from
>  `lockAndDeriveBalances(client, userId, [sourceId, destinationId])` and compares with the
>  project's decimal arithmetic:
>  `backend/src/fintrack_api/controllers/transactionController.js:679-694`, where
>  `sourceLedgerBalance = money(ledgerBalances.get(...))` and the refusal quotes
>  `toAmountString(sourceLedgerBalance)`.
> - The pocket ceiling derives too.
>  `backend/src/fintrack_api/services/pocket_services/db/accountAllocationRepository.js:22-24`
>  imports `derivedAccountBalanceSql` and builds `DERIVED_BALANCE`; the second statement at
>  `:241-248` returns `accountBalance` from it, and
>  `pocket_services/services/pocketAllocationService.js:204-210` computes the unassigned cash
>  from that derived figure.
>
> A sweep of `backend/src` finds no remaining consumer of `user_accounts.account_balance` as
> an input to a decision: every list and every detail screen selects
> `${DERIVED_BALANCE} AS account_balance` instead. The column is written by
> `setAccountBalanceFromLedger` and by the delete path's
> `accountDeletionUtils/updateAffectedAccountBalance.js`, and read by neither.
>
> **What this needs.** The frozen contract at the foot of §8 says the column "remains an
> enforcement projection". Measured today it is a projection nothing enforces against, which
> is a different thing and a decision this file cannot take: keep writing it as a materialised
> copy for a future guard, or retire the column. **Left open for the developer.**

---

## 3. The `updated_at` collision is already resolved, and one plan has not noticed

Both plans claim the same three functions —
`transactionController.js:125-144`, `accountManagement/updateAccountBalance.js`,
`accountDeletionUtils/updateAffectedAccountBalance.js`. Both record the same ownership rule:
whichever block reaches them first owns them, and the other records the outcome.

> **Two of those three no longer exist, measured 2026-08-30.**
> - `backend/src/utils/fintrackUtils/accountManagement/updateAccountBalance.js` is **deleted**
>  in the working tree. Nothing imports it.
> - `backend/src/fintrack_api/controllers/transactionController.js:125-144` holds no balance
>  writer today: that span is `getAccountTypes`, `getTransactionTypes` and
>  `balanceMultiplierFn`. The controller now calls
>  `setAccountBalanceFromLedger(client, sourceAccountId, userId)` at `:832` and the
>  destination at `:838`, both **after** `recordTransaction` has written the two movement
>  rows.
> - Only the third survives:
>  `backend/src/utils/fintrackUtils/accountDeletionUtils/updateAffectedAccountBalance.js:8`,
>  with two callers on the delete path,
>  `services/delete_account/deleteAccountService.js:273` and `:311`. It still takes the
>  balance as an argument its caller computed, and it filters on `account_id` alone with no
>  `user_id`.
>
> So the census the two plans share is now **two writers, not three**, and the one the deletion
> block is to replace is the delete-path one.

**Retroactive dating reached them first.** Its commit 1, `fix(account): untie updated_at from
the movement`, is in history as `1208310`.

**Corrected in the deletion plan, verified 2026-08-30.** The sentence that stated the race as
undecided is gone. That plan now records the collision as closed, names the commit that closed
it, and says the block inherits the result rather than deciding it — its unit 2 replaces only
the remaining balance-writing logic, and the ownership rule both plans recorded has been
exercised and must not be reopened as a question. The unit's own entry in the work list carries
the same statement, so a reader who reaches it from either direction is told the same thing.

Measured the same day, and it strengthens the correction: the commit is not confined to the
retroactive-dating branch. It is already in `fix/auth-screen` and published on the remote, so
the deletion block is not inheriting a decision taken elsewhere and awaiting a merge — it is
inheriting a fact already in the trunk it will be built on.

---

## 4. The tracker's form is already partitioned correctly — with three stale spots

The separation of pure interface work from date behaviour, which is the thing worth checking,
**already exists and is explicit**: the tracker plan hands the date control to the dating
block and says *"do not implement the date control from this file"*. What stays is the
disguised submit, the form with no submit handler, a typo, five screens already not uniform,
a stylesheet on no tokens, and the category dropdown's wrong window.

> **Three of those six closed on 2026-08-30.**
> - The disguised submit and the missing submit handler are gone from **all five** screens.
>  Each form now declares `onSubmit={onSaveHandler}` and closes with the shared
>  `general_components/formSubmitBtn/FormSubmitBtn.tsx`:
>  `tracker/expense/Expense.tsx:827` and `:897`, `income/Income.tsx:456` and `:512`,
>  `transfer/Transfer.tsx:750` and `:846`, `debts/Debts.tsx:647` and `:714`,
>  `profitNloss/PnL.tsx:601`. Commits `a8d9457`, `e82c99b`, `878915a`, `4623c78`, `fc77d8d`.
>  `tracker/components/CardNoteSave.tsx` survives as a file with **no importer left anywhere in
>  `frontend/src`**.
> - The typo is fixed: `tracker/expense/Expense.tsx:343` reads
>  `'Category / Subcategory'`. Commit `035661b`.
>
> Still standing from that list: the five screens are not uniform, the stylesheet is not on
> tokens, and the category dropdown's window is a separate question from the title that was
> corrected. The P&L account list is now filtered by date (`e97f22f`), which is not the same
> defect.

Three things in that file contradict its own §4.1:

| where | says | actually |
|---|---|---|
| §7, first task 2 | *"Answer D4"* | settled, and §4.2 of the same file says so |
| §7, first task 2 | *"R66 is the commit that opens this half"* | that guard defect is closed — commit `6adc8de` — and §4.1 of the same file says so |
| §5, Q7 | *"Does the date field land on all five screens at once? **Recommendation: all five**"* | **conflicts with the dating plan**, which sequences the five screens as one commit each, and with the developer's own instruction to decide the control on Expense first and extend from there |

**Q7 is the only one of the three that is a real decision rather than a stale sentence**, and
it is the tracker plan's recommendation that is out of date, not the dating plan's sequence.
The reason the tracker plan gave — that the five screens have already drifted apart — argues
for one *design*, not for one *commit*. Deciding the control on one screen and extending it is
compatible with a single design; shipping five screens in one commit is not compatible with
reviewing any of them.

Its Q6 — whether the date control defaults to today and stays collapsed — is still open there
while the dating plan has already decided the control renders with no visible label. **Not a
contradiction yet**, because collapsed-versus-field and labelled-versus-unlabelled are
different questions, but they have to be answered together or the second answer will reopen
the first.

---

## 5. One premise to correct before it is planned against

The credential rotation for the windowed rate provider is **not** a mandatory requirement of
the dating block. It left that plan: it is operational security maintenance that gates the
production deploy, and it lives in `PLAN_DEPLOYMENT/PLAN_PRODUCTION_MERGE.md` section 4, item
9. No commit in the dating block waits on it. The arm that needs it is itself **not required
for V1**, with the recommendation to drop it left open by the developer.

---

## 6. The overlap matrix

| file or contract | deletion §7 | retroactive dating | tracker form | resolution |
|---|---|---|---|---|
| `transactionController.js` balance writer | replaces it | already untied its `updated_at` | — | **deletion owns it; dating's half is done** |
| `accountManagement/updateAccountBalance.js` | replaces it | already untied its `updated_at` | — | same |
| `accountDeletionUtils/updateAffectedAccountBalance.js` | replaces it | already untied its `updated_at` | — | same |
| the ledger derivation formula | writes one | writes another | — | **open — §1 of this file** |
| `user_accounts.account_balance` | keeps writing it | stops reading it | — | settled by §2 of this file |
| `getTransactionsForAccountById.js`, `getAccountController.js`, `transactionController.js` reads | — | rewrites every balance read | — | dating owns them |
| `pocket_services/db/accountAllocationRepository.js` | — | rewrites both balance reads | — | dating owns them |
| the movement date guard | — | closed, commit `6adc8de` | documents it as closed | no overlap |
| the date picker on five screens | — | commits 10–14, one per screen | Q6 and Q7 still open there | **open — §4 of this file** |
| the tracker's layout, submit, tokens | — | — | owns all of it | no overlap |

> **Corrections to the rows above, measured 2026-08-30.**
> - The row for the controller's own writer points at a span that no longer holds one:
>  `transactionController.js:125-144` is `getAccountTypes`, `getTransactionTypes` and
>  `balanceMultiplierFn`. The two derived writes live at `:832` and `:838`.
> - The row for `accountManagement/updateAccountBalance.js` names a **deleted file**. It is
>  replaced by `accountManagement/setAccountBalanceFromLedger.js`, untracked in the working
>  tree, with five call sites: `transactionController.js:832` and `:838`,
>  `accountCreationController.js:402` and `:910`,
>  `accountCategoryCreationcontroller.js:489`.
> - The row for `accountDeletionUtils/updateAffectedAccountBalance.js` still stands, and it is
>  now the only writer left to replace.
> - The row for the ledger derivation formula is marked open. In code there is one builder,
>  `accountDataRetrieval/derivedBalance.js`, consumed by both ends — see the measurement note
>  in §1. The entry in §8 is deliberately left open.
> - The row for the pocket module points at
>  `pocket_services/db/accountAllocationRepository.js`, which exists and already derives
>  (`:22-24`, `:241-248`). Both reads are done, not pending.
> - The row for the date picker on five screens: the **submit** on all five landed today; the
>  date control did not. No change to that row.

---

## 7. Recommended order, and why it is not the order proposed

The proposal was: supervise the balance writer, then dating, then the tracker form. **The
supervision is done — this file is it.** What the order question actually decides is
execution, and there the constraint is different:

```
retroactive dating commit 3       every balance read derives
      │                            (in progress; the formula it uses is the
      │                             one §1 asks the writer to adopt)
      ▼
deletion unit 2                   the single writer, importing that same formula
      │
      ▼
deletion units 3 and 4            decide and repair the drift
```

**The read side goes first, and not for preference.** It is the side that already has the
formula written and measured, it is the side with the conservation proof, and it is the side
whose absence produces two numbers on one screen. The writer then adopts a formula that has
already been verified against 27 accounts rather than proposing a fourth one.

> **Measured 2026-08-30: the first two steps of that diagram have been executed.** The read
> side is not "in progress" — it is committed: opening an account against the ledger
> (`921bd21`), the per-row balance no longer persisted (`260c54f`), the delete report reading
> the ledger and not the column (`f7cae5b`), one definition of the statement's initial balance
> (`923fcc9`) and the detail screen's derived figure (`17a0714`). The single writer is in the
> working tree, uncommitted, and it does consume the frozen derivation. What remains of the
> diagram is the last box: deciding and repairing the drift.

**Nothing here blocks the tracker's interface work**, which touches none of these files and
can run in parallel at any time.

---

## 8. What is open, and what each open item is waiting on

| # | open item | waiting on | can proceed? |
|---|---|---|---|
| 1 | does the single writer import the read path's formula, or keep its own? | the read side's contract being frozen | **after the read side** |
| 2 | ~~Expense first, or five screens at once?~~ | — | **SETTLED 2026-08-30** |
| 3 | what opens the date control, and whether today reads as a choice or a default | an interface decision only | independent |
| 4 | the windowed rate provider: kept or dropped from V1 | release scope, not this module | independent |

**Row 2 closed the day this matrix was written**, in the tracker plan and by the developer
directly: the five screens converge on one design and land one screen at a time, beginning with
Expense. A common design is not a common commit — five screens in one commit is a change nobody
can review. Later screens extend that decision rather than reopen it.

**Row 3 narrowed rather than closed.** The date control's presentation is one contract of four
parts answered together — initial state, label, expansion, initial value — and two of them are
already settled: the retroactive-dating block decided the field is identified inside the
picker's own control with no separate label, and the recommendation to default to today and stay
collapsed is unchanged. What is genuinely open is what opens the control and what that costs on
a 360px screen, and whether today reads as a choice the owner made or a default they did not
notice. Answering those two reopens neither of the first two.

**Three open items, not four. Only the first has a dependency, and it is the reason this
supervision was worth running.**
If the writer is built before the canonical derivation is frozen, it will propose its own —
which is exactly the duplication §1 just found, rebuilt at the other end of the pipe.

### The execution order that follows

```
    retroactive dating, read path
                 │
                 ▼
      canonical balance derivation
            (frozen here)
                 │
                 ▼
      deletion §7, the single writer
             consuming it
                 │
           ┌─────┴─────┐
           ▼           ▼
      deletion       the drift
      units 3/4       repair
```

In parallel, depending on none of it:

```
    the tracker's interface work        the windowed rate provider
    (one design, one screen at a time)  (release scope, outside both trees)
```

**The windowed rate provider sits outside both trees** because it is not a functional
dependency of retroactive dating: the resolver is written against the three arms that exist,
and this one is neither a defect nor a requirement.

### The contract this freezes

> **`user_accounts.account_balance` stops being a source of truth and becomes an enforcement
> projection of the ledger.** One derivation feeds both ends: the screens read it directly,
> and the stored column is that same derivation materialised for the guards that must check a
> bound inside a lock. There is no second definition of what an account's balance means.

Everything else the three plans raise is either settled in its own document or is a stale
sentence this file names for correction.

---

## Corrections of 2026-08-30 — measurements only

Verified against `fix/auth-screen` at head `e919a89` **with the working tree included**, which
is where most of the drift is: the single derived writer and thirteen pocket-module frontend
files are uncommitted. Nothing below closes, deletes or reorders a decision.

| § | what was corrected |
|---|---|
| 1 | The two-formulas finding, noted as executed: the writer that landed imports the read path's builder from `accountDataRetrieval/derivedBalance.js`. The open entry in §8 is untouched |
| 2 | **Marked, not struck.** Both guards this section names as the column's surviving readers now derive instead — `transactionController.js:679-694` and `pocket_services/db/accountAllocationRepository.js:22-24, 241-248`. The frozen contract's premise no longer holds and the section says what the code says, leaving the decision open |
| 3 | Two of the three named functions are gone: `accountManagement/updateAccountBalance.js` is deleted, and `transactionController.js:125-144` holds no writer. Census corrected to two writers, with the delete-path one located at its two call sites |
| 4 | The disguised submit and the missing submit handler are closed on all five tracker screens, and the `Subategory` typo is fixed at `Expense.tsx:343`. `CardNoteSave.tsx` is left with no importer |
| 6 | Overlap table annotated: the deleted writer, the five call sites of its replacement, the derived pocket reads, and the span in the transaction controller that no longer holds a writer |
| 7 | The execution diagram's first two steps recorded as executed, naming the commits |

**Left alone deliberately.** Every open item in §8 stays open, including whether the single
writer imports the read path's formula — the code answers it, the developer has not. The
frozen contract at the foot of §8 stays as written; what changed is measured beside it in §2.
The recommendation in §4 about one design versus one commit is a decision and was not touched.

**Unresolved.** The claim that the two formulas agree to the cent on all 27 live accounts is a
measurement against `fintrack_dev` that this pass could not re-take — no database was queried.
Whether the category dropdown's window is still wrong is a question for the tracker plan's own
audit; the title fix (`035661b`) is a different defect and does not settle it.

---

## A second instance of §1, found 2026-08-31: two modules, two formulas for the shortfall

Section 1 of this document opens on **two plans defining two formulas for one number**. Here is
a second instance of exactly that shape, and it is further along than the first — both formulas
are **already written and running**, each with its argument set down in a comment beside it, and
neither module knows the other exists.

**The question both answer:** across several savings goals, how much is still to be put in.

- **The pocket module clamps per goal before summing**, and carries the surplus on a separate
  figure. `backend/src/fintrack_api/services/pocket_services/services/pocketBoardService.js:138-139`
  adds the gap to the shortfall only when it is positive, and to the excess, negated, when it is
  not. The reason is written where it is consumed
  (`frontend/src/fintrack/pages/pocket/components/PocketBigBoxResult.tsx:201-209`): **so that an
  over-funded goal cannot cancel one that is behind.**
- **Overview sums flat.** `overview_services/core/makeFinancialGoals.js`, on the `feat/overview`
  worktree, documents that its shortfall is a plain subtraction, that an exceeded goal
  contributes a negative and lowers the total, and that **clamping would report more work
  outstanding than there is.**

**They disagree by construction.** One goal over by 500 and another short by 500: the pocket
board reports 500 still to allocate, Overview reports 0. Same portfolio, same question, two
answers, and Overview is the screen whose whole purpose is to consolidate the other one.

**Why it is not a defect to fix.** Both are right about different questions — *how much to put
in* versus *how much is outstanding net* — which is exactly why it cannot be settled by
measurement and has to be settled by the developer. What is indefensible is only that the two
carry the same name on screen.

**Open, and it belongs to the developer.** Recorded as a row of the blocking table in
`ESTADO_PLANES.md` §10, developed in `OVERVIEW_PLAN/OVERVIEW_DECISIONS.md`, and it is the one
row already marked **in conflict** in the business-rules inventory
(`plan-docs/business-rules/INVENTARIO_REGLAS.md`) — the first thing that inventory was asked
for was to make cases like this visible, and this is the case.
