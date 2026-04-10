(async function testSessionExpiration() {
  console.group('🔍 SESSION EXPIRATION TEST');

  // 1. Estado actual antes de simular expiración
  console.log('📦 Current sessionStorage:', {
    accessToken: sessionStorage.getItem('accessToken'),
    tokenExpiry: sessionStorage.getItem('tokenExpiry'),
    returnTo: sessionStorage.getItem('returnTo'),
  });

  // 2. Verificar si hay identidad guardada (localStorage)
  const identity = localStorage.getItem('auth_identity');
  console.log('🆔 Stored identity:', identity ? JSON.parse(identity) : null);

  // 3. Simular expiración eliminando el token
  console.log('⏳ Simulating token expiration...');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('tokenExpiry');

  // 4. Verificar que returnTo NO se haya guardado aún (debería estar vacío)
  console.log('📦 sessionStorage after token removal:', {
    accessToken: sessionStorage.getItem('accessToken'),
    returnTo: sessionStorage.getItem('returnTo'),
  });

  // 5. Indicar al usuario que debe navegar o recargar
  console.log('➡️ Now navigate to a protected route (or reload the page).');
  console.log('✅ Expected: redirect to /signin, modal opens with expiration message.');
  console.log('✅ After login, you should return to the original page.');

  // Opcional: forzar navegación a una ruta protegida (cambia la ruta según tu app)
  // window.location.href = '/fintrack/tracker/expense';

  console.groupEnd();
})();

//================
(function diagnosticAfterRedirect() {
  console.group('🔍 Post-redirect diagnostic');
  console.log('📦 sessionStorage:', {
    accessToken: sessionStorage.getItem('accessToken'),
    returnTo: sessionStorage.getItem('returnTo'),
  });
  console.log('📍 Current location:', location.pathname);
  console.log('🧭 location.state:', history.state?.usr);
  console.log('🍪 Cookies:', document.cookie);
  console.groupEnd();
})();

<!-- ==================== -->
// Si expusiste el store globalmente (opcional, solo para depuración)
if (window.__ZUSTAND_AUTH_STORE__) {
  console.log('🏪 sessionExpired flag in store:', window.__ZUSTAND_AUTH_STORE__.sessionExpired);
} else {
  console.warn('Store not exposed globally. To enable, add in useAuthStore.ts:');
  console.warn('if (typeof window !== "undefined") window.__ZUSTAND_AUTH_STORE__ = useAuthStore.getState();');
}