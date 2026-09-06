// src/fintrack_api/services/overview_services/services/stockDomainCalculator.js

// The body Debt and Pocket share.
//
// The flow domains each earned their own file because they genuinely differ:
// expense carries a budget block and a category breakdown, income carries
// neither, pnl publishes no trend and filters a description. Debt and Pocket
// differ in four values and nothing else — which account set, which list, which
// name, and whether a trend is published — so they are one body called twice
// rather than one body written twice.
//
// What makes them one body is that their headline figure is a BALANCE. Neither
// D1 nor P1 is a sum of the period's rows, so neither delta can be one total
// minus another the way E3 and I3 are: it is the same balance read at the end of
// two consecutive months, which is what the balance repository returns.
//
// This is also where D21 lands differently. On a flow card the count and the
// total are made of the same rows, so the count comes off the same monthly
// statement as the total. A balance is made of no rows at all, so there is
// nothing for the count to inherit from — it is tied to the list instead, and
// tied literally: transactionCount IS the list's totalRows, one statement, not
// two that have to agree.

import { getOldestAccountDate } from '../db/overviewAccountRepository.js';
import {
 getMonthlyBalance,
 getMonthlyBalanceByLeg,
} from '../db/overviewBalanceRepository.js';
import {
 makeDomainCard,
 makePeriodDelta,
 NO_PRIOR_PERIOD_NOTICE,
} from '../core/makeDomainCard.js';
import { makeTrendSeries } from '../core/makeTrendSeries.js';
import { monthEndDate } from '../core/monthArithmetic.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';
import { money } from '../../budget_services/core/money.js';

// Said when the two legs do not add back to the total they were split from.
//
// Both figures reconstruct from the same balances and the same rows, so they
// cannot disagree unless a read drifted. Publishing the pair without checking
// would put a card on screen whose own three numbers fail to add up — the same
// silent failure UNRECONCILED_BALANCE_NOTICE exists for on the investment card.
export const UNRECONCILED_LEGS_NOTICE =
 'The two sides of the debt position do not add back to the net figure; some balance is counted on neither side.';

/**
 * Everything a stock domain returns, for one month and one page.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @param {object} request - { window, page, pageSize, includeTransactionRows }
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} config - the four values that separate one stock domain from the other
 * @param {string} config.domain - 'debt' or 'pocket'
 * @param {Function} config.getAccountIds - the resolver for this domain's accounts
 * @param {Function} config.getTransactionsPage - the list for this domain's movements
 * @param {boolean} config.publishesTrend - §12 grants pocket a trend and denies debt one
 * @param {boolean} [config.publishesLegs] - §5.1 grants debt the two legs; pocket has none to split
 * @returns {Promise<object>} GetOverviewDomainData for the domain
 */
export async function readStockDomain(
 pool,
 userId,
 { window, page, pageSize, includeTransactionRows = true },
 timeZone,
 { domain, getAccountIds, getTransactionsPage, publishesTrend, publishesLegs = false },
) {
 const { referenceMonth, priorMonth, trendStart } = window;

 // Read once and passed to both consumers. The balance series and the list have
 // to be built over the same accounts or the figure and the rows under it would
 // be answers about two different sets.
 const accountIds = await getAccountIds(pool, userId);

 const [months, oldestAccountDate, transactions, legMonths] = await Promise.all([
  getMonthlyBalance(pool, accountIds, trendStart, referenceMonth, timeZone),
  getOldestAccountDate(pool, userId, timeZone),
  getTransactionsPage(pool, accountIds, referenceMonth, timeZone, {
   page,
   pageSize,
   includeRows: includeTransactionRows,
  }),
  // Only the reference month, not the trend window: the legs are a figure on the
  // card, and §12 publishes no leg series to draw. A domain that does not split
  // never issues this read at all, so the second statement is debt's cost, not
  // every stock domain's.
  publishesLegs
   ? getMonthlyBalanceByLeg(pool, accountIds, referenceMonth, referenceMonth, timeZone)
   : null,
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

 // The same reconstruction the total came from, kept split until the sign was
 // read. totalAmount is NOT recomputed from these: §4.2 wants one figure to have
 // one path, so the legs decompose the total, they never redefine it.
 const legs = legMonths?.[0] ?? null;
 const legFields = legs
  ? {
     payable: legs.payable,
     receivable: legs.receivable,
     settledCount: legs.settledCount,
    }
  : {};

 // Compared through money for the reason every comparison in this module is: a
 // cent of binary float error must not raise a flag that tells the user their
 // books are inconsistent when they are not.
 const legsReconcile =
  !legs || money(legs.receivable).minus(legs.payable).equals(money(currentPoint.totalAmount));

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
  domainFields: legFields,
  notices: [
   ...(canCompare ? [] : [NO_PRIOR_PERIOD_NOTICE]),
   ...(legsReconcile ? [] : [UNRECONCILED_LEGS_NOTICE]),
  ],
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
