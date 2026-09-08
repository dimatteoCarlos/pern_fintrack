// src/fintrack_api/services/overview_services/db/overviewInvestmentRepository.js

// The figures of the Investment card (V1-V5 and the closure adjustment), in
// ONE query.
//
// They are readings of the same account set, and the card publishes an
// accounting identity over four of them — capitalContributed + realizedPnl +
// closureAdjustment = ledgerBalance (§6). Figures that must add up cannot come
// from separate round trips with writes able to land between them, or the card
// would show an identity that does not hold and no way to tell why.
//
// The closure adjustment is the sixth figure and the newest. It exists because
// the identity had two terms over a balance holding three kinds of row, so the
// card told every owner who had ever deleted an investment account that their
// books were inconsistent.
//
// R211: movement_type_id 3 (investment) is dead — no write path produces it, and
// the local probe found zero rows of it. Contributions and withdrawals are
// written as transfers, so V1 reads movement types 6 and 8 and never 3. Reading
// 3 would return 0 for every user and look like an account nobody funded.

import {
 ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID,
 ACCOUNT_OPENING_MOVEMENT_TYPE_ID,
 PNL_MOVEMENT_TYPE_ID,
 TRANSFER_MOVEMENT_TYPE_ID,
} from './movementTypes.js';
import { toAmount } from '../../budget_services/core/money.js';
import { derivedAccountBalanceSql } from '../../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';
import { RTA_ANNULMENT_TARGET_PREFIX } from '../../../../utils/fintrackUtils/accountDeletionUtils/recordAnnulmentTransaction.js';

// NUMERIC, not FLOAT: capitalContributed, realizedPnl and closureAdjustment are
// NUMERIC sums of the same ledger, and the card publishes capitalContributed +
// realizedPnl + closureAdjustment = ledgerBalance. A float anchor breaks that
// identity by a cent and the card has no way to explain the difference.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

// Every figure in one statement.
//
// Every branch scopes itself to the same account id array and to the same cut,
// so the identity is stated over one set rather than several that could differ.
//
// V1 sums movement types 6 and 8. `amount` is signed per leg, so a withdrawal
// subtracts itself and the total is net capital moved, not gross deposits. The
// opening (8) belongs in it: money placed at account creation is capital the
// user contributed.
//
// V5 deliberately does NOT read type 8. The catalog's own null rule says a user
// with nothing beyond the opening has no contribution to date, which the formula
// as literally written could not produce — it would answer with the opening's
// date. V5 is a consistency signal, and opening an account once is not a habit.
//
// V3 carries R212's exclusion with the NULL guard the nullable description
// column requires: `NULL NOT LIKE ...` is NULL, and a FILTER drops it — which
// would silently lose a row from BOTH sums, not just from the realised one.
// Every figure is read at the reference month, and the five bindings that took
// go in together on purpose: bind the money and leave the age, and a closed month
// shows that month's balances beside an age measured from today.
//
// bounds carries both. next_month_start is the instant the month AFTER the
// reference begins in the owner's zone — R42, §4.5: the local timestamp converts
// to an instant to meet a TIMESTAMPTZ column. reference_date is the close of the
// month, or today when the month is still running, which is what LEAST says; the
// running month needs no branch because it is simply the earlier of the two.
//
// The balance subtracts forward from today rather than summing from zero, the
// same direction MONTHLY_BALANCE_QUERY takes, so the reference month subtracts
// nothing and equals the balance now. Per account, not aggregated, because
// largest_balance feeds the concentration figure and needs the rows.
//
// The realised result and the closure adjustment are one pass over one set of
// rows split two ways, and that is the point: the adjustment is DEFINED as the
// rows the realised term drops. Written as a second CTE with its own predicate,
// the two could drift apart under a later edit and the identity below would
// break with nothing to say why. Here it cannot: every profit-and-loss row and
// every account-closure row before the cut lands in exactly one of the two sums.
//
// Both movement types are read and the closure type is not swapped in for the
// other. A closure recorded before that type existed is a profit-and-loss row
// carrying the annulment prefix; those rows do not migrate, and the identity has
// to keep holding for every month that contains one.
//
// The term has two arms and they are fed by different writes, so the figure is
// not evidence about any one operation: a nonzero value does not identify which
// arm produced it, and a zero value does not prove no account was ever removed,
// since an account carrying no balance leaves no row in this table at all. The
// field keeps its contract name — renaming it is a contract change, not a
// comment — and this paragraph exists so a reader does not treat the amount as a
// count of anything.
//
// What a closure row is: deleting an account reverses the effect it had on the
// accounts it touched, writing a pair of rows - one on the affected account and
// its opposite on the internal counterparty. It is neither capital the owner put
// in nor a result the market produced, and it does move the balance, which is
// why a two-term identity over these accounts was never going to hold.
//
// Known limit, and now a published one: account_count is not bounded. An account
// opened after the reference month contributes 0 to the balance and still counts,
// and bounding it needs a creation date this query does not read. The card used
// to consume this figure only to choose between two notices, so the limit stayed
// internal; it is now a field of the card, which means a past month can report
// three accounts beside a balance built from the two that were open then.
// Bounding it is a change to THIS statement and not to the card.
const INVESTMENT_FIGURES_QUERY = `
  WITH bounds AS (
    SELECT
      (($3::date + INTERVAL '1 month') AT TIME ZONE $2) AS next_month_start,
      LEAST(
        (now() AT TIME ZONE $2)::date,
        ($3::date + INTERVAL '1 month' - INTERVAL '1 day')::date
      ) AS reference_date
  ),
  accounts AS (
    SELECT
      ua.account_id,
      ${DERIVED_BALANCE} - COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        WHERE t.account_id = ua.account_id
          AND t.transaction_actual_date >= (SELECT next_month_start FROM bounds)
      ), 0) AS derived_balance
    FROM user_accounts ua
    WHERE ua.account_id = ANY($1::int[])
  ),
  contributions AS (
    SELECT COALESCE(SUM(t.amount), 0) AS capital_contributed
    FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id IN (${TRANSFER_MOVEMENT_TYPE_ID}, ${ACCOUNT_OPENING_MOVEMENT_TYPE_ID})
      AND t.transaction_actual_date < (SELECT next_month_start FROM bounds)
  ),
  last_funding AS (
    SELECT MAX(t.transaction_actual_date) AS last_contribution
    FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id = ${TRANSFER_MOVEMENT_TYPE_ID}
      AND t.amount > 0
      AND t.transaction_actual_date < (SELECT next_month_start FROM bounds)
  ),
  -- ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID HAS NO WRITER LEFT AND STAYS ANYWAY.
  -- recordClosureSettlement.js:186 is the only code that ever wrote it, and its
  -- two imports are commented out (deleteAccountService.js:35, :1000) since
  -- CLOSE stopped moving money on 2026-09-08. Measured on fintrack_dev: zero
  -- transactions carry it, while sixteen carry the RTA prefix and every one of
  -- them is movement type 9.
  --
  -- So closure_adjustment is produced ENTIRELY by its second arm today, and the
  -- type is not what keeps the column alive. What the type still does is
  -- account for rows written before the settlement was retired. Dropping it
  -- would not remove a dead branch, it would stop counting those rows - a
  -- silent change to a published figure on any database that holds one, and
  -- this database's zero says nothing about another's.
  --
  -- The two arms answer different questions and neither substitutes for the
  -- other: an RTA-prefixed row is an annulment carrying the profit-and-loss
  -- type, and a type-10 row was a settlement that carried no prefix.
  realized AS (
    SELECT
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.movement_type_id = ${PNL_MOVEMENT_TYPE_ID}
          AND (t.description IS NULL
               OR t.description NOT LIKE '${RTA_ANNULMENT_TARGET_PREFIX}%')
      ), 0) AS realized_pnl,
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.movement_type_id = ${ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID}
           OR t.description LIKE '${RTA_ANNULMENT_TARGET_PREFIX}%'
      ), 0) AS closure_adjustment
    FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id IN (${PNL_MOVEMENT_TYPE_ID}, ${ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID})
      AND t.transaction_actual_date < (SELECT next_month_start FROM bounds)
  )
  SELECT
    (SELECT COUNT(*) FROM accounts) AS account_count,
    (SELECT COALESCE(SUM(derived_balance), 0) FROM accounts) AS ledger_balance,
    (SELECT MAX(derived_balance) FROM accounts) AS largest_balance,
    c.capital_contributed,
    r.realized_pnl,
    r.closure_adjustment,
    (b.reference_date - (f.last_contribution AT TIME ZONE $2)::date)
      AS days_since_last_contribution
  FROM contributions c
  CROSS JOIN realized r
  CROSS JOIN last_funding f
  CROSS JOIN bounds b
`;

// The portfolio distributed across its accounts, at the same cut as the card.
//
// It is the `accounts` CTE of the statement above with the name added, and that
// is deliberate rather than a duplication to fold away: the rows have to sum to
// the ledger balance the card publishes, and the surest way to guarantee that is
// for them to be the same expression at the same bound. Written as an
// independent statement it could differ by a predicate and the shares would sum
// to something other than one.
//
// A zero-balance account comes back as a row. An account the owner opened and
// emptied is a different situation from one they never had, and only a row can
// say so.
const INVESTMENT_BALANCE_BY_ACCOUNT_QUERY = `
  WITH bounds AS (
    SELECT (($3::date + INTERVAL '1 month') AT TIME ZONE $2) AS next_month_start
  )
  SELECT
    ua.account_id,
    ua.account_name,
    ${DERIVED_BALANCE} - COALESCE((
      SELECT SUM(t.amount)
      FROM transactions t
      WHERE t.account_id = ua.account_id
        AND t.transaction_actual_date >= (SELECT next_month_start FROM bounds)
    ), 0) AS balance
  FROM user_accounts ua
  WHERE ua.account_id = ANY($1::int[])
  ORDER BY ua.account_id
`;

// When money was put in, and how much each time — §4.4's series of EVENTS.
//
// The predicate is V5's, exactly: movement type transfer, positive amount, before
// the cut. It excludes the account opening for the reason V5 does — the catalog
// rules that an owner with nothing beyond the opening has made no contribution,
// and opening an account once is not a habit — so an empty history here and the
// card's "no contribution recorded" notice are the same condition rather than
// two that usually agree.
//
// Unbounded below, because a history bounded at thirteen months is not a history.
// Bounded above by the reference month like every other figure on this card, and
// bounded in SIZE by the caller's limit: an owner who funds weekly for a decade
// has a real history that no single response should try to carry, so the newest
// page of it is served and the count says what was left out.
const CONTRIBUTION_HISTORY_QUERY = `
  SELECT
    t.transaction_id,
    t.account_id,
    ua.account_name,
    t.amount AS amount,
    (t.transaction_actual_date AT TIME ZONE $2)::date::text AS contribution_date
  FROM transactions t
  -- LEFT, and for the same reason the allocations page states at
  -- overviewPocketRepository.js:129: this join supplies a label, and inner it
  -- dropped a closed account's contribution from the page while
  -- CONTRIBUTION_HISTORY_COUNT_QUERY, which touches only transactions, still
  -- counted the row.
  LEFT JOIN user_accounts ua ON ua.account_id = t.account_id
  WHERE t.account_id = ANY($1::int[])
    AND t.movement_type_id = ${TRANSFER_MOVEMENT_TYPE_ID}
    AND t.amount > 0
    AND t.transaction_actual_date < (($3::date + INTERVAL '1 month') AT TIME ZONE $2)
  ORDER BY t.transaction_actual_date DESC, t.transaction_id DESC
  LIMIT $4
`;

// How many events the page above was cut out of. A second statement over the
// same filter rather than a window function beside a limited page, the same
// choice every list in this module makes: a count computed beside a limited page
// is a count of the page.
const CONTRIBUTION_HISTORY_COUNT_QUERY = `
  SELECT COUNT(*) AS total_rows
  FROM transactions t
  WHERE t.account_id = ANY($1::int[])
    AND t.movement_type_id = ${TRANSFER_MOVEMENT_TYPE_ID}
    AND t.amount > 0
    AND t.transaction_actual_date < (($3::date + INTERVAL '1 month') AT TIME ZONE $2)
`;

/**
 * The raw figures behind the Investment card, read at the reference month.
 *
 * largestBalance comes back null only when the user has no investment account
 * at all; the caller turns that into V4's notice rather than into a 0, because a
 * concentration of 0 would read as "perfectly diversified" for someone who
 * invested nothing.
 *
 * daysSinceLastContribution is null when no funding transfer exists, which the
 * caller reports as its own notice for the same reason.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's investment accounts
 * @param {string} timeZone - IANA zone of the account owner
 * @param {string} referenceMonth - 'YYYY-MM-01', the month every figure is read at
 * @returns {Promise<{accountCount: number, ledgerBalance: number, largestBalance: number|null, capitalContributed: number, realizedPnl: number, closureAdjustment: number, daysSinceLastContribution: number|null}>}
 */
export async function getInvestmentFigures(pool, accountIds, timeZone = 'UTC', referenceMonth) {
 const { rows } = await pool.query(INVESTMENT_FIGURES_QUERY, [
  accountIds ?? [],
  timeZone,
  referenceMonth,
 ]);
 const row = rows[0] ?? {};

 return {
  accountCount: Number(row.account_count ?? 0),
  ledgerBalance: toAmount(row.ledger_balance ?? 0),
  largestBalance: row.largest_balance === null || row.largest_balance === undefined
   ? null
   : toAmount(row.largest_balance),
  capitalContributed: toAmount(row.capital_contributed ?? 0),
  realizedPnl: toAmount(row.realized_pnl ?? 0),
  closureAdjustment: toAmount(row.closure_adjustment ?? 0),
  daysSinceLastContribution: row.days_since_last_contribution === null
   || row.days_since_last_contribution === undefined
   ? null
   : Number(row.days_since_last_contribution),
 };
}

/**
 * The balance of each investment account at the close of the reference month.
 *
 * The rows sum to the ledger balance the card publishes, by construction rather
 * than by agreement: the expression and the bound are the ones that produced it.
 *
 * An empty accountIds returns an empty array, which the caller reports as an
 * absent portfolio rather than as a distribution over nothing.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's investment accounts
 * @param {string} timeZone - IANA zone of the account owner
 * @param {string} referenceMonth - 'YYYY-MM-01', the month the balances are read at
 * @returns {Promise<Array<{accountId: number, accountName: string, balance: number}>>}
 */
export async function getInvestmentBalanceByAccount(
 pool,
 accountIds,
 timeZone = 'UTC',
 referenceMonth,
) {
 const { rows } = await pool.query(INVESTMENT_BALANCE_BY_ACCOUNT_QUERY, [
  accountIds ?? [],
  timeZone,
  referenceMonth,
 ]);

 return rows.map((row) => ({
  accountId: row.account_id,
  accountName: row.account_name,
  balance: toAmount(row.balance ?? 0),
 }));
}

/**
 * The funding events on the investment accounts, newest first, and how many
 * exist in total.
 *
 * totalRows is the whole history and rows is the newest `limit` of it, so a
 * caller can say that the list is a page rather than the history. The two are
 * equal for every owner whose history fits, which is the ordinary case.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's investment accounts
 * @param {string} timeZone - IANA zone of the account owner
 * @param {string} referenceMonth - 'YYYY-MM-01', the cut every figure of this card shares
 * @param {number} limit - the most events this response will carry
 * @returns {Promise<{rows: Array<object>, totalRows: number}>}
 */
export async function getContributionHistory(
 pool,
 accountIds,
 timeZone = 'UTC',
 referenceMonth,
 limit,
) {
 const parameters = [accountIds ?? [], timeZone, referenceMonth];

 // Both statements in flight at once: the count does not depend on the page and
 // the page does not depend on the count.
 const [events, total] = await Promise.all([
  pool.query(CONTRIBUTION_HISTORY_QUERY, [...parameters, limit]),
  pool.query(CONTRIBUTION_HISTORY_COUNT_QUERY, parameters),
 ]);

 return {
  rows: events.rows.map((row) => ({
   transactionId: row.transaction_id,
   accountId: row.account_id,
   accountName: row.account_name,
   amount: toAmount(row.amount ?? 0),
   contributionDate: row.contribution_date,
  })),
  totalRows: Number(total.rows[0]?.total_rows ?? 0),
 };
}
