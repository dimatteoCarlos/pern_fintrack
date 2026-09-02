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

   {/* Always, today included. The day used to print only once the entry had
       been moved, so the ordinary entry showed a bare glyph and the form never
       stated the day it was about to save — the one fact a form that writes a
       dated row owes its reader before they press save.

       is-active therefore no longer decides WHETHER the day shows. It decides
       how it is drawn: the class means the entry is back-dated, and all it
       carries now is the colour that says so. */}
   <span className='transactionDateTrigger__day'>{dayLabel}</span>
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

 // No way back button. The trigger is the whole control now: pressing it opens
 // the calendar, where today is one cell away, so a second control for the same
 // trip was a button that duplicated a tap — and inside the amount field there
 // is no room to spend on one.
 //
 // What went with it was a clamp worth recording: the reset took new Date() and
 // pinned it to maxDate, because a form left open past midnight still bounds its
 // calendar at yesterday and an unclamped reset would have selected a day that
 // calendar refuses. The calendar itself has always enforced that bound, which
 // is why removing the button loses nothing.
 return (
  <span className='transactionDateControl'>
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
  </span>
 );
}

const MemoizedTransactionDateTrigger = React.memo(TransactionDateTrigger);

MemoizedTransactionDateTrigger.displayName = 'TransactionDateTrigger';

export default MemoizedTransactionDateTrigger;
