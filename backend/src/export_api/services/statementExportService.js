// backend/src/export_api/services/statementExportService.js
//
// Orchestrates GET /api/export/statement for both writers: the four-sheet
// XLSX workbook (Executive Summary, Transactions, Accounts & Balances,
// Metadata & Audit) and the multi-page PDF (PLAN_EXPORT.md §7). Mirrors
// transactionExportService.js's shape (dataset build -> writer -> filename
// -> {buffer, filename, contentType, rowCount}); no financial logic of its
// own (architecture rule 1) - every figure here was already computed by
// statementService.js, statementReportService.js, accountsAndBalancesRepository.js
// or transactionDatasetRepository.js, the same readers V1 and the Executive
// Summary already use.

import { createError } from '../../utils/errorHandling.js';
import { statementService } from './statementService.js';
import { getStatementReportData } from './statementReportService.js';
import {
 EXPORT_ROW_LIMIT,
 getTransactionsDataset,
} from '../db/transactionDatasetRepository.js';
import { getAccountsAndBalances } from '../db/accountsAndBalancesRepository.js';
import { toTransactionDataset, TRANSACTIONS_DATASET_COLUMNS } from '../core/toTransactionDataset.js';
import { statementFileName } from '../core/exportFileName.js';
import { writeXlsxWorkbook } from '../core/writers/writeXlsx.js';
import { writeStatementPdf } from '../core/writers/writePdf.js';
import { KNOWN_LIMITS } from '../core/knownLimits.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../fintrack_api/config/fintrackConfig.js';

const CONTENT_TYPES = {
 xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 pdf: 'application/pdf',
};

const EXECUTIVE_SUMMARY_COLUMNS = [
 { key: 'metric', label: 'Metric', type: 'text' },
 { key: 'month', label: 'Month', type: 'number' },
 { key: 'yearToDate', label: 'Year to date', type: 'number' },
 { key: 'notices', label: 'Notices', type: 'text' },
];

// statementService.js publishes each row keyed by its internal metric name
// (composeExecutiveSummaryRows); this is the one place that name becomes the
// label a reader of the file sees. writePdf.js keeps its own copy of the
// same labels, since a PDF tile is not a spreadsheet row and reads only four
// of the twelve.
const METRIC_LABELS = {
 income: 'Income',
 expenses: 'Expenses',
 netMonthlyFlow: 'Net monthly flow',
 savingsRate: 'Savings rate',
 netWorth: 'Net worth',
 liquidNetWorth: 'Liquid net worth',
 cashPosition: 'Cash position',
 freeCash: 'Free cash',
 netDebtPosition: 'Net debt position',
 receivable: 'Receivable',
 payable: 'Payable',
 pocketsCommitted: 'Committed in pockets',
};

const ACCOUNTS_AND_BALANCES_COLUMNS = [
 { key: 'accountId', label: 'Account ID', type: 'number' },
 { key: 'accountName', label: 'Account', type: 'text' },
 { key: 'accountType', label: 'Type', type: 'text' },
 { key: 'currency', label: 'Currency', type: 'text' },
 { key: 'balance', label: 'Balance', type: 'number' },
];

const METADATA_COLUMNS = [
 { key: 'field', label: 'Field', type: 'text' },
 { key: 'value', label: 'Value', type: 'text' },
];

const buildExecutiveSummaryRows = (rows) =>
 rows.map((row) => ({
  metric: METRIC_LABELS[row.metric] ?? row.metric,
  month: row.month,
  yearToDate: row.yearToDate,
  notices: row.notices.join(' '),
 }));

const buildMetadataRows = ({ generatedAt, referenceMonth, timeZone, transactionRowCount }) => [
 { field: 'Generated', value: generatedAt },
 { field: 'Period', value: referenceMonth.slice(0, 7) },
 { field: 'Time zone', value: timeZone },
 { field: 'Accounting currency', value: ACCOUNTING_CURRENCY_CODE },
 { field: 'Transaction rows', value: String(transactionRowCount) },
 ...KNOWN_LIMITS.map((text, index) => ({ field: `Note ${index + 1}`, value: text })),
];

/**
 * The reference month's transactions, read the same way for either writer:
 * the PDF's Metadata/notices need the row count and the row-limit guard even
 * though the PDF prints no transaction table of its own.
 */
const getBoundedTransactionRows = async (pool, userId, referenceMonth, timeZone) => {
 const rows = await getTransactionsDataset(
  pool,
  userId,
  { from: referenceMonth, to: referenceMonth, search: null, movementType: null, accountIds: null },
  timeZone,
  EXPORT_ROW_LIMIT + 1,
 );
 // Same signal V1 uses: the row at position LIMIT + 1 is never delivered,
 // only its presence is read (PLAN_EXPORT.md §8).
 if (rows.length > EXPORT_ROW_LIMIT) {
  throw createError(422, `This month matches more than ${EXPORT_ROW_LIMIT} rows. Narrow the period and try again.`);
 }
 return rows;
};

const buildXlsx = async (pool, userId, { window }, timeZone, generatedAt) => {
 const { referenceMonth } = window;

 const [executiveSummary, transactionRows, accountsAndBalances] = await Promise.all([
  statementService.getExecutiveSummary(pool, userId, { window }, timeZone),
  getBoundedTransactionRows(pool, userId, referenceMonth, timeZone),
  getAccountsAndBalances(pool, userId, referenceMonth, timeZone),
 ]);

 const transactionsDataset = toTransactionDataset(transactionRows);

 const sheets = [
  {
   name: 'Executive Summary',
   columns: EXECUTIVE_SUMMARY_COLUMNS,
   rows: buildExecutiveSummaryRows(executiveSummary),
  },
  {
   name: 'Transactions',
   columns: TRANSACTIONS_DATASET_COLUMNS,
   rows: transactionsDataset.rows,
  },
  {
   name: 'Accounts & Balances',
   columns: ACCOUNTS_AND_BALANCES_COLUMNS,
   rows: accountsAndBalances,
  },
  {
   name: 'Metadata & Audit',
   columns: METADATA_COLUMNS,
   rows: buildMetadataRows({
    generatedAt: generatedAt.toISOString(),
    referenceMonth,
    timeZone,
    transactionRowCount: transactionRows.length,
   }),
  },
 ];

 const buffer = await writeXlsxWorkbook(sheets);

 return { buffer, rowCount: transactionRows.length };
};

const buildPdf = async (pool, userId, { window }, timeZone, generatedAt) => {
 const { referenceMonth } = window;

 const [reportData, transactionRows] = await Promise.all([
  getStatementReportData(pool, userId, { window }, timeZone),
  getBoundedTransactionRows(pool, userId, referenceMonth, timeZone),
 ]);

 const buffer = await writeStatementPdf(reportData, { generatedAt, timeZone });

 return { buffer, rowCount: transactionRows.length };
};

/**
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {{window: object}} request - the resolved reporting window
 *  (makeReportingWindow's shape; only `referenceMonth` is read here)
 * @param {string} timeZone - IANA zone of the account owner
 * @param {'xlsx'|'pdf'} format
 * @param {string} username - name of the account owner, for the filename
 * @returns {Promise<{buffer: Buffer, filename: string, contentType: string, rowCount: number}>}
 */
export async function exportStatement(pool, userId, { window }, timeZone, format = 'xlsx', username) {
 const generatedAt = new Date();

 const { buffer, rowCount } = format === 'pdf'
  ? await buildPdf(pool, userId, { window }, timeZone, generatedAt)
  : await buildXlsx(pool, userId, { window }, timeZone, generatedAt);

 const filename = statementFileName({ referenceMonth: window.referenceMonth, format, username });

 return {
  buffer,
  filename,
  contentType: CONTENT_TYPES[format],
  rowCount,
 };
}
