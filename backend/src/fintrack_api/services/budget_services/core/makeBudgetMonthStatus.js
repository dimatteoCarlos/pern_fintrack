// src/fintrack_api/services/budget_services/core/makeBudgetMonthStatus.js

// One entry of the month series: the same budget figures as an account status,
// about a month instead of about an account.
//
// It is a separate factory rather than a call to makeBudgetAccountStatus with
// nulls, because that factory requires two fields a month does not have. The
// currency belongs to the account and is stated once at the top of the series,
// not repeated on sixty identical lines. nextMonthBudget has no meaning inside a
// series at all: "what the next month is set to" is the next entry of the array.
// Passing either as a placeholder would mean inventing a value so a guard can
// accept it, which is how a shape stops describing anything.
//
// The invariants both factories share live in assertBudgetFigures.

import { assertBudgetFigures } from './assertBudgetFigures.js';
import { toAmount, toRate } from './money.js';

// The month a series entry is about, always the first of the month as text.
// A DATE crossing the driver becomes a Date at the node process's local
// midnight, so the repository resolves months in SQL and carries them as text —
// this guard is what keeps a Date from being introduced later by a caller that
// did not read that comment.
const MONTH_PATTERN = /^\d{4}-\d{2}-01$/;

export function makeBudgetMonthStatus({
 month,
 isBudgeted,
 budgetAmount,
 actualSpent,
 remainingBudget,
 executionPercentage,
 isOverBudget,
}) {
 if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
  throw new Error('BudgetMonthStatus: month must be a first-of-month date as YYYY-MM-01');
 }

 assertBudgetFigures(
  'BudgetMonthStatus',
  { isBudgeted, isOverBudget, executionPercentage },
  { budgetAmount, actualSpent, remainingBudget },
 );

 return Object.freeze({
  month,
  // The carry-forward fill means a month with no allocation in force is still
  // present in the series. This is what distinguishes it from a month the user
  // budgeted at zero — the two are the same arithmetic and two different
  // sentences on screen.
  isBudgeted,
  budgetAmount: toAmount(budgetAmount),
  actualSpent: toAmount(actualSpent),
  // Negative for a month that was spent against without a budget. That is the
  // amount the user went into the red by, and it is the reason no monetary
  // field here is nullable.
  remainingBudget: toAmount(remainingBudget),
  // Null when the month's budget is 0. Never averaged into the range total:
  // the range percentage is recomputed from the sums.
  executionPercentage: executionPercentage === null ? null : toRate(executionPercentage),
  isOverBudget,
 });
}
