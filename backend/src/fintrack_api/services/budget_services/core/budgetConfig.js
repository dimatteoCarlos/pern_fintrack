// src/fintrack_api/services/budget_services/core/budgetConfig.js
// 📝 CHANGE: New file

// Centralized configuration constants for the Budget module.
// This file contains constants shared across the module.

// Default frequency applied when creating a new budget policy.
export const DEFAULT_FREQUENCY = 'monthly';

// Mapping of frequency to the number of months per period.
// Used by PeriodResolver and ComparisonEngine for accumulation calculations.
export const MONTHS_PER_PERIOD = {
  monthly: 1,
  quarterly: 3,
  'four-month': 4,
  semiannual: 6,
  yearly: 12,
};

// Frequency codes accepted as a QUERY WINDOW.
//
// A window only says which date range to report on, so every code the
// arithmetic understands may be requested. Derived rather than declared: a
// code is not a label, it is a KEY into MONTHS_PER_PERIOD. A code accepted by
// validation but absent from that map makes getNumberOfPeriods return
// undefined, and the arithmetic downstream silently yields NaN.
export const ALLOWED_WINDOW_FREQUENCIES = Object.keys(MONTHS_PER_PERIOD);

// Frequency codes accepted on a STORED ALLOCATION.
//
// All five, deliberately. Which frequencies the product offers is a scope
// decision about the UI; which ones the domain understands is a property of
// the schema and the arithmetic. Encoding the first as a server rejection made
// the API describe the frontend roadmap (REMARKS R15). The restriction to
// monthly now lives in the create form.
//
// The cost, stated rather than hidden: a non-monthly allocation is possible
// again, and the unanchored period counting of R14 makes such a row report
// zero budgeted with the whole spend as overspend through a monthly window.
//
// Kept separate from ALLOWED_WINDOW_FREQUENCIES though the sets now coincide:
// a window is a date range, an allocation is a stored recurrence.
export const ALLOWED_ALLOCATION_FREQUENCIES = Object.keys(MONTHS_PER_PERIOD);

// What a write to an existing allocation means.
//
// The two operations are indistinguishable from the data: 600 -> 60 is either a
// typo or a decision, and no rule over dates or amounts tells them apart. Only
// the user knows, so the intent travels in the request (PLAN_F 5.1).
export const ALLOCATION_INTENTS = ['correct', 'change'];

// Applied when the caller omits the intent. A change only opens the next
// period, so defaulting to it never rewrites one that was already reported.
export const DEFAULT_ALLOCATION_INTENT = 'change';
