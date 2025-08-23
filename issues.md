 Pending Issues and Unresolved Queries
1. Functionality and Business Logic
Clarify the concept of Net Worth with the client and confirm if its calculation should include assets (bank, investments) and liabilities (debts).

Define the handling of Pocket Savings and whether their amounts are separate accounts or distributed among bank and investment accounts.

Implement a new structure for managing categories and subcategories.

Determine the strategy for editing and deleting data, including which fields are editable and how to handle database interrelations.

Implement the export of movements and transactions in PDF, Excel, and .csv formats.

Clarify the calculation of the total investment balance.

Define if a detail page should be created for income accounts.

2. Backend and Security
Correct the income tracker error where source or destination accounts are not found.

Calculate the values of investment accounts (invested capital vs. factual balance).

Implement user authentication and verify the userId before allowing access.

Determine if a slack account should be created for balance when a bank account is created.

3. Frontend and UI/UX
Improve error handling so that messages to the user are clearer.

Fix the % Profit calculation that shows NaN.

Establish a rule to block future dates in the date picker for transactions and pocket creation.

Review the account starting amount error when there are no transactions.

Implement the reset of toast messages and clearing of variables after form submission.

Add loading indicators to forms.

Improve and standardize transaction descriptions.

✅ Resolved Issues (LISTO)
Fixing the validation of numbers and values across all trackers. listo.

Implementing real-time validation for selection dropdowns. listo.

Correcting the lend and borrow logic and ordering movements by date. listo.

Completing the net worth calculation. listo.

Using toastify for user messages. listo.

Implementing the category list. listo.

Creating the endpoints and controllers for fetching accounts by category on the backend. listo.

Implementing the frontend routes and components for category and account views. listo.

Adjusting the database for time zone handling and fixing movement queries. listo.

Including PnL in the fintrack and its backend. listo.

Fixing the PnL frontend to send the correct account type in the body. listo.

Displaying account balances in the dropdowns. listo.

Implementing a refetch to update account balances after a form submission. listo.

Fixing bugs in creating Income, Pocket, Debtor, and Investment accounts. listo.

Implementing Account Detail, Investment Detail, Debtor Detail, and Pocket Detail. listo.

Including deposits and withdrawals to Bank and Investment accounts in the PnL tracker. listo.

Correcting validation so form data is not erased. listo.

Fixing transaction description errors. listo.

Adjusting debt tracker logic to only work with bank accounts. listo.

Ensuring consistency in the sign criterion for the start account amount. listo.

Fixing the updated_at issue. listo.

Applying debounce to textareas. listo.

Disabling the save button on forms during loading. listo.

Correcting error messages in the tracker and summary for zero values. listo.

Fixing transfers between bank and category budget accounts. listo.

Adjusting endpoints and type handling in overview. listo.

Including investment movements in the overview list. listo.

Reviewing the monthly avg saving calculation. listo.

Fixing the borrow functionality in debt creation. listo.

Fixing the fund restriction when creating a debtor profile. listo.

Fixing expenses that were not reflected in summaries. listo.

Standardizing the styles of bigBoxResult. listo.

Minimizing backend console.logs. listo.

Adding the "no option" placeholder to account selectors. listo.
