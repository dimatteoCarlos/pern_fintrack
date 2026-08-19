// frontend/src/fintrack/pages/budget/components/budgetEditModal/BudgetEditModal.tsx
// 💵 BUDGET EDIT MODAL: the form that writes one month of a budget
//
// The module has read and never written since it was built. This states an
// amount for the month on screen and how far forward it reaches: this month
// alone, up to a month the user names, or every month from here on.
//
// It owns no request. The amount travels to the caller through onSave, which
// resolves with the server's answer so this can word what next month goes back
// to without asking a second time.
//
// The payload states its own range: PUT /budget/accounts/:accountId/current
// takes a first month and a last one, so a save reaches as far as it was told
// to. The caller is what refuses to open this over a past month.

import { useEffect, useMemo, useRef, useState } from 'react';

import {
 CURRENCY_OPTIONS,
 DEFAULT_CURRENCY,
} from '../../../../helpers/currencyConstants';
import { DATE_TEXT_FORMAT } from '../../../../helpers/constants';
import { numberFormatCurrency } from '../../../../helpers/functions';
import { CurrencyType } from '../../../../types/types';
import {
 OPEN_ENDED,
 BudgetWriteRequest,
 BudgetWriteResponse,
} from '../../../../types/budgetTypes';

import './styles/budgetEditModal-styles.css';

type BudgetEditModalPropsType = {
 accountName: string;
 // The month the figures below are about, as 'YYYY-MM-01'.
 month: string;
 currency: CurrencyType;
 // The four figures the form reads. currentAmount is the row's budgetAmount;
 // an amount is decided against what was already spent, so the three that
 // qualify it travel with it rather than staying on the row behind the panel.
 currentAmount: number;
 nextMonthBudget: number;
 actualSpent: number;
 remainingBudget: number;
 isSaving: boolean;
 error: string | null;
 onClose: () => void;
 // Takes the whole payload and not an amount plus a flag: this form is what
 // decides the range, so the caller only has the accountId left to add.
 // Resolves with what the server wrote, or null when the caller has nothing
 // wired yet. The response is what states the month the exception expires on.
 onSave: (allocation: BudgetWriteRequest) => Promise<BudgetWriteResponse | null>;
};

const TITLE_ID = 'budgetEditTitle';

// How far the month selector reaches, counting the month on screen. An
// interface limit and not a server rule: the write path puts no ceiling on
// appliesUntil, so widening this is a change to this number and nothing else.
const MAX_RANGE_MONTHS = 12;

// The three shapes appliesUntil can take, named rather than derived from the
// value: 'thisMonth' and 'untilMonth' both send a month, and only the mode
// tells them apart before one is picked.
type RangeModeType = 'thisMonth' | 'untilMonth' | 'recurring';

// Built from the parts and never from new Date(month): that string parses as UTC
// midnight, so west of Greenwich it renders the previous month.
const formatMonth = (month: string) => {
 const [year, monthNumber] = month.split('-').map(Number);
 if (!year || !monthNumber) return month;

 return new Date(year, monthNumber - 1, 1).toLocaleDateString(DATE_TEXT_FORMAT, {
  month: 'long',
  year: 'numeric',
 });
};

// The `count` months that follow `month`, as 'YYYY-MM-01'. Reassembled from the
// parts for the same reason formatMonth is: a Date built from the string is UTC
// midnight, and adding to it west of Greenwich lands a month early.
const monthsAfter = (month: string, count: number) => {
 const [year, monthNumber] = month.split('-').map(Number);
 if (!year || !monthNumber) return [];

 return Array.from({ length: count }, (_, index) => {
  const offset = monthNumber + index;

  return `${year + Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}-01`;
 });
};

function BudgetEditModal({
 accountName,
 month,
 currency,
 currentAmount,
 nextMonthBudget,
 actualSpent,
 remainingBudget,
 isSaving,
 error,
 onClose,
 onSave,
}: BudgetEditModalPropsType) {
 const panelRef = useRef<HTMLDivElement>(null);

 // Prefilled rather than empty: editing is correcting a figure, and a blank
 // field hides the one being corrected.
 const [amount, setAmount] = useState(() => String(currentAmount));

 // This month is already an exception when the next one does not inherit it.
 // Opening on 'recurring' over one would let a save turn it recurring unasked.
 //
 // 'untilMonth' is never the initial mode: the status payload carries this
 // month and the next one, so a terminator further out is invisible from here.
 const initialRangeMode: RangeModeType =
  nextMonthBudget !== currentAmount ? 'thisMonth' : 'recurring';
 const [rangeMode, setRangeMode] = useState<RangeModeType>(initialRangeMode);

 // One short of MAX_RANGE_MONTHS: the month on screen is the first radio, not
 // an option of this list.
 const rangeOptions = useMemo(
  () => monthsAfter(month, MAX_RANGE_MONTHS - 1),
  [month],
 );
 const [untilMonth, setUntilMonth] = useState(() => rangeOptions[0] ?? month);

 useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape') onClose();
  };

  window.addEventListener('keydown', handleKeyDown);
  panelRef.current?.focus();

  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [onClose]);

 const locale = CURRENCY_OPTIONS[currency ?? DEFAULT_CURRENCY];
 const asMoney = (value: number) =>
  numberFormatCurrency(value, 2, currency, locale);

 const parsedAmount = Number(amount);
 const isNumber = amount.trim() !== '' && Number.isFinite(parsedAmount);

 // Would store as 0.00 while not being a zero the user typed. The service
 // rejects it; saying so here costs no round trip.
 const isSubCent =
  isNumber && parsedAmount > 0 && Math.round(parsedAmount * 100) === 0;

 // What the three radios resolve to on the wire. 'thisMonth' sends the month
 // itself: a range whose last month is its first is the exception.
 const appliesUntil =
  rangeMode === 'thisMonth'
   ? month
   : rangeMode === 'untilMonth'
     ? untilMonth
     : OPEN_ENDED;

 // Compared on the resulting appliesUntil rather than on the mode, because the
 // mode plus the selected month is the same decision stated twice.
 const initialAppliesUntil =
  initialRangeMode === 'thisMonth' ? month : OPEN_ENDED;

 const isUnchanged =
  isNumber &&
  parsedAmount === currentAmount &&
  appliesUntil === initialAppliesUntil;

 const isDirty =
  amount !== String(currentAmount) || appliesUntil !== initialAppliesUntil;

 const canSave = isNumber && !isSubCent && !isUnchanged && !isSaving;

 // The resolved response is dropped here and read by the commit that words the
 // confirmation. The signature carries it so that commit changes this file and
 // not the two callers.
 const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  if (!canSave) return;

  await onSave({ amount: parsedAmount, month, appliesUntil });
 };

 // A read-only modal can close on any outside click; one holding typed input
 // cannot, so the overlay only closes a form nothing has been done to.
 const handleOverlayClick = () => {
  if (!isDirty && !isSaving) onClose();
 };

 return (
  <div
   className='budgetEdit'
   role='dialog'
   aria-modal='true'
   aria-labelledby={TITLE_ID}
   onClick={handleOverlayClick}
  >
   <div
    className='budgetEdit__panel'
    ref={panelRef}
    tabIndex={-1}
    onClick={(event) => event.stopPropagation()}
   >
    <div className='budgetEdit__header'>
     <h2 id={TITLE_ID} className='budgetEdit__title'>
      {accountName}
      <span className='budgetEdit__month'>{formatMonth(month)}</span>
     </h2>

     <button
      type='button'
      className='budgetEdit__close'
      onClick={onClose}
      aria-label='Close budget editor'
      disabled={isSaving}
     >
      ✕
     </button>
    </div>

    {/* What the amount is being decided against. Read-only: this form writes
        the budget and nothing else. */}
    <dl className='budgetEdit__context'>
     <div className='budgetEdit__contextRow'>
      <dt className='budgetEdit__contextLabel'>Current</dt>
      <dd className='budgetEdit__contextValue'>{asMoney(currentAmount)}</dd>
     </div>

     <div className='budgetEdit__contextRow'>
      <dt className='budgetEdit__contextLabel'>Spent</dt>
      <dd className='budgetEdit__contextValue'>{asMoney(actualSpent)}</dd>
     </div>

     <div className='budgetEdit__contextRow'>
      <dt className='budgetEdit__contextLabel'>
       {remainingBudget < 0 ? 'Over' : 'Left'}
      </dt>
      <dd className='budgetEdit__contextValue'>
       {asMoney(Math.abs(remainingBudget))}
      </dd>
     </div>
    </dl>

    <form className='budgetEdit__form' onSubmit={handleSubmit}>
     <label className='budgetEdit__label' htmlFor='budgetEditAmount'>
      New budget
     </label>

     {/* min='0' and not 0.01: the schema is nonnegative and a zero is how
         "stop budgeting" is expressed, so the client must be able to send it. */}
     <input
      id='budgetEditAmount'
      className='budgetEdit__input'
      type='number'
      inputMode='decimal'
      min='0'
      step='0.01'
      value={amount}
      onChange={(event) => setAmount(event.target.value)}
      disabled={isSaving}
      autoComplete='off'
     />

     {isSubCent && (
      <p className='budgetEdit__hint'>
       An amount under one cent would be stored as zero.
      </p>
     )}

     {/* A fieldset because the three are one question, and because its
         disabled attribute covers every control inside it. */}
     <fieldset className='budgetEdit__range' disabled={isSaving}>
      <legend className='budgetEdit__label budgetEdit__legend'>
       Applies to
      </legend>

      <label className='budgetEdit__rangeOption'>
       <input
        className='budgetEdit__radio'
        type='radio'
        name='budgetEditRange'
        checked={rangeMode === 'thisMonth'}
        onChange={() => setRangeMode('thisMonth')}
       />
       Only this month
      </label>

      {/* The selector is a sibling of the label and not inside it: a control
          nested in a label joins that label's accessible name. */}
      <div className='budgetEdit__rangeRow'>
       <label className='budgetEdit__rangeOption'>
        <input
         className='budgetEdit__radio'
         type='radio'
         name='budgetEditRange'
         checked={rangeMode === 'untilMonth'}
         onChange={() => setRangeMode('untilMonth')}
        />
        Until a month I choose
       </label>

       {rangeMode === 'untilMonth' && (
        <select
         className='budgetEdit__select'
         value={untilMonth}
         onChange={(event) => setUntilMonth(event.target.value)}
         aria-label='Last month the amount applies to'
        >
         {rangeOptions.map((option) => (
          <option key={option} value={option}>
           {formatMonth(option)}
          </option>
         ))}
        </select>
       )}
      </div>

      <label className='budgetEdit__rangeOption'>
       <input
        className='budgetEdit__radio'
        type='radio'
        name='budgetEditRange'
        checked={rangeMode === 'recurring'}
        onChange={() => setRangeMode('recurring')}
       />
       Every month
      </label>
     </fieldset>

     {error && (
      <p className='budgetEdit__error' role='alert'>
       {error}
      </p>
     )}

     <div className='budgetEdit__actions'>
      <button
       type='button'
       className='budgetEdit__button budgetEdit__button--secondary'
       onClick={onClose}
       disabled={isSaving}
      >
       Cancel
      </button>

      <button
       type='submit'
       className='budgetEdit__button budgetEdit__button--primary'
       disabled={!canSave}
      >
       {isSaving ? 'Saving…' : 'Save'}
      </button>
     </div>
    </form>
   </div>
  </div>
 );
}

export default BudgetEditModal;
