//frontend/src/fintrack/pages/budget/components/ListCategory.tsx

import {
  BoxRow,
  StatusSquare,
} from '../../../general_components/boxComponents/BoxComponents.tsx';
import {
  currencyFormat,
  numberFormatCurrency,
} from '../../../helpers/functions.ts';
import {} from '../../../types/types.ts';

import { url_summary_balance_ByType } from '../../../../urlConfig.ts';

import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';

import { useFetch } from '../../../hooks/useFetch.ts';

import { Link } from 'react-router-dom';

import {
  CategoryListSummaryType,
  CategoryListType,
} from '../../../types/responseApiTypes.ts';
//-----------------------------
export type CategoryToRenderType = CategoryListType & {
  // currency_code?: CurrencyType;
  total_budget: number;
};

type ListCategoryProp = { previousRoute: string };

const defaultCategoryBudget: CategoryToRenderType[] = [];

//==================================
function ListCategory({ previousRoute }: ListCategoryProp) {
  // console.log('component', 'ListCategory')

  //++++++++++++++++++++++++++++++++++
  //DATA FETCHING
  //List of each category with summary info
  // CategoryListSummaryType
  const { apiData, isLoading, error } = useFetch<CategoryListSummaryType>(
    `${url_summary_balance_ByType}?type=category_budget`,
  );
  // console.log(apiData);
  //--------------------
  const budgetList: CategoryToRenderType[] =
    apiData?.data && !isLoading && !error && apiData.data.length > 0
      ? apiData.data.map((catBudget: CategoryListType) => {
          const {
            category_name,
            total_balance,
            total_remaining,
            currency_code,
          } = catBudget;

          return {
            category_name,
            total_balance,
            total_budget: total_balance + total_remaining,
            total_remaining,
            currency_code,
          };
        })
      : defaultCategoryBudget;
  //--------------------------------
  return (
    <>
      {/*LIST CATEGORY  */}
      <article className='list__main__container '>
        {budgetList.map((category, indx) => {
          const {
            category_name,
            total_balance,
            total_budget: budget,
            currency_code,
          } = category;

          // const { total_remaining } = category;
          // console.log('total_remaining', total_remaining);

          // Not rounded: the backend already ships two decimals, and rounding
          // to an integer here made the amount disagree with its own percentage.
          const remain = -total_balance + budget;

          const statusAlert = remain <= 0;

          // What the remaining amount is worth as a share of the budget. The
          // parenthesis qualifies the figure in front of it, so the same number
          // reads for both words: 19.6% over, 100.0% left.
          const remainPercentage =
            budget === 0
              ? ''
              : ((Math.abs(remain) / budget) * 100).toFixed(1) + '%';

          return (
           <div className='box__container .flx-row-sb' key={indx}>
              <BoxRow>
                <Link
                  to={`category/${category_name}`}
                  state={{
                   categorySummaryDetailed: {
                      ...category,
                      remain,
                      statusAlert,
                    },
                    previousRoute,
                  }}
                >
                 <div className='box__title box__title--category__name hover '>
                     {category_name}{' '}
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
                  {currencyFormat(currency_code, total_balance, 'en-US')}
                  &nbsp;/&nbsp;
                  {currencyFormat(currency_code, budget, 'en-US')}
                </div>
              </BoxRow>

              <BoxRow>
                <BoxRow>
                  <div className='flx-row-sb'>
                    <StatusSquare alert={statusAlert ? 'alert' : ''} />
                    <div className='box__subtitle'>
                      &nbsp;
                      {/* Absolute value: the word carries the sign, so a minus
                          in front of it would state the same thing twice. */}
                      {numberFormatCurrency(
                        Math.abs(remain),
                        2,
                        currency_code ?? DEFAULT_CURRENCY,
                        'en-US',
                      )}
                      &nbsp;{remain < 0 ? 'over' : 'left'}&nbsp;
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
