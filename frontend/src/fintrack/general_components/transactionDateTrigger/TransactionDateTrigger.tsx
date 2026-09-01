// frontend/src/fintrack/general_components/transactionDateTrigger/TransactionDateTrigger.tsx

// The control that dates a tracker entry on a day other than today.
//
// It is a SECONDARY action of the form, not a field of the movement: the date
// defaults to today, which is always valid, so the ordinary entry never has to
// touch it. That is why it renders as a bare glyph beside the account label and
// not as a labelled panel the way PnL's own date does.
//
// The calendar itself is the shared Datepicker. Only the trigger differs, and it
// enters through the customInput door that component already opens.

import React from 'react';

import Datepicker from '../datepicker/Datepicker';
import CalendarSvg from '../../../assets/calendarSvg.svg?react';
import { toCalendarDay } from '../../helpers/functions';

import './styles/transactionDateTrigger-styles.css';

// The node the calendar is rendered into. react-datepicker creates it under
// document.body on first open if it is not already there.
const CALENDAR_PORTAL_ID = 'transaction-date-calendar';

export type TransactionDatePropsType = {
 date: Date;
 changeDate: (selectedDate: Date) => void;
 // The window the form allows. Both required here, unlike on Datepicker: a
 // trigger with no bounds would offer days the server refuses.
 minDate: Date;
 maxDate: Date;
 disabled?: boolean;
};

type TriggerButtonPropsType = React.ButtonHTMLAttributes<HTMLButtonElement> & {
 isBackDated?: boolean;
 accessibleLabel?: string;
 dayLabel?: string;
};

// react-datepicker clones this element with its own onClick, so the props
// declared on it here survive alongside them. forwardRef because the library
// anchors the popper on the trigger's node.
const TriggerButton = React.forwardRef<HTMLButtonElement, TriggerButtonPropsType>(
 ({ isBackDated, accessibleLabel, dayLabel, ...props }, ref) => (
  <button
   {...props}
   ref={ref}
   type='button'
   className={`transactionDateTrigger${isBackDated ? ' is-active' : ''}`}
   aria-label={accessibleLabel}
   title={accessibleLabel}
  >
   <CalendarSvg className='transactionDateTrigger__glyph' aria-hidden='true' />

   {/* Only when the entry is not dated today. On today the glyph stands alone,
       so the ordinary entry pays nothing; once the owner has moved the date, the
       day it now carries is the one thing the row has to state — a mark saying
       only "not today" leaves them to open the calendar to find out which day
       they picked. */}
   {isBackDated && (
    <span className='transactionDateTrigger__day'>{dayLabel}</span>
   )}
  </button>
 ),
);

TriggerButton.displayName = 'TransactionDateTriggerButton';

function TransactionDateTrigger({
 date,
 changeDate,
 minDate,
 maxDate,
 disabled,
}: TransactionDatePropsType) {
 // Compared as calendar days, never as instants: two Dates in the same day are
 // not equal, and the question here is which day the entry names.
 const isBackDated = toCalendarDay(date) !== toCalendarDay(new Date());

 const accessibleLabel = `Transaction date: ${date.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
 })}`;

 // No year: the window never leaves the current month, so the month and the day
 // say everything the row can vary by. The year stays in the accessible name.
 const dayLabel = date.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
 });

 // The way back. Once the date has moved, the trigger states which day it now
 // carries but offers nothing that undoes it: returning to today meant reopening
 // the calendar and finding today's cell, after navigating back to its month.
 //
 // Clamped to maxDate rather than taking new Date() as given. The form resolves
 // its window once on mount, so a form left open past midnight still bounds the
 // calendar at yesterday, and an unclamped reset would then select a day the
 // calendar itself refuses. Clamping makes that staleness harmless here instead
 // of depending on it being fixed elsewhere.
 const resetToToday = React.useCallback(() => {
  const today = new Date();

  changeDate(today > maxDate ? maxDate : today);
 }, [changeDate, maxDate]);

 return (
  <span className='transactionDateTrigger__group'>
   <Datepicker
    date={date}
    changeDate={changeDate}
    minDate={minDate}
    maxDate={maxDate}
    // Out to document.body, not anchored under the trigger. The tracker card
    // carries transform: translateX(-50%), which makes it the containing block
    // for any position: fixed inside it, and clips what overflows with
    // overflow-x: hidden and, below 701px of viewport height, overflow-y: auto.
    // A calendar rendered in that tree is centred on the card and cut by it,
    // which is exactly what it did. Out at the body there is no transform above
    // it and nothing to clip it.
    withPortal
    portalId={CALENDAR_PORTAL_ID}
    customInput={
     <TriggerButton
      isBackDated={isBackDated}
      accessibleLabel={accessibleLabel}
      dayLabel={dayLabel}
      disabled={disabled}
     />
    }
   />

   {/* Only once the date has moved. Today is the form's default and always
       valid, so on an ordinary entry there is nothing to undo and the row pays
       nothing — the same condition that governs the day label beside the glyph.

       A sibling of the trigger and not a child of it: the trigger is the
       calendar's customInput and react-datepicker clones its own onClick onto
       it, so a button nested inside would be a button within a button and its
       press would open the calendar instead of resetting. */}
   {isBackDated && (
    <button
     type='button'
     className='transactionDateTrigger__today'
     onClick={resetToToday}
     disabled={disabled}
    >
     Today
    </button>
   )}
  </span>
 );
}

const MemoizedTransactionDateTrigger = React.memo(TransactionDateTrigger);

MemoizedTransactionDateTrigger.displayName = 'TransactionDateTrigger';

export default MemoizedTransactionDateTrigger;
