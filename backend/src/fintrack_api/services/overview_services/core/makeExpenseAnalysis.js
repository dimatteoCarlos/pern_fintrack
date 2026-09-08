// src/fintrack_api/services/overview_services/core/makeExpenseAnalysis.js

// The level-2 section of the Expense domain, and it adds no statement at any
// level.
//
// Everything §4.2 asks for is already fetched. The thirteen-month series is the
// monthly rows over the window's long bound; the category ranking is published
// at level 1 already and follows the selected month, not the current one; and
// the budget variance per category is inside those same ranked rows —
// makeBudgetCategoryStatus emits budgetAmount, remainingBudget and isOverBudget,
// and makeCategoryBreakdown spreads them through. So this file publishes
// neither: republishing a ranked row under a second name is the duplication §7
// forbids, and the level-2 plan's own rule is that a figure level 1 publishes is
// read, never rebuilt.
//
// What is genuinely new is one decomposition, and it is the one figure level 1
// deliberately refused.

import { money, toAmount } from '../../budget_services/core/money.js';
import { makeTrendSeries } from './makeTrendSeries.js';

// Said when no budget module figure exists to split the month against — mixed
// currencies, or an owner with no category account at all. The pair is absent
// rather than reporting the whole month as uncategorised, which would be a
// statement about the owner's categories rather than about a missing figure.
export const NO_CATEGORIZATION_NOTICE =
 'Categorized spending is not reported for this period, so the month is not split against it.';

/**
 * Build the frozen expense analysis.
 *
 * The categorisation pair is the level-2 form of a refusal level 1 was right to
 * make. Level 1 publishes a boolean saying uncategorised spending exists and
 * refuses the amount, because the amount alone is one subtraction over two
 * published fields — a second total. The analysis here is not the amount, it is
 * the PAIR: two parts side by side that sum back to the month, which is a
 * decomposition and a level-2 shape.
 *
 * uncategorized is floored at nothing and clamped by nothing. It is computed as
 * the total minus the categorised part and can only be negative if a category
 * account were charged outside the expense set, which the account sets rule out
 * by construction; a clamp here would hide that rather than report it.
 *
 * @param {object} input
 * @param {string} input.level - the requested depth
 * @param {Array<{month: string, totalAmount: number}>} input.months - the long series
 * @param {number} input.totalAmount - E1, every expense leg of the period
 * @param {number|null} input.categorizedExpense - D16, null when there is no figure
 * @returns {object} frozen analysis section
 */
export const makeExpenseAnalysis = ({ level, months, totalAmount, categorizedExpense }) => {
 const notices = [];

 let categorization;
 if (categorizedExpense === null) {
  notices.push(NO_CATEGORIZATION_NOTICE);
 } else {
  categorization = Object.freeze({
   categorized: categorizedExpense,
   uncategorized: toAmount(money(totalAmount).minus(categorizedExpense)),
  });
 }

 return Object.freeze({
  domain: 'expense',
  level,
  series: Object.freeze(makeTrendSeries(months)),
  ...(categorization === undefined ? {} : { categorization }),
  meta: Object.freeze({ notices: Object.freeze(notices) }),
 });
};
