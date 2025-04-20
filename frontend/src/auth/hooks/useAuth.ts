// src/auth/hooks/useAuth.ts
import { useAuthStore } from '../stores/useAuthStore.ts'; // Import our Zustand store
import useFetchPost from '../../hooks/useFetchPost'; // For making POST requests to the backend
import { useNavigate } from 'react-router-dom'; // For programmatic navigation
import { url_signin, url_signup } from '../../endpoints'; // Our API endpoint URLs
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
    error,
    setIsAuthenticated,
    setUserData,
    clearError,
    setError,
    successMessage,
    setSuccessMessage,
    clearSuccessMessage,
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

  // const { request: signinRequest } = useFetchPost();

  // Asynchronous function to handle user sign-in
  const handleSignIn = async (credentials: SignInCredentialsType) => {
    // Clear any previous errors or success messages
    clearError();
    clearSuccessMessage();
    // Attempt to sign in the user by calling the backend API
    const result = await signinRequest(url_signin, credentials);
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
    // Attempt to sign up the user by calling the backend API
    const result = await signupRequest(url_signup, userData);

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
  };
};

export default useAuth;
