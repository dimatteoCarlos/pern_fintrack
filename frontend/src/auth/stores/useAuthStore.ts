// src/auth/store/authStore.ts
import { create } from 'zustand';
import { AuthStateType, UserDataType } from '../types/authTypes';
// import { AuthStateType, SignInCredentialsType, UserDataType, UserResponseDataType } from '../types/authTypes';

// Define the state structure for authentication
interface AuthStoreStateType extends AuthStateType<UserDataType> {
  userAccess: string | null;
} // Specify UserDataType as the generic type

// Create the Zustand store for authentication
// type UserType = UserResponseDataType | UserDataType | SignInCredentialsType | SignUpCredentialsType

export const useAuthStore = create<AuthStoreStateType>((set) => ({
  isAuthenticated: false,
  userData: null,
  isLoading: false,
  error: null,
  userAccess: null,

  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  // Action to set the authentication status
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  // Action to set the user information
  setUserData: (userData: UserDataType | null) => set({ userData }),

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
