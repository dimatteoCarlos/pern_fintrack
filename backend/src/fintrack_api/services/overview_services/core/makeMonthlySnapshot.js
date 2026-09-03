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
 * The mean of the months that had activity, or null if none did.
 *
 * null and not 0: no active month in the window means the question has no
 * answer, and the frontend renders a dash. A 0 would claim the user typically
 * moves nothing, which is a different and false statement.
 */
const activeMonthAverage = (months) => {
 const active = months.filter((entry) => entry.transactionCount > 0);

 if (active.length === 0) {
  return null;
 }

 const total = active.reduce((sum, entry) => sum.plus(entry.totalAmount), money(0));
 return toAmount(total.dividedBy(active.length));
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

 const activeMonthAverage3m = activeMonthAverage(history.slice(-REACTIVE_MONTHS));
 const activeMonthAverage12m = activeMonthAverage(history.slice(-STABLE_MONTHS));

 return Object.freeze({
  domain,
  domainMonthlyActual: current.totalAmount,
  activeMonthAverage3m,
  // MS4 compares against the stable figure, not the reactive one. Measuring a
  // month against a number that already moves fast cannot tell you whether the
  // month is unusual — both would have moved together.
  activeMonthAverage12m,
  varianceVsAverage: activeMonthAverage12m === null
   ? null
   : toAmount(money(current.totalAmount).minus(activeMonthAverage12m)),
  currency,
  meta: Object.freeze({
   notices: Object.freeze([...notices]),
   provenance: null,
  }),
 });
};
