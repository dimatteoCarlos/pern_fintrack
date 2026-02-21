//src/pages/auth/AuthPage.tsx
import styles from './styles/authPage.module.css';
import { useEffect, useState } from 'react';
import AuthUI from './AuthUI';
import useAuth from '../../hooks/useAuth';
import Logo from '../../../assets/logo.svg';

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthUIStore } from '../../stores/useAuthUIStore';
import { AUTH_UI_STATES } from '../../auth_constants/constants';

//--MAIN COMPONENT AUTHENTICACION ACCESS PAGE
export default function AuthPage() {
 const location = useLocation();
 const navigateTo = useNavigate();

 const { uiState, message, prefilledEmail, prefilledUsername, resetUI } = useAuthUIStore();



 //--MODAL STATES
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // 🎯 Modal abierto si no es IDLE
  const showModal = uiState !== AUTH_UI_STATES.IDLE;

  // 🎯 Modo inicial según el estado (por ahora siempre signin, se puede extender)
  const initialAuthMode = 'signin';

  // const [showAuthModal, setShowAuthModal] = useState(false);
  // const [initialAuthMode, setInitialAuthMode] = useState<'signin' | 'signup'>(
  //   'signin'
  // );

// 🧹 Reset UI state when modal closes
const handleCloseModal = () => {
  resetUI();
};
 
//CUSTOM HOOKS FOR SIGNIN AND SIGNUP
// Execute the useAuth hook to get authentication state and actions
  const {
    isLoading,
    error,
    successMessage,
    handleSignIn,
    handleSignUp,
    clearError,
    clearSuccessMessage,

  } = useAuth();

//------------------------------------
// ✅ HANDLE DIFFERENT NAVIGATION STATES
//------------------------------------
// 🧹 Clear navigation state on mount
  useEffect(() => {
    if (location.state) {
      navigateTo(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigateTo]);

useEffect(() => {
  const navigationState = location.state;
 // ✅ Only when state exists
  if (navigationState && (navigationState.expired || navigationState.showModal)) {
   
   // if (navigationState.expired) {
   //  setInitialAuthMode('signin');
   //  setShowAuthModal(true);
   // } else if (navigationState.showModal) {
   //  setInitialAuthMode(navigationState.initialMode || 'signin');
   //  setShowAuthModal(true);
   // }

// 🛑 Clean just once. By passing 'state:{}', the following render does not enter into this if
// Al pasar 'state: {}', el siguiente render ya no entrará en este 'if'.

   navigateTo(location.pathname, { replace: true, state: {} });
   
//clean the sotre
   clearError();
   clearSuccessMessage();
  }
 }, [location.state, navigateTo, clearError,clearSuccessMessage,location.pathname]); // 👈 Use location.pathname No complete location 

//------------------------------
//FUNCTIONS EVENT HANDLERS
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const openSigninModalHandler = () => {
    setIsMenuOpen(false); //
    clearError();
    clearSuccessMessage();
    // setShowSignInModalOnLoad(false);
    //-----------------------
    // setShowAuthModal(true);
    // setInitialAuthMode('signin');
  };

  const openSignupModalHandler = () => {
    setIsMenuOpen(false);
    clearError();
    clearSuccessMessage();
    //-----------------------
    // setShowAuthModal(true);
    // setInitialAuthMode('signup');
  };

  const closeAuthModal = () => {
    clearError;
    // setShowAuthModal(false);
  };
  
 //---------------------------------
  return (
    <div className={styles.authPageContainer}>
      {/* {navbar} */}
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
          <div className={styles.modalOverlay} onClick={handleCloseModal || closeAuthModal}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <AuthUI
               initialCredentials={{ email: prefilledEmail || '', username: prefilledUsername || '' }}
               globalMessage={message}
               onClose={handleCloseModal}

                onSignIn={handleSignIn}
                onSignUp={handleSignUp}
                isLoading={isLoading}
                error={error}
                clearError={clearError}
                isSignInInitial={initialAuthMode === 'signin'}
                messageToUser={successMessage}
              />
              <button className={styles.closeButton} onClick={closeAuthModal}>
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
