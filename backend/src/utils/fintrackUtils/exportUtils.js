// backend/src/utils/fintrackUtils/exportUtils.js
// Export helpers for the Budget, Pocket and Debt modules. Pure functions, no I/O.
//
// THREE CONVERTERS, ONE ESCAPER. Carlos ruled on 2026-09-18 that pockets and
// debts are exported by their own modules and not by the period statement, so
// each one has its own converter and its own endpoint. What they share is the
// RFC 4180 escaping below, which must not be duplicated: the formula-injection
// guard is the kind of rule that gets fixed in one copy and left broken in the
// other two.

// The detail columns the movements export publishes. Imported and not restated:
// one definition of what a transaction row looks like in a file.
import { TRANSACTIONS_DATASET_COLUMNS } from '../../export_api/core/toTransactionDataset.js';
// The renderer the movements export already uses for those columns. Reused so a
// detail block here is escaped and formatted exactly as that file is.
import { writeCsv } from '../../export_api/core/writers/writeCsv.js';

// One Month column, not a Period Start / Period End pair: a row covers exactly
// one calendar month, so the end is the start and two columns would say the
// same thing twice on every line.
//
// Frequency stays, as a constant. The column is not information any more, but a
// file whose columns change between versions breaks whatever the user built on
// top of it, and "monthly" is the honest value.
const COLUMNS = [
 'Account Name',
 'Subcategory',
 'Currency',
 'Frequency',
 'Month',
 'Budgeted',
 'Spent',
 'Remaining',
 'Execution %',
];

const FREQUENCY = 'monthly';

/**
 * Escape one CSV text field per RFC 4180.
 *
 * A field is quoted only when it contains a delimiter, a quote, CR or LF;
 * embedded quotes are doubled. Skipping this turns any account name with a
 * comma into extra columns, which shifts every value to its right — a
 * corruption that produces a readable file rather than an error.
 *
 * For text fields only: a number is never routed through this function
 * (see escapeCsvNumberField) because a formatted amount cannot carry a
 * formula, and the guard below would otherwise turn a negative amount into
 * text by mistaking its leading "-" for a formula prefix.
 */
const escapeCsvField = (value) => {
 const raw = value === null || value === undefined ? '' : String(value);

 // CSV injection guard. Excel and Sheets evaluate a cell starting with
 // = + - @ (or tab / CR) as a formula, so an account named "=cmd|..." becomes
 // code execution on the machine that opens the export. Prefixing with a
 // single quote makes the spreadsheet treat it as text. The value the user
 // sees is unchanged.
 const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

 return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

// A formatted amount never contains a delimiter, a quote or CR/LF, so it
// never needs quoting; and it never needs the formula-injection guard either,
// since it is produced by toFixed, not read from user input. Routing it
// through escapeCsvField would prefix a negative value with "'", turning a
// numeric cell into text in Excel and Sheets.
const escapeCsvNumberField = (value) => value;

// toFixed on a non-number throws; the values are validated upstream by
// makeBudgetAccountStatus, but export must not be the place a bad value surfaces.
// executionPercentage is null when the budget is 0, and an empty cell is the
// right rendering of a percentage that does not exist — 0.00 would claim nothing
// was spent.
const formatAmount = (value) =>
 typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '';

// CRLF is the RFC 4180 line ending. Excel accepts LF, but some importers and
// every strict parser do not.
const CRLF = '\r\n';

// U+FEFF, the same mark writeCsv.js:57 prepends by default. It is what tells a
// spreadsheet the bytes are UTF-8 instead of its local code page.
const UTF8_BOM = '﻿';

// The response header the three module exports send, naming the character set
// the byte-order mark above already encodes, for readers that trust the header.
export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

/**
 * Join several tables into one comma-separated file.
 *
 * ONE EMPTY RECORD between blocks and nothing else. No marker line above a
 * block: the format defines no comment syntax, so a marker would be read as a
 * one-column data row rather than skipped by a parser.
 *
 * Declared once and used by all three writers, so a later change to the
 * convention is one line here and the three files cannot drift apart.
 *
 * The byte-order mark goes on here, once, because this is where a file first
 * exists. Without it a spreadsheet decodes the bytes in its local code page and
 * `Café` opens as `CafÃ©`.
 *
 * @param {string[]} blocks - each block already rendered, header row included
 * @returns {string}
 */
const joinCsvBlocks = (blocks) => `${UTF8_BOM}${blocks.join(`${CRLF}${CRLF}`)}`;

// A workbook sheet rendered as a comma-separated block, through the writer the
// movements export already uses. Passing the same { columns, rows } to both is
// what keeps a file's second block and its second sheet identical; the BOM is
// off because it belongs at the start of the file, which joinCsvBlocks owns.
const sheetToCsvBlock = ({ columns, rows }) => writeCsv({ columns, rows }, { bom: false });

/**
 * Convert a month series for a set of accounts to an RFC 4180 CSV document.
 *
 * One row per account per month, which is why the Month column now varies down
 * the file instead of repeating one value. A single-month export is the same
 * shape with a range of one.
 *
 * The movements that produced the spend follow as a second block, separated by
 * one empty record. Same blocks as the workbook's sheets and in the same order:
 * one control offers both formats, so neither may answer less than the other.
 *
 * @param {Array<object>} accountsSeries - entries of { accountName, subcategory,
 *  currency, months: BudgetMonthStatus[] } from budgetCalculationService.
 * @param {{rows: object[], window: {from: string, to: string}}} [detail] -
 *  the detail rows and the months they were read over
 * @returns {string} CSV text including the header row.
 */
export function convertSeriesToCSV(accountsSeries, detail) {
 const accounts = Array.isArray(accountsSeries) ? accountsSeries : [];

 const body = accounts.flatMap((account) =>
  // Every month of the requested range, including the ones that resolve to 0.
  // The caller asked for a range and the file answers the range.
  (Array.isArray(account.months) ? account.months : [])
   .map((m) =>
    [
     // The name rides on the series object. It used to come from a Map the
     // controller built alongside it, which meant two sources for one fact and
     // a blank cell whenever they disagreed.
     escapeCsvField(account.accountName ?? ''),
     // Read from category_budget_accounts. It used to be read off budgetPolicy,
     // which never carried it, so this column shipped empty on every export.
     escapeCsvField(account.subcategory ?? ''),
     // Upper case, as the pocket and debt writers already do: a currency code
     // is ISO 4217 and the three files are read side by side.
     escapeCsvField((account.currency ?? '').toUpperCase()),
     escapeCsvField(FREQUENCY),
     escapeCsvField(m.month),
     escapeCsvNumberField(formatAmount(m.budgetAmount)),
     escapeCsvNumberField(formatAmount(m.actualSpent)),
     escapeCsvNumberField(formatAmount(m.remainingBudget)),
     escapeCsvNumberField(formatAmount(m.executionPercentage)),
    ].join(','),
   ),
 );

 // Blocks two onward are the workbook's sheets two onward, rendered by the same
 // spec, so the two formats of one export cannot carry different detail.
 const [, ...detailSheets] = buildBudgetSeriesSheets(accountsSeries, detail);

 return joinCsvBlocks([
  [COLUMNS.join(','), ...body].join(CRLF),
  ...detailSheets.map(sheetToCsvBlock),
 ]);
}

// A percentage or a day count that the service withheld. Distinct from
// formatAmount because it must NOT force two decimals: daysRemaining is a whole
// number and 14.00 days is not a reading anyone wants.
const formatPlain = (value) =>
 value === null || value === undefined ? '' : String(value);

// One Sources column and not one row per funding account: the board carries a
// count, not the breakdown. A per-source file is a different grain and would be
// a different export.
const POCKET_COLUMNS = [
 'Pocket',
 'Currency',
 'Target',
 'Allocated',
 'Remaining',
 'Progress %',
 'Status',
 'Deadline',
 'Days Remaining',
 'Required Monthly',
 'Committed In Month',
 'Released In Month',
 'Funding Accounts',
 'Note',
];

/**
 * Convert a pocket board to an RFC 4180 CSV document. One row per pocket, in
 * the order the board returned them — the board is already sorted and a second
 * ordering here would disagree with the screen the reader exported from.
 *
 * The summary is deliberately absent. It is a fold of these same rows, and a
 * total inside a data file is a row a spreadsheet will sum a second time.
 *
 * The commit and release ledger follows as a second block, separated by one
 * empty record. Same blocks as the workbook's sheets and in the same order: one
 * control offers both formats, so neither may answer less than the other.
 *
 * @param {Array<object>} pockets - the `pockets` array of pocketBoardService.getBoard.
 * @param {Array<object>} [allocations] - getPocketHistoryForUser's rows
 * @returns {string} CSV text including the header row.
 */
export function convertPocketBoardToCSV(pockets, allocations) {
 const rows = Array.isArray(pockets) ? pockets : [];

 const body = rows.map((pocket) =>
  [
   escapeCsvField(pocket.name ?? ''),
   escapeCsvField((pocket.currency ?? '').toUpperCase()),
   escapeCsvNumberField(formatAmount(pocket.target)),
   escapeCsvNumberField(formatAmount(pocket.allocated)),
   // Negative when the pocket is over-funded. Not clamped: the excess is the
   // fact, and makePocketStatus says so on the field itself.
   escapeCsvNumberField(formatAmount(pocket.remaining)),
   escapeCsvNumberField(formatAmount(pocket.progress)),
   escapeCsvField(pocket.level ?? ''),
   escapeCsvField(pocket.desiredDate ?? ''),
   escapeCsvNumberField(formatPlain(pocket.daysRemaining)),
   // Null after the deadline, and an empty cell is the right rendering: the
   // remainder is not a monthly pace once the date has passed.
   escapeCsvNumberField(formatAmount(pocket.requiredMonthly)),
   escapeCsvNumberField(formatAmount(pocket.committedInMonth)),
   escapeCsvNumberField(formatAmount(pocket.releasedInMonth)),
   escapeCsvNumberField(formatPlain(pocket.sourceCount)),
   escapeCsvField(pocket.note ?? ''),
  ].join(','),
 );

 // Blocks two onward are the workbook's sheets two onward, rendered by the same
 // spec: here, the commit and release ledger.
 const [, ...detailSheets] = buildPocketBoardSheets(pockets, allocations);

 return joinCsvBlocks([
  [POCKET_COLUMNS.join(','), ...body].join(CRLF),
  ...detailSheets.map(sheetToCsvBlock),
 ]);
}

// Balance is signed as the analysis serves it: positive is owed TO the owner,
// negative is owed BY the owner. The Direction column states which, so the
// reader never has to infer the convention from the sign.
const DEBT_COLUMNS = [
 'Counterparty',
 'Direction',
 'Balance',
 'Currency',
 'As Of Month',
];

/**
 * Convert the per-counterparty debt analysis to an RFC 4180 CSV document. One
 * row per counterparty, in the order the analysis returned them.
 *
 * The month travels on every row rather than sitting in a preamble line,
 * because a CSV with a preamble is not a CSV any spreadsheet imports cleanly.
 *
 * @param {Array<object>} byCounterparty - entries of { accountName, direction, balance }.
 * @param {string} asOfMonth - 'YYYY-MM', the close the balances were read at.
 * The two figures month by month and the movements against the debtors follow
 * as two further blocks, separated by one empty record each. Same blocks as the
 * workbook's sheets and in the same order: one control offers both formats, so
 * neither may answer less than the other.
 *
 * @param {string} currency - the accounting currency the analysis reports in.
 * @param {Array<object>} [legsOverTime] - entries of { month, receivable, payable }
 * @param {{rows: object[], window: {from: string, to: string}}} [detail] -
 *  the detail rows and the months they were read over
 * @returns {string} CSV text including the header row.
 */
export function convertDebtAnalysisToCSV(
 byCounterparty,
 asOfMonth,
 currency,
 legsOverTime,
 detail,
) {
 const rows = Array.isArray(byCounterparty) ? byCounterparty : [];

 const body = rows.map((row) =>
  [
   escapeCsvField(row.accountName ?? ''),
   escapeCsvField(row.direction ?? ''),
   escapeCsvNumberField(formatAmount(row.balance)),
   escapeCsvField((currency ?? '').toUpperCase()),
   escapeCsvField(asOfMonth ?? ''),
  ].join(','),
 );

 // Blocks two onward are the workbook's sheets two onward, rendered by the same
 // spec: the two figures month by month, then the movements against the debtors.
 const [, ...detailSheets] = buildDebtAnalysisSheets(
  byCounterparty,
  legsOverTime,
  asOfMonth,
  currency,
  detail,
 );

 return joinCsvBlocks([
  [DEBT_COLUMNS.join(','), ...body].join(CRLF),
  ...detailSheets.map(sheetToCsvBlock),
 ]);
}

// The two formats both exports answer in, and the one a request that names none
// gets. Same pair and same default exportValidators.js:15-16 declares for the
// movements export, exported here so the two Zod schemas share one list instead
// of each carrying a copy that could gain a format the writers do not have.
export const EXPORT_FORMATS = ['csv', 'xlsx'];
export const DEFAULT_EXPORT_FORMAT = 'csv';

// The string statementExportService.js:29 and transactionExportService.js:22
// already send for a workbook. Named once here so the two new endpoints cannot
// answer a workbook under a different type than the two that already do.
export const XLSX_CONTENT_TYPE =
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Pair a list of keys and cell types with the labels a CSV header already
 * carries, so one column list serves both writers.
 *
 * The labels are taken from the CSV constant rather than retyped: a column added
 * to the file in one format and forgotten in the other is the drift this whole
 * module is arranged to prevent, and the length check turns that omission into a
 * failure at import time instead of a blank header in a shipped workbook.
 */
const withLabels = (fields, labels) => {
 if (fields.length !== labels.length) {
  throw new Error(
   `export column mismatch: ${fields.length} fields against ${labels.length} labels`,
  );
 }

 return fields.map((field, index) => ({ ...field, label: labels[index] }));
};

// The detail sheet every module export carries under its summary. The column
// list is the one the movements export already publishes, imported rather than
// restated so a column added there reaches these three too.
//
// One key is retyped: the transaction's own date arrives as a 'YYYY-MM-DD'
// string (transactionRowShape.js:85 casts it ::date::text), and writeXlsx's
// toCellValue would build new Date('2026-09-10') from it — UTC midnight, which
// reads back as the day before west of UTC. rateDate is left as 'date' because
// exchange_rate_timestamp IS an instant and carries its own offset.
// One further column the movements export has no need of: the months this block
// covers. The detail reaches back twelve months further than the summary above
// it, and a reader must see that without counting rows.
//
// It travels on every row rather than sitting in a preamble line, for the reason
// convertDebtAnalysisToCSV already states about its own As Of Month: a file with
// a preamble is not one any spreadsheet imports cleanly. First column, so it is
// the first thing read.
const MODULE_TRANSACTION_COLUMNS = [
 { key: 'period', label: 'Period Covered', type: 'text' },
 ...TRANSACTIONS_DATASET_COLUMNS.map((column) =>
  column.key === 'date' ? { ...column, type: 'text' } : column,
 ),
];

// 'YYYY-MM..YYYY-MM', the window the detail rows were read over.
const periodLabel = (window) =>
 window && window.from && window.to
  ? `${window.from.slice(0, 7)}..${window.to.slice(0, 7)}`
  : '';

// 'Transactions' is the name the period statement's workbook already gives this
// same table (statementExportService.js:130), and it fits the 31-character
// ceiling Excel puts on a sheet name.
const transactionsSheet = (detail) => {
 const period = periodLabel(detail?.window);

 return {
  name: 'Transactions',
  columns: MODULE_TRANSACTION_COLUMNS,
  // The upper-casing belongs upstream at toTransactionDataset.js:47 and :49,
  // where every export reads the field from; it is done locally because moving
  // it would rewrite the movements export's bytes, which this work did not ask
  // for. Without it a workbook prints USD on one sheet and usd on the next.
  rows: (Array.isArray(detail?.rows) ? detail.rows : []).map((row) => ({
   ...row,
   period,
   currency: (row.currency ?? '').toUpperCase(),
   originalCurrency: (row.originalCurrency ?? '').toUpperCase(),
  })),
 };
};

// A calendar date or month stays 'text' and is never typed 'date'. writeXlsx's
// toCellValue builds `new Date('2026-09-10')`, which is UTC midnight and reads
// back as the day before in any zone west of UTC — the same shift
// pocketValidators.js:26-28 keeps these strings out of a Date for.
const BUDGET_SHEET_FIELDS = withLabels(
 [
  { key: 'accountName', type: 'text' },
  { key: 'subcategory', type: 'text' },
  { key: 'currency', type: 'text' },
  { key: 'frequency', type: 'text' },
  { key: 'month', type: 'text' },
  { key: 'budgetAmount', type: 'number' },
  { key: 'actualSpent', type: 'number' },
  { key: 'remainingBudget', type: 'number' },
  { key: 'executionPercentage', type: 'number' },
 ],
 COLUMNS,
);

const POCKET_SHEET_FIELDS = withLabels(
 [
  { key: 'name', type: 'text' },
  { key: 'currency', type: 'text' },
  { key: 'target', type: 'number' },
  { key: 'allocated', type: 'number' },
  { key: 'remaining', type: 'number' },
  { key: 'progress', type: 'number' },
  { key: 'level', type: 'text' },
  { key: 'desiredDate', type: 'text' },
  { key: 'daysRemaining', type: 'number' },
  { key: 'requiredMonthly', type: 'number' },
  { key: 'committedInMonth', type: 'number' },
  { key: 'releasedInMonth', type: 'number' },
  { key: 'sourceCount', type: 'number' },
  { key: 'note', type: 'text' },
 ],
 POCKET_COLUMNS,
);

// The signed row the second sheet exists for. Amount carries its sign and is
// never split into two columns: 020_create_pocket_tables.sql:113-114 states the
// table is append-only and that +300 becomes +250 by writing -50, so the sign IS
// the difference between a commitment and a release.
const ALLOCATION_SHEET_FIELDS = [
 { key: 'pocketName', label: 'Pocket', type: 'text' },
 { key: 'allocationDate', label: 'Date', type: 'text' },
 { key: 'amount', label: 'Amount', type: 'number' },
 { key: 'sourceAccountName', label: 'Source Account', type: 'text' },
];

const DEBT_SHEET_FIELDS = withLabels(
 [
  { key: 'accountName', type: 'text' },
  { key: 'direction', type: 'text' },
  { key: 'balance', type: 'number' },
  { key: 'currency', type: 'text' },
  { key: 'asOfMonth', type: 'text' },
 ],
 DEBT_COLUMNS,
);

// Both figures are positive magnitudes, the convention makeDebtAnalysis's
// foldLegs already publishes them in, so a reader plotting the two columns never
// has to flip one of them.
const DEBT_BY_MONTH_SHEET_FIELDS = [
 { key: 'month', label: 'Month', type: 'text' },
 { key: 'receivable', label: 'Receivable', type: 'number' },
 { key: 'payable', label: 'Payable', type: 'number' },
];

/**
 * The two sheets of the budget workbook, in the order they appear in it.
 *
 * Sheet one is the same rows and the same columns the comma-separated file has,
 * at the same grain of one account per month.
 *
 *
 * Currency is upper-cased here and in convertSeriesToCSV at the one point each
 * writer produces the cell, so the two formats of one export cannot drift.
 *
 * Sheet two is the movements that produced the spend above, over the same month
 * range, so a category's Spent figure can be traced to the rows that made it.
 *
 * @param {Array<object>} accountsSeries - entries of { accountName, subcategory,
 *  currency, months: BudgetMonthStatus[] } from budgetCalculationService
 * @param {{rows: object[], window: {from: string, to: string}}} [detail] -
 *  the detail rows and the months they were read over
 * @returns {Array<{name: string, columns: object[], rows: object[]}>}
 */
export function buildBudgetSeriesSheets(accountsSeries, detail) {
 const accounts = Array.isArray(accountsSeries) ? accountsSeries : [];

 const rows = accounts.flatMap((account) =>
  (Array.isArray(account.months) ? account.months : []).map((m) => ({
   accountName: account.accountName ?? '',
   subcategory: account.subcategory ?? '',
   currency: (account.currency ?? '').toUpperCase(),
   // A constant, exactly as the CSV writes it: the column is not information
   // any more, but a file whose columns change between versions breaks whatever
   // the reader built on top of it.
   frequency: FREQUENCY,
   month: m.month,
   budgetAmount: m.budgetAmount,
   actualSpent: m.actualSpent,
   remainingBudget: m.remainingBudget,
   // Null when the budget is 0, which writeXlsx turns into an empty cell — the
   // right rendering of a percentage that does not exist, where 0 would claim
   // nothing was spent.
   executionPercentage: m.executionPercentage,
  })),
 );

 return [
  { name: 'Budget', columns: BUDGET_SHEET_FIELDS, rows },
  transactionsSheet(detail),
 ];
}

/**
 * The two sheets of the pocket workbook, in the order they appear in it.
 *
 * Sheet one is the board, the same columns and the same order the CSV has.
 * Sheet two is every commitment and release behind those totals — the grain the
 * one-row-per-pocket sheet folds away, and the reason the workbook exists at all
 * beside the comma-separated file.
 *
 * Amounts go in as numbers and not as the two-decimal strings the CSV writes: a
 * spreadsheet cell that holds text cannot be summed, and writeXlsx applies the
 * '#,##0.00' format to every 'number' column so the reading is unchanged.
 *
 * An owner with no pockets yields two sheets of headers and no rows, never an
 * absent sheet: a workbook whose second sheet appears only sometimes is one the
 * reader cannot build anything on.
 *
 * There is no sheet of bank movements here, unlike the budget and debt
 * workbooks. A commitment moves no money, so what explains this board is the
 * allocation event, not the transaction of whatever account funded it.
 *
 * @param {Array<object>} pockets - the `pockets` array of pocketBoardService.getBoard
 * @param {Array<object>} allocations - getPocketHistoryForUser's rows
 * @returns {Array<{name: string, columns: object[], rows: object[]}>}
 */
export function buildPocketBoardSheets(pockets, allocations) {
 const boardRows = (Array.isArray(pockets) ? pockets : []).map((pocket) => ({
  ...pocket,
  currency: (pocket.currency ?? '').toUpperCase(),
 }));

 const allocationRows = (Array.isArray(allocations) ? allocations : []).map((row) => ({
  ...row,
  // The repository hands NUMERIC over as text by its own rule
  // (pocketRepository.js:14-17); the cell has to hold the number.
  amount: Number(row.amount),
 }));

 return [
  { name: 'Pockets', columns: POCKET_SHEET_FIELDS, rows: boardRows },
  { name: 'Allocations', columns: ALLOCATION_SHEET_FIELDS, rows: allocationRows },
 ];
}

/**
 * The two sheets of the debt workbook, in the order they appear in it.
 *
 * Sheet one is the counterparty ranking the CSV already carries. Sheet two is
 * the receivable and the payable month by month, the one reading the ranking
 * cannot give:
 * a net position that has not moved hides both legs doubling, and that is what
 * makeDebtAnalysis's own header says the full level exists to separate.
 *
 * Both arrays are absent — not empty — when the owner has no debt in either
 * direction, so both are defaulted here and the workbook keeps its two sheets.
 *
 * @param {Array<object>} byCounterparty - entries of { accountName, direction, balance }
 * @param {Array<object>} legsOverTime - entries of { month, receivable, payable }
 * @param {string} asOfMonth - 'YYYY-MM', the close the balances were read at
 * Sheet three is the movements against those debtors over the same months the
 * second sheet spans, which is what turns a balance that moved into the lending
 * or the repayment that moved it.
 *
 * @param {string} currency - the accounting currency the analysis reports in
 * @param {{rows: object[], window: {from: string, to: string}}} [detail] -
 *  the detail rows and the months they were read over
 * @returns {Array<{name: string, columns: object[], rows: object[]}>}
 */
export function buildDebtAnalysisSheets(
 byCounterparty,
 legsOverTime,
 asOfMonth,
 currency,
 detail,
) {
 const counterpartyRows = (Array.isArray(byCounterparty) ? byCounterparty : []).map((row) => ({
  ...row,
  currency: (currency ?? '').toUpperCase(),
  asOfMonth: asOfMonth ?? '',
 }));

 const legRows = Array.isArray(legsOverTime) ? legsOverTime : [];

 // The tab names the two figures, not the field they arrive in: 'legs' is
 // makeDebtAnalysis's internal word and means nothing to a reader. Shortened
 // from the sentence writePdf.js:1570 prints over the same series, because Excel
 // refuses a sheet name longer than 31 characters.
 return [
  { name: 'Counterparties', columns: DEBT_SHEET_FIELDS, rows: counterpartyRows },
  { name: 'Receivable & Payable by Month', columns: DEBT_BY_MONTH_SHEET_FIELDS, rows: legRows },
  transactionsSheet(detail),
 ];
}

// The closed-account registry's file. Every column the registry keeps that
// names the account or names its closing, in the order a reader reads them:
// what it was, what it held, when it lived, and how it ended.
//
// Close Reason is the column this file exists for. It is the one fact the
// registry holds that no other read reaches - accountIdentity.js:78-79 states
// the shared account identity leaves it out because no consumer needed it - and
// it goes last, because it is free text and a long cell at the end of a row
// does not push the short ones out of view.
const CLOSED_ACCOUNT_COLUMNS = [
 'Account Name',
 'Account Type',
 'Category',
 'Subcategory',
 'Category Nature',
 'Currency',
 'Starting Amount',
 'Start Date',
 'Created At',
 'Closed At',
 'Closed By',
 'Close Reason',
];

// The three calendar dates are 'text' and never 'date', for the reason stated
// above BUDGET_SHEET_FIELDS: the reader already rendered them as 'YYYY-MM-DD'
// on the owner's calendar, and toCellValue would rebuild them at UTC midnight.
const CLOSED_ACCOUNT_SHEET_FIELDS = withLabels(
 [
  { key: 'accountName', type: 'text' },
  { key: 'accountTypeName', type: 'text' },
  { key: 'categoryName', type: 'text' },
  { key: 'subcategory', type: 'text' },
  { key: 'categoryNatureTypeName', type: 'text' },
  { key: 'currencyCode', type: 'text' },
  { key: 'accountStartingAmount', type: 'number' },
  { key: 'accountStartDate', type: 'text' },
  { key: 'accountCreatedAt', type: 'text' },
  { key: 'closedAt', type: 'text' },
  { key: 'closedBy', type: 'text' },
  { key: 'closeReason', type: 'text' },
 ],
 CLOSED_ACCOUNT_COLUMNS,
);

/**
 * The one sheet of the closed-account workbook.
 *
 * ONE SHEET AND NOT TWO, unlike the three exports above. Each of them carries a
 * detail block because its first sheet is a fold - a month total, a pocket
 * total, a counterparty balance - and the reader needs the rows underneath it.
 * This one is already at its finest grain: a row IS a closure, and there is
 * nothing below it to unfold.
 *
 * An owner who has closed nothing yields the sheet with its header and no rows,
 * never an absent sheet.
 *
 * @param {Array<object>} closures - getClosedAccountRegistryForExport's rows
 * @returns {Array<{name: string, columns: object[], rows: object[]}>}
 */
export function buildClosedAccountSheets(closures) {
 const rows = (Array.isArray(closures) ? closures : []).map((row) => ({
  ...row,
  // Upper case, as the three writers above already do: a currency code is ISO
  // 4217 and the files are read side by side.
  currencyCode: (row.currencyCode ?? '').toUpperCase(),
  // pg hands NUMERIC over as text (pocketRepository.js:14-17); the cell has to
  // hold the number. Null stays null, which both writers render as empty - a
  // registry row for an account erased before 035 carries no amount at all.
  accountStartingAmount:
   row.accountStartingAmount === null || row.accountStartingAmount === undefined
    ? null
    : Number(row.accountStartingAmount),
 }));

 return [{ name: 'Closed Accounts', columns: CLOSED_ACCOUNT_SHEET_FIELDS, rows }];
}

/**
 * Convert the closed-account registry to an RFC 4180 CSV document.
 *
 * Rendered from the workbook's own sheet spec rather than from a second list of
 * fields, which is one step further than the three converters above go: there
 * is no hand-written row builder here at all, so a column added to
 * CLOSED_ACCOUNT_SHEET_FIELDS reaches both formats or neither.
 *
 * @param {Array<object>} closures - getClosedAccountRegistryForExport's rows
 * @returns {string} CSV text including the header row.
 */
export function convertClosedAccountsToCSV(closures) {
 return joinCsvBlocks(buildClosedAccountSheets(closures).map(sheetToCsvBlock));
}
