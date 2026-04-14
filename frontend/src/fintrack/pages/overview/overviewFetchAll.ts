//C:\AA1-WEB_DEVELOPER\REACT\apps\FINTRACK\pern_fintrack\frontend\src\fintrack\pages\overview\overviewFetchAll.ts

import { AxiosError } from 'axios';
import {
  BalancePocketRespType,
  FinancialDataRespType,
  LastMovementRespType,
} from '../../types/responseApiTypes';
import { ApiRespDataType } from './Overview';
import { authFetch } from '../../../auth/auth_utils/authFetch';

// =====================================
// ENVIRONMENT AND LOGGING CONTROLS
// =====================================
// ✅ Check environment from Vite env variable
// const isDevelopment = false;
const isDevelopment = import.meta.env.VITE_ENVIRONMENT === 'development';

// ✅ Counter for suppressed errors in production
let suppressedErrorCount = 0;
// ✅ Flag to track if summary has been shown
let hasShownErrorSummary = false;

// ✅ Function to show error summary in production
function showErrorSummaryIfNeeded(): void {
  if (!isDevelopment && !hasShownErrorSummary && suppressedErrorCount > 0) {
    console.warn(
      `⚠️ ${suppressedErrorCount} more error${suppressedErrorCount > 1 ? 's' : ''} suppressed in production`,
    );
    hasShownErrorSummary = true;
  }
}

// ✅ Conditional logging function
function logError(endpointKey: string, details: Record<string, unknown>): void {
  if (isDevelopment) {
   // Show all errors in development
    console.error(`❌ [${endpointKey}] Request failed:`, details);
  } else if (!hasShownErrorSummary) {
   // Show only first error in production
    console.error(`❌ [${endpointKey}] Request failed:`, {
      errorMessage: details.errorMessage,
      errorStatus: details.errorStatus,
    });
    hasShownErrorSummary = true;
  }
  // In production after first error: silently ignore
}

// =====================================
// TYPE DEFINITIONS
// =====================================
// Define el tipo para una respuesta exitosa
type FetchSuccess<T> = {
  status: 'success';
  data: T;
};
// Define el tipo para una respuesta con error
type FetchError = {
  status: 'error';
  error: AxiosError;
};
// Una respuesta puede ser exitosa o un error
type FetchResult<T> = FetchSuccess<T> | FetchError;
//----------------------
// Estado que representa los diferentes tipos de KPIs dataset a obtener de la API
// type ApiRespDataType = {
//   SavingGoals: GBalancePocketRespType | null;
//   MonthlyTotalAmountByType: FinancialDataRespType | null;
//   MovementExpenseTransactions: LastMovementRespType | null;
//   MovementDebtTransactions: LastMovementRespType | null;
//   MovementIncomeTransactions: LastMovementRespType | null;
//   MovementPocketTransactions: LastMovementRespType | null;
//   MovementInvestmentTransactions: LastMovementRespType | null;
// };

// Las claves válidas que pueden tener ApiRespDataType.
//KPIKeyType es un union type de las claves del objeto ApiRespDataType.
type KPIKeyType = keyof ApiRespDataType;

// Tipo para representar cada endpoint de donde obtener datos KPI
type EndpointItemType<K extends KPIKeyType> = {
  key: K;
  url: string;
  type: ApiRespDataType[K]; // Solo se usa como referencia para tipar el resultado
};

// =====================================
// TYPE GUARDS with optional chaining
// =====================================
/*
//type guard Evalúa si ese valor tiene al menos la estructura mínima esperada del tipo que devuelve la api, por ejemplo FinancialDataRespType.
// TypeScript cambia el tipo de data al tipo FinancialDataRespType dentro del if donde se use.Esto se conoce como type narrowing.

//ex. : data is FinancialDataRespType, Indica que si la función retorna true, TypeScript redefinirá el tipo de data como FinancialDataRespType en el ámbito donde se use.
*/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFinancialDataRespType(data: any): data is FinancialDataRespType {
  // console.log('data', data);
  return (
    data &&
    typeof data === 'object' &&
    typeof data.status == 'number' &&
    typeof data.message == 'string' &&
    Array.isArray(data?.data?.monthlyAmounts)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLastMovementRespType(data: any): data is LastMovementRespType {
  // console.log('data', data, 'data.data', data.data);
  return (
    data &&
    typeof data === 'object' &&
    typeof data.status == 'number' &&
    typeof data.message == 'string' &&
    Array.isArray(data?.data)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isBalancePocketRespType(data: any): data is BalancePocketRespType {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.status === 'number' &&
    typeof data.message === 'string' &&
    data?.data &&
    typeof data.data.total_balance === 'number'
  );
}
// =====================================
// SAFE ERROR PARSING FUNCTION
// =====================================
type ParsedErrorType = {
  message: string;
  status: number;
  originalError: unknown;
};

function parseErrorReason(reason: unknown): ParsedErrorType {
  // Log the original error for debugging (always preserved)
  // console.error('🔴 Original error reason:', reason);

  // Check if it's an AxiosError
  if (reason && typeof reason === 'object' && 'isAxiosError' in reason) {
    const axiosError = reason as AxiosError;
    const response = axiosError.response;
    // ✅ Cast response.data to access message property safely
    const errorData = response?.data as { message?: string } | undefined;

    return {
      message:
        errorData?.message ?? axiosError.message ?? 'Axios request failed',
      status: response?.status ?? 500,
      originalError: reason,
    };
  }

  // Check if it's a standard Error object
  if (reason instanceof Error) {
    return {
      message: reason.message,
      status: 500,
      originalError: reason,
    };
  }

  // Check if it's a string
  if (typeof reason === 'string') {
    return {
      message: reason,
      status: 500,
      originalError: reason,
    };
  }

  // Fallback for unknown error types
  return {
    message: 'Unknown error occurred',
    status: 500,
    originalError: reason,
  };
}

// =====================================
// MAIN FETCH FUNCTION
// =====================================
// Función que recibe un array de endpoints y retorna los datos de todos.
//[K in KPIKeyType] es una mapped type de TypeScript.
export async function overviewFetchAll(
  endpoints: EndpointItemType<KPIKeyType>[],
): Promise<{ [K in KPIKeyType]: FetchResult<ApiRespDataType[K]> }> {
  const promises = endpoints.map((endpoint) =>
    authFetch<ApiRespDataType[KPIKeyType]>(endpoint.url),
  );

  // Espera a que todas las promesas terminen, sean exitosas o no
  const settledResults = await Promise.allSettled(promises);
  // console.log('🚀 ~ settledResults:', settledResults);
  //[status, value.data.data.monthlyAmounts[{amount, ...},...]]

  // console.log(
  //   'Endpoint keys:',
  //   endpoints.map((e) => e?.key)
  // );

  // results: Objeto donde se guardarán los resultados, uno por clave (SavingGoals, etc.)

  // Initialize results with default error state for all keys
  const results = {} as {
    [K in KPIKeyType]: FetchResult<ApiRespDataType[K]>;
  };

  // Itera sobre los resultados y los endpoints para asociarlos
  // Process each result
  for (let i = 0; i < settledResults.length; i++) {
    const endpoint = endpoints[i]; //{key}
    // console.log(endpoints[i]);

    const result = settledResults[i]; // Obtenemos {status, value:{data:{data:{accounts, total_target, ...}, message, status}...}. o value.data.data.monthlyAmounts
    // console.log('🚀 ~ result:', result);

    // Si la promesa fue exitosa
    // console.log('🚀 ~ endpoint:', endpoint);

    //FULFILLED
    if (result.status === 'fulfilled') {
    // ✅ Safely extract data with with validation
      const responseValue = result.value;
      const data =
        responseValue &&
        typeof responseValue === 'object' &&
        'data' in responseValue
          ? responseValue.data
          : null;

      // Log successful response (development only)
      // ✅ Only log in development
      if (isDevelopment) {
        console.log(`✅ [${endpoint.key}] Request successful`, {
          url: endpoint.url,
          status: data?.status,
        });
      }

      if (endpoint.key === 'SavingGoals' && isBalancePocketRespType(data)) {
        results[endpoint.key] = { status: 'success', data };
      } else if (
        endpoint.key === 'MonthlyTotalAmountByType' &&
        isFinancialDataRespType(data)
      ) {
        results[endpoint.key] = { status: 'success', data };
      } else if (
        endpoint.key === 'MovementExpenseTransactions' ||
        endpoint.key === 'MovementDebtTransactions' ||
        endpoint.key === 'MovementIncomeTransactions' ||
        endpoint.key === 'MovementPocketTransactions' ||
        endpoint.key === 'MovementInvestmentTransactions' ||
        endpoint.key === 'MovementPnLTransactions'
      ) {
        if (isLastMovementRespType(data)) {
          results[endpoint.key] = {
            status: 'success',
            data: data as LastMovementRespType,
          };
        } else {
          // Log validation failure for debugging (development only)
          // ✅  Only log detailed warnings in development
          if (isDevelopment) {
            console.warn(`⚠️ [${endpoint.key}] Invalid movement data shape`, {
              data,
            });
          } else {
            // ✅ Increment error counter for production summary
            suppressedErrorCount++;
          }
          results[endpoint.key] = {
            status: 'error',
            error: new AxiosError(
              `Invalid data shape for movement: ${endpoint.key}`,
            ),
          };
        }
      }
      // ✅ Final fallback for any unhandled case
      else {
        // Log unhandled case for debugging
        // ✅ Only log detailed warnings in development
        if (isDevelopment) {
          console.warn(`⚠️ [${endpoint.key}] Unhandled response structure`, {
            data,
            typeGuardMatched: false,
          });
        } else {
          // ✅ Increment error counter for production summary
          suppressedErrorCount++;
        }
        results[endpoint.key] = {
          status: 'error',
          error: new AxiosError(
            `Unexpected response structure - no type guard matched for ${endpoint.key}`,
          ),
        };
      }
    } //end of fulfilled conditional block
    // ✅ Handle rejected promises with detailed logging (network errors, etc.)
    else {
      // Use logError for all logging (handles dev/prod internally)
      const parsedError = parseErrorReason(result.reason);

      logError(endpoint.key, {
        url: endpoint.url,
        errorMessage: parsedError.message,
        errorStatus: parsedError.status,
        originalError: isDevelopment ? parsedError.originalError : undefined,
        reasonType: isDevelopment ? typeof result.reason : undefined,
        reasonValue: isDevelopment ? result.reason : undefined,
      });

      // ✅ Increment counter for production summary (logError doesn't do this)
      if (!isDevelopment) {
        suppressedErrorCount++;
      }

      results[endpoint.key] = {
        status: 'error',
        error: new AxiosError(parsedError.message),
      };
    }
  } //end of for

  // ✅ Post-processing fallback - ensure all keys have a value
  // This prevents any undefined values if something was missed
  for (let i = 0; i < endpoints.length; i++) {
    const key = endpoints[i].key;
    if (!results[key]) {
      console.error(`❌ [${key}] No result assigned - this should not happen`);

      results[key] = {
        status: 'error',
        error: new AxiosError(
          `Unhandled endpoint: ${key} - no result assigned`,
        ),
      };
    }
  }
  // ✅ Show error summary in production if any errors were suppressed
  showErrorSummaryIfNeeded();
  // console.log('📊 Final results object:', results);
  return results;
}
