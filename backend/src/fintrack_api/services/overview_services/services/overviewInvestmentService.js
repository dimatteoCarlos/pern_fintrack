// src/fintrack_api/services/overview_services/services/overviewInvestmentService.js

// The Investment domain calculator behind GET /overview/investment.
//
// The card of §6 carries no window and no delta, so this is the one domain whose
// figures the requested month does not move: V1, V2, V4 and V5 are as of now and
// V3 defaults to full history. The month bounds only the list beside the card.
//
// That asymmetry is deliberate and worth stating in the response rather than
// hiding: a client showing August and a card reading "as of today" would
// otherwise look like a bug. The card has no window field to say so with — §6
// does not give it one — so the notice does.
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

// Said because the card and the list beside it answer as of different moments.
export const AS_OF_NOW_NOTICE =
 'The investment figures are stated as of now, not for the selected month; only the movement list below is bounded by it.';

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
   getInvestmentFigures(pool, accountIds, timeZone),
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
   largestBalance: figures.largestBalance,
   daysSinceLastContribution: figures.daysSinceLastContribution,
   currency: ACCOUNTING_CURRENCY_CODE,
   notices: [AS_OF_NOW_NOTICE],
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
