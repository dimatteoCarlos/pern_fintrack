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

// What counts as a movement in this section, written once.
//
// The teaser the page carries and the paged endpoint answer the same question
// over the same rows; they differ in their bounds and in how much they return.
// A predicate written twice would be two definitions of a movement for one
// section, and the two would be free to drift.
//
// $1 is the owner. No other placeholder appears here on purpose: the statements
// that embed this number their own parameters differently, and a filter
// carrying one of them could only be pasted into the statement it was written
// for.
const ACTIVITY_FILTER = `
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
    AND act.account_type_name <> 'boundary'`;

// The reader's own two narrowings, written once for the page and for the count
// that has to answer over the same set. They are NOT part of ACTIVITY_FILTER:
// that one says what counts as a movement in this section and the teaser shares
// it, and a teaser that narrowed itself by a search nobody typed would answer a
// different question from the one it is asked.
//
// Both are optional and a null one drops out of the statement rather than
// widening to a wildcard the client could send.
//
// $5 is the term and $6 the movement type, and they are numbered BEFORE the page
// bounds rather than appended after them. PostgreSQL refuses a bind list longer
// than the highest placeholder a statement names, so a search parameter sitting
// at $7 could not be reached by the count statement at all - the count binds
// neither LIMIT nor OFFSET.
const ACTIVITY_READER_FILTER = `
    -- strpos over lower() and not ILIKE. With ILIKE the term's own % and _ are
    -- wildcards, so a reader looking for "50%" would match every row in the
    -- account, and an owner searching "credit_card" would match "credit-card"
    -- too. Neither is a search; both are the pattern language leaking into the
    -- text box.
    --
    -- The column is the WHOLE description and not the note the row displays.
    -- That is a superset on purpose: the half this does not show on screen is
    -- the sentence the server narrates ("Transaction: ... from X to Y"), which
    -- is exactly where an owner looks for a counterparty they cannot remember
    -- typing. extractNoteFromDescription splits the two for display and this
    -- searches both.
    AND (
      $5::text IS NULL
      OR strpos(lower(tr.description), lower($5::text)) > 0
      OR strpos(lower(COALESCE(ua.account_name, '')), lower($5::text)) > 0
    )
    -- By NAME and not by id. The id is what the statements of this module select
    -- on; the name is what a client can send without holding the catalog in its
    -- head, and the schema has already refused anything outside it.
    AND ($6::text IS NULL OR mt.movement_type_name = $6::text)`;

// Newest first, and the id breaks the tie. Two movements can carry the same
// actual date, and a page boundary falling between them would show one row
// twice and skip another without the second key.
const ACTIVITY_ORDER = `
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC`;

// The five most recent movements, whatever domain they belong to.
//
// Not bounded by the requested month, and that is deliberate: recent activity
// answers what happened last, not what happened in the month being studied. A
// user reading August in November would otherwise see a teaser that is three
// months old and looks like the app stopped recording.
//
// Same row shape as every other list in this module, so one component renders
// them all.
const RECENT_ACTIVITY_QUERY = `
  SELECT${transactionRowColumns('$2')}${TRANSACTION_ROW_SOURCE}${ACTIVITY_FILTER}${ACTIVITY_ORDER}
  LIMIT 5
`;

// The same movements over a period the reader chooses, paginated.
//
// Both bounds are optional and a null one drops out of the statement rather
// than widening to some far date: an unbounded read is the default of this
// section, because what happened last is not a property of the month being
// studied.
//
// The upper bound names a month and covers all of it. Comparing against the
// first day of the month the caller named would return nothing for a request
// whose two bounds are the same month, which is the most ordinary request there
// is — and it would return it as an empty list, indistinguishable from an owner
// with no movements.
//
// Both bounds are converted on the OWNER calendar for the same reason every
// other bound in this module is: the column is TIMESTAMPTZ, and compared bare
// Postgres resolves the literal through the session zone, so a movement at 8pm
// on the last day of a month lands in the next one.
const ACTIVITY_PAGE_QUERY = `
  SELECT${transactionRowColumns('$4')}${TRANSACTION_ROW_SOURCE}${ACTIVITY_FILTER}
    AND ($2::date IS NULL OR tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $4))
    AND ($3::date IS NULL OR tr.transaction_actual_date < (($3::date + INTERVAL '1 month') AT TIME ZONE $4))${ACTIVITY_READER_FILTER}${ACTIVITY_ORDER}
  LIMIT $7 OFFSET $8
`;

// How many rows the page was cut out of. A whole second statement over the same
// filter rather than a window function on the one above, the same choice the
// domain lists make: the count has to answer for the whole set, and a count
// computed beside a limited page is a count of the page.
const ACTIVITY_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows${TRANSACTION_ROW_SOURCE}${ACTIVITY_FILTER}
    AND ($2::date IS NULL OR tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $4))
    AND ($3::date IS NULL OR tr.transaction_actual_date < (($3::date + INTERVAL '1 month') AT TIME ZONE $4))${ACTIVITY_READER_FILTER}
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

/**
 * One page of the movements of a period the reader chose, plus the size of the
 * whole set.
 *
 * Both bounds may be null and that is the ordinary case, not a degenerate one.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {{from: (string|null), to: (string|null), search: (string|null), movementType: (string|null)}} range
 *   - the months, both inclusive, and the reader's own two narrowings
 * @param {string} timeZone - IANA zone of the account owner
 * @param {{page: number, pageSize: number}} paging - already validated as positive integers
 * @returns {Promise<{rows: object[], totalRows: number}>}
 */
export async function getActivityPage(
 pool,
 userId,
 { from, to, search, movementType },
 timeZone = 'UTC',
 { page, pageSize },
) {
 const offset = (page - 1) * pageSize;

 // The six the count shares. The page adds two of its own and the count binds
 // none of them, which is why the search pair sits inside this list rather than
 // after the page bounds.
 const bounds = [
  userId,
  from ?? null,
  to ?? null,
  timeZone,
  search ?? null,
  movementType ?? null,
 ];

 // Both in flight at once: the count does not depend on the page and the page
 // does not depend on the count, so serialising them would pay for the slower
 // one twice. Same shape as the domain lists, for the same reason.
 const [rows, total] = await Promise.all([
  pool.query(ACTIVITY_PAGE_QUERY, [...bounds, pageSize, offset]),
  pool.query(ACTIVITY_COUNT_QUERY, bounds),
 ]);

 return {
  rows: rows.rows.map((row) => ({
   ...row,
   note: extractNoteFromDescription(row.description),
  })),
  totalRows: Number(total.rows[0]?.total_rows ?? 0),
 };
}
