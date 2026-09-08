// src/fintrack_api/services/overview_services/core/makeMonthlySnapshot.js

// MS1-MS4 of §8 — the widget that replaces MonthlyAverage.tsx.
//
// The denominator of MS2/MS3 is months WITH ACTIVITY, not months elapsed (D14).
// That is a product choice with no precedent in the industry, which is why the
// names carry `activeMonth` instead of `monthlyAverage`: the figure answers "how
// much do I need available in a month where this kind of movement happens", not
// "what is my average monthly burn". Diluting it with empty months would answer
// a different question and understate the reserve.
//
// Activity is decided by the month's transaction COUNT, never by its amount. A
// month where a deposit and an equal withdrawal cancel nets to zero and is still
// a month that happened; excluding it would quietly raise the average.
//
// The averages read the months BEFORE the reference one, never the reference
// month itself. The current month is usually still in progress, and averaging a
// partial month into the baseline it is about to be compared against would make
// MS4 shrink on its own as the month fills up.
//
// The window is rolling, which is the bug D14 fixes: the old fixed January-to-
// December window (dashboardMonthlyTotalAmountByType.js:43-47) restarted the
// average every January at a single month's total, with no memory of December.

import { money, toAmount } from '../../budget_services/core/money.js';

// D14 — one reactive figure and one stable one, not a window the user picks.
const REACTIVE_MONTHS = 3;
const STABLE_MONTHS = 12;

/**
 * The mean of the months that had activity, and how many of them there were.
 *
 * null and not 0 for the average: no active month in the window means the
 * question has no answer, and the frontend renders a dash. A 0 would claim the
 * user typically moves nothing, which is a different and false statement.
 *
 * The count is 0 rather than null in that same case, because it is not a
 * withheld figure: zero active months is the answer, and it is the denominator
 * the average would have been divided by. It is published because the widget
 * has to say what the average is an average OF - a figure over three active
 * months and one over three months of which one was active are the same number
 * and do not carry the same weight. MonthlyAverage.tsx already printed it, from
 * its own browser-side count.
 */
const activeMonthFigures = (months) => {
 const active = months.filter((entry) => entry.transactionCount > 0);

 if (active.length === 0) {
  return { average: null, activeMonths: 0 };
 }

 const total = active.reduce((sum, entry) => sum.plus(entry.totalAmount), money(0));

 return {
  average: toAmount(total.dividedBy(active.length)),
  activeMonths: active.length,
 };
};

/**
 * The calendar year to date of the reference month, inclusive.
 *
 * Read off the same thirteen-month series and not from a query of its own: a
 * window of thirteen months ending on the reference month always contains every
 * month of that month's calendar year, because a year to date is at most twelve.
 * So the figure needs no round trip and cannot disagree with the months above
 * it, which are the same entries summed over a different span.
 *
 * Every month of the year counts, active or not. This is a total and not a mean,
 * so it has no denominator to protect and an empty month contributes 0 to it
 * honestly. That is the opposite of the rule the averages follow, and the two
 * differ because the questions differ.
 *
 * Never null: the reference month is always in its own year, so there is always
 * at least one entry to sum.
 */
const calendarYearToDate = (months, referenceMonth) => {
 const year = referenceMonth.slice(0, 4);
 const inYear = months.filter((entry) => entry.month.startsWith(year));

 return toAmount(
  inYear.reduce((sum, entry) => sum.plus(entry.totalAmount), money(0)),
 );
};

/**
 * Build one frozen MonthlySnapshot.
 *
 * @param {object} input
 * @param {string} input.domain - 'income', 'expense' or 'pocket' (§8 defines it for these three)
 * @param {Array<{month: string, totalAmount: number, transactionCount: number}>} input.months -
 *   ascending, the reference month last, preceded by the twelve before it
 * @param {string} input.currency
 * @param {string[]} [input.notices]
 * @returns {object} frozen MonthlySnapshot
 */
export const makeMonthlySnapshot = ({ domain, months, currency, notices = [] }) => {
 const current = months[months.length - 1];
 const history = months.slice(0, -1);

 const reactive = activeMonthFigures(history.slice(-REACTIVE_MONTHS));
 const stable = activeMonthFigures(history.slice(-STABLE_MONTHS));

 return Object.freeze({
  domain,
  domainMonthlyActual: current.totalAmount,
  activeMonthAverage3m: reactive.average,
  activeMonths3m: reactive.activeMonths,
  // MS4 compares against the stable figure, not the reactive one. Measuring a
  // month against a number that already moves fast cannot tell you whether the
  // month is unusual — both would have moved together.
  activeMonthAverage12m: stable.average,
  activeMonths12m: stable.activeMonths,
  varianceVsAverage: stable.average === null
   ? null
   : toAmount(money(current.totalAmount).minus(stable.average)),
  // The reference month's calendar year, summed from the series above rather
  // than fetched. It is the second of the two figures MonthlyAverage.tsx renders
  // that this builder did not carry, and the reason that component still
  // recomputes everything in the browser off a separate request.
  yearToDate: calendarYearToDate(months, current.month),
  currency,
  meta: Object.freeze({
   notices: Object.freeze([...notices]),
   provenance: null,
  }),
 });
};
