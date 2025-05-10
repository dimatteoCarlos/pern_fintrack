Perfecto. Entonces ahora te mostraré **cómo consumir el resultado de `fetchWithAllSettled`** en tu componente `Overview`, usando tu arreglo `overviewKPIendpoints`, y asegurando que cada subcomponente (`SavingsGoals`, `MonthlyExpenses`, etc.) reciba sus datos tipados correctamente.

---

### ✅ Paso 1: Tipos esperados por cada componente

Asumiendo que tienes estos tipos:

```ts
import { AxiosResponse } from 'axios';

type BalancePocketRespType = { totalBalance: number };
type FinancialDataRespType = { totalAmount: number };

// Mapeo por clave del componente
type OverviewKPIData = {
  SavingsGoals: AxiosResponse<BalancePocketRespType> | null;
  MonthlyExpenses: AxiosResponse<FinancialDataRespType> | null;
  MonthlyIncome: AxiosResponse<FinancialDataRespType> | null;
};
```

---

### ✅ Paso 2: Componente `Overview` (simplificado)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { fetchWithAllSettled } from '@/lib/fetchWithAllSettled';
import { url_get_total_account_balance_by_type, url_monthly_TotalAmount_ByType } from '@/constants';

import SavingsGoals from './SavingsGoals';
import MonthlyExpenses from './MonthlyExpenses';
import MonthlyIncome from './MonthlyIncome';

const userId = '123'; // O viene del contexto o props

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

export default function Overview() {
  const [data, setData] = useState<OverviewKPIData>({
    SavingsGoals: null,
    MonthlyExpenses: null,
    MonthlyIncome: null,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const result = await fetchWithAllSettled(overviewKPIendpoints);

      setData({
        SavingsGoals: result.SavingsGoals.status === 'success' ? result.SavingsGoals.data : null,
        MonthlyExpenses: result.MonthlyExpenses.status === 'success' ? result.MonthlyExpenses.data : null,
        MonthlyIncome: result.MonthlyIncome.status === 'success' ? result.MonthlyIncome.data : null,
      });

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <section>
      <SavingsGoals data={data.SavingsGoals?.data ?? null} />
      <MonthlyExpenses data={data.MonthlyExpenses?.data ?? null} />
      <MonthlyIncome data={data.MonthlyIncome?.data ?? null} />
    </section>
  );
}
```

---

### ✅ Paso 3: Ejemplo de subcomponente

```tsx
type SavingsGoalsProps = {
  data: BalancePocketRespType | null;
};

export default function SavingsGoals({ data }: SavingsGoalsProps) {
  if (!data) return <p>Error al cargar metas de ahorro.</p>;

  return (
    <div>
      <h2>Total en ahorros: ${data.totalBalance}</h2>
    </div>
  );
}
```

---

Esto mantiene todo **bien tipado, claro y sin usar `any`**.
¿Quieres que incluya también `InvestmentAccountBalance` y `AccountBalance` en esta estructura?
