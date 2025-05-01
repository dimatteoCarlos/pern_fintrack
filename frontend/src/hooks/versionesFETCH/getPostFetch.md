¡Perfecto!  
Te voy a explicar **claro y conciso** cómo fusionar `useFetch` y `useFetchPost` en un **solo hook genérico** llamado, por ejemplo, `useApiRequest`. 🚀

---

# 🎯 Idea general
- Manejar cualquier método HTTP (`GET`, `POST`, `PUT`, `DELETE`, etc.).
- Usar **un solo estado** (`{ apiData, isLoading, error, status }`).
- Solo cambiar el método (`GET` o `POST`) al llamar la función `request`.
- El hook será **perezoso**: no dispara solo, sino que tú llamas `request()` cuando quieras (como `useFetchPost`).

---

# 🛠 Aquí el código completo de `useApiRequest.ts`:

```tsx
import { useState, useCallback } from 'react';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

type ApiRequestState<R> = {
  apiData: R | null;
  isLoading: boolean;
  error: string | null;
  status: number | null;
};

type ApiRequestFunction<T, R> = (
  url: string,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: T,
  headers?: Record<string, string>
) => Promise<ApiRequestState<R>>;

type UseApiRequestReturn<T, R> = ApiRequestState<R> & {
  request: ApiRequestFunction<T, R>;
};

export function useApiRequest<T = unknown, R = unknown>(): UseApiRequestReturn<T, R> {
  const [state, setState] = useState<ApiRequestState<R>>({
    apiData: null,
    isLoading: false,
    error: null,
    status: null,
  });

  const request = useCallback<ApiRequestFunction<T, R>>(async (url, method = 'GET', body, headers) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, status: null }));

    try {
      const config: AxiosRequestConfig = {
        url,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        withCredentials: true,
        ...(body && { data: body }),
      };

      const response: AxiosResponse<R> = await axios(config);

      const result = {
        apiData: response.data,
        isLoading: false,
        error: null,
        status: response.status,
      };

      setState(result);
      return result;

    } catch (err: unknown) {
      let errorMessage = 'Unknown error';
      let status = null;

      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.message || err.message;
        status = err.response?.status ?? null;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      console.error('[useApiRequest] Error:', errorMessage);

      const result = {
        apiData: null,
        isLoading: false,
        error: errorMessage,
        status,
      };

      setState(result);
      return result;
    }
  }, []);

  return { ...state, request };
}
```

---

# 🔥 ¿Cómo usarlo?

## Para un `GET`
```tsx
const { apiData, isLoading, error, request } = useApiRequest<null, YourResponseType>();

useEffect(() => {
  request('/api/items', 'GET');
}, []);
```

---

## Para un `POST`
```tsx
const { apiData, isLoading, error, request } = useApiRequest<YourRequestBodyType, YourResponseType>();

const handleCreate = () => {
  request('/api/items', 'POST', { name: 'Nuevo item' });
};
```

---

# ✅ Ventajas de `useApiRequest`
- No duplicas lógica.
- Es flexible para **cualquier método**.
- Mejor control del `state`.
- Más profesional para escalar tu app (industrial quality).

---

# 📌 Resumen visual rápido:

| Propiedad | Qué hace |
|:---|:---|
| `apiData` | Los datos de la respuesta |
| `isLoading` | `true` mientras espera la respuesta |
| `error` | Error de la petición si ocurre |
| `status` | Código HTTP (200, 404, 500, etc.) |
| `request()` | Función para disparar `GET`, `POST`, `PUT`, `DELETE` |

---

¿Quieres que además te pase una **versión avanzada** que incluya **auto-disparo para `GET`** si pasas `autoFetch: true` (como `useFetch`) y **modo manual** para `POST`? 🚀  
(Es fácil agregarlo si quieres ultra optimizar).  
¿Te lo preparo?