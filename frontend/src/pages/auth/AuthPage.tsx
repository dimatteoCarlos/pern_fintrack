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
    setShowSignInModalOnLoad ,
  } = useAuth();


  //------------------------------------
  //FUNCTIONS EVENT HANDLERS
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const openSigninModalHandler = () => {
    setIsMenuOpen(false); //
    setShowSigninModal(true);
    setShowSignupModal(false);
    clearError();
    clearSuccessMessage();
    setShowSignInModalOnLoad(false); 
  };

  const openSignupModalHandler = () => {
    setIsMenuOpen(false); //
    setShowSigninModal(false);
    setShowSignupModal(true);

    clearError();
    clearSuccessMessage();
    setShowSignInModalOnLoad(false);
  };

  const closeAuthModal = () => {
    setShowSignupModal(false);
    setShowSigninModal(false);
    clearError;
    clearSuccessMessage;
    setShowSigninModal(false);

  };
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
            Signin
          </li>

          <li className={styles.navItem} onClick={openSignupModalHandler}>
            Sign Up
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
                onSignUp={() => {}}
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
                onSignIn={() => {}}
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
      </main>
    </div>
  );
}
