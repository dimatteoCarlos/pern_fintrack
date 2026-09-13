// backend/src/fintrack_api/services/overview_services/db/transactionRowShape.js
/**
 * The row shape the six transaction lists of this module serve.
 *
 * What this replaces. The six statements selected `tr.*`, which is not a shape
 * but whatever the transactions table holds on the day it runs. The frontend
 * type they answer to, MovementTransactionDataType in responseApiTypes.ts,
 * declares twenty-four fields; the wildcard emitted eight the type does not have
 * and omitted three it does. Both halves were invisible because nothing named
 * the fields anywhere the two could be compared.
 *
 * The eight it added were the six foreign-exchange columns, opening_for_account_id
 * and account_balance_after_tr. The last one mattered: three writers fill that
 * column with 0.00 deliberately, meaning "not persisted", while the account
 * detail endpoint publishes a value derived from the ledger under the identical
 * key. Two different numbers travelled the API under one name and this module
 * shipped the one that is not an answer.
 *
 * The three it omitted are the account's own opening figures, which come off the
 * user_accounts join every one of these statements already makes.
 *
 * Why a shared builder rather than the list written six times. The six differ
 * only in their WHERE and their pagination; the columns and the joins are
 * identical. Writing twenty-four names six times would put the same shape in six
 * places for a future field to be added to five of them.
 *
 * This does not cross the decision recorded at overviewTransactionRepository.js
 * that each page statement and its count statement stay whole and comparable.
 * That decision is about the filters, and the filters stay written out in every
 * statement. What moves here is only the part that must never differ.
 *
 * account_balance is the ledger derivation, not the stored column. Selecting
 * ua.account_balance shipped the same defect the module's own header describes
 * for account_balance_after_tr: a figure the write path maintains travelling
 * under the name every other endpoint uses for the figure the ledger produces.
 * The field is declared in MovementTransactionDataType, so it stays on the wire
 * and only its source changes. FLOAT and not NUMERIC because the declared type
 * is number and the driver hands NUMERIC over as a string.
 */

import { derivedAccountBalanceSql } from '../../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'FLOAT');

/**
 * The selected columns, in the order the declared type lists them.
 *
 * @param {string} timeZonePlaceholder - bind placeholder holding the IANA zone,
 *  which differs across the statements because their other parameters do
 * @returns {string} the SELECT list, without the SELECT keyword
 */
export function transactionRowColumns(timeZonePlaceholder) {
 if (!/^\$\d+$/.test(timeZonePlaceholder)) {
  throw new Error(
   `transactionRowColumns expects a bind placeholder such as '$2', received: ${timeZonePlaceholder}`,
  );
 }

 return `
    tr.transaction_id,
    tr.user_id,
    tr.description,
    tr.amount,
    tr.movement_type_id,
    tr.transaction_type_id,
    tr.currency_id,
    tr.account_id,
    tr.source_account_id,
    tr.destination_account_id,
    tr.status,
    tr.transaction_actual_date,
    tr.created_at,
    tr.updated_at,
    mt.movement_type_name,
    trt.transaction_type_name,
    act.account_type_name,
    cr.currency_code,
    -- A closed account's name survives on account_registry, stamped at closure.
    COALESCE(ua.account_name, ar.account_name) AS account_name,
    ua.account_type_id,
    ua.account_starting_amount,
    ${DERIVED_BALANCE} AS account_balance,
    ua.account_start_date,
    (tr.transaction_actual_date AT TIME ZONE ${timeZonePlaceholder})::date::text AS transaction_local_date,
    -- CLOSE deletes the user_accounts row, so its absence is the closure.
    (ua.account_id IS NULL) AS account_is_closed`;
}

// The tables the columns above come from. The account_types join is LEFT in
// every one of these statements and stays that way: it was LEFT before this
// module compared the type at all, so it was not written for the nullable case
// that migration 033 closed.
//
// The user_accounts join is LEFT for a different reason, and it has to be. CLOSE
// deletes that row while the transaction survives pointing at account_registry,
// so an INNER join dropped every movement of a closed account from the page
// while the count statement beside it - which touches only transactions - went
// on counting them, and the paginator offered a page that came back short. The
// account's own columns come back null for such a row, except its name.
//
// account_registry supplies that name and nothing else. It is LEFT for the same
// label-not-a-row reason, and keyed on its primary key it adds no row.
export const TRANSACTION_ROW_SOURCE = `
  FROM transactions tr
  JOIN movement_types mt ON mt.movement_type_id = tr.movement_type_id
  JOIN transaction_types trt ON trt.transaction_type_id = tr.transaction_type_id
  JOIN currencies cr ON cr.currency_id = tr.currency_id
  LEFT JOIN user_accounts ua ON ua.account_id = tr.account_id
  LEFT JOIN account_registry ar ON ar.account_id = tr.account_id
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id`;
