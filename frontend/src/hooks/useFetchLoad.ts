// src/hooks/useFetchLoad.ts
import axios, { AxiosRequestConfig,  Method } from 'axios';
import { useCallback, useState } from 'react';
import { authFetch } from '../auth/utils/authFetch';

export type FetchResponseType<R, D = unknown> = {
  data: R | null;
  isLoading: boolean;
  error: string | null;
  requestFn: (payload: D, overrideConfig?: AxiosRequestConfig) => Promise<{ data: R | null; error: string | null }>;
  resetFn?:()=>void;
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

  const requestFn = useCallback(async (payload: D, overrideConfig?: AxiosRequestConfig):Promise<{ data: R | null; error: string | null }> => {
    setIsLoading(true);
    setError(null);

    let localData: R | null = null;  // <- Almacena el valor para retorno inmediato
    let errorMessage: string | null = null;

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
  
return { data:localData,  error:errorMessage }; //inmediate return
  },[initialUrl, initialConfig,method]);
// ⬅️Reset Function / Función de reseteo del estado de la mutación (FIX)
  const resetFn = useCallback(() => {
   setData(null);
   setError(null);
   setIsLoading(false);
    }, []);

  return { data, isLoading, error, requestFn, resetFn };
}
