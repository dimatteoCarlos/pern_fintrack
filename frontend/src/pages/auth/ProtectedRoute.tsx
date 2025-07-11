import { Navigate, useLocation, Outlet } from 'react-router-dom';

import useAuth from '../../auth/hooks/useAuth';
import { useEffect } from 'react';

const ProtectedRoute = () => {
  const location = useLocation();

  const { isAuthenticated, setShowSignInModalOnLoad } = useAuth();
  console.log('isAuthenticated', isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowSignInModalOnLoad(true);
    }
  }, [isAuthenticated, setShowSignInModalOnLoad]);

  if (!isAuthenticated) {
    // Set the state in AuthPage to show the sign-in modal on load
    // preserving the location user tried to access
    return <Navigate to='/auth' state={{ from: location }} replace />;
  }

  return (
    <>
      <Outlet />
    </>
  );
};

export default ProtectedRoute;
