//📂 src/auth/stores/useAuthStore.ts
/* ===============================
   🔐 AUTH SESSION STORE - APPLICATION LAYER
   Volatile store (memory only) for authentication state
   ===============================*/
/*
🔍 LAYER IDENTIFICATION:
- Layer: Application/State
- Purpose: Manage authentication session state
- Persistence: NONE (volatile)

✅ Responsibilities:
- Track authentication status (isAuthenticated)
- Store user data (in memory only)
- Manage loading states
- Handle error/success messages for auth operations

❌ Never:
- Persist to localStorage (that's authStorage's job)
- Handle UI state (useAuthUIStore does that)
- Decide navigation
*/ 
import { create } from 'zustand';
import { AuthStoreStateType, UserDataType } from '../types/authTypes';

//-----------------------
// 🎯 Auth Store State
//-----------------------
//1. Create the Zustand store
export const useAuthStore = create<AuthStoreStateType<UserDataType>>(
 (set) => ({
 // 🔐 Authentication States
 isAuthenticated: false,
 setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
 
// 👤 User data (memory only)
  userData: null,
  setUserData: (userData) => set({ userData }),

// ⏳ Loading states
  isLoading: false,
  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  
// Loading state for initial session check (Silent Refresh)
  isCheckingAuth: true,
  setIsCheckingAuth: (isCheckingAuth: boolean) => set({ isCheckingAuth }), 

// ❌ Error handling
  error: null,
  setError: (error) => set({ error }),
// Action to clear unknown authentication errors
  clearError: () => set({ error: null }),
  
// ✅ Success messages 
  successMessage: '',
  setSuccessMessage: (successMessage) => set({ successMessage }),
  clearSuccessMessage: () => set({ successMessage: '' }),
  
 })) // set block

 // ✅ Debug in dev
if (import.meta.env.VITE_ENVIRONMENT === 'development') {
  useAuthStore.subscribe((state) => {
    console.log('🔧 AuthStore state:', {
      isAuthenticated: state.isAuthenticated,
      hasUserData: !!state.userData,
      isLoading: state.isLoading,
      error: state.error,
      successMessage: state.successMessage,
    });
  });
}


