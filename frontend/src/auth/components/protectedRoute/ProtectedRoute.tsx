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
import { AUTH_ROUTE, AUTH_UI_STATES } from '../../auth_constants/constants';
import { useAuthUIStore } from '../../stores/useAuthUIStore';

//MAIN COMPONENT:🛡️ PROTECTED ROUTE

const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isCheckingAuth } = useAuth();
  
  const { setUIState, setPrefilledData } = useAuthUIStore();

  // ⏳ While checking auth, block UI with spinner
  if (isCheckingAuth) {
    return <CoinSpinner />;
  }

  // 🚨 Not authenticated → intelligent redirect based on persisted identity
  if (!isAuthenticated) {
// 🔍 Read remembered identity
   const identity = getIdentity();

   if (identity) {
// 👤 REMEMBERED_VISITOR - set UI state for pre-filled form
     setUIState(AUTH_UI_STATES.REMEMBERED_VISITOR);
     setPrefilledData(identity.email, identity.username); //zustand state
   }

// 🎯 Decide destination based on whether user was remembered
// - User with remembered identity → go to login page (pre-filled)
   const redirectTo = identity ? AUTH_ROUTE : '/';
// - Anonymous user → go to landing page

   return (
     <Navigate
      to={redirectTo}
      replace
       state={{
          from: location.pathname,  // Only pass location, not UI state
        }}
      />
    );
  }

  // ✅ Access granted - render child routes
  return <Outlet />;
};

export default ProtectedRoute;