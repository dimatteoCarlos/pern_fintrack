// backend/src/fintrack_api/services/pocket_services/services/pocketDetailService.js

// One pocket, everything its screen shows, one request.
//
// The same rule the board follows, and the reason there is no separate history
// endpoint: the hero, the source breakdown and the allocation list are three
// views of the same rows, and three requests would let them disagree about what
// the pocket holds.
//
// A pocket that is not the caller's answers 403, and so does a pocket id that
// does not exist. Splitting the two would let a caller walk the id space and
// learn which pockets belong to other users.

import {
 getCalendarToday,
 getPocketForUser,
 getPocketHistory,
} from '../db/pocketRepository.js';
import {
 getAccountAllocations,
 getPocketSourceHoldings,
} from '../db/accountAllocationRepository.js';
import { makePocketStatus } from '../core/makePocketStatus.js';
import { makeAccountAllocation } from '../core/makeAccountAllocation.js';
import { makeAllocationEntry } from '../core/makeAllocationEntry.js';
import { toAmount, money } from '../../budget_services/core/money.js';

const forbidden = (message) =>
 Object.assign(new Error(message), { status: 403 });

/**
 * The accounts this pocket draws on, each with what it holds for this pocket and
 * what the account itself is carrying.
 *
 * An account whose net fell to zero after a full release is absent: it stopped
 * contributing, and listing it would put a source on the screen that holds
 * nothing. The allocation history keeps the trace of the one that left.
 *
 * covered is the account's own state, not the pocket's share of it. When it is
 * false the account no longer covers everything committed to it, and the amount
 * missing belongs to the account — it is never split across the pockets that
 * draw on it, because any split would need a policy the app would have to
 * invent.
 */
const buildSources = (holdings, accountRows) => {
 const accounts = new Map(
  accountRows.map((row) => [row.accountId, makeAccountAllocation(row)]),
 );

 return holdings
  .map((holding) => {
   const account = accounts.get(holding.accountId);

   // An account the allocation ledger names but the account read does not: it
   // was soft-deleted, or it is the internal 'slack' account that read filters
   // out. Its held amount is real and the pocket still counts it, so the row is
   // served with the account figures it has no answer for left null.
   if (!account) {
    return {
     accountId: holding.accountId,
     accountName: null,
     accountType: null,
     heldByThisPocket: toAmount(holding.heldByThisPocket),
     accountAllocated: null,
     accountBalance: null,
     accountUnassignedCash: null,
     covered: null,
    };
   }

   return {
    accountId: account.accountId,
    accountName: account.accountName,
    accountType: account.accountType,
    heldByThisPocket: toAmount(holding.heldByThisPocket),
    accountAllocated: account.accountAllocated,
    accountBalance: account.accountBalance,
    accountUnassignedCash: account.accountUnassignedCash,
    covered: !account.isOverAllocated,
   };
  })
  .sort((a, b) => money(b.heldByThisPocket).comparedTo(a.heldByThisPocket));
};

export const pocketDetailService = {
 /**
  * One pocket of one user.
  *
  * @param {import('pg').Pool} pool
  * @param {string} userId - from the token
  * @param {number} pocketId - from the path
  * @param {string} timeZone - the owner's IANA zone, resolved by the controller
  * @returns {Promise<{pocket: object, sources: object[], history: object[], meta: {notices: string[]}}>}
  * @throws {Error & {status: 403}} when the pocket is missing or not the caller's
  */
 async getDetail(pool, userId, pocketId, timeZone) {
  const [today, row] = await Promise.all([
   getCalendarToday(pool, timeZone),
   getPocketForUser(pool, userId, pocketId),
  ]);

  if (row === null) {
   throw forbidden('Pocket not found or not owned by the authenticated user.');
  }

  const [holdings, accountRows, historyRows] = await Promise.all([
   getPocketSourceHoldings(pool, userId, pocketId),
   getAccountAllocations(pool, userId),
   getPocketHistory(pool, userId, pocketId, timeZone),
  ]);

  const sources = buildSources(holdings, accountRows);

  const status = makePocketStatus(row, today);
  const pocket = {
   ...status,
   uncovered: sources.some((source) => source.covered === false),
  };

  // sourceCount belongs to the card, which has no room for the table. The detail
  // screen shows the table itself, so the count would be a second answer to a
  // question the rows already answer.
  delete pocket.sourceCount;

  return {
   pocket,
   sources,
   history: historyRows.map(makeAllocationEntry),
   meta: { notices: [] },
  };
 },
};
