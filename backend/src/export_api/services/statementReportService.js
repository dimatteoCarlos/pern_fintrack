// backend/src/export_api/services/statementReportService.js
//
// The dataset the PDF (commit 5e) draws from. No financial logic of its own
// (architecture rule 1): every figure is read through the same
// overview_services/pocket_services functions Overview and the pocket board
// already call, several of them a second time at the full analysis level so
// this report can carry byCounterparty, legsOverTime, categoryExecution and
// board.pockets — none of which overviewPageService.getOverviewPage
// republishes, because Overview's own screen never asked for them at once.

import { statementService, priorDecemberOf } from './statementService.js';
import { overviewExpenseService } from '../../fintrack_api/services/overview_services/services/overviewExpenseService.js';
import { overviewDebtService } from '../../fintrack_api/services/overview_services/services/overviewDebtService.js';
import { pocketBoardService } from '../../fintrack_api/services/pocket_services/services/pocketBoardService.js';
import {
 getAccountAllocations,
 getAccountIdentitiesById,
 getPocketSourceHoldings,
} from '../../fintrack_api/services/pocket_services/db/accountAllocationRepository.js';
import {
 getIncomeAccountIds,
 getExpenseAccountIds,
} from '../../fintrack_api/services/overview_services/db/overviewAccountRepository.js';
import {
 getMonthlyIncome,
 getMonthlyExpense,
} from '../../fintrack_api/services/overview_services/db/overviewMonthlyRepository.js';
import { getAccountsAndBalances } from '../db/accountsAndBalancesRepository.js';
import { toAmount } from '../../fintrack_api/services/budget_services/core/money.js';

const CARD_ONLY = { page: 1, pageSize: 1, includeTransactionRows: false };
const CARD_FULL = { ...CARD_ONLY, analysis: 'full' };

const monthLabel = (yyyyMmDd) => {
 const [year, month] = yyyyMmDd.split('-');
 return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString('en-US', {
  month: 'short',
  timeZone: 'UTC',
 });
};

/**
 * Section 3's monthly table: every calendar month of the reference year up to
 * referenceMonth, folded into an aggregate lead-in (every month older than the
 * trailing 6) plus up to 6 individual trailing months — the same split the
 * approved mockup draws (period-statement-mockup.html, page 2, "Jan-Mar" +
 * Apr..Sep). A reference month inside the calendar year's first 6 months
 * produces no aggregate at all.
 *
 * @param {object[]} incomeMonths - getMonthlyIncome's rows, Jan 1 through referenceMonth
 * @param {object[]} expenseMonths - getMonthlyExpense's rows, same range
 * @param {string} referenceMonth - 'YYYY-MM-01'
 * @returns {{aggregate: object|null, individual: object[]}}
 */
const buildMonthlyBreakdown = (incomeMonths, expenseMonths, referenceMonth) => {
 const year = referenceMonth.slice(0, 4);
 const byMonth = new Map();
 incomeMonths.forEach((row) => {
  byMonth.set(row.month, { income: toAmount(row.totalAmount), expense: 0 });
 });
 expenseMonths.forEach((row) => {
  const entry = byMonth.get(row.month) ?? { income: 0, expense: 0 };
  entry.expense = toAmount(row.totalAmount);
  byMonth.set(row.month, entry);
 });

 const months = [...byMonth.entries()]
  .filter(([month]) => month.startsWith(`${year}-`))
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([month, figures]) => ({
   month,
   label: monthLabel(month),
   income: figures.income,
   expense: figures.expense,
   netFlow: figures.income - figures.expense,
  }));

 const individualCount = Math.min(6, months.length);
 const individual = months.slice(months.length - individualCount);
 const aggregateMonths = months.slice(0, months.length - individualCount);

 const sum = (list, key) => list.reduce((total, entry) => total + entry[key], 0);
 const aggregate = aggregateMonths.length
  ? {
     label:
      aggregateMonths.length === 1
       ? aggregateMonths[0].label
       : `${aggregateMonths[0].label}–${aggregateMonths[aggregateMonths.length - 1].label}`,
     income: sum(aggregateMonths, 'income'),
     expense: sum(aggregateMonths, 'expense'),
     netFlow: sum(aggregateMonths, 'netFlow'),
    }
  : null;

 return { aggregate, individual };
};

/**
 * Section 6's per-account "Change since Jan 1" column: a second read of the
 * same repository at the prior calendar year's December close, the same
 * reuse getPriorYearClose (statementService.js) already makes for the
 * aggregate figures — no new query.
 *
 * An account absent from the prior close is one opened during the reference
 * year: its own row states that in words rather than printing a change
 * against a balance that was never zero, it was simply not yet open.
 *
 * @returns {Map<number, number>} accountId -> balance at the prior close
 */
const buildPriorBalanceByAccountId = (priorAccountsAndBalances) =>
 new Map(priorAccountsAndBalances.map((row) => [row.accountId, row.balance]));

/**
 * Section 11's "Committed YTD" column: the same reuse, a second board read at
 * the prior close. A pocket absent from the prior board is one opened during
 * the reference year.
 *
 * @returns {Map<number, number>} pocketId -> allocated at the prior close
 */
const buildPriorAllocatedByPocketId = (priorBoard) =>
 new Map(priorBoard.pockets.map((pocket) => [pocket.pocketId, pocket.allocated]));

/**
 * Which accounts back each pocket, named the same way pocketDetailService
 * resolves a soft-deleted or otherwise non-live account: the live read first,
 * getAccountIdentitiesById for whatever id it could not answer for.
 *
 * @param {object[]} accountRows - getAccountAllocations's rows (live accounts)
 * @param {object[]} holdingRows - getPocketSourceHoldings's rows, every pocket
 * @param {object[]} identityRows - getAccountIdentitiesById's rows, for the
 *  ids accountRows could not name
 * @returns {Map<number, object[]>} pocketId -> [{ accountId, accountName, heldByThisPocket }]
 */
const groupSourcesByPocket = (accountRows, holdingRows, identityRows) => {
 const nameById = new Map([
  ...accountRows.map((row) => [row.accountId, row.accountName]),
  ...identityRows.map((row) => [row.accountId, row.accountName]),
 ]);

 const byPocket = new Map();
 for (const holding of holdingRows) {
  const list = byPocket.get(holding.pocketId) ?? [];
  list.push({
   accountId: holding.accountId,
   accountName: nameById.get(holding.accountId) ?? null,
   heldByThisPocket: toAmount(holding.heldByThisPocket),
  });
  byPocket.set(holding.pocketId, list);
 }
 for (const list of byPocket.values()) {
  list.sort((a, b) => b.heldByThisPocket - a.heldByThisPocket);
 }
 return byPocket;
};

/**
 * Everything the PDF statement (PLAN_EXPORT.md §7) draws on, for one user and
 * one reference month.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {{window: object}} request - the resolved reporting window
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<object>} the report dataset
 */
export async function getStatementReportData(pool, userId, { window }, timeZone = 'UTC') {
 const { referenceMonth } = window;
 const priorMonth = priorDecemberOf(referenceMonth);
 const yearStart = `${referenceMonth.slice(0, 4)}-01-01`;

 const [incomeAccountIds, expenseAccountIds] = await Promise.all([
  getIncomeAccountIds(pool, userId),
  getExpenseAccountIds(pool, userId),
 ]);

 const [
  { overview, executiveSummaryRows },
  expenseFull,
  debtFull,
  board,
  priorBoard,
  accountsAndBalances,
  priorAccountsAndBalances,
  accountRows,
  holdingRows,
  incomeMonths,
  expenseMonths,
 ] = await Promise.all([
  statementService.getStatementCore(pool, userId, { window }, timeZone),
  // Same call overviewPageService already makes with CARD_ONLY, run a second
  // time for the one field it drops: categoryExecution (the donut). categories
  // itself is not refetched — overview.charts.expenseCategories is that exact
  // array, republished verbatim by the page service.
  overviewExpenseService.getExpenseDomainData(pool, userId, { window, ...CARD_ONLY }, timeZone),
  // The full level, for byCounterparty and legsOverTime — §12 refuses both at
  // card level on purpose, so the page service never carries them.
  overviewDebtService.getDebtDomainData(pool, userId, { window, ...CARD_FULL }, timeZone),
  // Coverage and holdings are deliberately not month-bound (pocketBoardService.js
  // getBoard's own doc comment); allocated/target/remaining/progress are, at
  // this reference month's close.
  pocketBoardService.getBoard(pool, userId, timeZone, referenceMonth),
  // Section 11's "Committed YTD" column — the same board, read a second time
  // at the prior close, the reuse getPriorYearClose already makes for every
  // other aggregate figure.
  pocketBoardService.getBoard(pool, userId, timeZone, priorMonth),
  getAccountsAndBalances(pool, userId, referenceMonth, timeZone),
  // Section 6's "Change since Jan 1" column — same reuse, one second read.
  getAccountsAndBalances(pool, userId, priorMonth, timeZone),
  getAccountAllocations(pool, userId),
  getPocketSourceHoldings(pool, userId),
  // Section 3's monthly table — Jan 1 of the reference year through
  // referenceMonth, gap-filled by the repository itself.
  getMonthlyIncome(pool, incomeAccountIds, yearStart, referenceMonth, timeZone),
  getMonthlyExpense(pool, expenseAccountIds, yearStart, referenceMonth, timeZone),
 ]);

 const knownAccountIds = new Set(accountRows.map((row) => row.accountId));
 const unresolvedIds = [...new Set(holdingRows.map((row) => row.accountId))].filter(
  (accountId) => !knownAccountIds.has(accountId),
 );
 const identityRows = unresolvedIds.length
  ? await getAccountIdentitiesById(pool, userId, unresolvedIds)
  : [];

 return {
  referenceMonth,
  executiveSummaryRows,
  hero: overview.hero,
  domainCards: overview.domainCards,
  financialGoals: overview.financialGoals,
  trend: overview.charts.trend,
  categories: overview.charts.expenseCategories,
  categoryExecution: expenseFull.categoryExecution,
  debtAnalysis: debtFull.analysis,
  pocketBoard: board,
  priorAllocatedByPocketId: buildPriorAllocatedByPocketId(priorBoard),
  pocketSourcesByPocket: groupSourcesByPocket(accountRows, holdingRows, identityRows),
  accountsAndBalances,
  priorBalanceByAccountId: buildPriorBalanceByAccountId(priorAccountsAndBalances),
  monthlyBreakdown: buildMonthlyBreakdown(incomeMonths, expenseMonths, referenceMonth),
 };
}
