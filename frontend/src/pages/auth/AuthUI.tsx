import { useState } from 'react';
import { UserRolesType } from '../../types/userTypes';
import styles from './styles/AuthUI.module.css';
// import { useNavigate } from 'react-router-dom';

type CredentialsType = {
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  password: string;
  // role?: 'user' | 'admin' | 'super_admin';
  role?: UserRolesType;
};

//INITIAL STATES VALUES
const INITIAL_CREDENTIALS_STATE: CredentialsType = {
  username: '',
  email: '',
  user_firstname: '',
  user_lastname: '',
  role: 'user',
  password: '',
};

interface SignInCredentialsType {
  username?: string;
  email?: string;
  password: string;
}
interface SignUpCredentialsType extends SignInCredentialsType {
  user_firstname: string;
  user_lastname: string;
  role?: UserRolesType;
}
type AuthUIPropsType = {
  onSignIn: (credentials: SignInCredentialsType) => void;
  onSignUp: (userData: SignUpCredentialsType) => void;
  isSignInInitial?:boolean;

  googleSignInUrl?: string; // Optional Google Sign-in URL
  isLoading: boolean;
  error: string | null;
  messageToUser?: string | undefined | null;
};

//--MAIN COMPONENT
function AuthUI({
  onSignIn,
  onSignUp,
  googleSignInUrl,
  isLoading,
  error,
  messageToUser,
  isSignInInitial
}: AuthUIPropsType): JSX.Element {
  //--STATES
  const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS_STATE);

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

  return (
    <div className={styles['auth-container']}>
      {error && <p className={styles['auth-container__errorMsg']}>{error}</p>}

      <h2 className={styles['auth-container__title']}>
        {isSignIn ? 'Sign In' : 'Sign Up'}
      </h2>

      <form
        className={`auth-form ${
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
            Contraseña
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
            ? 'Do not have an account? Sign up'
            : 'Already have an account? Log in'}
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
              // onClick={handleGoogleSignIn}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 48 48'
                width='24'
                height='24'
              >
                {/* Google Icon SVG Path (same as in your Auth component) */}
                <path
                  fill='#EA4335'
                  d='M24 9.5c3.54 0 6.71 1.22 9.21 3.2l6.88-6.88c-5.86-5.28-13.5-8.2-22.09-8.2-17.21 0-31.28 14.07-31.28 31.28 0 11.59 8.14 22.73 19.73 28.93l-6.77-6.77c-3.91-2.76-6.11-7.08-6.11-11.96 0-8.02 5.84-14.62 13.8-14.62 2.25 0 4.42.61 6.33 1.64l4.73-4.73c-2.75-1.69-6.15-2.7-9.89-2.7-7.1 0-13.07 4.14-15.08 9.89l6.77 6.77c3.9-2.23 6.77-3.47 9.86-3.47 6.05 0 11.27 3.96 13.07 9l6.88 6.88c-3.14-5.33-7.96-8.69-13.07-8.69-11.59 0-21.27 9.67-21.27 21.27 0 11.59 9.67 21.27 21.27 21.27 11.59 0 21.27-9.67 21.27-21.27 0-5.18-2.06-9.86-5.86-13.5z'
                ></path>
              </svg>
              Continuar con Google
            </button>
          </>
        )}

        {/* Botón de Google Auth (lo añadiremos después con la lógica) */}
        {/* <button type="button" className="auth-actions__google-button">Iniciar sesión con Google</button> */}

        {/* {succes message to user} */}
        {messageToUser && (
          <span className={styles['messageToUser__msg']}>{messageToUser}</span>
        )}
      </div>
    </div>
  );
}

export default AuthUI;
