

Macroactividades Completas para la Autenticación
Aquí están todas las macroactividades necesarias para implementar la autenticación en tu aplicación, desde la configuración inicial hasta las pruebas:

Configuración de Axios Instance + Interceptors

Objetivo: Establecer la base para la comunicación con el backend, centralizando el manejo de peticiones y respuestas.

Tareas:

Instalar la biblioteca Axios.

CREAR EL ARCHIVO API.TS.

import axios from 'axios';

// Define la URL base de la API.  Esto evita tener que repetirla en cada petición.
const baseURL = 'http://localhost:5000/api';

// Crea una instancia de Axios con la configuración deseada.
const api = axios.create({
  baseURL,
  // Permite el envío de cookies en las peticiones (necesario para la autenticación en web).
  withCredentials: true,
  // Define el tipo de contenido por defecto de las peticiones.
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para manejar las respuestas de la API.  Aquí centralizamos el manejo de errores.
api.interceptors.response.use(
  // Esta función se ejecuta cuando la respuesta es exitosa (status 2xx).
  (response) => response,
  // Esta función se ejecuta cuando la respuesta es un error (status distinto de 2xx).
  async (error) => {
    // Extrae la información importante del error.
    const { response, config: originalRequest } = error;
    const { status, data } = response || {};

    // Manejo de errores de red (no hay respuesta del servidor).
    if (!response) {
      console.error('Error de red:', error);
      throw new Error('Error de red. Por favor, verifica tu conexión a internet.');
    }

    // Manejo de errores específicos basados en el código de estado HTTP.
    switch (status) {
      case 400:
        console.error('Error 400 (Petición Incorrecta):', data.message);
        throw new Error(data.message || 'Petición incorrecta.');
      case 401:
        console.error('Error 401 (No Autorizado):', data.message);
        // Aquí es donde manejaremos la expiración del token y el refresh token.
        // Por ahora, lanzamos un error genérico.  Luego implementaremos la lógica de refresh.
        //throw new Error(data.message || 'No autorizado. Por favor, inicia sesión nuevamente.');
         if (data?.message === 'Token expired') {
            // Intenta refrescar el token
            try {
                const refreshResponse = await axios.post(`${baseURL}/auth/refresh-token`, {}, { withCredentials: true });
                if (refreshResponse.status === 200) {
                    // Si el refresh es exitoso, reintenta la petición original
                    return api.request(originalRequest);
                }
            } catch (refreshError: any) {
                // Si el refresh falla, redirige al login
                window.location.href = '/auth/sign-in';
                throw new Error("Session expired, please log in again."); //TODO ver si es necesario este error
            }
          }
          else{
             throw new Error(data.message || 'No autorizado. Por favor, inicia sesión nuevamente.');
          }

      case 403:
        console.error('Error 403 (Prohibido):', data.message);
        throw new Error(data.message || 'No tienes permiso para acceder a este recurso.');
      case 404:
        console.error('Error 404 (No Encontrado):', data.message);
        throw new Error(data.message || 'Recurso no encontrado.');
      case 500:
        console.error('Error 500 (Error Interno del Servidor):', data.message);
        throw new Error(data.message || 'Error interno del servidor. Inténtalo de nuevo más tarde.');
      default:
        console.error(`Error ${status}:`, data.message);
        throw new Error(data.message || `Error desconocido: ${status}`);
    }
  }
);

// Exporta la instancia de Axios configurada para que pueda ser utilizada en otros módulos.
export default api;


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