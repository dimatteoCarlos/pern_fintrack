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
// The balance both consumers read is derived from the ledger, not taken from
// user_accounts.account_balance. NUMERIC and never FLOAT: this figure is handed
// to a decimal library and compared against a committed total, and money must
// not pass through a float on its way to a comparison that refuses a request.
//
// Amounts leave as text for the reason the whole module keeps them so: the pg
// driver hands NUMERIC over as a string to lose nothing, and money() parses it
// exactly.

import { derivedAccountBalanceSql } from '../../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

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
   -- Derived from the ledger, not read from the stored column. This figure and
   -- the one the locked check below enforces must be the same number, or the
   -- server refuses a commitment quoting a ceiling the owner was never shown.
   ${DERIVED_BALANCE}::text            AS "accountBalance",
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

/**
 * The pockets one account is backing, and how much of it each one holds.
 *
 * The account screen's answer to "what is this money committed to". It lists
 * the goal by name rather than by id, because the line is read by the owner and
 * an id names nothing to them.
 *
 * A pocket whose net from this account has fallen to zero is absent: it no
 * longer draws on the account, and the pocket's own history keeps the trace.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} userId - UUID from the token
 * @param {number} accountId
 * @returns {Promise<object[]>} { pocketId, name, heldFromThisAccount } as text
 */
export async function getPocketsForAccount(db, userId, accountId) {
 const { rows } = await db.query(
  `
  SELECT
   p.pocket_id            AS "pocketId",
   p.name                 AS name,
   SUM(pa.amount)::text   AS "heldFromThisAccount"
  FROM pocket_allocations pa
  JOIN pockets p ON p.pocket_id = pa.pocket_id
  WHERE pa.user_id = $1
   AND pa.source_account_id = $2
  GROUP BY p.pocket_id, p.name
  HAVING SUM(pa.amount) <> 0
  ORDER BY p.name ASC
  `,
  [userId, accountId],
 );

 return rows;
}

/**
 * What each account gets back when one pocket is deleted.
 *
 * Read BEFORE the delete and inside the same transaction: afterwards the ledger
 * is gone by cascade and there is nothing left to report. It carries the account
 * name because the answer is read by a human — a list of ids does not tell the
 * owner which cash came back where.
 *
 * @param {import('pg').PoolClient} client - inside BEGIN
 * @param {string} userId - UUID from the token
 * @param {number} pocketId
 * @returns {Promise<object[]>} { accountId, accountName, freedCash } as text
 */
export async function getFreedCashByAccount(client, userId, pocketId) {
 const { rows } = await client.query(
  `
  SELECT
   pa.source_account_id   AS "accountId",
   ua.account_name        AS "accountName",
   SUM(pa.amount)::text   AS "freedCash"
  FROM pocket_allocations pa
  JOIN user_accounts ua ON ua.account_id = pa.source_account_id
  WHERE pa.user_id = $1
   AND pa.pocket_id = $2
  GROUP BY pa.source_account_id, ua.account_name
  HAVING SUM(pa.amount) <> 0
  ORDER BY ua.account_name ASC
  `,
  [userId, pocketId],
 );

 return rows;
}

/**
 * Resolve a source account the caller owns, locking it for the rest of the
 * transaction, and report what is already committed against it.
 *
 * Ownership is proven by joining to user_accounts.user_id rather than trusting
 * the accountId. FOR UPDATE closes the window between the check and the write:
 * two simultaneous allocations would otherwise both read the same unassigned
 * cash, both pass, and together commit more than the account holds.
 *
 * The committed total is read here rather than in a second call, because the
 * lock is already holding the row the answer is about. Reading it afterwards on
 * another connection would read it outside the lock, which is the same race with
 * an extra step.
 *
 * Deliberately not 404 when there is no row. Distinguishing "does not exist"
 * from "not yours" would let a caller enumerate other users' account ids.
 *
 * @param {import('pg').PoolClient} client - inside BEGIN; a pool would release
 *  the lock the moment this query returned
 * @param {string} userId - UUID from the token
 * @param {number} accountId
 * @returns {Promise<object|null>} the row, or null when there is none
 */
export async function lockOwnedSourceAccount(client, userId, accountId) {
 const { rows } = await client.query(
  `
  SELECT
   ua.account_id                     AS "accountId",
   ua.account_name                   AS "accountName",
   act.account_type_name             AS "accountType",
   ua.currency_id                    AS "currencyId",
   ua.deleted_at                     AS "deletedAt",
   COALESCE((
    SELECT SUM(pa.amount)
      FROM pocket_allocations pa
     WHERE pa.source_account_id = ua.account_id
   ), 0)::text                       AS "accountAllocated"
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.account_id = $1
   AND ua.user_id = $2
  FOR UPDATE OF ua
  `,
  [accountId, userId],
 );

 if (!rows[0]) return null;

 // The balance is derived in a SECOND statement, deliberately, and never joined
 // into the one above.
 //
 // In the locking statement the locked row is re-read at its latest committed
 // version while every other table is read from the statement's original
 // snapshot. A derivation joined there would combine two points in time: the
 // lock's view of the account and a stale view of its movements. Issued after
 // the lock is held, this statement takes a fresh snapshot and therefore sees
 // every transaction that committed before it began — including those of the
 // competitor this lock just waited out. The lock still serialises; only the
 // figure is now the ledger's rather than the stored column's.
 //
 // It has to be the same figure the picker showed, or a commitment inside the
 // ceiling the owner saw is refused by a 422 quoting a number they never saw.
 const { rows: derived } = await client.query(
  `SELECT ${DERIVED_BALANCE}::text AS "accountBalance"
     FROM user_accounts ua
    WHERE ua.account_id = $1`,
  [accountId],
 );

 return { ...rows[0], accountBalance: derived[0].accountBalance };
}

/**
 * The net one pocket holds from one account, read inside the lock.
 *
 * This is the figure a release is measured against: releasing is not "release
 * 400 from this pocket" but "release 400 of what this pocket holds FROM CASH",
 * and the running sum of that pair may never go below zero.
 *
 * @param {import('pg').PoolClient} client - inside BEGIN
 * @param {string} userId - UUID from the token
 * @param {number} pocketId
 * @param {number} accountId
 * @returns {Promise<string>} the net as text, '0' when the pair has no rows
 */
export async function getHeldByPocketFromAccount(
 client,
 userId,
 pocketId,
 accountId,
) {
 const { rows } = await client.query(
  `
  SELECT COALESCE(SUM(pa.amount), 0)::text AS held
    FROM pocket_allocations pa
   WHERE pa.user_id = $1
     AND pa.pocket_id = $2
     AND pa.source_account_id = $3
  `,
  [userId, pocketId, accountId],
 );

 return rows[0].held;
}

/**
 * Append one row to the ledger.
 *
 * The only write this table ever takes. There is no UPDATE and no DELETE path
 * anywhere in this module: +300 becomes +250 by writing -50, and the rows are
 * the history.
 *
 * amount arrives already signed by the service — positive for an allocation,
 * negative for a release. The client never sends a sign.
 *
 * @param {import('pg').PoolClient} client - inside BEGIN, holding the account lock
 * @returns {Promise<object>} the row written
 */
export async function insertAllocation(client, userId, allocation) {
 const { rows } = await client.query(
  `
  INSERT INTO pocket_allocations (
   user_id, pocket_id, source_account_id, amount, allocation_actual_date,
   original_amount, original_currency_id, exchange_rate, exchange_rate_source,
   exchange_rate_timestamp, exchange_rate_target_currency_id
  )
  VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, CURRENT_TIMESTAMP),
          $6, $7, $8, $9, $10, $11)
  RETURNING allocation_id::text AS "allocationId",
            amount::text        AS amount,
            allocation_actual_date AS "allocationActualDate"
  `,
  [
   userId,
   allocation.pocketId,
   allocation.sourceAccountId,
   allocation.amount,
   allocation.allocationDate ?? null,
   allocation.originalAmount,
   allocation.originalCurrencyId,
   allocation.exchangeRate,
   allocation.exchangeRateSource,
   allocation.exchangeRateTimestamp,
   allocation.exchangeRateTargetCurrencyId,
  ],
 );

 return rows[0];
}
