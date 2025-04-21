import { Navigate, useLocation, Outlet } from 'react-router-dom';
// import { Navigate, useNavigate } from 'react-router-dom';

import useAuth from '../../auth/hooks/useAuth';
import { useEffect } from 'react';
// import { ReactNode } from 'react';


const ProtectedRoute = () => {
  const location = useLocation();

  // const { isAuthenticated, setShowSignInModalOnLoad } = useAuthStore(
  //   (state) => ({
  //     isAuthenticated: state.isAuthenticated,
  //     setShowSignInModalOnLoad: state.setShowSignInModalOnLoad,
  //   })
  // );
  const { isAuthenticated, setShowSignInModalOnLoad } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setShowSignInModalOnLoad(true);
    }
  }, [isAuthenticated, setShowSignInModalOnLoad]); 

  if (!isAuthenticated) {
     // Set the state in AuthPage to show the sign-in modal on load
    // setShowSignInModalOnLoad(true);
    // preserving the location user tried to access
    return <Navigate to='/auth' state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
