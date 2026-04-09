// 📁 frontend/src/auth/auth_utils/authFetch.ts
/* ===============================
🔐 AUTHENTICATED FETCH - INFRASTRUCTURE LAYER
===============================
🔍 LAYER IDENTIFICATION:
- Layer: Infrastructure
- Purpose: Execute authenticated HTTP requests with silent token refresh

✅ Responsibilities:
- Inject Bearer token
- On 401, trigger single‑flight refresh and retry once
- Prevent infinite loops with _retry flag
- Exclude login/update/change-password endpoints from auto-refresh

❌ Never:
 - Navigate or show modals
 - Manage refresh state locally (delegated to manager)
 - Open modals
 - Show notification
*/

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getRefreshedToken } from './authRefreshManager';
import {
  url_update_user,
  url_change_password,
} from '../../endpoints';

/* 🔐 Authenticated fetch utility*/
/**
 * Makes an authenticated request.
 * On 401, attempts to refresh the token once and retries the request.
 */
export const authFetch = async <T>(
  url: string,
  options: AxiosRequestConfig = {},
): Promise<AxiosResponse<T>> => {
  // 1️⃣ Get access token from sessionStorage (Infrastructure)
  const accessToken = sessionStorage.getItem('accessToken');

  // 2️⃣ Prepare request config with token
  const requestConfig: AxiosRequestConfig & { _retry?: boolean } = {
    ...options,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
  };

  try {
    // 🎯 First attempt
    const response = await axios<T>(url, requestConfig);
    return response;
  } catch (error) {
    // 3️⃣ Handle 401 errors - avoid infinite retries, and skip specific endpoints
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      //✅ Exclude from refresh attempt
      !requestConfig._retry && // Prevents endless loops
      !url.includes('/sign-in') && // Login endpoint has no token
      !url.includes('/sign-up') && // Signup endpoint has no token
      !url.includes(url_update_user) && // Update profile handles 401 itself
      !url.includes(url_change_password) // Change password handles 401 itself
    ) {
      // Mark this request as already retried
      requestConfig._retry = true;

      try {
        // 4️⃣ Get a fresh token (shared across all concurrent requests)
        const newToken = await getRefreshedToken();

        // 5️⃣ Retry original request with the new token
        const retryConfig = {
          ...requestConfig,
          headers: {
            ...requestConfig.headers,
            Authorization: `Bearer ${newToken}`,
          },
        };

        const retryResponse = await axios<T>(url, retryConfig);
        return retryResponse;
      } catch (refreshError) {
        // 6️⃣ Refresh failed – propagate error; UI will redirect via ProtectedRoute
        // 🚨 Refresh failed - error log
        console.error('🚨 Refresh failed:', {
          error: refreshError,
          url,
          hasCookie: document.cookie.includes('refreshToken'),
        });

        // Return rejected promise so calling code knows it failed
        return Promise.reject(refreshError);
      }
    }

    // 7️⃣ Any other error (non‑401, or already retried) – just throw
    throw error;
  }
};
