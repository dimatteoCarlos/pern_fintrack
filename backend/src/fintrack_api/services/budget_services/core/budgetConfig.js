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
// Narrowed to monthly on purpose (REMARKS R15). Aggregating budgets that
// recur on different cycles into one per-user total has no agreed answer yet,
// and until the Overview layer has one, a non-monthly allocation read through
// the default monthly window reports zero budget and a full overspend.
//
// Monthly also makes the unanchored period counting of R14 unreachable rather
// than merely unlikely: with monthsPerPeriod = 1 there is never a remainder to
// discard, so a five-month window is exactly the sum of its five months.
//
// Version 1 only. The other four codes are meant to come back, and
// MONTHS_PER_PERIOD above is left whole so nothing has to be rebuilt for that
// day. Editing this line is NOT enough on its own: R14 must be fixed first, or
// a restored quarterly budget reports zero through a monthly window. The full
// re-activation checklist is in REMARKS R15.
export const ALLOWED_ALLOCATION_FREQUENCIES = ['monthly'];
