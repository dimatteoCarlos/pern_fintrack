// Contract tests for export_api/core/toTransactionDataset.js.

import test from 'node:test';
import assert from 'node:assert/strict';

import { toTransactionDataset } from '../../src/export_api/core/toTransactionDataset.js';

const rawRow = {
 transaction_local_date: '2026-09-01',
 transaction_id: 42,
 movement_type_name: 'expense',
 transaction_type_name: 'debit',
 account_name: 'Groceries',
 source_account_name: '',
 destination_account_name: '',
 amount: '-45.50',
 currency_code: 'usd',
 original_amount: '-45.50',
 original_currency_code: 'usd',
 exchange_rate: '1.00000000',
 exchange_rate_source: 'identity',
 exchange_rate_timestamp: '2026-09-01T12:00:00.000Z',
 note: 'Weekly shopping',
 account_is_closed: false,
};

test('maps a repository row to the transactions dataset shape', () => {
 const dataset = toTransactionDataset([rawRow]);

 assert.equal(dataset.columns.length, 16);
 assert.deepEqual(dataset.rows[0], {
  date: '2026-09-01',
  transactionId: 42,
  movementType: 'expense',
  direction: 'debit',
  account: 'Groceries',
  sourceAccount: '',
  destinationAccount: '',
  amount: '-45.50',
  currency: 'usd',
  originalAmount: '-45.50',
  originalCurrency: 'usd',
  exchangeRate: '1.00000000',
  rateSource: 'identity',
  rateDate: '2026-09-01T12:00:00.000Z',
  note: 'Weekly shopping',
  accountClosed: false,
 });
});

test('carries meta through unchanged, and defaults it to an empty object', () => {
 assert.deepEqual(toTransactionDataset([]).meta, {});

 const meta = { generatedAt: '2026-09-15T00:00:00.000Z', rowCount: 0 };
 assert.equal(toTransactionDataset([], meta).meta, meta);
});
