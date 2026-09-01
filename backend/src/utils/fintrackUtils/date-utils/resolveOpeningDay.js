// backend/src/utils/fintrackUtils/date-utils/resolveOpeningDay.js

// The day an account is opened on, and the window that day may fall in.
//
// An operative date belongs to the back-dating window, which is a whole number
// of calendar months ending with the current one. Transactions enforce the same
// window in transactionController, off the same constant; reading it here keeps
// account creation from introducing a second, softer policy for the same kind
// of date.

import { createError } from '../../errorHandling.js';
import {
 dayInZone,
 earliestDatableDay,
 isCalendarDate,
 todayInZone,
} from './resolveZonedWindow.js';
import { BACKDATING_WINDOW_MONTHS } from '../../../fintrack_api/config/fintrackConfig.js';

/**
 * The calendar day an account is opened on, read on the owner's calendar.
 *
 * Today is allowed, and so is any earlier day the back-dating window still
 * reaches; a future day and any day before that window are refused. The check
 * runs before anything is converted or written, so a rejected date costs no
 * rate lookup and leaves no row.
 *
 * The value arrives in two shapes. A transaction posts a bare YYYY-MM-DD; the
 * account forms hold a Date, which JSON serialises as a UTC instant. Slicing
 * that instant is the bug it looks like a shortcut for: 23:30 in Bogota is
 * already tomorrow in UTC, so an opening made this evening would be read a day
 * forward and refused as future. The instant is resolved in the owner's zone.
 *
 * @param {string|Date|null|undefined} value - what the request carries as the
 *  opening date. Absent means today.
 * @param {string} timeZone - the owner's IANA zone.
 * @returns {string} YYYY-MM-DD.
 * @throws 400 when the value is not a date at all; 422 when it is a date
 *  outside the back-dating window.
 */
export const resolveOpeningDay = (value, timeZone) => {
 const today = todayInZone(timeZone);
 const requested = typeof value === 'string' ? value.trim() : value;

 if (requested === undefined || requested === null || requested === '') {
  return today;
 }

 let openingDay;

 if (isCalendarDate(requested)) {
  openingDay = requested;
 } else {
  const instant = new Date(requested);

  if (Number.isNaN(instant.getTime())) {
   throw createError(
    400,
    'The opening date must be a calendar day, YYYY-MM-DD',
    {
     errorCode: 'INVALID_OPENING_DATE',
     details: { expectedFormat: 'YYYY-MM-DD' },
    },
   );
  }

  openingDay = dayInZone(instant, timeZone);
 }

 if (openingDay > today) {
  throw createError(
   422,
   `An account cannot be opened after today, ${today}`,
   {
    errorCode: 'OPENING_DATE_AFTER_TODAY',
    details: { openingDay, today },
   },
  );
 }

 const windowFloor = earliestDatableDay(today, BACKDATING_WINDOW_MONTHS);

 if (openingDay < windowFloor) {
  // The code and the details key keep the names they were published under. The
  // window they describe widened, but they are what NewAccount matches on, and
  // renaming a contract to match a comment is a change nobody asked for.
  throw createError(
   422,
   `An account cannot be opened before ${windowFloor}`,
   {
    errorCode: 'OPENING_DATE_BEFORE_CURRENT_MONTH',
    details: { openingDay, currentMonthStart: windowFloor },
   },
  );
 }

 return openingDay;
};

/**
 * The day to price an opening at, or null for the rate in force now.
 *
 * currencyAmountConversion does not decide whether a day is today — it has no
 * timezone — so the caller routes: null takes the current path, a day takes the
 * historical one. An opening dated today must take the current path, or an
 * account created minutes ago would be valued from a source that has not
 * published today's close yet.
 *
 * @param {string} openingDay - YYYY-MM-DD, already validated.
 * @param {string} timeZone - the owner's IANA zone.
 * @returns {string|null}
 */
export const rateDayForOpening = (openingDay, timeZone) =>
 openingDay < todayInZone(timeZone) ? openingDay : null;
