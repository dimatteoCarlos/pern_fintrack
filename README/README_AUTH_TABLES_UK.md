
# 📋 ALL STATE INDICATORS IN THE AUTHENTICATION SYSTEM

---

## 🗃️ 1. BACKEND – DATABASE

### Table: `users`

| Column          | Data Type    | Possible Values | Description                   |
| --------------- | ------------ | --------------- | ----------------------------- |
| user_id         | UUID         | UUID v4         | Unique identifier of the user |
| username        | VARCHAR(50)  | Unique text     | Username for login            |
| email           | VARCHAR(100) | Unique email    | User email address            |
| password_hashed | VARCHAR(255) | bcrypt hash     | Secure hashed password        |
| user_firstname  | VARCHAR(50)  | Text            | First name                    |
| user_lastname   | VARCHAR(50)  | Text            | Last name                     |
| user_contact    | VARCHAR(50)  | Text or NULL    | Contact information           |
| currency_id     | INTEGER      | Currency ID     | Preferred currency            |
| user_role_id    | INTEGER      | Role ID         | User role                     |
| created_at      | TIMESTAMP    | Date/time       | Record creation timestamp     |
| updated_at      | TIMESTAMP    | Date/time       | Last update timestamp         |

---

### Table: `currencies`

| Column        | Data Type   | Possible Values     | Description         |
| ------------- | ----------- | ------------------- | ------------------- |
| currency_id   | INTEGER     | ID                  | Currency identifier |
| currency_code | VARCHAR(3)  | 'usd', 'eur', 'cop' | Currency code       |
| currency_name | VARCHAR(50) | Text                | Currency name       |

---

### Table: `user_roles`

| Column         | Data Type   | Possible Values                | Description     |
| -------------- | ----------- | ------------------------------ | --------------- |
| user_role_id   | INTEGER     | ID                             | Role identifier |
| user_role_name | VARCHAR(20) | 'user', 'admin', 'super_admin' | Role name       |

---

### Table: `refresh_tokens`

| Column          | Data Type | Possible Values | Description                    |
| --------------- | --------- | --------------- | ------------------------------ |
| token_id        | INTEGER   | ID              | Token identifier               |
| user_id         | UUID      | UUID            | Associated user                |
| token           | TEXT      | JWT string      | Refresh token                  |
| expiration_date | TIMESTAMP | Date/time       | Refresh token expiration date  |
| revoked         | BOOLEAN   | true / false    | Indicates if token was revoked |
| user_agent      | TEXT      | String          | Client user agent              |
| ip_address      | INET      | IP              | Client IP address              |

---

## 📡 2. BACKEND – HTTP RESPONSES (ENDPOINTS)

### POST `/sign-in`

| HTTP Code | Field               | Possible Values      | Description           |
| --------- | ------------------- | -------------------- | --------------------- |
| 200       | message             | "Login successful"   | Success message       |
| 200       | accessToken         | JWT string           | Access token          |
| 200       | user.user_id        | UUID                 | User ID               |
| 200       | user.username       | String               | Username              |
| 200       | user.email          | Email                | User email            |
| 200       | user.user_firstname | String               | First name            |
| 200       | user.user_lastname  | String               | Last name             |
| 200       | user.user_contact   | String or null       | Contact info          |
| 200       | user.user_role_name | String               | User role             |
| 200       | user.currency       | 'usd', 'eur', 'cop'  | Currency              |
| 200       | expiresIn           | Number               | Expiration in seconds |
| 400       | success             | false                | Error indicator       |
| 400       | error               | "ValidationError"    | Error type            |
| 400       | message             | String               | Descriptive message   |
| 400       | fieldErrors         | Object               | Field-level errors    |
| 401       | success             | false                | Error indicator       |
| 401       | error               | "InvalidCredentials" | Error type            |
| 401       | message             | "Invalid password"   | Error message         |
| 429       | success             | false                | Error indicator       |
| 429       | error               | "RateLimitExceeded"  | Error type            |
| 429       | message             | String               | Message               |
| 429       | retryAfter          | Number               | Seconds to retry      |

---

### POST `/sign-up`

| HTTP Code | Field       | Possible Values   | Description           |
| --------- | ----------- | ----------------- | --------------------- |
| 201       | message     | String            | Success message       |
| 201       | accessToken | JWT (optional)    | Access token          |
| 201       | user        | Object            | User data             |
| 201       | expiresIn   | Number (optional) | Expiration in seconds |

---

### POST `/sign-out`

| HTTP Code | Field   | Possible Values           | Description     |
| --------- | ------- | ------------------------- | --------------- |
| 200       | message | "Logged out successfully" | Success message |

---

### GET `/validate-session`

| HTTP Code | Field   | Possible Values | Description  |
| --------- | ------- | --------------- | ------------ |
| 200       | message | String          | Info message |
| 200       | user    | Object          | User data    |

---

### PATCH `/update-profile`

| HTTP Code | Field       | Possible Values   | Description        |
| --------- | ----------- | ----------------- | ------------------ |
| 200       | success     | true              | Success indicator  |
| 200       | message     | String            | Success message    |
| 200       | user        | Object            | Updated user data  |
| 400       | success     | false             | Error indicator    |
| 400       | error       | "ValidationError" | Error type         |
| 400       | message     | String            | Error message      |
| 400       | fieldErrors | Object            | Field-level errors |

---

### PATCH `/change-password`

| HTTP Code | Field       | Possible Values          | Description        |
| --------- | ----------- | ------------------------ | ------------------ |
| 200       | success     | true                     | Success indicator  |
| 200       | message     | String                   | Success message    |
| 403       | success     | false                    | Error indicator    |
| 403       | error       | "InvalidCurrentPassword" | Error type         |
| 403       | message     | String                   | Error message      |
| 403       | fieldErrors | Object                   | Field-level errors |

---

# 🏪 3. FRONTEND – ZUSTAND STORES

### 3.1 useAuthStore – Session State

| Indicator               | Type          | Possible Values                | Initial | Description                          |
| ----------------------- | ------------- | ------------------------------ | ------- | ------------------------------------ |
| isAuthenticated         | boolean       | true / false                   | false   | User has an active session           |
| userData                | object / null | UserDataType or null           | null    | Complete user data                   |
| userData.user_id        | string        | UUID                           | -       | User ID                              |
| userData.username       | string        | Text                           | -       | Username                             |
| userData.email          | string        | Email                          | -       | Email address                        |
| userData.user_firstname | string        | Text                           | -       | First name                           |
| userData.user_lastname  | string        | Text                           | -       | Last name                            |
| userData.currency       | string        | 'usd', 'eur', 'cop'            | 'usd'   | Preferred currency                   |
| userData.role           | string        | 'user', 'admin', 'super_admin' | 'user'  | User role                            |
| userData.contact        | string / null | Text or null                   | null    | Contact info                         |
| isCheckingAuth          | boolean       | true / false                   | true    | Initial session verification         |
| isLoading               | boolean       | true / false                   | false   | Indicates auth operation in progress |
| error                   | string / null | Message or null                | null    | Global authentication error          |
| successMessage          | string        | Message or empty               | ''      | Success message                      |

---

### 3.2 useAuthUIStore – Auth UI State

| Indicator         | Type          | Possible Values                                                     | Initial | Description                    |
| ----------------- | ------------- | ------------------------------------------------------------------- | ------- | ------------------------------ |
| uiState           | enum          | 'IDLE', 'REMEMBERED_VISITOR', 'SESSION_EXPIRED', 'PASSWORD_CHANGED' | 'IDLE'  | Current UI state               |
| message           | string / null | Text or null                                                        | null    | Global message (success/error) |
| prefilledEmail    | string / null | Email or null                                                       | null    | Prefill email for login        |
| prefilledUsername | string / null | Username or null                                                    | null    | Prefill username               |

---
Perfecto, aquí tienes **las secciones 4 a 8 completamente en Markdown**, con los indicadores en español y **las descripciones traducidas al inglés**, listas para VSCode:

---

## 💾 4. FRONTEND – STORAGE

### 4.1 localStorage

| Key                      | Type          | Possible Values                         | Persistence | Description                                       |
| ------------------------ | ------------- | --------------------------------------- | ----------- | ------------------------------------------------- |
| auth_identity            | object / null | { email, username, rememberMe } or null | Yes         | Stored user identity data                         |
| auth_identity.email      | string        | Email                                   | Yes         | Stored email                                      |
| auth_identity.username   | string        | Text                                    | Yes         | Stored username                                   |
| auth_identity.rememberMe | boolean       | true / false                            | Yes         | Indicates whether the user wants to be remembered |

---

### 4.2 sessionStorage

| Key         | Type          | Possible Values   | Persistence   | Description           |
| ----------- | ------------- | ----------------- | ------------- | --------------------- |
| accessToken | string / null | JWT or null       | Session (tab) | Current access token  |
| tokenExpiry | number / null | Timestamp or null | Session (tab) | Token expiration time |

---

## 🧭 5. FRONTEND – REACT ROUTER

| Indicator                        | Type                | Possible Values             | Description                              |
| -------------------------------- | ------------------- | --------------------------- | ---------------------------------------- |
| location.pathname                | string              | '/', '/auth', '/fintrack/*' | Current application route                |
| location.state.from              | string / undefined  | Origin route                | Route from which navigation occurred     |
| location.state.fromLogout        | boolean / undefined | true / undefined            | Indicates navigation after manual logout |
| location.state.hasIdentity       | boolean / undefined | true / undefined            | Indicates if identity exists for prefill |
| location.state.prefilledEmail    | string / undefined  | Email                       | Email used to prefill login              |
| location.state.prefilledUsername | string / undefined  | Username                    | Username used to prefill login           |

---

## 📐 6. DERIVED (COMPUTED) INDICATORS

| Indicator           | Where Calculated        | Calculation                                   | Values       | Description                                  |
| ------------------- | ----------------------- | --------------------------------------------- | ------------ | -------------------------------------------- |
| showModal           | AuthPage.tsx            | uiState !== 'IDLE' && pathname === AUTH_ROUTE | true / false | Determines whether modal is visible on /auth |
| isDirty             | UpdateProfileContainer  | formData !== initialData                      | true / false | Indicates unsaved changes exist              |
| isSubmittingAllowed | Form hooks              | allTouched && !hasErrors && !isSubmitting     | true / false | Determines if submit is allowed              |
| hasIdentity         | ProtectedRoute          | getIdentity() !== null                        | true / false | Indicates stored identity exists             |
| canReset            | ChangePasswordContainer | isDirty && !isSubmitting                      | true / false | Determines if Reset button is enabled        |
| showDone            | Containers              | status === 'success'                          | true / false | Determines if Done button should be shown    |

---

## 🧩 7. FRONTEND – COMPOUND TYPES

### UserDataType (Store)

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

### UserIdentityType (localStorage)

```ts
type UserIdentityType = {
  email: string;
  username: string;
  rememberMe: boolean;
}
```

---

### UpdateProfileFormDataType (Form)

```ts
type UpdateProfileFormDataType = {
  firstname: string;
  lastname: string;
  currency: 'usd' | 'eur' | 'cop';
  contact: string | null;
}
```

---

### ChangePasswordFormDataType (Form)

```ts
type ChangePasswordFormDataType = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
```

---

## 🎯 8. STATE MATRIX BY SCENARIO

| Scenario                           | isAuthenticated | identity      | uiState            | Destination Route | Modal | Prefill |
| ---------------------------------- | --------------- | ------------- | ------------------ | ----------------- | ----- | ------- |
| First visit                        | false           | null          | IDLE               | /                 | No    | No      |
| Successful login (remember)        | true            | {...}         | IDLE               | /fintrack         | No    | N/A     |
| Successful login (no remember)     | true            | null          | IDLE               | /fintrack         | No    | N/A     |
| Manual logout (with identity)      | false           | {...}         | IDLE               | /                 | No    | No      |
| Manual logout (without identity)   | false           | null          | IDLE               | /                 | No    | No      |
| Session expired (with identity)    | false           | {...}         | SESSION_EXPIRED    | /auth             | Yes   | Yes     |
| Session expired (without identity) | false           | null          | SESSION_EXPIRED    | /                 | No    | No      |
| Successful password change         | false           | {...} or null | PASSWORD_CHANGED   | /auth             | Yes   | No      |
| Remembered visitor on /auth        | false           | {...}         | REMEMBERED_VISITOR | /auth             | Yes   | Yes     |

---

## ✅ COMPONENT SUMMARY

| Component               | Consumes                                  | Produces             |
| ----------------------- | ----------------------------------------- | -------------------- |
| ProtectedRoute          | isAuthenticated, identity, location       | redirectTo, state    |
| AuthPage                | uiState, message, prefilled*, location    | showModal            |
| AuthUI                  | isSignInInitial, error, messageToUser     | isSignIn (local)     |
| SignInForm              | formData, validationErrors, touchedFields | onSignIn             |
| ChangePasswordContainer | status, countdown, isDirty                | showDone, showCancel |
| UpdateProfileContainer  | isDirty, isLoading, successMessage        | status               |

---

