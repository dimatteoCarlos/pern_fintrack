// src/fintrack_api/services/budget_services/core/budgetConfig.js
// 📝 CHANGE: New file

// Centralized configuration constants for the Budget module.
// This file contains constants shared across the module.

// Allowed frequency values for budget policies and versions.
// export const ALLOWED_FREQUENCIES = [
//   'monthly',
//   'quarterly',
//   'four-month',
//   'semiannual',
//   'yearly',
// ];

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