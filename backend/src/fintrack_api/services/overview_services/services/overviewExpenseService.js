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

import { createError } from '../../../../utils/errorHandling.js';
import { budgetCalculationService } from '../../budget_services/services/budgetCalculationService.js';
import {
 getExpenseAccountIds,
 getOldestAccountDate,
} from '../db/overviewAccountRepository.js';
import { getMonthlyExpense } from '../db/overviewMonthlyRepository.js';
import { getExpenseTransactionsPage } from '../db/overviewTransactionRepository.js';
import {
 makePeriodDelta,
 priorPeriodNotices,
} from '../core/makeDomainCard.js';
import { makeExpenseCard, NO_BUDGET_NOTICE } from '../core/makeExpenseCard.js';
import { makeTrendSeries } from '../core/makeTrendSeries.js';
import { makeCategoryBreakdown } from '../core/makeCategoryBreakdown.js';
import { makeExpenseAnalysis } from '../core/makeExpenseAnalysis.js';
import { wantsAnalysis } from '../core/analysisLevels.js';
import { TREND_MONTHS } from '../core/monthArithmetic.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

/**
 * The account ids one category holds, off the status rows that already say so.
 *
 * AN UNKNOWN NAME IS A 404 AND NEVER AN EMPTY PAGE. A real category with no
 * spending this month answers an empty page, and the two cannot be told apart
 * by a caller: one says "nothing happened here", the other says "there is no
 * here". The requested name is echoed back so the caller can see what was
 * looked for.
 *
 * The comparison folds case on BOTH sides. 013_normalize_category_budget_name_case
 * brought the stored names to lowercase and the two controllers that write them
 * write lowercase, so the client's echo of categories[] matches without folding
 * today - but only for a database that has run 013, and the fold costs one call
 * per row. A row with no category is skipped rather than
 * matched - makeBudgetAccountStatus.js:23 defaults categoryName to null, and
 * calling toLowerCase on it would throw where the answer is "not this one".
 *
 * @param {object} budgetStatus - the output of getBudgetAccountsStatus
 * @param {string} categoryName - the requested category, trimmed by the schema
 * @returns {number[]} the ids of every account in that category
 */
const categoryAccountIds = (budgetStatus, categoryName) => {
 const wanted = categoryName.toLowerCase();

 const ids = budgetStatus.accounts
  .filter((account) => account.categoryName?.toLowerCase() === wanted)
  .map((account) => account.accountId);

 if (ids.length === 0) {
  throw createError(404, `No expense category named '${categoryName}'.`);
 }

 return ids;
};

export const overviewExpenseService = {
 /**
  * Everything GET /overview/expense returns, for one month and one page.
  *
  * The window arrives resolved. The month ceiling is a relationship with the
  * owner's calendar, so it is checked once where the request is rather than
  * inside each calculator — otherwise six domains would each hold their own
  * copy of the same rule.
  *
  * analysis adds no statement in this domain at any level, and that is worth
  * stating rather than leaving to be discovered: the category ranking is already
  * published and already follows the selected month, and the per-category budget
  * variance is inside those ranked rows. Only the series widens.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { window, page, pageSize, analysis, category }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'expense'
  */
 async getExpenseDomainData(
  pool,
  userId,
  { window, page, pageSize, includeTransactionRows = true, analysis, category },
  timeZone = 'UTC',
 ) {
  const {
   referenceMonth,
   priorMonth,
   trendStart,
   analysisStart,
   periodStart,
   periodEnd,
  } = window;

  const withAnalysis = wantsAnalysis(analysis);

  // The id set every figure on this page is computed over, deleted categories
  // included (D19). Read once and passed to all three consumers: if categories
  // and totalAmount were built over two different sets, the array would not sum
  // to the card and the same screen would show two figures that must reconcile.
  const accountIds = await getExpenseAccountIds(pool, userId);

  // THE CATEGORY FILTER COSTS ONE ROUND TRIP AND ONLY WHEN IT IS USED.
  //
  // Which accounts belong to a category is makeCategoryGroups' rule
  // (budgetCalculationService.js:261-269) and not this file's, so membership is
  // read off the status rows rather than restated as a second query - a second
  // definition is how the filtered page and the ranked breakdown end up
  // disagreeing about which accounts a category holds. That means the status
  // has to be in hand BEFORE the transaction page is asked for, so a filtered
  // request is two round trips deep where an unfiltered one is one. Unfiltered,
  // nothing below is serialised and the common path is unchanged.
  const categoryStatus = category
   ? await budgetCalculationService.getBudgetAccountsStatus(
      pool,
      accountIds,
      timeZone,
      referenceMonth,
     )
   : null;

  // The set the LIST is read over. Every other figure of this answer stays on
  // the whole domain: the card is still the month's spending, the series is
  // still the month's, and the ranked breakdown is still every category - a
  // level-3 screen shows one category's rows UNDER the month it belongs to, and
  // a card narrowed to one category would be a different card with no name.
  const listedAccountIds = category
   ? categoryAccountIds(categoryStatus, category)
   : accountIds;

  const [months, oldestAccountDate, transactions, budgetStatus] = await Promise.all([
   getMonthlyExpense(
    pool,
    accountIds,
    withAnalysis ? analysisStart : trendStart,
    referenceMonth,
    timeZone,
   ),
   getOldestAccountDate(pool, userId, timeZone),
   getExpenseTransactionsPage(pool, listedAccountIds, referenceMonth, timeZone, {
    page,
    pageSize,
    includeRows: includeTransactionRows,
   }),
   // Already read when a category was named. Promise.all takes a plain value
   // beside its promises, so the second call is not made.
   categoryStatus ??
    budgetCalculationService.getBudgetAccountsStatus(
     pool,
     accountIds,
     timeZone,
     referenceMonth,
    ),
  ]);

  // The reference month is the last point of the same series the chart draws, so
  // the card and the chart cannot disagree about it (§4.2). generate_series
  // guarantees the row exists even when nothing happened in it.
  const { currentPoint, priorTotalAmount, delta, priorPeriodCoverage } = makePeriodDelta({
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

  const notices = [...budgetStatus.meta.notices, ...priorPeriodNotices(priorPeriodCoverage)];
  // Not raised when the currencies are mixed: budgetCalculationService already
  // said so, and two notices for one absent figure would read as two problems.
  if (!isMixedCurrency && !hasBudgetInForce) notices.push(NO_BUDGET_NOTICE);

  const card = makeExpenseCard({
   totalAmount: currentPoint.totalAmount,
   transactionCount: currentPoint.transactionCount,
   priorTotalAmount,
   delta,
   priorPeriodCoverage,
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
    periodStart,
    periodEnd,
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
   // is not a trend. Cut to TREND_MONTHS explicitly, so the card's chart is the
   // same six points whether or not the request carried an analysis.
   trend: makeTrendSeries(months, TREND_MONTHS),
   // Whole for a different reason: the Pareto's running total is only correct
   // over the complete set, so a page of it would carry a cumulative figure
   // that means nothing.
   categories: makeCategoryBreakdown(budgetStatus.categories),
   ...(withAnalysis
    ? {
       analysis: makeExpenseAnalysis({
        level: analysis,
        months,
        // Both terms off the card, so the decomposition sums back to the
        // figure the card publishes rather than to a second reading of it.
        totalAmount: card.totalAmount,
        categorizedExpense: card.categorizedExpense,
       }),
      }
    : {}),
  };
 },
};
