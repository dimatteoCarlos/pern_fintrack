// frontend\src\auth\components\protectedRoute\ProtectedRoute.tsx
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.ts';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx'
// import { useEffect } from 'react';

const ProtectedRoute = () => {
 const location = useLocation();

 const { isAuthenticated, isCheckingAuth,
 //showSignInModalOnLoad,setShowSignInModalOnLoad 

 } = useAuth();
/*
//🚨1.LÓGICA DE SEÑALIZACIÓN (Side Effect)🚨
 useEffect(() => {
  // Verifica que el chequeo de persistencia haya terminado (!isCheckingAuth), y que el usuario efectivamente no tenga sesión antes de activar el modal.
  if (!isCheckingAuth && !isAuthenticated && !showSignInModalOnLoad) {
// Indica al store que, al llegar a /auth, se debe abrir el modal de login
    setShowSignInModalOnLoad(true);
    }
  }, [isCheckingAuth, isAuthenticated, setShowSignInModalOnLoad, showSignInModalOnLoad]);
  */

//===================
//🚨 SHOW LOADING SPINNER WHILE CHECKING AUTH
 if (isCheckingAuth) {
// Bloquea la UI mostrando el spinner mientras useAuth revisa el token en ls o cookies.
 return <CoinSpinner />; 
 }

// 🚨 REDIRECT TO AUTH PAGE IF NOT AUTHENTICATED
 if (!isAuthenticated) {
// Si terminó el chequeo y no hubo éxito, redirige a la página de acceso.
// Redirección suave
return <Navigate to='/auth' state={{ from: location.pathname}} replace />;
}
// 🚨 ACCESS GRANTED
  return (
    <>
     <Outlet />
    </>
  );
};

export default ProtectedRoute;

