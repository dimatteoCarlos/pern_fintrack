//frontend/src/edition/components/accountActionMenu/AccountActionsMenu.tsx
//Parent: /frontend/src/pages/accountingDashboard/AccountingDashboard.tsx

import { useRef } from "react";
import { AccountListType } from "../../../types/responseApiTypes.ts";
import { useClickOutside } from "../../hooks/useClickOutside.ts";
import './account-actions-menu-styles.css';

// 🎯 PROPS TYPE FOR DEFINITION
type AccountActionsMenuPropType = {
  onClose:()=>void;
  isOpen:boolean;
  account:AccountListType;
  previousRoute? : string
// ✅funcionts need no params
  onViewDetails: () => void;  
  onEditAccount: () => void;  
  onDeleteAccount: () => void;
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
  onEditAccount,
  onDeleteAccount,
}:AccountActionsMenuPropType
) {
//--------------------------------
//ROUTES FOR MENU ACTIONS
//http://localhost:5173/fintrack/overview/accounts/:accountId
//-------------------------------   
  const menuRef = useRef<HTMLDivElement>(null)

// 🎯 CLOSE MENU WHEN CLICKING OUTSIDE
  useClickOutside(menuRef, onClose)

  if (!isOpen) return null;
//---------
  return (
// {/* 🎯 FIX CONTAINER THAT COVERS ALL THE SCREEN */} 
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
  onClick ={onEditAccount}
  >
  <span className="account-actions-menu__icon">✏️</span>
  
  <span className="account-actions-menu__text">
    Edit Account
  </span>
  </button>   

{/* 🗑️ DELETE ACCOUNT OPTION */}
    <button className="account-actions-menu__option account-actions-menu__options--delete"
    onClick={onDeleteAccount}
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
