// backend/src/fintrack_api/services/budget_services/core/money.js

// Scale and rounding mode for every figure the budget module reports.
//
// Nothing inside a calculation chain rounds: amounts stay exact between
// boundaries. This module owns those boundaries, so the API, the CSV export and
// the totals cannot disagree on what "two decimals" means.
//
// The rules this file implements are stated in plan-docs/ROUNDING-POLICY.md.

import Decimal from 'decimal.js';

// A private constructor, not the shared Decimal. fx_services imports the same
// module, so a Decimal.set() anywhere would change this module's rounding at a
// distance.
const Money = Decimal.clone({
 precision: 34,
 rounding: Decimal.ROUND_HALF_UP,
});

// Minor-unit exponent. The app is USD-only (ACCOUNTING_CURRENCY_CODE); JPY is 0
// and KWD is 3, so this becomes per-currency when P6 lands.
const AMOUNT_SCALE = 2;

// executionPercentage is a ratio, not money. Its own constant so it can diverge
// without touching amounts.
const RATE_SCALE = 2;

// Chosen for parity with Postgres numeric, which rounds half away from zero.
// The name understates it: decimal.js applies HALF_UP away from zero for
// negatives too, which is what remainingBudget needs when an account is
// overspent. Aligning the modes makes a missed rounding point yield the same
// figure instead of a silently different one (ROUNDING-POLICY.md, P3).
const ROUNDING = Money.ROUND_HALF_UP;

// Largest value DECIMAL(15,2) holds: 13 integer digits plus the scale. Past
// this a value has no canonical form — clamping would change what the caller
// asked for — so callers reject instead of normalizing (P5).
const MAX_AMOUNT = new Money('9999999999999.99');

/**
 * The smallest expressible amount: one minor unit of the accounting currency.
 *
 * Derived from the scale rather than written as 0.01, so it follows the
 * currency once AMOUNT_SCALE becomes per-currency.
 *
 * It does not follow it yet, and accounts already carry their own currency_id.
 * This holds only because the five seeded currencies (usd, eur, cop, ves, mxn)
 * are all scale 2 — a catalog fact, not a design. JPY at scale 0 would let 0.5
 * through and KWD at scale 3 would reject a valid 0.001.
 *
 * Exported because a caller rejecting a sub-unit amount has to name the limit;
 * "greater than 0" is true but useless to someone who typed 0.004.
 */
export const MINIMUM_AMOUNT = new Money(`1e-${AMOUNT_SCALE}`).toNumber();

/**
 * Parse without throwing. Decimal rejects null, booleans and unparseable
 * strings by exception, which is the wrong shape for a predicate.
 *
 * @param {*} value
 * @returns {Decimal|null}
 */
const toDecimalOrNull = (value) => {
 try {
  const amount = new Money(value);
  return amount.isFinite() ? amount : null;
 } catch {
  return null;
 }
};

/**
 * Build an exact Decimal from anything the module handles.
 *
 * Accepts the NUMERIC string pg returns, so a driver value is never degraded
 * through parseFloat before the exact arithmetic begins.
 *
 * @param {number|string|Decimal} value
 * @returns {Decimal}
 */
export function money(value) {
 const amount = toDecimalOrNull(value);

 if (amount === null) {
  throw new TypeError(`money: expected a finite numeric value, received ${String(value)}`);
 }

 return amount;
}

/**
 * Whether a value can become an amount. Never throws: this is the predicate the
 * domain validators use in place of `typeof x === 'number'`, which would reject
 * the Decimals the calculator now hands over.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isFiniteMoney(value) {
 return toDecimalOrNull(value) !== null;
}

/**
 * Whether a value still fits the amount columns once rounded to scale.
 *
 * Tested after rounding, not before: 9999999999999.994 is over the limit as
 * written but stores exactly, and rejecting it would be arbitrary.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isWithinAmountRange(value) {
 const amount = toDecimalOrNull(value);

 if (amount === null) {
  return false;
 }

 return amount.toDecimalPlaces(AMOUNT_SCALE, ROUNDING).abs().lessThanOrEqualTo(MAX_AMOUNT);
}

/**
 * An amount as the API reports it: a plain number at 2 decimals.
 *
 * @param {number|string|Decimal} value
 * @returns {number}
 */
export function toAmount(value) {
 return money(value).toDecimalPlaces(AMOUNT_SCALE, ROUNDING).toNumber();
}

/**
 * A rate as the API reports it. Same scale as an amount today, different
 * meaning: it never enters a sum, so it is rounded only so the response and the
 * export agree.
 *
 * @param {number|string|Decimal} value
 * @returns {number}
 */
export function toRate(value) {
 return money(value).toDecimalPlaces(RATE_SCALE, ROUNDING).toNumber();
}

/**
 * An amount as fixed-point text, trailing zeros kept.
 *
 * The CSV needs "250.50" where toAmount gives 250.5. Formatting lives here so
 * the export does not carry its own copy of the scale.
 *
 * @param {number|string|Decimal} value
 * @returns {string}
 */
export function toAmountString(value) {
 return money(value).toFixed(AMOUNT_SCALE, ROUNDING);
}