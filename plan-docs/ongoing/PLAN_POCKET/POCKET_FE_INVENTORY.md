# POCKET FRONTEND — INVENTORY OF WHAT EXISTS

> **OBSOLETE, 2026-09-05.** Three FE feature waves shipped since this snapshot
> (the month-bounded board and seven levels, the header schedule fold, the hero
> and portfolio-card schedule reads). Superseded by the working tree and by
> `PLAN_POCKET_FE.md`, which restates whatever here is still current.

**Measured 2026-08-29, read-only, from source. No file was modified and no git
state was changed.**
Lives in `plan-docs/ongoing/`, which `.gitignore:123` re-includes: this file is versioned.

This is a factual record of the frontend as it stands. It describes; it does not
propose. The two exceptions are the column stating what becomes obsolete under
the frozen model and the closing list of pieces that do not exist, both of which
are lists of names.

## The branch rule this document obeys

Every path below carries its branch. **The working tree of `fix/auth-screen` is
the only place that counts as "available".** Everything found elsewhere is
confined to the clearly-labelled section at the end, and none of it is reachable
from the branch the frontend will be written on.

**Naming, binding on every line.** The bare word *budget* never names anything in
this module — it belongs to the separate budget system. The bare noun
*allocation* never appears alone: a row of `pocket_allocations` is a **pocket
allocation**. A pocket figure is **allocated**, never *saved*.

> ## CORRECTION 2026-08-30 — Part 5 describes a module that no longer exists
>
> **This is a baseline taken on 2026-08-29, and the Pocket module was replaced
> the day after.** The sentence that opens §5.0 — *"the Pocket module on
> `fix/auth-screen` is the legacy account-based implementation … there is no
> `pocketApi.ts`, no `pocketTypes.ts` and no pocket store in this working tree"* —
> is false in every clause. All three files exist, plus two stores, five URL
> declarations, eight client functions, and eleven screen and modal components.
> The word `pocket_saving` appears in **no** file under `frontend/src`.
>
> **What Part 5 is still good for** is the catalogue of defects the replacement
> was written against — the positional hero array, the client-derived status, the
> two locales in one row, the `?? 0` coercions, the missing fetch states. Read it
> as that, not as a description of the tree. A row-by-row re-measurement sits
> before Part 6.
>
> **Parts 6, 7 and 8 were re-checked and are substantially intact.** The account
> detail is untouched, the conventions of Part 7 still hold with two exceptions
> named in the same block, and Part 8's finding that no visual asset exists is
> unchanged.

---

## Part 5 — Current state of the Pocket screens

### 5.0 What is in the working tree, in one sentence

The Pocket module on `fix/auth-screen` is the **legacy account-based
implementation**: a pocket is an account of type `pocket_saving`, it carries
`account_balance`, and every screen reads it through the generic account and
transaction endpoints. Nothing consumes `/api/fintrack/pocket`. There is **no
`pocketApi.ts`, no `pocketTypes.ts` and no pocket store** in this working tree.

The word `pocket` appears in 40 frontend files. The eleven that are Pocket
screens or their direct support are below; the rest are navigation, types and
constants, listed in 5.2 and in the dependency table at the end.

### 5.1 The screen files

| file/path | in `fix/auth-screen`? | what it does | endpoint consumed | payload expected | components reused | problems found | obsolete under the new model |
|---|---|---|---|---|---|---|---|
| `frontend/src/fintrack/pages/pocket/PocketLayout.tsx` (98 lines) | **yes** | The board shell: white header, one hero figure, `<Outlet />` for the list | `GET {VITE_API_URL_APP}dashboard/balance/type?type=pocket_saving` | `BalancePocketSavingRespType` — `data: { total_balance, total_target, total_remaining, currency_code }` | `TitleHeader`, `PocketBigBoxResult`, `CoinSpinner`, `Outlet` | Builds a three-tile array at `:47-51` and `PocketBigBoxResult` reads only indexes 0 and 1 — the third tile, **labelled `expenses` on a savings board, is computed and never rendered**. Every figure is `?? 0` (`:34-37`), so a missing amount renders as a real zero, which the project's own fetch-state rule forbids. Error is handled twice: a 3-second timer at `:23-29` and an absolutely-positioned `<p>` at `:78-91` with `color: 'red'` and percentage offsets inline. No retry control | **yes** — the whole payload is an account-balance fold. The new board is one request answering `summary` + `pockets` + `meta`, and no pocket has a balance to total |
| `frontend/src/fintrack/pages/pocket/Pocket.tsx` (68) | **yes** | The board body: a create button, a title, the list, and the create button again | none — it fetches nothing | none | `OpenAddEditBtn`, `CardTitle`, `ListPocket` | The same `OpenAddEditBtn` is rendered **twice**, above and below the list (`:43-49` and `:55-61`), with identical props. Two commented-out blocks, `:14-18` and `:31-41`, one of which is a third copy of the same button. No search, no sort, no filter, no empty state | **partly** — the create-button/list/title arrangement survives; the duplicated control and the absence of any board summary, toolbar or empty state do not |
| `frontend/src/fintrack/pages/pocket/components/ListPocket.tsx` (100) | **yes** | One row per pocket, linking to the detail | `GET {VITE_API_URL_APP}dashboard/balance/summary/?type=pocket_saving` | `PocketListSummaryType` — `data: PocketListType[]`, each `{ account_name, account_id, currency_code, balance, target, desired_date, note, account_start_date }` | `StatusSquare`, `currencyFormat`, `numberFormatCurrency`, `Link` | Renders the literal word **`saved:`** at `:71`, which the naming rule forbids. Derives status on the client, `balance - target < 0` at `:90` — a figure the server now serves. Prints `` `${note}` `` at `:64`, so a null note renders the string `null`. Dates use `'es-ES'` at `:65` while amounts use `'en-US'` at `:75` and `:85`. On error or empty it renders an **empty `<article>`** — no message, no retry, no empty state. Imports a commented-out `DEFAULT_POCKET_LIST` at `:7` | **yes** — the row reads `balance` where the model has `allocated`, and it carries none of `progress`, `daysRemaining`, `requiredMonthly`, `funded`, `overdue`, `sourceCount` or `uncovered` |
| `frontend/src/fintrack/pages/budget/components/ListPocket.tsx` (100) | **yes** | **Byte-for-byte identical** to the file above (`diff` returns empty) | same | same | same | Dead code. Its only mention is a commented import at `pages/budget/Budget.tsx:7` and a commented JSX block at `Budget.tsx:64-73`. It compiles and ships | **yes** — dead on both counts |
| `frontend/src/fintrack/pages/pocket/components/PocketBigBoxResult.tsx` (37) | **yes** | The board hero: one large amount plus one labelled row | none — presentational | `{ bigScreenInfo: {title, amount}[], currency }` | `currencyFormat`, `CURRENCY_OPTIONS` | Its own header comment at `:1-2` still says **`BudgetBigBoxResult` / Parent: BudgetLayout.tsx`** — copied and never renamed. Indexes the array positionally (`[0].amount`, `[1].title`, `[1].amount`) and silently drops index 2. Hardcoded `'light'` and `'dark'` modifier strings at `:27-31` | **yes** — the board summary now has ten fields including four counts, and a two-slot positional array cannot carry them |
| `frontend/src/fintrack/pages/pocket/styles/pocket-styles.css` (253) | **yes** | The board's stylesheet | n/a | n/a | n/a | **Zero `@media` queries** — the file declares no responsive behaviour at any of the 480/768/1024 breakpoints or the two height steps. Hardcoded colours: `#1b1b1b` (`.card__tile__pocket`), `#5b5b5b` and `#bdb1b1` (`.pocketLayout .tile__subtitle`), `cyan` on two hover rules. **`color: cyan f`** is an invalid declaration the browser drops, so `.box__title--category__name:hover` has no hover state at all. `!important` on `border-radius` and on `.tile__subtitle--opc`. Duplicate `.pocketLayout` block, `:4-6` and `:10-29`. No `:focus-visible`, no `:active`, no `:disabled` on `.card__tile__pocket`, which is a `<Link>` | **partly** — the tile geometry and the two-column split survive as geometry; every colour, the missing states and the missing breakpoints are defects independent of the model |
| `frontend/src/fintrack/pages/forms/newPocket/NewPocket.tsx` (495) | **yes** | The creation form | `POST {VITE_API_URL_APP}account/new_account/pocket_saving` | sends `{ name, note, type: 'pocket_saving', target, desired_date, currency }`; expects `CreatePocketSavingAccountApiResponseType` | `TopWhiteSpace`, `FormSubmitBtn`, `FormDatepicker`, `MessageToUser`, `CurrencyBadge`, `RateTooltip`, `CharacterCounter`, `useInputNumberHandler`, `useFetchLoad`, `useCurrencyPreview`, `useAuth` | Sends **`desired_date` as a JS `Date`** (`:213`), which serialises to a full ISO instant; the new contract takes a `YYYY-MM-DD` calendar label. Sends `type`, a key the strict creation validator rejects outright. Validates with the hand-rolled `validationData` (`:189`), not Zod, unlike the account editor. `useEffect` at `:115-125` lists `messageToUser` in its own dependency array while setting it — it re-runs on its own output. On success it sets the message and then immediately nulls it two lines later (`:243` then `:256`), so **no confirmation is ever visible**; the toast is the only feedback. It does not navigate anywhere after creating. The date field has **no minimum**, so a past deadline is accepted | **partly** — the layout, the FX preview and the character counters are the pattern every other form uses; the endpoint, the payload keys, the `type` field and the date type are all wrong under the new contract |
| `frontend/src/fintrack/pages/forms/pocketDetail/PocketDetail.tsx` (264) | **yes** | The pocket detail, built as an **account statement** | `GET {VITE_API_URL_APP}account/{accountId}` and `GET {VITE_API_URL_APP}account/transactions/{accountId}/?start=&end=` | `PocketSavingAccountsResponseType` (`data.accountList[0]`) and `TransactionsAccountApiResponseType` (`data.summary`, `data.transactions`) | `TopWhiteSpace`, `SummaryPocketDetailBox`, `CurrencyBadge`, `AccountBalanceSummary`, `CardTitle`, `AccountTransactionsList`, `AccountTransactionDetailModal`, `CoinSpinner`, `useTransactionDetail` | **Renders a two-month transaction statement for an object that has no transactions.** Three different fallbacks for the same back route: `'/fintrack/budget'` at `:57`, `'/fintrack/overview'` at `:67`, and the state value in between. The three-dots control at `:161-163` is a **`<div id='edit'>` with no handler** — a dead affordance; `AccountActionsMenu` exists and is not wired here. `LocationStateType.pocketData` (`:43`) is never sent by any caller: `ListPocket:57` passes `{ previousRoute }` only. `isLoading` renders a bare `<p>Loading...</p>` (`:246`); the error branch has no retry. Period bounds are built with `toISOString()` (`:99-100`), which is UTC and shifts the day west of UTC | **yes** — the statement section, the balance summary and the transaction modal all describe money movements. A pocket has none |
| `frontend/src/fintrack/pages/forms/pocketDetail/summaryPocketDetailBox/SummaryPocketDetailBox.tsx` (58) | **yes** | The detail hero: target, amount, a status square and a percentage | none — presentational | `PocketSavingAccountListType` — reads `currency_code`, `account_balance`, `target` | `StatusSquare`, `getCurrencySymbol`, `numberFormatCurrency` | Prints the literal **`Saved `** at `:20`. Computes `remaining` (`:23`) and the percentage (`:45-49`) **on the client**, and the percentage it prints is the *remaining* share, not progress — a pocket at 72% displays `28.0%`. Prints raw `{target}` at `:33` with no formatting beside a formatted `account_balance` at `:38`. Carries one figure where the frozen hero states seven | **yes** — it is built on `account_balance`, and the four client-side derivations are all served now |
| `frontend/src/fintrack/pages/forms/pocketDetail/summaryPocketDetailBox/styles/summaryDetailBox-style.css` (49) | **yes** | The detail hero's stylesheet | n/a | n/a | n/a | Hardcoded `#141414` and `#5b5b5b` (twice). No responsive rules. Not the same file as the shared `accountDetailSharedComponents/summaryDetailBox/styles/summaryDetailBox-style.css` (164 lines) despite the identical filename — two stylesheets, one name | **yes**, with the component it dresses |
| `frontend/src/App.tsx` — routes at `:32`, `:38`, `:57-59`, `:75-77`, `:205-221`, `:289-296`, `:335-342` | **yes** | The three Pocket routes | n/a | n/a | `LazyRoute`, `ProtectedRoute` | `/fintrack/pocket` (layout + index), `/fintrack/pocket/new_pocket`, `/fintrack/pocket/pockets/:pocketId`. The last two are declared **as siblings of `<Layout />`, not inside it**, so opening a pocket or the creation form unmounts the layout and everything hanging from its `Outlet`. `PocketLayout` is imported eagerly at `:32` while `Pocket`, `NewPocket` and `PocketDetail` are lazy. The path segment doubles the noun: `pocket/pockets/:pocketId` | **no** — the three route slots stand; only what they render changes. The unmount-on-navigate behaviour is the exact argument `useBudgetStatusStore` records for holding module state in a store |
| `frontend/src/urlConfig.ts:74-75` — `url_create_pocket_saving_account` | **yes** | The only pocket-specific URL in the file | `account/new_account/pocket_saving` | n/a | n/a | The file declares **no `/pocket` module URL of any kind**. The board and the summary URLs the screens use are the generic `dashboard/balance/type` (`:126-128`) and `dashboard/balance/summary/` (`:57-58`) | **yes** — the legacy creation route is one of the three legacy consumers the plan retires |

### 5.2 The supporting declarations, same working tree

| file/path | in `fix/auth-screen`? | what it holds | problems found | obsolete under the new model |
|---|---|---|---|---|
| `frontend/src/fintrack/types/responseApiTypes.ts:28-52`, `:292-320`, `:364-393`, `:546-566` | **yes** | Five pocket response types: `BalancePocketRespType`, `BalancePocketSavingRespType`, `CreatePocketSavingAccountApiResponseType`, `PocketSavingAccountsResponseType` / `PocketSavingAccountListType`, `PocketListSummaryType` / `PocketListType` | Every one is account-shaped: `account_id`, `account_balance`, `account_type_name`, `account_start_date`. `PocketSavingAccountType:311-320` declares the six FX audit fields of the target — the same six the backend inventory records as written and never served | **yes** — all five. The new payload names `pocketId`, `allocated`, `sources`, `history` |
| `frontend/src/fintrack/helpers/constants.ts:185-224` — `DEFAULT_POCKET_LIST`, `DEFAULT_POCKET_ACCOUNT_LIST` | **yes** | Dummy rows used as initial state | `account_id: Infinity` as a sentinel. `DEFAULT_POCKET_ACCOUNT_LIST[0]` is what `PocketDetail:47` renders before the answer lands, so the screen paints a real-looking zero-balance pocket during every load | **yes** |
| `frontend/src/fintrack/types/types.ts:141`, `:199-208` | **yes** | `'pocket' \| 'pocket_saving'` inside the account-type union; `PocketsToRenderType` | Two spellings of the same thing in one union. `PocketsToRenderType` has no reader | **yes** |
| `frontend/src/fintrack/editionAndDeletion/validations_zod/editSchemas.ts:26-48`, `:97` | **yes** | `pocketSavingEditSchema` — `account_name`, `note`, `target`, `desired_date` with a future-date refinement; registered in `accountTypeEditSchemas` | This is the **legacy edit path the plan retires**: it drives `PATCH account/edit/:id`, which writes `target` with no FX conversion | **yes** — retired, not repaired |
| `frontend/src/fintrack/editionAndDeletion/validations_zod/accountEditSchema.ts:147-183` | **yes** | The `pocket_saving` field descriptors: `Pocket Name`, `Savings Goal Amount`, `Target Completion Date`, `Note` | Same retirement. `Savings Goal Amount` is the *saved* vocabulary again | **yes** |
| `frontend/src/fintrack/editionAndDeletion/utils/languages.ts:100`, `:217`, `:327` | **yes** | The label `pocket_saving: "Saving"` / `"Ahorro"` | The banned word, in two languages | **yes** |

### 5.3 What consumes pocket data outside the module — same working tree

| file/path | what it does with pockets | problems found |
|---|---|---|
| `frontend/src/fintrack/general_components/mainNavbar/MainNavbar.tsx:16` | The bottom-navbar entry, `/fintrack/pocket` | none |
| `frontend/src/fintrack/pages/accountingDashboard/AccountingDashboard.tsx:51`, `:64` | Lists `pocket_saving` as an account type with its own icon, and routes its rows to `/fintrack/budget/pockets` | **That route does not exist in `App.tsx`.** Clicking a pocket row on the dashboard lands on the error element |
| `frontend/src/fintrack/pages/overview/OverviewLayout.tsx:96-110`, `:144-145`, `:156` | Fetches the pocket-account balance total and **adds it into the overview's net worth** at `:156` | Under the new model a pocket holds no money, so a total that adds it counts the same cash twice |
| `frontend/src/fintrack/pages/overview/Overview.tsx:86-87`, `:110-111`, `:480-481` | Two requests: the `pocket_saving` balance total feeding `SavingGoals`, and `dashboard/movements/movement/?movement=pocket` feeding a *Last Movements (pocket)* panel | The movements panel lists **transactions against pocket accounts**, which migration 020 deletes |
| `frontend/src/fintrack/pages/overview/components/SavingGoals.tsx` | Renders `BalancePocketRespType` | Account-shaped |
| `frontend/src/fintrack/pages/tracker/transfer/Transfer.tsx:105`, `:113`, `:186-187` | Offers `Pocket` as both an origin and a destination account type in the radio sets, mapping `'pocket'` to `'pocket_saving'` before the fetch | **A pocket does not participate in Transfer.** These two options move real money into and out of an object the model says holds none |

### 5.4 RE-MEASURED 2026-08-30 — what stands where each row of 5.1 to 5.3 stood

**The tables above are left intact**, because their anchors are the evidence for
what the rewrite corrected. Below is the same tree read today, uncommitted files
included.

| what 5.1 measured | what is there now |
|---|---|
| `PocketLayout.tsx` on `dashboard/balance/type?type=pocket_saving`, a three-tile positional array, an inline-red error paragraph on a timer | reads `usePocketBoardStore` and issues the module's one request (`:25-27`), hands the **whole** summary and the whole row array to the header (`:75-79`). **The 3-second timer (`:29-35`) and the absolutely-positioned inline-red paragraph (`:81-93`) survive** — the one item of this file's rework that did not land |
| `Pocket.tsx` rendering the same create control twice | one control, after the list (`:32-38`), with the reason written beside it |
| `pages/pocket/components/ListPocket.tsx` printing `saved:`, deriving status from `balance - target`, two locales, an empty `<article>` on error and empty | reads the store, and error, loading and empty are three distinct answers (`:90-143`). The status comes from the shared `pocketDateLevel` over the served flags (`:176`), the words from `STATUS_WORD` (`:36-42`), the date from `formatCalendarDate` (`:174`). The card prints `allocated`, `target`, `progress`, the shortfall or the excess, the monthly pace as a tri-state (`:192-197`), the deadline, the day count and the source count |
| `pages/budget/components/ListPocket.tsx`, the byte-identical dead copy | **deleted.** `pages/budget/components/` holds `BudgetBigBoxResult.tsx`, `BudgetListControls.tsx`, `ListCategory.tsx` and `budgetEditModal/` |
| `PocketBigBoxResult.tsx`, a two-slot positional array under a copied header comment | rewritten as a three-level hero: the target, the total allocated and the gap as peer tiles (`:154-192`) with the excess under the gap when it is above zero; the population split by level (`:199-271`); the next target as a `Link` (`:280-310`); the board's one progress bar (`:313-341`) |
| `pocket-styles.css`, 253 lines, zero `@media` | 1141 lines, with breakpoints at 480 (`:387`) and 768 (`:1117`), the two height steps (`:1127`, `:1133`) and three reduced-motion blocks. **The legacy half survives**: `color: cyan f` (`:156`), `!important` (`:14`, `:260`), the duplicated `.pocketLayout` (`:4`, `:11`), the dead `.card__budget--title` (`:122`). **No 1024 breakpoint** |
| `NewPocket.tsx` posting `type`, `target` and a JS `Date` to the account endpoint | 452 lines, calling `createPocket` (`:211`) with the five contract keys (`:200-203`), the deadline as a calendar label, a minimum of today on the picker (`:426`), the board invalidated (`:222`) and a navigation to the created pocket (`:224`) |
| `PocketDetail.tsx` as an account statement | 563 lines on `usePocketDetailStore` (`:85`, `:118`), with a hero, a source table, an allocation history whose rows read *Allocated* or *Released* (`:476`), a local skeleton (`:221-228`), an error state with a retry, and four modals — edit link, actions menu, deletion, commit-and-release, entry detail |
| `SummaryPocketDetailBox.tsx` printing `Saved` and the remaining share | 126 lines, labelled *allocated* (`:68`), printing the served `progress` (`:113`), computing no percentage and no remainder |
| `App.tsx`, three pocket routes | four: `:212`, `:293`, `:339`, `:352` |
| `urlConfig.ts:74-75`, the only pocket URL | five module URLs (`:248`, `:258`, `:268`, `:278`, `:288`); the legacy creation URL is deleted and `:72-75` is the comment recording it |

| what 5.2 measured | what is there now |
|---|---|
| five account-shaped pocket response types | four survive, all unimported: `BalancePocketRespType` (`:28`), `BalancePocketSavingRespType` (`:44`), `PocketListSummaryType` (`:492`), `PocketListType` (`:498`). The create response and the accounts-by-type response are gone |
| `DEFAULT_POCKET_LIST`, `DEFAULT_POCKET_ACCOUNT_LIST` | both deleted. The one pocket entry left in `helpers/constants.ts` is the movement label `5: 'pocket'` (`:73`) |
| `types.ts` — the account-type union and `PocketsToRenderType` | the union no longer names the retired type; `PocketsToRenderType` survives at `:200-208`, still with no reader |
| `editSchemas.ts`, `accountEditSchema.ts`, `languages.ts` — the pocket branch and its labels | all three gone. A grep for `pocket` under `editionAndDeletion/` returns only comments |

| what 5.3 measured | what is there now |
|---|---|
| the navbar entry | unchanged, `MainNavbar.tsx` |
| the accounting dashboard's tile and its route to `/fintrack/budget/pockets` | both deleted. The card's type label now comes from the tile map with an `other` fallback (`AccountingDashboard.tsx:622-632`) instead of the row's raw type name |
| the overview's pocket balance in net worth, `SavingGoals`, the pocket movements panel | all removed; `components/SavingGoals.tsx` is deleted. Two commented lines in `overviewFetchAll.ts` (`:67`, `:72`) are the only mentions left |
| `Transfer.tsx` offering Pocket as origin and destination | gone. A grep for `pocket` under `pages/tracker/` returns nothing |

**Part 7, two exceptions to record.** The module client convention of 7.1 is no
longer *"the only module that has one"*: `fintrack/api/pocketApi.ts` is a second,
with eight functions. And 7.9's *"no screen in the working tree merges a write's
response into the screen it came from"* is false — `usePocketDetailStore` seats a
write's own answer, which is what lets the commit, release, edit and delete paths
repaint without a refetch.

**Part 7 otherwise stands**, including 7.6's four independent modal
implementations, 7.7's three disagreeing error paths and 7.8's absence of any
shared skeleton or empty-state component.

---

## Part 6 — Account Detail today

### 6.1 The file and its data source

`frontend/src/fintrack/pages/forms/accountDetail/AccountDetail.tsx`, **423 lines,
in `fix/auth-screen`**. Lines 291-423 are a commented-out sample JSON response —
one third of the file is a paste of a payload.

Two requests, both through `useFetch`:

| request | line | shape read |
|---|---|---|
| `GET {VITE_API_URL_APP}account/{accountId}` | `:96-104` | `AccountByTypeResponseType`, and only `data.accountList[0]` |
| `GET {VITE_API_URL_APP}account/transactions/{accountId}/?start=&end=` | `:127-133` | `TransactionsAccountApiResponseType` — `data.summary`, `data.transactions` |

The first request is **conditional**: `urlAccountById` is `null` when the caller
arrived with `location.state.detailedData` (`:96-98`), and `useFetch` returns
early on a null url. So the account row can come from navigation state and never
from the network. The four pocket fields the backend now attaches to
`accountList[0]` — `allocated`, `unassignedCash`, `isOverAllocated` and
`pockets` — would be **absent in that path**, because navigation state is
assembled by whichever list linked here.

`AccountByTypeResponseType` / `AccountListType` in `types/responseApiTypes.ts`
declares none of the four fields today.

### 6.2 The layout blocks, in render order

```
 <section class="page__container">          forms-styles.css:4
   <TopWhiteSpace variant="dark" />
   <div class="page__content">              forms-styles.css:15
     <div class="main__title--container">   forms-styles.css:28
       back arrow | .form__title | .icon3dots   (dead: a <div id="edit">, no handler)
     <form class="form__box">
       <div class="form__container">        forms-styles.css:151  flex column, gap 1rem
         .input__box  ->  "Current Balance"     :200-206
         .input__box  ->  "Account Type"        :208-214
         .account__dateAndCurrency             forms-styles.css:349  a 2-up row
             .account__date    "Starting Point"
             .account__currency + <CurrencyBadge>
       <div class="account-transactions__container">   :241-266
         .period-info
         <AccountBalanceSummary />
         <CardTitle>Last Movements</CardTitle>
         <AccountTransactionsList />
   <AccountTransactionDetailModal />
```

### 6.3 The structural slots that could carry the four served fields

Described as they exist. No design is proposed.

| served field | existing slot that already has that shape | evidence |
|---|---|---|
| `allocated` | **`.input__box`** — a `.label.forms__label` over a one-line `.input__container`. The screen already stacks two of them (`Current Balance` at `:200-206`, `Account Type` at `:208-214`), and `.form__container` is a flex column with `gap: 1rem` that takes an nth child without any change | `forms-styles.css:158-172`; the note-height rule at `:199-202` is scoped to `textarea` and `--note`, so a plain `<div class="input__container">` stays one line |
| `unassignedCash` | The same `.input__box`, or the **`.account__dateAndCurrency`** two-up row, which is a `display:flex; justify-content:space-between` pair of `.account__date` / `.account__currency` columns and is the only existing slot that puts **two labelled figures side by side** | `forms-styles.css:349-373` |
| `isOverAllocated` | **`StatusSquare`** from `general_components/boxComponents/BoxComponents.tsx` — a `<span class="status__square {alert}">` taking one string. It is the app's existing state mark, used by `ListPocket:90`, `SummaryPocketDetailBox:43` and `SummaryDetailBox:117`. `AccountDetail` itself does not use it today | `BoxComponents.tsx:43-49` |
| `pockets[]` | The **`account-transactions__container` band** at `:241-266`, which is the screen's one list region: a `.period-info` strip, a summary component, a `<CardTitle>` and a list. `CardTitle` (`general_components/CardTitle.tsx`) is the existing section heading, and `.list__main__container` (`pocket-styles.css:100-105`) is the app's existing flex-column list body | `AccountDetail.tsx:241-266`; `CardTitle` is used by `AccountDetail:259`, `PocketDetail:233`, `Pocket:51` |

### 6.4 The components and CSS blocks that set the current density and hierarchy

| name | path | what it fixes |
|---|---|---|
| `.page__container` | `pages/forms/styles/forms-styles.css:4-13` | `max-width: 33.3rem`, `min-width: 22.5rem`, centred, `padding: 0 1rem`. The outer envelope of every detail screen |
| `.page__content` | same, `:15-25` | **`width: 85%`** of that envelope, centred. The reason detail screens are narrower than the board |
| `.main__title--container` / `.form__title` | same, `:28-60` | The title bar: `min-height: 2.5rem`, `padding: 1rem 0`, title `1.25rem/600`, ellipsised at `calc(100% - 4rem)` |
| `.form__container` | same, `:151-156` | **The vertical rhythm: `flex-direction: column; gap: 1rem; padding: 1.5rem 0 1rem`.** Every block's spacing comes from here |
| `.input__box` | same, `:158-163` | Label-over-value: column, `gap: 0.5em` |
| `.input__container` | same, `:165-172` | `height: 2.625em`, `border-radius: 1rem`, `1px solid var(--creme)`, cream text. The one-line value box |
| `.forms__label` | same, `:129` and `:37-43` | `1.25rem`, `var(--light)`, full width, left |
| `.account__dateAndCurrency` | same, `:349-373` | The only two-up row on the screen |
| `AccountBalanceSummary` | `pages/forms/accountDetailSharedComponents/accountBalanceSummary/AccountBalanceSummary.tsx` (46) + its 86-line stylesheet | The opening/closing balance pair of the statement band |
| `AccountTransactionsList` | same folder (322) + a 205-line stylesheet | The movement rows, with the click handler that opens the modal |
| `SummaryDetailBox` | `pages/forms/accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx` (174) + a 164-line stylesheet | The **cream hero** used by the budget levels and by `EditAccount:584`. It takes an `action` slot and a `surface: 'dark' \| 'light'` modifier. **`AccountDetail` does not use it** — the account screen has no hero at all, only two stacked `.input__box` values |

---

## Part 7 — Real frontend conventions

What the code does, with the files that prove it.

### 7.1 Data fetching

Two hooks and one client module, all in `fix/auth-screen`.

| mechanism | file | how it works |
|---|---|---|
| Reads | `fintrack/hooks/useFetch.ts` (130) | `useFetch<R>(url \| null)` → `{ apiData, isLoading, error, status, refetch }`. Effect keys on `[url, attempt]`; `refetch` bumps `attempt` (`:41-43`). A `null` url is the documented way to skip a request (`:46-49`). Certain 404/400 messages are reclassified as *not an error* by **substring match on the message text** (`:79-89`) — `'No accounts of type:'`, `'No transactions encountered'`, `'No available accounts'` |
| Writes | `fintrack/hooks/useFetchLoad.ts` (107) | `useFetchLoad<R, D>({ url, method })` → `{ data, isLoading, error, requestFn, resetFn }`. `requestFn(payload, overrideConfig?)` **returns `{ data, error }` directly** as well as setting state (`:95`), which is what lets a form branch on the answer in the same tick |
| Module client | `fintrack/api/budgetApi.ts` (93) | The newest convention, and the only module that has one. Three functions wrapping `authFetch`, typed against `types/budgetTypes.ts`. Its header states why it sits outside `pages/`: the module's screens live in different route trees. **Errors are propagated untouched** so a caller can read `errors[]` per field |
| Transport | `auth/auth_utils/authFetch.ts` | Axios. Injects `Authorization: Bearer` from `sessionStorage`, `withCredentials: true`, and on a `401` performs a single-flight refresh and one retry |
| Base URL | `frontend/src/urlConfig.ts` | Three Vite env vars: `VITE_API_BASE_URL`, `VITE_API_BASE_URL_AUTH`, `VITE_API_URL_APP` (`:8`, `:10`, `:36`). Every endpoint is a `const` string or a function of the id, exported from this one file |

### 7.2 Global state — Zustand, five stores

| store | file | shape |
|---|---|---|
| `useAccountStore` | `fintrack/stores/useAccountStore.ts` | `{ allAccounts: AccountListType[] }` + `setAllAccounts`, `updateAccount`, `removeAccount`. `updateAccount` **merges** a partial patch rather than replacing the row, because `PATCH /account/edit` answers with only the changed fields |
| `useCurrencyStore` | `fintrack/stores/useCurrencyStore.ts` | `{ rates, accountingCurrency, isLoading, error, fetchRates }`. `accountingCurrency` is read from the server, distinct from `DEFAULT_CURRENCY` which is only a render default |
| `useBudgetStatusStore` | `fintrack/stores/useBudgetStatusStore.ts` | The reference implementation for a module payload: `referenceMonth`, `currentMonth`, `accounts`, `categories`, `totals`, `notices`, `loadedMonth`, `requestedMonth`, `isLoading`, `error`, plus `invalidate()`. Its header states the reason it is a store and not a route context: the budget levels are declared beside `<Layout />`, so navigating unmounts the Outlet |
| `useBalanceStore` | `fintrack/stores/useBalanceStore.ts` | One number, `availableBudget` |
| `useAuthStore` / `useAuthUIStore` | `auth/stores/` | Session flags and user data; UI state machine |

### 7.3 Routing — React Router, one table

`frontend/src/App.tsx:130-397`, a single `createBrowserRouter` array. Nesting is
declared with `children`. `ProtectedRoute` wraps `/fintrack`; `<Layout />` is the
element that owns the navbars and the `Outlet`. **Detail and form routes are
declared as siblings of `<Layout />`, not inside it** — `pocket/new_pocket`
(`:289`), `pocket/pockets/:pocketId` (`:335`), `overview/accounts/:accountId`
(`:319`), `account/:accountId/edit` (`:375`). Layout components are imported
eagerly; page and form components are `lazy` behind a `LazyRoute` wrapper
(`:124-126`) whose fallback is `CircleLoader`.

### 7.4 Validation — Zod, and a hand-rolled path beside it

| path | files | how it attaches |
|---|---|---|
| Zod | `fintrack/validations/zod_schemas/commonSchemas.ts`, `trackerMovementSchema.ts`; `editionAndDeletion/validations_zod/editSchemas.ts`, `commonEditionSchemas.ts` | `validateForm(schema, data)` in `validations/utils/zod_validation.ts:20-35` runs `safeParse` and flattens the issues into `{ [field]: message }`. `useFormManager` (`hooks/useFormManager.ts`) takes the schema as its first argument and owns `formData`, `validationMessages`, `showValidation`, `validateAll`, `resetForm`. Used by the tracker screens and by `useEditAccountForm` |
| Hand-rolled | `fintrack/validations/utils/custom_validation.ts` | `validationData(obj, { nonZeroFields })`. This is what `NewPocket:189` and the other creation forms use. **The creation forms and the edit forms do not share a validation mechanism** |
| Field limits | `fintrack/validations/utils/inputConstraints/nameMaxLengths.ts` | `NAME_MAX_LENGTHS.pocket_name`, `.note` — read by both the `maxLength` attribute and the `CharacterCounter` |

### 7.5 Forms

Hand-rolled. No form library. The pattern, visible in `NewPocket.tsx` and
`NewCategory.tsx`:

- `useState` per data object plus a second `useState` for the numeric fields,
  driven by `useInputNumberHandler`.
- `<label class="label forms__label">` carrying the field name, a
  `<CharacterCounter>` and a `<span class="validation__errMsg">` **inside the
  label**, so the message sits on the label row.
- Money fields use `.form__label-row` / `.form__amount-row`: the input, a
  `<CurrencyBadge>` that cycles the currency on click, and a `<RateTooltip>`
  wrapping a `.form__fx-preview` fed by `useCurrencyPreview` — the store-based
  preview that states what will actually be stored and **issues no request**.
- Dates use `FormDatepicker` (`general_components/datepicker/Datepicker.tsx`)
  with `variant='form'` and an optional `popperClassName`.
- Submission is a `FormSubmitBtn` with an `onClickHandler`, not a form `onSubmit`.

### 7.6 Modals

**There is no shared modal component.** Four independent implementations:

| component | path | API | portal? |
|---|---|---|---|
| `BudgetEditModal` | `pages/budget/components/budgetEditModal/BudgetEditModal.tsx` | The richest, and the newest: `{ accountName, nature, month, currency, currentAmount, nextMonthBudget, actualSpent, remainingBudget, executionPercentage, isOverBudget, isSaving, error, onClose, onSave }`. `onSave` takes the whole payload and **resolves with the server's answer**, so the panel can word its own result without a second request. It owns no request | **yes**, `createPortal` |
| `AccountTransactionDetailModal` | `pages/forms/accountDetailSharedComponents/accountTransactionDetailModal/` (392) | `{ transaction, onClose }` | no |
| `AccountActionsMenu` | `editionAndDeletion/components/accountActionMenu/AccountActionsMenu.tsx` (155) | `{ isOpen, onClose, accountName, onViewDetails?, onEditAccount, onDeleteAccount }`. Handles Escape, click-outside via `useClickOutside`, and focus return to the trigger. Its opener is `AccountActionsTrigger` in `general_components/accountActionsTrigger/`. **Its own comment at `:19-20` says `PocketDetail` and `DebtorDetail` open it — on this branch neither does**; its only caller is `AccountingDashboard.tsx:735` | overlay div |
| `RTAConfirmationModal` / `StatusModalUI` | `editionAndDeletion/pages/deletionAccount/UIComponents/` | The deletion flow's own two | no |

### 7.7 Error handling

There are **three** ways an API error reaches a screen, and they do not agree.

1. **`MessageToUser`** (`general_components/messageToUser/MessageToUser.tsx`) —
   takes `{ isLoading, error, messageToUser, variant, showToast }`. On
   `variant='form'` it raises a `react-toastify` toast through
   `helpers/showToastByStatus.ts`; on `variant='tracker'` it renders inline. The
   toast container is mounted once in `App.tsx:404-417`. This is what every
   creation form uses.
2. **A bare paragraph.** `AccountDetail:271-273` and `PocketDetail:247-249`
   render `<p>Error fetching account info: {error}</p>`. No retry.
3. **An absolutely-positioned `<p>` with inline colours.**
   `PocketLayout:78-91`, cleared by a 3-second timer.

`helpers/normalizeError.ts` flattens an unknown throw to `{ message, status }`
and is called in the catch of every form. The only screen that renders a **retry
control** is `EditAccount:496`, which wires `useFetch`'s `refetch` to a button.

### 7.8 Loading states

**No skeleton component exists anywhere in `frontend/src`** — the search for
`*skeleton*` returns nothing. What exists:

| component | path | used by |
|---|---|---|
| `CoinSpinner` | `fintrack/loader/coin/CoinSpinner.tsx` + `coin_loader.css` | `PocketLayout:72` (absolutely positioned by inline style), `AccountDetail:279`, `PocketDetail:254` |
| `CircleLoader` | `fintrack/loader/circleLoader/CircleLoader.tsx` | The `LazyRoute` fallback, `App.tsx:112-116` |
| A literal `<p>Loading...</p>` | inline | `AccountDetail:270`, `PocketDetail:246` |

There is likewise **no shared empty-state component**. `ListPocket` renders an
empty `<article>`; `Pocket.tsx` renders nothing between its two create buttons.

### 7.9 Mutations and refresh after a write

Three mechanisms, in increasing order of how recent they are.

| mechanism | how it works | evidence |
|---|---|---|
| **Local merge into a store** | The write's response is merged into `useAccountStore` | `EditAccount.tsx:342` calls `updateAccount(result.data)` with the partial patch |
| **A signal bus** | `fintrack/stores/transactionEvents.ts` exports `notifyTransactionRecorded()` / `onTransactionRecorded()` and `notifyAccountChanged()` / `onAccountChanged()`. **The module imports nothing**, which is deliberate: a tracker screen announces, and each cache decides for itself what the announcement invalidates | `Expense:427`, `Income:337`, `Transfer:536`, `Debts:431`, `PnL:416` all call `notifyTransactionRecorded()`; `NewCategory:415` and `EditAccount:347` call `notifyAccountChanged()`. `useBudgetStatusStore` subscribes at module scope |
| **Explicit invalidate** | A store exposes `invalidate()`; the writer that knows its own answer is stale calls it directly | `EditAccount:439` — `useBudgetStatusStore.getState().invalidate()` |
| **Refetch the same url** | `useFetch`'s `refetch` bumps an attempt counter rather than adding a cache-busting parameter | `useFetch.ts:36-43`; wired at `EditAccount:496` |

**No screen in the working tree merges a write's response into the screen it came
from.** `NewPocket` discards the created pocket and stays on the form.

---

## Part 8 — Visual evaluation

**No visual asset for the Pocket module exists.** `plan-docs/` holds 41 images
and 2 HTML previews, all under `plan-docs/design-refs/` (`decisions/` — auth
modal candidates, icon and colour reviews; `piggy/` — the piggy-coin drafts) plus
`plan-docs/playwright/` measurement scripts; there is **no `delta.html` anywhere
in the repository**, no Pocket screenshot, and no image under
`plan-docs/ongoing/PLAN_POCKET/`. The only mention of a Pocket screenshot is a
sentence in `POCKET_MODULE_SPEC.md:618` describing one that is not committed.

No evaluation of hierarchy, density, action placement, responsive behaviour or
consistency is offered, because there is nothing to evaluate against.

---

## Closing tables

### C.1 Reusable components — all in the `fix/auth-screen` working tree

| name | path | why it fits |
|---|---|---|
| `useFetch` / `useFetchLoad` | `fintrack/hooks/` | The read and write hooks every screen uses; `useFetchLoad.requestFn` returns the answer directly, which is what a write that returns the full detail needs |
| `budgetApi.ts` as a pattern | `fintrack/api/budgetApi.ts` | The one module client in the tree, with its rationale for living outside `pages/` written in its header |
| `useBudgetStatusStore` as a pattern | `fintrack/stores/useBudgetStatusStore.ts` | The one module-payload store, with the route-unmount argument that applies identically here |
| `transactionEvents.ts` | `fintrack/stores/transactionEvents.ts` | The existing write-signal bus, already carrying `notifyAccountChanged` |
| `SummaryDetailBox` | `pages/forms/accountDetailSharedComponents/summaryDetailBox/` | The cream hero with an `action` slot and a `surface` modifier, already shared by the budget levels and `EditAccount` |
| `StatusSquare` | `general_components/boxComponents/BoxComponents.tsx:43` | The app's one state mark, taking a single string |
| `CardTitle` | `general_components/CardTitle.tsx` | The section heading used by every list region |
| `CurrencyBadge` | `general_components/currencyBadge/` | The click-to-cycle currency control, `variant` per surface |
| `useCurrencyPreview` + `RateTooltip` | `fintrack/hooks/useCurrencyPreview.ts`, `general_components/rateTooltip/` | States what will be stored, from store rates, with no request — the shared FX mechanism every money form is bound to |
| `FormDatepicker` | `general_components/datepicker/Datepicker.tsx` | The date control, `variant='form'` |
| `CharacterCounter` | `general_components/characterCounter/` | Paired with `NAME_MAX_LENGTHS` on every text field |
| `FormSubmitBtn` | `general_components/formSubmitBtn/` | The submit control with a `disabled` prop |
| `MessageToUser` + `showToastByStatus` | `general_components/messageToUser/`, `helpers/showToastByStatus.ts` | The form feedback path, with the toast container already mounted in `App.tsx` |
| `AccountActionsMenu` + `AccountActionsTrigger` | `editionAndDeletion/components/accountActionMenu/`, `general_components/accountActionsTrigger/` | A secondary menu with Escape, click-outside and focus return, whose optional `onViewDetails` is already designed for a detail screen |
| `DropdownSelection` | `general_components/dropdownSelection/` | The `react-select` wrapper with per-variant styling and a reset protocol |
| `CoinSpinner` / `CircleLoader` | `fintrack/loader/` | The two loaders that exist |
| `useFormManager` | `fintrack/hooks/useFormManager.ts` | Schema-first form state, if a pocket form is written on Zod rather than on `validationData` |
| `TopWhiteSpace`, `.page__container`, `.form__container`, `.input__box` | `general_components/topWhiteSpace/`, `pages/forms/styles/forms-styles.css` | The detail-screen envelope and its vertical rhythm |

### C.2 New pieces needed — names and one-line roles only

**None of these exists in the `fix/auth-screen` working tree.**

> **CORRECTED 2026-08-30 — sixteen of the twenty-three now exist.** Present:
> `pocketApi.ts` (eight functions), `pocketTypes.ts` (seventeen exported types),
> `usePocketBoardStore` and `usePocketDetailStore`, five `url_pocket_*` entries in
> `urlConfig.ts`, the board's own card and empty state inside `ListPocket.tsx`,
> the detail's hero (`SummaryPocketDetailBox.tsx`), its source table, its
> allocation history and its actions inside `PocketDetail.tsx`, the entry modal
> (`allocationEntryModal/AllocationEntryModal.tsx`), `EditPocket.tsx`, the commit
> and release forms as one component (`pocketCashModal/PocketCashModal.tsx`),
> `PocketSourcePicker.tsx` and `DeletePocketModal.tsx`. The board summary lives in
> `PocketBigBoxResult.tsx` rather than in a component named `PocketSummary`.
>
> **Still absent, and each for its own reason:** `PocketToolbar` — no search,
> sort or filter exists on the board; `InitialCommitmentBlock` — the creation
> validator is still `.strict()` over five keys;
> `AccountPocketAllocations` — the account detail is untouched;
> `pocketSchemas.ts` — `validations/zod_schemas/` holds only `commonSchemas.ts`
> and `trackerMovementSchema.ts`; and the two shared fetch-state primitives, the
> skeleton and the empty state, which the board and the detail each declare
> locally instead.

| name | role |
|---|---|
| `pocketApi.ts` | The module's HTTP client: board, detail, create, edit, allocate, release, delete |
| `pocketTypes.ts` | The response contract of `/api/fintrack/pocket` |
| `usePocketBoardStore` | Holds the board payload across the route unmount |
| `url_pocket_*` entries in `urlConfig.ts` | The six module URLs, absent today |
| `PocketBoard` | The board level, replacing what `Pocket.tsx` renders |
| `PocketSummary` | The board's ten-field summary header |
| `PocketToolbar` | Search, sort and filter over the board rows |
| `PocketCard` | One board row |
| `PocketBoardEmpty` | The empty board, which is a new user and not an error |
| `PocketHero` | The detail's seven planning figures |
| `PocketSourceAccounts` | The per-source-account breakdown of the detail |
| `PocketAllocationHistory` | The signed ledger list, never called transactions |
| `PocketAllocationEntryModal` | One history row's typed amount, currency, rate, source and decision date |
| `PocketActions` | Two primary controls plus a secondary menu |
| `EditPocket` | The plan-only edit form |
| `AllocateModal` | The commit form |
| `ReleaseModal` | The release form |
| `PocketSourcePicker` | The account selector showing balance, allocated and unassigned cash per account |
| `DeletePocketModal` | The confirmation, and the freed-cash result it reports |
| `InitialCommitmentBlock` | The optional source-and-amount block inside the creation form |
| `AccountPocketAllocations` | The account detail's three figures and its per-pocket breakdown |
| `pocketSchemas.ts` | The Zod schemas for the four write forms |
| A shared skeleton component | The loading state the frontend rule names and the tree does not have |
| A shared empty-state component | The third fetch state, likewise absent |

### C.3 Dependencies — what breaks or must be touched

> **RE-MEASURED 2026-08-30 — only the Account Detail group survives whole.**
>
> - **Blocks the frontend from starting:** both rows are void. The pocket tree is
>   on this branch and `urlConfig.ts` declares five module URLs (`:248`, `:258`,
>   `:268`, `:278`, `:288`).
> - **Account Detail:** every row stands. `AccountDetail.tsx:96` still branches
>   the url to `null` on `location.state.detailedData`, `AccountListType`
>   (`types/responseApiTypes.ts:303`) still declares none of the four served
>   fields, the screen still has no hero and no list region of its own, and the
>   three-dots control is still a `<div id="edit">` with no handler.
> - **Dashboard and Overview:** every row is resolved. The overview reads no
>   pocket figure, `SavingGoals.tsx` is deleted, and the dashboard's pocket tile
>   and its broken route entry are both gone.
> - **Navigation and routing:** the three route slots are four (`App.tsx:212`,
>   `:293`, `:339`, `:352`) and are still declared beside `<Layout />`, which is
>   why the module holds its payload in two stores. The eager import of
>   `PocketLayout` stands and is the convention, not an anomaly.
> - **Tracker:** resolved. A grep for `pocket` under `pages/tracker/` returns
>   nothing.
> - **The legacy account editor:** resolved. Both edit schemas and the labels
>   file no longer name the retired type, and `EditPocket.tsx` is the route that
>   replaced them — so the window in which a pocket had no edit route never
>   opened.

Grouped by what blocks what.

**Blocks the frontend from starting at all**

| what | where | why |
|---|---|---|
| The module is unreachable from `fix/auth-screen` | the whole `/api/fintrack/pocket` tree | The backend inventory records it as existing only on a worktree. Nothing on this branch can call it |
| `urlConfig.ts` declares no `/pocket` URL | `frontend/src/urlConfig.ts` | Every module request needs one |

**Account Detail**

| what | where | why |
|---|---|---|
| `AccountListType` declares none of the four served fields | `types/responseApiTypes.ts` | The payload arrives typed as not carrying them |
| The conditional fetch | `AccountDetail.tsx:96-98` | When the caller passes `location.state.detailedData`, the account row never comes from the network, so the four fields are absent — a state distinct from an account type that has none |
| The four fields are **absent, not zero**, on ineligible types | backend contract §7.2 | The screen has to tell absent from zero for `investment`, `income_source`, `debtor` and `category_budget` |
| The screen has no hero and no list region of its own | `AccountDetail.tsx:198-268` | Its only list band is the transaction statement |
| The dead three-dots control | `AccountDetail.tsx:193-195` | A `<div id="edit">` with no handler, while `AccountActionsMenu` exists |

**Dashboard and Overview**

| what | where | why |
|---|---|---|
| Net worth adds the pocket-account balance | `OverviewLayout.tsx:144-145`, `:156` | Under the new model that cash is already counted inside its bank account |
| The `SavingGoals` panel | `Overview.tsx:86-87`, `components/SavingGoals.tsx` | Reads `dashboard/balance/type?type=pocket_saving`, an endpoint over rows migration 020 deletes |
| The *Last Movements (pocket)* panel | `Overview.tsx:110-111`, `:480-481` | Lists transactions against pocket accounts; a pocket allocation is not a transaction |
| `pocket_saving` as a dashboard account type | `AccountingDashboard.tsx:51` | A pocket stops being an account |
| The dashboard's pocket route | `AccountingDashboard.tsx:64` | Points at `/fintrack/budget/pockets`, **which is not declared in `App.tsx`** — broken today, independently of this work |

**Navigation and routing**

| what | where | why |
|---|---|---|
| The three route slots | `App.tsx:205-221`, `:289-296`, `:335-342` | The detail and the form are siblings of `<Layout />`, so navigating unmounts the layout and any state hanging from its `Outlet` |
| The navbar entry | `MainNavbar.tsx:16` | Points at `/fintrack/pocket`; unchanged by the model |
| The eager import of `PocketLayout` | `App.tsx:32` | The only Pocket component not behind `lazy` |

**Tracker**

| what | where | why |
|---|---|---|
| `Pocket` as a transfer origin and destination | `Transfer.tsx:105`, `:113`, `:186-187` | A pocket does not participate in Transfer |

**The legacy account editor**

| what | where | why |
|---|---|---|
| The `pocket_saving` edit schema and its field descriptors | `editSchemas.ts:26-48`, `:97`; `accountEditSchema.ts:147-183` | This is the path that writes `target` with no FX conversion. The plan retires it rather than repairing it, and retiring it means a pocket is not editable by any route until the module lands |
| The `pocket_saving` label | `languages.ts:100`, `:217`, `:327` | Two translations of the banned word |

---

## What is NOT in `fix/auth-screen` — off-branch findings

**Nothing in this section is available to the frontend that will be written.** It
is recorded so it is not mistaken for existing work, and so nobody re-derives it
from an obsolete contract.

### O.1 Three frontend files exist only on `feat/pocket` and its descendant worktree

Present on `feat/pocket` (commit `701aba3`, worktree
`C:/AA1-WEB_DEVELOPER/REACT/apps/FINTRACK/pern_fintrack_pocket`) and on
`worktree-agent-a4aee04d12f126b4e` (commit `bbd7d39`). **Absent from
`fix/auth-screen`, `main`, `feat/budget` and `feat/overview`:**

| file | what it is |
|---|---|
| `frontend/src/fintrack/api/pocketApi.ts` | One function, `getPocketBoard()`, wrapping `authFetch` against `url_pocket_board`. Modelled on `budgetApi.ts`, header and all |
| `frontend/src/fintrack/types/pocketTypes.ts` | `PocketStatus`, `PocketBoardSummary`, `PocketBoardResponse` |
| `frontend/src/fintrack/stores/usePocketBoardStore.ts` | A Zustand store with `summary`, `pockets`, `notices`, `isLoaded`, `isRequested`, `isLoading`, `error`, `fetchBoard`, `refreshBoard`, `invalidate`, subscribed to the write-signal bus |

`feat/pocket` also carries a `url_pocket_board` export in `urlConfig.ts` and
modified versions of `PocketLayout.tsx`, `ListPocket.tsx`,
`PocketBigBoxResult.tsx`, `PocketDetail.tsx`, `NewPocket.tsx` and
`pocket-styles.css`.

### O.2 Those three files are written against a contract the frozen model replaced

`pocketTypes.ts` on that branch declares, per pocket: `accountId`,
`accountName`, `target`, **`saved`**, `progress`, `remaining`, `desiredDate`,
`desiredDateSource`, `startDate`, `currency`; and per summary: **`totalSaved`**,
`totalTarget`, `totalRemaining`, `overallProgress`, `currency`, `pocketCount`.

Measured against the closed contract:

| what the off-branch type says | what the contract says |
|---|---|
| `accountId`, `accountName` | `pocketId`, `name` — a pocket is not an account |
| `saved`, `totalSaved` | `allocated`, `totalAllocated`. **The word is forbidden by the naming rule** |
| `target: number \| null`, "a pocket is allowed to have no goal" | `target` is required and positive on create |
| `saved` is "`user_accounts.account_balance`" | No account balance is read anywhere in the module |
| `desiredDateSource` | No such field. The defaulted-deadline idea is not in the closed contract |
| Its own comment: the pace fields are "not served" | `requiredMonthly` **is** served; `runRate` and `projectedDate` were decided out, not deferred |
| Summary has 6 fields | Summary has 10, including `totalExcess`, `fundedCount`, `overdueCount`, `uncoveredCount` |

### O.3 The backend

Recorded here only so the branch picture is complete: the whole pocket backend —
routes, validators, controller, five services, two repositories, three rounding
modules and migration `020` — lives on `worktree-agent-a4aee04d12f126b4e` at
`.claude/worktrees/agent-a4aee04d12f126b4e`, eight commits from `450e15f` to
`bbd7d39`. **The account-detail enrichment `bf41c2c` is on that worktree too, not
in the main checkout**, so `GET /api/fintrack/account/:accountId` on
`fix/auth-screen` serves none of `allocated`, `unassignedCash`,
`isOverAllocated` or `pockets`.

---

## Corrections applied 2026-08-30 — re-measured against the working tree

This is a baseline dated 2026-08-29, and the module it describes was replaced the
day after. Corrected in place; nothing struck, no decision touched.

| what was corrected | where it stood | what the code says now |
| --- | --- | --- |
| "the Pocket module is the legacy account-based implementation; there is no `pocketApi.ts`, no `pocketTypes.ts` and no pocket store" | §5.0 | false in every clause — see the banner at the head of this file |
| every row of the screen table, the supporting declarations and the outside consumers | §5.1, §5.2, §5.3 | re-measured row by row in §5.4, inserted before Part 6 |
| the module client as the only one in the tree, and no screen merging a write's response | Part 7, §7.1 and §7.9 | `pocketApi.ts` is a second module client; `usePocketDetailStore` seats a write's own answer |
| "none of these exists" | C.2 | sixteen of the twenty-three exist; the seven that do not are named with their reason |
| the dependency groups | C.3 | only the Account Detail group survives whole; the two blocking rows are void |

**Left standing because they are still true:** Part 6 in full — the account
detail's conditional fetch, its layout blocks, the four structural slots and the
components that set its density; §7.6's four independent modal implementations;
§7.7's three disagreeing error paths; §7.8's absence of any skeleton or
empty-state component; and Part 8's finding that no visual asset for the module
exists under `plan-docs/ongoing/PLAN_POCKET/`.

**Not re-measured:** the off-branch section. Whether `feat/pocket` and the agent
worktree still hold what it records was not checked, and nothing on this branch
depends on it.
