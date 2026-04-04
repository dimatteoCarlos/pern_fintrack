// 📁 frontend/src/auth/auth_utils/logoutCleanup.ts

/* ===============================
   🧹 INFRASTRUCTURE LAYER - PURE CLEANUP FUNCTION
   ===============================
/**
 * 🧹 Pure infrastructure cleanup function
 * 
 * Layer: Infrastructure
 * Decisions: None - just execution
 * Side effects: Only storage and memory
 */

import { LOCAL_STORAGE_KEY } from '../../fintrack/helpers/constants';
import { useAuthStore } from '../stores/useAuthStore';
import { clearIdentity, getIdentity } from './localStorageHandle/authStorage';

//==========================
//MAIN FUNCTION: logoutCleanup
//==========================
export const logoutCleanup = (shouldNotify: boolean = false): void => {
  // Infrastructure can log for debugging (doesn't affect UX)
  console.log(
    `🔧 logoutCleanup executing - shouldNotify:${shouldNotify} (ignored)`,
  );

  // ===============================
  // 1️⃣ GET STORE ACTIONS (Infrastructure accessing state)
  // ===============================
  const { setIsAuthenticated, setUserData, clearError, clearSuccessMessage } =
    useAuthStore.getState();

  // ===============================
  // 2️⃣ CLEAN SESSION STORAGE (Volatile - Infrastructure)
  // ===============================
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('tokenExpiry');

  // ===============================
  // 3️⃣ RESET ZUSTAND STORE (Memory - Infrastructure)
  // ===============================
  setIsAuthenticated(false);
  clearError();
  clearSuccessMessage();

  // ===============================
  // 4️⃣ CONDITIONAL LOCALSTORAGE CLEANUP (Persistence - Infrastructure)
  // ===============================
  // 🔍 Read user's persistent decision from identity (Domain layer)
  // Infrastructure reads, but does not own, this data
  const identity = getIdentity();
  const shouldKeepData = identity?.rememberMe === true;

  if (!shouldKeepData) {
    setUserData(null);
    clearIdentity(); // Remove the identity entirely
    localStorage.removeItem(LOCAL_STORAGE_KEY.USER_DATA);
    console.log('🔧 Full cleanup: all persistent data removed');
  } else {
    // ✅ User wants to be remembered - keep identity for next visit
    console.log('🔧 Partial cleanup: keeping identity for next visit');
  }
};
