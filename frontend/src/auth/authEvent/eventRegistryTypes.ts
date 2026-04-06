// 📁 frontend/src/auth/authEvent/eventRegistryTypes.ts

/* ===============================
📋 AUTH EVENT REGISTRY - Central configuration for all auth events
===============================
Each event handler receives:
- data: the payload (typed per event)
- ctx: read-only tools (getIdentity)

The handler returns an AuthEventResultType describing what should happen.
AuthPage (orchestrator) will execute the result.
*/

import { AuthEventMapType, AuthEventType, AuthEventResultType } from './eventTypes';

import { AuthEventContextType } from './eventContextTypes';

export type AuthEventHandlerType<EventKey extends AuthEventType> = (
  data: AuthEventMapType[EventKey],
  ctx: AuthEventContextType
) => AuthEventResultType;

// Registry with all events (handlers return placeholders for now)
export const authEventRegistryType: {
  [EventKey in AuthEventType]: AuthEventHandlerType<EventKey>;
} = {
  password_changed: (_data, _ctx) => {
  console.log(_data, _ctx);
    // TODO: Implement in Commit 2
    return {};
  },
  session_expired: (_data, _ctx) => {
  console.log(_data, _ctx);
    // TODO: Implement in Commit 2
    return {};
  },
  user_logged_out: (_data, _ctx) => {
  console.log(_data, _ctx);   
    // TODO: Implement in Commit 2
    return {};
  },
};