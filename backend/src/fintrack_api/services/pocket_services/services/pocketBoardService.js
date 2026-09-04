// backend/src/fintrack_api/services/pocket_services/services/pocketBoardService.js

// The pocket board: every pocket the caller owns, plus the totals over them,
// from one request.
//
// It replaces two dashboard endpoints the board used to call side by side —
// dashboard/balance/type?type=pocket_saving for the header and
// dashboard/balance/summary/?type=pocket_saving for the list. Two requests for
// one screen is the shape D12 rules out, and it is also how the header came to
// disagree with the list: the two queries grouped differently, and the header's
// handler read rows[0] of a per-currency GROUP BY.
//
// Every figure below is computed here, the four counts included. A count the
// client repeats from the same rows is a second answer to the same question, and
// the disagreement between a header and the list under it is the defect this
// module already had.
//
// No pace is derived from the ledger. A rate over allocation rows measures how
// often the owner changed their mind, not how fast money arrived, so runRate and
// projectedDate do not ship; requiredMonthly is a division of the remainder by
// the horizon and needs no history at all.
//
// The plan's line does not contradict that. It asks where a plan SHOULD be by
// now, from the target, the deadline and the day the plan was made — three
// stored values and no sequence of rows. The rejected figure asked how fast the
// owner has been moving, which is the question that needs a history.
//
// The board reads one month. Every figure is cumulative to that month's close,
// or to today when the current month is asked for, and the movement figures say
// what happened inside it. That contradicts the earlier statement that this
// endpoint carries nothing; the parameter is optional and its absence still
// means the current month.

import { getCalendarToday, getPocketsForUser } from '../db/pocketRepository.js';
import {
 getAccountAllocations,
 getPocketSourceHoldings,
} from '../db/accountAllocationRepository.js';
import { makePocketStatus } from '../core/makePocketStatus.js';
import { makeAccountAllocation } from '../core/makeAccountAllocation.js';
import { POCKET_LEVELS } from '../core/pocketLevel.js';
import { toAmount, toRate, money } from '../../budget_services/core/money.js';

const HUNDRED = 100;

/**
 * The one date every comparison on this board reads.
 *
 * The current month is evaluated at today, so the board keeps saying what is
 * true now. A past month is evaluated at its own close, so a figure read in
 * September for August answers as August ended and does not drift a day further
 * every day.
 *
 * Both labels are already on the owner's calendar — today comes from
 * getCalendarToday and the month from the validated parameter — so this is
 * label arithmetic and touches no zone. Day 0 of the following month is the last
 * day of this one, which is the only Date use here and it never leaves UTC.
 *
 * @param {string} monthStart - YYYY-MM-01
 * @param {string} today - YYYY-MM-DD on the owner's calendar
 * @returns {string} YYYY-MM-DD
 */
const resolveEvaluationDate = (monthStart, today) => {
 if (monthStart.slice(0, 7) === today.slice(0, 7)) {
  return today;
 }

 const year = Number(monthStart.slice(0, 4));
 const month = Number(monthStart.slice(5, 7));
 const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

 return `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
};

// The rule the budget module settled and this one adopts unchanged: amounts in
// two currencies are not added at an implicit 1:1. Every pocket is written in
// the one accounting currency, so this is an invariant guard rather than a live
// branch — and it is kept because a guard that never fires costs nothing while a
// silent 1:1 addition costs a total.
const MIXED_CURRENCY_NOTICE =
 'Totals add amounts in more than one currency and are not converted.';

/**
 * Which pockets have a source account that no longer covers what is committed
 * to it.
 *
 * The coverage question belongs to the account, not to the pocket: an account
 * over-allocated by 200 that feeds three pockets does not get its deficit split
 * among them, because choosing a split — pro-rata? oldest first? — means the
 * system inventing causality. A pocket reports only that one of its sources is
 * short, and the amount is stated on the account.
 *
 * @returns {Set<number>} pocket ids
 */
const findUncoveredPockets = (accountRows, holdingRows) => {
 const shortAccounts = new Set(
  accountRows
   .map(makeAccountAllocation)
   .filter((account) => account.isOverAllocated)
   .map((account) => account.accountId),
 );

 return new Set(
  holdingRows
   .filter((holding) => shortAccounts.has(holding.accountId))
   .map((holding) => holding.pocketId),
 );
};

/**
 * Fold the rows into the header.
 *
 * Summed FROM the already-rounded row values, not from the raw ones: the header
 * has to reconcile with the figures under it, and summing unrounded values lets
 * two displayed numbers differ by a cent.
 *
 * Each pocket is clamped BEFORE the sum, and that is the whole point of the
 * fold. At board level the sign stops being information and becomes
 * compensation: totalTarget - totalAllocated lets a pocket over-funded by $100
 * cancel another that is $100 short, and the hero then reports that nothing is
 * missing — which is false, because that excess is committed to the first pocket
 * and releasing it is a decision nobody has taken. Money committed to one goal
 * does not fund another goal. So what is still to allocate and what is committed
 * above goal are reported separately instead of netting into one misleading
 * number.
 *
 * overallProgress is coverage — SUM(MIN(allocated, target)) / SUM(target) — so
 * one pocket at 300% cannot report coverage it does not provide. It is capped at
 * 100% by construction rather than by a clamp in the component, because coverage
 * is the question; the uncapped answer to the other question is totalAllocated,
 * served beside it.
 *
 * An empty board reports every amount and percentage as null rather than as 0. A
 * sum over no pockets is not an amount of zero, it is the absence of anything to
 * sum, and the screen renders an empty state instead of a board reading $0.00. A
 * count over an empty set is legitimately zero, and pocketCount: 0 already
 * establishes that reading.
 */
const makeSummary = (pockets, accountAllocations) => {
 const pocketCount = pockets.length;

 // The pockets that have a plan window at all. The four schedule fields are null
 // TOGETHER when a window holds no full calendar month (planSchedule.js), so one
 // test decides membership for every schedule figure below, and totalAllocated
 // cannot stand in for the committed amount of this narrower population.
 const scheduled = pockets.filter((p) => p.scheduledByNow !== null);

 // Withheld as a set, for the same reason the amounts are: a board with no plan
 // window has nothing to measure against a schedule, and a zero there would claim
 // the plans required nothing.
 const noSchedule = {
  totalScheduledByNow: null,
  scheduledPocketsAllocated: null,
  totalScheduleGap: null,
  totalRequiredMonthly: null,
  scheduleAdherence: null,
  scheduledPocketsMovedInMonth: null,
 };

 const counts = {
  pocketCount,
  fundedCount: pockets.filter((p) => p.funded).length,
  overdueCount: pockets.filter((p) => p.overdue).length,
  uncoveredCount: pockets.filter((p) => p.uncovered).length,
  // How many pockets have a plan window, and how the schedule axis splits them.
  // The two sides partition this population exactly and always sum to it. The
  // negative test is STRICTLY below zero, so a pocket sitting on its line falls
  // to the over side — the tie-break ruled 2026-09-04.
  //
  // Both are served rather than one being subtracted from the other, so no
  // arithmetic over this fold reaches the client.
  //
  // NOT levelCounts, and the two must never be folded together. The levels are
  // seven mutually exclusive readings evaluated top down, so a pocket that is
  // completed or past its target holds non-negative slack and counts here while
  // its word says otherwise: overScheduleCount is always at least
  // levelCounts.ahead, and equal to it only when no pocket has passed its target.
  scheduledPocketCount: scheduled.length,
  underScheduleCount: scheduled.filter((p) => p.aheadOfPlan < 0).length,
  overScheduleCount: scheduled.filter((p) => p.aheadOfPlan >= 0).length,
  // One count per level, folded from the level each row already carries. The
  // client used to derive these from the same rows while the cards read the
  // served flags, which is two answers to one question — the defect the header
  // of this file exists to prevent.
  //
  // Every key is present with a zero, never only the levels that occurred: a
  // screen reading levelCounts.behind must not have to distinguish "none" from
  // "the server did not mention it".
  levelCounts: POCKET_LEVELS.reduce(
   (acc, level) => ({
    ...acc,
    [level]: pockets.filter((p) => p.level === level).length,
   }),
   {},
  ),
  // aheadCount is GONE. RULED 2026-09-04 (POCKET_DECISIONS.md #24): being at or
  // above the plan's line is algebraically the same condition as the ratio being
  // at or below 1, so the axis it counted did not cross the live band — it
  // partitioned it, and it is now the level `ahead`. Keeping the count would
  // have left levelCounts.ahead and aheadCount answering one question with two
  // slightly different numbers, which is the defect the header of this file
  // exists to prevent. A screen that wants it reads levelCounts.ahead.
  //
  // The accounts a pocket actually draws on, the board's fold of the sourceCount
  // each row already carries. getAccountAllocations returns every account the
  // owner holds, including the ones committed to nothing, because the account
  // screen has to print that zero — and a zero is not a source.
  //
  // Not filtered by account type, deliberately. The two source lists admit
  // 'cash' beside 'bank', but no cash account exists and no creation path
  // offers one, so a type filter would encode a rule the data does not have.
  // Counting whatever actually funds a pocket stays true either way, and keeps
  // the figure reconciling with totalAllocated printed above it.
  //
  // greaterThan and not isPositive: Decimal tests the SIGN, and zero is signed
  // positive, so isPositive() admits every uncommitted account and turned this
  // count into "accounts the owner holds".
  sourceAccountCount: accountAllocations.filter((a) =>
   money(a.accountAllocated).greaterThan(0),
  ).length,
  // The furthest goal on the board. Taken as a maximum and not as the last row
  // of a query that happens to order by this column: that order belongs to the
  // list, and changing it must not silently change this figure. The dates are
  // YYYY-MM-DD text, where lexicographic order is chronological order.
  latestDesiredDate:
   pocketCount === 0
    ? null
    : pockets.reduce(
       (latest, p) => (p.desiredDate > latest ? p.desiredDate : latest),
       pockets[0].desiredDate,
      ),
 };

 const noAmounts = {
  totalAllocated: null,
  totalTarget: null,
  totalRemaining: null,
  totalExcess: null,
  totalAheadOfPlan: null,
  totalMovedInMonth: null,
  totalCommittedInMonth: null,
  totalReleasedInMonth: null,
  overallProgress: null,
  currency: null,
  ...noSchedule,
  ...counts,
 };

 if (pocketCount === 0) {
  return noAmounts;
 }

 const currencies = new Set(pockets.map((p) => p.currency));
 const currency = currencies.size === 1 ? [...currencies][0] : null;

 if (currency === null) {
  return noAmounts;
 }

 const sums = pockets.reduce(
  (acc, p) => {
   const target = money(p.target);
   const allocated = money(p.allocated);
   const gap = target.minus(allocated);

   // Bounded to the pockets that READ ahead, not to every pocket holding
   // positive slack. RULED 2026-09-04 (#24.5): the readings row prints this
   // amount beside levelCounts.ahead, and a count over one population next to a
   // sum over a wider one is a row that does not add up — a pocket a rounding
   // above its line, or one already past its target, would put money in the sum
   // without appearing in the count.
   const ahead = p.level === 'ahead' ? money(p.aheadOfPlan ?? 0) : money(0);

   return {
    allocated: acc.allocated.plus(allocated),
    target: acc.target.plus(target),
    remaining: gap.isPositive() ? acc.remaining.plus(gap) : acc.remaining,
    excess: gap.isNegative() ? acc.excess.plus(gap.negated()) : acc.excess,
    covered: acc.covered.plus(gap.isPositive() ? allocated : target),
    // Only the positive side. A pocket behind its line does not cancel the slack
    // another one holds: the question this figure answers is how much money can
    // be moved, and a shortfall over there is not a source over here. Same
    // clamp-before-summing rule the excess above obeys, for the same reason.
    ahead: ahead.isPositive() ? acc.ahead.plus(ahead) : acc.ahead,
    // The month's movement nets by design — here the sign IS the fact, because
    // a release in one pocket and a commitment in another did happen inside the
    // same month and the portfolio moved by their difference. The two gross
    // halves are summed beside it so the net never has to be decomposed by a
    // consumer.
    moved: acc.moved.plus(money(p.movedInMonth ?? 0)),
    committed: acc.committed.plus(money(p.committedInMonth ?? 0)),
    released: acc.released.plus(money(p.releasedInMonth ?? 0)),
   };
  },
  {
   allocated: money(0),
   target: money(0),
   remaining: money(0),
   excess: money(0),
   covered: money(0),
   ahead: money(0),
   moved: money(0),
   committed: money(0),
   released: money(0),
  },
 );

 // The schedule fold, over the pockets that hold a plan window only. Kept apart
 // from the fold above rather than branched inside it, because the population is
 // different: a figure over every pocket printed beside one over the scheduled
 // few is the reading the hero's own labels exist to prevent.
 const scheduleSums = scheduled.reduce(
  (acc, p) => ({
   scheduledByNow: acc.scheduledByNow.plus(money(p.scheduledByNow)),
   allocated: acc.allocated.plus(money(p.allocated)),
   // Signed, unlike the clamped slack above. That one answers where money can be
   // taken from, so a shortfall must not cancel another pocket's surplus; this
   // one answers whether the board is on plan, where the cancellation IS the
   // answer. The two ship together because they are different questions.
   gap: acc.gap.plus(money(p.aheadOfPlan)),
   // Null once a deadline has passed, and a pace nobody can still meet is not a
   // zero to add into a pace the owner is being asked to hold.
   requiredMonthly: acc.requiredMonthly.plus(money(p.requiredMonthly ?? 0)),
   moved: acc.moved.plus(money(p.movedInMonth ?? 0)),
  }),
  {
   scheduledByNow: money(0),
   allocated: money(0),
   gap: money(0),
   requiredMonthly: money(0),
   moved: money(0),
  },
 );

 const scheduleTotals =
  scheduled.length === 0
   ? noSchedule
   : {
      totalScheduledByNow: toAmount(scheduleSums.scheduledByNow),
      scheduledPocketsAllocated: toAmount(scheduleSums.allocated),
      totalScheduleGap: toAmount(scheduleSums.gap),
      totalRequiredMonthly: toAmount(scheduleSums.requiredMonthly),
      // A quotient of the two sums, never a fold of per-pocket ratios clamped at
      // 100 first. Clamping each pocket would discard the surplus held by the
      // ones standing over their line, so the figure would read lower than the
      // two amounts the card prints beside it — and a reader divides those two by
      // eye. A percentage contradicting the numbers on its own line is worse than
      // one above 100.
      //
      // UNCLAMPED for the same reason: the fill stops at the track, the label
      // states this value, and a clipped bar with no figure cannot say how far
      // past the schedule the owner stands.
      //
      // Null and never zero when the plans have required nothing yet. A share of
      // nothing is not zero per cent, and this is reachable on a live board: a
      // plan whose first instalment has not yet fallen due schedules zero.
      scheduleAdherence: scheduleSums.scheduledByNow.isZero()
       ? null
       : toRate(
          scheduleSums.allocated
           .dividedBy(scheduleSums.scheduledByNow)
           .times(HUNDRED),
         ),
      // Scoped on purpose, beside the board-wide net above rather than replacing
      // it. It prints inside the tile whose balance counts these same pockets,
      // and a sub-figure drawn from a wider population is not a part of the
      // number above it. The two gross halves stay board-wide and do NOT
      // decompose this one: committed minus released yields the board-wide net.
      scheduledPocketsMovedInMonth: toAmount(scheduleSums.moved),
     };

 return {
  totalAllocated: toAmount(sums.allocated),
  totalTarget: toAmount(sums.target),
  totalRemaining: toAmount(sums.remaining),
  totalExcess: toAmount(sums.excess),
  totalAheadOfPlan: toAmount(sums.ahead),
  totalMovedInMonth: toAmount(sums.moved),
  totalCommittedInMonth: toAmount(sums.committed),
  totalReleasedInMonth: toAmount(sums.released),
  overallProgress: toRate(sums.covered.dividedBy(sums.target).times(HUNDRED)),
  currency,
  ...scheduleTotals,
  ...counts,
 };
};

export const pocketBoardService = {
 /**
  * The board of one user, as of the close of one month.
  *
  * The month is the caller's; the CURRENT month never travels. The controller
  * resolves it on the owner's calendar and refuses a later one with 422, so the
  * only month that reaches here is one that has begun.
  *
  * Coverage is deliberately NOT month-bounded. It asks whether the accounts
  * cover what is committed to them, which is a question about the balances the
  * owner holds now — there is no historical balance in this module, and a
  * coverage figure read at a past close would be an invention.
  *
  * @param {import('pg').Pool} pool
  * @param {string} userId - from the token
  * @param {string} timeZone - the owner's IANA zone, resolved by the controller
  * @param {string} monthStart - YYYY-MM-01, validated by the controller
  * @returns {Promise<{summary: object, pockets: object[], meta: object}>}
  */
 async getBoard(pool, userId, timeZone, monthStart) {
  const [today, rows, accountRows, holdingRows] = await Promise.all([
   getCalendarToday(pool, timeZone),
   getPocketsForUser(pool, userId, monthStart, timeZone),
   getAccountAllocations(pool, userId),
   getPocketSourceHoldings(pool, userId),
  ]);

  const evaluationDate = resolveEvaluationDate(monthStart, today);

  const uncovered = findUncoveredPockets(accountRows, holdingRows);

  const pockets = rows.map((row) => ({
   ...makePocketStatus(row, evaluationDate),
   uncovered: uncovered.has(row.pocketId),
  }));

  const summary = makeSummary(pockets, accountRows);

  // Raised only when there is something to fold and it could not be folded.
  // Guarding on currency alone would fire on an empty board, where a null
  // currency means "no pockets", not "two of them".
  const notices =
   summary.pocketCount > 0 && summary.currency === null
    ? [MIXED_CURRENCY_NOTICE]
    : [];

  return {
   summary,
   pockets,
   meta: {
    // What this payload answers, what the stepper may not step past, and the
    // date every comparison on it was made at. The screen needs all three: it
    // labels the badge with the first, disables the forward arrow at the
    // second, and has no way to derive the third.
    referenceMonth: monthStart.slice(0, 7),
    currentMonth: today.slice(0, 7),
    evaluationDate,
    notices,
   },
  };
 },
};
