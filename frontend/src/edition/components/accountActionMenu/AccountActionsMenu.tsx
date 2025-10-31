//frontend/src/edition/components/accountActionMenu/AccountActionsMenu.tsx
//Parent: /frontend\src\pages\accountingDashboard\AccountingDashboard.tsx

import { useRef } from "react";
import { AccountListType } from "../../../types/responseApiTypes.ts";
import { useClickOutside } from "../../hooks/useClickOutside.ts";
// import { useLocation, useNavigate } from "react-router-dom";
import './account-actions-menu-styles.css';

// 🎯 PROPS TYPE FOR DEFINITION
type AccountActionsMenuPropType = {
  onClose:()=>void;
  isOpen:boolean;
  account:AccountListType;
  onViewDetails: () => void;  // ✅ Ya no necesita parámetros
  // onEditAccount: () => void;  
  // onDeleteAccount: () => void;
  previousRoute? : string
}

//account type detail page

//=================================
// 🏦 ACCOUNT ACTIONS MENU COMPONENT
export function AccountActionsMenu (
  {
  account,
  isOpen,
  onClose,
  onViewDetails,
  // onEditAccount,
  // onDeleteAccount,
}:AccountActionsMenuPropType
) {
//--------------------------------
 //ROUTES FOR MENU ACTIONS
 //http://localhost:5173/fintrack/overview/accounts/2
 
//-------------------------------   
  // const navigateTo = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

// 🎯 CLOSE MENU WHEN CLICKING OUTSIDE
  useClickOutside(menuRef, onClose)
//---------
// // 🚨 HANDLE VIEW DETAILS CLICK
// const handleViewDetails=()=>{
//   navigateTo(accountViewDetailRoute,{
//     state:{
//       accountData:account,
//       previousRoute:previousRouteFromProp
//     }
//   })
//   onClose()
// }
// //---------
// // ✏️ HANDLE EDIT ACCOUNT CLICK
//   const handleEditAccount = ()=>{
//     navigateTo(accountEditRoute,{
//       state:{
//         accountData:account,
//         originRoute
//       }
//     })
//     onClose()
//   }
// //---------
// // 🗑️ HANDLE DELETE ACCOUNT CLICK
//   const handleDeleteAccount = ()=>{
//     onDeleteClick(account)
//     onClose()
//   };
//--------- 
  if (!isOpen) return null;
//---------
  return (
// {/* 🎯 FIXED CONTAINER THAT COVERS ALL THE SCREEN */} 
    <div className="account-actions-menu__overlay">
      {/* 🎯 CENTERED MODAL */}
    <div ref ={menuRef} className="account-actions-menu">

  {/* 🎯 MENU HEADER WITH ACCOUNT NAME */}
    <div className="account-actions-menu__header">
      <span className="account-actions-menu__account-name">
          {account.account_name}
      </span>
    </div>

  {/* 📋 MENU OPTIONS */}
   <div className="account-actions-menu__options">
    {/* 👁️ VIEW DETAILS OPTION */}
    <button className="account-actions-menu__option"
      onClick={onViewDetails}
      >
      <span className="account-actions-menu__icon">👁️</span>

      <span className="account-actions-menu__text">View Details
      </span>
    </button>

  {/* ✏️ EDIT ACCOUNT OPTION */}
    <button className="account-actions-menu__option"
    // onClick ={onEditAccount}
    >
      <span className="account-actions-menu__icon">✏️</span>
      <span className="account-actions-menu__text">Edit Account</span>
    </button>   

  {/* 🗑️ DELETE ACCOUNT OPTION */}
    <button className="account-actions-menu__option account-actions-menu__options--delete"
    // onClick={onDeleteAccount}
    >
     <span className="account-actions-menu__icon">🗑️</span>

     <span className="account-actions-menu__text">Delete Account</span>
    </button>  
   </div>
  </div>
  </div>
  )
}

export default AccountActionsMenu
