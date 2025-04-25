export type BaseUserFields = {
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
};

export type CredentialsType = BaseUserFields & {
  password: string;
};

export interface SignInCredentialsType extends Pick<BaseUserFields, 'username' | 'email'> {
  password: string;
}

export interface SignUpCredentialsType extends SignInCredentialsType, Pick<BaseUserFields, 'user_firstname' | 'user_lastname'> {}

export type UserDataType = BaseUserFields & {
  userId: string | null;
};

//--useAuthStoreTypes
export interface AuthStateType {
  isAuthenticated: boolean;
  userData: UserDataType | null;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
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

//useAuthTypes response (This seems to describe the return type of your hook, let's align it with AuthStateType and the actions)
export type UseAuthResponseType = AuthStateType & {
  handleSignIn: (credentials: SignInCredentialsType) => Promise<void>; // Using void as the original Promise<unknown> didn't convey specific info
  handleSignUp: (userData: SignUpCredentialsType) => Promise<void>; // Same here
  handleSignOut: () => Promise<void>; // And here
  clearError: () => void;
  clearSuccessMessage: () => void;
  setShowSignInModalOnLoad: (showSignInModalOnLoad: boolean) => void; // Already in AuthStateType, might be redundant here depending on usage
};

//backend data response type
export type AuthResponseType = {
  token?: string; // Token might not always be present (e.g., web login)
  user: UserResponseDataType;
  message?: string;
  error: string | null;
};

export interface BaseUserResponseDataType extends BaseUserFields {
  user_id: string;
  currency_id?: number;
  user_role_id?: number;
  currency?: string;
}

//sign-up
export interface SignUpResponseType extends AuthResponseType {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDataType; // Explicitly define user here for clarity
}
export interface UserResponseDataType extends BaseUserResponseDataType {}

//sign-in
export interface SignInResponseType extends AuthResponseType {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDataType; // Explicitly define user here for clarity
}

//authRefreshToken refresh-token
export interface AuthRefreshTokenResponseType extends AuthResponseType {
  user: RefreshTokenUserInfoType;
}
export interface RefreshTokenUserInfoType extends BaseUserResponseDataType {
  user_role_id: number;
  user_role_name: string;
  accessToken: string;
  refreshToken: string;
}