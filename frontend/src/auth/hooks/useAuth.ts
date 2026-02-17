// 📁 frontend/src/auth/hooks/useAuth.ts

/* 🌟 ===============================
   🔐 AUTH SERVICE HOOK
   Centralizes all authentication operations
   Single source of truth for auth logic
   =============================== 🌟 */

import { useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../stores/useAuthStore';
import { authFetch } from '../auth_utils/authFetch';
import { logoutCleanup } from '../auth_utils/logoutCleanup';
import { useNavigationHelper } from '../auth_utils/navigationHelper';
import { INITIAL_PAGE_ADDRESS, LOCAL_STORAGE_KEY } from '../../helpers/constants';

import {
  AuthSuccessResponseType,
  ChangePasswordResponseType,
  ChangePasswordResultType,
  ProfileUpdatePayloadType,
  ProfileUpdateResponseType,
  SignInCredentialsType,
  SignInResponseType,
  SignUpCredentialsType,
  UserDataType,
  UserResponseDataType,
} from '../types/authTypes';

import {
  url_signin,
  url_signup,
  url_signout,
  url_update_user,
  url_change_password,
  url_validate_session
} from '../../endpoints';

/* ===============================
   🛠️ DATA TRANSFORMATION
   =============================== */

const mapUserResponseToUserData = (user: UserResponseDataType): UserDataType => ({
  user_id: user.user_id,
  username: user.username,
  user_firstname: user.user_firstname,
  user_lastname: user.user_lastname,
  email: user.email,
  currency: user.currency,
  role: user.role,
  contact: user.user_contact,
});

/* ===============================
   🔧 ERROR EXTRACTION UTILITY
   =============================== */
// const extractErrorMessage = (err: unknown): string => {
//  //axios error with response

//   if (err && typeof err === 'object' && 'response' in err) {
//     const error = err as { response?: { data?: { message?: string } } };
//     if (error.response?.data?.message) {
//       return error.response.data.message;
//     }
//   }
//   if (err instanceof Error) {
//     return err.message;
//   }
//   return 'An unexpected error occurred';
// };
const extractErrorMessage = (err: unknown): string => {
  // If axios error with response
  if (axios.isAxiosError(err) && err.response) {
    const data = err.response.data as Record<string, unknown>;
//-----------------------------------------
console.log('extractErrorMessage:', data, err.stack)
//-----------------------------------------
    // Priority: BE error message
    if (data?.message && typeof data.message === 'string') {
      return data.message;
    }
    
    // Códigos de error comunes
    if (err.response.status === 401) {
      return 'Invalid username or password';
    }
    if (err.response.status === 400) {
      return 'Invalid input data';
    }
    if (err.response.status === 429) {
      return 'Too many attempts. Please try again later.';
    }
  }
  
  // Si es error de red
  if (axios.isAxiosError(err) && !err.response) {
   return 'Network error. Please check your connection.';
  }
  
  // Error genérico
  if (err instanceof Error) {
    return err.message;
  }
  
  return 'An unexpected error occurred';
};

/* ===============================
   🎯 MAIN HOOK: useAuth
   =============================== */

const useAuth = () => {
  const navigateTo = useNavigate();
  useNavigationHelper();

  const {
    isLoading, setIsLoading,
    isCheckingAuth, setIsCheckingAuth,
    isAuthenticated, setIsAuthenticated,
    userData, setUserData,
    error, setError, clearError,
    successMessage, setSuccessMessage, clearSuccessMessage,
    showSignInModalOnLoad, setShowSignInModalOnLoad,
  } = useAuthStore();

  /* ===============================
     🔄 SESSION INITIALIZATION
     =============================== */

  useEffect(() => {
    let isMounted = true;

    const checkAuthStatus = async () => {
      const accessToken = sessionStorage.getItem('accessToken');
      const isRemembered = localStorage.getItem(LOCAL_STORAGE_KEY.REMEMBER_ME) === 'true';

      if ((accessToken || isRemembered) && !error && !isLoading) {
        try {
          const response = await authFetch<AuthSuccessResponseType>(url_validate_session, { method: 'GET' });

          if (isMounted && response.data?.user) {
            setUserData(mapUserResponseToUserData(response.data.user));
            setIsAuthenticated(true);
            console.log('✅ Session restored successfully');
          }
        } catch (error) {
          if (isMounted) {
            console.warn('🔍 Session hydration failed');
          }
        }
      }

      if (isMounted) setIsCheckingAuth(false);
    };

    checkAuthStatus();

    return () => { isMounted = false };
  }, [setIsAuthenticated, setIsCheckingAuth, setUserData]);

  /* ===============================
     🔐 SIGN IN
     =============================== */

  const handleSignIn = async (credentials: SignInCredentialsType, rememberMe: boolean) => {
    clearError();
    setIsLoading(true);
    clearSuccessMessage();

    try {
      const response = await authFetch<SignInResponseType>(url_signin, {
        method: 'POST',
        data: credentials
      });

      const { accessToken, user, message, expiresIn } = response.data;

      if (expiresIn) {
        const expiryTime = Date.now() + (expiresIn * 1000);
        sessionStorage.setItem('tokenExpiry', expiryTime.toString());
      }

      const userDataFromResponse = response.data?.user || user;

      if (accessToken && userDataFromResponse) {
        sessionStorage.setItem('accessToken', accessToken);

        if (rememberMe) {
          localStorage.setItem(LOCAL_STORAGE_KEY.REMEMBER_ME, 'true');
        } else {
          localStorage.removeItem(LOCAL_STORAGE_KEY.REMEMBER_ME);
        }

        const userDataForStore = mapUserResponseToUserData(userDataFromResponse);
        setUserData(userDataForStore);
        setIsAuthenticated(true);
        setSuccessMessage(message || 'Sign in successful! Welcome back!');
        navigateTo(INITIAL_PAGE_ADDRESS || '/fintrack');
        return true;
      }

      const errorMessage = accessToken
        ? 'Server response missing user data'
        : 'Server response missing access token';
      setError(`Invalid server response - ${errorMessage}`);
      return false;

    } catch (err: unknown) {
      const errorMessage = extractErrorMessage(err) || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /* ===============================
     📝 SIGN UP
     =============================== */

  const handleSignUp = async (credentials: SignUpCredentialsType) => {
    clearError();
    clearSuccessMessage();
    setIsLoading(true);

    try {
      const response = await fetch(url_signup, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}. Registration failed.`);
      }

      const resData = await response.json();

      if (resData.accessToken) {
        sessionStorage.setItem('accessToken', resData.accessToken);
      }

      const userDataForStore = mapUserResponseToUserData(resData.user);
      setUserData(userDataForStore);
      setIsAuthenticated(true);
      setSuccessMessage(resData.message || 'Sign up successful!');
      navigateTo('/fintrack');
      return true;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /* ===============================
     🚪 SIGN OUT
     =============================== */

  const handleSignOut = async () => {
    try {
      await authFetch(url_signout, { method: 'POST' });
    } catch (err: unknown) {
      console.log('⚠️ Logout API call failed, proceeding with client cleanup');
    } finally {
      logoutCleanup(false);
    }
  };

  /* ===============================
     🔐 DOMAIN PASSWORD CHANGE (SINGLE SOURCE OF TRUTH)
     =============================== */
  const handleDomainChangePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<ChangePasswordResultType> => {
    try {
      const response = await authFetch<ChangePasswordResponseType>(url_change_password, {
        method: 'PATCH',
        data: { currentPassword, newPassword, confirmPassword }
      });

      const responseData = response.data;

      if (responseData.success === true) {
        return {
          success: true,
          message: responseData.message || 'Password updated successfully.',
        };
      }
    // 🔴 CONTROLLED BACKEND FAILURE
      return {
        success: false,
        error: responseData.error || 'ChangePasswordError',
        message: responseData.message ?? 'Password change failed',
        fieldErrors: responseData.fieldErrors ?? {},
        retryAfter: responseData.retryAfter,
      };

    } catch (err: unknown) {
    // 🛡️ Axios error with response
      // 🔐 401 – SESSION EXPIRED → logout
      if (axios.isAxiosError(err) && err.response) {
        const { status, data } = err.response;
        const errorData = data //as Record<string, unknown>;

        // 🔐 401 - TOKEN INVALID / EXPIRED (REAL LOGOUT)
        if (status === 401) {
          logoutCleanup(true);

          return {
           success: false,
           error: (errorData?.error as string) || 'SessionExpired',
           message: (errorData?.message as string) || 'Session expired. Please sign in again.',
          // fieldErrors: errorData?.fieldErrors //as Record<string, string[]> | undefined, //401 is not a field error
          };
        }

        // 🔒 403 – WRONG CURRENT PASSWORD (NO logout)
        if (status === 403) {
          return {
            success: false,
            error: (errorData?.error as string) || 'InvalidCurrentPassword',
            message: (errorData?.message as string) || 'Current password is incorrect.',
            fieldErrors: errorData?.fieldErrors as Record<string, string[]> | undefined,
          };
        }

        // 🚦 429 - RATE LIMIT
        if (status === 429) {
          return {
            success: false,
            error: (errorData?.error as string) || 'RateLimitExceeded',
            message: (errorData?.message as string) || 'Too many attempts. Please try again later.',
            fieldErrors: errorData?.fieldErrors as Record<string, string[]> | undefined,
            retryAfter: errorData?.retryAfter as number | undefined,
          };
        }

        // 🧪 400 - VALIDATION ERROR
        if (status === 400) {
          const details = errorData?.details as Record<string, unknown> | undefined;//detials is legacy
          return {
            success: false,
            error: (errorData?.error as string) || 'ValidationError',
            message: (errorData?.message as string) || 'Invalid input data.',
            fieldErrors: (details?.fieldErrors as Record<string, string[]>) || errorData?.fieldErrors as Record<string, string[]> | undefined,
          };
        }

        // ❌ Other HTTP errors (500, 502, etc.)
        return {
          success: false,
          error: (errorData?.error as string) || 'ChangePasswordFailed',
          message: (errorData?.message as string) || 'Failed to change password due to server error.',
          fieldErrors: errorData?.fieldErrors as Record<string, string[]> | undefined,
        };
      }

      // 🌐 Network error (no response)
      if (axios.isAxiosError(err) && !err.response) {
        return {
          success: false,
          error: 'NetworkError',
          message: 'Network error. Please check your connection.',
        };
      }

      // ❓ Unknown error (not axios)
      return {
        success: false,
        error: 'UnknownError',
        message: 'An unexpected error occurred.',
      };
    }
  };

  /* ===============================
     👤 UPDATE USER PROFILE
     =============================== */

  const handleUpdateUserProfile = async (payload: ProfileUpdatePayloadType) => {
    clearError();
    clearSuccessMessage();
    setIsLoading(true);

    try {
      const response = await authFetch<ProfileUpdateResponseType>(url_update_user, {
        method: 'PATCH',
        data: payload,
      });

      if (response.data.success) {
        setUserData(mapUserResponseToUserData(response.data.user) as UserDataType);
        setSuccessMessage(response.data.message || 'Profile updated successfully');
        return response.data;
      }

      setError(response.data.message);
      return response.data;

    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        const { status, data } = err.response;
        const errorData = data as Record<string, unknown>;

        // 🔐 401 - Session expired
        if (status === 401) {
          logoutCleanup(true);
          return {
            success: false,
            error: 'Session expired. Please login again.',
            sessionExpired: true,
          };
        }

        // 🚦 429 - Rate limit
        if (status === 429) {
          return {
            success: false,
            error: (errorData?.error as string) || 'RateLimitExceeded',
            message: (errorData?.message as string) || 'Too many requests. Please try again later.',
            retryAfter: errorData?.retryAfter as number | undefined,
          };
        }

        // 🧪 400 - Validation error
        if (status === 400) {
          const details = errorData?.details as Record<string, unknown> | undefined;
          return {
            success: false,
            error: (errorData?.message as string) || 'Invalid data provided',
            fieldErrors: details?.fieldErrors as Record<string, string[]> | undefined,
          };
        }
      }

      const errorMessage = extractErrorMessage(err) || 'Error updating profile';
      setError(errorMessage);
      return { success: false, error: errorMessage };

    } finally {
      setIsLoading(false);
    }
  };

  /* ===============================
     📤 HOOK RETURN
     =============================== */

  return {
    // Authentication State
    isAuthenticated,
    userData,
    isCheckingAuth,
    isLoading,
    error,
    successMessage,
    showSignInModalOnLoad,

    // Authentication Operations
    handleSignIn,
    handleSignUp,
    handleSignOut,
    handleUpdateUserProfile,
    handleDomainChangePassword,  // ✅Only source of truth of password changing

    // UI Control Actions
    clearError,
    clearSuccessMessage,
    setShowSignInModalOnLoad,
    setIsCheckingAuth,
  };
};

export default useAuth;