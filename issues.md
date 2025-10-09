Authentication
check authentication


🚧 Pending Issues and Unresolved Queries
1. Functionality and Business Logic
Editing and Deleting: Establish a strategy for editing and deleting data, defining which fields are editable and how to handle their interrelationships in the database.

Net Worth Calculation: Clarify with the client the definition of Net Worth and whether its calculation should include assets (bank, investments) and liabilities (debts).

Pocket Savings Management: Define whether Pocket Savings amounts are separate accounts or distributed among other accounts.

Category Structure: Implement a new structure to handle categories and subcategories.

Investment Balance: Clarify the calculation for the total investment balance.

Data Export: Enable the export of movements in formats like PDF, Excel, and .csv.

Income Detail Page: Define if a detail page should be created for income accounts.


2. Backend and Security
Income Tracker Error: Correct the error that prevents the income tracker from finding source or destination accounts.

Investment Calculation: Calculate the values of investment accounts, comparing invested capital with the factual balance.

User Authentication: Implement user authentication and verify the userId before allowing access to the main functions.

Slack Account: Define if a slack account should be created for balance when a bank account is created with an initial amount.


3. Frontend and UI/UX
Error Handling: Improve error messages to be clearer to the user.

% Profit Calculation: Fix the calculation that displays NaN.

Date Validation: Block future dates in the date selector for transactions and pocket creation.

Starting Amount Error: Review the account starting amount error when there are no transactions.

Forms: Implement the resetting of toast messages and clearing of variables after form submission.

Loading Indicator: Add a loading indicator to forms.

Transaction Descriptions: Standardize and improve transaction descriptions.


✅ Resolved Activities (LISTO)
Validate numbers and values in the trackers. listo.

Perform real-time validation for dropdowns. listo.

Correct the lend and borrow logic and order movements by date. listo.

Complete the net worth calculation. listo.

Use toastify for user messages. listo.

Implement the category list. listo.

Create backend endpoints and controllers. listo.

Implement frontend routes and components. listo.

Adjust the database for time zones and queries. listo.

Include PnL in the fintrack. listo.

Fix the PnL frontend. listo.

Display account balances in dropdowns. listo.

Implement refetch to update balances. listo.

Fix bugs when creating accounts. listo.

Implement account detail pages. listo.

Include deposits and withdrawals in the PnL tracker. listo.

Correct validation so data isn't erased. listo.

Fix transaction description errors. listo.

Adjust debt logic to use only bank accounts. listo.

Ensure sign consistency for the starting amount. listo.

Fix the updated_at issue. listo.

Apply debounce to textareas. listo.

Disable the save button during loading. listo.

Correct error messages and zero-value summaries. listo.

Fix the inter-account transfer error. listo.

Adjust endpoints and type handling in overview. listo.

Include investment movements in the overview. listo.

Review the monthly avg saving calculation. listo.

Fix the borrow functionality in debt creation. listo.

Fix fund restrictions. listo.

Fix expenses not reflecting in summaries. listo.

Standardize styles. listo.

Minimize backend console.logs. listo.

Add the "no option" placeholder to selectors, in case there is no data available as options to select . listo.

