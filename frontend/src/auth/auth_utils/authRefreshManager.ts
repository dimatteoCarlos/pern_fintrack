// 📁 frontend/src/auth/auth_utils/authRefreshManager.ts
/* ===============================
 🔄 AUTH REFRESH MANAGER - INFRASTRUCTURE LAYER
 ===============================
 🔍 LAYER IDENTIFICATION:
 - Layer: Infrastructure (Auth Utils)
 - Purpose: Centralize token refresh with single-flight pattern
 - Handle concurrent 401 responses efficiently
 
 ✅ Responsibilities:
 - Share a single refresh promise across concurrent 401s
 - On success: store new token, clear returnTo flags
 - On failure: save returnTo in sessionStorage, call invalidateSession('expired')
 
 ❌ Never:
 - Navigate or show UI messages
 - Save session_expired in storage (that's now in store)
*/

import axios from 'axios';
import { url_refreshToken } from '../../endpoints';
import { invalidateSession } from './invalidateSession';

// 🔒 Singleton promise – ensures only one refresh at a time
let refreshPromise: Promise<string> | null = null;

/**
 * Gets a fresh access token.
 * Multiple concurrent calls share the same promise (single‑flight).
 * @returns Promise<string> - new access token
 * @throws Error if refresh fails (network, invalid refresh token, etc.)
 */
export const getRefreshedToken = async (): Promise<string> => {
 console.log('[RefreshManager] ;getRefreshedToken called');
 
  if (!refreshPromise) {//Only the first caller creates the promise; others wait.
    refreshPromise = (async () => {
      try {
        // Call refresh endpoint with cookie (no manual token)
        const response = await axios.post(url_refreshToken, null, {
          withCredentials: true,
          timeout: 10000,
        });

        const newAccessToken = response.data?.accessToken;

        if (!newAccessToken) {
          throw new Error('No access token in refresh response');
        }

        // 💾 Save the new token for future requests
        sessionStorage.setItem('accessToken', newAccessToken);

        // Clear any leftover returnTo (no longer needed after successful refresh)
        sessionStorage.removeItem('returnTo');

        return newAccessToken;
      } catch (error) {
        // 🚨 Refresh failed – session is irrecoverable
        // 📍 Save current location to redirect after login (context, not signal)
        const currentPath = window.location.pathname + window.location.search; //return route page + query string parameters
        sessionStorage.setItem('returnTo', currentPath);
        
        // 🧹 Centralized session cleanup (storage + store, keeps remembered identity)
        invalidateSession('expired');

        // Re-throw so callers know refresh failed
        throw error;
      } finally {
        // Allow a new refresh cycle later (e.g., after login).
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};
