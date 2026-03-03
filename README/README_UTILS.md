# 🛠️ Comprehensive Utilities Documentation

This document provides a detailed technical reference for all utility modules in the project, divided into **Backend (Server-side)** and **Frontend (Client-side)** layers.

---

## 🏗️ Backend Utilities (`/backend/src/utils/`)

### 1. Authentication Module (`authUtils/authFn.js`)
Handles security, encryption, and session lifecycle.

*   **`hashed(word)`**: Salts and hashes passwords using [Bcrypt](https://www.npmjs.com).
*   **`isRight(userPwd, hashedPwd)`**: Validates plain-text passwords against stored hashes.
*   **`createToken(id, role)`**: Generates a short-lived **JWT Access Token** (default: 1h). Includes user ID and role.
*   **`createRefreshToken(id)`**: Generates a long-lived **JWT Refresh Token** (default: 7d).
*   **`rotateRefreshToken(oldToken, userId, req)`**: 
    *   Revokes the used token in the DB.
    *   Issues a new one (**Token Rotation**).
    *   Logs security metadata: IP address and User-Agent.
*   **`cleanRevokedTokens()`**: Maintenance worker that deletes expired or revoked tokens from the `refresh_tokens` table.
*   **`revokeAllUserRefreshTokens(userId)`**: Force-logs out a user from all sessions (**Global Logout**).

### 2. Account Logic (`accountUtils.js`)
Manages database relationships and specific account queries.

*   **`getAccountTypeId(accountTypeName)`**: Maps string labels (e.g., 'bank') to DB Primary Keys.
*   **`getUserIdFromAccount(clientOrPool, targetAccountId)`**: 
    *   Finds the owner of an account.
    *   **Smart Connection**: Automatically detects if it should use an existing transaction client or pull a new one from the [pg pool](https://node-postgres.com).
*   **`getSlackAccountId(userId)`**: Specialized helper to locate the 'slack' (compensation) account required for financial balancing.

### 3. General Helpers (`helpers.js`)
Logic for data integrity and transaction classification.

*   **`determineTransactionType_v1`**: Financial engine that classifies movements:
    *   Positive + Bank = **Deposit**.
    *   Negative + Bank = **Withdraw**.
    *   Positive + Debtor = **Lend**.
    *   Negative + Debtor = **Borrow**.
*   **`validateAndNormalizeDateFn`**: Ensures all incoming dates from the API are validated and converted to **ISO 8601 UTC** before saving to PostgreSQL.
*   **`validateRequiredFields(fields, res)`**: Checks for missing keys in request bodies and automatically sends a **400 Bad Request** if data is incomplete.
*   **`capitalize(text)`**: Formats strings to lowercase and capitalizes the start of every sentence.

---

## 🎨 Frontend Utilities (`/frontend/src/helpers/`)

### 1. UI Presentation & Formatting (`functions.ts`)
TypeScript utilities for internationalization and reactive UI.

*   **`numberFormatCurrency`**: Standardizes currency display using the native [Intl API](https://developer.mozilla.org).
    *   *Usage*: `numberFormatCurrency(5000, 2, 'USD', 'en-US')` → `"$5,000.00"`.
*   **`getCurrencySymbol(currencyCode)`**: Uses `Intl.NumberFormat` with `narrowSymbol`. Returns `$`, `€`, or `£` instead of ISO codes.
*   **`generateCurrencyOptions(map)`**: Generates arrays for Select components. Uses `Intl.DisplayNames` to turn `"COP"` into `"COP - Colombian Peso"`.
*   **`genericToggle`**: A circular state switcher. Rotates through values: `Pending` → `Approved` → `Rejected` → `Pending`.
*   **`digitRound(number, decimals)`**: Rounds numbers precisely to avoid JavaScript's floating-point math errors.
*   **`isValidCurrencyCode(code)`**: Validates if a string is a recognized ISO 4217 currency code.

---

## 🚀 Environment Requirements

| Variable | Usage | Source |
| :--- | :--- | :--- |
| `SALT_ROUNDS` | Password Hashing | Backend `.env` |
| `JWT_SECRET` | Access Tokens | Backend `.env` |
| `PG_DATABASE` | Data Persistence | [PostgreSQL](https://www.postgresql.org) |
| `Intl API` | i18n Support | Modern Browsers |