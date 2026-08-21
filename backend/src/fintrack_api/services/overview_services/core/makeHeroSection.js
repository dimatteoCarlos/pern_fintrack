// src/fintrack_api/services/overview_services/core/makeHeroSection.js

// The three hero figures of §4 (H1-H3), composed from the domain cards (D27).
//
// The catalog gives H1-H3 formulas of their own, and running them literally
// would put the hero and the cards under it on two separate paths to the same
// money. The user adds four cards, does not get the hero's number, and has no
// way to tell which one is lying. §7 already forbade ALL from recalculating what
// a domain computed; the hero was outside that ban for no reason, so it is
// brought inside it.
//
// Only one input is not a card: the bank balance. It is the single stock no
// domain card publishes, because there is no Bank domain in §3.
//
// H3 benefits twice. Composed from the two cards it is arithmetic on figures
// already verified, and it inherits D22's correction instead of repeating the
// inverted leg the catalog had written into BOTH of its terms.

import { money, toAmount } from '../../budget_services/core/money.js';

/**
 * Build the frozen HeroSection.
 *
 * Every figure is signed the way the ledger signs it. A debtor balance is
 * already net — lending raises it, owing lowers it (movementInputHandler.js:32-53)
 * — so netWorth ADDS it and never subtracts it. A negative net worth is a real
 * answer, not an error to clamp.
 *
 * @param {object} input
 * @param {number} input.bankBalance - the only figure no card carries
 * @param {number} input.investmentBalance - InvestmentCard.ledgerBalance (V2)
 * @param {number} input.debtPosition - DebtCard.totalAmount (D1)
 * @param {number} input.pocketBalance - PocketCard.totalAmount (P1)
 * @param {number} input.incomeTotal - IncomeCard.totalAmount (I1)
 * @param {number} input.expenseTotal - ExpenseCard.totalAmount (E1)
 * @param {string} input.currency
 * @param {string[]} [input.notices]
 * @returns {object} frozen HeroSection
 */
export const makeHeroSection = ({
 bankBalance,
 investmentBalance,
 debtPosition,
 pocketBalance,
 incomeTotal,
 expenseTotal,
 currency,
 notices = [],
}) => Object.freeze({
 // H1 — the four account kinds the catalog counts as real money.
 netWorth: toAmount(
  money(bankBalance)
   .plus(investmentBalance)
   .plus(debtPosition)
   .plus(pocketBalance),
 ),
 // H2 — what is spendable without selling a position or collecting a debt.
 cashPosition: toAmount(money(bankBalance).plus(pocketBalance)),
 // H3 — whether the month moved forward or back. Negative is a real answer and
 // the most useful one the figure has.
 netMonthlyFlow: toAmount(money(incomeTotal).minus(expenseTotal)),
 currency,
 meta: Object.freeze({
  notices: Object.freeze([...notices]),
  provenance: null,
 }),
});
