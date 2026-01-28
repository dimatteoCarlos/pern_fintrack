// 📁 frontend/src/auth/components/userProfile/UserProfileMenu.tsx
// 🎯 CONTAINER COMPONENT: User Profile Menu & Form Coordination
// 🔧 Responsibility: Orchestrate avatar, menu, and form interactions
// 🏷️ Pattern: Container Component (Smart Component)

import React, { useEffect, useState, useCallback } from 'react';

// 🏪 Global State Management
import { useAuthStore } from '../../stores/useAuthStore';

// 📦 Child Components
import UserAvatar from './UserAvatar';
import UpdateProfileContainer from '../updateProfileForm/UpdateProfileContainer';

// 🎨 Component-specific CSS Module
import styles from './userProfileMenu.module.css';
import { CurrencyType } from '../../../types/types';
import { DEFAULT_CURRENCY } from '../../../helpers/constants';

/* 🌟 ===================
🏷️ TYPE DEFINITIONS
====================🌟 */
/**
 * 📝 Available modal states in the hierarchy
 */
type ModalStateType = 'none' | 'menu' | 'form';

/**
 * 📝 User information derived from store
 */
type UserInfoType = {
 initial: string;
 userName?: string;
 userEmail?: string;
 currency: CurrencyType;
}

/* 🌟 ====================
🎭 COMPONENT: UserProfileMenu
==================== 🌟 */

/**
 * 🎯 CONTAINER COMPONENT: User Profile Menu
 * 
 * 📌 ARCHITECTURAL PRINCIPLES:
 * 1. ORCHESTRATION: Coordinates child components
 * 2. BUSINESS LOGIC: Manages state and side effects
 * 3. HIERARCHICAL NAVIGATION: Handles Escape key flow
 * 4. SINGLE RESPONSIBILITY: Only coordination, no presentation
 * 
 * 🏷️ PATTERNS APPLIED:
 * - Container Component Pattern
 * - State Management Pattern
 * - Event Delegation Pattern
 * - Hierarchical Navigation Pattern
 * 
 * @returns The complete user profile interaction system
 */
const UserProfileMenu: React.FC = () => {
  
/* 🌟 ====================
🏪 GLOBAL STATE CONNECTION
==================== 🌟 */
 const userData = useAuthStore((state) => state.userData);
 const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
/* 🌟 ====================
🎮 LOCAL UI STATE MANAGEMENT
==================== 🌟 */
/**
* 📊 Current modal state with hierarchy
* - 'none': Nothing open
* - 'menu': Profile menu open
* - 'form': Update form open
*/
const [modalState, setModalState] = useState<ModalStateType>('none');

/* 🌟 ====================
🎨 COMPUTED USER INFORMATION
==================== 🌟 */
/**
* 🎯 Extract and compute user information from store
*/
const getUserInfoType = useCallback((): UserInfoType => {
 if (!userData) {
 return {
  initial: 'U',
  currency: 'usd'
 };
 }
  
const userLabel = userData.user_firstname || 
 userData.user_lastname || 
 userData.username;
  
return {
 initial: userLabel ? userLabel.charAt(0).toUpperCase() : 'U',
 userName: userData.username,
 userEmail: userData.email,
 currency: userData.currency || DEFAULT_CURRENCY
};
}, [userData]);

const userInfo = getUserInfoType();
  
/* 🌟 ====================
🎮 EVENT HANDLERS (Business Logic)
==================== 🌟 */
/**
* 🖱️ Handle avatar click - opens profile menu
*/
const handleAvatarClick = useCallback((): void => {
 setModalState('menu');
}, []);
  
/**
* 📝 Open update profile form - closes menu, opens form
*/
const handleEditProfile = useCallback((): void => {
 setModalState('form');
}, []);
  
/**
* 🔐 Open change password form (future implementation)
*/
const handleChangePassword = useCallback((): void => {
 console.log('Change password clicked - to be implemented');
 setModalState('none');
}, []);
  
/**
* 🚪 Close current modal with hierarchical logic
*/
const handleCloseCurrentModal = useCallback((): void => {
 setModalState('none');
}, []);
  
/**
* 🚪 Navigate back in hierarchy (form → menu)
*/
const handleNavigateBack = useCallback((): void => {
 if (modalState === 'form') {
  setModalState('menu');
 } else {
 setModalState('none');
 }
}, [modalState]);
  
/* 🌟 ====================
⚡ SIDE EFFECTS & KEYBOARD
 NAVIGATION
==================== 🌟 */
/**
* ⌨️ Handle Escape key with hierarchical logic
* - Form open → Close form, show menu
* - Menu open → Close menu
* - Nothing open → No action
*/
useEffect(() => {
if (modalState === 'none') return;
 
const handleEscapeKey = (event: KeyboardEvent): void => {
if (event.key !== 'Escape') return;
event.preventDefault();
  
switch (modalState) {
 case 'form':
// 🔄 Hierarchical navigation: Form → Menu
 setModalState('menu');
 break;
   
case 'menu':
// Close menu completely
 setModalState('none');
 break;
   
default:
// No action for other states
 break;
 }
};

document.addEventListener('keydown', handleEscapeKey);

return () => {
 document.removeEventListener('keydown', handleEscapeKey);
 };
}, [modalState]);

/**
 * 🖱️ Handle click outside to close modals
 */
useEffect(() => {
 if (modalState === 'none') return;
  
 const handleClickOutside = (event: MouseEvent): void => {
  event.preventDefault();
// Close modal on any click (overlay handles propagation)
  setModalState('none');
  };
  
 document.addEventListener('mousedown', handleClickOutside);
  
 return () => {
  document.removeEventListener('mousedown', handleClickOutside);
 };
}, [modalState]);

/* 🌟 ====================
🛡️ GUARD CLAUSES
==================== 🌟 */
// Don't render if user is not authenticated
if (!isAuthenticated || !userData) {
 return null;
}

/* 🌟 ====================
🎨 RENDER - COMPONENT COORDINATION
==================== 🌟 */
return (
 <>
{/* 🎯 USER AVATAR (Presentational Component) */}
 <UserAvatar
 initial={userInfo.initial}
 onClick={handleAvatarClick}
 isTooltipDisabled={modalState !== 'none'}
 userName={userInfo.userName}
 userEmail={userInfo.userEmail}
 id="user-profile-avatar"
 />

 {/* 📋 PROFILE MENU MODAL */}
 {modalState === 'menu' && (
 <div 
  className={styles.menuOverlay}
  data-testid="profile-menu-overlay"
 >
 <div 
  className={styles.menuContainer}
  onClick={(e) => e.stopPropagation()}
 >
 <div 
  className={styles.profileMenu}
  role="dialog"
  aria-modal="true"
  aria-labelledby="profile-menu-title"
 >
       
{/* 🎯 MENU HEADER */}
<div className={styles.menuHeader}
 tabIndex={0} 
>
 <div className={styles.menuAvatar}>
 {userInfo.initial}
</div>
  
 <div className={styles.menuUserInfo}>
  <span 
   id="profile-menu-title"
   className={styles.menuUserName}
 >
   {userInfo.userName}
  </span>
  <span className={styles.menuUserEmail}>
    {userInfo.userEmail}
  </span>
</div>
  
  {/* 🚪 CLOSE BUTTON */}
<button
 className={styles.closeButton}
 onClick={handleCloseCurrentModal}
 aria-label="Close profile menu"
 >
 ✕
</button>
</div>

<div className={styles.menuDivider} />

{/* 🎯 MENU ACTIONS */}
<button
  className={styles.menuItem}
  onClick={handleEditProfile}
  aria-label="Edit user profile"
>
  <span className={styles.menuItemIcon}>✏️</span>
  <span className={styles.menuItemText}>Edit Profile</span>
</button>

<button
 className={styles.menuItem}
 onClick={handleChangePassword}
 aria-label="Change password"
>
 <span className={styles.menuItemIcon}>🔐</span>
 <span className={styles.menuItemText}>Change Password</span>
</button>

<div className={styles.menuDivider} />

{/* ℹ️ ADDITIONAL INFORMATION */}
 <div className={styles.menuFooter}>
   <span className={styles.currencyBadge}>
 Currency:{' '}
    <strong>{userInfo.currency.toLowerCase()}</strong>
    </span>
   </div>
  </div>
 </div>
</div>
  )}
   
{/* 📝 UPDATE PROFILE FORM MODAL */}
{modalState === 'form' && (
 <div 
  className={styles.modalOverlay}
  data-testid="update-form-overlay"
 >
  <div 
   className={styles.modalContainer}
   onClick={(e) => e.stopPropagation()}
   >
   <UpdateProfileContainer 
   onClose={handleNavigateBack}
   onSuccess={handleCloseCurrentModal}
     />
   </div>
 </div>
 )}
 </>
 );
};

export default UserProfileMenu;