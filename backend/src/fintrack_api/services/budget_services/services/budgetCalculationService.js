// src/fintrack_api/services/budget_services/services/budgetCalculationService.js

// Budget Calculation Service – Read operations for budget summaries.
// Orchestrates data fetching, period resolution, and metric calculation.
// Optimized to use a single query per request (getBudgetDataForAccounts).
// Currency is obtained from in-memory catalog (no DB queries).
// Date normalization moved to dateNormalizer.js.

import { resolvePeriod } from '../../../utils/fintrackUtils/date-utils/periodResolver.js';
import { normalizeDatesToMonths } from '../../../utils/fintrackUtils/date-utils/dateNormalizer.js';
import { getBudgetDataForAccounts } from '../db/budgetTransactionRepository.js';
import { calculateBudgetVsActual } from '../calculators/budgetVsActualCalculator.js';
import { getCurrencyCodeSync } from '../../../utils/currencyLookup.js';

/**
 * Budget calculation service – read operations.
 * All functions receive a PostgreSQL connection pool as first argument.
 */
export const budgetCalculationService = {
 /**
  * Get budget summary for a single account.
  * Optimized: uses getBudgetDataForAccounts with a single account ID.
  */
  async getSummary(pool, accountId, frequencyCode, referenceDate, options = {}) {
    let startDate, endDate, metaNotice = null;

    if (options.startDate && options.endDate) {
      const normalized = normalizeDatesToMonths(options.startDate, options.endDate);
      startDate = normalized.start;
      endDate = normalized.end;
      metaNotice = normalized.notice;
    } else {
      const period = resolvePeriod(frequencyCode, referenceDate);
      startDate = period.start;
      endDate = period.end;
    }

    const rows = await getBudgetDataForAccounts(pool, [accountId], startDate, endDate);
    if (rows.length === 0) {
      throw new Error(`budgetCalculationService: no budget data found for account ${accountId}`);
    }
    const row = rows[0];

    const budgetPolicy = {
      budgetPolicyId: row.budgetPolicyId,
      accountId: row.accountId,
      budgetFrequencyTypeId: row.budgetFrequencyTypeId,
      createdAt: null,
      updatedAt: null,
    };

    const budgetAllocation = {
      budgetAllocationId: row.budgetAllocationId,
      budgetPolicyId: row.budgetPolicyId,
      budgetAmount: row.budgetAmount,
      budgetFrequencyTypeId: row.budgetFrequencyTypeId,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      createdAt: null,
    };

    const currencyCode = getCurrencyCodeSync(row.currencyId);

    const result = calculateBudgetVsActual({
      budgetPolicy,
      budgetAllocation,
      frequencyCode,
      actualSpentOverride: row.actualSpent,
      startDate,
      endDate,
      currency: currencyCode,
    });

    return {
      result,
      meta: metaNotice ? { notice: metaNotice } : null,
    };
  },

  /**
   * Get budget summaries for multiple accounts (optimized).
   * Uses a single optimized query (getBudgetDataForAccounts).
   */
  async getMultiSummary(pool, accountIds, frequencyCode, referenceDate, options = {}) {
    if (!accountIds || accountIds.length === 0) {
      return { results: [], meta: null };
    }

    let startDate, endDate, metaNotice = null;

    if (options.startDate && options.endDate) {
      const normalized = normalizeDatesToMonths(options.startDate, options.endDate);
      startDate = normalized.start;
      endDate = normalized.end;
      metaNotice = normalized.notice;
    } else {
      const period = resolvePeriod(frequencyCode, referenceDate);
      startDate = period.start;
      endDate = period.end;
    }

    const rows = await getBudgetDataForAccounts(pool, accountIds, startDate, endDate);

    if (rows.length === 0) {
      return { results: [], meta: null };
    }

    const results = [];
    for (const row of rows) {
      const budgetPolicy = {
        budgetPolicyId: row.budgetPolicyId,
        accountId: row.accountId,
        budgetFrequencyTypeId: row.budgetFrequencyTypeId,
        createdAt: null,
        updatedAt: null,
      };

      const budgetAllocation = {
        budgetAllocationId: row.budgetAllocationId,
        budgetPolicyId: row.budgetPolicyId,
        budgetAmount: row.budgetAmount,
        budgetFrequencyTypeId: row.budgetFrequencyTypeId,
        validFrom: row.validFrom,
        validUntil: row.validUntil,
        createdAt: null,
      };

      const currencyCode = getCurrencyCodeSync(row.currencyId);

      const result = calculateBudgetVsActual({
        budgetPolicy,
        budgetAllocation,
        frequencyCode,
        actualSpentOverride: row.actualSpent,
        startDate,
        endDate,
        currency: currencyCode,
      });

      results.push(result);
    }

    return {
      results,
      meta: metaNotice ? { notice: metaNotice } : null,
    };
  },
};