// src/fintrack_api/services/overview_services/core/monthArithmetic.js

// Month arithmetic on 'YYYY-MM-01' text, never through Date.
//
// A Date would reintroduce the zone §4.5 removed from the queries: constructing
// one from 'YYYY-MM-01' parses as UTC midnight, and reading it back through any
// local getter can land on the previous month. Counting months as integers has
// no zone to lose and no daylight saving to survive.
//
// This mirrors the private helper in budgetCalculationService.js:95-105 on
// purpose. It is not imported from there because D6 freezes budget_services:
// exporting a module-private const to serve Overview would open that contract,
// which is the one thing the decision forbids. The duplication is 10 lines of
// integer arithmetic with no figure in it — nothing that can disagree with the
// budget module about a number.

/**
 * A month as a count of months since year 0, so shifting is addition.
 *
 * @param {string} month - 'YYYY-MM-01'
 * @returns {number}
 */
const monthIndex = (month) => {
 const [year, index] = month.split('-').map(Number);
 return year * 12 + (index - 1);
};

/**
 * The month `delta` months away from `month`.
 *
 * @param {string} month - 'YYYY-MM-01'
 * @param {number} delta - months to add; negative goes back
 * @returns {string} 'YYYY-MM-01'
 */
export const shiftMonths = (month, delta) => {
 const total = monthIndex(month) + delta;
 const year = Math.floor(total / 12);
 const index = total % 12;
 return `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}-01`;
};

/**
 * The last calendar day of a month, as text.
 *
 * The Date is built and read entirely in UTC and never meets an instant: day 0
 * of the following month IS the last day of this one. That is why it cannot
 * shift a day the way a local getter over a UTC-parsed date does — the same
 * reason getTransactionsForAccountById.js:21-27 builds its labels this way.
 *
 * @param {string} month - 'YYYY-MM-01'
 * @returns {string} 'YYYY-MM-DD'
 */
export const monthEndDate = (month) => {
 const [year, index] = month.split('-').map(Number);
 return new Date(Date.UTC(year, index, 0)).toISOString().split('T')[0];
};
