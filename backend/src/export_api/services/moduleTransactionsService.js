// backend/src/export_api/services/moduleTransactionsService.js
//
// The detail rows the budget, pocket and debt exports carry under their summary.
//
// No SQL of its own. It reads through getTransactionsDataset, the same statement
// GET /api/export/movements and the period statement already use, so a closed
// account is named here exactly as it is named there — through
// COALESCE(ua.account_name, ar.account_name) at transactionRowShape.js:82. A
// second query resolving that name its own way is the outcome this avoids.
//
// One module per call and one account set per module: the caller passes the ids
// its own summary was computed over, so the rows underneath describe the same
// accounts as the totals above them.

import { createError } from '../../utils/errorHandling.js';
import {
 EXPORT_ROW_LIMIT,
 getTransactionsDataset,
} from '../db/transactionDatasetRepository.js';
import { toTransactionDataset } from '../core/toTransactionDataset.js';

/**
 * Read one module's transactions for one period, capped.
 *
 * The cap is the same signal statementExportService.js:104-107 uses: the row at
 * position LIMIT + 1 is never delivered, only its presence is read.
 *
 * An empty account set short-circuits to no rows rather than issuing a query
 * with an empty array, which ANY(ARRAY[]) would answer with nothing anyway.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client
 * @param {{from: (string|null), to: (string|null), accountIds: number[]}} scope -
 *  from/to as 'YYYY-MM-01'; `to` covers its whole month
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<object[]>} rows in TRANSACTIONS_DATASET_COLUMNS' keys
 */
export async function getModuleTransactionRows(
 pool,
 userId,
 { from, to, accountIds },
 timeZone = 'UTC',
) {
 if (!Array.isArray(accountIds) || accountIds.length === 0) {
  return [];
 }

 const rows = await getTransactionsDataset(
  pool,
  userId,
  { from, to, search: null, movementType: null, accountIds },
  timeZone,
  EXPORT_ROW_LIMIT + 1,
 );

 if (rows.length > EXPORT_ROW_LIMIT) {
  throw createError(
   422,
   `This period matches more than ${EXPORT_ROW_LIMIT} transactions. Narrow the period and try again.`,
  );
 }

 return toTransactionDataset(rows).rows;
}
