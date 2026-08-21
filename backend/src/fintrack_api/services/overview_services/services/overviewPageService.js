// src/fintrack_api/services/overview_services/services/overviewPageService.js

// The whole Overview page of §11, assembled from the six domain calculators.
//
// It computes no domain figure of its own. Every card comes back from the
// calculator that owns it, the hero is arithmetic on those cards (D27) and ALL
// copies them (§7). The only things this service reads that no calculator reads
// are the bank balance, the saving goals and the recent activity teaser — and
// the first of those exists solely because there is no Bank domain in §3.
//
// That is not a style preference. R202 — the defect that opened this whole
// module — was a consolidated figure computed by a second path that disagreed
// with the detail beside it. A page service that recomputed a total would be the
// same defect rebuilt one layer up, with better SQL.
//
// It loads NO transaction rows outside recentActivity, which §11 states as an
// obligation. The calculators are asked for their counts and not their pages;
// the flag reaches the SQL, so the rows are never fetched rather than fetched
// and dropped.

import { overviewExpenseService } from './overviewExpenseService.js';
import { overviewIncomeService } from './overviewIncomeService.js';
import { overviewPnlService } from './overviewPnlService.js';
import { overviewDebtService } from './overviewDebtService.js';
import { overviewPocketService } from './overviewPocketService.js';
import { overviewInvestmentService } from './overviewInvestmentService.js';

import {
 getExpenseAccountIds,
 getIncomeAccountIds,
 getPocketAccountIds,
} from '../db/overviewAccountRepository.js';
import {
 getMonthlyExpense,
 getMonthlyIncome,
 getMonthlyPocketNet,
} from '../db/overviewMonthlyRepository.js';
import {
 getBankBalance,
 getSavingGoals,
 getRecentActivity,
} from '../db/overviewPageRepository.js';

import { makeHeroSection } from '../core/makeHeroSection.js';
import { makeAllCard } from '../core/makeAllCard.js';
import { makeMonthlySnapshot } from '../core/makeMonthlySnapshot.js';
import { makeFinancialGoals } from '../core/makeFinancialGoals.js';
import { shiftMonths, monthEndDate } from '../core/monthArithmetic.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

// MS3's window. Thirteen points, not twelve: the reference month is the figure
// being judged and the twelve before it are what it is judged against, so the
// month under study never enters its own baseline.
const SNAPSHOT_HISTORY_MONTHS = 12;

// The calculators are asked for cards, so the page is a request for one row it
// will not read. pageSize cannot be 0 — the validators reject it and the SQL
// would be meaningless — but includeTransactionRows keeps the page statement
// from running at all, so the value never reaches a query.
const CARD_ONLY = { page: 1, pageSize: 1, includeTransactionRows: false };

export const overviewPageService = {
 /**
  * Everything GET /overview returns, for one month.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { window }, already resolved by the controller
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewData
  */
 async getOverviewPage(pool, userId, { window }, timeZone = 'UTC') {
  const { referenceMonth } = window;
  const cardRequest = { window, ...CARD_ONLY };

  const snapshotStart = shiftMonths(referenceMonth, -SNAPSHOT_HISTORY_MONTHS);

  const [
   expense,
   income,
   pnl,
   debt,
   pocket,
   investment,
   bankBalance,
   goals,
   recentActivity,
   expenseAccountIds,
   incomeAccountIds,
   pocketAccountIds,
  ] = await Promise.all([
   overviewExpenseService.getExpenseDomainData(pool, userId, cardRequest, timeZone),
   overviewIncomeService.getIncomeDomainData(pool, userId, cardRequest, timeZone),
   overviewPnlService.getPnlDomainData(pool, userId, cardRequest, timeZone),
   overviewDebtService.getDebtDomainData(pool, userId, cardRequest, timeZone),
   overviewPocketService.getPocketDomainData(pool, userId, cardRequest, timeZone),
   overviewInvestmentService.getInvestmentDomainData(pool, userId, cardRequest, timeZone),
   getBankBalance(pool, userId),
   getSavingGoals(pool, userId),
   getRecentActivity(pool, userId, timeZone),
   getExpenseAccountIds(pool, userId),
   getIncomeAccountIds(pool, userId),
   getPocketAccountIds(pool, userId),
  ]);

  // The thirteen-month series MS2/MS3 average over. Fetched separately from the
  // six-month series the cards use because the windows differ, not because the
  // formula does: the last point of each of these is the same statement over the
  // same accounts that produced the card's figure, so MS1 and the card cannot
  // disagree.
  const [expenseMonths, incomeMonths, pocketMonths] = await Promise.all([
   getMonthlyExpense(pool, expenseAccountIds, snapshotStart, referenceMonth, timeZone),
   getMonthlyIncome(pool, incomeAccountIds, snapshotStart, referenceMonth, timeZone),
   // Pocket's snapshot is a FLOW even though its card is a stock (D28). All four
   // entries of the widget have to be the same kind of quantity or MS4 subtracts
   // an average of movements from a balance.
   getMonthlyPocketNet(pool, pocketAccountIds, snapshotStart, referenceMonth, timeZone),
  ]);

  const hero = makeHeroSection({
   bankBalance,
   investmentBalance: investment.card.ledgerBalance,
   debtPosition: debt.card.totalAmount,
   pocketBalance: pocket.card.totalAmount,
   incomeTotal: income.card.totalAmount,
   expenseTotal: expense.card.totalAmount,
   currency: ACCOUNTING_CURRENCY_CODE,
  });

  const periodWindow = {
   periodStart: referenceMonth,
   periodEnd: monthEndDate(referenceMonth),
  };

  return {
   hero,
   all: makeAllCard({
    // The same value the hero published, not a second addition of the same
    // four numbers.
    netWorth: hero.netWorth,
    totalIncomePeriod: income.card.totalAmount,
    totalExpensePeriod: expense.card.totalAmount,
    netDebtPosition: debt.card.totalAmount,
    totalPocketBalance: pocket.card.totalAmount,
    domainCounts: [
     income.card.transactionCount,
     expense.card.transactionCount,
     debt.card.transactionCount,
     pocket.card.transactionCount,
     pnl.card.transactionCount,
    ],
    currency: ACCOUNTING_CURRENCY_CODE,
    window: periodWindow,
   }),
   domainCards: {
    income: income.card,
    expense: expense.card,
    investment: investment.card,
    debt: debt.card,
    pocket: pocket.card,
    pnl: pnl.card,
   },
   // §8 defines the widget for these three domains only.
   monthlySnapshot: [
    makeMonthlySnapshot({ domain: 'income', months: incomeMonths, currency: ACCOUNTING_CURRENCY_CODE }),
    makeMonthlySnapshot({ domain: 'expense', months: expenseMonths, currency: ACCOUNTING_CURRENCY_CODE }),
    makeMonthlySnapshot({ domain: 'pocket', months: pocketMonths, currency: ACCOUNTING_CURRENCY_CODE }),
   ],
   financialGoals: makeFinancialGoals({ goals, currency: ACCOUNTING_CURRENCY_CODE }),
   // Not an aggregation and not bounded by the month: the teaser answers what
   // happened last, which is why it carries no currency of its own — every row
   // already has one (D7).
   recentActivity: { transactions: recentActivity },

   // D32. The calculators already produced these and the page used to throw
   // them away: the six-month series of §12 and the current-month Pareto of
   // D19. Published verbatim, the same treatment the cards get — no formula
   // runs here, so a chart and the figure beside it cannot disagree.
   //
   // trend carries only the three domains §12 gives a series to. The other
   // three have no key rather than an empty array: absent says the domain has
   // no series, empty would say it has one and it is blank.
   charts: {
    trend: {
     income: income.trend,
     expense: expense.trend,
     pocket: pocket.trend,
    },
    expenseCategories: expense.categories,
   },
  };
 },
};
