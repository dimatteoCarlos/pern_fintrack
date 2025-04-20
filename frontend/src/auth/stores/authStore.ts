// src/auth/store/authStore.ts
import { create } from 'zustand';

// Define the state structure for authentication

type UserDataType = {
  user_id?: string;
  username: string;
  email: string;
  password: string;
  user_firstname: string;
  user_lastname: string;
};

interface AuthState {
  isAuthenticated: boolean;
  userData: UserDataType | null; // Define the type of your user object
  isLoading: boolean;
  error: string | null;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setUserData: (userData: UserDataType | null) => void;
  clearError: () => void;
}

// Create the Zustand store for authentication
export const useAuthStore = create<AuthState>((set) => ({
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
}));


