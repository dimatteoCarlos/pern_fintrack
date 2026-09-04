// backend/src/fintrack_api/services/pocket_services/core/planSchedule.js

// The plan's own line: what a pocket should hold by a given date, and how far
// the pace it now needs has drifted from the pace it set.
//
// This is a DIVISION OF STORED VALUES, not a projection and not an estimate. It
// reads the target, the deadline and the day the plan was made, and no history
// at all. That is what separates it from the achieved rate, which stays decided
// out (POCKET_DECISIONS.md §23.1): a rate over the ledger measures how often the
// owner changed their mind, not how fast money arrived.
//
// The line is STEP-WISE BY MONTH. A continuous line would climb every day, so
// the same pocket would read on track on the 2nd and behind on the 28th with no
// change in behaviour. Here the amount due moves only when a month closes, which
// is the boundary every other figure on the board now uses.

import { toAmount } from '../../budget_services/core/money.js';

/**
 * A month as a single integer, so month arithmetic is subtraction.
 *
 * Sliced from the text, never parsed into a Date: a date built from
 * 'YYYY-MM-DD' is UTC midnight, and reading it back through a local getter can
 * land in the previous month. Truncation has no zone to lose.
 */
const monthIndex = (isoDate) => {
 const year = Number(isoDate.slice(0, 4));
 const month = Number(isoDate.slice(5, 7));

 return year * 12 + month;
};

/**
 * The last day of a month, as a number.
 *
 * Day zero of the next month is the last day of this one. Built in UTC so the
 * node process's zone cannot move it.
 */
const lastDayOfMonth = (year, month) =>
 new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Whether a calendar date is the last day of its own month.
 */
const isMonthEnd = (isoDate) => {
 const year = Number(isoDate.slice(0, 4));
 const month = Number(isoDate.slice(5, 7));
 const day = Number(isoDate.slice(8, 10));

 return day === lastDayOfMonth(year, month);
};

/**
 * The close of a month, as a YYYY-MM-DD label, from its month index.
 *
 * The inverse of monthIndex: with months numbered 1..12, the year is the index
 * minus one divided by twelve, and the month is what the year leaves behind.
 */
const monthCloseLabel = (index) => {
 const year = Math.floor((index - 1) / 12);
 const month = index - year * 12;
 const day = lastDayOfMonth(year, month);

 return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * The plan's line for one pocket, at one evaluation date.
 *
 * @param {object} plan
 * @param {import('decimal.js').Decimal} plan.targetAmount
 * @param {import('decimal.js').Decimal} plan.allocatedAmount
 * @param {string} plan.planStart - YYYY-MM-DD, the day the plan was made
 * @param {string} plan.desiredDate - YYYY-MM-DD, the deadline
 * @param {number} plan.daysRemaining - from the evaluation date to the deadline
 * @param {string} evaluationDate - YYYY-MM-DD on the owner's calendar
 * @returns {{planInstalment: number|null, scheduledByNow: number|null, aheadOfPlan: number|null, paceRatio: number|null}}
 */
export function makePlanSchedule(
 { targetAmount, allocatedAmount, planStart, desiredDate, daysRemaining },
 evaluationDate,
) {
 const startMonth = monthIndex(planStart);
 const deadlineMonth = monthIndex(desiredDate);

 // The creation month does not count. A plan made on the 20th did not have that
 // month to fund, so its first instalment falls due at the close of the first
 // full month after it. Applied uniformly rather than only to plans made
 // mid-month: a rule that changed behaviour between the 1st and the 2nd would
 // put a discontinuity in the reading for no fact that justifies one.
 const planMonths = deadlineMonth - startMonth;

 // When the first instalment would fall due. The month after the creation month
 // closes on this date, and a deadline earlier than it means the plan expires
 // before it ever owed anything.
 const firstDueDate = monthCloseLabel(startMonth + 1);

 // A window holding no full calendar month publishes no line, so the pocket can
 // read neither behind nor at risk. The card says the plan has no window rather
 // than printing a pace built on nothing.
 //
 // Two shapes reach this: a deadline at or before the creation month, and a
 // plan made days before its own deadline — created on the 20th and due on the
 // 2nd of the next month crosses a month boundary but contains no full month,
 // so counting boundaries alone would hand it an instalment it never had a
 // month to pay. Both labels are YYYY-MM-DD, where lexicographic order is
 // chronological order.
 if (planMonths < 1 || firstDueDate > desiredDate) {
  return Object.freeze({
   planInstalment: null,
   scheduledByNow: null,
   aheadOfPlan: null,
   paceRatio: null,
  });
 }

 const instalment = targetAmount.dividedBy(planMonths);

 // The current month's instalment is not yet due. Inside September what is owed
 // is the instalments through August, so the last closed month is the previous
 // one unless the evaluation date is itself a month end — which is exactly what
 // a past month selected on the stepper resolves to.
 const lastClosedMonth = isMonthEnd(evaluationDate)
  ? monthIndex(evaluationDate)
  : monthIndex(evaluationDate) - 1;

 const dueMonths = Math.min(
  Math.max(lastClosedMonth - startMonth, 0),
  planMonths,
 );

 const scheduled = instalment.times(dueMonths);

 // Signed on purpose: positive is committed beyond the line, negative is short
 // of it. The screen states the direction in words; the payload states the
 // amount once, so no consumer derives the other half and disagrees.
 const aheadOfPlan = allocatedAmount.minus(scheduled);

 // The instalments still ahead. Floored at one: when every instalment has fallen
 // due and a remainder survives, the plan has one month or less to close it, and
 // dividing by zero there would lose exactly the case the ratio exists to catch.
 const instalmentsLeft = Math.max(planMonths - dueMonths, 1);

 const remainder = targetAmount.minus(allocatedAmount);

 return Object.freeze({
  planInstalment: toAmount(instalment),
  scheduledByNow: toAmount(scheduled),
  aheadOfPlan: toAmount(aheadOfPlan),
  // How many of the planned contributions would have to be found at once. The
  // discriminator between on track, behind and at risk, computed here rather
  // than on the client so the colour a screen paints and the pace it prints
  // cannot come from two divisions.
  //
  // Derived from the instalments left, NOT from requiredMonthly, and the
  // difference is load-bearing: that figure divides the remainder by days over
  // the mean length of a month, while the instalment divides the target by whole
  // calendar months. Two denominators that disagree would put a pocket sitting
  // exactly on its line at a ratio of 1.14 instead of 1. Both figures ship —
  // they answer different questions — but only one of them may set a level.
  //
  // Zero once the target is covered, and null once the deadline has passed:
  // those pockets are decided by a level above the ratio, and a number there
  // would answer a question nobody asked.
  paceRatio:
   daysRemaining < 0
    ? null
    : remainder.lessThanOrEqualTo(0)
     ? 0
     : remainder.dividedBy(instalmentsLeft).dividedBy(instalment).toDecimalPlaces(2).toNumber(),
 });
}
