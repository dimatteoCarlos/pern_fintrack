// frontend/src/fintrack/general_components/monthPicker/MonthPicker.tsx
// The month the budget board reports, as a control.
//
// Not a widening of Datepicker.tsx: that one is a day picker every form
// consumes, and a control accepting a day here would promise a precision the
// module does not have — the day is discarded on the wire. Same library, month
// mode, no new dependency.
//
// It decides nothing about which month is current. The upper bound is served in
// meta.currentMonth and the label is the response's referenceMonth: the browser
// clock is the defect this module is removing, not a fallback for it.

import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './styles/monthPicker-styles.css';

import { formatBudgetMonthLabel } from '../../helpers/functions';

type MonthPickerProps = {
 // First of the month being reported, as the server resolved it. null while the
 // answer is on the wire: there is no month to show yet, so there is no month
 // to guess either.
 month: string | null;
 // The latest month that may be asked for. null holds the picker open-ended
 // rather than inventing a ceiling.
 currentMonth: string | null;
 onSelect: (month: string) => void;
};

// The floor the project's existing picker already uses. There is no lower bound
// in the contract: a month before the first allocation resolves to the empty
// state, which is owed anyway.
const MIN_MONTH = new Date(1900, 0, 1);

// Parsed by parts. new Date('2026-08-01') is UTC midnight, which west of UTC is
// the previous month.
const toDate = (month: string | null) => {
 if (!month) return null;

 const [year, monthNumber] = month.split('-').map(Number);
 if (!year || !monthNumber) return null;

 return new Date(year, monthNumber - 1, 1);
};

// Emitted the same way. toISOString would shift the month back by one for every
// user in a negative offset.
const toMonthParam = (date: Date) =>
 `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// react-datepicker clones this element with its own onClick and ref. It is a
// button and not the read-only input the day picker uses: this one opens a
// menu, and a chevron is what tells the two badges of the drill-down apart —
// levels 2 and 3 show the same month and cannot change it.
const MonthTrigger = React.forwardRef<
 HTMLButtonElement,
 { label?: string; onClick?: () => void }
>(({ label = '', onClick }, ref) => (
 <button
  type='button'
  ref={ref}
  onClick={onClick}
  className='month-badge month-badge--light month-badge--trigger'
  aria-label={`Change month, currently ${label}`}
 >
  <span className='month-badge__label'>{label}</span>
  <span className='month-badge__chevron' aria-hidden='true'>
   ▾
  </span>
 </button>
));

MonthTrigger.displayName = 'MonthTrigger';

function MonthPicker({ month, currentMonth, onSelect }: MonthPickerProps) {
 const selected = toDate(month);
 const maxDate = toDate(currentMonth);

 const handleChange = React.useCallback(
  (date: Date | null) => {
   if (!date) return;

   onSelect(toMonthParam(date));
  },
  [onSelect],
 );

 // Nothing to label yet: a skeleton, not a month computed here to fill the gap.
 if (!selected) {
  return (
   <div
    className='month-badge month-badge--light month-badge--skeleton'
    aria-hidden='true'
   />
  );
 }

 return (
  <DatePicker
   selected={selected}
   onChange={handleChange}
   showMonthYearPicker
   showFullMonthYearPicker
   dateFormat='MMMM yyyy'
   minDate={MIN_MONTH}
   maxDate={maxDate ?? undefined}
   shouldCloseOnSelect
   popperClassName='monthPicker__popper'
   customInput={<MonthTrigger label={formatBudgetMonthLabel(month)} />}
  />
 );
}

const MemoizedMonthPicker = React.memo(MonthPicker);

MemoizedMonthPicker.displayName = 'MonthPicker';

export default MemoizedMonthPicker;
