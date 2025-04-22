//AuthUI.tsx
import { useEffect, useState } from 'react';
import styles from './styles/AuthUI.module.css';
import GoogleLogo from '../../assets/auth/GoogleLogo';
import {
  CredentialsType,
  SignInCredentialsType,
  SignUpCredentialsType,
} from '../../auth/types/authTypes';
// import { useNavigate } from 'react-router-dom';

type AuthUIPropsType = {
  onSignIn: (credentials: SignInCredentialsType) => void;
  onSignUp: (userData: SignUpCredentialsType) => void;
  isSignInInitial?: boolean;

  googleSignInUrl?: string; // Optional Google Sign-in URL
  isLoading: boolean;
  error: string | null;
  messageToUser?: string | undefined | null;
};

//INITIAL STATES VALUES
const INITIAL_CREDENTIALS_STATE: CredentialsType = {
  username: '',
  email: '',
  user_firstname: '',
  user_lastname: '',
  password: '',
};

//--MAIN COMPONENT
function AuthUI({
  onSignIn,
  onSignUp,
  googleSignInUrl,
  isLoading,
  error,
  messageToUser,
  isSignInInitial,
}: AuthUIPropsType): JSX.Element {
  //--STATES
  const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS_STATE);
  const [showMessageToUser, setShowMessageToUser] = useState(true);
  const [showError, setShowError] = useState(true);

  //
  // const navigateTo = useNavigate();

  const [isSignIn, setIsSignIn] = useState(isSignInInitial);

  //--FUNCTIONS
  const handleSignInSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    onSignIn({
      username: credentials.username,
      email: credentials.email,
      password: credentials.password,
    } as SignInCredentialsType);
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

  // const handleGoogleSignIn = (googleSignInUrl) => {
  //   if (googleSignInUrl) {
  //     window.location.href = googleSignInUrl; // Redirect to Google Sign-in URL
  //     // navigateTo()
  //   } else {
  //     console.warn('Google Sign-in URL not provided.');
  //   }
  // };

  const toggleAuthMode = () => {
    setIsSignIn(!isSignIn);
    // Reset user data state
    setCredentials(INITIAL_CREDENTIALS_STATE);
  };

  function inputCredentialsHandler(e: React.ChangeEvent<HTMLInputElement>) {
    setCredentials((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }
// 
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (messageToUser && !isLoading) setShowMessageToUser(true);
    timer = setTimeout(() => {
      setShowMessageToUser(false);
      setShowError(false);
    }, 7000);

    if (error && !isLoading) setShowError(true);
    timer = setTimeout(() => {
      setShowError(false);
    }, 3000);

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

  return (
    <div className={styles['auth-container']}>
      {/* {succes message to user} */}
      {messageToUser && showMessageToUser && (
        <span className={styles['messageToUser__msg']}>{messageToUser}</span>
      )}
      {error && showError && (
        <p className={styles['auth-container__errorMsg']}>{error}</p>
      )}

      <h2 className={styles['auth-container__title']}>
        {isSignIn ? 'Sign In' : 'Sign Up'}
      </h2>

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
          onClick={toggleAuthMode}
        >
          {isSignIn
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>

        {/* <button type="button" className="auth-actions__google-button" onClick={handleGoogleSignIn}>
          Sign In with Google
        </button> */}
        {!googleSignInUrl && (
          <>
            <div className={styles['separator']}>
              <span>OR</span>
            </div>
            <button
              type='button'
              className={styles['google-signin-button']}
              // onClick={handleGoogleSignIn}
            >
              <GoogleLogo size={16} />
              Continue with Google
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthUI;
