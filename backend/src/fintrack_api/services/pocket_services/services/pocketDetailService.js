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
 getAccountIdentitiesById,
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
const buildSources = (holdings, accountRows, identities = new Map()) => {
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
   //
   // THE NAME IS NO LONGER AMONG THEM. It used to be null here, which put
   // "Account no longer available" on the row - and two soft-deleted accounts
   // backing the same pocket then showed as two identical rows the owner had to
   // tell apart by their amounts before releasing from one. The identity read
   // answers for exactly these ids and nothing else, so the row can be named
   // while every FIGURE it has no answer for stays null.
   if (!account) {
    const identity = identities.get(holding.accountId);

    return {
     accountId: holding.accountId,
     accountName: identity?.accountName ?? null,
     accountType: identity?.accountType ?? null,
     // Carried so the release form can date a decision against it, the same as
     // any other source. Without it the form admits every day, and the server
     // is the first thing to say no.
     accountStartDate: identity?.accountStartDate ?? null,
     // The row is still offered and the release still runs: the three
     // eligibility refusals in pocketAllocationService are preconditions of
     // ALLOCATING, and giving a commitment back is always allowed.
     accountIsDeleted: identity?.isDeleted ?? null,
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
    accountStartDate: account.accountStartDate,
    // false and not null: this account answered the main read, which filters
    // deleted_at IS NULL, so it is known not to be deleted.
    accountIsDeleted: false,
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
   getPocketForUser(pool, userId, pocketId, timeZone),
  ]);

  if (row === null) {
   throw forbidden('Pocket not found or not owned by the authenticated user.');
  }

  const [holdings, accountRows, historyRows] = await Promise.all([
   getPocketSourceHoldings(pool, userId, pocketId),
   getAccountAllocations(pool, userId),
   getPocketHistory(pool, userId, pocketId, timeZone),
  ]);

  // Only the ids the main read could not answer for, and only when there are
  // any: a pocket funded entirely by live accounts issues no second query.
  const knownAccountIds = new Set(accountRows.map((row) => row.accountId));
  const unresolvedIds = holdings
   .map((holding) => holding.accountId)
   .filter((accountId) => !knownAccountIds.has(accountId));

  const identityRows = await getAccountIdentitiesById(
   pool,
   userId,
   unresolvedIds,
  );

  const sources = buildSources(
   holdings,
   accountRows,
   new Map(identityRows.map((row) => [row.accountId, row])),
  );

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
