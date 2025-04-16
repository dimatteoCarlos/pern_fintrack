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
  CategoryBudgetListType,
  CategoryBudgetType,
  CurrencyType,
} from '../../../types/types.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import { url_budget } from '../../../endpoints.ts';
import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';
import { Link } from 'react-router-dom';

export type CategoryToRenderType = CategoryBudgetType & {
  currency?: CurrencyType;
};

const defaultCategoryBudget: CategoryToRenderType[] = [
  {
    category_name: 'Category Name 1',
    spent: Math.random() * 100,
    amount: Math.random() * 100,
    currency: 'usd',
    category_id: Math.round(Math.floor(Math.random() * 100)),
  },
  {
    category_name: 'Category Name 2',
    spent: Math.random() * 100,
    amount: Math.random() * 100,
    currency: 'cop',
    category_id: Math.round(Math.floor(Math.random() * 100)),
  },
  {
    category_name: 'Category Name 3',
    spent: Math.random() * 100,
    amount: Math.random() * 100,
    currency: 'eur',
    category_id: Math.round(Math.floor(Math.random() * 100)),
  },
  {
    category_name: 'Category Name 4',
    spent: Math.random() * 100,
    amount: Math.random() * 100,
    currency: 'cop',
    category_id: Math.round(Math.floor(Math.random() * 100)),
  },
];

function ListCategory() {
  //List Category

  // let data: CategoriesToRenderType[] = [],
  //   isLoading = false,
  //   error = null;

  // en el backend: generar la data segun estructura de los datos a renderizar, es decir,
  //agrupar para cada caategoria, expenses y  budgets, y cualquier otra; la sumatoria de los expense se refleja en el spent, y la sumatoria de los budget de cada categoria seria el budget por categoria o por subcategoria? hay que definir,  y el status seria el resultado de la resta entre el budget - expense de cada categoria, o si se prefiere reflejar el status de una vez desde el backend?.
  //no se esta claro, si los valores o informacion se obtendra de los movimientos de expenses, realizados en cada categoria y budget...definir procedimiento de calculo.

  //DATA FETCHING
  const { data, isLoading, error } =
    useFetch<CategoryBudgetListType>(url_budget);
  console.log(data); //Los Datos actuales no tienen el campo "category_nature"

  //-------
  const budgetList: CategoryToRenderType[] =
    data?.budgets && !isLoading && !error && data.budgets.length > 0
      ? data.budgets.map((catBudget: CategoryBudgetType) => {
          const { category_name, spent, amount, category_id } = catBudget;

          return {
            category_id,
            category_name,
            spent,
            amount,
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
            amount: budget,
            currency,
            category_id,
          } = category;
          const diff = Math.round(budget - spent);
          const statusAlert = diff <= 0;

          return (
            <div className='box__container .flx-row-sb' key={indx}>
              <BoxRow>
                <Link to={`/budget/categories/:${category_id}`}>
                  <div className='box__title box__title--category__name hover '>
                    {category_name}{' '}
                  </div>
                </Link>

                <div className='box__title--spent'>
                  spent: {currencyFormat(currency, spent, 'en-US')}{' '}
                </div>
              </BoxRow>

              <BoxRow>
                <BoxRow>
                  <div className='flx-row-sb'>
                    <StatusSquare alert={statusAlert ? 'alert' : ''} />
                    <div className='box__subtitle'>
                      &nbsp;
                      {/* HAY QUE DEFINIR LA REGLA PARA ESTABLECER EL STATUS */}
                      {/* {'status:'}{' '} */}
                      {/* {currencyFormat(currency, diff, 'en-US')}{' '} */}
                      {/* {budget === 0
                        ? ''
                        : (divide(-diff, budget) * 100).toFixed(0) + '%'} */}
                      &nbsp;
                      {/* {`${currency ?? '$'}${diff.toFixed(0)}`} */}
                      {numberFormatCurrency(
                        diff,
                        0,
                        currency ?? DEFAULT_CURRENCY,
                        'en-US'
                      )}
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
