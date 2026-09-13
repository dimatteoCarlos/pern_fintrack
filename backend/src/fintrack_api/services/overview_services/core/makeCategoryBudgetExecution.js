// src/fintrack_api/services/overview_services/core/makeCategoryBudgetExecution.js

// The execution rate the expense Pareto prints beside its chart: categorized
// spending over the budget of the same categories (owner decision 2026-09-13).
// It is not the card's execution, which divides TOTAL spend and so includes the
// uncategorized part.

import { money, toAmount, toRate } from '../../budget_services/core/money.js';

/**
 * Read the month's execution off the ranked breakdown's last running figures, so
 * the rate and the chart head cannot disagree.
 *
 * @param {object[]} categories - makeCategoryBreakdown output, spend order
 * @returns {{spentAmount: number, budgetAmount: number, executionPercentage: number|null,
 *   remainingBudget: number, isOverBudget: boolean}|null} null with no category
 */
export const makeCategoryBudgetExecution = (categories) => {
 if (categories.length === 0) return null;

 const last = categories[categories.length - 1];
 const spent = money(last.cumulativeActual);
 const budget = money(last.cumulativeBudget);

 return {
  spentAmount: toAmount(spent),
  budgetAmount: toAmount(budget),
  // No budget has no rate: a division by zero is not a percentage.
  executionPercentage: budget.isZero() ? null : toRate(spent.dividedBy(budget).times(100)),
  // Negative when overspent, by the amount of the overrun.
  remainingBudget: toAmount(budget.minus(spent)),
  isOverBudget: !budget.isZero() && spent.greaterThan(budget),
 };
};
