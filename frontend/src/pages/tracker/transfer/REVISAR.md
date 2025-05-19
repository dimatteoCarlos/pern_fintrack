No es necesario que me pases el componente `TopCard` porque la lógica de filtrado debe manejarse en el componente padre (`Expense.tsx`). El componente `DropdownSelection` tampoco necesita modificaciones, ya que solo recibe las opciones que le pasas desde el padre.  

### **Pasos Claros para Implementar la Validación**  

1. **Modificar `movementInputData` para almacenar `account_id`**  
   - Actualmente solo guardas `account_name` (`origin` y `destination`), pero necesitamos comparar por `account_id`.  
   - Añade estos campos al estado:  
     ```tsx
     interface MovementInputDataType {
       amount: number;
       origin: string;
       destination: string;
       originAccountId?: number;  // Nuevo campo
       destinationAccountId?: number;  // Nuevo campo
       note: string;
       currency: CurrencyType;
       originAccountType: string;
       destinationAccountType: string;
     }
     ```

2. **Actualizar los manejadores de selección**  
   - Cuando el usuario selecciona una cuenta, guarda también el `account_id`.  
   - Ejemplo para el destino (haz lo mismo para el origen):  
     ```tsx
     function destinationAccountSelectHandler(selectedOption: DropdownOptionType | null) {
       // Busca el account_id correspondiente al nombre seleccionado
       const selectedAccount = destinationAccountsResponse?.data?.accountList.find(
         (acc) => acc.account_name === selectedOption?.value
       );

       setMovementInputData((prev) => ({
         ...prev,
         destination: selectedOption?.value || "",
         destinationAccountId: selectedAccount?.account_id,
       }));
     }
     ```

3. **Filtrar las opciones en tiempo real**  
   - Usa `useMemo` para generar listas filtradas:  
     ```tsx
     const filteredDestinationOptions = useMemo(() => {
       if (!movementInputData.originAccountId) {
         return optionsDestinationAccounts; // Si no hay origen seleccionado, muestra todo
       }
       // Filtra excluyendo la cuenta de origen seleccionada
       return optionsDestinationAccounts.filter(
         (acc) => acc.account_id !== movementInputData.originAccountId
       );
     }, [optionsDestinationAccounts, movementInputData.originAccountId]);

     const filteredOriginOptions = useMemo(() => {
       if (!movementInputData.destinationAccountId) {
         return optionsOriginAccounts; // Si no hay destino seleccionado, muestra todo
       }
       // Filtra excluyendo la cuenta de destino seleccionada
       return optionsOriginAccounts.filter(
         (acc) => acc.account_id !== movementInputData.destinationAccountId
       );
     }, [optionsOriginAccounts, movementInputData.destinationAccountId]);
     ```

4. **Pasar las opciones filtradas a los Dropdowns**  
   - Actualiza las props de `DropDownSelection`:  
     ```tsx
     <DropDownSelection
       dropDownOptions={{
         ...destinationAccountOptionsToRender,
         options: filteredDestinationOptions, // Opciones filtradas
       }}
       updateOptionHandler={destinationAccountSelectHandler}
       isReset={isReset}
       setIsReset={setIsReset}
     />
     ```
   - Haz lo mismo para el dropdown de origen.

5. **Resetear correctamente al cambiar tipo de cuenta**  
   - Cuando el usuario cambie el tipo de cuenta (ej: de `bank` a `investment`), asegúrate de limpiar los IDs:  
     ```tsx
     function handleOriginAccountTypeChange(newAccountType: string) {
       setMovementInputData((prev) => ({
         ...prev,
         origin: "",
         originAccountId: undefined,  // Limpia el ID
         originAccountType: newAccountType,
       }));
       // Resto de tu lógica...
     }
     ```

### **¿Por qué no tocar `DropdownSelection`?**  
- El componente ya funciona recibiendo `options` y manejando selecciones.  
- La lógica de filtrado debe estar en el padre (`Expense.tsx`) porque depende del estado global del formulario.  

### **Próximos Pasos**  
1. Implementa los cambios en el estado (`MovementInputDataType`).  
2. Modifica los manejadores para guardar `account_id`.  
3. Aplica el filtrado con `useMemo`.  
4. Testea que:  
   - Al seleccionar un origen, ese mismo account no aparezca en destino.  
   - Al cambiar el tipo de cuenta, los dropdowns se resetear correctamente.  

¿Necesitas que desarrolle alguna parte en más detalle? 😊





### **Problem Analysis & Solution Approach**  

#### **Objective**  
Ensure that the **origin account** selected by the user does **not appear** in the **destination dropdown**, and vice versa.  

#### **Key Observations**  
1. **Data Structure**:  
   - Both `originAccountsResponse` and `destinationAccountsResponse` return an array of `AccountListType` objects.  
   - Each account has a unique `account_id` and `account_name`.  

2. **Current Flow**:  
   - The user selects an **origin account** (from `originAccountOptionsToRender`).  
   - The user selects a **destination account** (from `destinationAccountOptionsToRender`).  
   - Currently, **no filtering** is applied, so the same account can appear in both dropdowns.  

3. **Expected Behavior**:  
   - If the user selects **"Account A"** as the **origin**, it should **not** appear in the **destination dropdown**.  
   - Similarly, if **"Account B"** is selected as the **destination**, it should **not** appear in the **origin dropdown**.  

---

### **Solution Approach**  

#### **Step 1: Track Selected Accounts in State**  
- Store the **selected origin account ID** and **selected destination account ID** in state.  
- Update these whenever a selection is made.  

#### **Step 2: Filter Dropdown Options Dynamically**  
- When rendering the **destination dropdown**, **exclude** the currently selected **origin account**.  
- When rendering the **origin dropdown**, **exclude** the currently selected **destination account**.  

#### **Step 3: Implementation Steps**  
1. **Modify `movementInputData` State**:  
   - Store `originAccountId` and `destinationAccountId` (not just names).  

2. **Update `destinationAccountOptionsToRender`**:  
   - Filter out the **origin account** (if selected).  

3. **Update `originAccountOptionsToRender`**:  
   - Filter out the **destination account** (if selected).  

4. **Reset Logic**:  
   - If the user changes the **account type** (e.g., from `bank` to `investment`), reset the selections.  

---

### **Proposed Code Changes**  

#### **1. Update `movementInputData` State**  
```tsx
interface MovementInputDataType {
  amount: number;
  origin: string;
  destination: string;
  originAccountId?: number; // Add this
  destinationAccountId?: number; // Add this
  note: string;
  currency: CurrencyType;
  originAccountType: string;
  destinationAccountType: string;
}
```

#### **2. Modify `destinationAccountSelectHandler` & Origin Selection**  
```tsx
function destinationAccountSelectHandler(selectedOption: DropdownOptionType | null) {
  const selectedAccount = destinationAccountsResponse?.data?.accountList.find(
    acc => acc.account_name === selectedOption?.value
  );

  setMovementInputData((prev) => ({
    ...prev,
    destination: selectedOption?.value,
    destinationAccountId: selectedAccount?.account_id,
  }));
}

// Similarly, modify origin account selection
```

#### **3. Filter Options Before Rendering**  
```tsx
const filteredDestinationOptions = useMemo(() => {
  if (!movementInputData.originAccountId) return optionsDestinationAccounts;

  return optionsDestinationAccounts.filter(
    (acc) => acc.account_id !== movementInputData.originAccountId
  );
}, [optionsDestinationAccounts, movementInputData.originAccountId]);

const filteredOriginOptions = useMemo(() => {
  if (!movementInputData.destinationAccountId) return optionsOriginAccounts;

  return optionsOriginAccounts.filter(
    (acc) => acc.account_id !== movementInputData.destinationAccountId
  );
}, [optionsOriginAccounts, movementInputData.destinationAccountId]);
```

#### **4. Apply Filtered Options to Dropdowns**  
```tsx
const destinationAccountOptionsToRender = {
  title: 'Accounts',
  options: filteredDestinationOptions,
  variant: 'tracker' as VariantType,
};

const originAccountOptionsToRender = {
  title: 'Available Accounts',
  options: filteredOriginOptions,
  variant: 'tracker' as VariantType,
};
```

---

### **Final Notes**  
✅ **Dynamic Filtering**: The dropdowns will **automatically update** when a selection is made.  
✅ **No Duplicates**: Ensures the same account **cannot** be selected in both fields.  
✅ **Reset Handling**: Changing account types resets selections.  

Would you like me to provide the exact code modifications for your component? 😊