import axios from 'axios';
import { useEffect, useState } from 'react';
import { authFetch } from '../auth/utils/authFetch';

export type FetchResponseType<R> = {
  apiData: R | null;
  isLoading: boolean;
  error: string | null;
  status: number | null;
};
/**
 * 🎯 useFetch - Hook para GET requests con autenticación
 * ✅ Ideal para fetching de datos al montar componentes
 * ✅ Usa authFetchTyped para autenticación automática
 */
export function useFetch<R>(url: string | null): FetchResponseType<R> {
// console.warn('url from useFetch', url)

  const [state, setState] = useState<FetchResponseType<R>>({
    apiData: null,
    isLoading: false,
    error: null,
    status: null,
  });

  useEffect(() => {
     if (!url) {
      console.log('return url null')
      return
     } 

    const fetchData = async () => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        status: null,
      }));

    try {
    // ✅ USAGE OF authFetch
      const response = await authFetch<R>(url);
      // console.log("🚀 ~ fetchData ~ response:", response)
    //const finalPayload = response.data.data
        setState({
          apiData: response.data,
          isLoading: false,
          error: null,
          status: response.status,
        });

    } catch (err: unknown) {
      let errorMessage = 'An unknown error occurred';
      let status: number | null = null;
      let isDataNotFoundError = false;

  // ✅ Axios handling errors
  if (axios.isAxiosError(err)) {
    status = err.response?.status ?? null;
      errorMessage = err.response?.data?.message || err.message;
      if (status === 404 || status === 400) {
        // Verifica si el mensaje es de "no data found"
        const noDataMessages = ["No accounts of type:", "No transactions encountered", "No available accounts"];
        if (noDataMessages.some(msg => errorMessage.includes(msg))) {
          isDataNotFoundError = true;
        }
      }
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }
//----------------------------
// Si es un error de "No data found", no tratarlo como un error de la aplicación.
    if (isDataNotFoundError) {
      console.warn(`[useFetch] Expected Data Not Found (Status ${status}):`, errorMessage);
      setState({
        apiData: null, // Deja los datos como nulos, pero no es un error fatal
        isLoading: false,
        error: null, // IMPORTANTE: Establece el error como null
        status,
      });
      
      return; // Termina la ejecución aquí
    }
    //----------------------------
    console.error('[useFetch] Fetch error:', errorMessage, 'status' , status);

    setState({
      apiData: null,
      isLoading: false,
      error: errorMessage,
      status,
    });
      }
    };

    fetchData();
  }, [url]);

  return state;
}
