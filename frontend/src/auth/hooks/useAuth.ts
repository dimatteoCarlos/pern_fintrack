// src/auth/hooks/useAuth.ts
// ==========================
// 📦 IMPORT DEPENDENCIES
// ==========================
// React hooks & Routing
import { useEffect } from 'react';

// STATE ZUSTAND STORE MANAGEMENT
import { useAuthStore } from '../stores/useAuthStore.ts';

// AXIOS
import { AxiosRequestConfig } from 
'axios';

// FOR PROGRAMMATIC NAVIGATION
import { useNavigate } from 'react-router-dom';

//API ENDPOINT URLS
import { 
  url_signin,
  url_signup,
  url_signout,
  url_update_user,
  url_change_password,
  url_validate_session
  } from '../../endpoints';

// HTTP Client (UNIFIED - USED FOR ALL REQUESTS)
import { authFetch } from '../utils/authFetch.ts';


// UTILITIES & HELPERS
import { logoutCleanup } from '../utils/logoutCleanup.ts';
import { useNavigationHelper } from '../utils/navigationHelper.ts';
import { INITIAL_PAGE_ADDRESS, LOCAL_STORAGE_KEY } from '../../helpers/constants.ts';

// TYPESCRIPT DEFINITIONS
import {
 AuthSuccessResponseType,
 SignInCredentialsType,
 SignInResponseType,
 SignUpCredentialsType,
 UserDataType,
 UserResponseDataType,

} from '../types/authTypes.ts';
//----------------------------------
// =================================
// 🛠️ DATA TRANSFORMATION UTILITIES
// =================================
// Helper: Mapea respuesta del backend al tipo que se usa en el store
/**
 * Normalizes backend API response to match frontend store structure
 * @param user - Raw user object from backend API
 * @returns Standardized UserDataType for frontend consumption
 */

const mapUserResponseToUserData = (
  user: UserResponseDataType
): UserResponseDataType => ({
  user_id: user.user_id,
  username: user.username,
  user_firstname: user.user_firstname,
  user_lastname: user.user_lastname,
  email: user.email,
  currency:user.currency,
  role:user.role,
});
//UserDataType
// ========================
// 🔐 AUTHENTICATION HOOK
// ========================
// CUSTOM HOOK FOR AUTHENTICATION MANAGEMENT
/**
 * Central authentication hook providing:
 * - Session initialization with silent refresh
 * - Login, registration, and profile management
 * - Token and state management
 * Uses authFetch as the single HTTP client for consistency
 */
const useAuth = () => {
// Get the navigate function from React Router
   const navigateTo = useNavigate();
// ========================
// 🔧 HOOK INITIALIZATION
// ========================
// Navigation helper for protected routes
   useNavigationHelper();//R
// =================================
// 🏪 ZUSTAND STORE DESTRUCTURING
// =================================
// Access state and actions from the auth store
 const {
  // Loading States
   isLoading, setIsLoading,
   isCheckingAuth, setIsCheckingAuth, 

  // Authentication State 
  isAuthenticated, setIsAuthenticated,
  userData, setUserData,

  // User Interface Feedback
  error, setError, clearError,
  successMessage, setSuccessMessage,clearSuccessMessage,
  showSignInModalOnLoad, setShowSignInModalOnLoad,
  } = useAuthStore();

// =============================================
// 🔄 SESSION INITIALIZATION & SILENT REFRESH
// =============================================
/**
* On mount: Attempt to RESTORE USER SESSION if evidence exists
* (Remember Me flag or existing accessToken)
* Uses authFetch which will automatically handle token refresh if needed
*/
// revisar si el usuario ya estaba logueado cuando la página se carga (o se refresca), para que no tenga que volver a iniciar sesión manualmente

useEffect(() => {
 let isMounted = true;

 const checkAuthStatus = async()=>{
  const accessToken = sessionStorage.getItem('accessToken');
  const isRemembered = localStorage.getItem(LOCAL_STORAGE_KEY.REMEMBER_ME)==='true';

// 🟢 Only attempt restoration if there's evidence of a previous session
 if(accessToken || isRemembered){
  try {
// 🟢 USING authFetch (NOT fetch) - Enables automatic token refresh
  const response = await authFetch<AuthSuccessResponseType>(url_validate_session, {method:'GET'});//R
  console.log("🚀 ~ checkAuthStatus Validate Session ~ response:", response)

 // Prevent state updates if component unmounted during async operation
 if(isMounted && response.data?.user){
  setUserData(mapUserResponseToUserData(response.data.user));
  setIsAuthenticated(true);
  console.log('✅ Session restored successfully via silent refresh');
  }
} catch (error) {
// 🟢 SILENT FAIL: No session found or refresh failed
  if (isMounted) {console.warn('🔍 Session hydration failed - user will see login screen');
   }}
  }//restore previous session
// Always stop the global loading indicator  
  if (isMounted) setIsCheckingAuth(false);
  }
  
 checkAuthStatus();

// 🟢 CLEANUP: function prevents state updates after unmount (prevent memory leaks)
return () => { isMounted = false };
 }, [setIsAuthenticated, setIsCheckingAuth, setUserData]); 

// =====================================
// 🔧 TYPE-SAFE ERROR HANDLING UTILITY
// =====================================
//Extracts AxiosError or Regular error message
const extractErrorMessage =(err:unknown):string=>{
//Verify if error is from Axios
if(err && typeof err==='object' &&
 'response' in err &&
 err.response &&
 typeof err.response ==='object' &&
 'data' in err.response &&
 err.response.data  &&
 typeof err.response.data === 'object' &&
 'message' in err.response.data
){
  return String(err.response.data.message);
}

//Verify if is regular error instance
if(err instanceof Error){
 return err.message;
}
//Default fallback
return 'An unexpected error occurred';
}

// ==================================
// 👤 USER AUTHENTICATION OPERATIONS
// ==================================
/**
* Authenticates user with credentials
* @param credentials - Email and password
* @param rememberMe - Whether to persist login preference
* @returns Promise<boolean> indicating success
*/
// 🚨 4. SIGN IN 🚨
// Asynchronous function to handle user sign-in
  const handleSignIn = async (credentials: SignInCredentialsType,
  rememberMe:boolean) => {
    clearError();
    setIsLoading(true);
    clearSuccessMessage();//R

  try {
// ✅ USE AUTHFETCH FOR ALL HTTP REQUESTS
   // if normal fetch is used:
   // const response = await fetch(url_signin, {
   //  method:'POST',
   //  credentials:'include',
   //  headers:{
   //  'Content-Type':'application/json'},
   //  body:JSON.stringify(credentials),
   // });

   // if(!response.ok){
   //  const errorData = await response.json().catch(() => ({}));
   //  console.error('sign in error',Error(errorData.message || `HTTP error! status: ${response.status}`))
   //  throw new Error(errorData.message || `HTTP error! status: ${response.status}. Login failed`);
   // }
   // const data = await response.json()

   //El .catch() solo se encarga de devolver un objeto vacío ({}) en caso de que response.json() falle, para evitar un error

   const response = await authFetch<SignInResponseType>(url_signin, { 
   method: 'POST', 
   data: credentials 
   });
   console.log('response:', response.data);

   const { accessToken, user, message, expiresIn } = response.data;

   if(expiresIn){
    const expiryTime =Date.now()+(expiresIn*1000);
    sessionStorage.setItem('tokenExpiry', expiryTime.toString());
    console.log('tokenExpiry',Date.now(), expiresIn, new Date(expiryTime).toString())
   }

   const userDataFromResponse = response.data?.user || user;

// 🟢 VALIDATE response integrity before proceeding
   if (accessToken && userDataFromResponse) {
    //Store access token in session store(cleared on browser close)
    sessionStorage.setItem('accessToken', accessToken);
     
// Handle "Remember Me" preference
   if(rememberMe){
    localStorage.setItem(LOCAL_STORAGE_KEY.REMEMBER_ME, 'true');
    //userData was saved in useAuthStore
   }else {
    localStorage.removeItem(LOCAL_STORAGE_KEY.REMEMBER_ME ||'fintrack_remember_me');
   }
    // Nota: Los datos están en el Store para la sesión actual, 
    // pero al no haber bandera de 'remember_me', el useEffect de validación
    // los borrará si el usuario recarga y el accessToken (sessionStorage) expiró.
    // localStorage.removeItem(LOCAL_STORAGE_KEY.USER_DATA || 'fintrack_user_data');

// ✅ UPDATE APP STATES
    const userDataForStore = mapUserResponseToUserData(userDataFromResponse);
    console.log("🚀 ~ handleSignIn ~ userDataForStore:", userDataForStore);
    
    setUserData(userDataForStore);
    setIsAuthenticated(true);
    setSuccessMessage(message || 'Sign in successful!. Welcome back!');
    // setIsLoading(false);

// Redirect to main application area
    navigateTo(INITIAL_PAGE_ADDRESS || '/fintrack');//'/tracker/expense')
    return true;
  }
 // 🟢 SERVER RESPONSE VALIDATION: Missing required data
   const errorMessage = accessToken 
     ? 'Server response missing user data' 
     : 'Server response missing access token';
   setError(`Invalid server response - ${errorMessage}`);
   return false;
    
   }catch (err: unknown) {
// 🟢 CONSISTENT ERROR HANDLING: Same pattern for all authFetch calls
    const errorMessage = extractErrorMessage(err) || 'Login failed. Please check your credentials.';
    setError(errorMessage);
    return false;
    }finally {
      setIsLoading(false);
  }
 };

//----------------------------
  /**
   * Creates new user account
   * 
   * 🟢 USING authFetch (NOT fetch):
   * - No initial token needed for registration
   * - If backend returns token on registration, it's stored automatically
   * - Consistent with other operations
   * 
   * @param credentials - Registration data
   * @returns Promise<boolean> indicating success
   */
// 🚨 5. SIGN UP 🚨
// Asynchronous function to handle user sign-up
//---------------------------
//SIGN UP USING NORMAL FETCH
//---------------------------
  const handleSignUp = async (credentails: SignUpCredentialsType) => {
    // Clear any previous errors or success messages
    clearError();
    clearSuccessMessage();
    setIsLoading(true);

    try { 
// ✅ USE FETCH DIRECTLY WITH CREDENTIALS  
// Attempt to sign up the user by calling the backend API
    const response = await fetch(url_signup,{
      method:'POST',
      credentials:'include',//sent cookies
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(credentails),
    });

   if(!response.ok){
     const errorData = await response.json().catch(()=>({}));
      throw new Error(errorData.message || `HTTP error! status:${response.status}. Registration fialed.`);
   }
   const resData=await response.json();
   console.log("🚀 ~ handleSignUp ~ resData:", resData)

// ✅ SAVE ONLY ACCESS TOKEN (refreshToken goes in cookie automatically)
  if(resData.accessToken) sessionStorage.setItem('accessToken', resData.accessToken);

// ✅ UPDATE STATES
  const userDataForStore = mapUserResponseToUserData(resData.user);
  setUserData(userDataForStore);
  setIsAuthenticated(true);
  setSuccessMessage(resData.message||'Sign up successful!');
  setIsLoading(false);
  navigateTo('/fintrack');
  return true;
    } catch (err: unknown) {
      setIsLoading(false);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Registration failed';
      setError(errorMessage);
      return false;
    }
  };
 
//----------------------------
// 🚨 6. SIGN OUT (DELEGATED TO CLEANUP) 🚨
//version using normal fetch
  // Asynchronous function to handle user sign-out
//   const handleSignOut = async () => {
//    try {
//     // ✅ FETCH FOR LOGOUT
//     await fetch(url_signout, {
//       method:'POST',
//       credentials:'include',
//     })
//     } catch (error) {
//       console.log('Logout API error')
//     }finally{
// // ✅ SAFETY CLEANING
//    logoutCleanup(false);
//     }
// };
//========
//version using authFetch
const handleSignOut = async()=>{
 try {
  await authFetch(url_signout, {method:'POST'});

 } catch (err:unknown) {
  console.log('⚠️ Logout API call failed, proceeding with client cleanup');
  }finally {
   logoutCleanup(false);
  }
}
//------------------------------
// 7. CHANGE PASSWORD
//------------------------------
 /**
   * Changes user password with current password verification
   * 
   * 🟢 USING authFetch (NOT fetch):
   * - Protected route requires token
   * - Auto-refresh available if needed
   * 
   * @param currentPassword - For re-authentication
   * @param newPassword - New password to set
   * @param confirmPassword - Confirmation of new password
   * @returns Promise<boolean> indicating success
   */

  const handlePasswordChange = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    clearError();
    clearSuccessMessage();
    setIsLoading(true);
    try {
      const response = await authFetch<PasswordChangeResponseType>(url_change_password, {
        method: 'POST',
        data: { currentPassword, newPassword, confirmPassword }
      });

      setSuccessMessage(response.data.message || 'Password updated successfully!');
      return true;

   } catch (err: unknown) {
      const errorMessage = extractErrorMessage(err) || 'Password update failed. Please try again.';
       setError(errorMessage);
      return false;
      }finally {
        setIsLoading(false);
    }
  };

//------------------------
// 8. UPDATE USER PROFILE
//------------------------
  const handleUpdateUserProfile = async (profileData: { 
   firstname: string, lastname: string,
   contact: string
   // currency: string, 
   }) => {
    clearError();
    clearSuccessMessage();
    setIsLoading(true);

    try {
     const response = await authFetch<ProfileUpdateResponseType>(url_update_user, {
        method: 'PUT',
        data: profileData
      });
      // 🟢 PREFER server response for data accuracy
     if (response.data?.user) {
        setUserData(mapUserResponseToUserData(response.data.user) as UserDataType);
      }

     setSuccessMessage(response.data.message || 'Profile updated successfully!');
     return true;
    } catch (err: unknown) {
     // 🟢 IMPORTANT: 401 from this endpoint means "incorrect current password"
     const errorMessage = extractErrorMessage(err) || 'Error updating profile.'
        setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
//------------------------------
//9. function to use in components
//------------------------------
const authenticatedFetch = async (url: string, options: AxiosRequestConfig = {}) => {
  try {
    const response = await authFetch(url, options)
    return response
  } catch (error) {
    // Solo relanzamos si no es el error especial de logout forzado, ya que authFetch ya manejó la UI y la redirección.
    if (error instanceof Error && error.message === 'REFRESH_FAILED_LOGOUT_FORCED') {
    // No hacer nada, la limpieza ya fue hecha.
    throw error; 
    }
    console.log('Auth fetch error:', error)
    throw error;
  }
};

//------------------------------------
// Return the authentication state and action functions
return {
 // Authentication State
    isAuthenticated,
    userData,
    isCheckingAuth,

 // Loading States
    isLoading,

 // User Interface Feedback    
    error,
    successMessage,
    showSignInModalOnLoad,

// Authentication Operations
    handleSignIn,
    handleSignUp,
    handleSignOut,
    handleUpdateUserProfile,
    handlePasswordChange,

// UI Control Actions
    clearError,
    clearSuccessMessage,
    setShowSignInModalOnLoad,
    setIsCheckingAuth,

    authenticatedFetch

  };
};

export default useAuth;
