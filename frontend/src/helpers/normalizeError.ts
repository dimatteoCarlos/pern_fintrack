//frontend/src/helpers/uiErrorHandling.ts
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const normalizeError = (error: unknown): { message: string; status: number } => {
  let errorStatus = 500;
  let errorMessage = 'An error occurred';
//Errores de Axios/HTTP
  if (typeof error === 'object' && error !== null && 'response' in error) {

 const axiosError = error as { response?: { data?: { message?: string; status?: number } } };

  if (axiosError.response?.data) {
      errorStatus = axiosError.response.data.status || 500;
      errorMessage = axiosError.response.data.message || 'Server error';
    }
  }
  // Error object with status
  else if (typeof error === 'object' && error !== null && 'status' in error) {
const customError = error as { status: number; message?: string };
    errorStatus = customError.status;
    errorMessage = customError.message || 'Error occurred';
  }
 // Standard Error object
  else if (error instanceof Error) {
    errorMessage = error.message;
  }
// String error
  else if (typeof error === 'string') {
    errorMessage = error;
  }

  return { message: errorMessage, status: errorStatus };
};

/*
 Axios o fetch, los errores HTTP vienen envueltos en un objeto response con data que contiene la respuesta del servidor.

 Algunas librerías o tu propio código pueden crear objetos Error con propiedad status.

A veces los errores pueden ser lanzados como strings simples en lugar de objetos Error.

Para capturar el formato estándar de JavaScript Error objects.

} catch (error) {
  const { message, status } = normalizeError(error);
  setMessageToUser({ message, status });
}

*/