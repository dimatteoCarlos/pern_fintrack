import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useFetch } from '../../hooks/useFetch'
import { INITIAL_PAGE_ADDRESS } from '../../helpers/constants'
// import { url_get_accounting_accounts} from '../../endpoints'
import {url_get_all_accounting_accounts } from '../../endpoints'
import { AccountByTypeResponseType, AccountListType } from '../../types/responseApiTypes'
import AccountingBox from '../accounting/components/AccountingBox'
import TopWhiteSpace from '../../general_components/topWhiteSpace/TopWhiteSpace'
import LeftArrowSvg from '../../assets/LeftArrowSvg.svg';
import Toast from '../../edition/components/toast/Toast'
import { capitalize } from '../../helpers/functions'
import './styles/accountingDashboard-styles.css';

//--------------------------------
const ACCOUNT_TYPE_DATA = {
  bank: { emoji: '🏦', name: 'bank' },
  investment: { emoji: '📈', name: 'investment' },
  debtor: { emoji: '👥', name: 'debtor' },
  pocket_saving: { emoji: '💰', name: 'pocket_saving' },
  category_budget: { emoji: '📊', name: 'category_budget' },
  income_source: { emoji: '💼', name: 'income_source' },
  other: { emoji: '📁', name: 'other' },
} ;

type ToastMessageType='success' | 'error' | 'info' | 'warning';

type AccountType = keyof typeof ACCOUNT_TYPE_DATA

//--- FUNCTIONS DECLARATION
// 🎯 SIMPLE ACCOUNT GROUPING - FUNCTION
const groupAccountsBytype = (accounts:AccountListType[]):Partial<Record<AccountType, AccountListType[]>>=>{
  const groups : Partial<Record<AccountType, AccountListType[]>>= {}

  accounts.forEach(
    (account)=>{
  const accountType = ACCOUNT_TYPE_DATA[account.account_type_name as AccountType]
    ? (account.account_type_name ) as AccountType
    :'other'

  if(!groups[accountType]){
    groups[accountType]=[]
  }
  groups[accountType]=[...groups[accountType], account]
    }
  )

  return groups
}
//----------------------------
// 🏦 MAIN DASHBOARD COMPONENT
const AccountingDashboard = () => {
  const location = useLocation()
  const previousRoute=location?.state.originRoute || INITIAL_PAGE_ADDRESS
  //  const user = import.meta.env.VITE_USER_ID ;
// -----------------------------
// 🔄 FETCHING - ACCOUNTS LIST
// const { apiData, isLoading, error } = useFetch<AccountByTypeResponseType>(
// `${url_get_accounting_accounts}`
// );  
// url_get_all_accounting_accounts
const { apiData, isLoading, error } = useFetch<AccountByTypeResponseType>(
`${url_get_all_accounting_accounts}`
); 
//=============================
// 🚨 TOAST STATE
  const [toast, setToast] = useState<{
    message: string;
    type: ToastMessageType;
    visible: boolean;
  }>({ message: '', type: 'info', visible: false }); 
//--------------------------------
// FUNCTIONS DECLARATION
// TOAST STATE MANAGEMENT FUNCTIONS
// 🎯 SHOW TOAST MESSAGE FUNCTION
const showToast = (message: string, type: ToastMessageType="info") => {
setToast({ message, type, visible: true });
};

// 🎯 HIDE TOAST MESSAGE FUNCTION
  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

// 🎨 GET EMOJI AND NAME FOR ACCOUNT TYPE FUNCTION
const getAccountTypeEmojiAndName = (accountType: AccountType) => {
  return ACCOUNT_TYPE_DATA[accountType] || ACCOUNT_TYPE_DATA['other'] ;
}; 
//---
// 🎨 FORMAT ACCOUNT TYPE DISPLAY NAME FUNCTION
const formatAccountTypeName = (accountType:AccountType | AccountType):string=>{
  return capitalize(accountType.replace('_', ' ')) 
}

// 📊 ACCOUNT GROUPING BY TYPE - FUNCTION
const groupedAccounts = useMemo(()=>{
  const groupResponseMessage = {error:`Error loading accounts:`, isLoading:`...loading`, notFound:`No accounts found.Create first account! 🎯`}
 
  // 📊 ACCOUNT GROUPING BY TYPE
  if(error){
  showToast(`${groupResponseMessage.error} ${error}`, 'error')
  return {}
  }

  if(isLoading){
  showToast(`${groupResponseMessage.isLoading}`)
  return {}
  }

  if(!apiData?.data.accountList.length){
  showToast(`${groupResponseMessage.notFound}`, 'warning')
  return {}
  }

  return groupAccountsBytype(apiData.data.accountList)

}, [isLoading, error, apiData?.data.accountList])

// 📦 RENDER ACCOUNT GROUPS FUNCTION
const renderAccountGroups = ()=>{
  if(isLoading){
    // return <AccountingSkeleton/>
  }

  if(Object.keys(groupedAccounts).length===0 && !isLoading){
    return null
  }

  return Object.entries(groupedAccounts).map(
    ([accountType , accounts])=>{
     const safeAccountType = accountType as AccountType
     
    const accountTypeData = getAccountTypeEmojiAndName(safeAccountType)

  return (
    <div className="account-group" key={accountType}>
    <h3 className="account-group__title">
      <span className="account-group__emoji">
      {accountTypeData.emoji}  
      </span>

      <span className="account-group__name">
      { formatAccountTypeName(accountTypeData.name as AccountType ) } accounts
      </span>

    </h3>

    <div className="account-group__grid">
    {accounts.map((account)=>(
        <div className="account-card" key ={account.account_id}>
        <AccountingBox
        title={account.account_name}
        amount={account.account_balance}
        currency={account.currency_code}
        account_type={`(${capitalize(account.account_type_name).slice(0, 6)})`}
      
        />
        </div>
      ))}
    </div>
  </div>
  )
  }
)
}//----------------
//SIDE EFFECTS
// ⏰ AUTO-HIDE TOAST AFTER 4 SECONDS
 useEffect(() => {
  if(toast.visible){
   const timer = setTimeout(()=>{hideToast()}, 4000)
 
   return () => {
     clearTimeout(timer)
   }}
 }, [toast.visible])
 
//----------------------------------
// 🎪 MAIN RENDER 
  return (
    <>
    <section className='accounting__layout'>
    <TopWhiteSpace variant={'dark'} />

    <div className='accounting__container'>
      {/* <Link to={'/tracker/expense'} className='accounting__header'> */}
      <Link to={previousRoute} className='accounting__header'>
        <div className='accounting__header--icon'>
            <LeftArrowSvg />
        </div>

        <div className='accounting__title'>{'Accounting'}</div>
      </Link>

      {renderAccountGroups()}
      </div>

    {/* 🚨 TOAST NOTIFICATION */}
    <Toast
      message={toast.message}
      type={toast.type}
      visible={toast.visible}
      onClose={hideToast}
      duration={4000}
    />    
    
    </section>
    </>
  )
}

export default AccountingDashboard