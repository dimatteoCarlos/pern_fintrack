# Componente MonthlyAverage con Soporte para Múltiples Monedas

Voy a modificar el componente para que muestre correctamente los valores de ingresos (income) y gastos (expense) para cada moneda disponible en los datos.

```typescript
import { currencyFormat } from '../../../helpers/functions';
import { StatusSquare } from '../../../general_components/boxComponents';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { ResultType, MovementType, FinancialResultType, CurrencyType } from '../CalculateMonthlyAverage';

// Valores por defecto
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

// Tipo para los datos a mostrar
type DisplayData = {
  title: string;
  amount: number;
  currency: CurrencyType;
  status: string;
};

function MonthlyAverage({ data }: { data: ResultType | null }) {
  // Función para obtener datos de un movimiento específico
  const getMovementData = (movement: MovementType): DisplayData[] => {
    if (!data || !data[movement]) {
      // Retornar valores por defecto si no hay datos
      return [{
        title: movement === 'income' ? 'Monthly Income (Avg.)' : 'Monthly Expenses (Avg.)',
        amount: 0,
        currency: defaultCurrency,
        status: '% status'
      }];
    }

    // Convertir el objeto de monedas a un array de DisplayData
    return Object.entries(data[movement]!).map(([currency, financialData]) => ({
      title: `${movement === 'income' ? 'Monthly Income' : 'Monthly Expenses'} (${currency.toUpperCase()})`,
      amount: financialData?.monthlyAverage || 0,
      currency: currency as CurrencyType,
      status: '% status'
    }));
  };

  const incomeData = getMovementData('income');
  const expensesData = getMovementData('expense');

  // Combinar todos los datos para renderizar
  const allData = [...incomeData, ...expensesData];

  return (
    <div className='tiles__container flx-row-sb' style={{ flexWrap: 'wrap' }}>
      {allData.map((item, index) => (
        <div key={index} className='tile__container tile__container__col tile__container__col--goalInfo'>
          <div className='tile__subtitle letterSpaceSmall'>
            {item.title}
          </div>
          <div className='tile__title'>
            {currencyFormat(
              item.currency,
              item.amount,
              CURRENCY_OPTIONS[item.currency] || formatNumberCountry
            )}
          </div>
          <div className='tile__status__container flx-row-sb'>
            <StatusSquare alert={0.5 - Math.random() < 0 ? 'alert' : ''} />
            <div className='tile__subtitle tile__status--goal'>
              {item.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default MonthlyAverage;
```

## Características clave:

1. **Soporte para múltiples monedas**:
   - Ahora muestra una tarjeta por cada combinación de movimiento (income/expense) y moneda
   - Ejemplo: "Monthly Income (USD)", "Monthly Income (EUR)", "Monthly Expenses (USD)", etc.

2. **Manejo de datos mejorado**:
   - La función `getMovementData` convierte la estructura anidada en un array plano de datos a mostrar
   - Cada entrada incluye: título, cantidad, moneda y estado

3. **Renderizado dinámico**:
   - Usa `map` para renderizar todas las combinaciones encontradas
   - Estilo `flex-wrap: wrap` para manejar múltiples tarjetas

4. **Mantenimiento de funcionalidad**:
   - Soportando valores nulos o faltantes
   - Usando valores por defecto cuando sea necesario
   - Conservando el formato de moneda y estilos originales

5. **Tipado seguro**:
   - Uso de tipos para garantizar la seguridad de los datos
   - Conversión explícita de tipos cuando sea necesario

## Ejemplo de salida