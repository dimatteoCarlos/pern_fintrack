//src/pages/auth/ProtectedRoute.tsx
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../auth/hooks/useAuth';
import { useEffect } from 'react';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx'

const ProtectedRoute = () => {
 const location = useLocation();

 const { isAuthenticated, isCheckingAuth, showSignInModalOnLoad,setShowSignInModalOnLoad } = useAuth();

// 🚨 1. Lógica para establecer la bandera (in useEffect) 🚨
 useEffect(() => {
    // Si la autenticación ha terminado de chequearse, no esta autenticados y el modal AÚN NO se ha marcado para mostrarse.
    if (!isCheckingAuth && !isAuthenticated && !showSignInModalOnLoad) {
      // Establece la bandera SÓLO UNA VEZ para mostrar el modal en la página /auth.
      // Ya que esto ocurre en un useEffect, no causa un bucle.
      setShowSignInModalOnLoad(true);
    }
  }, [isCheckingAuth, isAuthenticated, setShowSignInModalOnLoad, showSignInModalOnLoad]);
  

// 🚨 1. GUARDIA DE CARGA 🚨
 if (isCheckingAuth) {
// Bloquea la UI mostrando el spinner mientras se revisa el token en useAuth.
 return <CoinSpinner />; 
 }

// 🚨 2. REDIRECCIÓN (solo si isCheckingAuth es false) 🚨
 if (!isAuthenticated) {
// Establecer el modal y redirigir
// setShowSignInModalOnLoad(true);
// Redirección suave
return <Navigate to='/auth' state={{ from: location }} replace />;
}
  return (
    <>
      <Outlet />
    </>
  );
};

export default ProtectedRoute;
