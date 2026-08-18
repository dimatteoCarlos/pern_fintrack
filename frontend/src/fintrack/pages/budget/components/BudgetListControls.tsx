// frontend/src/fintrack/pages/budget/components/BudgetListControls.tsx
// 🎛️ BUDGET LIST CONTROLS: reaching a row without scrolling to it
//
// Level 1 folds a hundred accounts into categories and hands the reader one
// tool, the scrollbar. This is the other four: a term shortens the list, a key
// puts the answer on top, a switch keeps only the rows that broke their budget,
// and the counter states that what is on screen is a subset of what the month
// holds. All four on one line — the row under them exists only while the
// counter has something to say.
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

import type {
 BudgetQuickFilter,
 BudgetSortDirection,
 BudgetSortKey,
} from '../hooks/useBudgetListFilter';
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

// The word the toggle carries to a screen reader and to a tooltip, since it has
// no room for it on screen. Declared here and not handed over by the caller,
// unlike the sort keys: both levels filter on the same served isOverBudget, so
// there is nothing a level could reword.
const OVER_FILTER_LABEL = 'Over budget';

type IconProps = {
 children: React.ReactNode;
 className?: string;
};

// Drawn here rather than imported: Vite types an .svg import as a string, so an
// icon cannot travel as a component (R34). They differ only in their paths, so
// the shared attributes are written once.
//
// No width or height: the stylesheet sizes them off the control's font size, so
// an icon never has to be re-tuned when the text is.
const Icon = ({ children, className }: IconProps) => (
 <svg
  className={className}
  viewBox='0 0 24 24'
  fill='none'
  stroke='currentColor'
  strokeWidth='2'
  strokeLinecap='round'
  strokeLinejoin='round'
  aria-hidden='true'
  focusable='false'
 >
  {children}
 </svg>
);

type BudgetListControlsProps = {
 search: string;
 onSearchChange: (value: string) => void;
 // Names what is being searched, on screen and to a screen reader.
 searchLabel: string;
 // The longest name this level can hold. Owned by the caller for the same
 // reason the label is: level 1 searches categories and level 2 accounts, and
 // the two columns are not the same width.
 searchMaxLength: number;
 sort: BudgetSortKey;
 onSortChange: (value: BudgetSortKey) => void;
 sortOptions: BudgetSortOption[];
 direction: BudgetSortDirection;
 onDirectionChange: (value: BudgetSortDirection) => void;
 quickFilter: BudgetQuickFilter;
 onQuickFilterChange: (value: BudgetQuickFilter) => void;
 matched: number;
 total: number;
 isFiltered: boolean;
 state?: BudgetListState;
};

function BudgetListControls({
 search,
 onSearchChange,
 searchLabel,
 searchMaxLength,
 sort,
 onSortChange,
 sortOptions,
 direction,
 onDirectionChange,
 quickFilter,
 onQuickFilterChange,
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
    <div className='budgetListControls__query'>
     <Icon className='budgetListControls__icon'>
      <circle cx='11' cy='11' r='7' />
      <line x1='16.5' y1='16.5' x2='21' y2='21' />
     </Icon>

     <input
      type='search'
      className='budgetListControls__search'
      value={search}
      onChange={(event) => onSearchChange(event.target.value)}
      // One word on screen, the caller's whole phrase to a screen reader. They
      // were the same string until the bar became one row and the phrase
      // stopped fitting: a placeholder cut mid-word reads as broken, not as
      // compact. What the field searches is on the title right above it.
      placeholder='Search'
      aria-label={searchLabel}
      autoComplete='off'
      maxLength={searchMaxLength}
      disabled={isLoading}
     />

     {/* Inside the field and present on every term, not only on the empty
         result: before this the only way out was a button that appeared when
         the list had already gone blank, so a term that matched rows could
         not be undone. */}
     {search && !isLoading && (
      <button
       type='button'
       className='budgetListControls__reset'
       onClick={() => onSearchChange('')}
       aria-label='Clear search'
      >
       <Icon>
        <line x1='6' y1='6' x2='18' y2='18' />
        <line x1='18' y1='6' x2='6' y2='18' />
       </Icon>
      </button>
     )}
    </div>

    <div className='budgetListControls__sort'>
     <div className='budgetListControls__selectBox'>
      {/* Bars of falling length, inside the control rather than a word beside
          it: the word cost the search field the width its placeholder needed.
          The select keeps aria-label, which is now the only name it has. */}
      <Icon className='budgetListControls__icon'>
       <line x1='4' y1='7' x2='20' y2='7' />
       <line x1='4' y1='12' x2='15' y2='12' />
       <line x1='4' y1='17' x2='10' y2='17' />
      </Icon>

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

      {/* Drawn rather than typed: a ▾ character comes from whatever font the
          OS falls back to and shares no stroke weight with the icons beside
          it. Inside this box and not the group, so it stays over the select
          when the direction button is added after it. */}
      <Icon className='budgetListControls__icon budgetListControls__icon--trailing'>
       <polyline points='6 9 12 15 18 9' />
      </Icon>
     </div>

     {/* One control, not two arrows. The select already carries a chevron
         meaning "this opens"; a second and third pointing up and down would be
         three similar glyphs saying two different things. The arrow here is the
         state, so the direction reads without pressing anything. */}
     <button
      type='button'
      className={`budgetListControls__direction${
       direction === 'asc' ? ' is-ascending' : ''
      }`}
      onClick={() => onDirectionChange(direction === 'asc' ? 'desc' : 'asc')}
      aria-label={
       direction === 'asc'
        ? 'Sorted ascending, switch to descending'
        : 'Sorted descending, switch to ascending'
      }
      disabled={isLoading}
     >
      <Icon>
       <line x1='12' y1='4' x2='12' y2='20' />
       <polyline points='6 14 12 20 18 14' />
      </Icon>
     </button>
    </div>

    {/* A switch, not a choice between two things. `All` and `Over budget` are a
        binary in which one value is the absence of a filter, and a pair of
        chips for that cost the bar a second row of its own.

        A warning sign rather than a funnel: what this turns on is "show me the
        problems", and the red it lights in is the one the row's square already
        uses for the same fact. The word it cannot show lives in aria-label and
        in title.

        aria-pressed and not a radio group: the pressed state is exactly what a
        screen reader needs from a toggle, and it needs no arrow-key handling to
        be reachable. It stays OUTSIDE the <p role='status'> below — a control
        inside a live region is announced again on every count change. */}
    <button
     type='button'
     className={`budgetListControls__filter${
      quickFilter === 'over' ? ' is-active' : ''
     }`}
     onClick={() =>
      onQuickFilterChange(quickFilter === 'over' ? 'all' : 'over')
     }
     aria-pressed={quickFilter === 'over'}
     aria-label={OVER_FILTER_LABEL}
     title={OVER_FILTER_LABEL}
     disabled={isLoading}
    >
     <Icon>
      <path d='M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01' />
     </Icon>
    </button>
   </div>

   {/* Its own element and not a reserved row: it collapses to nothing while
       there is nothing to say, so the bar is one line whenever the reader is
       not filtering. */}
   <p className='budgetListControls__status' role='status'>
    {isEmpty && (
     <span className='budgetListControls__message'>
      {search ? `No results for “${search}”` : 'No results'}
     </span>
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
