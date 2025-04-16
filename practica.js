//data structure
//modificar para incorporar tambien el agnio dentro de los objetos de data

const response = {
  status: 200,
  message: 'Financial data retrieved successfully',
  data: {
    meta: {
      dateRange: {
        start: '2025-01-01T04:00:00.000Z',
        end: '2026-01-01T03:59:59.000Z',
      },
    },
    data: [
      {
        month_index: 2,
        month_name: 'february',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'housing',
        amount: 125000,
        currency_code: 'cop',
        type: 'expense',
      },
      {
        month_index: 3,
        month_name: 'march',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'housing',
        amount: 1000,
        currency_code: 'cop',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'appliences',
        amount: 4344,
        currency_code: 'usd',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'clothing',
        amount: 19.27,
        currency_code: 'usd',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'education',
        amount: 9,
        currency_code: 'usd',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'groceries',
        amount: 13,
        currency_code: 'usd',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'housing',
        amount: 1100,
        currency_code: 'cop',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'housing',
        amount: 1,
        currency_code: 'usd',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'transportation',
        amount: 5,
        currency_code: 'usd',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'utilities',
        amount: 4,
        currency_code: 'usd',
        type: 'expense',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'utilities',
        amount: -4,
        currency_code: 'usd',
        type: 'income',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'utilities',
        amount: -3,
        currency_code: 'usd',
        type: 'income',
      },
      {
        month_index: 3,
        month_name: 'march',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'utilities',
        amount: 24,
        currency_code: 'usd',
        type: 'saving',
      },
      {
        month_index: 3,
        month_name: 'march',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'utilities',
        amount: 1,
        currency_code: 'usd',
        type: 'saving',
      },
      {
        month_index: 4,
        month_name: 'april',
        movement_type_id: 1,
        transaction_type_id: 2,
        name: 'utilities',
        amount: 12,
        currency_code: 'usd',
        type: 'saving',
      },
    ],
  },
};

const data = JSON.parse(JSON.stringify(response)).data.data;
// console.log('🚀 ~ objresp:', Array.isArray(data));

const result = {
  expense: {},
  income: {},
  saving: {},
};

/*desired structure of result:
{
  expense: {
    "cop": { monthlyAverage: X, total: Y },
    "usd": { monthlyAverage: X, total: Y }
  },
  income: {
    "eur": { monthlyAverage: X, total: Y }
  },
  saving: {
    "cop": { monthlyAverage: X, total: Y }
  }
}*/

let monthCurrencyTracker = {
  expense: {},
  income: {},
  saving: {},
};

//find total amount and unique months
for (const item of data) {
  const monthKey = `${item.month_index}-${item.month_name}`;

  //initialize result object data structure
  //type, currency, montlyAverage, totalAmount, currency
  if (!result[item.type][item.currency_code]) {
    result[item.type][item.currency_code] = {
      monthlyAverage: 0,
      totalAmount: 0,
      currency: item.currency_code,
      months: 0,
    };
    // console.log(item.type);
  }

  if (!monthCurrencyTracker[item.type][item.currency_code]) {
    monthCurrencyTracker[item.type][item.currency_code] = {};
  }

  if (!monthCurrencyTracker[item.type][item.currency_code][monthKey]) {
    monthCurrencyTracker[item.type][item.currency_code][monthKey] = true;
    result[item.type][item.currency_code].months++;
  }

  //determine total amount for each type and currency
  result[item.type][item.currency_code]['totalAmount'] += item.amount;
  console.log('🚀 ~ result:', result);
}

//determine the monthly average of total amount

for (const key1 in result) {
  for (const key2 in result[key1]) {
    if (result[key1][key2].months > 0) {
      // console.log('key1:', key1, 'key2:', key2);
      result[key1][key2]['monthlyAverage'] =
        result[key1][key2]['totalAmount'] / result[key1][key2].months;
    }
  }
}

console.log('result', result);

//this determines total amount and number of months with activity - only from Jan to Dec for one year period

//esta faltando: valores totales y promedioso de expense, saving e income. incorporar backend a frontend. manejo global de los estados. ajustar componentes frontend y hacer los data fetchings. despues de probar, incorporar los tracker que faltan.  detailed page. transferencias entre cuentas. borrar cuentas y transacciones. hacer filtros para mostrar transacciones por: tipo de movimiento, por tipo de transaccion, por tipo de cuenta, en un periodo, y que muestre un summary: cantidad, pareto o grafico resumen. mostrar indicadores financieros.
// # Versión con TypeScript del Código de Procesamiento Financiero

// Aquí tienes el código convertido a TypeScript con tipado fuerte y mejor organización:

// ```typescript
// // Definición de tipos
// interface FinancialTransaction {
//   month_index: number;
//   month_name: string;
//   movement_type_id: number;
//   transaction_type_id: number;
//   name: string;
//   amount: number;
//   currency_code: string;
//   type: 'expense' | 'income' | 'saving';
// }

// interface FinancialResult {
//   monthlyAverage: number;
//   totalAmount: number;
//   currency: string;
//   months: number;
// }

// interface FinancialResponse {
//   status: number;
//   message: string;
//   data: {
//     meta: {
//       dateRange: {
//         start: string;
//         end: string;
//       };
//     };
//     data: FinancialTransaction[];
//   };
// }

// // Datos de entrada (manteniendo la estructura original)
// const response: FinancialResponse = {
//   status: 200,
//   message: 'Financial data retrieved successfully',
//   data: {
//     meta: {
//       dateRange: {
//         start: '2025-01-01T04:00:00.000Z',
//         end: '2026-01-01T03:59:59.000Z',
//       },
//     },
//     data: [
//       // ... (todos los datos originales se mantienen igual)
//       // Solo como ejemplo incluyo el primer elemento
//       {
//         month_index: 2,
//         month_name: 'february',
//         movement_type_id: 1,
//         transaction_type_id: 2,
//         name: 'housing',
//         amount: 125000,
//         currency_code: 'cop',
//         type: 'expense',
//       },
//       // ... (resto de los datos)
//     ],
//   },
// };

// // Procesamiento de datos
// const data: FinancialTransaction[] = JSON.parse(JSON.stringify(response)).data.data;

// // Definición de la estructura de resultados
// type ResultType = {
//   expense: Record<string, FinancialResult>;
//   income: Record<string, FinancialResult>;
//   saving: Record<string, FinancialResult>;
// };

// const result: ResultType = {
//   expense: {},
//   income: {},
//   saving: {},
// };

// // Objeto para rastrear meses únicos por tipo y moneda
// type MonthTrackerType = {
//   expense: Record<string, Record<string, boolean>>;
//   income: Record<string, Record<string, boolean>>;
//   saving: Record<string, Record<string, boolean>>;
// };

// const monthCurrencyTracker: MonthTrackerType = {
//   expense: {},
//   income: {},
//   saving: {},
// };

// // Procesar todas las transacciones
// for (const item of data) {
//   const monthKey = `${item.month_index}-${item.month_name}`;

//   // Inicializar estructuras si no existen
//   if (!result[item.type][item.currency_code]) {
//     result[item.type][item.currency_code] = {
//       monthlyAverage: 0,
//       totalAmount: 0,
//       currency: item.currency_code,
//       months: 0,
//     };
//   }

//   if (!monthCurrencyTracker[item.type][item.currency_code]) {
//     monthCurrencyTracker[item.type][item.currency_code] = {};
//   }

//   // Registrar mes único si no existe
//   if (!monthCurrencyTracker[item.type][item.currency_code][monthKey]) {
//     monthCurrencyTracker[item.type][item.currency_code][monthKey] = true;
//     result[item.type][item.currency_code].months++;
//   }

//   // Acumular montos (manteniendo negativos para income)
//   result[item.type][item.currency_code].totalAmount += item.amount;
// }

// // Calcular promedios mensuales
// for (const type in result) {
//   const transactionType = type as keyof ResultType;
//   for (const currency in result[transactionType]) {
//     const record = result[transactionType][currency];
//     if (record.months > 0) {
//       record.monthlyAverage = record.totalAmount / record.months;
//     }
//   }
// }

// // Función para formatear el resultado para mostrar
// function formatResult(result: ResultType): void {
//   console.log('Resultado Financiero:');
//   for (const type in result) {
//     const transactionType = type as keyof ResultType;
//     console.log(`\n${type.toUpperCase()}:`);
//     for (const currency in result[transactionType]) {
//       const { totalAmount, monthlyAverage, months } = result[transactionType][currency];
//       console.log(`  ${currency}:`);
//       console.log(`    Total: ${totalAmount}`);
//       console.log(`    Promedio mensual: ${monthlyAverage.toFixed(2)}`);
//       console.log(`    Meses con actividad: ${months}`);
//     }
//   }
// }

// // Mostrar resultados
// formatResult(result);
// ```

// ## Mejoras implementadas con TypeScript:

// 1. **Interfaces fuertemente tipadas**:
//    - `FinancialTransaction` para los datos de entrada
//    - `FinancialResult` para la estructura de resultados
//    - `FinancialResponse` para el formato completo de respuesta

// 2. **Tipos específicos para objetos complejos**:
//    - `ResultType` para el objeto de resultados
//    - `MonthTrackerType` para el rastreador de meses

// 3. **Validación en tiempo de compilación**:
//    - TypeScript verifica que todas las propiedades existan y sean del tipo correcto
//    - Previene errores comunes como acceder a propiedades inexistentes

// 4. **Función de formateo mejorada**:
//    - Muestra los resultados de manera más legible en la consola
//    - Incluye todos los datos relevantes formateados

// 5. **Mantenimiento de la lógica original**:
//    - Conserva exactamente el mismo comportamiento que la versión JavaScript
//    - Los cálculos y procesamiento siguen siendo idénticos

// ## Beneficios adicionales:

// - **Autocompletado inteligente** en IDEs que soporten TypeScript
// - **Documentación incorporada** a través de los tipos
// - **Mayor seguridad** al evitar errores de tipo en tiempo de ejecución
// - **Más fácil de mantener** y extender con nuevas funcionalidades

// ¿Necesitas alguna adaptación adicional o explicación más detallada de alguna parte del código TypeScript?

