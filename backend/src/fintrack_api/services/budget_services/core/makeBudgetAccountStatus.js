// src/fintrack_api/services/budget_services/core/makeBudgetAccountStatus.js

// The rounding point for one account in one month. Every account status passes
// through here, including the unbudgeted ones, so rounding in the calculator
// instead would leave those unrounded.
//
// No monetary field is ever null. An account with no allocation reports a budget
// of 0 and a real actualSpent, so remainingBudget comes out negative — which is
// what being in the red means, and what null failed to say. The absence of a
// decision IS that 0: there is no separate unbudgeted state.
//
// executionPercentage is the one exception: zero has no percentage, and its
// absence is the fact being reported.
//
// The arithmetic invariants live in assertBudgetFigures, shared with
// makeBudgetMonthStatus. What stays here is what only an ACCOUNT has: a currency
// and a next month.

import { assertBudgetFigures } from './assertBudgetFigures.js';
import { toAmount, toRate } from './money.js';

export function makeBudgetAccountStatus({
 accountId = null,
 accountName = null,
 subcategory = null,
 currency,
 budgetAmount,
 nextMonthBudget,
 actualSpent,
 remainingBudget,
 executionPercentage,
 isOverBudget,
}) {
 if (!currency || typeof currency !== 'string') {
  throw new Error('BudgetAccountStatus: currency is required and must be a string');
 }

 assertBudgetFigures(
  'BudgetAccountStatus',
  { isOverBudget, executionPercentage },
  { budgetAmount, nextMonthBudget, actualSpent, remainingBudget },
 );

 return Object.freeze({
  // The caller asked about a set of accounts and gets one status per account.
  accountId,
  accountName,
  subcategory,
  currency,
  budgetAmount: toAmount(budgetAmount),
  // What next month is already set to. The card shows its exception line by
  // comparing this against budgetAmount, so a terminator repeating the same
  // figure correctly shows nothing.
  nextMonthBudget: toAmount(nextMonthBudget),
  actualSpent: toAmount(actualSpent),
  // Negative when more was spent than allocated, including when nothing was
  // allocated at all. That is the number the user is in the red by.
  remainingBudget: toAmount(remainingBudget),
  // A ratio, not money: rounded so the response and the CSV agree, never summed
  // anywhere. Null when the budget is 0, because there is nothing to divide by.
  executionPercentage: executionPercentage === null ? null : toRate(executionPercentage),
  isOverBudget,
 });
}
