// src/fintrack_api/services/overview_services/core/makeAllCard.js

// The consolidated ALL card of §7. It recalculates nothing.
//
// Five of its six figures are references: the same values the domain cards and
// the hero already published, copied rather than derived a second time. That is
// §4.2 at the top of the page — a consolidated figure that disagrees with the
// card beside it is the defect the whole module was opened to remove (R202).
//
// The sixth, transactionCountAll, is the only figure ALL owns, and it is a count
// rather than a financial formula.

/**
 * Build the frozen AllCard.
 *
 * transactionCountAll is the SUM of the five domain counts, not a COUNT over the
 * transactions table. Two reasons, and either alone would be enough.
 *
 * Counting rows directly would double every two-legged movement: an expense
 * writes a withdraw on the bank and a deposit on the category, and both rows sit
 * on non-slack accounts the user owns. Each domain avoids that by scoping its
 * count to one side's accounts, so adding the five inherits the fix instead of
 * reinventing it.
 *
 * And it honours D15 for free. Transfers do not count, and there is no Transfer
 * domain to contribute a count — the exclusion needs no clause because it needs
 * no query. Investment contributes nothing either: §6 gives its card no count,
 * and its movements are transfers, which D15 excludes anyway.
 *
 * @param {object} input
 * @param {number} input.netWorth - HeroSection.netWorth (H1), the same value
 * @param {number} input.totalIncomePeriod - IncomeCard.totalAmount
 * @param {number} input.totalExpensePeriod - ExpenseCard.totalAmount
 * @param {number} input.netDebtPosition - DebtCard.totalAmount
 * @param {number} input.totalPocketBalance - PocketCard.totalAmount
 * @param {number[]} input.domainCounts - the transactionCount of every card that has one
 * @param {string} input.currency
 * @param {{periodStart: string, periodEnd: string}} input.window
 * @param {string[]} [input.notices]
 * @returns {object} frozen AllCard
 */
export const makeAllCard = ({
 netWorth,
 totalIncomePeriod,
 totalExpensePeriod,
 netDebtPosition,
 totalPocketBalance,
 domainCounts,
 currency,
 window,
 notices = [],
}) => Object.freeze({
 domain: 'all',
 netWorth,
 totalIncomePeriod,
 totalExpensePeriod,
 netDebtPosition,
 totalPocketBalance,
 // Integers, so this is addition and not money arithmetic. Running it through
 // the decimal helper would suggest a rounding question that a count does not
 // have.
 transactionCountAll: domainCounts.reduce((sum, count) => sum + count, 0),
 currency,
 window,
 meta: Object.freeze({
  notices: Object.freeze([...notices]),
  provenance: null,
 }),
});
