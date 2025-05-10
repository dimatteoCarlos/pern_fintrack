import React, { useEffect, useCallback } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { currencyFormat } from '../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../helpers/constants';
import { useFetch } from '../../hooks/useFetch';
import { BalanceBankRespType } from '../../types/responseApiTypes';
import { url_get_total_account_balance_by_type } from '../../endpoints';
import CoinSpinner from '../../loader/coin/CoinSpinner';
import { MessageToUser } from '../../general_components/messageToUser/MessageToUser';
import LogoMenuIcon from '../../general_components/header/LogoMenuIcon';
import TrackerNavbar from '../../general_components/trackerNavbar/TrackerNavbar';
import './styles/tracker-style.css';
import useTotalBalanceStore from './storeTotalBalance';

function TrackerLayout() {
    const defaultCurrency = DEFAULT_CURRENCY;
    const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
    const userId = import.meta.env.VITE_USER_ID;
    const { availableBudget, setAvailableBudget } = useTotalBalanceStore(); // Modificado: Solo usamos setAvailableBudget
    const [messageToUser, setMessageToUser] = React.useState<string | null>(null);

    // Modificado: Mover la lógica de fetch aquí
    const fetchData = useCallback(async () => {
        try {
            // Corrección: Asegurar que userId se interpola correctamente en la URL
            const response = await fetch(`${url_get_total_account_balance_by_type}/?type=bank&user=${userId}`);
            const data: BalanceBankRespType = await response.json();
            if (data?.data?.total_balance !== undefined) {
                setAvailableBudget(data.data.total_balance); // Usar setAvailableBudget
            } else {
                setAvailableBudget(0);
            }
        } catch (error) {
            console.error("Error fetching balance:", error);
            setAvailableBudget(0);
        }
    }, [userId, setAvailableBudget]); // Dependencia de setAvailableBudget añadida

    const { isLoading, error } = useFetch<BalanceBankRespType>(
        `${url_get_total_account_balance_by_type}/?type=bank&user=${userId}`,
        fetchData // Usar fetchData en useFetch
    );

    useEffect(() => {
        let timer: NodeJS.Timeout;

        if (!isLoading && !error) {
            setMessageToUser(null);
            timer = setTimeout(() => setMessageToUser(null), 3000);
        } else if (error) {
            setMessageToUser(error.message);
            timer = setTimeout(() => setMessageToUser(null), 3000);
        }

        return () => clearTimeout(timer);
    }, [isLoading, error]);

    const updateAvailableBudget = useCallback(() => {
        fetchData(); // Llamar a fetchData en lugar de la función del store
    }, [fetchData]);

    return (
        <>
            <div className="layout__header">
                <div className="headerContent__container">
                    <LogoMenuIcon />
                    <div className={`displayScreen ${'light'}`}>
                        {isLoading && (
                            <div className="tracker-layout-container">
                                <CoinSpinner />
                            </div>
                        )}
                        <div className={`displayScreen--concept ${'dark'}`}>
                            Available Budget
                        </div>
                        <div className={`displayScreen--result ${'dark'}`}>
                            {currencyFormat(
                                defaultCurrency,
                                availableBudget,
                                formatNumberCountry
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <TrackerNavbar />
            <div className="cards__presentation--tracker">
                <Outlet context={{ updateAvailableBudget }} />
                {messageToUser && (
                    <MessageToUser
                        isLoading={isLoading}
                        messageToUser={messageToUser}
                        error={error}
                        variant="tracker"
                    />
                )}
            </div>
        </>
    );
}

export default TrackerLayout;

Buena pregunta. Si tu objetivo principal es **actualizar un estado que se renderiza en el componente padre** cuando se realizan transacciones en componentes hijos, **no es estrictamente necesario** refactorizar todo tu sistema hacia un enfoque centralizado como `useStore` o `context` *si tu solución actual ya funciona*.

Pero si aún así preguntas por qué algunos recomendarían aplicar `useStore` o un sistema centralizado, aquí te explico **cuándo y por qué podría ser recomendable**:

---

### ✅ ¿Cuándo vale la pena usar `useStore` o estado global?

1. **Cuando varios componentes (hermanos, padres, nietos) necesitan reaccionar al mismo cambio de estado.**
2. **Cuando quieres evitar el "prop drilling"** (pasar props manualmente desde el padre al hijo al nieto).
3. **Cuando necesitas que una actualización se refleje en múltiples rutas/páginas sin recargar o hacer un fetch completo.**
4. **Cuando estás haciendo muchas actualizaciones que afectan al mismo estado raíz o vista resumen** (por ejemplo, dashboard con balances, ingresos, gastos).

---

### 🧠 En tu caso:

Tú tienes:

* Un componente **padre que muestra balances** (por ejemplo, `/dashboard`, o la página principal).
* Componentes **hijos que realizan transacciones** (por ejemplo, `/transfer`, `/add-money`, etc).

Y tu problema es:

> “Cuando se realiza una transacción en una página hija, ¿cómo actualizar los datos del componente padre que muestra balances?”

---

### 🧩 Soluciones posibles:

#### ✅ Opción 1: Estado global (`useStore`, `Zustand`, `Context`)

El padre y los hijos comparten el estado del balance. Los hijos actualizan este estado al registrar una transacción, y el padre automáticamente se re-renderiza. Ejemplo:

```ts
// store/useBalanceStore.ts
const useBalanceStore = create((set) => ({
  balance: 0,
  setBalance: (newBalance) => set({ balance: newBalance }),
}));
```

Este enfoque evita tener que propagar cambios o usar eventos.

---

#### ✅ Opción 2: Lifting State Up + callback

Pasas una función desde el padre al hijo como prop para actualizar el estado. Por ejemplo:

```tsx
// En padre
const [balance, setBalance] = useState(1000);

<TransaccionForm onTransaccionExitosa={(nuevoBalance) => setBalance(nuevoBalance)} />
```

Funciona bien si ambos están montados al mismo tiempo (por ejemplo, en un modal), **pero no sirve si las páginas son diferentes rutas**.

---

#### ✅ Opción 3: Revalidación tras navegación (`react-router`, `fetch`, etc)

Cuando regresas de una transacción, haces un nuevo `fetch` para obtener el balance actualizado.

**Cómo hacerlo bien:**

* Usa `useEffect` en el componente padre que escuche cambios en `location.pathname` o alguna `flag` global.
* Alternativamente, puedes usar `navigate(-1, { state: { updated: true } })` y en el componente padre revisar `location.state.updated`.

---

### 🎯 Resumen directo:

* Si tu app es **multivista (multi-page)** y necesitas mantener el estado consistente sin recargar o refetchear todo, **usa un estado global (`useStore`)**.
* Si todo está en un solo árbol de componentes (mismo DOM, mismo render), **puedes levantar el estado (`lifting state up`) o pasar callbacks**.
* Si estás satisfecho con cómo funciona actualmente, y solo quieres una forma confiable de actualizar el estado después de una transacción, podrías simplemente:

  * Usar un estado global **solo para balance**, y nada más.
  * O, revalidar el balance cuando vuelvas a la página principal.

¿Quieres que te muestre cómo sería solo una pequeña implementación del estado global para manejar el balance (sin tocar el resto de tu app)?

