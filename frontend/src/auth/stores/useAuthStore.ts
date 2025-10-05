// src/auth/stores/useAuthStore.ts
import { create } from 'zustand';
import { AuthStateType, UserDataType } from '../types/authTypes';

// Define the state structure for authentication
interface AuthStoreStateType extends AuthStateType<UserDataType> {
  userAccess: string | null;
    isCheckingAuth?: boolean; 
    setIsCheckingAuth:(isCheckingAuth: boolean) => void
} // Specify UserDataType as the generic type

// Create the Zustand store for authentication
export const useAuthStore = create<AuthStoreStateType>((set) => ({
  userAccess: null,//verificar esto
  isLoading: false,
  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  
// Action to set the authentication status
  isAuthenticated: false,//
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  
// Action to set the user information
  userData: null,
  setUserData: (userData: UserDataType | null) => set({ userData }),
  
// Action to clear unknown authentication errors
  error: null,
  clearError: () => set({ error: null }),
  setError: (error) => set({ error }),

// state and Action to handle the success message and sign in modal used to force login when no authenticated

  successMessage: '',
  setSuccessMessage: (successMessage) => set({ successMessage }),
  clearSuccessMessage: () => set({ successMessage: '' }),

  showSignInModalOnLoad: false,
  setShowSignInModalOnLoad: (showSignInModalOnLoad) =>
    set({ showSignInModalOnLoad }),

//To indicate if session has finished
  isCheckingAuth: true,
  setIsCheckingAuth: (isCheckingAuth: boolean) => set({ isCheckingAuth }), 

}));

