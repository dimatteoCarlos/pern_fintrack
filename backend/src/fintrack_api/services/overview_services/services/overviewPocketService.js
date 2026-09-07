// src/fintrack_api/services/overview_services/services/overviewPocketService.js

// The Pocket domain calculator behind GET /overview/pocket.
//
// It no longer shares a body with Debt. Both used to be stock domains read the
// same way — one account set, one balance series, one list of the movements on
// those accounts — and that stopped being true for Pocket when migration 020
// turned a pocket from an account that holds money into a plan that commits
// money staying where it is. There is no pocket account left to read a balance
// over: pocket_saving was emptied, and the set the old body asked for came back
// empty, so every figure on this card was silently zero.
//
// P1 is now the COMMITTED total — how much of the real accounts is claimed by
// the plans, at the close of the reference month. It is not money the pocket
// holds. The bank balance in the hero already contains it, which is why the hero
// stopped adding this figure (makeHeroSection.js:107-116).
//
// The four global figures and the three status counts are NOT computed here.
// They are asked of pocketBoardService, which already computes them for the
// board screen, so Overview and the board agree by construction rather than by
// review — the rule §7 states for ALL and §9 states for the saving goals, applied
// to the one domain that has a second screen answering the same question.
//
// The trend §12 grants this domain is still a series of POSITIONS, one per month
// close, and the reasoning survives the model change unchanged: a flow series
// would put "80 committed" under a card that says "1,200 committed in total",
// two numbers on one card with no relation between them. The balance series ends
// exactly on the card's figure.
//
// The monthly snapshot's pocket entry is the opposite quantity and is built
// elsewhere (D28, overviewPageService.js). One is a position, the other a flow,
// and they are two statements on purpose.

import { pocketBoardService } from '../../pocket_services/services/pocketBoardService.js';
import {
 getMonthlyAllocated,
 getAllocationsPage,
} from '../db/overviewPocketRepository.js';
import { makeDomainCard } from '../core/makeDomainCard.js';
import { makeTrendSeries } from '../core/makeTrendSeries.js';
import { monthEndDate } from '../core/monthArithmetic.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';

// Said when the owner has planned no pocket at all. The card still publishes 0
// for its total, because the ALL card adds that figure and a null would poison
// the addition — but 0 committed across no plans and 0 committed across three
// plans are different situations, and only this sentence separates them.
export const NO_POCKET_NOTICE =
 'No savings pocket has been planned, so the committed total is reported over none.';

export const overviewPocketService = {
 /**
  * Everything GET /overview/pocket returns, for one month and one page.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { window, page, pageSize, includeTransactionRows }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'pocket'
  */
 async getPocketDomainData(
  pool,
  userId,
  { window, page, pageSize, includeTransactionRows = true },
  timeZone = 'UTC',
 ) {
  const { referenceMonth, trendStart } = window;

  const [board, months, allocations] = await Promise.all([
   pocketBoardService.getBoard(pool, userId, timeZone, referenceMonth),
   getMonthlyAllocated(pool, userId, trendStart, referenceMonth, timeZone),
   getAllocationsPage(pool, userId, referenceMonth, timeZone, {
    page,
    pageSize,
    includeRows: includeTransactionRows,
   }),
  ]);

  const { summary } = board;
  const hasPockets = summary.pocketCount > 0;

  const card = makeDomainCard({
   domain: 'pocket',
   // The board's totalAllocated, and the only figure of the four that is
   // restated under a contract name instead of travelling in domainFields: it IS
   // the card's total, and publishing it twice under two names is the defect §7
   // exists to prevent.
   //
   // 0 where the board reports null, and that is the one deliberate divergence
   // from it. The board may say "there is nothing to sum"; this card is added by
   // ALL and used to be added by the hero, so its total is a number or the sum
   // above it is not. The notice carries what the null was saying.
   totalAmount: summary.totalAllocated ?? 0,
   // The allocation rows of the month, not transactions. A pocket has no
   // transactions — no allocation ever moved money — so this is the count of
   // decisions taken, and the field keeps its contract name until P4 renames it
   // across the payload rather than in one card.
   transactionCount: allocations.totalRows,
   // The net committed inside the month IS the change in the committed total
   // over it, over the same ledger and the same population bound, so the delta
   // is read and never recomputed as a difference of two series points.
   delta: summary.totalMovedInMonth,
   domainFields: {
    // The other three of the four global figures, passed through exactly as the
    // board computed them, nulls included: P2's exit condition is that these
    // equal the board's figure for figure, and a 0 substituted here would break
    // that on the one board where it matters.
    //
    // remaining is clamped per pocket before summing and excess is reported
    // apart from it, so an over-funded goal cannot cancel an underfunded one
    // (pocketBoardService.js:112-134). progress is coverage and never exceeds
    // 100 by construction.
    target: summary.totalTarget,
    remaining: summary.totalRemaining,
    progress: summary.overallProgress,
    // The status line under the four figures: `5 funded · 2 overdue · 1 uncovered`.
    // Three counts and not a fourth card — seven figures rendered as seven
    // figures would make this a miniature board inside the Overview.
    fundedCount: summary.fundedCount,
    overdueCount: summary.overdueCount,
    uncoveredCount: summary.uncoveredCount,
   },
   currency: ACCOUNTING_CURRENCY_CODE,
   window: {
    periodStart: referenceMonth,
    periodEnd: monthEndDate(referenceMonth),
   },
   notices: hasPockets ? [] : [NO_POCKET_NOTICE],
  });

  return {
   card,
   transactions: {
    rows: allocations.rows,
    page,
    pageSize,
    totalRows: allocations.totalRows,
   },
   trend: makeTrendSeries(months),
  };
 },
};
