//frontend/src/pages/auth/AuthUI.tsx

/* ===============================
  🎭 AUTH UI ORCHESTRATOR
  Responsible for:
  - Toggle between SignIn and SignUp
  - Display global messages
  - Render the appropriate form component
  - Manage rememberMe state
 =============================== */
import { useEffect, useMemo, useRef, useState } from 'react';
// import GoogleLogo from '../../../assets/auth/GoogleLogo';
import Logo from '../../../assets/logo.svg';
import Message, { MessageType } from '../formUIComponents/Message';
import { SignInFormDataType, SignUpFormDataType } from '../../validation/zod_schemas/authSchemas';
import SignInForm from '../signInForm/SignInForm';
import SignUpForm from '../signUpForm/SignUpForm';
import { getIdentity } from '../../auth_utils/localStorageHandle/authStorage'
import { useAuthUIStore } from '../../stores/useAuthUIStore';
import styles from './styles/authUI.module.css';

type AuthUIPropsType = {
  onSignIn: (credentials: SignInFormDataType, rememberMe: boolean) => Promise<void>;
  onSignUp: (userData: SignUpFormDataType) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  messageToUser?: string | null;
  isSignInInitial:boolean;
  clearError: () => void;
  onClose?: () => void;
};
//MAIN COMPONENT: AuthUI.tsx
function AuthUI({
  onSignIn,
  onSignUp,
  isLoading: externalLoading,
  error,
  messageToUser = '',
  isSignInInitial,
  clearError,
  onClose,
}: AuthUIPropsType): JSX.Element {
 //STATES
  const [isSignIn, setIsSignIn] = useState(isSignInInitial);
  const [rememberMe, setRememberMe] = useState(false);

 const [formKey, setFormKey] = useState(0); // ✅ For forced remount

//Reference for initial state used in unsaved guard
const initialFormStateRef = useRef({
  isSignIn: isSignInInitial,
  rememberMe: false
});
// ===============================
  // 🛡️ UNSAVED CHANGES GUARD
  // ===============================
  const isDirty = useMemo(() => {
    return (
      isSignIn !== initialFormStateRef.current.isSignIn ||
      rememberMe !== initialFormStateRef.current.rememberMe
    );
  }, [isSignIn, rememberMe]);

  const handleCloseClick = () => {
    if (isDirty) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }
    onClose?.();
  };

  // ===============================
  // 🔄 REINITIALIZATION
  // ===============================
  useEffect(() => {
   if (isSignIn) {
     const identity = getIdentity();
     setRememberMe(identity?.rememberMe === true);
   }
  }, [isSignIn]);

  // ✅ Force form remount when toggling to ensure clean state
  const toggleAuthMode = () => {
    setIsSignIn(prev => !prev);
    setFormKey(prev => prev + 1); // Increment key to force remount
    clearError();
  };
 // ====================
 // 💬 BANNER MESSAGE
 // ====================
 const bannerMessage: { type: MessageType; text: string } | null = error
    ? { type: 'error', text: error }
    : messageToUser
    ? { type: 'success', text: messageToUser }
    : null;

// =============
// 🎨 RENDER
// =============
 return (
  <form autoComplete='off' className={styles['auth-container']}>
    {/* 🏷️ Header: brand mark on the left, closing on the right */}
    <div className={styles['auth-header']}>
      {/* The svg module is typed as taking no props, so the class rides on a
          wrapper rather than on the mark itself. */}
      <span className={styles['auth-header__logo']} aria-hidden='true'>
        <Logo />
      </span>

      {onClose && (
        <button
          type='button'
          onClick={handleCloseClick}
          className={styles.closeButton}
        >
          <span>Close</span>
        </button>
      )}
    </div>

    <div className={styles['auth-header__rule']} />

    {/* 📢 Message Area with close button */}
    <div
      className={`${styles.messageArea} ${
        bannerMessage ? styles.isVisible : styles.isHidden
      }`}
    >
      {bannerMessage && (
      <Message
        type={bannerMessage.type}
        message={bannerMessage.text}
        autoDismiss={5000}
        onDismiss={() => {
          clearError();//clean store errors
          if (bannerMessage.type === 'success') {
           useAuthUIStore.getState().setMessage(null);
          }
        }}
        showIcon={false}
      />
      )}
    </div>

    {/* The heading is read, not seen: the submit button and the toggle link
        below both name the mode. It stays in the tree so the dialog has one. */}
    <h2 className={styles['auth-container__title']}>
      {isSignIn ? 'Sign In' : 'Sign Up'}
    </h2>

    <p className={styles['auth-container__note']}>All fields are required</p>

    {/* Conditional Form Rendering */}
    {isSignIn ? (
      <SignInForm
       key={`signin-${formKey}`}
        onSignIn={onSignIn}
        externalLoading={externalLoading}
        error={error}
        clearError={clearError}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
      />
    ) : (
      <SignUpForm
        key={`signup-${formKey}`}
        onSignUp={onSignUp}
        externalLoading={externalLoading}
        error={error}
        clearError={clearError}
      />
    )}

    {/* Footer Actions */}
    <div className={styles['auth-actions']}>
      <button
        type="button"
        className={styles['auth-actions__toggle-button']}
        onClick={toggleAuthMode}
        disabled={externalLoading}
      >
        {isSignIn
          ? "Don't have an account? Sign up"
          : 'Already have an account? Sign in'}
      </button>

      {/* Closing moved to the header, where it aligns with the brand mark and
          sits inside the panel it closes. */}

      {/* Google Sign-In Placeholder */}
      {/* <div className={styles.socialSection}>
        <div className={styles.separator}>
          <span>OR</span>
        </div>
        <button type="button" className={styles['google-signin-button']} disabled>
          <GoogleLogo size={20} />
          Continue with Google
        </button>
      </div> */}
    </div>
  </form>
 );
}

export default AuthUI;