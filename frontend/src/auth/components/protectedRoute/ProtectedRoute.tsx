// 📁 frontend/src/auth/components/protectedRoute/ProtectedRoute.tsx

/* ===============================
   🛡️ PROTECTED ROUTE - APPLICATION LAYER (GATEKEEPER)
   ===============================
   
   🔍 LAYER IDENTIFICATION:
   - Layer: Application/Orchestration (Guard)
   - Purpose: Single source of truth for route protection
   - Decisions:
     * Render content if authenticated
     * Redirect
   
   ✅ Responsibilities:
   - Block UI while checking auth status
   - Redirect to '/'
   
   ❌ Never:
   - Open modals or set UI state
   - Call APIs directly
   - Handle business logic
*/

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import CoinSpinner from '../../../fintrack/loader/coin/CoinSpinner';

//MAIN COMPONENT:🛡️ PROTECTED ROUTE

const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isCheckingAuth } = useAuth();

  // ⏳ While checking auth, block UI with spinner
  if (isCheckingAuth) {
    return <CoinSpinner />;
  }

  const redirectTo = '/';

  if (!isAuthenticated) {
 // ✅ Check if user had a token (real session expired)
   const hasToken = !!sessionStorage.getItem('accessToken'); 
    
//Debugging Temporary
// console.log('🔍 ProtectedRoute debug:', {
// isAuthenticated,
// hasToken,
// willSendIntent: hasToken ? 'session_expired' : 'none'
// });

   return (
     <Navigate
       to={redirectTo}
       replace
       state={
         hasToken
          ? { 
             intent: 'session_expired' as const, 
             from: location.pathname 
            }
          : { from: location.pathname }
       }
     />
   );
  }

  // ✅ Access granted - render child routes
  return <Outlet />;
};

export default ProtectedRoute;
