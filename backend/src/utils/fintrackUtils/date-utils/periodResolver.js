// src/utils/fintrackUtils/date-utils/periodResolver.js
// 📝 CHANGE: New file

// Period resolver – Pure date period utilities for financial domains.
// This module provides pure functions to resolve calendar periods
// (full months, quarters, four-month periods, semesters, years)
// from a frequency and a reference date.
// Used by Budget, and may be reused by future modules like Pocket, Insights, Reports.

import { ALLOWED_FREQUENCIES } from '../../../fintrack_api/services/budget_services/core/budgetConfig.js';

// Generic internal helper to get a period range for any number of months.
// monthsPerPeriod indicates the duration of the period (e.g. 3 for quarterly).
function getPeriodRange(year, startMonth, monthsPerPeriod) {
  const endMonth = startMonth + monthsPerPeriod;
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, endMonth, 1, 0, 0, 0, 0));
  return { start, end };
}

// Public API

/**
 * Resolve a calendar period from a frequency and a reference date.
 *
 * "Resolving a period" means: given a frequency (e.g. 'quarterly') and an
 * arbitrary reference date inside that period (e.g. 2026-02-15), return the
 * exact start and end boundaries of that calendar period (e.g. 2026-01-01 and
 * 2026-04-01). The reference date is only used to determine which period you
 * are in; it does not need to be the first or last day.
 *
 * All dates are returned as UTC dates at midnight (00:00:00) to be safe for
 * database queries (WHERE date >= start AND date < end).
 *
 * @param {string} frequency - one of: monthly, quarterly, four-month, semiannual, yearly
 * @param {Date} referenceDate - any date inside the desired period (used to determine which period)
 * @returns {{ start: Date, end: Date }} start: first day of period (00:00 UTC), end: first day after period (00:00 UTC)
 * @throws {Error} if frequency is invalid or referenceDate is not a valid Date
 *
 * @example
 * resolvePeriod('quarterly', new Date('2026-02-15'))
 * // => { start: 2026-01-01T00:00:00.000Z, end: 2026-04-01T00:00:00.000Z }
 */
export function resolvePeriod(frequency, referenceDate) {
  // Validation
  if (!ALLOWED_FREQUENCIES.includes(frequency)) {
    throw new Error(
      `resolvePeriod: invalid frequency "${frequency}". Allowed: ${ALLOWED_FREQUENCIES.join(', ')}`
    );
  }
  if (!(referenceDate instanceof Date) || isNaN(referenceDate.getTime())) {
    throw new Error('resolvePeriod: referenceDate must be a valid Date object');
  }

  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth(); // 0-based

  let result;

  switch (frequency) {
    case 'monthly':
      result = getPeriodRange(year, month, 1);
      break;

    case 'quarterly': {
      const startMonth = Math.floor(month / 3) * 3;
      result = getPeriodRange(year, startMonth, 3);
      break;
    }

    case 'four-month': {
      const startMonth = Math.floor(month / 4) * 4;
      result = getPeriodRange(year, startMonth, 4);
      break;
    }

    case 'semiannual': {
      const startMonth = Math.floor(month / 6) * 6;
      result = getPeriodRange(year, startMonth, 6);
      break;
    }

    case 'yearly':
      result = getPeriodRange(year, 0, 12);
      break;

    default:
      throw new Error(`resolvePeriod: unsupported frequency "${frequency}"`);
  }

  return result;
}

/**
 * Convenience function to get the current monthly period.
 * Useful for dashboards or endpoints that don't receive an explicit date.
 * @param {Date} [now] - optional reference date (defaults to new Date())
 * @returns {{ start: Date, end: Date }}
 */
export function getCurrentPeriod(now = new Date()) {
  return resolvePeriod('monthly', now);
}