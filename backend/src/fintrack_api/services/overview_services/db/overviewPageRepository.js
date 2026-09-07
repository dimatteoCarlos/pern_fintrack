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

// The bank balance at the close of the reference month, slack excluded.
//
// cash (account_type_id 7) is IN the set. The catalog question this module used
// to defer to — whether that type has real writes — was closed by decision and
// not by a count: a cash account reads as a bank account everywhere a figure is
// composed, so every formula naming bank includes it (D45). The schema keeps the
// two types apart, because there they record where the money came from, which is
// a different question from what it is worth.
//
// The month is bound the way every other closing balance in this module is
// bound: subtract forward from the current derived balance rather than summing
// from zero. The reference month subtracts nothing and equals the balance now, so
// the running month needs no branch. R42, §4.5: the month boundary goes local ->
// instant to meet a TIMESTAMPTZ column.
//
// An account opened after the reference month contributes nothing rather than
// its starting amount, and that falls out of the arithmetic instead of needing a
// predicate: the derivation excludes the row that opens the account while the
// subtraction below does not, so the opening credit cancels the starting amount
// the derivation kept.
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

// An account's identity is its NAME and its TYPE together, both, at every
// predicate that excludes the system's compensation account — ruled
// 2026-09-06. Of the three queries below only the recent-activity list changed:
// it selected the type and never compared it. The bank balance and the saving
// goals already restrict the type with an inclusive list that cannot admit that
// account, so they satisfy the rule as they stand and gained nothing. The
// account sets repository carries the full argument, including why no name
// comparison may be dropped yet.
const BANK_BALANCE_QUERY = `
  WITH bounds AS (
    SELECT (($2::date + INTERVAL '1 month') AT TIME ZONE $3) AS next_month_start
  )
  SELECT COALESCE(SUM(
    ${DERIVED_BALANCE} - COALESCE((
      SELECT SUM(t.amount)
      FROM transactions t
      WHERE t.account_id = ua.account_id
        AND t.transaction_actual_date >= (SELECT next_month_start FROM bounds)
    ), 0)
  ), 0) AS bank_balance
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name IN ('bank', 'cash')
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
//
// ua.account_balance is deliberately NOT derived here. This query joins
// pocket_saving_accounts, which migration 020 emptied along with every legacy
// pocket row, so it returns no rows at all and deriving a balance for none of them
// changes nothing. It needs repointing to the plan model, not re-anchoring.
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
    -- The type was selected here and never compared until 2026-09-06. The join
    -- above is already LEFT, so the comparison has to be IS DISTINCT FROM:
    -- a NULL type compared with <> yields NULL, which a WHERE discards, and would
    -- drop every movement on an account whose type was cleared.
    AND act.account_type_name IS DISTINCT FROM 'boundary'
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC
  LIMIT 5
`;

/**
 * The balance held in the user's bank and cash accounts at the close of one
 * month, slack excluded.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @param {string} referenceMonth - 'YYYY-MM-01', the month the balance is read at
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<number>} never null: 0 is a real balance
 */
export async function getBankBalance(pool, userId, referenceMonth, timeZone = 'UTC') {
 const { rows } = await pool.query(BANK_BALANCE_QUERY, [
  userId,
  referenceMonth,
  timeZone,
 ]);
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
