// src/fintrack_api/services/overview_services/core/makeDistribution.js

// One shape for the level-2 distributions: rank the parts, carry each one's
// share of the whole.
//
// It is the same fold makeCategoryBreakdown performs for the expense Pareto, and
// it is NOT shared with it. That one carries a running total, orders against a
// budget module's rows and states its own rounding for the 80% line; folding the
// two would put a Pareto's obligations on a plain distribution and force every
// caller to know which fields belong to which chart.
//
// What is shared here instead is the part that must never differ: how a part is
// ranked and how its share is computed. Two distributions on one screen ordering
// their ties differently would change rank with no data behind the change.

import { money } from '../../budget_services/core/money.js';

// Four decimals, not the two toRate applies, and the reason is the tail.
//
// A share is a 0-1 ratio, so two decimals is 1% resolution: every source
// contributing under half a percent rounds to 0.00 and reads as a part that
// contributed nothing, which is the one thing a distribution must not say about
// a row it is publishing. makeCategoryBreakdown reached the same scale for the
// same reason on the Pareto's running share.
const SHARE_SCALE = 4;

/**
 * Rank the parts of a total and give each one its share.
 *
 * Ordered by amount descending with the label breaking the tie. The tie break is
 * not cosmetic: without it two parts of equal size can swap between two
 * identical requests, and a rendered rank would move with no change behind it.
 *
 * share is a 0-1 ratio and is null — never 0 — when the total is zero. A share
 * of a total of nothing is not a small share; it is a division that has no
 * answer, and 0 would read as "this part contributed nothing" for a part that is
 * the whole of an empty set.
 *
 * A NEGATIVE total is left to divide as it stands rather than guarded. It cannot
 * arise on the two distributions built today — income legs are deposits and a
 * portfolio's ledger balance is the sum being distributed — and inventing a rule
 * for it here would be a rule no caller asked for and none could test.
 *
 * The total arrives from the caller rather than being summed here, and that is
 * the point: the share has to be a share of the figure the card already
 * published, not of a second sum over these rows that could differ from it by a
 * row this statement missed.
 *
 * @param {Array<{label: string, amount: number}>} parts - the rows, in any order
 * @param {number} total - the published figure the shares are taken against
 * @returns {Array<object>} the same rows, ranked, each with rank and share
 */
export const makeDistribution = (parts, total) => {
 const whole = money(total);

 const ranked = [...parts].sort((a, b) => {
  const difference = b.amount - a.amount;
  return difference !== 0 ? difference : a.label.localeCompare(b.label);
 });

 return ranked.map((part, index) => ({
  ...part,
  rank: index + 1,
  share: whole.isZero()
   ? null
   : money(part.amount).dividedBy(whole).toDecimalPlaces(SHARE_SCALE).toNumber(),
 }));
};
