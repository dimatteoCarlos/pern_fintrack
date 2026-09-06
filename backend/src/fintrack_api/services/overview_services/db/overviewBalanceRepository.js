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

// The same reconstruction as above, but resolved PER ACCOUNT and then split by
// the sign each account carries at the month's close — D39's two legs.
//
// It cannot be derived from MONTHLY_BALANCE_QUERY. That statement sums every
// account's balance BEFORE subtracting, so by the time it has a figure the
// individual signs are gone, and a net of -550 is indistinguishable from
// "owed 1,750, owes 2,300". The legs of the legacy screen
// (dashboardController.js:216) cannot be copied either: they bucket
// ua.account_balance, which is today's figure, and a leg at a closed month's
// end is not today's.
//
// So the account dimension is kept until the sign has been read, and only then
// aggregated. The definition of "the month's close" is §5.1 of the contract and
// is the same boundary the sibling query uses, restated here rather than shared:
// >= the instant month M+1 begins on the holder's calendar.
//
// Both legs are published as POSITIVE magnitudes, which is why the payable side
// is negated. The label carries the direction; a negative number under a label
// that reads "you owe" is a double negative.
//
// settledCount is §5.2: closing balance exactly 0 AND some movement before that
// close. first_movement supplies the second half — without it a debtor account
// created and never used would count as a settled debtor, and creating accounts
// would inflate the figure.
//
// generate_series drives the OUTER select, not just the CTE, for the same reason
// the sibling returns a full month list: an empty accountIds must still answer
// with a month at zero, not with no rows, or the card renders a skeleton for
// ever.
const MONTHLY_BALANCE_BY_LEG_QUERY = `
  WITH months AS (
    SELECT m.month
    FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  ),
  first_movement AS (
    SELECT t.account_id, MIN(t.transaction_actual_date) AS first_at
    FROM transactions t
    WHERE t.account_id = ANY($1::int[])
    GROUP BY t.account_id
  ),
  per_account AS (
    SELECT
      mo.month AS month,
      ua.account_id AS account_id,
      ua.account_balance - COALESCE(SUM(t.amount), 0) AS closing_balance,
      fm.first_at AS first_at
    FROM months mo
    CROSS JOIN user_accounts ua
    LEFT JOIN first_movement fm ON fm.account_id = ua.account_id
    LEFT JOIN transactions t
      ON t.account_id = ua.account_id
     AND t.transaction_actual_date >= ((mo.month + INTERVAL '1 month') AT TIME ZONE $4)
    WHERE ua.account_id = ANY($1::int[])
    GROUP BY mo.month, ua.account_id, ua.account_balance, fm.first_at
  )
  SELECT
    mo.month::date::text AS month,
    COALESCE(SUM(pa.closing_balance) FILTER (WHERE pa.closing_balance > 0), 0) AS receivable,
    COALESCE(-SUM(pa.closing_balance) FILTER (WHERE pa.closing_balance < 0), 0) AS payable,
    COUNT(*) FILTER (
      WHERE pa.closing_balance = 0
        AND pa.first_at IS NOT NULL
        AND pa.first_at < ((mo.month + INTERVAL '1 month') AT TIME ZONE $4)
    ) AS settled_count
  FROM months mo
  LEFT JOIN per_account pa ON pa.month = mo.month
  GROUP BY mo.month
  ORDER BY mo.month
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

/**
 * The debt position split into its two legs, at the end of each month of a window.
 *
 * Both legs are positive magnitudes and the contract's identity is
 * `totalAmount = receivable - payable` (§5.1). The identity is a CHECK on two
 * reads of the same ledger, not a definition: the card's totalAmount keeps
 * coming from getMonthlyBalance and is never recomputed from these.
 *
 * An empty accountIds returns the full month list at zero, for the same reason
 * getMonthlyBalance does.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the accounts whose balances are bucketed by sign
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, payable: number, receivable: number, settledCount: number}>>}
 */
export async function getMonthlyBalanceByLeg(pool, accountIds, from, to, timeZone = 'UTC') {
 const { rows } = await pool.query(MONTHLY_BALANCE_BY_LEG_QUERY, [
  accountIds ?? [],
  from,
  to,
  timeZone,
 ]);

 return rows.map((row) => ({
  month: row.month,
  payable: toAmount(row.payable ?? 0),
  receivable: toAmount(row.receivable ?? 0),
  settledCount: Number(row.settled_count ?? 0),
 }));
}
