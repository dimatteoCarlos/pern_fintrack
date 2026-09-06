# PLAN — the FX figures the interface renders

Written 2026-09-06, against `main` at `da23e867`. Every line reference below was
re-measured that day against the working tree, not copied from the review that
produced them; where the review's line number had drifted, the current one is
used and the drift is noted.

This document exists because a review of every FX conversion path, run on
2026-09-06 in light of the six currency commits `5a1e5665`…`98b105cb`, returned
six findings, and only the first was acted on. The three that concern **what the
screen prints** were carried in conversation for a day and had no home. This is
that home.

Nothing here corrupts a stored figure. Every defect in §2, §3 and §4 is a false
**reading** of a correct record — which is why none of it blocked the currency
going to production, and why all of it is still worth fixing before a second
non-USD accounting currency exists.

Paths are relative to the repository root. Frontend files live under
`frontend/src/fintrack/`, which is omitted after each file's first mention.

---

## 0. The one-sentence version

The application decided in September 2026 that **the locale belongs to the
reader and the precision belongs to the currency**, and both decisions reach
every surface except the thirteen files whose figures are FX results.

---

## 1. The six findings and where each one stands

| # | finding | kind | status |
|---|---|---|---|
| 1 | Banca d'Italia never served the yen, so the historical arm for JPY fell to the CDN of last resort | stored figure | **Fixed** `0b602095`, 2026-09-06; the guide's gap behind it fixed in `da23e867` |
| 2 | The precondition `money.js` states in writing is now false | backend invariant | **Open.** §5 |
| 3 | Thirteen files hardcode the locale on an FX figure | display | **Open.** §2 |
| 4 | The minor-unit clamp is bypassed exactly where a conversion is displayed | display | **Open.** §3 |
| 5 | `DEFAULT_CURRENCY` stands in for the accounting currency in the FX audit card | display | **Open.** §4 |
| 6 | Two conversion generations coexist — one date-aware, one not | architecture | **Narrowed to one form**, `NewAccount.tsx`; correct everywhere else. §6, ruling in §9.2 |

Findings 3 and 4 are one edit in the same files and must not be split; the
argument is in §7.

---

## 2. Finding 3 — the locale is the reader's, except on the conversion previews

Commit `6b916c05` established that a currency's locale comes from
`CURRENCY_OPTIONS` in `frontend/src/fintrack/helpers/currencyConstants.ts:47-58`
and fixed nine files. The conversion previews were not among them. They still
name a locale in the call, and the locale they name is the wrong one twice over:
it is not the reader's, and it is not the currency's.

| site | what it hardcodes |
|---|---|
| `hooks/useCurrencyPreview.ts:48` | `'es-ES'` and a precision of `2`, for the `≈` preview that six forms consume |
| `pages/forms/newAccount/NewAccount.tsx:316`, `pages/forms/newCategory/NewCategory.tsx:163`, `pages/forms/newPocket/NewPocket.tsx:161`, `pages/forms/newProfile/NewProfile.tsx:211`, `pages/forms/editPocket/EditPocket.tsx:224`, `pages/budget/components/budgetEditModal/BudgetEditModal.tsx:297` | `numberFormatCurrency(rate, 2, undefined, 'es-ES')` — the same line copied six times |
| `pages/overview/components/transactionDetailModal/TransactionDetailModal.tsx:55,62,102` | `'es-ES'` on the stored amount, on the exchange rate and on the direct rate — the FX audit card |
| `pages/tracker/components/TopCard.tsx:191,207` | `'es-ES'` on the converted amount |
| `pages/budget/components/ListCategory.tsx:244,249,258`, `pages/forms/categoryDetail/ListAccountOfCategory.tsx:282,284,323` | `'en-US'` instead of `CURRENCY_OPTIONS[DEFAULT_CURRENCY]` |
| **Found 2026-09-06, not in the original review:** `pages/tracker/transfer/Transfer.tsx:279,283`, `pages/tracker/expense/Expense.tsx:312,317` | `'en-US'` passed to `currencyFormat` for a per-account figure whose currency comes from the row, so the locale contradicts the currency on every non-USD account |

The last two rows are invisible on screen today, and for two different reasons.
`'en-US'` matches because `DEFAULT_CURRENCY` resolves to `usd` and
`CURRENCY_OPTIONS.usd` is `'en-US'`; the account rows match because the seeded
data is dollar-denominated. Neither is a different bug from the first four rows.
Both are the same one, waiting.

**What is actually wrong with `'es-ES'`.** It is not that Spanish formatting is
undesirable. It is that a hardcoded locale makes the separators a property of
the *code path* rather than of the money, so the same yen amount reads
`1.234,57` on a form and `￥1,235` in a table, and a reader comparing the two
concludes the figures differ.

---

## 3. Finding 4 — the precision clamp does not reach the conversion previews

`frontend/src/fintrack/helpers/functions.ts:295-314` clamps the requested
decimals down to the currency's own minor unit, and says so in its comment: the
minor unit is a ceiling, never a floor, because there is no half yen. The clamp
lives **inside** the branch that runs only when a currency code was passed:

```ts
if (currency && isValidCurrencyCode(currency)) {
  const digits = Math.min(decimals, currencyMinorUnit(currency));
```

Every conversion preview passes `undefined` for that argument and appends the
code afterwards as loose text:

```ts
// useCurrencyPreview.ts:48
const preview = `≈ ${numberFormatCurrency(targetCurrencyValue, 2, undefined, 'es-ES')} ${accountingCurrency}`;
```

So commit `d1fb8f9e` — decimals follow the currency — reaches every card and
every table, and does not reach the one screen whose whole purpose is showing an
FX result. With the yen as accounting currency the preview reads
`≈ 1.234,57 jpy`, a precision the yen does not have, beside a symbol the
formatter would have emitted itself. The same shape sits at `TopCard.tsx:191`.

**The fix is passing the currency, not adding a clamp.** `numberFormatCurrency`
already does the right thing when told what the money is; the previews withhold
that and then re-add the code as a string. The second branch of that function —
a figure with no currency — must stay untouched, because an exchange rate is not
money and its decimals are the caller's choice. That distinction is the reason
the clamp is where it is, and a fix that moves the clamp out of the branch would
start rounding rates.

---

## 4. Finding 5 — the interface currency stands in for the accounting currency

`TransactionDetailModal.tsx:55` formats `transaction.amount` — a figure
**stored** in the accounting currency — as `DEFAULT_CURRENCY`. Line `:96` then
decides whether the FX card renders at all by comparing the transaction's
original currency against that same constant, and `:111` labels the conversion
direction with it. *(The review cited `:98` for the visibility test; the line is
`:96` in the current file.)*

The distinction is already stated correctly, in the hook that answers the same
question:

> *"Currency the amount will be STORED in, which is the question this preview
> answers. Not DEFAULT_CURRENCY: that one is only what the interface renders."*
> — `useCurrencyPreview.ts:19-21`

This is latent only while both resolve to `usd`. Commit `98b105cb` is what makes
them separable: `DEFAULT_CURRENCY` now reads `VITE_ACCOUNTING_CURRENCY_CODE`
from the environment, while the store's `accountingCurrency` is a different
value with a different source. The day those two disagree, this modal formats a
stored figure under the wrong currency, hides the FX card for transactions that
have one, and shows it for transactions that do not — three wrong answers from
one substitution.

**The correct source is the store's `accountingCurrency`**, the same one
`useCurrencyPreview.ts:21` reads.

---

## 5. Finding 2 — the invariant `money.js` documents is no longer true

Backend, and therefore not part of the display work, but it belongs on this list
because it came from the same review and has the same cause: a comment that was
a measurement in August and is a claim in September.

`backend/src/fintrack_api/services/budget_services/core/money.js:41-55`
justifies `MINIMUM_AMOUNT` this way:

> *"This holds only because the five seeded currencies (usd, eur, cop, ves, mxn)
> are all scale 2 — a catalog fact, not a design. JPY at scale 0 would let 0.5
> through and KWD at scale 3 would reject a valid 0.001."*

Migration `030_add_jpy_currency.sql` made that sixth currency real on
2026-09-05, and it reached production on 2026-09-06. `AMOUNT_SCALE` is
unchanged, so `MINIMUM_AMOUNT` still admits ¥0.50 — an amount that does not
exist.

**Bounded damage, and worth stating precisely.** Nothing corrupts:
`original_amount` stores at numeric scale 2, and ¥1234 is ¥1234.00 whichever way
you write it. What broke is the invariant the file names, and the comment now
reads as current fact while describing a catalog of five that has six rows in
it. The minimum fix is correcting the comment; the real fix is `AMOUNT_SCALE`
per currency, which is a larger change than this document covers.

---

## 6. Finding 6 — two conversion generations, deliberately

Recorded so nobody re-discovers it as a defect.

The server path — `hooks/useServerCurrencyConversion.ts` calling
`POST /api/fintrack/currency/convert` — is date-aware and consumes the `quote`
field the controller added for the reason given at
`backend/src/fintrack_api/controllers/currencyController.js:157-162`: a
peso-to-dollar `rate` of `0.00031` rounds to zero and reads as *no rate*. Only
`pages/forms/pocketDetail/pocketAllocationModal/PocketAllocationModal.tsx:335`
and `TopCard.tsx:202` use it.

The six forms in §2 still divide a store rate client-side, with no date and no
`quote`. That is deliberate per the hook's own header, and for five of the six it
is also correct.

**Measured 2026-09-06 — only one of the six can back-date.** Of the six callers
of `useCurrencyPreview`, three carry a user-settable date and three do not, and
of those three the dates are not the same kind of date:

| form | date field | can it point at the past? |
|---|---|---|
| `pages/forms/newAccount/NewAccount.tsx:291-292` | `date`, the account's starting point | **Yes** |
| `pages/forms/newPocket/NewPocket.tsx:132-135` | `desiredDate`, a savings deadline | No — `:432` sets `minDate={startOfToday()}` and the server refuses a past deadline on the owner's calendar |
| `pages/forms/editPocket/EditPocket.tsx:196-198` | `desiredDate`, same field | No, same floor |
| `NewCategory.tsx`, `NewProfile.tsx`, `BudgetEditModal.tsx` | none | No |

So the preview-versus-record disagreement is not an architectural condition
spread across six forms. It is **one form**: opening an account with a starting
point in the past previews at today's rate and is written at the historical one.
Everywhere else the record is dated today and the store rate is the right rate,
which makes the client-side divide the cheaper correct answer rather than a
shortcut.

---

## 7. Commit shape

**Findings 3 and 4 are one commit.** Thirteen files drop a hardcoded locale, and
two of them — `useCurrencyPreview.ts:48` and `TopCard.tsx:191` — also start
passing the currency, because those two format **money**. Splitting the findings
means editing `useCurrencyPreview.ts:48` twice for one line.

The six form files are the reason finding 4 is not simply "pass the currency
everywhere": what they format is an exchange **rate**, not money, so they take
the locale fix and nothing else. Passing a currency there would clamp the rate to
that currency's minor unit, and a rate smaller than one minor unit then prints as
zero — the same failure `currencyController.js:157-162` added the `quote` field
to avoid. Those six calls keep `undefined` deliberately.

Finding 5 is a second commit: different file, different source of truth, no
overlap. Order does not matter between them. Neither depends on the other and
neither depends on any backend change.

**A regression check exists for free.** Set `VITE_ACCOUNTING_CURRENCY_CODE` to
`jpy` and open any form with a foreign-currency amount: before the fix the
preview shows two decimals and `es-ES` separators, after it shows none and the
reader's. That is the whole test, and it needs no seeded data.

---

## 8. Ownership and what this document does not do

The three open display findings are **frontend work**; who takes them is ruled on
in §9.3. Finding 2 is backend and sits in this session's scope.

This document does not schedule the work, and deliberately does not fold it into
`PLAN_TRACKER_UX.md` or the Overview plan: the defect crosses tracker, budget,
forms and overview, so filing it under any one of them would hide it from the
other three.

---

## 9. Open decisions, each with a ruling

Three calls are the developer's. Each is stated with what it costs either way and
the option this document recommends; none is left as a menu.

### 9.1 What to do about the false precondition in `money.js`

**The decision:** whether the smallest expressible amount starts following the
currency now, or whether only the comment that describes it gets corrected.

| option | for | against |
|---|---|---|
| Correct the comment, keep `AMOUNT_SCALE` fixed at 2 | one paragraph, no behaviour change, no migration; the file stops asserting something false | the yen still admits ¥0.50 through `MINIMUM_AMOUNT` |
| Make `AMOUNT_SCALE` per currency | removes the defect rather than documenting it | the scale is baked into `DECIMAL(15,2)` columns, so it is a schema question, not a constant; it needs its own plan and a migration |

**Recommendation: correct the comment now, and do not start per-currency scale
yet.** ¥0.50 is unreachable in practice — the accounting currency is the dollar,
and the amount would have to pass validation in a currency the system does not
currently store in — whereas a comment stating "the five seeded currencies" in a
catalog that has six is read as fact by the next person and is wrong today.

**The trigger that reopens this:** the day `VITE_ACCOUNTING_CURRENCY_CODE` is set
to a currency whose minor unit is not 2. At that moment the per-currency scale
stops being a tidiness question and becomes a correctness one.

### 9.2 Whether the preview may disagree with the record

**The decision:** whether opening an account with a past starting point may keep
previewing at today's rate while the row is written at the historical one.

The measurement in §6 narrows this to `NewAccount.tsx` alone; the other five
forms cannot back-date and are not part of the question.

| option | for | against |
|---|---|---|
| Accept it | no change; the store rate costs no request | the user is shown one figure and the ledger stores another, on the one screen where the difference is the point |
| Route that form through `useServerCurrencyConversion.ts` | the preview becomes the same rate the record will carry, date and all; the hook, the endpoint and the `quote` field already exist and two components already use them | one form gains a request per amount change, and needs the loading and error states any fetch needs |

**Recommendation: route `NewAccount.tsx` through the server hook and accept the
client-side divide everywhere else.** The whole cost is one component, because
the date-aware path is already built and consumed by
`PocketAllocationModal.tsx:335` and `TopCard.tsx:202`; leaving it unused on the
one form that can back-date is the only place where the shortcut is actually
wrong.

**Sequencing:** after §2-§4, not before. This changes what the preview *is*;
those change how it is *printed*, and doing the printing first means the new path
inherits a correct formatter instead of a second copy of the defect.

### 9.3 Which session implements §2-§4

**The decision:** who owns a thirteen-file formatting fix that crosses tracker,
budget, forms and overview.

| option | for | against |
|---|---|---|
| The session that owns the currency catalog and cross-module coherence | the fix is "consume `CURRENCY_OPTIONS`", which is that catalog's own surface, and one session touching all thirteen files keeps it one commit | it is a larger single commit than that session usually takes |
| Split by page owner across sessions | each session touches only its own module | four sessions editing the same defect in a shared working tree, and the last row of §2 — the latent `'en-US'` — gets fixed inconsistently or missed |
| A frontend-specialised agent | matches the repo's habit of sending interface work there | there is no design decision here; the target value is already named in `currencyConstants.ts` |

**Recommendation: one session, the one owning the currency catalog and
integration coherence, in one commit.** The defect is a single wrong idea copied
thirteen times, and splitting it by page owner guarantees the copies diverge —
which is how it reached thirteen files in the first place.

**Not this session.** `backdating` owns the migration chain, the retroactive FX
calculations and the backend they require; §5 is in that scope and §2-§4 are not.

**Settled 2026-09-06.** The session owning the currency catalog took the locale
fix, as recommended. Two things it raised belong on the record.

*It excluded two sites, correctly.* `helpers/timeZoneOptions.ts:46` and `:103`
keep `'en-US'`: the first reads the short UTC offset back out of `formatToParts`,
so the locale is choosing the shape of a string the code then parses rather than
one a reader sees, and the second builds a formatter inside a `try` only to learn
whether the runtime accepts a timezone identifier, then discards it. Routing
either through the currency catalog would make timezone validation depend on a
currency map. Neither was ever in §2's inventory; they are noted here so nobody
re-adds them.

*The two inventories are different sets, and neither contains the other.* §2
lists the files that format an **FX figure**. The locale sweep adds date
formatting and the default parameters in `helpers/functions.ts:41,216,283`, and
it does **not** cover the `numberFormatCurrency` sites: `useCurrencyPreview.ts:48`,
the six form files, `TransactionDetailModal.tsx` and `TopCard.tsx`. Those are the
FX previews, which is the half of finding 3 that made it visible. If the sweep
ships without them, §2 is half-fixed and the preview still reads `es-ES`.

### 9.4 The date locales are a design, not a defect — measured 2026-09-06

Raised here because the locale sweep of §9.3 proposed to correct two constants
that are load-bearing, and this is the same shape of mistake as the one that
caused the yen incident: a deliberate decision read as an oversight.

`helpers/constants.ts:81-86` declares **two** date locales and says why:

```ts
export const DATE_TIME_FORMAT_DEFAULT = 'es-ES';

// For dates that render a WORD rather than digits. DATE_TIME_FORMAT_DEFAULT only
// decides separators and order, but a long month name makes the locale the
// interface language, and the interface is in English.
export const DATE_TEXT_FORMAT = 'en-US';
```

A numeric date takes day-first order and its separators from the first; a date
that spells a month takes the second, so the month is not suddenly Spanish while
every label around it is English. Nine files consume the pair — `functions.ts:328,345,362,386`,
`ListContent.tsx:44`, `FxPathwayCard.tsx:45,50`, `BudgetEditModal.tsx:126` and
`AccountTransactionDetailModal.tsx:62`. **Neither constant is a defect and
neither belongs in the currency map**: routing them through `CURRENCY_OPTIONS`
would make a date's separators depend on the money on the same screen.

What *is* a defect is a file writing the literal instead of importing the
constant, and there are four:

| site | it should consume | why |
|---|---|---|
| `TopCard.tsx:223` | `DATE_TIME_FORMAT_DEFAULT` | numeric day/month/year; the comment at `:211-216` already argues for exactly that constant and then hardcodes its value |
| `PocketDetail.tsx:140` | `DATE_TIME_FORMAT_DEFAULT` | numeric date and time in the owner's zone |
| `TransactionDateTrigger.tsx:82,90` | `DATE_TEXT_FORMAT` | `month: 'short'` is a **word**, so it takes the text locale; `'en-GB'` is a third locale belonging to neither constant, and `:82` is the accessible name a screen reader announces |
| `functions.ts:499` | `DATE_TIME_FORMAT_DEFAULT` | `formatDate`, numeric per its own comment; carried by neither inventory |

The distinction that decides each row is **whether the date renders a word**, and
it is already written down at `constants.ts:83-85`. A sweep that replaces
literals without asking that question will spell month names in Spanish.

**These four are their own commit, not part of §9.3.** The money and rate sites
resolve their locale from `CURRENCY_OPTIONS` — the currency decides. These four
resolve it from `DATE_TIME_FORMAT_DEFAULT` or `DATE_TEXT_FORMAT` — the kind of
date decides, and the currency has nothing to say about it. Two sources of truth
and two rules, so one commit covering both could not have a message that
describes what it did. `TopCard.tsx:213`'s stale line reference is corrected in
this commit rather than separately, because that comment is what the change to
`:223` is acting on.

*One stale reference found while measuring:* `TopCard.tsx:213` cites
`helpers/constants.ts:57-59` for the word-month rule. That text now sits at
`:83-86`.

*One trap in the default-parameter change.* Making `currencyFormat`'s third
parameter default to the map — `countryFormat = CURRENCY_OPTIONS[chosenCurrency]`
— is legal, because a parameter default may read an earlier parameter, and it
would fix all four callers by deletion. But `CURRENCY_OPTIONS` is keyed in
lowercase (`currencyConstants.ts:47-58`) while that function's own first default
is `'USD'` in capitals, so the miss returns `undefined` and
`Intl.NumberFormat(undefined, …)` silently falls back to the host locale. That
happens to resemble the intended behaviour, which is what makes it dangerous:
it is not the map speaking. Normalise the case at the lookup, the way
`isValidCurrencyCode` does at `functions.ts:257`.
