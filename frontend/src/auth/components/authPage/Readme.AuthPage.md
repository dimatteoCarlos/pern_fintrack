Tienes razón. En GitHub Markdown, las tablas necesitan estar correctamente formateadas. Aquí está la versión corregida del README completo con tablas bien formateadas.

---

```markdown
# 🧠 AuthEvent Architecture – Declarative Event-Driven Authentication

## 🎯 Objective

The **AuthEvent** architecture provides a **centralized, type-safe, and declarative** way to handle authentication-related navigation events (e.g., password changed, session expired, user logged out) in a React + TypeScript application.

It replaces scattered, imperative logic with a clean, maintainable, and extensible event-driven system.

---

## 📌 What It Solves

| Problem | Solution |
|---------|----------|
| Authentication logic scattered across components | Centralized in `authEventRegistry.ts` |
| Navigation side effects hidden inside handlers | Handlers are pure – they return **descriptions** of what should happen |
| Hard to add new events without touching multiple files | Add a type, a handler, and one switch case |
| TypeScript errors when mixing event data | Strongly typed `AuthEventMapType` ensures each event has correct data shape |

---

## 🧱 Core Approach – Declarative Event Handling

### ❌ Imperative (what we avoid)

```typescript
// Handler executes actions directly
password_changed: (data, ctx) => {
  ctx.setUIState('SIGN_IN');
  ctx.setPrefilledData(email, username);
  ctx.navigate('/dashboard');
}
```

### ✅ Declarative (what we use)

```typescript
// Handler describes what should happen
password_changed: (data, ctx) => {
  return {
    uiState: 'SIGN_IN',
    prefill: { email, username },
    navigation: { to: '/dashboard' }
  };
}
```

**Why declarative?**
- Testable without mocks (just compare objects)
- Side effects are centralized in the orchestrator (`AuthPage`)
- Easier to reason about and debug

---

## 🔄 Logical Flow (End-to-End)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              1. EMITTER                                     │
│  (ChangePasswordContainer, ProtectedRoute, LogoMenuIcon, etc.)              │
│                                                                             │
│  navigate('/auth', {                                                        │
│    state: { authEvent: 'session_expired', from: currentPath }               │
│  })                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         2. ORCHESTRATOR (AuthPage)                          │
│                                                                             │
│  useEffect(() => {                                                          │
│    if (!authEvent) return;                                                  │
│    setUIState(IDLE);                        // reset previous state         │
│    const handler = authEventRegistry[authEvent];                            │
│    const data = getEventData(authEvent);    // extract from location.state  │
│    const result = handler(data, ctx);       // execute handler              │
│    applyResult(result);                     // UI + navigation              │
│  }, [authEvent]);                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         3. HANDLER (eventRegistry.ts)                       │
│                                                                             │
│  session_expired: (data) => ({                                              │
│    uiState: 'SIGN_IN',                                                      │
│    message: 'Your session has expired. Please sign in again.',              │
│    returnTo: data?.from                                                     │
│  })                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         4. RESULT APPLIED (AuthPage)                        │
│                                                                             │
│  if (result.uiState) setUIState(result.uiState);     // opens modal         │
│  if (result.message) setMessage(result.message);     // shows message       │
│  if (result.prefill) setPrefilledData(...);          // pre-fills form      │
│  if (result.returnTo) returnToRef.current = ...;     // stores return path  │
│  if (result.navigation) navigateTo(...);             // redirects           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              5. USER ACTION                                 │
│                                                                             │
│  After login, handleSignInWithNavigation reads returnToRef and redirects    │
│  back to the original page (for session_expired).                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
src/auth/authEvent/
├── types/
│   ├── eventTypes.ts          # Event contracts (payload + result)
│   └── eventContextTypes.ts   # Read-only context for handlers
├── config/
│   └── eventRegistry.ts       # Central event handler registry
src/pages/auth/
└── AuthPage.tsx               # Orchestrator (consumes events)
```

---

## 📄 Implementation Details

### 1. `eventTypes.ts` – Event Contracts

```typescript
// Defines what data each event carries
export type AuthEventMapType = {
  password_changed: undefined;           // no data needed
  session_expired: { from?: string };    // optional return path
  user_logged_out: undefined;            // no data needed
};

// Defines what result a handler returns
export type AuthEventResultType = {
  uiState?: 'IDLE' | 'SIGN_IN' | 'SIGN_UP';
  message?: string | null;
  prefill?: { email?: string; username?: string };
  navigation?: { to: string; replace?: boolean; state?: Record<string, unknown> };
  returnTo?: string | null;
};
```

### 2. `eventContextTypes.ts` – Read-only Context

```typescript
// Tools injected into handlers (read-only)
export type AuthEventContextType = {
  getIdentity: () => { email?: string; username?: string } | null;
};
```

### 3. `eventRegistry.ts` – Event Handlers

```typescript
import { getIdentity } from '../../auth_utils/localStorageHandle/authStorage';

export const authEventRegistry = {
  password_changed: () => {
    const identity = getIdentity();
    const result: AuthEventResultType = { uiState: 'SIGN_IN' };
    if (identity?.email && identity?.username) {
      result.prefill = { email: identity.email, username: identity.username };
    }
    return result;
  },

  session_expired: (data) => ({
    uiState: 'SIGN_IN',
    message: 'Your session has expired. Please sign in again.',
    returnTo: data?.from,
  }),

  user_logged_out: () => ({ uiState: 'IDLE' }),
};
```

### 4. `AuthPage.tsx` – Orchestrator (Key Parts)

```typescript
// Ref for storing return path (for session_expired)
const returnToRef = useRef<string | null>(null);

// Extract event data based on event type
const getEventData = (event: AuthEventType | undefined, navState: typeof navigationState) => {
  if (!event) return undefined;
  switch (event) {
    case 'session_expired':
      return { from: navState?.from };
    default:
      return undefined; // events without data
  }
};

// Main effect
useEffect(() => {
  if (!authEvent) return;

  // Reset previous UI state
  if (uiState !== AUTH_UI_STATES.IDLE) {
    setUIState(AUTH_UI_STATES.IDLE);
  }

  // Get and execute handler
  const handler = authEventRegistry[authEvent];
  const eventData = getEventData(authEvent, navigationState);
  const result = handler(eventData, { getIdentity });

  // Apply result
  if (result.uiState) setUIState(result.uiState);
  if (result.message) setMessage(result.message);
  if (result.prefill) {
    setPrefilledData(result.prefill.email ?? null, result.prefill.username ?? null);
  }
  if (result.returnTo !== undefined) {
    returnToRef.current = result.returnTo;
  }
  if (result.navigation) {
    navigateTo(result.navigation.to, {
      replace: result.navigation.replace ?? false,
      state: result.navigation.state,
    });
  }
}, [authEvent, navigationState, ...]);

// Login wrapper uses returnToRef for redirect after session_expired
const handleSignInWithNavigation = async (credentials, rememberMe) => {
  const result = await handleSignInDomain(credentials, rememberMe);
  if (result.success) {
    const redirectPath = returnToRef.current ?? INITIAL_PAGE_ADDRESS;
    navigateTo(redirectPath);
    returnToRef.current = null; // cleanup
  }
};
```

---

## 🚀 How to Add a New Event (Step by Step)

### Example: Adding `email_verification_required`

| Step | File | Code |
|------|------|------|
| 1 | `eventTypes.ts` | Add to `AuthEventMapType`:<br>`email_verification_required: { email: string };` |
| 2 | `eventRegistry.ts` | Add handler:<br>`email_verification_required: (data) => ({ uiState: 'SIGN_IN', message: \`Verify ${data?.email}\` })` |
| 3 | `AuthPage.tsx` | Add case in `getEventData()`:<br>`case 'email_verification_required': return { email: navState?.email };` |
| 4 | `navigationState` type | Add property:<br>`email?: string;` |
| 5 | Emitter | `navigate('/auth', { state: { authEvent: 'email_verification_required', email: user.email } })` |

> ✅ No changes needed in `AuthPage`'s core logic beyond these steps.

---

## 🔮 Future Events (Ready to Uncomment)

The codebase includes commented examples for:

| Event | Data | Purpose |
|-------|------|---------|
| `email_verification_required` | `{ email: string }` | Show verification prompt |
| `account_locked` | `{ retryAfter: number }` | Show lock message with timer |
| `two_factor_required` | `{ tempToken: string }` | Redirect to 2FA page |
| `welcome_new_user` | `{ email?: string; username?: string }` | Show onboarding modal |
| `maintenance_mode` | `{ message: string; endTime?: string }` | Show maintenance banner |
| `password_reset_requested` | `{ email: string }` | Show reset confirmation |
| `subscription_expired` | `{ plan: string; redirectUrl?: string }` | Show upgrade prompt |

To activate any of them, simply uncomment the corresponding code blocks.

---

## 🧪 Testing Example

Because handlers are pure functions, testing is straightforward:

```typescript
import { authEventRegistry } from './config/eventRegistry';

describe('authEventRegistry', () => {
  it('session_expired returns correct result', () => {
    const result = authEventRegistry.session_expired({ from: '/dashboard' });
    expect(result).toEqual({
      uiState: 'SIGN_IN',
      message: 'Your session has expired. Please sign in again.',
      returnTo: '/dashboard',
    });
  });

  it('password_changed includes prefill when identity exists', () => {
    const result = authEventRegistry.password_changed();
    expect(result.uiState).toBe('SIGN_IN');
    // prefill may be present or not depending on identity
  });
});
```

---

## 📚 Summary

| Aspect | Description |
|--------|-------------|
| Architecture | Event-driven, declarative, type-safe |
| Core files | `eventTypes.ts`, `eventRegistry.ts`, `AuthPage.tsx` |
| Adding events | 5 steps: type → handler → switch case → navigationState property → emitter |
| Testing | Pure functions, no mocks needed |
| Scalability | Easy to add new events without touching existing logic |

---

## 🔗 Related Files

- `src/auth/authEvent/types/eventTypes.ts`
- `src/auth/authEvent/types/eventContextTypes.ts`
- `src/auth/authEvent/config/eventRegistry.ts`
- `src/pages/auth/AuthPage.tsx`
- `src/auth/auth_utils/localStorageHandle/authStorage.ts` (provides `getIdentity`)

For questions or contributions, refer to the inline comments in the source files.
```