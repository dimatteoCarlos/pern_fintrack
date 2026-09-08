// backend/src/utils/fintrackUtils/accountDeletionUtils/eraseAccountTail.js
//
// The erasure tail called by the hard-delete and RTA paths (§4.1 steps
// 6d/7d/8d). Interim use here: wired into the legacy deleteAccountService.js
// call sites so a hard delete or RTA reaches the DELETE FROM user_accounts
// with every reference already gone, instead of hitting the RESTRICT foreign
// keys added by migration 018.
//
// Corrected 2026-09-07: this header said "shared by CLOSE, DELETE and RTA",
// which is the plan's design and not the wiring. CLOSE never calls it, as the
// note further down this file already said. Recorded rather than replaced
// because two sessions read the header, reasoned correctly about which rows
// the rewrites below can reach, and both concluded a closed account leaves no
// name anywhere - and a closed account can never reach this function at all,
// so its settlement pair keeps both names permanently.

/**
 * Detach, scrub and drop a target account, inside an open transaction.
 * @param {import('pg').PoolClient} dbClient - inside BEGIN.
 * @param {string} userId - UUID, owner of the account being erased.
 * @param {number} targetAccountId - the account being deleted.
 * @param {string} targetAccountName - the account's current name, read from
 *  the database (accountCheck), never a client-supplied value: a stale or
 *  missing name would scrub nothing, or scrub the wrong text.
 */
export const eraseAccountTail = async (
  dbClient,
  userId,
  targetAccountId,
  targetAccountName,
) => {
  // 6d DETACH + 7d SCRUB, per column: null the FK on any surviving row that
  // names the target as source or destination, and strip the target's name
  // out of that row's description. account_id is never touched here - a
  // row's owner never changes, only its reference to the account being
  // deleted.
  //
  // Corrected 2026-09-07. This said the same rewrite strips the target's name
  // out of any 'RTA Annulment Target(<name>).' prefix while leaving the prefix
  // standing. That operation never runs on those rows: the annulment writer
  // puts the affected and boundary accounts in the two key columns and the
  // target in neither, so a deletion's own reversal rows are outside the
  // population both statements here select. The name survives in them
  // permanently and the endpoint still reports success, because nulling the
  // keys is unaffected. The prefix count was wrong too - five predicates
  // across three Overview repositories, and one of them is a positive LIKE,
  // not a NOT LIKE.
  await dbClient.query(
    `UPDATE transactions
        SET source_account_id = NULL,
            description = REPLACE(description, $2, '[deleted account]')
      WHERE source_account_id = $1
        AND account_id <> $1`,
    [targetAccountId, targetAccountName],
  );
  await dbClient.query(
    `UPDATE transactions
        SET destination_account_id = NULL,
            description = REPLACE(description, $2, '[deleted account]')
      WHERE destination_account_id = $1
        AND account_id <> $1`,
    [targetAccountId, targetAccountName],
  );

  // Both statements above go dead under the two-operation shape Carlos narrowed
  // the redesign to on 2026-09-07, and that is worth stating here rather than
  // leaving a later reader to infer it. There, a row is physically removed only
  // when removing it destroys nothing - no other account's row references the
  // target - which is exactly the condition that makes both WHERE clauses match
  // zero rows. They stay anyway: the precondition would live in the caller, and
  // a tail that assumes its caller checked is a tail that detaches nothing the
  // day someone calls it without checking.

  // pocket_allocations.source_account_id is NOT NULL and RESTRICTs (unlike
  // transactions' two nullable FKs above), so it cannot be detached the same
  // way - the row itself has to go. This is the explicit, out-loud deletion
  // POCKET_MODULE_SPEC.md §11.1 Q8b decided on: "the service deletes the
  // allocation rows and the account in the same transaction" - never a
  // silent cascade, and RESTRICT stays in place as the guard rail below.
  // Q8b's report-then-confirm half is closed: the assessment endpoint publishes
  // pocketImpact with removesPocketAllocations per deletion type, so the owner
  // sees which pockets lose backing, and which choices leave them alone, before
  // confirming anything. CLOSE and SOFT never reach this line.
  //
  // THIS LINE IS ALSO WHY THE RESTRICT ON pocket_allocations PROTECTS NOTHING,
  // measured 2026-09-07 against the redesign proposal, whose pocket case reads
  // that constraint as already enforcing "never removed, only marked". It does
  // not: the allocations are cleared here first, so the constraint never fires
  // and the allocation history leaves with the account. Nor does a transaction
  // row stand in its place - insertAllocation writes to pocket_allocations only
  // and emits nothing into transactions - so an account can back allocations
  // while its sole ledger row is its own opening. Any precondition for physical
  // removal that is stated over transaction rows alone admits exactly that
  // account, and this DELETE is what carries out the removal it should have
  // refused.
  await dbClient.query(
    'DELETE FROM pocket_allocations WHERE source_account_id = $1 AND user_id = $2',
    [targetAccountId, userId],
  );

  // 8d DROP: the target's own rows, then the account itself. RESTRICT is
  // still the guard rail - if any reference to targetAccountId survived the
  // two UPDATEs above, this DELETE fails exactly as it does today, instead
  // of silently succeeding over a dangling reference.
  await dbClient.query('DELETE FROM transactions WHERE account_id = $1', [
    targetAccountId,
  ]);
  await dbClient.query(
    'DELETE FROM user_accounts WHERE account_id = $1 AND user_id = $2',
    [targetAccountId, userId],
  );
};
