// 📁 frontend/src/auth/authEvent/types/eventTypes.ts

/_ ===============================
🎯 AUTH EVENT TYPES - Event-driven navigation (declarative)
===============================
_/

import { AuthUIStateType } from '../../types/authTypes';

/\*\*

- AuthEventMapType - Data payload for each auth navigation event
  \*/
  export type AuthEventMapType = {
  // Current events
  password_changed: undefined;
  session_expired: { from?: string };
  user_logged_out: undefined;

// === FUTURE EVENTS (commented, ready to uncomment) ===
// email_verification_required: { email: string };
// account_locked: { retryAfter: number };
// two_factor_required: { tempToken: string };
// welcome_new_user: { email?: string; username?: string };
// maintenance_mode: { message: string; endTime?: string };
// password_reset_requested: { email: string };
// subscription_expired: { plan: string; redirectUrl?: string };
};

export type AuthEventType = keyof AuthEventMapType;

/\*\*

- AuthEventResultType - Declarative description of what the handler wants to happen
  \*/
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
//===================================
// 📁 frontend/src/auth/authEvent/types/eventTypes.ts

/_ ===============================
🎯 AUTH EVENT TYPES - Event-driven navigation (declarative)
===============================
_/

import { AuthUIStateType } from '../../types/authTypes';

/\*\*

- AuthEventMapType - Data payload for each auth navigation event
  \*/
  export type AuthEventMapType = {
  // Current events
  password_changed: undefined;
  session_expired: { from?: string };
  user_logged_out: undefined;

// === FUTURE EVENTS (commented, ready to uncomment) ===
// email_verification_required: { email: string };
// account_locked: { retryAfter: number };
// two_factor_required: { tempToken: string };
// welcome_new_user: { email?: string; username?: string };
// maintenance_mode: { message: string; endTime?: string };
// password_reset_requested: { email: string };
// subscription_expired: { plan: string; redirectUrl?: string };
};

export type AuthEventType = keyof AuthEventMapType;

/\*\*

- AuthEventResultType - Declarative description of what the handler wants to happen
  \*/
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

<!-- =============================
 -->

// 📁 frontend/src/auth/authEvent/types/eventContextTypes.ts

/_ ===============================
🔧 AUTH EVENT CONTEXT - Read-only tools for event handlers
===============================
_/

export type AuthEventContextType = {
// Read-only: get identity for prefill
getIdentity: () => { email?: string; username?: string } | null;
};

//==============================
// 📁 frontend/src/auth/authEvent/config/eventRegistry.ts

/_ ===============================
📋 AUTH EVENT REGISTRY - Central configuration for all auth events
===============================
_/

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

export const authEventRegistry: {
[EventKey in AuthEventType]: ../src/auth/components/authPage/AuthEventHandlerType<EventKey>;
} = {
// ============================================
// CURRENT EVENTS
// ============================================

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

// ============================================
// FUTURE EVENTS (commented, ready to uncomment)
// ============================================

// email_verification_required: (data) => ({
// uiState: 'SIGN_IN',
// message: `Please verify your email (${data?.email}) before logging in.`,
// }),

// account_locked: (data) => ({
// uiState: 'SIGN_IN',
// message: `Account locked. Please try again in ${data?.retryAfter} seconds.`,
// }),

// two_factor_required: (data) => ({
// uiState: 'SIGN_IN',
// message: 'Two-factor authentication required.',
// navigation: { to: '/2fa', state: { tempToken: data?.tempToken } },
// }),

// welcome_new_user: (data) => ({
// uiState: 'SIGN_IN',
// message: `Welcome ${data?.email || data?.username || 'new user'}!`,
// prefill: { email: data?.email, username: data?.username },
// }),

// maintenance_mode: (data) => ({
// message: data?.message || 'System under maintenance.',
// navigation: { to: '/maintenance', replace: true },
// }),

// password_reset_requested: (data) => ({
// uiState: 'SIGN_IN',
// message: `Password reset link sent to ${data?.email}. Please check your inbox.`,
// }),

// subscription_expired: (data) => ({
// uiState: 'SIGN_IN',
// message: `Your ${data?.plan} plan has expired. Please renew to continue.`,
// navigation: data?.redirectUrl ? { to: data.redirectUrl } : undefined,
// }),
};
//====================

🚀 Cómo añadir un nuevo evento en el futuro
Paso Archivo Acción
1 eventTypes.ts Añadir entrada en AuthEventMapType
2 eventRegistry.ts Añadir handler en authEventRegistry
3 AuthPage.tsx Descomentar caso en getEventData() y añadir propiedad en navigationState

//=======================

//===================================
// 📁 frontend/src/pages/auth/AuthPage.tsx

/_ ===============================
🔐 AUTH PAGE - PRESENTATION ORCHESTRATOR
===============================
_/
import { useCallback, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AuthUI from './AuthUI';
import { AUTH_UI_STATES } from '../../auth_constants/constants';
import Logo from '../../../assets/logo.svg';
import styles from './styles/authPage.module.css';

import { useAuthUIStore } from '../../stores/useAuthUIStore';
import useAuth from '../../hooks/useAuth';
import { SignInCredentialsType, SignUpCredentialsType } from '../../types/authTypes';
import { INITIAL_PAGE_ADDRESS } from '../../../fintrack/helpers/constants';
import { getIdentity } from '../../auth_utils/localStorageHandle/authStorage';
import { authEventRegistry } from '../../authEvent/config/authEventRegistry';

// import { authEventRegistry } from '../../auth/authEvent/config/eventRegistry';
// import { AuthEventType } from '../../auth/authEvent/types/eventTypes';

export default function AuthPage() {
const location = useLocation();
const navigateTo = useNavigate();

const { uiState, message, setUIState, setPrefilledData, setMessage, resetUI } = useAuthUIStore();

const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
const [isSignInMode, setIsSignInMode] = useState(true);

const {
isLoading,
error,
handleSignIn: handleSignInDomain,
handleSignUp: handleSignUpDomain,
clearError,
} = useAuth();

// Ref for storing return path (for session_expired)
const returnToRef = useRef<string | null>(null);

// ===============================
// 🎯 PRESENTATION LAYER WRAPPERS
// ===============================
const handleSignInWithNavigation = async (
credentials: SignInCredentialsType,
rememberMe: boolean,
) => {
const result = await handleSignInDomain(credentials, rememberMe);
if (result.success) {
const redirectPath = returnToRef.current ?? INITIAL_PAGE_ADDRESS;
navigateTo(redirectPath);
returnToRef.current = null;
}
};

const handleSignUpWithNavigation = async (credentials: SignUpCredentialsType) => {
const result = await handleSignUpDomain(credentials);
if (result.success) {
navigateTo(INITIAL_PAGE_ADDRESS ?? '/fintrack');
}
};

// ===============================
// 🎯 AUTH EVENT HANDLER (MAIN EFFECT)
// ===============================
const navigationState = location.state as
| {
authEvent?: string;
from?: string;
// Future event data (commented for now)
// email?: string;
// retryAfter?: number;
// tempToken?: string;
// username?: string;
// message?: string;
// endTime?: string;
}
| undefined;

const authEvent = navigationState?.authEvent as AuthEventType | undefined;

// Debug log
console.log({ authEvent });

// Extract event data based on event type
const getEventData = (event: AuthEventType | undefined, navState: typeof navigationState) => {
if (!event) return undefined;

    switch (event) {
      case 'session_expired':
        return { from: navState?.from };

      // === FUTURE EVENTS (commented, ready to uncomment) ===
      // case 'email_verification_required':
      //   return { email: navState?.email };
      //
      // case 'account_locked':
      //   return { retryAfter: navState?.retryAfter };
      //
      // case 'two_factor_required':
      //   return { tempToken: navState?.tempToken };
      //
      // case 'welcome_new_user':
      //   return { email: navState?.email, username: navState?.username };
      //
      // case 'maintenance_mode':
      //   return { message: navState?.message, endTime: navState?.endTime };

      default:
        // Events without data: password_changed, user_logged_out
        return undefined;
    }

};

useEffect(() => {
if (!authEvent) return;

    // Force clean state before processing
    if (uiState !== AUTH_UI_STATES.IDLE) {
      setUIState(AUTH_UI_STATES.IDLE);
    }

    // Get handler from registry
    const handler = authEventRegistry[authEvent];
    if (!handler) {
      console.warn(`Unknown authEvent: ${authEvent}`);
      return;
    }

    // Get event data
    const eventData = getEventData(authEvent, navigationState);

    // Execute handler
    const result = handler(eventData, { getIdentity });

    // Apply UI changes
    if (result.uiState) {
      setUIState(result.uiState);
    }
    if (result.message) {
      setMessage(result.message);
    }
    if (result.prefill) {
      setPrefilledData(result.prefill.email ?? null, result.prefill.username ?? null);
    }

    // Handle returnTo (for session_expired)
    if (result.returnTo !== undefined) {
      returnToRef.current = result.returnTo;
    }

    // Handle navigation
    if (result.navigation) {
      navigateTo(result.navigation.to, {
        replace: result.navigation.replace ?? false,
        state: result.navigation.state,
      });
    }

}, [authEvent, navigationState,getEventData, navigateTo, setPrefilledData, setUIState, setMessage, uiState]);

// ✅ Separate effect for cleaning location.state (prevents loop)
useEffect(() => {
if (location.state && Object.keys(location.state).length > 0) {
navigateTo(location.pathname, { replace: true, state: {} });
}
}, [location.state, location.pathname, navigateTo]);

// ======================
// 🎯 EVENT HANDLERS
// ======================
const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

const openSigninModalHandler = () => {
setIsMenuOpen(false);
clearError();
setIsSignInMode(true);
const identity = getIdentity();
if (identity?.email && identity?.username) {
setPrefilledData(identity.email, identity.username);
}
setUIState(AUTH_UI_STATES.SIGN_IN);
};

const openSignupModalHandler = () => {
setIsMenuOpen(false);
clearError();
setIsSignInMode(false);
setUIState(AUTH_UI_STATES.SIGN_UP);
};

const handleCloseModal = () => {
resetUI();
};

const showModal = uiState !== AUTH_UI_STATES.IDLE;

return (
<div className={styles.authPageContainer}>
<nav className={styles.navbar}>
<div className={styles.logoContainer} onClick={openSigninModalHandler}>
<span><Logo /></span>
</div>
<button
          className={styles.menuToggleButton}
          aria-label='Navigation Menu'
          aria-expanded={isMenuOpen}
          onClick={toggleMenu}
        >
☰
</button>
<ul className={`${styles.navList} ${isMenuOpen ? styles.navMenuActive : ''}`}>
<li className={styles.navItem} onClick={openSigninModalHandler}>Sign in</li>
<li className={styles.navItem} onClick={openSignupModalHandler}>Sign up</li>
</ul>
</nav>
<main className={styles.mainContent}>
{showModal && (
<div className={styles.modalOverlay} onClick={handleCloseModal}>
<div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
<AuthUI
                onSignIn={handleSignInWithNavigation}
                onSignUp={handleSignUpWithNavigation}
                isLoading={isLoading}
                error={error}
                messageToUser={message}
                isSignInInitial={isSignInMode}
                clearError={clearError}
                onClose={handleCloseModal}
              />
</div>
</div>
)}
</main>
</div>
);
}
