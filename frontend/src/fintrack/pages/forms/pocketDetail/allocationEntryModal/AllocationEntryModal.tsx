// frontend/src/fintrack/pages/forms/pocketDetail/allocationEntryModal/AllocationEntryModal.tsx
// 🧾 ONE DECISION, IN FULL: a single row of the pocket's commitment history.
//
// The row on the screen behind carries the word, the account and the amount.
// This carries what the row has no space for and the audit trail needs: the day
// the decision was taken, and the proof that the conversion ran — the figure as
// it was typed, the rate that produced the stored one, and where that rate came
// from.
//
// It fabricates nothing. Every field is served on the history entry, and the
// conversion block renders only when a conversion actually happened.
//
// A modal and not a route: it opens over the screen it belongs to and closes
// back onto it, and there is nothing to fetch — the entry is already in hand
// from the payload that drew the list.

import { createPortal } from 'react-dom';

import FxPathwayCard from '../../../../general_components/fxPathwayCard/FxPathwayCard';
import {
 formatCalendarDate,
 numberFormatCurrency,
} from '../../../../helpers/functions';
import { PocketAllocationEntry } from '../../../../types/pocketTypes';
import { CurrencyType } from '../../../../types/types';
import { useModalDialog } from '../../../../../hooks/useModalDialog';

import './styles/allocationEntryModal-styles.css';

// A field the payload withheld. Never 0, which would be a figure.
const DASH = '—';

type AllocationEntryModalPropType = {
 entry: PocketAllocationEntry;
 // The pocket's accounting currency — the unit the stored figure is kept in,
 // never the one it may have been typed in.
 currency: CurrencyType;
 onClose: () => void;
};

function AllocationEntryModal({
 entry,
 currency,
 onClose,
}: AllocationEntryModalPropType) {
 // The sign is the decision, and the word says it. Neither ever moved a
 // balance: committing and releasing change what is promised, not what is held.
 const isRelease = entry.amount < 0;

 // Escape, the caret in and back out, the scroll lock, inert on #root and the
 // Tab cycle -- the same effects this file carried, now stated once. The title
 // id is generated rather than the module constant it replaces: two entries
 // opened in one session shared that string and both named the first heading.
 const { titleId, dialogProps } = useModalDialog({ onClose });

 // Absolute, because the word above it already carries the direction. A minus
 // beside the word "Released" says the same thing twice and invites the reader
 // to wonder whether the two disagree.
 const storedAmount = numberFormatCurrency(
  Math.abs(entry.amount),
  2,
  currency,
 );

 return createPortal(
  <div className='allocationEntry__overlay' onClick={onClose}>
   <div
    className='allocationEntry__panel'
    {...dialogProps}
    onClick={(event) => event.stopPropagation()}
   >
    <div className='allocationEntry__header'>
     <h2 className='allocationEntry__title' id={titleId}>
      {isRelease ? 'Released' : 'Committed'}
     </h2>

     <button
      type='button'
      className='allocationEntry__close'
      onClick={onClose}
      aria-label='Close this entry'
     >
      ✕
     </button>
    </div>

    <div className='allocationEntry__hero'>
     <span className='allocationEntry__amount'>{storedAmount}</span>

     {/* The day the decision was taken, not the day the row was written: one
         agreed on Friday and typed on Monday is Friday's. Built from the parts
         of the calendar label the server resolved on the owner's clock. */}
     <span className='allocationEntry__stamp'>
      {formatCalendarDate(entry.allocationDate)}
     </span>
    </div>

    <section className='allocationEntry__card'>
     <h3 className='allocationEntry__cardTitle'>Account</h3>

     <div className='allocationEntry__row'>
      <span className='allocationEntry__label'>Source</span>
      <span className='allocationEntry__value'>
       {/* The ledger names an account this read could not resolve — one the
           owner removed, or the internal account the read filters out. What it
           holds is still counted; only the name is missing. */}
       {entry.sourceAccountName ?? DASH}
      </span>
     </div>

     <div className='allocationEntry__row'>
      <span className='allocationEntry__label'>Direction</span>
      <span className='allocationEntry__value'>
       {isRelease
        ? 'Back to the account as unassigned cash'
        : 'Promised to this goal'}
      </span>
     </div>
    </section>

    <FxPathwayCard
     originalAmount={entry.originalAmount}
     originalCurrency={entry.originalCurrency}
     storedAmount={entry.amount}
     accountingCurrency={currency}
     exchangeRate={entry.exchangeRate}
     exchangeRateTimestamp={entry.exchangeRateTimestamp}
     exchangeRateSource={entry.exchangeRateSource}
    />
   </div>
  </div>,
  document.body,
 );
}

export default AllocationEntryModal;
