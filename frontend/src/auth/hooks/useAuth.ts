// 📁 frontend/src/auth/hooks/useAuth.ts
/* 🌟 ===============================
🔐 AUTH SERVICE HOOK
Centralizes all authentication operations
Single source of truth for auth logic
=============================== 🌟 */
import { useEffect } from 'react';
import axios from 'axios';

import { useAuthStore } from '../stores/useAuthStore';
import { authFetch } from '../auth_utils/authFetch';


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
  UserIdentityType,
  UserResponseDataType,
} from '../types/authTypes';

import {
  url_signin,
  url_signup,
  url_signout,
  url_update_user,
  url_change_password,
  url_validate_session,
} from '../../endpoints';
import {
  clearIdentity,
  saveIdentity,
} from '../auth_utils/localStorageHandle/authStorage';
import { safeMergeUser } from '../auth_utils/safeMergeUser';
import { invalidateSession } from '../auth_utils/invalidateSession';
import { logoutCleanup } from '../auth_utils/logoutCleanup';

/* ===============================
   🛠️ DATA TRANSFORMATION
   =============================== */
//api response to frontend format
const mapUserResponseToUserData = (
  user: UserResponseDataType,
): UserDataType => ({
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
const extractErrorMessage = (err: unknown): string => {
  // If axios error with response
  if (axios.isAxiosError(err) && err.response) {
    const data = err.response.data as Record<string, unknown>;
//-------------------------------------
    console.log('extractErrorMessage:', data, err.stack);
//-------------------------------------
  // Priority: BE error message
    if (data?.message && typeof data.message === 'string') {
      return data.message;
    }

  // Common codes error
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

  // Network error
  if (axios.isAxiosError(err) && !err.response) {
    return 'Network error. Please check your connection.';
  }

  // Generic Error
  if (err instanceof Error) {
    return err.message;
  }

  return 'An unexpected error occurred';
};

/* ===============================
  🎯 MAIN HOOK: useAuth
  =============================== */

const useAuth = () => {
  // const navigateTo = useNavigate();
  // useNavigationHelper();

  const {
    isLoading,
    setIsLoading,
    isCheckingAuth,
    setIsCheckingAuth,
    isAuthenticated,
    setIsAuthenticated,
    userData,
    setUserData,
    error,
    setError,
    clearError,
    successMessage,
    setSuccessMessage,
    clearSuccessMessage,
  } = useAuthStore();

  /* ===============================
 🔄 SESSION INITIALIZATION
 =============================== */
  useEffect(() => {
    let isMounted = true;

    const checkAuthStatus = async () => {
      const accessToken = sessionStorage.getItem('accessToken');

      if (!accessToken) {
        setIsCheckingAuth(false);
        return;
      }

      if (accessToken && !isAuthenticated) {
        try {
          const response = await authFetch<AuthSuccessResponseType>(
            url_validate_session,
            { method: 'GET' },
          );
          //----------------------
          // console.log('🚀 ~ checkAuthStatus ~ response:', response);
          //----------------------
          if (isMounted && response.data?.user) {
            // ✅ Transform and merge user data on session restore
            const transformedUser = mapUserResponseToUserData(
              response.data.user,
            );

            //Get current store state before
            const currentUserData = useAuthStore.getState().userData;

            //update user data: current + api
            const mergedUser = safeMergeUser(currentUserData, transformedUser);

            setUserData(mergedUser);
            setIsAuthenticated(true);
            console.log('✅ Session restored successfully');
          }
        } catch (error) {
         if (isMounted) {
          console.warn('🔍 Session hydration failed');
      // ✅ Clean up inconsistent state
          invalidateSession();
          }
        }
      }
      if (isMounted) setIsCheckingAuth(false);
    };

    checkAuthStatus();

    return () => {
      isMounted = false;
    };
  }, [
    setIsAuthenticated,
    setIsCheckingAuth,
    error,
    isLoading,
    setUserData,
    isAuthenticated,
  ]);
  //-------------
  // console.log("user data:", userData)

  /* ===============================
🔐 SIGN IN – DOMAIN LAYER (PURE)
=============================== */
  /**
   * Authenticates a user with email/username and password.
   *
   * ✅ Responsibilities:
   * - Call signin API
   * - Store token and expiry
   * - Persist identity if rememberMe is true
   * - Update global auth state (user, authenticated)
   * - Return success/error result
   *
   * ❌ Never:
   * - Navigate (presentation layer decides)
   * - Show toasts/modals (UI layer)
   */
  const handleSignIn = async (
    credentials: SignInCredentialsType,
    rememberMe: boolean,
  ): Promise<{ success: boolean; error?: string }> => {
    clearError();
    setIsLoading(true);
    clearSuccessMessage();

    try {
      const response = await authFetch<SignInResponseType>(url_signin, {
        method: 'POST',
        data: credentials,
      });

      const { accessToken, user, message, expiresIn } = response.data;

      const userFromSignIn = response.data?.user || user;

      //check data
      if (!accessToken || !userFromSignIn) {
        const errorMessage = !accessToken
          ? 'Server response missing access token'
          : 'Server response missing user data';
        throw new Error(errorMessage);
      }

      // processing expiresIn
      if (expiresIn) {
        const expiryTime = Date.now() + expiresIn * 1000;
        sessionStorage.setItem('tokenExpiry', expiryTime.toString());
        //-------------
        console.log('token expiration:', new Date(expiryTime));
      }

      // if (accessToken && userFromSignIn) {
      sessionStorage.setItem('accessToken', accessToken);

      // ✅ Persist identity if rememberMe is true
      if (rememberMe) {
        const identity: UserIdentityType = {
          email: credentials.email,
          username: credentials.username,
          rememberMe: true,
        };

        saveIdentity(identity);
        console.log('✅ Identity saved for remembered user');
      } else {
        clearIdentity();
        console.log('🧹 Identity cleared');
      }

      // ✅ Transform and merge user data
      const transformedUser = mapUserResponseToUserData(userFromSignIn);

      // Get current user data store
      const currentUserDataStore = useAuthStore.getState().userData;

      const mergedUser = safeMergeUser(currentUserDataStore, transformedUser);
      setUserData(mergedUser); //to store

      setIsAuthenticated(true);
      setSuccessMessage(message || 'Sign in successful! Welcome back!');

      return { success: true };
      // navigateTo(INITIAL_PAGE_ADDRESS || '/fintrack');
      // }
    } catch (err: unknown) {
      const errorMessage =
        extractErrorMessage(err) ||
        'Login failed. Please check your credentials.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /* ===============================
   📝 SIGN UP – DOMAIN LAYER (PURE)
 =============================== */
  /**
   * Registers a new user.
   *
   * ✅ Responsibilities:
   * - Call signup API
   * - Store token if provided
   * - Update global auth state (user, authenticated)
   * - Return success/error result
   *
   * ❌ Never:
   * - Navigate (presentation layer decides)
   * - Show toasts/modals (UI layer)
   */
  const handleSignUp = async (
    credentials: SignUpCredentialsType,
  ): Promise<{ success: boolean; error?: string }> => {
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
        throw new Error(
          errorData.message ||
            `HTTP error! status: ${response.status}. Registration failed.`,
        );
      }

      const resData = await response.json();

      //verify user exists
      if (!resData.user) {
        throw new Error('Server response missing user data');
      }

      if (resData.accessToken) {
        sessionStorage.setItem('accessToken', resData.accessToken);
      }
      // ✅ Transform and merge user data
      const transformedUser = mapUserResponseToUserData(resData.user);

      //Get user data from store
      const currentUserDataStore = useAuthStore.getState().userData;

      const mergedUser = safeMergeUser(currentUserDataStore, transformedUser);
      setUserData(mergedUser);

      setIsAuthenticated(true);
      setSuccessMessage(resData.message || 'Sign up successful!');

      // navigateTo('/fintrack');
      // ✅ NO navigation - return success
      return { success: true };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /* ===============================
     🚪 SIGN OUT
     =============================== */
  /**
   * 🚪 Manual logout - user initiated
   *
   * 🔍 LAYER IDENTIFICATION:
   * - Layer: Application/Orchestration
   * - Purpose: Handle explicit user logout action
   * - - Decisions: None (pure cleanup, no navigation)
   *
   * ✅ Responsibilities:
   * - Call logout API
   * - Clean up session data (via infrastructure)
   *
   * ❌ Never:
   * - Navigate (UI component decides)
   * - Handle automatic session expiration (ProtectedRoute does that)
   * - Show notifications (Presentation layer)
   * - Interpret error meanings (Domain layer)
   */
  const handleSignOut = async (): Promise<void> => {
    try {
      // Infrastructure layer - API call
      await authFetch(url_signout, { method: 'POST' });
    } catch (err: unknown) {
      // Infrastructure error - log but proceed with cleanup
      console.log('⚠️ Logout API call failed, proceeding with client cleanup');
    } finally {
      // 1️⃣ Infrastructure layer - clean up session data
      logoutCleanup();
    }
  };
  /* ===============================
     🔐 DOMAIN PASSWORD CHANGE (SINGLE SOURCE OF TRUTH)
     =============================== */
  const handleDomainChangePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<ChangePasswordResultType> => {
    try {
      const response = await authFetch<ChangePasswordResponseType>(
        url_change_password,
        {
          method: 'PATCH',
          data: { currentPassword, newPassword, confirmPassword },
        },
      );

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
        const errorData = data; //as Record<string, unknown>;

        // 🔐 401 - TOKEN INVALID / EXPIRED (REAL LOGOUT)
        if (status === 401) {
          invalidateSession();

          return {
            success: false,
            error: (errorData?.error as string) || 'SessionExpired',
            message:
              (errorData?.message as string) ||
              'Session expired. Please sign in again.',
          };
        }

        // 🔒 403 – WRONG CURRENT PASSWORD (NO logout)
        if (status === 403) {
          return {
            success: false,
            error: (errorData?.error as string) || 'InvalidCurrentPassword',
            message:
              (errorData?.message as string) ||
              'Current password is incorrect.',
            fieldErrors: errorData?.fieldErrors as
              | Record<string, string[]>
              | undefined,
          };
        }

        // 🚦 429 - RATE LIMIT
        if (status === 429) {
          return {
            success: false,
            error: (errorData?.error as string) || 'RateLimitExceeded',
            message:
              (errorData?.message as string) ||
              'Too many attempts. Please try again later.',
            fieldErrors: errorData?.fieldErrors as Record<string, string[]>,
            retryAfter: errorData?.retryAfter as number,
          };
        }

        // 🧪 400 - VALIDATION ERROR
        if (status === 400) {
          const details = errorData?.details as
            | Record<string, unknown>
            | undefined; //detials is legacy
          return {
            success: false,
            error: (errorData?.error as string) || 'ValidationError',
            message: (errorData?.message as string) || 'Invalid input data.',
            fieldErrors:
              (details?.fieldErrors as Record<string, string[]>) ||
              (errorData?.fieldErrors as Record<string, string[]> | undefined),
          };
        }

        // ❌ Other HTTP errors (500, 502, etc.)
        return {
          success: false,
          error: (errorData?.error as string) || 'ChangePasswordFailed',
          message:
            (errorData?.message as string) ||
            'Failed to change password due to server error.',
          fieldErrors: errorData?.fieldErrors as
            | Record<string, string[]>
            | undefined,
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
      const response = await authFetch<ProfileUpdateResponseType>(
        url_update_user,
        {
          method: 'PATCH',
          data: payload,
        },
      );

      if (response.data.success) {
        // 1️⃣ Get current store state before updating
        const currentUserData = useAuthStore.getState().userData;

        // 2️⃣ Map response
        const mappedNewData = mapUserResponseToUserData(response.data.user);
        //validation for backend user response
        if (!mappedNewData || typeof mappedNewData !== 'object') {
          console.error(
            '❌ Invalid user data from backend:',
            response.data.user,
          );

          throw new Error('Invalid user data from backend');
        }

        // 3️⃣ ATOMIC MERGE
        //safeMergeUser get the current store state and merge it with api response
        const finalUserData = safeMergeUser(currentUserData, mappedNewData);

        setUserData(finalUserData);

        setSuccessMessage(
          response.data.message || 'Profile updated successfully',
        );

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
          invalidateSession();

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
            message:
              (errorData?.message as string) ||
              'Too many requests. Please try again later.',
            retryAfter: errorData?.retryAfter as number | undefined,
          };
        }

        // 🧪 400 - Validation error
        if (status === 400) {
          const details = errorData?.details as
            | Record<string, unknown>
            | undefined;
          return {
            success: false,
            error: (errorData?.message as string) || 'Invalid data provided',
            fieldErrors: details?.fieldErrors as
              | Record<string, string[]>
              | undefined,
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

    // Authentication Operations
    handleSignIn,
    handleSignUp,
    handleSignOut,
    handleUpdateUserProfile,
    handleDomainChangePassword, // ✅Only source of truth of password changing

    // UI Control Actions
    clearError,
    clearSuccessMessage,
    setIsCheckingAuth,
  };
};

export default useAuth;
