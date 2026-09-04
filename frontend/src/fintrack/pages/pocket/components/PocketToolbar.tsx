// frontend/src/fintrack/pages/pocket/components/PocketToolbar.tsx
// 🎛️ POCKET LIST CONTROLS: reaching a pocket without scrolling to it
//
// PLAN_POCKET_FE.md §7.1 names three tools for the board — search by name,
// three sort criteria, and a set of filters that are exclusive rather than
// cumulative — and none of the three cost the board a query parameter,
// because every field they read is already on the row. Same shape as
// BudgetListControls, which owns none of its own state either: every value
// arrives as a prop so the caller can back them with the URL, and ListPocket
// does exactly that, for the reason ListCategory's header already states —
// entering a pocket's detail unmounts this list, and a term held in
// component state would not survive the trip back.
//
// The filter options are POCKET_STATUS_WORD, the same map ListPocket's own
// cards read for their status square's word, plus 'All' and the one orthogonal
// reading.
// Nothing here spells a status in its own words: a filter option is only ever
// a word the reader can already find printed on this same screen.
//
// It never states a total of its own. `matched` and `total` come from
// usePocketListFilter, and the hero above keeps the server's own counts:
// filtering changes what is listed, never what is reported.

import ChevronDownSvg from '../../../../assets/pocketSvg/ChevronDownSvg.svg?react';
import ClearSvg from '../../../../assets/pocketSvg/ClearSvg.svg?react';
import SearchSvg from '../../../../assets/pocketSvg/SearchSvg.svg?react';
import SortDirectionSvg from '../../../../assets/pocketSvg/SortDirectionSvg.svg?react';
import { POCKET_STATUS_WORD } from '../../../helpers/pocketStatus';
import type {
 PocketQuickFilter,
 PocketSortDirection,
 PocketSortKey,
} from '../hooks/usePocketListFilter';
import '../styles/pocketToolbar.css';

const SORT_OPTIONS: { value: PocketSortKey; label: string }[] = [
 { value: 'date', label: 'Deadline' },
 { value: 'name', label: 'Name' },
 { value: 'remaining', label: 'Still to allocate' },
];

// 'All' first, as the absence of a filter; the seven levels in the order they
// READ, from the one that asks least of the owner to the one that asks most —
// the same order POCKET_STATUS_WORD declares and the same order the server's
// own POCKET_LEVELS uses. A select whose options run in severity order lets the
// reader find one by position instead of by scanning every label.
//
// The one orthogonal value goes last, after the levels, because it is not an
// eighth level of them. Ahead of plan was orthogonal too, and had a separate
// toggle beside this select until 2026-09-04; it is a level now, so it sits in
// the run rather than at the end.
const FILTER_OPTIONS: { value: PocketQuickFilter; label: string }[] = [
 { value: 'all', label: 'All' },
 { value: 'completed', label: POCKET_STATUS_WORD.completed },
 { value: 'aboveTarget', label: POCKET_STATUS_WORD.aboveTarget },
 { value: 'ahead', label: POCKET_STATUS_WORD.ahead },
 { value: 'onTrack', label: POCKET_STATUS_WORD.onTrack },
 { value: 'behind', label: POCKET_STATUS_WORD.behind },
 { value: 'atRisk', label: POCKET_STATUS_WORD.atRisk },
 { value: 'overdue', label: POCKET_STATUS_WORD.overdue },
 // "Funding", not the bare word allocation, which the module's naming rule
 // forbids as ambiguous between a pocket allocation and a monthly budget
 // one. It is also the noun the card already uses for the same fact.
 { value: 'uncovered', label: 'Funding not covered' },
];

const SEARCH_MAX_LENGTH = 50;

type PocketToolbarProps = {
 search: string;
 onSearchChange: (value: string) => void;
 sort: PocketSortKey;
 onSortChange: (value: PocketSortKey) => void;
 direction: PocketSortDirection;
 onDirectionChange: (value: PocketSortDirection) => void;
 quickFilter: PocketQuickFilter;
 onQuickFilterChange: (value: PocketQuickFilter) => void;
 matched: number;
 total: number;
 isFiltered: boolean;
};

function PocketToolbar({
 search,
 onSearchChange,
 sort,
 onSortChange,
 direction,
 onDirectionChange,
 quickFilter,
 onQuickFilterChange,
 matched,
 total,
 isFiltered,
}: PocketToolbarProps) {
 // Filtered down to nothing. A message and a way out, never a blank list: the
 // reader has to be told the board is short because of the term or the filter
 // they chose and not because there is nothing to plan towards.
 const isEmpty = isFiltered && matched === 0;
 const isSubset = isFiltered && matched > 0;

 return (
  <div className='pocketToolbar'>
   <div className='pocketToolbar__fields'>
    <div className='pocketToolbar__query'>
     <SearchSvg className='pocketToolbar__icon' />

     <input
      type='search'
      className='pocketToolbar__search'
      value={search}
      onChange={(event) => onSearchChange(event.target.value)}
      placeholder='Search'
      aria-label='Search pockets'
      autoComplete='off'
      maxLength={SEARCH_MAX_LENGTH}
     />

     {/* Present on every term, not only once the result has gone blank: a
         term that still matches rows has to be undoable too. */}
     {search && (
      <button
       type='button'
       className='pocketToolbar__reset'
       onClick={() => onSearchChange('')}
       aria-label='Clear search'
      >
       <ClearSvg />
      </button>
     )}
    </div>

    <div className='pocketToolbar__sort'>
     <div className='pocketToolbar__selectBox'>
      <select
       className='pocketToolbar__select'
       value={sort}
       onChange={(event) => onSortChange(event.target.value as PocketSortKey)}
       aria-label='Sort by'
      >
       {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
         {option.label}
        </option>
       ))}
      </select>

      <ChevronDownSvg className='pocketToolbar__icon pocketToolbar__icon--trailing' />
     </div>

     {/* One control, not two arrows: the select already carries a chevron
         meaning "this opens", and the direction is a separate question —
         which end of the same key comes first. */}
     <button
      type='button'
      className={`pocketToolbar__direction${
       direction === 'asc' ? ' is-ascending' : ''
      }`}
      onClick={() => onDirectionChange(direction === 'asc' ? 'desc' : 'asc')}
      aria-label={
       direction === 'asc'
        ? 'Sorted ascending, switch to descending'
        : 'Sorted descending, switch to ascending'
      }
     >
      <SortDirectionSvg />
     </button>
    </div>

    <div className='pocketToolbar__selectBox pocketToolbar__selectBox--filter'>
     <select
      className='pocketToolbar__select'
      value={quickFilter}
      onChange={(event) =>
       onQuickFilterChange(event.target.value as PocketQuickFilter)
      }
      aria-label='Filter'
     >
      {FILTER_OPTIONS.map((option) => (
       <option key={option.value} value={option.value}>
        {option.label}
       </option>
      ))}
     </select>

     <ChevronDownSvg className='pocketToolbar__icon pocketToolbar__icon--trailing' />
    </div>

   </div>

   {/* Collapses to nothing while there is no count to report, so the bar is
       one line whenever the reader is not narrowing the board. */}
   <p className='pocketToolbar__status' role='status'>
    {isEmpty && (
     <span className='pocketToolbar__message'>
      {search ? `No pockets match “${search}”` : 'No pockets match this filter'}
     </span>
    )}

    {isSubset && (
     <span className='pocketToolbar__message'>
      Showing {matched} of {total}
     </span>
    )}
   </p>
  </div>
 );
}

export default PocketToolbar;
