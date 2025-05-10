Gracias por compartir tu código completo, el cual está bastante bien estructurado. El problema principal parece estar en cómo estás actualizando el estado `kpiData` usando `setKpiData`, específicamente en esta parte:

```tsx
setKpiData({
  SavingGoals:
    result.SavingGoals.status === 'success'
      ? result.SavingGoals.data
      : null,

  // MonthlyMovementKPI
});
```

### 🔍 Problema:

En esta asignación estás **reemplazando completamente el estado anterior** y no incluyes la propiedad `MonthlyMovementKPI`. Esto causa que el objeto del estado no tenga esa propiedad (queda `undefined`), y por lo tanto **TypeScript puede lanzar un error** si se intenta acceder a ella.

### ✅ Solución:

Debes preservar el estado previo y solo actualizar la propiedad que corresponde, así:

```tsx
setKpiData((prev) => ({
  ...prev,
  SavingGoals:
    result.SavingGoals.status === 'success'
      ? result.SavingGoals.data
      : null,
}));
```

Y después, para `MonthlyMovementKPI`, lo haces correctamente:

```tsx
setKpiData((prev) => ({ ...prev, MonthlyMovementKPI: monthMovKpi }));
```

### ✅ Alternativa si quieres actualizar ambos de una vez:

```tsx
const savingGoalsData =
  result.SavingGoals.status === 'success' ? result.SavingGoals.data : null;

const monthlyAmounts =
  result.MonthlyTotalAmountByType.status === 'success'
    ? result.MonthlyTotalAmountByType.data.data.monthlyAmounts
    : null;

const calculatedKPI = monthlyAmounts
  ? calculateMonthlyAverage(monthlyAmounts)
  : null;

setKpiData({
  SavingGoals: savingGoalsData,
  MonthlyMovementKPI: calculatedKPI,
});
```

---

### 🧠 Bonus: Protege tus propiedades con valores iniciales seguros

También podrías prevenir errores de acceso usando operadores opcionales en tus componentes, por ejemplo:

```tsx
{kpiData?.SavingGoals && <SavingGoals data={kpiData.SavingGoals} />}
```

---

¿Te gustaría que revise también el archivo `overviewFetchAll.ts` por si hay problemas allí al devolver los datos?
