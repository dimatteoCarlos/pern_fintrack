import { Link, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import {
  DEFAULT_ACCOUNT_TRANSACTIONS,
  DEFAULT_CURRENCY,
  DEFAULT_POCKET_ACCOUNT_LIST,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';
import {  PocketSavingAccountsResponseType, AccountSummaryBalanceType, AccountTransactionType,  PocketListType, TransactionsAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { url_get_account_by_id, url_get_transactions_by_account_id } from '../../../endpoints.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import { capitalize, formatDateToDDMMYYYY  } from '../../../helpers/functions.ts';
import '../styles/forms-styles.css';
import SummaryPocketDetailBox from './summaryPocketDetailBox/SummaryPocketDetailBox.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import AccountBalanceSummary from '../accountDetail/AccountBalanceSummary.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import AccountTransactionsList from '../accountDetail/AccountTransactionsList.tsx';
//---
type LocationStateType = {
  pocketData: PocketListType;
  previousRoute: string;
};
//DATA INITIALIZING
const initialPocketDetail =DEFAULT_POCKET_ACCOUNT_LIST[0]

const initialAccountTransactionsData = DEFAULT_ACCOUNT_TRANSACTIONS['data'];
//=============================
// MAIN COMPONENT POCKET DETAIL
//=============================
function PocketDetail() {
  const location = useLocation();
  const state = location.state as LocationStateType | null;

  const previousRouteFromState = state?.previousRoute ?? "/fintrack/budget";
  const {pocketId:accountId} = useParams()
//------------------------
//data from endpoint request for info account, and for api transactions by pocket account id

//--STATES
 //--state for account detail global info
 const [accountDetail, setAccountDetail] = useState((initialPocketDetail));

 const [previousRoute, setPreviousRoute] = useState<string>("/fintrack/overview"); 
//----------
//--state for account transactions data
  const [transactions, setTransactions]=useState<AccountTransactionType[]>(initialAccountTransactionsData.transactions)

  const [summaryAccountBalance, setSummaryAccountBalance]=useState<AccountSummaryBalanceType>(initialAccountTransactionsData.summary)
//---------------------------
//--Fetch Data
//--account detail global info
  const urlAccountById = `${url_get_account_by_id}/${accountId}`;
  const {
    apiData: accountsData,
    isLoading,
    error,
  } = useFetch<PocketSavingAccountsResponseType >(
    urlAccountById
  );

// console.log('accountsData', accountsData)
//--------------------------------
//period dates considering previous number of months and current month transactions
    const tdy = new Date()
    const numberOfMonths=2
    const firstDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth()-numberOfMonths+1,1)
    const lastDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth()+1,0)

    //--YYYY-MM-DD
    const apiStartDate = firstDayOfPeriod.toISOString().split('T')[0]
    const apiEndDate = lastDayOfPeriod.toISOString().split('T')[0]

//--Fetch Data
//--account detail transactions
    const urlTransactionsAccountById = `${url_get_transactions_by_account_id}/${accountId}/?start=${apiStartDate}&end=${apiEndDate}`;

    const {
      apiData: transactionAccountApiResponse,//{status, message, data}
      isLoading:isLoadingTransactions,
      error:errorTransactions,
    } = useFetch<TransactionsAccountApiResponseType>(
      urlTransactionsAccountById
    );
//---------------------------
useEffect(() => {
  if(transactionAccountApiResponse?.data.transactions){
    setTransactions(transactionAccountApiResponse?.data.transactions)
    setSummaryAccountBalance(transactionAccountApiResponse?.data.summary)
  }
  //else keep the initial values
}, [transactionAccountApiResponse])

//--------------------------------
useEffect(() => {
if(previousRouteFromState)(setPreviousRoute(previousRouteFromState))

if(accountsData?.data?.accountList ){
  const account = accountsData?.data?.accountList[0]

  if(account){setAccountDetail(account)}
}

}, [accountsData, accountId,previousRouteFromState])
 
//=============================
  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container'>
            <Link  to={previousRoute} relative='path' className='iconLeftArrow'>
              <LeftArrowLightSvg />
            </Link>
            <div className='form__title'>{capitalize(accountDetail?.account_name).toUpperCase()}</div>
            
            {/* <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link> */}

          <div id='edit' className='flx-col-center icon3dots'>
          <Dots3LightSvg />
          </div>

          </div>
        </div>

        <SummaryPocketDetailBox bubleInfo={accountDetail}></SummaryPocketDetailBox>

        <article className='form__box'>
          <div className='form__container'>

            <div className='input__box'>
              <label className='label form__title'>{'Note'}</label>
              <div className="input__container"
                style={{ padding: '0.5rem' }}>{(accountDetail?.note)}
                </div>
            </div>
           
            <div className='input__box'>
              <label className='label form__title'>{'Desired Date'}</label>
              <div className="input__container"
                style={{ padding: '0.5rem' }}>{formatDateToDDMMYYYY(accountDetail?.desired_date)}
                </div>
            </div>

            <div className='account__dateAndCurrency'>
              <div className='account__date'>
                <label className='label form__title'>{'Starting Point'}</label>
                <div
                  className='form__datepicker__container'
                  style={{ textAlign: 'center', color:'white' }}
                >
                  {formatDateToDDMMYYYY((accountDetail.account_start_date))}
                </div>
              </div>

              <div className='account__currency'>
                <div className='label form__title'>{'Currency'}</div>

                <CurrencyBadge
                  variant={VARIANT_FORM}
                  currency={accountDetail.currency_code??DEFAULT_CURRENCY}
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

         <AccountTransactionsList transactions={transactions} /> 
        </div>
          {/* --- END TRANSACTION STATEMENT SECTION --- */}

            {/* <ListContent listOfItems={lastMovements} /> */}        
          </article>

      {(isLoading || isLoadingTransactions) && <p>Loading...</p>}
        {(error|| errorTransactions) && <p>Error fetching account info: {error??errorTransactions}</p>}

      </section>
    </>
  );
}

export default PocketDetail;
