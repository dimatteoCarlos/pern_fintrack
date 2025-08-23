import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { useState } from 'react';

export type FetchResponseType<R, D = unknown> = {
  data: R | null;
  isLoading: boolean;
  error: string | null;
  requestFn: (payload: D, overrideConfig?: AxiosRequestConfig) => Promise<{ data: R | null; error: string | null }>;
};

type useFetchArgType = {
  url: string;
  method: Method;
  initialConfig?: AxiosRequestConfig;
};

export function useFetchLoad<R, D = unknown>({
  url: initialUrl,
  method = 'POST',
  initialConfig,
}: useFetchArgType): FetchResponseType<R, D> {
  const [data, setData] = useState<R | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestFn = async (payload: D, overrideConfig?: AxiosRequestConfig):Promise<{ data: R | null; error: string | null }> => {
    setIsLoading(true);
    setError(null);

    let localData: R | null = null;  // <- Almacena el valor para retorno inmediato
    let errorMessage: string | null = null;

    try {
      const config: AxiosRequestConfig = {
        ...initialConfig,
        method,
        url: initialUrl,
        data: payload,
        withCredentials: true,
        ...(overrideConfig || {}), //overrideConfig must come last to overwrite dynamically the url or anything in the initial config, even method
      };

      // console.log(
      //   'desde useFetch config:',
      //   config,
      //   'overrideConfig',
      //   overrideConfig,
      //   'url inicial:',
      //   initialUrl
      // );

      const response: AxiosResponse<R> = await axios(config);

      if (response.status >= 200 && response.status < 300) {
        localData = response.data as R;
        setData(localData);
        // setData(response.data);
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    } catch (err: unknown) {
      if (err) {
          errorMessage = 'Unexpected error occurred';

        // Si es un error de Axios y tiene response.data.message

        if (axios.isAxiosError(err) && err.response?.data?.message) {
          errorMessage = err.response.data.message;
        }
        // Si es un Error estándar
        else if (err instanceof Error) {
          errorMessage = err.message;
        }

        // Cualquier otro caso error para uso inmediato.
        else {
          errorMessage = 'Unexpected error occurred';
        }

        console.error('Error:', errorMessage);
        setData(null);
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
    
  return { data:localData,  error:errorMessage }; //inmediate return
  };

  return { data, isLoading, error, requestFn };
}
