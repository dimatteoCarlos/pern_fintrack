# Fintrack Backlog

> **Re-measured 2026-09-06 on branch `main`, head `20de666d`.** Every item below
> that changed state was checked against the working tree that day, and the file
> and line that prove it are quoted in parentheses. An audit carries a date
> because it is a measurement, not a state.
>
> **What was NOT re-measured, and must not be read as measured:**
>
> - Items already marked LISTO before this pass were not re-audited one by one.
>   Three were found false while checking something else and are corrected below;
>   the rest carry their previous state unverified.
> - Nothing was checked in a running browser. No form was submitted, no screen
>   was resized, no session was left to expire. Every item whose proof is visual
>   or interactive stays PENDIENTE with the check a human still owes it.
> - No database was read, local or remote, and the application was never started.
>   Items about stored column types, timestamp offsets and production stability
>   are unverifiable from source alone and stay PENDIENTE.
> - Nothing was measured on any branch other than `main`. Findings that live on
>   `feat/overview`, `feat/vercel-serverless` or any other head are out of scope
>   for this pass.
> - `backend/src` and `frontend/src` were swept for `TODO`, `FIXME`, `HACK` and
>   `XXX` comment markers. **There are none** — zero matches in either tree — so
>   that sweep contributed no items.
>
> Counts by group are in `summary-issues.md`; the long-form Spanish list is in
> `ISSUES-es-updated.md`. The three files describe the same list and are
> consistent as of this date.

---

## Authentication — 11 LISTO / 5 PENDIENTE

- Sign out redirects to Sign In instead of the main menu. LISTO
- Review cross-field validation between password, new password, and confirm password in the frontend. LISTO
- Review responsiveness of authentication forms: Sign In, Sign Up, Update User Data, and Change Password. LISTO
- Review real-time validation in Sign Up for the password and confirmPassword fields. LISTO
- Complete authentication with refresh token support. LISTO
- Validate the target amount when creating a pocket account. LISTO
- Verify refresh token authentication and automatic refresh logic. LISTO
- Review UX/UI of authentication forms. LISTO
- Review navigation behavior in authentication flows. LISTO
- The in-memory authentication flag drifting apart from the token in storage. **LISTO** — one function now clears both together and is the only path that clears either (`frontend/src/auth/auth_utils/invalidateSession.ts:29-55`), and the session bootstrap revalidates the stored token against the server on every mount, calling that function when it fails (`frontend/src/auth/hooks/useAuth.ts:170-229`).
- An expired token silently failing a request instead of ending the session. **LISTO for a 401** — the request retries once behind a single-flight refresh (`frontend/src/auth/auth_utils/authFetch.ts:56-96`), a failed refresh saves the return address and invalidates the session (`frontend/src/auth/auth_utils/authRefreshManager.ts:59-69`), and the route guard redirects to the auth screen carrying the expiry reason (`frontend/src/auth/components/protectedRoute/ProtectedRoute.tsx:40-53`).
- Investigate why the session expires even when a refresh token exists and should have been updated. PENDIENTE — **the mechanism is now measured, the symptom is not.** The refresh cookie is written with no `maxAge` and no `expires` (`backend/src/utils/authUtils/cookieConfig.js:10-15`), so it is a session cookie and dies when the browser closes, while the token inside it is signed for 8.9 days (`backend/src/utils/authUtils/authFn.js:95-98`). *Human check: close the browser, reopen it, and confirm the session is gone while the token is still valid.*
- Define how to keep the user signed in while the refresh token remains valid. PENDIENTE — blocked by the same missing cookie lifetime above, and by a product decision on how long "remembered" should mean.
- Define and apply an authorization roles scheme. PENDIENTE — **defined but never applied.** A role ladder, an admin guard and a dynamic authorization factory all exist (`backend/src/auth_api/middlewares/authMiddleware.js:228-294`), and **no route file imports any of them**; every guarded route uses only token verification or ownership.
- A forbidden response does not end the session. PENDIENTE — the retry branch tests the status code for 401 only (`frontend/src/auth/auth_utils/authFetch.ts:58`), so a 403 falls through to the generic throw and leaves the stale session in place.
- Session management across several sessions of one user, several users, and several devices. PENDIENTE — design decision, never taken.

## Backend and Security — 4 LISTO / 3 PENDIENTE

- Verify user authentication and userId access control before allowing main app functions. LISTO
- Adjust the backend so transaction searches prioritize account_id instead of account_name. LISTO
- Minimize backend console.logs. LISTO
- Define a multicurrency strategy for keeping balances in Fintrack. **LISTO** — one accounting currency is stored and six currencies are accepted at the edge; the accepted set is declared once on the server (`backend/src/fintrack_api/services/fx_services/core/fxConfig.js:40`) and mirrored on the client (`frontend/src/fintrack/helpers/currencyConstants.ts:22-29`), with the currency the user sends kept as origin-only exchange metadata.
- Organize cookie and token duration rules. PENDIENTE — the cookie helper sets flags but **no lifetime at all** (`backend/src/utils/authUtils/cookieConfig.js:8-23`), and the durations live in four places whose comments contradict their values: access token 1h (`backend/src/utils/authUtils/authFn.js:59-62`), refresh token 8.9d (`:95-98`), and a response field of 3600 seconds labelled "60 minutos" in one endpoint (`backend/src/auth_api/controllers/authController.js:192`) and "15 minutos" in two others (`:335`, `backend/src/auth_api/controllers/authRefreshToken.js:112`).
- Review how numeric amounts are stored in the database and why some values are returned as strings. PENDIENTE — **no type parser is registered anywhere in `backend/src`**, so the driver's default applies and `numeric` arrives as a string. *Human check: read the column types in the database and decide whether the string is the wanted behaviour, since the money arithmetic uses a decimal library that prefers it.*
- Review the timestamp offset issue in transfer-between-accounts transactions. PENDIENTE — *human check: read a stored row and compare its timestamp with the moment the transfer was made.* Not verifiable from source.

## General — 2 LISTO / 2 PENDIENTE

- Verify dynamically unused or broken components. LISTO — done with `npx knip` for the frontend.
- Adapt the backend to run serverless and deploy it. LISTO — the serverless build is declared in `backend/vercel.json`.
- Backend stability on the deployed platform. PENDIENTE — *human check: measure it in production.* Not observable from source.
- A component-analysis tool that also covers the backend. PENDIENTE — no `knip` configuration file and no `knip` dependency in any `package.json` in the repository, so nothing is pinned for a repeat run.

## Transfer — 6 LISTO / 1 PENDIENTE

- Review responsiveness in Transfer when adding a line in To:, especially under 450 px width. LISTO
- Make Transfer responsive without scroll for a 360 x 700 px layout. LISTO
- Correct the media query styles for To: and reduce the font size of From and To labels. LISTO
- Review the full transfer flow. LISTO
- Fix the inter-account transfer error. LISTO
- Support screens under 700 px height with internal scroll in the tracker card. **LISTO** — the card takes a viewport-derived maximum height and its own vertical scroll below 701 px (`frontend/src/fintrack/pages/tracker/styles/tracker-style.css:728-741`).
- Adjust tracker navbar container height to support a 320 px minimum width. PENDIENTE — the narrowest width query in the tracker stylesheet is 370 px and it only shrinks a chip label's font size (`frontend/src/fintrack/pages/tracker/styles/tracker-style.css:631-635`); nothing addresses 320 px.

## Pocket Detail and Category Budget Detail — 2 LISTO / 0 PENDIENTE

- Review pocket detail for accounting view detail and budget pocket, where pocket saving data was not rendering. LISTO
- Fix category detail so it receives the correct data structure from the server. LISTO

## Editing and Deleting — 9 LISTO / 1 PENDIENTE

- Establish a strategy for editing and deleting data. LISTO
- Define which fields are editable and their database interrelationships. LISTO
- Implement reverse transfers for expense and income accounts to support manual corrections. LISTO
- Implement simple editing of account data only, not transactions. LISTO
- Develop centralized account detail views and account editing in the Accounting Dashboard. LISTO
- Apply real-time validation to all editable fields, including text areas and numeric inputs. LISTO
- Limit input length visually and functionally across all edit forms. LISTO
- Develop account deletion. LISTO
- Implement retrospective total annulment as the deletion strategy for accounts and transactions. LISTO
- Optimize the account deletion page using a reducer instead of a centralized memoized modal state. PENDIENTE — confirmed still open by absence: **`useReducer` appears nowhere in `frontend/src`.**

## Account editor register — 3 LISTO / 8 PENDIENTE

> **Origin, and why these are here.** These eleven were measured on 2026-08-20 and
> lived only in `plan-docs/on-hold/PLAN_EDIT_BLOCK/PLAN_EditAccount.md`, section
> "U4 — the register". **Git does not track that file** — `plan-docs/*` is
> ignored — so a folder deletion would have destroyed the only copy. They are
> carried here verbatim in substance, re-measured on 2026-09-06, with the line
> numbers as they stand today; where an anchor had drifted the current one is
> given and the drift noted. Their internal labels (E-1 … E-11) are kept only as
> a back-reference to that document.

- **A null column makes the whole account uneditable (E-1).** 🔴 Alta. PENDIENTE. The loader copies any value that is not `undefined` into form state, so a database `NULL` arrives as `null` (`frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx:251`). The two schemas the fields use accept only `undefined`, never `null` (`frontend/src/fintrack/editionAndDeletion/validations_zod/commonEditionSchemas.ts:118-123`), and one field error aborts the entire submit rather than that field (`EditAccount.tsx:325-334`). Live nullable columns it reaches: `subcategory` (`backend/src/db/migrations/sql_migrations/002_accounts.sql:150`), `debtor_name` and `debtor_lastname` (`:176-177`). The fix is a decision — make the schemas nullish, or normalise `null` to `undefined` at load.
- **A pocket whose target date has passed could not be edited at all (E-2).** 🔴 Alta. **LISTO** — the pocket left this editor entirely: the type-to-schema map holds no pocket key (`frontend/src/fintrack/editionAndDeletion/validations_zod/editSchemas.ts:64-70`) and the loader records that no date field survives it (`EditAccount.tsx:252-254`). The pocket now has its own screen, which sends only the fields that changed precisely so an untouched overdue deadline is never re-validated (`frontend/src/fintrack/pages/forms/editPocket/EditPocket.tsx:249-253`). **Residue, still open:** the deadline field itself is bounded at today (`EditPocket.tsx:521`), so an overdue deadline cannot be corrected to a past date if the owner touches it.
- **The debtor account name preview disagreed with what the server stores (E-3).** **LISTO** — the client now joins lastname and name with a comma and a space, and the comment records that this is the separator both write paths use (`frontend/src/fintrack/editionAndDeletion/validations_zod/accountEditSchema.ts:175-187`), matching the server (`backend/src/fintrack_api/controllers/accountEditController.js:219`).
- **The amount owed on a debtor is editable nowhere (E-4).** 🟡 Media. PENDIENTE. The column exists (`backend/src/db/migrations/sql_migrations/002_accounts.sql:170`) and is returned by the read endpoint, but the debtor arm of the write endpoint sets only name, lastname and note (`backend/src/fintrack_api/controllers/accountEditController.js:187-191`). The linked account cannot be reassigned either. **Decision needed:** does the amount owed belong to this editor, or only to a transaction?
- **Editing a pocket target leaves its exchange metadata stale (E-5).** 🟡 Media. PENDIENTE. The write endpoint sets the target and touches none of the six exchange columns beside it (`backend/src/fintrack_api/controllers/accountEditController.js:91-92`), which migration 015 declares non-null on the stated grounds that the controller always sends all six. After an edit the figure has changed and its declared origin still describes the previous conversion.
- **The required-field flag validates nothing and disagrees with the schemas (E-6).** 🟢 Baja. PENDIENTE. Its only consumer is the asterisk in the label (`frontend/src/fintrack/editionAndDeletion/pages/editionAccount/UniversalDynamicInput.tsx:256`, drifted from 242). Three disagreements exist: fields marked required whose schema is optional (the asterisk lies), fields not marked required whose schema demands the key, and a field with no asterisk that blocks the save when cleared. **Decision needed:** should the flag validate, or only label?
- **A dead field travels in every save payload (E-7).** 🟢 Baja. PENDIENTE. The account type is appended to the payload with the comment that the controller needs it (`frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx:341-344`); the controller never reads it, resolving the type by querying the row instead. The comment is false.
- **The pocket note lives in two tables and one shadows the other (E-8).** 🟢 Baja. PENDIENTE. The write endpoint sets a note on the shared account row (`backend/src/fintrack_api/controllers/accountEditController.js:59`) and again on the pocket's own row (`:97`); the read endpoint selects both with a star and the second shadows the first by column order. Consistent today only because this endpoint is their sole writer.
- **The budget branch of the account write endpoint became unreachable (E-9).** **LISTO** — the branch is gone and the endpoint now states in writing that a budget key in the payload is ignored, because the amount is a four-part decision owned by the budget endpoint (`backend/src/fintrack_api/controllers/accountEditController.js:104-107`); the frontend key is commented out with the same reason (`frontend/src/fintrack/editionAndDeletion/validations_zod/editSchemas.ts:29-36`).
- **Frontend length caps are tighter than the columns, and one has one character of margin (E-10).** 🟡 Media. PENDIENTE. The account name is capped at 28 characters (`frontend/src/fintrack/validations/utils/constants.ts:4-13`) against a 50-character column, and for a budget account the server derives that name from category, subcategory and nature, whose caps are 10, 10 and 5 — a worst case of 27 with two separators. Widening any of the three makes the editor reject a value it did not write.
- **Three account types receive no currency from the read endpoint (E-11).** 🟡 Media. PENDIENTE. Bank, investment and income-source accounts have identical, empty editable surfaces — the write endpoint has no case for them and they are absent from its table map (`backend/src/fintrack_api/controllers/accountEditController.js:309-313`) — which is correct. The asymmetry is that the currency join is commented out for them in the read endpoint, so any view reading a bank account's currency from it gets `undefined`.
- **Structural finding beside the eleven:** the account write endpoint carries no validation middleware (`backend/src/fintrack_api/routes/accountRoutes.js:104`), so the frontend schema is the only gate on that payload.

## Logic and Business Rules — 5 LISTO / 9 PENDIENTE

- Correct debt movement presentation in the overview so it appears in descending date and time order. LISTO
- Fix lend and borrow logic and order movements by date. LISTO
- Complete the net worth calculation. LISTO
- Review whether the monthly average saving calculation should include investment accounts. LISTO
- Block future dates in the date selector for transactions and pocket creation. LISTO — the shared picker takes an upper bound (`frontend/src/fintrack/general_components/datepicker/Datepicker.tsx:103`), the transaction trigger passes one (`frontend/src/fintrack/general_components/transactionDateTrigger/TransactionDateTrigger.tsx:31,111`) and the month picker bounds itself to the current month (`frontend/src/fintrack/general_components/monthPicker/MonthPicker.tsx:149,193`).
- Correct the order of transactions so withdraw appears before received or deposit. PENDIENTE — design decision, then a database read to confirm the stored order.
- Define the net worth calculation with the client, including whether assets and liabilities are included. PENDIENTE — client decision. A ruling on one divergence exists in the overview plan documents; the general definition is still open.
- Define whether Pocket Savings amounts are separate accounts or distributed among other accounts. PENDIENTE — client decision.
- Implement a new structure for categories and subcategories. PENDIENTE — product decision, then implementation.
- Clarify the calculation of the total investment balance with the client. PENDIENTE — client decision.
- Review the investment balance calculation using invested capital versus actual balance. PENDIENTE — client decision, then a database read.
- Establish business rules for date consistency across transactions and account creation. PENDIENTE — product decision. A backdating window exists in the frontend constants, but no rule forbids a transaction dated before the account it belongs to.
- Review whether the initial account amount error still appears when there are no transactions. PENDIENTE — *human check: create an account with no transactions and read the screen.*
- Fix the bug where an expense account name over 25 characters creates a blank category. PENDIENTE — *human check: submit the over-length name and read the created row.*

## Frontend and UI/UX — 5 LISTO / 11 PENDIENTE

- Review why multiple identical toasts are rendered. LISTO
- Add the "no option" placeholder to selectors when no data is available. LISTO
- Fix toast colors according to the type of message or error. **LISTO** — a helper maps the response status range to a toast type and a background colour, success, error, warning and info (`frontend/src/fintrack/helpers/showToastByStatus.ts:10-15`), consumed by the shared message component and the pocket allocation modal.
- Fix the profit percentage that displayed a non-number. **LISTO** — the divisor is guarded and the percentage defaults to zero when the invested capital is zero (`frontend/src/fintrack/pages/overview/components/InvestmentAccBalance.tsx:100-117`). **Residue:** the guard compares strictly against the number zero, so if the API returns the amount as the string `'0.00'` — see the open item on numeric values arriving as strings — the guard misses and the division yields infinity instead.
- Limit the number of characters when creating a budget category account. **LISTO** — the four name inputs carry the shared caps (`frontend/src/fintrack/pages/forms/newCategory/NewCategory.tsx:479,496,515,532`).
- Improve error messages so they are clearer to the user, and standardize the handling so it is reusable. PENDIENTE
- Standardize and improve transaction descriptions. PENDIENTE — to the user's taste.
- Reset toast messages and clear variables after form submission. PENDIENTE — *human check, per form.* The mutation hook itself is sound: it always drops the loading flag in its `finally` and exposes a reset that clears data, error and failure together (`frontend/src/fintrack/hooks/useFetchLoad.ts:137-151`).
- Add loading indicators to forms. PENDIENTE — *human check, per form.* Several detail screens already read a loading flag; no sweep confirms every form does.
- Adjust the detailed account page so the back arrow and edit menu are separated from the title. PENDIENTE — *human check: look at the screen.*
- Review the validation and cleanup behavior of the new-account form fields. PENDIENTE — *human check: fill the form, trip a validation error, change the account type, and see whether the message clears.*
- Eight design tokens are consumed but defined nowhere. PENDIENTE — a colour pair misspelt twice in the overview stylesheet (`frontend/src/fintrack/pages/overview/styles/overview-styles.css:284-285`), a font size and a line height in the main navbar (`frontend/src/fintrack/general_components/mainNavbar/styles/mainNavbar.css:135-136`), and four spacing steps in the shared page styles (`frontend/src/fintrack/pages/styles/generalStyles.css:63,67,71,75`). Each resolves to nothing at runtime.
- Fourteen rule blocks declare the same property twice. PENDIENTE — measured across the 80 stylesheets in `frontend/src`; two of them sit in the same file on the same selector under two identical height queries (`frontend/src/fintrack/pages/tracker/styles/tracker-style.css:728-741` and `:743-749`, both setting the card's vertical overflow).
- The system colour-scheme query is inverted. PENDIENTE — the block is headed "dark mode support" and asks for `prefers-color-scheme: light`, then fills it with dark values (`frontend/src/fintrack/editionAndDeletion/pages/deletionAccount/UIComponents/accountDetailsUI/accountDetailsUI.css:163-190`), so a reader on a light system gets the dark panel and a reader on a dark system gets nothing.
- Fifty-nine declarations carry `!important` across the frontend stylesheets. PENDIENTE — the project style rules forbid it outright.
- The toast helper hardcodes four colour literals. PENDIENTE — `frontend/src/fintrack/helpers/showToastByStatus.ts:11-14` writes hex values and a white text colour inline instead of consuming tokens.

## Locale and money formatting — 0 LISTO / 4 PENDIENTE

- **The money formatter's default currency cannot be found in the currency catalog.** PENDIENTE — the default is written in upper case (`frontend/src/fintrack/helpers/functions.ts:39`) while every key in the catalog is lower case (`frontend/src/fintrack/helpers/currencyConstants.ts:22-58`), so a lookup made with that value returns `undefined` and the number formatter falls back silently to the locale of the machine it runs on. Silently is the whole defect: nothing throws and the figure still prints.
- **Fifteen live uses of a Spanish locale label in eleven frontend files, with the interface in English.** PENDIENTE — the full site-by-site list is in `plan-docs/ongoing/PLAN_FX_DISPLAY.md`, section 2. They cluster in the conversion previews and the exchange audit card, which name a locale that is neither the reader's nor the currency's.
- **The two date-format constants disagree about which language the interface speaks.** PENDIENTE — one is a Spanish locale and the other an English one (`frontend/src/fintrack/helpers/constants.ts:81-86`); the second carries a written reason for the split, the first does not.
- **A code comment points at a line range that no longer holds what it claims.** PENDIENTE — the note in the tracker's top card cites the constants file at lines 57 to 59 (`frontend/src/fintrack/pages/tracker/components/TopCard.tsx:213`); the constant it describes now lives at lines 83 to 86.

## Data and Export — 0 LISTO / 1 PENDIENTE

- Enable export of movements to PDF, Excel, Google Sheets and CSV. PENDIENTE — confirmed still open by absence: **no PDF, spreadsheet or CSV library appears in any `package.json` in the repository.**

## Accounts and Overview — 9 LISTO / 1 PENDIENTE

- List all accounts in Accounting, including income, expense, debtors, investment, bank, and pocket, as a centralized editing and deletion hub. LISTO
- Implement pages for account details. LISTO
- Show account balances in dropdowns. LISTO
- Implement refetch to update balances. LISTO
- Fix bugs when creating accounts. LISTO
- Include investment movements in the overview. LISTO
- Include deposits and withdrawals in the PnL tracker. LISTO
- Correct the issue where account details were not updating after transactions. LISTO
- Fix the issue where new debtor profiles did not refresh bank balances immediately. LISTO
- **A pocket's committed total was counted twice in the overview net worth.** FIXED 2026-09-06, in two commits and in that order — the headline added the pocket balance to bank, investment and debt for net worth and again for the cash position, reading it over the retired pocket account type. The bank balance already contained that money: the allocation guard's ceiling is balance minus already-allocated, which only holds if the committed amount sits inside the balance (`backend/src/fintrack_api/services/pocket_services/services/pocketAllocationService.js:345-347`). **The read was deleted, not re-pointed** (`f4b999d9`), and that deletion was the guard that made the re-point safe: the double count summed to zero only because the retired type returned no accounts, so it would have gone live the instant the read was re-pointed. Everything else then moved to the plan model (`f0388039`) — the card composes its figures from `pocketBoardService`, three new temporal reads serve the series, the monthly snapshot and the month's allocation list, and the saving goals widget was re-pointed at the same ledger and given the reference month it never had. The reasoning is in `plan-docs/ongoing/OVERVIEW_PLAN/PLAN_OVERVIEW_RECOVERY.md`, stage P2.
- **The three hero figures decided whether they were numbers by testing the wrong variable.** FIXED 2026-09-06 (`d75b4709`) — the expense row tested the income total (`frontend/src/fintrack/pages/overview/OverviewLayout.tsx:186-190`), so a broken expense printed as real money and a valid expense blanked whenever income broke. The zero fallback on the same line went with it: these three rows are the user's own money, and printing 0 for a request that never answered states they hold nothing, which is a different claim from not knowing. The figure now travels as null and `BigBoxResult` renders a dash, per the rule that loading, error and empty are three distinct states and none of them is a number.

## PnL Tracker — 3 LISTO / 0 PENDIENTE

- Fix the PnL frontend. LISTO
- Include deposits and withdrawals in the PnL tracker. LISTO
- Correct the issue where the validation message appeared too early after reload. LISTO

## Debts — 4 LISTO / 0 PENDIENTE

- Adjust debt logic to use only bank accounts. LISTO
- Fix borrow functionality in debt creation. LISTO
- Refine debt tracker behavior for invalid amount correction and empty amount submission. LISTO
- Reflect debtors' first and last names with capitalized initials. LISTO

## Categories — 1 LISTO / 0 PENDIENTE

- Implement the category list. LISTO

## Toasts and Notifications — 1 LISTO / 0 PENDIENTE

- Use Toastify for user messages. LISTO

## Database and Time — 2 LISTO / 0 PENDIENTE

- Adjust the database for time zones and queries. LISTO
- Fix the updated_at issue. LISTO

## Resolved by Design Decision — 10 LISTO / 0 PENDIENTE

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

---

## Totals after the 2026-09-06 pass

**123 items — 77 LISTO, 46 PENDIENTE.** Per-group counts are in
`summary-issues.md` and must match this file line for line.
