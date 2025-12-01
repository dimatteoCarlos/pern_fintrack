PLAN INTEGRAL DE DESARROLLO: DELETE ACCOUNT
Este plan sigue una secuencia de desarrollo lógica, donde cada paso es verificable, y utiliza la arquitectura de Hard Delete en Cascada para Administradores y Soft Delete para Usuarios Estándar.

FASE 0: PRERREQUISITO DE BASE DE DATOS (INTEGRIDAD Y PRIVILEGIOS)
Objetivo: Permitir el Hard Delete para administradores y centralizar la lógica de Soft Delete en la aplicación.

#	Archivo	Tarea / Modificación	Propósito de la Prueba
0.1	Definición de Tablas (Ej. mainTables.js)	MODIFICACIÓN CRÍTICA: Cambiar la cláusula ON DELETE de RESTRICT a CASCADE en las Claves Foráneas de transactions que referencian a user_accounts (columnas account_id, source_account_id, destination_account_id) y a users (columna user_id).	Verificación en DB: Intentar un DELETE manual en una cuenta con transacciones. Debe eliminar la cuenta y las transacciones sin error de la base de datos.

Fase 1: Backend - Lógica de Servicio y Ruta (Seguridad y Decisión)
Objetivo: Crear el endpoint DELETE y el servicio que decide entre Hard o Soft Delete basándose en el rol (req.user.userRole).

#	Archivo / Componente	Tarea Específica	Prueba Incremental
1.1	backend/src/routes/accountRoutes.js (Nuevo)	Definir Ruta: Crear la ruta DELETE /account/:id usando el middleware verifyUser (o el que corresponda para asegurar que req.user esté poblado).	Usar Insomnia/Postman: Enviar DELETE y verificar que el middleware pasa y el controlador recibe req.user.userRole.
1.2	backend/src/controllers/accountController.js (Nuevo)	Implementar Controlador: Crear deleteAccountController. Debe extraer accountId (req.params.id) y userRole (req.user.userRole) y pasarlos al servicio.	Loguear los valores accountId y userRole antes de llamar al servicio.
1.3	backend/src/services/accountService.js (Nuevo)	LÓGICA DE DECISIÓN: Implementar deleteAccountService(accountId, userRole). 1. **`if (userRole === 'admin'	
1.4	backend/src/routes/index.js (Modificar)	Integrar accountRoutes con el router principal: router.use('/account', accountRoutes);.	Verificar que la ruta DELETE /api/account/:id sea accesible.

Fase 2: Frontend - UI, Conexión y Flujo
Objetivo: Crear el frontend con la navegación, la confirmación y la actualización del estado global.

#	Archivo / Componente	Tarea Específica	Prueba Incremental
2.1	endpoints.ts (Modificar)	Definir URL: Agregar url_delete_account = '/api/account/:id'.	(Disponibilidad de la URL).
2.2	general_components/modals/ConfirmDeleteModal.tsx (Nuevo)	Crear Modal: Componente reutilizable de confirmación con mensajes de advertencia claros ("¡Acción irreversible!").	Verificar que el modal se muestra y el botón "Cancel" funciona.
2.3	useAccountStore.ts (Modificar)	Acción del Store: Asegurar que removeAccount(accountId) elimine la cuenta de la lista en el estado local.	(Verificación en DevTools del Store).
2.4	pages/forms/deleteAccount/DeleteAccount.tsx (Nueva Página)	Integración de Lógica: Crear la página que: 1. Usa useFetchLoad para ejecutar la mutación DELETE. 2. Llama a handleConfirmDelete. 3. Muestra el ConfirmDeleteModal.	Verificar en el navegador: La página carga y el hook isLoading se activa al presionar "Delete".
2.5	AccountActionsMenu.tsx (Modificar)	Navegación: Conectar el click en "Delete Account" para navegar a la nueva página: Maps('/forms/delete/' + accountId).	Probar la navegación desde el menú a la página de eliminación.
2.6	DeleteAccount.tsx (Cierre de Flujo)	Feedback Final: Si useFetchLoad tiene éxito, llamar a useAccountStore.removeAccount, mostrar el Toast de éxito (MessageToUser), y redirigir (useNavigate). Manejar el Toast de error en caso de fallo.	Probar la eliminación completa: La cuenta debe desaparecer de la lista, y se debe ver el Toast antes de la redirección.

3. 🚨 Modificaciones Requeridas en su Código Existente
Archivo	Modificación	Razón
backend/src/routes/userRoutes.js	Ninguna. El deleteAccount se creará en un nuevo archivo (accountRoutes.js) para mantener la separación de responsabilidades (SRP).	La gestión de cuentas debe estar separada de la gestión del perfil de usuario (obtener/actualizar nombre/contraseña).
backend/src/controllers/userController.js	Ninguna. Este archivo solo maneja profile (obtener, actualizar, cambiar contraseña).	No hay lógica de eliminación de cuentas aquí.
backend/src/middlewares/authMiddleware.js	Verificar (Implícito): Asegurarse de que verifyUser o verifyToken realmente adjunte el userRole a req.user. (Sus controllers ya lo leen, por lo que probablemente ya está implementado).	El backend necesita req.user.userRole para la decisión en el servicio.

