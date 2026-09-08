// src/fintrack_api/services/overview_services/db/overviewPocketRepository.js

// The three reads Overview needs over the pocket PLAN model, which the board
// service does not already answer.
//
// A pocket is no longer an account that holds money (020_create_pocket_tables.sql).
// It is a plan, and pocket_allocations is the append-only ledger of what each
// real account has committed to it. Nothing here reads user_accounts.account_balance
// and nothing here reads transactions: no allocation ever moved money, so a
// pocket has no transactions to sum.
//
// The card's own figures are NOT here. Those come from pocketBoardService, which
// already computes them for the board screen, and asking it is what makes the
// two screens agree by construction instead of by review — the same treatment
// the saving goals get (§9: reuse, never recompute).
//
// What genuinely is left over is temporal. The board answers one month; Overview
// draws six of them for the trend and thirteen for the monthly snapshot, and it
// lists the month's decisions. Three questions the board is not asked.
//
// Every bound below is copied from the board's own statement
// (pocketRepository.js:97-118) rather than written afresh:
//
//  - the ledger bound is on allocation_actual_date, the day the decision was
//    taken, never on created_at, the day the row was typed;
//  - the population bound is on pockets.created_at, so a pocket planned in
//    September is absent from a month read at the close of August;
//  - both convert a local month boundary into an instant once, casting to
//    ::timestamp and never to ::date. With a date, Postgres picks the overload
//    taking an instant and the window shifts by the zone offset the wrong way
//    (measured at budgetTransactionRepository.js:177-186).
//
// Copied and not shared because the board reads one month and these read a
// range: the shapes differ, the predicate does not, and it is stated here in
// full so a later edit to one is visible against the other.

import { toAmount } from '../../budget_services/core/money.js';

// The committed total at the close of each month of a range — a POSITION.
//
// Cumulative and never per-month: every row is the whole ledger up to that
// month's close, so the last point of the series IS the board's totalAllocated
// for the reference month, under the same two bounds. That is what §4.2 asks for
// everywhere in this module — the card's figure and the chart's last bar are one
// read, not two that agree.
//
// A month with no pocket at all reports 0 rather than disappearing, because the
// series is generated from the calendar and the ledger is joined onto it. The
// card decides what a zero means; the series only states it.
const MONTHLY_ALLOCATED_QUERY = `
  SELECT
    m.month::date::text AS month,
    COALESCE(SUM(pa.amount), 0) AS total_amount
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  LEFT JOIN pockets p
    ON p.user_id = $1
   AND p.created_at < ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  LEFT JOIN pocket_allocations pa
    ON pa.pocket_id = p.pocket_id
   AND pa.allocation_actual_date < ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month
  ORDER BY m.month
`;

// What was committed inside each month of a range — a FLOW.
//
// This is the other half of D28, and the reason it is a second statement rather
// than a diff of the one above: the monthly snapshot compares its entry against a
// twelve-month average, and averaging a series of balances would subtract a mean
// of movements from a stock. All four entries of that widget have to be the same
// kind of quantity.
//
// It is the same figure the board publishes as totalMovedInMonth, under the same
// population bound, so the snapshot's row for a month and the board read at that
// month cannot disagree.
//
// The net is signed and stays signed: a release is a negative row, and a month in
// which more was released than committed moved backwards. The count is what makes
// an active month decidable — a month whose commitment and release cancel nets to
// 0 and is still a month in which the owner decided twice.
const MONTHLY_ALLOCATED_NET_QUERY = `
  SELECT
    m.month::date::text AS month,
    COALESCE(SUM(pa.amount), 0) AS total_amount,
    COUNT(pa.allocation_id) AS transaction_count
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  LEFT JOIN pockets p
    ON p.user_id = $1
   AND p.created_at < ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  LEFT JOIN pocket_allocations pa
    ON pa.pocket_id = p.pocket_id
   AND pa.allocation_actual_date >= (m.month AT TIME ZONE $4)
   AND pa.allocation_actual_date <  ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month
  ORDER BY m.month
`;

// The month's decisions, newest first.
//
// The row names its pocket and its source account, because a list of amounts with
// no subject answers nothing: the whole content of an allocation is which goal it
// was committed to and which account it was committed from.
//
// currency comes off the pocket and not off the allocation. Every figure in this
// database is kept in the one accounting currency (D7); the allocation's six
// origin columns are the audit trail of what the owner typed, and publishing one
// of them here would invite a consumer to add two units.
// The one month filter both statements read. Duplicated text is how a page and
// its count come to disagree about which rows exist, and the two are issued
// together to answer one request, so the filter is declared once. The
// placeholders are the same three in both: the owner, the month, the zone.
const ALLOCATIONS_FILTER = `
  WHERE pa.user_id = $1
    AND pa.allocation_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND pa.allocation_actual_date <  (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)`;

const ALLOCATIONS_PAGE_QUERY = `
  SELECT
    pa.allocation_id::text  AS "allocationId",
    pa.pocket_id            AS "pocketId",
    p.name                  AS "pocketName",
    pa.amount::text         AS amount,
    to_char(pa.allocation_actual_date AT TIME ZONE $3, 'YYYY-MM-DD') AS "allocationDate",
    pa.source_account_id    AS "sourceAccountId",
    ua.account_name         AS "sourceAccountName",
    lower(cr.currency_code) AS currency
  FROM pocket_allocations pa
  JOIN pockets p ON p.pocket_id = pa.pocket_id
  -- LEFT, and it is the only one of the three that is. This join supplies a
  -- label and not a row: the allocation's amount, date, pocket and source
  -- account id are all on pa, so an account whose row is gone costs the name
  -- and nothing else. Inner, it dropped the whole allocation from this page
  -- while the count beside it still counted the row, and a paginator offered a
  -- page that came back short.
  --
  -- The other two joins cannot lose a row and stay inner: an allocation cannot
  -- outlive its pocket, and currencies is a catalog nothing deletes from.
  LEFT JOIN user_accounts ua ON ua.account_id = pa.source_account_id
  JOIN currencies cr ON cr.currency_id = p.currency_id
  ${ALLOCATIONS_FILTER}
  ORDER BY pa.allocation_actual_date DESC, pa.allocation_id DESC
  LIMIT $4 OFFSET $5
`;

const ALLOCATIONS_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM pocket_allocations pa
  ${ALLOCATIONS_FILTER}
`;

/**
 * The committed total at the close of every month of a closed range.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number}>>} ascending, no gaps
 */
export async function getMonthlyAllocated(pool, userId, from, to, timeZone = 'UTC') {
 const { rows } = await pool.query(MONTHLY_ALLOCATED_QUERY, [userId, from, to, timeZone]);

 return rows.map((row) => ({
  month: row.month,
  totalAmount: toAmount(row.total_amount ?? 0),
 }));
}

/**
 * The net committed inside every month of a closed range, and how many decisions
 * produced it.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
export async function getMonthlyAllocatedNet(pool, userId, from, to, timeZone = 'UTC') {
 const { rows } = await pool.query(MONTHLY_ALLOCATED_NET_QUERY, [userId, from, to, timeZone]);

 return rows.map((row) => ({
  month: row.month,
  totalAmount: toAmount(row.total_amount ?? 0),
  // COUNT comes back as a string from the driver on bigint columns; Number is
  // exact here because a month's allocation count cannot leave the safe range.
  transactionCount: Number(row.transaction_count ?? 0),
 }));
}

/**
 * One page of the allocations of a month, plus the size of the whole set.
 *
 * includeRows false skips the page statement entirely rather than fetching rows
 * and dropping them, which is how §11's obligation is honoured: GET /overview
 * needs the count and forbids the rows.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {string} month - the month to list, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} paging - { page, pageSize, includeRows }
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getAllocationsPage(
 pool,
 userId,
 month,
 timeZone,
 { page, pageSize, includeRows = true },
) {
 if (!includeRows) {
  const total = await pool.query(ALLOCATIONS_COUNT_QUERY, [userId, month, timeZone]);
  return { rows: [], totalRows: Number(total.rows[0]?.total_rows ?? 0) };
 }

 const offset = (page - 1) * pageSize;

 // Both statements in flight at once: the count does not depend on the page and
 // the page does not depend on the count.
 const [rows, total] = await Promise.all([
  pool.query(ALLOCATIONS_PAGE_QUERY, [userId, month, timeZone, pageSize, offset]),
  pool.query(ALLOCATIONS_COUNT_QUERY, [userId, month, timeZone]),
 ]);

 return {
  rows: rows.rows.map((row) => ({
   ...row,
   amount: toAmount(row.amount),
   // Declared rather than left to the driver. The source account's join is
   // LEFT, so this is the one field of the row that can be absent, and a
   // consumer reading it has to branch on null instead of on a missing key.
   // sourceAccountId is still there, so the row stays identifiable.
   sourceAccountName: row.sourceAccountName ?? null,
  })),
  totalRows: Number(total.rows[0]?.total_rows ?? 0),
 };
}
