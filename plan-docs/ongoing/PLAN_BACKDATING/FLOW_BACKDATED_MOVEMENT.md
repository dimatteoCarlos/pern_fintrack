# Flow: a back-dated movement, end to end

Every file the chain touches, in the order it touches them. Two paths run over the
same conversion core — one shows a figure, one stores it — and the whole reason
the core is shared is that they must never disagree.

Verified against the working tree on 2026-08-31. Paths are repo-relative.

---

## 1. The day is chosen

```
useTransactionDate                       the day and the window it may move in
  └─> TransactionDateTrigger             the glyph, the day label, the way back
        └─> Datepicker                   the shared calendar, opened in a portal
```

| file | what it holds |
|---|---|
| `frontend/src/fintrack/hooks/useTransactionDate.ts` | the chosen `Date`, `minDate` = first of the month, `maxDate` = today, and `transactionActualDate` as `'YYYY-MM-DD'` |
| `frontend/src/fintrack/general_components/transactionDateTrigger/TransactionDateTrigger.tsx` | opens the calendar, prints the day once it is not today, and the `Today` button that returns it to the default |
| `frontend/src/fintrack/general_components/transactionDateTrigger/styles/transactionDateTrigger-styles.css` | `.transactionDateControl` wraps the pair; `.transactionDateTrigger` and its `__today` sibling |
| `frontend/src/fintrack/general_components/datepicker/Datepicker.tsx` | the shared `react-datepicker` wrapper, entered through its `customInput` door |
| `frontend/src/fintrack/helpers/functions.ts` | `toCalendarDay` — the `Date` to `'YYYY-MM-DD'` conversion both paths use |

**The window is the current month on the DEVICE's calendar**, resolved once on
mount. The server enforces the same window on the OWNER's calendar, independently.

---

## 2. The preview — what the screen shows

```
TopCard  ──chosenDay──>  useServerCurrencyConversion  ──POST──>  /currency/convert
```

| file | role |
|---|---|
| `frontend/src/fintrack/pages/tracker/components/TopCard.tsx` | derives `chosenDay` from `transactionDateProps.date`, or from the `day` prop for a view with its own calendar; renders the figure, the three fetch states, and the tooltip |
| `frontend/src/fintrack/hooks/useServerCurrencyConversion.ts` | debounces 400ms, aborts superseded requests, and exposes `convertedAmount`, `rate`, `quote`, `source`, `fetchedAt`, `effectiveDate` |
| `frontend/src/urlConfig.ts` | `url_currency_convert` → `currency/convert` |
| `frontend/src/fintrack/pages/tracker/styles/tracker-style.css` | `.currency-preview` and its `--querying` / `--failed` states |
| `frontend/src/fintrack/general_components/rateTooltip/RateTooltip.tsx` | carries the three tooltip lines |

The five screens that mount `TopCard`:

```
frontend/src/fintrack/pages/tracker/expense/Expense.tsx
frontend/src/fintrack/pages/tracker/income/Income.tsx
frontend/src/fintrack/pages/tracker/transfer/Transfer.tsx
frontend/src/fintrack/pages/tracker/debts/Debts.tsx
frontend/src/fintrack/pages/tracker/profitNloss/PnL.tsx      ← owns its own calendar,
                                                               passes day= instead
```

---

## 3. The preview reaches the server

```
POST /api/fintrack/currency/convert
  app.js  ──verifyToken──>  routes/index.js  ──>  currencyRoutes.js  ──>  currencyConvert
```

| file | role |
|---|---|
| `backend/src/app.js` | mounts `/api/fintrack` behind `verifyToken`; the global error handler that emits `{ message, status, error, details }` lives here too |
| `backend/src/fintrack_api/routes/index.js` | `router.use('/currency', currencyRoutes)` |
| `backend/src/fintrack_api/routes/currencyRoutes.js` | `router.post('/convert', currencyConvert)` |
| `backend/src/fintrack_api/controllers/currencyController.js` | validates the amount, the currencies and the day; resolves the owner's zone; **routes today to the live rate and an earlier day to the historical one** |
| `backend/src/utils/authUtils/getAuthenticatedUserId.js` | the owner behind the token |
| `backend/src/utils/fintrackUtils/date-utils/getUserTimeZone.js` | that owner's IANA zone |
| `backend/src/utils/fintrackUtils/date-utils/resolveZonedWindow.js` | `todayInZone` and `isCalendarDate` |

**This controller's routing must match the write path's, exactly.** It is what
makes the previewed figure the figure the row will carry.

---

## 4. The write — what the row stores

```
POST /api/fintrack/transaction/transfer-between-accounts
  routes/index.js  ──>  transactionRoute.js  ──>  transferBetweenAccounts
```

| file | role |
|---|---|
| `frontend/src/urlConfig.ts` | `url_movement_transaction_record` → `transaction/transfer-between-accounts` |
| `backend/src/fintrack_api/routes/transactionRoute.js` | `router.use('/transfer-between-accounts', transferBetweenAccounts)` |
| `backend/src/fintrack_api/controllers/transactionController.js` | reads `transactionActualDate`, checks its shape, refuses a future day and a day before the current month **on the owner's calendar**, then converts before opening the transaction |

The conversion runs BEFORE the database transaction opens, deliberately: a
provider call inside an open transaction would hold it for a network round trip.

---

## 5. The conversion core — shared by both paths

```
currencyAmountConversion
  ├─ no date ──> fxService.fxState            the live rate, TTL-governed
  └─ a date  ──> historicalRateResolver       the rate in force on that day
```

| file | role |
|---|---|
| `backend/src/fintrack_api/services/fx_services/conversion/currencyAmountConversion.js` | picks the source by whether a date was given; returns `amount`, `rate` (the multiplier), `quote` (the published figure), `source`, `fetchedAt`, `effectiveDate` |
| `backend/src/fintrack_api/services/fx_services/utils/fxRateDecimal.js` | the Decimal arithmetic |
| `backend/src/fintrack_api/config/fintrackConfig.js` | `ACCOUNTING_CURRENCY_CODE` |
| `backend/src/fintrack_api/services/fx_services/core/fxConfig.js` | `SUPPORTED_CURRENCIES`, `OFFICIAL_TRM_CURRENCY`, the TTLs |

**`rate` and `quote` are two different facts.** `rate` is the conversion's own
multiplier and for a peso-to-dollar conversion it is 0.00031 — unreadable. `quote`
is what the provider published: one accounting unit equals `quote.rate` of
`quote.currency`. A client cannot derive one from the other, because a cross
conversion's rate is two quotes composed.

---

## 6. The historical cascade

```
historicalRateResolver
  1. findDailyRate                  the store, with the coverage test
  2. Banrep      (peso only)        a whole month range
  3. Banca d'Italia                 a whole month range, and the business-day oracle
  4. the CDN                        exactly one day, the one a real source established
  → 422 FX_RATE_UNAVAILABLE         never today's rate for a past day
```

| file | role |
|---|---|
| `backend/src/fintrack_api/services/fx_services/core/historicalRateResolver.js` | the cascade, the span arithmetic, the future guard, and the `isDaySettled` guard that skips a call which can write nothing |
| `backend/src/fintrack_api/services/fx_services/fxProviders/banrepTrmProvider.js` | the Colombian official source, by validity |
| `backend/src/fintrack_api/services/fx_services/fxProviders/bancaDItaliaProvider.js` | the universal range arm, plus the host-reachability breaker |
| `backend/src/fintrack_api/services/fx_services/fxProviders/githubFallbackProvider.js` | the CDN, source `github-fallback`, one day per call |
| `backend/src/fintrack_api/services/fx_services/db/dailyRateDBaccess.js` | `findDailyRate`, `persistQueriedRange`, `recordQueryCoverage`, `findLatestBusinessDay`, `isDaySettled`, `MAX_RATE_AGE_DAYS` |

**Two ceilings, two questions.** "Is this absence real?" is answered by coverage.
"Is a rate this old acceptable?" is answered by `MAX_RATE_AGE_DAYS = 5`. They are
not the same rule and neither substitutes for the other.

---

## 7. The live path, and how it feeds the historical one

```
fxService  ──>  fxProviderOrchestrator  ──>  the four live adapters
    └─> recordLiveRatesAsDailyObservations   today's live rate becomes today's
                                             observation, so the historical path
                                             does not buy it a second time
```

| file | role |
|---|---|
| `backend/src/fintrack_api/services/fx_services/core/fxService.js` | `fxState`, `ensureFXStateIsFresh`, and the bridge into the historical store |
| `backend/src/fintrack_api/services/fx_services/core/fxProviderOrchestrator.js` | the freshness cascade over the live adapters |
| `.../fxProviders/exchangeRateApiProvider.js` · `freeCurrencyApiProvider.js` · `cotizaveApiProvider.js` | the live adapters; each states `providerDay` when its provider publishes for a day, and null when it quotes a market continuously |
| `backend/src/fintrack_api/services/fx_services/db/fxDBaccess.js` | the mutable one-row-per-pair store |

---

## 8. The warm-up

| file | role |
|---|---|
| `backend/src/fintrack_api/services/fx_services/core/warmRecentRates.js` | resolves every day from the first of last month to today, peso first, off the request path |
| `backend/src/index.js` | calls it un-awaited at boot, and **only when `!process.env.VERCEL`** — so it does not run in production at all |
| `backend/src/app.js` | the cron router that would replace it is commented out |

---

## 9. Where it lands

| table | holds |
|---|---|
| `daily_exchange_rates` | one immutable observation per source, pair and day |
| `exchange_rate_query_coverage` | which spans were actually queried, per source and pair |
| `exchange_rates` | the live rate, one mutable row per pair |
| `transactions` | `amount`, `original_amount`, `exchange_rate`, `exchange_rate_source`, `exchange_rate_timestamp` |

`exchange_rate_source` carries `provider@effectiveDate` on a back-dated movement
and the bare provider name on one dated today. That is the only place a stored row
names the day its rate came from.

---

## 10. Reading a stored movement back

| file | role |
|---|---|
| `frontend/src/fintrack/general_components/fxPathwayCard/FxPathwayCard.tsx` | the correct renderer: the stored rate at full precision, the readable inverse, the lock instant, the source |
| `frontend/src/fintrack/pages/forms/pocketDetail/allocationEntryModal/AllocationEntryModal.tsx` | uses it, and passes `exchangeRateSource` |
| `frontend/src/fintrack/pages/forms/accountDetailSharedComponents/accountTransactionDetailModal/AccountTransactionDetailModal.tsx` | uses it, but **omits** `exchangeRateSource` |
| `frontend/src/fintrack/pages/overview/components/transactionDetailModal/TransactionDetailModal.tsx` | does **not** use it — its own markup, labelling against the wrong currency and over-rounding the re-appliable rate |

The last two are open frontend defects, handed to the frontend session.

---

## The two invariants the whole chain exists to keep

1. **No source may fabricate an effective date.** The date always comes from the
   provider that supplied the rate. A day with no market is answered by the last
   day that had one, and the record names that day.
2. **A past movement is never valued at today's rate.** When no arm answers, the
   resolver raises a 422 and the caller refuses the movement. Falling through to
   the current rate would silently record a figure no market quoted.
