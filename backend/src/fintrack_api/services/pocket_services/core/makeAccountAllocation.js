// backend/src/fintrack_api/services/pocket_services/core/makeAccountAllocation.js

// The three figures a real account carries once pockets exist, and the only
// place they are computed.
//
// They have two consumers that must never disagree: the allocate service checks
// against unassignedCash inside a row lock, and the account screen shows the
// same figure to the owner. One number, one formula, one file.

import { toAmount, money } from '../../budget_services/core/money.js';

/**
 * Build the allocation figures of one real account.
 *
 * unassignedCash is NOT called "available balance". The available balance is
 * still the whole accountBalance — a pocket never blocks a spend — and naming
 * the remainder "available" would tell the owner they cannot spend money they
 * can.
 *
 * It may be negative, and that is a state rather than an error: an expense that
 * spends committed money is always accepted, and the account then says it no
 * longer covers what is committed to it. The shortfall is reported here, on the
 * account, and never split across the pockets that draw on it — any such split
 * needs a policy the app would have to invent.
 *
 * @param {object} row
 * @param {number} row.accountId
 * @param {string} row.accountName
 * @param {string} row.accountType
 * @param {Date|string|null} [row.accountStartDate] - the opening instant
 * @param {string|number} row.accountBalance - NUMERIC as text
 * @param {string|number} row.accountAllocated - NUMERIC as text
 * @returns {Readonly<object>}
 */
export function makeAccountAllocation({
 accountId,
 accountName,
 accountType,
 accountStartDate,
 accountBalance,
 accountAllocated,
}) {
 const balance = money(accountBalance);
 const allocated = money(accountAllocated);
 const unassigned = balance.minus(allocated);

 return Object.freeze({
  accountId,
  accountName,
  accountType,
  // The instant the account opened, carried through untouched. It is the floor
  // of what may be dated onto this account, and the form needs it to stop
  // offering a source the server would refuse.
  accountStartDate: accountStartDate ?? null,
  accountBalance: toAmount(balance),
  accountAllocated: toAmount(allocated),
  accountUnassignedCash: toAmount(unassigned),
  isOverAllocated: unassigned.isNegative(),
 });
}
