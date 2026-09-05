// frontend/src/fintrack/pages/forms/pocketDetail/pocketAllocationModal/PocketSourcePicker.tsx
// 🏦 SOURCE PICKER: which account the cash moves between.
//
// One list, two meanings, and the caller decides which. Committing draws from
// every bank the owner holds, bounded by what each has left uncommitted;
// releasing draws only from the accounts already funding THIS pocket, bounded
// by what this pocket holds from each of them.
//
// Three figures per row and never one. A pocket blocks no spending, so the
// account's available balance is still its whole balance — naming the remainder
// "available" would tell the owner they cannot spend money they can. The word
// appears nowhere here.

import { CurrencyType } from '../../../../types/types.ts';
import { numberFormatCurrency } from '../../../../helpers/functions.ts';

// A figure the payload withheld. Never 0: a zero would state that nothing is
// committed to an account the read could not answer for.
const DASH = '—';

// One row of the picker, already reduced to what a row shows. Both callers
// build this from their own shape, so the picker never knows whether it is
// looking at every bank or at the accounts funding one pocket.
export type PocketSourceOption = {
 accountId: number;
 accountName: string;
 // The whole balance. Still spendable in full — a commitment is a plan, not a
 // lock.
 balance: number | null;
 // What this account has promised to goals, across all of them.
 committed: number | null;
 // The most this decision can move, in the pocket's accounting currency. Null
 // when the read could not answer for the row, and the caller then leaves the
 // server to apply the real bound.
 ceiling: number | null;
};

type PocketSourcePickerPropType = {
 options: PocketSourceOption[];
 selectedAccountId: number | null;
 onSelect: (accountId: number) => void;
 // The pocket's accounting currency, which every figure below is stated in.
 currency: CurrencyType;
 // What the third column means in this direction, in the owner's words.
 ceilingLabel: string;
 disabled?: boolean;
};

function PocketSourcePicker({
 options,
 selectedAccountId,
 onSelect,
 currency,
 ceilingLabel,
 disabled = false,
}: PocketSourcePickerPropType) {
 const asMoney = (value: number | null) =>
  value === null ? DASH : numberFormatCurrency(value, 2, currency);

 if (options.length === 0) {
  return (
   <p className='pocketAllocation__empty'>
    No account can be used for this yet.
   </p>
  );
 }

 return (
  // A radio group and not a select: the choice carries three figures per option
  // and a native select can show only the label. role and aria-checked are what
  // make a list of buttons announce itself as one choice among several.
  <div className='pocketAllocation__picker' role='radiogroup'>
   {options.map((option) => {
    const isSelected = option.accountId === selectedAccountId;

    return (
     <button
      type='button'
      role='radio'
      aria-checked={isSelected}
      key={`source-${option.accountId}`}
      className={`pocketAllocation__source ${isSelected ? 'is-selected' : ''}`.trim()}
      onClick={() => onSelect(option.accountId)}
      disabled={disabled}
     >
      <span className='pocketAllocation__sourceName'>{option.accountName}</span>

      <span className='pocketAllocation__sourceFigures'>
       <span className='pocketAllocation__sourceFigure'>
        Balance {asMoney(option.balance)}
       </span>

       {/* "Allocated" and not "Committed". They are one quantity and this
           screen printed both words for it, the plan strip above saying
           allocated while these rows said committed. Allocated is the word the
           module froze (POCKET_DECISIONS 18.1). */}
       <span className='pocketAllocation__sourceFigure'>
        Allocated {asMoney(option.committed)}
       </span>

       <span className='pocketAllocation__sourceFigure pocketAllocation__sourceFigure--ceiling'>
        {ceilingLabel} {asMoney(option.ceiling)}
       </span>
      </span>
     </button>
    );
   })}
  </div>
 );
}

export default PocketSourcePicker;
