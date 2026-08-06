//frontend/src/pages/forms/categoryDetail/ListAccountOfCategory.tsx
//Parent:CategoryAccountList.tsx

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
import {
  CategoryBudgetAccountListType,
  CategoryListType,
} from '../../../types/responseApiTypes.ts';
//-----------------------------
export type CategoryToRenderType = CategoryListType & {
  total_budget: number;
};

type ListAccountOfCategoryProp = {
  previousRoute: string;
  accounts: CategoryBudgetAccountListType[];
  //categoryName:string
};
//===============================
function ListAccountOfCategory({
  previousRoute,
  accounts,
  // ,  categoryName
}: ListAccountOfCategoryProp) {
  // console.log('from ListAccountOfCatgoryProp', previousRoute)
  // --------------------------------
  return (
    <>
      {/*ACCOUNT LIST OF CATEGORY  */}
      <article className='list__main__container '>
        {accounts.map((account, indx) => {
          const {
            account_name,
            account_balance: total_balance,
            budget,
            currency_code,
            account_id,
          } = account;
          //console.log('account', account)

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
          //-------------------------------
          return (
            <div className='box__container .flx-row-sb' key={indx}>
              <BoxRow>
                <Link
                  to={`account/${account_id}`}
                  state={{
                    detailedData: { ...account, remain, statusAlert },
                    previousRoute,
                    // categoryName
                  }}
                >
                  <div className='box__title box__title--category__name hover '>
                    {account_name}
                    {''}
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

export default ListAccountOfCategory;
