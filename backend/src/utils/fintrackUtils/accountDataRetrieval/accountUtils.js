// backend/src/utils/fintrackUtils/accountDataRetrieval/accountUtils.js
//
// Account utilities – reusable functions for account-related operations.
// Used across modules (Budget, Overview, Reports).
//
// Consolidated from accountUtilsV2.js. Every query filters deleted_at IS NULL:
// a soft-deleted account must not count as owned, or it keeps passing
// ownership checks and keeps appearing in exports.

import { pool } from '../../../db/config/configDB.js';
import { createError } from '../../errorHandling.js';

/**
 * Get account type ID from account type name.
 * @param {Object} clientOrPool - Database client or pool. Falls back to the shared pool.
 * @param {string} accountTypeName - e.g. 'category_budget'.
 * @returns {Promise<number>} account_type_id
 */
export async function getAccountTypeId(clientOrPool, accountTypeName) {
  const db = clientOrPool || pool;
  const query = 'SELECT account_type_id FROM account_types WHERE account_type_name = $1';
  const result = await db.query(query, [accountTypeName]);
  if (result.rows.length === 0) {
    throw createError(404, `Account type not found: ${accountTypeName}`);
  }
  return result.rows[0].account_type_id;
}

/**
 * Get user ID from account ID.
 * @param {Object} clientOrPool - Database client or pool.
 * @param {number} accountId
 * @returns {Promise<string>} user_id (UUID)
 */
export async function getUserIdFromAccount(clientOrPool, accountId) {
  const db = clientOrPool || pool;
  const query = `
    SELECT user_id
    FROM user_accounts
    WHERE account_id = $1
      AND deleted_at IS NULL
  `;
  const result = await db.query(query, [accountId]);
  if (result.rows.length === 0) {
    throw createError(404, `Account not found: ${accountId}`);
  }
  return result.rows[0].user_id;
}

/**
 * Get the 'slack' compensation account ID for a user.
 * @param {Object} clientOrPool - Database client or pool.
 * @param {string} userId - User UUID.
 * @returns {Promise<number>} account_id
 */
export async function getSlackAccountId(clientOrPool, userId) {
  const db = clientOrPool || pool;
  const query = `
    SELECT ua.account_id
    FROM user_accounts ua
    JOIN account_types act ON ua.account_type_id = act.account_type_id
    WHERE ua.user_id = $1
      AND ua.account_name = 'slack'
      AND act.account_type_name = 'bank'
      AND ua.deleted_at IS NULL
  `;
  const result = await db.query(query, [userId]);
  if (result.rows.length === 0) {
    throw createError(
      404,
      'The required compensation account "slack" was not found for this user. Please create it first.',
    );
  }
  return result.rows[0].account_id;
}

/**
 * Get all accounts of a given type for a user, with subcategory, nature and currency.
 * Used by the Budget module for ownership checks and exports.
 *
 * `nature` is a catalog value, not a column on category_budget_accounts. The
 * join is LEFT because category_nature_type_id is nullable: an inner join would
 * silently drop accounts with no nature from the ownership check, turning a
 * missing label into a 403 on an account the caller does own.
 *
 * @param {string} userId - User UUID.
 * @param {string} accountType - e.g. 'category_budget'.
 * @returns {Promise<Array<{accountId: number, accountName: string, subcategory: string|null, nature: string|null, currency: string}>>}
 */
export async function getAccountsByType(userId, accountType) {
  const query = `
    SELECT
      ua.account_id,
      ua.account_name,
      cba.subcategory,
      cnt.category_nature_type_name AS nature,
      cur.currency_code AS currency
    FROM user_accounts ua
    JOIN account_types act ON ua.account_type_id = act.account_type_id
    JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
    JOIN currencies cur ON ua.currency_id = cur.currency_id
    LEFT JOIN category_nature_types cnt
      ON cnt.category_nature_type_id = cba.category_nature_type_id
    WHERE ua.user_id = $1
      AND act.account_type_name = $2
      AND ua.account_name != 'slack'
      AND ua.deleted_at IS NULL
    ORDER BY ua.account_name ASC
  `;
  const result = await pool.query(query, [userId, accountType]);
  return result.rows.map((row) => ({
    accountId: row.account_id,
    accountName: row.account_name,
    subcategory: row.subcategory || null,
    nature: row.nature || null,
    currency: row.currency,
  }));
}
