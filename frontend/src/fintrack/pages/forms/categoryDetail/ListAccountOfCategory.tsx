//frontend/src/pages/forms/categoryDetail/ListAccountOfCategory.tsx
//Parent:CategoryAccountList.tsx

import {
  BoxRow,
  StatusSquare,
} from '../../../general_components/boxComponents/BoxComponents.tsx';

import {
  capitalize,
  currencyFormat,
  numberFormatCurrency,
  withMonthParam,
} from '../../../helpers/functions.ts';

import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';
import {
  budgetRemainWord,
  budgetSquareState,
  isUnbudgeted,
} from '../../../helpers/budgetStatus.ts';
import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';

import { Link, useSearchParams } from 'react-router-dom';
import { BudgetAccountStatus } from '../../../types/budgetTypes.ts';

// '?react' and not a bare import: a bare .svg is typed `string` and cannot take
// a className (R34). The same glyph level 3 draws, imported from the same asset
// rather than redrawn, so the two levels cannot diverge.
import EditSvg from '../../../../assets/pencil02Svg.svg?react';

import {
  DEFAULT_SORT_DIRECTION,
  useBudgetListFilter,
  type BudgetQuickFilter,
  type BudgetSortDirection,
  type BudgetSortKey,
} from '../../budget/hooks/useBudgetListFilter.ts';
import BudgetListControls, {
  type BudgetSortOption,
} from '../../budget/components/BudgetListControls.tsx';

import './styles/categoryDetail-styles.css';
//-----------------------------
// RETIRED by commit 9b — remove in the cleanup block (V1 §9.4, D8).
// Exported but imported nowhere. It described a category row carrying a
// total_budget this module used to fabricate from a dashboard balance.
//
// export type CategoryToRenderType = CategoryListType & {
//   total_budget: number;
// };

type ListAccountOfCategoryProp = {
  previousRoute: string;
  accounts: BudgetAccountStatus[];
  // The row owns the control, the parent owns the panel: this list is rendered
  // inside a frame with its own scroll, and a modal opened from here would
  // scroll with the rows instead of over them.
  onEditAccount: (accountId: number) => void;
  canEdit: boolean;
  //categoryName:string
};

// A figure the server could not compute renders as this, never as a zero.
const DASH = '—';

// Declared out here rather than inside the component: useBudgetListFilter holds
// both in its dependency array, so a fresh arrow on every render would recompute
// the memo the hook exists to avoid.
//
// Both names are searchable and only one is shown. A reader who remembers the
// account by its composed name still finds the row that labels itself with the
// subcategory alone.
const searchableText = (account: BudgetAccountStatus) => [
  account.subcategory,
  account.accountName,
];

// The visible label, not the stored field: sorting by a string the row does not
// show would produce an order the reader cannot verify on screen.
const sortName = (account: BudgetAccountStatus) =>
  account.subcategory ?? account.accountName;

// The same four keys level 1 offers, and `name` is labelled for what this level
// puts in the left column. `subcategory` is not among them: here it IS the name
// key, so offering both would be one column under two headings.
const SORT_OPTIONS: BudgetSortOption[] = [
  { value: 'name', label: 'Subcategory' },
  { value: 'spent', label: 'Spent' },
  { value: 'remaining', label: 'Remaining' },
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

//===============================
function ListAccountOfCategory({
  previousRoute,
  accounts,
  onEditAccount,
  canEdit,
  // ,  categoryName
}: ListAccountOfCategoryProp) {
  // console.log('from ListAccountOfCatgoryProp', previousRoute)

  // Level 3 is another standalone route, so it reads the month from its URL
  // too. The link is what puts it there.
  const [searchParams, setSearchParams] = useSearchParams();
  const month = searchParams.get('month');

  // The filter lives in the URL for the same reason the month does: entering an
  // account unmounts this list, and a term held in state would not survive the
  // trip back.
  // Sliced as well as capped on the input: maxLength stops what is typed into
  // the field, not what arrives in a hand-written URL.
  const search = (searchParams.get('q') ?? '').slice(
    0,
    NAME_MAX_LENGTHS.account_name,
  );
  const sort = toSortKey(searchParams.get('sort'));
  const direction = toSortDirection(searchParams.get('dir'), sort);
  const quickFilter = toQuickFilter(searchParams.get('status'));

  // Merged, never overwritten: month, q, sort and dir share one query string,
  // and setSearchParams with a plain object replaces all of it. Replaced rather
  // than pushed, so typing does not leave one history entry per character.
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
    rows: accounts,
    search,
    sort,
    direction,
    quickFilter,
    searchableText,
    sortName,
  });

  // --------------------------------
  return (
    <>
      {/* No `state` prop: the parent owns loading, error and empty, and only
          mounts this component once there are rows. The bar cannot be asked to
          report a state the list it sits over can no longer be in. */}
      <BudgetListControls
        search={search}
        onSearchChange={(value) => setListParams({ q: value })}
        searchLabel='Search accounts'
        searchMaxLength={NAME_MAX_LENGTHS.account_name}
        sort={sort}
        // The direction is cleared, not carried: each key opens on its own, and
        // keeping the previous one would open `Subcategory` at Z–A.
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
      />

      {/*ACCOUNT LIST OF CATEGORY  */}
      {/* categoryList carries the scroll, the same class level 1's list takes.
          list__main__container is rendered by six lists across the app and the
          stylesheets are global, so bounding it there would confine all six. */}
      <article className='list__main__container categoryList'>
        {rows.map((account) => {
          const {
            accountId,
            accountName,
            subcategory,
            nature,
            currency,
            budgetAmount,
            nextMonthBudget,
            actualSpent,
            remainingBudget,
            executionPercentage,
            isOverBudget,
          } = account;

          const currency_code = currency ?? DEFAULT_CURRENCY;

          // RETIRED by commit 9b — remove in the cleanup block (V1 §9.4, D8).
          // Three client-side formulas over a dashboard balance, replaced by
          // remainingBudget, isOverBudget and executionPercentage.
          //
          // const remain = -total_balance + budget;
          // const statusAlert = remain <= 0;
          // const remainPercentage =
          //   budget === 0 ? '' : ((Math.abs(remain) / budget) * 100).toFixed(1) + '%';

          // Nothing budgeted and nothing spent: no square, no word, no share.
          // Decided in budgetStatus.ts so this row, the row on level 1 and the
          // two heroes cannot disagree about an unmeasured budget.
          const unbudgeted = isUnbudgeted(budgetAmount, actualSpent);

          // The share of the budget already used, the same figure level 1 shows
          // and the same one the `% spent` key orders by. It used to print
          // |100 - execution|, which is the share still left: the opposite
          // reading of the same row.
          const usedText = unbudgeted
            ? ''
            : executionPercentage === null
            ? DASH
            : executionPercentage.toFixed(1) + '%';
          //-------------------------------
          return (
            <div className='box__container .flx-row-sb' key={accountId}>
              <BoxRow>
                {/* Only the return path travels. The figures used to as well,
                    which is what made this account render NaN when it was
                    opened from the accounting dashboard instead of from here. */}
                <Link
                  to={withMonthParam(`account/${accountId}`, month)}
                  state={{
                    previousRoute,
                    // categoryName
                  }}
                >
                  {/* The subcategory alone, not the composed account_name: the
                      category is already the title of this screen. The nature
                      is a second element and never a slash, which would
                      recompose by hand the string being taken apart. */}
                  <div className='box__title box__title--category__name hover budgetDetail__accountLabel'>
                    {capitalize(subcategory ?? accountName)}

                    {nature && (
                      <span className='budgetDetail__natureTag'>{nature}</span>
                    )}
                  </div>
                </Link>

                {/* The pair and the button travel together, and the BoxRow
                    stays at two children: .box-row is space-between
                    (boxComponents.css:15-20), so a third child would push the
                    spent/budget pair to the middle of the line.

                    The button is outside the <Link> above and not inside it: a
                    button nested in an anchor is invalid markup, and the click
                    would navigate instead of opening the panel. */}
                <div className='budgetDetail__rowAmounts'>
                  <div className='box__title--spent'>
                    {currencyFormat(currency_code, actualSpent, 'en-US')}
                    &nbsp;/&nbsp;
                    {currencyFormat(currency_code, budgetAmount, 'en-US')}
                  </div>

                  <button
                    type='button'
                    className={`budgetDetail__editBudget dark${
                      canEdit ? '' : ' budgetDetail__editBudget--hidden'
                    }`}
                    onClick={() => onEditAccount(accountId)}
                    disabled={!canEdit}
                    aria-label={`Edit budget for ${subcategory ?? accountName}`}
                    title='Edit budget'
                  >
                    <EditSvg />
                  </button>
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
                    {numberFormatCurrency(
                      Math.abs(remainingBudget),
                      2,
                      currency_code,
                      'en-US',
                    )}
                    &nbsp;
                    <span className='categoryRow__remainWord'>
                      {budgetRemainWord(
                        budgetAmount,
                        actualSpent,
                        remainingBudget,
                      )}
                    </span>
                    &nbsp;
                    {/* Inside this subtitle and after the word, because that is
                        the sentence it qualifies. The comparison is on the two
                        amounts and not on whether a row exists at M+1, the
                        condition budgetTypes.ts:97-99 documents. */}
                    {nextMonthBudget !== budgetAmount && (
                      <span
                        className='budgetDetail__exception'
                        title='This amount applies to this month only'
                      >
                        this month only
                      </span>
                    )}
                  </div>
                </div>

                {/* Under the pair on the line above, which is the pair it is a
                    share of. As a parenthesis after `left` it read as the share
                    remaining, which is the opposite figure. */}
                {usedText && (
                  <span className='categoryRow__used'>{usedText}</span>
                )}
              </BoxRow>
            </div>
          );
        })}
      </article>
    </>
  );
}

export default ListAccountOfCategory;
