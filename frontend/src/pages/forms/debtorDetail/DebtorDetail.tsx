import { Link, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import '../styles/forms-styles.css';
import {
  DEFAULT_ACCOUNT_TRANSACTIONS,
  DEFAULT_CURRENCY,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';
import { AccountByTypeResponseType, AccountListType, AccountSummaryBalanceType, AccountTransactionDataType, AccountTransactionType, DebtorListType, TransactionsAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { url_get_account_by_id, url_get_transactions_by_account_id  } from '../../../endpoints.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import { capitalize, formatDateToDDMMYYYY, numberFormatCurrency } from '../../../helpers/functions.ts';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import AccountBalanceSummary from '../accountDetail/AccountBalanceSummary.tsx';
import AccountTransactionsList from '../accountDetail/AccountTransactionsList.tsx';
import SummaryDebtorDetailBox from './summaryDebtorDetailBox/SummaryDebtorDetailBox.tsx';

//---------------
const user = import.meta.env.VITE_USER_ID;

type LocationStateType ={
  previousRoute:string; debtorDetailedData:DebtorListType;
}

//--functions
  function getBubleInfoFromAccountDetail(accountDetail:AccountListType):DebtorListType{
    return {
    account_name: accountDetail.account_name,
    account_id: accountDetail.account_id,
    currency_code: accountDetail.currency_code,
    total_debt_balance: accountDetail.account_balance,
    debt_receivable: accountDetail.account_balance<0?accountDetail.account_balance:0,
    debt_payable: accountDetail.account_balance>0?accountDetail.account_balance:0,
    creditor: accountDetail.account_balance<0?1:0,
    debtor: accountDetail.account_balance>=0?1:0,
}}
  // let initialAccountDetail:AccountListType
  const initialAccountDetail:AccountListType = {
  account_name: 'Lastname, name example',
  account_id:1000, //| null;
  currency_code: 'usd',
  account_balance: 10, //| null;
   account_type_name: 'debtor',
   account_type_id: 3,
   account_starting_amount:0,
   account_start_date:new Date(),
  };

  const initialAccountTransactionsData: AccountTransactionDataType = DEFAULT_ACCOUNT_TRANSACTIONS['data'];

   // console.log('initialAccountTransactions', initialAccountTransactionsData)

//---------------------------
function DebtorDetail() {
const location = useLocation() 
  const state = location.state as LocationStateType | null;
  const debtorDetailedData = state?.debtorDetailedData;
  const previousRouteFromState = state?.previousRoute ?? "/fintrack/debts/debtors"
  const { debtorId:accountId} = useParams()
  // console.log('location',  accountId,'useParams', useParams(), {debtorDetailedData})
//------------------------
  //initial state values
  // initialBubleInfo:DebtorListType
  const initialBubleInfo:DebtorListType=debtorDetailedData??getBubleInfoFromAccountDetail(initialAccountDetail)

 //--states
  //--state for account detail global info
     const [accountDetail, setAccountDetail] = useState<AccountListType>(initialAccountDetail);
     const [previousRoute, setPreviousRoute] = useState<string>("/fintrack/debts/debtors"); 
     const [bubleInfo, setBubleInfo] = useState<DebtorListType>(initialBubleInfo); 

     //--state for account transactions data
       const [transactions, setTransactions]=useState<AccountTransactionType[]>(initialAccountTransactionsData.transactions)
     
         const [summaryAccountBalance, setSummaryAccountBalance]=useState<AccountSummaryBalanceType>(initialAccountTransactionsData.summary)
     
//-------------------------------------
//--Fetch Data
//--account detail global info
// console.log('urlDesg', url_get_account_by_id, accountId, user)

  const urlAccountById = `${url_get_account_by_id}/${accountId}?&user=${user}`;
  
    const {
      apiData: accountsData,
      isLoading,
      error,
    } = useFetch<AccountByTypeResponseType>(
     urlAccountById
    );

  // console.log('accountsData', accountsData,'url',  urlAccountById)
  //--account transaction api response
  //--how to handle dates period
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
//--    
useEffect(()=>{
  if(previousRouteFromState)(setPreviousRoute(previousRouteFromState))
  if(accountsData?.data?.accountList?.length){
     const account = accountsData.data.accountList[0]
    //  const account = accountsData.data.accountList.find((acc)=>acc.account_id === Number(accountId))
    if(account){setAccountDetail(account)
      
    setBubleInfo(getBubleInfoFromAccountDetail(accountsData?.data?.accountList[0]) )
    }
  }
    
  },[accountsData?.data?.accountList, previousRouteFromState])

//-------------------------------------
useEffect(() => {
  if(transactionAccountApiResponse?.data.transactions){
    setTransactions(transactionAccountApiResponse?.data.transactions)
    setSummaryAccountBalance(transactionAccountApiResponse?.data.summary)
  }
  //else keep the initial values
}, [transactionAccountApiResponse])

//--------------------------------------

// console.log('account detail', accountDetail)
  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container '>
            <Link to={previousRoute} relative='path' className='iconLeftArrow'>
            <LeftArrowLightSvg />
          </Link>
            <div className='form__title'>
              {capitalize(bubleInfo.account_name)}
            </div>
            <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link>
          </div>

          <SummaryDebtorDetailBox bubleInfo={bubleInfo}></SummaryDebtorDetailBox>

          <article className='form__box'>
            <div className='form__container'>
              <div className='input__box'>
                <label className='label form__title'>{`Current Balance`}</label>

                <div className="input__container"
                style={{ padding: '0.5rem' }}>{numberFormatCurrency(accountDetail?.account_balance)}
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

          </article>

          
        {(isLoading || isLoadingTransactions) && <p>Loading...</p>}
        {(error|| errorTransactions) && <p>Error fetching account info: {error??errorTransactions}</p>}
        </div>
      </section>
    </>
  );
}

export default DebtorDetail;
