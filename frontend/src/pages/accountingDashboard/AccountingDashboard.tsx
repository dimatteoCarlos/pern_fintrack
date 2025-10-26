// frontend/src/pages/accountingDashboard/AccountingDashboard.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useFetch } from '../../hooks/useFetch'

import { INITIAL_PAGE_ADDRESS } from '../../helpers/constants'
import {url_get_all_accounting_accounts,  } from '../../endpoints'

import AccountingBox from '../accounting/components/AccountingBox'
import TopWhiteSpace from '../../general_components/topWhiteSpace/TopWhiteSpace'
import LeftArrowSvg from '../../assets/LeftArrowSvg.svg';
import Toast from '../../edition/components/toast/Toast'
import AccountActionsMenu from '../../edition/components/accountActionMenu/AccountActionsMenu'
//---
import { AccountByTypeResponseType, AccountListType, CategoryBudgetAccountListType,  } from '../../types/responseApiTypes'

import { capitalize } from '../../helpers/functions'

import './styles/accountingDashboard-styles.css';
import { isCategoryBudgetAccount } from '../../edition/utils/categoryBudgetCalculations'
// import AccountingSkeleton from '../../edition/components/skeleton/AccountingSkeleton'

//--------------------------------
// ACCOUNT TYPE CONFIGURATION
const ACCOUNT_TYPE_DATA = {
  bank: { emoji: '🏦', name: 'bank' },
  investment: { emoji: '📈', name: 'investment' },
  debtor: { emoji: '👥', name: 'debtor' },
  pocket_saving: { emoji: '💰', name: 'pocket_saving' },
  category_budget: { emoji: '🛒', name: 'category_budget' },
  // category_budget: { emoji: '📊', name: 'category_budget' },
  income_source: { emoji: '💼', name: 'income_source' },
  other: { emoji: '📁', name: 'other' },
} ;

// ROUTE CONFIGURATION
const ACCOUNT_TYPE_DETAIL_PAGE: { [key: string]: string } = {
  bank: '/fintrack/overview/accounts',
  income_source: '/fintrack/overview/accounts',
  investment: '/fintrack/overview/accounts',
  debtor: '/fintrack/debts/debtors',
  pocket_saving: '/fintrack/budget/pockets',
  category_budget: `/fintrack/budget/account`,

}

type ToastMessageType='success' | 'error' | 'info' | 'warning';

type AccountType = keyof typeof ACCOUNT_TYPE_DATA

//--- FUNCTIONS DECLARATION
// 🎯 ACCOUNT GROUPING
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

//  if(groups['other']){ 
//   console.log('check other accounts', groups['other'])
//   }

  return groups
}
//===========================
// 🏦 MAIN COMPONENT ACCOUNTING DASHBOARD
//============================
const AccountingDashboard = () => {

  const location = useLocation()
  const navigateTo = useNavigate()

  const originRoute=location.state?.originRoute || INITIAL_PAGE_ADDRESS //previous route to accounting
  const previousRoute = location.pathname // this works as a previous route to account detail view
  
// -----------------------------
// console.log('location', {location},'previousRoute', {previousRoute},'state', location.state, 'originRoute', location.state?.originRoute)
//  const user = import.meta.env.VITE_USER_ID ;
// -----------------------------
// 🔄 FETCHING - ACCOUNTS LIST
//get all basic info accounts
const { apiData, isLoading, error } = useFetch<AccountByTypeResponseType>(
`${url_get_all_accounting_accounts}`
); 
//-------------------------------
//get full category budget account data 
// const { apiData:apiDataCategory ,isLoading:isLoadingCategory ,error:errorCategory } = useFetch<AccountByTypeResponseType>(
// `${url_get_category_budget_full_data}`
// ); 

// console.log('apiDataCategory',apiDataCategory )

//=============================
// 🆕 MENU STATE
const [menuState, setMenuState] = useState<{
  isOpen:boolean; 
  account:AccountListType | null;
}>({isOpen:false, account:null })

// 🚨 TOAST STATE
  const [toast, setToast] = useState<{
    message: string;
    type: ToastMessageType;
    visible: boolean;
  }>({ message: '', type: 'info', visible: false }); 
  
// FUNCTIONS DECLARATION
//==========================
// TOAST STATE MANAGEMENT FUNCTIONS
// 🎯 SHOW TOAST MESSAGE FUNCTION
  const showToast = (message: string, type: ToastMessageType="info") => {
  setToast({ message, type, visible: true });
  };

// 🎯 HIDE TOAST MESSAGE FUNCTION
  const hideToast = () => {
      setToast(prev => ({ ...prev, visible: false }));
    };

//----------------
//SIDE EFFECTS
// ⏰ AUTO-HIDE TOAST AFTER x SECONDS
 useEffect(() => {
  if(toast.visible){
   const timer = setTimeout(()=>{hideToast()}, 3000)
   return () => {
     clearTimeout(timer)
   }
  }
 }, [toast.visible])

//============================
// 🆕 ACCOUNT TYPE UTILITIES
// 🎨 GET EMOJI AND NAME FOR ACCOUNT TYPE FUNCTION
const getAccountTypeEmojiAndName = (accountType: AccountType) => {
  return ACCOUNT_TYPE_DATA[accountType] || ACCOUNT_TYPE_DATA['other'] ;
}; 
//---
// 🎨 FORMAT ACCOUNT TYPE DISPLAY NAME FUNCTION
const formatAccountTypeName = (accountType:AccountType):string=>{
  return capitalize(accountType.replace('_', ' '))
}

// 📊 ACCOUNT GROUPING BY TYPE - FUNCTION
const groupedAccounts = useMemo(()=>{
  const groupResponseMessage = {error:`Error loading accounts:`, isLoading:`...loading`, notFound:`No accounts found. Create first account! 🎯`}
 
// 📊 SHOW TOAST BY TYPE
  if(error){
  showToast(`${groupResponseMessage.error} ${error}`, 'error')
  return {}
  }

  if(isLoading){
  showToast(`${groupResponseMessage.isLoading}`, 'info')
  return {}
  }

  if(!apiData?.data.accountList.length){
  showToast(`${groupResponseMessage.notFound}`, 'warning')
  return {}
  }

  return groupAccountsBytype(apiData.data.accountList)

}, [isLoading, error, apiData?.data.accountList])
//=================================
// 🎯 ACCOUNT ACTION HANDLERS
// 🆕 OPEN MENU FUNCTION
const handleMenuClick = (account:AccountListType, event:React.MouseEvent)=>{
  event.stopPropagation()
  event.preventDefault()

  setMenuState({
    isOpen:true, account })
    showToast(`Menu opened for ${account.account_name}`, 'info');
//---------
// console.log('Menu clicked for account:', account.account_name, 'previousRoute:', previousRoute);
//----------
}
// 🆕 CLOSE MENU FUNCTION
const handleCloseMenu = ()=>{
  setMenuState(prev =>({...prev, isOpen:false}))
}

// 🏦 REGULAR ACCOUNT NAVIGATION HANDLER
// 🎯 HANDLE VIEW DETAILS
  const handleViewRegularAccountDetail = (account: AccountListType) => {
   const baseRoute = ACCOUNT_TYPE_DETAIL_PAGE[account.account_type_name] || '/fintrack/overview/accounts'

   const detailRoute = `${baseRoute}/${account.account_id}`

  //  console.log('regular', {detailRoute}, {account}, {previousRoute})
  
   navigateTo(detailRoute, {state:{  previousRoute,
    detailedData: account 
  }})
}
//-------------------
// 💰 CATEGORY BUDGET ACCOUNT NAVIGATION HANDLER
const handleViewCategoryBudgetAccountDetail=(account:CategoryBudgetAccountListType)=>{
  const categoryDetailRoute = `${ACCOUNT_TYPE_DETAIL_PAGE[account.account_type_name]}/${account.account_id}`

// console.log('categoryRoute', {categoryDetailRoute}, {account}, 'id', account.account_id, {previousRoute})

// 🧭 NAVIGATE TO CATEGORY DETAIL 
  navigateTo(categoryDetailRoute, {
    state:{detailedData:null , previousRoute}
  })
}
//---
// 📋HANDLE VIEW ACCOUNT DETAILS WITH TYPE DETECTION
const handleViewDetails = (account: AccountListType) => {
// handleViewRegularAccountDetail(account);

// 🎯 DETECT CATEGORY BUDGET ACCOUNTS
 if (isCategoryBudgetAccount(account)) {
   // console.log('isCategoryBudgetAccount',account)
  handleViewCategoryBudgetAccountDetail(account);

  } else {
    handleViewRegularAccountDetail(account);
  }
};

//---------------------------------
// 🆕 HANDLE EDIT ACCOUNT CLICK
//PENDIENTE definir desde donde hacer edit
  // const handleEditAccount = (account: AccountListType) => {
  //   const baseRoute = ACCOUNT_TYPE_DETAIL_PAGE[account.account_type_name] || '/fintrack/overview/accounts'
  //   const editRoute = `${baseRoute}/${account.account_id}/edit`
  //   navigateTo(editRoute)
  // }

// 🆕 HANDLE DELETE ACCOUNT CLICK
// const handleDeleteAccount = (account:AccountListType)=>{
// // 🆕 TODO: Implement delete account logic
// showToast(`Delete functionality for ${account.account_name} will be implemented soon!`, 'warning');
// console.log('Delete account:', account)
// }

//=======================================
// 📦 ACCOUNT GROUPS RENDER FUNCTION
const renderAccountGroups = ()=>{
  //LOADING
  // if(isLoading){
  //return <AccountingSkeleton/>;
  //  return (
  //   <div className="accounting-empty">
  //     <div className="accounting-empty__emoji">⏳</div>
  //     <h3 className="accounting-empty__title">Loading Accounts</h3>
  //     <p className="accounting-empty__message">Please wait while we load your accounts...</p>
  //   </div>
  //     )
  // }

//NO ACCOUNTS INFO
  if(Object.keys(groupedAccounts).length===0 && !isLoading){
    return(
      <div className="accounting-empty">
        <div className="accounting-empty__emoji">📁</div>
        <h3 className="accounting-empty__title">No Accounts Found</h3>
        <p className="accounting-empty__message">Get started by creating your first account to manage your finances.</p>
      </div>
    )
  }
//------
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
      {formatAccountTypeName(accountTypeData.name as AccountType)} accounts
      </span>
    </h3>

    <div className="account-group__grid">
    {accounts!.map((account)=>(
      <div className="account-card" key ={account.account_id}>
       <AccountingBox
        title={account.account_name.toUpperCase()}
        amount={account.account_balance}
        currency={account.currency_code}
        account_type={`(${capitalize(account.account_type_name.split('_')[0])})`}

        onMenuClick={(e) => handleMenuClick(account, e)}// 🆕 PASANDO HANDLER
        />
      </div>
      ))}
    </div>
  </div>
    )
   }
  )
 }
//----------------
//SIDE EFFECTS
// ⏰ AUTO-HIDE TOAST AFTER x SECONDS
 useEffect(() => {
  if(toast.visible){
   const timer = setTimeout(()=>{hideToast()}, 2000)
   return () => {
     clearTimeout(timer)
   }
  }
 }, [toast.visible])
 
//=========================
// 🎪 MAIN COMPONENT RENDER 
  return (
   <>
    <section className='accounting__layout'>
    <TopWhiteSpace variant={'dark'} />

    <div className='accounting__container'>
      <Link to={originRoute} className='accounting__header'>
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
      duration={1500}
    />  

 {/* 🆕 ACCOUNT ACTIONS MENU */}
  {
    menuState.isOpen && menuState.account && (
    <AccountActionsMenu
      account={menuState.account}
      isOpen={menuState.isOpen}
      onClose={handleCloseMenu}
      onViewDetails={() => handleViewDetails(menuState.account!)}
      // onEditAccount={() => handleEditAccount(menuState.account!)}
      // onDeleteAccount={handleDeleteAccount}
      previousRoute={previousRoute}
    />
    )
  }  
 </section>
</>
  )
}

export default AccountingDashboard