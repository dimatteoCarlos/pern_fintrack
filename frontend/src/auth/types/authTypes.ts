export type CredentialsType = {
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  password: string;
};

export interface SignInCredentialsType {
  username?: string;
  email?: string;
  password: string;
}
export interface SignUpCredentialsType extends SignInCredentialsType {
  user_firstname: string;
  user_lastname: string;
}

export type UserDataType = {
  userId: string | null;
  username: string;
  user_firstname: string;
  user_lastname: string;
  email: string;
};

//--useAuthStoreTypes
export interface AuthStateType {
  isAuthenticated: boolean;
  userData: UserDataType | null;
  isLoading: boolean;
  setIsLoading:(isLoading:boolean)=>void;
  error: string | null;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setUserData: (userData: UserDataType | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  successMessage: string | null;
  setSuccessMessage: (successMessage: string | null) => void;
  clearSuccessMessage: () => void;

  showSignInModalOnLoad: boolean;
  setShowSignInModalOnLoad: (showSignInModalOnLoad: boolean) => void;
}

//useAuthTypes response
export type UseAuthResponseType={
  isAuthenticated: boolean;
  userData: UserDataType | null;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  handleSignIn: (credentials: SignInCredentialsType) => Promise<unknown>
  handleSignUp: (userData: SignUpCredentialsType) => Promise<unknown>
  handleSignOut: () => Promise<unknown>
  clearError: () => void;
  clearSuccessMessage: () => void;

  showSignInModalOnLoad: boolean; 
  setShowSignInModalOnLoad: (showSignInModalOnLoad: boolean) => void;

}
//backend data response type
export type AuthResponseType={token:string, user:UserDataType; message?:string, error:string | null}
