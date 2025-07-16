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

import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';

import { Link } from 'react-router-dom';
import {
  CategoryBudgetAccountListType,
  CategoryListType,
} from '../../../types/responseApiTypes.ts';
//-----------------------------
export type CategoryToRenderType = CategoryListType & {
  // currency_code?: CurrencyType;
  total_budget: number;
};

type ListAccountOfCategoryProp=
{  previousRoute:string, accounts:CategoryBudgetAccountListType[]}

//============================================
function ListAccountOfCategory({previousRoute, accounts}:ListAccountOfCategoryProp) {
console.log('originRoute', previousRoute)
// --------------------------------
 return (
  <>
    {/*ACCOUNT LIST OF CATEGORY  */}
    <article className='list__main__container '>
      {accounts.map((account, indx) => {
        const {
          account_name,
          account_balance:total_balance,
          budget,
          currency_code,
          account_id,
        } = account;

        //console.log('account', account)

        const remain = Math.round(-total_balance + budget);
        console.log('ramain', remain)

        const statusAlert = remain <= 0;

//----------------------------------
        return (
          <div className='box__container .flx-row-sb' key={indx}>

            <BoxRow>
              <Link to={`account/${account_id}`}
              state = {{ categorySummaryDetailed:{...account, remain, statusAlert}, previousRoute}}
              >
              <div className='box__title box__title--category__name hover '>
                {account_name}{' '}
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
                        ? 0
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

export default ListAccountOfCategory;
