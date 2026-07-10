// src/utils/fintrackUtils/date-utils/getNumberOfPeriods.js


// Pure utility functions for period calculations.
// Reusable across modules (Budget, Pocket, Insights, etc.).
import { MONTHS_PER_PERIOD } from "../../../fintrack_api/services/budget_services/core/budgetConfig";

/**
 * Count complete periods in a date range (no prorating).
 * Returns 0 if the range is not a complete period.
 *
 * @param {string} frequencyCode - Frequency code (e.g. 'monthly', 'quarterly')
 * @param {Date} startDate - Period start (inclusive, UTC)
 * @param {Date} endDate - Period end (exclusive, UTC)
 * @returns {number} Number of complete periods
 * @throws {Error} If frequencyCode is unknown
 */
export function getNumberOfPeriods(frequencyCode, startDate, endDate) {
  const monthsDiff = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12
    + (endDate.getUTCMonth() - startDate.getUTCMonth());

  const monthsPerPeriod = MONTHS_PER_PERIOD[frequencyCode];
  if (!monthsPerPeriod) {
    throw new Error(`periodUtils: unknown frequency code "${frequencyCode}"`);
  }

  return Math.floor(monthsDiff / monthsPerPeriod);
}