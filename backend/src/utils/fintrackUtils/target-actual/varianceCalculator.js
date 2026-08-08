// src/utils/fintrackUtils/target-actual/varianceCalculator.js
// 📝 CHANGE: New file

// Variance Calculator – Pure financial metric calculator.
// This module provides pure functions to calculate variance (budget deviation)
// between a target amount and an actual amount over a calendar period.
// It is reusable across financial domains: Budget, Pocket, Investments, etc.

import { MONTHS_PER_PERIOD } from '../../../fintrack_api/services/budget_services/core/budgetConfig.js';
import { makeBudgetAccountStatus } from '../../../fintrack_api/services/budget_services/core/makeBudgetAccountStatus.js';

// Internal helper to count how many complete periods fit in a date range.
// Returns 0 if the range is not a complete period (no prorating in V1).
function getNumberOfPeriods(frequency, startDate, endDate) {
  const monthsDiff = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
                     (endDate.getUTCMonth() - startDate.getUTCMonth());

  const monthsPerPeriod = MONTHS_PER_PERIOD[frequency];
  if (!monthsPerPeriod) {
    throw new Error(`varianceCalculator: unknown frequency "${frequency}"`);
  }

  // Number of complete periods that fit entirely within the range.
  // We don't prorate partial periods (rule #14).
  return Math.floor(monthsDiff / monthsPerPeriod);
}

// Public API

/**
 * Calculate financial metrics comparing a target (expected) against actual spending.
 *
 * "Variance" here is budget variance (not statistical variance). It measures the
 * percentage difference between what was budgeted (target) and what was actually spent.
 *
 * @param {Object} params - Calculation parameters
 * @param {Object} params.policy - BudgetPolicy domain object (included for context)
 * @param {Object} params.activeVersion - BudgetVersion domain object (must have budgetedAmount and frequency)
 * @param {Array<{date: Date, amount: number}>} params.transactions - Spending transactions in the period
 * @param {Date} params.startDate - Period start (inclusive, UTC)
 * @param {Date} params.endDate - Period end (exclusive, UTC)
 * @param {string} params.currency - Currency code (e.g. 'USD')
 * @returns {Object} BudgetAccountStatus domain object with all metrics
 * @throws {Error} If activeVersion is missing required fields or dates are invalid
 *
 * @example
 * const result = calculateVariance({
 *   policy: budgetPolicy,
 *   activeVersion: budgetVersion,
 *   transactions: [{ date: new Date('2026-07-15'), amount: 350 }],
 *   startDate: new Date('2026-07-01'),
 *   endDate: new Date('2026-08-01'),
 *   currency: 'USD'
 * });
 * // result.expected = 400
 * // result.actual = 350
 * // result.available = 50
 * // result.variance = 12.5
 * // result.executionPercentage = 87.5
 */
export function calculateVariance({
  policy,
  activeVersion,
  transactions,
  startDate,
  endDate,
  currency
}) {
  // ─── Validation ────────────────────────────────────────────────

  if (!activeVersion || typeof activeVersion !== 'object') {
    throw new Error('varianceCalculator: activeVersion is required');
  }
  if (typeof activeVersion.budgetedAmount !== 'number' || activeVersion.budgetedAmount <= 0) {
    throw new Error('varianceCalculator: activeVersion.budgetedAmount must be a positive number');
  }
  if (!activeVersion.frequency || typeof activeVersion.frequency !== 'string') {
    throw new Error('varianceCalculator: activeVersion.frequency is required');
  }
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('varianceCalculator: startDate must be a valid Date');
  }
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('varianceCalculator: endDate must be a valid Date');
  }
  if (endDate <= startDate) {
    throw new Error('varianceCalculator: endDate must be after startDate');
  }
  if (!currency || typeof currency !== 'string') {
    throw new Error('varianceCalculator: currency is required');
  }

  // ─── Calculate expected (target) ──────────────────────────────

  const { budgetedAmount, frequency } = activeVersion;
  const numberOfPeriods = getNumberOfPeriods(frequency, startDate, endDate);
  const expected = budgetedAmount * numberOfPeriods;

  // ─── Calculate actual ──────────────────────────────────────────

  const actual = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  // ─── Calculate derived metrics ────────────────────────────────

  const available = expected - actual;

  // Variance: percentage difference relative to expected.
  // Positive = favorable (spent less than budgeted).
  // Negative = unfavorable (spent more than budgeted).
  let variance = 0;
  let executionPercentage = 0;

  if (expected === 0) {
    variance = 0;
    executionPercentage = 0;
  } else {
    variance = ((expected - actual) / expected) * 100;
    executionPercentage = (actual / expected) * 100;
  }

  const budgetAccountStatus = makeBudgetAccountStatus({
    currency: currency,
    period: {
      start: startDate,
      end: endDate,
    },
    policyVersion: {
      versionId: activeVersion.versionId,
      policyId: activeVersion.policyId,
      budgetedAmount: activeVersion.budgetedAmount,
      frequency: activeVersion.frequency,
      validFrom: activeVersion.validFrom,
      validUntil: activeVersion.validUntil,
    },
    expected: expected,
    actual: actual,
    available: available,
    variance: variance,
    executionPercentage: executionPercentage,
  });

  return budgetAccountStatus;
}

/**
 * Convenience function to calculate variance for a single period.
 * Useful when you already have the period boundaries and just need metrics.
 *
 * @param {Object} params - Same as calculateVariance
 * @returns {Object} BudgetAccountStatus domain object
 */
export function calculateVarianceForPeriod(params) {
  return calculateVariance(params);
}