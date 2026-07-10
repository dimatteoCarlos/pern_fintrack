// src/utils/fintrackUtils/date-utils/dateNormalizer.js
// 📝 CHANGE: New file

// Date normalization utilities for budget calculations.

/**
 * Normalize dates to calendar month boundaries.
 * Returns start as first day of month, end as first day of next month.
 * Generates a notice if dates were adjusted.
 *
 * @param {Date} startDate - Original start date
 * @param {Date} endDate - Original end date
 * @returns {{ start: Date, end: Date, notice: string|null }}
 * @throws {Error} If dates are invalid or startDate > endDate
 */
export function normalizeDatesToMonths(startDate, endDate) {
  // Validate dates
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('dateNormalizer: startDate must be a valid Date');
  }
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('dateNormalizer: endDate must be a valid Date');
  }
  if (startDate > endDate) {
    throw new Error('dateNormalizer: startDate must be before or equal to endDate');
  }

  const normalizedStart = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    1,
    0, 0, 0, 0
  ));

  // Check if end date is already at start of month (including seconds and milliseconds)
  const isEndAtMonthStart = endDate.getUTCDate() === 1 &&
   endDate.getUTCHours() === 0 &&
   endDate.getUTCMinutes() === 0 &&
   endDate.getUTCSeconds() === 0 &&
   endDate.getUTCMilliseconds() === 0;

  let normalizedEnd;
  let notice = null;

  if (isEndAtMonthStart) {
    normalizedEnd = new Date(Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      1,
      0, 0, 0, 0
    ));
  } else {
    normalizedEnd = new Date(Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth() + 1,
      1,
      0, 0, 0, 0
    ));
    notice = `Dates adjusted to calendar period (${normalizedStart.toISOString().split('T')[0]} to ${normalizedEnd.toISOString().split('T')[0]})`;
  }

  return {
    start: normalizedStart,
    end: normalizedEnd,
    notice,
  };
}