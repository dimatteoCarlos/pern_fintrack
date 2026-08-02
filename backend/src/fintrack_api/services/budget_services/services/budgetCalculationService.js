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
 *
 * Notices are a list, and `meta` is always an object. A singular `notice` field
 * can only carry the first thing worth saying, so anything after it is dropped
 * silently. The caller reads meta.notices and iterates: no null check, and no
 * shape change the day a second notice appears.
 */
const resolveWindow = (windowFrequencyCode, referenceDate, options) => {
 if (options.startDate && options.endDate) {
  const normalized = normalizeDatesToMonths(options.startDate, options.endDate);
  return {
   startDate: normalized.start,
   endDate: normalized.end,
   notices: normalized.notice ? [normalized.notice] : [],
  };
 }

 const period = resolvePeriod(windowFrequencyCode, referenceDate);
 return { startDate: period.start, endDate: period.end, notices: [] };
};

/**
 * Result for an account with no budget figure to report for this window.
 *
 * Two different situations land here and the response keeps them apart through
 * isBudgeted:
 *
 * - No policy at all. The account is unbudgeted (PLAN_D §1.2): two states, not
 *   three, so there is no such thing as a null or zero budget.
 * - A policy whose allocations all fall outside the window. The account IS
 *   budgeted; a policy created in March simply says nothing about January.
 *   Reporting March's amount for a January window — what selecting only the
 *   active allocation used to do — invents a budget that never existed.
 *
 * actualSpent is reported in both cases. Money can be spent on a category with
 * no budget behind it, and hiding that would replace one lie with another. The
 * percentage stays 0 because there is no denominator.
 */
const makeNoBudgetResult = ({
 accountId,
 isBudgeted,
 budgetPolicy,
 currency,
 actualSpent,
 startDate,
 endDate,
}) =>
 makeBudgetResult({
  accountId,
  isBudgeted,
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
 const currency = getCurrencyCodeSync(entry.currencyId);
 const isBudgeted = entry.budgetPolicyId !== null;

 if (!isBudgeted) {
  return makeNoBudgetResult({
   accountId: entry.accountId,
   isBudgeted: false,
   budgetPolicy: null,
   currency,
   actualSpent: entry.actualSpent,
   startDate,
   endDate,
  });
 }

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

 if (entry.allocations.length === 0) {
  return makeNoBudgetResult({
   accountId: entry.accountId,
   isBudgeted: true,
   budgetPolicy,
   currency,
   actualSpent: entry.actualSpent,
   startDate,
   endDate,
  });
 }

 return calculateBudgetVsActual({
  accountId: entry.accountId,
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
    const { startDate, endDate, notices } = resolveWindow(
      windowFrequencyCode,
      referenceDate,
      options,
    );

    const entries = await getBudgetDataForAccounts(pool, [accountId], startDate, endDate);

    // An owned category_budget account always produces an entry now, budgeted
    // or not, so this no longer fires for an account the user simply has not
    // budgeted. What is left is a genuine inconsistency: an id that passed the
    // caller's ownership check but has no category_budget_accounts row.
    if (entries.length === 0) {
      throw new Error(`budgetCalculationService: no budget account found for id ${accountId}`);
    }

    return {
      result: buildResult(entries[0], startDate, endDate),
      meta: { notices },
    };
  },

  /**
   * Get budget summaries for multiple accounts.
   */
  async getMultiSummary(pool, accountIds, windowFrequencyCode, referenceDate, options = {}) {
    if (!accountIds || accountIds.length === 0) {
      return { results: [], meta: { notices: [] } };
    }

    const { startDate, endDate, notices } = resolveWindow(
      windowFrequencyCode,
      referenceDate,
      options,
    );

    const entries = await getBudgetDataForAccounts(pool, accountIds, startDate, endDate);

    return {
      results: entries.map((entry) => buildResult(entry, startDate, endDate)),
      meta: { notices },
    };
  },
};
