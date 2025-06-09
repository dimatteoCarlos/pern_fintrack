Aquí te presento una función de validación de formularios genérica y reusable, junto con ejemplos de cómo usarla. Esta función te permite definir tus reglas de validación de manera flexible y aplicarlas a cualquier objeto de datos.

TypeScript

interface ValidationRule<T> {
field: keyof T; // La clave del campo en el objeto de datos
isValid: (value: T[keyof T], formData: T) => boolean; // Función que determina si el valor es válido
message: string; // Mensaje de error a mostrar si la validación falla
}

interface ValidationResult {
[key: string]: string; // Objeto que mapea nombres de campo a mensajes de error
}

/\*\*

- Valida un formulario genérico basándose en un conjunto de reglas de validación.
-
- @param formData El objeto de datos del formulario a validar.
- @param rules Un array de reglas de validación.
- @returns Un objeto con los errores de validación. Si está vacío, el formulario es válido.
  \*/
  const validateForm = <T extends object>(
  formData: T,
  rules: ValidationRule<T>[]
  ): ValidationResult => {
  const errors: ValidationResult = {};

rules.forEach(rule => {
if (!rule.isValid(formData[rule.field], formData)) {
errors[rule.field as string] = rule.message;
}
});

return errors;
};

// --- Ejemplo de uso ---

interface MovementInputData {
amount: number | null;
origin: string;
destination: string;
note: string;
}

// Supongamos que tienes tus datos en un estado o variable
const movementInputData: MovementInputData = {
amount: 50,
origin: 'Cuenta A',
destination: 'Cuenta B',
note: 'Transferencia de prueba',
};

// Definir las reglas de validación para movementInputData
const movementValidationRules: ValidationRule<MovementInputData>[] = [
{
field: 'amount',
isValid: (amount, _formData) =>
amount === null || (typeof amount === 'number' && amount >= 0),
message: 'Amount must be greater than or equal to 0',
},
{
field: 'origin',
isValid: origin => !!origin,
message: 'Origin account is required',
},
{
field: 'destination',
isValid: destination => !!destination,
message: 'Destination account is required',
},
{
field: 'origin', // Puedes tener múltiples reglas para el mismo campo
isValid: (origin, formData) => origin !== formData.destination,
message: 'Origin and destination accounts must be different',
},
{
field: 'note',
isValid: note => !!note,
message: 'Note is required',
},
];

// Función para simular la actualización de mensajes de validación
const setValidationMessages = (messages: ValidationResult) => {
console.log('Mensajes de validación:', messages);
// Aquí es donde normalmente actualizarías el estado de tu componente
// para mostrar los errores en la interfaz de usuario.
};

// Uso de la función genérica
const validateMovementForm = (): boolean => {
const errors = validateForm(movementInputData, movementValidationRules);
setValidationMessages(errors);
return Object.keys(errors).length === 0;
};

// Probar la validación
const isValid = validateMovementForm();
console.log('¿Es válido el formulario de movimiento?', isValid);

// --- Otro ejemplo: Validar un formulario de usuario ---

interface UserFormInput {
name: string;
email: string;
password?: string; // Opcional
}

const userFormInput: UserFormInput = {
name: 'Juan Pérez',
email: 'juan@example.com',
password: 'password123',
};

const userValidationRules: ValidationRule<UserFormInput>[] = [
{
field: 'name',
isValid: name => typeof name === 'string' && name.trim().length > 0,
message: 'Name is required',
},
{
field: 'email',
isValid: email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email as string), // Regex para email
message: 'Invalid email format',
},
{
field: 'password',
isValid: (password, \_formData) =>
!password || (typeof password === 'string' && password.length >= 6), // Opcional pero si existe, mínimo 6 caracteres
message: 'Password must be at least 6 characters long',
},
];

const validateUserForm = (): boolean => {
const errors = validateForm(userFormInput, userValidationRules);
setValidationMessages(errors); // Reusamos la misma función para mostrar mensajes
return Object.keys(errors).length === 0;
};

const isUserFormValid = validateUserForm();
console.log('¿Es válido el formulario de usuario?', isUserFormValid);
Explicación de la solución
Interfaces genéricas para reglas de validación:

ValidationRule<T>: Define la estructura de cada regla de validación.
field: keyof T: Especifica la clave del campo en el objeto de datos del formulario (T). keyof T asegura seguridad de tipo, permitiendo solo campos existentes en T.
isValid: (value: T[keyof T], formData: T) => boolean: Una función que recibe el valor del campo actual y el objeto de datos completo del formulario. Retorna true si el valor es válido, false en caso contrario. Esto permite validaciones que dependen de otros campos (como en el caso de origin y destination ser diferentes).
message: string: El mensaje de error que se mostrará si la validación falla.
ValidationResult: Es un objeto simple que mapea los nombres de los campos a sus respectivos mensajes de error.
validateForm<T extends object> (La función genérica):

Toma dos argumentos:
formData: T: El objeto de datos que quieres validar. T extends object lo hace genérico para cualquier tipo de objeto.
rules: ValidationRule<T>[]: Un array de las reglas de validación que se aplicarán al formData.
Inicializa un objeto errors vacío.
Itera sobre cada rule en el array rules.
Para cada regla, llama a rule.isValid() pasando el valor del campo correspondiente (formData[rule.field]) y el formData completo.
Si isValid() retorna false (lo que significa que la validación falló), agrega un mensaje de error al objeto errors usando el nombre del campo como clave y rule.message como valor.
Finalmente, retorna el objeto errors. Si este objeto está vacío, significa que todas las validaciones pasaron y el formulario es válido.
Ejemplo de Uso (MovementInputData y UserFormInput):

Se definen interfaces específicas para los datos de cada formulario (MovementInputData, UserFormInput).
Se crean arrays de reglas de validación (movementValidationRules, userValidationRules) que son tipadas para las interfaces de datos correspondientes. Esto asegura que solo se usen campos válidos y que las funciones isValid reciban los tipos de datos correctos.
La función setValidationMessages se incluye para mostrar cómo se podrían manejar los errores en tu aplicación (por ejemplo, actualizando el estado de un componente React o Vue).
Las funciones validateMovementForm y validateUserForm demuestran cómo llamar a la función genérica validateForm con sus respectivas reglas.
Beneficios de esta solución
Reusabilidad: La función validateForm puede usarse para cualquier tipo de formulario, independientemente de su estructura de datos, simplemente definiendo las reglas adecuadas.
Flexibilidad: Las reglas de validación son funciones (isValid), lo que permite lógicas de validación complejas, incluyendo la validación cruzada entre campos.
Tipado Fuerte: El uso de TypeScript y genéricos (<T>) proporciona seguridad de tipo, ayudando a detectar errores en tiempo de desarrollo.
Legibilidad: Las reglas de validación están claramente definidas y separadas de la lógica de validación central, lo que facilita su lectura y mantenimiento.
Extensibilidad: Es fácil agregar nuevas reglas de validación o modificar las existentes sin cambiar la lógica principal de validateForm.
Esta aproximación te permite construir sistemas de validación robustos y escalables en tus aplicaciones.

# Flujo de Trabajo y Lógica para Validación en Tiempo Real en Transfer.tsx

## Flujo General del Componente

Este componente maneja transferencias entre cuentas con validación en tiempo real. El flujo principal es:

1. **Inicialización**: Establece estados iniciales para datos del formulario, mensajes de validación y selecciones de cuenta.
2. **Renderizado inicial**: Muestra el formulario con campos vacíos.
3. **Interacción del usuario**: El usuario comienza a completar los campos.
4. **Validación en tiempo real**: Se validan los datos mientras el usuario escribe/selecciona.
5. **Feedback inmediato**: Muestra/oculta mensajes de error según corresponda.
6. **Envío**: Cuando todo es válido, permite el envío del formulario.

## Mecanismo de Validación en Tiempo Real

### 1. Manejo de Cambios en los Campos

- **Para campos de texto (amount, note)**:

  - El evento `onChange` llama a `updateTrackerData`
  - Esta función actualiza el estado del formulario (`formData` y `movementInputData`)
  - Realiza validación básica (ej: formato numérico para amount)
  - Actualiza los mensajes de validación en el estado

- **Para selección de cuentas (dropdowns)**:
  - Los handlers `originAcountSelectHandler` y `destinationAccountSelectHandler` se ejecutan al seleccionar
  - Actualizan el estado con la selección
  - Limpian mensajes de error previos para ese campo

### 2. Eliminación Instantánea de Mensajes de Error

El secreto está en cómo se manejan los estados:

1. **Estado de validación**: `validationMessages` es un objeto que contiene todos los mensajes de error.
2. **Actualización selectiva**:
   - Cuando un campo se corrige, su mensaje de error se borra específicamente:
     ```typescript
     setValidationMessages((prev) => ({ ...prev, origin: '' })); // Ejemplo para campo 'origin'
     ```
3. **Validación completa al enviar**: Al intentar enviar, `validateForm()` verifica todos los campos y actualiza todos los mensajes necesarios.

### 3. Validación por Campo

- **Amount**:

  - Verifica formato numérico con `checkNumberFormatValue`
  - Actualiza mensajes mientras se escribe
  - Valida que sea ≥ 0 al enviar

- **Cuentas (origin/destination)**:

  - Valida que estén seleccionadas
  - Valida que sean diferentes entre sí
  - Los mensajes se limpian inmediatamente al seleccionar una opción válida

- **Note**:
  - Valida que no esté vacío al enviar

## Flujo Detallado por Campo

### Campo "Amount"

1. Usuario escribe en el campo amount
2. `updateTrackerData` se ejecuta:
   - Valida formato con `checkNumberFormatValue`
   - Si hay error de formato: muestra mensaje específico
   - Si el formato es correcto: borra mensaje de error
   - Guarda el valor numérico limpio en `movementInputData`
   - Guarda el valor formateado en `formData` para mostrar al usuario
3. Al corregir el error, el mensaje desaparece inmediatamente

### Selectores de Cuenta (Dropdowns)

1. Usuario selecciona una cuenta de origen/destino
2. El handler correspondiente (`originAcountSelectHandler`/`destinationAccountSelectHandler`):
   - Busca el ID de la cuenta seleccionada
   - Actualiza el estado con nombre e ID de la cuenta
   - Borra explícitamente cualquier mensaje de error para ese campo
   - Si luego se deselecciona, la validación al enviar detectará el error

### Radio Buttons (Tipo de Cuenta)

1. Usuario cambia el tipo de cuenta (bank/investment/pocket)
2. Los handlers (`handleOriginAccountTypeChange`/`handleDestinationAccountTypeChange`):
   - Resetean las selecciones de cuenta relacionadas
   - Limpian mensajes de error
   - Forzan un reset del dropdown correspondiente

## Ventajas de este Enfoque

1. **Respuesta inmediata**: Los usuarios ven los errores y sus correcciones al instante.
2. **Experiencia fluida**: No hay que esperar al envío para descubrir errores.
3. **Código mantenible**: La lógica de validación está centralizada pero se aplica granularmente.
4. **Estado coherente**: Siempre refleja la validación actual de todos los campos.

Este flujo combina validación en tiempo real para campos simples con validación completa al enviar, proporcionando una experiencia de usuario óptima.
