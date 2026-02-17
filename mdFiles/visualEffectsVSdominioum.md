Perfecto. Vamos a hacerlo **claro, completo y aterrizado**, sin teoría innecesaria.
Te muestro **el flujo completo BACKEND → DOMINIO → UI**, **quién produce cada estado**, **quién lo transforma** y **dónde se usa**.

---

# 🔄 FLUJO COMPLETO: Change Password

```
Backend (API)
   ↓
Dominio (useAuth)
   ↓
UI State (Container)
   ↓
Presentación (Form)
```

---

## 1️⃣ BACKEND (origen de la verdad técnica)

📍 **Archivo**

```
backend/controllers/userController.ts
```

### 📤 Backend **ENTREGA**

Solo **hechos técnicos**, nunca UI:

```json
// ✅ Success
{
  "success": true,
  "message": "Password changed successfully"
}
```

```json
// ❌ Validation error
{
  "success": false,
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": {
    "fieldErrors": {
      "currentPassword": ["Incorrect password"]
    }
  }
}
```

```json
// ❌ Rate limit
{
  "success": false,
  "error": "RateLimitExceeded",
  "message": "Too many attempts",
  "retryAfter": 60
}
```

```json
// ❌ Auth
401 Unauthorized
```

### 📌 Backend **NO SABE**

* ❌ loading
* ❌ toast
* ❌ logout
* ❌ textos finales de UI

---

## 2️⃣ DOMINIO (useAuth) — **normaliza**

📍 **Archivo**

```
frontend/src/auth/useAuth.ts
```

### 🎯 Rol del dominio

* Habla con el backend
* **Traduce respuestas técnicas → resultados de negocio**
* NO toca UI

---

### 📦 Tipo de dominio (contrato)

```ts
export type ChangePasswordDomainResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "INVALID_PASSWORD"
        | "VALIDATION_ERROR"
        | "RATE_LIMIT"
        | "SESSION_EXPIRED"
        | "UNKNOWN";
      fieldErrors?: Record<string, string[]>;
      retryAfter?: number;
    };
```

---

### ⚙️ Dominio **RECIBE del backend**

* HTTP status
* JSON crudo
* AxiosError

---

### ⚙️ Dominio **ENTREGA a la UI**

```ts
{ ok: false, reason: "VALIDATION_ERROR", fieldErrors }
```

```ts
{ ok: false, reason: "RATE_LIMIT", retryAfter: 60 }
```

```ts
{ ok: false, reason: "SESSION_EXPIRED" }
```

---

### 🚫 Dominio NO ENTREGA

* strings finales de UI
* estados visuales
* setState
* timers

---

## 3️⃣ UI STATE (ChangePasswordContainer)

📍 **Archivo**

```
ChangePasswordContainer.tsx
```

### 🎛️ Estados visuales (aquí viven)

```ts
const [isLoading, setIsLoading] = useState(false);
const [formErrors, setFormErrors] = useState({});
const [error, setError] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
```

📌 **Estos estados NO existen en el dominio**

---

### 🔁 Flujo exacto del submit

```ts
const onSubmit = async (data) => {
  setIsLoading(true);
  setError(null);
  setSuccessMessage(null);

  const result = await handleChangePassword(
    data.currentPassword,
    data.newPassword,
    data.confirmPassword
  );

  setIsLoading(false);

  if (result.ok) {
    setSuccessMessage("Password updated successfully");

    setTimeout(() => {
      logoutCleanup(false);
    }, 3000);
    return;
  }

  switch (result.reason) {
    case "SESSION_EXPIRED":
      setError("Session expired. Please login again.");
      logoutCleanup(true);
      break;

    case "RATE_LIMIT":
      setError(`Too many attempts. Try again in ${result.retryAfter}s`);
      break;

    case "VALIDATION_ERROR":
      setFormErrors(transformApiErrors(result));
      break;

    case "INVALID_PASSWORD":
      setFormErrors({ currentPassword: "Incorrect password" });
      break;

    default:
      setError("Password change failed");
  }
};
```

---

### 📌 Container **RECIBE**

* `ChangePasswordDomainResult`

### 📌 Container **ENTREGA**

* props de UI

---

## 4️⃣ PRESENTACIÓN (ChangePasswordForm)

📍 **Archivo**

```
ChangePasswordForm.tsx
```

### 🎨 Props puras

```ts
type Props = {
  isLoading: boolean;
  errors: Record<string, string>;
  successMessage?: string;
  onSubmit: (data) => void;
};
```

---

### 📌 Form **RECIBE**

* estados visuales
* callbacks

### 📌 Form **USA**

* render
* disabled
* mensajes
* inputs

---

## 5️⃣ MAPA FINAL — QUIÉN ENTREGA QUÉ

| Capa      | Entrega              | Recibe            |
| --------- | -------------------- | ----------------- |
| Backend   | JSON + HTTP          | Request           |
| Dominio   | Resultado de negocio | JSON backend      |
| Container | Estados visuales     | Resultado dominio |
| Form      | UI                   | Props             |

---

## 6️⃣ Regla mental definitiva (memorízala)

> 🔹 **Backend habla en errores técnicos**
> 🔹 **Dominio habla en reglas de negocio**
> 🔹 **UI habla en experiencias visuales**

---

## 7️⃣ Por qué tu intuición era correcta

Cuando dijiste:

> *"dominio puro es eliminar efectos visuales"*

Eso es exactamente **Clean Architecture aplicada bien**.
No estabas confundido, solo faltaba **dibujar el flujo completo**.

---

Si quieres, próximo paso puedo:

* refactorizar **tu handleChangePassword real** a dominio puro
* o darte **el diagrama visual**
* o revisar **si tu backend está entregando el shape ideal**

Tú mandas.
