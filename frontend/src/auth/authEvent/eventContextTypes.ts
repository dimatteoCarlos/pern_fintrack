// 📁 frontend/src/auth/authEvent/eventContextTypes.ts

/* ===============================
   🔧 AUTH EVENT CONTEXT - Read-only tools for event handlers
   ===============================
   
   Injected by AuthPage, provides ONLY read-only functions.
   Handlers cannot execute actions directly; they must return a result.
*/

export type AuthEventContextType = {
// Read-only: get identity for prefill
  getIdentity: () => { email?: string; username?: string } | null;
};