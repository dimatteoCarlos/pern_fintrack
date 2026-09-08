// src/fintrack_api/services/overview_services/core/makePocketAnalysis.js

// The level-2 section of the Pocket domain.
//
// Two of its three analyses are free, and one of them was already in memory
// being discarded. The card asks pocketBoardService for the board and reads only
// its summary — the per-pocket rows come back in the same call, already carrying
// target, allocated, remaining, progress and the classification the board screen
// paints. §4.6's "which plans are on track and which are not" is those rows.
// They are republished here and not recomputed, which is what makes this section
// and the board screen agree by construction rather than by review.
//
// The third needs two statements the card does not run. The bank balance and
// free cash are page-level reads, and free cash is the one figure of the module
// that cannot be composed from two totals: the per-account floor means an
// overcommitted account contributes nothing instead of contributing a credit
// against a healthy one, so committed against free is a genuine third read and
// belongs at the full level.

import { money, toAmount } from '../../budget_services/core/money.js';
import { makeTrendSeries } from './makeTrendSeries.js';

// Said when the owner has planned no pocket. The progress list is absent rather
// than empty for the reason every distribution in this module is: empty says the
// plans exist and none of them progressed.
export const NO_POCKETS_PLANNED_NOTICE =
 'No savings pocket has been planned, so there is no progress to report.';

// Said when the three terms are served but the promised amount exceeds what the
// accounts hold. It is not an error and not a rounding artifact: an expense
// against committed money is always accepted, so an account can end a month
// owing its pockets more than it holds.
export const OVERCOMMITTED_NOTICE =
 'More is committed to pockets than the bank and cash accounts hold at the close of this period.';

/**
 * Build the frozen pocket analysis.
 *
 * The decomposition names three terms and not two, and the third is why it is a
 * decomposition rather than a subtraction. committed plus free does NOT equal
 * the balance whenever any single account is overcommitted — free is floored per
 * account before the sum, so one account's surplus cannot absorb another's
 * shortfall. Publishing all three is what lets a reader see the gap instead of
 * inferring a wrong one; a client handed two of them would compute the third and
 * be wrong for exactly the owner who most needs it right.
 *
 * That is also the level-2 form of the hero's pair. Level 1 publishes the cash
 * position and free cash side by side and leaves the commitment implicit between
 * them; this states all three.
 *
 * @param {object} input
 * @param {string} input.level - the requested depth
 * @param {Array<{month: string, totalAmount: number}>} input.months - the long series
 * @param {object[]} input.pockets - the board's per-pocket rows, already frozen
 * @param {number} input.committed - the card's total, what the plans claim
 * @param {number} [input.bankBalance] - the balance the commitments sit inside
 * @param {number} [input.freeCash] - what none of the accounts has promised away
 * @returns {object} frozen analysis section
 */
export const makePocketAnalysis = ({
 level,
 months,
 pockets,
 committed,
 bankBalance,
 freeCash,
}) => {
 const notices = [];

 let progressByPocket;
 if (pockets.length === 0) {
  notices.push(NO_POCKETS_PLANNED_NOTICE);
 } else {
  progressByPocket = pockets;
 }

 let committedAgainstFree;
 if (bankBalance !== undefined && freeCash !== undefined) {
  committedAgainstFree = Object.freeze({
   bankBalance,
   committed,
   freeCash,
   // What the floor cost, published rather than left to be discovered. It is 0
   // for an owner whose accounts each cover their own commitments, and positive
   // by exactly the shortfall the floor absorbed otherwise — which is the one
   // number that explains why the three terms above do not add up.
   flooredShortfall: toAmount(
    money(freeCash).plus(committed).minus(bankBalance),
   ),
  });

  if (money(committed).greaterThan(money(bankBalance))) {
   notices.push(OVERCOMMITTED_NOTICE);
  }
 }

 return Object.freeze({
  domain: 'pocket',
  level,
  // The committed POSITION at each month close, thirteen points. The monthly
  // snapshot's pocket entry is the opposite quantity — a flow — and the two stay
  // two statements on purpose (D28).
  series: Object.freeze(makeTrendSeries(months)),
  ...(progressByPocket === undefined
   ? {}
   : { progressByPocket: Object.freeze(progressByPocket) }),
  ...(committedAgainstFree === undefined ? {} : { committedAgainstFree }),
  meta: Object.freeze({ notices: Object.freeze(notices) }),
 });
};
