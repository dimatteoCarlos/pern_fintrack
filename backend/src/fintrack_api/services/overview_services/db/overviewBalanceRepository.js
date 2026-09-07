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
//
// The anchor the walk-back starts from is itself derived from the ledger rather
// than read from user_accounts.account_balance, so neither end of the series
// rests on the stored column. Measured on fintrack_dev before the substitution:
// stored and derived agreed on all 31 accounts, so the change was numerically
// inert on that data.
//
// That measurement says the two computations agree, not that anything forces
// them to, and the difference matters here because this anchor is what the whole
// series hangs from. See the account-creation exception recorded at the bank
// balance in overviewPageRepository.js.

import { toAmount } from '../../budget_services/core/money.js';
import {
 ACCOUNT_OPENING_MOVEMENT_TYPE_ID,
 derivedAccountBalanceSql,
} from '../../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

// NUMERIC, not FLOAT: this figure is the anchor a summed NUMERIC amount is
// subtracted from, and a float anchor makes every month of the series inexact.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

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

// The instant the month AFTER the given one begins, in the owner's zone — the
// one cut every figure in this file is taken at.
//
// Written once and called by both queries rather than spelled out in each. The
// legs below are not an independent reading that happens to agree with the total
// above: they have to be cut exactly where it is cut or they stop adding up to
// it, and two copies of one expression are one edit away from disagreeing.
//
// R42, §4.5: one AT TIME ZONE per operand, opposite directions. The month
// boundary goes local -> instant to meet a TIMESTAMPTZ column.
const nextMonthStart = (monthSql, timeZonePlaceholder) =>
 `((${monthSql} + INTERVAL '1 month') AT TIME ZONE ${timeZonePlaceholder})`;

const MONTHLY_BALANCE_QUERY = `
  SELECT
    m.month::date::text AS month,
    b.current_balance - COALESCE(SUM(t.amount), 0) AS total_amount
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  CROSS JOIN (
    SELECT COALESCE(SUM(${DERIVED_BALANCE}), 0) AS current_balance
    FROM user_accounts ua
    WHERE ua.account_id = ANY($1::int[])
  ) b
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])
   AND t.transaction_actual_date >= ${nextMonthStart('m.month', '$4')}
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

// The three fields the debt card adds to the base card (D39, D43), all read at
// the close of the reference month.
//
// The legs are a SPLIT of the position, not a second computation of it. The
// total above sums the balances and then subtracts what happened after the cut;
// this sums per account first and then splits by sign, and the two agree because
// addition does not care about the order. That is what makes
// `totalAmount = receivable - payable` a check the card can be audited against
// rather than a definition it was built to satisfy.
//
// Both legs come out as POSITIVE MAGNITUDES, as §6 requires: the direction is
// carried by the field name, so a negative payable would be a double negative.
// An account sitting at exactly 0 is in neither leg and contributes 0 to both,
// which is correct and not a rounding artifact.
//
// FILTER and not CASE, and the guard that matters here: `balance` can never be
// NULL — the derived balance COALESCEs its sum and the post-cut subtraction
// COALESCEs its own — so no row is silently dropped from either sum. If that
// ever stops being true, both legs lose the same row and the identity keeps
// holding while both figures are wrong, which is the failure worth naming.
//
// The activity clause of §5.2 excludes the row that OPENS the account, not every
// row. The definition's stated purpose is that a debtor account created and never
// used is not a settled debtor, and creation writes an opening row — so counting
// any row at all would re-admit exactly the accounts the clause exists to keep
// out. Measured on fintrack_dev 2026-09-06: three of five debtor accounts have a
// row before the cut and no movement of their own, so the two readings are
// genuinely different populations and not a distinction without a difference.
// No account there sits at exactly zero, though, so the count itself is 0 under
// either reading and that database cannot tell the two apart. The clause was
// exercised instead on four accounts built inside a transaction that rolled back
// — one at zero carrying only its opening row, one at zero with two
// movements of its own, one on each side of zero — where the rejected
// reading reports two settled and this query reports one.
// The test mirrors the one `derivedAccountBalanceSql` already makes, so the
// balance and the activity flag agree about what opening a row means — and it
// is null-safe for the same reason that one is a CASE: the opening column is
// NULL on every funding leg, and `NOT (… AND col = NULL)` is NULL, which a
// WHERE drops, losing a real movement instead of counting it.
const DEBT_DOMAIN_FIELDS_QUERY = `
  WITH closing AS (
    SELECT
      ${DERIVED_BALANCE} - COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        WHERE t.account_id = ua.account_id
          AND t.transaction_actual_date >= ${nextMonthStart('$2::date', '$3')}
      ), 0) AS balance,
      EXISTS (
        SELECT 1
        FROM transactions t
        WHERE t.account_id = ua.account_id
          AND t.transaction_actual_date < ${nextMonthStart('$2::date', '$3')}
          AND NOT (
            t.movement_type_id = ${ACCOUNT_OPENING_MOVEMENT_TYPE_ID}
            AND t.account_id IS NOT DISTINCT FROM t.opening_for_account_id
          )
      ) AS has_movement
    FROM user_accounts ua
    WHERE ua.account_id = ANY($1::int[])
  )
  SELECT
    COALESCE(SUM(balance) FILTER (WHERE balance > 0), 0) AS receivable,
    COALESCE(SUM(-balance) FILTER (WHERE balance < 0), 0) AS payable,
    COUNT(*) FILTER (WHERE balance = 0 AND has_movement) AS settled_count
  FROM closing
`;

/**
 * The debt card's own fields: the two legs of the position and the count of
 * debtors settled at the close of the reference month.
 *
 * An empty accountIds returns two zero legs and a zero count. A user with no
 * debtor accounts is owed nothing and owes nothing, which is a real answer, and
 * the card would otherwise render a skeleton forever.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the same set totalAmount is computed over
 * @param {string} month - the reference month, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<{receivable: number, payable: number, settledCount: number}>}
 */
export async function getDebtDomainFields(
 pool,
 accountIds,
 month,
 timeZone = 'UTC',
) {
 const { rows } = await pool.query(DEBT_DOMAIN_FIELDS_QUERY, [
  accountIds ?? [],
  month,
  timeZone,
 ]);

 const row = rows[0] ?? {};

 return {
  payable: toAmount(row.payable ?? 0),
  receivable: toAmount(row.receivable ?? 0),
  settledCount: Number(row.settled_count ?? 0),
 };
}
