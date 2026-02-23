//frontend/src/pages/auth/AuthUI.tsx

//* 📦 IMPORT DEPENDENCIES
import { useCallback, useEffect, useState } from 'react';
import styles from './styles/AuthUI.module.css';// is a module
import GoogleLogo from '../../../assets/auth/GoogleLogo';
import {
  CredentialsType,
  SignInCredentialsType,
  SignUpCredentialsType,
} from '../../types/authTypes';

import Message, { MessageType } from '../formUIComponents/Message';

import {  getIdentity} from '../../auth_utils/localStorageHandle/authStorage';

import InputField from '../formUIComponents/InputField';

// 🏷️ TYPE DEFINITION
type AuthUIPropsType = {
// 📋 Auth State 
  onSignIn: (credentials: SignInCredentialsType, rememberMe:boolean) => Promise<boolean>;

  onSignUp: (credentials: SignUpCredentialsType) => Promise<boolean>;

  isSignInInitial?: boolean;

  clearError:()=>void;

  isSessionExpired?: boolean;

  isLoading: boolean;
  error: string | null;
  messageToUser?: string | undefined | null;

  onClose?: () => void;
  
// 🚀 Social Access (Placeholder for next commit)
 // googleSignInUrl?: string | null;
 // handleGoogleSignIn?: () => void;
};

// 🔧 CONSTANTS & INITIAL VALUES
const INITIAL_CREDENTIALS_STATE: CredentialsType = {
 //harcoded credentials for test in dev
  // username: 'usuario01',
  // email: 'user01@email.com',
  // user_firstname: 'nombre usuario 01',
  // user_lastname: 'usuario apellido',
  // password: '1000',
  username: '',
  email: '',
  user_firstname: '',
  user_lastname: '',
  password: '',
  confirmPassword:'',

};

/**
 * 🌟 ===============================
 * 🎭 COMPONENT: AuthUI
 * =============================== 🌟
 */
function AuthUI({
  onSignIn,
  onSignUp,
  isLoading,
  error,
  clearError,
  messageToUser="",
  isSignInInitial,
  onClose,
  // googleSignInUrl,
}: AuthUIPropsType): JSX.Element {

// 🏗️ STATE MANAGEMENT
// 📝 Initialize credentials from localStorage if user was remembered
const [credentials, setCredentials] = useState<CredentialsType>(() => {
// Read persisted identity (infrastructure layer)
const identity = getIdentity();

if (identity) {
  console.log('🔧 Lazy init: found remembered identity for', identity.email);

  return {
    ...INITIAL_CREDENTIALS_STATE,
    email: identity.email,
    username: identity.username,
  };
}

console.log('🔧 Lazy init: no remembered identity, using empty form');
return INITIAL_CREDENTIALS_STATE;
});

// ✅ Initialize rememberMe checkbox from persisted identity
const [rememberMe, setRememberMe] = useState<boolean>(() => {
 const identity = getIdentity();
 return identity?.rememberMe === true;
});

// 🔀 Auth mode (signin/signup)
const [isSignIn, setIsSignIn] = useState(isSignInInitial);

// 👁️ Local state for password visibility
const [isPasswordVisible, setIsPasswordVisible] = useState(false);

//------------------------
// 🔧 HANDLERS
//------------------------
const togglePasswordVisibility = useCallback(() => {
  setIsPasswordVisible((prev) => !prev);
 }, []);

// 📝 INPUT HANDLERS
const handleInputChange = (fieldName: keyof CredentialsType) => 
    (input: string | React.ChangeEvent<HTMLInputElement>) => {
      const value = typeof input === 'string' ? input : input.target.value;
      
      if (error) clearError();
      
      setCredentials((prev) => ({ 
        ...prev, 
        [fieldName]: value 
      }));
  };
//------------------------
// 📝 SIGN IN SUBMISSION HANDLERS
//------------------------
  const handleSignInSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
try {
// 1️⃣ Call authentication service
    await onSignIn({
      username: credentials.username,
      email: credentials.email,
      password: credentials.password,
    } as SignInCredentialsType, rememberMe);

//Note: Persistence, navigation and states are handled in useAuth

  } catch (error) {
    // Error is already handled by onSignIn (sets error state)
    // UI layer only reacts to error state, doesn't interpret it
    console.log('❌ Login failed, not saving identity');
  }
  };
//-------------------------------
  const handleSignUpSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    onSignUp({
      username: credentials.username,
      email: credentials.email,
      user_firstname: credentials.user_firstname,
      user_lastname: credentials.user_lastname,
      password: credentials.password,
      confirmPassword: credentials.confirmPassword,
    } as SignUpCredentialsType);
  };

 // 🎨 GOOGLE SIGN-IN HANDLER
  // const handleGoogleSignIn = (googleSignInUrl) => {
  //   if (googleSignInUrl) {
  //     window.location.href = googleSignInUrl; // Redirect to Google Sign-in URL
  //     // navigateTo()
  //   } else {
  //     console.warn('Google Sign-in URL not provided.');
  //   }
  // };

  // 🔀 AUTH MODE TOGGLE
  const toggleAuthMode = () => {
    setIsSignIn(!isSignIn);
    // Reset user data state
    setCredentials(INITIAL_CREDENTIALS_STATE);
    setRememberMe(false);
  };

  //checkbox handler
  const handleRememberMeChange= (e:React.ChangeEvent<HTMLInputElement>)=>{setRememberMe(e.target.checked)}

  // function inputCredentialsHandler(e: React.ChangeEvent<HTMLInputElement>) {
  //  if(error) clearError();
  //   setCredentials((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  // }

// ===============================
// ⏱️ AUTO-HIDE MESSAGES AFTER TIMEOUT
// ===============================
  const bannerMessage:
  | { type: MessageType; text: string }
  | null =
  error
    ? { type: 'error', text: error }
    : messageToUser
    ? { type: 'success', text: messageToUser }
    : null;

  
 //Reset form on signup error
 useEffect(() => {
  if (error && !isLoading && !isSignIn) {
    setCredentials(INITIAL_CREDENTIALS_STATE);
   }
  }, [error, isLoading, isSignIn]); 
//------------------------------------------
//🎨 RENDER
  return (
  <div className={styles['auth-container']}>
{/* 📢 Stable Message Area*/}
   <div className={`${styles.messageArea} ${bannerMessage ? styles.isVisible : styles.isHidden}`}>
   {bannerMessage && (
    <Message
     type={bannerMessage.type}
     message={bannerMessage.text}
     autoDismiss={0}
     onDismiss={() => clearError()}
     showIcon={false}
    />
   )}
   </div>

   <h2 className={styles['auth-container__title']}>
     {isSignIn ? 'Sign In' : 'Sign Up'}
   </h2>
{/*------------------------- */}
    <form
     className={`auth-form  ${
       isSignIn ? 'auth-form--signin' : 'auth-form--signup'
     }`}
     onSubmit={isSignIn ? handleSignInSubmit : handleSignUpSubmit}
     >
{/* 👤 Username */}
{/* <div className={styles.fieldWrapper}> */}
        <InputField
         label="Username"
         type="text"
         placeholder="your_username"
         value={credentials.username}
         onChange={handleInputChange('username')}
         required
         disabled={isLoading}
         isReadOnly={isLoading}
         tabindex={1}
       />
    {/* </div> */}

{/* 📧 Email Field */}
        <InputField
          label="Email"
          type="email"
          placeholder="email"
          value={credentials.email}
          onChange={handleInputChange('email')}
          required
          disabled={isLoading}
          isReadOnly={isLoading}
          tabindex={2}
        />

{/* 🔑 Password Field with Visibility Toggle */}
        {/* <InputField
          label="Password"
          placeholder="password"
          value={credentials.password || ''}
          onChange={handleInputChange('password')}
          required
          disabled={isLoading}
          isReadOnly={isLoading}
          showContentToggle={true}
          isContentVisible={isPasswordVisible}
          onToggleContent={togglePasswordVisibility}
          tabindex={3}
        />        */}
{/* Checkbox of Remember Me (Sign In Only) */}
        {
         isSignIn && (
         <>
{/* 🔑 Password Field with Visibility Toggle */}
        <InputField
          label="Password"
          placeholder="password"
          value={credentials.password || ''}
          onChange={handleInputChange('password')}
          required
          disabled={isLoading}
          isReadOnly={isLoading}
          showContentToggle={true}
          isContentVisible={isPasswordVisible}
          onToggleContent={togglePasswordVisibility}
          tabindex={3}
        />       
          
          <div className={styles['auth-form__remember-me']}
          onClick={() => setRememberMe(!rememberMe)}
          >
          <input
           className={styles['auth-form__checkbox']}
           type="checkbox" id="rememberMe"
           checked={rememberMe}
           onChange={handleRememberMeChange} 
           tabIndex={5}
           />
           <label htmlFor="rememberMe"
            className={styles['auth-form__label-checkbox']}>
            Keep me signed in
            </label>
          </div>
         </>
         )
        }
{/* 📋 Registration Fields */}
        {!isSignIn && (
         <div className={styles.extraFieldsGroup}>
          <InputField
            label="First Name"
            value={credentials.user_firstname}
            onChange={handleInputChange('user_firstname')}
            required
            disabled={isLoading}
            isReadOnly={isLoading}
            tabindex={5}
          />
          <InputField
            label="Last Name"
            value={credentials.user_lastname}
            onChange={handleInputChange('user_lastname')}
            required
            disabled={isLoading}
            isReadOnly={isLoading}
            tabindex={6}
          />

          <InputField
           label="Password"
           placeholder="password"
           value={credentials.password || ''}
           onChange={handleInputChange('password')}
           required
           disabled={isLoading}
           isReadOnly={isLoading}
           showContentToggle={true}
           isContentVisible={isPasswordVisible}
           onToggleContent={togglePasswordVisibility}
           tabindex={7}
           />       

           <InputField
            label="Confirm Password"
            placeholder="confirm password"
            type="password"
            value={credentials.confirmPassword || ''}
            onChange={handleInputChange('confirmPassword')}

            required
            disabled={isLoading}
            isReadOnly={isLoading}
            showContentToggle={true}
            isContentVisible={isPasswordVisible}

            onToggleContent={togglePasswordVisibility}
            tabindex={8}
  />
          </div>
        )}

        <button
          type='submit'
          className={styles['auth-form__button']}
          disabled={isLoading}
          tabIndex={7}
        >
          {isLoading ? 'Loading...' : isSignIn ? 'Sign In' : 'Sign Up'}

        </button>
      </form>

{/* 🔗 Footer Actions & Social Placeholder */}
      <div className={styles['auth-actions']}>
        <button
          type='button'
          className={styles['auth-actions__toggle-button']}
          onClick={toggleAuthMode}
          disabled={isLoading}
          tabIndex={7}
        >
          {isSignIn
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>

      {/* 🚀 GOOGLE SIGN-IN (Placeholder for dedicated commit) */}
        {
        // !googleSignInUrl &&
         (
          <div className={styles.socialSection}>
            <div className={styles.separator}>
              <span>OR</span>
            </div>
            <button
              type='button'
              className={styles['google-signin-button']}
              // onClick={handleGoogleSignIn}
            >
              <GoogleLogo size={20} />
              Continue with Google
            </button>
          </div>
        )} 
       
      </div>
    </div>
  );
}

export default AuthUI;
