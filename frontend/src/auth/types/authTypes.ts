//📁 frontend/src/auth/types/authTypes.ts

import { CurrencyType } from '../../fintrack/types/types';

//used in: AuthUI.tsx, useAuth.ts
export type CredentialsType = {
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  password: string;
  confirmPassword?: string;
};

//used in: AuthPage.tsx, useAuth.ts
export type SignInCredentialsType = {
  username: string;
  email: string;
  password: string;
};

export type SignUpCredentialsType = SignInCredentialsType & {
  user_firstname: string;
  user_lastname: string;
  confirmPassword: string;
};

// ===============
// 🏪 STORE TYPES
// ===============
//--useAuthStoreTypes
export type AuthStoreStateType<U> = {
  // 🔐 Authentication state
  isAuthenticated: boolean;
  setIsAuthenticated: (isAuthenticated: boolean) => void;

  // 👤 User data
  userData: U | null;

  // ⏳ Loading states
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;

  isCheckingAuth: boolean;
  setIsCheckingAuth: (isCheckingAuth: boolean) => void;

  // ❌ Error handling
  error: string | null;
  setUserData: (userData: U | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // ✅ Success messages
  successMessage: string | null;
  setSuccessMessage: (successMessage: string | null) => void;
  clearSuccessMessage: () => void;
};

//backend data response type. Common for all auth responses, as for Sign-in,Sign-up and refresh token
export type AuthSuccessResponseType = {
  message: string;
  accessToken: string; // Siempre presente en login/register/refresh
  user: UserResponseDataType;
  expiresIn: number;
};
// If SignIn and SignUp use the same structure then:
// export type SignInResponseType = AuthSuccessResponse;
// export type SignUpResponseType = AuthSuccessResponse;

//sign-out
//R:check if it is usable
// export type SignOutResponseType = {
//   message: string;
// };
//------------
//sign-up
// export type SignUpResponseType= {
//   message: string;
//   accessToken?: string;
//   user:UserResponseDataType;
//   expiresIn: number;
//   refreshToken?: string;//R:check if it's usable

//   // data: DataRespType;
// }
// export type DataRespType ={user: UserResponseDataType;
//   userAccess: string;}//R: checi if it's usable

// =====================
// 👤 USER TYPES / TIPOS DE USUARIO
// =====================
export type UserResponseDataType = {
  user_id: string;
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  role: string;
  currency: CurrencyType;
  user_contact: string | null;
};

//input type user info
// export type UserDataType = Partial<UserResponseDataType>
export type UserDataType = {
  user_id: string; //| null;
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  currency: CurrencyType;
  role: string;
  contact: string | null;
};
//-------------------------------
//sign-in
export type SignInResponseType = {
  message: string;
  accessToken: string;
  user: UserResponseDataType;
  expiresIn: number;
};

//authRefreshToken refresh-token
//R: chek if it's usable
// export interface AuthRefreshTokenResponseType {
//   message: string;
//   user: RefreshTokenUserInfoType | { [key: string]: string };
//   expiresIn?: number;
// }
//R: chek if it's usable
// export interface RefreshTokenUserInfoType {
//   user_id: string;
//   username: string;
//   email: string;
//   user_role_id: number;
//   user_role_name: string;
//   accessToken: string;
//   refreshToken: string;
// }

// Define the success response format for the frontend
export interface SuccessResponseType<T> {
  // Make SuccessResponse generic
  message: string; // Success message
  data?: T; // Optional: Response data, now of type T
  accessToken?: string; // Optional: Access token
  refreshToken?: string; // Optional: Refresh token
}

// ===============
// 🚨 USER PROFILE UPDATE AND PASSWORD CHANGE
// ===============

export type UpdateProfileFormDataType = {
  firstname: string;
  lastname: string;
  currency: CurrencyType;
  contact: string | null;
};

export type UpdateProfileResponseUserType = {
  user_id: string;
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  user_contact: string;
  currency_id: number;
  currency: CurrencyType;
  role: string;
};
// ===============
// 🚨 ERROR TYPES
// ===============
//Error format backend response
export type ErrorResponseType = {
  status: number; //  HTTP status code
  error: string;
  message: string; //  Descriptive error messager
  details?: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  };
  //  Detailed error information optional
  timestamp?: string; // Timestamp of the error (opcional)
};

export type AuthErrorType =
  | { type: 'validation'; fieldErrors: Record<string, string[]> }
  | { type: 'rate_limit'; retryAfter: number }
  | { type: 'session_expired' }
  | { type: 'network'; message: string };

export type FormErrorsType<TFieldName extends string> = Partial<
  Record<TFieldName, string>
> & {
  form?: string;
};

//-----------------------------------
//ALIGN BE AND FE
//UPDATE PASSWORD CHANGE
// authTypes.ts

// -------------------------------------
// 🔐 Password Change API Responses
// -------------------------------------
// ---------------------------------------
// Normalized response for Change Password
// ---------------------------------------
/**
 * 🎯 Unified result type for password change operations
 * Matches backend response structure exactly
 refs: ChangePasswordContainer, useAuth, useChangePasswordFromLogic, 
 */
export type ChangePasswordResultType =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
      message: string;
      fieldErrors?: Record<string, string[]>; // ✅ Matches backend: Record<string, string[]>
      retryAfter?: number;
    };

/**
* 📝 Change Password Form Data
* Defines the strict structure for password update fields
ref: ChangePasswordContainer.tsx, ChangePasswordForm.tsx, useChangePasswordFormLogic.ts, useChangePasswordValidation.ts
*/
export type ChangePasswordFormDataType = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// 1️⃣ Success response
// 2️⃣ API Raw Responses (Matching BE Middleware)
export type ChangePasswordSuccessResponse = {
  success: true;
  message: string; // e.g., "Password changed successfully. Please sign in again."
};

// Error (The most common one from your validateRequestSync)
export type ChangePasswordErrorResponse = {
  success: false;
  error: string; // e.g., "ValidationError" o "InvalidCredentials"
  message: string;
  // details?: {
  //   fieldErrors?: Record<string, string[]>;
  //   formErrors?: string[];
  // };
  fieldErrors?: Record<string, string[]>; // Fallback para otros middlewares
  retryAfter?: number; // Capturado por el limiter antes del validador
};

// 2️⃣ Generic failure
export type ChangePasswordFailureResponse = {
  success: false;
  error: string; // e.g., "InvalidCredentials"
  message?: string;
};

// 3️⃣ Rate limiter triggered (HTTP 429)
export type ChangePasswordRateLimitResponse = {
  success: false;
  error: 'ChangePasswordRateLimitExceeded';
  message: string;
  retryAfter: number; // in seconds, backend-defined
};

// 4️⃣ Validation errors (future-proof, if backend starts returning fieldErrors)
export type ChangePasswordValidationErrorResponse = {
  success: false;
  fieldErrors: Record<string, string[]>; // e.g., { newPassword: ["Too short"] }
};

export type ChangePasswordResponseType =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
      message?: string;
      fieldErrors?: Record<string, string[]>;
      retryAfter?: number;
    };

//-----------------------------------
//ALIGN BE AND FE
//UPDATE USER PROFILE
//used: useAuth.ts,
// 🎯 INPUT (PATCH payload)
export type ProfileUpdatePayloadType = Partial<{
  firstname: string;
  lastname: string;
  contact: string | null;
  currency: CurrencyType;
}>;
// ------------------------------
// Normalized response for Update Profile
// ------------------------------
//used: UpdateProfileContainer.tsx, useUpdatePRofileFormLogic.ts
export type NormalizedProfileUpdateResultType = {
  success: boolean;
  error?: string;
  // fieldErrors: Record<string, string>;
  fieldErrors?: Record<string, string[] | string>;
  message?: string;
  retryAfter?: number;
  sessionExpired?: boolean;
};

// 🎯 UNION RESPONSE
export type ProfileUpdateSuccessResponseType = {
  success: true;
  user: UpdateProfileResponseUserType; //UserDataType;        // <-- aquí debe estar
  message?: string;
};

export type ProfileUpdateErrorResponseType = {
  success: false;
  error: string;
  message: string;
  fieldErrors?: Record<string, string>;
  retryAfter?: number;
};

// ===============================
// 🆔 USER IDENTITY FOR PERSISTENCE
// ===============================

/**
 * 🎯 User identity stored in localStorage for UX convenience
 *
 * 🔒 SECURITY NOTES:
 * - Only used for pre-filling login forms
 * - NEVER contains tokens, passwords, or sensitive data
 * - Backend NEVER trusts this data
 * - Pure UX optimization
 */
export type UserIdentityType = {
  /** 👤 User's email for login form pre-fill */
  email: string;

  /** 👤 User's username for login form pre-fill */
  username: string;

  /** ✅ Whether user wants to be remembered */
  rememberMe: boolean;
};

// ===============================
// 🆔 UI STATE STORE TYPE
// ===============================
//used in: useAuthUIStore.ts
export type AuthUIStateType =
  | 'IDLE'
  | 'SIGN_IN'
  | 'SIGN_UP'

// ===============================
// 📦 EXPORTS (existing)
// ===============================
export type ProfileUpdateResponseType =
  | ProfileUpdateSuccessResponseType
  | ProfileUpdateErrorResponseType;

// ===============================
// 🎯 AUTH INTENT - Navigation Events
// ===============================

/**
 * AuthIntent - Events that trigger navigation with state
 * 
 * An intent represents a ONE-TIME event that travels via navigation.state
 * and is consumed by the appropriate component.
 * 
 * - password_changed: User successfully changed password
 * - session_expired: Token expired while user had active session
 * - user_logged_out: User explicitly clicked Sign Out
 * - welcome_new_user: User signed up for the first time
 */

export type AuthIntentType = 
  | 'password_changed'
  | 'session_expired'
  // | 'user_logged_out'
  // | 'welcome_new_user';

/**
 * NavigationState - Structure for navigate() state parameter
 * 
 * Travels in location.state and is consumed by:
 * - AuthPage (for password_changed, session_expired, user_logged_out)
 * - FintrackLayout (for welcome_new_user)
 */
export type NavigationStateType = {
  intent?: AuthIntentType;
  email?: string;
  username?: string;
  from?: string;
};



