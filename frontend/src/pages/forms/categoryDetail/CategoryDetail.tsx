import { Link, useLocation, useParams } from 'react-router-dom';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import '../styles/forms-styles.css';
import { DEFAULT_CURRENCY, VARIANT_FORM } from '../../../helpers/constants.ts';
import SummaryDetailBox from './summaryDetailBox/SummaryDetailBox.tsx';
import { CategoryBudgetAccountListType, TransactionsAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { CurrencyType } from '../../../types/types.ts';
import { url_get_transactions_by_account_id } from '../../../endpoints.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import { capitalize, currencyFormat, formatDateToDDMMYYYY  } from '../../../helpers/functions.ts';
import AccountBalanceSummary from '../accountDetail/AccountBalanceSummary.tsx';
import AccountTransactionsList from '../accountDetail/AccountTransactionsList.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
//---
const user = import.meta.env.VITE_USER_ID;
//----------------------------
//--Account category detailed w/o edition. Not useState usage.
//----------------------------
type ListOfCategoryAccountsRouteStateType ={
    accountDetailed?: CategoryBudgetAccountListType & {
    remain: number;
    statusAlert: boolean;
    } | null;

  previousRoute: string;
}
//=====================================
function CategoryDetail() {
  const {accountId:rawAccountId, categoryName}=useParams<{
  accountId?: string;
  categoryName?: string;
}>()

const accountId = (rawAccountId || '').trim();

if (!accountId) {
throw new Error("Invalid account ID parameter");
}

  const location =useLocation()
  const state = location.state??{};

  const {accountDetailed=null, previousRoute=categoryName?`/fintrack/budget/category/${categoryName}`:'/fintrack/budget'}= (state as Partial<ListOfCategoryAccountsRouteStateType>) ?? {}
    
  // console.log("🚀 ~ CategoryDetail ~ :", accountId,previousRoute, accountDetailed)
//---

// console.log('adc', accountDetailed)
//summary data
  const summaryData =accountDetailed? {
    title: 'Budget',
    amount: Number(accountDetailed.budget),
    subtitle1: 'Spent',
    amount1:+accountDetailed.account_balance,
    status: accountDetailed.statusAlert as boolean,
    amount2:(+accountDetailed.remain),
    currency_code: accountDetailed.currency_code,
     }
     :{
    title: 'Budget',
    amount: 0,
    subtitle1: 'Spent',
    amount1:0,
    status: false,
    amount2:0,
    currency_code:'usd' as CurrencyType
     }
     ;

//--------------------------------
//period dates considering previous number of months and current month transactions
    const tdy = new Date()
    const numberOfMonths=2
    const firstDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth()-numberOfMonths+1,1)
    const lastDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth()+1,0)

    //--YYYY-MM-DD
    const apiStartDate = firstDayOfPeriod.toISOString().split('T')[0]
    const apiEndDate = lastDayOfPeriod.toISOString().split('T')[0]
//--------------------------------
//--Fetch Data
    //--account detail transactions
    const urlTransactionsAccountById = `${url_get_transactions_by_account_id}/${accountId}/?user=${user}&start=${apiStartDate}&end=${apiEndDate}`;

    const {
      apiData: transactionAccountApiResponse,//{status, message, data}
      isLoading:isLoadingTransactions,
      error:errorTransactions,
    } = useFetch<TransactionsAccountApiResponseType>(
      urlTransactionsAccountById
    );

    const transactions = transactionAccountApiResponse?.data.transactions??[];

    console.log('transactions', transactions)
    
    const summaryAccountBalance = (transactionAccountApiResponse?.data.summary)??{
  initialBalance: { amount: 0, date: '', currency: DEFAULT_CURRENCY },
  finalBalance: { amount: 0, date: '', currency: DEFAULT_CURRENCY },
  periodStartDate: '',
  periodEndDate: ''
};
//-------------------------------------

//======================================
  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container'>
            <Link to={previousRoute} relative='path' className='iconLeftArrow'>
              <LeftArrowLightSvg />
            </Link>

            <div className='form__title'>{capitalize(accountDetailed?.account_name)}</div>
            
            <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link>
          </div>
        </div>

        <SummaryDetailBox bubleInfo={summaryData}></SummaryDetailBox>

      <article className='form__box'>
          <div className='form__container'>

            <div className='input__box'>
                <label className='label form__title'>{`Current Balance`}</label>

                <div className="input__container"
                style={{ padding: '0.5rem' }}>{currencyFormat(accountDetailed?.currency_code, accountDetailed?.account_balance)}
                </div>
              </div>
                      
            {/* INCLUIR EN EL BACKEND ACCOUNT TYPE ANAME  */}
            <div className='input__box'>
              <label className='label form__title'>{'Account Type'}</label>

              <p className='input__container' style={{ padding: '0.5rem' }}>
                {(accountDetailed?.account_type_name)}
              </p>
            </div>

            <div className='account__dateAndCurrency'>
              <div className='account__date'>
                <label className='label form__title'>{'Starting Point'}</label>
                <div
                  className='form__datepicker__container'
                  style={{ textAlign: 'center', color:'white' }}
                >
                  {formatDateToDDMMYYYY((accountDetailed?.account_start_date))}
                </div>
              </div>

              <div className='account__currency'>
                <div className='label form__title'>{'Currency'}</div>

                <CurrencyBadge
                  variant={VARIANT_FORM}
                  currency={accountDetailed?.currency_code??DEFAULT_CURRENCY}
                />
              </div>
            </div>
          </div>
 
{/* --- TRANSACTION STATEMENT SECTION --- */}
        <div className="account-transactions__container "
        style={{margin:'1rem 0'}}
        >
        <div className="period-info">
          <div className="period-info__label">Period</div>
          <span className="period-info__dates  ">{formatDateToDDMMYYYY(summaryAccountBalance.periodStartDate)}{'  '}  /  {'  '} {formatDateToDDMMYYYY(summaryAccountBalance.periodEndDate)}</span>
        </div>

         <AccountBalanceSummary summaryAccountBalance={summaryAccountBalance}/>
        
          <div className='presentation__card__title__container '>
            <CardTitle>{'Last Movements'}</CardTitle>
          </div>

      { transactions.length === 0 && <p>No existen transacciones en esta cuenta</p>}

      { transactions.length > 0 &&     <AccountTransactionsList transactions={transactions} />
      }
        </div>
        </article>
  {/* --- END TRANSACTION STATEMENT SECTION --- */}

      {( isLoadingTransactions) && <p>Loading...</p>}
        {( errorTransactions) && <p>Error fetching account info: {errorTransactions}</p>}

      </section>
    </>
  );
}

export default CategoryDetail;
