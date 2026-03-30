// 📁 frontend/src/auth/components/userProfile/UserProfileMenu.tsx
// 🎯 CONTAINER COMPONENT: User Profile Menu & Form Coordination
// 🔧 Responsibility: Orchestrate avatar, menu, and form interactions
// 🏷️ Pattern: Container Component (Smart Component)

import React, { useEffect, useState, useCallback, useRef } from 'react';

// 🏪 Global State Management
import { useAuthStore } from '../../stores/useAuthStore';

// 📦 Child Components
import UserAvatar from './UserAvatar';
import UpdateProfileContainer from '../updateProfileForm/UpdateProfileContainer';

// 🎨 Component-specific CSS Module
import styles from './styles/userProfileMenu.module.css';
import { CurrencyType } from '../../../fintrack/types/types';
import { DEFAULT_CURRENCY } from '../../../fintrack/helpers/constants';
import ChangePasswordContainer from '../passwordChangeForm/ChangePasswordContainer';

/* 🌟 ===================
🏷️ TYPE DEFINITIONS
====================🌟 */
/**
 * 📝 Available modal states in the hierarchy
 */
type ModalStateType = 'none' | 'menu' | 'userForm' | 'changePasswordForm';

/**
 * 📝 User information derived from store
 */
type UserInfoType = {
  initial: string;
  userName?: string;
  userEmail?: string;
  currency: CurrencyType;
};

/* 🌟 ============================
🎭 MAIN COMPONENT: UserProfileMenu
============================= 🌟 */
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
const UserProfileMenu = () => {
  /* 🌟 ====================
🏪 GLOBAL STATE CONNECTION
==================== 🌟 */
  const userData = useAuthStore((state) => state.userData);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  /* 🌟 ====================
🎯 DOM REF ELEMENTS
==================== 🌟 */
  const menuRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  /* 🌟 ====================
🎮 LOCAL UI STATE MANAGEMENT
==================== 🌟 */
  /**
   * 📊 Current modal state with hierarchy
   * - 'none': Nothing open
   * - 'menu': Profile menu open
   * - 'userForm': Update form open
   * - 'changePasswordForm': Update form open
   */
  const [modalState, setModalState] = useState<ModalStateType>('none');

  /* 🌟 ====================
🎨 COMPUTED USER INFORMATION
==================== 🌟 */
  /**
   * 🎯 Extract and compute user information from store
   */
  const getUserInfo = useCallback((): UserInfoType => {
    if (!userData) {
      return {
        initial: 'U',
        currency: DEFAULT_CURRENCY,
      };
    }

    const userLabel =
      userData.user_firstname || userData.user_lastname || userData.username;

    return {
      initial: userLabel ? userLabel.charAt(0).toUpperCase() : 'U',
      userName: userData.username,
      userEmail: userData.email,
      currency: userData.currency || DEFAULT_CURRENCY,
    };
  }, [userData]);

  const userInfo = getUserInfo();

  /* 🌟 ====================
🎮 EVENT HANDLERS (Business Logic)
==================== 🌟 */
  /**
   * 🖱️ Handle avatar click - opens profile menu
   */
  const handleAvatarClick = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation();
    setModalState('menu');
  }, []);
  //--------
  /**
   * 📝 Open update profile form - closes menu, opens form
   */
  const handleEditProfile = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      setModalState('userForm');

      // console.log('🔄 Edit Profile clicked');
      // console.log('📊 Current modalState:', modalState, e.target, e.currentTarget);
      // console.log('✅ New modalState should be: form');
    },
    [],
  );

  // /**
  // * 🔐 Open change password form
  // */
  const handleChangePassword = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      setModalState('changePasswordForm');
      //console.log('Change password clicked');
    },
    [],
  );

  /**
   * 🚪 Close current modal with hierarchical logic
   */
  const handleCloseCurrentModal = useCallback((): void => {
    // console.log('🚪 Closing current modal');
    setModalState('none');
  }, []);

  /**
   * 🚪 Navigate back in hierarchy (form → menu)
   */
  const handleNavigateBack = useCallback((): void => {
    if (modalState === 'userForm' || modalState === 'changePasswordForm') {
      // console.log('🔙 Navigating back to menu from forms');
      setModalState('menu');
    }
    // else {
    // setModalState('none');
    // }
  }, [modalState]);
  //------------------------------
  /* 🌟 ====================
⚡ SIDE EFFECTS & KEYBOARD
 NAVIGATION
==================== 🌟 */
  // Add useEffect to monitor modalState changes
  useEffect(() => {
    // console.log('🎯 modalState changed to:', modalState);
  }, [modalState]);

  /**
   * ⌨️ GLOBAL LISTENER - Handle ESCAPE KEY with hierarchical logic
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
        case 'userForm':
        case 'changePasswordForm':
          // 🔄 Hierarchical navigation: Form → Menu
          setModalState('menu');
          // console.log('⌨️ Escape: Form → Menu');
          break;

        case 'menu':
          // Close menu completely
          setModalState('none');
          // console.log('⌨️ Escape: Menu → None');
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

  //---------------------------------
  /** 🖱️ GLOBAL LISTENER - Handle CLICK OUTSIDE to close modals **/
  useEffect(() => {
    if (modalState === 'none') return;

    // Close modal on any click (overlay handles propagation)
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;

      //If menu is open and click is outside menu
      const clickedOutsideMenu =
        menuRef.current && !menuRef.current.contains(target);

      if (modalState === 'menu' && clickedOutsideMenu) {
        setModalState('none');
      }

      //If form is open and click is outside form
      if (
        (modalState === 'userForm' || modalState === 'changePasswordForm') &&
        formRef.current &&
        !formRef.current.contains(target)
      ) {
        setModalState('menu');
      }
    };
    //Listeners
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
    // console.log('🔒 Not authenticated, not rendering');
    return null;
  }
  // console.log('🎨 Rendering with modalState:', modalState);

  /* 🌟 ====================
🎨 RENDER - COMPONENT COORDINATION
==================== 🌟 */
  return (
    <>
      {/* 🎯 USER AVATAR (Presentational Component) */}
      <UserAvatar
        initial={userInfo.initial}
        onClickFn={handleAvatarClick}
        isTooltipDisabled={modalState !== 'none'}
        userName={userInfo.userName}
        userEmail={userInfo.userEmail}
        id='user-profile-avatar'
      />

      {/* 📋 PROFILE MENU MODAL */}
      {modalState !== 'none' && (
        <div
          className={`${styles.menuOverlay} ${modalState !== 'menu' ? styles.hidden : ''}`}
          // data-testid="profile-menu-overlay"
        >
          <div
            className={styles.menuContainer}
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={styles.profileMenu}
              role='dialog'
              aria-modal='true'
              aria-labelledby='profile-menu-title'
            >
              {/* 🎯 MENU HEADER */}

              <div className={styles.menuHeader} tabIndex={0}>
                <div className={styles.menuAvatar}>{userInfo.initial}</div>

                <div className={styles.menuUserInfo}>
                  <span id='profile-menu-title' className={styles.menuUserName}>
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
                  aria-label='Close profile menu'
                >
                  ✕
                </button>
              </div>

              <div className={styles.menuDivider} />

              {/* 🎯 MENU ACTIONS */}
              <button
                className={styles.menuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditProfile(e);
                }}
                aria-label='Edit user profile'
              >
                <span className={styles.menuItemIcon}>✏️</span>
                <span className={styles.menuItemText}>Edit Profile</span>
              </button>

              <button
                className={styles.menuItem}
                onClick={handleChangePassword}
                aria-label='Change password'
              >
                <span className={styles.menuItemIcon}>🔐</span>
                <span className={styles.menuItemText}>Change Password</span>
              </button>

              <div className={styles.menuDivider} />

              {/* ℹ️ ADDITIONAL INFORMATION */}
              <div className={styles.menuFooter}>
                <span className={styles.currencyBadge}>
                  Currency: <strong>{userInfo.currency.toLowerCase()}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📝 UPDATE PROFILE FORM MODAL */}
      {modalState === 'userForm' && (
        <div className={styles.modalOverlay} data-testid='update-form-overlay'>
          <div
            className={styles.modalContainer}
            ref={formRef}
            onClick={(e) => e.stopPropagation()}
          >
            <UpdateProfileContainer
              onClose={handleNavigateBack}
              onSuccess={handleCloseCurrentModal}
            />
          </div>
        </div>
      )}

      {/* 📝 CHANGE PASSWORD FORM MODAL */}
      {modalState === 'changePasswordForm' && (
        <div
          className={styles.modalOverlay}
          data-testid='changePassword-form-overlay'
        >
          <div
            className={styles.modalContainer}
            ref={formRef}
            onClick={(e) => e.stopPropagation()}
          >
            <ChangePasswordContainer
              onClose={() => {
                handleNavigateBack();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default UserProfileMenu;
