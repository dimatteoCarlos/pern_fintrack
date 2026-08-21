// src/fintrack_api/services/overview_services/core/makeInvestmentCard.js

// The InvestmentCard of §6 — bespoke, and deliberately not a DomainCardBase.
//
// Its five figures are not a total, a count and a delta. capitalContributed and
// ledgerBalance are stocks, realizedPnl is a flow, concentration is a ratio and
// daysSinceLastContribution is an age. Forcing them into the shared shape would
// need four of them to pretend to be something they are not, and the contract
// says so in as many words.
//
// D9 forbids publishing a return percentage or a market value. They are absent
// from the type rather than present and null: a null field invites a client to
// ask why it is empty, and the honest answer — there is no valuation model — is
// not a temporary emptiness. Unrealized gain is not reported at all.
//
// Nothing here queries. The figures arrive computed and this builds the one that
// is arithmetic on them (V4) and freezes the result.

// toRate and not toAmount: concentration is a ratio that never enters a sum, so
// it is rounded by the rule that exists for ratios rather than by the one that
// exists for money.
import { money, toRate } from '../../budget_services/core/money.js';

// Said when the user owns no investment account, so there is nothing to be
// concentrated in. Different from "your money is spread evenly": one is an
// absent portfolio, the other is a diversified one.
export const NO_INVESTMENT_ACCOUNTS_NOTICE =
 'There is no investment account, so the concentration figure is not reported.';

// Said when the accounts exist but hold nothing between them, which makes the
// ratio a division by zero rather than a small number.
export const EMPTY_PORTFOLIO_NOTICE =
 'The investment accounts hold no balance, so the concentration figure is not reported.';

// Said when nothing beyond the opening ever funded the accounts. The catalog
// asks for this explicitly: a number invented here would read as a recent
// contribution that never happened.
export const NO_CONTRIBUTIONS_NOTICE =
 'No contribution has been recorded beyond the account opening.';

// Said when capitalContributed + realizedPnl does not equal ledgerBalance.
//
// §6 leaves the reconciliation to the client and refuses to publish a sixth
// derived figure, which this respects — it publishes no number. But a card whose
// three figures silently fail to add up is the harder half of that pair to
// notice, the same argument that put hasUncategorizedExpense on the expense
// card instead of folding the gap into a subtraction.
export const UNRECONCILED_BALANCE_NOTICE =
 'Contributed capital and realized P/L do not add up to the ledger balance; some movement on these accounts is neither.';

/**
 * Build the frozen InvestmentCard.
 *
 * @param {object} figures
 * @param {number} figures.accountCount - how many investment accounts exist
 * @param {number} figures.capitalContributed - V1, never null: 0 is a new account
 * @param {number} figures.ledgerBalance - V2, never null
 * @param {number} figures.realizedPnl - V3, never null: 0 is a real answer
 * @param {number|null} figures.largestBalance - the biggest single balance, null with no accounts
 * @param {number|null} figures.daysSinceLastContribution - V5
 * @param {string} figures.currency
 * @param {string[]} [figures.notices]
 * @returns {object} frozen InvestmentCard
 */
export const makeInvestmentCard = ({
 accountCount,
 capitalContributed,
 ledgerBalance,
 realizedPnl,
 largestBalance,
 daysSinceLastContribution,
 currency,
 notices = [],
}) => {
 const cardNotices = [...notices];

 // V4 in three cases, and only one of them is a number. With one account the
 // ratio is 1 and that is correct, not a defect to smooth over later: all of
 // the money is in one place.
 let concentration = null;
 if (accountCount === 0) {
  cardNotices.push(NO_INVESTMENT_ACCOUNTS_NOTICE);
 } else if (money(ledgerBalance).isZero() || largestBalance === null) {
  cardNotices.push(EMPTY_PORTFOLIO_NOTICE);
 } else {
  concentration = toRate(money(largestBalance).dividedBy(ledgerBalance));
 }

 if (daysSinceLastContribution === null && accountCount > 0) {
  cardNotices.push(NO_CONTRIBUTIONS_NOTICE);
 }

 // Compared through money for the reason every comparison in this module is:
 // a cent of binary float error must not raise a flag that tells the user their
 // books are inconsistent when they are not.
 const reconciles = money(capitalContributed).plus(realizedPnl).equals(money(ledgerBalance));
 if (accountCount > 0 && !reconciles) {
  cardNotices.push(UNRECONCILED_BALANCE_NOTICE);
 }

 return Object.freeze({
  domain: 'investment',
  capitalContributed,
  ledgerBalance,
  realizedPnl,
  concentration,
  daysSinceLastContribution,
  currency,
  meta: Object.freeze({
   notices: Object.freeze(cardNotices),
   provenance: null,
  }),
 });
};
