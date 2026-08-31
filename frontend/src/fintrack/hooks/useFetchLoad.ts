// src/hooks/useFetchLoad.ts
import axios, { AxiosRequestConfig, Method } from 'axios';
import { useCallback, useState } from 'react';
import { authFetch } from '../../auth/auth_utils/authFetch';

// What a rejected request was, as opposed to what it said.
//
// The server answers a domain error with three things: a stable code naming the
// condition, a sentence for a human, and the values that sentence mentions,
// already parsed. Only the sentence used to survive this hook, so a form could
// tell two rejections apart only by matching English prose — which is
// presentation, and is rewritten and translated.
//
// Branch on code. message is the fallback for a condition that has no code yet.
export type RequestFailureType = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type FetchResponseType<R, D = unknown> = {
  data: R | null;
  isLoading: boolean;
  // The message alone, unchanged. Every existing consumer reads this and none
  // of them has to know the field below exists.
  error: string | null;
  // Present only when the server declared a code. A network failure, an abort
  // or an error the API has not given an identity to leaves this null and
  // fills error, exactly as before.
  failure: RequestFailureType | null;
  requestFn: (
    payload: D,
    overrideConfig?: AxiosRequestConfig,
  ) => Promise<{
    data: R | null;
    error: string | null;
    failure: RequestFailureType | null;
  }>;
  resetFn?: () => void;
};

type useFetchArgType = {
  url: string;
  method: Method;
  initialConfig?: AxiosRequestConfig;
};
/**
 * 🎯 useFetchLoad - Hook para POST/PUT/DELETE requests con autenticación
 * ✅ Data Mutation / Ideal para forms, updates, y operaciones que modifican datos
 * ✅ return functions / Retorna función que puede ser llamada cuando sea necesario
 */
//===================
//🎯 useFetchLoad HOOK
//===================
//Hook for mutations
export function useFetchLoad<R, D = unknown>({
  url: initialUrl,
  method = 'POST',
  initialConfig,
}: useFetchArgType): FetchResponseType<R, D> {
  const [data, setData] = useState<R | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<RequestFailureType | null>(null);

  const requestFn = useCallback(
    async (
      payload: D,
      overrideConfig?: AxiosRequestConfig,
    ): Promise<{
      data: R | null;
      error: string | null;
      failure: RequestFailureType | null;
    }> => {
      setIsLoading(true);
      setError(null);
      setFailure(null);

      let localData: R | null = null; // <- Almacena el valor para retorno inmediato
      let errorMessage: string | null = null;
      let localFailure: RequestFailureType | null = null;

      try {
        // 🎯 Unificar configuración de Axios
        const requestConfig: AxiosRequestConfig = {
          ...initialConfig,
          method,
          url: initialUrl,
          data: payload,
          withCredentials: true,
          ...(overrideConfig || {}), //overrideConfig must come last to overwrite dynamically the url or anything in the initial requestConfig, even method. overrideConfig?.url || initialUrl,
        };

        // ✅ Authentication / USO DE authFetch PARA AUTENTICACIÓN
        const response = await authFetch<R>(requestConfig.url!, requestConfig);
        // console.log("🚀 ~ useFetchLoad ~ response:", response)

        if (response.status >= 200 && response.status < 300) {
          localData = response.data as R;
          setData(localData);
        } else {
          throw new Error(`Unexpected status code: ${response.status}`);
        }
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.data?.message) {
          errorMessage = err.response.data.message;
          setError(errorMessage);

          // The identity, when the server declared one. Read from the same body
          // the message came from, so a rejection arrives whole rather than as
          // the one field that happens to be human-readable.
          const body = err.response.data;

          if (typeof body.error === 'string' && body.error !== '') {
            localFailure = {
              code: body.error,
              message: errorMessage as string,
              ...(body.details ? { details: body.details } : {}),
            };
            setFailure(localFailure);
          }
        }
        // If it's a standard Error (e.g., thrown from authFetch or this function)
        else if (err instanceof Error) {
          errorMessage = err.message;
          setError(errorMessage);
        }
        // Fallback for all other error types
        else {
          errorMessage = 'Unexpected error occurred';
          setError(errorMessage);
        }

        console.error('Error:', errorMessage);
        setData(null);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }

      return { data: localData, error: errorMessage, failure: localFailure }; //inmediate return
    },
    [initialUrl, initialConfig, method],
  );
  // ⬅️Reset Function / Función de reseteo del estado de la mutación (FIX)
  const resetFn = useCallback(() => {
    setData(null);
    setError(null);
    setFailure(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, failure, requestFn, resetFn };
}
