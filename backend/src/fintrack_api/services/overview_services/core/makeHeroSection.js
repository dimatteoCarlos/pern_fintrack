// src/fintrack_api/services/overview_services/core/makeHeroSection.js

// The hero figures of §4 (H1-H3 and liquid net worth), composed from the domain
// cards (D27).
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
// No figure in this file carries a pocket term, and both halves of that are
// rulings this codebase already made rather than choices available here.
//
// It is not a term of net worth because a pocket is a plan and not a container:
// the money stays inside the bank account it was promised from, so the bank
// balance already counts it and adding it again counts it twice. The live screen
// has never carried a pocket term (OverviewLayout.tsx:134-135) and is right not
// to.
//
// It is not SUBTRACTED from the cash position either, and that is the half the
// symmetry invites getting wrong. What a pocket constrains is committing, not
// spending. The allocation guard does refuse a commitment above the account
// balance less what is already allocated, and it names that remainder unassigned
// cash — but the function that computes it states that the available
// balance is still the whole account balance, because a pocket never blocks a
// spend and naming the remainder available would tell the owner they cannot spend
// money they can (the jsdoc on makeAccountAllocation). An expense against
// committed money is always accepted, which is why the remainder may go negative
// and that is a state rather than an error.
//
// So the cash position is the bank balance. A figure that subtracted would be
// neither the balance nor anything the owner can act on, and it would contradict
// what the expense path will actually let them spend. If the Overview is later to
// warn about overcommitment, the committed total goes BESIDE the balance and never
// inside it — which is what the funding-account picker already does, so
// that no single one of the three figures can be called available.
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
//
// Liquid net worth IS a fourth figure and is defended as one. It answers a
// question none of H1-H3 answers: what the owner holds that is liquid, less what
// the owner owes, with money owed TO the owner excluded. Net worth counts a
// receivable as wealth, which it is, and as available, which it is not — whether
// it arrives is someone else's decision. It adds no query: the payable leg comes
// off the debt card, which now publishes both legs of the position it nets.
//
// It is composed from the two stocks and the payable leg, NOT as net worth minus
// the receivable leg. The two are arithmetically identical, and only the first
// leaves `netWorth - liquidNetWorth == receivable` as something that can fail.
// Derived from net worth it becomes a tautology, and the one check that catches
// a flipped payable sign stops catching anything: get that sign backwards and
// the subtraction becomes an addition, which still prints a plausible figure.
//
// Pocket commitments are not subtracted from it, and the reason is not that free
// cash is a different question: it is that a pocket does not constrain spending
// at all. The header states the ruling and where it lives.

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

// Said when the debt card did not carry its payable leg. Without it the figure
// cannot be composed, and the two ways of faking it are both worse than
// withholding it: treating the missing leg as 0 publishes a liquid net worth
// that silently equals the owner's gross position, and dropping the term
// publishes the same wrong figure under the right name. null with a reason is
// the rule for a figure that cannot be computed (§6).
export const NO_DEBT_LEGS_NOTICE =
 'The debt position did not report what is owed, so liquid net worth is not reported.';

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
 * @param {number} input.payable - DebtCard.payable, a positive magnitude (D39)
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
 payable,
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

 // Guarded on the value being a finite number rather than on it being present,
 // because the ways this arrives broken are undefined and NaN, and both of those
 // reach the decimal library as a figure rather than as an absence.
 const liquidNetWorth = Number.isFinite(payable)
  ? toAmount(money(bankBalance).plus(investmentBalance).minus(payable))
  : null;

 const heroNotices = [...notices];
 if (savingsRate === null) {
  heroNotices.push(income.isZero() ? NO_INCOME_NOTICE : NEGATIVE_INCOME_NOTICE);
 }
 if (liquidNetWorth === null) {
  heroNotices.push(NO_DEBT_LEGS_NOTICE);
 }

 return Object.freeze({
  // H1 — the three account kinds the catalog counts as real money. A pocket is
  // not a fourth. Committing money to one moves nothing, so the committed total
  // is already inside bankBalance: the allocation guard proves it by computing
  // its ceiling as the account balance minus what is allocated
  // (pocketAllocationService.js:345-347). Adding it here counted it twice.
  netWorth: toAmount(
   money(bankBalance)
    .plus(investmentBalance)
    .plus(debtPosition),
  ),
  // The same holdings with the receivable leg taken out, so what is left is what
  // the owner controls. Negative is a real answer: it says the debts outweigh
  // everything liquid. null only when the payable leg did not arrive.
  liquidNetWorth,
  // H2 — what is spendable without selling a position or collecting a debt.
  // Bank alone, for the same reason: a pocket total is a commitment against this
  // figure, never an addition to it.
  cashPosition: toAmount(money(bankBalance)),
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
