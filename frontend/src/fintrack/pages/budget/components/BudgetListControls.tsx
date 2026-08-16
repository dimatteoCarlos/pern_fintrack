// frontend/src/fintrack/pages/budget/components/BudgetListControls.tsx
// 🎛️ BUDGET LIST CONTROLS: reaching a row without scrolling to it
//
// Level 1 folds a hundred accounts into categories and hands the reader one
// tool, the scrollbar. This is the other three: a term shortens the list, a key
// puts the answer on top, and the counter states that what is on screen is a
// subset of what the month holds.
//
// It owns no state and issues no request. Every value arrives as a prop so the
// caller can back them with the URL, and that is why the sort control is a
// native <select>: it takes `value`, so a page opened on ?sort=spent shows a
// control and a list that agree. The shared DropDownSelection is uncontrolled
// and would have displayed its placeholder over an already sorted list.
//
// It never states a total of its own. `matched` and `total` come from
// useBudgetListFilter, and the header keeps the server's figures: filtering
// changes what is listed, never what is reported.

import React from 'react';

import type { BudgetSortKey } from '../hooks/useBudgetListFilter';
import '../styles/budgetListControls.css';

// The wording belongs to the caller, not here: level 1 has no subcategory to
// order by and level 2 does, so the two levels offer different keys.
export type BudgetSortOption = {
 value: BudgetSortKey;
 label: string;
};

// What the list behind the bar is doing. `unavailable` covers both a failed
// request and a month holding nothing: either way there is nothing to search,
// and a control over an empty list is an invitation to a dead end.
export type BudgetListState = 'ready' | 'loading' | 'unavailable';

type BudgetListControlsProps = {
 search: string;
 onSearchChange: (value: string) => void;
 // Names what is being searched, on screen and to a screen reader.
 searchLabel: string;
 sort: BudgetSortKey;
 onSortChange: (value: BudgetSortKey) => void;
 sortOptions: BudgetSortOption[];
 matched: number;
 total: number;
 isFiltered: boolean;
 state?: BudgetListState;
};

function BudgetListControls({
 search,
 onSearchChange,
 searchLabel,
 sort,
 onSortChange,
 sortOptions,
 matched,
 total,
 isFiltered,
 state = 'ready',
}: BudgetListControlsProps) {
 const isReady = state === 'ready';
 const isLoading = state === 'loading';

 // Nothing to filter: the bar is off rather than disabled, because a disabled
 // control still claims its space and still says the tool exists.
 if (state === 'unavailable' || (isReady && total === 0)) return null;

 // Filtered down to nothing. A message and a way out, never a blank area: the
 // reader has to be told that the list is empty because of the term they typed
 // and not because the month is.
 const isEmpty = isReady && isFiltered && matched === 0;
 const isSubset = isReady && isFiltered && matched > 0;

 // A native select hands back a string. The cast is safe because every option
 // rendered below is typed as a BudgetSortKey.
 const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
  onSortChange(event.target.value as BudgetSortKey);

 return (
  <div className='budgetListControls'>
   <div className='budgetListControls__fields'>
    <input
     type='search'
     className='budgetListControls__search'
     value={search}
     onChange={(event) => onSearchChange(event.target.value)}
     placeholder={searchLabel}
     aria-label={searchLabel}
     autoComplete='off'
     disabled={isLoading}
    />

    <div className='budgetListControls__sort'>
     <select
      className='budgetListControls__select'
      value={sort}
      onChange={handleSortChange}
      aria-label='Sort by'
      disabled={isLoading}
     >
      {sortOptions.map((option) => (
       <option key={option.value} value={option.value}>
        {option.label}
       </option>
      ))}
     </select>
    </div>
   </div>

   {/* Rendered whether or not it has anything to say. A line that appeared on
       the first keystroke would push the list down as the reader types. */}
   <p className='budgetListControls__status' role='status'>
    {isEmpty && (
     <>
      <span className='budgetListControls__message'>
       {search ? `No results for “${search}”` : 'No results'}
      </span>
      <button
       type='button'
       className='budgetListControls__clear'
       onClick={() => onSearchChange('')}
      >
       Clear
      </button>
     </>
    )}

    {isSubset && (
     <span className='budgetListControls__message'>
      Showing {matched} of {total}
     </span>
    )}
   </p>
  </div>
 );
}

export default BudgetListControls;
