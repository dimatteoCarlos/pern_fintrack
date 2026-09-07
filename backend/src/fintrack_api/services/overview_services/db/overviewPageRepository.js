// src/fintrack_api/services/overview_services/db/overviewPageRepository.js

// The three reads GET /overview needs that no domain calculator already makes.
//
// Everything else on that page is composed from the six cards, because §7 and
// §4.2 forbid ALL from recalculating what a domain already computed. These three
// are what is genuinely left over:
//
//  - the bank balance, the one stock no domain card publishes. netWorth and
//    cashPosition are built from it plus the cards (D27), so the hero and the
//    cards below it cannot disagree about the same money.
//  - the saving goals, which §9 says to reuse rather than recompute.
//  - the recent activity teaser, which is not a metric at all.
//
// transactionCountAll is deliberately NOT here. Counting rows across every
// account would double every two-legged movement — an expense writes a withdraw
// on the bank and a deposit on the category, and both sides are non-slack rows.
// The domains avoid that by scoping each count to one side's accounts, so ALL
// gets the figure by adding the five counts it already has (D31).

import { toAmount } from '../../budget_services/core/money.js';
import { extractNoteFromDescription } from '../../../../utils/fintrackUtils/transactionManagement/extractNoteFromDescription.js';
import { derivedAccountBalanceSql } from '../../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

// NUMERIC, not FLOAT: netWorth and cashPosition are composed from this figure plus
// the domain cards (D27), so it has to agree with them to the cent.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

// The bank balance, slack excluded.
//
// cash (account_type_id 7) is deliberately absent, the same omission the income
// account set makes and for the same reason: the catalog leaves that type out
// until the phase 2b probe says whether it has real writes, and this module does
// not get to close a question the catalog holds open.
//
// The balance comes from the ledger, not from user_accounts.account_balance. That
// column is a cache the money paths rewrite only for the accounts a write touches,
// so an account nothing has written since a back-dated insert keeps a figure that
// no longer matches its own movements. Every other balance read in the codebase
// already derives; this module was the exception.
//
// Measured on fintrack_dev before the substitution: stored and derived agree on all
// 31 accounts of every type, so the change is numerically inert and any later
// difference is real drift the derivation caught, not the substitution moving money.
const BANK_BALANCE_QUERY = `
  SELECT COALESCE(SUM(${DERIVED_BALANCE}), 0) AS bank_balance
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name = 'bank'
    AND ua.account_name != 'slack'
`;

// G1-G3, one row per pocket rather than a total.
//
// The rows come back individually because the total cannot be computed in SQL
// without deciding what to do with a target of 0.00, and that decision is D30's,
// not the query's: R59 coerces an absent target to zero, so a zero row is
// indistinguishable from a deliberate zero and must not enter the denominator of
// anything. Summing here would bury that choice inside an aggregate.
//
// D30 is now unreachable rather than wrong. pockets.target_amount is NOT NULL
// with CHECK (> 0) (020_create_pocket_tables.sql), so no row this statement can
// return carries a null or a zero target. The branch stays in makeFinancialGoals
// because retiring it changes the null semantics the contract publishes, and
// every indicator's null semantics is settled once, in P3.
//
// No GROUP BY currency_code. That is R202, the defect this module exists to
// replace — the dashboard's version returns whichever currency group came back
// first. Everything is already in the accounting currency (D7).
//
// Repointed at the plan model. It used to read pocket_saving_accounts joined to
// an account balance, and migration 020 emptied both, so the widget rendered
// blank rather than wrong. A pocket holds no money now: the balance of a goal is
// what the real accounts have COMMITTED to it, summed from the allocation
// ledger.
//
// Both bounds are the pocket board's own (pocketRepository.js:97-118), and they
// are here so this widget and the pocket card cannot disagree on one page: the
// ledger is cut at the close of the reference month, and a pocket planned after
// that close is not yet a goal. Without the month the widget would answer "now"
// beside a card answering August.
const SAVING_GOALS_QUERY = `
  SELECT
    COALESCE(SUM(pa.amount) FILTER (
      WHERE pa.allocation_actual_date < (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)
    ), 0) AS balance,
    p.target_amount AS target
  FROM pockets p
  LEFT JOIN pocket_allocations pa ON pa.pocket_id = p.pocket_id
  WHERE p.user_id = $1
    AND p.created_at < (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)
  GROUP BY p.pocket_id
  ORDER BY p.pocket_id
`;

// The five most recent movements, whatever domain they belong to.
//
// Not bounded by the requested month, and that is deliberate: "recent activity"
// answers what happened last, not what happened in the month being studied. A
// user reading August in November would otherwise see a teaser that is three
// months old and looks like the app stopped recording.
//
// Same row shape as every other list in this module, so one component renders
// them all.
const RECENT_ACTIVITY_QUERY = `
  SELECT
    tr.*,
    mt.movement_type_name,
    trt.transaction_type_name,
    act.account_type_name,
    cr.currency_code,
    ua.account_name,
    ua.account_type_id,
    (tr.transaction_actual_date AT TIME ZONE $2)::date::text AS transaction_local_date
  FROM transactions tr
  JOIN movement_types mt ON mt.movement_type_id = tr.movement_type_id
  JOIN transaction_types trt ON trt.transaction_type_id = tr.transaction_type_id
  JOIN currencies cr ON cr.currency_id = tr.currency_id
  JOIN user_accounts ua ON ua.account_id = tr.account_id
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND ua.account_name != 'slack'
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC
  LIMIT 5
`;

/**
 * The balance held in the user's bank accounts, slack excluded.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @returns {Promise<number>} never null: 0 is a real balance
 */
export async function getBankBalance(pool, userId) {
 const { rows } = await pool.query(BANK_BALANCE_QUERY, [userId]);
 return toAmount(rows[0]?.bank_balance ?? 0);
}

/**
 * One row per pocket: what is committed to it and what it is aiming at.
 *
 * balance is the committed total at the close of the given month, not a balance
 * the pocket holds — no allocation ever moved money, and the funding accounts
 * still carry it.
 *
 * target can no longer arrive as null under the plan model, and the return type
 * still admits it: the caller's D30 branch is what publishes the contract's null
 * semantics, and that is settled in P3, not here.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {string} month - the month to read at, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{balance: number, target: number|null}>>}
 */
export async function getSavingGoals(pool, userId, month, timeZone = 'UTC') {
 const { rows } = await pool.query(SAVING_GOALS_QUERY, [userId, month, timeZone]);

 return rows.map((row) => ({
  balance: toAmount(row.balance ?? 0),
  target: row.target === null || row.target === undefined ? null : toAmount(row.target),
 }));
}

/**
 * The five most recent movements across every account the user owns.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<object[]>} at most five rows, newest first
 */
export async function getRecentActivity(pool, userId, timeZone = 'UTC') {
 const { rows } = await pool.query(RECENT_ACTIVITY_QUERY, [userId, timeZone]);

 return rows.map((row) => ({
  ...row,
  note: extractNoteFromDescription(row.description),
 }));
}
