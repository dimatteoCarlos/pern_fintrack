// src/auth/hooks/useAuth.ts

// Import  Zustand store
import { useAuthStore } from '../stores/useAuthStore.ts';
// For making POST requests to the backend
import useFetchPost from '../../hooks/useFetchPost';
// For programmatic navigation
import { url_signin, url_signup } from '../../endpoints';
import { useNavigate } from 'react-router-dom';
//API endpoint URLs
import {
  AuthResponseType,
  SignInCredentialsType,
  SignUpCredentialsType,
} from '../types/authTypes.ts';

// CUSTOM HOOK FOR AUTHENTICATION MANAGEMENT
const useAuth = () => {
  // Access state and actions from the auth store
  const {
    isAuthenticated,
    userData,
    isLoading,
    setIsLoading,
    error,
    setIsAuthenticated,
    setUserData,
    clearError,
    setError,
    successMessage,
    setSuccessMessage,
    clearSuccessMessage,
    showSignInModalOnLoad,
    setShowSignInModalOnLoad,
  } = useAuthStore();

  // Get the navigate function from React Router
  const navigateTo = useNavigate();

  // Use the custom useFetchPost hook for making API calls
  const { request: signupRequest } = useFetchPost<
    SignUpCredentialsType,
    AuthResponseType
  >();

  const { request: signinRequest } = useFetchPost<
    SignInCredentialsType,
    AuthResponseType
  >();

  // Asynchronous function to handle user sign-in
  const handleSignIn = async (credentials: SignInCredentialsType) => {
    // Clear any previous errors or success messages
    clearError();
    clearSuccessMessage();
    setIsLoading(true);

    // Attempt to sign in the user by calling the backend API
    const result = await signinRequest(url_signin, credentials);
    setIsLoading(false);
    // Check if the sign-in was successful (we received data)
    console.log('handleSignIn:', result);

    if (result?.data?.token && result?.data?.user) {
      // Store the access token in sessionStorage (for web context, temporary)
      sessionStorage.setItem('accessToken', result.data.token);

      // Update the authentication state in the Zustand store
      setUserData(result.data.user);
      setIsAuthenticated(true);

      // Set a success message for the user
      setSuccessMessage('Sign in successful!');

      // Navigate the user to the main application page
      navigateTo('/fintrack');

      return true; // Indicate successful sign-in
    } else if (result?.error) {
      setError(result.error || 'Sign up failed. Please try again.');

      // If there was an error, return false
      return false;
    }
    setError('Unexpected error during sign in.');
    return false; // Default return if no data or error
  };

  // Asynchronous function to handle user sign-up
  const handleSignUp = async (userData: SignUpCredentialsType) => {
    // Clear any previous errors or success messages
    clearError();
    clearSuccessMessage();
    setIsLoading(true);

    // Attempt to sign up the user by calling the backend API
    const result = await signupRequest(url_signup, userData);
    setIsLoading(false);
    // Check if the sign-up was successful (we received data potentially with a token and user)
    if (result?.data?.token && result?.data?.user) {
      // Store the access token in sessionStorage (for web context, temporary)
      sessionStorage.setItem('accessToken', result.data.token);
      // Update the authentication state in the Zustand store
      setUserData(result.data.user);
      setIsAuthenticated(true);
      // Set a success message for the user
      setSuccessMessage('Registration successful!');
      // Navigate the user to the main application page
      navigateTo('/fintrack');
      return true; // Indicate successful sign-up
    } else if (result?.error) {
      // If there was an error, return false
      setError(result.error || 'Sign up failed. Please try again.');
      return false;
    }
    setError('Unexpected error during sign up.');
    return false; // Default return if no data or error
  };

  // Asynchronous function to handle user sign-out
  const handleSignOut = async () => {
    // For web context, we simply clear the token from sessionStorage and reset the state
    sessionStorage.removeItem('accessToken');
    setUserData(null);
    setIsAuthenticated(false);
    setSuccessMessage('Sign out successful!');
    // Navigate the user back to the authentication page
    navigateTo('/auth');
  };
  //extract token from cookies (web)
  // Function to retrieve the 'accessToken' value from the browser's cookies

  // const getAccessTokenFromCookies = (): string | null => {
  //   const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
  //   return match ? decodeURIComponent(match[1]) : null;
  // };
  
  const getAccessTokenFromCookies = (): string | null => {
    // Define the name of the cookie we're looking for
    const name = 'accessToken=';

    // Decode the cookie string to handle special characters (e.g., %20 for space)
    // decodifica una cadena que ha sido codificada como URI (por ejemplo, usando encodeURIComponent()).
    const decodedCookie = decodeURIComponent(document.cookie);

    // Split the cookies into an array, each item is "key=value"
    const cookieArray = decodedCookie.split(';');

    // Loop through the cookies
    for (let i = 0; i < cookieArray.length; i++) {
      // Get the current cookie string
      const c = cookieArray[i].trimStart();

      // Check if the cookie starts with "accessToken="
      if (c.startsWith(name)) {
        // Return the value part of the cookie (after 'accessToken=')
        return c.substring(name.length, c.length).trim();
      }
    }

    // If not found, return null
    return null;
  };

    // Función para eliminar el token de las cookies (para logout en web)
    const clearAccessTokenFromCookies = () => {
      document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    };

  // Return the authentication state and action functions
  return {
    isAuthenticated,
    userData,
    isLoading,
    error,
    successMessage,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    clearError,
    clearSuccessMessage,
    showSignInModalOnLoad,
    setShowSignInModalOnLoad,
  };
};

export default useAuth;
