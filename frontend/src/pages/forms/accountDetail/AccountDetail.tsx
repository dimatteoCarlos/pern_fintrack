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
// import ListContent from '../../../general_components/listContent/ListContent';
// import FormDatepicker from '../../../general_components/datepicker/Datepicker';
// import { StatusSquare } from '../../../components/boxComponents.tsx';
// import SummaryDetailBox from '../../../components/summaryDetailBox/SummaryDetailBox.tsx';
// import PlusSignSvg from '../../../assets/PlusSignSvg.svg';
// import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn';
// import { AccountByTypeResponseType, AccountListType  } from '../../../types/responseApiTypes';

const user = import.meta.env.VITE_USER_ID;

type LocationStateType ={
previousRoute:string; detailedData:AccountListType;
}
//temporary data (used if API data is not available or for initial state)
//account main data
const initialAccountDetail = ACCOUNT_DEFAULT[0]

const initialAccountTransactionsData = DEFAULT_ACCOUNT_TRANSACTIONS['data'];
console.log('initialAccountTransactions', initialAccountTransactionsData)
//---------------
function AccountDetail() {
  const location = useLocation() 
  const state = location.state as LocationStateType | null;
  const detailedData = state?.detailedData;
  const previousRouteFromState = state?.previousRoute ?? "/";
  const {accountId} = useParams()
  console.log('location',  accountId, detailedData)

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
    const urlBankAccountById = `${url_get_account_by_id}/${accountId}?&user=${user}`;
    const {
      apiData: bankAccountsData,
      isLoading,
      error,
    } = useFetch<AccountByTypeResponseType>(
      detailedData?"":urlBankAccountById
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
//extraer tranasactions de  transactionAccountApiResponse
//definir un estado para c/u de las variables transactions , un estado para initialBalance: BalanceInfo,  otro para finalBalance: BalanceInfo,  periodStartDate: string;   periodEndDate: string; , 
//considerar un use effect para estos estados 

//--------------------------------------
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
  if(!detailedData && bankAccountsData?.data?.accountList?.length ){
    // const account = bankAccountsData.data.accountList[0]
     const account = bankAccountsData.data.accountList.find((acc)=>acc.account_id === Number(accountId))
    if(account)setAccountDetail(account)}

}, [bankAccountsData, detailedData,accountId,])
//----------------------------------


//==============================================
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
                  // updateOutsideCurrencyData={updateCurrency}
                  // apparently there's a currency datum associated to each account
                />
              </div>
            </div>
          </div>

          {/* --- TRANSACTION STATEMENT SECTION --- */}
        <div className="account-transactions__container "
        style={{margin:'1rem 0'}}
        >
        <div className="period-info">
          <span className="period-info__label"></span>
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
