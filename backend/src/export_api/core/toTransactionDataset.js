// backend/src/export_api/core/toTransactionDataset.js
//
// Turns transactionDatasetRepository rows into the { columns, rows, meta }
// shape core/writers/ represents. No FinTrack import (architecture rule 4,
// PLAN_EXPORT.md §2): it reads the row object the repository already built
// and renames fields, computing nothing.

// The `transactions` dataset columns, PLAN_EXPORT.md §4, in the order a
// reader would want them: identity, then direction, then the money, then FX
// traceability, then the note.
export const TRANSACTIONS_DATASET_COLUMNS = [
 { key: 'date', label: 'Date', type: 'date' },
 { key: 'transactionId', label: 'Transaction ID', type: 'number' },
 { key: 'movementType', label: 'Movement type', type: 'text' },
 { key: 'direction', label: 'Direction', type: 'text' },
 { key: 'account', label: 'Account', type: 'text' },
 { key: 'sourceAccount', label: 'Source account', type: 'text' },
 { key: 'destinationAccount', label: 'Destination account', type: 'text' },
 { key: 'amount', label: 'Amount', type: 'number' },
 { key: 'currency', label: 'Currency', type: 'text' },
 { key: 'originalAmount', label: 'Original amount', type: 'number' },
 { key: 'originalCurrency', label: 'Original currency', type: 'text' },
 { key: 'exchangeRate', label: 'Exchange rate', type: 'number' },
 { key: 'rateSource', label: 'Rate source', type: 'text' },
 { key: 'rateDate', label: 'Rate date', type: 'date' },
 { key: 'note', label: 'Note', type: 'text' },
 { key: 'accountClosed', label: 'Account closed', type: 'boolean' },
];

/**
 * @param {object[]} rows - rows from transactionDatasetRepository.getTransactionsDataset
 * @param {Record<string, string|number>} [meta] - generatedAt, period, filters,
 *  row count; never userId (PLAN_EXPORT.md §11)
 * @returns {{columns: object[], rows: object[], meta: object}}
 */
export function toTransactionDataset(rows, meta = {}) {
 return {
  columns: TRANSACTIONS_DATASET_COLUMNS,
  rows: rows.map((row) => ({
   date: row.transaction_local_date,
   transactionId: row.transaction_id,
   movementType: row.movement_type_name,
   direction: row.transaction_type_name,
   account: row.account_name,
   sourceAccount: row.source_account_name,
   destinationAccount: row.destination_account_name,
   amount: row.amount,
   currency: row.currency_code,
   originalAmount: row.original_amount,
   originalCurrency: row.original_currency_code,
   exchangeRate: row.exchange_rate,
   rateSource: row.exchange_rate_source,
   rateDate: row.exchange_rate_timestamp,
   note: row.note,
   accountClosed: row.account_is_closed,
  })),
  meta,
 };
}
