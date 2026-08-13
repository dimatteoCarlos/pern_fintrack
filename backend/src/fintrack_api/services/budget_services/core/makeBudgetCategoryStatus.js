// src/fintrack_api/services/budget_services/core/makeBudgetCategoryStatus.js

// The rounding point for one category in one month: the same budget figures as
// an account status, about the group instead of about one member.
//
// It is a third factory rather than a call to makeBudgetAccountStatus with
// nulls, for the reason makeBudgetMonthStatus is a second one. A category has no
// accountId and no nextMonthBudget — "what next month is set to" is a decision
// taken per account, and a group of accounts does not take it — and it has one
// field neither of the others has: how many accounts it folds.
//
// The invariants the three factories share live in assertBudgetFigures.

import { assertBudgetFigures } from './assertBudgetFigures.js';
import { toAmount, toRate } from './money.js';

/**
 * Build one category group, or the alert that says it cannot be built.
 *
 * currency === null means the group holds accounts in more than one currency.
 * V1 has no FX: adding them would be a conversion at an implicit rate of 1:1,
 * the invented number the module exists to forbid. So the group reports every
 * figure as null and the caller raises a notice naming it — the per-account rows
 * keep their own amounts, so nothing is lost except the bad addition.
 *
 * That branch is unreachable under one accounting currency per installation. It
 * is written anyway because the day it becomes reachable, a silent sum is a
 * wrong number on screen and a null is a question the user can answer.
 */
export function makeBudgetCategoryStatus({
 categoryName,
 currency,
 accountCount,
 budgetAmount,
 actualSpent,
 remainingBudget,
 executionPercentage,
 isOverBudget,
}) {
 if (typeof categoryName !== 'string' || categoryName.length === 0) {
  throw new Error('BudgetCategoryStatus: categoryName is required and must be a non-empty string');
 }

 // A group is built by folding rows, so it can never hold zero of them. A 0 here
 // would mean the fold produced a key nothing mapped to.
 if (!Number.isInteger(accountCount) || accountCount < 1) {
  throw new Error('BudgetCategoryStatus: accountCount must be a positive integer');
 }

 if (currency === null) {
  return Object.freeze({
   categoryName,
   currency: null,
   accountCount,
   budgetAmount: null,
   actualSpent: null,
   remainingBudget: null,
   executionPercentage: null,
   // Null, not false: whether the group is over budget is exactly as
   // unanswerable as the amounts it would be decided from.
   isOverBudget: null,
  });
 }

 if (typeof currency !== 'string') {
  throw new Error('BudgetCategoryStatus: currency must be a string or null');
 }

 assertBudgetFigures(
  'BudgetCategoryStatus',
  { isOverBudget, executionPercentage },
  { budgetAmount, actualSpent, remainingBudget },
 );

 return Object.freeze({
  categoryName,
  currency,
  // What the header of the group says next to its name. Served rather than
  // derived from accounts.filter(...).length on the client, which is the same
  // fold in a component nobody thinks to check.
  accountCount,
  budgetAmount: toAmount(budgetAmount),
  actualSpent: toAmount(actualSpent),
  // Negative when the category was overspent, including when nothing was
  // allocated to any of its accounts.
  remainingBudget: toAmount(remainingBudget),
  // Recomputed from the group's sums, never averaged across its accounts: an
  // average weights an account budgeted at 10 like one budgeted at 10,000.
  executionPercentage: executionPercentage === null ? null : toRate(executionPercentage),
  isOverBudget,
 });
}
