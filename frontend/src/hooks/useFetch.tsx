import axios, { AxiosResponse } from 'axios';
import { useEffect, useState } from 'react';

export type FetchResponse<R> = {
  data: R | null;
  isLoading: boolean;
  error: Error | string | null;
};

export function useFetch<R>(url: string): FetchResponse<R> {
  const [data, setData] = useState<R | null>(null); //respuesta - response
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null | string>(null);
  useEffect(() => {
    const fetchData = async (url: string) => {
      setIsLoading(true);
      setError(null);

    console.log('url:', url)

      try {
        const response: AxiosResponse<R> = await axios.get(url);

        if (response.status >= 200 && response.status < 300) {
          const respData = (await response.data) as R;
          console.log('🚀 ~ fetchData ~ respData:', respData);
          setData(await response.data);

        } else {
          const errMsg = `Unexpected status code: ${response.status}`;
          console.log('from useFetch:', errMsg);
          throw new Error(errMsg);
        }
      } catch (err: unknown) {
        if (err) {
          let errorMessage: string | Error | null;
          if (axios.isAxiosError(err) && err.response?.data?.message) {
            errorMessage = err.response.data.message;
          } else if (err instanceof Error) {
            errorMessage = err.message;
          } else {
            errorMessage = 'Unexpected error occurred';
          }

          console.error('Error:', errorMessage);
          setData(null);
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData(url);

    return () => {
      setIsLoading(false);
      setError(null);
      setData(null);
    };
  }, [url]);

  return { data, isLoading, error };
}
