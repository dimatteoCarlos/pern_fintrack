// src/fintrack_api/services/overview_services/core/makeInvestmentCard.js

// The InvestmentCard of §6 — bespoke, and deliberately not a DomainCardBase.
//
// Its figures are not a total, a count and a delta. capitalContributed and
// ledgerBalance are stocks, realizedPnl and closureAdjustment are flows,
// concentration is a ratio and daysSinceLastContribution is an age. Forcing them
// into the shared shape would need most of them to pretend to be something they
// are not, and the contract says so in as many words.
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

// Said when capitalContributed + realizedPnl + closureAdjustment does not equal
// ledgerBalance.
//
// §6 leaves the reconciliation to the client and refuses to publish a derived
// figure for it, which this respects — it publishes no number. But a card whose
// figures silently fail to add up is the harder half of that pair to notice, the
// same argument that put hasUncategorizedExpense on the expense card instead of
// folding the gap into a subtraction.
//
// The third term was added on 2026-09-06 and it is why this notice is now rare
// rather than routine. It used to fire for every owner who had ever deleted an
// investment account: the deletion writes a reversal row that moves the balance
// and is neither contribution nor result, so a two-term identity could not hold
// and the card called correct books inconsistent.
//
// It stays a sentence and does not become a number, and that is the contract's
// ruling rather than an omission here. §6 says the client reconciles and the
// server publishes the terms and never the difference between them. The recovery
// plan's P3 asks for a reconciliation field, which contradicts it — the plan
// supersedes the sequencing of the older plan, explicitly not the frozen
// contract, so the prohibition stands until the developer lifts it.
//
// The prohibition also costs nothing a client cannot recover: all three terms
// and the balance are published on this card, so the difference is one
// subtraction over four fields that are already there. What the client cannot
// reconstruct is the tolerance — the comparison below runs through the decimal
// library, and a client subtracting in floating point will find a difference of
// a cent where this found none.
//
// Measured on fintrack_dev 2026-09-07 under the developer's authorisation for
// that one count: the identity closes at 0.00 for every owner, and no movement
// type outside the four the terms name appears on an investment account. That
// retires the recovery plan's premise that the identity does not hold; it does
// not retire the notice, which exists for the data nobody has written yet.
export const UNRECONCILED_BALANCE_NOTICE =
 'Contributed capital, realized P/L and closure adjustments do not add up to the ledger balance; some movement on these accounts is none of the three.';

/**
 * Build the frozen InvestmentCard.
 *
 * @param {object} figures
 * @param {number} figures.accountCount - how many investment accounts exist
 * @param {number} figures.capitalContributed - V1, never null: 0 is a new account
 * @param {number} figures.ledgerBalance - V2, never null
 * @param {number} figures.realizedPnl - V3, never null: 0 is a real answer
 * @param {number} figures.closureAdjustment - never null, and NOT what the name
 *   suggests. It sums two arms that are not interchangeable: a movement of the
 *   account-closure type, and a movement whose description carries the
 *   annulment prefix. Measured on fintrack_dev and on the three production
 *   copies, the first arm has no rows anywhere and every row the figure has
 *   ever carried came from the second, so what it reports today is the
 *   ANNULMENT and not the closure. 0 therefore does NOT mean no account was
 *   deleted: a soft delete writes neither arm, and only the annulment leg lands
 *   here at all.
 * @param {number|null} figures.largestBalance - the biggest single balance, null with no accounts
 * @param {number|null} figures.daysSinceLastContribution - V5
 * @param {number} figures.transactionCount - movements on these accounts in the
 *   reference month, the one field this card shares with the other five
 * @param {string} figures.currency
 * @param {string[]} [figures.notices]
 * @returns {object} frozen InvestmentCard
 */
export const makeInvestmentCard = ({
 accountCount,
 capitalContributed,
 ledgerBalance,
 realizedPnl,
 closureAdjustment,
 largestBalance,
 transactionCount,
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
 const reconciles = money(capitalContributed)
  .plus(realizedPnl)
  .plus(closureAdjustment)
  .equals(money(ledgerBalance));
 if (accountCount > 0 && !reconciles) {
  cardNotices.push(UNRECONCILED_BALANCE_NOTICE);
 }

 return Object.freeze({
  domain: 'investment',
  // Published, not merely consulted. It decides two of this card's notices and
  // was then dropped before the freeze, so a client reading "the concentration
  // figure is not reported" could not tell an owner with no investment account
  // from one whose accounts hold nothing. Both notices say which it is in words;
  // a client that renders figures rather than sentences had no field to branch
  // on.
  //
  // It is a new field of the contract and not a restored one. Nothing declared
  // it before — the recovery plan calls it a dropped field, which is true of this
  // function and not of the type.
  //
  // Unbounded, and the repository states it where the figure is computed: it
  // counts the accounts that exist now, not the ones that existed at the
  // reference month. Every money figure on this card obeys the month, so on a
  // past month the count can disagree with them — three accounts reported beside
  // a balance built from the two that were open then. Bounding it needs a
  // creation date the figures query does not read, so it is a change to that
  // statement rather than to this one.
  accountCount,
  // The only field of the shared card shape this card carries. It exists
  // because the page's transactionCountAll sums one count per domain and no
  // other domain counts an investment movement, so without it the page reports
  // a total that is short by every one of them.
  transactionCount,
  capitalContributed,
  ledgerBalance,
  realizedPnl,
  closureAdjustment,
  concentration,
  daysSinceLastContribution,
  currency,
  meta: Object.freeze({
   notices: Object.freeze(cardNotices),
   provenance: null,
  }),
 });
};
