// 📁 frontend/src/auth/auth_utils/invalidateSession.ts
/* ===============================
 🧹 SESSION INVALIDATION - INFRASTRUCTURE LAYER
 ===============================
 🔍 LAYER IDENTIFICATION:
 - Layer: Infrastructure (Auth Utils)
 - Purpose: Single source of truth for clearing authentication state
 
 ✅ Responsibilities:
 - Remove access token and expiry from sessionStorage
 - Reset Zustand auth store (isAuthenticated, userData, errors, messages, loading flags)
 - Preserve persistent identity (remembered email/username) in localStorage for pre-fill
 - Idempotent: safe to call multiple times
 
 ❌ Never:
 - Handle navigation (that's ProtectedRoute's job)
 - Show UI messages (that's AuthPage's job)
 - Clear localStorage identity (that's for explicit logout only)
 - Touch useAuthUIStore (modal handling is separate)
*/

import { useAuthStore } from '../stores/useAuthStore';

export const invalidateSession = (): void => {
  // 1️⃣ Clean storage (only if token exists)
  const hasToken = sessionStorage.getItem('accessToken');
  if (hasToken) {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('tokenExpiry');
  }

  // 2️⃣ Reset Zustand store completely
  const authStore = useAuthStore.getState();

  // Core auth state
  authStore.setIsAuthenticated(false);
  authStore.setUserData(null);

  // UI state (if methods exist – safe call)
  if (authStore.clearError) authStore.clearError();
  if (authStore.clearSuccessMessage) authStore.clearSuccessMessage();

  // Loading flags – ensure UI doesn't stay in loading state
  authStore.setIsLoading(false);
  authStore.setIsCheckingAuth(false);

  console.log(
    '🧹 Session invalidated (storage + store reset, persistent identity kept)',
  );
};
