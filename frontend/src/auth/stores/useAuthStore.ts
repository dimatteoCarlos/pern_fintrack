// src/auth/stores/useAuthStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'; // middleware
import { LOCAL_STORAGE_KEY } from '../../helpers/constants';
import { AuthStateType, UserDataType } from '../types/authTypes';

// 1. Define the state structure for authentication
interface AuthStoreStateType extends AuthStateType<UserDataType> {
  userAccess: string | null;
  isCheckingAuth?: boolean; 
  setIsCheckingAuth:(isCheckingAuth: boolean) => void;
} // Specify UserDataType as the generic type

//2. Create the Zustand store with Persistence
export const useAuthStore = create<AuthStoreStateType>()(persist(
 (set) => ({
 // Authentication States
  userAccess: null,//verificar esto
  isLoading: false,
  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  
  // Action to set the authentication status
  isAuthenticated: false,
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  
  // Action to set the user information
  userData:  null,
  setUserData: (userData: UserDataType | null) => set({ userData }),
  
  // Action to clear unknown authentication errors
  error: null,
  clearError: () => set({ error: null }),
  setError: (error) => set({ error }),
  
  // state and action to handle the success message and sign in modal used to force login when no authenticated
  
  successMessage: '',
  setSuccessMessage: (successMessage) => set({ successMessage }),
  clearSuccessMessage: () => set({ successMessage: '' }),
  
  showSignInModalOnLoad: false,
  setShowSignInModalOnLoad: (showSignInModalOnLoad) =>
   set({ showSignInModalOnLoad }),
  
  // Loading state for initial session check (Silent Refresh)
  isCheckingAuth: true,
  setIsCheckingAuth: (isCheckingAuth: boolean) => set({ isCheckingAuth }), 
  
})// set block
, {
 // 3. Persistence Configuration
  name:LOCAL_STORAGE_KEY.USER_DATA || 'fintrack_user_data',
   storage:createJSONStorage(
  ()=>localStorage),//where to save it

 // 4. Critical: Selective Persistence 
  partialize:(state)=>{
   const isRemembered = localStorage.getItem(LOCAL_STORAGE_KEY.REMEMBER_ME)==='true';
 // If "Remember Me" is false, don't save anything to LocalStorage
  if(!isRemembered)return {};
  return {
   userData:state.userData
   ?
  {user_firstname:state.userData.user_firstname,
   user_lastname:state.userData.user_lastname
    }
   :null
    }
  },
 // 5. Rehydration Guard
 //Ensures that if the "Remember Me" flag is manually deleted, 
 // the store cleans itself during the next app load.
  onRehydrateStorage:()=>(state)=>{
   const isRemebered = localStorage.getItem(LOCAL_STORAGE_KEY.REMEMBER_ME)==='true';
   if(!isRemebered && state){
    state.setUserData(null);
     }
   }
  }
 )
);

