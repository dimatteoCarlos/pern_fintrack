// backend/src/utils/fintrackUtils/exportUtils.js
// Export helpers for the Budget module. Pure functions, no I/O.

const COLUMNS = [
 'Account Name',
 'Subcategory',
 'Currency',
 'Frequency',
 'Period Start',
 'Period End',
 'Budgeted',
 'Spent',
 'Remaining',
 'Execution %',
];

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

const formatDate = (value) =>
 value instanceof Date ? value.toISOString().split('T')[0] : '';

// toFixed on a non-number throws; the values are validated upstream by
// makeBudgetAccountStatus, but export must not be the place a bad value surfaces.
const formatAmount = (value) =>
 typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '';

/**
 * Convert the budget status of a set of accounts to an RFC 4180 CSV document.
 *
 * @param {Array<object>} accountsStatus - BudgetAccountStatus objects from budgetCalculationService.
 * @param {Map<number, string>} accountNamesMap - accountId to display name.
 * @returns {string} CSV text including the header row.
 */
export function convertAccountsStatusToCSV(accountsStatus, accountNamesMap = new Map()) {
 const rows = Array.isArray(accountsStatus) ? accountsStatus : [];

 const body = rows.map((r) =>
  [
   // r.accountId, not r.budgetPolicy.accountId: an unbudgeted account has no
   // policy, and it is exactly the row whose name must still appear.
   accountNamesMap.get(r.accountId) ?? '',
   r.budgetPolicy?.subcategory ?? '',
   r.currency ?? '',
   // The field is budgetFrequencyCode. `frequency` never existed on the
   // allocation, so this column shipped empty on every export so far.
   r.budgetAllocation?.budgetFrequencyCode ?? '',
   formatDate(r.period?.start),
   formatDate(r.period?.end),
   formatAmount(r.budgetAccumulatedAmount),
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