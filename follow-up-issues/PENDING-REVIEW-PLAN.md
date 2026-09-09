# Pending items — review plan by priority

> **Built 2026-09-09 from the three backlog files in this folder**, which were
> last re-measured on 2026-09-06 over `main`, head `20de666d`. Nothing here was
> re-measured today: this file reorders what those three already record, it does
> not audit the tree again. Every file and line quoted comes from the
> 2026-09-06 pass and may have drifted since.
>
> **Who touched the source files.** The three were rewritten by Claude in two
> commits, `ccc48e8b` (re-measure the defect backlog) and `f34f597e` (close the
> two overview defects), both authored 2026-09-06 by CarlosDR with
> `Co-Authored-By: Claude Opus 5`. No other commit in their history carries a
> Claude co-author line.

## Count

| | as the files read on 2026-09-06 | today |
| :--- | ---: | ---: |
| total items | 123 | 125 |
| LISTO | 77 | 85 |
| **PENDIENTE** | **46** | **40** |

Three corrections got the count here. The closing totals in the three source
files had been left at the figures from before `f34f597e`, which closed two
overview defects without lowering them. Six items closed on 2026-09-09, struck
through below — five by a fix, one by measurement alone. And one defect measured
that day was in no list at all: the rotation threshold, row 3b.

The rows below are every item still marked PENDIENTE, the struck-through ones kept
for the record, plus three open findings that sit inside items marked LISTO and
are therefore not counted anywhere.

**How each closed defect was corrected, with the code before and after, why that
fix was chosen over the alternative, and the lesson it leaves:** `FIXES-LOG.md`,
one entry per correction.

## How the order was set

Five tiers, in the order the work should be taken:

| tier | criterion |
| :--- | :--- |
| **P0** | Wrong behaviour reachable from source today, with no decision and no running app needed. Start here. |
| **P1** | Correctness that cannot be settled without the app running or the database read. One session covers most of them. |
| **P2** | Decisions the client or the product owner owes. Raise them now — some gate P1 work. |
| **P3** | Stylesheet and interface debt, all measured, one sweep. |
| **P4** | Missing features, tooling and refactors. |

Severity marks come from the source files where they exist; where they did not,
the mark states the effect on the user, not the size of the fix. A row marked ⚪
is retired: the code was measured and the defect the row describes is not there.
Retired is not the same as fixed — nothing was changed for it, and the row is
kept struck through so the same claim is not raised a third time.

---

## P0 — Source-fixable correctness (8 open, 5 closed, 2 retired)

| # | item | where | sev |
| :-- | :--- | :--- | :-- |
| ~~1~~ | ~~A `NULL` column makes the whole account uneditable (E-1)~~ — **RESOLVED 2026-09-09** (`36353a96`). Normalised at load, not in the schemas. Code and lesson in `FIXES-LOG.md` | `editionAccount/EditAccount.tsx:251` | 🔴 |
| ~~2~~ | ~~A forbidden response does not end the session~~ — **RESOLVED 2026-09-09** (`2f641f3a`), and **not by the fix this row proposed**: the three broken-token statuses moved to 401 in the backend; widening the client to 403 would have signed out anyone mistyping their current password. Code and lesson in `FIXES-LOG.md` | `authMiddleware.js:21-25`, `:110-113` | 🔴 |
| ~~3~~ | ~~Three sources declared three lifetimes for one refresh token, and the cookie declared none~~ — **RESOLVED 2026-09-09** (`e7804cdd`). `REFRESH_TOKEN_DAYS` is now the only place the number is written; the signature, the row and the cookie read it, and the cookie gained a `maxAge`. Code and lesson in `FIXES-LOG.md` | `authFn.js`; `cookieConfig.js:22` | 🔴 |
| ~~3b~~ | ~~The rotation threshold carried a factor of one thousand too many, so the token rotated on every refresh~~ — **RESOLVED 2026-09-09** (`e7804cdd`), found while measuring row 3 and present in no backlog. Threshold now 16.8 h of a 7-day life | `authRefreshToken.js:86` | 🔴 |
| 4 | ~~The money formatter's default currency is written upper case against an all-lower-case catalog~~ — **the chain this row describes does not exist**, measured 2026-09-09. The upper-case `'USD'` defaults reach only case-insensitive consumers: `currencyFormat` hands the code to `Intl.NumberFormat`, which ignores case in an ISO code; `getCurrencySymbol` upper-cases both sides before comparing (`functions.ts:74`); `isValidCurrencyCode` upper-cases its input against an upper-case set (`functions.ts:257`). No call site indexes the locale map with either default. **Replaced by row 4b, which is the reachable form of the same symptom** | `helpers/functions.ts:39`, `:71`, `:238` | ⚪ |
| ~~4b~~ | ~~The default currency is read from the environment and cast to the lower-case union without being normalised~~ — **RESOLVED 2026-09-09** (`4a840346`), the reachable form of row 4 and the only one there was. An operator setting `VITE_ACCOUNTING_CURRENCY_CODE=USD` made `CURRENCY_OPTIONS[DEFAULT_CURRENCY]` return `undefined` at all 23 sites that index it; the `as CurrencyType` cast is what hid it from the compiler. The value is now lower-cased and checked against `SUPPORTED_CURRENCIES`, so `gbp` is caught by the same guard. Code and lesson in `FIXES-LOG.md` | `helpers/currencyConstants.ts:73-74` | 🟡 |
| 5 | The role ladder, the admin guard and the authorization factory all exist and no route file imports any of them; every guarded route uses only token verification or ownership | `auth_api/middlewares/authMiddleware.js:228-294` | 🟡 |
| 6 | ~~The currency join is commented out for bank, investment and income-source accounts in the read endpoint (E-11)~~ — **not reproducible**, measured 2026-09-09. The file this row cites holds no currency reference in any of its 393 lines, and the account read endpoint joins `currencies` live in every branch: bank and investment (`getAccountController.js:319`), category budget (`:338`), pocket (`:399`), debtor (`:427`). The only commented-out currency join in `backend/src` is in a dashboard query (`dashboardController.js:704`) and belongs to no account read | anchor was `accountEditController.js:309-313`, now the update transaction | ⚪ |
| 7 | Editing a pocket target writes the amount and touches none of the six exchange columns beside it, which migration 015 declares non-null on the grounds that the controller always sends all six (E-5) | `accountEditController.js:91-92` | 🟡 |
| 8 | Frontend length caps are tighter than the columns: the account name is capped at 28 against a 50-character column, and the derived budget name's worst case is 27 — one character of margin (E-10) | `validations/utils/constants.ts:4-13` | 🟡 |
| 9 | Fifteen live uses of a Spanish locale label in eleven frontend files with the interface in English, clustered in the conversion previews and the exchange audit card | site-by-site list in `plan-docs/ongoing/PLAN_FX_DISPLAY.md`, section 2 | 🟡 |
| 10 | The account type is appended to every save payload with a comment saying the controller needs it; the controller never reads it and resolves the type by querying the row (E-7) | `editionAccount/EditAccount.tsx:341-344` | 🟢 |
| 11 | The pocket note is written twice, once on the shared account row and again on the pocket's own row, and the read endpoint's star select lets the second shadow the first (E-8) | `accountEditController.js:59`, `:97` | 🟢 |
| 12 | The two date-format constants disagree about which language the interface speaks; one carries a written reason for the split, the other does not | `helpers/constants.ts:81-86` | 🟢 |
| 13 | A comment cites the constants file at lines 57–59; the constant it describes now lives at 83–86 | `pages/tracker/components/TopCard.tsx:213` | 🟢 |

## P1 — Needs the app running or the database read (10)

| # | item | check owed | sev |
| :-- | :--- | :--- | :-- |
| 14 | No type parser is registered anywhere in `backend/src`, so the driver default applies and `numeric` arrives as a string. **Gates the profit-percentage residue below** | Read the column types and decide whether the string is wanted, since the money arithmetic uses a decimal library that prefers it | 🔴 |
| 15 | An expense account name over 25 characters warns and still creates the account with a blank category | Submit the over-length name and read the created row | 🔴 |
| 16 | The transfer-between-accounts timestamp is four hours ahead of the moment the transfer was made | Read a stored row and compare its timestamp with the real moment | 🟡 |
| 17 | The session expires even though a refresh token exists. **Mechanism fixed 2026-09-09** (`e7804cdd`): the cookie now carries a 7-day `maxAge`. Open only on the check | Close the browser, reopen it, confirm the session is now kept | 🟡 |
| 18 | The initial-amount error on an account with no transactions | Create an account with no transactions and read the screen | 🟡 |
| 19 | Validation messages in the new-account form do not clear | Fill the form, trip a validation error, change the account type, see whether the message clears | 🟡 |
| 20 | Toast messages and variables are not reset after a form submits. The mutation hook itself is sound — it drops the loading flag in its `finally` and exposes a reset that clears data, error and failure together (`hooks/useFetchLoad.ts:137-151`) | Form by form | 🟡 |
| 21 | Loading indicators on forms. Several detail screens read a loading flag; no sweep confirms every form does | Form by form | 🟡 |
| 22 | On the detailed account page the back arrow and the edit menu are not separated from the title | Look at the screen | 🟢 |
| 23 | The tracker navbar does not support a 320 px minimum width; the narrowest query in the sheet is 370 px and only shrinks a chip label (`tracker-style.css:631-635`) | Resize to 320 px | 🟢 |

## P2 — Decisions owed by the client or product (12)

Raise these before the next planning pass. None of them can start as code.

| # | decision | who owes it | sev |
| :-- | :--- | :--- | :-- |
| 24 | The definition of net worth, and whether assets (bank, investment) and liabilities (debt) are both inside it | client | 🔴 |
| 25 | Whether Pocket Savings amounts are separate accounts or distributed among other accounts | client | 🔴 |
| 26 | The calculation of the total investment balance | client | 🟡 |
| 27 | Whether the investment balance uses invested capital or actual balance | client, then a database read | 🟡 |
| 28 | Date-consistency business rules. A backdating window exists in the frontend constants, but no rule forbids a transaction dated before the account it belongs to | product | 🟡 |
| 29 | Whether a withdraw must be ordered before a received or a deposit | product, then a database read | 🟡 |
| 30 | The new structure for categories and subcategories | product | 🟡 |
| 31 | Session management across several sessions of one user, several users, and several devices — never decided | product | 🟡 |
| 32 | How long "keep me signed in" should mean, once the cookie lifetime of item 3 exists | product | 🟡 |
| 33 | Whether the amount owed on a debtor belongs to the account editor or only to a transaction. The column exists (`002_accounts.sql:170`) and the debtor arm of the write endpoint sets only name, lastname and note (`accountEditController.js:187-191`) (E-4) | product | 🟡 |
| 34 | Whether the required-field flag should validate or only label. Its only consumer is the asterisk in the label; three disagreements with the schemas exist, including a field with no asterisk that blocks the save when cleared (`UniversalDynamicInput.tsx:256`) (E-6) | product | 🟢 |
| 35 | The wording standard for transaction descriptions | user's taste | 🟢 |

## P3 — Stylesheets and interface debt (5)

All five measured across the 80 stylesheets in `frontend/src`. One sweep.

| # | item | where | sev |
| :-- | :--- | :--- | :-- |
| 36 | The system colour-scheme query is inverted: the block is headed dark-mode support, asks for `prefers-color-scheme: light` and fills it with dark values, so a light system gets the dark panel and a dark system gets nothing | `deletionAccount/UIComponents/accountDetailsUI/accountDetailsUI.css:163-190` | 🔴 |
| 37 | Eight design tokens consumed and defined nowhere, each resolving to nothing at runtime: a colour pair misspelt twice, a font size and a line height in the main navbar, four spacing steps in the shared page styles | `overview-styles.css:284-285`; `mainNavbar.css:135-136`; `generalStyles.css:63,67,71,75` | 🟡 |
| 38 | Fourteen rule blocks declare the same property twice; two of them sit in the same file on the same selector under two identical height queries | `tracker-style.css:728-741` and `:743-749` | 🟡 |
| 39 | The toast helper writes four colour literals and a white text colour inline instead of consuming tokens | `helpers/showToastByStatus.ts:11-14` | 🟡 |
| 40 | Fifty-nine declarations carry `!important`, which the project style rules forbid outright | frontend stylesheets | 🟢 |

## P4 — Features, tooling and refactors (5)

| # | item | note | sev |
| :-- | :--- | :--- | :-- |
| 41 | Error messages are not clear to the user and the handling is not standardized or reusable | cross-cutting refactor, no measurement yet | 🟡 |
| 42 | Export of movements to PDF, Excel, Google Sheets and CSV | confirmed open by absence: no PDF, spreadsheet or CSV library in any `package.json` in the repository | 🟡 |
| 43 | Backend stability on the deployed platform | the serverless build is declared in `backend/vercel.json`; stability is only measurable in production | 🟡 |
| 44 | A component-analysis tool that also covers the backend | no `knip` configuration file and no `knip` dependency in any `package.json`, so nothing is pinned for a repeat run | 🟢 |
| 45 | Optimize the account deletion page with a reducer instead of a memoized modal state | confirmed open by absence: `useReducer` appears in no file under `frontend/src` | 🟢 |

---

## Open findings hidden inside items marked LISTO

These three are not in the count of 45 because they carry no PENDIENTE line of
their own. Two are residues of a fix that closed most of an item; the third was
recorded beside the account-editor register and never became an item.

| finding | where | why it is still open |
| :--- | :--- | :--- |
| The account write endpoint carries no validation middleware, so the frontend schema is the only gate on that payload | `fintrack_api/routes/accountRoutes.js:104` | Structural, recorded beside the eleven account-editor items and never counted. **Belongs in P0** |
| The profit-percentage guard compares strictly against the number zero, so if the API returns the amount as the string `'0.00'` the guard misses and the division yields infinity | `pages/overview/components/InvestmentAccBalance.tsx:100-117` | Residue of the NaN fix. Depends on item 14 — numeric values arriving as strings. **Belongs in P1** |
| A pocket's overdue target date still cannot be corrected to a past date if the owner touches the field, because the deadline input is bounded at today | `pages/forms/editPocket/EditPocket.tsx:521` | Residue of E-2. The pocket left the shared editor, which closed the block; the bound remained. **Belongs in P1** |

## What this file does not say

- Nothing was re-measured on 2026-09-09. Line numbers are as of 2026-09-06 and
  the tree has moved since — `main` has advanced past `20de666d`.
- Items already marked LISTO before the 2026-09-06 pass were never re-audited
  one by one, so the 79 LISTO is not a verified figure.
- Nothing was measured on any branch other than `main`. Findings living on
  `feat/overview`, `feat/backdating` or any other head are outside this list.
- `backend/src` and `frontend/src` hold zero `TODO`, `FIXME`, `HACK` and `XXX`
  markers, so no item here came from a comment sweep.
