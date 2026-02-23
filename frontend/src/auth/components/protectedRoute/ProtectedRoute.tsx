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

//MAIN COMPONENT:🛡️ PROTECTED ROUTE

const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isCheckingAuth } = useAuth();
  
  // const { setUIState, setPrefilledData } = useAuthUIStore();

  // ⏳ While checking auth, block UI with spinner
  if (isCheckingAuth) {
    return <CoinSpinner />;
  }

  // 🚨 Not authenticated → intelligent redirect based on persisted identity
  if (!isAuthenticated) {
// 🔍 Read remembered identity
   const identity = getIdentity();
// ✅ Do NOT set UI state here - that belongs in AuthPage
// The store will be read by AuthPage when it renders
  
// 🎯 Decide destination based on whether user was remembered
// - User with remembered identity → go to login page (pre-filled)
   const redirectTo = identity ? AUTH_ROUTE : '/';
// - Anonymous user → go to landing page

   return (
     <Navigate
      to={redirectTo}
      replace
       state={{ 
         from: location.pathname,
         // ✅ Pass identity info via navigation state instead of store
         hasIdentity: !!identity,
         prefilledEmail: identity?.email,
         prefilledUsername: identity?.username,
        }}
      />
    );
  }

  // ✅ Access granted - render child routes
  return <Outlet />;
};

export default ProtectedRoute;