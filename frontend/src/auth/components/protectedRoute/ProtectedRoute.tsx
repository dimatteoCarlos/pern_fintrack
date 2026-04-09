// 📁 frontend/src/auth/components/protectedRoute/ProtectedRoute.tsx

/* ===============================
   🛡️ PROTECTED ROUTE - APPLICATION LAYER (GATEKEEPER)
===============================
🔍 LAYER IDENTIFICATION:
- Layer: Application/Orchestration (Guard)
- Purpose: Single source of truth for route protection
- Decisions:
 * Render content if authenticated
 * Redirect to /signin if session expired (with intent)
 * Redirect to / for normal unauthenticated users

✅ Responsibilities:
- Block UI while checking auth status
- Redirect with appropriate intent and return path
- Read session_expired flag to differentiate expired session from normal unauthenticated state

❌ Never:
- Open modals or set UI state
- Call APIs directly
- Handle business logic
- Clear session_expired or returnTo flags (AuthPage is the only owner)
*/

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import CoinSpinner from '../../../fintrack/loader/coin/CoinSpinner';
import { AUTH_MODES } from '../../auth_constants/constants';

//MAIN COMPONENT:🛡️ PROTECTED ROUTE
const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isCheckingAuth } = useAuth();

 // ⏳ While checking auth, block UI with spinner
  if (isCheckingAuth) {
    return <CoinSpinner />;
  }

 // 🔍 Check if session expired flag exists (set by authRefreshManager)
  const sessionExpired = sessionStorage.getItem('session_expired') === 'true';//Read flag set by authRefreshManager when refresh fails.

  const hasToken = !!sessionStorage.getItem('accessToken');//Check if token exists (even if invalid) – indicates prior authenticated session.
  
 //Debugging Temporary
 // console.log('🔍 ProtectedRoute debug:', {
 // isAuthenticated,
 // hasToken,
 // willSendIntent: hasToken ? 'session_expired' : 'none'
 // });

 const redirectToHomeMenu = '/';
 
 // 🎯 Decision logic
  if (!isAuthenticated) {
 // If either flag or token exists, treat as expired session

 // Case 1: Session expired (user had a token but it's invalid)
  if (sessionExpired || hasToken) {
   // ❌ DO NOT clear session_expired here – AuthPage needs it for fallback
   // ✅ Only redirect, leave flags intact for AuthPage to consume and clean
    
      return (
        <Navigate
          to={AUTH_MODES.SIGN_IN || "/signin"}
          replace
          state={{
            authEvent: 'session_expired',
            from: location.pathname,
          }}
        />
      );
   } 

  // Case 2: Normal unauthenticated user (no token, no expiration) 
  return (
   <Navigate
      to= {redirectToHomeMenu || "/"}
      replace
      state={{ from: location.pathname }}
    />
   );
  }

  // ✅ Access granted - render child routes
  return <Outlet />;
};

export default ProtectedRoute;
