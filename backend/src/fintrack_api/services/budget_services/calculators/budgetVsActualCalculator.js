// src/fintrack_api/services/budget_services/calculators/budgetVsActualCalculator.js

// Budget vs Actual Calculator – Pure financial metric calculator.
// Compares budget accumulated amount against actual spending for a period.
// Returns remaining budget, difference, and execution percentage.

import { getNumberOfPeriods } from '../../../../utils/fintrackUtils/date-utils/getNumberOfPeriods.js';

import { makeBudgetResult } from '../core/makeBudgetResult.js';
import { money } from '../core/money.js';

/**
 * Amount an allocation contributes to a window.
 *
 * The allocation is priced only over the slice of the window it was actually in
 * force for, and always with ITS OWN stored frequency. That frequency answers
 * "this budget recurs every N months"; the frequency in the request answers
 * "show me this date range". Using the request's — the previous behaviour —
 * meant a monthly budget of 10 read through a yearly window reported 10 instead
 * of 120, because the multiplier came from the window rather than from the
 * budget.
 *
 * Validity boundaries are used as stored. Every writer now anchors them to a
 * canonical period boundary, so the slices are already contiguous and
 * non-overlapping: no period is billed twice and none is skipped. Snapping them
 * here used to repair that, but it snapped to the MONTH whatever the frequency,
 * which was only ever right for one of the five.
 *
 * Whole periods only, per getNumberOfPeriods. A quarterly allocation covering
 * two months of the window contributes 0, not two thirds. Proration is a
 * product decision that has not been taken; inventing it here would put a
 * different number on screen than the one the user agreed to.
 */
const allocationContribution = (allocation, startDate, endDate) => {
  const effectiveStart = new Date(
    Math.max(startDate.getTime(), allocation.validFrom.getTime()),
  );
  const effectiveEnd = allocation.validUntil
    ? new Date(Math.min(endDate.getTime(), allocation.validUntil.getTime()))
    : endDate;

  if (effectiveEnd <= effectiveStart) {
    return money(0);
  }

  const periods = getNumberOfPeriods(
    allocation.budgetFrequencyCode,
    effectiveStart,
    effectiveEnd,
  );

  // A Decimal, not a number: contributions are summed and the sum is divided,
  // so rounding here would round once per allocation instead of once per result.
  return money(allocation.budgetAmount).times(periods);
};

/**
 * Calculate budget vs actual metrics for a given period.
 *
 * @param {Object} params
 * @param {number} [params.accountId] - Account the result belongs to
 * @param {Object} params.budgetPolicy - BudgetPolicy domain object (for context)
 * @param {Array<Object>} params.budgetAllocations - Allocations overlapping the window, oldest first. Each needs budgetAmount, budgetFrequencyCode, validFrom, validUntil
 * @param {Array<{date: Date, amount: number}>} [params.transactions] - Spending transactions (used if actualSpentOverride not provided)
 * @param {number} [params.actualSpentOverride] - Pre-calculated actual spent (signed, optional for optimization)
 * @param {Date} params.startDate - Period start (inclusive, UTC)
 * @param {Date} params.endDate - Period end (exclusive, UTC)
 * @param {string} params.currency - Currency code (e.g. 'USD')
 * @returns {Object} BudgetResult domain object with all metrics
 */
export function calculateBudgetVsActual({
  accountId = null,
  budgetPolicy,
  budgetAllocations,
  transactions = [],
  actualSpentOverride = null,
  startDate,
  endDate,
  currency,
}) {
  // Validations
  if (!Array.isArray(budgetAllocations) || budgetAllocations.length === 0) {
    throw new Error('budgetVsActualCalculator: budgetAllocations must be a non-empty array');
  }
  for (const allocation of budgetAllocations) {
    if (!allocation || typeof allocation !== 'object') {
      throw new Error('budgetVsActualCalculator: each allocation must be an object');
    }
    if (typeof allocation.budgetAmount !== 'number' || allocation.budgetAmount <= 0) {
      throw new Error('budgetVsActualCalculator: allocation budgetAmount must be a positive number');
    }
    if (!allocation.budgetFrequencyCode || typeof allocation.budgetFrequencyCode !== 'string') {
      throw new Error('budgetVsActualCalculator: allocation budgetFrequencyCode is required');
    }
    if (!(allocation.validFrom instanceof Date) || isNaN(allocation.validFrom.getTime())) {
      throw new Error('budgetVsActualCalculator: allocation validFrom must be a valid Date');
    }
  }
  if (!Array.isArray(transactions)) {
    throw new Error('budgetVsActualCalculator: transactions must be an array');
  }
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('budgetVsActualCalculator: startDate must be a valid Date');
  }
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('budgetVsActualCalculator: endDate must be a valid Date');
  }
  if (endDate <= startDate) {
    throw new Error('budgetVsActualCalculator: endDate must be after startDate');
  }
  if (!currency || typeof currency !== 'string') {
    throw new Error('budgetVsActualCalculator: currency is required');
  }

  // Calculate budgetAccumulatedAmount (positive)
  const budgetAccumulatedAmount = budgetAllocations.reduce(
    (total, allocation) => total.plus(allocationContribution(allocation, startDate, endDate)),
    money(0),
  );

  // The allocation in force at the end of the window. It is what the edit form
  // and the history link act on, so it is the one reported back.
  const currentAllocation = budgetAllocations[budgetAllocations.length - 1];

  // Calculate actual spent (signed, may be positive or negative)
  let actualSpent;
  if (actualSpentOverride !== null && actualSpentOverride !== undefined) {
    actualSpent = money(actualSpentOverride); // Already signed from DB
  } else {
    // Sum signed amounts (positive for expenses, negative for reversals)
    actualSpent = transactions.reduce((sum, t) => sum.plus(money(t.amount || 0)), money(0));
  }

  // Derived metrics. C-b7: the two difference fields are one metric under two
  // names; remainingBudget goes once the frontend stops reading it.
  const actualVsBudgetDifference = budgetAccumulatedAmount.minus(actualSpent);
  const remainingBudget = actualVsBudgetDifference;
  let executionPercentage = money(0);

  if (!budgetAccumulatedAmount.isZero()) {
    executionPercentage = actualSpent.dividedBy(budgetAccumulatedAmount).times(100);
  }

  // Build result using makeBudgetResult
  const result = makeBudgetResult({
    accountId,
    isBudgeted: true,
    currency,
    period: { start: startDate, end: endDate },
    budgetPolicy: budgetPolicy || null,
    budgetAllocation: currentAllocation,
    budgetAccumulatedAmount,
    actualSpent,
    remainingBudget,
    actualVsBudgetDifference,
    executionPercentage,
  });

  return result;
}
