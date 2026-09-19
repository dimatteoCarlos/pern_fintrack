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
import { createError } from '../../errorHandling.js';

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
 * THE MAP IS COMPLETE OR THERE IS NO MAP. Every id asked for is present, or the
 * call throws. Callers written before that may still test for an absent key; the
 * test is now dead rather than wrong, and costs one comparison.
 *
 * @param {import('pg').PoolClient} client - inside BEGIN; a pool would release
 *  the lock the moment the statement returned
 * @param {string} userId - UUID from the token
 * @param {number[]} accountIds - every account the movement touches; duplicates
 *  are accepted and collapsed
 * @returns {Promise<Map<number, string>>} account_id -> balance as text, one
 *  entry per distinct id asked for
 * @throws {Error} 500 when any id resolves to no owned row
 */
export const lockAndDeriveBalances = async (client, userId, accountIds) => {
  // Distinct AND numeric, and each half answers a different past defect.
  //
  // Distinct, because the check at the end counts: the annulment path passes the
  // target twice, once among the counterparties and once on its own, and
  // `= ANY(...)` returns a single row for a repeated value. Comparing against the
  // raw argument would refuse a set that resolved perfectly.
  //
  // Numeric, because the driver hands account_id back as a number and the Map is
  // keyed on it. A caller passing '45' would look up a key that is not there -
  // the miss that fed NaN to the balance writer, whose `!balance` guard then
  // reported "the balance is already zero" on an account holding 17.42. A value
  // Number() cannot read becomes NaN here and the ::int[] cast refuses it aloud.
  const wanted = [...new Set(accountIds.map(Number))];

  await client.query({
    text: `SELECT ua.account_id
             FROM user_accounts ua
            WHERE ua.account_id = ANY($1::int[])
              AND ua.user_id = $2
            ORDER BY ua.account_id
            FOR UPDATE`,
    values: [wanted, userId],
  });

  const { rows } = await client.query({
    text: `SELECT ua.account_id,
                  ${DERIVED_BALANCE}::text AS balance
             FROM user_accounts ua
            WHERE ua.account_id = ANY($1::int[])
              AND ua.user_id = $2`,
    values: [wanted, userId],
  });

  const balances = new Map(rows.map((row) => [row.account_id, row.balance]));

  // REFUSE RATHER THAN HAND BACK A SHORT MAP, which is the whole point of this
  // function living here. An id that resolved to nothing used to be simply absent
  // from the result: of the nine call sites, four cannot tell "holds nothing"
  // from "there is no such row", and one discards the return value entirely. The
  // detector already existed - residualOf() in deleteAccountService.js - but it
  // guards two callers, so eight lines of it protected a fifth of the surface.
  //
  // 500 rather than 404: every caller resolves ownership before it reaches this
  // helper, so an unresolved id here means an invariant broke upstream, not that
  // the owner asked for an account that is not theirs. The one state this newly
  // catches - a counterparty owned by somebody else - should not exist, and it is
  // dropped silently today.
  const missing = wanted.filter((id) => !balances.has(id));

  if (missing.length > 0) {
    throw createError(
      500,
      `lockAndDeriveBalances resolved no owned account row for ${missing.join(', ')}. Nothing was written.`,
    );
  }

  return balances;
};
