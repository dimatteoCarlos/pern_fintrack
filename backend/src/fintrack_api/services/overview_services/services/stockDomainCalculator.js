// src/fintrack_api/services/overview_services/services/stockDomainCalculator.js

// The body of a stock domain: one whose headline figure is a BALANCE.
//
// Debt is the only caller today. It was written for two — Pocket came through
// here as well, because both were read the same way: one account set, one
// balance series, and the movements on those accounts. That stopped being true
// when migration 020 turned a pocket into a plan with no account and no
// transactions of its own, and Pocket now composes its card from the pocket
// board (overviewPocketService.js).
//
// The file is kept as it is rather than folded into the debt calculator. The
// shape it holds is the one every balance-headed domain needs, and inlining it
// would put a rule the contract states once back inside a single domain — the
// arrangement D21 already showed the cost of.
//
// What makes a domain belong here is that its total is not a sum of the period's
// rows. D1 is not, so its delta cannot be one total minus another the way E3 and
// I3 are: it is the same balance read at the end of two consecutive months,
// which is what the balance repository returns.
//
// This is also where D21 lands differently. On a flow card the count and the
// total are made of the same rows, so the count comes off the same monthly
// statement as the total. A balance is made of no rows at all, so there is
// nothing for the count to inherit from — it is tied to the list instead, and
// tied literally: transactionCount IS the list's totalRows, one statement, not
// two that have to agree.

import { getOldestAccountDate } from '../db/overviewAccountRepository.js';
import { getMonthlyBalance } from '../db/overviewBalanceRepository.js';
import {
 makeDomainCard,
 makePeriodDelta,
 NO_PRIOR_PERIOD_NOTICE,
} from '../core/makeDomainCard.js';
import { makeTrendSeries } from '../core/makeTrendSeries.js';
import { monthEndDate } from '../core/monthArithmetic.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

/**
 * Everything a stock domain returns, for one month and one page.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @param {object} request - { window, page, pageSize, includeTransactionRows }
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} config - the four values that separate one stock domain from the next
 * @param {string} config.domain - one of the six of §3
 * @param {Function} config.getAccountIds - the resolver for this domain's accounts
 * @param {Function} config.getTransactionsPage - the list for this domain's movements
 * @param {boolean} config.publishesTrend - §12 denies debt a series
 * @returns {Promise<object>} GetOverviewDomainData for the domain
 */
export async function readStockDomain(
 pool,
 userId,
 { window, page, pageSize, includeTransactionRows = true },
 timeZone,
 { domain, getAccountIds, getTransactionsPage, publishesTrend },
) {
 const { referenceMonth, priorMonth, trendStart } = window;

 // Read once and passed to both consumers. The balance series and the list have
 // to be built over the same accounts or the figure and the rows under it would
 // be answers about two different sets.
 const accountIds = await getAccountIds(pool, userId);

 const [months, oldestAccountDate, transactions] = await Promise.all([
  getMonthlyBalance(pool, accountIds, trendStart, referenceMonth, timeZone),
  getOldestAccountDate(pool, userId, timeZone),
  getTransactionsPage(pool, accountIds, referenceMonth, timeZone, {
   page,
   pageSize,
   includeRows: includeTransactionRows,
  }),
 ]);

 // The last point of the series is the balance right now, by construction: the
 // reference month's end subtracts nothing from today's balance. So the card's
 // total and the chart's last bar are the same read, not two that agree (§4.2).
 const { currentPoint, delta, canCompare } = makePeriodDelta({
  months,
  referenceMonth,
  priorMonth,
  oldestAccountDate,
 });

 const card = makeDomainCard({
  domain,
  // Signed and already netted by the ledger. A debtor balance is positive when
  // the user is owed and negative when the user owes
  // (movementInputHandler.js:32-53), so this is summed, never subtracted.
  totalAmount: currentPoint.totalAmount,
  transactionCount: transactions.totalRows,
  delta,
  currency: ACCOUNTING_CURRENCY_CODE,
  window: {
   periodStart: referenceMonth,
   periodEnd: monthEndDate(referenceMonth),
  },
  notices: canCompare ? [] : [NO_PRIOR_PERIOD_NOTICE],
 });

 return {
  card,
  transactions: {
   rows: transactions.rows,
   page,
   pageSize,
   totalRows: transactions.totalRows,
  },
  // Spread rather than set to undefined: §12 wants the key absent for a domain
  // that publishes no series, and `trend: undefined` still shows up as a key to
  // anything that iterates the object.
  ...(publishesTrend ? { trend: makeTrendSeries(months) } : {}),
 };
}
