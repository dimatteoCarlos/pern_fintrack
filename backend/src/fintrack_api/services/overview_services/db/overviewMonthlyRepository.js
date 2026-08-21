// src/fintrack_api/services/overview_services/db/overviewMonthlyRepository.js

// The monthly figures behind a flow domain's card, one query per domain.
//
// totalAmount, transactionCount, delta and trend are four readings of the same
// six rows, not four queries. §4.2: two figures that must reconcile have to come
// from literally the same formula, and the surest way to guarantee that is for
// them to come from the same statement. Deriving the delta from a second query
// would let the card and the chart disagree about the same month.
//
// Three whole statements rather than one with the filter interpolated. The rule
// is the one overviewTransactionRepository.js:65-68 already states — a whole
// statement can be read and compared, a template with holes cannot — and the
// three differ by more than a WHERE anyway: expense nets two movement types
// through a CASE, income sums one, and pnl carries a description filter. What is
// shared is the reading of the rows, and that is shared for real, below.
//
// Every one of them repeats three rules on purpose, because each has to hold in
// each statement or the figure that statement produces is wrong:
//
//  - generate_series is on the LEFT of the join (D18): a month with no activity
//    publishes a real 0, never null and never a gap. Omitting it would falsify
//    the shape of the series — a flat month and a missing month look nothing
//    alike on a chart, and only one of them is what the data says.
//  - the count carries no filter of its own (D21). The catalog defines the
//    count of every domain as COUNT(*) over the rows of that domain's total, so
//    the filter lives in the join and the count inherits it. Counting a subset
//    made the expense card report 23 while the list under it showed the 26 rows
//    the total was made of — the disagreement §4.2 forbids.
//  - R42, §4.5: exactly one AT TIME ZONE per operand and in opposite
//    directions — the bounds go local month boundary -> instant to meet a
//    TIMESTAMPTZ column, which is the direction generate_series's TIMESTAMP
//    output already selects without a cast. The month labels come back as text
//    because a pg DATE becomes a JS Date at the node process's local midnight
//    and can shift a day in the driver.

import { toAmount } from '../../budget_services/core/money.js';

// Expense: the netting is SPENT_QUERY's, verbatim
// (budgetTransactionRepository.js:181-197) and for D20's reason. movement_type_id
// 6 is the reversal transfer that sends money back from a category to a bank,
// and `amount` is already signed per leg — negative on the withdraw side.
// Counting type 1 alone would report a refunded expense as still spent, while
// actualSpent — which nets — reported it as returned, so two figures that are a
// subset of one another would disagree over a refund.
const MONTHLY_EXPENSE_QUERY = `
  SELECT
    m.month::date::text AS month,
    COALESCE(SUM(
      CASE
        WHEN t.movement_type_id = 1 THEN t.amount
        WHEN t.movement_type_id = 6 THEN t.amount
        ELSE 0
      END
    ), 0) AS total_amount,
    COUNT(t.transaction_id) AS transaction_count
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])
   AND t.movement_type_id IN (1, 6)
   AND t.transaction_actual_date >= (m.month AT TIME ZONE $4)
   AND t.transaction_actual_date <  ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month
  ORDER BY m.month
`;

// Income: one movement type and no netting. There is no reversal counterpart to
// D20 here — a transfer cannot name income_source as an endpoint
// (getTransferConfig takes its types from the request body, which offers bank,
// pocket, investment and debtor), so no movement_type_id 6 row can ever be an
// undone income.
//
// The leg is selected by the account set the caller passes, not by
// transaction_type_id: income_source accounts are not in that set, so only the
// leg that landed in the user's own account survives the join. That is also why
// the sum comes out positive — the surviving leg is the deposit.
const MONTHLY_INCOME_QUERY = `
  SELECT
    m.month::date::text AS month,
    COALESCE(SUM(t.amount), 0) AS total_amount,
    COUNT(t.transaction_id) AS transaction_count
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])
   AND t.movement_type_id = 2
   AND t.transaction_actual_date >= (m.month AT TIME ZONE $4)
   AND t.transaction_actual_date <  ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month
  ORDER BY m.month
`;

// PnL: movement_type_id 9, with R212's exclusion. That movement mixes real
// realized P/L with the compensating rows an account deletion writes, and the
// only thing telling them apart is the description prefix.
//
// The IS NULL branch is load-bearing, not defensive noise: description is
// nullable (003_transactions.sql:21), and `NULL NOT LIKE ...` is NULL, which a
// join treats as no match. Without it a real P/L row that was written without a
// description would be dropped from the total, the count and the chart at once.
//
// The sum comes out signed the way the user means it: on a profit the non-slack
// leg is the deposit and on a loss it is the withdraw, so gains add and losses
// subtract without a CASE.
const MONTHLY_PNL_QUERY = `
  SELECT
    m.month::date::text AS month,
    COALESCE(SUM(t.amount), 0) AS total_amount,
    COUNT(t.transaction_id) AS transaction_count
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])
   AND t.movement_type_id = 9
   AND (t.description IS NULL OR t.description NOT LIKE 'RTA Annulment Target(%')
   AND t.transaction_actual_date >= (m.month AT TIME ZONE $4)
   AND t.transaction_actual_date <  ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month
  ORDER BY m.month
`;

/**
 * Run one of the monthly statements and read its rows.
 *
 * The three statements differ; the reading of their result does not, and it is
 * shared rather than repeated because it carries a rule of its own — a count is
 * a number and an amount goes through money, in every domain.
 *
 * An empty accountIds still returns the full month list at zero rather than an
 * empty array. A user with no accounts of the domain's kind has a total of 0,
 * which is a real answer; an empty series would make the card render a skeleton
 * forever.
 *
 * @param {object} pool - Database pool
 * @param {string} sql - one of the statements above
 * @param {number[]} accountIds - the set that selects the leg
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
const readMonthlyRows = async (pool, sql, accountIds, from, to, timeZone) => {
 const { rows } = await pool.query(sql, [accountIds ?? [], from, to, timeZone]);

 return rows.map((row) => ({
  month: row.month,
  totalAmount: toAmount(row.total_amount ?? 0),
  // COUNT comes back as a string from the driver on bigint columns; Number is
  // exact here because a month's transaction count cannot leave the safe range.
  transactionCount: Number(row.transaction_count ?? 0),
 }));
};

/**
 * The expense of a set of accounts, month by month, over a closed range.
 *
 * Returns one entry per calendar month between `from` and `to` inclusive, with
 * no gaps: a month with no transactions reports 0 and 0.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - category_budget accounts, soft-deleted included (D19)
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
export async function getMonthlyExpense(pool, accountIds, from, to, timeZone = 'UTC') {
 return readMonthlyRows(pool, MONTHLY_EXPENSE_QUERY, accountIds, from, to, timeZone);
}

/**
 * The income of a set of accounts, month by month, over a closed range.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's real money accounts, slack excluded
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
export async function getMonthlyIncome(pool, accountIds, from, to, timeZone = 'UTC') {
 return readMonthlyRows(pool, MONTHLY_INCOME_QUERY, accountIds, from, to, timeZone);
}

/**
 * The realized P/L of a set of accounts, month by month, over a closed range.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - every account of the user except slack
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
export async function getMonthlyPnl(pool, accountIds, from, to, timeZone = 'UTC') {
 return readMonthlyRows(pool, MONTHLY_PNL_QUERY, accountIds, from, to, timeZone);
}
