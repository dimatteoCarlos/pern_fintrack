// backend/src/utils/fintrackUtils/accountManagement/lockAndDeriveBalances.js
/**
 * Lock every account a movement touches, then derive what each one holds.
 *
 * Moved out of transactionController.js when the account-creation path became
 * its second caller. It was never controller logic: it is the one place that
 * decides how a money decision reads a balance, and a shared invariant living
 * inside one controller is the shape that makes the next caller copy it rather
 * than import it.
 */

import { derivedAccountBalanceSql } from '../accountDataRetrieval/derivedBalance.js';

// The account's opening amount plus its movements. What the stored column was
// supposed to hold and no longer does.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

/**
 * Lock every account a movement touches, then derive what each one holds.
 *
 * Two independent defects are closed here. user_accounts.account_balance has
 * drifted from the ledger, so a funds check reading it refuses or admits against
 * a ceiling that is not the account's. And BEGIN gives atomicity, not exclusion:
 * two simultaneous movements on one account both read the same prior state, both
 * pass the check, and both write.
 *
 * The lock is taken in ascending account_id order. A transfer A -> B racing a
 * transfer B -> A would, locking in the direction of the movement, leave each
 * transaction holding the row the other is waiting for; one global order means
 * one of them simply waits and the cycle never forms.
 *
 * The derivation is a SECOND statement and is never joined into the locking one,
 * the pattern accountAllocationRepository.js:227 already documents: inside a
 * locking statement the locked row is re-read at its latest committed version
 * while every other table is still read from the statement's original snapshot,
 * so a derivation joined there would combine the lock's view of the account with
 * a stale view of transactions. Issued once the lock is held, this one sees
 * every movement the competitor it just waited out committed.
 *
 * Ownership is filtered in both statements rather than inherited from the
 * caller. A helper whose safety depends on what its caller happened to do first
 * is unsafe the first time it is called from somewhere else.
 *
 * NUMERIC as text: the pg driver hands NUMERIC over as a string to lose nothing,
 * and this figure is about to decide whether a request is refused.
 *
 * @param {import('pg').PoolClient} client - inside BEGIN; a pool would release
 *  the lock the moment the statement returned
 * @param {string} userId - UUID from the token
 * @param {number[]} accountIds - every account the movement touches
 * @returns {Promise<Map<number, string>>} account_id -> balance as text
 */
export const lockAndDeriveBalances = async (client, userId, accountIds) => {
  await client.query({
    text: `SELECT ua.account_id
             FROM user_accounts ua
            WHERE ua.account_id = ANY($1::int[])
              AND ua.user_id = $2
            ORDER BY ua.account_id
            FOR UPDATE`,
    values: [accountIds, userId],
  });

  const { rows } = await client.query({
    text: `SELECT ua.account_id,
                  ${DERIVED_BALANCE}::text AS balance
             FROM user_accounts ua
            WHERE ua.account_id = ANY($1::int[])
              AND ua.user_id = $2`,
    values: [accountIds, userId],
  });

  return new Map(rows.map((row) => [row.account_id, row.balance]));
};
