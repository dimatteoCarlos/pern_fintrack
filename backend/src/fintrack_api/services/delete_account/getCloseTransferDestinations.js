// backend/src/fintrack_api/services/delete_account/getCloseTransferDestinations.js

/**
 * Destination eligibility for CLOSE's TRANSFER policy, in one place.
 *
 * The rule is frozen in PLAN_ACCOUNT_DELETION.md, "Destination eligibility
 * decided, 2026-09-07". A destination is eligible when all five hold: it
 * belongs to the same owner, it is not deleted, it is not the account being
 * closed, its type is 'bank', and its stored currency equals the closing
 * account's. This file implements that rule and never re-decides it.
 *
 * ONE QUERY, TWO CALLERS, and that is the point. The selector asks it for the
 * list to show the owner; the write path asks it for the same list and requires
 * the chosen destination to appear in it. Written instead as a list query plus
 * a separate validating predicate, the two could drift under a later edit, and
 * the failure would be a settlement written to an account the owner was never
 * offered - with nothing in either query to say which of the two was wrong.
 *
 * The currency clause is a no-op today: every creation path stores the
 * accounting currency, so all of an owner's accounts already share one. It is
 * written because "all eligible accounts" and "all same-currency accounts" are
 * the same set by construction and not by constraint - the day an account can
 * hold another currency, a selector without this clause starts offering
 * destinations whose row would disagree with the account it sits on, and the
 * settlement writer tags both legs with the closing account's currency
 * regardless.
 *
 * 'bank' cannot collide with the compensation counterpart: migration 031 gave
 * that account its own type, 'boundary', so the type filter excludes it without
 * naming it. That is deliberate - offering it would give the owner two routes
 * to the same write under two names, one of them internal, when DISCARD is
 * already that route (plan doc, "Withdrawal from the system is not a
 * destination").
 */

import { createError } from '../../../utils/errorHandling.js';
import { derivedAccountBalanceSql } from '../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

// account_types.account_type_name. The rule names one type rather than a set of
// them, and it is bound as a parameter rather than interpolated so this file
// contains no SQL built from a name.
export const TRANSFER_DESTINATION_ACCOUNT_TYPE = 'bank';

// NUMERIC, then handed over as text: this is money the owner is about to move,
// and the pg driver's float conversion would round it before it ever reached a
// screen.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

// Both columns, because a destination has to be able to receive money: a closed
// account's residual has already been settled to zero and moving more into it
// would reopen a balance nobody can close again without a second settlement.
// deleted_at alone was sufficient only while closing also wrote it.
//
// The closing account's currency comes from a CTE rather than from a caller's
// copy, so both callers read the same source.
//
// A CROSS JOIN on that CTE, not a subquery in the WHERE clause: when the
// closing account does not exist or belongs to another owner, the CTE is empty
// and the join yields no rows at all. The query degrades to a refusal - an
// empty selector, and a rejected destination - instead of to an unfiltered list
// of every bank account the caller owns.
const ELIGIBLE_DESTINATIONS_QUERY = `
  WITH closing AS (
    SELECT ua.currency_id
      FROM user_accounts ua
     WHERE ua.account_id = $2
       AND ua.user_id = $1
  )
  SELECT
    ua.account_id,
    ua.account_name,
    act.account_type_name,
    cur.currency_code,
    ${DERIVED_BALANCE}::text AS account_balance
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  JOIN currencies cur ON cur.currency_id = ua.currency_id
  CROSS JOIN closing
  WHERE ua.user_id = $1
    AND ua.deleted_at IS NULL
    AND ua.closed_at IS NULL
    AND ua.account_id <> $2
    AND act.account_type_name = $3
    AND ua.currency_id = closing.currency_id
  ORDER BY ua.account_name ASC
`;

/**
 * Every account that may receive the residual of a given closing account.
 *
 * @param {object} db - pool for the selector, transactional client for the
 *   write path. The write path must pass its own client and must already hold
 *   the destination's row lock, or eligibility is read from a state another
 *   transaction can still change.
 * @param {string} userId
 * @param {number} targetAccountId - the account being closed
 * @returns {Promise<Array<{accountId: number, accountName: string, accountTypeName: string, currencyCode: string, accountBalance: string}>>}
 */
export const listTransferDestinations = async (db, userId, targetAccountId) => {
  const { rows } = await db.query(ELIGIBLE_DESTINATIONS_QUERY, [
    userId,
    targetAccountId,
    TRANSFER_DESTINATION_ACCOUNT_TYPE,
  ]);

  return rows.map((row) => ({
    accountId: row.account_id,
    accountName: row.account_name,
    accountTypeName: row.account_type_name,
    currencyCode: row.currency_code,
    // Text, as the driver handed it over. The frontend formats it; nothing
    // here computes with it.
    accountBalance: row.account_balance,
  }));
};

/**
 * The destination a CLOSE request names, or a refusal.
 *
 * Asks for the list above and requires the chosen id to be in it, so a
 * destination the selector could not have offered cannot be settled against.
 *
 * 409 rather than 400: eligibility is a property of the current database state,
 * not of the request's shape. The same request was valid a moment ago if the
 * destination has since been closed or deleted between the selector's read and
 * this confirmation.
 *
 * It does NOT become valid again by reopening that destination: no statement in
 * backend/src sets deleted_at or closed_at back to null, on any path, so a
 * closed account stays ineligible for good (revert-to-active is an open ruling,
 * PLAN_ACCOUNT_DELETION.md). What can make a refused request valid later is the
 * owner creating another bank account in the same currency. The 409 is right
 * either way - this corrects the reason, not the status code.
 *
 * A missing or unparseable id is the caller's own error and is refused with 400
 * by the caller before this runs.
 *
 * @param {object} client - the active transactional client, holding the lock
 * @param {string} userId
 * @param {number} targetAccountId - the account being closed
 * @param {number} destinationAccountId - the account the owner picked
 * @returns {Promise<{accountId: number, accountName: string, accountTypeName: string, currencyCode: string, accountBalance: string}>}
 */
export const assertTransferDestinationEligible = async (
  client,
  userId,
  targetAccountId,
  destinationAccountId,
) => {
  const eligible = await listTransferDestinations(
    client,
    userId,
    targetAccountId,
  );

  const destination = eligible.find(
    (row) => row.accountId === destinationAccountId,
  );

  if (!destination) {
    // The message states the rule rather than which clause failed. Naming the
    // failing clause would report on accounts the caller may not own - the
    // query cannot distinguish "not yours" from "not a bank account" without
    // reading rows outside the owner's set.
    throw createError(
      409,
      `Account ${destinationAccountId} is not an eligible destination for closing account ${targetAccountId}. ` +
        `A destination must belong to you, be open, not be the account being closed, be of type '${TRANSFER_DESTINATION_ACCOUNT_TYPE}', ` +
        'and hold the same currency as the account being closed.',
    );
  }

  return destination;
};
