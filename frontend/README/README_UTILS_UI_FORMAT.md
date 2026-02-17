# 🎨 UI & Formatting Utilities (`functions.ts`)

A specialized TypeScript utility module focused on **data presentation**, **internationalization (i18n)**, and **UI state logic**. It leverages the native Web `Intl` API to provide high-performance, zero-dependency formatting.

## 🚀 Key Features

*   **`currencyFormat` & `numberFormatCurrency`**: Advanced formatters that convert raw numbers into localized currency strings. Supports custom decimal precision and regional settings (e.g., `en-US` vs `es-CO`).
*   **`getCurrencySymbol`**: Extracts the shortest visual symbol (e.g., `$`, `€`, `£`) for any currency code using "narrow symbol" logic with reliable ISO fallbacks.
*   **`generateCurrencyOptions`**: Dynamically builds descriptive arrays for UI dropdowns. It uses `Intl.DisplayNames` to map codes to full names (e.g., `USD` → `US Dollar`).
*   **`digitRound`**: A precision utility that avoids common JavaScript floating-point errors by rounding strictly to a specified number of decimal places.
*   **`genericToggle`**: A circular state helper that rotates through a set of options (`opc1` → `opc2` → `opc3` → `opc1`), perfect for multi-state filters or status buttons.
*   **`isValidCurrencyCode`**: Validation guard that checks strings against supported ISO 4217 codes to ensure application stability.

## 🛠️ Technical Highlights

*   **Type Safety**: Written in **TypeScript** with explicit interfaces for currency, status, and toggle configurations.
*   **Modern i18n**: Utilizes `Intl.DisplayNames` and `Intl.NumberFormat` for lightweight localization without external libraries like Moment.js or Numeral.js.
*   **Resilience**: Built-in `try/catch` blocks and fallback mechanisms to handle edge cases or older browser environments.

## 📖 Usage Examples

### 💰 Formatting Currency
```typescript
// Formats to "COP 50.000" or "$50,000" depending on locale
const price = numberFormatCurrency(50000, 0, 'COP', 'es-CO');
Use code with caution.

🔣 Getting a Symbol
typescript
const symbol = getCurrencySymbol('USD'); // Returns "$"
Use code with caution.

🔄 Rotating UI States
typescript
const nextState = genericToggle({ 
  currentOpc: 'Pending', 
  opc1: 'Pending', 
  opc2: 'Approved', 
  opc3: 'Rejected' 
}); // Returns "Approved"
Use code with caution.

📂 File Location
frontend/src/utils/functions.ts
[!TIP]
Use generateCurrencyOptions during component mounting to ensure your UI selectors are always localized to the user's preferred language.