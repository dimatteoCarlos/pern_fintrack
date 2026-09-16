// backend/src/export_api/core/exportFileName.js
//
// The name the browser saves a download under, PLAN_EXPORT.md §11: the months
// the data is about, not the day it was downloaded — two exports of the same
// range taken on different days are the same file and are named alike.

/**
 * @param {{from: (string|null), to: (string|null), format: string}} range -
 *  from/to as 'YYYY-MM-01' or null; format the file extension ('csv'|'xlsx')
 * @returns {string}
 */
export function exportFileName({ from, to, format }) {
 if (!from && !to) {
  return `fintrack-movements-all-time.${format}`;
 }

 // One bound present, the other open-ended: named after the bound that is
 // there rather than spelled out as a range with a missing side.
 if (!from || !to || from === to) {
  const month = (from ?? to).slice(0, 7);
  return `fintrack-movements-${month}.${format}`;
 }

 return `fintrack-movements-${from.slice(0, 7)}_${to.slice(0, 7)}.${format}`;
}

/**
 * The period statement's own name: one reference month, never a range
 * (PLAN_EXPORT.md §11: `fintrack-statement-YYYY-MM.pdf|xlsx`).
 *
 * @param {{referenceMonth: string, format: string}} statement -
 *  referenceMonth 'YYYY-MM-01'; format the file extension ('xlsx'|'pdf')
 * @returns {string}
 */
export function statementFileName({ referenceMonth, format }) {
 return `fintrack-statement-${referenceMonth.slice(0, 7)}.${format}`;
}
