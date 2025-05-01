const handleSignIn = async (credentials: SignInCredentialsType) => {
clearError();
clearSuccessMessage();
setIsLoading(true);

try {
const result = await signinRequest(url_signin, credentials);
setIsLoading(false);

    if (result?.status !== 200 || !result.apiData?.data?.user) {
      setError(result?.error || 'Authentication failed');
      return false;
    }

    const { apiData } = result;
    const { user, userAccess } = apiData.data;

    // Validación específica por tipo de cliente
    if (userAccess === 'mobile') {
      if (!apiData.accessToken || !apiData.refreshToken) {
        setError('Authentication tokens required for mobile');
        return false;
      }
      safeStorage.set('accessToken', apiData.accessToken);
      safeStorage.set('refreshToken', apiData.refreshToken);
    } else {
      // Validación para web
      if (!verifyAuthCookie()) {
        setError('Authentication cookie not found');
        return false;
      }
    }

    // Actualización de estado seguro
    setIsAuthenticated(true);
    setUserData(mapUserResponseToUserData(user));
    setSuccessMessage('Welcome back!');

    // Redirección segura con delay opcional
    setTimeout(() => navigateTo('/fintrack'), 100);

    return true;

} catch (err) {
setIsLoading(false);
setError('Secure authentication error');
console.error('Auth error:', err instanceof Error ? err.message : 'Unknown error');
return false;
}
};
