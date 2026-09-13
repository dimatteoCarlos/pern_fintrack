// frontend/src/fintrack/pages/overview/domains/ExpenseDomain.tsx
//
// Expense on level 2: the series, then the ranking and the ring level 1 mounts,
// then the category narrowing of the list below. The two drawings stay on the
// dark surface (OVERVIEW_DECISIONS.md, P5-6).

import { ExpenseBreakdown } from '../components/ExpenseByCategory';
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
}) => (
 <div className='categoryFilter' role='group' aria-label='Narrow by category'>
  {/* Present even when nothing is selected, and pressed in that state. A strip
      whose clear control appears only after a click hides the way back until
      the reader has already committed. */}
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

  {categories.map((category) => {
   const isActive = category.categoryName === selected;

   return (
    <button
     type='button'
     key={category.categoryName}
     className={`categoryFilter__chip${isActive ? ' is-active' : ''}`}
     aria-pressed={isActive}
     disabled={isBusy}
     // Clicking the selected one clears it. The alternative is a chip that
     // does nothing when pressed, which reads as a broken control.
     onClick={() => onSelect(isActive ? null : category.categoryName)}
    >
     {category.categoryName}
    </button>
   );
  })}
 </div>
);

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

   {/* The same two drawings level 1 mounts, from this answer's own categories
       rather than from the page payload. */}
   {answer.categories && (
    <ExpenseBreakdown
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
