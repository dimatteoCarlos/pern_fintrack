//frontend/src/fintrack/editionAndDeletion/components/accountActionMenu/AccountActionsMenu.tsx
//Parent: /frontend/src/fintrack/pages/accountingDashboard/AccountingDashboard.tsx

import { useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside.ts';
// '?react' and not a bare import: a bare .svg is typed `string` and cannot take
// a className, so only that form carries a React component type.
import DeleteAccountSvg from '../../../../assets/accountActionsMenuSvg/deleteAccountSvg.svg?react';
import EditAccountSvg from '../../../../assets/accountActionsMenuSvg/editAccountSvg.svg?react';
import ViewAccountSvg from '../../../../assets/accountActionsMenuSvg/viewAccountSvg.svg?react';
import './account-actions-menu-styles.css';

// 🎯 PROPS TYPE FOR DEFINITION
type AccountActionsMenuPropType = {
  onClose: () => void;
  isOpen: boolean;
  // The name alone, not the whole account. This menu renders one string from
  // that object and nothing else, and the detail screens that now open it hold
  // their own types — PocketDetail and DebtorDetail would have had to assemble
  // an AccountListType they never received, only to have it read once.
  accountName: string;
  previousRoute?: string;
  // functions need no params
  //
  // Optional, and omitting it is what removes the option. Opened from a detail
  // screen, 'View Details' is a door to the room the reader is standing in.
  onViewDetails?: () => void;
  onEditAccount: () => void;
  onDeleteAccount: () => void;
};
//account type detail page
// 🏦 ACCOUNT ACTIONS MENU COMPONENT
export function AccountActionsMenu({
  accountName,
  isOpen,
  onClose,
  onViewDetails,
  onEditAccount,
  onDeleteAccount,
}: AccountActionsMenuPropType) {
  //--------------------------------
  //ROUTES FOR MENU ACTIONS
  //http://localhost:5173/fintrack/overview/accounts/:accountId
  //-------------------------------
  const menuRef = useRef<HTMLDivElement>(null);

  // 🎯 CLOSE MENU WHEN CLICKING OUTSIDE
  useClickOutside(menuRef, onClose);

  if (!isOpen) return null;
  //---------
  return (
    // {/* 🎯 FIX CONTAINER THAT COVERS ALL THE SCREEN */}
    <div className='account-actions-menu__overlay'>
      {/* 🎯 CENTERED MODAL */}
      <div ref={menuRef} className='account-actions-menu'>
        {/* 🎯 MENU HEADER WITH ACCOUNT NAME */}
        <div className='account-actions-menu__header'>
          <span className='account-actions-menu__account-name'>
            {accountName}
          </span>
        </div>

        {/* 📋 MENU OPTIONS */}
        <div className='account-actions-menu__options'>
          {/* Rendered only where it leads somewhere else. The dashboard passes
              it; a detail screen does not.

              The icons are aria-hidden in the asset: each row already carries
              its own text label, so announcing the glyph would read the action
              out twice. */}
          {onViewDetails && (
            <button
              type='button'
              className='account-actions-menu__option'
              onClick={onViewDetails}
            >
              <ViewAccountSvg className='account-actions-menu__icon' />

              <span className='account-actions-menu__text'>View Details</span>
            </button>
          )}

          <button
            type='button'
            className='account-actions-menu__option'
            onClick={onEditAccount}
          >
            <EditAccountSvg className='account-actions-menu__icon' />

            <span className='account-actions-menu__text'>Edit Account</span>
          </button>

          {/* Singular '--delete'. The class was written plural here and
              singular in the stylesheet, so the destructive row has never once
              turned red under the cursor. */}
          <button
            type='button'
            className='account-actions-menu__option account-actions-menu__option--delete'
            onClick={onDeleteAccount}
          >
            <DeleteAccountSvg className='account-actions-menu__icon' />

            <span className='account-actions-menu__text'>Delete Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountActionsMenu;
