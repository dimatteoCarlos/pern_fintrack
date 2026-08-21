// backend/src/fintrack_api/services/pocket_services/core/makePocketStatus.js

// The rounding point for one pocket: the single place a row of the board takes
// its final shape. Same role makeBudgetAccountStatus plays for a budget row, and
// the same reason for existing — three screens read these figures, and a
// percentage computed twice is a percentage that disagrees with itself.
//
// Two nullable amounts, and neither null means zero:
//
//  - target is a nullable column. A pocket with no goal is a real pocket; it
//    simply has no progress, no gap and nothing to be behind on.
//  - progress is null whenever target is null OR zero. There is no percentage
//    of zero, and 0% would state that nothing has been saved.
//
// saved is never null: it is user_accounts.account_balance, which is NOT NULL.
// It can be negative — a pocket withdrawn past its opening amount — and that is
// a fact about the account, not an error.

import { toAmount, toRate, money } from '../../budget_services/core/money.js';

const HUNDRED = 100;

// money.js is under budget_services only because the budget module needed the
// rounding policy first. It is not budget-specific — it owns the app's scale and
// rounding mode — and importing it is what keeps this module from carrying a
// second answer to "what does two decimals mean". Moving it to a shared core is
// a refactor of its own and is not done here.

/**
 * Build one pocket row of the board.
 *
 * @param {object} row
 * @param {number} row.accountId
 * @param {string} row.accountName
 * @param {string|null} row.note
 * @param {string|number|null} row.target - NUMERIC as text, or null
 * @param {string|number} row.saved - NUMERIC as text
 * @param {string} row.desiredDate - YYYY-MM-DD on the owner's calendar
 * @param {'user'|'default'} row.desiredDateSource
 * @param {string} row.startDate - YYYY-MM-DD on the owner's calendar
 * @param {string} row.currency - lowercase code
 * @returns {Readonly<object>}
 */
export function makePocketStatus({
 accountId,
 accountName,
 note,
 target,
 saved,
 desiredDate,
 desiredDateSource,
 startDate,
 currency,
}) {
 if (!Number.isInteger(accountId)) {
  throw new Error('PocketStatus: accountId must be an integer');
 }

 if (typeof accountName !== 'string' || accountName.length === 0) {
  throw new Error('PocketStatus: accountName is required and must be a non-empty string');
 }

 if (typeof currency !== 'string' || currency !== currency.toLowerCase()) {
  throw new Error('PocketStatus: currency must be a lowercase code');
 }

 // Guarded rather than coerced. A source outside the union means the CHECK on
 // the column was bypassed, and the card decides between a pace and "deadline
 // not set" on this value — a silent fallback would pick one of the two.
 if (desiredDateSource !== 'user' && desiredDateSource !== 'default') {
  throw new Error(
   `PocketStatus: desiredDateSource must be 'user' or 'default', received ${String(desiredDateSource)}`,
  );
 }

 const savedAmount = money(saved);
 const targetAmount = target === null || target === undefined ? null : money(target);

 // Null and 0 are the same answer here for a different reason each: no goal was
 // set, and a goal of zero has no percentage. Both render as an absence.
 const hasGoal = targetAmount !== null && !targetAmount.isZero();

 return Object.freeze({
  accountId,
  accountName,
  // Nullable column. A missing note is null, never '' — an empty string is a
  // note the user wrote and then cleared, and the row would collapse it.
  note: note ?? null,
  target: targetAmount === null ? null : toAmount(targetAmount),
  saved: toAmount(savedAmount),
  progress: hasGoal
   ? toRate(savedAmount.dividedBy(targetAmount).times(HUNDRED))
   : null,
  // Negative when the pocket is over-funded, which is not an error: the goal
  // was passed. Null when there is no goal to be short of.
  remaining: targetAmount === null ? null : toAmount(targetAmount.minus(savedAmount)),
  desiredDate,
  desiredDateSource,
  startDate,
  currency,
 });
}
