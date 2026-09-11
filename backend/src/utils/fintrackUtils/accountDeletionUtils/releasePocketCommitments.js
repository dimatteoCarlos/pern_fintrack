// backend/src/utils/fintrackUtils/accountDeletionUtils/releasePocketCommitments.js

// Give back everything one account has committed to pockets, inside the caller's
// transaction.
//
// WHY THIS IS A FILE AND NOT A LOOP INSIDE CLOSE. Carlos, 2026-09-11: "cualquier
// borrado del tipo que sea, no debe seguir respaldando un pocket." That is a
// rule about every deletion path, not about one of them, and a rule enforced by
// a block of code living inside a single branch is a rule the next branch does
// not get. CLOSE had this loop inline; SOFT had nothing, and stamped deleted_at
// over allocations that stayed standing.
//
// A COMMITMENT IS NOT MONEY. Allocating moves nothing: it reserves part of an
// account's balance so the rest reads as unassigned cash. That is why this runs
// even on an account sitting at zero - the balance can fall after a commitment
// is made, and allocating never checks it again.
//
// RELEASED, NOT DELETED. pocket_allocations is append-only by the design of
// 020_create_pocket_tables.sql: "+300 becomes +250 by writing -50. No repository
// gets an UPDATE or a DELETE path on this table." So this writes the
// compensating negative row through the module's own release, which leaves the
// history readable and shows the giving-back in the pocket's own ledger. A
// DELETE would satisfy the rule silently and destroy the trace.

import { pocketAllocationService } from '../../../fintrack_api/services/pocket_services/services/pocketAllocationService.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../fintrack_api/config/fintrackConfig.js';

/**
 * Release every pocket commitment the account is still backing.
 *
 * Enumerated per pocket rather than in one statement, because a release is per
 * (pocket, source account) pair - the running sum of that pair is the figure the
 * pocket module refuses to push below zero, and one total across pockets could
 * not be checked against it.
 *
 * HAVING SUM > 0 leaves out pairs already settled: a zero pair has nothing to
 * give back, and asking the module to release zero would be refused by the
 * amount <> 0 CHECK on the table.
 *
 * @param {import('pg').PoolClient} dbClient - inside the caller's BEGIN, so the
 *  releases live or die with the deletion
 * @param {string} userId - UUID from the token
 * @param {number} targetAccountId
 * @returns {Promise<{pocketId:number, amount:string}[]>} what each pocket got
 *  back, for the caller's report. Empty when the account backed nothing.
 */
export const releasePocketCommitments = async (
 dbClient,
 userId,
 targetAccountId,
) => {
 const pocketHoldings = await dbClient.query(
  `SELECT pa.pocket_id AS "pocketId", SUM(pa.amount)::text AS held
     FROM pocket_allocations pa
    WHERE pa.user_id = $1 AND pa.source_account_id = $2
    GROUP BY pa.pocket_id
   HAVING SUM(pa.amount) > 0`,
  [userId, targetAccountId],
 );

 const releasedPockets = [];

 for (const holding of pocketHoldings.rows) {
  // The module's own release, on this transaction's client. It writes the
  // compensating row through the same statement the release form does, and
  // applies the same guards - the pair may not go below zero, and the pocket
  // must be the owner's.
  //
  // It no longer applies the "may this account back a pocket" guards, which
  // were made allocate-only on 2026-09-11: a release takes on no commitment, so
  // refusing one on an account already marked deleted stranded the pair instead
  // of protecting it. That matters here because SOFT calls this BEFORE it
  // stamps deleted_at, but a retry after a partial failure would call it after.
  //
  // ACCOUNTING_CURRENCY_CODE, not a lookup: the module refuses any source
  // account not kept in it, so an account that can hold a commitment is already
  // in that unit and the conversion is an identity.
  const released = await pocketAllocationService.release(
   userId,
   holding.pocketId,
   {
    sourceAccountId: targetAccountId,
    amount: Number(holding.held),
    currency: ACCOUNTING_CURRENCY_CODE,
   },
   dbClient,
  );

  releasedPockets.push({
   pocketId: holding.pocketId,
   amount: released.amount,
  });
 }

 return releasedPockets;
};

export default releasePocketCommitments;
