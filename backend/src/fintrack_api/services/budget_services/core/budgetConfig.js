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

// Allowed frequency values for budget policies and versions.
//
// Derived rather than declared: a frequency code is not a label, it is a KEY
// into MONTHS_PER_PERIOD. A code accepted by validation but absent from that
// map makes getNumberOfPeriods return undefined, and the arithmetic downstream
// silently yields NaN. Keeping a second hand-written list would let the two
// drift with nothing to detect it.
//
// The budget_frequency_types catalog is the third list. It owns referential
// integrity, display names and sort order — not validation. A startup
// assertion (Plan B, step B3) fails fast if the seeded codes ever diverge
// from the keys below.
export const ALLOWED_FREQUENCIES = Object.keys(MONTHS_PER_PERIOD);