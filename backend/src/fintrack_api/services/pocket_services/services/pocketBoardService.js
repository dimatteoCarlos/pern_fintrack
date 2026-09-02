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

import { getCalendarToday, getPocketsForUser } from '../db/pocketRepository.js';
import {
 getAccountAllocations,
 getPocketSourceHoldings,
} from '../db/accountAllocationRepository.js';
import { makePocketStatus } from '../core/makePocketStatus.js';
import { makeAccountAllocation } from '../core/makeAccountAllocation.js';
import { toAmount, toRate, money } from '../../budget_services/core/money.js';

const HUNDRED = 100;

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

 const counts = {
  pocketCount,
  fundedCount: pockets.filter((p) => p.funded).length,
  overdueCount: pockets.filter((p) => p.overdue).length,
  uncoveredCount: pockets.filter((p) => p.uncovered).length,
  // The accounts a pocket actually draws on, the board's fold of the sourceCount
  // each row already carries. getAccountAllocations returns every account the
  // owner holds, including the ones committed to nothing, because the account
  // screen has to print that zero — and a zero is not a source. Bank and cash
  // both count: those are the two types that can fund a pocket, and counting
  // only one would stop reconciling with totalAllocated above it.
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
  overallProgress: null,
  currency: null,
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

   return {
    allocated: acc.allocated.plus(allocated),
    target: acc.target.plus(target),
    remaining: gap.isPositive() ? acc.remaining.plus(gap) : acc.remaining,
    excess: gap.isNegative() ? acc.excess.plus(gap.negated()) : acc.excess,
    covered: acc.covered.plus(gap.isPositive() ? allocated : target),
   };
  },
  {
   allocated: money(0),
   target: money(0),
   remaining: money(0),
   excess: money(0),
   covered: money(0),
  },
 );

 return {
  totalAllocated: toAmount(sums.allocated),
  totalTarget: toAmount(sums.target),
  totalRemaining: toAmount(sums.remaining),
  totalExcess: toAmount(sums.excess),
  overallProgress: toRate(sums.covered.dividedBy(sums.target).times(HUNDRED)),
  currency,
  ...counts,
 };
};

export const pocketBoardService = {
 /**
  * The board of one user.
  *
  * @param {import('pg').Pool} pool
  * @param {string} userId - from the token
  * @param {string} timeZone - the owner's IANA zone, resolved by the controller
  * @returns {Promise<{summary: object, pockets: object[], meta: {notices: string[]}}>}
  */
 async getBoard(pool, userId, timeZone) {
  const [today, rows, accountRows, holdingRows] = await Promise.all([
   getCalendarToday(pool, timeZone),
   getPocketsForUser(pool, userId),
   getAccountAllocations(pool, userId),
   getPocketSourceHoldings(pool, userId),
  ]);

  const uncovered = findUncoveredPockets(accountRows, holdingRows);

  const pockets = rows.map((row) => ({
   ...makePocketStatus(row, today),
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

  return { summary, pockets, meta: { notices } };
 },
};
