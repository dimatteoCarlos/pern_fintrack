// src/fintrack_api/services/budget_services/calculators/budgetVsActualCalculator.js

// Budget vs Actual Calculator – Pure financial metric calculator.
// Compares budget accumulated amount against actual spending for a period.
// Returns remaining budget, difference, and execution percentage.

import { getNumberOfPeriods } from '../../../../utils/fintrackUtils/date-utils/getNumberOfPeriods.js';

import { makeBudgetResult } from '../core/makeBudgetResult.js';

/**
 * Calculate budget vs actual metrics for a given period.
 *
 * @param {Object} params
 * @param {Object} params.budgetPolicy - BudgetPolicy domain object (for context)
 * @param {Object} params.budgetAllocation - BudgetAllocation domain object (must have budgetAmount and budgetFrequencyTypeId)
 * @param {string} params.frequencyCode - Frequency code (e.g. 'monthly', 'quarterly')
 * @param {Array<{date: Date, amount: number}>} [params.transactions] - Spending transactions (used if actualSpentOverride not provided)
 * @param {number} [params.actualSpentOverride] - Pre-calculated actual spent (signed, optional for optimization)
 * @param {Date} params.startDate - Period start (inclusive, UTC)
 * @param {Date} params.endDate - Period end (exclusive, UTC)
 * @param {string} params.currency - Currency code (e.g. 'USD')
 * @returns {Object} BudgetResult domain object with all metrics
 */
export function calculateBudgetVsActual({
  budgetPolicy,
  budgetAllocation,
  frequencyCode,
  transactions = [],
  actualSpentOverride = null,
  startDate,
  endDate,
  currency,
}) {
  // Validations
  if (!budgetAllocation || typeof budgetAllocation !== 'object') {
    throw new Error('budgetVsActualCalculator: budgetAllocation is required');
  }
  if (typeof budgetAllocation.budgetAmount !== 'number' || budgetAllocation.budgetAmount <= 0) {
    throw new Error('budgetVsActualCalculator: budgetAllocation.budgetAmount must be a positive number');
  }
  if (!frequencyCode || typeof frequencyCode !== 'string') {
    throw new Error('budgetVsActualCalculator: frequencyCode is required');
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
  const numberOfPeriods = getNumberOfPeriods(frequencyCode, startDate, endDate);
  const budgetAccumulatedAmount = budgetAllocation.budgetAmount * numberOfPeriods;

  // Calculate actual spent (signed, may be positive or negative)
  let actualSpent;
  if (actualSpentOverride !== null && actualSpentOverride !== undefined) {
    actualSpent = actualSpentOverride; // Already signed from DB
  } else {
    // Sum signed amounts (positive for expenses, negative for reversals)
    actualSpent = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  // Derived metrics
  const remainingBudget = budgetAccumulatedAmount - actualSpent;
  const actualVsBudgetDifference = budgetAccumulatedAmount - actualSpent;
  let executionPercentage = 0;

  if (budgetAccumulatedAmount !== 0) {
    executionPercentage = (actualSpent / budgetAccumulatedAmount) * 100;
  }

  // Build result using makeBudgetResult
  const result = makeBudgetResult({
    currency,
    period: { start: startDate, end: endDate },
    budgetPolicy: budgetPolicy || null,
    budgetAllocation,
    budgetAccumulatedAmount,
    actualSpent,
    remainingBudget,
    actualVsBudgetDifference,
    executionPercentage,
  });

  return result;
}