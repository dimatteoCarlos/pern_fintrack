// src/utils/fintrackUtils/date-utils/periodResolver.js

// Period resolver – Pure date period utilities for financial domains.
// This module provides pure functions to resolve calendar periods
// (full months, quarters, four-month periods, semesters, years)
// from a frequency and a reference date.
// Used by Budget, and may be reused by future modules like Pocket, Insights, Reports.

// Windows, not allocations: this module only resolves calendar ranges.
import { ALLOWED_WINDOW_FREQUENCIES } from '../../../fintrack_api/services/budget_services/core/budgetConfig.js';

// One formatter per zone. Building an Intl.DateTimeFormat is expensive and a
// single request resolves a period per frequency group.
const formatterCache = new Map();

function zoneFormatter(timeZone) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      // h23, not hour12: false. The latter reports midnight as hour 24 on some
      // ICU builds, which would push every boundary a day forward.
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

// The wall clock an instant shows in a zone. month is 0-based, like Date.
function zonedParts(instant, timeZone) {
  const parts = {};
  for (const { type, value } of zoneFormatter(timeZone).formatToParts(instant)) {
    if (type !== 'literal') parts[type] = Number(value);
  }
  return {
    year: parts.year,
    month: parts.month - 1,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

// A wall clock read as if it were UTC. Only ever compared against another such
// value, never exposed: it is a comparable encoding, not an instant.
const asUtcMillis = (p) =>
  Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);

const offsetAt = (millis, timeZone) =>
  asUtcMillis(zonedParts(new Date(millis), timeZone)) - millis;

/**
 * The instant at which a given calendar day starts in a zone.
 *
 * Subtracting the offset once is not enough: the offset in force before the
 * boundary can differ from the one after it, so the first guess is re-measured
 * at its own result. Whether either candidate is the answer is decided by
 * reading it back, never by trusting the arithmetic.
 *
 * Two transitions break the one-to-one mapping, and each has a defined answer:
 * - Midnight happens twice (clocks go back). Both candidates read back, and the
 *   earlier one wins, so consecutive periods meet without overlapping.
 * - Midnight never happens (clocks go forward over it). Neither reads back, and
 *   the later candidate wins: the first instant of that day that does exist.
 */
function zonedDayStart(year, month, day, timeZone) {
  const wallClock = Date.UTC(year, month, day, 0, 0, 0, 0);

  const firstGuess = wallClock - offsetAt(wallClock, timeZone);
  const secondGuess = wallClock - offsetAt(firstGuess, timeZone);

  const readsBack = (millis) =>
    asUtcMillis(zonedParts(new Date(millis), timeZone)) === wallClock;

  const valid = [firstGuess, secondGuess].filter(readsBack);

  return new Date(valid.length > 0 ? Math.min(...valid) : Math.max(firstGuess, secondGuess));
}

// Generic internal helper to get a period range for any number of months.
// monthsPerPeriod indicates the duration of the period (e.g. 3 for quarterly).
function getPeriodRange(year, startMonth, monthsPerPeriod, timeZone) {
  const endMonth = startMonth + monthsPerPeriod;
  const start = zonedDayStart(year, startMonth, 1, timeZone);
  const end = zonedDayStart(year, endMonth, 1, timeZone);
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
 * Both boundaries are absolute instants, safe for database queries
 * (WHERE date >= start AND date < end). They are the moment the period opens
 * and closes in the given zone, which is midnight UTC only when the zone is
 * UTC: in America/Bogota, August opens at 2026-08-01T05:00Z.
 *
 * The zone decides which period the reference date belongs to as well as where
 * the boundaries fall. An instant late on the last day of the month is still
 * that month for a user west of UTC, and the same instant already belongs to
 * the next one for a user east of it.
 *
 * @param {string} frequency - one of: monthly, quarterly, four-month, semiannual, yearly
 * @param {Date} referenceDate - any date inside the desired period (used to determine which period)
 * @param {string} [timeZone] - IANA zone the calendar is read on. Defaults to UTC, which is what every caller took before the parameter existed
 * @returns {{ start: Date, end: Date }} start: the instant the period opens, end: the instant the next one opens
 * @throws {Error} if frequency is invalid, referenceDate is not a valid Date, or timeZone is not a zone Intl can use
 *
 * @example
 * resolvePeriod('quarterly', new Date('2026-02-15'))
 * // => { start: 2026-01-01T00:00:00.000Z, end: 2026-04-01T00:00:00.000Z }
 *
 * @example
 * resolvePeriod('monthly', new Date('2026-08-15'), 'America/Bogota')
 * // => { start: 2026-08-01T05:00:00.000Z, end: 2026-09-01T05:00:00.000Z }
 */
export function resolvePeriod(frequency, referenceDate, timeZone = 'UTC') {
  // Validation
  if (!ALLOWED_WINDOW_FREQUENCIES.includes(frequency)) {
    throw new Error(
      `resolvePeriod: invalid frequency "${frequency}". Allowed: ${ALLOWED_WINDOW_FREQUENCIES.join(', ')}`
    );
  }
  if (!(referenceDate instanceof Date) || isNaN(referenceDate.getTime())) {
    throw new Error('resolvePeriod: referenceDate must be a valid Date object');
  }
  // Anything Intl accepts, not the stricter canonical list. The column is
  // guarded by a trigger against pg_timezone_names, and a row it admitted must
  // stay readable here; the strict list belongs to the request layer.
  try {
    zoneFormatter(timeZone);
  } catch {
    throw new Error(`resolvePeriod: invalid IANA time zone "${timeZone}"`);
  }

  const { year, month } = zonedParts(referenceDate, timeZone);

  let result;

  switch (frequency) {
    case 'monthly':
      result = getPeriodRange(year, month, 1, timeZone);
      break;

    case 'quarterly': {
      const startMonth = Math.floor(month / 3) * 3;
      result = getPeriodRange(year, startMonth, 3, timeZone);
      break;
    }

    case 'four-month': {
      const startMonth = Math.floor(month / 4) * 4;
      result = getPeriodRange(year, startMonth, 4, timeZone);
      break;
    }

    case 'semiannual': {
      const startMonth = Math.floor(month / 6) * 6;
      result = getPeriodRange(year, startMonth, 6, timeZone);
      break;
    }

    case 'yearly':
      result = getPeriodRange(year, 0, 12, timeZone);
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
 * @param {string} [timeZone] - IANA zone the calendar is read on. Defaults to UTC
 * @returns {{ start: Date, end: Date }}
 */
export function getCurrentPeriod(now = new Date(), timeZone = 'UTC') {
  return resolvePeriod('monthly', now, timeZone);
}