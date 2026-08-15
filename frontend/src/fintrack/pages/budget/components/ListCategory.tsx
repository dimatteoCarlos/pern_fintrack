//frontend/src/fintrack/pages/budget/components/ListCategory.tsx

import {
  BoxRow,
  StatusSquare,
} from '../../../general_components/boxComponents/BoxComponents.tsx';
import {
  currencyFormat,
  numberFormatCurrency,
} from '../../../helpers/functions.ts';

import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';

import { Link } from 'react-router-dom';

import { useBudgetStatusStore } from '../../../stores/useBudgetStatusStore.ts';
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

//==================================
function ListCategory({ previousRoute }: ListCategoryProp) {
  //++++++++++++++++++++++++++++++++++
  //DATA
  // No request of its own: BudgetLayout issues the one call and this reads the
  // categories slice of it. The server folds the accounts by category from the
  // same rounded rows level 2 renders, so a group header reconciles with the
  // accounts under it.
  const categories = useBudgetStatusStore((state) => state.categories);

  //--------------------------------
  return (
    <>
      {/*LIST CATEGORY  */}
      <article className='list__main__container '>
        {categories.map((category) => {
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

          // |100 - execution| is the same division as |remaining| / budget,
          // written so the figure inherits the server's rounding instead of a
          // second formula over the amounts. It reads as the share left or the
          // share overspent — the word in front of it says which.
          const remainPercentage =
            executionPercentage === null
              ? ''
              : Math.abs(100 - executionPercentage).toFixed(1) + '%';

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

          const remainWord =
            remainingBudget === null ? '' : remainingBudget < 0 ? 'over' : 'left';

          return (
           <div className='box__container .flx-row-sb' key={categoryName}>
              <BoxRow>
                {/* Only the return path travels. Level 2 reads the same store
                    this row does, so nothing carried in state could be more
                    current than what it already holds. */}
                <Link
                  to={`category/${categoryName}`}
                  state={{
                    previousRoute,
                  }}
                >
                 <div className='box__title box__title--category__name hover '>
                     {categoryName}{' '}
                  </div>
                </Link>

                <div
                  className='box__title--spent'
                  style={{
                    width: 'max-content',
                    display: 'flex',
                    justifyContent: 'space-between',
                    textAlign: 'right',
                    borderBottom: '0.5px dashed var(--creme)',
                  }}
                >
                  {spentText}
                  &nbsp;/&nbsp;
                  {budgetText}
                </div>
              </BoxRow>

              <BoxRow>
                <BoxRow>
                  <div className='flx-row-sb'>
                    <StatusSquare alert={isOverBudget ? 'alert' : ''} />
                    <div className='box__subtitle'>
                      &nbsp;
                      {/* Absolute value: the word carries the sign, so a minus
                          in front of it would state the same thing twice. */}
                      {remainText}
                      &nbsp;{remainWord}&nbsp;
                      <span style={{ fontSize: '0.75rem' }}>
                        ({remainPercentage})
                      </span>
                    </div>
                  </div>
                </BoxRow>
              </BoxRow>
            </div>
          );
        })}
      </article>
    </>
  );
}

export default ListCategory;
