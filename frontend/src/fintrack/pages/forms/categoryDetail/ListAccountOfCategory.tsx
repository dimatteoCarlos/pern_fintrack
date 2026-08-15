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

import { Link, useSearchParams } from 'react-router-dom';
import { BudgetAccountStatus } from '../../../types/budgetTypes.ts';

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
  //categoryName:string
};
//===============================
function ListAccountOfCategory({
  previousRoute,
  accounts,
  // ,  categoryName
}: ListAccountOfCategoryProp) {
  // console.log('from ListAccountOfCatgoryProp', previousRoute)

  // Level 3 is another standalone route, so it reads the month from its URL
  // too. The link is what puts it there.
  const [searchParams] = useSearchParams();
  const month = searchParams.get('month');
  // --------------------------------
  return (
    <>
      {/*ACCOUNT LIST OF CATEGORY  */}
      <article className='list__main__container '>
        {accounts.map((account) => {
          const {
            accountId,
            accountName,
            subcategory,
            nature,
            currency,
            budgetAmount,
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

          // |100 - execution| is the same division as |remaining| / budget,
          // written so the figure inherits the server's rounding instead of a
          // second formula over the amounts.
          const remainPercentage =
            executionPercentage === null
              ? ''
              : Math.abs(100 - executionPercentage).toFixed(1) + '%';
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
                  {currencyFormat(currency_code, actualSpent, 'en-US')}
                  &nbsp;/&nbsp;
                  {currencyFormat(currency_code, budgetAmount, 'en-US')}
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
                      {numberFormatCurrency(
                        Math.abs(remainingBudget),
                        2,
                        currency_code,
                        'en-US',
                      )}
                      &nbsp;{remainingBudget < 0 ? 'over' : 'left'}&nbsp;
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
