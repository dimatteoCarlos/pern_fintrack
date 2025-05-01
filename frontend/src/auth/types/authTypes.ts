export type CredentialsType = {
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  password: string;
};

export interface SignInCredentialsType {
  username: string;
  email: string;
  password: string;
}
export interface SignUpCredentialsType extends SignInCredentialsType {
  user_firstname: string;
  user_lastname: string;
}
//input type user info
export type UserDataType = {
  userId: string | null;
  username: string;
  email: string;
  user_firstname?: string;
  user_lastname?: string;
};

//--useAuthStoreTypes
export interface AuthStateType<U> {
  isAuthenticated: boolean;
  userData: U | null;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  error: string | null;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setUserData: (userData: U | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  successMessage: string | null;
  setSuccessMessage: (successMessage: string | null) => void;
  clearSuccessMessage: () => void;

  showSignInModalOnLoad: boolean;
  setShowSignInModalOnLoad: (showSignInModalOnLoad: boolean) => void;
}

//useAuthTypes response
export type UseAuthResponseType<U> = {
  isAuthenticated: boolean;
  userData: U | null;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  handleSignIn: (credentials: SignInCredentialsType) => Promise<unknown>;
  handleSignUp: (userData: SignUpCredentialsType) => Promise<unknown>;
  handleSignOut: () => Promise<unknown>;
  clearError: () => void;
  clearSuccessMessage: () => void;

  showSignInModalOnLoad: boolean;
  setShowSignInModalOnLoad: (showSignInModalOnLoad: boolean) => void;
};
//backend data response type
export type AuthResponseType = {
  token?: string;
  user: UserDataType;
  message?: string;
  error: string | null;
};

//sign-out
export type SignOutResponseType = {
  message: string;
  user: { [key: string]: string };
};
//------------

//sign-up
export interface SignUpResponseType {
  message: string;
  data: DataRespType
  accessToken?: string;
  refreshToken?: string;
}
export type DataRespType ={user: UserResponseDataType;
  userAccess: string;}
  
export interface UserResponseDataType {
  user_id: string;
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  currency_id?: number;
  currency?: string;
  user_role_id?: number;
}

//sign-in
export interface SignInResponseType {
  message: string;
  data: { user: UserResponseDataType; userAccess: string };
  accessToken?: string;
  refreshToken?: string;
}

//authRefreshToken refresh-token
export interface AuthRefreshTokenResponseType {
  message: string;
  user: RefreshTokenUserInfoType | { [key: string]: string };
}
export interface RefreshTokenUserInfoType {
  user_id: string;
  username: string;
  email: string;
  user_role_id: number;
  user_role_name: string;
  accessToken: string;
  refreshToken: string;
}

//Error format backend response
export type ErrorResponseType = {
  status: number;      //  HTTP status code
  message: string;    //  Descriptive error messager
  errors?: unknown;         //  Detailed error information optional
  timestamp?: string;  // Timestamp of the error (opcional)
}

// Define the success response format for the frontend
export interface SuccessResponseType<T> { // Make SuccessResponse generic
  message: string;    // Success message
  data?: T;         // Optional: Response data, now of type T
  accessToken?: string; // Optional: Access token
  refreshToken?: string; // Optional: Refresh token
}

