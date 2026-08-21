// src/fintrack_api/services/overview_services/db/overviewBalanceRepository.js

// The month-by-month balance of a set of accounts — the stock equivalent of
// what overviewMonthlyRepository does for a flow.
//
// Debt and Pocket are not flow domains. Their headline figure is a balance
// (D1, P1), not a sum of a period's rows, so their delta cannot be one total
// minus another the way E3 and I3 are. It is the same balance read at two
// moments, which means the module needs a balance AS OF a past date.
//
// There is no balance history table in the schema — verified by reading every
// migration, not assumed — so a past balance is reconstructed: today's balance
// minus everything that happened after the date in question. `amount` is signed
// per leg, so the subtraction is direct and needs no CASE.
//
// Reconstructing rather than reading transactions.account_balance_after_tr is a
// deliberate choice. That column is the balance the ledger recorded at write
// time, and if it ever drifted from user_accounts.account_balance the series
// would end somewhere other than the figure the card publishes. Walking back
// from the current balance cannot drift: the last point of the series IS the
// card's total, by construction, which is what §4.2 asks for.

import { toAmount } from '../../budget_services/core/money.js';

// One row per calendar month in the window, each carrying the balance as it
// stood at the END of that month.
//
// generate_series is on the LEFT for D18's reason, restated for a stock: a month
// with no activity is not a gap and not a zero — it is the balance carried
// unchanged. Dropping the row would bend the line between its neighbours, which
// is the same falsehood D18 forbids for a flow.
//
// The bound is the END of the month, so the last row of the window — the
// reference month, whose end may still be in the future — subtracts nothing and
// equals the account set's balance right now. That is not a coincidence to
// preserve by hand; it is why the query is written from the current balance
// backwards.
//
// R42, §4.5: one AT TIME ZONE per operand, opposite directions. The month
// boundary goes local -> instant to meet a TIMESTAMPTZ column.
const MONTHLY_BALANCE_QUERY = `
  SELECT
    m.month::date::text AS month,
    b.current_balance - COALESCE(SUM(t.amount), 0) AS total_amount
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  CROSS JOIN (
    SELECT COALESCE(SUM(ua.account_balance), 0) AS current_balance
    FROM user_accounts ua
    WHERE ua.account_id = ANY($1::int[])
  ) b
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])
   AND t.transaction_actual_date >= ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month, b.current_balance
  ORDER BY m.month
`;

/**
 * The balance of a set of accounts at the end of each month of a window.
 *
 * Returns one entry per calendar month between `from` and `to` inclusive, with
 * no gaps. The shape matches what the flow repository returns, so the same
 * makeTrendSeries and the same makePeriodDelta read both without knowing which
 * kind of figure they hold.
 *
 * An empty accountIds returns the full month list at zero. A user with no
 * accounts of this kind has a balance of 0, which is a real answer; an empty
 * array would make the card render a skeleton forever.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the accounts whose balances are added
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number}>>}
 */
export async function getMonthlyBalance(pool, accountIds, from, to, timeZone = 'UTC') {
 const { rows } = await pool.query(MONTHLY_BALANCE_QUERY, [
  accountIds ?? [],
  from,
  to,
  timeZone,
 ]);

 return rows.map((row) => ({
  month: row.month,
  totalAmount: toAmount(row.total_amount ?? 0),
 }));
}
