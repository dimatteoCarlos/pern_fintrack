// src/fintrack_api/services/overview_services/core/monthArithmetic.js

// Month arithmetic on 'YYYY-MM-01' text, never through Date.
//
// A Date would reintroduce the zone §4.5 removed from the queries: constructing
// one from 'YYYY-MM-01' parses as UTC midnight, and reading it back through any
// local getter can land on the previous month. Counting months as integers has
// no zone to lose and no daylight saving to survive.
//
// This mirrors the private helper in budgetCalculationService.js:95-105 on
// purpose. It is not imported from there because D6 freezes budget_services:
// exporting a module-private const to serve Overview would open that contract,
// which is the one thing the decision forbids. The duplication is 10 lines of
// integer arithmetic with no figure in it — nothing that can disagree with the
// budget module about a number.

/**
 * A month as a count of months since year 0, so shifting is addition.
 *
 * @param {string} month - 'YYYY-MM-01'
 * @returns {number}
 */
const monthIndex = (month) => {
 const [year, index] = month.split('-').map(Number);
 return year * 12 + (index - 1);
};

/**
 * The month `delta` months away from `month`.
 *
 * @param {string} month - 'YYYY-MM-01'
 * @param {number} delta - months to add; negative goes back
 * @returns {string} 'YYYY-MM-01'
 */
export const shiftMonths = (month, delta) => {
 const total = monthIndex(month) + delta;
 const year = Math.floor(total / 12);
 const index = total % 12;
 return `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}-01`;
};

/**
 * The last calendar day of a month, as text.
 *
 * The Date is built and read entirely in UTC and never meets an instant: day 0
 * of the following month IS the last day of this one. That is why it cannot
 * shift a day the way a local getter over a UTC-parsed date does — the same
 * reason getTransactionsForAccountById.js:21-27 builds its labels this way.
 *
 * @param {string} month - 'YYYY-MM-01'
 * @returns {string} 'YYYY-MM-DD'
 */
export const monthEndDate = (month) => {
 const [year, index] = month.split('-').map(Number);
 return new Date(Date.UTC(year, index, 0)).toISOString().split('T')[0];
};

// D18 — six points, the window the developer chose. Not MS2's three, too short
// to read a direction from, and not MS3's twelve, sized for a statistical
// stability a visual series does not need.
export const TREND_MONTHS = 6;

/**
 * The window every domain calculator reads from, derived once.
 *
 * A calculator that shifted these itself would be free to disagree with the
 * next one about how far back a trend reaches or which month a delta compares
 * against — two answers to a question the contract asks once. The window is
 * resolved where the request is, and travels down.
 *
 * A domain that publishes no trend still gets trendStart: the delta needs the
 * prior month in the same series as the reference one, and a series long enough
 * for six points is no more expensive to fetch than one long enough for two.
 *
 * periodEnd is the REFERENCE DATE and not the last day of the month. A closed
 * month has them equal; a running one does not, and publishing the month end
 * for a running month states that a flow covers days that have not happened.
 * The contract puts it as an obligation rather than a preference: a figure that
 * silently treats the running month as a whole one is not early, it is wrong.
 *
 * Two clocks reach this function and only one of them decides anything. The
 * month comes from the database, as every other month in this module does; the
 * day only refines a position inside a month already chosen, and it is clamped
 * to that month's last day. So a disagreement between the two clocks — process
 * skew, or a request that straddles midnight on the last day of a month — can
 * cost a day at the edge and can never report a date outside the month served.
 *
 * @param {string} referenceMonth - 'YYYY-MM-01', already checked against the ceiling
 * @param {string} currentMonth - 'YYYY-MM-01' on the owner's calendar, from the database
 * @param {string} today - 'YYYY-MM-DD' on the owner's calendar
 * @returns {{referenceMonth: string, priorMonth: string, trendStart: string,
 *   periodStart: string, periodEnd: string, isCurrentMonth: boolean}}
 */
export const makeReportingWindow = (referenceMonth, currentMonth, today) => {
 if (!currentMonth || !today) {
  throw new Error(
   `makeReportingWindow needs the owner's current month and day, received: ${currentMonth}, ${today}`,
  );
 }

 const monthEnd = monthEndDate(referenceMonth);
 const isCurrentMonth = referenceMonth === currentMonth;

 return Object.freeze({
  referenceMonth,
  priorMonth: shiftMonths(referenceMonth, -1),
  trendStart: shiftMonths(referenceMonth, -(TREND_MONTHS - 1)),
  periodStart: referenceMonth,
  periodEnd: isCurrentMonth && today < monthEnd ? today : monthEnd,
  isCurrentMonth,
 });
};

/**
 * The part of the window a response publishes.
 *
 * The trend bounds stay inside: a client reading a series gets the month on
 * every point of it, so priorMonth and trendStart would be the same months
 * under a second name. What a client cannot derive is which month it was served
 * when it named none, and where inside that month the figures stop.
 *
 * One definition for both endpoints. Two handlers each picking their own fields
 * would be two answers to "what period is this", which is the question the
 * whole window exists to answer once.
 *
 * @param {object} window - a window from makeReportingWindow
 * @returns {{referenceMonth: string, periodStart: string, periodEnd: string,
 *   isCurrentMonth: boolean}}
 */
export const servedWindow = ({ referenceMonth, periodStart, periodEnd, isCurrentMonth }) =>
 Object.freeze({ referenceMonth, periodStart, periodEnd, isCurrentMonth });
