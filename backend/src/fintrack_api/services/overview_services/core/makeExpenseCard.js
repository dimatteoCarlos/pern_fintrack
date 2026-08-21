// src/fintrack_api/services/overview_services/core/makeExpenseCard.js

// The ExpenseCard of §5 and §12 of the contract: the shared base plus E4/E5 (D16).
//
// Nothing here queries. The eight figures arrive already computed — the three
// from the monthly repository, the two from budgetCalculationService — and this
// builds the two that are pure arithmetic on them, hands the shared ones to
// makeDomainCard, and freezes the result.
//
// The three fields every domain card carries are not restated here. They belong
// to DomainCardBase, which §5 declares once for five cards, and NO_PRIOR_PERIOD
// travels with them.
//
// The card carries two spend figures on purpose, and they are NOT the same
// universe (D16). totalAmount is every expense leg of the period; budgetAmount
// and categorizedExpense only count legs that still resolve to a live
// category_budget row. Comparing a budget against totalAmount would report "you
// overspent" when the excess was, in fact, spending that lost its category —
// which is why budgetVariance is stated against categorizedExpense and
// hasUncategorizedExpense reports the gap separately instead of hiding it inside
// a subtraction.

import { money, toAmount } from '../../budget_services/core/money.js';
import { makeDomainCard } from './makeDomainCard.js';

// Said when the period has no budget in force anywhere, so budgetVariance has no
// second operand. It is a different statement from "your budget is 0": one is an
// absent decision, the other is a decision to spend nothing.
export const NO_BUDGET_NOTICE =
 'No category has a budget in force for this period, so the budget figures are not reported.';

// Said when spending exists that no live category accounts for. Structurally
// this cannot be created today (transactionController.js:516-532 rejects a write
// whose destination does not resolve to a category_budget account), so seeing it
// means a category was deleted or lost its budget row — a fact worth naming
// rather than a routine state.
export const UNCATEGORIZED_EXPENSE_NOTICE =
 'Part of this period\'s expense is not accounted for by any current category.';

/**
 * Build the frozen ExpenseCard.
 *
 * budgetAmount arrives null in two different situations and both are reported
 * the same way: no budget in force this period, and a set of categories spanning
 * more than one currency (V1 does not add across currencies). The caller decides
 * which notice to attach; this function only refuses to compute a variance
 * against a number that is not there.
 *
 * @param {object} figures
 * @param {number} figures.totalAmount - E1, never null: 0 is real activity at zero
 * @param {number} figures.transactionCount - E2, the rows totalAmount is made of (D21)
 * @param {number|null} figures.delta - E3, null when no complete prior period exists
 * @param {number|null} figures.budgetAmount - E4
 * @param {number|null} figures.categorizedExpense - D16
 * @param {string} figures.currency
 * @param {{periodStart: string, periodEnd: string}} figures.window
 * @param {string[]} figures.notices
 * @returns {object} frozen ExpenseCard
 */
export const makeExpenseCard = ({
 totalAmount,
 transactionCount,
 delta,
 budgetAmount,
 categorizedExpense,
 currency,
 window,
 notices = [],
}) => {
 const hasBudgetFigures = budgetAmount !== null && categorizedExpense !== null;

 // Compared through money rather than with >, so a cent of binary float error
 // cannot raise a flag that tells the user their data is inconsistent when it
 // is not.
 const hasUncategorizedExpense =
  categorizedExpense !== null &&
  money(totalAmount).greaterThan(money(categorizedExpense));

 // The notice is appended here and not by the caller, so the flag and the
 // sentence that explains it come from the same comparison. Raised in two
 // places they could disagree, and a card that says nothing while the flag is
 // true is the harder half of that pair to notice.
 const cardNotices = hasUncategorizedExpense
  ? [...notices, UNCATEGORIZED_EXPENSE_NOTICE]
  : notices;

 return makeDomainCard({
  domain: 'expense',
  totalAmount,
  transactionCount,
  delta,
  currency,
  window,
  notices: cardNotices,
  domainFields: {
   budgetAmount,
   categorizedExpense,
   budgetVariance: hasBudgetFigures
    ? toAmount(money(budgetAmount).minus(categorizedExpense))
    : null,
   hasUncategorizedExpense,
  },
 });
};
