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
//
// The savings rate rides along with H3 and does NOT make this a four-figure
// hero. It divides H3 by one of the two operands H3 was already built from, so
// it adds no input, no query and no time base: it is the same movement stated as
// a share instead of an amount. A fourth FIGURE would have to be defended
// against the rule that the hero carries three; a second reading of the third
// one does not.

import { money, toAmount, toRate } from '../../budget_services/core/money.js';

// Said when the month recorded no income at all, which makes the savings rate a
// division by zero rather than a rate of zero. Kept apart from the case below:
// one is a month with nothing coming in, the other is a month whose income total
// came out negative, and they need different sentences because they are
// different situations for the owner.
export const NO_INCOME_NOTICE =
 'No income was recorded this month, so the savings rate is not reported.';

// Said when refunds or reversals pushed the month's income total below zero. The
// ratio is arithmetically computable and reports a lie: dividing by a negative
// denominator inverts the sign, so a month that lost money would report a
// positive rate. Withheld rather than published inverted.
export const NEGATIVE_INCOME_NOTICE =
 'The recorded income for this month is negative, so the savings rate is not reported.';

/**
 * What share of the month's income was kept.
 *
 * The rate form of netMonthlyFlow over the same two operands and the same time
 * base — not a fourth figure, which is why it lives here rather than earning a
 * block of its own. The precedent is the investment card's concentration: a rate
 * reported beside the absolute figures it is derived from.
 *
 * Expressed 0-1, matching every other rate this contract publishes, and never
 * clamped at either end. Above 1 is a real month in which a refund landed and
 * more was kept than came in; below 0 is a real month in which more went out
 * than came in. Both are answers, not errors.
 *
 * greaterThan and not isPositive, for the reason the pocket board already
 * records against the same trap: Decimal tests the SIGN, and zero is signed
 * positive, so isPositive() admits the division by zero this guard exists to
 * refuse.
 *
 * @param {Decimal} income - the month's income total
 * @param {Decimal} netFlow - income minus expense, already computed
 * @returns {number|null} the rate, or null when income cannot be a denominator
 */
const savingsRateOf = (income, netFlow) =>
 income.greaterThan(0) ? toRate(netFlow.dividedBy(income)) : null;

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
}) => {
 const income = money(incomeTotal);
 // Computed once and used twice, so the published amount and the denominator of
 // the rate cannot drift apart the way two separate expressions eventually do.
 const netFlow = income.minus(expenseTotal);
 const savingsRate = savingsRateOf(income, netFlow);

 const heroNotices = [...notices];
 if (savingsRate === null) {
  heroNotices.push(income.isZero() ? NO_INCOME_NOTICE : NEGATIVE_INCOME_NOTICE);
 }

 return Object.freeze({
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
  netMonthlyFlow: toAmount(netFlow),
  // The same movement as a share of what came in. null when income cannot be a
  // denominator, never 0 — a month with no income did not save nothing, it has
  // no rate at all, and the two read identically once printed as 0%.
  savingsRate,
  currency,
  meta: Object.freeze({
   notices: Object.freeze(heroNotices),
   provenance: null,
  }),
 });
};
