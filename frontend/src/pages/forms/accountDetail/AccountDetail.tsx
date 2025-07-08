import { Link, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
import {
  ACCOUNT_DEFAULT,
  DEFAULT_CURRENCY,
  VARIANT_FORM,
  DEFAULT_ACCOUNT_TRANSACTIONS,
} from '../../../helpers/constants';
import { capitalize,  numberFormatCurrency, formatDateToDDMMYYYY } from '../../../helpers/functions';
import '../styles/forms-styles.css';
import { AccountByTypeResponseType, AccountListType, TransactionsAccountApiResponseType,  AccountTransactionType, AccountSummaryBalanceType } from '../../../types/responseApiTypes';
import { url_get_account_by_id, url_get_transactions_by_account_id } from '../../../endpoints';
import { useFetch } from '../../../hooks/useFetch';
import './styles/accountDetailTransactions-styles.css'
import AccountBalanceSummary from './AccountBalanceSummary';
import AccountTransactionsList from './AccountTransactionsList';
// import CoinSpinner from '../../../loader/coin/CoinSpinner';

const user = import.meta.env.VITE_USER_ID;

type LocationStateType ={
previousRoute:string; detailedData:AccountListType;
}
//dummy data (used if API data is not available or for initial state)
//account main data
const initialAccountDetail = ACCOUNT_DEFAULT[0]

const initialAccountTransactionsData = DEFAULT_ACCOUNT_TRANSACTIONS['data'];
// console.log('initialAccountTransactions', initialAccountTransactionsData)
//---------------
function AccountDetail() {
  const location = useLocation() 
  const state = location.state as LocationStateType | null;
  const detailedData = state?.detailedData;
  const previousRouteFromState = state?.previousRoute ?? "/";
  const {accountId} = useParams()
  console.log('location',  accountId, detailedData)
//--------------------------------------------------
  //data from endpoint request for info account, and for api transactions by accountId
 //--states
 //--state for account detail global info
    const [accountDetail, setAccountDetail] = useState<AccountListType>(initialAccountDetail);
    const [previousRoute, setPreviousRoute] = useState<string>("/fintrack/overview"); 
 //--state for account transactions data
    const [transactions, setTransactions]=useState<AccountTransactionType[]>(initialAccountTransactionsData.transactions)

    const [summaryAccountBalance, setSummaryAccountBalance]=useState<AccountSummaryBalanceType>(initialAccountTransactionsData.summary)
 //-------------------------------------
    //--Fetch Data
    //--account detail global info
    const urlAccountById = `${url_get_account_by_id}/${accountId}?&user=${user}`;

    const {
      apiData: accountsData,
      isLoading,
      error,
    } = useFetch<AccountByTypeResponseType>(
      detailedData?"":urlAccountById
    );

    //--account transaction api response
    //--how to handle dates period
    //Although the getTransactionsForAccountById backend, deals with the last 30 days transactions, here, it wil get the transactions for current month, and a specified number of months period
    //in the future, include a dynamic filter or date picker range dates
    //period dates considering previous number of months and current month transactions
    const tdy = new Date()
    const numberOfMonths=2
    const firstDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth()-numberOfMonths+1,1)
    const lastDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth()+1,0)

    //--YYYY-MM-DD
    const apiStartDate = firstDayOfPeriod.toISOString().split('T')[0]
    const apiEndDate = lastDayOfPeriod.toISOString().split('T')[0]

    //-----
    const urlTransactionsAccountById = `${url_get_transactions_by_account_id}/${accountId}/?user=${user}&start=${apiStartDate}&end=${apiEndDate}`;

    const {
      apiData: transactionAccountApiResponse,//{status, message, data}
      isLoading:isLoadingTransactions,
      error:errorTransactions,
    } = useFetch<TransactionsAccountApiResponseType>(
      urlTransactionsAccountById
    );

//-------------------------------------
useEffect(() => {
  if(transactionAccountApiResponse?.data.transactions){
    setTransactions(transactionAccountApiResponse?.data.transactions)
    setSummaryAccountBalance(transactionAccountApiResponse?.data.summary)
  }
  //else keep the initial values
}, [transactionAccountApiResponse])

//--------------------------------------
useEffect(()=>{
if(detailedData){
    setAccountDetail(detailedData)
    if (previousRouteFromState) {
      setPreviousRoute(previousRouteFromState);
      }
    }
  },[detailedData, previousRouteFromState])

useEffect(() => {
  if(!detailedData && accountsData?.data?.accountList?.length ){
    const account = accountsData.data.accountList[0]
    //  const account = accountsData.data.accountList.find((acc)=>acc.account_id === Number(accountId))
    if(account)setAccountDetail(account)}

}, [accountsData, detailedData,accountId,])
//----------------------------------

//==============================================

  // if (error) return <div className='error-message'>{error}</div>;
  //           {isLoading && (
  //                 <div
  //                   className='loader__container'
  //                   style={{
  //                     position: 'absolute',
  //                     left: '50%',
  //                     top: '50%',
  //                     zIndex: '1',
  //                   }}
  //                 >
  //                   <CoinSpinner />
  //                 </div>
  //               )}

  return (
    <section className='page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
        <div className='main__title--container'>

          <Link to={previousRoute} relative='path' className='iconLeftArrow'>
            <LeftArrowLightSvg />
          </Link>
          
          <div className='form__title'>{capitalize(accountDetail?.account_name).toUpperCase()}</div>
          
          <Link to='edit' className='flx-col-center icon3dots'>
            <Dots3LightSvg />
          </Link>
        </div>

        <form className='form__box'>
          <div className='form__container'>
            <div className='input__box'>
              <div className='label form__title'>{`Current Balance`}</div>

              <div className='input__container' style={{ padding: '0.5rem' }}>
                {numberFormatCurrency(accountDetail?.account_balance)}
              </div>
            </div>

            <div className='input__box'>
              <label className='label form__title'>{'Account Type'}</label>

              <p className='input__container' style={{ padding: '0.5rem' }}>
                {capitalize(accountDetail.account_type_name!.toLocaleString())}
              </p>
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
        </form>
        
        {(isLoading || isLoadingTransactions) && <p>Loading...</p>}
        {(error|| errorTransactions) && <p>Error fetching account info: {error??errorTransactions}</p>}
      </div>
    </section>
  );
}

export default AccountDetail;

// {
// 	"status": 200,
// 	"message": "5 transaction(s) found for account id 23. Period between 2025-05-21 and 2025-06-21.",
// 	"data": {
// 		"totalTransactions": 5,
// 		"summary": {
// 			"initialBalance": {
// 				"amount": 0,
// 				"date": "2025-06-15T22:40:50.140Z",
// 				"currency": "usd"
// 			},
// 			"finalBalance": {
// 				"amount": 3418.32,
// 				"currency": "usd",
// 				"date": "2025-06-16T00:07:08.436Z"
// 			},
// 			"periodStartDate": "2025-05-21",
// 			"periodEndDate": "2025-06-21"
// 		},
// 		"transactions": [
// 			{
// 				"transaction_id": 15,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "income test.Transaction: deposit. Received 3316.32 usd in account \"nuovo conto (bank), from \"project 01\" (income_source). Date: 15/06/2025, 20:07",
// 				"amount": "3316.32",
// 				"movement_type_id": 2,
// 				"transaction_type_id": 2,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "3418.32",
// 				"source_account_id": 4,
// 				"destination_account_id": 23,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-16T00:07:08.436Z",
// 				"created_at": "2025-06-16T04:07:09.547Z",
// 				"updated_at": "2025-06-16T04:07:09.547Z",
// 				"movement_type_name": "income",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			},
// 			{
// 				"transaction_id": 13,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "test b-b.Transaction: deposit. Received 100 usd in account \"nuovo conto (bank), from \"Nueva Cuenta\" (bank). Date: 15/06/2025, 20:00",
// 				"amount": "100.00",
// 				"movement_type_id": 6,
// 				"transaction_type_id": 2,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "102.00",
// 				"source_account_id": 21,
// 				"destination_account_id": 23,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-16T00:00:37.008Z",
// 				"created_at": "2025-06-16T04:00:38.168Z",
// 				"updated_at": "2025-06-16T04:00:38.168Z",
// 				"movement_type_name": "transfer",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			},
// 			{
// 				"transaction_id": 11,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "5.Transaction: deposit. Received 1 usd from account \"Nueva Cuenta\" (bank), credited to \"nuovo conto (bank). Date: 15/06/2025, 19:53",
// 				"amount": "1.00",
// 				"movement_type_id": 6,
// 				"transaction_type_id": 2,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "2.00",
// 				"source_account_id": 21,
// 				"destination_account_id": 23,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-15T23:53:55.736Z",
// 				"created_at": "2025-06-16T03:53:56.930Z",
// 				"updated_at": "2025-06-16T03:53:56.930Z",
// 				"movement_type_name": "transfer",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			},
// 			{
// 				"transaction_id": 16,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "tet s b-d.Transaction: lend. Transfered 100 usd from account \"nuovo conto\" (bank) credited to \"villalba, jovito\" (debtor). Date: 15/06/2025, 18:38",
// 				"amount": "-100.00",
// 				"movement_type_id": 4,
// 				"transaction_type_id": 3,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "3318.32",
// 				"source_account_id": 23,
// 				"destination_account_id": 7,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-15T22:38:34.755Z",
// 				"created_at": "2025-06-16T04:08:34.766Z",
// 				"updated_at": "2025-06-16T04:08:34.766Z",
// 				"movement_type_name": "debt",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			},
// 			{
// 				"transaction_id": 5,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "Transaction: account-opening. Account: nuovo conto. Type: bank. Initial-(account-opening). Amount: 0 usd. Date: 15-06-2025",
// 				"amount": "0.00",
// 				"movement_type_id": 8,
// 				"transaction_type_id": 5,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "0.00",
// 				"source_account_id": 23,
// 				"destination_account_id": 23,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-15T21:47:25.964Z",
// 				"created_at": "2025-06-16T01:47:29.837Z",
// 				"updated_at": "2025-06-16T01:47:29.837Z",
// 				"movement_type_name": "account-opening",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			}
// 		]
// 	}
// }
