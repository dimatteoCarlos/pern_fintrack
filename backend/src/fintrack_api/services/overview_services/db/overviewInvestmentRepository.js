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
// The closure adjustment is the newest of them. It exists because the identity
// had two terms over a balance holding three kinds of row, so the card told
// every owner who had ever deleted an investment account that their books were
// inconsistent.
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
import { derivedAccountBalanceSql } from '../../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';
import { RTA_ANNULMENT_TARGET_PREFIX } from '../../../../utils/fintrackUtils/accountDeletionUtils/recordAnnulmentTransaction.js';

// NUMERIC, not FLOAT: capitalContributed, realizedPnl and closureAdjustment are
// NUMERIC sums of the same ledger, and the card publishes capitalContributed +
// realizedPnl + closureAdjustment = ledgerBalance. A float anchor breaks that
// identity by a cent and the card has no way to explain the difference.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

// Every figure in one statement.
//
// Every branch scopes itself to the same account id array, so the identity is
// stated over one set rather than several that could differ.
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
//
// The realised result and the closure adjustment are one pass over one set of
// rows split two ways, and that is the point: the adjustment is DEFINED as the
// rows the realised term drops. Written as a second CTE with its own predicate,
// the two could drift apart under a later edit and the identity below would
// break with nothing to say why. Here it cannot: every row of movement type 9
// lands in exactly one of the two sums.
//
// What a closure row is: deleting an account reverses the effect it had on the
// accounts it touched, writing a pair of rows - one on the affected account and
// its opposite on the internal counterparty. It is neither capital the owner put
// in nor a result the market produced, and it does move the balance, which is
// why a two-term identity over these accounts was never going to hold.
const INVESTMENT_FIGURES_QUERY = `
  WITH accounts AS (
    SELECT ua.account_id, ${DERIVED_BALANCE} AS account_balance
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
    SELECT
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.description IS NULL
           OR t.description NOT LIKE '${RTA_ANNULMENT_TARGET_PREFIX}%'
      ), 0) AS realized_pnl,
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.description LIKE '${RTA_ANNULMENT_TARGET_PREFIX}%'
      ), 0) AS closure_adjustment
    FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id = 9
  )
  SELECT
    (SELECT COUNT(*) FROM accounts) AS account_count,
    (SELECT COALESCE(SUM(account_balance), 0) FROM accounts) AS ledger_balance,
    (SELECT MAX(account_balance) FROM accounts) AS largest_balance,
    c.capital_contributed,
    r.realized_pnl,
    r.closure_adjustment,
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
 * @returns {Promise<{accountCount: number, ledgerBalance: number, largestBalance: number|null, capitalContributed: number, realizedPnl: number, closureAdjustment: number, daysSinceLastContribution: number|null}>}
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
  closureAdjustment: toAmount(row.closure_adjustment ?? 0),
  daysSinceLastContribution: row.days_since_last_contribution === null
   || row.days_since_last_contribution === undefined
   ? null
   : Number(row.days_since_last_contribution),
 };
}
