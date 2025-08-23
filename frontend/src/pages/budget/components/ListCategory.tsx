import {
  BoxRow,
  StatusSquare,
} from '../../../general_components/boxComponents.tsx';
import {
  currencyFormat,
  numberFormatCurrency,
  // numberFormat,
  // divide,
} from '../../../helpers/functions.ts';
import {
  // // CategoryBudgetListType,
  // CategoryBudgetType,
  // CurrencyType,
} from '../../../types/types.ts';

import {
  // url_budget,
  url_summary_balance_ByType,
  USER_ID,
} from '../../../endpoints.ts';

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

type ListCategoryProp=
{  previousRoute:string}

const defaultCategoryBudget: CategoryToRenderType[] = [];

//============================================
function ListCategory({previousRoute}:ListCategoryProp) {
    console.log('component', 'ListCategory')
  // console.log('originRoute', previousRoute)

//++++++++++++++++++++++++++++++++++++
  //DATA FETCHING
  //List of each category with summary info
  // CategoryListSummaryType
  const { apiData, isLoading, error } = useFetch<CategoryListSummaryType>(
    `${url_summary_balance_ByType}?type=category_budget&user=${USER_ID}`
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
//++++++++++++++++++++++++++++++++++++     
//functions
//--------------------------------------------
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

        const remain = Math.round(-total_balance + budget);

        const statusAlert = remain <= 0;

        return (
          <div className='box__container .flx-row-sb' key={indx}>
            <BoxRow>
              <Link to={`category/${category_name}`}
              state = {{ categorySummaryDetailed:{...category, remain,statusAlert}, previousRoute}}
              >
              {/* <Link to={`category/${category_name}`}
              state = {{previousRoute, categorySummaryDetailed:category, remain,statusAlert}}
              > */}
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
                Spent: {currencyFormat(currency_code, total_balance, 'en-US')}&nbsp;
                <span style={{ fontSize: '0.75rem' }}>
                  (
                  {budget === 0
                    ? ''
                    : ((total_balance / budget) * 100).toFixed(1) + '%'}
                  )
                </span>
              </div>
            </BoxRow>

            <BoxRow>
              <BoxRow>
                <div className='flx-row-sb'>
                  <StatusSquare alert={statusAlert ? 'alert' : ''} />
                  <div className='box__subtitle'>
                    &nbsp;
                    {numberFormatCurrency(
                      remain,
                      0,
                      currency_code ?? DEFAULT_CURRENCY,
                      'en-US'
                    )}
                    &nbsp;
                    <span style={{ fontSize: '0.75rem' }}>
                      (
                      {budget === 0
                        ? ''
                        : ((1 - total_balance / budget) * 100).toFixed(1) + '%'}
                      )
                    </span>
                  </div>
                </div>
              </BoxRow>
              
              <div className='box__subtitle'>
                budget: {currencyFormat(currency_code, budget, 'en-US')}{' '}
              </div>
            </BoxRow>
          </div>
        );
      })}
    </article>
  </>
  );
}

export default ListCategory;
