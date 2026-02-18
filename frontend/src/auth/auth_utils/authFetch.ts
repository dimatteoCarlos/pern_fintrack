// 📁 frontend/src/auth/auth_utils/authFetch.ts

/* ===============================
   🔐 AUTHENTICATED FETCH - INFRASTRUCTURE LAYER
   ===============================
   
   🔍 LAYER IDENTIFICATION:
   - Capa: Infraestructura
   - Propósito: Ejecutar peticiones HTTP con token y manejar refresh
   - Decisiones: Ninguna - solo ejecuta y propaga
   - Responsabilidades:
     * Inyectar token Bearer en headers
     * Intentar refresh automático en 401
     * Limpiar sesión si refresh falla
     * Propagar errores sin interpretarlos
   
   🚫 LO QUE NUNCA DEBE HACER:
     * Interpretar "sesión expirada" (eso es capa de Dominio)
     * Navegar (eso es capa de Aplicación)
     * Mostrar notificaciones (capa de Presentación)
   
   📍 UBICACIÓN CORRECTA:
     /auth_utils/ - utilitarios de infraestructura
*/

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { url_refrestoken, url_update_user, url_change_password } from '../../endpoints';
import { logoutCleanup } from './logoutCleanup';

/**
 * 🔐 Authenticated fetch utility
 * 
 * Layer: Infrastructure
 * 
 * ✅ Responsibilities:
 * - Inject Bearer token
 * - Handle silent refresh with HttpOnly cookies
 * - Clean up session on refresh failure
 * - Propagate errors for upper layers to interpret
 * 
 * ❌ Never:
 * - Interpret error meanings ("session expired" is Domain layer)
 * - Navigate or redirect (Application layer)
 * - Show notifications (Presentation layer)
 */
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
      !url.includes(url_update_user) && 
      !url.includes(url_change_password)
    ) {
      try {
        // 🔄 Attempt silent refresh
        const refreshResponse = await axios.post(url_refrestoken, null, {
          withCredentials: true,
          timeout: 10000,
        });

        const newAccessToken = refreshResponse.data.accessToken;

        if (newAccessToken) {
          // 💾 Save new token
          sessionStorage.setItem('accessToken', newAccessToken);

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
        }
      } catch (refreshError) {
        // 🚨 Refresh failed - clean up session
        console.error('🚨 Refresh failed:', {
          error: refreshError,
          url,
          hasCookie: document.cookie.includes('refreshToken')
        });
        
        // ✅ Clean up session data - pure infrastructure, no navigation
        logoutCleanup(false);
        
        // ✅ Propagate original error - NO interpretation here
        // The meaning ("session expired") is determined by Application layer (ProtectedRoute)
        throw refreshError;
      }
    }

    // 4️⃣ Propagate all other errors
    throw error;
  }
};