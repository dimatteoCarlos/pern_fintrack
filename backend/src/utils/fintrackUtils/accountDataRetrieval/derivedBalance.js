// backend/src/utils/fintrackUtils/accountDataRetrieval/derivedBalance.js

/**
 * One arithmetic for the balance an account holds at a movement, shared by every
 * site that used to read the stored `transactions.account_balance_after_tr`.
 *
 * That column is a cache written once, at the instant of insertion. A movement
 * recorded on a past day lands in the middle of an existing series and does not
 * re-strike the rows after it, so every later row keeps a figure that no longer
 * matches its position. Deriving the balance from the ledger cannot go stale,
 * because there is nothing to keep in step.
 *
 * The derivation is the account's opening amount plus the running sum of its
 * movements, and **the row that opens this account is excluded from that sum**.
 * An account carries its opening in `user_accounts.account_starting_amount` and
 * again as an account-opening transaction; summing both counts it twice. It is
 * not an optimisation — measured on `fintrack_dev` 2026-08-30, the account
 * `Picapiedras, Pedro` holds a balance of 1.30 and the unfiltered sum gives 3.10,
 * the extra 1.80 being its opening amount counted a second time.
 *
 * **The exclusion is one row, not one movement type, and the difference is money.**
 * An account opened with funds carries its opening as a pair of equal and opposite
 * account-opening legs: a credit on the account being opened, and a debit on the
 * account that funded it. Only the credit duplicates the starting amount. The debit
 * is a real outflow the funding account has to keep, and excluding every row of the
 * type drops it. Measured on the same database: five such legs totalling 46.20 usd,
 * which a type-wide exclusion would report as money no account holds.
 *
 * **The row says which account it opens; the test does not guess it.** Until
 * migration 022 the test was whether the account was the *destination* of the
 * opening, which is a proxy for the direction the money moved. Both legs of an
 * opening pair carry the same destination, so it could not tell them apart: it
 * picked whichever leg's account happened to equal that shared destination. For
 * a debtor the user owes, the debtor is the source and the funding account the
 * destination, so the proxy inverted — the debtor counted its opening twice and
 * derived -12.48 against a starting amount of -6.24, and the funding account
 * silently lost a real 6.24 inflow. The controller that writes the row knows
 * which account it opens and now states it in `opening_for_account_id`, NULL on
 * every funding leg and on every ordinary movement. The movement type stays in
 * the test as a guard on the kind of row; the column is the authority on which
 * account.
 *
 * `transactions.amount` is stored signed, so the sum needs no per-type sign rule.
 *
 * The window orders by the movement's actual date and breaks ties on
 * transaction_id, the same ordering the month's cumulative-spend figure already
 * uses, so a back-dated insert relocates itself in the series instead of being
 * appended to it.
 */

// movement_types.movement_type_id, the 'account-opening' row.
export const ACCOUNT_OPENING_MOVEMENT_TYPE_ID = 8;

/**
 * A common table expression naming, for every movement of one account, the
 * balance that account holds once that movement has been applied.
 *
 * It is a CTE over the account's whole life rather than an expression inside the
 * caller's query on purpose: a window function only sees the rows its own query
 * returns, and every caller here filters to a period. Anchoring the series on the
 * period's first row would restart the balance at each window.
 *
 * The caller joins it on `transaction_id` and reads `balance`.
 *
 * @param {string} [accountIdPlaceholder] - The bind placeholder holding the account id, e.g. '$1'
 * @returns {string} - The CTE body, to follow a `WITH`
 */
export function accountLedgerCte(accountIdPlaceholder = '$1') {
 // Interpolated into SQL, so it is restricted to a bind placeholder and can
 // never carry a value. The values themselves stay bound by the caller.
 if (!/^\$\d+$/.test(accountIdPlaceholder)) {
  throw new Error(
   `accountLedgerCte expects a bind placeholder such as '$1', received: ${accountIdPlaceholder}`,
  );
 }

 return `
      account_ledger AS (${ledgerBody(accountIdPlaceholder)})`;
}

/**
 * The same series, for the account a given transaction belongs to.
 *
 * The single-movement detail is addressed by transaction id and never names an
 * account, so it cannot use the CTE above. Resolving the account here rather
 * than in a prior round trip keeps the detail one statement, and the user id is
 * carried into the lookup so a transaction of another owner resolves to no
 * account instead of to that owner's ledger.
 *
 * @param {string} transactionIdPlaceholder - The bind placeholder holding the transaction id
 * @param {string} userIdPlaceholder - The bind placeholder holding the owner's id
 * @returns {string} - Two CTE bodies, to follow a `WITH`
 */
export function accountLedgerCteForTransaction(
 transactionIdPlaceholder,
 userIdPlaceholder,
) {
 for (const placeholder of [transactionIdPlaceholder, userIdPlaceholder]) {
  if (!/^\$\d+$/.test(placeholder)) {
   throw new Error(
    `accountLedgerCteForTransaction expects bind placeholders such as '$1', received: ${placeholder}`,
   );
  }
 }

 return `
      ledger_account AS (
        SELECT
          tr.account_id
        FROM
          transactions tr
        WHERE
          tr.transaction_id = ${transactionIdPlaceholder}
          AND tr.user_id = ${userIdPlaceholder}
      ),
      account_ledger AS (${ledgerBody('(SELECT account_id FROM ledger_account)')})`;
}

/**
 * The balance every account of one owner holds right now, as one grouped pass.
 *
 * The two builders above answer "what did this account hold at each of its
 * movements", which is a running window and costs one computation per account.
 * A list of accounts asks a different question — "what does each hold now" — and
 * only ever wants the last point of each series. Asking it as a grouped sum
 * answers for every account of the owner in a single pass, and it is the shape
 * an ORDER BY over the balance needs, since the figure has to exist before the
 * sort rather than per row.
 *
 * The arithmetic is identical to the series': the opening amount, plus every
 * movement except the row that opens the account itself. LEFT JOIN so an account
 * with no movements still reports its opening amount instead of dropping out.
 *
 * The caller joins it on `account_id` and reads `balance`.
 *
 * @param {string} [userIdPlaceholder] - The bind placeholder holding the owner's id
 * @returns {string} - The CTE body, to follow a `WITH`
 */
export function userAccountBalancesCte(userIdPlaceholder = '$1') {
 if (!/^\$\d+$/.test(userIdPlaceholder)) {
  throw new Error(
   `userAccountBalancesCte expects a bind placeholder such as '$1', received: ${userIdPlaceholder}`,
  );
 }

 return `
      account_balances AS (
        SELECT
          ua.account_id,
          CAST(
            ua.account_starting_amount
            + COALESCE(SUM(
                CASE WHEN tr.movement_type_id = ${ACCOUNT_OPENING_MOVEMENT_TYPE_ID}
                       AND tr.account_id = tr.opening_for_account_id
                  THEN 0 ELSE tr.amount END
              ), 0)
          AS FLOAT) AS balance
        FROM
          user_accounts ua
        LEFT JOIN
          transactions tr ON tr.account_id = ua.account_id
        WHERE
          ua.user_id = ${userIdPlaceholder}
        GROUP BY
          ua.account_id, ua.account_starting_amount
      )`;
}

/**
 * The balance one account holds now, as a scalar expression correlated to a row
 * of `user_accounts` that the caller's query already has.
 *
 * Same arithmetic as the two builders above; what differs is where it can be
 * used. A list query that already selects from `user_accounts` substitutes this
 * for the stored column and needs no `WITH` and no join — which matters when the
 * substitution has to be made in nine queries whose shapes differ, because a
 * textual replacement cannot mis-join a query it does not restructure.
 *
 * It costs one correlated pass per row against the grouped builder's single
 * pass. **Order by the output column's name rather than by this expression**
 * wherever the sort is a bare balance, so the figure is computed once.
 *
 * `castAs` is the caller's, because the two consumers need different types. A
 * screen reads a number, so `FLOAT` is right there. Money arithmetic must not
 * pass through a float — the pocket module hands this figure to a decimal
 * library and compares it against a committed total — so that caller asks for
 * `NUMERIC` and keeps every cent it was stored with.
 *
 * @param {string} [accountAlias] - The alias of `user_accounts` in the caller's query
 * @param {'FLOAT'|'NUMERIC'} [castAs] - The type the expression yields
 * @returns {string} - A parenthesised scalar SQL expression
 */
export function derivedAccountBalanceSql(accountAlias = 'ua', castAs = 'FLOAT') {
 // Interpolated into SQL, so it is restricted to a bare identifier.
 if (!/^[a-z_][a-z0-9_]*$/i.test(accountAlias)) {
  throw new Error(
   `derivedAccountBalanceSql expects a table alias, received: ${accountAlias}`,
  );
 }

 if (castAs !== 'FLOAT' && castAs !== 'NUMERIC') {
  throw new Error(
   `derivedAccountBalanceSql expects 'FLOAT' or 'NUMERIC', received: ${castAs}`,
  );
 }

 return `(
        SELECT CAST(
          ${accountAlias}.account_starting_amount
          + COALESCE(SUM(
              CASE WHEN tr.movement_type_id = ${ACCOUNT_OPENING_MOVEMENT_TYPE_ID}
                     AND tr.account_id = tr.opening_for_account_id
                THEN 0 ELSE tr.amount END
            ), 0)
        AS ${castAs})
        FROM transactions tr
        WHERE tr.account_id = ${accountAlias}.account_id
      )`;
}

/**
 * The series itself. Private, so the account id it reads is only ever one of the
 * two forms the exported builders construct.
 *
 * @param {string} accountIdSql - A bind placeholder, or the ledger_account subquery
 * @returns {string}
 */
function ledgerBody(accountIdSql) {
 return `
        SELECT
          tr.transaction_id,
          tr.transaction_actual_date,
          CAST(
            ua.account_starting_amount
            + SUM(
                CASE WHEN tr.movement_type_id = ${ACCOUNT_OPENING_MOVEMENT_TYPE_ID}
                       AND tr.account_id = tr.opening_for_account_id
                  THEN 0 ELSE tr.amount END
              ) OVER (
                ORDER BY tr.transaction_actual_date ASC, tr.transaction_id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              )
          AS FLOAT) AS balance
        FROM
          transactions tr
        JOIN
          user_accounts ua ON ua.account_id = tr.account_id
        WHERE
          tr.account_id = ${accountIdSql}
      `;
}

/**
 * Put the derived figure on the wire under the name the stored column used.
 *
 * The account list renders this field by its raw name, so the derivation stays
 * backend-only and no frontend file changes. The alias the queries select it
 * under is dropped here rather than shipped beside the value it replaces, so a
 * reader cannot pick the stale one by mistake.
 *
 * @param {Array<Object>} rows - Rows carrying `derived_balance_after_tr`
 * @returns {Array<Object>}
 */
export function withDerivedBalance(rows) {
 return rows.map(({ derived_balance_after_tr, ...row }) => ({
  ...row,
  account_balance_after_tr: derived_balance_after_tr,
 }));
}
