```markdown
# 📋 TODOS LOS INDICADORES DE ESTADO EN EL SISTEMA DE AUTENTICACIÓN

---

# 🗃️ 1. BACKEND – BASE DE DATOS

## Tabla: `users`

| Columna         | Tipo de Dato | Valores Posibles | Descripción                     |
| --------------- | ------------ | ---------------- | ------------------------------- |
| user_id         | UUID         | UUID v4          | Identificador único del usuario |
| username        | VARCHAR(50)  | Texto único      | Nombre de usuario para login    |
| email           | VARCHAR(100) | Email único      | Correo electrónico              |
| password_hashed | VARCHAR(255) | Hash bcrypt      | Contraseña segura               |
| user_firstname  | VARCHAR(50)  | Texto            | Nombre                          |
| user_lastname   | VARCHAR(50)  | Texto            | Apellido                        |
| user_contact    | VARCHAR(50)  | Texto o NULL     | Información de contacto         |
| currency_id     | INTEGER      | ID de moneda     | Moneda preferida                |
| user_role_id    | INTEGER      | ID de rol        | Rol del usuario                 |
| created_at      | TIMESTAMP    | Fecha/hora       | Fecha de creación               |
| updated_at      | TIMESTAMP    | Fecha/hora       | Última actualización            |

---

## Tabla: `currencies`

| Columna       | Tipo de Dato | Valores Posibles    | Descripción             |
| ------------- | ------------ | ------------------- | ----------------------- |
| currency_id   | INTEGER      | ID                  | Identificador de moneda |
| currency_code | VARCHAR(3)   | 'usd', 'eur', 'cop' | Código de moneda        |
| currency_name | VARCHAR(50)  | Texto               | Nombre de la moneda     |

---

## Tabla: `user_roles`

| Columna        | Tipo de Dato | Valores Posibles               | Descripción          |
| -------------- | ------------ | ------------------------------ | -------------------- |
| user_role_id   | INTEGER      | ID                             | Identificador de rol |
| user_role_name | VARCHAR(20)  | 'user', 'admin', 'super_admin' | Nombre del rol       |

---

## Tabla: `refresh_tokens`

| Columna         | Tipo de Dato | Valores Posibles | Descripción                  |
| --------------- | ------------ | ---------------- | ---------------------------- |
| token_id        | INTEGER      | ID               | Identificador del token      |
| user_id         | UUID         | UUID             | Usuario asociado             |
| token           | TEXT         | JWT string       | Token de refresh             |
| expiration_date | TIMESTAMP    | Fecha/hora       | Expiración del refresh token |
| revoked         | BOOLEAN      | true / false     | Si el token fue revocado     |
| user_agent      | TEXT         | String           | User agent del cliente       |
| ip_address      | INET         | IP               | Dirección IP                 |

---

# 📡 2. BACKEND – RESPUESTAS HTTP (ENDPOINTS)

## POST `/sign-in`

| Código HTTP | Campo               | Valores Posibles     | Descripción              |
| ----------- | ------------------- | -------------------- | ------------------------ |
| 200         | message             | "Login successful"   | Mensaje de éxito         |
| 200         | accessToken         | JWT string           | Token de acceso          |
| 200         | user.user_id        | UUID                 | ID del usuario           |
| 200         | user.username       | String               | Nombre de usuario        |
| 200         | user.email          | Email                | Correo electrónico       |
| 200         | user.user_firstname | String               | Nombre                   |
| 200         | user.user_lastname  | String               | Apellido                 |
| 200         | user.user_contact   | String o null        | Contacto                 |
| 200         | user.user_role_name | String               | Rol                      |
| 200         | user.currency       | 'usd', 'eur', 'cop'  | Moneda                   |
| 200         | expiresIn           | Number               | Segundos de expiración   |
| 400         | success             | false                | Indicador de error       |
| 400         | error               | "ValidationError"    | Tipo de error            |
| 400         | message             | String               | Mensaje descriptivo      |
| 400         | fieldErrors         | Object               | Errores por campo        |
| 401         | success             | false                | Indicador de error       |
| 401         | error               | "InvalidCredentials" | Tipo de error            |
| 401         | message             | "Invalid password"   | Mensaje                  |
| 429         | success             | false                | Indicador de error       |
| 429         | error               | "RateLimitExceeded"  | Tipo de error            |
| 429         | message             | String               | Mensaje                  |
| 429         | retryAfter          | Number               | Segundos para reintentar |

---

## POST `/sign-up`

| Código HTTP | Campo       | Valores Posibles  | Descripción            |
| ----------- | ----------- | ----------------- | ---------------------- |
| 201         | message     | String            | Mensaje de éxito       |
| 201         | accessToken | JWT (opcional)    | Token de acceso        |
| 201         | user        | Object            | Datos del usuario      |
| 201         | expiresIn   | Number (opcional) | Segundos de expiración |

---

## POST `/sign-out`

| Código HTTP | Campo   | Valores Posibles          | Descripción      |
| ----------- | ------- | ------------------------- | ---------------- |
| 200         | message | "Logged out successfully" | Mensaje de éxito |

---

## GET `/validate-session`

| Código HTTP | Campo   | Valores Posibles | Descripción       |
| ----------- | ------- | ---------------- | ----------------- |
| 200         | message | String           | Mensaje           |
| 200         | user    | Object           | Datos del usuario |

---

## PATCH `/update-profile`

| Código HTTP | Campo       | Valores Posibles  | Descripción        |
| ----------- | ----------- | ----------------- | ------------------ |
| 200         | success     | true              | Indicador de éxito |
| 200         | message     | String            | Mensaje            |
| 200         | user        | Object            | Datos actualizados |
| 400         | success     | false             | Indicador de error |
| 400         | error       | "ValidationError" | Tipo de error      |
| 400         | message     | String            | Mensaje            |
| 400         | fieldErrors | Object            | Errores por campo  |

---

## PATCH `/change-password`

| Código HTTP | Campo       | Valores Posibles         | Descripción        |
| ----------- | ----------- | ------------------------ | ------------------ |
| 200         | success     | true                     | Indicador de éxito |
| 200         | message     | String                   | Mensaje            |
| 403         | success     | false                    | Indicador de error |
| 403         | error       | "InvalidCurrentPassword" | Tipo de error      |
| 403         | message     | String                   | Mensaje            |
| 403         | fieldErrors | Object                   | Errores por campo  |

---

# 🏪 3. FRONTEND – ZUSTAND STORES

## 3.1 useAuthStore – Estado de Sesión

| Indicador               | Tipo          | Valores Posibles               | Inicial | Descripción                    |
| ----------------------- | ------------- | ------------------------------ | ------- | ------------------------------ |
| isAuthenticated         | boolean       | true / false                   | false   | Usuario tiene sesión activa    |
| userData                | object / null | UserDataType o null            | null    | Datos completos del usuario    |
| userData.user_id        | string        | UUID                           | -       | ID del usuario                 |
| userData.username       | string        | Texto                          | -       | Nombre de usuario              |
| userData.email          | string        | Email                          | -       | Correo electrónico             |
| userData.user_firstname | string        | Texto                          | -       | Nombre                         |
| userData.user_lastname  | string        | Texto                          | -       | Apellido                       |
| userData.currency       | string        | 'usd', 'eur', 'cop'            | 'usd'   | Moneda preferida               |
| userData.role           | string        | 'user', 'admin', 'super_admin' | 'user'  | Rol del usuario                |
| userData.contact        | string / null | Texto o null                   | null    | Información de contacto        |
| isCheckingAuth          | boolean       | true / false                   | true    | Verificación inicial de sesión |
| isLoading               | boolean       | true / false                   | false   | Operación de auth en curso     |
| error                   | string / null | Mensaje o null                 | null    | Error global                   |
| successMessage          | string        | Mensaje o vacío                | ''      | Mensaje de éxito               |

---

## 3.2 useAuthUIStore – Estado UI (ACTUALIZADO)

| Indicador         | Tipo          | Valores Posibles               | Inicial | Descripción                    |
| ----------------- | ------------- | ------------------------------ | ------- | ------------------------------ |
| uiState           | enum          | 'IDLE', 'SIGN_IN', 'SIGN_UP'   | 'IDLE'  | Estado actual de la UI         |
| message           | string / null | Texto o null                   | null    | Mensaje global (ej. sesión expirada) |
| prefilledEmail    | string / null | Email o null                   | null    | Email pre-rellenado            |
| prefilledUsername | string / null | Username o null                | null    | Username pre-rellenado         |

**Nota:** Los estados `REMEMBERED_VISITOR`, `SESSION_EXPIRED` y `PASSWORD_CHANGED` han sido eliminados. El prefill y los mensajes especiales ahora se manejan a través de `prefilledEmail/prefilledUsername` y `message` respectivamente.

---

# 💾 4. FRONTEND – ALMACENAMIENTO

## 4.1 localStorage

| Clave                    | Tipo          | Valores Posibles                       | Persistencia | Descripción      |
| ------------------------ | ------------- | -------------------------------------- | ------------ | ---------------- |
| auth_identity            | object / null | { email, username, rememberMe } o null | Sí           | Datos recordados |
| auth_identity.email      | string        | Email                                  | Sí           | Email            |
| auth_identity.username   | string        | Texto                                  | Sí           | Username         |
| auth_identity.rememberMe | boolean       | true / false                           | Sí           | Recordar usuario |

---

## 4.2 sessionStorage

| Clave       | Tipo          | Valores Posibles | Persistencia | Descripción  |
| ----------- | ------------- | ---------------- | ------------ | ------------ |
| accessToken | string / null | JWT o null       | Sesión       | Token actual |
| tokenExpiry | number / null | Timestamp o null | Sesión       | Expiración   |

---

# 🧭 5. FRONTEND – REACT ROUTER (SISTEMA DE EVENTOS)

## Estado de Navegación (location.state)

| Campo        | Tipo                | Valores Posibles                                    | Descripción                                |
| ------------ | ------------------- | --------------------------------------------------- | ------------------------------------------ |
| authEvent    | string              | 'password_changed', 'session_expired', 'user_logged_out' | Evento de autenticación                    |
| from         | string / undefined  | Ruta de origen                                      | Ruta original (para session_expired)       |
| email        | string / undefined  | Email                                               | Para eventos futuros                       |
| username     | string / undefined  | Username                                            | Para eventos futuros                       |

**Nota:** Los campos `hasIdentity`, `prefilledEmail`, `prefilledUsername` han sido eliminados del estado de navegación. El prefill ahora se maneja mediante `getIdentity()` directamente en los handlers.

---

# 📐 6. INDICADORES DERIVADOS

| Indicador           | Dónde se calcula        | Cálculo                                       | Valores      | Descripción                    |
| ------------------- | ----------------------- | --------------------------------------------- | ------------ | ------------------------------ |
| showModal           | AuthPage.tsx            | uiState !== 'IDLE'                            | true / false | Modal visible                  |
| returnTo            | AuthPage.tsx (ref)      | Almacenado durante `session_expired`          | string / null | Ruta original antes de expirar |
| isDirty             | UpdateProfileContainer  | formData !== initialData                      | true / false | Cambios sin guardar            |
| isSubmittingAllowed | Form hooks              | allTouched && !hasErrors && !isSubmitting     | true / false | Submit habilitado              |
| hasIdentity         | getIdentity()           | getIdentity() !== null                        | true / false | Identidad recordada            |
| canReset            | ChangePasswordContainer | isDirty && !isSubmitting                      | true / false | Botón Reset habilitado         |
| showDone            | Containers              | status === 'success'                          | true / false | Mostrar botón Done             |

---

# 🧩 7. TIPOS COMPUESTOS

## UserDataType

```ts
type UserDataType = {
  user_id: string;
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  currency: 'usd' | 'eur' | 'cop';
  role: 'user' | 'admin' | 'super_admin';
  contact: string | null;
}
```

---

## UserIdentityType

```ts
type UserIdentityType = {
  email: string;
  username: string;
  rememberMe: boolean;
}
```

---

## UpdateProfileFormDataType

```ts
type UpdateProfileFormDataType = {
  firstname: string;
  lastname: string;
  currency: 'usd' | 'eur' | 'cop';
  contact: string | null;
}
```

---

## ChangePasswordFormDataType

```ts
type ChangePasswordFormDataType = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
```

---

## AuthEventResultType (Nuevo)

```ts
type AuthEventResultType = {
  uiState?: 'IDLE' | 'SIGN_IN' | 'SIGN_UP';
  message?: string | null;
  prefill?: { email?: string; username?: string };
  navigation?: { to: string; replace?: boolean; state?: Record<string, unknown> };
  returnTo?: string | null;
}
```

---

# 🎯 8. MATRIZ DE ESTADOS POR ESCENARIO

| Escenario                       | isAuthenticated | identity     | uiState      | Ruta destino | Modal | Prefill | Mensaje               |
| ------------------------------- | --------------- | ------------ | ------------ | ------------ | ----- | ------- | --------------------- |
| Primera visita                  | false           | null         | IDLE         | /auth        | No    | No      | No                    |
| Login exitoso (remember)        | true            | {...}        | IDLE         | /fintrack    | No    | N/A     | No                    |
| Login exitoso (no remember)     | true            | null         | IDLE         | /fintrack    | No    | N/A     | No                    |
| Logout manual                   | false           | {...} o null | IDLE         | /auth        | No    | No      | No (solo toast)       |
| Sesión expirada (con identidad) | false           | {...}        | SIGN_IN      | /auth        | Sí    | Sí      | "Your session has expired..." |
| Sesión expirada (sin identidad) | false           | null         | SIGN_IN      | /auth        | Sí    | No      | "Your session has expired..." |
| Cambio password exitoso         | false           | {...} o null | SIGN_IN      | /auth        | Sí    | Sí/No   | No                    |
| user_logged_out                 | false           | {...} o null | IDLE         | /auth        | No    | No      | No (solo toast)       |

---

# ✅ RESUMEN POR COMPONENTE

| Componente              | Consume                                         | Produce                              |
| ----------------------- | ----------------------------------------------- | ------------------------------------ |
| ProtectedRoute          | isAuthenticated, hasToken, location             | navigate with authEvent              |
| AuthPage                | authEvent, uiState, message, prefilled*         | modal visibility, returnTo ref       |
| AuthUI                  | isSignInInitial, error, messageToUser           | isSignIn (local)                     |
| SignInForm              | formData, validationErrors, touchedFields       | onSignIn                             |
| ChangePasswordContainer | status, countdown, isDirty                      | showDone, showCancel, authEvent      |
| UpdateProfileContainer  | isDirty, isLoading, successMessage              | status                               |
| authEventRegistry       | event data, getIdentity                         | AuthEventResultType                  |

---