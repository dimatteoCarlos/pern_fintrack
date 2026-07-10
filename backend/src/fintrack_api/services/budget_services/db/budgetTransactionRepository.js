// src/fintrack_api/services/budget_services/db/budgetTransactionRepository.js

// Database operations for transactions used in budget calculations.
// All functions receive a PostgreSQL connection pool as first argument.
// Reverse Expense logic: movement_type_id = 1 (expense) has positive amount for category_budget,
// movement_type_id = 6 (transfer from category_budget) has negative amount.
// The SUM with CASE handles the sign correctly.
// No join to user_accounts is needed because only filter by account_id.

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
  return parseFloat(result.rows[0].actual_spent) || 0;
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
    amount: parseFloat(row.amount) || 0,
  }));
}

/**
 * Optimized query for multiple accounts (used by getMultiSummary).
 * Returns all necessary data in a single query.
 * Includes currency_id for in-memory catalog lookup.
 */
export async function getBudgetDataForAccounts(pool, accountIds, startDate, endDate) {
  if (!accountIds || accountIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      p.account_id,
      p.budget_policy_id,
      a.budget_allocation_id,
      a.budget_amount,
      a.budget_frequency_type_id,
      a.valid_from,
      a.valid_until,
      COALESCE(SUM(
        CASE
          WHEN t.movement_type_id = 1 THEN t.amount
          WHEN t.movement_type_id = 6 THEN t.amount
          ELSE 0
        END
      ), 0) AS actual_spent,
      cba.currency_id
    FROM budget_policies p
    JOIN budget_policy_allocations a ON p.budget_policy_id = a.budget_policy_id
    JOIN category_budget_accounts cba ON p.account_id = cba.account_id
    LEFT JOIN transactions t ON t.account_id = p.account_id
      AND t.transaction_actual_date >= $2
      AND t.transaction_actual_date < $3
      AND t.movement_type_id IN (1, 6)
    WHERE p.account_id = ANY($1)
      AND a.valid_until IS NULL
    GROUP BY
      p.account_id,
      p.budget_policy_id,
      a.budget_allocation_id,
      a.budget_amount,
      a.budget_frequency_type_id,
      a.valid_from,
      a.valid_until,
      cba.currency_id
  `;
  const result = await pool.query(query, [accountIds, startDate, endDate]);
  return result.rows.map(row => ({
    accountId: row.account_id,
    budgetPolicyId: row.budget_policy_id,
    budgetAllocationId: row.budget_allocation_id,
    budgetAmount: parseFloat(row.budget_amount) || 0,
    budgetFrequencyTypeId: row.budget_frequency_type_id,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    actualSpent: parseFloat(row.actual_spent) || 0,
    currencyId: row.currency_id,
  }));
}