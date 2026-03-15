// 📁 frontend/src/auth/stores/useAuthUIStore.ts

/* ===============================
   🎨 AUTH UI STATE MACHINE
   Centralized UX state for authentication module
   ===============================
🔍 LAYER IDENTIFICATION:
   - Layer: Application/State (UI Store)
   - Purpose: Manage authentication-related UI states
   - Scope: Modal visibility, messages, pre-filled data
   
   ✅ Responsibilities:
   - Track current UI state (IDLE, SESSION_EXPIRED, etc.)
   - Store global messages for user feedback
   - Remember pre-filled credentials for remembered users
   - Provide actions to update state from any component
   
   ❌ Never:
   - Handle session data (useAuthStore does that)
   - Make API calls
   - Validate forms
   - Navigate directly
*/
import { create } from 'zustand';
import { AuthUIStateType } from '../types/authTypes';
// 🎯 UI States for authentication experience

type AuthUIStoreType = {
// 🎯 Current UI state
  uiState: AuthUIStateType;
  
// 💬 Optional message (for success/error texts)
  message: string | null;
  
// 📝 Pre-filled data (from identity)
  prefilledEmail: string | null;
  prefilledUsername: string | null;
  
// 🎮 Actions
  setUIState: (state: AuthUIStateType) => void;
  setMessage: (message: string | null) => void;
  setPrefilledData: (email: string | null, username: string | null) => void;
  resetUI: () => void;
}

/**
* 🎨 AUTH UI STORE
* 
* Created with Zustand for simplicity and performance.
* Not persisted to localStorage - UI state is session-only.
*/
export const useAuthUIStore = create<AuthUIStoreType>()(
// No persistence - UI state should reset on page reload
 (set) => ({
// 🏁 Initial state
   uiState: 'IDLE',
   message: null,
   prefilledEmail: null,
   prefilledUsername: null,
    
// 🎮 Actions
   setUIState: (uiState) => set({ uiState }),
   setMessage: (message) => set({ message }),
   setPrefilledData: (email, username) => set({ 
      prefilledEmail: email, 
      prefilledUsername: username 
    }),
   resetUI: () => set({
      uiState: 'IDLE',
      message: null,
      prefilledEmail: null,
      prefilledUsername: null,
    }),
  })
);

// ✅ For debugging in development
if (import.meta.env.VITE_ENVIRONMENT === 'developmentX') {
  // Log state changes for debugging
  useAuthUIStore.subscribe((state) => {
    console.log('🔧 AuthUIStore state:', {
      uiState: state.uiState,
      message: state.message,
      hasPrefill: !!(state.prefilledEmail || state.prefilledUsername),
    });
  });
}