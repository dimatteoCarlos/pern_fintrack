// src/auth/store/authStore.ts
import { create } from 'zustand';
import { UserDataType } from '../types/authTypes';

// Define the state structure for authentication

interface AuthStateType {
  isAuthenticated: boolean;
  userData: UserDataType | null;
  isLoading: boolean;
  error: string | null;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setUserData: (userData: UserDataType | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  successMessage: string | null;
  setSuccessMessage: (successMessage: string | null) => void;
  clearSuccessMessage: () => void;
}

// Create the Zustand store for authentication
export const useAuthStore = create<AuthStateType>((set) => ({
  isAuthenticated: false,
  userData: null,
  isLoading: false,
  error: null,
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
}));
