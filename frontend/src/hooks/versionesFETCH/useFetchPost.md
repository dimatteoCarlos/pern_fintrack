// src/hooks/useFetchPost.ts
import { useState } from 'react';
import api from '../../api'; // Imports the Axios instance
import { AxiosRequestConfig, Method } from 'axios';

export type FetchResponseType<R, D = unknown> = {
  data: R | null;
  isLoading: boolean;
  error: string | null;
  requestFn: (payload: D, overrideConfig?: AxiosRequestConfig) => Promise<R | null>; // Changed the return type of requestFn
};

type useFetchArgType = {
  url: string;
  method?: Method;
  initialConfig?: AxiosRequestConfig;
};

export function useFetchPost<R, D = unknown>({
  url: initialUrl,
  method = 'POST',
  initialConfig,
}: useFetchArgType): FetchResponseType<R, D> {
  const [data, setData] = useState<R | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestFn = async (payload: D, overrideConfig?: AxiosRequestConfig): Promise<R | null> => { // Added the return type
    setIsLoading(true);
    setError(null);

    try {
      const config: AxiosRequestConfig = {
        ...initialConfig,
        method,
        url: initialUrl,
        data: payload,
        ...(overrideConfig || {}),
      };

      const response = await api<R>(config);
      const respData = response.data;
      setData(respData);
      return respData; // Returns the data on success
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      setData(null);
      return null; // Returns null on error
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, requestFn };
}



************************
import { useState } from 'react';
import api from '../../api';
import { AxiosRequestConfig, Method } from 'axios';

// Defines the generic types with more descriptive names
export type FetchResponse<RData, TPayload = any> = {
  data: RData | null;
  isLoading: boolean;
  error: string | null;
  request: (payload: TPayload, config?: AxiosRequestConfig) => Promise<RData | null>;
};

type FetchArgs = {
  url: string;
  method?: Method;
  config?: AxiosRequestConfig;
};

/**
 * A generic hook for making HTTP requests with Axios.
 * @param url - The URL to make the request to.
 * @param method - The HTTP method to use (default: 'POST').
 * @param config - Additional Axios request configuration.
 * @returns An object containing the response data, loading state, error, and the request function.
 */
export function useFetchPost<RData, TPayload = any>({
  url,
  method = 'POST',
  config: initialConfig,
}: FetchArgs): FetchResponse<RData, TPayload> {
  const [data, setData] = useState<RData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (payload: TPayload, overrideConfig?: AxiosRequestConfig): Promise<RData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const requestConfig: AxiosRequestConfig = {
        ...initialConfig,
        method,
        url,
        data: payload,
        ...(overrideConfig || {}),
      };

      const response = await api<RData>(requestConfig);
      const apiData = response.data; // Renamed to apiData
      setData(apiData);
      return apiData;
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      setData(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, request };