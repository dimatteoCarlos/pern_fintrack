import { ErrorResponseType, SuccessResponseType } from "../auth/types/authTypes";

// /src/helpers/responseFormat.ts
export const createErrorResponse = (
  status: number,
  message: string,
  errors?: object
): ErrorResponseType => {
  const errorResponse: ErrorResponseType = {
    status,
    message,
    errors, // Renamed from 'data' to 'errors'
    timestamp: new Date().toISOString(), // Added timestamp
  };
  return errorResponse;
};

//--------

/**
 * Processes the API response (both success and error).
 * This function is used in the frontend, within the useFetch hook or an Axios interceptor.
 * @param response - The API response (Response object).
 * @returns A promise that resolves to a SuccessResponse object or rejects with an ErrorResponse object.
 */
export const handleApiResponse = async <T = unknown>(
  response: Response
): Promise<SuccessResponseType<T> | ErrorResponseType> => {
  try {
    const data: unknown = await response.json(); // Cambiado a unknown

    if (response.ok) {
      // La respuesta está en el rango 200-299 (éxito)
      const successResponse: SuccessResponseType<T> = {
        message: typeof (data as any).message === 'string' ? (data as any).message : '', // Type assertion con comprobación
        data: (data as any).data !== undefined ? (data as any).data : undefined,       // y aquí
        accessToken: typeof (data as any).accessToken === 'string' ? (data as any).accessToken : undefined, // y aquí
        refreshToken: typeof (data as any).refreshToken === 'string' ? (data as any).refreshToken : undefined, // y aquí
      };
      return successResponse;
    } else {
      // La respuesta es un error (código de estado 400 o superior)
      const errorResponse: ErrorResponseType = {
        status: response.status,
        message: typeof (data as any).message === 'string' ? (data as any).message: 'Unknown error', // Type assertion con comprobación
        errors: (data as any).errors !== undefined ? (data as any).errors : undefined,   // y aquí
        timestamp: new Date().toISOString(),
      };
      throw errorResponse;
    }
  } catch (error) {
    console.error("Error al procesar la respuesta", error);
    throw { status: 500, message: 'Error al procesar la respuesta', errors: error };
  }
};