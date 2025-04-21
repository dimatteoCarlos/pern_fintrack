// src/auth/store/authStore.ts
import { create } from 'zustand';
import { AuthStateType } from '../types/authTypes';

// Define the state structure for authentication

// Create the Zustand store for authentication
export const useAuthStore = create<AuthStateType>((set) => ({
  isAuthenticated: false,
  userData: null,
  isLoading: false,
  error: null,
  setIsLoading:(isLoading:boolean)=>set({isLoading})
  ,
  // Action to set the authentication status
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  // Action to set the user information
  setUserData: (userData) => set({ userData }),

  // Action to clear unknown authentication errors
  clearError: () => set({ error: null }),
  setError: (error) => set({ error }),

  successMessage: '',
  setSuccessMessage: (successMessage) => set({ successMessage }),
  clearSuccessMessage: () => set({ successMessage: null }),

  showSignInModalOnLoad: false,
  setShowSignInModalOnLoad: (showSignInModalOnLoad) =>
    set({ showSignInModalOnLoad }),
}));
