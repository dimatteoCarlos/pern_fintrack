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

import React, { useEffect, useRef, useState } from 'react';

// One file each, under `assets/budgetListControlsSvg/`, entering through the
// '?react' suffix: a bare .svg import is typed `string` and cannot take a
// className (R34). Each file carries the stroke and the viewBox and no width or
// height, so the stylesheet keeps sizing them off the control's font size and an
// icon never has to be re-tuned when the text is.
import ChevronDownSvg from '../../../../assets/budgetListControlsSvg/ChevronDownSvg.svg?react';
import ClearSvg from '../../../../assets/budgetListControlsSvg/ClearSvg.svg?react';
import OverBudgetSvg from '../../../../assets/budgetListControlsSvg/OverBudgetSvg.svg?react';
import SearchSvg from '../../../../assets/budgetListControlsSvg/SearchSvg.svg?react';
import SortDirectionSvg from '../../../../assets/budgetListControlsSvg/SortDirectionSvg.svg?react';
import SortSvg from '../../../../assets/budgetListControlsSvg/SortSvg.svg?react';

import type {
 BudgetQuickFilter,
 BudgetSortDirection,
 BudgetSortKey,
} from '../hooks/useBudgetListFilter';
import { useClickOutside } from '../../../editionAndDeletion/hooks/useClickOutside';
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

// What the trigger is once there is more than one thing behind it. The word is
// about the group, not about either entry: a trigger named after one of its own
// options reads as that option and the other one is never looked for.
const MENU_LABEL = 'Budget attention';

// The reader-facing name of the variance screen, and it matches the heading
// that screen draws. The board already rules its own column `Spent / Budget`,
// so this is the vocabulary the reader has. `variance` is the term the practice
// uses for the difference - not the statistical variance, which is a different
// quantity that happens to share the word - and it is taught in that screen's
// caption rather than assumed in a menu entry.
const VARIANCE_LABEL = 'Spent vs budget';

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
 // Absent at level 2, and that absence is the switch: with nothing else to
 // offer, the trigger stays the one-tap toggle it is today rather than becoming
 // a menu holding a single entry.
 onOpenVariance?: () => void;
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
 onOpenVariance,
}: BudgetListControlsProps) {
 const isReady = state === 'ready';
 const isLoading = state === 'loading';

 // Declared above the early return below, not beside the markup that uses them:
 // this component returns null for an unavailable list, and a hook called after
 // that point would run on some renders and not others.
 const [isMenuOpen, setIsMenuOpen] = useState(false);
 const menuRef = useRef<HTMLDivElement>(null);
 const hasMenu = onOpenVariance !== undefined;

 useClickOutside(menuRef, () => setIsMenuOpen(false), isMenuOpen);

 // Escape closes it, the same as the export menu and the two overview export
 // controls. A menu that only closes by clicking elsewhere strands a reader who
 // opened it from the keyboard.
 useEffect(() => {
  if (!isMenuOpen) return;

  const onKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape') setIsMenuOpen(false);
  };

  document.addEventListener('keydown', onKeyDown);

  return () => document.removeEventListener('keydown', onKeyDown);
 }, [isMenuOpen]);

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
   {/* The anchor for the menu, and it has to be a wrapper rather than the strip
       itself: .budgetListControls__fields carries overflow: hidden so the
       filter segment's fill cannot square off the rounded corner, and anything
       absolutely positioned inside it would be clipped by that. */}
   <div className='budgetListControls__bar' ref={menuRef}>
    <div className='budgetListControls__fields'>
     <div className='budgetListControls__query'>
      <SearchSvg className='budgetListControls__icon' />

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
        <ClearSvg />
       </button>
      )}
     </div>

     <div className='budgetListControls__sort'>
      <div className='budgetListControls__selectBox'>
       {/* Bars of falling length, inside the control rather than a word beside
           it: the word cost the search field the width its placeholder needed.
           The select keeps aria-label, which is now the only name it has. */}
       <SortSvg className='budgetListControls__icon' />

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
       <ChevronDownSvg className='budgetListControls__icon budgetListControls__icon--trailing' />
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
       <SortDirectionSvg />
      </button>
     </div>

     {/* THE SAME SEGMENT, TWO CONTROLS, and which one it is depends on whether
         the caller has a second thing to offer.

         A warning sign rather than a funnel, in both: what this leads to is
         "show me the problems", and the red it lights in is the one the row's
         square already uses for the same fact. The word it cannot show lives in
         aria-label and in title.

         Where there is only the filter it stays a toggle, and aria-pressed is
         what a screen reader needs from one. Where there is also the variance
         screen it becomes a menu trigger, and the pair it then announces is
         aria-haspopup with aria-expanded: a trigger that also claimed to be
         pressed would be describing two different states with one attribute.

         The lit state survives the change. is-active still tracks the filter and
         not the menu, so a reader who filtered the list sees that the list is
         filtered without opening anything.

         Both stay OUTSIDE the <p role='status'> below — a control inside a live
         region is announced again on every count change. */}
     {hasMenu ? (
      <button
       type='button'
       className={`budgetListControls__filter${
        quickFilter === 'over' ? ' is-active' : ''
       }`}
       onClick={() => setIsMenuOpen((open) => !open)}
       aria-haspopup='menu'
       aria-expanded={isMenuOpen}
       aria-label={MENU_LABEL}
       title={MENU_LABEL}
       disabled={isLoading}
      >
       <OverBudgetSvg />
      </button>
     ) : (
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
       <OverBudgetSvg />
      </button>
     )}
    </div>

    {/* Two entries, and each is a different kind of thing: the first changes
        what the list behind it shows, the second leaves for another screen.
        menuitemcheckbox says so for the first - a screen reader announces its
        checked state - while the second is a plain menuitem.

        Both close the menu. Leaving it open after a filter would cover the
        rows the filter just changed. */}
    {hasMenu && isMenuOpen && (
     <ul
      className='budgetListControls__menu'
      role='menu'
      aria-label={MENU_LABEL}
     >
      <li role='none'>
       <button
        type='button'
        role='menuitemcheckbox'
        aria-checked={quickFilter === 'over'}
        className='budgetListControls__menuItem'
        onClick={() => {
         onQuickFilterChange(quickFilter === 'over' ? 'all' : 'over');
         setIsMenuOpen(false);
        }}
       >
        {OVER_FILTER_LABEL}
       </button>
      </li>

      <li role='none'>
       <button
        type='button'
        role='menuitem'
        className='budgetListControls__menuItem'
        onClick={() => {
         setIsMenuOpen(false);
         onOpenVariance?.();
        }}
       >
        {VARIANCE_LABEL}
       </button>
      </li>
     </ul>
    )}
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
