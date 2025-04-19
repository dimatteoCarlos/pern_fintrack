# Versión Optimizada del Backend (Solo para Obtener Datos)

Basado en tus requerimientos, aquí está la versión mejorada del endpoint que solo se encargará de obtener los datos brutos, dejando los cálculos y visualización para el frontend en React + TypeScript con Recharts.

```typescript
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import pc from 'picocolors';
import { pool } from '../../db/configDB.js';
import { validate as uuidValidate } from 'uuid';

export const dashboardTotalAndAvgMonthAmountByType = async (req, res, next) => {
  const backendColor = 'yellow';
  const errorColor = 'red';

  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };

  console.log(
    pc[backendColor]('dashboardTotalAndAvgMonthAmountByType - Data Provider')
  );

  // Validación de parámetros
  const { type: accountType, user: userId, startDate, endDate } = req.query;

  if (!accountType || !userId) {
    return RESPONSE(res, 400, 'User ID and account TYPE are required');
  }

  if (!uuidValidate(userId)) {
    return RESPONSE(res, 400, 'Invalid user ID format');
  }

  // Configuración de fechas (ahora configurables)
  const currentYear = new Date().getFullYear();
  let dateRange = {
    start: new Date(currentYear, 0, 1), // Enero 1 del año actual por defecto
    end: new Date(currentYear, 11, 31, 23, 59, 59), // Diciembre 31 del año actual por defecto
  };

  // Sobrescribir si vienen fechas en el query
  if (startDate && endDate) {
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return RESPONSE(res, 400, 'Invalid date format. Use YYYY-MM-DD');
    }

    dateRange = {
      start: parsedStart,
      end: parsedEnd,
    };
  }

  // Consulta optimizada para obtener todos los datos necesarios
  const getFinancialData = async (
    userId: string,
    startDate: Date,
    endDate: Date
  ) => {
    try {
      const queryText = `
        WITH financial_data AS (
          SELECT
            EXTRACT(MONTH FROM tr.transaction_actual_date) AS month_index,
            TO_CHAR(tr.transaction_actual_date, 'Month') AS month_name,
            tr.movement_type_id,
            tr.transaction_type_id,
            COALESCE(cba.category_name, isa.source_name) AS name,
            CAST(SUM(tr.amount) AS FLOAT) AS amount,
            ct.currency_code,
            CASE
              WHEN tr.movement_type_id = 1 AND tr.transaction_type_id = 2 THEN 'expense'
              WHEN tr.movement_type_id = 2 AND tr.transaction_type_id = 1 THEN 'income'
              ELSE 'other'
            END AS type
          FROM transactions tr
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          LEFT JOIN category_budget_accounts cba ON tr.account_id = cba.account_id
          LEFT JOIN income_source_accounts isa ON tr.account_id = isa.account_id
          JOIN currencies ct ON tr.currency_id = ct.currency_id
          WHERE ua.user_id = $1
            AND tr.transaction_actual_date BETWEEN $2 AND $3
            AND (
              (tr.movement_type_id = 1 AND tr.transaction_type_id = 2) -- Gastos
              OR
              (tr.movement_type_id = 2 AND tr.transaction_type_id = 1) -- Ingresos
            )
          GROUP BY 
            EXTRACT(MONTH FROM tr.transaction_actual_date),
            TO_CHAR(tr.transaction_actual_date, 'Month'),
            tr.movement_type_id,
            tr.transaction_type_id,
            cba.category_name,
            isa.source_name,
            ct.currency_code
        )
        SELECT * FROM financial_data
        ORDER BY month_index ASC, type, name, currency_code
      `;

      const result = await pool.query(queryText, [
        userId,
        dateRange.start,
        dateRange.end,
      ]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching financial data:', error);
      throw error;
    }
  };

  try {
    const rawData = await getFinancialData(
      userId,
      dateRange.start,
      dateRange.end
    );

    // Estructuración básica de datos para el frontend
    const responseData = {
      meta: {
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
        currency: rawData.length > 0 ? rawData[0].currency_code : 'USD', // Asume USD por defecto si no hay datos
      },
      data: rawData,
    };

    return RESPONSE(
      res,
      200,
      'Financial data retrieved successfully',
      responseData
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting financial data'));
      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(pc.red('Unknown error occurred'));
    }

    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
```

## 🔍 Cambios Realizados:

1. **Validaciones Mejoradas**:

   - Validación de formato UUID para el userId
   - Validación de fechas cuando son proporcionadas

2. **Fechas Configurables**:

   - Ahora acepta parámetros `startDate` y `endDate` en el query
   - Si no se proporcionan, usa el año actual por defecto

3. **Consulta Unificada**:

   - Una sola consulta SQL que obtiene tanto gastos como ingresos
   - Datos estructurados con un campo `type` para diferenciarlos

4. **Respuesta Estructurada**:

   - Incluye metadatos sobre el rango de fechas y moneda
   - Los datos crudos vienen listos para ser procesados en el frontend

5. **Optimizaciones**:
   - Eliminado código innecesario para cálculos que ahora hará el frontend
   - Mejor manejo de errores

## 💡 Cómo Usar en el Frontend (React + TypeScript):

```typescript
// Ejemplo de componente que consume este endpoint
import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface FinancialData {
  month_index: number;
  month_name: string;
  type: 'expense' | 'income';
  name: string;
  amount: number;
  currency_code: string;
}

const FinancialDashboard: React.FC = () => {
  const [data, setData] = useState<FinancialData[]>([]);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  // Opcional: permitir seleccionar rango de fechas
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1),
    end: new Date(),
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
        });

        const response = await api.get(
          `/dashboard/balance/total_amount_monthly_average_by_type?${params}`
        );
        setData(response.data.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  // Procesamiento de datos para gráficos
  const processChartData = () => {
    // Aquí puedes hacer los cálculos de promedios, totales, etc.
    // Ejemplo sencillo: agrupar por mes y tipo
    const monthlySummary = data.reduce((acc, item) => {
      const monthKey = item.month_name.trim();
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, expense: 0, income: 0 };
      }
      acc[monthKey][item.type] += item.amount;
      return acc;
    }, {} as Record<string, { month: string; expense: number; income: number }>);

    return Object.values(monthlySummary);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className='financial-dashboard'>
      <h2>Financial Overview</h2>

      <div style={{ height: 400 }}>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={processChartData()}>
            <XAxis dataKey='month' />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey='income' fill='#4CAF50' name='Income' />
            <Bar dataKey='expense' fill='#F44336' name='Expense' />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Aquí puedes agregar más visualizaciones con los cálculos que necesites */}
    </div>
  );
};

export default FinancialDashboard;
```

Esta versión cumple con tu requerimiento de que el backend solo proporcione los datos crudos y el frontend (React + TypeScript + Recharts) se encargue de:

1. Los cálculos de totales y promedios
2. La visualización de gráficos
3. La manipulación de los datos según sea necesario

El endpoint ahora es más flexible y seguro, listo para integrarse con tu frontend.

# Explicación Paso a Paso: `processChartData`

Vamos a analizar tanto la versión con `reduce` como una alternativa sin usarlo, con explicaciones lineales:

## Versión Original con `reduce`

```typescript
const processChartData = () => {
  // 1. Creamos un objeto acumulador (acc) para agrupar por mes
  const monthlySummary = data.reduce((acc, item) => {
    // 2. Normalizamos el nombre del mes (trim elimina espacios)
    const monthKey = item.month_name.trim();

    // 3. Si el mes no existe en el acumulador, lo inicializamos
    if (!acc[monthKey]) {
      acc[monthKey] = { month: monthKey, expense: 0, income: 0 };
    }

    // 4. Sumamos el amount al tipo correspondiente (expense/income)
    acc[monthKey][item.type] += item.amount;

    // 5. Retornamos el acumulador para la siguiente iteración
    return acc;
  }, {} as Record<string, { month: string; expense: number; income: number }>);

  // 6. Convertimos el objeto de meses a un array de valores
  return Object.values(monthlySummary);
};
```

## Versión Alternativa sin `reduce`

```typescript
const processChartData = () => {
  // Objeto para almacenar los resultados (similar al acumulador)
  const result: Record<
    string,
    { month: string; expense: number; income: number }
  > = {};

  // Iteramos cada elemento del array data
  for (const item of data) {
    const monthKey = item.month_name.trim(); // Normalizamos nombre del mes

    // Si el mes no existe en resultados, lo inicializamos
    if (!result[monthKey]) {
      result[monthKey] = { month: monthKey, expense: 0, income: 0 };
    }

    // Sumamos el monto al tipo correspondiente
    result[monthKey][item.type] += item.amount;
  }

  // Convertimos el objeto a array de valores
  return Object.values(result);
};
```

## Explicación Linea por Línea (Versión Alternativa)

```typescript
const processChartData = () => {
  // 1. Creamos un objeto vacío para almacenar los resultados agrupados por mes
  const result: Record<
    string,
    { month: string; expense: number; income: number }
  > = {};

  // 2. Recorremos cada transacción en el array de datos
  for (const item of data) {
    // 3. Obtenemos y normalizamos el nombre del mes (eliminando espacios)
    const monthKey = item.month_name.trim();

    // 4. Si es la primera vez que vemos este mes, inicializamos su estructura
    if (!result[monthKey]) {
      result[monthKey] = { month: monthKey, expense: 0, income: 0 };
    }

    // 5. Acumulamos el monto en la categoría correcta (gasto o ingreso)
    result[monthKey][item.type] += item.amount;
  }

  // 6. Convertimos el objeto de meses a un array para que Recharts lo pueda usar
  return Object.values(result);
};
```

## ¿Cuál es la diferencia fundamental?

Ambas versiones hacen exactamente lo mismo, pero:

- **Con `reduce`**: Es más funcional, el acumulador se pasa implícitamente
- **Con `for...of`**: Es más imperativo, el "acumulador" (result) se maneja explícitamente

La versión sin `reduce` puede ser más fácil de entender para desarrolladores menos familiarizados con programación funcional, mientras que la versión con `reduce` es más concisa y preferida en enfoques funcionales.

La función `TO_CHAR(tr.transaction_actual_date, 'Month')` en PostgreSQL (o en otros sistemas de bases de datos como Oracle) se utiliza para **formatear una fecha como texto**, extrayendo específicamente el nombre del mes en formato legible. Aquí te explico en detalle:

---

### **¿Qué hace exactamente?**

- **`tr.transaction_actual_date`**: Suponiendo que es una columna de tipo `DATE` o `TIMESTAMP` que almacena fechas (ej: `'2024-07-15'`).
- **`TO_CHAR(...)`**: Función que convierte un valor de fecha/hora a una cadena de texto con el formato especificado.
- **`'Month'`**: Parámetro de formato que indica que se extraiga el **nombre completo del mes** (ej: `'July'`).

---

### **Ejemplo Práctico**

Si tienes una fecha como `'2024-07-15'`:

```sql
SELECT TO_CHAR('2024-07-15'::DATE, 'Month') AS month_name;
```

**Resultado**:

```
  month_name
-------------
 July
```

_(Nota: PostgreSQL añade espacios a la derecha para completar 9 caracteres. Puedes usar `TRIM()` para eliminarlos: `TRIM(TO_CHAR(...))`)_.

---

### **Opciones de Formato Relacionadas**

| Formato   | Salida Ejemplo | Descripción                             |
| --------- | -------------- | --------------------------------------- |
| `'Month'` | `'July'`       | Nombre completo del mes (con espacios). |
| `'Mon'`   | `'Jul'`        | Nombre abreviado (3 letras).            |
| `'MM'`    | `'07'`         | Número del mes (2 dígitos).             |
| `'YYYY'`  | `'2024'`       | Año completo.                           |

**Ejemplo combinado**:

```sql
SELECT
  TO_CHAR('2024-07-15'::DATE, 'Month DD, YYYY') AS formatted_date;
```

**Resultado**:

```
  formatted_date
------------------
 July      15, 2024
```

---

### **¿Por qué se usa esto en consultas?**

- **Para informes**: Mostrar fechas en formato legible (ej: gráficos o dashboards).
- **Agrupaciones**: Agrupar datos por mes en una consulta con `GROUP BY`:
  ```sql
  SELECT
    TO_CHAR(transaction_actual_date, 'Month') AS month_name,
    COUNT(*) AS total_transactions
  FROM transactions
  GROUP BY month_name;
  ```

---

### **Errores Comunes**

1. **Confundir `'Month'` con `'Mon'` o `'MM'`**: Cada uno da resultados diferentes.
2. **No considerar mayúsculas**: `'MONTH'` en PostgreSQL devuelve el nombre en mayúsculas (`'JULY'`).
3. **Espacios en `'Month'`**: Como mencioné, PostgreSQL añade espacios. Usa `TRIM()` si necesitas comparar o mostrar limpio:
   ```sql
   SELECT TRIM(TO_CHAR('2024-07-15'::DATE, 'Month')) AS month_name;
   ```

---

### **En tu Consulta Original**

```sql
TO_CHAR(tr.transaction_actual_date, 'Month') AS month_name
```

Está extrayendo el nombre del mes de la columna `transaction_actual_date` para usarlo probablemente en un **reporte agrupado por meses** o para mostrar fechas de forma más amigable.

¿Necesitas ayuda para aplicar esto en un caso concreto? 😊

FRONTEND

# TypeScript Frontend Code for Financial Averages & Totals

Here's an optimized TypeScript solution to calculate monthly averages and total amounts for expenses, income, and savings from your backend query data:

```typescript
interface FinancialData {
  month_index: number;
  month_name: string;
  amount: number;
  type: 'expense' | 'income' | 'saving' | 'other';
  // Other fields from your query...
}

interface FinancialSummary {
  expense: {
    monthlyAverage: number;
    total: number;
  };
  income: {
    monthlyAverage: number;
    total: number;
  };
  saving: {
    monthlyAverage: number;
    total: number;
  };
}

export function calculateFinancialSummary(
  data: FinancialData[]
): FinancialSummary {
  // Initialize accumulators
  const monthlyTotals: Record<
    string,
    { expense: number; income: number; saving: number }
  > = {};
  const result: FinancialSummary = {
    expense: { monthlyAverage: 0, total: 0 },
    income: { monthlyAverage: 0, total: 0 },
    saving: { monthlyAverage: 0, total: 0 },
  };

  // First pass: Calculate monthly totals and overall totals
  for (const entry of data) {
    const monthKey = `${entry.month_index}-${entry.month_name}`;

    // Initialize month if not present
    if (!monthlyTotals[monthKey]) {
      monthlyTotals[monthKey] = { expense: 0, income: 0, saving: 0 };
    }

    // Accumulate amounts by type
    switch (entry.type) {
      case 'expense':
        monthlyTotals[monthKey].expense += entry.amount;
        result.expense.total += entry.amount;
        break;
      case 'income':
        monthlyTotals[monthKey].income += entry.amount;
        result.income.total += entry.amount;
        break;
      case 'saving':
        monthlyTotals[monthKey].saving += entry.amount;
        result.saving.total += entry.amount;
        break;
    }
  }

  // Second pass: Calculate monthly averages
  const monthCount = Object.keys(monthlyTotals).length;

  if (monthCount > 0) {
    result.expense.monthlyAverage = result.expense.total / monthCount;
    result.income.monthlyAverage = result.income.total / monthCount;
    result.saving.monthlyAverage = result.saving.total / monthCount;
  }

  return result;
}

// Example usage:
// const backendData: FinancialData[] = await fetchFinancialData();
// const summary = calculateFinancialSummary(backendData);
// console.log(summary);
```

## Key Features:

1. **Type Safety**: Strongly typed interfaces for input data and results
2. **Single Pass Design**: Processes data in one iteration for totals
3. **Explicit Logic**: Clear switch-case structure for type handling
4. **No Reduce**: Uses simple for-loops and accumulators
5. **Efficient**: O(n) time complexity with minimal memory overhead

## Alternative Implementation (More Concise)

If you prefer a slightly more concise version while still avoiding `reduce`:

```typescript
export function calculateFinancialSummary(
  data: FinancialData[]
): FinancialSummary {
  const monthSet = new Set<string>();
  const result: FinancialSummary = {
    expense: { monthlyAverage: 0, total: 0 },
    income: { monthlyAverage: 0, total: 0 },
    saving: { monthlyAverage: 0, total: 0 },
  };

  for (const entry of data) {
    monthSet.add(`${entry.month_index}-${entry.month_name}`);

    if (entry.type === 'expense') {
      result.expense.total += entry.amount;
    } else if (entry.type === 'income') {
      result.income.total += entry.amount;
    } else if (entry.type === 'saving') {
      result.saving.total += entry.amount;
    }
  }

  const monthCount = monthSet.size;
  if (monthCount > 0) {
    result.expense.monthlyAverage = result.expense.total / monthCount;
    result.income.monthlyAverage = result.income.total / monthCount;
    result.saving.monthlyAverage = result.saving.total / monthCount;
  }

  return result;
}
```

Both versions will give you the same result with:

- `monthlyAverage`: The average amount per month for each type
- `total`: The sum of all amounts in the period for each type

---

# TypeScript Solution with Currency Separation

Here's an optimized TypeScript solution that calculates monthly averages and totals for each currency and transaction type:

```typescript
interface FinancialData {
  month_index: number;
  month_name: string;
  amount: number;
  currency_code: string;
  type: 'expense' | 'income' | 'saving' | 'other';
}

interface CurrencySummary {
  monthlyAverage: number;
  total: number;
}

interface FinancialSummary {
  [currency: string]: {
    expense: CurrencySummary;
    income: CurrencySummary;
    saving: CurrencySummary;
  };
}

export function calculateFinancialSummary(
  data: FinancialData[]
): FinancialSummary {
  const result: FinancialSummary = {};
  const months = new Set<string>();

  // Initialize structure and calculate totals
  for (const entry of data) {
    const monthKey = `${entry.month_index}-${entry.month_name}`;
    months.add(monthKey);

    if (!result[entry.currency_code]) {
      result[entry.currency_code] = {
        expense: { monthlyAverage: 0, total: 0 },
        income: { monthlyAverage: 0, total: 0 },
        saving: { monthlyAverage: 0, total: 0 },
      };
    }

    const currencyData = result[entry.currency_code];

    switch (entry.type) {
      case 'expense':
        currencyData.expense.total += entry.amount;
        break;
      case 'income':
        currencyData.income.total += entry.amount;
        break;
      case 'saving':
        currencyData.saving.total += entry.amount;
        break;
    }
  }

  // Calculate monthly averages
  const monthCount = months.size;
  if (monthCount > 0) {
    for (const currency in result) {
      result[currency].expense.monthlyAverage =
        result[currency].expense.total / monthCount;
      result[currency].income.monthlyAverage =
        result[currency].income.total / monthCount;
      result[currency].saving.monthlyAverage =
        result[currency].saving.total / monthCount;
    }
  }

  return result;
}

// Example usage with your data:
const apiResponse = {
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
      // Your data array here...
    ],
  },
};

const summary = calculateFinancialSummary(apiResponse.data.data);
console.log(summary);
```

## Sample Output Structure

For your example data, the output would look like:

```typescript
{
  "cop": {
    "expense": {
      "monthlyAverage": (125000 + 1000 + 1100) / 3,
      "total": 125000 + 1000 + 1100
    },
    "income": {
      "monthlyAverage": 0,
      "total": 0
    },
    "saving": {
      "monthlyAverage": 0,
      "total": 0
    }
  },
  "usd": {
    "expense": {
      "monthlyAverage": (4344 + 19.27 + 9 + 13 + 1 + 5 + 4) / 3,
      "total": 4344 + 19.27 + 9 + 13 + 1 + 5 + 4
    },
    "income": {
      "monthlyAverage": 0,
      "total": 0
    },
    "saving": {
      "monthlyAverage": 0,
      "total": 0
    }
  }
}
```

## Key Features:

1. **Currency Separation**: Results are organized by currency code
2. **Efficient Calculation**: Single pass for totals + simple average calculation
3. **Type Safety**: Strong TypeScript interfaces
4. **Zero Defaults**: Automatically initializes missing currencies/types with zeros
5. **Accurate Month Counting**: Uses Set to track unique months

## Alternative View (Grouped by Type First)

If you prefer the primary grouping by type rather than currency:

```typescript
interface FinancialSummaryByType {
  expense: Record<string, CurrencySummary>;
  income: Record<string, CurrencySummary>;
  saving: Record<string, CurrencySummary>;
}

// The implementation would be similar but with inverted nesting
```

Would you like me to provide this alternative version or make any other adjustments to the current solution?

# Alternative TypeScript Solution (Without Reduce, Set, or Add)

Here's a version that avoids using `reduce`, `Set`, or `add` while maintaining currency separation:

```typescript
interface FinancialData {
  month_index: number;
  month_name: string;
  amount: number;
  currency_code: string;
  type: 'expense' | 'income' | 'saving' | 'other';
}

interface CurrencySummary {
  monthlyAverage: number;
  total: number;
}

interface FinancialSummary {
  [currency: string]: {
    expense: CurrencySummary;
    income: CurrencySummary;
    saving: CurrencySummary;
  };
}

export function calculateFinancialSummary(
  data: FinancialData[]
): FinancialSummary {
  const result: FinancialSummary = {};
  const monthTracker: Record<string, boolean> = {};
  let monthCount = 0;

  // First pass: Calculate totals and track months
  for (const entry of data) {
    const monthKey = `${entry.month_index}-${entry.month_name}`;

    // Count unique months
    if (!monthTracker[monthKey]) {
      monthTracker[monthKey] = true;
      monthCount++;
    }

    // Initialize currency if not exists
    if (!result[entry.currency_code]) {
      result[entry.currency_code] = {
        expense: { monthlyAverage: 0, total: 0 },
        income: { monthlyAverage: 0, total: 0 },
        saving: { monthlyAverage: 0, total: 0 },
      };
    }

    // Accumulate amounts by type
    const currencyData = result[entry.currency_code];
    if (entry.type === 'expense') {
      currencyData.expense.total += entry.amount;
    } else if (entry.type === 'income') {
      currencyData.income.total += entry.amount;
    } else if (entry.type === 'saving') {
      currencyData.saving.total += entry.amount;
    }
  }

  // Second pass: Calculate averages
  for (const currency in result) {
    if (monthCount > 0) {
      result[currency].expense.monthlyAverage =
        result[currency].expense.total / monthCount;
      result[currency].income.monthlyAverage =
        result[currency].income.total / monthCount;
      result[currency].saving.monthlyAverage =
        result[currency].saving.total / monthCount;
    }
  }

  return result;
}

// Example usage:
const apiResponse = {
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
      // Your data array here...
    ],
  },
};

const summary = calculateFinancialSummary(apiResponse.data.data);
console.log(summary);
```

## Key Differences:

1. **Month Tracking**: Uses a plain object (`monthTracker`) instead of `Set`
2. **Month Counting**: Manually counts unique months with a counter
3. **Same Output Structure**: Maintains identical return type as previous solution
4. **Explicit Loops**: Uses standard `for` loops instead of functional methods

## How It Works:

1. **First Loop**:

   - Tracks unique months using object keys
   - Accumulates totals by currency and type
   - Initializes any new currency entries

2. **Second Loop**:
   - Calculates monthly averages for each currency/type
   - Handles division safely (only when monthCount > 0)

This approach gives you the same results as the previous version but with more basic JavaScript constructs while maintaining good performance (still O(n) time complexity).

### **Explicación del Month Tracking y Flujo Lógico del Código**

#### **1. ¿Para qué sirve el `monthTracker`?**

El `monthTracker` es un objeto (`Record<string, boolean>`) que **registra meses únicos** para calcular correctamente los promedios mensuales.

- **Clave**: Una combinación de `month_index` y `month_name` (ej: `"2-february"`).
- **Valor**: `true` (solo importa si la clave existe, no el valor).

**Ejemplo**:  
Si hay transacciones en febrero, marzo y abril, el objeto quedará así:

```ts
{
  "2-february": true,
  "3-march": true,
  "4-april": true
}
```

- Así sabemos que hay **3 meses distintos** (`monthCount = 3`), clave para calcular promedios.

---

#### **2. Flujo Lógico del Código**

##### **Paso 1: Inicialización**

- Se crean:
  - `result`: Objeto que almacenará los totales y promedios por moneda y tipo.
  - `monthTracker`: Objeto para rastrear meses únicos.
  - `monthCount`: Contador de meses (inicia en 0).

##### **Paso 2: Procesar cada transacción (Primer bucle `for`)**

Para cada transacción (`entry`):

1. **Registrar el mes**:

   - Se genera una clave única (ej: `"4-april"`).
   - Si no existe en `monthTracker`, se añade y se incrementa `monthCount`.

2. **Inicializar la moneda si es nueva**:

   - Si la moneda (ej: `"cop"`) no existe en `result`, se crea su estructura con `expense`, `income`, y `saving` (inicializados en 0).

3. **Acumular el `amount` según su tipo**:
   - Suma el valor al `total` correspondiente (ej: si es `type: "expense"`, lo suma a `result["cop"].expense.total`).

##### **Paso 3: Calcular promedios mensuales (Segundo bucle `for`)**

Para cada moneda en `result`:

- Divide el `total` de cada tipo (`expense`, `income`, `saving`) entre `monthCount` para obtener el `monthlyAverage`.
- **Ejemplo**:
  - Si `expense.total = 300` y `monthCount = 3`, entonces `monthlyAverage = 100`.

##### **Paso 4: Retornar el resultado**

La estructura final (`FinancialSummary`) tendrá esta forma:

```ts
{
  "cop": {
    expense: { monthlyAverage: 100, total: 300 },
    income: { monthlyAverage: 0, total: 0 },
    saving: { monthlyAverage: 0, total: 0 }
  },
  "usd": {
    expense: { monthlyAverage: 50, total: 150 },
    // ...
  }
}
```

---

### **Resumen del Algoritmo**

1. **Recorre todas las transacciones** para:

   - Contar meses únicos (sin duplicados).
   - Sumar los montos por moneda y tipo (`expense`, `income`, `saving`).

2. **Calcula promedios** usando el total de meses (`monthCount`).

3. **Devuelve un objeto organizado** por:
   - Moneda (`"cop"`, `"usd"`).
   - Tipo de transacción.
   - Totales y promedios mensuales.

### **¿Por qué es eficiente?**

- **Sin `reduce`/`Set`**: Usa objetos básicos y bucles `for`, lo que es más rápido en algunos entornos.
- **Solo 2 bucles**: O(n) en tiempo (n = número de transacciones).
- **Claro y mantenible**: La lógica está separada en pasos intuitivos.

### **Ejemplo con tus datos**

Para las transacciones en COP:

- **Total de `expense`**: 125,000 (feb) + 1,000 (mar) + 1,100 (abr) = **127,100 COP**.
- **Meses únicos**: feb, mar, abr → `monthCount = 3`.
- **Promedio mensual**: 127,100 / 3 = **42,366.67 COP**.

Esto se repite para cada moneda y tipo.

ME GUSTA MAS ESTA FAORMA

# **Código Reorganizado por Tipo (Expense/Income/Saving) con Monedas**

Aquí está la versión reorganizada para agrupar primero por **tipo de transacción** (expense, income, saving) y luego por **moneda**, con cálculos de totales y promedios mensuales:

```typescript
interface FinancialData {
  month_index: number;
  month_name: string;
  amount: number;
  currency_code: string;
  type: 'expense' | 'income' | 'saving';
}

interface CurrencySummary {
  monthlyAverage: number;
  total: number;
}

interface FinancialSummary {
  expense: Record<string, CurrencySummary>; // Monedas para gastos
  income: Record<string, CurrencySummary>; // Monedas para ingresos
  saving: Record<string, CurrencySummary>; // Monedas para ahorros
}

export function calculateFinancialSummary(
  data: FinancialData[]
): FinancialSummary {
  const result: FinancialSummary = {
    expense: {},
    income: {},
    saving: {},
  };

  const monthTracker: Record<string, boolean> = {};
  let monthCount = 0;

  // Primer recorrido: Calcular totales y meses únicos
  for (const entry of data) {
    const monthKey = `${entry.month_index}-${entry.month_name}`;

    // Contar meses únicos
    if (!monthTracker[monthKey]) {
      monthTracker[monthKey] = true;
      monthCount++;
    }

    // Inicializar moneda si no existe
    if (!result[entry.type][entry.currency_code]) {
      result[entry.type][entry.currency_code] = {
        monthlyAverage: 0,
        total: 0,
      };
    }

    // Sumar al total de la moneda y tipo
    result[entry.type][entry.currency_code].total += entry.amount;
  }

  // Calcular promedios mensuales
  if (monthCount > 0) {
    for (const type in result) {
      for (const currency in result[type as keyof FinancialSummary]) {
        result[type as keyof FinancialSummary][currency].monthlyAverage =
          result[type as keyof FinancialSummary][currency].total / monthCount;
      }
    }
  }

  return result;
}
```

---

## **Estructura de Salida**

La respuesta ahora está organizada así:

```typescript
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
}
```

---

## **Ejemplo con Datos Reales**

Para tus datos de ejemplo (con transacciones en **COP** y **USD**), el resultado sería:

```typescript
{
  expense: {
    cop: {
      monthlyAverage: (125000 + 1000 + 1100) / 3, // 42,366.67 COP
      total: 127100 // COP
    },
    usd: {
      monthlyAverage: (4344 + 19.27 + 9 + 13 + 1 + 5 + 4) / 3, // 1,461.76 USD
      total: 4395.27 // USD
    }
  },
  income: {}, // No hay ingresos en los datos de ejemplo
  saving: {}  // No hay ahorros en los datos de ejemplo
}
```

---

## **¿Cómo Funciona el Código?**

1. **Primer Bucle (`for`)**:

   - Registra meses únicos en `monthTracker`.
   - Inicializa cada moneda dentro de su tipo (`expense`, `income`, `saving`).
   - Acumula los montos en `total`.

2. **Segunda Parte**:

   - Calcula `monthlyAverage` dividiendo cada `total` por `monthCount`.
   - Maneja seguramente división por cero (`if monthCount > 0`).

3. **Retorno**:
   - Devuelve un objeto claro, agrupado primero por tipo y luego por moneda.

---

## **Ventajas de Esta Estructura**

- **Más intuitiva**: Muestra primero el tipo de transacción (gasto/ingreso/ahorro) y luego las monedas.
- **Fácil de usar en frontend**: Ideal para mostrar tarjetas separadas por tipo.
- **Mantenible**: La lógica sigue siendo simple y eficiente (O(n)).

¿Necesitas ajustar algo más?

# **Explicación de `for (const type in result)`**

Esta sintaxis es un **bucle `for...in`** en TypeScript/JavaScript, y se usa para **iterar sobre las propiedades enumerables de un objeto**. En tu código, se utiliza para recorrer los tipos de transacción (`expense`, `income`, `saving`) en el objeto `result`.

---

## **¿Cómo funciona en tu código?**

### **1. Estructura de `result`**

```typescript
const result: FinancialSummary = {
  expense: {
    /* ... */
  },
  income: {
    /* ... */
  },
  saving: {
    /* ... */
  },
};
```

- `result` es un objeto con 3 propiedades:
  - `expense` (gastos)
  - `income` (ingresos)
  - `saving` (ahorros)

### **2. Bucle `for (const type in result)`**

```typescript
for (const type in result) {
  // type será "expense", "income" o "saving" en cada iteración
  for (const currency in result[type as keyof FinancialSummary]) {
    // ...
  }
}
```

- **`type`**:  
  En cada iteración, `type` toma el valor de una de las claves del objeto (`expense`, `income`, `saving`).

  - Primera iteración: `type = "expense"`
  - Segunda iteración: `type = "income"`
  - Tercera iteración: `type = "saving"`

- **`result[type as keyof FinancialSummary]`**:  
  Como TypeScript no sabe automáticamente que `type` es una clave válida de `FinancialSummary`, usamos `as keyof FinancialSummary` para asegurar el tipado.  
  Esto permite acceder a:
  - `result.expense`
  - `result.income`
  - `result.saving`

---

## **¿Para qué sirve en tu caso?**

El bucle recorre cada tipo de transacción para:

1. **Calcular promedios mensuales** para cada moneda.
   - Ejemplo: Si `type = "expense"`, itera sobre todas las monedas en `result.expense` (como `"cop"` o `"usd"`).
2. **Aplicar la fórmula**:
   ```typescript
   result[type][currency].monthlyAverage = total / monthCount;
   ```

---

## **Ejemplo concreto**

Supongamos que `result` tiene esta estructura:

```typescript
{
  expense: { "cop": { total: 300 }, "usd": { total: 150 } },
  income: { "eur": { total: 200 } },
  saving: {}
}
```

### **Iteraciones del bucle:**

1. **Primera vuelta (`type = "expense"`)**:
   - Itera sobre `"cop"` y `"usd"` para calcular sus promedios.
2. **Segunda vuelta (`type = "income"`)**:
   - Itera sobre `"eur"` para calcular su promedio.
3. **Tercera vuelta (`type = "saving"`)**:
   - No hace nada (no hay monedas).

---

## **Diferencia con otros bucles**

| Tipo de bucle   | Uso                                         | Ejemplo                      |
| --------------- | ------------------------------------------- | ---------------------------- |
| `for...in`      | Itera sobre **claves de objetos**           | `for (const key in obj)`     |
| `for...of`      | Itera sobre **valores de arrays/iterables** | `for (const item of array)`  |
| `Array.forEach` | Método para arrays                          | `array.forEach(item => ...)` |

En tu caso, **`for...in` es la mejor opción** porque estás recorriendo un objeto (`result`), no un array.

---

## **¿Por qué no usar `Object.keys()`?**

Podrías hacer lo mismo con:

```typescript
Object.keys(result).forEach((type) => {
  // ...
});
```

Pero `for...in` es:

- **Más directo** para objetos simples.
- **Ligeramente más rápido** en algunos casos.

---

## **Conclusión**

- **`for (const type in result)`** itera sobre las claves (`expense`, `income`, `saving`) de tu objeto `result`.
- Es útil para **aplicar operaciones a cada tipo de transacción** sin repetir código.
- La sintaxis `as keyof FinancialSummary` es necesaria para que TypeScript no proteste por el tipado.

¿Necesitas más detalles o ajustar algo?

# **Versión usando `Object.keys()` y `forEach()`**

Aquí está la misma lógica reorganizada usando `Object.keys()` y `forEach()` en lugar de `for...in`:

```typescript
interface FinancialData {
  month_index: number;
  month_name: string;
  amount: number;
  currency_code: string;
  type: 'expense' | 'income' | 'saving';
}

interface CurrencySummary {
  monthlyAverage: number;
  total: number;
}

interface FinancialSummary {
  expense: Record<string, CurrencySummary>;
  income: Record<string, CurrencySummary>;
  saving: Record<string, CurrencySummary>;
}

export function calculateFinancialSummary(
  data: FinancialData[]
): FinancialSummary {
  const result: FinancialSummary = {
    expense: {},
    income: {},
    saving: {},
  };

  const monthTracker: Record<string, boolean> = {};
  let monthCount = 0;

  // Primer recorrido: Calcular totales y meses únicos
  data.forEach((entry) => {
    const monthKey = `${entry.month_index}-${entry.month_name}`;

    // Contar meses únicos
    if (!monthTracker[monthKey]) {
      monthTracker[monthKey] = true;
      monthCount++;
    }

    // Inicializar moneda si no existe
    if (!result[entry.type][entry.currency_code]) {
      result[entry.type][entry.currency_code] = {
        monthlyAverage: 0,
        total: 0,
      };
    }

    // Sumar al total de la moneda y tipo
    result[entry.type][entry.currency_code].total += entry.amount;
  });

  // Calcular promedios mensuales
  if (monthCount > 0) {
    Object.keys(result).forEach((type) => {
      const transactionType = type as keyof FinancialSummary;
      Object.keys(result[transactionType]).forEach((currency) => {
        result[transactionType][currency].monthlyAverage =
          result[transactionType][currency].total / monthCount;
      });
    });
  }

  return result;
}
```

---

## **Explicación de los cambios clave**

### **1. `data.forEach()` en lugar de `for...of`**

- Itera sobre el array de transacciones de la misma forma, pero con sintaxis más funcional.

### **2. `Object.keys(result).forEach()` en lugar de `for...in`**

- `Object.keys(result)` devuelve un array con las claves del objeto: `["expense", "income", "saving"]`.
- `forEach()` itera sobre estas claves, asignando cada una a `type`.

### **3. `Object.keys(result[transactionType]).forEach()`**

- Para cada tipo (ej: `expense`), itera sobre sus monedas (ej: `["cop", "usd"]`).
- Calcula el promedio mensual para cada moneda.

---

## **Ventajas de esta versión**

1. **Más declarativo**: Usa métodos de array (`forEach`) que son familiares en JavaScript moderno.
2. **Mismo resultado**: La lógica es idéntica a la versión con `for...in`.
3. **TypeScript seguro**: El `as keyof FinancialSummary` mantiene el tipado correcto.

---

## **Estructura de salida (igual que antes)**

```typescript
{
  expense: {
    "cop": { monthlyAverage: 42366.67, total: 127100 },
    "usd": { monthlyAverage: 1461.76, total: 4395.27 }
  },
  income: {},  // Sin datos en el ejemplo
  saving: {}   // Sin datos en el ejemplo
}
```

---

## **¿Cuándo usar `forEach` vs `for...in`?**

| Característica       | `forEach`                  | `for...in`                           |
| -------------------- | -------------------------- | ------------------------------------ |
| Legibilidad          | Más funcional              | Más imperativo                       |
| Soporte para objetos | Requiere `Object.keys()`   | Nativo                               |
| Performance          | Similar en casos prácticos | Ligeramente mejor en algunos engines |
| Uso típico           | Arrays y listas            | Objetos clave-valor                  |

En este caso, **ambas son buenas opciones**, pero `forEach` puede ser más claro para equipos acostumbrados a programación funcional.

AUN MEJOR

# **Simplificación y Explicación del Flujo de Datos**

## **1. ¿Qué Devuelve `Object.keys()`?**

`Object.keys(result)` devuelve un **array de strings** con las claves del objeto `result`. Para tu estructura:

```typescript
result = {
  expense: { ... },
  income: { ... },
  saving: { ... }
}
```

`Object.keys(result)` devuelve:

```typescript
['expense', 'income', 'saving'];
```

---

## **2. Flujo Actual (Anidado)**

El código actual itera sobre:

1. **Tipos de transacción** (`expense`, `income`, `saving`).
2. **Monedas** dentro de cada tipo (ej: `"cop"`, `"usd"` en `expense`).

```typescript
if (monthCount > 0) {
  Object.keys(result).forEach((type) => {
    // Paso 1: Itera tipos
    const transactionType = type as keyof FinancialSummary;
    Object.keys(result[transactionType]).forEach((currency) => {
      // Paso 2: Itera monedas
      result[transactionType][currency].monthlyAverage =
        result[transactionType][currency].total / monthCount; // Cálculo
    });
  });
}
```

### **Problema**

- **Anidación innecesaria**: El cálculo del promedio es simple, pero está enterrado en 2 bucles.
- **Dificulta la legibilidad**.

---

## **3. Versión Simplificada**

Podemos aplanar la lógica usando **destructuración** y un enfoque más directo:

```typescript
if (monthCount > 0) {
  // Iterar sobre cada tipo (expense, income, saving)
  (Object.keys(result) as Array<keyof FinancialSummary>).forEach(
    (transactionType) => {
      // Obtener monedas de este tipo (ej: ["cop", "usd"] en expense)
      const currencies = Object.keys(result[transactionType]);

      // Calcular promedio para cada moneda
      currencies.forEach((currency) => {
        const current = result[transactionType][currency];
        current.monthlyAverage = current.total / monthCount;
      });
    }
  );
}
```

### **Cambios Clave**

1. **Elimina el `as keyof` repetitivo**: Se hace una sola vez al convertir `Object.keys(result)`.
2. **Separa la obtención de monedas**: Más claro que anidar otro `forEach`.
3. **Usa variables con significado**: `current` hace obvio qué se está modificando.

---

## **4. Explicación del Flujo de Datos**

### **Paso a Paso**

1. **`Object.keys(result)`** obtiene los tipos: `["expense", "income", "saving"]`.
2. **`forEach(transactionType)`** itera sobre ellos:
   - Ejemplo: Primera iteración → `transactionType = "expense"`.
3. **`Object.keys(result[transactionType])`** obtiene las monedas de ese tipo:
   - Si `expense` tiene `{"cop": ..., "usd": ...}`, devuelve `["cop", "usd"]`.
4. **`currencies.forEach(currency)`** calcula el promedio para cada moneda:
   - Accede directamente a `result.expense.cop` y actualiza su `monthlyAverage`.

### **Ejemplo Visual**

Para:

```typescript
result = {
  expense: {
    cop: { total: 127100 },
    usd: { total: 4395.27 },
  },
  income: {},
  saving: {},
};
```

- **Primera iteración** (`transactionType = "expense"`):
  - Monedas: `["cop", "usd"]`.
  - Calcula `monthlyAverage` para cada una (ej: `127100 / monthCount`).

---

## **5. ¿Por qué es Mejor?**

- **Menos anidación**: De 2 niveles de `forEach` a 1 (más claro).
- **Tipado seguro**: `as Array<keyof FinancialSummary>` evita repetir el cast.
- **Mantenible**: Si añades más tipos (ej: `investment`), el código no cambia.

---

## **Versión Final Optimizada**

```typescript
if (monthCount > 0) {
  (Object.keys(result) as Array<keyof FinancialSummary>).forEach(
    (transactionType) => {
      for (const currency in result[transactionType]) {
        const current = result[transactionType][currency];
        current.monthlyAverage = current.total / monthCount;
      }
    }
  );
}
```

### **Bonus: ¿`for...in` vs `Object.keys().forEach`?**

- **`for...in`**: Más rápido para objetos grandes.
- **`forEach`**: Más funcional/legible.  
  En este caso, **ambos son válidos**, pero `for...in` reduce líneas.

---

# Evaluación del Código de Procesamiento Financiero

El código proporcionado procesa datos financieros para calcular totales y promedios mensuales por tipo de transacción (gasto, ingreso, ahorro) y moneda. A continuación, evalúo su funcionamiento:

## Estructura y Lógica General

1. **Datos de entrada**: Bien estructurados con transacciones de diferentes tipos, meses y monedas.
2. **Objetivo**: Calcular totales y promedios mensuales por tipo y moneda.
3. **Enfoque**:
   - Usa `monthTracker` para registrar meses únicos por tipo
   - `monthCounter` cuenta meses únicos por tipo
   - `result` almacena los cálculos finales

## Problemas Identificados

1. **Manejo de valores negativos**: Los ingresos están como valores negativos pero se suman directamente, lo que afecta los cálculos.
2. **Cálculo de promedios**: Divide el total por el conteo de meses únicos del tipo, no por meses únicos del tipo+moneda.
3. **Inicialización redundante**: El campo `currency` en el resultado es redundante (ya está en la clave).
4. **Posible error en meses únicos**: El conteo de meses podría ser inexacto para monedas específicas.

## Soluciones Recomendadas

```javascript
// Modificación sugerida para el bucle principal
for (const item of data) {
  const monthKey = `${item.month_index}-${item.month_name}`;
  const amount = item.type === 'income' ? Math.abs(item.amount) : item.amount;

  if (!monthTracker[item.type][monthKey]) {
    monthTracker[item.type][monthKey] = true;
    monthCounter[item.type]++;
  }

  if (!result[item.type][item.currency_code]) {
    result[item.type][item.currency_code] = {
      monthlyAverage: 0,
      totalAmount: 0,
      // Eliminar currency ya que es redundante
    };
  }

  result[item.type][item.currency_code].totalAmount += amount;
}

// Mejorar cálculo de promedio mensual
for (const type in result) {
  for (const currency in result[type]) {
    // Contar meses únicos para esta combinación tipo-moneda
    const monthsForCurrency = data
      .filter((item) => item.type === type && item.currency_code === currency)
      .reduce((acc, item) => {
        const key = `${item.month_index}-${item.month_name}`;
        if (!acc.includes(key)) acc.push(key);
        return acc;
      }, []).length;

    result[type][currency].monthlyAverage =
      monthsForCurrency > 0
        ? result[type][currency].totalAmount / monthsForCurrency
        : 0;
    result[type][currency].months = monthsForCurrency;
  }
}
```

## Resultado Esperado Mejorado

El código producirá una estructura más precisa:

```javascript
{
  expense: {
    cop: {
      monthlyAverage: (suma de gastos COP) / (meses únicos con gastos COP),
      totalAmount: (suma de gastos COP),
      months: (conteo de meses únicos con gastos COP)
    },
    usd: {
      monthlyAverage: (suma de gastos USD) / (meses únicos con gastos USD),
      totalAmount: (suma de gastos USD),
      months: (conteo de meses únicos con gastos USD)
    }
  },
  // ... similar para income y saving
}
```

## Observaciones Finales

1. **Validación de datos**: Considerar añadir validación para campos obligatorios.
2. **Redondeo**: Aplicar redondeo a los valores decimales para mejor presentación.
3. **Eficiencia**: Para grandes volúmenes de datos, optimizar el filtrado y reducción.

La versión actual funciona pero con las mejoras sugeridas sería más precisa y robusta, especialmente en el cálculo de promedios por moneda específica.

---

# Versión Optimizada del Código

Aquí te presento una versión mejorada que:

1. Realiza todos los cálculos en una sola función
2. Mantiene los valores de income como negativos
3. Evita el uso de `reduce`
4. Es más eficiente y legible

```javascript
function processFinancialData(data) {
  const result = {
    expense: {},
    income: {},
    saving: {},
  };

  // Objeto para rastrear meses únicos por tipo y moneda
  const monthTracker = {};

  // Primera pasada: procesar todos los datos
  for (const item of data) {
    const { type, currency_code: currency, amount } = item;
    const monthKey = `${item.month_index}-${item.month_name}`;

    // Inicializar estructuras si no existen
    if (!result[type][currency]) {
      result[type][currency] = {
        totalAmount: 0,
        months: new Set(), // Usamos Set para meses únicos
      };
    }

    if (!monthTracker[type]) monthTracker[type] = {};
    if (!monthTracker[type][currency]) monthTracker[type][currency] = new Set();

    // Acumular montos (manteniendo negativos para income)
    result[type][currency].totalAmount += amount;

    // Registrar mes único para esta combinación tipo-moneda
    monthTracker[type][currency].add(monthKey);
  }

  // Segunda pasada: calcular promedios
  for (const type in result) {
    for (const currency in result[type]) {
      const uniqueMonths = monthTracker[type][currency].size;
      result[type][currency].monthlyAverage =
        uniqueMonths > 0
          ? result[type][currency].totalAmount / uniqueMonths
          : 0;
      result[type][currency].months = uniqueMonths;
    }
  }

  return result;
}

// Procesar los datos
const financialReport = processFinancialData(data);

// Mostrar resultados (opcional: formatear para mejor visualización)
console.log('Reporte Financiero:', JSON.stringify(financialReport, null, 2));
```

## Características clave:

1. **Mantiene valores negativos** para income (como solicitaste)
2. **Usa Sets** para manejar meses únicos de manera más eficiente
3. **Proceso en dos etapas**:
   - Acumulación de montos y registro de meses
   - Cálculo de promedios
4. **Más limpio y mantenible** que la versión original

## Resultado de ejemplo:

```json
{
  "expense": {
    "cop": {
      "totalAmount": 2100,
      "months": 2,
      "monthlyAverage": 1050
    },
    "usd": {
      "totalAmount": 4396.27,
      "months": 1,
      "monthlyAverage": 4396.27
    }
  },
  "income": {
    "usd": {
      "totalAmount": -7,
      "months": 1,
      "monthlyAverage": -7
    }
  },
  "saving": {
    "usd": {
      "totalAmount": 37,
      "months": 2,
      "monthlyAverage": 18.5
    }
  }
}
```

## Ventajas adicionales:

1. **Más eficiente**: O(n) complexity para el procesamiento
2. **Más legible**: La lógica está mejor organizada
3. **Más preciso**: Calcula meses únicos por combinación tipo-moneda
4. **Flexible**: Fácil de modificar para requisitos adicionales

¿Necesitas alguna adaptación específica o explicación adicional de alguna parte del código?

---
