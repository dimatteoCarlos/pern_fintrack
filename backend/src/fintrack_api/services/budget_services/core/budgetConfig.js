// src/fintrack_api/services/budget_services/core/budgetConfig.js

// What is left of the frequency configuration.
//
// The budget has one period, the calendar month, and it is not configurable:
// recurrence is the ordering of the allocation rows, not a stored code
// (PLAN_BUDGET_V1 §3.3). Every export that priced or validated a frequency went
// with the code that read it.
//
// MONTHS_PER_PERIOD survives for exactly one reader, and not a budget one:
// assertBudgetFrequenciesMatchConfig in initDatabase.js, the boot guard over the
// budget_frequency_types seed. Both it and this file are removed by the
// migration that drops the old budget tables (§9.4); until that migration runs
// the table still exists and the guard still describes it truthfully.
export const MONTHS_PER_PERIOD = {
  monthly: 1,
  quarterly: 3,
  'four-month': 4,
  semiannual: 6,
  yearly: 12,
};
