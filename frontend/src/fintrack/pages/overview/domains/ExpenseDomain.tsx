// frontend/src/fintrack/pages/overview/domains/ExpenseDomain.tsx
//
// Expense on level 2: the series, then spending against budget by category,
// then the category narrowing of the list below. The Pareto and the ring stay
// on level 1; repeating them here showed the same month twice.

import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// '?react' and not the bare form: only that import carries a React type, so the
// glyph can take a className and be sized by the stylesheet (R34).
import ArrowLeftSolidSvg from '../../../../assets/budgetSvg/ArrowLeftSolidSvg.svg?react';

import CategoryBudgetPareto, { ParetoRow } from '../components/CategoryBudgetPareto';
import NatureSplit from '../components/NatureSplit';
import SubcategoryRestList from '../components/SubcategoryRestList';
import { categoryLink } from '../helpers/levelThreeLink';
import { percent } from '../helpers/rankedBreakdown';
import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import DomainSeries from './DomainSeries';
import { DomainCompositionProps } from './domainScreen';
import {
 OverviewCategoryBudgetExecution,
 OverviewExpenseCategory,
 OverviewExpenseSubcategory,
} from '../../../types/overviewTypes';

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
 month,
}: {
 categories: OverviewExpenseCategory[];
 selected: string | null;
 onSelect: (next: string | null) => void;
 isBusy: boolean;
 // 'YYYY-MM', carried to the category screen, which reads its own URL.
 month: string | null;
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
 // Pinned first ONLY when it would otherwise be folded behind More, which is
 // the case the pin exists for. One already among the visible six keeps the
 // place the ranking gave it, so picking a chip does not shift the whole strip
 // sideways under the reader's hand.
 const pinned =
  selected !== null && !topNames.has(selected)
   ? categories.find((c) => c.categoryName === selected)
   : undefined;
 const unpinned = pinned
  ? categories.filter((c) => c.categoryName !== selected)
  : categories;
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

   {selected !== null && (
    <Link
     className='categoryFilter__link'
     to={categoryLink(selected, month).to}
     aria-disabled={isBusy}
     viewTransition
    >
     {/* The category is its own element so it can carry the subject colour the
         rest of this screen gives it. Three pieces and not one string: the
         name is the only part that changes. */}
     {'Open '}
     <span className='categoryFilter__linkSubject'>{selected}</span>
     {' budget detail'}
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
      <polyline points='9 5 16 12 9 19' />
     </svg>
    </Link>
   )}
  </section>
 );
};

// How many bars the flat ranking draws before it folds the tail into one.
//
// A FIXED COUNT AND NOT THE 80% LINE. Cutting at the crossing would put the
// chart's own reference line on the last drawn bar in every month, which reports
// the rule rather than the data. It does not move with the viewport either: a
// cut that did would make the fold mean two different things on two screens of
// the same month, and the two readings could not be compared.
const FLAT_BAR_COUNT = 20;
// A fold of one row is that row with a worse name, so the tail is folded only
// when there is a tail.
const MIN_FOLDED_BARS = 2;

const toCategoryRows = (categories: OverviewExpenseCategory[]): ParetoRow[] =>
 categories.map((category) => ({
  key: category.categoryName,
  label: category.categoryName,
  actualSpent: category.actualSpent,
  budgetAmount: category.budgetAmount,
  isOverBudget: category.isOverBudget === true,
  cumulativeActual: category.cumulativeActual,
  cumulativePercentage: category.cumulativePercentage,
  cumulativeBudget: category.cumulativeBudget,
  cumulativeBudgetPercentage: category.cumulativeBudgetPercentage,
  hasSkippedBudget: category.hasSkippedBudget,
  // A category is a group of budget accounts, so it opens.
  openable: true,
 }));

// The nature belongs to the name and is not a second axis: an account already is
// the triple category / subcategory / nature, so two accounts sharing a
// subcategory keep their own bar and this is what tells them apart.
const subcategoryLabel = (row: OverviewExpenseSubcategory) =>
 row.nature ? `${row.subcategoryName} (${row.nature})` : row.subcategoryName;

const toSubcategoryRows = (rows: OverviewExpenseSubcategory[]): ParetoRow[] =>
 rows.map((row) => ({
  // The account id and not the label: two accounts can carry one label, and a
  // key that repeats would carry one bar's state onto another's.
  key: String(row.accountId),
  label: subcategoryLabel(row),
  actualSpent: row.actualSpent,
  budgetAmount: row.budgetAmount,
  isOverBudget: row.isOverBudget,
  cumulativeActual: row.cumulativeActual,
  cumulativePercentage: row.cumulativePercentage,
  cumulativeBudget: row.cumulativeBudget,
  cumulativeBudgetPercentage: row.cumulativeBudgetPercentage,
  hasSkippedBudget: row.hasSkippedBudget,
  // One account is the leaf and does not open.
  openable: false,
 }));

/**
 * The flat ranking's bars: the first twenty accounts, then everything else in
 * one.
 *
 * THE FOLD CARRIES THE RANKING'S OWN TOTALS. It holds every row below the cut,
 * so its running figures are the last row's and its point is the last point,
 * 100% by definition — which is what lets the curves cover every account while
 * the bars do not.
 */
const withFold = (rows: OverviewExpenseSubcategory[]) => {
 if (rows.length < FLAT_BAR_COUNT + MIN_FOLDED_BARS) {
  return { bars: toSubcategoryRows(rows), folded: [] };
 }

 const folded = rows.slice(FLAT_BAR_COUNT);
 const last = rows[rows.length - 1];

 const fold: ParetoRow = {
  key: 'fold',
  label: `rest · ${folded.length} accounts`,
  actualSpent: folded.reduce((sum, row) => sum + row.actualSpent, 0),
  budgetAmount: folded.reduce((sum, row) => sum + row.budgetAmount, 0),
  // A group of accounts has no budget of its own to be over.
  isOverBudget: false,
  cumulativeActual: last.cumulativeActual,
  cumulativePercentage: last.cumulativePercentage,
  cumulativeBudget: last.cumulativeBudget,
  cumulativeBudgetPercentage: last.cumulativeBudgetPercentage,
  hasSkippedBudget: last.hasSkippedBudget,
  // A bar standing for a group opens; a bar standing for one account does not.
  openable: true,
  isFold: true,
 };

 return { bars: [...toSubcategoryRows(rows.slice(0, FLAT_BAR_COUNT)), fold], folded };
};

// The rate block for one category, off the row the ranking already published.
// No new server field: every term is on the category row.
const executionOf = (
 category: OverviewExpenseCategory,
): OverviewCategoryBudgetExecution => ({
 spentAmount: category.actualSpent,
 budgetAmount: category.budgetAmount,
 // Null when nothing was budgeted: there is nothing to divide by, and the
 // block then draws no rate rather than a rate of infinity.
 executionPercentage: category.budgetAmount > 0 ? category.executionPercentage : null,
 remainingBudget: category.remainingBudget,
 isOverBudget: category.isOverBudget === true,
});

function ExpenseDomain({
 card,
 analysis,
 answer,
 isLoading,
 onRetry,
 selectedCategory,
 onSelectCategory,
}: DomainCompositionProps<'expense'>) {
 // WHICH LEVEL THE CHART RANKS AT WHILE NO CATEGORY IS SELECTED. Inside a
 // category it is already ranking accounts, so the switch is not offered there:
 // a second control naming the same thing would contradict the one selection
 // that governs the chips, the chart and the list below.
 const [rankBy, setRankBy] = useState<'category' | 'subcategory'>('category');
 // Whether the folded bar of the flat ranking is open, showing what it holds.
 const [isFoldOpen, setIsFoldOpen] = useState(false);

 // The fold belongs to one ranking of one month. Leaving that ranking by any
 // route closes it, rather than leaving a list of the previous scope on screen.
 useEffect(() => {
  setIsFoldOpen(false);
 }, [rankBy, selectedCategory, answer.window.referenceMonth]);

 const categories = answer.categories ?? [];
 const subcategories = answer.subcategories ?? [];
 const selected =
  selectedCategory === null
   ? null
   : (categories.find(
      (category) => category.categoryName === selectedCategory,
     ) ?? null);

 // Inside a category the chart always ranks its accounts; outside, the reader
 // chooses. The server already scoped subcategories[] to whichever it is.
 const isNarrowed = selectedCategory !== null;
 const level = isNarrowed ? 'subcategory' : rankBy;

 const flat = level === 'subcategory' && !isNarrowed ? withFold(subcategories) : null;

 const rows: ParetoRow[] =
  level === 'category'
   ? toCategoryRows(categories)
   : (flat?.bars ?? toSubcategoryRows(subcategories));

 // Ranked by spend by the server, so the tail is what the fold holds.
 const foldedRows = flat?.folded ?? [];
 const foldSpent = foldedRows.reduce((sum, row) => sum + row.actualSpent, 0);
 const foldBudget = foldedRows.reduce((sum, row) => sum + row.budgetAmount, 0);
 // The scope's whole spending, off the ranking's last running figure, so a
 // row's share is of the month and not of the fold.
 const spentTotal =
  subcategories.length > 0
   ? subcategories[subcategories.length - 1].cumulativeActual
   : 0;

 const rankSwitch = !isNarrowed && !isFoldOpen && subcategories.length > 0 && (
  <div className='budgetPareto__rankBy' role='radiogroup' aria-label='Rank by'>
   <span className='budgetPareto__rankByLabel'>Rank by</span>
   <button
    type='button'
    role='radio'
    aria-checked={rankBy === 'category'}
    className={`budgetPareto__segment${
     rankBy === 'category' ? ' is-active' : ''
    }`}
    onClick={() => setRankBy('category')}
   >
    Category
   </button>
   <button
    type='button'
    role='radio'
    aria-checked={rankBy === 'subcategory'}
    className={`budgetPareto__segment${
     rankBy === 'subcategory' ? ' is-active' : ''
    }`}
    onClick={() => setRankBy('subcategory')}
   >
    Subcategory
   </button>
  </div>
 );

 // The back control names its destination and not "Back", because a reader can
 // arrive by chip without ever having opened a column.
 const trail = (
  <div className='budgetPareto__trail'>
   {/* The category's name is the SUBJECT of the drilled figure, so it is its own
       element and carries the title voice. What is ranked inside it is a
       qualifier beside the name, not part of it. At the top level there is no
       subject to promote and the row states the whole set as a caption. */}
   {(isNarrowed || level === 'subcategory') && (
    <span
     className={`budgetPareto__level${isNarrowed ? '' : ' budgetPareto__level--all'}`}
     aria-current='true'
    >
     {isNarrowed ? (
      <>
       <span className='budgetPareto__levelName'>{selectedCategory}</span>
       <span className='budgetPareto__levelScope'>subcategories</span>
      </>
     ) : (
      'every budget account of the month'
     )}
    </span>
   )}
   {rankSwitch}

   {/* Last in the row and last in the DOM, so the reading order and the visual
       order agree and nothing has to be reordered in CSS. The stylesheet pushes
       it to the far edge with an auto inline-start margin. */}
   {isNarrowed && (
    <button
     type='button'
     className='budgetPareto__back'
     onClick={() => onSelectCategory(null)}
    >
     <ArrowLeftSolidSvg
      className='budgetPareto__backArrow'
      aria-hidden='true'
     />
     {/* It names what it will show and not "Back": clearing the category
         returns to whichever ranking the switch is on, and a reader who
         arrived by chip never saw a column to go back to. */}
     {rankBy === 'category' ? 'All categories' : 'All subcategories'}
    </button>
   )}
  </div>
 );

 const onOpen = (row: ParetoRow) => {
  if (row.isFold === true) {
   setIsFoldOpen(true);
   return;
  }
  onSelectCategory(row.key);
 };

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

   {/* The fold REPLACES the chart rather than expanding under it: opening a
       column already replaces the ranking, and one gesture cannot have two
       consequences on one screen. */}
   {isFoldOpen ? (
    <section className='domainCards domainCards--single'>
     <figure className='budgetPareto'>
      <div className='budgetPareto__trail'>
       <button
        type='button'
        className='budgetPareto__back'
        onClick={() => setIsFoldOpen(false)}
       >
        <span className='budgetPareto__backArrow' aria-hidden='true'>
         ←
        </span>
        All subcategories
       </button>
       {/* The caption variant: "rest" names no category of the owner's, so
           there is no subject here to carry the title voice. */}
       <span
        className='budgetPareto__level budgetPareto__level--all'
        aria-current='true'
       >
        {`rest · ${foldedRows.length} accounts below the top ${FLAT_BAR_COUNT}`}
       </span>
      </div>

      <div className='budgetPareto__head'>
       {/* Its own money, and its share of the month beside it: what is being
           decided here is whether a tail spread over many lines is worth acting
           on, and an execution rate over unrelated accounts is not that
           figure. */}
       <span className='budgetPareto__total'>
        {currencyFormat(card.currency, foldSpent, CURRENCY_OPTIONS[DEFAULT_CURRENCY])}
       </span>
       <span className='budgetPareto__totalLabel'>
        {`total spent of ${currencyFormat(
         card.currency,
         foldBudget,
         CURRENCY_OPTIONS[DEFAULT_CURRENCY],
        )} budgeted · ${
         spentTotal > 0 ? percent(foldSpent / spentTotal) : '—'
        } of the month's expense`}
       </span>
      </div>

      <SubcategoryRestList
       rows={foldedRows}
       currency={card.currency}
       spentTotal={spentTotal}
      />
     </figure>
    </section>
   ) : (
    rows.length > 0 && (
     <CategoryBudgetPareto
      rows={rows}
      rowNoun={level === 'category' ? 'categories' : 'budget accounts'}
      execution={
       selected ? executionOf(selected) : (answer.categoryExecution ?? null)
      }
      card={card}
      referenceMonth={answer.window.referenceMonth}
      title={
       level === 'category' || isNarrowed
        ? 'Spending against budget'
        : 'Spending against budget · every subcategory'
      }
      /* Only the name the reader chose. `every subcategory` above stays inside
         the title: it is the whole set, not a subject picked out of it. */
      titleSubject={isNarrowed ? (selectedCategory ?? undefined) : undefined}
      rateScope={selectedCategory ?? 'Categorized spending'}
      trail={isNarrowed || level === 'subcategory' ? trail : rankSwitch}
      notes={
       flat && flat.folded.length > 0
        ? [
           `${FLAT_BAR_COUNT} of ${subcategories.length} budget accounts are drawn; the ${flat.folded.length} below them are summed into rest. Both curves are computed over all ${subcategories.length}, so the last point is 100%`,
          ]
        : undefined
      }
      onOpen={level === 'category' || flat !== null ? onOpen : undefined}
     >
      {answer.natureSplit && (
       <NatureSplit split={answer.natureSplit} currency={card.currency} />
      )}
     </CategoryBudgetPareto>
    )
   )}

   {/* Between the ranking and the list, which is the order it is read in: the
       categories that carry the month, then the pick, then its rows. */}
   {answer.categories && (
    <CategoryFilter
     categories={answer.categories}
     selected={selectedCategory}
     onSelect={onSelectCategory}
     isBusy={isLoading}
     month={answer.window.referenceMonth?.slice(0, 7) ?? null}
    />
   )}
  </>
 );
}

export default ExpenseDomain;
