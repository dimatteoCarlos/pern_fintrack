// backend/src/export_api/db/transactionDatasetRepository.js
//
// The `transactions` dataset (PLAN_EXPORT.md §4): one row per `transactions`
// record, for GET /api/export/movements. Built on the same row shape and the
// same activity predicate the Overview activity list already uses
// (architecture rule 2: Data Export reads through the filters moved to a
// neutral module in commit 1, and calls no Overview calculator).
//
// Two columns this dataset needs that the activity list does not: the
// counterparty's name for a transfer (source/destination), and the FX audit
// columns. Both are added here rather than in transactionRowShape.js, which
// stays the shape every activity-list statement shares.

import { extractNoteFromDescription } from '../../utils/fintrackUtils/transactionManagement/extractNoteFromDescription.js';
import { transactionRowColumns, TRANSACTION_ROW_SOURCE } from '../../utils/fintrackUtils/transactionManagement/transactionRowShape.js';
import {
 ACTIVITY_FILTER,
 ACTIVITY_READER_FILTER,
 ACTIVITY_ORDER,
} from '../../utils/fintrackUtils/transactionManagement/activityFilters.js';

// Above this, a request answers 422 asking the caller to narrow the period
// (PLAN_EXPORT.md §8). Not streamed: Vercel keeps no cursor-backed connection,
// and this many rows in memory sits far under a function's memory limit.
export const EXPORT_ROW_LIMIT = 10000;

// Reused verbatim from ACTIVITY_FILTER's own WHERE, over account_registry
// instead of transactions: the export's owned-accounts set must be exactly
// the set activity's predicate already allows, or a caller could export a
// movement through an accountId activity itself would never return.
const OWNED_ACCOUNT_IDS_QUERY = `
  SELECT ar.account_id
  FROM account_registry ar
  LEFT JOIN user_accounts ua ON ua.account_id = ar.account_id
  ${ACTIVITY_FILTER}`;

/**
 * Every account id the user owns, open or closed, slack excluded — the same
 * universe ACTIVITY_FILTER already scopes the activity list to.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @returns {Promise<number[]>}
 */
export async function getOwnedAccountIds(pool, userId) {
 const { rows } = await pool.query(OWNED_ACCOUNT_IDS_QUERY, [userId]);
 return rows.map((row) => row.account_id);
}

// category_budget accounts only, open only: category_budget_accounts.account_id
// references user_accounts(account_id), and CLOSE deletes that row, so a
// closed category account has no category_name left to join through. A known
// V1 limit, not a defect — the category filter is scoped the same way the
// budget screen itself scopes a category, to accounts still open.
const CATEGORY_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  JOIN category_budget_accounts cba ON cba.account_id = ua.account_id
  WHERE ua.user_id = $1
    AND act.account_type_name = 'category_budget'
    AND ua.deleted_at IS NULL
    AND ua.closed_at IS NULL
    AND lower(cba.category_name) = lower($2)`;

/**
 * The account ids one expense category holds, for the caller's own accounts.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {string} categoryName - trimmed by the schema
 * @returns {Promise<number[]>} empty when the category does not exist or has
 *  no open accounts; the caller decides whether that is a 404
 */
export async function getCategoryAccountIds(pool, userId, categoryName) {
 const { rows } = await pool.query(CATEGORY_ACCOUNT_IDS_QUERY, [userId, categoryName]);
 return rows.map((row) => row.account_id);
}

// $1 userId, $2 from, $3 to, $4 timeZone, $5 search, $6 movementType,
// $7 accountIds (int[] or null), $8 limit. $1, $5 and $6 are the placeholders
// ACTIVITY_FILTER and ACTIVITY_READER_FILTER already hardcode; $2-$4 and $7-$8
// are this statement's own, in the same slots ACTIVITY_PAGE_QUERY uses for the
// ones it shares (overviewPageRepository.js).
const TRANSACTIONS_DATASET_QUERY = `
  SELECT${transactionRowColumns('$4')}
    , COALESCE(arsrc.account_name, '') AS source_account_name
    , COALESCE(ardst.account_name, '') AS destination_account_name
    , tr.original_amount
    , ocr.currency_code AS original_currency_code
    , tr.exchange_rate
    , tr.exchange_rate_source
    , tr.exchange_rate_timestamp
  ${TRANSACTION_ROW_SOURCE}
  -- Scoped to ar.user_id = $1: another user's account id resolves to an empty
  -- cell, never their name (PLAN_EXPORT.md §4, §15.9).
  LEFT JOIN account_registry arsrc ON arsrc.account_id = tr.source_account_id AND arsrc.user_id = $1
  LEFT JOIN account_registry ardst ON ardst.account_id = tr.destination_account_id AND ardst.user_id = $1
  LEFT JOIN currencies ocr ON ocr.currency_id = tr.original_currency_id
  ${ACTIVITY_FILTER}
    AND ($2::date IS NULL OR tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $4))
    AND ($3::date IS NULL OR tr.transaction_actual_date < (($3::date + INTERVAL '1 month') AT TIME ZONE $4))
    AND ($7::int[] IS NULL OR tr.account_id = ANY($7::int[]))
  ${ACTIVITY_READER_FILTER}
  ${ACTIVITY_ORDER}
  LIMIT $8
`;

/**
 * The `transactions` dataset for one export request, at most `limit` rows.
 *
 * No OFFSET and no count statement: an export is not paginated, it is capped.
 * The caller passes EXPORT_ROW_LIMIT + 1 as limit and treats a row at that
 * position as "narrow the period", never delivering it.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {{from: (string|null), to: (string|null), search: (string|null),
 *  movementType: (string|null), accountIds: (number[]|null)}} filters
 * @param {string} timeZone - IANA zone of the account owner
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function getTransactionsDataset(
 pool,
 userId,
 { from, to, search, movementType, accountIds },
 timeZone = 'UTC',
 limit,
) {
 const { rows } = await pool.query(TRANSACTIONS_DATASET_QUERY, [
  userId,
  from ?? null,
  to ?? null,
  timeZone,
  search ?? null,
  movementType ?? null,
  accountIds ?? null,
  limit,
 ]);

 return rows.map((row) => ({
  ...row,
  note: extractNoteFromDescription(row.description),
 }));
}
