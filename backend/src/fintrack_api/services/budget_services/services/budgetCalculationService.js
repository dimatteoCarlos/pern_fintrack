// src/fintrack_api/services/budget_services/services/budgetCalculationService.js

// Budget Calculation Service – Read operations for budget summaries.
// Orchestrates data fetching, period resolution, and metric calculation.
// Currency is obtained from in-memory catalog (no DB queries).
// Date normalization moved to dateNormalizer.js.
//
// The word "frequency" names two different things and conflating them was a
// defect. The frequency in the REQUEST resolves the query window: which date
// range to look at. The frequency stored on each ALLOCATION is the multiplier:
// how often that budget recurs. Only the second one may reach the arithmetic,
// which is why it never leaves the calculator's parameters here.

import { resolvePeriod } from '../../../../utils/fintrackUtils/date-utils/periodResolver.js';
import { normalizeDatesToMonths } from '../../../../utils/fintrackUtils/date-utils/dateNormalizer.js';
import { getBudgetDataForAccounts } from '../db/budgetTransactionRepository.js';
import { calculateBudgetVsActual } from '../calculators/budgetVsActualCalculator.js';
import { makeBudgetResult } from '../core/makeBudgetResult.js';
import { getCurrencyCodeSync } from '../../../../utils/currencyLookup.js';

/**
 * Resolve the window to report on.
 *
 * Explicit dates win and are snapped to calendar months; otherwise the window
 * is the calendar period the reference date falls in, sized by the requested
 * frequency.
 */
const resolveWindow = (windowFrequencyCode, referenceDate, options) => {
 if (options.startDate && options.endDate) {
  const normalized = normalizeDatesToMonths(options.startDate, options.endDate);
  return { startDate: normalized.start, endDate: normalized.end, notice: normalized.notice };
 }

 const period = resolvePeriod(windowFrequencyCode, referenceDate);
 return { startDate: period.start, endDate: period.end, notice: null };
};

/**
 * Result for an account that has no budget in force during the window.
 *
 * A policy created in March says nothing about January. Reporting March's
 * amount for a January window — what selecting only the active allocation did —
 * invents a budget that never existed. A zero accumulated amount with a null
 * allocation states the truth: nothing was budgeted for this range.
 *
 * actualSpent is still reported. Money can be spent on a category with no
 * budget behind it, and hiding that would be a second lie in place of the
 * first. The percentage stays 0 because there is no denominator.
 */
const makeNoBudgetResult = ({ budgetPolicy, currency, actualSpent, startDate, endDate }) =>
 makeBudgetResult({
  currency,
  period: { start: startDate, end: endDate },
  budgetPolicy: budgetPolicy ?? null,
  budgetAllocation: null,
  budgetAccumulatedAmount: 0,
  actualSpent,
  remainingBudget: -actualSpent,
  actualVsBudgetDifference: -actualSpent,
  executionPercentage: 0,
 });

/**
 * Turn one repository entry into a BudgetResult.
 */
const buildResult = (entry, startDate, endDate) => {
 const budgetPolicy = {
  budgetPolicyId: entry.budgetPolicyId,
  accountId: entry.accountId,
  budgetFrequencyTypeId:
   entry.allocations.length > 0
    ? entry.allocations[entry.allocations.length - 1].budgetFrequencyTypeId
    : null,
  createdAt: null,
  updatedAt: null,
 };

 const currency = getCurrencyCodeSync(entry.currencyId);

 if (entry.allocations.length === 0) {
  return makeNoBudgetResult({
   budgetPolicy,
   currency,
   actualSpent: entry.actualSpent,
   startDate,
   endDate,
  });
 }

 return calculateBudgetVsActual({
  budgetPolicy,
  budgetAllocations: entry.allocations,
  actualSpentOverride: entry.actualSpent,
  startDate,
  endDate,
  currency,
 });
};

/**
 * Budget calculation service – read operations.
 * All functions receive a PostgreSQL connection pool as first argument.
 */
export const budgetCalculationService = {
 /**
  * Get budget summary for a single account.
  */
  async getSummary(pool, accountId, windowFrequencyCode, referenceDate, options = {}) {
    const { startDate, endDate, notice } = resolveWindow(
      windowFrequencyCode,
      referenceDate,
      options,
    );

    const entries = await getBudgetDataForAccounts(pool, [accountId], startDate, endDate);
    if (entries.length === 0) {
      throw new Error(`budgetCalculationService: no budget data found for account ${accountId}`);
    }

    return {
      result: buildResult(entries[0], startDate, endDate),
      meta: notice ? { notice } : null,
    };
  },

  /**
   * Get budget summaries for multiple accounts.
   */
  async getMultiSummary(pool, accountIds, windowFrequencyCode, referenceDate, options = {}) {
    if (!accountIds || accountIds.length === 0) {
      return { results: [], meta: null };
    }

    const { startDate, endDate, notice } = resolveWindow(
      windowFrequencyCode,
      referenceDate,
      options,
    );

    const entries = await getBudgetDataForAccounts(pool, accountIds, startDate, endDate);

    return {
      results: entries.map((entry) => buildResult(entry, startDate, endDate)),
      meta: notice ? { notice } : null,
    };
  },
};
