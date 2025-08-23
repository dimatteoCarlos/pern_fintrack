 Tópicos Pendientes y Consultas

0. como hacer deployment, como verificar componentes no usados o rotos, 

1. Funcionalidad y Lógica de Negocio
Cálculo de Net Worth: Aclarar con el cliente la definición de Net Worth y si su cálculo debe incluir activos (bancos, inversiones) y pasivos (deudas).

Manejo de Pocket Savings: Definir si los montos de Pocket Savings son cuentas separadas o están distribuidos en otras cuentas.

Estructura de Categorías: Implementar una nueva estructura para manejar categorías y subcategorías.

Edición y Eliminación: Establecer una estrategia para editar y eliminar datos, y definir los campos editables y sus interrelaciones en la base de datos.

Exportación de Datos: Habilitar la exportación de movimientos en formatos como PDF, Excel y .csv.

Balance de Inversiones: Aclarar el cálculo del balance total de las inversiones.

Página de Detalle de Ingresos: Definir si se debe crear una página de detalle para las cuentas de income.

2. Backend y Seguridad


Cálculo de Inversiones: Calcular los valores de las cuentas de inversión, comparando el capital invertido con el balance real.

Autenticación de Usuarios: Implementar la autenticación de usuarios y verificar el userId antes de permitir el acceso a las funciones principales.

Cuenta Slack: Definir si se debe crear una cuenta slack para el balance al crear una cuenta bancaria con un monto inicial.

3. Frontend y UI/UX
Manejo de Errores: Mejorar los mensajes de error para que sean más claros para el usuario.

Cálculo de % Profit: Corregir el cálculo que muestra NaN.

Validación de Fechas: Bloquear fechas futuras en el selector de fechas para las transacciones y la creación de pockets.

Error de Monto Inicial: Revisar el error del monto inicial de la cuenta cuando no hay transacciones.

Formularios: Implementar el reseteo de los mensajes de toast y la limpieza de variables después de enviar un formulario.

Indicador de Carga: Agregar un indicador de loading en los formularios.

Descripción de Transacciones: Estandarizar y mejorar las descripciones de las transacciones.

✅ Actividades Resueltas (LISTO)
New Pocket deberia validar como requerido el Target Amount. listo

Error en Income Tracker: Corregir el error que impide encontrar las cuentas de origen o destino.listo

Validar números y valores en los trackers. listo.

Hacer validación en tiempo real para dropdowns. listo.

Corregir la lógica de lend y borrow y ordenar los movimientos por fecha. listo.

Completar el cálculo del net worth. listo.

Usar toastify para mensajes al usuario. listo.

Implementar la lista de categorías. listo.

Crear endpoints y controladores en el backend. listo.

Implementar rutas y componentes del frontend. listo.

Ajustar la base de datos para zonas horarias y queries. listo.

Incluir PnL en el fintrack. listo.

Corregir el frontend de PnL. listo.

Mostrar balances de cuentas en los dropdowns. listo.

Implementar refetch para actualizar balances. listo.

Corregir bugs al crear cuentas. listo.

Implementar páginas de detalle de cuentas. listo.

Incluir depósitos y retiros en el PnL tracker. listo.

Corregir la validación para que no se borren datos. listo.

Arreglar errores de descripción de transacciones. listo.

Ajustar la lógica de debts para usar solo cuentas bancarias. listo.

Asegurar la consistencia del signo en el monto inicial. listo.

Corregir el problema de updated_at. listo.

Aplicar debounce a los textareas. listo.

Deshabilitar el botón de guardar durante la carga. listo.

Corregir mensajes de error y summary de valores cero. listo.

Solucionar el error de transferencia entre cuentas. listo.

Ajustar endpoints y manejo de tipos en overview. listo.

Incluir movimientos de inversiones en el overview. listo.

Revisar el cálculo del monthly avg saving. listo.

Corregir la funcionalidad borrow en la creación de deudas. listo.

Arreglar la restricción de fondos. listo.

Corregir que los expenses no se reflejaban en los resúmenes. listo.

Estandarizar los estilos. listo.

Minimizar los console.log del backend. listo.

Añadir el placeholder "no opción" en los selectores. listo.


pero en ingles , enumera tiambien los tareas listas



🚧 Pending Issues and Unresolved Queries
1. Functionality and Business Logic
Net Worth Calculation: Clarify with the client the definition of Net Worth and whether its calculation should include assets (bank, investments) and liabilities (debts).

Pocket Savings Management: Define whether Pocket Savings amounts are separate accounts or distributed among other accounts.

Category Structure: Implement a new structure to handle categories and subcategories.

Editing and Deleting: Establish a strategy for editing and deleting data, defining which fields are editable and how to handle their interrelationships in the database.

Data Export: Enable the export of movements in formats like PDF, Excel, and .csv.

Investment Balance: Clarify the calculation for the total investment balance.

Income Detail Page: Define if a detail page should be created for income accounts.

2. Backend and Security
Income Tracker Error: Correct the error that prevents the income tracker from finding source or destination accounts.

Investment Calculation: Calculate the values of investment accounts, comparing invested capital with the factual balance.

User Authentication: Implement user authentication and verify the userId before allowing access to the main functions.

Slack Account: Define if a slack account should be created for balance when a bank account is created with an initial amount.

3. Frontend and UI/UX
Error Handling: Improve error messages to be clearer to the user.

% Profit Calculation: Fix the calculation that displays NaN.

Date Validation: Block future dates in the date selector for transactions and pocket creation.

Starting Amount Error: Review the account starting amount error when there are no transactions.

Forms: Implement the resetting of toast messages and clearing of variables after form submission.

Loading Indicator: Add a loading indicator to forms.

Transaction Descriptions: Standardize and improve transaction descriptions.

✅ Resolved Activities (LISTO)
Validate numbers and values in the trackers. listo.

Perform real-time validation for dropdowns. listo.

Correct the lend and borrow logic and order movements by date. listo.

Complete the net worth calculation. listo.

Use toastify for user messages. listo.

Implement the category list. listo.

Create backend endpoints and controllers. listo.

Implement frontend routes and components. listo.

Adjust the database for time zones and queries. listo.

Include PnL in the fintrack. listo.

Fix the PnL frontend. listo.

Display account balances in dropdowns. listo.

Implement refetch to update balances. listo.

Fix bugs when creating accounts. listo.

Implement account detail pages. listo.

Include deposits and withdrawals in the PnL tracker. listo.

Correct validation so data isn't erased. listo.

Fix transaction description errors. listo.

Adjust debt logic to use only bank accounts. listo.

Ensure sign consistency for the starting amount. listo.

Fix the updated_at issue. listo.

Apply debounce to textareas. listo.

Disable the save button during loading. listo.

Correct error messages and zero-value summaries. listo.

Fix the inter-account transfer error. listo.

Adjust endpoints and type handling in overview. listo.

Include investment movements in the overview. listo.

Review the monthly avg saving calculation. listo.

Fix the borrow functionality in debt creation. listo.

Fix fund restrictions. listo.

Fix expenses not reflecting in summaries. listo.

Standardize styles. listo.

Minimize backend console.logs. listo.

Add the "no option" placeholder to selectors. listo.

