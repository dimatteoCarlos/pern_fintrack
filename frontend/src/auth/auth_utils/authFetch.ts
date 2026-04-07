// 📁 frontend/src/auth/auth_utils/authFetch.ts
/* ===============================
🔐 AUTHENTICATED FETCH - INFRASTRUCTURE LAYER
===============================
🔍 LAYER IDENTIFICATION:
- Layer: Infrastructure
- Purpose: Execute authenticated HTTP requests with token refresh

✅ Responsibilities:
- Inject Bearer token
- Handle silent refresh on 401
- Clean up session on refresh failure
- Dispatch UI events via store (without navigating)

❌ Never:
- Navigate directly (useNavigate is for UI layer)
- Open modals
- Show notification
*/

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { url_refrestoken, url_update_user, url_change_password } from '../../endpoints';
import { logoutCleanup } from './logoutCleanup';

//variables for refreshing lock
let isRefreshing = false;
let refreshPromise:Promise<string> | null = null;

/* 🔐 Authenticated fetch utility*/
export const authFetch = async <T>(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse<T>> => {

// 1️⃣ Get access token from sessionStorage (Infrastructure)
 const accessToken = sessionStorage.getItem('accessToken');

// 2️⃣ Configure initial request with token
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
// 🎯 First attempt
  const response = await axios<T>(url, requestConfig);
  return response;

 } catch (error) {
// 3️⃣ Handle 401 errors - attempt silent refresh
 if (
   axios.isAxiosError(error) && 
   error.response?.status === 401 && 
//✅ Exclude from refresh attempt
   !url.includes('/sign-in') &&
   !url.includes('/sign-up') &&
   !url.includes(url_update_user) && 
   !url.includes(url_change_password) 
   )
 {
  try {
   // ✅ Lock mechanism - only one refresh at a time
    if (!isRefreshing) {
     isRefreshing = true;
     refreshPromise = (async () => {
    // 🔄 Attempt silent refresh
      const refreshResponse = await axios.post(url_refrestoken, null, {
        withCredentials: true,
        timeout: 10000,
      });

     const newAccessToken = refreshResponse.data.accessToken;

     if (newAccessToken) {
     // 💾 Save new token
      sessionStorage.setItem('accessToken', newAccessToken);
      return newAccessToken;
     }
      throw new Error('No access token in refresh response');
     })();
    }//if not refreshing

 // Wait for refresh to complete
   const newAccessToken = await refreshPromise;

// 🔁 Retry original request with new token
  const retryConfig: AxiosRequestConfig = {
    ...requestConfig,
    headers: {
      ...requestConfig.headers,
      'Authorization': `Bearer ${newAccessToken}`,
    },
  };

  const retryResponse = await axios<T>(url, retryConfig);
  return retryResponse;
    } catch (refreshError) {
      // 🚨 Refresh failed - clean up session
       console.error('🚨 Refresh failed:', {
         error: refreshError,
         url,
         hasCookie: document.cookie.includes('refreshToken')
        });
        
     // ✅ Clean up session data - pure infrastructure, no navigation
        logoutCleanup();
              
     // Return rejected promise so calling code knows it failed
        return Promise.reject(refreshError);
      }finally {
      // ✅ Reset lock
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    // 4️⃣ Propagate all other errors
    throw error;
  }
};