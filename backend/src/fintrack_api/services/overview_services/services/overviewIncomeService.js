// src/fintrack_api/services/overview_services/services/overviewIncomeService.js

// The Income domain calculator behind GET /overview/income.
//
// It answers three questions with one round of queries: what came in this period
// (I1-I3), how it moved over six months (D18), and which rows are behind it.
// They are three readings of the same window, so they are one request.
//
// No budget module is involved, and that is the whole difference from expense:
// income has no counterpart to E4/E5, so the card is the base of §5 and nothing
// more. There is no reversal to net either — a transfer cannot name
// income_source as an endpoint, so no movement can undo an income the way
// movement_type_id 6 undoes an expense (D20).

import {
 getIncomeAccountIds,
 getOldestAccountDate,
} from '../db/overviewAccountRepository.js';
import { getMonthlyIncome } from '../db/overviewMonthlyRepository.js';
import { getIncomeTransactionsPage } from '../db/overviewTransactionRepository.js';
import {
 makeDomainCard,
 makePeriodDelta,
 NO_PRIOR_PERIOD_NOTICE,
} from '../core/makeDomainCard.js';
import { makeTrendSeries } from '../core/makeTrendSeries.js';
import { monthEndDate } from '../core/monthArithmetic.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

export const overviewIncomeService = {
 /**
  * Everything GET /overview/income returns, for one month and one page.
  *
  * The window arrives resolved: the controller reads the owner's calendar once
  * per request and every calculator works from the same three months, so two
  * domains on the same screen cannot disagree about which month they are
  * reporting.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { window, page, pageSize }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'income'
  */
 async getIncomeDomainData(
  pool,
  userId,
  { window, page, pageSize, includeTransactionRows = true },
  timeZone = 'UTC',
 ) {
  const { referenceMonth, priorMonth, trendStart } = window;

  // The id set every figure on this page is computed over. Read once and passed
  // to both consumers: built over two different sets, the list and the card
  // would be two answers to the same question on the same screen.
  const accountIds = await getIncomeAccountIds(pool, userId);

  const [months, oldestAccountDate, transactions] = await Promise.all([
   getMonthlyIncome(pool, accountIds, trendStart, referenceMonth, timeZone),
   getOldestAccountDate(pool, userId, timeZone),
   getIncomeTransactionsPage(pool, accountIds, referenceMonth, timeZone, {
    page,
    pageSize,
    includeRows: includeTransactionRows,
   }),
  ]);

  const { currentPoint, delta, canCompare } = makePeriodDelta({
   months,
   referenceMonth,
   priorMonth,
   oldestAccountDate,
  });

  const card = makeDomainCard({
   domain: 'income',
   totalAmount: currentPoint.totalAmount,
   transactionCount: currentPoint.transactionCount,
   delta,
   // The installation's accounting currency, not a currency read off the
   // accounts. D7: every amount is already stored in it, so there is nothing to
   // convert and nothing to disagree about. The day users.currency_id can
   // diverge from it, the conversion is one of presentation over this figure —
   // not a second currency travelling with the card.
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
   // Whole, never paginated: six points are the series, and a page of a trend
   // is not a trend.
   trend: makeTrendSeries(months),
  };
 },
};
