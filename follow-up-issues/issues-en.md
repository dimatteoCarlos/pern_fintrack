```md
# Fintrack Backlog

## Authentication
- Sign out redirects to Sign In instead of the main menu. LISTO
- Review cross-field validation between password, new password, and confirm password in the frontend. LISTO
- Review responsiveness of authentication forms: Sign In, Sign Up, Update User Data, and Change Password. LISTO
- Review real-time validation in Sign Up for the password and confirmPassword fields. LISTO
- Complete authentication with refresh token support. LISTO
- Validate the target amount when creating a pocket account. LISTO
- Verify refresh token authentication and automatic refresh logic. LISTO
- Investigate why the session expires even when a refresh token exists and should have been updated. PENDIENTE
- Define how to keep the user signed in while the refresh token remains valid. PENDIENTE
- Define and apply an authorization roles scheme. PENDIENTE
- Review UX/UI of authentication forms. LISTO
- Review navigation behavior in authentication flows. LISTO

## Backend and Security
- Organize cookie and token duration rules. PENDIENTE
- Verify user authentication and userId access control before allowing main app functions. LISTO
- Adjust the backend so transaction searches prioritize account_id instead of account_name. LISTO
- Review how numeric amounts are stored in the database and why some values are returned as strings. PENDIENTE
- Review the timestamp offset issue in transfer-between-accounts transactions. PENDIENTE
- Minimize backend console.logs. LISTO
- Define a multicurrency strategy for keeping balances in Fintrack. PENDIENTE

## General
- Define the deployment process. PENDIENTE
- Verify dynamically unused or broken components. LISTO

## Transfer
- Review responsiveness in Transfer when adding a line in To:, especially under 450 px width. LISTO
- Make Transfer responsive without scroll for a 360 x 700 px layout. LISTO
- Support screens under 700 px height with internal scroll in `cards_presentation--tracker` and a fixed main navbar container. PENDIENTE
- Adjust tracker navbar container height to support a 320 px minimum width. PENDIENTE
- Correct the media query styles for To: and reduce the font size of From and To labels. LISTO
- Review the full transfer flow. LISTO
- Fix the inter-account transfer error. LISTO

## Pocket Detail and Category Budget Detail
- Review pocket detail for accounting view detail and budget pocket, where pocket saving data was not rendering. LISTO
- Fix category detail so it receives the correct data structure from the server. LISTO

## Editing and Deleting
- Establish a strategy for editing and deleting data. LISTO
- Define which fields are editable and their database interrelationships. LISTO
- Implement reverse transfers for expense and income accounts to support manual corrections. LISTO
- Implement simple editing of account data only, not transactions. LISTO
- Develop centralized account detail views and account editing in the Accounting Dashboard. LISTO
- Apply real-time validation to all editable fields, including text areas and numeric inputs. LISTO
- Limit input length visually and functionally across all edit forms. LISTO
- Develop account deletion. LISTO
- Implement retrospective total annulment as the deletion strategy for accounts and transactions. LISTO
- Optimize AccountDeletionPage using useReducer instead of a centralized useMemo-based modal state. PENDIENTE

## Logic and Business Rules
- Correct the order of transactions so withdraw appears before received or deposit. PENDIENTE
- Correct debt movement presentation in the overview so it appears in descending date and time order. LISTO
- Fix lend and borrow logic and order movements by date. LISTO
- Complete the net worth calculation. LISTO
- Define the net worth calculation with the client, including whether assets and liabilities are included. PENDIENTE
- Define whether Pocket Savings amounts are separate accounts or distributed among other accounts. PENDIENTE
- Implement a new structure for categories and subcategories. PENDIENTE
- Clarify the calculation of the total investment balance with the client. PENDIENTE
- Review whether the monthly average saving calculation should include investment accounts. LISTO
- Review the investment balance calculation using invested capital versus actual balance. PENDIENTE
- Establish business rules for date consistency across transactions and account creation. PENDIENTE
- Block future dates in the date selector for transactions and pocket creation. LISTO
- Review whether the initial account amount error still appears when there are no transactions. PENDIENTE
- Fix the bug where expense accounts with more than 25 characters create a blank category. PENDIENTE
- Define whether the user should remain logged in while the refresh token is valid. PENDIENTE
- Review the business rule for multicurrency balances in Fintrack. PENDIENTE

## Frontend and UI/UX
- Improve error messages so they are clearer to the user. PENDIENTE
- Standardize and improve transaction descriptions. PENDIENTE
- Fix the `% Profit` calculation that displays NaN. PENDIENTE
- Reset toast messages and clear variables after form submission. PENDIENTE
- Add loading indicators to forms. PENDIENTE
- Fix toast colors according to the type of message or error. PENDIENTE
- Review why multiple identical toasts are rendered. LISTO
- Adjust the detailed account page so the back arrow and edit menu are separated from the title. PENDIENTE
- Add the "no option" placeholder to selectors when no data is available. LISTO
- Review the validation and cleanup behavior of NewAccount form fields. PENDIENTE
- Review the validation and cleanup behavior of NewCategory account creation. PENDIENTE
- Fix the starting amount error when there are no transactions. PENDIENTE

## Data and Export
- Enable export of movements to PDF, Excel, and CSV. PENDIENTE

## Accounts and Overview
- List all accounts in Accounting, including income, expense, debtors, investment, bank, and pocket, as a centralized editing and deletion hub. LISTO
- Implement pages for account details. LISTO
- Show account balances in dropdowns. LISTO
- Implement refetch to update balances. LISTO
- Fix bugs when creating accounts. LISTO
- Include investment movements in the overview. LISTO
- Include deposits and withdrawals in the PnL tracker. LISTO
- Correct the issue where account details were not updating after transactions. LISTO
- Fix the issue where new debtor profiles did not refresh bank balances immediately. LISTO

## PnL Tracker
- Fix the PnL frontend. LISTO
- Include deposits and withdrawals in the PnL tracker. LISTO
- Correct the issue where the validation message appeared too early after reload. LISTO

## Debts
- Adjust debt logic to use only bank accounts. LISTO
- Fix borrow functionality in debt creation. LISTO
- Refine debt tracker behavior for invalid amount correction and empty amount submission. LISTO
- Reflect debtors' first and last names with capitalized initials. LISTO

## Categories
- Implement the category list. LISTO
- Implement a new structure for categories and subcategories. PENDIENTE

## Toasts and Notifications
- Use Toastify for user messages. LISTO
- Reset toast messages after form submission. PENDIENTE

## Database and Time
- Adjust the database for time zones and queries. LISTO
- Fix the updated_at issue. LISTO
- Establish the rule for future-dated transactions and account creation dates. PENDIENTE

## Investment
- Clarify the total investment balance calculation with the client. PENDIENTE
- Review the investment balance calculation using capital invested versus real balance. PENDIENTE

## Resolved by Design Decision
- Implement PnL in Fintrack. LISTO
- Fix expenses not being reflected in summaries. LISTO
- Standardize styles. LISTO
- Fix fund restrictions. LISTO
- Ensure sign consistency for the starting amount. LISTO
- Correct error messages and zero-value summaries. LISTO
- Apply debounce to textareas. LISTO
- Disable the save button during loading. LISTO
- Minimize backend console.logs. LISTO
- Add the "no option" placeholder to selectors. LISTO
```
