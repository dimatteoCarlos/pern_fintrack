// backend/src/fintrack_api/services/pocket_services/services/accountAllocationService.js

// The account's side of the pocket ledger: how much of one real account is
// committed, how much of it is not, and to which goals.
//
// This lives in the pocket module but it is an indicator OF THE ACCOUNT, and it
// is written once because it has two consumers that must never disagree: the
// allocate service validates against unassigned cash inside its row lock, and
// the account screen shows the owner the same figure. Computed a second time,
// the business rule and the number on screen become two implementations of one
// formula that can drift apart.

import {
 getAccountAllocations,
 getPocketsForAccount,
} from '../db/accountAllocationRepository.js';
import { makeAccountAllocation } from '../core/makeAccountAllocation.js';
import { toAmount } from '../../budget_services/core/money.js';

// Only these two hold spendable cash the owner can commit. Unassigned cash means
// nothing on a credit card, on an investment account whose balance is a market
// valuation, or on a debtor account.
const ACCOUNTS_WITH_UNASSIGNED_CASH = ['bank', 'cash'];

export const accountAllocationService = {
 /**
  * The three lines the account detail gains, or null when the account is not a
  * kind that has them.
  *
  * A negative unassigned cash is served as the negative figure with the
  * over-allocation flag beside it. It blocks nothing: a spend against committed
  * money is always accepted, and the screen states the shortfall rather than
  * correcting it. The amount is never split across the pockets listed below —
  * any split needs a policy, and choosing one means inventing causality.
  *
  * @param {import('pg').Pool|import('pg').PoolClient} db
  * @param {string} userId - from the token
  * @param {number} accountId - already proven to be the caller's
  * @param {string} accountTypeName
  * @returns {Promise<object|null>}
  */
 async getAccountAllocation(db, userId, accountId, accountTypeName) {
  if (!ACCOUNTS_WITH_UNASSIGNED_CASH.includes(accountTypeName)) {
   return null;
  }

  const [accountRows, pocketRows] = await Promise.all([
   getAccountAllocations(db, userId, [accountId]),
   getPocketsForAccount(db, userId, accountId),
  ]);

  // The account read filters out the internal 'slack' account and soft-deleted
  // rows. Neither is a pocket source, so an empty result is "no figures apply"
  // rather than an error.
  if (accountRows.length === 0) {
   return null;
  }

  const account = makeAccountAllocation(accountRows[0]);

  return {
   allocated: account.accountAllocated,
   unassignedCash: account.accountUnassignedCash,
   isOverAllocated: account.isOverAllocated,
   pockets: pocketRows.map((row) => ({
    pocketId: row.pocketId,
    name: row.name,
    heldFromThisAccount: toAmount(row.heldFromThisAccount),
   })),
  };
 },

 /**
  * The same two figures for a whole list of accounts, in one query.
  *
  * Written for the picker that chooses which account funds a pocket: it shows
  * the balance, what is committed and what is unassigned side by side, so that
  * no single one of them can be called "available". One query for the list
  * rather than one per row, because the underlying read already takes an array.
  *
  * The goals each account backs are deliberately NOT attached here. That is one
  * query per account and the picker asks a different question — which account
  * has room, not what its money is already promised to. The account's own
  * screen answers that one.
  *
  * An account the allocation read filters out — the internal account, or a
  * soft-deleted one — is simply absent from the map. The caller leaves its
  * figures unset rather than writing zeros: a zero would state that nothing is
  * committed to an account this query could not answer for.
  *
  * @param {import('pg').Pool|import('pg').PoolClient} db
  * @param {string} userId - from the token
  * @param {number[]} accountIds - already proven to be the caller's
  * @returns {Promise<Map<number, object>>} keyed by account id
  */
 async getAllocationsByAccountId(db, userId, accountIds) {
  if (accountIds.length === 0) {
   return new Map();
  }

  const rows = await getAccountAllocations(db, userId, accountIds);

  return new Map(
   rows.map((row) => {
    const account = makeAccountAllocation(row);

    return [
     account.accountId,
     {
      allocated: account.accountAllocated,
      unassignedCash: account.accountUnassignedCash,
      isOverAllocated: account.isOverAllocated,
     },
    ];
   }),
  );
 },
};
