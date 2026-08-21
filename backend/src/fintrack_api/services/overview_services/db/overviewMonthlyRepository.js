// src/fintrack_api/services/overview_services/db/overviewMonthlyRepository.js

// The monthly expense figures of the Overview expense card, in ONE query.
//
// totalAmount, transactionCount, delta and trend are four readings of the same
// six rows, not four queries. §4.2: two figures that must reconcile have to come
// from literally the same formula, and the surest way to guarantee that is for
// them to come from the same statement. Deriving the delta from a second query
// would let the card and the chart disagree about the same month.

import { toAmount } from '../../budget_services/core/money.js';

// One row per calendar month in the window, whether anything happened in it.
//
// generate_series is on the LEFT of the join for D18: a month with no activity
// publishes a real 0, never null and never a gap. Omitting it would falsify the
// shape of the series — a flat month and a missing month look nothing alike on a
// chart, and only one of them is what the data says.
//
// The netting is SPENT_QUERY's, verbatim (budgetTransactionRepository.js:181-197)
// and for D20's reason: movement_type_id 6 is the reversal transfer that sends
// money back from a category to a bank, and `amount` is already signed per leg —
// negative on the withdraw side. Counting type 1 alone would report a refunded
// expense as still spent, while actualSpent — which nets — reported it as
// returned, so two figures that are a subset of one another would disagree over
// a refund.
//
// transactionCount carries no filter of its own (D21). The catalog defines E2 as
// COUNT(*) over E1's rows, so when D20 moved E1 to IN (1, 6) the count moved with
// it. Counting type 1 alone made the card report 23 while the list under it
// showed the 26 rows the total is made of — the disagreement §4.2 forbids.
//
// R42, §4.5: exactly one AT TIME ZONE per operand and in opposite directions —
// the bounds go local month boundary -> instant to meet a TIMESTAMPTZ column,
// which is the direction generate_series's TIMESTAMP output already selects
// without a cast. The month labels come back as text because a pg DATE becomes a
// JS Date at the node process's local midnight and can shift a day in the driver.
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

/**
 * The expense of a set of accounts, month by month, over a closed range.
 *
 * Returns one entry per calendar month between `from` and `to` inclusive, with
 * no gaps: a month with no transactions reports 0 and 0.
 *
 * An empty accountIds still returns the full month list at zero rather than an
 * empty array. A user with no category accounts has an expense of 0, which is a
 * real answer; an empty series would make the card render a skeleton forever.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - category_budget accounts, soft-deleted included (D19)
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
export async function getMonthlyExpense(pool, accountIds, from, to, timeZone = 'UTC') {
 const { rows } = await pool.query(MONTHLY_EXPENSE_QUERY, [
  accountIds ?? [],
  from,
  to,
  timeZone,
 ]);

 return rows.map((row) => ({
  month: row.month,
  totalAmount: toAmount(row.total_amount ?? 0),
  // COUNT comes back as a string from the driver on bigint columns; Number is
  // exact here because a month's transaction count cannot leave the safe range.
  transactionCount: Number(row.transaction_count ?? 0),
 }));
}
