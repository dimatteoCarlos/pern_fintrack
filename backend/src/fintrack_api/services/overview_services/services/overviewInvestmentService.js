// src/fintrack_api/services/overview_services/services/overviewInvestmentService.js

// The Investment domain calculator behind GET /overview/investment.
//
// Every figure is read at the reference month, the same instant the movement
// list beside the card is bounded by. The card of §6 still carries no window
// field, so nothing in the payload names the month back to the client — the
// client knows it because it asked for it.
//
// One figure is still unbounded, and it is recorded where it is computed: the
// account count counts the accounts that exist now, not the ones that existed
// at the reference month (the accounts CTE of the figures query). It is not
// stated as a notice because a reader cannot act on it.
//
// No trend (§12) and no transactionCount (§6). The list is still returned
// because §12 makes it mandatory for every domain, and it lists every movement
// that touched an investment account rather than only those a V figure counts:
// the user can open the same account elsewhere, and two screens showing the same
// account with different histories is worse than a row that no figure explains.

import { getInvestmentAccountIds } from '../db/overviewAccountRepository.js';
import {
 getContributionHistory,
 getInvestmentBalanceByAccount,
 getInvestmentFigures,
} from '../db/overviewInvestmentRepository.js';
import { getInvestmentTransactionsPage } from '../db/overviewTransactionRepository.js';
import { makeInvestmentCard } from '../core/makeInvestmentCard.js';
import { makeInvestmentAnalysis } from '../core/makeInvestmentAnalysis.js';
import { isFullAnalysis, wantsAnalysis } from '../core/analysisLevels.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

// The most funding events one response will carry. The history is unbounded
// below on purpose — a history cut at thirteen months is not a history — so an
// owner who has funded weekly for a decade has a real one that no single response
// should try to hold. The newest page of it is served and the count beside it
// says what was left out.
const CONTRIBUTION_HISTORY_LIMIT = 50;

export const overviewInvestmentService = {
 /**
  * Everything GET /overview/investment returns, for one page.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * The derived level of the analysis costs no statement: the reconciliation is
  * the four terms of the card compared against each other, so asking for it adds
  * a subtraction and nothing else. Only the full level reads the database again.
  *
  * @param {object} request - { window, page, pageSize, includeTransactionRows, analysis }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'investment'
  */
 async getInvestmentDomainData(
  pool,
  userId,
  { window, page, pageSize, includeTransactionRows = true, analysis },
  timeZone = 'UTC',
 ) {
  const accountIds = await getInvestmentAccountIds(pool, userId);

  const [figures, transactions, balances, contributions] = await Promise.all([
   getInvestmentFigures(pool, accountIds, timeZone, window.referenceMonth),
   getInvestmentTransactionsPage(pool, accountIds, window.referenceMonth, timeZone, {
    page,
    pageSize,
    includeRows: includeTransactionRows,
   }),
   // Both at the full level only, and both at the reference month, which is the
   // cut every figure on this card already shares.
   isFullAnalysis(analysis)
    ? getInvestmentBalanceByAccount(
       pool,
       accountIds,
       timeZone,
       window.referenceMonth,
      )
    : undefined,
   isFullAnalysis(analysis)
    ? getContributionHistory(
       pool,
       accountIds,
       timeZone,
       window.referenceMonth,
       CONTRIBUTION_HISTORY_LIMIT,
      )
    : undefined,
  ]);

  const card = makeInvestmentCard({
   accountCount: figures.accountCount,
   capitalContributed: figures.capitalContributed,
   ledgerBalance: figures.ledgerBalance,
   realizedPnl: figures.realizedPnl,
   closureAdjustment: figures.closureAdjustment,
   largestBalance: figures.largestBalance,
   daysSinceLastContribution: figures.daysSinceLastContribution,
   currency: ACCOUNTING_CURRENCY_CODE,
  });

  return {
   card,
   transactions: {
    rows: transactions.rows,
    page,
    pageSize,
    totalRows: transactions.totalRows,
   },
   ...(wantsAnalysis(analysis)
    ? {
       analysis: makeInvestmentAnalysis({
        level: analysis,
        // The card itself, so the reconciliation compares the four figures the
        // card published rather than a second read of the same statement.
        card,
        balances,
        contributions,
       }),
      }
    : {}),
  };
 },
};
