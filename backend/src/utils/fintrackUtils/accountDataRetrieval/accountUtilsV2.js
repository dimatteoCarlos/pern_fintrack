// src/fintrack_api/services/fintrackUtils/accountUtils.js

// Account utilities – Reusable functions for account-related operations.
// These functions are used across multiple modules (Budget, Overview, Reports, etc.).

import { pool } from '../../db/config/configDB.js';

/**
 * Get account type ID from account type name.
 * @param {Object} clientOrPool - Database client or pool.
 * @param {string} accountTypeName - Name of the account type (e.g. 'category_budget').
 * @returns {Promise<number>} account_type_id
 */
export async function getAccountTypeId(clientOrPool, accountTypeName) {
  const db = clientOrPool || pool;
  const query = 'SELECT account_type_id FROM account_types WHERE account_type_name = $1';
  const result = await db.query(query, [accountTypeName]);
  if (result.rows.length === 0) {
    throw new Error(`Account type not found: ${accountTypeName}`);
  }
  return result.rows[0].account_type_id;
}

/**
 * Get user ID from account ID.
 * @param {Object} pool - Database connection pool.
 * @param {number} accountId - Account ID.
 * @returns {Promise<string>} user_id (UUID)
 */
export async function getUserIdFromAccount(pool, accountId) {
  const query = 'SELECT user_id FROM user_accounts WHERE account_id = $1';
  const result = await pool.query(query, [accountId]);
  if (result.rows.length === 0) {
    throw new Error(`Account not found: ${accountId}`);
  }
  return result.rows[0].user_id;
}

/**
 * Get the "slack" account ID for a user.
 * @param {Object} pool - Database connection pool.
 * @param {string} userId - User UUID.
 * @returns {Promise<number>} account_id of the slack account
 */
export async function getSlackAccountId(pool, userId) {
  const query = `
    SELECT account_id
    FROM user_accounts
    WHERE user_id = $1 AND account_name = 'slack'
  `;
  const result = await pool.query(query, [userId]);
  if (result.rows.length === 0) {
    throw new Error('Slack account not found for this user');
  }
  return result.rows[0].account_id;
}

/**
 * Get all accounts of a specific type for a user.
 * Returns detailed information including subcategory, nature, and currency.
 * Used by budget exports and other modules that need account lists.
 *
 * @param {string} userId - UUID of the user.
 * @param {string} accountType - Account type name (e.g. 'category_budget').
 * @returns {Promise<Array<{ accountId: number, accountName: string, subcategory: string | null, nature: string | null, currency: string }>>}
 */
export async function getAccountsByType(userId, accountType) {
  const query = `
    SELECT 
      ua.account_id, 
      ua.account_name, 
      cba.subcategory, 
      cba.nature,
      cur.currency_code AS currency
    FROM user_accounts ua
    JOIN account_types act ON ua.account_type_id = act.account_type_id
    JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
    JOIN currencies cur ON ua.currency_id = cur.currency_id
    WHERE ua.user_id = $1
      AND act.account_type_name = $2
      AND ua.account_name != 'slack'
    ORDER BY ua.account_name ASC
  `;
  const result = await pool.query(query, [userId, accountType]);
  return result.rows.map(row => ({
    accountId: row.account_id,
    accountName: row.account_name,
    subcategory: row.subcategory || null,
    nature: row.nature || null,
    currency: row.currency,
  }));
}