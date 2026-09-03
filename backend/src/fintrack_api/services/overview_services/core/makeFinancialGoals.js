// src/fintrack_api/services/overview_services/core/makeFinancialGoals.js

// G1-G3 of §9 — the saving goals widget, aggregated.
//
// This is the Overview's view of pockets, and it is NOT the Pocket module's.
// PLAN_POCKET_ALERT.md governs the per-pocket card and hero — progress bar,
// required per month, status square — one view per goal. This one answers a
// different question: across every goal, how much is saved and how much is left.
// The catalog's own scope note says so, and D29 records that the split stands.
//
// A target of 0.00 is excluded from the total (D30). R59 coerces an absent
// target to zero on write, so a zero row cannot be told apart from a deliberate
// zero — and counting it would make a pocket with no goal read as a goal already
// reached. The local database holds no such row today; the rule is written down
// so the day one appears, nobody has to rediscover the decision.

import { money, toAmount } from '../../budget_services/core/money.js';

// Said when no pocket carries a real target, so there is nothing to aim at and
// nothing to be remaining from.
export const NO_GOAL_SET_NOTICE =
 'No saving goal has a target set, so the target and remaining figures are not reported.';

// Said when some pockets have a target and others do not. The totals are then
// about a subset of the pockets the balance counts, and that asymmetry has to be
// stated rather than smoothed over.
export const PARTIAL_GOAL_COVERAGE_NOTICE =
 'Some pockets have no target, so the target and remaining figures cover fewer pockets than the balance does.';

/**
 * Build the frozen FinancialGoalsSection.
 *
 * goalsTotalBalance counts EVERY pocket, including the ones with no target: the
 * money is saved whether or not it was aimed at something. The other two figures
 * count only the pockets that have a real target, which is why the two can cover
 * different sets and why that difference is announced.
 *
 * goalsTotalRemaining is floored at nothing — it is a plain subtraction, so a
 * goal already exceeded contributes a negative and reduces what is left overall.
 * Clamping it would report more work outstanding than there is.
 *
 * @param {object} input
 * @param {Array<{balance: number, target: number|null}>} input.goals - one entry per pocket
 * @param {string} input.currency
 * @param {string[]} [input.notices]
 * @returns {object} frozen FinancialGoalsSection
 */
export const makeFinancialGoals = ({ goals, currency, notices = [] }) => {
 // D30: null and 0 are both "no target", for different reasons and with the
 // same consequence.
 const withTarget = goals.filter((goal) => goal.target !== null && goal.target !== 0);

 const totalBalance = goals.reduce((sum, goal) => sum.plus(goal.balance), money(0));

 const sectionNotices = [...notices];
 if (withTarget.length === 0) {
  sectionNotices.push(NO_GOAL_SET_NOTICE);
 } else if (withTarget.length < goals.length) {
  sectionNotices.push(PARTIAL_GOAL_COVERAGE_NOTICE);
 }

 const totalTarget = withTarget.length === 0
  ? null
  : withTarget.reduce((sum, goal) => sum.plus(goal.target), money(0));

 return Object.freeze({
  goalsTotalBalance: toAmount(totalBalance),
  // null and never 0 (R59/R60): an absent target is not a target of zero, and
  // the frontend renders a dash for it.
  goalsTotalTarget: totalTarget === null ? null : toAmount(totalTarget),
  // Measured against the balance of the pockets that HAVE a target, not against
  // every pocket. Subtracting a targetless pocket's savings from the goal would
  // report progress toward a goal that money was never aimed at.
  goalsTotalRemaining: totalTarget === null
   ? null
   : toAmount(totalTarget.minus(
    withTarget.reduce((sum, goal) => sum.plus(goal.balance), money(0)),
   )),
  currency,
  meta: Object.freeze({
   notices: Object.freeze(sectionNotices),
   provenance: null,
  }),
 });
};
