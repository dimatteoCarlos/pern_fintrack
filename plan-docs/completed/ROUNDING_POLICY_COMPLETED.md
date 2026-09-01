# COMPLETED — Rounding policy

> ## ✅ COMPLETED — closed 2026-08-13
>
> Implemented in `e9dc13a`. The operative rule — `core/money.js`, scale 2,
> `ROUND_HALF_UP`, rounding at boundaries only — is restated in `DECISIONS.md`
> §13 so it stays findable without opening this file.
>
> **It governs every monetary value in the application, not only Budget.** That is
> why it is not a section of `PLAN_BUDGET_V1.md`.
>
> | what was left over | where it lives now |
> |---|---|
> | P7, blocked | `REMARKS.md` R9 |
> | Account balances outside `budget_services` still computed in floating point (`parseFloat` ×61 across 13 files) | `REMARKS.md` R10 — unowned, outside the budget module |

**Status:** Implemented in `e9dc13a` · **Re-verified:** 2026-08-10 · Applies to
`budget_services` only; `R10` records that account balances outside it are still computed in
floating point.

How money is rounded, where, and why. The policy exists because a figure that rounds
differently depending on which code path produced it is a defect no test asserts and no
error reports.

**Status:** Adopted 2026-08-02 · Implemented in `budget_services` · P7 blocked on R9

---

## The policy

### P1 — Rounding happens at boundaries, never inside a calculation

Three boundaries exist:

| Boundary | Where | What crosses it |
|---|---|---|
| **Entry** | a value arrives from a client | over-specified input becomes canonical |
| **Storage** | a value is written to or read from the database | the domain's atomic unit is enforced |
| **Presentation** | a value leaves in a response or an export | the figure the user sees is fixed |

Between two boundaries a value stays exact. A calculation chain that rounds its
intermediate steps produces a result that depends on how the chain was decomposed, which
means two correct-looking implementations disagree by cents.

### P2 — The application rounds, not the database

An implicit cast into `DECIMAL(15,2)` also rounds, but silently, with no line of code
recording the decision and no way to test it. Every rounding point must be a visible call.

This is what makes P3 enforceable: if rounding is delegated to the driver or the column,
the mode is whatever that layer happens to use.

### P3 — The mode is `ROUND_HALF_UP` (half away from zero)

`decimal.js` defines `ROUND_HALF_UP` as "rounds towards nearest neighbour; if equidistant,
rounds away from zero" — the same rule Postgres `numeric` applies, negatives included.

Negatives are not hypothetical here: `remainingBudget` is negative whenever an account is
overspent, and reversal movements are stored negative.

Aligning the two modes makes the policy **fail-safe**. If a rounding point is ever missed
and Postgres performs the cast instead, the figure is the same rather than silently one
cent apart. The alternative (`ROUND_HALF_EVEN`) has a better statistical argument for
large aggregations, but it turns every missed rounding point into an invisible divergence.

### P4 — Amounts round to `AMOUNT_SCALE`; rates and ratios to `RATE_SCALE`

An amount is a quantity of money; its scale defines the atomic unit of the domain. A rate
is a factor; its scale defines how much of a ratio survives. They are separate constants
in `money.js` because they answer different questions and will diverge (see R9).

`AMOUNT_SCALE = 2` is the minor-unit exponent of the accounting currency. It becomes
per-currency when multi-currency lands: JPY is 0, KWD is 3.

That is a live assumption, not future work. `user_accounts.currency_id` is already
per-account and `currencies` already seeds five of them, so a EUR or MXN account can exist
today. A single scale still describes all of them because usd, eur, cop, ves and mxn are
all scale 2 — a property of the current catalog, not a decision. Adding a currency at a
different scale breaks the assumption in both directions at once. See R11.

### P5 — Scale is normalized; magnitude is rejected

A value with too many decimals is over-specified, not invalid: it has an unambiguous
canonical form, so it is rounded on entry. A value beyond the storable range has no
canonical form — clamping it would silently change what the user asked for — so it is a
`400`.

Positivity is checked **after** normalizing. `0.004` is a positive number that stores as
`0.00`, which a `CHECK (amount > 0)` rejects as a `500` rather than a usable message.

That case deserves its own message. `0.004` USD is representable as a number but not
expressible as money: the minor unit of the currency is the cent, so there is no such
quantity to budget. Telling the caller "must be greater than 0" contradicts what they see
on screen; telling them the minimum (`MINIMUM_AMOUNT`, derived from `AMOUNT_SCALE`) names
the actual limit.

Widening the scale does not remove this boundary, it only moves it: at scale 4, `0.0004`
fails instead. Every finite scale has a positive value below its minimum. The requirement
is not to eliminate the floor but to state where it is.

### P6 — Addition and subtraction need no rounding; multiplication and division do

Adding two exact values at scale 2 yields an exact value at scale 2. No new decimal
appears, so there is nothing to round and no policy to state. Overview totals, budget
accumulation and CSV sums are all in this class.

Multiplication (an FX rate times an amount) and division (an execution percentage) create
decimals that did not exist in either operand. Those are the only operations that need a
declared rounding point.

**This holds for `Decimal`, not for JS floats.** In floating point, `0.1 + 0.2` produces
`0.30000000000000004` — addition does invent decimals. Any money arithmetic performed on
`Number` is outside this policy by construction (see R10).

### P7 — FX conversion is a fourth boundary, still undefined

Converting a total and converting each line then summing can differ by cents. The policy
must name which side is authoritative before multi-currency ships.

Blocked on **R9**. Dormant while `ACCOUNTING_CURRENCY_CODE` keeps the app single-currency
and `exchange_rate` defaults to `1.0`.

---

## Where it applies

| Boundary | Site | Behaviour |
|---|---|---|
| Entry | `normalizeAllocationInput` — `budgetPolicyService.js` | Rejects magnitude, normalizes scale, then checks positivity |
| Storage (write) | the three allocation `INSERT`s | Receives an already-normalized value; no implicit cast rounds |
| Storage (read) | `budgetPolicyService.js` — allocation mappers | `toAmount` over the NUMERIC string pg returns, never `parseFloat` |
| Calculation | `budgetVsActualCalculator`, `makeTotals`, `makeBudgetResult` | Rounds nothing — exact `Decimal` end to end |
| Presentation | `toAmount` / `toRate` / `toAmountString` — `core/money.js` | The only code that produces a final figure |
| Presentation | `formatAmount` — `utils/fintrackUtils/exportUtils.js` | Formats an already-rounded value; adds no decision |
| *Pending* | FX conversion | R9 — P7 undefined |
| *Pending* | account balance updates | R10 — float arithmetic, violates P2 and P6 |

`core/money.js` owns the constants (`AMOUNT_SCALE`, `RATE_SCALE`, `ROUNDING`) and a
private `Decimal.clone()`. The clone matters: `fx_services` imports the same library, and
a `Decimal.set()` anywhere in the process would otherwise change this module's rounding at
a distance.

---

## Consequences accepted

- **`parseFloat` on a money column is a policy violation, not a style preference.** It
  discards the exact NUMERIC string pg hands over and replaces it with the nearest double,
  before any boundary was reached.
- **A normalized entry value is not always the value the user typed.** `250.555` is stored
  and echoed as `250.56`. This was already true — Postgres did it in the cast — but it is
  now a decision the code makes and the response reports.
- **Widening the money columns was evaluated and rejected.** See R9: a scale change is a
  full table rewrite under `ACCESS EXCLUSIVE` with a lossy DOWN migration, paid today for
  a benefit that only arrives with the second currency.
