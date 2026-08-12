// backend/src/utils/fintrackUtils/exportUtils.js
// Export helpers for the Budget module. Pure functions, no I/O.

// One Month column, not a Period Start / Period End pair: every row now covers
// the same calendar month, so two columns would emit the same two values on
// every line of the file.
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
 * Escape one CSV field per RFC 4180.
 *
 * A field is quoted only when it contains a delimiter, a quote, CR or LF;
 * embedded quotes are doubled. Skipping this turns any account name with a
 * comma into extra columns, which shifts every value to its right — a
 * corruption that produces a readable file rather than an error.
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

// toFixed on a non-number throws; the values are validated upstream by
// makeBudgetAccountStatus, but export must not be the place a bad value surfaces.
// executionPercentage is null when the budget is 0, and an empty cell is the
// right rendering of a percentage that does not exist — 0.00 would claim nothing
// was spent.
const formatAmount = (value) =>
 typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '';

/**
 * Convert the budget status of a set of accounts to an RFC 4180 CSV document.
 *
 * @param {Array<object>} accountsStatus - BudgetAccountStatus objects from budgetCalculationService.
 * @param {string} referenceMonth - the month every row covers, as 'YYYY-MM-DD'.
 * @returns {string} CSV text including the header row.
 */
export function convertAccountsStatusToCSV(accountsStatus, referenceMonth = '') {
 const rows = Array.isArray(accountsStatus) ? accountsStatus : [];

 const body = rows.map((r) =>
  [
   // The name rides on the status object now. It used to come from a Map the
   // controller built alongside it, which meant two sources for one fact and a
   // blank cell whenever they disagreed.
   r.accountName ?? '',
   // Read from category_budget_accounts. It used to be read off budgetPolicy,
   // which never carried it, so this column shipped empty on every export.
   r.subcategory ?? '',
   r.currency ?? '',
   FREQUENCY,
   referenceMonth,
   formatAmount(r.budgetAmount),
   formatAmount(r.actualSpent),
   formatAmount(r.remainingBudget),
   formatAmount(r.executionPercentage),
  ]
   .map(escapeCsvField)
   .join(','),
 );

 // CRLF is the RFC 4180 line ending. Excel accepts LF, but some importers
 // and every strict parser do not.
 return [COLUMNS.join(','), ...body].join('\r\n');
}
