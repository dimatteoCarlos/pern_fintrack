//📂 src/utils/authFetch.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { url_change_password, url_refrestoken, url_update_user } from "../../endpoints";
import { logoutCleanup } from './logoutCleanup';

/**
 * 🎯 AUTHENTICATED FETCH UTILITY
 * ✅ Automatically injects Bearer token.
 * ✅ Handles Silent Refresh with HttpOnly cookies.
 * ✅ Timeout protection for refresh attempts.
 * ✅ Differentiates between expired sessions and profile update auth failures.
 * ✅ Network-resilient: Prevents unwanted logouts.
 */

export const authFetch = async <T>(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse<T>> => {

  // 1️⃣ PREPARE ACCESS TOKEN
  const accessToken = sessionStorage.getItem('accessToken');

  // 2️⃣ CONFIGURE INITIAL REQUEST
  const requestConfig: AxiosRequestConfig = {
    ...options,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
      ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
    }
  };

  try {
    // 🎯 FIRST ATTEMPT
    const authFetchResponse = await axios<T>(url, requestConfig);
    // console.log("🚀 ~ authFetch ~ FIRST ATTEMPT SUCCESS:", url);
    return authFetchResponse;

  } catch (error) {
  // 3️⃣ HANDLE 401 UNAUTHORIZED ERRORS
  // Only attempt refresh if: it is a 401, NOT the profile update endpoint, and a valid Axios error
    if (
      axios.isAxiosError(error) && 
      error.response?.status === 401 && 
      !url.includes(url_update_user)  && !url.includes(url_change_password)
    ) {
     try {
       // 🔄 ATTEMPT SILENT REFRESH
       // console.log('🔄 Session expired. Attempting silent refresh...');

       const refreshResponse = await axios.post(url_refrestoken, null, {
         withCredentials: true,
         timeout: 10000, // ⏱️ Prevent indefinite blocking
       });

       const newAccessToken = refreshResponse.data.accessToken;

       if (newAccessToken) {
         // 💾 SAVE NEW TOKEN IN SESSION STORAGE
         sessionStorage.setItem('accessToken', newAccessToken);

         // 🔁 PREPARE RETRY WITH IMMUTABLE CONFIG
         const retryConfig: AxiosRequestConfig = {
           ...requestConfig,
           headers: {
             ...requestConfig.headers,
             'Authorization': `Bearer ${newAccessToken}`,
           },
         };

         // 🔁 RETRY ORIGINAL REQUEST
         const retryAuthFetchResponse = await axios<T>(url, retryConfig);
         // console.log('✅ Token refreshed. Request retried successfully.');

         return retryAuthFetchResponse;
       }
     } catch (refreshError) {
       // 🚨 REFRESH FAILED (Expired cookie, revoked session, or net error)
       console.error('🚨 Refresh failed - forcing logout cleanup:', {
         error: refreshError,
         url,
         hasCookie: document.cookie.includes('refreshToken')
       });

 // 🔍 DETERMINE IF THIS IS A "REAL" SESSION EXPIRATION
 // Only trigger logout with notification if:
 // 1. This is NOT a login attempt (sign-in has its own error handling)
 // 2. This is NOT a password change flow (which expects token change)
 // 3. The user was previously authenticated (hasCookie or had token)

      const isLoginEndpoint = url.includes('/sign-in');
      const isPasswordChangeEndpoint = url.includes(url_change_password);
      const hadTokenBefore = !!sessionStorage.getItem('accessToken');
      const hasRefreshCookie = document.cookie.includes('refreshToken');

      if (!isLoginEndpoint && !isPasswordChangeEndpoint && (hadTokenBefore || hasRefreshCookie)) {
      console.log('🔴 Real session expired - triggering logout with notification');
//Only when the user WAS authenticated and it is NOT a special flow, is logoutCleanup(true) performed.
      logoutCleanup(true);
      } 
// ⚠️ EXPECTED 401 - Part of normal flow (login, password change)
       else {
       console.log('🟡 Expected 401 in normal flow - no notification needed');
       // Do NOT call logoutCleanup - let the calling function handle it
      }
       throw refreshError; 
     }
    }

    // 4️⃣ PROPAGATE NON-401 OR ALREADY HANDLED ERRORS
    // (This includes 400, 403, 500 or the 401 from Profile Update)
    throw error;
  }
};//authFetch

