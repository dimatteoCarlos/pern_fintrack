// src/pages/auth/AuthLayout.tsx
import { Link } from 'react-router-dom';
import styles from './styles/authLayout.module.css';
import { useState } from 'react';
import AuthUI from './AuthUI';

import Logo from '../../assets/logo.svg';
//AuthLayout
export default function AuthLayout() {
  //--STATES
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  //FUNCTIONS
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const openLoginModal = () => {
    setIsMenuOpen(false);
    setShowLoginModal(true);
    setShowSignupModal(false);
  };
  const openSignupModal = () => {
    setIsMenuOpen(false);
    setShowLoginModal(false);
    setShowSignupModal(true);
  };

  const closeAuthModal = () => {
    setShowSignupModal(false);
    setShowLoginModal(false);
  };

  return (
    <div className={styles.authLayoutContainer}>
      <nav className={styles.navbar}>
        <div className={styles.logoContainer}>
          <Link to='/auth/signin' className={styles.logoLink}>
            <span>
              <Logo />
            </span>
          </Link>
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
          <li className={styles.navItem} onClick={openLoginModal}>
            Login
          </li>

          <li className={styles.navItem} onClick={openSignupModal}>
            Sign Up
          </li>
          
        </ul>
      </nav>

      <main className={styles.mainContent}>
        {/* <Outlet /> */}
        {showLoginModal && (
          <div className={styles.modalOverlay} onClick={closeAuthModal}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Login</h2>
              <AuthUI
                onSignIn={() => console.log('Login')}
                onSignUp={() => console.log('Sign up')}
                isLoading={false}
                error={null}
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
              <h2>Signup</h2>

              <AuthUI
                onSignIn={() => console.log('SignIn')}
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
