// 📁 frontend/src/auth/authEvent/types/eventTypes.ts

/* ===============================
   🎯 AUTH EVENT TYPES - Event-driven navigation (declarative)
   ===============================
   AuthEventMapType defines what data each authentication event carries.
   AuthEventType is the union of all event names.
   AuthEventResultType describes what should happen when an event is handled.
*/

import { AuthUIStateType } from '../../types/authTypes';

/**
 * AuthEventMapType - Data payload for each auth navigation event
 */
export type AuthEventMapType = {
  password_changed: Record<string, never>|undefined; // no data needed
  session_expired: { from?: string };
  user_logged_out: Record<string, never>|undefined;
};

/**
 * AuthEventType - Union of all event names
 */
export type AuthEventType = keyof AuthEventMapType;

/**
 * AuthEventResultType - Declarative description of what the handler wants to happen
 *
 * The handler does NOT execute anything. It only returns this object.
 * AuthPage (orchestrator) will execute the actions based on this result.
 */
export type AuthEventResultType = {
  // UI State changes
  uiState?: AuthUIStateType;
  message?: string | null;
  prefill?: { email?: string; username?: string };

  // Navigation
  navigation?: {
    to: string;
    replace?: boolean;
    state?: Record<string, unknown>;
  };

  // Session expiry specific (store return path)
  returnTo?: string | null;
};
