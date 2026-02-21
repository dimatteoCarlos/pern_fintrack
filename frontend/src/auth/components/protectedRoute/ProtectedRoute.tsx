// 📁 frontend/src/auth/components/protectedRoute/ProtectedRoute.tsx

/* ===============================
   🛡️ PROTECTED ROUTE - APPLICATION LAYER (GATEKEEPER)
   ===============================
   
   🔍 LAYER IDENTIFICATION:
   - Layer: Application/Orchestration (Guard)
   - Purpose: Single source of truth for route protection
   - Decisions:
     * Render content if authenticated
     * Redirect based on remembered identity if not authenticated
   
   ✅ Responsibilities:
   - Block UI while checking auth status
   - Consult persisted identity for intelligent redirects
   - Signal expiration via location.state
   
   ❌ Never:
   - Open modals or set UI state
   - Call APIs directly
   - Handle business logic
   
   📍 CORRECT LOCATION:
     /auth/components/protectedRoute/ - auth module guard
*/

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import CoinSpinner from '../../../loader/coin/CoinSpinner';
import { getIdentity } from '../../auth_utils/localStorageHandle/authStorage';
import { AUTH_ROUTE } from '../../auth_constants/constants';
// import { getIdentity } from '../../../auth_utils/localStorageHandle/authStorage';
// import { AUTH_ROUTE } from '../../../auth_constants/constants';

/**
 * 🛡️ Protected Route Gatekeeper
 * 
 * This is the ONLY place in the app that decides:
 * - Where to redirect unauthenticated users
 * - Whether to show loading state
 * - How to signal session expiration
 * 
 * All navigation decisions for unauthenticated users
 * are centralized here.
 */
const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isCheckingAuth } = useAuth();

  // ⏳ While checking auth, block UI with spinner
  if (isCheckingAuth) {
    return <CoinSpinner />;
  }

  // 🚨 Not authenticated → intelligent redirect based on persisted identity
  if (!isAuthenticated) {
    // 🔍 Read the single source of truth for remembered identity
    const identity = getIdentity();

    // 🎯 Decide destination based on whether user was remembered
    // - User with remembered identity → go to login page (pre-filled)
    // - Anonymous user → go to landing page
    const redirectTo = identity ? AUTH_ROUTE : '/';

    return (
      <Navigate
        to={redirectTo}
        replace
        state={{
          expired: true,           // Signal that session expired
          from: location.pathname,  // Original destination for post-login redirect
        }}
      />
    );
  }

  // ✅ Access granted - render child routes
  return <Outlet />;
};

export default ProtectedRoute;