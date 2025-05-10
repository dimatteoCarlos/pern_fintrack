# Sintaxis de `Promise.allSettled()`

La sintaxis de `Promise.allSettled()` es la siguiente:

```javascript
Promise.allSettled(iterable);
```

## Parámetros
- **iterable**: Un objeto iterable (como un Array) de promesas u otros valores que serán convertidos a promesas.

## Valor de retorno
- Retorna una promesa que:
  - Se resuelve cuando todas las promesas del iterable han sido resueltas (ya sea cumplidas o rechazadas)
  - Se resuelve con un array de objetos que describen el resultado de cada promesa

## Estructura de los objetos de resultado
Cada objeto resultado tiene:
- **status**: `"fulfilled"` o `"rejected"`
- **value** (si es fulfilled): valor de resolución de la promesa
- **reason** (si es rejected): razón del rechazo

## Ejemplo básico

```javascript
const promesa1 = Promise.resolve(3);
const promesa2 = new Promise((resolve, reject) => 
  setTimeout(reject, 100, 'Error'));
const promesas = [promesa1, promesa2, 42]; // 42 se convertirá en promesa

Promise.allSettled(promesas)
  .then((resultados) => {
    resultados.forEach((resultado) => {
      if (resultado.status === 'fulfilled') {
        console.log('Valor:', resultado.value);
      } else {
        console.log('Razón:', resultado.reason);
      }
    });
  });
```

## Diferencias con `Promise.all()`
- `allSettled()` espera a que todas las promesas terminen (sean resueltas o rechazadas)
- `all()` se rechaza inmediatamente si alguna promesa se rechaza
- `allSettled()` siempre se resuelve, nunca se rechaza






***********************
import axios, { AxiosError, AxiosResponse } from 'axios';
import {
  url_get_total_account_balance_by_type,
  url_get_transactions_by_movement,
  url_monthly_TotalAmount_ByType,
} from '../../endpoints.ts';
import {
  BalancePocketRespType,
  FinancialDataRespType,
} from '../../types/responseApiTypes.ts';

//-----------------
const userId = import.meta.env.VITE_USER_ID;

type FetchSuccess<T> = {
  status: 'success';
  data: AxiosResponse<T>;
};

type FetchError = {
  status: 'error';
  error: AxiosError;
};

type FetchResult<T> = FetchSuccess<T> | FetchError;

// Este es el tipo de cada objeto dentro de overviewKPIendpoints
type EndpointItem = {
  key: string;
  url: string;
  type: unknown; // Solo se usa para tipado externo, no se necesita internamente
};

const overviewKPIendpoints = [
  {
    key: 'SavingsGoals',
    url: `${url_get_total_account_balance_by_type}+/type=pocket_saving&user=${userId}`,
    type: {} as BalancePocketRespType,
  },
  {
    key: 'MonthlyExpenses',
    url: `${url_monthly_TotalAmount_ByType}+?type=expense&user=${userId}`,
    type: {} as FinancialDataRespType,
  },
  {
    key: 'MonthlyIncome',
    url: `${url_monthly_TotalAmount_ByType}+?type=income&user=${userId}`,
    type: {} as FinancialDataRespType,
  },
];

export async function fetchWithAllSettled(
  endpoints: EndpointItem[]
): Promise<{ [key: string]: FetchResult<unknown> }> {
  const results: Record<string, FetchResult<unknown>> = {};

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint.url);
      results[endpoint.key] = { status: 'success', data: response };
    } catch (error) {
      results[endpoint.key] = { status: 'error', error: error as AxiosError };
    }
  }

  return results;
}

/*
const overviewKPIendpoints = [
  {
    key: 'SavingsGoals',
    url: `${url_get_total_account_balance_by_type}?type=pocket_saving&user=${userId}`,
    type: {} as BalancePocketRespType,
  },
  {
    key: 'MonthlyExpenses',
    url: `${url_monthly_TotalAmount_ByType}?type=expense&user=${userId}`,
    type: {} as FinancialDataRespType,
  },
  {
    key: 'MonthlyIncome',
    url: `${url_monthly_TotalAmount_ByType}?type=income&user=${userId}`,
    type: {} as FinancialDataRespType,
  },
];

const kpiResults = await fetchWithAllSettled(overviewKPIendpoints);

// Puedes acceder a cada resultado por key
if (kpiResults['SavingsGoals'].status === 'success') {
  const savingsData = kpiResults['SavingsGoals'].data.data as BalancePocketRespType;
  // usa savingsData...
}

if (kpiResults['MonthlyExpenses'].status === 'success') {
  const expensesData = kpiResults['MonthlyExpenses'].data.data as FinancialDataRespType;
}

if (kpiResults['MonthlyIncome'].status === 'success') {
  const incomeData = kpiResults['MonthlyIncome'].data.data as FinancialDataRespType;
}

*/


