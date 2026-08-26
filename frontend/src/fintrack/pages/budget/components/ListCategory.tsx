//frontend/src/fintrack/pages/budget/components/ListCategory.tsx

import {
  BoxRow,
  StatusSquare,
} from '../../../general_components/boxComponents/BoxComponents.tsx';
import {
  currencyFormat,
  numberFormatCurrency,
  withMonthParam,
} from '../../../helpers/functions.ts';

import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';
import {
  budgetRemainWord,
  budgetSquareState,
  budgetStatusLevel,
  isUnbudgeted,
} from '../../../helpers/budgetStatus.ts';
import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';

import { Link, useSearchParams } from 'react-router-dom';

import { useBudgetStatusStore } from '../../../stores/useBudgetStatusStore.ts';
import { BudgetCategoryStatus } from '../../../types/budgetTypes.ts';
import {
  DEFAULT_SORT_DIRECTION,
  useBudgetListFilter,
  type BudgetQuickFilter,
  type BudgetSortDirection,
  type BudgetSortKey,
} from '../hooks/useBudgetListFilter.ts';
import BudgetListControls, {
  type BudgetListState,
  type BudgetSortOption,
} from './BudgetListControls.tsx';
//-----------------------------
// RETIRED by commit 9 — remove in the cleanup block (V1 §9.4, D8).
// The shape existed to carry a total_budget this component fabricated from a
// dashboard balance. categories[] now serves the figure.
//
// export type CategoryToRenderType = CategoryListType & {
//   total_budget: number;
// };
//
// const defaultCategoryBudget: CategoryToRenderType[] = [];

type ListCategoryProp = { previousRoute: string };

// A figure the server could not compute renders as this, never as a zero.
const DASH = '—';

// Declared out here rather than inside the component: useBudgetListFilter holds
// both in its dependency array, so a fresh arrow on every render would recompute
// the memo the hook exists to avoid.
const searchableText = (category: BudgetCategoryStatus) => [
  category.categoryName,
];
const sortName = (category: BudgetCategoryStatus) => category.categoryName;

// The keys this level can offer. `subcategory` is absent because a category has
// none — the hook supports it for level 2, which lists accounts.
//
// A label names what the key orders, not the field behind it: `name` reads as
// `Category` here and will read as `Account` on level 2.
const SORT_OPTIONS: BudgetSortOption[] = [
  { value: 'name', label: 'Category' },
  { value: 'spent', label: 'Spent' },
  { value: 'remaining', label: 'Remaining' },
  // The header spells the term out as "% of spent budget". The key abbreviates
  // it because this control is the one where length is read on every render.
  { value: 'execution', label: '% spent' },
];

// A URL is typed by anyone. An unrecognised key would leave the select matching
// no option and showing an empty box, so it falls back to the default.
const toSortKey = (value: string | null): BudgetSortKey =>
  SORT_OPTIONS.some((option) => option.value === value)
    ? (value as BudgetSortKey)
    : 'name';

// Absent means "the reader has not chosen", not "ascending". Each key opens on
// the direction that puts the row worth reading first.
const toSortDirection = (
  value: string | null,
  sort: BudgetSortKey,
): BudgetSortDirection =>
  value === 'asc' || value === 'desc' ? value : DEFAULT_SORT_DIRECTION[sort];

// Only the narrowing filter travels in the URL. `all` is the absence of a
// filter, so writing it would put a parameter in the address bar that says the
// list is doing what it does by default.
const toQuickFilter = (value: string | null): BudgetQuickFilter =>
  value === 'over' ? 'over' : 'all';

//==================================
function ListCategory({ previousRoute }: ListCategoryProp) {
  //++++++++++++++++++++++++++++++++++
  //DATA
  // No request of its own: BudgetLayout issues the one call and this reads the
  // categories slice of it. The server folds the accounts by category from the
  // same rounded rows level 2 renders, so a group header reconciles with the
  // accounts under it.
  const categories = useBudgetStatusStore((state) => state.categories);
  const isLoading = useBudgetStatusStore((state) => state.isLoading);
  const error = useBudgetStatusStore((state) => state.error);

  // Level 2 is a route beside this one, not below it, so it re-reads the month
  // from its own URL. A link that dropped it would land on a screen quietly
  // reporting a different month from the row that was clicked.
  const [searchParams, setSearchParams] = useSearchParams();
  const month = searchParams.get('month');

  // The filter lives in the URL for the same reason the month does: entering a
  // category unmounts this list, and a term held in state would not survive the
  // trip back.
  // Sliced as well as capped on the input: maxLength stops what is typed into
  // the field, not what arrives in a hand-written URL.
  const search = (searchParams.get('q') ?? '').slice(
    0,
    NAME_MAX_LENGTHS.category_name,
  );
  const sort = toSortKey(searchParams.get('sort'));
  const direction = toSortDirection(searchParams.get('dir'), sort);
  const quickFilter = toQuickFilter(searchParams.get('status'));

  // Merged, never overwritten: month, q, sort and dir share one query string,
  // and setSearchParams with a plain object replaces all of it. Replaced rather
  // than pushed, so typing does not leave one history entry per character.
  //
  // Takes a set rather than one key because changing the sort has to clear the
  // direction in the same write.
  const setListParams = (values: Record<string, string>) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        Object.entries(values).forEach(([key, value]) => {
          if (value) next.set(key, value);
          else next.delete(key);
        });
        return next;
      },
      { replace: true },
    );
  };

  const { rows, matched, total, isFiltered } = useBudgetListFilter({
    rows: categories,
    search,
    sort,
    direction,
    quickFilter,
    searchableText,
    sortName,
  });

  // A failed request and a month holding nothing are the same thing to the bar:
  // there is nothing to filter, so it takes itself off screen.
  const listState: BudgetListState = error
    ? 'unavailable'
    : isLoading
    ? 'loading'
    : 'ready';

  //--------------------------------
  return (
    <>
      {/*LIST CATEGORY  */}
      <BudgetListControls
        search={search}
        onSearchChange={(value) => setListParams({ q: value })}
        searchLabel='Search categories'
        // A term longer than the longest name that can exist would only ever
        // match nothing. The search is a substring match, so the cap narrows
        // how specific a term can be without putting any row out of reach.
        searchMaxLength={NAME_MAX_LENGTHS.category_name}
        sort={sort}
        // The direction is cleared, not carried: each key opens on its own, and
        // keeping the previous one would open `Category` at Z–A.
        onSortChange={(value) => setListParams({ sort: value, dir: '' })}
        sortOptions={SORT_OPTIONS}
        direction={direction}
        onDirectionChange={(value) => setListParams({ dir: value })}
        quickFilter={quickFilter}
        // 'all' is written as an empty value, which setListParams deletes: the
        // default filter leaves no parameter behind in the address bar.
        onQuickFilterChange={(value) =>
          setListParams({ status: value === 'all' ? '' : value })
        }
        matched={matched}
        total={total}
        isFiltered={isFiltered}
        state={listState}
      />

      {/* A class of its own for the scroll. list__main__container is rendered by
          six lists across budget, pocket, debts and account detail, and the
          stylesheets are global — bounding it there would confine all six. */}
      <article className='list__main__container categoryList'>
        {rows.map((category) => {
          const {
            categoryName,
            actualSpent,
            budgetAmount,
            remainingBudget,
            executionPercentage,
            isOverBudget,
            currency,
          } = category;

          const currency_code = currency ?? DEFAULT_CURRENCY;

          // RETIRED by commit 9 — remove in the cleanup block (V1 §9.4, D8).
          // Four client-side formulas over a dashboard balance, replaced by
          // budgetAmount, remainingBudget, isOverBudget and executionPercentage.
          //
          // const budget = total_balance + total_remaining;
          // const remain = -total_balance + budget;
          // const statusAlert = remain <= 0;
          // const remainPercentage =
          //   budget === 0 ? '' : ((Math.abs(remain) / budget) * 100).toFixed(1) + '%';

          // Nothing budgeted and nothing spent: no square, no word, no share.
          // Decided in budgetStatus.ts so this row and the header above it
          // cannot disagree about what an unmeasured budget looks like.
          const unbudgeted = isUnbudgeted(budgetAmount, actualSpent);

          // The share of the budget already used. Served, not derived: it is the
          // same percentage the sort key orders by and the header names, so a
          // second division over the amounts could round away from it.
          const usedText = unbudgeted
            ? ''
            : executionPercentage === null
            ? DASH
            : executionPercentage.toFixed(1) + '%';

          // Every figure of a category is nullable for one case: accounts in
          // more than one currency, which V1 does not allow. Unreachable under
          // a single accounting currency, and a dash rather than a zero if the
          // model ever widens.
          const spentText =
            actualSpent === null
              ? DASH
              : currencyFormat(currency_code, actualSpent, 'en-US');

          const budgetText =
            budgetAmount === null
              ? DASH
              : currencyFormat(currency_code, budgetAmount, 'en-US');

          const remainText =
            remainingBudget === null
              ? DASH
              : numberFormatCurrency(
                  Math.abs(remainingBudget),
                  2,
                  currency_code,
                  'en-US',
                );

          const remainWord = budgetRemainWord(
            budgetAmount,
            actualSpent,
            remainingBudget,
          );

          return (
           <div className='box__container .flx-row-sb' key={categoryName}>
              <BoxRow>
                {/* Only the return path travels. Level 2 reads the same store
                    this row does, so nothing carried in state could be more
                    current than what it already holds. */}
                <Link
                  to={withMonthParam(`category/${categoryName}`, month)}
                  state={{
                    previousRoute,
                  }}
                >
                 <div className='box__title box__title--category__name hover '>
                     {categoryName}{' '}
                  </div>
                </Link>

                <div className='box__title--spent'>
                  {spentText}
                  &nbsp;/&nbsp;
                  {budgetText}
                </div>
              </BoxRow>

              {/* One BoxRow, not two nested: the outer one is the space-between
                  row that puts the remainder at the left and the share at the
                  right, and it needs both as siblings to do it. */}
              <BoxRow>
                <div className='flx-row-sb'>
                  {!unbudgeted && (
                    <StatusSquare
                      alert={budgetSquareState(
                        executionPercentage,
                        isOverBudget,
                      )}
                    />
                  )}
                  <div className='box__subtitle'>
                    &nbsp;
                    {/* Absolute value: the word carries the sign, so a minus
                        in front of it would state the same thing twice. */}
                    {remainText}
                    &nbsp;
                    <span className='categoryRow__remainWord'>{remainWord}</span>
                    &nbsp;
                  </div>
                </div>

                {/* Under the pair on the line above, which is the pair it is a
                    share of. As a parenthesis after `left` it read as the share
                    remaining, which is the opposite figure. */}
                {/* Coloured from the same call the square at the other end of
                    the row makes, so the number and the square cannot light
                    differently for one row. */}
                {usedText && (
                  <span
                    className={`categoryRow__used categoryRow__used--${budgetStatusLevel(
                      executionPercentage,
                      isOverBudget,
                    )}`}
                  >
                    {usedText}
                  </span>
                )}
              </BoxRow>
            </div>
          );
        })}
      </article>
    </>
  );
}

export default ListCategory;
