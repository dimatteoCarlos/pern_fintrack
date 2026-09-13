// src/fintrack_api/services/overview_services/db/incomeReversalSql.js

// An income reversal has no movement type of its own: it is a transfer whose
// destination is an income_source account, so the account type identifies it.
// The type is read through account_registry, so a closed source still nets.

import { TRANSFER_MOVEMENT_TYPE_ID } from './movementTypes.js';

/**
 * The predicate admitting an income reversal leg of the transactions alias.
 *
 * @param {string} alias - the transactions alias of the calling statement
 * @returns {string} a parenthesised SQL condition
 */
export function incomeReversalLeg(alias) {
 if (!/^[a-z_]+$/.test(alias)) {
  throw new Error(`incomeReversalLeg expects a table alias, received: ${alias}`);
 }

 return `(${alias}.movement_type_id = ${TRANSFER_MOVEMENT_TYPE_ID}
      AND ${alias}.destination_account_id IN (
       SELECT reg.account_id
       FROM account_registry reg
       LEFT JOIN user_accounts own ON own.account_id = reg.account_id
       JOIN account_types kind
         ON kind.account_type_id = COALESCE(own.account_type_id, reg.account_type_id)
       WHERE kind.account_type_name = 'income_source'
      ))`;
}
