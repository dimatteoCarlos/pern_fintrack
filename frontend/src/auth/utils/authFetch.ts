// src/utils/authFetch.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { url_refrestoken, url_update_user } from "../../endpoints";
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
    console.log("🚀 ~ authFetch ~ FIRST ATTEMPT SUCCESS:", url);
    return authFetchResponse;

  } catch (error) {
    // 3️⃣ HANDLE 401 UNAUTHORIZED ERRORS
    // Only attempt refresh if: it is a 401, NOT the profile update endpoint, and a valid Axios error
    if (
      axios.isAxiosError(error) && 
      error.response?.status === 401 && 
      !url.includes(url_update_user)
    ) {

      try {
        // 🔄 ATTEMPT SILENT REFRESH
        console.log('🔄 Session expired. Attempting silent refresh...');

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
          console.log('✅ Token refreshed. Request retried successfully.');

          return retryAuthFetchResponse;
        }
      } catch (refreshError) {
        // 🚨 REFRESH FAILED (Expired cookie, revoked session, or net error)
        console.error('🚨 Refresh failed - forcing logout cleanup:', {
          error: refreshError,
          url,
          hasCookie: document.cookie.includes('refreshToken')
        });
        
        // 🟢 Trigger global cleanup and notify user
        logoutCleanup(true);
        throw refreshError; 
      }
    }

    // 4️⃣ PROPAGATE NON-401 OR ALREADY HANDLED ERRORS
    // (This includes 400, 403, 500 or the 401 from Profile Update)
    throw error;
  }
};//authFetch

