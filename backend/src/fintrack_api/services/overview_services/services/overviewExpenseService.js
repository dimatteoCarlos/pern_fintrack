// src/fintrack_api/services/overview_services/services/overviewExpenseService.js

// The Expense domain calculator behind GET /overview/expense.
//
// It answers four questions with one round of queries: what was spent this
// period (E1-E3 plus D16), how it moved over six months (D18), how it splits by
// category (D19), and which rows are behind it. They are four readings of the
// same window, so they are one request — the same rule that made the budget
// drill-down one endpoint instead of three.
//
// The budget figures are not recomputed here. budgetCalculationService is called
// whole and its output is read: categories arrive already folded by the private
// makeCategoryGroups, and totals.budgetAmount / totals.actualSpent are the same
// figures the budget screen shows. Rebuilding any of them would be a second
// formula for a figure that already has one (§4.2), and reaching into that
// module for its private helpers would open the contract D6 freezes.

import { budgetCalculationService } from '../../budget_services/services/budgetCalculationService.js';
import {
 getExpenseAccountIds,
 getOldestAccountDate,
} from '../db/overviewAccountRepository.js';
import { getMonthlyExpense } from '../db/overviewMonthlyRepository.js';
import { getExpenseTransactionsPage } from '../db/overviewTransactionRepository.js';
import {
 makePeriodDelta,
 NO_PRIOR_PERIOD_NOTICE,
} from '../core/makeDomainCard.js';
import { makeExpenseCard, NO_BUDGET_NOTICE } from '../core/makeExpenseCard.js';
import { makeTrendSeries } from '../core/makeTrendSeries.js';
import { makeCategoryBreakdown } from '../core/makeCategoryBreakdown.js';
import { monthEndDate } from '../core/monthArithmetic.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

export const overviewExpenseService = {
 /**
  * Everything GET /overview/expense returns, for one month and one page.
  *
  * The window arrives resolved. The month ceiling is a relationship with the
  * owner's calendar, so it is checked once where the request is rather than
  * inside each calculator — otherwise six domains would each hold their own
  * copy of the same rule.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { window, page, pageSize }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'expense'
  */
 async getExpenseDomainData(pool, userId, { window, page, pageSize }, timeZone = 'UTC') {
  const { referenceMonth, priorMonth, trendStart } = window;

  // The id set every figure on this page is computed over, deleted categories
  // included (D19). Read once and passed to all three consumers: if categories
  // and totalAmount were built over two different sets, the array would not sum
  // to the card and the same screen would show two figures that must reconcile.
  const accountIds = await getExpenseAccountIds(pool, userId);

  const [months, oldestAccountDate, transactions, budgetStatus] = await Promise.all([
   getMonthlyExpense(pool, accountIds, trendStart, referenceMonth, timeZone),
   getOldestAccountDate(pool, userId, timeZone),
   getExpenseTransactionsPage(pool, accountIds, referenceMonth, timeZone, { page, pageSize }),
   budgetCalculationService.getBudgetAccountsStatus(pool, accountIds, timeZone, referenceMonth),
  ]);

  // The reference month is the last point of the same series the chart draws, so
  // the card and the chart cannot disagree about it (§4.2). generate_series
  // guarantees the row exists even when nothing happened in it.
  const { currentPoint, delta, canCompare } = makePeriodDelta({
   months,
   referenceMonth,
   priorMonth,
   oldestAccountDate,
  });

  // "No budget in force" is not "a budget of 0". makeTotals sums to 0 in both
  // cases — no allocation anywhere, and allocations that are all zero — so the
  // distinction has to be read off the account rows, which keep it.
  const hasBudgetInForce = budgetStatus.accounts.some((account) => account.budgetAmount > 0);
  const isMixedCurrency = budgetStatus.totals.budgetAmount === null;

  const notices = [...budgetStatus.meta.notices];
  if (!canCompare) notices.push(NO_PRIOR_PERIOD_NOTICE);
  // Not raised when the currencies are mixed: budgetCalculationService already
  // said so, and two notices for one absent figure would read as two problems.
  if (!isMixedCurrency && !hasBudgetInForce) notices.push(NO_BUDGET_NOTICE);

  const card = makeExpenseCard({
   totalAmount: currentPoint.totalAmount,
   transactionCount: currentPoint.transactionCount,
   delta,
   budgetAmount: isMixedCurrency || !hasBudgetInForce ? null : budgetStatus.totals.budgetAmount,
   // Spending is reported whether or not a budget exists: the two answer
   // different questions, and blanking this one alongside budgetAmount would
   // hide real spending behind a missing decision.
   categorizedExpense: budgetStatus.totals.actualSpent,
   // The accounts' own currency when they agree on one. The fallback is the
   // installation's accounting currency, which is what the amounts are stored
   // in — reached only when the user has no category account at all, or when
   // they span currencies and the notice above already says so.
   currency: budgetStatus.totals.currency ?? ACCOUNTING_CURRENCY_CODE,
   window: {
    periodStart: referenceMonth,
    periodEnd: monthEndDate(referenceMonth),
   },
   notices,
  });

  return {
   card,
   transactions: {
    rows: transactions.rows,
    page,
    pageSize,
    totalRows: transactions.totalRows,
   },
   // Whole, never paginated: six points are the series, and a page of a trend
   // is not a trend.
   trend: makeTrendSeries(months),
   // Whole for a different reason: the Pareto's running total is only correct
   // over the complete set, so a page of it would carry a cumulative figure
   // that means nothing.
   categories: makeCategoryBreakdown(budgetStatus.categories),
  };
 },
};
