```md
# Fintrack Backlog - Grupos Completos

## 🔐 Authentication

### ✅ LISTO (9/12)
```
- [x] Sign out redirects to Sign In instead of the main menu
- [x] Review cross-field validation between password, new password, and confirm password  
- [x] Review responsiveness of authentication forms: Sign In, Sign Up, Update User Data, Change Password
- [x] Review real-time validation in Sign Up for password and confirmPassword fields
- [x] Complete authentication with refresh token support
- [x] Validate the target amount when creating a pocket account
- [x] Verify refresh token authentication and automatic refresh logic
- [x] Review UX/UI of authentication forms
- [x] Review navigation behavior in authentication flows
```

### 🔄 PENDIENTE (3/12)
```
- [ ] Investigate why the session expires even when a refresh token exists and should have been updated
- [ ] Define how to keep the user signed in while the refresh token remains valid  
- [ ] Define and apply an authorization roles scheme
```

---

## ⚙️ Backend and Security

### ✅ LISTO (3/7)
```
- [x] Verify user authentication and userId access control before allowing main app functions
- [x] Adjust the backend so transaction searches prioritize account_id instead of account_name
- [x] Minimize backend console.logs
```

### 🔄 PENDIENTE (4/7)
```
- [ ] Organize cookie and token duration rules
- [ ] Review how numeric amounts are stored in the database and why some values are returned as strings
- [ ] Review the timestamp offset issue in transfer-between-accounts transactions
- [ ] Define a multicurrency strategy for keeping balances in Fintrack
```

---

## 🔧 General

### ✅ LISTO (1/2)
```
- [x] Verify dynamically unused or broken components
```

### 🔄 PENDIENTE (1/2)
```
- [ ] Define the deployment process
```

---

## 💸 Transfer

### ✅ LISTO (5/7)
```
- [x] Review responsiveness in Transfer when adding a line in To:, especially under 450 px width
- [x] Make Transfer responsive without scroll for a 360 x 700 px layout
- [x] Correct the media query styles for To: and reduce the font size of From and To labels
- [x] Review the full transfer flow
- [x] Fix the inter-account transfer error
```

### 🔄 PENDIENTE (2/7)
```
- [ ] Support screens under 700 px height with internal scroll in `cards_presentation--tracker` and fixed main navbar at bottom
- [ ] Adjust tracker navbar container height to support a 320 px minimum width
```

---

## 📊 Pocket Detail and Category Budget Detail

### ✅ LISTO (2/2)
```
- [x] Review pocket detail for accounting view detail and budget pocket, where pocket saving data was not rendering
- [x] Fix category detail so it receives the correct data structure from the server
```
---

## ✏️ Editing and Deleting

### ✅ LISTO (9/10)
```
- [x] Establish a strategy for editing and deleting data
- [x] Define which fields are editable and their database interrelationships
- [x] Implement reverse transfers for expense and income accounts to support manual corrections
- [x] Implement simple editing of account data only, not transactions
- [x] Develop centralized account detail views and account editing in the Accounting Dashboard
- [x] Apply real-time validation to all editable fields, including text areas and numeric inputs
- [x] Limit input length visually and functionally across all edit forms
- [x] Develop account deletion
- [x] Implement retrospective total annulment as the deletion strategy for accounts and transactions
```

### 🔄 PENDIENTE (1/10)
```
- [ ] Optimize AccountDeletionPage using useReducer instead of a centralized useMemo-based modal state
```

---

## ⚖️ Logic and Business Rules

### ✅ LISTO (5/16)
```
- [x] Correct debt movement presentation in the overview so it appears in descending date and time order
- [x] Fix lend and borrow logic and order movements by date
- [x] Complete the net worth calculation
- [x] Review whether the monthly average saving calculation should include investment accounts
- [x] Block future dates in the date selector for transactions and pocket creation
```

### 🔄 PENDIENTE (11/16)
```
- [ ] Correct the order of transactions so withdraw appears before received or deposit
- [ ] Define the net worth calculation with the client, including whether assets and liabilities are included
- [ ] Define whether Pocket Savings amounts are separate accounts or distributed among other accounts
- [ ] Implement a new structure for categories and subcategories
- [ ] Clarify the calculation of the total investment balance with the client
- [ ] Review the investment balance calculation using invested capital versus actual balance
- [ ] Establish business rules for date consistency across transactions and account creation
- [ ] Review whether the initial account amount error still appears when there are no transactions
- [ ] Fix the bug where expense accounts with more than 25 characters create a blank category
- [ ] Define whether the user should remain logged in while the refresh token is valid
- [ ] Review the business rule for multicurrency balances in Fintrack
```

---

## 🎨 Frontend and UI/UX

### ✅ LISTO (2/12)
```
- [x] Review why multiple identical toasts are rendered
- [x] Add the "no option" placeholder to selectors when no data is available
```

### 🔄 PENDIENTE (10/12)
```
- [ ] Improve error messages so they are clearer to the user
- [ ] Standardize and improve transaction descriptions
- [ ] Fix the `% Profit` calculation that displays NaN
- [ ] Reset toast messages and clear variables after form submission
- [ ] Add loading indicators to forms
- [ ] Fix toast colors according to the type of message or error
- [ ] Adjust the detailed account page so the back arrow and edit menu are separated from the title
- [ ] Review the validation and cleanup behavior of NewAccount form fields
- [ ] Review the validation and cleanup behavior of NewCategory account creation
- [ ] Fix the starting amount error when there are no transactions
```

---

## 📤 Data and Export

### ✅ LISTO (0/1)
```
None
```

### 🔄 PENDIENTE (1/1)
```
- [ ] Enable export of movements to PDF, Excel, Google sheet and CSV
```

---

## 📈 Accounts and Overview

### ✅ LISTO (9/9)
```
- [x] List all accounts in Accounting, including income, expense, debtors, investment, bank, and pocket
- [x] Implement pages for account details
- [x] Show account balances in dropdowns
- [x] Implement refetch to update balances
- [x] Fix bugs when creating accounts
- [x] Include investment movements in the overview
- [x] Include deposits and withdrawals in the PnL tracker
- [x] Correct the issue where account details were not updating after transactions
- [x] Fix the issue where new debtor profiles did not refresh bank balances immediately
```

### 🔄 PENDIENTE (0/9)
```
None
```

---

## 📊 PnL Tracker | Debts | Categories | Database | Investment

