// backend/src/utils/fintrackUtils/date-utils/pocketDeadline.js

/**
 * The rules that govern pocket_saving_accounts.desired_date on write.
 *
 * Two of them, and they are here rather than in the controller because the
 * board service has to read the same calendar the writer used: a deadline the
 * writer accepted as "today" must not render as at_risk on the next request.
 *
 * 1. A supplied deadline must not be earlier than today ON THE OWNER'S
 *    CALENDAR. Today itself is valid — a goal due this month is a real goal,
 *    and the month is the unit the rest of the app measures in. The comparison
 *    is therefore >= against the start of today, not > against whatever instant
 *    the picker stamped: under > the answer depends on the time of day the user
 *    happened to open the form.
 *
 * 2. An absent deadline is defaulted to one month after the account starts. The
 *    column is NOT NULL, so something has to be written, and a one-month horizon
 *    expires almost immediately — which surfaces the pocket as at_risk and asks
 *    the user for the date the model actually needs. A one-year horizon would
 *    report "on track" for twelve months on a date nobody chose.
 *
 * The default is deliberately NOT run through rule 1. An account that starts in
 * the past gets a default deadline in the past, and that is the intended
 * reading: the row is honest about having no deadline the user picked, and
 * desired_date_source records which of the two paths wrote it.
 *
 * The browser has the same rule in a zod schema. That schema is the ergonomics;
 * this file is the authority. A rule enforced only in the client is a
 * suggestion the next caller ignores.
 */

import { todayInZone } from './resolveZonedWindow.js';

/**
 * The calendar day an instant falls on, read on a given zone.
 *
 * 'en-CA' is the locale whose numeric format is already YYYY-MM-DD, the same
 * trick todayInZone uses. The output is a label, never an instant.
 *
 * @param {Date|string|number} value - anything the Date constructor accepts
 * @param {string} timeZone - IANA identifier
 * @returns {string|null} YYYY-MM-DD, or null when the value is not a date
 */
export const calendarDayInZone = (value, timeZone) => {
 const instant = value instanceof Date ? value : new Date(value);

 if (Number.isNaN(instant.getTime())) return null;

 try {
  return new Intl.DateTimeFormat('en-CA', {
   timeZone,
   year: 'numeric',
   month: '2-digit',
   day: '2-digit',
  }).format(instant);
 } catch {
  return null;
 }
};

/**
 * Is this deadline acceptable to store?
 *
 * Both sides are plain YYYY-MM-DD labels, so the comparison is a string compare
 * on a format that sorts chronologically. No instant arithmetic, and therefore
 * no zone to get wrong twice.
 *
 * @param {Date|string|number} desiredDate - as it arrived from the caller
 * @param {string} timeZone - the account owner's IANA zone
 * @returns {{ ok: boolean, day: string|null, today: string|null }}
 *  ok is false both for a malformed value and for a past one; day tells the
 *  caller which of the two happened, and it is what the message quotes.
 */
export const checkDesiredDate = (desiredDate, timeZone) => {
 const zone = timeZone || 'UTC';
 const day = calendarDayInZone(desiredDate, zone);

 if (day === null) return { ok: false, day: null, today: null };

 const today = todayInZone(zone);

 return { ok: day >= today, day, today };
};

/**
 * The deadline written when the caller sends none: one month after the start.
 *
 * The month is added on the UTC fields of a copy, then the day is clamped. Left
 * to setMonth alone, 31 January + 1 month lands on 3 March, because the
 * overflow rolls forward into a month that has no 31st. Clamping to the last
 * day of the target month is the reading a user would give the phrase.
 *
 * @param {Date|string|number} accountStartDate
 * @returns {Date}
 */
export const defaultDesiredDate = (accountStartDate) => {
 const start = new Date(accountStartDate);
 const deadline = new Date(start.getTime());

 const targetMonth = start.getUTCMonth() + 1;

 deadline.setUTCDate(1);
 deadline.setUTCMonth(targetMonth);

 // Day 0 of the following month is the last day of the target month.
 const lastDayOfTargetMonth = new Date(
  Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth() + 1, 0),
 ).getUTCDate();

 deadline.setUTCDate(Math.min(start.getUTCDate(), lastDayOfTargetMonth));

 return deadline;
};
