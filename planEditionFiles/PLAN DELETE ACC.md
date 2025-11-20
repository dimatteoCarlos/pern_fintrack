🎯 OBJETIVO PRINCIPAL
Implementar un sistema de eliminación segura de cuentas con confirmación del usuario, soft delete en backend y sincronización automática del estado global.

🔄 WORKFLOW LÓGICO
Flujo de Usuario:
text
1. Usuario hace clic "Delete Account" → 2. Modal de confirmación → 
3. Usuario confirma "Delete" → 4. Soft delete en backend → 
5. Archivado transacciones → 6. Actualización store global → 
7. Feedback éxito → 8. Redirección a lista
Flujo Técnico:
text
Frontend (DELETE request) → Backend (Validación → Transacción → Soft Delete) → 
Frontend (Actualizar store → Mostrar feedback → Redirección)
🏗️ ARQUITECTURA
Frontend:
text
AccountActionsMenu.tsx (Trigger)
    ↓
ConfirmDeleteModal.tsx (UI Confirmación)
    ↓
useFetchLoad (DELETE request) → useAccountStore (removeAccount)
    ↓
MessageToUser (Feedback) → navigate (Redirección)
Backend:
text
DELETE /accounts/:accountId (Route)
    ↓
AccountController.deleteAccount (Validación básica)
    ↓
AccountService.deleteAccount (Lógica transaccional)
    ↓
Database (UPDATE accounts SET status = 'deleted')
    ↓
Database (UPDATE transactions SET is_active = false)
📋 PLAN DE DESARROLLO - SECUENCIA PROBABLE
FASE 1: 🎯 BACKEND - ENDPOINT DELETE (Día 1)
1.1 Service Logic
text
✅ ACTIVIDAD: Crear método deleteAccount en AccountService
📍 ARCHIVOS: 
   - backend/src/services/AccountService.js
🎯 CÓDIGO EJEMPLO:
   deleteAccount(accountId) {
     console.log('🔵 Service: Starting deletion for account:', accountId);
     // Lógica transaccional aquí
   }
🎯 PRUEBA: 
   - Llamar método manualmente desde test
   - Ver log en consola backend
1.2 Transactional Logic & Soft Delete
text
✅ ACTIVIDAD: Implementar transacción con soft delete
📍 ARCHIVOS: 
   - backend/src/services/AccountService.js
🎯 CÓDIGO EJEMPLO:
   BEGIN TRANSACTION;
   UPDATE accounts SET status = 'deleted' WHERE id = $1;
   UPDATE transactions SET is_active = false WHERE account_id = $1;
   COMMIT;
🎯 PRUEBA: 
   - Verificar UPDATE en base de datos
   - Console.log: "Soft deleted account X, archived Y transactions"
1.3 Controller & Routing
text
✅ ACTIVIDAD: Crear controller y conectar ruta
📍 ARCHIVOS:
   - backend/src/controllers/AccountController.js
   - backend/src/routes/accountRoutes.js
🎯 PRUEBA CON POSTMAN:
   - DELETE http://localhost:5000/api/accounts/123
   - Verificar response 204/200
   - Ver logs en consola backend
FASE 2: 🎯 FRONTEND - ESTRUCTURA BÁSICA (Día 2)
2.1 AccountActionsMenu - Trigger
text
✅ ACTIVIDAD: Crear menú con botón Delete
📍 ARCHIVOS:
   - frontend/src/components/AccountActionsMenu.tsx
🎯 PRUEBA:
   - Renderizar componente
   - Hacer clic "Delete" → console.log('Delete clicked')
2.2 ConfirmDeleteModal - UI Confirmación
text
✅ ACTIVIDAD: Modal reutilizable para confirmación
📍 ARCHIVOS:
   - frontend/src/components/ConfirmDeleteModal.tsx
🎯 PRUEBA:
   - Abrir/cerrar modal
   - Ver mensaje de advertencia
   - Console.log en botones Cancel/Delete
2.3 Hook Integration
text
✅ ACTIVIDAD: Configurar useFetchLoad para DELETE
📍 ARCHIVOS:
   - AccountActionsMenu.tsx o componente padre
🎯 CÓDIGO:
   const { isLoading, error, requestFn } = useFetchLoad({
     url: `/api/accounts/${accountId}`,
     method: 'DELETE'
   });
🎯 PRUEBA:
   - Console.log: "useFetchLoad configured for DELETE"
FASE 3: 🎯 FRONTEND - LÓGICA DE ELIMINACIÓN (Día 3)
3.1 Handler Function
text
✅ ACTIVIDAD: Función handleDeleteAccount
📍 ARCHIVOS:
   - AccountActionsMenu.tsx
🎯 CÓDIGO:
   const handleDeleteAccount = async () => {
     console.log('🟡 Delete handler triggered for:', accountId);
     const result = await requestFn();
     console.log('🟢 Delete result:', result);
   };
🎯 PRUEBA:
   - Hacer clic Delete → ver logs en consola frontend
   - Network tab: ver request DELETE
3.2 Store Integration
text
✅ ACTIVIDAD: Actualizar store global después del éxito
📍 ARCHIVOS:
   - AccountActionsMenu.tsx
🎯 CÓDIGO:
   if (result.data) {
     useAccountStore.getState().removeAccount(accountId);
     console.log('🔵 Account removed from global store');
   }
🎯 PRUEBA:
   - Verificar store actualizado (Redux DevTools)
   - Console.log confirmación
FASE 4: 🎯 UX Y FEEDBACK (Día 4)
4.1 Loading States
text
✅ ACTIVIDAD: Estados de carga durante eliminación
📍 ARCHIVOS:
   - ConfirmDeleteModal.tsx
🎯 PRUEBA:
   - Ver spinner/botón deshabilitado durante DELETE
   - Console.log: "Loading state:", isLoading
4.2 Success Feedback & Redirection
text
✅ ACTIVIDAD: Mensaje éxito y redirección
📍 ARCHIVOS:
   - AccountActionsMenu.tsx
🎯 CÓDIGO:
   if (result.data) {
     setUserMessage({ message: 'Account deleted successfully', status: 200 });
     setTimeout(() => navigate('/accounts'), 1500);
   }
🎯 PRUEBA:
   - Ver Toast de éxito
   - Redirección automática después de 1.5s
4.3 Error Handling
text
✅ ACTIVIDAD: Manejo de errores del backend
📍 ARCHIVOS:
   - AccountActionsMenu.tsx
🎯 PRUEBA:
   - Simular error backend → ver mensaje error en modal
   - Console.log: "Error response:", error
🔧 PUNTOS DE DEBUGGEO CRÍTICOS
Frontend Console Logs:
javascript
// AccountActionsMenu.tsx
console.log('🔵 Delete button clicked');
console.log('🟡 DELETE request sent, accountId:', accountId);
console.log('🟢 DELETE success, response:', result);
console.log('🔴 DELETE error:', error);
console.log('🟣 Account removed from store');

// ConfirmDeleteModal.tsx  
console.log('⚪ Modal opened/closed:', isOpen);
Backend Console Logs:
javascript
// AccountController.js
console.log('🔵 DELETE request received for account:', accountId);

// AccountService.js
console.log('🟡 Starting transaction for account deletion:', accountId);
console.log('🟢 Accounts soft deleted:', accountsResult.rowCount);
console.log('🟢 Transactions archived:', transactionsResult.rowCount);
console.log('✅ Transaction committed successfully');
Network Tab Verification:
DELETE /api/accounts/:id → Status 200/204

Request Headers → Authorization, Content-Type

Response → Empty body or success message

🎯 CRITERIOS DE ÉXITO POR FASE
Fase 1 (Backend):
✅ DELETE endpoint responde 200/204

✅ Soft delete funciona en base de datos

✅ Transacciones se archivan correctamente

Fase 2 (Frontend Estructura):
✅ Modal se abre/cierra correctamente

✅ useFetchLoad configurado para DELETE

✅ Console logs funcionando

Fase 3 (Lógica Eliminación):
✅ Request DELETE se envía correctamente

✅ Store global se actualiza después del éxito

✅ Errores se manejan apropiadamente

Fase 4 (UX Final):
✅ Loading states visibles

✅ Feedback de éxito/error claro

✅ Redirección automática funciona

✅ Usuario no puede eliminar accidentalmente

⚠️ CONSIDERACIONES DE SEGURIDAD
Validaciones Backend:
Usuario solo puede eliminar sus propias cuentas

Verificar que accountId pertenece al userId autenticado

Validar que la cuenta existe antes de intentar eliminarla

Protecciones Frontend:
Doble confirmación (modal)

Estados de loading previenen doble submit

Feedback inmediato de éxito/error

Esta secuencia permite desarrollo incremental con puntos de verificación claros en cada etapa.

