// 📁 frontend/src/auth/auth_constants/constants.ts

/* ===============================
   🔐 AUTH MODULE CONSTANTS
   Centralized constants for authentication module
   Makes auth modular and reusable
   =============================== */

/**
 * 🧭 Authentication page route
 * Used throughout auth module and app for redirects
 */
export const AUTH_ROUTE = '/auth';

/**
 * 🔑 LocalStorage keys for auth persistence
 */
export const AUTH_STORAGE_KEYS = {
  IDENTITY: 'auth_identity',
  REMEMBER_ME: 'auth_remember_me', // Legacy - to be removed after migration
  USER_DATA: 'auth_user_data',
} as const;

/**
 * ⏱️ Auth related time constants (in milliseconds)
 */
export const AUTH_TIMEOUTS = {
  SUCCESS_REDIRECT: 5000,      // 5 seconds
  MESSAGE_DISPLAY: 5000,        // 5 seconds
  RATE_LIMIT_RESET: 60000,      // 1 minute
} as const;

/**
 * 📝 Auth mode types
 */
export const AUTH_MODES = {
  SIGN_IN: 'signin',
  SIGN_UP: 'signup',
} as const;

//used in authFetch
export const AUTH_UI_STATES = {
  IDLE: 'IDLE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  REMEMBERED_VISITOR: 'REMEMBERED_VISITOR',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
} as const;