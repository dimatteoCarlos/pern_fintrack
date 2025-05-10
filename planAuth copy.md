Plan de Implementación Detallado de Autenticación
Aquí tienes el plan de implementación completo, organizado por macroactividades y actividades detalladas:

Configuración de Axios Instance + Interceptors

Objetivo: Establecer la base para la comunicación con el backend, centralizando el manejo de peticiones y respuestas.

Tareas:

Instalar la biblioteca Axios.

Crear el archivo api.ts.

Configurar la instancia de Axios con la URL base y las opciones necesarias.

Implementar los interceptores de Axios para:

Agregar el token de autenticación a las peticiones.

Manejar los errores de respuesta HTTP.

Detectar y manejar la expiración del token.

Intentar renovar el token automáticamente.

Manejar errores irrecuperables.

Exportar la instancia de Axios configurada.

Integración con Zustand

Objetivo: Utilizar Zustand para gestionar el estado de autenticación de la aplicación.

Tareas:

Crear el store useAuthStore.ts.

Definir el estado inicial del store.

Definir las acciones del store para:

Establecer el estado de autenticación al iniciar sesión.

Limpiar el estado de autenticación al cerrar sesión.

Actualizar el accessToken después de una renovación.

Manejar errores

Conectar el interceptor de Axios con el store de Zustand.

Adaptación de los Hooks de Fetch Existentes

Objetivo: Adaptar tus hooks useFetch existentes para utilizar la instancia de Axios configurada.

Tareas:

Modificar el hook useFetch para usar Axios.

Asegurarse de que el hook maneje los errores de Axios.

Refactorizar el hook useFetch para que sea más genérico (si es necesario).

Mover lógica de manejo de errores al interceptor.

Manejo de Session Timeout y Refresh Token

Objetivo: Implementar la lógica para manejar la expiración del accessToken y utilizar el refreshToken.

Tareas:

En el interceptor de Axios:

Detectar el error 401 (token expirado).

Verificar si ya se está renovando el token.

Enviar una petición al endpoint /api/auth/refresh-token.

Si la petición es exitosa:

Actualizar el token en Zustand.

Reintentar la petición original.

Si la petición falla:

Cerrar la sesión del usuario.

Redirigir a la página de inicio de sesión.

Protección de Rutas

Objetivo: Conectar el frontend con el backend para proteger las rutas de la aplicación.

Tareas:

Utilizar el componente ProtectedRoute de React Router.

Modificar ProtectedRoute para que:

Lea el estado isAuthenticated de Zustand.

Permita el acceso a la ruta si el usuario está autenticado.

Redirija al usuario a la página de inicio de sesión si no lo está.

Asegurarse de que el estado isAuthenticated se actualice correctamente.

Ajuste de ProtectedRoute

Objetivo: Asegurar el correcto funcionamiento del componente.

Tareas:

Modificar el componente ProtectedRoute para que:

Escuche los cambios en el estado isAuthenticated de Zustand.

Redirija al usuario a la página de inicio de sesión si el estado es falso.

Renderice el componente envuelto si el estado es verdadero.

Pruebas Manuales

Objetivo: Verificar manualmente que la autenticación funciona correctamente en todos los escenarios.

Tareas:

Realizar pruebas exhaustivas para verificar:

Inicio de sesión y registro.

Navegación a rutas protegidas.

Manejo de la expiración del token.

Cierre de sesión.

Comportamiento en web y móvil.

Manejo de errores de autenticación.

Persistencia de sesión.


***********************
Mensajes de Error HTTP para la API
Para estandarizar la comunicación de errores entre tu frontend y backend, te propongo la siguiente lista de mensajes de error HTTP con sus correspondientes códigos de estado. Es importante que tu backend responda con estos códigos y mensajes (o mensajes similares) para que el frontend pueda manejarlos de manera consistente.

Código de Estado

Mensaje para el Usuario (Español)

Descripción

400

Petición incorrecta.

El servidor no pudo entender la petición debido a una sintaxis inválida. El cliente debe modificar la petición.

401

No autorizado.

El cliente no ha proporcionado las credenciales de autenticación válidas. El cliente debe autenticarse antes de realizar esta petición.

403

Prohibido.

El cliente no tiene permiso para acceder al recurso solicitado. Esto es diferente de 401, ya que la autenticación fue exitosa, pero el usuario no tiene los derechos de acceso necesarios.

404

No encontrado.

El servidor no pudo encontrar el recurso solicitado. Esto puede deberse a una URL incorrecta o a que el recurso no existe.

500

Error interno del servidor.

El servidor encontró un error inesperado que le impidió completar la petición. Esto suele ser un problema del servidor y no del cliente.

503

Servicio no disponible.

El servidor no está listo para manejar la petición. Esto puede deberse a que el servidor está caído por mantenimiento o está sobrecargado.

Nota Importante:

Es crucial que el backend sea consistente al enviar estos códigos de estado.

Los mensajes de error en español están pensados para ser mostrados al usuario final.

En el código (interceptores de Axios), los comentarios deben estar en inglés.

Explicación de api.interceptors.response.use en Axios
La función api.interceptors.response.use en Axios define dos funciones:

Función para respuestas exitosas: Esta función se ejecuta cuando la respuesta del servidor tiene un código de estado 2xx (por ejemplo, 200 OK, 201 Created).

Función para respuestas de error: Esta función se ejecuta cuando la respuesta del servidor tiene un código de estado diferente de 2xx (por ejemplo, 400, 401, 500).

¿Cómo sabe Axios si una respuesta es exitosa?

Axios, internamente, verifica el código de estado HTTP de la respuesta del servidor. Si el código de estado está dentro del rango 200-299, Axios considera que la respuesta es exitosa y ejecuta la primera función proporcionada a api.interceptors.response.use. Si el código de estado está fuera de este rango, Axios considera que la respuesta es un error y ejecuta la segunda función.

¿Cómo captura el frontend los mensajes de error?

El frontend captura los mensajes de error dentro de la función de manejo de errores del interceptor de Axios. En el código de api.ts, esta función es el segundo argumento de api.interceptors.response.use:

api.interceptors.response.use(
  (response: AxiosResponse) => response, // Función para respuestas exitosas
  async (error: AxiosError<ErrorResponse>) => { // Función para respuestas de error
    // ... (código para manejar el error)
  },
);

Cuando Axios recibe una respuesta con un código de estado de error (por ejemplo, 401), crea un objeto AxiosError que contiene información sobre el error (código de estado, mensaje, etc.) y lo pasa como argumento a esta función. Dentro de esta función, puedes acceder a la información del error a través del parámetro error y realizar las acciones necesarias (mostrar un mensaje al usuario, redirigir, etc.).

¿Cuándo se ejecutan los interceptores?

Los interceptores de Axios se ejecutan automáticamente durante el ciclo de vida de una petición HTTP:

Interceptores de petición (request): Se ejecutan antes de que la petición se envíe al servidor.

Interceptores de respuesta (response): Se ejecutan después de que se recibe una respuesta del servidor, pero antes de que la respuesta se devuelva al código que inició la petición.

En resumen, los interceptores de respuesta te permiten interceptar y modificar las respuestas del servidor (tanto exitosas como de error) antes de que tu aplicación las procese. Esto te permite centralizar la lógica de manejo de errores, la autenticación, y otras tareas comunes.
**************************
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Set the base URL for all API requests. This is where your backend lives.
const baseURL: string = 'http://localhost:5000/api';

// Create an Axios instance with default settings.
const api: AxiosInstance = axios.create({
  baseURL,
  // Enable sending cookies with requests. Crucial for web authentication.
  withCredentials: true,
  // Set the default content type for requests.
  headers: {
    'Content-Type': 'application/json',
  },
});

// Define a type for the error response data, adjust this to match your backend's error structure
interface ErrorResponse {
  message?: string;
  // Add other properties as needed, e.g.,
  // code?: number;
  // fields?: { [key: string]: string };
}

// Interceptor to handle API responses and errors. This is where we centralize error handling.
api.interceptors.response.use(
  // This function runs when the response is successful (2xx status codes).
  (response: AxiosResponse) => response,
  // This function runs when the response is an error (non-2xx status codes).
  async (error: AxiosError<ErrorResponse>) => {
    // Extract relevant information from the error.
    const { response, config: originalRequest } = error;
    const { status, data } = response || {};

    // Handle network errors (no response from the server).
    if (!response) {
      console.error('Network Error:', error);
      throw new Error('A network error occurred. Please check your internet connection.');
    }

    // Handle specific HTTP status codes.
    switch (status) {
      case 400:
        console.error('Bad Request (400):', data?.message);
        throw new Error(data?.message || 'The request was malformed.');
      case 401:
        console.error('Unauthorized (401):', data?.message);
        // Check if the error is specifically due to an expired access token.
        if (data?.message === 'Token expired') {
          // Attempt to refresh the access token.
          try {
            // Use the correct type for originalRequest
            const refreshResponse: AxiosResponse = await axios.post(`${baseURL}/auth/refresh-token`, {}, { withCredentials: true });
            if (refreshResponse.status === 200) {
              // If the refresh is successful, retry the original request.
              return api.request(originalRequest as AxiosRequestConfig);
            }
          } catch (refreshError: any) {
            // If the refresh fails (refresh token expired or invalid), redirect to login.
            window.location.href = '/auth/sign-in';
            throw new Error("Your session has expired. Please log in again.");
          }
        } else {
          // For other 401 errors (e.g., invalid credentials), throw a standard "Unauthorized" error.
          throw new Error(data?.message || 'You are not authorized to access this resource. Please log in.');
        }
      case 403:
        console.error('Forbidden (403):', data?.message);
        throw new Error(data?.message || "You don't have permission to access this resource.");
      case 404:
        console.error('Not Found (404):', data?.message);
        throw new Error(data?.message || 'The requested resource could not be found.');
      case 500:
        console.error('Internal Server Error (500):', data?.message);
        throw new Error(data?.message || 'An unexpected error occurred on the server. Please try again later.');
      default:
        console.error(`Unexpected Error (${status}):`, data?.message);
        throw new Error(data?.message || `An unexpected error occurred (Status: ${status}).`);
    }
  },
);

// Export the configured Axios instance for use throughout the application.
export default api;

