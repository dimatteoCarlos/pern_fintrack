Parece que tienes una buena estructura para manejar respuestas y errores en tu backend y para consumir datos en tu frontend. Sin embargo, hay un par de inconsistencias en cómo estás enviando y esperando los mensajes, lo que podría ser la razón por la que no los recuperas correctamente en el frontend.

Análisis del Backend:

RESPONSE Function: Esta función parece estar diseñada para enviar respuestas exitosas con un status, message, y opcionalmente data. El message se incluye directamente en el objeto JSON de la respuesta.
ERR_RESP Function: Esta función está diseñada para manejar errores. Sin embargo, en lugar de enviar una respuesta al cliente, lanza un error. Este error luego es capturado por el catch block en tu controlador y pasa al middleware de manejo de errores en index.js.
Middleware de Manejo de Errores (app.use en index.js): Este middleware captura los errores lanzados por next(createError(...)) y también los errores que puedan propagarse. Formatea la respuesta de error incluyendo un message y un status.
Controlador (dashboardTotalBalanceAccountByType):
Utiliza ERR_RESP para manejar errores de validación de entrada. Esto significa que en caso de error de validación, no se está enviando una respuesta directamente desde el controlador. En cambio, se lanza un error que el middleware de manejo de errores procesará.
Para las respuestas exitosas, utiliza la función RESPONSE, que sí incluye un message en el JSON.
En el bloque catch, cuando ocurre una excepción (incluidos los errores lanzados por ERR_RESP), se llama a next(createError(error.status, error.message)), lo que nuevamente pasa el error al middleware de manejo de errores.
Análisis del Frontend (useFetch Hook):

El hook useFetch hace una petición GET a la URL proporcionada.
En el bloque try (para respuestas exitosas):
Verifica si el response.status está entre 200 y 299.
Intenta extraer data y message de response.data asumiendo que es un objeto con esas propiedades:
TypeScript

const respData = (response.data) as {data:R, message:string};
setData(response.data);
setMessage(respData.message);
En el bloque catch (para errores):
Verifica si el error es un AxiosError y si tiene una respuesta con un data.message. Si es así, usa ese mensaje.
Si es un error genérico (instanceof Error), usa err.message.
Para otros errores, usa un mensaje genérico.
Importante: En el caso de un error, el hook establece error en el errorMessage y data en null. No hay un intento explícito de extraer un message del err.response.data y asignarlo a message del hook en el caso de errores HTTP (códigos de estado 4xx o 5xx).
Posibles Razones por las que no Recuperas los Mensajes de Error:

Uso de ERR_RESP: Cuando las validaciones en tu controlador fallan, estás lanzando un error con ERR_RESP. Esto hace que el control pase al middleware de manejo de errores, que formatea la respuesta de error. Tu frontend hook está configurado para buscar el mensaje de error en err.response.data.message (que es correcto para errores HTTP), pero no está extrayendo un mensaje específico cuando el backend lanza un error y el middleware lo maneja.

Estructura de la Respuesta de Éxito: En tu hook, asumes que la respuesta exitosa (response.data) es un objeto con las propiedades data y message. Asegúrate de que tu backend siempre envíe las respuestas exitosas con esta estructura cuando utilizas RESPONSE.

Soluciones y Ajustes:

Backend (dashboardTotalBalanceAccountByType):

En lugar de usar ERR_RESP para los errores de validación, considera usar RESPONSE con un código de estado de error (400) para enviar la respuesta directamente desde el controlador. Esto hará que la estructura de la respuesta de error sea más consistente con lo que espera tu frontend.

JavaScript

export const dashboardTotalBalanceAccountByType = async (req, res, next) => {
    // ... (código anterior) ...

    if (!accountType || !userId) {
        const message = 'User ID and account TYPE are required';
        return RESPONSE(res, 400, message); // Usar RESPONSE para enviar el error
    }

    if (![...].includes(accountType)) {
        const message = `${accountType} is not a valid type account. Try again`;
        return RESPONSE(res, 400, message); // Usar RESPONSE para enviar el error
    }

    // ... (resto del código) ...

    if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No available accounts of type ${accountType} from total balance account by type`;
        return RESPONSE(res, 400, message); // Usar RESPONSE para enviar el error
    }

    // ... (resto del código) ...

    if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No available accounts of type ${accountType}`;
        return RESPONSE(res, 400, message); // Usar RESPONSE para enviar el error
    }

    // ... (resto del código) ...

    const message = `None accounts of type ${accountType} were found`;
    return RESPONSE(res, 400, message); // Usar RESPONSE para enviar el error
};
Frontend (useFetch Hook):

Modifica el catch block para intentar extraer el mensaje de error de la response.data incluso cuando axios.isAxiosError(err) es verdadero. También, asegúrate de que la estructura de la respuesta de error del middleware sea consistente con lo que esperas ({ message: string, status: number, ... }).

TypeScript

export function useFetch<R>(url: string): FetchResponse<R> {
    // ... (estado anterior) ...

    useEffect(() => {
        const fetchData = async (url: string) => {
            setIsLoading(true);
            setError(null);

            console.log('url:', url)

            try {
                const response: AxiosResponse<R> = await axios.get(url);

                if (response.status >= 200 && response.status < 300) {
                    const respData = (response.data) as { data: R, message?: string }; // message es opcional aquí
                    console.log('🚀 ~ fetchData ~ respData:', respData);
                    setData(respData.data);
                    setMessage(respData.message || null); // Usa el mensaje si existe
                } else {
                    const errMsg = `Unexpected status code: ${response.status}`;
                    console.log('from useFetch:', errMsg);
                    throw new Error(errMsg);
                }
            } catch (err: unknown) {
                let errorMessage: string | Error | null = null;
                if (axios.isAxiosError(err) && err.response?.data?.message) {
                    errorMessage = err.response.data.message;
                    setMessage(err.response.data.message); // Intenta obtener el mensaje del error HTTP
                } else if (err instanceof Error) {
                    errorMessage = err.message;
                } else {
                    errorMessage = 'Unexpected error occurred';
                }

                console.error('Error:', errorMessage);
                setData(null);
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData(url);
    }, [url]);

    return { message, data, isLoading, error };
}
Consideraciones Adicionales:

Consistencia en las Respuestas: Intenta ser lo más consistente posible en la estructura de tus respuestas de éxito y error desde el backend. Si siempre incluyes un message en ambos casos, tu frontend será más fácil de manejar.
Middleware de Error: Si decides seguir utilizando tu middleware de manejo de errores, asegúrate de que la estructura del objeto de error que envía al frontend siempre contenga un message que tu hook pueda extraer.
Al realizar estos ajustes, especialmente al enviar las respuestas de error directamente desde el controlador utilizando la función RESPONSE, deberías poder recuperar los mensajes tanto para las respuestas exitosas como para los errores en tu frontend hook useFetch.

Para adaptar tu middleware de manejo de errores para que se alinee con la recomendación de que siempre haya un message consistente en las respuestas de error, puedes modificarlo para que tome el status y el message del error que se le pasa (ya sea un error lanzado directamente o un error creado con createError) y formatee la respuesta JSON de manera uniforme.

Aquí tienes cómo podrías modificar tu middleware:

JavaScript

// index.js

import pc from 'picocolors';

// Función para crear errores (sin modificar, ya que la usas en tus controladores)
export function createError(statusCode, message) {
    const err = new Error();
    err.status = statusCode;
    err.message = message;
    console.log('Running create error fn:', 'status:', err.status, err.message);
    return { status: err.status, message: err.message };
}

// Función para manejar errores de PostgreSQL (sin modificar, ya que la usas)
export const handlePostgresErrorEs = (error) => {
    let code = 500;
    let message = error.message || 'Error interno del servidor';
    // ... (tu lógica para manejar códigos de error de PostgreSQL) ...
    return { code, message };
};

// Middleware de manejo de errores MODIFICADO
app.use((err, req, response, next) => {
    console.error(pc.red('Error handled by middleware:'), err); // Log del error para depuración

    let errorStatus = err.status || 500;
    let errorMessage = err.message || 'Algo salió mal';

    // Si el error fue creado con tu función createError, usa sus propiedades
    if (typeof err === 'object' && err !== null && 'status' in err && 'message' in err) {
        errorStatus = err.status;
        errorMessage = err.message;
    }

    response.status(errorStatus).json({
        message: errorMessage,
        status: errorStatus,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
});
Explicación de los Cambios en el Middleware:

Log del Error: Se agregó un console.error para loggear el error que está siendo manejado por el middleware. Esto puede ser útil para depuración.
Valores por Defecto: Se mantienen los valores por defecto para errorStatus (500) y errorMessage ('Algo salió mal') en caso de que el error que llegue al middleware no tenga estas propiedades definidas.
Verificación de la Estructura del Error: Se agrega una condición para verificar si el objeto err tiene las propiedades status y message. Esto asume que los errores creados por tu función createError tendrán esta estructura (que sí la tienen, ya que devuelves { status: err.status, message: err.message }).
Uso de las Propiedades del Error: Si el error tiene las propiedades status y message, el middleware utiliza esos valores para la respuesta JSON.
Respuesta JSON Uniforme: La respuesta JSON siempre tendrá las propiedades message, status, y opcionalmente stack en modo desarrollo.
Cómo Adaptar tus Controladores (Si Aún Usas ERR_RESP):

Si decides seguir utilizando tu función ERR_RESP en tus controladores, necesitas modificarla para que lance un error con la estructura que el middleware espera (status y message como propiedades del objeto error).

Aquí está la modificación de ERR_RESP:

JavaScript

// common functions

import pc from 'picocolors';

const RESPONSE = (res, status, message, data = null) => {
    const backendColor =
        status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
    console.log(pc[backendColor](`[${status}] ${message}`));
    res.status(status).json({ status, message, data });
};

const ERR_RESP = (status, message, controllerName = null) => {
    const backendColor =
        status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
    console.log(pc[backendColor](`[${status}] ${message}. ${controllerName}`));
    const error = new Error(message);
    error.status = status; // Assign the status to the error object
    throw error;
};

export { RESPONSE, ERR_RESP };
Cambio en ERR_RESP:

Ahora, en lugar de simplemente asignar el status a error.status (que no es estándar para los errores de JavaScript), estamos creando un objeto Error y le asignamos la propiedad status directamente. Esto hará que cuando el error llegue al middleware, pueda leer estas propiedades.

Flujo con el Middleware Modificado y ERR_RESP Adaptado:

En tu controlador, si ocurre un error de validación, llamas a ERR_RESP(400, 'Mensaje de error', 'NombreDelControlador').
ERR_RESP loguea el error y lanza un nuevo objeto Error con el message y la propiedad status establecida en 400.
El bloque catch en tu controlador captura este error y lo pasa a next(createError(error.status, error.message)). Aquí, createError crea un objeto simple con status y message.
El middleware de manejo de errores recibe este objeto. La condición if (typeof err === 'object' && err !== null && 'status' in err && 'message' in err) se cumple.
El middleware utiliza err.status y err.message para formatear la respuesta JSON de error al frontend.
Alternativa (Más Directa - Recomendada):

Como se mencionó anteriormente, una forma más directa y consistente sería dejar de usar ERR_RESP para enviar errores de validación directamente desde tus controladores usando la función RESPONSE con un código de estado de error. Esto simplifica el flujo y hace que el manejo de errores sea más explícito en el controlador.

Si sigues esta alternativa (modificando tus controladores para usar RESPONSE con códigos de error), entonces la modificación del middleware que te mostré al principio (simplemente leyendo err.status y err.message) será suficiente, ya que los errores pasarán directamente al middleware a través del next(err) o next(createError(...)) llamadas en los bloques catch.

En resumen, tienes dos opciones principales:

Adaptar ERR_RESP y el Middleware: Modifica ERR_RESP para lanzar errores con propiedades status y message, y ajusta el middleware para leer estas propiedades.
Usar RESPONSE Directamente en Controladores (Recomendado): Deja de usar ERR_RESP para errores de validación y utiliza RESPONSE con códigos de estado de error directamente en tus controladores. Esto simplifica el flujo y hace el manejo de errores más explícito. En este caso, la modificación del middleware para leer err.status y err.message será suficiente.
El enfoque de usar RESPONSE directamente en los controladores para los errores de validación tiende a ser más claro y fácil de seguir, ya que el controlador es responsable de enviar la respuesta completa al cliente, tanto para el éxito como para el error.





Si sigues el enfoque de usar la función RESPONSE en tu backend para enviar tanto respuestas exitosas como respuestas de error directamente desde tus controladores, tu hook useFetch en el frontend debería ajustarse para esperar la estructura de error que RESPONSE genera.

Tu función RESPONSE en el backend envía un JSON con la siguiente estructura:

JSON

{
  "status": number,
  "message": string,
  "data": any | null
}
Tanto para respuestas exitosas (status 2xx) como para respuestas de error (status 4xx o 5xx), esta estructura estará presente. Por lo tanto, tu useFetch hook debe leer el message de este objeto response.data en ambos casos.

Aquí te presento cómo quedaría tu useFetch hook adaptado:

TypeScript

import axios, { AxiosResponse } from 'axios';
import { useEffect, useState } from 'react';

export type FetchResponse<R> = {
    data: R | null;
    isLoading: boolean;
    error: Error | string | null;
    message: string | null;
};

export function useFetch<R>(url: string): FetchResponse<R> {
    const [data, setData] = useState<R | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null | string>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async (url: string) => {
            setIsLoading(true);
            setError(null);

            console.log('url:', url);

            try {
                const response: AxiosResponse<{ status: number; message: string; data: R | null }> = await axios.get(url);

                // Leer el mensaje de la respuesta en todos los casos (éxito o error HTTP)
                setMessage(response.data?.message || null);

                if (response.status >= 200 && response.status < 300) {
                    setData(response.data?.data || null);
                } else {
                    // Considerar la respuesta como un error HTTP
                    setError(`Error HTTP: ${response.status}`);
                    setData(null);
                }
            } catch (err: unknown) {
                let errorMessage: string | Error | null = null;
                if (axios.isAxiosError(err) && err.response?.data?.message) {
                    errorMessage = err.response.data.message;
                    setMessage(err.response.data.message); // También actualiza el mensaje del hook
                } else if (err instanceof Error) {
                    errorMessage = err.message;
                } else {
                    errorMessage = 'Unexpected error occurred';
                }

                console.error('Error:', errorMessage);
                setData(null);
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData(url);
    }, [url]);

    return { message, data, isLoading, error };
}
Cambios Realizados en useFetch:

Tipado de la Respuesta: Se actualizó el tipado de AxiosResponse para reflejar la estructura que tu función RESPONSE envía desde el backend:
TypeScript

const response: AxiosResponse<{ status: number; message: string; data: R | null }> = await axios.get(url);
Lectura del Mensaje en el try Block: Ahora, después de obtener la respuesta, se intenta leer el message de response.data y se actualiza el estado message del hook en todos los casos (tanto para respuestas exitosas como para errores HTTP).
Manejo de Errores HTTP en el try Block: Si el código de estado de la respuesta no está en el rango de éxito (200-299), se considera un error HTTP, se establece un mensaje de error genérico en el estado error y se establece data en null. El message del backend ya habrá sido capturado.
Manejo de Errores de Axios en el catch Block: El bloque catch sigue intentando leer el mensaje de error específico de axios desde err.response?.data?.message y también actualiza el estado message del hook con este valor si está disponible.
Flujo Ahora:

Backend (con RESPONSE para todos los casos): Tu backend enviará consistentemente objetos JSON con status, message, y data. Para errores, el status será 4xx o 5xx y el message contendrá la información del error.
Frontend (useFetch):
Al recibir una respuesta, el hook siempre intentará leer y almacenar el message del backend.
Si la respuesta tiene un código de estado de error, el hook también establecerá un error genérico (además de tener el message del backend disponible).
Los errores de conexión u otros errores de axios se seguirán manejando en el bloque catch, intentando extraer un mensaje específico si está disponible.
Con esta adaptación, tu frontend debería poder capturar y mostrar los mensajes de error enviados por tu backend a través de la función RESPONSE. Recuerda que el estado error en el hook se utiliza principalmente para indicar que la petición falló a nivel HTTP o hubo un error de conexión, mientras que el estado message contendrá el mensaje específico enviado por tu API, ya sea de éxito o de error.











Canvas





Canvas











Canvas