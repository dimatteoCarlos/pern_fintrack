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

// The accounts an income figure is read over: the ones that hold real money.
//
// I1 sums the leg that lands in the user's own account, not the one that leaves
// income_source, and this set is what selects it. Filtering by
// transaction_type_id instead would be a second condition saying the same thing,
// free to drift from the account set the count and the list are built on — the
// disagreement §4.2 forbids, and the reason the catalog's own annotation had the
// direction inverted until it was checked against getIncomeConfig.
//
// slack is excluded by name because it is a bank account by type: it is the
// internal counterparty of pnl, income and expense, and no figure calls it the
// user's money.
//
// cash (account_type_id 7) is deliberately absent. The catalog leaves it out
// until the phase 2b probe says whether it has real writes, and inventing its
// inclusion here would be this module deciding a question the catalog holds
// open.
const INCOME_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name IN ('bank', 'investment', 'debtor', 'pocket_saving')
    AND ua.account_name != 'slack'
  ORDER BY ua.account_id
`;

// The accounts a realized P/L figure is read over: every account the user owns
// except slack.
//
// No account type filter, because PL1 states none. It covers movement_type_id 9
// across all accounts, which is what separates it from Investment.V3 — the same
// movement narrowed to investment accounts. In practice a pnl row only ever
// touches a bank or an investment account and slack, so the broader set returns
// the same rows; it is written broad anyway, because narrowing it here would be
// this module asserting something PL1 does not.
const PNL_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  WHERE ua.user_id = $1
    AND ua.account_name != 'slack'
  ORDER BY ua.account_id
`;

// The accounts of one type, slack excluded — the set Debt and Pocket are each
// read over.
//
// One statement with the type as a bind parameter, not two. A type name is a
// value the catalog already holds, not a piece of SQL structure, so this is not
// the template with holes the module argues against elsewhere: the shape of the
// statement is fixed and only the value moves.
//
// No deleted_at filter, for the same reason the expense set has none and the
// catalog's D1/P1/H1 state none: a soft-deleted account still owns the balance
// it held in the months before it was closed, and the balance series would bend
// at the month of the deletion if those rows vanished. Closing an account writes
// a compensating movement (R212's annulment rows), so a closed account
// contributes 0 to today's figure without being filtered out of yesterday's.
const ACCOUNT_IDS_BY_TYPE_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name = $2
    AND ua.account_name != 'slack'
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
 * The real money accounts of a user, slack excluded — the set income is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getIncomeAccountIds(pool, userId) {
 if (!userId) {
  throw createError(400, 'A user id is required to read income accounts.');
 }

 const { rows } = await pool.query(INCOME_ACCOUNT_IDS_QUERY, [userId]);
 return rows.map((row) => row.account_id);
}

/**
 * Every account of a user except slack — the set realized P/L is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getPnlAccountIds(pool, userId) {
 if (!userId) {
  throw createError(400, 'A user id is required to read pnl accounts.');
 }

 const { rows } = await pool.query(PNL_ACCOUNT_IDS_QUERY, [userId]);
 return rows.map((row) => row.account_id);
}

/**
 * The accounts of one type belonging to a user, slack excluded.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @param {string} accountTypeName - a name from the account_types catalog
 * @returns {Promise<number[]>} account ids, ascending
 */
async function getAccountIdsByType(pool, userId, accountTypeName) {
 if (!userId) {
  throw createError(400, `A user id is required to read ${accountTypeName} accounts.`);
 }

 const { rows } = await pool.query(ACCOUNT_IDS_BY_TYPE_QUERY, [userId, accountTypeName]);
 return rows.map((row) => row.account_id);
}

/**
 * The debtor accounts of a user — the set the net debt position is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getDebtAccountIds(pool, userId) {
 return getAccountIdsByType(pool, userId, 'debtor');
}

/**
 * The pocket_saving accounts of a user — the set the pocket balance is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getPocketAccountIds(pool, userId) {
 return getAccountIdsByType(pool, userId, 'pocket_saving');
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
