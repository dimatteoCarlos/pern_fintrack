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

import { extractNoteFromDescription } from '../../../../utils/fintrackUtils/transactionManagement/extractNoteFromDescription.js';

// The page, newest first.
//
// The same filter as MONTHLY_EXPENSE_QUERY: movement types 1 and 6 over the
// category legs. A list that showed rows the card did not count — or counted
// rows it did not show — is the disagreement §4.2 forbids, arriving through the
// list instead of through a figure.
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
const TRANSACTIONS_PAGE_QUERY = `
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
// Its WHERE clause must stay identical to the one above. Kept as two readable
// statements instead of one template with holes, for the reason
// getTransactionsForAccountById.js:193-196 already states: two whole statements
// can be read and compared, a template with holes cannot.
const TRANSACTIONS_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM transactions tr
  WHERE tr.account_id = ANY($1::int[])
    AND tr.movement_type_id IN (1, 6)
    AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND tr.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
`;

/**
 * One page of the expense transactions of a month, plus the size of the whole set.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - category_budget accounts, soft-deleted included (D19)
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} page - { page, pageSize }, both already validated as positive integers
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getExpenseTransactionsPage(pool, accountIds, month, timeZone, { page, pageSize }) {
 const ids = accountIds ?? [];
 const offset = (page - 1) * pageSize;

 // Both statements in flight at once: the count does not depend on the page and
 // the page does not depend on the count, so serialising them would pay for the
 // slower one twice.
 const [rows, total] = await Promise.all([
  pool.query(TRANSACTIONS_PAGE_QUERY, [ids, month, timeZone, pageSize, offset]),
  pool.query(TRANSACTIONS_COUNT_QUERY, [ids, month, timeZone]),
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
}
