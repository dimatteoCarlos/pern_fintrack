// src/fintrack_api/services/overview_services/db/overviewInvestmentRepository.js

// The five figures of the Investment card (V1-V5), in ONE query.
//
// They are five readings of the same account set, and the card publishes an
// accounting identity over three of them — capitalContributed + realizedPnl =
// ledgerBalance (§6). Three figures that must add up cannot come from three
// round trips with writes able to land between them, or the card would show an
// identity that does not hold and no way to tell why.
//
// The card of §6 carries no period. V1 is capital moved as of now, V2 is the
// balance as of now, V3 defaults to full history and V4/V5 are as of now, so
// nothing here is bounded by the month the request names. The reference month
// bounds only the transaction list beside the card.
//
// R211: movement_type_id 3 (investment) is dead — no write path produces it, and
// the local probe found zero rows of it. Contributions and withdrawals are
// written as transfers, so V1 reads movement types 6 and 8 and never 3. Reading
// 3 would return 0 for every user and look like an account nobody funded.

import { toAmount } from '../../budget_services/core/money.js';

// V1-V5 in one statement.
//
// Every branch scopes itself to the same account id array, so the identity
// V1 + V3 = V2 is stated over one set rather than three that could differ.
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
// column requires: `NULL NOT LIKE ...` is NULL, and a WHERE drops it.
const INVESTMENT_FIGURES_QUERY = `
  WITH accounts AS (
    SELECT ua.account_id, ua.account_balance
    FROM user_accounts ua
    WHERE ua.account_id = ANY($1::int[])
  ),
  contributions AS (
    SELECT COALESCE(SUM(t.amount), 0) AS capital_contributed
    FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id IN (6, 8)
  ),
  last_funding AS (
    SELECT MAX(t.transaction_actual_date) AS last_contribution
    FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id = 6
      AND t.amount > 0
  ),
  realized AS (
    SELECT COALESCE(SUM(t.amount), 0) AS realized_pnl
    FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id = 9
      AND (t.description IS NULL OR t.description NOT LIKE 'RTA Annulment Target(%')
  )
  SELECT
    (SELECT COUNT(*) FROM accounts) AS account_count,
    (SELECT COALESCE(SUM(account_balance), 0) FROM accounts) AS ledger_balance,
    (SELECT MAX(account_balance) FROM accounts) AS largest_balance,
    c.capital_contributed,
    r.realized_pnl,
    ((now() AT TIME ZONE $2)::date - (f.last_contribution AT TIME ZONE $2)::date)
      AS days_since_last_contribution
  FROM contributions c
  CROSS JOIN realized r
  CROSS JOIN last_funding f
`;

/**
 * The raw figures behind the Investment card, as of now.
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
 * @returns {Promise<{accountCount: number, ledgerBalance: number, largestBalance: number|null, capitalContributed: number, realizedPnl: number, daysSinceLastContribution: number|null}>}
 */
export async function getInvestmentFigures(pool, accountIds, timeZone = 'UTC') {
 const { rows } = await pool.query(INVESTMENT_FIGURES_QUERY, [accountIds ?? [], timeZone]);
 const row = rows[0] ?? {};

 return {
  accountCount: Number(row.account_count ?? 0),
  ledgerBalance: toAmount(row.ledger_balance ?? 0),
  largestBalance: row.largest_balance === null || row.largest_balance === undefined
   ? null
   : toAmount(row.largest_balance),
  capitalContributed: toAmount(row.capital_contributed ?? 0),
  realizedPnl: toAmount(row.realized_pnl ?? 0),
  daysSinceLastContribution: row.days_since_last_contribution === null
   || row.days_since_last_contribution === undefined
   ? null
   : Number(row.days_since_last_contribution),
 };
}
