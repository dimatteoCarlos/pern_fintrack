# DEBTS / DEBTOR MODULE — CONTRACT AUDIT

Measured 2026-08-29 on branch `fix/auth-screen`, against the running code and
the local `fintrack_dev` database. No file outside this document was touched.

Nothing in this audit is taken from a commit message or from a neighbouring plan
document. Every claim below names the file and line that produces it, and every
figure quoted was read out of the database or produced by running the
controller's own SQL.

---

## 0. Method and the data it was measured against

The debtor module has no controller of its own. Every endpoint the debts screens
call lives inside the shared account and dashboard controllers, so the audit
starts at the routes and follows each debtor path into the SQL that answers it.

The local database holds one user (`America/Bogota`) and two debtor accounts.
Both were read directly, and each of the four debtor-facing queries was executed
verbatim so the payload in section 1 is the answer the server gives, not a
reading of the code that builds it.

| account | name | balance | opened (instant) | opened (owner's day) | opened (UTC day) |
| --- | --- | --- | --- | --- | --- |
| 20 | `Picapiedras, Pedro` | `1.30` | `2026-08-10T12:33:35.489Z` | 2026-08-10 | 2026-08-10 |
| 37 | `Palacios, Lucila` | `-10.21` | `2026-08-15T04:27:01.473Z` | **2026-08-14** | **2026-08-15** |

Account 37 straddles UTC midnight, which is why several date findings below are
reachable today rather than hypothetical.

---

## 1. What the server actually answers

### 1.1 The headline box — `GET /api/fintrack/dashboard/balance/type?type=debtor`

`routes/dashboardRoutes.js:21` → `dashboardTotalBalanceAccountByType`
(`controllers/dashboardController.js:126`). The debtor SQL is at `:222-239`.

> **Re-anchored 2026-08-30, and one thing changed in kind.** The handler is at
> `:126`, not `:120`, and its debtor SQL at `:222-239`, not `:216-234`. **The
> query no longer sums `ua.account_balance`:** it sums `DERIVED_BALANCE`, the
> module-level constant at `dashboardController.js:23`
> (`derivedAccountBalanceSql('ua')`, from
> `utils/fintrackUtils/accountDataRetrieval/derivedBalance.js:181`). Every figure
> in this payload — total, receivable, payable, and the three counts — is now
> derived from the ledger. That is the change 11.4 and 11.9 were written before,
> and both are corrected there.

Measured payload for the local user:

```
{ "total_debt_balance": -8.91, "debt_receivable": 1.3, "debt_payable": -10.21,
  "debtors": 1, "lenders": 1, "debtors_without_debt": 0, "currency_code": "usd" }
```

- **Unit.** Every amount is the accounting currency, cast to `FLOAT` in SQL, so
  it arrives as a JSON number and not as a `DECIMAL` string. The counts are cast
  to `FLOAT` too, which is odd but harmless.
- **Sign.** `debt_receivable` is the sum of the **positive** balances and
  `debt_payable` the sum of the **negative** ones. Payable is therefore served as
  a negative figure; the screen prints it unchanged.
- **Nullability.** No field can be null. Each is an aggregate over a non-empty
  group, and `user_accounts.account_balance` is `NOT NULL DEFAULT 0.00`
  (`002_accounts.sql:101`). When the user owns **no** debtor at all the query
  returns zero rows and the controller answers **400** with
  `No available accounts of type debtor` (`:273`) — the absence of data is
  reported as an error status, not as an empty payload.
- **Truncation.** The query groups by `ct.currency_code` (`:236`) and the
  controller returns `rows[0]` alone (`:278`). See finding 13.
- The alias written `debtors_without_Debt` (`:228`) reaches the wire lowercased
  as `debtors_without_debt`, because PostgreSQL folds unquoted identifiers. The
  name is correct; nothing on the frontend reads it. See finding 8.

### 1.2 The debtor list — `GET /api/fintrack/dashboard/balance/summary/?type=debtor`

`routes/dashboardRoutes.js:25` → `dashboardAccountSummaryList`
(`dashboardController.js:311`). The debtor SQL is at `:389-406`.
*(Re-anchored 2026-08-30, from `:305` and `:383-401`. This query too now reads
`DERIVED_BALANCE` rather than `ua.account_balance`; the `debtor` and `creditor`
flags are at `:392-393`, receivable and payable at `:390`.)*

Measured payload:

```
[ { "account_name": "Picapiedras, Pedro", "account_id": 20, "total_debt_balance": 1.3,
    "debt_receivable": 1.3, "debt_payable": 0, "debtor": 1, "creditor": 0, "currency_code": "usd" },
  { "account_name": "Palacios, Lucila",  "account_id": 37, "total_debt_balance": -10.21,
    "debt_receivable": 0, "debt_payable": -10.21, "debtor": 0, "creditor": 1, "currency_code": "usd" } ]
```

- `debtor` and `creditor` are aggregates over a group of one row, so they are
  flags: exactly one of the pair is `1` unless the balance is exactly zero, in
  which case **both are `0`** and the row is neither. Nothing on the frontend
  handles that third state.
- Empty answers **400** with `No accounts available of type debtor.` (`:425`).
  Note the word order — it differs from the message the headline endpoint sends.
  ~~and that difference has a consequence.~~ **Corrected 2026-08-30: the
  consequence is gone.** `useFetch.ts:81-90` now carries both word orders, so the
  summary list's message is classified as not-found like the headline's. See
  finding 3.

### 1.3 The detail screen — `GET /api/fintrack/account/:accountId`

`routes/accountRoutes.js:71` → `getAccountById`
(`getAccountController.js:568`). The debtor branch selects
`ua.*, act.account_type_name, ct.currency_code, da.*` at `:715-724`, and the
response wraps a single row as `data.accountList[0]` (`:813-816`).

> **Re-anchored 2026-08-30, and the payload gained two things.** The handler is
> at `:568` (was `:513`), the debtor `SELECT` at `:715-724` (was `:654-664`), the
> wrap at `:813-816` (was `:754-757`).
>
> - **`account_balance` is no longer the stored column.** `:822-824` overwrites
>   it with `derived_account_balance`, selected at `:592` through
>   `derivedAccountBalanceSql('ua','NUMERIC')`, and deletes the temporary key.
>   The comment at `:819-821` states why. It still arrives as a string, so the
>   hazard noted below is unchanged.
> - **`account_start_local_date` is served beside the instant**, at `:836-841`,
>   through `dayInZone`. That is finding 5's fix, and it is the field
>   `DebtorDetail.tsx:326-328` now renders.

Measured payload for account 37 (abridged):

```
account_id 37, account_name "Palacios, Lucila", account_type_id 3, currency_id 1,
account_starting_amount "0.11", account_balance "-10.21", note null,
account_start_date "2026-08-15T04:27:01.473Z", account_type_name "debtor",
currency_code "usd", value "0.11", debtor_name "Lucila", debtor_lastname "Palacios",
selected_account_id 24, selected_account_name "cuenta precargada",
original_value "342.00", original_currency_id 3, exchange_rate "0.00031872",
exchange_rate_source "exchange-rate-api", exchange_rate_target_currency_id 1
```

- **Amounts arrive as strings**, not numbers: `ua.*` applies no `CAST`, so
  `DECIMAL(15,2)` is serialised by node-postgres as `"-10.21"`. Every consumer
  currently coerces it, so this is a hazard rather than a defect today.
- **`account_start_date` is an instant**, `TIMESTAMPTZ`, not a calendar label.
  Anything that renders it has to choose a calendar. See finding 5.
- **Three column names collide.** `user_accounts` and `debtor_accounts` both
  carry `account_id`, `currency_id` and `account_start_date`
  (`002_accounts.sql:82-110` and `:164-184`), and `ua.*, … da.*` selects each
  twice. node-postgres keeps the last, so the served value is
  `debtor_accounts`'. They are equal for both live rows. See finding 14.
  *(Still true 2026-08-30, at `getAccountController.js:715-724`.)*
- `value` is the opening amount in the accounting currency; `original_value` and
  the five FX columns beside it are what migration
  `016_debtor_value_fx_columns.sql` added. Account 37 shows the mechanism
  working: `342.00` of currency 3 typed, `0.11` stored, rate `0.00031872` from
  `exchange-rate-api`. None of the six is read by any debts screen.
- Not found answers **404**, `Account does not exist or user mismatch.` (`:602`,
  re-anchored 2026-08-30 from `:545`).
- The pocket enrichment at `:872-885` (was `:789-801`) deliberately attaches nothing to a debtor:
  `getAccountAllocation` returns null for that type, so `allocated`,
  `unassignedCash`, `isOverAllocated` and `pockets` are simply absent from a
  debtor payload.

### 1.4 The statement — `GET /api/fintrack/account/transactions/:accountId?start=&end=`

`routes/accountRoutes.js:73` → `getTransactionsForAccountById`.

`summary.periodStartDate` and `periodEndDate` are `YYYY-MM-DD` **calendar
labels**, resolved in the owner's timezone and clamped to the life of the
account (`clampToAccountLife` at `:48-55`, `accountStartDay` at `:189-199`).
`initialBalance.date` and `finalBalance.date` are normally
`transaction_local_date`, also the owner's calendar. ~~The one exception is the
branch that fires when nothing moved before the window opened (`:390-397`), which
dates the carried-in balance by slicing the instant in UTC.~~
**Corrected 2026-08-30: there is no exception left.** `getBalanceCarriedIntoPeriod`
(`:388-440`) resolves both the balance and its day in a single statement, the day
as `(ua.account_start_date AT TIME ZONE $3)::date::text` at `:421`, and the
comment at `:389-395` records the defect that was removed. See finding 6.

### 1.5 The tracker dropdown — `GET /api/fintrack/account/type/?type=debtor`

`routes/accountRoutes.js:69` → `getAllAccountsByType` (`getAccountController.js:250`),
debtor SQL at `getAccountController.js:374-398` *(re-anchored 2026-08-30 from
`:354-379`; the balance it serves is now `DERIVED_BALANCE AS account_balance` at
`:378`, not the stored column)*. Serves `account_id`, `account_name`,
`account_balance` (cast, a number), `account_type_name`, `currency_code`,
`starting_value` (a string), `debtor_name`, `debtor_lastname`,
`selected_account_id`, `account_start_date`, `account_starting_amount`.

### 1.6 Creation — `POST /api/fintrack/account/new_account/debtor`

`accountCreationController.js:460-986` (`createDebtorAccount`). Worth recording
because it decides what the read paths can ever contain: the `user_accounts` row
is always inserted with `accountingCurrencyId` (`:732`), never with the currency
the user picked. That is what keeps the currency grouping in 1.1 to a single
group today. *(Re-anchored 2026-08-30 from `:446-925` and `:693`. Every other
anchor this document gives into this file has moved by the same rewrite: the
composed name is at `:503`, the creation-time uniqueness check at `:602`, the
sign applied to both figures at `:678-681`, and the two `account_start_date`
writes at `:735` and `:757`.)*

---

## 2. Field-by-field reconciliation

**The debts board does not have the pocket board's defect.** Every name the two
board components destructure is served under that exact name. This was checked
by running both queries and comparing the returned keys against the destructuring
sites, not by reading the types.

| consumer | fields destructured | served? |
| --- | --- | --- |
| `DebtsLayout.tsx:34-67` | `total_debt_balance`, `debt_payable`, `lenders`, `debtors`, `debt_receivable`, `debtors_without_debt`, `currency_code` | all 7 served |
| `ListOfDebtors.tsx:124-133` | `account_name`, `account_id`, `currency_code`, `total_debt_balance`, `debt_receivable`, `debt_payable`, ~~`debtor`, `creditor`~~ | 6 destructured, all served — the two flags are commented out at `:131-132` |
| `DebtorDetail.tsx` | `account_balance`, `account_type_name`, `account_start_date`, `currency_code`, `account_name`, `account_id`, **and now `account_start_local_date`** | all 7 served |
| `SummaryDebtorDetailBox.tsx:29` | `creditor`, `total_debt_balance`, `currency_code` | all 3 present on the object it is handed |
| `tracker/debts/Debts.tsx:186-194` | `account_name`, `account_id`, `currency_code`, `account_balance`, **and `account_start_date`**, which `:187` filters on | all 5 served |

> **Re-anchored 2026-08-30.** Every row's line numbers moved; the finding the
> table exists to state — *nothing resolves to `undefined` at runtime* — is
> re-verified and still holds. Two rows changed shape: `ListOfDebtors` no longer
> destructures the `debtor`/`creditor` flags, deriving its label from
> `debt_payable + debt_receivable` at `:135-136`; and the tracker's debtor
> dropdown now reads `account_start_date` so it can hide an account not yet open
> on the day in the picker.

Nothing resolves to `undefined` at runtime. The defects in this module are of a
different family: fabricated placeholder data presented as answers, a
route-relative link that resolves onto the wrong path, and a calendar read in
the wrong zone.

---

## 3. Findings, ranked by consequence times reachability

> **This ranking is the audit's. The developer's priority bands, ruled on
> 2026-08-29, are in section 10.6, and where the two differ his is the
> decision.** The bands agree on severity and differ on sequencing; the four
> differences are named there with the reasoning for each.

> ### 🔁 Re-measured 2026-08-30 — twelve of the nineteen findings are closed in code
>
> Working tree of `fix/auth-screen`, `HEAD` `e919a89`, **uncommitted changes
> included**: `DebtsLayout.tsx`, `debts/components/DebtsBigBoxResult.tsx`,
> `debts/styles/debts-styles.css` and
> `debtorDetail/summaryDebtorDetailBox/SummaryDebtorDetailBox.tsx` and its
> stylesheet are all modified and unstaged as this is read, so every anchor below
> is read against the working tree and not against `HEAD`.
>
> Each finding's own text is left standing beneath this table — the diagnosis is
> what the fix was measured against. Nothing here reorders a band, closes a
> decision, or touches sections 8, 10, 11 or 12 as rulings.
>
> | # | finding | state, measured 2026-08-30 |
> |---|---|---|
> | 1 | the detail screen unreachable from the navigation | **closed.** `ListOfDebtors.tsx:146-149` renders an absolute `to={`/fintrack/debts/debtors/${account_id}`}` with the reason in the source at `:141-145`; the duplicate index route is now a `<Navigate to='debtors' replace />` (`App.tsx:235-238`) |
> | 2 | the "New Debtor" button broken on one of the two URLs | **closed.** `Debtors.tsx:9` declares `NEW_DEBTOR_ROUTE = '/fintrack/debts/debtors/new_profile'` and `:20` navigates to it, so nothing is appended to `useLocation().pathname` any more |
> | 3 | the fabricated debtor row on empty, loading and error | **closed.** `defaultDebts` is gone. `ListOfDebtors.tsx` now branches on error with a retry (`:50-68`), a skeleton (`:70-91`), and a stated empty message (`:95-105`). **The server-side half closed too:** `useFetch.ts:81-90` carries both word orders, `'No available accounts'` **and** `'No accounts available of type'`, with the comment at `:85-88` naming the summary list as the reason |
> | 4 | the fabricated account on the detail screen | **closed.** `DebtorDetail.tsx:140` holds `accountDetail: AccountListType \| null` and the seeds are deleted; the comment at `:135` records what they were |
> | 5 | the opening date printed one day late | **closed server-side, as ruled.** `getAccountController.js:836-841` resolves `account_start_local_date` through `dayInZone(instant, timeZone)` and serves it beside the instant, with the reason at `:827-835`; `DebtorDetail.tsx:326-328` renders that label |
> | 6 | the statement's carried-in date | **closed.** The JavaScript branch is gone: `getTransactionsForAccountById.js:414-422` resolves both the carried-in balance and its day in one SQL `COALESCE`, dating it `(ua.account_start_date AT TIME ZONE $3)::date::text`. The comment at `:389-395` states the defect it replaced |
> | 7 | receivable and payable swapped in the detail bubble | **closed.** `DebtorDetail.tsx:77-78` now reads `debt_receivable: balance > 0 ? balance : 0` and `debt_payable: balance < 0 ? balance : 0`, which matches the server |
> | 8 | the zero-balance count computed and discarded | **live.** Anchors moved: commented destructuring at `DebtsLayout.tsx:41`, still written into the memo at `:56`, still a dependency at `:66` |
> | 9 | every headline figure falls back to a literal zero | **closed.** `DebtsLayout.tsx:48-58` coalesces to `null`, never `0`, with the rule in the comment at `:44-46`; `DebtsBigBoxResult.tsx:27-30` prints an em dash for `null` and `:75`/`:89` do the same for the two counts. The three panels — skeleton, error with retry, stated empty — are the ternary chain at `DebtsLayout.tsx:114-147`, prefaced by the comment at `:107-112` |
> | 10 | the editor previews a name the server will not store | **closed.** `accountEditSchema.ts:183-186` composes `[lastname, name].filter(Boolean).join(', ')`; the comment at `:174-181` states the separator rule and the half-typed case |
> | 11 | renaming a debtor onto an existing name is not refused | **closed.** See the block under the finding |
> | 12 | the detail bubble formats its amount by hand | **closed.** `SummaryDebtorDetailBox.tsx:39-42` calls `currencyFormat` and prints an em dash when the figure is not a number; the comment at `:35-38` names the three defects it removed |
> | 13 | a second currency silently dropped from the headline | **still latent, unchanged.** `dashboardController.js:236` groups by `ct.currency_code` and `:278` returns `rows[0]` |
> | 14 | three column names collide in the detail query | **live.** `SELECT ua.*, …, da.*` is now at `getAccountController.js:715-724` |
> | 15 | the statement window computed on the browser's clock | **live.** `DebtorDetail.tsx:119-120` still round-trips through `.toISOString().split('T')[0]`. The helper the fix wants, `toCalendarDay`, is now **committed** at `helpers/functions.ts:355` |
> | 16 | rows keyed by array index | **live.** `key={indx}` moved to `ListOfDebtors.tsx:139` |
> | 17 | the sort mutates a module-level constant | **closed.** `ListOfDebtors.tsx:109` sorts a spread copy, and the comment at `:107-108` states why |
> | 18 | hardcoded colours and a debug border | **live**, anchors moved: `summaryDebtorDetailBox-style.css:35`, `:44`, `:55`; `debts-styles.css:3` still carries `border: 0px solid blue` |
> | 19 | a class name written as a selector | **live.** `boxComponents.tsx:6` still renders `className='box__container .flx-row-sb'` |
>
> **And the fifth state of 12.4 is implemented.** `DebtorDetail.tsx:176` computes
> `isAccountMissing = status === 404` and branches on it, which is what 12.4 said
> the screen had to do with a status it was already handed.
>
> **Seven remain live: 8, 13, 14, 15, 16, 18 and 19** — of which 13 is still
> latent rather than reachable. Their bands are the developer's and are not
> touched here. Both formatter traps of §5 are disarmed on every debts call site;
> §5 carries that measurement.

### 1. The debtor detail screen cannot be opened from the app's own navigation

**What is wrong.** The main navigation sends the user to one debts URL and the
list's link is built for the other one, so clicking a debtor lands on the error
page.

**Where.** `general_components/mainNavbar/MainNavbar.tsx:17` points the debts
section at `/fintrack/debts/debtors`. That URL matches the child route declared
at `App.tsx:238`, whose matched pathname is `/fintrack/debts/debtors`.
`ListOfDebtors.tsx:107-110` renders `<Link to={`debtors/${account_id}`}>` with
no `relative` prop, so react-router 7 resolves it against that matched route and
produces `/fintrack/debts/debtors/debtors/20`. No route declares that path — the
detail route is `debts/debtors/:debtorId` at `App.tsx:328` — so the match falls
through to the `errorElement` at `App.tsx:153`.

**Reachable today.** Yes, unconditionally, from the only entry point the app
offers. It resolves correctly only from `/fintrack/debts`, which nothing links
to. This is why the module "looks built": the board renders, and the screen
behind it is simply not reachable.

**What the user sees.** The error page, on every debtor they click.

**Fix.** Make the link absolute — `/fintrack/debts/debtors/${account_id}` — in
`ListOfDebtors.tsx:108`. That is better than deleting the duplicate route,
because the "New Debtor" button in finding 2 depends on the `debtors` URL being
the live one, and removing the route would move a second defect instead of
closing one. Frontend only.

### 2. The "New Debtor" button is broken on whichever URL the link is not

**What is wrong.** The two debts URLs are interchangeable in the route table but
not in the code, and each control works on exactly one of them.

**Where.** `Debtors.tsx:12-16` navigates to `originRoute + '/new_profile'`,
where `originRoute` is the raw `useLocation().pathname`. The declared route is
`debts/debtors/new_profile` (`App.tsx:299`). From `/fintrack/debts/debtors` the
button works; from `/fintrack/debts` — the index route at `App.tsx:229`, which
renders the same `Debtors` component — it produces `/fintrack/debts/new_profile`
and hits the error page.

**Reachable today.** Latent while the navbar keeps sending users to
`/fintrack/debts/debtors`, and armed the moment finding 1 is fixed by moving the
navbar instead of the link. It is the reason finding 1's fix has to be the link.

**Fix.** Once one URL is canonical, delete the other child route so the pair
cannot drift again.

### 3. On empty, loading or error the list shows a debtor that does not exist

**What is wrong.** Three distinct fetch states collapse into one fabricated row
that is indistinguishable from a real debtor.

**Where.** `ListOfDebtors.tsx:19-30` declares `defaultDebts`, a single row with
`account_name: 'account_name'`, `account_id: 9999999`, a zero balance and
`debtor: 1`. `:48-73` substitutes it whenever `apiData` is absent, `isLoading` is
true, `error` is set, **or** the list is empty. `isLoading` and `error` are
destructured at `:40` and never rendered anywhere in the component.

**Reachable today.** Yes, for any user with no debtors — which is every new user.
Measured mechanism: the summary endpoint answers 400 with
`No accounts available of type debtor.` (`dashboardController.js:419`), and the
not-found allow-list in `hooks/useFetch.ts:81-85` contains
`'No available accounts'` — the other word order. The substring test at `:86`
fails, so an empty result is classified as a hard error, `apiData` is nulled and
the placeholder row renders. It is also reachable for a fraction of a second on
every load.

> **Corrected 2026-08-30 — the mechanism is fixed on both sides, and the
> allow-list has four entries now, not three.**
>
> **Server message anchor:** `dashboardController.js:425`, not `:419`; the
> headline endpoint's message is at `:273`, not `:267`.
>
> **The word-order gap is closed.** `useFetch.ts:81-90` lists
> `'No accounts of type:'`, `'No transactions encountered'`,
> `'No available accounts'` **and** `'No accounts available of type'`, the last
> added with the comment at `:85-88` naming the summary list as the reason. The
> substring test is at `:91`, not `:86`, and it now succeeds for an owner with no
> debtors, so that answer arrives as not-found — no error, `apiData` null —
> instead of as a hard error.
>
> **Every reference in this document to "the three substrings at `:81-85`" should
> be read as four at `:81-90`.** That includes the `12.4` extension immediately
> below and the repeat at 11.8. The conclusion each of them draws is unaffected:
> the detail endpoint's 404 message, `Account does not exist or user mismatch.`
> (`getAccountController.js:602`), matches **none** of the four, so it still
> arrives as a real error carrying `status: 404` — and `DebtorDetail.tsx:176`
> now branches on exactly that.

**What the user sees.** A debtor called `account_name` owing `$0.00`, marked
`debtor`, linking to `debtors/9999999`. No spinner, no error, no empty state.

**Fix.** Render the three states separately and drop `defaultDebts`.

**Extended 2026-08-29 (12.4).** The developer adds a fourth state that
deletion makes reachable: a debtor deleted in another tab answers `404` on
return, which is **resource-not-found**, never an empty debtor state and never
a fabricated account. Measured: the mechanism already exists — `useFetch`
returns `status` (`:9`, `:129`) and the detail 404 message matches none of the
three not-found substrings at `:81-85`, so it arrives as a real error carrying
`status: 404`. Nothing new is authored; the screen branches on it.
 Aligning
the server's two "no rows" messages, or better, having both endpoints answer
`200` with an empty payload, is the same fix seen from the server side and would
also close finding 9. Frontend, plus `dashboardController.js` — not one of the
three files the pocket sequence touches.

### 4. The detail screen renders a sample account as if it were the account

**What is wrong.** Placeholder constants seed the screen's state and are
formatted and displayed as real figures, permanently if the fetch fails.

**Where.** `DebtorDetail.tsx:69-78` seeds `accountDetail` with
`Lastname, name example`, balance `10`, type `debtor`, currency `usd` and
today's date. `:80-81` seeds the statement from
`DEFAULT_ACCOUNT_TRANSACTIONS['data']` (`helpers/constants.ts:231-252`): an
initial balance of `1010.55` dated 2025-06-15, a final balance of `902.55`, and
a period of 2025-05-18 to 2025-06-18. The effects at `:156-178` overwrite them
only on success. The heading at `:203` prints `bubleInfo.account_name`, `:227`
prints the balance through `numberFormatCurrency`, and `AccountBalanceSummary`
at `:279` prints the sample balances through `currencyFormat`.

**Reachable today.** Yes, in two ways. On a direct load or a refresh of a debtor
URL there is no `location.state`, so the fabricated bubble renders until the
fetch resolves. On a 404 or a network failure it never resolves and the sample
figures stay on screen for good.

**What the user sees.** `LASTNAME, NAME EXAMPLE`, a current balance of `10.00`,
an initial balance of `$1,010.55 (15-06-2025)` — with a line of error text far
below at `:296-298`.

**Fix.** Nullable state plus explicit skeleton and error branches. Frontend only.

### 5. A debtor's opening date is printed one day late

**What is wrong.** An instant is rendered on the UTC calendar instead of the
owner's.

**Where.** `DebtorDetail.tsx:250` passes `accountDetail.account_start_date` — a
`TIMESTAMPTZ` instant — to `formatDateToDDMMYYYY` (`helpers/functions.ts:379-390`),
which reads it with `getUTCDate`, `getUTCMonth` and `getUTCFullYear`.

**Reachable today.** Yes, and measured on live data. Account 37 was opened at
`2026-08-15T04:27:01.473Z`; the owner's timezone is `America/Bogota`, so the day
they lived was **2026-08-14**. The screen prints **15-08-2026**. Every debtor
created between 19:00 and midnight local time is affected.

**What the user sees.** "Starting Point: 15-08-2026" for a loan they made on the
14th.

**Fix.** Serve a calendar label resolved in the owner's zone alongside the
instant, as `getTransactionsForAccountById` already does with
`transaction_local_date`, and render that. Note that `formatDateToDDMMYYYY` is
**correct** for a `YYYY-MM-DD` label — reading a UTC-parsed label with UTC
getters cannot shift — so the helper does not need changing; the input does.
This lands in `getAccountController.js`. **Sequenced behind the pocket work.**

**Ruled 2026-08-29 (10.4, Rule 2).** This and the statement date (6) are not
independent bugs but one class: an instant read as though it were a calendar
day. The conversion takes `users.timezone` and happens once, server-side. The
helper is already written — `dayInZone(instant, timeZone)` at
`date-utils/resolveZonedWindow.js:46` — so nothing new is authored. A frontend
fix using the profile's stored zone
(`auth/auth_utils/profileTransformation.ts:56`) is available and is refused: it
moves the conversion into the client. See 10.6, difference 1.

### 6. The statement panel prints two different dates for the same event

**What is wrong.** One line of an otherwise timezone-correct controller resolves
a date in UTC, so the carried-in balance is dated one day after the period it
opens.

**Where.** `getTransactionsForAccountById.js` resolves everything in the owner's
zone: the period bounds at `:225-235`, `transaction_local_date` in SQL at `:243`
and `:313`, and the prior-balance date at `:403`. The exception is the branch at
`:390-397`, taken when no movement precedes the window, which dates the balance
with the local helper at `:357`, `date => date.toISOString().split('T')[0]` — a
UTC slice of `account_start_date`.

**Reachable today.** Yes, measured on account 37 with the exact window
`DebtorDetail.tsx:143-147` sends. The period is clamped to the account's opening
day, `2026-08-14`; the opening transaction is at `2026-08-15T04:27Z`, which is
not *before* the boundary `2026-08-14T05:00Z`, so the branch fires.

**What the user sees.** `Period 14-08-2026 / 29-08-2026` with
`Initial Balance $0.11 (15-08-2026)` directly beneath it — an opening balance
dated after the period opens.

**Fix.** Use the zoned day the same function already computes as
`accountStartDay` (`:227`). One line. `getTransactionsForAccountById.js` is not
one of the three shared files — **workable in parallel.**

**Ruled 2026-08-29 (10.3).** Surgical, not a refactor: the resolved day is
already in scope as `accountStartDay` at `:227`, and the branch at `:390-397`
should use it instead of the UTC slice at `:357`. Its stake rises once deletion
exists — 11.6, case 10.

### 7. Receivable and payable are swapped when the detail screen builds its own bubble

**What is wrong.** The frontend's local reconstruction of the list row inverts
the server's definition of the two fields.

**Where.** `DebtorDetail.tsx:60-63` sets `debt_receivable` from a **negative**
balance and `debt_payable` from a **positive** one. The server
(`dashboardController.js:384-385`) defines receivable as the positive side and
payable as the negative one. The `creditor` and `debtor` flags at `:64-65` are
correct, which is what hides the inversion.

**Reachable today.** Latent. `SummaryDebtorDetailBox.tsx:21` reads only
`creditor`, `total_debt_balance` and `currency_code`, so neither inverted field
reaches a pixel. It arms the moment the detail screen shows a receivable or
payable figure — which any redesign of that card will do.

**Fix.** Swap the two expressions. Frontend only.

### 8. The count of debtors whose balance is zero is computed, transmitted and discarded

**What is wrong.** A figure the server goes to the trouble of computing reaches
no screen, and the code that would have shown it is half-deleted.

**Where.** `dashboardController.js:228` computes it;
`DebtsLayout.tsx:41` has the destructuring commented out, `:56` still writes it
into the memo's return object, and `:66` still lists it as a memo dependency.
The value is therefore built on every render and read by nobody.
*(Re-anchored 2026-08-30 from `:222`, `:38`, `:50`, `:60`. The finding is still
live, unchanged in every respect except its line numbers.)*

**Reachable today.** The dead code path is live; the figure is not.
Measured value for the local user: `0`.

**What the user sees.** Nothing — and that is the finding. A debtor with a
settled balance appears in neither the `debtors` count nor the `lenders` count
on the headline box (`DebtsBigBoxResult.tsx:75` and `:89` — *re-anchored
2026-08-30 from `:59,75`; both now print an em dash when the count is `null`*),
so the two counts silently fail to add up to the number of rows in the list below
them.

**Fix.** Either render it as a third count or delete the memo entry and the
dependency. Rendering it is the better answer, because the two counts already on
screen are presented as a decomposition of the list and currently are not one.
This is a product decision.

**Ruled 2026-08-29 (10.3).** Render it, as **three categories rather than
two** — those who owe, those owed, and those settled — presented as an
exhaustive partition that adds up to the number of rows in the list. **Not in
the critical batch; it waits.** One dependency his order does not show: the
CLOSE operation of the account-deletion plan settles a residual to zero, and
"settled" is defined by a zero balance, so the four debtor read paths must
decide what a closed debtor is first — 11.4 and 11.7.

*(The cross-reference here read "section 6" and was wrong: the open decisions
were section 8, and the rulings are section 10. Corrected on discovery.)*

### 9. Every figure on the headline box falls back to a literal zero

**What is wrong.** Missing data is rendered as a confident `$0.00`, which the
project's own frontend rule forbids.

**Where.** `DebtsLayout.tsx:42-52` coalesces all seven fields with `?? 0` (and
the currency with `?? DEFAULT_CURRENCY`). `DebtsBigBoxResult.tsx:42,51,67`
formats them.

**Reachable today.** Yes, for any user with no debtors. The headline endpoint's
400 message, `No available accounts of type debtor` (`dashboardController.js:267`),
**does** match the allow-list in `useFetch.ts:81-85`, so the hook clears the
error and nulls the payload — the screen shows zeros with no error at all. It is
also reachable on a genuine failure, where the red message at
`DebtsLayout.tsx:115-128` clears itself after three seconds (`:24-30`) while the
zeros remain.

**What the user sees.** `YOU'RE OWED / total $0.00 / receivable $0.00 /
debtors 0 / payable $0.00 / lenders 0` — a statement of fact about a module that
answered nothing.

**Fix.** Skeletons while loading, a dash for an absent figure, a distinct empty
state, and an error that persists with a retry (`useFetch` already exposes
`refetch`). Frontend only.

### 10. The editor previews an account name the server will not store

**What is wrong.** The read-only derived name in the edit form is composed with a
different separator from the one both write paths use.

**Where.** `editionAndDeletion/validations_zod/accountEditSchema.ts:216-220`
computes `` `${lastname} ${name}` `` — a space. Creation composes
`` `${debtorLastnameInput}, ${debtorNameInput}` ``
(`accountCreationController.js:489`) and editing composes
`` `${normalizePersonName(debtorLastname)}, ${normalizePersonName(debtorName)}` ``
(`accountEditController.js:239`) — a comma and a space.

**Reachable today.** Yes, on every open of a debtor's editor.

**What the user sees.** The preview reads `Palacios Lucila` while the list, the
detail heading and the database all read `Palacios, Lucila`.

**Fix.** One string in the schema. Frontend only.

### 11. Renaming a debtor onto an existing debtor's name is not refused

**What is wrong.** The debtor branch of the edit controller rebuilds
`account_name` without the collision check its sibling branch runs.

**Where.** `accountEditController.js:205-241`. The `category_budget` case checks
at `:183-196`; the `debtor` case at `:239` writes the rebuilt name straight
through. Creation does check, via `verifyAccountExistence`
(`accountCreationController.js:588`, which throws on a hit).

**Reachable today.** Yes, whenever the user owns two debtors and renames one onto
the other. Nothing at the database level stops it: `user_accounts` has no unique
constraint on `(user_id, account_name, account_type_id)`.

**What the user sees.** Two rows with the same name in the list — and, in the
tracker, a dropdown whose `debtorIdMap` (`tracker/debts/Debts.tsx:176`) is keyed
by name, so one of the two duplicates becomes unselectable and movements silently
go to the other.

**Severity — raised.** The developer moved this from moderate to **high** on
2026-08-29, against this audit's ranking, and his reasoning is the better one.
This audit ranked it on the visible symptom, two rows carrying one label. He
ranked it on the lookup: because `debtorIdMap` is keyed by name, a rename onto an
existing name makes one of the two debtors **disappear logically** from the
tracker — unselectable, with every movement aimed at it routed silently to the
survivor. That is a wrong figure the owner acts on, not a cosmetic duplicate.
His ranking stands.

**Fix.** Run the same check the category branch runs.
`accountEditController.js` is one of the three shared files —
**sequenced or coordinated with the pocket work**, though the change is confined
to the `debtor` case of the switch and the pocket work is confined to the
`pocket_saving` case.

> **CLOSED — measured 2026-08-30, and not the way this finding proposed.**
>
> **What the finding asserts.** That `accountEditController.js:205-241` rebuilds
> the debtor's `account_name` and writes it through unchecked, while the
> `category_budget` case checks at `:183-196`, so two debtors can be made to share
> a name by renaming one onto the other.
>
> **What the code says.** There is no per-case check any more. One collision query
> sits **after** the whole switch, at `accountEditController.js:239-264`, guarded
> by `if (userAccountFields.account_name !== undefined)`, keyed on
> `ua.user_id` + `LOWER(ua.account_name)` + `LOWER(act.account_type_name)`, with
> `ua.account_id <> $4` and `ua.deleted_at IS NULL`, answering `400` at `:257-262`.
> The `debtor` case at `:185-223` still rebuilds the name (`:219`) — and the check
> below it now reads that rebuilt name, which is exactly what the finding asked
> for. The source comment at `:225-238` states the placement and the reason:
> *"Placed after the switch because the name is not always the payload's."*
>
> **The fix was not "run the same check the category branch runs" — that check was
> keyed too widely.** It carried no account-type predicate, so lifting it verbatim
> would have refused renaming a debtor onto a name held by a **bank** account,
> which creation permits. The lifted query joins `account_types` and adds
> `LOWER(act.account_type_name) = LOWER($3)`, so rename and creation now enforce
> the same key. That correction is recorded in
> `PLAN_ACCOUNT_NAME_UNIQUENESS.md` §10, which owns the change.
>
> **What this does NOT close.** The database still has no unique index on
> `(user_id, account_name, account_type_id)` — re-verified — so the invariant
> recorded at 12.6, item 4 is still enforced in code on both write paths and
> nowhere in the schema. That item stands exactly as written.
>
> **The severity ruling is untouched.** The developer raised this to high on the
> lookup argument, and `debtorIdMap` is still keyed by `account_name`
> (`tracker/debts/Debts.tsx:189`, read at `:454`), so the mechanism he ranked it on
> is unchanged — it is now unreachable through the editor rather than absent.

### 12. The detail bubble formats its amount by hand

**What is wrong.** One amount in the module is composed from a symbol and
`toFixed` instead of going through the shared formatter, so it is punctuated
differently from every other amount on the screen.

**Where.** `SummaryDebtorDetailBox.tsx:30-31`:
`getCurrencySymbol(...)` followed by `Number(amount).toFixed(2)`.

**Reachable today.** Yes, on every debtor detail screen.

**What the user sees.** `$-10.21` where `currencyFormat` produces `-$10.21`, and
`$1234.50` where the rest of the app shows `$1,234.50`. It is also the one place
in the module where a missing figure would render as the literal `NaN`, since
`Number(undefined).toFixed(2)` is `"NaN"` — not reachable today, because the
value always arrives either from the list row or from the account balance.

**Fix.** Call `currencyFormat`. Frontend only.

### 13. A second currency would be silently dropped from the headline

**What is wrong.** The totals query groups by currency and the controller returns
only the first group.

**Where.** `dashboardController.js:231` groups; `:272` returns
`accountTotalBalanceResult.rows[0]`.

**Reachable today.** **No.** Every debtor's `user_accounts` row is inserted with
`accountingCurrencyId` (`accountCreationController.js:693`), so there is exactly
one group. Measured: one group, `usd`, two accounts. What the user picks in the
form is preserved as FX metadata on `debtor_accounts` (migration 016), never as
the account's own currency — which is the currency model working as designed.

**Consequence if armed.** A totals panel that reports a subset of the debts as
though it were all of them, with no indication that anything was dropped. It arms
the day a debtor account is written in a non-accounting currency.

**Fix.** Not urgent. When it is addressed, the answer is to sum across
currencies after conversion rather than to return more rows, because the panel
has one headline figure and no place to put a second.

### 14. Three column names collide in the detail query

**What is wrong.** `SELECT ua.*, …, da.*` selects `account_id`, `currency_id`
and `account_start_date` twice, and the driver silently keeps the last.

**Where.** `getAccountController.js:715-724` *(re-anchored 2026-08-30 from
`:654-664`; the `SELECT ua.*, …, da.*` is unchanged)*, against the two table
definitions in `002_accounts.sql:82-110` and `:164-184`.

**Reachable today.** Latent. Measured: both live rows have
`user_accounts.account_start_date = debtor_accounts.account_start_date`, and both
`currency_id` values are `1`. The two dates are written from the same variable at
creation (`accountCreationController.js:696` and `:718`), so they agree — but the
edit path writes neither, and no constraint keeps them in step.

**Consequence if armed.** The detail screen would show a start date the rest of
the app does not use, with no error anywhere.

**Fix.** Name the columns explicitly. `getAccountController.js` is one of the
three shared files — **sequenced behind the pocket work.**

### 15. The statement window is computed on the browser's clock

**What is wrong.** The period the detail screen asks for is built from local
midnight and then serialised in UTC.

**Where.** `DebtorDetail.tsx:111-120` *(re-anchored 2026-08-30 from `:133-144`)*:
`new Date(y, m, d)` builds local-midnight instants at `:111-116`, and
`.toISOString().split('T')[0]` reads them back in UTC at `:119-120`. Still live.

**Reachable today.** Not for this user. West of UTC — `America/Bogota` — local
midnight is still the same date in UTC and both bounds are right. East of UTC
both bounds land a day early, so the statement silently omits the last day of
the current month.

**Fix.** Compose the two labels from the local getters rather than round-tripping
through `toISOString`. Frontend only.

**Updated 2026-08-29, 17:34.** The helper this fix needs now exists: another
session added `toCalendarDay(instant)` to `helpers/functions.ts:355` in the
working tree (uncommitted), whose comment states the developer's Rule 2 in the
same words — *a Date is a moment in time; a deadline is a label on a calendar*,
and `toISOString().slice(0, 10)` has the same defect. **The fix at
`DebtorDetail.tsx:133-144` becomes two calls to it**, and no new helper is
authored. Reuse it rather than writing a third.

**Confirmed 2026-08-30.** `toCalendarDay` is **committed** and still at
`helpers/functions.ts:355`, beside `formatCalendarDate` at `:330`; the tracker
already consumes it (`PnL.tsx:460`, `NewPocket.tsx:203`). The fix is two calls at
`DebtorDetail.tsx:119-120`.

### 16. Rows are keyed by array index over a list that is re-sorted

`ListOfDebtors.tsx:139` uses `key={indx}` on a list sorted at `:109-118`, while
`account_id` is served and unique. Not the pocket module's defect — the keys are
at least distinct — but React will reconcile the wrong rows when the sort order
changes. Frontend only. *(Re-anchored 2026-08-30 from `:105` and `:75-84`. Still
live, and now the only defect left in that file.)*

### 17. The sort mutates a module-level constant

~~`ListOfDebtors.tsx:75` calls `debtList.sort()` in place. When the fetch has not
succeeded, `debtList` **is** `defaultDebts` (`:19`), a module-level array shared
by every mount.~~ Harmless while the placeholder has one element; it is the kind of
thing that stops being harmless quietly. Frontend only.

> **CLOSED — measured 2026-08-30.** Both halves of the mechanism are gone.
> `defaultDebts` no longer exists, and `ListOfDebtors.tsx:109` sorts a spread
> copy: `const debtList = [...debtors].sort(...)`. The comment at `:107-108`
> states the reason — *"On a copy: the array being sorted is the hook's own
> state, and sorting in place rewrites what the hook holds"* — which is the wider
> version of this finding, since the hazard survived the placeholder's removal.

### 18. Hardcoded colours and a debug border in the module's CSS

`summaryDebtorDetailBox/styles/summaryDebtorDetailBox-style.css:35,44,55` writes
`#141414` and `#5b5b5b` where the token system requires `var(--token)`.
`debts/styles/debts-styles.css:3` still carries `border: 0px solid blue`, a
debugging leftover. Frontend only. *(Re-anchored 2026-08-30 from `:32,35,46`,
against the modified working copy of that stylesheet. Three raw values, all
still there: `#141414` at `:35`, `#5b5b5b` at `:44` and `:55`. The debug border
is unmoved at `debts-styles.css:3`. The surrounding rules are already tokenised —
`var(--creme)` at `:4`, `var(--dark)` at `:5` and `:15` — so these three are the
survivors, not the norm.)*

### 19. A class name written as a selector

`debts/components/boxComponents.tsx:6` renders
`className='box__container .flx-row-sb'`. The leading dot makes it a literal
class token named `.flx-row-sb`, which matches no rule, so the row's flex layout
comes from somewhere else or not at all. Frontend only. *(Re-verified 2026-08-30,
unmoved and unchanged. The sibling `BoxRow` at `:10` writes the same class
correctly, without the dot, which is what makes it a slip rather than a
convention.)*

---

## 4. Dead and inert controls — the report is inverted

**The control at `DebtorDetail.tsx:244` is not dead** *(re-anchored 2026-08-30
from `:208`, moved by that screen's own rewrite)*. It is an
`AccountEditLink` (`general_components/accountEditLink/AccountEditLink.tsx`),
a real `<Link>` to `/fintrack/account/${accountId}/edit`, and that route is
declared at `App.tsx:376`. It passes `returnRoute`, `accountName` and
`originRoute`, and it carries an `aria-label`. It works.

**The dead twin was on the pocket detail screen, not the debtor one.** At the
first pass of this audit, `pocketDetail/PocketDetail.tsx:161` still rendered
`<div id='edit' className='flx-col-center icon3dots'><Dots3LightSvg /></div>`
above a commented-out `<Link to='edit'>` — a `div` with no handler, no focus and
no destination — while the debtor screen had already been migrated. The report
this audit was asked to check had the two screens the wrong way round:
**refuted.**

That file is being rewritten by another session while this audit runs (see the
note at the end of section 9). Re-measured at 17:04: the dead `div` is gone from
the working copy of `PocketDetail.tsx`, which now carries **no** edit control at
all, and `icon3dots` survives in the whole `frontend/src` tree only inside two
explanatory comments. Three screens use `AccountEditLink` —
`accountDetail/AccountDetail.tsx:192`, `categoryDetail/CategoryDetail.tsx:328`
and `debtorDetail/DebtorDetail.tsx:244` — and the pocket detail card is mid-flight
with none. That is the pocket module's business, not the debts module's, and is
recorded here only to close the question that was asked.

> **Re-verified 2026-08-30**, at `HEAD` `e919a89` with `PocketDetail.tsx` still
> modified in the working tree. All three claims hold: that file renders no edit
> control; the three `AccountEditLink` call sites are the same three, the debtor
> one now at `:244`; and `icon3dots` appears in `frontend/src` only inside
> explanatory comments and in two orphaned stylesheet rules —
> `accountingDashboard-styles.css:457` and `forms-styles.css:366` — that no
> element uses.

Sweep of the remaining debts controls: the back arrow
(`DebtorDetail.tsx:199`) targets an absolute path and works; the "New Debtor"
button (`Debtors.tsx:29-35`) is a real `<button>` ~~whose destination is
conditionally wrong (finding 2)~~ — **corrected 2026-08-30: its destination is now
the declared route, held as the constant `NEW_DEBTOR_ROUTE` at `Debtors.tsx:9`
and navigated to at `:20`, so finding 2 is closed**; the transaction rows route through
`useTransactionDetail` and open the shared modal. No other inert control was
found.

---

## 5. The two formatter traps

Both traps described in the brief are real, and **neither is armed on any debts
screen.** This was checked call site by call site rather than assumed.

`currencyFormat(code, null)` prints `$0.00` because a JavaScript default
parameter fires on `undefined` only and `Intl.NumberFormat.format(null)` coerces
to zero (`helpers/functions.ts:19-35`). The debts call sites are
`ListOfDebtors.tsx:115`, `DebtsBigBoxResult.tsx:42,51,67` and
`AccountBalanceSummary.tsx:26,36`. Every one of them is fed by a `?? 0` in
`DebtsLayout.tsx:42-52`, by the `defaultDebts` substitution in
`ListOfDebtors.tsx:48-73`, or by a server field that cannot be null. The guard
that disarms the trap is the same `?? 0` that produces finding 9 — closing
finding 9 by removing those coalescers **arms this trap**, so the two have to be
fixed together.

> **Corrected 2026-08-30 — finding 9 was closed, and the trap was disarmed in the
> same change rather than armed by it.** This paragraph predicted the coupling
> correctly and the fix honoured it.
>
> The coalescers are gone: `DebtsLayout.tsx:48-58` now yields `null`, and each
> call site tests before formatting rather than relying on a default —
> `DebtsBigBoxResult.tsx:27-30` (`amount === null ? DASH : currencyFormat(...)`),
> `ListOfDebtors.tsx:154-160` (`typeof total_debt_balance === 'number'`), and
> `SummaryDebtorDetailBox.tsx:39-42` (the same test). **`currencyFormat` is never
> reached with a `null` on a debts screen**, which is what the trap required.
> `helpers/functions.ts:19` is still where `currencyFormat` is declared.
>
> **The remaining exposure is `AccountBalanceSummary.tsx:26,36`**, which this
> paragraph lists and which is not a debts-module file — it is shared with the
> other detail screens, and it was not re-measured here.

`numberFormatCurrency(null)` returns the literal string
`'Not a valid number, please try again'`, because `parseFloat('null')` is `NaN`
(`helpers/functions.ts:236-249`). The only debts call site is
`DebtorDetail.tsx:293` *(was `:227`)*, fed by `accountDetail.account_balance`, a
`NOT NULL` column (`002_accounts.sql:101`). ~~whose placeholder is the number `10`
(`DebtorDetail.tsx:73`)~~ — **the placeholder is deleted (finding 4), and the call
now sits inside a branch that only renders when `accountDetail` is non-null
(`:276`).** Not reachable — but note that the same call passes no currency code,
so the "Current Balance" field prints a bare `-10.21` with no symbol while a
currency badge sits two boxes away. *That last observation is still true at
`:293`.*

~~The one place a `NaN` could surface is `SummaryDebtorDetailBox.tsx:31`, covered
in finding 12.~~ **Closed 2026-08-30**: that line is now
`SummaryDebtorDetailBox.tsx:39-42`, a guarded `currencyFormat` with an em dash
fallback, and its comment names the `NaN` it removed. **No path in the debts
module reaches a literal `NaN` on screen.**

---

## 6. Coupling with work already in flight

The pocket module's remaining sequence modifies `getAccountController.js`
(enriching the account list with committed and free cash),
`accountCreationController.js` and `accountEditController.js`. Grouping the
debts findings by the file their fix lands in decides what can start now.

**Blocked behind the shared account controllers — three findings.**

| finding | file | why it is blocked, and how tightly |
| --- | --- | --- |
| the opening date read on the UTC calendar (5) | `getAccountController.js` | The fix serves a zoned calendar label from `getAccountById` — the same function the pocket sequence enriches at `:789-801`. Same function, so genuinely sequential. |
| the three colliding column names (14) | `getAccountController.js` | Rewrites the debtor branch's `SELECT` at `:654-664`. Different statement from the pocket work, same function; low collision risk but the same file. |
| the missing rename collision check (11) | `accountEditController.js` | Lands in the `debtor` case of the switch at `:205-241`; the pocket work is in the `pocket_saving` case at `:90-102`. Adjacent, not overlapping — **workable in parallel with care**, and the cheapest of the three to coordinate. |

**Free to start immediately — everything else.** Findings 1, 2, 3, 4, 7, 9, 10,
12, 15, 16, 17, 18 and 19 are frontend-only, under `pages/debts/`,
`pages/forms/debtorDetail/`, `App.tsx`, `MainNavbar.tsx` and
`editionAndDeletion/validations_zod/`. Finding 6 is in
`getTransactionsForAccountById.js` and finding 13 in `dashboardController.js` —
neither is a file the pocket sequence names.

**The blocking is therefore not the constraint.** Twelve of the fifteen live
defects, including all four of the severe ones, can be worked today without
touching a file the pocket sequence owns.

**`accountCreationController.js` is not implicated at all.** No debtor defect
found in this audit has its fix in the creation path.

---

## 7. What is NOT broken

Stated plainly, because an audit that only lists problems cannot be trusted about
their severity. Each of these was verified, not assumed.

**The board's data contract holds.** Both board endpoints were executed and their
returned keys compared against the destructuring sites. All eight names the list
reads and all seven the headline reads are served under exactly those names. The
pocket module's defect — a client consuming names the server does not serve — is
**not present here**.

**The sign convention is coherent end to end.** A loan made (`lending`) produces
a positive debtor balance, counted as `debt_receivable` and flagged `debtor`; a
loan taken (`borrowing`) produces a negative one, counted as `debt_payable` and
flagged `creditor`. Traced through `accountCreationController.js:672-676`, the
two board queries, and the headline title at `DebtsLayout.tsx:66`. Payable is
served as a negative number and displayed as one, which is at least
self-consistent — whether it should be is a product question, in section 8.

**The currency model is correct on every debtor write path.** Creation converts
the typed amount to the accounting currency before the funds check
(`accountCreationController.js:641-651`), stores the converted figure in
`user_accounts` and `debtor_accounts.value`, and preserves the origin in the six
FX columns migration `016_debtor_value_fx_columns.sql` added. Measured on account
37: `342.00` of currency 3 typed, rate `0.00031872` from `exchange-rate-api`,
`0.11` stored. The tracker's debt movement path does the same
(`transactionController.js:285-390`). One accounting currency is stored; the
currency the form sends is origin metadata only.

**The statement endpoint is timezone-correct everywhere except one line.**
Period bounds, `transaction_local_date`, `transaction_local_time` and the
prior-balance date are all resolved in the owner's zone in SQL. Finding 6 is a
single leaked UTC slice, not a systemic problem — and `formatDateToDDMMYYYY` is
correct for the `YYYY-MM-DD` labels it is handed, because reading a
UTC-parsed calendar label with UTC getters cannot shift a day.

**The tracker degrades correctly when there are no debtors.**
`DEBTOR_OPTIONS_DEFAULT` is an empty array (`helpers/constants.ts:121`), so the
dropdown renders empty with a blank title rather than inventing a row. It is the
one debts screen that does not fabricate data. Its labels do print raw
unformatted balances (`tracker/debts/Debts.tsx:179`), which is cosmetic.

**Debtor name uniqueness is enforced at creation.** `verifyAccountExistence`
throws on a hit (`verifyAccountExistence.js:42-46`), so the fact that
`accountCreationController.js:602` discards the return value is not a missing
check. ~~Only the edit path lacks it (finding 11).~~ **Corrected 2026-08-30: the
edit path enforces it too**, at `accountEditController.js:239-264`, on the same
key. Neither path is backed by a database constraint — see 12.6, item 4.
*(Anchor re-read from `:588`.)*

**The edit link and its route are real.** Covered in section 4.

**The detail screen's transaction list, detail modal and loading spinner are
wired.** `useTransactionDetail`, `AccountTransactionDetailModal` and the
`CoinSpinner` at `DebtorDetail.tsx:304` all work; the modal path is the one part
of the screen with a proper loading signal.

---

## 8. Open decisions for the developer

> **All five were ruled on 2026-08-29. Sections 10 and 12 carry the rulings
> and supersede this section.** What follows is the analysis the rulings were made
> against, kept because the reasoning is what produced them, not because any of
> it is still open.

**Which of the two debts URLs is canonical.** `/fintrack/debts` and
`/fintrack/debts/debtors` both render the same component, and each is the one
URL on which exactly one of the module's two controls works.
**Recommendation: keep `/fintrack/debts/debtors`** and make the list's link
absolute — it is what the navbar, the `new_profile` route and the detail route
already assume, so it is the choice that moves one thing instead of three.

**Whether the count of debtors with a zero balance gets a place on screen.**
The two counts already displayed are presented as a decomposition of the list
below them and currently are not one, because a settled debtor falls into
neither. **Recommendation: render it**, because the alternative — deleting it —
leaves two counts that visibly fail to add up, and the server already pays for
the computation.

**Whether "payable" should be displayed as a negative figure.** It is served
negative and rendered negative, beside a "receivable" that is positive, under a
heading that already states the direction ("you owe" / "you're owed").
**Recommendation: display its absolute value**, because the heading carries the
direction and a negative number under a "you owe" heading asks the reader to
apply two sign conventions at once.

**Whether the loan amount is editable.** The editor offers `debtor_name`,
`debtor_lastname` and `note` only (`accountEditSchema.ts:187-231`), while the
pocket editor edits its target. **Recommendation: leave it read-only until this
is decided deliberately.** Editing `debtor_accounts.value` without rewriting the
opening transaction desynchronises the audit trail that migration 016 exists to
protect — the migration's own header says `value` is editable after creation and
that the opening transaction then stops describing it, which is a stated cost,
not a solved problem.

**Out of scope and deliberately not settled here:** what the module is called,
whether writes are modals or routes, and any visual redesign.

---

## 9. Summary

> **Superseded in ordering only by section 10.** The counts and severities
> below stand; the order of work and the priority bands are the developer's,
> ruled 2026-08-29 and recorded in 10.5 and 10.6. Section 11 adds the account
> lifecycle measurement this summary does not cover.

**Fifteen live defects.** Four severe: the detail screen unreachable from the
navigation (1), the fabricated debtor row on empty and error (3), the fabricated
account on the detail screen (4), and the opening date printed a day late (5).
One high: the missing rename collision check (11), raised from moderate by the
developer — his reasoning is recorded with the finding. Three moderate: the
two-dates-for-one-event statement panel (6), the all-zeros headline (9), and the
editor's wrong name preview (10). Seven minor: the hand-formatted amount (12), the browser-clock
window (15), the index key (16), the mutated constant (17), the hardcoded colours
(18), the class-name-as-selector (19), and the discarded zero-balance count (8).

**Four latent**, listed so they are not rediscovered as regressions: the swapped
receivable/payable reconstruction (7), the multi-currency truncation (13), the
three colliding column names (14), and both formatter traps — the second of
which is disarmed only by the coalescers that cause finding 9, so the two must be
fixed in one change.

**The worst one:** clicking any debtor from the URL the main navigation sends
users to produces `/fintrack/debts/debtors/debtors/:id` and lands on the error
page, so the debtor detail screen cannot be opened from the running app at all.

**Blocked behind the shared account controllers:** three findings — 5 and 14 in
`getAccountController.js`, 11 in `accountEditController.js`. The other twelve,
including all four severe ones, are free to start now.

---

### Note on the measurement window

Another session was working in this repository while this audit ran. Between the
first and last reading, `HEAD` moved from `32baed3` to `a6c1f6c` — three commits
touching `EditAccount.tsx`, `CategoryAccountList.tsx` and `CategoryDetail.tsx` —
and the working tree gained uncommitted changes to six pocket-module files plus
`urlConfig.ts` and `pocketTypes.ts`.

**No file cited in a debts finding changed.** The commits and the working-tree
changes were checked by name against every path this document cites; the only
overlap is `pocketDetail/PocketDetail.tsx`, which is referenced in section 4
alone and is not a debts file. Section 4 carries its re-measurement.

Every line number in this document was read at `32baed3` or later and none of
the files involved has been modified since.

---

## 10. The developer's ruling — 2026-08-29

Recorded from the developer's reading of sections 0 to 9. Where a ruling
contradicts this audit's own recommendation, **his is the decision**, and the
audit's reasoning is kept beside it rather than deleted, because the reasoning is
what the ruling was made against.

### 10.1 The verdict

He accepts the audit, and names its most valuable property: **not the count of
defects but the fact that it separates their kinds** — contract defects, state
and interface defects, timezone defects, latent ones, product decisions, problems
shared with other modules, and things that looked like defects and are not. A
count of fifteen is a number; the separation is what tells him which of the
fifteen are the same problem and which are not.

His conclusion, stated exactly:

> **Debts does not need to be redesigned. It needs to be stabilised.**

The domain and the fundamental contracts are reasonably sound — section 7 is the
evidence, and every claim in it was verified rather than assumed. What makes the
module non-production-ready is the presentation and state layer. **No
indiscriminate backend work follows from this audit.** Three findings land in a
backend file — the opening date read on the UTC calendar (5), the statement's
carried-in date (6), the missing rename collision check (11) — and each is a
named line, not a rewrite.

### 10.2 The scope limit he sets

**What exists is a contract, interface and read-path audit. It is not an audit of
the domain, and it is not complete.** The hole he names is the account lifecycle,
and inside it, deletion. Section 11 is the measurement that closes it.

### 10.3 Where the ruling refines or overrules the findings

**The negative payable — presentation only, and the contract does not move.** He
agrees with the audit that a negative figure under a "you owe" heading asks the
reader to apply two sign conventions at once, and he refuses the contract change
that would otherwise follow. The accounting representation stays negative:
`dashboardController.js:218` sums the negative balances and serves them negative,
and that is correct. Only the interface prints the absolute value, under a label
that states the direction in words. The standing principle he invokes, which
outlives this finding:

> **Never alter an accounting meaning to solve a presentation problem.**

**The rename collision rises from moderate to high (11).** Already recorded with
the finding on the day it was raised. His reasoning is the lookup, not the
duplicate label: `debtorIdMap` at `tracker/debts/Debts.tsx:176` is keyed by
`account_name`, so renaming one debtor onto another's name makes one of the two
**disappear logically** from the tracker — unselectable, with every movement
aimed at it routed silently to the survivor. Not severe, and not moderate.

**The count of debtors whose balance is zero becomes a product decision, and he
chose the answer (8).** Three categories rather than two: **those who owe, those
owed, and those settled**, presented as an exhaustive partition that adds up to
the number of rows in the list below it. His reason for showing rather than
deleting: hiding the settled ones is less informative than showing them, and the
two counts on screen today are presented as a decomposition of the list and are
not one. **It is not in the critical batch. It waits.** Section 11.7 records a
dependency his order does not show: the CLOSE operation of the account-deletion
plan settles a residual to zero, and "settled" is defined by a zero balance, so
this count cannot ship before the debts read paths decide what a closed debtor
is.

**The loan principal is not editable in V1, and the audit's reasoning is
accepted.** Editing `debtor_accounts.value` without rewriting the opening
transaction leaves the account metadata saying one figure and the ledger another
— two truths, with no way for a reader to tell which one is the account.
Migration `016_debtor_value_fx_columns.sql` states this cost in its own header
rather than solving it. **If it ever becomes editable it goes through an explicit
accounting operation that writes an adjustment, never a bare `UPDATE`.**

**The multi-currency truncation is confirmed not armed, and blocks nothing (13).**
The model forces a single accounting currency into `user_accounts.currency_id`
(`accountCreationController.js:693`) and preserves the currency the owner typed
as audit metadata on `debtor_accounts` — measured on account 37: `342.00` of
currency 3 typed, rate `0.00031872` from `exchange-rate-api`, `0.11` stored. It
stays a future alert, not a defect.

**The statement fix is surgical, not a refactor (6).** The resolved calendar day
already exists inside the function as `accountStartDay`
(`getTransactionsForAccountById.js:227`), and the one branch that re-derives a
day from an instant (`:390-397`, through the local `formatDate` at `:357`) should
use it. Re-verified while writing this section: the zoned-day helper
`dayInZone(instant, timeZone)` already exists at
`utils/fintrackUtils/date-utils/resolveZonedWindow.js:46`, so neither this
finding nor the opening-date one (5) needs a new helper written.

### 10.4 Two rules established, both wider than debts

These are **FinTrack-wide rules**, recorded here because the debts module is
where they were derived. They bind every module.

**Rule 1 — absence of data is never rendered as data.**

Null, undefined, loading, error and empty must never become a zero, a fabricated
account, a fabricated transaction, today's date, or a default currency.

> In a financial application a zero **means** something, and it does not mean
> "I do not know yet". A date means something, and it does not mean "the date has
> not loaded". A placeholder name in the title position does not mean "loading".

Four of this audit's findings are one violation of this rule seen from four
places: the fabricated debtor row on empty, loading and error
(`ListOfDebtors.tsx:19-30`), the fabricated account on the detail screen
(`DebtorDetail.tsx:69-78`), the seven coalesced zeros on the headline
(`DebtsLayout.tsx:42-52`), and the sample statement seeded from
`DEFAULT_ACCOUNT_TRANSACTIONS` (`DebtorDetail.tsx:80-81`,
`helpers/constants.ts:231-252`). Counting them as four defects understates them;
they are one rule that was never stated.

**Rule 2 — an instant and a calendar day are two different things, and the
conversion happens once.**

An **instant** is a moment with a zone (`TIMESTAMPTZ`). A **calendar day** is a
label on the owner's calendar (`YYYY-MM-DD`). The transformation between them
takes the owner's timezone from `users.timezone` and must occur **exactly once,
in the right place** — never by reading an instant as though it were UTC.

He rules explicitly that the opening date printed a day late (5) and the date
defect the retroactive-dating plan is handling in its own date helper are **not
independent bugs**: they are the same class, and this rule is the foundation both
plans share. The shared vocabulary already exists and is to be reused, not
rewritten — `getUserTimeZone(db, userId)` at `date-utils/getUserTimeZone.js:20`,
`dayInZone(instant, timeZone)` and `todayInZone(timeZone)` at
`date-utils/resolveZonedWindow.js:46,60`, which is the same list
`PLAN_BACKDATING.md` §4.6 names as "what must be reused, not rewritten".

### 10.5 The order of work, which is not the one the audit proposed

The audit grouped the findings by the file their fix lands in (section 6). He
orders them by what has to be true before the next batch can be trusted.

```
 BASELINE      confirm the branch and the working tree; do not mix pocket,
               debts and retroactive-dating work in one tree; record the
               starting point

 STABILISE 1   navigation and state          all frontend, low risk
               the canonical debts route and the detail link
               the new-debtor route
               delete the fabricated debtor row
               delete the fabricated detail account
               real loading / empty / error states, with retry

 STABILISE 2   financial and date correctness
               the opening date on the owner's calendar
               the statement's carried-in date
               the statement window
               the editor's name preview
               the payable's presentation

 STABILISE 3   integrity
               the rename collision
               the settled-debtor classification
               naming the columns explicitly where the two tables collide

 HARDEN        the domain: account lifecycle, ledger, currency model, time
```

**One scheduling ruling: the four highest-priority items do not wait for the
retroactive-dating work.** That is correct. Section 10.6 records one correction
to the reason given for it.

### 10.6 His priority table, and where this audit's ranking differs

**His table is the decision.** The audit's ranking is set beside it so the two
can be read together, and four differences are named below with the reasoning for
each.

| band | his items |
| --- | --- |
| **P0** | the unreachable detail (1), the fabricated debtor row (3), the fabricated detail account (4), the wrong opening date (5) |
| **P1** | the statement date (6), the fabricated zero headline (9), the rename collision (11), the editor name (10), the board's empty and error semantics (3, 9) |
| **P2** | payable presentation (section 8), settled classification (8), statement window (15), currency truncation (13), column collisions (14) |
| **P3** | the index used as a key (16), the mutated constant (17), the stylesheet and token cleanup (18, 19) |

The audit ranked four severe (1, 3, 4, 5), one high (11), three moderate (6, 9,
10), seven minor (8, 12, 15, 16, 17, 18, 19) and four latent (7, 13, 14, the two
formatter traps). **His P0 is the audit's four severe, exactly**, and his P1 is
the audit's one high plus its three moderate. The two rankings agree on severity;
they differ on four points of sequencing and coverage.

**Difference 1 — "the four highest-priority items are frontend" is true of three
of them, not four.** The opening date read on the UTC calendar (5) has no
frontend-only fix that his own Rule 2 permits. The instant is served raw by
`getAccountById` (`getAccountController.js:654-664`) and rendered through
`formatDateToDDMMYYYY` (`helpers/functions.ts:379-390`), which reads it with
`getUTCDate`. The frontend *does* hold the owner's zone — the auth profile
carries `timezone` (`auth/auth_utils/profileTransformation.ts:56`) — so a client
fix is technically available, and it is the wrong one: it puts the instant → day
conversion in the client, which is precisely the ad-hoc conversion Rule 2
forbids. **Recommendation: serve the calendar label from `getAccountById`**, one
of the three files the pocket sequence owns. The scheduling ruling still holds —
it does not wait for retroactive-dating — but it coordinates with the pocket
sequence, and it is not frontend.

**Difference 2 — the payable presentation (P2) arms a latent finding the table
does not name.** The frontend's local reconstruction of the list row inverts the
server's two fields: `DebtorDetail.tsx:60-63` sets `debt_receivable` from a
**negative** balance and `debt_payable` from a **positive** one, against
`dashboardController.js:384-385`. It reaches no pixel today only because
`SummaryDebtorDetailBox.tsx:21` reads neither field. **Any change that makes the
detail card print a receivable or a payable figure arms it**, and the payable
presentation work is exactly that change. **Recommendation: the swapped
reconstruction (7) ships in the same commit as the payable presentation, not
after it.** This is the one place the table carries a live coupling it does not
show.

**Difference 3 — the settled classification (P2) has a dependency on the
account-deletion work.** Recorded in full at 11.7: the CLOSE operation settles a
residual to zero, and **none of the four debtor read paths filters `deleted_at`**
— measured, zero occurrences of the column in `dashboardController.js`,
`getAccountController.js` and `getTransactionsForAccountById.js`. A "settled"
count shipped before that decision silently mixes debtors who repaid with
debtors the owner retired. **Recommendation: the four read paths take their
`deleted_at` decision first; the count follows it.**

**Difference 4 — the hand-formatted amount (12) is in no band, and it is a Rule 1
violation.** `SummaryDebtorDetailBox.tsx:30-31` composes a symbol and
`Number(amount).toFixed(2)`, which is the module's only path to a literal `NaN`
on screen. It is one line. **Recommendation: it rides with the fabricated detail
account (4, P0)**, because that commit already rewrites the detail screen's
rendering, and ranking it P3 costs a second visit to a file the P0 work opens
anyway. A minor companion, recorded rather than argued: the class name written as
a selector (`debts/components/boxComponents.tsx:6`,
`className='box__container .flx-row-sb'`) sits in P3 with the token cleanup and
is not a token defect — the leading dot means the row's flex layout is never
applied at all.

### 10.7 The architectural decision closed now, before any of that work begins

Closed immediately so the next round of work cannot reintroduce the same defects.
Three parts, binding on the debts module from this point.

**The canonical route for the debtor detail is
`/fintrack/debts/debtors/:debtorId`.** `/fintrack/debts/debtors` is the canonical
board URL — it is what `MainNavbar.tsx:17`, the `new_profile` route
(`App.tsx:299`) and the detail route (`App.tsx:328`) already assume. The list's
link becomes absolute at `ListOfDebtors.tsx:108`, and the duplicate index route
at `App.tsx:229` is deleted so the pair cannot drift again.

**Loading, empty and error are three explicit states on every debts screen**, and
each renders as itself: a skeleton, a stated empty message, and an error that
persists with a retry — `useFetch` already exposes `refetch`. A missing figure
renders as a skeleton or a dash.

**Fabricated financial data as a fallback is prohibited.** No module-level
constant standing in for an account, a debtor, a transaction, a balance, a date
or a currency. `defaultDebts` (`ListOfDebtors.tsx:19-30`), the seeded
`accountDetail` (`DebtorDetail.tsx:69-78`) and the seeded statement
(`DebtorDetail.tsx:80-81`) are deleted, not guarded.

---

## 11. The debts account lifecycle — measured 2026-08-29, weighted on deletion

The second block of this audit, opened because the developer named deletion as
the hole in the first (10.2). Create, read, update and delete, with the weight on
delete. Measured against the running code and the local `fintrack_dev` database
at `HEAD` `4a3ebd9`, by the same rule as sections 0 to 9: every figure quoted was
read out of the database or produced by running the controller's own SQL.

**Where the specification actually lives, corrected here.** The implementation
specification is section 13 of `PLAN_ACCOUNT_DELETION/RESEARCH_LOG.md`, not of
`PLAN_ACCOUNT_DELETION.md` — that file is the frozen architecture and has eleven
sections. Section 13 of the log is itself partly superseded by its own section 14
(the account lifecycle), and the frozen plan is the reading of record. This audit
measures the debtor case against **both**, and says which of the two a rule comes
from wherever they differ.

**No SQL in this section wrote anything.** The referential behaviours below are
read off `pg_constraint` and the row inventory; the two deletions they predict
were not executed.

### 11.1 Why this is not a duplicate of the account-deletion plan

**A debtor is also a `user_accounts` row.** It carries an
`account_type_id` of 3, an `account_balance`, its own transactions and its own
counterparties, exactly like a bank account. Everything the deletion plan
specifies therefore applies to it unchanged, and re-deriving that would be waste.

What justifies a second measurement is the part of a debtor that is **not** a
`user_accounts` row: a 1:1 extension carrying a natural person's name, a
designated counterparty account stored as both an id and a copy of its name, six
FX audit columns describing the loan principal, and an opening transaction whose
counterparty is a **real account of the owner's** rather than the system boundary
— which is true of no other account type. Each of those is measured below against
the specification's rules, and only where they meet or fail to meet is reported.

### 11.2 What a debtor account is, structurally

```
 user_accounts (account_id)                      the account, type debtor
   `- debtor_accounts (account_id)   CASCADE     1:1 extension, 14 columns
        value, currency_id                       the principal, accounting currency
        debtor_name, debtor_lastname             a natural person
        selected_account_id      SET NULL *      the designated counterparty
        selected_account_name                    a copy of that account's NAME
        account_start_date                       an instant, duplicated from ua
        original_value .. exchange_rate_*        six FX audit columns (016)
   `- transactions.account_id       RESTRICT     the rows it owns
   `- transactions.source_account_id      RESTRICT
   `- transactions.destination_account_id RESTRICT
```

`*` — measured `SET NULL` on `fintrack_dev`
(`debtor_accounts_selected_account_id_fkey`, `confdeltype = 'n'`). **On a
database built by `createTables.js` the constraint does not exist at all**:
`createTables.js:107` declares `selected_account_id INT` with no `REFERENCES`,
and `supabase/001_production_alignment.sql` never adds one. 11.7 records the
consequence. *(Re-verified 2026-08-30: `createTables.js:107` is unchanged and
still carries no `REFERENCES`.)*

The two live debtors, re-read for this section:

| account | name | stored balance | ledger sum | own rows | surviving affected rows | counterparties |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | `Picapiedras, Pedro` | `1.30` | `1.30` | 4 (14, 121, 122, 143) | 4 (15, 120, 123, 142) | 15 `banco`, 39 `NewCategory` |
| 37 | `Palacios, Lucila` | `-10.21` | `-10.21` | 3 (35, 42, 44) | 3 (36, 43, 45) | 24 `cuenta precargada` |

**Both debtors reconcile exactly** — stored balance equals the sum of their own
rows, drift `0.00`. That is not true of the database around them: measured the
same minute, four accounts do not reconcile — `slack` (14) `+14.25`, `banco` (15)
`+12.01`, `inBestMen` (17) `+0.75`, `cuenta precargada` (24) `-72.00`. **Two of
those four are the counterparties of the two debtors.**

### 11.3 Create

`accountCreationController.js:446-925`. Three writes in one transaction: the
`user_accounts` row, the `debtor_accounts` row, and **two** transaction rows for
the opening — the debtor's leg and the designated bank account's leg, both
`movement_type_id = 8` (`account-opening`), equal and opposite.

Measured on account 37: transaction 35 owned by 37 (`+0.11`), transaction 36
owned by 24 (`-0.11`), both carrying `original_amount 342.00`,
`original_currency_id 3`, `exchange_rate 0.00031872`,
`exchange_rate_source exchange-rate-api`.

**One property here decides the whole deletion picture, and it belongs to no
other account type.** Every other account's opening credits the system boundary
(`slack`). **A debtor's opening credits a real account of the owner's** — the one
the owner picked in the form. Two consequences:

- **The boundary is not a counterparty of a debtor.** Running
 `getAnnulmentImpactReport`'s own SQL for both debtors returns `banco` (`-0.70`)
 and `NewCategory` (`+2.00`) for account 20, and `cuenta precargada` (`-10.21`)
 for account 37. Account 14 (`slack`) appears in neither.
- Therefore, by the plan's own rule that *the net worth impact of a reversal is
 exactly the portion of the balance whose counterparty is the boundary*
 (`PLAN_ACCOUNT_DELETION.md` §3.3), **reversing a debtor moves the owner's net
 worth by zero.** A debtor is pure internal redistribution. That is a
 debts-specific corollary the specification does not state, and it is favourable:
 reversing a debtor cannot create or destroy money.

**A debtor always owns at least one row.** Creation always writes the opening, so
"a debtor with a zero balance" never means "a debtor with no rows". That
distinction is what makes the zero-balance deletion case non-trivial (11.6).

### 11.4 Read

Four paths, all inventoried in section 1: the headline box, the list, the detail
and the tracker dropdown, plus the statement.

**None of the four filters `deleted_at`.** Measured: zero occurrences of the
column in `dashboardController.js`, `getAccountController.js` and
`getTransactionsForAccountById.js`. All four therefore read every debtor row that
physically exists, closed or not.

That is not a defect today — the CLOSE operation does not exist yet — and it is
four of the sixty-eight call sites the deletion plan's read sweep must visit
(`PLAN_ACCOUNT_DELETION.md` §9, unit 8, which requires *a recorded decision*
at each). **This audit records the decision for all four: filter.** A closed
debtor is out of circulation, and the reason is stronger for debts than for any
other type — see 11.7, the collision with the settled-debtor count.

~~Both board queries read `ua.account_balance`, the stored column, never the ledger
(`dashboardController.js:216-234` and `:383-401`). Every figure on the debts board
is therefore a projection of a column that three functions can currently
overwrite. Both debtors reconcile today, so the board is right today; nothing
enforces that it stays right.~~

> **REVERSED — measured 2026-08-30. Both board queries now read the ledger.**
>
> **What this passage asserts.** That the headline and the list both sum
> `ua.account_balance`, so every figure on the debts board is a projection of a
> stored column rather than of the rows underneath it.
>
> **What the code says.** `dashboardController.js:23` declares
> `const DERIVED_BALANCE = derivedAccountBalanceSql('ua')`
> (`utils/fintrackUtils/accountDataRetrieval/derivedBalance.js:181`), and both
> debtor queries are written entirely in terms of it: the headline at `:222-239`
> — total, receivable, payable, and the three counts, each a `SUM` or a
> `COUNT … FILTER` over `DERIVED_BALANCE` — and the list at `:389-406`, including
> the `debtor` and `creditor` flags at `:392-393` and the `ORDER BY` at `:403`.
> The account detail does the same, overwriting `account_balance` with the derived
> figure at `getAccountController.js:822-824`, and so does the tracker dropdown
> (`:378`).
>
> **This is what 11.9 predicted the deletion block's unit 2 would deliver, arriving
> from the read side first.** The consequence for this section is that the debts
> board can no longer print a figure the ledger does not support — which is the
> property 11.9 names as the deletion work's own gain. What the change does **not**
> do is repair the four drifted accounts of 11.2, and it does not close the
> single-writer question: as of today there are **two** balance writers, not one —
> `setAccountBalanceFromLedger.js` (untracked in the working tree, called from
> `transactionController.js`, `accountCreationController.js` and
> `accountCategoryCreationcontroller.js`) and
> `accountDeletionUtils/updateAffectedAccountBalance.js`, still called twice on
> the delete path at `deleteAccountService.js:273` and `:311`. Invariant II and
> the drift repair stand exactly as 11.10 states them.

### 11.5 Update

The editor reaches `debtor_name`, `debtor_lastname` and `note` only
(`accountEditSchema.ts:146-197` — *re-anchored 2026-08-30 from `:187-231`; the
three editable fields are at `:148-155`, `:158-166` and `:190-196`, with the
read-only derived `account_name` between them at `:168-189`*), and the controller
rebuilds `account_name` from the first two (`accountEditController.js:219`, *was
`:239`, which is now where the collision check begins*).

**Three fields the lifecycle depends on are unreachable from any interface**, and
each is a decision by omission rather than by design:

- `debtor_accounts.value` — the loan principal. Ruled not editable in V1 (10.3).
- `debtor_accounts.selected_account_id` and `selected_account_name` — the
 designated counterparty, written once at creation and never revisited. If that
 account is later deleted, the pointer is nulled or dangles and the name copy
 remains, with no interface to correct it.
- `user_accounts.account_start_date` and `debtor_accounts.account_start_date` —
 written from the same variable at creation
 (`accountCreationController.js:735` and `:757` — *re-anchored 2026-08-30 from
 `:696` and `:718`*) and updated by neither path, which is why finding 14's
 collision is latent rather than armed.

### 11.6 Delete — the ten cases, measured

The entry point exists and is reachable for a debtor **today**: the accounting
dashboard's actions menu navigates to `/fintrack/account/:accountId/delete`
(`AccountingDashboard.tsx:509`), the route is declared at `App.tsx:388`, and
`AccountDeletionPage.tsx:57` reads the account type from `location.state` without
branching on it. **Nothing in the deletion path knows a debtor from a bank** —
grepped: no occurrence of `debtor` or `account_type` in
`deleteAccountService.js` or `accountDeleteController.js`. The debts module
itself offers no delete control; the only route in is the accounting dashboard.

The path that executes is the reversal (`RTA`); hard and soft delete raise a
`ReferenceError` before any query runs, and the permission guard admits every
authenticated role — all three re-verified at `HEAD` `4a3ebd9`
(`deleteAccountService.js:343-390`, `:457`,
`accountManagement/checkAndInsertAccount.js:3` and `:91`).

> **Anchors re-read 2026-08-30**, the substance unchanged. `processStandardDelete`
> is at `deleteAccountService.js:371-418`, its hard-delete `DELETE` at `:384` and
> its soft-delete stamp at `:395`. The permission guard is at `:483-484`, still
> `userRole === 'admin' || userRole === 'super_admin' || userRole === 'user'`,
> annotated `//override isAdmin` — so it still admits every authenticated role.
> `processRTAAnnulment` runs `:185-362`, with its `DELETE FROM user_accounts` at
> `:326`. `checkAndInsertAccount.js` is unchanged at `:3` and `:91`.

**1 — a balance of zero.** No local debtor has one, and the case is not vacuous:
a debtor reaches zero by being repaid, and still owns its opening row plus every
repayment. The impact report returns rows summing to `0.00` but is **not empty**,
so `processRTAAnnulment` writes a pair per counterparty and then reaches
`DELETE FROM user_accounts` (`:326`, re-anchored 2026-08-30 from `:296-299`). With `transactions.account_id` at
`RESTRICT` since migration `018` (measured `confdeltype = 'r'` on all three
transaction foreign keys), **that `DELETE` fails**, the whole transaction rolls
back, and the owner gets an error. The governing principle — a zero ledger
balance can be removed without any financial position changing — is about the
settlement, and says nothing about the rows; the rows still have to be dropped
first, which is step 8d of the engine and does not exist yet.

**2 — a positive balance.** `Picapiedras, Pedro` (20), `+1.30`, the owner is
owed. The residual derived from the ledger equals the stored balance exactly, so
the assessment and the settlement agree. Semantically this is forgiving or
collecting a receivable, and the specification's screen wording — *where do the
1.30 go?* — reads correctly for it.

**3 — a negative balance.** `Palacios, Lucila` (37), `-10.21`, the owner owes.
This is the specification's negative-residual branch (log 13.1, rule two: *a
negative residual asks the same question in the other direction — which account
covers the shortfall*). **It has never been executed.** All three measured
deletions were non-negative: `+56.99`, `0.00` (log 13.9) and the investment
account of log 14.16. **A debtor is the only account type in FinTrack whose
balance is designed to be negative in ordinary use** — a `borrowing` loan
produces one by construction (`accountCreationController.js:672-676`) — and one
of the two live debtors is negative. The debts module is therefore the type most
likely to be the first to exercise a branch that is specified and untested.

**4 — an account with movements.** Both debtors have them; the inventory is in
11.2. The seven rows the two debtors own are `movement_type_id` 8 and 4 only —
`account-opening` and `debt`. The seven rows their counterparties own are the
opposite legs. Nothing else in the database points at either debtor.

**5 — the opening transaction specifically.** Two legs, and only one of them is
the debtor's. Deleting the debtor drops its own leg (transaction 35 for account
37) and leaves the bank's leg (36) standing, detached and scrubbed. **Deleting
the counterparty bank instead would, under the same engine, drop leg 36 and leave
leg 35 standing on the debtor.** Neither direction leaves the ledger open,
because each leg is dropped with the account that owns it — but only the engine
guarantees that. Under the cascade the two legs die together with whichever
account is deleted, and the surviving account keeps a balance nothing explains.

**6 — the currency audit columns of that opening.** They exist in two independent
copies, and the deletion treats them differently:

```
 debtor_accounts.original_value, original_currency_id, exchange_rate,
 exchange_rate_source, exchange_rate_timestamp,
 exchange_rate_target_currency_id             CASCADE - destroyed with the account

 transactions.original_amount, original_currency_id, exchange_rate,
 exchange_rate_source, ...   on BOTH legs    the debtor's leg is dropped;
                                             the bank's leg SURVIVES
```

Measured: the surviving leg 36, owned by `cuenta precargada`, carries
`original_amount -342.00`, `original_currency_id 3`, `exchange_rate 0.00031872`.
So the origin FX of the loan outlives the debtor — as **a number without a
subject**, because step 6d nulls the counterparty pointer and step 7d scrubs the
name out of the description. Migration `016` was written because `value` is
editable and the opening transaction might stop describing it; after a deletion
the relation inverts — the transaction is the only survivor, and it no longer
describes the debtor. That is the erasure trade working as specified, not a
defect, and it is recorded so it is not rediscovered as data loss.

**7 — transactions linked to other accounts.** Four rows for account 20 across
two surviving accounts, three rows for account 37 across one. Under `RESTRICT`
they block the physical delete until the engine detaches them, which is the guard
rail working. Under `CASCADE` they are destroyed, and 11.10 states what that
costs to the cent.

**8 — the counterparty account.** Two different notions, and the debts module has
both:

- the **ledger** counterparty of each row (`source_account_id` /
 `destination_account_id`), handled by the engine's detach and scrub;
- the **designated** counterparty on the extension row
 (`debtor_accounts.selected_account_id` plus `selected_account_name`). This one
 is touched by deleting the *bank*, not the debtor. Locally the id is nulled; on
 a `createTables.js`-built database there is no constraint and the id dangles at
 an account that no longer exists. **In both databases `selected_account_name`
 keeps the deleted account's name** — measured, `'banco'` on debtor 20 and
 `'cuenta precargada'` on debtor 37.

**9 — anything the tracker references.** Nothing persisted. The dropdown builds
`debtorIdMap` from the served list at `tracker/debts/Debts.tsx:176`, keyed by
`account_name`, and `DEBTOR_OPTIONS_DEFAULT` is an empty array
(`helpers/constants.ts:121`), so a deleted debtor simply stops appearing and the
dropdown degrades to empty rather than to a fabricated row. **This is the one
case that needs nothing.** The only exposure is a movement form composed against
a debtor deleted in another tab, which is the transaction write path's concern.

**10 — the historical statement.** The debtor's own statement dies with it, which
is what hard delete means: its rows are dropped and `getAccountById` answers
`404` (`getAccountController.js:545`). **The counterparty's statement survives
and becomes the only record that the loan existed** — for account 37, the three
rows owned by `cuenta precargada`, detached and rendering as *Deleted account*.
Two things follow. The surviving statement's carried-in balance is dated by the
branch carrying finding 6, the one UTC slice in an otherwise zoned function
(`getTransactionsForAccountById.js:390-397`); the deletion work does not create
that defect, but it raises its stake from a line on a screen nobody can reach to
the only surviving date of an erased loan. And the erased identity is a **natural
person's name**, which is a stronger erasure obligation than an account label.

### 11.7 Measured against the deletion specification, rule by rule

Verdicts: **covered** — the rule as written handles the debtor case with nothing
added; **covered but untested** — the rule handles it, and no measurement or
execution has exercised it; **needs something the specification does not state**.

| rule | source | debtor case | verdict |
| --- | --- | --- | --- |
| an account with a zero ledger balance can be removed without any position changing | §2 / log 13 | holds; but a zero-balance debtor still owns its opening row, so removal is never a bare `DELETE` | **covered** |
| the owner is never shown a deletion mode | log 13.1 | nothing in the path branches on account type; the debts module offers no delete control at all | **covered** |
| a zero residual asks nothing | log 13.1 | applies unchanged | **covered but untested** |
| a negative residual asks which account covers the shortfall | log 13.1 | the branch a debtor produces by design; 1 of 2 live debtors is negative; never executed on any account | **covered but untested** |
| counterparty history is preserved as an invariant, stated as fact | log 13.1 | for a debtor the counterparty is always a real account of the owner's, so this is the *only* record the loan leaves | **covered** |
| the account's own history is not preserved, said before confirming | log 13.1 | the deletion screen shows the account name, type and a browser-supplied balance (`AccountDeletionPage.tsx:57-61`); it states no consequence | **needs more** — the screen is unwritten |
| the residual is derived from the ledger, never `account_balance` | log 13.2 | both debtors reconcile exactly, so the two agree today; both debts board queries read the stored column | **covered** |
| the assessment is recomputed server-side inside the transaction; the body is an echo | log 13.2 | today `accountData` including `account_balance` arrives from `location.state`; unchanged for a debtor | **covered** |
| two destinations, one code path; `account-closure` as the movement type | log 13.3 | applies unchanged; a debtor's residual can go to a bank or out of FinTrack like any other | **covered** |
| the surviving closure row's owning account type carries the economic meaning | log 13.3 | applies unchanged | **covered** |
| reversal is never a third destination | §3.3 / log 13.4 | reinforced for debts: reversing a debtor has **zero** net-worth impact, because no leg of a debtor faces the boundary (11.3) | **covered**, with a debts-specific corollary to record |
| the three transaction foreign keys become `RESTRICT`; the other six extension keys stay `CASCADE` | §6 / log 13.5 | measured `RESTRICT` on all three locally, `CASCADE` on `debtor_accounts.account_id`, which is correct — the extension row must leave with the account | **covered** |
| detach is a deliberate `UPDATE`, only `WHERE account_id <> A` | §4.1 / log 13.5 | applies unchanged to the 4 and 3 surviving rows measured in 11.2 | **covered but untested** |
| the scrub rewrites only the generated half of `description` | §8 / log 13.6 | the marker rule holds — owner text sits before `Transaction: ` (measured: `test borrow.`, `borrow en cop.`, `lend.`, `test.`). But debtor rows carry **three distinct generated shapes**, one of which the specification never sampled | **needs more** — see below |
| identity in free text lives in exactly two places | §8 / log 13.14 | **false for debts.** `debtor_accounts.selected_account_name` is a third: a `VARCHAR(50)` copy of another account's name, which survives that account's deletion | **needs more** |
| nine foreign keys reference `user_accounts`; the inventory is closed | log 13.14 | **stale.** Measured today: **ten**. Migration `020` added `pocket_allocations.source_account_id` (`ON DELETE RESTRICT`), and `getAccountAllocations` filters by user and by `deleted_at` but **not by account type**, so a debtor is an eligible allocation source | **needs more** |
| `debtor_accounts.selected_account_id` is `SET NULL` — already correct | log 13.14 | true on a chain-built database; **on a `createTables.js`-built database the foreign key does not exist**, so the pointer dangles instead | **needs more** |
| the nine engine steps on one client; lock set `{A, D}` | §4.1, §4.3 | applies unchanged; a debtor adds no account to the lock set | **covered** |
| invariants I, II, III, IV before `COMMIT` | §5 | I and III apply unchanged. **II fails today on both debtors' counterparties** — `banco` `+12.01` and `cuenta precargada` `-72.00` — so a debtor deletion rolls back on pre-existing damage the operation did not cause | **covered**, and blocked by unit 4 |
| the single derived balance writer | §7 | ~~the debts board reads `ua.account_balance` in both queries~~ — **corrected 2026-08-30: both board queries now derive from the ledger** (`dashboardController.js:23`, `:222-239`, `:389-406`), so the read half has landed. The **write** half has not: two writers exist, `setAccountBalanceFromLedger.js` and `accountDeletionUtils/updateAffectedAccountBalance.js` (`deleteAccountService.js:273`, `:311`) | **covered on read, still owed on write** |
| deleting a user fails while `RESTRICT` is in force (D3) | §6 | applies unchanged | **covered** |
| the read sweep records a decision at each of the 68 call sites | §9 unit 8 | four debtor read paths, none filtering `deleted_at`; no decision recorded until 11.4 | **covered**, decision now recorded |
| `processStandardDelete` reachable, `isAdmin` real, `handlePostgresError` imported | log 13.11 | all three re-verified live at `HEAD` `4a3ebd9`; type-agnostic | **covered** |

**The scrub's three shapes, stated exactly**, because the specification's rule is
correct and its sample is not representative. Measured over the fourteen rows
naming a debtor:

```
 A  Account reference: Palacios, Lucila.                    tx 15, 36
      the opening's counterparty leg - no quotes, no id
 B  from "Palacios, Lucila" # 37 (debtor).                  tx 43, 45, 123
 C  credited to "Picapiedras, Pedro # 20" (debtor).         tx 120, 142
```

A scrub written against the sample in the specification — `Received 6.49 USD in
account "pocket de prueba"` — matches shape B and misses A entirely: shape A
carries neither quotes nor an account id, only the bare name after a fixed
label. **Recommendation: the scrub is written against an enumerated inventory of
generated shapes, produced by reading the writers rather than the rows**, since a
shape absent from `fintrack_dev` today is still one the writers can emit.

### 11.8 Which existing findings the deletion path would make worse

> **Corrected 2026-08-30 — three of the four are no longer made worse, because
> they are fixed.** The reasoning below is why they had to be fixed first, and it
> is kept whole; what has changed is the state of the interface it predicts
> against. This is the ordering of 11.10 and 12.9 working: phase 1 landed before
> the deletion engine did.
>
> - **The fabricated account on the detail screen (4)** is gone, and the
>   resource-not-found state that deletion makes reachable is implemented:
>   `DebtorDetail.tsx:176` computes `isAccountMissing = status === 404` and
>   branches on it. The aftermath this paragraph describes — a permanent
>   `LASTNAME, NAME EXAMPLE` on any stale link — is no longer reachable.
> - **The fabricated debtor row (3)** is gone, and the word-order gap that armed
>   it is closed in `useFetch.ts:81-90`.
> - **The all-zeros headline (9)** is gone: `DebtsLayout.tsx` yields `null` and
>   renders three distinct panels.
> - **The statement's carried-in date (6)** is fixed in SQL
>   (`getTransactionsForAccountById.js:414-422`), so the surviving counterparty
>   statement — which after an erasure is the only record the loan existed — is
>   now dated on the owner's calendar.
>
> **What is unchanged is the fourth item and the reason the whole section
> exists.** The rename interaction is still recorded, and deleting the last
> debtor is still the only routine path into the empty state — the difference is
> that the interface now survives it.

**The fabricated account on the detail screen (4) becomes deterministic instead
of intermittent.** After a debtor is deleted, `getAccountById` answers `404`, the
effects at `DebtorDetail.tsx:156-178` never overwrite the seeds, and
`LASTNAME, NAME EXAMPLE` with a balance of `10.00` and an initial balance of
`$1,010.55 (15-06-2025)` stays on screen permanently. Today that outcome needs a
network failure; after a deletion it is the guaranteed result of any stale link,
bookmark or back-navigation to the deleted debtor. **Deletion is the mechanism
that turns this from an edge case into the normal aftermath of a normal
operation.**

**The fabricated debtor row (3) and the all-zeros headline (9) both arm on the
same event: deleting the last debtor.** An existing user cannot reach "no
debtors" any other way. The summary endpoint answers `400`
`No accounts available of type debtor.` (`dashboardController.js:419`), which the
allow-list at `useFetch.ts:81-85` misses on word order, so the list renders a
debtor called `account_name` owing `$0.00`. The headline endpoint's message
(`:267`) *does* match, so that panel prints seven confident zeros with no error
at all. **Deletion is the only routine path to the state both defects were
written to survive and do not.**

**The statement's carried-in date (6) rises in stake.** Covered in 11.6 case 10:
after the debtor is erased, the counterparty's statement is the only surviving
record of the loan, and its opening line is dated through the one UTC slice in
the function.

**The rename collision (11) and deletion interact once**, and marginally: with
two debtors sharing a name, deleting one appears to repair the tracker while
leaving the survivor's history detached from rows that named the other. Recorded,
not ranked.

### 11.9 What the deletion work resolves on its own

**None of the fifteen live defects is fixed by the deletion work.** Stating that
plainly matters more than finding one that is, because the temptation is to fold
debts stabilisation into the deletion block and ship neither.

Two things it does resolve, and neither was a finding in sections 0 to 9:

**A natural person's name is embedded in surviving transaction text.** Fourteen
rows name a debtor; six of them are owned by accounts that survive that debtor's
deletion. The identity scrub is the only mechanism in the codebase that addresses
it, and the obligation is heavier here than for any other account type, because
the identity is a person rather than a label. **This is the deletion work's own
gain, and the debts module is where it pays most.**

**The debts board stops being able to report a figure the ledger does not
support.** ~~Both board queries sum `ua.account_balance`
(`dashboardController.js:216-234`, `:383-401`).~~ **Corrected 2026-08-30: both
board queries now sum a derived balance** (`dashboardController.js:23`, applied
at `:222-239` and `:389-406`), so this gain has **already arrived, from the read
side**, ahead of the deletion block. Today both debtors reconcile — but four
other accounts do not, and the annulment path is the measured mechanism that
broke them. What the deletion plan's single derived balance writer
(`PLAN_ACCOUNT_DELETION.md` §7, unit 2) still owes is the **write** side: two
writers exist today, not one, and the four drifted accounts are unrepaired.

### 11.10 The worst case, and the order it forces

> **Deleting the debtor `Palacios, Lucila` (37) on a database whose transaction
> foreign keys still cascade destroys the three rows owned by
> `cuenta precargada` (36, 43, 45), moving that surviving account's ledger by
> `+10.21` while its stored balance does not move, and taking with it the only
> record that the loan was ever made.**

Every figure in that sentence is measured: the three rows sum to `+10.21`, which
is `-1 x` the debtor's balance, because double entry makes it so. `cuenta
precargada` is already `-72.00` adrift from its own rows, so the damage arrives
on top of damage and is not separable from it afterwards — which is exactly the
mechanism log 13.9 measured twice and log 14.16 a third time.

**Which databases still cascade.** Not `fintrack_dev`: migration `018` ran on
2026-08-28 and all three foreign keys measure `RESTRICT`. Not any database built
from now on: `createTables.js:161-170` and `003_transactions.sql` were both
corrected. *(Re-anchored 2026-08-30 from `:155-163`: the owning FK is at `:163`
and the two transfer FKs at `:169-170`, all three `ON DELETE RESTRICT`, with the
reason written above each at `:161-162` and `:167`.)* **The open case is any database whose `transactions` table already
existed when those edits landed** — `CREATE TABLE IF NOT EXISTS` is inert on an
existing table, and `018` is a chain migration. **This must be measured on
production before a debtor is deleted there**, and it is not measurable from
here.

**Two orderings this forces, both of which the developer's order already
accommodates:**

- **The debts stabilisation batches do not wait for the deletion block.** Nothing
 in Stabilise 1, 2 or 3 touches the deletion path, and the three defects
 deletion makes worse are all made worse in the *frontend*, where Stabilise 1
 already fixes them. Fixing them first is what makes a later deletion survivable
 by the interface.
- **A debtor cannot be deleted correctly until the drift repair lands.** Invariant
 II — every surviving account is explained by its own rows — fails today on both
 debtors' counterparties. Until unit 4 of the deletion plan repairs `banco` and
 `cuenta precargada`, a correctly implemented debtor deletion rolls back on
 damage it did not cause, and an incorrectly implemented one adds to it.

---


---

## 12. The developer's evaluation — 2026-08-29, second reading

His ruling after reading the document whole, including sections 10 and 11.
Recorded by the same rule as section 10: where his ruling refines or overrules
something the audit stated, **his is the decision**, and the audit's own wording
is set beside it. Where his evaluation contradicts something measured, the
contradiction is stated rather than absorbed — a measurement outranks an
assumption in both directions, and 12.6 carries the five places it happens.

### 12.1 The verdict

> **"The audit proves we do not need to redesign Debts. What is still missing is
> turning its findings into a definitive contract of domain + lifecycle +
> metrics + state behaviour."**

The audit is strong for stabilisation and does not close the module's functional
and accounting contract. **Both halves are accepted here.** Sections 0 to 9
measured what the code does; sections 10 and 11 recorded what to do about it and
what deletion costs. None of the three states what a debt **is** in a form a
future change can be audited against.

### 12.2 What he confirms the audit got right

- **A debtor stays an account.** No parallel debts architecture. Debt and debtor
 are a specialised domain over the accounts and ledger system — which is what
 section 0 measured and section 7 verified: the module has no controller of its
 own, and that is a property to preserve, not a gap to fill.
- **The accounting model.** A positive balance is a receivable, they owe you; a
 negative balance is a payable, you owe; zero is settled.
- **The payable stays negative in the accounting contract and prints as an
 absolute value in the interface.** Promoted from a finding-level ruling (10.3)
 to a permanent rule: **accounting representation is not presentation
 representation, and an accounting meaning is never altered to solve a
 presentation problem.**
- **Debts does not need to be redesigned; it needs to be stabilised** (10.1,
 unchanged).

### 12.3 The two FinTrack-wide rules, restated with what changes

Both were already recorded at 10.4. His second reading widens them from rules
about debts into architecture, and one of them gains a required artefact.

**Absence is not zero.** Undefined, null, loading, error and empty are each
distinct from `0`, and none may render as a fabricated account. **What is new:
he wants this written as a general UI data-state contract** — every financial
read model in FinTrack distinguishes loading, success, empty and error, and
inside success only a real value. A missing figure never becomes a financial
default. The four debts violations enumerated at 10.4 become the worked example
of the contract, not the contract itself.

**An instant versus a calendar day.** A `TIMESTAMPTZ` converts through the
owner's timezone to a `YYYY-MM-DD` label exactly once. **What is new: the
prohibition is stated from the debts side** — debts invents nothing. It reuses
`getUserTimeZone(db, userId)` (`date-utils/getUserTimeZone.js:20`) and
`dayInZone(instant, timeZone)` (`date-utils/resolveZonedWindow.js:46`), and it
treats a `YYYY-MM-DD` the server sends as a calendar label, never as an instant.
That last clause is the one the audit had only implied: `formatDateToDDMMYYYY` is
correct for a label and wrong for an instant (finding 5), and the rule now says
which of the two a screen may assume it is holding.

### 12.4 The fifth state — resource-not-found

The audit named three fetch states: loading, error and empty (findings 3 and 9).
**He adds a fourth that deletion makes reachable**, and it is the one section
11.8 predicted from the other direction:

> **A deleted or nonexistent debtor is a resource-not-found state. It is never an
> empty debtor state, and never a fabricated account.**

A debtor deleted in another tab answers `404` on return. That is not "this user
has no debtors"; it is "this debtor is gone", and the two must not render alike.

**Measured, and it makes the fix smaller than it looks.** The mechanism already
exists client-side. `useFetch` returns `status` alongside `apiData`, `isLoading`
and `error` (`hooks/useFetch.ts:9`, `:126-129`), and the detail endpoint's 404
message — `Account does not exist or user mismatch.`
(`getAccountController.js:602`) — matches **none** of the **four** substrings in
the not-found allow-list at `useFetch.ts:81-90`, so it arrives as a real error
carrying `status: 404`. **The fifth state needs no new hook mechanism and no new
endpoint.** It needs `DebtorDetail.tsx` to branch on a status it is already
handed and currently ignores, while the seeded sample stays on screen (finding
4).

> **IMPLEMENTED — measured 2026-08-30.** `DebtorDetail.tsx:103` destructures
> `status`, `:176` computes `isAccountMissing = status === 404` under a comment
> that restates the ruling — *"A debtor that answers 404 is gone — deleted here or
> in another tab"* — and the heading at `:231` and the body branches guard on it.
> The seeded sample it was competing with is deleted (finding 4). The allow-list
> is four entries now, not three, and the message it does not match is at
> `getAccountController.js:602`, not `:545`; neither change touches the
> conclusion.

### 12.5 The seven blocks the audit still owes

**Every block below is owed by the future `DEBTS_DOMAIN_CONTRACT.md`, not by this
audit.** That is his allocation and it is recorded as such: this document is a
measurement of what the code does, and a normative contract is a different kind
of document. What each block gets here is the measured material the contract will
need, so the contract can be written without re-measuring.

**A — the debtor domain contract.** *Owed by the contract document.* Formally
close what a debtor is, what a debt position is, the three positions —
receivable, payable, settled — and the net position. Three of his requirements
land on things this audit measured:

- **One status field replaces the flags.** The server serves `debtor` and
 `creditor` as aggregates over a group of one row
 (`dashboardController.js:388-389`), so they are flags, and **both are `0` when
 the balance is exactly zero** — the audit recorded that at 1.2 and noted that
 nothing on the frontend handles the third state. His diagnosis is sharper than
 the audit's: the flag model **admits impossible states**, and "settled" is
 reachable only by inference from two zeroes. A single status taking
 `receivable`, `payable` or `settled` cannot express an impossible state at all.
- **The person is separated from the position.** A debtor is the party and their
 account; a debt is the financial position. One party can owe, be owed, or be
 settled over time. The extension row already holds the party
 (`debtor_accounts.debtor_name`, `debtor_lastname`) and the ledger already holds
 the position; nothing in the read model separates them.
- **The naming risk.** The account type is called `debtor` regardless of
 direction, which conflicts with the legal sense of the word. **Primary
 vocabulary is receivable / payable / settled; debtor and creditor are
 secondary.** This audit used the server's vocabulary throughout and inherits the
 same conflict.

**B — the movement contract.** *Owed by the contract document, and he names it
the audit's largest functional gap. Accepted.* The audit measured which movement
types appear and never specified the movements themselves. Lending, borrowing,
repayment, settlement and opening each need source, destination, sign, movement
type and balance effect, because **settled is the accumulated result of these
movements** and cannot be defined without them.

**What was measured for it constrains the answer, and changes the shape of the
request** — 12.6, item 2.

**C — the canonical read model.** *Owed by the contract document.* Each screen
re-derives the semantics from the balance, which is exactly the mechanism that
produced the detail screen's inverted reconstruction (finding 7,
`DebtorDetail.tsx:60-63`). His rule: **no screen re-interprets the balance.** The
read model delivers account id, name, balance, receivable, payable, status and
currency, and React stops reconstructing them. This subsumes finding 7 rather
than fixing it — the finding is a symptom of the missing read model, and the
audit ranked it latent because nothing renders it yet.

**D — the lifecycle contract.** *Owed by the contract document.* The debtor is
create, active, settled, closed-or-deleted, not four CRUD verbs — which is why
section 11 was written as a lifecycle rather than as a delete audit. His decisive
clause:

> **Settled is active with a zero balance. Closed is not part of active debts at
> all.**

**And the soft-delete filter is decided in every read path before the settled
classification is implemented.** That confirms, in his own words and with a
stronger reason, what 11.4 recorded and what 10.6 raised as difference three
against his own earlier priority table. The audit said the count would "silently
mix debtors who repaid with debtors the owner retired"; he states the distinction
as a lifecycle rule rather than as a query defect. **His formulation is the better
one and supersedes the audit's.** One measured correction to its scope is at
12.6, item 1: five read paths, not four.

**E — the invariants.** *Owed by the contract document.* The audit demonstrates
these and never states them as rules:

```
 the stored balance equals the sum of the debtor's own ledger rows
 positive is a receivable, negative a payable, zero settled
 an opening transaction always exists - a debtor with no ledger history
   is impossible
 no orphan transaction
 no duplicate debtor name
```

And the source of truth, stated explicitly: **the ledger is the truth; the stored
balance is a derived projection, never the reverse** — guaranteed through the
single balance writer (`PLAN_ACCOUNT_DELETION.md` §7) rather than recomputed on
every read. Section 11 measured the first invariant holding on both debtors
(`0.00` drift) and failing on four other accounts, and 11.9 named the derived
writer as the mechanism that closes it. Two measured qualifications are at 12.6,
item 4.

**F — authorization and concurrency.** *Owed by the contract document.* Ownership
verified explicitly on read, create, edit, movement and delete — not assumed
because an endpoint looks protected. Debt movements participate in the same
ledger concurrency model as account closure: **lock, derive from the ledger,
revalidate, write.** His worked case is the right one to specify against: one tab
records a full repayment while another deletes the debtor. Section 11 measured
the delete half of that race and not the movement half. Partially contradicted at
12.6, item 3.

**G — the metrics contract.** *Owed by the contract document.* Three levels,
separated:

| level | figures |
| --- | --- |
| board | total receivable, total payable, net position, active debtors, counts of receivables, payables and settled |
| detail | current balance, original principal, direction, status, opening date |
| activity | total lent, total borrowed, total repaid, outstanding |

**The activity level is not closed by the audit, and he is right — it is worse
than not closed. It is not derivable from the stored data today** (12.6, item 2).

**And the net position is named.** The sum of the two live debtors' balances is
`-8.91`, and it is a **net debt position**, not a total debt. It is served as
`total_debt_balance` (`dashboardController.js:217`), a field name that invites
exactly the misreading he is guarding against. Recorded so the contract renames
the concept even if the wire field keeps its name for compatibility.

### 12.6 Where his evaluation and the measurements disagree

Five places. None changes his direction; three change what the contract document
has to contain.

**1 — the read paths are five, not six.** *(Anchors in this item re-read
2026-08-30: the creation handler is `accountCreationController.js:460-986`, and
the zero-`deleted_at` sweep across `dashboardController.js`,
`getAccountController.js` and `getTransactionsForAccountById.js` still measures
zero. The count and the argument are unchanged.)* He counts six. The audit's section 1
has six subsections and the sixth is the **creation** path (1.6,
`POST /account/new_account/debtor`), a write recorded because it decides what the
reads can ever contain. The reads are the headline box, the list, the detail, the
statement and the tracker dropdown. The soft-delete decision of block D therefore
covers **five** read paths, and the fifth — the statement — is the one his
formulation is most likely to miss, because it is reached through an account id
rather than through a debts screen. Measured: zero occurrences of `deleted_at` in
`dashboardController.js`, `getAccountController.js` and
`getTransactionsForAccountById.js`.

**2 — the schema cannot distinguish a loan from a repayment, so the movement
contract has to define a derivation rather than document one.** This is the
substantive disagreement. Measured over all fourteen rows touching the two
debtors:

```
 movement_type_id     8 = account-opening,  4 = debt      two values, not five
 transaction_type_id  lend   on every leg whose balance FALLS
                      borrow on every leg whose balance RISES
```

`transaction_type_id` is a **per-leg direction label, redundant with the sign of
`amount`** — not an economic type. Transactions 121 and 143 are stored as
`borrow` on the debtor while representing the owner **lending more**;
transactions 42 and 44 are stored as `lend` on the debtor while representing the
debtor **repaying**. The verb describes the transfer leg, never the event.

**Nothing stored distinguishes a new loan from a repayment.** Recovering it needs
the running balance at that row, and the case that makes it genuinely hard is
live rather than hypothetical: transaction 42 took account 37 from `+0.11` to
`-4.89`, so it is `0.11` of repayment and `4.89` of new borrowing in one row.

**Consequence for the metrics contract:** total lent, total borrowed, total repaid
and outstanding are **not computable from today's data** without a rule for the
zero-crossing case. **Recommendation, one: the contract defines the derivation —
a movement is classified against the sign of the balance before it, and a row
that crosses zero is split at the crossing** — rather than adding a movement type
column. A new column classifies future rows and leaves the fourteen existing ones
unclassifiable, which is the worse of the two, and the derivation is exact for
every row already written.

**3 — ownership is already verified on the debtor read paths.** Block F says
ownership must not be assumed because an endpoint looks protected. Measured: all
five debtor read queries carry `WHERE ua.user_id = $1` in the SQL itself
(`dashboardController.js:235`, `:401`; `getAccountController.js:393`, `:722`;
`getTransactionsForAccountById.js`). *(Re-anchored 2026-08-30 from `:229`, `:397`,
`:366` and `:660`; every one of the five still carries the predicate.)*
**The half of his statement that is true
today is the write and delete side**, where the deletion service's permission
guard admits every authenticated role (`deleteAccountService.js:483-484`,
*re-anchored 2026-08-30 from `:457`*; `userRole === 'user'` is still included in
`isAdmin`, still annotated `//override isAdmin`) and the balance to be written
arrives from the browser (11.7). The contract should state the rule for all five verbs and
record that the read half already satisfies it, or the work will be re-done where
it is already correct.

**4 — one invariant is not enforceable at the storage layer, and it is owned
elsewhere.** *No duplicate debtor name* has **no database constraint**:
`user_accounts` carries no unique index on
`(user_id, account_name, account_type_id)`. Creation enforces it in code
(`verifyAccountExistence.js:42-46`) ~~and the edit path does not (finding 11)~~
— **corrected 2026-08-30: the edit path enforces it too now**, at
`accountEditController.js:239-264`, on the same key (name plus type, per user,
self excluded, soft-deleted excluded). **The invariant is real, the enforcement
is in application code on both write paths, and there is still no database
constraint** — re-verified, `user_accounts` has no such unique index. That is
what this item says and it stands; only the "one path checks, the other does
not" half has changed. It is already the subject of
`PLAN_ACCOUNT_NAME_UNIQUENESS.md` — **the contract should cite that plan rather
than restate the rule**, or two documents will own one constraint. The
neighbouring invariant, *an opening transaction always exists*, is likewise a
convention rather than a constraint: creation always writes it and
`getTransactionsForAccountById.js:233-235` states it in a comment, but nothing in
the schema requires it.

**5 — a copied name is not identity in the data model and is identity in the
privacy model.** His principle for the counterparty name copy is right about the
schema: `debtor_accounts.selected_account_name` is denormalised presentation data,
not a reference. It does not follow that it may be kept without a decision.
Section 11.7 measured it as a **third place account identity survives in free
text**, against a specification whose inventory closes at two — and for hard
delete the only property that matters is that the string re-identifies an account
that no longer exists. **Both readings are correct and they point opposite ways**,
which is precisely why he is right to call it a separate decision. It is opened at
12.7.

### 12.7 The two decisions he opens

Both were measured in section 11 and neither was decided there. He is right that a
measurement is not a design.

**The designated counterparty — historical record or operating preference?**
`debtor_accounts.selected_account_id`, written once at creation and never
revisited (11.5). Is it the account the loan came from — a historical
counterparty, immutable — or the default account for future movements — an
operating preference, mutable? The answer decides whether the editor may reach it.

**Measured, and it settles more of the question than expected: nothing consumes it
today.** It is read by exactly two queries — the tracker dropdown's projection
(`getAccountController.js:382`, *re-anchored 2026-08-30 from `:362`*) and the
detail's `da.*` (`:715-724`) — and **no write path uses it**: the tracker's debt movement makes the owner pick an account explicitly
(`tracker/debts/Debts.tsx`), and the movement controller never reads it. Whichever
reading wins, something has to change, because the column currently drives
nothing.

**Recommendation, one: the operating preference, mutable.** The historical reading
is already served, durably and by the ledger — the opening transaction records the
counterparty in `source_account_id` (transactions 14 and 35, measured), which
survives edits and cannot drift. A second immutable copy of a fact the ledger
already holds adds a way for the two to disagree and answers no question. The
mutable reading gives the column the only job nothing else does.

**The copied counterparty name — historical snapshot or scrubbed?**
`debtor_accounts.selected_account_name`, a `VARCHAR(50)` holding `'banco'` and
`'cuenta precargada'` on the two live debtors. It survives the deletion of the
account it names, in both database shapes, and on a `createTables.js`-built
database the id beside it dangles rather than nulling, because the foreign key was
never declared there (11.2, 11.7).

**Recommendation, one: scrub it when the account it names is deleted, and keep it
otherwise.** It is presentation data while its subject exists and it is a
re-identifying string the moment its subject is erased, so the trigger is the
deletion rather than the column. This also keeps the identity inventory finite:
the hard-delete model can then still claim that no identifiable reference to a
deleted account survives, which it cannot claim today.

### 12.8 The roadmap item he freezes

> **The loan principal is immutable in the first version. Any later adjustment is
> an accounting operation that writes an adjustment transaction — never a bare
> `UPDATE` on `debtor_accounts.value`.**

Frozen in writing so nobody later "fixes" the figure from a form. This restates
10.3 and hardens it from a first-version scope decision into a standing
prohibition on the mechanism. The reason is unchanged and is in migration
`016_debtor_value_fx_columns.sql`'s own header: editing the stored value without
rewriting the opening transaction leaves the account metadata and the ledger
stating two different figures.

### 12.9 His phase order

**Supersedes the order recorded at 10.5.** Seven phases where 10.5 had five, with
the last three splitting what 10.5 called *harden*.

```
 0  baseline                 separate the pocket, debts and date work in the tree
 1  debts stabilisation      navigation, fabricated data removal, the three fetch
                             states, and the resource-not-found state
 2  accounting and dates     the opening calendar day, the statement's carried-in
                             date, the statement window, the payable presentation,
                             the swapped receivable/payable, the name preview
 3  integrity                the rename collision, the settled classification,
                             explicit column lists, the soft-delete filter
 4  account lifecycle        the deletion baseline, the drift repair, the deletion
                             engine, debtor deletion, verifying the foreign keys
                             on production
 5  the debt domain contract movement semantics, invariants, read model,
                             lifecycle, authorization, concurrency
 6  metrics and analytics
```

**The domain-contract phase does not merge into stabilisation.** Make what exists
correct first; freeze the contract afterwards.

**Three of the four disagreements recorded at 10.6 are resolved by this order, in
his favour, and one stays open.**

- The claim that all four top-priority items were frontend is withdrawn in
 practice: the opening calendar day moves out of the first batch into *accounting
 and dates*, which is where 10.6 argued it belonged.
- The coupling 10.6 raised — that changing how the payable is presented arms the
 detail screen's inverted reconstruction — is adopted: **both now sit in phase
 2**, which is what the audit asked for.
- The dependency 10.6 raised — that the settled classification cannot precede the
 soft-delete decision — is adopted: **both sit in phase 3**, and the lifecycle
 block gives the stronger reason.
- **Still open: the hand-formatted amount** (`SummaryDebtorDetailBox.tsx:30-31`,
 a currency symbol concatenated with `Number(amount).toFixed(2)`, the module's
 only path to a literal `NaN` on screen). It appears in no phase. It is a
 violation of the rule that absence is never rendered as data, and it is one
 line. **Recommendation, one: it goes in phase 1**, with the removal of the
 fabricated detail account, because that work already rewrites the same screen's
 rendering.

### 12.10 What he refuses

Recorded so it is not proposed again: a new debts architecture, a new debts
controller, a repository layer added only for tidiness, a debts-specific ledger
engine, a new currency engine, a new date system, a new state-management
framework, a parallel API, or a visual redesign now.

**One of these preserves the status quo rather than reversing a proposal.** The
debts module has no controller of its own today — every endpoint the debts screens
call lives in the shared account and dashboard controllers (section 0) — so
refusing a debts controller keeps that property rather than undoing anything.

### 12.11 The closing instruction

> Do not widen the stabilisation plan with more architecture. Close the three
> stabilisation batches against the audit, finish account deletion, and then write
> a short normative `DEBTS_DOMAIN_CONTRACT.md` freezing the seven blocks.

**That document, not another implementation plan, is the close of the module** —
the specification any future change is audited against. This audit's role ends at
supplying the measured material for it, and 12.5 marks every one of the seven
blocks as owed by it.

---

### Note on the second measurement window

Sections 10, 11 and 12 were written at `HEAD` `4a3ebd9`. Between the first
block and this one, `HEAD` moved from `a6c1f6c` to `4a3ebd9` — the pocket detail
chain, which rewrote `pocketDetail/PocketDetail.tsx` whole and touched
`pocketApi.ts`, `usePocketDetailStore.ts`, `pocketTypes.ts`, `urlConfig.ts`, the
pocket detail stylesheets and `SummaryPocketDetailBox.tsx`.

**No debts file changed**, checked by name against every path this document
cites. Section 4's claims were re-verified at `4a3ebd9` rather than carried over:
`PocketDetail.tsx` still renders no edit control and no `icon3dots`, and the
three `AccountEditLink` call sites are unchanged at the same lines —
`accountDetail/AccountDetail.tsx:192`, `categoryDetail/CategoryDetail.tsx:328`
and `debtorDetail/DebtorDetail.tsx:208`. Spot-checked and confirmed unmoved:
`MainNavbar.tsx:17`, `ListOfDebtors.tsx:108`, `DebtorDetail.tsx:203`, `:227` and
`:250`.

**A third session was writing while section 11 was measured, and it is still
writing.** At 17:34 `git status` showed seven modified files that no part of
this audit touched: `pocketApi.ts`, `Datepicker.tsx` and its stylesheet,
`helpers/functions.ts`, `pocketTypes.ts`, `nameMaxLengths.ts` and
`urlConfig.ts` — the pocket-deadline and date-picker work, not debts.

**One file this document cites is among them.** `helpers/functions.ts` gained
17 uncommitted lines at `:346` (`formatCalendarDate` and `toCalendarDay`),
which moves `formatDateToDDMMYYYY` from `:379` to `:396`. Every line number
this document gives for that file is read at `HEAD` `4a3ebd9` and is correct
there; in the working tree the two formatter anchors are unmoved
(`currencyFormat` at `:19`, `numberFormatCurrency` at `:236`) and the date
formatter has moved by 17 lines. Nothing else this document cites has changed.

This is the concrete case for the baseline phase the developer put first
(10.5): **pocket, debts and date work are in one tree right now**, and the only
reason it costs nothing so far is that the two sets of files do not overlap.

---

## 13. Measurements corrected 2026-08-30

Third measurement window. `HEAD` `e919a89`, branch `fix/auth-screen`, **read
against the working tree**: four debts files were modified and unstaged while
this pass ran — `DebtsLayout.tsx`, `debts/components/DebtsBigBoxResult.tsx`,
`debts/styles/debts-styles.css` and
`debtorDetail/summaryDebtorDetailBox/SummaryDebtorDetailBox.tsx` with its
stylesheet — so unlike the two earlier windows, **this document's own files were
in flight**, and every anchor into them below is a working-tree reading.

Nothing in sections 8, 10, 11 or 12 was reopened, reordered or closed as a
ruling. Only assertions about code were touched.

### 13.1 Findings closed in code

Twelve of the nineteen: 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12 and 17. The table
under §3 gives the closing anchor for each. **The four the developer banded P0
are all among them** (1, 3, 4, 5), and so is the whole of his P1 — the statement
date (6), the fabricated zero headline (9), the rename collision (11), the editor
name (10), and the board's empty and error semantics, which closed with 3 and 9.

The fifth state of 12.4 — resource-not-found — is implemented at
`DebtorDetail.tsx:176`.

### 13.2 The seven live findings, and where each one stands

Updated 2026-08-30, after the first step of the developer's order in section 14:
close the seven, then re-measure. Four are closed, one is half closed, and two
stay open for reasons that are not effort.

| # | state | anchor |
|---|---|---|
| 14, the three colliding column names | **corrected defect** | `439c05e`. `debtor_accounts` repeats `account_id`, `currency_id` and `account_start_date`, and `da.*` handed the extension's copy of each to the caller; the extension's own columns are now named one by one, so the base table wins the three |
| 15, the browser-clock window | **corrected defect** | `d560c40`. Both bounds go through `toCalendarDay` (`helpers/functions.ts:355`), which reads the same date parts the bounds were built from |
| 18a, the hardcoded colours | **corrected defect** | `7411ddd`. The two hexes are the exact values `--color-content-primary` and `--color-content-secondary` hold, and the shared summary box already wrote those rules in tokens, so nothing rendered moved |
| 19, the class name written as a selector | **corrected defect** | `23a969a`. `'box__container .flx-row-sb'` named a class with a leading dot and matched no rule. Dropped, not repaired: the container stacks two rows and `flx-row-sb` is a row with space-between, so repairing it would change the layout |
| 13, the multi-currency truncation | **half closed** | determinism closed at `7c9df64`, an `ORDER BY ct.currency_code` under the group, so the row the caller takes at `:278` is repeatable. The truncation itself is live: a second currency is still dropped rather than converted |
| 8, the discarded settled count | **confirmed defect, blocked** | `DebtsLayout.tsx:41`, `:56`, `:66`; computed at `dashboardController.js:228`. Blocked on the definition of a settled debtor, which is section 14's track B and is not to be answered by whoever writes the code |
| 16, the index used as a key | **confirmed defect** | `ListOfDebtors.tsx:139`, over the list re-sorted at `:109-118`. `account_id` is destructured three lines below at `:143` and is unique, so the fix is one token. The file is held by another session |
| 18b, the debug border | **confirmed defect** | `debts-styles.css:3`, `border: 0px solid blue`, with a second commented-out blue border at `:100`. The file is held by another session |

**The measurement that came with the closures**, read against `fintrack_dev` and
recorded here as *confirmed measurement*, in the sense section 14.6 fixes:

- **Five live debtor accounts, not the two this document states**, all in one
  currency. So finding 13 is still unarmed: the truncation cannot fire today.
- **The three colliding columns agree on every one of the five rows.** The old
  and the new query were run side by side on the same connection: 25 columns
  each, no name added or removed, no value changed. Finding 14 closed a path,
  not a visible symptom.
- **Zero debtors sit at a zero balance and zero debtor accounts are
  soft-deleted**, `0` of `5` on both counts. Finding 8 therefore has no
  observable effect yet either, which is why its blocking decision can be taken
  in the contract phase rather than ahead of it.

### 13.3 Three claims that reversed, not merely moved

- **The board no longer reads the stored balance.** Both debtor queries derive
  from the ledger through `dashboardController.js:23`. 11.4 said the opposite and
  is corrected there; 11.9 named this as the deletion work's gain and it has
  arrived from the read side instead.
- **The rename collision check exists, and it is one site for every account
  type**, `accountEditController.js:239-264`. Finding 11 carries the measurement.
- **The not-found allow-list has four entries, not three**, `useFetch.ts:81-90`,
  and the summary list's word order is among them. Three passages in this
  document quote the old count; the correction sits under finding 3 and applies
  to all of them.

### 13.4 Anchor drift, by file

Every line number this document gives into these files was read at `32baed3` or
`4a3ebd9` and has since moved: `dashboardController.js`,
`getAccountController.js`, `getTransactionsForAccountById.js`,
`accountCreationController.js`, `accountEditController.js`,
`deleteAccountService.js`, `createTables.js`, `accountEditSchema.ts`,
`useFetch.ts`, `helpers/functions.ts`, `helpers/constants.ts`,
`tracker/debts/Debts.tsx`, `ListOfDebtors.tsx`, `DebtorDetail.tsx`,
`DebtsLayout.tsx`, `DebtsBigBoxResult.tsx` and
`SummaryDebtorDetailBox.tsx`. The ones this document actually cites are
re-anchored in place above; two that recur and were not worth a note at every
mention: `DEBTOR_OPTIONS_DEFAULT` is at `helpers/constants.ts:119` (was `:121`),
`DEFAULT_ACCOUNT_TRANSACTIONS` at `:184` (was `:231-252`), and `debtorIdMap` is
written at `tracker/debts/Debts.tsx:189` and read at `:454` (the document cites
`:176`). The dropdown label with the raw unformatted balance is at `:192`
(was `:179`) and is still unformatted.

### 13.5 What this pass could not settle

- **The four drifted accounts of 11.2** — `slack` `+14.25`, `banco` `+12.01`,
  `inBestMen` `+0.75`, `cuenta precargada` `-72.00` — were **not re-measured**
  by this pass, which did not open the database. *(Re-measured against
  `fintrack_dev` later the same day, after `3c6e1e0`: the four deltas are
  unchanged to the cent — `slack` stored `-75.97` against a ledger of `-90.22`,
  `banco` `102.59` against `90.58`, `inBestMen` `2.14` against `1.39`,
  `cuenta precargada` `135.49` against `207.49`. A fifth, `Bolivar, Simon`,
  dropped off the list: it was an artefact of the opening row being counted
  twice and closed with the exclusion fix. **Repaired the same evening on the
  developer's order**, by re-derivation and not by an adjustment row: the ledger
  was never wrong, only the column that projects it, so a compensating
  transaction would have corrupted the ledger to match a wrong projection.
  `cuenta precargada` had already corrected itself by then, on receiving a
  movement. Zero accounts drift.)* Invariant II and the ordering it
  forces (11.10) are recorded as they stand.
- **Whether the two balance writers become one.** *(Settled later the same day,
  after this pass: `setAccountBalanceFromLedger.js` is committed in `d41aca2`
  and is the survivor; `updateAccountBalance.js`, which stored a figure its
  caller computed, was deleted with it. `updateAffectedAccountBalance.js`
  survives with its two callers on the delete path and is being migrated onto
  the single writer.)*
- **`AccountBalanceSummary.tsx:26,36`**, named in §5's first trap, is a shared
  detail-screen component and was not re-measured; the debts call sites around it
  were.


## 14. The developer's ruling — 2026-08-30, third reading

Recorded from his reading of section 13. It is a ruling on **how the remaining
work is organised**, not on any individual defect, and it supersedes the framing
sections 0 to 9 were written under.

### 14.1 The verdict: the audit's opening framing no longer holds

Twelve of the nineteen defects are closed in code and **all of P0 and all of P1
are among them**. That changes what kind of module this is. It is no longer a
broken module that needs rescuing before anything else can be attempted. It is a
module whose **visible behaviour layer is largely stabilised** and whose
**accounting and domain contract has still not been formalised or verified**.

Everything below follows from that distinction.

### 14.2 The two tracks, which must not be mixed

The seven live defects and the seven outstanding domain-contract blocks are not
two halves of one backlog. They answer different questions:

> **The seven defects answer: does the current code correctly implement what it
> already intends to do?**
>
> **The seven contracts answer: what should Debts intend to do?**

**Track A - defect closure.** Close the seven live defects; re-measure; leave the
defect audit clean.

**Track B - domain contract.** Finish phases three to six; close the definitions
and the invariants; contrast them against the ledger, the accounts, the balances
and the movements that already exist; and only then implement or refactor what
the contract demands.

**He explicitly refuses to interleave them.** The worked example is the pair
already in this document: the second currency dropped from the headline is a
question of **query determinism** - a grouped query read without an ORDER BY -
while what constitutes a debt movement is a question of the **economic model**.
Both live in Debts. Solving either supplies no evidence for the other.

### 14.3 The seven live defects, by the kind of failure each one is

His reading of §13.2, which regroups them away from the audit's own ranking:

| defect | kind of failure |
|---|---|
| the count of settled debtors, computed and discarded | data lost between layers |
| the second currency dropped from the headline | non-deterministic SQL query |
| the three colliding column names in the detail query | detail data contract |
| the statement window on the browser clock | wrong temporal authority |
| rows keyed by array index | React identity and rendering |
| raw colours and a debug border | visual cleanup |
| a class name written as a selector | mechanical defect |

**None of the seven justifies reopening the design of Debts.** They are localised
and are to be closed before the domain contract is entered.

### 14.4 The order

1. **Close the seven live defects.** Bounded, and they remove noise.
2. **Re-issue the measurement of Debts**, especially after the changes that made
   the fifth drifted account disappear.
3. **Continue with the seven contract blocks**, being extremely conservative:
   specification first, code second.
4. **A second audit, against the closed contract.** Not *does the screen work*,
   but: does the movement correctly represent the economic reality; which
   accounts take part; what happens to principal and to repayment; what
   *outstanding* means; what happens at a zero balance; which invariants the
   ledger holds; what happens with currencies; which dates are authoritative;
   what may be edited and deleted; and how Debt interacts with Account and
   Transaction.

**Only after step four is Debts closed as a domain** - not merely *free of
visible bugs*.

### 14.5 Where this sits against the other plans

**Account Deletion does not go ahead of finishing the Debts specification**, if
Debts is the module being stabilised now. This narrows §12.9's phase order rather
than overturning it.

But the seven contracts are **not** to be started as implementation yet either.
Step one above comes first.

### 14.6 Audit hygiene, made a requirement

The corrections of §13 changed the **evidence**, not only the text, and the
document must stop carrying them as open technical debt:

- the single balance writer is committed;
- the four drifted accounts were re-measured and agreed to the cent, and have
  since been repaired by re-derivation;
- **`Bolivar, Simon` was never a fifth drift.** It was a consequence of the
  opening row being counted twice, and it is explained, not outstanding.

From here this document distinguishes four states and never conflates them:

| state | what it means |
|---|---|
| confirmed defect | measured, still live in code |
| corrected defect | measured, closed in code, with the closing anchor |
| confirmed measurement | a reading of data, true at a stated instant |
| measurement artefact, later explained | a reading that turned out to be a consequence of a defect elsewhere, and is not itself a finding |

This matters most now, entering the contractual part: **the contract of Debts
must not be built on anomalies that have already been explained.**

### 14.7 The closing sentence, kept as he wrote it

> Debts is much further along than the original audit suggested, but it is not
> conceptually closed. The twelve closures clean the surface and the seven
> remaining corrections can leave the module technically clean; the work that
> actually matters is turning the Debt domain into an explicit, verifiable
> contract.


## 15. The presentation rule for amounts — 2026-08-31

Settled with the developer while looking at the running app, and applied the
same day across four surfaces. It is a presentation contract, not an accounting
one: **nothing about how a figure is stored or served changes.**

### 15.1 The rule

| what the figure is | sign | colour |
|---|---|---|
| a **position** whose direction is written beside it in words | **none** — printed as a magnitude | yes, as the second carrier |
| a **movement**, a delta that accumulates against an opening balance | **always** — the sign is the operator of that sum | yes, reinforcing the sign |
| an **aggregate or net** | **always** — it is the result of a subtraction | no |

The deciding question is never *is this a debt*. It is **whether something else
on the same line already says the direction**. Where words say it, the sign
states it a second time and reads as a negative debt; where nothing says it,
the sign is the only carrier and removing it destroys information.

**Colour is never the only carrier.** It repeats what the words or the sign
already say, so the screen survives monochrome, high contrast and an eye that
cannot separate the two hues. And the pair is **not red and green** — that is
the one pair the most common colour blindness collapses, and a red would have
landed beside the status square's own red on the same row.

### 15.2 Where it now holds

- **The panel's two positions**, coloured on the dark indicator (`9647e3b`).
  The net above them keeps its sign and takes no colour: colouring it would
  have the panel judge an overall position the app makes no judgement about.
  The two counts take none either — they are not amounts.
- **Every debtor row**, which now states the direction in words beside the
  counterparty's role and prints the figure unsigned and coloured (`9455479`).
- **The debtor card at level 3**, unsigned (`7eb1cf4`) and then coloured
  (`276e4bf`).
- **Every movement row of every statement**, which keeps its sign and takes
  colour as reinforcement (`5ebc101`).

### 15.3 The two tokens the rule needed

The amount pair is calibrated against the app surface, where it carries 4.96
and 5.59 to 1. On the cream panel it falls to **2.98 and 2.64**, under the 3:1
floor that applies even to large text — and the card's figure is read at body
size. `tokens.css` already records the same trap for the semaphore, which drops
to 1.89 on that panel, and answers it with a separate triad for light surfaces.

The amount pair had no such counterpart, so two were added rather than the
existing pair stretched over a surface it was not measured for:
`--color-amount-positive-on-panel` and `--color-amount-negative-on-panel`,
darkened along their own hue so a reading does not change colour family when it
moves from a row to a card. Measured against the panel: **4.94 and 4.74**.

### 15.4 Open on the debtor detail, recorded and not started

**A statement over a period the owner picks.** The card serves the current
month and only the current month: the window is computed from the device's
clock at render and there is no control to move it. The developer requires the
query to take dynamic dates.

It is **not blocked by the missing temporal model**. The per-account statement
endpoint already computes the carried balance at the start of the window it is
given — it is the one place in the application that has a temporal model today.

**And it already names that window two ways, which settles the question the
developer asked on 2026-08-31.** `getTransactionsForAccountById.js:138-180`
reads `month`, as `YYYY-MM`, or `start` and `end` as calendar days. Never both:
a request carrying both is refused with an explicit 400, *send either month or
start/end, not both*, on the stated grounds that a request naming two windows
has not decided which one it means.

The two are **not two flavours of the same thing**, and the file says so at
`:124-137`:

- **`month`** is the monthly-domain path. The month resolves on the account
  owner's calendar so the rows agree with the monthly figures shown above them.
  Today only the budget screen sends it.
- **`start`/`end`** is the continuum path, and the file still calls it legacy
  because pocket, debtor and account detail all reach it with a window built
  from the BROWSER's clock. The branch itself is no longer naive: both bounds
  are resolved in the owner's zone through `resolveZonedWindow`, which replaced
  a pair built from `new Date()` that answered for whatever zone the server ran
  in. What still differs between the two paths is **which figure "initial"
  names**.

Both paths bound the window by the life of the account, so neither can open a
period before the account existed or close it on a day that has not happened.

So for this unit the choice is already made by the domain and not by
convenience: a debtor's history is a continuum, not a monthly domain, which is
the branch it sits on today. If the picker offers whole months it should send
`month` and let the boundary resolve on the owner's calendar; if it offers an
arbitrary range it sends `start`/`end`. What it must never do is send both.

What is missing is the frontend: the month picker already built for the
category detail, the selected period held where a round trip to a detail and
back does not lose it, and the three fetch states while the new window is in
flight.

This must not be read as licence to start the aggregate work. The panel and the
Overview still have no position at a date, and that stays where §14.4 put it.

**The period block treated like the other account details.** The `period-info`
block on this card is to receive the same treatment its counterparts get on the
other detail screens. The developer stated this as one line; **what "the same
treatment" covers is not yet pinned down** — at minimum the visual convergence,
possibly the behaviour once the picker exists. It is recorded here as his
requirement, not as a specified unit, and needs one sentence from him before
anyone writes it.

Measured today, so whoever picks it up starts from fact: the period is a
read-only label — the word `Period` and the two dates — on **both** the bank
account detail and this one. The **category detail is the only screen with a
real selector**, a `MonthPicker` of its own. So "the same treatment as the
other account details" cannot mean copying a selector that the other account
details do not have; the selector to reuse is the category's.
