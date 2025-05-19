# **Refactorización a Componente `Transfer.tsx` con Selección Dinámica de Cuentas**

Voy a transformar el componente `Expense` en un nuevo componente `Transfer` que permita transferencias entre cuentas, con selección dinámica de tipos de cuenta (bank, investment, pocket_saving) mediante radio buttons antes de mostrar los dropdowns.

---

## **1. Estructura del Nuevo Componente `Transfer`**

### **Cambios Clave vs `Expense.tsx`**

| **Aspecto**  | **Expense**                        | **Transfer**                            |
| ------------ | ---------------------------------- | --------------------------------------- |
| **Campos**   | `account`, `category`              | `origin_account`, `destination_account` |
| **Fetching** | Pre-carga (bank + category_budget) | Dinámico (según tipo seleccionado)      |
| **UI**       | Dropdown directo                   | Radio buttons + Dropdown condicional    |

---

## **2. Código Refactorizado: `Transfer.tsx`**

```tsx
// src/pages/tracker/transfer/Transfer.tsx
import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import CardSeparator from '../components/CardSeparator';
import TopCard from '../components/TopCard';
import CardNoteSave from '../components/CardNoteSave';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection';
import MessageToUser from '../../../general_components/messageToUser/MessageToUser';
import { useTrackerForm } from '../../../hooks/useTrackerForm';
import { useFetch } from '../../../hooks/useFetch';
import { useBalanceStore } from '../../../stores/useBalanceStore';
import {
  url_get_accounts_by_type,
  url_movement_transaction_record,
} from '../../../endpoints';
import {
  ACCOUNT_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
  ACCOUNT_TYPES,
} from '../../../helpers/constants';
import { AccountByTypeResponseType } from '../../../types/responseApiTypes';
import {
  CurrencyType,
  DropdownOptionType,
  VariantType,
} from '../../../types/types';

const VARIANT_DEFAULT: VariantType = 'tracker';

function Transfer() {
  const { pathname } = useLocation();
  const trackerState = pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement = trackerState.toLowerCase();
  const user = import.meta.env.VITE_USER_ID;

  // State for account type selection (radio buttons)
  const [originAccountType, setOriginAccountType] = useState<string>('bank');
  const [destinationAccountType, setDestinationAccountType] =
    useState<string>('bank');

  // Fetch accounts based on selected types
  const {
    apiData: originAccountsData,
    isLoading: isLoadingOrigin,
    error: errorOrigin,
    refetch: refetchOrigin,
  } = useFetch<AccountByTypeResponseType>(
    `${url_get_accounts_by_type}/?type=${originAccountType}&user=${user}`,
    { manual: true } // Fetch only when triggered
  );

  const {
    apiData: destinationAccountsData,
    isLoading: isLoadingDestination,
    error: errorDestination,
    refetch: refetchDestination,
  } = useFetch<AccountByTypeResponseType>(
    `${url_get_accounts_by_type}/?type=${destinationAccountType}&user=${user}`,
    { manual: true }
  );

  // Trigger fetching when account types change
  useEffect(() => {
    refetchOrigin();
    refetchDestination();
  }, [originAccountType, destinationAccountType]);

  // Memoized dropdown options
  const originAccountOptions = useMemo(() => {
    const accounts = originAccountsData?.data?.accountList || [];
    return errorOrigin
      ? ACCOUNT_OPTIONS_DEFAULT
      : accounts.map((acc) => ({
          value: acc.account_name,
          label: acc.account_name,
        }));
  }, [originAccountsData, errorOrigin]);

  const destinationAccountOptions = useMemo(() => {
    const accounts = destinationAccountsData?.data?.accountList || [];
    return errorDestination
      ? ACCOUNT_OPTIONS_DEFAULT
      : accounts.map((acc) => ({
          value: acc.account_name,
          label: acc.account_name,
        }));
  }, [destinationAccountsData, errorDestination]);

  // Custom hook for form management
  const {
    formData: transferData,
    inputFormat,
    validationMessages,
    isReset,
    isLoading,
    error,
    updateField,
    handleSubmit,
    setInputFormat,
  } = useTrackerForm(
    {
      amount: 0,
      origin_account: '',
      destination_account: '',
      note: '',
      currency: DEFAULT_CURRENCY,
    },
    url_movement_transaction_record,
    typeMovement,
    user
  );

  // Handlers
  const updateDataCurrency = (currency: CurrencyType) => {
    updateField('currency', currency);
  };

  const originAccountSelectHandler = (
    selectedOption: DropdownOptionType | null
  ) => {
    updateField('origin_account', selectedOption?.value || '');
  };

  const destinationAccountSelectHandler = (
    selectedOption: DropdownOptionType | null
  ) => {
    updateField('destination_account', selectedOption?.value || '');
  };

  return (
    <>
      <form className='transfer' onSubmit={handleSubmit}>
        {/* Account Type Selection (Radio Buttons) */}
        <div className='account-type-selector'>
          <div>
            <h4>Origin Account Type</h4>
            {ACCOUNT_TYPES.map((type) => (
              <label key={`origin-${type}`}>
                <input
                  type='radio'
                  name='originAccountType'
                  value={type}
                  checked={originAccountType === type}
                  onChange={() => setOriginAccountType(type)}
                />
                {type}
              </label>
            ))}
          </div>

          <div>
            <h4>Destination Account Type</h4>
            {ACCOUNT_TYPES.map((type) => (
              <label key={`dest-${type}`}>
                <input
                  type='radio'
                  name='destinationAccountType'
                  value={type}
                  checked={destinationAccountType === type}
                  onChange={() => setDestinationAccountType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        {/* Top Card: Amount + Origin Account */}
        <TopCard
          topCardElements={{
            titles: { title1: 'amount', title2: 'origin_account' },
            value: inputFormat.amount,
            selectOptions: {
              title: 'Origin Account',
              options: originAccountOptions,
              variant: VARIANT_DEFAULT,
            },
          }}
          validationMessages={validationMessages}
          updateTrackerData={(e) => {
            const { name, value } = e.target;
            if (name === 'amount') {
              setInputFormat({ amount: value });
              updateField(name, parseFloat(value) || 0);
            }
          }}
          trackerName={trackerState}
          currency={transferData.currency}
          updateCurrency={updateDataCurrency}
          isReset={isReset}
        />

        <CardSeparator />

        {/* Bottom Card: Destination Account + Note */}
        <div className='state__card--bottom'>
          <div className='card--title card--title--top'>
            Destination Account
            <span className='validation__errMsg'>
              {validationMessages['destination_account']}
            </span>
          </div>

          <DropDownSelection
            dropDownOptions={{
              title: 'Destination Account',
              options: destinationAccountOptions,
              variant: VARIANT_DEFAULT,
            }}
            updateOptionHandler={destinationAccountSelectHandler}
            isReset={isReset}
          />

          <CardNoteSave
            title='note'
            validationMessages={validationMessages}
            dataHandler={(e) => updateField('note', e.target.value)}
            inputNote={transferData.note}
            onSaveHandler={handleSubmit}
          />
        </div>
      </form>

      <MessageToUser
        isLoading={isLoading || isLoadingOrigin || isLoadingDestination}
        error={error || errorOrigin || errorDestination}
        variant='tracker'
      />
    </>
  );
}

export default Transfer;
```

---

## **3. Adaptaciones Clave**

### **1. Lógica de Fetching Dinámico**

- **Radio Buttons**: El usuario selecciona el tipo de cuenta (`bank`, `investment`, `pocket_saving`).
- **Fetch Condicional**:
  ```tsx
  const { refetch: refetchOrigin } = useFetch(..., { manual: true });
  useEffect(() => refetchOrigin(), [originAccountType]);
  ```

### **2. Estructura del Formulario**

| **Campo**             | **Tipo** | **Descripción**                            |
| --------------------- | -------- | ------------------------------------------ |
| `origin_account`      | Dropdown | Dinámico (según `originAccountType`).      |
| `destination_account` | Dropdown | Dinámico (según `destinationAccountType`). |
| `amount`              | Input    | Validado como número.                      |

### **3. UI con Radios + Dropdowns**

```tsx
<div className='account-type-selector'>
  {ACCOUNT_TYPES.map((type) => (
    <label key={type}>
      <input
        type='radio'
        checked={originAccountType === type}
        onChange={() => setOriginAccountType(type)}
      />
      {type}
    </label>
  ))}
</div>
```

---

## **4. Constantes y Tipos Añadidos**

```ts
// helpers/constants.ts
export const ACCOUNT_TYPES = ['bank', 'investment', 'pocket_saving'] as const;
```

---

## **5. Mejoras Implementadas**

1. **Fetching Optimizado**:
   - Se ejecuta solo cuando el usuario selecciona un tipo de cuenta.
2. **UI Intuitiva**:
   - Radios para selección de tipo → Dropdowns con cuentas específicas.
3. **Reutilización de Hooks**:
   - `useTrackerForm` maneja lógica compartida (validación, submit).

---

## **🚀 Próximos Pasos**

1. **Validación Adicional**:
   - Evitar que `origin_account` y `destination_account` sean iguales.
2. **Mejorar Estilos CSS**:
   - Grid/Flex para los radio buttons.
3. **Caching con React Query**:
   - Para evitar re-fetch al cambiar entre tipos ya cargados.

¿Necesitas ajustar algún detalle o añadir más funcionalidades?

# **Validación Avanzada en el Componente `Transfer`**

Voy a implementar la validación adicional para evitar que el usuario seleccione la misma cuenta como origen y destino, excluyendo dinámicamente la cuenta seleccionada en el otro dropdown.

## **1. Modificaciones Clave**

### **A. Tipado y Estado Adicional**

```typescript
// types/types.ts
export type TransferInputDataType = {
  amount: number;
  origin_account: string;
  origin_account_id: string; // Nuevo campo
  destination_account: string;
  destination_account_id: string; // Nuevo campo
  note: string;
  currency: string;
};
```

### **B. Filtrado de Opciones en Dropdowns**

Modificaremos los `useMemo` para excluir la cuenta seleccionada en el otro campo:

```typescript
const originAccountOptions = useMemo(() => {
  const accounts = originAccountsData?.data?.accountList || [];
  return errorOrigin
    ? ACCOUNT_OPTIONS_DEFAULT
    : accounts
        .filter((acc) => acc.account_id !== transferData.destination_account_id) // Excluye destino
        .map((acc) => ({
          value: acc.account_name,
          label: acc.account_name,
          account_id: acc.account_id,
        }));
}, [originAccountsData, errorOrigin, transferData.destination_account_id]);

const destinationAccountOptions = useMemo(() => {
  const accounts = destinationAccountsData?.data?.accountList || [];
  return errorDestination
    ? ACCOUNT_OPTIONS_DEFAULT
    : accounts
        .filter((acc) => acc.account_id !== transferData.origin_account_id) // Excluye origen
        .map((acc) => ({
          value: acc.account_name,
          label: acc.account_name,
          account_id: acc.account_id,
        }));
}, [destinationAccountsData, errorDestination, transferData.origin_account_id]);
```

### **C. Handlers Actualizados**

```typescript
const originAccountSelectHandler = (
  selectedOption: DropdownOptionType | null
) => {
  updateField('origin_account', selectedOption?.value || '');
  updateField(
    'origin_account_id',
    originAccountsData?.data?.accountList.find(
      (acc) => acc.account_name === selectedOption?.value
    )?.account_id || ''
  );
};

const destinationAccountSelectHandler = (
  selectedOption: DropdownOptionType | null
) => {
  updateField('destination_account', selectedOption?.value || '');
  updateField(
    'destination_account_id',
    destinationAccountsData?.data?.accountList.find(
      (acc) => acc.account_name === selectedOption?.value
    )?.account_id || ''
  );
};
```

## **2. Validación en Submit**

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validación adicional
  if (transferData.origin_account_id === transferData.destination_account_id) {
    setValidationMessages({
      ...validationMessages,
      destination_account: 'Origin and destination accounts cannot be the same',
    });
    return;
  }

  // Resto de la lógica de submit...
};
```

## **3. UI con Mensaje de Validación**

```tsx
<DropDownSelection
  dropDownOptions={{
    title: 'Destination Account',
    options: destinationAccountOptions,
    variant: VARIANT_DEFAULT,
  }}
  updateOptionHandler={destinationAccountSelectHandler}
  isReset={isReset}
  error={validationMessages.destination_account}
/>
```

## **4. Implementación Completa del Componente**

```tsx
// src/pages/tracker/transfer/Transfer.tsx
import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import CardSeparator from '../components/CardSeparator';
import TopCard from '../components/TopCard';
import CardNoteSave from '../components/CardNoteSave';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection';
import MessageToUser from '../../../general_components/messageToUser/MessageToUser';
import { useTrackerForm } from '../../../hooks/useTrackerForm';
import { useFetch } from '../../../hooks/useFetch';
import {
  url_get_accounts_by_type,
  url_movement_transaction_record,
} from '../../../endpoints';
import {
  ACCOUNT_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
  ACCOUNT_TYPES,
} from '../../../helpers/constants';
import { AccountByTypeResponseType } from '../../../types/responseApiTypes';
import {
  CurrencyType,
  DropdownOptionType,
  VariantType,
} from '../../../types/types';

const VARIANT_DEFAULT: VariantType = 'tracker';

function Transfer() {
  const { pathname } = useLocation();
  const trackerState = pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement = trackerState.toLowerCase();
  const user = import.meta.env.VITE_USER_ID;

  // State for account type selection
  const [originAccountType, setOriginAccountType] = useState<string>('bank');
  const [destinationAccountType, setDestinationAccountType] =
    useState<string>('bank');

  // Fetch accounts
  const {
    apiData: originAccountsData,
    isLoading: isLoadingOrigin,
    error: errorOrigin,
    refetch: refetchOrigin,
  } = useFetch<AccountByTypeResponseType>(
    `${url_get_accounts_by_type}/?type=${originAccountType}&user=${user}`,
    { manual: true }
  );

  const {
    apiData: destinationAccountsData,
    isLoading: isLoadingDestination,
    error: errorDestination,
    refetch: refetchDestination,
  } = useFetch<AccountByTypeResponseType>(
    `${url_get_accounts_by_type}/?type=${destinationAccountType}&user=${user}`,
    { manual: true }
  );

  useEffect(() => {
    refetchOrigin();
    refetchDestination();
  }, [originAccountType, destinationAccountType]);

  // Custom hook with extended type
  const {
    formData: transferData,
    inputFormat,
    validationMessages,
    isReset,
    isLoading,
    error,
    updateField,
    handleSubmit: originalHandleSubmit,
    setInputFormat,
    setValidationMessages,
  } = useTrackerForm<TransferInputDataType>(
    {
      amount: 0,
      origin_account: '',
      origin_account_id: '',
      destination_account: '',
      destination_account_id: '',
      note: '',
      currency: DEFAULT_CURRENCY,
    },
    url_movement_transaction_record,
    typeMovement,
    user
  );

  // Filtered dropdown options
  const originAccountOptions = useMemo(() => {
    const accounts = originAccountsData?.data?.accountList || [];
    return errorOrigin
      ? ACCOUNT_OPTIONS_DEFAULT
      : accounts
          .filter(
            (acc) => acc.account_id !== transferData.destination_account_id
          )
          .map((acc) => ({
            value: acc.account_name,
            label: acc.account_name,
            account_id: acc.account_id,
          }));
  }, [originAccountsData, errorOrigin, transferData.destination_account_id]);

  const destinationAccountOptions = useMemo(() => {
    const accounts = destinationAccountsData?.data?.accountList || [];
    return errorDestination
      ? ACCOUNT_OPTIONS_DEFAULT
      : accounts
          .filter((acc) => acc.account_id !== transferData.origin_account_id)
          .map((acc) => ({
            value: acc.account_name,
            label: acc.account_name,
            account_id: acc.account_id,
          }));
  }, [
    destinationAccountsData,
    errorDestination,
    transferData.origin_account_id,
  ]);

  // Enhanced handlers
  const originAccountSelectHandler = (
    selectedOption: DropdownOptionType | null
  ) => {
    updateField('origin_account', selectedOption?.value || '');
    updateField(
      'origin_account_id',
      originAccountsData?.data?.accountList.find(
        (acc) => acc.account_name === selectedOption?.value
      )?.account_id || ''
    );
  };

  const destinationAccountSelectHandler = (
    selectedOption: DropdownOptionType | null
  ) => {
    updateField('destination_account', selectedOption?.value || '');
    updateField(
      'destination_account_id',
      destinationAccountsData?.data?.accountList.find(
        (acc) => acc.account_name === selectedOption?.value
      )?.account_id || ''
    );
  };

  // Enhanced submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      transferData.origin_account_id === transferData.destination_account_id
    ) {
      setValidationMessages({
        ...validationMessages,
        destination_account:
          'Origin and destination accounts cannot be the same',
      });
      return;
    }

    await originalHandleSubmit(e);
  };

  return (
    <>
      <form className='transfer' onSubmit={handleSubmit}>
        {/* Account Type Selection */}
        <div className='account-type-selector'>
          <div>
            <h4>Origin Account Type</h4>
            {ACCOUNT_TYPES.map((type) => (
              <label key={`origin-${type}`}>
                <input
                  type='radio'
                  name='originAccountType'
                  value={type}
                  checked={originAccountType === type}
                  onChange={() => setOriginAccountType(type)}
                />
                {type}
              </label>
            ))}
          </div>

          <div>
            <h4>Destination Account Type</h4>
            {ACCOUNT_TYPES.map((type) => (
              <label key={`dest-${type}`}>
                <input
                  type='radio'
                  name='destinationAccountType'
                  value={type}
                  checked={destinationAccountType === type}
                  onChange={() => setDestinationAccountType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        {/* Top Card */}
        <TopCard
          topCardElements={{
            titles: { title1: 'amount', title2: 'origin_account' },
            value: inputFormat.amount,
            selectOptions: {
              title: 'Origin Account',
              options: originAccountOptions,
              variant: VARIANT_DEFAULT,
            },
          }}
          validationMessages={validationMessages}
          updateTrackerData={(e) => {
            const { name, value } = e.target;
            if (name === 'amount') {
              setInputFormat({ amount: value });
              updateField(name, parseFloat(value) || 0);
            }
          }}
          trackerName={trackerState}
          currency={transferData.currency}
          updateCurrency={(currency) => updateField('currency', currency)}
          isReset={isReset}
        />

        <CardSeparator />

        {/* Bottom Card */}
        <div className='state__card--bottom'>
          <div className='card--title card--title--top'>
            Destination Account
            <span className='validation__errMsg'>
              {validationMessages.destination_account}
            </span>
          </div>

          <DropDownSelection
            dropDownOptions={{
              title: 'Destination Account',
              options: destinationAccountOptions,
              variant: VARIANT_DEFAULT,
            }}
            updateOptionHandler={destinationAccountSelectHandler}
            isReset={isReset}
          />

          <CardNoteSave
            title='note'
            validationMessages={validationMessages}
            dataHandler={(e) => updateField('note', e.target.value)}
            inputNote={transferData.note}
            onSaveHandler={handleSubmit}
          />
        </div>
      </form>

      <MessageToUser
        isLoading={isLoading || isLoadingOrigin || isLoadingDestination}
        error={error || errorOrigin || errorDestination}
        variant='tracker'
      />
    </>
  );
}

export default Transfer;
```

## **5. Mejoras Implementadas**

1. **Exclusión Dinámica de Cuentas**:

   - El dropdown de destino no muestra la cuenta seleccionada como origen, y viceversa.

2. **Validación en Tiempo Real**:

   - Comparación de `account_id` en lugar de nombres para mayor precisión.

3. **Experiencia de Usuario Mejorada**:

   - Mensajes claros cuando se intenta seleccionar la misma cuenta.

4. **Tipado Seguro**:

   - Nuevo tipo `TransferInputDataType` con campos para IDs.

5. **Performance Optimizado**:
   - `useMemo` para evitar recálculos innecesarios de las opciones.

## **Próximos Pasos**

1. **Estilizar los Radio Buttons** para mejor UX
2. **Agregar Loading States** durante cambios de tipo de cuenta
3. **Implementar React Query** para manejo avanzado de caché

¿Necesitas ajustar algún otro aspecto del componente?


