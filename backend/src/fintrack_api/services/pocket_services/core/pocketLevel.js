// backend/src/fintrack_api/services/pocket_services/core/pocketLevel.js

// The one place a pocket is classified. Seven levels, evaluated top down, which
// is what makes them mutually exclusive by construction rather than by a rule
// written in a comment.
//
// It lives on the server for the same reason the board's counts do: a level the
// client derives from the same row is a second answer to the same question, and
// a header that disagrees with the card under it is the defect this module
// already had once. The screen maps a level to a word and a colour; it does not
// decide one.
//
// The criterion is progress against the plan's own line, never nearness to the
// deadline. The retired thirty-day threshold treated a three-month plan and a
// five-year plan identically, and the question the owner asks is not how long is
// left but whether the goal can still be covered.

// How many of the plan's own monthly instalments would have to be found at once
// from here on. On its own pace is on track; needing twice the pace it set is at
// risk.
const AT_RISK_RATIO = 2;
const ON_TRACK_RATIO = 1;

// On track is a BAND around the line, not the point where the ratio is 1.
// RULED 2026-09-04 (POCKET_DECISIONS.md #24.3): the instalment is a division
// that rarely terminates — 12,000 over eleven months is 1,090.909… — so exact
// equality is reached by almost no pocket after its first month, and splitting
// at the point would define a level that never fires.
//
// Expressed on the ratio and not on a sum of money, deliberately: a ratio
// tolerance is worth more money early in a plan and less money late in it,
// which is the property the ratio was chosen for when the thirty-day threshold
// was rejected. Half an instalment short with eleven months left is noise; half
// an instalment short with one month left is not.
//
// Symmetric, because on track has to mean the plan is being met as written and
// a pocket two hundredths over its line is meeting it exactly as much as one
// two hundredths under. The asymmetry belongs in the colour, not the boundary.
const ON_TRACK_BAND = 0.05;

/**
 * The level of one pocket at the evaluation date.
 *
 * @param {object} reading
 * @param {import('decimal.js').Decimal} reading.targetAmount
 * @param {import('decimal.js').Decimal} reading.allocatedAmount
 * @param {boolean} reading.overdue - deadline passed with the target unmet
 * @param {number|null} reading.paceRatio - null when the plan has no window
 * @param {number|null} reading.aheadOfPlan - committed minus what the already-due
 *   instalments required, signed; null when the plan has no window
 * @returns {'aboveTarget'|'completed'|'overdue'|'atRisk'|'behind'|'ahead'|'onTrack'}
 */
export function makePocketLevel({
 targetAmount,
 allocatedAmount,
 overdue,
 paceRatio,
 aheadOfPlan,
}) {
 if (allocatedAmount.greaterThan(targetAmount)) {
  return 'aboveTarget';
 }

 if (allocatedAmount.greaterThanOrEqualTo(targetAmount)) {
  return 'completed';
 }

 if (overdue) {
  return 'overdue';
 }

 // A plan whose window holds no full calendar month publishes no instalment, so
 // there is no pace to fall behind. It reads on track and the card says the plan
 // has no window instead of printing a pace it cannot compute. Two cases: a
 // pocket created days before its own deadline, and the legacy pocket whose
 // creation stamp is migration 020's own date.
 if (paceRatio === null) {
  return 'onTrack';
 }

 if (paceRatio >= AT_RISK_RATIO) {
  return 'atRisk';
 }

 if (paceRatio > ON_TRACK_RATIO + ON_TRACK_BAND) {
  return 'behind';
 }

 // Below the band, where the ratio says the pocket is running early. The signed
 // money decides which way, because on ONE date the two disagree and the money
 // is the one telling the truth. RULED 2026-09-04 (POCKET_DECISIONS.md #24.4):
 // at the close of the month a deadline falls in, when that deadline is the
 // last day of its month, every instalment has fallen due and instalmentsLeft
 // is floored at one — the ratio becomes the remainder over a single instalment
 // and reads low precisely because the plan has run out of months, not because
 // the pocket is doing well. A pocket 180 short of its whole target on its last
 // day is behind, and the card printing "180.00 behind the plan" has to sit
 // under a word that agrees with it.
 //
 // Falling through to onTrack here was the first shape of this branch and it
 // was wrong for the same reason: on track claims the plan is being met, and
 // that pocket is not meeting it.
 //
 // The two finished states above are what keep a met goal out of 'ahead': a
 // completed pocket also sits above its own schedule, so the evaluation order
 // is what makes the word mean "still in progress and running early".
 if (paceRatio < ON_TRACK_RATIO - ON_TRACK_BAND) {
  return aheadOfPlan !== null && aheadOfPlan > 0 ? 'ahead' : 'behind';
 }

 return 'onTrack';
}

// The order the board reports them in, and the order a screen reading the counts
// should keep. Exported so the fold and any consumer share one list instead of
// two literals that drift apart.
//
// It is a READING order, not the evaluation order above: the two finished states
// first, then the live band from the one running early to the one that has run
// out. 'ahead' sits with the readings that ask nothing of the owner rather than
// between onTrack and behind, which is where an earlier draft of the contract
// put it.
export const POCKET_LEVELS = Object.freeze([
 'completed',
 'aboveTarget',
 'ahead',
 'onTrack',
 'behind',
 'atRisk',
 'overdue',
]);
