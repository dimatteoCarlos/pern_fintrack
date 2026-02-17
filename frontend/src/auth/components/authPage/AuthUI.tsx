//frontend/src/pages/auth/AuthUI.tsx
import { useEffect, useState } from 'react';
import styles from './styles/AuthUI.module.css';// is a module
// import GoogleLogo from '../../../assets/auth/GoogleLogo';
import {
  CredentialsType,
  SignInCredentialsType,
  SignUpCredentialsType,
} from '../../types/authTypes';

import Message, { MessageType } from '../formUIComponents/Message';

// 🏷️ PROPS TYPE DEFINITION
type AuthUIPropsType = {
  onSignIn: (credentials: SignInCredentialsType, rememberMe:boolean) => void;
  onSignUp: (userData: SignUpCredentialsType) => void;
  isSignInInitial?: boolean;
  clearError:()=>void;
  isSessionExpired?: boolean;

  // googleSignInUrl?: string; // Optional Google Sign-in URL
  
  isLoading: boolean;
  error: string | null;
  messageToUser?: string | undefined | null;
};

// 🔧 CONSTANTS & INITIAL VALUES
const INITIAL_CREDENTIALS_STATE: CredentialsType = {
 //harcoded credentials for test in dev
  username: 'usuario01',
  email: 'user01@email.com',
  // user_firstname: 'nombre usuario 01',
  // user_lastname: 'usuario apellido',
  // password: '1000',
  // username: '',
  // email: '',
  user_firstname: '',
  user_lastname: '',
  password: '',
};

// 📊 --MAIN COMPONENT: AuthUI.tsx
function AuthUI({
  onSignIn,
  onSignUp,
  // googleSignInUrl,
  isLoading,
  error,
  clearError,
  messageToUser="",
  isSignInInitial,
  
}: AuthUIPropsType): JSX.Element {
 // const location = useLocation();
 // const wasRedirectedByExpiration = location.state?.expired;

// 🏗️ STATE MANAGEMENT
  const [credentials, setCredentials] = useState<CredentialsType>(INITIAL_CREDENTIALS_STATE);

  const [isSignIn, setIsSignIn] = useState(isSignInInitial??true);
  const [rememberMe, setRememberMe] = useState(false);
 
  // 📝 INPUT HANDLERS
  const handleSignInSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    onSignIn({
      username: credentials.username,
      email: credentials.email,
      password: credentials.password,
    } as SignInCredentialsType, rememberMe);
  };

  const handleSignUpSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    onSignUp({
      username: credentials.username,
      email: credentials.email,
      user_firstname: credentials.user_firstname,
      user_lastname: credentials.user_lastname,
      password: credentials.password,
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

  function inputCredentialsHandler(e: React.ChangeEvent<HTMLInputElement>) {
   if(error) clearError();
    setCredentials((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

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
//RENDERING
  return (
    <div className={styles['auth-container']}>

     {bannerMessage && (
       <Message
         type={bannerMessage.type} 
         message={bannerMessage.text}
         autoDismiss={0}
         onDismiss={() => clearError()}
         showIcon={false}
       />
     )}

      <h2 className={styles['auth-container__title']}>
        {isSignIn ? 'Sign In' : 'Sign Up'}
      </h2>
{/* //------------------------- */}
      <form
        className={`auth-form  ${
          isSignIn ? 'auth-form--signin' : 'auth-form--signup'
        }`}
        onSubmit={isSignIn ? handleSignInSubmit : handleSignUpSubmit}
      >

        <div className={styles['auth-form__field']}>
          <label
            htmlFor='usernameOrEmail'
            className={styles['auth-form__label']}
          >
            Username
          </label>

          <input
            type='text'
            id='username'
            name='username'
            placeholder='username'
            className={styles['auth-form__input']}
            value={credentials.username}
            onChange={(e) => inputCredentialsHandler(e)}
            required
          />
        </div>

        {/* Checkbos of Remember Me (just for Sign in) */}
        {
         isSignIn && (
          <div className={styles['auth-form__remember-me']}>
           <input
           className={styles['auth-form__checkbox']}
            type="checkbox" id="rememberMe" checked={rememberMe} onChange={handleRememberMeChange} 
           />
           <label htmlFor="rememberMe"
            className={styles['auth-form__label-checkbox']}>
            Keep me signed in
            </label>
           </div>
         )
        }

        <div className={styles['auth-form__field']}>
          <label
            htmlFor='usernameOrEmail'
            className={styles['auth-form__label']}
          >
            Email
          </label>
          <input
            type='text'
            id='email'
            name='email'
            placeholder='email'
            className={styles['auth-form__input']}
            value={credentials.email}
            onChange={(e) => inputCredentialsHandler(e)}
            required
          />
        </div>

        <div className={styles['auth-form__field']}>
          <label htmlFor='password' className={styles['auth-form__label']}>
            Password
          </label>
          <input
            type='password'
            id='password'
            name='password'
            placeholder='password'
            className={styles['auth-form__input']}
            value={credentials.password || ''}
            onChange={(e) => inputCredentialsHandler(e)}
            required
          />
        </div>

        {!isSignIn && (
          <>
            <div className={styles['auth-form__field']}>
              <label htmlFor='firstName' className={styles['auth-form__label']}>
                First Name
              </label>
              <input
                type='text'
                id='firstName'
                name='user_firstname'
                placeholder='user_firstname'
                className={styles['auth-form__input']}
                value={credentials.user_firstname}
                onChange={(e) => inputCredentialsHandler(e)}
                required
              />
            </div>

            <div className={styles['auth-form__field']}>
              <label htmlFor='lastName' className={styles['auth-form__label']}>
                Last Name
              </label>
              <input
                type='text'
                id='lastName'
                name='user_lastname'
                placeholder='user_lastname'
                className={styles['auth-form__input']}
                value={credentials.user_lastname}
                onChange={(e) => inputCredentialsHandler(e)}
                required
                disabled={isLoading}
              />
            </div>
          </>
        )}

        <button
          type='submit'
          className={styles['auth-form__button']}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : isSignIn ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <div className='auth-actions'>
        <button
          type='button'
          className={styles['auth-actions__toggle-button']}
          onClick={toggleAuthMode} disabled={isLoading}
        >
          {isSignIn
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>

        {/* <button type="button" className="auth-actions__google-button"
         // onClick={handleGoogleSignIn}
         >
          Sign In with Google
        </button> */}
{/* 
        {googleSignInUrl && (
          <>
            <div className={styles['separator']}>
              <span>OR</span>
            </div>
            <button
              type='button'
              className={styles['google-signin-button']}
              // onClick={handleGoogleSignIn} handleGoogleSignIn
            >
              <GoogleLogo size={16} />
              Continue with Google
            </button>
          </>
        )} */}
      </div>
    </div>
  );
}

export default AuthUI;
