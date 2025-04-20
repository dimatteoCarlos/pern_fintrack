// src/pages/auth/AuthPage.tsx
import styles from './styles/authPage.module.css';
import { useState } from 'react';
import AuthUI from './AuthUI';
import Logo from '../../assets/logo.svg';
import useFetchPost from '../../hooks/useFetchPost';
import {
  SignInCredentialsType,
  SignUpCredentialsType,
} from '../../auth/types/authTypes';
import { url_signin } from '../../endpoints';

//--MAIN COMPONENT
export default function AuthPage() {
  //--MODAL STATES
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showSigninModal, setShowSigninModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  //CUSTOM HOOKS FOR SIGNIN AND SIGNUP
  //--execute useHooks, variables destructuring and aliasing
  const {
    isLoading: isSigninLoading,
    error: signinError,
    request: signinRequest,
  } = useFetchPost<SignInCredentialsType, unknown>();
  // } = useFetchPost<unknown>();
  const {
    isLoading: isSignupLoading,
    error: signupError,
    request: signupRequest,
  } = useFetchPost<SignUpCredentialsType, unknown>();

  console.log(
    isSigninLoading,
    signinError,
    signinRequest,
    isSignupLoading,
    signupError,
    signupRequest
  );
  //------------------------------------
  //FUNCTIONS EVENT HANDLERS
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const openSigninModal = () => {
    setIsMenuOpen(false);
    setShowSigninModal(true);
    setShowSignupModal(false);
  };
  const openSignupModal = () => {
    setIsMenuOpen(false);
    setShowSigninModal(false);
    setShowSignupModal(true);
  };

  const closeAuthModal = () => {
    setShowSignupModal(false);
    setShowSigninModal(false);
  };
  //--AUTH FUNCTIONS---------------
  //url: string, body?: SignInCredentialsType | undefined, headers?: Record<string, string>) => Promise<FetchPostStateType<unknown>>
  const handleSignIn = async (credentials: SignInCredentialsType) => {
    const url = url_signin;
    const result = await signinRequest(url, credentials);
    console.log('handleSignIn:', result);
    if (result.data) {
      //que empiece la fiesta
      closeAuthModal();
    }
  };

  //------------------------------------
  return (
    <div className={styles.authPageContainer}>
      {/* {navbar} */}
      <nav className={styles.navbar}>
        <div className={styles.logoContainer} onClick={openSigninModal}>
          {/* <Link to='/auth/signin' className={styles.logoLink}> */}
          <span>
            <Logo />
          </span>
          {/* </Link> */}
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
          <li className={styles.navItem} onClick={openSigninModal}>
            Signin
          </li>

          <li className={styles.navItem} onClick={openSignupModal}>
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
                onSignUp={() => console.log('Sign up')}
                isLoading={isSigninLoading}
                error={signinError}
                isSignInInitial={true}
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
                onSignIn={handleSignIn}
                onSignUp={() => console.log('Signup')}
                isLoading={false}
                error={null}
                isSignInInitial={false}
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

// {showSignupModal && (
//   <Modal onClose={closeAuthModal}>
//     <AuthUI
//       onSignIn={handleLogin}
//       onSignUp={handleSignup}
//       isLoading={isSignupLoading}
//       error={signupError}
//       messageToUser={signupMessage}
//       isSignInInitial={false}
//     />
//   </Modal>
// )}
// </main>
// </div>
// );
// }

// // Componente simple para el modal reutilizable
// function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
// return (
// <div className={styles.modalOverlay} onClick={onClose}>
// <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
// {children}
// <button className={styles.closeButton} onClick={onClose}>Close</button>
// </div>
// </div>
// );
// }
