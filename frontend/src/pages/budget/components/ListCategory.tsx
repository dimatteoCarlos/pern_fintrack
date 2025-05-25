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
  // CategoryBudgetListType,
  CategoryBudgetType,
  CurrencyType,
} from '../../../types/types.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import {
  // url_budget,
  url_summary_balance_ByType,
  USER_ID,
} from '../../../endpoints.ts';

import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';

// import { Link } from 'react-router-dom';
import {
  CategoryListSummaryType,
  CategoryListType,
} from '../../../types/responseApiTypes.ts';

export type CategoryToRenderType = CategoryBudgetType & {
  currency?: CurrencyType;
  total_budget: number;
};

const defaultCategoryBudget: CategoryToRenderType[] = [];

function ListCategory() {
  //List Category

  // en el backend: generar la data segun estructura de los datos a renderizar, es decir,
  //agrupar para cada caategoria, expenses y  budgets, y cualquier otra; la sumatoria de los expense se refleja en el spent, y la sumatoria de los budget de cada categoria seria el budget por categoria o por subcategoria? hay que definir esto, no e tengo claro el manejo de las subcategorias. ,  y el status refleja el estado de lo disponible en el presupuesto,  seria el resultado de la resta entre el expense-budget  de cada categoria, ..

  //DATA FETCHING
  // CategoryListSummaryType
  const { apiData, isLoading, error } = useFetch<CategoryListSummaryType>(
    `${url_summary_balance_ByType}?type=category_budget&user=${USER_ID}`
  );
  // console.log(apiData);

  //-------
  const budgetList: CategoryToRenderType[] =
    apiData?.data && !isLoading && !error && apiData.data.length > 0
      ? apiData.data.map((catBudget: CategoryListType) => {
          const {
            category_name,
            total_balance: spent,
            total_remaining: remaining,
            currency_code: currency,
          } = catBudget;

          return {
            total_budget: spent + remaining,
            category_name,
            spent,
            remaining,
            currency,
          };
        })
      : defaultCategoryBudget;

  //functions

  return (
    <>
      {/*LIST CATEGORY  */}
      <article className='list__main__container '>
        {budgetList.map((category, indx) => {
          const {
            category_name,
            spent,
            total_budget: budget,
            currency,
          } = category;

          // const { remaining } = category;
          const remain = Math.round(-spent + budget);
          // console.log('remaining', remaining);

          const statusAlert = remain <= 0;

          return (
            <div className='box__container .flx-row-sb' key={indx}>
              <BoxRow>
                {/* <Link to={`/budget/categories/:${category_id}`}> */}
                <div className='box__title box__title--category__name hover '>
                  {category_name}{' '}
                </div>
                {/* </Link> */}

                <div
                  className='box__title--spent  '
                  style={{
                    width: 'max-content',
                    display: 'flex',
                    justifyContent: 'space-between',
                    textAlign: 'right',
                    borderBottom: '0.5px dashed var(--creme)',
                  }}
                >
                  spent: {currencyFormat(currency, spent, 'en-US')}&nbsp;
                  <span style={{ fontSize: '0.75rem' }}>
                    (
                    {budget === 0
                      ? ''
                      : ((spent / budget) * 100).toFixed(1) + '%'}
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
                        currency ?? DEFAULT_CURRENCY,
                        'en-US'
                      )}
                      &nbsp;
                      <span style={{ fontSize: '0.75rem' }}>
                        (
                        {budget === 0
                          ? ''
                          : ((1 - spent / budget) * 100).toFixed(1) + '%'}
                        )
                      </span>
                    </div>
                  </div>
                </BoxRow>
                <div className='box__subtitle'>
                  budget: {currencyFormat(currency, budget, 'en-US')}{' '}
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
