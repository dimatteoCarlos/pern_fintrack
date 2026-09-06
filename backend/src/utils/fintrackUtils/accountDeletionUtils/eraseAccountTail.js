// backend/src/utils/fintrackUtils/accountDeletionUtils/eraseAccountTail.js
//
// The erasure tail shared by CLOSE, DELETE and RTA (PLAN_ACCOUNT_DELETION.md
// §4, §4.1 steps 6d/7d/8d). Interim use here: wired into the legacy
// deleteAccountService.js call sites so a hard delete or RTA reaches the
// DELETE FROM user_accounts with every reference already gone, instead of
// hitting the RESTRICT foreign keys added by migration 018.

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
  // deleted. This also strips the target's name out of the parentheses of
  // any 'RTA Annulment Target(<name>).' prefix on a surviving row, leaving
  // the prefix itself untouched (PLAN_ACCOUNT_DELETION.md §4.2) - Overview's
  // NOT LIKE filters match on the prefix, never on what follows it.
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
