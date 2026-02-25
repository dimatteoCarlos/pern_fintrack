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
import GoogleLogo from '../../../assets/auth/GoogleLogo';
import Message, { MessageType } from '../formUIComponents/Message';
import { SignInFormDataType, SignUpFormDataType } from '../../validation/zod_schemas/authSchemas';
import SignInForm from '../signInForm/SignInForm';
import SignUpForm from '../signUpForm/SignUpForm';
import { getIdentity } from '../../auth_utils/localStorageHandle/authStorage'
import styles from './styles/authUI.module.css';
import { useAuthUIStore } from '../../stores/useAuthUIStore';

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
  <div className={styles['auth-container']}>
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
{/* Close button with unsaved guard */}
      {onClose && (
        <button type="button" onClick={handleCloseClick} className={styles.closeButton}>
          Close
        </button>
      )}
    </div>
  </div>
 );
}

export default AuthUI;