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
 // First of the month being reported, as the server resolved it.
 month: string | null;
 // The latest month that may be asked for.
 currentMonth: string | null;
 // The earliest month that may be asked for. Optional because not every caller
 // has one: the budget board covers every account, so it has no single opening
 // date to bound itself by.
 minMonth?: string | null;
 // The surface the badge lands on, not its own colour.
 surface?: 'dark' | 'light';
 // Opt-in, so the three screens that render the badge alone are untouched: the
 // budget board, the category detail and the debtor detail pass nothing and
 // get exactly what they have today. The arrows live here and not in a local
 // wrapper because the bounds live here — a wrapper would hold a second copy
 // of them, and that is how the next screen gets a forward arrow that steps
 // past the current month.
 withSteppers?: boolean;
 // An answer is on the wire. The arrows stay live, because the store keeps the
 // last month ASKED FOR rather than the last answer to arrive, so holding an
 // arrow down has to remain possible.
 isLoading?: boolean;
 onSelect: (month: string) => void;
};

// The floor when the caller names none. A month before the first allocation
// resolves to the empty state, which is owed anyway — but a caller holding one
// account does have a real floor, and offering a month before it promises a
// reading of an account that did not exist.
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

// 'YYYY-MM', whether the caller sent that or a first-of-month date. The bounds
// are compared as text, which is exact on this format and needs no Date.
const toMonthKey = (month: string | null | undefined) =>
 month ? month.slice(0, 7) : null;

// One month either side, by parts. The Date constructor rolls December over to
// January of the next year on its own, which is the whole reason it is used
// here rather than arithmetic on the two numbers.
const shiftMonth = (month: string, step: number) => {
 const [year, monthNumber] = month.split('-').map(Number);

 return toMonthParam(new Date(year, monthNumber - 1 + step, 1));
};

// Decorative: the button beside it carries the label. currentColor so the two
// surface modifiers keep working without a second rule per direction.
const StepChevron = ({ back }: { back: boolean }) => (
 <svg
  className='monthStepper__chevron'
  viewBox='0 0 24 24'
  fill='none'
  stroke='currentColor'
  strokeWidth='2'
  strokeLinecap='round'
  strokeLinejoin='round'
  aria-hidden='true'
  focusable='false'
 >
  <polyline points={back ? '15 5 8 12 15 19' : '9 5 16 12 9 19'} />
 </svg>
);

// react-datepicker clones this element with its own handlers and ref. It is a
// button and not the read-only input the day picker uses: this one opens a
// menu, and a chevron is what tells the two badges of the drill-down apart —
// level 2 shows the month and cannot change it.
//
// The keyboard handlers are forwarded and not swallowed: Escape closes the panel
// through the library's own onKeyDown, so a trigger that accepts onClick alone
// opens a menu the keyboard cannot dismiss. They are named one by one rather
// than spread, because the library also injects input-only attributes that a
// button cannot carry.
const MonthTrigger = React.forwardRef<
 HTMLButtonElement,
 {
  label?: string;
  surface?: 'dark' | 'light';
  onClick?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
 }
>(({ label = '', surface = 'light', onClick, onKeyDown, onFocus, onBlur }, ref) => (
 <button
  type='button'
  ref={ref}
  onClick={onClick}
  onKeyDown={onKeyDown}
  onFocus={onFocus}
  onBlur={onBlur}
  className={`month-badge month-badge--${surface} month-badge--trigger`}
  aria-label={`Change month, currently ${label}`}
 >
  <span className='month-badge__label'>{label}</span>
  <span className='month-badge__chevron' aria-hidden='true'>
   ▾
  </span>
 </button>
));

MonthTrigger.displayName = 'MonthTrigger';

function MonthPicker({
 month,
 currentMonth,
 minMonth,
 surface = 'light',
 withSteppers = false,
 isLoading = false,
 onSelect,
}: MonthPickerProps) {
 const selected = toDate(month);
 const maxDate = toDate(currentMonth);
 const minDate = toDate(minMonth ?? null) ?? MIN_MONTH;

 const handleChange = React.useCallback(
  (date: Date | null) => {
   if (!date) return;

   onSelect(toMonthParam(date));
  },
  [onSelect],
 );

 const monthKey = toMonthKey(month);
 const floorKey = toMonthKey(minMonth);
 const ceilingKey = toMonthKey(currentMonth);

 // Each arrow disables at its own bound. A ceiling that has not arrived stops
 // the forward step outright: stepping into a month the server refuses with
 // 422 is a refusal the interface can simply not offer.
 const canStepBack =
  monthKey !== null && (floorKey === null || monthKey > floorKey);
 const canStepForward =
  monthKey !== null && ceilingKey !== null && monthKey < ceilingKey;

 const step = (direction: -1 | 1) => {
  if (!monthKey) return;

  onSelect(shiftMonth(monthKey, direction));
 };

 // Nothing to label yet: a skeleton, not a month computed here to fill the gap.
 const badge = !selected ? (
  <div
   className={`month-badge month-badge--${surface} month-badge--skeleton`}
   aria-hidden='true'
  />
 ) : (
  <DatePicker
   selected={selected}
   onChange={handleChange}
   showMonthYearPicker
   showFullMonthYearPicker
   dateFormat='MMMM yyyy'
   minDate={minDate}
   maxDate={maxDate ?? undefined}
   shouldCloseOnSelect
   popperClassName='monthPicker__popper'
   customInput={
    <MonthTrigger label={formatBudgetMonthLabel(month)} surface={surface} />
   }
  />
 );

 if (!withSteppers) return badge;

 return (
  // aria-busy and not a spinner: the badge keeps its label while the next
  // month is on the wire, so the row does not collapse and reflow the page
  // under it on every step.
  <div
   className={`monthStepper monthStepper--${surface}`}
   aria-busy={isLoading}
  >
   <button
    type='button'
    className='monthStepper__arrow'
    onClick={() => step(-1)}
    disabled={!canStepBack}
    aria-label='Previous month'
   >
    <StepChevron back />
   </button>

   {badge}

   <button
    type='button'
    className='monthStepper__arrow'
    onClick={() => step(1)}
    disabled={!canStepForward}
    aria-label='Next month'
   >
    <StepChevron back={false} />
   </button>
  </div>
 );
}

const MemoizedMonthPicker = React.memo(MonthPicker);

MemoizedMonthPicker.displayName = 'MonthPicker';

export default MemoizedMonthPicker;
