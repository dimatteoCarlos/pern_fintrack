# Debts Domain Contract

Normative. Written per `DEBTS_AUDIT.md` §12.11: *"write a short normative
`DEBTS_DOMAIN_CONTRACT.md` freezing the seven blocks"*. This document is the
close of the Debts module — the specification any future change to Debts is
audited against. It states what the domain must be; it does not fix the gaps
it finds. Every rule below traces to a ruling recorded in `DEBTS_AUDIT.md`
§12.5–§12.9, cited inline. Anything not yet ruled — only recommended — is
marked **open decision** and excluded from the frozen rules.

Re-verified against the code on 2026-09-14. The audit's own measurement window
was 2026-08-29/30; where work has landed since, this document reports today's
`file:line`, not the audit's.

---

## A — The debtor domain contract

**Rule.** A debtor's position is one status field taking exactly one of
`receivable`, `payable`, `settled`. It replaces `debtor`/`creditor` as the
contract-level vocabulary; `debtor`/`creditor` stay secondary, legacy terms.
The party (name) is a separate concern from the position (balance): a debtor
is the party and their account, a debt is the financial position, and one
party can move between receivable, payable and settled over time without
changing identity. (`DEBTS_AUDIT.md` §12.5, block A: *"A single status taking
`receivable`, `payable` or `settled` cannot express an impossible state at
all"*; *"Primary vocabulary is receivable / payable / settled; debtor and
creditor are secondary."*)

**Never.** Two boolean flags computed independently, which admit the
impossible state of both `0` and both `1`.

### Measured against current code

- **Not implemented as a status field.** `dashboardController.js:247-249`
  still serves `debtors` and `lenders` as two independent aggregate counts
  (`COUNT(... WHERE ${DERIVED_BALANCE}>0)` / `COUNT(... WHERE
  ${DERIVED_BALANCE}<0)`), the same flag shape the audit measured. No `status`
  field is served anywhere in the debtor payload.
- **Board-level inference exists, but is not the contract's status field.**
  `DebtsLayout.tsx:75-82` derives a label — `"you're owed"` / `"you owe"` /
  `"settled"` — from the sign of the aggregate `total_debt_balance`, a single
  netted figure across every debtor, not a per-debtor status.
- **Per-debtor rows still infer direction from the balance sign, with no
  settled case.** `ListOfDebtors.tsx:216` computes `transactionType =
  total_debt_balance < 0 ? 'lender' : 'debtor'` — a zero balance falls into
  `'debtor'` by default, not into a third state. The list's quick filter,
  `FILTER_KEYS` at `ListOfDebtors.tsx:48`, offers only `['all', 'debtor',
  'lender']` — there is no `settled` filter.
- **Party and position are not separated in the read model.** The party
  fields (`debtor_name`, `debtor_lastname`) and the position fields (balance,
  receivable, payable) are still served together as columns of one row; no
  read path serves them as distinct sub-objects.

**Gap.** Block A is not implemented. The board-level "settled" label is a
presentation convenience over the aggregate, not the per-debtor status field
the contract requires.

---

## B — The movement contract

**Rule.** Every debt movement — lending, borrowing, repayment, settlement,
opening — must be defined by five properties: source, destination, sign,
movement type, balance effect. This is required because settled is the
accumulated result of these movements and cannot be defined without them.
(`DEBTS_AUDIT.md` §12.5, block B: *"the audit's largest functional gap...
Lending, borrowing, repayment, settlement and opening each need source,
destination, sign, movement type and balance effect."*)

**What is measured today, and why it is not enough.** Only two
`movement_type_id` values are stored (`8` = account-opening, `4` = debt), and
`transaction_type_id` (`lend`/`borrow`) is a per-leg direction label, redundant
with the sign of `amount` — not an economic type. Nothing stored distinguishes
a new loan from a repayment; the schema records the transfer leg, never the
event. A single row can be part-repayment, part-new-loan when it crosses zero
(`DEBTS_AUDIT.md` §12.6 item 2).

**Ruled 2026-09-14 (this document, on the developer's instruction to close
every open item in this contract).** The audit's own recommendation is
adopted as the frozen derivation rule, rather than a new movement-type
column: *"a movement is classified against the sign of the balance before
it, and a row that crosses zero is split at the crossing"* (`DEBTS_AUDIT.md`
§12.6 item 2). Reason, as the audit gave it: a new column classifies future
rows and leaves the fourteen existing ones unclassifiable, which is worse
than a derivation that is exact for every row already written. **Not yet
implemented** — this closes the specification, not the code. Block G's
activity level (total lent, borrowed, repaid, outstanding) can be built
against this rule once someone picks up that work.

---

## C — The canonical read model

**Rule.** No screen re-interprets the balance. The read model serves account
id, name, balance, receivable, payable, status and currency as one shape;
every screen consumes it as-is. (`DEBTS_AUDIT.md` §12.5, block C: *"His rule:
no screen re-interprets the balance. The read model delivers account id, name,
balance, receivable, payable, status and currency, and React stops
reconstructing them."*)

**Layered above this, not part of it.** §15's presentation rule for amounts —
position vs movement vs aggregate, sign and colour (`DEBTS_AUDIT.md` §15.1) —
governs how the figures this block serves are displayed. It constrains
rendering, not what is served; block C is unaffected by which figures get a
sign or a colour.

### Measured against current code

- **The reconstruction the rule forbids is still present.**
  `DebtorDetail.tsx:78-88` recomputes `total_debt_balance`, `debt_receivable`,
  `debt_payable`, `creditor` and `debtor` from `accountDetail.account_balance`
  in the frontend — the same inversion-prone pattern the audit's finding 7
  named (previously anchored at `DebtorDetail.tsx:60-63`). The comment at
  `DebtorDetail.tsx:63-69` documents the derivation rule by hand instead of
  the server serving it once.
  - Note: the audit ranked finding 7 latent because nothing rendered it; it
    is now confirmed live — `DebtorDetail.tsx:334` renders
    `accountDetail.account_balance` through it.
- **The hand-formatted-amount defect is closed**, separately from block C.
  `SummaryDebtorDetailBox.tsx:61,70` now runs the amount through
  `currencyFormat` (`helpers/functions`) instead of concatenating a currency
  symbol with `Number(amount).toFixed(2)`; the comment at
  `SummaryDebtorDetailBox.tsx:45-50` records the old bug for context. This
  closes the item the audit left "still open" at §12.9, not block C itself.

**Gap.** Block C is not implemented. The server does not serve a canonical
shape with `receivable`/`payable`/`status`; the frontend still derives them.

---

## D — The lifecycle contract

**Rule.** A debtor moves through create → active → settled →
closed-or-deleted, never treated as four independent CRUD verbs. His decisive
clause, quoted exactly:

> **Settled is active with a zero balance. Closed is not part of active debts
> at all.**

(`DEBTS_AUDIT.md` §12.5, block D.) This formulation supersedes the audit's own
earlier framing at §11.4/§10.6 — *"His formulation is the better one and
supersedes the audit's."*

**Filter requirement.** The soft-delete/closed-account filter must be applied
in every read path before the settled classification is implemented, because
an unfiltered count "silently mixes debtors who repaid with debtors the owner
retired." This applies across **five** debtor read paths — headline, list,
detail, statement, tracker dropdown — corrected from six in the audit's own
first count (`DEBTS_AUDIT.md` §12.6 item 1; the sixth item, creation, is a
write path that decides what the reads can ever contain, not a read path
itself).

### Measured against current code — filter status per path

| read path | serves | filtered (`deleted_at`/`closed_at`) today |
| --- | --- | --- |
| headline | `dashboardController.js:244-260` (`TOTAL_BALANCE_AND_GOAL_BY_TYPE.debtor`) | No |
| list (Debts board) | `dashboardController.js:411-424` (`SUMMARY_BALANCE_AND_GOAL_BY_TYPE.debtor`, served at `dashboard/balance/summary/`, consumed by `ListOfDebtors.tsx:65`) | No |
| detail | `getAccountController.js:715-733` (`getAccountById`) | No — 404 only on a missing row (hard delete); a soft-deleted or closed debtor's row still matches |
| statement | `getTransactionsForAccountById.js` | No — zero occurrences of `deleted_at`/`closed_at` |
| tracker dropdown | `getAccountController.js:543-568` (`getAccounts`, route `/allAccounts`) | **Yes** — `LIVE_ACCOUNT` (`getAccountController.js:45`: `AND ua.deleted_at IS NULL AND ua.closed_at IS NULL`) applied at `:562` |

**One of five is filtered as of today.** The `LIVE_ACCOUNT` predicate exists
and is already applied across bank/investment/income/pocket/category/debtor
account-type listings in `getAllAccountsByType` (`getAccountController.js:324,
345, 362, 379, 405, 434`) — but the Debts screen's own list, headline, detail
and statement queries do not use it; they live in `dashboardController.js` and
`getTransactionsForAccountById.js`, outside where `LIVE_ACCOUNT` is defined.

**Gap.** Four of the five debtor read paths do not yet enforce the lifecycle
filter. The statement path — the one the audit flagged as "most likely to
miss, because it is reached through an account id rather than through a debts
screen" — is confirmed still unfiltered.

---

## E — The invariants

**Rule.** Verbatim from `DEBTS_AUDIT.md` §12.5, block E:

```
the stored balance equals the sum of the debtor's own ledger rows
positive is a receivable, negative a payable, zero settled
an opening transaction always exists - a debtor with no ledger history
  is impossible
no orphan transaction
no duplicate debtor name
```

Plus the source-of-truth rule, stated explicitly: **the ledger is the truth;
the stored balance is a derived projection, never the reverse.**

**Mechanism.** Guaranteed through the single balance writer, not recomputed on
every read (`DEBTS_AUDIT.md` §12.5, block E, citing `PLAN_ACCOUNT_DELETION.md`
§7).

### Measured against current code

- **Single writer confirmed.** `setAccountBalanceFromLedger.js:47-60`
  (`backend/src/utils/fintrackUtils/accountManagement/`) is the one function
  that writes `user_accounts.account_balance`, always as
  `${DERIVED_BALANCE}` (the ledger sum), never as a JavaScript-computed
  delta. It is called from `transactionController.js` (every movement),
  `accountCreationController.js` (opening), `accountCategoryCreationcontroller.js`,
  `deleteAccountService.js`, `getClosePreview.js` and
  `overviewPageRepository.js` — every writer of the column funnels through
  one function. This closes the mechanism block E requires.
- **Duplicate-name invariant.** No database constraint exists — re-verified,
  `user_accounts` has no unique index on `(user_id, account_name,
  account_type_id)`. Enforcement is in application code on both write paths:
  `verifyAccountExistence.js:42-46` (create) and
  `accountEditController.js:239-264` (edit, same key, self excluded,
  soft-deleted excluded). Per the audit's own instruction (§12.6 item 4), this
  contract cites rather than restates the rule: see
  `plan-docs/ongoing/PLAN_ACCOUNT_NAME_UNIQUENESS.md` for the constraint's
  design.
- **Opening-transaction invariant** is likewise a convention, not a schema
  constraint: creation always writes it and
  `getTransactionsForAccountById.js:233-235` states it in a comment, but
  nothing in the schema enforces it.

---

## F — Authorization and concurrency

**Rule.** Ownership verified explicitly on every verb — read, create, edit,
movement, delete — never assumed because an endpoint looks protected. Debt
movements share the same ledger concurrency model as account closure: lock,
derive from the ledger, revalidate, write. (`DEBTS_AUDIT.md` §12.5, block F.)

### Measured against current code

- **Reads: covered.** All five debtor read queries carry `WHERE ua.user_id =
  $1` in the SQL itself — `dashboardController.js:386, 610, 736, 761, 808,
  845, 873, 987, 1110`; `getAccountController.js:225, 321, 342, 359, 376,
  402, 431, 451, 559, 725, 816, 834, 864, 881, 895, 908, 1108, 1202`;
  `getTransactionsForAccountById.js:104, 279, 358`.
- **Delete: the admin gate is intentionally suspended, not a bug and not an
  open item.** `deleteAccountService.js:536-541` states it directly: *"Administrative
  privilege suspended for account deletion (Carlos, 2026-09-07): any owner
  may run any deletion type on their own account for now."* The same ruling
  is repeated at the RTA guard (`:1664-1667`) and the standard-delete guard
  (`:1807`). The three `if (isAdmin ...)` conditions are commented out on
  purpose, with the original condition kept in place specifically so the
  restriction is a one-line restore if a future ruling reinstates it. **This
  document does not reopen that decision** — corrected here after an earlier
  draft of this contract mischaracterised it as an unresolved gap. What
  block F's ownership rule means for delete today is: the check that applies
  is *does this row belong to this `userId`*, not *does this role outrank
  another*, and that check is present (`accountCheck` is scoped to the
  caller's `userId` before any of the three sites run).
- **Movement concurrency.** Not re-measured beyond what the audit recorded:
  section 11 measured the delete half of the lock/derive/revalidate/write
  race and not the movement half (`DEBTS_AUDIT.md` §12.5, block F, citing
  §12.6 item 3).

**Gap.** Read-side ownership authorization is closed. Movement concurrency
(the half of block F's lock/derive/revalidate/write rule that section 11 did
not measure) is the only piece still open — not the admin gate, which is
closed by the 2026-09-07 ruling above.

---

## G — The metrics contract

**Rule.** Three levels, kept separate:

| level | figures |
| --- | --- |
| board | total receivable, total payable, net position, active debtors, counts of receivables, payables and settled |
| detail | current balance, original principal, direction, status, opening date |
| activity | total lent, total borrowed, total repaid, outstanding |

(`DEBTS_AUDIT.md` §12.5, block G.)

**Gating, not independence.** The activity level is **not derivable from
stored data today** without block B's zero-crossing rule. That rule is now
frozen (block B, above); the activity level can be implemented against it
whenever someone picks up that work — it is no longer blocked on a decision,
only on the implementation.

**Net position naming.** The sum of the two live debtors' balances (`-8.91`,
measured 2026-08-30) is a **net debt position**, not a "total debt." It is
served as `total_debt_balance` (`dashboardController.js:245` today, previously
anchored `:217`). The contract renames the concept — net debt position — even
though the wire field keeps the name `total_debt_balance` for compatibility
(`DEBTS_AUDIT.md` §12.5, block G, closing paragraph).

**K6 — `debtors_without_debt`.** Still computed, still never rendered.
`dashboardController.js:249` computes the alias `debtors_without_Debt`
(`COUNT(*) FILTER (WHERE ${DERIVED_BALANCE}=0)`); `DebtsLayout.tsx:41,56` pulls
the field into the component's data shape but never includes it in
`bigScreenInfo` (`DebtsLayout.tsx:70-102`), so it reaches the frontend and
stops there. This is the one item the audit's absorbed §16.1 block still has
open, and it is small: a display of a figure the server already returns.

---

## The designated counterparty — resolved 2026-09-14

Two decisions the audit measured and left open at §12.7, both closed here on
the developer's instruction to resolve every open item in this contract, and
both adopting the audit's own single recommendation.

**`debtor_accounts.selected_account_id` is an operating preference, mutable —
not a historical record.** Nothing consumes it today: it is read by the
tracker dropdown's projection (`getAccountController.js:382`) and by the
detail query's `da.*`, and written by no path after creation. The historical
fact it might have recorded is already durable elsewhere — the opening
transaction's `source_account_id` — so a second, immutable copy of the same
fact only adds a way for the two to disagree. Ruling: the column names the
default account for the debtor's *next* movement, and an editor may change
it without touching history. (`DEBTS_AUDIT.md` §12.7.)

**`debtor_accounts.selected_account_name` is scrubbed when the account it
names is deleted, and kept otherwise.** It is presentation data while its
subject exists and becomes a re-identifying string the moment the subject is
erased — the audit measured it surviving deletion today, dangling with no FK
in a `createTables.js`-built database. Ruling: the hard-delete erasure tail
must null this column (and any FK-less counterpart) for every
`debtor_accounts` row whose `selected_account_id` pointed at the
account being erased, so the hard-delete model can claim no identifiable
reference to a deleted account survives. (`DEBTS_AUDIT.md` §12.7.)
**Not yet implemented** — this closes the specification; the erasure tail
(`deleteAccountService.js`) does not yet scrub it.

---

## Open work — decisions closed, implementation pending

Nothing below is an open decision. Everything here is real work this
contract now requires, closed as rulings above or already frozen in blocks
A-G, and not yet done in code.

1. **Block D's read-path filter.** Four of five debtor read paths (headline,
   list, detail, statement) do not yet apply the lifecycle filter (`LIVE_ACCOUNT`
   or its equivalent). 12.9's phase order places this in phase 3 (integrity),
   ahead of the domain-contract phase this document closes.
2. **Block B/G's zero-crossing derivation.** Frozen as the rule above; no
   code implements it yet, because nothing in the product surfaces the
   activity level (total lent/borrowed/repaid/outstanding) today.
3. **The counterparty-name scrub.** Frozen above; the hard-delete erasure
   tail does not yet null `selected_account_name` for a deleted counterparty.
4. **Block A's status field and block C's canonical read model — declined
   2026-09-14, not deferred.** Implementing the `status` field surfaces a
   rendering question the contract does not answer: what a settled debtor
   (`ListOfDebtors.tsx:216`'s zero-balance case, today falling silently into
   the `'debtor'` bucket) shows instead of the debtor/lender label. That
   rendering is undesigned — no mockup, no copy, no badge exists for it — so
   building the field without it would leave the UI change half-finished.
   Ruling on developer instruction: leave `ListOfDebtors.tsx`,
   `DebtorDetail.tsx` and the read paths exactly as they measure today. The
   server serves no `status` field; `DebtorDetail.tsx:78-88` keeps
   re-deriving receivable/payable from the balance sign. Blocks A and C stay
   frozen as specification only, with no implementation planned until a
   settled-state design exists.

**What is genuinely closed, decision and code both:** block E's invariants
(single balance writer confirmed), and block F's authorization model for
delete (the 2026-09-07 ruling above, already in code and not reopened here).
