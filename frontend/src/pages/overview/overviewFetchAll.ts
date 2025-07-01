import axios, { AxiosError } from 'axios';
// import  { AxiosResponse } from 'axios';
import {
  BalancePocketRespType,
  FinancialDataRespType,
  LastMovementRespType,
} from '../../types/responseApiTypes';
import { ApiRespDataType } from './Overview';
// import { FinancialResultType } from './CalculateMonthlyAverage';

//--------------------
// Define el tipo para una respuesta exitosa
type FetchSuccess<T> = {
  status: 'success';
  data: T;
  // data: AxiosResponse<T>;
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
//   SavingGoals: BalancePocketRespType | null;
//   MonthlyTotalAmountByType: FinancialDataRespType | null;
//   MovementExpenseTransactions: LastMovementRespType | null;
//   MovementDebtTransactions: LastMovementRespType | null;
//   MovementIncomeTransactions: LastMovementRespType | null;
//   MovementPocketTransactions: LastMovementRespType | null;
//     MovementInvestmentTransactions: LastMovementRespType | null;
// };
// Las claves válidas que puede tener ApiRespDataType
//KPIKeyType es un union type de las claves del objeto ApiRespDataType.
type KPIKeyType = keyof ApiRespDataType;
// Tipo para representar cada endpoint de donde obtener datos KPI
type EndpointItemType<K extends KPIKeyType> = {
  key: K;
  url: string;
  type: ApiRespDataType[K]; // Solo se usa
  //  como referencia para tipar el resultado
};

//type guard Evalúa si ese valor tiene al menos la estructura mínima esperada del tipo FinancialDataRespType.
// TypeScript cambia el tipo de data al tipo FinancialDataRespType dentro del if donde se use.Esto se conoce como type narrowing.

//ex. : data is FinancialDataRespType, Indica que si la función retorna true, TypeScript redefinirá el tipo de data como FinancialDataRespType en el ámbito donde se use.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFinancialDataRespType(data: any): data is FinancialDataRespType {
  console.log('data', data);
  return (
    data &&
    typeof data.status == 'number' &&
    typeof data.message == 'string' &&
    Array.isArray(data.data.monthlyAmounts)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLastMovementRespType(data: any): data is LastMovementRespType {
  console.log('data', data, 'data.data', data.data);
  return (
    data &&
    typeof data.status == 'number' &&
    typeof data.message == 'string' &&
    Array.isArray(data.data)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isBalancePocketRespType(data: any): data is BalancePocketRespType {
  return (
    data &&
    typeof data.status === 'number' &&
    typeof data.message === 'string' &&
    data.data &&
    typeof data.data.total_balance === 'number'
  );
}

//-----------------------------
// Función que recibe un array de endpoints y retorna los datos de todos
//[K in KPIKeyType] es una mapped type de TypeScript.
export async function overviewFetchAll(
  endpoints: EndpointItemType<KPIKeyType>[]
): Promise<{ [K in KPIKeyType]: FetchResult<ApiRespDataType[K]> }> {
  const promises = endpoints.map((endpoint) => axios.get(endpoint.url));
  // console.log('🚀 ~ promises:', promises);

  // Espera a que todas las promesas terminen, sean exitosas o no
  const settledResults = await Promise.allSettled(promises);
  // console.log('🚀 ~ settledResults:', settledResults);
   //[status, value.data.data.monthlyAmounts[{amount, ...},...]]

  // console.log(
  //   'Endpoint keys:',
  //   endpoints.map((e) => e?.key)
  // );

  // Objeto donde se guardarán los resultados, uno por clave (SavingGoals, etc.)
  const results = {} as {
    [K in KPIKeyType]: FetchResult<ApiRespDataType[K]>;
  };

  // const results: { [K in KPIKeyType]: FetchResult<ApiRespDataType[K]> } = {};
  // const results: Record<string, FetchResult<unknown>> = {};

  // Itera sobre los resultados y los endpoints para asociarlos
  for (let i = 0; i < settledResults.length; i++) {
    const endpoint = endpoints[i]; //{key}
    // console.log(endpoints[i]);

    const result = settledResults[i]; // Obtenemos {status, value:{data:{data:{accounts, total_target, ...}, message, status}...}. o value.data.data.monthlyAmounts
    // console.log('🚀 ~ result:', result);

    // Si la promesa fue exitosa
    // console.log('🚀 ~ endpoint:', endpoint);

    if (result.status === 'fulfilled') {
      const data = result.value.data;
      console.log('🚀 ~ data overviewFetchAll:', i, data);

      if (endpoint.key === 'SavingGoals' && isBalancePocketRespType(data)) {
        results[endpoint.key] = { status: 'success', data };
      } else if (
        endpoint.key === 'MonthlyTotalAmountByType' &&
        isFinancialDataRespType(data)
      ) {
        console.log('going to MonthlyTotalAmountByType');
        results[endpoint.key] = { status: 'success', data };
      } else if (
        (endpoint.key === 'MovementExpenseTransactions' ||
          endpoint.key === 'MovementDebtTransactions' ||
          endpoint.key === 'MovementIncomeTransactions') ||
          endpoint.key === 'MovementPocketTransactions'||
          endpoint.key === 'MovementInvestmentTransactions' &&
        isLastMovementRespType(data)
      ) {
        console.log('going to MovementTransactions');
        results[endpoint.key] = { status: 'success', data };
      }
    } else {
      results[endpoint.key] = {
        status: 'error',
        error: result.reason as AxiosError,
      };
      // console.error('❌ Error response:', result.reason);
    }
  }
  // console.log('📊 Final results object:', results);
  return results;
}
