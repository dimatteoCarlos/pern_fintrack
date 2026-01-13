//frontend/src/auth/types/authTypes.ts
export type CredentialsType = {
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  password: string;
};

export type SignInCredentialsType= {
  username: string;
  email: string;
  password: string;
}
export interface SignUpCredentialsType extends SignInCredentialsType {
  user_firstname: string;
  user_lastname: string;
}

// ===============
// 🏪 STORE TYPES
// ===============
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
//R:check if it is usable
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

//backend data response type. Common for all auth responses, as for Sign-in,Sign-up and refresh token
export type AuthSuccessResponseType  = {
  message: string;
  accessToken: string;      // Siempre presente en login/register/refresh
  user: UserResponseDataType;
  expiresIn: number;     
};
// If SignIn and SignUp use the same structure then: 
// export type SignInResponseType = AuthSuccessResponse;
// export type SignUpResponseType = AuthSuccessResponse;

//sign-out
//R:check if it is usable
export type SignOutResponseType = {
  message: string;
};
//------------
//sign-up
export type SignUpResponseType= {
  message: string;
  accessToken?: string;
  user:UserResponseDataType;
  expiresIn: number;
  refreshToken?: string;//R:check if it's usable

  // data: DataRespType;
}
export type DataRespType ={user: UserResponseDataType;
  userAccess: string;}//R: checi if it's usable

// =====================  
// 👤 USER TYPES / TIPOS DE USUARIO
// =====================  
export type UserResponseDataType ={
  user_id: string;
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  role:string;
  currency: string;
  contact?:string;
  // currency_id?: number;
  // user_role_id?: number;
}

//input type user info
// export type UserDataType = Partial<UserResponseDataType>
export type UserDataType = 
{
 user_id: string | null;
 username: string;
 email: string;
 user_firstname?: string;
 user_lastname?: string;
 currency?: string;    
 role?: string;  
 contact?:string;
};
//-------------------------------
//sign-in
export type SignInResponseType ={
 message: string;
 accessToken: string;
 user: UserResponseDataType;
 expiresIn: number;
  
 // userAccess?: string ;
 // refreshToken?: string;
}

//authRefreshToken refresh-token
//R: chek if it's usable
export interface AuthRefreshTokenResponseType {
  message: string;
  user: RefreshTokenUserInfoType | { [key: string]: string };
  expiresIn?: number; 
}
//R: chek if it's usable
export interface RefreshTokenUserInfoType {
  user_id: string;
  username: string;
  email: string;
  user_role_id: number;
  user_role_name: string;
  accessToken: string;
  refreshToken: string;
}

// Define the success response format for the frontend
export interface SuccessResponseType<T> { // Make SuccessResponse generic
  message: string;    // Success message
  data?: T;         // Optional: Response data, now of type T
  accessToken?: string; // Optional: Access token
  refreshToken?: string; // Optional: Refresh token
}

// ===============
// 🚨 USER PROFILE UPDATE AND PASSWORD CHANGE
// ===============
export type PasswordChangeResponseType={
 success:boolean;
 message:string;
 // user?:
}
export type ProfileUpdateResponseType ={
 success:boolean;
 message:string;
 user?:UserResponseDataType;
}

export type UpdateProfileFormData ={
  firstname?: string;
  lastname?: string;
  currency?: 'usd' | 'cop' | 'eur';
  contact?: string | null;
}
// ===============
// 🚨 ERROR TYPES
// ===============
//Error format backend response
export type ErrorResponseType = {
 status: number;      //  HTTP status code
  error:string;
  message: string;    //  Descriptive error messager
  details?:{
   fieldErrors?:Record<string,string[]>;
   formErrors?:string[];
  }
//  Detailed error information optional
  timestamp?: string;  // Timestamp of the error (opcional)
}

export type AuthErrorType = 
  | { type: 'validation'; fieldErrors: Record<string, string[]>; }
  | { type: 'rate_limit'; retryAfter: number; }
  | { type: 'session_expired'; }
  | { type: 'network'; message: string; };


