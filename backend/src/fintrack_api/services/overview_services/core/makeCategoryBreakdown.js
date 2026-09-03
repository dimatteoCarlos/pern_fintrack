// src/fintrack_api/services/overview_services/core/makeCategoryBreakdown.js

// D19 — the expense breakdown, one array serving both the donut and the Pareto.
//
// One array and not two (distribution / pareto) so the two charts read literally
// the same rows. Two arrays could be built from two orderings of two queries and
// show different figures for the same category on the same screen, which is the
// class of defect §4.2 exists to prevent.
//
// The eight base fields are NOT recomputed here. They arrive already built by
// makeBudgetCategoryStatus, through budgetCalculationService.getBudgetAccountsStatus,
// and this module only decorates them. makeCategoryGroups — the fold that
// produces them — is private to budgetCalculationService.js:260, and exporting it
// would open the contract D6 freezes; calling the public method whole reuses the
// same arithmetic without touching that module at all.
//
// Three fields are added because they do not exist anywhere today: makeCategoryGroups
// sorts alphabetically, which is the right order for a list of categories and the
// wrong one for a Pareto. Ordering by spend and carrying the running total is the
// new work, and by §4.1 it happens here rather than in a React component.

import { money, toAmount } from '../../budget_services/core/money.js';

// The running share is kept at four decimals, not the two toRate applies.
//
// cumulativePercentage is a 0-1 ratio, so two decimals is 1% resolution: the
// 80% line of a Pareto would land on the same point for several categories in a
// long tail. Four decimals is the same rounding discipline at the scale the
// figure is actually stated in.
const SHARE_SCALE = 4;

/**
 * Rank the categories by spend and carry the Pareto's running total.
 *
 * Sorted by actualSpent descending, with categoryName breaking the tie. The tie
 * break is not cosmetic: without it two categories with equal spend can swap
 * between two identical requests, and rank — a field the client renders — would
 * change with no data behind the change.
 *
 * A category whose currency is mixed carries actualSpent: null (V1 does not add
 * across currencies). It is ranked last and contributes 0 to the running total,
 * so the Pareto stays a Pareto of the figures that exist; the row keeps its null
 * and the notice budgetCalculationService already raised says why. Dropping the
 * row instead would break D19's reconciliation with the card.
 *
 * @param {object[]} categories - ExpenseCategoryStatus base fields, frozen objects
 * @returns {object[]} the same rows with rank, cumulativeActual and cumulativePercentage
 */
export const makeCategoryBreakdown = (categories) => {
 const spentOf = (category) => category.actualSpent ?? 0;

 const ranked = [...categories].sort((a, b) => {
  const difference = spentOf(b) - spentOf(a);
  return difference !== 0 ? difference : a.categoryName.localeCompare(b.categoryName);
 });

 const total = ranked.reduce((sum, category) => sum.plus(spentOf(category)), money(0));

 let running = money(0);

 // Spread into a new object rather than assigned: makeBudgetCategoryStatus
 // returns Object.freeze'd rows, so a mutation here would fail silently in
 // sloppy mode and throw under a module's strict mode — and either way it would
 // be editing a value another caller may already hold.
 return ranked.map((category, index) => {
  running = running.plus(spentOf(category));

  return {
   ...category,
   rank: index + 1,
   // Rounded through toAmount, the same rounding the account rows under it
   // already went through, so the last cumulative value equals the sum of the
   // rows the user can see rather than missing it by a cent.
   cumulativeActual: toAmount(running),
   // 0 when nothing was spent at all. There is no share of zero to distribute,
   // and the alternative — a division by zero — is the invented number the
   // money rules forbid.
   cumulativePercentage: total.isZero()
    ? 0
    : running.dividedBy(total).toDecimalPlaces(SHARE_SCALE).toNumber(),
  };
 });
};
