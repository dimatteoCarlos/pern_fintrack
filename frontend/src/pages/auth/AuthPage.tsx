import AuthUI from "./AuthUI"


function AuthPage() {

  // const { login, signup, isLoading, error } = useAuth();

    // TODO: Obtener la URL de Google Sign-in desde la configuración del backend
    // const googleSignInUrl = '/api/auth/google';
     // Ejemplo de URL




  return (
    <>
    <AuthUI
    onSignIn= {login}
    onSignUp= {signin}
    isLoading={isLoading}
    error = {error}
    //messageToUser = {get the message from state}
    // googleSignInUrl={googleSignInUrl}
    />
    
    </>
  )
}

export default AuthPage