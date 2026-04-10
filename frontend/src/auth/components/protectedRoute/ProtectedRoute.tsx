// 📁 frontend/src/auth/components/protectedRoute/ProtectedRoute.tsx

/* ===============================
   🛡️ PROTECTED ROUTE - APPLICATION LAYER (GATEKEEPER)
===============================
🔍 LAYER IDENTIFICATION:
- Layer: Application/Orchestration (Guard)
- Purpose: Single source of truth for route protection

✅ Responsibilities:
- Block UI while checking auth status
- Redirect to /signin if session expired (with intent)
- Redirect to / for normal unauthenticated users

❌ Never:
- Open modals or set UI state
- Call APIs directly
- Handle business logic
- Clear session_expired or returnTo flags (AuthPage is the only owner)
*/

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import CoinSpinner from '../../../fintrack/loader/coin/CoinSpinner';
import { AUTH_ROUTE } from '../../auth_constants/constants';

//MAIN COMPONENT:🛡️ PROTECTED ROUTE
const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isCheckingAuth , sessionExpired } = useAuth();

 // ⏳ While checking auth, block UI with spinner
  if (isCheckingAuth) {
    return <CoinSpinner />;
  }

 const redirectToHomeMenu = '/';
 
 // 🎯 Decision logic
  if (!isAuthenticated) {
  // ✅ Use store flag
  if (sessionExpired ) {
    return (
     <Navigate
       to={AUTH_ROUTE}
       replace
       state={{
         authEvent: 'session_expired',
         from: location.pathname,
       }}
     />
      );
   } 
// Normal unauthenticated user
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
