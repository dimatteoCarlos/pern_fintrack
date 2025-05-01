//src/pages/auth/AuthPage.tsx
import styles from './styles/authPage.module.css';
import { useEffect, useState } from 'react';
import AuthUI from './AuthUI';
import useAuth from '../../auth/hooks/useAuth';
import Logo from '../../assets/logo.svg';

//--MAIN COMPONENT
export default function AuthPage() {
  //--MODAL STATES
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showSigninModal, setShowSigninModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);

  //CUSTOM HOOKS FOR SIGNIN AND SIGNUP
  // Execute the useAuth hook to get authentication state and actions
  const {
    // isAuthenticated,
    // userData,
    // handleSignOut,
    isLoading,
    error,
    successMessage,
    handleSignIn,
    handleSignUp,
    clearError,
    clearSuccessMessage,
    showSignInModalOnLoad,
    setShowSignInModalOnLoad,
  } = useAuth();

  //------------------------------------
  //FUNCTIONS EVENT HANDLERS
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const openSigninModalHandler = () => {
    setIsMenuOpen(false); //
    clearError();
    clearSuccessMessage();
    setShowSignInModalOnLoad(false);
    //-----------------------
    setShowSigninModal(true);
    setShowSignupModal(false);
    setShowAuthModal(true);
  };

  const openSignupModalHandler = () => {
    setIsMenuOpen(false);
    clearError();
    clearSuccessMessage();
    setShowSignInModalOnLoad(false);
    //-----------------------
    setShowSigninModal(false);
    setShowSignupModal(true);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    clearError;
    clearSuccessMessage;
    //-------------------
    setShowSignupModal(false);
    setShowSigninModal(false);
    setShowAuthModal(false);
  };

  //---------------------------------

  //------------------------------------
  // Effect to show sign-in modal on load if triggered by ProtectedRoute
  useEffect(() => {
    if (showSignInModalOnLoad) {
      setShowSigninModal(true);
      setShowSignInModalOnLoad(false); // Reset after showing
    }
  }, [showSignInModalOnLoad, setShowSignInModalOnLoad]);

  //------------------------------------
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
            isMenuOpen ? styles.navMenuActive : ''
          }`}
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
        {/* <Outlet /> */}
        
        {showSigninModal && (
          <div className={styles.modalOverlay} onClick={closeAuthModal}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              {/* <h2>Signin</h2> */}
              <AuthUI
                onSignIn={handleSignIn}
                onSignUp={handleSignUp}
                isLoading={isLoading}
                error={error}
                isSignInInitial={true}
                messageToUser={successMessage}
              />
              <button className={styles.closeButton} onClick={closeAuthModal}>
                Close
              </button>
            </div>
          </div>
        )}
        {showSignupModal && (
          <div className={styles.modalOverlay} onClick={closeAuthModal}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              {/* <h2>Signup</h2> */}

              <AuthUI
                onSignUp={handleSignUp}
                onSignIn={handleSignIn}
                isLoading={isLoading}
                error={error}
                isSignInInitial={false}
                messageToUser={successMessage}
              />
              <button className={styles.closeButton} onClick={closeAuthModal}>
                Close
              </button>
            </div>
          </div>
        )}
        
        {/* Sustituir por este unico modal */}
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
                isSignInInitial={true} // o false según prefieras
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
