// 📁 frontend/src/auth/components/publicOnlyRoute/PublicOnlyRoute.tsx

/* ===============================
   🚪 PUBLIC ONLY ROUTE - APPLICATION LAYER (GATEKEEPER)
===============================
🔍 LAYER IDENTIFICATION:
- Layer: Application/Orchestration (Guard)
- Purpose: The mirror of ProtectedRoute. That one keeps a signed-out visitor out
  of the app; this one keeps a signed-in owner out of the auth screen.

Why it exists: "/" rendered AuthPage to anyone who asked, session or not, so the
login form was reachable from inside a live session — by the back button, by a
bookmark, by a link. Redirecting on sign-in fixed the back button alone; the
route itself had no opinion, and a guard is what gives it one.

No loop with ProtectedRoute: that guard fires when NOT authenticated and this one
when authenticated, so a visitor is never bounced between the two.

✅ Responsibilities:
- Block UI while the session check is in flight
- Send an authenticated owner to the app's first page

❌ Never:
- Open modals or set UI state
- Call APIs directly
- Clear session_expired or returnTo flags (AuthPage is the only owner)
*/

import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import CoinSpinner from '../../../fintrack/loader/coin/CoinSpinner';
import { INITIAL_PAGE_ADDRESS } from '../../../fintrack/helpers/constants';

//MAIN COMPONENT:🚪 PUBLIC ONLY ROUTE
const PublicOnlyRoute = () => {
 const { isAuthenticated, isCheckingAuth } = useAuth();

 // ⏳ The check has to finish first. Deciding while it runs paints the login
 // form to a signed-in owner for a frame, which is the defect this guard exists
 // to remove.
 if (isCheckingAuth) {
  return <CoinSpinner />;
 }

 if (isAuthenticated) {
  return <Navigate to={INITIAL_PAGE_ADDRESS} replace />;
 }

 // ✅ No session - render the auth screen
 return <Outlet />;
};

export default PublicOnlyRoute;
