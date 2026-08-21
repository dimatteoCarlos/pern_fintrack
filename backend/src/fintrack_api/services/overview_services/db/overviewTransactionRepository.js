// src/fintrack_api/services/overview_services/db/overviewTransactionRepository.js

// The transaction rows behind an Overview domain card, one page at a time.
//
// Pagination is server-side for this surface and only for this surface (the
// categories array and the six-month trend are whole or they are wrong). The
// list is the one part of the response whose size the data decides rather than
// the contract, so it is the one part that has to be bounded.
//
// The row shape is the one already served by getTransactionsForAccountById —
// tr.* plus the catalog names and the local date — because the frontend renders
// both lists with the same component. A second shape for the same row would be a
// second component, or a mapper nobody remembers to update.
//
// One pair of statements per domain, and both halves of a pair carry the same
// WHERE. Each pair's filter is the one its monthly statement uses in
// overviewMonthlyRepository.js: a list that showed rows the card did not count —
// or counted rows it did not show — is the disagreement §4.2 forbids, arriving
// through the list instead of through a figure. D21 turns that into something
// checkable: card.transactionCount and transactions.totalRows are the same
// number, not merely compatible ones.
//
// transaction_id breaks the tie in ORDER BY. Without it two transactions
// timestamped in the same second can swap places between two requests, and a row
// can appear on page 1 and page 2 or on neither, which is how a paginated list
// silently loses a row.
//
// R42, §4.5: bounds go local boundary -> instant, transaction_local_date goes
// instant -> local date. One conversion per operand, opposite directions.
// ::timestamp on the lower bound is load-bearing — with a bare date, AT TIME
// ZONE picks the TIMESTAMPTZ overload and converts the bound the wrong way.

import { extractNoteFromDescription } from '../../../../utils/fintrackUtils/transactionManagement/extractNoteFromDescription.js';

const EXPENSE_PAGE_QUERY = `
  SELECT
    tr.*,
    mt.movement_type_name,
    trt.transaction_type_name,
    act.account_type_name,
    cr.currency_code,
    ua.account_name,
    ua.account_type_id,
    (tr.transaction_actual_date AT TIME ZONE $3)::date::text AS transaction_local_date
  FROM transactions tr
  JOIN movement_types mt ON mt.movement_type_id = tr.movement_type_id
  JOIN transaction_types trt ON trt.transaction_type_id = tr.transaction_type_id
  JOIN currencies cr ON cr.currency_id = tr.currency_id
  JOIN user_accounts ua ON ua.account_id = tr.account_id
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id IN (1, 6)
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC
  LIMIT $4 OFFSET $5
`;

// How many rows the page was cut out of.
//
// A whole second statement rather than a COUNT(*) OVER () on the query above.
// The window function returns nothing when the page is empty, so a caller that
// asked for page 9 of a 2-page result would be told there are 0 rows in total —
// it could not tell "you over-paged" from "there is no data", and those need
// different screens.
//
// Its WHERE clause must stay identical to its page statement's. Kept as whole
// readable statements instead of one template with holes, for the reason
// getTransactionsForAccountById.js:193-196 already states: two whole statements
// can be read and compared, a template with holes cannot.
const EXPENSE_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM transactions tr
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id IN (1, 6)
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
`;

const INCOME_PAGE_QUERY = `
  SELECT
    tr.*,
    mt.movement_type_name,
    trt.transaction_type_name,
    act.account_type_name,
    cr.currency_code,
    ua.account_name,
    ua.account_type_id,
    (tr.transaction_actual_date AT TIME ZONE $3)::date::text AS transaction_local_date
  FROM transactions tr
  JOIN movement_types mt ON mt.movement_type_id = tr.movement_type_id
  JOIN transaction_types trt ON trt.transaction_type_id = tr.transaction_type_id
  JOIN currencies cr ON cr.currency_id = tr.currency_id
  JOIN user_accounts ua ON ua.account_id = tr.account_id
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id = 2
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC
  LIMIT $4 OFFSET $5
`;

const INCOME_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM transactions tr
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id = 2
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
`;

// R212's exclusion, with the same NULL guard the monthly statement carries:
// description is nullable, and `NULL NOT LIKE ...` is NULL, which a WHERE treats
// as false. Without the guard a real P/L row written without a description would
// be missing from the list while the card still counted it.
const PNL_PAGE_QUERY = `
  SELECT
    tr.*,
    mt.movement_type_name,
    trt.transaction_type_name,
    act.account_type_name,
    cr.currency_code,
    ua.account_name,
    ua.account_type_id,
    (tr.transaction_actual_date AT TIME ZONE $3)::date::text AS transaction_local_date
  FROM transactions tr
  JOIN movement_types mt ON mt.movement_type_id = tr.movement_type_id
  JOIN transaction_types trt ON trt.transaction_type_id = tr.transaction_type_id
  JOIN currencies cr ON cr.currency_id = tr.currency_id
  JOIN user_accounts ua ON ua.account_id = tr.account_id
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id = 9
    AND (tr.description IS NULL OR tr.description NOT LIKE 'RTA Annulment Target(%')
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC
  LIMIT $4 OFFSET $5
`;

const PNL_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM transactions tr
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id = 9
    AND (tr.description IS NULL OR tr.description NOT LIKE 'RTA Annulment Target(%')
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
`;

const DEBT_PAGE_QUERY = `
  SELECT
    tr.*,
    mt.movement_type_name,
    trt.transaction_type_name,
    act.account_type_name,
    cr.currency_code,
    ua.account_name,
    ua.account_type_id,
    (tr.transaction_actual_date AT TIME ZONE $3)::date::text AS transaction_local_date
  FROM transactions tr
  JOIN movement_types mt ON mt.movement_type_id = tr.movement_type_id
  JOIN transaction_types trt ON trt.transaction_type_id = tr.transaction_type_id
  JOIN currencies cr ON cr.currency_id = tr.currency_id
  JOIN user_accounts ua ON ua.account_id = tr.account_id
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id = 4
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC
  LIMIT $4 OFFSET $5
`;

const DEBT_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM transactions tr
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id = 4
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
`;

const POCKET_PAGE_QUERY = `
  SELECT
    tr.*,
    mt.movement_type_name,
    trt.transaction_type_name,
    act.account_type_name,
    cr.currency_code,
    ua.account_name,
    ua.account_type_id,
    (tr.transaction_actual_date AT TIME ZONE $3)::date::text AS transaction_local_date
  FROM transactions tr
  JOIN movement_types mt ON mt.movement_type_id = tr.movement_type_id
  JOIN transaction_types trt ON trt.transaction_type_id = tr.transaction_type_id
  JOIN currencies cr ON cr.currency_id = tr.currency_id
  JOIN user_accounts ua ON ua.account_id = tr.account_id
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id = 5
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC
  LIMIT $4 OFFSET $5
`;

const POCKET_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM transactions tr
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id = 5
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
`;

// Investment lists every movement that touched an investment account, with no
// movement filter at all, and that is the one list in this file whose rows are
// NOT the rows of a figure.
//
// The card of §6 has no transactionCount to reconcile against, so D21 does not
// apply here — there is nothing for the list to agree or disagree with. What the
// list has to agree with is the account statement the user can already open
// elsewhere: hiding a transfer between two investment accounts because no V
// figure counts it would make the same account show two different histories on
// two screens.
const INVESTMENT_PAGE_QUERY = `
  SELECT
    tr.*,
    mt.movement_type_name,
    trt.transaction_type_name,
    act.account_type_name,
    cr.currency_code,
    ua.account_name,
    ua.account_type_id,
    (tr.transaction_actual_date AT TIME ZONE $3)::date::text AS transaction_local_date
  FROM transactions tr
  JOIN movement_types mt ON mt.movement_type_id = tr.movement_type_id
  JOIN transaction_types trt ON trt.transaction_type_id = tr.transaction_type_id
  JOIN currencies cr ON cr.currency_id = tr.currency_id
  JOIN user_accounts ua ON ua.account_id = tr.account_id
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE tr.account_id = ANY($1::int[])
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC
  LIMIT $4 OFFSET $5
`;

const INVESTMENT_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM transactions tr
  WHERE tr.account_id = ANY($1::int[])
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
`;

/**
 * Run a page statement and its count, and read both.
 *
 * Shared across the domains because what it does is the same in all of them: the
 * statements carry the filters, this carries the pagination arithmetic and the
 * row mapping. Three copies of an OFFSET calculation is three places for an
 * off-by-one to live.
 *
 * @param {object} pool - Database pool
 * @param {{page: string, count: string}} statements - one domain's pair
 * @param {number[]} accountIds - the set that selects the leg
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} paging - { page, pageSize, includeRows }, the first two already
 *   validated as positive integers; includeRows defaults to true
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
const readTransactionsPage = async (pool, statements, accountIds, month, timeZone, { page, pageSize, includeRows = true }) => {
 const ids = accountIds ?? [];
 const offset = (page - 1) * pageSize;

 // A caller that wants the count and forbids the rows skips the page statement
 // rather than fetching rows and dropping them, which would obey the return type
 // and not the obligation behind it.
 if (!includeRows) {
  const total = await pool.query(statements.count, [ids, month, timeZone]);
  return { rows: [], totalRows: Number(total.rows[0]?.total_rows ?? 0) };
 }

 // Both statements in flight at once: the count does not depend on the page and
 // the page does not depend on the count, so serialising them would pay for the
 // slower one twice.
 const [rows, total] = await Promise.all([
  pool.query(statements.page, [ids, month, timeZone, pageSize, offset]),
  pool.query(statements.count, [ids, month, timeZone]),
 ]);

 return {
  // The note, split out of the narrative by the side that composes it.
  // description travels untouched beside it: the detail modal shows the
  // sentence in full, and only the rows show the note alone.
  rows: rows.rows.map((row) => ({
   ...row,
   note: extractNoteFromDescription(row.description),
  })),
  totalRows: Number(total.rows[0]?.total_rows ?? 0),
 };
};

/**
 * One page of the expense transactions of a month, plus the size of the whole set.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - category_budget accounts, soft-deleted included (D19)
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} paging - { page, pageSize }, both already validated as positive integers
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getExpenseTransactionsPage(pool, accountIds, month, timeZone, paging) {
 return readTransactionsPage(
  pool,
  { page: EXPENSE_PAGE_QUERY, count: EXPENSE_COUNT_QUERY },
  accountIds,
  month,
  timeZone,
  paging,
 );
}

/**
 * One page of the income transactions of a month, plus the size of the whole set.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's real money accounts, slack excluded
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} paging - { page, pageSize }, both already validated as positive integers
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getIncomeTransactionsPage(pool, accountIds, month, timeZone, paging) {
 return readTransactionsPage(
  pool,
  { page: INCOME_PAGE_QUERY, count: INCOME_COUNT_QUERY },
  accountIds,
  month,
  timeZone,
  paging,
 );
}

/**
 * One page of the realized P/L transactions of a month, plus the whole set's size.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - every account of the user except slack
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} paging - { page, pageSize }, both already validated as positive integers
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getPnlTransactionsPage(pool, accountIds, month, timeZone, paging) {
 return readTransactionsPage(
  pool,
  { page: PNL_PAGE_QUERY, count: PNL_COUNT_QUERY },
  accountIds,
  month,
  timeZone,
  paging,
 );
}

/**
 * One page of the debt movements of a month, plus the size of the whole set.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's debtor accounts
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} paging - { page, pageSize }
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getDebtTransactionsPage(pool, accountIds, month, timeZone, paging) {
 return readTransactionsPage(
  pool,
  { page: DEBT_PAGE_QUERY, count: DEBT_COUNT_QUERY },
  accountIds,
  month,
  timeZone,
  paging,
 );
}

/**
 * One page of the pocket movements of a month, plus the size of the whole set.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's pocket_saving accounts
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} paging - { page, pageSize }
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getPocketTransactionsPage(pool, accountIds, month, timeZone, paging) {
 return readTransactionsPage(
  pool,
  { page: POCKET_PAGE_QUERY, count: POCKET_COUNT_QUERY },
  accountIds,
  month,
  timeZone,
  paging,
 );
}

/**
 * One page of everything that touched an investment account in a month.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's investment accounts
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} paging - { page, pageSize, includeRows }
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getInvestmentTransactionsPage(pool, accountIds, month, timeZone, paging) {
 return readTransactionsPage(
  pool,
  { page: INVESTMENT_PAGE_QUERY, count: INVESTMENT_COUNT_QUERY },
  accountIds,
  month,
  timeZone,
  paging,
 );
}
