// backend/src/utils/fintrackUtils/accountDataRetrieval/accountUtils.js
//
// Account utilities – reusable functions for account-related operations.
// Used across modules (Budget, Overview, Reports).
//
// Consolidated from accountUtilsV2.js. A query that asks whether money may
// move through an account, or whether the owner should see it, filters both
// stamps - deleted_at IS NULL AND closed_at IS NULL - so neither a deleted nor
// a closed account counts as owned.
//
// Two queries here do not, and each states its reason on the line: resolving
// the owner of a row is identity, not circulation, and the compensation
// account has to be found in whatever state it is in.

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
      -- Not swept with the rest: this answers who owns a row, not whether
      -- money may move through it. A closed_at test here makes the reopen
      -- path fail to resolve the owner of the account it is reopening.
      AND deleted_at IS NULL
  `;
  const result = await db.query(query, [accountId]);
  if (result.rows.length === 0) {
    throw createError(404, `Account not found: ${accountId}`);
  }
  return result.rows[0].user_id;
}

/**
 * Excludes the internal compensation account from a result set, by what the
 * account IS rather than by what it is called. Appended to a WHERE whose
 * query has already joined account_types as `act`.
 *
 * The name filter beside it at each call site stays until 'slack' is
 * reserved at account creation: after 031 an account of that name typed
 * 'bank' can still be captured as the compensation account, and no type
 * predicate can see it. The pre-031 typing is a second, weaker reason and
 * expires on its own.
 *
 * One definition rather than one per controller: the predicate's whole
 * purpose is that it cannot differ between the queries that publish a
 * user's money, and it was already duplicated verbatim in two of them.
 */
/**
 * The account types a request may ask for. This is the creation-side
 * counterpart of NOT_BOUNDARY_ACCOUNT above: one keeps the compensation
 * account out of what is published, this keeps it out of what is created.
 *
 * Written out rather than read from account_types, because the catalog says
 * what CAN exist and this says what a user MAY ask for. 031 added 'boundary'
 * to the catalog, and every controller that resolves a type by querying the
 * catalog accepted it from that moment on, with nothing to notice.
 */
export const USER_CREATABLE_ACCOUNT_TYPES = Object.freeze([
  'bank',
  'cash',
  'investment',
  'debtor',
  'pocket_saving',
  'category_budget',
  'income_source',
]);

/**
 * Returns the normalised type name, or throws a 400 naming the field it came
 * from. Throws rather than returning a boolean because every call site would
 * otherwise write the same throw, and two of them wrote it one line after the
 * dereference that made it unreachable.
 *
 * Case-insensitive, matching the comparison the debtor controller already
 * makes on the source account type; the catalog names are all lowercase.
 */
export const assertUserCreatableAccountType = (accountTypeName, field) => {
  const name = String(accountTypeName ?? '')
    .trim()
    .toLowerCase();

  if (!USER_CREATABLE_ACCOUNT_TYPES.includes(name)) {
    throw createError(
      400,
      `Account type "${name}" is not available on ${field}.`,
    );
  }

  return name;
};

export const NOT_BOUNDARY_ACCOUNT =
 "AND act.account_type_name IS DISTINCT FROM 'boundary'";

/**
 * Get the 'slack' compensation account ID for a user.
 * @param {Object} clientOrPool - Database client or pool.
 * @param {string} userId - User UUID.
 * @returns {Promise<number>} account_id
 */
export async function getSlackAccountId(clientOrPool, userId) {
  const db = clientOrPool || pool;
  // Name AND type, both: the compensation account is the one named 'slack'
  // typed 'boundary'. Matching 'bank' as well would hand back a user's own bank
  // account of that name as the system's counterpart.
  const query = `
    SELECT ua.account_id
    FROM user_accounts ua
    JOIN account_types act ON ua.account_type_id = act.account_type_id
    WHERE ua.user_id = $1
      AND ua.account_name = 'slack'
      AND act.account_type_name = 'boundary'
      -- Not swept: no path can close this row. The boundary type is not
      -- user-creatable and CLOSE only transfers to bank, so closed_at is
      -- never set on it - and a test that finds nothing here does not fail,
      -- it creates a second compensation account.
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
      AND act.account_type_name IS DISTINCT FROM 'boundary'
      AND ua.deleted_at IS NULL
      AND ua.closed_at IS NULL
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
