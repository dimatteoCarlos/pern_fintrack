# Unused Functions Archive

**Archive Date:** 2026-04-12  
**Original File:** `src/utils/helpers.js`  
**Backup File:** `archived/utils_archive/helpers-deprecated.js`

---

## Summary

| Total Archived Functions | 11 |
|--------------------------|-----|

---

## Functions List

### 1. `determineTransactionType_v1`
- **Line:** ~50
- **Purpose:** Alternative version of `determineTransactionType` that treats `category_budget` accounts as opening-only transactions
- **Why unused:** Team preferred the original `determineTransactionType` function
- **Status:** ❌ NOT USED

---

### 2. `validateRequiredFields`
- **Line:** ~80
- **Purpose:** Validates required fields in a form and returns 400 error if any are missing
- **Why unused:** Validation is handled elsewhere in the codebase
- **Status:** ❌ NOT USED

---

### 3. `getAccountTypeId`
- **Line:** ~95
- **Purpose:** Queries database for account type ID based on account type name (e.g., 'debtor' → 5)
- **Why unused:** Account type queries are done directly in controllers
- **Status:** ❌ NOT USED

---

### 4. `filterCurrencyId`
- **Line:** ~120
- **Purpose:** Alternative to `getCurrencyId` that filters from in-memory array instead of database query
- **Why unused:** Team preferred database query approach
- **Status:** ❌ NOT USED

---

### 5. `handleTransactionRecording`
- **Line:** ~130
- **Purpose:** Wraps `recordTransaction` function, only executes if NOT an account opening
- **Why unused:** Transaction recording logic is handled directly
- **Status:** ❌ NOT USED

---

### 6. `formatDateToISO`
- **Line:** ~160
- **Purpose:** Converts Spanish format date (dd-mm-yyyy) to ISO format (yyyy-mm-dd)
- **Why unused:** Backend works directly with ISO format dates
- **Status:** ❌ NOT USED

---

### 7. `validateAndNormalizeDateFn`
- **Line:** ~175
- **Purpose:** Strict version of `validateAndNormalizeDate` with regex validation for ISO format
- **Why unused:** Team preferred the simpler validation function
- **Status:** ❌ NOT USED

---

### 8. `isValidDate`
- **Line:** ~200
- **Purpose:** Validates if a string matches dd-mm-yyyy pattern and represents a valid date
- **Why unused:** Frontend sends dates in ISO format, not Spanish format
- **Status:** ❌ NOT USED

---

### 9. `convertToISO`
- **Line:** ~205
- **Purpose:** Converts dates from Spanish (dd-mm-yyyy) or US (mm-dd-yyyy) format to ISO
- **Why unused:** Backend standardized on ISO format from frontend
- **Status:** ❌ NOT USED

---

### 10. `getMonthName`
- **Line:** ~220
- **Purpose:** Returns month name from month number (1 → 'January')
- **Why unused:** Date formatting is done with `toLocaleDateString`
- **Status:** ❌ NOT USED

---

### 11. `numberToWords`
- **Line:** ~230
- **Purpose:** Converts numbers to words (e.g., 123 → "One Hundred Twenty Three")
- **Why unused:** This functionality is not required in the project
- **Status:** ❌ NOT USED (code is commented out)

---

## How to Restore

If any function is needed in the future:

1. Open `archived/utils_archive/helpers-deprecated.js`
2. Copy the desired function
3. Paste into `src/utils/helpers.js`
4. Verify no conflicts
5. Run tests

---

## Notes

- These functions are preserved for historical reference only
- They are not used in active code
- Removing them from the main file is safe