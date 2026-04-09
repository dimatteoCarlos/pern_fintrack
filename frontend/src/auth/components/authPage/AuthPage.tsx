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

import { useCallback, useEffect, useState , useRef} from 'react';
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

import { authEventRegistry } from '../../authEvent/config/authEventRegistry';

//--MAIN COMPONENT AUTHENTICACION ACCESS PAGE - AuthPage.tsx
export default function AuthPage() {
  const location = useLocation();
  const navigateTo = useNavigate();

  const { uiState, message, setUIState,setMessage,  setPrefilledData, resetUI } = useAuthUIStore();

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

// ref for storing return path (session_expired)
   const returnToRef = useRef<string | null>(null)

// ===============================
// 🎯 PRESENTATION LAYER WRAPPERS
// =============================== 
//Sign in wrapper – decides navigation after successful login.

 const handleSignInWithNavigation = async (
    credentials: SignInCredentialsType,
    rememberMe: boolean,
  ) => {
  // console.log(🔐 Sign in wrapper called);
  const result =  await handleSignInDomain(credentials, rememberMe);

 // console.log(Sign in result:, result);

  if(result.success){
  // ✅ Use returnToRef if exists for session_expired
  const redirectPath = returnToRef.current ?? INITIAL_PAGE_ADDRESS;

  navigateTo(redirectPath);
  // ✅ clean after navigation
   returnToRef.current = null;
   }
  }

//Sign up wrapper – decides navigation after successful registration.
 const handleSignUpWithNavigation = async(credentials:SignUpCredentialsType)=>{
   const result = await handleSignUpDomain(credentials);

   if(result.success){
    navigateTo(INITIAL_PAGE_ADDRESS ??' /fintrack');
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
//✅ INTENT NAVIGATION HANDLER BASED ON authEvent (MAIN EFFECT)
//------------------------------
 const navigationState = location.state as
  | {
     authEvent?: string;
     from?: string;
    }
  | undefined;
  
  const authEvent = navigationState?.authEvent;

// Debugging log
// console.log({authEvent},'data event:', navigationState?.from)
// console.log(🔍 AuthPage debug:, { authEvent, uiState });
  
//✅ Main effect – only processes intents, does NOT force IDLE when no authEvent  
useEffect(() => {
 if (!authEvent) return;
 
// ================================
// 🔥 Force clean state ONLY when an authEvent is present
// if (authEvent) {
//0️⃣ Start from a clean baseline before processing the authEvent
 if (uiState !== AUTH_UI_STATES.IDLE) {
   setUIState(AUTH_UI_STATES.IDLE);
 }

//1️⃣ Get handler from registry
 const authEventHandler = authEventRegistry[authEvent as keyof typeof authEventRegistry];

 if (!authEventHandler) {
  console.warn(`Unknown authEvent: ${authEvent}`);
  return;
  }

//2️⃣ Execute handler and get result
// session_expired needs the 'from' data; others don't
  let result;
  if (authEvent === 'session_expired') {
// session_expired needs the 'from' data
  result = authEventRegistry.session_expired({ from: navigationState?.from }, { getIdentity });
  } else {
// password_changed and user_logged_out don't need data
// const authEventHandler = authEventRegistry[authEvent as 'password_changed' | 'user_logged_out'];

  result = authEventHandler(undefined, { getIdentity });

  //alternative
  // result = authEventRegistry[authEvent as 'password_changed' | 'user_logged_out'](undefined, { getIdentity });
  }


//3️⃣ Apply result (UI + navigation)
 if(result.uiState){
  setUIState(result.uiState);
 }

 if (result.message) {
  setMessage(result.message);
  }
   
 if (result.prefill) {
  setPrefilledData(result.prefill.email ?? null, result.prefill.username ?? null);
  }

// 4️⃣ Handle returnTo (for session_expired)
if(result.returnTo !== undefined){
 returnToRef.current = result.returnTo;
}

//5️⃣ Handle navigation (if required)
if(result.navigation){
 navigateTo(result.navigation.to,{
  replace:result.navigation.replace ?? false,
  state:result.navigation.state,
 });
 }
}, [authEvent,  navigateTo,navigationState?.from, setMessage, setPrefilledData, setUIState,uiState]);
//===================================
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
    returnToRef.current = null;//✅ clean before manual open
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
   returnToRef.current = null; //clean to avoid ghost redirection
  };

// Determine if modal should be open
  const showModal = uiState !== AUTH_UI_STATES.IDLE;

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
            isMenuOpen ? styles.navMenuActive :''
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
