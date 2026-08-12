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

// The month the report is about, and the one after it, both on the account
// owner's calendar and both as text.
//
// Resolved in SQL and never rebuilt in JS. A DATE crossing the driver becomes a
// Date at the node process's local midnight, and serializing that back into a
// ::date cast can land on the neighbouring day — the same class of error §4.5
// describes, arriving through the driver instead of through a query. Text has
// no zone to lose.
//
// next_month is returned rather than derived so both values come from one
// evaluation of CURRENT_TIMESTAMP. Two calls could straddle midnight on the last
// day of a month and report a budget for one month against the spending of
// another.
const MONTH_QUERY = `
  SELECT
    date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE $1)::date::text AS month,
    (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE $1)
      + INTERVAL '1 month')::date::text AS next_month
`;

// Account identity and currency, one row per REQUESTED account.
//
// No join to any budget table. Whether an account is budgeted is the existence
// of an allocation in force (§1.9), which ALLOCATION_QUERY answers; asking it
// here as well would give the service two sources for one fact.
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
//
// subcategory comes from that same join. It has been in the table since the
// schema was written; the export read it off budgetPolicy, which never carried
// it, and shipped the column empty on every file so far.
const ACCOUNTS_QUERY = `
  SELECT
    ua.account_id,
    ua.account_name,
    cba.subcategory,
    COALESCE(cba.currency_id, ua.currency_id) AS currency_id
  FROM user_accounts ua
  JOIN category_budget_accounts cba ON cba.account_id = ua.account_id
  WHERE ua.account_id = ANY($1)
`;

// The allocation in force at one month, for N accounts, in one pass (§4.2).
//
// The whole of recurrence is `<= $2 ORDER BY budget_month DESC LIMIT 1`: a row
// rules from its month until a later row replaces it, so the last row at or
// before the month asked for IS the budget (§3.3). DISTINCT ON applies the LIMIT
// per account.
//
// An account with no row at or before the month is absent from the result, not
// zero. Absence is what "never budgeted" means, and a stored 0 is a decision the
// user took (§3.5) — collapsing them here would erase the distinction before the
// service can report it.
const ALLOCATION_QUERY = `
  SELECT DISTINCT ON (account_id)
    account_id,
    budget_amount
  FROM budget_monthly_allocations
  WHERE account_id = ANY($1)
    AND budget_month <= $2
  ORDER BY account_id, budget_month DESC
`;

// Spending is aggregated on its own instead of being LEFT JOINed onto the
// allocations. Joined, an account with N allocation rows produced N rows each
// carrying the FULL period spend, and any sum over those rows multiplied the
// real spending by N. Keeping the aggregate separate makes the fan-out
// impossible rather than merely avoided.
//
// R42, §4.5: the bounds are LOCAL month boundaries and the column is
// TIMESTAMPTZ, so each bound is converted to the instant it names on the OWNER's
// calendar. Compared bare, Postgres resolves them through the SESSION zone,
// and a purchase at 8pm on 31 August in America/Bogota counts against September
// while the budget it is compared to is August's. Both sides of the comparison
// have to live on the same calendar (§1.10).
//
// This is the local-date-to-instant direction: exactly one AT TIME ZONE. The
// opposite direction — an instant to the month it falls in — is what MONTH_QUERY
// does. Two conversions in either direction is the error.
//
// ::timestamp, not ::date, and it is load-bearing. AT TIME ZONE has two forms,
// and with a date Postgres resolves to the one taking a TIMESTAMPTZ, because
// that is the preferred type of the category. The bound is then read as an
// instant in the SESSION zone and converted OUT to local time — the opposite
// direction — so '2026-08-01' AT TIME ZONE 'America/Bogota' yields
// 2026-07-31 19:00 instead of 2026-08-01 05:00+00. Measured: the month shifted
// five hours the wrong way and every boundary transaction landed in the
// neighbouring month, which is R42 again through a different door. Casting to
// TIMESTAMP first picks the form that takes a naive local time and returns the
// instant it names.
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
    AND t.transaction_actual_date >= ($2::timestamp AT TIME ZONE $4)
    AND t.transaction_actual_date <  ($3::timestamp AT TIME ZONE $4)
    AND t.movement_type_id IN (1, 6)
  GROUP BY t.account_id
`;

/**
 * The budget of a set of accounts for the current month.
 *
 * Returns ONE entry per requested account, budgeted or not: an account the
 * caller asked about and did not get back is indistinguishable from one the
 * backend dropped, and the screen has to be able to say "this category has no
 * budget" (§3.5).
 *
 * budgetAmount is always a number, 0 when no allocation is in force. Whether one
 * exists is isBudgeted, read off the presence of the row and never off the
 * magnitude (§1.9): a stored 0 and an absent row are the same arithmetic and
 * two different sentences on screen.
 *
 * nextMonthBudget is the same resolution one month later. It is what tells the
 * card that this month is an exception, and comparing the two amounts is
 * deliberate: a terminator repeating the current amount changes nothing anyone
 * would recognise and correctly shows nothing (§7.4).
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - Accounts to read
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<object>} { month, accounts: [...] }
 */
export async function getMonthlyStatusForAccounts(pool, accountIds, timeZone = 'UTC') {
 const { rows: monthRows } = await pool.query(MONTH_QUERY, [timeZone]);
 const { month, next_month: nextMonth } = monthRows[0];

 if (!accountIds || accountIds.length === 0) {
  return { month, accounts: [] };
 }

 const [accounts, current, next, spent] = await Promise.all([
  pool.query(ACCOUNTS_QUERY, [accountIds]),
  pool.query(ALLOCATION_QUERY, [accountIds, month]),
  pool.query(ALLOCATION_QUERY, [accountIds, nextMonth]),
  pool.query(SPENT_QUERY, [accountIds, month, nextMonth, timeZone]),
 ]);

 const amountsByAccount = (result) =>
  new Map(result.rows.map((row) => [row.account_id, toAmount(row.budget_amount)]));

 const currentByAccount = amountsByAccount(current);
 const nextByAccount = amountsByAccount(next);
 const spentByAccount = new Map(
  spent.rows.map((row) => [row.account_id, toAmount(row.actual_spent ?? 0)]),
 );

 return {
  month,
  accounts: accounts.rows.map((row) => ({
   accountId: row.account_id,
   accountName: row.account_name,
   subcategory: row.subcategory ?? null,
   currencyId: row.currency_id,
   // Existence and magnitude are reported separately. The amount falls back to
   // 0 so nothing downstream branches on a null, and isBudgeted keeps the
   // distinction the amount can no longer carry: a stored 0 is a decision, an
   // absent row is not.
   isBudgeted: currentByAccount.has(row.account_id),
   budgetAmount: currentByAccount.get(row.account_id) ?? 0,
   nextMonthBudget: nextByAccount.get(row.account_id) ?? 0,
   // 0 is right for spending too: no matching transaction means none was made.
   actualSpent: spentByAccount.get(row.account_id) ?? 0,
  })),
 };
}
