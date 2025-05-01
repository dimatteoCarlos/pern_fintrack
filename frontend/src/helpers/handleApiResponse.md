// /frontend/src/utils/responseUtils.ts
// Este archivo define los tipos y funciones para manejar las respuestas de la API en el frontend.

// Define el formato de la respuesta de error para el frontend
interface ErrorResponse {
  status: number;      // Código de estado HTTP
  message: string;    // Mensaje de error descriptivo
  errors?: object;        // Opcional: Información detallada del error (ej., errores de validación)
  timestamp?: string;  // Opcional: Marca de tiempo del error
}

// Define el formato de la respuesta de éxito para el frontend
interface SuccessResponse<T> {
  message: string;    // Mensaje de éxito
  data?: T;         // Opcional: Datos de la respuesta
  accessToken?: string; // Opcional: Token de acceso
  refreshToken?: string; // Opcional: Refresh token
}

/**
 * Procesa la respuesta de la API (tanto éxito como error).
 * Esta función se utiliza en el frontend, dentro del hook useFetch o un interceptor de Axios.
 * @param response - La respuesta de la API (objeto Response).
 * @returns Una promesa que resuelve a un objeto SuccessResponse o rechaza con un objeto ErrorResponse.
 */
export const handleApiResponse = async <T = unknown>(
  response: Response
): Promise<SuccessResponse<T> | ErrorResponse> => {
  try {
    const text = await response.text();
    let data: any; // Declarar data como any para manejar el parsing

    try {
      data = JSON.parse(text);
    } catch (e) {
      // Si el texto no es un JSON válido, manejarlo como un error
      data = { message: text }; // Asignar el texto directamente al mensaje
    }


    if (response.ok) {
      // La respuesta está en el rango 200-299 (éxito)
      const successResponse: SuccessResponse<T> = {
        message: typeof data.message === 'string' ? data.message : '',
        data: data.data !== undefined ? data.data : undefined,
        accessToken: typeof data.accessToken === 'string' ? data.accessToken : undefined,
        refreshToken: typeof data.refreshToken === 'string' ? data.refreshToken : undefined,
      };
      return successResponse;
    } else {
      // La respuesta es un error (código de estado 400 o superior)
      const errorResponse: ErrorResponse = {
        status: response.status,
        message: typeof data.message === 'string' ? data.message : 'Unknown error',
        errors: data.errors !== undefined ? data.errors : undefined,
        timestamp: new Date().toISOString(),
      };
      throw errorResponse;
    }
  } catch (error) {
    console.error("Error al procesar la respuesta", error);
     if (error instanceof ErrorResponse) {
        throw error;
    }
    throw { status: 500, message: 'Error al procesar la respuesta', errors: error };
  }
};
