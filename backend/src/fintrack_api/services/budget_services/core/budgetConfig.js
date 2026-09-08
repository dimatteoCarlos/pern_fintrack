// src/fintrack_api/services/budget_services/core/budgetConfig.js

// What is left of the frequency configuration.
//
// The budget has one period, the calendar month, and it is not configurable:
// recurrence is the ordering of the allocation rows, not a stored code
// (PLAN_BUDGET_V1 §3.3). Every export that priced or validated a frequency went
// with the code that read it.
//
// MONTHS_PER_PERIOD survives for exactly one reader, and not a budget one:
// assertBudgetFrequenciesMatchConfig in initDatabase.js, a boot guard that
// nothing calls. No file in the chain creates the table it guards any more, and
// a database still holds it only if its migrations table names
// 012_backfill_budget_policies.sql, the file commit 3b72371f deleted on
// 2026-08-12 — fintrack_dev names it, the production copy does not. So removing
// the guard and this file is ordinary cleanup, with no migration to wait for.
export const MONTHS_PER_PERIOD = {
  monthly: 1,
  quarterly: 3,
  'four-month': 4,
  semiannual: 6,
  yearly: 12,
};
