import axios, { AxiosResponse } from 'axios';
import { useEffect, useState } from 'react';

export type FetchResponseType<R> = {
  apiData: R | null;
  isLoading: boolean;
  error: string | null;
  status: number | null;
};

export function useFetch<R>(url: string): FetchResponseType<R> {
  const [state, setState] = useState<FetchResponseType<R>>({
    apiData: null,
    isLoading: false,
    error: null,
    status: null,
  });

  useEffect(() => {

     if (!url) return ;

    const fetchData = async () => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        status: null,
      }));

      try {
        const response: AxiosResponse<R> = await axios.get(url, {
          withCredentials: true,
        });

        setState({
          apiData: response.data,
          isLoading: false,
          error: null,
          status: response.status,
        });
        
      } catch (err: unknown) {
        let errorMessage = 'An unknown error occurred';
        let status: number | null = null;

        if (axios.isAxiosError(err)) {
          errorMessage = err.response?.data?.message || err.message;
          status = err.response?.status ?? null;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

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
