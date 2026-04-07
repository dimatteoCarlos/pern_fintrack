// 📁 frontend/src/auth/authEvent/config/eventRegistry.ts

/* ===============================
📋 AUTH EVENT REGISTRY - Central configuration for all auth events
===============================
Each event handler receives:
- data: the payload (typed per event)
- ctx: read-only tools (getIdentity)

The handler returns an AuthEventResultType describing what should happen.
AuthPage (orchestrator) will execute the result.
*/

import {
  AuthEventMapType,
  AuthEventType,
  AuthEventResultType,
} from '../types/eventTypes';

import { AuthEventContextType } from '../types/eventContextTypes';
import { getIdentity } from '../../auth_utils/localStorageHandle/authStorage';

export type AuthEventHandlerType<EventKey extends AuthEventType> = (
  data?: AuthEventMapType[EventKey],
  ctx?: AuthEventContextType,
) => AuthEventResultType;

//-------------------------------
// Registry with all events (handlers return placeholders for now)
export const authEventRegistry: {
  [EventKey in AuthEventType]: AuthEventHandlerType<EventKey>;
} = {
  // password_changed event handler
  // Opens sign in modal with prefill if identity exists
  password_changed: () => {
    const identity = getIdentity(); //from authStorage
    const result: AuthEventResultType = { uiState: 'SIGN_IN' };

    if (identity?.email && identity?.username) {
      result.prefill = { email: identity.email, username: identity.username };
    }
    return result;
  },

  //session_expired event handler
  // - Opens sign in modal with expiration message
  // - Stores return path (from) for post-login redirect

  session_expired: (data) => {
    const result: AuthEventResultType = {
      uiState: 'SIGN_IN',
      message: 'Your session has expired. Please sign in again.',
    };

    if (data?.from) {
      result.returnTo = data.from;
    }
    return result;
  },

  /**
   * user_logged_out event handler
   * - Does NOT open any modal
   * - Only closes the modal (uiState IDLE)
   * - Toast is already shown in LogoMenuIcon before navigation
   */
  user_logged_out: () => {
    return {
      uiState: 'IDLE',
    };
  },
};
