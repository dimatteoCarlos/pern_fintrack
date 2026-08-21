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
// Nothing here computes a pace. runRate, requiredMonthly, projectedDate and
// status need the transaction history and land with the pace commit; a field
// that is absent asks a question, where a field served as null answers it
// wrongly.

import { getPocketsForUser } from '../db/pocketRepository.js';
import { makePocketStatus } from '../core/makePocketStatus.js';
import { toAmount, toRate, money } from '../../budget_services/core/money.js';

const HUNDRED = 100;

// The rule the budget module settled and this one adopts unchanged: amounts in
// two currencies are not added at an implicit 1:1. The board states that it
// cannot fold them; the per-pocket rows keep their own amounts, so nothing is
// lost except the bad addition.
const MIXED_CURRENCY_NOTICE =
 'Totals add amounts in more than one currency and are not converted.';

/**
 * Fold the rows into the header.
 *
 * Summed FROM the already-rounded row values, not from the raw ones: the header
 * has to reconcile with the figures under it, and summing unrounded values lets
 * two displayed numbers differ by a cent.
 *
 * An empty board reports every figure as null rather than as 0. A sum over no
 * pockets is not an amount of zero — it is the absence of anything to sum, and
 * the screen renders an empty state, not a board reading $0.00.
 */
const makeSummary = (pockets) => {
 const pocketCount = pockets.length;

 if (pocketCount === 0) {
  return {
   totalSaved: null,
   totalTarget: null,
   totalRemaining: null,
   overallProgress: null,
   currency: null,
   pocketCount: 0,
  };
 }

 const currencies = new Set(pockets.map((p) => p.currency));
 const currency = currencies.size === 1 ? [...currencies][0] : null;

 if (currency === null) {
  return {
   totalSaved: null,
   totalTarget: null,
   totalRemaining: null,
   overallProgress: null,
   currency: null,
   pocketCount,
  };
 }

 // A pocket with no target contributes its saved amount and nothing to the
 // goal. Treating a null target as 0 in the SUM is correct — there is no goal —
 // and it is not the same as reporting a target of 0 on that row, which the row
 // does not do.
 const sums = pockets.reduce(
  (acc, p) => ({
   saved: acc.saved.plus(p.saved),
   target: acc.target.plus(p.target ?? 0),
  }),
  { saved: money(0), target: money(0) },
 );

 // No pocket carries a goal. The board has amounts but nothing to measure them
 // against, and both derived figures say so: a remaining of -40 would read as
 // over-funded by 40 against a goal nobody set.
 const hasGoal = !sums.target.isZero();

 return {
  totalSaved: toAmount(sums.saved),
  totalTarget: toAmount(sums.target),
  // Negative when the board as a whole is over-funded. Not clamped: the excess
  // is the fact.
  totalRemaining: hasGoal ? toAmount(sums.target.minus(sums.saved)) : null,
  // There is no percentage of zero, and 0 would announce that nothing has been
  // saved.
  overallProgress: hasGoal
   ? toRate(sums.saved.dividedBy(sums.target).times(HUNDRED))
   : null,
  currency,
  pocketCount,
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
  const rows = await getPocketsForUser(pool, userId, timeZone);

  const pockets = rows.map(makePocketStatus);
  const summary = makeSummary(pockets);

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
