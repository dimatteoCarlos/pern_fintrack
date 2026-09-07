// src/fintrack_api/services/overview_services/db/overviewPageRepository.js

// The four reads GET /overview needs that no domain calculator already makes.
//
// Everything else on that page is composed from the six cards, because §7 and
// §4.2 forbid ALL from recalculating what a domain already computed. These four
// are what is genuinely left over:
//
//  - the bank balance, the one stock no domain card publishes. netWorth,
//    cashPosition and liquidNetWorth are built from it plus the cards (D27), so
//    the hero and the cards below it cannot disagree about the same money.
//  - free cash, which is that balance less what the pockets have been promised,
//    floored per account. It is not the pocket card's figure read differently:
//    the card publishes the committed total, this publishes what is left, and
//    the floor means the second cannot be derived from the first.
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
import { transactionRowColumns, TRANSACTION_ROW_SOURCE } from './transactionRowShape.js';

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
// the derivation kept. The cancellation is exact and unconditional, and the
// paragraph below says why it is a construction rather than an invariant.
//
// The balance is NOT read from user_accounts.account_balance.
//
// It is not read from the ledger alone either, which is what this comment used to
// imply. derivedAccountBalanceSql is account_starting_amount plus every movement
// except the account's own opening row, so one write-once column is a term of it.
// That column cannot drift — nothing in the backend UPDATEs it, it is written at
// creation and never again — so nothing is lost by including it, but a reader
// looking for the figure's inputs has to know it is there.
//
// account_balance, the column that IS excluded, is not a cache. It has one
// writer, setAccountBalanceFromLedger, which recomputes it with the same derived
// expression every read path imports, under the account's row lock, on every
// money path. Calling it a cache and naming a back-dated insert as the way it
// goes stale described a mechanism that does not exist.
//
// Why the opening cancellation holds. The subtraction above sums the opening
// ROW while the derivation substitutes the COLUMN for it, so the two cancel only
// if they carry the same amount. They do, on every path: all three creation
// writers compute ONE converted value and pass it into the starting-amount
// column, the balance column and the opening row alike — one conversion, one
// variable, nothing rounds twice. Both sides are write-once afterwards, so no
// later path can separate them: no UPDATE writer exists for
// account_starting_amount, the account edit admits only the name and the note
// into user_accounts, and no route file carries a PUT, PATCH or DELETE on a
// transaction. So the two agree because one assignment writes both — a
// construction that agrees, which is a weaker thing than an invariant and holds
// just as firmly while the writers stay as they are.
//
// This paragraph replaces one that claimed the opposite: that the stored balance
// and the opening row come from two distinct fields of the same options object,
// so an account created with a currency conversion rounding them differently is
// born divergent. Measured across all three creation controllers on 2026-09-07 —
// no such path exists, and the exception it invented is what made the
// cancellation above read as conditional.
//
// Which is why deriving is not a preference here. Measured on fintrack_dev before
// the substitution, stored and derived agreed on all 31 accounts of every type, so
// the change was numerically inert on that data — but a count can only be evidence
// about the rows that exist, and the row that would falsify it is the one nobody
// has created yet. The derivation does not depend on the agreement holding.

// The system's compensation account is excluded by its TYPE at every predicate
// below, and by nothing else. The 2026-09-06 ruling that required the name as
// well was retired on 2026-09-07: the resolver that creates that account matches
// on the type, so an owner's own account sharing the name cannot become the
// counterparty, and the name comparison only dropped that owner's account out of
// their own figures. The account sets repository carries the argument and the
// measurement. The bank balance and free cash restrict the type with an
// inclusive list; the recent-activity list compares the type directly.
//
// The inclusive list does NOT make the account unreachable, and this comment used
// to say it did. Migration 031 is what creates the boundary type, and its retype
// statement records what that account was before it ran: WHERE account_name =
// 'slack' AND account_type_id = 1 — a BANK account, found by the resolver with
// WHERE ua.user_id = $1, so it is the owner's own. Before 031, IN ('bank',
// 'cash') therefore admits it AFFIRMATIVELY: it counts it in rather than merely
// failing to keep it out.
//
// The figures are still right in that era, and by a different mechanism worth
// naming rather than inheriting. A returns-to-assets on an account whose only
// qualifying row is its own opening writes BOTH annulment legs onto the
// compensation account, plus and minus the same adjustment, so pre-031 they are
// both inside the balance and cancel. Cancellation, not exclusion — any variant
// writing one leg without the other moves the figure, and no predicate here would
// catch it.
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
`;

// How much of that cash is not already promised to a pocket, at the same cut.
//
// The floor is applied PER ACCOUNT and before the sum, which is the whole
// difficulty of the figure. A per-account remainder may go negative — an expense
// against committed money is always accepted, so an account can end a month
// owing its pockets more than it holds — and summing raw remainders lets one
// account's surplus absorb another's shortfall. Floored first, an overcommitted
// account contributes nothing instead of contributing a credit against a healthy
// one.
//
// Same account set and same month binding as the bank balance above, deliberately
// rather than incidentally: the two sit beside each other in the hero, and
// reading different accounts would make the pair incomparable rather than merely
// different.
//
// A consequence of the floor, written down because it reads as a defect: free
// cash can come out HIGHER than the available balance. An overdrawn account
// contributes its negative balance to that figure and contributes zero to this
// one. That is the answer the floor was chosen to give — money the owner does not
// have is not negative free cash — and the pair stays readable because the two
// answer different questions: what the accounts hold, against what none of them
// has promised away.
//
// The allocation ledger is cut at the same instant and on the same column the
// pocket board cuts on, so this figure and the pocket card cannot disagree about
// what was committed by the close of the month. A release is stored as a negative
// row, so the signed sum is already net of releases and no second predicate takes
// them out.
//
// The committed total is read from the allocation ledger rather than through
// makeAccountAllocation, which computes the same remainder for the account
// screen. That function reads a row, not a month: it has no time coordinate at
// all, so it cannot answer at the close of a past one. The arithmetic is
// reproduced here rather than shared, and the only difference between them is
// the floor — which exists here because this figure aggregates, while that one is
// per account and reports the shortfall as a flag beside the number.
const FREE_CASH_QUERY = `
  WITH bounds AS (
    SELECT (($2::date + INTERVAL '1 month') AT TIME ZONE $3) AS next_month_start
  ),
  per_account AS (
    SELECT
      ${DERIVED_BALANCE} - COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        WHERE t.account_id = ua.account_id
          AND t.transaction_actual_date >= (SELECT next_month_start FROM bounds)
      ), 0) AS balance,
      COALESCE((
        SELECT SUM(pa.amount)
        FROM pocket_allocations pa
        WHERE pa.source_account_id = ua.account_id
          AND pa.allocation_actual_date < (SELECT next_month_start FROM bounds)
      ), 0) AS allocated
    FROM user_accounts ua
    JOIN account_types act ON act.account_type_id = ua.account_type_id
    WHERE ua.user_id = $1
      AND act.account_type_name IN ('bank', 'cash')
  )
  SELECT COALESCE(SUM(GREATEST(balance - allocated, 0)), 0) AS free_cash
  FROM per_account
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
// That much the plan of record upholds. What it retires is the rest of this
// shape: recent activity is a top-level section with its OWN period, chosen by
// the reader, on its own endpoint, returning every movement of that period
// rather than a fixed five. So the statement below is not wrong about the month —
// it is provisional about everything else, and the LIMIT is the part that goes.
// Until that endpoint exists the teaser is what the page carries, and a reader
// should not take the fixed five as a decision anyone defended.
//
// Same row shape as every other list in this module, so one component renders
// them all.
const RECENT_ACTIVITY_QUERY = `
  SELECT${transactionRowColumns('$2')}${TRANSACTION_ROW_SOURCE}
  WHERE ua.user_id = $1
    -- The type was selected here and never compared until 2026-09-06, and the
    -- comparison was IS DISTINCT FROM because the type could be cleared. Migration
    -- 033 made the column NOT NULL behind a RESTRICT foreign key, so it cannot be,
    -- and <> returns the same rows.
    --
    -- The join this reads is LEFT on purpose and now lives in
    -- TRANSACTION_ROW_SOURCE. It was already LEFT before this module compared the
    -- type at all, so it was not written for the nullable case and retiring it is
    -- a decision this change did not make.
    AND act.account_type_name <> 'boundary'
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
 * How much of the bank and cash balance is not committed to a pocket, at the
 * close of one month.
 *
 * Never null and never negative: the floor is inside the statement, per account,
 * and an owner with no pockets gets back the whole balance rather than 0.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @param {string} referenceMonth - 'YYYY-MM-01', the month the figure is read at
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<number>} never null: 0 is a real answer
 */
export async function getFreeCash(pool, userId, referenceMonth, timeZone = 'UTC') {
 const { rows } = await pool.query(FREE_CASH_QUERY, [
  userId,
  referenceMonth,
  timeZone,
 ]);
 return toAmount(rows[0]?.free_cash ?? 0);
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
