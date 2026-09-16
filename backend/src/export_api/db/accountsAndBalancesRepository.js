// backend/src/export_api/db/accountsAndBalancesRepository.js
//
// One row per open account, with its ledger-derived balance at the close of
// one reference month (PLAN_EXPORT.md §9: "the ledger-derived balance
// (derivedAccountBalanceSql), never the stored account_balance").
//
// The Export module's own repository, not a reuse of getAccountController.js's
// inline `all` query: that one has no month bound (always "now") and is
// written inside a controller rather than exported. This file applies the
// same month-close subtraction overviewPageRepository.js's BANK_BALANCE_QUERY
// applies inside a SUM, per row instead of aggregated across accounts.

import { derivedAccountBalanceSql } from '../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';
import { NOT_BOUNDARY_ACCOUNT } from '../../utils/fintrackUtils/accountDataRetrieval/accountUtils.js';
import { toAmount } from '../../fintrack_api/services/budget_services/core/money.js';

const DERIVED_BALANCE = derivedAccountBalanceSql('ua');

const ACCOUNTS_AND_BALANCES_QUERY = `
  WITH bounds AS (
    SELECT (($2::date + INTERVAL '1 month') AT TIME ZONE $3) AS next_month_start
  )
  SELECT
    ua.account_id,
    ua.account_name,
    act.account_type_name,
    ct.currency_code,
    CAST(
      ${DERIVED_BALANCE}
      - COALESCE((
          SELECT SUM(t.amount)
          FROM transactions t
          WHERE t.account_id = ua.account_id
            AND t.transaction_actual_date >= (SELECT next_month_start FROM bounds)
        ), 0)
    AS FLOAT) AS balance
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  JOIN currencies ct ON ct.currency_id = ua.currency_id
  WHERE ua.user_id = $1
    AND ua.deleted_at IS NULL
    AND ua.closed_at IS NULL
    AND act.account_type_name IN ('bank', 'cash', 'investment', 'debtor')
  ORDER BY act.account_type_name ASC, ua.account_name ASC
`;

/**
 * Every open account the user holds, with its balance at the close of
 * `referenceMonth` — never today's balance for a statement about a past
 * month. Excludes the boundary (compensation) account, the same exclusion
 * every other statement figure applies.
 *
 * @param {object} pool
 * @param {string} userId
 * @param {string} referenceMonth - 'YYYY-MM-01'
 * @param {string} timeZone
 * @returns {Promise<Array<{accountId: number, accountName: string,
 *  accountType: string, currency: string, balance: number}>>}
 */
export async function getAccountsAndBalances(pool, userId, referenceMonth, timeZone) {
 const { rows } = await pool.query(ACCOUNTS_AND_BALANCES_QUERY, [
  userId,
  referenceMonth,
  timeZone,
 ]);

 return rows.map((row) => ({
  accountId: row.account_id,
  accountName: row.account_name,
  accountType: row.account_type_name,
  currency: row.currency_code,
  balance: toAmount(row.balance ?? 0),
 }));
}
