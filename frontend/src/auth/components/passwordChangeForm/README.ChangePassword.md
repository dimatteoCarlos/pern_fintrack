# Change Password Module

This module implements the **Change Password** feature in a clean and maintainable way, separating **domain logic**, **form logic**, and **UI effects**.

---

## Overview

### Architecture Flow

1. **Container (`ChangePasswordContainer`)**  
   - Orchestrates the feature.
   - Receives hooks and API functions (domain and form logic).  
   - Passes data and handlers to the **form component**.  
   - Decides how to map **domain results** to **UI effects** (messages, loading state, etc.).

2. **Form Logic (`useChangePasswordFormLogic`)**  
   - Handles **pure business logic** and **API calls**.  
   - Receives validation hook, initial form data, and `handleChangePassword`.  
   - Returns results (success, errors, field-level validation) to the container.

3. **Validation Hook (`useChangePasswordValidation`)**  
   - Provides field-level and full-form validation.  
   - Converts backend errors into frontend-friendly format.

---

## Flow Tables

### **ChangePasswordContainer**

| Concept                      | Detail                                                                                       |
|-------------------------------|------------------------------------------------------------------------------------------------|
| **Receives**                  | Hooks and domain logic: <br>• `useChangePasswordValidation` (validation) <br>• `useChangePasswordFormLogic` (form logic) <br>• `handleChangePassword` (API function) |
| **From**                      | Hooks and functions injected from domain layer or container parent.                           |
| **Returns / Produces**        | Props and UI states: <br>• `formData` <br>• `errors` <br>• `fieldErrors` <br>• `successMessage` <br>• `isLoading` |
| **To**                        | Passed to `ChangePasswordForm` component for rendering inputs, messages, and UI effects.     |

---

### **useChangePasswordFormLogic**

| Concept                      | Detail                                                                                       |
|-------------------------------|------------------------------------------------------------------------------------------------|
| **Receives**                  | • `handleChangePassword` (API call) <br>• `useChangePasswordValidation` (validation hook) <br>• Initial `formData` |
| **From**                      | `ChangePasswordContainer` (dependency injection of domain logic)                               |
| **Returns / Produces**        | Domain results: <br>• `formData` updated <br>• `errors` / `fieldErrors` <br>• `successMessage` <br>• `isLoading` <br>• Handlers: `handleChange`, `handleSubmit`, `resetForm` |
| **To**                        | Returns to `ChangePasswordContainer` to map domain results into UI effects                     |

---

## `handleChangePassword` Documentation

```ts
/**
 * Changes the user's password with current password verification.
 *
 * @param currentPassword - Current password for authentication
 * @param newPassword - New password to set
 * @param confirmPassword - Confirmation of the new password
 * @returns Promise of domain result:
 *  {
 *    success: boolean,
 *    message?: string,
 *    error?: string,
 *    fieldErrors?: Record<string, string[]>,
 *    retryAfter?: number
 *  }
 *
 * 🔹 Responsibilities:
 * - Makes API request (PATCH) to change the password
 * - Returns structured **domain result** without UI side effects
 * - Handles HTTP errors:
 *    - 401 → Session expired
 *    - 429 → Rate limit exceeded
 *    - 400 → Validation error
 */
