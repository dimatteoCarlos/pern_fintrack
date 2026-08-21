// backend/src/utils/fintrackUtils/date-utils/resolveZonedWindow.js

/**
 * Resolves the calendar window a dashboard query runs over.
 *
 * Both bounds leave here as plain YYYY-MM-DD strings, never as instants. A
 * calendar day only becomes an instant once someone says whose clock reads it,
 * and that conversion belongs to the single place that holds the zone: the SQL,
 * through one AT TIME ZONE per bound. What this function does in JavaScript is
 * name the default days — a label, not a conversion of anything stored.
 *
 * The window the caller then builds is half-open: from the start day's midnight
 * up to, but not including, the day after the end day's midnight. The end day
 * therefore enters whole and nothing dated past it does, with no 23:59:59.999
 * sentinel to keep in step with the column's microsecond resolution.
 *
 * The shape to write in the query, with $s and $e the two dates and $z the zone:
 *
 *   AND tr.transaction_actual_date >= ($s::timestamp AT TIME ZONE $z)
 *   AND tr.transaction_actual_date <  (($e::date + INTERVAL '1 day') AT TIME ZONE $z)
 *
 * The ::timestamp cast on the lower bound is load-bearing. AT TIME ZONE has two
 * overloads, and with a bare date it picks the TIMESTAMPTZ one and converts the
 * bound the wrong way. The upper bound needs no cast: date + interval is
 * already a TIMESTAMP.
 */

// The only calendar shape accepted from the query string. Anything else is
// rejected rather than coerced, because 2026-08-20T00:00:00.000Z casts to a
// date in the *session's* zone and quietly reintroduces the bug this removes.
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const DEFAULT_LOOKBACK_DAYS = 30;

/**
 * The day the user is living, not the day the server is.
 * 'en-CA' is the locale whose numeric format is already YYYY-MM-DD.
 *
 * @param {string} timeZone - IANA identifier
 * @returns {string} YYYY-MM-DD
 */
const todayIn = (timeZone) =>
 new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
 }).format(new Date());

/**
 * Day arithmetic on a naive calendar date. Date.UTC is safe here precisely
 * because no zone is involved: the input carries no time and the output is
 * read back as the same kind of label.
 *
 * @param {string} calendarDate - YYYY-MM-DD
 * @param {number} days - may be negative
 * @returns {string} YYYY-MM-DD
 */
const shiftDays = (calendarDate, days) => {
 const [year, month, day] = calendarDate.split('-').map(Number);

 return new Date(Date.UTC(year, month - 1, day + days))
  .toISOString()
  .slice(0, 10);
};

const isCalendarDate = (value) =>
 typeof value === 'string' && CALENDAR_DATE.test(value);

/**
 * @param {object} params
 * @param {string} [params.start] - YYYY-MM-DD from the query string
 * @param {string} [params.end] - YYYY-MM-DD from the query string
 * @param {string} params.timeZone - the account owner's IANA zone
 * @param {number} [params.lookbackDays] - how many calendar days the default
 *   window spans, counting the end day itself
 * @returns {{ startDate: string, endDate: string, timeZone: string }}
 */
export function resolveZonedWindow({
 start,
 end,
 timeZone,
 lookbackDays = DEFAULT_LOOKBACK_DAYS,
}) {
 // getUserTimeZone already falls back to UTC, and a users row cannot hold a
 // non-IANA value: the assert_iana_timezone trigger rejects it on write. This
 // guards the one remaining path, a caller that passes nothing.
 let zone = timeZone || 'UTC';

 try {
  todayIn(zone);
 } catch {
  zone = 'UTC';
 }

 // The end day anchors the window. An explicit start with no end still gets a
 // sensible ceiling, and an explicit end with no start gets its floor measured
 // back from the day that was asked for rather than from today.
 const endDate = isCalendarDate(end) ? end : todayIn(zone);
 const startDate = isCalendarDate(start)
  ? start
  : shiftDays(endDate, -(lookbackDays - 1));

 return { startDate, endDate, timeZone: zone };
}
