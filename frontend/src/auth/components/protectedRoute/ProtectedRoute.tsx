//src/pages/auth/ProtectedRoute.tsx
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.ts';
import { useEffect } from 'react';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx'

const ProtectedRoute = () => {
 const location = useLocation();

 const { isAuthenticated, isCheckingAuth, showSignInModalOnLoad,setShowSignInModalOnLoad } = useAuth();

//🚨1.LÓGICA DE SEÑALIZACIÓN (Side Effect)🚨
 useEffect(() => {
  // Verifica que el chequeo de persistencia haya terminado (!isCheckingAuth), y que el usuario efectivamente no tenga sesión antes de activar el modal.
  if (!isCheckingAuth && !isAuthenticated && !showSignInModalOnLoad) {
// Indica al store que, al llegar a /auth, se debe abrir el modal de login
    setShowSignInModalOnLoad(true);
    }
  }, [isCheckingAuth, isAuthenticated, setShowSignInModalOnLoad, showSignInModalOnLoad]);
  
//🚨 2. GUARDIA DE CARGA (HIDRATACIÓN) 🚨
 if (isCheckingAuth) {
// Bloquea la UI mostrando el spinner mientras useAuth revisa el token en ls o cookies.
 return <CoinSpinner />; 
 }

// 🚨 3. REDIRECCIÓN DE SEGURIDAD (solo si isCheckingAuth es false) 🚨
 if (!isAuthenticated) {
// Si terminó el chequeo y no hubo éxito, redire a la página de acceso.
// Redirección suave
return <Navigate to='/auth' state={{ from: location }} replace />;
}
// 🚨 4. ACCESO CONCEDIDO 🚨
  return (
    <>
     <Outlet />
    </>
  );
};

export default ProtectedRoute;

