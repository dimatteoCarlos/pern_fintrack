// src/fintrack_api/services/overview_services/core/makeInvestmentAnalysis.js

// The level-2 section of the Investment domain, and the one place a level-1
// prohibition is lifted.
//
// The card publishes contributed capital, realised result, closure adjustment
// and the ledger balance, emits a sentence when they fail to agree, and refuses
// the DIFFERENCE between them. §6 is explicit that the client reconciles and the
// server never publishes that number.
//
// Level 2 may publish it on one condition, and the condition is met here: it
// publishes the TOLERANCE with it. The prohibition was never about the
// subtraction — four published fields make that trivial — it was about a client
// subtracting in floating point, finding a cent the server's decimal comparison
// did not find, and telling the owner their books are broken. Stating the
// threshold below which this server calls a difference zero gives the client the
// one thing it cannot reconstruct. Without the tolerance the field stays
// refused, so the two are emitted together or not at all.
//
// No monthly series, and that is a decision rather than a gap. These figures are
// accumulations and positions; a series of an accumulation is a curve that only
// rises, which tells an owner less than its two endpoints do. The flow this
// domain does have a series of is the contribution history, which is a series of
// EVENTS and not of months.

import { money, toAmount, MINIMUM_AMOUNT } from '../../budget_services/core/money.js';
import { makeDistribution } from './makeDistribution.js';

// Said when the owner has no investment account. Both distributions are absent
// rather than empty: empty says the accounts exist and hold nothing, absent says
// there is no portfolio to distribute.
export const NO_PORTFOLIO_NOTICE =
 'There is no investment account, so the portfolio is not broken down.';

// Said when nothing beyond the opening ever funded the accounts. The same
// condition the card already publishes as its own notice, restated here because
// an empty history and an absent one are different answers and only a sentence
// separates them.
export const NO_CONTRIBUTION_HISTORY_NOTICE =
 'No contribution has been recorded beyond the account opening, so there is no history to list.';

/**
 * Build the frozen investment analysis.
 *
 * The reconciliation is itemised: the three terms, the balance they are checked
 * against, the difference and the tolerance. The terms are copied from the card
 * and never recomputed — they arrive from one statement that produced them at
 * one cut, and a second reading here would be the disagreement the card's notice
 * exists to report.
 *
 * difference is left side minus right side, so a POSITIVE value means the terms
 * account for more than the balance holds. It is signed and never absolute: the
 * direction is the first thing a reader needs and an absolute value throws it
 * away.
 *
 * tolerance is the smallest amount this server can express. Every figure above
 * is rounded to it before the comparison, so a difference the server calls zero
 * is exactly zero at that scale, and a client finding anything smaller has found
 * floating point rather than a discrepancy.
 *
 * @param {object} input
 * @param {string} input.level - the requested depth
 * @param {object} input.card - the frozen investment card, read for its terms
 * @param {Array<{accountId: number, accountName: string, balance: number}>} [input.balances]
 * @param {{rows: Array<object>, totalRows: number}} [input.contributions] - the
 *   funding events, newest first, and how many of them exist
 * @returns {object} frozen analysis section
 */
export const makeInvestmentAnalysis = ({ level, card, balances, contributions }) => {
 const notices = [];

 const difference = toAmount(
  money(card.capitalContributed)
   .plus(card.realizedPnl)
   .plus(card.closureAdjustment)
   .minus(card.ledgerBalance),
 );

 let balanceByAccount;
 if (balances !== undefined) {
  if (balances.length === 0) {
   notices.push(NO_PORTFOLIO_NOTICE);
  } else {
   // A zero-balance account is a real row and stays in the distribution. It is
   // an account the owner opened and emptied, which is a different situation
   // from one they never had, and the share carries that as a 0 rather than the
   // row carrying it as an absence.
   balanceByAccount = makeDistribution(
    balances.map((account) => ({
     accountId: account.accountId,
     accountName: account.accountName,
     label: account.accountName,
     amount: account.balance,
    })),
    card.ledgerBalance,
   );
  }
 }

 let contributionHistory;
 if (contributions !== undefined) {
  if (contributions.rows.length === 0) {
   notices.push(NO_CONTRIBUTION_HISTORY_NOTICE);
  } else {
   // Published with its count, under the two names every list in this module
   // uses. The rows are the newest page of a history with no lower bound, so a
   // reader that cannot tell a page from the whole would read "fifty
   // contributions" off an owner who has made five hundred.
   contributionHistory = Object.freeze({
    rows: Object.freeze(contributions.rows),
    totalRows: contributions.totalRows,
   });
  }
 }

 return Object.freeze({
  domain: 'investment',
  level,
  reconciliation: Object.freeze({
   capitalContributed: card.capitalContributed,
   realizedPnl: card.realizedPnl,
   closureAdjustment: card.closureAdjustment,
   ledgerBalance: card.ledgerBalance,
   difference,
   tolerance: MINIMUM_AMOUNT,
  }),
  ...(balanceByAccount === undefined ? {} : { balanceByAccount: Object.freeze(balanceByAccount) }),
  ...(contributionHistory === undefined ? {} : { contributionHistory }),
  meta: Object.freeze({ notices: Object.freeze(notices) }),
 });
};
