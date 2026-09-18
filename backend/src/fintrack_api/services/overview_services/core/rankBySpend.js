// src/fintrack_api/services/overview_services/core/rankBySpend.js

// The Pareto fold, shared by every level that ranks budget-bearing rows.
//
// It was makeCategoryBreakdown's body until the expense screen gained a second
// level. The arithmetic is the same at both — order by spend, carry the two
// running totals, state where the plan's curve was interrupted — and a second
// copy of it is how the category ranking and the subcategory ranking would end
// up disagreeing about a figure the user reads on one screen (§4.2).
//
// What is NOT here is what a level owns: which rows it ranks, and what a row is
// called. The caller passes both.

import { money, toAmount } from '../../budget_services/core/money.js';

// The running share is kept at four decimals, not the two toRate applies.
//
// cumulativePercentage is a 0-1 ratio, so two decimals is 1% resolution: the
// 80% line of a Pareto would land on the same point for several rows in a long
// tail. Four decimals is the same rounding discipline at the scale the figure is
// actually stated in.
const SHARE_SCALE = 4;

/**
 * Rank rows by spend and carry the Pareto's running totals.
 *
 * Sorted by actualSpent descending, with the row's own label breaking the tie.
 * The tie break is not cosmetic: without it two rows with equal spend can swap
 * between two identical requests, and rank — a field the client renders — would
 * change with no data behind the change.
 *
 * A row whose currency is mixed carries actualSpent: null (V1 does not add
 * across currencies). It is ranked last and contributes 0 to the running total,
 * so the Pareto stays a Pareto of the figures that exist; the row keeps its null
 * and the notice budgetCalculationService already raised says why. Dropping the
 * row instead would break D19's reconciliation with the card.
 *
 * THE PLAN'S CURVE RIDES THE SPEND'S ORDER AND DOES NOT GET ITS OWN. Ranking the
 * plan by plan would draw a second curve over a second sequence of rows, and the
 * two points above one x position would belong to different rows. The order is
 * the spend's, once, and both accumulations are folded in the same pass so they
 * cannot be built over different sequences.
 *
 * A ROW WITH NO PLAN DOES NOT TRUNCATE THE CURVE. Such a row carries the running
 * plan forward unchanged and the curve continues past it. Its last point then
 * means the plan of the rows that HAVE one, which is not the total budget, and
 * hasSkippedBudget is what says so rather than leaving the reader to compare two
 * totals that were never meant to match.
 *
 * @param {object[]} rows - rows carrying actualSpent and budgetAmount, frozen
 * @param {(row: object) => string} labelOf - the row's name, for the tie break
 * @returns {object[]} the same rows with rank and the two curves
 */
export const rankBySpend = (rows, labelOf) => {
 const spentOf = (row) => row.actualSpent ?? 0;

 const ranked = [...rows].sort((a, b) => {
  const difference = spentOf(b) - spentOf(a);
  return difference !== 0 ? difference : labelOf(a).localeCompare(labelOf(b));
 });

 const total = ranked.reduce((sum, row) => sum.plus(spentOf(row)), money(0));

 // The denominator of the plan's curve is the plan of the rows that HAVE one,
 // not the budget the card publishes. Dividing by the card's figure would give a
 // curve that never reaches 1 whenever a row was skipped, and a curve short of
 // its own end reads as missing data rather than as a stated exclusion.
 const budgetTotal = ranked.reduce(
  (sum, row) => (row.budgetAmount === null ? sum : sum.plus(row.budgetAmount)),
  money(0),
 );

 let running = money(0);
 let runningBudget = money(0);
 let skipped = false;

 // Spread into a new object rather than assigned: the status builders return
 // Object.freeze'd rows, so a mutation here would fail silently in sloppy mode
 // and throw under a module's strict mode — and either way it would be editing a
 // value another caller may already hold.
 return ranked.map((row, index) => {
  running = running.plus(spentOf(row));

  // INCLUSIVE OF THIS ROW. The flag exists to say whether the running figure
  // printed next to it accounts for every row up to that point, so the row that
  // breaks it is the row that has to raise it.
  if (row.budgetAmount === null) {
   skipped = true;
  } else {
   runningBudget = runningBudget.plus(row.budgetAmount);
  }

  return {
   ...row,
   rank: index + 1,
   // Rounded through toAmount, the same rounding the rows under it already went
   // through, so the last cumulative value equals the sum of the rows the user
   // can see rather than missing it by a cent.
   cumulativeActual: toAmount(running),
   // 0 when nothing was spent at all. There is no share of zero to distribute,
   // and the alternative — a division by zero — is the invented number the
   // money rules forbid.
   cumulativePercentage: total.isZero()
    ? 0
    : running.dividedBy(total).toDecimalPlaces(SHARE_SCALE).toNumber(),
   // Rounded the same way cumulativeActual is, and for the same reason: the last
   // point has to equal the sum of the budgetAmount values the user can read off
   // the rows, rather than missing it by a cent.
   cumulativeBudget: toAmount(runningBudget),
   // 0 when no row carries a plan, which is the same division-by-zero refusal
   // the spend's share makes one line above. It is not "the plan is complete at
   // this point": hasSkippedBudget beside it says which of the two it is.
   cumulativeBudgetPercentage: budgetTotal.isZero()
    ? 0
    : runningBudget.dividedBy(budgetTotal).toDecimalPlaces(SHARE_SCALE).toNumber(),
   hasSkippedBudget: skipped,
  };
 });
};
