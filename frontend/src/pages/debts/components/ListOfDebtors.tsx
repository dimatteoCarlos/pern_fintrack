import { BoxContainer, BoxRow } from './boxComponents';
import { currencyFormat } from '../../../helpers/functions';
import { useFetch } from '../../../hooks/useFetch';
import { url_summary_balance_ByType, USER_ID } from '../../../endpoints';
import { StatusSquare } from '../../../general_components/boxComponents';
import { Link } from 'react-router-dom';
import {
  DebtorListSummaryType,
  DebtorListType,
} from '../../../types/responseApiTypes';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';

export type DebtsToRenderType = DebtorListType[];

//Temporarily Dummy data
const defaultDebts: DebtsToRenderType = [
  {
    account_name: 'account_name',
    account_id: 9999999,
    currency_code: 'usd',
    total_debt_balance: 0,
    debt_receivable: 1,
    debt_payable: 0,
    debtor: 1,
    creditor: 0,
  },
  // {
  //   debtor_name: 'name',
  //   debtor_id: 1,
  //   total_amount_borrowed: 0,
  //   total_amount_lent: 0,
  //   net_amount: 0,
  //   type: 'lender',
  // },
];
type AccountPropType={previousRoute:string, accountType:string}
//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
  const user = import.meta.env.VITE_USER_ID;

//-----------
function ListOfDebtors({previousRoute, accountType}:AccountPropType) {
  
  //DATA FETCHING
  const { apiData, isLoading, error } = useFetch<DebtorListSummaryType>(
    `${url_summary_balance_ByType}?type=${accountType}&user=${USER_ID??user}`
  );
  // console.log('apiData:', apiData);

  const debtList: DebtsToRenderType =
    apiData && !isLoading && !error && apiData.data?.length
      ? apiData.data.map((debt) => {
          const {
            account_name,
            account_id,
            currency_code,
            total_debt_balance,
            debt_receivable,
            debt_payable,
            debtor,
            creditor,
          } = debt;

          return {
            account_name,
            account_id,
            currency_code,
            total_debt_balance,
            debt_receivable,
            debt_payable,
            debtor,
            creditor,
          };
        })
      : defaultDebts;

  debtList.sort((a, b) => {
    if (a.creditor && !b.creditor) return -1;
    if (!a.creditor && b.creditor) return 1;

    if (a.creditor && b.creditor) {
      return Math.abs(b.total_debt_balance) - Math.abs(a.total_debt_balance);
    }

    return b.total_debt_balance - a.total_debt_balance;
  });

  return (
    <>
      <article className='list__main__container'>
        {debtList.map((debtor, indx) => {
          const {
            account_name,
            account_id,
            currency_code,
            total_debt_balance,
            debt_receivable,
            debt_payable,
            // debtor: debtorInd,
            // creditor: creditorInd,
          } = debtor;

          const transactionType =
            (debt_payable + debt_receivable) < 0 ? 'lender' : 'debtor';

          return (
            <BoxContainer key={indx}>
              <BoxRow>
                <Link to={`debtors/${account_id}`}
                 state = {{previousRoute, debtorDetailedData:debtor}}
                >
                  <div className='debtor box__title hover'>{account_name}</div>
                </Link>
                <div className='box__title'>
                  {' '}
                  {currencyFormat(currency_code??defaultCurrency, total_debt_balance, formatNumberCountry)}
                </div>
              </BoxRow>

              <BoxRow>
                <BoxRow>
                  <div className='flx-row-sb'>
                    <StatusSquare
                      alert={transactionType == 'lender' ? 'alert' : ''}
                    />
                    <div className='box__subtitle'>
                      &nbsp; {transactionType}{' '}
                    </div>
                  </div>
                </BoxRow>
              </BoxRow>
            </BoxContainer>
          );
        })}
      </article>
    </>
  );
}

export default ListOfDebtors;
