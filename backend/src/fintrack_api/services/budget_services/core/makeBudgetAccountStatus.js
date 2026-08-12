// src/fintrack_api/services/budget_services/core/makeBudgetAccountStatus.js

// The single rounding point of the module. Every account status passes through
// here, including the unbudgeted ones, so rounding in the calculator instead
// would leave those unrounded.
//
// No monetary field is ever null. An account with no allocation reports a budget
// of 0 and a real actualSpent, so remainingBudget comes out negative — which is
// what being in the red means, and what null failed to say. The absence of a
// budget travels in isBudgeted and nowhere else.
//
// executionPercentage is the one exception: zero has no percentage, and its
// absence is the fact being reported.

import { isFiniteMoney, toAmount, toRate } from './money.js';

export function makeBudgetAccountStatus({
 accountId = null,
 accountName = null,
 subcategory = null,
 currency,
 isBudgeted,
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

 if (typeof isBudgeted !== 'boolean') {
  throw new Error('BudgetAccountStatus: isBudgeted is required and must be a boolean');
 }

 if (typeof isOverBudget !== 'boolean') {
  throw new Error('BudgetAccountStatus: isOverBudget is required and must be a boolean');
 }

 // isFiniteMoney, not typeof 'number': the service hands over Decimals so no
 // lossy conversion happens on the way in.
 for (const [field, value] of Object.entries({
  budgetAmount,
  nextMonthBudget,
  actualSpent,
  remainingBudget,
 })) {
  if (!isFiniteMoney(value)) {
   throw new Error(`BudgetAccountStatus: ${field} must be a finite amount`);
  }
 }

 if (executionPercentage !== null && !isFiniteMoney(executionPercentage)) {
  throw new Error('BudgetAccountStatus: executionPercentage must be a finite amount or null');
 }

 // Being budgeted is the existence of an allocation, never its magnitude: an
 // account deliberately set to 0 IS budgeted. Only one direction is checkable —
 // an account with no allocation cannot carry an amount, while a budgeted one is
 // free to carry 0.
 if (!isBudgeted && toAmount(budgetAmount) !== 0) {
  throw new Error('BudgetAccountStatus: an unbudgeted account cannot carry an amount');
 }

 return Object.freeze({
  // The caller asked about a set of accounts and gets one status per account.
  accountId,
  accountName,
  subcategory,
  currency,
  // Whether an allocation exists for the reported month. It is NOT
  // "budgetAmount > 0": an account the user deliberately set to zero is
  // budgeted, and the screen must not label it the same as one that never was.
  isBudgeted,
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
