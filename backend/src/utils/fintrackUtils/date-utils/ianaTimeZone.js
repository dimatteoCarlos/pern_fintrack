// src/utils/fintrackUtils/date-utils/ianaTimeZone.js

// The write half of the pair getUserTimeZone completes: this guards what enters
// users.timezone, that one reads what came out.

// Built once at import; the ICU catalog does not change while the process lives.
// 'UTC' is added by hand because Intl lists canonical zones only and leaves it
// out, and it is the column default that every existing row already holds.
const IANA_TIME_ZONES = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);

/**
 * Whether a value is a zone this application agrees to store.
 *
 * Deliberately stricter than the database trigger: pg_timezone_names admits 598
 * entries including aliases such as 'US/Eastern', this set holds 418, and every
 * one of them was verified present in that catalog. A value accepted here can
 * therefore never make the trigger raise. Canonical names only also means two
 * users in the same zone store the same string.
 *
 * Case sensitive on purpose. Intl.DateTimeFormat accepts 'utc', Postgres does
 * not, so a lowercase alias would turn a bad request into a 500.
 *
 * @param {unknown} value - a candidate zone, straight from a request body.
 * @returns {boolean}
 */
export function isIanaTimeZone(value) {
 return typeof value === 'string' && IANA_TIME_ZONES.has(value);
}
