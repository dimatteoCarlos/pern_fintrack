// 📁 frontend/src/pages/auth/AuthPage.tsx

/* ===============================
   🔐 AUTH PAGE - PRESENTATION ORCHESTRATOR
   ===============================
 🔍 LAYER IDENTIFICATION:
 - Layer: Presentation (UI Orchestration)
 - Purpose: Coordinate authentication UI, modal, and navigation
 
 ✅ Responsibilities:
 - Render navbar and modal container
 - Observe UI store for modal visibility and messages
 - Provide handlers to open modal (signin/signup)
 - Reset UI store when modal closes
 
 ❌ Never:
 - Handle authentication logic (useAuth does that)
 - Persist data (authStorage does that)
 - Decide routes (ProtectedRoute does that)
*/
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthUI from './AuthUI';
import { useAuthUIStore } from '../../stores/useAuthUIStore';
import { AUTH_UI_STATES } from '../../auth_constants/constants';
import useAuth from '../../hooks/useAuth';
import Logo from '../../../assets/logo.svg';

import styles from './styles/authPage.module.css';

//--MAIN COMPONENT AUTHENTICACION ACCESS PAGE - AuthPage.tsx
export default function AuthPage() {
 const location = useLocation();
 const navigateTo = useNavigate();

const { uiState, message, setUIState, setPrefilledData, resetUI } = useAuthUIStore();
 
 //--LOCAL UI STATES not related to auth UX
 const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
 
 const [initialAuthMode, setInitialAuthMode] = useState<'signin' | 'signup'>('signin');
 
 // 🎯 Modal abierto si no es IDLE
  // const showModal = uiState !== AUTH_UI_STATES.IDLE;

//CUSTOM HOOKS FOR SIGNIN AND SIGNUP
// Auth operations (passed to AuthUI)
  const {
    isLoading,
    error,
    // successMessage,
    handleSignIn,
    handleSignUp,
    clearError,
  } = useAuth();

//------------------------------------
// ✅ HANDLE DIFFERENT NAVIGATION STATES
//------------------------------------
// 🧹 Clear navigation state on mount
 useEffect(() => {
  if (location.state && Object.keys(location.state).length > 0) {
    navigateTo(location.pathname, { replace: true, state: {} });
  }
  }, [location.state, location.pathname, location.key, navigateTo]);

 useEffect(() => {
  const navigationState = location.state as {
    hasIdentity?: boolean;
    prefilledEmail?: string;
    prefilledUsername?: string;
    from?: string;
  } | undefined;

 if (navigationState?.hasIdentity) {
   if (navigationState.prefilledEmail && navigationState.prefilledUsername) {
     setUIState(AUTH_UI_STATES.REMEMBERED_VISITOR);
     setPrefilledData(
       navigationState.prefilledEmail,
       navigationState.prefilledUsername
     );
   }
 }

  // Clean up navigation state
  if (location.state && Object.keys(location.state).length > 0) {
    navigateTo(location.pathname, { replace: true, state: {} });
  }
}, [location.state, location.pathname, navigateTo, setUIState, setPrefilledData]);

//------------------------------
//FUNCTIONS EVENT HANDLERS
// 🧹 Reset UI state when modal closes
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const openSigninModalHandler = () => {
    setIsMenuOpen(false);
    clearError();
    setInitialAuthMode('signin');
   // Open modal by setting UI state
    useAuthUIStore.getState().setUIState(AUTH_UI_STATES.REMEMBERED_VISITOR);
  };

  const openSignupModalHandler = () => {
    setIsMenuOpen(false);
    clearError();  // ✅ Clean previous errors
    setInitialAuthMode('signup');  // ✅ Establecer modo
    useAuthUIStore.getState().setUIState(AUTH_UI_STATES.REMEMBERED_VISITOR);
 };
  
  const handleCloseModal = () => {
    resetUI();
   };

  // Determine if modal should be open
  const showModal = uiState !== AUTH_UI_STATES.IDLE; 

 //---------------------------------
  return (
    <div className={styles.authPageContainer}>
      {/* {Navbar} */}
      <nav className={styles.navbar}>
        <div className={styles.logoContainer} onClick={openSigninModalHandler}>
          <span>
            <Logo />
          </span>
        </div>

        <button
          className={styles.menuToggleButton}
          aria-label='Navigation Menu'
          aria-expanded={isMenuOpen}
          onClick={toggleMenu}
        >
          ☰
        </button>

        <ul
          className={`${styles.navList} ${
            isMenuOpen ? styles.navMenuActive : ''}
            `}
        >
          <li className={styles.navItem} onClick={openSigninModalHandler}>
            Sign in
          </li>

          <li className={styles.navItem} onClick={openSignupModalHandler}>
            Sign up
          </li>
        </ul>
      </nav>

      {/* {auth section} */}
      <main className={styles.mainContent}>
        {/* unique modal */}
        {showModal && (
          <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <AuthUI
               // Auth operations  
                onSignIn={handleSignIn}
                onSignUp={handleSignUp}
                isLoading={isLoading}
                error={error}
                messageToUser={message}//from UI store
                // messageToUser={successMessage}
                // isSignInInitial={initialAuthMode === 'signin'}
                clearError={clearError}
              
              // onClose is used by AuthUI to close modal (e.g., from its own close button)
              onClose={handleCloseModal}
              />
              <button className={styles.closeButton} onClick={handleCloseModal}>
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
