//src/pages/auth/AuthPage.tsx
import styles from './styles/authPage.module.css';
import { useEffect, useState } from 'react';
import AuthUI from './AuthUI';
import useAuth from '../../hooks/useAuth';
import Logo from '../../../assets/logo.svg';

import { useLocation, useNavigate } from 'react-router-dom';

//--MAIN COMPONENT AUTHENTICACION ACCESS PAGE
export default function AuthPage() {
 const location = useLocation();
 const navigateTo = useNavigate()

 //--MODAL STATES
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState<'signin' | 'signup'>(
    'signin'
  );
  // const [successMessage, setSuccessMessage] = useState<string | null>(null); 

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

const expired = location.state?.expired;
useEffect(() => {
 if(!expired) return;
 navigateTo(location.pathname, { replace: true, state: {} });

}, [expired,location.pathname, navigateTo]);
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
