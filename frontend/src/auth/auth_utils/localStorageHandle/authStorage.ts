// 📁 frontend/src/auth/auth_utils/localStorageHandle/authStorage.ts
/* ===============================
   🗄️ AUTH STORAGE UTILITIES
   Pure functions for localStorage persistence
   Single source of truth for user identity
   =============================== */
import { UserIdentityType } from '../../types/authTypes';

/**
 * 🔑 LocalStorage keys for auth persistence
 */
const STORAGE_KEYS = {
  IDENTITY: 'auth_identity',
} as const;

/**
 * ✅ SAVE USER IDENTITY TO LOCALSTORAGE
 * 
 * @param identity - User identity data (identity, rememberMe flag)
 * @returns void
 * 
 * @example
 * saveIdentity({ identity: 'johndoe', rememberMe: true });
 */
export const saveIdentity = (identity: UserIdentityType): void => {
  try {
    const serialized = JSON.stringify(identity);
    localStorage.setItem(STORAGE_KEYS.IDENTITY, serialized);
  } catch (error) {
// Fail silently - localStorage is not critical for app functionality
    console.warn('⚠️ Failed to save identity to localStorage:', error);
  }
};

/**
 * 🔍 Retrieve user identity from localStorage
 * 
 * @returns UserIdentityType or null if not found or corrupted
 * 
 * @example
 * const identity = getIdentity();
 * if (identity) {
 *   // pre-fill login form
 * }
 */
export const getIdentity = (): UserIdentityType | null => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEYS.IDENTITY);
    if (!serialized) return null;
    
    const parsed = JSON.parse(serialized) as UserIdentityType;
    
    // ✅ Basic validation to ensure shape is correct.
    // An entry written before the single identity field carries email and
    // username instead, and fails this check, so it is cleaned up below.
    if (typeof parsed === 'object' &&
        parsed !== null &&
        'identity' in parsed &&
        'rememberMe' in parsed)//mark the checkbox in the form
     {
     return parsed;
     }
    
// Corrupted data - clean it up
    clearIdentity();
    // localStorage.removeItem(STORAGE_KEYS.IDENTITY);
    return null;
    
  } catch (error) {
// JSON parsing failed - clean up corrupted data
    console.warn('⚠️ Failed to parse identity from localStorage:', error);
    localStorage.removeItem(STORAGE_KEYS.IDENTITY);
    return null;
  }
};

/**
 * 🗑️ Clear user identity from localStorage
 * 
 * @returns void
 * 
 * @example
 * clearIdentity(); // Called on logout or when rememberMe is unchecked
 */
export const clearIdentity = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.IDENTITY);
  } catch (error) {
    console.warn('⚠️ Failed to clear identity from localStorage:', error);
  }
};

/**
 * 🔄 Check if user has remembered identity
 * 
 * @returns boolean indicating if identity exists
 * 
 * @example
 * const hasIdentity = hasRememberedIdentity();
 * if (hasIdentity) {
 *   // show "Welcome back" message
 * }
 */
export const hasRememberedIdentity = (): boolean => {
  return getIdentity() !== null;
};