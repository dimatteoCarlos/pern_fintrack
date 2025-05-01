import { useState, useEffect } from 'react';
import api from '../../api'; // Imports the Axios instance
import { AxiosResponse } from 'axios';

interface MyDataType {
  // Defines the structure of the data you expect to receive from the API
  id: number;
  name: string;
  description: string;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

const MyComponent = () => {
  const [data, setData] = useState<MyDataType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Makes the GET request to the desired URL
        const response: AxiosResponse<ApiResponse<MyDataType>> = await api.get('/my-endpoint');

        // Verifies if the request was successful (2xx status code)
        if (response.status >= 200 && response.status < 300) {
          // Processes the API response
          const apiResponse = response.data;
          setData(apiResponse.data);
        } else {
          // Handles the case of a response with a non-successful status code
          setError(`Error: Status code ${response.status}`);
        }
      } catch (err: any) {
        // Catches request errors (e.g., network error, server error)
        let errorMessage = 'An unexpected error occurred';
        if (err.response) {
          // The server responded with an error code
          errorMessage = err.response.data?.message || `Error ${err.response.status}`;
        } else if (err.request) {
          // The request was made but no response was received
          errorMessage = 'No response received from the server';
        } else {
          // An error occurred while setting up the request
          errorMessage = err.message;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // The empty array ensures this runs only once on component mount

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!data) {
    return <div>No data available.</div>;
  }

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.description}</p>
      {/* Displays the rest of the data here */}
    </div>
  );
};

export default MyComponent;


******************
refactorizado

import { useState, useEffect } from 'react';
import api from '../../api'; // Importa la instancia de Axios
import { AxiosResponse } from 'axios';
 
export type FetchResponse<R> = {
  data: R | null;
  isLoading: boolean;
  error: string | null;
  message: string | null;
};
 
export function useFetch<R>(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', payload?: any): FetchResponse<R> {
  const [data, setData] = useState<R | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
 
  useEffect(() => {
    const fetchData = async (url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', payload?: any) => {
      setIsLoading(true);
      setError(null);
 
      try {
        let response: AxiosResponse<any>;
        switch (method) {
          case 'GET':
            response = await api.get(url);
            break;
          case 'POST':
            response = await api.post(url, payload);
            break;
          // Agrega otros métodos si los necesitas
          default:
            response = await api.get(url);
        }
 
        // Verifica si la petición fue exitosa (código de estado 2xx)
        if (response.status >= 200 && response.status < 300) {
          const respData = response.data;
          setData(respData.data);
          setMessage(respData.message);
        } else {
          setError(`Error: Código de estado ${response.status}`);
        }
      } catch (err: any) {
        let errorMessage = 'Ocurrió un error inesperado';
        if (err.response) {
          errorMessage = err.response.data?.message || `Error ${err.response.status}`;
        } else if (err.request) {
          errorMessage = 'No se recibió respuesta del servidor';
        } else {
          errorMessage = err.message;
        }
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
 
    fetchData(url, method, payload);
  }, [url, method]);
 
  return { message, data, isLoading, error };
}