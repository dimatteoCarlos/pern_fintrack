//frontend/src/pages/auth/AuthUI.tsx
import { useEffect, useState } from 'react';
import styles from './styles/AuthUI.module.css';// is a module
import GoogleLogo from '../../../assets/auth/GoogleLogo';
import {
  CredentialsType,
  SignInCredentialsType,
  SignUpCredentialsType,
} from '../../types/authTypes';
// import { useLocation } from 'react-router-dom';
// import { useNavigate } from 'react-router-dom';

// 🏷️ PROPS TYPE DEFINITION
type AuthUIPropsType = {
  onSignIn: (credentials: SignInCredentialsType, rememberMe:boolean) => void;
  onSignUp: (userData: SignUpCredentialsType) => void;
  isSignInInitial?: boolean;

  googleSignInUrl?: string; // Optional Google Sign-in URL
  
  isLoading: boolean;
  error: string | null;
  messageToUser?: string | undefined | null;
};

// 🔧 CONSTANTS & INITIAL VALUES
const INITIAL_CREDENTIALS_STATE: CredentialsType = {
  username: 'usuario01',
  email: 'user01@email.com',
  user_firstname: 'nombre usuario 01',
  user_lastname: 'usuario apellido',
  password: '100',
  // username: '',
  // email: '',
  // user_firstname: '',
  // user_lastname: '',
  // password: '',
};

// 📊 MESSAGE TYPES (For better type safety)
// type MessageType = 'error' | 'success';

//--MAIN COMPONENT
function AuthUI({
  onSignIn,
  onSignUp,
  googleSignInUrl,
  isLoading,
  error,
  messageToUser="",
  isSignInInitial,
}: AuthUIPropsType): JSX.Element {
 // const location = useLocation();
 // const wasRedirectedByExpiration = location.state?.expired;

// 🏗️ STATE MANAGEMENT
  const [credentials, setCredentials] = useState<CredentialsType>(INITIAL_CREDENTIALS_STATE);
  const [showMessageToUser, setShowMessageToUser] = useState(true);
  const [showError, setShowError] = useState(true);
    // const navigateTo = useNavigate();
  const [isSignIn, setIsSignIn] = useState(isSignInInitial);
  const [rememberMe, setRememberMe] = useState(false);
  // const [messageType, setMessageType] = useState<MessageType>('success');
  /*
  // 🔄 MESSAGE HANDLING HOOK
  useEffect(() => {
    if (isLoading) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    if (messageToUser) {
      setMessage(messageToUser);
      setMessageType('success');
      setShowMessage(true);
      timeoutId = setTimeout(() => setShowMessage(false), MESSAGE_TIMEOUT_MS);
    } else if (error) {
      setMessage(error);
      setMessageType('error');
      setShowMessage(true);
      timeoutId = setTimeout(() => setShowMessage(false), MESSAGE_TIMEOUT_MS);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [messageToUser, error, isLoading]);
  */

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
    setCredentials((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // 🗑️ RESET FORM ON ERROR
  useEffect(() => {
   const MESSAGE_TIMEOUT_MS = 5000;
   let timer: ReturnType<typeof setTimeout>;
   if (messageToUser && !isLoading) setShowMessageToUser(true);
   timer = setTimeout(() => {
    setShowMessageToUser(false);
    setShowError(false);
   }, MESSAGE_TIMEOUT_MS);
   
   if (error && !isLoading) setShowError(true);
   timer = setTimeout(() => {
    setShowError(false);
   }, MESSAGE_TIMEOUT_MS);
   
   return () => {
    if (timer) clearTimeout(timer);
   };
  }, [messageToUser, error, isLoading]);
  
  //Reset form on signup error
  useEffect(() => {
    if (error && !isLoading && !isSignIn) {
      setCredentials(INITIAL_CREDENTIALS_STATE);
    }
  }, [error, isLoading, isSignIn]);

  //RENDERING
  return (
    <div className={styles['auth-container']}>

      {/* {succes message to user} */}
      {messageToUser && showMessageToUser && (
        <span className={styles['messageToUser__msg']}>{messageToUser}</span>
      )}

      {error && showError && (
        <p className={styles['auth-container__errorMsg']}
        >{error}</p>
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

        {/* <button type="button" className="auth-actions__google-button" onClick={handleGoogleSignIn}>
          Sign In with Google
        </button> */}

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
        )}
      </div>
      {/* {isSessionExpired && (
        <div className={styles.auth_container__expireMsg}>
         Your session has expired for safety.Try Sign in again.
        </div>
            )} */}

    </div>
  );
}

export default AuthUI;
