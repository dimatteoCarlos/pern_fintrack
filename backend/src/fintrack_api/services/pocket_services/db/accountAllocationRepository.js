// backend/src/fintrack_api/services/pocket_services/db/accountAllocationRepository.js

// How much of each real account is committed to pockets, and which pocket draws
// on which account.
//
// This is the account's side of the ledger, and it is read here once because it
// has two consumers that must never disagree: the allocate service validates
// against it inside a row lock, and the account screen shows it to the owner.
// Computed twice, the business rule and the figure on screen become two
// implementations of the same formula — which is exactly how the pocket board's
// header came to disagree with its own list.
//
// Amounts leave as text for the reason the whole module keeps them so: the pg
// driver hands NUMERIC over as a string to lose nothing, and money() parses it
// exactly.

/**
 * The committed total and the real balance of accounts the caller owns.
 *
 * Every account is returned, including the ones no pocket draws on: a bank with
 * nothing committed answers "0 committed", which is a figure the account screen
 * has to show. An account with no allocation row would be absent from an inner
 * join, and absent renders as unknown.
 *
 * The 'slack' account is excluded, the magic name every account-type query in
 * this app filters out. It is not a pocket question and it is not fixed here,
 * but omitting the filter would put the internal account on a source list.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} userId - UUID from the token
 * @param {number[]|null} accountIds - restrict to these; null means every one
 * @returns {Promise<object[]>} { accountId, accountName, accountType,
 *  accountBalance, accountAllocated } with the two amounts as text
 */
export async function getAccountAllocations(db, userId, accountIds = null) {
 const { rows } = await db.query(
  `
  SELECT
   ua.account_id                       AS "accountId",
   ua.account_name                     AS "accountName",
   act.account_type_name               AS "accountType",
   ua.account_balance::text            AS "accountBalance",
   COALESCE(SUM(pa.amount), 0)::text   AS "accountAllocated"
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  LEFT JOIN pocket_allocations pa ON pa.source_account_id = ua.account_id
  WHERE ua.user_id = $1
   AND ua.deleted_at IS NULL
   AND ua.account_name <> 'slack'
   AND ($2::int[] IS NULL OR ua.account_id = ANY($2::int[]))
  GROUP BY ua.account_id, act.account_type_name
  ORDER BY ua.account_name ASC
  `,
  [userId, accountIds],
 );

 return rows;
}

/**
 * Which accounts each pocket draws on.
 *
 * The pair (pocket, source account) is the level a release is measured at, and
 * the level the board's coverage warning folds over: a pocket is uncovered when
 * one of the accounts in this map no longer covers what is committed to it.
 *
 * A pair whose net has fallen to zero after a full release is dropped. The
 * account stopped contributing, and listing it would put a source on the screen
 * that holds nothing; the allocation history keeps the trace of the one that
 * left.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} userId - UUID from the token
 * @param {number|null} pocketId - restrict to one pocket; null means every one
 * @returns {Promise<object[]>} { pocketId, accountId, heldByThisPocket } with
 *  the amount as text
 */
export async function getPocketSourceHoldings(db, userId, pocketId = null) {
 const { rows } = await db.query(
  `
  SELECT
   pa.pocket_id                AS "pocketId",
   pa.source_account_id        AS "accountId",
   SUM(pa.amount)::text        AS "heldByThisPocket"
  FROM pocket_allocations pa
  WHERE pa.user_id = $1
   AND ($2::int IS NULL OR pa.pocket_id = $2::int)
  GROUP BY pa.pocket_id, pa.source_account_id
  HAVING SUM(pa.amount) <> 0
  `,
  [userId, pocketId],
 );

 return rows;
}
