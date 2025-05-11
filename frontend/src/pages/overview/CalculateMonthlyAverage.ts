//monthlyAverage.ts
//group by type of movement by month and by currency
//input data structure

import { MonthlyDataType } from '../../types/responseApiTypes';

import { CurrencyType } from '../../types/types';
export type MovementType = 'expense' | 'income' | 'saving' | 'other';

export type FinancialResultType = {
  monthlyAverage: number;
  totalAmount: number;
  currency: CurrencyType;
  monthCounter: number;
};

export type ResultType = {
  [key in MovementType]?: { [currency in CurrencyType]?: FinancialResultType };
};

type MonthCurrencyTrackerType = {
  [key in MovementType]?: {
    [currency in CurrencyType]?: {
      [monthKey: string]: boolean;
    };
  };
};

//----------------------------------------------
export function calculateMonthlyAverage(
  arrayData: MonthlyDataType[]
): ResultType {
  const result: ResultType = { expense: {}, income: {}, saving: {} };
  const monthCurrencyTracker: MonthCurrencyTrackerType = {
    expense: {},
    income: {},
    saving: {},
  };

  //find total amount and count unique months
  for (const item of arrayData) {
    //inicializar result con la estructura
    const movementType = item.type as MovementType;
    const currencyCode = item.currency_code as CurrencyType;

    if (!result[movementType]?.[currencyCode]) {
      if (!result[movementType]) {
        result[movementType] = {};
      }
      result[movementType]![currencyCode] = {
        monthlyAverage: 0,
        totalAmount: 0,
        currency: item.currency_code,
        monthCounter: 0,
      };
    }
    //determine total amount for each type-currency combination
    result[movementType]![currencyCode]!.totalAmount += item.amount;

    //determine qty of unique months with actiivity
    // Inicializar tracker
    if (!monthCurrencyTracker[movementType]?.[currencyCode]) {
      if (!monthCurrencyTracker[movementType]) {
        monthCurrencyTracker[movementType] = {};
      }
      monthCurrencyTracker[movementType]![currencyCode] = {};
    }
    const monthKey = `${item.month_index}-${item.month_name}`;

    // Contar meses únicos
    if (!monthCurrencyTracker[movementType]![currencyCode]![monthKey]) {
      monthCurrencyTracker[movementType]![currencyCode]![monthKey] = true;
      result[movementType]![currencyCode]!.monthCounter++;
    }
  }

  // console.log('item', item, 'result', result);
  // Calcular promedios
  for (const type in result) {
    const movementType = type as MovementType;
    for (const currency in result[movementType]) {
      const currencyCode = currency as CurrencyType;
      const data = result[movementType]![currencyCode]!;

      if (data.monthCounter > 0) {
        data.monthlyAverage = data.totalAmount / data.monthCounter;
        // result[movementType]![currencyCode]!['totalAmount']/ data.monthCounter
        console.log('result', result);
      }
    }
  }

  console.log('result', result);
  return result;
}

//------------------------------------------------
// //example of ResultType data structure
// type ResultType = {
//     expense?: {
//         usd?: {
// //   monthlyAverage: number;
//   totalAmount: number;
//   currency: CurrencyType;
//   monthCounter: number;
// } | undefined;
// //         cop?: FinancialResultType | undefined;
//         eur?: FinancialResultType | undefined;
//     } | undefined;
//     income?: {
//         usd?: FinancialResultType | undefined;
//         cop?: FinancialResultType | undefined;
//         eur?: FinancialResultType | undefined;
//     } | undefined;
//     saving?: {
//         usd?: FinancialResultType | undefined;
//         cop?: FinancialResultType | undefined;
//         eur?: FinancialResultType | undefined;
//     } | undefined;
//     other?: {
//         usd?: FinancialResultType | undefined;
//         cop?: FinancialResultType | undefined;
//         eur?: FinancialResultType | undefined;
//     } | undefined;
// }
//------------------------------------------------

// //example of api response input data structure
// const response: FinancialDataRespType = {
//   status: 200,
//   message: 'Financial data retrieved successfully',
//   data: {
//     dateRange: {
//       start: '2025-01-01T04:00:00.000Z',
//       end: '2026-01-01T03:59:59.000Z',
//     },

//     monthlyAmounts: [
//       {
//         month_index: 2,
//         month_name: 'february',
//         movement_type_id: 1,
//         transaction_type_id: 2,
//         name: 'housing',
//         amount: 125000,
//         currency_code: 'usd',
//         type: 'expense',
//       },
//       {
//         month_index: 1,
//         month_name: 'january',
//         movement_type_id: 1,
//         transaction_type_id: 2,
//         name: 'housing',
//         amount: 100,
//         currency_code: 'usd',
//         type: 'expense',
//       },
//       {
//         month_index: 3,
//         month_name: 'march',
//         movement_type_id: 1,
//         transaction_type_id: 2,
//         name: 'housing',
//         amount: 1000,
//         currency_code: 'usd',
//         type: 'income',
//       },
//       {
//         month_index: 4,
//         month_name: 'april',
//         movement_type_id: 1,
//         transaction_type_id: 2,
//         name: 'appliences',
//         amount: 4344,
//         currency_code: 'usd',
//         type: 'saving',
//       },
//     ],
//   },
// };

// const arrayData: MonthlyDataType[] = JSON.parse(JSON.stringify(response)).data
//   .monthlyAmounts;
// console.log(arrayData);
