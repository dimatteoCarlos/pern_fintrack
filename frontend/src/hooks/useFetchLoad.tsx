import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';

import { useState } from 'react';

export type FetchResponseType<R, D = unknown> = {
  data: R | null;
  isLoading: boolean;
  error: string | null;
  requestFn: (payload: D, overrideConfig?: AxiosRequestConfig) => Promise<void>;
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

  const requestFn = async (payload: D, overrideConfig?: AxiosRequestConfig) => {
    setIsLoading(true);
    setError(null);

    try {
      const config: AxiosRequestConfig = {
        ...initialConfig,
        method,
        url: initialUrl,
        data: payload,
        ...(overrideConfig || {}), //overrideConfig must come last to overwrite dynamic url or anything in the initial config, even method
      };

      console.log(
        'desde useFetch config:',
        config,
        'overrideConfig',
        overrideConfig,
        'url inicial:',
        initialUrl
      );

      const response: AxiosResponse<R> = await axios(config);

      if (response.status >= 200 && response.status < 300) {
        const respData = (await response.data) as R;
        setData(respData);
        // setData(response.data);
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    } catch (err: unknown) {
      if (err) {
        let errorMessage: string;

        // Si es un error de Axios y tiene response.data.message

        if (axios.isAxiosError(err) && err.response?.data?.message) {
          errorMessage = err.response.data.message;
        }
        // Si es un Error estándar
        else if (err instanceof Error) {
          errorMessage = err.message;
        }

        // Cualquier otro caso
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
  };

  return { data, isLoading, error, requestFn };
}
