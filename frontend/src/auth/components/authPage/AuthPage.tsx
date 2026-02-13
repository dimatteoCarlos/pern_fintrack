//src/pages/auth/AuthPage.tsx
import styles from './styles/authPage.module.css';
import { useEffect, useState } from 'react';
import AuthUI from './AuthUI';
import useAuth from '../../hooks/useAuth';
import Logo from '../../../assets/logo.svg';

import { useLocation } from 'react-router-dom';

//--MAIN COMPONENT AUTHENTICACION ACCESS PAGE
export default function AuthPage() {
 const location = useLocation();//to access the 'expired' state, from navigationHelper.

 //--MODAL STATES
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState<'signin' | 'signup'>(
    'signin'
  );

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
    // showSignInModalOnLoad,
    // setShowSignInModalOnLoad,
  } = useAuth();

//------------------------------------
// ✅ HANDLE DIFFERENT NAVIGATION STATES
//------------------------------------
//Detect Session expiration or forced login from navigation state
useEffect(() => {
 const navigationState = location.state as {
  expired:boolean;
  showModal?:boolean;
  initialMode?:'signin'|'signup';
  from?:string;
 } | undefined;

// Clear previous states
 clearError();
 clearSuccessMessage();

// Determine behavior based on navigation state
 //coming from logoutCleanup with {expired:true}
 if(navigationState?.expired===true){
  // Session expired - open signin modal 
  setInitialAuthMode('signin');
  setShowAuthModal(true);
  console.log('🔄 Session expired - opening signin modal');
 }
 else if(navigationState?.expired===false){
  // Manual logout - open signin modal
  setInitialAuthMode('signin');
  setShowAuthModal(true);
  console.log('👋 Manual logout - opening signin modal');
 }

 // // If no specific reason, show page with buttons only
// User must click "Sign In" or "Sign Up" to open modal
}, [location.state, clearError, clearSuccessMessage]);
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
    setShowAuthModal(true);
    setInitialAuthMode('signin');
  };

  const openSignupModalHandler = () => {
    setIsMenuOpen(false);
    clearError();
    clearSuccessMessage();
    //-----------------------
    setShowAuthModal(true);
    setInitialAuthMode('signup');
    // setShowSignInModalOnLoad(false);
  };

  const closeAuthModal = () => {
    clearError;
    setShowAuthModal(false);
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
        {/* unico modal */}
        {showAuthModal && (
          <div className={styles.modalOverlay} onClick={closeAuthModal}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <AuthUI
                onSignIn={handleSignIn}
                onSignUp={handleSignUp}
                isLoading={isLoading}
                error={error}
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
