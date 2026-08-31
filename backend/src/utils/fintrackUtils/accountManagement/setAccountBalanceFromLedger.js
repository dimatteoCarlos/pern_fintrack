// backend/src/utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js
/**
 * Write the stored balance of one account as the ledger's own arithmetic.
 *
 * What this replaces. Two writers took a figure their caller had computed in
 * JavaScript — read the balance, add or subtract the movement in memory, store
 * the result — so the column and the ledger could part company, and on
 * fintrack_dev they had: several accounts held a figure their own rows did not
 * produce. Nothing detected it, because every reader had already moved to the
 * derivation and the column was only read by the write path.
 *
 * The column stops being a value and becomes a projection: it is no longer
 * something the application knows and stores, it is something the ledger says
 * and the column repeats. There is exactly one arithmetic, the one every read
 * path imports, so a screen and an enforcement check cannot disagree about what
 * an account holds.
 */

import { derivedAccountBalanceSql } from '../accountDataRetrieval/derivedBalance.js';

// NUMERIC, not FLOAT: this figure is written to a DECIMAL column and a float
// round trip would store a value the ledger does not produce, which is the
// defect this module exists to close.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

/**
 * Re-derive one account's stored balance from its own rows.
 *
 * **The caller must already hold the row lock**, taken in an EARLIER statement —
 * lockAndDeriveBalances does this, in ascending account id order. The
 * requirement is not tidiness: inside a locking statement the locked row is
 * re-read at its latest committed version while every other table is still read
 * from that statement's original snapshot, so a derivation issued as part of the
 * lock would combine a fresh view of user_accounts with a stale view of
 * transactions and yield a figure belonging to no instant. Issued after the lock
 * is held, this statement's snapshot includes every movement the competitor it
 * waited out committed.
 *
 * Ownership is filtered here rather than inherited from the caller: a helper
 * whose safety depends on what its caller happened to do first is unsafe the
 * first time it is called from somewhere else.
 *
 * @param {import('pg').PoolClient} client - inside BEGIN, holding the row lock
 * @param {number} accountId - the account whose column is being re-derived
 * @param {string} userId - UUID from the token
 * @returns {Promise<object|null>} the updated row, or null when no row matched
 */
export const setAccountBalanceFromLedger = async (
  client,
  accountId,
  userId,
) => {
  const result = await client.query({
    // updated_at records when the row was last touched, never the date of the
    // movement that caused it.
    text: `UPDATE user_accounts ua
              SET account_balance = ${DERIVED_BALANCE},
                  updated_at = NOW()
            WHERE ua.account_id = $1
              AND ua.user_id = $2
        RETURNING ua.*`,
    values: [accountId, userId],
  });

  return result.rows[0] ?? null;
};
