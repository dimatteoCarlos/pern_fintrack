### 🔥 **Código Mejorado de Axios con Autenticación JWT Completa**

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { authStore } from '../stores/auth'; // Ajusta la ruta según tu store de Zustand

const baseURL = import.meta.env.VITE_API_BASE_URL;

// 1. Configuración inicial de Axios
const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Tipo para errores de API
interface ApiError {
  message: string;
  code?: string;
}

// 3. Variables para controlar el refresco del token
let isRefreshing = false;
let failedRequestsQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: AxiosError) => void;
}> = [];

// 4. Interceptor de Request (añade token automáticamente)
api.interceptors.request.use((config) => {
  const token = authStore.getState().token; // O localStorage.get('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 5. Interceptor de Response (manejo avanzado de errores)
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config;
    
    // Caso especial: Token expirado (401)
    if (error.response?.status === 401 && error.response.data?.message === 'Token expired') {
      
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          // Intenta refrescar el token
          const { data } = await axios.post(`${baseURL}/auth/refresh-token`, {}, { 
            withCredentials: true 
          });
          
          const newToken = data.accessToken;
          authStore.getState().setToken(newToken); // Actualiza Zustand
          
          // Reintenta todas las peticiones en cola
          failedRequestsQueue.forEach(request => request.resolve(newToken));
          failedRequestsQueue = [];
          
          // Reintenta la petición original
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
          
        } catch (refreshError) {
          // Falló el refresh token - logout
          failedRequestsQueue.forEach(request => request.reject(refreshError));
          authStore.getState().logout();
          window.location.href = '/auth/sign-in';
          return Promise.reject(refreshError);
          
        } finally {
          isRefreshing = false;
        }
      }
      
      // Si ya se está refrescando, encola la petición
      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject: (err: AxiosError) => {
            reject(err);
          }
        });
      });
    }
    
    // Otros errores
    const errorMessage = error.response?.data?.message || 'Error de conexión';
    const errorCode = error.response?.status || 500;
    
    console.error(`[API Error ${errorCode}]: ${errorMessage}`);
    return Promise.reject(error);
  }
);

export default api;
```

### 🛠 **Mejoras Clave Implementadas**

1. **Interceptor de Request**  
   - Añade automáticamente el token JWT a cada petición.

2. **Manejo Avanzado de 401**  
   - Cola de peticiones fallidas mientras se refresca el token.  
   - Evita múltiples llamadas a `/refresh-token`.

3. **Sincronización con Zustand**  
   - Actualiza el store al obtener nuevo token.  
   - Limpieza de estado en logout.

4. **Tipado Mejorado**  
   - Interfaces claras para errores y respuestas.

5. **Seguridad**  
   - Cookies HTTP-only para refresh tokens.  
   - Tokens en memoria (no localStorage).

### 📌 **Cómo Usarlo**
```typescript
// Ejemplo de uso en componentes
import api from './lib/api';

const fetchData = async () => {
  try {
    const { data } = await api.get('/protected-route');
    return data;
  } catch (error) {
    // Los errores 401 ya están manejados automáticamente
    console.error('Error en la petición:', error);
  }
};
```

¿Necesitas ajustar algún comportamiento específico? 🚀