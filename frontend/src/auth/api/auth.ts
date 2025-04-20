// src/auth/api/auth.ts
// (API Interactions)

// For GET requests (if needed later)
// import useFetch from '../../hooks/useFetch'; 
import useFetchPost from '../../hooks/useFetchPost'; // For POST requests

// Define the interface for login credentials
interface LoginCredentialsType {
  username?: string;
  email?: string;
  password: string;
}

// Define the interface for signup credentials
interface SignupCredentialsType extends LoginCredentialsType {
  user_firstname: string;
  user_lastname: string;
}

// Instantiate the useFetchPost hook
// const { request: usePost } = useFetchPost();

// Asynchronous function to send the login request to the backend
export const loginUser = async (credentials: LoginCredentialsType) => {
  return usePost<any>('/api/auth/login', credentials);
};

// Asynchronous function to send the signup request to the backend
export const signupUser = async (userData: SignupCredentialsType) => {
  return usePost<any>('/api/auth/signup', userData);
};

// Asynchronous function to send the refresh token request to the backend
export const refreshTokenRequest = async (refreshToken: string) => {
  return usePost<any>('/api/auth/refresh', { refreshToken });
};

// Asynchronous function to send the logout request to the backend
export const logoutUser = async (refreshToken: string) => {
  return usePost<any>('/api/auth/logout', { refreshToken });
};