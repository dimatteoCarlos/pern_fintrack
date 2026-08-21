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
import { getCurrentMonth } from '../../budget_services/db/budgetTransactionRepository.js';
import { money, toAmount } from '../../budget_services/core/money.js';
import {
 getExpenseAccountIds,
 getOldestAccountDate,
} from '../db/overviewAccountRepository.js';
import { getMonthlyExpense } from '../db/overviewMonthlyRepository.js';
import { getExpenseTransactionsPage } from '../db/overviewTransactionRepository.js';
import {
 makeExpenseCard,
 NO_BUDGET_NOTICE,
 NO_PRIOR_PERIOD_NOTICE,
} from '../core/makeExpenseCard.js';
import { makeTrendSeries } from '../core/makeTrendSeries.js';
import { makeCategoryBreakdown } from '../core/makeCategoryBreakdown.js';
import { shiftMonths, monthEndDate } from '../core/monthArithmetic.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

// D18 — six points, the window the developer chose. Not MS2's three, too short
// to read a direction from, and not MS3's twelve, sized for a statistical
// stability a visual series does not need.
const TREND_MONTHS = 6;

// 422 and not 400: the request parsed and the month is well formed, it is simply
// later than any month that exists on the owner's calendar. That is a
// relationship with a calendar, which no schema can see.
const rangeError = (message) => Object.assign(new Error(message), { status: 422 });

/**
 * Whether a full prior month existed to compare this one against (E3, Option A).
 *
 * The rule is the account's age, not the presence of transactions: a month in
 * which the user owned an account and spent nothing IS a complete period worth
 * comparing against, and reporting no delta for it would hide a real drop to
 * zero. What must never happen is a comparison against a month the user did not
 * yet exist for, which would read as a rise from nothing.
 *
 * A user with no accounts resolves to false for the same reason: there is no
 * prior period, not a prior period of zero.
 */
const hasCompletePriorPeriod = (oldestAccountDate, priorMonth) =>
 oldestAccountDate !== null && oldestAccountDate < priorMonth;

export const overviewExpenseService = {
 /**
  * Everything GET /overview/expense returns, for one month and one page.
  *
  * requestedMonth is optional and past-only, the same rule as
  * POST /budget/accounts/status: omitted resolves to the current month on the
  * owner's calendar, which is the only month the server can name without
  * borrowing the client's clock.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { month, page, pageSize } already validated
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'expense'
  */
 async getExpenseDomainData(pool, userId, { month, page, pageSize }, timeZone = 'UTC') {
  const currentMonth = await getCurrentMonth(pool, timeZone);

  if (month && month > currentMonth) {
   throw rangeError(
    `month ${month.slice(0, 7)} is later than the current month ${currentMonth.slice(0, 7)}.`,
   );
  }

  const referenceMonth = month ?? currentMonth;
  const priorMonth = shiftMonths(referenceMonth, -1);
  const trendStart = shiftMonths(referenceMonth, -(TREND_MONTHS - 1));

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
  const currentPoint = months.find((entry) => entry.month === referenceMonth);
  const priorPoint = months.find((entry) => entry.month === priorMonth);

  const canCompare = hasCompletePriorPeriod(oldestAccountDate, priorMonth);

  // priorPoint is inside the window for every request, since the window is six
  // months and the delta reaches back one. The guard is on the calendar, not on
  // the row: a missing row would be a bug in the series, not a young account.
  const delta = canCompare && priorPoint
   ? toAmount(money(currentPoint.totalAmount).minus(priorPoint.totalAmount))
   : null;

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
