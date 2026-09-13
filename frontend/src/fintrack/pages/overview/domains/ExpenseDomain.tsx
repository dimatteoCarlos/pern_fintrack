// frontend/src/fintrack/pages/overview/domains/ExpenseDomain.tsx
//
// Expense on level 2: the series, then spending against budget by category,
// then the category narrowing of the list below. The Pareto and the ring stay
// on level 1; repeating them here showed the same month twice.

import { useEffect, useId, useRef, useState } from 'react';

import CategoryBudgetPareto from '../components/CategoryBudgetPareto';
import DomainSeries from './DomainSeries';
import { DomainCompositionProps } from './domainScreen';
import { OverviewExpenseCategory } from '../../../types/overviewTypes';

// THE CATEGORIES ARE THE UNFILTERED ONES AND THAT IS DELIBERATE. The server
// narrows the transaction page and nothing else, so categories[] is still every
// category of the month while one of them is selected - the strip does not
// collapse to the single chip that was clicked, and the reader can move to
// another without clearing first.
//
// Buttons and not a select, because the set is the ranking already drawn above:
// the same names in the same order, so the strip reads as a continuation of the
// chart rather than as a second, differently sorted list of the same thing.
//
// The top six by rank are chips; the rest fold behind More. Ten rows of chips
// pushed Movements off the screen at 34 categories.
const VISIBLE_CATEGORIES = 6;
// "More (1)" costs a tap to reveal one name, so a single leftover stays visible.
const MIN_FOLDED_FOR_MORE = 2;

const CategoryFilter = ({
 categories,
 selected,
 onSelect,
 isBusy,
}: {
 categories: OverviewExpenseCategory[];
 selected: string | null;
 onSelect: (next: string | null) => void;
 isBusy: boolean;
}) => {
 const titleId = useId();
 const [isExpanded, setIsExpanded] = useState(false);
 const firstRevealedRef = useRef<HTMLButtonElement>(null);
 const shouldFocusRevealed = useRef(false);

 // A hidden chip cannot take focus, so the move waits for the render that
 // reveals it.
 useEffect(() => {
  if (!shouldFocusRevealed.current) return;
  shouldFocusRevealed.current = false;
  firstRevealedRef.current?.focus();
 }, [isExpanded]);

 const topNames = new Set(
  categories.slice(0, VISIBLE_CATEGORIES).map((c) => c.categoryName),
 );
 // The selected one is pinned first so the state never hides behind More.
 const pinned = categories.find((c) => c.categoryName === selected);
 const unpinned = categories.filter((c) => c.categoryName !== selected);
 const shown = unpinned.filter((c) => topNames.has(c.categoryName));
 const folded = unpinned.filter((c) => !topNames.has(c.categoryName));
 const hasMore = folded.length >= MIN_FOLDED_FOR_MORE;
 const foldedId = (index: number) => `${titleId}-folded-${index}`;

 const renderChip = (
  category: OverviewExpenseCategory,
  foldedIndex: number | null,
 ) => {
  const isActive = category.categoryName === selected;

  return (
   <button
    type='button'
    key={category.categoryName}
    ref={foldedIndex === 0 ? firstRevealedRef : undefined}
    id={foldedIndex === null ? undefined : foldedId(foldedIndex)}
    // Mounted and hidden rather than unmounted, so More can name what it
    // controls.
    hidden={foldedIndex !== null && !isExpanded}
    className={`categoryFilter__chip${isActive ? ' is-active' : ''}`}
    aria-pressed={isActive}
    disabled={isBusy}
    // Clicking the selected one clears it. The alternative is a chip that
    // does nothing when pressed, which reads as a broken control.
    onClick={() => onSelect(isActive ? null : category.categoryName)}
   >
    {category.categoryName}
    {isActive && (
     <svg
      className='categoryFilter__icon'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      aria-hidden='true'
      focusable='false'
     >
      <path d='M6 6l12 12M18 6L6 18' />
     </svg>
    )}
   </button>
  );
 };

 return (
  <section className='categoryFilter' aria-labelledby={titleId}>
   <div className='categoryFilter__head'>
    <h3 className='categoryFilter__title' id={titleId}>
     Filter by category
    </h3>
    {/* The month's whole set: it does not shrink when one is picked. */}
    <span className='categoryFilter__meta'>
     {categories.length}{' '}
     {categories.length === 1 ? 'category' : 'categories'}
    </span>
   </div>

   <div
    className='categoryFilter__chips'
    role='group'
    aria-labelledby={titleId}
   >
    {/* Present even when nothing is selected, and pressed in that state. A
        strip whose clear control appears only after a click hides the way
        back until the reader has already committed. */}
    <button
     type='button'
     className={`categoryFilter__chip${
      selected === null ? ' is-active' : ''
     }`}
     aria-pressed={selected === null}
     disabled={isBusy}
     onClick={() => onSelect(null)}
    >
     All categories
    </button>

    {pinned && renderChip(pinned, null)}
    {shown.map((category) => renderChip(category, null))}
    {folded.map((category, index) =>
     renderChip(category, hasMore ? index : null),
    )}

    {hasMore && (
     <button
      type='button'
      className='categoryFilter__chip categoryFilter__chip--more'
      aria-expanded={isExpanded}
      aria-controls={folded.map((_, index) => foldedId(index)).join(' ')}
      onClick={() => {
       shouldFocusRevealed.current = !isExpanded;
       setIsExpanded(!isExpanded);
      }}
     >
      {isExpanded ? (
       'Fewer'
      ) : (
       <>
        More <span className='categoryFilter__count'>({folded.length})</span>
       </>
      )}
      <svg
       className='categoryFilter__icon'
       viewBox='0 0 24 24'
       fill='none'
       stroke='currentColor'
       strokeWidth='2'
       strokeLinecap='round'
       strokeLinejoin='round'
       aria-hidden='true'
       focusable='false'
      >
       <polyline points={isExpanded ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
      </svg>
     </button>
    )}
   </div>
  </section>
 );
};

function ExpenseDomain({
 card,
 analysis,
 answer,
 isLoading,
 onRetry,
 selectedCategory,
 onSelectCategory,
}: DomainCompositionProps<'expense'>) {
 return (
  <>
   <DomainSeries
    label='Expense'
    nature='flow'
    points={analysis?.series ?? null}
    currency={card.currency}
    isLoading={isLoading}
    onRetry={onRetry}
   />

   {answer.categories && (
    <CategoryBudgetPareto
     categories={answer.categories}
     card={card}
     referenceMonth={answer.window.referenceMonth}
    />
   )}

   {/* Between the ranking and the list, which is the order it is read in: the
       categories that carry the month, then the pick, then its rows. */}
   {answer.categories && (
    <CategoryFilter
     categories={answer.categories}
     selected={selectedCategory}
     onSelect={onSelectCategory}
     isBusy={isLoading}
    />
   )}
  </>
 );
}

export default ExpenseDomain;
