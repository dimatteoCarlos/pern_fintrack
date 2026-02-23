//frontend/src/pages/auth/AuthUI.tsx

/* ===============================
  🎭 AUTH UI ORCHESTRATOR
  Responsible for:
  - Toggle between SignIn and SignUp
  - Display global messages
  - Render the appropriate form component
  - Manage rememberMe state
 =============================== */
import { useEffect, useState } from 'react';
import styles from './styles/AuthUI.module.css';
import GoogleLogo from '../../../assets/auth/GoogleLogo';
import Message, { MessageType } from '../formUIComponents/Message';
import { SignInFormDataType, SignUpFormDataType } from '../../validation/zod_schemas/authSchemas';
import SignInForm from '../signInForm/SignInForm';
import SignUpForm from '../signUpForm/SignUpForm';
import { getIdentity } from '../../auth_utils/localStorageHandle/authStorage'

type AuthUIPropsType = {
  onSignIn: (credentials: SignInFormDataType, rememberMe: boolean) => Promise<void>;
  onSignUp: (userData: SignUpFormDataType) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  messageToUser?: string | null;
  clearError: () => void;
  onClose?: () => void;
};

function AuthUI({
  onSignIn,
  onSignUp,
  isLoading: externalLoading,
  error,
  messageToUser = '',
  clearError,
  onClose,
}: AuthUIPropsType): JSX.Element {
  const [isSignIn, setIsSignIn] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

//--------------------
 // stratgy for force remount
 const [formKey, setFormKey] = useState(0); // ✅ For forced remount
// ✅ Reinitialize rememberMe when switching to SignIn
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
//--------------------
 const bannerMessage: { type: MessageType; text: string } | null = error
    ? { type: 'error', text: error }
    : messageToUser
    ? { type: 'success', text: messageToUser }
    : null;
//-------------------
 return (
  <div className={styles['auth-container']}>
    {/* 📢 Message Area with Auto-dismiss */}
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
          onDismiss={() => clearError()}
          showIcon={false}
        />
      )}
    </div>

    <h2 className={styles['auth-container__title']}>
      {isSignIn ? 'Sign In' : 'Sign Up'}
    </h2>

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

      {/* Google Sign-In Placeholder */}
      <div className={styles.socialSection}>
        <div className={styles.separator}>
          <span>OR</span>
        </div>
        <button type="button" className={styles['google-signin-button']} disabled>
          <GoogleLogo size={20} />
          Continue with Google
        </button>
      </div>

      {onClose && (
        <button type="button" onClick={onClose} className={styles.closeButton}>
          Close
        </button>
      )}
    </div>
  </div>
 );
}

export default AuthUI;