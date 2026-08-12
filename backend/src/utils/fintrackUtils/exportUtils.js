// backend/src/utils/fintrackUtils/exportUtils.js
// Export helpers for the Budget module. Pure functions, no I/O.

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
 * Convert a month series for a set of accounts to an RFC 4180 CSV document.
 *
 * One row per account per month, which is why the Month column now varies down
 * the file instead of repeating one value. A single-month export is the same
 * shape with a range of one.
 *
 * @param {Array<object>} accountsSeries - entries of { accountName, subcategory,
 *  currency, months: BudgetMonthStatus[] } from budgetCalculationService.
 * @returns {string} CSV text including the header row.
 */
export function convertSeriesToCSV(accountsSeries) {
 const accounts = Array.isArray(accountsSeries) ? accountsSeries : [];

 const body = accounts.flatMap((account) =>
  // The read returns unbudgeted months too, so the chart can show them as such.
  // A CSV has no room for that distinction: the row would be a line of zeros
  // indistinguishable from a budget that was never spent. Exporting only the
  // budgeted months keeps the file meaning what it did — and over a range it
  // also keeps an account out of the file for the months before it existed.
  (Array.isArray(account.months) ? account.months : [])
   .filter((m) => m.isBudgeted)
   .map((m) =>
    [
     // The name rides on the series object. It used to come from a Map the
     // controller built alongside it, which meant two sources for one fact and
     // a blank cell whenever they disagreed.
     account.accountName ?? '',
     // Read from category_budget_accounts. It used to be read off budgetPolicy,
     // which never carried it, so this column shipped empty on every export.
     account.subcategory ?? '',
     account.currency ?? '',
     FREQUENCY,
     m.month,
     formatAmount(m.budgetAmount),
     formatAmount(m.actualSpent),
     formatAmount(m.remainingBudget),
     formatAmount(m.executionPercentage),
    ]
     .map(escapeCsvField)
     .join(','),
   ),
 );

 // CRLF is the RFC 4180 line ending. Excel accepts LF, but some importers
 // and every strict parser do not.
 return [COLUMNS.join(','), ...body].join('\r\n');
}
