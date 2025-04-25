// src/hooks/useFetchPost.ts
import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { useState, useCallback } from 'react';



//hook state type
type FetchPostStateType<R> = {
  apiData: R | null;
  isLoading: boolean;
  error: string | null;
  status: number | null;
  // message: string | null;
};
// request function type
type FetchPostRequestType<T, R> = (
  url: string,
  body?: T,
  headers?: Record<string, string>
) => Promise<FetchPostStateType<R>>;

// hook return type
type UseFetchPostReturnType<T, R> = FetchPostStateType<R> & {
  request: FetchPostRequestType<T, R>;
};

/**
 * @template T Tipo del cuerpo de la petición body or payload sent.
 * @template R Tipo esperado de la respuesta, response
 * @returns {UseFetchPostReturn<R>} Objeto con estado y función request.
 */
export function useFetchPost<T, R>(): UseFetchPostReturnType<T, R> {
  const [state, setState] = useState<FetchPostStateType<R>>({
    apiData: null,
    isLoading: false,
    error: null,
    status: null,
    // message: null,
  });

  /**
   * Función para realizar la petición POST
   * @template T Tipo del cuerpo de la petición
   * @param url URL del endpoint
   * @param body Cuerpo de la petición
   * @param headers Headers adicionales
   * @returns {Promise<FetchPostStateType<R>>} Promesa con el estado resultante
   */
  const request = useCallback<FetchPostRequestType<T, R>>(
    async (url, body, headers) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        status: null,
        // message: null,
      }));

      console.log(`[useFetchPost] URL: ${url}`, {body}, {headers});

      const config: AxiosRequestConfig = {
        method: 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        data: body,
        withCredentials: true,//send and receive cookies
      };

      try {
        const response: AxiosResponse<R> = await axios(config);
        console.log("🚀 ~ response:", response)

        if (response.status >= 200 && response.status < 300) {
          
          // const responseData = response.data as { data?: R; message?: string };

          const result = {
            apiData: response.data,
            isLoading: false,
            error: null,
            status: response.status,
            // message:  (response.data).message ?? null ,
          };

          setState(result);
          return result;
        }

        throw new Error(`Unexpected status code: ${response.status}`);
        
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err);
        const status = axios.isAxiosError(err)
          ? err.response?.status || 500
          : 500;

        console.error('[useFetchPost] Fetch Error:', errorMessage);

        const result = {
          apiData: null,
          isLoading: false,
          error: errorMessage,
          status,
          // message: null,
        };

        setState(result);
        return result;
      }
    },
    []
  );

  return { ...state, request };
}

/**
 * Helper para obtener mensaje de error consistente
 * @param error Error capturado
 * @returns {string} Mensaje de error
 */
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error occurred';
}

export default useFetchPost;
