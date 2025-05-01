import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import {
  AuthRefreshTokenResponseType,
  ErrorResponseType,
} from '../types/authTypes';
import { toast } from 'react-toastify';

// Set the base URL for all API requests.
// const baseURL = 'http://localhost:5000/api';
const baseURL = import.meta.env.VITE_API_BASE_URL;
// Create an Axios instance with default settings.
const api: AxiosInstance = axios.create({
  // Enable sending cookies with requests. Crucial for web authentication.
  withCredentials: true,
  // Set the default content type for requests.
  headers: {
    'Content-Type': 'application/json',
  },
});

//-----------------------------------------
// Helper function to handle token refresh

const handleTokenRefresh = async (
  originalRequest: AxiosRequestConfig
): Promise<AxiosResponse> => {
  try {
    const refreshResponse = await axios.post<AuthRefreshTokenResponseType>(
      `${baseURL}/auth/refresh-token`,
      {}, // Body vacío porque usamos cookies
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    //cambiar en el backend para que no tener que traer todo el user
    if (
      refreshResponse.status === 200 &&
      refreshResponse.data.user.refreshToken
    ) {
      // Actualizamos el header de autorización
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers[
        'Authorization'
      ] = `Bearer ${refreshResponse.data.user.accessToken}`;
       sessionStorage.setItem('accessToken', refreshResponse.data.user.accessToken);
       sessionStorage.setItem('refreshToken', refreshResponse.data.user.refreshToken);

      return api(originalRequest); // Usamos la instancia 'api' en lugar de axios directamente
    }

    throw new Error('Failed to refresh token');
  } catch (error) {
    // Redirigimos a login en caso de error
    window.location.href = '/auth/';
    throw new Error(
      'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.'
    );
  }
};
//--------------------------------------------
// Interceptor to handle API responses and errors.
api.interceptors.response.use(
  // This function runs when the response is successful (2xx status codes).
  (response: AxiosResponse) => 

    
  {  toast.success('Operación exitosa'); 
    return response},
  // This function runs when the response is an error (non-2xx status codes).
  async (error: AxiosError<ErrorResponseType>) => {
    // Extract relevant information from the error.
    const { response, config: originalRequest } = error;
    const { status, data } = response || {};

    // Handle network errors (no response from the server).
    if (!response) {
      console.error('Error de red:', error);
      toast.error('Ocurrió un error de red. Verifica tu conexión.');
      throw new Error(
        'Ocurrió un error de red. Por favor, verifica tu conexión a internet.'
      );
    }

    //----------------
    // Handle specific HTTP status codes.
    switch (status) {
      case 400:
        console.error('Petición Incorrecta (400):', data?.message);
        toast.error(data?.message || 'La petición estaba malformada.');
        throw new Error(data?.message || 'La petición estaba malformada.');

      case 401:
        console.error('No Autorizado (401):', data?.message);
        toast.error(data?.message || 'No autorizado. Inicia sesión de nuevo.');
        {
          // Nota los {} que envuelven el bloque case
          console.error('No Autorizado (401):', data?.message);

          // Usamos type assertion más segura que 'any'
          const typedOriginalRequest = originalRequest as AxiosRequestConfig & {
            _retry?: boolean;
          };

          const isTokenExpired =
            data?.message?.toLowerCase().includes('expired') ||
            (status === 401 && originalRequest && !typedOriginalRequest._retry);

          if (isTokenExpired && originalRequest) {
            typedOriginalRequest._retry = true;
            return handleTokenRefresh(originalRequest);
          }

          throw new Error(
            data?.message ||
              'No estás autorizado para acceder a este recurso. Por favor, inicia sesión.'
          );
        }
      //----------
      case 403:
        console.error('Prohibido (403):', data?.message);
        throw new Error(
          data?.message || 'No tienes permiso para acceder a este recurso.'
        );
      case 404:
        console.error('No Encontrado (404):', data?.message);
        throw new Error(
          data?.message || 'No se pudo encontrar el recurso solicitado.'
        );
      case 500:
        console.error('Error Interno del Servidor (500):', data?.message);
        throw new Error(
          data?.message ||
            'Ocurrió un error inesperado en el servidor. Por favor, intenta de nuevo más tarde.'
        );
      case 503:
        console.error('Servicio No Disponible (503):', data?.message);
        throw new Error(
          data?.message || 'El servicio no está disponible temporalmente.'
        );
      default:
        console.error(`Error Inesperado (${status}):`, data?.message);
        throw new Error(
          data?.message || `Ocurrió un error inesperado (Estado: ${status}).`
        );
    }
  }
);

// Export the configured Axios instance for use throughout the application.
export default api;
