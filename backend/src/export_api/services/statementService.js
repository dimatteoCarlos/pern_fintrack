// backend/src/export_api/services/statementService.js
//
// The Period Statement's Executive Summary (PLAN_EXPORT.md §9, commit 5c):
// twelve figures, each with a Month value and a Year to date value, read
// through the SAME functions Overview already calls, never a second
// formula. The Month values are overviewPageService.getOverviewPage's own
// output, unchanged; the Year to date values are the change against the
// prior calendar year's December 31 close, obtained by calling the
// identical repositories a second time with '(year-1)-12-01' — the reuse
// makeYearStartChange.js (commit 5a) was written to receive.
//
// No writer and no route here (commit 5d/5e): this is the dataset only.

import { overviewPageService } from '../../fintrack_api/services/overview_services/services/overviewPageService.js';
import {
 getBankBalance,
 getFreeCash,
} from '../../fintrack_api/services/overview_services/db/overviewPageRepository.js';
import { getInvestmentFigures } from '../../fintrack_api/services/overview_services/db/overviewInvestmentRepository.js';
import {
 getDebtAccountIds,
 getInvestmentAccountIds,
} from '../../fintrack_api/services/overview_services/db/overviewAccountRepository.js';
import {
 getMonthlyBalance,
 getDebtDomainFields,
} from '../../fintrack_api/services/overview_services/db/overviewBalanceRepository.js';
import { pocketBoardService } from '../../fintrack_api/services/pocket_services/services/pocketBoardService.js';
import { makeHeroSection, NO_DEBT_LEGS_NOTICE } from '../../fintrack_api/services/overview_services/core/makeHeroSection.js';
import { makeYearToDateFlow } from '../../fintrack_api/services/overview_services/core/makeYearToDateFlow.js';
import { makeYearStartChange } from '../../fintrack_api/services/overview_services/core/makeYearStartChange.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../fintrack_api/config/fintrackConfig.js';

// The prior calendar year's December, the one month every repository below is
// called against a second time. Derived from the reference month's own year,
// not from today, so a statement run for a past month still compares against
// THAT year's prior December.
export const priorDecemberOf = (referenceMonth) =>
 `${Number(referenceMonth.slice(0, 4)) - 1}-12-01`;

/**
 * The prior calendar year's December 31 close, read through the same five
 * repositories PLAN_EXPORT.md §9 names and makeYearStartChange.js documents —
 * no new query, a second call to each with the prior month.
 *
 * priorHero reuses makeHeroSection itself for netWorth/liquidNetWorth/
 * cashPosition/freeCash, so December's close is computed by the exact same
 * formula as the reference month's, never a parallel one. incomeTotal and
 * expenseTotal are passed as 0: none of those four fields reads them, and the
 * year's flow is covered separately by makeYearToDateFlow.
 *
 * @param {object} pool
 * @param {string} userId
 * @param {string} priorMonth - 'YYYY-12-01' of the prior calendar year
 * @param {string} timeZone
 */
const getPriorYearClose = async (pool, userId, priorMonth, timeZone) => {
 const [debtAccountIds, investmentAccountIds] = await Promise.all([
  getDebtAccountIds(pool, userId),
  getInvestmentAccountIds(pool, userId),
 ]);

 const [bankBalance, freeCash, investmentFigures, debtMonths, debtFields, board] =
  await Promise.all([
   getBankBalance(pool, userId, priorMonth, timeZone),
   getFreeCash(pool, userId, priorMonth, timeZone),
   getInvestmentFigures(pool, investmentAccountIds, timeZone, priorMonth),
   // The single point at priorMonth, the same repository stockDomainCalculator
   // reads a whole series from — never receivable minus payable, which
   // overviewBalanceRepository.js:170-172 documents as an audit identity, not
   // the production formula.
   getMonthlyBalance(pool, debtAccountIds, priorMonth, priorMonth, timeZone),
   getDebtDomainFields(pool, debtAccountIds, priorMonth, timeZone),
   pocketBoardService.getBoard(pool, userId, timeZone, priorMonth),
  ]);

 const debtPosition = debtMonths[0]?.totalAmount ?? 0;

 const hero = makeHeroSection({
  bankBalance,
  freeCash,
  investmentBalance: investmentFigures.ledgerBalance,
  debtPosition,
  payable: debtFields.payable,
  incomeTotal: 0,
  expenseTotal: 0,
  currency: ACCOUNTING_CURRENCY_CODE,
 });

 return {
  hero,
  debtPosition,
  receivable: debtFields.receivable,
  payable: debtFields.payable,
  pocketsCommitted: board.summary.totalAllocated ?? 0,
  investmentBalance: investmentFigures.ledgerBalance,
 };
};

const makeRow = (metric, month, yearToDate, notices = []) =>
 Object.freeze({ metric, month, yearToDate, notices: Object.freeze([...notices]) });

/**
 * The twelve Executive Summary rows, pure composition over two already-
 * resolved reads — no query in this function, so it is the part of
 * statementService.js a test exercises with plain objects, no pool.
 *
 * @param {object} overview - overviewPageService.getOverviewPage's result,
 *  for the reference month
 * @param {object} priorClose - getPriorYearClose's result, for the prior
 *  December 31
 * @returns {object[]} frozen { metric, month, yearToDate, notices }[]
 */
export const composeExecutiveSummaryRows = (overview, priorClose) => {
 const { hero, domainCards, monthlySnapshot } = overview;
 const priorHero = priorClose.hero;

 const incomeSnapshot = monthlySnapshot.find((entry) => entry.domain === 'income');
 const expenseSnapshot = monthlySnapshot.find((entry) => entry.domain === 'expense');

 const yearFlow = makeYearToDateFlow({
  incomeYearToDate: incomeSnapshot.yearToDate,
  expenseYearToDate: expenseSnapshot.yearToDate,
 });

 // null only when a close on either side did not resolve (an absent payable
 // leg): the one case makeYearStartChange documents itself as not covering,
 // reusing the exact notice makeHeroSection already carries for it rather
 // than inventing a second text for the same reason.
 const liquidNetWorthYtd = makeYearStartChange(hero.liquidNetWorth, priorHero.liquidNetWorth);
 const liquidNetWorthNotices =
  hero.liquidNetWorth === null || priorHero.liquidNetWorth === null ? [NO_DEBT_LEGS_NOTICE] : [];

 return Object.freeze([
  makeRow('income', domainCards.income.totalAmount, incomeSnapshot.yearToDate),
  makeRow('expenses', domainCards.expense.totalAmount, expenseSnapshot.yearToDate),
  makeRow('netMonthlyFlow', hero.netMonthlyFlow, yearFlow.netYearToDateFlow),
  makeRow('savingsRate', hero.savingsRate, yearFlow.yearToDateSavingsRate, yearFlow.meta.notices),
  makeRow('netWorth', hero.netWorth, makeYearStartChange(hero.netWorth, priorHero.netWorth)),
  makeRow('liquidNetWorth', hero.liquidNetWorth, liquidNetWorthYtd, liquidNetWorthNotices),
  makeRow('cashPosition', hero.cashPosition, makeYearStartChange(hero.cashPosition, priorHero.cashPosition)),
  makeRow('freeCash', hero.freeCash, makeYearStartChange(hero.freeCash, priorHero.freeCash)),
  makeRow(
   'netDebtPosition',
   domainCards.debt.totalAmount,
   makeYearStartChange(domainCards.debt.totalAmount, priorClose.debtPosition),
  ),
  makeRow(
   'receivable',
   domainCards.debt.receivable,
   makeYearStartChange(domainCards.debt.receivable, priorClose.receivable),
  ),
  makeRow(
   'payable',
   domainCards.debt.payable,
   makeYearStartChange(domainCards.debt.payable, priorClose.payable),
  ),
  makeRow(
   'pocketsCommitted',
   domainCards.pocket.totalAmount,
   makeYearStartChange(domainCards.pocket.totalAmount, priorClose.pocketsCommitted),
  ),
  makeRow(
   'investments',
   domainCards.investment.ledgerBalance,
   makeYearStartChange(domainCards.investment.ledgerBalance, priorClose.investmentBalance),
  ),
 ]);
};

export const statementService = {
 /**
  * overviewPageService's full result for the reference month, plus the
  * Executive Summary rows composed over it — one overview read serving both
  * the XLSX sheet (rows only) and the PDF (the whole overview, for the
  * figures the Executive Summary does not carry, e.g. domainCards.investment,
  * charts, financialGoals).
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token
  * @param {{window: object}} request - the resolved reporting window
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<{overview: object, executiveSummaryRows: object[]}>}
  */
 async getStatementCore(pool, userId, { window }, timeZone = 'UTC') {
  const priorMonth = priorDecemberOf(window.referenceMonth);

  const [overview, priorClose] = await Promise.all([
   overviewPageService.getOverviewPage(pool, userId, { window }, timeZone),
   getPriorYearClose(pool, userId, priorMonth, timeZone),
  ]);

  return {
   overview,
   executiveSummaryRows: composeExecutiveSummaryRows(overview, priorClose),
  };
 },

 /**
  * The Executive Summary for one user and one reference month.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token
  * @param {{window: object}} request - the resolved reporting window
  *  (makeReportingWindow's shape; only `referenceMonth` is read here)
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object[]>} frozen Executive Summary rows
  */
 async getExecutiveSummary(pool, userId, { window }, timeZone = 'UTC') {
  const { executiveSummaryRows } = await statementService.getStatementCore(pool, userId, { window }, timeZone);
  return executiveSummaryRows;
 },
};
