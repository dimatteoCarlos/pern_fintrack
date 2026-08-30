//frontend/src/fintrack/editionAndDeletion/components/accountActionMenu/AccountActionsMenu.tsx
//Parent: /frontend/src/fintrack/pages/accountingDashboard/AccountingDashboard.tsx

import { useEffect, useRef } from 'react';
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
  // functions need no params
  //
  // Optional, and omitting it is what removes the option. Opened from a detail
  // screen, 'View Details' is a door to the room the reader is standing in.
  onViewDetails?: () => void;
  onEditAccount: () => void;
  onDeleteAccount: () => void;
  // What the two rows are called. Optional and defaulted to what every current
  // caller already renders, so adding them changes no existing screen.
  //
  // They exist because this menu now opens over a pocket as well, and a pocket
  // is not an account: "Delete Account" on a pocket's card names the wrong
  // object, and on this one the wrong object is a real bank account.
  editLabel?: string;
  deleteLabel?: string;
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
  editLabel = 'Edit Account',
  deleteLabel = 'Delete Account',
}: AccountActionsMenuPropType) {
  //--------------------------------
  //ROUTES FOR MENU ACTIONS
  //http://localhost:5173/fintrack/overview/accounts/:accountId
  //-------------------------------
  const menuRef = useRef<HTMLDivElement>(null);
  // The control that opened the menu, so closing can hand the keyboard back to
  // where it came from instead of dropping it on <body>.
  const triggerRef = useRef<HTMLElement | null>(null);

  // 🎯 CLOSE MENU WHEN CLICKING OUTSIDE
  useClickOutside(menuRef, onClose);

  // ⎋ CLOSE ON ESCAPE
  // On the document and not on the panel: the key has to work from the moment
  // the menu paints, before focus has finished moving into it.
  useEffect(() => {
   if (!isOpen) {
    return;
   }

   const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
     onClose();
    }
   };

   document.addEventListener('keydown', handleKeyDown);

   return () => {
    document.removeEventListener('keydown', handleKeyDown);
   };
  }, [isOpen, onClose]);

  // 🎯 FOCUS IN ON OPEN, BACK TO THE TRIGGER ON CLOSE
  // onClose is deliberately not a dependency: it is a fresh closure on every
  // parent render, and the cleanup would then pull focus back mid-session.
  useEffect(() => {
   if (!isOpen) {
    return;
   }

   triggerRef.current = document.activeElement as HTMLElement | null;
   menuRef.current?.querySelector('button')?.focus();

   return () => {
    // isConnected: an option that navigates away takes the trigger out of the
    // document with it, and focusing a detached node does nothing useful.
    if (triggerRef.current?.isConnected) {
     triggerRef.current.focus();
    }
   };
  }, [isOpen]);

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

            <span className='account-actions-menu__text'>{editLabel}</span>
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

            <span className='account-actions-menu__text'>{deleteLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountActionsMenu;
