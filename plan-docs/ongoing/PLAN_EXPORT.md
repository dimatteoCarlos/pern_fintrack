# PLAN — FINANCIAL DATA EXPORT AND FINANCIAL REPORT (CSV / XLSX / PDF)

Opened 2026-09-15. Written from a plan-mode draft after the V2 mockup
(`plan-docs/design-refs/period-statement-mockup.html`) was approved by the
developer on 2026-09-15. Commit 0 of the sequence below already landed before
this document existed — see "Commit sequence".

`plan-docs/` is gitignored. Nothing in this file produces a commit.

## 1. Context

- **An unowned open request.** Transaction export has sat pending in
  `follow-up-issues/summary-issues.md:246` and `issues-en.md:171`; no plan in
  `plan-docs/INDEX.md` covered it before this one.
- **What already exists.** The Budget CSV download:
  `GET /api/fintrack/budget/export` (`budgetController.js:202`), backed by
  `backend/src/utils/fintrackUtils/exportUtils.js`.
- **No libraries yet.** No `package.json` in the repo carries CSV, XLSX or PDF
  dependencies; the frontend does not download files today.
- **Boundary with import.** `plan-docs/on-hold/PLAN_DATA_IMPORT.md` is the
  inverse of this plan and remains undefined — its own §14 is its entry point,
  and that entry point is a developer decision, not the closing of another
  block. The two plans meet at exactly one point: the JSON backup dataset (V3
  here), which import's spreadsheet-import track does not touch. Nothing else
  overlaps — import turns a spreadsheet row into the same request body the
  tracker form posts; export turns stored rows and Analytics results into a
  downloaded file. Neither plan's commits depend on the other's.
- **Origin.** This plan folds in three external design reviews; every adopted
  concept is anchored to the code that already satisfies it or to the new piece
  that builds it.

## 2. Architecture: three separate responsibilities

```text
                      FINTRACK
                         |
         +---------------+---------------+
  TRANSACTION DOMAIN               ANALYTICS DOMAIN
  (transactions + catalogs)        (overview_services calculators)
         |                               |
  Transaction Dataset              Report Dataset
         |                               |
    DATA EXPORT                   FINANCIAL REPORT
         +---------------+---------------+
                   REPRESENTATION
                  CSV . XLSX . PDF
```

Cross-cutting all three: authorization, validation, time zone, FX traceability,
data instant, audit.

- **Two products, not one.** The Data Export (V1) delivers exactly what the
  user already sees in `RecentActivity`; the Financial Report (V2) explains
  their financial position for the period. They share writers; each has its
  own contract.

| responsibility | what it does | where it lives |
|---|---|---|
| **Data Export** | transaction rows, one row per `transactions` record | `export_api/db/transactionDatasetRepository.js` |
| **Financial Report** | period aggregates produced by the Analytics Domain | `export_api/services/statementService.js` -> Analytics Domain results |
| **Representation** | turns an already-resolved dataset into bytes | `export_api/core/writers/writeCsv.js`, `writeXlsx.js`, `writePdf.js` |

### Modules

| module | folder | new? | depends on |
|---|---|---|---|
| **Export** | `backend/src/export_api/`, sibling of `auth_api/` and `fintrack_api/` | yes, V1 | `transactions`, catalogs and `utils/fintrackUtils` helpers; V2 also depends on Analytics |
| **Analytics** | `fintrack_api/services/overview_services/{db,core,services}` | no — already exists under another name | domain repositories, `budget_services/core/money.js`, `pocket_services` |
| **Reporting** | `export_api/services/statementService.js` | no — a service inside Export | Analytics + the `transactions` dataset + Export's writers |

- **Dependency direction.** Export -> Analytics -> domain data; Analytics never
  imports Export; `overviewController.js` is Analytics's other consumer.
- **Mounting.** `app.use('/api/export', verifyToken, export_routes)` in
  `app.js`, beside `/api/fintrack` (`app.js:187`). Removing the module is
  deleting that line and the folder.
- **Real independence.** By folder and by route; the data is still FinTrack's.
  Only `core/writers/` imports nothing from FinTrack.
- **Reporting as its own module** — only if it gains its own persistence
  (scheduled reports, a history of generated reports); neither is requested.
- **Precedent.** `auth_api/` is already a sibling folder and still imports
  `fintrack_api/config/fintrackConfig.js` (`authController.js:25`);
  `overviewExpenseService.js:19` imports `budgetCalculationService`.

### Folder layout

```text
backend/src/
├── app.js                                   mounts /api/export
├── auth_api/                                exists
├── fintrack_api/
│   └── services/overview_services/          EXISTS — Analytics module, not renamed
│       ├── db/        read repositories (page, monthly, balance, pocket, investment...)
│       ├── core/      pure calculators (makeHeroSection, makeTrendSeries, make*Analysis...)
│       └── services/  one service per domain, plus page and activity
├── export_api/                              NEW — Export module
│   ├── controllers/
│   │   └── exportController.js
│   ├── routes/
│   │   └── index.js                         GET /movements (V1), GET /statement (V2)
│   ├── middlewares/
│   │   └── exportRateLimiter.js
│   ├── validation/
│   │   └── exportValidators.js
│   ├── db/
│   │   └── transactionDatasetRepository.js
│   ├── core/
│   │   ├── toTransactionDataset.js
│   │   ├── exportFileName.js
│   │   └── writers/                         no FinTrack imports
│   │       ├── writeCsv.js
│   │       ├── writeXlsx.js
│   │       └── writePdf.js                  V2
│   └── services/
│       ├── transactionExportService.js
│       └── statementService.js              V2 — Reporting
└── utils/fintrackUtils/transactionManagement/
    ├── transactionRowShape.js               MOVED from overview_services/db
    └── activityFilters.js                   NEW: ACTIVITY_FILTER, ACTIVITY_READER_FILTER, ACTIVITY_ORDER

backend/test/export/                          NEW: writers, toTransactionDataset, exportValidators

frontend/src/fintrack/helpers/downloadFile.ts NEW, V1
```

- **SQL fragments out of Analytics.** `transactionRowShape.js` and the three
  filters move to `utils/fintrackUtils/transactionManagement/`, beside
  `spentAmountSql.js` and `extractNoteFromDescription.js`, so the Data Export
  never imports `overview_services` (rule 2 below).

### Architecture rules (seven)

| # | rule | how it is kept |
|---|---|---|
| 1 | The exporter carries no financial logic of its own | amounts leave `money.js` already rounded; no `core/` file in export sums or converts |
| 2 | Data Export does not depend on Overview | reads `transactions` through filters moved to a neutral module (commit 1); calls no calculator |
| 3 | The Financial Report consumes the Analytics Domain, not the Overview screen | consumes Analytics results; reuses the calculator that already publishes the official metric (for example `makeHeroSection`) without treating that file as Analytics's interface; no new formula inside `export_api` |
| 4 | A writer only represents | receives `{ columns, rows, meta }`; imports no `pool`, no repository, no catalog |
| 5 | One metric, one implementation | a new metric is added to the Analytics Domain and Overview, the report and export all read it from there |
| 6 | Financial export and backup are different products | different contracts; the JSON backup is V3 |
| 7 | Every export is reproducible, authorized and traceable | deterministic order, `userId` from the token, ids checked against the user, a Metadata sheet, one audit log line |

## 3. Analytics Domain: scope

- **What it is.** The official financial-measurement layer derived from the
  domain. It lives today in `overview_services/services` and
  `overview_services/core`; Overview is its first consumer, not its owner.
- **Input contract.** `userId` from the token, the period window
  (`makeReportingWindow`), an optional analytical scope (today, `category`).
- **Output contract.** Measures, breakdowns, series, comparisons and reasons,
  each carrying `meta.notices` when its value is `null`.
- **No persistence.** Analytics has no tables and writes nothing: it reads
  domain data and produces deterministic results.
- **Not renamed.** Moving the folder to `analytics_services` is out of this
  plan's scope: the report imports the calculators where they already live.
- **Growth.** It can define new metrics once the domain holds the data to
  compute them; it invents no semantics the domain does not already store.
- **Semantics before code.** A new metric first fixes its formula, sign,
  period and null case with a notice, the same way `savingsRateOf`
  (`makeHeroSection.js:135`) returns `null`, never `0`.
- **Zero versus null.** `0` is a known value (this month's income was zero);
  `null` is a figure that does not apply or is not available (a savings rate
  with no income), and it always travels with its notice. No writer converts
  one into the other.

### Analytics layers

```text
                 ANALYTICS DOMAIN
                       |
          +------------+------------+
       Measures   Comparisons   Breakdowns
          +------------+------------+
                       v
                Interpretations         <- V2.1 phase, after V2's metrics close
                       v
          Period Statement Dataset
                  /         \
               XLSX          PDF
```

- **Measures, comparisons, breakdowns** — what Analytics already publishes
  (family table below); V2 consumes them with no added layer.
- **Interpretations** — deterministic, explainable sentences that read
  already-computed measures, for example "Expenses represented 75% of income"
  or "Your net worth increased by $7,950 since January 1".
- **What they do not do.** They query no transactions, implement no formula,
  and generate no free text; if an input measure is `null`, the interpretation
  is not emitted.
- **One place.** They live in Analytics so Overview, the Period Statement and
  any future screen show the same sentence for the same situation.
- **Initial candidates.** Month-over-month change, change since January 1,
  expense-over-income, savings rate, cash committed in pockets versus free
  cash, receivable versus payable, net-worth change, category spend
  concentration.
- **Out of scope.** Recommendations and AI-generated text.

| family | measures already published | where | out until semantics close |
|---|---|---|---|
| Cash flow | income, expenses, `netMonthlyFlow`, `savingsRate`; `yearToDate` of income, expense and pockets | `overviewIncomeService`, `overviewExpenseService`, `makeHeroSection.js:174,219`, `makeMonthlySnapshot.js:78-85,122` | savings-rate average and best/worst month |
| Year cash flow | none published: yearly net flow and savings rate are not published | added in `overview_services/core/makeYearToDateFlow.js` (V2) | — |
| Expense | category ranking and breakdown, analysis | `makeCategoryBreakdown.js`, `makeExpenseAnalysis.js` | recurring expenses |
| Income | total and analysis | `makeIncomeAnalysis.js` | recurring vs. non-recurring |
| Net worth | `netWorth`, `liquidNetWorth`, `cashPosition`, `freeCash` | `makeHeroSection.js:197-216` | assets and liabilities split by class |
| Debts | net position, `payable`, analysis | `overviewDebtService`, `makeDebtAnalysis.js` | aging and overdue |
| Investment | ledger balance, concentration | `overviewInvestmentService`, `makeInvestmentAnalysis.js` | market value, unrealized gain, return |
| Pockets | committed, progress, goals | `overviewPocketService`, `makeFinancialGoals.js` | pace toward the desired date |
| Budget | category execution | `makeCategoryBudgetExecution.js` | variance and forecast |
| Trends | monthly series | `makeTrendSeries.js` | comparison against the same period last year |

## 4. Datasets: semantic contract

A dataset fixes what one row represents, and that decides columns, filters,
order and validation.

| dataset | one row is | phase | source |
|---|---|---|---|
| `transactions` | one `transactions` record | V1 | `transactionDatasetRepository.js` |
| `statement` | one period book/document: summary + movements + balances + metadata | V2 | Analytics Domain + `transactions` dataset |
| `backup` | one FinTrack package with ids, relationships and raw values | V3 | out of this plan |

### `transactions` dataset columns

| column | source | note |
|---|---|---|
| Date | `transaction_local_date` | owner's time zone (`transactionRowShape.js:84`) |
| Transaction ID | `tr.transaction_id` | tie-break and traceability |
| Movement type | `mt.movement_type_name` | the official `movement_types` catalog; no export-local enum |
| Direction | `trt.transaction_type_name` | from the `transaction_types` catalog; the exporter never infers direction |
| Account | `COALESCE(ua.account_name, ar.account_name)` | includes closed accounts |
| Source account / Destination account | `source_account_id` / `destination_account_id` -> name via `account_registry`, with `ar.user_id = $1` in the join condition | empty outside transfers; another user's id resolves to an empty cell, never their name |
| Amount | `tr.amount` | signed, as stored; a numeric cell |
| Currency | `cr.currency_code` | the accounting currency |
| Original amount / Original currency / Exchange rate / Rate source / Rate date | `original_amount`, `original_currency_id`, `exchange_rate`, `exchange_rate_source`, `exchange_rate_timestamp` (`createTables.js:194-199`) | FX traceability; nothing is converted |
| Note | `extractNoteFromDescription(description)` | text |
| Account closed | `account_is_closed` | boolean |

### Semantics closed before coding

- **Amount.** The value stored in `transactions.amount`, signed; negative
  leaves the source account (`dashboardController.js:619-620`). The exporter
  never flips the sign by movement type.
- **Transfers.** One row per stored record; a transfer and its receipt (types
  6 and 7) are two records and export as two rows, each with its own source
  and destination. The exporter represents those two records: it does not
  synthesize the second row or change a sign.
- **Movement types.** The name comes from `movement_types`; a new type appears
  in the export with no module change.
- **Category.** Not a `transactions` column: it is the `category_budget`
  accounts' `categoryName`, and filtering by category means filtering by the
  account ids that category groups (`categoryAccountIds`,
  `overviewExpenseService.js:60`). In V1 it is filter-only: not a movement
  attribute, not an exported column.
- **Date range.** The API takes inclusive `from`/`to` months; the query
  compares on `[start, end)` in the owner's time zone
  (`overviewPageRepository.js:344-345`). Never `23:59:59`.
- **Data instant.** One SQL statement (without the parallel count query) sees
  one consistent state. V1 publishes only `generatedAt`: the instant the
  server generated the file, written to Metadata. `dataAsOf` (the instant the
  read represents) is out of V1; if it is ever needed, it comes from `now()`
  inside the same statement, never the server clock.
- **FX.** V1 converts nothing: the accounting side stores one currency only.
  Rule for when conversion exists: a missing rate is `FX_RATE_UNAVAILABLE`,
  never `0` or a silent `null`, and the policy decides whether to block or
  mark `completed_with_errors`. Conversion happens before the writer.

## 5. `ExportRequest` contract

The client sends only what is marked "client"; the server resolves the rest.
`userId` never travels in the request body.

| group | field | origin | V1 |
|---|---|---|---|
| — | `userId` | token (`requireUserId`) | yes, internal |
| `dataset` | V1 accepts only `transactions`; `statement` (V2) and `backup` (V3) are reserved and the V1 validator does not know them | route | `transactions` |
| `scope` (authorized universe) | `dateRange` | client: `from`, `to` (months) | yes |
| | `accountIds` | client, optional; omitted = every account the user owns | yes |
| `filters` (subset) | `movementType` | client | yes (already exists) |
| | `search` | client | yes (already exists) |
| | `category` | client: name -> account ids | yes |
| | `currencies`, `amountRange` | client | no: one stored currency; no request for an amount range |
| `ordering` | `transaction_actual_date DESC, transaction_id DESC` | server | fixed (`ACTIVITY_ORDER`) |
| `representation` | `format` | client: V1 accepts `csv` \| `xlsx`; `pdf` arrives with V2 | yes |
| | `timezone` | server (`getUserTimeZone`) | yes |
| | `currencyMode` | server: `stored` | fixed until conversion exists |
| | `columns` | server: fixed list | fixed |
| | `bom` | CSV writer option, default `true` | yes |
| `execution` | `sync` | server | yes; `async_job` rejected on Vercel |
| | `failurePolicy` | server | unused in V1 |

### Id-ownership control

The pattern already exists and is reused; what does not exist is an Overview
handler that receives ids (`overviewController.js:12-15`).

- **Owned set** — read by the token's `user_id`, like
  `getOwnedBudgetAccounts` (`budgetController.js:43-46`) over
  `getAccountsByType`.
- **Every element** — each requested id is checked against that set, never
  only the first one; a foreign id answers 403 (`budgetController.js:78-88`).
- **Omission** — with no `accountIds`, the scope is the whole owned set, which
  needs no check because it comes from that set (`budgetController.js:90-94`).
- **Empty list** — an explicit `[]` is 400, distinct from "all"
  (`budgetValidators.js:84-95`).
- **Unknown category** — 404, never an empty page
  (`overviewExpenseService.js:42,68`).

## 6. Flow

### Workflow diagram

```text
 USER (Overview)
   |
   +-- V1: "Export" button in RecentActivity      (search + type + period, CSV | XLSX)
   +-- V2: "Period statement" button beside MonthPicker   (month, XLSX | PDF)
   |
   v
 downloadFile.ts -- authFetch(responseType: 'blob')
   |
   v
 app.js  -- verifyToken -- exportRateLimiter
   |
   +-- GET /api/export/movements                          GET /api/export/statement (V2)
   |     |                                                  |
   |     v exportValidators (zod .strict)  --400-->         v exportValidators  --400-->
   |     v requireUserId + getUserTimeZone                  v requireUserId + getUserTimeZone
   |     v scope: owned accounts; each accountId --403-->   v resolveWindowOr422 --422 (future month)-->
   |     v category -> account ids --404-->                 |
   |     v transactionDatasetRepository                     v Analytics (overview_services)
   |        one statement, LIMIT 10000 + 1                  |   domain services + makeHeroSection
   |        filters from utils/.../activityFilters.js       |   makeMonthlySnapshot (yearToDate)
   |        account_registry with ar.user_id = $1           |   makeYearToDateFlow, makeYearStartChange
   |     v row 10001 present --422 "narrow the period"-->    |   month close and (year-1)-12 close
   |     v toTransactionDataset -> { columns(type), rows, meta }
   |     |                                                  v statementService -> 4 sheets / PDF
   |     |                                                  |   + the month's transactions dataset
   |     +----------------------+---------------------------+
   |                            v
   |                  core/writers (no FinTrack imports)
   |                  writeCsv . writeXlsx . writePdf (V2)
   |                  formula-injection guard on text cells
   |                            v
   |                  exportFileName -> Content-Disposition
   |                  audit log (user, dataset, format, filters, rows, generatedAt)
   |                            v
   +--------------------------> response: the file's buffer
                                v
 downloadFile.ts: ok -> saves the file under the server's name
                  400/403/404/422 -> blob.text() -> JSON.parse -> toast.error(message)
```

### V1 steps

| # | step | V1 |
|---|---|---|
| 1 | Request | `GET /api/export/movements` |
| 2 | Authorization | `requireUserId`; rate limit via `express-rate-limit` |
| 3 | Scope resolution | user's accounts via `ar.user_id = $1`, no `boundary` type; requested ids checked against that set |
| 4 | Filter validation | zod `.strict()`, 400 via `respondWithZodIssues` |
| 5 | Data instant | `generatedAt = new Date()`; one statement |
| 6 | Dataset resolution | `transactions` |
| 7 | Domain query | `LIMIT EXPORT_ROW_LIMIT + 1` |
| 8 | Domain -> export transform | rows -> `{ columns, rows, meta }` in `core/toTransactionDataset.js` |
| 9 | FX resolution | not applicable in V1 |
| 10 | Export validation | row `LIMIT + 1` present -> 422 "narrow the period" |
| 11 | Writer | `writeCsv` / `writeXlsx` |
| 12 | File | `Content-Type`, `Content-Disposition` with `fintrack-movements-YYYY-MM.csv\|xlsx`; a multi-month range uses `fintrack-movements-YYYY-MM_YYYY-MM.csv\|xlsx` |
| 13 | Result | buffer in the response |
| 14 | Audit | one log line: user, dataset, format, filters, rows, `generatedAt` |

## 7. Writers

- **Type per column.** Every `columns` entry declares `type`: `text`,
  `number`, `date` or `boolean`; the writer decides by type, never by column
  name.
- **Type-based formula guard.** Every `text` cell that starts with
  `= + - @ \t \r` gets a `'` prefix, in both CSV and XLSX; `number`, `date`
  and `boolean` keep their type, no prefix. Covers today's Movement type,
  Direction, Account, Source/Destination account, Currency, Original
  currency, Rate source and Note, and any future text column with no writer
  change.
- **CSV** — RFC 4180, CRLF, UTF-8, `bom` as an option.
- **XLSX** (`exceljs`) — frozen header, autofilter, numeric amounts formatted
  `#,##0.00`, a real date type, a Metadata sheet.
- **Statement XLSX: tables, not a dashboard.** No native charts (`exceljs`
  does not write them) and no merged "card" cells, which break sort and
  filter; the category breakdown uses conditional-format data bars, which
  `exceljs` does write. Anything graphical lives in the PDF.
- **Unavailable figure.** In the PDF, an em dash `—` with a note mark and the
  exact `meta.notices` sentence in the numbered notes at the end; in XLSX, an
  empty cell with the sentence in the adjoining column. Never `0`, never a
  generic label.
- **Executive Summary numeric format.** Accounting style, negatives in
  parentheses; the Transactions sheet keeps `#,##0.00` with a minus sign,
  because it is data meant to be filtered and calculated on.
- **PDF header carries no personal data.** Period, accounting currency, time
  zone and generation instant; no owner name or id.
- **Savings goals, totals.** Three table rows with what `makeFinancialGoals`
  publishes: `goalsTotalBalance`, `goalsTotalTarget`, `goalsTotalRemaining`.
- **Pocket status, per pocket.** Analytics already publishes the per-pocket
  row. `overviewPocketService.getPocketDomainData` already calls
  `pocketBoardService.getBoard` and republishes `board.pockets` unchanged
  (`overviewPocketService.js:79-80,193`); each row is one `makePocketStatus`
  (`pocket_services/core/makePocketStatus.js:138-187`): `name`, `target`,
  `allocated`, `remaining` (negative when the pocket exceeds its target),
  `progress`, `desiredDate`, `daysRemaining`, `funded`, `overdue`, `level`
  (one of the seven `POCKET_LEVELS`: `completed`, `aboveTarget`, `ahead`,
  `onTrack`, `behind`, `atRisk`, `overdue`), `currency`. The board also
  publishes the three counts already shown in the widget: `fundedCount`,
  `overdueCount`, `uncoveredCount`.
- **New table in the report.** Pocket / Target / Committed / Remaining /
  Progress / Status, one row per pocket, plus a count line "N funded · N
  overdue · N uncovered" as in the widget. Not a new Analytics metric: it
  reuses `board.pockets`, already computed by `pocketBoardService` for the
  board screen and already read by `overviewPocketService` for Overview level
  2 (`makePocketAnalysis`).
- **Accounts funding each pocket.** Also not a new metric:
  `getPocketSourceHoldings(db, userId, pocketId)`
  (`accountAllocationRepository.js:142-159`) already returns
  `{ pocketId, accountId, heldByThisPocket }` per account contributing to a
  pocket; account names come from the same `getAccountAllocations`/
  `getAccountIdentitiesById` that build the Allocate picker. The report lists,
  under each pocket, its source accounts with the amount assigned from each —
  the same indentation style as the accounts-and-balances section.
- **Other per-pocket KPIs, already published.** `makePocketStatus`
  (`pocket_services/core/makePocketStatus.js:138-187`) already computes
  `desiredDate`, `daysRemaining` and `requiredMonthly` (how much must be
  committed per month to reach the target by its date; `null` once the date
  has passed and the target is still uncovered — the remainder prints instead,
  per the code's own comment). Added as columns or an extra block beside the
  pocket status table.
- **Debts-by-counterparty section, before pockets.** Also not a new metric:
  `makeDebtAnalysis` (`overview_services/core/makeDebtAnalysis.js:115-155`),
  full level only, already publishes `byCounterparty` (account, signed
  balance, `direction` one of `receivable`/`payable`/`settled`, magnitude
  `rank`) and `legsOverTime` (the month's two legs, positive, over the month
  window) — the same source that already builds section 6's "Debtors". The
  report adds a per-counterparty table and a trend chart of the two legs, in
  the same sober register as page 2. A counterparty settled at 0.00 stays in
  the list on purpose (the code itself documents this), so the report keeps
  it as an example.
- **Two decimals everywhere in the report.** No abbreviations like `52.8k`.
- **PDF** (`pdfkit`, V2) — a sober, institutional multi-page statement:
  hierarchy by size and weight of type only, sections separated by thin
  rules, tabular figures right-aligned, negatives in parentheses, Year to
  date columns in muted ink; no color blocks, icons, emoji or progress bars,
  one exception below.
  - Page 1: header with the FinTrack wordmark, period, time zone, year range
    and generation instant; four tiles (net worth, month's net flow, free
    cash, savings rate) each with its year figure; a Month / Year to date
    cash-flow table noting the year rate is a quotient of sums; a
    financial-position table at close with the change since January 1,
    pocket-committed cash and free cash as detail of the cash figure; assets
    / liabilities / net worth. Reference: the
    sample statement the developer shared on 2026-09-14.
  - Page 2: two contained charts — six-month income versus expense
    (`makeTrendSeries`) and expense by category (`makeCategoryBreakdown`) —
    thin lines, neutral tones, at most one accent color; the category table
    below.
  - Page 3: accounts and balances by type; budget execution with a donut of
    total spent over total budgeted (`makeCategoryBudgetExecution`), a
    Pareto of spend and budget by category with both cumulative curves and
    the 80% mark, same structure as level 2's `CategoryBudgetPareto.tsx`
    (`cumulativePercentage` and `cumulativeBudgetPercentage` in
    `makeCategoryBreakdown.js:126`), and the table; savings-goal totals in a
    table (`makeFinancialGoals`); numbered notes and known limitations.
  - Following pages, closing the document in this order: debts by
    counterparty (table + trend, above), then pocket status by pocket
    (`board.pockets` via `overviewPocketService`, above) with its source
    accounts and KPIs. The final page count stays open, sized to what each
    section needs — measured at 7 pages in the approved mockup.
  - Charts drawn with `pdfkit`'s vector primitives, no charting library.
  - Wordmark drawn the same way: the nine `<path d="...">` of
    `frontend/src/assets/logo.svg` (the app's own header/auth-page logo,
    `fill="#141414"`), replayed through `doc.path(d).fill(color)` at page 1's
    top, not rasterized into an embedded PNG. Not a decorative icon — the
    "no icons" rule above is about illustration inside the body, not the
    report's own brand mark.
  - Helvetica, regular and bold: ships inside `pdfkit` with no embedded font
    files, and its digits are equal-width, so figures align. The app's own
    interface stays on Outfit.

## 8. Volume

- **Cap.** `EXPORT_ROW_LIMIT = 10000` rows; above it, 422 with the message to
  narrow the period.
- **Why not streaming in V1.** Vercel keeps no cursor-backed connection or
  queue; 10,000 rows in memory sit far under a function's memory limit.
- **Future extension.** Keyset pagination (`WHERE (date, id) < (last_date,
  last_id)`) if the cap turns out too low; noted, not built.

## 9. Phases

| phase | product | contents |
|---|---|---|
| V1 | Data Export | `transactions` dataset, CSV + XLSX, API filters (`from`/`to`, `movementType`, `search`, `accountIds`, `category`), FX traceability, cap, audit |
| V2 | Financial Report | `statement` dataset: XLSX with Executive Summary, Transactions, Accounts & Balances, Metadata & Audit; an executive PDF |
| V2.1 | Interpretations | an Analytics layer of deterministic sentences over already-published measures; consumed by the Period Statement and by Overview |
| V3 | Backup / migration | the FinTrack JSON package, its own contract, round-trip with `PLAN_DATA_IMPORT.md` |

### V2: report rules

- **Precondition met.** Definitions are fixed in "V2 financial definitions"
  below, taken from the current code and from `PLAN_OVERVIEW_CONTRACT.md`. V2
  waits on no further decision.
- **Executive Summary** — an open list: metrics the Analytics Domain already
  publishes for the period, never computed inside `export_api`.
- **First selection** — income, expenses, `netMonthlyFlow`, `savingsRate`,
  `netWorth`, `liquidNetWorth`, `cashPosition`, `freeCash`, debt position and
  pocket position; every one of these is already published by the Analytics
  Domain (today, `makeHeroSection` and the domain services).
- **Two columns: Month and Year to date** — every flow metric carries the
  month's value and the calendar-year accumulation up to that month.
- **Accumulation already published.** `yearToDate` of income, expense and
  pockets comes from `makeMonthlySnapshot.js:122`: it sums the year's months
  out of the thirteen-point series, with no query of its own.
- **New accumulation in Analytics.** `makeYearToDateFlow.js` takes the
  `yearToDate` of income and expense; publishes `netYearToDateFlow` = income −
  expense and `yearToDateSavingsRate`, reusing `savingsRateOf`
  (`makeHeroSection.js:135`, exported).
- **The year rate is a quotient of sums** — (year income − year expense) /
  year income, never the average of the monthly rates; `null` with a notice
  when year income is not greater than 0.
- **Balances: change since the start of the year.** Net worth, cash, debts,
  investment and pockets are point-in-time balances; their Year to date
  column is the change against the close of the prior December 31 (see
  definitions), never a sum.
- **Nulls carry a notice.** A `null` metric writes empty beside its
  `meta.notices` text, never as `0`.
- **A new metric** first enters the Analytics Domain with closed semantics;
  the report reads it afterward.
- **Transactions** — the full period's `transactions` dataset.
- **Accounts & Balances** — the ledger-derived balance
  (`derivedAccountBalanceSql`), never the stored `account_balance`.

### V2 financial definitions

Rules already in force in the code, common to every figure below:

- **Instant.** Every balance is at the close of the reference month: movements
  dated `>=` the start of the following month in the owner's time zone are
  discounted (`overviewPageRepository.js:122-131`); for the current month the
  close is the current balance.
- **An account's balance** — `account_starting_amount` + signed movements,
  excluding the row that opens the account (`derivedBalance.js:96-100`).
- **Rounding.** Summed in NUMERIC, one rounding to 2 decimals, half up, via
  `toAmount` (`money.js`).
- **`bank` includes `cash`.** Every formula naming "bank" sums the `bank` and
  `cash` types (`overviewPageRepository.js:136`; contract decision D45).
- **Currency.** The accounting currency; no conversion.

| figure | definition | null |
|---|---|---|
| **Cash position** (`cashPosition`) | sum of open `bank` and `cash` account balances; nothing added or subtracted for pockets (`makeHeroSection.js:211`) | never |
| **Free cash** (`freeCash`) | per `bank`/`cash` account: balance − pocket-allocated at close, floored at 0 per account before summing (`overviewPageRepository.js:175-199`); can exceed cash position if an account is overdrawn | never |
| **Investment** (`ledgerBalance`) | sum of ledger balances of open investment accounts; no market value or return (`makeInvestmentCard.js:11-14`) | never |
| **Receivable** | sum of positive debtor balances, in magnitude (`overviewBalanceRepository.js:226`) | never |
| **Payable** | sum of negative debtor balances, as a positive magnitude (`overviewBalanceRepository.js:227`) | never |
| **Net debt position** (`debt.totalAmount`) | signed sum of debtor balances: lending raises it, owing lowers it (`movementInputHandler.js:42,48`) | never |
| **Net worth** (`netWorth`) | cash position + investment + net debt position; no pocket term, because what is committed is already inside the bank figure (`makeHeroSection.js:197-201`) | never |
| **Liquid net worth** (`liquidNetWorth`) | cash position + investment − payable; leaves out what is owed to the owner (`makeHeroSection.js:179-181`) | with a notice if `payable` did not resolve |
| **Committed in pockets** (`pocket.totalAmount`) | sum of allocations dated before the close, minus releases; money set aside inside `bank`/`cash` accounts, not a separate balance (`overviewPocketService.js:120`) | 0 with a notice if there are no pockets |
| **Month income / expense** | totals of the income and expense cards; expense = movement types 1 and 6 over `category_budget` accounts | never |
| **Net monthly flow** (`netMonthlyFlow`) | income − expense (`makeHeroSection.js:173,219`) | never |
| **Month savings rate** (`savingsRate`) | net flow / income, 0-1, unclamped (`makeHeroSection.js:135`) | with a notice if income <= 0 |

**Assets and liabilities in the report.** The code classifies no account type;
the report uses this classification, which reproduces the net-worth formula:

| side | components |
|---|---|
| Assets | cash position, investment, receivable |
| Liabilities | payable |
| Net worth | assets − liabilities = `netWorth` (check: receivable − payable = net debt position) |
| Not an asset | committed in pockets: shown as detail of cash, never added on top |

**Year accumulation** (Year to date column):

| kind of figure | definition | source |
|---|---|---|
| Flows (income, expense, pockets) | sum of the calendar year's months up to and including the reference month | `yearToDate`, `makeMonthlySnapshot.js:78-85` |
| Year net flow | year income − year expense | new: `makeYearToDateFlow.js` |
| Year savings rate | year net flow / year income; a quotient of sums, not an average of rates | new: `makeYearToDateFlow.js`, reuses `savingsRateOf` |
| Balances (net worth, liquid net worth, cash, free cash, investment, receivable, payable, net position, pockets) | balance at the reference month's close − balance at the prior December 31 close | new: `makeYearStartChange.js` |

- **No new SQL for the prior year's close.** The readers already accept any
  past month: call them with `'(year-1)-12-01'`
  (`getBankBalance` `overviewPageRepository.js:369`, `getFreeCash` `:391`,
  `getInvestmentFigures` `overviewInvestmentRepository.js:328`,
  `getDebtDomainFields` `overviewBalanceRepository.js:261`, the pocket board
  `pocketRepository.js:82`).
- **An account opened during the year** — its December 31 balance reads 0:
  subtracting later movements includes the opening row; the change is its
  full balance.
- **January** — the change is January's close − December's close; never null.
- **`makeYearStartChange.js`** — a pure function in `overview_services/core`:
  takes the two already-computed closes and returns the rounded differences
  via `toAmount`; if a close is `null` (liquid net worth), the difference is
  `null` with that close's notice.

**Known limits, written into the Metadata & Audit sheet:**

- **Closed accounts** — closing deletes the `user_accounts` row, so the
  account also drops out of past closes; a year with accounts closed later
  shows a December close that differs from what it looked like at the time.
- **Debtors closed in past months** — the net position discounts them via
  `account_registry`, while `receivable`/`payable` omit them, so receivable −
  payable can fail to equal the net position; the report publishes all three
  as they are and marks the difference.
- **Negative bank or investment balance** — nets inside its own total; it is
  not moved into liabilities.

## 10. What is reused

| piece | file | use |
|---|---|---|
| `transactionRowColumns`, `TRANSACTION_ROW_SOURCE` | `overview_services/db/transactionRowShape.js:52,103` | base of the SELECT; FX and source/destination-name columns are added |
| `ACTIVITY_FILTER`, `ACTIVITY_READER_FILTER`, `ACTIVITY_ORDER` | `overview_services/db/overviewPageRepository.js:256,282,308` | moved to a neutral module imported by both activity and export |
| `overviewActivityQuerySchema` | `validation/zod/overviewValidators.js:166` | `.pick({from,to,search,movementType})` + `format` |
| `getAccountsByType` + per-element check | `utils/fintrackUtils/accountDataRetrieval/accountUtils.js`, `budgetController.js:43-94` | `accountIds` ownership control |
| `categoryAccountIds` | `overviewExpenseService.js:60` | category -> account ids |
| `extractNoteFromDescription` | used in `overviewPageRepository.js:439` | Note column |
| `makeHeroSection`, domain services, `resolveWindowOr422` | `overview_services/core`, `overview_services/services`, `overviewController.js:101` | V2 report |
| `requireUserId`, `getUserTimeZone` | pattern from `overviewController.js:124-129` | controller |
| `authFetch` | `frontend/src/auth/auth_utils/authFetch.ts:30,39` | blob download |

## 11. Frontend

- **No new screen.** The product is a downloaded file; the figures on screen
  stay Overview's own.
- **V1** — an "Export" control (CSV / XLSX) inside `recentActivity__controls`
  (`RecentActivity.tsx:200-269`), after the period selector, downloading
  movements with the active search, type and period.
- **API versus screen in V1.** The API accepts `from`/`to`, `movementType`,
  `search`, `accountIds` and `category`; `RecentActivity` only has controls
  for search, type and period, so `accountIds` and `category` are API
  capabilities with no new control on this screen.
- **V2** — a "Period statement" button (XLSX / PDF) beside `MonthPicker` in
  `OverviewLayout.tsx:135`; the report opens in Excel or in the PDF viewer.
- **English labels** — the neighboring labels already are (`PERIOD_LABELS`,
  `MOVEMENT_LABELS` in `RecentActivity.tsx:41-69`).

- **`frontend/src/fintrack/helpers/downloadFile.ts`** — `authFetch` with
  `blob`, filename from `Content-Disposition`.
- **Download error.** On a non-success response (400/403/422) the body
  arrives as a `Blob`: read it with `await blob.text()`, `JSON.parse` it, and
  send its `message` to `toast.error()`; the JSON is never downloaded as a
  file.
- **File names.** V1 `fintrack-movements-YYYY-MM.csv|xlsx`, a range
  `fintrack-movements-YYYY-MM_YYYY-MM.csv|xlsx`, no period bounds
  `fintrack-movements-all-time.csv|xlsx`; V2
  `fintrack-statement-YYYY-MM.pdf|xlsx`. The server fixes all of them.
- **Filters during download.** Search, type and period stay active; changing
  them does not cancel an in-flight download, which already carries its own
  filters in the request. Only the Export button is disabled until it
  finishes.
- **Metadata sheet carries no internal identifiers.** Generation instant,
  period, filters and row count; never `user_id` — the file can be shared and
  its owner does not need their internal id inside it.
- **Visual execution** — delegated to `frontend-designer`.
- **Mockups, approved 2026-09-15.** `plan-docs/design-refs/`:
  - `export-movements-mockup.html` — not yet built.
  - `period-statement-mockup.html` — built and approved: the "Period
    statement" trigger beside `MonthPicker` with its download-format menu and
    every button state (default, hover, focus-visible, pressed, disabled,
    preparing, error with retry, empty month), a 4-sheet workbook preview,
    and a 7-page PDF preview covering all sections through debts-by-
    counterparty and pocket status. Sample data only, invented, no real
    user's figures.

## 12. New backend dependencies

| package | phase | discarded alternative |
|---|---|---|
| `exceljs` | V1 | `xlsx` (SheetJS) — the npm release is unmaintained |
| `pdfkit` | V2 | `puppeteer` — Chromium does not fit inside a function's cold start |

## 13. Commit sequence

| # | message | contents | status |
|---|---|---|---|
| 0 | `fix(budget): keep negative amounts numeric in csv` | `escapeCsvField` (`exportUtils.js:41`) was prefixing `'` onto a negative `remainingBudget`; split text-field escaping from number-field escaping; test added | **landed**, `e4519fbf`, on `main` and fast-forwarded to `feat/vercel-serverless` |
| 1 | `refactor(overview): share activity filters` | move `transactionRowShape.js` and the three fragments to `utils/fintrackUtils/transactionManagement/`; activity's own output unchanged | **landed**, `eebad21f`, on `main` and fast-forwarded to `feat/vercel-serverless` |
| 2 | `feat(export): add csv and xlsx writers` | `export_api/core/writers/` + tests in `backend/test/export/`; adds `exceljs` | **landed**, `815a9a18`, on `main` and fast-forwarded to `feat/vercel-serverless` |
| 3 | `feat(export): serve transactions export` | repository, service, controller, route, validator, ownership control, cap, rate limit, log; moved `MOVEMENT_TYPE_NAMES` to `activityFilters.js`, re-exported from `movementTypes.js` | **landed**, `26983f47`, on `main` and fast-forwarded to `feat/vercel-serverless` |
| 4 | `feat(overview): download movements from activity` | `downloadFile.ts`, `exportApi.ts`, `url_export_movements` + the `RecentActivity` export control (built by frontend-designer, no mockup) | **landed**, `1cda0356`, on `main` and fast-forwarded to `feat/vercel-serverless` |
| 5a | `feat(overview): add year-to-date figures` | V2: `makeYearToDateFlow.js` and `makeYearStartChange.js` + tests; export `savingsRateOf`; no change to Overview's response | pending |
| 5 | `feat(export): serve period statement report` | V2: `pdfkit`, `writePdf.js`, the four-sheet workbook from the Analytics Domain with Month and Year to date columns, `statement` route | pending |
| 6 | `feat(overview): download period statement` | the button beside `MonthPicker` | pending |

## 14. Closed decisions

| decision | outcome | why |
|---|---|---|
| `accountIds` in scope | yes in V1, optional | the ownership control already exists (`budgetController.js:43-94`); omitting it keeps parity with the activity list |
| `category` filter | yes in V1, optional | resolves to account ids via `categoryAccountIds` and passes through the same control |
| Currency and amount-range filters | no in V1 | one stored currency; no request for an amount range |
| Ascending sort option | no in V1 | export follows the screen; the id tie-break already makes it deterministic |
| FX traceability columns | yes in V1 | the columns already exist (`createTables.js:194-199`) and need no conversion |
| Row cap | 10,000 | covers years of personal use inside a function's limit |
| Header language | English | the interface declares `lang="en"` |
| Rename `overview_services` to `analytics_services` | no, not in this plan | changes import paths with no change to any figure |

## 15. Verification

1. `node --test "test/**/*.test.js"` from `backend/` — writers: commas,
   quotes, formula guard on text only, numeric negative amount, optional BOM;
   XLSX re-read with `exceljs` shows numeric cells; PDF begins with `%PDF`.
2. Invariant: with no `accountIds` and no `category`, the exported
   `transaction_id`s match `getActivityPage`'s in count and order with no cap.
3. Ownership: a foreign id mixed with an owned one -> 403; `accountIds=[]` ->
   400; an unknown category -> 404.
4. Commit 1: `GET /api/fintrack/overview/activity`'s response is identical
   before and after.
5. V2: every Executive Summary figure equals the Analytics result that
   publishes it (today `makeHeroSection` or the domain service) for the same
   user and window; the Overview screen is not the reference; a `null` metric
   renders empty with its notice.
6. Boot: `APP LOADED OK`.
7. Manual: download CSV and XLSX from `RecentActivity` with a filter active;
   open in Excel; check accents, signs and FX columns against the screen.
8. Errors: `format=docx` -> 400 naming the field; a range over the cap ->
   422; a future month in `statement` -> 422.
9. Reference ownership: a transaction whose `source_account_id` or
   `destination_account_id` points at another user's account (a row inserted
   for the test) exports Source/Destination empty; that account's name
   appears in no byte of the CSV or the XLSX.
10. Type-based formula guard: an account name, a note and a currency code
    starting with `=` export with a `'` prefix in CSV and XLSX; a negative
    Amount exports numeric with no prefix.
11. V2 accumulation: income and expense Year to date equal
    `monthlySnapshot`'s `yearToDate` from `GET /api/fintrack/overview` for the
    same month; net-worth change = month's `netWorth` − `netWorth` from
    `?month=(year-1)-12`; in January, January's close − December's close; a
    year with 0 income gives an empty year rate with a notice.
12. `npx tsc -p tsconfig.app.json` from `frontend/`.
