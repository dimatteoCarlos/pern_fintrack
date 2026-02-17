# 🛠️ System & Account Management Utilities

This section covers the core utility modules responsible for maintaining data integrity, standardized formatting, and financial business logic within the backend.

## 🏦 Account Management Utilities (`accountUtils.js`)

This module provides helper functions to interact with user accounts and account types within the PostgreSQL database.

### 🚀 Key Features
*   **`getAccountTypeId(name)`**: Retrieves the unique ID for a specific account category (e.g., 'bank', 'cash'). Includes automatic whitespace trimming for safer queries.
*   **`getUserIdFromAccount(client, accountId)`**: Fetches the owner of a specific account. Supports **Connection Flexibility**, allowing it to use an existing transaction client or a standard [pg-pool](https://node-postgres.com) instance.
*   **`getSlackAccountId(userId)`**: Specialized locator for 'slack' compensation accounts, critical for reporting and balancing phases.

---

## ⚙️ System Helper Utilities (`helpers.js`)

A comprehensive collection of functions to standardize data formatting, validate input, and determine business logic for financial transactions.

### 💰 Transaction & Financial Logic
*   **`determineTransactionType_v1`**: Automatically categorizes transactions (Deposit, Withdraw, Lend, Borrow, or Opening) based on account type and amount polarity.
*   **`validateRequiredFields`**: Middleware-style helper that ensures request bodies contain all necessary data, preventing null pointer exceptions.
*   **`handleTransactionRecording`**: A conditional wrapper to manage ledger persistence, specifically handling edge cases like account openings.

### 📅 Data Validation & Formatting
*   **`validateAndNormalizeDateFn`**: Ensures dates follow **ISO 8601** standards and converts them to **UTC** before database insertion.
*   **`formatDateToDDMMYYYY`**: Converts ISO strings into user-friendly formats for the frontend display.
*   **`capitalize`**: A smart text formatter that capitalizes the first letter of every sentence.

---

## 📊 Technical Overview

| Category | Utilities |
| :--- | :--- |
| **Logic** | `determineTransactionType`, `handleTransactionRecording` |
| **Lookups** | `getAccountTypeId`, `getCurrencyId`, `filterCurrencyId` |
| **Validation** | `validateRequiredFields`, `isValidDate`, `validateAndNormalizeDate` |
| **Formatting** | `capitalize`, `formatDateToISO`, `formatDateToDDMMYYYY` |

## 📖 Usage Examples

### Capitalize Text
```javascript
capitalize("hello world. this is fintrack."); 
// Output: "Hello world. This is fintrack."
Use code with caution.

Determine Transaction Logic
javascript
// A positive amount in a 'debtor' account is treated as lending money
const type = determineTransactionType_v1(500, 'debtor');
// Returns: { transactionType: 'lend', counterTransactionType: 'borrow' }