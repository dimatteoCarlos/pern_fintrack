// src/auth/hooks/useAuth.ts
// IMPORT  ZUSTAND STORE
import { useAuthStore } from '../stores/useAuthStore.ts';
import { AxiosRequestConfig } from 
'axios';
// FOR PROGRAMMATIC NAVIGATION
import { useNavigate } from 'react-router-dom';
import { url_signin, url_signout, url_signup } from '../../endpoints';
import { useNavigationHelper } from '../utils/navigationHelper.ts';
//API ENDPOINT URLS
import {
  SignInCredentialsType,
  SignUpCredentialsType,
  UserDataType,
  UserResponseDataType,
} from '../types/authTypes.ts';
//-----------------------------------------------
import { useEffect } from 'react'
import { authFetch } from '../utils/authFetch.ts';
//----------------------------------
// Helper: Mapea respuesta del backend al tipo que se usa en el store
const mapUserResponseToUserData = (
  user: UserResponseDataType
): UserDataType => ({
  userId: user.user_id,
  username: user.username,
  user_firstname: user.user_firstname,
  user_lastname: user.user_lastname,
  email: user.email,
});

// CUSTOM HOOK FOR AUTHENTICATION MANAGEMENT
const useAuth = () => {
  // Access state and actions from the auth store
  const {
    isLoading,
    setIsLoading,
    error,
    setError,
    isAuthenticated,
    setIsAuthenticated,
    userData,
    setUserData,
    clearError,
    successMessage,
    setSuccessMessage,
    clearSuccessMessage,
    showSignInModalOnLoad,
    setShowSignInModalOnLoad,
    isCheckingAuth, 
    setIsCheckingAuth, 
    
  } = useAuthStore();

// Get the navigate function from React Router
  const navigateTo = useNavigate();

// 🚨 1. INICIALIZACIÓN DEL NAVIGATION HELPER 🚨
  // Este hook se encarga de que la función 'navigate' esté disponible globalmente.
  useNavigationHelper();  
// 🚨 2. LÓGICA DE HIDRATACIÓN DE SESIÓN (PERSISTENCIA) 🚨
  useEffect(() => {
    const checkAuthStatus = async () => {
    const accessToken = sessionStorage.getItem('accessToken');
      if (accessToken) {
      try {
        // 🚨 RUTA ACORDADA: Usamos una ruta protegida real para validar el token.
        const VALIDATION_URL = '/fintrack/tracker/expense'; 

        // authFetch se encarga de 401, refresh, y si falla, el logout y toast.authenticatedFetch
        const response = await authenticatedFetch(VALIDATION_URL, { method: 'GET' }); 
        
        if (response.status === 200) {
            // Si llega aquí, la sesión es válida o fue renovada.
            setIsAuthenticated(true);
            console.log('response' , response)
            // Opcional: Si el endpoint devuelve datos de usuario, llame a setUserData(data.user)
          }
      } catch (err) {
          // Si falla, authFetch ya realizó el cleanup y la redirección.
          console.warn('Fallo al validar token de persistencia o refresh. Sesión borrada.');
      }
    }
  
    // 🚨 3. FINALIZAR LA COMPROBACIÓN 🚨
      setIsCheckingAuth(false); 
    };

  // Disparar la comprobación inicial
  checkAuthStatus();
  }, [setIsAuthenticated, setIsCheckingAuth]);   
  
//----------------------------
// Asynchronous function to handle user sign-in
  const handleSignIn = async (credentials: SignInCredentialsType) => {
    clearError();
    clearSuccessMessage();
    setIsLoading(true);

  try {
// ✅ USE FETCH DIRECTLY WITH CREDENTIALS
    const response = await fetch(url_signin, {
      method:'POST',
      credentials:'include',
      headers:{
      'Content-Type':'application/json',
            },
      body:JSON.stringify(credentials)
    })  

    //El .catch() solo se encarga de devolver un objeto vacío ({}) en caso de que response.json() falle, para evitar un error

    if(!response.ok){
      const errorData = await response.json().catch(() => ({}));
      console.error('sign in error',Error(errorData.message || `HTTP error! status: ${response.status}`))

    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json()

// ✅ SAVE ONLY ACCESS TOKEN (refreshToken goes in cookie automatically)
   if (data.accessToken) {
        sessionStorage.setItem('accessToken', data.accessToken);
      }

// ✅ UPDATE STATES
    const userDataForStore = mapUserResponseToUserData(data.user);
    setUserData(userDataForStore)
    setIsAuthenticated(true)
    setSuccessMessage(data.message || 'Sign in successful!')
    setIsLoading(false);

    navigateTo('/fintrack');
    return true;

    } catch (err: unknown) {
      setIsLoading(false);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Login failed';
      setError(errorMessage);
      return false;
    }
  };

//----------------
// Asynchronous function to handle user sign-up
  const handleSignUp = async (userData: SignUpCredentialsType) => {
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
  headers:{
    'Content-Type':'application/json'
  },
  body:JSON.stringify(userData)
})
if(!response.ok){
  const errorData = await response.json().catch(()=>({}))
   throw new Error(errorData.message || `HTTP error! status:${response.status}`)
}

const data=await response.json()

// ✅ SAVE ONLY ACCESS TOKEN (refreshToken goes in cookie automatically)
if(data.accessToken){sessionStorage.setItem('accessToken', data.accessToken)}

// ✅ UPDATE STATES
  const userDataForStore = mapUserResponseToUserData(data.user)
  setUserData(userDataForStore)
  setIsAuthenticated(true)
  setSuccessMessage(data.message||'Sign up successful!')
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
  //---------------------------------
  // Asynchronous function to handle user sign-out
  const handleSignOut = async () => {
   try {
    // ✅ FETCH FOR LOGOUT
    await fetch(url_signout, {
      method:'POST',
      credentials:'include',
    })
    } catch (error) {
      console.log('Logout API call failed')
    }finally{
// ✅ SAFETY CLEANING
      sessionStorage.removeItem('accessToken');
      setIsAuthenticated(false);
      setUserData(null);

      setError(null);
      setSuccessMessage('Sign out successful!');
      setIsLoading(false);
    // Navigate the user back to the authentication page
      navigateTo('/auth');
    }
};
//---------------------------
// function to use in components
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
    isCheckingAuth,
    setIsCheckingAuth,
    authenticatedFetch

  };
};

export default useAuth;
