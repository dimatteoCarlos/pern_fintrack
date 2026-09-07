# Fintrack Backlog - Grupos Completos

> **Remedido el 2026-09-06 sobre la rama `main`, cabeza `20de666d`.** Los conteos
> de cada grupo salen de `issues-en.md` y coinciden elemento por elemento; el
> detalle largo en español está en `ISSUES-es-updated.md`.
>
> **Qué NO se remidió — no leerlo como medido:**
>
> - Los elementos que ya estaban en LISTO antes de esta pasada no se reauditaron
>   uno por uno. Tres resultaron falsos al verificar otra cosa y quedaron
>   corregidos; el resto conserva su estado anterior sin comprobar.
> - Nada se probó en un navegador: ningún formulario enviado, ninguna pantalla
>   redimensionada, ninguna sesión dejada expirar.
> - Ninguna base de datos fue leída, ni local ni remota, y la aplicación nunca se
>   levantó.
> - Nada se midió fuera de `main`. Los hallazgos que viven en otras ramas quedan
>   fuera de esta pasada.
> - `backend/src` y `frontend/src` se barrieron buscando marcas de trabajo
>   pendiente en los comentarios — `TODO`, `FIXME`, `HACK`, `XXX` — y **no hay
>   ninguna**: cero coincidencias en ambos árboles.
>
> El cerco de código que envolvía este archivo entero se retiró: era un bloque
> abierto que rompía el resaltado de todo el documento y anulaba las casillas.

**Total: 123 elementos — 77 LISTO, 46 PENDIENTE.**

---

## 🔐 Authentication

### ✅ LISTO (11/16)

- [x] Sign out redirects to Sign In instead of the main menu
- [x] Review cross-field validation between password, new password, and confirm password
- [x] Review responsiveness of authentication forms: Sign In, Sign Up, Update User Data, Change Password
- [x] Review real-time validation in Sign Up for password and confirmPassword fields
- [x] Complete authentication with refresh token support
- [x] Validate the target amount when creating a pocket account
- [x] Verify refresh token authentication and automatic refresh logic
- [x] Review UX/UI of authentication forms
- [x] Review navigation behavior in authentication flows
- [x] **NUEVO 2026-09-06** — la bandera de autenticación en memoria ya no se separa del token en almacenamiento: una sola función limpia ambos (`auth_utils/invalidateSession.ts:29-55`) y el arranque de sesión revalida contra el servidor (`auth/hooks/useAuth.ts:170-229`)
- [x] **NUEVO 2026-09-06** — un 401 ya termina la sesión y redirige: reintento único (`auth_utils/authFetch.ts:56-96`), invalidación al fallar el refresco (`auth_utils/authRefreshManager.ts:59-69`) y redirección en el guardia de ruta (`components/protectedRoute/ProtectedRoute.tsx:40-53`)

### 🔄 PENDIENTE (5/16)

- [ ] Investigate why the session expires even when a refresh token exists — **mecanismo medido, síntoma no**: la cookie de refresco se escribe sin vida útil (`backend/src/utils/authUtils/cookieConfig.js:10-15`) y el token dentro vale 8.9 días (`authFn.js:95-98`). Falta comprobarlo en navegador
- [ ] Define how to keep the user signed in while the refresh token remains valid — bloqueado por la misma cookie sin vida útil y por una decisión de producto
- [ ] Define and apply an authorization roles scheme — **definido y nunca aplicado**: escalera de roles, guardia de administrador y fábrica de autorización existen (`backend/src/auth_api/middlewares/authMiddleware.js:228-294`) y ningún archivo de rutas los importa
- [ ] **NUEVO 2026-09-06** — un 403 no invalida la sesión: la rama de reintento sólo prueba el código 401 (`auth_utils/authFetch.ts:58`)
- [ ] Gestión de múltiples sesiones: del mismo usuario, de varios usuarios, y del mismo usuario en varios dispositivos — decisión de diseño nunca tomada

---

## ⚙️ Backend and Security

### ✅ LISTO (4/7)

- [x] Verify user authentication and userId access control before allowing main app functions
- [x] Adjust the backend so transaction searches prioritize account_id instead of account_name
- [x] Minimize backend console.logs
- [x] **NUEVO 2026-09-06** — estrategia multimoneda: una sola moneda contable almacenada y seis aceptadas en el borde, declaradas en el servidor (`fx_services/core/fxConfig.js:40`) y espejadas en el cliente (`helpers/currencyConstants.ts:22-29`)

### 🔄 PENDIENTE (3/7)

- [ ] Organize cookie and token duration rules — el ayudante de cookie no fija vida útil alguna (`utils/authUtils/cookieConfig.js:8-23`) y las duraciones viven en cuatro sitios con comentarios que contradicen sus valores (`authFn.js:59-62`, `:95-98`, `authController.js:192`, `:335`, `authRefreshToken.js:112`)
- [ ] Review how numeric amounts are stored and why some values are returned as strings — **no hay ningún analizador de tipos registrado en `backend/src`**, así que rige el predeterminado del controlador. Falta leer la base de datos
- [ ] Review the timestamp offset issue in transfer-between-accounts transactions — falta leer una fila almacenada y compararla con el momento real

---

## 🔧 General

### ✅ LISTO (2/4)

- [x] Verify dynamically unused or broken components — hecho con `npx knip` para el frontend
- [x] Adaptar el backend a ejecución sin servidor y desplegarlo — la construcción está declarada en `backend/vercel.json`

### 🔄 PENDIENTE (2/4)

- [ ] Estabilidad del backend desplegado — sólo medible en producción
- [ ] Una herramienta de análisis de componentes que cubra el backend — no hay archivo de configuración de `knip` ni la dependencia en ningún `package.json`

---

## 💸 Transfer

### ✅ LISTO (6/7)

- [x] Review responsiveness in Transfer when adding a line in To:, especially under 450 px width
- [x] Make Transfer responsive without scroll for a 360 x 700 px layout
- [x] Correct the media query styles for To: and reduce the font size of From and To labels
- [x] Review the full transfer flow
- [x] Fix the inter-account transfer error
- [x] **NUEVO 2026-09-06** — desplazamiento interno de la tarjeta bajo 700 px de alto: altura máxima derivada del viewport y desbordamiento vertical propio (`pages/tracker/styles/tracker-style.css:728-741`)

### 🔄 PENDIENTE (1/7)

- [ ] Adjust tracker navbar container height to support a 320 px minimum width — la consulta más estrecha del archivo es de 370 px y sólo reduce el tamaño de fuente de una etiqueta (`tracker-style.css:631-635`)

---

## 📊 Pocket Detail and Category Budget Detail

### ✅ LISTO (2/2)

- [x] Review pocket detail for accounting view detail and budget pocket, where pocket saving data was not rendering
- [x] Fix category detail so it receives the correct data structure from the server

### 🔄 PENDIENTE (0/2)

Ninguno.

---

## ✏️ Editing and Deleting

### ✅ LISTO (9/10)

- [x] Establish a strategy for editing and deleting data
- [x] Define which fields are editable and their database interrelationships
- [x] Implement reverse transfers for expense and income accounts to support manual corrections
- [x] Implement simple editing of account data only, not transactions
- [x] Develop centralized account detail views and account editing in the Accounting Dashboard
- [x] Apply real-time validation to all editable fields, including text areas and numeric inputs
- [x] Limit input length visually and functionally across all edit forms
- [x] Develop account deletion
- [x] Implement retrospective total annulment as the deletion strategy for accounts and transactions

### 🔄 PENDIENTE (1/10)

- [ ] Optimizar la página de borrado de cuenta con un reductor en vez de un estado de modal memoizado — confirmado abierto por ausencia: `useReducer` no aparece en ningún archivo de `frontend/src`

---

## 🧾 Account editor register

> **De dónde salen.** Los once se midieron el 2026-08-20 y vivían sólo en
> `plan-docs/on-hold/PLAN_EDIT_BLOCK/PLAN_EditAccount.md`, sección "U4 — el
> registro". **Git no rastrea ese archivo** — `plan-docs/*` está ignorado — así
> que borrar la carpeta destruía la única copia. Se incorporan aquí y se
> remidieron el 2026-09-06 con las líneas de hoy. Sus etiquetas internas (E-1 …
> E-11) se conservan sólo como referencia hacia atrás a ese documento.

### ✅ LISTO (3/11)

- [x] **Un bolsillo con fecha objetivo vencida ya no queda bloqueado (E-2)** — 🔴 Alta. El bolsillo salió de este editor: el mapa de tipos no tiene su clave (`validations_zod/editSchemas.ts:64-70`) y el cargador lo deja escrito (`pages/editionAccount/EditAccount.tsx:252-254`). Su pantalla propia envía sólo lo que cambió, para no revalidar un plazo intacto (`pages/forms/editPocket/EditPocket.tsx:249-253`). **Resto abierto:** el campo de plazo sigue acotado a hoy (`EditPocket.tsx:521`)
- [x] **La vista previa del nombre de un deudor ya coincide con lo que guarda el servidor (E-3)** — el cliente une apellido y nombre con coma y espacio (`validations_zod/accountEditSchema.ts:175-187`), igual que el servidor (`accountEditController.js:219`)
- [x] **La rama de presupuesto del endpoint de edición ya no existe (E-9)** — el endpoint declara por escrito que ignora esa clave porque el monto es decisión de cuatro partes del endpoint de presupuesto (`accountEditController.js:104-107`)

### 🔄 PENDIENTE (8/11)

- [ ] **🔴 Alta — Una columna nula deja la cuenta entera sin poder editarse (E-1).** El cargador copia todo lo que no sea `undefined`, así que un `NULL` llega como `null` (`pages/editionAccount/EditAccount.tsx:251`); los esquemas aceptan sólo `undefined` (`validations_zod/commonEditionSchemas.ts:118-123`) y un solo error aborta el envío completo (`EditAccount.tsx:325-334`). Columnas vivas que alcanza: `subcategory` (`002_accounts.sql:150`), `debtor_name` y `debtor_lastname` (`:176-177`)
- [ ] **🟡 Media — El monto adeudado de un deudor no se edita en ningún sitio (E-4).** La columna existe (`002_accounts.sql:170`) y la rama de escritura fija sólo nombre, apellido y nota (`accountEditController.js:187-191`). Decisión pendiente: ¿pertenece a este editor o sólo a una transacción?
- [ ] **🟡 Media — Editar la meta de un bolsillo deja obsoletos sus metadatos de cambio (E-5).** El endpoint escribe la meta y no toca ninguna de las seis columnas de cambio que la acompañan (`accountEditController.js:91-92`)
- [ ] **🟢 Baja — La bandera de campo obligatorio no valida nada y contradice a los esquemas (E-6).** Su único consumidor es el asterisco de la etiqueta (`pages/editionAccount/UniversalDynamicInput.tsx:256`, desplazado desde 242)
- [ ] **🟢 Baja — Un campo muerto viaja en cada guardado (E-7).** El tipo de cuenta se añade al payload con un comentario que dice que el controlador lo necesita (`EditAccount.tsx:341-344`); el controlador nunca lo lee
- [ ] **🟢 Baja — La nota de un bolsillo vive en dos tablas y una tapa a la otra (E-8).** El endpoint la escribe en la fila compartida (`accountEditController.js:59`) y otra vez en la propia del bolsillo (`:97`)
- [ ] **🟡 Media — Los topes de longitud del frontend son más estrechos que las columnas, y uno tiene un carácter de margen (E-10).** Nombre de cuenta acotado a 28 (`validations/utils/constants.ts:4-13`) contra una columna de 50; el peor caso derivado hoy es 27
- [ ] **🟡 Media — Tres tipos de cuenta no reciben moneda del endpoint de lectura (E-11).** Banco, inversión y fuente de ingreso tienen superficie editable vacía por diseño (`accountEditController.js:309-313`), pero el join de moneda está comentado para ellos, así que cualquier vista que lea la moneda de una cuenta bancaria ahí obtiene `undefined`

> **Hallazgo estructural al lado de los once:** el endpoint de escritura de cuenta
> no lleva middleware de validación (`backend/src/fintrack_api/routes/accountRoutes.js:104`),
> así que el esquema del frontend es la única puerta sobre ese payload.

---

## ⚖️ Logic and Business Rules

### ✅ LISTO (5/14)

- [x] Correct debt movement presentation in the overview so it appears in descending date and time order
- [x] Fix lend and borrow logic and order movements by date
- [x] Complete the net worth calculation
- [x] Review whether the monthly average saving calculation should include investment accounts
- [x] Block future dates in the date selector for transactions and pocket creation — el selector compartido acepta cota superior (`general_components/datepicker/Datepicker.tsx:103`), el disparador de transacción la pasa (`transactionDateTrigger/TransactionDateTrigger.tsx:31,111`) y el selector de mes se acota al mes actual (`monthPicker/MonthPicker.tsx:149,193`)

### 🔄 PENDIENTE (9/14)

- [ ] Correct the order of transactions so withdraw appears before received or deposit — decisión de diseño y después lectura de base de datos
- [ ] Define the net worth calculation with the client, including whether assets and liabilities are included — decisión del cliente
- [ ] Define whether Pocket Savings amounts are separate accounts or distributed among other accounts — decisión del cliente
- [ ] Implement a new structure for categories and subcategories — decisión de producto y después implementación
- [ ] Clarify the calculation of the total investment balance with the client — decisión del cliente
- [ ] Review the investment balance calculation using invested capital versus actual balance — decisión del cliente y después lectura de base de datos
- [ ] Establish business rules for date consistency across transactions and account creation — decisión de producto; existe una ventana de retrofecha en las constantes del frontend, pero ninguna regla impide una transacción anterior a su cuenta
- [ ] Review whether the initial account amount error still appears when there are no transactions — falta crear una cuenta sin transacciones y mirar la pantalla
- [ ] Fix the bug where an expense account name over 25 characters creates a blank category — falta enviar el nombre largo y leer la fila creada

---

## 🎨 Frontend and UI/UX

### ✅ LISTO (5/16)

- [x] Review why multiple identical toasts are rendered
- [x] Add the "no option" placeholder to selectors when no data is available
- [x] **NUEVO 2026-09-06** — colores del toast según el tipo de mensaje: un ayudante mapea el rango del estado de respuesta a tipo y color de fondo (`helpers/showToastByStatus.ts:10-15`)
- [x] **NUEVO 2026-09-06** — el porcentaje de ganancia ya no muestra un no-número: el divisor está guardado y por defecto vale cero (`pages/overview/components/InvestmentAccBalance.tsx:100-117`). **Resto:** la guarda compara estrictamente contra el número cero, así que si la API devuelve `'0.00'` como cadena la división da infinito
- [x] **NUEVO 2026-09-06** — límite de caracteres al crear una cuenta de categoría: las cuatro entradas de nombre llevan los topes compartidos (`pages/forms/newCategory/NewCategory.tsx:479,496,515,532`)

### 🔄 PENDIENTE (11/16)

- [ ] Improve error messages so they are clearer to the user, and standardize the handling so it is reusable
- [ ] Standardize and improve transaction descriptions — a gusto del usuario
- [ ] Reset toast messages and clear variables after form submission — falta comprobarlo formulario por formulario. El hook de mutación sí es sano: baja la bandera de carga en su `finally` y expone un reseteo que limpia datos, error y fallo juntos (`hooks/useFetchLoad.ts:137-151`)
- [ ] Add loading indicators to forms — falta comprobarlo formulario por formulario
- [ ] Adjust the detailed account page so the back arrow and edit menu are separated from the title — falta mirar la pantalla
- [ ] Review the validation and cleanup behavior of the new-account form fields — falta llenar el formulario, provocar un error y ver si el mensaje se limpia
- [ ] **NUEVO 2026-09-06** — ocho variables de diseño consumidas y definidas en ningún sitio: un par de color mal escrito dos veces (`pages/overview/styles/overview-styles.css:284-285`), un tamaño de fuente y una altura de línea en la barra principal (`general_components/mainNavbar/styles/mainNavbar.css:135-136`) y cuatro pasos de espaciado (`pages/styles/generalStyles.css:63,67,71,75`)
- [ ] **NUEVO 2026-09-06** — catorce bloques de regla declaran la misma propiedad dos veces, medidos sobre las 80 hojas de estilo de `frontend/src`; dos están en el mismo archivo, sobre el mismo selector, bajo dos consultas de altura idénticas (`pages/tracker/styles/tracker-style.css:728-741` y `:743-749`)
- [ ] **NUEVO 2026-09-06** — la consulta de esquema de color del sistema está invertida: el bloque se titula soporte de modo oscuro, pide `prefers-color-scheme: light` y lo llena de valores oscuros (`editionAndDeletion/pages/deletionAccount/UIComponents/accountDetailsUI/accountDetailsUI.css:163-190`)
- [ ] **NUEVO 2026-09-06** — cincuenta y nueve declaraciones llevan `!important` en las hojas de estilo del frontend, contra la regla que lo prohíbe
- [ ] **NUEVO 2026-09-06** — el ayudante de toast escribe cuatro literales de color en lugar de consumir variables (`helpers/showToastByStatus.ts:11-14`)

---

## 🌍 Locale and money formatting

### ✅ LISTO (0/4)

Ninguno.

### 🔄 PENDIENTE (4/4)

- [ ] **La moneda por defecto del formateador de dinero no se encuentra en el catálogo de monedas.** Está declarada en mayúsculas (`helpers/functions.ts:39`) y todas las claves del catálogo son minúsculas (`helpers/currencyConstants.ts:22-58`), así que leer el catálogo con ese valor devuelve indefinido y el formateador de números cae en silencio a la configuración regional del equipo. El silencio es el defecto: nada lanza y la cifra igual se imprime
- [ ] **Quince apariciones vivas de una etiqueta de configuración regional española en once archivos del frontend, con la interfaz en inglés.** El detalle sitio por sitio está en `plan-docs/ongoing/PLAN_FX_DISPLAY.md`, sección 2
- [ ] **Las dos constantes de formato de fecha no coinciden en qué idioma habla la interfaz** (`helpers/constants.ts:81-86`); la segunda lleva su razón escrita, la primera no
- [ ] **Un comentario apunta a un rango de líneas que ya no contiene lo que dice**: la nota de la tarjeta superior del tracker cita el archivo de constantes en las líneas 57 a 59 (`pages/tracker/components/TopCard.tsx:213`) y la constante que describe vive hoy en las líneas 83 a 86

---

## 📤 Data and Export

### ✅ LISTO (0/1)

Ninguno.

### 🔄 PENDIENTE (1/1)

- [ ] Enable export of movements to PDF, Excel, Google sheet and CSV — confirmado abierto por ausencia: no hay biblioteca de PDF, hoja de cálculo ni CSV en ningún `package.json` del repositorio

---

## 📈 Accounts and Overview

### ✅ LISTO (11/11)

- [x] List all accounts in Accounting, including income, expense, debtors, investment, bank, and pocket
- [x] Implement pages for account details
- [x] Show account balances in dropdowns
- [x] Implement refetch to update balances
- [x] Fix bugs when creating accounts
- [x] Include investment movements in the overview
- [x] Include deposits and withdrawals in the PnL tracker
- [x] Correct the issue where account details were not updating after transactions
- [x] Fix the issue where new debtor profiles did not refresh bank balances immediately
- [x] **NUEVO 2026-09-06 — el total comprometido de un bolsillo se contaba dos veces en el patrimonio neto del panel general. RESUELTO 2026-09-06, en dos commits y en ese orden.** El encabezado sumaba el saldo de bolsillo a banco, inversión y deuda para el patrimonio neto, y otra vez para la posición de caja, leyéndolo sobre el tipo de cuenta de bolsillo retirado. El saldo bancario ya contenía ese dinero: el techo de la guarda de asignación es saldo menos asignado, y eso sólo se sostiene si el comprometido está dentro del saldo (`pocket_services/services/pocketAllocationService.js:345-347`). **La lectura se borró, no se repuntó** (`f4b999d9`), y ese borrado era la guarda que hacía seguro el repunte: la doble suma valía cero sólo porque el tipo retirado no devolvía cuentas, y se habría encendido en el instante del repunte. Después se repuntó todo lo demás al modelo de plan (`f0388039`), incluido el widget de metas, que además no obedecía al mes
- [x] **NUEVO 2026-09-06 — las tres cifras del recuadro principal decidían si eran números mirando la variable equivocada. RESUELTO 2026-09-06 (`d75b4709`).** La fila de gastos comprobaba el total de ingresos, así que un gasto roto se imprimía como dinero real y un gasto válido se vaciaba cada vez que fallaba ingresos (`pages/overview/OverviewLayout.tsx:186-190`). Además, una cifra que no se pudo calcular se forzaba a cero: son el dinero del propio usuario, y un cero afirma que no tiene nada. Ahora viaja como nulo y `BigBoxResult` pinta una raya

### 🔄 PENDIENTE (0/11)

Ninguno.

---

## 📊 PnL Tracker

### ✅ LISTO (3/3)

- [x] Fix the PnL frontend
- [x] Include deposits and withdrawals in the PnL tracker
- [x] Correct the issue where the validation message appeared too early after reload

### 🔄 PENDIENTE (0/3)

Ninguno.

---

## 💰 Debts

### ✅ LISTO (4/4)

- [x] Adjust debt logic to use only bank accounts
- [x] Fix borrow functionality in debt creation
- [x] Refine debt tracker behavior for invalid amount correction and empty amount submission
- [x] Reflect debtors' first and last names with capitalized initials

### 🔄 PENDIENTE (0/4)

Ninguno.

---

## 🗂️ Categories

### ✅ LISTO (1/1)

- [x] Implement the category list

### 🔄 PENDIENTE (0/1)

Ninguno. La nueva estructura de categorías y subcategorías se cuenta una sola vez, en Logic and Business Rules.

---

## 🔔 Toasts and Notifications

### ✅ LISTO (1/1)

- [x] Use Toastify for user messages

### 🔄 PENDIENTE (0/1)

Ninguno. El reseteo de toasts tras enviar un formulario se cuenta una sola vez, en Frontend and UI/UX.

---

## 🕒 Database and Time

### ✅ LISTO (2/2)

- [x] Adjust the database for time zones and queries
- [x] Fix the updated_at issue

### 🔄 PENDIENTE (0/2)

Ninguno. La regla de transacciones con fecha futura se cuenta una sola vez, en Logic and Business Rules.

---

## 🏁 Resolved by Design Decision

### ✅ LISTO (10/10)

- [x] Implement PnL in Fintrack
- [x] Fix expenses not being reflected in summaries
- [x] Standardize styles
- [x] Fix fund restrictions
- [x] Ensure sign consistency for the starting amount
- [x] Correct error messages and zero-value summaries
- [x] Apply debounce to textareas
- [x] Disable the save button during loading
- [x] Minimize backend console.logs
- [x] Add the "no option" placeholder to selectors

### 🔄 PENDIENTE (0/10)

Ninguno.

---

## Recuento por grupo

| grupo | total | LISTO | PENDIENTE |
| :--- | ---: | ---: | ---: |
| Authentication | 16 | 11 | 5 |
| Backend and Security | 7 | 4 | 3 |
| General | 4 | 2 | 2 |
| Transfer | 7 | 6 | 1 |
| Pocket Detail and Category Budget Detail | 2 | 2 | 0 |
| Editing and Deleting | 10 | 9 | 1 |
| Account editor register | 11 | 3 | 8 |
| Logic and Business Rules | 14 | 5 | 9 |
| Frontend and UI/UX | 16 | 5 | 11 |
| Locale and money formatting | 4 | 0 | 4 |
| Data and Export | 1 | 0 | 1 |
| Accounts and Overview | 10 | 9 | 1 |
| PnL Tracker | 3 | 3 | 0 |
| Debts | 4 | 4 | 0 |
| Categories | 1 | 1 | 0 |
| Toasts and Notifications | 1 | 1 | 0 |
| Database and Time | 2 | 2 | 0 |
| Resolved by Design Decision | 10 | 10 | 0 |
| **TOTAL** | **123** | **77** | **46** |
