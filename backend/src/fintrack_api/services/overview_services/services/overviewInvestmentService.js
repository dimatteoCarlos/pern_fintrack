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

import {
 getInvestmentAccountIds,
 getOldestAccountDate,
} from '../db/overviewAccountRepository.js';
import {
 getContributionHistory,
 getInvestmentBalanceByAccount,
 getInvestmentFigures,
} from '../db/overviewInvestmentRepository.js';
import { getInvestmentTransactionsPage } from '../db/overviewTransactionRepository.js';
import { makeInvestmentCard } from '../core/makeInvestmentCard.js';
import {
 priorPeriodCoverageOf,
 priorPeriodNotices,
} from '../core/makeDomainCard.js';
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
  const { referenceMonth, priorMonth } = window;

  const accountIds = await getInvestmentAccountIds(pool, userId);

  const [
   figures,
   priorFigures,
   oldestAccountDate,
   transactions,
   balances,
   contributions,
  ] = await Promise.all([
   getInvestmentFigures(pool, accountIds, timeZone, referenceMonth),
   // THE SAME STATEMENT AT THE PRIOR MONTH'S BOUND, and that is the whole
   // implementation of the comparison. Every figure this card carries is an
   // accumulation to the close of the month it was asked for, so the change over
   // a month is the same read taken twice - there is no monthly series to
   // subtract two points from, which is why this domain cannot use
   // makePeriodDelta the way the other five do.
   //
   // Run unconditionally rather than after the coverage is known: the coverage
   // arrives from the read beside this one, and waiting for it would turn one
   // round trip into two on every request to save a statement on the accounts of
   // an owner who opened them this month.
   getInvestmentFigures(pool, accountIds, timeZone, priorMonth),
   // The owner's oldest account of ANY type, not the oldest investment account.
   // It is the same guard the other five cards use, and the question it answers
   // is about the owner's history rather than about this domain's: a reader who
   // is told the change is measured against a partial month is being told when
   // their records begin.
   getOldestAccountDate(pool, userId, timeZone),
   getInvestmentTransactionsPage(pool, accountIds, referenceMonth, timeZone, {
    page,
    pageSize,
    includeRows: includeTransactionRows,
   }),
   // Both at the full level only, and both at the reference month, which is the
   // cut every figure on this card already shares.
   isFullAnalysis(analysis)
    ? getInvestmentBalanceByAccount(pool, accountIds, timeZone, referenceMonth)
    : undefined,
   isFullAnalysis(analysis)
    ? getContributionHistory(
       pool,
       accountIds,
       timeZone,
       referenceMonth,
       CONTRIBUTION_HISTORY_LIMIT,
      )
    : undefined,
  ]);

  const priorPeriodCoverage = priorPeriodCoverageOf(
   oldestAccountDate,
   priorMonth,
   referenceMonth,
  );

  const card = makeInvestmentCard({
   accountCount: figures.accountCount,
   capitalContributed: figures.capitalContributed,
   ledgerBalance: figures.ledgerBalance,
   realizedPnl: figures.realizedPnl,
   closureAdjustment: figures.closureAdjustment,
   largestBalance: figures.largestBalance,
   priorLedgerBalance: priorFigures.ledgerBalance,
   priorPeriodCoverage,
   daysSinceLastContribution: figures.daysSinceLastContribution,
   // The count the page needs, read off the same paging result the rows come
   // from. readTransactionsPage computes it whether or not rows were asked for,
   // so the level-1 request that suppresses rows still gets the count.
   transactionCount: transactions.totalRows,
   currency: ACCOUNTING_CURRENCY_CODE,
   notices: priorPeriodNotices(priorPeriodCoverage),
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
