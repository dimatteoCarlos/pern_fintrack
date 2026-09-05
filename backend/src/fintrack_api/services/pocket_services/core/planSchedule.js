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
// The line is CONTINUOUS IN DAYS: the target spread evenly across the days from
// the day the plan was made to its deadline, and read at the evaluation date.
// It replaced a line that stepped once per calendar month (ruled 2026-09-04,
// §28). Three things the step-wise line could not do, and this one does:
//
//  * A plan made and due inside one month has a line. The old rule needed a full
//    calendar month to exist and withheld all four fields otherwise, so the
//    commitment an owner made for THIS month measured against nothing.
//  * A plan made on the 30th is not billed for the whole month it barely saw.
//    Under a monthly step it owed a full instalment on day one and two of them
//    on day two.
//  * The line stops jumping on the 1st. An owner who contributes on the 5th read
//    as behind from the 1st to the 5th of every month, having changed nothing.
//
// It also removes a disagreement the old shape had to warn about. The forward
// pace divides the remainder by days, while the old line divided the target by
// whole months, so two denominators described one plan and a pocket sitting
// exactly on its line rated 1.14 instead of 1. Both now speak in days, and the
// ratio below is the required pace over the plan's own pace, with the mean
// month cancelling out of it entirely.

import { toAmount, money } from '../../budget_services/core/money.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// The mean length of a Gregorian month in days. The stored plan speaks in days;
// this is only the unit the monthly figures are PRESENTED in, and 30 would
// overstate a pace by half a percent every month.
export const DAYS_PER_MONTH = 30.44;

/**
 * Whole days between two calendar dates, both YYYY-MM-DD on the owner's clock.
 *
 * Parsed as UTC on purpose: both labels are read at the same offset, so the
 * offset cancels and the difference is the count of calendar days between them
 * rather than a duration that a daylight-saving hour could round the wrong way.
 *
 * Exported and consumed by makePocketStatus, which owned it before the line
 * moved to days. One copy, because two copies of date arithmetic is how a board
 * and a card come to disagree about how many days are left.
 */
export const daysBetween = (fromDate, toDate) =>
 Math.round(
  (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) /
   MILLISECONDS_PER_DAY,
 );

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
 const planDays = daysBetween(planStart, desiredDate);

 // A plan with no duration publishes no line, so the pocket reads neither behind
 // nor at risk and the card says the plan has no window. Only one shape reaches
 // this now — a deadline on or before the day the plan was made — where the old
 // month-based rule also withheld every plan shorter than a full calendar month.
 if (planDays <= 0) {
  return Object.freeze({
   planInstalment: null,
   scheduledByNow: null,
   aheadOfPlan: null,
   paceRatio: null,
  });
 }

 const dailyRate = targetAmount.dividedBy(planDays);

 // Clamped at both ends. The upper bound is what stops a plan past its deadline
 // from being asked for more than its target; the lower one guards a board read
 // at a month that closed before the plan existed, which the repository already
 // filters but which must not produce a negative line if it ever arrives.
 const elapsedDays = Math.min(
  Math.max(daysBetween(planStart, evaluationDate), 0),
  planDays,
 );

 const scheduled = dailyRate.times(elapsedDays);

 // Signed on purpose: positive is committed beyond the line, negative is short
 // of it. The screen states the direction in words; the payload states the
 // amount once, so no consumer derives the other half and disagrees.
 const aheadOfPlan = allocatedAmount.minus(scheduled);

 const remainder = targetAmount.minus(allocatedAmount);

 // Floored at one day: when the deadline is today and a remainder survives, the
 // plan has a day or less to close it, and dividing by zero there would lose
 // exactly the case the ratio exists to catch.
 const daysLeft = Math.max(daysRemaining, 1);

 return Object.freeze({
  // What the plan asks for per month, which is the unit an owner thinks in even
  // though the line itself is daily. Derived from the same daily rate the line
  // uses, so the two cannot disagree.
  planInstalment: toAmount(dailyRate.times(DAYS_PER_MONTH)),
  scheduledByNow: toAmount(scheduled),
  aheadOfPlan: toAmount(aheadOfPlan),
  // The pace now required over the pace the plan set. The discriminator between
  // on track, behind and at risk, computed here rather than on the client so the
  // colour a screen paints and the pace it prints cannot come from two divisions.
  //
  // One at exactly the plan's pace, above one for a plan needing to accelerate.
  // Both operands are daily rates taken from the same figures, so the mean month
  // cancels: this ratio is also requiredMonthly over planInstalment, and those
  // two served figures now agree by construction rather than by warning.
  //
  // Zero once the target is covered, and null once the deadline has passed:
  // those pockets are decided by a level above the ratio, and a number there
  // would answer a question nobody asked.
  paceRatio:
   daysRemaining < 0
    ? null
    : remainder.lessThanOrEqualTo(0)
     ? 0
     : remainder
        .dividedBy(money(daysLeft))
        .dividedBy(dailyRate)
        .toDecimalPlaces(2)
        .toNumber(),
 });
}
