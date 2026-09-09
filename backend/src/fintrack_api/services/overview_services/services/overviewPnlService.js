// src/fintrack_api/services/overview_services/services/overviewPnlService.js

// The realized P/L calculator behind GET /overview/pnl.
//
// PL1-PL3 cover movement_type_id 9 across every account the user owns, not only
// the investment ones. That is what separates it from Investment.V3, which is
// the same movement narrowed to investment accounts — two entries in the catalog
// on purpose, because the Overview list has always shown P/L from the whole book
// while the investment card answers a question about one kind of account.
//
// No trend is published (§12). A P/L card has no monthly flow figure in the
// catalog for a series to derive from, and the field is absent rather than null
// for the same reason §6 omits return % instead of publishing it empty: a null
// field invites a client to ask why it is blank, an absent one invites nothing.
// The six-month series is still fetched, because the delta needs the prior month
// read off the same rows the reference month came from (§4.2).

import {
 getPnlAccountIds,
 getInvestmentAccountIds,
 getOldestAccountDate,
} from '../db/overviewAccountRepository.js';
import { getMonthlyPnl } from '../db/overviewMonthlyRepository.js';
import { getPnlTransactionsPage } from '../db/overviewTransactionRepository.js';
import {
 makeDomainCard,
 makePeriodDelta,
 priorPeriodNotices,
} from '../core/makeDomainCard.js';
import { makePnlAnalysis } from '../core/makePnlAnalysis.js';
import { wantsAnalysis } from '../core/analysisLevels.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

export const overviewPnlService = {
 /**
  * Everything GET /overview/pnl returns, for one month and one page.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * analysis widens the monthly statement and nothing else. The card still
  * publishes no series; the analysis publishes one over the window's long bound,
  * off the query the delta already runs, so this domain gains a series without
  * gaining a second statement that could disagree with the delta.
  *
  * @param {object} request - { window, page, pageSize, analysis }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'pnl'
  */
 async getPnlDomainData(
  pool,
  userId,
  { window, page, pageSize, includeTransactionRows = true, analysis },
  timeZone = 'UTC',
 ) {
  const {
   referenceMonth,
   priorMonth,
   trendStart,
   analysisStart,
   periodStart,
   periodEnd,
  } = window;

  const withAnalysis = wantsAnalysis(analysis);

  // Read once and passed to both consumers, so the figure and the list are the
  // same rows. R212's exclusion lives in the statements rather than here: it
  // has to hold in the total, the count and the list alike, and a filter
  // applied in JavaScript after the fact would only reach the ones that came
  // back.
  // Both sets before the fan-out, because the monthly statement needs both: the
  // wide one selects the rows and the investment one cuts the share of them the
  // card publishes as realised on a position.
  const [accountIds, investmentAccountIds] = await Promise.all([
   getPnlAccountIds(pool, userId),
   getInvestmentAccountIds(pool, userId),
  ]);

  const [months, oldestAccountDate, transactions] = await Promise.all([
   getMonthlyPnl(
    pool,
    accountIds,
    withAnalysis ? analysisStart : trendStart,
    referenceMonth,
    timeZone,
    investmentAccountIds,
   ),
   getOldestAccountDate(pool, userId, timeZone),
   getPnlTransactionsPage(pool, accountIds, referenceMonth, timeZone, {
    page,
    pageSize,
    includeRows: includeTransactionRows,
   }),
  ]);

  const { currentPoint, delta, priorPeriodCoverage } = makePeriodDelta({
   months,
   referenceMonth,
   priorMonth,
   oldestAccountDate,
  });

  const card = makeDomainCard({
   domain: 'pnl',
   // Signed, and negative is a real answer here in a way it is not on an
   // expense card: a losing month is a loss, not an absent figure.
   totalAmount: currentPoint.totalAmount,
   transactionCount: currentPoint.transactionCount,
   delta,
   priorPeriodCoverage,
   currency: ACCOUNTING_CURRENCY_CODE,
   window: {
    periodStart,
    periodEnd,
   },
   notices: priorPeriodNotices(priorPeriodCoverage),
   domainFields: {
    // How much of the month's realised result landed on investment accounts.
    //
    // The card's total spans every account except the internal counterparty,
    // which is the definition §1.4 gives this domain and not a defect to narrow.
    // What was missing is the ability to READ that total: an owner seeing this
    // figure beside the investment card's realised result had no way to tell
    // whether they are the same money seen twice or two different results that
    // happen to agree.
    //
    // On the development data they do agree, and that is a property of the data —
    // no bank or debtor account there carries a profit-and-loss row — rather than
    // of the model. With this field the agreement is legible as an agreement
    // instead of being mistaken for a duplicated card.
    //
    // It is NOT the investment card's figure under another name. That one is an
    // accumulation over the whole history of the investment accounts; this is a
    // flow bounded by the reference month. The two coincide only for an owner
    // whose entire investment history falls inside the month being read.
    //
    // The remainder — what came from every other account — is this subtracted
    // from totalAmount, and it is deliberately not published as a second field:
    // both terms are already on the card, and a figure a client obtains by
    // subtracting two published numbers is not a figure the server owes it.
    realizedFromInvestment: currentPoint.investmentAmount,
   },
  });

  return {
   card,
   transactions: {
    rows: transactions.rows,
    page,
    pageSize,
    totalRows: transactions.totalRows,
   },
   ...(withAnalysis
    ? {
       analysis: makePnlAnalysis({
        level: analysis,
        months,
        // Both terms off the card, so the two parts partition the figure the
        // card published instead of a second read over the same rows.
        totalAmount: card.totalAmount,
        realizedFromInvestment: card.realizedFromInvestment,
       }),
      }
    : {}),
  };
 },
};
