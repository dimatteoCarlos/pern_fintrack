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

// The bank balance, slack excluded.
//
// cash (account_type_id 7) is deliberately absent, the same omission the income
// account set makes and for the same reason: the catalog leaves that type out
// until the phase 2b probe says whether it has real writes, and this module does
// not get to close a question the catalog holds open.
const BANK_BALANCE_QUERY = `
  SELECT COALESCE(SUM(ua.account_balance), 0) AS bank_balance
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
// No GROUP BY currency_code. That is R202, the defect this module exists to
// replace — the dashboard's version returns whichever currency group came back
// first. Everything is already in the accounting currency (D7).
const SAVING_GOALS_QUERY = `
  SELECT
    ua.account_balance AS balance,
    psa.target AS target
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  JOIN pocket_saving_accounts psa ON psa.account_id = ua.account_id
  WHERE ua.user_id = $1
    AND act.account_type_name = 'pocket_saving'
    AND ua.account_name != 'slack'
  ORDER BY ua.account_id
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
 * One row per pocket: what it holds and what it is aiming at.
 *
 * target arrives as null when it was never set, and as a number otherwise — the
 * caller decides what a 0 means (D30), because only the caller knows R59 wrote
 * some of them.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @returns {Promise<Array<{balance: number, target: number|null}>>}
 */
export async function getSavingGoals(pool, userId) {
 const { rows } = await pool.query(SAVING_GOALS_QUERY, [userId]);

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
