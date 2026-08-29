// backend/src/fintrack_api/services/pocket_services/core/makePocketStatus.js

// The rounding point for one pocket: the single place a row of the board takes
// its final shape. Same role makeBudgetAccountStatus plays for a budget row, and
// the same reason for existing — three screens read these figures, and a
// percentage computed twice is a percentage that disagrees with itself.
//
// The figure is allocated, never saved. A pocket holds no money: allocated is
// how much of the real accounts is committed to this goal, summed from the
// ledger, and no balance is read anywhere in this module.
//
// target is NOT NULL with CHECK (> 0), so nothing here branches on a missing
// goal: a pocket with no target has no representation in the schema, and the
// null progress and null remaining the old version served are unreachable
// states.

import { toAmount, toRate, money } from '../../budget_services/core/money.js';

const HUNDRED = 100;

// The mean length of a Gregorian month in days. requiredMonthly answers "how
// much per month", so the horizon has to be expressed in months, and 30 would
// overstate the pace by half a percent every month.
const DAYS_PER_MONTH = 30.44;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// money.js is under budget_services only because the budget module needed the
// rounding policy first. It is not budget-specific — it owns the app's scale and
// rounding mode — and importing it is what keeps this module from carrying a
// second answer to "what does two decimals mean". Moving it to a shared core is
// a refactor of its own and is not done here.

/**
 * Whole days between two calendar dates, both YYYY-MM-DD on the owner's clock.
 *
 * Parsed as UTC on purpose: both labels are read at the same offset, so the
 * offset cancels and the difference is the count of calendar days between them
 * rather than a duration that a daylight-saving hour could round the wrong way.
 */
const daysBetween = (fromDate, toDate) =>
 Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / MILLISECONDS_PER_DAY);

/**
 * How much must still be committed per month to reach the goal by its date.
 *
 * Zero once the goal is covered: there is nothing left to pace, and dividing a
 * negative remainder would report a monthly figure for money already committed.
 */
const computeRequiredMonthly = (remaining, daysRemaining) => {
 if (remaining.lessThanOrEqualTo(0)) {
  return 0;
 }

 if (daysRemaining <= 0) {
  return null;
 }

 return toAmount(remaining.dividedBy(money(daysRemaining).dividedBy(DAYS_PER_MONTH)));
};

/**
 * Build one pocket row of the board.
 *
 * Nothing is clamped. At the level of one pocket the sign IS the information:
 * remaining = -100 means over-funded by 100, which is a fact. The progress bar
 * stops at 100% and the card prints the excess as its own line, and that is the
 * component's business — no consumer of this object may assume a ceiling. The
 * board's totals clamp per pocket before summing, for the opposite reason, and
 * makeSummary is where that happens.
 *
 * @param {object} row
 * @param {number} row.pocketId
 * @param {string} row.name
 * @param {string|null} row.note
 * @param {string|number} row.target - NUMERIC as text
 * @param {string|number} row.allocated - NUMERIC as text
 * @param {string} row.desiredDate - YYYY-MM-DD on the owner's calendar
 * @param {number} row.sourceCount - distinct accounts the pocket draws on
 * @param {string} row.currency - lowercase code
 * @param {string} today - YYYY-MM-DD on the owner's calendar
 * @returns {Readonly<object>}
 */
export function makePocketStatus(
 { pocketId, name, note, target, allocated, desiredDate, sourceCount, currency },
 today,
) {
 if (!Number.isInteger(pocketId)) {
  throw new Error('PocketStatus: pocketId must be an integer');
 }

 if (typeof name !== 'string' || name.length === 0) {
  throw new Error('PocketStatus: name is required and must be a non-empty string');
 }

 if (typeof currency !== 'string' || currency !== currency.toLowerCase()) {
  throw new Error('PocketStatus: currency must be a lowercase code');
 }

 if (typeof today !== 'string' || today.length === 0) {
  throw new Error('PocketStatus: today is required and must be a YYYY-MM-DD label');
 }

 const targetAmount = money(target);
 const allocatedAmount = money(allocated);
 const remaining = targetAmount.minus(allocatedAmount);
 const daysRemaining = daysBetween(today, desiredDate);

 return Object.freeze({
  pocketId,
  name,
  // Nullable column. A missing note is null, never '' — an empty string is a
  // note the user wrote and then cleared, and the row would collapse it.
  note: note ?? null,
  target: toAmount(targetAmount),
  allocated: toAmount(allocatedAmount),
  // Negative when the pocket is over-funded, which is not an error: the goal
  // was passed, and the excess is the fact.
  remaining: toAmount(remaining),
  progress: toRate(allocatedAmount.dividedBy(targetAmount).times(HUNDRED)),
  desiredDate,
  daysRemaining,
  // Null after the date, not the remainder. $1,000 owed on a goal whose deadline
  // passed is not "$1,000 per month", and a figure under a label it does not
  // answer is worse than a figure withheld — the screen says the date passed and
  // prints the remainder beside it.
  requiredMonthly: computeRequiredMonthly(remaining, daysRemaining),
  funded: allocatedAmount.greaterThanOrEqualTo(targetAmount),
  overdue: daysRemaining < 0 && allocatedAmount.lessThan(targetAmount),
  sourceCount,
  currency,
 });
}
