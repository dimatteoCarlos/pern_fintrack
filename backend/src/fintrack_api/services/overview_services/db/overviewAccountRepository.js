// src/fintrack_api/services/overview_services/db/overviewAccountRepository.js

// The account id sets the Overview calculators read over.
//
// This exists for one reason, and it is D19: the id set an expense breakdown is
// computed over is NOT the set accountUtils.getAccountsByType returns. That
// helper answers "which accounts can a new transaction be assigned to", so it
// filters deleted_at IS NULL. This one answers "which accounts did money move
// through in this month", and a category deleted last week still spent money
// while it existed.
//
// Deleting an account is a soft delete (deleteAccountService.js:362-372 marks
// deleted_at and nothing else), so its transactions survive the account. Reading
// the breakdown through the filtered helper would drop that spending from
// categories while totalAmount kept counting it, and the same page would show
// two figures that must reconcile and do not.

import { createError } from '../../../../utils/errorHandling.js';

// Every category_budget account the user has ever had, deleted ones included.
//
// No join to category_budget_accounts. Whether an account still carries its
// budget row is a different question, answered by ACCOUNTS_QUERY inside
// budget_services; joining it here would silently drop an account whose row was
// removed, and that account's spending is exactly what hasUncategorizedExpense
// exists to reveal.
//
// account_name != 'slack' is deliberately absent too: slack is a bank account,
// so it cannot appear in this result, and restating the filter would suggest it
// could.
const EXPENSE_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name = 'category_budget'
  ORDER BY ua.account_id
`;

// The oldest account the user owns, on the owner's calendar.
//
// This is the E3 guard: a delta is only reported when a COMPLETE prior period
// existed to compare against, and the prior month is complete only if the user
// already had an account before it started. Returned as a local date in text,
// so the service compares it against a month boundary without either side ever
// becoming a Date.
//
// NULL when the user has no accounts at all, which the service reads the same
// way as "younger than the prior month": there is nothing to compare to.
const OLDEST_ACCOUNT_DATE_QUERY = `
  SELECT (MIN(ua.created_at) AT TIME ZONE $2)::date::text AS oldest_account_date
  FROM user_accounts ua
  WHERE ua.user_id = $1
`;

/**
 * The category_budget accounts of a user, soft-deleted ones included (D19).
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getExpenseAccountIds(pool, userId) {
 if (!userId) {
  throw createError(400, 'A user id is required to read expense accounts.');
 }

 const { rows } = await pool.query(EXPENSE_ACCOUNT_IDS_QUERY, [userId]);
 return rows.map((row) => row.account_id);
}

/**
 * The local date the user's oldest account was created, or null if they have none.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<string|null>} 'YYYY-MM-DD', or null
 */
export async function getOldestAccountDate(pool, userId, timeZone = 'UTC') {
 const { rows } = await pool.query(OLDEST_ACCOUNT_DATE_QUERY, [userId, timeZone]);
 return rows[0]?.oldest_account_date ?? null;
}
