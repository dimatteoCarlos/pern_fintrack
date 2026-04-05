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
 -  React to navigation intents (password_changed, session_expired)
 
 ❌ Never:
 - Handle authentication logic (useAuth does that)
 - Persist data (authStorage does that)
 - Decide routes (ProtectedRoute does that)
*/

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AuthUI from './AuthUI';
import { AUTH_UI_STATES } from '../../auth_constants/constants';
import Logo from '../../../assets/logo.svg';

import styles from './styles/authPage.module.css';

import { useAuthUIStore } from '../../stores/useAuthUIStore';
import useAuth from '../../hooks/useAuth';

import { SignInCredentialsType, SignUpCredentialsType } from '../../types/authTypes';

import { INITIAL_PAGE_ADDRESS } from '../../../fintrack/helpers/constants';

import { getIdentity } from '../../auth_utils/localStorageHandle/authStorage';

//--MAIN COMPONENT AUTHENTICACION ACCESS PAGE - AuthPage.tsx
export default function AuthPage() {
  const location = useLocation();
  const navigateTo = useNavigate();

  const { uiState, message, setUIState, setPrefilledData, resetUI } = useAuthUIStore();

//--LOCAL UI STATES not related to auth UX
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isSignInMode, setIsSignInMode] = useState(true); // true = signin, false = signup

//CUSTOM HOOKS FOR SIGNIN AND SIGNUP
// Auth operations (passed to AuthUI)
  const {
    isLoading,
    error,
    handleSignIn:handleSignInDomain,
    handleSignUp:handleSignUpDomain,
    clearError,
  } = useAuth();

// ===============================
// 🎯 PRESENTATION LAYER WRAPPERS
// =============================== 
//Sign in wrapper – decides navigation after successful login.

 const handleSignInWithNavigation = async (
    credentials: SignInCredentialsType,
    rememberMe: boolean,
  ) => {
  console.log('🔐 Sign in wrapper called');
  const result =  await handleSignInDomain(credentials, rememberMe);

 console.log('Sign in result:', result);

   if(result.success){
    navigateTo(INITIAL_PAGE_ADDRESS ?? '/fintrack');
   }
  }

//Sign up wrapper – decides navigation after successful registration.
 const handleSignUpWithNavigation = async(credentials:SignUpCredentialsType)=>{
   const result = await handleSignUpDomain(credentials);

   if(result.success){
    navigateTo(INITIAL_PAGE_ADDRESS ?? '/fintrack');
   }
// Errors are already stored in useAuthStore and displayed by AuthUI
  }

// ===============================
// ✅ CENTRALIZED LOGIN MODAL OPENER WITH PREFILL LOGIC
// ===============================
const openLoginModalWithPrefill = useCallback(()=>{
 const identity = getIdentity();
 if(identity?.email && identity?.username){
  setPrefilledData(identity.email, identity.username)
 }else {setPrefilledData(null, null)}

 setUIState(AUTH_UI_STATES.SIGN_IN); // always SIGN_IN, prefill handled separately
}, [setPrefilledData, setUIState]);

//------------------------------
//✅ INTENT-BASED NAVIGATION HANDLER (MAIN EFFECT)
//------------------------------
 const navigationState = location.state as
  | {
     intent?: string;
     from?: string;
    }
  | undefined;
  
  const intent = navigationState?.intent;

// Debugging log
 console.log('🔍 AuthPage debug:', { intent, uiState });
  
//✅ Main effect – only processes intents, does NOT force IDLE when no intent  
useEffect(() => {
// 🔥 Force clean state ONLY when an intent is present
if (intent) {
// Ensure we start from a clean baseline before processing the intent
 if (uiState !== AUTH_UI_STATES.IDLE) {
   setUIState(AUTH_UI_STATES.IDLE);
 }

// ================================
// 1️⃣ COMMON STEP: Open login modal for intents that require it
// ================================
  const intentsThatRequireLogin = ['password_changed', 'session_expired'];

  if (intentsThatRequireLogin.includes(intent)) {
    openLoginModalWithPrefill();
  }

// ===================================
// 2️⃣ INTENT-SPECIFIC ADJUSTMENTS
// ===================================
 if (intent === 'session_expired') {
//ensure it's SIGN_IN (override if needed)
 setUIState(AUTH_UI_STATES.SIGN_IN);

 useAuthUIStore.getState().setMessage(
  'Your session has expired. Please sign in again.');
  }

 if (intent === 'password_changed') {
 // optional success message (commented by default)
 // useAuthUIStore.getState().setMessage('Password changed. Please sign in.');
    }
 }
// No intent → do NOT change uiState (modal stays as user left it)
 }, [intent, openLoginModalWithPrefill, setUIState, uiState]);

// ✅ Separate effect for cleaning location.state (prevents loop)
useEffect(() => {
  if (location.state && Object.keys(location.state).length > 0) {
 // Only clean if there is actually state to clean
   navigateTo(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigateTo]);

// ======================
// 🎯 EVENT HANDLERS
// ======================
// 🧹 Reset UI state when modal closes
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const openSigninModalHandler = () => {
    setIsMenuOpen(false);
    clearError();
    setIsSignInMode(true);
    openLoginModalWithPrefill();
  };

  const openSignupModalHandler = () => {
    setIsMenuOpen(false);
    clearError();
    setIsSignInMode(false);
    setUIState(AUTH_UI_STATES.SIGN_UP);
  };

  const handleCloseModal = () => {
   resetUI(); //user‑initiated close, keep it
   };

// Determine if modal should be open
  const showModal = uiState !== AUTH_UI_STATES.IDLE;

// ✅ Handle password_changed intent (legacy - will be updated in Commit 6)
//     if (navigationState?.hasIdentity) {
//      if (navigationState.prefilledEmail && navigationState.prefilledUsername) {
//       setUIState(AUTH_UI_STATES.REMEMBERED_VISITOR);
//        setPrefilledData(
//          navigationState.prefilledEmail,
//          navigationState.prefilledUsername,
//         );
//       }
//     }

// // Always clean up navigation state after processing
//   if (location.state && Object.keys(location.state).length > 0) {
//    navigateTo(location.pathname, { replace: true, state: {} });
//     }
//   }, [
//     location.state,
//     location.pathname,
//     navigateTo,
//     setUIState,
//     setPrefilledData,
//     resetUI,
//     navigationState?.hasIdentity,
//     navigationState?.prefilledEmail,
//     navigationState?.prefilledUsername,
//   ]);

// =============
// 🎨 RENDER
// =============
  return (
    <div className={styles.authPageContainer}>
      {/* {Navbar} */}
      <nav className={styles.navbar}>
       <div className={styles.logoContainer} onClick={openSigninModalHandler}>
        <span><Logo /></span>
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
            isMenuOpen ? styles.navMenuActive : ''
          }
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

      {/* Auth Modal */}
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
                onSignIn={handleSignInWithNavigation}
                onSignUp={handleSignUpWithNavigation}
                isLoading={isLoading}
                error={error}
                messageToUser={message} //from UI store
               //current mode
                isSignInInitial={isSignInMode}
                clearError={clearError}
                // onClose is used by AuthUI to close modal (e.g., from its own close button)
                onClose={handleCloseModal}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
