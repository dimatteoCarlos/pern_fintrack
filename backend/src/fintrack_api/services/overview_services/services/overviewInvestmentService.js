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
import { getInvestmentFigures } from '../db/overviewInvestmentRepository.js';
import { getInvestmentTransactionsPage } from '../db/overviewTransactionRepository.js';
import { makeInvestmentCard } from '../core/makeInvestmentCard.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

export const overviewInvestmentService = {
 /**
  * Everything GET /overview/investment returns, for one page.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { window, page, pageSize, includeTransactionRows }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'investment'
  */
 async getInvestmentDomainData(
  pool,
  userId,
  { window, page, pageSize, includeTransactionRows = true },
  timeZone = 'UTC',
 ) {
  const accountIds = await getInvestmentAccountIds(pool, userId);

  const [figures, transactions] = await Promise.all([
   getInvestmentFigures(pool, accountIds, timeZone, window.referenceMonth),
   getInvestmentTransactionsPage(pool, accountIds, window.referenceMonth, timeZone, {
    page,
    pageSize,
    includeRows: includeTransactionRows,
   }),
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
  };
 },
};
