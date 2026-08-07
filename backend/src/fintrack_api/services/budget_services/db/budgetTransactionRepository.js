// src/fintrack_api/services/budget_services/db/budgetTransactionRepository.js

// Database operations for transactions used in budget calculations.
// All functions receive a PostgreSQL connection pool as first argument.
// Reverse Expense logic: movement_type_id = 1 (expense) has positive amount for category_budget,
// movement_type_id = 6 (transfer from category_budget) has negative amount.
// The SUM with CASE handles the sign correctly.
// No join to user_accounts is needed because only filter by account_id.
//
// Amounts are parsed from the NUMERIC string pg returns, never through
// parseFloat first: that would degrade the value to a float before the exact
// arithmetic begins. The public shape stays number.

import { toAmount } from '../core/money.js';

/**
 * Get total net spent for a single account in a period.
 * One single query, no individual transaction fetching.
 * Returns 0 if no transactions found.
 */
export async function getTotalSpentByAccountAndPeriod(pool, accountId, startDate, endDate) {
  const query = `
    SELECT
      COALESCE(SUM(
        CASE
          WHEN movement_type_id = 1 THEN amount
          WHEN movement_type_id = 6 THEN amount
          ELSE 0
        END
      ), 0) AS actual_spent
    FROM transactions
    WHERE account_id = $1
      AND transaction_actual_date >= $2
      AND transaction_actual_date < $3
      AND movement_type_id IN (1, 6)
  `;
  const result = await pool.query(query, [accountId, startDate, endDate]);
  return toAmount(result.rows[0].actual_spent ?? 0);
}

/**
 * Get individual transactions for a single account in a period.
 * Used for debugging, detailed lists, or future features.
 * Returns an array of { date, amount }.
 */
export async function getTransactionsByAccountAndPeriod(pool, accountId, startDate, endDate) {
  const query = `
    SELECT
      transaction_actual_date AS date,
      amount
    FROM transactions
    WHERE account_id = $1
      AND transaction_actual_date >= $2
      AND transaction_actual_date < $3
      AND movement_type_id IN (1, 6)
    ORDER BY transaction_actual_date ASC
  `;
  const result = await pool.query(query, [accountId, startDate, endDate]);
  return result.rows.map(row => ({
    date: row.date,
    amount: toAmount(row.amount ?? 0),
  }));
}

// Policy and currency, one row per REQUESTED account.
//
// The join to budget_policies is LEFT on purpose. Driving the query from the
// policy table meant an account without one simply vanished from the response,
// and the caller could not tell "this category has no budget" from "the backend
// dropped it". budget_policy_id comes back NULL and the service reports the
// account as unbudgeted.
//
// currency_id is COALESCEd across both account tables. It is duplicated:
// user_accounts.currency_id is NOT NULL and is what the account creation path
// actually writes, while category_budget_accounts.currency_id is populated
// since db771a4 and backfilled by migration 011. COALESCE still honours a
// budget currency that deliberately differs from the account's.
//
// The join to category_budget_accounts stays INNER: it is what makes this a
// budget account at all. An id that survives the caller's ownership check but
// has no row there is a data inconsistency, not an unbudgeted account.
const ACCOUNTS_QUERY = `
  SELECT
    ua.account_id,
    p.budget_policy_id,
    COALESCE(cba.currency_id, ua.currency_id) AS currency_id
  FROM user_accounts ua
  JOIN category_budget_accounts cba ON cba.account_id = ua.account_id
  LEFT JOIN budget_policies p ON p.account_id = ua.account_id
  WHERE ua.account_id = ANY($1)
`;

// Every allocation whose validity OVERLAPS the requested window, not just the
// one that is active today.
//
// [valid_from, valid_until) and [startDate, endDate) are both half-open, so the
// overlap test is the standard pair of strict comparisons. Filtering by
// `valid_until IS NULL` instead — the previous behaviour — answered a different
// question: it priced a historical window with today's budget, so a window
// preceding the last edit reported figures that were never in force.
//
// budget_frequency_code is joined rather than derived from the id: the id is
// meaningless to the caller, and the code is the key into MONTHS_PER_PERIOD.
// The join is inner because budget_frequency_type_id is NOT NULL with an
// ON DELETE RESTRICT foreign key, so a row without a frequency cannot exist.
const ALLOCATIONS_QUERY = `
  SELECT
    p.account_id,
    a.budget_allocation_id,
    a.budget_policy_id,
    a.budget_amount,
    a.budget_frequency_type_id,
    bft.budget_frequency_code,
    a.valid_from,
    a.valid_until
  FROM budget_policies p
  JOIN budget_policy_allocations a ON a.budget_policy_id = p.budget_policy_id
  JOIN budget_frequency_types bft
    ON bft.budget_frequency_type_id = a.budget_frequency_type_id
  WHERE p.account_id = ANY($1)
    AND a.valid_from < $3
    AND (a.valid_until IS NULL OR a.valid_until > $2)
  ORDER BY p.account_id ASC, a.valid_from ASC
`;

// The budget frequency in force at one instant, one row per account that has one.
//
// A point query, not a window query, and it has to be: this is what resolves the
// window, so asking for it over a range would be circular.
//
// [valid_from, valid_until) is half-open, so the instant test is the same pair of
// comparisons the window test uses, collapsed onto a single date.
//
// DISTINCT ON is defensive rather than necessary. uq_budget_allocation_active
// forbids two open versions and the closed ones do not overlap, so at most one
// row can match. It costs nothing here and makes a duplicate impossible to
// propagate rather than merely unlikely.
const POLICY_FREQUENCY_QUERY = `
  SELECT DISTINCT ON (p.account_id)
    p.account_id,
    bft.budget_frequency_code
  FROM budget_policies p
  JOIN budget_policy_allocations a ON a.budget_policy_id = p.budget_policy_id
  JOIN budget_frequency_types bft
    ON bft.budget_frequency_type_id = a.budget_frequency_type_id
  WHERE p.account_id = ANY($1)
    AND a.valid_from <= $2
    AND (a.valid_until IS NULL OR a.valid_until > $2)
  ORDER BY p.account_id ASC, a.valid_from DESC
`;

// Spending is aggregated on its own instead of being LEFT JOINed onto the
// allocations. Joined, an account with N overlapping allocations produced N
// rows each carrying the FULL period spend, and any sum over those rows
// multiplied the real spending by N. Keeping the aggregate separate makes the
// fan-out impossible rather than merely avoided.
const SPENT_QUERY = `
  SELECT
    t.account_id,
    COALESCE(SUM(
      CASE
        WHEN t.movement_type_id = 1 THEN t.amount
        WHEN t.movement_type_id = 6 THEN t.amount
        ELSE 0
      END
    ), 0) AS actual_spent
  FROM transactions t
  WHERE t.account_id = ANY($1)
    AND t.transaction_actual_date >= $2
    AND t.transaction_actual_date < $3
    AND t.movement_type_id IN (1, 6)
  GROUP BY t.account_id
`;

/**
 * The budget frequency in force for each account at a given instant.
 *
 * Returns a Map keyed by accountId holding only the accounts that have an
 * allocation covering referenceDate. An account with no policy, or one whose
 * versions all sit on the other side of that date, is simply absent: there is no
 * frequency to report, and defaulting one here would hide the difference from
 * the caller, which is the only place that knows what to do about it.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - Accounts to read
 * @param {Date} referenceDate - Instant the allocation must be in force at
 * @returns {Promise<Map<number, string>>} accountId to budget_frequency_code
 */
export async function getPolicyFrequenciesForAccounts(pool, accountIds, referenceDate) {
 if (!accountIds || accountIds.length === 0) {
  return new Map();
 }

 const result = await pool.query(POLICY_FREQUENCY_QUERY, [accountIds, referenceDate]);
 return new Map(result.rows.map((row) => [row.account_id, row.budget_frequency_code]));
}

/**
 * Budget data for a set of accounts over a window.
 *
 * Returns ONE entry per requested account, budgeted or not, carrying every
 * allocation that was in force at any point inside the window. The caller
 * prices each allocation over the slice of the window it actually covers;
 * picking a single allocation here would force that decision into the
 * repository, where the window semantics are not known.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - Accounts to read
 * @param {Date} startDate - Window start (inclusive, UTC)
 * @param {Date} endDate - Window end (exclusive, UTC)
 * @returns {Promise<Array<object>>} one entry per requested account
 */
export async function getBudgetDataForAccounts(pool, accountIds, startDate, endDate) {
  if (!accountIds || accountIds.length === 0) {
    return [];
  }

  const params = [accountIds, startDate, endDate];
  const [accounts, allocations, spent] = await Promise.all([
    pool.query(ACCOUNTS_QUERY, [accountIds]),
    pool.query(ALLOCATIONS_QUERY, params),
    pool.query(SPENT_QUERY, params),
  ]);

  const spentByAccount = new Map(
    spent.rows.map((row) => [row.account_id, toAmount(row.actual_spent ?? 0)]),
  );

  const allocationsByAccount = new Map();
  for (const row of allocations.rows) {
    const list = allocationsByAccount.get(row.account_id) ?? [];
    list.push({
      budgetAllocationId: row.budget_allocation_id,
      budgetPolicyId: row.budget_policy_id,
      budgetAmount: toAmount(row.budget_amount),
      budgetFrequencyTypeId: row.budget_frequency_type_id,
      budgetFrequencyCode: row.budget_frequency_code,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
    });
    allocationsByAccount.set(row.account_id, list);
  }

  return accounts.rows.map((row) => ({
    accountId: row.account_id,
    budgetPolicyId: row.budget_policy_id,
    currencyId: row.currency_id,
    actualSpent: spentByAccount.get(row.account_id) ?? 0,
    allocations: allocationsByAccount.get(row.account_id) ?? [],
  }));
}
