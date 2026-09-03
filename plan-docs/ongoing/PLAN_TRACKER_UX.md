# PLAN_TRACKER_UX — the tracker form, measured

> **Activated 2026-08-29 — moved from `on-hold/PLAN_UX_SCREENS/` to `ongoing/`.**
> Its trigger was *the budget module closes*, and it closed: `feat/budget` is 0 ahead
> and 7 behind `main`. Three things were corrected on the way in, all against the
> code rather than against the document:
>
> - **R66 is fixed** and this file described it as live in two sections. See §4.1,
>   including the `fix(tracker)` commit that no longer exists.
> - **T8's five questions are decided** (§9.8). Q10, Q11 and Q12 stood; **Q8 and Q9
>   rested on a premise the screen does not have** and were reformulated before being
>   answered.
> - **Commit 1 of T8 is larger than the old table said** (§9.7): replacing the source
>   means rebuilding the failure path, because today a failed category fetch replaces
>   the whole screen rather than degrading one control.
>
> **T8 (§9) is executable now.** T1–T7 are not: their layout questions Q1–Q7 are
> still open, and §9.7 records why T8 does not wait for them.

> **Re-measured 2026-08-30 — four of the eight findings had moved and this file
> still described all eight as open.** What is actually left is T1, T2 and T3.
>
> | finding | state, measured |
> |---|---|
> | **T4** | **Located and closed, and it was not where §7 sent the search.** The card had a `bottom` declared beside its `top`, which stops being a position and becomes an imposed height — the card spanned the whole gap however short its content was. The `bottom` is gone and a `max-height` under `max-height: 701px` bounds it instead (`tracker-style.css:617-626`, and the comment there states the reason). **§7 no longer has a first task** |
> | **T6** | **Down to one line.** The stylesheet now consumes `--radius-xl`, `--space-4`, `--layout-content-width` and `--header-total-height`. What survives of the finding is `background-color: white` at `:133`, still overwritten by the `background: url()` on the next line. Q5 defers the rest and that still holds. **Corrected 2026-08-30: two lines, not one.** `background-color: #252525` is still written raw at `tracker-style.css:61` — it is the only remaining hex literal in the file (136 `var(--…)` reads against one `#`), and the header of `.trackerNavbar__container` around it is already fully tokenised, which is what makes the survivor conspicuous |
> | **T7** | **Closed.** All five movement screens carry the date control and send `transactionActualDate` |
> | **T8** | **Closed, both commits.** `Expense.tsx` reads `useBudgetStatusStore`, formats through `currencyFormat`, applies `isUnbudgeted`, and separates option identity from option status; `Transfer.tsx` joins the status rows in only on the `category_budget` branch |
>
> **The seam §9.4 left never opens.** It said `budgetMonth` becomes the month of the
> date in the picker once back-dating ships. Back-dating shipped, and its window is the
> current month — the floor is the first day of it — so the month of the picker and the
> month the server resolves from an omitted `month` are the same month, always. The
> constant `undefined` on both screens is correct, not provisional, and stays until the
> back-dating window itself widens. The comments above both declarations say otherwise
> and are the stale half.
>
> **T1, T2 and T3 closed 2026-08-30.** Six commits, and the recommendations of Q1, Q2,
> Q3 and Q4 were implemented as this file already wrote them.
>
> | commit | screen |
> |---|---|
> | `035661b` | the dropdown title read "Subategory" — T3, alone, as §6 requires |
> | `a8d9457` | Expense: the action moves to the foot of the card and the form declares onSubmit |
> | `e82c99b` | Income |
> | `878915a` | Transfer |
> | `4623c78` | Debts |
> | `fc77d8d` | Profit & Loss |
>
> **The shared note component was not edited, and that was the point.** Q7 sequences one
> screen per commit, so changing `CardNoteSave` would have changed all five at once.
> Each screen now composes `CardNote` itself and ends with `FormSubmitBtn`.
> **`CardNoteSave` has no caller left, and neither does `FormPlusBtn` beneath it.**
> Neither is deleted yet: the on-screen pass §8 requires has not run, and that pass is
> the check that would justify the deletion.
>
> **The button takes the surface, not a colour.** `.submit__btn` paints itself
> `--creme` and the tracker card is cream, so the action would have vanished into it.
> `.submit__btn--light` names the surface it sits on and is written on
> `--color-surface-app` and `--color-content-on-dark`, both of which already existed —
> no token was invented, and the block above it was left alone, which is Q5.
>
> **What is open: the responsive pass.** T5's drift is now smaller — the five screens
> end the same way — but §8 asks for 360, 400 and 768px on all five and a typecheck is
> not that pass. T6 is down to the one dead `background-color: white`, deferred by Q5.

**Opened 2026-08-17**, on the developer's instruction, from a screenshot of the
Expense form at 400x667 marking the empty area under `Note`.

**Trigger: the budget module closes.** This document is a register of what was
measured, not a queue jump. Nothing here is written before B closes (D7).

`plan-docs/ongoing/` is re-included by `.gitignore:123`: this file is versioned.

---

## 1. What the screenshot shows

At 400x667, the Expense form's cream card runs from under the movement navbar to
just above the bottom navbar, and **roughly its lower 40% is empty**. The fields
end at `Note`; below that there is nothing until the card's bottom edge.

The developer's reading is that the view needs improving. The measurement below
says the empty area is a symptom, and names what produces it.

## 2. What was measured, 2026-08-17

| # | finding | evidence |
|---|---|---|
| **T1** | ~~**The form's primary action is disguised as a note affordance.**~~ **CLOSED 2026-08-30.** The `+` button beside `Note` was the submit, through `CardNoteSave`. Each screen now composes `CardNote` itself and ends with `FormSubmitBtn` — `Income.tsx:512-517`, `Transfer.tsx:846-855`, `Debts.tsx:714-719`, `PnL.tsx:669-671`, and the same in `Expense.tsx` | measured at `Expense.tsx:700-712` on 2026-08-17 |
| **T2** | ~~**The `<form>` has no `onSubmit`.**~~ **CLOSED 2026-08-30.** All five declare it: `Expense.tsx:827`, `Income.tsx:456`, `Transfer.tsx:750`, `Debts.tsx:647`, `PnL.tsx:601`, each `onSubmit={onSaveHandler}` | measured at `Expense.tsx:655` on 2026-08-17 |
| **T3** | ~~**A typo renders on screen.** The category dropdown's title is `'Category / Subategory'`~~ **CLOSED by `035661b`.** `Expense.tsx:343` reads `'Category / Subcategory'` | measured at `Expense.tsx:221` on 2026-08-17 |
| **T4** | **The empty area has no declared source yet.** `.cards__presentation--tracker` sets `position: absolute` and `top`, and declares **no `height` and no `bottom`**; `.cards__presentation` declares none either. So the card's height is its content's, and what makes the content that tall is **not yet located** | `tracker-style.css:128-158`; `generalStyles.css:236-242` |
| **T5** | **Five sibling screens, already not uniform.** Expense, Income, Transfer, Debts and PnL share the layout, but Transfer carries its own `max-width: 470px` block with three hardcoded heights on one chip row (`height`, `min-height`, `max-height`, all `0.95rem`) | `tracker/{expense,income,transfer,debts,profitNloss}`; `tracker-style.css:460-478` *(re-read 2026-08-30; it said `:328-362`. The `.transfer .radio-input__options--chip` rule with the three `0.95rem` declarations is at `:468-471`, still live)* |
| **T6** | **The stylesheet consumes no tokens.** `#252525` written raw, `background-color: white` immediately overwritten by a `background: url(...)` on the next line, and the legacy `--creme` / `--dark` family rather than `tokens.css` | `tracker-style.css:61`, `:133-134` *(re-read 2026-08-30; the raw hex is at `:61`, not `:62`. Most of this finding is closed — see the header block. What survives is the dead `background-color: white` at `:133`)* |
| **T7** | **The form cannot state when the movement happened.** There is no date control on any of the five screens, so every movement is stamped with the instant it was typed. A purchase entered on Monday for Saturday lands on Monday, in the month the reader is looking at | §4 |
| **T8** | **The budget category dropdown shows a lifetime figure where a monthly one is needed.** The amount in parentheses beside a `category_budget` account is `user_accounts.account_balance` — everything that category has ever consumed since it opened, not this month's spend against this month's budget | §9 |

## 3. Why T1 is the finding and the empty area is not

The space under `Note` reads as broken because **the thing that belongs there is
missing, not because the space is unused.** Every form of this shape ends with
its commit action at the bottom, full width, labelled with the verb it performs.
This one ends with a text field, and hides the verb in a 40px glyph two rows up,
where it competes with the note it sits beside.

That also explains a second thing the screenshot shows: nothing on the card says
what pressing it will do. `Expense`, `Income`, `Transfer`, `Debts` and `PnL` are
tabs in the dark navbar above the card, so the movement being recorded is stated
outside the form and never inside it.

So the improvement is not "fill the space". It is **move the action to where an
action goes, and let the card end where its content ends.**

## 4. The actual transaction date — owned elsewhere, and its guard is fixed

The tracker records *when you typed it*, never *when it happened*. That is
tolerable for a movement entered the same day and wrong for everything else, and
it is wrong in a way the budget module makes visible: a movement belongs to the
month its date falls in, so a late entry moves spend from one budget month to the
next.

> **This section has an owner as of 2026-08-24: `ongoing/PLAN_BACKDATING/`.**
> R66, the four questions D1–D4, and the datepicker on all five screens moved into
> that block, which is frozen and executable. **Do not implement the date control
> from this file.** What stays here is the rest of the tracker's UI/UX: T1 the
> disguised submit, T2 the form with no `onSubmit`, T3 the typo, T5 the five screens
> already not uniform, T6 the stylesheet on no tokens, and **T8 in section 9**.

### 4.1 R66 is CLOSED — verified in code 2026-08-29

**The guard this section described no longer exists.** Commit `6adc8de
feat(tracker): validate the movement date` — the back-dating block's commit 2 —
replaced it. `transactionController.js` now destructures
`transactionActualDate` alone; **the separate `date` variable is not destructured
anywhere in that controller**, so the OR chain that discarded a supplied date is
gone along with its duplicated term and its unreachable `?? date`.

What landed in its place validates in the order the back-dating plan specified:
calendar-day format, an upper bound of today **in the owner's zone**, a lower
bound at the later of the two accounts' opening days compared **as calendar days
and never as instants**, and the instant composed once in SQL at 12:00 in that
zone and reused by both legs, so the two halves of one entry cannot land in
different months.

**Two consequences to carry, so neither is re-read as pending:**

- The `fix(tracker)` commit that `on-hold/PLAN_UX_SCREENS/PLAN_DEBTS.md` §11.3
  reserved for R66 **no longer exists**. That plan's live items drop to one: the
  count of debtors whose balance is zero, computed on the server and rendered
  nowhere.
- ~~R66 is no longer what blocks the datepicker. **What blocks it now is commit 8**,
  the rate resolver — a past date the guard already accepts has no historical rate
  until it exists, and the window stays shut only because no frontend file sends
  the field. Measured again 2026-08-29: zero occurrences of
  `transactionActualDate` in `frontend/src`.~~

  > **Corrected 2026-08-30 — both halves of that bullet are false now.**
  >
  > **What it asserted.** That the historical rate resolver did not exist, and
  > that no frontend file sent `transactionActualDate`.
  >
  > **What the code says.** The resolver exists and is wired:
  > `resolveHistoricalRate(currencyCode, requestedDate, options)` is exported at
  > `fx_services/core/historicalRateResolver.js:171`;
  > `currencyAmountConversion(amount, from, to, asOfDate = null, …)` takes it as
  > its fourth parameter (`conversion/currencyAmountConversion.js:73-77`), imports
  > the resolver at `:30` and calls it at `:132`; migration
  > `021_create_daily_exchange_rates.sql` and `db/dailyRateDBaccess.js` are in the
  > tree. And `transactionController.js` computes `asOfDay` above the conversion
  > and passes it as that fourth argument. **All five movement screens now send
  > the field** — `Expense.tsx:540`, `Income.tsx:373`, `Transfer.tsx:644`,
  > `Debts.tsx:461` and `PnL.tsx:460` — which is what the header block records as
  > T7 closed. Nothing here is blocked on the resolver any more.

### 4.2 The four questions D1–D4 are settled

All four were answered inside `ongoing/PLAN_BACKDATING/` and are recorded there,
not here. Restated in one line each so this file does not read as if they were
open: the client sends a calendar day and the server composes the instant (D1);
the upper bound is today in the owner's zone (D2); the lower bound is the later of
the two accounts' opening days (D3); and inserting into the past is a write-path
question, which is why the stored running balance is being replaced by a derived
one rather than patched (D4).

## 5. Open questions

Each carries a recommendation. ~~None is decided; the developer decides.~~

> **Corrected 2026-08-30 — that sentence is a statement about the state of the
> work and it is stale.** Q1, Q2, Q3 and Q4 were implemented **as recommended**
> on 2026-08-30, in the six commits the header block lists, and the code carries
> them: the action is a full-width `FormSubmitBtn` at the foot of the card on all
> five screens (`Expense.tsx`, `Income.tsx:512-517`, `Transfer.tsx:846-855`,
> `Debts.tsx:714-719`, `PnL.tsx:669-671`), the `+` beside `Note` is gone with its
> `CardNoteSave` wrapper, and each `<form>` declares `onSubmit={onSaveHandler}`
> (`Expense.tsx:827`, `Income.tsx:456`, `Transfer.tsx:750`, `Debts.tsx:647`,
> `PnL.tsx:601`). Q7 is settled below. **What is still undecided is Q5 and Q6**,
> and the recommendations attached to those two stand. The rows are left in place
> so the reasoning that produced each answer stays beside it.

| # | question | recommendation |
|---|---|---|
| **Q1** | Does the submit move to the bottom of the card as a full-width labelled button, or does the card shrink to its content and keep the `+`? | **Move it.** Shrinking the card removes the empty area and leaves the action still disguised — it treats the symptom named in §3 |
| **Q2** | If the submit moves, does the `+` beside `Note` disappear or become a real "add note" control? | **Disappear.** Two commit paths on one form is how the two get out of step. The note is already a plain field |
| **Q3** | One layout for the five screens, or per movement? | **One.** T5 shows the drift has already started, and a second layout doubles every later decision |
| **Q4** | Does the card state which movement it is recording, or does the navbar above it remain the only place? | **State it.** The navbar is a tab strip; a form that submits money should name what it submits |
| **Q5** | Does this block adopt `tokens.css` (T6) or stay on the legacy `--creme` / `--dark` family? | **Defer.** It is the same job as `PLAN_AUTH_STYLES.md` and it is bigger than this view. Record it, do not bundle it |
| **Q6** | The date control's whole presentation contract — see below | one answer, four parts |
| ~~**Q7**~~ | ~~all five screens at once, or Expense first?~~ | **SETTLED 2026-08-30 — not a recommendation, a sequencing rule.** See below |

**Q7 is closed, and the old recommendation here was wrong.** It read *"all five at once"*,
arguing from the five screens having already drifted apart. That argument asks for one
**design**, not one **commit**, and the two are not the same thing: five screens in one
commit is a change nobody can review. The rule, settled by the developer:

> **The five screens converge on one design, and the implementation lands one screen at a
> time, beginning with Expense.** Expense decides the control; each later screen extends the
> decision rather than reopening it, unless implementing Expense surfaces a technical reason
> to change it.

This matches the retroactive-dating block, which sequences the screens as one commit each,
and it is the order the developer instructed directly. **The five are Expense, Income,
Transfer, Debts and Profit & Loss** — the tracker's movement screens; pockets and investments
are not among them.

**Q6 is one contract with four parts, and they are answered together or not at all.** They
were split across two questions and the second answer would have reopened the first:

| part | question |
|---|---|
| initial state | collapsed, or a field like the others? |
| label | a visible label, or identified inside the control? |
| expansion | what opens it, and what that costs on a 360px screen |
| initial value | today, and whether that reads as chosen or as a default |

**Recommendation, unchanged in substance: default to today and stay collapsed.** Most entries
are same-day, and a field that must be filled on every movement taxes the common case to
serve the rare one. The retroactive-dating block has already decided the label half — the
field is identified inside the picker's own control, with no separate label — so what is
genuinely open is the expansion behaviour and whether today reads as a choice or a default.

## 6. What this plan refuses to do

| refused | reason |
|---|---|
| Fix T3 on the way past | It is one word, and it is still a change to a frozen working screen. It goes in a commit that says so |
| Rewrite the five screens' CSS onto tokens | Q5. That is `PLAN_AUTH_STYLES.md`'s job repeated on another module, with its own gates |
| Touch `CardNote.tsx`'s hardcoded `90` | It belongs to the **J1** constants change, already sequenced inside the budget module |
| Start before budget closes | D7. This file exists so the measurement is not lost, not so the work starts |

## 7. First task when this opens

~~Two, and they are independent — one is layout, one is the write path.~~
**Neither remains. Corrected 2026-08-30.**

1. ~~**Locate T4.** Until the card's height has a named source, any layout change
   is written against a guess. Find the rule that makes the card taller than its
   fields, then propose the layout.~~ **Located and closed.** The header block of
   this file already recorded it and this section still asked for it. The card
   declared a `bottom` beside its `top`, which imposes a height rather than a
   position; the `bottom` is gone and a `max-height` inside the
   `@media (max-height: 701px)` block bounds it instead —
   `tracker-style.css:622-635`, prefaced by the comment at `:620-621`, and the
   reason for dropping the `bottom` written at `:638-640`. *(The header block of
   this file gives `:617-626`; the rule has since moved.)*
2. ~~**Answer D4.**~~ **Nothing.** This second task no longer exists, and §4.1 and §4.2
   of this same file already say why — the guard defect is closed in commit `6adc8de`,
   and the question of whether a back-dated movement re-strikes the running balances is
   settled: it does not, because the stored running balance is being replaced by a
   derived one rather than patched. **The write-path half of this file has no remaining
   task**; what opens the date control now is the rate resolver, in the
   retroactive-dating block. The only first task here is locating the card's height.

## 8. Verification

No test runner exists (F-15). From `frontend/`,
`NODE_OPTIONS=--max-old-space-size=4096 npx tsc -p tsconfig.app.json --noEmit`
must exit 0, plus an on-screen pass at 360, 400 and 768px on **all five**
movement screens — T5 is the reason the pass is not one screen.

---

## 9. T8 — the category dropdown reports the wrong window

**Measured 2026-08-24**, from the developer's reading of the Expense form.

> **This whole section is a closed specification. Corrected 2026-08-30 for line
> anchors only; nothing in it is still pending.** The header block records both
> commits as landed, and the code confirms it:
>
> - `Expense.tsx` no longer fetches `account/type?type=category_budget`. It reads
>   `useBudgetStatusStore` (`:244-259`), applies `isUnbudgeted` at `:295`, and
>   builds the label from `actualSpent` and `budgetAmount` through
>   `currencyFormat` at `:303-312`. The dropdown title is `'Category /
>   Subcategory'` at `:343`.
> - `Transfer.tsx` joins the status rows in only on the `category_budget` branch,
>   with the store read at `:223-227`, `isUnbudgeted` at `:268` and the two
>   `currencyFormat` calls at `:275-276`. The generic fetch that serves bank,
>   pocket and investment stays.
>
> **Every line number given below is from 2026-08-24 and has moved.** The ones
> that matter are re-stated above; the rest — `Expense.tsx:213`, `:221`,
> `:191-197`, `:205-218`, `:622`, `:643`, and `Transfer.tsx:303`, `:268-270`,
> `:106` — are historical and are not re-anchored, because no work remains that
> would need them. Two of the section's own supporting anchors are still exact
> and were re-verified: `isUnbudgeted` at `helpers/budgetStatus.ts:74`, and the
> store's `onTransactionRecorded` invalidation at `useBudgetStatusStore.ts:148`.
> `CATEGORY_OPTIONS_DEFAULT` is at `helpers/constants.ts:89`, not `:91-95`.
>
> **One thing shipped that this section does not describe**, recorded so it is not
> read as missing: the movement screens now filter their account lists by the day
> in the picker, so an account not yet open on the chosen date is not offered —
> `isOpenOnChosenDay` from `hooks/useTransactionDate.ts`, used at
> `Expense.tsx:189` and `:286`, `Debts.tsx:187` and `:235`, and in `PnL.tsx`
> (`e97f22f`, *fix(tracker): filter the P&L account list by date*).

### 9.1 What is on screen and where it comes from

`Expense.tsx:213` builds the option label as
`` `${cat.account_name} (${cat.currency_code} ${cat.account_balance})` ``. That
`account_balance` is `ua.account_balance`, selected at
`getAccountController.js:282` and served by `GET /account/type?type=category_budget`.

It is **a lifetime accumulator**: every expense ever charged to that category since
the account opened. It answers *how much has this category ever consumed*, while
the reader filling the form is asking *how much of this month's budget is left*.

**Two screens show it, not one.** `Transfer.tsx:303` builds the same label from the
same endpoint whenever the destination type is `category_budget` — the `Rev.Expense`
option at `Transfer.tsx:106`. Any correction covers both.

The nine other sites rendering this label shape — `Transfer.tsx:221` and `:243`,
`PnL.tsx:201`, `Income.tsx:165` and `:201`, `Expense.tsx:177`, `Debts.tsx:179` and
`:226`, `NewProfile.tsx:167` — are bank, investment and debtor accounts, **where a
running balance is the correct figure**. They are out of scope.

### 9.2 The right figure needs no backend work

`POST /budget/accounts/status` already returns, per account, `accountName`,
`currency`, `budgetAmount`, `actualSpent`, `remainingBudget` and `isOverBudget`
(`makeBudgetAccountStatus.js:46-72`), resolved on the owner's calendar,
ownership-checked, for the current month by default and for a past month through an
optional `month`.

**It replaces the `account/type` fetch rather than joining it** — it carries the
name and the currency too, so the screen keeps its single request.

Two things this must not become:

- **Do not re-derive month spend inside `getAccountController.js`.** That would put a
  second implementation of the month-window arithmetic beside the budget module's,
  which that module's own code refuses at `budgetTransactionRepository.js:88-89`.
- **Do not read `cba.budget`**, which the current dropdown payload already carries and
  discards. It is the column superseded by `budget_monthly_allocations`, named legacy
  by migrations `010:54` and `012:17`.

### 9.3 The store already exists, and already handles the datepicker

`useBudgetStatusStore.ts` holds this payload for the whole budget module, and three
of its properties resolve the back-dating coupling before it is written:

- It **keys the cache by month** (`loadedMonth` / `requestedMonth`, `:56`), so the
  month chosen in the picker is already a first-class key.
- It **invalidates on `onTransactionRecorded`** (`:148`), so the label restates itself
  after the movement is saved.
- It **discards a superseded month's answer on arrival** (`:99`), which is exactly
  what happens when the picker moves while a request is in flight.

**One usage rule: the current month travels omitted, never spelled out.** The endpoint
accepts only a past month, and the store treats `'current'` as a key distinct from the
current month written out. Compare against `store.currentMonth` and pass `undefined`
when they match.

### 9.4 The month follows the picker, not the clock (decided 2026-08-24)

Once the datepicker of `ongoing/PLAN_BACKDATING/` ships, **the month the label reports
is the month of the date in the picker.** A movement dated May shown against August's
spend is decoration, and after saving a back-dated expense a clock-bound label would
not move at all — correct, and indistinguishable from a bug.

The bounds already agree, so no error path is added: the no-future-dates rule of the
back-dating block and the status endpoint's `422` on a month later than the current
one are the same rule.

**T8 requires no back-dating mechanism of its own — which is not the same as saying
the two do not interact.** Corrected 2026-08-29, because the earlier wording
("nothing in the back-dating block changes because of this") was too absolute and
would have been read as *no interaction at all*. There is one, and it is functional:

```
date picker → budgetMonth → budget status request
```

What does **not** change is the accounting logic. Budget spend is a `SUM` over a
`transaction_actual_date` window (`budgetTransactionRepository.js:346-363`), so a
back-dated expense restates its month by itself, with no cache to invalidate and no
new endpoint. The interaction is entirely in **which month the label asks about**;
the arithmetic behind the answer is untouched.

**Sequencing:** bind the label to a `budgetMonth` variable now, equal to the current
month today. The datepicker later changes one line instead of the memo. That seam is
what makes T8 safe to run before block D rather than after it.

### 9.5 The zero-budget reading — decided by the developer, 2026-08-24

**The label always shows `spent / budget`, including when the budget is 0.** A budget
of zero is what the module resolves when no allocation is in force, and it is a real
figure rather than a missing one, so it does not fall under the rule that a missing
figure renders as a dash.

**One case is excluded, and the codebase already decided it.** `isUnbudgeted`
(`budgetStatus.ts:74-77`) separates two readings that "budget is 0" merges:

| budget | spent | reading | label |
|---|---|---|---|
| 0 | > 0 | real spending against no allocation | `usd 120.00 / 0` |
| 0 | 0 | not a budget met — no budget at all | the account name alone |

The second row is not a new exception: the four budget screens already print no word
and no square there, and a tracker that printed `usd 0 / 0` would contradict them
about the same account on the same day.

`executionPercentage` is served as `null` whenever the budget is 0
(`makeBudgetAccountStatus.js:71`), so no share, bar or percentage can be drawn on
either row — the label carries the two amounts and nothing derived from their ratio.

### 9.6 The formatting half, and why the backend does not do it

`Expense.tsx:213` **interpolates the number**: `${cat.account_balance}` inside a
template literal calls `toString()` on it. No thousands separator, and as many
decimals as the value happens to carry — `1234567.5`, `1234.56` and `890` in three
consecutive rows of the same column.

**Half of this is already fixed by 9.2.** The status endpoint's figures pass through
`toAmount` (`makeBudgetAccountStatus.js:60-68`), which rounds to two decimals at
`ROUND_HALF_UP`. The endpoint being replaced does not: `getAccountController.js:282`
casts to `FLOAT` and never touches `money.js`.

**The other half cannot be fixed on the server, and this is the part that is not
obvious.** `toAmount` returns a **number**, and a number carries no scale: `250.50`
rounded to two decimals *is* `250.5` in JavaScript, and that is what the JSON holds.
The trailing zero is not lost by oversight — it does not exist in the type. That is
why `money.js` keeps a separate `toAmountString` (`:145-156`) whose comment reads
*"The CSV needs 250.50 where toAmount gives 250.5"*.

So scale only travels as a string, and the API deliberately does not send one:

- **The frontend computes with these figures, it does not only print them.**
  `budgetStatusLevel` compares against the threshold, `budgetRemainWord` reads the
  sign of `remainingBudget`, callers print `Math.abs`, the bar divides. A formatted
  string forces every consumer to parse it back, and parsing `$1,234.56` is
  locale-dependent and lossy.
- **Locale is a fact about the client.** `currencyFormat` takes `countryFormat`
  (`functions.ts:19-23`) because the separator, the symbol's position and the negative
  convention differ between `en-US` and `es-CO`. Formatting server-side freezes
  `en-US` into the contract for every future client.

The CSV is the exception that proves the rule: there the backend **is** the final
renderer, nothing downstream computes, and that is why `toAmountString` lives in
`money.js` rather than in the exporter.

**The division stands: the backend guarantees exactness, the frontend decides
appearance.** Both halves already exist; the dropdown label is simply skipping the
second. One consequence at the call site: `currencyFormat` emits the symbol itself, so
the loose `cat.currency_code` in front of it goes — `usd $1,234.56` says the currency
twice.

### 9.7 Order of work

**T8 is a reading correction, independent of T1-T7.** It touches the option label and
its data source, not the form's layout or its submit, so it does not wait for the
layout question of §3. It is also independent of `ongoing/PLAN_BACKDATING/`: §9.4 ties
the label to a `budgetMonth` that today evaluates to the current month.

| # | commit | scope |
|---|---|---|
| 1 | `fix(tracker): show the month budget on categories` | `Expense.tsx` — the fetch is **replaced**, and the screen's failure path is rebuilt with it (§9.8, Q9) |
| 2 | `fix(tracker): show the month budget on transfers` | `Transfer.tsx` — the fetch is **enriched**, not replaced |

**Commit 1 is larger than "swap the source", and the reason is measured.** Today a
failure of the category fetch does not degrade the dropdown — it replaces the whole
screen. `fetchedErrorCategoryBudgetAccounts` is wired into two top-level
`MessageToUser` blocks (`Expense.tsx:622`, `:643`), and the memo at `:205-218`
returns `CATEGORY_OPTIONS_DEFAULT`, which is an **empty array**: its three sample
rows are commented out at `helpers/constants.ts:91-95`. So the current failure mode
is *no options and no form*. Replacing the source without rebuilding that path would
carry the same behaviour onto a request that now also carries the figures, making a
budget-service outage take down expense entry. **The failure state belongs to the
commit that changes the source**, because it is the same decision.

**The backend needs no change — verified 2026-08-29.**
`POST /api/fintrack/budget/accounts/status` already accepts `{ accountIds?, month? }`,
checks ownership on **every** element rather than the first, resolves the zone once
per request, and returns `accountName`, `categoryName`, `subcategory`, `nature`,
`currency`, `budgetAmount`, `nextMonthBudget`, `actualSpent`, `remainingBudget`,
`executionPercentage` and `isOverBudget`. **An omitted `accountIds` asks for the whole
owned set**, so Expense does not need a prior call to learn the ids. There is no
contract to freeze before this starts.

**The two screens are not the same change**, which is why they are not one commit
beyond the one-component-per-commit rule:

- **`Expense` replaces.** Its fetch at `:191-197` asks for `category_budget` and
  nothing else, and the status payload carries `accountName` and `currency` too, so
  the whole `useFetch` goes and the memo at `:205-218` reads the store. The screen
  keeps its single request. `isLoadingCategoryBudgetAccounts` and
  `fetchedErrorCategoryBudgetAccounts` map onto the store's `isLoading` and `error`.
- **`Transfer` enriches.** Its fetch at `:268-270` is generic — the URL is built from
  `destinationAccTypeDb`, so the same call serves bank, pocket and investment, where
  the running balance is the right figure. It stays. The status rows are joined in by
  `account_id` **only** when `formData.destinationAccountType === 'category_budget'`,
  and the store is only asked for at all in that branch.

Both commits, in order:

1. Read `budgetMonth` — a local constant today, `undefined` on the wire, so the server
   resolves the current month on the owner's calendar (§9.3).
2. Subscribe to `useBudgetStatusStore` and call `fetchStatus(budgetMonth)`. The store's
   own guard makes a second screen's call free.
3. Build the label from `actualSpent` and `budgetAmount`, both through
   `currencyFormat`, dropping the loose `currency_code` (§9.6).
4. Pass the row through `isUnbudgeted` first: both figures at zero renders the account
   name alone (§9.5).
5. Keep the three fetch states distinct — the option list must not render `0` or a
   half-loaded figure while the request is on the wire.

### 9.8 Decisions — all six closed 2026-08-29

Q8–Q12 were open questions with recommendations. Measurement closed three outright and
showed that two rested on a false premise, so those two were reformulated before
being answered rather than picked from options that did not exist.

| # | decision |
|---|---|
| **Q8** | **Skeleton on first load; keep the labels and drop the figures while a month refreshes.** Never a stale number |
| **Q9** | **No legacy fallback. The status endpoint is the only source, and a failure is an explicit error with a real retry** |
| **Q10** | **Spend against budget only** |
| **Q11** | **Only `category_budget`** |
| **Q12** | **No. Tracker only, and inside it only the two category selectors** |
| **Q13** | **The two amounts live in the option label. The status line carries only the three fetch states and the retry, and never repeats a figure** |

#### Q12 — closed by measurement, not by decision

The full sweep found **ten sites** rendering this label shape, and only two are
category accounts: `Expense.tsx:213` and `Transfer.tsx:303`. The other eight are
bank, investment and debtor, **where a running balance is the correct figure**.
`editionAndDeletion/` renders no such label at all — the six files there that
mention `category_budget` do so for the editor's field configuration.

**So this is not an abstraction of the shared selector.** It is a tracker concern,
and inside the tracker a `category_budget` concern. Generalising it would push a
budget-month reading onto eight controls where the lifetime balance is right.

#### Q8 — the reformulation, and the distinction that drives it

The question assumed one loading state. **With the datepicker of
`ongoing/PLAN_BACKDATING/`, the month changes while the form is being filled**, so a
status request stops being a once-per-mount event and becomes a per-interaction one.
That splits the question in two, and the two have different answers:

| moment | what the dropdown shows |
|---|---|
| **first load** | a skeleton, or the control disabled. **Not "names without figures" — there are no names yet**, because the status payload is now what carries them |
| **month change, with a previous month in the store** | the existing option labels, **with the figures removed**, until the new month lands |
| **success** | the new month's `spent / budget` |
| **failure** | the explicit error state of Q9 |

**The rule underneath it: option identity is not option status.**

```
option identity  (account name, currency)   → may survive a month change
option status    (spent, budget)            → may not
```

A label carried over from August is still the same account in September, so keeping
it is honest. **The August figure under a September date is not** — it would present
one month's spending as another's, which is the exact defect T8 exists to remove,
reintroduced as a loading state. The figures blank; the names stay.

`useBudgetStatusStore` already supports this without new machinery: it keys by month
(`loadedMonth` / `requestedMonth`), **discards a superseded month's answer on
arrival** rather than refusing the newer request, and invalidates on
`onTransactionRecorded`.

#### Q9 — replace, and rebuild the failure path with it

**No fallback to `account/type`.** Falling back means answering a failed request for
the month's figures with the lifetime balance — serving the semantically wrong number
precisely when the right one is unavailable, under a label that claims to be the
month's. It also keeps the replaced endpoint wired on both screens forever.

**The retry is real, and this is what makes the decision affordable.**
`useBudgetStatusStore` exposes `refreshStatus()`, which re-asks for the month already
on screen. R132 records that `useFetch` exposes no refetch, so no screen in the
application can currently offer a retry; replacing the source is what gives this one
the retry that the project's own three-state rule — loading, error **with retry**,
empty — has been asking for.

**The failure must not take the screen down.** Today it does (§9.7). The target is a
form that stays usable with one control degraded:

```
Expense form
├── amount
├── description
├── category selector
│     └── budget status unavailable · Retry
└── submit
```

Whether the submit stays enabled while the category list is empty is not a new
question: with no options there is no category to select, so the existing validation
already refuses the submit. **What changes is that the user sees which part failed
and can retry it**, instead of losing the whole screen.

#### Q13 — the surface, closed 2026-08-29

**The figures go in the option label, not in a status line under the control.**

The question the user is answering while the menu is open is *which category absorbs
this expense*, and that comparison needs the figures visible **before** the selection.
A status line reports on the category already chosen, so it arrives after the decision
it was meant to inform.

**The premise that a prior step hides the figure does not hold.** The category selector
is already the account selector: `Expense.tsx:195` fetches `type=category_budget`, so
every option in that control *is* a budget account. The second control, `Select
Account`, is the bank account the money leaves from — a different entity. There is no
step between opening the menu and seeing the figure.

**The label already carries a parenthesised amount today,** at `Expense.tsx:213` and
`Transfer.tsx:303`. T8 does not add a figure to a clean name; it **replaces a figure
that has no month** with one that does. That is the same defect Q8 separates: the
option's identity survives a month change and its status must not.

**Cost, corrected.** Each screen builds its own label string, so this touches no shared
component and cannot leak a budget figure into the bank, pocket or debtor selectors
(Q12). `DropDownSelection` is not edited and `formatOptionLabel` is not needed.

**Why the status line still exists.** The label is a string, so it cannot hold a
skeleton or a retry control. The three fetch states of Q8 and Q9 therefore need a
surface of their own — but that surface carries states, never a duplicate of the number.

**Why not "available".** Rejected by the developer on the entity, not on the layout:
*available* is a bank-account word, and a `category_budget` account has no balance a
user can draw on. Spend against allocation states what the account actually is (Q10).

### 9.9 Acceptance criteria

No test runner exists (F-15), so *verified* means exercised by hand. **Every
decision of §9.8 is checkable, and the check is named beside it** — a decision with
no observable consequence is not a decision, it is a preference.

| decision | how it is seen to hold |
|---|---|
| **Q8** first load | On a cold store, the dropdown shows a skeleton or a disabled control. **It never shows an option list with no figures on first load**, because there are no names yet |
| **Q8** month change | With August loaded, moving the picker to September keeps the option **names** on screen and **blanks the figures** until September lands. At no instant does an August figure appear beside a September date — this is the one that must be watched frame by frame, and it is the whole point of separating identity from status |
| **Q9** no fallback | With the status request forced to fail, **no option ever renders `ua.account_balance`**. The lifetime figure does not reappear under any condition |
| **Q9** retry works | The error state's control calls `refreshStatus()` and, with the network restored, the figures arrive **without reloading the page** |
| **Q9** the form survives | With the status request failing, the rest of the Expense form still renders and the other controls still respond. The screen is not replaced by `MessageToUser` |
| **Q10** | The option carries two amounts, never three |
| **Q11** | With the Transfer destination set to bank, pocket and investment, the label still shows the running balance from the original endpoint |
| **Q12** | The account, debtor and pocket selectors are untouched; a diff of the commit shows no file outside `Expense.tsx` and `Transfer.tsx` |
| **Q13** the surface | With the menu open and no option selected, **both amounts are already legible on every option**. Selecting one does not reveal a figure that was hidden |
| **Q13** no duplicate | The status line under the control shows only a skeleton, an error with retry, or an empty message. **In no state does it print an amount** |

From `frontend/`,
`NODE_OPTIONS=--max-old-space-size=4096 npx tsc -p tsconfig.app.json --noEmit` exits 0,
plus:

1. **The two screens agree with the budget module.** For the same account on the same
   day, the figure in the Expense dropdown equals the one the budget account card shows.
   They are now the same payload, so a difference is a bug in the label, not a rounding
   question.
2. **It is the month, not the lifetime.** On an account with movements in earlier
   months, the figure is strictly less than `user_accounts.account_balance` — that
   inequality is the whole point of T8.
3. **The zero rows read as decided.** An account with an allocation of 0 and real spend
   shows both amounts; an account with 0 and 0 shows the name alone (§9.5).
4. **The formatter is applied.** Three accounts whose balances end in one decimal, two
   decimals and none render with two decimals each and a thousands separator, and the
   currency appears once, not twice (§9.6).
5. **Transfer leaves the other types alone.** With the destination set to bank, pocket
   and investment, the label still shows the running balance from the original endpoint.
6. **The states are three.** On the wire, on failure and on an empty list the dropdown
   renders distinctly, and in none of them does an option read `0` or `NaN`.
7. **Expense still makes one request** for its category list, not two.
8. On-screen pass at 360, 400 and 768px on both screens — the option label is the
   longest string in the control and 360px is where it wraps or truncates.
9. `git status` clean of `plan-docs/`.

---

## 10. Measurements corrected 2026-08-30

Working tree of `fix/auth-screen`, `HEAD` `e919a89`. Only assertions about the
code were touched. Q5 and Q6 stay open with their recommendations intact; no
sequencing was changed.

| where | what it said | what the code says |
|---|---|---|
| §2, T1 | the `+` beside `Note` is the submit, through `CardNoteSave` | closed — all five screens end with `FormSubmitBtn` |
| §2, T2 | the `<form>` has no `onSubmit` | closed — all five declare `onSubmit={onSaveHandler}` |
| §2, T3 | the dropdown title reads `'Category / Subategory'` | closed by `035661b`; `Expense.tsx:343` reads `'Category / Subcategory'` |
| §2, T5 | the Transfer block at `tracker-style.css:328-362` | `:460-478`, the three `0.95rem` declarations at `:468-471`, still live |
| §2, T6 | the raw hex at `tracker-style.css:62` | `:61`, and it is the file's **only** remaining hex literal |
| header block, T4 | the `max-height` at `tracker-style.css:617-626` | `:622-635`, comment at `:620-621`, and the reason for dropping the `bottom` at `:638-640` |
| header block, T6 | one line survives, `background-color: white` at `:133` | **two** — that one plus `background-color: #252525` at `:61` |
| §4.1 | the rate resolver does not exist, and `frontend/src` holds zero occurrences of `transactionActualDate` | the resolver is at `historicalRateResolver.js:171` and wired through `currencyAmountConversion.js:73-77`; all five screens send the field |
| §5 | *"None is decided; the developer decides"* | Q1–Q4 were implemented as recommended on 2026-08-30 and Q7 is settled; Q5 and Q6 remain |
| §7 | the first task is to locate T4 | T4 is located and closed; this section has no task left, which the header block already said and this section still contradicted |
| §9 | its anchors, dated 2026-08-24 | T8 shipped; the current anchors are given in the block at the head of §9, and `constants.ts:89` replaces `:91-95` |

**Verified true and left alone:** the ranking argument of §3 and everything §6
refuses; the whole of §9.2 through §9.9 as reasoning, including the two
FinTrack-wide points it turns on — that the backend guarantees exactness and the
frontend decides appearance (§9.6), and that option identity survives a month
change while option status must not (§9.8, Q8); `isUnbudgeted` at
`budgetStatus.ts:74`; `useBudgetStatusStore.ts:148`; the verification procedure of
§8 and §9.9.

**Still open after this pass**, and untouched by it: the responsive pass at 360,
400 and 768px on all five screens (T5's residue), Q5 — whether this block adopts
`tokens.css` — and Q6, the date control's presentation contract. The two dead
components the header block names, `CardNoteSave` and `FormPlusBtn`, still have no
caller; their deletion waits on that on-screen pass, as recorded.
